import test from 'node:test';
import assert from 'node:assert/strict';
import {
  E01_GESTURES,
  E01_POINTS_CORRECT,
  E01_POINTS_INCORRECT,
  E01_SAMPLE_BADGE,
  E01_SAMPLE_PACK_TITLE,
  E01_SAMPLE_QUESTIONS,
  E01_SESSION_STORAGE_KEY,
  OPTION_TO_GESTURE_MAP,
  advanceJumpCommandTurn,
  buildE01QuestionPool,
  clearE01Session,
  commitMathGestureTurn,
  completeFollowCommandTurn,
  computeJumpStandings,
  createDefaultJumpCommandConfig,
  createInitialJumpCommandState,
  createJumpTeams,
  editLastMathGestureTurn,
  generateFollowCommandSequence,
  getAllowedGesturesForPosture,
  getCorrectGestureIdForQuestion,
  getCorrectOptionLabelForQuestion,
  getE01SessionStorageKey,
  loadE01Session,
  resolveInstructorGestureForPhase,
  sanitizeFollowGesturesForPosture,
  saveE01Session,
  shuffleJumpOptionsPreservingId,
  validateJumpSetupConfig,
} from './jumpCommand3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    get length() {
      return map.size;
    },
  };
}

function installMockWindow(pathname = '/') {
  const storage = createMemoryStorage();
  const prevWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: { pathname, hash: '', search: '' },
  };
  return {
    storage,
    restore() {
      if (prevWindow === undefined) {
        delete (globalThis as unknown as { window?: unknown }).window;
      } else {
        (globalThis as unknown as { window: unknown }).window = prevWindow;
      }
    },
  };
}

function makeBankQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'bank_q_1',
    code: 'TOAN7-01',
    subject: 'math',
    grade: '7',
    textbook: 'Kết nối tri thức',
    chapter: 'Số hữu tỉ',
    lesson: 'Cộng trừ phân số',
    level: 'understand',
    type: 'single_choice',
    stem: 'Giá trị của \\(\\frac{1}{2} + \\frac{1}{3}\\) bằng bao nhiêu?',
    options: [
      { id: 'opt_a', label: 'A', text: '\\(\\frac{5}{6}\\)' },
      { id: 'opt_b', label: 'B', text: '\\(\\frac{2}{5}\\)' },
      { id: 'opt_c', label: 'C', text: '\\(\\frac{1}{6}\\)' },
      { id: 'opt_d', label: 'D', text: '\\(\\frac{3}{5}\\)' },
    ],
    correctAnswer: 'opt_a',
    explanation: 'Quy đồng mẫu chung 6: \\(\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}\\).',
    points: 1,
    status: 'approved',
    author: 'teacher_demo',
    version: 1,
    ...overrides,
  };
}

// ============================================================================
// 1. POSTURES, SAFE GESTURES & CARD FALLBACK LABELS
// ============================================================================

test('E01 postures: standing allows step_in_place, seated strictly strips it', () => {
  const standingGestures = getAllowedGesturesForPosture('standing');
  const seatedGestures = getAllowedGesturesForPosture('seated');

  assert.equal(standingGestures.some((g) => g.id === 'step_in_place'), true);
  assert.equal(seatedGestures.some((g) => g.id === 'step_in_place'), false);
  assert.equal(seatedGestures.length, 4);

  const sanitizedSeated = sanitizeFollowGesturesForPosture(
    ['raise_one_hand', 'step_in_place'],
    'seated'
  );
  assert.deepEqual(sanitizedSeated, ['raise_one_hand']);

  // If user only had step_in_place and switches to seated, falls back to 4 seated-safe gestures
  const fallbackSeated = sanitizeFollowGesturesForPosture(['step_in_place'], 'seated');
  assert.equal(fallbackSeated.includes('step_in_place'), false);
  assert.equal(fallbackSeated.length, 4);

  // Every gesture must have standing guide, seated guide, and alternative card fallback text
  for (const g of E01_GESTURES) {
    assert.ok(g.name.trim().length > 0);
    assert.ok(g.standingGuide.trim().length > 0);
    assert.ok(g.seatedGuide.trim().length > 0);
    assert.ok(g.cardFallbackText.trim().length > 0);
  }
});

