import assert from 'node:assert/strict';
import test from 'node:test';
import { Question } from '../../../types';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import {
  D07_SAMPLE_BADGE,
  D07_SAMPLE_PACK_TITLE,
  D07_SAMPLE_QUESTIONS,
  POINTS_DRAW,
  POINTS_LOSS,
  POINTS_WIN,
  advanceGroupChallengePointer,
  buildD07QuestionPool,
  clearD07Session,
  commitGroupChallengeQuestionResult,
  computeGroupChallengeStandings,
  computeRoundRobinMeta,
  createChallengeTeams,
  createDefaultGroupChallengeConfig,
  createInitialGroupChallengeState,
  editLastConfirmedGroupChallengeQuestion,
  endGroupChallengeEarly,
  evaluateGroupChallengeSoloAnswer,
  generateRoundRobinSchedule,
  getActiveTeamIdsInRound,
  getD07SessionStorageKey,
  loadD07Session,
  prepareGroupChallengeQuestions,
  saveD07Session,
  shuffleChallengeOptionsPreservingId,
  validateGroupChallengeSetupConfig,
} from './groupChallenge3dEngine';

function makeMockStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

function makeBankQuestion(partial: Partial<Question> & { id: string }): Question {
  return {
    id: partial.id,
    code: partial.code || `Q-${partial.id}`,
    type: partial.type || 'single_choice',
    stem: partial.stem || `Câu hỏi \\(x + 1 = 2\\) (${partial.id})`,
    subject: partial.subject || 'math',
    grade: partial.grade || '7',
    level: partial.level || 'understand',
    status: partial.status || 'approved',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1',
    lesson: 'Bài 1',
    options: partial.options || [
      { id: `${partial.id}_a`, label: 'A', text: '\\(1\\)' },
      { id: `${partial.id}_b`, label: 'B', text: '\\(2\\)' },
      { id: `${partial.id}_c`, label: 'C', text: '\\(3\\)' },
      { id: `${partial.id}_d`, label: 'D', text: '\\(4\\)' },
    ],
    correctAnswer: partial.correctAnswer || `${partial.id}_a`,
    explanation: partial.explanation || 'Giải thích ngắn gọn.',
    points: partial.points ?? 1,
    author: partial.author || 'teacher_demo',
    version: partial.version ?? 1,
  };
}

// ============================================================================
// 1. ROUND-ROBIN SCHEDULE VERIFICATION (2, 3, 4, 5, 6 TEAMS)
// ============================================================================

test('Round-robin schedules for 2, 3, 4, 5, and 6 teams pair every unordered duo exactly once and rotate byes fairly', () => {
  for (const teamCount of [2, 3, 4, 5, 6]) {
    const teams = createChallengeTeams(teamCount);
    const meta = computeRoundRobinMeta(teamCount);
    const rounds = generateRoundRobinSchedule(teams);

    assert.equal(rounds.length, meta.roundCount, `Round count mismatch for ${teamCount} teams`);

    const pairKeys = new Set<string>();
    const byeCounts = new Map<string, number>();
    teams.forEach((t) => byeCounts.set(t.id, 0));

    let totalMatches = 0;
    for (const r of rounds) {
      const seenInRound = new Set<string>();
      for (const m of r.matches) {
        assert.notEqual(m.teamAId, m.teamBId, 'Team cannot play itself');
        assert.ok(!seenInRound.has(m.teamAId), 'Team plays at most 1 match per round');
        assert.ok(!seenInRound.has(m.teamBId), 'Team plays at most 1 match per round');
        seenInRound.add(m.teamAId);
        seenInRound.add(m.teamBId);

        const canonical = [m.teamAId, m.teamBId].sort().join('::');
        assert.ok(!pairKeys.has(canonical), `Duplicate pairing ${canonical} for ${teamCount} teams`);
        pairKeys.add(canonical);
        totalMatches += 1;
      }

      if (teamCount % 2 === 1) {
        assert.ok(r.byeTeamId, `Odd team count ${teamCount} must assign 1 bye team per round`);
        assert.ok(!seenInRound.has(r.byeTeamId!), 'Bye team must not play in its bye round');
        byeCounts.set(r.byeTeamId!, (byeCounts.get(r.byeTeamId!) || 0) + 1);
      } else {
        assert.equal(r.byeTeamId, null, `Even team count ${teamCount} has no bye team`);
      }
    }

    const expectedTotalMatches = (teamCount * (teamCount - 1)) / 2;
    assert.equal(totalMatches, expectedTotalMatches);
    assert.equal(pairKeys.size, expectedTotalMatches);

    if (teamCount % 2 === 1) {
      teams.forEach((t) => {
        assert.equal(
          byeCounts.get(t.id),
          1,
          `Odd team count ${teamCount}: team ${t.id} must have EXACTLY 1 bye across the tournament`
        );
      });
    }
  }
});

