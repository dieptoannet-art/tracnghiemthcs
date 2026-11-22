/**
 * D03 — KÉO CO KIẾN THỨC 3D (Tây Đô Smart EDU)
 * Pure deterministic game engine, sample question set ("Dữ liệu mẫu"),
 * Smart EDU question bank adapter with RBAC & stable-ID shuffling,
 * history-based recomputation, edit-last-result support, and demo-safe persistence.
 */

import { Question, QuestionType, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type TugMode = 'two_teams' | 'solo_practice';

export type TeamVerdict = 'ungraded' | 'correct' | 'incorrect' | 'no_answer';

export type MatchStatus =
  | 'playing'
  | 'win_a_target'
  | 'win_b_target'
  | 'win_a_position'
  | 'win_b_position'
  | 'draw'
  | 'solo_win'
  | 'solo_ended'
  | 'ended_early';

export type WinnerSide = 'A' | 'B' | 'draw' | 'solo' | null;

export type QuestionSourceKind = 'sample' | 'bank';

export interface TugQuestionOption {
  id: string; // Stable option ID (never relies on display array index)
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface TugTrueFalseItem {
  id: string;
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean;
}

export interface TugQuestionItem {
  id: string;
  code: string;
  type: QuestionType;
  stem: string;
  image?: string;
  subject: string;
  grade: string;
  level: string;
  options?: TugQuestionOption[];
  correctOptionId?: string;
  subItems?: TugTrueFalseItem[];
  acceptedAnswers?: string[];
  isNumericTolerance?: boolean;
  numericTolerance?: number;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
  requiresTeacherGrading: boolean;
}

export interface TugMatchConfig {
  mode: TugMode;
  teamAName: string;
  teamBName: string;
  soloName: string;
  sourceKind: QuestionSourceKind;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionCount: number;
  winTarget: number;
  timerSeconds: number; // 0 = không giới hạn, mặc định 30s
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  rulesLocked: boolean;
}

export interface TugTurnRecord {
  turnIndex: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  teamAVerdict: TeamVerdict;
  teamBVerdict: TeamVerdict;
  teamAAnswerNote?: string;
  teamBAnswerNote?: string;
  soloVerdict?: TeamVerdict;
  soloAnswerNote?: string;
  resultSource: 'teacher_single_device' | 'student_auto';
  ropeDelta: number; // -1 (về Đội A), 0 (giữ nguyên), +1 (về Đội B hoặc tiến lên Tự luyện)
  ropeAfter: number;
  committedAt: number;
  wasEdited?: boolean;
}

export interface TugMatchState {
  config: TugMatchConfig;
  questionOrder: TugQuestionItem[];
  history: TugTurnRecord[];
  currentQuestionIndex: number;
  ropePosition: number; // two_teams: [-winTarget..+winTarget], solo_practice: [0..winTarget]
  teamACorrect: number;
  teamBCorrect: number;
  soloCorrect: number;
  status: MatchStatus;
  winner: WinnerSide;
  endReasonLabel: string;
  endedEarly: boolean;
}

export interface TugTurnPreview {
  direction: 'move_a' | 'move_b' | 'stay' | 'solo_advance' | 'solo_stay';
  delta: number;
  label: string;
  detail: string;
}

export interface TugConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveQuestionCount: number;
  effectiveWinTarget: number;
}

export const D03_SAMPLE_PACK_TITLE = 'Kéo co Toán THCS – Số và hình';
export const D03_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D03_SESSION_STORAGE_KEY = 'taydo_d03_tug_of_war_session_v1';
export const D03_SESSION_VERSION = 1;

const OPTION_LABELS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

// ============================================================================
// SAMPLE QUESTION PACK (10 EXACT QUESTIONS — "Kéo co Toán THCS – Số và hình")
// ============================================================================

export const D03_SAMPLE_QUESTIONS: TugQuestionItem[] = [
  {
    id: 'd03_sample_01',
    code: 'D03-M01',
    type: 'single_choice',
    stem: 'Tính giá trị của phép tính: −8 + 13',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd03_s01_opt_1', label: 'A', text: '5' },
      { id: 'd03_s01_opt_2', label: 'B', text: '−5' },
      { id: 'd03_s01_opt_3', label: 'C', text: '21' },
      { id: 'd03_s01_opt_4', label: 'D', text: '−21' },
    ],
    correctOptionId: 'd03_s01_opt_1',
    acceptedAnswers: ['5', '+5'],
    officialAnswerText: '5',
    explanation: 'Cộng hai số nguyên khác dấu: lấy 13 − 8 = 5 và giữ dấu dương của số có giá trị tuyệt đối lớn hơn (13). Kết quả là 5.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_02',
    code: 'D03-M02',
    type: 'single_choice',
    stem: 'Tính giá trị của biểu thức: 6² − 11',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd03_s02_opt_1', label: 'A', text: '1' },
      { id: 'd03_s02_opt_2', label: 'B', text: '25' },
      { id: 'd03_s02_opt_3', label: 'C', text: '47' },
      { id: 'd03_s02_opt_4', label: 'D', text: '23' },
    ],
    correctOptionId: 'd03_s02_opt_2',
    acceptedAnswers: ['25'],
    officialAnswerText: '25',
    explanation: 'Tính lũy thừa trước: 6² = 6 × 6 = 36. Sau đó trừ 11: 36 − 11 = 25.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_03',
    code: 'D03-M03',
    type: 'single_choice',
    stem: 'Tính: 3/4 − 1/2',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd03_s03_opt_1', label: 'A', text: '1/2' },
      { id: 'd03_s03_opt_2', label: 'B', text: '2/4' },
      { id: 'd03_s03_opt_3', label: 'C', text: '1/4' },
      { id: 'd03_s03_opt_4', label: 'D', text: '1/8' },
    ],
    correctOptionId: 'd03_s03_opt_3',
    acceptedAnswers: ['1/4', '0.25', '0,25'],
    officialAnswerText: '1/4',
    explanation: 'Quy đồng mẫu số chung là 4: 1/2 = 2/4. Do đó 3/4 − 2/4 = 1/4.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_04',
    code: 'D03-M04',
    type: 'single_choice',
    stem: 'Tìm 2/3 của 24.',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd03_s04_opt_1', label: 'A', text: '12' },
      { id: 'd03_s04_opt_2', label: 'B', text: '16' },
      { id: 'd03_s04_opt_3', label: 'C', text: '18' },
      { id: 'd03_s04_opt_4', label: 'D', text: '36' },
    ],
    correctOptionId: 'd03_s04_opt_2',
    acceptedAnswers: ['16'],
    officialAnswerText: '16',
    explanation: 'Ta tính (2/3) × 24 = (2 × 24) / 3 = 48 / 3 = 16.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_05',
    code: 'D03-M05',
    type: 'single_choice',
    stem: 'Rút gọn tỉ số 15:25 thành tỉ số tối giản.',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd03_s05_opt_1', label: 'A', text: '3:5' },
      { id: 'd03_s05_opt_2', label: 'B', text: '5:3' },
      { id: 'd03_s05_opt_3', label: 'C', text: '3:4' },
      { id: 'd03_s05_opt_4', label: 'D', text: '1:5' },
    ],
    correctOptionId: 'd03_s05_opt_1',
    acceptedAnswers: ['3:5', '3 : 5', '3/5'],
    officialAnswerText: '3:5',
    explanation: 'Ước chung lớn nhất của 15 và 25 là 5. Chia cả hai số cho 5: (15 : 5) : (25 : 5) = 3:5.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_06',
    code: 'D03-M06',
    type: 'single_choice',
    stem: 'Tìm x, biết x + 7 = 19.',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd03_s06_opt_1', label: 'A', text: '11' },
      { id: 'd03_s06_opt_2', label: 'B', text: '12' },
      { id: 'd03_s06_opt_3', label: 'C', text: '13' },
      { id: 'd03_s06_opt_4', label: 'D', text: '26' },
    ],
    correctOptionId: 'd03_s06_opt_2',
    acceptedAnswers: ['12', 'x = 12', 'x=12'],
    officialAnswerText: '12',
    explanation: 'Chuyển +7 sang vế phải đổi dấu thành −7: x = 19 − 7 = 12.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_07',
    code: 'D03-M07',
    type: 'single_choice',
    stem: 'Hình chữ nhật dài 8 cm, rộng 5 cm có chu vi bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd03_s07_opt_1', label: 'A', text: '13 cm' },
      { id: 'd03_s07_opt_2', label: 'B', text: '26 cm' },
      { id: 'd03_s07_opt_3', label: 'C', text: '40 cm' },
      { id: 'd03_s07_opt_4', label: 'D', text: '24 cm' },
    ],
    correctOptionId: 'd03_s07_opt_2',
    acceptedAnswers: ['26 cm', '26cm', '26'],
    officialAnswerText: '26 cm',
    explanation: 'Chu vi hình chữ nhật P = 2 × (dài + rộng) = 2 × (8 + 5) = 2 × 13 = 26 cm.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_08',
    code: 'D03-M08',
    type: 'single_choice',
    stem: 'Hình tam giác có đáy 10 cm và chiều cao tương ứng 6 cm. Diện tích bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd03_s08_opt_1', label: 'A', text: '16 cm²' },
      { id: 'd03_s08_opt_2', label: 'B', text: '60 cm²' },
      { id: 'd03_s08_opt_3', label: 'C', text: '30 cm²' },
      { id: 'd03_s08_opt_4', label: 'D', text: '20 cm²' },
    ],
    correctOptionId: 'd03_s08_opt_3',
    acceptedAnswers: ['30 cm²', '30cm²', '30 cm2', '30cm2', '30'],
    officialAnswerText: '30 cm²',
    explanation: 'Diện tích tam giác S = (đáy × chiều cao) / 2 = (10 × 6) / 2 = 30 cm².',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_09',
    code: 'D03-M09',
    type: 'single_choice',
    stem: 'Trung bình cộng của 4, 7 và 10 là bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'know',
    options: [
      { id: 'd03_s09_opt_1', label: 'A', text: '6' },
      { id: 'd03_s09_opt_2', label: 'B', text: '7' },
      { id: 'd03_s09_opt_3', label: 'C', text: '8' },
      { id: 'd03_s09_opt_4', label: 'D', text: '21' },
    ],
    correctOptionId: 'd03_s09_opt_2',
    acceptedAnswers: ['7'],
    officialAnswerText: '7',
    explanation: 'Trung bình cộng = (4 + 7 + 10) / 3 = 21 / 3 = 7.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd03_sample_10',
    code: 'D03-M10',
    type: 'single_choice',
    stem: 'Một góc kề bù với góc 125° có số đo bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'apply',
    options: [
      { id: 'd03_s10_opt_1', label: 'A', text: '45°' },
      { id: 'd03_s10_opt_2', label: 'B', text: '65°' },
      { id: 'd03_s10_opt_3', label: 'C', text: '55°' },
      { id: 'd03_s10_opt_4', label: 'D', text: '35°' },
    ],
    correctOptionId: 'd03_s10_opt_3',
    acceptedAnswers: ['55°', '55', '55 độ'],
    officialAnswerText: '55°',
    explanation: 'Hai góc kề bù có tổng số đo bằng 180°. Vậy góc cần tìm bằng 180° − 125° = 55°.',
    isSample: true,
    sourceBadge: D03_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
];

