/**
 * D08 — ĐẤU TRƯỜNG 4 ĐỘI 3D (Tây Đô Smart EDU)
 * Pure deterministic 4-Team Simultaneous Quiz Arena Engine:
 * - Main mode: 4 symmetrical teams (A, B, C, D) in fixed scoring positions, editable names, 1–50 HS
 * - Practice mode: single shared scoreboard for < 4 students or solo practice (ZERO fake opponent teams)
 * - Default 12 questions, 30s per question (optional unlimited timer), no negative points:
 *   - Correct: +10 pts; Wrong / No Answer: 0 pts
 *   - Double Power ("Quyền Nhân đôi"): optional per match, 1 use per team;
 *     must be toggled BEFORE opening question (topic preview phase), locked immediately on open,
 *     consumed even if wrong or no answer (+20 if right, 0 if wrong/no answer).
 *     Multiple teams may Double on the same question.
 *     Max score for 12 questions: 130 (Double ON) or 120 (Double OFF).
 * - Cancel faulty question: marks round invalid with explicit reason in history, REFUNDS any Double
 *   consumed on that cancelled question, and draws an unused replacement question (no repeats).
 * - Edit just-committed round before opening next question: recalculates ALL scores deterministically
 *   from history while preserving the round's locked Double decisions.
 * - Tie-aware ranking ("Đồng hạng") & Early Finish ("Kết thúc sớm").
 * - Built-in 12-question sample pack "Đấu trường 4 đội – Toán THCS" ("Dữ liệu mẫu") + Smart EDU RBAC bank adapter.
 * - Demo-isolated session persistence (never double-counts points or re-grants consumed Double powers).
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type ArenaTeamSlotId = 'A' | 'B' | 'C' | 'D';

export type ArenaPlayMode = 'four_teams' | 'practice';

export type ArenaQuestionSource = 'sample' | 'bank';

export type ArenaRoundPhase =
  | 'setup'
  | 'pre_open'
  | 'answering'
  | 'scoring'
  | 'committed'
  | 'finished';

export type ArenaTeamMark = 'unmarked' | 'correct' | 'wrong' | 'no_answer';

export interface ArenaTeamConfig {
  id: ArenaTeamSlotId;
  name: string;
  colorHex: string;
  accentBgClass: string;
  accentTextClass: string;
  accentBorderClass: string;
  colorNameVi: string;
}

export interface ArenaQuestionOption {
  id: string;
  label: 'A' | 'B' | 'C' | 'D';
  textLatex: string;
}

export interface ArenaQuestionItem {
  id: string;
  topic: string;
  stemLatex: string;
  options: ArenaQuestionOption[];
  correctOptionId: string | null;
  answerLatex: string;
  hintLatex: string;
  explanationLatex: string;
  plainReadText: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface ArenaTeamRoundOutcome {
  teamId: ArenaTeamSlotId;
  mark: ArenaTeamMark;
  selectedOptionId: string | null;
  usedDouble: boolean;
  pointsAwarded: number;
}

export interface ArenaRoundRecord {
  roundNumber: number; // 1-based play order
  questionIndex: number; // 0-based index in activeDeck
  questionId: string;
  questionTopic: string;
  questionStemLatex: string;
  answerLatex: string;
  explanationLatex: string;
  basePoints: number; // Locked at 10
  cancelled: boolean;
  cancelReason: string | null;
  outcomes: Record<ArenaTeamSlotId, ArenaTeamRoundOutcome>;
  committedAt: number;
}

export interface ArenaTeamStats {
  teamId: ArenaTeamSlotId;
  name: string;
  colorHex: string;
  score: number;
  correctCount: number;
  doubleUsedOnRound: number | null; // 1-based roundNumber where Double was consumed (and NOT cancelled)
  doubleAvailable: boolean;
}

export interface ArenaRankedTeam extends ArenaTeamStats {
  rank: number; // 1-based; equal scores share identical rank!
  isTied: boolean;
}

export interface ArenaMatchConfig {
  playMode: ArenaPlayMode;
  questionSource: ArenaQuestionSource;
  requestedQuestionCount: number; // Default 12
  timerSeconds: number; // Default 30; 0 = unlimited
  doublePowerEnabled: boolean; // Default true
  classSizeHint: number; // 1–50
  teams: ArenaTeamConfig[];
}

export interface ArenaGameState {
  config: ArenaMatchConfig;
  phase: ArenaRoundPhase;
  activeDeck: ArenaQuestionItem[];
  reserveDeck: ArenaQuestionItem[];
  currentDeckIndex: number; // Points to activeDeck[currentDeckIndex]
  validRoundsCompleted: number;
  endedEarly: boolean;

  // Current round live state
  pendingDoubles: Record<ArenaTeamSlotId, boolean>; // Editable ONLY in pre_open
  lockedDoubles: Record<ArenaTeamSlotId, boolean>; // Frozen at openCurrentQuestion
  draftMarks: Record<ArenaTeamSlotId, ArenaTeamMark>;
  draftOptionIds: Record<ArenaTeamSlotId, string | null>;
  answerRevealedInScoring: boolean;
  timeRemainingSec: number;
  isPaused: boolean;
  lastCommittedRoundId: string | null; // Anti-double-click idempotency token
  editingLastCommitted: boolean;

  // Authoritative history (all totals & Double consumption derived from history + active lockedDoubles)
  history: ArenaRoundRecord[];
  statusMessage: string | null;
}

export const D08_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D08_SESSION_STORAGE_KEY = 'taydo_d08_four_teams_session_v1';
export const D08_SESSION_VERSION = 1;
export const D08_BASE_POINTS = 10;
export const D08_TEAM_IDS: ArenaTeamSlotId[] = ['A', 'B', 'C', 'D'];

export const DEFAULT_ARENA_TEAMS: ArenaTeamConfig[] = [
  {
    id: 'A',
    name: 'Đội A',
    colorHex: '#EF4444',
    accentBgClass: 'bg-red-500/20',
    accentTextClass: 'text-red-300',
    accentBorderClass: 'border-red-500/60',
    colorNameVi: 'Đỏ',
  },
  {
    id: 'B',
    name: 'Đội B',
    colorHex: '#3B82F6',
    accentBgClass: 'bg-blue-500/20',
    accentTextClass: 'text-blue-300',
    accentBorderClass: 'border-blue-500/60',
    colorNameVi: 'Xanh dương',
  },
  {
    id: 'C',
    name: 'Đội C',
    colorHex: '#F59E0B',
    accentBgClass: 'bg-amber-500/20',
    accentTextClass: 'text-amber-300',
    accentBorderClass: 'border-amber-500/60',
    colorNameVi: 'Vàng',
  },
  {
    id: 'D',
    name: 'Đội D',
    colorHex: '#10B981',
    accentBgClass: 'bg-emerald-500/20',
    accentTextClass: 'text-emerald-300',
    accentBorderClass: 'border-emerald-500/60',
    colorNameVi: 'Xanh lá',
  },
];

// ============================================================================
// BUILT-IN 12-QUESTION SAMPLE PACK: "Đấu trường 4 đội – Toán THCS" ("Dữ liệu mẫu")
// Includes all 6 exact specification benchmark items + 6 THCS Math questions
// ============================================================================

export const D08_SAMPLE_QUESTIONS: ArenaQuestionItem[] = [
  {
    id: 'd08_sample_01',
    topic: 'Phân số & Số hữu tỉ',
    stemLatex: 'Tính \\(\\frac{5}{6}-\\frac{1}{4}\\).',
    options: [
      { id: 's1_a', label: 'A', textLatex: '\\(\\frac{7}{12}\\)' },
      { id: 's1_b', label: 'B', textLatex: '\\(\\frac{4}{2}\\)' },
      { id: 's1_c', label: 'C', textLatex: '\\(\\frac{1}{3}\\)' },
      { id: 's1_d', label: 'D', textLatex: '\\(\\frac{11}{12}\\)' },
    ],
    correctOptionId: 's1_a',
    answerLatex: '\\(\\frac{7}{12}\\)',
    hintLatex: 'Quy đồng mẫu chung nhỏ nhất của \\(6\\) và \\(4\\) là \\(12\\).',
    explanationLatex:
      'Quy đồng về mẫu số chung \\(12\\): \\(\\frac{5}{6}-\\frac{1}{4} = \\frac{10}{12}-\\frac{3}{12} = \\frac{7}{12}\\).',
    plainReadText: 'Tính 5 phần 6 trừ 1 phần 4.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_02',
    topic: 'Số nguyên & Lũy thừa',
    stemLatex: 'Tính \\((-4)^2+(-4)\\).',
    options: [
      { id: 's2_a', label: 'A', textLatex: '\\(-20\\)' },
      { id: 's2_b', label: 'B', textLatex: '\\(12\\)' },
      { id: 's2_c', label: 'C', textLatex: '\\(20\\)' },
      { id: 's2_d', label: 'D', textLatex: '\\(-12\\)' },
    ],
    correctOptionId: 's2_b',
    answerLatex: '\\(12\\)',
    hintLatex: 'Lưu ý dấu ngoặc: \\((-4)^2 = (-4)\\times(-4) = 16\\).',
    explanationLatex: 'Ta có \\((-4)^2 = 16\\), suy ra \\((-4)^2 + (-4) = 16 - 4 = 12\\).',
    plainReadText: 'Tính âm 4 tất cả bình phương cộng với âm 4.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_03',
    topic: 'Căn bậc hai số học',
    stemLatex: 'Tính \\(\\sqrt{(-6)^2}\\).',
    options: [
      { id: 's3_a', label: 'A', textLatex: '\\(-6\\)' },
      { id: 's3_b', label: 'B', textLatex: '\\(36\\)' },
      { id: 's3_c', label: 'C', textLatex: '\\(6\\)' },
      { id: 's3_d', label: 'D', textLatex: '\\(12\\)' },
    ],
    correctOptionId: 's3_c',
    answerLatex: '\\(6\\)',
    hintLatex: 'Nhớ hằng đẳng thức \\(\\sqrt{a^2} = |a|\\) luôn không âm.',
    explanationLatex: 'Ta có \\(\\sqrt{(-6)^2} = |-6| = 6\\) (hoặc \\(\\sqrt{36} = 6\\)).',
    plainReadText: 'Tính căn bậc hai số học của âm 6 tất cả bình phương.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_04',
    topic: 'Phương trình bậc nhất',
    stemLatex: 'Giải phương trình \\(4x-7=13\\).',
    options: [
      { id: 's4_a', label: 'A', textLatex: '\\(x=3\\)' },
      { id: 's4_b', label: 'B', textLatex: '\\(x=4\\)' },
      { id: 's4_c', label: 'C', textLatex: '\\(x=6\\)' },
      { id: 's4_d', label: 'D', textLatex: '\\(x=5\\)' },
    ],
    correctOptionId: 's4_d',
    answerLatex: '\\(x=5\\)',
    hintLatex: 'Chuyển \\(-7\\) sang vế phải thành \\(+7\\) rồi chia cả hai vế cho \\(4\\).',
    explanationLatex: '\\(4x - 7 = 13 \\Leftrightarrow 4x = 20 \\Leftrightarrow x = 5\\).',
    plainReadText: 'Giải phương trình 4x trừ 7 bằng 13.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_05',
    topic: 'Hệ phương trình bậc nhất',
    stemLatex: 'Giải hệ phương trình \\[\\begin{cases}x+y=10\\\\x-y=2\\end{cases}\\]',
    options: [
      { id: 's5_a', label: 'A', textLatex: '\\(x=6,\\ y=4\\)' },
      { id: 's5_b', label: 'B', textLatex: '\\(x=4,\\ y=6\\)' },
      { id: 's5_c', label: 'C', textLatex: '\\(x=7,\\ y=3\\)' },
      { id: 's5_d', label: 'D', textLatex: '\\(x=8,\\ y=2\\)' },
    ],
    correctOptionId: 's5_a',
    answerLatex: '\\(x=6,\\ y=4\\)',
    hintLatex: 'Cộng vế theo vế hai phương trình để khử ẩn \\(y\\).',
    explanationLatex:
      'Cộng hai phương trình: \\(2x = 12 \\Rightarrow x = 6\\). Thay vào \\(x + y = 10\\) được \\(y = 4\\).',
    plainReadText: 'Giải hệ phương trình: x cộng y bằng 10 và x trừ y bằng 2.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_06',
    topic: 'Xác suất thực nghiệm & Cổ điển',
    stemLatex:
      'Tung một xúc xắc cân đối sáu mặt. Xác suất xuất hiện mặt có số chấm lớn hơn \\(4\\) là bao nhiêu?',
    options: [
      { id: 's6_a', label: 'A', textLatex: '\\(\\frac{1}{6}\\)' },
      { id: 's6_b', label: 'B', textLatex: '\\(\\frac{2}{6}=\\frac{1}{3}\\)' },
      { id: 's6_c', label: 'C', textLatex: '\\(\\frac{1}{2}\\)' },
      { id: 's6_d', label: 'D', textLatex: '\\(\\frac{2}{3}\\)' },
    ],
    correctOptionId: 's6_b',
    answerLatex: '\\(\\frac{2}{6}=\\frac{1}{3}\\)',
    hintLatex: 'Đếm số mặt có số chấm lớn hơn \\(4\\) trong \\(\\{1,2,3,4,5,6\\}\\).',
    explanationLatex:
      'Có \\(2\\) kết quả thuận lợi là \\(5\\) và \\(6\\) trên tổng số \\(6\\) mặt, nên xác suất là \\(\\frac{2}{6} = \\frac{1}{3}\\).',
    plainReadText:
      'Tung một xúc xắc cân đối sáu mặt. Xác suất xuất hiện số chấm lớn hơn 4 là bao nhiêu?',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_07',
    topic: 'Định lý Pythagore',
    stemLatex:
      'Một tam giác vuông có hai cạnh góc vuông dài \\(6\\text{ cm}\\) và \\(8\\text{ cm}\\). Độ dài cạnh huyền là:',
    options: [
      { id: 's7_a', label: 'A', textLatex: '\\(12\\text{ cm}\\)' },
      { id: 's7_b', label: 'B', textLatex: '\\(14\\text{ cm}\\)' },
      { id: 's7_c', label: 'C', textLatex: '\\(10\\text{ cm}\\)' },
      { id: 's7_d', label: 'D', textLatex: '\\(9\\text{ cm}\\)' },
    ],
    correctOptionId: 's7_c',
    answerLatex: '\\(10\\text{ cm}\\)',
    hintLatex: 'Áp dụng công thức \\(c = \\sqrt{a^2 + b^2}\\).',
    explanationLatex:
      'Theo định lý Pythagore: \\(c = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10\\text{ cm}\\).',
    plainReadText:
      'Một tam giác vuông có hai cạnh góc vuông dài 6 xen-ti-mét và 8 xen-ti-mét. Tính độ dài cạnh huyền.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_08',
    topic: 'Hằng đẳng thức đáng nhớ',
    stemLatex: 'Rút gọn biểu thức \\((x+3)^2 - x^2\\).',
    options: [
      { id: 's8_a', label: 'A', textLatex: '\\(9\\)' },
      { id: 's8_b', label: 'B', textLatex: '\\(3x + 9\\)' },
      { id: 's8_c', label: 'C', textLatex: '\\(6x + 6\\)' },
      { id: 's8_d', label: 'D', textLatex: '\\(6x + 9\\)' },
    ],
    correctOptionId: 's8_d',
    answerLatex: '\\(6x + 9\\)',
    hintLatex: 'Khai triển \\((x+3)^2 = x^2 + 6x + 9\\).',
    explanationLatex: '\\((x+3)^2 - x^2 = (x^2 + 6x + 9) - x^2 = 6x + 9\\).',
    plainReadText: 'Rút gọn biểu thức mở ngoặc x cộng 3 đóng ngoặc bình phương trừ x bình phương.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_09',
    topic: 'Tỉ số phần trăm',
    stemLatex: 'Một quyển sách giá \\(80\\,000\\text{ đ}\\) được giảm \\(15\\%\\). Giá sau khi giảm là:',
    options: [
      { id: 's9_a', label: 'A', textLatex: '\\(68\\,000\\text{ đ}\\)' },
      { id: 's9_b', label: 'B', textLatex: '\\(65\\,000\\text{ đ}\\)' },
      { id: 's9_c', label: 'C', textLatex: '\\(72\\,000\\text{ đ}\\)' },
      { id: 's9_d', label: 'D', textLatex: '\\(70\\,000\\text{ đ}\\)' },
    ],
    correctOptionId: 's9_a',
    answerLatex: '\\(68\\,000\\text{ đ}\\)',
    hintLatex: 'Tính số tiền được giảm: \\(15\\% \\times 80\\,000\\).',
    explanationLatex:
      'Số tiền giảm là \\(80\\,000 \\times 0{,}15 = 12\\,000\\text{ đ}\\). Giá mới là \\(80\\,000 - 12\\,000 = 68\\,000\\text{ đ}\\).',
    plainReadText: 'Một quyển sách giá 80 nghìn đồng được giảm 15 phần trăm. Giá sau khi giảm là bao nhiêu?',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_10',
    topic: 'Hàm số bậc nhất',
    stemLatex: 'Cho hàm số \\(y = -2x + 5\\). Tính giá trị của \\(y\\) khi \\(x = -3\\).',
    options: [
      { id: 's10_a', label: 'A', textLatex: '\\(-1\\)' },
      { id: 's10_b', label: 'B', textLatex: '\\(11\\)' },
      { id: 's10_c', label: 'C', textLatex: '\\(1\\)' },
      { id: 's10_d', label: 'D', textLatex: '\\(-11\\)' },
    ],
    correctOptionId: 's10_b',
    answerLatex: '\\(11\\)',
    hintLatex: 'Chú ý dấu âm nhân dấu âm: \\((-2)\\times(-3) = +6\\).',
    explanationLatex: 'Thay \\(x = -3\\): \\(y = (-2)\\cdot(-3) + 5 = 6 + 5 = 11\\).',
    plainReadText: 'Cho hàm số y bằng âm 2x cộng 5. Tính giá trị của y khi x bằng âm 3.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_11',
    topic: 'Hình học phẳng',
    stemLatex:
      'Một hình thang có hai đáy dài \\(7\\text{ cm}\\) và \\(11\\text{ cm}\\), chiều cao \\(5\\text{ cm}\\). Diện tích hình thang là:',
    options: [
      { id: 's11_a', label: 'A', textLatex: '\\(90\\text{ cm}^2\\)' },
      { id: 's11_b', label: 'B', textLatex: '\\(35\\text{ cm}^2\\)' },
      { id: 's11_c', label: 'C', textLatex: '\\(45\\text{ cm}^2\\)' },
      { id: 's11_d', label: 'D', textLatex: '\\(55\\text{ cm}^2\\)' },
    ],
    correctOptionId: 's11_c',
    answerLatex: '\\(45\\text{ cm}^2\\)',
    hintLatex: 'Công thức diện tích hình thang: \\(S = \\frac{(a+b)\\cdot h}{2}\\).',
    explanationLatex: '\\(S = \\frac{(7 + 11) \\times 5}{2} = \\frac{18 \\times 5}{2} = 45\\text{ cm}^2\\).',
    plainReadText:
      'Một hình thang có hai đáy dài 7 xen-ti-mét và 11 xen-ti-mét, chiều cao 5 xen-ti-mét. Tính diện tích hình thang.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_sample_12',
    topic: 'Bất phương trình & Thống kê',
    stemLatex: 'Trung bình cộng của bốn số \\(6,\\ 8,\\ 10,\\ x\\) bằng \\(9\\). Tìm \\(x\\).',
    options: [
      { id: 's12_a', label: 'A', textLatex: '\\(x = 10\\)' },
      { id: 's12_b', label: 'B', textLatex: '\\(x = 11\\)' },
      { id: 's12_c', label: 'C', textLatex: '\\(x = 14\\)' },
      { id: 's12_d', label: 'D', textLatex: '\\(x = 12\\)' },
    ],
    correctOptionId: 's12_d',
    answerLatex: '\\(x = 12\\)',
    hintLatex: 'Tổng của \\(4\\) số là \\(4 \\times 9 = 36\\).',
    explanationLatex:
      'Ta có \\(\\frac{6 + 8 + 10 + x}{4} = 9 \\Rightarrow 24 + x = 36 \\Rightarrow x = 12\\).',
    plainReadText: 'Trung bình cộng của bốn số 6, 8, 10 và x bằng 9. Tìm x.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
];

// Reserve sample replacement questions (used ONLY if a sample question is cancelled for error!)
export const D08_SAMPLE_RESERVE: ArenaQuestionItem[] = [
  {
    id: 'd08_reserve_01',
    topic: 'Lũy thừa & Thứ tự phép tính',
    stemLatex: 'Tính \\(2^3 \\times 3 - 4\\).',
    options: [
      { id: 'r1_a', label: 'A', textLatex: '\\(20\\)' },
      { id: 'r1_b', label: 'B', textLatex: '\\(14\\)' },
      { id: 'r1_c', label: 'C', textLatex: '\\(24\\)' },
      { id: 'r1_d', label: 'D', textLatex: '\\(18\\)' },
    ],
    correctOptionId: 'r1_a',
    answerLatex: '\\(20\\)',
    hintLatex: 'Tính lũy thừa \\(2^3 = 8\\) trước khi nhân và trừ.',
    explanationLatex: '\\(2^3 \\times 3 - 4 = 8 \\times 3 - 4 = 24 - 4 = 20\\).',
    plainReadText: 'Tính 2 mũ 3 nhân 3 trừ 4.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
  {
    id: 'd08_reserve_02',
    topic: 'Tỉ lệ thức',
    stemLatex: 'Tìm \\(x\\) biết \\(\\frac{x}{6} = \\frac{5}{3}\\).',
    options: [
      { id: 'r2_a', label: 'A', textLatex: '\\(x = 8\\)' },
      { id: 'r2_b', label: 'B', textLatex: '\\(x = 10\\)' },
      { id: 'r2_c', label: 'C', textLatex: '\\(x = 12\\)' },
      { id: 'r2_d', label: 'D', textLatex: '\\(x = 15\\)' },
    ],
    correctOptionId: 'r2_b',
    answerLatex: '\\(x = 10\\)',
    hintLatex: 'Nhân chéo: \\(3x = 6 \\times 5\\).',
    explanationLatex: '\\(x = \\frac{6 \\times 5}{3} = 10\\).',
    plainReadText: 'Tìm x biết x phần 6 bằng 5 phần 3.',
    isSample: true,
    sourceBadge: D08_SAMPLE_BADGE,
  },
];

// ============================================================================
// SMART EDU QUESTION BANK ADAPTER (Enforces RBAC, deduplicates, zero repeats)
// ============================================================================

export function adaptBankQuestionsForD08(
  bankQuestions: Question[],
  userRole: UserRole
): ArenaQuestionItem[] {
  if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) return [];
  const seen = new Set<string>();
  const adapted: ArenaQuestionItem[] = [];

  for (const q of bankQuestions) {
    if (!q || !q.id || seen.has(q.id)) continue;
    if (q.status === 'deprecated') continue;
    if (userRole === 'student' && q.status !== 'approved') continue;
    const stem = (q.stem || '').trim();
    if (!stem) continue;

    seen.add(q.id);
    const topic = (q.chapter || q.lesson || 'Ngân hàng Smart EDU').trim();
    const explanation = (q.explanation || 'Giáo viên hướng dẫn lời giải trên lớp.').trim();

    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const opts: ArenaQuestionOption[] = q.options.slice(0, 4).map((opt, idx) => ({
        id: opt.id || `${q.id}_opt_${idx}`,
        label: opt.label || (['A', 'B', 'C', 'D'][idx] as 'A' | 'B' | 'C' | 'D'),
        textLatex: opt.text || '',
      }));
      const matchedOpt =
        opts.find((o) => o.id === q.correctAnswer || o.label === q.correctAnswer) || opts[0];
      adapted.push({
        id: q.id,
        topic,
        stemLatex: stem,
        options: opts,
        correctOptionId: matchedOpt ? matchedOpt.id : null,
        answerLatex: matchedOpt ? `${matchedOpt.label}. ${matchedOpt.textLatex}` : '',
        hintLatex: q.yccd ? `Gợi ý theo yêu cầu cần đạt: ${q.yccd}` : 'Đọc kỹ đề bài và kiểm tra điều kiện.',
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      });
    } else if (q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false_group') {
      const answerStr =
        q.type === 'short_answer' && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0
          ? q.acceptedAnswers[0]
          : q.type === 'true_false_group' && Array.isArray(q.subItems)
            ? q.subItems.map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`).join(' · ')
            : q.sampleAnswer || 'Xem lời giải chi tiết';
      adapted.push({
        id: q.id,
        topic,
        stemLatex: stem,
        options: [],
        correctOptionId: null,
        answerLatex: answerStr,
        hintLatex: q.yccd ? `Gợi ý: ${q.yccd}` : 'Tóm tắt giả thiết rồi thực hiện từng bước.',
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      });
    }
  }

  return adapted;
}

// ============================================================================
// PURE SCORE & RANKING RECOMPUTATION (Single Source of Truth from History!)
// ============================================================================

export function getActiveTeamIds(playMode: ArenaPlayMode): ArenaTeamSlotId[] {
  return playMode === 'practice' ? ['A'] : D08_TEAM_IDS;
}

export function getMaxPossibleScore(questionCount: number, doublePowerEnabled: boolean): number {
  const safeCount = Math.max(0, Math.floor(questionCount));
  if (safeCount === 0) return 0;
  return safeCount * D08_BASE_POINTS + (doublePowerEnabled ? D08_BASE_POINTS : 0);
}

export function createEmptyMarkMap(): Record<ArenaTeamSlotId, ArenaTeamMark> {
  return { A: 'unmarked', B: 'unmarked', C: 'unmarked', D: 'unmarked' };
}

export function createEmptyBoolMap(): Record<ArenaTeamSlotId, boolean> {
  return { A: false, B: false, C: false, D: false };
}

export function createEmptyOptionMap(): Record<ArenaTeamSlotId, string | null> {
  return { A: null, B: null, C: null, D: null };
}

/**
 * Computes authoritative stats for all active teams directly from `history` + currently locked open round.
 * - Guarantees zero score drift, exact Double consumption tracking, and full refund on cancelled rounds.
 */
