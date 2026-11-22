/**
 * D07 — THÁCH ĐẤU NHÓM 3D (Tây Đô Smart EDU)
 * Pure deterministic Round-Robin Tournament Engine:
 * - Modes: 'round_robin' (2–6 teams) & 'solo_practice' (1 student, zero fake opponents)
 * - Berger Circle Round-Robin scheduler:
 *   * Generated ONCE when tournament begins & locked for the entire tournament
 *   * Every pair meets EXACTLY ONCE; each team plays at most 1 match per round
 *   * Odd team counts (3 or 5): 1 bye team per round; across full tournament every team sits out EXACTLY 1 round
 *   * Bye team may practice on paper, never receives competition points or match count in that round
 * - Simultaneous round questions: all active pairs in a round solve the same `questionsPerMatch` (1, 3, or 5) questions
 *   * Never repeats questions across rounds; distributes topic & difficulty evenly across rounds
 *   * 6 teams × 5 rounds × 3 questions = 15 distinct questions (each team solves 15 questions)
 * - Match scoring & settlement (strictly recomputed from full question history):
 *   * Correct = +1 in current match; incorrect / no_answer = 0
 *   * End of round match comparison: Win = 3 pts, Draw = 1 pt each, Loss = 0 pts (awarded ONCE per match)
 *   * Edit last graded question (including last question of a round before next round) recomputes scores & points cleanly
 *   * Double-click idempotency via questionId guard
 * - Competition ranking strictly by tournamentPoints ("Đồng hạng" on ties), displaying W-D-L & totalCorrect separately
 * - Early termination marks "Giải chưa hoàn tất", shows matchesCompleted per team, and sets trophyAwarded = false
 * - 15-question sample pack "Thách đấu nhóm – Toán THCS" ("Dữ liệu mẫu") with all 5 mandatory prompt cases
 * - Smart EDU RBAC question bank adapter & demo-isolated session persistence
 */

