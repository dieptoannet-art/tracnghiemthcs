import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const C09_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const C09_QUESTION_POINTS = 10;
export const C09_BINGO_BONUS_POINTS = 30;

export type C09BoardSize = '3x3' | '4x4' | '5x5';
export type C09ParticipationMode = 'solo' | 'class_cards';
export type C09QuestionSource = 'sample_pack' | 'bank';
export type C09GraphicsQuality = 'high' | '2d';

export type C09Phase =
  | 'setup'
  | 'playing'
  | 'question_revealed'
  | 'bingo_check'
  | 'summary';

export type C09QuestionStatus = 'unasked' | 'open' | 'submitted' | 'published' | 'skipped';
export type C09OutcomeStatus =
  | 'unattempted'
  | 'submitted'
  | 'correct_independent'
  | 'correct_with_hint'
  | 'wrong'
  | 'wrong_viewed_solution'
  | 'skipped';

export interface C09WinPatternConfig {
  allowRows: boolean;
  allowCols: boolean;
  allowDiagonals: boolean;
}

export interface C09OptionItem {
  optionId: string;
  labelKey: string;
  text: string;
}

export interface C09QuestionItem {
  questionId: string;
  answerId: string;
  answerText: string; // Supports KaTeX e.g. \(4\)
  answerPlainText: string; // Crisp B&W print text fallback e.g. 4
  sourceTag: 'Dữ liệu mẫu' | 'Ngân hàng Smart EDU';
  topicLabel: string;
  stem: string;
  image?: string;
  options: C09OptionItem[];
  correctOptionId: string;
  hintText: string;
  explanationText: string;
}

export interface C09CardSubmission {
  cardId: string;
  cardLabel: string;
  selectedOptionId: string | null;
  teacherConfirmCorrect: boolean | null;
}

export interface C09QuestionProgress {
  question: C09QuestionItem;
  status: C09QuestionStatus;
  outcome: C09OutcomeStatus;
  selectedOptionId: string | null;
  usedHint: boolean;
  viewedSolution: boolean;
  pointsAwarded: number;
  cardSubmissions: Record<string, C09CardSubmission>;
}

export interface C09CardCell {
  cellIndex: number;
  row: number;
  col: number;
  answerId: string | null; // null only for Free Center cell on odd grids
  answerText: string;
  answerPlainText: string;
  isFreeCenter: boolean;
  marked: boolean; // Player/teacher mark on grid
}

export interface C09BingoCard {
  cardId: string;
  cardNumber: number; // 1..50
  holderLabel: string; // e.g. "Phiếu #01 · Đội 1" or "Phiếu #01 · Nguyễn An"
  cells: C09CardCell[];
  hasVerifiedBingo: boolean;
  winningLineLabels: string[];
  score: number;
}

export interface C09WinningLine {
  lineId: string;
  kind: 'row' | 'col' | 'diagonal';
  label: string;
  cellIndices: number[];
}

export interface C09BingoClaimResult {
  cardId: string;
  cardNumber: number;
  holderLabel: string;
  valid: boolean;
  matchedLineLabels: string[];
  prematureCells: Array<{ cellIndex: number; answerId: string; answerPlainText: string }>;
  reasonText: string;
}

export interface C09SetupConfig {
  boardSize: C09BoardSize;
  participationMode: C09ParticipationMode;
  questionSource: C09QuestionSource;
  topicFilter: 'all' | 'algebra' | 'geometry' | 'statistics';
  freeCenterEnabled: boolean; // Strictly honored only on odd sizes (3x3, 5x5)
  winPatterns: C09WinPatternConfig;
  shuffleOptions: boolean;
  whiteboardHoldMode: boolean; // Hold 'Đã nộp' before teacher publishes answer
  cardCount: number; // 1..50 printed/class cards
  teamNames: string[];
  classStudents: Array<{ id: string; fullName: string }>;
  selectedClassId: string;
}

export interface C09GameState {
  phase: C09Phase;
  config: C09SetupConfig;
  dimension: 3 | 4 | 5;
  centerFreeActive: boolean;
  deck: C09QuestionProgress[];
  activeQuestionIndex: number | null;
  publishedAnswerIds: string[];
  cards: C09BingoCard[];
  focusedCardIndex: number;
  verifiedWinners: Array<{
    cardId: string;
    cardNumber: number;
    holderLabel: string;
    lineLabels: string[];
    turnQuestionIndex: number;
  }>;
  lastVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
  lastClaimResults: C09BingoClaimResult[];
  turnToken: string;
  isProcessing: boolean;
  revealAnimDone: boolean;
  activeHintRevealed: boolean;
  totalQuestionScore: number;
  lastActionNotice: string;
}

export interface C09SummaryStats {
  totalOpened: number;
  publishedCount: number;
  independentCorrectCount: number;
  assistedCorrectCount: number;
  viewedSolutionCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestionScore: number;
  verifiedWinnerCount: number;
  isCoWinners: boolean;
  winnerLabels: string[];
  totalClassOrSoloScore: number;
}

export interface C09PrintableCardCellSpec {
  row: number;
  col: number;
  codeBadge: string; // Clear monochrome print token e.g. [A1] or [★]
  primaryText: string; // Plain text crisp for B&W laser print
  mathText: string;
  isFreeCenter: boolean;
  bwPatternLabel: string;
}

export interface C09PrintableCardSpec {
  cardId: string;
  cardNumber: number;
  holderLabel: string;
  dimension: 3 | 4 | 5;
  ruleSummary: string;
  cells: C09PrintableCardCellSpec[];
}

const DISPLAY_KEYS = ['A', 'B', 'C', 'D'] as const;

export const C09_SESSION_BASE_KEY = 'taydo_c09_bingo_knowledge_3d_session_v1';

