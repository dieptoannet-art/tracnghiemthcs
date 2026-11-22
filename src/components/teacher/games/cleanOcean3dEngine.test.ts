import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { Question } from '../../../types';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import {
  C10_FINAL_HINT_POINTS,
  C10_FINAL_POINTS,
  C10_ILLUSTRATIVE_CAPTION,
  C10_REGULAR_HINT_POINTS,
  C10_REGULAR_POINTS,
  C10_SAMPLE_BADGE,
  C10_SAMPLE_CS_QUESTIONS,
  C10_SAMPLE_MATH_QUESTIONS,
  OceanQuestionItem,
  adaptBankQuestionsForC10,
  areAllOceanParticipantsMarked,
  buildDefaultOceanTeams,
  canCollectOceanTarget,
  checkOceanDeadline,
  clearC10Session,
  computeMissionPoints,
  computeOceanMaxScore,
  computeOceanProgressReport,
  confirmOceanMissionResult,
  continueAfterOceanMission,
  distributeStudentsIntoOceanTeams,
  endOceanVoyageEarly,
  enterOceanZone,
  finishOrSkipOceanAnimation,
  getC10StorageKey,
  getOceanRemainingTimeMs,
  loadC10Session,
  markOceanMediaReady,
  matchOceanTextAnswer,
  normalizeVietnameseAnswer,
  openOceanQuestion,
  pauseOceanVoyage,
  recordPracticeRetry,
  resumeOceanVoyage,
  revealOceanAnswerAndPreview,
  saveC10Session,
  selectOceanMission,
  setOceanParticipantMark,
  shuffleOceanOptionsOnce,
  startEditingLastOceanMission,
  startOceanVoyage,
  stopOceanAnswering,
  submitCoopDirectOption,
  submitCoopTypedAnswer,
  useOceanHint,
  validateOceanSetup,
} from './cleanOcean3dEngine';

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

