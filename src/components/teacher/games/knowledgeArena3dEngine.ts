import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const C03_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const C03_ROUND_COUNT = 3;
export const C03_QUESTIONS_PER_ROUND = 4;
export const C03_TOTAL_MAIN_QUESTIONS = C03_ROUND_COUNT * C03_QUESTIONS_PER_ROUND; // 12
export const C03_ROUND_POINTS = [10, 20, 30] as const;
export const C03_MAX_ROUND_SCORES = [40, 80, 120] as const;
export const C03_MAX_MAIN_SCORE = 240; // 4*10 + 4*20 + 4*30 = 240

export type C03ParticipationMode = 'solo' | 'teams';
export type C03QuestionSource = 'sample_pack' | 'bank';
export type C03GraphicsQuality = 'high' | '2d';

export type C03Phase =
  | 'setup'
  | 'playing'
  | 'question_revealed'
  | 'round_summary'
  | 'tiebreaker'
  | 'summary';

export type C03TeamOutcomeStatus =
  | 'unattempted'
  | 'submitted' // Đã nộp (chờ chốt)
  | 'correct_independent' // Đúng tự làm
  | 'correct_with_hint' // Đúng có hỗ trợ
  | 'wrong' // Sai (0đ)
  | 'wrong_viewed_solution' // Sai + đã xem lời giải (0đ)
  | 'skipped'; // Bỏ qua (0đ)

export interface C03OptionItem {
  optionId: string;
  labelKey: string;
  text: string;
}

export interface C03QuestionItem {
  questionId: string;
  roundIndex: 0 | 1 | 2; // 0 = Vòng 1 (10đ), 1 = Vòng 2 (20đ), 2 = Vòng 3 (30đ)
  difficultyLabel: 'Nhận biết' | 'Thông hiểu' | 'Vận dụng';
  sourceTag: 'Dữ liệu mẫu' | 'Ngân hàng Smart EDU';
  topicLabel: string;
  stem: string;
  image?: string;
  options: C03OptionItem[];
  correctOptionId: string;
  hintText: string;
  explanationText: string;
}

export interface C03TeamSubmission {
  teamId: string;
  graded: boolean; // Strict one-grade-per-(team, question) lock!
  status: C03TeamOutcomeStatus;
  selectedOptionId: string | null;
  usedHint: boolean;
  viewedSolution: boolean;
  pointsAwarded: number;
}

export interface C03QuestionProgress {
  question: C03QuestionItem;
  roundIndex: 0 | 1 | 2;
  questionInRoundIndex: 0 | 1 | 2 | 3;
  submissions: Record<string, C03TeamSubmission>;
  hintRevealed: boolean;
  solutionRevealed: boolean;
}

export interface C03TeamItem {
  id: string;
  name: string;
  color: string;
  roundScores: [number, number, number];
  roundCorrectCounts: [number, number, number];
  roundProgress: [
    [C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus],
    [C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus],
    [C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus, C03TeamOutcomeStatus],
  ];
  mainScore: number; // Strictly sum of roundScores (max 240)
  tiebreakerScore: number; // Separate from mainScore when tiebreaker enabled
  studentNames: string[];
}

export interface C03RankedTeam {
  teamId: string;
  name: string;
  color: string;
  rank: number; // Preserves exact tie rank (e.g. 1, 1, 3) when no tiebreaker
  mainScore: number;
  tiebreakerScore: number;
  roundScores: [number, number, number];
  roundCorrectCounts: [number, number, number];
  totalCorrect: number;
}

export interface C03SetupConfig {
  participationMode: C03ParticipationMode;
  questionSource: C03QuestionSource;
  shuffleOptions: boolean;
  whiteboardHoldMode: boolean;
  enableTiebreaker: boolean; // Optional tiebreaker recorded separately
  teamCount: number; // 2..6
  teamNames: string[];
  classStudents: Array<{ id: string; fullName: string }>;
  selectedClassId: string;
}

export interface C03GameState {
  phase: C03Phase;
  config: C03SetupConfig;
  deck: C03QuestionProgress[]; // 12 main questions (4 * 3 rounds)
  tiebreakerDeck: C03QuestionItem[];
  tiebreakerIndex: number;
  tiebreakerUsedCount: number;
  currentQuestionIndex: number; // 0..11
  currentRoundIndex: 0 | 1 | 2;
  teams: C03TeamItem[];
  activeTeamCursor: number;
  turnToken: string;
  isProcessing: boolean;
  revealAnimDone: boolean;
  lastActionNotice: string;
}

export interface C03SummaryStats {
  completedMainQuestions: number;
  roundTotals: Array<{
    roundNumber: 1 | 2 | 3;
    pointsPerQuestion: 10 | 20 | 30;
    maxRoundScore: 40 | 80 | 120;
    topTeamScore: number;
    topTeamCorrectCount: number;
  }>;
  rankings: C03RankedTeam[];
  isTieAtTop: boolean;
  tiebreakerUsed: boolean;
  independentCount: number;
  assistedCount: number;
  viewedSolutionCount: number;
  skippedCount: number;
  wrongCount: number;
}

const TEAM_PALETTE = ['#2563EB', '#EA580C', '#059669', '#D97706', '#7C3AED', '#DB2777'];
const DEFAULT_TEAM_NAMES = ['Đội X', 'Đội Y', 'Đội Z', 'Đội T', 'Đội U', 'Đội V'];
const DISPLAY_KEYS = ['A', 'B', 'C', 'D'] as const;

export const C03_SESSION_BASE_KEY = 'taydo_c03_knowledge_arena_3d_session_v1';

