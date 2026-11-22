import test from 'node:test';
import assert from 'node:assert/strict';
import {
  E02_POINTS_CORRECT,
  E02_POINTS_INCORRECT,
  E02_SAMPLE_BADGE,
  E02_SAMPLE_PACK_TITLE,
  E02_SAMPLE_QUESTIONS,
  E02_SESSION_STORAGE_KEY,
  advanceCatchBallTurn,
  buildE02QuestionPool,
  clearE02Session,
  commitCatchBallTurn,
  computeCatchStandings,
  createCatchTeams,
  createDefaultCatchBallConfig,
  createInitialCatchBallState,
  editLastCatchBallTurn,
  getCorrectOptionLabelForCatchQuestion,
  getE02SessionStorageKey,
  loadE02Session,
  saveE02Session,
  shuffleCatchOptionsPreservingId,
  validateCatchSetupConfig,
} from './catchBall3dEngine';
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
    id: 'e02_bank_q_1',
    code: 'TOAN6-E02',
    subject: 'math',
    grade: '6',
    textbook: 'Kết nối tri thức',
    chapter: 'Số nguyên',
    lesson: 'Phép tính số nguyên',
    level: 'understand',
    type: 'single_choice',
    stem: 'Giá trị của \\(-10 + 18\\) là bao nhiêu?',
    options: [
      { id: 'bopt_a', label: 'A', text: '\\(8\\)' },
      { id: 'bopt_b', label: 'B', text: '\\(-8\\)' },
      { id: 'bopt_c', label: 'C', text: '\\(28\\)' },
      { id: 'bopt_d', label: 'D', text: '\\(-28\\)' },
    ],
    correctAnswer: 'bopt_a',
    explanation: '\\(-10 + 18 = 18 - 10 = 8\\).',
    points: 1,
    status: 'approved',
    author: 'teacher_demo',
    version: 1,
    ...overrides,
  };
}

// ============================================================================
// 1. SAMPLE PACK: ALL 8 MANDATORY PROMPT QUESTIONS, NO EQUIVALENT DUPLICATES, CLEAN KATEX
// ============================================================================

test('E02 sample pack has all 8 exact THCS Math questions with "Dữ liệu mẫu" badge, unique choices, and clean KaTeX', () => {
  assert.equal(E02_SAMPLE_PACK_TITLE, 'Bắt bóng kiến thức – Toán THCS');
  assert.equal(E02_SAMPLE_BADGE, 'Dữ liệu mẫu');
  assert.equal(E02_SAMPLE_QUESTIONS.length, 8);

  // Q1: -7 + 12 = 5
  const q1 = E02_SAMPLE_QUESTIONS[0];
  assert.ok(q1.stem.includes('-7 + 12'));
  assert.equal(q1.officialAnswerText, '\\(5\\)');

  // Q2: 5/6 - 1/3 = 1/2 (and NO 3/6 equivalent distractor)
  const q2 = E02_SAMPLE_QUESTIONS[1];
  assert.ok(q2.stem.includes('\\frac{5}{6} - \\frac{1}{3}'));
  assert.equal(q2.officialAnswerText, '\\(\\frac{1}{2}\\)');
  assert.equal(
    q2.options.some((o) => o.text.includes('\\frac{3}{6}')),
    false,
    'Must not place equivalent 3/6 alongside 1/2'
  );

  // Q3: (-4)^2 = 16 with -16 distractor
  const q3 = E02_SAMPLE_QUESTIONS[2];
  assert.ok(q3.stem.includes('(-4)^2'));
  assert.equal(q3.officialAnswerText, '\\(16\\)');
  assert.equal(
    q3.options.some((o) => o.text.includes('-16')),
    true,
    '(-4)^2 must include -16 distractor'
  );

  // Q4: sqrt((-8)^2) = 8
  const q4 = E02_SAMPLE_QUESTIONS[3];
  assert.ok(q4.stem.includes('\\sqrt{(-8)^2}'));
  assert.equal(q4.officialAnswerText, '\\(8\\)');

  // Q5: 2x - 3 = 9 -> x = 6
  const q5 = E02_SAMPLE_QUESTIONS[4];
  assert.ok(q5.stem.includes('2x - 3 = 9'));
  assert.equal(q5.officialAnswerText, '\\(x = 6\\)');

  // Q6: Square side 5 cm -> perimeter 20 cm
  const q6 = E02_SAMPLE_QUESTIONS[5];
  assert.ok(q6.stem.includes('5\\,\\mathrm{cm}'));
  assert.equal(q6.officialAnswerText, '\\(20\\,\\mathrm{cm}\\)');

  // Q7: Rectangle 7,5 cm x 4 cm -> area 30 cm^2
  const q7 = E02_SAMPLE_QUESTIONS[6];
  assert.ok(q7.stem.includes('7{,}5\\,\\mathrm{cm}'));
  assert.equal(q7.officialAnswerText, '\\(30\\,\\mathrm{cm}^2\\)');

  // Q8: Fair 6-sided die > 4 -> 1/3; explanation cites 5 and 6 => 2/6 = 1/3; NO 2/6 distractor
  const q8 = E02_SAMPLE_QUESTIONS[7];
  assert.ok(q8.stem.includes('xúc xắc cân đối sáu mặt'));
  assert.equal(q8.officialAnswerText, '\\(\\frac{1}{3}\\)');
  assert.ok(q8.explanation.includes('5') && q8.explanation.includes('6'));
  assert.ok(q8.explanation.includes('\\frac{2}{6} = \\frac{1}{3}'));
  assert.equal(
    q8.options.some((o) => o.text.includes('\\frac{2}{6}')),
    false,
    'Must not split 2/6 and 1/3 into two separate choices'
  );

  // Check KaTeX renders cleanly across all 8 questions (stems, options, explanations) + malformed fallback
  for (const q of E02_SAMPLE_QUESTIONS) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
    assert.equal(q.options.length, 4);
    assert.ok(q.options.some((o) => o.id === q.correctOptionId));

    const stemHtml = renderMathToHtml(q.stem);
    assert.ok(stemHtml.includes('katex'), `Stem should render KaTeX for ${q.id}`);
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

  // Malformed LaTeX shows raw text cleanly without throwing
  const brokenHtml = renderMathToHtml('Lỗi cú pháp: \\(\\frac{5}{\\)');
  assert.equal(typeof brokenHtml, 'string');
  assert.ok(brokenHtml.includes('\\frac{5}{'));
});

