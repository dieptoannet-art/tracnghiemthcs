import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMPLE_MATH_SET_ID,
  ToolQuestionItem,
  buildQuestionItemsFromPreviewRows,
  createSampleThcsMathQuestionSet,
  evaluateShortAnswerSubmission,
  filterToolQuestions,
  generateCsvSampleTemplate,
  getMcqDisplayLabelForCorrectOption,
  isMcqSelectionCorrect,
  parsePdfTextAndAnswerKey,
  parseSpreadsheetQuestionImport,
  reorderMcqOption,
} from './questionBankEngine';
import {
  addTiebreakerQuestionAndContinue,
  batchGradeActiveGoldenBell,
  buildParticipantsFromSource,
  computeReviewStandings,
  confirmAndAdvanceReviewQuestion,
  confirmPuzzlePictureGuess,
  createReviewGameSession,
  getRaceLaneSteps,
  gradeParticipantOnCurrentQuestion,
  gradePuzzleTileAttempt,
  loadReviewGameSession,
  rescueGoldenBellParticipants,
  saveReviewGameSession,
  selectPuzzleTile,
  transferReviewScoresToScoreboard,
} from './reviewGamesEngine';
import {
  createDefaultQuickActivityState,
  drawRandomChallenge,
  generateStudentPairs,
} from './quickActivitiesEngine';
import {
  ToolStudentItem,
  applyPackageForNewLesson,
  buildPackageFromSession,
  createFreshClassTeachingSession,
  loadClassTeachingSession,
  saveClassTeachingSession,
} from './teachingToolsEngine';

function createMemoryWindow(): () => void {
  const store = new Map<string, string>();
  const mockWindow = {
    location: { pathname: '/teacher' },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
  (globalThis as unknown as { window?: unknown }).window = mockWindow;
  return () => {
    delete (globalThis as unknown as { window?: unknown }).window;
  };
}

function makeSampleStudents(prefix: string, count: number): ToolStudentItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `${prefix}_s_${idx + 1}`,
    code: `HS${String(idx + 1).padStart(2, '0')}`,
    fullName: idx < 2 ? 'Nguyễn Văn An' : `Học sinh ${idx + 1}`,
  }));
}

test('QuestionBank: built-in 10-question Math sample matches 3 Biết · 4 Hiểu · 3 Vận dụng & Vietnamese accent-insensitive search', () => {
  const sample = createSampleThcsMathQuestionSet();
  assert.equal(sample.id, SAMPLE_MATH_SET_ID);
  assert.equal(sample.questions.length, 10);

  const knowCount = sample.questions.filter((q) => q.level === 'know').length;
  const understandCount = sample.questions.filter((q) => q.level === 'understand').length;
  const applyCount = sample.questions.filter((q) => q.level === 'apply').length;
  assert.deepEqual({ knowCount, understandCount, applyCount }, {
    knowCount: 3,
    understandCount: 4,
    applyCount: 3,
  });

  // Unaccented search query matches accented Vietnamese stem & lesson
  const res1 = filterToolQuestions({
    questions: sample.questions,
    query: 'phuong trinh bac nhat',
  });
  assert.ok(res1.length >= 2);
  assert.ok(res1.some((q) => q.code === 'TOAN8-B1'));

  const res2 = filterToolQuestions({
    questions: sample.questions,
    query: 'hinh binh hanh',
    type: 'true_false',
  });
  assert.equal(res2.length, 1);
  assert.equal(res2[0].code, 'TOAN8-B3');
});

test('QuestionBank: reordering MCQ options keeps correctOptionId locked to exact answer', () => {
  const sample = createSampleThcsMathQuestionSet();
  const q1 = sample.questions.find((q) => q.code === 'TOAN8-B1')!;
  const originalCorrectId = q1.correctOptionId!;
  assert.equal(getMcqDisplayLabelForCorrectOption(q1), 'A');

  // Move original option A down twice -> now at display position C
  const step1 = reorderMcqOption(q1, originalCorrectId, 'down');
  const step2 = reorderMcqOption(step1, originalCorrectId, 'down');
  assert.equal(step2.correctOptionId, originalCorrectId);
  assert.equal(getMcqDisplayLabelForCorrectOption(step2), 'C');
  assert.equal(isMcqSelectionCorrect(step2, originalCorrectId), true);
  assert.equal(isMcqSelectionCorrect(step2, step2.options![0].id), false);
});