export function computeArenaTeamStats(state: ArenaGameState): ArenaTeamStats[] {
  const activeIds = getActiveTeamIds(state.config.playMode);
  const currentRoundNumber = state.validRoundsCompleted + 1;
  const isRoundOpenedAndUncommitted =
    state.phase === 'answering' || state.phase === 'scoring';

  return activeIds.map((teamId) => {
    const cfg = state.config.teams.find((t) => t.id === teamId) || DEFAULT_ARENA_TEAMS[0];
    let score = 0;
    let correctCount = 0;
    let doubleUsedOnRound: number | null = null;

    for (const rec of state.history) {
      if (rec.cancelled) continue; // Cancelled rounds award 0 and REFUND Double!
      const out = rec.outcomes[teamId];
      if (!out) continue;
      score += out.pointsAwarded;
      if (out.mark === 'correct') correctCount += 1;
      if (out.usedDouble && doubleUsedOnRound === null) {
        doubleUsedOnRound = rec.roundNumber;
      }
    }

    // If current round is opened (answering/scoring) and this team locked Double, it is ALREADY consumed!
    if (
      doubleUsedOnRound === null &&
      isRoundOpenedAndUncommitted &&
      state.lockedDoubles[teamId]
    ) {
      doubleUsedOnRound = currentRoundNumber;
    }

    const doubleAvailable =
      state.config.doublePowerEnabled &&
      state.config.playMode === 'four_teams' &&
      doubleUsedOnRound === null;

    return {
      teamId,
      name: state.config.playMode === 'practice' ? 'Bảng điểm chung' : cfg.name,
      colorHex: cfg.colorHex,
      score,
      correctCount,
      doubleUsedOnRound,
      doubleAvailable,
    };
  });
}

