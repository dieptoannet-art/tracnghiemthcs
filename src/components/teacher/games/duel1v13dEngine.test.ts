import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';

import {
  D01_SAMPLE_INFO_MAIN,
  D01_SAMPLE_INFO_TIEBREAKERS,
  D01_SAMPLE_MATH_MAIN,
  D01_SAMPLE_MATH_TIEBREAKERS,
  D01_SAMPLE_PLAYER_PRESETS,
  D01_SESSION_STORAGE_KEY,
  adaptBankQuestionsForD01,
  advanceDuelAfterConfirm,
  checkDuelDeadline,
  claimBuzzerRight,
  clearD01Session,
  computeDuelScoreboard,
  confirmDuelRoundResult,
  endDuelMatchEarly,
  getD01StorageKey,
  getRemainingTimeMs,
  loadD01Session,
  lockSimultaneousAnswers,
  matchDeclaredShortAnswer,
  openDuelQuestion,
  pauseDuelMatch,
  prepareQuestionOptionsOnce,
  resolveBuzzerAttempt,
  resumeDuelMatch,
  revealAndPrepareScoring,
  rollbackToPreviousRound,
  saveD01Session,
  setSideDraftMark,
  skipBuzzerNoClaim,
  startBuzzerResponsePhase,
  startDuelMatch,
  startEditingLastConfirmedRound,
  teacherOverrideBuzzerSide,
  validateContestants,
} from './duel1v13dEngine';
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
    segments.push({
      tex: raw.slice(2, -2),
      displayMode: raw.startsWith('\\['),
    });
  }
  return segments;
}

test('D01 #1: Simultaneous mode — both right (+10,+10), one right, both wrong, both no_answer; unmarked NOT wrong; cannot reveal before both locked/marked; max 100 pts on 10Q', () => {
  const { state: s0, error } = startDuelMatch(
    { playStyle: 'duel_2_sides', answerMode: 'simultaneous', requestedMainCount: 10, pointsPerQuestion: 10, timerSeconds: 30 },
    D01_SAMPLE_MATH_MAIN,
    D01_SAMPLE_MATH_TIEBREAKERS
  );
  assert.equal(error, null);

  let state = openDuelQuestion(s0, 1000);
  state = lockSimultaneousAnswers(state, 5000).state;

  // Only Side A marked -> reveal MUST be blocked (unmarked B is NOT treated as wrong!)
  state = setSideDraftMark(state, 'A', 'correct');
  const blockedReveal = revealAndPrepareScoring(state);
  assert.equal(blockedReveal.revealed, false);
  assert.equal(state.phase, 'locked');

  // Mark Side B correct too -> both earn 10 pts!
  state = setSideDraftMark(state, 'B', 'correct');
  const rev1 = revealAndPrepareScoring(state);
  assert.equal(rev1.revealed, true);
  state = rev1.state;

  const c1 = confirmDuelRoundResult(state, state.turnToken);
  assert.equal(c1.confirmed, true);
  state = c1.state;
  // Double-click confirm MUST NOT double-score!
  assert.equal(confirmDuelRoundResult(state, state.turnToken).confirmed, false);

  let sb = computeDuelScoreboard(state);
  assert.equal(sb.mainScoreA, 10);
  assert.equal(sb.mainScoreB, 10);

  // Q2: A right, B wrong -> +10, 0
  state = advanceDuelAfterConfirm(state);
  state = openDuelQuestion(state, 10000);
  state = lockSimultaneousAnswers(state, 12000).state;
  state = setSideDraftMark(state, 'A', 'correct');
  state = setSideDraftMark(state, 'B', 'wrong');
  state = revealAndPrepareScoring(state).state;
  state = confirmDuelRoundResult(state, state.turnToken).state;

  // Q3: Both wrong -> 0, 0
  state = advanceDuelAfterConfirm(state);
  state = openDuelQuestion(state, 20000);
  state = lockSimultaneousAnswers(state, 22000).state;
  state = setSideDraftMark(state, 'A', 'wrong');
  state = setSideDraftMark(state, 'B', 'wrong');
  state = revealAndPrepareScoring(state).state;
  state = confirmDuelRoundResult(state, state.turnToken).state;

  // Q4: Both no_answer -> 0, 0
  state = advanceDuelAfterConfirm(state);
  state = openDuelQuestion(state, 30000);
  state = lockSimultaneousAnswers(state, 32000).state;
  state = setSideDraftMark(state, 'A', 'no_answer');
  state = setSideDraftMark(state, 'B', 'no_answer');
  state = revealAndPrepareScoring(state).state;
  state = confirmDuelRoundResult(state, state.turnToken).state;

  sb = computeDuelScoreboard(state);
  assert.equal(sb.mainScoreA, 20);
  assert.equal(sb.mainScoreB, 10);
  assert.deepEqual(sb.statsA, { correct: 2, wrong: 1, noAnswer: 1 });
  assert.deepEqual(sb.statsB, { correct: 1, wrong: 2, noAnswer: 1 });

  // Verify 10/10 both right => 100 pts each & tie (Đồng hạng) when tie-breaker is OFF
  let perfect = startDuelMatch(
    { playStyle: 'duel_2_sides', answerMode: 'simultaneous', requestedMainCount: 10, pointsPerQuestion: 10, tieBreakerEnabled: false },
    D01_SAMPLE_MATH_MAIN
  ).state;
  for (let i = 0; i < 10; i++) {
    perfect = openDuelQuestion(perfect, i * 1000);
    perfect = lockSimultaneousAnswers(perfect, i * 1000 + 500).state;
    perfect = setSideDraftMark(perfect, 'A', 'correct');
    perfect = setSideDraftMark(perfect, 'B', 'correct');
    perfect = revealAndPrepareScoring(perfect).state;
    perfect = confirmDuelRoundResult(perfect, perfect.turnToken).state;
    perfect = advanceDuelAfterConfirm(perfect);
  }
  assert.equal(perfect.phase, 'summary');
  const perfSb = computeDuelScoreboard(perfect);
  assert.equal(perfSb.mainScoreA, 100);
  assert.equal(perfSb.mainScoreB, 100);
  assert.equal(perfSb.outcome, 'tie');
});

