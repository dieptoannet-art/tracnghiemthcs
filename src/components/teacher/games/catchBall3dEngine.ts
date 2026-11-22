/**
 * E02 — BẮT BÓNG KIẾN THỨC 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine supporting:
 * - 3 participant modes:
 *   1. 'solo_practice' (1 student): pick ball A–D (changeable before confirming) -> "Bắt bóng" -> score & explanation
 *   2. 'whole_class' (1–50 students, 1 shared class answer): teacher selects representative ball A–D or 'no_answer'
 *   3. 'teams' (2–6 teams): teacher records A/B/C/D or 'no_answer' for every team; strictly blocks 'ungraded'
 * - Scoring: +10 correct, 0 incorrect/no_answer; 8 questions = max 80 points; no speed bonus, no skip penalty; ties => Đồng hạng
 * - Stable option IDs so shuffling options keeps 3D balls, flat option cards, keyboard shortcuts, and grading 100% synchronized
 * - 8-question sample pack "Bắt bóng kiến thức – Toán THCS" ("Dữ liệu mẫu") with all 8 mandatory prompt cases verbatim
 * - Smart EDU RBAC question bank adapter, Edit Last Turn recomputation, and /demo-isolated session persistence
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type CatchBallParticipantMode = 'solo_practice' | 'whole_class' | 'teams';
export type CatchOptionLetter = 'A' | 'B' | 'C' | 'D';
export type CatchTeamChoice = 'ungraded' | CatchOptionLetter | 'no_answer';
export type CatchQuestionSource = 'sample' | 'bank';
export type CatchSessionStatus = 'playing' | 'finished';

export const CATCH_OPTION_LETTERS: CatchOptionLetter[] = ['A', 'B', 'C', 'D'];
export const E02_POINTS_CORRECT = 10;
export const E02_POINTS_INCORRECT = 0;

export const E02_SAMPLE_PACK_TITLE = 'Bắt bóng kiến thức – Toán THCS';
export const E02_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const E02_SESSION_STORAGE_KEY = 'taydo_e02_catch_ball_session_v1';
export const E02_SESSION_VERSION = 1;

export interface CatchBallVisualTheme {
  letter: CatchOptionLetter;
  primaryHex: string;
  seamHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  labelName: string;
}

/**
 * Uniform athletic palette across A–D (navy, emerald teal, golden yellow, crisp pearl-slate).
 * Strictly visual slot identity — NEVER hints which option is correct before reveal.
 */
export const E02_BALL_SLOT_THEMES: Record<CatchOptionLetter, CatchBallVisualTheme> = {
  A: {
    letter: 'A',
    primaryHex: '#1E3A8A', // Deep Navy
    seamHex: '#EAB308',
    badgeBgClass: 'bg-[#1E3A8A]',
    badgeTextClass: 'text-white',
    labelName: 'Bóng A',
  },
  B: {
    letter: 'B',
    primaryHex: '#0D9488', // Emerald Teal
    seamHex: '#F8FAFC',
    badgeBgClass: 'bg-teal-600',
    badgeTextClass: 'text-white',
    labelName: 'Bóng B',
  },
  C: {
    letter: 'C',
    primaryHex: '#D97706', // Warm Athletic Gold-Amber
    seamHex: '#0F172A',
    badgeBgClass: 'bg-amber-500',
    badgeTextClass: 'text-slate-950',
    labelName: 'Bóng C',
  },
  D: {
    letter: 'D',
    primaryHex: '#334155', // Crisp Slate-White contrast
    seamHex: '#38BDF8',
    badgeBgClass: 'bg-slate-700',
    badgeTextClass: 'text-white',
    labelName: 'Bóng D',
  },
};

export interface CatchTeamPalette {
  id: string;
  hex: string;
  textOnSolid: string;
}

