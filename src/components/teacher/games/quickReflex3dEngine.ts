/**
 * E03 — PHẢN XẠ NHANH 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine supporting two complete modes:
 *
 * 1. CHẾ ĐỘ "PHẢN XẠ TÍN HIỆU" (Signal Reaction):
 *    - Default 1 practice trial (excluded from statistics) + 8 official scored trials.
 *    - Works for solo practice or classroom turn-by-turn on a single machine (1–50 HS).
 *    - Secret random wait delay strictly in [1500, 4000] ms (never displayed or hinted).
 *    - Early tap before signal -> "Bấm sớm", reactionMs: null (NEVER 0 ms).
 *    - Single monotonic clock source for signal open & response capture.
 *    - Accepts strictly the first valid response per trialToken (blocks double-click & key-hold).
 *    - 3000 ms response timeout -> "Không phản hồi", reactionMs: null.
 *    - Interruption (tab switch / blur / pause) marks trial 'interrupted' and allows redo.
 *    - Summary reports valid count, early count, timeout count, fastestMs & medianMs (null if 0 valid),
 *      explicitly labeled "Thời gian phản hồi trên thiết bị này" (never ranks across devices).
 *
 * 2. CHẾ ĐỘ "TOÁN NHANH" (Quick Math):
 *    - Supports Solo (1 HS), Whole Class (1–50 HS), and 2–6 Teams.
 *    - Default 8 questions, 20 seconds/question, plus Unlimited Time option (0).
 *    - Stage uses "TRẢ LỜI" instead of "BẤM!".
 *    - Exact 8-question THCS Math sample pack ("Phản xạ nhanh – Toán THCS", tagged "Dữ liệu mẫu")
 *      strictly separated from real Smart EDU bank, plus RBAC bank adapter & stable-ID shuffling.
 *    - Solo selects A–D freely before clicking "Chốt đáp án".
 *    - Teams / Class distinguishes 'ungraded' ("Chưa chấm") from 'no_answer' ("Không trả lời"),
 *      allows grading even after timer expires, blocks commit until all participants are graded.
 *    - Scoring: +10 correct, 0 wrong or no_answer, equal points => Đồng hạng, ZERO speed bonus.
 *    - Edit last graded question before advancing, recomputing standings purely from history.
 *
 * 3. /demo-isolated localStorage persistence with corrupt JSON auto-recovery.
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// SHARED CONSTANTS & TYPES
// ============================================================================

export type ReflexGameMode = 'signal' | 'math';
export type ReflexOptionLetter = 'A' | 'B' | 'C' | 'D';
export type ReflexMathParticipantMode = 'solo' | 'whole_class' | 'teams';
export type ReflexQuestionSourceKind = 'sample' | 'bank';

export const REFLEX_OPTION_LETTERS: ReflexOptionLetter[] = ['A', 'B', 'C', 'D'];
export const E03_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const E03_SAMPLE_PACK_TITLE = 'Phản xạ nhanh – Toán THCS';
export const E03_DEVICE_TIMING_LABEL = 'Thời gian phản hồi trên thiết bị này';
export const E03_DEVICE_TIMING_NOTE =
  'Mỗi thiết bị có độ trễ màn hình và bàn phím khác nhau — không dùng số đo giữa các thiết bị khác nhau để xếp hạng.';

export const E03_SIGNAL_MIN_WAIT_MS = 1500;
export const E03_SIGNAL_MAX_WAIT_MS = 4000;
export const E03_SIGNAL_TIMEOUT_MS = 3000;
export const E03_DEFAULT_PRACTICE_TRIALS = 1;
export const E03_DEFAULT_OFFICIAL_TRIALS = 8;

export const E03_DEFAULT_MATH_QUESTIONS = 8;
export const E03_DEFAULT_MATH_TIMER_SECONDS = 20;
export const E03_POINTS_PER_CORRECT = 10;

export const E03_SESSION_STORAGE_KEY = 'taydo_e03_quick_reflex_session_v1';
export const E03_SESSION_VERSION = 1;

export interface ReflexTeamPalette {
  id: string;
  hex: string;
  textOnSolid: string;
}

export const REFLEX_TEAM_PALETTES: ReflexTeamPalette[] = [
  { id: 'teal', hex: '#14B8A6', textOnSolid: '#061024' },
  { id: 'gold', hex: '#F59E0B', textOnSolid: '#061024' },
  { id: 'sky', hex: '#38BDF8', textOnSolid: '#061024' },
  { id: 'emerald', hex: '#34D399', textOnSolid: '#061024' },
  { id: 'amber', hex: '#FBBF24', textOnSolid: '#061024' },
  { id: 'rose', hex: '#FB7185', textOnSolid: '#061024' },
];

export interface ReflexTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

// ============================================================================
// MODE 1: PHẢN XẠ TÍN HIỆU (SIGNAL REACTION) TYPES & PURE STATE MACHINE
// ============================================================================

export type SignalTrialPhase = 'idle' | 'waiting' | 'go' | 'result' | 'interrupted' | 'summary';
export type SignalTrialOutcome = 'valid' | 'early' | 'timeout';
export type SignalSessionFormat = 'solo' | 'class_turn';

export interface SignalTrialRecord {
  trialIndex: number; // 0-based across practice + official
  displayNumber: number; // 1 for practice, 1..N for official
  isPractice: boolean;
  participantLabel: string;
  outcome: SignalTrialOutcome;
  /** Milliseconds on this device when outcome === 'valid'; ALWAYS null for early/timeout. */
  reactionMs: number | null;
  waitDelayMs: number;
  completedAt: number;
}

export interface SignalConfig {
  format: SignalSessionFormat;
  practiceTrials: number; // default 1
  officialTrials: number; // default 8
}