test('D01 #2: Buzzer mode — order, transfer on wrong/timeout, stale turnToken rejected, near-tie teacher resolution, no bonus just because rival missed', () => {
  let state = startDuelMatch(
    {
      playStyle: 'duel_2_sides',
      answerMode: 'buzzer',
      buzzerSource: 'shared_keyboard',
      requestedMainCount: 5,
      pointsPerQuestion: 10,
      buzzerAnswerSeconds: 15,
    },
    D01_SAMPLE_MATH_MAIN
  ).state;

  state = openDuelQuestion(state, 1000);
  assert.equal(state.phase, 'buzzer_open');
  const q1Token = state.turnToken;

  // Reject stale callback from wrong token
  const stale = claimBuzzerRight(state, 'A', 'stale_token_999', 1100, 'shared_keyboard');
  assert.equal(stale.accepted, false);

  // Side A claims at 1100ms, Side B claims at 1180ms (within 180ms near-tie window!)
  const cA = claimBuzzerRight(state, 'A', q1Token, 1100, 'shared_keyboard');
  assert.equal(cA.accepted, true);
  state = cA.state;

  const cB = claimBuzzerRight(state, 'B', q1Token, 1180, 'shared_keyboard');
  assert.equal(cB.nearTieTriggered, true);
  state = cB.state;
  assert.equal(state.nearTiePending, true);

  // Teacher decides "Không phân định — hỏi lại" (null), then awards Side A cleanly
  state = teacherOverrideBuzzerSide(state, null);
  assert.equal(state.activeBuzzerSide, null);
  state = claimBuzzerRight(state, 'A', q1Token, 2000, 'teacher_manual').state;
  state = startBuzzerResponsePhase(state, 2100);
  assert.equal(state.phase, 'answering');

  // Side A answers WRONG -> transfers right to Side B (Side B gets 0 pts until B actually answers right!)
  const missA = resolveBuzzerAttempt(state, 'wrong', null, q1Token, 3000);
  assert.equal(missA.transferredTo, 'B');
  assert.equal(missA.resolvedToScoring, false);
  state = missA.state;
  assert.equal(state.phase, 'buzzer_open');
  assert.equal(state.activeBuzzerSide, 'B');
  assert.equal(computeDuelScoreboard(state).mainScoreB, 0);

  // Side B starts answering and times out -> moves to scoring with 0 pts for BOTH!
  state = startBuzzerResponsePhase(state, 3500);
  const timeoutB = checkDuelDeadline(state, 3500 + 16000);
  assert.equal(timeoutB.expired, true);
  state = timeoutB.state;
  assert.equal(state.phase, 'scoring');

  state = confirmDuelRoundResult(state, q1Token).state;
  assert.equal(computeDuelScoreboard(state).mainScoreA, 0);
  assert.equal(computeDuelScoreboard(state).mainScoreB, 0);

  // Advance to Q2: stale Q1 token MUST NOT claim Q2!
  state = advanceDuelAfterConfirm(state);
  state = openDuelQuestion(state, 25000);
  assert.equal(claimBuzzerRight(state, 'B', q1Token, 25100, 'teacher_manual').accepted, false);

  // Side B claims Q2 and answers RIGHT -> +10 for B, 0 for A, no transfer
  state = claimBuzzerRight(state, 'B', state.turnToken, 25200, 'teacher_manual').state;
  state = startBuzzerResponsePhase(state, 25300);
  const rightB = resolveBuzzerAttempt(state, 'correct', null, state.turnToken, 26000);
  assert.equal(rightB.transferredTo, null);
  assert.equal(rightB.resolvedToScoring, true);
  state = confirmDuelRoundResult(rightB.state, rightB.state.turnToken).state;
  assert.equal(computeDuelScoreboard(state).mainScoreB, 10);
  assert.equal(computeDuelScoreboard(state).mainScoreA, 0);

  // Q3: Neither side claims -> skipBuzzerNoClaim => 0, 0
  state = advanceDuelAfterConfirm(state);
  state = openDuelQuestion(state, 30000);
  state = skipBuzzerNoClaim(state);
  state = confirmDuelRoundResult(state, state.turnToken).state;
  assert.equal(computeDuelScoreboard(state).mainScoreA, 0);
  assert.equal(computeDuelScoreboard(state).mainScoreB, 10);
});

