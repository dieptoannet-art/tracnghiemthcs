/**
 * E01 — NHẢY THEO LỆNH 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine supporting:
 * 1. Mode "Làm theo lệnh" ('follow_command'): 2–3 minute classroom warm-up
 *    - Default 8 turns, 4-step cadence (demo -> prepare -> execute -> rest)
 *    - Standing ("Tại chỗ", optional light step in place) & Seated ("Ngồi tại bàn")
 *    - Never scores speed or gesture accuracy; summarizes completed turns only
 * 2. Mode "Giải Toán – Ra động tác" ('math_gesture'):
 *    - Supports Solo Practice (1 student), Whole Class (1–50 students, non-scored), or 2–6 Teams (scored)
 *    - Persistent A/B/C/D <-> Gesture conversion table
 *    - Strict anti-spoiler state machine: instructor stays in 'ready_wait' until answers are locked
 *    - Stable option-ID grading & dynamic correct-gesture lookup even after option shuffling
 *    - 10 points for correct, 0 for incorrect/no_answer; equal points => "Đồng hạng"
 *    - Explicit distinction between 'ungraded' ("Chưa chấm") and 'no_answer' ("Không trả lời")
 *    - Zero camera / pose detection / fabricated observation results
 * 3. Sample pack "Nhảy theo lệnh – Toán THCS" (8 questions, "Dữ liệu mẫu") with all 5 mandatory cases
 * 4. Smart EDU RBAC question bank adapter & demo-isolated session persistence
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type JumpCommandMode = 'follow_command' | 'math_gesture';
export type JumpPostureSetting = 'standing' | 'seated';
export type MathGestureParticipantMode = 'whole_class' | 'teams' | 'solo_practice';
export type JumpOptionLetter = 'A' | 'B' | 'C' | 'D';

export type JumpGestureId =
  | 'ready_wait'
  | 'raise_one_hand'
  | 'raise_two_hands'
  | 'palms_at_chest'
  | 'hands_on_thighs'
  | 'step_in_place';

export type FollowTurnSubPhase = 'demo' | 'prepare' | 'execute' | 'rest';
export type MathTurnSubPhase = 'thinking' | 'execute_collect' | 'revealed';

export type JumpTeamVerdict = 'ungraded' | 'A' | 'B' | 'C' | 'D' | 'no_answer';
export type JumpSessionStatus = 'playing' | 'finished';
export type JumpQuestionSource = 'sample' | 'bank';

export interface JumpGestureSpec {
  id: Exclude<JumpGestureId, 'ready_wait'>;
  name: string;
  shortLabel: string;
  optionLetter?: JumpOptionLetter;
  standingOnly?: boolean;
  standingGuide: string;
  seatedGuide: string;
  cardFallbackText: string;
  accentHex: string;
}

export const E01_GESTURES: JumpGestureSpec[] = [
  {
    id: 'raise_one_hand',
    name: 'Giơ một tay',
    shortLabel: 'Giơ 1 tay',
    optionLetter: 'A',
    standingGuide: 'Đứng thẳng tại chỗ, giơ cao tay phải thẳng lên trên.',
    seatedGuide: 'Ngồi ngay ngắn tại bàn, giơ cao tay phải rõ ràng.',
    cardFallbackText: 'Giơ thẻ A hoặc chọn A trên màn hình',
    accentHex: '#0D9488',
  },
  {
    id: 'raise_two_hands',
    name: 'Giơ hai tay',
    shortLabel: 'Giơ 2 tay',
    optionLetter: 'B',
    standingGuide: 'Đứng thẳng tại chỗ, giơ đồng thời cả hai tay lên cao hình chữ V.',
    seatedGuide: 'Ngồi thẳng lưng tại bàn, giơ đồng thời cả hai tay lên cao.',
    cardFallbackText: 'Giơ thẻ B hoặc chọn B trên màn hình',
    accentHex: '#EAB308',
  },
  {
    id: 'palms_at_chest',
    name: 'Chạm hai lòng bàn tay trước ngực',
    shortLabel: 'Chạm tay trước ngực',
    optionLetter: 'C',
    standingGuide: 'Đứng tại chỗ, gập khuỷu tay và chạm hai lòng bàn tay trước ngực.',
    seatedGuide: 'Ngồi tại bàn, chụm hai lòng bàn tay rõ ràng trước ngực.',
    cardFallbackText: 'Giơ thẻ C hoặc chọn C trên màn hình',
    accentHex: '#2563EB',
  },
  {
    id: 'hands_on_thighs',
    name: 'Đặt hai tay lên đùi',
    shortLabel: 'Hai tay lên đùi',
    optionLetter: 'D',
    standingGuide: 'Đứng thoải mái tại chỗ, đặt gọn hai bàn tay lên mặt trước hai đùi.',
    seatedGuide: 'Ngồi ngay ngắn tại bàn, đặt hai bàn tay lên hai đùi.',
    cardFallbackText: 'Giơ thẻ D hoặc chọn D trên màn hình',
    accentHex: '#EA580C',
  },
  {
    id: 'step_in_place',
    name: 'Bước nhẹ tại chỗ',
    shortLabel: 'Bước tại chỗ',
    standingOnly: true,
    standingGuide: 'Đứng tại vị trí, nâng gối bước nhẹ nhàng trái – phải tại chỗ, không nhảy rời vị trí.',
    seatedGuide: 'Chỉ dùng ở chế độ đứng “Tại chỗ”.',
    cardFallbackText: 'Hoặc gõ nhẹ hai bàn tay theo nhịp trên mặt bàn',
    accentHex: '#7C3AED',
  },
];

export const OPTION_TO_GESTURE_MAP: Record<JumpOptionLetter, Exclude<JumpGestureId, 'ready_wait'>> = {
  A: 'raise_one_hand',
  B: 'raise_two_hands',
  C: 'palms_at_chest',
  D: 'hands_on_thighs',
};

export const E01_POINTS_CORRECT = 10;
export const E01_POINTS_INCORRECT = 0;

export const E01_SAMPLE_PACK_TITLE = 'Nhảy theo lệnh – Toán THCS';
export const E01_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const E01_SESSION_STORAGE_KEY = 'taydo_e01_jump_command_session_v1';
export const E01_SESSION_VERSION = 1;

export interface JumpTeamPalette {
  id: string;
  hex: string;
  textOnSolid: string;
}

export const JUMP_TEAM_PALETTES: JumpTeamPalette[] = [
  { id: 'teal', hex: '#0D9488', textOnSolid: '#FFFFFF' },
  { id: 'gold', hex: '#EAB308', textOnSolid: '#071226' },
  { id: 'blue', hex: '#2563EB', textOnSolid: '#FFFFFF' },
  { id: 'orange', hex: '#EA580C', textOnSolid: '#FFFFFF' },
  { id: 'violet', hex: '#7C3AED', textOnSolid: '#FFFFFF' },
  { id: 'rose', hex: '#E11D48', textOnSolid: '#FFFFFF' },
];

export interface JumpTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

export interface JumpQuestionOption {
  id: string; // Stable option ID (never tied to A/B/C/D array index)
  label: JumpOptionLetter;
  text: string;
}

export interface JumpQuestionItem {
  id: string;
  code: string;
  stem: string;
  image?: string;
  subject: string;
  topic?: string;
  grade: string;
  level: string;
  options: JumpQuestionOption[]; // Always 4 options A-D for A/B/C/D gesture mapping
  correctOptionId: string;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface JumpCommandConfig {
  mode: JumpCommandMode;
  posture: JumpPostureSetting;
  // Follow-Command settings
  followTurnCount: number; // Default 8
  selectedFollowGestureIds: Array<Exclude<JumpGestureId, 'ready_wait'>>;
  followControlStyle: 'teacher_class' | 'solo_screen';
  followUseCountdown: boolean; // 3-2-1 countdown before "Thực hiện"
  // Math-Gesture settings
  participantMode: MathGestureParticipantMode;
  teams: JumpTeamConfig[];
  sourceKind: JumpQuestionSource;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  mathQuestionCount: number; // Default 8
  thinkTimerSeconds: number; // Default 20; 0 = unlimited
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
}

export interface FollowTurnRecord {
  turnIndex: number;
  gestureId: Exclude<JumpGestureId, 'ready_wait'>;
  completedAt: number;
}

export interface MathGestureTurnRecord {
  turnIndex: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  correctOptionId: string;
  correctOptionLabel: JumpOptionLetter;
  correctGestureId: Exclude<JumpGestureId, 'ready_wait'>;
  // For 'teams' or 'solo_practice'; empty for non-scored 'whole_class'
  choiceByParticipant: Record<string, JumpOptionLetter | 'no_answer'>;
  isCorrectByParticipant: Record<string, boolean>;
  pointsDeltaByParticipant: Record<string, number>;
  resultMode: 'scored_teams' | 'solo_auto' | 'non_scored_class';
  committedAt: number;
  wasEdited?: boolean;
}

export interface JumpParticipantScore {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  points: number;
  correctCount: number;
  answeredCount: number;
  rank: number;
  isTied: boolean;
}

export interface JumpCommandState {
  config: JumpCommandConfig;
  // Follow-Command schedule & progress
  followSequence: Array<Exclude<JumpGestureId, 'ready_wait'>>;
  followHistory: FollowTurnRecord[];
  // Math-Gesture schedule & progress
  questionOrder: JumpQuestionItem[];
  mathHistory: MathGestureTurnRecord[];
  // Active pointer
  currentTurnIndex: number;
  status: JumpSessionStatus;
}

export interface JumpSetupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveTurnCount: number;
}

const OPTION_LETTERS: JumpOptionLetter[] = ['A', 'B', 'C', 'D'];

// ============================================================================
// 8-QUESTION SAMPLE PACK: "Nhảy theo lệnh – Toán THCS" ("Dữ liệu mẫu")
// Includes ALL 5 mandatory prompt cases verbatim; correct options distributed A–D
// ============================================================================

export const E01_SAMPLE_QUESTIONS: JumpQuestionItem[] = [
  {
    id: 'e01_sample_01',
    code: 'E01-M01',
    stem: 'Tính \\(\\frac{3}{4} - \\frac{1}{2}\\).',
    subject: 'math',
    topic: 'Phân số',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e01_s01_a', label: 'A', text: '\\(\\frac{1}{4}\\)' },
      { id: 'e01_s01_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e01_s01_c', label: 'C', text: '\\(\\frac{2}{2}\\)' },
      { id: 'e01_s01_d', label: 'D', text: '\\(\\frac{5}{4}\\)' },
    ],
    correctOptionId: 'e01_s01_a',
    officialAnswerText: '\\(\\frac{1}{4}\\)',
    explanation:
      'Quy đồng mẫu chung \\(4\\): \\(\\frac{1}{2} = \\frac{2}{4}\\). Vậy \\(\\frac{3}{4} - \\frac{2}{4} = \\frac{1}{4}\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_02',
    code: 'E01-M02',
    stem: 'Tính \\((-3)^2\\).',
    subject: 'math',
    topic: 'Lũy thừa số nguyên',
    grade: '6',
    level: 'understand',
    options: [
      { id: 'e01_s02_a', label: 'A', text: '\\(-9\\)' },
      { id: 'e01_s02_b', label: 'B', text: '\\(9\\)' },
      { id: 'e01_s02_c', label: 'C', text: '\\(-6\\)' },
      { id: 'e01_s02_d', label: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'e01_s02_b',
    officialAnswerText: '\\(9\\)',
    explanation:
      'Bình phương của số âm luôn dương: \\((-3)^2 = (-3) \\times (-3) = 9\\) (tránh nhầm với \\(-3^2 = -9\\)).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_03',
    code: 'E01-M03',
    stem: 'Tính \\(\\sqrt{(-5)^2}\\).',
    subject: 'math',
    topic: 'Căn bậc hai',
    grade: '9',
    level: 'understand',
    options: [
      { id: 'e01_s03_a', label: 'A', text: '\\(-5\\)' },
      { id: 'e01_s03_b', label: 'B', text: '\\(25\\)' },
      { id: 'e01_s03_c', label: 'C', text: '\\(5\\)' },
      { id: 'e01_s03_d', label: 'D', text: '\\(\\pm 5\\)' },
    ],
    correctOptionId: 'e01_s03_c',
    officialAnswerText: '\\(5\\)',
    explanation: 'Áp dụng hằng đẳng thức \\(\\sqrt{a^2} = |a|\\), ta có \\(\\sqrt{(-5)^2} = |-5| = 5\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_04',
    code: 'E01-M04',
    stem: 'Tìm \\(x\\) biết \\(2x + 3 = 11\\).',
    subject: 'math',
    topic: 'Phương trình bậc nhất',
    grade: '8',
    level: 'know',
    options: [
      { id: 'e01_s04_a', label: 'A', text: '\\(x = 7\\)' },
      { id: 'e01_s04_b', label: 'B', text: '\\(x = 5\\)' },
      { id: 'e01_s04_c', label: 'C', text: '\\(x = 3\\)' },
      { id: 'e01_s04_d', label: 'D', text: '\\(x = 4\\)' },
    ],
    correctOptionId: 'e01_s04_d',
    officialAnswerText: '\\(x = 4\\)',
    explanation: 'Chuyển vế: \\(2x = 11 - 3 = 8 \\Rightarrow x = \\frac{8}{2} = 4\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_05',
    code: 'E01-M05',
    stem: 'Tung một xúc xắc cân đối sáu mặt. Xác suất để mặt xuất hiện có số chấm là số chẵn bằng bao nhiêu?',
    subject: 'math',
    topic: 'Xác suất',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e01_s05_a', label: 'A', text: '\\(\\frac{3}{6} = \\frac{1}{2}\\)' },
      { id: 'e01_s05_b', label: 'B', text: '\\(\\frac{1}{6}\\)' },
      { id: 'e01_s05_c', label: 'C', text: '\\(\\frac{2}{3}\\)' },
      { id: 'e01_s05_d', label: 'D', text: '\\(\\frac{1}{3}\\)' },
    ],
    correctOptionId: 'e01_s05_a',
    officialAnswerText: '\\(\\frac{3}{6} = \\frac{1}{2}\\)',
    explanation:
      'Xúc xắc có \\(6\\) kết quả đồng khả năng; các mặt chẵn là \\(2, 4, 6\\) (\\(3\\) mặt). Xác suất là \\(\\frac{3}{6} = \\frac{1}{2}\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_06',
    code: 'E01-M06',
    stem: 'Rút gọn biểu thức \\(3(x - 2) + 2x\\).',
    subject: 'math',
    topic: 'Biểu thức đại số',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e01_s06_a', label: 'A', text: '\\(5x - 2\\)' },
      { id: 'e01_s06_b', label: 'B', text: '\\(5x - 6\\)' },
      { id: 'e01_s06_c', label: 'C', text: '\\(x - 6\\)' },
      { id: 'e01_s06_d', label: 'D', text: '\\(5x + 6\\)' },
    ],
    correctOptionId: 'e01_s06_b',
    officialAnswerText: '\\(5x - 6\\)',
    explanation: 'Nhân phân phối rồi thu gọn: \\(3(x - 2) + 2x = 3x - 6 + 2x = 5x - 6\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_07',
    code: 'E01-M07',
    stem: 'Một tam giác có độ dài cạnh đáy \\(8\\,\\mathrm{cm}\\) và chiều cao tương ứng \\(5\\,\\mathrm{cm}\\). Diện tích tam giác đó là bao nhiêu?',
    subject: 'math',
    topic: 'Hình học phẳng',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e01_s07_a', label: 'A', text: '\\(40\\,\\mathrm{cm}^2\\)' },
      { id: 'e01_s07_b', label: 'B', text: '\\(13\\,\\mathrm{cm}^2\\)' },
      { id: 'e01_s07_c', label: 'C', text: '\\(20\\,\\mathrm{cm}^2\\)' },
      { id: 'e01_s07_d', label: 'D', text: '\\(26\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'e01_s07_c',
    officialAnswerText: '\\(20\\,\\mathrm{cm}^2\\)',
    explanation: 'Diện tích tam giác là \\(S = \\frac{1}{2} \\times 8 \\times 5 = 20\\,\\mathrm{cm}^2\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
  {
    id: 'e01_sample_08',
    code: 'E01-M08',
    stem: 'Tính giá trị biểu thức sau: \\[\\frac{2^3 + 4}{3} - \\sqrt{9}\\]',
    subject: 'math',
    topic: 'Thứ tự thực hiện phép tính',
    grade: '7',
    level: 'apply',
    options: [
      { id: 'e01_s08_a', label: 'A', text: '\\(7\\)' },
      { id: 'e01_s08_b', label: 'B', text: '\\(3\\)' },
      { id: 'e01_s08_c', label: 'C', text: '\\(-1\\)' },
      { id: 'e01_s08_d', label: 'D', text: '\\(1\\)' },
    ],
    correctOptionId: 'e01_s08_d',
    officialAnswerText: '\\(1\\)',
    explanation:
      'Ta có \\(2^3 = 8\\), \\(\\frac{8 + 4}{3} = 4\\) và \\(\\sqrt{9} = 3\\). Vậy \\(4 - 3 = 1\\).',
    isSample: true,
    sourceBadge: E01_SAMPLE_BADGE,
  },
];

// ============================================================================
// GESTURE & OPTION RESOLUTION HELPERS
// ============================================================================

export function getGestureSpec(
  id: Exclude<JumpGestureId, 'ready_wait'>
): JumpGestureSpec {
  return E01_GESTURES.find((g) => g.id === id) || E01_GESTURES[0];
}

export function getAllowedGesturesForPosture(
  posture: JumpPostureSetting
): JumpGestureSpec[] {
  return E01_GESTURES.filter((g) => !(posture === 'seated' && g.standingOnly));
}

export function getGestureIdForOptionLabel(
  label: JumpOptionLetter
): Exclude<JumpGestureId, 'ready_wait'> {
  return OPTION_TO_GESTURE_MAP[label];
}

/**
 * Resolves the current A/B/C/D label of a question's correct option strictly by `correctOptionId`,
 * guaranteeing shuffled options ALWAYS grade accurately and animate the matching gesture!
 */