test('QuestionBank: short answer respects grading rules & flags units for teacher manual review', () => {
  const sample = createSampleThcsMathQuestionSet();
  const numericQ = sample.questions.find((q) => q.code === 'TOAN8-H2')!; // answer 100
  const manualUnitQ = sample.questions.find((q) => q.code === 'TOAN8-VD3')!; // answer '4 m', manual_only

  assert.equal(evaluateShortAnswerSubmission(numericQ, '100').outcome, 'correct');
  assert.equal(evaluateShortAnswerSubmission(numericQ, '105').outcome, 'wrong');
  assert.equal(evaluateShortAnswerSubmission(numericQ, '100 mét').outcome, 'needs_manual');
  assert.equal(evaluateShortAnswerSubmission(manualUnitQ, '4 m').outcome, 'needs_manual');
});

test('QuestionBank: CSV/Excel import preview flags errors & PDF + Answer Table handles image-only pages and missing keys', () => {
  const csv = generateCsvSampleTemplate();
  const validRows = parseSpreadsheetQuestionImport(csv);
  assert.equal(validRows.length, 3);
  assert.ok(validRows.every((r) => r.errors.length === 0));

  const built = buildQuestionItemsFromPreviewRows(validRows);
  assert.equal(built[0].type, 'mcq');
  assert.equal(built[1].type, 'true_false');
  assert.equal(built[2].type, 'short_answer');

  // Duplicate code & invalid ABCD detection
  const badCsv = [
    'C01,8,Toán,Bài 1,Biết,ABCD,Nội dung 1,A1,B1,C1,D1,Z,Giải 1',
    'C01,8,Toán,Bài 1,Biết,ABCD,,A2,B2,C2,D2,A,Giải 2',
  ].join('\n');
  const badRows = parseSpreadsheetQuestionImport(badCsv);
  assert.ok(badRows[0].errors.some((e) => e.includes('ABCD')));
  assert.ok(badRows[1].errors.some((e) => e.includes('Trùng mã')));
  assert.ok(badRows[1].errors.some((e) => e.includes('Thiếu nội dung')));

  // PDF text-layer + Answer key parsing
  const pdfResult = parsePdfTextAndAnswerKey({
    pages: [
      {
        pageNumber: 1,
        text: [
          'PHẦN I',
          'Câu 1: Kết quả của $2 + 3$ là?',
          'A. 4   B. 5   C. 6   D. 7',
          'Câu 2: Thủ đô Việt Nam là Hà Nội.',
          'a) Đúng hay sai?  b) Có 63 tỉnh thành?',
          'PHẦN II',
          'Câu 1: Tính $x$ biết $2x = 10$.',
        ].join('\n'),
      },
      {
        pageNumber: 2,
        text: '',
        isImageOnly: true,
      },
    ],
    answerKeyText: [
      'Phần,Câu,Đáp án,Lời giải',
      'Phần I,Câu 1,B,2 + 3 = 5',
      'Phần I,Câu 2,"Đ,S",Hà Nội là thủ đô',
      // Intentionally omit Phần II Câu 1 answer -> missingAnswerCodes
      'Phần III,Câu 9,C,Đáp án thừa',
    ].join('\n'),
  });

  assert.deepEqual(pdfResult.imageOnlyPages, [2]);
  assert.equal(pdfResult.rows.length, 3);
  assert.equal(pdfResult.rows[0].type, 'mcq');
  assert.equal(pdfResult.rows[0].correctOptionLetter, 'B');
  assert.ok(pdfResult.missingAnswerCodes.includes('P2C-1'));
  assert.ok(pdfResult.orphanAnswerCodes.length >= 1);
});

