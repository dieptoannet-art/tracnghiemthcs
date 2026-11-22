import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const B10_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const B10_DEFAULT_QUESTION_COUNT = 10;
export const B10_POINTS_PER_CORRECT = 10;
export const B10_DEFAULT_PER_QUESTION_SEC = 20;
export const B10_WHOLE_TURN_BUDGET_OPTIONS = [60, 90, 120] as const;
export type B10WholeTurnBudgetSec = (typeof B10_WHOLE_TURN_BUDGET_OPTIONS)[number];

export type B10ClockMode = 'per_question' | 'whole_turn';
export type B10ParticipationMode = 'solo_class' | 'teams_oral';
export type B10ExplanationTiming = 'after_question' | 'end_of_round';
export type B10QuestionSource = 'sample_pack' | 'bank';
export type B10GraphicsQuality = 'high' | '2d';

export type B10Phase =
  | 'setup'
  | 'question_ready' // Mở đề, chờ ảnh/công thức sẵn sàng trước khi bắt đầu đếm giờ
  | 'answering' // Tiếp nhận thao tác & đồng hồ đang đếm
  | 'paused' // Tạm dừng giữ nguyên phần dư thời gian
  | 'locked' // Đã chốt đáp án (trước hoặc ngay khi công bố)
  | 'revealed' // Công bố kết quả câu hiện tại
  | 'summary'; // Tổng kết ván

export type B10Outcome = 'correct' | 'wrong' | 'skipped' | 'timeout' | 'unseen';
export type B10FinishReason = 'completed_all' | 'stopped_on_budget' | 'ended_early' | null;

export interface B10OptionItem {
  optionId: string;
  labelKey: string; // Dynamic A/B/C/D display label after optional shuffle
  text: string;
}

export interface B10QuestionItem {
  id: string;
  sourceTag: 'Dữ liệu mẫu' | 'Ngân hàng Smart EDU';
  topicLabel: string;
  stem: string;
  image?: string;
  options: B10OptionItem[];
  correctOptionId: string;
  hintText: string;
  explanationText: string;
}

export interface B10TeamRosterItem {
  id: string;
  name: string;
  color: string;
  score: number;
  correctCount: number;
  studentNames: string[];
}

export interface B10QuestionRecord {
  questionId: string;
  index: number;
  topicLabel: string;
  stem: string;
  options: B10OptionItem[];
  correctOptionId: string;
  selectedOptionId: string | null;
  outcome: B10Outcome;
  pointsAwarded: number;
  hintUsed: boolean;
  elapsedMs: number;
  answeredByLabel: string | null;
  turnToken: string;
  hintText: string;
  explanationText: string;
}

export interface B10SetupConfig {
  clockMode: B10ClockMode;
  perQuestionSec: number; // default 20
  wholeTurnSec: B10WholeTurnBudgetSec; // 60 | 90 | 120
  participationMode: B10ParticipationMode;
  explanationTiming: B10ExplanationTiming;
  questionSource: B10QuestionSource;
  shuffleOptions: boolean;
  hintsEnabled: boolean;
  teamCount: number; // 2..6 when teams_oral
  teamNames: string[];
  classStudents: Array<{ id: string; fullName: string }>;
  selectedClassId: string;
  questionLimit: number; // default 10
}

export interface B10GameState {
  phase: B10Phase;
  config: B10SetupConfig;
  questions: B10QuestionItem[];
  records: B10QuestionRecord[];
  teams: B10TeamRosterItem[];
  activeTeamIndex: number;
  currentIndex: number;
  turnToken: string;
  mediaReady: boolean;
  questionStartedAtMs: number | null;
  questionDeadlineMs: number | null;
  turnDeadlineMs: number | null;
  pausedQuestionRemainingMs: number | null;
  pausedTurnRemainingMs: number | null;
  score: number;
  maxScore: number;
  streak: number;
  bestStreak: number;
  totalHintsUsed: number;
  activeHintRevealed: boolean;
  activeSelectedOptionId: string | null;
  activeTeamMarks: Record<string, string | null>; // teamId -> optionId in teams_oral if needed
  activeCallerStudent: { id: string; fullName: string } | null;
  calledStudentIds: string[];
  revealAnimDone: boolean;
  finishReason: B10FinishReason;
  lastUpdatedAtMs: number;
}

export interface B10SummaryStats {
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  timeoutCount: number;
  unseenCount: number;
  score: number;
  maxScore: number;
  accuracyPercent: number;
  totalHintsUsed: number;
}

const TEAM_PALETTE = ['#2563EB', '#EA580C', '#059669', '#D97706', '#7C3AED', '#DB2777'];
const DEFAULT_TEAM_NAMES = ['Đội Sao Mai', 'Đội Tia Chớp', 'Đội Tri Thức', 'Đội Phượng Hoàng', 'Đội Sóng Xanh', 'Đội Đỉnh Cao'];
const DISPLAY_OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;

export const B10_SESSION_BASE_KEY = 'taydo_b10_lightning_quiz_3d_session_v1';

