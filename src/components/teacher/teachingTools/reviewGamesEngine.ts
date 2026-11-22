import { ToolQuestionItem, ToolQuestionSet } from './questionBankEngine';
import {
  ScoreboardState,
  StudentGroupItem,
  ToolStudentItem,
  applyTeamScoreAction,
} from './teachingToolsEngine';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export type ReviewGameMode = 'puzzle' | 'race' | 'golden_bell';
export type ReviewParticipantSource = 'dot1_groups' | 'manual_teams' | 'individual_students';
export type ReviewTurnRule = 'rotate_every_question' | 'keep_on_correct';
export type PuzzleGridPreset = '2x3' | '3x3' | '3x4';
export type RaceTieHandling = 'accept_tie' | 'tiebreaker_question';

export interface ReviewParticipant {
  id: string; // Matches StudentGroupItem.id or student.id or manual team id
  name: string;
  color: string;
  score: number; // Session score, strictly separate from cumulative class Scoreboard until transferred
  correctCount: number;
  wrongCount: number;
  memberCount: number;
  // Golden Bell specific
  bellStatus: 'active' | 'eliminated' | 'rescued';
  rescuedCount: number;
}

export interface QuestionPlayLedgerEntry {
  questionId: string;
  status: 'pending' | 'active' | 'answered' | 'skipped';
  answerRevealed: boolean;
  // Records whether participant has already been graded for this question (prevents double-scoring same tile/question)
  marksByParticipantId: Record<string, 'correct' | 'wrong' | null>;
  submittedAnswersByParticipantId: Record<string, string>;
  pointsDeltaAppliedByParticipantId: Record<string, number>;
}

export interface PuzzleTileState {
  tileIndex: number;
  questionId: string | null;
  status: 'closed' | 'opened' | 'unavailable';
  openedByParticipantId: string | null;
}

export interface GoldenBellRescueLog {
  roundNumber: number;
  questionCode: string;
  rescuedParticipantIds: string[];
  rescuedNames: string[];
  timestampMs: number;
  note: string;
}

export interface ReviewGameConfig {
  mode: ReviewGameMode;
  participantSource: ReviewParticipantSource;
  questionSetId: string;
  questionSetTitle: string;
  selectedQuestionIds: string[];
  secondsPerQuestion: number; // 0 = no limit
  pointsPerCorrect: number;
  turnRule: ReviewTurnRule;
  // Mode A: Puzzle
  puzzleGridPreset: PuzzleGridPreset;
  puzzleImageId: string;
  puzzleImageUrl: string;
  puzzleImageTitle: string;
  puzzleSecretKeyword: string;
  puzzleBonusPoints: number;
  // Mode B: Race
  raceStepPerCorrect: number;
  raceFinishTarget: number;
  raceReducedMotion: boolean;
  // Mode C: Golden Bell
  goldenBellAllowPracticeOnSingle: boolean;
}

export interface ReviewGameSessionState {
  sessionId: string;
  classId: string;
  className: string;
  phase: 'setup' | 'playing' | 'finished';
  config: ReviewGameConfig;
  questions: ToolQuestionItem[];
  participants: ReviewParticipant[];
  currentTurnIdx: number;
  currentQuestionIdx: number;
  activePuzzleTileIdx: number | null;
  puzzleTiles: PuzzleTileState[];
  puzzleSolvedByParticipantId: string | null;
  ledger: Record<string, QuestionPlayLedgerEntry>;
  // Timestamp-anchored question timer
  timerStatus: 'idle' | 'running' | 'paused' | 'expired';
  timerTargetEndAtMs: number | null;
  timerRemainingMs: number;
  // Mode B Race tiebreaker
  isTiebreakerActive: boolean;
  tiedLeaderIds: string[];
  endReason: string;
  // Mode C Rescue log
  rescueLogs: GoldenBellRescueLog[];
  // Scoreboard transfer lock
  transferredToScoreboardAtMs: number | null;
  updatedAtMs: number;
}

const REVIEW_COLORS = [
  '#1D4ED8',
  '#047857',
  '#B45309',
  '#BE123C',
  '#6D28D9',
  '#0E7490',
  '#C2410C',
  '#4338CA',
];