import { Question, QuestionType, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type GroupChallengeMode = 'round_robin' | 'solo_practice';

export type GroupChallengeVerdict = 'ungraded' | 'correct' | 'incorrect' | 'no_answer';

export type GroupChallengeStatus = 'playing' | 'finished' | 'ended_early';

export type GroupChallengeSource = 'sample' | 'bank';

export interface ChallengeTeamPalette {
  id: string;
  label: string;
  hex: string;
  hexNum: number;
  accentHex: string;
  textOnSolid: string;
}

export const CHALLENGE_TEAM_PALETTES: ChallengeTeamPalette[] = [
  {
    id: 'emerald',
    label: 'Xanh ngọc',
    hex: '#0D9488',
    hexNum: 0x0d9488,
    accentHex: '#5EEAD4',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'gold',
    label: 'Vàng kim',
    hex: '#EAB308',
    hexNum: 0xeab308,
    accentHex: '#FEF08A',
    textOnSolid: '#071226',
  },
  {
    id: 'sky',
    label: 'Xanh dương',
    hex: '#2563EB',
    hexNum: 0x2563eb,
    accentHex: '#93C5FD',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'coral',
    label: 'Cam san hô',
    hex: '#EA580C',
    hexNum: 0xea580c,
    accentHex: '#FDBA74',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'violet',
    label: 'Tím chàm',
    hex: '#7C3AED',
    hexNum: 0x7c3aed,
    accentHex: '#C4B5FD',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'rose',
    label: 'Đỏ thẫm',
    hex: '#E11D48',
    hexNum: 0xe11d48,
    accentHex: '#FDA4AF',
    textOnSolid: '#FFFFFF',
  },
];

export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;

export const D07_SAMPLE_PACK_TITLE = 'Thách đấu nhóm – Toán THCS';
export const D07_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D07_SESSION_STORAGE_KEY = 'taydo_d07_group_challenge_session_v1';
export const D07_SESSION_VERSION = 1;

export interface ChallengeTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

export interface ChallengeQuestionOption {
  id: string; // Stable option ID (never tied to array index)
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface ChallengeTrueFalseItem {
  id: string;
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean;
}

export interface ChallengeQuestionItem {
  id: string;
  code: string;
  type: QuestionType;
  stem: string;
  image?: string;
  subject: string;
  topic?: string;
  grade: string;
  level: string;
  options?: ChallengeQuestionOption[];
  correctOptionId?: string;
  subItems?: ChallengeTrueFalseItem[];
  acceptedAnswers?: string[];
  isNumericTolerance?: boolean;
  numericTolerance?: number;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
  requiresTeacherGrading: boolean;
}

export interface ChallengePairing {
  matchId: string;
  roundIndex: number; // 0-based
  pairIndex: number; // 0-based within round
  teamAId: string;
  teamBId: string;
}

export interface ChallengeRoundSchedule {
  roundIndex: number; // 0-based
  matches: ChallengePairing[];
  byeTeamId: string | null;
}

export interface ChallengeMatchConfig {
  mode: GroupChallengeMode;
  teams: ChallengeTeamConfig[];
  sourceKind: GroupChallengeSource;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionsPerMatch: 1 | 3 | 5; // Default 3 (solo uses soloQuestionCount)
  soloQuestionCount: number; // Default 5 for solo mode
  timerSeconds: number; // Default 30s; 0 = unlimited
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  rulesLocked: boolean;
}

export interface ChallengeQuestionTurnRecord {
  globalQuestionIndex: number;
  roundIndex: number;
  questionIndexInRound: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  verdictsByTeam: Record<string, GroupChallengeVerdict>; // Only active competing teams in round
  selectedOptionByTeam?: Record<string, string | undefined>;
  answerNotesByTeam?: Record<string, string | undefined>;
  resultSource: 'teacher_single_device' | 'student_auto';
  committedAt: number;
  wasEdited?: boolean;
}

export interface ChallengeMatchResult {
  matchId: string;
  roundIndex: number;
  pairIndex: number;
  teamAId: string;
  teamBId: string;
  scoreA: number; // correct answers by team A in this match
  scoreB: number; // correct answers by team B in this match
  questionsGraded: number;
  questionsTotal: number;
  isCompleted: boolean;
  pointsA: number; // 3, 1, or 0 once completed (0 while in progress)
  pointsB: number; // 3, 1, or 0 once completed (0 while in progress)
  outcome: 'pending' | 'teamA_win' | 'teamB_win' | 'draw';
}

export interface ChallengeTeamRuntime {
  teamId: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  tournamentPoints: number;
  matchesCompleted: number;
  wins: number;
  draws: number;
  losses: number;
  totalCorrect: number;
  questionsAnswered: number;
  byeRoundsCompleted: number;
}

export interface GroupChallengeState {
  config: ChallengeMatchConfig;
  rounds: ChallengeRoundSchedule[];
  questionOrder: ChallengeQuestionItem[];
  questionHistory: ChallengeQuestionTurnRecord[];
  matchResults: Record<string, ChallengeMatchResult>;
  teamRuntime: Record<string, ChallengeTeamRuntime>;
  currentRoundIndex: number;
  currentQuestionInRound: number;
  status: GroupChallengeStatus;
  endedEarly: boolean;
  trophyAwarded: boolean;
  totalQuestionsRequired: number;
}

export interface ChallengeStandingRow {
  teamId: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  tournamentPoints: number;
  matchesCompleted: number;
  wins: number;
  draws: number;
  losses: number;
  totalCorrect: number;
  rank: number;
  isTied: boolean;
}

export interface GroupChallengeValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  roundCount: number;
  matchesTotal: number;
  hasByePerRound: boolean;
  requiredQuestions: number;
  suggestedQuestionsPerMatch?: 1 | 3;
}

const OPTION_LABELS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

// ============================================================================
// 15-QUESTION SAMPLE PACK: "Thách đấu nhóm – Toán THCS" ("Dữ liệu mẫu")
// Enough for default 6 teams (5 rounds × 3 questions = 15 distinct questions)
// Contains ALL 5 mandatory prompt test cases verbatim!
// ============================================================================

export const D07_SAMPLE_QUESTIONS: ChallengeQuestionItem[] = [
  {
    id: 'd07_sample_01',
    code: 'D07-M01',
    type: 'single_choice',
    stem: 'Tính \\(\\frac{2}{3} - \\frac{1}{4}\\).',
    subject: 'math',
    topic: 'Phân số',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd07_s01_a', label: 'A', text: '\\(\\frac{1}{12}\\)' },
      { id: 'd07_s01_b', label: 'B', text: '\\(\\frac{5}{12}\\)' },
      { id: 'd07_s01_c', label: 'C', text: '\\(\\frac{1}{7}\\)' },
      { id: 'd07_s01_d', label: 'D', text: '\\(\\frac{7}{12}\\)' },
    ],
    correctOptionId: 'd07_s01_b',
    acceptedAnswers: ['5/12'],
    officialAnswerText: '\\(\\frac{5}{12}\\)',
    explanation:
      'Quy đồng mẫu chung \\(12\\): \\(\\frac{2}{3} = \\frac{8}{12}\\), \\(\\frac{1}{4} = \\frac{3}{12}\\). Vậy \\(\\frac{8}{12} - \\frac{3}{12} = \\frac{5}{12}\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_02',
    code: 'D07-M02',
    type: 'single_choice',
    stem: 'Tính \\((-4)^2 - 4^2\\).',
    subject: 'math',
    topic: 'Lũy thừa & Số nguyên',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd07_s02_a', label: 'A', text: '\\(-32\\)' },
      { id: 'd07_s02_b', label: 'B', text: '\\(0\\)' },
      { id: 'd07_s02_c', label: 'C', text: '\\(32\\)' },
      { id: 'd07_s02_d', label: 'D', text: '\\(-16\\)' },
    ],
    correctOptionId: 'd07_s02_b',
    acceptedAnswers: ['0'],
    officialAnswerText: '\\(0\\)',
    explanation: 'Ta có \\((-4)^2 = 16\\) và \\(4^2 = 16\\), nên \\((-4)^2 - 4^2 = 16 - 16 = 0\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_03',
    code: 'D07-M03',
    type: 'single_choice',
    stem: 'Tính \\(\\sqrt{(-7)^2}\\).',
    subject: 'math',
    topic: 'Căn bậc hai',
    grade: '9',
    level: 'understand',
    options: [
      { id: 'd07_s03_a', label: 'A', text: '\\(-7\\)' },
      { id: 'd07_s03_b', label: 'B', text: '\\(49\\)' },
      { id: 'd07_s03_c', label: 'C', text: '\\(7\\)' },
      { id: 'd07_s03_d', label: 'D', text: '\\(\\pm 7\\)' },
    ],
    correctOptionId: 'd07_s03_c',
    acceptedAnswers: ['7'],
    officialAnswerText: '\\(7\\)',
    explanation: 'Áp dụng \\(\\sqrt{a^2} = |a|\\), ta có \\(\\sqrt{(-7)^2} = |-7| = 7\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_04',
    code: 'D07-M04',
    type: 'single_choice',
    stem: 'Giải hệ phương trình \\(\\begin{cases}x + y = 9\\\\x - y = 3\\end{cases}\\).',
    subject: 'math',
    topic: 'Hệ phương trình',
    grade: '9',
    level: 'apply',
    options: [
      { id: 'd07_s04_a', label: 'A', text: '\\(x = 6,\\ y = 3\\)' },
      { id: 'd07_s04_b', label: 'B', text: '\\(x = 3,\\ y = 6\\)' },
      { id: 'd07_s04_c', label: 'C', text: '\\(x = 5,\\ y = 4\\)' },
      { id: 'd07_s04_d', label: 'D', text: '\\(x = 7,\\ y = 2\\)' },
    ],
    correctOptionId: 'd07_s04_a',
    acceptedAnswers: ['x=6, y=3', '(6; 3)', '6; 3'],
    officialAnswerText: '\\(x = 6,\\ y = 3\\)',
    explanation:
      'Cộng vế theo vế hai phương trình: \\(2x = 12 \\Rightarrow x = 6\\). Thay vào phương trình đầu: \\(y = 9 - 6 = 3\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_05',
    code: 'D07-M05',
    type: 'single_choice',
    stem: 'Hình chữ nhật dài \\(7{,}5\\,\\mathrm{cm}\\), rộng \\(4\\,\\mathrm{cm}\\). Diện tích của hình chữ nhật đó là bao nhiêu?',
    subject: 'math',
    topic: 'Hình học phẳng',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd07_s05_a', label: 'A', text: '\\(23\\,\\mathrm{cm}^2\\)' },
      { id: 'd07_s05_b', label: 'B', text: '\\(28\\,\\mathrm{cm}^2\\)' },
      { id: 'd07_s05_c', label: 'C', text: '\\(30\\,\\mathrm{cm}^2\\)' },
      { id: 'd07_s05_d', label: 'D', text: '\\(32\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'd07_s05_c',
    acceptedAnswers: ['30 cm2', '30 cm²', '30'],
    officialAnswerText: '\\(30\\,\\mathrm{cm}^2\\)',
    explanation: 'Diện tích hình chữ nhật là \\(S = 7{,}5 \\times 4 = 30\\,\\mathrm{cm}^2\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_06',
    code: 'D07-M06',
    type: 'single_choice',
    stem: 'Tìm \\(x\\), biết \\(5x - 7 = 18\\).',
    subject: 'math',
    topic: 'Phương trình bậc nhất',
    grade: '8',
    level: 'know',
    options: [
      { id: 'd07_s06_a', label: 'A', text: '\\(x = 3\\)' },
      { id: 'd07_s06_b', label: 'B', text: '\\(x = 5\\)' },
      { id: 'd07_s06_c', label: 'C', text: '\\(x = 11\\)' },
      { id: 'd07_s06_d', label: 'D', text: '\\(x = 2{,}2\\)' },
    ],
    correctOptionId: 'd07_s06_b',
    acceptedAnswers: ['5', 'x=5'],
    officialAnswerText: '\\(x = 5\\)',
    explanation: 'Chuyển vế: \\(5x = 18 + 7 = 25 \\Rightarrow x = \\frac{25}{5} = 5\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_07',
    code: 'D07-M07',
    type: 'single_choice',
    stem: 'Rút gọn biểu thức đại số \\(4(2x - 1) - 3x\\).',
    subject: 'math',
    topic: 'Biểu thức đại số',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'd07_s07_a', label: 'A', text: '\\(5x - 1\\)' },
      { id: 'd07_s07_b', label: 'B', text: '\\(5x - 4\\)' },
      { id: 'd07_s07_c', label: 'C', text: '\\(11x - 4\\)' },
      { id: 'd07_s07_d', label: 'D', text: '\\(5x + 4\\)' },
    ],
    correctOptionId: 'd07_s07_b',
    acceptedAnswers: ['5x-4', '5x - 4'],
    officialAnswerText: '\\(5x - 4\\)',
    explanation: 'Nhân phân phối rồi thu gọn: \\(4(2x - 1) - 3x = 8x - 4 - 3x = 5x - 4\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_08',
    code: 'D07-M08',
    type: 'single_choice',
    stem: 'Trong tam giác vuông tại \\(A\\), biết \\(AB = 6\\,\\mathrm{cm}\\) và \\(AC = 8\\,\\mathrm{cm}\\). Độ dài cạnh huyền \\(BC\\) bằng bao nhiêu?',
    subject: 'math',
    topic: 'Định lí Pythagore',
    grade: '8',
    level: 'understand',
    options: [
      { id: 'd07_s08_a', label: 'A', text: '\\(10\\,\\mathrm{cm}\\)' },
      { id: 'd07_s08_b', label: 'B', text: '\\(12\\,\\mathrm{cm}\\)' },
      { id: 'd07_s08_c', label: 'C', text: '\\(14\\,\\mathrm{cm}\\)' },
      { id: 'd07_s08_d', label: 'D', text: '\\(100\\,\\mathrm{cm}\\)' },
    ],
    correctOptionId: 'd07_s08_a',
    acceptedAnswers: ['10 cm', '10cm', '10'],
    officialAnswerText: '\\(10\\,\\mathrm{cm}\\)',
    explanation: 'Theo định lí Pythagore: \\(BC = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10\\,\\mathrm{cm}\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_09',
    code: 'D07-M09',
    type: 'single_choice',
    stem: 'Một hộp có \\(3\\) bi xanh và \\(5\\) bi đỏ cùng kích thước. Lấy ngẫu nhiên \\(1\\) bi, xác suất lấy được bi xanh là bao nhiêu?',
    subject: 'math',
    topic: 'Xác suất',
    grade: '8',
    level: 'know',
    options: [
      { id: 'd07_s09_a', label: 'A', text: '\\(\\frac{3}{5}\\)' },
      { id: 'd07_s09_b', label: 'B', text: '\\(\\frac{3}{8}\\)' },
      { id: 'd07_s09_c', label: 'C', text: '\\(\\frac{5}{8}\\)' },
      { id: 'd07_s09_d', label: 'D', text: '\\(\\frac{1}{3}\\)' },
    ],
    correctOptionId: 'd07_s09_b',
    acceptedAnswers: ['3/8', '0.375', '0,375'],
    officialAnswerText: '\\(\\frac{3}{8}\\)',
    explanation: 'Tổng số bi trong hộp là \\(3 + 5 = 8\\), có \\(3\\) bi xanh nên xác suất là \\(\\frac{3}{8}\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_10',
    code: 'D07-M10',
    type: 'single_choice',
    stem: 'Tính giá trị của biểu thức: \\[P = \\frac{3^2 + 15}{6} - (-5)\\]',
    subject: 'math',
    topic: 'Thứ tự phép tính',
    grade: '6',
    level: 'apply',
    options: [
      { id: 'd07_s10_a', label: 'A', text: '\\(-1\\)' },
      { id: 'd07_s10_b', label: 'B', text: '\\(4\\)' },
      { id: 'd07_s10_c', label: 'C', text: '\\(9\\)' },
      { id: 'd07_s10_d', label: 'D', text: '\\(11\\)' },
    ],
    correctOptionId: 'd07_s10_c',
    acceptedAnswers: ['9'],
    officialAnswerText: '\\(9\\)',
    explanation: 'Ta có \\(\\frac{9 + 15}{6} = \\frac{24}{6} = 4\\), do đó \\(P = 4 - (-5) = 4 + 5 = 9\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_11',
    code: 'D07-M11',
    type: 'single_choice',
    stem: 'Cho tỉ lệ thức \\(\\frac{x}{6} = \\frac{5}{3}\\). Giá trị của \\(x\\) là bao nhiêu?',
    subject: 'math',
    topic: 'Tỉ lệ thức',
    grade: '7',
    level: 'know',
    options: [
      { id: 'd07_s11_a', label: 'A', text: '\\(x = 8\\)' },
      { id: 'd07_s11_b', label: 'B', text: '\\(x = 9\\)' },
      { id: 'd07_s11_c', label: 'C', text: '\\(x = 10\\)' },
      { id: 'd07_s11_d', label: 'D', text: '\\(x = 15\\)' },
    ],
    correctOptionId: 'd07_s11_c',
    acceptedAnswers: ['10', 'x=10'],
    officialAnswerText: '\\(x = 10\\)',
    explanation: 'Nhân chéo: \\(3x = 6 \\times 5 = 30 \\Rightarrow x = 10\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_12',
    code: 'D07-M12',
    type: 'single_choice',
    stem: 'Khai triển hằng đẳng thức \\((x - 3)^2\\).',
    subject: 'math',
    topic: 'Hằng đẳng thức',
    grade: '8',
    level: 'understand',
    options: [
      { id: 'd07_s12_a', label: 'A', text: '\\(x^2 - 9\\)' },
      { id: 'd07_s12_b', label: 'B', text: '\\(x^2 - 3x + 9\\)' },
      { id: 'd07_s12_c', label: 'C', text: '\\(x^2 - 6x + 9\\)' },
      { id: 'd07_s12_d', label: 'D', text: '\\(x^2 + 6x + 9\\)' },
    ],
    correctOptionId: 'd07_s12_c',
    acceptedAnswers: ['x^2 - 6x + 9'],
    officialAnswerText: '\\(x^2 - 6x + 9\\)',
    explanation: 'Áp dụng \\((a - b)^2 = a^2 - 2ab + b^2\\), ta được \\((x - 3)^2 = x^2 - 6x + 9\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_13',
    code: 'D07-M13',
    type: 'single_choice',
    stem: 'Một chiếc áo giá \\(200\\,000\\) đồng được giảm \\(15\\%\\). Giá bán sau khi giảm là bao nhiêu?',
    subject: 'math',
    topic: 'Tỉ số phần trăm',
    grade: '6',
    level: 'apply',
    options: [
      { id: 'd07_s13_a', label: 'A', text: '\\(170\\,000\\) đồng' },
      { id: 'd07_s13_b', label: 'B', text: '\\(185\\,000\\) đồng' },
      { id: 'd07_s13_c', label: 'C', text: '\\(165\\,000\\) đồng' },
      { id: 'd07_s13_d', label: 'D', text: '\\(175\\,000\\) đồng' },
    ],
    correctOptionId: 'd07_s13_a',
    acceptedAnswers: ['170000', '170 000', '170.000'],
    officialAnswerText: '\\(170\\,000\\) đồng',
    explanation:
      'Số tiền giảm là \\(200\\,000 \\times 15\\% = 30\\,000\\) đồng. Giá sau giảm: \\(200\\,000 - 30\\,000 = 170\\,000\\) đồng.',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_14',
    code: 'D07-M14',
    type: 'single_choice',
    stem: 'Trong tam giác \\(ABC\\), biết \\(\\widehat{A} = 48^\\circ\\) và \\(\\widehat{B} = 72^\\circ\\). Số đo góc \\(\\widehat{C}\\) bằng bao nhiêu?',
    subject: 'math',
    topic: 'Góc trong tam giác',
    grade: '7',
    level: 'know',
    options: [
      { id: 'd07_s14_a', label: 'A', text: '\\(50^\\circ\\)' },
      { id: 'd07_s14_b', label: 'B', text: '\\(60^\\circ\\)' },
      { id: 'd07_s14_c', label: 'C', text: '\\(70^\\circ\\)' },
      { id: 'd07_s14_d', label: 'D', text: '\\(120^\\circ\\)' },
    ],
    correctOptionId: 'd07_s14_b',
    acceptedAnswers: ['60', '60°'],
    officialAnswerText: '\\(60^\\circ\\)',
    explanation: 'Tổng ba góc trong tam giác bằng \\(180^\\circ\\), nên \\(\\widehat{C} = 180^\\circ - (48^\\circ + 72^\\circ) = 60^\\circ\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd07_sample_15',
    code: 'D07-M15',
    type: 'single_choice',
    stem: 'Rút gọn biểu thức chứa căn: \\[Q = \\sqrt{18} + \\sqrt{8} - \\sqrt{2}\\]',
    subject: 'math',
    topic: 'Căn bậc hai',
    grade: '9',
    level: 'apply',
    options: [
      { id: 'd07_s15_a', label: 'A', text: '\\(2\\sqrt{2}\\)' },
      { id: 'd07_s15_b', label: 'B', text: '\\(4\\sqrt{2}\\)' },
      { id: 'd07_s15_c', label: 'C', text: '\\(5\\sqrt{2}\\)' },
      { id: 'd07_s15_d', label: 'D', text: '\\(6\\sqrt{2}\\)' },
    ],
    correctOptionId: 'd07_s15_b',
    acceptedAnswers: ['4√2', '4\\sqrt{2}'],
    officialAnswerText: '\\(4\\sqrt{2}\\)',
    explanation:
      'Đưa thừa số ra ngoài dấu căn: \\(\\sqrt{18} = 3\\sqrt{2}\\), \\(\\sqrt{8} = 2\\sqrt{2}\\). Khi đó \\(Q = 3\\sqrt{2} + 2\\sqrt{2} - \\sqrt{2} = 4\\sqrt{2}\\).',
    isSample: true,
    sourceBadge: D07_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
];