// ============================================================================
// 2. MODE 1 — LÀM THEO LỆNH (WARM-UP, NO SPEED/ACCURACY SCORING)
// ============================================================================

test('E01 Follow-Command mode: default 8 turns, avoids back-to-back repeats, idempotent turns, zero scoring', () => {
  const cfg = createDefaultJumpCommandConfig('follow_command');
  assert.equal(cfg.followTurnCount, 8);
  assert.equal(cfg.posture, 'standing');
  assert.equal(cfg.selectedFollowGestureIds.includes('step_in_place'), false);

  const seq = generateFollowCommandSequence(
    ['raise_one_hand', 'raise_two_hands', 'palms_at_chest', 'hands_on_thighs'],
    8,
    'standing',
    createSeededRng(42)
  );
  assert.equal(seq.length, 8);
  for (let i = 1; i < seq.length; i++) {
    assert.notEqual(seq[i], seq[i - 1], 'Should avoid immediate consecutive duplicate gesture');
  }

  let state = createInitialJumpCommandState({
    config: { ...cfg, followTurnCount: 3 },
    rng: createSeededRng(99),
  });
  assert.equal(state.status, 'playing');
  assert.equal(state.followSequence.length, 3);
  assert.deepEqual(computeJumpStandings(state), []);

  // Complete turn 0
  const r1 = completeFollowCommandTurn(state, 1000);
  assert.equal(r1.committed, true);
  state = r1.state;
  assert.equal(state.followHistory.length, 1);

  // Duplicate click on same turnIndex is ignored (idempotent)
  const r1Dup = completeFollowCommandTurn(state, 1005);
  assert.equal(r1Dup.committed, false);
  assert.equal(r1Dup.state.followHistory.length, 1);

  // Advance and finish remaining turns
  state = advanceJumpCommandTurn(state);
  assert.equal(state.currentTurnIndex, 1);
  state = completeFollowCommandTurn(state, 2000).state;
  state = advanceJumpCommandTurn(state);
  assert.equal(state.currentTurnIndex, 2);
  state = completeFollowCommandTurn(state, 3000).state;

  assert.equal(state.status, 'finished');
  assert.equal(state.followHistory.length, 3);
  // Follow-Command NEVER creates speed/accuracy standings
  assert.deepEqual(computeJumpStandings(state), []);
});

// ============================================================================
// 3. MODE 2 — ANTI-SPOILER RULE & OPTION SHUFFLE GESTURE INTEGRITY
// ============================================================================

test('E01 Math-Gesture anti-spoiler: instructor stays ready_wait until revealed, then matches shuffled correct label', () => {
  const sampleQ = E01_SAMPLE_QUESTIONS[0];
  const shuffled = shuffleJumpOptionsPreservingId(sampleQ, createSeededRng(1234));

  // Verify correctOptionId still points to the exact same text (\frac{1}{4})
  const correctOpt = shuffled.options.find((o) => o.id === shuffled.correctOptionId);
  assert.ok(correctOpt);
  assert.equal(correctOpt.text, sampleQ.officialAnswerText);

  const expectedLabel = getCorrectOptionLabelForQuestion(shuffled);
  assert.equal(expectedLabel, correctOpt.label);
  const expectedGesture = getCorrectGestureIdForQuestion(shuffled);
  assert.equal(expectedGesture, OPTION_TO_GESTURE_MAP[expectedLabel]);

  // Anti-spoiler check across every math sub-phase
  assert.equal(
    resolveInstructorGestureForPhase({
      mode: 'math_gesture',
      mathSubPhase: 'thinking',
      currentQuestion: shuffled,
    }),
    'ready_wait'
  );
  assert.equal(
    resolveInstructorGestureForPhase({
      mode: 'math_gesture',
      mathSubPhase: 'execute_collect',
      currentQuestion: shuffled,
    }),
    'ready_wait'
  );
  assert.equal(
    resolveInstructorGestureForPhase({
      mode: 'math_gesture',
      mathSubPhase: 'revealed',
      currentQuestion: shuffled,
    }),
    expectedGesture
  );
});

