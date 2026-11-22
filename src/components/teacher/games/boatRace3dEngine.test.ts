import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import {
  BoatQuestionItem,
  D02_SAMPLE_MATH_QUESTIONS,
  D02_SESSION_STORAGE_KEY,
  D02_STEP_METERS,
  adaptBankQuestionsForD02,
  advanceBoatAfterConfirm,
  areAllBoatTeamsMarked,
  buildDefaultBoatTeams,
  checkBoatDeadline,
  clearD02Session,
  computeBoatRaceStandings,
  confirmBoatRoundResult,
  distributeStudentsIntoBoatTeams,
  endBoatRaceEarly,
  getBoatRemainingTimeMs,
  getCurrentBoatQuestion,
  getD02StorageKey,
  loadD02Session,
  markBoatMediaReady,
  openBoatQuestion,
  pauseBoatRace,
  replaceFaultyBoatQuestion,
  resumeBoatRace,
  revealBoatAnswerAndPreview,
  saveD02Session,
  setBoatTeamMark,
  setBoatTeamOption,
  shuffleBoatOptionsOnce,
  startBoatRace,
  startEditingLastBoatRound,
  stopBoatAnswering,
  submitSoloLockedOption,
  validateBoatRaceSetup,
} from './boatRace3dEngine';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function extractMathExpressions(text: string): string[] {
  const matches: string[] = [];
  const regex = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push((m[1] || m[2] || '').trim());
  }
  return matches;
}

function makeMockStorage(): Storage {
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

test('D02 Setup validation, 1–6 boat modes, and in-session 50-student roster split', () => {
  // Invalid: target not multiple of 100
  assert.equal(validateBoatRaceSetup(10, 750, 10).valid, false);
  // Invalid: target exceeds 100 * questionCount
  assert.equal(validateBoatRaceSetup(5, 600, 10).valid, false);
  // Invalid: target <= 0
  assert.equal(validateBoatRaceSetup(10, 0, 10).valid, false);
  // Valid default: 10 questions, 800 m -> needs 8 correct
  const ok = validateBoatRaceSetup(10, 800, 10);
  assert.equal(ok.valid, true);
  assert.equal(ok.neededCorrect, 8);

  // Solo (1 boat), Class Coop (1 boat), Teams (2..6 boats)
  assert.equal(buildDefaultBoatTeams('solo').length, 1);
  assert.equal(buildDefaultBoatTeams('class_coop').length, 1);
  assert.equal(buildDefaultBoatTeams('teams', 2).length, 2);
  assert.equal(buildDefaultBoatTeams('teams', 6).length, 6);

  // 50-student class distributed evenly across 4 teams in-session
  const students = Array.from({ length: 50 }, (_, i) => `Học sinh ${i + 1}`);
  const teams4 = distributeStudentsIntoBoatTeams(buildDefaultBoatTeams('teams', 4), students);
  const counts = teams4.map((t) => t.memberNames.length);
  assert.deepEqual(counts, [13, 13, 12, 12]);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    50
  );
});

