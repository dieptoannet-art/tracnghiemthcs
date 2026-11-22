import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';
import {
  C03_MAX_MAIN_SCORE,
  C03_ROUND_POINTS,
  C03_SAMPLE_BADGE,
  C03_SAMPLE_QUESTIONS,
  C03_TOTAL_MAIN_QUESTIONS,
  adaptBankQuestionsForC03,
  advanceC03NextQuestion,
  canAdvanceFromC03Question,
  clearC03Session,
  computeC03Rankings,
  computeC03Summary,
  createDefaultC03SetupConfig,
  getC03RoundPoints,
  getC03SessionStorageKey,
  gradeC03TeamAnswer,
  gradeC03TiebreakerTeam,
  holdC03TeamWhiteboard,
  commitAllC03HeldWhiteboards,
  loadC03Session,
  revealC03Hint,
  revealC03Solution,
  saveC03Session,
  skipC03RevealAnimation,
  startC03Arena,
} from './knowledgeArena3dEngine';

function renderTextWithMathStrict(input: string): string {
  const parts = input.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$[^$\n]+?\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith('\\(') && part.endsWith('\\)')) {
        return katex.renderToString(part.slice(2, -2), {
          displayMode: false,
          throwOnError: true,
          strict: 'ignore',
        });
      }
      if (part.startsWith('\\[') && part.endsWith('\\]')) {
        return katex.renderToString(part.slice(2, -2), {
          displayMode: true,
          throwOnError: true,
          strict: 'ignore',
        });
      }
      return part;
    })
    .join('');
}

test('C03 sample pack has 12 distinct KaTeX questions across 3 ascending rounds, including 2(3x - 1) = 10 -> x = 2', () => {
  assert.equal(C03_SAMPLE_QUESTIONS.length, 12);
  assert.equal(C03_TOTAL_MAIN_QUESTIONS, 12);

  const ids = new Set(C03_SAMPLE_QUESTIONS.map((q) => q.questionId));
  assert.equal(ids.size, 12);

  // Verify round indices & ascending difficulty tags
  for (let i = 0; i < 4; i++) {
    assert.equal(C03_SAMPLE_QUESTIONS[i].roundIndex, 0);
    assert.equal(C03_SAMPLE_QUESTIONS[i].difficultyLabel, 'Nhận biết');
  }
  for (let i = 4; i < 8; i++) {
    assert.equal(C03_SAMPLE_QUESTIONS[i].roundIndex, 1);
    assert.equal(C03_SAMPLE_QUESTIONS[i].difficultyLabel, 'Thông hiểu');
  }
  for (let i = 8; i < 12; i++) {
    assert.equal(C03_SAMPLE_QUESTIONS[i].roundIndex, 2);
    assert.equal(C03_SAMPLE_QUESTIONS[i].difficultyLabel, 'Vận dụng');
  }

  // Verify Round 3 NEVER uses Round 2 multiplier (20)
  assert.deepEqual([...C03_ROUND_POINTS], [10, 20, 30]);
  assert.equal(getC03RoundPoints(0), 10);
  assert.equal(getC03RoundPoints(1), 20);
  assert.equal(getC03RoundPoints(2), 30);
  assert.notEqual(getC03RoundPoints(2), getC03RoundPoints(1));
  assert.equal(4 * getC03RoundPoints(0) + 4 * getC03RoundPoints(1) + 4 * getC03RoundPoints(2), 240);
  assert.equal(C03_MAX_MAIN_SCORE, 240);

  // Verify prompt-required math example 2(3x - 1) = 10 -> x = 2 + strict KaTeX rendering
  const eqQuestion = C03_SAMPLE_QUESTIONS.find((q) => q.stem.includes('2(3x - 1) = 10'));
  assert.ok(eqQuestion);
  const correctOpt = eqQuestion.options.find((o) => o.optionId === eqQuestion.correctOptionId);
  assert.equal(correctOpt?.text, '\\(x = 2\\)');

  for (const q of C03_SAMPLE_QUESTIONS) {
    assert.equal(q.sourceTag, C03_SAMPLE_BADGE);
    assert.ok(renderTextWithMathStrict(q.stem).length > 0);
    assert.ok(renderTextWithMathStrict(q.hintText).length > 0);
    assert.ok(renderTextWithMathStrict(q.explanationText).length > 0);
    for (const o of q.options) {
      assert.ok(renderTextWithMathStrict(o.text).length > 0);
    }
  }
});

