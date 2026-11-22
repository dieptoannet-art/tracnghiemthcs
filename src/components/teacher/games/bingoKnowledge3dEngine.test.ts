import assert from 'node:assert/strict';
import test from 'node:test';
import katex from 'katex';
import { EduGameSoundBank } from '../../../utils/eduGameAudioController';
import { KHKT_DEMO_STORAGE_PREFIX } from '../../../utils/khktDemoSandbox';
import { Question } from '../../../types';
import {
  C09_BINGO_BONUS_POINTS,
  C09_QUESTION_POINTS,
  C09_SAMPLE_BADGE,
  C09_SAMPLE_QUESTIONS,
  adaptBankQuestionsForC09,
  advanceToNextC09Question,
  buildC09PrintableCardSpec,
  canHaveC09FreeCenter,
  clearC09Session,
  computeC09Summary,
  createDefaultC09SetupConfig,
  finishC09ToSummary,
  getC09SessionStorageKey,
  loadC09Session,
  publishC09QuestionResult,
  revealC09Hint,
  saveC09Session,
  skipC09RevealAnimation,
  startC09Bingo,
  submitC09WhiteboardHold,
  toggleC09CardCellMark,
  validateC09AnswerPool,
  verifyC09BingoClaims,
} from './bingoKnowledge3dEngine';

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

test('C09 sample pack has 25 unique KaTeX questions tagged Dữ liệu mẫu, including 3x3 sample row [4, 7, 9] from 2^2, sqrt(49), 3^2', () => {
  assert.equal(C09_SAMPLE_QUESTIONS.length, 25);
  const poolValidation = validateC09AnswerPool(C09_SAMPLE_QUESTIONS);
  assert.equal(poolValidation.ok, true);

  for (const q of C09_SAMPLE_QUESTIONS) {
    assert.equal(q.sourceTag, C09_SAMPLE_BADGE);
    assert.ok(renderTextWithMathStrict(q.stem).length > 0);
    assert.ok(renderTextWithMathStrict(q.answerText).length > 0);
    assert.ok(renderTextWithMathStrict(q.hintText).length > 0);
    assert.ok(renderTextWithMathStrict(q.explanationText).length > 0);
    for (const opt of q.options) {
      assert.ok(renderTextWithMathStrict(opt.text).length > 0);
    }
  }

  let state = startC09Bingo({
    config: createDefaultC09SetupConfig({
      boardSize: '3x3',
      winPatterns: { allowRows: true, allowCols: false, allowDiagonals: false },
      shuffleOptions: false,
    }),
    nowMs: 1000,
  }).state!;

  const row0 = state.cards[0].cells.slice(0, 3).map((c) => c.answerPlainText);
  assert.deepEqual(row0, ['4', '7', '9']);

  // Publish Q1 (2^2 = 4) & check Bingo -> NOT yet valid!
  state = publishC09QuestionResult({
    state,
    turnToken: state.turnToken,
    optionId: state.deck[0].question.correctOptionId,
  });
  state = verifyC09BingoClaims(state, ['card_1']);
  assert.equal(state.lastVerificationStatus, 'rejected');

  // Publish Q2 (sqrt(49) = 7) & check Bingo -> STILL NOT valid!
  state = advanceToNextC09Question(state, 1100);
  state = publishC09QuestionResult({
    state,
    turnToken: state.turnToken,
    optionId: state.deck[1].question.correctOptionId,
  });
  state = verifyC09BingoClaims(state, ['card_1']);
  assert.equal(state.lastVerificationStatus, 'rejected');

  // Publish Q3 (3^2 = 9) -> NOW row [4, 7, 9] IS verified Bingo!
  state = advanceToNextC09Question(state, 1200);
  state = publishC09QuestionResult({
    state,
    turnToken: state.turnToken,
    optionId: state.deck[2].question.correctOptionId,
  });
  state = verifyC09BingoClaims(state, ['card_1']);
  assert.equal(state.lastVerificationStatus, 'verified');
  assert.equal(state.verifiedWinners.length, 1);
  assert.ok(state.cards[0].winningLineLabels.includes('Hàng 1'));
});