// ============================================================================
// DEFAULT CONFIG & VALIDATION
// ============================================================================

export function createDefaultTugConfig(mode: TugMode = 'two_teams'): TugMatchConfig {
  return {
    mode,
    teamAName: 'Đội Xanh (Đội 1)',
    teamBName: 'Đội Cam (Đội 2)',
    soloName: 'Cả lớp / Học sinh tự luyện',
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionCount: mode === 'two_teams' ? 10 : 5,
    winTarget: 3,
    timerSeconds: 30,
    shuffleQuestions: false,
    shuffleOptions: true,
    rulesLocked: false,
  };
}

export function validateTugSetupConfig(
  config: TugMatchConfig,
  availableQuestionsCount: number
): TugConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (availableQuestionsCount <= 0) {
    errors.push('Nguồn câu hỏi hiện tại chưa có câu hỏi hợp lệ. Hãy đổi bộ câu hỏi hoặc dùng bộ Dữ liệu mẫu.');
  }

  if (config.mode === 'two_teams') {
    if (!config.teamAName.trim()) {
      errors.push('Vui lòng nhập tên cho Đội bên trái.');
    }
    if (!config.teamBName.trim()) {
      errors.push('Vui lòng nhập tên cho Đội bên phải.');
    }
    if (
      config.teamAName.trim() &&
      config.teamBName.trim() &&
      config.teamAName.trim().toLowerCase() === config.teamBName.trim().toLowerCase()
    ) {
      warnings.push('Hai đội đang trùng tên — nên đặt tên phân biệt rõ (ví dụ: Đội 1 và Đội 2).');
    }
  }

  const desiredCount = Math.max(1, Math.floor(config.questionCount || 1));
  const effectiveQuestionCount =
    availableQuestionsCount > 0 ? Math.min(desiredCount, availableQuestionsCount) : 0;

  if (availableQuestionsCount > 0 && desiredCount > availableQuestionsCount) {
    warnings.push(
      `Nguồn hiện chỉ có ${availableQuestionsCount} câu hợp lệ (ít hơn ${desiredCount} câu đã chọn). Trận đấu sẽ dùng tối đa ${effectiveQuestionCount} câu hoặc bạn có thể đổi nguồn.`
    );
  }

  const desiredTarget = Math.max(1, Math.floor(config.winTarget || 1));
  if (effectiveQuestionCount > 0 && desiredTarget > effectiveQuestionCount) {
    errors.push(
      `Mục tiêu thắng (${desiredTarget} vạch) không được lớn hơn số câu có thể chơi (${effectiveQuestionCount} câu).`
    );
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  const effectiveWinTarget =
    effectiveQuestionCount > 0 ? Math.min(desiredTarget, effectiveQuestionCount) : desiredTarget;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveQuestionCount,
    effectiveWinTarget,
  };
}