test('Full 12-question run gives max 240 score (4x10 + 4x20 + 4x30), verifies Round 3 = 30 pts, and blocks double-scoring', () => {
  const started = startC03Arena({
    config: createDefaultC03SetupConfig({
      participationMode: 'solo',
      shuffleOptions: false,
    }),
    nowMs: 1000,
  });
  assert.equal(started.ok, true);
  let state = started.state!;
  const soloTeamId = state.teams[0].id;

  // Verify 12 distinct deck question IDs
  assert.equal(new Set(state.deck.map((d) => d.question.questionId)).size, 12);

  for (let i = 0; i < 12; i++) {
    const q = state.deck[i].question;
    // Grade twice to assert strict per-(team, question) idempotency
    state = gradeC03TeamAnswer({
      state,
      turnToken: state.turnToken,
      teamId: soloTeamId,
      optionId: q.correctOptionId,
    });
    const scoreAfterFirstGrade = state.teams[0].mainScore;

    state = gradeC03TeamAnswer({
      state,
      turnToken: state.turnToken,
      teamId: soloTeamId,
      optionId: q.correctOptionId,
    });
    assert.equal(state.teams[0].mainScore, scoreAfterFirstGrade);

    // Advance (handling round_summary after Q4 and Q8)
    state = advanceC03NextQuestion(state, 2000 + i * 10);
    if (i === 3 || i === 7) {
      assert.equal(state.phase, 'round_summary');
      state = advanceC03NextQuestion(state, 2500 + i * 10);
    }
  }

  assert.equal(state.phase, 'summary');
  assert.deepEqual(state.teams[0].roundScores, [40, 80, 120]);
  assert.deepEqual(state.teams[0].roundCorrectCounts, [4, 4, 4]);
  assert.equal(state.teams[0].mainScore, 240);

  const summary = computeC03Summary(state);
  assert.equal(summary.completedMainQuestions, 12);
  assert.equal(summary.independentCount, 12);
  assert.equal(summary.rankings[0].mainScore, 240);
});

test('Advance gate blocks moving forward until last team is graded or skipped, and grading last team unlocks advance', () => {
  let state = startC03Arena({
    config: createDefaultC03SetupConfig({
      participationMode: 'teams',
      teamCount: 3,
      teamNames: ['Alpha', 'Beta', 'Gamma'],
      shuffleOptions: false,
    }),
    nowMs: 3000,
  }).state!;

  const q0 = state.deck[0].question;
  const [t1, t2, t3] = state.teams;

  // Grade Team 1 correct (+10)
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: t1.id,
    optionId: q0.correctOptionId,
  });
  assert.equal(canAdvanceFromC03Question(state), false);

  // Attempt premature advance -> blocked at question 0!
  const blockedState = advanceC03NextQuestion(state, 3100);
  assert.equal(blockedState.currentQuestionIndex, 0);

  // Team 2 explicitly skipped (0đ) -> Team 3 still ungraded
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: t2.id,
    skip: true,
  });
  assert.equal(canAdvanceFromC03Question(state), false);
  assert.equal(state.teams[1].mainScore, 0);

  // gradeLastTeam (Team 3) -> unlocks advance & transitions to question_revealed!
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: t3.id,
    teacherConfirmCorrect: true,
  });
  assert.equal(state.phase, 'question_revealed');
  assert.equal(canAdvanceFromC03Question(state), true);
  assert.equal(state.teams[0].mainScore, 10);
  assert.equal(state.teams[1].mainScore, 0);
  assert.equal(state.teams[2].mainScore, 10);

  // Now advance cleanly to Q2 (index 1)
  state = advanceC03NextQuestion(state, 3200);
  assert.equal(state.currentQuestionIndex, 1);
  assert.equal(state.phase, 'playing');
});