test('ReviewGames: same question set runs Puzzle (locked excess tiles & idempotency), Race (tiebreaker), and Golden Bell (1 HS & 50 HS rescue)', () => {
  const sample = createSampleThcsMathQuestionSet();

  // 1) PUZZLE MODE (3x4 = 12 grid with 10 questions => 2 unavailable tiles)
  const teams = buildParticipantsFromSource({
    source: 'manual_teams',
    dot1Groups: [],
    manualTeamNames: ['Đội Đỏ', 'Đội Xanh'],
  });
  let puzzleSession = createReviewGameSession({
    classId: 'cls_1',
    className: '8A1',
    questionSet: sample,
    config: {
      mode: 'puzzle',
      puzzleGridPreset: '3x4',
      pointsPerCorrect: 10,
      puzzleBonusPoints: 30,
    },
    participants: teams,
  });

  assert.equal(puzzleSession.puzzleTiles.filter((t) => t.status === 'closed').length, 10);
  assert.equal(puzzleSession.puzzleTiles.filter((t) => t.status === 'unavailable').length, 2);

  puzzleSession = selectPuzzleTile(puzzleSession, 0);
  puzzleSession = gradePuzzleTileAttempt({
    session: puzzleSession,
    participantId: teams[0].id,
    isCorrect: true,
  });
  assert.equal(puzzleSession.participants[0].score, 10);
  assert.equal(puzzleSession.puzzleTiles[0].status, 'opened');
  // Attempting to re-grade already opened tile does nothing
  puzzleSession = gradePuzzleTileAttempt({
    session: puzzleSession,
    participantId: teams[0].id,
    isCorrect: true,
  });
  assert.equal(puzzleSession.participants[0].score, 10);

  puzzleSession = confirmPuzzlePictureGuess({
    session: puzzleSession,
    participantId: teams[1].id,
    isCorrect: true,
  });
  assert.equal(puzzleSession.phase, 'finished');
  assert.equal(puzzleSession.participants[1].score, 30);

  // 2) RACE MODE (tied finish target triggers tiedLeaderIds + tiebreaker continuation)
  let raceSession = createReviewGameSession({
    classId: 'cls_1',
    className: '8A1',
    questionSet: sample,
    config: {
      mode: 'race',
      selectedQuestionIds: sample.questions.slice(0, 2).map((q) => q.id),
      raceStepPerCorrect: 1,
      raceFinishTarget: 1,
      pointsPerCorrect: 15,
    },
    participants: teams,
  });
  raceSession = gradeParticipantOnCurrentQuestion({
    session: raceSession,
    participantId: teams[0].id,
    isCorrect: true,
  });
  raceSession = gradeParticipantOnCurrentQuestion({
    session: raceSession,
    participantId: teams[1].id,
    isCorrect: true,
  });
  assert.equal(getRaceLaneSteps(raceSession, teams[0].id), 1);
  raceSession = confirmAndAdvanceReviewQuestion(raceSession, 'next');
  assert.equal(raceSession.phase, 'finished');
  assert.equal(raceSession.tiedLeaderIds.length, 2);

  // Add tiebreaker question -> back to playing
  const extraQ: ToolQuestionItem = sample.questions[5];
  raceSession = addTiebreakerQuestionAndContinue(raceSession, extraQ);
  assert.equal(raceSession.phase, 'playing');
  assert.equal(raceSession.isTiebreakerActive, true);

  // 3) GOLDEN BELL: 1 HS Practice continuation + 50 HS Batch & Rescue log
  const singleStu = buildParticipantsFromSource({
    source: 'individual_students',
    dot1Groups: [],
    presentStudents: makeSampleStudents('one', 1),
  });
  let singleBell = createReviewGameSession({
    classId: 'cls_solo',
    className: 'Lớp 1 HS',
    questionSet: sample,
    config: { mode: 'golden_bell', goldenBellAllowPracticeOnSingle: true },
    participants: singleStu,
  });
  singleBell = gradeParticipantOnCurrentQuestion({
    session: singleBell,
    participantId: singleStu[0].id,
    isCorrect: false,
  });
  // Single student remains active in practice mode!
  assert.equal(singleBell.participants[0].bellStatus, 'active');

  const fiftyStus = buildParticipantsFromSource({
    source: 'individual_students',
    dot1Groups: [],
    presentStudents: makeSampleStudents('c50', 50),
  });
  let bell50 = createReviewGameSession({
    classId: 'cls_50',
    className: '8A50',
    questionSet: sample,
    config: { mode: 'golden_bell', pointsPerCorrect: 10 },
    participants: fiftyStus,
  });
  bell50 = batchGradeActiveGoldenBell({
    session: bell50,
    participantIds: fiftyStus.slice(0, 40).map((s) => s.id),
    isCorrect: true,
  });
  bell50 = batchGradeActiveGoldenBell({
    session: bell50,
    participantIds: fiftyStus.slice(40).map((s) => s.id),
    isCorrect: false,
  });
  assert.equal(bell50.participants.filter((p) => p.bellStatus === 'eliminated').length, 10);

  bell50 = rescueGoldenBellParticipants({
    session: bell50,
    participantIds: fiftyStus.slice(40, 45).map((s) => s.id),
    note: 'Thầy cô ném máy bay giấy cứu trợ',
  });
  assert.equal(bell50.participants.filter((p) => p.bellStatus === 'rescued').length, 5);
  assert.equal(bell50.rescueLogs.length, 1);
  assert.equal(bell50.rescueLogs[0].rescuedNames.length, 5);

  const standings = computeReviewStandings(bell50.participants);
  assert.equal(standings[0].rank, 1);
});