// ============================================================================
// BERGER CIRCLE ROUND-ROBIN SCHEDULER (EXACT ONCE PER PAIR, ROTATING BYE)
// ============================================================================

const BYE_SENTINEL = '__BYE__';

export function computeRoundRobinMeta(teamCount: number): {
  roundCount: number;
  matchesPerRound: number;
  matchesTotal: number;
  hasByePerRound: boolean;
} {
  const k = Math.max(2, Math.min(6, Math.floor(teamCount)));
  const isOdd = k % 2 === 1;
  const roundCount = isOdd ? k : k - 1;
  const matchesPerRound = Math.floor(k / 2);
  const matchesTotal = (k * (k - 1)) / 2;
  return {
    roundCount,
    matchesPerRound,
    matchesTotal,
    hasByePerRound: isOdd,
  };
}

/**
 * Generates a deterministic single round-robin schedule using the circle method:
 * - Every pair of teams plays EXACTLY ONCE.
 * - In every round, each team is in at most 1 match.
 * - For odd team counts (3, 5), every team gets EXACTLY 1 bye round across the tournament.
 */
export function generateRoundRobinSchedule(
  teams: ChallengeTeamConfig[]
): ChallengeRoundSchedule[] {
  const ids = teams.map((t) => t.id);
  const k = ids.length;
  if (k < 2) return [];

  const slots = k % 2 === 1 ? [...ids, BYE_SENTINEL] : [...ids];
  const n = slots.length; // Always even
  const roundCount = n - 1;
  const fixed = slots[0];
  let rotating = slots.slice(1); // length n - 1

  const rounds: ChallengeRoundSchedule[] = [];

  for (let r = 0; r < roundCount; r++) {
    const circle = [fixed, ...rotating];
    const matches: ChallengePairing[] = [];
    let byeTeamId: string | null = null;
    let pairIdx = 0;

    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      if (a === BYE_SENTINEL) {
        byeTeamId = b;
      } else if (b === BYE_SENTINEL) {
        byeTeamId = a;
      } else {
        matches.push({
          matchId: `r${r + 1}_m${pairIdx + 1}`,
          roundIndex: r,
          pairIndex: pairIdx,
          teamAId: a,
          teamBId: b,
        });
        pairIdx += 1;
      }
    }

    rounds.push({
      roundIndex: r,
      matches,
      byeTeamId,
    });

    // Rotate clockwise: last element moves to front of rotating slice
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return rounds;
}