test('Equal tie scores preserve shared rank (1, 1, 3) without tiebreaker, and tiebreaker score remains separate from 240 main score', () => {
  let state = startC03Arena({
    config: createDefaultC03SetupConfig({
      participationMode: 'teams',
      teamCount: 3,
      teamNames: ['Đội 1', 'Đội 2', 'Đội 3'],
      enableTiebreaker: true,
    }),
    nowMs: 4000,
  }).state!;

  const q0 = state.deck[0].question;
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: state.teams[0].id,
    optionId: q0.correctOptionId,
  });
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: state.teams[1].id,
    optionId: q0.correctOptionId,
  });
  state = gradeC03TeamAnswer({
    state,
    turnToken: state.turnToken,
    teamId: state.teams[2].id,
    skip: true,
  });

  const tiedRanks = computeC03Rankings(state.teams, false);
  assert.deepEqual(
    tiedRanks.map((r) => ({ name: r.name, rank: r.rank, mainScore: r.mainScore })),
    [
      { name: 'Đội 1', rank: 1, mainScore: 10 },
      { name: 'Đội 2', rank: 1, mainScore: 10 },
      { name: 'Đội 3', rank: 3, mainScore: 0 },
    ]
  );

  // Summary with tie at top
  const summaryTied = computeC03Summary(state);
  assert.equal(summaryTied.isTieAtTop, true);

  // Award tiebreaker point separately -> mainScore remains 10!
  state = { ...state, phase: 'tiebreaker' };
  state = gradeC03TiebreakerTeam({
    state,
    teamId: state.teams[1].id,
    isCorrect: true,
  });
  assert.equal(state.teams[1].mainScore, 10);
  assert.equal(state.teams[1].tiebreakerScore, 1);

  const summaryResolved = computeC03Summary(state);
  assert.equal(summaryResolved.tiebreakerUsed, true);
  assert.equal(summaryResolved.rankings[0].teamId, state.teams[1].id);
  assert.equal(summaryResolved.rankings[0].rank, 1);
  assert.equal(summaryResolved.rankings[1].rank, 2);
});

test('Whiteboard hold mode + hints + viewed solutions reconcile accurately for 50-student class teams', () => {
  const fiftyStudents = Array.from({ length: 50 }, (_, idx) => ({
    id: `hs_${idx + 1}`,
    fullName: `Học sinh ${idx + 1}`,
  }));

  let state = startC03Arena({
    config: createDefaultC03SetupConfig({
      participationMode: 'teams',
      teamCount: 4,
      whiteboardHoldMode: true,
      classStudents: fiftyStudents,
      shuffleOptions: false,
    }),
    nowMs: 5000,
  }).state!;

  assert.equal(
    state.teams.reduce((sum, t) => sum + t.studentNames.length, 0),
    50
  );

  const q0 = state.deck[0].question;
  const wrongOpt = q0.options.find((o) => o.optionId !== q0.correctOptionId)!;

  state = revealC03Hint(state);
  state = holdC03TeamWhiteboard({
    state,
    teamId: state.teams[0].id,
    optionId: q0.correctOptionId,
  });
  state = holdC03TeamWhiteboard({
    state,
    teamId: state.teams[1].id,
    optionId: wrongOpt.optionId,
  });
  assert.equal(state.deck[0].submissions[state.teams[0].id].status, 'submitted');
  assert.equal(state.teams[0].mainScore, 0);

  // Commit all held whiteboards (teams 3 & 4 didn't submit -> auto-skipped at 0đ)
  state = commitAllC03HeldWhiteboards(state, state.turnToken);
  state = revealC03Solution(state);
  state = skipC03RevealAnimation(state);

  assert.equal(state.revealAnimDone, true);
  assert.equal(state.teams[0].mainScore, 10);
  assert.equal(state.teams[1].mainScore, 0);

  const summary = computeC03Summary(state);
  assert.equal(summary.assistedCount, 1); // Team 1 got correct_with_hint
  assert.equal(summary.viewedSolutionCount, 1); // Team 2 wrong -> wrong_viewed_solution
  assert.equal(summary.skippedCount, 2); // Teams 3 & 4 skipped
});