export function getC03SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${C03_SESSION_BASE_KEY}`
    : C03_SESSION_BASE_KEY;
}

/**
 * Strictly returns round multiplier:
 * Round 0 (Vòng 1) -> 10
 * Round 1 (Vòng 2) -> 20
 * Round 2 (Vòng 3) -> 30
 * Never reuses Round 2's multiplier in Round 3!
 */
export function getC03RoundPoints(roundIndex: 0 | 1 | 2): 10 | 20 | 30 {
  return C03_ROUND_POINTS[roundIndex];
}

// ---------------------------------------------------------------------------
// 12 SAMPLE MATH QUESTIONS (3 ROUNDS x 4 QUESTIONS, ASCENDING DIFFICULTY)
// Includes explicit Prompt §5 example: 2(3x - 1) = 10 -> x = 2
// ---------------------------------------------------------------------------
export const C03_SAMPLE_QUESTIONS: C03QuestionItem[] = [
  // ---- VÒNG 1 (4 câu × 10đ = 40đ max) ----
  {
    questionId: 'c03_r1_q1',
    roundIndex: 0,
    difficultyLabel: 'Nhận biết',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 1 · Lũy thừa cơ bản',
    stem: 'Tính giá trị của biểu thức: \\(2^3 + 4\\).',
    options: [
      { optionId: 'c03_r1_q1_a', labelKey: 'A', text: '\\(12\\)' },
      { optionId: 'c03_r1_q1_b', labelKey: 'B', text: '\\(10\\)' },
      { optionId: 'c03_r1_q1_c', labelKey: 'C', text: '\\(14\\)' },
      { optionId: 'c03_r1_q1_d', labelKey: 'D', text: '\\(16\\)' },
    ],
    correctOptionId: 'c03_r1_q1_a',
    hintText: 'Tính \\(2^3 = 2 \\times 2 \\times 2\\) trước khi cộng \\(4\\).',
    explanationText: 'Ta có \\(2^3 = 8\\), suy ra \\(2^3 + 4 = 8 + 4 = 12\\) (phản ví dụ sai: lấy \\(2 \\times 3 + 4 = 10\\)).',
  },
  {
    questionId: 'c03_r1_q2',
    roundIndex: 0,
    difficultyLabel: 'Nhận biết',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 1 · Số nguyên âm',
    stem: 'Tính kết quả phép cộng: \\((-15) + 9\\).',
    options: [
      { optionId: 'c03_r1_q2_a', labelKey: 'A', text: '\\(-6\\)' },
      { optionId: 'c03_r1_q2_b', labelKey: 'B', text: '\\(6\\)' },
      { optionId: 'c03_r1_q2_c', labelKey: 'C', text: '\\(-24\\)' },
      { optionId: 'c03_r1_q2_d', labelKey: 'D', text: '\\(24\\)' },
    ],
    correctOptionId: 'c03_r1_q2_a',
    hintText: 'Hai số nguyên trái dấu: lấy phần số lớn trừ nhỏ rồi giữ dấu của \\(-15\\).',
    explanationText: 'Ta có \\((-15) + 9 = -(15 - 9) = -6\\).',
  },
  {
    questionId: 'c03_r1_q3',
    roundIndex: 0,
    difficultyLabel: 'Nhận biết',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 1 · Căn bậc hai',
    stem: 'Tính giá trị: \\(\\sqrt{81} - 3\\).',
    options: [
      { optionId: 'c03_r1_q3_a', labelKey: 'A', text: '\\(6\\)' },
      { optionId: 'c03_r1_q3_b', labelKey: 'B', text: '\\(9\\)' },
      { optionId: 'c03_r1_q3_c', labelKey: 'C', text: '\\(78\\)' },
      { optionId: 'c03_r1_q3_d', labelKey: 'D', text: '\\(24\\)' },
    ],
    correctOptionId: 'c03_r1_q3_a',
    hintText: 'Vì \\(9^2 = 81\\) nên \\(\\sqrt{81} = 9\\).',
    explanationText: 'Ta có \\(\\sqrt{81} - 3 = 9 - 3 = 6\\).',
  },
  {
    questionId: 'c03_r1_q4',
    roundIndex: 0,
    difficultyLabel: 'Nhận biết',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 1 · Cộng phân số',
    stem: 'Tính tổng: \\(\\dfrac{1}{2} + \\dfrac{1}{4}\\).',
    options: [
      { optionId: 'c03_r1_q4_a', labelKey: 'A', text: '\\(\\dfrac{3}{4}\\)' },
      { optionId: 'c03_r1_q4_b', labelKey: 'B', text: '\\(\\dfrac{2}{6}\\)' },
      { optionId: 'c03_r1_q4_c', labelKey: 'C', text: '\\(\\dfrac{1}{3}\\)' },
      { optionId: 'c03_r1_q4_d', labelKey: 'D', text: '\\(\\dfrac{2}{4}\\)' },
    ],
    correctOptionId: 'c03_r1_q4_a',
    hintText: 'Quy đồng \\(\\dfrac{1}{2} = \\dfrac{2}{4}\\).',
    explanationText: 'Ta có \\(\\dfrac{1}{2} + \\dfrac{1}{4} = \\dfrac{2}{4} + \\dfrac{1}{4} = \\dfrac{3}{4}\\).',
  },

  // ---- VÒNG 2 (4 câu × 20đ = 80đ max) ----
  {
    questionId: 'c03_r2_q1',
    roundIndex: 1,
    difficultyLabel: 'Thông hiểu',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 2 · Phương trình bậc nhất',
    stem: 'Giải phương trình: \\(2(3x - 1) = 10\\). Nghiệm \\(x\\) bằng bao nhiêu?',
    options: [
      { optionId: 'c03_r2_q1_a', labelKey: 'A', text: '\\(x = 2\\)' },
      { optionId: 'c03_r2_q1_b', labelKey: 'B', text: '\\(x = 4\\)' },
      { optionId: 'c03_r2_q1_c', labelKey: 'C', text: '\\(x = \\dfrac{11}{6}\\)' },
      { optionId: 'c03_r2_q1_d', labelKey: 'D', text: '\\(x = 3\\)' },
    ],
    correctOptionId: 'c03_r2_q1_a',
    hintText: 'Chia cả hai vế cho \\(2\\) để được \\(3x - 1 = 5\\), sau đó tìm \\(x\\).',
    explanationText:
      'Từ \\(2(3x - 1) = 10 \\Rightarrow 3x - 1 = 5 \\Rightarrow 3x = 6 \\Rightarrow x = 2\\). Thử lại: \\(2(3\\cdot 2 - 1) = 2\\cdot 5 = 10\\) (đúng).',
  },
  {
    questionId: 'c03_r2_q2',
    roundIndex: 1,
    difficultyLabel: 'Thông hiểu',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 2 · Tổng ba góc tam giác',
    stem: 'Tam giác \\(ABC\\) có \\(\\widehat{A} = 48^\\circ\\) và \\(\\widehat{B} = 62^\\circ\\). Số đo góc \\(\\widehat{C}\\) là:',
    options: [
      { optionId: 'c03_r2_q2_a', labelKey: 'A', text: '\\(70^\\circ\\)' },
      { optionId: 'c03_r2_q2_b', labelKey: 'B', text: '\\(110^\\circ\\)' },
      { optionId: 'c03_r2_q2_c', labelKey: 'C', text: '\\(80^\\circ\\)' },
      { optionId: 'c03_r2_q2_d', labelKey: 'D', text: '\\(60^\\circ\\)' },
    ],
    correctOptionId: 'c03_r2_q2_a',
    hintText: 'Tổng ba góc trong tam giác bằng \\(180^\\circ\\).',
    explanationText: 'Ta có \\(\\widehat{C} = 180^\\circ - (48^\\circ + 62^\\circ) = 180^\\circ - 110^\\circ = 70^\\circ\\).',
  },
  {
    questionId: 'c03_r2_q3',
    roundIndex: 1,
    difficultyLabel: 'Thông hiểu',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 2 · Tỉ lệ thức',
    stem: 'Tìm \\(x\\) biết tỉ lệ thức: \\(\\dfrac{x}{6} = \\dfrac{-5}{3}\\).',
    options: [
      { optionId: 'c03_r2_q3_a', labelKey: 'A', text: '\\(-10\\)' },
      { optionId: 'c03_r2_q3_b', labelKey: 'B', text: '\\(10\\)' },
      { optionId: 'c03_r2_q3_c', labelKey: 'C', text: '\\(-2{,}5\\)' },
      { optionId: 'c03_r2_q3_d', labelKey: 'D', text: '\\(-30\\)' },
    ],
    correctOptionId: 'c03_r2_q3_a',
    hintText: 'Nhân chéo: \\(x \\cdot 3 = 6 \\cdot (-5)\\).',
    explanationText: 'Ta có \\(x = \\dfrac{6 \\times (-5)}{3} = -10\\).',
  },
  {
    questionId: 'c03_r2_q4',
    roundIndex: 1,
    difficultyLabel: 'Thông hiểu',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 2 · Thống kê trung bình cộng',
    stem: 'Điểm kiểm tra của một tổ là \\(7; 8; 9; 8; 8\\). Số trung bình cộng của tổ đó bằng:',
    options: [
      { optionId: 'c03_r2_q4_a', labelKey: 'A', text: '\\(8\\)' },
      { optionId: 'c03_r2_q4_b', labelKey: 'B', text: '\\(7{,}5\\)' },
      { optionId: 'c03_r2_q4_c', labelKey: 'C', text: '\\(8{,}5\\)' },
      { optionId: 'c03_r2_q4_d', labelKey: 'D', text: '\\(40\\)' },
    ],
    correctOptionId: 'c03_r2_q4_a',
    hintText: 'Tổng \\(5\\) điểm chia cho \\(5\\).',
    explanationText: 'Ta có \\(\\overline{x} = \\dfrac{7 + 8 + 9 + 8 + 8}{5} = \\dfrac{40}{5} = 8\\).',
  },

  // ---- VÒNG 3 (4 câu × 30đ = 120đ max) ----
  {
    questionId: 'c03_r3_q1',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 3 · Hình học thực tế',
    stem: 'Một hình chữ nhật có kích thước \\(4\\text{ cm}\\) và \\(6\\text{ cm}\\). Nếu tăng mỗi cạnh thêm \\(2\\text{ cm}\\), diện tích tăng thêm bao nhiêu?',
    options: [
      { optionId: 'c03_r3_q1_a', labelKey: 'A', text: '\\(24\\text{ cm}^2\\)' },
      { optionId: 'c03_r3_q1_b', labelKey: 'B', text: '\\(4\\text{ cm}^2\\)' },
      { optionId: 'c03_r3_q1_c', labelKey: 'C', text: '\\(48\\text{ cm}^2\\)' },
      { optionId: 'c03_r3_q1_d', labelKey: 'D', text: '\\(20\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'c03_r3_q1_a',
    hintText: 'Tính diện tích mới \\((4+2)\\times(6+2)\\) rồi trừ diện tích ban đầu \\(4\\times 6\\).',
    explanationText: 'Diện tích mới là \\(6 \\times 8 = 48\\text{ cm}^2\\), diện tích cũ là \\(24\\text{ cm}^2\\). Phần tăng thêm là \\(48 - 24 = 24\\text{ cm}^2\\).',
  },
  {
    questionId: 'c03_r3_q2',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 3 · Biểu thức phân số âm',
    stem: 'Tính giá trị rút gọn: \\(\\left(-\\dfrac{3}{5}\\right) \\cdot \\dfrac{10}{9} + \\dfrac{1}{3}\\).',
    options: [
      { optionId: 'c03_r3_q2_a', labelKey: 'A', text: '\\(-\\dfrac{1}{3}\\)' },
      { optionId: 'c03_r3_q2_b', labelKey: 'B', text: '\\(\\dfrac{1}{3}\\)' },
      { optionId: 'c03_r3_q2_c', labelKey: 'C', text: '\\(-1\\)' },
      { optionId: 'c03_r3_q2_d', labelKey: 'D', text: '\\(-\\dfrac{2}{3}\\)' },
    ],
    correctOptionId: 'c03_r3_q2_a',
    hintText: 'Thực hiện phép nhân trước: \\(\\left(-\\dfrac{3}{5}\\right) \\cdot \\dfrac{10}{9} = -\\dfrac{2}{3}\\).',
    explanationText: 'Ta có \\(-\\dfrac{30}{45} + \\dfrac{1}{3} = -\\dfrac{2}{3} + \\dfrac{1}{3} = -\\dfrac{1}{3}\\).',
  },
  {
    questionId: 'c03_r3_q3',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 3 · Lũy thừa & Căn thức tổng hợp',
    stem: 'Tính giá trị biểu thức: \\(A = 3^2 - \\sqrt{25} + (-2)^3\\).',
    options: [
      { optionId: 'c03_r3_q3_a', labelKey: 'A', text: '\\(-4\\)' },
      { optionId: 'c03_r3_q3_b', labelKey: 'B', text: '\\(12\\)' },
      { optionId: 'c03_r3_q3_c', labelKey: 'C', text: '\\(-2\\)' },
      { optionId: 'c03_r3_q3_d', labelKey: 'D', text: '\\(4\\)' },
    ],
    correctOptionId: 'c03_r3_q3_a',
    hintText: 'Chú ý \\((-2)^3 = -8\\) (lũy thừa bậc lẻ của số âm giữ dấu âm).',
    explanationText: 'Ta có \\(A = 9 - 5 + (-8) = 4 - 8 = -4\\).',
  },
  {
    questionId: 'c03_r3_q4',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Vòng 3 · Giá trị tuyệt đối',
    stem: 'Tìm tổng tất cả các giá trị \\(x\\) thỏa mãn \\(|x - 1| = 4\\).',
    options: [
      { optionId: 'c03_r3_q4_a', labelKey: 'A', text: '\\(2\\)' },
      { optionId: 'c03_r3_q4_b', labelKey: 'B', text: '\\(5\\)' },
      { optionId: 'c03_r3_q4_c', labelKey: 'C', text: '\\(8\\)' },
      { optionId: 'c03_r3_q4_d', labelKey: 'D', text: '\\(-2\\)' },
    ],
    correctOptionId: 'c03_r3_q4_a',
    hintText: 'Xét hai trường hợp \\(x - 1 = 4\\) hoặc \\(x - 1 = -4\\).',
    explanationText: 'Ta được \\(x = 5\\) hoặc \\(x = -3\\). Tổng hai nghiệm là \\(5 + (-3) = 2\\).',
  },
];

export const C03_TIEBREAKER_SAMPLE_QUESTIONS: C03QuestionItem[] = [
  {
    questionId: 'c03_tb_1',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Câu phụ phân hạng 1',
    stem: 'Tìm số nguyên tố chẵn duy nhất trong tập hợp số tự nhiên.',
    options: [
      { optionId: 'c03_tb_1_a', labelKey: 'A', text: '\\(2\\)' },
      { optionId: 'c03_tb_1_b', labelKey: 'B', text: '\\(0\\)' },
      { optionId: 'c03_tb_1_c', labelKey: 'C', text: '\\(4\\)' },
      { optionId: 'c03_tb_1_d', labelKey: 'D', text: '\\(1\\)' },
    ],
    correctOptionId: 'c03_tb_1_a',
    hintText: 'Số nguyên tố chỉ có đúng \\(2\\) ước dương là \\(1\\) và chính nó.',
    explanationText: 'Số \\(2\\) có đúng hai ước dương là \\(1\\) và \\(2\\), đồng thời là số chẵn duy nhất là số nguyên tố.',
  },
  {
    questionId: 'c03_tb_2',
    roundIndex: 2,
    difficultyLabel: 'Vận dụng',
    sourceTag: C03_SAMPLE_BADGE,
    topicLabel: 'Câu phụ phân hạng 2',
    stem: 'Giá trị của biểu thức \\(\\dfrac{\\sqrt{100}}{2^1 + 3}\\) là:',
    options: [
      { optionId: 'c03_tb_2_a', labelKey: 'A', text: '\\(2\\)' },
      { optionId: 'c03_tb_2_b', labelKey: 'B', text: '\\(5\\)' },
      { optionId: 'c03_tb_2_c', labelKey: 'C', text: '\\(10\\)' },
      { optionId: 'c03_tb_2_d', labelKey: 'D', text: '\\(4\\)' },
    ],
    correctOptionId: 'c03_tb_2_a',
    hintText: 'Tính tử \\(\\sqrt{100} = 10\\) và mẫu \\(2 + 3 = 5\\).',
    explanationText: 'Ta có \\(\\dfrac{10}{5} = 2\\).',
  },
];

// ---------------------------------------------------------------------------
// HELPERS: SEEDED SHUFFLE, RBAC ADAPTER, TEAM BUILDER
// ---------------------------------------------------------------------------
export function hashC03Seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleC03Options(
  q: C03QuestionItem,
  seedInput: string
): C03QuestionItem {
  if (q.options.length <= 1) return q;
  const cloned = q.options.map((o) => ({ ...o }));
  let seed = hashC03Seed(`${q.questionId}:${seedInput}`) || 2027;
  for (let i = cloned.length - 1; i > 0; i--) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = cloned[i];
    cloned[i] = cloned[j];
    cloned[j] = tmp;
  }
  return {
    ...q,
    options: cloned.map((opt, idx) => ({
      optionId: opt.optionId,
      labelKey: DISPLAY_KEYS[idx] || String(idx + 1),
      text: opt.text,
    })),
  };
}

export function adaptBankQuestionsForC03(
  bankQuestions: Question[],
  userRole: UserRole
): C03QuestionItem[] {
  const allowed = bankQuestions.filter((q) => {
    if (userRole === 'student' && q.status !== 'approved') return false;
    return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
  });

  // Sort ascending by difficulty (know -> understand -> apply -> high_apply)
  const rankDiff = (lvl: string) => {
    if (lvl === 'know') return 0;
    if (lvl === 'understand') return 1;
    if (lvl === 'apply') return 2;
    return 3;
  };
  const sorted = allowed.slice().sort((a, b) => rankDiff(a.level) - rankDiff(b.level));

  const out: C03QuestionItem[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const q = sorted[i];
    if (seenIds.has(q.id)) continue;
    seenIds.add(q.id);

    const rawOpts = (q.options || []).slice(0, 4);
    const target = String(q.correctAnswer || '').trim();
    const correctIdx = rawOpts.findIndex(
      (opt) => opt.id === target || opt.label === target
    );
    if (correctIdx < 0) continue;

    const mappedOpts: C03OptionItem[] = rawOpts.map((opt, idx) => ({
      optionId: opt.id ? `bank_${q.id}_${opt.id}` : `bank_${q.id}_opt_${idx}`,
      labelKey: DISPLAY_KEYS[idx] || String(idx + 1),
      text: String(opt.text || '').trim() || `Phương án ${DISPLAY_KEYS[idx] || idx + 1}`,
    }));

    const rIdx = Math.min(2, Math.floor(out.length / C03_QUESTIONS_PER_ROUND)) as 0 | 1 | 2;
    const diffLabel = rIdx === 0 ? 'Nhận biết' : rIdx === 1 ? 'Thông hiểu' : 'Vận dụng';

    out.push({
      questionId: `bank_${q.id}`,
      roundIndex: rIdx,
      difficultyLabel: diffLabel,
      sourceTag: 'Ngân hàng Smart EDU',
      topicLabel: `Vòng ${rIdx + 1} · ${q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi'}`,
      stem: String(q.stem || '').trim(),
      image: q.image,
      options: mappedOpts,
      correctOptionId: mappedOpts[correctIdx].optionId,
      hintText: q.lesson
        ? `Gợi ý: xem lại kiến thức "${q.lesson}".`
        : 'Kiểm tra kỹ phép tính và đơn vị.',
      explanationText:
        String(q.explanation || '').trim() ||
        `Đáp án đúng là ${mappedOpts[correctIdx].labelKey}: ${mappedOpts[correctIdx].text}.`,
    });
  }

  return out;
}