test('D01 #3: Tie-breaker separates score from main round, resolves on single winner, and caps cleanly at maxTieBreakers (no infinite loop)', () => {
  // Case A: Tie-breaker ends on TB2 when Side A wins TB2 while main stays 50-50
  let s = startDuelMatch(
    {
      playStyle: 'duel_2_sides',
      answerMode: 'simultaneous',
      requestedMainCount: 5,
      pointsPerQuestion: 10,
      tieBreakerEnabled: true,
      maxTieBreakers: 3,
    },
    D01_SAMPLE_MATH_MAIN,
    D01_SAMPLE_MATH_TIEBREAKERS
  ).state;

  // Verify main & tie-breaker IDs are strictly disjoint!
  const mainIds = new Set(s.mainDeck.map((q) => q.questionId));
  for (const tb of s.tieBreakerDeck) {
    assert.equal(mainIds.has(tb.questionId), false);
  }

  // Play 5 main questions: all 5 both right => 50-50
  for (let i = 0; i < 5; i++) {
    s = openDuelQuestion(s, i * 1000);
    s = lockSimultaneousAnswers(s, i * 1000 + 200).state;
    s = setSideDraftMark(s, 'A', 'correct');
    s = setSideDraftMark(s, 'B', 'correct');
    s = revealAndPrepareScoring(s).state;
    s = confirmDuelRoundResult(s, s.turnToken).state;
    s = advanceDuelAfterConfirm(s);
  }
  assert.equal(s.inTieBreaker, true);
  assert.equal(s.phase, 'ready');

  // TB1: both right -> continues to TB2
  s = openDuelQuestion(s, 10000);
  s = lockSimultaneousAnswers(s, 10500).state;
  s = setSideDraftMark(s, 'A', 'correct');
  s = setSideDraftMark(s, 'B', 'correct');
  s = revealAndPrepareScoring(s).state;
  s = confirmDuelRoundResult(s, s.turnToken).state;
  s = advanceDuelAfterConfirm(s);
  assert.equal(s.inTieBreaker, true);
  assert.equal(s.currentQuestionIndex, 1);

  // TB2: A right, B wrong -> ends immediately with A_wins_tiebreaker; main stays 50-50!
  s = openDuelQuestion(s, 20000);
  s = lockSimultaneousAnswers(s, 20500).state;
  s = setSideDraftMark(s, 'A', 'correct');
  s = setSideDraftMark(s, 'B', 'wrong');
  s = revealAndPrepareScoring(s).state;
  s = confirmDuelRoundResult(s, s.turnToken).state;
  s = advanceDuelAfterConfirm(s);

  assert.equal(s.phase, 'summary');
  const sb = computeDuelScoreboard(s);
  assert.equal(sb.mainScoreA, 50);
  assert.equal(sb.mainScoreB, 50);
  assert.equal(sb.tieBreakerScoreA, 20);
  assert.equal(sb.tieBreakerScoreB, 10);
  assert.equal(sb.outcome, 'A_wins_tiebreaker');

  // Case B: Max 2 tie-breakers both tied -> ends cleanly as Đồng thắng (never infinite!)
  let sCap = startDuelMatch(
    { requestedMainCount: 5, pointsPerQuestion: 10, tieBreakerEnabled: true, maxTieBreakers: 2 },
    D01_SAMPLE_INFO_MAIN,
    D01_SAMPLE_INFO_TIEBREAKERS
  ).state;
  for (let i = 0; i < 7; i++) {
    sCap = openDuelQuestion(sCap, i * 1000);
    sCap = lockSimultaneousAnswers(sCap, i * 1000 + 200).state;
    sCap = setSideDraftMark(sCap, 'A', 'wrong');
    sCap = setSideDraftMark(sCap, 'B', 'wrong');
    sCap = revealAndPrepareScoring(sCap).state;
    sCap = confirmDuelRoundResult(sCap, sCap.turnToken).state;
    sCap = advanceDuelAfterConfirm(sCap);
  }
  assert.equal(sCap.phase, 'summary');
  const capSb = computeDuelScoreboard(sCap);
  assert.equal(capSb.tieBreakerPlayedCount, 2);
  assert.equal(capSb.outcome, 'tie');
  assert.ok(capSb.outcomeLabel.includes('Đồng thắng'));
});

