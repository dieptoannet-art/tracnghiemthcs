/**
 * E04 — SIMON SAYS (SIMON BẢO) 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine supporting:
 * 1. Mode "Simon bảo" ('simon_says'):
 *    - 2 non-scored warm-up turns (1 with "Simon bảo:", 1 direct) + 8 scored turns (4 with "Simon bảo:", 4 direct)
 *    - Shuffled ONCE upon session creation; every turn has exactly ONE short gesture
 *    - Single source of truth: `{ gestureId, actionText, hasSimonPrefix }` derives display text,
 *      verbatim speech text (NEVER prepends "Simon bảo" to direct commands), and expected decision
 * 2. Mode "Đúng thì làm – Toán THCS" ('math_true_do'):
 *    - 8 turns (4 True -> 'execute', 4 False -> 'hold') tagged "Dữ liệu mẫu", separated from real bank
 *    - Exact 8 mandatory THCS Math propositions & short explanations from specification
 * 3. Participant Modes:
 *    - 'solo_practice' (1 student): pick "Thực hiện" / "Giữ nguyên" directly once shown
 *    - 'whole_class' (1–50 students, non-scored): teacher leads with "Ra hiệu" & reveal; tracks completed turns only
 *    - 'teams' (2–6 teams, scored): records 'execute' | 'hold' | 'no_answer'; strictly separates 'unrecorded' ("Chưa ghi nhận")
 *      so unrecorded teams are NEVER inferred as 'hold' ("Giữ nguyên")
 * 4. Anti-spoiler pose resolver: instructor stays 'ready_wait' during thinking & signal_collect;
 *    only demonstrates gesture on reveal IF expectedDecision === 'execute'
 * 5. Scoring: +10 correct, 0 wrong/no_answer; no player elimination; ties => Đồng hạng;
 *    edit-last-turn recomputation from history; /demo-isolated persistence
 */

import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type SimonGameMode = 'simon_says' | 'math_true_do';
export type SimonPostureSetting = 'standing' | 'seated';
export type SimonParticipantMode = 'solo_practice' | 'whole_class' | 'teams';
export type SimonDecision = 'execute' | 'hold';
export type SimonTeamInput = 'unrecorded' | 'execute' | 'hold' | 'no_answer';
export type SimonTurnSubPhase = 'thinking' | 'signal_collect' | 'revealed';
export type SimonSessionStatus = 'playing' | 'finished';

export type SimonGestureId =
  | 'ready_wait'
  | 'raise_one_hand'
  | 'raise_two_hands'
  | 'palms_at_chest'
  | 'hands_on_thighs';

export type SimonActionGestureId = Exclude<SimonGestureId, 'ready_wait'>;

export const E04_POINTS_CORRECT = 10;
export const E04_POINTS_INCORRECT = 0;
export const E04_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const E04_MATH_PACK_TITLE = 'Đúng thì làm – Toán THCS';
export const E04_SESSION_STORAGE_KEY = 'taydo_e04_simon_says_session_v1';
export const E04_SESSION_VERSION = 1;

export interface SimonGestureSpec {
  id: SimonActionGestureId;
  actionText: string; // e.g. "Giơ một tay"
  standingGuide: string;
  seatedGuide: string;
  cardFallbackText: string;
}

export const E04_GESTURES: SimonGestureSpec[] = [
  {
    id: 'raise_one_hand',
    actionText: 'Giơ một tay',
    standingGuide: 'Đứng thẳng tại chỗ, giơ cao một tay thẳng lên trên.',
    seatedGuide: 'Ngồi ngay ngắn tại bàn, giơ cao một tay rõ ràng.',
    cardFallbackText: 'Hoặc giơ thẻ “Thực hiện” / bấm nút trên màn hình',
  },
  {
    id: 'raise_two_hands',
    actionText: 'Giơ hai tay',
    standingGuide: 'Đứng tại chỗ, giơ đồng thời cả hai tay lên cao.',
    seatedGuide: 'Ngồi thẳng lưng tại bàn, giơ đồng thời cả hai tay lên cao.',
    cardFallbackText: 'Hoặc giơ thẻ “Thực hiện” / bấm nút trên màn hình',
  },
  {
    id: 'palms_at_chest',
    actionText: 'Chạm hai bàn tay trước ngực',
    standingGuide: 'Đứng tại chỗ, gập khuỷu tay chạm hai lòng bàn tay trước ngực.',
    seatedGuide: 'Ngồi tại bàn, chụm hai lòng bàn tay rõ ràng trước ngực.',
    cardFallbackText: 'Hoặc giơ thẻ “Thực hiện” / bấm nút trên màn hình',
  },
  {
    id: 'hands_on_thighs',
    actionText: 'Đặt hai tay lên đùi',
    standingGuide: 'Đứng thoải mái tại chỗ, đặt gọn hai bàn tay lên hai đùi.',
    seatedGuide: 'Ngồi ngay ngắn tại bàn, đặt hai bàn tay lên hai đùi.',
    cardFallbackText: 'Hoặc giơ thẻ “Thực hiện” / bấm nút trên màn hình',
  },
];