export interface SignalSessionState {
  config: SignalConfig;
  phase: SignalTrialPhase;
  /** 0-based index of the current trial (0..totalTrials-1). */
  currentTrialIndex: number;
  /** Unique token per trial attempt to prevent double-click / key-hold duplicate commits. */
  activeTrialToken: string;
  /** Secret randomized wait duration in [1500, 4000] ms for current waiting trial. */
  currentWaitDelayMs: number | null;
  /** Monotonic timestamp (ms) recorded when 'go' signal actually appeared. */
  goTimestampMs: number | null;
  /** Optional label for classroom student currently at the machine. */
  currentParticipantLabel: string;
  /** Most recent trial result (shown during 'result' phase). */
  lastResult: SignalTrialRecord | null;
  /** Reason shown during 'interrupted' phase. */
  interruptedReason: string | null;
  /** Number of interrupted attempts (for transparency). */
  interruptedCount: number;
  /** Completed trials (practice + official). */
  records: SignalTrialRecord[];
}

export interface SignalSessionSummary {
  deviceTimingLabel: string;
  deviceTimingNote: string;
  practiceCompletedCount: number;
  officialTotalCount: number;
  validCount: number;
  earlyCount: number;
  timeoutCount: number;
  interruptedCount: number;
  fastestMs: number | null;
  medianMs: number | null;
  officialRecords: SignalTrialRecord[];
}

export function createDefaultSignalConfig(format: SignalSessionFormat = 'solo'): SignalConfig {
  return {
    format,
    practiceTrials: E03_DEFAULT_PRACTICE_TRIALS,
    officialTrials: E03_DEFAULT_OFFICIAL_TRIALS,
  };
}

export function getTotalSignalTrials(config: SignalConfig): number {
  return Math.max(0, config.practiceTrials) + Math.max(1, config.officialTrials);
}

export function isPracticeTrialIndex(config: SignalConfig, trialIndex: number): boolean {
  return trialIndex < Math.max(0, config.practiceTrials);
}

export function getSignalTrialDisplayMeta(
  config: SignalConfig,
  trialIndex: number
): { isPractice: boolean; displayNumber: number; label: string } {
  const practiceCount = Math.max(0, config.practiceTrials);
  if (trialIndex < practiceCount) {
    const n = trialIndex + 1;
    return {
      isPractice: true,
      displayNumber: n,
      label: practiceCount === 1 ? 'Lượt làm quen' : `Làm quen ${n}/${practiceCount}`,
    };
  }
  const officialNum = trialIndex - practiceCount + 1;
  return {
    isPractice: false,
    displayNumber: officialNum,
    label: `Lượt ${officialNum}/${config.officialTrials}`,
  };
}

export function pickRandomWaitDelayMs(rng: () => number = Math.random): number {
  const u = Math.min(0.999999, Math.max(0, rng()));
  return Math.round(
    E03_SIGNAL_MIN_WAIT_MS + u * (E03_SIGNAL_MAX_WAIT_MS - E03_SIGNAL_MIN_WAIT_MS)
  );
}

export function makeTrialToken(trialIndex: number, attemptSeq: number): string {
  return `e03_sig_t${trialIndex}_a${attemptSeq}`;
}

export function createInitialSignalState(config: SignalConfig = createDefaultSignalConfig()): SignalSessionState {
  const normalized: SignalConfig = {
    format: config.format,
    practiceTrials: Math.max(0, Math.min(3, Math.round(config.practiceTrials))),
    officialTrials: Math.max(1, Math.min(20, Math.round(config.officialTrials))),
  };
  return {
    config: normalized,
    phase: 'idle',
    currentTrialIndex: 0,
    activeTrialToken: makeTrialToken(0, 0),
    currentWaitDelayMs: null,
    goTimestampMs: null,
    currentParticipantLabel:
      normalized.format === 'class_turn' ? 'Học sinh lượt 1' : 'Người chơi',
    lastResult: null,
    interruptedReason: null,
    interruptedCount: 0,
    records: [],
  };
}

/**
 * Transitions 'idle' -> 'waiting' with a secret wait delay in [1500, 4000] ms.
 */
export function startSignalTrial(
  state: SignalSessionState,
  params: {
    attemptSeq: number;
    participantLabel?: string;
    rng?: () => number;
  }
): SignalSessionState {
  if (state.phase !== 'idle' && state.phase !== 'interrupted') {
    return state;
  }
  const total = getTotalSignalTrials(state.config);
  if (state.currentTrialIndex >= total) {
    return { ...state, phase: 'summary' };
  }
  const waitDelayMs = pickRandomWaitDelayMs(params.rng);
  const meta = getSignalTrialDisplayMeta(state.config, state.currentTrialIndex);
  const defaultLabel =
    state.config.format === 'class_turn'
      ? meta.isPractice
        ? 'Học sinh làm quen'
        : `Học sinh lượt ${meta.displayNumber}`
      : 'Người chơi';

  return {
    ...state,
    phase: 'waiting',
    activeTrialToken: makeTrialToken(state.currentTrialIndex, params.attemptSeq),
    currentWaitDelayMs: waitDelayMs,
    goTimestampMs: null,
    currentParticipantLabel: (params.participantLabel ?? state.currentParticipantLabel ?? defaultLabel).trim() || defaultLabel,
    lastResult: null,
    interruptedReason: null,
  };
}

/**
 * Transitions 'waiting' -> 'go' at the exact moment the "BẤM!" signal becomes visible.
 * Uses the exact same monotonic clock (e.g., performance.now()) that response capture uses.
 */
export function triggerSignalGo(
  state: SignalSessionState,
  trialToken: string,
  goTimestampMs: number
): SignalSessionState {
  if (state.phase !== 'waiting' || state.activeTrialToken !== trialToken) {
    return state;
  }
  return {
    ...state,
    phase: 'go',
    goTimestampMs,
  };
}

/**
 * Handles a player response tap/click/key press.
 * - During 'waiting': ends trial immediately as 'early' ("Bấm sớm") with reactionMs = null (NEVER 0 ms).
 * - During 'go': records first valid press with reactionMs computed on the same clock.
 * - During any other phase or stale trialToken: strictly ignored (idempotent against double-click / key-hold).
 */
