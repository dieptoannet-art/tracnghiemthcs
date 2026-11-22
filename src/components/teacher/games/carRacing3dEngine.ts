/**
 * D04 — ĐUA XE TỐC ĐỘ 3D (Tây Đô Smart EDU)
 * Pure deterministic racing & Turbo engine:
 * - Modes: 'team_race' (2–6 teams, only team names required) & 'solo_practice' (1 car, zero fake AI opponents)
 * - Exact Turbo rules:
 *   * Correct answer: +1 stage, increments consecutive Turbo streak
 *   * Every 3 consecutive correct answers (when Turbo ON): +1 bonus Turbo stage (total +2 on triggering turn) and resets streak to 0
 *   * Wrong or no_answer: +0 stage, resets Turbo streak to 0, preserves accumulated correctCount & stage
 *   * When Turbo OFF: +1 stage per correct answer, streak stays 0 & hidden
 * - Exact track length: N stages (Turbo OFF) or N + Math.floor(N / 3) stages (Turbo ON) -> 10Q + Turbo ON = 13 stages
 * - Full history recomputation on commit, edit-last-confirmed-turn, and session restore
 * - Tie-aware standings strictly by total stage ("Đồng hạng"), separate correctCount & turboCount display
 * - Early-end distinction between graded vs unplayed questions
 * - 10-question sample pack "Đua xe Toán THCS" ("Dữ liệu mẫu") + Smart EDU RBAC question bank adapter
 * - Demo-isolated localStorage persistence & corrupt JSON recovery
 */

