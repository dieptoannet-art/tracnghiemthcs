/**
 * D01 — ĐẤU TRƯỜNG 1 ĐẤU 1 3D ("SONG ĐẤU TRI THỨC") — Tây Đô Smart EDU
 * Pure deterministic engine supporting:
 * - Two symmetrical sides (Side A Blue vs. Side B Orange/Gold) for 1–50 student classrooms
 * - Solo self-practice modes for 1 student (`solo_single` & `solo_two_turns`) with ZERO fake AI opponents
 * - Two answer modes:
 *   1. Simultaneous ("Đối đáp đồng thời" — default): mini-board/paper workflow, both sides earn points if right,
 *      no reveal until both sides are locked/marked, order of teacher input never biases scoring.
 *   2. Buzzer ("Giành quyền trả lời" — optional): teacher hand-raise OR shared-keyboard event order (clearly labeled),
 *      single chance per responder, transfer to opponent on wrong/timeout (no points given merely because rival missed),
 *      near-tie resolution (teacher picks or "Không phân định — hỏi lại"), turnToken rejection of stale callbacks.
 * - Optional Tie-Breaker ("Câu phụ", 1–3 rounds max) strictly separated from main-round score, never infinite.
 * - Single deadline-based clock with pause/resume preservation (tab switches never add extra time; simultaneous
 *   lock + expiry yields one atomic result).
 * - Edit just-confirmed round (recomputes cleanly from history with audit count) + explicit-confirm rollback.
 * - Two built-in 10+3 sample packs ("Toán THCS — Song đấu tính toán" & "Tin học THCS — Song đấu thế giới số"),
 *   Smart EDU RBAC bank adapter, optionId-locked one-time shuffling, Unicode-normalized short-answer check.
 * - Demo-isolated local persistence & multi-match archive (rematch / swap pair never overwrites finished matches).
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type DuelSideId = 'A' | 'B';

export type DuelAnswerMode = 'simultaneous' | 'buzzer';

export type DuelPlayStyle = 'duel_2_sides' | 'solo_single' | 'solo_two_turns';

export type DuelQuestionSource = 'sample_math' | 'sample_info' | 'bank';

export type DuelQuestionType = 'single_choice' | 'true_false' | 'short_answer';

export type DuelPhase =
  | 'setup'
  | 'ready'
  | 'buzzer_open'
  | 'answering'
  | 'locked'
  | 'scoring'
  | 'confirmed'
  | 'summary';

export type DuelMark = 'unmarked' | 'correct' | 'wrong' | 'no_answer';

export type DuelBuzzerTriggerSource = 'teacher_manual' | 'shared_keyboard';

export interface DuelContestant {
  side: DuelSideId;
  studentId: string | null;
  label: string;
  colorHex: string;
  colorNameVi: string;
  isTempLabel: boolean;
}

export interface DuelQuestionOption {
  optionId: string;
  label: string;
  textLatex: string;
}

export interface DuelQuestionItem {
  questionId: string;
  type: DuelQuestionType;
  topic: string;
  difficulty: 'Cơ bản' | 'Vận dụng' | 'Nâng cao';
  stemLatex: string;
  imageUrl?: string | null;
  options: DuelQuestionOption[];
  correctOptionId: string | null;
  acceptedAnswers: string[];
  answerLatex: string;
  explanationLatex: string;
  plainReadText: string;
  preserveOptionOrder?: boolean;
  isSample: boolean;
  sourceBadge: string;
}

export interface DuelSideRoundOutcome {
  side: DuelSideId;
  mark: DuelMark;
  selectedOptionId: string | null;
  textAnswer: string;
  pointsAwarded: number;
}

export interface DuelRoundRecord {
  roundIndex: number; // 1-based within main OR tie-breaker sequence
  isTieBreaker: boolean;
  turnToken: string;
  questionId: string;
  topic: string;
  stemLatex: string;
  answerLatex: string;
  explanationLatex: string;
  answerMode: DuelAnswerMode;
  buzzerWinnerSide: DuelSideId | null;
  buzzerTransferredTo: DuelSideId | null;
  outcomes: Record<DuelSideId, DuelSideRoundOutcome>;
  editCount: number;
  confirmedAt: number;
}

export interface DuelMatchConfig {
  playStyle: DuelPlayStyle;
  answerMode: DuelAnswerMode;
  buzzerSource: DuelBuzzerTriggerSource;
  questionSource: DuelQuestionSource;
  requestedMainCount: 5 | 10 | 15 | number;
  timerSeconds: number; // 0 = unlimited; default 30
  buzzerAnswerSeconds: number; // Dedicated response time after buzzer claim (default 15)
  pointsPerQuestion: number; // Default 10
  tieBreakerEnabled: boolean;
  maxTieBreakers: number; // 1..3
  sideA: DuelContestant;
  sideB: DuelContestant;
}

export interface DuelCompletedMatchSummary {
  matchId: string;
  finishedAt: number;
  playStyle: DuelPlayStyle;
  answerMode: DuelAnswerMode;
  sourceLabel: string;
  sideALabel: string;
  sideBLabel: string;
  mainScoreA: number;
  mainScoreB: number;
  tieBreakerScoreA: number;
  tieBreakerScoreB: number;
  mainPlayedCount: number;
  tieBreakerPlayedCount: number;
  endedEarly: boolean;
  outcomeLabel: string;
}

export interface DuelGameState {
  matchId: string;
  config: DuelMatchConfig;
  phase: DuelPhase;
  mainDeck: DuelQuestionItem[];
  tieBreakerDeck: DuelQuestionItem[];
  currentQuestionIndex: number; // 0-based index in active deck (mainDeck or tieBreakerDeck)
  inTieBreaker: boolean;
  turnToken: string;

  // Single deadline-based clock
  deadlineMs: number | null;
  pausedRemainingMs: number | null;
  isPaused: boolean;
  timedOutCurrentTurn: boolean;

  // Simultaneous / Manual draft answers
  draftMarks: Record<DuelSideId, DuelMark>;
  draftOptionIds: Record<DuelSideId, string | null>;
  draftTextAnswers: Record<DuelSideId, string>;
  bothSidesLockedConfirmed: boolean;

  // Buzzer mode state
  activeBuzzerSide: DuelSideId | null;
  buzzerAttemptsUsed: Record<DuelSideId, boolean>;
  buzzerTransferredTo: DuelSideId | null;
  lastClaimTimestampMs: number | null;
  lastClaimSide: DuelSideId | null;
  nearTiePending: boolean;
  buzzerResultLocked: boolean;

  // Idempotency & Edit state
  lastConfirmedTurnToken: string | null;
  editingLastConfirmed: boolean;
  endedEarly: boolean;

  // Authoritative history (ALL scores derived from history!)
  history: DuelRoundRecord[];
  completedMatches: DuelCompletedMatchSummary[];
  statusMessage: string | null;
}

export interface DuelScoreboard {
  mainScoreA: number;
  mainScoreB: number;
  tieBreakerScoreA: number;
  tieBreakerScoreB: number;
  mainPlayedCount: number;
  tieBreakerPlayedCount: number;
  statsA: { correct: number; wrong: number; noAnswer: number };
  statsB: { correct: number; wrong: number; noAnswer: number };
  outcome:
    | 'in_progress'
    | 'A_wins'
    | 'B_wins'
    | 'tie'
    | 'A_wins_tiebreaker'
    | 'B_wins_tiebreaker'
    | 'solo_complete';
  outcomeLabel: string;
}

export const D01_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D01_SESSION_STORAGE_KEY = 'taydo_d01_duel_1v1_session_v1';
export const D01_SESSION_VERSION = 1;
export const D01_NEAR_TIE_WINDOW_MS = 180;

export const D01_SAMPLE_PLAYER_PRESETS: { sideA: DuelContestant; sideB: DuelContestant } = {
  sideA: {
    side: 'A',
    studentId: null,
    label: 'Minh Anh (Mẫu)',
    colorHex: '#2563EB',
    colorNameVi: 'Xanh dương',
    isTempLabel: true,
  },
  sideB: {
    side: 'B',
    studentId: null,
    label: 'Gia Bảo (Mẫu)',
    colorHex: '#F59E0B',
    colorNameVi: 'Cam vàng',
    isTempLabel: true,
  },
};

export const D01_SAMPLE_TEAM_PRESETS: { sideA: DuelContestant; sideB: DuelContestant } = {
  sideA: {
    side: 'A',
    studentId: null,
    label: 'Đội Xanh (Mẫu)',
    colorHex: '#2563EB',
    colorNameVi: 'Xanh dương',
    isTempLabel: true,
  },
  sideB: {
    side: 'B',
    studentId: null,
    label: 'Đội Cam (Mẫu)',
    colorHex: '#F59E0B',
    colorNameVi: 'Cam vàng',
    isTempLabel: true,
  },
};

// ============================================================================
// SAMPLE PACK 1: TOÁN THCS — SONG ĐẤU TÍNH TOÁN (10 MAIN + 3 TIE-BREAKERS)
// Topics: Số học, phân số, lũy thừa, góc, chu vi và diện tích
// ============================================================================

export const D01_SAMPLE_MATH_MAIN: DuelQuestionItem[] = [
  {
    questionId: 'd01_math_01',
    type: 'single_choice',
    topic: 'Số học',
    difficulty: 'Cơ bản',
    stemLatex: 'Tính giá trị biểu thức \\(25 + 15 \\times 4 - 10\\).',
    options: [
      { optionId: 'm1_a', label: 'A', textLatex: '\\(75\\)' },
      { optionId: 'm1_b', label: 'B', textLatex: '\\(150\\)' },
      { optionId: 'm1_c', label: 'C', textLatex: '\\(85\\)' },
      { optionId: 'm1_d', label: 'D', textLatex: '\\(65\\)' },
    ],
    correctOptionId: 'm1_a',
    acceptedAnswers: ['75'],
    answerLatex: '\\(75\\)',
    explanationLatex: 'Thực hiện phép nhân trước: \\(15 \\times 4 = 60\\), sau đó \\(25 + 60 - 10 = 75\\).',
    plainReadText: 'Tính giá trị biểu thức 25 cộng 15 nhân 4 trừ 10.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_02',
    type: 'single_choice',
    topic: 'Phân số',
    difficulty: 'Cơ bản',
    stemLatex: 'Tính tổng hai phân số \\(\\frac{2}{3} + \\frac{1}{6}\\).',
    options: [
      { optionId: 'm2_a', label: 'A', textLatex: '\\(\\frac{3}{9}\\)' },
      { optionId: 'm2_b', label: 'B', textLatex: '\\(\\frac{5}{6}\\)' },
      { optionId: 'm2_c', label: 'C', textLatex: '\\(\\frac{3}{6}\\)' },
      { optionId: 'm2_d', label: 'D', textLatex: '\\(\\frac{7}{6}\\)' },
    ],
    correctOptionId: 'm2_b',
    acceptedAnswers: ['5/6'],
    answerLatex: '\\(\\frac{5}{6}\\)',
    explanationLatex: 'Quy đồng mẫu chung \\(6\\): \\(\\frac{2}{3} + \\frac{1}{6} = \\frac{4}{6} + \\frac{1}{6} = \\frac{5}{6}\\).',
    plainReadText: 'Tính tổng hai phân số 2 phần 3 cộng 1 phần 6.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_03',
    type: 'single_choice',
    topic: 'Lũy thừa',
    difficulty: 'Cơ bản',
    stemLatex: 'Giá trị của \\(3^3 - 2^4\\) bằng bao nhiêu?',
    options: [
      { optionId: 'm3_a', label: 'A', textLatex: '\\(1\\)' },
      { optionId: 'm3_b', label: 'B', textLatex: '\\(19\\)' },
      { optionId: 'm3_c', label: 'C', textLatex: '\\(11\\)' },
      { optionId: 'm3_d', label: 'D', textLatex: '\\(7\\)' },
    ],
    correctOptionId: 'm3_c',
    acceptedAnswers: ['11'],
    answerLatex: '\\(11\\)',
    explanationLatex: 'Ta có \\(3^3 = 27\\) và \\(2^4 = 16\\), suy ra \\(27 - 16 = 11\\).',
    plainReadText: 'Giá trị của 3 mũ 3 trừ 2 mũ 4 bằng bao nhiêu?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_04',
    type: 'true_false',
    topic: 'Góc',
    difficulty: 'Cơ bản',
    stemLatex: 'Khẳng định sau đúng hay sai: “Hai góc kề bù có tổng số đo bằng \\(180^\\circ\\)”.',
    options: [
      { optionId: 'm4_true', label: 'Đúng', textLatex: 'Đúng' },
      { optionId: 'm4_false', label: 'Sai', textLatex: 'Sai' },
    ],
    correctOptionId: 'm4_true',
    acceptedAnswers: ['đúng', 'dung'],
    answerLatex: 'Đúng',
    explanationLatex: 'Theo định nghĩa hình học phẳng, hai góc kề bù vừa kề nhau vừa bù nhau nên có tổng số đo bằng \\(180^\\circ\\).',
    plainReadText: 'Khẳng định sau đúng hay sai: Hai góc kề bù có tổng số đo bằng 180 độ.',
    preserveOptionOrder: true,
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_05',
    type: 'single_choice',
    topic: 'Chu vi',
    difficulty: 'Cơ bản',
    stemLatex: 'Một hình chữ nhật có chiều dài \\(12\\text{ cm}\\) và chiều rộng \\(7\\text{ cm}\\). Chu vi hình chữ nhật là:',
    options: [
      { optionId: 'm5_a', label: 'A', textLatex: '\\(19\\text{ cm}\\)' },
      { optionId: 'm5_b', label: 'B', textLatex: '\\(84\\text{ cm}\\)' },
      { optionId: 'm5_c', label: 'C', textLatex: '\\(34\\text{ cm}\\)' },
      { optionId: 'm5_d', label: 'D', textLatex: '\\(38\\text{ cm}\\)' },
    ],
    correctOptionId: 'm5_d',
    acceptedAnswers: ['38', '38 cm', '38cm'],
    answerLatex: '\\(38\\text{ cm}\\)',
    explanationLatex: 'Chu vi hình chữ nhật: \\(P = 2(a + b) = 2(12 + 7) = 38\\text{ cm}\\).',
    plainReadText: 'Một hình chữ nhật có chiều dài 12 xen-ti-mét và chiều rộng 7 xen-ti-mét. Tính chu vi hình chữ nhật.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_06',
    type: 'single_choice',
    topic: 'Diện tích',
    difficulty: 'Vận dụng',
    stemLatex: 'Tính diện tích hình tam giác có cạnh đáy \\(10\\text{ cm}\\) và chiều cao ứng với đáy đó là \\(6\\text{ cm}\\).',
    options: [
      { optionId: 'm6_a', label: 'A', textLatex: '\\(30\\text{ cm}^2\\)' },
      { optionId: 'm6_b', label: 'B', textLatex: '\\(60\\text{ cm}^2\\)' },
      { optionId: 'm6_c', label: 'C', textLatex: '\\(16\\text{ cm}^2\\)' },
      { optionId: 'm6_d', label: 'D', textLatex: '\\(32\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'm6_a',
    acceptedAnswers: ['30', '30 cm2'],
    answerLatex: '\\(30\\text{ cm}^2\\)',
    explanationLatex: 'Diện tích tam giác: \\(S = \\frac{1}{2} \\cdot 10 \\cdot 6 = 30\\text{ cm}^2\\).',
    plainReadText: 'Tính diện tích tam giác có đáy 10 xen-ti-mét và chiều cao 6 xen-ti-mét.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_07',
    type: 'single_choice',
    topic: 'Phân số',
    difficulty: 'Vận dụng',
    stemLatex: 'Rút gọn phân số \\(\\frac{36}{48}\\) về phân số tối giản:',
    options: [
      { optionId: 'm7_a', label: 'A', textLatex: '\\(\\frac{6}{8}\\)' },
      { optionId: 'm7_b', label: 'B', textLatex: '\\(\\frac{3}{4}\\)' },
      { optionId: 'm7_c', label: 'C', textLatex: '\\(\\frac{9}{12}\\)' },
      { optionId: 'm7_d', label: 'D', textLatex: '\\(\\frac{2}{3}\\)' },
    ],
    correctOptionId: 'm7_b',
    acceptedAnswers: ['3/4'],
    answerLatex: '\\(\\frac{3}{4}\\)',
    explanationLatex: 'Ước chung lớn nhất của \\(36\\) và \\(48\\) là \\(12\\), chia cả tử và mẫu cho \\(12\\) được \\(\\frac{3}{4}\\).',
    plainReadText: 'Rút gọn phân số 36 phần 48 về phân số tối giản.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_08',
    type: 'short_answer',
    topic: 'Góc',
    difficulty: 'Vận dụng',
    stemLatex: 'Cho hai góc phụ nhau \\(\\widehat{xOy}\\) và \\(\\widehat{yOz}\\). Biết \\(\\widehat{xOy} = 35^\\circ\\), hỏi số đo \\(\\widehat{yOz}\\) bằng bao nhiêu độ?',
    options: [],
    correctOptionId: null,
    acceptedAnswers: ['55', '55 độ', '55°', '55 do'],
    answerLatex: '\\(55^\\circ\\)',
    explanationLatex: 'Hai góc phụ nhau có tổng bằng \\(90^\\circ\\), nên \\(\\widehat{yOz} = 90^\\circ - 35^\\circ = 55^\\circ\\).',
    plainReadText: 'Cho hai góc phụ nhau xOy và yOz. Biết góc xOy bằng 35 độ, hỏi số đo góc yOz bằng bao nhiêu độ?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_09',
    type: 'single_choice',
    topic: 'Lũy thừa',
    difficulty: 'Vận dụng',
    stemLatex: 'Viết tích \\(5^2 \\cdot 5^4 : 5^3\\) dưới dạng một lũy thừa của \\(5\\):',
    options: [
      { optionId: 'm9_a', label: 'A', textLatex: '\\(5^9\\)' },
      { optionId: 'm9_b', label: 'B', textLatex: '\\(5^5\\)' },
      { optionId: 'm9_c', label: 'C', textLatex: '\\(5^3\\)' },
      { optionId: 'm9_d', label: 'D', textLatex: '\\(5^2\\)' },
    ],
    correctOptionId: 'm9_c',
    acceptedAnswers: ['5^3', '125'],
    answerLatex: '\\(5^3\\)',
    explanationLatex: 'Áp dụng quy tắc nhân và chia hai lũy thừa cùng cơ số: \\(5^{2 + 4 - 3} = 5^3\\).',
    plainReadText: 'Viết biểu thức 5 mũ 2 nhân 5 mũ 4 chia 5 mũ 3 dưới dạng một lũy thừa của 5.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_10',
    type: 'single_choice',
    topic: 'Diện tích',
    difficulty: 'Vận dụng',
    stemLatex: 'Một hình vuông có chu vi bằng \\(28\\text{ cm}\\). Diện tích của hình vuông đó là:',
    options: [
      { optionId: 'm10_a', label: 'A', textLatex: '\\(28\\text{ cm}^2\\)' },
      { optionId: 'm10_b', label: 'B', textLatex: '\\(56\\text{ cm}^2\\)' },
      { optionId: 'm10_c', label: 'C', textLatex: '\\(42\\text{ cm}^2\\)' },
      { optionId: 'm10_d', label: 'D', textLatex: '\\(49\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'm10_d',
    acceptedAnswers: ['49', '49 cm2'],
    answerLatex: '\\(49\\text{ cm}^2\\)',
    explanationLatex: 'Cạnh hình vuông là \\(28 : 4 = 7\\text{ cm}\\), suy ra diện tích \\(S = 7^2 = 49\\text{ cm}^2\\).',
    plainReadText: 'Một hình vuông có chu vi bằng 28 xen-ti-mét. Tính diện tích của hình vuông đó.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
];

export const D01_SAMPLE_MATH_TIEBREAKERS: DuelQuestionItem[] = [
  {
    questionId: 'd01_math_tb_01',
    type: 'single_choice',
    topic: 'Phân số (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Tính nhanh giá trị biểu thức \\(\\frac{3}{4} \\times \\frac{8}{9}\\).',
    options: [
      { optionId: 'mtb1_a', label: 'A', textLatex: '\\(\\frac{2}{3}\\)' },
      { optionId: 'mtb1_b', label: 'B', textLatex: '\\(\\frac{11}{13}\\)' },
      { optionId: 'mtb1_c', label: 'C', textLatex: '\\(\\frac{3}{2}\\)' },
      { optionId: 'mtb1_d', label: 'D', textLatex: '\\(\\frac{4}{9}\\)' },
    ],
    correctOptionId: 'mtb1_a',
    acceptedAnswers: ['2/3'],
    answerLatex: '\\(\\frac{2}{3}\\)',
    explanationLatex: 'Rút gọn chéo \\(3\\) với \\(9\\) và \\(8\\) với \\(4\\): \\(\\frac{3 \\times 8}{4 \\times 9} = \\frac{2}{3}\\).',
    plainReadText: 'Câu phụ 1: Tính nhanh 3 phần 4 nhân 8 phần 9.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_tb_02',
    type: 'single_choice',
    topic: 'Diện tích (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Một hình thang có hai đáy \\(8\\text{ cm}\\) và \\(12\\text{ cm}\\), chiều cao \\(5\\text{ cm}\\). Diện tích hình thang là:',
    options: [
      { optionId: 'mtb2_a', label: 'A', textLatex: '\\(100\\text{ cm}^2\\)' },
      { optionId: 'mtb2_b', label: 'B', textLatex: '\\(50\\text{ cm}^2\\)' },
      { optionId: 'mtb2_c', label: 'C', textLatex: '\\(40\\text{ cm}^2\\)' },
      { optionId: 'mtb2_d', label: 'D', textLatex: '\\(60\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'mtb2_b',
    acceptedAnswers: ['50', '50 cm2'],
    answerLatex: '\\(50\\text{ cm}^2\\)',
    explanationLatex: '\\(S = \\frac{(8 + 12) \\times 5}{2} = \\frac{20 \\times 5}{2} = 50\\text{ cm}^2\\).',
    plainReadText: 'Câu phụ 2: Hình thang có hai đáy 8 xen-ti-mét và 12 xen-ti-mét, chiều cao 5 xen-ti-mét. Tính diện tích.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_math_tb_03',
    type: 'short_answer',
    topic: 'Lũy thừa (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Tìm số tự nhiên \\(n\\) biết \\(2^n = 64\\).',
    options: [],
    correctOptionId: null,
    acceptedAnswers: ['6', 'n=6', 'n = 6'],
    answerLatex: '\\(n = 6\\)',
    explanationLatex: 'Vì \\(2^6 = 2 \\times 2 \\times 2 \\times 2 \\times 2 \\times 2 = 64\\) nên \\(n = 6\\).',
    plainReadText: 'Câu phụ 3: Tìm số tự nhiên n biết 2 mũ n bằng 64.',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
];

// ============================================================================
// SAMPLE PACK 2: TIN HỌC THCS — SONG ĐẤU THẾ GIỚI SỐ (10 MAIN + 3 TIE-BREAKERS)
// Topics: Thông tin, dữ liệu, thiết bị, tệp, thư mục, thuật toán và an toàn số
// ============================================================================

export const D01_SAMPLE_INFO_MAIN: DuelQuestionItem[] = [
  {
    questionId: 'd01_info_01',
    type: 'single_choice',
    topic: 'Thông tin & Dữ liệu',
    difficulty: 'Cơ bản',
    stemLatex: 'Trong máy tính, đơn vị nhỏ nhất để biểu diễn dữ liệu số là gì?',
    options: [
      { optionId: 'i1_a', label: 'A', textLatex: 'Bit (\\(0\\) hoặc \\(1\\))' },
      { optionId: 'i1_b', label: 'B', textLatex: 'Byte' },
      { optionId: 'i1_c', label: 'C', textLatex: 'Kilobyte (KB)' },
      { optionId: 'i1_d', label: 'D', textLatex: 'Pixel' },
    ],
    correctOptionId: 'i1_a',
    acceptedAnswers: ['bit'],
    answerLatex: 'Bit (\\(0\\) hoặc \\(1\\))',
    explanationLatex: 'Bit là đơn vị đo lượng thông tin nhỏ nhất, chỉ nhận một trong hai giá trị \\(0\\) hoặc \\(1\\); \\(1\\text{ Byte} = 8\\text{ bit}\\).',
    plainReadText: 'Trong máy tính, đơn vị nhỏ nhất để biểu diễn dữ liệu số là gì?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_02',
    type: 'single_choice',
    topic: 'Thiết bị máy tính',
    difficulty: 'Cơ bản',
    stemLatex: 'Nhóm nào sau đây chỉ gồm các thiết bị vào (Input)?',
    options: [
      { optionId: 'i2_a', label: 'A', textLatex: 'Màn hình, loa, máy in' },
      { optionId: 'i2_b', label: 'B', textLatex: 'Bàn phím, chuột, micro' },
      { optionId: 'i2_c', label: 'C', textLatex: 'Bàn phím, máy chiếu, tai nghe' },
      { optionId: 'i2_d', label: 'D', textLatex: 'Máy in, chuột, loa' },
    ],
    correctOptionId: 'i2_b',
    acceptedAnswers: ['bàn phím, chuột, micro'],
    answerLatex: 'Bàn phím, chuột, micro',
    explanationLatex: 'Bàn phím, chuột và micro thu nhận dữ liệu từ người dùng đưa vào máy tính; màn hình, loa, máy in là thiết bị ra.',
    plainReadText: 'Nhóm nào sau đây chỉ gồm các thiết bị vào?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_03',
    type: 'single_choice',
    topic: 'Tệp & Thư mục',
    difficulty: 'Cơ bản',
    stemLatex: 'Phần mở rộng nào thường dùng cho tệp hình ảnh?',
    options: [
      { optionId: 'i3_a', label: 'A', textLatex: '`.mp3`' },
      { optionId: 'i3_b', label: 'B', textLatex: '`.docx`' },
      { optionId: 'i3_c', label: 'C', textLatex: '`.png`' },
      { optionId: 'i3_d', label: 'D', textLatex: '`.xlsx`' },
    ],
    correctOptionId: 'i3_c',
    acceptedAnswers: ['.png', 'png'],
    answerLatex: '`.png`',
    explanationLatex: '`.png` là định dạng tệp hình ảnh phổ biến; `.mp3` là âm thanh, `.docx` là văn bản và `.xlsx` là bảng tính.',
    plainReadText: 'Phần mở rộng nào thường dùng cho tệp hình ảnh?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_04',
    type: 'true_false',
    topic: 'Tệp & Thư mục',
    difficulty: 'Cơ bản',
    stemLatex: 'Khẳng định sau đúng hay sai: “Trong cùng một thư mục trên máy tính, có thể lưu hai tệp có tên và phần mở rộng giống hệt nhau”.',
    options: [
      { optionId: 'i4_true', label: 'Đúng', textLatex: 'Đúng' },
      { optionId: 'i4_false', label: 'Sai', textLatex: 'Sai' },
    ],
    correctOptionId: 'i4_false',
    acceptedAnswers: ['sai'],
    answerLatex: 'Sai',
    explanationLatex: 'Trong cùng một thư mục, mỗi tệp phải có tên đầy đủ (gồm tên chính và phần mở rộng) duy nhất để hệ điều hành phân biệt.',
    plainReadText: 'Khẳng định sau đúng hay sai: Trong cùng một thư mục có thể lưu hai tệp có tên và phần mở rộng giống hệt nhau.',
    preserveOptionOrder: true,
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_05',
    type: 'single_choice',
    topic: 'Thuật toán',
    difficulty: 'Cơ bản',
    stemLatex: 'Trong sơ đồ khối mô tả thuật toán, hình thoi dùng để biểu diễn bước nào?',
    options: [
      { optionId: 'i5_a', label: 'A', textLatex: 'Bắt đầu hoặc kết thúc' },
      { optionId: 'i5_b', label: 'B', textLatex: 'Nhập hoặc xuất dữ liệu' },
      { optionId: 'i5_c', label: 'C', textLatex: 'Phép tính xử lý' },
      { optionId: 'i5_d', label: 'D', textLatex: 'Kiểm tra điều kiện rẽ nhánh' },
    ],
    correctOptionId: 'i5_d',
    acceptedAnswers: ['kiểm tra điều kiện', 'điều kiện'],
    answerLatex: 'Kiểm tra điều kiện rẽ nhánh',
    explanationLatex: 'Hình thoi biểu diễn thao tác kiểm tra điều kiện Đúng/Sai; hình chữ nhật là xử lý, hình bình hành là vào/ra, hình ô-van là bắt đầu/kết thúc.',
    plainReadText: 'Trong sơ đồ khối mô tả thuật toán, hình thoi dùng để biểu diễn bước nào?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_06',
    type: 'single_choice',
    topic: 'An toàn số',
    difficulty: 'Cơ bản',
    stemLatex: 'Khi nhận được liên kết lạ yêu cầu nhập mật khẩu tài khoản học tập để “nhận quà”, em nên làm gì?',
    options: [
      { optionId: 'i6_a', label: 'A', textLatex: 'Không bấm vào liên kết, không nhập mật khẩu và báo cho thầy cô hoặc phụ huynh' },
      { optionId: 'i6_b', label: 'B', textLatex: 'Nhập thử mật khẩu xem có nhận được quà không' },
      { optionId: 'i6_c', label: 'C', textLatex: 'Gửi tiếp liên kết đó cho cả lớp cùng kiểm tra' },
      { optionId: 'i6_d', label: 'D', textLatex: 'Chia sẻ tên đăng nhập lên nhóm công khai để hỏi' },
    ],
    correctOptionId: 'i6_a',
    acceptedAnswers: ['không bấm vào liên kết'],
    answerLatex: 'Không bấm vào liên kết, không nhập mật khẩu và báo cho thầy cô hoặc phụ huynh',
    explanationLatex: 'Đây là dấu hiệu lừa đảo chiếm đoạt tài khoản (phishing). Tuyệt đối không truy cập liên kết lạ hay cung cấp mật khẩu.',
    plainReadText: 'Khi nhận được liên kết lạ yêu cầu nhập mật khẩu tài khoản học tập để nhận quà, em nên làm gì?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_07',
    type: 'single_choice',
    topic: 'Thiết bị máy tính',
    difficulty: 'Vận dụng',
    stemLatex: 'Bộ phận nào giữ vai trò xử lý lệnh và điều phối hoạt động chính của máy tính?',
    options: [
      { optionId: 'i7_a', label: 'A', textLatex: 'Ổ cứng lưu trữ' },
      { optionId: 'i7_b', label: 'B', textLatex: 'Bộ xử lý trung tâm (CPU)' },
      { optionId: 'i7_c', label: 'C', textLatex: 'Loa ngoài' },
      { optionId: 'i7_d', label: 'D', textLatex: 'Cáp mạng' },
    ],
    correctOptionId: 'i7_b',
    acceptedAnswers: ['cpu', 'bộ xử lý trung tâm'],
    answerLatex: 'Bộ xử lý trung tâm (CPU)',
    explanationLatex: 'CPU (Central Processing Unit) thực hiện các phép toán số học, logic và điều khiển hoạt động của toàn hệ thống máy tính.',
    plainReadText: 'Bộ phận nào giữ vai trò xử lý lệnh và điều phối hoạt động chính của máy tính?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_08',
    type: 'short_answer',
    topic: 'Thông tin & Dữ liệu',
    difficulty: 'Vận dụng',
    stemLatex: 'Quy đổi dung lượng: \\(1\\text{ Byte}\\) gồm bao nhiêu \\(\\text{bit}\\)?',
    options: [],
    correctOptionId: null,
    acceptedAnswers: ['8', '8 bit', '8bit'],
    answerLatex: '\\(8\\text{ bit}\\)',
    explanationLatex: 'Theo quy ước chuẩn trong tin học, \\(1\\text{ Byte} = 8\\text{ bit}\\).',
    plainReadText: 'Quy đổi dung lượng: 1 Byte gồm bao nhiêu bit?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_09',
    type: 'single_choice',
    topic: 'Thuật toán',
    difficulty: 'Vận dụng',
    stemLatex: 'Cấu trúc điều khiển nào cho phép lặp lại một dãy lệnh nhiều lần cho đến khi thỏa điều kiện dừng?',
    options: [
      { optionId: 'i9_a', label: 'A', textLatex: 'Cấu trúc tuần tự' },
      { optionId: 'i9_b', label: 'B', textLatex: 'Cấu trúc khai báo' },
      { optionId: 'i9_c', label: 'C', textLatex: 'Cấu trúc lặp' },
      { optionId: 'i9_d', label: 'D', textLatex: 'Cấu trúc rẽ nhánh đơn' },
    ],
    correctOptionId: 'i9_c',
    acceptedAnswers: ['cấu trúc lặp', 'lặp'],
    answerLatex: 'Cấu trúc lặp',
    explanationLatex: 'Cấu trúc lặp (Loop) giúp thực hiện lặp lại các bước xử lý ngắn gọn, tránh viết trùng lặp nhiều lần.',
    plainReadText: 'Cấu trúc điều khiển nào cho phép lặp lại một dãy lệnh nhiều lần cho đến khi thỏa điều kiện dừng?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_10',
    type: 'single_choice',
    topic: 'An toàn số',
    difficulty: 'Vận dụng',
    stemLatex: 'Đặc điểm nào giúp một mật khẩu có độ an toàn cao hơn?',
    options: [
      { optionId: 'i10_a', label: 'A', textLatex: 'Chỉ dùng ngày sinh của bản thân để dễ nhớ' },
      { optionId: 'i10_b', label: 'B', textLatex: 'Đặt ngắn gọn `123456` cho mọi tài khoản' },
      { optionId: 'i10_c', label: 'C', textLatex: 'Dùng chính tên đăng nhập làm mật khẩu' },
      { optionId: 'i10_d', label: 'D', textLatex: 'Đủ dài, kết hợp chữ hoa, chữ thường, chữ số và kí tự đặc biệt' },
    ],
    correctOptionId: 'i10_d',
    acceptedAnswers: ['đủ dài, kết hợp chữ hoa, chữ thường, chữ số và kí tự đặc biệt'],
    answerLatex: 'Đủ dài, kết hợp chữ hoa, chữ thường, chữ số và kí tự đặc biệt',
    explanationLatex: 'Mật khẩu mạnh cần tối thiểu 8–12 kí tự, kết hợp nhiều loại kí tự, không chứa thông tin cá nhân dễ đoán và không dùng chung cho nhiều dịch vụ.',
    plainReadText: 'Đặc điểm nào giúp một mật khẩu có độ an toàn cao hơn?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
];

export const D01_SAMPLE_INFO_TIEBREAKERS: DuelQuestionItem[] = [
  {
    questionId: 'd01_info_tb_01',
    type: 'single_choice',
    topic: 'Thuật toán (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Thuật toán tìm kiếm nhị phân yêu cầu danh sách dữ liệu đầu vào phải thỏa điều kiện gì?',
    options: [
      { optionId: 'itb1_a', label: 'A', textLatex: 'Đã được sắp xếp theo thứ tự' },
      { optionId: 'itb1_b', label: 'B', textLatex: 'Chỉ chứa số nguyên âm' },
      { optionId: 'itb1_c', label: 'C', textLatex: 'Có đúng 10 phần tử' },
      { optionId: 'itb1_d', label: 'D', textLatex: 'Không cần bất kỳ điều kiện nào' },
    ],
    correctOptionId: 'itb1_a',
    acceptedAnswers: ['đã được sắp xếp'],
    answerLatex: 'Đã được sắp xếp theo thứ tự',
    explanationLatex: 'Tìm kiếm nhị phân chia đôi phạm vi tìm kiếm dựa vào so sánh với phần tử giữa, nên danh sách bắt buộc phải được sắp xếp trước.',
    plainReadText: 'Câu phụ 1: Thuật toán tìm kiếm nhị phân yêu cầu danh sách đầu vào phải thỏa điều kiện gì?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_tb_02',
    type: 'single_choice',
    topic: 'Tệp & Thư mục (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Đường dẫn `D:\\HocTap\\Toan\\DeCuong.pdf` cho biết tệp `DeCuong.pdf` nằm trực tiếp trong thư mục nào?',
    options: [
      { optionId: 'itb2_a', label: 'A', textLatex: 'Ổ đĩa `D:`' },
      { optionId: 'itb2_b', label: 'B', textLatex: 'Thư mục `Toan`' },
      { optionId: 'itb2_c', label: 'C', textLatex: 'Thư mục `HocTap`' },
      { optionId: 'itb2_d', label: 'D', textLatex: 'Thư mục gốc' },
    ],
    correctOptionId: 'itb2_b',
    acceptedAnswers: ['toan', 'thư mục toan'],
    answerLatex: 'Thư mục `Toan`',
    explanationLatex: 'Trong đường dẫn thư mục, thư mục nằm liền trước tên tệp là thư mục chứa trực tiếp tệp đó (`Toan`).',
    plainReadText: 'Câu phụ 2: Theo đường dẫn D hai chấm gạch chéo HocTap gạch chéo Toan gạch chéo DeCuong chấm pdf, tệp nằm trực tiếp trong thư mục nào?',
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
  {
    questionId: 'd01_info_tb_03',
    type: 'true_false',
    topic: 'An toàn số (Câu phụ)',
    difficulty: 'Nâng cao',
    stemLatex: 'Khẳng định sau đúng hay sai: “Bật xác thực hai bước (2FA) giúp tăng bảo vệ ngay cả khi mật khẩu bị lộ”.',
    options: [
      { optionId: 'itb3_true', label: 'Đúng', textLatex: 'Đúng' },
      { optionId: 'itb3_false', label: 'Sai', textLatex: 'Sai' },
    ],
    correctOptionId: 'itb3_true',
    acceptedAnswers: ['đúng', 'dung'],
    answerLatex: 'Đúng',
    explanationLatex: 'Xác thực hai bước (2FA) yêu cầu thêm mã xác minh thứ hai, giúp ngăn truy cập trái phép ngay cả khi kẻ xấu biết mật khẩu.',
    plainReadText: 'Câu phụ 3: Khẳng định sau đúng hay sai: Bật xác thực hai bước giúp tăng bảo vệ ngay cả khi mật khẩu bị lộ.',
    preserveOptionOrder: true,
    isSample: true,
    sourceBadge: D01_SAMPLE_BADGE,
  },
];

// ============================================================================
// VALIDATION, NORMALIZATION, SHUFFLE & SMART EDU RBAC BANK ADAPTER
// ============================================================================

export function normalizeDuelText(raw: string): string {
  return (raw || '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function matchDeclaredShortAnswer(input: string, acceptedAnswers: string[]): boolean {
  const norm = normalizeDuelText(input);
  if (!norm || !Array.isArray(acceptedAnswers) || acceptedAnswers.length === 0) return false;
  return acceptedAnswers.some((ans) => normalizeDuelText(ans) === norm);
}

export function validateDuelQuestion(q: DuelQuestionItem): { valid: boolean; reason?: string } {
  if (!q || !q.questionId || !q.questionId.trim()) {
    return { valid: false, reason: 'Thiếu questionId.' };
  }
  if (!q.stemLatex || !q.stemLatex.trim()) {
    return { valid: false, reason: 'Nội dung câu hỏi rỗng.' };
  }
  if (q.type === 'single_choice' || q.type === 'true_false') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { valid: false, reason: 'Câu trắc nghiệm cần ít nhất 2 phương án.' };
    }
    const idSet = new Set<string>();
    for (const opt of q.options) {
      if (!opt.optionId || idSet.has(opt.optionId)) {
        return { valid: false, reason: 'Trùng hoặc thiếu optionId.' };
      }
      idSet.add(opt.optionId);
    }
    if (!q.correctOptionId || !idSet.has(q.correctOptionId)) {
      return { valid: false, reason: 'Đáp án đúng không khớp optionId hợp lệ.' };
    }
  }
  return { valid: true };
}

function deterministicHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * Shuffles options ONCE while keeping `correctOptionId` bound strictly to `optionId` (never array index!).
 * Preserves order when `preserveOptionOrder` is true or for true/false or positional phrases ("Cả A và B").
 */
