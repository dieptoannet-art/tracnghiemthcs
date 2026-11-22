import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import {
  D08_BASE_POINTS,
  D08_SAMPLE_QUESTIONS,
  D08_SAMPLE_RESERVE,
  D08_SESSION_STORAGE_KEY,
  adaptBankQuestionsForD08,
  advanceToNextQuestion,
  areAllActiveTeamsMarked,
  cancelCurrentQuestionForError,
  clearD08Session,
  commitCurrentRound,
  computeArenaRankings,
  computeArenaTeamStats,
  endArenaMatchEarly,
  getD08StorageKey,
  getMaxPossibleScore,
  loadD08Session,
  openCurrentQuestion,
  saveD08Session,
  setTeamRoundMark,
  setTeamSelectedOption,
  startArenaMatch,
  startEditingLastCommittedRound,
  stopAnsweringPhase,
  tickArenaTimerOneSecond,
  toggleArenaPause,
  toggleTeamPendingDouble,
} from './fourTeamsArena3dEngine';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function extractLatexSegments(text: string): { tex: string; displayMode: boolean }[] {
  const segments: { tex: string; displayMode: boolean }[] = [];
  const regex = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1];
    if (raw.startsWith('\\[')) {
      segments.push({ tex: raw.slice(2, -2), displayMode: true });
    } else {
      segments.push({ tex: raw.slice(2, -2), displayMode: false });
    }
  }
  return segments;
}

