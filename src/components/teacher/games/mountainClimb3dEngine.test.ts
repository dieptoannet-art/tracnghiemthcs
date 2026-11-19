import assert from 'node:assert/strict';
import test from 'node:test';
import {
  C08QuestionRecord,
  SAMPLE_INFORMATICS_C08_QUESTIONS,
  SAMPLE_MATH_C08_QUESTIONS,
  buildDisplayOptionsForC08,
  buildStagesForTotalQuestions,
  computeC08EntityStates,
  createSampleStudentParticipants,
  createTeamParticipants,
  getClimberWorldPosition,
  getMountainTrailPoint,
  getQuestionMaxPoints,
  hasPositionalOptionDependency,
  loadC08PersistedSession,
  mapCandidatesToC08Participants,
  mapQuestionBankToC08Pool,
  C08_STORAGE_KEY,
} from './mountainClimb3dEngine';
import { Question } from '../../../types';

test('Sample datasets each contain 12 complete questions across 3 stages of 4', () => {
  assert.equal(SAMPLE_MATH_C08_QUESTIONS.length, 12);
  assert.equal(SAMPLE_INFORMATICS_C08_QUESTIONS.length, 12);

  const stages = buildStagesForTotalQuestions(12);
  assert.equal(stages.length, 3);
  assert.deepEqual(
    stages.map((s) => s.endIndex - s.startIndex + 1),
    [4, 4, 4]
  );

  for (const q of [...SAMPLE_MATH_C08_QUESTIONS, ...SAMPLE_INFORMATICS_C08_QUESTIONS]) {
    assert.ok(q.stem.trim().length > 0);
    assert.ok(q.correctAnswerText.trim().length > 0);
    assert.ok(q.explanation.trim().length > 0);
    assert.ok((q.hint || '').trim().length > 0);
  }
});

test('JOURNEY mode progresses all participants equally per confirmed question regardless of wrong/no-answer', () => {
  const teams = createTeamParticipants(3);
  const records: C08QuestionRecord[] = [
    {
      questionIndex: 0,
      questionNumber: 1,
      questionId: 'q1',
      stageNumber: 1,
      hintUsed: false,
      maxPointsForQuestion: 10,
      marks: {
        [teams[0].participantId]: 'CORRECT',
        [teams[1].participantId]: 'WRONG',
        [teams[2].participantId]: 'NO_ANSWER',
      },
      confirmedAt: 1000,
      editCount: 0,
    },
    {
      questionIndex: 1,
      questionNumber: 2,
      questionId: 'q2',
      stageNumber: 1,
      hintUsed: false,
      maxPointsForQuestion: 10,
      marks: {
        [teams[0].participantId]: 'WRONG',
        [teams[1].participantId]: 'WRONG',
        [teams[2].participantId]: 'WRONG',
      },
      confirmedAt: 2000,
      editCount: 0,
    },
  ];

  const states = computeC08EntityStates({
    participants: teams,
    records,
    totalQuestions: 4,
    playMode: 'JOURNEY',
    summitThreshold: 30,
  });

  // 2/4 questions confirmed => all 3 teams are at 0.5 progress
  assert.equal(states[0].progress, 0.5);
  assert.equal(states[1].progress, 0.5);
  assert.equal(states[2].progress, 0.5);
  assert.equal(states[0].score, 10);
  assert.equal(states[1].score, 0);
  assert.equal(states[2].score, 0);
  assert.equal(states[0].reachedSummit, false);
});

test('CONQUEST mode enforces summitThreshold=100 out of 120 max, clamps progress<=1, and never auto-promotes below threshold', () => {
  const teams = createTeamParticipants(3);
  const records: C08QuestionRecord[] = [];

  for (let i = 0; i < 12; i++) {
    records.push({
      questionIndex: i,
      questionNumber: i + 1,
      questionId: `q_${i}`,
      stageNumber: Math.floor(i / 4) + 1,
      hintUsed: false,
      maxPointsForQuestion: 10,
      marks: {
        [teams[0].participantId]: 'CORRECT', // 120 pts (> 100 threshold)
        [teams[1].participantId]: i < 10 ? 'CORRECT' : 'WRONG', // 100 pts (== 100 threshold)
        [teams[2].participantId]: i < 9 ? 'CORRECT' : 'NO_ANSWER', // 90 pts (< 100 threshold)
      },
      confirmedAt: 1000 + i,
      editCount: 0,
    });
  }

  const states = computeC08EntityStates({
    participants: teams,
    records,
    totalQuestions: 12,
    playMode: 'CONQUEST',
    summitThreshold: 100,
  });

  assert.equal(states[0].score, 120);
  assert.equal(states[0].progress, 1); // Clamped cleanly to 1
  assert.equal(states[0].reachedSummit, true);

  assert.equal(states[1].score, 100);
  assert.equal(states[1].progress, 1);
  assert.equal(states[1].reachedSummit, true);

  assert.equal(states[2].score, 90);
  assert.equal(states[2].progress, 0.9);
  assert.equal(states[2].reachedSummit, false);
});

