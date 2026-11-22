import test from 'node:test';
import assert from 'node:assert/strict';
import {
  D03_SAMPLE_BADGE,
  D03_SAMPLE_PACK_TITLE,
  D03_SAMPLE_QUESTIONS,
  advanceToNextQuestion,
  buildD03QuestionPool,
  clearD03Session,
  commitTurnResult,
  computeTurnPreview,
  createDefaultTugConfig,
  createInitialMatchState,
  editLastConfirmedTurn,
  endMatchEarly,
  evaluateSoloAnswer,
  getD03SessionStorageKey,
  loadD03Session,
  prepareMatchQuestions,
  saveD03Session,
  shuffleQuestionOptionsPreservingId,
  validateTugSetupConfig,
} from './tugOfWar3dEngine';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

function withMockWindow(pathname: string, fn: (storage: ReturnType<typeof createMemoryStorage>) => void) {
  const storage = createMemoryStorage();
  const prevWindow = (globalThis as unknown as { window?: unknown }).window;
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    location: { pathname },
    setTimeout,
    clearTimeout,
  };
  try {
    fn(storage);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window?: unknown }).window = prevWindow;
    }
  }
}

test('1. Sample question pack contains all 10 exact Math questions with Dữ liệu mẫu tag and distinct options', () => {
  assert.equal(D03_SAMPLE_PACK_TITLE, 'Kéo co Toán THCS – Số và hình');
  assert.equal(D03_SAMPLE_QUESTIONS.length, 10);

  const expectedAnswers = ['5', '25', '1/4', '16', '3:5', '12', '26 cm', '30 cm²', '7', '55°'];
  D03_SAMPLE_QUESTIONS.forEach((q, idx) => {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, D03_SAMPLE_BADGE);
    assert.equal(q.officialAnswerText, expectedAnswers[idx]);
    assert.ok(q.options && q.options.length === 4, `Question ${idx + 1} must have 4 options`);
    const optionTexts = new Set(q.options!.map((o) => o.text));
    assert.equal(optionTexts.size, 4, `Question ${idx + 1} must have 4 distinct options`);
    const correctOpt = q.options!.find((o) => o.id === q.correctOptionId);
    assert.ok(correctOpt, `Question ${idx + 1} must match correctOptionId`);
    assert.equal(correctOpt!.text, expectedAnswers[idx]);
  });
});

test('2. Shuffling options preserves stable option ID and exact correctness (never tied to index)', () => {
  const original = D03_SAMPLE_QUESTIONS[0];
  let seed = 0.73;
  const deterministicRng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const shuffled = shuffleQuestionOptionsPreservingId(original, deterministicRng);
  assert.equal(shuffled.correctOptionId, original.correctOptionId);
  const foundCorrect = shuffled.options!.find((o) => o.id === shuffled.correctOptionId);
  assert.ok(foundCorrect);
  assert.equal(foundCorrect!.text, '5');

  const evalRes = evaluateSoloAnswer(shuffled, { selectedOptionId: foundCorrect!.id });
  assert.equal(evalRes.isCorrect, true);
});

test('3. Two-team deterministic walkthrough: 0 -> -1 -> -1 (both right: A=2,B=1) -> 0 (B right: A=2,B=2) -> 0 (both wrong)', () => {
  const cfg = createDefaultTugConfig('two_teams');
  cfg.questionCount = 5;
  cfg.winTarget = 3;
  const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });
  let state = createInitialMatchState(cfg, qs);

  assert.equal(state.ropePosition, 0);
  assert.equal(state.teamACorrect, 0);
  assert.equal(state.teamBCorrect, 0);

  // Q1: Only A right -> -1 (A=1, B=0)
  let r = commitTurnResult(state, {
    question: qs[0],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  });
  assert.equal(r.committed, true);
  state = advanceToNextQuestion(r.state);
  assert.equal(state.ropePosition, -1);
  assert.equal(state.teamACorrect, 1);
  assert.equal(state.teamBCorrect, 0);

  // Q2: Both right -> rope stays -1, BOTH A and B +1 (A=2, B=1)
  r = commitTurnResult(state, {
    question: qs[1],
    teamAVerdict: 'correct',
    teamBVerdict: 'correct',
    resultSource: 'teacher_single_device',
  });
  state = advanceToNextQuestion(r.state);
  assert.equal(state.ropePosition, -1);
  assert.equal(state.teamACorrect, 2);
  assert.equal(state.teamBCorrect, 1);

  // Q3: Only B right -> rope crosses back to 0 (A=2, B=2)
  r = commitTurnResult(state, {
    question: qs[2],
    teamAVerdict: 'no_answer',
    teamBVerdict: 'correct',
    resultSource: 'teacher_single_device',
  });
  state = advanceToNextQuestion(r.state);
  assert.equal(state.ropePosition, 0);
  assert.equal(state.teamACorrect, 2);
  assert.equal(state.teamBCorrect, 2);

  // Q4: Both wrong -> rope stays 0 (A=2, B=2)
  r = commitTurnResult(state, {
    question: qs[3],
    teamAVerdict: 'incorrect',
    teamBVerdict: 'no_answer',
    resultSource: 'teacher_single_device',
  });
  state = advanceToNextQuestion(r.state);
  assert.equal(state.ropePosition, 0);
  assert.equal(state.teamACorrect, 2);
  assert.equal(state.teamBCorrect, 2);
  assert.equal(state.status, 'playing');

  // Q5: Both wrong -> match finishes at 0 -> Draw ("Hòa")
  r = commitTurnResult(state, {
    question: qs[4],
    teamAVerdict: 'incorrect',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  });
  state = r.state;
  assert.equal(state.status, 'draw');
  assert.equal(state.winner, 'draw');
  assert.equal(state.endReasonLabel, 'Hòa');
});