/**
 * Ranks active teams descending by total score with exact tie handling ("Đồng hạng").
 */
export function computeArenaRankings(state: ArenaGameState): ArenaRankedTeam[] {
  const stats = computeArenaTeamStats(state);
  const sorted = [...stats].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return D08_TEAM_IDS.indexOf(a.teamId) - D08_TEAM_IDS.indexOf(b.teamId);
  });

  const scoreCounts = new Map<number, number>();
  for (const s of sorted) {
    scoreCounts.set(s.score, (scoreCounts.get(s.score) || 0) + 1);
  }

  let currentRank = 1;
  return sorted.map((item, idx) => {
    if (idx > 0 && item.score < sorted[idx - 1].score) {
      currentRank = idx + 1;
    }
    return {
      ...item,
      rank: currentRank,
      isTied: (scoreCounts.get(item.score) || 0) > 1,
    };
  });
}

export function previewRoundPoints(mark: ArenaTeamMark, usedDouble: boolean): number {
  if (mark !== 'correct') return 0;
  return usedDouble ? D08_BASE_POINTS * 2 : D08_BASE_POINTS;
}

// ============================================================================
// MATCH LIFECYCLE & TEACHER WORKFLOW TRANSITIONS
// ============================================================================

export function createDefaultArenaConfig(overrides?: Partial<ArenaMatchConfig>): ArenaMatchConfig {
  return {
    playMode: overrides?.playMode ?? 'four_teams',
    questionSource: overrides?.questionSource ?? 'sample',
    requestedQuestionCount: overrides?.requestedQuestionCount ?? 12,
    timerSeconds: overrides?.timerSeconds ?? 30,
    doublePowerEnabled: overrides?.doublePowerEnabled ?? true,
    classSizeHint: Math.max(1, Math.min(50, Math.round(overrides?.classSizeHint ?? 40))),
    teams:
      overrides?.teams && overrides.teams.length === 4
        ? overrides.teams.map((t, i) => ({
            ...DEFAULT_ARENA_TEAMS[i],
            ...t,
            name: (t.name || DEFAULT_ARENA_TEAMS[i].name).trim() || DEFAULT_ARENA_TEAMS[i].name,
          }))
        : DEFAULT_ARENA_TEAMS.map((t) => ({ ...t })),
  };
}