export function getPuzzleGridDimensions(preset: PuzzleGridPreset): {
  rows: number;
  cols: number;
  totalTiles: number;
} {
  if (preset === '2x3') return { rows: 2, cols: 3, totalTiles: 6 };
  if (preset === '3x4') return { rows: 3, cols: 4, totalTiles: 12 };
  return { rows: 3, cols: 3, totalTiles: 9 };
}

export function buildParticipantsFromSource(params: {
  source: ReviewParticipantSource;
  dot1Groups: StudentGroupItem[];
  selectedGroupIds?: string[];
  manualTeamNames?: string[];
  presentStudents?: ToolStudentItem[];
}): ReviewParticipant[] {
  const {
    source,
    dot1Groups,
    selectedGroupIds,
    manualTeamNames = ['Đội 1', 'Đội 2', 'Đội 3', 'Đội 4'],
    presentStudents = [],
  } = params;

  if (source === 'dot1_groups' && dot1Groups.length > 0) {
    const allowed = selectedGroupIds && selectedGroupIds.length > 0 ? new Set(selectedGroupIds) : null;
    const picked = allowed ? dot1Groups.filter((g) => allowed.has(g.id)) : dot1Groups;
    const list = picked.length > 0 ? picked : dot1Groups;
    return list.map((g, idx) => ({
      id: g.id,
      name: g.name,
      color: g.color || REVIEW_COLORS[idx % REVIEW_COLORS.length],
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      memberCount: g.studentIds.length,
      bellStatus: 'active',
      rescuedCount: 0,
    }));
  }

  if (source === 'individual_students' && presentStudents.length > 0) {
    // Deduplicate by stable student.id cleanly
    const seen = new Set<string>();
    const out: ReviewParticipant[] = [];
    presentStudents.forEach((s, idx) => {
      if (seen.has(s.id)) return;
      seen.add(s.id);
      out.push({
        id: s.id,
        name: s.fullName,
        color: REVIEW_COLORS[idx % REVIEW_COLORS.length],
        score: 0,
        correctCount: 0,
        wrongCount: 0,
        memberCount: 1,
        bellStatus: 'active',
        rescuedCount: 0,
      });
    });
    return out;
  }

  // Fallback or explicit manual teams
  const cleanNames = manualTeamNames.map((n) => n.trim()).filter(Boolean);
  const finalNames = cleanNames.length > 0 ? cleanNames : ['Đội 1', 'Đội 2'];
  return finalNames.map((name, idx) => ({
    id: `rev_manual_${idx + 1}`,
    name,
    color: REVIEW_COLORS[idx % REVIEW_COLORS.length],
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    memberCount: 0,
    bellStatus: 'active',
    rescuedCount: 0,
  }));
}