test('D01 #4: Edit confirmed round, explicit rollback, simultaneous lock+timeout race, pause/resume deadline clock & early finish', () => {
  let state = startDuelMatch(
    { requestedMainCount: 5, timerSeconds: 10, pointsPerQuestion: 10 },
    D01_SAMPLE_MATH_MAIN
  ).state;

  // Open at t=1000 -> deadline = 11000
  state = openDuelQuestion(state, 1000);
  assert.equal(getRemainingTimeMs(state, 4000), 7000);

  // Pause at t=4000 (7000ms left), wait 60s (simulating tab switch/delay), resume at t=64000 -> STILL 7000ms left!
  state = pauseDuelMatch(state, 4000);
  assert.equal(state.isPaused, true);
  assert.equal(getRemainingTimeMs(state, 64000), 7000);
  state = resumeDuelMatch(state, 64000);
  assert.equal(state.isPaused, false);
  assert.equal(getRemainingTimeMs(state, 64000), 7000);

  // Simultaneous timeout + teacher lock at deadline t=71000 -> produces ONE single locked state
  const exp = checkDuelDeadline(state, 71000);
  assert.equal(exp.expired, true);
  state = exp.state;
  assert.equal(state.phase, 'locked');
  // Calling lockSimultaneousAnswers again after timeout is idempotent!
  const dupLock = lockSimultaneousAnswers(state, 71000);
  assert.equal(dupLock.lockedNow, false);
  state = dupLock.state;

  // Timeout NEVER auto-marks both sides wrong: teacher still grades mini-board answers!
  state = setSideDraftMark(state, 'A', 'wrong');
  state = setSideDraftMark(state, 'B', 'correct');
  state = revealAndPrepareScoring(state).state;
  state = confirmDuelRoundResult(state, state.turnToken).state;
  assert.equal(computeDuelScoreboard(state).mainScoreA, 0);
  assert.equal(computeDuelScoreboard(state).mainScoreB, 10);

  // Edit just-confirmed round: fix A -> correct, B -> wrong -> recomputes cleanly & logs editCount
  state = startEditingLastConfirmedRound(state);
  state = setSideDraftMark(state, 'A', 'correct');
  state = setSideDraftMark(state, 'B', 'wrong');
  state = confirmDuelRoundResult(state, state.turnToken).state;
  assert.equal(computeDuelScoreboard(state).mainScoreA, 10);
  assert.equal(computeDuelScoreboard(state).mainScoreB, 0);
  assert.equal(state.history[0].editCount, 1);

  // Advance to Q2, then test explicit rollback back to Q1
  state = advanceDuelAfterConfirm(state);
  assert.equal(state.currentQuestionIndex, 1);
  assert.equal(rollbackToPreviousRound(state, false).rolledBack, false);
  const rb = rollbackToPreviousRound(state, true);
  assert.equal(rb.rolledBack, true);
  state = rb.state;
  assert.equal(state.currentQuestionIndex, 0);
  assert.equal(state.history.length, 0);

  // Re-confirm Q1, then Early Finish -> unplayed Q2..Q5 are NOT counted as wrong!
  state = revealAndPrepareScoring(state).state;
  state = confirmDuelRoundResult(state, state.turnToken).state;
  state = endDuelMatchEarly(state);
  assert.equal(state.phase, 'summary');
  assert.equal(state.endedEarly, true);
  const sb = computeDuelScoreboard(state);
  assert.equal(sb.mainPlayedCount, 1);
  assert.equal(sb.statsA.wrong, 0);
  assert.ok(sb.outcomeLabel.includes('Trận kết thúc sớm'));
});