export function buildC03Teams(
  participationMode: C03ParticipationMode,
  teamCount: number,
  teamNames: string[] = [],
  classStudents: Array<{ id: string; fullName: string }> = []
): C03TeamItem[] {
  const emptyRow = (): [
    C03TeamOutcomeStatus,
    C03TeamOutcomeStatus,
    C03TeamOutcomeStatus,
    C03TeamOutcomeStatus,
  ] => ['unattempted', 'unattempted', 'unattempted', 'unattempted'];

  if (participationMode === 'solo') {
    return [
      {
        id: 'team_solo',
        name: classStudents.length === 1 ? classStudents[0].fullName : 'Thí sinh Đấu trường',
        color: '#2563EB',
        roundScores: [0, 0, 0],
        roundCorrectCounts: [0, 0, 0],
        roundProgress: [emptyRow(), emptyRow(), emptyRow()],
        mainScore: 0,
        tiebreakerScore: 0,
        studentNames: classStudents.map((s) => s.fullName),
      },
    ];
  }

  const count = Math.max(2, Math.min(6, Math.round(teamCount || 2)));
  const buckets: string[][] = Array.from({ length: count }, () => []);
  classStudents.forEach((student, idx) => {
    buckets[idx % count].push(student.fullName);
  });

  return Array.from({ length: count }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: (teamNames[idx] || '').trim() || DEFAULT_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    color: TEAM_PALETTE[idx % TEAM_PALETTE.length],
    roundScores: [0, 0, 0],
    roundCorrectCounts: [0, 0, 0],
    roundProgress: [emptyRow(), emptyRow(), emptyRow()],
    mainScore: 0,
    tiebreakerScore: 0,
    studentNames: buckets[idx],
  }));
}