export function createArenaSetupState(overrides?: Partial<ArenaMatchConfig>): ArenaGameState {
  const config = createDefaultArenaConfig(overrides);
  return {
    config,
    phase: 'setup',
    activeDeck: D08_SAMPLE_QUESTIONS.slice(0, Math.min(config.requestedQuestionCount, D08_SAMPLE_QUESTIONS.length)),
    reserveDeck: D08_SAMPLE_RESERVE.slice(),
    currentDeckIndex: 0,
    validRoundsCompleted: 0,
    endedEarly: false,
    pendingDoubles: createEmptyBoolMap(),
    lockedDoubles: createEmptyBoolMap(),
    draftMarks: createEmptyMarkMap(),
    draftOptionIds: createEmptyOptionMap(),
    answerRevealedInScoring: false,
    timeRemainingSec: config.timerSeconds,
    isPaused: false,
    lastCommittedRoundId: null,
    editingLastCommitted: false,
    history: [],
    statusMessage: null,
  };
}

/**
 * Starts a match from a validated pool (never repeats questions; splits remaining into reserveDeck).
 */
export function startArenaMatch(
  configInput: Partial<ArenaMatchConfig>,
  questionPool: ArenaQuestionItem[],
  reservePool: ArenaQuestionItem[] = []
): { state: ArenaGameState; error: string | null } {
  const config = createDefaultArenaConfig(configInput);
  if (questionPool.length === 0) {
    return {
      state: createArenaSetupState(config),
      error: 'Bộ câu hỏi hiện tại chưa có câu hợp lệ. Vui lòng chọn bộ Dữ liệu mẫu hoặc nguồn khác.',
    };
  }
  const count = Math.min(Math.max(1, config.requestedQuestionCount), questionPool.length);
  const activeDeck = questionPool.slice(0, count);
  const activeIds = new Set(activeDeck.map((q) => q.id));
  const extraFromPool = questionPool.slice(count).filter((q) => !activeIds.has(q.id));
  const extraReserve = reservePool.filter((q) => !activeIds.has(q.id));

  const nextConfig: ArenaMatchConfig = {
    ...config,
    requestedQuestionCount: count,
    doublePowerEnabled: config.playMode === 'practice' ? false : config.doublePowerEnabled,
  };

  return {
    error: null,
    state: {
      config: nextConfig,
      phase: 'pre_open',
      activeDeck,
      reserveDeck: [...extraFromPool, ...extraReserve],
      currentDeckIndex: 0,
      validRoundsCompleted: 0,
      endedEarly: false,
      pendingDoubles: createEmptyBoolMap(),
      lockedDoubles: createEmptyBoolMap(),
      draftMarks: createEmptyMarkMap(),
      draftOptionIds: createEmptyOptionMap(),
      answerRevealedInScoring: false,
      timeRemainingSec: nextConfig.timerSeconds,
      isPaused: false,
      lastCommittedRoundId: null,
      editingLastCommitted: false,
      history: [],
      statusMessage:
        nextConfig.doublePowerEnabled
          ? 'Thông báo chủ đề câu 1 và ghi nhận đội chọn Quyền Nhân đôi (nếu có) trước khi mở đề.'
          : 'Sẵn sàng mở câu hỏi đầu tiên.',
    },
  };
}