// ============================================================================
// 4. TEAMS MODE: UNGRADED VS NO_ANSWER, DUPLICATE GUARD, EDIT & DONG HANG TIES
// ============================================================================

test('E01 Math-Gesture Teams mode: distinguishes ungraded vs no_answer, grades +10/0, edits last turn, handles ties', () => {
  const cfg = createDefaultJumpCommandConfig('math_gesture');
  cfg.participantMode = 'teams';
  cfg.teams = createJumpTeams(3, ['Đội Hoa Sen', 'Đội Cửu Long', 'Đội Tây Đô']);
  cfg.mathQuestionCount = 2;
  cfg.shuffleQuestions = false;
  cfg.shuffleOptions = true;

  let state = createInitialJumpCommandState({
    config: cfg,
    questionPool: E01_SAMPLE_QUESTIONS,
    rng: createSeededRng(77),
  });
  const q0 = state.questionOrder[0];
  const q0CorrectLabel = getCorrectOptionLabelForQuestion(q0);
  const q0WrongLabel = (['A', 'B', 'C', 'D'] as const).find((l) => l !== q0CorrectLabel)!;

  // Must block if any team is still 'ungraded'
  const blocked = commitMathGestureTurn(state, {
    question: q0,
    verdictsByParticipant: {
      jteam_1: q0CorrectLabel,
      jteam_2: 'ungraded',
      jteam_3: 'no_answer',
    },
  });
  assert.equal(blocked.committed, false);
  assert.equal(blocked.reason, 'ungraded_team');

  // Must accept explicit 'no_answer' (0 pts) alongside A-D choices
  const c0 = commitMathGestureTurn(state, {
    question: q0,
    verdictsByParticipant: {
      jteam_1: q0CorrectLabel,
      jteam_2: q0WrongLabel,
      jteam_3: 'no_answer',
    },
  });
  assert.equal(c0.committed, true);
  assert.equal(c0.record?.pointsDeltaByParticipant.jteam_1, E01_POINTS_CORRECT);
  assert.equal(c0.record?.pointsDeltaByParticipant.jteam_2, E01_POINTS_INCORRECT);
  assert.equal(c0.record?.pointsDeltaByParticipant.jteam_3, E01_POINTS_INCORRECT);
  assert.equal(c0.record?.choiceByParticipant.jteam_3, 'no_answer');
  state = c0.state;

  // Duplicate commit on same questionId must be rejected
  const dup = commitMathGestureTurn(state, {
    question: q0,
    verdictsByParticipant: {
      jteam_1: q0CorrectLabel,
      jteam_2: q0CorrectLabel,
      jteam_3: q0CorrectLabel,
    },
  });
  assert.equal(dup.committed, false);
  assert.equal(dup.reason, 'duplicate_question_commit');

  // Edit last turn: change Team 2 to correct as well -> Team 1 and Team 2 tie at 10 pts
  const edited = editLastMathGestureTurn(state, {
    jteam_1: q0CorrectLabel,
    jteam_2: q0CorrectLabel,
    jteam_3: 'no_answer',
  });
  assert.equal(edited.edited, true);
  state = edited.state;

  const standingsAfterEdit = computeJumpStandings(state);
  assert.equal(standingsAfterEdit[0].points, 10);
  assert.equal(standingsAfterEdit[1].points, 10);
  assert.equal(standingsAfterEdit[0].rank, 1);
  assert.equal(standingsAfterEdit[1].rank, 1);
  assert.equal(standingsAfterEdit[0].isTied, true);
  assert.equal(standingsAfterEdit[1].isTied, true);
  assert.equal(standingsAfterEdit[2].points, 0);
  assert.equal(standingsAfterEdit[2].rank, 3);
  assert.equal(standingsAfterEdit[2].isTied, false);

  // Advance to Q1 and finish session
  state = advanceJumpCommandTurn(state);
  const q1 = state.questionOrder[1];
  const q1CorrectLabel = getCorrectOptionLabelForQuestion(q1);
  const c1 = commitMathGestureTurn(state, {
    question: q1,
    verdictsByParticipant: {
      jteam_1: q1CorrectLabel,
      jteam_2: q1CorrectLabel,
      jteam_3: q1CorrectLabel,
    },
  });
  assert.equal(c1.committed, true);
  assert.equal(c1.state.status, 'finished');
  const finalStandings = computeJumpStandings(c1.state);
  assert.equal(finalStandings[0].points, 20);
  assert.equal(finalStandings[1].points, 20);
  assert.equal(finalStandings[0].isTied, true);
  assert.equal(finalStandings[2].points, 10);
});