export function getC09SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${C09_SESSION_BASE_KEY}`
    : C09_SESSION_BASE_KEY;
}

export function getC09BoardDimension(size: C09BoardSize): 3 | 4 | 5 {
  if (size === '3x3') return 3;
  if (size === '4x4') return 4;
  return 5;
}

/**
 * Free Center cell is strictly allowed ONLY on odd grids (3x3, 5x5).
 * Even grid (4x4) ALWAYS returns false.
 */
export function canHaveC09FreeCenter(size: C09BoardSize): boolean {
  return size === '3x3' || size === '5x5';
}

export function getC09FreeCenterIndex(size: C09BoardSize): number | null {
  if (!canHaveC09FreeCenter(size)) return null;
  const d = getC09BoardDimension(size);
  return Math.floor((d * d) / 2);
}

export function getC09RequiredPoolSize(
  size: C09BoardSize,
  freeCenterEnabled: boolean
): number {
  const d = getC09BoardDimension(size);
  const centerActive = freeCenterEnabled && canHaveC09FreeCenter(size);
  return d * d - (centerActive ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 25 UNIQUE MATH SAMPLE QUESTIONS (every answerId strictly distinct)
// First 3 correspond directly to Prompt §5: 2^2 = 4, sqrt(49) = 7, 3^2 = 9
// ---------------------------------------------------------------------------
export const C09_SAMPLE_QUESTIONS: C09QuestionItem[] = [
  {
    questionId: 'c09_q_pow2',
    answerId: 'ans_4',
    answerText: '\\(4\\)',
    answerPlainText: '4',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Lũy thừa',
    stem: 'Tính giá trị biểu thức: \\(2^2\\).',
    options: [
      { optionId: 'c09_q_pow2_a', labelKey: 'A', text: '\\(4\\)' },
      { optionId: 'c09_q_pow2_b', labelKey: 'B', text: '\\(2\\)' },
      { optionId: 'c09_q_pow2_c', labelKey: 'C', text: '\\(6\\)' },
      { optionId: 'c09_q_pow2_d', labelKey: 'D', text: '\\(8\\)' },
    ],
    correctOptionId: 'c09_q_pow2_a',
    hintText: '\\(2^2\\) là tích của \\(2\\) thừa số bằng \\(2\\).',
    explanationText: 'Ta có \\(2^2 = 2 \\times 2 = 4\\) (không phải \\(2 + 2 = 4\\) theo thói quen nhầm phép cộng khi mũ khác 2).',
  },
  {
    questionId: 'c09_q_sqrt49',
    answerId: 'ans_7',
    answerText: '\\(7\\)',
    answerPlainText: '7',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Căn bậc hai',
    stem: 'Tính giá trị căn bậc hai số học: \\(\\sqrt{49}\\).',
    options: [
      { optionId: 'c09_q_sqrt49_a', labelKey: 'A', text: '\\(7\\)' },
      { optionId: 'c09_q_sqrt49_b', labelKey: 'B', text: '\\(24{,}5\\)' },
      { optionId: 'c09_q_sqrt49_c', labelKey: 'C', text: '\\(14\\)' },
      { optionId: 'c09_q_sqrt49_d', labelKey: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'c09_q_sqrt49_a',
    hintText: 'Tìm số không âm có bình phương bằng \\(49\\).',
    explanationText: 'Vì \\(7 > 0\\) và \\(7^2 = 49\\) nên \\(\\sqrt{49} = 7\\).',
  },
  {
    questionId: 'c09_q_pow3',
    answerId: 'ans_9',
    answerText: '\\(9\\)',
    answerPlainText: '9',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Lũy thừa',
    stem: 'Tính giá trị biểu thức: \\(3^2\\).',
    options: [
      { optionId: 'c09_q_pow3_a', labelKey: 'A', text: '\\(9\\)' },
      { optionId: 'c09_q_pow3_b', labelKey: 'B', text: '\\(6\\)' },
      { optionId: 'c09_q_pow3_c', labelKey: 'C', text: '\\(8\\)' },
      { optionId: 'c09_q_pow3_d', labelKey: 'D', text: '\\(27\\)' },
    ],
    correctOptionId: 'c09_q_pow3_a',
    hintText: 'Lũy thừa bậc hai của \\(3\\) bằng \\(3 \\times 3\\).',
    explanationText: 'Ta có \\(3^2 = 3 \\times 3 = 9\\). Lưu ý phản ví dụ sai thường gặp: \\(3 \\times 2 = 6\\) (nhầm nhân cơ số với số mũ).',
  },
  {
    questionId: 'c09_q_frac_add',
    answerId: 'ans_5_6',
    answerText: '\\(\\dfrac{5}{6}\\)',
    answerPlainText: '5/6',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Phân số',
    stem: 'Tính tổng hai phân số: \\(\\dfrac{1}{2} + \\dfrac{1}{3}\\).',
    options: [
      { optionId: 'c09_q_frac_add_a', labelKey: 'A', text: '\\(\\dfrac{5}{6}\\)' },
      { optionId: 'c09_q_frac_add_b', labelKey: 'B', text: '\\(\\dfrac{2}{5}\\)' },
      { optionId: 'c09_q_frac_add_c', labelKey: 'C', text: '\\(\\dfrac{1}{6}\\)' },
      { optionId: 'c09_q_frac_add_d', labelKey: 'D', text: '\\(\\dfrac{2}{3}\\)' },
    ],
    correctOptionId: 'c09_q_frac_add_a',
    hintText: 'Quy đồng hai phân số về mẫu chung \\(6\\).',
    explanationText: 'Ta có \\(\\dfrac{1}{2} + \\dfrac{1}{3} = \\dfrac{3}{6} + \\dfrac{2}{6} = \\dfrac{5}{6}\\).',
  },
  {
    questionId: 'c09_q_neg',
    answerId: 'ans_neg_5',
    answerText: '\\(-5\\)',
    answerPlainText: '-5',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Số nguyên âm',
    stem: 'Tính giá trị: \\((-12) + 7\\).',
    options: [
      { optionId: 'c09_q_neg_a', labelKey: 'A', text: '\\(-5\\)' },
      { optionId: 'c09_q_neg_b', labelKey: 'B', text: '\\(5\\)' },
      { optionId: 'c09_q_neg_c', labelKey: 'C', text: '\\(-19\\)' },
      { optionId: 'c09_q_neg_d', labelKey: 'D', text: '\\(19\\)' },
    ],
    correctOptionId: 'c09_q_neg_a',
    hintText: 'Cộng hai số nguyên trái dấu: lấy giá trị tuyệt đối lớn trừ nhỏ và đặt dấu của số có giá trị tuyệt đối lớn hơn.',
    explanationText: 'Ta có \\((-12) + 7 = -(12 - 7) = -5\\).',
  },
  {
    questionId: 'c09_q_rect24',
    answerId: 'ans_24',
    answerText: '\\(24\\)',
    answerPlainText: '24',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Diện tích',
    stem: 'Hình chữ nhật có chiều dài \\(6\\text{ cm}\\) và chiều rộng \\(4\\text{ cm}\\) có diện tích (theo \\(\\text{cm}^2\\)) là:',
    options: [
      { optionId: 'c09_q_rect24_a', labelKey: 'A', text: '\\(24\\)' },
      { optionId: 'c09_q_rect24_b', labelKey: 'B', text: '\\(20\\)' },
      { optionId: 'c09_q_rect24_c', labelKey: 'C', text: '\\(10\\)' },
      { optionId: 'c09_q_rect24_d', labelKey: 'D', text: '\\(12\\)' },
    ],
    correctOptionId: 'c09_q_rect24_a',
    hintText: 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng.',
    explanationText: 'Diện tích là \\(S = 6 \\times 4 = 24\\text{ cm}^2\\).',
  },
  {
    questionId: 'c09_q_tri60',
    answerId: 'ans_60deg',
    answerText: '\\(60^\\circ\\)',
    answerPlainText: '60°',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Góc tam giác',
    stem: 'Tam giác \\(ABC\\) có \\(\\widehat{A} = 50^\\circ\\), \\(\\widehat{B} = 70^\\circ\\). Số đo góc \\(\\widehat{C}\\) là:',
    options: [
      { optionId: 'c09_q_tri60_a', labelKey: 'A', text: '\\(60^\\circ\\)' },
      { optionId: 'c09_q_tri60_b', labelKey: 'B', text: '\\(120^\\circ\\)' },
      { optionId: 'c09_q_tri60_c', labelKey: 'C', text: '\\(40^\\circ\\)' },
      { optionId: 'c09_q_tri60_d', labelKey: 'D', text: '\\(80^\\circ\\)' },
    ],
    correctOptionId: 'c09_q_tri60_a',
    hintText: 'Tổng ba góc trong tam giác bằng \\(180^\\circ\\).',
    explanationText: 'Ta có \\(\\widehat{C} = 180^\\circ - (50^\\circ + 70^\\circ) = 60^\\circ\\).',
  },
  {
    questionId: 'c09_q_mean8',
    answerId: 'ans_8',
    answerText: '\\(8\\)',
    answerPlainText: '8',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Thống kê — Trung bình cộng',
    stem: 'Tìm số trung bình cộng của dãy số liệu: \\(6; 8; 10; 8\\).',
    options: [
      { optionId: 'c09_q_mean8_a', labelKey: 'A', text: '\\(8\\)' },
      { optionId: 'c09_q_mean8_b', labelKey: 'B', text: '\\(32\\)' },
      { optionId: 'c09_q_mean8_c', labelKey: 'C', text: '\\(7\\)' },
      { optionId: 'c09_q_mean8_d', labelKey: 'D', text: '\\(9\\)' },
    ],
    correctOptionId: 'c09_q_mean8_a',
    hintText: 'Chia tổng các số cho số phần tử (4 phần tử).',
    explanationText: 'Trung bình cộng là \\(\\dfrac{6 + 8 + 10 + 8}{4} = \\dfrac{32}{4} = 8\\).',
  },
  {
    questionId: 'c09_q_prob3_8',
    answerId: 'ans_3_8',
    answerText: '\\(\\dfrac{3}{8}\\)',
    answerPlainText: '3/8',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Thống kê — Xác suất',
    stem: 'Hộp có \\(3\\) thẻ xanh và \\(5\\) thẻ đỏ. Rút ngẫu nhiên \\(1\\) thẻ, xác suất rút được thẻ xanh là:',
    options: [
      { optionId: 'c09_q_prob3_8_a', labelKey: 'A', text: '\\(\\dfrac{3}{8}\\)' },
      { optionId: 'c09_q_prob3_8_b', labelKey: 'B', text: '\\(\\dfrac{3}{5}\\)' },
      { optionId: 'c09_q_prob3_8_c', labelKey: 'C', text: '\\(\\dfrac{5}{8}\\)' },
      { optionId: 'c09_q_prob3_8_d', labelKey: 'D', text: '\\(\\dfrac{1}{8}\\)' },
    ],
    correctOptionId: 'c09_q_prob3_8_a',
    hintText: 'Tổng số thẻ trong hộp là \\(3 + 5 = 8\\).',
    explanationText: 'Xác suất là tỉ số kết quả thuận lợi trên tổng số kết quả đồng khả năng: \\(\\dfrac{3}{3+5} = \\dfrac{3}{8}\\).',
  },
  {
    questionId: 'c09_q_eq11',
    answerId: 'ans_11',
    answerText: '\\(11\\)',
    answerPlainText: '11',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Tìm x',
    stem: 'Tìm \\(x\\) biết: \\(2x - 5 = 17\\).',
    options: [
      { optionId: 'c09_q_eq11_a', labelKey: 'A', text: '\\(11\\)' },
      { optionId: 'c09_q_eq11_b', labelKey: 'B', text: '\\(6\\)' },
      { optionId: 'c09_q_eq11_c', labelKey: 'C', text: '\\(22\\)' },
      { optionId: 'c09_q_eq11_d', labelKey: 'D', text: '\\(12\\)' },
    ],
    correctOptionId: 'c09_q_eq11_a',
    hintText: 'Cộng cả hai vế với \\(5\\) trước, rồi chia cho \\(2\\).',
    explanationText: 'Ta có \\(2x = 17 + 5 = 22 \\Rightarrow x = \\dfrac{22}{2} = 11\\).',
  },
  {
    questionId: 'c09_q_perim28',
    answerId: 'ans_28',
    answerText: '\\(28\\)',
    answerPlainText: '28',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Chu vi hình vuông',
    stem: 'Một hình vuông có diện tích \\(49\\text{ cm}^2\\). Chu vi của hình vuông (theo \\(\\text{cm}\\)) là:',
    options: [
      { optionId: 'c09_q_perim28_a', labelKey: 'A', text: '\\(28\\)' },
      { optionId: 'c09_q_perim28_b', labelKey: 'B', text: '\\(14\\)' },
      { optionId: 'c09_q_perim28_c', labelKey: 'C', text: '\\(49\\)' },
      { optionId: 'c09_q_perim28_d', labelKey: 'D', text: '\\(21\\)' },
    ],
    correctOptionId: 'c09_q_perim28_a',
    hintText: 'Tìm cạnh hình vuông \\(a = \\sqrt{49}\\), sau đó tính chu vi \\(4a\\).',
    explanationText: 'Cạnh hình vuông là \\(7\\text{ cm}\\), chu vi là \\(4 \\times 7 = 28\\text{ cm}\\).',
  },
  {
    questionId: 'c09_q_pow3cube',
    answerId: 'ans_27',
    answerText: '\\(27\\)',
    answerPlainText: '27',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Lũy thừa',
    stem: 'Giá trị của \\(3^3\\) là:',
    options: [
      { optionId: 'c09_q_pow3cube_a', labelKey: 'A', text: '\\(27\\)' },
      { optionId: 'c09_q_pow3cube_b', labelKey: 'B', text: '\\(9\\)' },
      { optionId: 'c09_q_pow3cube_c', labelKey: 'C', text: '\\(12\\)' },
      { optionId: 'c09_q_pow3cube_d', labelKey: 'D', text: '\\(81\\)' },
    ],
    correctOptionId: 'c09_q_pow3cube_a',
    hintText: '\\(3^3 = 3 \\times 3 \\times 3\\).',
    explanationText: 'Ta có \\(3^3 = 3 \\times 3 \\times 3 = 27\\).',
  },
  {
    questionId: 'c09_q_frac_mul',
    answerId: 'ans_neg_2_3',
    answerText: '\\(-\\dfrac{2}{3}\\)',
    answerPlainText: '-2/3',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Phân số âm',
    stem: 'Rút gọn tích: \\(\\left(-\\dfrac{3}{4}\\right) \\cdot \\dfrac{8}{9}\\).',
    options: [
      { optionId: 'c09_q_frac_mul_a', labelKey: 'A', text: '\\(-\\dfrac{2}{3}\\)' },
      { optionId: 'c09_q_frac_mul_b', labelKey: 'B', text: '\\(\\dfrac{2}{3}\\)' },
      { optionId: 'c09_q_frac_mul_c', labelKey: 'C', text: '\\(-\\dfrac{24}{13}\\)' },
      { optionId: 'c09_q_frac_mul_d', labelKey: 'D', text: '\\(-\\dfrac{3}{2}\\)' },
    ],
    correctOptionId: 'c09_q_frac_mul_a',
    hintText: 'Tích số âm và số dương mang dấu âm; rút gọn chéo \\(8\\) với \\(4\\).',
    explanationText: 'Ta có \\(\\left(-\\dfrac{3}{4}\\right) \\cdot \\dfrac{8}{9} = -\\dfrac{24}{36} = -\\dfrac{2}{3}\\).',
  },
  {
    questionId: 'c09_q_mode3',
    answerId: 'ans_3',
    answerText: '\\(3\\)',
    answerPlainText: '3',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Thống kê — Mốt',
    stem: 'Tìm Mốt của dãy số liệu: \\(2; 3; 5; 3; 4; 3; 2\\).',
    options: [
      { optionId: 'c09_q_mode3_a', labelKey: 'A', text: '\\(3\\)' },
      { optionId: 'c09_q_mode3_b', labelKey: 'B', text: '\\(2\\)' },
      { optionId: 'c09_q_mode3_c', labelKey: 'C', text: '\\(5\\)' },
      { optionId: 'c09_q_mode3_d', labelKey: 'D', text: '\\(4\\)' },
    ],
    correctOptionId: 'c09_q_mode3_a',
    hintText: 'Mốt là giá trị xuất hiện nhiều lần nhất.',
    explanationText: 'Giá trị \\(3\\) xuất hiện \\(3\\) lần (nhiều nhất), nên Mốt bằng \\(3\\).',
  },
  {
    questionId: 'c09_q_sqrt144',
    answerId: 'ans_12',
    answerText: '\\(12\\)',
    answerPlainText: '12',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Căn bậc hai',
    stem: 'Giá trị của \\(\\sqrt{144}\\) là:',
    options: [
      { optionId: 'c09_q_sqrt144_a', labelKey: 'A', text: '\\(12\\)' },
      { optionId: 'c09_q_sqrt144_b', labelKey: 'B', text: '\\(72\\)' },
      { optionId: 'c09_q_sqrt144_c', labelKey: 'C', text: '\\(14\\)' },
      { optionId: 'c09_q_sqrt144_d', labelKey: 'D', text: '\\(11\\)' },
    ],
    correctOptionId: 'c09_q_sqrt144_a',
    hintText: 'Tìm số dương có bình phương bằng \\(144\\).',
    explanationText: 'Vì \\(12^2 = 144\\) nên \\(\\sqrt{144} = 12\\).',
  },
  {
    questionId: 'c09_q_tri_area15',
    answerId: 'ans_15',
    answerText: '\\(15\\)',
    answerPlainText: '15',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Diện tích tam giác',
    stem: 'Tam giác có đáy \\(6\\text{ cm}\\) và chiều cao tương ứng \\(5\\text{ cm}\\). Diện tích (theo \\(\\text{cm}^2\\)) bằng:',
    options: [
      { optionId: 'c09_q_tri_area15_a', labelKey: 'A', text: '\\(15\\)' },
      { optionId: 'c09_q_tri_area15_b', labelKey: 'B', text: '\\(30\\)' },
      { optionId: 'c09_q_tri_area15_c', labelKey: 'C', text: '\\(11\\)' },
      { optionId: 'c09_q_tri_area15_d', labelKey: 'D', text: '\\(20\\)' },
    ],
    correctOptionId: 'c09_q_tri_area15_a',
    hintText: 'Công thức diện tích tam giác là \\(\\dfrac{1}{2} \\times \\text{đáy} \\times \\text{cao}\\).',
    explanationText: 'Diện tích bằng \\(\\dfrac{6 \\times 5}{2} = 15\\text{ cm}^2\\).',
  },
  {
    questionId: 'c09_q_sup115',
    answerId: 'ans_115deg',
    answerText: '\\(115^\\circ\\)',
    answerPlainText: '115°',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Hai góc kề bù',
    stem: 'Hai góc \\(\\widehat{xOy}\\) và \\(\\widehat{yOz}\\) kề bù. Biết \\(\\widehat{xOy} = 65^\\circ\\), số đo \\(\\widehat{yOz}\\) là:',
    options: [
      { optionId: 'c09_q_sup115_a', labelKey: 'A', text: '\\(115^\\circ\\)' },
      { optionId: 'c09_q_sup115_b', labelKey: 'B', text: '\\(25^\\circ\\)' },
      { optionId: 'c09_q_sup115_c', labelKey: 'C', text: '\\(125^\\circ\\)' },
      { optionId: 'c09_q_sup115_d', labelKey: 'D', text: '\\(90^\\circ\\)' },
    ],
    correctOptionId: 'c09_q_sup115_a',
    hintText: 'Hai góc kề bù có tổng số đo bằng \\(180^\\circ\\).',
    explanationText: 'Ta có \\(\\widehat{yOz} = 180^\\circ - 65^\\circ = 115^\\circ\\).',
  },
  {
    questionId: 'c09_q_gcd6',
    answerId: 'ans_6',
    answerText: '\\(6\\)',
    answerPlainText: '6',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — ƯCLN',
    stem: 'Tìm ƯCLN\\((18, 24)\\).',
    options: [
      { optionId: 'c09_q_gcd6_a', labelKey: 'A', text: '\\(6\\)' },
      { optionId: 'c09_q_gcd6_b', labelKey: 'B', text: '\\(12\\)' },
      { optionId: 'c09_q_gcd6_c', labelKey: 'C', text: '\\(3\\)' },
      { optionId: 'c09_q_gcd6_d', labelKey: 'D', text: '\\(72\\)' },
    ],
    correctOptionId: 'c09_q_gcd6_a',
    hintText: 'Phân tích \\(18 = 2 \\cdot 3^2\\) và \\(24 = 2^3 \\cdot 3\\).',
    explanationText: 'ƯCLN\\((18, 24) = 2 \\cdot 3 = 6\\).',
  },
  {
    questionId: 'c09_q_pow2_4',
    answerId: 'ans_16',
    answerText: '\\(16\\)',
    answerPlainText: '16',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Lũy thừa',
    stem: 'Tính giá trị: \\(2^4\\).',
    options: [
      { optionId: 'c09_q_pow2_4_a', labelKey: 'A', text: '\\(16\\)' },
      { optionId: 'c09_q_pow2_4_b', labelKey: 'B', text: '\\(8\\)' },
      { optionId: 'c09_q_pow2_4_c', labelKey: 'C', text: '\\(12\\)' },
      { optionId: 'c09_q_pow2_4_d', labelKey: 'D', text: '\\(32\\)' },
    ],
    correctOptionId: 'c09_q_pow2_4_a',
    hintText: '\\(2^4 = 2 \\times 2 \\times 2 \\times 2\\).',
    explanationText: 'Ta có \\(2^4 = 16\\).',
  },
  {
    questionId: 'c09_q_pct25',
    answerId: 'ans_25',
    answerText: '\\(25\\)',
    answerPlainText: '25',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Tỉ số phần trăm',
    stem: 'Tìm \\(25\\%\\) của \\(100\\).',
    options: [
      { optionId: 'c09_q_pct25_a', labelKey: 'A', text: '\\(25\\)' },
      { optionId: 'c09_q_pct25_b', labelKey: 'B', text: '\\(4\\)' },
      { optionId: 'c09_q_pct25_c', labelKey: 'C', text: '\\(50\\)' },
      { optionId: 'c09_q_pct25_d', labelKey: 'D', text: '\\(75\\)' },
    ],
    correctOptionId: 'c09_q_pct25_a',
    hintText: '\\(25\\% = \\dfrac{25}{100}\\).',
    explanationText: 'Ta có \\(100 \\cdot \\dfrac{25}{100} = 25\\).',
  },
  {
    questionId: 'c09_q_neg_pow9_neg',
    answerId: 'ans_neg_9',
    answerText: '\\(-9\\)',
    answerPlainText: '-9',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Thứ tự thực hiện phép tính',
    stem: 'Tính giá trị: \\(-3^2\\).',
    options: [
      { optionId: 'c09_q_neg_pow9_neg_a', labelKey: 'A', text: '\\(-9\\)' },
      { optionId: 'c09_q_neg_pow9_neg_b', labelKey: 'B', text: '\\(9\\)' },
      { optionId: 'c09_q_neg_pow9_neg_c', labelKey: 'C', text: '\\(-6\\)' },
      { optionId: 'c09_q_neg_pow9_neg_d', labelKey: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'c09_q_neg_pow9_neg_a',
    hintText: 'Không có dấu ngoặc quanh \\(-3\\), nên tính lũy thừa \\(3^2\\) trước rồi lấy dấu âm.',
    explanationText: 'Ta có \\(-3^2 = -(3^2) = -9\\), khác với \\((-3)^2 = 9\\).',
  },
  {
    questionId: 'c09_q_lcm30',
    answerId: 'ans_30',
    answerText: '\\(30\\)',
    answerPlainText: '30',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — BCNN',
    stem: 'Tìm BCNN\\((10, 15)\\).',
    options: [
      { optionId: 'c09_q_lcm30_a', labelKey: 'A', text: '\\(30\\)' },
      { optionId: 'c09_q_lcm30_b', labelKey: 'B', text: '\\(5\\)' },
      { optionId: 'c09_q_lcm30_c', labelKey: 'C', text: '\\(150\\)' },
      { optionId: 'c09_q_lcm30_d', labelKey: 'D', text: '\\(25\\)' },
    ],
    correctOptionId: 'c09_q_lcm30_a',
    hintText: 'Tìm bội chung nhỏ nhất khác 0 của \\(10\\) và \\(15\\).',
    explanationText: 'Ta có \\(10 = 2 \\cdot 5\\), \\(15 = 3 \\cdot 5\\), suy ra BCNN\\((10, 15) = 2 \\cdot 3 \\cdot 5 = 30\\).',
  },
  {
    questionId: 'c09_q_prop10',
    answerId: 'ans_10',
    answerText: '\\(10\\)',
    answerPlainText: '10',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Tỉ lệ thức',
    stem: 'Tìm \\(x\\) biết: \\(\\dfrac{x}{4} = \\dfrac{5}{2}\\).',
    options: [
      { optionId: 'c09_q_prop10_a', labelKey: 'A', text: '\\(10\\)' },
      { optionId: 'c09_q_prop10_b', labelKey: 'B', text: '\\(8\\)' },
      { optionId: 'c09_q_prop10_c', labelKey: 'C', text: '\\(2{,}5\\)' },
      { optionId: 'c09_q_prop10_d', labelKey: 'D', text: '\\(20\\)' },
    ],
    correctOptionId: 'c09_q_prop10_a',
    hintText: 'Áp dụng tính chất tỉ lệ thức: \\(x \\cdot 2 = 4 \\cdot 5\\).',
    explanationText: 'Ta có \\(x = \\dfrac{4 \\times 5}{2} = 10\\).',
  },
  {
    questionId: 'c09_q_pyth5',
    answerId: 'ans_5',
    answerText: '\\(5\\)',
    answerPlainText: '5',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Hình học — Định lí Pythagore',
    stem: 'Tam giác vuông có hai cạnh góc vuông dài \\(3\\text{ cm}\\) và \\(4\\text{ cm}\\). Độ dài cạnh huyền (theo \\(\\text{cm}\\)) là:',
    options: [
      { optionId: 'c09_q_pyth5_a', labelKey: 'A', text: '\\(5\\)' },
      { optionId: 'c09_q_pyth5_b', labelKey: 'B', text: '\\(7\\)' },
      { optionId: 'c09_q_pyth5_c', labelKey: 'C', text: '\\(12\\)' },
      { optionId: 'c09_q_pyth5_d', labelKey: 'D', text: '\\(25\\)' },
    ],
    correctOptionId: 'c09_q_pyth5_a',
    hintText: 'Áp dụng \\(c = \\sqrt{3^2 + 4^2}\\).',
    explanationText: 'Cạnh huyền là \\(\\sqrt{9 + 16} = \\sqrt{25} = 5\\text{ cm}\\).',
  },
  {
    questionId: 'c09_q_frac_div2',
    answerId: 'ans_3_4',
    answerText: '\\(\\dfrac{3}{4}\\)',
    answerPlainText: '3/4',
    sourceTag: C09_SAMPLE_BADGE,
    topicLabel: 'Đại số — Chia phân số',
    stem: 'Tính thương: \\(\\dfrac{3}{8} : \\dfrac{1}{2}\\).',
    options: [
      { optionId: 'c09_q_frac_div2_a', labelKey: 'A', text: '\\(\\dfrac{3}{4}\\)' },
      { optionId: 'c09_q_frac_div2_b', labelKey: 'B', text: '\\(\\dfrac{3}{16}\\)' },
      { optionId: 'c09_q_frac_div2_c', labelKey: 'C', text: '\\(\\dfrac{4}{3}\\)' },
      { optionId: 'c09_q_frac_div2_d', labelKey: 'D', text: '\\(\\dfrac{1}{4}\\)' },
    ],
    correctOptionId: 'c09_q_frac_div2_a',
    hintText: 'Nhân với phân số nghịch đảo \\(\\dfrac{2}{1}\\).',
    explanationText: 'Ta có \\(\\dfrac{3}{8} \\cdot 2 = \\dfrac{6}{8} = \\dfrac{3}{4}\\).',
  },
];

// ---------------------------------------------------------------------------
// HELPERS: SEEDED SHUFFLE, ANSWER-POOL VALIDATION, RBAC ADAPTER
// ---------------------------------------------------------------------------
export function hashC09Seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function deterministicShuffle<T>(items: T[], seedInput: string): T[] {
  const arr = items.slice();
  let seed = hashC09Seed(seedInput) || 2027;
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function shuffleC09QuestionOptions(
  q: C09QuestionItem,
  seedInput: string
): C09QuestionItem {
  if (q.options.length <= 1) return q;
  const shuffled = deterministicShuffle(q.options, `${q.questionId}:${seedInput}`);
  return {
    ...q,
    options: shuffled.map((o, idx) => ({
      optionId: o.optionId,
      labelKey: DISPLAY_KEYS[idx] || String(idx + 1),
      text: o.text,
    })),
  };
}

/**
 * Explicitly validates that no two questions share the same answerId (Prompt §3 & §7).
 */
export function validateC09AnswerPool(questions: C09QuestionItem[]): {
  ok: boolean;
  duplicateAnswerIds: string[];
  error?: string;
} {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const q of questions) {
    const key = String(q.answerId || '').trim();
    if (!key) {
      return {
        ok: false,
        duplicateAnswerIds: ['(empty)'],
        error: `Câu hỏi ${q.questionId} thiếu answerId hợp lệ.`,
      };
    }
    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }
  if (duplicates.size > 0) {
    const list = Array.from(duplicates);
    return {
      ok: false,
      duplicateAnswerIds: list,
      error: `Phát hiện answerId bị trùng lặp (${list.join(', ')}). Mỗi đáp án trong bộ Bingo phải có answerId duy nhất để tránh nhập nhằng trên phiếu.`,
    };
  }
  return { ok: true, duplicateAnswerIds: [] };
}

function stripLatexDelimiters(raw: string): string {
  return raw
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, '')
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]*)\}/g, '√$1')
    .replace(/\^\\circ/g, '°')
    .replace(/\^\{?2\}?/g, '²')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

export function adaptBankQuestionsForC09(
  bankQuestions: Question[],
  userRole: UserRole
): C09QuestionItem[] {
  const allowed = bankQuestions.filter((q) => {
    if (userRole === 'student' && q.status !== 'approved') return false;
    return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
  });

  const out: C09QuestionItem[] = [];
  const usedAnswerIds = new Set<string>();

  for (const q of allowed) {
    const rawOpts = (q.options || []).slice(0, 4);
    const target = String(q.correctAnswer || '').trim();
    const correctIdx = rawOpts.findIndex(
      (opt) => opt.id === target || opt.label === target
    );
    if (correctIdx < 0) continue;

    const mappedOpts: C09OptionItem[] = rawOpts.map((opt, idx) => ({
      optionId: opt.id ? `bank_${q.id}_${opt.id}` : `bank_${q.id}_opt_${idx}`,
      labelKey: DISPLAY_KEYS[idx] || String(idx + 1),
      text: String(opt.text || '').trim() || `Phương án ${DISPLAY_KEYS[idx] || idx + 1}`,
    }));

    const correctText = mappedOpts[correctIdx].text;
    const normalizedKey = stripLatexDelimiters(correctText).toLowerCase();
    // Prevent duplicate normalized answers in the same bank Bingo pool
    if (!normalizedKey || usedAnswerIds.has(normalizedKey)) continue;
    usedAnswerIds.add(normalizedKey);

    out.push({
      questionId: `bank_${q.id}`,
      answerId: `bank_ans_${q.id}`,
      answerText: correctText,
      answerPlainText: stripLatexDelimiters(correctText) || correctText,
      sourceTag: 'Ngân hàng Smart EDU',
      topicLabel: q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi',
      stem: String(q.stem || '').trim(),
      image: q.image,
      options: mappedOpts,
      correctOptionId: mappedOpts[correctIdx].optionId,
      hintText: q.lesson
        ? `Gợi ý ôn tập: xem lại kiến thức "${q.lesson}".`
        : 'Đọc kỹ đề bài và kiểm tra đơn vị/dấu phép tính.',
      explanationText:
        String(q.explanation || '').trim() ||
        `Đáp án đúng là ${mappedOpts[correctIdx].labelKey}: ${correctText}.`,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// WINNING LINES & CARD GENERATOR
// ---------------------------------------------------------------------------
export function getC09WinningLines(
  dimension: 3 | 4 | 5,
  winPatterns: C09WinPatternConfig
): C09WinningLine[] {
  const lines: C09WinningLine[] = [];

  if (winPatterns.allowRows) {
    for (let r = 0; r < dimension; r++) {
      const indices: number[] = [];
      for (let c = 0; c < dimension; c++) indices.push(r * dimension + c);
      lines.push({
        lineId: `row_${r}`,
        kind: 'row',
        label: `Hàng ${r + 1}`,
        cellIndices: indices,
      });
    }
  }

  if (winPatterns.allowCols) {
    for (let c = 0; c < dimension; c++) {
      const indices: number[] = [];
      for (let r = 0; r < dimension; r++) indices.push(r * dimension + c);
      lines.push({
        lineId: `col_${c}`,
        kind: 'col',
        label: `Cột ${c + 1}`,
        cellIndices: indices,
      });
    }
  }

  if (winPatterns.allowDiagonals) {
    const mainDiag: number[] = [];
    const antiDiag: number[] = [];
    for (let i = 0; i < dimension; i++) {
      mainDiag.push(i * dimension + i);
      antiDiag.push(i * dimension + (dimension - 1 - i));
    }
    lines.push({
      lineId: 'diag_main',
      kind: 'diagonal',
      label: 'Chéo chính',
      cellIndices: mainDiag,
    });
    lines.push({
      lineId: 'diag_anti',
      kind: 'diagonal',
      label: 'Chéo phụ',
      cellIndices: antiDiag,
    });
  }

  return lines;
}

export function generateC09Cards(params: {
  boardSize: C09BoardSize;
  freeCenterEnabled: boolean;
  cardCount: number;
  poolQuestions: C09QuestionItem[];
  participationMode: C09ParticipationMode;
  teamNames?: string[];
  classStudents?: Array<{ id: string; fullName: string }>;
  seed?: string;
}): C09BingoCard[] {
  const dimension = getC09BoardDimension(params.boardSize);
  const totalCells = dimension * dimension;
  const freeIndex = params.freeCenterEnabled ? getC09FreeCenterIndex(params.boardSize) : null;
  const neededAnswers = totalCells - (freeIndex !== null ? 1 : 0);

  if (params.poolQuestions.length < neededAnswers) {
    throw new Error(
      `Không đủ câu hỏi khác nhau cho bảng ${params.boardSize} (cần ${neededAnswers}, hiện có ${params.poolQuestions.length}).`
    );
  }

  const count = Math.max(1, Math.min(50, Math.round(params.cardCount || 1)));
  const cards: C09BingoCard[] = [];

  // Precompute sample 3x3 preset with [4, 7, 9] in Row 0 when pool contains them
  const q4 = params.poolQuestions.find((q) => q.answerId === 'ans_4');
  const q7 = params.poolQuestions.find((q) => q.answerId === 'ans_7');
  const q9 = params.poolQuestions.find((q) => q.answerId === 'ans_9');

  for (let i = 0; i < count; i++) {
    const cardNumber = i + 1;
    const holderName =
      params.participationMode === 'solo'
        ? 'Phiếu Tự luyện #01'
        : params.classStudents?.[i]?.fullName
          ? `Phiếu #${String(cardNumber).padStart(2, '0')} · ${params.classStudents[i].fullName}`
          : params.teamNames?.[i]?.trim()
            ? `Phiếu #${String(cardNumber).padStart(2, '0')} · ${params.teamNames[i].trim()}`
            : `Phiếu #${String(cardNumber).padStart(2, '0')}`;

    let pickedQuestions: C09QuestionItem[];

    if (
      params.boardSize === '3x3' &&
      i === 0 &&
      q4 &&
      q7 &&
      q9
    ) {
      // Prompt §5 exact deterministic sample Row 0: [4, 7, 9]
      const rest = deterministicShuffle(
        params.poolQuestions.filter(
          (q) => q.answerId !== 'ans_4' && q.answerId !== 'ans_7' && q.answerId !== 'ans_9'
        ),
        `${params.seed || 'c09'}:card_${cardNumber}`
      );
      pickedQuestions = [q4, q7, q9, ...rest].slice(0, neededAnswers);
    } else {
      pickedQuestions = deterministicShuffle(
        params.poolQuestions,
        `${params.seed || 'c09'}:card_${cardNumber}`
      ).slice(0, neededAnswers);
    }

    const cells: C09CardCell[] = [];
    let qCursor = 0;

    for (let idx = 0; idx < totalCells; idx++) {
      const row = Math.floor(idx / dimension);
      const col = idx % dimension;
      if (freeIndex !== null && idx === freeIndex) {
        cells.push({
          cellIndex: idx,
          row,
          col,
          answerId: null,
          answerText: '★ Miễn phí',
          answerPlainText: 'MIỄN PHÍ',
          isFreeCenter: true,
          marked: true,
        });
      } else {
        const q = pickedQuestions[qCursor++];
        cells.push({
          cellIndex: idx,
          row,
          col,
          answerId: q.answerId,
          answerText: q.answerText,
          answerPlainText: q.answerPlainText,
          isFreeCenter: false,
          marked: false,
        });
      }
    }

    cards.push({
      cardId: `card_${cardNumber}`,
      cardNumber,
      holderLabel: holderName,
      cells,
      hasVerifiedBingo: false,
      winningLineLabels: [],
      score: 0,
    });
  }

  return cards;
}