// ============================================================================
// 2. EXACT PROMPT SCORING EXAMPLES (2-1 => 3-0 pts; 2-2 in 5q => 1-1 pts)
// ============================================================================

test('Match scoring: Blue 2 correct vs Yellow 1 correct => 2–1 match score & 3–0 tournament points', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 2);
  cfg.teams[0].name = 'Đội Xanh';
  cfg.teams[1].name = 'Đội Vàng';
  cfg.questionsPerMatch = 3;

  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
  let state = createInitialGroupChallengeState(cfg, qs);
  const [blueId, yellowId] = cfg.teams.map((t) => t.id);

  // Q1: Blue correct, Yellow incorrect
  let res = commitGroupChallengeQuestionResult(state, {
    question: qs[0],
    verdictsByTeam: { [blueId]: 'correct', [yellowId]: 'incorrect' },
    resultSource: 'teacher_single_device',
  });
  assert.equal(res.committed, true);
  assert.equal(res.roundJustCompleted, false);
  state = advanceGroupChallengePointer(res.state);

  // Q2: Both correct
  res = commitGroupChallengeQuestionResult(state, {
    question: qs[1],
    verdictsByTeam: { [blueId]: 'correct', [yellowId]: 'correct' },
    resultSource: 'teacher_single_device',
  });
  assert.equal(res.committed, true);
  assert.equal(res.roundJustCompleted, false);
  state = advanceGroupChallengePointer(res.state);

  // Q3: Both incorrect -> final match score 2–1
  res = commitGroupChallengeQuestionResult(state, {
    question: qs[2],
    verdictsByTeam: { [blueId]: 'incorrect', [yellowId]: 'no_answer' },
    resultSource: 'teacher_single_device',
  });
  assert.equal(res.committed, true);
  assert.equal(res.roundJustCompleted, true);
  state = res.state;

  const matchId = state.rounds[0].matches[0].matchId;
  const mr = state.matchResults[matchId];
  assert.equal(mr.scoreA, 2);
  assert.equal(mr.scoreB, 1);
  assert.equal(mr.pointsA, POINTS_WIN);
  assert.equal(mr.pointsB, POINTS_LOSS);
  assert.equal(mr.isCompleted, true);
  assert.equal(state.teamRuntime[blueId].tournamentPoints, 3);
  assert.equal(state.teamRuntime[yellowId].tournamentPoints, 0);
  assert.equal(state.status, 'finished');
  assert.equal(state.trophyAwarded, true);
});