export function recordSignalResponse(
  state: SignalSessionState,
  params: {
    trialToken: string;
    responseTimestampMs: number;
    nowWallClockMs?: number;
  }
): { nextState: SignalSessionState; accepted: boolean; outcome: SignalTrialOutcome | null } {
  if (state.activeTrialToken !== params.trialToken) {
    return { nextState: state, accepted: false, outcome: null };
  }
  if (state.phase !== 'waiting' && state.phase !== 'go') {
    return { nextState: state, accepted: false, outcome: null };
  }

  const meta = getSignalTrialDisplayMeta(state.config, state.currentTrialIndex);
  const completedAt = params.nowWallClockMs ?? Date.now();

  if (state.phase === 'waiting') {
    const record: SignalTrialRecord = {
      trialIndex: state.currentTrialIndex,
      displayNumber: meta.displayNumber,
      isPractice: meta.isPractice,
      participantLabel: state.currentParticipantLabel,
      outcome: 'early',
      reactionMs: null, // NEVER 0 ms
      waitDelayMs: state.currentWaitDelayMs ?? E03_SIGNAL_MIN_WAIT_MS,
      completedAt,
    };
    return {
      accepted: true,
      outcome: 'early',
      nextState: {
        ...state,
        phase: 'result',
        goTimestampMs: null,
        lastResult: record,
        records: [...state.records, record],
      },
    };
  }

  // phase === 'go'
  const startMs = state.goTimestampMs ?? params.responseTimestampMs;
  const elapsedMs = Math.max(1, Math.round(params.responseTimestampMs - startMs));
  const record: SignalTrialRecord = {
    trialIndex: state.currentTrialIndex,
    displayNumber: meta.displayNumber,
    isPractice: meta.isPractice,
    participantLabel: state.currentParticipantLabel,
    outcome: 'valid',
    reactionMs: elapsedMs,
    waitDelayMs: state.currentWaitDelayMs ?? E03_SIGNAL_MIN_WAIT_MS,
    completedAt,
  };
  return {
    accepted: true,
    outcome: 'valid',
    nextState: {
      ...state,
      phase: 'result',
      goTimestampMs: null,
      lastResult: record,
      records: [...state.records, record],
    },
  };
}

/**
 * Handles 3-second no-response timeout during 'go'.
 */
export function recordSignalTimeout(
  state: SignalSessionState,
  trialToken: string,
  nowWallClockMs: number = Date.now()
): { nextState: SignalSessionState; accepted: boolean } {
  if (state.phase !== 'go' || state.activeTrialToken !== trialToken) {
    return { nextState: state, accepted: false };
  }
  const meta = getSignalTrialDisplayMeta(state.config, state.currentTrialIndex);
  const record: SignalTrialRecord = {
    trialIndex: state.currentTrialIndex,
    displayNumber: meta.displayNumber,
    isPractice: meta.isPractice,
    participantLabel: state.currentParticipantLabel,
    outcome: 'timeout',
    reactionMs: null,
    waitDelayMs: state.currentWaitDelayMs ?? E03_SIGNAL_MIN_WAIT_MS,
    completedAt: nowWallClockMs,
  };
  return {
    accepted: true,
    nextState: {
      ...state,
      phase: 'result',
      goTimestampMs: null,
      lastResult: record,
      records: [...state.records, record],
    },
  };
}

/**
 * Interrupts an in-progress 'waiting' or 'go' measurement (tab switch, blur, pause).
 * Does NOT save an invalid measurement; lets the player redo this exact trial cleanly.
 */
export function interruptSignalTrial(
  state: SignalSessionState,
  reason: string
): SignalSessionState {
  if (state.phase !== 'waiting' && state.phase !== 'go') {
    return state;
  }
  return {
    ...state,
    phase: 'interrupted',
    currentWaitDelayMs: null,
    goTimestampMs: null,
    interruptedReason: reason,
    interruptedCount: state.interruptedCount + 1,
  };
}

/**
 * Prepares the interrupted trial to be redone cleanly (back to 'idle' on the same trialIndex).
 */
export function redoInterruptedSignalTrial(state: SignalSessionState): SignalSessionState {
  if (state.phase !== 'interrupted') return state;
  return {
    ...state,
    phase: 'idle',
    currentWaitDelayMs: null,
    goTimestampMs: null,
    interruptedReason: null,
  };
}

/**
 * Advances from 'result' to the next trial ('idle') or to 'summary' after the final official trial.
 * Player/teacher MUST explicitly trigger this; never auto-starts the next trial.
 */
export function advanceToNextSignalTrial(state: SignalSessionState): SignalSessionState {
  if (state.phase !== 'result') return state;
  const nextIndex = state.currentTrialIndex + 1;
  const total = getTotalSignalTrials(state.config);
  if (nextIndex >= total) {
    return {
      ...state,
      phase: 'summary',
      currentTrialIndex: total,
      currentWaitDelayMs: null,
      goTimestampMs: null,
    };
  }
  const meta = getSignalTrialDisplayMeta(state.config, nextIndex);
  const nextLabel =
    state.config.format === 'class_turn'
      ? meta.isPractice
        ? 'Học sinh làm quen'
        : `Học sinh lượt ${meta.displayNumber}`
      : state.currentParticipantLabel || 'Người chơi';

  return {
    ...state,
    phase: 'idle',
    currentTrialIndex: nextIndex,
    currentWaitDelayMs: null,
    goTimestampMs: null,
    currentParticipantLabel: nextLabel,
    lastResult: null,
    interruptedReason: null,
  };
}

/**
 * Computes official summary statistics strictly excluding practice trials.
 * Returns null for fastestMs & medianMs when there are 0 valid official trials.
 */