// ---------------------------------------------------------------------------
// DEFAULT CONFIG & STATE STARTUP
// ---------------------------------------------------------------------------
export function createDefaultC09SetupConfig(
  overrides: Partial<C09SetupConfig> = {}
): C09SetupConfig {
  return {
    boardSize: '3x3',
    participationMode: 'solo',
    questionSource: 'sample_pack',
    topicFilter: 'all',
    freeCenterEnabled: false,
    winPatterns: {
      allowRows: true,
      allowCols: true,
      allowDiagonals: true,
    },
    shuffleOptions: true,
    whiteboardHoldMode: false,
    cardCount: 1,
    teamNames: [],
    classStudents: [],
    selectedClassId: '',
    ...overrides,
  };
}

export function createC09SetupState(
  configOverrides: Partial<C09SetupConfig> = {}
): C09GameState {
  const config = createDefaultC09SetupConfig(configOverrides);
  const dimension = getC09BoardDimension(config.boardSize);
  const centerFreeActive = config.freeCenterEnabled && canHaveC09FreeCenter(config.boardSize);

  return {
    phase: 'setup',
    config,
    dimension,
    centerFreeActive,
    deck: [],
    activeQuestionIndex: null,
    publishedAnswerIds: [],
    cards: [],
    focusedCardIndex: 0,
    verifiedWinners: [],
    lastVerificationStatus: 'none',
    lastClaimResults: [],
    turnToken: 'c09_setup',
    isProcessing: false,
    revealAnimDone: false,
    activeHintRevealed: false,
    totalQuestionScore: 0,
    lastActionNotice: 'Chọn kích thước bảng, quy tắc thắng và mở gói câu hỏi Bingo 3D.',
  };
}