// ============================================================================
// TEAM BUILDERS & SETUP VALIDATION
// ============================================================================

const DEFAULT_TEAM_NAMES = [
  'Đội Xanh Ngọc',
  'Đội Sao Vàng',
  'Đội Hải Đăng',
  'Đội Mặt Trời',
  'Đội Ngân Hà',
  'Đội Phượng Hoàng',
];

export function createChallengeTeams(
  teamCount: number,
  existingNames?: string[]
): ChallengeTeamConfig[] {
  const safe = Math.max(1, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safe }, (_, idx) => ({
    id: `team_${idx + 1}`,
    teamNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % CHALLENGE_TEAM_PALETTES.length,
  }));
}

export function createDefaultGroupChallengeConfig(
  mode: GroupChallengeMode = 'round_robin',
  teamCount = 4
): ChallengeMatchConfig {
  const teams =
    mode === 'solo_practice'
      ? [{ id: 'solo_1', teamNumber: 1, name: 'Tự luyện cá nhân', paletteIndex: 0 }]
      : createChallengeTeams(Math.max(2, Math.min(6, teamCount)));

  return {
    mode,
    teams,
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionsPerMatch: 3,
    soloQuestionCount: 5,
    timerSeconds: 30,
    shuffleQuestions: false,
    shuffleOptions: true,
    rulesLocked: false,
  };
}

