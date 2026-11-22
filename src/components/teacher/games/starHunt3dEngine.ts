/**
 * E05 — SĂN SAO KIẾN THỨC 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Pure deterministic engine supporting:
 * 1. Star Map with 3 Constellation Clusters (default 9 stars: 3 per cluster; reduces cleanly when bank has fewer questions, never repeating).
 * 2. Exact 9-question THCS Math sample pack ("Săn sao kiến thức – Toán THCS", tagged "Dữ liệu mẫu", strictly separated from real bank).
 * 3. Smart EDU RBAC question bank adapter preserving access rules and stable option IDs across shuffling.
 * 4. 3 Participant Modes:
 *    - 'solo_practice' (1 HS)
 *    - 'whole_class' (1–50 HS hợp tác)
 *    - 'teams' (2–6 đội thi đua: rotating star selection, all teams answer simultaneously, +1 star per correct team,
 *      map star lights at most ONCE if >= 1 team is correct, equal stars => Đồng hạng, no speed/random bonuses,
 *      strictly distinguishes 'unrecorded' ("Chưa ghi nhận") from 'no_answer' ("Không trả lời")).
 * 5. Full turn lock while a star is active, idempotent commit by starId, edit-last-turn recomputing team stars + map star state
 *    + constellation completion purely from history, separate post-session "Ôn lại câu chưa đúng" tracker that NEVER mutates main stars.
 * 6. /demo-isolated localStorage persistence with corrupt JSON auto-recovery.
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type StarHuntParticipantMode = 'solo_practice' | 'whole_class' | 'teams';
export type StarQuestionSourceKind = 'sample' | 'bank';
export type StarOptionLetter = 'A' | 'B' | 'C' | 'D';
export type StarNodeStatus = 'unopened' | 'active' | 'lit' | 'solution_viewed';
export type StarTeamChoice = 'unrecorded' | 'no_answer' | StarOptionLetter;
export type StarSessionStatus = 'playing' | 'finished';

export const STAR_OPTION_LETTERS: StarOptionLetter[] = ['A', 'B', 'C', 'D'];
export const E05_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const E05_SAMPLE_PACK_TITLE = 'Săn sao kiến thức – Toán THCS';
export const E05_DEFAULT_STAR_COUNT = 9;
export const E05_DEFAULT_TIMER_SECONDS = 30;
export const E05_SESSION_STORAGE_KEY = 'taydo_e05_star_hunt_session_v1';
export const E05_SESSION_VERSION = 1;

export interface StarClusterMeta {
  id: 1 | 2 | 3;
  name: string;
  shortName: string;
  accentHex: string;
}

export const E05_CLUSTERS: StarClusterMeta[] = [
  { id: 1, name: 'Cụm 1 — Số và phép tính', shortName: 'Số & phép tính', accentHex: '#2DD4BF' },
  { id: 2, name: 'Cụm 2 — Biểu thức và phương trình', shortName: 'Biểu thức & PT', accentHex: '#38BDF8' },
  { id: 3, name: 'Cụm 3 — Hình học và xác suất', shortName: 'Hình học & XS', accentHex: '#FBBF24' },
];

export interface StarTeamPalette {
  id: string;
  hex: string;
  textOnSolid: string;
}

export const STAR_TEAM_PALETTES: StarTeamPalette[] = [
  { id: 'gold', hex: '#F59E0B', textOnSolid: '#061024' },
  { id: 'teal', hex: '#14B8A6', textOnSolid: '#061024' },
  { id: 'sky', hex: '#38BDF8', textOnSolid: '#061024' },
  { id: 'rose', hex: '#FB7185', textOnSolid: '#061024' },
  { id: 'violet', hex: '#A78BFA', textOnSolid: '#061024' },
  { id: 'emerald', hex: '#34D399', textOnSolid: '#061024' },
];

export interface StarTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

export interface StarQuestionOption {
  id: string; // Stable option ID preserved across shuffling
  label: StarOptionLetter;
  text: string;
}

export interface StarQuestionItem {
  id: string;
  code: string;
  clusterId: 1 | 2 | 3;
  topicLabel: string;
  stem: string;
  subject: string;
  grade: string;
  level: string;
  options: StarQuestionOption[];
  correctOptionId: string;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface StarNode {
  id: string; // e.g., 'star_1' ... 'star_9'
  starNumber: number; // 1..9
  clusterId: 1 | 2 | 3;
  slotInCluster: number; // 0, 1, 2
  topicLabel: string;
  question: StarQuestionItem;
}

export interface StarHuntConfig {
  participantMode: StarHuntParticipantMode;
  teams: StarTeamConfig[];
  sourceKind: StarQuestionSourceKind;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  starCount: number; // Default 9; reduced cleanly when bank has fewer questions
  timerSeconds: number; // Default 30; 0 = unlimited
  shuffleOptions: boolean;
}

export interface StarTurnRecord {
  turnOrder: number;
  starId: string;
  starNumber: number;
  clusterId: 1 | 2 | 3;
  questionId: string;
  pickedByTeamId: string | null; // Team that held star-selection turn (no bonus!)
  correctOptionId: string;
  correctOptionLabel: StarOptionLetter;
  /** Stored by stable optionId (or 'no_answer') per participant ('solo_1' or teamId). */
  chosenOptionIdByParticipant: Record<string, string | 'no_answer'>;
  chosenLabelByParticipant: Record<string, StarOptionLetter | 'no_answer'>;
  isCorrectByParticipant: Record<string, boolean>;
  starsEarnedByParticipant: Record<string, number>; // 1 or 0
  mapStarLit: boolean; // True iff >= 1 participant answered correctly; counted at most ONCE
  committedAt: number;
  wasEdited?: boolean;
}