import { Question, QuestionType, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type CarRaceMode = 'team_race' | 'solo_practice';

export type CarRaceVerdict = 'ungraded' | 'correct' | 'incorrect' | 'no_answer';

export type CarRaceMatchStatus = 'playing' | 'finished' | 'ended_early';

export type CarRaceQuestionSource = 'sample' | 'bank';

export interface CarTeamPalette {
  id: string;
  label: string;
  hex: string;
  hexNum: number;
  accentHex: string;
  accentNum: number;
  bgClass: string;
  borderClass: string;
  textClass: string;
  badgeClass: string;
}

export const CAR_TEAM_PALETTES: CarTeamPalette[] = [
  {
    id: 'electric_blue',
    label: 'Xanh điện',
    hex: '#1D63ED',
    hexNum: 0x1d63ed,
    accentHex: '#7DD3FC',
    accentNum: 0x7dd3fc,
    bgClass: 'bg-blue-950/50',
    borderClass: 'border-blue-500/60',
    textClass: 'text-blue-200',
    badgeClass: 'bg-blue-600 text-white',
  },
  {
    id: 'gold_yellow',
    label: 'Vàng rực',
    hex: '#EAB308',
    hexNum: 0xeab308,
    accentHex: '#FEF08A',
    accentNum: 0xfef08a,
    bgClass: 'bg-amber-950/45',
    borderClass: 'border-amber-400/60',
    textClass: 'text-amber-200',
    badgeClass: 'bg-amber-400 text-slate-950',
  },
  {
    id: 'coral_red',
    label: 'Đỏ cam',
    hex: '#F97316',
    hexNum: 0xf97316,
    accentHex: '#FED7AA',
    accentNum: 0xfed7aa,
    bgClass: 'bg-orange-950/45',
    borderClass: 'border-orange-500/60',
    textClass: 'text-orange-200',
    badgeClass: 'bg-orange-500 text-white',
  },
  {
    id: 'emerald_teal',
    label: 'Xanh ngọc',
    hex: '#10B981',
    hexNum: 0x10b981,
    accentHex: '#A7F3D0',
    accentNum: 0xa7f3d0,
    bgClass: 'bg-emerald-950/45',
    borderClass: 'border-emerald-500/60',
    textClass: 'text-emerald-200',
    badgeClass: 'bg-emerald-600 text-white',
  },
  {
    id: 'violet_pulse',
    label: 'Tím chàm',
    hex: '#8B5CF6',
    hexNum: 0x8b5cf6,
    accentHex: '#DDD6FE',
    accentNum: 0xddd6fe,
    bgClass: 'bg-violet-950/45',
    borderClass: 'border-violet-500/60',
    textClass: 'text-violet-200',
    badgeClass: 'bg-violet-600 text-white',
  },
  {
    id: 'crimson_rose',
    label: 'Đỏ thẫm',
    hex: '#E11D48',
    hexNum: 0xe11d48,
    accentHex: '#FECDD3',
    accentNum: 0xfecdd3,
    bgClass: 'bg-rose-950/45',
    borderClass: 'border-rose-500/60',
    textClass: 'text-rose-200',
    badgeClass: 'bg-rose-600 text-white',
  },
];

export const TURBO_STREAK_TARGET = 3;
export const D04_SAMPLE_PACK_TITLE = 'Đua xe Toán THCS';
export const D04_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D04_SESSION_STORAGE_KEY = 'taydo_d04_car_racing_session_v1';
export const D04_SESSION_VERSION = 1;

export interface CarTeamConfig {
  id: string;
  carNumber: number;
  name: string;
  paletteIndex: number;
}

export interface CarRaceQuestionOption {
  id: string; // Stable option ID (never tied to array index)
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface CarRaceTrueFalseItem {
  id: string;
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean;
}

export interface CarRaceQuestionItem {
  id: string;
  code: string;
  type: QuestionType;
  stem: string;
  image?: string;
  subject: string;
  grade: string;
  level: string;
  options?: CarRaceQuestionOption[];
  correctOptionId?: string;
  subItems?: CarRaceTrueFalseItem[];
  acceptedAnswers?: string[];
  isNumericTolerance?: boolean;
  numericTolerance?: number;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
  requiresTeacherGrading: boolean;
}

export interface CarRaceMatchConfig {
  mode: CarRaceMode;
  teams: CarTeamConfig[];
  sourceKind: CarRaceQuestionSource;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionCount: number; // Default 10 (choices: 5, 10, 15 when pool allows)
  timerSeconds: number; // Default 30s; 0 = unlimited
  turboEnabled: boolean; // Default true
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  rulesLocked: boolean;
}

export interface CarTeamTurnOutcome {
  teamId: string;
  verdict: CarRaceVerdict;
  selectedOptionId?: string;
  answerNote?: string;
  stageBefore: number;
  stageAfter: number;
  stagesGained: number; // 0, 1, or 2 (when Turbo triggered)
  turboTriggered: boolean;
  streakBefore: number;
  streakAfter: number;
}

export interface CarRaceTurnRecord {
  turnIndex: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  teamOutcomes: Record<string, CarTeamTurnOutcome>;
  resultSource: 'teacher_single_device' | 'student_auto';
  committedAt: number;
  wasEdited?: boolean;
}

export interface CarTeamRuntimeState {
  teamId: string;
  carNumber: number;
  name: string;
  paletteIndex: number;
  stage: number;
  correctCount: number;
  incorrectCount: number;
  noAnswerCount: number;
  currentStreak: number; // 0, 1, or 2 when Turbo ON (always 0 when Turbo OFF)
  turboCount: number;
  lastStagesGained: number;
  lastTurboTriggered: boolean;
}

export interface CarRaceMatchState {
  config: CarRaceMatchConfig;
  totalStages: number;
  questionOrder: CarRaceQuestionItem[];
  teamRuntime: Record<string, CarTeamRuntimeState>;
  history: CarRaceTurnRecord[];
  currentQuestionIndex: number;
  status: CarRaceMatchStatus;
  endedEarly: boolean;
  questionsGraded: number;
  questionsUnplayed: number;
}

export interface CarRaceStanding {
  teamId: string;
  carNumber: number;
  name: string;
  paletteIndex: number;
  stage: number;
  correctCount: number;
  turboCount: number;
  rank: number;
  isTied: boolean;
}

export interface CarRaceConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveQuestionCount: number;
  totalStages: number;
}

export interface CarTurnPreview {
  teamId: string;
  verdict: CarRaceVerdict;
  stageBefore: number;
  stageAfter: number;
  stagesGained: number;
  willTriggerTurbo: boolean;
  streakAfter: number;
}

const OPTION_LABELS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

// ============================================================================
// TRACK STAGE FORMULA
// ============================================================================

export function computeTrackTotalStages(questionCount: number, turboEnabled: boolean): number {
  const safeN = Math.max(1, Math.floor(questionCount));
  return turboEnabled ? safeN + Math.floor(safeN / TURBO_STREAK_TARGET) : safeN;
}

// ============================================================================
// SAMPLE QUESTION PACK — 10 EXACT QUESTIONS ("Đua xe Toán THCS", "Dữ liệu mẫu")
// ============================================================================

export const D04_SAMPLE_QUESTIONS: CarRaceQuestionItem[] = [
  {
    id: 'd04_sample_01',
    code: 'D04-M01',
    type: 'single_choice',
    stem: '\\(72 : 8\\) bằng bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd04_s01_a', label: 'A', text: '\\(8\\)' },
      { id: 'd04_s01_b', label: 'B', text: '\\(9\\)' },
      { id: 'd04_s01_c', label: 'C', text: '\\(7\\)' },
      { id: 'd04_s01_d', label: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'd04_s01_b',
    acceptedAnswers: ['9'],
    officialAnswerText: '\\(9\\)',
    explanation: 'Vì \\(8 \\times 9 = 72\\) nên \\(72 : 8 = 9\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_02',
    code: 'D04-M02',
    type: 'single_choice',
    stem: '\\(4^2 + 9\\) bằng bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd04_s02_a', label: 'A', text: '\\(17\\)' },
      { id: 'd04_s02_b', label: 'B', text: '\\(23\\)' },
      { id: 'd04_s02_c', label: 'C', text: '\\(25\\)' },
      { id: 'd04_s02_d', label: 'D', text: '\\(27\\)' },
    ],
    correctOptionId: 'd04_s02_c',
    acceptedAnswers: ['25'],
    officialAnswerText: '\\(25\\)',
    explanation: 'Tính lũy thừa trước: \\(4^2 = 16\\), sau đó cộng \\(16 + 9 = 25\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_03',
    code: 'D04-M03',
    type: 'single_choice',
    stem: '\\(-6 - 7\\) bằng bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd04_s03_a', label: 'A', text: '\\(-13\\)' },
      { id: 'd04_s03_b', label: 'B', text: '\\(-1\\)' },
      { id: 'd04_s03_c', label: 'C', text: '\\(1\\)' },
      { id: 'd04_s03_d', label: 'D', text: '\\(13\\)' },
    ],
    correctOptionId: 'd04_s03_a',
    acceptedAnswers: ['-13', '−13'],
    officialAnswerText: '\\(-13\\)',
    explanation: 'Cộng hai số nguyên âm: \\(-6 - 7 = -6 + (-7) = -(6 + 7) = -13\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_04',
    code: 'D04-M04',
    type: 'single_choice',
    stem: '\\(\\frac{3}{5} + \\frac{1}{10}\\) bằng bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd04_s04_a', label: 'A', text: '\\(\\frac{4}{15}\\)' },
      { id: 'd04_s04_b', label: 'B', text: '\\(\\frac{7}{10}\\)' },
      { id: 'd04_s04_c', label: 'C', text: '\\(\\frac{4}{10}\\)' },
      { id: 'd04_s04_d', label: 'D', text: '\\(\\frac{9}{10}\\)' },
    ],
    correctOptionId: 'd04_s04_b',
    acceptedAnswers: ['7/10', '0.7', '0,7'],
    officialAnswerText: '\\(\\frac{7}{10}\\)',
    explanation:
      'Quy đồng mẫu chung \\(10\\): \\(\\frac{3}{5} = \\frac{6}{10}\\), nên \\(\\frac{6}{10} + \\frac{1}{10} = \\frac{7}{10}\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_05',
    code: 'D04-M05',
    type: 'single_choice',
    stem: '\\(25\\%\\) của \\(80\\) bằng bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd04_s05_a', label: 'A', text: '\\(16\\)' },
      { id: 'd04_s05_b', label: 'B', text: '\\(20\\)' },
      { id: 'd04_s05_c', label: 'C', text: '\\(25\\)' },
      { id: 'd04_s05_d', label: 'D', text: '\\(40\\)' },
    ],
    correctOptionId: 'd04_s05_b',
    acceptedAnswers: ['20'],
    officialAnswerText: '\\(20\\)',
    explanation: 'Ta có \\(25\\% = \\frac{1}{4}\\), nên \\(25\\%\\) của \\(80\\) là \\(80 \\times \\frac{1}{4} = 20\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_06',
    code: 'D04-M06',
    type: 'single_choice',
    stem: 'Tìm \\(x\\), biết \\(3x = 27\\).',
    subject: 'math',
    grade: '7',
    level: 'know',
    options: [
      { id: 'd04_s06_a', label: 'A', text: '\\(x = 6\\)' },
      { id: 'd04_s06_b', label: 'B', text: '\\(x = 8\\)' },
      { id: 'd04_s06_c', label: 'C', text: '\\(x = 9\\)' },
      { id: 'd04_s06_d', label: 'D', text: '\\(x = 24\\)' },
    ],
    correctOptionId: 'd04_s06_c',
    acceptedAnswers: ['9', 'x=9', 'x = 9'],
    officialAnswerText: '\\(9\\)',
    explanation: 'Chia cả hai vế cho \\(3\\): \\(x = \\frac{27}{3} = 9\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_07',
    code: 'D04-M07',
    type: 'single_choice',
    stem: 'Thu gọn biểu thức \\(5a - 2a\\).',
    subject: 'math',
    grade: '7',
    level: 'know',
    options: [
      { id: 'd04_s07_a', label: 'A', text: '\\(3\\)' },
      { id: 'd04_s07_b', label: 'B', text: '\\(3a\\)' },
      { id: 'd04_s07_c', label: 'C', text: '\\(7a\\)' },
      { id: 'd04_s07_d', label: 'D', text: '\\(3a^2\\)' },
    ],
    correctOptionId: 'd04_s07_b',
    acceptedAnswers: ['3a'],
    officialAnswerText: '\\(3a\\)',
    explanation: 'Trừ phần hệ số của hai đơn thức đồng dạng: \\(5a - 2a = (5 - 2)a = 3a\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_08',
    code: 'D04-M08',
    type: 'single_choice',
    stem: 'Hình chữ nhật dài \\(12\\text{ m}\\), rộng \\(7\\text{ m}\\) có diện tích bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'd04_s08_a', label: 'A', text: '\\(38\\text{ m}^2\\)' },
      { id: 'd04_s08_b', label: 'B', text: '\\(72\\text{ m}^2\\)' },
      { id: 'd04_s08_c', label: 'C', text: '\\(84\\text{ m}^2\\)' },
      { id: 'd04_s08_d', label: 'D', text: '\\(96\\text{ m}^2\\)' },
    ],
    correctOptionId: 'd04_s08_c',
    acceptedAnswers: ['84 m2', '84 m²', '84m2', '84'],
    officialAnswerText: '\\(84\\text{ m}^2\\)',
    explanation: 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng: \\(S = 12 \\times 7 = 84\\text{ m}^2\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_09',
    code: 'D04-M09',
    type: 'single_choice',
    stem: 'Xe đi đều \\(150\\text{ m}\\) trong \\(10\\text{ giây}\\). Vận tốc là bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'd04_s09_a', label: 'A', text: '\\(10\\text{ m/s}\\)' },
      { id: 'd04_s09_b', label: 'B', text: '\\(15\\text{ m/s}\\)' },
      { id: 'd04_s09_c', label: 'C', text: '\\(25\\text{ m/s}\\)' },
      { id: 'd04_s09_d', label: 'D', text: '\\(1500\\text{ m/s}\\)' },
    ],
    correctOptionId: 'd04_s09_b',
    acceptedAnswers: ['15 m/s', '15m/s', '15'],
    officialAnswerText: '\\(15\\text{ m/s}\\)',
    explanation: 'Áp dụng công thức \\(v = \\frac{s}{t} = \\frac{150}{10} = 15\\text{ m/s}\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd04_sample_10',
    code: 'D04-M10',
    type: 'single_choice',
    stem: 'Đi đều với vận tốc \\(60\\text{ km/h}\\) trong \\(30\\text{ phút}\\) thì đi được bao xa?',
    subject: 'math',
    grade: '7',
    level: 'apply',
    options: [
      { id: 'd04_s10_a', label: 'A', text: '\\(20\\text{ km}\\)' },
      { id: 'd04_s10_b', label: 'B', text: '\\(30\\text{ km}\\)' },
      { id: 'd04_s10_c', label: 'C', text: '\\(45\\text{ km}\\)' },
      { id: 'd04_s10_d', label: 'D', text: '\\(120\\text{ km}\\)' },
    ],
    correctOptionId: 'd04_s10_b',
    acceptedAnswers: ['30 km', '30km', '30'],
    officialAnswerText: '\\(30\\text{ km}\\)',
    explanation:
      'Đổi \\(30\\text{ phút} = 0{,}5\\text{ giờ}\\). Quãng đường đi được là \\(s = v \\cdot t = 60 \\times 0{,}5 = 30\\text{ km}\\).',
    isSample: true,
    sourceBadge: D04_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
];