export function computeSignalSummary(state: SignalSessionState): SignalSessionSummary {
  const practiceRecords = state.records.filter((r) => r.isPractice);
  const officialRecords = state.records.filter((r) => !r.isPractice);

  const validTimes = officialRecords
    .filter((r) => r.outcome === 'valid' && typeof r.reactionMs === 'number' && Number.isFinite(r.reactionMs))
    .map((r) => r.reactionMs as number)
    .sort((a, b) => a - b);

  const earlyCount = officialRecords.filter((r) => r.outcome === 'early').length;
  const timeoutCount = officialRecords.filter((r) => r.outcome === 'timeout').length;

  let fastestMs: number | null = null;
  let medianMs: number | null = null;

  if (validTimes.length > 0) {
    fastestMs = validTimes[0];
    const mid = Math.floor(validTimes.length / 2);
    if (validTimes.length % 2 === 1) {
      medianMs = validTimes[mid];
    } else {
      medianMs = Math.round((validTimes[mid - 1] + validTimes[mid]) / 2);
    }
  }

  return {
    deviceTimingLabel: E03_DEVICE_TIMING_LABEL,
    deviceTimingNote: E03_DEVICE_TIMING_NOTE,
    practiceCompletedCount: practiceRecords.length,
    officialTotalCount: officialRecords.length,
    validCount: validTimes.length,
    earlyCount,
    timeoutCount,
    interruptedCount: state.interruptedCount,
    fastestMs,
    medianMs,
    officialRecords,
  };
}

// ============================================================================
// MODE 2: TOÁN NHANH (QUICK MATH) TYPES, SAMPLE PACK & ENGINE
// ============================================================================

export type MathParticipantGradeChoice = 'ungraded' | 'no_answer' | ReflexOptionLetter;
export type MathSessionStatus = 'playing' | 'finished';

export interface ReflexMathOption {
  id: string; // Stable option ID preserved across shuffling
  label: ReflexOptionLetter;
  text: string;
}

export interface ReflexMathQuestion {
  id: string;
  code: string;
  topicLabel: string;
  stem: string;
  subject: string;
  grade: string;
  level: string;
  options: ReflexMathOption[];
  correctOptionId: string;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface ReflexMathConfig {
  participantMode: ReflexMathParticipantMode;
  teams: ReflexTeamConfig[];
  sourceKind: ReflexQuestionSourceKind;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionCount: number; // default 8
  timerSeconds: number; // default 20; 0 = unlimited
  shuffleOptions: boolean;
}

export interface ReflexMathTurnRecord {
  questionIndex: number; // 0-based
  questionId: string;
  correctOptionId: string;
  correctOptionLabel: ReflexOptionLetter;
  /** Recorded choice by participantId ('solo_1', 'class_1', or team.id): stable optionId or 'no_answer'. */
  chosenOptionIdByParticipant: Record<string, string | 'no_answer'>;
  chosenLabelByParticipant: Record<string, ReflexOptionLetter | 'no_answer'>;
  isCorrectByParticipant: Record<string, boolean>;
  pointsEarnedByParticipant: Record<string, number>; // 10 or 0 (never speed bonus)
  committedAt: number;
  wasEdited?: boolean;
}

export interface ReflexMathStanding {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  points: number;
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  rank: number;
  isTied: boolean;
}

export interface ReflexMathState {
  config: ReflexMathConfig;
  questions: ReflexMathQuestion[];
  currentIndex: number; // 0..questions.length-1
  history: ReflexMathTurnRecord[];
  status: MathSessionStatus;
}

export interface ReflexMathSetupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveQuestionCount: number;
}

// ============================================================================
// EXACT 8-QUESTION SAMPLE PACK: "Phản xạ nhanh – Toán THCS" ("Dữ liệu mẫu")
// ============================================================================