export interface StarReviewAttempt {
  starId: string;
  chosenOptionId: string;
  isCorrect: boolean;
  attemptedAt: number;
}

export interface StarParticipantStanding {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  stars: number;
  correctCount: number;
  incorrectCount: number;
  noAnswerCount: number;
  rank: number;
  isTied: boolean;
}

export interface StarClusterProgress {
  cluster: StarClusterMeta;
  totalStars: number;
  litStars: number;
  isComplete: boolean; // True iff totalStars > 0 && litStars === totalStars
}

export interface StarHuntState {
  config: StarHuntConfig;
  stars: StarNode[];
  activeStarId: string | null;
  history: StarTurnRecord[];
  /** Separate post-session review practice tracker — NEVER mutates main-play stars/history. */
  reviewPractice: Record<string, StarReviewAttempt>;
  status: StarSessionStatus;
}

export interface StarSetupValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveStarCount: number;
}

// ============================================================================
// EXACT 9-QUESTION SAMPLE PACK: "Săn sao kiến thức – Toán THCS" ("Dữ liệu mẫu")
// 3 clusters × 3 stars; 4 distinct choices, 1 exact answer, zero equivalent duplicates
// ============================================================================

export const E05_SAMPLE_QUESTIONS: StarQuestionItem[] = [
  // Cụm 1 — Số và phép tính
  {
    id: 'e05_sample_01',
    code: 'E05-S01',
    clusterId: 1,
    topicLabel: 'Số nguyên',
    stem: 'Tính \\(-15+8\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e05_q1_a', label: 'A', text: '\\(-7\\)' },
      { id: 'e05_q1_b', label: 'B', text: '\\(7\\)' },
      { id: 'e05_q1_c', label: 'C', text: '\\(-23\\)' },
      { id: 'e05_q1_d', label: 'D', text: '\\(23\\)' },
    ],
    correctOptionId: 'e05_q1_a',
    officialAnswerText: '\\(-7\\)',
    explanation:
      'Cộng hai số nguyên trái dấu: lấy hiệu giá trị tuyệt đối \\(15 - 8 = 7\\) rồi đặt dấu âm của \\(-15\\), được \\(-7\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_02',
    code: 'E05-S02',
    clusterId: 1,
    topicLabel: 'Phân số',
    stem: 'Tính \\(\\frac{7}{8}-\\frac{1}{4}\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e05_q2_a', label: 'A', text: '\\(\\frac{3}{4}\\)' },
      { id: 'e05_q2_b', label: 'B', text: '\\(\\frac{5}{8}\\)' },
      { id: 'e05_q2_c', label: 'C', text: '\\(\\frac{3}{8}\\)' },
      { id: 'e05_q2_d', label: 'D', text: '\\(\\frac{1}{2}\\)' },
    ],
    correctOptionId: 'e05_q2_b',
    officialAnswerText: '\\(\\frac{5}{8}\\)',
    explanation:
      'Quy đồng mẫu chung \\(8\\): \\(\\frac{1}{4} = \\frac{2}{8}\\), suy ra \\(\\frac{7}{8} - \\frac{2}{8} = \\frac{5}{8}\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_03',
    code: 'E05-S03',
    clusterId: 1,
    topicLabel: 'Lũy thừa & Căn',
    stem: 'Tính \\((-5)^2-\\sqrt{81}\\).',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'e05_q3_a', label: 'A', text: '\\(-34\\)' },
      { id: 'e05_q3_b', label: 'B', text: '\\(-16\\)' },
      { id: 'e05_q3_c', label: 'C', text: '\\(16\\)' },
      { id: 'e05_q3_d', label: 'D', text: '\\(34\\)' },
    ],
    correctOptionId: 'e05_q3_c',
    officialAnswerText: '\\(16\\)',
    explanation:
      'Ta có \\((-5)^2 = 25\\) và \\(\\sqrt{81} = 9\\), nên \\((-5)^2 - \\sqrt{81} = 25 - 9 = 16\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },

  // Cụm 2 — Biểu thức và phương trình
  {
    id: 'e05_sample_04',
    code: 'E05-S04',
    clusterId: 2,
    topicLabel: 'Thu gọn biểu thức',
    stem: 'Thu gọn \\(5x-2x+4\\).',
    subject: 'math',
    grade: '7',
    level: 'know',
    options: [
      { id: 'e05_q4_a', label: 'A', text: '\\(7x+4\\)' },
      { id: 'e05_q4_b', label: 'B', text: '\\(3x-4\\)' },
      { id: 'e05_q4_c', label: 'C', text: '\\(7x\\)' },
      { id: 'e05_q4_d', label: 'D', text: '\\(3x+4\\)' },
    ],
    correctOptionId: 'e05_q4_d',
    officialAnswerText: '\\(3x+4\\)',
    explanation:
      'Cộng các hạng tử đồng dạng: \\(5x - 2x = (5 - 2)x = 3x\\), giữ nguyên hạng tử tự do \\(+4\\) được \\(3x + 4\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_05',
    code: 'E05-S05',
    clusterId: 2,
    topicLabel: 'Phương trình bậc nhất',
    stem: 'Giải \\(2x+7=19\\).',
    subject: 'math',
    grade: '8',
    level: 'know',
    options: [
      { id: 'e05_q5_a', label: 'A', text: '\\(x=6\\)' },
      { id: 'e05_q5_b', label: 'B', text: '\\(x=13\\)' },
      { id: 'e05_q5_c', label: 'C', text: '\\(x=5\\)' },
      { id: 'e05_q5_d', label: 'D', text: '\\(x=12\\)' },
    ],
    correctOptionId: 'e05_q5_a',
    officialAnswerText: '\\(x=6\\)',
    explanation:
      'Chuyển vế: \\(2x = 19 - 7 = 12\\), chia hai vế cho \\(2\\) được \\(x = 6\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_06',
    code: 'E05-S06',
    clusterId: 2,
    topicLabel: 'Hệ phương trình',
    stem: 'Giải \\(\\begin{cases}x+y=11\\\\x-y=3\\end{cases}\\).',
    subject: 'math',
    grade: '9',
    level: 'understand',
    options: [
      { id: 'e05_q6_a', label: 'A', text: '\\(x=4,\\ y=7\\)' },
      { id: 'e05_q6_b', label: 'B', text: '\\(x=7,\\ y=4\\)' },
      { id: 'e05_q6_c', label: 'C', text: '\\(x=8,\\ y=3\\)' },
      { id: 'e05_q6_d', label: 'D', text: '\\(x=6,\\ y=5\\)' },
    ],
    correctOptionId: 'e05_q6_b',
    officialAnswerText: '\\(x=7,\\ y=4\\)',
    explanation:
      'Cộng vế theo vế hai phương trình được \\(2x = 14 \\Rightarrow x = 7\\). Thay vào \\(x + y = 11\\) suy ra \\(y = 4\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },

  // Cụm 3 — Hình học và xác suất
  {
    id: 'e05_sample_07',
    code: 'E05-S07',
    clusterId: 3,
    topicLabel: 'Diện tích HCN',
    stem: 'Hình chữ nhật dài \\(8{,}5\\,\\mathrm{cm}\\), rộng \\(4\\,\\mathrm{cm}\\) có diện tích bao nhiêu?',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'e05_q7_a', label: 'A', text: '\\(25\\,\\mathrm{cm}^2\\)' },
      { id: 'e05_q7_b', label: 'B', text: '\\(32\\,\\mathrm{cm}^2\\)' },
      { id: 'e05_q7_c', label: 'C', text: '\\(34\\,\\mathrm{cm}^2\\)' },
      { id: 'e05_q7_d', label: 'D', text: '\\(12{,}5\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'e05_q7_c',
    officialAnswerText: '\\(34\\,\\mathrm{cm}^2\\)',
    explanation:
      'Diện tích hình chữ nhật bằng tích chiều dài và chiều rộng: \\(8{,}5 \\times 4 = 34\\,\\mathrm{cm}^2\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_08',
    code: 'E05-S08',
    clusterId: 3,
    topicLabel: 'Góc kề bù',
    stem: 'Một góc kề bù với góc \\(118^\\circ\\) có số đo bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'know',
    options: [
      { id: 'e05_q8_a', label: 'A', text: '\\(72^\\circ\\)' },
      { id: 'e05_q8_b', label: 'B', text: '\\(28^\\circ\\)' },
      { id: 'e05_q8_c', label: 'C', text: '\\(118^\\circ\\)' },
      { id: 'e05_q8_d', label: 'D', text: '\\(62^\\circ\\)' },
    ],
    correctOptionId: 'e05_q8_d',
    officialAnswerText: '\\(62^\\circ\\)',
    explanation:
      'Hai góc kề bù có tổng số đo bằng \\(180^\\circ\\), nên góc cần tìm là \\(180^\\circ - 118^\\circ = 62^\\circ\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
  {
    id: 'e05_sample_09',
    code: 'E05-S09',
    clusterId: 3,
    topicLabel: 'Xác suất',
    stem: 'Tung một xúc xắc cân đối sáu mặt. Xác suất ra số chia hết cho \\(3\\) là bao nhiêu?',
    subject: 'math',
    grade: '8',
    level: 'understand',
    options: [
      { id: 'e05_q9_a', label: 'A', text: '\\(\\frac{1}{3}\\)' },
      { id: 'e05_q9_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'e05_q9_c', label: 'C', text: '\\(\\frac{1}{6}\\)' },
      { id: 'e05_q9_d', label: 'D', text: '\\(\\frac{2}{3}\\)' },
    ],
    correctOptionId: 'e05_q9_a',
    officialAnswerText: '\\(\\frac{1}{3}\\)',
    explanation:
      'Có \\(6\\) kết quả đồng khả năng và \\(2\\) kết quả thuận lợi là \\(3\\) và \\(6\\), nên xác suất là \\(\\frac{2}{6} = \\frac{1}{3}\\).',
    isSample: true,
    sourceBadge: E05_SAMPLE_BADGE,
  },
];

// ============================================================================
// DEFAULT CONFIG, TEAMS & VALIDATION
// ============================================================================

const DEFAULT_STAR_TEAM_NAMES = [
  'Đội Bắc Đẩu',
  'Đội Thiên Lang',
  'Đội Ngân Hà',
  'Đội Sao Mai',
  'Đội Thái Dương',
  'Đội Khám Phá',
];

export function createStarTeams(teamCount: number, existingNames?: string[]): StarTeamConfig[] {
  const safe = Math.max(2, Math.min(6, Math.floor(teamCount)));
  return Array.from({ length: safe }, (_, idx) => ({
    id: `star_team_${idx + 1}`,
    teamNumber: idx + 1,
    name: existingNames?.[idx]?.trim() || DEFAULT_STAR_TEAM_NAMES[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % STAR_TEAM_PALETTES.length,
  }));
}

export function createDefaultStarHuntConfig(
  participantMode: StarHuntParticipantMode = 'solo_practice'
): StarHuntConfig {
  return {
    participantMode,
    teams: createStarTeams(4),
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    starCount: E05_DEFAULT_STAR_COUNT,
    timerSeconds: E05_DEFAULT_TIMER_SECONDS,
    shuffleOptions: true,
  };
}

export function getCorrectOptionLabelForStarQuestion(question: StarQuestionItem): StarOptionLetter {
  const found = question.options.find((o) => o.id === question.correctOptionId);
  return found ? found.label : 'A';
}

export function getStarOptionByLabel(
  question: StarQuestionItem,
  label: StarOptionLetter
): StarQuestionOption | undefined {
  return question.options.find((o) => o.label === label);
}

export function validateStarSetupConfig(
  config: StarHuntConfig,
  availableQuestionsCount: number
): StarSetupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.participantMode === 'teams') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ thi đua nhiều đội cần từ 2 đến 6 đội.');
    }
    config.teams.forEach((t, idx) => {
      if (!t.name.trim()) {
        errors.push(`Đội số ${idx + 1} chưa có tên.`);
      }
    });
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu phải từ 0 (không giới hạn) đến 300 giây.');
  }

  if (availableQuestionsCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện không có câu trắc nghiệm 4 lựa chọn phù hợp. Hãy đổi bộ câu hỏi hoặc dùng bộ mẫu 9 sao.'
    );
  } else if (config.starCount > availableQuestionsCount) {
    warnings.push(
      `Bộ câu hỏi hiện có ${availableQuestionsCount} câu (ít hơn ${config.starCount} sao). Bạn có thể giảm xuống ${availableQuestionsCount} sao hoặc đổi bộ câu hỏi — hệ thống không lặp lại câu.`
    );
  }

  const effectiveStarCount = Math.min(
    Math.max(1, Math.min(9, config.starCount)),
    Math.max(0, availableQuestionsCount)
  );

  return {
    valid: errors.length === 0 && effectiveStarCount > 0,
    errors,
    warnings,
    effectiveStarCount,
  };
}