// ============================================================================
// TEAM BUILDERS & CONFIG VALIDATION
// ============================================================================

const DEFAULT_TEAM_NAMES = [
  'Đội Xanh Điện',
  'Đội Sao Vàng',
  'Đội Tia Chớp',
  'Đội Ngọc Bích',
  'Đội Thiên Hà',
  'Đội Phượng Hoàng',
];

export function createCarRaceTeams(teamCount: number, existingNames?: string[]): CarTeamConfig[] {
  const safeCount = Math.max(1, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safeCount }, (_, idx) => ({
    id: `car_${idx + 1}`,
    carNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % CAR_TEAM_PALETTES.length,
  }));
}

export function createDefaultCarRaceConfig(
  mode: CarRaceMode = 'team_race',
  teamCount = 2
): CarRaceMatchConfig {
  const teams =
    mode === 'solo_practice'
      ? [{ id: 'car_solo', carNumber: 1, name: 'Xe Tự Luyện', paletteIndex: 0 }]
      : createCarRaceTeams(Math.max(2, Math.min(6, teamCount)));

  return {
    mode,
    teams,
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionCount: 10,
    timerSeconds: 30,
    turboEnabled: true,
    shuffleQuestions: false,
    shuffleOptions: true,
    rulesLocked: false,
  };
}