test('D02 Acceptance Scenario: Blue & Yellow both at 700 m hit 800 m together -> Co-Win (Đồng thắng) regardless of input order', () => {
  const teams = buildDefaultBoatTeams('teams', 2); // team_1 = Xanh dương, team_2 = Vàng
  const started = startBoatRace(
    {
      mode: 'teams',
      requestedQuestionCount: 10,
      targetMeters: 800,
      timerSeconds: 30,
      teams,
    },
    D02_SAMPLE_MATH_QUESTIONS,
    'd02_cowin_test'
  );
  assert.equal(started.error, null);
  let state = started.state;
  assert.equal(state.rulesLocked, true);

  // Play 7 rounds where both teams get +100 m each -> both strictly at 700 m
  for (let round = 1; round <= 7; round++) {
    state = openBoatQuestion(state, 1000 * round, true);
    state = stopBoatAnswering(state, 1000 * round + 5000).state;
    // Deliberately mark team_2 (Yellow) BEFORE team_1 (Blue)
    state = setBoatTeamMark(state, 'team_2', 'correct');
    state = setBoatTeamMark(state, 'team_1', 'correct');
    assert.equal(areAllBoatTeamsMarked(state), true);
    state = revealBoatAnswerAndPreview(state).state;
    const conf = confirmBoatRoundResult(state, state.turnToken);
    assert.equal(conf.confirmed, true);
    assert.equal(conf.reachedFinishNow, false);
    state = conf.state;

    // Anti-double-click guard: confirming same turnToken again MUST be rejected!
    const dup = confirmBoatRoundResult(state, state.turnToken);
    assert.equal(dup.confirmed, false);

    state = advanceBoatAfterConfirm(state);
  }

  const before8 = computeBoatRaceStandings(state);
  assert.equal(before8.standings[0].displayMeters, 700);
  assert.equal(before8.standings[1].displayMeters, 700);
  assert.equal(before8.hasFinisher, false);

  // Round 8: Enter Yellow FIRST, then Blue — atomic commit must mark BOTH at 800 m as Co-Winners!
  state = openBoatQuestion(state, 80000, true);
  state = stopBoatAnswering(state, 85000).state;
  state = setBoatTeamMark(state, 'team_2', 'correct');
  state = setBoatTeamMark(state, 'team_1', 'correct');
  state = revealBoatAnswerAndPreview(state).state;
  const conf8 = confirmBoatRoundResult(state, state.turnToken);
  assert.equal(conf8.confirmed, true);
  assert.equal(conf8.reachedFinishNow, true);
  state = conf8.state;

  const report8 = computeBoatRaceStandings(state);
  assert.equal(report8.hasFinisher, true);
  assert.equal(report8.isCoWin, true);
  assert.equal(report8.finishingRound, 8);
  assert.equal(report8.winners.length, 2);
  assert.ok(report8.statusHeadline.includes('Đồng thắng'));

  // NOW test Edit Just-Confirmed Round REVERSING a just-triggered finish!
  // Suppose teacher realizes Yellow was actually wrong on Round 8, and Blue was also wrong -> BOTH drop back to 700 m!
  state = startEditingLastBoatRound(state);
  assert.equal(state.editingLastConfirmed, true);
  state = setBoatTeamMark(state, 'team_2', 'wrong');
  state = setBoatTeamMark(state, 'team_1', 'no_answer');
  const edited = confirmBoatRoundResult(state, state.turnToken);
  assert.equal(edited.confirmed, true);
  assert.equal(edited.reachedFinishNow, false);
  state = edited.state;

  const afterEdit = computeBoatRaceStandings(state);
  assert.equal(afterEdit.hasFinisher, false);
  assert.equal(afterEdit.standings.find((s) => s.teamId === 'team_1')?.displayMeters, 700);
  assert.equal(afterEdit.standings.find((s) => s.teamId === 'team_2')?.displayMeters, 700);
  assert.equal(state.readyToFinishSummary, false);

  // Next advance should move cleanly to Round 9 (index 8) rather than summary!
  state = advanceBoatAfterConfirm(state);
  assert.equal(state.phase, 'ready');
  assert.equal(state.currentQuestionIndex, 8);
});

test('D02 Deck exhausted without finisher -> "Chưa có đội về đích" & Early stop separates unplayed from wrong', () => {
  const teams = buildDefaultBoatTeams('teams', 3);
  const started = startBoatRace(
    {
      mode: 'teams',
      requestedQuestionCount: 3,
      targetMeters: 300,
      timerSeconds: 0,
      teams,
    },
    D02_SAMPLE_MATH_QUESTIONS,
    'd02_nofinish'
  );
  let state = started.state;

  // Round 1: team_1 & team_2 right (+100 m), team_3 wrong (0 m)
  state = openBoatQuestion(state, 1000, true);
  state = stopBoatAnswering(state, 2000).state;
  state = setBoatTeamMark(state, 'team_1', 'correct');
  state = setBoatTeamMark(state, 'team_2', 'correct');
  state = setBoatTeamMark(state, 'team_3', 'wrong');
  state = revealBoatAnswerAndPreview(state).state;
  state = confirmBoatRoundResult(state, state.turnToken).state;

  // Test early stop branch on a clone (1/3 played, 2 unplayed must NOT be counted as wrong!)
  const early = endBoatRaceEarly(state);
  assert.equal(early.phase, 'summary');
  assert.equal(early.endedEarly, true);
  const earlyRep = computeBoatRaceStandings(early);
  assert.ok(earlyRep.statusHeadline.includes('Kết thúc sớm'));
  assert.equal(earlyRep.playedCount, 1);
  assert.equal(earlyRep.standings.find((s) => s.teamId === 'team_1')?.wrongCount, 0);
  assert.equal(earlyRep.standings.find((s) => s.teamId === 'team_3')?.wrongCount, 1);

  // Continue full 3 rounds with nobody hitting 300 m -> "Chưa có đội về đích" + Đồng hạng
  state = advanceBoatAfterConfirm(state);
  for (let r = 2; r <= 3; r++) {
    state = openBoatQuestion(state, r * 1000, true);
    state = stopBoatAnswering(state, r * 1000 + 500).state;
    state = setBoatTeamMark(state, 'team_1', 'wrong');
    state = setBoatTeamMark(state, 'team_2', 'wrong');
    state = setBoatTeamMark(state, 'team_3', 'no_answer');
    state = revealBoatAnswerAndPreview(state).state;
    state = confirmBoatRoundResult(state, state.turnToken).state;
    state = advanceBoatAfterConfirm(state);
  }

  assert.equal(state.phase, 'summary');
  const finalRep = computeBoatRaceStandings(state);
  assert.equal(finalRep.hasFinisher, false);
  assert.equal(finalRep.statusHeadline, 'Chưa có đội về đích');
  // team_1 & team_2 tied at 100 m -> both Rank 1, isTiedRank = true; team_3 Rank 3 at 0 m
  const t1 = finalRep.standings.find((s) => s.teamId === 'team_1')!;
  const t2 = finalRep.standings.find((s) => s.teamId === 'team_2')!;
  const t3 = finalRep.standings.find((s) => s.teamId === 'team_3')!;
  assert.equal(t1.displayMeters, 100);
  assert.equal(t2.displayMeters, 100);
  assert.equal(t1.rank, 1);
  assert.equal(t2.rank, 1);
  assert.equal(t1.isTiedRank, true);
  assert.equal(t3.rank, 3);
});