/**
 * Step 1: Toggle Double power for a team ONLY in `pre_open` phase and ONLY if team still has it available.
 */
export function toggleTeamPendingDouble(
  state: ArenaGameState,
  teamId: ArenaTeamSlotId
): { state: ArenaGameState; changed: boolean } {
  if (
    state.phase !== 'pre_open' ||
    state.config.playMode !== 'four_teams' ||
    !state.config.doublePowerEnabled
  ) {
    return { state, changed: false };
  }
  const stats = computeArenaTeamStats(state).find((s) => s.teamId === teamId);
  if (!stats || !stats.doubleAvailable) {
    return { state, changed: false };
  }

  return {
    changed: true,
    state: {
      ...state,
      pendingDoubles: {
        ...state.pendingDoubles,
        [teamId]: !state.pendingDoubles[teamId],
      },
    },
  };
}

/**
 * Step 2: Open current question -> LOCKS Double choices immediately, reveals question & starts timer.
 */
export function openCurrentQuestion(state: ArenaGameState): ArenaGameState {
  if (state.phase !== 'pre_open') return state;
  const stats = computeArenaTeamStats(state);
  const locked = createEmptyBoolMap();
  for (const s of stats) {
    locked[s.teamId] = Boolean(
      state.config.doublePowerEnabled &&
        state.config.playMode === 'four_teams' &&
        s.doubleAvailable &&
        state.pendingDoubles[s.teamId]
    );
  }

  const doubledNames = stats
    .filter((s) => locked[s.teamId])
    .map((s) => s.name)
    .join(', ');

  return {
    ...state,
    phase: 'answering',
    lockedDoubles: locked,
    pendingDoubles: createEmptyBoolMap(),
    draftMarks: createEmptyMarkMap(),
    draftOptionIds: createEmptyOptionMap(),
    answerRevealedInScoring: false,
    timeRemainingSec: state.config.timerSeconds,
    isPaused: false,
    editingLastCommitted: false,
    statusMessage: doubledNames
      ? `Đã khóa Quyền Nhân đôi (${doubledNames}) và mở câu hỏi!`
      : 'Đã mở câu hỏi. Các đội ghi đáp án vào bảng con.',
  };
}