export const E03_SAMPLE_MATH_QUESTIONS: ReflexMathQuestion[] = [
  {
    id: 'e03_sample_01',
    code: 'E03-S01',
    topicLabel: 'Số nguyên',
    stem: 'Tính \\(-12+19\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e03_q1_a', label: 'A', text: '\\(7\\)' },
      { id: 'e03_q1_b', label: 'B', text: '\\(-7\\)' },
      { id: 'e03_q1_c', label: 'C', text: '\\(-31\\)' },
      { id: 'e03_q1_d', label: 'D', text: '\\(31\\)' },
    ],
    correctOptionId: 'e03_q1_a',
    officialAnswerText: '\\(7\\)',
    explanation:
      'Cộng hai số nguyên trái dấu: lấy hiệu giá trị tuyệt đối \\(19 - 12 = 7\\), giữ dấu dương của \\(19\\), được \\(7\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_02',
    code: 'E03-S02',
    topicLabel: 'Phân số',
    stem: 'Tính \\(\\frac{2}{3}+\\frac{1}{6}\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e03_q2_a', label: 'A', text: '\\(\\frac{3}{9}\\)' },
      { id: 'e03_q2_b', label: 'B', text: '\\(\\frac{5}{6}\\)' },
      { id: 'e03_q2_c', label: 'C', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e03_q2_d', label: 'D', text: '\\(\\frac{7}{6}\\)' },
    ],
    correctOptionId: 'e03_q2_b',
    officialAnswerText: '\\(\\frac{5}{6}\\)',
    explanation:
      'Quy đồng mẫu chung \\(6\\): \\(\\frac{2}{3} = \\frac{4}{6}\\), suy ra \\(\\frac{4}{6} + \\frac{1}{6} = \\frac{5}{6}\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_03',
    code: 'E03-S03',
    topicLabel: 'Lũy thừa & Dấu âm',
    stem: 'Tính \\(-3^2\\).',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e03_q3_a', label: 'A', text: '\\(9\\)' },
      { id: 'e03_q3_b', label: 'B', text: '\\(-6\\)' },
      { id: 'e03_q3_c', label: 'C', text: '\\(-9\\)' },
      { id: 'e03_q3_d', label: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'e03_q3_c',
    officialAnswerText: '\\(-9\\)',
    explanation:
      'Không có dấu ngoặc quanh \\(-3\\), nên lũy thừa thực hiện trước: \\(-3^2 = -(3^2) = -9\\) (khác với \\((-3)^2 = 9\\)).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_04',
    code: 'E03-S04',
    topicLabel: 'Căn bậc hai',
    stem: 'Tính \\(\\sqrt{(-9)^2}\\).',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e03_q4_a', label: 'A', text: '\\(-9\\)' },
      { id: 'e03_q4_b', label: 'B', text: '\\(81\\)' },
      { id: 'e03_q4_c', label: 'C', text: '\\(3\\)' },
      { id: 'e03_q4_d', label: 'D', text: '\\(9\\)' },
    ],
    correctOptionId: 'e03_q4_d',
    officialAnswerText: '\\(9\\)',
    explanation:
      'Ta có \\((-9)^2 = 81\\), nên căn bậc hai số học \\(\\sqrt{(-9)^2} = \\sqrt{81} = |-9| = 9\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_05',
    code: 'E03-S05',
    topicLabel: 'Phương trình bậc nhất',
    stem: 'Giải \\(3x+2=17\\).',
    subject: 'math',
    grade: '8',
    level: 'know',
    options: [
      { id: 'e03_q5_a', label: 'A', text: '\\(x=5\\)' },
      { id: 'e03_q5_b', label: 'B', text: '\\(x=6\\)' },
      { id: 'e03_q5_c', label: 'C', text: '\\(x=15\\)' },
      { id: 'e03_q5_d', label: 'D', text: '\\(x=\\frac{19}{3}\\)' },
    ],
    correctOptionId: 'e03_q5_a',
    officialAnswerText: '\\(x=5\\)',
    explanation:
      'Chuyển vế: \\(3x = 17 - 2 = 15\\), chia cả hai vế cho \\(3\\) thu được \\(x = 5\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_06',
    code: 'E03-S06',
    topicLabel: 'Tỉ số phần trăm',
    stem: 'Tìm \\(25\\%\\) của \\(60\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e03_q6_a', label: 'A', text: '\\(12\\)' },
      { id: 'e03_q6_b', label: 'B', text: '\\(15\\)' },
      { id: 'e03_q6_c', label: 'C', text: '\\(20\\)' },
      { id: 'e03_q6_d', label: 'D', text: '\\(25\\)' },
    ],
    correctOptionId: 'e03_q6_b',
    officialAnswerText: '\\(15\\)',
    explanation:
      'Đổi \\(25\\% = \\frac{1}{4}\\), suy ra \\(25\\%\\) của \\(60\\) là \\(60 \\times \\frac{1}{4} = 15\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_07',
    code: 'E03-S07',
    topicLabel: 'Hình học phẳng',
    stem: 'Hình vuông cạnh \\(4{,}5\\,\\mathrm{cm}\\) có chu vi bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e03_q7_a', label: 'A', text: '\\(9\\,\\mathrm{cm}\\)' },
      { id: 'e03_q7_b', label: 'B', text: '\\(16\\,\\mathrm{cm}\\)' },
      { id: 'e03_q7_c', label: 'C', text: '\\(18\\,\\mathrm{cm}\\)' },
      { id: 'e03_q7_d', label: 'D', text: '\\(20{,}25\\,\\mathrm{cm}\\)' },
    ],
    correctOptionId: 'e03_q7_c',
    officialAnswerText: '\\(18\\,\\mathrm{cm}\\)',
    explanation:
      'Chu vi hình vuông bằng bốn lần độ dài cạnh: \\(C = 4 \\times 4{,}5 = 18\\,\\mathrm{cm}\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
  {
    id: 'e03_sample_08',
    code: 'E03-S08',
    topicLabel: 'Xác suất thực nghiệm',
    stem: 'Tung một xúc xắc cân đối sáu mặt. Xác suất ra số nhỏ hơn \\(3\\) là bao nhiêu?',
    subject: 'math',
    grade: '8',
    level: 'understand',
    options: [
      { id: 'e03_q8_a', label: 'A', text: '\\(\\frac{1}{6}\\)' },
      { id: 'e03_q8_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e03_q8_c', label: 'C', text: '\\(\\frac{2}{3}\\)' },
      { id: 'e03_q8_d', label: 'D', text: '\\(\\frac{1}{3}\\)' },
    ],
    correctOptionId: 'e03_q8_d',
    officialAnswerText: '\\(\\frac{1}{3}\\)',
    explanation:
      'Có \\(6\\) kết quả đồng khả năng \\(\\{1; 2; 3; 4; 5; 6\\}\\), trong đó \\(2\\) kết quả nhỏ hơn \\(3\\) là \\(1\\) và \\(2\\). Xác suất là \\(\\frac{2}{6} = \\frac{1}{3}\\).',
    isSample: true,
    sourceBadge: E03_SAMPLE_BADGE,
  },
];

// ============================================================================
// TEAM, CONFIG & BANK ADAPTER HELPERS
// ============================================================================

export function createReflexTeams(count: number): ReflexTeamConfig[] {
  const safeCount = Math.max(2, Math.min(6, Math.round(count)));
  const names = ['Đội 1', 'Đội 2', 'Đội 3', 'Đội 4', 'Đội 5', 'Đội 6'];
  return Array.from({ length: safeCount }, (_, idx) => ({
    id: `team_${idx + 1}`,
    teamNumber: idx + 1,
    name: names[idx] ?? `Đội ${idx + 1}`,
    paletteIndex: idx % REFLEX_TEAM_PALETTES.length,
  }));
}

export function createDefaultReflexMathConfig(
  participantMode: ReflexMathParticipantMode = 'solo'
): ReflexMathConfig {
  return {
    participantMode,
    teams: createReflexTeams(4),
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionCount: E03_DEFAULT_MATH_QUESTIONS,
    timerSeconds: E03_DEFAULT_MATH_TIMER_SECONDS,
    shuffleOptions: true,
  };
}

export function getReflexParticipants(config: ReflexMathConfig): ReflexTeamConfig[] {
  if (config.participantMode === 'teams') {
    return config.teams;
  }
  if (config.participantMode === 'whole_class') {
    return [{ id: 'class_1', teamNumber: 1, name: 'Cả lớp', paletteIndex: 0 }];
  }
  return [{ id: 'solo_1', teamNumber: 1, name: 'Tự luyện', paletteIndex: 0 }];
}