export function createReviewGameSession(params: {
  classId: string;
  className: string;
  questionSet: ToolQuestionSet;
  config: Partial<ReviewGameConfig>;
  participants: ReviewParticipant[];
  nowMs?: number;
}): ReviewGameSessionState {
  const { classId, className, questionSet, config, participants, nowMs = Date.now() } = params;

  const selectedIdsSet =
    config.selectedQuestionIds && config.selectedQuestionIds.length > 0
      ? new Set(config.selectedQuestionIds)
      : null;

  const selectedQuestions = selectedIdsSet
    ? questionSet.questions.filter((q) => selectedIdsSet.has(q.id))
    : questionSet.questions.slice();

  const fullConfig: ReviewGameConfig = {
    mode: config.mode || 'puzzle',
    participantSource: config.participantSource || 'dot1_groups',
    questionSetId: questionSet.id,
    questionSetTitle: questionSet.title,
    selectedQuestionIds: selectedQuestions.map((q) => q.id),
    secondsPerQuestion: config.secondsPerQuestion ?? 30,
    pointsPerCorrect: Math.max(1, config.pointsPerCorrect ?? 10),
    turnRule: config.turnRule || 'rotate_every_question',
    puzzleGridPreset: config.puzzleGridPreset || '3x3',
    puzzleImageId: config.puzzleImageId || 'sample_geo',
    puzzleImageUrl: config.puzzleImageUrl || '',
    puzzleImageTitle: config.puzzleImageTitle || 'Hình ảnh chủ đề bài học',
    puzzleSecretKeyword: config.puzzleSecretKeyword || 'TRI THỨC TOÁN HỌC',
    puzzleBonusPoints: Math.max(5, config.puzzleBonusPoints ?? 30),
    raceStepPerCorrect: Math.max(1, config.raceStepPerCorrect ?? 1),
    raceFinishTarget: Math.max(
      1,
      config.raceFinishTarget ?? Math.min(10, Math.max(3, selectedQuestions.length))
    ),
    raceReducedMotion: Boolean(config.raceReducedMotion),
    goldenBellAllowPracticeOnSingle: config.goldenBellAllowPracticeOnSingle ?? true,
  };

  const gridDims = getPuzzleGridDimensions(fullConfig.puzzleGridPreset);
  const puzzleTiles: PuzzleTileState[] = Array.from(
    { length: gridDims.totalTiles },
    (_, idx) => {
      const mappedQ = selectedQuestions[idx];
      return {
        tileIndex: idx,
        questionId: mappedQ ? mappedQ.id : null,
        // Strictly enable ONLY tiles corresponding to available questions!
        status: mappedQ ? 'closed' : 'unavailable',
        openedByParticipantId: null,
      };
    }
  );

  const ledger: Record<string, QuestionPlayLedgerEntry> = {};
  selectedQuestions.forEach((q, idx) => {
    ledger[q.id] = {
      questionId: q.id,
      status: fullConfig.mode !== 'puzzle' && idx === 0 ? 'active' : 'pending',
      answerRevealed: false,
      marksByParticipantId: {},
      submittedAnswersByParticipantId: {},
      pointsDeltaAppliedByParticipantId: {},
    };
  });

  const initTimerMs = Math.max(0, fullConfig.secondsPerQuestion) * 1000;

  return {
    sessionId: `rev_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    classId,
    className,
    phase: 'playing',
    config: fullConfig,
    questions: selectedQuestions,
    participants: participants.map((p) => ({
      ...p,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      bellStatus: 'active',
      rescuedCount: 0,
    })),
    currentTurnIdx: 0,
    currentQuestionIdx: 0,
    activePuzzleTileIdx: null,
    puzzleTiles,
    puzzleSolvedByParticipantId: null,
    ledger,
    timerStatus: 'idle',
    timerTargetEndAtMs: null,
    timerRemainingMs: initTimerMs,
    isTiebreakerActive: false,
    tiedLeaderIds: [],
    endReason: '',
    rescueLogs: [],
    transferredToScoreboardAtMs: null,
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// SHARED TIMER & QUESTION REVEAL CONTROLS
// ============================================================================
export function startOrResumeReviewTimer(
  session: ReviewGameSessionState,
  nowMs = Date.now()
): ReviewGameSessionState {
  if (session.config.secondsPerQuestion <= 0) return session;
  const rem =
    session.timerStatus === 'paused' && session.timerRemainingMs > 0
      ? session.timerRemainingMs
      : session.config.secondsPerQuestion * 1000;
  return {
    ...session,
    timerStatus: 'running',
    timerTargetEndAtMs: nowMs + rem,
    timerRemainingMs: rem,
    updatedAtMs: nowMs,
  };
}

export function pauseReviewTimer(
  session: ReviewGameSessionState,
  nowMs = Date.now()
): ReviewGameSessionState {
  if (session.timerStatus !== 'running') return session;
  const rem =
    session.timerTargetEndAtMs !== null
      ? Math.max(0, session.timerTargetEndAtMs - nowMs)
      : session.timerRemainingMs;
  return {
    ...session,
    timerStatus: rem === 0 ? 'expired' : 'paused',
    timerTargetEndAtMs: null,
    timerRemainingMs: rem,
    updatedAtMs: nowMs,
  };
}

export function computeReviewTimerRemainingMs(
  session: ReviewGameSessionState,
  nowMs = Date.now()
): number {
  if (session.timerStatus === 'running' && session.timerTargetEndAtMs !== null) {
    return Math.max(0, session.timerTargetEndAtMs - nowMs);
  }
  return Math.max(0, session.timerRemainingMs);
}

export function revealQuestionAnswer(
  session: ReviewGameSessionState,
  questionId: string,
  nowMs = Date.now()
): ReviewGameSessionState {
  const existing = session.ledger[questionId];
  if (!existing) return session;
  return {
    ...session,
    ledger: {
      ...session.ledger,
      [questionId]: {
        ...existing,
        answerRevealed: true,
      },
    },
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// MODE A: MỞ MẢNH GHÉP
// ============================================================================
export function selectPuzzleTile(
  session: ReviewGameSessionState,
  tileIndex: number,
  nowMs = Date.now()
): ReviewGameSessionState {
  if (session.phase !== 'playing') return session;
  const tile = session.puzzleTiles[tileIndex];
  if (!tile || tile.status !== 'closed' || !tile.questionId) return session;

  const qIdx = session.questions.findIndex((q) => q.id === tile.questionId);
  const existingEntry = session.ledger[tile.questionId];
  const initTimerMs = Math.max(0, session.config.secondsPerQuestion) * 1000;

  return {
    ...session,
    activePuzzleTileIdx: tileIndex,
    currentQuestionIdx: qIdx >= 0 ? qIdx : session.currentQuestionIdx,
    ledger: {
      ...session.ledger,
      [tile.questionId]: {
        ...existingEntry,
        status: existingEntry.status === 'pending' ? 'active' : existingEntry.status,
      },
    },
    timerStatus: initTimerMs > 0 ? 'running' : 'idle',
    timerTargetEndAtMs: initTimerMs > 0 ? nowMs + initTimerMs : null,
    timerRemainingMs: initTimerMs,
    updatedAtMs: nowMs,
  };
}

export function gradePuzzleTileAttempt(params: {
  session: ReviewGameSessionState;
  participantId: string;
  isCorrect: boolean;
  nowMs?: number;
}): ReviewGameSessionState {
  const { session, participantId, isCorrect, nowMs = Date.now() } = params;
  if (session.phase !== 'playing' || session.activePuzzleTileIdx === null) return session;

  const tile = session.puzzleTiles[session.activePuzzleTileIdx];
  if (!tile || !tile.questionId || tile.status === 'opened') return session;

  const entry = session.ledger[tile.questionId];
  // Strict idempotency: never double-award points on an already-correct tile
  const alreadyAwarded = (entry.pointsDeltaAppliedByParticipantId[participantId] || 0) > 0;
  const delta = isCorrect && !alreadyAwarded ? session.config.pointsPerCorrect : 0;

  const nextParticipants = session.participants.map((p) => {
    if (p.id !== participantId) return p;
    return {
      ...p,
      score: p.score + delta,
      correctCount: p.correctCount + (isCorrect && !alreadyAwarded ? 1 : 0),
      wrongCount: p.wrongCount + (isCorrect ? 0 : 1),
    };
  });

  const nextTiles = session.puzzleTiles.map((t) =>
    t.tileIndex === tile.tileIndex && isCorrect
      ? { ...t, status: 'opened' as const, openedByParticipantId: participantId }
      : t
  );

  const nextTurnIdx =
    session.config.turnRule === 'keep_on_correct' && isCorrect
      ? session.currentTurnIdx
      : (session.currentTurnIdx + 1) % Math.max(1, nextParticipants.length);

  const allAvailableOpened = nextTiles
    .filter((t) => t.status !== 'unavailable')
    .every((t) => t.status === 'opened');

  return {
    ...session,
    participants: nextParticipants,
    puzzleTiles: nextTiles,
    activePuzzleTileIdx: isCorrect ? null : session.activePuzzleTileIdx,
    currentTurnIdx: nextTurnIdx,
    timerStatus: 'paused',
    timerTargetEndAtMs: null,
    phase: allAvailableOpened ? 'finished' : 'playing',
    endReason: allAvailableOpened ? 'Đã mở hết toàn bộ mảnh ghép khả dụng.' : session.endReason,
    ledger: {
      ...session.ledger,
      [tile.questionId]: {
        ...entry,
        status: isCorrect ? 'answered' : 'active',
        answerRevealed: isCorrect ? true : entry.answerRevealed,
        marksByParticipantId: {
          ...entry.marksByParticipantId,
          [participantId]: isCorrect ? 'correct' : 'wrong',
        },
        pointsDeltaAppliedByParticipantId: {
          ...entry.pointsDeltaAppliedByParticipantId,
          [participantId]: (entry.pointsDeltaAppliedByParticipantId[participantId] || 0) + delta,
        },
      },
    },
    updatedAtMs: nowMs,
  };
}

export function confirmPuzzlePictureGuess(params: {
  session: ReviewGameSessionState;
  participantId: string;
  isCorrect: boolean;
  nowMs?: number;
}): ReviewGameSessionState {
  const { session, participantId, isCorrect, nowMs = Date.now() } = params;
  if (session.phase !== 'playing') return session;

  if (!isCorrect) {
    const nextTurnIdx =
      (session.currentTurnIdx + 1) % Math.max(1, session.participants.length);
    return {
      ...session,
      currentTurnIdx: nextTurnIdx,
      updatedAtMs: nowMs,
    };
  }

  const bonus = session.config.puzzleBonusPoints;
  const nextParticipants = session.participants.map((p) =>
    p.id === participantId ? { ...p, score: p.score + bonus } : p
  );
  const revealedTiles = session.puzzleTiles.map((t) =>
    t.status === 'closed' ? { ...t, status: 'opened' as const } : t
  );

  return {
    ...session,
    participants: nextParticipants,
    puzzleTiles: revealedTiles,
    puzzleSolvedByParticipantId: participantId,
    phase: 'finished',
    timerStatus: 'paused',
    timerTargetEndAtMs: null,
    endReason: 'Đã đoán đúng bức ảnh chủ đề bí mật!',
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// MODE B: ĐƯỜNG ĐUA & MODE C: RUNG CHUÔNG VÀNG (SHARED LEDGER + RULES)
// ============================================================================
export function gradeParticipantOnCurrentQuestion(params: {
  session: ReviewGameSessionState;
  participantId: string;
  isCorrect: boolean;
  submittedAnswerText?: string;
  nowMs?: number;
}): ReviewGameSessionState {
  const {
    session,
    participantId,
    isCorrect,
    submittedAnswerText,
    nowMs = Date.now(),
  } = params;
  const currentQ = session.questions[session.currentQuestionIdx];
  if (!currentQ) return session;

  const entry = session.ledger[currentQ.id];
  const prevMark = entry.marksByParticipantId[participantId] ?? null;
  const prevDelta = entry.pointsDeltaAppliedByParticipantId[participantId] || 0;
  const newTargetDelta = isCorrect ? session.config.pointsPerCorrect : 0;
  const netDelta = newTargetDelta - prevDelta;

  const isSinglePractice =
    session.config.mode === 'golden_bell' &&
    session.participants.length === 1 &&
    session.config.goldenBellAllowPracticeOnSingle;

  const nextParticipants = session.participants.map((p) => {
    if (p.id !== participantId) return p;

    let nextBellStatus = p.bellStatus;
    if (session.config.mode === 'golden_bell') {
      if (isCorrect) {
        nextBellStatus = p.rescuedCount > 0 ? 'rescued' : 'active';
      } else if (!isSinglePractice) {
        nextBellStatus = 'eliminated';
      }
    }

    const correctAdj =
      (isCorrect ? 1 : 0) - (prevMark === 'correct' ? 1 : 0);
    const wrongAdj =
      (!isCorrect ? 1 : 0) - (prevMark === 'wrong' ? 1 : 0);

    return {
      ...p,
      score: Math.max(0, p.score + netDelta),
      correctCount: Math.max(0, p.correctCount + correctAdj),
      wrongCount: Math.max(0, p.wrongCount + wrongAdj),
      bellStatus: nextBellStatus,
    };
  });

  const nextLedgerEntry: QuestionPlayLedgerEntry = {
    ...entry,
    marksByParticipantId: {
      ...entry.marksByParticipantId,
      [participantId]: isCorrect ? 'correct' : 'wrong',
    },
    submittedAnswersByParticipantId:
      submittedAnswerText !== undefined
        ? {
            ...entry.submittedAnswersByParticipantId,
            [participantId]: submittedAnswerText,
          }
        : entry.submittedAnswersByParticipantId,
    pointsDeltaAppliedByParticipantId: {
      ...entry.pointsDeltaAppliedByParticipantId,
      [participantId]: newTargetDelta,
    },
  };

  return {
    ...session,
    participants: nextParticipants,
    ledger: {
      ...session.ledger,
      [currentQ.id]: nextLedgerEntry,
    },
    updatedAtMs: nowMs,
  };
}

export function batchGradeActiveGoldenBell(params: {
  session: ReviewGameSessionState;
  participantIds: string[];
  isCorrect: boolean;
  nowMs?: number;
}): ReviewGameSessionState {
  let acc = params.session;
  for (const pid of params.participantIds) {
    acc = gradeParticipantOnCurrentQuestion({
      session: acc,
      participantId: pid,
      isCorrect: params.isCorrect,
      nowMs: params.nowMs,
    });
  }
  return acc;
}

export function rescueGoldenBellParticipants(params: {
  session: ReviewGameSessionState;
  participantIds: string[];
  note?: string;
  nowMs?: number;
}): ReviewGameSessionState {
  const { session, participantIds, note = 'Cứu trợ cả lớp', nowMs = Date.now() } = params;
  const targetSet = new Set(participantIds);
  const currentQ = session.questions[session.currentQuestionIdx];

  const rescuedNames: string[] = [];
  const nextParticipants = session.participants.map((p) => {
    if (!targetSet.has(p.id) || p.bellStatus !== 'eliminated') return p;
    rescuedNames.push(p.name);
    return {
      ...p,
      bellStatus: 'rescued' as const,
      rescuedCount: p.rescuedCount + 1,
    };
  });

  if (rescuedNames.length === 0) return session;

  const logItem: GoldenBellRescueLog = {
    roundNumber: session.currentQuestionIdx + 1,
    questionCode: currentQ?.code || `C${session.currentQuestionIdx + 1}`,
    rescuedParticipantIds: participantIds,
    rescuedNames,
    timestampMs: nowMs,
    note: note.trim() || 'Cứu trợ vượt chướng ngại',
  };

  return {
    ...session,
    participants: nextParticipants,
    rescueLogs: [...session.rescueLogs, logItem],
    updatedAtMs: nowMs,
  };
}

export function getRaceLaneSteps(
  session: ReviewGameSessionState,
  participantId: string
): number {
  const step = Math.max(1, session.config.raceStepPerCorrect);
  const p = session.participants.find((x) => x.id === participantId);
  if (!p) return 0;
  return p.correctCount * step;
}

export function confirmAndAdvanceReviewQuestion(
  session: ReviewGameSessionState,
  action: 'next' | 'skip',
  nowMs = Date.now()
): ReviewGameSessionState {
  const currentQ = session.questions[session.currentQuestionIdx];
  if (!currentQ) return session;

  const nextLedger = {
    ...session.ledger,
    [currentQ.id]: {
      ...session.ledger[currentQ.id],
      status: action === 'skip' ? ('skipped' as const) : ('answered' as const),
      answerRevealed: action === 'skip' ? session.ledger[currentQ.id].answerRevealed : true,
    },
  };

  // Check race finish target
  if (session.config.mode === 'race') {
    const finishers = session.participants.filter(
      (p) => getRaceLaneSteps({ ...session, ledger: nextLedger }, p.id) >= session.config.raceFinishTarget
    );
    if (finishers.length > 0) {
      const topScore = Math.max(...finishers.map((f) => f.score));
      const tied = finishers.filter((f) => f.score === topScore).map((f) => f.id);
      return {
        ...session,
        ledger: nextLedger,
        phase: 'finished',
        timerStatus: 'paused',
        timerTargetEndAtMs: null,
        tiedLeaderIds: tied.length > 1 ? tied : [],
        endReason:
          tied.length > 1
            ? 'Nhiều đội cùng chạm vạch đích trong cùng lượt!'
            : 'Đã có đội cán đích đầu tiên!',
        updatedAtMs: nowMs,
      };
    }
  }

  const nextIdx = session.currentQuestionIdx + 1;
  if (nextIdx >= session.questions.length) {
    const maxScore = Math.max(...session.participants.map((p) => p.score), 0);
    const leaders = session.participants.filter((p) => p.score === maxScore);
    return {
      ...session,
      ledger: nextLedger,
      phase: 'finished',
      timerStatus: 'paused',
      timerTargetEndAtMs: null,
      tiedLeaderIds: leaders.length > 1 ? leaders.map((l) => l.id) : [],
      endReason: 'Đã hoàn thành tất cả câu hỏi trong phiên.',
      updatedAtMs: nowMs,
    };
  }

  const nextQ = session.questions[nextIdx];
  const initTimerMs = Math.max(0, session.config.secondsPerQuestion) * 1000;
  const nextTurnIdx =
    (session.currentTurnIdx + 1) % Math.max(1, session.participants.length);

  return {
    ...session,
    ledger: {
      ...nextLedger,
      [nextQ.id]: {
        ...nextLedger[nextQ.id],
        status: nextLedger[nextQ.id].status === 'pending' ? 'active' : nextLedger[nextQ.id].status,
      },
    },
    currentQuestionIdx: nextIdx,
    currentTurnIdx: nextTurnIdx,
    timerStatus: initTimerMs > 0 ? 'idle' : 'idle',
    timerTargetEndAtMs: null,
    timerRemainingMs: initTimerMs,
    updatedAtMs: nowMs,
  };
}

export function endReviewGameEarly(
  session: ReviewGameSessionState,
  reason = 'Giáo viên chốt kết thúc phiên.',
  nowMs = Date.now()
): ReviewGameSessionState {
  const maxScore = Math.max(...session.participants.map((p) => p.score), 0);
  const leaders = session.participants.filter((p) => p.score === maxScore);
  return {
    ...session,
    phase: 'finished',
    timerStatus: 'paused',
    timerTargetEndAtMs: null,
    tiedLeaderIds: leaders.length > 1 ? leaders.map((l) => l.id) : [],
    endReason: reason,
    updatedAtMs: nowMs,
  };
}

export function addTiebreakerQuestionAndContinue(
  session: ReviewGameSessionState,
  tiebreakerQuestion: ToolQuestionItem,
  nowMs = Date.now()
): ReviewGameSessionState {
  const nextQuestions = [...session.questions, tiebreakerQuestion];
  const newIdx = nextQuestions.length - 1;
  const initTimerMs = Math.max(0, session.config.secondsPerQuestion) * 1000;

  return {
    ...session,
    phase: 'playing',
    questions: nextQuestions,
    currentQuestionIdx: newIdx,
    isTiebreakerActive: true,
    timerStatus: 'idle',
    timerTargetEndAtMs: null,
    timerRemainingMs: initTimerMs,
    ledger: {
      ...session.ledger,
      [tiebreakerQuestion.id]: {
        questionId: tiebreakerQuestion.id,
        status: 'active',
        answerRevealed: false,
        marksByParticipantId: {},
        submittedAnswersByParticipantId: {},
        pointsDeltaAppliedByParticipantId: {},
      },
    },
    updatedAtMs: nowMs,
  };
}

export interface ReviewStandingRow {
  participantId: string;
  name: string;
  color: string;
  score: number;
  correctCount: number;
  rank: number;
  bellStatus: ReviewParticipant['bellStatus'];
}

export function computeReviewStandings(
  participants: ReviewParticipant[]
): ReviewStandingRow[] {
  const sorted = participants.slice().sort((a, b) => b.score - a.score);
  const out: ReviewStandingRow[] = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p.score !== sorted[i - 1].score) {
      rank = i + 1;
    }
    out.push({
      participantId: p.id,
      name: p.name,
      color: p.color,
      score: p.score,
      correctCount: p.correctCount,
      rank,
      bellStatus: p.bellStatus,
    });
  }
  return out;
}

// ============================================================================
// ONE-TIME SCOREBOARD TRANSFER TO ĐỢT 1 BẢNG ĐIỂM ĐỘI
// ============================================================================
export function transferReviewScoresToScoreboard(params: {
  reviewSession: ReviewGameSessionState;
  targetClassId: string;
  scoreboard: ScoreboardState;
  transferredReviewSessionIds: string[];
  nowMs?: number;
}): {
  ok: boolean;
  alreadyTransferred: boolean;
  error?: string;
  nextScoreboard: ScoreboardState;
  nextReviewSession: ReviewGameSessionState;
  nextTransferredIds: string[];
  transferredTeamCount: number;
} {
  const {
    reviewSession,
    targetClassId,
    scoreboard,
    transferredReviewSessionIds,
    nowMs = Date.now(),
  } = params;

  if (reviewSession.classId !== targetClassId) {
    return {
      ok: false,
      alreadyTransferred: false,
      error: 'Phiên trò chơi thuộc về lớp khác — không thể chuyển điểm nhầm lớp.',
      nextScoreboard: scoreboard,
      nextReviewSession: reviewSession,
      nextTransferredIds: transferredReviewSessionIds,
      transferredTeamCount: 0,
    };
  }

  if (
    reviewSession.transferredToScoreboardAtMs !== null ||
    transferredReviewSessionIds.includes(reviewSession.sessionId)
  ) {
    return {
      ok: false,
      alreadyTransferred: true,
      error: 'Điểm của phiên trò chơi này đã được chuyển vào Bảng điểm trước đó (chống ghi trùng).',
      nextScoreboard: scoreboard,
      nextReviewSession: reviewSession,
      nextTransferredIds: transferredReviewSessionIds,
      transferredTeamCount: 0,
    };
  }

  let workingScoreboard: ScoreboardState = {
    ...scoreboard,
    teams: scoreboard.teams.map((t) => ({ ...t })),
  };

  let transferredCount = 0;
  const modeLabel =
    reviewSession.config.mode === 'puzzle'
      ? 'Mở mảnh ghép'
      : reviewSession.config.mode === 'race'
        ? 'Đường đua'
        : 'Rung chuông vàng';

  for (const participant of reviewSession.participants) {
    if (participant.score === 0) continue;

    // Match by exact team ID first, or fallback by exact team name
    let targetTeam =
      workingScoreboard.teams.find((t) => t.id === participant.id) ||
      workingScoreboard.teams.find(
        (t) => t.name.trim().toLowerCase() === participant.name.trim().toLowerCase()
      );

    if (!targetTeam) {
      targetTeam = {
        id: participant.id,
        name: participant.name,
        color: participant.color,
        score: 0,
        memberStudentIds: [],
      };
      workingScoreboard = {
        ...workingScoreboard,
        teams: [...workingScoreboard.teams, targetTeam],
      };
    }

    workingScoreboard = applyTeamScoreAction({
      state: workingScoreboard,
      teamId: targetTeam.id,
      delta: participant.score,
      reason: `Từ trò chơi ${modeLabel}`,
      actionId: `review_xfer_${reviewSession.sessionId}_${targetTeam.id}`,
      nowMs,
    });
    transferredCount++;
  }

  return {
    ok: true,
    alreadyTransferred: false,
    nextScoreboard: workingScoreboard,
    nextReviewSession: {
      ...reviewSession,
      transferredToScoreboardAtMs: nowMs,
      updatedAtMs: nowMs,
    },
    nextTransferredIds: [...transferredReviewSessionIds, reviewSession.sessionId],
    transferredTeamCount: transferredCount,
  };
}

// ============================================================================
// ISOLATED SESSION PERSISTENCE PER CLASS + ACCOUNT / DEMO
// ============================================================================
export function getReviewGameSessionStorageKey(
  classId: string,
  accountId?: string | null
): string {
  const safeAccount = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClass = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_teaching_tools_v2_rev_${safeAccount}_cls_${safeClass}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function saveReviewGameSession(
  session: ReviewGameSessionState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getReviewGameSessionStorageKey(session.classId, accountId),
      JSON.stringify(session)
    );
    return true;
  } catch {
    return false;
  }
}

export function loadReviewGameSession(
  classId: string,
  accountId?: string | null
): ReviewGameSessionState | null {
  if (typeof window === 'undefined') return null;
  const key = getReviewGameSessionStorageKey(classId, accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReviewGameSessionState>;
    if (
      !parsed ||
      parsed.classId !== classId ||
      !parsed.config ||
      !Array.isArray(parsed.questions) ||
      !Array.isArray(parsed.participants) ||
      !parsed.ledger
    ) {
      return null;
    }
    return parsed as ReviewGameSessionState;
  } catch {
    return null;
  }
}

export function clearReviewGameSession(
  classId: string,
  accountId?: string | null
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getReviewGameSessionStorageKey(classId, accountId));
  } catch {
    // ignore cleanup errors
  }
}