export function prepareQuestionOptionsOnce(
  q: DuelQuestionItem,
  seedKey: string
): DuelQuestionItem {
  if (
    q.type !== 'single_choice' ||
    q.preserveOptionOrder ||
    q.options.length <= 1
  ) {
    return q;
  }

  // Detect positional reference phrases so we never break "Cả A và B đều đúng"
  const positionalPattern = /(cả\s+[a-d]\s+và\s+[a-d]|tất cả các đáp án|phương án\s+[a-d])/i;
  if (q.options.some((o) => positionalPattern.test(o.textLatex))) {
    return q;
  }

  const copy = q.options.map((o) => ({ ...o }));
  let rng = deterministicHash(`${seedKey}:${q.questionId}`) || 1337;
  for (let i = copy.length - 1; i > 0; i--) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const j = rng % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }

  const relabeled = copy.map((opt, idx) => ({
    ...opt,
    label: OPTION_LETTERS[idx] || String(idx + 1),
  }));

  return {
    ...q,
    options: relabeled,
  };
}

export function adaptBankQuestionsForD01(
  bankQuestions: Question[],
  userRole: UserRole
): DuelQuestionItem[] {
  if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) return [];
  const seen = new Set<string>();
  const adapted: DuelQuestionItem[] = [];

  for (const q of bankQuestions) {
    if (!q || !q.id || seen.has(q.id)) continue;
    if (q.status === 'deprecated') continue;
    if (userRole === 'student' && q.status !== 'approved') continue;
    const stem = (q.stem || '').trim();
    if (!stem) continue;

    const topic = (q.chapter || q.lesson || 'Ngân hàng Smart EDU').trim();
    const explanation = (q.explanation || 'Giáo viên hướng dẫn lời giải chi tiết trên lớp.').trim();
    const diff: DuelQuestionItem['difficulty'] =
      q.level === 'apply' ? 'Nâng cao' : q.level === 'understand' ? 'Vận dụng' : 'Cơ bản';

    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const seenOptIds = new Set<string>();
      const opts: DuelQuestionOption[] = [];
      q.options.slice(0, 4).forEach((opt, idx) => {
        const oid = (opt.id || `${q.id}_opt_${idx}`).trim();
        if (!seenOptIds.has(oid)) {
          seenOptIds.add(oid);
          opts.push({
            optionId: oid,
            label: opt.label || OPTION_LETTERS[idx] || String(idx + 1),
            textLatex: opt.text || '',
          });
        }
      });
      // Reject ambiguous single-choice if multiple options match correctAnswer
      const matched = opts.filter(
        (o) => o.optionId === q.correctAnswer || o.label === q.correctAnswer
      );
      if (matched.length !== 1) continue;

      const candidate: DuelQuestionItem = {
        questionId: q.id,
        type: 'single_choice',
        topic,
        difficulty: diff,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: opts,
        correctOptionId: matched[0].optionId,
        acceptedAnswers: [matched[0].textLatex],
        answerLatex: `${matched[0].label}. ${matched[0].textLatex}`,
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateDuelQuestion(candidate).valid) {
        seen.add(q.id);
        adapted.push(candidate);
      }
    } else if (q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false_group') {
      const accepted =
        q.type === 'short_answer' && Array.isArray(q.acceptedAnswers)
          ? q.acceptedAnswers.filter((s) => typeof s === 'string' && s.trim().length > 0)
          : [];
      const answerStr =
        accepted.length > 0
          ? accepted[0]
          : q.type === 'true_false_group' && Array.isArray(q.subItems)
            ? q.subItems.map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`).join(' · ')
            : q.sampleAnswer || 'Xem lời giải chi tiết';
      const candidate: DuelQuestionItem = {
        questionId: q.id,
        type: 'short_answer',
        topic,
        difficulty: diff,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: [],
        correctOptionId: null,
        acceptedAnswers: q.type === 'short_answer' ? accepted : [], // Never auto-grade essays!
        answerLatex: answerStr,
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateDuelQuestion(candidate).valid) {
        seen.add(q.id);
        adapted.push(candidate);
      }
    }
  }

  return adapted;
}

// ============================================================================
// CONTESTANT VALIDATION & SCOREBOARD COMPUTATION (Single Source of Truth!)
// ============================================================================

export function validateContestants(
  playStyle: DuelPlayStyle,
  sideA: DuelContestant,
  sideB: DuelContestant
): { valid: boolean; error: string | null } {
  if (!sideA.label.trim()) {
    return { valid: false, error: 'Vui lòng nhập tên hoặc chọn học sinh cho Bên A.' };
  }
  if (playStyle === 'duel_2_sides') {
    if (!sideB.label.trim()) {
      return { valid: false, error: 'Vui lòng nhập tên hoặc chọn học sinh cho Bên B.' };
    }
    if (sideA.studentId && sideB.studentId && sideA.studentId === sideB.studentId) {
      return {
        valid: false,
        error: 'Hai bên không thể chọn cùng một học sinh (trùng mã học sinh). Vui lòng chọn hai học sinh khác nhau.',
      };
    }
  }
  return { valid: true, error: null };
}

export function getActiveSides(playStyle: DuelPlayStyle): DuelSideId[] {
  return playStyle === 'solo_single' ? ['A'] : ['A', 'B'];
}

export function getActiveDeck(state: DuelGameState): DuelQuestionItem[] {
  return state.inTieBreaker ? state.tieBreakerDeck : state.mainDeck;
}

export function getCurrentQuestion(state: DuelGameState): DuelQuestionItem | null {
  const deck = getActiveDeck(state);
  return deck[state.currentQuestionIndex] || null;
}

/**
 * Pure scoreboard computed strictly from `history` (zero score drift; tie-breaker separated from main score).
 */
export function computeDuelScoreboard(state: DuelGameState): DuelScoreboard {
  let mainScoreA = 0;
  let mainScoreB = 0;
  let tieBreakerScoreA = 0;
  let tieBreakerScoreB = 0;
  let mainPlayedCount = 0;
  let tieBreakerPlayedCount = 0;

  const statsA = { correct: 0, wrong: 0, noAnswer: 0 };
  const statsB = { correct: 0, wrong: 0, noAnswer: 0 };

  for (const rec of state.history) {
    if (rec.isTieBreaker) {
      tieBreakerPlayedCount += 1;
      tieBreakerScoreA += rec.outcomes.A.pointsAwarded;
      tieBreakerScoreB += rec.outcomes.B.pointsAwarded;
    } else {
      mainPlayedCount += 1;
      mainScoreA += rec.outcomes.A.pointsAwarded;
      mainScoreB += rec.outcomes.B.pointsAwarded;
    }

    if (rec.outcomes.A.mark === 'correct') statsA.correct += 1;
    else if (rec.outcomes.A.mark === 'wrong') statsA.wrong += 1;
    else if (rec.outcomes.A.mark === 'no_answer') statsA.noAnswer += 1;

    if (state.config.playStyle !== 'solo_single') {
      if (rec.outcomes.B.mark === 'correct') statsB.correct += 1;
      else if (rec.outcomes.B.mark === 'wrong') statsB.wrong += 1;
      else if (rec.outcomes.B.mark === 'no_answer') statsB.noAnswer += 1;
    }
  }

  if (state.phase !== 'summary') {
    return {
      mainScoreA,
      mainScoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      mainPlayedCount,
      tieBreakerPlayedCount,
      statsA,
      statsB,
      outcome: 'in_progress',
      outcomeLabel: 'Đang diễn ra',
    };
  }

  if (state.config.playStyle === 'solo_single') {
    return {
      mainScoreA,
      mainScoreB: 0,
      tieBreakerScoreA: 0,
      tieBreakerScoreB: 0,
      mainPlayedCount,
      tieBreakerPlayedCount: 0,
      statsA,
      statsB,
      outcome: 'solo_complete',
      outcomeLabel: state.endedEarly
        ? `Trận kết thúc sớm (${mainPlayedCount}/${state.mainDeck.length} câu)`
        : 'Hoàn thành tự luyện',
    };
  }

  const labelA = state.config.sideA.label;
  const labelB =
    state.config.playStyle === 'solo_two_turns' ? 'Lượt 2 (Tự luyện)' : state.config.sideB.label;

  if (mainScoreA > mainScoreB) {
    return {
      mainScoreA,
      mainScoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      mainPlayedCount,
      tieBreakerPlayedCount,
      statsA,
      statsB,
      outcome: 'A_wins',
      outcomeLabel: state.endedEarly
        ? `Trận kết thúc sớm — ${labelA} dẫn điểm`
        : `${labelA} chiến thắng`,
    };
  }
  if (mainScoreB > mainScoreA) {
    return {
      mainScoreA,
      mainScoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      mainPlayedCount,
      tieBreakerPlayedCount,
      statsA,
      statsB,
      outcome: 'B_wins',
      outcomeLabel: state.endedEarly
        ? `Trận kết thúc sớm — ${labelB} dẫn điểm`
        : `${labelB} chiến thắng`,
    };
  }

  // Main scores tied -> check tie-breaker
  if (tieBreakerScoreA > tieBreakerScoreB) {
    return {
      mainScoreA,
      mainScoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      mainPlayedCount,
      tieBreakerPlayedCount,
      statsA,
      statsB,
      outcome: 'A_wins_tiebreaker',
      outcomeLabel: `${labelA} chiến thắng bằng câu phụ`,
    };
  }
  if (tieBreakerScoreB > tieBreakerScoreA) {
    return {
      mainScoreA,
      mainScoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      mainPlayedCount,
      tieBreakerPlayedCount,
      statsA,
      statsB,
      outcome: 'B_wins_tiebreaker',
      outcomeLabel: `${labelB} chiến thắng bằng câu phụ`,
    };
  }

  return {
    mainScoreA,
    mainScoreB,
    tieBreakerScoreA,
    tieBreakerScoreB,
    mainPlayedCount,
    tieBreakerPlayedCount,
    statsA,
    statsB,
    outcome: 'tie',
    outcomeLabel: state.endedEarly
      ? `Trận kết thúc sớm — Đồng hạng`
      : tieBreakerPlayedCount > 0
        ? 'Đồng thắng sau câu phụ'
        : 'Đồng hạng',
  };
}

// ============================================================================
// MATCH CREATION & STATE TRANSITIONS
// ============================================================================

function makeEmptyMarks(): Record<DuelSideId, DuelMark> {
  return { A: 'unmarked', B: 'unmarked' };
}

function makeEmptyOpts(): Record<DuelSideId, string | null> {
  return { A: null, B: null };
}

function makeEmptyTexts(): Record<DuelSideId, string> {
  return { A: '', B: '' };
}

function makeTurnToken(matchId: string, inTieBreaker: boolean, idx: number, qId: string): string {
  return `${matchId}:${inTieBreaker ? 'tb' : 'main'}:${idx}:${qId}`;
}

export function createDefaultDuelConfig(overrides?: Partial<DuelMatchConfig>): DuelMatchConfig {
  const playStyle = overrides?.playStyle ?? 'duel_2_sides';
  const sideA: DuelContestant = {
    ...D01_SAMPLE_PLAYER_PRESETS.sideA,
    ...(overrides?.sideA || {}),
    side: 'A',
    colorHex: '#2563EB',
    colorNameVi: 'Xanh dương',
  };
  const sideB: DuelContestant = {
    ...D01_SAMPLE_PLAYER_PRESETS.sideB,
    ...(overrides?.sideB || {}),
    side: 'B',
    colorHex: '#F59E0B',
    colorNameVi: 'Cam vàng',
  };

  if (playStyle === 'solo_two_turns') {
    sideB.studentId = null;
    sideB.label = 'Lượt 2 (Tự luyện)';
    sideB.isTempLabel = true;
  }

  return {
    playStyle,
    answerMode: playStyle === 'duel_2_sides' ? overrides?.answerMode ?? 'simultaneous' : 'simultaneous',
    buzzerSource: overrides?.buzzerSource ?? 'teacher_manual',
    questionSource: overrides?.questionSource ?? 'sample_math',
    requestedMainCount: overrides?.requestedMainCount ?? 10,
    timerSeconds: overrides?.timerSeconds ?? 30,
    buzzerAnswerSeconds: overrides?.buzzerAnswerSeconds ?? 15,
    pointsPerQuestion: Math.max(1, Math.round(overrides?.pointsPerQuestion ?? 10)),
    tieBreakerEnabled:
      playStyle === 'solo_single' ? false : overrides?.tieBreakerEnabled ?? false,
    maxTieBreakers: Math.max(1, Math.min(3, Math.round(overrides?.maxTieBreakers ?? 3))),
    sideA,
    sideB,
  };
}

export function createDuelSetupState(
  overrides?: Partial<DuelMatchConfig>,
  completedMatches: DuelCompletedMatchSummary[] = []
): DuelGameState {
  const config = createDefaultDuelConfig(overrides);
  const matchId = `d01_${Date.now()}`;
  return {
    matchId,
    config,
    phase: 'setup',
    mainDeck: [],
    tieBreakerDeck: [],
    currentQuestionIndex: 0,
    inTieBreaker: false,
    turnToken: '',
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    timedOutCurrentTurn: false,
    draftMarks: makeEmptyMarks(),
    draftOptionIds: makeEmptyOpts(),
    draftTextAnswers: makeEmptyTexts(),
    bothSidesLockedConfirmed: false,
    activeBuzzerSide: null,
    buzzerAttemptsUsed: { A: false, B: false },
    buzzerTransferredTo: null,
    lastClaimTimestampMs: null,
    lastClaimSide: null,
    nearTiePending: false,
    buzzerResultLocked: false,
    lastConfirmedTurnToken: null,
    editingLastConfirmed: false,
    endedEarly: false,
    history: [],
    completedMatches,
    statusMessage: null,
  };
}

/**
 * Starts a match cleanly:
 * - Validates contestant uniqueness (cannot select same studentId on both sides)
 * - Validates question count without repeating questions (main & tie-breaker strictly disjoint)
 * - Shuffles options ONCE per matchId (preserving optionId binding!)
 */
export function startDuelMatch(
  configInput: Partial<DuelMatchConfig>,
  mainPool: DuelQuestionItem[],
  tieBreakerPool: DuelQuestionItem[] = [],
  existingCompletedMatches: DuelCompletedMatchSummary[] = [],
  matchIdOverride?: string
): { state: DuelGameState; error: string | null } {
  const config = createDefaultDuelConfig(configInput);
  const cCheck = validateContestants(config.playStyle, config.sideA, config.sideB);
  if (!cCheck.valid) {
    return {
      state: createDuelSetupState(config, existingCompletedMatches),
      error: cCheck.error,
    };
  }

  // Deduplicate & validate main pool
  const validMain: DuelQuestionItem[] = [];
  const seenIds = new Set<string>();
  for (const q of mainPool) {
    if (seenIds.has(q.questionId)) continue;
    if (!validateDuelQuestion(q).valid) continue;
    seenIds.add(q.questionId);
    validMain.push(q);
  }

  if (validMain.length === 0) {
    return {
      state: createDuelSetupState(config, existingCompletedMatches),
      error: 'Bộ câu hỏi hiện tại chưa có câu hợp lệ. Vui lòng chọn bộ khác hoặc dùng bộ Dữ liệu mẫu.',
    };
  }

  if (validMain.length < config.requestedMainCount) {
    return {
      state: createDuelSetupState(config, existingCompletedMatches),
      error: `Bộ câu hỏi chỉ có ${validMain.length} câu hợp lệ (ít hơn ${config.requestedMainCount} câu đã chọn). Vui lòng giảm số câu chính hoặc đổi bộ câu hỏi — hệ thống không lặp lại câu.`,
    };
  }

  const matchId = matchIdOverride || `d01_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const chosenMain = validMain
    .slice(0, config.requestedMainCount)
    .map((q) => prepareQuestionOptionsOnce(q, matchId));
  const mainIdSet = new Set(chosenMain.map((q) => q.questionId));

  // Build strictly disjoint tie-breaker deck (remaining from mainPool + tieBreakerPool, NEVER repeating main!)
  const combinedTbCandidates = [...tieBreakerPool, ...validMain.slice(config.requestedMainCount)];
  const tbDeck: DuelQuestionItem[] = [];
  const tbSeen = new Set<string>(mainIdSet);
  for (const q of combinedTbCandidates) {
    if (tbDeck.length >= config.maxTieBreakers) break;
    if (tbSeen.has(q.questionId)) continue;
    if (!validateDuelQuestion(q).valid) continue;
    tbSeen.add(q.questionId);
    tbDeck.push(prepareQuestionOptionsOnce(q, `${matchId}_tb`));
  }

  const firstToken = makeTurnToken(matchId, false, 0, chosenMain[0].questionId);

  return {
    error: null,
    state: {
      matchId,
      config,
      phase: 'ready',
      mainDeck: chosenMain,
      tieBreakerDeck: tbDeck,
      currentQuestionIndex: 0,
      inTieBreaker: false,
      turnToken: firstToken,
      deadlineMs: null,
      pausedRemainingMs: null,
      isPaused: false,
      timedOutCurrentTurn: false,
      draftMarks: makeEmptyMarks(),
      draftOptionIds: makeEmptyOpts(),
      draftTextAnswers: makeEmptyTexts(),
      bothSidesLockedConfirmed: false,
      activeBuzzerSide: null,
      buzzerAttemptsUsed: { A: false, B: false },
      buzzerTransferredTo: null,
      lastClaimTimestampMs: null,
      lastClaimSide: null,
      nearTiePending: false,
      buzzerResultLocked: false,
      lastConfirmedTurnToken: null,
      editingLastConfirmed: false,
      endedEarly: false,
      history: [],
      completedMatches: existingCompletedMatches,
      statusMessage: 'Sẵn sàng vào câu 1. Bấm “Mở câu hỏi” để bắt đầu tính giờ.',
    },
  };
}