// ============================================================================
// SHUFFLING & SMART EDU RBAC BANK ADAPTER
// ============================================================================

export function shuffleStarArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleStarOptionsPreservingId(
  item: StarQuestionItem,
  rng: () => number = Math.random
): StarQuestionItem {
  const shuffled = shuffleStarArray(item.options, rng).map((opt, idx) => ({
    ...opt,
    label: STAR_OPTION_LETTERS[idx] ?? 'D',
  }));
  return {
    ...item,
    options: shuffled,
  };
}

function normalizeStemKey(stem: string): string {
  return stem.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function isStarQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForStarHunt(
  question: Question,
  indexInPool: number
): StarQuestionItem | null {
  if (question.type !== 'single_choice') return null;
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const validOptions = (question.options || [])
    .filter((o) => o && (o.text || '').trim().length > 0)
    .slice(0, 4);

  if (validOptions.length !== 4) return null;

  const rawCorrect = String(question.correctAnswer || '').trim();
  let matchedCorrect = validOptions.find(
    (o) => o.id === rawCorrect || o.label?.toUpperCase() === rawCorrect.toUpperCase()
  );
  if (!matchedCorrect) {
    const letterIdx = STAR_OPTION_LETTERS.indexOf(rawCorrect.toUpperCase() as StarOptionLetter);
    if (letterIdx >= 0 && validOptions[letterIdx]) {
      matchedCorrect = validOptions[letterIdx];
    }
  }
  if (!matchedCorrect) return null;

  const mappedOptions: StarQuestionOption[] = validOptions.map((opt, idx) => ({
    id: opt.id || `${question.id}_opt_${idx}`,
    label: STAR_OPTION_LETTERS[idx],
    text: opt.text.trim(),
  }));

  const correctMapped =
    mappedOptions[validOptions.indexOf(matchedCorrect)] || mappedOptions[0];
  const clusterId = (((Math.floor(indexInPool / 3) % 3) + 1) as 1 | 2 | 3);

  return {
    id: question.id,
    code: question.code || `NH-${question.id.slice(0, 6).toUpperCase()}`,
    clusterId,
    topicLabel: ((question.chapter || question.lesson || 'Kiến thức').trim()).slice(0, 24),
    stem: cleanStem,
    subject: question.subject || 'math',
    grade: question.grade || '6',
    level: question.level || 'know',
    options: mappedOptions,
    correctOptionId: correctMapped.id,
    officialAnswerText: correctMapped.text,
    explanation:
      (question.explanation || '').trim() ||
      `Đáp án chính xác là ${correctMapped.label}: ${correctMapped.text}.`,
    isSample: false,
    sourceBadge: 'Ngân hàng câu hỏi',
  };
}

export function buildE05QuestionPool(params: {
  sourceKind: StarQuestionSourceKind;
  bankQuestions?: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): StarQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return E05_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options.map((o) => ({ ...o })),
    }));
  }

  const seenStems = new Set<string>();
  const results: StarQuestionItem[] = [];
  const bank = params.bankQuestions || [];

  for (const q of bank) {
    if (!isStarQuestionAllowedForRole(q, params.userRole)) continue;
    if (params.subjectFilter && params.subjectFilter !== 'all' && q.subject !== params.subjectFilter) {
      continue;
    }
    if (params.gradeFilter && params.gradeFilter !== 'all' && q.grade !== params.gradeFilter) {
      continue;
    }
    if (params.levelFilter && params.levelFilter !== 'all' && q.level !== params.levelFilter) {
      continue;
    }
    const adapted = adaptSmartEduQuestionForStarHunt(q, results.length);
    if (!adapted) continue;
    const key = normalizeStemKey(adapted.stem);
    if (seenStems.has(key)) continue;
    seenStems.add(key);
    results.push(adapted);
  }

  return results;
}