export function startC09Bingo(params: {
  config: C09SetupConfig;
  bankQuestions?: Question[];
  userRole?: UserRole;
  customQuestionsOverride?: C09QuestionItem[];
  nowMs?: number;
  shuffleSeed?: string;
}): { ok: boolean; error?: string; state?: C09GameState } {
  const nowMs = params.nowMs ?? Date.now();
  const seed = params.shuffleSeed ?? String(nowMs);
  const { config } = params;

  if (!config.winPatterns.allowRows && !config.winPatterns.allowCols && !config.winPatterns.allowDiagonals) {
    return {
      ok: false,
      error: 'Hãy chọn ít nhất một quy tắc thắng Bingo (Hàng, Cột hoặc Đường chéo) trước khi bắt đầu.',
    };
  }

  const needed = getC09RequiredPoolSize(config.boardSize, config.freeCenterEnabled);
  let rawPool: C09QuestionItem[];

  if (params.customQuestionsOverride) {
    rawPool = params.customQuestionsOverride.slice();
  } else if (config.questionSource === 'bank') {
    rawPool = adaptBankQuestionsForC09(params.bankQuestions || [], params.userRole || 'teacher');
    if (rawPool.length < needed) {
      return {
        ok: false,
        error: `Ngân hàng câu hỏi hiện có ${rawPool.length} câu có đáp án duy nhất, cần tối thiểu ${needed} câu cho bảng ${config.boardSize}. Hãy chọn "Gói Toán mẫu C09 (Dữ liệu mẫu)" hoặc giảm kích thước bảng.`,
      };
    }
  } else {
    rawPool = C09_SAMPLE_QUESTIONS.filter((q) => {
      if (config.topicFilter === 'all') return true;
      if (config.topicFilter === 'algebra') return q.topicLabel.startsWith('Đại số');
      if (config.topicFilter === 'geometry') return q.topicLabel.startsWith('Hình học');
      return q.topicLabel.startsWith('Thống kê');
    });
    if (rawPool.length < needed) {
      rawPool = C09_SAMPLE_QUESTIONS.slice();
    }
  }

  // Strict unique answerId validation (Prompt §3 & §7)
  const poolCheck = validateC09AnswerPool(rawPool);
  if (!poolCheck.ok) {
    return {
      ok: false,
      error: poolCheck.error,
    };
  }

  if (rawPool.length < needed) {
    return {
      ok: false,
      error: `Không đủ câu hỏi duy nhất cho bảng ${config.boardSize}: cần ${needed}, chỉ có ${rawPool.length}.`,
    };
  }

  // Build ordered deck: keep [2^2=4, sqrt(49)=7, 3^2=9] accessible first for 3x3 sample preset
  const activePool = rawPool.slice(0, Math.max(needed, Math.min(rawPool.length, 25)));
  const orderedQuestions = activePool.map((q) =>
    config.shuffleOptions ? shuffleC09QuestionOptions(q, seed) : q
  );

  const deck: C09QuestionProgress[] = orderedQuestions.map((q, idx) => ({
    question: q,
    status: idx === 0 ? 'open' : 'unasked',
    outcome: 'unattempted',
    selectedOptionId: null,
    usedHint: false,
    viewedSolution: false,
    pointsAwarded: 0,
    cardSubmissions: {},
  }));

  const cards = generateC09Cards({
    boardSize: config.boardSize,
    freeCenterEnabled: config.freeCenterEnabled,
    cardCount: config.participationMode === 'solo' ? 1 : config.cardCount,
    poolQuestions: activePool,
    participationMode: config.participationMode,
    teamNames: config.teamNames,
    classStudents: config.classStudents,
    seed,
  });

  const dimension = getC09BoardDimension(config.boardSize);
  const centerFreeActive = config.freeCenterEnabled && canHaveC09FreeCenter(config.boardSize);

  return {
    ok: true,
    state: {
      phase: 'playing',
      config: { ...config },
      dimension,
      centerFreeActive,
      deck,
      activeQuestionIndex: 0,
      publishedAnswerIds: [],
      cards,
      focusedCardIndex: 0,
      verifiedWinners: [],
      lastVerificationStatus: 'none',
      lastClaimResults: [],
      turnToken: `c09_q0_${nowMs}`,
      isProcessing: false,
      revealAnimDone: false,
      activeHintRevealed: false,
      totalQuestionScore: 0,
      lastActionNotice: `Đã mở Câu 1/${deck.length} · Bảng ${config.boardSize}${centerFreeActive ? ' (Có ô miễn phí ở tâm)' : ' (Không có ô miễn phí)'}.`,
    },
  };
}