export function getCorrectOptionLabelForReflexQuestion(
  question: ReflexMathQuestion
): ReflexOptionLetter {
  const found = question.options.find((o) => o.id === question.correctOptionId);
  return found ? found.label : 'A';
}

export function getReflexOptionByLabel(
  question: ReflexMathQuestion,
  label: ReflexOptionLetter
): ReflexMathOption | undefined {
  return question.options.find((o) => o.label === label);
}

export function shuffleReflexArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleReflexOptionsPreservingId(
  item: ReflexMathQuestion,
  rng: () => number = Math.random
): ReflexMathQuestion {
  const shuffled = shuffleReflexArray(item.options, rng).map((opt, idx) => ({
    ...opt,
    label: REFLEX_OPTION_LETTERS[idx] ?? 'D',
  }));
  return {
    ...item,
    options: shuffled,
  };
}

function normalizeStemKey(stem: string): string {
  return stem.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isReflexQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForReflex(question: Question): ReflexMathQuestion | null {
  if (question.type !== 'single_choice') return null;
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const validOptions = (question.options || [])
    .filter((o) => o && (o.text || '').trim().length > 0)
    .slice(0, 4);

  if (validOptions.length !== 4) return null;

  const rawCorrect = String(question.correctAnswer || '').trim();
  let matchedCorrect = validOptions.find(
    (o) => o.id === rawCorrect || o.label?.toUpperCase() === rawCorrect.toUpperCase()
  );
  if (!matchedCorrect) {
    const letterIdx = REFLEX_OPTION_LETTERS.indexOf(
      rawCorrect.toUpperCase() as ReflexOptionLetter
    );
    if (letterIdx >= 0 && validOptions[letterIdx]) {
      matchedCorrect = validOptions[letterIdx];
    }
  }
  if (!matchedCorrect) return null;

  const mappedOptions: ReflexMathOption[] = validOptions.map((opt, idx) => ({
    id: opt.id || `${question.id}_opt_${idx}`,
    label: REFLEX_OPTION_LETTERS[idx],
    text: opt.text.trim(),
  }));

  const correctMapped =
    mappedOptions[validOptions.indexOf(matchedCorrect)] || mappedOptions[0];

  return {
    id: question.id,
    code: question.code || `NH-${question.id.slice(0, 6).toUpperCase()}`,
    topicLabel: ((question.chapter || question.lesson || 'Kiến thức').trim()).slice(0, 26),
    stem: cleanStem,
    subject: question.subject || 'math',
    grade: question.grade || '6',
    level: question.level || 'know',
    options: mappedOptions,
    correctOptionId: correctMapped.id,
    officialAnswerText: correctMapped.text,
    explanation:
      (question.explanation || '').trim() ||
      `Đáp án đúng là ${correctMapped.label}: ${correctMapped.text}.`,
    isSample: false,
    sourceBadge: 'Ngân hàng câu hỏi',
  };
}

export function buildE03MathQuestionPool(params: {
  sourceKind: ReflexQuestionSourceKind;
  bankQuestions?: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): ReflexMathQuestion[] {
  if (params.sourceKind === 'sample') {
    return E03_SAMPLE_MATH_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
  }

  const seenStems = new Set<string>();
  const results: ReflexMathQuestion[] = [];
  const bank = params.bankQuestions || [];

  for (const q of bank) {
    if (!isReflexQuestionAllowedForRole(q, params.userRole)) continue;
    if (params.subjectFilter && params.subjectFilter !== 'all' && q.subject !== params.subjectFilter) {
      continue;
    }
    if (params.gradeFilter && params.gradeFilter !== 'all' && q.grade !== params.gradeFilter) {
      continue;
    }
    if (params.levelFilter && params.levelFilter !== 'all' && q.level !== params.levelFilter) {
      continue;
    }
    const adapted = adaptSmartEduQuestionForReflex(q);
    if (!adapted) continue;
    const key = normalizeStemKey(adapted.stem);
    if (seenStems.has(key)) continue;
    seenStems.add(key);
    results.push(adapted);
  }

  return results;
}

export function validateReflexMathSetup(
  config: ReflexMathConfig,
  availableCount: number
): ReflexMathSetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.participantMode === 'teams') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ thi đấu đội cần từ 2 đến 6 đội.');
    }
    config.teams.forEach((team, idx) => {
      if (!team.name.trim()) {
        errors.push(`Đội số ${idx + 1} chưa có tên.`);
      }
    });
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu phải từ 0 (không giới hạn) đến 300 giây.');
  }

  if (availableCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện không có câu trắc nghiệm 4 phương án phù hợp. Hãy đổi bộ lọc hoặc dùng bộ mẫu 8 câu.'
    );
  } else if (config.questionCount > availableCount) {
    warnings.push(
      `Bộ câu hỏi hiện chỉ có ${availableCount} câu (ít hơn ${config.questionCount} câu yêu cầu). Phiên sẽ chạy ${availableCount} câu và không lặp lại câu.`
    );
  }

  const effectiveQuestionCount = Math.min(
    Math.max(1, Math.min(30, config.questionCount)),
    Math.max(0, availableCount)
  );

  return {
    valid: errors.length === 0 && effectiveQuestionCount > 0,
    errors,
    warnings,
    effectiveQuestionCount,
  };
}

// ============================================================================
// QUICK MATH SESSION REDUCERS (COMMIT, EDIT LAST, STANDINGS)
// ============================================================================

