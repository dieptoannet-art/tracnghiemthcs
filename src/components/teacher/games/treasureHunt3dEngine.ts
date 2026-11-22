import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const C06_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const C06_STATION_COUNT = 6;
export const C06_QUESTIONS_PER_STATION = 2;
export const C06_STATION_POINTS = 10;
export const C06_CHEST_POINTS = 30;
export const C06_MAX_TOTAL_POINTS = 150; // 6 * 2 * 10 + 30 = 150

export type C06StationId =
  | 'station_arithmetic'
  | 'station_powers'
  | 'station_algebra'
  | 'station_geometry'
  | 'station_ratio'
  | 'station_functions';

export type C06ParticipationMode = 'solo' | 'class_teams';
export type C06QuestionSource = 'sample_pack' | 'bank';
export type C06GraphicsQuality = 'high' | '2d';

export type C06Phase =
  | 'setup'
  | 'map' // Bản đồ 6 địa điểm + bảng ghép 6 mảnh tĩnh + rương trung tâm
  | 'station_question' // Đang làm câu hỏi tại 1 trạm
  | 'station_revealed' // Công bố kết quả + lời giải tại trạm
  | 'chest_locked_notice' // Về rương khi còn thiếu mảnh -> thông báo số mảnh & điểm thiếu
  | 'chest_question' // Câu tổng hợp 30 điểm khi đã đủ 6 mảnh
  | 'chest_revealed' // Công bố kết quả mở rương
  | 'summary'; // Tổng kết hành trình & xem lại toàn bộ lời giải

export type C06StationStatus = 'unexplored' | 'in_progress' | 'shard_collected';
export type C06AnswerStatus =
  | 'unattempted'
  | 'correct_first_try'
  | 'wrong'
  | 'wrong_viewed_guide'
  | 'skipped';

export interface C06OptionItem {
  optionId: string;
  labelKey: string;
  text: string;
}

export interface C06QuestionItem {
  questionId: string;
  sourceTag: 'Dữ liệu mẫu' | 'Ngân hàng Smart EDU';
  topicLabel: string;
  stem: string;
  image?: string;
  questionFormat: 'single_choice' | 'oral_confirm';
  options: C06OptionItem[];
  correctOptionId: string;
  hintText: string;
  explanationText: string;
}

export interface C06QuestionProgress {
  question: C06QuestionItem;
  status: C06AnswerStatus;
  selectedOptionId: string | null;
  firstTryCorrect: boolean;
  viewedSolution: boolean;
  pointsAwarded: number;
  answeredByLabel: string | null;
}

export interface C06StationState {
  stationId: C06StationId;
  orderIndex: number; // 0..5 fixed landmark slot on map
  title: string;
  subtitle: string;
  landmarkType: 'temple' | 'crystal_cave' | 'observatory' | 'elder_tree' | 'lighthouse' | 'volcano';
  shardName: string;
  accentHex: string;
  status: C06StationStatus;
  activeQuestionIndex: 0 | 1; // Saved resume cursor when leaving mid-station!
  questions: [C06QuestionProgress, C06QuestionProgress];
  shardCollected: boolean;
  shardNewlyAwarded: boolean;
}

export interface C06TeamItem {
  id: string;
  name: string;
  color: string;
  score: number;
  correctCount: number;
  studentNames: string[];
}

export interface C06SetupConfig {
  participationMode: C06ParticipationMode;
  questionSource: C06QuestionSource;
  topicFocus: C06StationId | 'all';
  shuffleOptions: boolean;
  oralProjectorMode: boolean; // Cho phép giáo viên xác nhận / chấm nhanh cho giấy hoặc bảng con
  teamCount: number; // 2..6
  teamNames: string[];
  classStudents: Array<{ id: string; fullName: string }>;
  selectedClassId: string;
}

export interface C06GameState {
  phase: C06Phase;
  config: C06SetupConfig;
  stations: C06StationState[];
  visitedOrder: C06StationId[]; // Quỹ đạo di chuyển thực tế qua các điểm
  activeStationId: C06StationId | null;
  chestQuestion: C06QuestionProgress;
  chestOpened: boolean;
  teams: C06TeamItem[];
  activeTeamIndex: number;
  activeCallerStudent: { id: string; fullName: string } | null;
  calledStudentIds: string[];
  score: number;
  maxScore: number;
  turnToken: string;
  isProcessing: boolean;
  revealAnimDone: boolean;
  activeHintRevealed: boolean;
  lastShardSoundId: string | null; // Tránh phát lại âm nhặt mảnh khi quay về bản đồ
  lastActionNotice: string;
}

export interface C06SummaryStats {
  totalQuestions: number; // 12 + 1 = 13
  stationCorrectFirstTry: number;
  stationWrong: number;
  stationWrongViewedGuide: number;
  stationSkipped: number;
  stationUnattempted: number;
  chestCorrect: boolean;
  shardsCollected: number;
  shardsMissing: number;
  stationScore: number;
  chestScore: number;
  totalScore: number;
  maxScore: number;
}

const TEAM_PALETTE = ['#2563EB', '#EA580C', '#059669', '#D97706', '#7C3AED', '#DB2777'];
const DEFAULT_TEAM_NAMES = ['Nhóm La Bàn', 'Nhóm Hải Đăng', 'Nhóm Pha Lê', 'Nhóm Cổ Thụ', 'Nhóm Thám Hiểm', 'Nhóm Đỉnh Vàng'];
const DISPLAY_KEYS = ['A', 'B', 'C', 'D'] as const;

export const C06_SESSION_BASE_KEY = 'taydo_c06_treasure_hunt_3d_session_v1';