export function createDefaultC03SetupConfig(
  overrides: Partial<C03SetupConfig> = {}
): C03SetupConfig {
  return {
    participationMode: 'teams',
    questionSource: 'sample_pack',
    shuffleOptions: true,
    whiteboardHoldMode: false,
    enableTiebreaker: false,
    teamCount: 2,
    teamNames: DEFAULT_TEAM_NAMES.slice(0, 6),
    classStudents: [],
    selectedClassId: '',
    ...overrides,
  };
}

function makeEmptySubmissions(teams: C03TeamItem[]): Record<string, C03TeamSubmission> {
  const rec: Record<string, C03TeamSubmission> = {};
  for (const t of teams) {
    rec[t.id] = {
      teamId: t.id,
      graded: false,
      status: 'unattempted',
      selectedOptionId: null,
      usedHint: false,
      viewedSolution: false,
      pointsAwarded: 0,
    };
  }
  return rec;
}

export function createC03SetupState(
  configOverrides: Partial<C03SetupConfig> = {}
): C03GameState {
  const config = createDefaultC03SetupConfig(configOverrides);
  const teams = buildC03Teams(
    config.participationMode,
    config.teamCount,
    config.teamNames,
    config.classStudents
  );
  return {
    phase: 'setup',
    config,
    deck: [],
    tiebreakerDeck: C03_TIEBREAKER_SAMPLE_QUESTIONS,
    tiebreakerIndex: 0,
    tiebreakerUsedCount: 0,
    currentQuestionIndex: 0,
    currentRoundIndex: 0,
    teams,
    activeTeamCursor: 0,
    turnToken: 'c03_setup',
    isProcessing: false,
    revealAnimDone: false,
    lastActionNotice: 'Cấu hình số đội và nguồn câu hỏi để khai mạc Đấu trường 3 Vòng.',
  };
}