export interface SimonTeamPalette {
  id: string;
  hex: string;
  textOnSolid: string;
}

export const SIMON_TEAM_PALETTES: SimonTeamPalette[] = [
  { id: 'teal', hex: '#0D9488', textOnSolid: '#FFFFFF' },
  { id: 'gold', hex: '#EAB308', textOnSolid: '#071226' },
  { id: 'blue', hex: '#2563EB', textOnSolid: '#FFFFFF' },
  { id: 'orange', hex: '#EA580C', textOnSolid: '#FFFFFF' },
  { id: 'violet', hex: '#7C3AED', textOnSolid: '#FFFFFF' },
  { id: 'rose', hex: '#E11D48', textOnSolid: '#FFFFFF' },
];

export interface SimonTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

/**
 * Single source of truth for EVERY turn across both modes.
 * - In 'simon_says': display text, spoken text, and expected answer are derived PURELY from
 *   `actionText` + `hasSimonPrefix` so text, voice, and grading can NEVER diverge.
 * - In 'math_true_do': `statementLatex` + `isStatementTrue` determine expected answer ('execute' vs 'hold').
 */
export interface SimonTurnItem {
  id: string;
  code: string;
  mode: SimonGameMode;
  isWarmup: boolean;
  gestureId: SimonActionGestureId;
  actionText: string;
  // Used in 'simon_says' mode
  hasSimonPrefix?: boolean;
  // Used in 'math_true_do' mode
  statementLatex?: string;
  isStatementTrue?: boolean;
  explanation: string;
  sourceBadge: string;
}

export interface SimonSaysConfig {
  mode: SimonGameMode;
  posture: SimonPostureSetting;
  participantMode: SimonParticipantMode;
  teams: SimonTeamConfig[];
  includeWarmupInSimonMode: boolean; // Default true (2 non-scored warm-up turns)
  timerSeconds: number; // Default 0 (unlimited, teacher-paced) or e.g. 10/15/20
  shuffleMathOrder: boolean;
}

export interface SimonTurnRecord {
  turnIndex: number;
  turnId: string;
  code: string;
  isWarmup: boolean;
  displayPrompt: string;
  gestureId: SimonActionGestureId;
  actionText: string;
  expectedDecision: SimonDecision;
  explanation: string;
  choiceByParticipant: Record<string, SimonDecision | 'no_answer'>;
  isCorrectByParticipant: Record<string, boolean>;
  pointsDeltaByParticipant: Record<string, number>;
  resultMode: 'scored_teams' | 'solo_auto' | 'non_scored_class' | 'warmup';
  committedAt: number;
  wasEdited?: boolean;
}