test('Mid-session save/reload recovery & strict one-time transfer to Scoreboard', () => {
  const restoreWindow = createMemoryWindow();
  try {
    const sample = createSampleThcsMathQuestionSet();
    const classSession = createFreshClassTeachingSession({
      id: 'cls_8a',
      name: '8A',
      students: makeSampleStudents('c8a', 16),
    });

    const teams = buildParticipantsFromSource({
      source: 'dot1_groups',
      dot1Groups: classSession.groupsState.groups,
    });

    let rev = createReviewGameSession({
      classId: 'cls_8a',
      className: '8A',
      questionSet: sample,
      config: { mode: 'race', pointsPerCorrect: 20 },
      participants: teams,
    });
    rev = gradeParticipantOnCurrentQuestion({
      session: rev,
      participantId: teams[0].id,
      isCorrect: true,
    });

    saveReviewGameSession(rev, 'teacher_acc_1');
    const reloaded = loadReviewGameSession('cls_8a', 'teacher_acc_1');
    assert.ok(reloaded);
    assert.equal(reloaded.sessionId, rev.sessionId);
    assert.equal(reloaded.participants[0].score, 20);

    // Mismatched class rejected
    const wrongClassAttempt = transferReviewScoresToScoreboard({
      reviewSession: reloaded,
      targetClassId: 'cls_9b',
      scoreboard: classSession.scoreboardState,
      transferredReviewSessionIds: [],
    });
    assert.equal(wrongClassAttempt.ok, false);

    // First valid transfer succeeds
    const xfer1 = transferReviewScoresToScoreboard({
      reviewSession: reloaded,
      targetClassId: 'cls_8a',
      scoreboard: classSession.scoreboardState,
      transferredReviewSessionIds: [],
    });
    assert.equal(xfer1.ok, true);
    assert.equal(xfer1.nextScoreboard.teams[0].score, 20);

    // Second transfer attempt (double click / after reload) strictly blocked
    const xfer2 = transferReviewScoresToScoreboard({
      reviewSession: xfer1.nextReviewSession,
      targetClassId: 'cls_8a',
      scoreboard: xfer1.nextScoreboard,
      transferredReviewSessionIds: xfer1.nextTransferredIds,
    });
    assert.equal(xfer2.ok, false);
    assert.equal(xfer2.alreadyTransferred, true);
    assert.equal(xfer2.nextScoreboard.teams[0].score, 20);
  } finally {
    restoreWindow();
  }
});