test('CONQUEST wrong or no-answer preserves prior altitude and never deducts score', () => {
  const solo = createSampleStudentParticipants(1);
  const r1: C08QuestionRecord = {
    questionIndex: 0,
    questionNumber: 1,
    questionId: 'q1',
    stageNumber: 1,
    hintUsed: false,
    maxPointsForQuestion: 10,
    marks: { [solo[0].participantId]: 'CORRECT' },
    confirmedAt: 1,
    editCount: 0,
  };
  const r2: C08QuestionRecord = {
    questionIndex: 1,
    questionNumber: 2,
    questionId: 'q2',
    stageNumber: 1,
    hintUsed: false,
    maxPointsForQuestion: 10,
    marks: { [solo[0].participantId]: 'WRONG' },
    confirmedAt: 2,
    editCount: 0,
  };

  const after1 = computeC08EntityStates({
    participants: solo,
    records: [r1],
    totalQuestions: 10,
    playMode: 'CONQUEST',
    summitThreshold: 80,
  });
  const after2 = computeC08EntityStates({
    participants: solo,
    records: [r1, r2],
    totalQuestions: 10,
    playMode: 'CONQUEST',
    summitThreshold: 80,
  });

  assert.equal(after2[0].score, after1[0].score);
  assert.equal(after2[0].progress, after1[0].progress);
});

test('Competition ranking assigns equal rank for equal scores and recognizes multiple summit ties', () => {
  const teams = createTeamParticipants(4);
  const records: C08QuestionRecord[] = [
    {
      questionIndex: 0,
      questionNumber: 1,
      questionId: 'q1',
      stageNumber: 1,
      hintUsed: false,
      maxPointsForQuestion: 10,
      marks: {
        [teams[0].participantId]: 'CORRECT',
        [teams[1].participantId]: 'CORRECT',
        [teams[2].participantId]: 'WRONG',
        [teams[3].participantId]: 'NO_ANSWER',
      },
      confirmedAt: 1,
      editCount: 0,
    },
  ];

  const states = computeC08EntityStates({
    participants: teams,
    records,
    totalQuestions: 1,
    playMode: 'CONQUEST',
    summitThreshold: 10,
  });

  assert.equal(states[0].rank, 1);
  assert.equal(states[1].rank, 1);
  assert.equal(states[0].reachedSummit, true);
  assert.equal(states[1].reachedSummit, true);
  assert.equal(states[2].rank, 3);
  assert.equal(states[3].rank, 3);
  assert.equal(states[2].reachedSummit, false);
});

test('Hint rule halves question points when hint exists, ignores when no hint exists', () => {
  assert.equal(getQuestionMaxPoints(10, true, true), 5);
  assert.equal(getQuestionMaxPoints(10, false, true), 10);
  assert.equal(getQuestionMaxPoints(10, true, false), 10);
  assert.equal(getQuestionMaxPoints(15, true, true), 7);
});

test('Post-confirmation edit recomputes deterministically without double counting', () => {
  const teams = createTeamParticipants(2);
  const initialRecord: C08QuestionRecord = {
    questionIndex: 0,
    questionNumber: 1,
    questionId: 'q1',
    stageNumber: 1,
    hintUsed: true,
    maxPointsForQuestion: 5,
    marks: {
      [teams[0].participantId]: 'CORRECT',
      [teams[1].participantId]: 'WRONG',
    },
    confirmedAt: 1,
    editCount: 0,
  };

  const editedRecord: C08QuestionRecord = {
    ...initialRecord,
    marks: {
      [teams[0].participantId]: 'WRONG',
      [teams[1].participantId]: 'CORRECT',
    },
    editCount: 1,
  };

  const afterEdit = computeC08EntityStates({
    participants: teams,
    records: [editedRecord],
    totalQuestions: 10,
    playMode: 'CONQUEST',
    summitThreshold: 80,
  });

  assert.equal(afterEdit[0].score, 0);
  assert.equal(afterEdit[1].score, 5);
});