function extractInlineLatex(text: string): string[] {
  const matches: string[] = [];
  const regex = /\\\(([\s\S]*?)\\\)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

test('C10: Default setup (3 zones × 4 + final = 13 questions, max 150 pts) & environmental safety guard', () => {
  const maxDefault = computeOceanMaxScore(3, 4, true);
  assert.equal(maxDefault.totalQuestions, 13);
  assert.equal(maxDefault.maxScore, 150);

  const checkTooFew = validateOceanSetup(3, 4, true, 10);
  assert.equal(checkTooFew.valid, false);
  assert.ok(checkTooFew.error?.includes('chưa đủ'));

  // Environmental accuracy: ONLY trash_debris can be collected; NEVER marine life, coral, seagrass, live shells
  assert.equal(
    canCollectOceanTarget({ targetId: 't1', label: 'Chai nhựa', kind: 'trash_debris' }),
    true
  );
  assert.equal(
    canCollectOceanTarget({ targetId: 'm1', label: 'Rùa biển', kind: 'marine_creature' }),
    false
  );
  assert.equal(
    canCollectOceanTarget({ targetId: 'c1', label: 'San hô', kind: 'coral' }),
    false
  );
  assert.equal(
    canCollectOceanTarget({ targetId: 's1', label: 'Cỏ biển', kind: 'seagrass' }),
    false
  );
  assert.equal(
    canCollectOceanTarget({ targetId: 'sh1', label: 'Vỏ sò sống', kind: 'live_shell' }),
    false
  );
  assert.equal(C10_ILLUSTRATIVE_CAPTION, 'Hoạt ảnh phục hồi mang tính minh họa');
});

test('C10: Full 13-question Coop voyage — zone unlock order, Trạm đại dương gating, hints, wrong answer support & progress vs accuracy', () => {
  const started = startOceanVoyage(
    {
      mode: 'coop',
      questionSource: 'sample_math',
      zoneCount: 3,
      questionsPerZone: 4,
      includeFinalChallenge: true,
      timerSeconds: 45,
      hintsEnabled: true,
    },
    C10_SAMPLE_MATH_QUESTIONS,
    'sess_coop_full'
  );
  assert.equal(started.error, null);
  let state = started.state;
  assert.equal(state.missions.length, 13);
  assert.equal(new Set(state.missions.map((m) => m.question.questionId)).size, 13);

  // Zone 2, Zone 3 and Trạm đại dương must be locked initially
  assert.equal(enterOceanZone(state, 'zone_seagrass').entered, false);
  assert.equal(enterOceanZone(state, 'zone_reef').entered, false);
  assert.equal(enterOceanZone(state, 'zone_station').entered, false);
  assert.equal(selectOceanMission(state, 'zone_station_final').selected, false);

  // Complete all 12 learning missions across 3 zones:
  // - Mission 1: Correct without hint (+10)
  // - Mission 2: Correct WITH hint (+5)
  // - Mission 3: Wrong answer (0 pts, completed_with_support, does NOT block progress!)
  // - Remaining 9 learning missions: Correct without hint (9 × 10 = 90)
  let now = 100_000;
  for (let i = 0; i < 12; i++) {
    const m = state.missions[i];
    const entered = enterOceanZone(state, m.zoneId);
    assert.equal(entered.entered, true);
    state = entered.state;

    const sel = selectOceanMission(state, m.missionId);
    assert.equal(sel.selected, true);
    state = sel.state;

    state = openOceanQuestion(state, now, true);
    if (i === 1) {
      const h = useOceanHint(state);
      assert.equal(h.used, true);
      state = h.state;
      // Second hint request on same question is ignored
      assert.equal(useOceanHint(state).used, false);
    }

    const optId =
      i === 2
        ? m.question.options.find((o) => o.optionId !== m.question.correctOptionId)!.optionId
        : m.question.correctOptionId!;
    const sub = submitCoopDirectOption(state, optId, now + 3000);
    assert.equal(sub.accepted, true);
    state = sub.state;

    // Practice retry after reveal must NEVER add points!
    if (i === 2) {
      state = recordPracticeRetry(state);
      assert.equal(state.practiceRetryUsed, true);
    }

    const conf = confirmOceanMissionResult(state, state.turnToken);
    assert.equal(conf.confirmed, true);
    state = conf.state;

    // Anti-double-click & stale token guard
    assert.equal(confirmOceanMissionResult(state, state.turnToken).confirmed, false);
    assert.equal(confirmOceanMissionResult(state, 'stale_token').confirmed, false);

    // Skip animation invariance: score and progress unchanged
    const beforeSkip = computeOceanProgressReport(state);
    state = finishOrSkipOceanAnimation(state);
    const afterSkip = computeOceanProgressReport(state);
    assert.equal(afterSkip.standings[0].score, beforeSkip.standings[0].score);
    assert.equal(afterSkip.completedMissions, beforeSkip.completedMissions);

    // Completed mission cannot be selected again
    assert.equal(selectOceanMission(state, m.missionId).selected, false);

    state = continueAfterOceanMission(state);
    now += 10_000;
  }

  // After all 12 learning missions: Trạm đại dương unlocks!
  const midReport = computeOceanProgressReport(state);
  const stationZone = midReport.zones.find((z) => z.zoneId === 'zone_station')!;
  assert.equal(stationZone.status, 'open');
  assert.equal(midReport.completedMissions, 12);
  assert.equal(midReport.standings[0].correctCount, 11); // Strictly separate from completedMissions!
  assert.equal(midReport.standings[0].wrongCount, 1);
  assert.equal(midReport.standings[0].score, 10 + 5 + 0 + 9 * 10); // 105

  // Complete Final Challenge with hint (+15 pts -> total 120 pts)
  const finalM = state.missions[12];
  assert.equal(finalM.isFinalChallenge, true);
  state = enterOceanZone(state, 'zone_station').state;
  state = selectOceanMission(state, finalM.missionId).state;
  state = openOceanQuestion(state, now, true);
  state = useOceanHint(state).state;
  state = submitCoopDirectOption(state, finalM.question.correctOptionId!, now + 2000).state;
  state = confirmOceanMissionResult(state, state.turnToken).state;
  state = finishOrSkipOceanAnimation(state);
  state = continueAfterOceanMission(state);

  assert.equal(state.phase, 'summary');
  const finalReport = computeOceanProgressReport(state);
  assert.equal(finalReport.voyageCompleted, true);
  assert.equal(finalReport.missionProgressPercent, 100);
  assert.equal(finalReport.standings[0].score, 105 + C10_FINAL_HINT_POINTS); // 120
  assert.equal(finalReport.standings[0].correctCount, 12);
  assert.equal(finalReport.standings[0].wrongCount, 1);
  assert.equal(finalReport.totalHintsUsed, 2);
  assert.equal(finalReport.finalChallengeResult, 'solved_correct');
  assert.equal(finalReport.finalChallengeLabel, 'Giải đúng thử thách cuối');
});

test('C10: Missing hint NEVER deducts points & Final challenge wrong answer gives distinct label', () => {
  const noHintPool: OceanQuestionItem[] = C10_SAMPLE_MATH_QUESTIONS.slice(0, 5).map((q, idx) => ({
    ...q,
    questionId: idx === 4 ? 'nh_final' : `nh_${idx}`,
    hintLatex: null,
  }));
  const { state: s0, error } = startOceanVoyage(
    {
      mode: 'coop',
      zoneCount: 2,
      questionsPerZone: 2,
      includeFinalChallenge: true,
      hintsEnabled: true,
    },
    noHintPool,
    'sess_no_hint'
  );
  assert.equal(error, null);
  let state = s0;

  // Try using hint on first mission -> must fail and keep full +10 pts
  state = enterOceanZone(state, 'zone_bay').state;
  state = selectOceanMission(state, state.missions[0].missionId).state;
  state = openOceanQuestion(state, 1000, true);
  const hRes = useOceanHint(state);
  assert.equal(hRes.used, false);
  assert.equal(hRes.state.hintRevealedForActive, false);
  state = submitCoopDirectOption(state, state.missions[0].question.correctOptionId!, 2000).state;
  state = confirmOceanMissionResult(state, state.turnToken).state;
  state = finishOrSkipOceanAnimation(state);
  assert.equal(computeOceanProgressReport(state).standings[0].score, C10_REGULAR_POINTS);

  // Finish remaining 3 learning missions + fail final challenge
  state = continueAfterOceanMission(state);
  for (let i = 1; i < 4; i++) {
    const m = state.missions[i];
    state = enterOceanZone(state, m.zoneId).state;
    state = selectOceanMission(state, m.missionId).state;
    state = openOceanQuestion(state, 5000 + i * 1000, true);
    state = submitCoopDirectOption(state, m.question.correctOptionId!, 5500 + i * 1000).state;
    state = confirmOceanMissionResult(state, state.turnToken).state;
    state = finishOrSkipOceanAnimation(state);
    state = continueAfterOceanMission(state);
  }
  const fm = state.missions[4];
  const wrongOpt = fm.question.options.find((o) => o.optionId !== fm.question.correctOptionId)!.optionId;
  state = enterOceanZone(state, 'zone_station').state;
  state = selectOceanMission(state, fm.missionId).state;
  state = openOceanQuestion(state, 20000, true);
  state = submitCoopDirectOption(state, wrongOpt, 21000).state;
  state = confirmOceanMissionResult(state, state.turnToken).state;
  state = finishOrSkipOceanAnimation(state);
  state = continueAfterOceanMission(state);

  const rep = computeOceanProgressReport(state);
  assert.equal(rep.voyageCompleted, true);
  assert.equal(rep.finalChallengeResult, 'completed_after_review');
  assert.equal(rep.finalChallengeLabel, 'Hoàn thành sau khi ôn lại');
  assert.equal(rep.standings[0].score, 4 * C10_REGULAR_POINTS); // 40 (0 for final)
});

test('C10: Teams mode (2 & 6 teams), hidden answer until all marked, unmarked vs no_answer, Đồng hạng & Edit last round', () => {
  const teams6 = buildDefaultOceanTeams('teams', 6);
  const roster50 = Array.from({ length: 50 }, (_, i) => `Học sinh ${i + 1}`);
  const distributed = distributeStudentsIntoOceanTeams(teams6, roster50);
  assert.equal(distributed.reduce((sum, t) => sum + t.memberNames.length, 0), 50);

  const started = startOceanVoyage(
    {
      mode: 'teams',
      zoneCount: 2,
      questionsPerZone: 2,
      includeFinalChallenge: false,
      teams: distributed,
      timerSeconds: 30,
    },
    C10_SAMPLE_CS_QUESTIONS,
    'sess_6teams'
  );
  assert.equal(started.error, null);
  let state = started.state;

  state = enterOceanZone(state, 'zone_bay').state;
  state = selectOceanMission(state, state.missions[0].missionId).state;
  state = openOceanQuestion(state, 1000, true);

  // Timeout stops answering WITHOUT auto-marking teams wrong
  const expired = checkOceanDeadline(state, 31_000);
  assert.equal(expired.expired, true);
  state = expired.state;
  assert.equal(state.phase, 'grading');
  assert.equal(areAllOceanParticipantsMarked(state), false);

  // Reveal blocked while any team is unmarked
  assert.equal(revealOceanAnswerAndPreview(state).revealed, false);

  // Mark 2 teams correct, 2 wrong, 2 no_answer
  state = setOceanParticipantMark(state, distributed[0].teamId, 'correct');
  state = setOceanParticipantMark(state, distributed[1].teamId, 'correct');
  state = setOceanParticipantMark(state, distributed[2].teamId, 'wrong');
  state = setOceanParticipantMark(state, distributed[3].teamId, 'wrong');
  state = setOceanParticipantMark(state, distributed[4].teamId, 'no_answer');
  assert.equal(areAllOceanParticipantsMarked(state), false);
  state = setOceanParticipantMark(state, distributed[5].teamId, 'no_answer');
  assert.equal(areAllOceanParticipantsMarked(state), true);

  const rev = revealOceanAnswerAndPreview(state);
  assert.equal(rev.revealed, true);
  state = rev.state;

  state = confirmOceanMissionResult(state, state.turnToken).state;
  state = finishOrSkipOceanAnimation(state);

  let rep = computeOceanProgressReport(state);
  assert.equal(rep.standings[0].score, 10);
  assert.equal(rep.standings[1].score, 10);
  assert.equal(rep.standings[0].rank, 1);
  assert.equal(rep.standings[1].rank, 1);
  assert.equal(rep.standings[0].isTiedRank, true);
  assert.equal(rep.standings.find((s) => s.participantId === distributed[4].teamId)?.noAnswerCount, 1);
  assert.equal(rep.standings.find((s) => s.participantId === distributed[4].teamId)?.wrongCount, 0);

  // Edit just-confirmed mission: change team 2 from correct -> wrong, team 3 from wrong -> correct
  state = startEditingLastOceanMission(state);
  assert.equal(state.editingLastConfirmed, true);
  state = setOceanParticipantMark(state, distributed[1].teamId, 'wrong');
  state = setOceanParticipantMark(state, distributed[2].teamId, 'correct');
  const reconf = confirmOceanMissionResult(state, state.turnToken);
  assert.equal(reconf.confirmed, true);
  state = reconf.state;
  assert.equal(state.history.length, 1); // Strictly single record, no duplicate!

  rep = computeOceanProgressReport(state);
  assert.equal(rep.standings.find((s) => s.participantId === distributed[1].teamId)?.score, 0);
  assert.equal(rep.standings.find((s) => s.participantId === distributed[2].teamId)?.score, 10);

  // Early end: unplayed missions NEVER counted as wrong
  state = endOceanVoyageEarly(state);
  assert.equal(state.phase, 'summary');
  rep = computeOceanProgressReport(state);
  assert.equal(rep.standings[0].unplayedCount, 3);
  assert.equal(rep.standings[0].wrongCount, 0);
});

test('C10: Pause/Resume clock, mediaReady gating, simultaneous timeout & Vietnamese NFC short-answer matching', () => {
  const shortQ: OceanQuestionItem[] = [
    {
      questionId: 'vn_1',
      type: 'short_answer',
      topic: 'Tiếng Việt NFC',
      difficulty: 'know',
      stemLatex: 'Điền tên đại dương minh họa:',
      options: [],
      correctOptionId: null,
      acceptedVariants: ['Đại dương xanh'],
      allowDiacriticInsensitive: false,
      answerLatex: 'Đại dương xanh',
      explanationLatex: 'Kiểm tra chuẩn hóa Unicode NFC.',
      hintLatex: null,
      actionMessage: 'Thu gom mẫu.',
      plainReadText: 'Điền tên đại dương minh họa.',
      isSample: true,
      sourceBadge: C10_SAMPLE_BADGE,
    },
    ...C10_SAMPLE_MATH_QUESTIONS.slice(0, 3),
  ];

  // NFC vs NFD Vietnamese matching
  const nfd = '  ĐẠI   DƯƠNG  XANH '.normalize('NFD');
  assert.equal(normalizeVietnameseAnswer(nfd), 'đại dương xanh');
  assert.equal(matchOceanTextAnswer(nfd, ['Đại dương xanh'], false), true);
  assert.equal(matchOceanTextAnswer('dai duong xanh', ['Đại dương xanh'], false), false);
  assert.equal(matchOceanTextAnswer('dai duong xanh', ['Đại dương xanh'], true), true);

  let state = startOceanVoyage(
    { mode: 'coop', zoneCount: 2, questionsPerZone: 2, includeFinalChallenge: false, timerSeconds: 30 },
    shortQ,
    'sess_clock'
  ).state;
  state = enterOceanZone(state, 'zone_bay').state;
  state = selectOceanMission(state, state.missions[0].missionId).state;

  // Open with mediaReady = false -> clock does NOT start until markOceanMediaReady
  state = openOceanQuestion(state, 1000, false);
  assert.equal(state.deadlineMs, null);
  state = markOceanMediaReady(state, 5000);
  assert.equal(state.deadlineMs, 35_000);

  // Pause at t=15_000 -> remaining 20_000ms; locked while paused
  state = pauseOceanVoyage(state, 15_000);
  assert.equal(state.isPaused, true);
  assert.equal(getOceanRemainingTimeMs(state, 25_000), 20_000);
  assert.equal(submitCoopTypedAnswer(state, 'Đại dương xanh', 16_000).accepted, false);

  // Resume at t=25_000 -> deadline becomes 45_000
  state = resumeOceanVoyage(state, 25_000);
  assert.equal(state.deadlineMs, 45_000);

  // Simultaneous submit AT exact deadline fails cleanly
  const late = submitCoopTypedAnswer(state, 'Đại dương xanh', 45_000);
  assert.equal(late.accepted, false);
  assert.equal(late.state.phase, 'grading');

  // Stop answering test on mission 2 + valid NFC typed submit
  state = selectOceanMission(
    { ...state, phase: 'zone', activeMissionId: null },
    state.missions[0].missionId
  ).state;
  state = openOceanQuestion(state, 50_000, true);
  const okTyped = submitCoopTypedAnswer(state, nfd, 55_000);
  assert.equal(okTyped.accepted, true);
  assert.equal(okTyped.state.draftMarks[state.config.teams[0].teamId], 'correct');
  assert.equal(stopOceanAnswering(okTyped.state).stopped, false);
});

test('C10: /demo-isolated persistence, zero score doubling on reload, corrupt JSON recovery & 3 consecutive replays', () => {
  const memStorage = createMemoryStorage();
  const prevWindow = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    localStorage: memStorage,
    location: { pathname: '/demo/games' },
  };

  try {
    assert.ok(getC10StorageKey().startsWith(KHKT_DEMO_STORAGE_PREFIX));

    for (let run = 1; run <= 3; run++) {
      let state = startOceanVoyage(
        { mode: 'coop', zoneCount: 2, questionsPerZone: 2, includeFinalChallenge: false },
        C10_SAMPLE_MATH_QUESTIONS,
        `replay_${run}`
      ).state;
      state = enterOceanZone(state, 'zone_bay').state;
      state = selectOceanMission(state, state.missions[0].missionId).state;
      state = openOceanQuestion(state, 1000, true);
      state = submitCoopDirectOption(state, state.missions[0].question.correctOptionId!, 2000).state;
      state = confirmOceanMissionResult(state, state.turnToken).state;
      saveC10Session(state, 2500);

      const loaded = loadC10Session();
      assert.ok(loaded);
      // Reload while animating settles cleanly to mission_done without doubling points!
      assert.equal(loaded!.state.phase, 'mission_done');
      assert.equal(computeOceanProgressReport(loaded!.state).standings[0].score, 10);
      assert.equal(loaded!.state.history.length, 1);
      clearC10Session();
    }

    // Corrupt JSON recovers safely
    memStorage.setItem(getC10StorageKey(), '{broken-json');
    assert.equal(loadC10Session(), null);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});

test('C10: All 26 built-in Math & CS sample questions render cleanly with KaTeX throwOnError & RBAC bank adapter works', () => {
  const all26 = [...C10_SAMPLE_MATH_QUESTIONS, ...C10_SAMPLE_CS_QUESTIONS];
  assert.equal(all26.length, 26);

  for (const q of all26) {
    assert.equal(q.isSample, true);
    assert.equal(q.sourceBadge, C10_SAMPLE_BADGE);
    const fields = [
      q.stemLatex,
      q.answerLatex,
      q.explanationLatex,
      q.hintLatex || '',
      ...q.options.map((o) => o.textLatex),
    ];
    for (const f of fields) {
      const exprs = extractInlineLatex(f);
      for (const expr of exprs) {
        const html = katex.renderToString(expr, { throwOnError: true, strict: 'ignore' });
        assert.ok(html.length > 0);
      }
    }
  }

  // Option shuffle preserves correctOptionId and skips label-dependent questions
  const shuffled = shuffleOceanOptionsOnce(C10_SAMPLE_MATH_QUESTIONS[0], 'seed_1');
  assert.equal(shuffled.correctOptionId, C10_SAMPLE_MATH_QUESTIONS[0].correctOptionId);

  const bank: Question[] = [
    {
      id: 'b_ok',
      code: 'TOAN6-C10-01',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Phân số',
      lesson: 'Bài 1',
      level: 'know',
      type: 'single_choice',
      stem: '1 + 1 = ?',
      points: 1,
      explanation: '1 + 1 = 2',
      options: [
        { id: 'a', label: 'A', text: '2' },
        { id: 'b', label: 'B', text: '3' },
      ],
      correctAnswer: 'a',
      status: 'approved',
      author: 't1',
      version: 1,
    },
    {
      id: 'b_draft',
      code: 'TIN7-C10-02',
      subject: 'Tin học',
      grade: '7',
      textbook: 'Kết nối tri thức',
      chapter: 'Dữ liệu',
      lesson: 'Bài 2',
      level: 'understand',
      type: 'short_answer',
      stem: '1 byte = ? bit',
      points: 1,
      explanation: '1 byte = 8 bit',
      acceptedAnswers: ['8'],
      status: 'draft',
      author: 't1',
      version: 1,
    },
    {
      id: 'b_dep',
      code: 'TOAN8-C10-03',
      subject: 'Toán',
      grade: '8',
      textbook: 'Kết nối tri thức',
      chapter: 'Cũ',
      lesson: 'Bài 3',
      level: 'apply',
      type: 'short_answer',
      stem: 'Deprecated',
      points: 1,
      explanation: 'Old',
      acceptedAnswers: ['1'],
      status: 'deprecated',
      author: 't1',
      version: 1,
    },
  ];
  assert.equal(adaptBankQuestionsForC10(bank, 'student').length, 1);
  assert.equal(adaptBankQuestionsForC10(bank, 'teacher').length, 2);

  // Headless C10 audio cues never throw
  const sb = new EduGameSoundBank();
  sb.setActiveTurnToken('tok1');
  sb.playOceanWaterPulse(false, 'tok1');
  sb.playOceanSelectMission(false, 'tok1');
  sb.playOceanLockAnswer(false, 'tok1');
  sb.playOceanResultCue(false, true, 'tok1');
  sb.playOceanResultCue(false, false, 'tok1');
  sb.playOceanZoneComplete(false, 'tok1');
  sb.playOceanVoyageSummary(false, 'tok1');
  sb.dispose();

  // Direct point matrix check
  assert.equal(computeMissionPoints(false, 'correct', false), C10_REGULAR_POINTS);
  assert.equal(computeMissionPoints(false, 'correct', true), C10_REGULAR_HINT_POINTS);
  assert.equal(computeMissionPoints(true, 'correct', false), C10_FINAL_POINTS);
  assert.equal(computeMissionPoints(true, 'correct', true), C10_FINAL_HINT_POINTS);
  assert.equal(computeMissionPoints(true, 'wrong', false), 0);
  assert.equal(computeMissionPoints(true, 'no_answer', false), 0);
});