export function createInitialReflexMathState(params: {
  config: ReflexMathConfig;
  pool: ReflexMathQuestion[];
  rng?: () => number;
}): ReflexMathState {
  const rng = params.rng ?? Math.random;
  const count = Math.min(
    Math.max(1, params.config.questionCount),
    params.pool.length
  );
  const selected = params.pool.slice(0, count).map((q) =>
    params.config.shuffleOptions
      ? shuffleReflexOptionsPreservingId(q, rng)
      : { ...q, options: q.options.map((o) => ({ ...o })) }
  );

  return {
    config: {
      ...params.config,
      questionCount: selected.length,
      teams: params.config.teams.map((t) => ({ ...t })),
    },
    questions: selected,
    currentIndex: 0,
    history: [],
    status: selected.length > 0 ? 'playing' : 'finished',
  };
}

export function createEmptyDraftGrades(
  config: ReflexMathConfig
): Record<string, MathParticipantGradeChoice> {
  const draft: Record<string, MathParticipantGradeChoice> = {};
  for (const p of getReflexParticipants(config)) {
    draft[p.id] = 'ungraded';
  }
  return draft;
}

export function areAllMathParticipantsGraded(
  config: ReflexMathConfig,
  draftGrades: Record<string, MathParticipantGradeChoice>
): boolean {
  const participants = getReflexParticipants(config);
  if (participants.length === 0) return false;
  return participants.every((p) => {
    const val = draftGrades[p.id];
    return val !== undefined && val !== 'ungraded';
  });
}

export function getUngradedMathParticipantNames(
  config: ReflexMathConfig,
  draftGrades: Record<string, MathParticipantGradeChoice>
): string[] {
  return getReflexParticipants(config)
    .filter((p) => !draftGrades[p.id] || draftGrades[p.id] === 'ungraded')
    .map((p) => p.name);
}

function buildMathTurnRecord(params: {
  questionIndex: number;
  question: ReflexMathQuestion;
  config: ReflexMathConfig;
  draftGrades: Record<string, MathParticipantGradeChoice>;
  committedAt: number;
  wasEdited?: boolean;
}): ReflexMathTurnRecord {
  const participants = getReflexParticipants(params.config);
  const correctLabel = getCorrectOptionLabelForReflexQuestion(params.question);

  const chosenOptionIdByParticipant: Record<string, string | 'no_answer'> = {};
  const chosenLabelByParticipant: Record<string, ReflexOptionLetter | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsEarnedByParticipant: Record<string, number> = {};

  for (const p of participants) {
    const raw = params.draftGrades[p.id];
    if (!raw || raw === 'ungraded' || raw === 'no_answer') {
      chosenOptionIdByParticipant[p.id] = 'no_answer';
      chosenLabelByParticipant[p.id] = 'no_answer';
      isCorrectByParticipant[p.id] = false;
      pointsEarnedByParticipant[p.id] = 0;
    } else {
      const opt = getReflexOptionByLabel(params.question, raw);
      const optId = opt?.id ?? 'no_answer';
      const isRight = optId === params.question.correctOptionId;
      chosenOptionIdByParticipant[p.id] = optId;
      chosenLabelByParticipant[p.id] = opt ? opt.label : 'no_answer';
      isCorrectByParticipant[p.id] = isRight;
      pointsEarnedByParticipant[p.id] = isRight ? E03_POINTS_PER_CORRECT : 0;
    }
  }

  return {
    questionIndex: params.questionIndex,
    questionId: params.question.id,
    correctOptionId: params.question.correctOptionId,
    correctOptionLabel: correctLabel,
    chosenOptionIdByParticipant,
    chosenLabelByParticipant,
    isCorrectByParticipant,
    pointsEarnedByParticipant,
    committedAt: params.committedAt,
    wasEdited: params.wasEdited,
  };
}

/**
 * Commits grades for the current question.
 * - Requires all participants graded (strictly rejects 'ungraded').
 * - Idempotent by questionId: duplicate commits for the same question return unchanged state.
 * - Does NOT auto-advance; teacher clicks "Câu tiếp theo" after explaining.
 */
export function commitReflexMathTurn(
  state: ReflexMathState,
  draftGrades: Record<string, MathParticipantGradeChoice>,
  nowMs: number = Date.now()
): { nextState: ReflexMathState; committed: boolean; error?: string } {
  if (state.status === 'finished') {
    return { nextState: state, committed: false, error: 'Phiên đã kết thúc.' };
  }
  const currentQ = state.questions[state.currentIndex];
  if (!currentQ) {
    return { nextState: state, committed: false, error: 'Không tìm thấy câu hỏi hiện tại.' };
  }
  // Idempotency guard
  if (state.history.some((h) => h.questionId === currentQ.id)) {
    return { nextState: state, committed: false, error: 'Câu hỏi này đã được chấm điểm.' };
  }
  if (!areAllMathParticipantsGraded(state.config, draftGrades)) {
    const missing = getUngradedMathParticipantNames(state.config, draftGrades);
    return {
      nextState: state,
      committed: false,
      error: `Vẫn còn mục chưa chấm: ${missing.join(', ')}.`,
    };
  }

  const record = buildMathTurnRecord({
    questionIndex: state.currentIndex,
    question: currentQ,
    config: state.config,
    draftGrades,
    committedAt: nowMs,
  });

  return {
    committed: true,
    nextState: {
      ...state,
      history: [...state.history, record],
    },
  };
}

/**
 * Allows editing the just-graded current question BEFORE advancing to the next question.
 * Recomputes everything cleanly from history.
 */
export function editCurrentReflexMathTurn(
  state: ReflexMathState,
  updatedGrades: Record<string, MathParticipantGradeChoice>,
  nowMs: number = Date.now()
): { nextState: ReflexMathState; edited: boolean; error?: string } {
  const currentQ = state.questions[state.currentIndex];
  if (!currentQ) {
    return { nextState: state, edited: false, error: 'Không có câu hỏi để sửa.' };
  }
  const existingIdx = state.history.findIndex((h) => h.questionId === currentQ.id);
  if (existingIdx < 0) {
    return { nextState: state, edited: false, error: 'Câu hỏi hiện tại chưa được chốt.' };
  }
  if (!areAllMathParticipantsGraded(state.config, updatedGrades)) {
    const missing = getUngradedMathParticipantNames(state.config, updatedGrades);
    return {
      nextState: state,
      edited: false,
      error: `Vẫn còn mục chưa chấm: ${missing.join(', ')}.`,
    };
  }

  const updatedRecord = buildMathTurnRecord({
    questionIndex: state.currentIndex,
    question: currentQ,
    config: state.config,
    draftGrades: updatedGrades,
    committedAt: nowMs,
    wasEdited: true,
  });

  const nextHistory = state.history.map((h, idx) => (idx === existingIdx ? updatedRecord : h));
  return {
    edited: true,
    nextState: {
      ...state,
      history: nextHistory,
    },
  };
}

