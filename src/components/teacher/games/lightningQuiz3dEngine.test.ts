import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';
import {
  B10_SAMPLE_BADGE,
  B10_SAMPLE_QUESTIONS,
  adjudicateB10Deadline,
  advanceB10Question,
  clearB10Session,
  computeB10Summary,
  createDefaultB10SetupConfig,
  getB10ActiveRemainingMs,
  loadB10Session,
  lockB10Option,
  markB10MediaReady,
  pauseB10Session,
  pickNextB10Student,
  resumeB10Session,
  revealB10Hint,
  saveB10Session,
  skipB10Question,
  skipB10RevealAnimation,
  startB10Session,
  adaptBankQuestionsForB10,
} from './lightningQuiz3dEngine';

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

test('B10 sample pack contains 10 questions tagged Dữ liệu mẫu including 3x=12 and sqrt(81) with valid KaTeX', () => {
  assert.equal(B10_SAMPLE_QUESTIONS.length, 10);
  const q1 = B10_SAMPLE_QUESTIONS[0];
  const q2 = B10_SAMPLE_QUESTIONS[1];
  assert.ok(q1.stem.includes('3x = 12'));
  assert.ok(q1.options.some((o) => o.optionId === q1.correctOptionId && o.text.includes('x = 4')));
  assert.ok(q2.stem.includes('\\sqrt{81}'));
  assert.ok(q2.options.some((o) => o.optionId === q2.correctOptionId && o.text.includes('9')));

  for (const q of B10_SAMPLE_QUESTIONS) {
    assert.equal(q.sourceTag, B10_SAMPLE_BADGE);
    assert.equal(q.options.length, 4);
    assert.ok(q.options.some((o) => o.optionId === q.correctOptionId));

    const stemHtml = renderTextWithMathStrict(q.stem);
    assert.ok(stemHtml.length > 0);
    for (const opt of q.options) {
      const optHtml = renderTextWithMathStrict(opt.text);
      assert.ok(optHtml.length > 0);
    }
    assert.ok(renderTextWithMathStrict(q.hintText).length > 0);
    assert.ok(renderTextWithMathStrict(q.explanationText).length > 0);
  }
});

test('10/10 correct answers with option shuffling locks strictly by optionId and scores exact 100 points', () => {
  const started = startB10Session({
    config: createDefaultB10SetupConfig({
      clockMode: 'per_question',
      perQuestionSec: 20,
      shuffleOptions: true,
    }),
    nowMs: 10000,
    shuffleSeed: 'seed_verify_option_id',
  });
  assert.equal(started.ok, true);
  let state = started.state!;

  // Verify Q2 (\sqrt{81}) options actually moved from index 0 under shuffleSeed or still resolve by optionId
  const q2 = state.questions[1];
  assert.ok(q2.stem.includes('\\sqrt{81}'));
  const correctOptQ2 = q2.options.find((o) => o.optionId === q2.correctOptionId)!;
  assert.ok(correctOptQ2.text.includes('9'));

  for (let i = 0; i < 10; i++) {
    const t = 10000 + i * 3000;
    state = markB10MediaReady(state, t + 50);
    assert.equal(state.phase, 'answering');

    const activeQ = state.questions[state.currentIndex];
    const tok = state.turnToken;
    state = lockB10Option({
      state,
      optionId: activeQ.correctOptionId,
      turnToken: tok,
      nowMs: t + 1200,
    });
    // Rapid duplicate click must be ignored
    const duplicate = lockB10Option({
      state,
      optionId: activeQ.correctOptionId,
      turnToken: tok,
      nowMs: t + 1250,
    });
    assert.equal(duplicate, state);
    assert.equal(state.phase, 'revealed');

    // Skip reveal animation preserves locked outcome & points
    state = skipB10RevealAnimation(state);
    assert.equal(state.revealAnimDone, true);
    assert.equal(state.records[i].outcome, 'correct');

    state = advanceB10Question(state, t + 1800);
  }

  assert.equal(state.phase, 'summary');
  assert.equal(state.finishReason, 'completed_all');
  const summary = computeB10Summary(state);
  assert.equal(summary.score, 100);
  assert.equal(summary.maxScore, 100);
  assert.equal(summary.correctCount, 10);
  assert.equal(summary.wrongCount, 0);
  assert.equal(summary.skippedCount, 0);
  assert.equal(summary.timeoutCount, 0);
  assert.equal(summary.unseenCount, 0);
});