// ---------------------------------------------------------------------------
// QUESTION & WHITEBOARD WORKFLOW
// ---------------------------------------------------------------------------
export function revealC09Hint(state: C09GameState): C09GameState {
  if (state.phase !== 'playing' || state.activeQuestionIndex === null) return state;
  const idx = state.activeQuestionIndex;
  const deck = state.deck.map((item, i) =>
    i === idx ? { ...item, usedHint: true } : item
  );
  return {
    ...state,
    deck,
    activeHintRevealed: true,
    lastActionNotice: 'Đã mở gợi ý hỗ trợ (trả lời đúng sẽ ghi nhận thuộc nhóm Đúng có hỗ trợ).',
  };
}

export function submitC09WhiteboardHold(params: {
  state: C09GameState;
  cardId: string;
  optionId?: string | null;
  teacherConfirmCorrect?: boolean | null;
}): C09GameState {
  const { state, cardId } = params;
  if (state.phase !== 'playing' || state.activeQuestionIndex === null) return state;
  const card = state.cards.find((c) => c.cardId === cardId);
  if (!card) return state;

  const qIdx = state.activeQuestionIndex;
  const targetQ = state.deck[qIdx];
  if (targetQ.status === 'published' || targetQ.status === 'skipped') return state;

  const entry: C09CardSubmission = {
    cardId,
    cardLabel: card.holderLabel,
    selectedOptionId: params.optionId ?? null,
    teacherConfirmCorrect: params.teacherConfirmCorrect ?? null,
  };

  const deck = state.deck.map((item, i) =>
    i === qIdx
      ? {
          ...item,
          status: 'submitted' as C09QuestionStatus,
          outcome: 'submitted' as C09OutcomeStatus,
          cardSubmissions: { ...item.cardSubmissions, [cardId]: entry },
        }
      : item
  );

  return {
    ...state,
    deck,
    lastActionNotice: `Đã giữ đáp án của ${card.holderLabel} ở trạng thái "Đã nộp" — chờ giáo viên Chốt & Công bố.`,
  };
}