export function validateGroupChallengeSetupConfig(
  config: ChallengeMatchConfig,
  availableQuestionsCount: number
): GroupChallengeValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.mode === 'solo_practice') {
    const required = Math.max(1, Math.min(config.soloQuestionCount, availableQuestionsCount || 1));
    if (availableQuestionsCount <= 0) {
      errors.push('Nguồn câu hỏi hiện tại chưa có câu hợp lệ. Hãy chọn bộ mẫu hoặc đổi bộ lọc.');
    } else if (config.soloQuestionCount > availableQuestionsCount) {
      warnings.push(
        `Nguồn hiện có ${availableQuestionsCount} câu (ít hơn ${config.soloQuestionCount}). Hệ thống sẽ luyện đủ ${availableQuestionsCount} câu không lặp lại.`
      );
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      roundCount: 1,
      matchesTotal: 0,
      hasByePerRound: false,
      requiredQuestions: Math.min(config.soloQuestionCount, availableQuestionsCount),
    };
  }

  if (config.teams.length < 2 || config.teams.length > 6) {
    errors.push('Giải vòng tròn cần từ 2 đến 6 đội.');
  }

  const seenNames = new Set<string>();
  config.teams.forEach((team, idx) => {
    const clean = team.name.trim();
    if (!clean) {
      errors.push(`Đội số ${idx + 1} chưa có tên hoặc nhãn tạm.`);
    } else {
      const lower = clean.toLowerCase();
      if (seenNames.has(lower)) {
        warnings.push(`Có hai đội trùng tên "${clean}" — nên đặt tên riêng để dễ theo dõi trên bảng điểm.`);
      }
      seenNames.add(lower);
    }
  });

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  const meta = computeRoundRobinMeta(Math.max(2, config.teams.length));
  const requiredQuestions = meta.roundCount * config.questionsPerMatch;

  let suggestedQuestionsPerMatch: 1 | 3 | undefined;
  if (availableQuestionsCount < requiredQuestions) {
    if (config.questionsPerMatch === 5 && availableQuestionsCount >= meta.roundCount * 3) {
      suggestedQuestionsPerMatch = 3;
    } else if (availableQuestionsCount >= meta.roundCount * 1) {
      suggestedQuestionsPerMatch = 1;
    }
    errors.push(
      `Giải ${config.teams.length} đội (${meta.roundCount} vòng × ${config.questionsPerMatch} câu/trận) cần ${requiredQuestions} câu không lặp, nhưng nguồn hiện chỉ có ${availableQuestionsCount} câu. Hãy giảm số câu mỗi trận hoặc đổi bộ câu hỏi.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    roundCount: meta.roundCount,
    matchesTotal: meta.matchesTotal,
    hasByePerRound: meta.hasByePerRound,
    requiredQuestions,
    suggestedQuestionsPerMatch,
  };
}

// ============================================================================
// QUESTION BANK ADAPTER, RBAC & BALANCED ROUND DISTRIBUTION
// ============================================================================

export function shuffleChallengeArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleChallengeOptionsPreservingId(
  item: ChallengeQuestionItem,
  rng: () => number = Math.random
): ChallengeQuestionItem {
  if (item.type !== 'single_choice' || !item.options || item.options.length < 2) {
    return item;
  }
  const shuffled = shuffleChallengeArray(item.options, rng).map((opt, idx) => ({
    ...opt,
    label: OPTION_LABELS[idx] ?? 'D',
  }));
  return {
    ...item,
    options: shuffled,
  };
}

function normalizeStemKey(stem: string): string {
  return stem.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isChallengeQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForChallenge(question: Question): ChallengeQuestionItem | null {
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const base = {
    id: String(question.id || '').trim() || `gcq_${Math.random().toString(36).slice(2, 9)}`,
    code: (question.code || 'NHCH').trim(),
    type: question.type,
    stem: cleanStem,
    image: question.image?.trim() || undefined,
    subject: String(question.subject || 'other'),
    topic: (question.chapter || question.lesson || '').trim() || undefined,
    grade: String(question.grade || '6'),
    level: String(question.level || 'understand'),
    explanation: (question.explanation || 'Giáo viên chốt kiến thức sau câu đấu.').trim(),
    isSample: false,
    sourceBadge: 'Ngân hàng câu hỏi',
  };

  if (question.type === 'single_choice') {
    const validOptions = (question.options || [])
      .filter((opt) => opt && (opt.text || '').trim().length > 0)
      .slice(0, 4)
      .map((opt, idx) => ({
        id: String(opt.id || `${base.id}_opt_${idx}`),
        label: OPTION_LABELS[idx] ?? 'D',
        text: opt.text.trim(),
      }));

    if (validOptions.length < 2) return null;

    const rawCorrect = (question.correctAnswer || '').trim();
    const matchedCorrect =
      validOptions.find((o) => o.id === rawCorrect) ||
      validOptions.find((o) => o.label.toUpperCase() === rawCorrect.toUpperCase()) ||
      validOptions.find(
        (_o, idx) =>
          (question.options?.[idx]?.label || '').toUpperCase() === rawCorrect.toUpperCase()
      );

    if (!matchedCorrect) return null;

    return {
      ...base,
      options: validOptions,
      correctOptionId: matchedCorrect.id,
      officialAnswerText: matchedCorrect.text,
      requiresTeacherGrading: false,
    };
  }

  if (question.type === 'true_false_group') {
    const validSubItems = (question.subItems || [])
      .filter((sub) => sub && (sub.text || '').trim().length > 0)
      .map((sub, idx) => ({
        id: String(sub.id || `${base.id}_sub_${idx}`),
        label: (['a', 'b', 'c', 'd'][idx] as 'a' | 'b' | 'c' | 'd') || 'd',
        text: sub.text.trim(),
        isCorrect: Boolean(sub.isCorrect),
      }));

    if (validSubItems.length === 0) return null;

    return {
      ...base,
      subItems: validSubItems,
      officialAnswerText: validSubItems
        .map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`)
        .join(' · '),
      requiresTeacherGrading: false,
    };
  }

  if (question.type === 'short_answer') {
    const accepted = (question.acceptedAnswers || [])
      .map((a) => String(a || '').trim())
      .filter(Boolean);
    const official =
      accepted[0] || (question.sampleAnswer || '').trim() || 'Giáo viên đối chiếu đáp án';
    return {
      ...base,
      acceptedAnswers: accepted,
      isNumericTolerance: question.isNumericTolerance,
      numericTolerance: question.numericTolerance,
      officialAnswerText: official,
      requiresTeacherGrading: accepted.length === 0,
    };
  }

  const essayAnswer =
    (question.sampleAnswer || '').trim() ||
    (question.explanation || '').trim() ||
    'Giáo viên chấm trực tiếp theo tiêu chí bài học';

  return {
    ...base,
    officialAnswerText: essayAnswer,
    requiresTeacherGrading: true,
  };
}

export function buildD07QuestionPool(params: {
  sourceKind: GroupChallengeSource;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): ChallengeQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return D07_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: ChallengeQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isChallengeQuestionAllowedForRole(raw, params.userRole)) continue;
    if (
      params.subjectFilter &&
      params.subjectFilter !== 'all' &&
      raw.subject !== params.subjectFilter
    ) {
      continue;
    }
    if (
      params.gradeFilter &&
      params.gradeFilter !== 'all' &&
      String(raw.grade) !== params.gradeFilter
    ) {
      continue;
    }
    if (params.levelFilter && params.levelFilter !== 'all' && raw.level !== params.levelFilter) {
      continue;
    }

    const item = adaptSmartEduQuestionForChallenge(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

/**
 * Distributes distinct questions across rounds so levels (know/understand/apply)
 * and topics are balanced across rounds — strictly NEVER repeats any question.
 */
export function prepareGroupChallengeQuestions(
  pool: ChallengeQuestionItem[],
  config: ChallengeMatchConfig,
  requiredCount: number,
  rng: () => number = Math.random
): ChallengeQuestionItem[] {
  const safeCount = Math.max(0, Math.min(requiredCount, pool.length));
  if (safeCount === 0) return [];

  let ordered: ChallengeQuestionItem[];
  if (config.shuffleQuestions) {
    // Group by cognitive level, shuffle inside each group, then interleave across rounds
    const buckets = new Map<string, ChallengeQuestionItem[]>();
    const levelPriority = ['know', 'understand', 'apply', 'apply_high'];
    levelPriority.forEach((lvl) => buckets.set(lvl, []));
    pool.forEach((item) => {
      const key = item.level || 'other';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    });

    const shuffledBuckets = Array.from(buckets.values())
      .map((arr) => shuffleChallengeArray(arr, rng))
      .filter((arr) => arr.length > 0);

    ordered = [];
    let progress = true;
    while (progress && ordered.length < safeCount) {
      progress = false;
      for (const bucket of shuffledBuckets) {
        const next = bucket.shift();
        if (next) {
          ordered.push(next);
          progress = true;
          if (ordered.length >= safeCount) break;
        }
      }
    }
  } else {
    ordered = pool.slice(0, safeCount);
  }

  return config.shuffleOptions
    ? ordered.map((q) => shuffleChallengeOptionsPreservingId(q, rng))
    : ordered.map((q) => ({
        ...q,
        options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      }));
}

// ============================================================================
// SOLO ANSWER EVALUATION HELPER
// ============================================================================

export function normalizeChallengeShortAnswer(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/cm²/g, 'cm2')
    .replace(/m²/g, 'm2');
}