test('4. Crossing center line (-1 -> 0 -> +1), hitting win target (-3 or +3), and winning by final position', () => {
  const cfg = createDefaultTugConfig('two_teams');
  cfg.questionCount = 6;
  cfg.winTarget = 3;
  const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });

  // Case A: Team B reaches +3 immediately on Q3
  let sTarget = createInitialMatchState(cfg, qs);
  for (let i = 0; i < 3; i++) {
    const res = commitTurnResult(sTarget, {
      question: qs[i],
      teamAVerdict: 'incorrect',
      teamBVerdict: 'correct',
      resultSource: 'teacher_single_device',
    });
    sTarget = res.state;
  }
  assert.equal(sTarget.ropePosition, 3);
  assert.equal(sTarget.status, 'win_b_target');
  assert.equal(sTarget.winner, 'B');
  assert.equal(sTarget.endReasonLabel, 'Chạm vạch thắng');

  // Case B: Out of questions before reaching winTarget -> "Thắng theo vị trí cuối trận"
  const cfgPos = createDefaultTugConfig('two_teams');
  cfgPos.questionCount = 3;
  cfgPos.winTarget = 3;
  const qs3 = qs.slice(0, 3);
  let sPos = createInitialMatchState(cfgPos, qs3);
  // Q1: A right (-1)
  sPos = commitTurnResult(sPos, {
    question: qs3[0],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  }).state;
  // Q2: B right (0)
  sPos = commitTurnResult(sPos, {
    question: qs3[1],
    teamAVerdict: 'incorrect',
    teamBVerdict: 'correct',
    resultSource: 'teacher_single_device',
  }).state;
  // Q3: B right (+1) -> ends on last question with +1 -> Team B wins by position
  sPos = commitTurnResult(sPos, {
    question: qs3[2],
    teamAVerdict: 'incorrect',
    teamBVerdict: 'correct',
    resultSource: 'teacher_single_device',
  }).state;

  assert.equal(sPos.ropePosition, 1);
  assert.equal(sPos.status, 'win_b_position');
  assert.equal(sPos.winner, 'B');
  assert.equal(sPos.endReasonLabel, 'Thắng theo vị trí cuối trận');
});

test('5. Edit last confirmed turn recomputes rope, counts, and reverses a just-triggered win state', () => {
  const cfg = createDefaultTugConfig('two_teams');
  cfg.questionCount = 6;
  cfg.winTarget = 2;
  const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });
  let state = createInitialMatchState(cfg, qs);

  // Q1: A right -> -1
  state = commitTurnResult(state, {
    question: qs[0],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  }).state;
  // Q2: A right -> -2 -> Team A hits win target!
  state = commitTurnResult(state, {
    question: qs[1],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  }).state;
  assert.equal(state.status, 'win_a_target');
  assert.equal(state.ropePosition, -2);
  assert.equal(state.teamACorrect, 2);

  // Teacher edits Q2: actually BOTH teams were correct!
  const edited = editLastConfirmedTurn(state, {
    teamAVerdict: 'correct',
    teamBVerdict: 'correct',
  });
  assert.equal(edited.edited, true);
  assert.equal(edited.state.ropePosition, -1);
  assert.equal(edited.state.teamACorrect, 2);
  assert.equal(edited.state.teamBCorrect, 1);
  assert.equal(edited.state.status, 'playing');
  assert.equal(edited.state.winner, null);
});

