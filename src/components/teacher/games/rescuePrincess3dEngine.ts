import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const C07_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const C07_ZONE_COUNT = 3;
export const C07_CHALLENGES_PER_ZONE = 3;
export const C07_ZONE_POINTS = 10;
export const C07_FINAL_GATE_POINTS = 30;
export const C07_MAX_TOTAL_POINTS = 120; // 3 * 3 * 10 + 30 = 120

export type C07ZoneId = 'zone_fractions' | 'zone_statistics' | 'zone_geometry';
export type C07ParticipationMode = 'solo' | 'class_teams';
export type C07QuestionSource = 'sample_pack' | 'bank';
export type C07GraphicsQuality = 'high' | '2d';

export type C07Phase =
  | 'setup'
  | 'castle_map' // Lâu đài 3 khu + cột chìa khóa + cửa cuối
  | 'zone_challenge' // Đang làm thử thách tại 1 khu (có thể giữ đáp án ở trạng thái Đã nộp)
  | 'zone_revealed' // Đã chốt & công bố kết quả + lời giải tại khu
  | 'final_gate_locked' // Mở cửa cuối khi còn thiếu chìa -> hiện rõ số chìa thiếu
  | 'final_gate_challenge' // Câu tổng hợp 30đ ở Cửa cuối
  | 'final_gate_revealed' // Công bố kết quả Cửa cuối + Công chúa bạn đồng hành xuất hiện
  | 'summary'; // Tổng kết hành trình giải cứu & xem lại phần tự làm / có hỗ trợ / lời giải

export type C07ZoneStatus = 'unexplored' | 'in_progress' | 'key_awarded';
export type C07OutcomeStatus =
  | 'unattempted'
  | 'submitted' // Đã nộp (chờ giáo viên bấm Chốt & Công bố ở chế độ trình chiếu / bảng con)
  | 'correct_independent' // Đúng tự làm
  | 'correct_with_hint' // Đúng có hỗ trợ (đã dùng gợi ý)
  | 'wrong' // Sai (0đ)
  | 'wrong_viewed_solution' // Sai + đã xem lời giải (0đ)
  | 'skipped' // Bỏ qua (0đ)
  | 'skipped_viewed_solution'; // Bỏ qua + đã xem lời giải (0đ)

export interface C07OptionItem {
  optionId: string;
  labelKey: string;
  text: string;
}

export interface C07QuestionItem {
  questionId: string;
  sourceTag: 'Dữ liệu mẫu' | 'Ngân hàng Smart EDU';
  topicLabel: string;
  stem: string;
  image?: string;
  visualDiagram?: 'rect_4x6';
  options: C07OptionItem[];
  correctOptionId: string;
  hintText: string;
  explanationText: string;
}

export interface C07TeamSubmission {
  teamId: string;
  teamName: string;
  selectedOptionId: string | null;
  teacherConfirmCorrect: boolean | null;
}

export interface C07ChallengeProgress {
  question: C07QuestionItem;
  status: C07OutcomeStatus;
  selectedOptionId: string | null;
  usedHint: boolean;
  viewedSolution: boolean;
  pointsAwarded: number;
  teamSubmissions: Record<string, C07TeamSubmission>;
}

export interface C07ZoneState {
  zoneId: C07ZoneId;
  orderIndex: number; // 0..2
  title: string;
  subtitle: string;
  keyName: string;
  accentHex: string;
  status: C07ZoneStatus;
  activeChallengeIndex: 0 | 1 | 2;
  challenges: [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress];
  keyAwarded: boolean;
  keyNewlyAwarded: boolean;
}

export interface C07TeamItem {
  id: string;
  name: string;
  color: string;
  score: number;
  independentCount: number;
  assistedCount: number;
  studentNames: string[];
}

export interface C07SetupConfig {
  participationMode: C07ParticipationMode;
  questionSource: C07QuestionSource;
  topicFocus: C07ZoneId | 'all';
  shuffleOptions: boolean;
  whiteboardHoldMode: boolean; // Cho các nhóm giải trên bảng con -> giữ đáp án Đã nộp đến lúc chốt
  teamCount: number; // 2..6
  teamNames: string[];
  classStudents: Array<{ id: string; fullName: string }>;
  selectedClassId: string;
}

export interface C07GameState {
  phase: C07Phase;
  config: C07SetupConfig;
  zones: [C07ZoneState, C07ZoneState, C07ZoneState];
  activeZoneId: C07ZoneId | null;
  finalGate: C07ChallengeProgress;
  finalGateOpened: boolean;
  princessRescued: boolean; // true sau khi hoàn thành cửa cuối -> công chúa xuất hiện làm bạn đồng hành
  teams: C07TeamItem[];
  activeTeamIndex: number;
  activeCallerStudent: { id: string; fullName: string } | null;
  calledStudentIds: string[];
  score: number;
  maxScore: number;
  turnToken: string;
  isProcessing: boolean;
  revealAnimDone: boolean;
  activeHintRevealed: boolean;
  lastKeySoundZoneId: string | null;
  lastActionNotice: string;
}

export interface C07SummaryStats {
  totalChallenges: number; // 9 + 1 = 10
  independentCorrectCount: number;
  assistedCorrectCount: number;
  viewedSolutionCount: number;
  wrongCount: number;
  skippedCount: number;
  unattemptedCount: number;
  keysCollected: number;
  keysMissing: number;
  zoneScore: number;
  finalGateScore: number;
  totalScore: number;
  maxScore: number;
}

const TEAM_PALETTE = ['#2563EB', '#EA580C', '#059669', '#D97706', '#7C3AED', '#DB2777'];
const DEFAULT_TEAM_NAMES = ['Đội Hoàng Kim', 'Đội Lam Ngọc', 'Đội Phượng Hoàng', 'Đội Pha Lê', 'Đội Hộ Vệ', 'Đội Tinh Tú'];
const DISPLAY_KEYS = ['A', 'B', 'C', 'D'] as const;

export const C07_SESSION_BASE_KEY = 'taydo_c07_rescue_princess_3d_session_v1';