/**
 * Opens the current question from `ready` phase:
 * - Simultaneous (or Tie-Breaker, which is ALWAYS simultaneous!): enters `answering` with deadlineMs.
 * - Buzzer (main round only): enters `buzzer_open` waiting for claim.
 */
export function openDuelQuestion(state: DuelGameState, nowMs: number = Date.now()): DuelGameState {
  if (state.phase !== 'ready') return state;
  const q = getCurrentQuestion(state);
  if (!q) return state;

  const effectiveSimultaneous =
    state.inTieBreaker ||
    state.config.answerMode === 'simultaneous' ||
    state.config.playStyle !== 'duel_2_sides';

  const deadlineMs =
    effectiveSimultaneous && state.config.timerSeconds > 0
      ? nowMs + state.config.timerSeconds * 1000
      : null;

  return {
    ...state,
    phase: effectiveSimultaneous ? 'answering' : 'buzzer_open',
    deadlineMs,
    pausedRemainingMs: null,
    isPaused: false,
    timedOutCurrentTurn: false,
    draftMarks: makeEmptyMarks(),
    draftOptionIds: makeEmptyOpts(),
    draftTextAnswers: makeEmptyTexts(),
    bothSidesLockedConfirmed: false,
    activeBuzzerSide: null,
    buzzerAttemptsUsed: { A: false, B: false },
    buzzerTransferredTo: null,
    lastClaimTimestampMs: null,
    lastClaimSide: null,
    nearTiePending: false,
    buzzerResultLocked: false,
    statusMessage: effectiveSimultaneous
      ? state.inTieBreaker
        ? 'Câu phụ (Đối đáp đồng thời): hai bên ghi đáp án độc lập.'
        : 'Hai bên suy nghĩ và viết đáp án vào bảng con.'
      : 'Đang mở nhận quyền trả lời. Giáo viên ghi nhận hoặc bấm phím để chốt bên được quyền.',
  };
}

