import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Clock,
  Lightbulb,
  BookOpen,
  Award,
  Sparkles,
  HelpCircle,
  Eye,
  ArrowRight,
  RefreshCw,
  ZoomIn,
  X,
  AlertTriangle,
  ShieldCheck,
  Check,
  FastForward,
  Flag,
  BarChart3,
  Shuffle,
  Divide,
} from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom, Question } from '../../../types';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';

// ============================================================================
// TYPES & STATE MACHINE FOR C01: AI LÀ TRIỆU PHÚ 3D ("ĐỈNH CAO TRI THỨC")
// ============================================================================

export type C01PlayMode = 'PRACTICE' | 'CONQUEST';
export type C01OrgMode = 'CLASS' | 'INDIVIDUAL';
export type C01QuestionCount = 5 | 10 | 15;
export type C01DatasetKey = 'SAMPLE_MATH' | 'SAMPLE_INFORMATICS' | 'QUESTION_BANK';
export type C01LifelineKey = 'FIFTY_FIFTY' | 'CLASS_POLL' | 'KNOWLEDGE_HINT' | 'SWAP_QUESTION';

export type C01StagePhase =
  | 'SETUP'
  | 'READY'
  | 'ANSWERING'
  | 'LIFELINE_POLL'
  | 'LOCKED_SUSPENSE'
  | 'REVEALED'
  | 'EXPLANATION'
  | 'PAUSED'
  | 'FINISHED';

export type C01EndReason = 'COMPLETED' | 'WRONG_ANSWER' | 'TIMEOUT' | 'WALK_AWAY' | null;

export interface C01OptionItem {
  optionId: string;
  text: string;
}

export interface C01QuestionItem {
  questionId: string;
  stem: string;
  options: C01OptionItem[]; // Always 4 valid options
  correctOptionId: string;
  explanation: string;
  hint?: string;
  topic?: string;
  difficulty?: 1 | 2 | 3; // 1: Nhận biết, 2: Thông hiểu, 3: Vận dụng
  allowShuffle: boolean;
  isReserve?: boolean;
  isSample?: boolean;
}

export interface C01DisplayOption extends C01OptionItem {
  displayLabel: 'A' | 'B' | 'C' | 'D';
}

export interface C01QuestionHistoryItem {
  stepNumber: number;
  questionId: string;
  stem: string;
  options: C01DisplayOption[];
  selectedOptionId: string | null;
  correctOptionId: string;
  explanation: string;
  outcome: 'CORRECT' | 'WRONG' | 'TIMEOUT' | 'WALK_AWAY';
  lifelinesUsedOnStep: C01LifelineKey[];
  scoreAfterStep: number;
}