/**
 * Advances to the next question after the current question has been graded & revealed.
 * If this was the final question, finishes the session cleanly.
 */
export function advanceReflexMathQuestion(state: ReflexMathState): ReflexMathState {
  if (state.status === 'finished') return state;
  const currentQ = state.questions[state.currentIndex];
  if (!currentQ) return { ...state, status: 'finished' };
  const isCommitted = state.history.some((h) => h.questionId === currentQ.id);
  if (!isCommitted) return state;

  if (state.currentIndex + 1 >= state.questions.length) {
    return {
      ...state,
      status: 'finished',
    };
  }
  return {
    ...state,
    currentIndex: state.currentIndex + 1,
  };
}

/**
 * Pure standings calculation strictly from history.
 * Equal points receive identical rank and `isTied = true` ("Đồng hạng").
 */
export function computeMathStandingsFromHistory(state: ReflexMathState): ReflexMathStanding[] {
  const participants = getReflexParticipants(state.config);
  const raw = participants.map((p) => {
    let points = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let noAnswerCount = 0;

    for (const turn of state.history) {
      const choice = turn.chosenOptionIdByParticipant[p.id];
      const earned = turn.pointsEarnedByParticipant[p.id] ?? 0;
      points += earned;
      if (choice === 'no_answer' || !choice) {
        noAnswerCount += 1;
      } else if (turn.isCorrectByParticipant[p.id]) {
        correctCount += 1;
      } else {
        wrongCount += 1;
      }
    }

    return {
      id: p.id,
      teamNumber: p.teamNumber,
      name: p.name,
      paletteIndex: p.paletteIndex,
      points,
      correctCount,
      wrongCount,
      noAnswerCount,
      rank: 1,
      isTied: false,
    };
  });

  raw.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.teamNumber - b.teamNumber;
  });

  // Assign standard competition ranks & detect ties
  const countByPoints = new Map<number, number>();
  for (const row of raw) {
    countByPoints.set(row.points, (countByPoints.get(row.points) ?? 0) + 1);
  }

  for (let i = 0; i < raw.length; i++) {
    if (i > 0 && raw[i].points === raw[i - 1].points) {
      raw[i].rank = raw[i - 1].rank;
    } else {
      raw[i].rank = i + 1;
    }
    raw[i].isTied = (countByPoints.get(raw[i].points) ?? 0) > 1;
  }

  return raw;
}

// ============================================================================
// /demo-ISOLATED SESSION PERSISTENCE WITH CORRUPT JSON RECOVERY
// ============================================================================

export interface E03PersistedSession {
  version: number;
  activeMode: ReflexGameMode;
  signalState: SignalSessionState;
  mathState: ReflexMathState | null;
  savedAt: number;
}

export function getE03StorageKey(forceDemo?: boolean): string {
  const inDemo = forceDemo ?? isKhktDemoRuntime();
  return inDemo
    ? `${KHKT_DEMO_STORAGE_PREFIX}${E03_SESSION_STORAGE_KEY}`
    : E03_SESSION_STORAGE_KEY;
}

export function saveE03Session(
  payload: Omit<E03PersistedSession, 'version' | 'savedAt'>,
  storage?: Pick<Storage, 'setItem'>,
  forceDemo?: boolean
): void {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) return;
  try {
    // Never persist mid-measurement waiting/go timers as active — normalize to 'idle' cleanly
    const safeSignal: SignalSessionState =
      payload.signalState.phase === 'waiting' || payload.signalState.phase === 'go'
        ? {
            ...payload.signalState,
            phase: 'idle',
            currentWaitDelayMs: null,
            goTimestampMs: null,
          }
        : payload.signalState;

    const record: E03PersistedSession = {
      version: E03_SESSION_VERSION,
      activeMode: payload.activeMode,
      signalState: safeSignal,
      mathState: payload.mathState,
      savedAt: Date.now(),
    };
    targetStorage.setItem(getE03StorageKey(forceDemo), JSON.stringify(record));
  } catch {
    // Ignore quota or privacy mode errors
  }
}

export function loadE03Session(
  storage?: Pick<Storage, 'getItem' | 'removeItem'>,
  forceDemo?: boolean
): E03PersistedSession | null {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) return null;
  const key = getE03StorageKey(forceDemo);
  try {
    const raw = targetStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<E03PersistedSession>;
    if (
      !parsed ||
      parsed.version !== E03_SESSION_VERSION ||
      (parsed.activeMode !== 'signal' && parsed.activeMode !== 'math') ||
      !parsed.signalState ||
      !Array.isArray(parsed.signalState.records)
    ) {
      targetStorage.removeItem(key);
      return null;
    }

    const safeSignal: SignalSessionState =
      parsed.signalState.phase === 'waiting' || parsed.signalState.phase === 'go'
        ? {
            ...parsed.signalState,
            phase: 'idle',
            currentWaitDelayMs: null,
            goTimestampMs: null,
          }
        : parsed.signalState;

    return {
      version: E03_SESSION_VERSION,
      activeMode: parsed.activeMode,
      signalState: safeSignal,
      mathState: parsed.mathState ?? null,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    try {
      targetStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearE03Session(
  storage?: Pick<Storage, 'removeItem'>,
  forceDemo?: boolean
): void {
  const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!targetStorage) return;
  try {
    targetStorage.removeItem(getE03StorageKey(forceDemo));
  } catch {
    // Ignore
  }
}