export function getC06SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${C06_SESSION_BASE_KEY}`
    : C06_SESSION_BASE_KEY;
}

interface StationTemplateMeta {
  stationId: C06StationId;
  orderIndex: number;
  title: string;
  subtitle: string;
  landmarkType: C06StationState['landmarkType'];
  shardName: string;
  accentHex: string;
  sampleQuestions: [C06QuestionItem, C06QuestionItem];
}

export const C06_STATION_TEMPLATES: StationTemplateMeta[] = [
  {
    stationId: 'station_arithmetic',
    orderIndex: 0,
    title: 'Đền Số Học',
    subtitle: 'Phân số & Số nguyên',
    landmarkType: 'temple',
    shardName: 'Mảnh 1 · Số Học',
    accentHex: '#F59E0B',
    sampleQuestions: [
      {
        questionId: 'c06_arith_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Số học — Rút gọn phân số',
        stem: 'Rút gọn phân số về dạng tối giản: \\(\\dfrac{9}{12}\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_arith_1_a', labelKey: 'A', text: '\\(\\dfrac{3}{4}\\)' },
          { optionId: 'c06_arith_1_b', labelKey: 'B', text: '\\(\\dfrac{4}{3}\\)' },
          { optionId: 'c06_arith_1_c', labelKey: 'C', text: '\\(\\dfrac{9}{4}\\)' },
          { optionId: 'c06_arith_1_d', labelKey: 'D', text: '\\(\\dfrac{1}{3}\\)' },
        ],
        correctOptionId: 'c06_arith_1_a',
        hintText: 'Tìm ước chung lớn nhất của tử số \\(9\\) và mẫu số \\(12\\).',
        explanationText: 'Chia cả tử và mẫu cho \\(\\gcd(9, 12) = 3\\): \\(\\dfrac{9}{12} = \\dfrac{9:3}{12:3} = \\dfrac{3}{4}\\).',
      },
      {
        questionId: 'c06_arith_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Số học — Phép tính số nguyên âm',
        stem: 'Tính giá trị biểu thức: \\((-18) + 7 - (-5)\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_arith_2_a', labelKey: 'A', text: '\\(-6\\)' },
          { optionId: 'c06_arith_2_b', labelKey: 'B', text: '\\(-16\\)' },
          { optionId: 'c06_arith_2_c', labelKey: 'C', text: '\\(-20\\)' },
          { optionId: 'c06_arith_2_d', labelKey: 'D', text: '\\(6\\)' },
        ],
        correctOptionId: 'c06_arith_2_a',
        hintText: 'Đổi phép trừ số âm thành phép cộng: \\(-(-5) = +5\\).',
        explanationText: 'Ta có \\((-18) + 7 + 5 = -11 + 5 = -6\\).',
      },
    ],
  },
  {
    stationId: 'station_powers',
    orderIndex: 1,
    title: 'Hang Pha Lê',
    subtitle: 'Lũy thừa & Căn thức',
    landmarkType: 'crystal_cave',
    shardName: 'Mảnh 2 · Lũy Thừa',
    accentHex: '#38BDF8',
    sampleQuestions: [
      {
        questionId: 'c06_pow_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Căn bậc hai & Lũy thừa',
        stem: 'Tính giá trị của biểu thức: \\(\\sqrt{64} + 2^3\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_pow_1_a', labelKey: 'A', text: '\\(16\\)' },
          { optionId: 'c06_pow_1_b', labelKey: 'B', text: '\\(14\\)' },
          { optionId: 'c06_pow_1_c', labelKey: 'C', text: '\\(12\\)' },
          { optionId: 'c06_pow_1_d', labelKey: 'D', text: '\\(72\\)' },
        ],
        correctOptionId: 'c06_pow_1_a',
        hintText: 'Tính riêng \\(\\sqrt{64} = 8\\) và \\(2^3 = 8\\).',
        explanationText: 'Ta có \\(\\sqrt{64} = 8\\) và \\(2^3 = 8\\), suy ra \\(8 + 8 = 16\\).',
      },
      {
        questionId: 'c06_pow_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Chia hai lũy thừa cùng cơ số',
        stem: 'Rút gọn thương sau về dạng một lũy thừa rồi tính giá trị: \\(\\dfrac{3^5}{3^2}\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_pow_2_a', labelKey: 'A', text: '\\(27\\)' },
          { optionId: 'c06_pow_2_b', labelKey: 'B', text: '\\(9\\)' },
          { optionId: 'c06_pow_2_c', labelKey: 'C', text: '\\(81\\)' },
          { optionId: 'c06_pow_2_d', labelKey: 'D', text: '\\(15\\)' },
        ],
        correctOptionId: 'c06_pow_2_a',
        hintText: 'Áp dụng công thức \\(\\dfrac{a^m}{a^n} = a^{m-n}\\) với \\(a \\neq 0\\).',
        explanationText: 'Ta có \\(\\dfrac{3^5}{3^2} = 3^{5-2} = 3^3 = 27\\).',
      },
    ],
  },
  {
    stationId: 'station_algebra',
    orderIndex: 2,
    title: 'Đài Thiên Văn',
    subtitle: 'Biểu thức & Phương trình',
    landmarkType: 'observatory',
    shardName: 'Mảnh 3 · Đại Số',
    accentHex: '#A78BFA',
    sampleQuestions: [
      {
        questionId: 'c06_alg_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Phương trình bậc nhất',
        stem: 'Tìm nghiệm của phương trình: \\(4x - 7 = 13\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_alg_1_a', labelKey: 'A', text: '\\(x = 5\\)' },
          { optionId: 'c06_alg_1_b', labelKey: 'B', text: '\\(x = 4\\)' },
          { optionId: 'c06_alg_1_c', labelKey: 'C', text: '\\(x = \\dfrac{3}{2}\\)' },
          { optionId: 'c06_alg_1_d', labelKey: 'D', text: '\\(x = 20\\)' },
        ],
        correctOptionId: 'c06_alg_1_a',
        hintText: 'Chuyển \\(-7\\) sang vế phải thành \\(+7\\), sau đó chia cho \\(4\\).',
        explanationText: 'Ta có \\(4x = 13 + 7 = 20 \\Rightarrow x = \\dfrac{20}{4} = 5\\).',
      },
      {
        questionId: 'c06_alg_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Giá trị biểu thức đại số',
        stem: 'Tính giá trị của biểu thức \\(A = 2x^2 - 3x\\) tại \\(x = -2\\).',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_alg_2_a', labelKey: 'A', text: '\\(14\\)' },
          { optionId: 'c06_alg_2_b', labelKey: 'B', text: '\\(2\\)' },
          { optionId: 'c06_alg_2_c', labelKey: 'C', text: '\\(-14\\)' },
          { optionId: 'c06_alg_2_d', labelKey: 'D', text: '\\(-2\\)' },
        ],
        correctOptionId: 'c06_alg_2_a',
        hintText: 'Chú ý \\((-2)^2 = +4\\) và \\(-3 \\cdot (-2) = +6\\).',
        explanationText: 'Thay \\(x = -2\\): \\(A = 2 \\cdot (-2)^2 - 3 \\cdot (-2) = 2 \\cdot 4 + 6 = 8 + 6 = 14\\).',
      },
    ],
  },
  {
    stationId: 'station_geometry',
    orderIndex: 3,
    title: 'Cây Cổ Thụ',
    subtitle: 'Góc & Tam giác vuông',
    landmarkType: 'elder_tree',
    shardName: 'Mảnh 4 · Hình Học',
    accentHex: '#10B981',
    sampleQuestions: [
      {
        questionId: 'c06_geo_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Góc kề bù',
        stem: 'Hai góc kề bù có tổng số đo bằng \\(180^\\circ\\). Biết một góc có số đo \\(65^\\circ\\), góc còn lại bằng bao nhiêu?',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_geo_1_a', labelKey: 'A', text: '\\(115^\\circ\\)' },
          { optionId: 'c06_geo_1_b', labelKey: 'B', text: '\\(25^\\circ\\)' },
          { optionId: 'c06_geo_1_c', labelKey: 'C', text: '\\(125^\\circ\\)' },
          { optionId: 'c06_geo_1_d', labelKey: 'D', text: '\\(95^\\circ\\)' },
        ],
        correctOptionId: 'c06_geo_1_a',
        hintText: 'Lấy \\(180^\\circ\\) trừ đi số đo góc đã biết.',
        explanationText: 'Số đo góc còn lại là \\(180^\\circ - 65^\\circ = 115^\\circ\\).',
      },
      {
        questionId: 'c06_geo_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Định lí Pythagore',
        stem: 'Một tam giác vuông có độ dài hai cạnh góc vuông là \\(6\\text{ cm}\\) và \\(8\\text{ cm}\\). Độ dài cạnh huyền là:',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_geo_2_a', labelKey: 'A', text: '\\(10\\text{ cm}\\)' },
          { optionId: 'c06_geo_2_b', labelKey: 'B', text: '\\(14\\text{ cm}\\)' },
          { optionId: 'c06_geo_2_c', labelKey: 'C', text: '\\(48\\text{ cm}\\)' },
          { optionId: 'c06_geo_2_d', labelKey: 'D', text: '\\(12\\text{ cm}\\)' },
        ],
        correctOptionId: 'c06_geo_2_a',
        hintText: 'Cạnh huyền \\(c = \\sqrt{a^2 + b^2}\\).',
        explanationText: 'Theo định lí Pythagore: \\(c = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10\\text{ cm}\\).',
      },
    ],
  },
  {
    stationId: 'station_ratio',
    orderIndex: 4,
    title: 'Cảng Hải Đăng',
    subtitle: 'Tỉ lệ thức & Phần trăm',
    landmarkType: 'lighthouse',
    shardName: 'Mảnh 5 · Tỉ Lệ',
    accentHex: '#0EA5E9',
    sampleQuestions: [
      {
        questionId: 'c06_rat_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Tỉ lệ bản đồ',
        stem: 'Trên bản đồ tỉ lệ \\(1 : 2000\\), một đoạn đường dài \\(3\\text{ cm}\\). Độ dài thật ngoài thực địa là:',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_rat_1_a', labelKey: 'A', text: '\\(60\\text{ m}\\)' },
          { optionId: 'c06_rat_1_b', labelKey: 'B', text: '\\(600\\text{ m}\\)' },
          { optionId: 'c06_rat_1_c', labelKey: 'C', text: '\\(6\\text{ m}\\)' },
          { optionId: 'c06_rat_1_d', labelKey: 'D', text: '\\(6000\\text{ m}\\)' },
        ],
        correctOptionId: 'c06_rat_1_a',
        hintText: 'Nhân \\(3\\text{ cm}\\) với \\(2000\\), sau đó đổi từ \\(\\text{cm}\\) sang \\(\\text{m}\\) (chia cho \\(100\\)).',
        explanationText: 'Độ dài thật là \\(3 \\cdot 2000 = 6000\\text{ cm} = 60\\text{ m}\\).',
      },
      {
        questionId: 'c06_rat_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Bài toán phần trăm giảm giá',
        stem: 'Một chiếc ba lô giá niêm yết \\(200\\,000\\) đồng, được giảm giá \\(15\\%\\). Số tiền cần trả sau khi giảm là:',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_rat_2_a', labelKey: 'A', text: '\\(170\\,000\\) đồng' },
          { optionId: 'c06_rat_2_b', labelKey: 'B', text: '\\(185\\,000\\) đồng' },
          { optionId: 'c06_rat_2_c', labelKey: 'C', text: '\\(30\\,000\\) đồng' },
          { optionId: 'c06_rat_2_d', labelKey: 'D', text: '\\(165\\,000\\) đồng' },
        ],
        correctOptionId: 'c06_rat_2_a',
        hintText: 'Số tiền được giảm là \\(200\\,000 \\cdot 15\\% = 30\\,000\\) đồng.',
        explanationText: 'Số tiền phải trả là \\(200\\,000 - 200\\,000 \\cdot \\dfrac{15}{100} = 200\\,000 - 30\\,000 = 170\\,000\\) đồng.',
      },
    ],
  },
  {
    stationId: 'station_functions',
    orderIndex: 5,
    title: 'Đỉnh Núi Lửa',
    subtitle: 'Hàm số & Tọa độ',
    landmarkType: 'volcano',
    shardName: 'Mảnh 6 · Hàm Số',
    accentHex: '#F43F5E',
    sampleQuestions: [
      {
        questionId: 'c06_fn_1',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Tính giá trị hàm số',
        stem: 'Cho hàm số \\(y = -2x + 5\\). Giá trị của \\(y\\) khi \\(x = 3\\) là:',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_fn_1_a', labelKey: 'A', text: '\\(-1\\)' },
          { optionId: 'c06_fn_1_b', labelKey: 'B', text: '\\(11\\)' },
          { optionId: 'c06_fn_1_c', labelKey: 'C', text: '\\(1\\)' },
          { optionId: 'c06_fn_1_d', labelKey: 'D', text: '\\(-11\\)' },
        ],
        correctOptionId: 'c06_fn_1_a',
        hintText: 'Thay \\(x = 3\\) vào công thức \\(y = -2x + 5\\).',
        explanationText: 'Khi \\(x = 3\\), ta có \\(y = -2 \\cdot 3 + 5 = -6 + 5 = -1\\).',
      },
      {
        questionId: 'c06_fn_2',
        sourceTag: C06_SAMPLE_BADGE,
        topicLabel: 'Đồ thị hàm số',
        stem: 'Điểm \\(M(2; 6)\\) thuộc đồ thị của hàm số nào sau đây?',
        questionFormat: 'single_choice',
        options: [
          { optionId: 'c06_fn_2_a', labelKey: 'A', text: '\\(y = 3x\\)' },
          { optionId: 'c06_fn_2_b', labelKey: 'B', text: '\\(y = 2x\\)' },
          { optionId: 'c06_fn_2_c', labelKey: 'C', text: '\\(y = x + 3\\)' },
          { optionId: 'c06_fn_2_d', labelKey: 'D', text: '\\(y = -3x\\)' },
        ],
        correctOptionId: 'c06_fn_2_a',
        hintText: 'Thay hoành độ \\(x = 2\\) vào từng hàm số xem hàm nào cho kết quả \\(y = 6\\).',
        explanationText: 'Với \\(y = 3x\\), khi \\(x = 2\\) thì \\(y = 3 \\cdot 2 = 6\\), đúng bằng tung độ của \\(M(2; 6)\\).',
      },
    ],
  },
];

export const C06_SAMPLE_CHEST_QUESTION: C06QuestionItem = {
  questionId: 'c06_chest_synthesis',
  sourceTag: C06_SAMPLE_BADGE,
  topicLabel: 'Câu tổng hợp mở Rương Kho Báu (30 điểm)',
  stem: 'Một mảnh vườn hình vuông có diện tích \\(81\\text{ m}^2\\). Đoạn hàng rào phía trước có chiều dài bằng \\(\\dfrac{9}{12}\\) độ dài một cạnh hình vuông. Chiều dài đoạn hàng rào đó là bao nhiêu mét?',
  questionFormat: 'single_choice',
  options: [
    { optionId: 'c06_chest_opt_a', labelKey: 'A', text: '\\(\\dfrac{27}{4}\\text{ m} = 6{,}75\\text{ m}\\)' },
    { optionId: 'c06_chest_opt_b', labelKey: 'B', text: '\\(\\dfrac{9}{4}\\text{ m} = 2{,}25\\text{ m}\\)' },
    { optionId: 'c06_chest_opt_c', labelKey: 'C', text: '\\(12\\text{ m}\\)' },
    { optionId: 'c06_chest_opt_d', labelKey: 'D', text: '\\(8{,}25\\text{ m}\\)' },
  ],
  correctOptionId: 'c06_chest_opt_a',
  hintText: 'Bước 1: Tìm cạnh hình vuông \\(a = \\sqrt{81}\\). Bước 2: Rút gọn \\(\\dfrac{9}{12} = \\dfrac{3}{4}\\) rồi nhân với cạnh \\(a\\).',
  explanationText:
    'Cạnh mảnh vườn hình vuông là \\(\\sqrt{81} = 9\\text{ m}\\). Rút gọn tỉ số \\(\\dfrac{9}{12} = \\dfrac{3}{4}\\). Độ dài đoạn hàng rào là \\(9 \\cdot \\dfrac{3}{4} = \\dfrac{27}{4} = 6{,}75\\text{ m}\\).',
};

// ---------------------------------------------------------------------------
// DETERMINISTIC OPTION SHUFFLE (locks strictly by stable optionId)
// ---------------------------------------------------------------------------
export function hashC06Seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleC06Options(
  q: C06QuestionItem,
  seedInput: string
): C06QuestionItem {
  if (q.questionFormat !== 'single_choice' || q.options.length <= 1) return q;
  const cloned = q.options.map((opt) => ({ ...opt }));
  let seed = hashC06Seed(`${q.questionId}:${seedInput}`) || 2027;
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
// RBAC SMART EDU BANK ADAPTER (falls back gracefully when fewer than 13 Qs)
// ---------------------------------------------------------------------------
export function adaptBankQuestionsForC06(
  bankQuestions: Question[],
  userRole: UserRole
): C06QuestionItem[] {
  const allowed = bankQuestions.filter((q) => {
    if (userRole === 'student' && q.status !== 'approved') return false;
    return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
  });

  const out: C06QuestionItem[] = [];
  for (const q of allowed) {
    const rawOpts = (q.options || []).slice(0, 4);
    const targetAnswer = String(q.correctAnswer || '').trim();
    const correctIdx = rawOpts.findIndex(
      (opt) => opt.id === targetAnswer || opt.label === targetAnswer
    );
    if (correctIdx < 0) continue;

    const mappedOpts: C06OptionItem[] = rawOpts.map((opt, idx) => ({
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
      questionFormat: 'single_choice',
      options: mappedOpts,
      correctOptionId: mappedOpts[correctIdx].optionId,
      hintText: q.lesson
        ? `Gợi ý ôn tập: xem lại kiến thức "${q.lesson}".`
        : 'Đọc kỹ dữ kiện đề bài và thử kiểm tra lại phép tính.',
      explanationText:
        String(q.explanation || '').trim() ||
        `Đáp án đúng là ${mappedOpts[correctIdx].labelKey}: ${mappedOpts[correctIdx].text}.`,
    });
  }
  return out;
}

export function buildC06Teams(
  participationMode: C06ParticipationMode,
  teamCount: number,
  teamNames: string[] = [],
  classStudents: Array<{ id: string; fullName: string }> = []
): C06TeamItem[] {
  if (participationMode === 'solo') {
    return [
      {
        id: 'team_solo',
        name: classStudents.length === 1 ? classStudents[0].fullName : 'Nhà thám hiểm',
        color: '#2563EB',
        score: 0,
        correctCount: 0,
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
    name: (teamNames[idx] || '').trim() || DEFAULT_TEAM_NAMES[idx] || `Nhóm ${idx + 1}`,
    color: TEAM_PALETTE[idx % TEAM_PALETTE.length],
    score: 0,
    correctCount: 0,
    studentNames: buckets[idx],
  }));
}

export function createDefaultC06SetupConfig(
  overrides: Partial<C06SetupConfig> = {}
): C06SetupConfig {
  return {
    participationMode: 'solo',
    questionSource: 'sample_pack',
    topicFocus: 'all',
    shuffleOptions: true,
    oralProjectorMode: false,
    teamCount: 2,
    teamNames: DEFAULT_TEAM_NAMES.slice(0, 6),
    classStudents: [],
    selectedClassId: '',
    ...overrides,
  };
}

function makeQuestionProgress(q: C06QuestionItem): C06QuestionProgress {
  return {
    question: q,
    status: 'unattempted',
    selectedOptionId: null,
    firstTryCorrect: false,
    viewedSolution: false,
    pointsAwarded: 0,
    answeredByLabel: null,
  };
}

export function createC06SetupState(
  configOverrides: Partial<C06SetupConfig> = {}
): C06GameState {
  const config = createDefaultC06SetupConfig(configOverrides);
  const stations: C06StationState[] = C06_STATION_TEMPLATES.map((tpl) => ({
    stationId: tpl.stationId,
    orderIndex: tpl.orderIndex,
    title: tpl.title,
    subtitle: tpl.subtitle,
    landmarkType: tpl.landmarkType,
    shardName: tpl.shardName,
    accentHex: tpl.accentHex,
    status: 'unexplored',
    activeQuestionIndex: 0,
    questions: [
      makeQuestionProgress(tpl.sampleQuestions[0]),
      makeQuestionProgress(tpl.sampleQuestions[1]),
    ],
    shardCollected: false,
    shardNewlyAwarded: false,
  }));

  return {
    phase: 'setup',
    config,
    stations,
    visitedOrder: [],
    activeStationId: null,
    chestQuestion: makeQuestionProgress(C06_SAMPLE_CHEST_QUESTION),
    chestOpened: false,
    teams: buildC06Teams(
      config.participationMode,
      config.teamCount,
      config.teamNames,
      config.classStudents
    ),
    activeTeamIndex: 0,
    activeCallerStudent: null,
    calledStudentIds: [],
    score: 0,
    maxScore: C06_MAX_TOTAL_POINTS,
    turnToken: 'c06_setup',
    isProcessing: false,
    revealAnimDone: false,
    activeHintRevealed: false,
    lastShardSoundId: null,
    lastActionNotice: 'Sẵn sàng khởi hành bản đồ 6 địa điểm.',
  };
}

export function startC06Adventure(params: {
  config: C06SetupConfig;
  bankQuestions?: Question[];
  userRole?: UserRole;
  nowMs?: number;
  shuffleSeed?: string;
}): { ok: boolean; error?: string; state?: C06GameState } {
  const nowMs = params.nowMs ?? Date.now();
  const seed = params.shuffleSeed ?? String(nowMs);

  let bankPool: C06QuestionItem[] = [];
  if (params.config.questionSource === 'bank') {
    bankPool = adaptBankQuestionsForC06(
      params.bankQuestions || [],
      params.userRole || 'teacher'
    );
    if (bankPool.length === 0) {
      return {
        ok: false,
        error:
          'Ngân hàng câu hỏi Smart EDU chưa có câu trắc nghiệm 1 đáp án phù hợp. Hãy chọn "Gói mẫu C06 (6 trạm + Rương)" hoặc thêm câu hỏi trắc nghiệm vào ngân hàng.',
      };
    }
  }

  let bankCursor = 0;
  const pickQuestion = (fallback: C06QuestionItem): C06QuestionItem => {
    const raw =
      params.config.questionSource === 'bank' && bankCursor < bankPool.length
        ? bankPool[bankCursor++]
        : fallback;
    return params.config.shuffleOptions ? shuffleC06Options(raw, seed) : raw;
  };

  const stations: C06StationState[] = C06_STATION_TEMPLATES.map((tpl) => {
    const q1 = pickQuestion(tpl.sampleQuestions[0]);
    const q2 = pickQuestion(tpl.sampleQuestions[1]);
    return {
      stationId: tpl.stationId,
      orderIndex: tpl.orderIndex,
      title: tpl.title,
      subtitle: tpl.subtitle,
      landmarkType: tpl.landmarkType,
      shardName: tpl.shardName,
      accentHex: tpl.accentHex,
      status: 'unexplored',
      activeQuestionIndex: 0,
      questions: [makeQuestionProgress(q1), makeQuestionProgress(q2)],
      shardCollected: false,
      shardNewlyAwarded: false,
    };
  });

  const chestQ = pickQuestion(C06_SAMPLE_CHEST_QUESTION);
  const firstCaller =
    params.config.classStudents.length > 0 ? params.config.classStudents[0] : null;

  return {
    ok: true,
    state: {
      phase: 'map',
      config: { ...params.config },
      stations,
      visitedOrder: [],
      activeStationId: null,
      chestQuestion: makeQuestionProgress(chestQ),
      chestOpened: false,
      teams: buildC06Teams(
        params.config.participationMode,
        params.config.teamCount,
        params.config.teamNames,
        params.config.classStudents
      ),
      activeTeamIndex: 0,
      activeCallerStudent: firstCaller,
      calledStudentIds: firstCaller ? [firstCaller.id] : [],
      score: 0,
      maxScore: C06_MAX_TOTAL_POINTS,
      turnToken: `c06_map_${nowMs}`,
      isProcessing: false,
      revealAnimDone: false,
      activeHintRevealed: false,
      lastShardSoundId: null,
      lastActionNotice: 'Chọn bất kỳ địa điểm nào trên bản đồ để khám phá (mỗi điểm 2 câu).',
    },
  };
}

export function getC06CollectedShardCount(state: C06GameState): number {
  return state.stations.filter((st) => st.shardCollected).length;
}

export function getC06ActiveStation(state: C06GameState): C06StationState | null {
  if (!state.activeStationId) return null;
  return state.stations.find((st) => st.stationId === state.activeStationId) ?? null;
}

/**
 * Enter any of the 6 stations in free order.
 * If leaving a station mid-way after Q1, returning preserves activeQuestionIndex & questions unchanged!
 */
export function enterC06Station(
  state: C06GameState,
  stationId: C06StationId,
  nowMs = Date.now()
): C06GameState {
  if (state.phase !== 'map' && state.phase !== 'chest_locked_notice') return state;
  const target = state.stations.find((s) => s.stationId === stationId);
  if (!target) return state;

  // If shard already collected at this station, jump to its review / second question reveal or allow viewing Q1/Q2
  const alreadyCompleted = target.shardCollected;
  const resumeIdx: 0 | 1 =
    alreadyCompleted
      ? 1
      : target.questions[0].status === 'unattempted'
        ? 0
        : target.questions[1].status === 'unattempted'
          ? 1
          : target.activeQuestionIndex;

  const updatedVisited = state.visitedOrder.includes(stationId)
    ? state.visitedOrder
    : [...state.visitedOrder, stationId];

  const updatedStations = state.stations.map((st) => {
    if (st.stationId !== stationId) return { ...st, shardNewlyAwarded: false };
    return {
      ...st,
      status: (st.shardCollected ? 'shard_collected' : 'in_progress') as C06StationStatus,
      activeQuestionIndex: resumeIdx,
      shardNewlyAwarded: false,
    };
  });

  const activeProgress = updatedStations.find((s) => s.stationId === stationId)!.questions[resumeIdx];
  const isAlreadyAnswered = activeProgress.status !== 'unattempted';

  return {
    ...state,
    phase: isAlreadyAnswered ? 'station_revealed' : 'station_question',
    stations: updatedStations,
    visitedOrder: updatedVisited,
    activeStationId: stationId,
    turnToken: `c06_st_${stationId}_q${resumeIdx}_${nowMs}`,
    isProcessing: false,
    revealAnimDone: isAlreadyAnswered,
    activeHintRevealed: false,
    lastActionNotice: isAlreadyAnswered
      ? `Xem lại ${target.title} — Câu ${resumeIdx + 1}/2.`
      : `Đang mở ${target.title} · Câu ${resumeIdx + 1}/2.`,
  };
}

/**
 * Leave current station and return to the 3D Treasure Map without changing or resetting any question!
 */
export function returnToC06Map(state: C06GameState, nowMs = Date.now()): C06GameState {
  if (
    state.phase !== 'station_question' &&
    state.phase !== 'station_revealed' &&
    state.phase !== 'chest_locked_notice'
  ) {
    return state;
  }

  // Re-evaluate station status safely (stays 'in_progress' if 1 of 2 done, 'unexplored' if 0 done, 'shard_collected' if shard awarded)
  const updatedStations = state.stations.map((st) => {
    const q0Done = st.questions[0].status !== 'unattempted';
    const q1Done = st.questions[1].status !== 'unattempted';
    let nextStatus: C06StationStatus = 'unexplored';
    if (st.shardCollected) {
      nextStatus = 'shard_collected';
    } else if (q0Done || q1Done) {
      nextStatus = 'in_progress';
    }
    return {
      ...st,
      status: nextStatus,
      shardNewlyAwarded: false,
    };
  });

  return {
    ...state,
    phase: 'map',
    stations: updatedStations,
    activeStationId: null,
    turnToken: `c06_map_${nowMs}`,
    isProcessing: false,
    activeHintRevealed: false,
    lastActionNotice: 'Đã quay lại bản đồ 6 địa điểm.',
  };
}

export function revealC06Hint(state: C06GameState): C06GameState {
  if (
    state.phase !== 'station_question' &&
    state.phase !== 'chest_question'
  ) {
    return state;
  }
  if (state.activeHintRevealed) return state;
  return {
    ...state,
    activeHintRevealed: true,
    lastActionNotice: 'Đã mở gợi ý tư duy.',
  };
}

export function pickNextC06Student(state: C06GameState): C06GameState {
  const pool = state.config.classStudents;
  if (pool.length === 0) return state;
  const uncalled = pool.filter((s) => !state.calledStudentIds.includes(s.id));
  const nextPool = uncalled.length > 0 ? uncalled : pool;
  const seed = hashC06Seed(`${state.turnToken}:${state.calledStudentIds.length}`);
  const picked = nextPool[seed % nextPool.length];
  return {
    ...state,
    activeCallerStudent: picked,
    calledStudentIds: uncalled.length > 0 ? [...state.calledStudentIds, picked.id] : [picked.id],
  };
}

function getActiveResponderLabel(state: C06GameState): string | null {
  const team = state.teams[state.activeTeamIndex];
  if (state.config.participationMode === 'class_teams') {
    return [team?.name, state.activeCallerStudent?.fullName].filter(Boolean).join(' · ') || null;
  }
  return state.activeCallerStudent?.fullName || null;
}

function checkStationCompletion(st: C06StationState): {
  completed: boolean;
  readyForShard: boolean;
} {
  const [p0, p1] = st.questions;
  const bothAnswered = p0.status !== 'unattempted' && p1.status !== 'unattempted';
  if (!bothAnswered) return { completed: false, readyForShard: false };

  // Prompt rule: "Sau khi hoàn thành hoặc xem lại lời giải tại điểm, cấp mảnh để học sinh tiếp tục"
  // Also: "Câu sai rồi đọc hướng dẫn vẫn mở mảnh khi hoàn thành trạm và giữ 0 điểm cho câu sai."
  const anyNeedsSolutionView =
    (p0.status === 'wrong' || p0.status === 'skipped') && !p0.viewedSolution ||
    (p1.status === 'wrong' || p1.status === 'skipped') && !p1.viewedSolution;

  return {
    completed: true,
    readyForShard: !anyNeedsSolutionView,
  };
}

/**
 * Submit an option by stable optionId (OR teacher oral confirmation) at the current station question.
 */
export function submitC06StationAnswer(params: {
  state: C06GameState;
  turnToken: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
  nowMs?: number;
}): C06GameState {
  const nowMs = params.nowMs ?? Date.now();
  const { state, turnToken } = params;
  if (state.phase !== 'station_question' || state.isProcessing) return state;
  if (turnToken !== state.turnToken || !state.activeStationId) return state;

  const stIdx = state.stations.findIndex((s) => s.stationId === state.activeStationId);
  if (stIdx < 0) return state;
  const st = state.stations[stIdx];
  const qIdx = st.activeQuestionIndex;
  const qProg = st.questions[qIdx];
  if (qProg.status !== 'unattempted') return state;

  let isCorrect = false;
  let newStatus: C06AnswerStatus = 'wrong';
  let selectedOptId: string | null = null;

  if (params.skip) {
    newStatus = 'skipped';
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    newStatus = isCorrect ? 'correct_first_try' : 'wrong';
    selectedOptId = isCorrect ? qProg.question.correctOptionId : null;
  } else if (params.optionId) {
    const opt = qProg.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    selectedOptId = opt.optionId;
    isCorrect = opt.optionId === qProg.question.correctOptionId;
    newStatus = isCorrect ? 'correct_first_try' : 'wrong';
  } else {
    return state;
  }

  const pts = isCorrect ? C06_STATION_POINTS : 0;
  const responder = getActiveResponderLabel(state);

  const updatedProgress: C06QuestionProgress = {
    ...qProg,
    status: newStatus,
    selectedOptionId: selectedOptId,
    firstTryCorrect: isCorrect,
    viewedSolution: false,
    pointsAwarded: pts,
    answeredByLabel: responder,
  };

  const nextQuestions: [C06QuestionProgress, C06QuestionProgress] =
    qIdx === 0 ? [updatedProgress, st.questions[1]] : [st.questions[0], updatedProgress];

  const preliminaryStation: C06StationState = {
    ...st,
    questions: nextQuestions,
  };
  const { readyForShard } = checkStationCompletion(preliminaryStation);
  const shardNow = !st.shardCollected && readyForShard;
  const shardCollected = st.shardCollected || shardNow;

  const updatedStation: C06StationState = {
    ...preliminaryStation,
    shardCollected,
    shardNewlyAwarded: shardNow,
    status: shardCollected ? 'shard_collected' : 'in_progress',
  };

  const updatedStations = state.stations.map((s, idx) =>
    idx === stIdx ? updatedStation : { ...s, shardNewlyAwarded: false }
  );

  const updatedTeams = state.teams.map((t, idx) => {
    if (idx !== state.activeTeamIndex || !isCorrect) return t;
    return {
      ...t,
      score: t.score + pts,
      correctCount: t.correctCount + 1,
    };
  });

  return {
    ...state,
    phase: 'station_revealed',
    stations: updatedStations,
    teams: updatedTeams,
    score: state.score + pts,
    revealAnimDone: false,
    lastActionNotice: isCorrect
      ? `Chính xác! +${pts} điểm${shardNow ? ` · Đã nhận ${st.shardName}!` : ''}`
      : newStatus === 'skipped'
        ? 'Đã bỏ qua câu hỏi (0 điểm). Hãy xem lời giải hướng dẫn để tiếp tục lấy mảnh.'
        : 'Chưa chính xác (0 điểm). Hãy xem lời giải hướng dẫn để nắm vững kiến thức.',
  };
}

/**
 * Mark guided solution as viewed for current station question.
 * Keeps 0 points for wrong/skipped questions AND keeps firstTryCorrect === false separate!
 * Unlocks station shard once both questions at the station are completed + guided solution read.
 */
export function markC06SolutionViewed(
  state: C06GameState,
  questionIndex?: 0 | 1
): C06GameState {
  if (
    (state.phase !== 'station_revealed' && state.phase !== 'station_question') ||
    !state.activeStationId
  ) {
    return state;
  }

  const stIdx = state.stations.findIndex((s) => s.stationId === state.activeStationId);
  if (stIdx < 0) return state;
  const st = state.stations[stIdx];
  const qIdx: 0 | 1 = questionIndex ?? st.activeQuestionIndex;
  const qProg = st.questions[qIdx];

  const updatedQ: C06QuestionProgress = {
    ...qProg,
    viewedSolution: true,
    status:
      qProg.status === 'wrong' ? 'wrong_viewed_guide' : qProg.status,
  };

  const nextQuestions: [C06QuestionProgress, C06QuestionProgress] =
    qIdx === 0 ? [updatedQ, st.questions[1]] : [st.questions[0], updatedQ];

  const preliminary: C06StationState = {
    ...st,
    questions: nextQuestions,
  };
  const { readyForShard } = checkStationCompletion(preliminary);
  const shardNow = !st.shardCollected && readyForShard;
  const shardCollected = st.shardCollected || shardNow;

  const updatedStation: C06StationState = {
    ...preliminary,
    shardCollected,
    shardNewlyAwarded: shardNow,
    status: shardCollected ? 'shard_collected' : st.status,
  };

  const updatedStations = state.stations.map((s, idx) =>
    idx === stIdx ? updatedStation : s
  );

  return {
    ...state,
    stations: updatedStations,
    lastActionNotice: shardNow
      ? `Đã xem lời giải · Mở khóa ${st.shardName} (giữ nguyên điểm gốc)!`
      : 'Đã ghi nhận xem lời giải hướng dẫn.',
  };
}

/**
 * Move from Question 1 reveal to Question 2 inside the active station, OR return to map if station done.
 */
export function advanceInsideC06Station(
  state: C06GameState,
  nowMs = Date.now()
): C06GameState {
  if (state.phase !== 'station_revealed' || !state.activeStationId) return state;
  const st = getC06ActiveStation(state);
  if (!st) return state;

  // Check if Q1 was just finished and Q2 is still unattempted
  if (st.activeQuestionIndex === 0 && st.questions[1].status === 'unattempted') {
    const nextTeamIdx =
      state.config.participationMode === 'class_teams' && state.teams.length > 0
        ? (state.activeTeamIndex + 1) % state.teams.length
        : state.activeTeamIndex;

    const updatedStations = state.stations.map((s) =>
      s.stationId === st.stationId
        ? { ...s, activeQuestionIndex: 1 as const, shardNewlyAwarded: false }
        : s
    );

    return {
      ...state,
      phase: 'station_question',
      stations: updatedStations,
      activeTeamIndex: nextTeamIdx,
      turnToken: `c06_st_${st.stationId}_q1_${nowMs}`,
      revealAnimDone: false,
      activeHintRevealed: false,
      lastActionNotice: `Đang mở ${st.title} · Câu 2/2.`,
    };
  }

  // If station has both questions answered but a wrong/skipped question hasn't viewed guide yet,
  // automatically record solution viewed upon completing station step if user clicks "Hoàn thành trạm & Nhận mảnh"
  let nextState = state;
  if (!st.shardCollected) {
    const p0Needs = (st.questions[0].status === 'wrong' || st.questions[0].status === 'skipped') && !st.questions[0].viewedSolution;
    const p1Needs = (st.questions[1].status === 'wrong' || st.questions[1].status === 'skipped') && !st.questions[1].viewedSolution;
    if (p0Needs) nextState = markC06SolutionViewed(nextState, 0);
    if (p1Needs) nextState = markC06SolutionViewed(nextState, 1);
  }

  return returnToC06Map(nextState, nowMs);
}

/**
 * Attempt to open the Central Treasure Chest:
 * - If < 6 shards: stays on 'chest_locked_notice' showing exact missing shards & remaining station points!
 * - If == 6 shards: opens the 30-point synthesis chest challenge!
 */
export function attemptOpenC06Chest(
  state: C06GameState,
  nowMs = Date.now()
): C06GameState {
  if (state.phase !== 'map' && state.phase !== 'chest_locked_notice') return state;

  const collected = getC06CollectedShardCount(state);
  const missing = C06_STATION_COUNT - collected;

  if (missing > 0) {
    const incompleteStations = state.stations.filter((s) => !s.shardCollected).length;
    const unansweredStationQs = state.stations.reduce(
      (sum, s) =>
        sum +
        (s.questions[0].status === 'unattempted' ? 1 : 0) +
        (s.questions[1].status === 'unattempted' ? 1 : 0),
      0
    );
    const remainingStationPtsAvailable = unansweredStationQs * C06_STATION_POINTS;

    return {
      ...state,
      phase: 'chest_locked_notice',
      lastActionNotice: `Rương kho báu đang khóa: còn thiếu ${missing} mảnh ghép (${incompleteStations} điểm chưa xong, tối đa còn ${remainingStationPtsAvailable} điểm trạm).`,
    };
  }

  if (state.chestOpened) {
    return {
      ...state,
      phase: 'chest_revealed',
      turnToken: `c06_chest_rev_${nowMs}`,
      revealAnimDone: true,
    };
  }

  return {
    ...state,
    phase: 'chest_question',
    turnToken: `c06_chest_${nowMs}`,
    isProcessing: false,
    revealAnimDone: false,
    activeHintRevealed: false,
    lastActionNotice: 'Đã ghép đủ 6 mảnh! Mở khóa Câu tổng hợp Kho Báu (30 điểm).',
  };
}

export function submitC06ChestAnswer(params: {
  state: C06GameState;
  turnToken: string;
  optionId?: string;
  teacherConfirmCorrect?: boolean;
  skip?: boolean;
}): C06GameState {
  const { state, turnToken } = params;
  if (state.phase !== 'chest_question' || state.isProcessing) return state;
  if (turnToken !== state.turnToken) return state;

  const qProg = state.chestQuestion;
  if (qProg.status !== 'unattempted') return state;

  let isCorrect = false;
  let newStatus: C06AnswerStatus = 'wrong';
  let selectedOptId: string | null = null;

  if (params.skip) {
    newStatus = 'skipped';
  } else if (typeof params.teacherConfirmCorrect === 'boolean') {
    isCorrect = params.teacherConfirmCorrect;
    newStatus = isCorrect ? 'correct_first_try' : 'wrong';
    selectedOptId = isCorrect ? qProg.question.correctOptionId : null;
  } else if (params.optionId) {
    const opt = qProg.question.options.find((o) => o.optionId === params.optionId);
    if (!opt) return state;
    selectedOptId = opt.optionId;
    isCorrect = opt.optionId === qProg.question.correctOptionId;
    newStatus = isCorrect ? 'correct_first_try' : 'wrong';
  } else {
    return state;
  }

  const pts = isCorrect ? C06_CHEST_POINTS : 0;
  const responder = getActiveResponderLabel(state);

  const updatedTeams = state.teams.map((t, idx) => {
    if (idx !== state.activeTeamIndex || !isCorrect) return t;
    return {
      ...t,
      score: t.score + pts,
      correctCount: t.correctCount + 1,
    };
  });

  return {
    ...state,
    phase: 'chest_revealed',
    chestOpened: true,
    chestQuestion: {
      ...qProg,
      status: newStatus,
      selectedOptionId: selectedOptId,
      firstTryCorrect: isCorrect,
      viewedSolution: !isCorrect,
      pointsAwarded: pts,
      answeredByLabel: responder,
    },
    teams: updatedTeams,
    score: state.score + pts,
    revealAnimDone: false,
    lastActionNotice: isCorrect
      ? `Mở Rương Kho Báu thành công! +${C06_CHEST_POINTS} điểm!`
      : 'Rương đã mở phần lời giải hướng dẫn (0 điểm câu tổng hợp).',
  };
}

export function skipC06RevealAnimation(state: C06GameState): C06GameState {
  if (state.phase !== 'station_revealed' && state.phase !== 'chest_revealed') {
    return state;
  }
  return {
    ...state,
    revealAnimDone: true,
  };
}

export function finishC06ToSummary(state: C06GameState): C06GameState {
  return {
    ...state,
    phase: 'summary',
    activeStationId: null,
    revealAnimDone: true,
    lastActionNotice: 'Đã hoàn thành hành trình Truy tìm kho báu 3D.',
  };
}

export function computeC06Summary(state: C06GameState): C06SummaryStats {
  let stationCorrectFirstTry = 0;
  let stationWrong = 0;
  let stationWrongViewedGuide = 0;
  let stationSkipped = 0;
  let stationUnattempted = 0;
  let stationScore = 0;

  for (const st of state.stations) {
    for (const q of st.questions) {
      stationScore += q.pointsAwarded;
      switch (q.status) {
        case 'correct_first_try':
          stationCorrectFirstTry += 1;
          break;
        case 'wrong':
          stationWrong += 1;
          break;
        case 'wrong_viewed_guide':
          stationWrongViewedGuide += 1;
          break;
        case 'skipped':
          stationSkipped += 1;
          break;
        case 'unattempted':
        default:
          stationUnattempted += 1;
          break;
      }
    }
  }

  const shardsCollected = getC06CollectedShardCount(state);
  const shardsMissing = C06_STATION_COUNT - shardsCollected;
  const chestCorrect = state.chestQuestion.status === 'correct_first_try';
  const chestScore = state.chestQuestion.pointsAwarded;

  return {
    totalQuestions: C06_STATION_COUNT * C06_QUESTIONS_PER_STATION + 1,
    stationCorrectFirstTry,
    stationWrong,
    stationWrongViewedGuide,
    stationSkipped,
    stationUnattempted,
    chestCorrect,
    shardsCollected,
    shardsMissing,
    stationScore,
    chestScore,
    totalScore: stationScore + chestScore,
    maxScore: C06_MAX_TOTAL_POINTS,
  };
}

// ---------------------------------------------------------------------------
// DEMO-ISOLATED SESSION PERSISTENCE
// ---------------------------------------------------------------------------
interface PersistedC06Payload {
  version: 1;
  savedAtMs: number;
  state: C06GameState;
}

export function saveC06Session(state: C06GameState, nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cleanStations = state.stations.map((s) => ({
      ...s,
      shardNewlyAwarded: false,
    }));
    const payload: PersistedC06Payload = {
      version: 1,
      savedAtMs: nowMs,
      state: { ...state, stations: cleanStations },
    };
    window.localStorage.setItem(getC06SessionStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadC06Session(): C06GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getC06SessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedC06Payload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.stations) ||
      parsed.state.stations.length !== C06_STATION_COUNT
    ) {
      clearC06Session();
      return null;
    }
    return {
      ...parsed.state,
      stations: parsed.state.stations.map((s) => ({ ...s, shardNewlyAwarded: false })),
    };
  } catch {
    clearC06Session();
    return null;
  }
}

export function clearC06Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getC06SessionStorageKey());
  } catch {
    // Ignore storage errors cleanly
  }
}