export function evaluateGroupChallengeSoloAnswer(
  question: ChallengeQuestionItem,
  payload: {
    selectedOptionId?: string | null;
    trueFalseSelections?: Record<string, boolean>;
    shortAnswerText?: string;
  }
): { isCorrect: boolean; answerNote: string } {
  if (question.type === 'single_choice') {
    const picked = question.options?.find((o) => o.id === payload.selectedOptionId);
    return {
      isCorrect: Boolean(picked && picked.id === question.correctOptionId),
      answerNote: picked ? `${picked.label}. ${picked.text}` : 'Không trả lời',
    };
  }

  if (question.type === 'true_false_group' && question.subItems?.length) {
    const sel = payload.trueFalseSelections || {};
    const allAnswered = question.subItems.every((s) => typeof sel[s.id] === 'boolean');
    const allCorrect = allAnswered && question.subItems.every((s) => sel[s.id] === s.isCorrect);
    const note = question.subItems
      .map((s) =>
        typeof sel[s.id] === 'boolean'
          ? `${s.label}) ${sel[s.id] ? 'Đ' : 'S'}`
          : `${s.label}) -`
      )
      .join(' · ');
    return { isCorrect: allCorrect, answerNote: note };
  }

  if (question.type === 'short_answer' && question.acceptedAnswers?.length) {
    const rawText = (payload.shortAnswerText || '').trim();
    const normInput = normalizeChallengeShortAnswer(rawText);
    if (!normInput) return { isCorrect: false, answerNote: 'Không trả lời' };

    const hit = question.acceptedAnswers.some(
      (acc) => normalizeChallengeShortAnswer(acc) === normInput
    );
    if (hit) return { isCorrect: true, answerNote: rawText };

    if (question.isNumericTolerance) {
      const numVal = Number(normInput);
      const tol = question.numericTolerance ?? 0.01;
      if (Number.isFinite(numVal)) {
        const tolHit = question.acceptedAnswers.some((acc) => {
          const target = Number(normalizeChallengeShortAnswer(acc));
          return Number.isFinite(target) && Math.abs(numVal - target) <= tol;
        });
        if (tolHit) return { isCorrect: true, answerNote: rawText };
      }
    }
    return { isCorrect: false, answerNote: rawText };
  }

  return {
    isCorrect: false,
    answerNote: (payload.shortAnswerText || '').trim() || 'Giáo viên chấm trực tiếp',
  };
}

// ============================================================================
// CORE DETERMINISTIC TOURNAMENT RECOMPUTATION, COMMIT, EDIT & STANDINGS
// ============================================================================

export function getActiveTeamIdsInRound(
  state: Pick<GroupChallengeState, 'config' | 'rounds'>,
  roundIndex: number
): string[] {
  if (state.config.mode === 'solo_practice') {
    return state.config.teams.map((t) => t.id);
  }
  const round = state.rounds[roundIndex];
  if (!round) return [];
  const ids: string[] = [];
  round.matches.forEach((m) => {
    ids.push(m.teamAId, m.teamBId);
  });
  return ids;
}

export function getGlobalQuestionIndex(
  config: ChallengeMatchConfig,
  roundIndex: number,
  questionIndexInRound: number
): number {
  if (config.mode === 'solo_practice') {
    return questionIndexInRound;
  }
  return roundIndex * config.questionsPerMatch + questionIndexInRound;
}

/**
 * Pure source-of-truth recomputation from schedule + questionHistory.
 * Guarantees match scores, 3/1/0 tournament points, W-D-L, totalCorrect,
 * and tournament status are ALWAYS 100% consistent (including after edits & restore).
 */