export function publishC09QuestionResult(params: {
  state: C09GameState;
  turnToken: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
  commitHeldWhiteboard?: boolean;
  nowMs?: number;
}): C09GameState {
  const { state, turnToken } = params;
  if (state.phase !== 'playing' || state.isProcessing || state.activeQuestionIndex === null) {
    return state;
  }
  if (turnToken !== state.turnToken) return state;

  const qIdx = state.activeQuestionIndex;
  const current = state.deck[qIdx];
  if (!current || current.status === 'published' || current.status === 'skipped') {
    return state;
  }

  let isCorrect = false;
  let outcome: C09OutcomeStatus = 'wrong';
  let qStatus: C09QuestionStatus = 'published';
  let selectedOptId: string | null = current.selectedOptionId;
  const winningCardIds = new Set<string>();

  if (params.skip) {
    qStatus = 'skipped';
    outcome = 'skipped';
  } else if (params.commitHeldWhiteboard) {
    Object.values(current.cardSubmissions).forEach((sub) => {
      const ok =
        typeof sub.teacherConfirmCorrect === 'boolean'
          ? sub.teacherConfirmCorrect
          : sub.selectedOptionId === current.question.correctOptionId;
      if (ok) winningCardIds.add(sub.cardId);
    });
    isCorrect = winningCardIds.size > 0;
    outcome = isCorrect
      ? current.usedHint
        ? 'correct_with_hint'
        : 'correct_independent'
      : 'wrong_viewed_solution';
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    outcome = isCorrect
      ? current.usedHint
        ? 'correct_with_hint'
        : 'correct_independent'
      : 'wrong_viewed_solution';
    selectedOptId = isCorrect ? current.question.correctOptionId : null;
    const focused = state.cards[state.focusedCardIndex];
    if (isCorrect && focused) winningCardIds.add(focused.cardId);
  } else if (params.optionId) {
    const opt = current.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    selectedOptId = opt.optionId;
    isCorrect = opt.optionId === current.question.correctOptionId;
    outcome = isCorrect
      ? current.usedHint
        ? 'correct_with_hint'
        : 'correct_independent'
      : 'wrong_viewed_solution';
    const focused = state.cards[state.focusedCardIndex];
    if (isCorrect && focused) winningCardIds.add(focused.cardId);
  } else {
    return state;
  }

  const pts = qStatus === 'published' && isCorrect ? C09_QUESTION_POINTS : 0;
  const viewedSol = qStatus === 'published' && !isCorrect;

  const updatedProgress: C09QuestionProgress = {
    ...current,
    status: qStatus,
    outcome,
    selectedOptionId: selectedOptId,
    viewedSolution: viewedSol,
    pointsAwarded: pts,
  };

  const deck = state.deck.map((d, i) => (i === qIdx ? updatedProgress : d));

  // Publish answerId ONLY when question is published (never when skipped!)
  const publishedAnswerIds =
    qStatus === 'published' && !state.publishedAnswerIds.includes(current.question.answerId)
      ? [...state.publishedAnswerIds, current.question.answerId]
      : state.publishedAnswerIds;

  // Auto-mark matching cell on cards in solo mode OR mark official match indicator on class cards
  const cards = state.cards.map((card) => {
    const earnedPts = winningCardIds.has(card.cardId) ? pts : 0;
    const nextCells =
      qStatus === 'published' && state.config.participationMode === 'solo'
        ? card.cells.map((cell) =>
            cell.answerId === current.question.answerId ? { ...cell, marked: true } : cell
          )
        : card.cells;
    return {
      ...card,
      cells: nextCells,
      score: card.score + earnedPts,
    };
  });

  const totalQuestionScore = deck.reduce((sum, item) => sum + item.pointsAwarded, 0);

  return {
    ...state,
    phase: 'question_revealed',
    deck,
    publishedAnswerIds,
    cards,
    totalQuestionScore,
    revealAnimDone: false,
    lastVerificationStatus: 'none',
    lastClaimResults: [],
    lastActionNotice:
      qStatus === 'skipped'
        ? `Đã bỏ qua Câu ${qIdx + 1} (chưa công bố đáp án vào bảng Bingo).`
        : isCorrect
          ? `Đã công bố đáp án ${current.question.answerPlainText} (+${pts}đ). Phiếu nào có ô "${current.question.answerPlainText}" được phép đánh dấu!`
          : `Đã công bố lời giải và đáp án ${current.question.answerPlainText} (0đ cho lượt trả lời, đáp án được phép đánh dấu trên phiếu).`,
  };
}