export function startC03Arena(params: {
  config: C03SetupConfig;
  bankQuestions?: Question[];
  userRole?: UserRole;
  nowMs?: number;
  shuffleSeed?: string;
}): { ok: boolean; error?: string; state?: C03GameState } {
  const nowMs = params.nowMs ?? Date.now();
  const seed = params.shuffleSeed ?? String(nowMs);
  const { config } = params;

  let chosenQuestions: C03QuestionItem[];
  if (config.questionSource === 'bank') {
    const adapted = adaptBankQuestionsForC03(
      params.bankQuestions || [],
      params.userRole || 'teacher'
    );
    if (adapted.length < C03_TOTAL_MAIN_QUESTIONS) {
      return {
        ok: false,
        error: `Ngân hàng câu hỏi hiện có ${adapted.length} câu hợp lệ, cần đủ ${C03_TOTAL_MAIN_QUESTIONS} câu cho 3 vòng (4 câu/vòng). Hãy chọn "Gói Toán mẫu C03 (12 câu · Dữ liệu mẫu)" hoặc bổ sung ngân hàng.`,
      };
    }
    chosenQuestions = adapted.slice(0, C03_TOTAL_MAIN_QUESTIONS);
  } else {
    chosenQuestions = C03_SAMPLE_QUESTIONS.slice(0, C03_TOTAL_MAIN_QUESTIONS);
  }

  // Ensure strictly 12 distinct questionIds
  const distinctIds = new Set(chosenQuestions.map((q) => q.questionId));
  if (distinctIds.size !== C03_TOTAL_MAIN_QUESTIONS) {
    return {
      ok: false,
      error: 'Phát hiện câu hỏi trùng lặp trong bộ đề 12 câu.',
    };
  }

  const teams = buildC03Teams(
    config.participationMode,
    config.teamCount,
    config.teamNames,
    config.classStudents
  );

  const deck: C03QuestionProgress[] = chosenQuestions.map((rawQ, idx) => {
    const roundIdx = Math.floor(idx / C03_QUESTIONS_PER_ROUND) as 0 | 1 | 2;
    const qInRound = (idx % C03_QUESTIONS_PER_ROUND) as 0 | 1 | 2 | 3;
    const preparedQ: C03QuestionItem = {
      ...(config.shuffleOptions ? shuffleC03Options(rawQ, seed) : rawQ),
      roundIndex: roundIdx,
    };
    return {
      question: preparedQ,
      roundIndex: roundIdx,
      questionInRoundIndex: qInRound,
      submissions: makeEmptySubmissions(teams),
      hintRevealed: false,
      solutionRevealed: false,
    };
  });

  const tbQuestions = C03_TIEBREAKER_SAMPLE_QUESTIONS.map((q) =>
    config.shuffleOptions ? shuffleC03Options(q, seed) : q
  );

  return {
    ok: true,
    state: {
      phase: 'playing',
      config: { ...config },
      deck,
      tiebreakerDeck: tbQuestions,
      tiebreakerIndex: 0,
      tiebreakerUsedCount: 0,
      currentQuestionIndex: 0,
      currentRoundIndex: 0,
      teams,
      activeTeamCursor: 0,
      turnToken: `c03_q0_${nowMs}`,
      isProcessing: false,
      revealAnimDone: false,
      lastActionNotice: 'Vòng 1 · Câu 1/4 (10 điểm/câu) — Tất cả đội giải cùng đề.',
    },
  };
}