export const CATCH_TEAM_PALETTES: CatchTeamPalette[] = [
  { id: 'teal', hex: '#0D9488', textOnSolid: '#FFFFFF' },
  { id: 'gold', hex: '#EAB308', textOnSolid: '#071226' },
  { id: 'blue', hex: '#2563EB', textOnSolid: '#FFFFFF' },
  { id: 'orange', hex: '#EA580C', textOnSolid: '#FFFFFF' },
  { id: 'violet', hex: '#7C3AED', textOnSolid: '#FFFFFF' },
  { id: 'rose', hex: '#E11D48', textOnSolid: '#FFFFFF' },
];

export interface CatchTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

export interface CatchQuestionOption {
  id: string; // Stable option ID independent of A/B/C/D display slot
  label: CatchOptionLetter;
  text: string;
}

export interface CatchQuestionItem {
  id: string;
  code: string;
  stem: string;
  image?: string;
  subject: string;
  topic?: string;
  grade: string;
  level: string;
  options: CatchQuestionOption[]; // Exactly 4 options A–D
  correctOptionId: string;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface CatchBallConfig {
  participantMode: CatchBallParticipantMode;
  teams: CatchTeamConfig[];
  sourceKind: CatchQuestionSource;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionCount: number; // Default 8
  timerSeconds: number; // Default 20; 0 = unlimited
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface CatchBallTurnRecord {
  turnIndex: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  optionsSnapshot: CatchQuestionOption[];
  correctOptionId: string;
  correctOptionLabel: CatchOptionLetter;
  officialAnswerText: string;
  explanation: string;
  // Choice stored by participant id ('solo_1', 'class_1', or team.id)
  choiceByParticipant: Record<string, CatchOptionLetter | 'no_answer'>;
  chosenOptionIdByParticipant: Record<string, string | null>;
  isCorrectByParticipant: Record<string, boolean>;
  pointsDeltaByParticipant: Record<string, number>;
  committedAt: number;
  wasEdited?: boolean;
}

export interface CatchParticipantStanding {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  points: number;
  correctCount: number;
  incorrectCount: number;
  noAnswerCount: number;
  rank: number;
  isTied: boolean;
}

export interface CatchBallState {
  config: CatchBallConfig;
  questionOrder: CatchQuestionItem[];
  history: CatchBallTurnRecord[];
  currentTurnIndex: number;
  status: CatchSessionStatus;
}

export interface CatchSetupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveQuestionCount: number;
}

// ============================================================================
// 8-QUESTION SAMPLE PACK: "Bắt bóng kiến thức – Toán THCS" ("Dữ liệu mẫu")
// Exact 8 mandatory prompt cases; strictly ONE correct option, NO equivalent duplicates
// ============================================================================

export const E02_SAMPLE_QUESTIONS: CatchQuestionItem[] = [
  {
    id: 'e02_sample_01',
    code: 'E02-M01',
    stem: 'Tính \\(-7 + 12\\).',
    subject: 'math',
    topic: 'Cộng số nguyên',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e02_s01_a', label: 'A', text: '\\(5\\)' },
      { id: 'e02_s01_b', label: 'B', text: '\\(-5\\)' },
      { id: 'e02_s01_c', label: 'C', text: '\\(19\\)' },
      { id: 'e02_s01_d', label: 'D', text: '\\(-19\\)' },
    ],
    correctOptionId: 'e02_s01_a',
    officialAnswerText: '\\(5\\)',
    explanation: 'Hai số nguyên trái dấu: lấy hiệu hai giá trị tuyệt đối \\(12 - 7 = 5\\) và mang dấu dương của \\(12\\), nên \\(-7 + 12 = 5\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_02',
    code: 'E02-M02',
    stem: 'Tính \\(\\frac{5}{6} - \\frac{1}{3}\\).',
    subject: 'math',
    topic: 'Phân số',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e02_s02_a', label: 'A', text: '\\(\\frac{4}{3}\\)' },
      { id: 'e02_s02_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e02_s02_c', label: 'C', text: '\\(\\frac{1}{6}\\)' },
      { id: 'e02_s02_d', label: 'D', text: '\\(\\frac{2}{3}\\)' },
    ],
    correctOptionId: 'e02_s02_b',
    officialAnswerText: '\\(\\frac{1}{2}\\)',
    explanation: 'Quy đồng mẫu chung \\(6\\): \\(\\frac{1}{3} = \\frac{2}{6}\\). Suy ra \\(\\frac{5}{6} - \\frac{2}{6} = \\frac{3}{6} = \\frac{1}{2}\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_03',
    code: 'E02-M03',
    stem: 'Tính \\((-4)^2\\).',
    subject: 'math',
    topic: 'Lũy thừa số nguyên',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'e02_s03_a', label: 'A', text: '\\(-16\\)' },
      { id: 'e02_s03_b', label: 'B', text: '\\(-8\\)' },
      { id: 'e02_s03_c', label: 'C', text: '\\(16\\)' },
      { id: 'e02_s03_d', label: 'D', text: '\\(8\\)' },
    ],
    correctOptionId: 'e02_s03_c',
    officialAnswerText: '\\(16\\)',
    explanation: 'Bình phương của số âm luôn dương: \\((-4)^2 = (-4) \\times (-4) = 16\\) (khác với \\(-4^2 = -16\\)).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_04',
    code: 'E02-M04',
    stem: 'Tính \\(\\sqrt{(-8)^2}\\).',
    subject: 'math',
    topic: 'Căn bậc hai',
    grade: '9',
    level: 'understand',
    options: [
      { id: 'e02_s04_a', label: 'A', text: '\\(-8\\)' },
      { id: 'e02_s04_b', label: 'B', text: '\\(64\\)' },
      { id: 'e02_s04_c', label: 'C', text: '\\(\\pm 8\\)' },
      { id: 'e02_s04_d', label: 'D', text: '\\(8\\)' },
    ],
    correctOptionId: 'e02_s04_d',
    officialAnswerText: '\\(8\\)',
    explanation: 'Áp dụng hằng đẳng thức \\(\\sqrt{a^2} = |a|\\), ta có \\(\\sqrt{(-8)^2} = |-8| = 8\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_05',
    code: 'E02-M05',
    stem: 'Giải phương trình \\(2x - 3 = 9\\).',
    subject: 'math',
    topic: 'Phương trình bậc nhất',
    grade: '8',
    level: 'know',
    options: [
      { id: 'e02_s05_a', label: 'A', text: '\\(x = 6\\)' },
      { id: 'e02_s05_b', label: 'B', text: '\\(x = 3\\)' },
      { id: 'e02_s05_c', label: 'C', text: '\\(x = 12\\)' },
      { id: 'e02_s05_d', label: 'D', text: '\\(x = -3\\)' },
    ],
    correctOptionId: 'e02_s05_a',
    officialAnswerText: '\\(x = 6\\)',
    explanation: 'Chuyển vế: \\(2x = 9 + 3 = 12 \\Rightarrow x = \\frac{12}{2} = 6\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_06',
    code: 'E02-M06',
    stem: 'Hình vuông cạnh \\(5\\,\\mathrm{cm}\\) có chu vi bao nhiêu?',
    subject: 'math',
    topic: 'Hình học phẳng',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e02_s06_a', label: 'A', text: '\\(25\\,\\mathrm{cm}\\)' },
      { id: 'e02_s06_b', label: 'B', text: '\\(20\\,\\mathrm{cm}\\)' },
      { id: 'e02_s06_c', label: 'C', text: '\\(10\\,\\mathrm{cm}\\)' },
      { id: 'e02_s06_d', label: 'D', text: '\\(15\\,\\mathrm{cm}\\)' },
    ],
    correctOptionId: 'e02_s06_b',
    officialAnswerText: '\\(20\\,\\mathrm{cm}\\)',
    explanation: 'Chu vi hình vuông bằng \\(4\\) lần độ dài một cạnh: \\(C = 4 \\times 5 = 20\\,\\mathrm{cm}\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_07',
    code: 'E02-M07',
    stem: 'Hình chữ nhật dài \\(7{,}5\\,\\mathrm{cm}\\), rộng \\(4\\,\\mathrm{cm}\\) có diện tích bao nhiêu?',
    subject: 'math',
    topic: 'Hình học phẳng',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'e02_s07_a', label: 'A', text: '\\(23\\,\\mathrm{cm}^2\\)' },
      { id: 'e02_s07_b', label: 'B', text: '\\(11{,}5\\,\\mathrm{cm}^2\\)' },
      { id: 'e02_s07_c', label: 'C', text: '\\(30\\,\\mathrm{cm}^2\\)' },
      { id: 'e02_s07_d', label: 'D', text: '\\(28\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'e02_s07_c',
    officialAnswerText: '\\(30\\,\\mathrm{cm}^2\\)',
    explanation: 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng: \\(S = 7{,}5 \\times 4 = 30\\,\\mathrm{cm}^2\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
  {
    id: 'e02_sample_08',
    code: 'E02-M08',
    stem: 'Tung một xúc xắc cân đối sáu mặt. Xác suất ra số lớn hơn \\(4\\) là bao nhiêu?',
    subject: 'math',
    topic: 'Xác suất',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e02_s08_a', label: 'A', text: '\\(\\frac{1}{6}\\)' },
      { id: 'e02_s08_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e02_s08_c', label: 'C', text: '\\(\\frac{2}{3}\\)' },
      { id: 'e02_s08_d', label: 'D', text: '\\(\\frac{1}{3}\\)' },
    ],
    correctOptionId: 'e02_s08_d',
    officialAnswerText: '\\(\\frac{1}{3}\\)',
    explanation:
      'Có hai kết quả thuận lợi là \\(5\\) và \\(6\\) trong \\(6\\) kết quả đồng khả năng, nên xác suất bằng \\(\\frac{2}{6} = \\frac{1}{3}\\).',
    isSample: true,
    sourceBadge: E02_SAMPLE_BADGE,
  },
];