// ============================================================================
// SINGLE DEADLINE-BASED CLOCK & PAUSE/RESUME
// ============================================================================

export function getRemainingTimeMs(state: DuelGameState, nowMs: number = Date.now()): number {
  if (state.isPaused) {
    return Math.max(0, state.pausedRemainingMs ?? 0);
  }
  if (state.deadlineMs === null) return 0;
  return Math.max(0, state.deadlineMs - nowMs);
}

export function pauseDuelMatch(state: DuelGameState, nowMs: number = Date.now()): DuelGameState {
  if (
    state.isPaused ||
    state.phase === 'setup' ||
    state.phase === 'summary' ||
    state.phase === 'ready'
  ) {
    return state;
  }
  const rem = state.deadlineMs !== null ? Math.max(0, state.deadlineMs - nowMs) : null;
  return {
    ...state,
    isPaused: true,
    pausedRemainingMs: rem,
    deadlineMs: null,
    statusMessage: 'Trận đấu đang tạm dừng — đã ẩn câu hỏi và khóa mọi thao tác.',
  };
}

export function resumeDuelMatch(state: DuelGameState, nowMs: number = Date.now()): DuelGameState {
  if (!state.isPaused) return state;
  const nextDeadline =
    state.pausedRemainingMs !== null ? nowMs + Math.max(0, state.pausedRemainingMs) : null;
  return {
    ...state,
    isPaused: false,
    deadlineMs: nextDeadline,
    pausedRemainingMs: null,
    statusMessage: 'Đã tiếp tục trận đấu.',
  };
}

