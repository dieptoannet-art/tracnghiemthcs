import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  E03_SAMPLE_MATH_QUESTIONS,
  E03_SAMPLE_BADGE,
  E03_SAMPLE_PACK_TITLE,
  E03_DEVICE_TIMING_LABEL,
  E03_SIGNAL_MIN_WAIT_MS,
  E03_SIGNAL_MAX_WAIT_MS,
  E03_POINTS_PER_CORRECT,
  createDefaultSignalConfig,
  createInitialSignalState,
  pickRandomWaitDelayMs,
  startSignalTrial,
  triggerSignalGo,
  recordSignalResponse,
  recordSignalTimeout,
  interruptSignalTrial,
  redoInterruptedSignalTrial,
  advanceToNextSignalTrial,
  computeSignalSummary,
  createDefaultReflexMathConfig,
  createReflexTeams,
  buildE03MathQuestionPool,
  validateReflexMathSetup,
  shuffleReflexOptionsPreservingId,
  createInitialReflexMathState,
  createEmptyDraftGrades,
  areAllMathParticipantsGraded,
  commitReflexMathTurn,
  editCurrentReflexMathTurn,
  advanceReflexMathQuestion,
  computeMathStandingsFromHistory,
  saveE03Session,
  loadE03Session,
  clearE03Session,
  getE03StorageKey,
} from './quickReflex3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { Question } from '../../../types';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