export interface SimonParticipantStanding {
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

export interface SimonSaysState {
  config: SimonSaysConfig;
  turns: SimonTurnItem[];
  history: SimonTurnRecord[];
  currentTurnIndex: number;
  status: SimonSessionStatus;
}

export interface SimonSetupValidation {
  valid: boolean;
  errors: string[];
  scoredTurnCount: number;
  warmupTurnCount: number;
}

// ============================================================================
// SINGLE-SOURCE-OF-TRUTH DERIVATION HELPERS (TEXT, SPEECH, EXPECTED ANSWER)
// ============================================================================

export function getSimonGestureSpec(id: SimonActionGestureId): SimonGestureSpec {
  return E04_GESTURES.find((g) => g.id === id) || E04_GESTURES[0];
}

/**
 * Derives the exact displayed command line in 'simon_says' mode directly from `{ actionText, hasSimonPrefix }`.
 * - hasSimonPrefix = true  => "Simon bảo: Giơ một tay."
 * - hasSimonPrefix = false => "Giơ một tay."
 */
export function buildSimonCommandDisplayText(turn: Pick<SimonTurnItem, 'mode' | 'actionText' | 'hasSimonPrefix' | 'statementLatex'>): string {
  if (turn.mode === 'simon_says') {
    const clean = turn.actionText.trim().replace(/\.$/, '');
    return turn.hasSimonPrefix ? `Simon bảo: ${clean}.` : `${clean}.`;
  }
  return (turn.statementLatex || '').trim();
}

/**
 * Derives the exact verbatim Vietnamese voice text from the exact same data fields.
 * CRITICAL: When `hasSimonPrefix === false`, NEVER adds "Simon bảo".
 */
export function buildSimonCommandSpeechText(turn: Pick<SimonTurnItem, 'mode' | 'actionText' | 'hasSimonPrefix' | 'statementLatex'>): string {
  if (turn.mode === 'simon_says') {
    return buildSimonCommandDisplayText(turn);
  }
  const cleanAction = turn.actionText.trim().replace(/\.$/, '');
  return `Mệnh đề: ${(turn.statementLatex || '').trim()}. Nếu đúng thì ${cleanAction}. Nếu sai thì giữ nguyên.`;
}

/**
 * Derives the expected decision purely from the turn's truth field.
 */
export function getExpectedDecisionForTurn(turn: SimonTurnItem): SimonDecision {
  if (turn.mode === 'simon_says') {
    return turn.hasSimonPrefix ? 'execute' : 'hold';
  }
  return turn.isStatementTrue ? 'execute' : 'hold';
}

/**
 * Strict Anti-Spoiler Instructor Pose Resolver:
 * - During 'thinking' and 'signal_collect': ALWAYS 'ready_wait' (never leaks answer!)
 * - During 'revealed': demonstrates `gestureId` ONLY if `expectedDecision === 'execute'`;
 *   otherwise remains calm in 'ready_wait' ("Giữ nguyên").
 */
export function resolveSimonInstructorPoseForPhase(params: {
  phase: SimonTurnSubPhase;
  turn: SimonTurnItem | null;
  previewGesture?: SimonGestureId | null;
}): SimonGestureId {
  if (params.previewGesture) return params.previewGesture;
  if (!params.turn || params.phase !== 'revealed') {
    return 'ready_wait';
  }
  return getExpectedDecisionForTurn(params.turn) === 'execute'
    ? params.turn.gestureId
    : 'ready_wait';
}

// ============================================================================
// SAMPLE PACKS (MODE 1: SIMON BẢO & MODE 2: ĐÚNG THÌ LÀM – TOÁN THCS)
// ============================================================================

export const E04_SIMON_WARMUP_TURNS: SimonTurnItem[] = [
  {
    id: 'e04_warmup_1',
    code: 'LQ-01',
    mode: 'simon_says',
    isWarmup: true,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    hasSimonPrefix: true,
    explanation: 'Lệnh có lời dẫn “Simon bảo:” ở đầu → chọn Thực hiện (Giơ một tay).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_warmup_2',
    code: 'LQ-02',
    mode: 'simon_says',
    isWarmup: true,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    hasSimonPrefix: false,
    explanation: 'Cùng động tác “Giơ một tay” nhưng KHÔNG có “Simon bảo:” → chọn Giữ nguyên.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
];

/**
 * 8 scored Simon Says turns: strictly 4 with "Simon bảo:" (execute) and 4 direct (hold),
 * intentionally pairing the exact same 4 short gestures under both prefix states.
 */
export const E04_SIMON_SCORED_TEMPLATE: SimonTurnItem[] = [
  {
    id: 'e04_sb_01',
    code: 'SB-01',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    hasSimonPrefix: true,
    explanation: 'Có lời dẫn “Simon bảo:” → Thực hiện: Giơ một tay.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_02',
    code: 'SB-02',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    hasSimonPrefix: false,
    explanation: 'Không có lời dẫn “Simon bảo:” → Giữ nguyên tư thế.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_03',
    code: 'SB-03',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'raise_two_hands',
    actionText: 'Giơ hai tay',
    hasSimonPrefix: true,
    explanation: 'Có lời dẫn “Simon bảo:” → Thực hiện: Giơ hai tay.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_04',
    code: 'SB-04',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'raise_two_hands',
    actionText: 'Giơ hai tay',
    hasSimonPrefix: false,
    explanation: 'Không có lời dẫn “Simon bảo:” → Giữ nguyên tư thế.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_05',
    code: 'SB-05',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'palms_at_chest',
    actionText: 'Chạm hai bàn tay trước ngực',
    hasSimonPrefix: true,
    explanation: 'Có lời dẫn “Simon bảo:” → Thực hiện: Chạm hai bàn tay trước ngực.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_06',
    code: 'SB-06',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'palms_at_chest',
    actionText: 'Chạm hai bàn tay trước ngực',
    hasSimonPrefix: false,
    explanation: 'Không có lời dẫn “Simon bảo:” → Giữ nguyên tư thế.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_07',
    code: 'SB-07',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'hands_on_thighs',
    actionText: 'Đặt hai tay lên đùi',
    hasSimonPrefix: true,
    explanation: 'Có lời dẫn “Simon bảo:” → Thực hiện: Đặt hai tay lên đùi.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_sb_08',
    code: 'SB-08',
    mode: 'simon_says',
    isWarmup: false,
    gestureId: 'hands_on_thighs',
    actionText: 'Đặt hai tay lên đùi',
    hasSimonPrefix: false,
    explanation: 'Không có lời dẫn “Simon bảo:” → Giữ nguyên tư thế.',
    sourceBadge: E04_SAMPLE_BADGE,
  },
];

/**
 * Exact 8-turn THCS Math sample pack ("Đúng thì làm" — 4 True, 4 False, tagged "Dữ liệu mẫu").
 */
export const E04_MATH_TRUE_DO_ITEMS: SimonTurnItem[] = [
  {
    id: 'e04_mt_01',
    code: 'MT-01',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    statementLatex: '\\(\\frac{1}{2} + \\frac{1}{4} = \\frac{3}{4}\\)',
    isStatementTrue: true,
    explanation: 'Mệnh đề ĐÚNG → Thực hiện. Quy đồng \\(\\frac{1}{2} = \\frac{2}{4}\\), suy ra \\(\\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_02',
    code: 'MT-02',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'raise_two_hands',
    actionText: 'Giơ hai tay',
    statementLatex: '\\((-3)^2 = -9\\)',
    isStatementTrue: false,
    explanation: 'Mệnh đề SAI → Giữ nguyên. Bình phương của \\(-3\\) bằng \\(9\\), vì \\((-3)\\times(-3) = 9\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_03',
    code: 'MT-03',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'palms_at_chest',
    actionText: 'Chạm hai bàn tay trước ngực',
    statementLatex: '\\(\\sqrt{49} = 7\\)',
    isStatementTrue: true,
    explanation: 'Mệnh đề ĐÚNG → Thực hiện. Căn bậc hai số học của \\(49\\) là \\(7\\) (vì \\(7 > 0\\) và \\(7^2 = 49\\)).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_04',
    code: 'MT-04',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'hands_on_thighs',
    actionText: 'Đặt hai tay lên đùi',
    statementLatex: '\\(-8 > -3\\)',
    isStatementTrue: false,
    explanation: 'Mệnh đề SAI → Giữ nguyên. Trên trục số, \\(-8\\) nằm bên trái \\(-3\\), nên \\(-8 < -3\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_05',
    code: 'MT-05',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'raise_one_hand',
    actionText: 'Giơ một tay',
    statementLatex: '\\(25\\%\\) của \\(60\\) bằng \\(15\\)',
    isStatementTrue: true,
    explanation: 'Mệnh đề ĐÚNG → Thực hiện. Một phần tư của \\(60\\) bằng \\(60 \\times \\frac{25}{100} = 15\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_06',
    code: 'MT-06',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'raise_two_hands',
    actionText: 'Giơ hai tay',
    statementLatex: 'Hình vuông cạnh \\(5\\,\\mathrm{cm}\\) có chu vi \\(25\\,\\mathrm{cm}\\)',
    isStatementTrue: false,
    explanation: 'Mệnh đề SAI → Giữ nguyên. Chu vi hình vuông là \\(4 \\times 5 = 20\\,\\mathrm{cm}\\) (còn \\(25\\,\\mathrm{cm}^2\\) là diện tích).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_07',
    code: 'MT-07',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'palms_at_chest',
    actionText: 'Chạm hai bàn tay trước ngực',
    statementLatex: '\\(x = 4\\) là nghiệm của \\(2x + 3 = 11\\)',
    isStatementTrue: true,
    explanation: 'Mệnh đề ĐÚNG → Thực hiện. Thay \\(x = 4\\) vào vế trái được \\(2 \\times 4 + 3 = 11\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
  {
    id: 'e04_mt_08',
    code: 'MT-08',
    mode: 'math_true_do',
    isWarmup: false,
    gestureId: 'hands_on_thighs',
    actionText: 'Đặt hai tay lên đùi',
    statementLatex: 'Tung một xúc xắc cân đối sáu mặt, xác suất ra số chẵn là \\(\\frac{1}{3}\\)',
    isStatementTrue: false,
    explanation: 'Mệnh đề SAI → Giữ nguyên. Có \\(3\\) mặt chẵn (\\(2, 4, 6\\)) trong \\(6\\) mặt, nên xác suất là \\(\\frac{3}{6} = \\frac{1}{2}\\).',
    sourceBadge: E04_SAMPLE_BADGE,
  },
];

// ============================================================================
// DEFAULT CONFIG, TEAMS, SHUFFLING & VALIDATION
// ============================================================================

const DEFAULT_SIMON_TEAM_NAMES = [
  'Đội Xanh Ngọc',
  'Đội Tia Nắng',
  'Đội Hải Đăng',
  'Đội Sao Mai',
  'Đội Sóng Xanh',
  'Đội Bứt Phá',
];

export function createSimonTeams(teamCount: number, existingNames?: string[]): SimonTeamConfig[] {
  const safe = Math.max(2, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safe }, (_, idx) => ({
    id: `steam_${idx + 1}`,
    teamNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_SIMON_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % SIMON_TEAM_PALETTES.length,
  }));
}

export function createDefaultSimonSaysConfig(
  mode: SimonGameMode = 'simon_says'
): SimonSaysConfig {
  return {
    mode,
    posture: 'standing',
    participantMode: 'whole_class',
    teams: createSimonTeams(4),
    includeWarmupInSimonMode: true,
    timerSeconds: 0, // Default teacher-paced unlimited time; optional 10/15/20s
    shuffleMathOrder: false,
  };
}

export function shuffleSimonArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function validateSimonSetupConfig(config: SimonSaysConfig): SimonSetupValidation {
  const errors: string[] = [];
  if (config.participantMode === 'teams') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ nhiều đội cần từ 2 đến 6 đội.');
    }
    config.teams.forEach((t, idx) => {
      if (!t.name.trim()) {
        errors.push(`Đội số ${idx + 1} chưa có tên.`);
      }
    });
  }
  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  const warmupTurnCount =
    config.mode === 'simon_says' && config.includeWarmupInSimonMode ? E04_SIMON_WARMUP_TURNS.length : 0;
  const scoredTurnCount =
    config.mode === 'simon_says' ? E04_SIMON_SCORED_TEMPLATE.length : E04_MATH_TRUE_DO_ITEMS.length;