export function markC09SolutionViewed(state: C09GameState): C09GameState {
  if (state.activeQuestionIndex === null) return state;
  const qIdx = state.activeQuestionIndex;
  const deck = state.deck.map((item, i) => {
    if (i !== qIdx) return item;
    const nextOutcome: C09OutcomeStatus =
      item.outcome === 'wrong' ? 'wrong_viewed_solution' : item.outcome;
    return {
      ...item,
      viewedSolution: true,
      outcome: nextOutcome,
    };
  });
  return {
    ...state,
    deck,
  };
}

/**
 * Toggle mark on a card cell manually (for classroom demo or student interactive board).
 * Note: Marking an UNANNOUNCED cell is permitted visually on the card, OR checked strictly
 * by verifyC09BingoClaims — pre-marked unannounced cells NEVER qualify for Bingo!
 */
export function toggleC09CardCellMark(
  state: C09GameState,
  cardId: string,
  cellIndex: number
): C09GameState {
  const cards = state.cards.map((card) => {
    if (card.cardId !== cardId) return card;
    const cells = card.cells.map((cell) => {
      if (cell.cellIndex !== cellIndex || cell.isFreeCenter) return cell;
      return { ...cell, marked: !cell.marked };
    });
    return { ...card, cells };
  });

  const targetCell = cards
    .find((c) => c.cardId === cardId)
    ?.cells.find((c) => c.cellIndex === cellIndex);
  const isAnnounced =
    targetCell?.answerId !== null &&
    targetCell?.answerId !== undefined &&
    state.publishedAnswerIds.includes(targetCell.answerId);

  return {
    ...state,
    cards,
    lastActionNotice: targetCell?.marked
      ? isAnnounced
        ? `Đã đánh dấu ô "${targetCell.answerPlainText}" (đã công bố hợp lệ).`
        : `Cảnh báo: ô "${targetCell?.answerPlainText || ''}" chưa được công bố — sẽ bị từ chối nếu kiểm Bingo ngay!`
      : 'Đã bỏ đánh dấu ô.',
  };
}

/**
 * Verifies ONE or MULTIPLE claiming cards in the same turn BEFORE advancing!
 * Strictly rejects any cell whose answerId has NOT been published (premature mark),
 * and records ALL valid concurrent winners together (Đồng thắng).
 */