// ============================================================================
// HELPERS: OPTIONS, TEAMS, CONFIG & VALIDATION
// ============================================================================

const DEFAULT_CATCH_TEAM_NAMES = [
  'Đội Xanh Ngọc',
  'Đội Tia Nắng',
  'Đội Hải Đăng',
  'Đội Sao Mai',
  'Đội Sóng Xanh',
  'Đội Bứt Phá',
];

export function createCatchTeams(teamCount: number, existingNames?: string[]): CatchTeamConfig[] {
  const safe = Math.max(2, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safe }, (_, idx) => ({
    id: `cteam_${idx + 1}`,
    teamNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_CATCH_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % CATCH_TEAM_PALETTES.length,
  }));
}

export function createDefaultCatchBallConfig(
  participantMode: CatchBallParticipantMode = 'solo_practice'
): CatchBallConfig {
  return {
    participantMode,
    teams: createCatchTeams(4),
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionCount: 8,
    timerSeconds: 20,
    shuffleQuestions: false,
    shuffleOptions: true,
  };
}

export function getCorrectOptionLabelForCatchQuestion(question: CatchQuestionItem): CatchOptionLetter {
  const found = question.options.find((o) => o.id === question.correctOptionId);
  return found ? found.label : 'A';
}

export function getOptionByLabel(
  question: CatchQuestionItem,
  label: CatchOptionLetter
): CatchQuestionOption | undefined {
  return question.options.find((o) => o.label === label);
}