// ============================================================================
// 2. SHUFFLING PRESERVES STABLE OPTION ID & SYNCS LABEL/GRADING
// ============================================================================

test('E02 option shuffling preserves stable option ID and grades accurately against new A–D label', () => {
  const orig = E02_SAMPLE_QUESTIONS[2]; // (-4)^2 = 16
  const shuffled = shuffleCatchOptionsPreservingId(orig, createSeededRng(2027));

  const correctOpt = shuffled.options.find((o) => o.id === shuffled.correctOptionId);
  assert.ok(correctOpt);
  assert.equal(correctOpt.text, '\\(16\\)');
  assert.equal(getCorrectOptionLabelForCatchQuestion(shuffled), correctOpt.label);

  const cfg = createDefaultCatchBallConfig('solo_practice');
  cfg.questionCount = 1;
  cfg.shuffleOptions = false;
  const st = createInitialCatchBallState({
    config: cfg,
    questionPool: [shuffled],
  });

  const res = commitCatchBallTurn(st, {
    question: shuffled,
    selectedLabel: correctOpt.label,
  });
  assert.equal(res.committed, true);
  assert.equal(res.record?.isCorrectByParticipant.solo_1, true);
  assert.equal(res.record?.pointsDeltaByParticipant.solo_1, E02_POINTS_CORRECT);
});

// ============================================================================
// 3. SOLO PRACTICE (1 STUDENT) & WHOLE-CLASS (1–50 HS) FULL 8-QUESTION 80-PT RUN
// ============================================================================

test('E02 Solo Practice: full 8-question session yields max 80 points; tracks correct, incorrect, and no_answer', () => {
  const cfg = createDefaultCatchBallConfig('solo_practice');
  assert.equal(cfg.questionCount, 8);
  assert.equal(cfg.timerSeconds, 20);

  let st = createInitialCatchBallState({
    config: cfg,
    questionPool: E02_SAMPLE_QUESTIONS,
    rng: createSeededRng(101),
  });

  // Answer all 8 questions correctly -> exactly 80 points
  for (let i = 0; i < 8; i++) {
    const q = st.questionOrder[st.currentTurnIndex];
    const correctLabel = getCorrectOptionLabelForCatchQuestion(q);
    const res = commitCatchBallTurn(st, { question: q, selectedLabel: correctLabel });
    assert.equal(res.committed, true);
    st = res.state;
    if (i < 7) st = advanceCatchBallTurn(st);
  }
  assert.equal(st.status, 'finished');
  const perfect = computeCatchStandings(st);
  assert.equal(perfect.length, 1);
  assert.equal(perfect[0].points, 80);
  assert.equal(perfect[0].correctCount, 8);
  assert.equal(perfect[0].incorrectCount, 0);
  assert.equal(perfect[0].noAnswerCount, 0);

  // Whole-class mixed run (1 right, 1 wrong, 1 no_answer)
  const classCfg = createDefaultCatchBallConfig('whole_class');
  classCfg.questionCount = 3;
  let cst = createInitialCatchBallState({
    config: classCfg,
    questionPool: E02_SAMPLE_QUESTIONS,
    rng: createSeededRng(12),
  });
  const q0 = cst.questionOrder[0];
  const q0Right = getCorrectOptionLabelForCatchQuestion(q0);
  cst = commitCatchBallTurn(cst, { question: q0, selectedLabel: q0Right }).state;
  cst = advanceCatchBallTurn(cst);

  const q1 = cst.questionOrder[1];
  const q1Wrong = (['A', 'B', 'C', 'D'] as const).find(
    (l) => l !== getCorrectOptionLabelForCatchQuestion(q1)
  )!;
  cst = commitCatchBallTurn(cst, { question: q1, selectedLabel: q1Wrong }).state;
  cst = advanceCatchBallTurn(cst);

  const q2 = cst.questionOrder[2];
  cst = commitCatchBallTurn(cst, { question: q2, selectedLabel: 'no_answer' }).state;

  const cStandings = computeCatchStandings(cst);
  assert.equal(cStandings[0].points, 10);
  assert.equal(cStandings[0].correctCount, 1);
  assert.equal(cStandings[0].incorrectCount, 1);
  assert.equal(cStandings[0].noAnswerCount, 1);
});