/**
 * Checks deadline expiration cleanly.
 * - Simultaneous mode: transitions `answering -> locked` with `timedOutCurrentTurn: true`
 *   (teacher STILL enters answers written on mini-boards before the deadline — never auto-marks wrong!).
 * - Buzzer mode: responder's time expired -> treats as `no_answer` for active responder & transfers right if eligible!
 */
export function checkDuelDeadline(
  state: DuelGameState,
  nowMs: number = Date.now()
): { state: DuelGameState; expired: boolean } {
  if (state.isPaused || state.phase !== 'answering' || state.deadlineMs === null) {
    return { state, expired: false };
  }
  if (nowMs < state.deadlineMs) {
    return { state, expired: false };
  }

  const effectiveSimultaneous =
    state.inTieBreaker ||
    state.config.answerMode === 'simultaneous' ||
    state.config.playStyle !== 'duel_2_sides';

  if (effectiveSimultaneous) {
    return {
      expired: true,
      state: {
        ...state,
        phase: 'locked',
        deadlineMs: null,
        timedOutCurrentTurn: true,
        statusMessage:
          'Hết giờ — Dừng trả lời! Giáo viên xác nhận hai bên đã chốt rồi nhập kết quả (không tự đánh sai).',
      },
    };
  }

  // Buzzer mode responder timed out!
  if (state.activeBuzzerSide) {
    const res = resolveBuzzerAttempt(state, 'no_answer', null, state.turnToken, nowMs);
    return { expired: true, state: { ...res.state, timedOutCurrentTurn: true } };
  }

  return { state, expired: false };
}