test('D02 Solo mode "Chốt" before vs after deadline, Pause/Resume, mediaReady gating, and faulty question replacement', () => {
  const started = startBoatRace(
    {
      mode: 'solo',
      requestedQuestionCount: 5,
      targetMeters: 300,
      timerSeconds: 30,
      teams: buildDefaultBoatTeams('solo'),
    },
    D02_SAMPLE_MATH_QUESTIONS,
    'd02_solo_test'
  );
  let state = started.state;
  assert.equal(state.reserveDeck.length, 5);

  // Open question with mediaReady = false -> deadline MUST remain null until markBoatMediaReady!
  state = openBoatQuestion(state, 10_000, false);
  assert.equal(state.mediaReady, false);
  assert.equal(state.deadlineMs, null);

  state = markBoatMediaReady(state, 12_000);
  assert.equal(state.mediaReady, true);
  assert.equal(state.deadlineMs, 42_000);

  // Pause at 22_000 -> preserves exactly 20_000 ms and blocks solo submit!
  state = pauseBoatRace(state, 22_000);
  assert.equal(state.isPaused, true);
  assert.equal(getBoatRemainingTimeMs(state, 99_000), 20_000);

  const q0 = getCurrentBoatQuestion(state)!;
  const blocked = submitSoloLockedOption(state, q0.correctOptionId!, 25_000);
  assert.equal(blocked.accepted, false);

  // Resume at 50_000 -> deadline becomes 70_000
  state = resumeBoatRace(state, 50_000);
  assert.equal(state.deadlineMs, 70_000);

  // Submit strictly BEFORE deadline (65_000) -> accepted & +100 m on confirm
  const okSub = submitSoloLockedOption(state, q0.correctOptionId!, 65_000);
  assert.equal(okSub.accepted, true);
  state = confirmBoatRoundResult(okSub.state, okSub.state.turnToken).state;
  assert.equal(computeBoatRaceStandings(state).standings[0].displayMeters, D02_STEP_METERS);

  // Move to Round 2 -> test replaceFaultyBoatQuestion swaps cleanly from reserveDeck without repeats
  state = advanceBoatAfterConfirm(state);
  const oldId = getCurrentBoatQuestion(state)!.questionId;
  const swapped = replaceFaultyBoatQuestion(state);
  assert.equal(swapped.replaced, true);
  state = swapped.state;
  const newId = getCurrentBoatQuestion(state)!.questionId;
  assert.notEqual(newId, oldId);
  assert.equal(state.reserveDeck.length, 4);

  // Round 2: try submitting AFTER deadline -> rejected & marked no_answer (0 m)
  state = openBoatQuestion(state, 100_000, true);
  const q1 = getCurrentBoatQuestion(state)!;
  const lateSub = submitSoloLockedOption(state, q1.correctOptionId!, 135_000);
  assert.equal(lateSub.accepted, false);
  assert.equal(lateSub.state.draftMarks[state.config.teams[0].teamId], 'no_answer');
  state = confirmBoatRoundResult(lateSub.state, lateSub.state.turnToken).state;
  assert.equal(computeBoatRaceStandings(state).standings[0].displayMeters, D02_STEP_METERS);
  assert.equal(computeBoatRaceStandings(state).standings[0].noAnswerCount, 1);

  // Check deadline expiry in team mode -> goes to `stopped` (NEVER auto-marks mini-board answers wrong)
  const teamStart = startBoatRace(
    { mode: 'teams', requestedQuestionCount: 2, targetMeters: 200, timerSeconds: 10 },
    D02_SAMPLE_MATH_QUESTIONS,
    'd02_team_timeout'
  ).state;
  const opened = openBoatQuestion(teamStart, 1_000, true);
  const expired = checkBoatDeadline(opened, 12_000);
  assert.equal(expired.expired, true);
  assert.equal(expired.state.phase, 'stopped');
  assert.equal(expired.state.draftMarks['team_1'], 'unmarked');
  // Quick option grading uses optionId binding
  const qTeam = getCurrentBoatQuestion(expired.state)!;
  const afterPick = setBoatTeamOption(expired.state, 'team_1', qTeam.correctOptionId!);
  assert.equal(afterPick.draftMarks['team_1'], 'correct');
});