export function toggleArenaPause(state: ArenaGameState): ArenaGameState {
  if (state.phase !== 'answering' && state.phase !== 'scoring') return state;
  return {
    ...state,
    isPaused: !state.isPaused,
    statusMessage: !state.isPaused
      ? 'Trận đấu đang tạm dừng (đã khóa chốt điểm).'
      : 'Đã tiếp tục trận đấu.',
  };
}

export function tickArenaTimerOneSecond(state: ArenaGameState): {
  state: ArenaGameState;
  expiredNow: boolean;
} {
  if (
    state.phase !== 'answering' ||
    state.isPaused ||
    state.config.timerSeconds <= 0
  ) {
    return { state, expiredNow: false };
  }
  const nextSec = Math.max(0, state.timeRemainingSec - 1);
  if (nextSec === 0) {
    return {
      expiredNow: true,
      state: {
        ...state,
        timeRemainingSec: 0,
        phase: 'scoring',
        statusMessage: 'Hết giờ! Giáo viên vẫn có thể nhập và chấm các đáp án đã ghi trước hạn.',
      },
    };
  }
  return {
    expiredNow: false,
    state: {
      ...state,
      timeRemainingSec: nextSec,
    },
  };
}

/**
 * Step 3: Stop answering phase manually -> move to simultaneous scoring.
 */
export function stopAnsweringPhase(state: ArenaGameState): ArenaGameState {
  if (state.phase !== 'answering' || state.isPaused) return state;
  return {
    ...state,
    phase: 'scoring',
    statusMessage: 'Đã dừng trả lời. Chấm đáp án cho các đội rồi bấm Xác nhận cộng điểm.',
  };
}

/**
 * Step 4: Mark a single team as correct / wrong / no_answer (or pick an option A–D).
 * Works in `scoring` (normal) OR `committed` while `editingLastCommitted === true`.
 */
export function setTeamRoundMark(
  state: ArenaGameState,
  teamId: ArenaTeamSlotId,
  mark: ArenaTeamMark,
  selectedOptionId: string | null = null
): ArenaGameState {
  if (state.isPaused) return state;
  if (state.phase !== 'scoring' && !(state.phase === 'committed' && state.editingLastCommitted)) {
    return state;
  }
  return {
    ...state,
    draftMarks: {
      ...state.draftMarks,
      [teamId]: mark,
    },
    draftOptionIds: {
      ...state.draftOptionIds,
      [teamId]: selectedOptionId,
    },
  };
}

export function setTeamSelectedOption(
  state: ArenaGameState,
  teamId: ArenaTeamSlotId,
  optionId: string
): ArenaGameState {
  const q = state.activeDeck[state.currentDeckIndex];
  if (!q) return state;
  const mark: ArenaTeamMark =
    q.correctOptionId && optionId === q.correctOptionId ? 'correct' : 'wrong';
  return setTeamRoundMark(state, teamId, mark, optionId);
}

export function areAllActiveTeamsMarked(state: ArenaGameState): boolean {
  const activeIds = getActiveTeamIds(state.config.playMode);
  return activeIds.every((id) => state.draftMarks[id] !== 'unmarked');
}

/**
 * Step 5: Commit round results ONCE (strictly blocked if paused, unmarked teams remain, or already committed).
 * Also handles saving edits when `editingLastCommitted === true` (recomputes totals cleanly from history!).
 */
