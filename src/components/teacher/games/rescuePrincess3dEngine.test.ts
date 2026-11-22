import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';
import {
  C07_FINAL_GATE_POINTS,
  C07_MAX_TOTAL_POINTS,
  C07_SAMPLE_BADGE,
  C07_SAMPLE_FINAL_GATE_QUESTION,
  C07_ZONE_POINTS,
  C07_ZONE_TEMPLATES,
  adaptBankQuestionsForC07,
  advanceInsideC07Zone,
  attemptOpenC07FinalGate,
  clearC07Session,
  computeC07Summary,
  createDefaultC07SetupConfig,
  enterC07Zone,
  finishC07ToSummary,
  getC07KeysCollectedCount,
  getC07SessionStorageKey,
  loadC07Session,
  markC07ZoneSolutionViewed,
  pickNextC07Student,
  returnToC07CastleMap,
  revealC07Hint,
  saveC07Session,
  skipC07RevealAnimation,
  startC07Rescue,
  submitC07FinalGateAnswer,
  submitC07TeamWhiteboard,
  submitC07ZoneChallenge,
} from './rescuePrincess3dEngine';

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

test('C07 sample pack has 3 zones x 3 Qs + 1 final gate Q (10 total), tagged Dữ liệu mẫu, valid KaTeX, and 4x6 rectangle area question', () => {
  assert.equal(C07_ZONE_TEMPLATES.length, 3);
  const allQuestions = [
    ...C07_ZONE_TEMPLATES.flatMap((z) => z.sampleQuestions),
    C07_SAMPLE_FINAL_GATE_QUESTION,
  ];
  assert.equal(allQuestions.length, 10);

  const rectQ = C07_ZONE_TEMPLATES[2].sampleQuestions[0];
  assert.equal(rectQ.questionId, 'c07_geo_rect');
  assert.equal(rectQ.visualDiagram, 'rect_4x6');
  assert.ok(rectQ.stem.includes('Hình chữ nhật cạnh'));
  assert.ok(rectQ.stem.includes('4') && rectQ.stem.includes('6'));
  assert.ok(
    rectQ.options.some((o) => o.optionId === rectQ.correctOptionId && o.text.includes('24'))
  );
  assert.ok(rectQ.explanationText.includes('4 \\times 6 = 24'));

  for (const q of allQuestions) {
    assert.equal(q.sourceTag, C07_SAMPLE_BADGE);
    assert.equal(q.options.length, 4);
    assert.ok(q.options.some((o) => o.optionId === q.correctOptionId));
    assert.ok(renderTextWithMathStrict(q.stem).length > 0);
    for (const opt of q.options) {
      assert.ok(renderTextWithMathStrict(opt.text).length > 0);
    }
    assert.ok(renderTextWithMathStrict(q.hintText).length > 0);
    assert.ok(renderTextWithMathStrict(q.explanationText).length > 0);
  }
});

test('Missing keys at Final Gate triggers final_gate_locked; hint vs independent vs viewed-solution scoring reconciles cleanly', () => {
  let state = startC07Rescue({
    config: createDefaultC07SetupConfig({ shuffleOptions: true }),
    shuffleSeed: 'c07_keys_test',
    nowMs: 1000,
  }).state!;

  // Attempt opening Final Gate early with 0/3 keys
  state = attemptOpenC07FinalGate(state, 1050);
  assert.equal(state.phase, 'final_gate_locked');
  assert.ok(state.lastActionNotice.includes('3/3 chìa khóa'));

  // Zone 1: Q1 independent (+10), Q2 with hint (+10 -> correct_with_hint), Q3 wrong + view solution (0)
  state = enterC07Zone(state, 'zone_fractions', 1100);
  // Q1 independent
  state = submitC07ZoneChallenge({
    state,
    turnToken: state.turnToken,
    optionId: state.zones[0].challenges[0].question.correctOptionId,
  });
  assert.equal(state.zones[0].challenges[0].status, 'correct_independent');
  assert.equal(state.zones[0].challenges[0].pointsAwarded, C07_ZONE_POINTS);

  state = advanceInsideC07Zone(state, 1120);
  // Q2 with hint
  state = revealC07Hint(state);
  state = submitC07ZoneChallenge({
    state,
    turnToken: state.turnToken,
    optionId: state.zones[0].challenges[1].question.correctOptionId,
  });
  assert.equal(state.zones[0].challenges[1].status, 'correct_with_hint');
  assert.equal(state.zones[0].challenges[1].pointsAwarded, C07_ZONE_POINTS);

  state = advanceInsideC07Zone(state, 1140);
  // Q3 wrong + mark solution viewed
  const wrongQ3 = state.zones[0].challenges[2].question.options.find(
    (o) => o.optionId !== state.zones[0].challenges[2].question.correctOptionId
  )!;
  state = submitC07ZoneChallenge({
    state,
    turnToken: state.turnToken,
    optionId: wrongQ3.optionId,
  });
  assert.equal(state.zones[0].keyAwarded, false);
  state = markC07ZoneSolutionViewed(state, 2);
  assert.equal(state.zones[0].challenges[2].status, 'wrong_viewed_solution');
  assert.equal(state.zones[0].challenges[2].pointsAwarded, 0);
  assert.equal(state.zones[0].keyAwarded, true);

  state = returnToC07CastleMap(state, 1180);
  assert.equal(getC07KeysCollectedCount(state), 1);

  // Attempt Final Gate with 1/3 keys -> still locked, missing 2/3 keys
  state = attemptOpenC07FinalGate(state, 1200);
  assert.equal(state.phase, 'final_gate_locked');
  assert.ok(state.lastActionNotice.includes('thiếu 2/3 chìa khóa'));
  assert.ok(state.lastActionNotice.includes('Tháp Thống Kê'));
  assert.ok(state.lastActionNotice.includes('Cầu Hình Học'));

  // Finish failing run summary check
  const summaryPartial = computeC07Summary(finishC07ToSummary(state));
  assert.equal(summaryPartial.independentCorrectCount, 1);
  assert.equal(summaryPartial.assistedCorrectCount, 1);
  assert.equal(summaryPartial.viewedSolutionCount, 1);
  assert.equal(summaryPartial.totalScore, 20);
  assert.equal(summaryPartial.keysCollected, 1);
  assert.equal(summaryPartial.keysMissing, 2);
});