test('D01 #5: Contestant studentId uniqueness, 50-student class, 1-student solo modes, and 3 consecutive matches preserving completed archive', () => {
  // Reject duplicate studentId between A and B
  const dupCheck = validateContestants(
    'duel_2_sides',
    { ...D01_SAMPLE_PLAYER_PRESETS.sideA, studentId: 'stu_07', label: 'Nguyễn Văn A' },
    { ...D01_SAMPLE_PLAYER_PRESETS.sideB, studentId: 'stu_07', label: 'Nguyễn Văn A' }
  );
  assert.equal(dupCheck.valid, false);

  // Solo 1-person mode (no fake AI opponent)
  let solo = startDuelMatch(
    { playStyle: 'solo_single', requestedMainCount: 5, pointsPerQuestion: 10 },
    D01_SAMPLE_MATH_MAIN
  ).state;
  solo = openDuelQuestion(solo, 1000);
  solo = lockSimultaneousAnswers(solo, 2000).state;
  solo = setSideDraftMark(solo, 'A', 'correct');
  solo = revealAndPrepareScoring(solo).state;
  solo = confirmDuelRoundResult(solo, solo.turnToken).state;
  solo = endDuelMatchEarly(solo);
  assert.equal(computeDuelScoreboard(solo).outcome, 'solo_complete');
  assert.equal(computeDuelScoreboard(solo).mainScoreA, 10);

  // 3 consecutive matches with distinct pairs from a 50-student class -> archive keeps all 3!
  const roster50 = Array.from({ length: 50 }, (_, i) => ({
    id: `hs_${i + 1}`,
    label: `Học sinh ${i + 1}`,
  }));
  let archive = solo.completedMatches; // 1 completed match already
  for (let m = 0; m < 3; m++) {
    const pA = roster50[m * 2];
    const pB = roster50[m * 2 + 1];
    let st = startDuelMatch(
      {
        playStyle: 'duel_2_sides',
        requestedMainCount: 5,
        sideA: { ...D01_SAMPLE_PLAYER_PRESETS.sideA, studentId: pA.id, label: pA.label, isTempLabel: false },
        sideB: { ...D01_SAMPLE_PLAYER_PRESETS.sideB, studentId: pB.id, label: pB.label, isTempLabel: false },
      },
      D01_SAMPLE_MATH_MAIN,
      D01_SAMPLE_MATH_TIEBREAKERS,
      archive,
      `match_seq_${m + 1}`
    ).state;
    st = openDuelQuestion(st, 1000);
    st = lockSimultaneousAnswers(st, 2000).state;
    st = setSideDraftMark(st, 'A', 'correct');
    st = setSideDraftMark(st, 'B', 'wrong');
    st = revealAndPrepareScoring(st).state;
    st = confirmDuelRoundResult(st, st.turnToken).state;
    st = endDuelMatchEarly(st);
    archive = st.completedMatches;
  }
  assert.equal(archive.length, 4);
  assert.equal(archive[0].sideALabel, 'Học sinh 5');
  assert.equal(archive[0].sideBLabel, 'Học sinh 6');
});