export function getCorrectOptionLabelForQuestion(
  question: JumpQuestionItem
): JumpOptionLetter {
  const matched = question.options.find((o) => o.id === question.correctOptionId);
  return matched ? matched.label : 'A';
}

export function getCorrectGestureIdForQuestion(
  question: JumpQuestionItem
): Exclude<JumpGestureId, 'ready_wait'> {
  return getGestureIdForOptionLabel(getCorrectOptionLabelForQuestion(question));
}

/**
 * Anti-spoiler instructor pose resolver:
 * - In 'math_gesture', instructor STRICTLY holds 'ready_wait' during 'thinking' and 'execute_collect',
 *   and ONLY demonstrates the correct gesture in 'revealed' (after answers are locked)!
 * - In 'follow_command', instructor demonstrates in 'demo' & 'execute', and holds 'ready_wait' in 'prepare' & 'rest'.
 */
export function resolveInstructorGestureForPhase(params: {
  mode: JumpCommandMode;
  followSubPhase?: FollowTurnSubPhase;
  activeFollowGesture?: Exclude<JumpGestureId, 'ready_wait'>;
  mathSubPhase?: MathTurnSubPhase;
  currentQuestion?: JumpQuestionItem | null;
  previewGesture?: JumpGestureId | null;
}): JumpGestureId {
  if (params.previewGesture) return params.previewGesture;

  if (params.mode === 'follow_command') {
    if (
      (params.followSubPhase === 'demo' || params.followSubPhase === 'execute') &&
      params.activeFollowGesture
    ) {
      return params.activeFollowGesture;
    }
    return 'ready_wait';
  }

  // Math-Gesture mode: NEVER reveal the answer gesture before 'revealed'
  if (params.mathSubPhase === 'revealed' && params.currentQuestion) {
    return getCorrectGestureIdForQuestion(params.currentQuestion);
  }
  return 'ready_wait';
}

