/**
 * C10 — GIẢI CỨU ĐẠI DƯƠNG 3D ("HẢI TRÌNH XANH – PHỤC HỒI ĐẠI DƯƠNG") — Tây Đô Smart EDU
 * Pure deterministic educational ocean-conservation adventure engine:
 * - 4 Zones:
 *   1. `zone_bay` (Vịnh xanh — Thu gom rác nổi)
 *   2. `zone_seagrass` (Thảm cỏ biển — Dọn vật cản)
 *   3. `zone_reef` (Rạn san hô — Bảo vệ môi trường sống)
 *   4. `zone_station` (Trạm đại dương — Thử thách tổng kết)
 * - Default structure: 3 learning zones × 4 questions + 1 final challenge = 13 questions
 *   Max default score: 12 × 10 + 30 = 150 points
 * - Modes:
 *   - `coop` (Hải trình hợp tác — default): Whole class or 1 student, shared progress & score
 *   - `teams` (Đội thám hiểm đại dương): 2–6 teams, same question & equal opportunities, individual scores, shared ocean progress
 * - Scoring & Hints:
 *   - Regular mission: 10 pts (no hint), 5 pts (after hint), 0 pts (wrong / no_answer)
 *   - Final challenge: 30 pts (no hint), 15 pts (after hint), 0 pts (wrong / no_answer), scored once only
 *   - Max 1 hint per question; missing hint NEVER reduces score; no speed bonus; no random score items; no negative deductions
 * - Environmental accuracy:
 *   - Only explicitly tagged `trash_debris` objects are collectible; marine creatures, corals, seagrass & live shells can NEVER be collected
 *   - Wrong answers NEVER punish or injure wildlife; every mission completes after reviewing explanation (`completed_with_support`)
 *   - Mission progress (`completed / total`) is strictly separated from accuracy (`correct / graded`)
 * - 2 Built-in 13-question sample packs ("Dữ liệu mẫu"):
 *   1. Toán THCS — Hải trình tính toán
 *   2. Tin học THCS — Đại dương thông tin
 *   Plus Smart EDU RBAC bank adapter, Unicode NFC Vietnamese normalization, optionId-locked shuffling,
 *   single deadline clock, Pause/Resume, anti-double-click turnToken, edit just-confirmed round, and /demo-isolated persistence.
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type OceanGameMode = 'coop' | 'teams';

export type OceanQuestionSource = 'sample_math' | 'sample_cs' | 'bank';

export type OceanQuestionType = 'single_choice' | 'true_false' | 'short_answer';

export type OceanZoneId = 'zone_bay' | 'zone_seagrass' | 'zone_reef' | 'zone_station';

export type OceanGraphicsQuality = 'high' | 'lite' | '2d';

export type OceanTargetKind = 'trash_debris' | 'marine_creature' | 'coral' | 'seagrass' | 'live_shell';

export type OceanDebrisVisual =
  | 'plastic_bottle'
  | 'foam_box'
  | 'scrap_net'
  | 'tin_can'
  | 'floating_bag'
  | 'station_beacon';

export type OceanPhase =
  | 'setup'
  | 'map'
  | 'zone'
  | 'question_ready'
  | 'answering'
  | 'grading'
  | 'revealed'
  | 'animating'
  | 'mission_done'
  | 'summary';

export type OceanMark = 'unmarked' | 'correct' | 'wrong' | 'no_answer';

export type OceanMissionCompletionKind = 'pending' | 'completed_direct' | 'completed_with_support';

export interface OceanSceneTarget {
  targetId: string;
  label: string;
  kind: OceanTargetKind;
}

export interface OceanZoneMeta {
  zoneId: OceanZoneId;
  order: number;
  title: string;
  subtitle: string;
  actionVerb: string;
  isFinalStation: boolean;
}

export interface OceanTeamConfig {
  teamId: string;
  index: number;
  name: string;
  colorHex: string;
  colorNameVi: string;
  memberNames: string[];
}

export interface OceanQuestionOption {
  optionId: string;
  label: string;
  textLatex: string;
}

export interface OceanQuestionItem {
  questionId: string;
  type: OceanQuestionType;
  topic: string;
  difficulty: 'know' | 'understand' | 'apply';
  stemLatex: string;
  imageUrl?: string | null;
  options: OceanQuestionOption[];
  correctOptionId: string | null;
  acceptedVariants?: string[]; // For short_answer text matching
  allowDiacriticInsensitive?: boolean;
  answerLatex: string;
  explanationLatex: string;
  hintLatex: string | null;
  actionMessage: string; // Short accurate environmental action note for the scene
  plainReadText: string;
  preserveOptionOrder?: boolean;
  isSample: boolean;
  sourceBadge: string;
}

export interface OceanMissionSlot {
  missionId: string;
  zoneId: OceanZoneId;
  slotIndex: number; // 0-based within zone
  isFinalChallenge: boolean;
  targetKind: 'trash_debris'; // Strictly trash/debris/station marker — NEVER creatures/natural reef!
  debrisVisual: OceanDebrisVisual;
  debrisLabel: string;
  binLabel: string;
  question: OceanQuestionItem;
}

export interface OceanParticipantOutcome {
  participantId: string;
  mark: OceanMark;
  selectedOptionId: string | null;
  typedAnswer?: string;
  pointsAwarded: number;
}

export interface OceanMissionRecord {
  missionId: string;
  zoneId: OceanZoneId;
  isFinalChallenge: boolean;
  orderCompleted: number;
  turnToken: string;
  questionId: string;
  topic: string;
  stemLatex: string;
  answerLatex: string;
  explanationLatex: string;
  actionMessage: string;
  hintUsed: boolean;
  completionKind: 'completed_direct' | 'completed_with_support';
  outcomes: Record<string, OceanParticipantOutcome>;
  editCount: number;
  confirmedAt: number;
}

export interface OceanGameConfig {
  mode: OceanGameMode;
  questionSource: OceanQuestionSource;
  zoneCount: 2 | 3; // 2 or 3 learning zones (default 3)
  questionsPerZone: number; // 2–5 (default 4)
  includeFinalChallenge: boolean; // Default true
  timerSeconds: number; // 0 (unlimited), 30, 45, 60, 90 (default 45)
  hintsEnabled: boolean; // Default true
  teams: OceanTeamConfig[]; // 1 participant for coop, 2–6 for teams
}

export interface OceanZoneProgress {
  zoneId: OceanZoneId;
  title: string;
  subtitle: string;
  isFinalStation: boolean;
  status: 'locked' | 'open' | 'in_progress' | 'completed';
  totalMissions: number;
  completedMissions: number;
  correctGradedCount: number; // Number of missions with >=1 correct (coop: 1 if correct)
  gradedCount: number;
}

export interface OceanTeamStanding {
  participantId: string;
  name: string;
  colorHex: string;
  score: number;
  maxPossibleScore: number;
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  unplayedCount: number;
  hintsUsedCount: number;
  rank: number;
  isTiedRank: boolean;
}

export interface OceanProgressReport {
  zones: OceanZoneProgress[];
  totalMissions: number;
  completedMissions: number;
  missionProgressPercent: number; // Strictly completedMissions / totalMissions (NEVER accuracy!)
  maxTotalPoints: number;
  standings: OceanTeamStanding[];
  totalHintsUsed: number;
  voyageCompleted: boolean;
  finalChallengeResult: 'not_enabled' | 'pending' | 'solved_correct' | 'completed_after_review';
  finalChallengeLabel: string;
  reviewItems: OceanMissionRecord[]; // Missions where at least one participant answered wrong / no_answer
}

export interface OceanGameState {
  sessionId: string;
  config: OceanGameConfig;
  rulesLocked: boolean;
  phase: OceanPhase;

  // Fixed mission map generated once on start
  activeZoneIds: OceanZoneId[];
  missions: OceanMissionSlot[];
  reserveDeck: OceanQuestionItem[];

  // Current navigation & active mission
  selectedZoneId: OceanZoneId;
  activeMissionId: string | null;
  turnToken: string;

  // Single deadline clock
  mediaReady: boolean;
  deadlineMs: number | null;
  pausedRemainingMs: number | null;
  isPaused: boolean;
  timedOutCurrentMission: boolean;

  // Current mission drafts
  hintRevealedForActive: boolean;
  draftMarks: Record<string, OceanMark>;
  draftOptionIds: Record<string, string | null>;
  draftTypedAnswer: string;
  practiceRetryUsed: boolean;

  // Idempotency, edit & animation state
  lastConfirmedTurnToken: string | null;
  lastConfirmedMissionId: string | null;
  editingLastConfirmed: boolean;
  endedEarly: boolean;

  // Authoritative confirmed mission records (single source of truth for score, progress & 3D scene!)
  history: OceanMissionRecord[];
  statusMessage: string | null;
}

export const C10_REGULAR_POINTS = 10;
export const C10_REGULAR_HINT_POINTS = 5;
export const C10_FINAL_POINTS = 30;
export const C10_FINAL_HINT_POINTS = 15;
export const C10_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const C10_ILLUSTRATIVE_CAPTION = 'Hoạt ảnh phục hồi mang tính minh họa';
export const C10_SESSION_STORAGE_KEY = 'taydo_c10_clean_ocean_session_v1';
export const C10_SESSION_VERSION = 1;

export const C10_ZONES: Record<OceanZoneId, OceanZoneMeta> = {
  zone_bay: {
    zoneId: 'zone_bay',
    order: 1,
    title: 'Vịnh xanh',
    subtitle: 'Thu gom rác nổi',
    actionVerb: 'Thu gom rác nổi vào khoang chứa',
    isFinalStation: false,
  },
  zone_seagrass: {
    zoneId: 'zone_seagrass',
    order: 2,
    title: 'Thảm cỏ biển',
    subtitle: 'Dọn vật cản',
    actionVerb: 'Gỡ vật cản rác thải trên thảm cỏ biển',
    isFinalStation: false,
  },
  zone_reef: {
    zoneId: 'zone_reef',
    order: 3,
    title: 'Rạn san hô',
    subtitle: 'Bảo vệ môi trường sống',
    actionVerb: 'Thu gom rác quanh rìa rạn san hô an toàn',
    isFinalStation: false,
  },
  zone_station: {
    zoneId: 'zone_station',
    order: 4,
    title: 'Trạm đại dương',
    subtitle: 'Tổng kết nhiệm vụ',
    actionVerb: 'Hoàn tất tổng kết tại Trạm nghiên cứu đại dương',
    isFinalStation: true,
  },
};

export const C10_TEAM_PALETTE: { name: string; colorHex: string; colorNameVi: string }[] = [
  { name: 'Đội San Hô', colorHex: '#0EA5E9', colorNameVi: 'Xanh biển' },
  { name: 'Đội Hải Âu', colorHex: '#F59E0B', colorNameVi: 'Vàng nắng' },
  { name: 'Đội Cỏ Biển', colorHex: '#10B981', colorNameVi: 'Xanh ngọc' },
  { name: 'Đội Hải Lưu', colorHex: '#6366F1', colorNameVi: 'Xanh chàm' },
  { name: 'Đội Ngọc Trai', colorHex: '#EC4899', colorNameVi: 'Hồng san hô' },
  { name: 'Đội Hải Đăng', colorHex: '#F97316', colorNameVi: 'Cam rực' },
];

// ============================================================================
// ENVIRONMENTAL TARGET SAFETY GUARD
// ============================================================================

/**
 * Strictly ensures ONLY explicitly tagged `trash_debris` objects can be collected.
 * Marine creatures, corals, seagrass, and live shells are NEVER collectible.
 */
export function canCollectOceanTarget(target: OceanSceneTarget): boolean {
  return target.kind === 'trash_debris';
}

// ============================================================================
// VIETNAMESE UNICODE NFC NORMALIZATION
// ============================================================================

