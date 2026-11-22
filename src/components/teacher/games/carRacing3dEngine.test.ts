import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  D04_SAMPLE_BADGE,
  D04_SAMPLE_PACK_TITLE,
  D04_SAMPLE_QUESTIONS,
  D04_SESSION_STORAGE_KEY,
  advanceCarRaceToNextQuestion,
  buildD04QuestionPool,
  clearD04Session,
  commitCarRaceTurnResult,
  computeCarRaceStandings,
  computeTrackTotalStages,
  createCarRaceTeams,
  createDefaultCarRaceConfig,
  createInitialCarRaceMatchState,
  editLastConfirmedCarRaceTurn,
  endCarRaceEarly,
  evaluateCarRaceSoloAnswer,
  getD04SessionStorageKey,
  loadD04Session,
  prepareCarRaceQuestions,
  previewCarRaceTurnOutcomes,
  saveD04Session,
  shuffleCarRaceOptionsPreservingId,
  validateCarRaceSetupConfig,
} from './carRacing3dEngine';
import { renderMathToHtml } from '../../MathView';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';

function createMemoryWindow(pathname = '/') {
  const store = new Map<string, string>();
  const mockWindow = {
    location: { pathname },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, String(v));
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    },
  };
  return { mockWindow, store };
}

describe('D04 — Đua xe tốc độ 3D: Turbo & Deterministic Race Engine', () => {
  it('computes exact track stages: N (Turbo OFF) and N + floor(N/3) (Turbo ON; 10Q => 13 stages)', () => {
    assert.equal(computeTrackTotalStages(5, false), 5);
    assert.equal(computeTrackTotalStages(5, true), 6);
    assert.equal(computeTrackTotalStages(10, false), 10);
    assert.equal(computeTrackTotalStages(10, true), 13);
    assert.equal(computeTrackTotalStages(15, false), 15);
    assert.equal(computeTrackTotalStages(15, true), 20);
  });

  it('verifies exact prompt acceptance case 1: Đúng–Đúng–Đúng–Sai–Đúng => 4 đúng, 1 Turbo, 5 chặng, chuỗi hiện tại 1', () => {
    const config = createDefaultCarRaceConfig('team_race', 2);
    config.questionCount = 10;
    config.turboEnabled = true;
    config.shuffleQuestions = false;
    config.shuffleOptions = false;

    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    let state = createInitialCarRaceMatchState(config, questions);
    assert.equal(state.totalStages, 13);

    const seq: Array<'correct' | 'incorrect'> = [
      'correct',
      'correct',
      'correct',
      'incorrect',
      'correct',
    ];

    seq.forEach((v, idx) => {
      // Check preview before Q3 triggers Turbo!
      if (idx === 2) {
        const preview = previewCarRaceTurnOutcomes(state, { car_1: 'correct', car_2: 'incorrect' });
        assert.equal(preview.car_1.willTriggerTurbo, true);
        assert.equal(preview.car_1.stagesGained, 2);
      }

      const res = commitCarRaceTurnResult(state, {
        question: questions[idx],
        verdictsByTeam: { car_1: v, car_2: 'incorrect' },
        resultSource: 'teacher_single_device',
      });
      assert.equal(res.committed, true);
      state = advanceCarRaceToNextQuestion(res.state);
    });

    const car1 = state.teamRuntime.car_1;
    assert.equal(car1.correctCount, 4);
    assert.equal(car1.turboCount, 1);
    assert.equal(car1.stage, 5);
    assert.equal(car1.currentStreak, 1);

    // Car 2 missed all 5 -> stays at 0, streak 0
    assert.equal(state.teamRuntime.car_2.stage, 0);
    assert.equal(state.teamRuntime.car_2.currentStreak, 0);
  });

  it('verifies exact prompt acceptance case 2: 6 câu đúng liên tiếp => 6 đúng, 2 lần Turbo, 8 chặng, chuỗi 0', () => {
    const config = createDefaultCarRaceConfig('solo_practice');
    config.questionCount = 10;
    config.turboEnabled = true;
    config.shuffleQuestions = false;
    config.shuffleOptions = false;

    assert.equal(config.teams.length, 1); // Strictly 1 car, zero fake AI opponents!
    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    let state = createInitialCarRaceMatchState(config, questions);

    for (let i = 0; i < 6; i++) {
      const evalRes = evaluateCarRaceSoloAnswer(questions[i], {
        selectedOptionId: questions[i].correctOptionId,
      });
      assert.equal(evalRes.isCorrect, true);

      const res = commitCarRaceTurnResult(state, {
        question: questions[i],
        verdictsByTeam: { car_solo: 'correct' },
        resultSource: 'student_auto',
      });
      assert.equal(res.committed, true);
      state = advanceCarRaceToNextQuestion(res.state);
    }

    const solo = state.teamRuntime.car_solo;
    assert.equal(solo.correctCount, 6);
    assert.equal(solo.turboCount, 2);
    assert.equal(solo.stage, 8);
    assert.equal(solo.currentStreak, 0);
  });

  it('when Turbo is OFF, each correct answer advances strictly +1 stage with 0 Turbo and 0 streak', () => {
    const config = createDefaultCarRaceConfig('team_race', 2);
    config.turboEnabled = false;
    config.questionCount = 6;
    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    let state = createInitialCarRaceMatchState(config, questions);
    assert.equal(state.totalStages, 6);

    for (let i = 0; i < 6; i++) {
      const res = commitCarRaceTurnResult(state, {
        question: questions[i],
        verdictsByTeam: { car_1: 'correct', car_2: i % 2 === 0 ? 'correct' : 'no_answer' },
        resultSource: 'teacher_single_device',
      });
      state = advanceCarRaceToNextQuestion(res.state);
    }

    assert.equal(state.status, 'finished');
    assert.equal(state.teamRuntime.car_1.stage, 6);
    assert.equal(state.teamRuntime.car_1.correctCount, 6);
    assert.equal(state.teamRuntime.car_1.turboCount, 0);
    assert.equal(state.teamRuntime.car_1.currentStreak, 0);
    assert.equal(state.teamRuntime.car_2.stage, 3);
  });

  it('supports 6 teams simultaneously and computes tie-aware standings (Đồng hạng) strictly by total stage', () => {
    const config = createDefaultCarRaceConfig('team_race', 6);
    config.teams = createCarRaceTeams(6);
    config.questionCount = 5;
    config.turboEnabled = true;

    const validation = validateCarRaceSetupConfig(config, D04_SAMPLE_QUESTIONS.length);
    assert.equal(validation.valid, true);
    assert.equal(validation.totalStages, 6);

    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    let state = createInitialCarRaceMatchState(config, questions);

    // Turn 1..3: car_1 and car_2 both get 3 right in a row -> both trigger Turbo -> both reach stage 4 (tied #1!)
    // car_3 gets 2 right -> stage 2 (#3); car_4..6 get 0 right -> stage 0 (tied #4)
    for (let i = 0; i < 3; i++) {
      const res = commitCarRaceTurnResult(state, {
        question: questions[i],
        verdictsByTeam: {
          car_1: 'correct',
          car_2: 'correct',
          car_3: i < 2 ? 'correct' : 'incorrect',
          car_4: 'incorrect',
          car_5: 'no_answer',
          car_6: 'incorrect',
        },
        resultSource: 'teacher_single_device',
      });
      state = advanceCarRaceToNextQuestion(res.state);
    }

    // End early after 3 of 5 questions -> verify unplayed questions separated from incorrect!
    const early = endCarRaceEarly(state);
    assert.equal(early.status, 'ended_early');
    assert.equal(early.endedEarly, true);
    assert.equal(early.questionsGraded, 3);
    assert.equal(early.questionsUnplayed, 2);

    const standings = computeCarRaceStandings(early);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[0].isTied, true);
    assert.equal(standings[0].stage, 4);
    assert.equal(standings[1].rank, 1);
    assert.equal(standings[1].isTied, true);
    assert.equal(standings[1].stage, 4);
    assert.equal(standings[2].rank, 3);
    assert.equal(standings[2].isTied, false);
    assert.equal(standings[2].stage, 2);
    assert.equal(standings[3].rank, 4);
    assert.equal(standings[3].isTied, true);
    assert.equal(standings[4].rank, 4);
    assert.equal(standings[5].rank, 4);
  });

  it('edits the last confirmed turn cleanly: recomputes Turbo, streak, stage, and rank from history without stacking', () => {
    const config = createDefaultCarRaceConfig('team_race', 2);
    config.turboEnabled = true;
    config.questionCount = 5;
    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    let state = createInitialCarRaceMatchState(config, questions);

    // Q1 & Q2: car_1 right (stage 2, streak 2)
    for (let i = 0; i < 2; i++) {
      state = advanceCarRaceToNextQuestion(
        commitCarRaceTurnResult(state, {
          question: questions[i],
          verdictsByTeam: { car_1: 'correct', car_2: 'incorrect' },
          resultSource: 'teacher_single_device',
        }).state
      );
    }

    // Q3: car_1 initially marked correct -> triggers Turbo (stage 4, turbo 1, streak 0)
    const c3 = commitCarRaceTurnResult(state, {
      question: questions[2],
      verdictsByTeam: { car_1: 'correct', car_2: 'incorrect' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(c3.state.teamRuntime.car_1.stage, 4);
    assert.equal(c3.state.teamRuntime.car_1.turboCount, 1);

    // Teacher edits Q3: car_1 was actually incorrect, car_2 was correct!
    const edited = editLastConfirmedCarRaceTurn(c3.state, {
      car_1: 'incorrect',
      car_2: 'correct',
    });
    assert.equal(edited.edited, true);
    assert.equal(edited.state.teamRuntime.car_1.stage, 2);
    assert.equal(edited.state.teamRuntime.car_1.correctCount, 2);
    assert.equal(edited.state.teamRuntime.car_1.turboCount, 0);
    assert.equal(edited.state.teamRuntime.car_1.currentStreak, 0);
    assert.equal(edited.state.teamRuntime.car_2.stage, 1);
    assert.equal(edited.state.teamRuntime.car_2.correctCount, 1);
    assert.equal(edited.state.teamRuntime.car_2.currentStreak, 1);
    assert.equal(edited.state.history[2].wasEdited, true);
  });

  it('blocks double-click duplicate commits and ungraded teams', () => {
    const config = createDefaultCarRaceConfig('team_race', 2);
    const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
    const initial = createInitialCarRaceMatchState(config, questions);

    const ungradedRes = commitCarRaceTurnResult(initial, {
      question: questions[0],
      verdictsByTeam: { car_1: 'correct', car_2: 'ungraded' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(ungradedRes.committed, false);
    assert.equal(ungradedRes.reason, 'ungraded_team');

    const first = commitCarRaceTurnResult(initial, {
      question: questions[0],
      verdictsByTeam: { car_1: 'correct', car_2: 'incorrect' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(first.committed, true);

    // Double-click duplicate on same questionId must NOT add another stage!
    const duplicate = commitCarRaceTurnResult(first.state, {
      question: questions[0],
      verdictsByTeam: { car_1: 'correct', car_2: 'correct' },
      resultSource: 'teacher_single_device',
    });
    assert.equal(duplicate.committed, false);
    assert.equal(duplicate.reason, 'duplicate_question_commit');
    assert.equal(duplicate.state.teamRuntime.car_1.stage, 1);
    assert.equal(duplicate.state.teamRuntime.car_2.stage, 0);
  });
});

describe('D04 — Sample Pack "Đua xe Toán THCS", KaTeX Rendering, Shuffle & RBAC', () => {
  it('contains all 10 exact Math questions tagged "Dữ liệu mẫu" and renders KaTeX cleanly', () => {
    assert.equal(D04_SAMPLE_PACK_TITLE, 'Đua xe Toán THCS');
    assert.equal(D04_SAMPLE_BADGE, 'Dữ liệu mẫu');
    assert.equal(D04_SAMPLE_QUESTIONS.length, 10);

    const expectedSnippets = [
      '72 : 8',
      '4^2 + 9',
      '-6 - 7',
      '\\frac{3}{5} + \\frac{1}{10}',
      '25\\%',
      '3x = 27',
      '5a - 2a',
      '12\\text{ m}',
      '150\\text{ m}',
      '60\\text{ km/h}',
    ];

    D04_SAMPLE_QUESTIONS.forEach((q, idx) => {
      assert.equal(q.isSample, true);
      assert.equal(q.sourceBadge, 'Dữ liệu mẫu');
      assert.ok(q.stem.includes(expectedSnippets[idx]), `Missing snippet on Q${idx + 1}`);
      const html = renderMathToHtml(q.stem);
      assert.ok(html.includes('katex'), `Expected KaTeX output on Q${idx + 1}`);
      assert.ok(!html.includes('katex-error'), `Unexpected KaTeX error on Q${idx + 1}`);
    });
  });

  it('preserves stable option IDs on shuffle, enforces RBAC, deduplicates, and never repeats questions', () => {
    const q = D04_SAMPLE_QUESTIONS[3]; // 3/5 + 1/10 = 7/10
    let seed = 17;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const shuffled = shuffleCarRaceOptionsPreservingId(q, rng);
    assert.equal(shuffled.correctOptionId, q.correctOptionId);
    const correctOpt = shuffled.options?.find((o) => o.id === shuffled.correctOptionId);
    assert.ok(correctOpt && correctOpt.text.includes('\\frac{7}{10}'));

    const bank: Question[] = [
      {
        id: 'q1',
        code: 'C1',
        type: 'single_choice',
        stem: 'Câu đã duyệt',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Ch1',
        lesson: 'B1',
        level: 'know',
        points: 1,
        explanation: 'Đáp án A',
        status: 'approved',
        author: 'GV',
        version: 1,
        options: [
          { id: 'o1', label: 'A', text: '1' },
          { id: 'o2', label: 'B', text: '2' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 'q2',
        code: 'C2',
        type: 'single_choice',
        stem: 'Câu chờ duyệt',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Ch1',
        lesson: 'B1',
        level: 'know',
        points: 1,
        explanation: 'Đáp án A',
        status: 'pending',
        author: 'GV',
        version: 1,
        options: [
          { id: 'o3', label: 'A', text: '3' },
          { id: 'o4', label: 'B', text: '4' },
        ],
        correctAnswer: 'A',
      },
      {
        id: 'q3',
        code: 'C3',
        type: 'single_choice',
        stem: 'Câu đã ẩn',
        subject: 'math',
        grade: '6',
        textbook: 'Kết nối tri thức',
        chapter: 'Ch1',
        lesson: 'B1',
        level: 'know',
        points: 1,
        explanation: 'Đáp án A',
        status: 'deprecated',
        author: 'GV',
        version: 1,
        options: [
          { id: 'o5', label: 'A', text: '5' },
          { id: 'o6', label: 'B', text: '6' },
        ],
        correctAnswer: 'A',
      },
    ];

    const studentPool = buildD04QuestionPool({
      sourceKind: 'bank',
      bankQuestions: bank,
      userRole: 'student',
    });
    assert.deepEqual(studentPool.map((x) => x.id), ['q1']);

    const teacherPool = buildD04QuestionPool({
      sourceKind: 'bank',
      bankQuestions: bank,
      userRole: 'teacher',
    });
    assert.deepEqual(teacherPool.map((x) => x.id), ['q1', 'q2']);

    // Requesting 15 questions from 10-question sample pack never repeats questions
    const cfg15 = createDefaultCarRaceConfig('team_race', 2);
    cfg15.questionCount = 15;
    const prepared15 = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, cfg15);
    assert.equal(prepared15.length, 10);
    assert.equal(new Set(prepared15.map((x) => x.id)).size, 10);
  });
});

describe('D04 — Session Persistence, /demo Isolation, Corrupt Recovery & Audio', () => {
  it('restores rules, question order & recomputes car stages/Turbo from history, isolates /demo, and recovers corrupt JSON', () => {
    const prevWindow = (globalThis as Record<string, unknown>).window;
    try {
      const normalEnv = createMemoryWindow('/teacher/games');
      (globalThis as Record<string, unknown>).window = normalEnv.mockWindow;
      assert.equal(getD04SessionStorageKey(), D04_SESSION_STORAGE_KEY);

      const config = createDefaultCarRaceConfig('team_race', 2);
      config.turboEnabled = true;
      config.questionCount = 5;
      const questions = prepareCarRaceQuestions(D04_SAMPLE_QUESTIONS, config);
      let state = createInitialCarRaceMatchState(config, questions);

      for (let i = 0; i < 3; i++) {
        state = advanceCarRaceToNextQuestion(
          commitCarRaceTurnResult(state, {
            question: questions[i],
            verdictsByTeam: { car_1: 'correct', car_2: 'incorrect' },
            resultSource: 'teacher_single_device',
          }).state
        );
      }

      saveD04Session(state);
      const loaded = loadD04Session();
      assert.equal(loaded.recoveredFromCorruption, false);
      assert.ok(loaded.state);
      assert.equal(loaded.state.teamRuntime.car_1.stage, 4);
      assert.equal(loaded.state.teamRuntime.car_1.turboCount, 1);
      assert.equal(loaded.state.currentQuestionIndex, 3);
      assert.equal(loaded.state.config.rulesLocked, true);

      // Corrupt JSON recovery
      normalEnv.mockWindow.localStorage.setItem(D04_SESSION_STORAGE_KEY, '{bad-json');
      const broken = loadD04Session();
      assert.equal(broken.state, null);
      assert.equal(broken.recoveredFromCorruption, true);
      assert.equal(normalEnv.mockWindow.localStorage.getItem(D04_SESSION_STORAGE_KEY), null);

      // /demo isolation
      const demoEnv = createMemoryWindow('/demo');
      (globalThis as Record<string, unknown>).window = demoEnv.mockWindow;
      assert.equal(
        getD04SessionStorageKey(),
        `${KHKT_DEMO_STORAGE_PREFIX}${D04_SESSION_STORAGE_KEY}`
      );
      saveD04Session(state);
      assert.ok(demoEnv.store.has(`${KHKT_DEMO_STORAGE_PREFIX}${D04_SESSION_STORAGE_KEY}`));
      assert.equal(demoEnv.store.has(D04_SESSION_STORAGE_KEY), false);

      clearD04Session();
      assert.equal(demoEnv.store.size, 0);
    } finally {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  });

  it('executes D04 car racing audio methods safely when muted or headless and stops engine via stopAll()', () => {
    const bank = new EduGameSoundBank();
    assert.doesNotThrow(() => {
      bank.playCarStartCountdown(true);
      bank.startCarEngineLoop(() => true);
      bank.playCarTurboBoost(true);
      bank.playCarFinishFanfare(true, false);
      bank.playCarFinishFanfare(true, true);

      bank.playCarStartCountdown(false);
      bank.startCarEngineLoop(() => false);
      bank.playCarTurboBoost(false);
      bank.playCarFinishFanfare(false, false);
      bank.playCarFinishFanfare(false, true);
      bank.stopCarEngineLoop();
      bank.stopAll();
    });
  });
});