// ============================================================================
// CORE DETERMINISTIC STATE TRANSITIONS, SCORING & CONSTELLATIONS
// ============================================================================

export function createInitialStarHuntState(params: {
  config: StarHuntConfig;
  pool: StarQuestionItem[];
  rng?: () => number;
}): StarHuntState {
  const rng = params.rng ?? Math.random;
  const count = Math.min(Math.max(1, Math.min(9, params.config.starCount)), params.pool.length);

  // Never repeat questions! Slice strictly up to available unique questions.
  const selected = params.pool.slice(0, count).map((q) =>
    params.config.shuffleOptions ? shuffleStarOptionsPreservingId(q, rng) : { ...q, options: q.options.map((o) => ({ ...o })) }
  );

  // Distribute across the 3 clusters cleanly (in sample 9-star mode, respects each question's clusterId 1/2/3)
  const clusterCounters: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
  const stars: StarNode[] = selected.map((q, idx) => {
    const cId: 1 | 2 | 3 =
      params.config.sourceKind === 'sample'
        ? q.clusterId
        : (((Math.floor(idx / Math.ceil(count / 3)) % 3) + 1) as 1 | 2 | 3);
    const slotInCluster = clusterCounters[cId];
    clusterCounters[cId] += 1;
    return {
      id: `star_${idx + 1}`,
      starNumber: idx + 1,
      clusterId: cId,
      slotInCluster,
      topicLabel: q.topicLabel,
      question: q,
    };
  });

  return {
    config: {
      ...params.config,
      starCount: stars.length,
      teams: params.config.teams.map((t) => ({ ...t })),
    },
    stars,
    activeStarId: null,
    history: [],
    reviewPractice: {},
    status: stars.length > 0 ? 'playing' : 'finished',
  };
}