// ============================================================================
// DEFAULT CONFIG, TEAMS & VALIDATION
// ============================================================================

const DEFAULT_JUMP_TEAM_NAMES = [
  'Đội Xanh Ngọc',
  'Đội Tia Nắng',
  'Đội Hải Đăng',
  'Đội Sao Mai',
  'Đội Sóng Xanh',
  'Đội Bứt Phá',
];

export function createJumpTeams(
  teamCount: number,
  existingNames?: string[]
): JumpTeamConfig[] {
  const safe = Math.max(2, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safe }, (_, idx) => ({
    id: `jteam_${idx + 1}`,
    teamNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_JUMP_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % JUMP_TEAM_PALETTES.length,
  }));
}

export function createDefaultJumpCommandConfig(
  mode: JumpCommandMode = 'follow_command'
): JumpCommandConfig {
  return {
    mode,
    posture: 'standing',
    followTurnCount: 8,
    selectedFollowGestureIds: [
      'raise_one_hand',
      'raise_two_hands',
      'palms_at_chest',
      'hands_on_thighs',
    ],
    followControlStyle: 'teacher_class',
    followUseCountdown: true,
    participantMode: 'whole_class',
    teams: createJumpTeams(4),
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    mathQuestionCount: 8,
    thinkTimerSeconds: 20,
    shuffleQuestions: false,
    shuffleOptions: true,
  };
}