export function commitCurrentRound(state: ArenaGameState): {
  state: ArenaGameState;
  committed: boolean;
  anyScored: boolean;
  hasDoubleWinner: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, committed: false, anyScored: false, hasDoubleWinner: false, reason: 'Trận đang tạm dừng.' };
  }
  const isEditing = state.phase === 'committed' && state.editingLastCommitted;
  if (state.phase !== 'scoring' && !isEditing) {
    return { state, committed: false, anyScored: false, hasDoubleWinner: false, reason: 'Không ở trạng thái chấm điểm.' };
  }
  if (!areAllActiveTeamsMarked(state)) {
    return {
      state,
      committed: false,
      anyScored: false,
      hasDoubleWinner: false,
      reason: 'Vui lòng chấm đủ tất cả các đội trước khi xác nhận cộng điểm.',
    };
  }

  const q = state.activeDeck[state.currentDeckIndex];
  if (!q) {
    return { state, committed: false, anyScored: false, hasDoubleWinner: false };
  }

  const roundToken = `${state.currentDeckIndex}:${q.id}`;
  if (!isEditing && state.lastCommittedRoundId === roundToken) {
    // Anti-double-click idempotency guard!
    return { state, committed: false, anyScored: false, hasDoubleWinner: false, reason: 'Câu này đã được xác nhận.' };
  }

  const activeIds = getActiveTeamIds(state.config.playMode);
  const outcomes = {} as Record<ArenaTeamSlotId, ArenaTeamRoundOutcome>;
  let anyScored = false;
  let hasDoubleWinner = false;

  for (const tid of D08_TEAM_IDS) {
    if (!activeIds.includes(tid)) {
      outcomes[tid] = {
        teamId: tid,
        mark: 'no_answer',
        selectedOptionId: null,
        usedDouble: false,
        pointsAwarded: 0,
      };
      continue;
    }
    const mark = state.draftMarks[tid];
    const usedDouble = Boolean(state.lockedDoubles[tid]);
    const pts = previewRoundPoints(mark, usedDouble);
    if (pts > 0) anyScored = true;
    if (pts > D08_BASE_POINTS) hasDoubleWinner = true;
    outcomes[tid] = {
      teamId: tid,
      mark,
      selectedOptionId: state.draftOptionIds[tid],
      usedDouble,
      pointsAwarded: pts,
    };
  }

  if (isEditing) {
    // Replace the latest non-cancelled history record (preserving its roundNumber & lockedDoubles)
    const nextHistory = [...state.history];
    for (let i = nextHistory.length - 1; i >= 0; i--) {
      if (!nextHistory[i].cancelled && nextHistory[i].questionIndex === state.currentDeckIndex) {
        nextHistory[i] = {
          ...nextHistory[i],
          outcomes,
          committedAt: Date.now(),
        };
        break;
      }
    }
    return {
      committed: true,
      anyScored,
      hasDoubleWinner,
      state: {
        ...state,
        history: nextHistory,
        editingLastCommitted: false,
        answerRevealedInScoring: true,
        statusMessage: 'Đã cập nhật lại kết quả câu vừa chấm và tính lại tổng điểm.',
      },
    };
  }

  const roundNumber = state.validRoundsCompleted + 1;
  const record: ArenaRoundRecord = {
    roundNumber,
    questionIndex: state.currentDeckIndex,
    questionId: q.id,
    questionTopic: q.topic,
    questionStemLatex: q.stemLatex,
    answerLatex: q.answerLatex,
    explanationLatex: q.explanationLatex,
    basePoints: D08_BASE_POINTS,
    cancelled: false,
    cancelReason: null,
    outcomes,
    committedAt: Date.now(),
  };

  return {
    committed: true,
    anyScored,
    hasDoubleWinner,
    state: {
      ...state,
      phase: 'committed',
      validRoundsCompleted: roundNumber,
      lastCommittedRoundId: roundToken,
      editingLastCommitted: false,
      answerRevealedInScoring: true,
      history: [...state.history, record],
      statusMessage: anyScored
        ? `Đã xác nhận điểm Câu ${roundNumber}. Giáo viên có thể giải thích rồi mở câu tiếp theo.`
        : `Đã xác nhận Câu ${roundNumber} (chưa có đội ghi điểm).`,
    },
  };
}

/**
 * Allows teacher to edit the just-committed round BEFORE moving to next question or finalizing summary.
 * Preserves lockedDoubles strictly.
 */
export function startEditingLastCommittedRound(state: ArenaGameState): ArenaGameState {
  if (state.phase !== 'committed' || state.editingLastCommitted) return state;
  const lastRec = [...state.history]
    .reverse()
    .find((r) => !r.cancelled && r.questionIndex === state.currentDeckIndex);
  if (!lastRec) return state;

  const marks = createEmptyMarkMap();
  const opts = createEmptyOptionMap();
  const locked = createEmptyBoolMap();
  for (const tid of D08_TEAM_IDS) {
    marks[tid] = lastRec.outcomes[tid]?.mark ?? 'unmarked';
    opts[tid] = lastRec.outcomes[tid]?.selectedOptionId ?? null;
    locked[tid] = Boolean(lastRec.outcomes[tid]?.usedDouble);
  }

  return {
    ...state,
    editingLastCommitted: true,
    draftMarks: marks,
    draftOptionIds: opts,
    lockedDoubles: locked,
    statusMessage: 'Đang sửa kết quả câu vừa xác nhận (giữ nguyên quyết định Nhân đôi).',
  };
}

/**
 * Cancels an opened faulty question:
 * - Marks the round invalid with explicit reason in history (0 pts)
 * - REFUNDS any Double power consumed on that cancelled question
 * - Replaces current slot with an unseen replacement question from reserveDeck (if available)
 */