// ---------------------------------------------------------------------------
// HINT, WHITEBOARD HOLD & STRICT PER-(TEAM, QUESTION) GRADING
// ---------------------------------------------------------------------------
export function revealC03Hint(state: C03GameState): C03GameState {
  if (state.phase !== 'playing') return state;
  const qIdx = state.currentQuestionIndex;
  const deck = state.deck.map((item, i) => {
    if (i !== qIdx) return item;
    const nextSubs: Record<string, C03TeamSubmission> = {};
    for (const [tid, sub] of Object.entries(item.submissions)) {
      nextSubs[tid] = sub.graded ? sub : { ...sub, usedHint: true };
    }
    return { ...item, hintRevealed: true, submissions: nextSubs };
  });

  return {
    ...state,
    deck,
    lastActionNotice: 'Đã mở gợi ý hỗ trợ cho câu hiện tại (các đội chưa chấm sẽ ghi nhận Đúng có hỗ trợ nếu trả lời đúng).',
  };
}

export function holdC03TeamWhiteboard(params: {
  state: C03GameState;
  teamId: string;
  optionId: string;
}): C03GameState {
  const { state, teamId, optionId } = params;
  if (state.phase !== 'playing') return state;
  const qIdx = state.currentQuestionIndex;
  const item = state.deck[qIdx];
  const sub = item?.submissions[teamId];
  if (!item || !sub || sub.graded) return state;

  const nextSubs = {
    ...item.submissions,
    [teamId]: {
      ...sub,
      status: 'submitted' as C03TeamOutcomeStatus,
      selectedOptionId: optionId,
    },
  };

  const deck = state.deck.map((d, i) =>
    i === qIdx ? { ...d, submissions: nextSubs } : d
  );

  const teamName = state.teams.find((t) => t.id === teamId)?.name || teamId;
  return {
    ...state,
    deck,
    lastActionNotice: `Đã ghi nhận bảng con của ${teamName} (Trạng thái: Đã nộp, chờ chốt).`,
  };
}

function recomputeTeamTotals(team: C03TeamItem, roundIndex: 0 | 1 | 2, qInRound: 0 | 1 | 2 | 3, sub: C03TeamSubmission): C03TeamItem {
  const nextRoundScores: [number, number, number] = [
    team.roundScores[0],
    team.roundScores[1],
    team.roundScores[2],
  ];
  const nextCorrects: [number, number, number] = [
    team.roundCorrectCounts[0],
    team.roundCorrectCounts[1],
    team.roundCorrectCounts[2],
  ];
  const nextProgress: C03TeamItem['roundProgress'] = [
    [...team.roundProgress[0]] as C03TeamItem['roundProgress'][0],
    [...team.roundProgress[1]] as C03TeamItem['roundProgress'][1],
    [...team.roundProgress[2]] as C03TeamItem['roundProgress'][2],
  ];

  nextRoundScores[roundIndex] += sub.pointsAwarded;
  if (sub.pointsAwarded > 0) {
    nextCorrects[roundIndex] += 1;
  }
  nextProgress[roundIndex][qInRound] = sub.status;

  return {
    ...team,
    roundScores: nextRoundScores,
    roundCorrectCounts: nextCorrects,
    roundProgress: nextProgress,
    mainScore: nextRoundScores[0] + nextRoundScores[1] + nextRoundScores[2],
  };
}

/**
 * Grades ONE (team, currentQuestion) pair.
 * Strictly blocks double-scoring the same (team, question) pair once sub.graded === true!
 */