test('D08 #1: Prompt acceptance walkthrough — A & C Double; A right, B right, C wrong, D no answer => +20, +10, 0, 0; input order invariant; Double locked on open', () => {
  const start = startArenaMatch(
    { playMode: 'four_teams', requestedQuestionCount: 12, timerSeconds: 30, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS,
    D08_SAMPLE_RESERVE
  );
  assert.equal(start.error, null);
  let state = start.state;
  assert.equal(state.phase, 'pre_open');

  // Toggle Double for A and C BEFORE opening question
  const tA = toggleTeamPendingDouble(state, 'A');
  assert.equal(tA.changed, true);
  state = tA.state;
  const tC = toggleTeamPendingDouble(state, 'C');
  assert.equal(tC.changed, true);
  state = tC.state;

  // Open question -> locks Double immediately
  state = openCurrentQuestion(state);
  assert.equal(state.phase, 'answering');
  assert.equal(state.lockedDoubles.A, true);
  assert.equal(state.lockedDoubles.B, false);
  assert.equal(state.lockedDoubles.C, true);
  assert.equal(state.lockedDoubles.D, false);

  // Attempting to toggle Double after opening MUST be rejected
  const lateToggle = toggleTeamPendingDouble(state, 'B');
  assert.equal(lateToggle.changed, false);

  // Stop answering -> scoring phase
  state = stopAnsweringPhase(state);
  assert.equal(state.phase, 'scoring');

  // Mark teams in non-alphabetical order (D -> B -> C -> A) to verify input order invariance
  state = setTeamRoundMark(state, 'D', 'no_answer');
  state = setTeamRoundMark(state, 'B', 'correct');
  state = setTeamRoundMark(state, 'C', 'wrong');
  assert.equal(areAllActiveTeamsMarked(state), false);
  state = setTeamRoundMark(state, 'A', 'correct');
  assert.equal(areAllActiveTeamsMarked(state), true);

  const commit = commitCurrentRound(state);
  assert.equal(commit.committed, true);
  assert.equal(commit.anyScored, true);
  assert.equal(commit.hasDoubleWinner, true);
  state = commit.state;

  const stats = computeArenaTeamStats(state);
  const byId = Object.fromEntries(stats.map((s) => [s.teamId, s]));
  assert.equal(byId.A.score, 20);
  assert.equal(byId.B.score, 10);
  assert.equal(byId.C.score, 0);
  assert.equal(byId.D.score, 0);

  // Both A and C consumed their Double (even though C answered wrong!)
  assert.equal(byId.A.doubleAvailable, false);
  assert.equal(byId.A.doubleUsedOnRound, 1);
  assert.equal(byId.C.doubleAvailable, false);
  assert.equal(byId.C.doubleUsedOnRound, 1);
  // B and D still have Double available
  assert.equal(byId.B.doubleAvailable, true);
  assert.equal(byId.D.doubleAvailable, true);

  // Advance to Q2 -> A and C cannot select Double anymore
  state = advanceToNextQuestion(state);
  assert.equal(state.phase, 'pre_open');
  assert.equal(toggleTeamPendingDouble(state, 'A').changed, false);
  assert.equal(toggleTeamPendingDouble(state, 'C').changed, false);
  assert.equal(toggleTeamPendingDouble(state, 'B').changed, true);
});

test('D08 #2: Max score 130 (Double ON) vs 120 (Double OFF), simultaneous all-4 correct, tie ranking (Đồng hạng) & Early Finish', () => {
  assert.equal(getMaxPossibleScore(12, true), 130);
  assert.equal(getMaxPossibleScore(12, false), 120);
  assert.equal(D08_BASE_POINTS, 10);

  const start = startArenaMatch(
    { playMode: 'four_teams', requestedQuestionCount: 12, timerSeconds: 0, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS,
    D08_SAMPLE_RESERVE
  );
  let state = start.state;

  // All 4 teams Double on Q1 and all 4 answer correctly -> +20 each
  for (const tid of ['A', 'B', 'C', 'D'] as const) {
    state = toggleTeamPendingDouble(state, tid).state;
  }
  state = openCurrentQuestion(state);
  state = stopAnsweringPhase(state);
  const q1 = state.activeDeck[0];
  for (const tid of ['A', 'B', 'C', 'D'] as const) {
    state = setTeamSelectedOption(state, tid, q1.correctOptionId!);
  }
  state = commitCurrentRound(state).state;

  // Remaining 11 questions: all 4 teams answer correctly -> +10 each => 130 total each (4-way tie)
  for (let i = 1; i < 12; i++) {
    state = advanceToNextQuestion(state);
    state = openCurrentQuestion(state);
    state = stopAnsweringPhase(state);
    const qi = state.activeDeck[state.currentDeckIndex];
    for (const tid of ['A', 'B', 'C', 'D'] as const) {
      state = setTeamSelectedOption(state, tid, qi.correctOptionId!);
    }
    state = commitCurrentRound(state).state;
  }

  state = advanceToNextQuestion(state);
  assert.equal(state.phase, 'finished');
  assert.equal(state.endedEarly, false);

  const rankings = computeArenaRankings(state);
  assert.equal(rankings.length, 4);
  for (const r of rankings) {
    assert.equal(r.score, 130);
    assert.equal(r.rank, 1);
    assert.equal(r.isTied, true);
  }

  // Verify partial tie + early finish (e.g., A=20, B=10, C=10, D=0)
  let s2 = startArenaMatch(
    { playMode: 'four_teams', requestedQuestionCount: 12, timerSeconds: 30, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS
  ).state;
  s2 = toggleTeamPendingDouble(s2, 'A').state;
  s2 = openCurrentQuestion(s2);
  s2 = stopAnsweringPhase(s2);
  s2 = setTeamRoundMark(s2, 'A', 'correct');
  s2 = setTeamRoundMark(s2, 'B', 'correct');
  s2 = setTeamRoundMark(s2, 'C', 'correct');
  s2 = setTeamRoundMark(s2, 'D', 'wrong');
  s2 = commitCurrentRound(s2).state;
  s2 = endArenaMatchEarly(s2);
  assert.equal(s2.phase, 'finished');
  assert.equal(s2.endedEarly, true);

  const r2 = computeArenaRankings(s2);
  assert.deepEqual(
    r2.map((x) => ({ id: x.teamId, score: x.score, rank: x.rank, tied: x.isTied })),
    [
      { id: 'A', score: 20, rank: 1, tied: false },
      { id: 'B', score: 10, rank: 2, tied: true },
      { id: 'C', score: 10, rank: 2, tied: true },
      { id: 'D', score: 0, rank: 4, tied: false },
    ]
  );
});

test('D08 #3: Practice mode (< 4 students / solo 1 student) — single shared scoreboard, zero fake opponent teams, Double disabled', () => {
  const { state: initState, error } = startArenaMatch(
    { playMode: 'practice', classSizeHint: 1, requestedQuestionCount: 4, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS
  );
  assert.equal(error, null);
  assert.equal(initState.config.doublePowerEnabled, false);

  let state = initState;
  const stats0 = computeArenaTeamStats(state);
  assert.equal(stats0.length, 1);
  assert.equal(stats0[0].teamId, 'A');
  assert.equal(stats0[0].name, 'Bảng điểm chung');
  assert.equal(stats0[0].doubleAvailable, false);

  // Double toggle is a no-op in practice mode
  assert.equal(toggleTeamPendingDouble(state, 'A').changed, false);

  state = openCurrentQuestion(state);
  state = stopAnsweringPhase(state);
  state = setTeamRoundMark(state, 'A', 'correct');
  assert.equal(areAllActiveTeamsMarked(state), true);
  const res = commitCurrentRound(state);
  assert.equal(res.committed, true);
  const stats1 = computeArenaTeamStats(res.state);
  assert.equal(stats1.length, 1);
  assert.equal(stats1[0].score, 10);
});

test('D08 #4: Edit just-committed round recalculates totals cleanly preserving locked Doubles; anti-double-click & Pause guard', () => {
  let state = startArenaMatch(
    { playMode: 'four_teams', requestedQuestionCount: 6, timerSeconds: 2, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS
  ).state;

  state = toggleTeamPendingDouble(state, 'A').state;
  state = openCurrentQuestion(state);

  // Pause preserves timer & blocks timer ticks
  state = toggleArenaPause(state);
  assert.equal(state.isPaused, true);
  const pausedTick = tickArenaTimerOneSecond(state);
  assert.equal(pausedTick.state.timeRemainingSec, 2);
  assert.equal(pausedTick.expiredNow, false);

  // Unpause & let timer expire -> auto-transitions to scoring
  state = toggleArenaPause(state);
  state = tickArenaTimerOneSecond(state).state;
  assert.equal(state.timeRemainingSec, 1);
  const exp = tickArenaTimerOneSecond(state);
  assert.equal(exp.expiredNow, true);
  state = exp.state;
  assert.equal(state.phase, 'scoring');

  // Mark teams
  state = setTeamRoundMark(state, 'A', 'wrong');
  state = setTeamRoundMark(state, 'B', 'correct');
  state = setTeamRoundMark(state, 'C', 'no_answer');
  state = setTeamRoundMark(state, 'D', 'wrong');

  // Pause blocks commitCurrentRound
  state = toggleArenaPause(state);
  const blockedCommit = commitCurrentRound(state);
  assert.equal(blockedCommit.committed, false);
  state = toggleArenaPause(state);

  // Commit once
  const firstCommit = commitCurrentRound(state);
  assert.equal(firstCommit.committed, true);
  state = firstCommit.state;
  // Duplicate commit (anti-double-click) is blocked
  const dupCommit = commitCurrentRound(state);
  assert.equal(dupCommit.committed, false);

  // Before edit: A=0 (used Double), B=10, C=0, D=0
  let byId = Object.fromEntries(computeArenaTeamStats(state).map((s) => [s.teamId, s]));
  assert.equal(byId.A.score, 0);
  assert.equal(byId.B.score, 10);
  assert.equal(byId.A.doubleAvailable, false);

  // Edit just-committed round: fix A -> correct (still Double => +20!), fix B -> wrong (0)
  state = startEditingLastCommittedRound(state);
  assert.equal(state.editingLastCommitted, true);
  state = setTeamRoundMark(state, 'A', 'correct');
  state = setTeamRoundMark(state, 'B', 'wrong');
  const edited = commitCurrentRound(state);
  assert.equal(edited.committed, true);
  state = edited.state;
  assert.equal(state.editingLastCommitted, false);
  assert.equal(state.validRoundsCompleted, 1); // Did NOT increment round count!

  byId = Object.fromEntries(computeArenaTeamStats(state).map((s) => [s.teamId, s]));
  assert.equal(byId.A.score, 20);
  assert.equal(byId.B.score, 0);
  assert.equal(byId.A.doubleAvailable, false);
});

test('D08 #5: Cancel faulty question records reason in history, REFUNDS consumed Double, and pulls unseen replacement without repeats', () => {
  let state = startArenaMatch(
    { playMode: 'four_teams', requestedQuestionCount: 12, timerSeconds: 30, doublePowerEnabled: true },
    D08_SAMPLE_QUESTIONS,
    D08_SAMPLE_RESERVE
  ).state;

  const originalQ1Id = state.activeDeck[0].id;
  // Team A & D lock Double on Q1
  state = toggleTeamPendingDouble(state, 'A').state;
  state = toggleTeamPendingDouble(state, 'D').state;
  state = openCurrentQuestion(state);

  // While open, Double is consumed
  let byId = Object.fromEntries(computeArenaTeamStats(state).map((s) => [s.teamId, s]));
  assert.equal(byId.A.doubleAvailable, false);
  assert.equal(byId.D.doubleAvailable, false);

  // Teacher cancels Q1 due to faulty text/image
  const cancelled = cancelCurrentQuestionForError(state, 'Đề bị thiếu dữ kiện góc');
  assert.equal(cancelled.replaced, true);
  state = cancelled.state;
  assert.equal(state.phase, 'pre_open');
  assert.equal(state.validRoundsCompleted, 0);

  // Replacement came from reserveDeck and is NOT the cancelled question
  assert.equal(state.activeDeck[0].id, D08_SAMPLE_RESERVE[0].id);
  assert.notEqual(state.activeDeck[0].id, originalQ1Id);
  assert.equal(new Set(state.activeDeck.map((q) => q.id)).size, state.activeDeck.length);

  // History has explicit cancelled record with reason & 0 points
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].cancelled, true);
  assert.equal(state.history[0].cancelReason, 'Đề bị thiếu dữ kiện góc');

  // Double power MUST be refunded to both A and D!
  byId = Object.fromEntries(computeArenaTeamStats(state).map((s) => [s.teamId, s]));
  assert.equal(byId.A.doubleAvailable, true);
  assert.equal(byId.D.doubleAvailable, true);
  assert.equal(toggleTeamPendingDouble(state, 'A').changed, true);
});

test('D08 #6: Bank adapter enforces RBAC & deduplication; all 12 sample + 2 reserve KaTeX formulas compile cleanly', () => {
  const mockBank: Question[] = [
    {
      id: 'q_approved_1',
      type: 'single_choice',
      stem: 'Tính \\(\\frac{3}{4} + \\frac{1}{4}\\).',
      options: [
        { id: 'o1', label: 'A', text: '\\(1\\)' },
        { id: 'o2', label: 'B', text: '\\(2\\)' },
      ],
      correctAnswer: 'o1',
      status: 'approved',
      chapter: 'Phân số',
      explanation: '\\(\\frac{3+1}{4}=1\\)',
    } as Question,
    {
      id: 'q_approved_1', // duplicate ID
      type: 'single_choice',
      stem: 'Trùng mã',
      options: [
        { id: 'o1', label: 'A', text: '1' },
        { id: 'o2', label: 'B', text: '2' },
      ],
      correctAnswer: 'o1',
      status: 'approved',
    } as Question,
    {
      id: 'q_draft_2',
      type: 'short_answer',
      stem: 'Giải \\(2x = 8\\).',
      acceptedAnswers: ['4'],
      status: 'draft',
    } as Question,
    {
      id: 'q_deprecated_3',
      type: 'short_answer',
      stem: 'Câu đã loại bỏ',
      acceptedAnswers: ['0'],
      status: 'deprecated',
    } as Question,
  ];

  // Student sees ONLY approved (deduped)
  const forStudent = adaptBankQuestionsForD08(mockBank, 'student');
  assert.deepEqual(
    forStudent.map((q) => q.id),
    ['q_approved_1']
  );

  // Teacher sees approved + draft, never deprecated, deduped
  const forTeacher = adaptBankQuestionsForD08(mockBank, 'teacher');
  assert.deepEqual(
    forTeacher.map((q) => q.id),
    ['q_approved_1', 'q_draft_2']
  );

  // Requesting 12 questions from a 2-question pool shrinks cleanly without repeats
  const shortMatch = startArenaMatch(
    { playMode: 'four_teams', questionSource: 'bank', requestedQuestionCount: 12 },
    forTeacher
  );
  assert.equal(shortMatch.error, null);
  assert.equal(shortMatch.state.activeDeck.length, 2);

  // Validate all 12 sample questions + 2 reserve questions compile in KaTeX with throwOnError: true
  assert.equal(D08_SAMPLE_QUESTIONS.length, 12);
  assert.equal(D08_SAMPLE_RESERVE.length, 2);
  const allSample = [...D08_SAMPLE_QUESTIONS, ...D08_SAMPLE_RESERVE];
  let formulaCount = 0;

  for (const q of allSample) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
    const fields = [
      q.stemLatex,
      q.answerLatex,
      q.hintLatex,
      q.explanationLatex,
      ...q.options.map((o) => o.textLatex),
    ];
    for (const f of fields) {
      const segs = extractLatexSegments(f);
      for (const seg of segs) {
        formulaCount += 1;
        const html = katex.renderToString(seg.tex, {
          displayMode: seg.displayMode,
          throwOnError: true,
        });
        assert.ok(html.includes('katex'), `KaTeX failed for ${q.id}: ${seg.tex}`);
      }
    }
  }
  assert.ok(formulaCount >= 50, `Expected >= 50 verified LaTeX segments, got ${formulaCount}`);
});

test('D08 #7: Persistence isolates /demo storage, restores exact deck/scores/Doubles without double-counting, recovers corrupt JSON & audio cues degrade safely', () => {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const normalStorage = createMemoryStorage();
  const demoStorage = createMemoryStorage();

  try {
    // 1. Normal route
    (globalThis as Record<string, unknown>).window = {
      localStorage: normalStorage,
      location: { pathname: '/teacher/games' },
    };
    assert.equal(getD08StorageKey(), D08_SESSION_STORAGE_KEY);

    let state = startArenaMatch(
      { playMode: 'four_teams', requestedQuestionCount: 12, timerSeconds: 30, doublePowerEnabled: true },
      D08_SAMPLE_QUESTIONS,
      D08_SAMPLE_RESERVE
    ).state;
    state = toggleTeamPendingDouble(state, 'B').state;
    state = openCurrentQuestion(state);
    state = stopAnsweringPhase(state);
    state = setTeamRoundMark(state, 'A', 'correct');
    state = setTeamRoundMark(state, 'B', 'correct');
    state = setTeamRoundMark(state, 'C', 'wrong');
    state = setTeamRoundMark(state, 'D', 'no_answer');
    state = commitCurrentRound(state).state;
    saveD08Session(state);

    const restored = loadD08Session();
    assert.ok(restored);
    const stats = computeArenaTeamStats(restored.state);
    const byId = Object.fromEntries(stats.map((s) => [s.teamId, s]));
    assert.equal(byId.A.score, 10);
    assert.equal(byId.B.score, 20);
    assert.equal(byId.B.doubleAvailable, false);
    assert.equal(restored.state.activeDeck.length, 12);
    // Re-committing already committed round after restore MUST NOT double-count!
    assert.equal(commitCurrentRound(restored.state).committed, false);

    // 2. /demo isolation check
    (globalThis as Record<string, unknown>).window = {
      localStorage: demoStorage,
      location: { pathname: '/demo' },
    };
    assert.equal(getD08StorageKey(), `${KHKT_DEMO_STORAGE_PREFIX}${D08_SESSION_STORAGE_KEY}`);
    assert.equal(loadD08Session(), null);
    saveD08Session(state);
    assert.ok(demoStorage.getItem(`${KHKT_DEMO_STORAGE_PREFIX}${D08_SESSION_STORAGE_KEY}`));
    assert.equal(demoStorage.getItem(D08_SESSION_STORAGE_KEY), null);

    // 3. Corrupt JSON recovery
    demoStorage.setItem(getD08StorageKey(), '{corrupt-json');
    assert.equal(loadD08Session(), null);
    assert.equal(demoStorage.getItem(getD08StorageKey()), null);

    clearD08Session();

    // 4. Audio controller D08 cues degrade safely in headless/muted environments
    const soundBank = new EduGameSoundBank();
    assert.doesNotThrow(() => {
      soundBank.playArenaOpenQuestion(true);
      soundBank.playArenaDoubleLock(true);
      soundBank.playArenaScoreAward(true, true);
      soundBank.playArenaSummaryFanfare(true);
      soundBank.playArenaOpenQuestion(false);
      soundBank.playArenaDoubleLock(false);
      soundBank.playArenaScoreAward(false, false);
      soundBank.playArenaSummaryFanfare(false);
      soundBank.stopAll();
    });
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});