export function recomputeGroupChallengeState(params: {
  config: ChallengeMatchConfig;
  rounds: ChallengeRoundSchedule[];
  questionOrder: ChallengeQuestionItem[];
  questionHistory: ChallengeQuestionTurnRecord[];
  currentRoundIndex?: number;
  currentQuestionInRound?: number;
  endedEarly?: boolean;
}): GroupChallengeState {
  const { config, rounds, questionOrder, questionHistory } = params;
  const qPerMatch = config.mode === 'solo_practice' ? questionOrder.length : config.questionsPerMatch;

  // Initialize team runtimes
  const teamRuntime: Record<string, ChallengeTeamRuntime> = {};
  for (const team of config.teams) {
    teamRuntime[team.id] = {
      teamId: team.id,
      teamNumber: team.teamNumber,
      name: team.name,
      paletteIndex: team.paletteIndex,
      tournamentPoints: 0,
      matchesCompleted: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      totalCorrect: 0,
      questionsAnswered: 0,
      byeRoundsCompleted: 0,
    };
  }

  // Initialize match results for every scheduled pairing
  const matchResults: Record<string, ChallengeMatchResult> = {};
  rounds.forEach((round) => {
    round.matches.forEach((pair) => {
      matchResults[pair.matchId] = {
        matchId: pair.matchId,
        roundIndex: round.roundIndex,
        pairIndex: pair.pairIndex,
        teamAId: pair.teamAId,
        teamBId: pair.teamBId,
        scoreA: 0,
        scoreB: 0,
        questionsGraded: 0,
        questionsTotal: qPerMatch,
        isCompleted: false,
        pointsA: 0,
        pointsB: 0,
        outcome: 'pending',
      };
    });
  });

  // Group graded questions by roundIndex
  const gradedByRound = new Map<number, ChallengeQuestionTurnRecord[]>();
  questionHistory.forEach((rec) => {
    if (!gradedByRound.has(rec.roundIndex)) {
      gradedByRound.set(rec.roundIndex, []);
    }
    gradedByRound.get(rec.roundIndex)!.push(rec);

    // Tally team-level correct counts strictly for participating teams
    Object.entries(rec.verdictsByTeam).forEach(([teamId, verdict]) => {
      const rt = teamRuntime[teamId];
      if (!rt) return;
      // Double safety: ignore if team was bye in this round
      if (config.mode === 'round_robin' && rounds[rec.roundIndex]?.byeTeamId === teamId) {
        return;
      }
      rt.questionsAnswered += 1;
      if (verdict === 'correct') {
        rt.totalCorrect += 1;
      }
    });
  });

  // Compute each match's score & finalize 3/1/0 tournament points ONCE when all questions of its round are graded
  if (config.mode === 'round_robin') {
    rounds.forEach((round) => {
      const roundRecords = gradedByRound.get(round.roundIndex) || [];
      const roundComplete = roundRecords.length >= qPerMatch;

      if (roundComplete && round.byeTeamId && teamRuntime[round.byeTeamId]) {
        teamRuntime[round.byeTeamId].byeRoundsCompleted += 1;
      }

      round.matches.forEach((pair) => {
        const mr = matchResults[pair.matchId];
        let sA = 0;
        let sB = 0;

        roundRecords.forEach((rec) => {
          if (rec.verdictsByTeam[pair.teamAId] === 'correct') sA += 1;
          if (rec.verdictsByTeam[pair.teamBId] === 'correct') sB += 1;
        });

        mr.scoreA = sA;
        mr.scoreB = sB;
        mr.questionsGraded = roundRecords.length;
        mr.isCompleted = roundComplete;

        if (roundComplete) {
          const rtA = teamRuntime[pair.teamAId];
          const rtB = teamRuntime[pair.teamBId];
          if (rtA) rtA.matchesCompleted += 1;
          if (rtB) rtB.matchesCompleted += 1;

          if (sA > sB) {
            mr.pointsA = POINTS_WIN;
            mr.pointsB = POINTS_LOSS;
            mr.outcome = 'teamA_win';
            if (rtA) {
              rtA.tournamentPoints += POINTS_WIN;
              rtA.wins += 1;
            }
            if (rtB) {
              rtB.losses += 1;
            }
          } else if (sB > sA) {
            mr.pointsA = POINTS_LOSS;
            mr.pointsB = POINTS_WIN;
            mr.outcome = 'teamB_win';
            if (rtB) {
              rtB.tournamentPoints += POINTS_WIN;
              rtB.wins += 1;
            }
            if (rtA) {
              rtA.losses += 1;
            }
          } else {
            mr.pointsA = POINTS_DRAW;
            mr.pointsB = POINTS_DRAW;
            mr.outcome = 'draw';
            if (rtA) {
              rtA.tournamentPoints += POINTS_DRAW;
              rtA.draws += 1;
            }
            if (rtB) {
              rtB.tournamentPoints += POINTS_DRAW;
              rtB.draws += 1;
            }
          }
        }
      });
    });
  }

  const totalQuestionsRequired =
    config.mode === 'solo_practice'
      ? questionOrder.length
      : rounds.length * config.questionsPerMatch;

  const allCompleted =
    totalQuestionsRequired > 0 && questionHistory.length >= totalQuestionsRequired;

  const endedEarly = Boolean(params.endedEarly);
  let status: GroupChallengeStatus = 'playing';
  if (endedEarly) {
    status = 'ended_early';
  } else if (allCompleted) {
    status = 'finished';
  }

  // Trophy awarded strictly ONLY on full completion of a round-robin tournament (never on early end!)
  const trophyAwarded = config.mode === 'round_robin' && status === 'finished';

  const defaultRoundIdx =
    config.mode === 'solo_practice'
      ? 0
      : Math.min(
          Math.max(0, rounds.length - 1),
          Math.floor(questionHistory.length / Math.max(1, config.questionsPerMatch))
        );
  const defaultQInRound =
    config.mode === 'solo_practice'
      ? Math.min(Math.max(0, questionOrder.length - 1), questionHistory.length)
      : questionHistory.length % Math.max(1, config.questionsPerMatch);

  const safeRoundIdx =
    typeof params.currentRoundIndex === 'number'
      ? Math.max(0, Math.min(Math.max(0, rounds.length - 1), params.currentRoundIndex))
      : defaultRoundIdx;

  const maxQInRound =
    config.mode === 'solo_practice'
      ? Math.max(0, questionOrder.length - 1)
      : Math.max(0, config.questionsPerMatch - 1);

  const safeQInRound =
    typeof params.currentQuestionInRound === 'number'
      ? Math.max(0, Math.min(maxQInRound, params.currentQuestionInRound))
      : defaultQInRound;

  return {
    config: { ...config, rulesLocked: true },
    rounds,
    questionOrder,
    questionHistory: [...questionHistory],
    matchResults,
    teamRuntime,
    currentRoundIndex: safeRoundIdx,
    currentQuestionInRound: safeQInRound,
    status,
    endedEarly: status === 'ended_early',
    trophyAwarded,
    totalQuestionsRequired,
  };
}

export function createInitialGroupChallengeState(
  config: ChallengeMatchConfig,
  questionOrder: ChallengeQuestionItem[]
): GroupChallengeState {
  const rounds =
    config.mode === 'round_robin' ? generateRoundRobinSchedule(config.teams) : [];
  return recomputeGroupChallengeState({
    config: { ...config, rulesLocked: true },
    rounds,
    questionOrder,
    questionHistory: [],
    currentRoundIndex: 0,
    currentQuestionInRound: 0,
    endedEarly: false,
  });
}

/**
 * Atomic idempotent commit for the current question in the current round:
 * - Blocks duplicate commits for the same questionId (protects against double-clicks).
 * - Requires EVERY active competing team in the current round to have verdict !== 'ungraded'.
 * - Strictly ignores/excludes byeTeamId so bye teams never record tournament scores.
 */