test('Even size 4x4 strictly disables free center cell, has 16 unique cells, and odd sizes place free center only at center', () => {
  assert.equal(canHaveC09FreeCenter('4x4'), false);
  assert.equal(canHaveC09FreeCenter('3x3'), true);
  assert.equal(canHaveC09FreeCenter('5x5'), true);

  // Even when freeCenterEnabled: true is passed on 4x4, center free MUST stay disabled
  const res4x4 = startC09Bingo({
    config: createDefaultC09SetupConfig({
      boardSize: '4x4',
      freeCenterEnabled: true,
    }),
    nowMs: 2000,
  });
  assert.equal(res4x4.ok, true);
  const state4 = res4x4.state!;
  assert.equal(state4.dimension, 4);
  assert.equal(state4.centerFreeActive, false);
  assert.equal(state4.cards[0].cells.length, 16);
  assert.ok(state4.cards[0].cells.every((c) => c.isFreeCenter === false));
  // Unique answers inside card
  const uniqueIds = new Set(state4.cards[0].cells.map((c) => c.answerId));
  assert.equal(uniqueIds.size, 16);

  // Odd 5x5 with freeCenterEnabled -> index 12 is free center, 24 unique answers
  const state5 = startC09Bingo({
    config: createDefaultC09SetupConfig({
      boardSize: '5x5',
      freeCenterEnabled: true,
    }),
    nowMs: 2100,
  }).state!;
  assert.equal(state5.centerFreeActive, true);
  assert.equal(state5.cards[0].cells.length, 25);
  assert.equal(state5.cards[0].cells[12].isFreeCenter, true);
});

test('Rejects cells marked BEFORE answer publication and rejects duplicate answerIds in question pool', () => {
  // Duplicate answerId error detection
  const dupPool = [
    C09_SAMPLE_QUESTIONS[0],
    { ...C09_SAMPLE_QUESTIONS[1], answerId: C09_SAMPLE_QUESTIONS[0].answerId },
    ...C09_SAMPLE_QUESTIONS.slice(2, 12),
  ];
  const checkDup = validateC09AnswerPool(dupPool);
  assert.equal(checkDup.ok, false);
  assert.ok(checkDup.duplicateAnswerIds.includes('ans_4'));

  const startDup = startC09Bingo({
    config: createDefaultC09SetupConfig({ boardSize: '3x3' }),
    customQuestionsOverride: dupPool,
  });
  assert.equal(startDup.ok, false);
  assert.ok((startDup.error || '').includes('trùng lặp'));

  // Marking a cell before its answer is published -> rejected with prematureCells
  let state = startC09Bingo({
    config: createDefaultC09SetupConfig({ boardSize: '3x3', shuffleOptions: false }),
    nowMs: 3000,
  }).state!;
  // Mark cell 1 ('7') & cell 2 ('9') BEFORE publishing their questions!
  state = toggleC09CardCellMark(state, 'card_1', 0);
  state = toggleC09CardCellMark(state, 'card_1', 1);
  state = toggleC09CardCellMark(state, 'card_1', 2);
  state = verifyC09BingoClaims(state, ['card_1']);
  assert.equal(state.lastVerificationStatus, 'rejected');
  assert.equal(state.verifiedWinners.length, 0);
  assert.equal(state.lastClaimResults[0].valid, false);
  assert.equal(state.lastClaimResults[0].prematureCells.length, 3);
});

test('Two cards claiming Bingo in the same turn are verified together as Đồng thắng & 50-student class whiteboard hold reconciles scores', () => {
  const fiftyStudents = Array.from({ length: 50 }, (_, i) => ({
    id: `hs_${i + 1}`,
    fullName: `Học sinh ${i + 1}`,
  }));

  // Build deterministic pool of 9 questions so two cards share matching lines after 9 questions are published
  let state = startC09Bingo({
    config: createDefaultC09SetupConfig({
      boardSize: '3x3',
      participationMode: 'class_cards',
      cardCount: 50,
      classStudents: fiftyStudents,
      whiteboardHoldMode: true,
      shuffleOptions: false,
    }),
    customQuestionsOverride: C09_SAMPLE_QUESTIONS.slice(0, 9),
    nowMs: 4000,
  }).state!;

  assert.equal(state.cards.length, 50);

  // Q1 uses whiteboard hold ('Đã nộp') BEFORE publishing
  const q0 = state.deck[0].question;
  state = revealC09Hint(state);
  state = submitC09WhiteboardHold({
    state,
    cardId: 'card_1',
    optionId: q0.correctOptionId,
  });
  assert.equal(state.deck[0].status, 'submitted');
  assert.equal(state.totalQuestionScore, 0);

  state = publishC09QuestionResult({
    state,
    turnToken: state.turnToken,
    commitHeldWhiteboard: true,
  });
  assert.equal(state.deck[0].outcome, 'correct_with_hint');
  assert.equal(state.totalQuestionScore, C09_QUESTION_POINTS);

  // Publish remaining 8 questions so card_1 & card_2 both qualify concurrently on the final turn
  for (let i = 1; i < 9; i++) {
    state = advanceToNextC09Question(state, 4100 + i);
    state = publishC09QuestionResult({
      state,
      turnToken: state.turnToken,
      optionId: state.deck[i].question.correctOptionId,
    });
  }

  // Check both cards shouting Bingo in the same turn -> Đồng thắng!
  state = verifyC09BingoClaims(state, ['card_1', 'card_2']);
  assert.equal(state.lastVerificationStatus, 'verified');
  assert.equal(state.verifiedWinners.length, 2);

  state = skipC09RevealAnimation(state);
  assert.equal(state.revealAnimDone, true);

  const summary = computeC09Summary(finishC09ToSummary(state));
  assert.equal(summary.isCoWinners, true);
  assert.equal(summary.verifiedWinnerCount, 2);
  assert.equal(summary.totalQuestionScore, 9 * C09_QUESTION_POINTS);
  assert.equal(
    summary.totalClassOrSoloScore,
    9 * C09_QUESTION_POINTS + C09_BINGO_BONUS_POINTS
  );

  // Printable B&W A4 card specification check
  const bwSpec = buildC09PrintableCardSpec(
    state.cards[0],
    state.dimension,
    state.config.winPatterns
  );
  assert.equal(bwSpec.dimension, 3);
  assert.ok(bwSpec.ruleSummary.includes('Hàng'));
  assert.ok(bwSpec.cells.every((c) => c.codeBadge.length > 0 && c.primaryText.length > 0));
});