export function verifyC09BingoClaims(
  state: C09GameState,
  claimingCardIds: string[]
): C09GameState {
  const uniqueClaimIds = Array.from(new Set(claimingCardIds));
  if (uniqueClaimIds.length === 0) {
    return {
      ...state,
      phase: 'bingo_check',
      lastVerificationStatus: 'pending',
      lastClaimResults: [],
      lastActionNotice: 'Chờ chọn ít nhất 1 số phiếu để kiểm tra Bingo (chưa ăn mừng).',
    };
  }

  const publishedSet = new Set(state.publishedAnswerIds);
  const lines = getC09WinningLines(state.dimension, state.config.winPatterns);
  const results: C09BingoClaimResult[] = [];
  const newlyVerifiedCards = new Map<string, string[]>();

  for (const cid of uniqueClaimIds) {
    const card = state.cards.find((c) => c.cardId === cid);
    if (!card) continue;

    // Collect premature cells that the card marked BEFORE its answerId was published
    const prematureCells = card.cells
      .filter(
        (cell) =>
          !cell.isFreeCenter &&
          cell.marked &&
          cell.answerId !== null &&
          !publishedSet.has(cell.answerId)
      )
      .map((cell) => ({
        cellIndex: cell.cellIndex,
        answerId: cell.answerId!,
        answerPlainText: cell.answerPlainText,
      }));

    // A line is strictly valid ONLY IF EVERY non-free cell in the line has been PUBLISHED
    // (and if interactive marks exist on card, also requires valid match against publishedSet)
    const matchedLineLabels: string[] = [];
    for (const line of lines) {
      const allValidPublished = line.cellIndices.every((cellIdx) => {
        const cell = card.cells[cellIdx];
        if (!cell) return false;
        if (cell.isFreeCenter) return true;
        return cell.answerId !== null && publishedSet.has(cell.answerId);
      });
      if (allValidPublished) {
        matchedLineLabels.push(line.label);
      }
    }

    const valid = matchedLineLabels.length > 0;
    if (valid) {
      newlyVerifiedCards.set(card.cardId, matchedLineLabels);
    }

    const reasonText = valid
      ? `Hợp lệ (${matchedLineLabels.join(', ')}) theo đúng ${state.publishedAnswerIds.length} đáp án đã công bố.`
      : prematureCells.length > 0
        ? `Chưa hợp lệ: có ô đánh dấu trước khi đáp án được công bố (${prematureCells
            .map((p) => p.answerPlainText)
            .join(', ')}).`
        : 'Chưa đủ đường Bingo hợp lệ theo quy tắc Hàng/Cột/Chéo đã chọn.';

    results.push({
      cardId: card.cardId,
      cardNumber: card.cardNumber,
      holderLabel: card.holderLabel,
      valid,
      matchedLineLabels,
      prematureCells,
      reasonText,
    });
  }

  const turnIdx = state.activeQuestionIndex ?? 0;
  const nextWinners = state.verifiedWinners.slice();

  const cards = state.cards.map((card) => {
    const winLines = newlyVerifiedCards.get(card.cardId);
    if (!winLines) return card;

    const alreadyWinner = card.hasVerifiedBingo;
    if (!alreadyWinner) {
      nextWinners.push({
        cardId: card.cardId,
        cardNumber: card.cardNumber,
        holderLabel: card.holderLabel,
        lineLabels: winLines,
        turnQuestionIndex: turnIdx,
      });
    }

    return {
      ...card,
      hasVerifiedBingo: true,
      winningLineLabels: Array.from(new Set([...card.winningLineLabels, ...winLines])),
      score: alreadyWinner ? card.score : card.score + C09_BINGO_BONUS_POINTS,
    };
  });

  const validCount = results.filter((r) => r.valid).length;
  const verificationStatus: 'verified' | 'rejected' = validCount > 0 ? 'verified' : 'rejected';

  return {
    ...state,
    phase: 'bingo_check',
    cards,
    verifiedWinners: nextWinners,
    lastVerificationStatus: verificationStatus,
    lastClaimResults: results,
    lastActionNotice:
      validCount > 1
        ? `XÁC NHẬN ĐỒNG THẮNG (${validCount} phiếu hợp lệ cùng lượt): ${results
            .filter((r) => r.valid)
            .map((r) => r.holderLabel)
            .join(' & ')}!`
        : validCount === 1
          ? `XÁC NHẬN BINGO HỢP LỆ: ${results.find((r) => r.valid)!.holderLabel} (${results
              .find((r) => r.valid)!
              .matchedLineLabels.join(', ')})!`
          : `Kiểm tra không đạt: ${results[0]?.reasonText || 'Chưa có đường Bingo hợp lệ.'}`,
  };
}

export function advanceToNextC09Question(
  state: C09GameState,
  nowMs = Date.now()
): C09GameState {
  const nextIdx = state.deck.findIndex((item) => item.status === 'unasked');
  if (nextIdx < 0) {
    return finishC09ToSummary(state);
  }

  const deck = state.deck.map((item, i) =>
    i === nextIdx ? { ...item, status: 'open' as C09QuestionStatus } : item
  );

  return {
    ...state,
    phase: 'playing',
    deck,
    activeQuestionIndex: nextIdx,
    lastVerificationStatus: 'none',
    lastClaimResults: [],
    turnToken: `c09_q${nextIdx}_${nowMs}`,
    revealAnimDone: false,
    activeHintRevealed: false,
    lastActionNotice: `Đã mở Câu ${nextIdx + 1}/${deck.length}.`,
  };
}

export function skipC09RevealAnimation(state: C09GameState): C09GameState {
  if (state.phase !== 'question_revealed' && state.phase !== 'bingo_check') {
    return state;
  }
  return {
    ...state,
    revealAnimDone: true,
  };
}

export function finishC09ToSummary(state: C09GameState): C09GameState {
  return {
    ...state,
    phase: 'summary',
    revealAnimDone: true,
    lastActionNotice: 'Đã hoàn thành vòng Bingo Kiến Thức 3D — xem lại toàn bộ đáp án và lời giải.',
  };
}

export function computeC09Summary(state: C09GameState): C09SummaryStats {
  let totalOpened = 0;
  let publishedCount = 0;
  let independentCorrectCount = 0;
  let assistedCorrectCount = 0;
  let viewedSolutionCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  for (const item of state.deck) {
    if (item.status !== 'unasked') totalOpened += 1;
    if (item.status === 'published') publishedCount += 1;
    switch (item.outcome) {
      case 'correct_independent':
        independentCorrectCount += 1;
        break;
      case 'correct_with_hint':
        assistedCorrectCount += 1;
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

  const totalQuestionScore = state.deck.reduce((sum, item) => sum + item.pointsAwarded, 0);
  const winnerLabels = state.verifiedWinners.map((w) => w.holderLabel);
  const bingoBonusTotal = state.verifiedWinners.length > 0 ? C09_BINGO_BONUS_POINTS : 0;

  return {
    totalOpened,
    publishedCount,
    independentCorrectCount,
    assistedCorrectCount,
    viewedSolutionCount,
    wrongCount,
    skippedCount,
    totalQuestionScore,
    verifiedWinnerCount: state.verifiedWinners.length,
    isCoWinners: state.verifiedWinners.length > 1,
    winnerLabels,
    totalClassOrSoloScore: totalQuestionScore + bingoBonusTotal,
  };
}

export function buildC09PrintableCardSpec(
  card: C09BingoCard,
  dimension: 3 | 4 | 5,
  winPatterns: C09WinPatternConfig
): C09PrintableCardSpec {
  const rules: string[] = [];
  if (winPatterns.allowRows) rules.push('Hàng');
  if (winPatterns.allowCols) rules.push('Cột');
  if (winPatterns.allowDiagonals) rules.push('Chéo');

  return {
    cardId: card.cardId,
    cardNumber: card.cardNumber,
    holderLabel: card.holderLabel,
    dimension,
    ruleSummary: `Luật: ${rules.join(' · ')}`,
    cells: card.cells.map((cell) => {
      const colLetter = String.fromCharCode(65 + cell.col);
      return {
        row: cell.row,
        col: cell.col,
        codeBadge: cell.isFreeCenter ? '★' : `${colLetter}${cell.row + 1}`,
        primaryText: cell.isFreeCenter ? 'Ô MIỄN PHÍ' : cell.answerPlainText,
        mathText: cell.answerText,
        isFreeCenter: cell.isFreeCenter,
        bwPatternLabel: cell.isFreeCenter ? '[★] Khung kép giữa' : `[${colLetter}${cell.row + 1}]`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// DEMO-ISOLATED SESSION PERSISTENCE
// ---------------------------------------------------------------------------
interface PersistedC09Payload {
  version: 1;
  savedAtMs: number;
  state: C09GameState;
}

export function saveC09Session(state: C09GameState, nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const payload: PersistedC09Payload = {
      version: 1,
      savedAtMs: nowMs,
      state,
    };
    window.localStorage.setItem(getC09SessionStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadC09Session(): C09GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getC09SessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedC09Payload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.cards) ||
      !Array.isArray(parsed.state.deck)
    ) {
      clearC09Session();
      return null;
    }
    return parsed.state;
  } catch {
    clearC09Session();
    return null;
  }
}

export function clearC09Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getC09SessionStorageKey());
  } catch {
    // Ignore cleanly
  }
}