export function validateCarRaceSetupConfig(
  config: CarRaceMatchConfig,
  availableQuestionsCount: number
): CarRaceConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (availableQuestionsCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện tại chưa có câu hợp lệ. Hãy đổi bộ lọc hoặc dùng bộ mẫu "Đua xe Toán THCS".'
    );
  }

  if (config.mode === 'team_race') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ Đua theo đội cần từ 2 đến 6 đội.');
    }
  } else if (config.teams.length !== 1) {
    errors.push('Chế độ Tự luyện sử dụng đúng 1 xe.');
  }

  const seenNames = new Set<string>();
  config.teams.forEach((team, idx) => {
    const clean = team.name.trim();
    if (!clean) {
      errors.push(`Xe số ${idx + 1} chưa có tên đội.`);
    } else {
      const lower = clean.toLowerCase();
      if (seenNames.has(lower)) {
        warnings.push(`Có hai đội đang trùng tên "${clean}" — nên đặt tên riêng để dễ nhận diện.`);
      }
      seenNames.add(lower);
    }
  });

  const desiredCount = Math.max(1, Math.floor(config.questionCount || 1));
  const effectiveQuestionCount =
    availableQuestionsCount > 0 ? Math.min(desiredCount, availableQuestionsCount) : 0;

  if (availableQuestionsCount > 0 && desiredCount > availableQuestionsCount) {
    warnings.push(
      `Bộ câu hỏi hiện có ${availableQuestionsCount} câu (ít hơn ${desiredCount} câu đã chọn). Hệ thống không tự lặp câu và sẽ đua đúng ${effectiveQuestionCount} câu.`
    );
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  const totalStages =
    effectiveQuestionCount > 0
      ? computeTrackTotalStages(effectiveQuestionCount, config.turboEnabled)
      : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveQuestionCount,
    totalStages,
  };
}