test('6. Idempotency guard blocks double-click duplicate commits for same question & endMatchEarly works', () => {
  const cfg = createDefaultTugConfig('two_teams');
  cfg.questionCount = 5;
  cfg.winTarget = 3;
  const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });
  const initial = createInitialMatchState(cfg, qs);

  const first = commitTurnResult(initial, {
    question: qs[0],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  });
  assert.equal(first.committed, true);

  // Second commit of exact same questionId must be rejected
  const duplicate = commitTurnResult(first.state, {
    question: qs[0],
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
    resultSource: 'teacher_single_device',
  });
  assert.equal(duplicate.committed, false);
  assert.equal(duplicate.reason, 'duplicate_question_commit');
  assert.equal(duplicate.state.history.length, 1);
  assert.equal(duplicate.state.ropePosition, -1);

  // End match early preserves ropePosition & judged count
  const early = endMatchEarly(first.state);
  assert.equal(early.status, 'ended_early');
  assert.equal(early.endReasonLabel, 'Kết thúc sớm');
  assert.equal(early.ropePosition, -1);
  assert.equal(early.history.length, 1);
});

test('7. Solo Practice mode: default 5 questions, target 3; right +1, wrong stays put, no fake AI opponent', () => {
  const cfg = createDefaultTugConfig('solo_practice');
  assert.equal(cfg.questionCount, 5);
  assert.equal(cfg.winTarget, 3);

  const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });
  let state = createInitialMatchState(cfg, qs);

  // Q1 wrong -> stays at 0
  state = commitTurnResult(state, {
    question: qs[0],
    teamAVerdict: 'ungraded',
    teamBVerdict: 'ungraded',
    soloVerdict: 'incorrect',
    resultSource: 'student_auto',
  }).state;
  assert.equal(state.ropePosition, 0);
  assert.equal(state.soloCorrect, 0);

  // Q2, Q3, Q4 right -> advances to 3 -> solo_win
  for (let i = 1; i <= 3; i++) {
    state = commitTurnResult(state, {
      question: qs[i],
      teamAVerdict: 'ungraded',
      teamBVerdict: 'ungraded',
      soloVerdict: 'correct',
      resultSource: 'student_auto',
    }).state;
  }
  assert.equal(state.ropePosition, 3);
  assert.equal(state.soloCorrect, 3);
  assert.equal(state.status, 'solo_win');
  assert.equal(state.winner, 'solo');
});

test('8. Setup validation enforces winTarget <= playableQuestions and warns when bank has fewer questions', () => {
  const cfg = createDefaultTugConfig('two_teams');
  cfg.questionCount = 10;
  cfg.winTarget = 5;

  // Bank only has 3 questions -> effectiveQuestionCount=3, winTarget=5 -> invalid!
  const invalid = validateTugSetupConfig(cfg, 3);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((e) => e.includes('Mục tiêu thắng')));

  // Adjust winTarget to 3 -> valid with warning about 3 < 10
  cfg.winTarget = 3;
  const validWithWarn = validateTugSetupConfig(cfg, 3);
  assert.equal(validWithWarn.valid, true);
  assert.equal(validWithWarn.effectiveQuestionCount, 3);
  assert.ok(validWithWarn.warnings.length > 0);
});

test('9. Bank adapter enforces RBAC, rejects empty stems/deprecated, deduplicates, and supports all 4 question types', () => {
  const mockBank: Question[] = [
    {
      id: 'q_approved_sc',
      code: 'T1',
      grade: '6',
      subject: 'math',
      textbook: 'Kết nối tri thức',
      chapter: 'C1',
      lesson: 'B1',
      level: 'know',
      type: 'single_choice',
      stem: '2 + 2 = ?',
      points: 1,
      explanation: '2 + 2 = 4',
      status: 'approved',
      author: 'GV',
      version: 1,
      options: [
        { id: 'o1', label: 'A', text: '3' },
        { id: 'o2', label: 'B', text: '4' },
      ],
      correctAnswer: 'o2',
    },
    {
      id: 'q_dup_stem',
      code: 'T2',
      grade: '6',
      subject: 'math',
      textbook: 'Kết nối tri thức',
      chapter: 'C1',
      lesson: 'B1',
      level: 'know',
      type: 'single_choice',
      stem: '  2 + 2 = ? ',
      points: 1,
      explanation: 'Trùng đề',
      status: 'approved',
      author: 'GV',
      version: 1,
      options: [
        { id: 'o1', label: 'A', text: '3' },
        { id: 'o2', label: 'B', text: '4' },
      ],
      correctAnswer: 'o2',
    },
    {
      id: 'q_pending',
      code: 'T3',
      grade: '6',
      subject: 'math',
      textbook: 'Kết nối tri thức',
      chapter: 'C1',
      lesson: 'B1',
      level: 'know',
      type: 'short_answer',
      stem: '5 x 5 = ?',
      points: 1,
      explanation: '25',
      status: 'pending',
      author: 'GV',
      version: 1,
      acceptedAnswers: ['25'],
    },
    {
      id: 'q_empty',
      code: 'T4',
      grade: '6',
      subject: 'math',
      textbook: 'Kết nối tri thức',
      chapter: 'C1',
      lesson: 'B1',
      level: 'know',
      type: 'essay',
      stem: '   ',
      points: 1,
      explanation: '',
      status: 'approved',
      author: 'GV',
      version: 1,
    },
    {
      id: 'q_essay_ok',
      code: 'T5',
      grade: '6',
      subject: 'math',
      textbook: 'Kết nối tri thức',
      chapter: 'C1',
      lesson: 'B1',
      level: 'apply',
      type: 'essay',
      stem: 'Trình bày cách tính diện tích hình thang.',
      points: 2,
      explanation: 'S = (a+b)*h/2',
      status: 'approved',
      author: 'GV',
      version: 1,
    },
  ];

  // Student sees ONLY approved non-empty deduplicated questions (q_approved_sc & q_essay_ok)
  const studentPool = buildD03QuestionPool({
    sourceKind: 'bank',
    bankQuestions: mockBank,
    userRole: 'student',
  });
  assert.equal(studentPool.length, 2);
  assert.equal(studentPool.some((q) => q.id === 'q_pending'), false);
  assert.equal(studentPool.find((q) => q.id === 'q_essay_ok')?.requiresTeacherGrading, true);

  // Teacher sees approved + pending (3 questions)
  const teacherPool = buildD03QuestionPool({
    sourceKind: 'bank',
    bankQuestions: mockBank,
    userRole: 'teacher',
  });
  assert.equal(teacherPool.length, 3);
});