export function validateCatchSetupConfig(
  config: CatchBallConfig,
  availableQuestionsCount: number
): CatchSetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.participantMode === 'teams') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ nhiều đội cần từ 2 đến 6 đội.');
    }
    config.teams.forEach((t, idx) => {
      if (!t.name.trim()) {
        errors.push(`Đội số ${idx + 1} chưa có tên hoặc nhãn.`);
      }
    });
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  if (availableQuestionsCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện không có câu trắc nghiệm 4 phương án A–D phù hợp. Hãy đổi bộ lọc hoặc chọn bộ mẫu 8 câu.'
    );
  } else if (config.questionCount > availableQuestionsCount) {
    warnings.push(
      `Nguồn hiện có ${availableQuestionsCount} câu 4 phương án (ít hơn ${config.questionCount}). Phiên sẽ dùng đủ ${availableQuestionsCount} câu không lặp.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveQuestionCount: Math.min(Math.max(1, config.questionCount), Math.max(0, availableQuestionsCount)),
  };
}

// ============================================================================
// SHUFFLING & SMART EDU RBAC QUESTION BANK ADAPTER
// ============================================================================

export function shuffleCatchArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleCatchOptionsPreservingId(
  item: CatchQuestionItem,
  rng: () => number = Math.random
): CatchQuestionItem {
  const shuffled = shuffleCatchArray(item.options, rng).map((opt, idx) => ({
    ...opt,
    label: CATCH_OPTION_LETTERS[idx] ?? 'D',
  }));
  return {
    ...item,
    options: shuffled,
  };
}

function normalizeStemKey(stem: string): string {
  return stem.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isCatchQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForCatchBall(question: Question): CatchQuestionItem | null {
  if (question.type !== 'single_choice') return null;
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const validOptions = (question.options || [])
    .filter((o) => o && (o.text || '').trim().length > 0)
    .slice(0, 4)
    .map((o, idx) => ({
      id: String(o.id || `${question.id}_opt_${idx}`),
      label: CATCH_OPTION_LETTERS[idx] ?? 'D',
      text: o.text.trim(),
    }));

  if (validOptions.length !== 4) return null;

  const rawCorrect = (question.correctAnswer || '').trim();
  const matchedCorrect =
    validOptions.find((o) => o.id === rawCorrect) ||
    validOptions.find((o) => o.label.toUpperCase() === rawCorrect.toUpperCase()) ||
    validOptions.find(
      (_o, idx) => (question.options?.[idx]?.label || '').toUpperCase() === rawCorrect.toUpperCase()
    );

  if (!matchedCorrect) return null;

  return {
    id: String(question.id || '').trim() || `e02q_${Math.random().toString(36).slice(2, 9)}`,
    code: (question.code || 'NHCH').trim(),
    stem: cleanStem,
    image: question.image?.trim() || undefined,
    subject: String(question.subject || 'other'),
    topic: (question.chapter || question.lesson || '').trim() || undefined,
    grade: String(question.grade || '6'),
    level: String(question.level || 'understand'),
    options: validOptions,
    correctOptionId: matchedCorrect.id,
    officialAnswerText: matchedCorrect.text,
    explanation: (question.explanation || 'Giáo viên chốt kiến thức sau khi bắt bóng.').trim(),
    isSample: false,
    sourceBadge: 'Ngân hàng câu hỏi',
  };
}

export function buildE02QuestionPool(params: {
  sourceKind: CatchQuestionSource;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): CatchQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return E02_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: CatchQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isCatchQuestionAllowedForRole(raw, params.userRole)) continue;
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

    const item = adaptSmartEduQuestionForCatchBall(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

export function prepareCatchQuestions(
  pool: CatchQuestionItem[],
  config: CatchBallConfig,
  rng: () => number = Math.random
): CatchQuestionItem[] {
  const count = Math.max(0, Math.min(config.questionCount, pool.length));
  const selected = config.shuffleQuestions
    ? shuffleCatchArray(pool, rng).slice(0, count)
    : pool.slice(0, count);

  return config.shuffleOptions
    ? selected.map((q) => shuffleCatchOptionsPreservingId(q, rng))
    : selected.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
}

// ============================================================================
// CORE DETERMINISTIC STATE TRANSITIONS & SCORING
// ============================================================================

export function createInitialCatchBallState(params: {
  config: CatchBallConfig;
  questionPool?: CatchQuestionItem[];
  rng?: () => number;
}): CatchBallState {
  const rng = params.rng ?? Math.random;
  const prepared = prepareCatchQuestions(params.questionPool || E02_SAMPLE_QUESTIONS, params.config, rng);
  return {
    config: {
      ...params.config,
      teams: params.config.teams.map((t) => ({ ...t })),
    },
    questionOrder: prepared,
    history: [],
    currentTurnIndex: 0,
    status: prepared.length > 0 ? 'playing' : 'finished',
  };
}

/**
 * Commits a turn (idempotent by questionId).
 * - 'solo_practice': grades single student choice by stable option ID (or 'no_answer').
 * - 'whole_class': grades shared class representative choice by stable option ID (or 'no_answer').
 * - 'teams': requires ALL 2–6 teams to be graded (A/B/C/D or 'no_answer'; strictly blocks 'ungraded').
 * +10 correct, 0 wrong/no_answer. Never awards speed bonus or penalizes skipping animation.
 */
export function commitCatchBallTurn(
  state: CatchBallState,
  input: {
    question: CatchQuestionItem;
    selectedLabel?: CatchOptionLetter | 'no_answer' | null;
    selectedOptionId?: string | null;
    teamChoices?: Record<string, CatchTeamChoice>;
    committedAt?: number;
  }
): {
  state: CatchBallState;
  committed: boolean;
  reason?: string;
  record?: CatchBallTurnRecord;
} {
  if (state.status !== 'playing') {
    return { state, committed: false, reason: 'session_not_playing' };
  }
  if (state.history.some((h) => h.questionId === input.question.id)) {
    return { state, committed: false, reason: 'duplicate_question_commit' };
  }

  const correctLabel = getCorrectOptionLabelForCatchQuestion(input.question);
  const choiceByParticipant: Record<string, CatchOptionLetter | 'no_answer'> = {};
  const chosenOptionIdByParticipant: Record<string, string | null> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};

  if (state.config.participantMode === 'teams') {
    const verdicts = input.teamChoices || {};
    for (const team of state.config.teams) {
      const v = verdicts[team.id];
      if (!v || v === 'ungraded') {
        return { state, committed: false, reason: 'ungraded_team' };
      }
      choiceByParticipant[team.id] = v;
      const optObj = v === 'no_answer' ? undefined : getOptionByLabel(input.question, v);
      const isRight = Boolean(optObj && optObj.id === input.question.correctOptionId);
      chosenOptionIdByParticipant[team.id] = optObj ? optObj.id : null;
      isCorrectByParticipant[team.id] = isRight;
      pointsDeltaByParticipant[team.id] = isRight ? E02_POINTS_CORRECT : E02_POINTS_INCORRECT;
    }
  } else {
    const pid = state.config.participantMode === 'solo_practice' ? 'solo_1' : 'class_1';
    let optObj: CatchQuestionOption | undefined;
    if (input.selectedOptionId) {
      optObj = input.question.options.find((o) => o.id === input.selectedOptionId);
    } else if (input.selectedLabel && input.selectedLabel !== 'no_answer') {
      optObj = getOptionByLabel(input.question, input.selectedLabel);
    }
    const labelChoice: CatchOptionLetter | 'no_answer' = optObj ? optObj.label : 'no_answer';
    const isRight = Boolean(optObj && optObj.id === input.question.correctOptionId);
    choiceByParticipant[pid] = labelChoice;
    chosenOptionIdByParticipant[pid] = optObj ? optObj.id : null;
    isCorrectByParticipant[pid] = isRight;
    pointsDeltaByParticipant[pid] = isRight ? E02_POINTS_CORRECT : E02_POINTS_INCORRECT;
  }

  const record: CatchBallTurnRecord = {
    turnIndex: state.currentTurnIndex,
    questionId: input.question.id,
    questionCode: input.question.code,
    questionStem: input.question.stem,
    optionsSnapshot: input.question.options.map((o) => ({ ...o })),
    correctOptionId: input.question.correctOptionId,
    correctOptionLabel: correctLabel,
    officialAnswerText: input.question.officialAnswerText,
    explanation: input.question.explanation,
    choiceByParticipant,
    chosenOptionIdByParticipant,
    isCorrectByParticipant,
    pointsDeltaByParticipant,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextHistory = [...state.history, record];
  const isDone = nextHistory.length >= state.questionOrder.length;

  return {
    committed: true,
    record,
    state: {
      ...state,
      history: nextHistory,
      status: isDone ? 'finished' : 'playing',
    },
  };
}

/**
 * Edits the most recently confirmed turn before advancing to a new question.
 * Recomputes all standings cleanly from history (single source of truth).
 */
export function editLastCatchBallTurn(
  state: CatchBallState,
  input: {
    selectedLabel?: CatchOptionLetter | 'no_answer' | null;
    selectedOptionId?: string | null;
    teamChoices?: Record<string, CatchTeamChoice>;
  }
): { state: CatchBallState; edited: boolean; reason?: string } {
  if (state.history.length === 0) {
    return { state, edited: false, reason: 'no_history' };
  }

  const lastIdx = state.history.length - 1;
  const last = state.history[lastIdx];
  const question = state.questionOrder.find((q) => q.id === last.questionId);
  if (!question) return { state, edited: false, reason: 'question_missing' };

  const choiceByParticipant: Record<string, CatchOptionLetter | 'no_answer'> = {};
  const chosenOptionIdByParticipant: Record<string, string | null> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};

  if (state.config.participantMode === 'teams') {
    const verdicts = input.teamChoices || {};
    for (const team of state.config.teams) {
      const v = verdicts[team.id];
      if (!v || v === 'ungraded') {
        return { state, edited: false, reason: 'ungraded_team' };
      }
      choiceByParticipant[team.id] = v;
      const optObj = v === 'no_answer' ? undefined : getOptionByLabel(question, v);
      const isRight = Boolean(optObj && optObj.id === question.correctOptionId);
      chosenOptionIdByParticipant[team.id] = optObj ? optObj.id : null;
      isCorrectByParticipant[team.id] = isRight;
      pointsDeltaByParticipant[team.id] = isRight ? E02_POINTS_CORRECT : E02_POINTS_INCORRECT;
    }
  } else {
    const pid = state.config.participantMode === 'solo_practice' ? 'solo_1' : 'class_1';
    let optObj: CatchQuestionOption | undefined;
    if (input.selectedOptionId) {
      optObj = question.options.find((o) => o.id === input.selectedOptionId);
    } else if (input.selectedLabel && input.selectedLabel !== 'no_answer') {
      optObj = getOptionByLabel(question, input.selectedLabel);
    }
    const labelChoice: CatchOptionLetter | 'no_answer' = optObj ? optObj.label : 'no_answer';
    const isRight = Boolean(optObj && optObj.id === question.correctOptionId);
    choiceByParticipant[pid] = labelChoice;
    chosenOptionIdByParticipant[pid] = optObj ? optObj.id : null;
    isCorrectByParticipant[pid] = isRight;
    pointsDeltaByParticipant[pid] = isRight ? E02_POINTS_CORRECT : E02_POINTS_INCORRECT;
  }

  const nextHistory = [...state.history];
  nextHistory[lastIdx] = {
    ...last,
    choiceByParticipant,
    chosenOptionIdByParticipant,
    isCorrectByParticipant,
    pointsDeltaByParticipant,
    wasEdited: true,
    committedAt: Date.now(),
  };

  return {
    edited: true,
    state: {
      ...state,
      history: nextHistory,
    },
  };
}

export function advanceCatchBallTurn(state: CatchBallState): CatchBallState {
  if (state.status !== 'playing') return state;
  const total = state.questionOrder.length;
  const nextIdx = Math.min(Math.max(0, total - 1), state.history.length);
  return {
    ...state,
    currentTurnIndex: nextIdx,
  };
}

/**
 * Pure source-of-truth standings derived strictly from `state.history`.
 * Equal points share the exact same rank with `isTied = true` ("Đồng hạng").
 */
export function computeCatchStandings(state: CatchBallState): CatchParticipantStanding[] {
  if (state.config.participantMode !== 'teams') {
    const pid = state.config.participantMode === 'solo_practice' ? 'solo_1' : 'class_1';
    const label =
      state.config.participantMode === 'solo_practice' ? 'Tự luyện cá nhân' : 'Cả lớp';
    let points = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;

    for (const rec of state.history) {
      points += rec.pointsDeltaByParticipant[pid] || 0;
      const choice = rec.choiceByParticipant[pid];
      if (!choice || choice === 'no_answer') {
        noAnswerCount += 1;
      } else if (rec.isCorrectByParticipant[pid]) {
        correctCount += 1;
      } else {
        incorrectCount += 1;
      }
    }

    return [
      {
        id: pid,
        teamNumber: 1,
        name: label,
        paletteIndex: 0,
        points,
        correctCount,
        incorrectCount,
        noAnswerCount,
        rank: 1,
        isTied: false,
      },
    ];
  }

  const rows: CatchParticipantStanding[] = state.config.teams.map((team) => {
    let points = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;

    for (const rec of state.history) {
      points += rec.pointsDeltaByParticipant[team.id] || 0;
      const choice = rec.choiceByParticipant[team.id];
      if (!choice || choice === 'no_answer') {
        noAnswerCount += 1;
      } else if (rec.isCorrectByParticipant[team.id]) {
        correctCount += 1;
      } else {
        incorrectCount += 1;
      }
    }

    return {
      id: team.id,
      teamNumber: team.teamNumber,
      name: team.name,
      paletteIndex: team.paletteIndex,
      points,
      correctCount,
      incorrectCount,
      noAnswerCount,
      rank: 1,
      isTied: false,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.teamNumber - b.teamNumber);

  const freq = new Map<number, number>();
  rows.forEach((r) => freq.set(r.points, (freq.get(r.points) || 0) + 1));

  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].points === rows[i - 1].points) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = i + 1;
    }
    rows[i].isTied = (freq.get(rows[i].points) || 0) > 1;
  }

  return rows;
}

// ============================================================================
// SESSION PERSISTENCE (/DEMO ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredE02SessionPayload {
  version: number;
  state: CatchBallState;
  updatedAt: number;
}

export function getE02SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${E02_SESSION_STORAGE_KEY}`
    : E02_SESSION_STORAGE_KEY;
}

export function saveE02Session(state: CatchBallState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredE02SessionPayload = {
      version: E02_SESSION_VERSION,
      state,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getE02SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function clearE02Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getE02SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadE02Session(): {
  state: CatchBallState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getE02SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredE02SessionPayload>;
    const st = parsed?.state;
    if (
      !parsed ||
      parsed.version !== E02_SESSION_VERSION ||
      !st ||
      !st.config ||
      !Array.isArray(st.questionOrder) ||
      st.questionOrder.length === 0 ||
      !Array.isArray(st.history) ||
      (st.config.participantMode !== 'solo_practice' &&
        st.config.participantMode !== 'whole_class' &&
        st.config.participantMode !== 'teams')
    ) {
      clearE02Session();
      return { state: null, recoveredFromCorruption: true };
    }

    // Verify every question preserves 4 options & valid correctOptionId
    const validQuestions = st.questionOrder.every(
      (q) =>
        q &&
        typeof q.id === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        q.options.some((o) => o.id === q.correctOptionId)
    );
    if (!validQuestions) {
      clearE02Session();
      return { state: null, recoveredFromCorruption: true };
    }

    return { state: st, recoveredFromCorruption: false };
  } catch {
    clearE02Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