test('Positional options such as "Cả A và B" never shuffle', () => {
  const opts = [
    { optionId: 'o1', text: 'Giá trị x = 2' },
    { optionId: 'o2', text: 'Giá trị x = -2' },
    { optionId: 'o3', text: 'Cả A và B đều đúng' },
    { optionId: 'o4', text: 'Không có nghiệm' },
  ];
  assert.equal(hasPositionalOptionDependency(opts), true);

  const built = buildDisplayOptionsForC08({
    questionId: 'q_pos',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Test',
    options: opts,
    correctOptionId: 'o3',
    correctAnswerText: 'Cả A và B đều đúng',
    explanation: 'Test',
    allowShuffle: true,
  });
  assert.deepEqual(
    built.map((b) => b.optionId),
    ['o1', 'o2', 'o3', 'o4']
  );
});

test('Question bank mapper rejects unapproved or ambiguous items and avoids duplicates', () => {
  const bank: Question[] = [
    {
      id: 'valid_1',
      code: 'Q001',
      type: 'single_choice',
      stem: '2 + 2 = ?',
      options: [
        { id: 'a', label: 'A', text: '4' },
        { id: 'b', label: 'B', text: '5' },
      ],
      correctAnswer: 'A',
      status: 'approved',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 1',
      level: 'know',
      points: 1,
      explanation: '2 + 2 = 4',
      author: 'GV',
      version: 1,
    },
    {
      id: 'draft_1',
      code: 'Q002',
      type: 'single_choice',
      stem: 'Unapproved question',
      options: [
        { id: 'a', label: 'A', text: '1' },
        { id: 'b', label: 'B', text: '2' },
      ],
      correctAnswer: 'A',
      status: 'draft',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 1',
      level: 'know',
      points: 1,
      explanation: '1',
      author: 'GV',
      version: 1,
    },
    {
      id: 'ambiguous_1',
      code: 'Q003',
      type: 'single_choice',
      stem: 'Ambiguous question',
      options: [
        { id: 'a', label: 'A', text: 'Same' },
        { id: 'b', label: 'B', text: 'Same' },
      ],
      correctAnswer: 'Same',
      status: 'approved',
      subject: 'Toán',
      grade: '6',
      textbook: 'Kết nối tri thức',
      chapter: 'Số học',
      lesson: 'Bài 1',
      level: 'know',
      points: 1,
      explanation: 'Same',
      author: 'GV',
      version: 1,
    },
  ];

  const mapped = mapQuestionBankToC08Pool(bank);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].questionId, 'valid_1');
});

test('3D mountain trail rises monotonically and summit climbers spread cleanly without overlapping', () => {
  const p0 = getMountainTrailPoint(0);
  const pMid = getMountainTrailPoint(0.5);
  const pTop = getMountainTrailPoint(1);
  assert.ok(p0.y < pMid.y && pMid.y < pTop.y);

  const s0 = getClimberWorldPosition(1, 0, 3);
  const s1 = getClimberWorldPosition(1, 1, 3);
  const dist = Math.hypot(s0.x - s1.x, s0.z - s1.z);
  assert.ok(dist > 0.5);
});

test('Roster helpers support 1-50 students and preserve duplicate student names safely', () => {
  const fifty = createSampleStudentParticipants(50);
  assert.equal(fifty.length, 50);

  const dupMapped = mapCandidatesToC08Participants([
    { id: 'id_1', code: '01', fullName: 'Nguyễn Minh An' },
    { id: 'id_2', code: '02', fullName: 'Nguyễn Minh An' },
  ]);
  assert.equal(dupMapped.length, 2);
  assert.notEqual(dupMapped[0].participantId, dupMapped[1].participantId);
});

test('Corrupt localStorage session payload returns null safely without crashing', () => {
  const fakeStorage = new Map<string, string>();
  fakeStorage.set(C08_STORAGE_KEY, '{corrupt_json');
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => fakeStorage.get(k) ?? null,
      setItem: (k: string, v: string) => fakeStorage.set(k, v),
      removeItem: (k: string) => fakeStorage.delete(k),
    },
  };
  const loaded = loadC08PersistedSession();
  assert.equal(loaded, null);
  assert.equal(fakeStorage.has(C08_STORAGE_KEY), false);
});