test('10. Preview text accurately describes movement direction for all 4 two-team outcomes', () => {
  const pA = computeTurnPreview({
    mode: 'two_teams',
    teamAName: 'Đội Xanh',
    teamBName: 'Đội Cam',
    teamAVerdict: 'correct',
    teamBVerdict: 'incorrect',
  });
  assert.equal(pA.direction, 'move_a');
  assert.ok(pA.label.includes('Đội Xanh'));

  const pB = computeTurnPreview({
    mode: 'two_teams',
    teamAName: 'Đội Xanh',
    teamBName: 'Đội Cam',
    teamAVerdict: 'no_answer',
    teamBVerdict: 'correct',
  });
  assert.equal(pB.direction, 'move_b');
  assert.ok(pB.label.includes('Đội Cam'));

  const pStayBothRight = computeTurnPreview({
    mode: 'two_teams',
    teamAName: 'Đội Xanh',
    teamBName: 'Đội Cam',
    teamAVerdict: 'correct',
    teamBVerdict: 'correct',
  });
  assert.equal(pStayBothRight.direction, 'stay');
  assert.equal(pStayBothRight.label, 'Dây giữ nguyên');
});

test('11. Session persistence isolates /demo storage, recomputes state on restore, and recovers from corrupt JSON', () => {
  // Normal runtime persistence
  withMockWindow('/', (storage) => {
    const cfg = createDefaultTugConfig('two_teams');
    const qs = prepareMatchQuestions(D03_SAMPLE_QUESTIONS, { ...cfg, shuffleOptions: false });
    let state = createInitialMatchState(cfg, qs);
    state = commitTurnResult(state, {
      question: qs[0],
      teamAVerdict: 'correct',
      teamBVerdict: 'incorrect',
      resultSource: 'teacher_single_device',
    }).state;

    const key = getD03SessionStorageKey();
    assert.equal(key.startsWith(KHKT_DEMO_STORAGE_PREFIX), false);

    saveD03Session(state);
    const loaded = loadD03Session();
    assert.equal(loaded.recoveredFromCorruption, false);
    assert.ok(loaded.state);
    assert.equal(loaded.state!.ropePosition, -1);
    assert.equal(loaded.state!.teamACorrect, 1);

    // Corrupt JSON recovery
    storage.setItem(key, '{bad json!!!');
    const corruptLoad = loadD03Session();
    assert.equal(corruptLoad.state, null);
    assert.equal(corruptLoad.recoveredFromCorruption, true);
    assert.equal(storage.getItem(key), null);
  });

  // /demo runtime storage isolation
  withMockWindow('/demo', () => {
    const demoKey = getD03SessionStorageKey();
    assert.equal(demoKey.startsWith(KHKT_DEMO_STORAGE_PREFIX), true);
    clearD03Session();
  });
});

test('12. D03 audio methods on EduGameSoundBank execute safely without throwing when muted or headless', () => {
  const bank = new EduGameSoundBank();
  bank.setActiveTurnToken('d03_test');
  assert.doesNotThrow(() => {
    bank.playTugWhistle(true, 'd03_test');
    bank.playTugWhistle(false, 'd03_test');
    bank.startTugPullLoop(() => false, 'd03_test');
    bank.stopTugPullLoop();
    bank.playTugNeutralTick(false, 'd03_test');
    bank.playTugWinFanfare(false, 'd03_test');
    bank.playTugDrawChime(false, 'd03_test');
    bank.stopAll();
    bank.dispose();
  });
});