test('Match scoring: 2–2 tie in a 5-question match awards 1 tournament point each', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 2);
  cfg.questionsPerMatch = 5;
  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 5);
  let state = createInitialGroupChallengeState(cfg, qs);
  const [teamA, teamB] = cfg.teams.map((t) => t.id);

  const sequence: Array<[ 'correct' | 'incorrect' | 'no_answer', 'correct' | 'incorrect' | 'no_answer' ]> = [
    ['correct', 'incorrect'],
    ['incorrect', 'correct'],
    ['correct', 'correct'],
    ['incorrect', 'incorrect'],
    ['no_answer', 'incorrect'],
  ];

  sequence.forEach(([vA, vB], idx) => {
    const res = commitGroupChallengeQuestionResult(state, {
      question: qs[idx],
      verdictsByTeam: { [teamA]: vA, [teamB]: vB },
      resultSource: 'teacher_single_device',
    });
    assert.equal(res.committed, true);
    state = idx < 4 ? advanceGroupChallengePointer(res.state) : res.state;
  });

  const mr = state.matchResults[state.rounds[0].matches[0].matchId];
  assert.equal(mr.scoreA, 2);
  assert.equal(mr.scoreB, 2);
  assert.equal(mr.outcome, 'draw');
  assert.equal(mr.pointsA, POINTS_DRAW);
  assert.equal(mr.pointsB, POINTS_DRAW);

  const standings = computeGroupChallengeStandings(state);
  assert.equal(standings[0].rank, 1);
  assert.equal(standings[1].rank, 1);
  assert.equal(standings[0].isTied, true);
  assert.equal(standings[1].isTied, true);
});

// ============================================================================
// 3. EDITING LAST QUESTION OF A ROUND + BYE TEAM ISOLATION + IDEMPOTENCY
// ============================================================================

test('Editing the last question of a round recomputes match score & tournament points cleanly without double-counting', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 3);
  cfg.questionsPerMatch = 1;
  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
  let state = createInitialGroupChallengeState(cfg, qs);

  const r0 = state.rounds[0];
  const pair = r0.matches[0];
  const byeId = r0.byeTeamId!;

  // Commit Q1 (only question of Round 1): A wins 1-0 (+3 / +0); pass stray bye verdict to verify engine ignores it!
  const commit1 = commitGroupChallengeQuestionResult(state, {
    question: qs[0],
    verdictsByTeam: {
      [pair.teamAId]: 'correct',
      [pair.teamBId]: 'incorrect',
      [byeId]: 'correct', // must be strictly excluded!
    },
    resultSource: 'teacher_single_device',
  });
  assert.equal(commit1.committed, true);
  assert.equal(commit1.roundJustCompleted, true);
  state = commit1.state;

  // Verify bye team got ZERO points, ZERO matches, ZERO totalCorrect
  assert.equal(state.teamRuntime[byeId].tournamentPoints, 0);
  assert.equal(state.teamRuntime[byeId].matchesCompleted, 0);
  assert.equal(state.teamRuntime[byeId].totalCorrect, 0);
  assert.equal(state.teamRuntime[pair.teamAId].tournamentPoints, 3);
  assert.equal(state.teamRuntime[pair.teamBId].tournamentPoints, 0);

  // Double-click duplicate commit must be rejected
  const dup = commitGroupChallengeQuestionResult(state, {
    question: qs[0],
    verdictsByTeam: { [pair.teamAId]: 'correct', [pair.teamBId]: 'incorrect' },
    resultSource: 'teacher_single_device',
  });
  assert.equal(dup.committed, false);
  assert.equal(dup.reason, 'duplicate_question_commit');

  // Edit the last question of Round 1 BEFORE advancing to Round 2 -> change to Draw (1-1 => +1 / +1)
  const edited = editLastConfirmedGroupChallengeQuestion(state, {
    [pair.teamAId]: 'correct',
    [pair.teamBId]: 'correct',
  });
  assert.equal(edited.edited, true);
  state = edited.state;

  const mr = state.matchResults[pair.matchId];
  assert.equal(mr.scoreA, 1);
  assert.equal(mr.scoreB, 1);
  assert.equal(mr.outcome, 'draw');
  assert.equal(mr.pointsA, 1);
  assert.equal(mr.pointsB, 1);
  assert.equal(state.teamRuntime[pair.teamAId].tournamentPoints, 1);
  assert.equal(state.teamRuntime[pair.teamBId].tournamentPoints, 1);
  assert.equal(state.teamRuntime[pair.teamAId].wins, 0);
  assert.equal(state.teamRuntime[pair.teamAId].draws, 1);
  assert.equal(state.teamRuntime[pair.teamBId].losses, 0);
  assert.equal(state.teamRuntime[pair.teamBId].draws, 1);
});