export function getC07SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${C07_SESSION_BASE_KEY}`
    : C07_SESSION_BASE_KEY;
}

interface ZoneTemplateMeta {
  zoneId: C07ZoneId;
  orderIndex: 0 | 1 | 2;
  title: string;
  subtitle: string;
  keyName: string;
  accentHex: string;
  sampleQuestions: [C07QuestionItem, C07QuestionItem, C07QuestionItem];
}

export const C07_ZONE_TEMPLATES: [ZoneTemplateMeta, ZoneTemplateMeta, ZoneTemplateMeta] = [
  {
    zoneId: 'zone_fractions',
    orderIndex: 0,
    title: 'Khu 1 · Cổng Phân Số',
    subtitle: 'Phân số, Số âm & Lũy thừa',
    keyName: 'Chìa Khóa Vàng I',
    accentHex: '#F59E0B',
    sampleQuestions: [
      {
        questionId: 'c07_frac_1',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Phân số — Cộng hai phân số khác mẫu',
        stem: 'Tính giá trị của biểu thức: \\(\\dfrac{2}{3} + \\dfrac{1}{6}\\).',
        options: [
          { optionId: 'c07_frac_1_a', labelKey: 'A', text: '\\(\\dfrac{5}{6}\\)' },
          { optionId: 'c07_frac_1_b', labelKey: 'B', text: '\\(\\dfrac{3}{9}\\)' },
          { optionId: 'c07_frac_1_c', labelKey: 'C', text: '\\(\\dfrac{1}{2}\\)' },
          { optionId: 'c07_frac_1_d', labelKey: 'D', text: '\\(\\dfrac{4}{6}\\)' },
        ],
        correctOptionId: 'c07_frac_1_a',
        hintText: 'Quy đồng phân số \\(\\dfrac{2}{3}\\) về mẫu số chung \\(6\\).',
        explanationText: 'Ta có \\(\\dfrac{2}{3} = \\dfrac{4}{6}\\), suy ra \\(\\dfrac{4}{6} + \\dfrac{1}{6} = \\dfrac{5}{6}\\). Phản ví dụ sai thường gặp là cộng thẳng tử với tử, mẫu với mẫu thành \\(\\dfrac{3}{9}\\) (sai).',
      },
      {
        questionId: 'c07_frac_2',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Số âm & Phân số',
        stem: 'Tính tích: \\(\\left(-\\dfrac{3}{4}\\right) \\cdot \\dfrac{8}{9}\\).',
        options: [
          { optionId: 'c07_frac_2_a', labelKey: 'A', text: '\\(-\\dfrac{2}{3}\\)' },
          { optionId: 'c07_frac_2_b', labelKey: 'B', text: '\\(\\dfrac{2}{3}\\)' },
          { optionId: 'c07_frac_2_c', labelKey: 'C', text: '\\(-\\dfrac{24}{13}\\)' },
          { optionId: 'c07_frac_2_d', labelKey: 'D', text: '\\(-\\dfrac{3}{2}\\)' },
        ],
        correctOptionId: 'c07_frac_2_a',
        hintText: 'Tích của số âm và số dương là số âm; rút gọn chéo \\(8\\) với \\(4\\) và \\(3\\) với \\(9\\).',
        explanationText: 'Ta có \\(\\left(-\\dfrac{3}{4}\\right) \\cdot \\dfrac{8}{9} = -\\dfrac{24}{36} = -\\dfrac{2}{3}\\).',
      },
      {
        questionId: 'c07_frac_3',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Căn thức & Lũy thừa phân số',
        stem: 'Tính giá trị: \\(\\sqrt{25} + \\left(\\dfrac{1}{2}\\right)^2\\).',
        options: [
          { optionId: 'c07_frac_3_a', labelKey: 'A', text: '\\(\\dfrac{21}{4}\\)' },
          { optionId: 'c07_frac_3_b', labelKey: 'B', text: '\\(\\dfrac{11}{2}\\)' },
          { optionId: 'c07_frac_3_c', labelKey: 'C', text: '\\(\\dfrac{26}{4}\\)' },
          { optionId: 'c07_frac_3_d', labelKey: 'D', text: '\\(5{,}5\\)' },
        ],
        correctOptionId: 'c07_frac_3_a',
        hintText: 'Tính \\(\\sqrt{25} = 5\\) và \\(\\left(\\dfrac{1}{2}\\right)^2 = \\dfrac{1}{4}\\) rồi cộng lại.',
        explanationText: 'Ta có \\(\\sqrt{25} = 5 = \\dfrac{20}{4}\\) và \\(\\left(\\dfrac{1}{2}\\right)^2 = \\dfrac{1}{4}\\), suy ra \\(\\dfrac{20}{4} + \\dfrac{1}{4} = \\dfrac{21}{4}\\).',
      },
    ],
  },
  {
    zoneId: 'zone_statistics',
    orderIndex: 1,
    title: 'Khu 2 · Tháp Thống Kê',
    subtitle: 'Số trung bình, Mốt & Xác suất',
    keyName: 'Chìa Khóa Ngọc II',
    accentHex: '#38BDF8',
    sampleQuestions: [
      {
        questionId: 'c07_stat_1',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Thống kê — Số trung bình cộng',
        stem: 'Điểm kiểm tra của một nhóm gồm \\(5\\) bạn lần lượt là \\(7; 8; 9; 8; 8\\). Số trung bình cộng của nhóm đó là:',
        options: [
          { optionId: 'c07_stat_1_a', labelKey: 'A', text: '\\(8\\)' },
          { optionId: 'c07_stat_1_b', labelKey: 'B', text: '\\(7{,}5\\)' },
          { optionId: 'c07_stat_1_c', labelKey: 'C', text: '\\(8{,}5\\)' },
          { optionId: 'c07_stat_1_d', labelKey: 'D', text: '\\(40\\)' },
        ],
        correctOptionId: 'c07_stat_1_a',
        hintText: 'Lấy tổng của \\(5\\) giá trị rồi chia cho \\(5\\).',
        explanationText: 'Tổng điểm là \\(7 + 8 + 9 + 8 + 8 = 40\\). Số trung bình cộng là \\(\\overline{x} = \\dfrac{40}{5} = 8\\).',
      },
      {
        questionId: 'c07_stat_2',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Thống kê — Mốt của bảng tần số',
        stem: 'Bảng ghi số quyển sách đọc trong tháng của một tổ cho dãy số liệu: \\(2; 3; 4; 3; 5; 3; 2\\). Mốt của mẫu số liệu là:',
        options: [
          { optionId: 'c07_stat_2_a', labelKey: 'A', text: '\\(3\\)' },
          { optionId: 'c07_stat_2_b', labelKey: 'B', text: '\\(2\\)' },
          { optionId: 'c07_stat_2_c', labelKey: 'C', text: '\\(5\\)' },
          { optionId: 'c07_stat_2_d', labelKey: 'D', text: '\\(4\\)' },
        ],
        correctOptionId: 'c07_stat_2_a',
        hintText: 'Mốt là giá trị xuất hiện với tần số lớn nhất trong dãy.',
        explanationText: 'Giá trị \\(3\\) xuất hiện \\(3\\) lần (nhiều hơn \\(2\\) xuất hiện \\(2\\) lần, \\(4\\) và \\(5\\) mỗi số \\(1\\) lần), nên Mốt bằng \\(3\\).',
      },
      {
        questionId: 'c07_stat_3',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Xác suất thực nghiệm',
        stem: 'Trong hộp có \\(3\\) viên bi xanh và \\(5\\) viên bi đỏ có kích thước như nhau. Lấy ngẫu nhiên \\(1\\) viên bi, xác suất lấy được viên bi xanh là:',
        options: [
          { optionId: 'c07_stat_3_a', labelKey: 'A', text: '\\(\\dfrac{3}{8}\\)' },
          { optionId: 'c07_stat_3_b', labelKey: 'B', text: '\\(\\dfrac{3}{5}\\)' },
          { optionId: 'c07_stat_3_c', labelKey: 'C', text: '\\(\\dfrac{5}{8}\\)' },
          { optionId: 'c07_stat_3_d', labelKey: 'D', text: '\\(\\dfrac{1}{3}\\)' },
        ],
        correctOptionId: 'c07_stat_3_a',
        hintText: 'Tổng số viên bi trong hộp là \\(3 + 5 = 8\\) viên.',
        explanationText: 'Có \\(3\\) kết quả thuận lợi trên tổng số \\(3 + 5 = 8\\) khả năng đồng khả năng, nên xác suất là \\(\\dfrac{3}{8}\\).',
      },
    ],
  },
  {
    zoneId: 'zone_geometry',
    orderIndex: 2,
    title: 'Khu 3 · Cầu Hình Học',
    subtitle: 'Diện tích & Góc trong hình học',
    keyName: 'Chìa Khóa Pha Lê III',
    accentHex: '#10B981',
    sampleQuestions: [
      {
        questionId: 'c07_geo_rect',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Hình học — Diện tích hình chữ nhật',
        stem: 'Hình chữ nhật cạnh \\(4\\) và \\(6\\) có diện tích bao nhiêu?',
        visualDiagram: 'rect_4x6',
        options: [
          { optionId: 'c07_geo_rect_a', labelKey: 'A', text: '\\(24\\) đơn vị vuông' },
          { optionId: 'c07_geo_rect_b', labelKey: 'B', text: '\\(20\\) đơn vị vuông' },
          { optionId: 'c07_geo_rect_c', labelKey: 'C', text: '\\(10\\) đơn vị vuông' },
          { optionId: 'c07_geo_rect_d', labelKey: 'D', text: '\\(12\\) đơn vị vuông' },
        ],
        correctOptionId: 'c07_geo_rect_a',
        hintText: 'Diện tích hình chữ nhật bằng tích của hai kích thước (chiều rộng nhân chiều dài).',
        explanationText:
          'Áp dụng công thức diện tích hình chữ nhật: \\(4 \\times 6 = 24\\) đơn vị vuông. Nhìn trên hình minh họa: cạnh đứng gồm \\(4\\) hàng, cạnh ngang gồm \\(6\\) cột, ghép thành \\(4 \\times 6 = 24\\) ô vuông đơn vị.',
      },
      {
        questionId: 'c07_geo_angle',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Hình học — Tổng ba góc tam giác',
        stem: 'Tam giác \\(ABC\\) có \\(\\widehat{A} = 50^\\circ\\) và \\(\\widehat{B} = 70^\\circ\\). Số đo góc \\(\\widehat{C}\\) bằng bao nhiêu?',
        options: [
          { optionId: 'c07_geo_angle_a', labelKey: 'A', text: '\\(60^\\circ\\)' },
          { optionId: 'c07_geo_angle_b', labelKey: 'B', text: '\\(120^\\circ\\)' },
          { optionId: 'c07_geo_angle_c', labelKey: 'C', text: '\\(40^\\circ\\)' },
          { optionId: 'c07_geo_angle_d', labelKey: 'D', text: '\\(80^\\circ\\)' },
        ],
        correctOptionId: 'c07_geo_angle_a',
        hintText: 'Tổng ba góc trong một tam giác luôn bằng \\(180^\\circ\\).',
        explanationText: 'Ta có \\(\\widehat{C} = 180^\\circ - (50^\\circ + 70^\\circ) = 180^\\circ - 120^\\circ = 60^\\circ\\).',
      },
      {
        questionId: 'c07_geo_sq',
        sourceTag: C07_SAMPLE_BADGE,
        topicLabel: 'Hình học — Chu vi hình vuông từ diện tích',
        stem: 'Một mảnh sân hình vuông có diện tích bằng \\(49\\text{ m}^2\\). Độ dài một cạnh của mảnh sân là:',
        options: [
          { optionId: 'c07_geo_sq_a', labelKey: 'A', text: '\\(7\\text{ m}\\)' },
          { optionId: 'c07_geo_sq_b', labelKey: 'B', text: '\\(12{,}25\\text{ m}\\)' },
          { optionId: 'c07_geo_sq_c', labelKey: 'C', text: '\\(24{,}5\\text{ m}\\)' },
          { optionId: 'c07_geo_sq_d', labelKey: 'D', text: '\\(14\\text{ m}\\)' },
        ],
        correctOptionId: 'c07_geo_sq_a',
        hintText: 'Vì diện tích hình vuông cạnh \\(a\\) là \\(a^2 = 49\\), nên \\(a = \\sqrt{49}\\).',
        explanationText: 'Độ dài cạnh hình vuông là \\(a = \\sqrt{49} = 7\\text{ m}\\) (vì \\(7^2 = 49\\) và độ dài cạnh dương).',
      },
    ],
  },
];

export const C07_SAMPLE_FINAL_GATE_QUESTION: C07QuestionItem = {
  questionId: 'c07_final_gate_synthesis',
  sourceTag: C07_SAMPLE_BADGE,
  topicLabel: 'Cửa Cuối Hoàng Gia — Câu Tổng Hợp (30 điểm)',
  stem: 'Khu vườn trước lâu đài hình chữ nhật có hai cạnh dài \\(4\\text{ m}\\) và \\(6\\text{ m}\\). Người ta dùng \\(\\dfrac{3}{4}\\) diện tích khu vườn để trồng hoa. Diện tích phần đất trồng hoa bằng bao nhiêu?',
  visualDiagram: 'rect_4x6',
  options: [
    { optionId: 'c07_fg_opt_a', labelKey: 'A', text: '\\(18\\text{ m}^2\\)' },
    { optionId: 'c07_fg_opt_b', labelKey: 'B', text: '\\(24\\text{ m}^2\\)' },
    { optionId: 'c07_fg_opt_c', labelKey: 'C', text: '\\(15\\text{ m}^2\\)' },
    { optionId: 'c07_fg_opt_d', labelKey: 'D', text: '\\(6\\text{ m}^2\\)' },
  ],
  correctOptionId: 'c07_fg_opt_a',
  hintText: 'Bước 1: Tính diện tích hình chữ nhật \\(4 \\times 6\\). Bước 2: Nhân diện tích vừa tìm được với \\(\\dfrac{3}{4}\\).',
  explanationText:
    'Bước 1: Diện tích cả khu vườn là \\(4 \\times 6 = 24\\text{ m}^2\\). Bước 2: Diện tích phần trồng hoa là \\(24 \\cdot \\dfrac{3}{4} = \\dfrac{72}{4} = 18\\text{ m}^2\\).',
};

// ---------------------------------------------------------------------------
// DETERMINISTIC OPTION SHUFFLE (locks strictly by stable optionId)
// ---------------------------------------------------------------------------
export function hashC07Seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleC07Options(q: C07QuestionItem, seedInput: string): C07QuestionItem {
  if (q.options.length <= 1) return q;
  const cloned = q.options.map((opt) => ({ ...opt }));
  let seed = hashC07Seed(`${q.questionId}:${seedInput}`) || 2027;
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

// ---------------------------------------------------------------------------
// RBAC SMART EDU BANK ADAPTER
// ---------------------------------------------------------------------------
export function adaptBankQuestionsForC07(
  bankQuestions: Question[],
  userRole: UserRole
): C07QuestionItem[] {
  const allowed = bankQuestions.filter((q) => {
    if (userRole === 'student' && q.status !== 'approved') return false;
    return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
  });

  const out: C07QuestionItem[] = [];
  for (const q of allowed) {
    const rawOpts = (q.options || []).slice(0, 4);
    const targetAnswer = String(q.correctAnswer || '').trim();
    const correctIdx = rawOpts.findIndex(
      (opt) => opt.id === targetAnswer || opt.label === targetAnswer
    );
    if (correctIdx < 0) continue;

    const mappedOpts: C07OptionItem[] = rawOpts.map((opt, idx) => ({
      optionId: opt.id ? `bank_${q.id}_${opt.id}` : `bank_${q.id}_opt_${idx}`,
      labelKey: DISPLAY_KEYS[idx] || String(idx + 1),
      text: String(opt.text || '').trim() || `Phương án ${DISPLAY_KEYS[idx] || idx + 1}`,
    }));

    out.push({
      questionId: `bank_${q.id}`,
      sourceTag: 'Ngân hàng Smart EDU',
      topicLabel: q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi',
      stem: String(q.stem || '').trim(),
      image: q.image,
      options: mappedOpts,
      correctOptionId: mappedOpts[correctIdx].optionId,
      hintText: q.lesson
        ? `Gợi ý ôn tập: xem lại kiến thức "${q.lesson}".`
        : 'Kiểm tra kỹ dữ kiện và đơn vị tính của đề bài.',
      explanationText:
        String(q.explanation || '').trim() ||
        `Đáp án đúng là ${mappedOpts[correctIdx].labelKey}: ${mappedOpts[correctIdx].text}.`,
    });
  }
  return out;
}

export function buildC07Teams(
  participationMode: C07ParticipationMode,
  teamCount: number,
  teamNames: string[] = [],
  classStudents: Array<{ id: string; fullName: string }> = []
): C07TeamItem[] {
  if (participationMode === 'solo') {
    return [
      {
        id: 'team_solo',
        name: classStudents.length === 1 ? classStudents[0].fullName : 'Hiệp sĩ Giải cứu',
        color: '#2563EB',
        score: 0,
        independentCount: 0,
        assistedCount: 0,
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
    score: 0,
    independentCount: 0,
    assistedCount: 0,
    studentNames: buckets[idx],
  }));
}

export function createDefaultC07SetupConfig(
  overrides: Partial<C07SetupConfig> = {}
): C07SetupConfig {
  return {
    participationMode: 'solo',
    questionSource: 'sample_pack',
    topicFocus: 'all',
    shuffleOptions: true,
    whiteboardHoldMode: false,
    teamCount: 2,
    teamNames: DEFAULT_TEAM_NAMES.slice(0, 6),
    classStudents: [],
    selectedClassId: '',
    ...overrides,
  };
}

function makeChallengeProgress(q: C07QuestionItem): C07ChallengeProgress {
  return {
    question: q,
    status: 'unattempted',
    selectedOptionId: null,
    usedHint: false,
    viewedSolution: false,
    pointsAwarded: 0,
    teamSubmissions: {},
  };
}

export function createC07SetupState(
  configOverrides: Partial<C07SetupConfig> = {}
): C07GameState {
  const config = createDefaultC07SetupConfig(configOverrides);
  const zones = C07_ZONE_TEMPLATES.map((tpl) => ({
    zoneId: tpl.zoneId,
    orderIndex: tpl.orderIndex,
    title: tpl.title,
    subtitle: tpl.subtitle,
    keyName: tpl.keyName,
    accentHex: tpl.accentHex,
    status: 'unexplored' as C07ZoneStatus,
    activeChallengeIndex: 0 as const,
    challenges: [
      makeChallengeProgress(tpl.sampleQuestions[0]),
      makeChallengeProgress(tpl.sampleQuestions[1]),
      makeChallengeProgress(tpl.sampleQuestions[2]),
    ] as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress],
    keyAwarded: false,
    keyNewlyAwarded: false,
  })) as [C07ZoneState, C07ZoneState, C07ZoneState];

  return {
    phase: 'setup',
    config,
    zones,
    activeZoneId: null,
    finalGate: makeChallengeProgress(C07_SAMPLE_FINAL_GATE_QUESTION),
    finalGateOpened: false,
    princessRescued: false,
    teams: buildC07Teams(
      config.participationMode,
      config.teamCount,
      config.teamNames,
      config.classStudents
    ),
    activeTeamIndex: 0,
    activeCallerStudent: null,
    calledStudentIds: [],
    score: 0,
    maxScore: C07_MAX_TOTAL_POINTS,
    turnToken: 'c07_setup',
    isProcessing: false,
    revealAnimDone: false,
    activeHintRevealed: false,
    lastKeySoundZoneId: null,
    lastActionNotice: 'Sẵn sàng tiến vào Lâu đài Giải cứu Công chúa 3D.',
  };
}

export function startC07Rescue(params: {
  config: C07SetupConfig;
  bankQuestions?: Question[];
  userRole?: UserRole;
  nowMs?: number;
  shuffleSeed?: string;
}): { ok: boolean; error?: string; state?: C07GameState } {
  const nowMs = params.nowMs ?? Date.now();
  const seed = params.shuffleSeed ?? String(nowMs);

  let bankPool: C07QuestionItem[] = [];
  if (params.config.questionSource === 'bank') {
    bankPool = adaptBankQuestionsForC07(
      params.bankQuestions || [],
      params.userRole || 'teacher'
    );
    if (bankPool.length === 0) {
      return {
        ok: false,
        error:
          'Ngân hàng câu hỏi Smart EDU chưa có câu trắc nghiệm 1 đáp án phù hợp. Hãy chọn "Gói Toán mẫu C07 (3 khu + Cửa cuối)" hoặc bổ sung câu hỏi.',
      };
    }
  }

  let bankCursor = 0;
  const pickQuestion = (fallback: C07QuestionItem): C07QuestionItem => {
    const raw =
      params.config.questionSource === 'bank' && bankCursor < bankPool.length
        ? bankPool[bankCursor++]
        : fallback;
    return params.config.shuffleOptions ? shuffleC07Options(raw, seed) : raw;
  };

  const zones = C07_ZONE_TEMPLATES.map((tpl) => ({
    zoneId: tpl.zoneId,
    orderIndex: tpl.orderIndex,
    title: tpl.title,
    subtitle: tpl.subtitle,
    keyName: tpl.keyName,
    accentHex: tpl.accentHex,
    status: 'unexplored' as C07ZoneStatus,
    activeChallengeIndex: 0 as const,
    challenges: [
      makeChallengeProgress(pickQuestion(tpl.sampleQuestions[0])),
      makeChallengeProgress(pickQuestion(tpl.sampleQuestions[1])),
      makeChallengeProgress(pickQuestion(tpl.sampleQuestions[2])),
    ] as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress],
    keyAwarded: false,
    keyNewlyAwarded: false,
  })) as [C07ZoneState, C07ZoneState, C07ZoneState];

  const finalGateQ = pickQuestion(C07_SAMPLE_FINAL_GATE_QUESTION);
  const firstCaller =
    params.config.classStudents.length > 0 ? params.config.classStudents[0] : null;

  return {
    ok: true,
    state: {
      phase: 'castle_map',
      config: { ...params.config },
      zones,
      activeZoneId: null,
      finalGate: makeChallengeProgress(finalGateQ),
      finalGateOpened: false,
      princessRescued: false,
      teams: buildC07Teams(
        params.config.participationMode,
        params.config.teamCount,
        params.config.teamNames,
        params.config.classStudents
      ),
      activeTeamIndex: 0,
      activeCallerStudent: firstCaller,
      calledStudentIds: firstCaller ? [firstCaller.id] : [],
      score: 0,
      maxScore: C07_MAX_TOTAL_POINTS,
      turnToken: `c07_map_${nowMs}`,
      isProcessing: false,
      revealAnimDone: false,
      activeHintRevealed: false,
      lastKeySoundZoneId: null,
      lastActionNotice: 'Chọn một trong 3 khu lâu đài để vượt 3 thử thách và nhận Chìa Khóa.',
    },
  };
}

export function getC07KeysCollectedCount(state: C07GameState): number {
  return state.zones.filter((z) => z.keyAwarded).length;
}

export function getC07ActiveZone(state: C07GameState): C07ZoneState | null {
  if (!state.activeZoneId) return null;
  return state.zones.find((z) => z.zoneId === state.activeZoneId) ?? null;
}

function isResolvedOutcome(status: C07OutcomeStatus): boolean {
  return status !== 'unattempted' && status !== 'submitted';
}

export function enterC07Zone(
  state: C07GameState,
  zoneId: C07ZoneId,
  nowMs = Date.now()
): C07GameState {
  if (state.phase !== 'castle_map' && state.phase !== 'final_gate_locked') return state;
  const target = state.zones.find((z) => z.zoneId === zoneId);
  if (!target) return state;

  let resumeIdx: 0 | 1 | 2 = target.activeChallengeIndex;
  if (!target.keyAwarded) {
    const firstOpen = target.challenges.findIndex((c) => !isResolvedOutcome(c.status));
    if (firstOpen === 0 || firstOpen === 1 || firstOpen === 2) {
      resumeIdx = firstOpen;
    }
  } else {
    resumeIdx = 2;
  }

  const zones = state.zones.map((z) => {
    if (z.zoneId !== zoneId) return { ...z, keyNewlyAwarded: false };
    return {
      ...z,
      status: (z.keyAwarded ? 'key_awarded' : 'in_progress') as C07ZoneStatus,
      activeChallengeIndex: resumeIdx,
      keyNewlyAwarded: false,
    };
  }) as [C07ZoneState, C07ZoneState, C07ZoneState];

  const activeChallenge = zones.find((z) => z.zoneId === zoneId)!.challenges[resumeIdx];
  const resolved = isResolvedOutcome(activeChallenge.status);

  return {
    ...state,
    phase: resolved ? 'zone_revealed' : 'zone_challenge',
    zones,
    activeZoneId: zoneId,
    turnToken: `c07_z_${zoneId}_c${resumeIdx}_${nowMs}`,
    isProcessing: false,
    revealAnimDone: resolved,
    activeHintRevealed: activeChallenge.usedHint,
    lastActionNotice: resolved
      ? `Xem lại ${target.title} · Thử thách ${resumeIdx + 1}/3.`
      : `Mở ${target.title} · Thử thách ${resumeIdx + 1}/3 (Tiêu chí lấy ${target.keyName}: hoàn thành 3 thử thách).`,
  };
}

export function returnToC07CastleMap(
  state: C07GameState,
  nowMs = Date.now()
): C07GameState {
  if (
    state.phase !== 'zone_challenge' &&
    state.phase !== 'zone_revealed' &&
    state.phase !== 'final_gate_locked'
  ) {
    return state;
  }

  const zones = state.zones.map((z) => {
    const anyDone = z.challenges.some((c) => c.status !== 'unattempted');
    const nextStatus: C07ZoneStatus = z.keyAwarded
      ? 'key_awarded'
      : anyDone
        ? 'in_progress'
        : 'unexplored';
    return {
      ...z,
      status: nextStatus,
      keyNewlyAwarded: false,
    };
  }) as [C07ZoneState, C07ZoneState, C07ZoneState];

  return {
    ...state,
    phase: 'castle_map',
    zones,
    activeZoneId: null,
    turnToken: `c07_map_${nowMs}`,
    isProcessing: false,
    activeHintRevealed: false,
    lastActionNotice: 'Đã quay lại sân Lâu đài Giải cứu 3D.',
  };
}

export function revealC07Hint(state: C07GameState): C07GameState {
  if (state.phase === 'zone_challenge' && state.activeZoneId) {
    const zones = state.zones.map((z) => {
      if (z.zoneId !== state.activeZoneId) return z;
      const idx = z.activeChallengeIndex;
      const nextChallenges = z.challenges.map((ch, cIdx) =>
        cIdx === idx ? { ...ch, usedHint: true } : ch
      ) as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress];
      return { ...z, challenges: nextChallenges };
    }) as [C07ZoneState, C07ZoneState, C07ZoneState];

    return {
      ...state,
      zones,
      activeHintRevealed: true,
      lastActionNotice: 'Đã mở gợi ý hỗ trợ (câu này sẽ ghi nhận thuộc nhóm Đúng có hỗ trợ nếu trả lời đúng).',
    };
  }

  if (state.phase === 'final_gate_challenge') {
    return {
      ...state,
      finalGate: { ...state.finalGate, usedHint: true },
      activeHintRevealed: true,
      lastActionNotice: 'Đã mở gợi ý cho Câu tổng hợp Cửa cuối.',
    };
  }

  return state;
}

export function pickNextC07Student(state: C07GameState): C07GameState {
  const pool = state.config.classStudents;
  if (pool.length === 0) return state;
  const uncalled = pool.filter((s) => !state.calledStudentIds.includes(s.id));
  const nextPool = uncalled.length > 0 ? uncalled : pool;
  const seed = hashC07Seed(`${state.turnToken}:${state.calledStudentIds.length}`);
  const picked = nextPool[seed % nextPool.length];
  return {
    ...state,
    activeCallerStudent: picked,
    calledStudentIds: uncalled.length > 0 ? [...state.calledStudentIds, picked.id] : [picked.id],
  };
}

/**
 * Hold team mini-whiteboard submission on projector ('Đã nộp') BEFORE teacher clicks 'Chốt & Công bố'.
 */
export function submitC07TeamWhiteboard(params: {
  state: C07GameState;
  teamId: string;
  optionId?: string | null;
  teacherConfirmCorrect?: boolean | null;
}): C07GameState {
  const { state, teamId } = params;
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return state;

  const entry: C07TeamSubmission = {
    teamId,
    teamName: team.name,
    selectedOptionId: params.optionId ?? null,
    teacherConfirmCorrect: params.teacherConfirmCorrect ?? null,
  };

  if (state.phase === 'zone_challenge' && state.activeZoneId) {
    const zones = state.zones.map((z) => {
      if (z.zoneId !== state.activeZoneId) return z;
      const idx = z.activeChallengeIndex;
      const nextChallenges = z.challenges.map((ch, cIdx) => {
        if (cIdx !== idx || isResolvedOutcome(ch.status)) return ch;
        return {
          ...ch,
          status: 'submitted' as C07OutcomeStatus,
          teamSubmissions: { ...ch.teamSubmissions, [teamId]: entry },
        };
      }) as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress];
      return { ...z, challenges: nextChallenges };
    }) as [C07ZoneState, C07ZoneState, C07ZoneState];

    return {
      ...state,
      zones,
      lastActionNotice: `Đã ghi nhận đáp án bảng con của ${team.name} (Trạng thái: Đã nộp, chờ chốt).`,
    };
  }

  if (state.phase === 'final_gate_challenge' && !isResolvedOutcome(state.finalGate.status)) {
    return {
      ...state,
      finalGate: {
        ...state.finalGate,
        status: 'submitted',
        teamSubmissions: { ...state.finalGate.teamSubmissions, [teamId]: entry },
      },
      lastActionNotice: `Đã ghi nhận đáp án Cửa cuối của ${team.name} (Trạng thái: Đã nộp, chờ chốt).`,
    };
  }

  return state;
}

function checkZoneKeyReady(z: C07ZoneState): boolean {
  return z.challenges.every((c) => {
    if (!isResolvedOutcome(c.status)) return false;
    if (c.status === 'wrong' || c.status === 'skipped') {
      return c.viewedSolution;
    }
    return true;
  });
}

function recomputeTotalAdventureScore(zones: C07ZoneState[], finalGate: C07ChallengeProgress): number {
  const zSum = zones.reduce(
    (sum, z) => sum + z.challenges.reduce((s, c) => s + c.pointsAwarded, 0),
    0
  );
  return zSum + finalGate.pointsAwarded;
}

/**
 * Commit & Reveal a Zone Challenge (idempotent by turnToken + resolved guard).
 * Works for direct optionId click, teacher oral confirm, skip, OR locking held whiteboard submissions!
 */
export function submitC07ZoneChallenge(params: {
  state: C07GameState;
  turnToken: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
  commitHeldWhiteboard?: boolean;
}): C07GameState {
  const { state, turnToken } = params;
  if (state.phase !== 'zone_challenge' || state.isProcessing) return state;
  if (turnToken !== state.turnToken || !state.activeZoneId) return state;

  const zIdx = state.zones.findIndex((z) => z.zoneId === state.activeZoneId);
  if (zIdx < 0) return state;
  const zone = state.zones[zIdx];
  const cIdx = zone.activeChallengeIndex;
  const ch = zone.challenges[cIdx];
  if (isResolvedOutcome(ch.status)) return state;

  let isCorrect = false;
  let newStatus: C07OutcomeStatus = 'wrong';
  let selectedOptId: string | null = ch.selectedOptionId;
  const activeTeam = state.teams[state.activeTeamIndex];

  // Reconcile team whiteboard holds if commitHeldWhiteboard is true
  const teamResults = new Map<string, boolean>();
  if (params.commitHeldWhiteboard) {
    Object.values(ch.teamSubmissions).forEach((sub) => {
      const ok =
        typeof sub.teacherConfirmCorrect === 'boolean'
          ? sub.teacherConfirmCorrect
          : sub.selectedOptionId === ch.question.correctOptionId;
      teamResults.set(sub.teamId, ok);
    });
    const anyTeamOk = Array.from(teamResults.values()).some(Boolean);
    isCorrect = anyTeamOk;
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    if (activeTeam && ch.teamSubmissions[activeTeam.id]) {
      selectedOptId = ch.teamSubmissions[activeTeam.id].selectedOptionId;
    }
  } else if (params.skip) {
    newStatus = 'skipped';
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    selectedOptId = isCorrect ? ch.question.correctOptionId : null;
    if (activeTeam) teamResults.set(activeTeam.id, isCorrect);
  } else if (params.optionId) {
    const opt = ch.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    selectedOptId = opt.optionId;
    isCorrect = opt.optionId === ch.question.correctOptionId;
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    if (activeTeam) teamResults.set(activeTeam.id, isCorrect);
  } else {
    return state;
  }

  const pts = isCorrect ? C07_ZONE_POINTS : 0;
  const updatedCh: C07ChallengeProgress = {
    ...ch,
    status: newStatus,
    selectedOptionId: selectedOptId,
    pointsAwarded: pts,
  };

  const nextChallenges = zone.challenges.map((c, idx) =>
    idx === cIdx ? updatedCh : c
  ) as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress];

  const preliminaryZone: C07ZoneState = {
    ...zone,
    challenges: nextChallenges,
  };
  const readyForKey = checkZoneKeyReady(preliminaryZone);
  const keyNow = !zone.keyAwarded && readyForKey;
  const keyAwarded = zone.keyAwarded || keyNow;

  const updatedZone: C07ZoneState = {
    ...preliminaryZone,
    keyAwarded,
    keyNewlyAwarded: keyNow,
    status: keyAwarded ? 'key_awarded' : 'in_progress',
  };

  const zones = state.zones.map((z, idx) =>
    idx === zIdx ? updatedZone : { ...z, keyNewlyAwarded: false }
  ) as [C07ZoneState, C07ZoneState, C07ZoneState];

  const teams = state.teams.map((t) => {
    const teamOk = teamResults.get(t.id);
    if (!teamOk) return t;
    return {
      ...t,
      score: t.score + pts,
      independentCount: t.independentCount + (ch.usedHint ? 0 : 1),
      assistedCount: t.assistedCount + (ch.usedHint ? 1 : 0),
    };
  });

  const totalScore = recomputeTotalAdventureScore(zones, state.finalGate);

  return {
    ...state,
    phase: 'zone_revealed',
    zones,
    teams,
    score: totalScore,
    revealAnimDone: false,
    lastActionNotice: isCorrect
      ? ch.usedHint
        ? `Chính xác (Có hỗ trợ gợi ý)! +${pts} điểm${keyNow ? ` · Nhận ${zone.keyName}!` : ''}`
        : `Chính xác (Tự làm)! +${pts} điểm${keyNow ? ` · Nhận ${zone.keyName}!` : ''}`
      : newStatus === 'skipped'
        ? 'Đã bỏ qua (0 điểm). Xem lời giải chi tiết để tiếp tục.'
        : 'Chưa chính xác (0 điểm). Xem lời giải từng bước để củng cố kiến thức.',
  };
}

export function markC07ZoneSolutionViewed(
  state: C07GameState,
  challengeIndex?: 0 | 1 | 2
): C07GameState {
  if (
    (state.phase !== 'zone_revealed' && state.phase !== 'zone_challenge') ||
    !state.activeZoneId
  ) {
    return state;
  }

  const zIdx = state.zones.findIndex((z) => z.zoneId === state.activeZoneId);
  if (zIdx < 0) return state;
  const zone = state.zones[zIdx];
  const cIdx = challengeIndex ?? zone.activeChallengeIndex;
  const ch = zone.challenges[cIdx];

  const nextStatus: C07OutcomeStatus =
    ch.status === 'wrong'
      ? 'wrong_viewed_solution'
      : ch.status === 'skipped'
        ? 'skipped_viewed_solution'
        : ch.status;

  const updatedCh: C07ChallengeProgress = {
    ...ch,
    viewedSolution: true,
    status: nextStatus,
  };

  const nextChallenges = zone.challenges.map((c, idx) =>
    idx === cIdx ? updatedCh : c
  ) as [C07ChallengeProgress, C07ChallengeProgress, C07ChallengeProgress];

  const preliminary: C07ZoneState = {
    ...zone,
    challenges: nextChallenges,
  };
  const readyForKey = checkZoneKeyReady(preliminary);
  const keyNow = !zone.keyAwarded && readyForKey;
  const keyAwarded = zone.keyAwarded || keyNow;

  const updatedZone: C07ZoneState = {
    ...preliminary,
    keyAwarded,
    keyNewlyAwarded: keyNow,
    status: keyAwarded ? 'key_awarded' : zone.status,
  };

  const zones = state.zones.map((z, idx) => (idx === zIdx ? updatedZone : z)) as [
    C07ZoneState,
    C07ZoneState,
    C07ZoneState,
  ];

  return {
    ...state,
    zones,
    lastActionNotice: keyNow
      ? `Đã xem lời giải · Mở khóa ${zone.keyName} (giữ nguyên điểm gốc)!`
      : 'Đã ghi nhận xem lời giải hướng dẫn (giữ nguyên điểm gốc).',
  };
}

export function advanceInsideC07Zone(
  state: C07GameState,
  nowMs = Date.now()
): C07GameState {
  if (state.phase !== 'zone_revealed' || !state.activeZoneId) return state;
  const zone = getC07ActiveZone(state);
  if (!zone) return state;

  const nextUnresolved = zone.challenges.findIndex(
    (c, idx) => idx > zone.activeChallengeIndex && !isResolvedOutcome(c.status)
  );
  if (nextUnresolved === 1 || nextUnresolved === 2) {
    const nextTeamIdx =
      state.config.participationMode === 'class_teams' && state.teams.length > 0
        ? (state.activeTeamIndex + 1) % state.teams.length
        : state.activeTeamIndex;

    const zones = state.zones.map((z) =>
      z.zoneId === zone.zoneId
        ? { ...z, activeChallengeIndex: nextUnresolved as 0 | 1 | 2, keyNewlyAwarded: false }
        : z
    ) as [C07ZoneState, C07ZoneState, C07ZoneState];

    return {
      ...state,
      phase: 'zone_challenge',
      zones,
      activeTeamIndex: nextTeamIdx,
      turnToken: `c07_z_${zone.zoneId}_c${nextUnresolved}_${nowMs}`,
      revealAnimDone: false,
      activeHintRevealed: false,
      lastActionNotice: `${zone.title} · Thử thách ${nextUnresolved + 1}/3.`,
    };
  }

  let nextState = state;
  if (!zone.keyAwarded) {
    ([0, 1, 2] as const).forEach((idx) => {
      const ch = zone.challenges[idx];
      if ((ch.status === 'wrong' || ch.status === 'skipped') && !ch.viewedSolution) {
        nextState = markC07ZoneSolutionViewed(nextState, idx);
      }
    });
  }

  return returnToC07CastleMap(nextState, nowMs);
}

/**
 * Attempt to open the Final Royal Gate:
 * - Missing keys (< 3) -> stays in 'final_gate_locked' explaining exact missing keys & zones.
 * - All 3 keys collected -> opens 30-pt Final Synthesis Challenge!
 */
export function attemptOpenC07FinalGate(
  state: C07GameState,
  nowMs = Date.now()
): C07GameState {
  if (state.phase !== 'castle_map' && state.phase !== 'final_gate_locked') return state;

  const keys = getC07KeysCollectedCount(state);
  const missing = C07_ZONE_COUNT - keys;

  if (missing > 0) {
    const remainingZones = state.zones.filter((z) => !z.keyAwarded).map((z) => z.title);
    return {
      ...state,
      phase: 'final_gate_locked',
      lastActionNotice: `Cửa cuối đang khóa: còn thiếu ${missing}/3 chìa khóa (${remainingZones.join(', ')}).`,
    };
  }

  if (state.finalGateOpened) {
    return {
      ...state,
      phase: 'final_gate_revealed',
      turnToken: `c07_fg_rev_${nowMs}`,
      revealAnimDone: true,
    };
  }

  return {
    ...state,
    phase: 'final_gate_challenge',
    turnToken: `c07_fg_${nowMs}`,
    isProcessing: false,
    revealAnimDone: false,
    activeHintRevealed: state.finalGate.usedHint,
    lastActionNotice: 'Đã đủ 3/3 Chìa Khóa! Mở thử thách Cửa Cuối Hoàng Gia (30 điểm).',
  };
}

/**
 * Idempotent Final Gate scorer (+30 points max, NEVER double-scores when called twice!).
 * Completing Final Gate sets princessRescued = true so companion princess appears in 3D/2D.
 */
export function submitC07FinalGateAnswer(params: {
  state: C07GameState;
  turnToken: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
  commitHeldWhiteboard?: boolean;
}): C07GameState {
  const { state, turnToken } = params;
  // Strict idempotency guard: only allowed during 'final_gate_challenge' and before resolved
  if (state.phase !== 'final_gate_challenge' || state.isProcessing) return state;
  if (turnToken !== state.turnToken) return state;
  if (state.finalGateOpened || isResolvedOutcome(state.finalGate.status)) return state;

  const ch = state.finalGate;
  let isCorrect = false;
  let newStatus: C07OutcomeStatus = 'wrong';
  let selectedOptId: string | null = ch.selectedOptionId;
  const activeTeam = state.teams[state.activeTeamIndex];
  const teamResults = new Map<string, boolean>();

  if (params.commitHeldWhiteboard) {
    Object.values(ch.teamSubmissions).forEach((sub) => {
      const ok =
        typeof sub.teacherConfirmCorrect === 'boolean'
          ? sub.teacherConfirmCorrect
          : sub.selectedOptionId === ch.question.correctOptionId;
      teamResults.set(sub.teamId, ok);
    });
    isCorrect = Array.from(teamResults.values()).some(Boolean);
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    if (activeTeam && ch.teamSubmissions[activeTeam.id]) {
      selectedOptId = ch.teamSubmissions[activeTeam.id].selectedOptionId;
    }
  } else if (params.skip) {
    newStatus = 'skipped';
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    selectedOptId = isCorrect ? ch.question.correctOptionId : null;
    if (activeTeam) teamResults.set(activeTeam.id, isCorrect);
  } else if (params.optionId) {
    const opt = ch.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    selectedOptId = opt.optionId;
    isCorrect = opt.optionId === ch.question.correctOptionId;
    newStatus = isCorrect ? (ch.usedHint ? 'correct_with_hint' : 'correct_independent') : 'wrong';
    if (activeTeam) teamResults.set(activeTeam.id, isCorrect);
  } else {
    return state;
  }

  const pts = isCorrect ? C07_FINAL_GATE_POINTS : 0;
  const updatedFinalGate: C07ChallengeProgress = {
    ...ch,
    status: newStatus,
    selectedOptionId: selectedOptId,
    viewedSolution: !isCorrect,
    pointsAwarded: pts,
  };

  const teams = state.teams.map((t) => {
    const teamOk = teamResults.get(t.id);
    if (!teamOk) return t;
    return {
      ...t,
      score: t.score + pts,
      independentCount: t.independentCount + (ch.usedHint ? 0 : 1),
      assistedCount: t.assistedCount + (ch.usedHint ? 1 : 0),
    };
  });

  const totalScore = recomputeTotalAdventureScore(state.zones, updatedFinalGate);

  return {
    ...state,
    phase: 'final_gate_revealed',
    finalGate: updatedFinalGate,
    finalGateOpened: true,
    princessRescued: true,
    teams,
    score: totalScore,
    revealAnimDone: false,
    lastActionNotice: isCorrect
      ? `Giải cứu Công chúa thành công! +${C07_FINAL_GATE_POINTS} điểm Cửa cuối — Công chúa đã xuất hiện làm bạn đồng hành!`
      : 'Cửa cuối đã mở phần lời giải hướng dẫn (0 điểm câu cuối) — Công chúa đã xuất hiện đồng hành!',
  };
}

export function skipC07RevealAnimation(state: C07GameState): C07GameState {
  if (state.phase !== 'zone_revealed' && state.phase !== 'final_gate_revealed') {
    return state;
  }
  return {
    ...state,
    revealAnimDone: true,
  };
}

export function finishC07ToSummary(state: C07GameState): C07GameState {
  return {
    ...state,
    phase: 'summary',
    activeZoneId: null,
    revealAnimDone: true,
    lastActionNotice: 'Đã hoàn thành hành trình Giải cứu Công chúa 3D.',
  };
}

export function computeC07Summary(state: C07GameState): C07SummaryStats {
  let independentCorrectCount = 0;
  let assistedCorrectCount = 0;
  let viewedSolutionCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let unattemptedCount = 0;

  const inspect = (ch: C07ChallengeProgress) => {
    switch (ch.status) {
      case 'correct_independent':
        independentCorrectCount += 1;
        break;
      case 'correct_with_hint':
        assistedCorrectCount += 1;
        break;
      case 'wrong_viewed_solution':
      case 'skipped_viewed_solution':
        viewedSolutionCount += 1;
        break;
      case 'wrong':
        wrongCount += 1;
        break;
      case 'skipped':
        skippedCount += 1;
        break;
      case 'unattempted':
      case 'submitted':
      default:
        unattemptedCount += 1;
        break;
    }
  };

  for (const z of state.zones) {
    for (const ch of z.challenges) inspect(ch);
  }
  inspect(state.finalGate);

  const zoneScore = state.zones.reduce(
    (sum, z) => sum + z.challenges.reduce((s, c) => s + c.pointsAwarded, 0),
    0
  );
  const finalGateScore = state.finalGate.pointsAwarded;
  const keysCollected = getC07KeysCollectedCount(state);

  return {
    totalChallenges: C07_ZONE_COUNT * C07_CHALLENGES_PER_ZONE + 1,
    independentCorrectCount,
    assistedCorrectCount,
    viewedSolutionCount,
    wrongCount,
    skippedCount,
    unattemptedCount,
    keysCollected,
    keysMissing: C07_ZONE_COUNT - keysCollected,
    zoneScore,
    finalGateScore,
    totalScore: zoneScore + finalGateScore,
    maxScore: C07_MAX_TOTAL_POINTS,
  };
}

// ---------------------------------------------------------------------------
// DEMO-ISOLATED SESSION PERSISTENCE
// ---------------------------------------------------------------------------
interface PersistedC07Payload {
  version: 1;
  savedAtMs: number;
  state: C07GameState;
}

export function saveC07Session(state: C07GameState, nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cleanZones = state.zones.map((z) => ({
      ...z,
      keyNewlyAwarded: false,
    })) as [C07ZoneState, C07ZoneState, C07ZoneState];

    const payload: PersistedC07Payload = {
      version: 1,
      savedAtMs: nowMs,
      state: { ...state, zones: cleanZones },
    };
    window.localStorage.setItem(getC07SessionStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadC07Session(): C07GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getC07SessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedC07Payload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.zones) ||
      parsed.state.zones.length !== C07_ZONE_COUNT
    ) {
      clearC07Session();
      return null;
    }
    return {
      ...parsed.state,
      zones: parsed.state.zones.map((z) => ({
        ...z,
        keyNewlyAwarded: false,
      })) as [C07ZoneState, C07ZoneState, C07ZoneState],
    };
  } catch {
    clearC07Session();
    return null;
  }
}

export function clearC07Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getC07SessionStorageKey());
  } catch {
    // Ignore cleanly
  }
}