// ============================================================================
// 5. WHOLE-CLASS NON-SCORED (1–50 HS) & SOLO PRACTICE MODES
// ============================================================================

test('E01 Whole-Class non-scored mode records completed turns with zero fabricated scores', () => {
  const cfg = createDefaultJumpCommandConfig('math_gesture');
  cfg.participantMode = 'whole_class';
  cfg.mathQuestionCount = 2;

  let state = createInitialJumpCommandState({
    config: cfg,
    questionPool: E01_SAMPLE_QUESTIONS,
    rng: createSeededRng(11),
  });

  const c0 = commitMathGestureTurn(state, { question: state.questionOrder[0] });
  assert.equal(c0.committed, true);
  assert.equal(c0.record?.resultMode, 'non_scored_class');
  assert.deepEqual(c0.record?.choiceByParticipant, {});
  assert.deepEqual(computeJumpStandings(c0.state), []);
});

test('E01 Solo Practice mode grades 1 student by option ID without fake opponents', () => {
  const cfg = createDefaultJumpCommandConfig('math_gesture');
  cfg.participantMode = 'solo_practice';
  cfg.mathQuestionCount = 2;
  cfg.shuffleOptions = true;

  let state = createInitialJumpCommandState({
    config: cfg,
    questionPool: E01_SAMPLE_QUESTIONS,
    rng: createSeededRng(21),
  });

  const q0 = state.questionOrder[0];
  const wrongOpt = q0.options.find((o) => o.id !== q0.correctOptionId)!;

  // Turn 0: wrong option
  state = commitMathGestureTurn(state, {
    question: q0,
    soloSelectedOptionId: wrongOpt.id,
  }).state;
  state = advanceJumpCommandTurn(state);

  // Turn 1: correct option
  const q1 = state.questionOrder[1];
  state = commitMathGestureTurn(state, {
    question: q1,
    soloSelectedOptionId: q1.correctOptionId,
  }).state;

  assert.equal(state.status, 'finished');
  const standings = computeJumpStandings(state);
  assert.equal(standings.length, 1);
  assert.equal(standings[0].id, 'solo_1');
  assert.equal(standings[0].points, E01_POINTS_CORRECT);
  assert.equal(standings[0].correctCount, 1);
  assert.equal(standings[0].answeredCount, 2);
});

// ============================================================================
// 6. SAMPLE PACK (8 QUESTIONS, ALL 5 MANDATORY CASES & KATEX RENDERING)
// ============================================================================