// ============================================================================
// 4. TEAMS MODE (2–6 TEAMS): UNGRADED VS NO_ANSWER, DUPLICATE GUARD, EDIT & TIES
// ============================================================================

test('E02 Teams mode: blocks ungraded, accepts no_answer, prevents double-click, edits last turn, and ranks ties as Đồng hạng', () => {
  const cfg = createDefaultCatchBallConfig('teams');
  cfg.teams = createCatchTeams(4, ['Đội A', 'Đội B', 'Đội C', 'Đội D']);
  cfg.questionCount = 2;

  let st = createInitialCatchBallState({
    config: cfg,
    questionPool: E02_SAMPLE_QUESTIONS,
    rng: createSeededRng(33),
  });

  const q0 = st.questionOrder[0];
  const right0 = getCorrectOptionLabelForCatchQuestion(q0);
  const wrong0 = (['A', 'B', 'C', 'D'] as const).find((l) => l !== right0)!;

  // Must reject if any team is still 'ungraded'
  const blocked = commitCatchBallTurn(st, {
    question: q0,
    teamChoices: {
      cteam_1: right0,
      cteam_2: 'ungraded',
      cteam_3: wrong0,
      cteam_4: 'no_answer',
    },
  });
  assert.equal(blocked.committed, false);
  assert.equal(blocked.reason, 'ungraded_team');

  // Commit with explicit 'no_answer'
  const c0 = commitCatchBallTurn(st, {
    question: q0,
    teamChoices: {
      cteam_1: right0,
      cteam_2: wrong0,
      cteam_3: wrong0,
      cteam_4: 'no_answer',
    },
  });
  assert.equal(c0.committed, true);
  assert.equal(c0.record?.pointsDeltaByParticipant.cteam_1, E02_POINTS_CORRECT);
  assert.equal(c0.record?.pointsDeltaByParticipant.cteam_2, E02_POINTS_INCORRECT);
  assert.equal(c0.record?.pointsDeltaByParticipant.cteam_4, E02_POINTS_INCORRECT);
  assert.equal(c0.record?.choiceByParticipant.cteam_4, 'no_answer');
  st = c0.state;

  // Double-click duplicate commit on same questionId must be rejected
  const dup = commitCatchBallTurn(st, {
    question: q0,
    teamChoices: {
      cteam_1: right0,
      cteam_2: right0,
      cteam_3: right0,
      cteam_4: right0,
    },
  });
  assert.equal(dup.committed, false);
  assert.equal(dup.reason, 'duplicate_question_commit');

  // Edit last confirmed turn: Team 2 also got it right -> Team 1 & Team 2 tie at 10 pts (#1 Đồng hạng)
  const edited = editLastCatchBallTurn(st, {
    teamChoices: {
      cteam_1: right0,
      cteam_2: right0,
      cteam_3: wrong0,
      cteam_4: 'no_answer',
    },
  });
  assert.equal(edited.edited, true);
  st = edited.state;

  const afterEdit = computeCatchStandings(st);
  assert.equal(afterEdit[0].points, 10);
  assert.equal(afterEdit[1].points, 10);
  assert.equal(afterEdit[0].rank, 1);
  assert.equal(afterEdit[1].rank, 1);
  assert.equal(afterEdit[0].isTied, true);
  assert.equal(afterEdit[1].isTied, true);
  assert.equal(afterEdit[2].points, 0);
  assert.equal(afterEdit[3].points, 0);
  assert.equal(afterEdit[2].rank, 3);
  assert.equal(afterEdit[3].rank, 3);
  assert.equal(afterEdit[2].isTied, true);
});