test('D02 10-question sample pack ("Đua thuyền Toán THCS"): exact math answers, KaTeX compilation, optionId shuffle & RBAC bank', () => {
  assert.equal(D02_SAMPLE_MATH_QUESTIONS.length, 10);
  const expectedAnswers = [
    '\\(60\\)',
    '\\(56\\)',
    '\\(13\\)',
    '\\(5\\)',
    '\\(\\frac{3}{4}\\)',
    '\\(12\\)',
    '\\(2 : 3\\)',
    '\\(24\\text{ cm}\\)',
    '\\(36\\text{ cm}^2\\)',
    '\\(4\\text{ m/s}\\)',
  ];

  D02_SAMPLE_MATH_QUESTIONS.forEach((q, idx) => {
    assert.equal(q.answerLatex, expectedAnswers[idx]);
    assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
    const correctOpt = q.options.find((o) => o.optionId === q.correctOptionId);
    assert.ok(correctOpt, `Question ${q.questionId} must match correctOptionId`);
    assert.equal(correctOpt!.textLatex, expectedAnswers[idx]);

    // Every KaTeX expression in stem, options, answer, explanation must compile with throwOnError: true
    const allTexts = [
      q.stemLatex,
      q.answerLatex,
      q.explanationLatex,
      ...q.options.map((o) => o.textLatex),
    ];
    for (const txt of allTexts) {
      for (const expr of extractMathExpressions(txt)) {
        assert.doesNotThrow(
          () => katex.renderToString(expr, { throwOnError: true }),
          `KaTeX failed on ${q.questionId}: ${expr}`
        );
      }
    }
  });

  // optionId-locked shuffle keeps correctOptionId valid & preserves label-dependent options
  const shuffled = shuffleBoatOptionsOnce(D02_SAMPLE_MATH_QUESTIONS[0], 'seed_abc');
  const shuffledCorrect = shuffled.options.find((o) => o.optionId === shuffled.correctOptionId);
  assert.equal(shuffledCorrect?.textLatex, '\\(60\\)');

  const labelDepQ: BoatQuestionItem = {
    ...D02_SAMPLE_MATH_QUESTIONS[0],
    questionId: 'label_dep',
    options: [
      { optionId: 'a', label: 'A', textLatex: '10' },
      { optionId: 'b', label: 'B', textLatex: '20' },
      { optionId: 'c', label: 'C', textLatex: 'Cả A và B đều đúng' },
    ],
    correctOptionId: 'c',
  };
  const kept = shuffleBoatOptionsOnce(labelDepQ, 'seed_keep');
  assert.deepEqual(
    kept.options.map((o) => o.optionId),
    ['a', 'b', 'c']
  );

  // RBAC Smart EDU bank adapter: student only sees approved; teacher sees non-deprecated
  const mockBank: Question[] = [
    {
      id: 'q_approved',
      code: 'TOAN6-01',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 1',
      level: 'know',
      type: 'single_choice',
      stem: '2 + 2 = ?',
      points: 1,
      explanation: '2 + 2 = 4',
      options: [
        { id: 'o1', label: 'A', text: '4' },
        { id: 'o2', label: 'B', text: '5' },
      ],
      correctAnswer: 'o1',
      status: 'approved',
      author: 't1',
      version: 1,
    },
    {
      id: 'q_draft',
      code: 'TOAN6-02',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 2',
      level: 'understand',
      type: 'short_answer',
      stem: '3 + 5 = ?',
      points: 1,
      explanation: '3 + 5 = 8',
      acceptedAnswers: ['8'],
      status: 'draft',
      author: 't1',
      version: 1,
    },
    {
      id: 'q_deprecated',
      code: 'TOAN6-03',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 3',
      level: 'apply',
      type: 'short_answer',
      stem: 'Old question',
      points: 1,
      explanation: 'Old',
      acceptedAnswers: ['1'],
      status: 'deprecated',
      author: 't1',
      version: 1,
    },
  ];
  assert.equal(adaptBankQuestionsForD02(mockBank, 'student').length, 1);
  assert.equal(adaptBankQuestionsForD02(mockBank, 'teacher').length, 2);
});