/**
 * Purely derives the visual/logical status of any star from `activeStarId` and `history`.
 */
export function getStarNodeStatus(state: StarHuntState, starId: string): StarNodeStatus {
  if (state.activeStarId === starId) return 'active';
  const rec = state.history.find((h) => h.starId === starId);
  if (!rec) return 'unopened';
  return rec.mapStarLit ? 'lit' : 'solution_viewed';
}

/**
 * Returns which team currently holds the star-selection turn (strictly rotates in team order).
 * Computed purely from `history.length % teams.length` so editing last turn never corrupts rotation!
 */
export function getCurrentPickingTeam(state: StarHuntState): StarTeamConfig | null {
  if (state.config.participantMode !== 'teams' || state.config.teams.length === 0) return null;
  if (state.status !== 'playing') return null;
  const idx = state.history.length % state.config.teams.length;
  return state.config.teams[idx] || state.config.teams[0];
}

/**
 * Opens an unopened star on the map.
 * Locks opening any other star while a star is currently active (`state.activeStarId !== null`).
 */
export function openStarOnMap(
  state: StarHuntState,
  starId: string
): { state: StarHuntState; opened: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { state, opened: false, reason: 'session_not_playing' };
  }
  if (state.activeStarId !== null) {
    return { state, opened: false, reason: 'star_already_active' };
  }
  const star = state.stars.find((s) => s.id === starId);
  if (!star) {
    return { state, opened: false, reason: 'star_not_found' };
  }
  if (state.history.some((h) => h.starId === starId)) {
    return { state, opened: false, reason: 'star_already_played' };
  }
  return {
    opened: true,
    state: {
      ...state,
      activeStarId: starId,
    },
  };
}