// ============================================================================
// 5. SMART EDU RBAC BANK ADAPTER & VALIDATION
// ============================================================================

test('E02 bank adapter enforces RBAC, 4-option single_choice, stem deduplication, and empty-pool error', () => {
  const bank: Question[] = [
    makeBankQuestion({ id: 'q_app_1', status: 'approved' }),
    makeBankQuestion({ id: 'q_app_dup', status: 'approved' }), // duplicate stem
    makeBankQuestion({
      id: 'q_pend_1',
      status: 'pending',
      stem: 'Tính \\(3^2 + 1\\).',
    }),
    makeBankQuestion({
      id: 'q_dep_1',
      status: 'deprecated',
      stem: 'Câu cũ \\(1 + 2\\).',
    }),
    makeBankQuestion({
      id: 'q_short',
      status: 'approved',
      type: 'short_answer',
      stem: 'Điền số: \\(4 + 5 = ?\\)',
    }),
  ];

  const studentPool = buildE02QuestionPool({
    sourceKind: 'bank',
    bankQuestions: bank,
    userRole: 'student',
  });
  assert.equal(studentPool.length, 1);
  assert.equal(studentPool[0].id, 'q_app_1');

  const teacherPool = buildE02QuestionPool({
    sourceKind: 'bank',
    bankQuestions: bank,
    userRole: 'teacher',
  });
  assert.equal(teacherPool.length, 2);

  const cfg = createDefaultCatchBallConfig('teams');
  cfg.sourceKind = 'bank';
  const validation = validateCatchSetupConfig(cfg, 0);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length > 0);
});

// ============================================================================
// 6. PERSISTENCE (PRESERVING SHUFFLED POSITIONS), /DEMO ISOLATION & AUDIO SAFETY
// ============================================================================

test('E02 session persistence preserves exact questionOrder/option positions, isolates /demo, and recovers corrupt JSON', () => {
  const normalEnv = installMockWindow('/games');
  try {
    assert.equal(getE02SessionStorageKey(), E02_SESSION_STORAGE_KEY);
    const cfg = createDefaultCatchBallConfig('solo_practice');
    cfg.questionCount = 4;
    cfg.shuffleOptions = true;

    let st = createInitialCatchBallState({
      config: cfg,
      questionPool: E02_SAMPLE_QUESTIONS,
      rng: createSeededRng(88),
    });
    const q0 = st.questionOrder[0];
    const rightLabel = getCorrectOptionLabelForCatchQuestion(q0);
    st = commitCatchBallTurn(st, { question: q0, selectedLabel: rightLabel }).state;
    saveE02Session(st);

    const loaded = loadE02Session();
    assert.equal(loaded.recoveredFromCorruption, false);
    assert.ok(loaded.state);
    assert.deepEqual(loaded.state.questionOrder[0].options, q0.options);
    assert.equal(computeCatchStandings(loaded.state)[0].points, 10);

    // Corrupt storage triggers safe auto-recovery
    normalEnv.storage.setItem(E02_SESSION_STORAGE_KEY, '{corrupt');
    const recovered = loadE02Session();
    assert.equal(recovered.state, null);
    assert.equal(recovered.recoveredFromCorruption, true);
    assert.equal(normalEnv.storage.getItem(E02_SESSION_STORAGE_KEY), null);
    clearE02Session();
  } finally {
    normalEnv.restore();
  }

  const demoEnv = installMockWindow('/demo');
  try {
    assert.equal(
      getE02SessionStorageKey(),
      `${KHKT_DEMO_STORAGE_PREFIX}${E02_SESSION_STORAGE_KEY}`
    );
    const st = createInitialCatchBallState({
      config: createDefaultCatchBallConfig('whole_class'),
      questionPool: E02_SAMPLE_QUESTIONS,
      rng: createSeededRng(9),
    });
    saveE02Session(st);
    assert.ok(demoEnv.storage.getItem(`${KHKT_DEMO_STORAGE_PREFIX}${E02_SESSION_STORAGE_KEY}`));
    assert.equal(demoEnv.storage.getItem(E02_SESSION_STORAGE_KEY), null);
  } finally {
    demoEnv.restore();
  }
});

test('E02 EduGameSoundBank audio cues run safely without throwing when muted or headless', () => {
  const bank = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    bank.playBallBounceCue(true);
    bank.playBallCatchWhoosh(true);
    bank.playBallOutcomeCue(true, true);
    bank.playBallOutcomeCue(false, true);
    bank.playBallSessionSummary(true);

    bank.playBallBounceCue(false);
    bank.playBallCatchWhoosh(false);
    bank.playBallOutcomeCue(true, false);
    bank.playBallOutcomeCue(false, false);
    bank.playBallSessionSummary(false);

    bank.stopAll();
    bank.dispose();
  });
});