// ============================================================================
// QUESTION BANK ADAPTER (RBAC, SANITIZATION, STABLE-ID OPTION SHUFFLING)
// ============================================================================

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Shuffles single-choice options while preserving each option's stable `id`
 * and re-assigning display labels A/B/C/D. Correctness is NEVER tied to index.
 */
export function shuffleQuestionOptionsPreservingId(
  item: TugQuestionItem,
  rng: () => number = Math.random
): TugQuestionItem {
  if (item.type !== 'single_choice' || !item.options || item.options.length < 2) {
    return item;
  }
  const shuffled = shuffleArray(item.options, rng).map((opt, idx) => ({
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

export function isQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question) return false;
  if (question.status === 'deprecated') return false;
  // Students only ever see approved questions; teacher/admin/reviewer can see approved & pending (never deprecated)
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestion(question: Question): TugQuestionItem | null {
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const base = {
    id: String(question.id || '').trim() || `q_${Math.random().toString(36).slice(2, 9)}`,
    code: (question.code || 'NHCH').trim(),
    type: question.type,
    stem: cleanStem,
    image: question.image?.trim() || undefined,
    subject: String(question.subject || 'other'),
    grade: String(question.grade || '6'),
    level: String(question.level || 'understand'),
    explanation: (question.explanation || 'Giáo viên chốt kiến thức trọng tâm cho cả lớp.').trim(),
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
        (o, idx) =>
          (question.options?.[idx]?.label || '').toUpperCase() === rawCorrect.toUpperCase()
      );

    if (!matchedCorrect) return null;

    return {
      ...base,
      options: validOptions,
      correctOptionId: matchedCorrect.id,
      officialAnswerText: `${matchedCorrect.text}`,
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

    const summary = validSubItems
      .map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`)
      .join(' · ');

    return {
      ...base,
      subItems: validSubItems,
      officialAnswerText: summary,
      requiresTeacherGrading: false,
    };
  }

  if (question.type === 'short_answer') {
    const accepted = (question.acceptedAnswers || [])
      .map((a) => String(a || '').trim())
      .filter(Boolean);
    const official = accepted[0] || (question.sampleAnswer || '').trim() || 'Giáo viên đối chiếu đáp án';
    return {
      ...base,
      acceptedAnswers: accepted,
      isNumericTolerance: question.isNumericTolerance,
      numericTolerance: question.numericTolerance,
      officialAnswerText: official,
      requiresTeacherGrading: accepted.length === 0,
    };
  }

  // essay -> supported via teacher grading on single device
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

export function buildD03QuestionPool(params: {
  sourceKind: QuestionSourceKind;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): TugQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return D03_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: TugQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isQuestionAllowedForRole(raw, params.userRole)) continue;
    if (params.subjectFilter && params.subjectFilter !== 'all' && raw.subject !== params.subjectFilter) {
      continue;
    }
    if (params.gradeFilter && params.gradeFilter !== 'all' && String(raw.grade) !== params.gradeFilter) {
      continue;
    }
    if (params.levelFilter && params.levelFilter !== 'all' && raw.level !== params.levelFilter) {
      continue;
    }

    const item = adaptSmartEduQuestion(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

export function prepareMatchQuestions(
  pool: TugQuestionItem[],
  config: TugMatchConfig,
  rng: () => number = Math.random
): TugQuestionItem[] {
  const ordered = config.shuffleQuestions ? shuffleArray(pool, rng) : [...pool];
  const sliced = ordered.slice(0, Math.max(1, Math.min(config.questionCount, ordered.length)));
  return config.shuffleOptions
    ? sliced.map((q) => shuffleQuestionOptionsPreservingId(q, rng))
    : sliced.map((q) => ({
        ...q,
        options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      }));
}

// ============================================================================
// SOLO ANSWER EVALUATION HELPER
// ============================================================================

export function normalizeShortAnswer(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/°/g, '')
    .replace(/độ/g, '')
    .replace(/cm²/g, 'cm2');
}

export function evaluateSoloAnswer(
  question: TugQuestionItem,
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
    const allCorrect =
      allAnswered && question.subItems.every((s) => sel[s.id] === s.isCorrect);
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
    const normInput = normalizeShortAnswer(rawText);
    if (!normInput) {
      return { isCorrect: false, answerNote: 'Không trả lời' };
    }
    const exactHit = question.acceptedAnswers.some(
      (acc) => normalizeShortAnswer(acc) === normInput
    );
    if (exactHit) {
      return { isCorrect: true, answerNote: rawText };
    }
    if (question.isNumericTolerance) {
      const numVal = Number(normInput);
      const tol = question.numericTolerance ?? 0.01;
      if (Number.isFinite(numVal)) {
        const tolHit = question.acceptedAnswers.some((acc) => {
          const target = Number(normalizeShortAnswer(acc));
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
// CORE DETERMINISTIC TUG-OF-WAR SCORING & HISTORY RECOMPUTATION
// ============================================================================

export function computeTwoTeamDelta(
  teamA: TeamVerdict,
  teamB: TeamVerdict
): { delta: number; aIncrement: number; bIncrement: number } {
  const aRight = teamA === 'correct';
  const bRight = teamB === 'correct';

  if (aRight && !bRight) {
    return { delta: -1, aIncrement: 1, bIncrement: 0 };
  }
  if (!aRight && bRight) {
    return { delta: 1, aIncrement: 0, bIncrement: 1 };
  }
  if (aRight && bRight) {
    return { delta: 0, aIncrement: 1, bIncrement: 1 };
  }
  return { delta: 0, aIncrement: 0, bIncrement: 0 };
}

export function computeTurnPreview(params: {
  mode: TugMode;
  teamAName: string;
  teamBName: string;
  teamAVerdict: TeamVerdict;
  teamBVerdict: TeamVerdict;
  soloVerdict?: TeamVerdict;
}): TugTurnPreview {
  if (params.mode === 'solo_practice') {
    const right = params.soloVerdict === 'correct';
    return right
      ? {
          direction: 'solo_advance',
          delta: 1,
          label: 'Kéo tiến 1 vạch',
          detail: 'Trả lời đúng — dây kéo tiến thêm 1 vạch về vạch mục tiêu.',
        }
      : {
          direction: 'solo_stay',
          delta: 0,
          label: 'Dây giữ nguyên',
          detail: 'Chưa đúng — vị trí dây giữ nguyên, cùng xem lời giải và thử tiếp.',
        };
  }

  const { delta, aIncrement, bIncrement } = computeTwoTeamDelta(
    params.teamAVerdict,
    params.teamBVerdict
  );
  const nameA = params.teamAName.trim() || 'Đội A';
  const nameB = params.teamBName.trim() || 'Đội B';

  if (delta < 0) {
    return {
      direction: 'move_a',
      delta: -1,
      label: `Dây dịch về ${nameA}`,
      detail: `${nameA} trả lời đúng — dải ruy băng dịch 1 vạch sang trái.`,
    };
  }
  if (delta > 0) {
    return {
      direction: 'move_b',
      delta: 1,
      label: `Dây dịch về ${nameB}`,
      detail: `${nameB} trả lời đúng — dải ruy băng dịch 1 vạch sang phải.`,
    };
  }
  if (aIncrement === 1 && bIncrement === 1) {
    return {
      direction: 'stay',
      delta: 0,
      label: 'Dây giữ nguyên',
      detail: 'Cả hai đội đều đúng — dây giữ nguyên vị trí và cả hai đội đều được cộng 1 câu đúng.',
    };
  }
  return {
    direction: 'stay',
    delta: 0,
    label: 'Dây giữ nguyên',
    detail: 'Chưa có đội nào trả lời đúng — vị trí dây giữ nguyên.',
  };
}

/**
 * Pure source-of-truth reducer: recomputes ropePosition, teamACorrect, teamBCorrect,
 * soloCorrect, match status, winner, and end reason strictly from config + questionOrder + history.
 */
export function recomputeMatchFromHistory(params: {
  config: TugMatchConfig;
  questionOrder: TugQuestionItem[];
  history: TugTurnRecord[];
  currentQuestionIndex?: number;
  endedEarly?: boolean;
}): TugMatchState {
  const { config, questionOrder } = params;
  const target = Math.max(1, config.winTarget);
  const totalPlayable = questionOrder.length;

  let ropePosition = 0;
  let teamACorrect = 0;
  let teamBCorrect = 0;
  let soloCorrect = 0;

  const normalizedHistory: TugTurnRecord[] = [];
  let reachedTargetEarly = false;

  for (let i = 0; i < params.history.length; i++) {
    const raw = params.history[i];
    if (config.mode === 'two_teams') {
      const { delta, aIncrement, bIncrement } = computeTwoTeamDelta(
        raw.teamAVerdict,
        raw.teamBVerdict
      );
      teamACorrect += aIncrement;
      teamBCorrect += bIncrement;
      ropePosition = Math.max(-target, Math.min(target, ropePosition + delta));
      normalizedHistory.push({
        ...raw,
        turnIndex: i,
        ropeDelta: delta,
        ropeAfter: ropePosition,
      });
      if (ropePosition <= -target || ropePosition >= target) {
        reachedTargetEarly = true;
      }
    } else {
      const right = raw.soloVerdict === 'correct';
      const delta = right ? 1 : 0;
      if (right) soloCorrect += 1;
      ropePosition = Math.max(0, Math.min(target, ropePosition + delta));
      normalizedHistory.push({
        ...raw,
        turnIndex: i,
        ropeDelta: delta,
        ropeAfter: ropePosition,
      });
      if (ropePosition >= target) {
        reachedTargetEarly = true;
      }
    }
  }

  let status: MatchStatus = 'playing';
  let winner: WinnerSide = null;
  let endReasonLabel = 'Đang thi đấu';
  const endedEarly = Boolean(params.endedEarly);

  if (config.mode === 'two_teams') {
    if (ropePosition <= -target) {
      status = 'win_a_target';
      winner = 'A';
      endReasonLabel = 'Chạm vạch thắng';
    } else if (ropePosition >= target) {
      status = 'win_b_target';
      winner = 'B';
      endReasonLabel = 'Chạm vạch thắng';
    } else if (endedEarly) {
      status = 'ended_early';
      winner = null;
      endReasonLabel = 'Kết thúc sớm';
    } else if (normalizedHistory.length >= totalPlayable && totalPlayable > 0) {
      if (ropePosition < 0) {
        status = 'win_a_position';
        winner = 'A';
        endReasonLabel = 'Thắng theo vị trí cuối trận';
      } else if (ropePosition > 0) {
        status = 'win_b_position';
        winner = 'B';
        endReasonLabel = 'Thắng theo vị trí cuối trận';
      } else {
        status = 'draw';
        winner = 'draw';
        endReasonLabel = 'Hòa';
      }
    }
  } else {
    if (ropePosition >= target) {
      status = 'solo_win';
      winner = 'solo';
      endReasonLabel = 'Hoàn thành mục tiêu Tự luyện';
    } else if (endedEarly) {
      status = 'ended_early';
      winner = null;
      endReasonLabel = 'Kết thúc sớm';
    } else if (normalizedHistory.length >= totalPlayable && totalPlayable > 0) {
      status = 'solo_ended';
      winner = null;
      endReasonLabel = 'Hoàn thành lượt Tự luyện';
    }
  }

  const fallbackIndex = reachedTargetEarly
    ? Math.max(0, normalizedHistory.length - 1)
    : Math.min(Math.max(0, totalPlayable - 1), normalizedHistory.length);

  const safeCurrentIndex =
    typeof params.currentQuestionIndex === 'number'
      ? Math.max(0, Math.min(Math.max(0, totalPlayable - 1), params.currentQuestionIndex))
      : fallbackIndex;

  return {
    config: { ...config, rulesLocked: true },
    questionOrder,
    history: normalizedHistory,
    currentQuestionIndex: safeCurrentIndex,
    ropePosition,
    teamACorrect,
    teamBCorrect,
    soloCorrect,
    status,
    winner,
    endReasonLabel,
    endedEarly: status === 'ended_early',
  };
}

export function createInitialMatchState(
  config: TugMatchConfig,
  questionOrder: TugQuestionItem[]
): TugMatchState {
  const lockedConfig: TugMatchConfig = {
    ...config,
    questionCount: questionOrder.length,
    winTarget: Math.min(Math.max(1, config.winTarget), Math.max(1, questionOrder.length)),
    rulesLocked: true,
  };
  return recomputeMatchFromHistory({
    config: lockedConfig,
    questionOrder,
    history: [],
    currentQuestionIndex: 0,
    endedEarly: false,
  });
}

/**
 * Atomic idempotent turn commit: commits both teams simultaneously in one action.
 * Blocks duplicate commits for the same questionId (protects against double-clicks).
 */
export function commitTurnResult(
  state: TugMatchState,
  input: {
    question: TugQuestionItem;
    teamAVerdict: TeamVerdict;
    teamBVerdict: TeamVerdict;
    teamAAnswerNote?: string;
    teamBAnswerNote?: string;
    soloVerdict?: TeamVerdict;
    soloAnswerNote?: string;
    resultSource: 'teacher_single_device' | 'student_auto';
    committedAt?: number;
  }
): { state: TugMatchState; committed: boolean; reason?: string; record?: TugTurnRecord } {
  if (state.status !== 'playing') {
    return { state, committed: false, reason: 'match_already_finished' };
  }

  if (state.history.some((h) => h.questionId === input.question.id)) {
    return { state, committed: false, reason: 'duplicate_question_commit' };
  }

  if (state.config.mode === 'two_teams') {
    if (input.teamAVerdict === 'ungraded' || input.teamBVerdict === 'ungraded') {
      return { state, committed: false, reason: 'ungraded_team' };
    }
  } else {
    if (!input.soloVerdict || input.soloVerdict === 'ungraded') {
      return { state, committed: false, reason: 'ungraded_solo' };
    }
  }

  const newRecord: TugTurnRecord = {
    turnIndex: state.history.length,
    questionId: input.question.id,
    questionCode: input.question.code,
    questionStem: input.question.stem,
    officialAnswerText: input.question.officialAnswerText,
    explanation: input.question.explanation,
    teamAVerdict: input.teamAVerdict,
    teamBVerdict: input.teamBVerdict,
    teamAAnswerNote: input.teamAAnswerNote,
    teamBAnswerNote: input.teamBAnswerNote,
    soloVerdict: input.soloVerdict,
    soloAnswerNote: input.soloAnswerNote,
    resultSource: input.resultSource,
    ropeDelta: 0,
    ropeAfter: state.ropePosition,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextState = recomputeMatchFromHistory({
    config: state.config,
    questionOrder: state.questionOrder,
    history: [...state.history, newRecord],
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: false,
  });

  return {
    state: nextState,
    committed: true,
    record: nextState.history[nextState.history.length - 1],
  };
}

/**
 * Edits the most recently confirmed question result and cleanly recomputes
 * ropePosition, correct counts, and match status from the full history array.
 * If the match had just reached winTarget, editing it back cleanly restores 'playing'.
 */
export function editLastConfirmedTurn(
  state: TugMatchState,
  patch: {
    teamAVerdict?: TeamVerdict;
    teamBVerdict?: TeamVerdict;
    teamAAnswerNote?: string;
    teamBAnswerNote?: string;
    soloVerdict?: TeamVerdict;
    soloAnswerNote?: string;
  }
): { state: TugMatchState; edited: boolean; record?: TugTurnRecord } {
  if (state.history.length === 0) {
    return { state, edited: false };
  }

  const lastIndex = state.history.length - 1;
  const last = state.history[lastIndex];

  const nextTeamA = patch.teamAVerdict ?? last.teamAVerdict;
  const nextTeamB = patch.teamBVerdict ?? last.teamBVerdict;
  const nextSolo = patch.soloVerdict ?? last.soloVerdict;

  if (state.config.mode === 'two_teams' && (nextTeamA === 'ungraded' || nextTeamB === 'ungraded')) {
    return { state, edited: false };
  }
  if (state.config.mode === 'solo_practice' && (!nextSolo || nextSolo === 'ungraded')) {
    return { state, edited: false };
  }

  const updatedHistory = [...state.history];
  updatedHistory[lastIndex] = {
    ...last,
    teamAVerdict: nextTeamA,
    teamBVerdict: nextTeamB,
    teamAAnswerNote: patch.teamAAnswerNote ?? last.teamAAnswerNote,
    teamBAnswerNote: patch.teamBAnswerNote ?? last.teamBAnswerNote,
    soloVerdict: nextSolo,
    soloAnswerNote: patch.soloAnswerNote ?? last.soloAnswerNote,
    wasEdited: true,
    committedAt: Date.now(),
  };

  const nextState = recomputeMatchFromHistory({
    config: state.config,
    questionOrder: state.questionOrder,
    history: updatedHistory,
    currentQuestionIndex: lastIndex,
    endedEarly: false,
  });

  return {
    state: nextState,
    edited: true,
    record: nextState.history[lastIndex],
  };
}

export function endMatchEarly(state: TugMatchState): TugMatchState {
  if (state.status !== 'playing') return state;
  return recomputeMatchFromHistory({
    config: state.config,
    questionOrder: state.questionOrder,
    history: state.history,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: true,
  });
}

export function advanceToNextQuestion(state: TugMatchState): TugMatchState {
  if (state.status !== 'playing') return state;
  const nextIdx = Math.min(state.questionOrder.length - 1, state.history.length);
  return {
    ...state,
    currentQuestionIndex: nextIdx,
  };
}

// ============================================================================
// SESSION PERSISTENCE (ISOLATED IN /demo MODE & RESILIENT TO CORRUPT STORAGE)
// ============================================================================

interface StoredD03SessionPayload {
  version: number;
  config: TugMatchConfig;
  questionOrder: TugQuestionItem[];
  history: TugTurnRecord[];
  currentQuestionIndex: number;
  endedEarly: boolean;
  updatedAt: number;
}

export function getD03SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D03_SESSION_STORAGE_KEY}`
    : D03_SESSION_STORAGE_KEY;
}

export function saveD03Session(state: TugMatchState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredD03SessionPayload = {
      version: D03_SESSION_VERSION,
      config: state.config,
      questionOrder: state.questionOrder,
      history: state.history,
      currentQuestionIndex: state.currentQuestionIndex,
      endedEarly: state.endedEarly,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getD03SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function clearD03Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD03SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadD03Session(): {
  state: TugMatchState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getD03SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) {
    return { state: null, recoveredFromCorruption: false };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredD03SessionPayload>;
    if (
      !parsed ||
      parsed.version !== D03_SESSION_VERSION ||
      !parsed.config ||
      !Array.isArray(parsed.questionOrder) ||
      parsed.questionOrder.length === 0 ||
      !Array.isArray(parsed.history)
    ) {
      clearD03Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const modeValid =
      parsed.config.mode === 'two_teams' || parsed.config.mode === 'solo_practice';
    if (!modeValid) {
      clearD03Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const recomputed = recomputeMatchFromHistory({
      config: parsed.config,
      questionOrder: parsed.questionOrder,
      history: parsed.history,
      currentQuestionIndex:
        typeof parsed.currentQuestionIndex === 'number' ? parsed.currentQuestionIndex : undefined,
      endedEarly: Boolean(parsed.endedEarly),
    });

    return { state: recomputed, recoveredFromCorruption: false };
  } catch {
    clearD03Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