  return {
    valid: errors.length === 0,
    errors,
    scoredTurnCount,
    warmupTurnCount,
  };
}

// ============================================================================
// CORE DETERMINISTIC STATE TRANSITIONS & SCORING
// ============================================================================

export function createInitialSimonSaysState(params: {
  config: SimonSaysConfig;
  rng?: () => number;
}): SimonSaysState {
  const rng = params.rng ?? Math.random;
  let turns: SimonTurnItem[];

  if (params.config.mode === 'simon_says') {
    // Shuffle the 8 scored turns ONCE when creating the session
    const scored = shuffleSimonArray(E04_SIMON_SCORED_TEMPLATE, rng).map((t) => ({ ...t }));
    const warmups = params.config.includeWarmupInSimonMode
      ? E04_SIMON_WARMUP_TURNS.map((t) => ({ ...t }))
      : [];
    turns = [...warmups, ...scored];
  } else {
    turns = params.config.shuffleMathOrder
      ? shuffleSimonArray(E04_MATH_TRUE_DO_ITEMS, rng).map((t) => ({ ...t }))
      : E04_MATH_TRUE_DO_ITEMS.map((t) => ({ ...t }));
  }

  return {
    config: {
      ...params.config,
      teams: params.config.teams.map((t) => ({ ...t })),
    },
    turns,
    history: [],
    currentTurnIndex: 0,
    status: turns.length > 0 ? 'playing' : 'finished',
  };
}