test('RBAC Bank adapter filters unapproved questions for student & deduplicates identical answer strings', () => {
  const mockBank: Question[] = [
    {
      id: 'q1',
      code: 'T1',
      subject: 'Toán',
      grade: '7',
      chapter: 'Lũy thừa',
      lesson: 'Lũy thừa',
      level: 'know',
      textbook: 'Kết nối tri thức',
      type: 'single_choice',
      stem: '2^3 = ?',
      options: [
        { id: 'o1', label: 'A', text: '8' },
        { id: 'o2', label: 'B', text: '6' },
      ],
      correctAnswer: 'o1',
      explanation: '2*2*2 = 8',
      points: 1,
      author: 'GV',
      version: 1,
      status: 'approved',
    },
    {
      id: 'q2',
      code: 'T2',
      subject: 'Toán',
      grade: '7',
      chapter: 'Nháp',
      lesson: 'Nháp',
      level: 'know',
      textbook: 'Kết nối tri thức',
      type: 'single_choice',
      stem: 'Nháp',
      options: [
        { id: 'o1', label: 'A', text: '15' },
        { id: 'o2', label: 'B', text: '10' },
      ],
      correctAnswer: 'o1',
      explanation: 'Nháp',
      points: 1,
      author: 'GV',
      version: 1,
      status: 'draft',
    },
  ];

  assert.equal(adaptBankQuestionsForC09(mockBank, 'student').length, 1);
  assert.equal(adaptBankQuestionsForC09(mockBank, 'teacher').length, 2);
});

test('Demo-isolated /demo session persistence restores state safely and recovers from corrupt JSON', () => {
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
    assert.ok(getC09SessionStorageKey().startsWith(KHKT_DEMO_STORAGE_PREFIX));
    let state = startC09Bingo({
      config: createDefaultC09SetupConfig({ boardSize: '3x3' }),
      nowMs: 9000,
    }).state!;
    state = publishC09QuestionResult({
      state,
      turnToken: state.turnToken,
      optionId: state.deck[0].question.correctOptionId,
    });
    assert.equal(saveC09Session(state, 9010), true);

    const restored = loadC09Session();
    assert.ok(restored);
    assert.equal(restored!.publishedAnswerIds.length, 1);

    store.set(getC09SessionStorageKey(), '{corrupt');
    assert.equal(loadC09Session(), null);
    assert.equal(store.has(getC09SessionStorageKey()), false);
    clearC09Session();
  } finally {
    (globalThis as any).window = prevWindow;
  }
});

test('Headless EduGameSoundBank executes C09 audio cues safely without throwing', () => {
  const sb = new EduGameSoundBank();
  sb.setActiveTurnToken('c09_audio');
  sb.playBingoOpenQuestion(false, 'c09_audio');
  sb.playBingoMarkCell(false, true, 'c09_audio');
  sb.playBingoMarkCell(false, false, 'c09_audio');
  sb.playBingoVerifiedWin(false, 'c09_audio');
  sb.stopAll();
  sb.dispose();
  assert.ok(true);
});