/**
 * Commits the result of the currently active star (strictly idempotent by `starId`).
 * - Solo / Whole-Class: records single choice (`optionLetter` or `'no_answer'`), lights star if correct.
 * - Teams (2–6 teams): requires EVERY team to be recorded ('A'|'B'|'C'|'D'|'no_answer');
 *   strictly rejects 'unrecorded'. Each correct team gets +1 star. Map star lights ONCE iff >= 1 team is correct.
 */
export function commitStarTurn(
  state: StarHuntState,
  input: {
    starId: string;
    singleChoice?: StarOptionLetter | 'no_answer' | null;
    teamChoices?: Record<string, StarTeamChoice>;
    committedAt?: number;
  }
): {
  state: StarHuntState;
  committed: boolean;
  reason?: string;
  record?: StarTurnRecord;
  newlyCompletedClusterId?: 1 | 2 | 3 | null;
} {
  if (state.status !== 'playing') {
    return { state, committed: false, reason: 'session_not_playing' };
  }
  if (state.activeStarId !== input.starId) {
    return { state, committed: false, reason: 'star_not_active' };
  }
  if (state.history.some((h) => h.starId === input.starId)) {
    return { state, committed: false, reason: 'duplicate_star_commit' };
  }

  const star = state.stars.find((s) => s.id === input.starId);
  if (!star) {
    return { state, committed: false, reason: 'star_not_found' };
  }

  const prevClusterComplete = new Set(
    computeClusterProgress(state)
      .filter((c) => c.isComplete)
      .map((c) => c.cluster.id)
  );

  const q = star.question;
  const correctLabel = getCorrectOptionLabelForStarQuestion(q);
  const chosenOptionIdByParticipant: Record<string, string | 'no_answer'> = {};
  const chosenLabelByParticipant: Record<string, StarOptionLetter | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const starsEarnedByParticipant: Record<string, number> = {};
  let anyCorrect = false;
  let pickedByTeamId: string | null = null;

  if (state.config.participantMode === 'teams') {
    const picker = getCurrentPickingTeam(state);
    pickedByTeamId = picker ? picker.id : null;
    const choices = input.teamChoices || {};

    for (const team of state.config.teams) {
      const c = choices[team.id];
      if (!c || c === 'unrecorded') {
        return { state, committed: false, reason: 'unrecorded_team' };
      }
      if (c === 'no_answer') {
        chosenOptionIdByParticipant[team.id] = 'no_answer';
        chosenLabelByParticipant[team.id] = 'no_answer';
        isCorrectByParticipant[team.id] = false;
        starsEarnedByParticipant[team.id] = 0;
      } else {
        const opt = getStarOptionByLabel(q, c);
        const optId = opt ? opt.id : 'no_answer';
        const isRight = optId === q.correctOptionId;
        chosenOptionIdByParticipant[team.id] = optId;
        chosenLabelByParticipant[team.id] = c;
        isCorrectByParticipant[team.id] = isRight;
        starsEarnedByParticipant[team.id] = isRight ? 1 : 0;
        if (isRight) anyCorrect = true;
      }
    }
  } else {
    const c = input.singleChoice || 'no_answer';
    if (c === 'no_answer') {
      chosenOptionIdByParticipant.solo_1 = 'no_answer';
      chosenLabelByParticipant.solo_1 = 'no_answer';
      isCorrectByParticipant.solo_1 = false;
      starsEarnedByParticipant.solo_1 = 0;
    } else {
      const opt = getStarOptionByLabel(q, c);
      const optId = opt ? opt.id : 'no_answer';
      const isRight = optId === q.correctOptionId;
      chosenOptionIdByParticipant.solo_1 = optId;
      chosenLabelByParticipant.solo_1 = c;
      isCorrectByParticipant.solo_1 = isRight;
      starsEarnedByParticipant.solo_1 = isRight ? 1 : 0;
      if (isRight) anyCorrect = true;
    }
  }

  const record: StarTurnRecord = {
    turnOrder: state.history.length + 1,
    starId: star.id,
    starNumber: star.starNumber,
    clusterId: star.clusterId,
    questionId: q.id,
    pickedByTeamId,
    correctOptionId: q.correctOptionId,
    correctOptionLabel: correctLabel,
    chosenOptionIdByParticipant,
    chosenLabelByParticipant,
    isCorrectByParticipant,
    starsEarnedByParticipant,
    mapStarLit: anyCorrect, // Counts at most ONCE even if multiple teams answered right!
    committedAt: input.committedAt ?? Date.now(),
  };

  const nextState: StarHuntState = {
    ...state,
    history: [...state.history, record],
  };

  const nextCompleted = computeClusterProgress(nextState).find(
    (c) => c.isComplete && !prevClusterComplete.has(c.cluster.id)
  );

  return {
    committed: true,
    record,
    newlyCompletedClusterId: nextCompleted ? nextCompleted.cluster.id : null,
    state: nextState,
  };
}