/**
 * Commits the current turn (idempotent by turnId).
 * - Warm-up turns ('isWarmup: true'): never award points, still record choice for transparent feedback.
 * - 'teams' mode (scored turns): requires EVERY team to be recorded ('execute' | 'hold' | 'no_answer');
 *   strictly rejects 'unrecorded' — NEVER treats unrecorded as 'hold'!
 * - 'solo_practice': grades single student choice ('execute' | 'hold' | 'no_answer').
 * - 'whole_class': non-scored classroom mode; never fabricates observation scores.
 */
export function commitSimonTurn(
  state: SimonSaysState,
  input: {
    turn: SimonTurnItem;
    soloChoice?: SimonDecision | 'no_answer' | null;
    teamChoices?: Record<string, SimonTeamInput>;
    committedAt?: number;
  }
): {
  state: SimonSaysState;
  committed: boolean;
  reason?: string;
  record?: SimonTurnRecord;
} {
  if (state.status !== 'playing') {
    return { state, committed: false, reason: 'session_not_playing' };
  }
  if (state.history.some((h) => h.turnId === input.turn.id)) {
    return { state, committed: false, reason: 'duplicate_turn_commit' };
  }

  const expectedDecision = getExpectedDecisionForTurn(input.turn);
  const choiceByParticipant: Record<string, SimonDecision | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};

  let resultMode: SimonTurnRecord['resultMode'] = 'non_scored_class';

  if (input.turn.isWarmup) {
    resultMode = 'warmup';
    if (state.config.participantMode === 'solo_practice') {
      const c: SimonDecision | 'no_answer' = input.soloChoice || 'no_answer';
      choiceByParticipant.solo_1 = c;
      isCorrectByParticipant.solo_1 = c === expectedDecision;
      pointsDeltaByParticipant.solo_1 = 0; // Warm-up never scores
    }
  } else if (state.config.participantMode === 'teams') {
    resultMode = 'scored_teams';
    const verdicts = input.teamChoices || {};
    for (const team of state.config.teams) {
      const v = verdicts[team.id];
      if (!v || v === 'unrecorded') {
        return { state, committed: false, reason: 'unrecorded_team' };
      }
      choiceByParticipant[team.id] = v;
      const isRight = v === expectedDecision;
      isCorrectByParticipant[team.id] = isRight;
      pointsDeltaByParticipant[team.id] = isRight ? E04_POINTS_CORRECT : E04_POINTS_INCORRECT;
    }
  } else if (state.config.participantMode === 'solo_practice') {
    resultMode = 'solo_auto';
    const c: SimonDecision | 'no_answer' = input.soloChoice || 'no_answer';
    const isRight = c === expectedDecision;
    choiceByParticipant.solo_1 = c;
    isCorrectByParticipant.solo_1 = isRight;
    pointsDeltaByParticipant.solo_1 = isRight ? E04_POINTS_CORRECT : E04_POINTS_INCORRECT;
  }

  const record: SimonTurnRecord = {
    turnIndex: state.currentTurnIndex,
    turnId: input.turn.id,
    code: input.turn.code,
    isWarmup: input.turn.isWarmup,
    displayPrompt: buildSimonCommandDisplayText(input.turn),
    gestureId: input.turn.gestureId,
    actionText: input.turn.actionText,
    expectedDecision,
    explanation: input.turn.explanation,
    choiceByParticipant,
    isCorrectByParticipant,
    pointsDeltaByParticipant,
    resultMode,
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextHistory = [...state.history, record];
  const isDone = nextHistory.length >= state.turns.length;

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
 * Edits the most recently confirmed scored turn before advancing to a new turn.
 * Recomputes all points cleanly from history.
 */
export function editLastSimonTurn(
  state: SimonSaysState,
  teamChoices: Record<string, SimonTeamInput>
): { state: SimonSaysState; edited: boolean; reason?: string } {
  if (state.config.participantMode !== 'teams' || state.history.length === 0) {
    return { state, edited: false, reason: 'cannot_edit' };
  }

  const lastIdx = state.history.length - 1;
  const last = state.history[lastIdx];
  if (last.isWarmup) {
    return { state, edited: false, reason: 'warmup_not_scored' };
  }

  const choiceByParticipant: Record<string, SimonDecision | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const pointsDeltaByParticipant: Record<string, number> = {};

  for (const team of state.config.teams) {
    const v = teamChoices[team.id];
    if (!v || v === 'unrecorded') {
      return { state, edited: false, reason: 'unrecorded_team' };
    }
    choiceByParticipant[team.id] = v;
    const isRight = v === last.expectedDecision;
    isCorrectByParticipant[team.id] = isRight;
    pointsDeltaByParticipant[team.id] = isRight ? E04_POINTS_CORRECT : E04_POINTS_INCORRECT;
  }

  const nextHistory = [...state.history];
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
      history: nextHistory,
    },
  };
}