export function cancelCurrentQuestionForError(
  state: ArenaGameState,
  reasonInput: string
): { state: ArenaGameState; replaced: boolean } {
  if (
    state.phase !== 'answering' &&
    state.phase !== 'scoring' &&
    state.phase !== 'committed'
  ) {
    return { state, replaced: false };
  }

  const q = state.activeDeck[state.currentDeckIndex];
  if (!q) return { state, replaced: false };

  const cleanReason =
    (reasonInput || '').trim() || 'Lỗi nội dung hoặc tài nguyên câu hỏi (giáo viên hủy lượt).';

  const zeroOutcomes = {} as Record<ArenaTeamSlotId, ArenaTeamRoundOutcome>;
  for (const tid of D08_TEAM_IDS) {
    zeroOutcomes[tid] = {
      teamId: tid,
      mark: 'no_answer',
      selectedOptionId: null,
      usedDouble: false, // Refunded!
      pointsAwarded: 0,
    };
  }

  // If this question was just committed, convert its history record into cancelled & decrement validRoundsCompleted
  let nextHistory = [...state.history];
  let nextValidCompleted = state.validRoundsCompleted;
  if (state.phase === 'committed') {
    let foundIdx = -1;
    for (let i = nextHistory.length - 1; i >= 0; i--) {
      if (!nextHistory[i].cancelled && nextHistory[i].questionIndex === state.currentDeckIndex) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx >= 0) {
      nextHistory[foundIdx] = {
        ...nextHistory[foundIdx],
        cancelled: true,
        cancelReason: cleanReason,
        outcomes: zeroOutcomes,
      };
      nextValidCompleted = Math.max(0, nextValidCompleted - 1);
    }
  } else {
    nextHistory.push({
      roundNumber: state.validRoundsCompleted + 1,
      questionIndex: state.currentDeckIndex,
      questionId: q.id,
      questionTopic: q.topic,
      questionStemLatex: q.stemLatex,
      answerLatex: q.answerLatex,
      explanationLatex: q.explanationLatex,
      basePoints: D08_BASE_POINTS,
      cancelled: true,
      cancelReason: cleanReason,
      outcomes: zeroOutcomes,
      committedAt: Date.now(),
    });
  }

  // Pull unseen replacement from reserveDeck
  const nextReserve = [...state.reserveDeck];
  const replacement = nextReserve.shift() || null;
  const nextActiveDeck = [...state.activeDeck];

  if (replacement) {
    nextActiveDeck[state.currentDeckIndex] = replacement;
    return {
      replaced: true,
      state: {
        ...state,
        phase: 'pre_open',
        activeDeck: nextActiveDeck,
        reserveDeck: nextReserve,
        validRoundsCompleted: nextValidCompleted,
        pendingDoubles: createEmptyBoolMap(),
        lockedDoubles: createEmptyBoolMap(),
        draftMarks: createEmptyMarkMap(),
        draftOptionIds: createEmptyOptionMap(),
        answerRevealedInScoring: false,
        timeRemainingSec: state.config.timerSeconds,
        isPaused: false,
        lastCommittedRoundId: null,
        editingLastCommitted: false,
        history: nextHistory,
        statusMessage:
          'Đã hủy câu lỗi, hoàn lại quyền Nhân đôi (nếu đã dùng) và nạp câu thay thế mới.',
      },
    };
  }

  // No replacement left: remove faulty slot cleanly without repeating any question
  nextActiveDeck.splice(state.currentDeckIndex, 1);
  const finishedNow = state.currentDeckIndex >= nextActiveDeck.length;

  return {
    replaced: false,
    state: {
      ...state,
      phase: finishedNow ? 'finished' : 'pre_open',
      activeDeck: nextActiveDeck,
      reserveDeck: nextReserve,
      validRoundsCompleted: nextValidCompleted,
      pendingDoubles: createEmptyBoolMap(),
      lockedDoubles: createEmptyBoolMap(),
      draftMarks: createEmptyMarkMap(),
      draftOptionIds: createEmptyOptionMap(),
      answerRevealedInScoring: false,
      timeRemainingSec: state.config.timerSeconds,
      isPaused: false,
      lastCommittedRoundId: null,
      editingLastCommitted: false,
      history: nextHistory,
      statusMessage: finishedNow
        ? 'Đã hủy câu lỗi và hoàn lại quyền Nhân đôi. Hết câu dự phòng — chuyển sang tổng kết.'
        : 'Đã hủy câu lỗi, hoàn lại quyền Nhân đôi và chuyển sang câu kế tiếp.',
    },
  };
}

/**
 * Advance from `committed` to next question (`pre_open`) or final summary (`finished`).
 */
export function advanceToNextQuestion(state: ArenaGameState): ArenaGameState {
  if (state.phase !== 'committed' || state.editingLastCommitted) return state;
  const nextIndex = state.currentDeckIndex + 1;
  if (nextIndex >= state.activeDeck.length) {
    return {
      ...state,
      phase: 'finished',
      endedEarly: false,
      statusMessage: 'Trận đấu đã hoàn thành! Xem bảng xếp hạng và lời giải chi tiết.',
    };
  }

  return {
    ...state,
    phase: 'pre_open',
    currentDeckIndex: nextIndex,
    pendingDoubles: createEmptyBoolMap(),
    lockedDoubles: createEmptyBoolMap(),
    draftMarks: createEmptyMarkMap(),
    draftOptionIds: createEmptyOptionMap(),
    answerRevealedInScoring: false,
    timeRemainingSec: state.config.timerSeconds,
    isPaused: false,
    editingLastCommitted: false,
    statusMessage: `Chuẩn bị Câu ${state.validRoundsCompleted + 1}: thông báo chủ đề và chốt Quyền Nhân đôi trước khi mở đề.`,
  };
}

export function endArenaMatchEarly(state: ArenaGameState): ArenaGameState {
  if (state.phase === 'setup' || state.phase === 'finished') return state;
  return {
    ...state,
    phase: 'finished',
    endedEarly: true,
    isPaused: false,
    editingLastCommitted: false,
    statusMessage: `Kết thúc sớm sau ${state.validRoundsCompleted} câu đã chấm.`,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// (Restores exact question deck, order, history, scores & consumed Doubles without double-counting)
// ============================================================================

export interface ArenaPersistedSession {
  version: number;
  savedAt: number;
  state: ArenaGameState;
}

export function getD08StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D08_SESSION_STORAGE_KEY}`
    : D08_SESSION_STORAGE_KEY;
}

export function saveD08Session(state: ArenaGameState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ArenaPersistedSession = {
      version: D08_SESSION_VERSION,
      savedAt: Date.now(),
      state,
    };
    window.localStorage.setItem(getD08StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function loadD08Session(): ArenaPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getD08StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ArenaPersistedSession>;
    if (
      !parsed ||
      parsed.version !== D08_SESSION_VERSION ||
      !parsed.state ||
      !parsed.state.config ||
      !Array.isArray(parsed.state.activeDeck) ||
      !Array.isArray(parsed.state.history)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Revalidate validRoundsCompleted strictly from non-cancelled history records
    const validCompleted = parsed.state.history.filter((h) => h && !h.cancelled).length;
    const restored: ArenaGameState = {
      ...parsed.state,
      validRoundsCompleted: validCompleted,
      editingLastCommitted: false,
      isPaused: parsed.state.phase === 'answering' ? true : false, // Pause timer safely on reload mid-question
    };

    return {
      version: D08_SESSION_VERSION,
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

export function clearD08Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD08StorageKey());
  } catch {
    // Ignore
  }
}