export function gradeC03TeamAnswer(params: {
  state: C03GameState;
  turnToken: string;
  teamId: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
}): C03GameState {
  const { state, turnToken, teamId } = params;
  if (state.phase !== 'playing' && state.phase !== 'question_revealed') return state;
  if (state.isProcessing || turnToken !== state.turnToken) return state;

  const qIdx = state.currentQuestionIndex;
  const currentQ = state.deck[qIdx];
  if (!currentQ) return state;

  const existingSub = currentQ.submissions[teamId];
  // Strict per-(team, question) idempotency guard: NEVER score twice!
  if (!existingSub || existingSub.graded) {
    return {
      ...state,
      lastActionNotice: `Đội này đã được chấm ở câu ${qIdx + 1} (chống cộng điểm lặp).`,
    };
  }

  const rIdx = currentQ.roundIndex;
  const qInRound = currentQ.questionInRoundIndex;
  const roundPts = getC03RoundPoints(rIdx);

  let isCorrect = false;
  let nextStatus: C03TeamOutcomeStatus = 'wrong';
  let chosenOpt: string | null = existingSub.selectedOptionId;

  if (params.skip) {
    nextStatus = 'skipped';
    chosenOpt = null;
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    nextStatus = isCorrect
      ? existingSub.usedHint
        ? 'correct_with_hint'
        : 'correct_independent'
      : 'wrong';
    chosenOpt = isCorrect ? currentQ.question.correctOptionId : chosenOpt;
  } else if (params.optionId) {
    const opt = currentQ.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    chosenOpt = opt.optionId;
    isCorrect = opt.optionId === currentQ.question.correctOptionId;
    nextStatus = isCorrect
      ? existingSub.usedHint
        ? 'correct_with_hint'
        : 'correct_independent'
      : 'wrong';
  } else {
    return state;
  }

  const awarded = isCorrect ? roundPts : 0;
  const nextSub: C03TeamSubmission = {
    ...existingSub,
    graded: true,
    status: nextStatus,
    selectedOptionId: chosenOpt,
    pointsAwarded: awarded,
  };

  const nextDeck = state.deck.map((item, idx) =>
    idx === qIdx
      ? {
          ...item,
          submissions: { ...item.submissions, [teamId]: nextSub },
        }
      : item
  );

  const nextTeams = state.teams.map((t) =>
    t.id === teamId ? recomputeTeamTotals(t, rIdx, qInRound, nextSub) : t
  );

  const teamName = state.teams.find((t) => t.id === teamId)?.name || teamId;
  const allGraded = Object.values(nextDeck[qIdx].submissions).every((s) => s.graded);
  const nextCursor = state.teams.findIndex(
    (t) => !nextDeck[qIdx].submissions[t.id]?.graded
  );

  return {
    ...state,
    phase: allGraded ? 'question_revealed' : 'playing',
    deck: nextDeck,
    teams: nextTeams,
    activeTeamCursor: nextCursor >= 0 ? nextCursor : state.activeTeamCursor,
    revealAnimDone: allGraded ? false : state.revealAnimDone,
    lastActionNotice: isCorrect
      ? `${teamName}: Chính xác! +${awarded} điểm (Vòng ${rIdx + 1}).`
      : params.skip
        ? `${teamName}: Giáo viên xác nhận bỏ qua (0đ).`
        : `${teamName}: Chưa chính xác (0đ).`,
  };
}

/**
 * Commits all held ('submitted') whiteboard team answers at once, grading every team cleanly.
 */
export function commitAllC03HeldWhiteboards(
  state: C03GameState,
  turnToken: string
): C03GameState {
  if (state.phase !== 'playing' || turnToken !== state.turnToken) return state;
  const currentQ = state.deck[state.currentQuestionIndex];
  if (!currentQ) return state;

  let next = state;
  for (const team of state.teams) {
    const sub = currentQ.submissions[team.id];
    if (!sub || sub.graded) continue;
    if (sub.selectedOptionId) {
      next = gradeC03TeamAnswer({
        state: next,
        turnToken,
        teamId: team.id,
        optionId: sub.selectedOptionId,
      });
    } else {
      next = gradeC03TeamAnswer({
        state: next,
        turnToken,
        teamId: team.id,
        skip: true,
      });
    }
  }
  return next;
}

export function revealC03Solution(state: C03GameState): C03GameState {
  const qIdx = state.currentQuestionIndex;
  const item = state.deck[qIdx];
  if (!item) return state;

  const nextSubs: Record<string, C03TeamSubmission> = {};
  for (const [tid, sub] of Object.entries(item.submissions)) {
    nextSubs[tid] = {
      ...sub,
      viewedSolution: true,
      status: sub.status === 'wrong' ? 'wrong_viewed_solution' : sub.status,
    };
  }

  const deck = state.deck.map((d, i) =>
    i === qIdx ? { ...d, solutionRevealed: true, submissions: nextSubs } : d
  );

  // Sync updated wrong_viewed_solution to team roundProgress
  const teams = state.teams.map((t) => {
    const s = nextSubs[t.id];
    if (!s) return t;
    const nextProgress: C03TeamItem['roundProgress'] = [
      [...t.roundProgress[0]] as C03TeamItem['roundProgress'][0],
      [...t.roundProgress[1]] as C03TeamItem['roundProgress'][1],
      [...t.roundProgress[2]] as C03TeamItem['roundProgress'][2],
    ];
    nextProgress[item.roundIndex][item.questionInRoundIndex] = s.status;
    return { ...t, roundProgress: nextProgress };
  });

  return {
    ...state,
    deck,
    teams,
    lastActionNotice: 'Đã mở lời giải chi tiết câu hiện tại (giữ nguyên điểm gốc đã chấm).',
  };
}

export function canAdvanceFromC03Question(state: C03GameState): boolean {
  const currentQ = state.deck[state.currentQuestionIndex];
  if (!currentQ) return false;
  return state.teams.every((t) => currentQ.submissions[t.id]?.graded === true);
}

/**
 * Advances to next question or round summary ONLY after ALL teams have been graded or confirmed skipped!
 */
export function advanceC03NextQuestion(
  state: C03GameState,
  nowMs = Date.now()
): C03GameState {
  if (state.phase === 'round_summary') {
    const nextRound = (state.currentRoundIndex + 1) as 0 | 1 | 2;
    const nextQIdx = nextRound * C03_QUESTIONS_PER_ROUND;
    return {
      ...state,
      phase: 'playing',
      currentRoundIndex: nextRound,
      currentQuestionIndex: nextQIdx,
      activeTeamCursor: 0,
      turnToken: `c03_q${nextQIdx}_${nowMs}`,
      revealAnimDone: false,
      lastActionNotice: `Khai mạc Vòng ${nextRound + 1} (${getC03RoundPoints(nextRound)} điểm/câu) — Câu 1/4.`,
    };
  }

  if (state.phase !== 'playing' && state.phase !== 'question_revealed') {
    return state;
  }

  if (!canAdvanceFromC03Question(state)) {
    const currentQ = state.deck[state.currentQuestionIndex];
    const pendingTeams = state.teams
      .filter((t) => !currentQ.submissions[t.id]?.graded)
      .map((t) => t.name);
    return {
      ...state,
      lastActionNotice: `Chưa thể chuyển câu: còn đội chưa chấm hoặc chưa xác nhận bỏ qua (${pendingTeams.join(', ')}).`,
    };
  }

  const qIdx = state.currentQuestionIndex;
  const currentQ = state.deck[qIdx];
  const isEndOfRound = currentQ.questionInRoundIndex === C03_QUESTIONS_PER_ROUND - 1;

  if (isEndOfRound) {
    if (currentQ.roundIndex < 2) {
      return {
        ...state,
        phase: 'round_summary',
        revealAnimDone: true,
        lastActionNotice: `Hoàn thành Vòng ${currentQ.roundIndex + 1}! Kiểm tra tổng điểm vòng trước khi bước vào Vòng ${currentQ.roundIndex + 2}.`,
      };
    }
    return finishC03ToSummary(state);
  }

  const nextIdx = qIdx + 1;
  return {
    ...state,
    phase: 'playing',
    currentQuestionIndex: nextIdx,
    activeTeamCursor: 0,
    turnToken: `c03_q${nextIdx}_${nowMs}`,
    revealAnimDone: false,
    lastActionNotice: `Vòng ${currentQ.roundIndex + 1} · Câu ${currentQ.questionInRoundIndex + 2}/4 (${getC03RoundPoints(currentQ.roundIndex)} điểm/câu).`,
  };
}