test('D02 Persistence isolates /demo, reconstructs distances from history, handles corrupt JSON, and sound cues degrade safely', () => {
  const prevWindow = (globalThis as { window?: unknown }).window;
  const mockStorage = makeMockStorage();

  try {
    (globalThis as { window: unknown }).window = {
      localStorage: mockStorage,
      location: { pathname: '/demo/games' },
    };

    assert.equal(getD02StorageKey(), `${KHKT_DEMO_STORAGE_PREFIX}${D02_SESSION_STORAGE_KEY}`);

    const started = startBoatRace(
      { mode: 'teams', requestedQuestionCount: 4, targetMeters: 300, timerSeconds: 30 },
      D02_SAMPLE_MATH_QUESTIONS,
      'd02_persist_1'
    ).state;
    let st = openBoatQuestion(started, 1000, true);
    st = stopBoatAnswering(st, 4000).state;
    st = setBoatTeamMark(st, 'team_1', 'correct');
    st = setBoatTeamMark(st, 'team_2', 'wrong');
    st = setBoatTeamMark(st, 'team_3', 'correct');
    st = setBoatTeamMark(st, 'team_4', 'no_answer');
    st = revealBoatAnswerAndPreview(st).state;
    st = confirmBoatRoundResult(st, st.turnToken).state;
    st = advanceBoatAfterConfirm(st);
    st = openBoatQuestion(st, 10_000, true);

    saveD02Session(st, 15_000);
    const loaded = loadD02Session();
    assert.ok(loaded);
    assert.equal(loaded!.state.raceId, 'd02_persist_1');
    // Active timer pauses cleanly on reload preserving remaining ms (25_000 ms)
    assert.equal(loaded!.state.isPaused, true);
    assert.equal(loaded!.state.pausedRemainingMs, 25_000);
    const rep = computeBoatRaceStandings(loaded!.state);
    assert.equal(rep.standings.find((s) => s.teamId === 'team_1')?.displayMeters, 100);
    assert.equal(rep.standings.find((s) => s.teamId === 'team_2')?.displayMeters, 0);
    assert.equal(rep.standings.find((s) => s.teamId === 'team_3')?.displayMeters, 100);

    // Corrupt JSON recovers safely & clears storage
    mockStorage.setItem(getD02StorageKey(), '{bad json');
    assert.equal(loadD02Session(), null);
    assert.equal(mockStorage.getItem(getD02StorageKey()), null);

    clearD02Session();
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window: unknown }).window = prevWindow;
    }
  }

  // Consecutive rematches generate distinct raceIds
  const r1 = startBoatRace({ requestedQuestionCount: 5, targetMeters: 300 }, D02_SAMPLE_MATH_QUESTIONS);
  const r2 = startBoatRace({ requestedQuestionCount: 5, targetMeters: 300 }, D02_SAMPLE_MATH_QUESTIONS);
  assert.notEqual(r1.state.raceId, r2.state.raceId);

  // All 4 D02 audio cues degrade safely in headless/muted environments
  const bank = new EduGameSoundBank();
  bank.setActiveTurnToken('tok_d02');
  assert.doesNotThrow(() => {
    bank.playBoatStartHorn(false, 'tok_d02');
    bank.playBoatRowSplash(false, 'tok_d02');
    bank.playBoatStopWhistle(false, 'tok_d02');
    bank.playBoatFinishFanfare(false, true, 'tok_d02');
    bank.playBoatFinishFanfare(true, false, 'tok_d02');
    bank.dispose();
  });
});