export function stripVietnameseDiacritics(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

export function normalizeVietnameseAnswer(
  raw: string,
  allowDiacriticInsensitive: boolean = false
): string {
  const nfc = (raw || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
  return allowDiacriticInsensitive ? stripVietnameseDiacritics(nfc) : nfc;
}

export function matchOceanTextAnswer(
  input: string,
  acceptedVariants: string[],
  allowDiacriticInsensitive: boolean = false
): boolean {
  const normalizedInput = normalizeVietnameseAnswer(input, allowDiacriticInsensitive);
  if (!normalizedInput) return false;
  return acceptedVariants.some(
    (variant) =>
      normalizeVietnameseAnswer(variant, allowDiacriticInsensitive) === normalizedInput
  );
}

// ============================================================================
// SAMPLE PACK 1: TOÁN THCS — HẢI TRÌNH TÍNH TOÁN (13 QUESTIONS, Dữ liệu mẫu)
// (12 regular across 3 zones + 1 final station challenge; consistent units; illustrative data)
// ============================================================================

export const C10_SAMPLE_MATH_QUESTIONS: OceanQuestionItem[] = [
  // Zone 1: Vịnh xanh (4 questions)
  {
    questionId: 'c10_math_01',
    type: 'single_choice',
    topic: 'Số học',
    difficulty: 'know',
    stemLatex: 'Tính giá trị biểu thức \\(125 + 75 \\times 2\\).',
    options: [
      { optionId: 'cm1_a', label: 'A', textLatex: '\\(400\\)' },
      { optionId: 'cm1_b', label: 'B', textLatex: '\\(275\\)' },
      { optionId: 'cm1_c', label: 'C', textLatex: '\\(225\\)' },
      { optionId: 'cm1_d', label: 'D', textLatex: '\\(350\\)' },
    ],
    correctOptionId: 'cm1_b',
    answerLatex: '\\(275\\)',
    explanationLatex: 'Thực hiện phép nhân trước phép cộng: \\(75 \\times 2 = 150\\), sau đó \\(125 + 150 = 275\\).',
    hintLatex: 'Nhớ quy tắc thứ tự thực hiện phép tính: nhân chia trước, cộng trừ sau.',
    actionMessage: 'Thiết bị thu gom đưa chai nhựa nổi vào khoang rác tái chế (minh họa).',
    plainReadText: 'Tính giá trị biểu thức 125 cộng 75 nhân 2.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_02',
    type: 'single_choice',
    topic: 'Số nguyên',
    difficulty: 'know',
    stemLatex: 'Tính \\((-18) + 25 - 12\\).',
    options: [
      { optionId: 'cm2_a', label: 'A', textLatex: '\\(-5\\)' },
      { optionId: 'cm2_b', label: 'B', textLatex: '\\(5\\)' },
      { optionId: 'cm2_c', label: 'C', textLatex: '\\(19\\)' },
      { optionId: 'cm2_d', label: 'D', textLatex: '\\(-19\\)' },
    ],
    correctOptionId: 'cm2_a',
    answerLatex: '\\(-5\\)',
    explanationLatex: 'Ta có \\((-18) + 25 = 7\\), sau đó \\(7 - 12 = -5\\).',
    hintLatex: 'Tính từ trái sang phải: lấy \\(25 - 18\\) trước rồi trừ tiếp \\(12\\).',
    actionMessage: 'Thùng rác nổi trên vịnh xanh đã tiếp nhận mảnh xốp trôi nổi.',
    plainReadText: 'Tính âm 18 cộng 25 trừ 12.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_03',
    type: 'single_choice',
    topic: 'Phân số',
    difficulty: 'understand',
    stemLatex: 'Tính \\(\\frac{2}{3} + \\frac{1}{6}\\).',
    options: [
      { optionId: 'cm3_a', label: 'A', textLatex: '\\(\\frac{3}{9}\\)' },
      { optionId: 'cm3_b', label: 'B', textLatex: '\\(\\frac{5}{6}\\)' },
      { optionId: 'cm3_c', label: 'C', textLatex: '\\(\\frac{4}{6}\\)' },
      { optionId: 'cm3_d', label: 'D', textLatex: '\\(\\frac{3}{6}\\)' },
    ],
    correctOptionId: 'cm3_b',
    answerLatex: '\\(\\frac{5}{6}\\)',
    explanationLatex: 'Quy đồng mẫu số chung là \\(6\\): \\(\\frac{2}{3} = \\frac{4}{6}\\), suy ra \\(\\frac{4}{6} + \\frac{1}{6} = \\frac{5}{6}\\).',
    hintLatex: 'Đưa phân số \\(\\frac{2}{3}\\) về mẫu số \\(6\\) bằng cách nhân cả tử và mẫu với \\(2\\).',
    actionMessage: 'Cánh tay robot thu gom túi nilon nổi cách xa đàn cá con.',
    plainReadText: 'Tính 2 phần 3 cộng 1 phần 6.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_04',
    type: 'single_choice',
    topic: 'Giá trị phân số của một số',
    difficulty: 'understand',
    stemLatex: 'Một thùng phân loại mẫu chứa \\(40\\) vỏ hộp, trong đó \\(\\frac{3}{8}\\) là vỏ lon kim loại. Có bao nhiêu vỏ lon kim loại?',
    options: [
      { optionId: 'cm4_a', label: 'A', textLatex: '\\(12\\)' },
      { optionId: 'cm4_b', label: 'B', textLatex: '\\(15\\)' },
      { optionId: 'cm4_c', label: 'C', textLatex: '\\(18\\)' },
      { optionId: 'cm4_d', label: 'D', textLatex: '\\(24\\)' },
    ],
    correctOptionId: 'cm4_b',
    answerLatex: '\\(15\\)',
    explanationLatex: 'Số vỏ lon kim loại là \\(40 \\times \\frac{3}{8} = (40 : 8) \\times 3 = 5 \\times 3 = 15\\).',
    hintLatex: 'Chia \\(40\\) cho mẫu số \\(8\\), sau đó nhân kết quả với tử số \\(3\\).',
    actionMessage: 'Hoàn tất dọn rác nổi tại khu vực Vịnh xanh (không mọi loại nhựa đều tái chế được nên cần phân loại đúng quy định địa phương).',
    plainReadText: 'Một thùng phân loại mẫu chứa 40 vỏ hộp, trong đó 3 phần 8 là vỏ lon kim loại. Hỏi có bao nhiêu vỏ lon kim loại?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 2: Thảm cỏ biển (4 questions)
  {
    questionId: 'c10_math_05',
    type: 'single_choice',
    topic: 'Tỉ số',
    difficulty: 'know',
    stemLatex: 'Rút gọn tỉ số \\(18\\text{ kg} : 24\\text{ kg}\\) về dạng tối giản:',
    options: [
      { optionId: 'cm5_a', label: 'A', textLatex: '\\(3 : 4\\)' },
      { optionId: 'cm5_b', label: 'B', textLatex: '\\(2 : 3\\)' },
      { optionId: 'cm5_c', label: 'C', textLatex: '\\(4 : 5\\)' },
      { optionId: 'cm5_d', label: 'D', textLatex: '\\(6 : 8\\)' },
    ],
    correctOptionId: 'cm5_a',
    answerLatex: '\\(3 : 4\\)',
    explanationLatex: 'Ước chung lớn nhất của \\(18\\) và \\(24\\) là \\(6\\). Chia cả hai số cho \\(6\\) được \\(3 : 4\\).',
    hintLatex: 'Tìm ước chung lớn nhất của \\(18\\) và \\(24\\) rồi chia cả hai số cho ước đó.',
    actionMessage: 'Thiết bị chuyên dụng nhấc thùng xốp bỏ quên khỏi lối đi trên thảm cỏ biển.',
    plainReadText: 'Rút gọn tỉ số 18 ki-lô-gam trên 24 ki-lô-gam về dạng tối giản.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_06',
    type: 'single_choice',
    topic: 'Chu vi hình chữ nhật',
    difficulty: 'understand',
    stemLatex: 'Một ô khảo sát thảm cỏ biển hình chữ nhật dài \\(12\\text{ m}\\), rộng \\(7\\text{ m}\\). Chu vi ô khảo sát là:',
    options: [
      { optionId: 'cm6_a', label: 'A', textLatex: '\\(19\\text{ m}\\)' },
      { optionId: 'cm6_b', label: 'B', textLatex: '\\(38\\text{ m}\\)' },
      { optionId: 'cm6_c', label: 'C', textLatex: '\\(84\\text{ m}\\)' },
      { optionId: 'cm6_d', label: 'D', textLatex: '\\(26\\text{ m}\\)' },
    ],
    correctOptionId: 'cm6_b',
    answerLatex: '\\(38\\text{ m}\\)',
    explanationLatex: 'Chu vi hình chữ nhật là \\(P = 2 \\times (12 + 7) = 2 \\times 19 = 38\\text{ m}\\).',
    hintLatex: 'Áp dụng công thức chu vi hình chữ nhật: \\(P = 2 \\times (\\text{dài} + \\text{rộng})\\).',
    actionMessage: 'Cuộn dây nhựa phế thải được thu gọn an toàn mà không làm bật gốc cỏ biển.',
    plainReadText: 'Một ô khảo sát hình chữ nhật dài 12 mét, rộng 7 mét. Chu vi ô khảo sát là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_07',
    type: 'single_choice',
    topic: 'Diện tích hình vuông',
    difficulty: 'know',
    stemLatex: 'Một khung phao chắn rác hình vuông có cạnh \\(8\\text{ m}\\). Diện tích phần mặt nước bên trong khung là:',
    options: [
      { optionId: 'cm7_a', label: 'A', textLatex: '\\(32\\text{ m}^2\\)' },
      { optionId: 'cm7_b', label: 'B', textLatex: '\\(16\\text{ m}^2\\)' },
      { optionId: 'cm7_c', label: 'C', textLatex: '\\(64\\text{ m}^2\\)' },
      { optionId: 'cm7_d', label: 'D', textLatex: '\\(48\\text{ m}^2\\)' },
    ],
    correctOptionId: 'cm7_c',
    answerLatex: '\\(64\\text{ m}^2\\)',
    explanationLatex: 'Diện tích hình vuông là \\(S = 8 \\times 8 = 64\\text{ m}^2\\).',
    hintLatex: 'Diện tích hình vuông bằng cạnh nhân chính nó (đơn vị \\(\\text{m}^2\\)).',
    actionMessage: 'Vỏ lon kim loại nằm lẫn gần mép cát đã được đưa vào ngăn thu gom.',
    plainReadText: 'Một khung phao chắn rác hình vuông có cạnh 8 mét. Diện tích bên trong khung là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_08',
    type: 'single_choice',
    topic: 'Đọc bảng dữ liệu',
    difficulty: 'understand',
    stemLatex: 'Bảng dữ liệu minh họa số chai nhựa thu gom trong \\(3\\) đợt: Đợt 1 là \\(14\\), Đợt 2 là \\(18\\), Đợt 3 là \\(16\\). Trung bình cộng mỗi đợt là:',
    options: [
      { optionId: 'cm8_a', label: 'A', textLatex: '\\(15\\)' },
      { optionId: 'cm8_b', label: 'B', textLatex: '\\(16\\)' },
      { optionId: 'cm8_c', label: 'C', textLatex: '\\(17\\)' },
      { optionId: 'cm8_d', label: 'D', textLatex: '\\(48\\)' },
    ],
    correctOptionId: 'cm8_b',
    answerLatex: '\\(16\\)',
    explanationLatex: 'Tổng \\(3\\) đợt là \\(14 + 18 + 16 = 48\\). Trung bình cộng là \\(48 : 3 = 16\\).',
    hintLatex: 'Cộng cả \\(3\\) số rồi chia cho \\(3\\).',
    actionMessage: 'Khu vực Thảm cỏ biển đã hoàn thành dọn vật cản rác thải.',
    plainReadText: 'Số chai nhựa minh họa trong 3 đợt là 14, 18 và 16. Trung bình cộng mỗi đợt là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 3: Rạn san hô (4 questions)
  {
    questionId: 'c10_math_09',
    type: 'single_choice',
    topic: 'Lũy thừa',
    difficulty: 'know',
    stemLatex: 'Tính giá trị của \\(3^2 + 2^3\\).',
    options: [
      { optionId: 'cm9_a', label: 'A', textLatex: '\\(12\\)' },
      { optionId: 'cm9_b', label: 'B', textLatex: '\\(15\\)' },
      { optionId: 'cm9_c', label: 'C', textLatex: '\\(17\\)' },
      { optionId: 'cm9_d', label: 'D', textLatex: '\\(18\\)' },
    ],
    correctOptionId: 'cm9_c',
    answerLatex: '\\(17\\)',
    explanationLatex: 'Ta có \\(3^2 = 9\\) và \\(2^3 = 8\\), nên \\(9 + 8 = 17\\).',
    hintLatex: 'Tính riêng \\(3^2 = 3 \\times 3\\) và \\(2^3 = 2 \\times 2 \\times 2\\) trước khi cộng.',
    actionMessage: 'Nhóm thiết bị giữ khoảng cách an toàn, chỉ nhặt rác ngoài rìa rạn san hô.',
    plainReadText: 'Tính giá trị của 3 mũ 2 cộng 2 mũ 3.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_10',
    type: 'single_choice',
    topic: 'Tỉ số phần trăm',
    difficulty: 'understand',
    stemLatex: 'Phân số \\(\\frac{3}{4}\\) viết dưới dạng tỉ số phần trăm là:',
    options: [
      { optionId: 'cm10_a', label: 'A', textLatex: '\\(34\\%\\)' },
      { optionId: 'cm10_b', label: 'B', textLatex: '\\(60\\%\\)' },
      { optionId: 'cm10_c', label: 'C', textLatex: '\\(75\\%\\)' },
      { optionId: 'cm10_d', label: 'D', textLatex: '\\(80\\%\\)' },
    ],
    correctOptionId: 'cm10_c',
    answerLatex: '\\(75\\%\\)',
    explanationLatex: 'Ta có \\(\\frac{3}{4} = \\frac{75}{100} = 75\\%\\).',
    hintLatex: 'Nhân cả tử và mẫu của \\(\\frac{3}{4}\\) với \\(25\\) để có mẫu \\(100\\).',
    actionMessage: 'Đoạn lưới phế liệu mắc ngoài bãi cát gần rạn đã được thiết bị thu hồi.',
    plainReadText: 'Phân số 3 phần 4 viết dưới dạng tỉ số phần trăm là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_11',
    type: 'single_choice',
    topic: 'Diện tích tam giác',
    difficulty: 'understand',
    stemLatex: 'Một lá cờ hiệu tam giác có cạnh đáy \\(10\\text{ cm}\\) và chiều cao tương ứng \\(6\\text{ cm}\\). Diện tích lá cờ là:',
    options: [
      { optionId: 'cm11_a', label: 'A', textLatex: '\\(60\\text{ cm}^2\\)' },
      { optionId: 'cm11_b', label: 'B', textLatex: '\\(30\\text{ cm}^2\\)' },
      { optionId: 'cm11_c', label: 'C', textLatex: '\\(16\\text{ cm}^2\\)' },
      { optionId: 'cm11_d', label: 'D', textLatex: '\\(20\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'cm11_b',
    answerLatex: '\\(30\\text{ cm}^2\\)',
    explanationLatex: 'Diện tích tam giác là \\(S = \\frac{10 \\times 6}{2} = 30\\text{ cm}^2\\).',
    hintLatex: 'Công thức diện tích tam giác: \\(S = \\frac{\\text{đáy} \\times \\text{chiều cao}}{2}\\).',
    actionMessage: 'Thu gom chai nhựa cạnh vùng đệm san hô; không chạm vào rùa biển hay san hô sống.',
    plainReadText: 'Một lá cờ hình tam giác có đáy 10 xen-ti-mét và chiều cao 6 xen-ti-mét. Diện tích là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_math_12',
    type: 'single_choice',
    topic: 'Tìm x',
    difficulty: 'apply',
    stemLatex: 'Tìm số tự nhiên \\(x\\) biết \\(2x + 7 = 21\\).',
    options: [
      { optionId: 'cm12_a', label: 'A', textLatex: '\\(x = 6\\)' },
      { optionId: 'cm12_b', label: 'B', textLatex: '\\(x = 7\\)' },
      { optionId: 'cm12_c', label: 'C', textLatex: '\\(x = 14\\)' },
      { optionId: 'cm12_d', label: 'D', textLatex: '\\(x = 8\\)' },
    ],
    correctOptionId: 'cm12_b',
    answerLatex: '\\(x = 7\\)',
    explanationLatex: 'Ta có \\(2x = 21 - 7 = 14\\), suy ra \\(x = 14 : 2 = 7\\).',
    hintLatex: 'Chuyển \\(+7\\) sang vế phải thành \\(-7\\), sau đó chia cho \\(2\\).',
    actionMessage: 'Hoàn tất nhiệm vụ khu vực Rạn san hô — sẵn sàng mở Trạm đại dương.',
    plainReadText: 'Tìm số tự nhiên ích biết 2 ích cộng 7 bằng 21.',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 4: Trạm đại dương — Thử thách tổng kết (30 điểm)
  {
    questionId: 'c10_math_final',
    type: 'single_choice',
    topic: 'Tổng hợp bài toán thực tế',
    difficulty: 'apply',
    stemLatex: 'Một bảng ghi chép minh họa cho thấy tàu khảo sát di chuyển đều \\(180\\text{ m}\\) trong \\(45\\text{ giây}\\). Vận tốc của tàu là bao nhiêu, và trong \\(60\\text{ giây}\\) tàu đi được bao nhiêu mét?',
    options: [
      { optionId: 'cmf_a', label: 'A', textLatex: '\\(4\\text{ m/s}\\) và \\(240\\text{ m}\\)' },
      { optionId: 'cmf_b', label: 'B', textLatex: '\\(5\\text{ m/s}\\) và \\(300\\text{ m}\\)' },
      { optionId: 'cmf_c', label: 'C', textLatex: '\\(4\\text{ m/s}\\) và \\(200\\text{ m}\\)' },
      { optionId: 'cmf_d', label: 'D', textLatex: '\\(3\\text{ m/s}\\) và \\(180\\text{ m}\\)' },
    ],
    correctOptionId: 'cmf_a',
    answerLatex: '\\(4\\text{ m/s}\\) và \\(240\\text{ m}\\)',
    explanationLatex: 'Vận tốc \\(v = \\frac{180}{45} = 4\\text{ m/s}\\). Trong \\(60\\text{ giây}\\), quãng đường là \\(s = 4 \\times 60 = 240\\text{ m}\\).',
    hintLatex: 'Tính vận tốc trước bằng \\(180 : 45\\), sau đó nhân với \\(60\\text{ giây}\\).',
    actionMessage: 'Trạm đại dương ghi nhận hoàn tất toàn bộ Hải trình xanh (hoạt ảnh phục hồi mang tính minh họa).',
    plainReadText: 'Tàu khảo sát đi đều 180 mét trong 45 giây. Vận tốc của tàu là bao nhiêu và trong 60 giây tàu đi được bao nhiêu mét?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
];

// ============================================================================
// SAMPLE PACK 2: TIN HỌC THCS — ĐẠI DƯƠNG THÔNG TIN (13 QUESTIONS, Dữ liệu mẫu)
// (Information/data, devices, files/folders, algorithms, digital safety)
// ============================================================================

export const C10_SAMPLE_CS_QUESTIONS: OceanQuestionItem[] = [
  // Zone 1: Vịnh xanh (4 questions)
  {
    questionId: 'c10_cs_01',
    type: 'single_choice',
    topic: 'Thông tin và dữ liệu',
    difficulty: 'know',
    stemLatex: 'Trong tin học, dãy các con số và chữ viết được lưu trong bảng ghi chép trước khi xử lý gọi là gì?',
    options: [
      { optionId: 'cc1_a', label: 'A', textLatex: 'Dữ liệu' },
      { optionId: 'cc1_b', label: 'B', textLatex: 'Phần cứng' },
      { optionId: 'cc1_c', label: 'C', textLatex: 'Mạng LAN' },
      { optionId: 'cc1_d', label: 'D', textLatex: 'Hệ điều hành' },
    ],
    correctOptionId: 'cc1_a',
    answerLatex: 'Dữ liệu',
    explanationLatex: 'Dữ liệu là các văn bản, con số, hình ảnh, âm thanh được ghi lại; thông tin là ý nghĩa rút ra từ dữ liệu.',
    hintLatex: 'Phân biệt vật mang/biểu diễn thô (dữ liệu) với ý nghĩa con người hiểu được (thông tin).',
    actionMessage: 'Thu gom chai nhựa nổi đầu tiên tại Vịnh xanh.',
    plainReadText: 'Trong tin học, dãy các con số và chữ viết được lưu trong bảng ghi chép trước khi xử lý gọi là gì?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_02',
    type: 'single_choice',
    topic: 'Đơn vị đo dữ liệu',
    difficulty: 'know',
    stemLatex: 'Một byte (\\(1\\text{ B}\\)) gồm bao nhiêu bit?',
    options: [
      { optionId: 'cc2_a', label: 'A', textLatex: '\\(4\\text{ bit}\\)' },
      { optionId: 'cc2_b', label: 'B', textLatex: '\\(8\\text{ bit}\\)' },
      { optionId: 'cc2_c', label: 'C', textLatex: '\\(16\\text{ bit}\\)' },
      { optionId: 'cc2_d', label: 'D', textLatex: '\\(10\\text{ bit}\\)' },
    ],
    correctOptionId: 'cc2_b',
    answerLatex: '\\(8\\text{ bit}\\)',
    explanationLatex: 'Theo quy ước chuẩn trong tin học, \\(1\\text{ byte} = 8\\text{ bit}\\).',
    hintLatex: 'Số bit trong 1 byte là một lũy thừa của \\(2\\) nhỏ hơn \\(10\\).',
    actionMessage: 'Thu gom hộp xốp trôi nổi đưa vào khoang chứa trên mặt vịnh.',
    plainReadText: 'Một byte gồm bao nhiêu bit?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_03',
    type: 'single_choice',
    topic: 'Thiết bị vào – ra',
    difficulty: 'know',
    stemLatex: 'Thiết bị nào sau đây là thiết bị vào (Input) dùng để nhập dữ liệu vào máy tính?',
    options: [
      { optionId: 'cc3_a', label: 'A', textLatex: 'Màn hình' },
      { optionId: 'cc3_b', label: 'B', textLatex: 'Loa' },
      { optionId: 'cc3_c', label: 'C', textLatex: 'Bàn phím' },
      { optionId: 'cc3_d', label: 'D', textLatex: 'Máy in' },
    ],
    correctOptionId: 'cc3_c',
    answerLatex: 'Bàn phím',
    explanationLatex: 'Bàn phím truyền dữ liệu ký tự từ người dùng vào máy tính; màn hình, loa và máy in là thiết bị ra.',
    hintLatex: 'Chọn thiết bị giúp người dùng đưa thông tin từ bên ngoài vào máy tính.',
    actionMessage: 'Thiết bị thu gom vớt túi nilon nổi khỏi mặt nước Vịnh xanh.',
    plainReadText: 'Thiết bị nào sau đây là thiết bị vào dùng để nhập dữ liệu vào máy tính?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_04',
    type: 'single_choice',
    topic: 'Phần mềm & Hệ điều hành',
    difficulty: 'understand',
    stemLatex: 'Chức năng chính của hệ điều hành (như Windows, macOS, Linux) là gì?',
    options: [
      { optionId: 'cc4_a', label: 'A', textLatex: 'Quản lý phần cứng, tệp và điều phối các phần mềm ứng dụng' },
      { optionId: 'cc4_b', label: 'B', textLatex: 'Chỉ dùng để soạn thảo văn bản' },
      { optionId: 'cc4_c', label: 'C', textLatex: 'Thay thế hoàn toàn nguồn điện máy tính' },
      { optionId: 'cc4_d', label: 'D', textLatex: 'Chỉ dùng để vẽ hình minh họa' },
    ],
    correctOptionId: 'cc4_a',
    answerLatex: 'Quản lý phần cứng, tệp và điều phối các phần mềm ứng dụng',
    explanationLatex: 'Hệ điều hành là phần mềm hệ thống quản lý tài nguyên phần cứng, hệ thống tệp và làm cầu nối cho phần mềm ứng dụng hoạt động.',
    hintLatex: 'Hệ điều hành đóng vai trò trung gian quản lý toàn bộ tài nguyên máy tính.',
    actionMessage: 'Hoàn thành thu gom rác nổi tại Vịnh xanh.',
    plainReadText: 'Chức năng chính của hệ điều hành là gì?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 2: Thảm cỏ biển (4 questions)
  {
    questionId: 'c10_cs_05',
    type: 'single_choice',
    topic: 'Tệp và thư mục',
    difficulty: 'know',
    stemLatex: 'Để tổ chức bài học gọn gàng theo từng môn trên máy tính, ta nên tạo đối tượng nào để chứa các tệp liên quan?',
    options: [
      { optionId: 'cc5_a', label: 'A', textLatex: 'Thư mục (Folder)' },
      { optionId: 'cc5_b', label: 'B', textLatex: 'Con trỏ chuột' },
      { optionId: 'cc5_c', label: 'C', textLatex: 'Thanh cuộn' },
      { optionId: 'cc5_d', label: 'D', textLatex: 'Phím cách' },
    ],
    correctOptionId: 'cc5_a',
    answerLatex: 'Thư mục (Folder)',
    explanationLatex: 'Thư mục dùng để chứa các tệp và thư mục con theo cấu trúc cây, giúp tìm kiếm nhanh và khoa học.',
    hintLatex: 'Tương tự chiếc cặp đựng hồ sơ theo từng môn học.',
    actionMessage: 'Nhấc thùng xốp bỏ quên khỏi khu vực Thảm cỏ biển.',
    plainReadText: 'Để tổ chức bài học gọn gàng theo từng môn trên máy tính, ta nên tạo đối tượng nào để chứa các tệp liên quan?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_06',
    type: 'single_choice',
    topic: 'Phần mở rộng tệp',
    difficulty: 'know',
    stemLatex: 'Tệp có tên \\(\\texttt{baocao\\_nhom1.pdf}\\) có phần mở rộng là gì?',
    options: [
      { optionId: 'cc6_a', label: 'A', textLatex: '\\(\\texttt{baocao}\\)' },
      { optionId: 'cc6_b', label: 'B', textLatex: '\\(\\texttt{nhom1}\\)' },
      { optionId: 'cc6_c', label: 'C', textLatex: '\\(\\texttt{.pdf}\\)' },
      { optionId: 'cc6_d', label: 'D', textLatex: '\\(\\texttt{\\_}\\)' },
    ],
    correctOptionId: 'cc6_c',
    answerLatex: '\\(\\texttt{.pdf}\\)',
    explanationLatex: 'Phần mở rộng đứng sau dấu chấm cuối cùng trong tên tệp, cho biết định dạng tệp (ở đây là \\(\\texttt{.pdf}\\)).',
    hintLatex: 'Quan sát phần đứng sau dấu chấm cuối cùng của tên tệp.',
    actionMessage: 'Gỡ cuộn dây nhựa phế thải khỏi bãi cát cạnh thảm cỏ biển.',
    plainReadText: 'Tệp có tên bao cao nhom 1 chấm pê đê ép có phần mở rộng là gì?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_07',
    type: 'single_choice',
    topic: 'Thuật toán tuần tự',
    difficulty: 'understand',
    stemLatex: 'Trong một thuật toán, các bước được thực hiện nối tiếp nhau từ bước đầu đến bước cuối gọi là cấu trúc gì?',
    options: [
      { optionId: 'cc7_a', label: 'A', textLatex: 'Cấu trúc tuần tự' },
      { optionId: 'cc7_b', label: 'B', textLatex: 'Cấu trúc rẽ nhánh' },
      { optionId: 'cc7_c', label: 'C', textLatex: 'Cấu trúc lặp vô hạn' },
      { optionId: 'cc7_d', label: 'D', textLatex: 'Cấu trúc ngẫu nhiên' },
    ],
    correctOptionId: 'cc7_a',
    answerLatex: 'Cấu trúc tuần tự',
    explanationLatex: 'Cấu trúc tuần tự thực hiện từng lệnh theo đúng thứ tự đã sắp xếp.',
    hintLatex: 'Các bước chạy lần lượt bước 1 → bước 2 → bước 3 không bỏ qua hay quay lại.',
    actionMessage: 'Thu gom vỏ lon kim loại trên đáy cát gần thảm cỏ biển.',
    plainReadText: 'Trong một thuật toán, các bước được thực hiện nối tiếp nhau từ bước đầu đến bước cuối gọi là cấu trúc gì?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_08',
    type: 'single_choice',
    topic: 'Cấu trúc rẽ nhánh',
    difficulty: 'understand',
    stemLatex: 'Câu lệnh dạng “Nếu \\(\\text{điều kiện đúng}\\) thì làm việc A, ngược lại làm việc B” thuộc cấu trúc điều khiển nào?',
    options: [
      { optionId: 'cc8_a', label: 'A', textLatex: 'Tuần tự' },
      { optionId: 'cc8_b', label: 'B', textLatex: 'Rẽ nhánh dạng đủ' },
      { optionId: 'cc8_c', label: 'C', textLatex: 'Lặp với số lần biết trước' },
      { optionId: 'cc8_d', label: 'D', textLatex: 'Khai báo hằng số' },
    ],
    correctOptionId: 'cc8_b',
    answerLatex: 'Rẽ nhánh dạng đủ',
    explanationLatex: 'Khi có cả nhánh “thì ...” và nhánh “ngược lại ...”, đó là cấu trúc rẽ nhánh dạng đủ (if–else).',
    hintLatex: 'Có hai hướng lựa chọn rõ ràng dựa vào một điều kiện đúng hoặc sai.',
    actionMessage: 'Hoàn tất dọn vật cản rác thải tại khu vực Thảm cỏ biển.',
    plainReadText: 'Câu lệnh dạng Nếu điều kiện đúng thì làm việc A, ngược lại làm việc B thuộc cấu trúc điều khiển nào?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 3: Rạn san hô (4 questions)
  {
    questionId: 'c10_cs_09',
    type: 'single_choice',
    topic: 'Cấu trúc lặp',
    difficulty: 'understand',
    stemLatex: 'Cho vòng lặp thực hiện lệnh \\(S \\leftarrow S + 2\\) đúng \\(5\\) lần (ban đầu \\(S = 0\\)). Sau vòng lặp, giá trị của \\(S\\) là:',
    options: [
      { optionId: 'cc9_a', label: 'A', textLatex: '\\(7\\)' },
      { optionId: 'cc9_b', label: 'B', textLatex: '\\(10\\)' },
      { optionId: 'cc9_c', label: 'C', textLatex: '\\(12\\)' },
      { optionId: 'cc9_d', label: 'D', textLatex: '\\(25\\)' },
    ],
    correctOptionId: 'cc9_b',
    answerLatex: '\\(10\\)',
    explanationLatex: 'Mỗi lần lặp cộng thêm \\(2\\), lặp \\(5\\) lần nên \\(S = 0 + 2 \\times 5 = 10\\).',
    hintLatex: 'Lấy số lần lặp nhân với lượng tăng ở mỗi bước.',
    actionMessage: 'Robot thu gom mảnh rác nhựa bên ngoài rìa rạn san hô.',
    plainReadText: 'Cho vòng lặp cộng thêm 2 vào S đúng 5 lần với S ban đầu bằng 0. Sau vòng lặp giá trị S là bao nhiêu?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_10',
    type: 'single_choice',
    topic: 'Mật khẩu an toàn',
    difficulty: 'know',
    stemLatex: 'Trong các lựa chọn sau, mật khẩu nào đảm bảo an toàn số tốt nhất?',
    options: [
      { optionId: 'cc10_a', label: 'A', textLatex: '\\(\\texttt{12345678}\\)' },
      { optionId: 'cc10_b', label: 'B', textLatex: '\\(\\texttt{ngaysinh2012}\\)' },
      { optionId: 'cc10_c', label: 'C', textLatex: '\\(\\texttt{BienXanh@2027!}\\)' },
      { optionId: 'cc10_d', label: 'D', textLatex: '\\(\\texttt{abcdef}\\)' },
    ],
    correctOptionId: 'cc10_c',
    answerLatex: '\\(\\texttt{BienXanh@2027!}\\)',
    explanationLatex: 'Mật khẩu mạnh nên đủ dài (từ 8 ký tự trở lên), kết hợp chữ hoa, chữ thường, chữ số và ký tự đặc biệt, không dùng thông tin cá nhân dễ đoán.',
    hintLatex: 'Chọn mật khẩu có đủ chữ hoa, chữ thường, số và ký tự đặc biệt.',
    actionMessage: 'Gỡ đoạn lưới bỏ lại trên bãi cát xa san hô sống.',
    plainReadText: 'Trong các lựa chọn sau, mật khẩu nào đảm bảo an toàn số tốt nhất?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_11',
    type: 'single_choice',
    topic: 'An toàn thông tin cá nhân',
    difficulty: 'know',
    stemLatex: 'Khi nhận được liên kết lạ hứa tặng quà miễn phí và yêu cầu nhập mật khẩu tài khoản học tập, em nên làm gì?',
    options: [
      { optionId: 'cc11_a', label: 'A', textLatex: 'Không bấm vào liên kết, không cung cấp mật khẩu và báo người lớn hoặc thầy cô' },
      { optionId: 'cc11_b', label: 'B', textLatex: 'Nhập thử mật khẩu để kiểm tra xem có nhận được quà không' },
      { optionId: 'cc11_c', label: 'C', textLatex: 'Gửi tiếp liên kết đó cho cả lớp cùng bấm' },
      { optionId: 'cc11_d', label: 'D', textLatex: 'Đăng mật khẩu công khai lên bình luận' },
    ],
    correctOptionId: 'cc11_a',
    answerLatex: 'Không bấm vào liên kết, không cung cấp mật khẩu và báo người lớn hoặc thầy cô',
    explanationLatex: 'Liên kết yêu cầu mật khẩu là dấu hiệu giả mạo (phishing). Tuyệt đối không cung cấp mật khẩu và cần cảnh báo kịp thời.',
    hintLatex: 'Không bao giờ nhập mật khẩu vào đường link lạ không rõ nguồn gốc.',
    actionMessage: 'Thu hồi hộp nhựa rỗng cạnh khu bảo tồn san hô.',
    plainReadText: 'Khi nhận được liên kết lạ yêu cầu nhập mật khẩu tài khoản học tập, em nên làm gì?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
  {
    questionId: 'c10_cs_12',
    type: 'single_choice',
    topic: 'Bản quyền & Nguồn thông tin',
    difficulty: 'understand',
    stemLatex: 'Khi sử dụng hình ảnh hoặc đoạn trích từ Internet cho bài thuyết trình của nhóm, hành động nào là đúng đắn?',
    options: [
      { optionId: 'cc12_a', label: 'A', textLatex: 'Tôn trọng bản quyền và ghi rõ nguồn trích dẫn' },
      { optionId: 'cc12_b', label: 'B', textLatex: 'Xóa tên tác giả để nhận là của mình' },
      { optionId: 'cc12_c', label: 'C', textLatex: 'Sao chép bất kỳ bài viết nào mà không cần kiểm chứng' },
      { optionId: 'cc12_d', label: 'D', textLatex: 'Sửa sai nội dung gốc rồi gắn tên tác giả cũ' },
    ],
    correctOptionId: 'cc12_a',
    answerLatex: 'Tôn trọng bản quyền và ghi rõ nguồn trích dẫn',
    explanationLatex: 'Ghi rõ nguồn trích dẫn và kiểm chứng thông tin thể hiện văn hóa số trung thực và tôn trọng quyền tác giả.',
    hintLatex: 'Ứng xử văn minh trên không gian mạng luôn gắn liền với trung thực và tôn trọng tác giả.',
    actionMessage: 'Hoàn tất bảo vệ rìa Rạn san hô — mở khóa Trạm đại dương.',
    plainReadText: 'Khi sử dụng hình ảnh hoặc đoạn trích từ Internet cho bài thuyết trình, hành động nào là đúng đắn?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },

  // Zone 4: Trạm đại dương — Thử thách tổng kết (30 điểm)
  {
    questionId: 'c10_cs_final',
    type: 'single_choice',
    topic: 'Thuật toán & Tìm kiếm',
    difficulty: 'apply',
    stemLatex: 'Một danh sách gồm \\(8\\) thẻ dữ liệu đã được sắp xếp tăng dần. Nếu dùng thuật toán tìm kiếm nhị phân để tìm một giá trị bất kỳ, số lần so sánh tối đa ở trường hợp xấu nhất là khoảng bao nhiêu?',
    options: [
      { optionId: 'ccf_a', label: 'A', textLatex: '\\(1\\) lần' },
      { optionId: 'ccf_b', label: 'B', textLatex: '\\(3\\) đến \\(4\\) lần (vì \\(2^3 = 8\\))' },
      { optionId: 'ccf_c', label: 'C', textLatex: '\\(8\\) lần bắt buộc' },
      { optionId: 'ccf_d', label: 'D', textLatex: '\\(16\\) lần' },
    ],
    correctOptionId: 'ccf_b',
    answerLatex: '\\(3\\) đến \\(4\\) lần (vì \\(2^3 = 8\\))',
    explanationLatex: 'Tìm kiếm nhị phân chia đôi phạm vi sau mỗi bước: \\(8 \\rightarrow 4 \\rightarrow 2 \\rightarrow 1\\), chỉ cần tối đa \\(\\lfloor \\log_2 8 \\rfloor + 1 = 4\\) lần so sánh (nhanh hơn nhiều so với duyệt tuần tự).',
    hintLatex: 'Mỗi bước tìm kiếm nhị phân giảm một nửa số phần tử cần xét: \\(8 \\rightarrow 4 \\rightarrow 2 \\rightarrow 1\\).',
    actionMessage: 'Trạm đại dương hoàn tất tổng kết Hải trình Đại dương thông tin (hoạt ảnh phục hồi mang tính minh họa).',
    plainReadText: 'Với danh sách 8 phần tử đã sắp xếp tăng dần, tìm kiếm nhị phân cần tối đa khoảng bao nhiêu lần so sánh?',
    isSample: true,
    sourceBadge: C10_SAMPLE_BADGE,
  },
];

// ============================================================================
// VALIDATION, SAFE SHUFFLE & SMART EDU RBAC BANK ADAPTER
// ============================================================================

export function validateOceanQuestion(q: OceanQuestionItem): { valid: boolean; reason?: string } {
  if (!q || !q.questionId || !q.questionId.trim()) {
    return { valid: false, reason: 'Thiếu questionId.' };
  }
  if (!q.stemLatex || !q.stemLatex.trim()) {
    return { valid: false, reason: 'Nội dung câu hỏi rỗng.' };
  }
  if (q.type === 'single_choice' || q.type === 'true_false') {
    if (!Array.isArray(q.options) || q.options.length < 2) {
      return { valid: false, reason: 'Cần ít nhất 2 phương án.' };
    }
    const idSet = new Set<string>();
    for (const o of q.options) {
      if (!o.optionId || idSet.has(o.optionId)) {
        return { valid: false, reason: 'Trùng hoặc thiếu optionId.' };
      }
      idSet.add(o.optionId);
    }
    if (!q.correctOptionId || !idSet.has(q.correctOptionId)) {
      return { valid: false, reason: 'Đáp án đúng không khớp optionId.' };
    }
  }
  return { valid: true };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function shuffleOceanOptionsOnce(
  q: OceanQuestionItem,
  seedKey: string
): OceanQuestionItem {
  if (q.type !== 'single_choice' || q.preserveOptionOrder || q.options.length <= 1) {
    return q;
  }
  const labelDependent = /(cả\s+[a-d]\s+và\s+[a-d]|tất cả các đáp án|phương án\s+[a-d]|cả hai đáp án)/i;
  if (q.options.some((o) => labelDependent.test(o.textLatex))) {
    return q;
  }
  const copy = q.options.map((o) => ({ ...o }));
  let rng = hashSeed(`${seedKey}:${q.questionId}`) || 7771;
  for (let i = copy.length - 1; i > 0; i--) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const j = rng % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return {
    ...q,
    options: copy.map((o, idx) => ({ ...o, label: LETTERS[idx] || String(idx + 1) })),
  };
}

export function adaptBankQuestionsForC10(
  bankQuestions: Question[],
  userRole: UserRole
): OceanQuestionItem[] {
  if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) return [];
  const seen = new Set<string>();
  const out: OceanQuestionItem[] = [];

  for (const q of bankQuestions) {
    if (!q || !q.id || seen.has(q.id)) continue;
    if (q.status === 'deprecated') continue;
    if (userRole === 'student' && q.status !== 'approved') continue;
    const stem = (q.stem || '').trim();
    if (!stem) continue;

    const topic = (q.chapter || q.lesson || 'Ngân hàng Smart EDU').trim();
    const explanation = (q.explanation || 'Giáo viên giải thích và chốt kiến thức trọng tâm cùng lớp.').trim();
    const diff: 'know' | 'understand' | 'apply' =
      q.level === 'apply' ? 'apply' : q.level === 'understand' ? 'understand' : 'know';

    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const optSeen = new Set<string>();
      const opts: OceanQuestionOption[] = [];
      q.options.slice(0, 4).forEach((o, idx) => {
        const oid = (o.id || `${q.id}_opt_${idx}`).trim();
        if (!optSeen.has(oid)) {
          optSeen.add(oid);
          opts.push({
            optionId: oid,
            label: o.label || LETTERS[idx] || String(idx + 1),
            textLatex: o.text || '',
          });
        }
      });
      const matched = opts.filter(
        (o) => o.optionId === q.correctAnswer || o.label === q.correctAnswer
      );
      if (matched.length !== 1) continue;

      const item: OceanQuestionItem = {
        questionId: q.id,
        type: 'single_choice',
        topic,
        difficulty: diff,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: opts,
        correctOptionId: matched[0].optionId,
        answerLatex: `${matched[0].label}. ${matched[0].textLatex}`,
        explanationLatex: explanation,
        hintLatex: null, // Bank questions without explicit hint do NOT invent fake AI hints or deduct points
        actionMessage: 'Thiết bị thu gom hoàn tất xử lý điểm rác thải minh họa.',
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateOceanQuestion(item).valid) {
        seen.add(q.id);
        out.push(item);
      }
    } else if (q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false_group') {
      const variants =
        q.type === 'short_answer' && Array.isArray(q.acceptedAnswers)
          ? q.acceptedAnswers.filter((a) => Boolean(a && a.trim()))
          : [];
      const answerStr =
        variants.length > 0
          ? variants[0]
          : q.type === 'true_false_group' && Array.isArray(q.subItems)
            ? q.subItems.map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`).join(' · ')
            : q.sampleAnswer || 'Xem lời giải chi tiết';
      const item: OceanQuestionItem = {
        questionId: q.id,
        type: 'short_answer',
        topic,
        difficulty: diff,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: [],
        correctOptionId: null,
        acceptedVariants: variants,
        allowDiacriticInsensitive: false,
        answerLatex: answerStr,
        explanationLatex: explanation,
        hintLatex: null,
        actionMessage: 'Thiết bị thu gom hoàn tất xử lý điểm rác thải minh họa.',
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateOceanQuestion(item).valid) {
        seen.add(q.id);
        out.push(item);
      }
    }
  }

  return out;
}

// ============================================================================
// TEAM BUILDERS & SETUP VALIDATION
// ============================================================================

export function buildDefaultOceanTeams(mode: OceanGameMode, teamCount: number = 4): OceanTeamConfig[] {
  if (mode === 'coop') {
    return [
      {
        teamId: 'coop_crew',
        index: 0,
        name: 'Đoàn Hải trình xanh',
        colorHex: '#0EA5E9',
        colorNameVi: 'Xanh biển',
        memberNames: [],
      },
    ];
  }
  const safeCount = Math.max(2, Math.min(6, Math.round(teamCount)));
  return Array.from({ length: safeCount }, (_, idx) => {
    const p = C10_TEAM_PALETTE[idx % C10_TEAM_PALETTE.length];
    return {
      teamId: `ocean_team_${idx + 1}`,
      index: idx,
      name: p.name,
      colorHex: p.colorHex,
      colorNameVi: p.colorNameVi,
      memberNames: [],
    };
  });
}

export function distributeStudentsIntoOceanTeams(
  teams: OceanTeamConfig[],
  studentNames: string[]
): OceanTeamConfig[] {
  if (teams.length === 0) return teams;
  const buckets: string[][] = teams.map(() => []);
  studentNames.forEach((raw, idx) => {
    const clean = raw.trim();
    if (clean) buckets[idx % teams.length].push(clean);
  });
  return teams.map((t, idx) => ({ ...t, memberNames: buckets[idx] }));
}

export function computeOceanMaxScore(
  zoneCount: 2 | 3,
  questionsPerZone: number,
  includeFinalChallenge: boolean
): { totalQuestions: number; maxScore: number } {
  const regular = zoneCount * questionsPerZone;
  const finalCnt = includeFinalChallenge ? 1 : 0;
  return {
    totalQuestions: regular + finalCnt,
    maxScore: regular * C10_REGULAR_POINTS + finalCnt * C10_FINAL_POINTS,
  };
}

export function validateOceanSetup(
  zoneCount: 2 | 3,
  questionsPerZone: number,
  includeFinalChallenge: boolean,
  availableQuestionsCount: number
): { valid: boolean; error: string | null; totalQuestions: number; maxScore: number } {
  const qPerZone = Math.floor(questionsPerZone);
  const { totalQuestions, maxScore } = computeOceanMaxScore(
    zoneCount,
    qPerZone,
    includeFinalChallenge
  );
  if (qPerZone < 2 || qPerZone > 5) {
    return {
      valid: false,
      error: 'Số câu mỗi khu vực phải từ 2 đến 5 câu.',
      totalQuestions,
      maxScore,
    };
  }
  if (availableQuestionsCount < totalQuestions) {
    return {
      valid: false,
      error: `Bộ câu hỏi hiện có ${availableQuestionsCount} câu hợp lệ, chưa đủ ${totalQuestions} câu (không lặp câu). Hãy giảm số khu vực/số câu hoặc đổi bộ câu hỏi.`,
      totalQuestions,
      maxScore,
    };
  }
  return { valid: true, error: null, totalQuestions, maxScore };
}

// ============================================================================
// SINGLE-SOURCE-OF-TRUTH PROGRESS, ZONE UNLOCK & SCORING REPORT
// ============================================================================

export function computeMissionPoints(
  isFinalChallenge: boolean,
  mark: OceanMark,
  hintUsed: boolean
): number {
  if (mark !== 'correct') return 0;
  if (isFinalChallenge) {
    return hintUsed ? C10_FINAL_HINT_POINTS : C10_FINAL_POINTS;
  }
  return hintUsed ? C10_REGULAR_HINT_POINTS : C10_REGULAR_POINTS;
}

export function getPointsPreviewForActiveMission(state: OceanGameState): {
  withoutHint: number;
  withHint: number;
  currentReward: number;
} {
  const mission = getActiveOceanMission(state);
  const isFinal = Boolean(mission?.isFinalChallenge);
  const withoutHint = isFinal ? C10_FINAL_POINTS : C10_REGULAR_POINTS;
  const withHint = isFinal ? C10_FINAL_HINT_POINTS : C10_REGULAR_HINT_POINTS;
  return {
    withoutHint,
    withHint,
    currentReward: state.hintRevealedForActive ? withHint : withoutHint,
  };
}

/**
 * Computes ALL zone unlock statuses, mission progress (strictly separate from accuracy!),
 * team/coop scores, rankings ("Đồng hạng"), and final challenge labels STRICTLY from `history`.
 */
export function computeOceanProgressReport(state: OceanGameState): OceanProgressReport {
  const historyByMission = new Map<string, OceanMissionRecord>();
  for (const rec of state.history) {
    historyByMission.set(rec.missionId, rec);
  }

  const learningZoneIds = state.activeZoneIds.filter((z) => z !== 'zone_station');
  const learningZoneCompleteMap = new Map<OceanZoneId, boolean>();

  // First pass: evaluate learning zones
  for (const zId of learningZoneIds) {
    const zMissions = state.missions.filter((m) => m.zoneId === zId);
    const doneCount = zMissions.filter((m) => historyByMission.has(m.missionId)).length;
    learningZoneCompleteMap.set(zId, zMissions.length > 0 && doneCount >= zMissions.length);
  }

  const allLearningZonesDone =
    learningZoneIds.length > 0 &&
    learningZoneIds.every((zId) => learningZoneCompleteMap.get(zId) === true);

  // Build ordered zone progress rows
  const zones: OceanZoneProgress[] = state.activeZoneIds.map((zId, idx) => {
    const meta = C10_ZONES[zId];
    const zMissions = state.missions.filter((m) => m.zoneId === zId);
    let completed = 0;
    let correctGraded = 0;
    for (const m of zMissions) {
      const rec = historyByMission.get(m.missionId);
      if (rec) {
        completed += 1;
        const anyCorrect = Object.values(rec.outcomes).some((o) => o.mark === 'correct');
        if (anyCorrect) correctGraded += 1;
      }
    }

    let status: OceanZoneProgress['status'];
    if (meta.isFinalStation) {
      if (!allLearningZonesDone) status = 'locked';
      else if (zMissions.length > 0 && completed >= zMissions.length) status = 'completed';
      else status = 'open';
    } else {
      // Learning zones unlock sequentially OR can be entered once previous learning zone finishes
      const prevZoneId = idx > 0 ? state.activeZoneIds[idx - 1] : null;
      const unlocked = !prevZoneId || learningZoneCompleteMap.get(prevZoneId) === true;
      if (!unlocked) status = 'locked';
      else if (completed >= zMissions.length && zMissions.length > 0) status = 'completed';
      else if (completed > 0) status = 'in_progress';
      else status = 'open';
    }

    return {
      zoneId: zId,
      title: meta.title,
      subtitle: meta.subtitle,
      isFinalStation: meta.isFinalStation,
      status,
      totalMissions: zMissions.length,
      completedMissions: completed,
      correctGradedCount: correctGraded,
      gradedCount: completed,
    };
  });

  const totalMissions = state.missions.length;
  const completedMissions = state.missions.filter((m) => historyByMission.has(m.missionId)).length;
  const missionProgressPercent =
    totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0;

  const { maxScore: maxTotalPoints } = computeOceanMaxScore(
    state.config.zoneCount,
    state.config.questionsPerZone,
    state.config.includeFinalChallenge
  );

  let totalHintsUsed = 0;
  for (const rec of state.history) {
    if (rec.hintUsed) totalHintsUsed += 1;
  }

  // Standings per participant (coop = 1 entry, teams = 2..6 entries)
  const rawStandings: OceanTeamStanding[] = state.config.teams.map((t) => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let noAnswerCount = 0;
    let hintsUsedCount = 0;

    for (const rec of state.history) {
      const out = rec.outcomes[t.teamId];
      if (!out) continue;
      score += computeMissionPoints(rec.isFinalChallenge, out.mark, rec.hintUsed);
      if (out.mark === 'correct') correctCount += 1;
      else if (out.mark === 'wrong') wrongCount += 1;
      else if (out.mark === 'no_answer') noAnswerCount += 1;
      if (rec.hintUsed) hintsUsedCount += 1;
    }

    const graded = correctCount + wrongCount + noAnswerCount;
    return {
      participantId: t.teamId,
      name: t.name,
      colorHex: t.colorHex,
      score,
      maxPossibleScore: maxTotalPoints,
      correctCount,
      wrongCount,
      noAnswerCount,
      unplayedCount: Math.max(0, totalMissions - graded),
      hintsUsedCount,
      rank: 1,
      isTiedRank: false,
    };
  });

  const sorted = [...rawStandings].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.correctCount - a.correctCount;
  });

  const scoreCounts = new Map<number, number>();
  for (const s of sorted) {
    scoreCounts.set(s.score, (scoreCounts.get(s.score) || 0) + 1);
  }

  let curRank = 1;
  const standings = sorted.map((row, idx) => {
    if (idx > 0 && row.score < sorted[idx - 1].score) {
      curRank = idx + 1;
    }
    return {
      ...row,
      rank: curRank,
      isTiedRank: (scoreCounts.get(row.score) || 0) > 1,
    };
  });

  const voyageCompleted = totalMissions > 0 && completedMissions >= totalMissions;

  // Final challenge outcome label (distinct from voyage completion!)
  let finalChallengeResult: OceanProgressReport['finalChallengeResult'] = 'not_enabled';
  let finalChallengeLabel = 'Không bật thử thách cuối';
  if (state.config.includeFinalChallenge) {
    const finalMission = state.missions.find((m) => m.isFinalChallenge);
    const finalRec = finalMission ? historyByMission.get(finalMission.missionId) : undefined;
    if (!finalRec) {
      finalChallengeResult = 'pending';
      finalChallengeLabel = 'Chưa thực hiện thử thách cuối';
    } else if (finalRec.completionKind === 'completed_direct') {
      finalChallengeResult = 'solved_correct';
      finalChallengeLabel = 'Giải đúng thử thách cuối';
    } else {
      finalChallengeResult = 'completed_after_review';
      finalChallengeLabel = 'Hoàn thành sau khi ôn lại';
    }
  }

  const reviewItems = state.history.filter((rec) =>
    Object.values(rec.outcomes).some((o) => o.mark !== 'correct')
  );

  return {
    zones,
    totalMissions,
    completedMissions,
    missionProgressPercent,
    maxTotalPoints,
    standings,
    totalHintsUsed,
    voyageCompleted,
    finalChallengeResult,
    finalChallengeLabel,
    reviewItems,
  };
}

// ============================================================================
// STATE FACTORY & LIFECYCLE TRANSITIONS
// ============================================================================

function makeEmptyMarks(teams: OceanTeamConfig[]): Record<string, OceanMark> {
  const m: Record<string, OceanMark> = {};
  for (const t of teams) m[t.teamId] = 'unmarked';
  return m;
}

function makeEmptyOptions(teams: OceanTeamConfig[]): Record<string, string | null> {
  const m: Record<string, string | null> = {};
  for (const t of teams) m[t.teamId] = null;
  return m;
}

const DEBRIS_ROTATION: Record<
  Exclude<OceanZoneId, 'zone_station'>,
  { visual: OceanDebrisVisual; label: string; binLabel: string }[]
> = {
  zone_bay: [
    { visual: 'plastic_bottle', label: 'Chai nhựa nổi', binLabel: 'Khoang nhựa nổi' },
    { visual: 'foam_box', label: 'Mảnh xốp nổi', binLabel: 'Khoang xốp' },
    { visual: 'floating_bag', label: 'Túi nilon nổi', binLabel: 'Khoang nilon' },
    { visual: 'tin_can', label: 'Vỏ lon trôi nổi', binLabel: 'Khoang kim loại' },
    { visual: 'plastic_bottle', label: 'Chai nhựa dạt vịnh', binLabel: 'Khoang nhựa nổi' },
  ],
  zone_seagrass: [
    { visual: 'foam_box', label: 'Thùng xốp mắc cỏ', binLabel: 'Khoang vật cản' },
    { visual: 'scrap_net', label: 'Dây nhựa phế thải', binLabel: 'Khoang dây/lưới' },
    { visual: 'tin_can', label: 'Vỏ lon đáy cát', binLabel: 'Khoang kim loại' },
    { visual: 'plastic_bottle', label: 'Chai nhựa chìm', binLabel: 'Khoang nhựa' },
    { visual: 'floating_bag', label: 'Mảnh bao bì nhựa', binLabel: 'Khoang nilon' },
  ],
  zone_reef: [
    { visual: 'plastic_bottle', label: 'Chai nhựa rìa rạn', binLabel: 'Khoang rác rạn' },
    { visual: 'scrap_net', label: 'Lưới phế liệu rìa cát', binLabel: 'Khoang dây/lưới' },
    { visual: 'tin_can', label: 'Vỏ hộp ngoài vùng đệm', binLabel: 'Khoang kim loại' },
    { visual: 'foam_box', label: 'Mảnh hộp nhựa rỗng', binLabel: 'Khoang vật cản' },
    { visual: 'floating_bag', label: 'Túi nhựa vướng đá cát', binLabel: 'Khoang nilon' },
  ],
};

export function createDefaultOceanConfig(overrides?: Partial<OceanGameConfig>): OceanGameConfig {
  const mode = overrides?.mode ?? 'coop';
  const teams =
    overrides?.teams && overrides.teams.length > 0
      ? overrides.teams.map((t, idx) => ({
          ...t,
          index: idx,
          name: (t.name || `Đội ${idx + 1}`).trim() || `Đội ${idx + 1}`,
        }))
      : buildDefaultOceanTeams(mode, 4);

  return {
    mode,
    questionSource: overrides?.questionSource ?? 'sample_math',
    zoneCount: overrides?.zoneCount === 2 ? 2 : 3,
    questionsPerZone: Math.max(2, Math.min(5, Math.floor(overrides?.questionsPerZone ?? 4))),
    includeFinalChallenge: overrides?.includeFinalChallenge ?? true,
    timerSeconds: overrides?.timerSeconds ?? 45,
    hintsEnabled: overrides?.hintsEnabled ?? true,
    teams,
  };
}

export function createOceanSetupState(overrides?: Partial<OceanGameConfig>): OceanGameState {
  const config = createDefaultOceanConfig(overrides);
  return {
    sessionId: `c10_${Date.now()}`,
    config,
    rulesLocked: false,
    phase: 'setup',
    activeZoneIds: ['zone_bay', 'zone_seagrass', 'zone_reef', 'zone_station'],
    missions: [],
    reserveDeck: [],
    selectedZoneId: 'zone_bay',
    activeMissionId: null,
    turnToken: '',
    mediaReady: true,
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    timedOutCurrentMission: false,
    hintRevealedForActive: false,
    draftMarks: makeEmptyMarks(config.teams),
    draftOptionIds: makeEmptyOptions(config.teams),
    draftTypedAnswer: '',
    practiceRetryUsed: false,
    lastConfirmedTurnToken: null,
    lastConfirmedMissionId: null,
    editingLastConfirmed: false,
    endedEarly: false,
    history: [],
    statusMessage: null,
  };
}

export function startOceanVoyage(
  configInput: Partial<OceanGameConfig>,
  questionPool: OceanQuestionItem[],
  sessionIdOverride?: string
): { state: OceanGameState; error: string | null } {
  const config = createDefaultOceanConfig(configInput);

  // Deduplicate & validate questions (no repeated questions across zones!)
  const validPool: OceanQuestionItem[] = [];
  const seen = new Set<string>();
  for (const q of questionPool) {
    if (seen.has(q.questionId)) continue;
    if (!validateOceanQuestion(q).valid) continue;
    seen.add(q.questionId);
    validPool.push(q);
  }

  const check = validateOceanSetup(
    config.zoneCount,
    config.questionsPerZone,
    config.includeFinalChallenge,
    validPool.length
  );
  if (!check.valid) {
    return { state: createOceanSetupState(config), error: check.error };
  }

  const sessionId = sessionIdOverride || `c10_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const learningZones: Exclude<OceanZoneId, 'zone_station'>[] =
    config.zoneCount === 2 ? ['zone_bay', 'zone_seagrass'] : ['zone_bay', 'zone_seagrass', 'zone_reef'];
  const activeZoneIds: OceanZoneId[] = config.includeFinalChallenge
    ? [...learningZones, 'zone_station']
    : [...learningZones];

  // For sample packs, keep the dedicated final challenge question at the end if available
  const poolCopy = [...validPool];
  let finalQ: OceanQuestionItem | null = null;
  if (config.includeFinalChallenge) {
    const dedicatedIdx = poolCopy.findIndex((q) => q.questionId.endsWith('_final'));
    if (dedicatedIdx >= 0) {
      finalQ = poolCopy.splice(dedicatedIdx, 1)[0];
    } else {
      finalQ = poolCopy.pop()!;
    }
  }

  const missions: OceanMissionSlot[] = [];
  let cursor = 0;

  for (const zId of learningZones) {
    const debrisList = DEBRIS_ROTATION[zId];
    for (let slot = 0; slot < config.questionsPerZone; slot++) {
      const q = shuffleOceanOptionsOnce(poolCopy[cursor++], sessionId);
      const prop = debrisList[slot % debrisList.length];
      missions.push({
        missionId: `${zId}_m${slot + 1}`,
        zoneId: zId,
        slotIndex: slot,
        isFinalChallenge: false,
        targetKind: 'trash_debris',
        debrisVisual: prop.visual,
        debrisLabel: prop.label,
        binLabel: prop.binLabel,
        question: q,
      });
    }
  }

  if (config.includeFinalChallenge && finalQ) {
    missions.push({
      missionId: 'zone_station_final',
      zoneId: 'zone_station',
      slotIndex: 0,
      isFinalChallenge: true,
      targetKind: 'trash_debris',
      debrisVisual: 'station_beacon',
      debrisLabel: 'Nhiệm vụ tổng kết Trạm đại dương',
      binLabel: 'Trạm đại dương',
      question: shuffleOceanOptionsOnce(finalQ, sessionId),
    });
  }

  const reserveDeck = poolCopy.slice(cursor).map((q) => shuffleOceanOptionsOnce(q, `${sessionId}_res`));

  return {
    error: null,
    state: {
      sessionId,
      config,
      rulesLocked: true,
      phase: 'map',
      activeZoneIds,
      missions,
      reserveDeck,
      selectedZoneId: learningZones[0],
      activeMissionId: null,
      turnToken: `${sessionId}:map`,
      mediaReady: true,
      deadlineMs: null,
      pausedRemainingMs: null,
      isPaused: false,
      timedOutCurrentMission: false,
      hintRevealedForActive: false,
      draftMarks: makeEmptyMarks(config.teams),
      draftOptionIds: makeEmptyOptions(config.teams),
      draftTypedAnswer: '',
      practiceRetryUsed: false,
      lastConfirmedTurnToken: null,
      lastConfirmedMissionId: null,
      editingLastConfirmed: false,
      endedEarly: false,
      history: [],
      statusMessage: `Hải trình gồm ${check.totalQuestions} nhiệm vụ (tối đa ${check.maxScore} điểm). Chọn khu vực Vịnh xanh để bắt đầu!`,
    },
  };
}

export function getActiveOceanMission(state: OceanGameState): OceanMissionSlot | null {
  if (!state.activeMissionId) return null;
  return state.missions.find((m) => m.missionId === state.activeMissionId) || null;
}

export function isMissionCompleted(state: OceanGameState, missionId: string): boolean {
  return state.history.some((r) => r.missionId === missionId);
}

export function enterOceanZone(
  state: OceanGameState,
  zoneId: OceanZoneId
): { state: OceanGameState; entered: boolean; reason?: string } {
  if (state.isPaused) return { state, entered: false, reason: 'Đang tạm dừng.' };
  const report = computeOceanProgressReport(state);
  const z = report.zones.find((row) => row.zoneId === zoneId);
  if (!z || z.status === 'locked') {
    return {
      state,
      entered: false,
      reason: 'Khu vực này chưa mở khóa. Hãy hoàn thành các khu vực trước đó.',
    };
  }
  return {
    entered: true,
    state: {
      ...state,
      phase: 'zone',
      selectedZoneId: zoneId,
      activeMissionId: null,
      statusMessage: `Đang ở ${z.title} (${z.completedMissions}/${z.totalMissions} nhiệm vụ). Chọn một điểm rác đang mở để thực hiện.`,
    },
  };
}

export function returnToOceanMap(state: OceanGameState): OceanGameState {
  if (state.isPaused || state.phase === 'setup' || state.phase === 'summary') return state;
  return {
    ...state,
    phase: 'map',
    activeMissionId: null,
    deadlineMs: null,
    pausedRemainingMs: null,
    editingLastConfirmed: false,
    statusMessage: 'Bản đồ tổng quan Hải trình xanh.',
  };
}

export function selectOceanMission(
  state: OceanGameState,
  missionId: string
): { state: OceanGameState; selected: boolean; reason?: string } {
  if (state.isPaused) return { state, selected: false, reason: 'Đang tạm dừng.' };
  const mission = state.missions.find((m) => m.missionId === missionId);
  if (!mission) return { state, selected: false, reason: 'Không tìm thấy nhiệm vụ.' };

  // Enforce strict target kind check
  if (
    !canCollectOceanTarget({
      targetId: mission.missionId,
      label: mission.debrisLabel,
      kind: mission.targetKind,
    })
  ) {
    return { state, selected: false, reason: 'Không được thu gom sinh vật hoặc thành phần tự nhiên.' };
  }

  // Enforce zone unlock check
  const report = computeOceanProgressReport(state);
  const z = report.zones.find((row) => row.zoneId === mission.zoneId);
  if (!z || z.status === 'locked') {
    return { state, selected: false, reason: 'Khu vực của nhiệm vụ này chưa mở khóa.' };
  }

  // Enforce single completion per mission
  if (isMissionCompleted(state, missionId)) {
    return { state, selected: false, reason: 'Nhiệm vụ này đã được hoàn thành.' };
  }

  const nextToken = `${state.sessionId}:${missionId}:${mission.question.questionId}`;
  return {
    selected: true,
    state: {
      ...state,
      phase: 'question_ready',
      selectedZoneId: mission.zoneId,
      activeMissionId: missionId,
      turnToken: nextToken,
      mediaReady: true,
      deadlineMs: null,
      pausedRemainingMs: null,
      timedOutCurrentMission: false,
      hintRevealedForActive: false,
      draftMarks: makeEmptyMarks(state.config.teams),
      draftOptionIds: makeEmptyOptions(state.config.teams),
      draftTypedAnswer: '',
      practiceRetryUsed: false,
      editingLastConfirmed: false,
      statusMessage: mission.isFinalChallenge
        ? 'Thử thách tổng kết Trạm đại dương (30 điểm · dùng gợi ý còn 15 điểm). Bấm “Bắt đầu câu hỏi”.'
        : `Nhiệm vụ: ${mission.debrisLabel} (${C10_REGULAR_POINTS} điểm · dùng gợi ý còn ${C10_REGULAR_HINT_POINTS} điểm).`,
    },
  };
}

export function openOceanQuestion(
  state: OceanGameState,
  nowMs: number = Date.now(),
  mediaReady: boolean = true
): OceanGameState {
  if (state.phase !== 'question_ready') return state;
  const mission = getActiveOceanMission(state);
  if (!mission) return state;

  const deadlineMs =
    mediaReady && state.config.timerSeconds > 0
      ? nowMs + state.config.timerSeconds * 1000
      : null;

  return {
    ...state,
    phase: 'answering',
    mediaReady,
    deadlineMs,
    pausedRemainingMs: null,
    isPaused: false,
    timedOutCurrentMission: false,
    statusMessage: mediaReady
      ? state.config.mode === 'teams'
        ? 'Các đội thảo luận và chốt đáp án trên bảng con.'
        : 'Chọn đáp án rồi bấm “Chốt đáp án” trước khi hết giờ.'
      : 'Đang chờ tài nguyên hình ảnh sẵn sàng trước khi tính giờ...',
  };
}

export function markOceanMediaReady(
  state: OceanGameState,
  nowMs: number = Date.now()
): OceanGameState {
  if (state.phase !== 'answering' || state.mediaReady) return state;
  return {
    ...state,
    mediaReady: true,
    deadlineMs:
      state.config.timerSeconds > 0 ? nowMs + state.config.timerSeconds * 1000 : null,
    statusMessage: 'Tài nguyên đã sẵn sàng — bắt đầu đếm giờ.',
  };
}

/**
 * Reveals the single built-in hint for the active question (if available).
 * Missing hint NEVER reduces points!
 */
export function useOceanHint(state: OceanGameState): {
  state: OceanGameState;
  used: boolean;
  reason?: string;
} {
  if (state.isPaused) return { state, used: false, reason: 'Đang tạm dừng.' };
  if (!state.config.hintsEnabled) return { state, used: false, reason: 'Đã tắt gợi ý.' };
  if (state.phase !== 'answering' && state.phase !== 'question_ready') {
    return { state, used: false, reason: 'Chỉ dùng gợi ý trước khi công bố đáp án.' };
  }
  const mission = getActiveOceanMission(state);
  if (!mission || !mission.question.hintLatex || !mission.question.hintLatex.trim()) {
    return { state, used: false, reason: 'Câu hỏi này không có gợi ý (không bị giảm điểm).' };
  }
  if (state.hintRevealedForActive) {
    return { state, used: false, reason: 'Đã mở gợi ý cho câu này.' };
  }
  const reducedPts = mission.isFinalChallenge ? C10_FINAL_HINT_POINTS : C10_REGULAR_HINT_POINTS;
  return {
    used: true,
    state: {
      ...state,
      hintRevealedForActive: true,
      statusMessage: `Đã mở gợi ý chung (trả lời đúng được ${reducedPts} điểm).`,
    },
  };
}

// ============================================================================
// SINGLE DEADLINE CLOCK & PAUSE/RESUME
// ============================================================================

export function getOceanRemainingTimeMs(
  state: OceanGameState,
  nowMs: number = Date.now()
): number {
  if (state.isPaused) return Math.max(0, state.pausedRemainingMs ?? 0);
  if (state.deadlineMs === null) return 0;
  return Math.max(0, state.deadlineMs - nowMs);
}

export function pauseOceanVoyage(
  state: OceanGameState,
  nowMs: number = Date.now()
): OceanGameState {
  if (
    state.isPaused ||
    state.phase === 'setup' ||
    state.phase === 'summary' ||
    state.phase === 'map'
  ) {
    return state;
  }
  const rem = state.deadlineMs !== null ? Math.max(0, state.deadlineMs - nowMs) : null;
  return {
    ...state,
    isPaused: true,
    pausedRemainingMs: rem,
    deadlineMs: null,
    statusMessage: 'Hải trình đang tạm dừng — đã giữ nguyên thời gian và che câu hỏi.',
  };
}

export function resumeOceanVoyage(
  state: OceanGameState,
  nowMs: number = Date.now()
): OceanGameState {
  if (!state.isPaused) return state;
  const nextDeadline =
    state.pausedRemainingMs !== null ? nowMs + Math.max(0, state.pausedRemainingMs) : null;
  return {
    ...state,
    isPaused: false,
    deadlineMs: nextDeadline,
    pausedRemainingMs: null,
    statusMessage: 'Đã tiếp tục hải trình.',
  };
}

export function checkOceanDeadline(
  state: OceanGameState,
  nowMs: number = Date.now()
): { state: OceanGameState; expired: boolean } {
  if (
    state.isPaused ||
    state.phase !== 'answering' ||
    !state.mediaReady ||
    state.deadlineMs === null
  ) {
    return { state, expired: false };
  }
  if (nowMs < state.deadlineMs) return { state, expired: false };

  // Timeout NEVER auto-marks the whole class/teams wrong!
  // In coop with direct choice/text, transitions cleanly to `grading` (teacher can record board answer or confirm no_answer).
  return {
    expired: true,
    state: {
      ...state,
      phase: 'grading',
      deadlineMs: null,
      timedOutCurrentMission: true,
      statusMessage:
        'Hết giờ trả lời! Giáo viên ghi nhận đáp án các đội/lớp đã viết trước hạn (hết giờ không tự chấm sai cả lớp).',
    },
  };
}

export function stopOceanAnswering(
  state: OceanGameState,
  nowMs: number = Date.now()
): { state: OceanGameState; stopped: boolean } {
  if (state.isPaused || state.phase !== 'answering') return { state, stopped: false };
  const timedOut = state.deadlineMs !== null && nowMs >= state.deadlineMs;
  return {
    stopped: true,
    state: {
      ...state,
      phase: 'grading',
      deadlineMs: null,
      timedOutCurrentMission: timedOut,
      statusMessage: 'Đã dừng trả lời. Ghi nhận kết quả rồi bấm Công bố đáp án.',
    },
  };
}

// ============================================================================
// DIRECT COOP LOCK, TEAM GRADING, REVEAL, ATOMIC CONFIRM & EDIT
// ============================================================================

/**
 * Coop direct submission (must complete strictly BEFORE deadline if timer enabled).
 */
export function submitCoopDirectOption(
  state: OceanGameState,
  optionId: string,
  nowMs: number = Date.now()
): { state: OceanGameState; accepted: boolean; reason?: string } {
  if (state.isPaused) return { state, accepted: false, reason: 'Đang tạm dừng.' };
  if (state.config.mode !== 'coop' || state.phase !== 'answering') {
    return { state, accepted: false, reason: 'Không ở bước trả lời trực tiếp.' };
  }
  if (state.deadlineMs !== null && nowMs >= state.deadlineMs) {
    const expired = checkOceanDeadline(state, nowMs);
    return { state: expired.state, accepted: false, reason: 'Đã hết giờ trước khi chốt.' };
  }
  const mission = getActiveOceanMission(state);
  if (!mission || !mission.question.options.some((o) => o.optionId === optionId)) {
    return { state, accepted: false, reason: 'Phương án không hợp lệ.' };
  }
  const crewId = state.config.teams[0].teamId;
  const mark: OceanMark =
    mission.question.correctOptionId === optionId ? 'correct' : 'wrong';

  return {
    accepted: true,
    state: {
      ...state,
      phase: 'revealed',
      deadlineMs: null,
      draftMarks: { ...state.draftMarks, [crewId]: mark },
      draftOptionIds: { ...state.draftOptionIds, [crewId]: optionId },
      statusMessage:
        mark === 'correct'
          ? 'Đáp án ĐÚNG! Xem giải thích rồi bấm Xác nhận thực hiện nhiệm vụ.'
          : 'Đáp án chưa đúng (0 điểm). Xem giải thích để ôn lại — nhiệm vụ vẫn hoàn tất sau khi xác nhận.',
    },
  };
}

export function submitCoopTypedAnswer(
  state: OceanGameState,
  typedAnswer: string,
  nowMs: number = Date.now(),
  allowDiacriticInsensitive?: boolean
): { state: OceanGameState; accepted: boolean; reason?: string } {
  if (state.isPaused) return { state, accepted: false, reason: 'Đang tạm dừng.' };
  if (state.config.mode !== 'coop' || state.phase !== 'answering') {
    return { state, accepted: false, reason: 'Không ở bước nhập đáp án.' };
  }
  if (state.deadlineMs !== null && nowMs >= state.deadlineMs) {
    const expired = checkOceanDeadline(state, nowMs);
    return { state: expired.state, accepted: false, reason: 'Đã hết giờ trước khi chốt.' };
  }
  const mission = getActiveOceanMission(state);
  if (!mission) return { state, accepted: false, reason: 'Không có câu hỏi.' };

  const variants = mission.question.acceptedVariants || [];
  if (variants.length === 0) {
    // Open-ended short answer -> go to teacher grading
    return {
      accepted: true,
      state: {
        ...state,
        phase: 'grading',
        deadlineMs: null,
        draftTypedAnswer: typedAnswer.normalize('NFC').trim(),
        statusMessage: 'Câu tự luận ngắn — giáo viên chấm Đúng / Chưa đúng / Không trả lời.',
      },
    };
  }

  const crewId = state.config.teams[0].teamId;
  const matched = matchOceanTextAnswer(
    typedAnswer,
    variants,
    allowDiacriticInsensitive ?? Boolean(mission.question.allowDiacriticInsensitive)
  );
  return {
    accepted: true,
    state: {
      ...state,
      phase: 'revealed',
      deadlineMs: null,
      draftTypedAnswer: typedAnswer.normalize('NFC').trim(),
      draftMarks: { ...state.draftMarks, [crewId]: matched ? 'correct' : 'wrong' },
      statusMessage: matched
        ? 'Đáp án ĐÚNG! Bấm Xác nhận thực hiện nhiệm vụ.'
        : 'Đáp án chưa khớp mẫu chuẩn. Xem lời giải rồi bấm Xác nhận nhiệm vụ.',
    },
  };
}

export function setOceanParticipantMark(
  state: OceanGameState,
  participantId: string,
  mark: OceanMark,
  selectedOptionId: string | null = null
): OceanGameState {
  if (state.isPaused) return state;
  const editable =
    state.phase === 'grading' ||
    state.phase === 'revealed' ||
    (state.phase === 'mission_done' && state.editingLastConfirmed);
  if (!editable) return state;

  return {
    ...state,
    draftMarks: { ...state.draftMarks, [participantId]: mark },
    draftOptionIds: { ...state.draftOptionIds, [participantId]: selectedOptionId },
  };
}

export function setOceanParticipantOption(
  state: OceanGameState,
  participantId: string,
  optionId: string
): OceanGameState {
  const mission = getActiveOceanMission(state);
  if (!mission) return state;
  const mark: OceanMark =
    mission.question.correctOptionId && mission.question.correctOptionId === optionId
      ? 'correct'
      : 'wrong';
  return setOceanParticipantMark(state, participantId, mark, optionId);
}

export function areAllOceanParticipantsMarked(state: OceanGameState): boolean {
  return state.config.teams.every((t) => state.draftMarks[t.teamId] !== 'unmarked');
}

export function revealOceanAnswerAndPreview(state: OceanGameState): {
  state: OceanGameState;
  revealed: boolean;
  reason?: string;
} {
  if (state.isPaused) return { state, revealed: false, reason: 'Đang tạm dừng.' };
  if (state.phase !== 'grading') {
    return { state, revealed: false, reason: 'Chưa ở bước chấm đáp án.' };
  }
  if (!areAllOceanParticipantsMarked(state)) {
    return {
      state,
      revealed: false,
      reason: 'Vui lòng chấm đủ tất cả đội/người chơi trước khi công bố đáp án (Chưa chấm khác Không trả lời).',
    };
  }
  return {
    revealed: true,
    state: {
      ...state,
      phase: 'revealed',
      statusMessage: 'Đã công bố đáp án chuẩn và xem trước điểm. Bấm Xác nhận để chạy hoạt ảnh thu gom.',
    },
  };
}

/**
 * Practice retry AFTER answer reveal: strictly for classroom practice, adds ZERO points!
 */
export function recordPracticeRetry(state: OceanGameState): OceanGameState {
  if (state.phase !== 'revealed' && state.phase !== 'mission_done') return state;
  return {
    ...state,
    practiceRetryUsed: true,
    statusMessage: 'Thử lại để luyện tập (không cộng thêm điểm).',
  };
}

/**
 * Atomic once-only mission confirmation (turnToken + missionId guarded).
 * Also saves edits when `editingLastConfirmed === true`, recomputing all scores cleanly from history!
 */
export function confirmOceanMissionResult(
  state: OceanGameState,
  turnToken: string = state.turnToken
): {
  state: OceanGameState;
  confirmed: boolean;
  anyCorrect: boolean;
  zoneJustCompleted: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Đang tạm dừng.' };
  }
  const isEditing = state.phase === 'mission_done' && state.editingLastConfirmed;
  if (state.phase !== 'revealed' && !isEditing) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Chưa ở bước xác nhận.' };
  }
  if (turnToken !== state.turnToken) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Token lượt cũ không hợp lệ.' };
  }
  const mission = getActiveOceanMission(state);
  if (!mission) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Thiếu nhiệm vụ.' };
  }
  if (!isEditing && (state.lastConfirmedTurnToken === state.turnToken || isMissionCompleted(state, mission.missionId))) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Nhiệm vụ này đã được xác nhận.' };
  }
  if (!areAllOceanParticipantsMarked(state)) {
    return { state, confirmed: false, anyCorrect: false, zoneJustCompleted: false, reason: 'Còn kết quả bắt buộc chưa chấm.' };
  }

  const prevReport = computeOceanProgressReport(state);
  const prevZoneDone =
    prevReport.zones.find((z) => z.zoneId === mission.zoneId)?.status === 'completed';

  const outcomes: Record<string, OceanParticipantOutcome> = {};
  let anyCorrect = false;
  for (const t of state.config.teams) {
    const mark = state.draftMarks[t.teamId];
    const pts = computeMissionPoints(mission.isFinalChallenge, mark, state.hintRevealedForActive);
    if (mark === 'correct') anyCorrect = true;
    outcomes[t.teamId] = {
      participantId: t.teamId,
      mark,
      selectedOptionId: state.draftOptionIds[t.teamId] ?? null,
      typedAnswer: state.draftTypedAnswer || undefined,
      pointsAwarded: pts,
    };
  }

  const completionKind: 'completed_direct' | 'completed_with_support' = anyCorrect
    ? 'completed_direct'
    : 'completed_with_support';

  let nextHistory: OceanMissionRecord[];
  if (isEditing) {
    nextHistory = state.history.map((rec) =>
      rec.missionId === mission.missionId
        ? {
            ...rec,
            outcomes,
            completionKind,
            editCount: rec.editCount + 1,
            confirmedAt: Date.now(),
          }
        : rec
    );
  } else {
    const rec: OceanMissionRecord = {
      missionId: mission.missionId,
      zoneId: mission.zoneId,
      isFinalChallenge: mission.isFinalChallenge,
      orderCompleted: state.history.length + 1,
      turnToken: state.turnToken,
      questionId: mission.question.questionId,
      topic: mission.question.topic,
      stemLatex: mission.question.stemLatex,
      answerLatex: mission.question.answerLatex,
      explanationLatex: mission.question.explanationLatex,
      actionMessage: mission.question.actionMessage,
      hintUsed: state.hintRevealedForActive,
      completionKind,
      outcomes,
      editCount: 0,
      confirmedAt: Date.now(),
    };
    nextHistory = [...state.history, rec];
  }

  const nextState: OceanGameState = {
    ...state,
    phase: isEditing ? 'mission_done' : 'animating',
    lastConfirmedTurnToken: state.turnToken,
    lastConfirmedMissionId: mission.missionId,
    editingLastConfirmed: false,
    history: nextHistory,
    statusMessage: isEditing
      ? 'Đã cập nhật kết quả câu vừa rồi và tính lại toàn bộ điểm số.'
      : mission.question.actionMessage,
  };

  const nextReport = computeOceanProgressReport(nextState);
  const nextZoneDone =
    nextReport.zones.find((z) => z.zoneId === mission.zoneId)?.status === 'completed';

  return {
    confirmed: true,
    anyCorrect,
    zoneJustCompleted: !prevZoneDone && nextZoneDone,
    state: nextState,
  };
}

/**
 * Finishes or skips the collection animation cleanly — NEVER alters points or mission progress!
 */
export function finishOrSkipOceanAnimation(state: OceanGameState): OceanGameState {
  if (state.phase !== 'animating') return state;
  const mission = getActiveOceanMission(state);
  return {
    ...state,
    phase: 'mission_done',
    statusMessage: mission
      ? `Đã hoàn tất nhiệm vụ: ${mission.debrisLabel}. Bấm “Tiếp tục” hoặc sửa kết quả câu vừa rồi.`
      : 'Đã hoàn tất nhiệm vụ.',
  };
}

/**
 * Allows editing the just-confirmed mission BEFORE moving to the next mission.
 */
export function startEditingLastOceanMission(state: OceanGameState): OceanGameState {
  if (state.isPaused || state.phase !== 'mission_done' || state.editingLastConfirmed) {
    return state;
  }
  if (!state.lastConfirmedMissionId) return state;
  const lastRec = state.history.find((r) => r.missionId === state.lastConfirmedMissionId);
  if (!lastRec) return state;

  const marks = makeEmptyMarks(state.config.teams);
  const opts = makeEmptyOptions(state.config.teams);
  for (const t of state.config.teams) {
    marks[t.teamId] = lastRec.outcomes[t.teamId]?.mark ?? 'unmarked';
    opts[t.teamId] = lastRec.outcomes[t.teamId]?.selectedOptionId ?? null;
  }

  return {
    ...state,
    editingLastConfirmed: true,
    activeMissionId: lastRec.missionId,
    turnToken: lastRec.turnToken,
    hintRevealedForActive: lastRec.hintUsed,
    draftMarks: marks,
    draftOptionIds: opts,
    statusMessage: 'Đang sửa kết quả câu vừa xác nhận — điểm số sẽ được tính lại từ đầu.',
  };
}

/**
 * Continues cleanly after mission_done:
 * - If all missions (voyage) completed -> Summary
 * - Else if current zone completed -> Map (so teacher sees next unlocked zone / Trạm đại dương)
 * - Else -> stay in current zone to pick next open mission
 */
export function continueAfterOceanMission(state: OceanGameState): OceanGameState {
  if (state.isPaused || state.editingLastConfirmed) return state;
  if (state.phase !== 'mission_done' && state.phase !== 'animating') return state;

  const report = computeOceanProgressReport(state);
  if (report.voyageCompleted) {
    return {
      ...state,
      phase: 'summary',
      activeMissionId: null,
      deadlineMs: null,
      endedEarly: false,
      statusMessage: 'Hoàn thành toàn bộ Hải trình xanh — Phục hồi đại dương!',
    };
  }

  const currentZone = report.zones.find((z) => z.zoneId === state.selectedZoneId);
  if (currentZone && currentZone.status === 'completed') {
    const nextOpen = report.zones.find((z) => z.status === 'open' || z.status === 'in_progress');
    return {
      ...state,
      phase: 'map',
      selectedZoneId: nextOpen ? nextOpen.zoneId : state.selectedZoneId,
      activeMissionId: null,
      deadlineMs: null,
      statusMessage: nextOpen
        ? `Hoàn thành ${currentZone.title}! Đã mở khóa ${nextOpen.title}.`
        : 'Chọn khu vực tiếp theo trên bản đồ đại dương.',
    };
  }

  return {
    ...state,
    phase: 'zone',
    activeMissionId: null,
    deadlineMs: null,
    statusMessage: `Tiếp tục chọn nhiệm vụ đang mở tại ${currentZone?.title || 'khu vực hiện tại'}.`,
  };
}

export function endOceanVoyageEarly(state: OceanGameState): OceanGameState {
  if (state.phase === 'setup' || state.phase === 'summary') return state;
  return {
    ...state,
    phase: 'summary',
    activeMissionId: null,
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    editingLastConfirmed: false,
    endedEarly: true,
    statusMessage: `Kết thúc sớm sau ${state.history.length}/${state.missions.length} nhiệm vụ đã hoàn thành.`,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// ============================================================================

export interface OceanPersistedSession {
  version: number;
  savedAt: number;
  state: OceanGameState;
}

export function getC10StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${C10_SESSION_STORAGE_KEY}`
    : C10_SESSION_STORAGE_KEY;
}

export function saveC10Session(state: OceanGameState, nowMs: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const snapshot: OceanGameState =
      state.phase === 'answering' && !state.isPaused && state.deadlineMs !== null
        ? { ...state, pausedRemainingMs: Math.max(0, state.deadlineMs - nowMs) }
        : state;
    const payload: OceanPersistedSession = {
      version: C10_SESSION_VERSION,
      savedAt: nowMs,
      state: snapshot,
    };
    window.localStorage.setItem(getC10StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadC10Session(): OceanPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getC10StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OceanPersistedSession>;
    if (
      !parsed ||
      parsed.version !== C10_SESSION_VERSION ||
      !parsed.state ||
      !parsed.state.config ||
      !Array.isArray(parsed.state.missions) ||
      !Array.isArray(parsed.state.history)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const s = parsed.state;
    // Deduplicate history by missionId defensively so restore can NEVER double-score or double-collect!
    const dedupMap = new Map<string, OceanMissionRecord>();
    for (const rec of s.history) {
      if (rec && rec.missionId) dedupMap.set(rec.missionId, rec);
    }

    const shouldPause =
      s.phase === 'answering' && (s.deadlineMs !== null || s.pausedRemainingMs !== null);
    const rem = shouldPause
      ? Math.max(0, s.pausedRemainingMs ?? (s.deadlineMs ? Math.max(0, s.deadlineMs - Date.now()) : 0))
      : s.pausedRemainingMs;

    const safePhase: OceanPhase = s.phase === 'animating' ? 'mission_done' : s.phase;

    const restored: OceanGameState = {
      ...s,
      phase: safePhase,
      history: Array.from(dedupMap.values()),
      editingLastConfirmed: false,
      isPaused: shouldPause ? true : Boolean(s.isPaused),
      deadlineMs: shouldPause ? null : s.deadlineMs,
      pausedRemainingMs: rem,
    };

    return {
      version: C10_SESSION_VERSION,
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

export function clearC10Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getC10StorageKey());
  } catch {
    // Ignore
  }
}