test('Double-grading Final Gate is strictly blocked: max score is 120 (never 150) and princessRescued becomes true', () => {
  let state = startC07Rescue({
    config: createDefaultC07SetupConfig({ shuffleOptions: false }),
    nowMs: 2000,
  }).state!;

  // Complete all 3 zones perfectly (9 * 10 = 90 pts)
  for (const tpl of C07_ZONE_TEMPLATES) {
    state = enterC07Zone(state, tpl.zoneId, 2100);
    for (let idx = 0; idx < 3; idx++) {
      const z = state.zones.find((item) => item.zoneId === tpl.zoneId)!;
      state = submitC07ZoneChallenge({
        state,
        turnToken: state.turnToken,
        optionId: z.challenges[idx].question.correctOptionId,
      });
      state = advanceInsideC07Zone(state, 2110 + idx);
    }
  }

  assert.equal(getC07KeysCollectedCount(state), 3);
  assert.equal(state.score, 90);

  // Open Final Gate
  state = attemptOpenC07FinalGate(state, 3000);
  assert.equal(state.phase, 'final_gate_challenge');
  const fgToken = state.turnToken;

  // Grade Final Gate ONCE (+30 -> 120)
  state = submitC07FinalGateAnswer({
    state,
    turnToken: fgToken,
    optionId: state.finalGate.question.correctOptionId,
  });
  assert.equal(state.phase, 'final_gate_revealed');
  assert.equal(state.finalGateOpened, true);
  assert.equal(state.princessRescued, true);
  assert.equal(state.score, C07_MAX_TOTAL_POINTS);
  assert.equal(state.finalGate.pointsAwarded, C07_FINAL_GATE_POINTS);

  // Attempt double-grading Final Gate with same turnToken OR teacher confirm
  const afterDouble1 = submitC07FinalGateAnswer({
    state,
    turnToken: fgToken,
    optionId: state.finalGate.question.correctOptionId,
  });
  const afterDouble2 = submitC07FinalGateAnswer({
    state: afterDouble1,
    turnToken: afterDouble1.turnToken,
    teacherConfirmCorrect: true,
  });
  assert.equal(afterDouble2.score, 120);
  assert.equal(afterDouble2.finalGate.pointsAwarded, 30);

  // Skip animation preserves locked state
  const skippedAnim = skipC07RevealAnimation(afterDouble2);
  assert.equal(skippedAnim.revealAnimDone, true);
  assert.equal(skippedAnim.princessRescued, true);
  assert.equal(skippedAnim.score, 120);

  const summary = computeC07Summary(finishC07ToSummary(skippedAnim));
  assert.equal(summary.zoneScore, 90);
  assert.equal(summary.finalGateScore, 30);
  assert.equal(summary.totalScore, 120);
  assert.equal(summary.maxScore, 120);
  assert.equal(summary.independentCorrectCount, 10);
});