// ============================================================================
// SIMULTANEOUS MODE FLOW ("ĐỐI ĐÁP ĐỒNG THỜI")
// ============================================================================

/**
 * Teacher stops answering phase (before or at deadline).
 * Idempotent: if timer already expired and moved to `locked`, calling this again creates NO duplicate outcome.
 */
export function lockSimultaneousAnswers(
  state: DuelGameState,
  nowMs: number = Date.now()
): { state: DuelGameState; lockedNow: boolean } {
  if (state.isPaused) return { state, lockedNow: false };
  if (state.phase === 'locked') {
    // Already locked (e.g. simultaneous click + timeout race) -> single consistent state!
    return {
      lockedNow: false,
      state: {
        ...state,
        bothSidesLockedConfirmed: true,
      },
    };
  }
  if (state.phase !== 'answering') return { state, lockedNow: false };
  const timedOut = state.deadlineMs !== null && nowMs >= state.deadlineMs;
  return {
    lockedNow: true,
    state: {
      ...state,
      phase: 'locked',
      deadlineMs: null,
      timedOutCurrentTurn: timedOut,
      bothSidesLockedConfirmed: true,
      statusMessage:
        'Đã dừng trả lời. Giáo viên nhập kết quả của cả hai bên rồi bấm “Công bố và chấm”.',
    },
  };
}

export function confirmBothSidesLocked(state: DuelGameState): DuelGameState {
  if (state.isPaused || state.phase !== 'locked') return state;
  return {
    ...state,
    bothSidesLockedConfirmed: true,
    statusMessage: 'Đã xác nhận hai bên chốt đáp án. Hãy chấm từng bên trước khi công bố.',
  };
}

export function setSideDraftMark(
  state: DuelGameState,
  side: DuelSideId,
  mark: DuelMark,
  optionId: string | null = null,
  textAnswer: string = ''
): DuelGameState {
  if (state.isPaused) return state;
  const editable =
    state.phase === 'locked' ||
    state.phase === 'scoring' ||
    (state.phase === 'confirmed' && state.editingLastConfirmed);
  if (!editable) return state;

  return {
    ...state,
    draftMarks: {
      ...state.draftMarks,
      [side]: mark,
    },
    draftOptionIds: {
      ...state.draftOptionIds,
      [side]: optionId,
    },
    draftTextAnswers: {
      ...state.draftTextAnswers,
      [side]: textAnswer,
    },
  };
}

export function setSideDraftOption(
  state: DuelGameState,
  side: DuelSideId,
  optionId: string
): DuelGameState {
  const q = getCurrentQuestion(state);
  if (!q) return state;
  const mark: DuelMark =
    q.correctOptionId && optionId === q.correctOptionId ? 'correct' : 'wrong';
  return setSideDraftMark(state, side, mark, optionId, '');
}

export function setSideDraftShortAnswer(
  state: DuelGameState,
  side: DuelSideId,
  textInput: string
): DuelGameState {
  const q = getCurrentQuestion(state);
  if (!q) return state;
  const clean = textInput;
  // Auto-suggest ONLY when declared acceptedAnswers exist; otherwise leave for teacher manual mark
  let nextMark: DuelMark = state.draftMarks[side];
  if (q.acceptedAnswers.length > 0 && clean.trim().length > 0) {
    nextMark = matchDeclaredShortAnswer(clean, q.acceptedAnswers) ? 'correct' : 'wrong';
  }
  return setSideDraftMark(state, side, nextMark, null, clean);
}

export function areRequiredSidesMarked(state: DuelGameState): boolean {
  const sides = getActiveSides(state.config.playStyle);
  return sides.every((s) => state.draftMarks[s] !== 'unmarked');
}

/**
 * Step 8 in Simultaneous Flow: Reveal official answer + explanation + point preview.
 * Strictly blocked if both sides haven't locked or any required side is still `unmarked`!
 * Guarantees Side B NEVER sees the answer after Side A alone is entered.
 */
export function revealAndPrepareScoring(state: DuelGameState): {
  state: DuelGameState;
  revealed: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, revealed: false, reason: 'Trận đang tạm dừng.' };
  }
  if (state.phase !== 'locked') {
    return { state, revealed: false, reason: 'Chưa ở bước chốt đáp án.' };
  }
  if (!state.bothSidesLockedConfirmed) {
    return {
      state,
      revealed: false,
      reason: 'Vui lòng xác nhận cả hai bên đã chốt đáp án trước khi công bố.',
    };
  }
  if (!areRequiredSidesMarked(state)) {
    return {
      state,
      revealed: false,
      reason: 'Còn bên chưa được chấm. Chưa chấm không bị tính sai — vui lòng chọn Đúng / Chưa đúng / Không trả lời.',
    };
  }

  return {
    revealed: true,
    state: {
      ...state,
      phase: 'scoring',
      statusMessage: 'Đã công bố đáp án chuẩn và điểm dự kiến. Bấm “Xác nhận kết quả” để cộng điểm.',
    },
  };
}

// ============================================================================
// BUZZER MODE FLOW ("GIÀNH QUYỀN TRẢ LỜI")
// ============================================================================

/**
 * Claims buzzer right for a side during `buzzer_open`.
 * - Rejects stale `turnToken` callbacks from earlier questions.
 * - Rejects double-clicks or a side that already failed this question.
 * - Detects near-simultaneous shared-keyboard presses within 180ms -> hands decision to teacher (NEVER random!).
 */
export function claimBuzzerRight(
  state: DuelGameState,
  side: DuelSideId,
  turnToken: string,
  nowMs: number = Date.now(),
  source: DuelBuzzerTriggerSource = state.config.buzzerSource
): { state: DuelGameState; accepted: boolean; nearTieTriggered: boolean } {
  if (state.isPaused || state.phase !== 'buzzer_open') {
    return { state, accepted: false, nearTieTriggered: false };
  }
  if (turnToken !== state.turnToken) {
    // Reject stale callback from previous question!
    return { state, accepted: false, nearTieTriggered: false };
  }
  if (state.buzzerResultLocked || state.buzzerAttemptsUsed[side]) {
    return { state, accepted: false, nearTieTriggered: false };
  }

  // Check near-simultaneous rival claim on shared keyboard BEFORE teacher starts response timer
  if (
    source === 'shared_keyboard' &&
    state.activeBuzzerSide !== null &&
    state.activeBuzzerSide !== side &&
    state.lastClaimTimestampMs !== null &&
    nowMs - state.lastClaimTimestampMs <= D01_NEAR_TIE_WINDOW_MS
  ) {
    return {
      accepted: true,
      nearTieTriggered: true,
      state: {
        ...state,
        nearTiePending: true,
        statusMessage:
          'Hai phím bấm đến gần như cùng lúc trên thiết bị chung! Giáo viên chọn bên được quyền hoặc chọn “Không phân định — hỏi lại”.',
      },
    };
  }

  // Already claimed by a side (not near-tie) -> ignore duplicate / late click
  if (state.activeBuzzerSide !== null) {
    return { state, accepted: false, nearTieTriggered: false };
  }

  const label = side === 'A' ? state.config.sideA.label : state.config.sideB.label;
  return {
    accepted: true,
    nearTieTriggered: false,
    state: {
      ...state,
      activeBuzzerSide: side,
      lastClaimSide: side,
      lastClaimTimestampMs: nowMs,
      nearTiePending: false,
      statusMessage: `${label} được ghi nhận quyền trả lời. Giáo viên có thể điều chỉnh trước khi bấm “Bắt đầu tính giờ trả lời”.`,
    },
  };
}