test('D01 #6: RBAC bank adapter, optionId-locked shuffling, Unicode short-answer matching & KaTeX verification on all 26 Math + Info sample questions', () => {
  // RBAC filtering & deduplication
  const mockBank: Question[] = [
    {
      id: 'q1',
      type: 'single_choice',
      stem: 'Tính \\(2 + 3\\).',
      options: [
        { id: 'o1', label: 'A', text: '\\(5\\)' },
        { id: 'o2', label: 'B', text: '\\(6\\)' },
      ],
      correctAnswer: 'o1',
      status: 'approved',
    } as Question,
    {
      id: 'q2',
      type: 'short_answer',
      stem: 'Viết số nguyên tố nhỏ nhất.',
      acceptedAnswers: ['2'],
      status: 'draft',
    } as Question,
    {
      id: 'q3',
      type: 'short_answer',
      stem: 'Đã loại bỏ',
      acceptedAnswers: ['0'],
      status: 'deprecated',
    } as Question,
  ];
  assert.deepEqual(
    adaptBankQuestionsForD01(mockBank, 'student').map((q) => q.questionId),
    ['q1']
  );
  assert.deepEqual(
    adaptBankQuestionsForD01(mockBank, 'teacher').map((q) => q.questionId),
    ['q1', 'q2']
  );

  // Option shuffling preserves optionId binding & keeps True/False order intact
  const shuffledMc = prepareQuestionOptionsOnce(D01_SAMPLE_MATH_MAIN[0], 'seed_abc');
  assert.equal(shuffledMc.correctOptionId, D01_SAMPLE_MATH_MAIN[0].correctOptionId);
  assert.ok(shuffledMc.options.some((o) => o.optionId === shuffledMc.correctOptionId));

  const tfQ = D01_SAMPLE_MATH_MAIN.find((q) => q.type === 'true_false')!;
  const shuffledTf = prepareQuestionOptionsOnce(tfQ, 'seed_xyz');
  assert.deepEqual(
    shuffledTf.options.map((o) => o.optionId),
    tfQ.options.map((o) => o.optionId)
  );

  // Unicode NFC + whitespace + case short-answer check
  assert.equal(matchDeclaredShortAnswer('  55 ĐỘ ', ['55', '55 độ']), true);
  assert.equal(matchDeclaredShortAnswer('45 độ', ['55', '55 độ']), false);

  // Verify ALL 26 built-in sample questions (10+3 Math & 10+3 Info) compile cleanly in KaTeX
  assert.equal(D01_SAMPLE_MATH_MAIN.length, 10);
  assert.equal(D01_SAMPLE_MATH_TIEBREAKERS.length, 3);
  assert.equal(D01_SAMPLE_INFO_MAIN.length, 10);
  assert.equal(D01_SAMPLE_INFO_TIEBREAKERS.length, 3);

  const all26 = [
    ...D01_SAMPLE_MATH_MAIN,
    ...D01_SAMPLE_MATH_TIEBREAKERS,
    ...D01_SAMPLE_INFO_MAIN,
    ...D01_SAMPLE_INFO_TIEBREAKERS,
  ];
  let latexCount = 0;
  for (const q of all26) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
    const fields = [
      q.stemLatex,
      q.answerLatex,
      q.explanationLatex,
      ...q.options.map((o) => o.textLatex),
    ];
    for (const f of fields) {
      for (const seg of extractLatexSegments(f)) {
        latexCount += 1;
        const html = katex.renderToString(seg.tex, {
          displayMode: seg.displayMode,
          throwOnError: true,
        });
        assert.ok(html.includes('katex'), `KaTeX failed on ${q.questionId}: ${seg.tex}`);
      }
    }
  }
  assert.ok(latexCount >= 40, `Expected >= 40 verified LaTeX segments, got ${latexCount}`);
});

