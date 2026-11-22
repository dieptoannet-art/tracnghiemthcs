import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';
import {
  C06_MAX_TOTAL_POINTS,
  C06_SAMPLE_BADGE,
  C06_SAMPLE_CHEST_QUESTION,
  C06_STATION_TEMPLATES,
  adaptBankQuestionsForC06,
  advanceInsideC06Station,
  attemptOpenC06Chest,
  clearC06Session,
  computeC06Summary,
  createDefaultC06SetupConfig,
  enterC06Station,
  finishC06ToSummary,
  getC06CollectedShardCount,
  getC06SessionStorageKey,
  loadC06Session,
  markC06SolutionViewed,
  pickNextC06Student,
  returnToC06Map,
  revealC06Hint,
  saveC06Session,
  skipC06RevealAnimation,
  startC06Adventure,
  submitC06ChestAnswer,
  submitC06StationAnswer,
} from './treasureHunt3dEngine';

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

test('C06 sample pack has 6 stations x 2 Qs + 1 chest Q (13 total) tagged Dữ liệu mẫu with valid KaTeX including 9/12=3/4', () => {
  assert.equal(C06_STATION_TEMPLATES.length, 6);
  const arith1 = C06_STATION_TEMPLATES[0].sampleQuestions[0];
  assert.equal(arith1.questionId, 'c06_arith_1');
  assert.ok(arith1.stem.includes('\\dfrac{9}{12}'));
  assert.ok(arith1.options.some((o) => o.optionId === arith1.correctOptionId && o.text.includes('\\dfrac{3}{4}')));

  const allQuestions = [
    ...C06_STATION_TEMPLATES.flatMap((t) => t.sampleQuestions),
    C06_SAMPLE_CHEST_QUESTION,
  ];
  assert.equal(allQuestions.length, 13);

  for (const q of allQuestions) {
    assert.equal(q.sourceTag, C06_SAMPLE_BADGE);
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

test('Free-order exploration across two different station orders preserves scoring (11 correct + chest = 140 pts, max 150 pts)', () => {
  // Order A: forward with 1 wrong + guide view -> 11 correct + chest = 140 pts
  const orderA = C06_STATION_TEMPLATES.map((t) => t.stationId);
  let stateA = startC06Adventure({
    config: createDefaultC06SetupConfig({ shuffleOptions: true }),
    shuffleSeed: 'orderA_seed',
    nowMs: 1000,
  }).state!;

  orderA.forEach((stId, sIdx) => {
    stateA = enterC06Station(stateA, stId, 2000 + sIdx * 100);
    // Q1
    const q0 = stateA.stations.find((s) => s.stationId === stId)!.questions[0].question;
    if (sIdx === 2) {
      // Wrong on station 3 Q1, then mark solution viewed -> 0 pts, still earns shard after Q2
      const wrongOpt = q0.options.find((o) => o.optionId !== q0.correctOptionId)!;
      stateA = submitC06StationAnswer({
        state: stateA,
        turnToken: stateA.turnToken,
        optionId: wrongOpt.optionId,
        nowMs: 2010 + sIdx * 100,
      });
      stateA = markC06SolutionViewed(stateA, 0);
    } else {
      stateA = submitC06StationAnswer({
        state: stateA,
        turnToken: stateA.turnToken,
        optionId: q0.correctOptionId,
        nowMs: 2010 + sIdx * 100,
      });
    }
    stateA = advanceInsideC06Station(stateA, 2020 + sIdx * 100);
    // Q2
    const q1 = stateA.stations.find((s) => s.stationId === stId)!.questions[1].question;
    stateA = submitC06StationAnswer({
      state: stateA,
      turnToken: stateA.turnToken,
      optionId: q1.correctOptionId,
      nowMs: 2030 + sIdx * 100,
    });
    stateA = advanceInsideC06Station(stateA, 2040 + sIdx * 100);
  });

  assert.deepEqual(stateA.visitedOrder, orderA);
  assert.equal(getC06CollectedShardCount(stateA), 6);
  assert.equal(stateA.score, 110);

  // Unlock chest and answer correctly -> 110 + 30 = 140 pts
  stateA = attemptOpenC06Chest(stateA, 4000);
  assert.equal(stateA.phase, 'chest_question');
  stateA = submitC06ChestAnswer({
    state: stateA,
    turnToken: stateA.turnToken,
    optionId: stateA.chestQuestion.question.correctOptionId,
  });
  stateA = skipC06RevealAnimation(stateA);
  assert.equal(stateA.revealAnimDone, true);
  stateA = finishC06ToSummary(stateA);

  const summaryA = computeC06Summary(stateA);
  assert.equal(summaryA.totalScore, 140);
  assert.equal(summaryA.stationCorrectFirstTry, 11);
  assert.equal(summaryA.stationWrongViewedGuide, 1);
  assert.equal(summaryA.chestCorrect, true);

  // Check strict separation between firstTryCorrect and viewedSolution
  const st3Q0 = stateA.stations[2].questions[0];
  assert.equal(st3Q0.firstTryCorrect, false);
  assert.equal(st3Q0.viewedSolution, true);
  assert.equal(st3Q0.pointsAwarded, 0);

  // Order B: reverse order, all 12 + chest = 150 max pts
  const orderB = [...orderA].reverse();
  let stateB = startC06Adventure({
    config: createDefaultC06SetupConfig({ shuffleOptions: true }),
    shuffleSeed: 'orderB_seed',
    nowMs: 5000,
  }).state!;

  orderB.forEach((stId, sIdx) => {
    stateB = enterC06Station(stateB, stId, 6000 + sIdx * 100);
    const q0 = stateB.stations.find((s) => s.stationId === stId)!.questions[0].question;
    stateB = submitC06StationAnswer({
      state: stateB,
      turnToken: stateB.turnToken,
      optionId: q0.correctOptionId,
      nowMs: 6010 + sIdx * 100,
    });
    stateB = advanceInsideC06Station(stateB, 6020 + sIdx * 100);
    const q1 = stateB.stations.find((s) => s.stationId === stId)!.questions[1].question;
    stateB = submitC06StationAnswer({
      state: stateB,
      turnToken: stateB.turnToken,
      optionId: q1.correctOptionId,
      nowMs: 6030 + sIdx * 100,
    });
    stateB = advanceInsideC06Station(stateB, 6040 + sIdx * 100);
  });

  assert.deepEqual(stateB.visitedOrder, orderB);
  stateB = attemptOpenC06Chest(stateB, 8000);
  stateB = submitC06ChestAnswer({
    state: stateB,
    turnToken: stateB.turnToken,
    optionId: stateB.chestQuestion.question.correctOptionId,
  });
  const summaryB = computeC06Summary(finishC06ToSummary(stateB));
  assert.equal(summaryB.totalScore, C06_MAX_TOTAL_POINTS);
});

test('Leaving a station mid-way after Q1 preserves Q2 upon returning without changing questions, and early chest shows missing shards', () => {
  let state = startC06Adventure({
    config: createDefaultC06SetupConfig({ shuffleOptions: false }),
    nowMs: 100,
  }).state!;

  // Visit station_geometry, answer Q1, then leave back to map BEFORE answering Q2
  state = enterC06Station(state, 'station_geometry', 200);
  const originalQ0Id = state.stations.find((s) => s.stationId === 'station_geometry')!.questions[0].question.questionId;
  const originalQ1Id = state.stations.find((s) => s.stationId === 'station_geometry')!.questions[1].question.questionId;

  state = revealC06Hint(state);
  assert.equal(state.activeHintRevealed, true);

  state = submitC06StationAnswer({
    state,
    turnToken: state.turnToken,
    optionId: state.stations.find((s) => s.stationId === 'station_geometry')!.questions[0].question.correctOptionId,
    nowMs: 210,
  });
  state = returnToC06Map(state, 220);
  assert.equal(state.phase, 'map');
  const midSt = state.stations.find((s) => s.stationId === 'station_geometry')!;
  assert.equal(midSt.status, 'in_progress');
  assert.equal(midSt.shardCollected, false);

  // Attempt to open chest early with 0/6 shards -> chest_locked_notice with missing 6 shards & 120 pts available (110 remaining)
  state = attemptOpenC06Chest(state, 230);
  assert.equal(state.phase, 'chest_locked_notice');
  assert.ok(state.lastActionNotice.includes('thiếu 6 mảnh'));
  assert.ok(state.lastActionNotice.includes('110 điểm trạm'));

  // Return to station_geometry -> MUST resume directly at Q2 with unchanged questions!
  state = enterC06Station(state, 'station_geometry', 240);
  assert.equal(state.phase, 'station_question');
  const resumedSt = state.stations.find((s) => s.stationId === 'station_geometry')!;
  assert.equal(resumedSt.activeQuestionIndex, 1);
  assert.equal(resumedSt.questions[0].question.questionId, originalQ0Id);
  assert.equal(resumedSt.questions[1].question.questionId, originalQ1Id);
});

test('Class teams (1-50 students) & projector oral confirmation score accurately without double-counting', () => {
  const fiftyStudents = Array.from({ length: 50 }, (_, i) => ({
    id: `hs_${i + 1}`,
    fullName: `Học sinh ${i + 1}`,
  }));

  let state = startC06Adventure({
    config: createDefaultC06SetupConfig({
      participationMode: 'class_teams',
      teamCount: 4,
      oralProjectorMode: true,
      classStudents: fiftyStudents,
    }),
    nowMs: 500,
  }).state!;

  assert.equal(state.teams.length, 4);
  assert.equal(state.teams.reduce((s, t) => s + t.studentNames.length, 0), 50);

  state = pickNextC06Student(state);
  assert.ok(state.activeCallerStudent);

  state = enterC06Station(state, 'station_arithmetic', 510);
  const lockedTurn = state.turnToken;
  state = submitC06StationAnswer({
    state,
    turnToken: lockedTurn,
    teacherConfirmCorrect: true,
    nowMs: 520,
  });
  // Replay protection with stale turnToken does nothing
  const replayed = submitC06StationAnswer({
    state,
    turnToken: lockedTurn,
    teacherConfirmCorrect: true,
    nowMs: 525,
  });
  assert.equal(replayed.score, 10);
  assert.equal(replayed.teams[0].score, 10);
});

test('Smart EDU Bank RBAC adapter excludes unapproved questions for student and adapts valid single-choice questions', () => {
  const mockBank: Question[] = [
    {
      id: 'q_approved',
      code: 'TOAN-7-001',
      subject: 'Toán',
      grade: '7',
      chapter: 'Số hữu tỉ',
      lesson: 'Phân số',
      level: 'know',
      textbook: 'Kết nối tri thức',
      type: 'single_choice',
      stem: '\\(\\dfrac{1}{2} + \\dfrac{1}{4} = ?\\)',
      options: [
        { id: 'o1', label: 'A', text: '\\(\\dfrac{3}{4}\\)' },
        { id: 'o2', label: 'B', text: '\\(\\dfrac{2}{6}\\)' },
      ],
      correctAnswer: 'o1',
      explanation: 'Quy đồng mẫu số chung là 4: 2/4 + 1/4 = 3/4.',
      points: 1,
      author: 'GV Tây Đô',
      version: 1,
      status: 'approved',
    },
    {
      id: 'q_draft',
      code: 'TOAN-7-002',
      subject: 'Toán',
      grade: '7',
      chapter: 'Nháp',
      lesson: 'Nháp',
      level: 'know',
      textbook: 'Cánh Diều',
      type: 'single_choice',
      stem: 'Draft question',
      options: [
        { id: 'o1', label: 'A', text: '1' },
        { id: 'o2', label: 'B', text: '2' },
      ],
      correctAnswer: 'A',
      explanation: 'Draft',
      points: 1,
      author: 'GV Tây Đô',
      version: 1,
      status: 'draft',
    },
  ];

  const studentAdapted = adaptBankQuestionsForC06(mockBank, 'student');
  assert.equal(studentAdapted.length, 1);
  assert.equal(studentAdapted[0].questionId, 'bank_q_approved');

  const teacherAdapted = adaptBankQuestionsForC06(mockBank, 'teacher');
  assert.equal(teacherAdapted.length, 2);
});

test('Demo-isolated persistence saves/restores safely, clears shardNewlyAwarded, and recovers from corrupt JSON', () => {
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
    assert.ok(getC06SessionStorageKey().startsWith(KHKT_DEMO_STORAGE_PREFIX));
    let state = startC06Adventure({
      config: createDefaultC06SetupConfig(),
      nowMs: 900,
    }).state!;
    state = enterC06Station(state, 'station_powers', 910);
    assert.equal(saveC06Session(state, 920), true);

    const restored = loadC06Session();
    assert.ok(restored);
    assert.equal(restored!.activeStationId, 'station_powers');
    assert.ok(restored!.stations.every((st) => st.shardNewlyAwarded === false));

    // Corrupt JSON test
    store.set(getC06SessionStorageKey(), '{broken-json');
    assert.equal(loadC06Session(), null);
    assert.equal(store.has(getC06SessionStorageKey()), false);

    clearC06Session();
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

test('Headless EduGameSoundBank executes C06 audio cues safely without crashing', () => {
  const sb = new EduGameSoundBank();
  sb.setActiveTurnToken('c06_test_turn');
  sb.playTreasureMapRustle(false, 'c06_test_turn');
  sb.playTreasureAnswerCue(false, true, 'c06_test_turn');
  sb.playTreasureShardCollect(false, 'c06_test_turn');
  sb.playTreasureChestOpen(false, true, 'c06_test_turn');
  sb.stopAll();
  sb.dispose();
  assert.ok(true);
});