/**
 * Allows teacher to explicitly adjust or resolve buzzer owner BEFORE response timer begins.
 * Never silently swaps after answer is locked!
 */
export function teacherOverrideBuzzerSide(
  state: DuelGameState,
  side: DuelSideId | null
): DuelGameState {
  if (state.isPaused || state.phase !== 'buzzer_open' || state.buzzerResultLocked) {
    return state;
  }
  if (side !== null && state.buzzerAttemptsUsed[side]) {
    return state;
  }
  return {
    ...state,
    activeBuzzerSide: side,
    nearTiePending: false,
    lastClaimTimestampMs: null,
    statusMessage: side
      ? `Giáo viên đã chốt quyền trả lời cho ${side === 'A' ? state.config.sideA.label : state.config.sideB.label}.`
      : 'Không phân định — mở lại nhận quyền trả lời cho cả hai bên.',
  };
}

/**
 * Starts dedicated response countdown for the side currently holding buzzer rights.
 */
export function startBuzzerResponsePhase(
  state: DuelGameState,
  nowMs: number = Date.now()
): DuelGameState {
  if (
    state.isPaused ||
    state.phase !== 'buzzer_open' ||
    !state.activeBuzzerSide ||
    state.nearTiePending
  ) {
    return state;
  }
  const sec = state.config.buzzerAnswerSeconds;
  return {
    ...state,
    phase: 'answering',
    deadlineMs: sec > 0 ? nowMs + sec * 1000 : null,
    timedOutCurrentTurn: false,
    statusMessage: `${state.activeBuzzerSide === 'A' ? state.config.sideA.label : state.config.sideB.label} đang trả lời.`,
  };
}

/**
 * Teacher marks that NEITHER side claimed buzzer on this question -> reveal answer & 0 pts for both.
 */
export function skipBuzzerNoClaim(state: DuelGameState): DuelGameState {
  if (state.isPaused || state.phase !== 'buzzer_open') return state;
  return {
    ...state,
    phase: 'scoring',
    deadlineMs: null,
    buzzerResultLocked: true,
    draftMarks: { A: 'no_answer', B: 'no_answer' },
    statusMessage: 'Không bên nào giành quyền trả lời — công bố đáp án chuẩn (0 điểm cho cả hai bên).',
  };
}

/**
 * Resolves the active buzzer responder's attempt:
 * - Correct: locks answer, awards points to responder ONLY, moves to `scoring` (no transfer!).
 * - Wrong / No Answer:
 *   - NEVER awards points to opponent merely because responder failed!
 *   - If opponent has NOT attempted yet -> transfers opportunity to opponent (`phase: 'buzzer_open'`,
 *     with `activeBuzzerSide = opponent`, answer stays HIDDEN!).
 *   - If both sides have attempted -> moves to `scoring` with answer revealed and 0 points for both.
 */
export function resolveBuzzerAttempt(
  state: DuelGameState,
  mark: 'correct' | 'wrong' | 'no_answer',
  optionId: string | null = null,
  turnToken: string = state.turnToken,
  nowMs: number = Date.now()
): { state: DuelGameState; transferredTo: DuelSideId | null; resolvedToScoring: boolean } {
  if (state.isPaused || state.phase !== 'answering' || !state.activeBuzzerSide) {
    return { state, transferredTo: null, resolvedToScoring: false };
  }
  if (turnToken !== state.turnToken) {
    return { state, transferredTo: null, resolvedToScoring: false };
  }

  const responder = state.activeBuzzerSide;
  const opponent: DuelSideId = responder === 'A' ? 'B' : 'A';
  const nextAttempts = {
    ...state.buzzerAttemptsUsed,
    [responder]: true,
  };
  const nextMarks: Record<DuelSideId, DuelMark> = {
    ...state.draftMarks,
    [responder]: mark,
  };
  const nextOpts: Record<DuelSideId, string | null> = {
    ...state.draftOptionIds,
    [responder]: optionId,
  };

  if (mark === 'correct') {
    if (nextMarks[opponent] === 'unmarked') {
      nextMarks[opponent] = 'no_answer';
    }
    return {
      transferredTo: null,
      resolvedToScoring: true,
      state: {
        ...state,
        phase: 'scoring',
        deadlineMs: null,
        buzzerAttemptsUsed: nextAttempts,
        buzzerResultLocked: true,
        draftMarks: nextMarks,
        draftOptionIds: nextOpts,
        statusMessage: `${responder === 'A' ? state.config.sideA.label : state.config.sideB.label} trả lời ĐÚNG! Xem đáp án chuẩn và xác nhận cộng điểm.`,
      },
    };
  }

  // Responder was wrong or timed out -> check if opponent gets their ONE transfer opportunity
  if (!nextAttempts[opponent]) {
    return {
      transferredTo: opponent,
      resolvedToScoring: false,
      state: {
        ...state,
        phase: 'buzzer_open',
        deadlineMs: null,
        activeBuzzerSide: opponent,
        buzzerAttemptsUsed: nextAttempts,
        buzzerTransferredTo: opponent,
        lastClaimSide: opponent,
        lastClaimTimestampMs: nowMs,
        nearTiePending: false,
        draftMarks: nextMarks,
        draftOptionIds: nextOpts,
        statusMessage: `${responder === 'A' ? state.config.sideA.label : state.config.sideB.label} chưa đúng (0đ) — chuyển quyền trả lời cho ${opponent === 'A' ? state.config.sideA.label : state.config.sideB.label}!`,
      },
    };
  }

  // Both sides missed/timed out -> reveal answer, 0 pts for both
  return {
    transferredTo: null,
    resolvedToScoring: true,
    state: {
      ...state,
      phase: 'scoring',
      deadlineMs: null,
      buzzerAttemptsUsed: nextAttempts,
      buzzerResultLocked: true,
      draftMarks: nextMarks,
      draftOptionIds: nextOpts,
      statusMessage: 'Cả hai bên đều chưa có đáp án đúng — công bố đáp án chuẩn và giải thích.',
    },
  };
}

// ============================================================================
// CONFIRM RESULT (ONCE!), EDIT JUST-CONFIRMED, ROLLBACK & ADVANCE
// ============================================================================

export function previewDuelRoundPoints(
  mark: DuelMark,
  pointsPerQuestion: number
): number {
  return mark === 'correct' ? pointsPerQuestion : 0;
}

/**
 * Confirms round result ONCE (anti-double-click idempotency + turnToken guard).
 * Also saves edits when `editingLastConfirmed === true` without double-counting!
 */
export function confirmDuelRoundResult(
  state: DuelGameState,
  turnToken: string = state.turnToken
): {
  state: DuelGameState;
  confirmed: boolean;
  anyCorrect: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, confirmed: false, anyCorrect: false, reason: 'Trận đang tạm dừng.' };
  }
  const isEditing = state.phase === 'confirmed' && state.editingLastConfirmed;
  if (state.phase !== 'scoring' && !isEditing) {
    return { state, confirmed: false, anyCorrect: false, reason: 'Chưa đến bước xác nhận kết quả.' };
  }
  if (turnToken !== state.turnToken) {
    return { state, confirmed: false, anyCorrect: false, reason: 'Lượt đã cũ (turnToken không khớp).' };
  }
  if (!isEditing && state.lastConfirmedTurnToken === state.turnToken) {
    return { state, confirmed: false, anyCorrect: false, reason: 'Câu này đã được xác nhận điểm.' };
  }
  if (!areRequiredSidesMarked(state)) {
    return {
      state,
      confirmed: false,
      anyCorrect: false,
      reason: 'Vui lòng chấm đầy đủ kết quả bắt buộc trước khi xác nhận.',
    };
  }

  const q = getCurrentQuestion(state);
  if (!q) {
    return { state, confirmed: false, anyCorrect: false, reason: 'Không tìm thấy câu hỏi hiện tại.' };
  }

  const ptsPerQ = state.config.pointsPerQuestion;
  const activeSides = getActiveSides(state.config.playStyle);

  const buildOutcome = (side: DuelSideId): DuelSideRoundOutcome => {
    if (!activeSides.includes(side)) {
      return {
        side,
        mark: 'no_answer',
        selectedOptionId: null,
        textAnswer: '',
        pointsAwarded: 0,
      };
    }
    const mark = state.draftMarks[side];
    return {
      side,
      mark,
      selectedOptionId: state.draftOptionIds[side],
      textAnswer: state.draftTextAnswers[side],
      pointsAwarded: previewDuelRoundPoints(mark, ptsPerQ),
    };
  };

  const outcomes: Record<DuelSideId, DuelSideRoundOutcome> = {
    A: buildOutcome('A'),
    B: buildOutcome('B'),
  };
  const anyCorrect = outcomes.A.mark === 'correct' || outcomes.B.mark === 'correct';

  if (isEditing) {
    const nextHistory = [...state.history];
    for (let i = nextHistory.length - 1; i >= 0; i--) {
      if (nextHistory[i].turnToken === state.turnToken) {
        nextHistory[i] = {
          ...nextHistory[i],
          outcomes,
          editCount: nextHistory[i].editCount + 1,
          confirmedAt: Date.now(),
        };
        break;
      }
    }
    return {
      confirmed: true,
      anyCorrect,
      state: {
        ...state,
        history: nextHistory,
        editingLastConfirmed: false,
        statusMessage: 'Đã sửa kết quả câu vừa rồi và tính lại tổng điểm từ lịch sử.',
      },
    };
  }

  const roundRecord: DuelRoundRecord = {
    roundIndex: state.currentQuestionIndex + 1,
    isTieBreaker: state.inTieBreaker,
    turnToken: state.turnToken,
    questionId: q.questionId,
    topic: q.topic,
    stemLatex: q.stemLatex,
    answerLatex: q.answerLatex,
    explanationLatex: q.explanationLatex,
    answerMode: state.inTieBreaker ? 'simultaneous' : state.config.answerMode,
    buzzerWinnerSide: state.inTieBreaker ? null : state.activeBuzzerSide,
    buzzerTransferredTo: state.inTieBreaker ? null : state.buzzerTransferredTo,
    outcomes,
    editCount: 0,
    confirmedAt: Date.now(),
  };

  return {
    confirmed: true,
    anyCorrect,
    state: {
      ...state,
      phase: 'confirmed',
      lastConfirmedTurnToken: state.turnToken,
      editingLastConfirmed: false,
      history: [...state.history, roundRecord],
      statusMessage: state.inTieBreaker
        ? `Đã xác nhận kết quả Câu phụ ${state.currentQuestionIndex + 1}.`
        : `Đã xác nhận kết quả Câu ${state.currentQuestionIndex + 1}/${state.mainDeck.length}.`,
    },
  };
}

export function startEditingLastConfirmedRound(state: DuelGameState): DuelGameState {
  if (state.isPaused || state.phase !== 'confirmed' || state.editingLastConfirmed) return state;
  const last = [...state.history].reverse().find((r) => r.turnToken === state.turnToken);
  if (!last) return state;

  return {
    ...state,
    editingLastConfirmed: true,
    draftMarks: { A: last.outcomes.A.mark, B: last.outcomes.B.mark },
    draftOptionIds: {
      A: last.outcomes.A.selectedOptionId,
      B: last.outcomes.B.selectedOptionId,
    },
    draftTextAnswers: {
      A: last.outcomes.A.textAnswer,
      B: last.outcomes.B.textAnswer,
    },
    statusMessage: 'Đang sửa kết quả câu vừa xác nhận (tổng điểm sẽ được tính lại từ lịch sử).',
  };
}