test('E01 sample pack has 8 labeled THCS Math questions with all 5 mandatory prompt cases & clean KaTeX', () => {
  assert.equal(E01_SAMPLE_PACK_TITLE, 'Nhảy theo lệnh – Toán THCS');
  assert.equal(E01_SAMPLE_BADGE, 'Dữ liệu mẫu');
  assert.equal(E01_SAMPLE_QUESTIONS.length, 8);

  // Check mandatory case 1: 3/4 - 1/2 = 1/4
  const qFrac = E01_SAMPLE_QUESTIONS.find((q) => q.stem.includes('\\frac{3}{4} - \\frac{1}{2}'));
  assert.ok(qFrac, 'Missing 3/4 - 1/2 question');
  assert.equal(qFrac.officialAnswerText, '\\(\\frac{1}{4}\\)');

  // Check mandatory case 2: (-3)^2 = 9 with -9 distractor
  const qPow = E01_SAMPLE_QUESTIONS.find((q) => q.stem.includes('(-3)^2'));
  assert.ok(qPow, 'Missing (-3)^2 question');
  assert.equal(qPow.officialAnswerText, '\\(9\\)');
  assert.equal(
    qPow.options.some((o) => o.text.includes('-9')),
    true,
    '(-3)^2 must include -9 as a distractor'
  );

  // Check mandatory case 3: sqrt((-5)^2) = 5
  const qSqrt = E01_SAMPLE_QUESTIONS.find((q) => q.stem.includes('\\sqrt{(-5)^2}'));
  assert.ok(qSqrt, 'Missing sqrt((-5)^2) question');
  assert.equal(qSqrt.officialAnswerText, '\\(5\\)');

  // Check mandatory case 4: 2x + 3 = 11 -> x = 4
  const qEq = E01_SAMPLE_QUESTIONS.find((q) => q.stem.includes('2x + 3 = 11'));
  assert.ok(qEq, 'Missing 2x + 3 = 11 question');
  assert.equal(qEq.officialAnswerText, '\\(x = 4\\)');

  // Check mandatory case 5: fair 6-sided die even probability -> 3/6 = 1/2 in ONE single correct option
  const qDie = E01_SAMPLE_QUESTIONS.find((q) => q.stem.includes('xúc xắc cân đối sáu mặt'));
  assert.ok(qDie, 'Missing fair 6-sided die probability question');
  const dieCorrectOpt = qDie.options.find((o) => o.id === qDie.correctOptionId)!;
  assert.ok(dieCorrectOpt.text.includes('\\frac{3}{6}') && dieCorrectOpt.text.includes('\\frac{1}{2}'));
  const otherDieOpts = qDie.options.filter((o) => o.id !== qDie.correctOptionId);
  for (const opt of otherDieOpts) {
    assert.equal(
      opt.text.includes('\\frac{3}{6}') || opt.text.includes('\\frac{1}{2}'),
      false,
      'Must NEVER split 3/6 and 1/2 into two separate equivalent choices'
    );
  }

  // Verify every sample question has badge, 4 options, valid correctOptionId, and renders cleanly via KaTeX
  for (const q of E01_SAMPLE_QUESTIONS) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
    assert.equal(q.options.length, 4);
    assert.ok(q.options.some((o) => o.id === q.correctOptionId));

    const stemHtml = renderMathToHtml(q.stem);
    if (q.stem.includes('\\(') || q.stem.includes('\\[')) {
      assert.ok(stemHtml.includes('katex'), `Stem should render KaTeX for ${q.id}`);
    }
    assert.equal(stemHtml.includes('katex-error'), false, `Stem KaTeX error on ${q.id}`);

    const expHtml = renderMathToHtml(q.explanation);
    assert.ok(expHtml.includes('katex'), `Explanation should render KaTeX for ${q.id}`);
    assert.equal(expHtml.includes('katex-error'), false, `Explanation KaTeX error on ${q.id}`);

    for (const opt of q.options) {
      const optHtml = renderMathToHtml(opt.text);
      assert.ok(optHtml.includes('katex'), `Option should render KaTeX for ${q.id}/${opt.id}`);
      assert.equal(optHtml.includes('katex-error'), false, `Option KaTeX error on ${q.id}/${opt.id}`);
    }
  }

  // Malformed LaTeX fallback safety check (never throws)
  const brokenHtml = renderMathToHtml('Biểu thức lỗi: \\(\\frac{1}{\\)');
  assert.equal(typeof brokenHtml, 'string');
  assert.ok(brokenHtml.length > 0);
});

// ============================================================================
// 7. RBAC SMART EDU BANK ADAPTER & VALIDATION
// ============================================================================