test('RBAC bank adapter enforces student approval rule and requires 12 valid questions', () => {
  const makeBankQ = (id: string, status: Question['status'], level: Question['level']): Question => ({
    id,
    code: id.toUpperCase(),
    subject: 'Toán học',
    grade: '7',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1',
    lesson: 'Bài 1',
    level,
    type: 'single_choice',
    stem: `Câu ${id}: \\(1 + 1 = ?\\)`,
    options: [
      { id: 'a', label: 'A', text: '\\(2\\)' },
      { id: 'b', label: 'B', text: '\\(3\\)' },
    ],
    correctAnswer: 'a',
    explanation: 'Vì \\(1+1=2\\).',
    points: 10,
    author: 'GV',
    version: 1,
    status,
  });

  const mixedBank: Question[] = [
    ...Array.from({ length: 8 }, (_, i) => makeBankQ(`app_${i}`, 'approved', i < 4 ? 'know' : 'understand')),
    ...Array.from({ length: 4 }, (_, i) => makeBankQ(`draft_${i}`, 'draft', 'apply')),
  ];

  // Student sees only 8 approved -> rejected cleanly for 12-question arena
  const studentRes = startC03Arena({
    config: createDefaultC03SetupConfig({ questionSource: 'bank' }),
    bankQuestions: mixedBank,
    userRole: 'student',
  });
  assert.equal(studentRes.ok, false);
  assert.equal(adaptBankQuestionsForC03(mixedBank, 'student').length, 8);

  // Teacher sees all 12 sorted know -> understand -> apply
  const teacherRes = startC03Arena({
    config: createDefaultC03SetupConfig({ questionSource: 'bank' }),
    bankQuestions: mixedBank,
    userRole: 'teacher',
  });
  assert.equal(teacherRes.ok, true);
  assert.equal(teacherRes.state?.deck[0].question.roundIndex, 0);
  assert.equal(teacherRes.state?.deck[11].question.roundIndex, 2);
});

test('Session persistence isolates storage under /demo prefix and handles corrupt JSON safely', () => {
  const store = new Map<string, string>();
  const mockWindow = {
    location: { pathname: '/demo/games/c03' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
  const prevWin = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = mockWindow;
  try {
    const key = getC03SessionStorageKey();
    assert.ok(key.startsWith(KHKT_DEMO_STORAGE_PREFIX));

    const started = startC03Arena({
      config: createDefaultC03SetupConfig({ participationMode: 'solo' }),
      nowMs: 7000,
    }).state!;
    assert.equal(saveC03Session(started, 7100), true);

    const loaded = loadC03Session();
    assert.equal(loaded?.turnToken, started.turnToken);

    mockWindow.localStorage.setItem(key, '{corrupt_json');
    assert.equal(loadC03Session(), null);
    assert.equal(mockWindow.localStorage.getItem(key), null);

    clearC03Session();
  } finally {
    (globalThis as { window?: unknown }).window = prevWin;
  }
});

test('Headless EduGameSoundBank triggers C03 arena cues cleanly without throwing and guards stale turn tokens', () => {
  const soundBank = new EduGameSoundBank();
  soundBank.setActiveTurnToken('c03_q0_1000');

  assert.doesNotThrow(() => {
    soundBank.playC03OpenQuestion(false, 'c03_q0_1000');
    soundBank.playC03LockAnswer(false, true, 'c03_q0_1000');
    soundBank.playC03LockAnswer(false, false, 'c03_q0_1000');
    soundBank.playC03RoundTransition(false, 2, 'c03_q0_1000');
    soundBank.playC03RoundTransition(false, 3, 'stale_turn_token');
    soundBank.playC03OpenQuestion(true, 'c03_q0_1000');
    soundBank.stopAll();
    soundBank.dispose();
  });
});