/**
 * Explicitly rolls back to a previous round index (discarding subsequent rounds ONLY on explicit confirmation).
 */
export function rollbackToPreviousRound(
  state: DuelGameState,
  explicitConfirm: boolean
): { state: DuelGameState; rolledBack: boolean } {
  if (!explicitConfirm || state.isPaused || state.history.length === 0) {
    return { state, rolledBack: false };
  }
  // Remove the latest confirmed record (or current question's progress) and re-open that round cleanly in `locked`
  const nextHistory = [...state.history];
  const popped = nextHistory.pop()!;
  return {
    rolledBack: true,
    state: {
      ...state,
      phase: 'locked',
      inTieBreaker: popped.isTieBreaker,
      currentQuestionIndex: popped.roundIndex - 1,
      turnToken: popped.turnToken,
      deadlineMs: null,
      pausedRemainingMs: null,
      isPaused: false,
      bothSidesLockedConfirmed: true,
      draftMarks: { A: popped.outcomes.A.mark, B: popped.outcomes.B.mark },
      draftOptionIds: {
        A: popped.outcomes.A.selectedOptionId,
        B: popped.outcomes.B.selectedOptionId,
      },
      draftTextAnswers: {
        A: popped.outcomes.A.textAnswer,
        B: popped.outcomes.B.textAnswer,
      },
      lastConfirmedTurnToken:
        nextHistory.length > 0 ? nextHistory[nextHistory.length - 1].turnToken : null,
      editingLastConfirmed: false,
      history: nextHistory,
      statusMessage: `Đã quay lại ${popped.isTieBreaker ? 'Câu phụ' : 'Câu'} ${popped.roundIndex} và hủy các lượt sau đó theo xác nhận của giáo viên.`,
    },
  };
}

function appendCompletedMatch(state: DuelGameState): DuelCompletedMatchSummary[] {
  const alreadySaved = state.completedMatches.some((m) => m.matchId === state.matchId);
  if (alreadySaved) return state.completedMatches;

  const sb = computeDuelScoreboard({ ...state, phase: 'summary' });
  const sourceLabel =
    state.config.questionSource === 'sample_math'
      ? 'Toán THCS — Song đấu tính toán (Dữ liệu mẫu)'
      : state.config.questionSource === 'sample_info'
        ? 'Tin học THCS — Song đấu thế giới số (Dữ liệu mẫu)'
        : 'Ngân hàng Smart EDU';

  const summary: DuelCompletedMatchSummary = {
    matchId: state.matchId,
    finishedAt: Date.now(),
    playStyle: state.config.playStyle,
    answerMode: state.config.answerMode,
    sourceLabel,
    sideALabel: state.config.sideA.label,
    sideBLabel:
      state.config.playStyle === 'solo_two_turns'
        ? 'Lượt 2 (Tự luyện)'
        : state.config.playStyle === 'solo_single'
          ? 'Tự luyện 1 người'
          : state.config.sideB.label,
    mainScoreA: sb.mainScoreA,
    mainScoreB: sb.mainScoreB,
    tieBreakerScoreA: sb.tieBreakerScoreA,
    tieBreakerScoreB: sb.tieBreakerScoreB,
    mainPlayedCount: sb.mainPlayedCount,
    tieBreakerPlayedCount: sb.tieBreakerPlayedCount,
    endedEarly: state.endedEarly,
    outcomeLabel: sb.outcomeLabel,
  };

  return [summary, ...state.completedMatches].slice(0, 30);
}

/**
 * Advances after a confirmed round:
 * - Main round remaining -> next main question (`ready`)
 * - Main round finished:
 *   - If tied AND tieBreakerEnabled AND tieBreakerDeck.length > 0 -> start Tie-Breaker 1 (`ready`)
 *   - Else -> `summary`
 * - Tie-Breaker round:
 *   - If ONLY ONE side answered correctly on this tie-breaker -> immediate tie-breaker victory (`summary`)!
 *   - If both right or both wrong -> next tie-breaker if within `maxTieBreakers` & deck available; else `summary` (Đồng thắng!).
 */
export function advanceDuelAfterConfirm(state: DuelGameState): DuelGameState {
  if (state.isPaused || state.phase !== 'confirmed' || state.editingLastConfirmed) return state;

  if (!state.inTieBreaker) {
    const nextIdx = state.currentQuestionIndex + 1;
    if (nextIdx < state.mainDeck.length) {
      const nextQ = state.mainDeck[nextIdx];
      return {
        ...state,
        phase: 'ready',
        currentQuestionIndex: nextIdx,
        turnToken: makeTurnToken(state.matchId, false, nextIdx, nextQ.questionId),
        deadlineMs: null,
        pausedRemainingMs: null,
        timedOutCurrentTurn: false,
        draftMarks: makeEmptyMarks(),
        draftOptionIds: makeEmptyOpts(),
        draftTextAnswers: makeEmptyTexts(),
        bothSidesLockedConfirmed: false,
        activeBuzzerSide: null,
        buzzerAttemptsUsed: { A: false, B: false },
        buzzerTransferredTo: null,
        lastClaimTimestampMs: null,
        lastClaimSide: null,
        nearTiePending: false,
        buzzerResultLocked: false,
        statusMessage: `Sẵn sàng Câu ${nextIdx + 1}/${state.mainDeck.length}.`,
      };
    }

    // Main round finished! Check if tie-breaker should trigger
    const sb = computeDuelScoreboard({ ...state, phase: 'summary' });
    const isTwoSideTie =
      state.config.playStyle !== 'solo_single' && sb.mainScoreA === sb.mainScoreB;
    if (
      isTwoSideTie &&
      state.config.tieBreakerEnabled &&
      state.tieBreakerDeck.length > 0
    ) {
      const tbQ = state.tieBreakerDeck[0];
      return {
        ...state,
        phase: 'ready',
        inTieBreaker: true,
        currentQuestionIndex: 0,
        turnToken: makeTurnToken(state.matchId, true, 0, tbQ.questionId),
        deadlineMs: null,
        pausedRemainingMs: null,
        timedOutCurrentTurn: false,
        draftMarks: makeEmptyMarks(),
        draftOptionIds: makeEmptyOpts(),
        draftTextAnswers: makeEmptyTexts(),
        bothSidesLockedConfirmed: false,
        activeBuzzerSide: null,
        buzzerAttemptsUsed: { A: false, B: false },
        buzzerTransferredTo: null,
        lastClaimTimestampMs: null,
        lastClaimSide: null,
        nearTiePending: false,
        buzzerResultLocked: false,
        statusMessage: `Hai bên đang hòa ${sb.mainScoreA}–${sb.mainScoreB}! Bước vào Câu phụ 1/${state.tieBreakerDeck.length} (Đối đáp đồng thời).`,
      };
    }

    // Finalize main match
    const finalState: DuelGameState = {
      ...state,
      phase: 'summary',
      deadlineMs: null,
      endedEarly: false,
      statusMessage: 'Trận đấu đã kết thúc! Xem tổng kết và ôn lại kiến thức.',
    };
    return {
      ...finalState,
      completedMatches: appendCompletedMatch(finalState),
    };
  }

  // Inside Tie-Breaker: inspect the just-confirmed tie-breaker round
  const lastTb = [...state.history].reverse().find((r) => r.isTieBreaker);
  const aRight = lastTb?.outcomes.A.mark === 'correct';
  const bRight = lastTb?.outcomes.B.mark === 'correct';
  const decidedNow = aRight !== bRight;
  const nextTbIdx = state.currentQuestionIndex + 1;
  const maxAllowed = Math.min(state.config.maxTieBreakers, state.tieBreakerDeck.length);

  if (decidedNow || nextTbIdx >= maxAllowed) {
    const finalState: DuelGameState = {
      ...state,
      phase: 'summary',
      deadlineMs: null,
      endedEarly: false,
      statusMessage: decidedNow
        ? 'Đã phân định thắng thua bằng câu phụ!'
        : 'Đã hết giới hạn câu phụ và hai bên vẫn hòa — ghi nhận Đồng thắng!',
    };
    return {
      ...finalState,
      completedMatches: appendCompletedMatch(finalState),
    };
  }

  const nextTbQ = state.tieBreakerDeck[nextTbIdx];
  return {
    ...state,
    phase: 'ready',
    currentQuestionIndex: nextTbIdx,
    turnToken: makeTurnToken(state.matchId, true, nextTbIdx, nextTbQ.questionId),
    deadlineMs: null,
    pausedRemainingMs: null,
    timedOutCurrentTurn: false,
    draftMarks: makeEmptyMarks(),
    draftOptionIds: makeEmptyOpts(),
    draftTextAnswers: makeEmptyTexts(),
    bothSidesLockedConfirmed: false,
    activeBuzzerSide: null,
    buzzerAttemptsUsed: { A: false, B: false },
    buzzerTransferredTo: null,
    lastClaimTimestampMs: null,
    lastClaimSide: null,
    nearTiePending: false,
    buzzerResultLocked: false,
    statusMessage: `Cả hai bên hòa câu phụ vừa rồi — tiếp tục Câu phụ ${nextTbIdx + 1}/${maxAllowed}.`,
  };
}

/**
 * Teacher actively ends the match early (unplayed questions are NEVER marked wrong!).
 */
export function endDuelMatchEarly(state: DuelGameState): DuelGameState {
  if (state.phase === 'setup' || state.phase === 'summary') return state;
  const finalState: DuelGameState = {
    ...state,
    phase: 'summary',
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    editingLastConfirmed: false,
    endedEarly: true,
    statusMessage: 'Trận kết thúc sớm theo quyết định của giáo viên.',
  };
  return {
    ...finalState,
    completedMatches: appendCompletedMatch(finalState),
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// ============================================================================

export interface DuelPersistedSession {
  version: number;
  savedAt: number;
  state: DuelGameState;
}

export function getD01StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D01_SESSION_STORAGE_KEY}`
    : D01_SESSION_STORAGE_KEY;
}

export function saveD01Session(state: DuelGameState, nowMs: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    // Snapshot remaining time cleanly if currently ticking so reload NEVER adds free time!
    const snapshotState: DuelGameState =
      state.phase === 'answering' && !state.isPaused && state.deadlineMs !== null
        ? {
            ...state,
            pausedRemainingMs: Math.max(0, state.deadlineMs - nowMs),
          }
        : state;

    const payload: DuelPersistedSession = {
      version: D01_SESSION_VERSION,
      savedAt: nowMs,
      state: snapshotState,
    };
    window.localStorage.setItem(getD01StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function loadD01Session(): DuelPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getD01StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DuelPersistedSession>;
    if (
      !parsed ||
      parsed.version !== D01_SESSION_VERSION ||
      !parsed.state ||
      !parsed.state.config ||
      !Array.isArray(parsed.state.mainDeck) ||
      !Array.isArray(parsed.state.history)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const s = parsed.state;
    // On restore mid-countdown: enter PAUSED state with preserved remaining ms so reload NEVER resets or adds time!
    const shouldRestorePaused =
      s.phase === 'answering' && (s.deadlineMs !== null || s.pausedRemainingMs !== null);
    const restoredRemaining = shouldRestorePaused
      ? Math.max(0, s.pausedRemainingMs ?? (s.deadlineMs ? Math.max(0, s.deadlineMs - Date.now()) : 0))
      : s.pausedRemainingMs;

    const restored: DuelGameState = {
      ...s,
      editingLastConfirmed: false,
      isPaused: shouldRestorePaused ? true : Boolean(s.isPaused),
      deadlineMs: shouldRestorePaused ? null : s.deadlineMs,
      pausedRemainingMs: restoredRemaining,
      completedMatches: Array.isArray(s.completedMatches) ? s.completedMatches : [],
    };

    return {
      version: D01_SESSION_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      state: restored,
    };
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearD01Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD01StorageKey());
  } catch {
    // Ignore
  }
}