export function sanitizeFollowGesturesForPosture(
  selected: Array<Exclude<JumpGestureId, 'ready_wait'>>,
  posture: JumpPostureSetting
): Array<Exclude<JumpGestureId, 'ready_wait'>> {
  const allowedIds = new Set(getAllowedGesturesForPosture(posture).map((g) => g.id));
  const filtered = selected.filter((id) => allowedIds.has(id));
  if (filtered.length > 0) return filtered;
  return ['raise_one_hand', 'raise_two_hands', 'palms_at_chest', 'hands_on_thighs'];
}

export function validateJumpSetupConfig(
  config: JumpCommandConfig,
  availableQuestionsCount: number
): JumpSetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.mode === 'follow_command') {
    const validGestures = sanitizeFollowGesturesForPosture(
      config.selectedFollowGestureIds,
      config.posture
    );
    if (validGestures.length === 0) {
      errors.push('Cần chọn ít nhất 1 động tác cho phiên Làm theo lệnh.');
    }
    const turns = Math.max(1, Math.min(20, Math.floor(config.followTurnCount || 8)));
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      effectiveTurnCount: turns,
    };
  }

  // Math-Gesture mode
  if (config.participantMode === 'teams') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ theo đội cần từ 2 đến 6 đội.');
    }
    config.teams.forEach((team, idx) => {
      if (!team.name.trim()) {
        errors.push(`Đội số ${idx + 1} chưa có tên hoặc nhãn tạm.`);
      }
    });
  }

  if (config.thinkTimerSeconds < 0 || config.thinkTimerSeconds > 300) {
    errors.push('Thời gian suy nghĩ cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  if (availableQuestionsCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện không có câu trắc nghiệm 4 phương án A–D phù hợp. Hãy đổi bộ lọc hoặc dùng bộ mẫu 8 câu.'
    );
  } else if (config.mathQuestionCount > availableQuestionsCount) {
    warnings.push(
      `Nguồn hiện có ${availableQuestionsCount} câu 4 phương án (ít hơn ${config.mathQuestionCount}). Phiên sẽ dùng đủ ${availableQuestionsCount} câu không lặp.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveTurnCount: Math.min(config.mathQuestionCount, Math.max(0, availableQuestionsCount)),
  };
}

// ============================================================================
// SHUFFLING, SEQUENCE GENERATION & RBAC BANK ADAPTER
// ============================================================================

export function shuffleJumpArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleJumpOptionsPreservingId(
  item: JumpQuestionItem,
  rng: () => number = Math.random
): JumpQuestionItem {
  const shuffled = shuffleJumpArray(item.options, rng).map((opt, idx) => ({
    ...opt,
    label: OPTION_LETTERS[idx] ?? 'D',
  }));
  return {
    ...item,
    options: shuffled,
  };
}

/**
 * Generates a balanced Follow-Command gesture sequence that avoids excessive back-to-back repeats.
 */
export function generateFollowCommandSequence(
  gestureIds: Array<Exclude<JumpGestureId, 'ready_wait'>>,
  turnCount: number,
  posture: JumpPostureSetting,
  rng: () => number = Math.random
): Array<Exclude<JumpGestureId, 'ready_wait'>> {
  const pool = sanitizeFollowGesturesForPosture(gestureIds, posture);
  const safeCount = Math.max(1, Math.min(20, Math.floor(turnCount)));
  const sequence: Array<Exclude<JumpGestureId, 'ready_wait'>> = [];

  while (sequence.length < safeCount) {
    const batch = shuffleJumpArray(pool, rng);
    if (
      pool.length > 1 &&
      sequence.length > 0 &&
      batch[0] === sequence[sequence.length - 1]
    ) {
      // Swap first two to avoid immediate consecutive duplicate
      [batch[0], batch[1]] = [batch[1], batch[0]];
    }
    for (const g of batch) {
      if (sequence.length >= safeCount) break;
      sequence.push(g);
    }
  }
  return sequence;
}

function normalizeStemKey(stem: string): string {
  return stem.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isJumpQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

/**
 * Adapts a Smart EDU Question to E01 Math-Gesture format.
 * Requires `single_choice` with exactly 4 non-empty options so A/B/C/D map cleanly to the 4 gestures.
 */
export function adaptSmartEduQuestionForJump(question: Question): JumpQuestionItem | null {
  if (question.type !== 'single_choice') return null;
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const validOptions = (question.options || [])
    .filter((o) => o && (o.text || '').trim().length > 0)
    .slice(0, 4)
    .map((o, idx) => ({
      id: String(o.id || `${question.id}_opt_${idx}`),
      label: OPTION_LETTERS[idx] ?? 'D',
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
    id: String(question.id || '').trim() || `e01q_${Math.random().toString(36).slice(2, 9)}`,
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
    explanation: (question.explanation || 'Giáo viên chốt kiến thức sau lượt vận động.').trim(),
    isSample: false,
    sourceBadge: 'Ngân hàng câu hỏi',
  };
}

export function buildE01QuestionPool(params: {
  sourceKind: JumpQuestionSource;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): JumpQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return E01_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: JumpQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isJumpQuestionAllowedForRole(raw, params.userRole)) continue;
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

    const item = adaptSmartEduQuestionForJump(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

export function prepareJumpQuestions(
  pool: JumpQuestionItem[],
  config: JumpCommandConfig,
  rng: () => number = Math.random
): JumpQuestionItem[] {
  const count = Math.max(0, Math.min(config.mathQuestionCount, pool.length));
  const selected = config.shuffleQuestions
    ? shuffleJumpArray(pool, rng).slice(0, count)
    : pool.slice(0, count);

  return config.shuffleOptions
    ? selected.map((q) => shuffleJumpOptionsPreservingId(q, rng))
    : selected.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) }));
}

// ============================================================================
// CORE DETERMINISTIC STATE TRANSITIONS & SCORING
// ============================================================================

export function createInitialJumpCommandState(params: {
  config: JumpCommandConfig;
  questionPool?: JumpQuestionItem[];
  rng?: () => number;
}): JumpCommandState {
  const rng = params.rng ?? Math.random;
  const sanitizedGestures = sanitizeFollowGesturesForPosture(
    params.config.selectedFollowGestureIds,
    params.config.posture
  );
  const cleanConfig: JumpCommandConfig = {
    ...params.config,
    selectedFollowGestureIds: sanitizedGestures,
  };

  if (cleanConfig.mode === 'follow_command') {
    const seq = generateFollowCommandSequence(
      sanitizedGestures,
      cleanConfig.followTurnCount,
      cleanConfig.posture,
      rng
    );
    return {
      config: cleanConfig,
      followSequence: seq,
      followHistory: [],
      questionOrder: [],
      mathHistory: [],
      currentTurnIndex: 0,
      status: 'playing',
    };
  }

  const preparedQs = prepareJumpQuestions(params.questionPool || E01_SAMPLE_QUESTIONS, cleanConfig, rng);
  return {
    config: cleanConfig,
    followSequence: [],
    followHistory: [],
    questionOrder: preparedQs,
    mathHistory: [],
    currentTurnIndex: 0,
    status: preparedQs.length > 0 ? 'playing' : 'finished',
  };
}

/**
 * Completes the current Follow-Command turn (idempotent by turnIndex).
 * Never assigns speed or accuracy scores.
 */
export function completeFollowCommandTurn(
  state: JumpCommandState,
  completedAt = Date.now()
): { state: JumpCommandState; committed: boolean } {
  if (state.config.mode !== 'follow_command' || state.status !== 'playing') {
    return { state, committed: false };
  }
  const idx = state.currentTurnIndex;
  const gestureId = state.followSequence[idx];
  if (!gestureId) return { state, committed: false };

  if (state.followHistory.some((h) => h.turnIndex === idx)) {
    return { state, committed: false };
  }

  const nextHistory: FollowTurnRecord[] = [
    ...state.followHistory,
    { turnIndex: idx, gestureId, completedAt },
  ];

  const isDone = nextHistory.length >= state.followSequence.length;
  return {
    committed: true,
    state: {
      ...state,
      followHistory: nextHistory,
      status: isDone ? 'finished' : 'playing',
    },
  };
}

/**
 * Commits a Math-Gesture question turn (idempotent by questionId).
 * - 'teams': requires every team to be graded (A/B/C/D or 'no_answer'; strictly blocks 'ungraded').
 * - 'solo_practice': grades single student's chosen A/B/C/D or 'no_answer' strictly by option ID.
 * - 'whole_class': records completed turn with zero fabricated observation scores.
 */
export function commitMathGestureTurn(
  state: JumpCommandState,
  input: {
    question: JumpQuestionItem;
    verdictsByParticipant?: Record<string, JumpTeamVerdict>;
    soloSelectedOptionId?: string | null;
    committedAt?: number;
  }
): {
  state: JumpCommandState;
  committed: boolean;
  reason?: string;
  record?: MathGestureTurnRecord;
} {
  if (state.config.mode !== 'math_gesture' || state.status !== 'playing') {
    return { state, committed: false, reason: 'session_not_playing' };
  }

  if (state.mathHistory.some((h) => h.questionId === input.question.id)) {
    return { state, committed: false, reason: 'duplicate_question_commit' };
  }

  const correctLabel = getCorrectOptionLabelForQuestion(input.question);
  const correctGestureId = getGestureIdForOptionLabel(correctLabel);

  const choiceByParticipant: Record<string, JumpOptionLetter | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};
  let resultMode: MathGestureTurnRecord['resultMode'] = 'non_scored_class';

  if (state.config.participantMode === 'teams') {
    resultMode = 'scored_teams';
    const verdicts = input.verdictsByParticipant || {};
    for (const team of state.config.teams) {
      const v = verdicts[team.id];
      if (!v || v === 'ungraded') {
        return { state, committed: false, reason: 'ungraded_team' };
      }
      choiceByParticipant[team.id] = v;
      const optionObj = v === 'no_answer' ? undefined : input.question.options.find((o) => o.label === v);
      const isRight = Boolean(optionObj && optionObj.id === input.question.correctOptionId);
      isCorrectByParticipant[team.id] = isRight;
      pointsDeltaByParticipant[team.id] = isRight ? E01_POINTS_CORRECT : E01_POINTS_INCORRECT;
    }
  } else if (state.config.participantMode === 'solo_practice') {
    resultMode = 'solo_auto';
    const soloId = 'solo_1';
    const pickedOpt = input.question.options.find((o) => o.id === input.soloSelectedOptionId);
    const labelChoice: JumpOptionLetter | 'no_answer' = pickedOpt ? pickedOpt.label : 'no_answer';
    const isRight = Boolean(pickedOpt && pickedOpt.id === input.question.correctOptionId);
    choiceByParticipant[soloId] = labelChoice;
    isCorrectByParticipant[soloId] = isRight;
    pointsDeltaByParticipant[soloId] = isRight ? E01_POINTS_CORRECT : E01_POINTS_INCORRECT;
  }

  const record: MathGestureTurnRecord = {
    turnIndex: state.currentTurnIndex,
    questionId: input.question.id,
    questionCode: input.question.code,
    questionStem: input.question.stem,
    officialAnswerText: input.question.officialAnswerText,
    explanation: input.question.explanation,
    correctOptionId: input.question.correctOptionId,
    correctOptionLabel: correctLabel,
    correctGestureId,
    choiceByParticipant,
    isCorrectByParticipant,
    pointsDeltaByParticipant,
    resultMode,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextHistory = [...state.mathHistory, record];
  const isDone = nextHistory.length >= state.questionOrder.length;

  return {
    committed: true,
    record,
    state: {
      ...state,
      mathHistory: nextHistory,
      status: isDone ? 'finished' : 'playing',
    },
  };
}

/**
 * Edits the most recently graded Math-Gesture turn (teams mode) and recomputes points cleanly.
 */
export function editLastMathGestureTurn(
  state: JumpCommandState,
  verdictsByParticipant: Record<string, JumpTeamVerdict>
): { state: JumpCommandState; edited: boolean } {
  if (
    state.config.mode !== 'math_gesture' ||
    state.config.participantMode !== 'teams' ||
    state.mathHistory.length === 0
  ) {
    return { state, edited: false };
  }

  const lastIdx = state.mathHistory.length - 1;
  const last = state.mathHistory[lastIdx];
  const question = state.questionOrder.find((q) => q.id === last.questionId);
  if (!question) return { state, edited: false };

  const choiceByParticipant: Record<string, JumpOptionLetter | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};

  for (const team of state.config.teams) {
    const v = verdictsByParticipant[team.id];
    if (!v || v === 'ungraded') return { state, edited: false };
    choiceByParticipant[team.id] = v;
    const optionObj = v === 'no_answer' ? undefined : question.options.find((o) => o.label === v);
    const isRight = Boolean(optionObj && optionObj.id === question.correctOptionId);
    isCorrectByParticipant[team.id] = isRight;
    pointsDeltaByParticipant[team.id] = isRight ? E01_POINTS_CORRECT : E01_POINTS_INCORRECT;
  }

  const nextHistory = [...state.mathHistory];
  nextHistory[lastIdx] = {
    ...last,
    choiceByParticipant,
    isCorrectByParticipant,
    pointsDeltaByParticipant,
    wasEdited: true,
    committedAt: Date.now(),
  };

  return {
    edited: true,
    state: {
      ...state,
      mathHistory: nextHistory,
    },
  };
}

export function advanceJumpCommandTurn(state: JumpCommandState): JumpCommandState {
  if (state.status !== 'playing') return state;
  const total =
    state.config.mode === 'follow_command'
      ? state.followSequence.length
      : state.questionOrder.length;
  const completedCount =
    state.config.mode === 'follow_command'
      ? state.followHistory.length
      : state.mathHistory.length;

  const nextIdx = Math.min(Math.max(0, total - 1), completedCount);
  return {
    ...state,
    currentTurnIndex: nextIdx,
  };
}

/**
 * Pure source-of-truth standings computation for Math-Gesture ('teams' or 'solo_practice').
 * Equal points share exact same rank with isTied = true ("Đồng hạng").
 */
export function computeJumpStandings(state: JumpCommandState): JumpParticipantScore[] {
  if (state.config.mode !== 'math_gesture') return [];

  if (state.config.participantMode === 'solo_practice') {
    const soloId = 'solo_1';
    let points = 0;
    let correctCount = 0;
    let answeredCount = 0;
    state.mathHistory.forEach((rec) => {
      points += rec.pointsDeltaByParticipant[soloId] || 0;
      if (rec.isCorrectByParticipant[soloId]) correctCount += 1;
      if (rec.choiceByParticipant[soloId] && rec.choiceByParticipant[soloId] !== 'no_answer') {
        answeredCount += 1;
      }
    });
    return [
      {
        id: soloId,
        teamNumber: 1,
        name: 'Tự luyện cá nhân',
        paletteIndex: 0,
        points,
        correctCount,
        answeredCount,
        rank: 1,
        isTied: false,
      },
    ];
  }

  if (state.config.participantMode !== 'teams') {
    return [];
  }

  const rows: JumpParticipantScore[] = state.config.teams.map((team) => {
    let points = 0;
    let correctCount = 0;
    let answeredCount = 0;
    state.mathHistory.forEach((rec) => {
      points += rec.pointsDeltaByParticipant[team.id] || 0;
      if (rec.isCorrectByParticipant[team.id]) correctCount += 1;
      const c = rec.choiceByParticipant[team.id];
      if (c && c !== 'no_answer') answeredCount += 1;
    });
    return {
      id: team.id,
      teamNumber: team.teamNumber,
      name: team.name,
      paletteIndex: team.paletteIndex,
      points,
      correctCount,
      answeredCount,
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
// SESSION PERSISTENCE (DEMO-ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredE01SessionPayload {
  version: number;
  state: JumpCommandState;
  updatedAt: number;
}

export function getE01SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${E01_SESSION_STORAGE_KEY}`
    : E01_SESSION_STORAGE_KEY;
}

export function saveE01Session(state: JumpCommandState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredE01SessionPayload = {
      version: E01_SESSION_VERSION,
      state,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getE01SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearE01Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getE01SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadE01Session(): {
  state: JumpCommandState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getE01SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredE01SessionPayload>;
    const st = parsed?.state;
    if (
      !parsed ||
      parsed.version !== E01_SESSION_VERSION ||
      !st ||
      !st.config ||
      (st.config.mode !== 'follow_command' && st.config.mode !== 'math_gesture') ||
      !Array.isArray(st.followSequence) ||
      !Array.isArray(st.followHistory) ||
      !Array.isArray(st.questionOrder) ||
      !Array.isArray(st.mathHistory)
    ) {
      clearE01Session();
      return { state: null, recoveredFromCorruption: true };
    }

    if (st.config.mode === 'follow_command' && st.followSequence.length === 0) {
      clearE01Session();
      return { state: null, recoveredFromCorruption: true };
    }
    if (st.config.mode === 'math_gesture' && st.questionOrder.length === 0) {
      clearE01Session();
      return { state: null, recoveredFromCorruption: true };
    }

    return { state: st, recoveredFromCorruption: false };
  } catch {
    clearE01Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