function makeDeterministicRng(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

describe('E03 — Phản xạ nhanh 3D Engine & Acceptance Suite', () => {
  it('1. Signal Mode: secret wait delay in [1500, 4000] ms, 1 practice excluded from stats, valid fastest & median accurate', () => {
    const rng = makeDeterministicRng(101);
    for (let i = 0; i < 100; i++) {
      const d = pickRandomWaitDelayMs(rng);
      assert.ok(
        d >= E03_SIGNAL_MIN_WAIT_MS && d <= E03_SIGNAL_MAX_WAIT_MS,
        `Delay ${d} must stay in [1500, 4000]`
      );
    }

    let state = createInitialSignalState(createDefaultSignalConfig('solo'));
    assert.equal(state.config.practiceTrials, 1);
    assert.equal(state.config.officialTrials, 8);

    // Practice trial: ultra-fast 120 ms — MUST NOT affect official fastest/median!
    state = startSignalTrial(state, { attemptSeq: 1, rng });
    assert.equal(state.phase, 'waiting');
    state = triggerSignalGo(state, state.activeTrialToken, 1000);
    assert.equal(state.phase, 'go');
    const pracRes = recordSignalResponse(state, {
      trialToken: state.activeTrialToken,
      responseTimestampMs: 1120,
    });
    assert.equal(pracRes.accepted, true);
    assert.equal(pracRes.nextState.lastResult?.isPractice, true);
    assert.equal(pracRes.nextState.lastResult?.reactionMs, 120);
    state = advanceToNextSignalTrial(pracRes.nextState);
    assert.equal(state.phase, 'idle');

    // Run 8 official trials: 4 valid (260, 210, 340, 290), 2 early, 2 timeout
    const officialPlan: Array<{ kind: 'valid'; ms: number } | { kind: 'early' } | { kind: 'timeout' }> = [
      { kind: 'valid', ms: 260 },
      { kind: 'early' },
      { kind: 'valid', ms: 210 },
      { kind: 'timeout' },
      { kind: 'valid', ms: 340 },
      { kind: 'early' },
      { kind: 'valid', ms: 290 },
      { kind: 'timeout' },
    ];

    officialPlan.forEach((step, idx) => {
      state = startSignalTrial(state, { attemptSeq: 10 + idx, rng });
      if (step.kind === 'early') {
        const res = recordSignalResponse(state, {
          trialToken: state.activeTrialToken,
          responseTimestampMs: 5000 + idx * 100,
        });
        assert.equal(res.accepted, true);
        assert.equal(res.outcome, 'early');
        assert.equal(res.nextState.lastResult?.reactionMs, null); // NEVER 0 ms
        state = res.nextState;
      } else if (step.kind === 'timeout') {
        state = triggerSignalGo(state, state.activeTrialToken, 10000 + idx * 1000);
        const res = recordSignalTimeout(state, state.activeTrialToken);
        assert.equal(res.accepted, true);
        assert.equal(res.nextState.lastResult?.outcome, 'timeout');
        assert.equal(res.nextState.lastResult?.reactionMs, null);
        state = res.nextState;
      } else {
        const goT = 20000 + idx * 1000;
        state = triggerSignalGo(state, state.activeTrialToken, goT);
        const res = recordSignalResponse(state, {
          trialToken: state.activeTrialToken,
          responseTimestampMs: goT + step.ms,
        });
        assert.equal(res.accepted, true);
        assert.equal(res.outcome, 'valid');
        assert.equal(res.nextState.lastResult?.reactionMs, step.ms);
        state = res.nextState;
      }
      state = advanceToNextSignalTrial(state);
    });

    assert.equal(state.phase, 'summary');
    const summary = computeSignalSummary(state);
    assert.equal(summary.deviceTimingLabel, E03_DEVICE_TIMING_LABEL);
    assert.equal(summary.practiceCompletedCount, 1);
    assert.equal(summary.officialTotalCount, 8);
    assert.equal(summary.validCount, 4);
    assert.equal(summary.earlyCount, 2);
    assert.equal(summary.timeoutCount, 2);
    // Practice 120 ms MUST be excluded: sorted valid = [210, 260, 290, 340]
    assert.equal(summary.fastestMs, 210);
    assert.equal(summary.medianMs, Math.round((260 + 290) / 2)); // 275
  });

  it('2. Signal Mode edge cases: double-click/hold idempotency, tab interruption redo, and 0-valid session safety', () => {
    const rng = makeDeterministicRng(202);
    let state = createInitialSignalState({
      format: 'class_turn',
      practiceTrials: 0,
      officialTrials: 2,
    });

    // Trial 1: Start -> Tab switch interrupts -> Redo -> Early tap + duplicate second tap ignored
    state = startSignalTrial(state, { attemptSeq: 1, participantLabel: 'Minh Anh', rng });
    const oldToken = state.activeTrialToken;
    state = interruptSignalTrial(state, 'Chuyển tab');
    assert.equal(state.phase, 'interrupted');
    assert.equal(state.interruptedCount, 1);
    assert.equal(state.records.length, 0);

    // Stale token after interrupt MUST NOT trigger go or record response
    const staleGo = triggerSignalGo(state, oldToken, 500);
    assert.equal(staleGo.phase, 'interrupted');

    state = redoInterruptedSignalTrial(state);
    assert.equal(state.phase, 'idle');
    assert.equal(state.currentTrialIndex, 0); // Same trial slot preserved!

    state = startSignalTrial(state, { attemptSeq: 2, participantLabel: 'Minh Anh', rng });
    const firstEarly = recordSignalResponse(state, {
      trialToken: state.activeTrialToken,
      responseTimestampMs: 1000,
    });
    assert.equal(firstEarly.accepted, true);
    assert.equal(firstEarly.outcome, 'early');
    assert.equal(firstEarly.nextState.lastResult?.reactionMs, null);

    // Rapid double-click / held key immediately after MUST be rejected
    const duplicateClick = recordSignalResponse(firstEarly.nextState, {
      trialToken: state.activeTrialToken,
      responseTimestampMs: 1015,
    });
    assert.equal(duplicateClick.accepted, false);
    assert.equal(duplicateClick.nextState.records.length, 1);

    state = advanceToNextSignalTrial(firstEarly.nextState);

    // Trial 2: Timeout (so entire session has 0 valid responses)
    state = startSignalTrial(state, { attemptSeq: 3, participantLabel: 'Gia Bảo', rng });
    state = triggerSignalGo(state, state.activeTrialToken, 2000);
    const toRes = recordSignalTimeout(state, state.activeTrialToken);
    assert.equal(toRes.accepted, true);
    state = advanceToNextSignalTrial(toRes.nextState);

    assert.equal(state.phase, 'summary');
    const summary = computeSignalSummary(state);
    assert.equal(summary.validCount, 0);
    assert.equal(summary.earlyCount, 1);
    assert.equal(summary.timeoutCount, 1);
    assert.equal(summary.interruptedCount, 1);
    assert.equal(summary.fastestMs, null);
    assert.equal(summary.medianMs, null);
  });

  it('3. Exact 8-question THCS Math sample pack ("Dữ liệu mẫu") & KaTeX rendering + malformed fallback', () => {
    assert.equal(E03_SAMPLE_PACK_TITLE, 'Phản xạ nhanh – Toán THCS');
    assert.equal(E03_SAMPLE_MATH_QUESTIONS.length, 8);

    const expectedChecks = [
      { stemContains: '-12+19', answer: '\\(7\\)' },
      { stemContains: '\\frac{2}{3}+\\frac{1}{6}', answer: '\\(\\frac{5}{6}\\)' },
      { stemContains: '-3^2', answer: '\\(-9\\)', mustContainDistractor: '\\(9\\)' },
      { stemContains: '\\sqrt{(-9)^2}', answer: '\\(9\\)' },
      { stemContains: '3x+2=17', answer: '\\(x=5\\)' },
      { stemContains: '25\\%', answer: '\\(15\\)' },
      { stemContains: '4{,}5\\,\\mathrm{cm}', answer: '\\(18\\,\\mathrm{cm}\\)' },
      { stemContains: 'xúc xắc', answer: '\\(\\frac{1}{3}\\)' },
    ];

    E03_SAMPLE_MATH_QUESTIONS.forEach((q, idx) => {
      const check = expectedChecks[idx];
      assert.equal(q.isSample, true);
      assert.equal(q.sourceBadge, E03_SAMPLE_BADGE);
      assert.ok(q.stem.includes(check.stemContains), `Q${idx + 1} stem mismatch`);
      assert.equal(q.officialAnswerText, check.answer, `Q${idx + 1} official answer mismatch`);
      assert.equal(q.options.length, 4);

      const texts = q.options.map((o) => o.text);
      assert.equal(new Set(texts).size, 4, `Q${idx + 1} options must be 4 distinct values`);

      const matchingCorrect = q.options.filter((o) => o.id === q.correctOptionId);
      assert.equal(matchingCorrect.length, 1);
      assert.equal(matchingCorrect[0].text, check.answer);

      if (check.mustContainDistractor) {
        assert.ok(texts.includes(check.mustContainDistractor), `Q${idx + 1} missing distractor`);
      }

      // Render stem, options, official answer, explanation via shared MathView HTML renderer
      const stemHtml = renderMathToHtml(q.stem);
      const expHtml = renderMathToHtml(q.explanation);
      assert.ok(stemHtml.includes('katex'), `Q${idx + 1} stem should render KaTeX`);
      assert.ok(expHtml.includes('katex'), `Q${idx + 1} explanation should render KaTeX`);
      q.options.forEach((opt) => {
        const optHtml = renderMathToHtml(opt.text);
        assert.ok(optHtml.includes('katex'), `Q${idx + 1} option ${opt.label} should render KaTeX`);
      });
    });

    // Display math \[ ... \] & malformed LaTeX fallback safety
    const displayHtml = renderMathToHtml('Công thức: \\[x = \\frac{-b}{2a}\\]');
    assert.ok(displayHtml.includes('katex-display'));

    const brokenMath = 'Lỗi thử nghiệm: \\(\\frac{1}{\\) vẫn hiển thị an toàn';
    const fallbackHtml = renderMathToHtml(brokenMath);
    assert.ok(fallbackHtml.includes('\\frac{1}{'));
    assert.ok(fallbackHtml.includes('vẫn hiển thị an toàn'));
  });

  it('4. Shuffling options preserves stable option ID and exact correctness across 20 runs', () => {
    const rng = makeDeterministicRng(303);
    const q3 = E03_SAMPLE_MATH_QUESTIONS[2]; // -3^2 = -9
    for (let i = 0; i < 20; i++) {
      const shuffled = shuffleReflexOptionsPreservingId(q3, rng);
      assert.equal(shuffled.correctOptionId, q3.correctOptionId);
      const correctOpt = shuffled.options.find((o) => o.id === shuffled.correctOptionId);
      assert.ok(correctOpt);
      assert.equal(correctOpt.text, '\\(-9\\)');
      assert.deepEqual(
        shuffled.options.map((o) => o.label),
        ['A', 'B', 'C', 'D']
      );
    }
  });

  it('5. Quick Math Teams (2–6 teams) & Solo: ungraded vs no_answer, commit lock, +10/0, Đồng hạng, edit-last recompute', () => {
    const config = createDefaultReflexMathConfig('teams');
    config.teams = createReflexTeams(3);
    config.shuffleOptions = false;
    config.questionCount = 2;

    const pool = buildE03MathQuestionPool({ sourceKind: 'sample' });
    let state = createInitialReflexMathState({ config, pool });

    // Initially all 3 teams are 'ungraded' — commit MUST be blocked
    const draft = createEmptyDraftGrades(config);
    assert.equal(areAllMathParticipantsGraded(config, draft), false);
    const blocked = commitReflexMathTurn(state, draft);
    assert.equal(blocked.committed, false);
    assert.ok(blocked.error?.includes('Đội 1'));

    // Q1 correct is A (7). Team 1 = A (right +10), Team 2 = B (wrong 0), Team 3 = no_answer (0)
    draft['team_1'] = 'A';
    draft['team_2'] = 'B';
    draft['team_3'] = 'no_answer';
    const res1 = commitReflexMathTurn(state, draft);
    assert.equal(res1.committed, true);
    state = res1.nextState;

    // Duplicate commit for same question blocked (idempotent)
    const dup = commitReflexMathTurn(state, draft);
    assert.equal(dup.committed, false);

    // Edit Q1 BEFORE moving to Q2: Team 2 also answered A -> Team 1 & Team 2 tied at 10 ("Đồng hạng")
    const editRes = editCurrentReflexMathTurn(state, {
      team_1: 'A',
      team_2: 'A',
      team_3: 'no_answer',
    });
    assert.equal(editRes.edited, true);
    state = editRes.nextState;

    let standings = computeMathStandingsFromHistory(state);
    assert.equal(standings[0].points, E03_POINTS_PER_CORRECT);
    assert.equal(standings[1].points, E03_POINTS_PER_CORRECT);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[1].rank, 1);
    assert.equal(standings[0].isTied, true);
    assert.equal(standings[1].isTied, true);
    assert.equal(standings[2].rank, 3);
    assert.equal(standings[2].points, 0);
    assert.equal(standings[2].noAnswerCount, 1);

    // Advance to Q2 (correct is B: 5/6)
    state = advanceReflexMathQuestion(state);
    assert.equal(state.currentIndex, 1);
    const res2 = commitReflexMathTurn(state, {
      team_1: 'B',
      team_2: 'C',
      team_3: 'B',
    });
    assert.equal(res2.committed, true);
    state = advanceReflexMathQuestion(res2.nextState);
    assert.equal(state.status, 'finished');

    standings = computeMathStandingsFromHistory(state);
    assert.equal(standings[0].id, 'team_1');
    assert.equal(standings[0].points, 20);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[0].isTied, false);
    assert.equal(standings[1].points, 10);
    assert.equal(standings[2].points, 10);
    assert.equal(standings[1].rank, 2);
    assert.equal(standings[2].rank, 2);
    assert.equal(standings[1].isTied, true);
    assert.equal(standings[2].isTied, true);
  });

  it('6. Smart EDU RBAC bank adapter enforces permissions, deduplicates, and warns cleanly when bank < requested', () => {
    const mockBank: Question[] = [
      {
        id: 'b1',
        code: 'M01',
        subject: 'math',
        grade: '6',
        chapter: 'Số học',
        lesson: 'Bài 1',
        level: 'know',
        textbook: 'Kết nối tri thức',
        points: 1,
        author: 'GV',
        version: 1,
        type: 'single_choice',
        stem: 'Tính \\(2+3\\)',
        options: [
          { id: 'o1', label: 'A', text: '\\(5\\)' },
          { id: 'o2', label: 'B', text: '\\(6\\)' },
          { id: 'o3', label: 'C', text: '\\(4\\)' },
          { id: 'o4', label: 'D', text: '\\(7\\)' },
        ],
        correctAnswer: 'A',
        explanation: '2 + 3 = 5',
        status: 'approved',
      },
      {
        id: 'b2',
        code: 'M02',
        subject: 'math',
        grade: '6',
        chapter: 'Số học',
        lesson: 'Bài 2',
        level: 'know',
        textbook: 'Kết nối tri thức',
        points: 1,
        author: 'GV',
        version: 1,
        type: 'single_choice',
        stem: 'Tính \\(4+5\\)',
        options: [
          { id: 'o1', label: 'A', text: '\\(9\\)' },
          { id: 'o2', label: 'B', text: '\\(8\\)' },
          { id: 'o3', label: 'C', text: '\\(10\\)' },
          { id: 'o4', label: 'D', text: '\\(7\\)' },
        ],
        correctAnswer: 'A',
        explanation: '4 + 5 = 9',
        status: 'pending',
      },
      {
        id: 'b3',
        code: 'M03',
        subject: 'math',
        grade: '6',
        chapter: 'Số học',
        lesson: 'Bài 3',
        level: 'know',
        textbook: 'Kết nối tri thức',
        points: 1,
        author: 'GV',
        version: 1,
        type: 'single_choice',
        stem: 'Câu đã hủy',
        options: [
          { id: 'o1', label: 'A', text: '1' },
          { id: 'o2', label: 'B', text: '2' },
          { id: 'o3', label: 'C', text: '3' },
          { id: 'o4', label: 'D', text: '4' },
        ],
        correctAnswer: 'A',
        explanation: '',
        status: 'deprecated',
      },
    ];

    const studentPool = buildE03MathQuestionPool({
      sourceKind: 'bank',
      bankQuestions: mockBank,
      userRole: 'student',
    });
    assert.equal(studentPool.length, 1);

    const teacherPool = buildE03MathQuestionPool({
      sourceKind: 'bank',
      bankQuestions: mockBank,
      userRole: 'teacher',
    });
    assert.equal(teacherPool.length, 2);

    const cfg = createDefaultReflexMathConfig('whole_class');
    cfg.sourceKind = 'bank';
    cfg.questionCount = 8;
    const validation = validateReflexMathSetup(cfg, teacherPool.length);
    assert.equal(validation.valid, true);
    assert.equal(validation.effectiveQuestionCount, 2);
    assert.ok(validation.warnings.length > 0);
  });

  it('7. Session persistence restores both modes, isolates /demo storage, and recovers from corrupt JSON', () => {
    const storage = createMemoryStorage();
    const signal = createInitialSignalState(createDefaultSignalConfig('solo'));
    const mathCfg = createDefaultReflexMathConfig('solo');
    const math = createInitialReflexMathState({
      config: mathCfg,
      pool: buildE03MathQuestionPool({ sourceKind: 'sample' }),
    });

    // Save in production vs /demo
    saveE03Session({ activeMode: 'math', signalState: signal, mathState: math }, storage, false);
    saveE03Session({ activeMode: 'signal', signalState: signal, mathState: null }, storage, true);

    assert.notEqual(getE03StorageKey(false), getE03StorageKey(true));
    const prodLoaded = loadE03Session(storage, false);
    const demoLoaded = loadE03Session(storage, true);
    assert.equal(prodLoaded?.activeMode, 'math');
    assert.equal(demoLoaded?.activeMode, 'signal');

    // Corrupt JSON self-heals
    storage.setItem(getE03StorageKey(true), '{bad json');
    assert.equal(loadE03Session(storage, true), null);
    assert.equal(storage.getItem(getE03StorageKey(true)), null);

    clearE03Session(storage, false);
    assert.equal(loadE03Session(storage, false), null);
  });

  it('8. E03 EduGameSoundBank cues degrade safely when muted/headless and honor turn tokens', () => {
    const bank = new EduGameSoundBank();
    bank.setActiveTurnToken('e03_t1');
    assert.doesNotThrow(() => {
      bank.playReflexGoCue(false, 'e03_t1');
      bank.playReflexEarlyCue(false, 'e03_t1');
      bank.playReflexResultCue(false, 'e03_t1');
      bank.playReflexSummaryFanfare(false, 'e03_t1');
      // Muted & stale token calls
      bank.playReflexGoCue(true, 'e03_t1');
      bank.playReflexGoCue(false, 'e03_stale');
      bank.stopAll();
      bank.dispose();
    });
  });
});