export function getB10SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${B10_SESSION_BASE_KEY}`
    : B10_SESSION_BASE_KEY;
}

// ---------------------------------------------------------------------------
// 10-QUESTION STARTER PACK ("Dữ liệu mẫu")
// Includes required examples: \(3x = 12\) -> \(x = 4\) AND \(\sqrt{81} = 9\),
// plus fractions, negative integers, angles with ^\circ, exponents, linear fn.
// ---------------------------------------------------------------------------
export const B10_SAMPLE_QUESTIONS: B10QuestionItem[] = [
  {
    id: 'b10_sample_01',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Phương trình bậc nhất',
    stem: 'Tìm nghiệm của phương trình: \\(3x = 12\\).',
    options: [
      { optionId: 'b10_q1_opt_a', labelKey: 'A', text: '\\(x = 4\\)' },
      { optionId: 'b10_q1_opt_b', labelKey: 'B', text: '\\(x = 3\\)' },
      { optionId: 'b10_q1_opt_c', labelKey: 'C', text: '\\(x = 9\\)' },
      { optionId: 'b10_q1_opt_d', labelKey: 'D', text: '\\(x = 36\\)' },
    ],
    correctOptionId: 'b10_q1_opt_a',
    hintText: 'Chia cả hai vế của phương trình cho hệ số \\(3\\).',
    explanationText: 'Ta có \\(3x = 12 \\Rightarrow x = \\dfrac{12}{3} = 4\\).',
  },
  {
    id: 'b10_sample_02',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Căn bậc hai số học',
    stem: 'Tính giá trị của biểu thức: \\(\\sqrt{81}\\).',
    options: [
      { optionId: 'b10_q2_opt_a', labelKey: 'A', text: '\\(9\\)' },
      { optionId: 'b10_q2_opt_b', labelKey: 'B', text: '\\(8\\)' },
      { optionId: 'b10_q2_opt_c', labelKey: 'C', text: '\\(27\\)' },
      { optionId: 'b10_q2_opt_d', labelKey: 'D', text: '\\(-9\\)' },
    ],
    correctOptionId: 'b10_q2_opt_a',
    hintText: 'Tìm số không âm mà bình phương của nó bằng \\(81\\).',
    explanationText: 'Vì \\(9 > 0\\) và \\(9^2 = 81\\) nên căn bậc hai số học \\(\\sqrt{81} = 9\\).',
  },
  {
    id: 'b10_sample_03',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Phân số',
    stem: 'Tính tổng hai phân số: \\(\\dfrac{3}{4} + \\dfrac{5}{8}\\).',
    options: [
      { optionId: 'b10_q3_opt_a', labelKey: 'A', text: '\\(\\dfrac{11}{8}\\)' },
      { optionId: 'b10_q3_opt_b', labelKey: 'B', text: '\\(\\dfrac{8}{12}\\)' },
      { optionId: 'b10_q3_opt_c', labelKey: 'C', text: '\\(\\dfrac{7}{8}\\)' },
      { optionId: 'b10_q3_opt_d', labelKey: 'D', text: '\\(\\dfrac{15}{32}\\)' },
    ],
    correctOptionId: 'b10_q3_opt_a',
    hintText: 'Quy đồng mẫu chung là \\(8\\): \\(\\dfrac{3}{4} = \\dfrac{6}{8}\\).',
    explanationText: 'Ta có \\(\\dfrac{3}{4} + \\dfrac{5}{8} = \\dfrac{6}{8} + \\dfrac{5}{8} = \\dfrac{11}{8}\\).',
  },
  {
    id: 'b10_sample_04',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Số nguyên âm',
    stem: 'Thực hiện phép tính: \\((-15) + 8 - (-4)\\).',
    options: [
      { optionId: 'b10_q4_opt_a', labelKey: 'A', text: '\\(-3\\)' },
      { optionId: 'b10_q4_opt_b', labelKey: 'B', text: '\\(-11\\)' },
      { optionId: 'b10_q4_opt_c', labelKey: 'C', text: '\\(3\\)' },
      { optionId: 'b10_q4_opt_d', labelKey: 'D', text: '\\(-27\\)' },
    ],
    correctOptionId: 'b10_q4_opt_a',
    hintText: 'Nhớ quy tắc dấu ngoặc: \\(-(-4) = +4\\).',
    explanationText: 'Ta có \\((-15) + 8 + 4 = -7 + 4 = -3\\).',
  },
  {
    id: 'b10_sample_05',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Hình học phẳng',
    stem: 'Hai góc phụ nhau có tổng số đo bằng \\(90^\\circ\\). Biết một góc bằng \\(32^\\circ\\), góc còn lại bằng bao nhiêu?',
    options: [
      { optionId: 'b10_q5_opt_a', labelKey: 'A', text: '\\(58^\\circ\\)' },
      { optionId: 'b10_q5_opt_b', labelKey: 'B', text: '\\(148^\\circ\\)' },
      { optionId: 'b10_q5_opt_c', labelKey: 'C', text: '\\(48^\\circ\\)' },
      { optionId: 'b10_q5_opt_d', labelKey: 'D', text: '\\(68^\\circ\\)' },
    ],
    correctOptionId: 'b10_q5_opt_a',
    hintText: 'Lấy \\(90^\\circ\\) trừ đi số đo góc đã biết.',
    explanationText: 'Số đo góc còn lại là \\(90^\\circ - 32^\\circ = 58^\\circ\\).',
  },
  {
    id: 'b10_sample_06',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Lũy thừa',
    stem: 'Viết tích \\(2^3 \\cdot 2^4\\) dưới dạng một lũy thừa:',
    options: [
      { optionId: 'b10_q6_opt_a', labelKey: 'A', text: '\\(2^7\\)' },
      { optionId: 'b10_q6_opt_b', labelKey: 'B', text: '\\(2^{12}\\)' },
      { optionId: 'b10_q6_opt_c', labelKey: 'C', text: '\\(4^7\\)' },
      { optionId: 'b10_q6_opt_d', labelKey: 'D', text: '\\(4^{12}\\)' },
    ],
    correctOptionId: 'b10_q6_opt_a',
    hintText: 'Khi nhân hai lũy thừa cùng cơ số: \\(a^m \\cdot a^n = a^{m+n}\\).',
    explanationText: 'Áp dụng công thức nhân cùng cơ số: \\(2^3 \\cdot 2^4 = 2^{3+4} = 2^7\\).',
  },
  {
    id: 'b10_sample_07',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Định lí Pythagore',
    stem: 'Một hình chữ nhật có chiều dài \\(12\\text{ cm}\\) và chiều rộng \\(5\\text{ cm}\\). Độ dài đường chéo của hình chữ nhật đó là:',
    options: [
      { optionId: 'b10_q7_opt_a', labelKey: 'A', text: '\\(13\\text{ cm}\\)' },
      { optionId: 'b10_q7_opt_b', labelKey: 'B', text: '\\(17\\text{ cm}\\)' },
      { optionId: 'b10_q7_opt_c', labelKey: 'C', text: '\\(11\\text{ cm}\\)' },
      { optionId: 'b10_q7_opt_d', labelKey: 'D', text: '\\(15\\text{ cm}\\)' },
    ],
    correctOptionId: 'b10_q7_opt_a',
    hintText: 'Áp dụng định lí Pythagore cho tam giác vuông có hai cạnh góc vuông \\(12\\) và \\(5\\).',
    explanationText: 'Độ dài đường chéo là \\(\\sqrt{12^2 + 5^2} = \\sqrt{144 + 25} = \\sqrt{169} = 13\\text{ cm}\\).',
  },
  {
    id: 'b10_sample_08',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Tỉ số phần trăm',
    stem: 'Lớp 7A có \\(40\\) học sinh, trong đó có \\(30\\%\\) đạt danh hiệu học sinh giỏi. Số học sinh giỏi của lớp 7A là:',
    options: [
      { optionId: 'b10_q8_opt_a', labelKey: 'A', text: '\\(12\\)' },
      { optionId: 'b10_q8_opt_b', labelKey: 'B', text: '\\(10\\)' },
      { optionId: 'b10_q8_opt_c', labelKey: 'C', text: '\\(14\\)' },
      { optionId: 'b10_q8_opt_d', labelKey: 'D', text: '\\(16\\)' },
    ],
    correctOptionId: 'b10_q8_opt_a',
    hintText: 'Tính \\(40 \\cdot \\dfrac{30}{100}\\).',
    explanationText: 'Số học sinh giỏi là \\(40 \\cdot 30\\% = 40 \\cdot 0{,}3 = 12\\) học sinh.',
  },
  {
    id: 'b10_sample_09',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Thứ tự thực hiện phép tính',
    stem: 'Tính giá trị của biểu thức: \\(5^2 - 3 \\cdot 4\\).',
    options: [
      { optionId: 'b10_q9_opt_a', labelKey: 'A', text: '\\(13\\)' },
      { optionId: 'b10_q9_opt_b', labelKey: 'B', text: '\\(22\\)' },
      { optionId: 'b10_q9_opt_c', labelKey: 'C', text: '\\(19\\)' },
      { optionId: 'b10_q9_opt_d', labelKey: 'D', text: '\\(88\\)' },
    ],
    correctOptionId: 'b10_q9_opt_a',
    hintText: 'Tính lũy thừa trước, sau đó nhân rồi mới trừ.',
    explanationText: 'Ta có \\(5^2 - 3 \\cdot 4 = 25 - 12 = 13\\).',
  },
  {
    id: 'b10_sample_10',
    sourceTag: B10_SAMPLE_BADGE,
    topicLabel: 'Hàm số bậc nhất',
    stem: 'Cho hàm số \\(y = 2x - 3\\). Khi \\(x = 5\\), giá trị của \\(y\\) bằng bao nhiêu?',
    options: [
      { optionId: 'b10_q10_opt_a', labelKey: 'A', text: '\\(7\\)' },
      { optionId: 'b10_q10_opt_b', labelKey: 'B', text: '\\(13\\)' },
      { optionId: 'b10_q10_opt_c', labelKey: 'C', text: '\\(5\\)' },
      { optionId: 'b10_q10_opt_d', labelKey: 'D', text: '\\(10\\)' },
    ],
    correctOptionId: 'b10_q10_opt_a',
    hintText: 'Thay \\(x = 5\\) vào công thức \\(y = 2x - 3\\).',
    explanationText: 'Thay \\(x = 5\\): \\(y = 2 \\cdot 5 - 3 = 10 - 3 = 7\\).',
  },
];

// ---------------------------------------------------------------------------
// DETERMINISTIC / STABLE OPTION SHUFFLE (keeps optionId & correctOptionId intact)
// ---------------------------------------------------------------------------
export function hashStringSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleLightningOptions(
  question: B10QuestionItem,
  seedInput: string
): B10QuestionItem {
  const cloned = question.options.map((opt) => ({ ...opt }));
  let seed = hashStringSeed(`${question.id}:${seedInput}`) || 1337;
  for (let i = cloned.length - 1; i > 0; i--) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const tmp = cloned[i];
    cloned[i] = cloned[j];
    cloned[j] = tmp;
  }
  return {
    ...question,
    options: cloned.map((opt, idx) => ({
      optionId: opt.optionId,
      labelKey: DISPLAY_OPTION_KEYS[idx] || String(idx + 1),
      text: opt.text,
    })),
  };
}

// ---------------------------------------------------------------------------
// SMART EDU BANK ADAPTER (respects RBAC: student only approved; keeps sourceTag separate)
// ---------------------------------------------------------------------------
export function adaptBankQuestionsForB10(
  bankQuestions: Question[],
  userRole: UserRole,
  limit = B10_DEFAULT_QUESTION_COUNT
): B10QuestionItem[] {
  const allowed = bankQuestions.filter((q) => {
    if (userRole === 'student' && q.status !== 'approved') return false;
    return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
  });

  const adapted: B10QuestionItem[] = [];
  for (const q of allowed) {
    const rawOpts = (q.options || []).slice(0, 4);
    if (rawOpts.length < 2) continue;
    const targetAnswer = String(q.correctAnswer || '').trim();
    const correctIdx = rawOpts.findIndex(
      (opt) => opt.id === targetAnswer || opt.label === targetAnswer
    );
    if (correctIdx < 0 || correctIdx >= rawOpts.length) continue;

    const mappedOpts: B10OptionItem[] = rawOpts.map((opt, idx) => ({
      optionId: opt.id ? `bank_${q.id}_${opt.id}` : `bank_${q.id}_opt_${idx}`,
      labelKey: DISPLAY_OPTION_KEYS[idx] || String(idx + 1),
      text: String(opt.text || '').trim() || `Phương án ${DISPLAY_OPTION_KEYS[idx] || idx + 1}`,
    }));

    adapted.push({
      id: `bank_${q.id}`,
      sourceTag: 'Ngân hàng Smart EDU',
      topicLabel: q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi',
      stem: String(q.stem || '').trim(),
      image: q.image,
      options: mappedOpts,
      correctOptionId: mappedOpts[correctIdx].optionId,
      hintText: q.lesson ? `Gợi ý ôn tập: xem lại kiến thức "${q.lesson}".` : 'Đọc kỹ dữ kiện đề bài và thử kiểm tra lại phép tính.',
      explanationText:
        String(q.explanation || '').trim() ||
        `Đáp án đúng là ${mappedOpts[correctIdx].labelKey}: ${mappedOpts[correctIdx].text}.`,
    });
    if (adapted.length >= limit) break;
  }
  return adapted;
}

export function buildB10Teams(
  participationMode: B10ParticipationMode,
  teamCount: number,
  teamNames: string[] = [],
  classStudents: Array<{ id: string; fullName: string }> = []
): B10TeamRosterItem[] {
  if (participationMode === 'solo_class') {
    return [
      {
        id: 'team_solo',
        name: classStudents.length === 1 ? classStudents[0].fullName : 'Cả lớp / Cá nhân',
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
    name: (teamNames[idx] || '').trim() || DEFAULT_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    color: TEAM_PALETTE[idx % TEAM_PALETTE.length],
    score: 0,
    correctCount: 0,
    studentNames: buckets[idx],
  }));
}

export function createDefaultB10SetupConfig(
  overrides: Partial<B10SetupConfig> = {}
): B10SetupConfig {
  return {
    clockMode: 'per_question',
    perQuestionSec: B10_DEFAULT_PER_QUESTION_SEC,
    wholeTurnSec: 90,
    participationMode: 'solo_class',
    explanationTiming: 'after_question',
    questionSource: 'sample_pack',
    shuffleOptions: true,
    hintsEnabled: true,
    teamCount: 2,
    teamNames: DEFAULT_TEAM_NAMES.slice(0, 6),
    classStudents: [],
    selectedClassId: '',
    questionLimit: B10_DEFAULT_QUESTION_COUNT,
    ...overrides,
  };
}

export function createB10SetupState(configOverrides: Partial<B10SetupConfig> = {}): B10GameState {
  const config = createDefaultB10SetupConfig(configOverrides);
  return {
    phase: 'setup',
    config,
    questions: [],
    records: [],
    teams: buildB10Teams(config.participationMode, config.teamCount, config.teamNames, config.classStudents),
    activeTeamIndex: 0,
    currentIndex: 0,
    turnToken: 'setup',
    mediaReady: false,
    questionStartedAtMs: null,
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    pausedQuestionRemainingMs: null,
    pausedTurnRemainingMs: null,
    score: 0,
    maxScore: B10_DEFAULT_QUESTION_COUNT * B10_POINTS_PER_CORRECT,
    streak: 0,
    bestStreak: 0,
    totalHintsUsed: 0,
    activeHintRevealed: false,
    activeSelectedOptionId: null,
    activeTeamMarks: {},
    activeCallerStudent: null,
    calledStudentIds: [],
    revealAnimDone: false,
    finishReason: null,
    lastUpdatedAtMs: Date.now(),
  };
}

function makeTurnToken(index: number, nowMs: number): string {
  return `b10_q${index}_${nowMs}`;
}

export function startB10Session(params: {
  config: B10SetupConfig;
  bankQuestions?: Question[];
  userRole?: UserRole;
  nowMs?: number;
  shuffleSeed?: string;
}): { ok: boolean; error?: string; state?: B10GameState } {
  const nowMs = params.nowMs ?? Date.now();
  const limit = Math.max(1, Math.min(20, params.config.questionLimit || B10_DEFAULT_QUESTION_COUNT));

  let rawQuestions: B10QuestionItem[];
  if (params.config.questionSource === 'bank') {
    rawQuestions = adaptBankQuestionsForB10(
      params.bankQuestions || [],
      params.userRole || 'teacher',
      limit
    );
    if (rawQuestions.length === 0) {
      return {
        ok: false,
        error: 'Ngân hàng câu hỏi chưa có câu trắc nghiệm phù hợp để mở lượt thi. Hãy chọn "Bộ đề mẫu B10 (10 câu)" hoặc thêm câu hỏi trắc nghiệm vào ngân hàng.',
      };
    }
  } else {
    rawQuestions = B10_SAMPLE_QUESTIONS.slice(0, limit);
  }

  const seed = params.shuffleSeed ?? String(nowMs);
  const questions = params.config.shuffleOptions
    ? rawQuestions.map((q) => shuffleLightningOptions(q, seed))
    : rawQuestions.map((q) => ({
        ...q,
        options: q.options.map((opt, idx) => ({
          ...opt,
          labelKey: DISPLAY_OPTION_KEYS[idx] || String(idx + 1),
        })),
      }));

  const teams = buildB10Teams(
    params.config.participationMode,
    params.config.teamCount,
    params.config.teamNames,
    params.config.classStudents
  );

  const records: B10QuestionRecord[] = questions.map((q, idx) => ({
    questionId: q.id,
    index: idx,
    topicLabel: q.topicLabel,
    stem: q.stem,
    options: q.options,
    correctOptionId: q.correctOptionId,
    selectedOptionId: null,
    outcome: 'unseen',
    pointsAwarded: 0,
    hintUsed: false,
    elapsedMs: 0,
    answeredByLabel: null,
    turnToken: makeTurnToken(idx, nowMs),
    hintText: q.hintText,
    explanationText: q.explanationText,
  }));

  const firstCaller =
    params.config.classStudents.length > 0 ? params.config.classStudents[0] : null;

  const state: B10GameState = {
    phase: 'question_ready',
    config: { ...params.config },
    questions,
    records,
    teams,
    activeTeamIndex: 0,
    currentIndex: 0,
    turnToken: records[0].turnToken,
    mediaReady: false,
    questionStartedAtMs: null,
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    pausedQuestionRemainingMs: null,
    pausedTurnRemainingMs:
      params.config.clockMode === 'whole_turn' ? params.config.wholeTurnSec * 1000 : null,
    score: 0,
    maxScore: questions.length * B10_POINTS_PER_CORRECT,
    streak: 0,
    bestStreak: 0,
    totalHintsUsed: 0,
    activeHintRevealed: false,
    activeSelectedOptionId: null,
    activeTeamMarks: {},
    activeCallerStudent: firstCaller,
    calledStudentIds: firstCaller ? [firstCaller.id] : [],
    revealAnimDone: false,
    finishReason: null,
    lastUpdatedAtMs: nowMs,
  };

  return { ok: true, state };
}

/**
 * Starts the countdown ONLY after question text/media has mounted & become ready (`mediaReady`).
 */
export function markB10MediaReady(state: B10GameState, nowMs = Date.now()): B10GameState {
  if (state.phase !== 'question_ready') return state;
  const perQuestionMs = Math.max(5, state.config.perQuestionSec || B10_DEFAULT_PER_QUESTION_SEC) * 1000;
  let turnDeadlineMs = state.turnDeadlineMs;
  let pausedTurnRemainingMs = state.pausedTurnRemainingMs;

  if (state.config.clockMode === 'whole_turn') {
    const budgetRemaining =
      pausedTurnRemainingMs !== null
        ? pausedTurnRemainingMs
        : state.config.wholeTurnSec * 1000;
    turnDeadlineMs = nowMs + Math.max(0, budgetRemaining);
    pausedTurnRemainingMs = null;
  }

  return {
    ...state,
    phase: 'answering',
    mediaReady: true,
    questionStartedAtMs: nowMs,
    questionDeadlineMs: state.config.clockMode === 'per_question' ? nowMs + perQuestionMs : null,
    turnDeadlineMs,
    pausedQuestionRemainingMs: null,
    pausedTurnRemainingMs,
    lastUpdatedAtMs: nowMs,
  };
}

export function getB10RemainingQuestionMs(state: B10GameState, nowMs = Date.now()): number | null {
  if (state.config.clockMode !== 'per_question') return null;
  if (state.phase === 'question_ready') {
    return Math.max(5, state.config.perQuestionSec) * 1000;
  }
  if (state.phase === 'paused' && state.pausedQuestionRemainingMs !== null) {
    return Math.max(0, state.pausedQuestionRemainingMs);
  }
  if (state.questionDeadlineMs === null) return null;
  return Math.max(0, state.questionDeadlineMs - nowMs);
}

export function getB10RemainingTurnMs(state: B10GameState, nowMs = Date.now()): number | null {
  if (state.config.clockMode !== 'whole_turn') return null;
  if (state.pausedTurnRemainingMs !== null) {
    return Math.max(0, state.pausedTurnRemainingMs);
  }
  if (state.turnDeadlineMs !== null) {
    return Math.max(0, state.turnDeadlineMs - nowMs);
  }
  return state.config.wholeTurnSec * 1000;
}

export function getB10ActiveRemainingMs(state: B10GameState, nowMs = Date.now()): number {
  if (state.config.clockMode === 'whole_turn') {
    return getB10RemainingTurnMs(state, nowMs) ?? 0;
  }
  return getB10RemainingQuestionMs(state, nowMs) ?? 0;
}

/**
 * Pause stores exact remaining ms so background tabs or pause duration never grant extra time.
 */
export function pauseB10Session(state: B10GameState, nowMs = Date.now()): B10GameState {
  if (state.phase !== 'answering') return state;
  const qRem =
    state.config.clockMode === 'per_question' && state.questionDeadlineMs !== null
      ? Math.max(0, state.questionDeadlineMs - nowMs)
      : null;
  const tRem =
    state.config.clockMode === 'whole_turn' && state.turnDeadlineMs !== null
      ? Math.max(0, state.turnDeadlineMs - nowMs)
      : null;

  return {
    ...state,
    phase: 'paused',
    pausedQuestionRemainingMs: qRem,
    pausedTurnRemainingMs: tRem,
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    lastUpdatedAtMs: nowMs,
  };
}

export function resumeB10Session(state: B10GameState, nowMs = Date.now()): B10GameState {
  if (state.phase !== 'paused') return state;
  if (state.config.clockMode === 'whole_turn') {
    const rem = Math.max(0, state.pausedTurnRemainingMs ?? 0);
    if (rem <= 0) {
      return adjudicateB10Deadline(
        { ...state, turnDeadlineMs: nowMs, pausedTurnRemainingMs: null },
        nowMs
      );
    }
    return {
      ...state,
      phase: 'answering',
      questionStartedAtMs: nowMs,
      turnDeadlineMs: nowMs + rem,
      pausedTurnRemainingMs: null,
      lastUpdatedAtMs: nowMs,
    };
  }

  const qRem = Math.max(0, state.pausedQuestionRemainingMs ?? 0);
  if (qRem <= 0) {
    return adjudicateB10Deadline(
      { ...state, questionDeadlineMs: nowMs, pausedQuestionRemainingMs: null },
      nowMs
    );
  }
  return {
    ...state,
    phase: 'answering',
    questionStartedAtMs: nowMs,
    questionDeadlineMs: nowMs + qRem,
    pausedQuestionRemainingMs: null,
    lastUpdatedAtMs: nowMs,
  };
}

export function revealB10Hint(state: B10GameState): B10GameState {
  if (
    !state.config.hintsEnabled ||
    state.activeHintRevealed ||
    (state.phase !== 'answering' && state.phase !== 'paused')
  ) {
    return state;
  }
  return {
    ...state,
    activeHintRevealed: true,
    totalHintsUsed: state.totalHintsUsed + 1,
  };
}

export function pickNextB10Student(state: B10GameState): B10GameState {
  const pool = state.config.classStudents;
  if (pool.length === 0) return state;
  const uncalled = pool.filter((s) => !state.calledStudentIds.includes(s.id));
  const nextPool = uncalled.length > 0 ? uncalled : pool;
  const seed = hashStringSeed(`${state.turnToken}:${state.calledStudentIds.length}`);
  const picked = nextPool[seed % nextPool.length];
  const updatedCalled =
    uncalled.length > 0 ? [...state.calledStudentIds, picked.id] : [picked.id];
  return {
    ...state,
    activeCallerStudent: picked,
    calledStudentIds: updatedCalled,
  };
}

function finalizeQuestionOutcome(params: {
  state: B10GameState;
  outcome: Exclude<B10Outcome, 'unseen'>;
  selectedOptionId: string | null;
  nowMs: number;
  teamIdOverride?: string | null;
}): B10GameState {
  const { state, outcome, selectedOptionId, nowMs, teamIdOverride } = params;
  const activeQuestion = state.questions[state.currentIndex];
  if (!activeQuestion) return state;

  const isCorrect = outcome === 'correct';
  const pointsAwarded = isCorrect ? B10_POINTS_PER_CORRECT : 0;
  const elapsedMs =
    state.questionStartedAtMs !== null ? Math.max(0, nowMs - state.questionStartedAtMs) : 0;

  // Freeze turn remaining budget while viewing reveal/explanation in whole_turn mode!
  let frozenTurnRemaining = state.pausedTurnRemainingMs;
  if (state.config.clockMode === 'whole_turn' && state.turnDeadlineMs !== null) {
    frozenTurnRemaining = Math.max(0, state.turnDeadlineMs - nowMs);
  }

  let activeTeamIdx = state.activeTeamIndex;
  if (teamIdOverride) {
    const foundIdx = state.teams.findIndex((t) => t.id === teamIdOverride);
    if (foundIdx >= 0) activeTeamIdx = foundIdx;
  }
  const activeTeam = state.teams[activeTeamIdx];

  const answeredByLabel =
    state.config.participationMode === 'teams_oral'
      ? [activeTeam?.name, state.activeCallerStudent?.fullName].filter(Boolean).join(' · ') || null
      : state.activeCallerStudent?.fullName || null;

  const updatedTeams = state.teams.map((t, idx) => {
    if (idx !== activeTeamIdx || !isCorrect) return t;
    return {
      ...t,
      score: t.score + pointsAwarded,
      correctCount: t.correctCount + 1,
    };
  });

  const updatedRecords = state.records.map((rec, idx) => {
    if (idx !== state.currentIndex) return rec;
    return {
      ...rec,
      selectedOptionId,
      outcome,
      pointsAwarded,
      hintUsed: state.activeHintRevealed,
      elapsedMs,
      answeredByLabel,
      turnToken: state.turnToken,
    };
  });

  const newStreak = isCorrect ? state.streak + 1 : 0;
  const bestStreak = Math.max(state.bestStreak, newStreak);

  // If whole-turn budget hit 0 at exact lock boundary or timeout, stop immediately!
  if (
    state.config.clockMode === 'whole_turn' &&
    frozenTurnRemaining !== null &&
    frozenTurnRemaining <= 0 &&
    outcome === 'timeout'
  ) {
    return {
      ...state,
      phase: 'summary',
      records: updatedRecords,
      teams: updatedTeams,
      score: state.score + pointsAwarded,
      streak: newStreak,
      bestStreak,
      activeSelectedOptionId: selectedOptionId,
      pausedTurnRemainingMs: 0,
      turnDeadlineMs: null,
      questionDeadlineMs: null,
      finishReason: 'stopped_on_budget',
      revealAnimDone: true,
      lastUpdatedAtMs: nowMs,
    };
  }

  return {
    ...state,
    phase: 'revealed',
    records: updatedRecords,
    teams: updatedTeams,
    score: state.score + pointsAwarded,
    streak: newStreak,
    bestStreak,
    activeSelectedOptionId: selectedOptionId,
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    pausedTurnRemainingMs: frozenTurnRemaining,
    revealAnimDone: state.config.explanationTiming === 'end_of_round',
    lastUpdatedAtMs: nowMs,
  };
}

/**
 * Lock an answer strictly by stable `optionId` (NEVER array index).
 * Prevents duplicate rapid clicks via `turnToken` + `phase === 'answering'` guard,
 * and checks deadline boundary synchronously so a click after expiry never scores!
 */
export function lockB10Option(params: {
  state: B10GameState;
  optionId: string;
  turnToken: string;
  nowMs?: number;
  teamIdOverride?: string | null;
}): B10GameState {
  const nowMs = params.nowMs ?? Date.now();
  const { state, optionId, turnToken } = params;
  if (state.phase !== 'answering') return state;
  if (turnToken !== state.turnToken) return state;

  // Enforce exact wall-clock deadline right at click boundary
  if (
    state.config.clockMode === 'per_question' &&
    state.questionDeadlineMs !== null &&
    nowMs > state.questionDeadlineMs
  ) {
    return adjudicateB10Deadline(state, nowMs);
  }
  if (
    state.config.clockMode === 'whole_turn' &&
    state.turnDeadlineMs !== null &&
    nowMs > state.turnDeadlineMs
  ) {
    return adjudicateB10Deadline(state, nowMs);
  }

  const activeQuestion = state.questions[state.currentIndex];
  if (!activeQuestion) return state;
  const chosen = activeQuestion.options.find((opt) => opt.optionId === optionId);
  if (!chosen) return state;

  const isCorrect = chosen.optionId === activeQuestion.correctOptionId;
  return finalizeQuestionOutcome({
    state,
    outcome: isCorrect ? 'correct' : 'wrong',
    selectedOptionId: chosen.optionId,
    nowMs,
    teamIdOverride: params.teamIdOverride,
  });
}

/**
 * Skip current question explicitly -> tracked distinctly as 'skipped' (0 pts).
 */
export function skipB10Question(
  state: B10GameState,
  turnToken: string,
  nowMs = Date.now()
): B10GameState {
  if (state.phase !== 'answering' && state.phase !== 'paused') return state;
  if (turnToken !== state.turnToken) return state;
  return finalizeQuestionOutcome({
    state,
    outcome: 'skipped',
    selectedOptionId: null,
    nowMs,
  });
}

/**
 * Adjudicate deadline if clock reached or passed deadline (including after tab switch).
 */
export function adjudicateB10Deadline(
  state: B10GameState,
  nowMs = Date.now()
): B10GameState {
  if (state.phase !== 'answering') return state;

  if (state.config.clockMode === 'per_question') {
    if (state.questionDeadlineMs !== null && nowMs >= state.questionDeadlineMs) {
      return finalizeQuestionOutcome({
        state,
        outcome: 'timeout',
        selectedOptionId: null,
        nowMs,
      });
    }
    return state;
  }

  // Whole-turn mode: if whole turn budget expired, mark current question timeout & stop immediately!
  if (state.turnDeadlineMs !== null && nowMs >= state.turnDeadlineMs) {
    const afterTimeout = finalizeQuestionOutcome({
      state,
      outcome: 'timeout',
      selectedOptionId: null,
      nowMs,
    });
    return {
      ...afterTimeout,
      phase: 'summary',
      finishReason: 'stopped_on_budget',
      pausedTurnRemainingMs: 0,
      turnDeadlineMs: null,
      revealAnimDone: true,
    };
  }
  return state;
}

/**
 * "Bỏ qua hoạt ảnh" during revealed phase: skips remaining animation cleanly
 * while preserving the locked outcome and score.
 */
export function skipB10RevealAnimation(state: B10GameState): B10GameState {
  if (state.phase !== 'revealed') return state;
  return {
    ...state,
    revealAnimDone: true,
  };
}

/**
 * Advance to next question or finish into summary.
 * In whole_turn mode, if remaining turn budget <= 0, stops immediately & marks rest unseen.
 */
export function advanceB10Question(state: B10GameState, nowMs = Date.now()): B10GameState {
  if (state.phase !== 'revealed' && state.phase !== 'locked') return state;

  if (
    state.config.clockMode === 'whole_turn' &&
    (state.pausedTurnRemainingMs ?? 0) <= 0
  ) {
    return {
      ...state,
      phase: 'summary',
      finishReason: 'stopped_on_budget',
      turnDeadlineMs: null,
      questionDeadlineMs: null,
      lastUpdatedAtMs: nowMs,
    };
  }

  const nextIndex = state.currentIndex + 1;
  if (nextIndex >= state.questions.length) {
    return {
      ...state,
      phase: 'summary',
      finishReason: 'completed_all',
      turnDeadlineMs: null,
      questionDeadlineMs: null,
      lastUpdatedAtMs: nowMs,
    };
  }

  const nextTurnToken = makeTurnToken(nextIndex, nowMs);
  const nextTeamIdx =
    state.config.participationMode === 'teams_oral' && state.teams.length > 0
      ? (state.activeTeamIndex + 1) % state.teams.length
      : state.activeTeamIndex;

  const updatedRecords = state.records.map((rec, idx) =>
    idx === nextIndex ? { ...rec, turnToken: nextTurnToken } : rec
  );

  let nextCaller = state.activeCallerStudent;
  let nextCalledIds = state.calledStudentIds;
  if (state.config.classStudents.length > 0) {
    const pool = state.config.classStudents;
    const uncalled = pool.filter((s) => !state.calledStudentIds.includes(s.id));
    const pickFrom = uncalled.length > 0 ? uncalled : pool;
    const picked = pickFrom[nextIndex % pickFrom.length];
    nextCaller = picked;
    nextCalledIds = uncalled.length > 0 ? [...state.calledStudentIds, picked.id] : [picked.id];
  }

  return {
    ...state,
    phase: 'question_ready',
    currentIndex: nextIndex,
    activeTeamIndex: nextTeamIdx,
    turnToken: nextTurnToken,
    records: updatedRecords,
    mediaReady: false,
    questionStartedAtMs: null,
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    pausedQuestionRemainingMs: null,
    activeHintRevealed: false,
    activeSelectedOptionId: null,
    activeTeamMarks: {},
    activeCallerStudent: nextCaller,
    calledStudentIds: nextCalledIds,
    revealAnimDone: false,
    lastUpdatedAtMs: nowMs,
  };
}

export function endB10Early(state: B10GameState, nowMs = Date.now()): B10GameState {
  if (state.phase === 'setup' || state.phase === 'summary') return state;
  return {
    ...state,
    phase: 'summary',
    finishReason: 'ended_early',
    questionDeadlineMs: null,
    turnDeadlineMs: null,
    pausedQuestionRemainingMs: null,
    pausedTurnRemainingMs: null,
    revealAnimDone: true,
    lastUpdatedAtMs: nowMs,
  };
}

export function computeB10Summary(state: B10GameState): B10SummaryStats {
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let timeoutCount = 0;
  let unseenCount = 0;

  for (const rec of state.records) {
    switch (rec.outcome) {
      case 'correct':
        correctCount += 1;
        break;
      case 'wrong':
        wrongCount += 1;
        break;
      case 'skipped':
        skippedCount += 1;
        break;
      case 'timeout':
        timeoutCount += 1;
        break;
      case 'unseen':
      default:
        unseenCount += 1;
        break;
    }
  }

  const totalQuestions = state.records.length;
  const answeredCount = totalQuestions - unseenCount;
  const accuracyPercent =
    totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  return {
    totalQuestions,
    answeredCount,
    correctCount,
    wrongCount,
    skippedCount,
    timeoutCount,
    unseenCount,
    score: state.score,
    maxScore: state.maxScore,
    accuracyPercent,
    totalHintsUsed: state.totalHintsUsed,
  };
}

// ---------------------------------------------------------------------------
// DEMO-ISOLATED SESSION PERSISTENCE
// ---------------------------------------------------------------------------
interface PersistedB10Payload {
  version: 1;
  savedAtMs: number;
  state: B10GameState;
}

export function saveB10Session(state: B10GameState, nowMs = Date.now()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Save clean paused-equivalent remaining ms if active so restore does not lose time
    let snapshot = state;
    if (state.phase === 'answering') {
      snapshot = {
        ...state,
        pausedQuestionRemainingMs:
          state.config.clockMode === 'per_question' && state.questionDeadlineMs !== null
            ? Math.max(0, state.questionDeadlineMs - nowMs)
            : state.pausedQuestionRemainingMs,
        pausedTurnRemainingMs:
          state.config.clockMode === 'whole_turn' && state.turnDeadlineMs !== null
            ? Math.max(0, state.turnDeadlineMs - nowMs)
            : state.pausedTurnRemainingMs,
      };
    }
    const payload: PersistedB10Payload = {
      version: 1,
      savedAtMs: nowMs,
      state: snapshot,
    };
    window.localStorage.setItem(getB10SessionStorageKey(), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadB10Session(nowMs = Date.now()): B10GameState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(getB10SessionStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedB10Payload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !Array.isArray(parsed.state.questions) ||
      !Array.isArray(parsed.state.records)
    ) {
      clearB10Session();
      return null;
    }
    const loaded = parsed.state;
    // Restore answering state safely without replaying past sound cues: pause briefly or rebase deadlines
    if (loaded.phase === 'answering') {
      return {
        ...loaded,
        phase: 'paused',
        questionDeadlineMs: null,
        turnDeadlineMs: null,
        lastUpdatedAtMs: nowMs,
      };
    }
    return loaded;
  } catch {
    clearB10Session();
    return null;
  }
}

export function clearB10Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getB10SessionStorageKey());
  } catch {
    // Ignore storage errors cleanly
  }
}