// ============================================================================
// QUESTION BANK ADAPTER (RBAC, SANITIZATION, STABLE-ID OPTION SHUFFLING)
// ============================================================================

export function shuffleCarArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleCarRaceOptionsPreservingId(
  item: CarRaceQuestionItem,
  rng: () => number = Math.random
): CarRaceQuestionItem {
  if (item.type !== 'single_choice' || !item.options || item.options.length < 2) {
    return item;
  }
  const shuffled = shuffleCarArray(item.options, rng).map((opt, idx) => ({
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

export function isCarRaceQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForCarRace(question: Question): CarRaceQuestionItem | null {
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const base = {
    id: String(question.id || '').trim() || `crq_${Math.random().toString(36).slice(2, 9)}`,
    code: (question.code || 'NHCH').trim(),
    type: question.type,
    stem: cleanStem,
    image: question.image?.trim() || undefined,
    subject: String(question.subject || 'other'),
    grade: String(question.grade || '6'),
    level: String(question.level || 'understand'),
    explanation: (question.explanation || 'Giáo viên chốt kiến thức trọng tâm sau lượt đua.').trim(),
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

  // essay
  const essayAnswer =
    (question.sampleAnswer || '').trim() ||
    (question.explanation || '').trim() ||
    'Giáo viên chấm trực tiếp theo đáp án';

  return {
    ...base,
    officialAnswerText: essayAnswer,
    requiresTeacherGrading: true,
  };
}

export function buildD04QuestionPool(params: {
  sourceKind: CarRaceQuestionSource;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): CarRaceQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return D04_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: CarRaceQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isCarRaceQuestionAllowedForRole(raw, params.userRole)) continue;
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

    const item = adaptSmartEduQuestionForCarRace(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

export function prepareCarRaceQuestions(
  pool: CarRaceQuestionItem[],
  config: CarRaceMatchConfig,
  rng: () => number = Math.random
): CarRaceQuestionItem[] {
  const ordered = config.shuffleQuestions ? shuffleCarArray(pool, rng) : [...pool];
  // Never repeat questions
  const sliced = ordered.slice(0, Math.max(1, Math.min(config.questionCount, ordered.length)));
  return config.shuffleOptions
    ? sliced.map((q) => shuffleCarRaceOptionsPreservingId(q, rng))
    : sliced.map((q) => ({
        ...q,
        options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      }));
}

// ============================================================================
// SOLO ANSWER EVALUATION HELPER
// ============================================================================

export function normalizeCarRaceShortAnswer(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/−/g, '-')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/m²/g, 'm2')
    .replace(/cm²/g, 'cm2');
}

export function evaluateCarRaceSoloAnswer(
  question: CarRaceQuestionItem,
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
    const normInput = normalizeCarRaceShortAnswer(rawText);
    if (!normInput) return { isCorrect: false, answerNote: 'Không trả lời' };

    const hit = question.acceptedAnswers.some(
      (acc) => normalizeCarRaceShortAnswer(acc) === normInput
    );
    if (hit) return { isCorrect: true, answerNote: rawText };

    if (question.isNumericTolerance) {
      const numVal = Number(normInput);
      const tol = question.numericTolerance ?? 0.01;
      if (Number.isFinite(numVal)) {
        const tolHit = question.acceptedAnswers.some((acc) => {
          const target = Number(normalizeCarRaceShortAnswer(acc));
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
// CORE DETERMINISTIC TURBO RACE ENGINE (RECOMPUTE, PREVIEW, COMMIT, EDIT, TIE)
// ============================================================================

function computeSingleStepDelta(
  stageBefore: number,
  streakBefore: number,
  verdict: CarRaceVerdict,
  turboEnabled: boolean
): {
  stageAfter: number;
  stagesGained: number;
  turboTriggered: boolean;
  streakAfter: number;
} {
  if (verdict !== 'correct') {
    return {
      stageAfter: stageBefore,
      stagesGained: 0,
      turboTriggered: false,
      streakAfter: 0,
    };
  }

  if (!turboEnabled) {
    return {
      stageAfter: stageBefore + 1,
      stagesGained: 1,
      turboTriggered: false,
      streakAfter: 0,
    };
  }

  const nextStreak = streakBefore + 1;
  if (nextStreak >= TURBO_STREAK_TARGET) {
    // 3rd consecutive correct: +1 regular + 1 Turbo bonus = +2 stages, streak resets to 0
    return {
      stageAfter: stageBefore + 2,
      stagesGained: 2,
      turboTriggered: true,
      streakAfter: 0,
    };
  }

  return {
    stageAfter: stageBefore + 1,
    stagesGained: 1,
    turboTriggered: false,
    streakAfter: nextStreak,
  };
}

/**
 * Pure source-of-truth recomputation from config + history.
 * Replays every turn from 0 so stage, correctCount, currentStreak, turboCount,
 * and rankings are ALWAYS 100% consistent (including after edits & session restore).
 */
export function recomputeCarRaceState(params: {
  config: CarRaceMatchConfig;
  questionOrder: CarRaceQuestionItem[];
  history: CarRaceTurnRecord[];
  currentQuestionIndex?: number;
  endedEarly?: boolean;
}): CarRaceMatchState {
  const { config, questionOrder } = params;
  const totalStages = computeTrackTotalStages(
    Math.max(1, questionOrder.length),
    config.turboEnabled
  );

  const teamRuntime: Record<string, CarTeamRuntimeState> = {};
  for (const team of config.teams) {
    teamRuntime[team.id] = {
      teamId: team.id,
      carNumber: team.carNumber,
      name: team.name,
      paletteIndex: team.paletteIndex,
      stage: 0,
      correctCount: 0,
      incorrectCount: 0,
      noAnswerCount: 0,
      currentStreak: 0,
      turboCount: 0,
      lastStagesGained: 0,
      lastTurboTriggered: false,
    };
  }

  const normalizedHistory: CarRaceTurnRecord[] = params.history.map((rec, turnIdx) => {
    const nextOutcomes: Record<string, CarTeamTurnOutcome> = {};

    for (const team of config.teams) {
      const rt = teamRuntime[team.id];
      const rawOutcome = rec.teamOutcomes[team.id];
      const verdict: CarRaceVerdict = rawOutcome?.verdict ?? 'no_answer';
      const stageBefore = rt.stage;
      const streakBefore = rt.currentStreak;

      const delta = computeSingleStepDelta(
        stageBefore,
        streakBefore,
        verdict,
        config.turboEnabled
      );

      rt.stage = delta.stageAfter;
      rt.currentStreak = delta.streakAfter;
      rt.lastStagesGained = delta.stagesGained;
      rt.lastTurboTriggered = delta.turboTriggered;

      if (verdict === 'correct') {
        rt.correctCount += 1;
        if (delta.turboTriggered) {
          rt.turboCount += 1;
        }
      } else if (verdict === 'incorrect') {
        rt.incorrectCount += 1;
      } else if (verdict === 'no_answer') {
        rt.noAnswerCount += 1;
      }

      nextOutcomes[team.id] = {
        teamId: team.id,
        verdict,
        selectedOptionId: rawOutcome?.selectedOptionId,
        answerNote: rawOutcome?.answerNote,
        stageBefore,
        stageAfter: delta.stageAfter,
        stagesGained: delta.stagesGained,
        turboTriggered: delta.turboTriggered,
        streakBefore,
        streakAfter: delta.streakAfter,
      };
    }

    return {
      ...rec,
      turnIndex: turnIdx,
      teamOutcomes: nextOutcomes,
    };
  });

  const endedEarly = Boolean(params.endedEarly);
  let status: CarRaceMatchStatus = 'playing';
  if (endedEarly) {
    status = 'ended_early';
  } else if (questionOrder.length > 0 && normalizedHistory.length >= questionOrder.length) {
    status = 'finished';
  }

  const defaultIndex = Math.min(
    Math.max(0, questionOrder.length - 1),
    normalizedHistory.length
  );
  const safeCurrentIndex =
    typeof params.currentQuestionIndex === 'number'
      ? Math.max(0, Math.min(Math.max(0, questionOrder.length - 1), params.currentQuestionIndex))
      : defaultIndex;

  const questionsGraded = normalizedHistory.length;
  const questionsUnplayed = Math.max(0, questionOrder.length - questionsGraded);

  return {
    config: { ...config, questionCount: questionOrder.length, rulesLocked: true },
    totalStages,
    questionOrder,
    teamRuntime,
    history: normalizedHistory,
    currentQuestionIndex: safeCurrentIndex,
    status,
    endedEarly: status === 'ended_early',
    questionsGraded,
    questionsUnplayed,
  };
}

export function createInitialCarRaceMatchState(
  config: CarRaceMatchConfig,
  questionOrder: CarRaceQuestionItem[]
): CarRaceMatchState {
  return recomputeCarRaceState({
    config: { ...config, questionCount: questionOrder.length, rulesLocked: true },
    questionOrder,
    history: [],
    currentQuestionIndex: 0,
    endedEarly: false,
  });
}

/**
 * Preview stage gain and Turbo activation BEFORE confirming the current turn.
 */
export function previewCarRaceTurnOutcomes(
  state: CarRaceMatchState,
  verdictsByTeam: Record<string, CarRaceVerdict>
): Record<string, CarTurnPreview> {
  const result: Record<string, CarTurnPreview> = {};
  for (const team of state.config.teams) {
    const rt = state.teamRuntime[team.id];
    const verdict = verdictsByTeam[team.id] ?? 'ungraded';
    if (verdict === 'ungraded') {
      result[team.id] = {
        teamId: team.id,
        verdict: 'ungraded',
        stageBefore: rt.stage,
        stageAfter: rt.stage,
        stagesGained: 0,
        willTriggerTurbo: false,
        streakAfter: rt.currentStreak,
      };
      continue;
    }

    const delta = computeSingleStepDelta(
      rt.stage,
      rt.currentStreak,
      verdict,
      state.config.turboEnabled
    );
    result[team.id] = {
      teamId: team.id,
      verdict,
      stageBefore: rt.stage,
      stageAfter: delta.stageAfter,
      stagesGained: delta.stagesGained,
      willTriggerTurbo: delta.turboTriggered,
      streakAfter: delta.streakAfter,
    };
  }
  return result;
}

/**
 * Atomic idempotent commit for all cars on the current question.
 * - Blocks duplicate commits for the same questionId (protects against double-clicks & stale events).
 * - Requires EVERY team to have verdict !== 'ungraded'.
 */
export function commitCarRaceTurnResult(
  state: CarRaceMatchState,
  input: {
    question: CarRaceQuestionItem;
    verdictsByTeam: Record<string, CarRaceVerdict>;
    selectedOptionByTeam?: Record<string, string | undefined>;
    answerNotesByTeam?: Record<string, string | undefined>;
    resultSource: 'teacher_single_device' | 'student_auto';
    committedAt?: number;
  }
): {
  state: CarRaceMatchState;
  committed: boolean;
  reason?: string;
  record?: CarRaceTurnRecord;
} {
  if (state.status !== 'playing') {
    return { state, committed: false, reason: 'match_already_finished' };
  }

  if (state.history.some((h) => h.questionId === input.question.id)) {
    return { state, committed: false, reason: 'duplicate_question_commit' };
  }

  for (const team of state.config.teams) {
    const v = input.verdictsByTeam[team.id];
    if (!v || v === 'ungraded') {
      return { state, committed: false, reason: 'ungraded_team' };
    }
  }

  const teamOutcomes: Record<string, CarTeamTurnOutcome> = {};
  for (const team of state.config.teams) {
    const rt = state.teamRuntime[team.id];
    const verdict = input.verdictsByTeam[team.id];
    const delta = computeSingleStepDelta(
      rt.stage,
      rt.currentStreak,
      verdict,
      state.config.turboEnabled
    );
    teamOutcomes[team.id] = {
      teamId: team.id,
      verdict,
      selectedOptionId: input.selectedOptionByTeam?.[team.id],
      answerNote: input.answerNotesByTeam?.[team.id]?.trim() || undefined,
      stageBefore: rt.stage,
      stageAfter: delta.stageAfter,
      stagesGained: delta.stagesGained,
      turboTriggered: delta.turboTriggered,
      streakBefore: rt.currentStreak,
      streakAfter: delta.streakAfter,
    };
  }

  const record: CarRaceTurnRecord = {
    turnIndex: state.history.length,
    questionId: input.question.id,
    questionCode: input.question.code,
    questionStem: input.question.stem,
    officialAnswerText: input.question.officialAnswerText,
    explanation: input.question.explanation,
    teamOutcomes,
    resultSource: input.resultSource,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextState = recomputeCarRaceState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: [...state.history, record],
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
 * Edit the most recently confirmed turn BEFORE advancing to the next question or finalizing summary.
 * Recomputes stage, correctCount, currentStreak, turboCount, and rankings from full history.
 */
export function editLastConfirmedCarRaceTurn(
  state: CarRaceMatchState,
  verdictsByTeam: Record<string, CarRaceVerdict>,
  selectedOptionByTeam?: Record<string, string | undefined>
): { state: CarRaceMatchState; edited: boolean; record?: CarRaceTurnRecord } {
  if (state.history.length === 0) {
    return { state, edited: false };
  }

  for (const team of state.config.teams) {
    const v = verdictsByTeam[team.id];
    if (!v || v === 'ungraded') {
      return { state, edited: false };
    }
  }

  const lastIdx = state.history.length - 1;
  const last = state.history[lastIdx];
  const updatedOutcomes: Record<string, CarTeamTurnOutcome> = {};

  for (const team of state.config.teams) {
    const prev = last.teamOutcomes[team.id];
    updatedOutcomes[team.id] = {
      ...prev,
      verdict: verdictsByTeam[team.id],
      selectedOptionId:
        selectedOptionByTeam && team.id in selectedOptionByTeam
          ? selectedOptionByTeam[team.id]
          : prev?.selectedOptionId,
    };
  }

  const updatedHistory = [...state.history];
  updatedHistory[lastIdx] = {
    ...last,
    teamOutcomes: updatedOutcomes,
    wasEdited: true,
    committedAt: Date.now(),
  };

  const nextState = recomputeCarRaceState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: updatedHistory,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: false,
  });

  return {
    state: nextState,
    edited: true,
    record: nextState.history[lastIdx],
  };
}

export function advanceCarRaceToNextQuestion(state: CarRaceMatchState): CarRaceMatchState {
  if (state.status !== 'playing') return state;
  const nextIdx = Math.min(state.questionOrder.length - 1, state.history.length);
  return {
    ...state,
    currentQuestionIndex: nextIdx,
  };
}

export function endCarRaceEarly(state: CarRaceMatchState): CarRaceMatchState {
  if (state.status !== 'playing') return state;
  return recomputeCarRaceState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: state.history,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: true,
  });
}

/**
 * Competition ranking strictly by total stage (equal stage => exact same rank, isTied: true).
 * Correct count is preserved separately for teacher learning insight.
 */
export function computeCarRaceStandings(state: CarRaceMatchState): CarRaceStanding[] {
  const list: CarRaceStanding[] = state.config.teams.map((team) => {
    const rt = state.teamRuntime[team.id];
    return {
      teamId: team.id,
      carNumber: rt.carNumber,
      name: rt.name,
      paletteIndex: rt.paletteIndex,
      stage: rt.stage,
      correctCount: rt.correctCount,
      turboCount: rt.turboCount,
      rank: 1,
      isTied: false,
    };
  });

  // Sort strictly by stage descending (preserve carNumber order on equal stage)
  list.sort((a, b) => b.stage - a.stage || a.carNumber - b.carNumber);

  const stageFreq = new Map<number, number>();
  list.forEach((item) => {
    stageFreq.set(item.stage, (stageFreq.get(item.stage) || 0) + 1);
  });

  for (let i = 0; i < list.length; i++) {
    if (i > 0 && list[i].stage === list[i - 1].stage) {
      list[i].rank = list[i - 1].rank;
    } else {
      list[i].rank = i + 1;
    }
    list[i].isTied = (stageFreq.get(list[i].stage) || 0) > 1;
  }

  return list;
}

// ============================================================================
// SESSION PERSISTENCE (DEMO-ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredD04SessionPayload {
  version: number;
  config: CarRaceMatchConfig;
  questionOrder: CarRaceQuestionItem[];
  history: CarRaceTurnRecord[];
  currentQuestionIndex: number;
  endedEarly: boolean;
  updatedAt: number;
}

export function getD04SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D04_SESSION_STORAGE_KEY}`
    : D04_SESSION_STORAGE_KEY;
}

export function saveD04Session(state: CarRaceMatchState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredD04SessionPayload = {
      version: D04_SESSION_VERSION,
      config: state.config,
      questionOrder: state.questionOrder,
      history: state.history,
      currentQuestionIndex: state.currentQuestionIndex,
      endedEarly: state.endedEarly,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getD04SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function clearD04Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD04SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadD04Session(): {
  state: CarRaceMatchState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getD04SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredD04SessionPayload>;
    if (
      !parsed ||
      parsed.version !== D04_SESSION_VERSION ||
      !parsed.config ||
      !Array.isArray(parsed.config.teams) ||
      parsed.config.teams.length === 0 ||
      !Array.isArray(parsed.questionOrder) ||
      parsed.questionOrder.length === 0 ||
      !Array.isArray(parsed.history)
    ) {
      clearD04Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const modeValid =
      parsed.config.mode === 'team_race' || parsed.config.mode === 'solo_practice';
    if (!modeValid) {
      clearD04Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const restored = recomputeCarRaceState({
      config: parsed.config,
      questionOrder: parsed.questionOrder,
      history: parsed.history,
      currentQuestionIndex:
        typeof parsed.currentQuestionIndex === 'number'
          ? parsed.currentQuestionIndex
          : undefined,
      endedEarly: Boolean(parsed.endedEarly),
    });

    return { state: restored, recoveredFromCorruption: false };
  } catch {
    clearD04Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