test('D01 #7: Persistence isolates /demo, restores fixed deck & buzzer attempts without granting free time or double-scoring, recovers corrupt JSON & audio cues degrade safely', () => {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const normalStorage = createMemoryStorage();
  const demoStorage = createMemoryStorage();

  try {
    (globalThis as Record<string, unknown>).window = {
      localStorage: normalStorage,
      location: { pathname: '/teacher/games' },
    };
    assert.equal(getD01StorageKey(), D01_SESSION_STORAGE_KEY);

    let state = startDuelMatch(
      { answerMode: 'buzzer', requestedMainCount: 5, buzzerAnswerSeconds: 15 },
      D01_SAMPLE_MATH_MAIN
    ).state;
    state = openDuelQuestion(state, 1000);
    state = claimBuzzerRight(state, 'A', state.turnToken, 1200, 'teacher_manual').state;
    state = startBuzzerResponsePhase(state, 1500); // deadline = 16500
    // Save mid-countdown at t = 6500 (10000ms remaining)
    saveD01Session(state, 6500);

    const restored = loadD01Session();
    assert.ok(restored);
    // Restores PAUSED with exact 10000ms remaining (never adds free time on reload!)
    assert.equal(restored.state.isPaused, true);
    assert.equal(restored.state.pausedRemainingMs, 10000);
    assert.equal(restored.state.activeBuzzerSide, 'A');
    assert.deepEqual(
      restored.state.mainDeck.map((q) => q.questionId),
      state.mainDeck.map((q) => q.questionId)
    );

    // /demo isolation
    (globalThis as Record<string, unknown>).window = {
      localStorage: demoStorage,
      location: { pathname: '/demo' },
    };
    assert.equal(getD01StorageKey(), `${KHKT_DEMO_STORAGE_PREFIX}${D01_SESSION_STORAGE_KEY}`);
    assert.equal(loadD01Session(), null);
    saveD01Session(state, 6500);
    assert.ok(demoStorage.getItem(`${KHKT_DEMO_STORAGE_PREFIX}${D01_SESSION_STORAGE_KEY}`));
    assert.equal(demoStorage.getItem(D01_SESSION_STORAGE_KEY), null);

    // Corrupt JSON recovery
    demoStorage.setItem(getD01StorageKey(), '{bad-json');
    assert.equal(loadD01Session(), null);
    assert.equal(demoStorage.getItem(getD01StorageKey()), null);
    clearD01Session();

    // Audio controller D01 cues degrade safely when muted/headless
    const soundBank = new EduGameSoundBank();
    assert.doesNotThrow(() => {
      soundBank.playDuelMatchStart(true);
      soundBank.playDuelBuzzerClaim(true, 'A');
      soundBank.playDuelAnswerLock(true);
      soundBank.playDuelOutcomeTone(true, true);
      soundBank.playDuelFinishFanfare(true, false);
      soundBank.playDuelMatchStart(false);
      soundBank.playDuelBuzzerClaim(false, 'B');
      soundBank.playDuelAnswerLock(false);
      soundBank.playDuelOutcomeTone(false, false);
      soundBank.playDuelFinishFanfare(false, true);
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