test('Commit strictly blocks ungraded teams', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 4);
  cfg.questionsPerMatch = 1;
  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
  const state = createInitialGroupChallengeState(cfg, qs);
  const activeIds = getActiveTeamIdsInRound(state, 0);

  const partialVerdicts: Record<string, 'correct' | 'ungraded'> = {};
  activeIds.forEach((id, i) => {
    partialVerdicts[id] = i === 0 ? 'ungraded' : 'correct';
  });

  const blocked = commitGroupChallengeQuestionResult(state, {
    question: qs[0],
    verdictsByTeam: partialVerdicts,
    resultSource: 'teacher_single_device',
  });
  assert.equal(blocked.committed, false);
  assert.equal(blocked.reason, 'ungraded_team');
});

// ============================================================================
// 4. EARLY TERMINATION ("Giải chưa hoàn tất", NO TROPHY) & 6-TEAM FULL 15Q RUN
// ============================================================================

test('Early termination sets endedEarly=true, trophyAwarded=false, and accurate matchesCompleted', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 4);
  cfg.questionsPerMatch = 1;
  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
  let state = createInitialGroupChallengeState(cfg, qs);

  // Complete Round 1 only (1 match per team), then end early
  const activeIds = getActiveTeamIdsInRound(state, 0);
  const verdicts: Record<string, 'correct' | 'incorrect'> = {};
  activeIds.forEach((id, idx) => {
    verdicts[id] = idx % 2 === 0 ? 'correct' : 'incorrect';
  });
  state = commitGroupChallengeQuestionResult(state, {
    question: qs[0],
    verdictsByTeam: verdicts,
    resultSource: 'teacher_single_device',
  }).state;

  const ended = endGroupChallengeEarly(state);
  assert.equal(ended.status, 'ended_early');
  assert.equal(ended.endedEarly, true);
  assert.equal(ended.trophyAwarded, false);

  const standings = computeGroupChallengeStandings(ended);
  standings.forEach((row) => {
    assert.equal(row.matchesCompleted, 1);
  });
});

test('Full 6-team tournament (50-student scale) uses 15 distinct questions with zero repeats and completes cleanly', () => {
  const cfg = createDefaultGroupChallengeConfig('round_robin', 6);
  cfg.questionsPerMatch = 3;
  cfg.shuffleQuestions = true;
  const validation = validateGroupChallengeSetupConfig(cfg, D07_SAMPLE_QUESTIONS.length);
  assert.equal(validation.valid, true);
  assert.equal(validation.roundCount, 5);
  assert.equal(validation.matchesTotal, 15);
  assert.equal(validation.requiredQuestions, 15);

  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 15);
  assert.equal(qs.length, 15);
  assert.equal(new Set(qs.map((q) => q.id)).size, 15, 'Zero repeated questions across all 5 rounds');

  let state = createInitialGroupChallengeState(cfg, qs);
  for (let i = 0; i < 15; i++) {
    const activeIds = getActiveTeamIdsInRound(state, state.currentRoundIndex);
    assert.equal(activeIds.length, 6);
    const verdicts: Record<string, 'correct' | 'incorrect'> = {};
    activeIds.forEach((id, idx) => {
      verdicts[id] = (idx + i) % 2 === 0 ? 'correct' : 'incorrect';
    });
    const res = commitGroupChallengeQuestionResult(state, {
      question: qs[i],
      verdictsByTeam: verdicts,
      resultSource: 'teacher_single_device',
    });
    assert.equal(res.committed, true);
    state = i < 14 ? advanceGroupChallengePointer(res.state) : res.state;
  }

  assert.equal(state.status, 'finished');
  assert.equal(state.trophyAwarded, true);
  const standings = computeGroupChallengeStandings(state);
  standings.forEach((row) => {
    assert.equal(row.matchesCompleted, 5, 'Every team in 6-team round-robin plays 5 matches');
  });
});

// ============================================================================
// 5. SOLO PRACTICE MODE (1 STUDENT, ZERO FAKE OPPONENTS)
// ============================================================================