test('Clock discipline: mediaReady gate, pause preserves remaining ms, and tab return past deadline triggers timeout', () => {
  const started = startB10Session({
    config: createDefaultB10SetupConfig({ clockMode: 'per_question', perQuestionSec: 20 }),
    nowMs: 50000,
    shuffleSeed: 'clock_seed',
  });
  let state = started.state!;
  // Before mediaReady, phase is question_ready and deadline is null
  assert.equal(state.phase, 'question_ready');
  assert.equal(state.questionDeadlineMs, null);
  assert.equal(getB10ActiveRemainingMs(state, 55000), 20000);

  // Media becomes ready at t = 55000 -> deadline = 75000
  state = markB10MediaReady(state, 55000);
  assert.equal(state.questionDeadlineMs, 75000);

  // Pause at t = 62000 -> remaining = 13000ms
  state = pauseB10Session(state, 62000);
  assert.equal(state.phase, 'paused');
  assert.equal(getB10ActiveRemainingMs(state, 999999), 13000);

  // Resume at t = 70000 -> new deadline = 83000ms (still 13s left)
  state = resumeB10Session(state, 70000);
  assert.equal(state.phase, 'answering');
  assert.equal(state.questionDeadlineMs, 83000);

  // Tab switch simulation: user returns at t = 84000 (1s past deadline) and clicks answer -> MUST timeout
  const clickedPastDeadline = lockB10Option({
    state,
    optionId: state.questions[0].correctOptionId,
    turnToken: state.turnToken,
    nowMs: 84000,
  });
  assert.equal(clickedPastDeadline.phase, 'revealed');
  assert.equal(clickedPastDeadline.records[0].outcome, 'timeout');
  assert.equal(clickedPastDeadline.score, 0);
});

test('Whole-turn 60s budget stops advancing on expiry and distinguishes correct, wrong, skipped, timeout, and unseen', () => {
  const started = startB10Session({
    config: createDefaultB10SetupConfig({
      clockMode: 'whole_turn',
      wholeTurnSec: 60,
      explanationTiming: 'end_of_round',
    }),
    nowMs: 100000,
    shuffleSeed: 'whole_turn_seed',
  });
  let state = started.state!;

  // Q1: Correct (+10)
  state = markB10MediaReady(state, 100000);
  state = lockB10Option({
    state,
    optionId: state.questions[0].correctOptionId,
    turnToken: state.turnToken,
    nowMs: 110000, // 50s left in turn budget
  });
  state = advanceB10Question(state, 111000);

  // Q2: Wrong (0)
  state = markB10MediaReady(state, 111000);
  const wrongOpt = state.questions[1].options.find(
    (o) => o.optionId !== state.questions[1].correctOptionId
  )!;
  state = lockB10Option({
    state,
    optionId: wrongOpt.optionId,
    turnToken: state.turnToken,
    nowMs: 121000, // 40s left
  });
  state = advanceB10Question(state, 122000);

  // Q3: Skipped explicitly
  state = markB10MediaReady(state, 122000);
  state = skipB10Question(state, state.turnToken, 132000); // 30s left
  state = advanceB10Question(state, 133000);

  // Q4: Whole turn clock runs out (+35s elapsed past remaining 30s -> expires at 163000, checked at 165000)
  state = markB10MediaReady(state, 133000);
  state = adjudicateB10Deadline(state, 165000);

  assert.equal(state.phase, 'summary');
  assert.equal(state.finishReason, 'stopped_on_budget');

  const summary = computeB10Summary(state);
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.wrongCount, 1);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.timeoutCount, 1);
  assert.equal(summary.unseenCount, 6); // Q5..Q10 unseen!
  assert.equal(summary.score, 10);
});

test('Teams/oral mode with 50 students distributes roster cleanly and hint toggle tracks usage without losing correctness', () => {
  const fiftyStudents = Array.from({ length: 50 }, (_, idx) => ({
    id: `stu_${idx + 1}`,
    fullName: `Học sinh ${idx + 1}`,
  }));
  const started = startB10Session({
    config: createDefaultB10SetupConfig({
      participationMode: 'teams_oral',
      teamCount: 4,
      classStudents: fiftyStudents,
      hintsEnabled: true,
    }),
    nowMs: 200000,
    shuffleSeed: 'teams_seed',
  });
  let state = started.state!;
  assert.equal(state.teams.length, 4);
  const totalDistributed = state.teams.reduce((sum, t) => sum + t.studentNames.length, 0);
  assert.equal(totalDistributed, 50);

  state = markB10MediaReady(state, 200050);
  state = pickNextB10Student(state);
  state = revealB10Hint(state);
  assert.equal(state.activeHintRevealed, true);
  assert.equal(state.totalHintsUsed, 1);

  state = lockB10Option({
    state,
    optionId: state.questions[0].correctOptionId,
    turnToken: state.turnToken,
    nowMs: 202000,
  });
  assert.equal(state.teams[0].score, 10);
  assert.equal(state.records[0].hintUsed, true);
});