/**
 * Edits the most recently committed star turn BEFORE returning to open the next star or finalizing summary.
 * Recomputes every team's stars, map star illumination, and cluster constellation status purely from history!
 */
export function editLastStarTurn(
  state: StarHuntState,
  input: {
    singleChoice?: StarOptionLetter | 'no_answer';
    teamChoices?: Record<string, StarTeamChoice>;
  }
): {
  state: StarHuntState;
  edited: boolean;
  reason?: string;
} {
  if (state.history.length === 0) {
    return { state, edited: false, reason: 'no_history' };
  }

  const lastIdx = state.history.length - 1;
  const last = state.history[lastIdx];
  const star = state.stars.find((s) => s.id === last.starId);
  if (!star) {
    return { state, edited: false, reason: 'star_not_found' };
  }

  const q = star.question;
  const chosenOptionIdByParticipant: Record<string, string | 'no_answer'> = {};
  const chosenLabelByParticipant: Record<string, StarOptionLetter | 'no_answer'> = {};
  const isCorrectByParticipant: Record<string, boolean> = {};
  const starsEarnedByParticipant: Record<string, number> = {};
  let anyCorrect = false;

  if (state.config.participantMode === 'teams') {
    const choices = input.teamChoices || {};
    for (const team of state.config.teams) {
      const c = choices[team.id];
      if (!c || c === 'unrecorded') {
        return { state, edited: false, reason: 'unrecorded_team' };
      }
      if (c === 'no_answer') {
        chosenOptionIdByParticipant[team.id] = 'no_answer';
        chosenLabelByParticipant[team.id] = 'no_answer';
        isCorrectByParticipant[team.id] = false;
        starsEarnedByParticipant[team.id] = 0;
      } else {
        const opt = getStarOptionByLabel(q, c);
        const optId = opt ? opt.id : 'no_answer';
        const isRight = optId === q.correctOptionId;
        chosenOptionIdByParticipant[team.id] = optId;
        chosenLabelByParticipant[team.id] = c;
        isCorrectByParticipant[team.id] = isRight;
        starsEarnedByParticipant[team.id] = isRight ? 1 : 0;
        if (isRight) anyCorrect = true;
      }
    }
  } else {
    const c = input.singleChoice || 'no_answer';
    if (c === 'no_answer') {
      chosenOptionIdByParticipant.solo_1 = 'no_answer';
      chosenLabelByParticipant.solo_1 = 'no_answer';
      isCorrectByParticipant.solo_1 = false;
      starsEarnedByParticipant.solo_1 = 0;
    } else {
      const opt = getStarOptionByLabel(q, c);
      const optId = opt ? opt.id : 'no_answer';
      const isRight = optId === q.correctOptionId;
      chosenOptionIdByParticipant.solo_1 = optId;
      chosenLabelByParticipant.solo_1 = c;
      isCorrectByParticipant.solo_1 = isRight;
      starsEarnedByParticipant.solo_1 = isRight ? 1 : 0;
      if (isRight) anyCorrect = true;
    }
  }

  const nextHistory = [...state.history];
  nextHistory[lastIdx] = {
    ...last,
    chosenOptionIdByParticipant,
    chosenLabelByParticipant,
    isCorrectByParticipant,
    starsEarnedByParticipant,
    mapStarLit: anyCorrect,
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

/**
 * Returns from the currently revealed star back to the 3D star map (or transitions to finished summary if all stars played).
 */
export function returnToStarMap(state: StarHuntState): StarHuntState {
  const allPlayed = state.history.length >= state.stars.length;
  return {
    ...state,
    activeStarId: null,
    status: allPlayed ? 'finished' : 'playing',
  };
}

/**
 * Records a post-session "Ôn lại câu chưa đúng" attempt SEPARATELY without ever altering `state.history` or main star counts!
 */
export function recordStarReviewAttempt(
  state: StarHuntState,
  starId: string,
  chosenLabel: StarOptionLetter
): StarHuntState {
  const star = state.stars.find((s) => s.id === starId);
  if (!star) return state;
  const opt = getStarOptionByLabel(star.question, chosenLabel);
  if (!opt) return state;
  return {
    ...state,
    reviewPractice: {
      ...state.reviewPractice,
      [starId]: {
        starId,
        chosenOptionId: opt.id,
        isCorrect: opt.id === star.question.correctOptionId,
        attemptedAt: Date.now(),
      },
    },
  };
}

// ============================================================================
// DERIVED METRICS (STANDINGS, MAP STARS, CONSTELLATIONS, MISSED STARS)
// ============================================================================

export function computeMapLitStarCount(state: StarHuntState): number {
  return state.history.filter((h) => h.mapStarLit).length;
}

export function computeClusterProgress(state: StarHuntState): StarClusterProgress[] {
  return E05_CLUSTERS.map((cluster) => {
    const clusterStars = state.stars.filter((s) => s.clusterId === cluster.id);
    const litStars = clusterStars.filter((s) => {
      const rec = state.history.find((h) => h.starId === s.id);
      return Boolean(rec?.mapStarLit);
    }).length;
    return {
      cluster,
      totalStars: clusterStars.length,
      litStars,
      isComplete: clusterStars.length > 0 && litStars === clusterStars.length,
    };
  });
}

export function getMissedStarsForReview(state: StarHuntState): StarNode[] {
  const missedIds = new Set(
    state.history.filter((h) => !h.mapStarLit).map((h) => h.starId)
  );
  return state.stars.filter((s) => missedIds.has(s.id));
}

/**
 * Pure standings computed strictly from `state.history`.
 * Equal star counts share the exact same rank with `isTied = true` ("Đồng hạng").
 */
export function computeStarStandings(state: StarHuntState): StarParticipantStanding[] {
  if (state.config.participantMode !== 'teams') {
    let stars = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;
    for (const rec of state.history) {
      stars += rec.starsEarnedByParticipant.solo_1 || 0;
      const c = rec.chosenOptionIdByParticipant.solo_1;
      if (!c || c === 'no_answer') noAnswerCount += 1;
      else if (rec.isCorrectByParticipant.solo_1) correctCount += 1;
      else incorrectCount += 1;
    }
    return [
      {
        id: 'solo_1',
        teamNumber: 1,
        name:
          state.config.participantMode === 'whole_class'
            ? 'Cả lớp hợp tác'
            : 'Tự luyện cá nhân',
        paletteIndex: 0,
        stars,
        correctCount,
        incorrectCount,
        noAnswerCount,
        rank: 1,
        isTied: false,
      },
    ];
  }

  const rows: StarParticipantStanding[] = state.config.teams.map((team) => {
    let stars = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let noAnswerCount = 0;
    for (const rec of state.history) {
      stars += rec.starsEarnedByParticipant[team.id] || 0;
      const c = rec.chosenOptionIdByParticipant[team.id];
      if (!c || c === 'no_answer') noAnswerCount += 1;
      else if (rec.isCorrectByParticipant[team.id]) correctCount += 1;
      else incorrectCount += 1;
    }
    return {
      id: team.id,
      teamNumber: team.teamNumber,
      name: team.name,
      paletteIndex: team.paletteIndex,
      stars,
      correctCount,
      incorrectCount,
      noAnswerCount,
      rank: 1,
      isTied: false,
    };
  });

  rows.sort((a, b) => b.stars - a.stars || a.teamNumber - b.teamNumber);

  const freq = new Map<number, number>();
  rows.forEach((r) => freq.set(r.stars, (freq.get(r.stars) || 0) + 1));

  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i].stars === rows[i - 1].stars) {
      rows[i].rank = rows[i - 1].rank;
    } else {
      rows[i].rank = i + 1;
    }
    rows[i].isTied = (freq.get(rows[i].stars) || 0) > 1;
  }

  return rows;
}

// ============================================================================
// SESSION PERSISTENCE (/DEMO ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredE05SessionPayload {
  version: number;
  state: StarHuntState;
  updatedAt: number;
}

export function getE05SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${E05_SESSION_STORAGE_KEY}`
    : E05_SESSION_STORAGE_KEY;
}

export function saveE05Session(state: StarHuntState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: StoredE05SessionPayload = {
      version: E05_SESSION_VERSION,
      state,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getE05SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function clearE05Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getE05SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadE05Session(): {
  state: StarHuntState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getE05SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredE05SessionPayload>;
    const st = parsed?.state;
    if (
      !parsed ||
      parsed.version !== E05_SESSION_VERSION ||
      !st ||
      !st.config ||
      !Array.isArray(st.stars) ||
      st.stars.length === 0 ||
      !Array.isArray(st.history)
    ) {
      clearE05Session();
      return { state: null, recoveredFromCorruption: true };
    }
    return {
      state: {
        ...st,
        reviewPractice: st.reviewPractice || {},
      },
      recoveredFromCorruption: false,
    };
  } catch {
    clearE05Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