test('1-student solo_practice mode runs with zero fake opponents and accurate auto evaluation', () => {
  const cfg = createDefaultGroupChallengeConfig('solo_practice', 1);
  cfg.soloQuestionCount = 3;
  const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
  let state = createInitialGroupChallengeState(cfg, qs);

  assert.equal(state.config.teams.length, 1);
  assert.equal(state.rounds.length, 0);

  const soloId = state.config.teams[0].id;
  for (let i = 0; i < 3; i++) {
    const q = qs[i];
    const evalRes = evaluateGroupChallengeSoloAnswer(q, {
      selectedOptionId: i < 2 ? q.correctOptionId : q.options?.find((o) => o.id !== q.correctOptionId)?.id,
    });
    const res = commitGroupChallengeQuestionResult(state, {
      question: q,
      verdictsByTeam: { [soloId]: evalRes.isCorrect ? 'correct' : 'incorrect' },
      resultSource: 'student_auto',
    });
    assert.equal(res.committed, true);
    state = i < 2 ? advanceGroupChallengePointer(res.state) : res.state;
  }

  assert.equal(state.status, 'finished');
  assert.equal(state.trophyAwarded, false, 'Solo practice never awards tournament trophy');
  assert.equal(state.teamRuntime[soloId].totalCorrect, 2);
});

// ============================================================================
// 6. SAMPLE PACK, KATEX MATH RENDERING, VALIDATION, SHUFFLE & RBAC
// ============================================================================

test('15-question sample pack includes all 5 mandatory formulas and renders cleanly via KaTeX MathView', () => {
  assert.equal(D07_SAMPLE_PACK_TITLE, 'Thách đấu nhóm – Toán THCS');
  assert.equal(D07_SAMPLE_BADGE, 'Dữ liệu mẫu');
  assert.equal(D07_SAMPLE_QUESTIONS.length, 15);

  const mandatoryStems = [
    '\\(\\frac{2}{3} - \\frac{1}{4}\\)',
    '\\((-4)^2 - 4^2\\)',
    '\\(\\sqrt{(-7)^2}\\)',
    '\\(\\begin{cases}x + y = 9\\\\x - y = 3\\end{cases}\\)',
    '\\(7{,}5\\,\\mathrm{cm}\\)',
  ];

  mandatoryStems.forEach((snippet) => {
    const found = D07_SAMPLE_QUESTIONS.some((q) => q.stem.includes(snippet));
    assert.ok(found, `Mandatory formula snippet missing from sample pack: ${snippet}`);
  });

  // Render every sample stem, option, official answer, and explanation with KaTeX
  D07_SAMPLE_QUESTIONS.forEach((q) => {
    const stemHtml = renderMathToHtml(q.stem);
    assert.ok(stemHtml.includes('katex'), `Stem failed KaTeX render: ${q.id}`);
    const ansHtml = renderMathToHtml(q.officialAnswerText);
    assert.ok(ansHtml.includes('katex'), `Official answer failed KaTeX render: ${q.id}`);
    (q.options || []).forEach((opt) => {
      const optHtml = renderMathToHtml(opt.text);
      assert.ok(optHtml.includes('katex'), `Option failed KaTeX render: ${q.id}/${opt.id}`);
    });
  });

  // Malformed LaTeX must fall back safely without throwing
  const malformed = renderMathToHtml('Công thức lỗi \\(\\frac{1}{\\) vẫn giữ nguyên giao diện.');
  assert.ok(malformed.includes('vẫn giữ nguyên giao diện'));
});