export interface Millionaire3DGameProps {
  availableCandidates: StudentCandidate[];
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  classes?: ClassRoom[];
  questions?: Question[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
  onCloseGame?: () => void;
  onPick?: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => void;
}

const C01_STORAGE_KEY = 'taydo_smart_edu_c01_active_session_v1';
const C01_STORAGE_VERSION = 1;

// ============================================================================
// CONQUEST POINT LADDERS & SAFE HAVEN MILESTONES (SECTION 6)
// ============================================================================

export const CONQUEST_LADDER_15: number[] = [
  10, 20, 30, 40, 50, 70, 90, 120, 160, 200, 260, 330, 410, 500, 600,
];
export const CONQUEST_LADDER_10: number[] = [
  10, 20, 30, 40, 50, 70, 90, 120, 160, 200,
];
export const CONQUEST_LADDER_5: number[] = [10, 20, 30, 40, 50];

export function getConquestLadder(count: C01QuestionCount): number[] {
  if (count === 5) return CONQUEST_LADDER_5;
  if (count === 10) return CONQUEST_LADDER_10;
  return CONQUEST_LADDER_15;
}

/**
 * Check if 1-indexed stepNumber is an intermediate Safe Haven Milestone ("Mốc bảo toàn").
 * - 15 questions: step 5 (50 pts) & step 10 (200 pts)
 * - 10 questions: step 5 (50 pts)
 * - 5 questions: no intermediate milestone
 */
export function isSafeHavenStep(stepNumber: number, totalCount: C01QuestionCount): boolean {
  if (totalCount === 15) return stepNumber === 5 || stepNumber === 10;
  if (totalCount === 10) return stepNumber === 5;
  return false;
}

/**
 * Compute Current Score and Safe Haven Score in Conquest Mode given how many questions
 * have been answered correctly so far (solvedCount in 0..totalCount).
 * - Never sums rungs! Score at rung k is ladder[k - 1].
 */
export function computeConquestScores(
  solvedCount: number,
  totalCount: C01QuestionCount
): { currentScore: number; safeHavenScore: number } {
  const ladder = getConquestLadder(totalCount);
  if (solvedCount <= 0) {
    return { currentScore: 0, safeHavenScore: 0 };
  }
  const clampedIdx = Math.min(solvedCount, ladder.length) - 1;
  const currentScore = ladder[clampedIdx];

  let safeHavenScore = 0;
  if (totalCount === 15) {
    if (solvedCount >= 15) safeHavenScore = 600;
    else if (solvedCount >= 10) safeHavenScore = 200;
    else if (solvedCount >= 5) safeHavenScore = 50;
  } else if (totalCount === 10) {
    if (solvedCount >= 10) safeHavenScore = 200;
    else if (solvedCount >= 5) safeHavenScore = 50;
  } else {
    if (solvedCount >= 5) safeHavenScore = 50;
  }

  return { currentScore, safeHavenScore };
}

/**
 * Check if any option text depends on fixed A/B/C/D positions (e.g., "Cả A và B", "Tất cả các đáp án trên").
 */
export function hasPositionDependentOption(options: C01OptionItem[]): boolean {
  const pattern = /(cả\s+[a-d]\s+và\s+[a-d]|tất\s+cả\s+(các\s+)?(đáp\s+án|phương\s+án)|a,\s*b,\s*c\s+đều|cả\s+ba\s+phương\s+án)/i;
  return options.some((o) => pattern.test(o.text));
}

/**
 * Prepare display options (A, B, C, D) once at session start, keeping optionId intact.
 */
export function buildSessionDisplayOptions(
  question: C01QuestionItem,
  enableShuffle: boolean
): C01DisplayOption[] {
  const canShuffle =
    enableShuffle &&
    question.allowShuffle &&
    !hasPositionDependentOption(question.options);

  const ordered = canShuffle
    ? [...question.options].sort(() => Math.random() - 0.5)
    : [...question.options];

  const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  return ordered.slice(0, 4).map((opt, idx) => ({
    optionId: opt.optionId,
    text: opt.text,
    displayLabel: labels[idx] || 'A',
  }));
}

/**
 * 50:50 Lifeline helper: eliminates exactly 2 wrong options, keeping correctOptionId and 1 wrong option.
 */
export function computeFiftyFiftyEliminations(
  options: C01DisplayOption[],
  correctOptionId: string
): string[] {
  if (options.length !== 4) return [];
  const wrongOptions = options.filter((o) => o.optionId !== correctOptionId);
  if (wrongOptions.length !== 3) return [];
  const shuffledWrong = [...wrongOptions].sort(() => Math.random() - 0.5);
  return [shuffledWrong[0].optionId, shuffledWrong[1].optionId];
}

// ============================================================================
// BUILT-IN SAMPLE DATASETS ("DỮ LIỆU MẪU" — 15 MAIN + 3 RESERVE EACH)
// ============================================================================

export const SAMPLE_C01_MATH_QUESTIONS: C01QuestionItem[] = [
  // Level 1–5 (Nhận biết)
  {
    questionId: 'c01_math_01',
    stem: 'Tập hợp các số tự nhiên được kí hiệu bằng chữ cái nào sau đây?',
    options: [
      { optionId: 'm01_a', text: 'ℕ' },
      { optionId: 'm01_b', text: 'ℤ' },
      { optionId: 'm01_c', text: 'ℚ' },
      { optionId: 'm01_d', text: 'ℝ' },
    ],
    correctOptionId: 'm01_a',
    hint: 'Đây là chữ cái đầu của từ Natural (tự nhiên). Tập số nguyên mới dùng kí hiệu ℤ.',
    explanation: 'Tập hợp các số tự nhiên {0; 1; 2; 3; ...} được kí hiệu là ℕ. Các phương án khác: ℤ là số nguyên, ℚ là số hữu tỉ, ℝ là số thực.',
    topic: 'Số học 6',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_02',
    stem: 'Số đối của số nguyên $-15$ là số nào?',
    options: [
      { optionId: 'm02_a', text: '-15' },
      { optionId: 'm02_b', text: '15' },
      { optionId: 'm02_c', text: '0' },
      { optionId: 'm02_d', text: '1/15' },
    ],
    correctOptionId: 'm02_b',
    hint: 'Hai số đối nhau có tổng bằng 0 và nằm ở hai phía của điểm 0 trên trục số.',
    explanation: 'Số đối của $-15$ là $15$ vì $(-15) + 15 = 0$. Phương án $1/15$ là nghịch đảo của $15$, không phải số đối.',
    topic: 'Số nguyên 6',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_03',
    stem: 'Góc bẹt có số đo bằng bao nhiêu độ?',
    options: [
      { optionId: 'm03_a', text: '90°' },
      { optionId: 'm03_b', text: '120°' },
      { optionId: 'm03_c', text: '180°' },
      { optionId: 'm03_d', text: '360°' },
    ],
    correctOptionId: 'm03_c',
    hint: 'Hai cạnh của góc bẹt là hai tia đối nhau tạo thành một đường thẳng.',
    explanation: 'Góc bẹt là góc có hai cạnh là hai tia đối nhau nên có số đo bằng 180° (gấp đôi góc vuông 90°).',
    topic: 'Hình học 6',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_04',
    stem: 'Giá trị của lũy thừa $5^2$ bằng bao nhiêu?',
    options: [
      { optionId: 'm04_a', text: '10' },
      { optionId: 'm04_b', text: '25' },
      { optionId: 'm04_c', text: '7' },
      { optionId: 'm04_d', text: '32' },
    ],
    correctOptionId: 'm04_b',
    hint: 'Bình phương của một số là tích của hai thừa số bằng chính số đó, không phải lấy cơ số nhân số mũ.',
    explanation: 'Ta có $5^2 = 5 \\times 5 = 25$. Học sinh cần tránh nhầm lẫn $5 \\times 2 = 10$ hoặc $2^5 = 32$.',
    topic: 'Lũy thừa 6',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_05',
    stem: 'Phân số nào dưới đây là phân số tối giản?',
    options: [
      { optionId: 'm05_a', text: '4/6' },
      { optionId: 'm05_b', text: '9/12' },
      { optionId: 'm05_c', text: '7/15' },
      { optionId: 'm05_d', text: '10/25' },
    ],
    correctOptionId: 'm05_c',
    hint: 'Hãy tìm phân số mà tử và mẫu chỉ có ước chung dương duy nhất là 1.',
    explanation: 'Phân số $7/15$ tối giản vì $\\text{ƯCLN}(7, 15) = 1$. Các phân số $4/6$, $9/12$, $10/25$ đều còn rút gọn được cho 2, 3, 5.',
    topic: 'Phân số 6',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  // Level 6–10 (Thông hiểu)
  {
    questionId: 'c01_math_06',
    stem: 'Kết quả của phép tính $\\frac{2}{7} + \\frac{5}{7}$ bằng bao nhiêu?',
    options: [
      { optionId: 'm06_a', text: '7/14' },
      { optionId: 'm06_b', text: '1' },
      { optionId: 'm06_c', text: '10/49' },
      { optionId: 'm06_d', text: '3/7' },
    ],
    correctOptionId: 'm06_b',
    hint: 'Khi cộng hai phân số cùng mẫu dương, ta cộng tử số với nhau và giữ nguyên mẫu số rồi rút gọn.',
    explanation: 'Ta có $\\frac{2}{7} + \\frac{5}{7} = \\frac{2+5}{7} = \\frac{7}{7} = 1$. Sai lầm phổ biến là cộng cả mẫu số thành $7/14$.',
    topic: 'Phân số 6',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_07',
    stem: 'Một hình chữ nhật có chiều dài $8\\text{ cm}$ và chiều rộng $5\\text{ cm}$. Chu vi của hình chữ nhật đó là:',
    options: [
      { optionId: 'm07_a', text: '13 cm' },
      { optionId: 'm07_b', text: '26 cm' },
      { optionId: 'm07_c', text: '40 cm' },
      { optionId: 'm07_d', text: '20 cm' },
    ],
    correctOptionId: 'm07_b',
    hint: 'Chu vi hình chữ nhật bằng hai lần tổng chiều dài và chiều rộng.',
    explanation: 'Chu vi hình chữ nhật là $P = (8 + 5) \\times 2 = 26\\text{ cm}$. Phương án $40$ là diện tích ($8 \\times 5$), còn $13$ mới là nửa chu vi.',
    topic: 'Hình học phẳng',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_08',
    stem: 'Trong một tam giác vuông, nếu một góc nhọn bằng $35^\\circ$ thì góc nhọn còn lại có số đo là:',
    options: [
      { optionId: 'm08_a', text: '45°' },
      { optionId: 'm08_b', text: '55°' },
      { optionId: 'm08_c', text: '65°' },
      { optionId: 'm08_d', text: '145°' },
    ],
    correctOptionId: 'm08_b',
    hint: 'Trong tam giác vuông, hai góc nhọn luôn phụ nhau (có tổng bằng 90°).',
    explanation: 'Vì hai góc nhọn trong tam giác vuông phụ nhau nên góc nhọn còn lại bằng $90^\\circ - 35^\\circ = 55^\\circ$.',
    topic: 'Tam giác 7',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_09',
    stem: 'Khi rút gọn tích hai lũy thừa cùng cơ số $x^3 \\cdot x^4$ ($x \\neq 0$), ta thu được kết quả nào?',
    options: [
      { optionId: 'm09_a', text: 'x⁷' },
      { optionId: 'm09_b', text: 'x¹²' },
      { optionId: 'm09_c', text: '2x⁷' },
      { optionId: 'm09_d', text: 'x' },
    ],
    correctOptionId: 'm09_a',
    hint: 'Nhân hai lũy thừa cùng cơ số: giữ nguyên cơ số và cộng các số mũ.',
    explanation: 'Theo quy tắc nhân hai lũy thừa cùng cơ số: $x^3 \\cdot x^4 = x^{3+4} = x^7$ (không nhân hai số mũ thành $x^{12}$).',
    topic: 'Đại số 7',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_10',
    stem: 'Điểm kiểm tra Toán của 4 bạn lần lượt là $7; 8; 8; 9$. Điểm trung bình cộng của 4 bạn là:',
    options: [
      { optionId: 'm10_a', text: '7,5' },
      { optionId: 'm10_b', text: '8,0' },
      { optionId: 'm10_c', text: '8,5' },
      { optionId: 'm10_d', text: '8,2' },
    ],
    correctOptionId: 'm10_b',
    hint: 'Tính tổng điểm của cả 4 bạn rồi chia cho 4.',
    explanation: 'Trung bình cộng là $\\frac{7 + 8 + 8 + 9}{4} = \\frac{32}{4} = 8,0$.',
    topic: 'Thống kê THCS',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  // Level 11–15 (Vận dụng)
  {
    questionId: 'c01_math_11',
    stem: 'Giá trị của $x$ thỏa mãn phương trình $3x - 7 = 14$ là:',
    options: [
      { optionId: 'm11_a', text: 'x = 7/3' },
      { optionId: 'm11_b', text: 'x = 7' },
      { optionId: 'm11_c', text: 'x = 21' },
      { optionId: 'm11_d', text: 'x = -7' },
    ],
    correctOptionId: 'm11_b',
    hint: 'Chuyển hạng tử $-7$ sang vế phải và đổi dấu thành $+7$, sau đó chia cả hai vế cho 3.',
    explanation: 'Ta có $3x - 7 = 14 \\Rightarrow 3x = 14 + 7 = 21 \\Rightarrow x = 21 : 3 = 7$.',
    topic: 'Biểu thức & Phương trình',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_12',
    stem: 'Khai triển hằng đẳng thức $(a + b)^2$ ta được biểu thức nào sau đây?',
    options: [
      { optionId: 'm12_a', text: 'a² + b²' },
      { optionId: 'm12_b', text: 'a² + 2ab + b²' },
      { optionId: 'm12_c', text: 'a² - 2ab + b²' },
      { optionId: 'm12_d', text: 'a² - b²' },
    ],
    correctOptionId: 'm12_b',
    hint: 'Bình phương của một tổng bằng bình phương số thứ nhất cộng hai lần tích hai số cộng bình phương số thứ hai.',
    explanation: 'Hằng đẳng thức bình phương của một tổng: $(a + b)^2 = a^2 + 2ab + b^2$. Học sinh rất dễ quên hạng tử $2ab$.',
    topic: 'Đại số 8',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_13',
    stem: 'Một tam giác vuông có cạnh huyền bằng $10\\text{ cm}$ và một cạnh góc vuông bằng $6\\text{ cm}$. Độ dài cạnh góc vuông còn lại là:',
    options: [
      { optionId: 'm13_a', text: '4 cm' },
      { optionId: 'm13_b', text: '8 cm' },
      { optionId: 'm13_c', text: '16 cm' },
      { optionId: 'm13_d', text: '64 cm' },
    ],
    correctOptionId: 'm13_b',
    hint: 'Áp dụng định lí Pythagore: bình phương cạnh góc vuông cần tìm bằng bình phương cạnh huyền trừ bình phương cạnh góc vuông đã biết.',
    explanation: 'Theo định lí Pythagore: $b = \\sqrt{10^2 - 6^2} = \\sqrt{100 - 36} = \\sqrt{64} = 8\\text{ cm}$.',
    topic: 'Hình học 8',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_14',
    stem: 'Gieo một con xúc xắc cân đối và đồng chất 1 lần. Xác suất của biến cố “Số chấm xuất hiện là số chẵn” bằng bao nhiêu?',
    options: [
      { optionId: 'm14_a', text: '1/6' },
      { optionId: 'm14_b', text: '1/3' },
      { optionId: 'm14_c', text: '1/2' },
      { optionId: 'm14_d', text: '2/3' },
    ],
    correctOptionId: 'm14_c',
    hint: 'Trong 6 mặt (1, 2, 3, 4, 5, 6), hãy đếm xem có bao nhiêu kết quả thuận lợi là số chẵn.',
    explanation: 'Có 3 kết quả thuận lợi là {2; 4; 6} trong tổng số 6 kết quả đồng khả năng, nên xác suất là $P = \\frac{3}{6} = \\frac{1}{2}$.',
    topic: 'Xác suất THCS',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_15',
    stem: 'Một hình thoi có độ dài hai đường chéo lần lượt là $6\\text{ cm}$ và $8\\text{ cm}$. Diện tích của hình thoi đó bằng:',
    options: [
      { optionId: 'm15_a', text: '48 cm²' },
      { optionId: 'm15_b', text: '24 cm²' },
      { optionId: 'm15_c', text: '14 cm²' },
      { optionId: 'm15_d', text: '28 cm²' },
    ],
    correctOptionId: 'm15_b',
    hint: 'Diện tích hình thoi bằng nửa tích độ dài hai đường chéo.',
    explanation: 'Diện tích hình thoi là $S = \\frac{1}{2} \\cdot d_1 \\cdot d_2 = \\frac{1}{2} \\cdot 6 \\cdot 8 = 24\\text{ cm}^2$.',
    topic: 'Hình học THCS',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  // 3 Reserve Questions for "Đổi câu hỏi"
  {
    questionId: 'c01_math_res_01',
    stem: 'Ước chung lớn nhất của hai số $12$ và $18$ là số nào?',
    options: [
      { optionId: 'mr1_a', text: '2' },
      { optionId: 'mr1_b', text: '3' },
      { optionId: 'mr1_c', text: '6' },
      { optionId: 'mr1_d', text: '36' },
    ],
    correctOptionId: 'mr1_c',
    hint: 'Tìm số tự nhiên lớn nhất mà cả 12 và 18 đều chia hết cho số đó.',
    explanation: 'Ta có $12 = 2^2 \\cdot 3$ và $18 = 2 \\cdot 3^2$, nên $\\text{ƯCLN}(12, 18) = 2 \\cdot 3 = 6$ (còn $36$ là BCNN).',
    topic: 'Số học 6',
    difficulty: 1,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_res_02',
    stem: 'Một chiếc áo có giá niêm yết $200\\,000$ đồng, nhân dịp khuyến mãi được giảm giá $20\\%$. Giá bán của chiếc áo sau khi giảm là:',
    options: [
      { optionId: 'mr2_a', text: '180 000 đồng' },
      { optionId: 'mr2_b', text: '160 000 đồng' },
      { optionId: 'mr2_c', text: '140 000 đồng' },
      { optionId: 'mr2_d', text: '40 000 đồng' },
    ],
    correctOptionId: 'mr2_b',
    hint: 'Giảm 20% tức là người mua chỉ phải trả 80% giá niêm yết.',
    explanation: 'Số tiền được giảm là $200\\,000 \\times 20\\% = 40\\,000$ đồng. Giá sau giảm là $200\\,000 - 40\\,000 = 160\\,000$ đồng.',
    topic: 'Toán thực tế THCS',
    difficulty: 2,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
  {
    questionId: 'c01_math_res_03',
    stem: 'Tổng số đo bốn góc trong của một tứ giác lồi bất kì luôn bằng bao nhiêu độ?',
    options: [
      { optionId: 'mr3_a', text: '180°' },
      { optionId: 'mr3_b', text: '270°' },
      { optionId: 'mr3_c', text: '360°' },
      { optionId: 'mr3_d', text: '540°' },
    ],
    correctOptionId: 'mr3_c',
    hint: 'Một đường chéo chia tứ giác thành hai tam giác không có điểm trong chung.',
    explanation: 'Tổng các góc của một tứ giác bằng tổng các góc của hai tam giác tạo thành: $180^\\circ \\times 2 = 360^\\circ$.',
    topic: 'Hình học 8',
    difficulty: 3,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
];

export const SAMPLE_C01_INFORMATICS_QUESTIONS: C01QuestionItem[] = [
  // Level 1–5 (Nhận biết)
  {
    questionId: 'c01_info_01',
    stem: 'Trong Tin học, những gì mang lại sự hiểu biết cho con người về thế giới xung quanh được gọi là gì?',
    options: [
      { optionId: 'i01_a', text: 'Thông tin' },
      { optionId: 'i01_b', text: 'Phần cứng' },
      { optionId: 'i01_c', text: 'Thiết bị nhớ' },
      { optionId: 'i01_d', text: 'Bàn phím' },
    ],
    correctOptionId: 'i01_a',
    hint: 'Con người tiếp nhận nội dung này qua các giác quan khi đọc sách, nghe giảng hoặc xem thời sự.',
    explanation: 'Thông tin là những gì đem lại sự hiểu biết cho con người; khi được biểu diễn trên vật mang tin thì trở thành dữ liệu.',
    topic: 'Thông tin & Dữ liệu',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_02',
    stem: 'Thiết bị nào sau đây dùng để hiển thị hình ảnh và kết quả xử lí của máy tính ra cho người dùng xem?',
    options: [
      { optionId: 'i02_a', text: 'Chuột máy tính' },
      { optionId: 'i02_b', text: 'Màn hình' },
      { optionId: 'i02_c', text: 'Bàn phím' },
      { optionId: 'i02_d', text: 'Micro' },
    ],
    correctOptionId: 'i02_b',
    hint: 'Đây là thiết bị ra (Output) chuẩn có bề mặt phát sáng giống như màn hình tivi.',
    explanation: 'Màn hình (Monitor) là thiết bị xuất hiển thị văn bản, hình ảnh, video. Chuột, bàn phím và micro đều là thiết bị nhập.',
    topic: 'Thiết bị máy tính',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_03',
    stem: 'Đơn vị cơ bản dùng để lưu trữ thông tin có đặt tên trên ổ đĩa máy tính được gọi là gì?',
    options: [
      { optionId: 'i03_a', text: 'Tệp (File)' },
      { optionId: 'i03_b', text: 'Thanh tác vụ' },
      { optionId: 'i03_c', text: 'Con trỏ chuột' },
      { optionId: 'i03_d', text: 'Nút nguồn' },
    ],
    correctOptionId: 'i03_a',
    hint: 'Mỗi đơn vị này thường có phần tên và phần mở rộng như .docx, .pptx, .jpg.',
    explanation: 'Tệp (File) là đơn vị lưu trữ dữ liệu có tên trên thiết bị nhớ, được sắp xếp bên trong các thư mục.',
    topic: 'Tệp & Thư mục',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_04',
    stem: 'Trên máy tính, công cụ dùng để chứa và phân loại các tệp cùng các thư mục con theo cấu trúc hình cây là gì?',
    options: [
      { optionId: 'i04_a', text: 'Thư mục (Folder)' },
      { optionId: 'i04_b', text: 'Trình duyệt web' },
      { optionId: 'i04_c', text: 'Phím tắt' },
      { optionId: 'i04_d', text: 'Máy quét' },
    ],
    correctOptionId: 'i04_a',
    hint: 'Thường có biểu tượng hình kẹp hồ sơ màu vàng trong hệ điều hành.',
    explanation: 'Thư mục (Folder) giúp tổ chức, quản lí tệp và thư mục con một cách khoa học, dễ tìm kiếm.',
    topic: 'Tệp & Thư mục',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_05',
    stem: 'Phần mềm nào dưới đây là trình duyệt web dùng để truy cập các trang thông tin trên Internet?',
    options: [
      { optionId: 'i05_a', text: 'Google Chrome' },
      { optionId: 'i05_b', text: 'Microsoft Paint' },
      { optionId: 'i05_c', text: 'Calculator' },
      { optionId: 'i05_d', text: 'Windows Explorer' },
    ],
    correctOptionId: 'i05_a',
    hint: 'Các phần mềm cùng nhóm với phần mềm này gồm Mozilla Firefox, Microsoft Edge và Safari.',
    explanation: 'Google Chrome là trình duyệt web (Web Browser). Paint là phần mềm vẽ, Calculator là máy tính bỏ túi.',
    topic: 'Internet cơ bản',
    difficulty: 1,
    allowShuffle: true,
    isSample: true,
  },
  // Level 6–10 (Thông hiểu)
  {
    questionId: 'c01_info_06',
    stem: 'Trong hệ thống đo lượng dữ liệu chuẩn, $1\\text{ Byte}$ bằng bao nhiêu $\\text{bit}$?',
    options: [
      { optionId: 'i06_a', text: '2 bit' },
      { optionId: 'i06_b', text: '4 bit' },
      { optionId: 'i06_c', text: '8 bit' },
      { optionId: 'i06_d', text: '10 bit' },
    ],
    correctOptionId: 'i06_c',
    hint: 'Đây là một lũy thừa của 2 ($2^3$).',
    explanation: '1 Byte gồm đúng 8 bit (mỗi bit nhận giá trị 0 hoặc 1).',
    topic: 'Biểu diễn dữ liệu',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_07',
    stem: 'Dãy hữu hạn các thao tác được sắp xếp theo trình tự xác định để từ đầu vào (Input) tìm ra đầu ra (Output) được gọi là gì?',
    options: [
      { optionId: 'i07_a', text: 'Thuật toán' },
      { optionId: 'i07_b', text: 'Hệ điều hành' },
      { optionId: 'i07_c', text: 'Thư điện tử' },
      { optionId: 'i07_d', text: 'Mạng cục bộ' },
    ],
    correctOptionId: 'i07_a',
    hint: 'Khái niệm này thường được biểu diễn bằng sơ đồ khối trước khi viết chương trình.',
    explanation: 'Thuật toán (Algorithm) là dãy hữu hạn các bước rõ ràng để giải quyết một bài toán từ Input đến Output.',
    topic: 'Thuật toán & Lập trình',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_08',
    stem: 'Khi soạn thảo văn bản trên máy tính, tổ hợp phím tắt chuẩn nào dùng để Sao chép (Copy) phần nội dung đang chọn?',
    options: [
      { optionId: 'i08_a', text: 'Ctrl + V' },
      { optionId: 'i08_b', text: 'Ctrl + C' },
      { optionId: 'i08_c', text: 'Ctrl + X' },
      { optionId: 'i08_d', text: 'Ctrl + Z' },
    ],
    correctOptionId: 'i08_b',
    hint: 'Chữ cái trong tổ hợp phím này là chữ cái đầu của từ Copy.',
    explanation: 'Ctrl + C dùng để sao chép (Copy); Ctrl + V là dán (Paste); Ctrl + X là cắt (Cut); Ctrl + Z là hoàn tác (Undo).',
    topic: 'Soạn thảo văn bản',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_09',
    stem: 'Trong phần mềm bảng tính, công thức bắt đầu bằng kí tự nào để chương trình thực hiện tính toán?',
    options: [
      { optionId: 'i09_a', text: 'Dấu bằng (=)' },
      { optionId: 'i09_b', text: 'Dấu chấm hỏi (?)' },
      { optionId: 'i09_c', text: 'Dấu thăng (#)' },
      { optionId: 'i09_d', text: 'Dấu hai chấm (:)' },
    ],
    correctOptionId: 'i09_a',
    hint: 'Kí hiệu toán học quen thuộc dùng khi viết kết quả của một phép tính.',
    explanation: 'Mọi công thức và hàm trong ô bảng tính đều bắt đầu bằng dấu bằng (=), ví dụ: =A1+B1 hoặc =SUM(A1:A5).',
    topic: 'Bảng tính điện tử',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_10',
    stem: 'Hành động nào sau đây giúp bảo vệ an toàn thông tin cá nhân khi sử dụng mạng Internet?',
    options: [
      { optionId: 'i10_a', text: 'Chia sẻ mật khẩu tài khoản cho mọi người trong nhóm chat' },
      { optionId: 'i10_b', text: 'Đặt mật khẩu mạnh kết hợp chữ hoa, chữ thường, số và kí tự đặc biệt' },
      { optionId: 'i10_c', text: 'Bấm vào mọi đường liên kết lạ nhận được qua tin nhắn' },
      { optionId: 'i10_d', text: 'Dùng ngày sinh làm mật khẩu cho tất cả tài khoản' },
    ],
    correctOptionId: 'i10_b',
    hint: 'Hãy chọn thói quen giúp tài khoản khó bị kẻ xấu dò đoán hoặc chiếm quyền.',
    explanation: 'Đặt mật khẩu mạnh và giữ bí mật mật khẩu là nguyên tắc cốt lõi của an toàn số.',
    topic: 'An toàn số',
    difficulty: 2,
    allowShuffle: true,
    isSample: true,
  },
  // Level 11–15 (Vận dụng)
  {
    questionId: 'c01_info_11',
    stem: 'Trong sơ đồ khối mô tả thuật toán, hình thoi được sử dụng để biểu diễn thao tác nào?',
    options: [
      { optionId: 'i11_a', text: 'Bắt đầu hoặc kết thúc thuật toán' },
      { optionId: 'i11_b', text: 'Kiểm tra điều kiện rẽ nhánh (Đúng / Sai)' },
      { optionId: 'i11_c', text: 'Phép gán giá trị tuần tự' },
      { optionId: 'i11_d', text: 'Đường đi của luồng dữ liệu' },
    ],
    correctOptionId: 'i11_b',
    hint: 'Hình này có các góc nhọn rẽ sang hai nhánh Đúng và Sai.',
    explanation: 'Trong sơ đồ khối chuẩn: Hình thoi biểu diễn kiểm tra điều kiện; hình chữ nhật biểu diễn phép tính/xử lí; hình elip biểu diễn bắt đầu/kết thúc.',
    topic: 'Thuật toán & Sơ đồ khối',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_12',
    stem: 'Trong bảng tính, giả sử các ô A1, A2, A3 lần lượt chứa các số $4, 6, 8$. Công thức `=AVERAGE(A1:A3)` cho kết quả là bao nhiêu?',
    options: [
      { optionId: 'i12_a', text: '18' },
      { optionId: 'i12_b', text: '6' },
      { optionId: 'i12_c', text: '8' },
      { optionId: 'i12_d', text: '3' },
    ],
    correctOptionId: 'i12_b',
    hint: 'Hàm AVERAGE dùng để tính giá trị trung bình cộng của các số trong vùng dữ liệu.',
    explanation: 'Hàm `AVERAGE(A1:A3)` tính trung bình cộng: $(4 + 6 + 8) : 3 = 18 : 3 = 6$ (còn $18$ là kết quả của hàm `SUM`).',
    topic: 'Bảng tính điện tử',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_13',
    stem: ' Bộ phận nào trong máy tính đóng vai trò là “bộ não” thực hiện các phép tính số học, logic và điều khiển mọi hoạt động của máy?',
    options: [
      { optionId: 'i13_a', text: 'Bộ xử lí trung tâm (CPU)' },
      { optionId: 'i13_b', text: 'Vỏ máy tính (Case)' },
      { optionId: 'i13_c', text: 'Chuột quang' },
      { optionId: 'i13_d', text: 'Loa máy tính' },
    ],
    correctOptionId: 'i13_a',
    hint: 'Tên viết tắt của bộ phận này gồm 3 chữ cái: Central Processing Unit.',
    explanation: 'CPU (Central Processing Unit) là bộ xử lí trung tâm, đảm nhiệm việc thực thi chương trình và điều khiển hoạt động của toàn hệ thống.',
    topic: 'Kiến trúc máy tính',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_14',
    stem: 'Khi tìm kiếm thông tin trên máy tìm kiếm, để tìm chính xác một cụm từ nguyên vẹn theo đúng thứ tự từ, ta nên đặt cụm từ đó trong cặp dấu nào?',
    options: [
      { optionId: 'i14_a', text: 'Dấu ngoặc kép " "' },
      { optionId: 'i14_b', text: 'Dấu ngoặc vuông [ ]' },
      { optionId: 'i14_c', text: 'Dấu gạch chéo / /' },
      { optionId: 'i14_d', text: 'Dấu chấm than ! !' },
    ],
    correctOptionId: 'i14_a',
    hint: 'Kí hiệu chính tả dùng khi trích dẫn nguyên văn lời nói trực tiếp.',
    explanation: 'Đặt từ khóa trong dấu ngoặc kép `" "` giúp máy tìm kiếm trả về các trang chứa chính xác cụm từ đó theo đúng thứ tự.',
    topic: 'Tìm kiếm thông tin',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_15',
    stem: 'Một vòng lặp kiểm tra điều kiện $i \\le 5$ với giá trị ban đầu $i = 1$, sau mỗi lần lặp $i$ tăng thêm $2$ đơn vị. Thân vòng lặp sẽ thực hiện bao nhiêu lần?',
    options: [
      { optionId: 'i15_a', text: '2 lần' },
      { optionId: 'i15_b', text: '3 lần' },
      { optionId: 'i15_c', text: '5 lần' },
      { optionId: 'i15_d', text: '6 lần' },
    ],
    correctOptionId: 'i15_b',
    hint: 'Hãy liệt kê lần lượt các giá trị của biến i thỏa mãn i ≤ 5 bắt đầu từ 1 với bước nhảy +2.',
    explanation: 'Các giá trị của $i$ thỏa mãn $i \\le 5$ là $i = 1$, $i = 3$, $i = 5$ (khi $i$ tăng lên $7$ thì $7 > 5$ nên dừng). Vậy vòng lặp thực hiện đúng 3 lần.',
    topic: 'Thuật toán & Lập trình',
    difficulty: 3,
    allowShuffle: true,
    isSample: true,
  },
  // 3 Reserve Questions for "Đổi câu hỏi"
  {
    questionId: 'c01_info_res_01',
    stem: 'Phần mở rộng nào sau đây thường là của tệp hình ảnh?',
    options: [
      { optionId: 'ir1_a', text: '.png' },
      { optionId: 'ir1_b', text: '.mp3' },
      { optionId: 'ir1_c', text: '.exe' },
      { optionId: 'ir1_d', text: '.xlsx' },
    ],
    correctOptionId: 'ir1_a',
    hint: 'Các tệp cùng nhóm với định dạng này là .jpg và .webp.',
    explanation: 'Định dạng `.png` là tệp hình ảnh; `.mp3` là âm thanh; `.exe` là tệp chương trình thực thi; `.xlsx` là bảng tính.',
    topic: 'Tệp & Định dạng',
    difficulty: 1,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_res_02',
    stem: 'Khi nhận được một email từ người lạ thông báo “Bạn đã trúng thưởng lớn, hãy nhập mật khẩu tài khoản để nhận quà”, em nên ứng xử thế nào?',
    options: [
      { optionId: 'ir2_a', text: 'Nhập mật khẩu ngay để không bỏ lỡ phần thưởng' },
      { optionId: 'ir2_b', text: 'Không bấm vào liên kết lạ, không cung cấp mật khẩu và báo với thầy cô/cha mẹ' },
      { optionId: 'ir2_c', text: 'Chuyển tiếp email đó cho tất cả bạn bè trong lớp' },
      { optionId: 'ir2_d', text: 'Trả lời email kèm số điện thoại và địa chỉ nhà' },
    ],
    correctOptionId: 'ir2_b',
    hint: 'Đây là dấu hiệu điển hình của thư giả mạo lừa đảo (Phishing) trên không gian mạng.',
    explanation: 'Tuyệt đối không cung cấp mật khẩu hoặc bấm vào đường dẫn đáng ngờ từ người lạ để phòng tránh tấn công lừa đảo trực tuyến.',
    topic: 'An toàn số',
    difficulty: 2,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
  {
    questionId: 'c01_info_res_03',
    stem: 'Trong cấu trúc rẽ nhánh `NẾU <điều kiện> THÌ <câu lệnh 1> KHÔNG THÌ <câu lệnh 2>`, khi `<điều kiện>` có giá trị SAI thì máy tính thực hiện gì?',
    options: [
      { optionId: 'ir3_a', text: 'Thực hiện <câu lệnh 1>' },
      { optionId: 'ir3_b', text: 'Thực hiện <câu lệnh 2>' },
      { optionId: 'ir3_c', text: 'Thực hiện cả hai câu lệnh' },
      { optionId: 'ir3_d', text: 'Tắt máy tính ngay lập tức' },
    ],
    correctOptionId: 'ir3_b',
    hint: 'Nhánh sau cụm từ KHÔNG THÌ (ELSE) được dành riêng cho trường hợp điều kiện không thỏa mãn.',
    explanation: 'Khi điều kiện đúng thì máy thực hiện `<câu lệnh 1>`, còn khi điều kiện sai thì máy chuyển sang thực hiện `<câu lệnh 2>`.',
    topic: 'Thuật toán & Lập trình',
    difficulty: 3,
    allowShuffle: true,
    isReserve: true,
    isSample: true,
  },
];

// ============================================================================
// QUESTION VALIDATION & CONVERSION FROM SYSTEM QUESTION BANK
// ============================================================================

export function validateC01QuestionPool(rawItems: C01QuestionItem[]): {
  mainCandidates: C01QuestionItem[];
  reserveCandidates: C01QuestionItem[];
} {
  const mainCandidates: C01QuestionItem[] = [];
  const reserveCandidates: C01QuestionItem[] = [];
  const seenQIds = new Set<string>();

  for (const item of rawItems) {
    if (!item || !item.questionId || seenQIds.has(item.questionId)) continue;
    const stem = (item.stem || '').trim();
    if (!stem) continue;
    if (!Array.isArray(item.options) || item.options.length !== 4) continue;

    // Check unique optionIds and non-empty text
    const optIds = new Set<string>();
    const optTexts = new Set<string>();
    let validOpts = true;
    for (const o of item.options) {
      const txt = (o.text || '').trim();
      if (!o.optionId || !txt || optIds.has(o.optionId)) {
        validOpts = false;
        break;
      }
      const normTxt = txt.toLowerCase();
      if (optTexts.has(normTxt)) {
        validOpts = false;
        break;
      }
      optIds.add(o.optionId);
      optTexts.add(normTxt);
    }
    if (!validOpts) continue;
    if (!optIds.has(item.correctOptionId)) continue;

    seenQIds.add(item.questionId);
    if (item.isReserve) {
      reserveCandidates.push(item);
    } else {
      mainCandidates.push(item);
    }
  }

  return { mainCandidates, reserveCandidates };
}

// ============================================================================
// WEB AUDIO SOUND ENGINE FOR C01 (ORIGINAL ACADEMIC GAMESHOW SOUNDS)
// ============================================================================

class C01SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public stopAll(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  public playSelectOption(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playLockSuspense(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  public playCorrect(muted: boolean, isMilestone = false): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isMilestone
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.075);
      gain.gain.setValueAtTime(0.13, now + idx * 0.075);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.26);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.075);
      osc.stop(now + idx * 0.075 + 0.27);
    });
  }

  public playWrong(muted: boolean): void {
    if (muted) return;
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(155, now + 0.28);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.31);
  }
}

const c01Sound = new C01SoundEngine();

// ============================================================================
// 3D KNOWLEDGE CUP SVG FOR THE TOP OF THE LADDER
// ============================================================================

const KnowledgeTrophy3DSVG: React.FC<{ className?: string }> = ({
  className = 'w-12 h-12',
}) => (
  <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="c01GoldGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FEF08A" />
        <stop offset="50%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="c01GemGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="100%" stopColor="#1D4ED8" />
      </linearGradient>
    </defs>
    <circle cx="40" cy="40" r="34" fill="#F59E0B" fillOpacity="0.16" />
    <path
      d="M24,16 H56 V32 C56,43 49,50 40,50 C31,50 24,43 24,32 Z"
      fill="url(#c01GoldGrad)"
      stroke="#FEF9C3"
      strokeWidth="2"
    />
    <path
      d="M24,20 H15 C15,31 20,36 25,36 M56,20 H65 C65,31 60,36 55,36"
      fill="none"
      stroke="#FDE047"
      strokeWidth="3.5"
      strokeLinecap="round"
    />
    <polygon points="40,21 46,29 40,37 34,29" fill="url(#c01GemGrad)" stroke="#E0F2FE" strokeWidth="1.5" />
    <rect x="36" y="50" width="8" height="11" rx="2" fill="url(#c01GoldGrad)" />
    <rect x="25" y="61" width="30" height="8" rx="3" fill="#B45309" stroke="#FEF08A" strokeWidth="1.5" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT: MILLIONAIRE 3D GAME (C01 - AI LÀ TRIỆU PHÚ 3D)
// ============================================================================

export const Millionaire3DGame: React.FC<Millionaire3DGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set(),
  questions = [],
  resolvedClassName = 'Lớp học',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
  onPick,
}) => {
  // --------------------------------------------------------------------------
  // 1. SETUP CONFIGURATION STATE (WITH REQUIRED DEFAULTS)
  // --------------------------------------------------------------------------
  const [datasetKey, setDatasetKey] = useState<C01DatasetKey>('SAMPLE_MATH');
  const [questionCount, setQuestionCount] = useState<C01QuestionCount>(10); // Default: 10
  const [playMode, setPlayMode] = useState<C01PlayMode>('PRACTICE'); // Default: Luyện tập
  const [orgMode, setOrgMode] = useState<C01OrgMode>('CLASS'); // Default: Cả lớp
  const [timeLimitSec, setTimeLimitSec] = useState<number>(0); // Default: 0 (Không giới hạn)
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [readBeforeTimer, setReadBeforeTimer] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  const [enabledLifelines, setEnabledLifelines] = useState<Record<C01LifelineKey, boolean>>({
    FIFTY_FIFTY: true,
    CLASS_POLL: true,
    KNOWLEDGE_HINT: true,
    SWAP_QUESTION: true,
  });

  // --------------------------------------------------------------------------
  // 2. ACTIVE SESSION STATE
  // --------------------------------------------------------------------------
  const [phase, setPhase] = useState<C01StagePhase>('SETUP');
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionQuestions, setSessionQuestions] = useState<C01QuestionItem[]>([]);
  const [sessionOptionsMap, setSessionOptionsMap] = useState<Record<string, C01DisplayOption[]>>({});
  const [reserveQuestions, setReserveQuestions] = useState<C01QuestionItem[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);

  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0); // 0..questionCount-1
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [eliminatedOptionIds, setEliminatedOptionIds] = useState<string[]>([]);
  const [activeHintText, setActiveHintText] = useState<string | null>(null);

  // Lifelines used in session & on current step
  const [usedLifelines, setUsedLifelines] = useState<C01LifelineKey[]>([]);
  const [stepLifelinesUsed, setStepLifelinesUsed] = useState<C01LifelineKey[]>([]);
  const [lifelineNotice, setLifelineNotice] = useState<string | null>(null);

  // Class Poll ("Hỏi cả lớp") real input state
  const [pollTotalParticipants, setPollTotalParticipants] = useState<number>(30);
  const [pollVotes, setPollVotes] = useState<Record<'A' | 'B' | 'C' | 'D', number>>({
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  });
  const [pollConfirmedResults, setPollConfirmedResults] = useState<
    Record<'A' | 'B' | 'C' | 'D', number> | null
  >(null);
  const [pollError, setPollError] = useState<string | null>(null);

  // Scoring & Progress state
  const [practiceScore, setPracticeScore] = useState<number>(0);
  const [conquestSolvedCount, setConquestSolvedCount] = useState<number>(0);
  const [finalSessionScore, setFinalSessionScore] = useState<number>(0);
  const [highestStepReached, setHighestStepReached] = useState<number>(0);
  const [endReason, setEndReason] = useState<C01EndReason>(null);
  const [historyItems, setHistoryItems] = useState<C01QuestionHistoryItem[]>([]);
  const [activeStudent, setActiveStudent] = useState<StudentCandidate | null>(null);

  // Timer, Reading before timer & Locks
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isWaitingForPreRead, setIsWaitingForPreRead] = useState<boolean>(false);
  const deadlineMsRef = useRef<number | null>(null);
  const pausedRemainingMsRef = useRef<number | null>(null);
  const phaseBeforePauseRef = useRef<C01StagePhase>('ANSWERING');
  const evaluatedStepLockRef = useRef<string | null>(null);
  const suspenseTimerRef = useRef<number | null>(null);

  // Modals & UI Toggles
  const [showWalkAwayConfirm, setShowWalkAwayConfirm] = useState<boolean>(false);
  const [showMobileLadderDrawer, setShowMobileLadderDrawer] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [zoomedQuestion, setZoomedQuestion] = useState<string | null>(null);
  const [confirmExitModal, setConfirmExitModal] = useState<'SETUP' | 'LIBRARY' | 'REPLAY' | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [hasRestorableSession, setHasRestorableSession] = useState<boolean>(false);

  const voiceManagerRef = useRef<SpaceRocketVoiceManager | null>(null);
  if (!voiceManagerRef.current && typeof window !== 'undefined') {
    voiceManagerRef.current = new SpaceRocketVoiceManager();
  }

  useEffect(() => {
    return () => {
      voiceManagerRef.current?.cancel();
      c01Sound.stopAll();
      if (suspenseTimerRef.current) {
        window.clearTimeout(suspenseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isMuted) {
      voiceManagerRef.current?.cancel();
      c01Sound.stopAll();
    }
  }, [isMuted]);

  const presentStudents = useMemo(() => {
    const base = allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates;
    return base.filter((st) => !absentIds.has(st.id));
  }, [allCandidates, availableCandidates, absentIds]);

  // --------------------------------------------------------------------------
  // 3. CONVERT SYSTEM QUESTION BANK & VALIDATE POOL
  // --------------------------------------------------------------------------
  const convertedBankPool = useMemo<C01QuestionItem[]>(() => {
    if (!questions || questions.length === 0) return [];
    const list: C01QuestionItem[] = [];

    for (const q of questions) {
      if (!q || !q.stem || !Array.isArray(q.options) || q.options.length !== 4) continue;
      const target = (q.correctAnswer || '').trim().toLowerCase();
      if (!target) continue;

      const builtOpts: C01OptionItem[] = q.options.map((opt, idx) => ({
        optionId: `${q.id}_opt_${opt.id || opt.label || idx}`,
        text: (opt.text || '').trim(),
      }));

      const matchedIdx = q.options.findIndex(
        (opt) =>
          (opt.id || '').trim().toLowerCase() === target ||
          (opt.label || '').trim().toLowerCase() === target ||
          (opt.text || '').trim().toLowerCase() === target
      );
      if (matchedIdx < 0) continue;

      const diffNum: 1 | 2 | 3 =
        q.level === 'know'
          ? 1
          : q.level === 'understand'
          ? 2
          : q.level === 'apply' || q.level === 'high_apply'
          ? 3
          : 2;

      list.push({
        questionId: `bank_${q.id}`,
        stem: q.stem.trim(),
        options: builtOpts,
        correctOptionId: builtOpts[matchedIdx].optionId,
        explanation:
          (q.explanation || '').trim() ||
          `Đáp án chính xác là: ${builtOpts[matchedIdx].text}.`,
        hint: q.explanation
          ? `Gợi ý suy luận: Hãy chú ý khái niệm trọng tâm trong bài ${q.lesson || q.chapter || 'học'}.`
          : undefined,
        topic: q.chapter || q.subject || 'Ngân hàng câu hỏi',
        difficulty: diffNum,
        allowShuffle: true,
        isReserve: false,
        isSample: false,
      });
    }

    return list;
  }, [questions]);

  const validatedPool = useMemo(() => {
    if (datasetKey === 'SAMPLE_MATH') {
      return validateC01QuestionPool(SAMPLE_C01_MATH_QUESTIONS);
    }
    if (datasetKey === 'SAMPLE_INFORMATICS') {
      return validateC01QuestionPool(SAMPLE_C01_INFORMATICS_QUESTIONS);
    }
    const validatedBank = validateC01QuestionPool(convertedBankPool);
    // Split bank into main and up to 3 reserve questions if enough
    if (validatedBank.mainCandidates.length > questionCount) {
      return {
        mainCandidates: validatedBank.mainCandidates.slice(0, questionCount),
        reserveCandidates: validatedBank.mainCandidates
          .slice(questionCount, questionCount + 3)
          .map((q) => ({ ...q, isReserve: true })),
      };
    }
    return validatedBank;
  }, [datasetKey, convertedBankPool, questionCount]);

  const availableMainCount = validatedPool.mainCandidates.length;
  const shortageCount = Math.max(0, questionCount - availableMainCount);

  // --------------------------------------------------------------------------
  // 4. LOCAL STORAGE SESSION PERSISTENCE (SCOPED TO C01 ONLY)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(C01_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === C01_STORAGE_VERSION &&
        parsed.sessionId &&
        Array.isArray(parsed.sessionQuestions) &&
        parsed.sessionQuestions.length > 0 &&
        parsed.phase &&
        parsed.phase !== 'SETUP' &&
        parsed.phase !== 'FINISHED'
      ) {
        setHasRestorableSession(true);
      }
    } catch {
      window.localStorage.removeItem(C01_STORAGE_KEY);
    }
  }, []);

  const saveSessionToStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'SETUP' || phase === 'FINISHED' || !sessionId || sessionQuestions.length === 0) {
      return;
    }
    try {
      const payload = {
        version: C01_STORAGE_VERSION,
        savedAt: Date.now(),
        sessionId,
        datasetKey,
        questionCount,
        playMode,
        orgMode,
        timeLimitSec,
        shuffleOptions,
        enabledLifelines,
        sessionQuestions,
        sessionOptionsMap,
        reserveQuestions,
        usedQuestionIds,
        currentStepIdx,
        eliminatedOptionIds,
        activeHintText,
        usedLifelines,
        stepLifelinesUsed,
        pollConfirmedResults,
        practiceScore,
        conquestSolvedCount,
        highestStepReached,
        historyItems,
        remainingSeconds,
      };
      window.localStorage.setItem(C01_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    phase,
    sessionId,
    datasetKey,
    questionCount,
    playMode,
    orgMode,
    timeLimitSec,
    shuffleOptions,
    enabledLifelines,
    sessionQuestions,
    sessionOptionsMap,
    reserveQuestions,
    usedQuestionIds,
    currentStepIdx,
    eliminatedOptionIds,
    activeHintText,
    usedLifelines,
    stepLifelinesUsed,
    pollConfirmedResults,
    practiceScore,
    conquestSolvedCount,
    highestStepReached,
    historyItems,
    remainingSeconds,
  ]);

  useEffect(() => {
    if (phase !== 'SETUP' && phase !== 'FINISHED') {
      saveSessionToStorage();
    }
  }, [
    phase,
    currentStepIdx,
    usedLifelines,
    eliminatedOptionIds,
    practiceScore,
    conquestSolvedCount,
    historyItems,
    saveSessionToStorage,
  ]);

  const clearSavedSessionStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(C01_STORAGE_KEY);
      setHasRestorableSession(false);
    } catch {
      // Ignore
    }
  }, []);

  const handleRestoreSavedSession = () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(C01_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || data.version !== C01_STORAGE_VERSION) {
        clearSavedSessionStorage();
        return;
      }

      setSessionId(data.sessionId);
      setDatasetKey(data.datasetKey || 'SAMPLE_MATH');
      setQuestionCount(data.questionCount || 10);
      setPlayMode(data.playMode || 'PRACTICE');
      setOrgMode(data.orgMode || 'CLASS');
      setTimeLimitSec(typeof data.timeLimitSec === 'number' ? data.timeLimitSec : 0);
      setShuffleOptions(Boolean(data.shuffleOptions));
      if (data.enabledLifelines) setEnabledLifelines(data.enabledLifelines);
      setSessionQuestions(data.sessionQuestions || []);
      setSessionOptionsMap(data.sessionOptionsMap || {});
      setReserveQuestions(data.reserveQuestions || []);
      setUsedQuestionIds(data.usedQuestionIds || []);
      setCurrentStepIdx(data.currentStepIdx || 0);
      setEliminatedOptionIds(data.eliminatedOptionIds || []);
      setActiveHintText(data.activeHintText || null);
      setUsedLifelines(data.usedLifelines || []);
      setStepLifelinesUsed(data.stepLifelinesUsed || []);
      setPollConfirmedResults(data.pollConfirmedResults || null);
      setPracticeScore(data.practiceScore || 0);
      setConquestSolvedCount(data.conquestSolvedCount || 0);
      setHighestStepReached(data.highestStepReached || 0);
      setHistoryItems(data.historyItems || []);
      setSelectedOptionId(null);

      const savedRem = typeof data.remainingSeconds === 'number' ? data.remainingSeconds : 0;
      if (data.timeLimitSec > 0 && savedRem > 0) {
        setRemainingSeconds(savedRem);
        deadlineMsRef.current = Date.now() + savedRem * 1000;
      } else if (data.timeLimitSec > 0) {
        setRemainingSeconds(data.timeLimitSec);
        deadlineMsRef.current = Date.now() + data.timeLimitSec * 1000;
      } else {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
      }

      setHasRestorableSession(false);
      setPhase('ANSWERING');
    } catch {
      clearSavedSessionStorage();
    }
  };

  // --------------------------------------------------------------------------
  // 5. CURRENT QUESTION, OPTIONS & SCORING METRICS
  // --------------------------------------------------------------------------
  const currentQuestion = useMemo<C01QuestionItem | null>(
    () => sessionQuestions[currentStepIdx] || null,
    [sessionQuestions, currentStepIdx]
  );

  const currentDisplayOptions = useMemo<C01DisplayOption[]>(() => {
    if (!currentQuestion) return [];
    return (
      sessionOptionsMap[currentQuestion.questionId] ||
      buildSessionDisplayOptions(currentQuestion, false)
    );
  }, [currentQuestion, sessionOptionsMap]);

  const conquestMetrics = useMemo(
    () => computeConquestScores(conquestSolvedCount, questionCount),
    [conquestSolvedCount, questionCount]
  );

  const currentScoreDisplay =
    playMode === 'PRACTICE' ? practiceScore : conquestMetrics.currentScore;
  const safeHavenScoreDisplay =
    playMode === 'PRACTICE' ? 0 : conquestMetrics.safeHavenScore;

  const currentLadder = useMemo(() => getConquestLadder(questionCount), [questionCount]);

  // --------------------------------------------------------------------------
  // 6. START QUESTION CLOCK & OPTIONAL PRE-READ
  // --------------------------------------------------------------------------
  const startClockForCurrentQuestion = useCallback(
    (customSeconds?: number) => {
      const targetSec = typeof customSeconds === 'number' ? customSeconds : timeLimitSec;
      setIsWaitingForPreRead(false);
      if (targetSec > 0) {
        setRemainingSeconds(targetSec);
        deadlineMsRef.current = Date.now() + targetSec * 1000;
      } else {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
      }
      setPhase('ANSWERING');
    },
    [timeLimitSec]
  );

  const speakCurrentQuestionAndOptions = useCallback(
    (q: C01QuestionItem, opts: C01DisplayOption[]) => {
      const vm = voiceManagerRef.current;
      if (!vm) return false;
      const cleanStem = q.stem.replace(/\$+/g, '').trim();
      const optSpeech = opts
        .map((o) => `Phương án ${o.displayLabel}: ${o.text.replace(/\$+/g, '')}`)
        .join('. ');
      const fullSpeech = `Câu số ${currentStepIdx + 1}: ${cleanStem}. ${optSpeech}`;
      const outcome = vm.speakVietnamese(fullSpeech, isMuted);
      if (!outcome.spoken) {
        if (outcome.reason === 'muted_or_disabled') {
          setVoiceNotice('Âm thanh đang tắt. Hãy bật loa trên thanh công cụ để đọc câu hỏi.');
        } else {
          setVoiceNotice(
            'Trình duyệt hiện chưa có giọng đọc tiếng Việt (vi-VN). Học sinh vẫn có thể đọc câu hỏi trực tiếp trên màn hình.'
          );
        }
        setTimeout(() => setVoiceNotice(null), 3500);
        return false;
      }
      setVoiceNotice(null);
      return true;
    },
    [currentStepIdx, isMuted]
  );

  // --------------------------------------------------------------------------
  // 7. INITIALIZE NEW SESSION
  // --------------------------------------------------------------------------
  const handleStartSession = () => {
    if (availableMainCount < questionCount) return;

    const newSessionId = `c01_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Sort by difficulty ascending if difficulty metadata is present
    const sortedMain = [...validatedPool.mainCandidates].sort(
      (a, b) => (a.difficulty || 2) - (b.difficulty || 2)
    );
    const selectedMain = sortedMain.slice(0, questionCount);
    const reserves = [...validatedPool.reserveCandidates];

    // Pre-generate stable display options for all main and reserve questions once
    const optionsMap: Record<string, C01DisplayOption[]> = {};
    [...selectedMain, ...reserves].forEach((q) => {
      optionsMap[q.questionId] = buildSessionDisplayOptions(q, shuffleOptions);
    });

    setSessionId(newSessionId);
    setSessionQuestions(selectedMain);
    setSessionOptionsMap(optionsMap);
    setReserveQuestions(reserves);
    setUsedQuestionIds(selectedMain.map((q) => q.questionId));

    setCurrentStepIdx(0);
    setSelectedOptionId(null);
    setEliminatedOptionIds([]);
    setActiveHintText(null);
    setUsedLifelines([]);
    setStepLifelinesUsed([]);
    setLifelineNotice(null);
    setPollConfirmedResults(null);

    setPracticeScore(0);
    setConquestSolvedCount(0);
    setFinalSessionScore(0);
    setHighestStepReached(0);
    setEndReason(null);
    setHistoryItems([]);
    evaluatedStepLockRef.current = null;

    if (orgMode === 'INDIVIDUAL' && presentStudents.length > 0) {
      const rand = presentStudents[Math.floor(Math.random() * presentStudents.length)];
      setActiveStudent(rand);
    } else {
      setActiveStudent(null);
    }

    if (presentStudents.length > 0) {
      setPollTotalParticipants(presentStudents.length);
    }

    c01Sound.playSelectOption(isMuted);

    const firstQ = selectedMain[0];
    const firstOpts = optionsMap[firstQ.questionId];

    if (readBeforeTimer && timeLimitSec > 0 && !isMuted) {
      setIsWaitingForPreRead(true);
      setRemainingSeconds(timeLimitSec);
      deadlineMsRef.current = null;
      setPhase('ANSWERING');
      const startedSpeech = speakCurrentQuestionAndOptions(firstQ, firstOpts);
      if (!startedSpeech) {
        startClockForCurrentQuestion(timeLimitSec);
      }
    } else {
      startClockForCurrentQuestion(timeLimitSec);
    }
  };

  // --------------------------------------------------------------------------
  // 8. LOCK ANSWER, TIMEOUT & WALK-AWAY HANDLERS
  // --------------------------------------------------------------------------
  const resolveCurrentStepOutcome = useCallback(
    (
      chosenOptionId: string | null,
      reason: 'SUBMITTED' | 'TIMEOUT' | 'WALK_AWAY',
      skipSuspense = false
    ) => {
      if (!currentQuestion) return;

      const stepNumber = currentStepIdx + 1;
      const lockKey = `${sessionId}_step_${stepNumber}_${currentQuestion.questionId}`;
      if (evaluatedStepLockRef.current === lockKey) return;
      evaluatedStepLockRef.current = lockKey;

      deadlineMsRef.current = null;
      setIsWaitingForPreRead(false);
      voiceManagerRef.current?.cancel();

      // Handle Walk Away ("Dừng và giữ điểm" in Conquest Mode before locking)
      if (reason === 'WALK_AWAY') {
        const keptScore = conquestMetrics.currentScore;
        setFinalSessionScore(keptScore);
        setEndReason('WALK_AWAY');
        setHistoryItems((prev) => [
          ...prev,
          {
            stepNumber,
            questionId: currentQuestion.questionId,
            stem: currentQuestion.stem,
            options: currentDisplayOptions,
            selectedOptionId: null,
            correctOptionId: currentQuestion.correctOptionId,
            explanation: currentQuestion.explanation,
            outcome: 'WALK_AWAY',
            lifelinesUsedOnStep: stepLifelinesUsed,
            scoreAfterStep: keptScore,
          },
        ]);
        setPhase('FINISHED');
        clearSavedSessionStorage();
        return;
      }

      const isCorrect =
        reason === 'SUBMITTED' &&
        chosenOptionId !== null &&
        chosenOptionId === currentQuestion.correctOptionId;

      const executeReveal = () => {
        if (suspenseTimerRef.current) {
          window.clearTimeout(suspenseTimerRef.current);
          suspenseTimerRef.current = null;
        }

        let nextScoreAfterStep = 0;

        if (playMode === 'PRACTICE') {
          nextScoreAfterStep = isCorrect ? practiceScore + 10 : practiceScore;
          setPracticeScore(nextScoreAfterStep);
          if (isCorrect) {
            setHighestStepReached(stepNumber);
            c01Sound.playCorrect(isMuted, false);
          } else {
            c01Sound.playWrong(isMuted);
          }
        } else {
          // CONQUEST MODE
          if (isCorrect) {
            const newSolved = currentStepIdx + 1;
            setConquestSolvedCount(newSolved);
            setHighestStepReached(newSolved);
            const updatedConquest = computeConquestScores(newSolved, questionCount);
            nextScoreAfterStep = updatedConquest.currentScore;
            const hitMilestone =
              isSafeHavenStep(stepNumber, questionCount) || stepNumber === questionCount;
            c01Sound.playCorrect(isMuted, hitMilestone);
          } else {
            // Wrong or Timeout in Conquest Mode drops to nearest Safe Haven reached
            nextScoreAfterStep = conquestMetrics.safeHavenScore;
            setFinalSessionScore(nextScoreAfterStep);
            setEndReason(reason === 'TIMEOUT' ? 'TIMEOUT' : 'WRONG_ANSWER');
            c01Sound.playWrong(isMuted);
          }
        }

        setHistoryItems((prev) => [
          ...prev,
          {
            stepNumber,
            questionId: currentQuestion.questionId,
            stem: currentQuestion.stem,
            options: currentDisplayOptions,
            selectedOptionId: chosenOptionId,
            correctOptionId: currentQuestion.correctOptionId,
            explanation: currentQuestion.explanation,
            outcome: isCorrect ? 'CORRECT' : reason === 'TIMEOUT' ? 'TIMEOUT' : 'WRONG',
            lifelinesUsedOnStep: stepLifelinesUsed,
            scoreAfterStep: nextScoreAfterStep,
          },
        ]);

        setPhase('EXPLANATION');
      };

      if (reason === 'TIMEOUT' || skipSuspense || reduceMotion) {
        executeReveal();
      } else {
        setPhase('LOCKED_SUSPENSE');
        c01Sound.playLockSuspense(isMuted);
        suspenseTimerRef.current = window.setTimeout(executeReveal, 850);
      }
    },
    [
      currentQuestion,
      currentStepIdx,
      sessionId,
      conquestMetrics,
      currentDisplayOptions,
      stepLifelinesUsed,
      clearSavedSessionStorage,
      playMode,
      practiceScore,
      isMuted,
      questionCount,
      reduceMotion,
    ]
  );

  // Skip suspense animation without changing outcome
  const handleSkipSuspense = () => {
    if (phase !== 'LOCKED_SUSPENSE' || !currentQuestion) return;
    if (suspenseTimerRef.current) {
      window.clearTimeout(suspenseTimerRef.current);
      suspenseTimerRef.current = null;
    }
    // Re-trigger immediate reveal by unlocking and calling with skipSuspense=true
    evaluatedStepLockRef.current = null;
    resolveCurrentStepOutcome(selectedOptionId, 'SUBMITTED', true);
  };

  // Advance to Next Question or Finish Session
  const handleProceedAfterExplanation = () => {
    voiceManagerRef.current?.cancel();
    const lastRecord = historyItems[historyItems.length - 1];

    // In Conquest mode, wrong or timeout ends the game after viewing explanation
    if (
      playMode === 'CONQUEST' &&
      lastRecord &&
      (lastRecord.outcome === 'WRONG' || lastRecord.outcome === 'TIMEOUT')
    ) {
      setFinalSessionScore(conquestMetrics.safeHavenScore);
      setPhase('FINISHED');
      clearSavedSessionStorage();
      return;
    }

    // Check if reached the end of the question ladder
    if (currentStepIdx + 1 >= sessionQuestions.length) {
      const completedScore =
        playMode === 'PRACTICE'
          ? practiceScore
          : computeConquestScores(sessionQuestions.length, questionCount).currentScore;
      setFinalSessionScore(completedScore);
      setEndReason('COMPLETED');
      if (orgMode === 'INDIVIDUAL' && activeStudent && onPick && completedScore > 0) {
        onPick(activeStudent, {
          bonusPoints: completedScore,
          note: `Hoàn thành C01 Ai là triệu phú (${completedScore}đ)`,
          sessionId,
        });
      }
      setPhase('FINISHED');
      clearSavedSessionStorage();
      c01Sound.playCorrect(isMuted, true);
      return;
    }

    // Move to next step
    const nextIdx = currentStepIdx + 1;
    setCurrentStepIdx(nextIdx);
    setSelectedOptionId(null);
    setEliminatedOptionIds([]);
    setActiveHintText(null);
    setStepLifelinesUsed([]);
    setLifelineNotice(null);
    setPollConfirmedResults(null);
    evaluatedStepLockRef.current = null;

    const nextQ = sessionQuestions[nextIdx];
    const nextOpts = sessionOptionsMap[nextQ.questionId] || [];

    if (readBeforeTimer && timeLimitSec > 0 && !isMuted) {
      setIsWaitingForPreRead(true);
      setRemainingSeconds(timeLimitSec);
      deadlineMsRef.current = null;
      setPhase('ANSWERING');
      const ok = speakCurrentQuestionAndOptions(nextQ, nextOpts);
      if (!ok) {
        startClockForCurrentQuestion(timeLimitSec);
      }
    } else {
      startClockForCurrentQuestion(timeLimitSec);
    }
  };

  // --------------------------------------------------------------------------
  // 9. FOUR LIFELINES IMPLEMENTATION (SECTION 8)
  // --------------------------------------------------------------------------
  const canUseLifeline = (key: C01LifelineKey): boolean => {
    return (
      phase === 'ANSWERING' &&
      enabledLifelines[key] &&
      !usedLifelines.includes(key)
    );
  };

  // A. 50:50
  const handleUseFiftyFifty = () => {
    if (!canUseLifeline('FIFTY_FIFTY') || !currentQuestion) return;
    const toEliminate = computeFiftyFiftyEliminations(
      currentDisplayOptions,
      currentQuestion.correctOptionId
    );
    if (toEliminate.length !== 2) {
      setLifelineNotice('Không thể áp dụng 50:50 cho câu hỏi này.');
      return;
    }

    setEliminatedOptionIds(toEliminate);
    if (selectedOptionId && toEliminate.includes(selectedOptionId)) {
      setSelectedOptionId(null);
    }
    setUsedLifelines((prev) => [...prev, 'FIFTY_FIFTY']);
    setStepLifelinesUsed((prev) => [...prev, 'FIFTY_FIFTY']);
    setLifelineNotice('Đã dùng 50:50: Hệ thống đã loại bỏ 2 phương án sai!');
    c01Sound.playSelectOption(isMuted);
  };

  // B. Hỏi cả lớp (Pauses question timer & opens real classroom vote input)
  const handleOpenClassPoll = () => {
    if (!canUseLifeline('CLASS_POLL') || !currentQuestion) return;
    voiceManagerRef.current?.cancel();

    if (deadlineMsRef.current !== null) {
      pausedRemainingMsRef.current = Math.max(0, deadlineMsRef.current - Date.now());
      deadlineMsRef.current = null;
    } else {
      pausedRemainingMsRef.current = null;
    }

    setPollVotes({ A: 0, B: 0, C: 0, D: 0 });
    setPollError(null);
    setUsedLifelines((prev) => [...prev, 'CLASS_POLL']);
    setStepLifelinesUsed((prev) => [...prev, 'CLASS_POLL']);
    setPhase('LIFELINE_POLL');
    c01Sound.playSelectOption(isMuted);
  };

  const handleConfirmClassPoll = () => {
    setPollError(null);
    const sumVotes = pollVotes.A + pollVotes.B + pollVotes.C + pollVotes.D;
    if (pollTotalParticipants <= 0) {
      setPollError('Tổng số học sinh tham gia biểu quyết phải lớn hơn 0.');
      return;
    }
    if (sumVotes !== pollTotalParticipants) {
      setPollError(
        `Tổng số phiếu (${sumVotes}) chưa khớp với số người tham gia (${pollTotalParticipants}). Mỗi người chọn 1 phương án.`
      );
      return;
    }
    if (presentStudents.length > 0 && pollTotalParticipants > presentStudents.length) {
      setPollError(
        `Số người tham gia (${pollTotalParticipants}) vượt quá sĩ số lớp hiện diện (${presentStudents.length}).`
      );
      return;
    }

    setPollConfirmedResults({ ...pollVotes });
  };

  const handleCloseClassPollAndResume = () => {
    if (pausedRemainingMsRef.current !== null && pausedRemainingMsRef.current > 0) {
      deadlineMsRef.current = Date.now() + pausedRemainingMsRef.current;
      setRemainingSeconds(Math.ceil(pausedRemainingMsRef.current / 1000));
    }
    pausedRemainingMsRef.current = null;
    setPhase('ANSWERING');
  };

  // C. Gợi ý kiến thức (Does not consume lifeline if question lacks a hint)
  const handleUseKnowledgeHint = () => {
    if (!canUseLifeline('KNOWLEDGE_HINT') || !currentQuestion) return;
    const hintStr = (currentQuestion.hint || '').trim();
    if (!hintStr) {
      setLifelineNotice(
        'Câu hỏi này chưa có gợi ý suy luận đi kèm. Quyền trợ giúp “Gợi ý kiến thức” KHÔNG bị trừ!'
      );
      return;
    }

    setActiveHintText(hintStr);
    setUsedLifelines((prev) => [...prev, 'KNOWLEDGE_HINT']);
    setStepLifelinesUsed((prev) => [...prev, 'KNOWLEDGE_HINT']);
    setLifelineNotice('Đã mở Gợi ý kiến thức!');
    c01Sound.playSelectOption(isMuted);
  };

  // D. Đổi câu hỏi (Replaces with unused reserve question; preserves step & resets timer)
  const handleUseSwapQuestion = () => {
    if (!canUseLifeline('SWAP_QUESTION') || !currentQuestion) return;

    const unusedReserves = reserveQuestions.filter(
      (rq) => !usedQuestionIds.includes(rq.questionId)
    );
    if (unusedReserves.length === 0) {
      setLifelineNotice(
        'Không còn câu hỏi dự phòng phù hợp trong bộ đề. Quyền “Đổi câu hỏi” KHÔNG bị tiêu hao!'
      );
      return;
    }

    // Prefer same difficulty or topic if available
    const sameDiff = unusedReserves.find(
      (rq) => rq.difficulty === currentQuestion.difficulty
    );
    const chosenReplacement = sameDiff || unusedReserves[0];

    setUsedQuestionIds((prev) => [...prev, chosenReplacement.questionId]);
    setSessionQuestions((prev) =>
      prev.map((q, idx) => (idx === currentStepIdx ? chosenReplacement : q))
    );
    setSessionOptionsMap((prev) => ({
      ...prev,
      [chosenReplacement.questionId]:
        prev[chosenReplacement.questionId] ||
        buildSessionDisplayOptions(chosenReplacement, shuffleOptions),
    }));

    // Clear selection and 50:50 on old question, reset question timer, keep used lifelines marked used
    setSelectedOptionId(null);
    setEliminatedOptionIds([]);
    setActiveHintText(null);
    setPollConfirmedResults(null);
    setUsedLifelines((prev) => [...prev, 'SWAP_QUESTION']);
    setStepLifelinesUsed((prev) => [...prev, 'SWAP_QUESTION']);
    evaluatedStepLockRef.current = null;

    if (timeLimitSec > 0) {
      setRemainingSeconds(timeLimitSec);
      deadlineMsRef.current = Date.now() + timeLimitSec * 1000;
    } else {
      setRemainingSeconds(0);
      deadlineMsRef.current = null;
    }

    setLifelineNotice('Đã đổi sang câu hỏi dự phòng mới và đặt lại đồng hồ câu hỏi!');
    c01Sound.playSelectOption(isMuted);
  };

  // --------------------------------------------------------------------------
  // 10. SINGLE-SOURCE DEADLINE TIMER & PAUSE / RESUME
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'ANSWERING' || isWaitingForPreRead || deadlineMsRef.current === null) {
      return;
    }

    const tick = () => {
      if (deadlineMsRef.current === null) return;
      const diffMs = deadlineMsRef.current - Date.now();
      if (diffMs <= 0) {
        setRemainingSeconds(0);
        deadlineMsRef.current = null;
        resolveCurrentStepOutcome(null, 'TIMEOUT', true);
      } else {
        setRemainingSeconds(Math.ceil(diffMs / 1000));
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 200);
    return () => window.clearInterval(intervalId);
  }, [phase, isWaitingForPreRead, resolveCurrentStepOutcome]);

  const handlePauseSession = useCallback(() => {
    if (phase === 'SETUP' || phase === 'FINISHED' || phase === 'PAUSED') return;
    voiceManagerRef.current?.cancel();
    phaseBeforePauseRef.current = phase;
    if (deadlineMsRef.current !== null) {
      pausedRemainingMsRef.current = Math.max(0, deadlineMsRef.current - Date.now());
      deadlineMsRef.current = null;
    } else {
      pausedRemainingMsRef.current = null;
    }
    setPhase('PAUSED');
  }, [phase]);

  const handleResumeSession = useCallback(() => {
    if (phase !== 'PAUSED') return;
    if (pausedRemainingMsRef.current !== null && pausedRemainingMsRef.current > 0) {
      deadlineMsRef.current = Date.now() + pausedRemainingMsRef.current;
      setRemainingSeconds(Math.ceil(pausedRemainingMsRef.current / 1000));
    }
    pausedRemainingMsRef.current = null;
    setPhase(phaseBeforePauseRef.current || 'ANSWERING');
  }, [phase]);

  // Summary statistics for Finished Screen
  const summaryStats = useMemo(() => {
    const correctCount = historyItems.filter((h) => h.outcome === 'CORRECT').length;
    const wrongCount = historyItems.filter((h) => h.outcome === 'WRONG').length;
    const timeoutCount = historyItems.filter((h) => h.outcome === 'TIMEOUT').length;
    return { correctCount, wrongCount, timeoutCount };
  }, [historyItems]);

  // ==========================================================================
  // RENDER: 3D STAGE ("ĐỈNH CAO TRI THỨC – TÂY ĐÔ SMART EDU")
  // ==========================================================================
  return (
    <div className="relative w-full min-h-[700px] rounded-3xl bg-gradient-to-b from-[#040B1C] via-[#091A3A] to-[#050E24] text-white border-2 border-cyan-400/45 shadow-[0_24px_65px_rgba(0,0,0,0.65)] overflow-hidden flex flex-col select-none">
      {/* 3D Circular Arena Floor & Spotlight Beams */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -top-24 right-1/4 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl" />
        <div
          className="absolute -bottom-36 left-1/2 -translate-x-1/2 w-[900px] h-[340px] rounded-full opacity-35"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(56,189,248,0.45) 0%, rgba(30,64,175,0.2) 45%, transparent 75%)',
          }}
        />
      </div>

      {/* TOP NAVIGATION BAR */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#06122B]/90 backdrop-blur-md border-b border-cyan-400/25">
        <div className="flex items-center gap-3">
          {onCloseGame && (
            <button
              type="button"
              onClick={() => {
                if (phase !== 'SETUP' && phase !== 'FINISHED') {
                  setConfirmExitModal('LIBRARY');
                } else {
                  voiceManagerRef.current?.cancel();
                  onCloseGame();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>← Quay lại</span>
            </button>
          )}

          {/* 3D Knowledge Crest */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-cyan-400 to-blue-700 p-0.5 shadow-[0_0_20px_rgba(56,189,248,0.4)] shrink-0">
            <div className="w-full h-full rounded-[14px] bg-[#07152E] flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/50 text-amber-300 text-[11px] font-black tracking-wider">
                C01
              </span>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                Ai là triệu phú · Đỉnh Cao Tri Thức 3D
              </h2>
            </div>
            <p className="text-[11px] text-cyan-200/85 font-medium hidden sm:block">
              Nhóm C: Củng cố kiến thức · {playMode === 'CONQUEST' ? 'Chế độ Chinh phục (Có mốc bảo toàn)' : 'Chế độ Luyện tập (+10đ/câu)'}
            </p>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {datasetKey !== 'QUESTION_BANK' && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-extrabold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Dữ liệu mẫu</span>
            </span>
          )}

          {phase !== 'SETUP' && phase !== 'FINISHED' && (
            <>
              <button
                type="button"
                onClick={() => setShowMobileLadderDrawer((prev) => !prev)}
                className="lg:hidden px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Thang điểm ({currentScoreDisplay}đ)</span>
              </button>

              <button
                type="button"
                onClick={phase === 'PAUSED' ? handleResumeSession : handlePauseSession}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  phase === 'PAUSED'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-300'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-amber-200 border-amber-400/30'
                }`}
              >
                {phase === 'PAUSED' ? (
                  <Play className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
                <span>{phase === 'PAUSED' ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmExitModal('REPLAY')}
                className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-600/60 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Chơi lại</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              if (phase === 'ANSWERING') handlePauseSession();
              setShowGuideModal(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800/80 text-cyan-200 border border-cyan-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Luật chơi</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`p-2 rounded-xl border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                : 'bg-cyan-950/70 border-cyan-400/40 text-cyan-200 hover:bg-cyan-900/70'
            }`}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600/60 text-slate-200 cursor-pointer"
              title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* Voice Notice Banner */}
      {voiceNotice && (
        <div className="relative z-30 mx-6 mt-3 px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs font-bold flex items-center justify-between gap-3">
          <span>{voiceNotice}</span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-amber-200 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 1: SESSION SETUP SCREEN                                        */}
      {/* ==================================================================== */}
      {phase === 'SETUP' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          {hasRestorableSession && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-900/70 via-blue-900/70 to-indigo-900/70 border border-cyan-400/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-white">
                    Phát hiện phiên chơi C01 – Ai là triệu phú đang tạm dừng
                  </p>
                  <p className="text-xs text-cyan-200/90">
                    Khôi phục đúng câu đang chơi, thứ tự đáp án, thang điểm và các quyền trợ giúp còn lại.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestoreSavedSession}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer"
                >
                  Khôi phục phiên
                </button>
                <button
                  type="button"
                  onClick={clearSavedSessionStorage}
                  className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Mode, Dataset & Question Count */}
            <div className="lg:col-span-7 space-y-5">
              {/* 1. Play Mode Selection */}
              <div className="p-5 rounded-3xl bg-[#0A1F44]/85 border border-cyan-400/25 shadow-xl space-y-3.5">
                <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-cyan-300" />
                  <span>1. Chế độ chơi (Mặc định: Luyện tập)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setPlayMode('PRACTICE')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      playMode === 'PRACTICE'
                        ? 'bg-gradient-to-br from-blue-600/40 to-cyan-500/25 border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.25)]'
                        : 'bg-slate-900/65 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-cyan-400/20 text-cyan-300 text-[11px] font-black">
                        MẶC ĐỊNH · LUYỆN TẬP
                      </span>
                      <BookOpen className="w-4 h-4 text-cyan-300" />
                    </div>
                    <h4 className="text-base font-black text-white mt-1.5">
                      A. Chế độ Luyện tập
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Trả lời trọn vẹn bộ câu hỏi. Mỗi câu đúng +10 điểm; sai hoặc hết giờ 0 điểm và vẫn đi tiếp để nghe giải thích kiến thức.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlayMode('CONQUEST')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      playMode === 'CONQUEST'
                        ? 'bg-gradient-to-br from-amber-500/35 to-blue-600/25 border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                        : 'bg-slate-900/65 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[11px] font-black">
                        GAMESHOW THANG ĐIỂM
                      </span>
                      <Trophy className="w-4 h-4 text-amber-300" />
                    </div>
                    <h4 className="text-base font-black text-white mt-1.5">
                      B. Chế độ Chinh phục
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Thang điểm tích lũy theo bậc (tối đa 600 điểm cho 15 câu), có Mốc bảo toàn tại câu 5 & 10 và quyền “Dừng và giữ điểm”.
                    </p>
                  </button>
                </div>
              </div>

              {/* 2. Dataset & Question Count */}
              <div className="p-5 rounded-3xl bg-[#0A1F44]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-cyan-300" />
                    <span>2. Bộ câu hỏi & Số lượng câu</span>
                  </h3>
                  <span className="text-xs font-bold text-emerald-300">
                    Chính: {availableMainCount} câu · Dự phòng: {validatedPool.reserveCandidates.length} câu
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDatasetKey('SAMPLE_MATH')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'SAMPLE_MATH'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-amber-300">
                      DỮ LIỆU MẪU · TOÁN
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">Toán THCS (15+3 câu)</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Số học, phân số, lũy thừa, biểu thức, hình học, thống kê
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDatasetKey('SAMPLE_INFORMATICS')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'SAMPLE_INFORMATICS'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-cyan-300">
                      DỮ LIỆU MẪU · TIN HỌC
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">Tin học THCS (15+3 câu)</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Thông tin, dữ liệu, thiết bị, tệp, thư mục, Internet, thuật toán
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDatasetKey('QUESTION_BANK')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      datasetKey === 'QUESTION_BANK'
                        ? 'bg-blue-600/35 border-amber-300 text-white'
                        : 'bg-slate-900/65 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="text-[10px] font-black uppercase text-emerald-300">
                      NGÂN HÀNG HỆ THỐNG
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">
                      Ngân hàng ({convertedBankPool.length} câu)
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Sử dụng câu hỏi 4 lựa chọn đã duyệt của lớp/môn hiện tại
                    </p>
                  </button>
                </div>

                {/* Question Count: 5, 10 (default), 15 */}
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Số bậc câu hỏi trong phiên (Mặc định: 10 câu):
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {([5, 10, 15] as C01QuestionCount[]).map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuestionCount(cnt)}
                        className={`py-2.5 px-3 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all cursor-pointer flex flex-col items-center ${
                          questionCount === cnt
                            ? 'bg-cyan-400 text-slate-950 border-white shadow-md'
                            : 'bg-slate-900/75 text-slate-200 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        <span>{cnt} CÂU HỎI</span>
                        <span
                          className={`text-[10px] font-bold ${
                            questionCount === cnt ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {playMode === 'PRACTICE'
                            ? `Tối đa ${cnt * 10} điểm`
                            : cnt === 15
                            ? 'Đỉnh 600đ (Mốc 5 & 10)'
                            : cnt === 10
                            ? 'Đỉnh 200đ (Mốc 5)'
                            : 'Đỉnh 50đ'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shortage Alert */}
                {shortageCount > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-400/60 text-rose-100 space-y-2">
                    <div className="flex items-start gap-2 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <span>
                        Bộ câu hỏi đang chọn chỉ có {availableMainCount} câu hợp lệ (4 phương án), thiếu{' '}
                        <strong className="text-amber-300">{shortageCount} câu</strong>. Hãy giảm số câu hoặc chọn Bộ mẫu Toán / Tin học.
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableMainCount >= 5 && questionCount > 5 && (
                        <button
                          type="button"
                          onClick={() => setQuestionCount(availableMainCount >= 10 ? 10 : 5)}
                          className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                        >
                          Giảm xuống {availableMainCount >= 10 ? 10 : 5} câu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDatasetKey('SAMPLE_MATH')}
                        className="px-3 py-1.5 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer"
                      >
                        Dùng Bộ mẫu Toán THCS (15+3 câu)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Organization, Timer, Lifelines & Launch */}
            <div className="lg:col-span-5 space-y-5">
              <div className="p-5 rounded-3xl bg-[#0A1F44]/85 border border-cyan-400/25 shadow-xl space-y-4">
                <h3 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-300" />
                  <span>3. Thời gian & Quyền trợ giúp</span>
                </h3>

                {/* Organization: Class vs Individual */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-300 block">
                    Hình thức tham gia (Mặc định: Cả lớp):
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { key: 'CLASS' as C01OrgMode, label: 'Cả lớp cùng tham gia' },
                      { key: 'INDIVIDUAL' as C01OrgMode, label: 'Một học sinh trên ghế nóng' },
                    ].map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setOrgMode(o.key)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                          orgMode === o.key
                            ? 'bg-cyan-400 text-slate-950 border-white'
                            : 'bg-slate-900/75 text-slate-300 border-slate-700'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Limit per Question */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-bold text-slate-300 block">
                    Thời gian suy nghĩ mỗi câu (Mặc định: Không giới hạn):
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { sec: 0, label: 'Không GH' },
                      { sec: 30, label: '30s' },
                      { sec: 45, label: '45s' },
                      { sec: 60, label: '60s' },
                      { sec: 90, label: '90s' },
                    ].map((t) => (
                      <button
                        key={t.sec}
                        type="button"
                        onClick={() => setTimeLimitSec(t.sec)}
                        className={`py-2 px-1.5 rounded-xl text-xs font-black border cursor-pointer ${
                          timeLimitSec === t.sec
                            ? 'bg-amber-400 text-slate-950 border-amber-200'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4 Lifelines Enable/Disable Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-bold text-slate-300 block">
                    Bật / tắt từng Quyền trợ giúp (mỗi quyền tối đa 1 lần/phiên):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'FIFTY_FIFTY' as C01LifelineKey, label: '50:50 (Loại 2 sai)' },
                      { key: 'CLASS_POLL' as C01LifelineKey, label: 'Hỏi cả lớp (Biểu quyết)' },
                      { key: 'KNOWLEDGE_HINT' as C01LifelineKey, label: 'Gợi ý kiến thức' },
                      { key: 'SWAP_QUESTION' as C01LifelineKey, label: 'Đổi câu hỏi dự phòng' },
                    ].map((lf) => (
                      <label
                        key={lf.key}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/75 border border-slate-700/80 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={enabledLifelines[lf.key]}
                          onChange={(e) =>
                            setEnabledLifelines((prev) => ({
                              ...prev,
                              [lf.key]: e.target.checked,
                            }))
                          }
                          className="accent-cyan-400"
                        />
                        <span>{lf.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Additional Toggles */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/80 text-xs font-bold text-slate-200 cursor-pointer">
                    <span>Xáo trộn thứ tự đáp án A/B/C/D (giữ nguyên optionId)</span>
                    <input
                      type="checkbox"
                      checked={shuffleOptions}
                      onChange={(e) => setShuffleOptions(e.target.checked)}
                      className="accent-cyan-400"
                    />
                  </label>

                  {timeLimitSec > 0 && (
                    <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/80 text-xs font-bold text-slate-200 cursor-pointer">
                      <span>Đọc câu hỏi trước khi bắt đầu chạy đồng hồ</span>
                      <input
                        type="checkbox"
                        checked={readBeforeTimer}
                        onChange={(e) => setReadBeforeTimer(e.target.checked)}
                        className="accent-cyan-400"
                      />
                    </label>
                  )}

                  <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-700/80 text-xs font-bold text-slate-200 cursor-pointer">
                    <span>Giảm chuyển động 3D & hiệu ứng chờ (Reduce Motion)</span>
                    <input
                      type="checkbox"
                      checked={reduceMotion}
                      onChange={(e) => setReduceMotion(e.target.checked)}
                      className="accent-cyan-400"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  disabled={shortageCount > 0 || availableMainCount === 0}
                  onClick={handleStartSession}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-base shadow-[0_10px_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    BẮT ĐẦU ({questionCount} CÂU ·{' '}
                    {playMode === 'CONQUEST' ? 'CHINH PHỤC' : 'LUYỆN TẬP'})
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 2: ACTIVE 3D GAMESHOW STAGE                                    */}
      {/* ==================================================================== */}
      {phase !== 'SETUP' && phase !== 'FINISHED' && currentQuestion && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start overflow-y-auto">
          {/* ================================================================ */}
          {/* CENTER ARENA (8 COLUMNS ON DESKTOP): LIFELINES + QUESTION + 2x2  */}
          {/* ================================================================ */}
          <div className="lg:col-span-8 space-y-4">
            {/* Status Bar: Step, Mode, Current Score, Safe Haven Score, Timer */}
            <div className="p-3.5 rounded-2xl bg-[#081A3A]/90 border border-cyan-400/35 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black">
                  CÂU {currentStepIdx + 1} / {sessionQuestions.length}
                </span>

                <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 border border-blue-400/40 text-cyan-200 text-xs font-extrabold">
                  {currentQuestion.topic || 'Kiến thức THCS'}
                </span>

                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-bold">
                  <span className="text-slate-300">Điểm hiện tại:</span>
                  <strong className="text-amber-300">{currentScoreDisplay} đ</strong>
                  {playMode === 'CONQUEST' && (
                    <>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-300">Điểm bảo toàn:</span>
                      <strong className="text-emerald-300">{safeHavenScoreDisplay} đ</strong>
                    </>
                  )}
                </div>
              </div>

              {/* Timer or Pre-read status */}
              <div className="flex items-center gap-2">
                {isWaitingForPreRead ? (
                  <button
                    type="button"
                    onClick={() => {
                      voiceManagerRef.current?.cancel();
                      startClockForCurrentQuestion(timeLimitSec);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua đọc – Bắt đầu giờ</span>
                  </button>
                ) : timeLimitSec > 0 ? (
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border font-black text-sm flex items-center gap-1.5 tabular-nums ${
                      remainingSeconds <= 10
                        ? 'bg-rose-600/35 border-rose-400 text-rose-200 animate-pulse'
                        : 'bg-slate-900 border-cyan-400/50 text-cyan-200'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-amber-300" />
                    <span>{remainingSeconds}s</span>
                  </div>
                ) : (
                  <span className="px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 text-xs font-bold text-slate-300">
                    Không giới hạn giờ
                  </span>
                )}
              </div>
            </div>

            {/* Lifeline Toolbar (4 Lifelines + Walk Away in Conquest Mode) */}
            <div className="p-3.5 rounded-2xl bg-[#071633]/90 border border-cyan-400/25 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300 mr-1">
                  Quyền trợ giúp:
                </span>

                {enabledLifelines.FIFTY_FIFTY && (
                  <button
                    type="button"
                    disabled={!canUseLifeline('FIFTY_FIFTY')}
                    onClick={handleUseFiftyFifty}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      usedLifelines.includes('FIFTY_FIFTY')
                        ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-600/40 to-indigo-900/60 hover:border-amber-300 border-cyan-400/50 text-white shadow'
                    }`}
                  >
                    <Divide className="w-3.5 h-3.5 text-amber-300" />
                    <span>50:50</span>
                  </button>
                )}

                {enabledLifelines.CLASS_POLL && (
                  <button
                    type="button"
                    disabled={!canUseLifeline('CLASS_POLL')}
                    onClick={handleOpenClassPoll}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      usedLifelines.includes('CLASS_POLL')
                        ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-600/40 to-indigo-900/60 hover:border-amber-300 border-cyan-400/50 text-white shadow'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Hỏi cả lớp</span>
                  </button>
                )}

                {enabledLifelines.KNOWLEDGE_HINT && (
                  <button
                    type="button"
                    disabled={!canUseLifeline('KNOWLEDGE_HINT')}
                    onClick={handleUseKnowledgeHint}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      usedLifelines.includes('KNOWLEDGE_HINT')
                        ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-600/40 to-indigo-900/60 hover:border-amber-300 border-cyan-400/50 text-white shadow'
                    }`}
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                    <span>Gợi ý kiến thức</span>
                  </button>
                )}

                {enabledLifelines.SWAP_QUESTION && (
                  <button
                    type="button"
                    disabled={!canUseLifeline('SWAP_QUESTION')}
                    onClick={handleUseSwapQuestion}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                      usedLifelines.includes('SWAP_QUESTION')
                        ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through cursor-not-allowed'
                        : 'bg-gradient-to-b from-blue-600/40 to-indigo-900/60 hover:border-amber-300 border-cyan-400/50 text-white shadow'
                    }`}
                  >
                    <Shuffle className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Đổi câu hỏi</span>
                  </button>
                )}
              </div>

              {/* Walk Away ("Dừng và giữ điểm") — Active ONLY before locking answer in Conquest Mode */}
              {playMode === 'CONQUEST' && phase === 'ANSWERING' && (
                <button
                  type="button"
                  onClick={() => setShowWalkAwayConfirm(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border border-amber-300/60 text-amber-200 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dừng & Giữ {conquestMetrics.currentScore}đ</span>
                </button>
              )}
            </div>

            {/* Lifeline Notice / Knowledge Hint / Class Poll Chart Banner */}
            {(lifelineNotice || activeHintText || pollConfirmedResults) && (
              <div className="space-y-2.5">
                {lifelineNotice && (
                  <div className="px-4 py-2 rounded-xl bg-blue-950/85 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center justify-between">
                    <span>{lifelineNotice}</span>
                    <button
                      type="button"
                      onClick={() => setLifelineNotice(null)}
                      className="text-cyan-300 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {activeHintText && (
                  <div className="p-3.5 rounded-2xl bg-amber-950/75 border border-amber-400/60 text-amber-100 text-xs sm:text-sm flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-300">Gợi ý suy luận: </strong>
                      <MathView content={activeHintText} />
                    </div>
                  </div>
                )}

                {pollConfirmedResults && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-cyan-400/40 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-black text-cyan-300">
                      <span>KẾT QUẢ BIỂU QUYẾT CẢ LỚP ({pollTotalParticipants} học sinh tham gia)</span>
                      <span>Số phiếu thực tế</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 pt-1">
                      {(['A', 'B', 'C', 'D'] as const).map((lbl) => {
                        const count = pollConfirmedResults[lbl] || 0;
                        const pct =
                          pollTotalParticipants > 0
                            ? Math.round((count / pollTotalParticipants) * 100)
                            : 0;
                        return (
                          <div
                            key={lbl}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-1.5"
                          >
                            <span className="text-xs font-black text-amber-300">
                              Phương án {lbl}: {count} phiếu ({pct}%)
                            </span>
                            <div className="w-full h-16 bg-slate-900 rounded-lg overflow-hidden flex items-end p-1">
                              <div
                                style={{ height: `${Math.max(6, pct)}%` }}
                                className="w-full rounded bg-gradient-to-t from-blue-600 to-cyan-400 transition-all"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3D CENTER QUESTION STAGE & 2x2 ANSWER BLOCKS */}
            <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-b from-[#0C234E]/95 via-[#081A3B]/95 to-[#051026]/95 border-2 border-cyan-400/40 shadow-[0_20px_50px_rgba(0,0,0,0.6)] space-y-5">
              {/* Question Header & Voice/Zoom Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                  {playMode === 'CONQUEST'
                    ? `Bậc chinh phục #${currentStepIdx + 1} — Giá trị bậc: ${currentLadder[currentStepIdx]} điểm`
                    : `Câu hỏi luyện tập #${currentStepIdx + 1} (+10 điểm)`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      speakCurrentQuestionAndOptions(currentQuestion, currentDisplayOptions)
                    }
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/40 text-cyan-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Đọc câu hỏi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomedQuestion(currentQuestion.stem)}
                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
                    title="Phóng to câu hỏi"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 3D Podium Question Board */}
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-[#06142E] to-[#040D21] border-2 border-cyan-300/45 shadow-[inset_0_2px_18px_rgba(56,189,248,0.2)]">
                <div className="text-lg sm:text-xl font-extrabold text-white leading-relaxed break-words">
                  <MathView content={currentQuestion.stem} />
                </div>
              </div>

              {/* Four 3D Beveled Answer Blocks (2x2 on Desktop, 1 Column on Mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {currentDisplayOptions.map((opt) => {
                  const isEliminated = eliminatedOptionIds.includes(opt.optionId);
                  const isSelected = selectedOptionId === opt.optionId;
                  const isCorrectOpt = opt.optionId === currentQuestion.correctOptionId;

                  let blockStyle =
                    'bg-gradient-to-b from-[#102A58] to-[#091938] border-2 border-cyan-400/45 text-white hover:border-amber-300 shadow-[0_5px_0_#040C1D]';
                  let statusLabel: React.ReactNode = null;

                  if (isEliminated) {
                    blockStyle =
                      'bg-slate-950/50 border-2 border-slate-800/70 text-slate-600 opacity-45 cursor-not-allowed';
                  } else if (phase === 'EXPLANATION') {
                    if (isCorrectOpt) {
                      blockStyle =
                        'bg-gradient-to-b from-emerald-500 to-emerald-700 border-2 border-emerald-200 text-slate-950 font-black shadow-[0_5px_0_#064E3B,0_0_25px_rgba(16,185,129,0.5)]';
                      statusLabel = (
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-emerald-300 text-[10px] font-black flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ĐÚNG</span>
                        </span>
                      );
                    } else if (isSelected && !isCorrectOpt) {
                      blockStyle =
                        'bg-gradient-to-b from-rose-600 to-rose-800 border-2 border-rose-300 text-white font-black shadow-[0_5px_0_#4C0519]';
                      statusLabel = (
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-rose-300 text-[10px] font-black flex items-center gap-1 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>CHƯA ĐÚNG</span>
                        </span>
                      );
                    }
                  } else if (phase === 'LOCKED_SUSPENSE' && isSelected) {
                    blockStyle =
                      'bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-white text-slate-950 font-black animate-pulse shadow-[0_5px_0_#78350F]';
                  } else if (isSelected) {
                    blockStyle =
                      'bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-2 border-white text-slate-950 font-black shadow-[0_5px_0_#92400E,0_0_25px_rgba(251,191,36,0.45)]';
                  }

                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      disabled={isEliminated || phase !== 'ANSWERING'}
                      onClick={() => {
                        if (isEliminated || phase !== 'ANSWERING') return;
                        setSelectedOptionId(opt.optionId);
                        c01Sound.playSelectOption(isMuted);
                      }}
                      className={`p-4 rounded-2xl text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${blockStyle}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                            isSelected && phase !== 'EXPLANATION'
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-[#061229] text-amber-300 border border-amber-400/40'
                          }`}
                        >
                          {opt.displayLabel}
                        </span>
                        <div className="text-sm sm:text-base font-bold break-words">
                          {isEliminated ? (
                            <span className="italic">Đã loại bởi 50:50</span>
                          ) : (
                            <MathView content={opt.text} />
                          )}
                        </div>
                      </div>
                      {statusLabel}
                    </button>
                  );
                })}
              </div>

              {/* Action Bar: Lock Answer / Skip Suspense / Explanation & Next Question */}
              {phase === 'ANSWERING' && (
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-cyan-200/90 font-semibold">
                    {selectedOptionId
                      ? 'Đã chọn phương án. Bấm “Chốt đáp án” để khóa kết quả (hoặc chọn lại phương án khác).'
                      : 'Hãy chọn 1 trong 4 phương án A, B, C, D rồi bấm “Chốt đáp án”.'}
                  </span>

                  <button
                    type="button"
                    disabled={!selectedOptionId}
                    onClick={() => resolveCurrentStepOutcome(selectedOptionId, 'SUBMITTED', false)}
                    className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-black text-sm sm:text-base flex items-center gap-2 shadow-[0_8px_25px_rgba(245,158,11,0.45)] cursor-pointer ml-auto"
                  >
                    <Check className="w-5 h-5" />
                    <span>Chốt đáp án</span>
                  </button>
                </div>
              )}

              {phase === 'LOCKED_SUSPENSE' && (
                <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-300/60 flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-amber-200">
                    Đã khóa đáp án! Đang kiểm tra kết quả...
                  </span>
                  <button
                    type="button"
                    onClick={handleSkipSuspense}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                  >
                    <FastForward className="w-4 h-4" />
                    <span>Bỏ qua hiệu ứng chờ</span>
                  </button>
                </div>
              )}

              {phase === 'EXPLANATION' && (
                <div
                  role="status"
                  aria-live="polite"
                  className="p-5 rounded-2xl bg-[#071633]/95 border-2 border-cyan-300/50 space-y-3"
                >
                  {(() => {
                    const latest = historyItems[historyItems.length - 1];
                    const isCorr = latest?.outcome === 'CORRECT';
                    const isTime = latest?.outcome === 'TIMEOUT';
                    const correctDisp = currentDisplayOptions.find(
                      (o) => o.optionId === currentQuestion.correctOptionId
                    );
                    return (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-black text-base">
                            {isCorr ? (
                              <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                <span className="text-emerald-300">
                                  CHÍNH XÁC! Đáp án đúng là {correctDisp?.displayLabel}:{' '}
                                  {correctDisp?.text}
                                </span>
                              </>
                            ) : isTime ? (
                              <>
                                <Clock className="w-5 h-5 text-amber-300 shrink-0" />
                                <span className="text-amber-300">
                                  HẾT THỜI GIAN! Đáp án chuẩn là {correctDisp?.displayLabel}:{' '}
                                  {correctDisp?.text}
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                                <span className="text-rose-300">
                                  CHƯA ĐÚNG! Đáp án chuẩn là {correctDisp?.displayLabel}:{' '}
                                  {correctDisp?.text}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs sm:text-sm text-slate-100 leading-relaxed">
                          <strong className="text-cyan-300">Giải thích kiến thức: </strong>
                          <MathView content={currentQuestion.explanation} />
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleProceedAfterExplanation}
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg cursor-pointer"
                          >
                            <span>
                              {playMode === 'CONQUEST' && !isCorr
                                ? 'Xem Tổng Kết Chinh Phục'
                                : currentStepIdx + 1 >= sessionQuestions.length
                                ? 'Hoàn thành & Xem Tổng Kết'
                                : 'Câu tiếp theo'}
                            </span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* RIGHT SIDEBAR (4 COLUMNS ON DESKTOP): KNOWLEDGE LADDER & CUP 3D  */}
          {/* ================================================================ */}
          <div
            className={`lg:col-span-4 space-y-4 ${
              showMobileLadderDrawer
                ? 'fixed inset-x-4 top-20 z-50 max-h-[80vh] overflow-y-auto lg:static lg:max-h-none'
                : 'hidden lg:block'
            }`}
          >
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-b from-[#091D42]/95 to-[#061229]/95 border-2 border-amber-400/40 shadow-2xl space-y-3">
              {/* 3D Trophy Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <KnowledgeTrophy3DSVG className="w-11 h-11 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                      THANG CHINH PHỤC KIẾN THỨC
                    </span>
                    <h3 className="text-sm font-black text-white">
                      {playMode === 'CONQUEST'
                        ? `Đỉnh cao: ${currentLadder[currentLadder.length - 1]} điểm`
                        : `Luyện tập: ${sessionQuestions.length * 10} điểm`}
                    </h3>
                  </div>
                </div>

                {showMobileLadderDrawer && (
                  <button
                    type="button"
                    onClick={() => setShowMobileLadderDrawer(false)}
                    className="lg:hidden p-1.5 rounded-lg bg-slate-800 text-slate-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Score Summary Boxes */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-amber-400/35 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    Điểm hiện tại
                  </span>
                  <span className="text-lg font-black text-amber-300 tabular-nums">
                    {currentScoreDisplay} điểm
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-900/90 border border-emerald-400/35 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    {playMode === 'CONQUEST' ? 'Điểm bảo toàn' : 'Số câu đúng'}
                  </span>
                  <span className="text-lg font-black text-emerald-300 tabular-nums">
                    {playMode === 'CONQUEST'
                      ? `${safeHavenScoreDisplay} điểm`
                      : `${summaryStats.correctCount}/${sessionQuestions.length}`}
                  </span>
                </div>
              </div>

              {/* Ladder Rungs (Rendered Top-Down from Highest to Step 1) */}
              <div className="space-y-1.5 max-h-[410px] overflow-y-auto pr-1">
                {[...sessionQuestions]
                  .map((_, idx) => idx)
                  .reverse()
                  .map((stepIdx) => {
                    const stepNum = stepIdx + 1;
                    const isCurrent = stepIdx === currentStepIdx;
                    const isPassed = stepIdx < currentStepIdx;
                    const isMilestone =
                      playMode === 'CONQUEST' &&
                      (isSafeHavenStep(stepNum, questionCount) || stepNum === questionCount);
                    const pointVal =
                      playMode === 'CONQUEST'
                        ? currentLadder[stepIdx]
                        : stepNum * 10;

                    return (
                      <div
                        key={`rung_${stepNum}`}
                        className={`px-3 py-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          isCurrent
                            ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-white font-black shadow-md scale-[1.01]'
                            : isPassed
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200 font-bold'
                            : isMilestone
                            ? 'bg-blue-950/80 border-amber-300/50 text-amber-200 font-extrabold'
                            : 'bg-slate-900/70 border-slate-800 text-slate-300 font-semibold'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-left tabular-nums font-black">
                            #{stepNum}
                          </span>
                          {isMilestone && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                isCurrent
                                  ? 'bg-slate-950 text-amber-300'
                                  : 'bg-amber-400/20 text-amber-300'
                              }`}
                            >
                              {stepNum === questionCount ? 'ĐỈNH CAO' : 'MỐC BẢO TOÀN'}
                            </span>
                          )}
                        </div>
                        <span className="tabular-nums font-black">{pointVal} điểm</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* LIFELINE B MODAL: CLASS POLL ("HỎI CẢ LỚP" — REAL INPUT ONLY)    */}
          {/* ================================================================ */}
          {phase === 'LIFELINE_POLL' && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-lg rounded-3xl bg-[#0A1E42] border-2 border-cyan-400 p-6 text-white space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-cyan-300" />
                    <h3 className="text-base sm:text-lg font-black text-amber-300">
                      Trợ giúp: Hỏi cả lớp (Biểu quyết tại lớp)
                    </h3>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-200 text-xs font-bold">
                    Đã tạm dừng đồng hồ
                  </span>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed">
                  Giáo viên tổ chức cho học sinh giơ tay hoặc giơ thẻ đáp án A, B, C, D. Nhập số phiếu thực tế của từng phương án bên dưới (mỗi học sinh chọn 1 phương án):
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-700">
                    <label className="text-xs font-bold text-cyan-200">
                      Tổng số học sinh tham gia biểu quyết:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={pollTotalParticipants}
                      onChange={(e) =>
                        setPollTotalParticipants(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-24 px-3 py-1.5 rounded-xl bg-slate-950 border border-cyan-400/50 text-center font-black text-sm text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {currentDisplayOptions.map((opt) => {
                      const isElim = eliminatedOptionIds.includes(opt.optionId);
                      const lbl = opt.displayLabel;
                      return (
                        <div
                          key={opt.optionId}
                          className={`p-3 rounded-2xl border flex items-center justify-between ${
                            isElim
                              ? 'bg-slate-950/40 border-slate-800 opacity-50'
                              : 'bg-slate-900 border-slate-700'
                          }`}
                        >
                          <span className="text-xs font-black text-amber-300">
                            Phiếu {lbl} {isElim ? '(Đã loại)' : ''}:
                          </span>
                          <input
                            type="number"
                            min={0}
                            disabled={isElim}
                            value={isElim ? 0 : pollVotes[lbl]}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setPollVotes((prev) => ({ ...prev, [lbl]: val }));
                            }}
                            className="w-20 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-600 text-center font-black text-sm text-white disabled:opacity-40"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                    <span>
                      Tổng số phiếu đã nhập:{' '}
                      <strong className="text-amber-300">
                        {pollVotes.A + pollVotes.B + pollVotes.C + pollVotes.D}
                      </strong>{' '}
                      / {pollTotalParticipants}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPollTotalParticipants(
                          pollVotes.A + pollVotes.B + pollVotes.C + pollVotes.D
                        )
                      }
                      className="text-cyan-300 hover:underline cursor-pointer"
                    >
                      Khớp tổng theo số phiếu
                    </button>
                  </div>

                  {pollError && (
                    <p className="text-xs font-bold text-rose-400">{pollError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleConfirmClassPoll}
                    className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Hiển thị biểu đồ phiếu
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseClassPollAndResume}
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs cursor-pointer"
                  >
                    Tiếp tục trả lời
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* MODAL: WALK AWAY CONFIRMATION ("DỪNG VÀ GIỮ ĐIỂM")               */}
          {/* ================================================================ */}
          {showWalkAwayConfirm && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl bg-[#0A1E42] border-2 border-amber-400 p-6 text-white space-y-4 shadow-2xl">
                <h3 className="text-lg font-black text-amber-300">
                  Xác nhận Dừng cuộc chơi & Giữ điểm?
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Nếu chủ động dừng ngay bây giờ (trước khi chốt đáp án câu #{currentStepIdx + 1}), bạn sẽ bảo toàn số điểm của câu đúng gần nhất là{' '}
                  <strong className="text-amber-300">{conquestMetrics.currentScore} điểm</strong>.
                </p>
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowWalkAwayConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Tiếp tục suy nghĩ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowWalkAwayConfirm(false);
                      resolveCurrentStepOutcome(null, 'WALK_AWAY', true);
                    }}
                    className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Dừng và giữ {conquestMetrics.currentScore} điểm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PAUSE OVERLAY (MASKS QUESTION & LOCKS LIFELINES)                 */}
          {/* ================================================================ */}
          {phase === 'PAUSED' && (
            <div className="absolute inset-0 z-50 bg-[#040C1E]/95 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-amber-400/20 border-2 border-amber-300 flex items-center justify-center text-amber-300">
                <Pause className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Trò chơi đang tạm dừng
              </h3>
              <p className="text-xs sm:text-sm text-cyan-200 max-w-md">
                Đồng hồ câu hỏi đã dừng và nội dung câu hỏi đang được ẩn tạm thời để giữ tính công bằng.
              </p>
              <button
                type="button"
                onClick={handleResumeSession}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Tiếp tục trả lời</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 3: FINISHED SUMMARY & KNOWLEDGE REVIEW (SECTION 15)            */}
      {/* ==================================================================== */}
      {phase === 'FINISHED' && (
        <div className="relative z-10 flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0D2856] via-[#0A1E42] to-[#07152E] border-2 border-amber-300/60 shadow-2xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <KnowledgeTrophy3DSVG className="w-16 h-16 shrink-0" />
                <div>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-xs font-black uppercase">
                    {endReason === 'COMPLETED'
                      ? 'HOÀN THÀNH ĐỈNH CAO TRI THỨC'
                      : endReason === 'WALK_AWAY'
                      ? 'CHỦ ĐỘNG DỪNG & BẢO TOÀN ĐIỂM'
                      : endReason === 'TIMEOUT'
                      ? 'KẾT THÚC DO HẾT THỜI GIAN'
                      : 'KẾT THÚC LƯỢT CHINH PHỤC'}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-white mt-1">
                    Tổng kết C01 – Ai là triệu phú 3D
                  </h3>
                  <p className="text-xs text-cyan-200">
                    Chế độ: <strong>{playMode === 'CONQUEST' ? 'Chinh phục' : 'Luyện tập'}</strong> ·
                    Người chơi:{' '}
                    <strong>
                      {orgMode === 'INDIVIDUAL' && activeStudent
                        ? activeStudent.fullName
                        : `Cả lớp (${resolvedClassName})`}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-300/50 text-cyan-200 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Xem lại kiến thức</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartSession}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('SETUP')}
                  className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm border border-slate-600 cursor-pointer"
                >
                  Chọn bộ khác
                </button>
                {onCloseGame && (
                  <button
                    type="button"
                    onClick={() => {
                      voiceManagerRef.current?.cancel();
                      onCloseGame();
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 cursor-pointer"
                  >
                    Về thư viện
                  </button>
                )}
              </div>
            </div>

            {/* Summary Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-slate-900/85 border border-amber-400/40">
                <span className="text-xs font-bold text-slate-400 block">Điểm cuối cùng</span>
                <span className="text-2xl font-black text-amber-300 tabular-nums">
                  {finalSessionScore} điểm
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-400/30">
                <span className="text-xs font-bold text-slate-400 block">Bậc cao nhất đã đạt</span>
                <span className="text-2xl font-black text-cyan-300 tabular-nums">
                  Bậc {highestStepReached} / {sessionQuestions.length}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/85 border border-emerald-400/30">
                <span className="text-xs font-bold text-slate-400 block">
                  Đúng / Sai / Hết giờ
                </span>
                <span className="text-lg font-black text-emerald-300 tabular-nums">
                  {summaryStats.correctCount} Đúng · {summaryStats.wrongCount} Sai ·{' '}
                  {summaryStats.timeoutCount} Hết giờ
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/85 border border-purple-400/30">
                <span className="text-xs font-bold text-slate-400 block">
                  Trợ giúp đã sử dụng
                </span>
                <span className="text-sm font-black text-purple-200">
                  {usedLifelines.length === 0
                    ? 'Chưa dùng trợ giúp nào'
                    : `${usedLifelines.length} quyền trợ giúp`}
                </span>
              </div>
            </div>

            {/* Inline Knowledge Review of Played Questions Only */}
            <div className="space-y-3">
              <h4 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  Chi tiết các câu đã trải qua ({historyItems.length} câu — câu chưa chơi không tính là sai)
                </span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {historyItems.map((item) => {
                  const chosenOpt = item.options.find(
                    (o) => o.optionId === item.selectedOptionId
                  );
                  const correctOpt = item.options.find(
                    (o) => o.optionId === item.correctOptionId
                  );
                  return (
                    <div
                      key={`${item.stepNumber}_${item.questionId}`}
                      className="p-4 rounded-2xl bg-slate-900/85 border border-cyan-400/25 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-amber-300">
                          Câu #{item.stepNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            item.outcome === 'CORRECT'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : item.outcome === 'WALK_AWAY'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {item.outcome === 'CORRECT'
                            ? 'Trả lời Đúng'
                            : item.outcome === 'WALK_AWAY'
                            ? 'Dừng & Giữ điểm'
                            : item.outcome === 'TIMEOUT'
                            ? 'Hết giờ'
                            : 'Chưa đúng'}
                        </span>
                      </div>
                      <div className="text-xs text-white font-semibold">
                        <MathView content={item.stem} />
                      </div>
                      <p className="text-xs text-slate-300">
                        Đã chọn:{' '}
                        <strong>
                          {chosenOpt
                            ? `${chosenOpt.displayLabel}. ${chosenOpt.text}`
                            : 'Không chọn'}
                        </strong>{' '}
                        · Đáp án đúng:{' '}
                        <strong className="text-emerald-300">
                          {correctOpt
                            ? `${correctOpt.displayLabel}. ${correctOpt.text}`
                            : ''}
                        </strong>
                      </p>
                      <div className="text-xs text-cyan-200/90 leading-relaxed">
                        <MathView content={item.explanation} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FOOTER BAR                                                           */}
      {/* ==================================================================== */}
      <footer className="relative z-20 px-4 sm:px-6 py-2.5 bg-[#050E22]/95 border-t border-cyan-400/20 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>
          Điểm số và danh hiệu trong trò chơi chỉ mang ý nghĩa học tập, khích lệ tinh thần chinh phục tri thức của học sinh.
        </span>
        <span className="text-slate-400">
          Tây Đô Smart EDU · C01 Ai là triệu phú 3D
        </span>
      </footer>

      {/* ==================================================================== */}
      {/* MODAL: FULL KNOWLEDGE REVIEW ("XEM LẠI KIẾN THỨC")                   */}
      {/* ==================================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] rounded-3xl bg-[#0A1E40] border-2 border-cyan-400 p-6 text-white flex flex-col space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                Ôn tập kiến thức các câu đã chơi ({historyItems.length} câu)
              </h3>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {historyItems.map((h) => {
                const correctOpt = h.options.find((o) => o.optionId === h.correctOptionId);
                return (
                  <div
                    key={`rev_${h.stepNumber}_${h.questionId}`}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300">
                        Câu #{h.stepNumber}
                      </span>
                      <span className="text-xs font-bold text-emerald-300">
                        Đáp án chuẩn: {correctOpt?.displayLabel}. {correctOpt?.text}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white">
                      <MathView content={h.stem} />
                    </div>
                    <div className="text-xs text-slate-300">
                      <MathView content={h.explanation} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: ZOOMED QUESTION                                               */}
      {/* ==================================================================== */}
      {zoomedQuestion && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-[#0A1E40] border-2 border-cyan-400 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-amber-300">
                Phóng to câu hỏi #{currentStepIdx + 1}
              </h3>
              <button
                type="button"
                onClick={() => setZoomedQuestion(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-xl sm:text-2xl font-extrabold leading-relaxed text-white">
              <MathView content={zoomedQuestion} />
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: HOW TO PLAY GUIDE                                             */}
      {/* ==================================================================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-3xl bg-[#0A1E40] border-2 border-cyan-400/60 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                Luật chơi C01 – Ai là triệu phú 3D
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <p>
                • <strong>Chế độ Luyện tập (Mặc định):</strong> Đi qua toàn bộ 5, 10 hoặc 15 câu hỏi. Mỗi câu đúng +10 điểm, sai hoặc hết giờ 0 điểm và vẫn đi tiếp để xem giải thích.
              </p>
              <p>
                • <strong>Chế độ Chinh phục:</strong> Trả lời đúng để tiến lên bậc điểm tiếp theo (tối đa 600 điểm cho 15 câu, mốc bảo toàn tại câu 5 và câu 10). Có thể bấm <strong>“Dừng và giữ điểm”</strong> trước khi chốt đáp án.
              </p>
              <p>
                • <strong>4 Quyền trợ giúp:</strong> <strong>50:50</strong> (loại 2 đáp án sai), <strong>Hỏi cả lớp</strong> (nhập số phiếu biểu quyết thật tại lớp), <strong>Gợi ý kiến thức</strong> và <strong>Đổi câu hỏi</strong>.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CONFIRM REPLAY OR EXIT ACTIVE SESSION                         */}
      {/* ==================================================================== */}
      {confirmExitModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0A1E40] border-2 border-amber-400/60 p-6 text-white space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-amber-300">
              {confirmExitModal === 'REPLAY'
                ? 'Xác nhận chơi lại từ đầu?'
                : 'Xác nhận rời phiên chơi đang diễn ra?'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Tiến độ câu hỏi, thang điểm và các quyền trợ giúp của phiên hiện tại sẽ bị đặt lại.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmExitModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Ở lại chơi tiếp
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = confirmExitModal;
                  setConfirmExitModal(null);
                  voiceManagerRef.current?.cancel();
                  deadlineMsRef.current = null;
                  clearSavedSessionStorage();
                  if (target === 'LIBRARY' && onCloseGame) {
                    onCloseGame();
                  } else {
                    setPhase('SETUP');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Millionaire3DGame;