export function advanceSimonTurn(state: SimonSaysState): SimonSaysState {
  if (state.status !== 'playing') return state;
  const nextIdx = Math.min(Math.max(0, state.turns.length - 1), state.history.length);
  return {
    ...state,
    currentTurnIndex: nextIdx,
  };
}

/**
 * Pure source-of-truth standings derived strictly from scored turns in `state.history`.
 * Warm-up turns are excluded. Equal points share the same rank with `isTied = true` ("Đồng hạng").
 */
export function computeSimonStandings(state: SimonSaysState): SimonParticipantStanding[] {
  const scoredHistory = state.history.filter((h) => !h.isWarmup);

  if (state.config.participantMode === 'whole_class') {
    return [];
  }

  if (state.config.participantMode === 'solo_practice') {
    let points = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;
    for (const rec of scoredHistory) {
      points += rec.pointsDeltaByParticipant.solo_1 || 0;
      const c = rec.choiceByParticipant.solo_1;
      if (!c || c === 'no_answer') noAnswerCount += 1;
      else if (rec.isCorrectByParticipant.solo_1) correctCount += 1;
      else incorrectCount += 1;
    }
    return [
      {
        id: 'solo_1',
        teamNumber: 1,
        name: 'Tự luyện cá nhân',
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

  const rows: SimonParticipantStanding[] = state.config.teams.map((team) => {
    let points = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;
    for (const rec of scoredHistory) {
      points += rec.pointsDeltaByParticipant[team.id] || 0;
      const c = rec.choiceByParticipant[team.id];
      if (!c || c === 'no_answer') noAnswerCount += 1;
      else if (rec.isCorrectByParticipant[team.id]) correctCount += 1;
      else incorrectCount += 1;
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

interface StoredE04SessionPayload {
  version: number;
  state: SimonSaysState;
  updatedAt: number;
}

export function getE04SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${E04_SESSION_STORAGE_KEY}`
    : E04_SESSION_STORAGE_KEY;
}

export function saveE04Session(state: SimonSaysState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredE04SessionPayload = {
      version: E04_SESSION_VERSION,
      state,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getE04SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota/privacy errors
  }
}

export function clearE04Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getE04SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadE04Session(): {
  state: SimonSaysState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getE04SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredE04SessionPayload>;
    const st = parsed?.state;
    if (
      !parsed ||
      parsed.version !== E04_SESSION_VERSION ||
      !st ||
      !st.config ||
      (st.config.mode !== 'simon_says' && st.config.mode !== 'math_true_do') ||
      !Array.isArray(st.turns) ||
      st.turns.length === 0 ||
      !Array.isArray(st.history)
    ) {
      clearE04Session();
      return { state: null, recoveredFromCorruption: true };
    }
    return { state: st, recoveredFromCorruption: false };
  } catch {
    clearE04Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