test('Insufficient question pool blocks start with suggestedQuestionsPerMatch, option shuffle preserves correctOptionId, RBAC filters properly', () => {
  const cfg6 = createDefaultGroupChallengeConfig('round_robin', 6);
  cfg6.questionsPerMatch = 5; // needs 5 * 5 = 25 questions
  const val = validateGroupChallengeSetupConfig(cfg6, 15);
  assert.equal(val.valid, false);
  assert.equal(val.suggestedQuestionsPerMatch, 3);

  // Stable-ID option shuffle
  const sampleQ = D07_SAMPLE_QUESTIONS[0];
  const origCorrectText = sampleQ.options!.find((o) => o.id === sampleQ.correctOptionId)!.text;
  const shuffled = shuffleChallengeOptionsPreservingId(sampleQ, () => 0.25);
  const newCorrectOpt = shuffled.options!.find((o) => o.id === shuffled.correctOptionId)!;
  assert.equal(newCorrectOpt.text, origCorrectText);

  // RBAC filtering: student gets only 'approved', teacher gets 'approved' + 'pending', nobody gets 'deprecated'
  const rawBank: Question[] = [
    makeBankQuestion({ id: 'q_app', status: 'approved', stem: 'Câu đã duyệt \\(1+1\\)' }),
    makeBankQuestion({ id: 'q_pen', status: 'pending', stem: 'Câu chờ duyệt \\(2+2\\)' }),
    makeBankQuestion({ id: 'q_dep', status: 'deprecated', stem: 'Câu cũ \\(3+3\\)' }),
  ];

  const studentPool = buildD07QuestionPool({
    sourceKind: 'bank',
    bankQuestions: rawBank,
    userRole: 'student',
  });
  assert.deepEqual(
    studentPool.map((q) => q.id),
    ['q_app']
  );

  const teacherPool = buildD07QuestionPool({
    sourceKind: 'bank',
    bankQuestions: rawBank,
    userRole: 'teacher',
  });
  assert.deepEqual(
    teacherPool.map((q) => q.id),
    ['q_app', 'q_pen']
  );
});

// ============================================================================
// 7. PERSISTENCE, DEMO ISOLATION, CORRUPT RECOVERY & AUDIO SAFETY
// ============================================================================

test('Session persistence restores active state, isolates /demo storage, recovers corrupt JSON, and D07 audio cues execute safely', () => {
  const storage = makeMockStorage();
  const prevWindow = (globalThis as unknown as { window?: unknown }).window;

  try {
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: storage,
      location: { pathname: '/demo', hash: '', search: '' },
    };

    const demoKey = getD07SessionStorageKey();
    assert.ok(demoKey.includes('khkt_demo'), 'Demo session key must be isolated');

    const cfg = createDefaultGroupChallengeConfig('round_robin', 3);
    cfg.questionsPerMatch = 1;
    const qs = prepareGroupChallengeQuestions(D07_SAMPLE_QUESTIONS, cfg, 3);
    const initial = createInitialGroupChallengeState(cfg, qs);
    const pair = initial.rounds[0].matches[0];
    const afterQ1 = commitGroupChallengeQuestionResult(initial, {
      question: qs[0],
      verdictsByTeam: { [pair.teamAId]: 'correct', [pair.teamBId]: 'incorrect' },
      resultSource: 'teacher_single_device',
    }).state;

    saveD07Session(afterQ1);
    const loaded = loadD07Session();
    assert.equal(loaded.recoveredFromCorruption, false);
    assert.ok(loaded.state);
    assert.equal(loaded.state!.teamRuntime[pair.teamAId].tournamentPoints, 3);
    assert.equal(loaded.state!.rounds.length, 3);

    // Corrupt storage recovery
    storage.setItem(demoKey, '{invalid-json!!!');
    const recovered = loadD07Session();
    assert.equal(recovered.state, null);
    assert.equal(recovered.recoveredFromCorruption, true);
    assert.equal(storage.getItem(demoKey), null);

    clearD07Session();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = prevWindow;
    }
  }

  // Audio controller D07 methods must run cleanly in muted & headless environments without throwing
  const soundBank = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    soundBank.playChallengeRoundOpen(true);
    soundBank.playChallengeQuestionLock(true);
    soundBank.playChallengeScoreReveal(true);
    soundBank.playChallengeTournamentFinish(true, true, false);
    soundBank.playChallengeTournamentFinish(false, false, false);
    soundBank.stopAll();
  });
});