test('E01 Smart EDU bank adapter enforces RBAC, 4-option single_choice, deduplication, and empty-pool validation', () => {
  const bank: Question[] = [
    makeBankQuestion({ id: 'q_approved_1', status: 'approved', grade: '7' }),
    makeBankQuestion({
      id: 'q_approved_dup_stem',
      status: 'approved',
      grade: '7',
    }), // Same stem -> deduplicated
    makeBankQuestion({
      id: 'q_pending_1',
      status: 'pending',
      grade: '8',
      stem: 'Nghiệm của \\(x - 5 = 2\\) là?',
    }),
    makeBankQuestion({
      id: 'q_deprecated_1',
      status: 'deprecated',
      grade: '7',
      stem: 'Câu đã ngừng dùng \\(1 + 1\\)?',
    }),
    makeBankQuestion({
      id: 'q_short_answer',
      status: 'approved',
      type: 'short_answer',
      stem: 'Điền số thích hợp: \\(2 + 2 = ?\\)',
    }),
    makeBankQuestion({
      id: 'q_only_3_opts',
      status: 'approved',
      stem: 'Câu chỉ có 3 phương án?',
      options: [
        { id: 'a', label: 'A', text: '1' },
        { id: 'b', label: 'B', text: '2' },
        { id: 'c', label: 'C', text: '3' },
      ],
      correctAnswer: 'a',
    }),
  ];

  const studentPool = buildE01QuestionPool({
    sourceKind: 'bank',
    bankQuestions: bank,
    userRole: 'student',
  });
  assert.equal(studentPool.length, 1);
  assert.equal(studentPool[0].id, 'q_approved_1');

  const teacherPool = buildE01QuestionPool({
    sourceKind: 'bank',
    bankQuestions: bank,
    userRole: 'teacher',
  });
  assert.equal(teacherPool.length, 2);
  assert.deepEqual(
    teacherPool.map((q) => q.id),
    ['q_approved_1', 'q_pending_1']
  );

  // Empty pool validation must report clear blocking error
  const mathCfg = createDefaultJumpCommandConfig('math_gesture');
  mathCfg.sourceKind = 'bank';
  const validation = validateJumpSetupConfig(mathCfg, 0);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length > 0);
});

// ============================================================================
// 8. PERSISTENCE, /DEMO ISOLATION, CORRUPT RECOVERY & AUDIO SAFETY
// ============================================================================

test('E01 session persistence isolates /demo storage and recovers cleanly from corrupt JSON', () => {
  const normalEnv = installMockWindow('/games');
  try {
    assert.equal(getE01SessionStorageKey(), E01_SESSION_STORAGE_KEY);
    const state = createInitialJumpCommandState({
      config: createDefaultJumpCommandConfig('follow_command'),
      rng: createSeededRng(5),
    });
    saveE01Session(state);

    const loaded = loadE01Session();
    assert.equal(loaded.recoveredFromCorruption, false);
    assert.equal(loaded.state?.followSequence.length, 8);

    // Corrupt storage triggers clean auto-recovery
    normalEnv.storage.setItem(E01_SESSION_STORAGE_KEY, '{not-valid-json');
    const recovered = loadE01Session();
    assert.equal(recovered.state, null);
    assert.equal(recovered.recoveredFromCorruption, true);
    assert.equal(normalEnv.storage.getItem(E01_SESSION_STORAGE_KEY), null);

    clearE01Session();
  } finally {
    normalEnv.restore();
  }

  const demoEnv = installMockWindow('/demo');
  try {
    assert.equal(
      getE01SessionStorageKey(),
      `${KHKT_DEMO_STORAGE_PREFIX}${E01_SESSION_STORAGE_KEY}`
    );
    const state = createInitialJumpCommandState({
      config: createDefaultJumpCommandConfig('math_gesture'),
      questionPool: E01_SAMPLE_QUESTIONS,
      rng: createSeededRng(7),
    });
    saveE01Session(state);
    assert.ok(demoEnv.storage.getItem(`${KHKT_DEMO_STORAGE_PREFIX}${E01_SESSION_STORAGE_KEY}`));
    assert.equal(demoEnv.storage.getItem(E01_SESSION_STORAGE_KEY), null);
  } finally {
    demoEnv.restore();
  }
});

test('E01 EduGameSoundBank audio cues run safely without throwing in headless/muted environments', () => {
  const bank = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    bank.playJumpPrepareCue(true);
    bank.playJumpExecuteSignal(true);
    bank.playJumpSessionSummary(true);
    bank.playJumpPrepareCue(false);
    bank.playJumpExecuteSignal(false);
    bank.playJumpSessionSummary(false);
    bank.stopAll();
    bank.dispose();
  });
});