export function gradeC03TiebreakerTeam(params: {
  state: C03GameState;
  teamId: string;
  isCorrect: boolean;
}): C03GameState {
  if (stateNotReadyForTiebreaker(params.state)) return params.state;
  const teams = params.state.teams.map((t) =>
    t.id === params.teamId && params.isCorrect
      ? { ...t, tiebreakerScore: t.tiebreakerScore + 1 }
      : t
  );
  return {
    ...params.state,
    teams,
    tiebreakerUsedCount: params.state.tiebreakerUsedCount + 1,
    lastActionNotice: params.isCorrect
      ? `Câu phụ: ghi nhận +1 điểm phân hạng cho ${params.state.teams.find((t) => t.id === params.teamId)?.name || ''}.`
      : 'Câu phụ: ghi nhận chưa đúng.',
  };
}

function stateNotReadyForTiebreaker(state: C03GameState): boolean {
  return !state.config.enableTiebreaker || (state.phase !== 'tiebreaker' && state.phase !== 'summary');
}

export function skipC03RevealAnimation(state: C03GameState): C03GameState {
  return {
    ...state,
    revealAnimDone: true,
  };
}

export function finishC03ToSummary(state: C03GameState): C03GameState {
  return {
    ...state,
    phase: 'summary',
    revealAnimDone: true,
    lastActionNotice: 'Đã hoàn thành Đấu trường Kiến thức 3D (3 vòng · 12 câu).',
  };
}

/**
 * Ranks teams cleanly. If tiebreaker is NOT used and scores match,
 * teams strictly share the SAME rank (e.g. 1, 1, 3).
 */
export function computeC03Rankings(teams: C03TeamItem[], tiebreakerActive: boolean): C03RankedTeam[] {
  const sorted = teams.slice().sort((a, b) => {
    if (b.mainScore !== a.mainScore) return b.mainScore - a.mainScore;
    if (tiebreakerActive && b.tiebreakerScore !== a.tiebreakerScore) {
      return b.tiebreakerScore - a.tiebreakerScore;
    }
    return 0;
  });

  const out: C03RankedTeam[] = [];
  let prevRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const sameScore =
        t.mainScore === prev.mainScore &&
        (!tiebreakerActive || t.tiebreakerScore === prev.tiebreakerScore);
      prevRank = sameScore ? prevRank : i + 1;
    }
    out.push({
      teamId: t.id,
      name: t.name,
      color: t.color,
      rank: prevRank,
      mainScore: t.mainScore,
      tiebreakerScore: t.tiebreakerScore,
      roundScores: t.roundScores,
      roundCorrectCounts: t.roundCorrectCounts,
      totalCorrect:
        t.roundCorrectCounts[0] + t.roundCorrectCounts[1] + t.roundCorrectCounts[2],
    });
  }
  return out;
}

export function computeC03Summary(state: C03GameState): C03SummaryStats {
  const rankings = computeC03Rankings(
    state.teams,
    state.config.enableTiebreaker && state.tiebreakerUsedCount > 0
  );
  const topRankCount = rankings.filter((r) => r.rank === 1).length;

  let completedMainQuestions = 0;
  let independentCount = 0;
  let assistedCount = 0;
  let viewedSolutionCount = 0;
  let skippedCount = 0;
  let wrongCount = 0;

  for (const item of state.deck) {
    const subs = Object.values(item.submissions);
    if (subs.some((s) => s.graded)) completedMainQuestions += 1;
    for (const s of subs) {
      switch (s.status) {
        case 'correct_independent':
          independentCount += 1;
          break;
        case 'correct_with_hint':
          assistedCount += 1;
          break;
        case 'wrong_viewed_solution':
          viewedSolutionCount += 1;
          break;
        case 'wrong':
          wrongCount += 1;
          break;
        case 'skipped':
          skippedCount += 1;
          break;
        default:
          break;
      }
    }
  }

  const roundTotals = ([0, 1, 2] as const).map((rIdx) => {
    const topTeamScore = Math.max(0, ...state.teams.map((t) => t.roundScores[rIdx]));
    const topTeamCorrectCount = Math.max(
      0,
      ...state.teams.map((t) => t.roundCorrectCounts[rIdx])
    );
    return {
      roundNumber: (rIdx + 1) as 1 | 2 | 3,
      pointsPerQuestion: C03_ROUND_POINTS[rIdx],
      maxRoundScore: C03_MAX_ROUND_SCORES[rIdx],
      topTeamScore,
      topTeamCorrectCount,
    };
  });

  return {
    completedMainQuestions,
    roundTotals,
    rankings,
    isTieAtTop: topRankCount > 1,
    tiebreakerUsed: state.tiebreakerUsedCount > 0,
    independentCount,
    assistedCount,
    viewedSolutionCount,
    skippedCount,
    wrongCount,
  };
}

// ---------------------------------------------------------------------------
// DEMO-ISOLATED SESSION PERSISTENCE
// ---------------------------------------------------------------------------
interface PersistedC03Payload {
  version: 1;
  savedAtMs: number;
  state: C03GameState;
}

export function saveC03Session(state: C03GameState, nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload: PersistedC03Payload = {
      version: 1,
      savedAtMs: nowMs,
      state,
    };
    window.localStorage.setItem(getC03SessionStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadC03Session(): C03GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getC03SessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedC03Payload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.deck) ||
      !Array.isArray(parsed.state.teams)
    ) {
      clearC03Session();
      return null;
    }
    return parsed.state;
  } catch {
    clearC03Session();
    return null;
  }
}

export function clearC03Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getC03SessionStorageKey());
  } catch {
    // Ignore cleanly
  }
}