test('Teacher projector workflow with 50 students & whiteboard hold mode (Đã nộp -> Chốt & Công bố) reconciles per-question scores with summary', () => {
  const fiftyStudents = Array.from({ length: 50 }, (_, i) => ({
    id: `stu_${i + 1}`,
    fullName: `Học sinh ${i + 1}`,
  }));

  let state = startC07Rescue({
    config: createDefaultC07SetupConfig({
      participationMode: 'class_teams',
      teamCount: 5,
      whiteboardHoldMode: true,
      classStudents: fiftyStudents,
      shuffleOptions: false,
    }),
    nowMs: 4000,
  }).state!;

  assert.equal(state.teams.length, 5);
  assert.equal(
    state.teams.reduce((sum, t) => sum + t.studentNames.length, 0),
    50
  );
  state = pickNextC07Student(state);
  assert.ok(state.activeCallerStudent);

  state = enterC07Zone(state, 'zone_geometry', 4100);
  const q0 = state.zones[2].challenges[0].question;
  const wrongOpt = q0.options.find((o) => o.optionId !== q0.correctOptionId)!;

  // Team 1 & Team 2 hold mini-whiteboard answers BEFORE teacher reveals ('Đã nộp')
  state = submitC07TeamWhiteboard({
    state,
    teamId: state.teams[0].id,
    optionId: q0.correctOptionId,
  });
  state = submitC07TeamWhiteboard({
    state,
    teamId: state.teams[1].id,
    optionId: wrongOpt.optionId,
  });

  // Status must be 'submitted' and score MUST STILL BE 0 before teacher commits!
  assert.equal(state.zones[2].challenges[0].status, 'submitted');
  assert.equal(state.score, 0);

  // Teacher clicks 'Chốt đáp án & Công bố'
  state = submitC07ZoneChallenge({
    state,
    turnToken: state.turnToken,
    commitHeldWhiteboard: true,
  });
  assert.equal(state.phase, 'zone_revealed');
  assert.equal(state.zones[2].challenges[0].status, 'correct_independent');
  assert.equal(state.zones[2].challenges[0].pointsAwarded, 10);
  assert.equal(state.teams[0].score, 10);
  assert.equal(state.teams[1].score, 0);

  // Per-question points sum strictly equals summary totalScore
  const perQuestionSum =
    state.zones.reduce(
      (sum, z) => sum + z.challenges.reduce((s, c) => s + c.pointsAwarded, 0),
      0
    ) + state.finalGate.pointsAwarded;
  const summary = computeC07Summary(finishC07ToSummary(state));
  assert.equal(summary.totalScore, perQuestionSum);
  assert.equal(summary.totalScore, 10);
});

test('Smart EDU Bank RBAC adapter blocks unapproved questions for student and adapts approved ones for C07', () => {
  const mockBank: Question[] = [
    {
      id: 'c07_ok',
      code: 'TOAN-6-01',
      subject: 'Toán',
      grade: '6',
      chapter: 'Hình học',
      lesson: 'Hình chữ nhật',
      level: 'know',
      textbook: 'Kết nối tri thức',
      type: 'single_choice',
      stem: 'Diện tích hình chữ nhật cạnh \\(4\\) và \\(6\\) bằng bao nhiêu?',
      options: [
        { id: 'a1', label: 'A', text: '\\(24\\)' },
        { id: 'a2', label: 'B', text: '\\(10\\)' },
      ],
      correctAnswer: 'a1',
      explanation: '\\(4 \\times 6 = 24\\).',
      points: 1,
      author: 'GV Tây Đô',
      version: 1,
      status: 'approved',
    },
    {
      id: 'c07_draft',
      code: 'TOAN-6-02',
      subject: 'Toán',
      grade: '6',
      chapter: 'Nháp',
      lesson: 'Nháp',
      level: 'know',
      textbook: 'Cánh Diều',
      type: 'single_choice',
      stem: 'Câu nháp',
      options: [
        { id: 'b1', label: 'A', text: '1' },
        { id: 'b2', label: 'B', text: '2' },
      ],
      correctAnswer: 'A',
      explanation: 'Nháp',
      points: 1,
      author: 'GV Tây Đô',
      version: 1,
      status: 'draft',
    },
  ];

  const forStudent = adaptBankQuestionsForC07(mockBank, 'student');
  assert.equal(forStudent.length, 1);
  assert.equal(forStudent[0].questionId, 'bank_c07_ok');

  const forTeacher = adaptBankQuestionsForC07(mockBank, 'teacher');
  assert.equal(forTeacher.length, 2);
});

test('Demo-isolated /demo session persistence saves/restores cleanly, clears transient flags, and recovers from corrupt JSON', () => {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as any).window;
  (globalThis as any).window = {
    location: { pathname: '/demo' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };

  try {
    assert.ok(getC07SessionStorageKey().startsWith(KHKT_DEMO_STORAGE_PREFIX));
    let state = startC07Rescue({
      config: createDefaultC07SetupConfig(),
      nowMs: 7000,
    }).state!;
    state = enterC07Zone(state, 'zone_statistics', 7010);
    assert.equal(saveC07Session(state, 7020), true);

    const restored = loadC07Session();
    assert.ok(restored);
    assert.equal(restored!.activeZoneId, 'zone_statistics');
    assert.ok(restored!.zones.every((z) => z.keyNewlyAwarded === false));

    store.set(getC07SessionStorageKey(), '{invalid-json');
    assert.equal(loadC07Session(), null);
    assert.equal(store.has(getC07SessionStorageKey()), false);

    clearC07Session();
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

test('Headless EduGameSoundBank executes C07 audio cues safely without crashing', () => {
  const sb = new EduGameSoundBank();
  sb.setActiveTurnToken('c07_audio_turn');
  sb.playPrincessEnterZone(false, 'c07_audio_turn');
  sb.playPrincessKeyAwarded(false, 'c07_audio_turn');
  sb.playPrincessGateRescue(false, true, 'c07_audio_turn');
  sb.playPrincessGateRescue(false, false, 'c07_audio_turn');
  sb.stopAll();
  sb.dispose();
  assert.ok(true);
});