test('RBAC bank adapter filters draft questions for students and preserves teacher access', () => {
  const sampleBank: Question[] = [
    {
      id: 'q_approved',
      code: 'M7-01',
      grade: '7',
      subject: 'math',
      textbook: 'Chân trời sáng tạo',
      chapter: 'Số hữu tỉ',
      lesson: 'Bài 1',
      level: 'know',
      type: 'single_choice',
      stem: 'Tính \\(\\dfrac{1}{2} + \\dfrac{1}{2}\\).',
      options: [
        { id: 'a', label: 'A', text: '\\(1\\)' },
        { id: 'b', label: 'B', text: '\\(2\\)' },
      ],
      correctAnswer: 'a',
      points: 10,
      explanation: 'Tổng bằng 1.',
      status: 'approved',
      author: 'gv1',
      version: 1,
    },
    {
      id: 'q_draft',
      code: 'M7-02',
      grade: '7',
      subject: 'math',
      textbook: 'Chân trời sáng tạo',
      chapter: 'Số hữu tỉ',
      lesson: 'Bài 2',
      level: 'know',
      type: 'single_choice',
      stem: 'Câu nháp: \\(2+2=?\\)',
      options: [
        { id: 'a', label: 'A', text: '\\(4\\)' },
        { id: 'b', label: 'B', text: '\\(5\\)' },
      ],
      correctAnswer: 'a',
      points: 10,
      explanation: '4',
      status: 'draft',
      author: 'gv1',
      version: 1,
    },
  ];

  const forStudent = adaptBankQuestionsForB10(sampleBank, 'student', 10);
  assert.equal(forStudent.length, 1);
  assert.equal(forStudent[0].id, 'bank_q_approved');

  const forTeacher = adaptBankQuestionsForB10(sampleBank, 'teacher', 10);
  assert.equal(forTeacher.length, 2);
});

test('Demo-isolated persistence saves/restores active turn safely and clears corrupt JSON', () => {
  const store = new Map<string, string>();
  const mockWindow = {
    location: { pathname: '/demo/edugame' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };
  (globalThis as unknown as { window?: unknown }).window = mockWindow;

  try {
    const started = startB10Session({
      config: createDefaultB10SetupConfig(),
      nowMs: 300000,
    });
    let state = markB10MediaReady(started.state!, 300100);
    state = lockB10Option({
      state,
      optionId: state.questions[0].correctOptionId,
      turnToken: state.turnToken,
      nowMs: 302000,
    });
    state = advanceB10Question(state, 303000);
    state = markB10MediaReady(state, 303100);

    const saved = saveB10Session(state, 305100);
    assert.equal(saved, true);

    // Ensure key uses KHKT demo isolation prefix
    const keys = Array.from(store.keys());
    assert.ok(keys.some((k) => k.startsWith(KHKT_DEMO_STORAGE_PREFIX)));

    const restored = loadB10Session(310000);
    assert.ok(restored);
    assert.equal(restored!.phase, 'paused'); // restores cleanly paused without replaying stale sound
    assert.equal(restored!.score, 10);
    assert.equal(restored!.currentIndex, 1);

    // Corrupt JSON test
    store.set(keys[0], '{corrupt_json');
    const afterCorrupt = loadB10Session(315000);
    assert.equal(afterCorrupt, null);
    assert.equal(store.has(keys[0]), false);

    clearB10Session();
  } finally {
    delete (globalThis as unknown as { window?: unknown }).window;
  }
});

test('Headless EduGameSoundBank handles B10 audio cues safely without AudioContext', () => {
  const sb = new EduGameSoundBank();
  assert.doesNotThrow(() => {
    sb.setActiveTurnToken('b10_tok_1');
    sb.playLightningStartCue(false, 'b10_tok_1');
    sb.playLightningTickWarn(false, true, 'b10_tok_1');
    sb.playLightningLockCue(false, 'b10_tok_1');
    sb.playLightningResultCue(false, 'correct', 'b10_tok_1');
    sb.playLightningResultCue(false, 'timeout', 'b10_tok_1');
    sb.playLightningSummaryFanfare(false, 'b10_tok_1');
    sb.stopAll();
    sb.dispose();
  });
});