test('LessonPackage: saving with questionSet, applying fresh to Class B resets scores & resumes Class A state cleanly', () => {
  const restoreWindow = createMemoryWindow();
  try {
    const sample = createSampleThcsMathQuestionSet();
    const classASession = createFreshClassTeachingSession({
      id: 'cls_A',
      name: '8A1',
      students: makeSampleStudents('A', 12),
    });
    classASession.scoreboardState.teams[0].score = 50;
    saveClassTeachingSession(classASession, 'teacher_1');

    const pkg = buildPackageFromSession({
      name: 'Gói Toán 8 + Đua 30s',
      session: classASession,
      questionSet: sample,
      reviewConfig: {
        mode: 'race',
        secondsPerQuestion: 25,
        pointsPerCorrect: 15,
      },
    });

    assert.equal(pkg.config.embeddedQuestionSet?.questions.length, 10);
    assert.equal(pkg.config.reviewGameMode, 'race');

    // Apply fresh to Class B -> starts at 0 with Class B students
    const classBFresh = applyPackageForNewLesson({
      pkg,
      targetClass: {
        id: 'cls_B',
        name: '8B2',
        students: makeSampleStudents('B', 20),
      },
    });
    assert.equal(classBFresh.classId, 'cls_B');
    assert.ok(classBFresh.scoreboardState.teams.every((t) => t.score === 0));
    assert.equal(classBFresh.pendingReviewGamePrefill?.mode, 'race');
    assert.equal(classBFresh.pendingReviewGamePrefill?.secondsPerQuestion, 25);

    // Resume Class A -> intact 50 pts
    const resumedA = loadClassTeachingSession('cls_A', 'teacher_1');
    assert.equal(resumedA?.scoreboardState.teams[0].score, 50);
  } finally {
    restoreWindow();
  }
});

test('QuickActivities: handles 0, 1, 5 students (trio vs solo) and non-repeating random challenge draws', () => {
  // 0 students
  const empty = generateStudentPairs({
    presentStudents: [],
    oddHandling: 'form_one_trio',
  });
  assert.equal(empty.mode, 'empty');

  // 1 student -> individual task
  const single = generateStudentPairs({
    presentStudents: makeSampleStudents('s1', 1),
    oddHandling: 'form_one_trio',
    soloTaskPrompt: 'Đọc trước bài 2',
  });
  assert.equal(single.mode, 'single_individual');
  assert.equal(single.soloStudent?.id, 's1_s_1');

  // 5 students -> 1 pair + 1 trio OR 2 pairs + 1 solo
  const oddTrio = generateStudentPairs({
    presentStudents: makeSampleStudents('s5', 5),
    oddHandling: 'form_one_trio',
    seed: 'test5',
  });
  assert.equal(oddTrio.mode, 'paired');
  assert.equal(oddTrio.pairs.length, 2);
  assert.ok(oddTrio.pairs.some((p) => p.members.length === 3));
  assert.equal(oddTrio.soloStudent, null);

  const oddSolo = generateStudentPairs({
    presentStudents: makeSampleStudents('s5b', 5),
    oddHandling: 'one_solo_task',
    seed: 'test5b',
  });
  assert.equal(oddSolo.mode, 'paired');
  assert.equal(oddSolo.pairs.length, 2);
  assert.ok(oddSolo.pairs.every((p) => p.members.length === 2));
  assert.ok(oddSolo.soloStudent);

  // Random challenge draw with no-repeat
  let quick = createDefaultQuickActivityState();
  quick = {
    ...quick,
    challenges: [
      { id: 'c1', text: 'T1' },
      { id: 'c2', text: 'T2' },
      { id: 'c3', text: 'T3' },
    ],
    noRepeatInSession: true,
  };
  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const res = drawRandomChallenge(quick, `draw_${i}`);
    assert.equal(res.ok, true);
    const pickedId = res.nextState.currentChallenge?.id || '';
    assert.ok(pickedId);
    assert.equal(seen.has(pickedId), false);
    seen.add(pickedId);
    quick = res.nextState;
  }
  const exhausted = drawRandomChallenge(quick, 'draw_exhaust');
  assert.equal(exhausted.ok, false);
  assert.ok(exhausted.error);
});