export function commitGroupChallengeQuestionResult(
  state: GroupChallengeState,
  input: {
    question: ChallengeQuestionItem;
    verdictsByTeam: Record<string, GroupChallengeVerdict>;
    selectedOptionByTeam?: Record<string, string | undefined>;
    answerNotesByTeam?: Record<string, string | undefined>;
    resultSource: 'teacher_single_device' | 'student_auto';
    committedAt?: number;
  }
): {
  state: GroupChallengeState;
  committed: boolean;
  reason?: string;
  roundJustCompleted: boolean;
  record?: ChallengeQuestionTurnRecord;
} {
  if (state.status !== 'playing') {
    return {
      state,
      committed: false,
      reason: 'tournament_already_finished',
      roundJustCompleted: false,
    };
  }

  if (state.questionHistory.some((h) => h.questionId === input.question.id)) {
    return {
      state,
      committed: false,
      reason: 'duplicate_question_commit',
      roundJustCompleted: false,
    };
  }

  const activeTeamIds = getActiveTeamIdsInRound(state, state.currentRoundIndex);
  const cleanVerdicts: Record<string, GroupChallengeVerdict> = {};

  for (const tid of activeTeamIds) {
    const v = input.verdictsByTeam[tid];
    if (!v || v === 'ungraded') {
      return {
        state,
        committed: false,
        reason: 'ungraded_team',
        roundJustCompleted: false,
      };
    }
    cleanVerdicts[tid] = v;
  }

  const globalIdx = getGlobalQuestionIndex(
    state.config,
    state.currentRoundIndex,
    state.currentQuestionInRound
  );

  const record: ChallengeQuestionTurnRecord = {
    globalQuestionIndex: globalIdx,
    roundIndex: state.currentRoundIndex,
    questionIndexInRound: state.currentQuestionInRound,
    questionId: input.question.id,
    questionCode: input.question.code,
    questionStem: input.question.stem,
    officialAnswerText: input.question.officialAnswerText,
    explanation: input.question.explanation,
    verdictsByTeam: cleanVerdicts,
    selectedOptionByTeam: input.selectedOptionByTeam,
    answerNotesByTeam: input.answerNotesByTeam,
    resultSource: input.resultSource,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextState = recomputeGroupChallengeState({
    config: state.config,
    rounds: state.rounds,
    questionOrder: state.questionOrder,
    questionHistory: [...state.questionHistory, record],
    currentRoundIndex: state.currentRoundIndex,
    currentQuestionInRound: state.currentQuestionInRound,
    endedEarly: false,
  });

  const roundJustCompleted =
    state.config.mode === 'round_robin' &&
    state.currentQuestionInRound >= state.config.questionsPerMatch - 1;

  return {
    state: nextState,
    committed: true,
    roundJustCompleted,
    record,
  };
}

/**
 * Edits the most recently graded question (including the last question of a round
 * before opening the next round) and cleanly recomputes match scores & tournament points!
 */
export function editLastConfirmedGroupChallengeQuestion(
  state: GroupChallengeState,
  verdictsByTeam: Record<string, GroupChallengeVerdict>,
  selectedOptionByTeam?: Record<string, string | undefined>
): { state: GroupChallengeState; edited: boolean; record?: ChallengeQuestionTurnRecord } {
  if (state.questionHistory.length === 0) {
    return { state, edited: false };
  }

  const lastIdx = state.questionHistory.length - 1;
  const last = state.questionHistory[lastIdx];
  const activeTeamIds = getActiveTeamIdsInRound(state, last.roundIndex);
  const cleanVerdicts: Record<string, GroupChallengeVerdict> = {};

  for (const tid of activeTeamIds) {
    const v = verdictsByTeam[tid];
    if (!v || v === 'ungraded') {
      return { state, edited: false };
    }
    cleanVerdicts[tid] = v;
  }

  const updatedHistory = [...state.questionHistory];
  updatedHistory[lastIdx] = {
    ...last,
    verdictsByTeam: cleanVerdicts,
    selectedOptionByTeam: selectedOptionByTeam ?? last.selectedOptionByTeam,
    wasEdited: true,
    committedAt: Date.now(),
  };

  const nextState = recomputeGroupChallengeState({
    config: state.config,
    rounds: state.rounds,
    questionOrder: state.questionOrder,
    questionHistory: updatedHistory,
    currentRoundIndex: state.currentRoundIndex,
    currentQuestionInRound: state.currentQuestionInRound,
    endedEarly: false,
  });

  return {
    state: nextState,
    edited: true,
    record: nextState.questionHistory[lastIdx],
  };
}

/**
 * Advances pointer to the next question within the current round, OR to the start of the next round.
 */
export function advanceGroupChallengePointer(state: GroupChallengeState): GroupChallengeState {
  if (state.status !== 'playing') return state;

  if (state.config.mode === 'solo_practice') {
    const nextQ = Math.min(state.questionOrder.length - 1, state.questionHistory.length);
    return {
      ...state,
      currentRoundIndex: 0,
      currentQuestionInRound: nextQ,
    };
  }

  const qPerMatch = state.config.questionsPerMatch;
  const nextRoundIdx = Math.min(
    Math.max(0, state.rounds.length - 1),
    Math.floor(state.questionHistory.length / qPerMatch)
  );
  const nextQInRound = state.questionHistory.length % qPerMatch;

  return {
    ...state,
    currentRoundIndex: nextRoundIdx,
    currentQuestionInRound: nextQInRound,
  };
}

export function endGroupChallengeEarly(state: GroupChallengeState): GroupChallengeState {
  if (state.status !== 'playing') return state;
  return recomputeGroupChallengeState({
    config: state.config,
    rounds: state.rounds,
    questionOrder: state.questionOrder,
    questionHistory: state.questionHistory,
    currentRoundIndex: state.currentRoundIndex,
    currentQuestionInRound: state.currentQuestionInRound,
    endedEarly: true,
  });
}

/**
 * Ranks teams strictly by tournamentPoints descending.
 * Equal tournamentPoints share the EXACT same rank (isTied: true => "Đồng hạng").
 * W-D-L and totalCorrect are included separately for teacher review.
 */
export function computeGroupChallengeStandings(
  state: GroupChallengeState
): ChallengeStandingRow[] {
  const rows: ChallengeStandingRow[] = state.config.teams.map((team) => {
    const rt = state.teamRuntime[team.id];
    return {
      teamId: team.id,
      teamNumber: rt.teamNumber,
      name: rt.name,
      paletteIndex: rt.paletteIndex,
      tournamentPoints: rt.tournamentPoints,
      matchesCompleted: rt.matchesCompleted,
      wins: rt.wins,
      draws: rt.draws,
      losses: rt.losses,
      totalCorrect: rt.totalCorrect,
      rank: 1,
      isTied: false,
    };
  });

  // Sort strictly by tournamentPoints descending (stable by teamNumber on equal points)
  rows.sort((a, b) => b.tournamentPoints - a.tournamentPoints || a.teamNumber - b.teamNumber);

  const freq = new Map<number, number>();
  rows.forEach((r) => freq.set(r.tournamentPoints, (freq.get(r.tournamentPoints) || 0) + 1));

  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].tournamentPoints === rows[i - 1].tournamentPoints) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = i + 1;
    }
    rows[i].isTied = (freq.get(rows[i].tournamentPoints) || 0) > 1;
  }

  return rows;
}

// ============================================================================
// SESSION PERSISTENCE (DEMO-ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredD07SessionPayload {
  version: number;
  config: ChallengeMatchConfig;
  rounds: ChallengeRoundSchedule[];
  questionOrder: ChallengeQuestionItem[];
  questionHistory: ChallengeQuestionTurnRecord[];
  currentRoundIndex: number;
  currentQuestionInRound: number;
  endedEarly: boolean;
  updatedAt: number;
}

export function getD07SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D07_SESSION_STORAGE_KEY}`
    : D07_SESSION_STORAGE_KEY;
}

export function saveD07Session(state: GroupChallengeState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredD07SessionPayload = {
      version: D07_SESSION_VERSION,
      config: state.config,
      rounds: state.rounds,
      questionOrder: state.questionOrder,
      questionHistory: state.questionHistory,
      currentRoundIndex: state.currentRoundIndex,
      currentQuestionInRound: state.currentQuestionInRound,
      endedEarly: state.endedEarly,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getD07SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function clearD07Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD07SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadD07Session(): {
  state: GroupChallengeState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getD07SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredD07SessionPayload>;
    if (
      !parsed ||
      parsed.version !== D07_SESSION_VERSION ||
      !parsed.config ||
      !Array.isArray(parsed.config.teams) ||
      parsed.config.teams.length === 0 ||
      !Array.isArray(parsed.rounds) ||
      !Array.isArray(parsed.questionOrder) ||
      parsed.questionOrder.length === 0 ||
      !Array.isArray(parsed.questionHistory)
    ) {
      clearD07Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const modeValid =
      parsed.config.mode === 'round_robin' || parsed.config.mode === 'solo_practice';
    if (!modeValid) {
      clearD07Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const restored = recomputeGroupChallengeState({
      config: parsed.config,
      rounds: parsed.rounds,
      questionOrder: parsed.questionOrder,
      questionHistory: parsed.questionHistory,
      currentRoundIndex:
        typeof parsed.currentRoundIndex === 'number' ? parsed.currentRoundIndex : undefined,
      currentQuestionInRound:
        typeof parsed.currentQuestionInRound === 'number'
          ? parsed.currentQuestionInRound
          : undefined,
      endedEarly: Boolean(parsed.endedEarly),
    });

    return { state: restored, recoveredFromCorruption: false };
  } catch {
    clearD07Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
