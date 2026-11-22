/**
 * D02 — ĐUA THUYỀN 3D ("ĐƯỜNG ĐUA TRI THỨC") — Tây Đô Smart EDU
 * Pure deterministic river boat race engine:
 * - Modes:
 *   1. `teams` (default): 2–6 teams in fixed parallel lanes (0..N-1), optional in-session class division (1–50 HS)
 *   2. `solo`: 1 student, 1 boat, direct option select + "Chốt" before deadline (if timer on)
 *   3. `class_coop`: whole class rowing 1 shared boat cooperatively
 * - Rules (locked on race start):
 *   - Default: 10 questions, target 800 m (8 correct needed), 30s/question (or unlimited)
 *   - Correct: +100 m; Wrong / No Answer: 0 m (no speed bonus, no random current)
 *   - Target must be a positive multiple of 100 m and <= 100 m * questionCount
 *   - Distances & finish state computed STRICTLY from confirmed history; display clamped to targetMeters
 *   - Simultaneous multi-team commit: ALL teams' results for a round are applied BEFORE checking finish,
 *     so multiple teams hitting targetMeters on the same round are Co-Winners ("Đồng thắng"), regardless of input order!
 *   - Edit just-confirmed round (before next question or locking summary): recomputes distances & finish status
 *     from history, including reversing a just-triggered finish!
 *   - No finisher when deck ends: "Chưa có đội về đích" + actual distances + tie rankings ("Đồng hạng")
 *   - Early stop: "Kết thúc sớm" + exact played count (unplayed questions NEVER counted as wrong!)
 * - Built-in 10-question sample pack "Đua thuyền Toán THCS" ("Dữ liệu mẫu") + Smart EDU RBAC bank adapter
 * - Single deadline-based clock, Pause/Resume preserving remaining ms, turnToken anti-double-click lock
 * - Demo-isolated session persistence reconstructing boat positions strictly from history.
 */

import { Question, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type BoatRaceMode = 'teams' | 'solo' | 'class_coop';

export type BoatQuestionSource = 'sample_math' | 'bank';

export type BoatQuestionType = 'single_choice' | 'true_false' | 'short_answer';

export type BoatRacePhase =
  | 'setup'
  | 'ready'
  | 'answering'
  | 'stopped'
  | 'revealed'
  | 'round_confirmed'
  | 'summary';

export type BoatTeamMark = 'unmarked' | 'correct' | 'wrong' | 'no_answer';

export interface BoatTeamConfig {
  teamId: string;
  laneIndex: number; // Fixed 0..5 throughout the entire race!
  name: string;
  colorHex: string;
  colorNameVi: string;
  memberNames: string[]; // Optional in-session roster slice (never writes to DB!)
}

export interface BoatQuestionOption {
  optionId: string;
  label: string;
  textLatex: string;
}

export interface BoatQuestionItem {
  questionId: string;
  type: BoatQuestionType;
  topic: string;
  stemLatex: string;
  imageUrl?: string | null;
  options: BoatQuestionOption[];
  correctOptionId: string | null;
  answerLatex: string;
  explanationLatex: string;
  plainReadText: string;
  preserveOptionOrder?: boolean;
  isSample: boolean;
  sourceBadge: string;
}

export interface BoatTeamRoundOutcome {
  teamId: string;
  mark: BoatTeamMark;
  selectedOptionId: string | null;
  metersGained: number; // Strictly 100 if correct, else 0
}

export interface BoatRoundRecord {
  roundNumber: number; // 1-based played order
  turnToken: string;
  questionId: string;
  topic: string;
  stemLatex: string;
  answerLatex: string;
  explanationLatex: string;
  resultSource: 'teacher_input' | 'solo_player';
  outcomes: Record<string, BoatTeamRoundOutcome>;
  editCount: number;
  confirmedAt: number;
}

export interface BoatRaceConfig {
  mode: BoatRaceMode;
  questionSource: BoatQuestionSource;
  requestedQuestionCount: number; // Default 10
  targetMeters: number; // Positive multiple of 100, <= 100 * questionCount; default 800
  timerSeconds: number; // Default 30; 0 = unlimited
  teams: BoatTeamConfig[]; // Fixed lane order
}

export interface BoatTeamStanding {
  teamId: string;
  laneIndex: number;
  name: string;
  colorHex: string;
  colorNameVi: string;
  rawMeters: number; // Unclamped (correctCount * 100)
  displayMeters: number; // Clamped to targetMeters for boat rendering
  remainingMeters: number; // Math.max(0, targetMeters - displayMeters)
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  finished: boolean;
  finishedOnRound: number | null;
  rank: number; // 1-based; equal distances share same rank (Đồng hạng)
  isTiedRank: boolean;
}

export interface BoatRaceStandingsReport {
  standings: BoatTeamStanding[];
  winners: BoatTeamStanding[]; // Teams that reached targetMeters on the finishing round
  hasFinisher: boolean;
  isCoWin: boolean;
  finishingRound: number | null;
  playedCount: number;
  statusHeadline: string;
}

export interface BoatRaceState {
  raceId: string;
  config: BoatRaceConfig;
  rulesLocked: boolean;
  phase: BoatRacePhase;
  deck: BoatQuestionItem[];
  reserveDeck: BoatQuestionItem[]; // Unused valid questions for faulty-resource swap
  currentQuestionIndex: number;
  turnToken: string;

  // Single deadline-based clock
  mediaReady: boolean;
  deadlineMs: number | null;
  pausedRemainingMs: number | null;
  isPaused: boolean;
  timedOutCurrentRound: boolean;

  // Current round draft marks
  draftMarks: Record<string, BoatTeamMark>;
  draftOptionIds: Record<string, string | null>;
  soloLockedOptionId: string | null;

  // Idempotency, edit & finish tracking
  lastConfirmedTurnToken: string | null;
  editingLastConfirmed: boolean;
  endedEarly: boolean;
  readyToFinishSummary: boolean; // True when a boat reached targetMeters OR deck exhausted (still editable before locking summary!)

  // Authoritative history (all boat distances & standings strictly derived from history!)
  history: BoatRoundRecord[];
  statusMessage: string | null;
}

export const D02_STEP_METERS = 100;
export const D02_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D02_SESSION_STORAGE_KEY = 'taydo_d02_boat_race_session_v1';
export const D02_SESSION_VERSION = 1;

export const D02_TEAM_PALETTE: { name: string; colorHex: string; colorNameVi: string }[] = [
  { name: 'Đội Xanh dương', colorHex: '#2563EB', colorNameVi: 'Xanh dương' },
  { name: 'Đội Vàng', colorHex: '#F59E0B', colorNameVi: 'Vàng' },
  { name: 'Đội Xanh ngọc', colorHex: '#10B981', colorNameVi: 'Xanh ngọc' },
  { name: 'Đội Đỏ san hô', colorHex: '#EF4444', colorNameVi: 'Đỏ' },
  { name: 'Đội Tím lam', colorHex: '#8B5CF6', colorNameVi: 'Tím' },
  { name: 'Đội Hồng cam', colorHex: '#EC4899', colorNameVi: 'Hồng' },
];

// ============================================================================
// BUILT-IN 10-QUESTION SAMPLE PACK: "Đua thuyền Toán THCS" ("Dữ liệu mẫu")
// Exact 10 specification questions + 3 distinct distractors + concise explanation
// ============================================================================

export const D02_SAMPLE_MATH_QUESTIONS: BoatQuestionItem[] = [
  {
    questionId: 'd02_math_01',
    type: 'single_choice',
    topic: 'Số học',
    stemLatex: 'Tính \\(24 + 36\\).',
    options: [
      { optionId: 'b1_a', label: 'A', textLatex: '\\(60\\)' },
      { optionId: 'b1_b', label: 'B', textLatex: '\\(50\\)' },
      { optionId: 'b1_c', label: 'C', textLatex: '\\(62\\)' },
      { optionId: 'b1_d', label: 'D', textLatex: '\\(58\\)' },
    ],
    correctOptionId: 'b1_a',
    answerLatex: '\\(60\\)',
    explanationLatex: 'Cộng hàng đơn vị \\(4 + 6 = 10\\) nhớ \\(1\\); hàng chục \\(2 + 3 + 1 = 6\\), được \\(60\\).',
    plainReadText: 'Tính 24 cộng 36.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_02',
    type: 'single_choice',
    topic: 'Phép nhân',
    stemLatex: 'Tính \\(7 \\times 8\\).',
    options: [
      { optionId: 'b2_a', label: 'A', textLatex: '\\(54\\)' },
      { optionId: 'b2_b', label: 'B', textLatex: '\\(56\\)' },
      { optionId: 'b2_c', label: 'C', textLatex: '\\(48\\)' },
      { optionId: 'b2_d', label: 'D', textLatex: '\\(64\\)' },
    ],
    correctOptionId: 'b2_b',
    answerLatex: '\\(56\\)',
    explanationLatex: 'Theo bảng cửu chương, \\(7 \\times 8 = 56\\).',
    plainReadText: 'Tính 7 nhân 8.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_03',
    type: 'single_choice',
    topic: 'Lũy thừa',
    stemLatex: 'Tính giá trị của \\(2^3 + 5\\).',
    options: [
      { optionId: 'b3_a', label: 'A', textLatex: '\\(11\\)' },
      { optionId: 'b3_b', label: 'B', textLatex: '\\(14\\)' },
      { optionId: 'b3_c', label: 'C', textLatex: '\\(13\\)' },
      { optionId: 'b3_d', label: 'D', textLatex: '\\(16\\)' },
    ],
    correctOptionId: 'b3_c',
    answerLatex: '\\(13\\)',
    explanationLatex: 'Tính lũy thừa trước: \\(2^3 = 2 \\times 2 \\times 2 = 8\\), sau đó \\(8 + 5 = 13\\).',
    plainReadText: 'Tính giá trị của 2 mũ 3 cộng 5.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_04',
    type: 'single_choice',
    topic: 'Số nguyên',
    stemLatex: 'Tính \\(-7 + 12\\).',
    options: [
      { optionId: 'b4_a', label: 'A', textLatex: '\\(-5\\)' },
      { optionId: 'b4_b', label: 'B', textLatex: '\\(19\\)' },
      { optionId: 'b4_c', label: 'C', textLatex: '\\(-19\\)' },
      { optionId: 'b4_d', label: 'D', textLatex: '\\(5\\)' },
    ],
    correctOptionId: 'b4_d',
    answerLatex: '\\(5\\)',
    explanationLatex: 'Cộng hai số nguyên trái dấu: \\(-7 + 12 = 12 - 7 = 5\\).',
    plainReadText: 'Tính âm 7 cộng 12.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_05',
    type: 'single_choice',
    topic: 'Phân số',
    stemLatex: 'Tính \\(\\frac{1}{2} + \\frac{1}{4}\\).',
    options: [
      { optionId: 'b5_a', label: 'A', textLatex: '\\(\\frac{3}{4}\\)' },
      { optionId: 'b5_b', label: 'B', textLatex: '\\(\\frac{2}{6}\\)' },
      { optionId: 'b5_c', label: 'C', textLatex: '\\(\\frac{1}{6}\\)' },
      { optionId: 'b5_d', label: 'D', textLatex: '\\(\\frac{2}{4}\\)' },
    ],
    correctOptionId: 'b5_a',
    answerLatex: '\\(\\frac{3}{4}\\)',
    explanationLatex: 'Quy đồng mẫu số chung \\(4\\): \\(\\frac{1}{2} + \\frac{1}{4} = \\frac{2}{4} + \\frac{1}{4} = \\frac{3}{4}\\).',
    plainReadText: 'Tính 1 phần 2 cộng 1 phần 4.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_06',
    type: 'single_choice',
    topic: 'Giá trị phân số của một số',
    stemLatex: 'Tính \\(\\frac{3}{5}\\) của \\(20\\).',
    options: [
      { optionId: 'b6_a', label: 'A', textLatex: '\\(15\\)' },
      { optionId: 'b6_b', label: 'B', textLatex: '\\(12\\)' },
      { optionId: 'b6_c', label: 'C', textLatex: '\\(8\\)' },
      { optionId: 'b6_d', label: 'D', textLatex: '\\(10\\)' },
    ],
    correctOptionId: 'b6_b',
    answerLatex: '\\(12\\)',
    explanationLatex: 'Ta tính \\(20 \\times \\frac{3}{5} = (20 : 5) \\times 3 = 4 \\times 3 = 12\\).',
    plainReadText: 'Tính 3 phần 5 của 20.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_07',
    type: 'single_choice',
    topic: 'Tỉ số',
    stemLatex: 'Rút gọn tỉ số \\(12 : 18\\) về dạng tối giản:',
    options: [
      { optionId: 'b7_a', label: 'A', textLatex: '\\(3 : 4\\)' },
      { optionId: 'b7_b', label: 'B', textLatex: '\\(4 : 6\\)' },
      { optionId: 'b7_c', label: 'C', textLatex: '\\(2 : 3\\)' },
      { optionId: 'b7_d', label: 'D', textLatex: '\\(6 : 9\\)' },
    ],
    correctOptionId: 'b7_c',
    answerLatex: '\\(2 : 3\\)',
    explanationLatex: 'Ước chung lớn nhất của \\(12\\) và \\(18\\) là \\(6\\). Chia cả hai số cho \\(6\\) được \\(2 : 3\\).',
    plainReadText: 'Rút gọn tỉ số 12 chia 18 về dạng tối giản.',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_08',
    type: 'single_choice',
    topic: 'Chu vi hình vuông',
    stemLatex: 'Hình vuông có cạnh dài \\(6\\text{ cm}\\). Chu vi hình vuông đó là:',
    options: [
      { optionId: 'b8_a', label: 'A', textLatex: '\\(12\\text{ cm}\\)' },
      { optionId: 'b8_b', label: 'B', textLatex: '\\(36\\text{ cm}\\)' },
      { optionId: 'b8_c', label: 'C', textLatex: '\\(18\\text{ cm}\\)' },
      { optionId: 'b8_d', label: 'D', textLatex: '\\(24\\text{ cm}\\)' },
    ],
    correctOptionId: 'b8_d',
    answerLatex: '\\(24\\text{ cm}\\)',
    explanationLatex: 'Chu vi hình vuông bằng cạnh nhân \\(4\\): \\(P = 6 \\times 4 = 24\\text{ cm}\\).',
    plainReadText: 'Hình vuông có cạnh 6 xen-ti-mét. Chu vi hình vuông đó là bao nhiêu?',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_09',
    type: 'single_choice',
    topic: 'Diện tích hình chữ nhật',
    stemLatex: 'Hình chữ nhật có chiều dài \\(9\\text{ cm}\\) và chiều rộng \\(4\\text{ cm}\\). Diện tích hình chữ nhật đó là:',
    options: [
      { optionId: 'b9_a', label: 'A', textLatex: '\\(36\\text{ cm}^2\\)' },
      { optionId: 'b9_b', label: 'B', textLatex: '\\(26\\text{ cm}^2\\)' },
      { optionId: 'b9_c', label: 'C', textLatex: '\\(13\\text{ cm}^2\\)' },
      { optionId: 'b9_d', label: 'D', textLatex: '\\(32\\text{ cm}^2\\)' },
    ],
    correctOptionId: 'b9_a',
    answerLatex: '\\(36\\text{ cm}^2\\)',
    explanationLatex: 'Diện tích hình chữ nhật bằng chiều dài nhân chiều rộng: \\(S = 9 \\times 4 = 36\\text{ cm}^2\\).',
    plainReadText: 'Hình chữ nhật dài 9 xen-ti-mét, rộng 4 xen-ti-mét. Diện tích hình chữ nhật đó là bao nhiêu?',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
  {
    questionId: 'd02_math_10',
    type: 'single_choice',
    topic: 'Chuyển động đều',
    stemLatex: 'Một chiếc thuyền đi đều quãng đường \\(120\\text{ m}\\) trong \\(30\\text{ giây}\\). Vận tốc của thuyền là:',
    options: [
      { optionId: 'b10_a', label: 'A', textLatex: '\\(3\\text{ m/s}\\)' },
      { optionId: 'b10_b', label: 'B', textLatex: '\\(4\\text{ m/s}\\)' },
      { optionId: 'b10_c', label: 'C', textLatex: '\\(6\\text{ m/s}\\)' },
      { optionId: 'b10_d', label: 'D', textLatex: '\\(90\\text{ m/s}\\)' },
    ],
    correctOptionId: 'b10_b',
    answerLatex: '\\(4\\text{ m/s}\\)',
    explanationLatex: 'Áp dụng công thức vận tốc \\(v = \\frac{s}{t} = \\frac{120}{30} = 4\\text{ m/s}\\).',
    plainReadText: 'Thuyền đi đều 120 mét trong 30 giây. Vận tốc của thuyền là bao nhiêu?',
    isSample: true,
    sourceBadge: D02_SAMPLE_BADGE,
  },
];

// ============================================================================
// VALIDATION, SAFE SHUFFLE & SMART EDU RBAC BANK ADAPTER
// ============================================================================

export function validateBoatQuestion(q: BoatQuestionItem): { valid: boolean; reason?: string } {
  if (!q || !q.questionId || !q.questionId.trim()) {
    return { valid: false, reason: 'Thiếu questionId.' };
  }
  if (!q.stemLatex || !q.stemLatex.trim()) {
    return { valid: false, reason: 'Nội dung câu hỏi trống.' };
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
      return { valid: false, reason: 'Thiếu đáp án đúng khớp optionId.' };
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

/**
 * Shuffles options ONCE per raceId while preserving `optionId` binding (never index-based!).
 * Keeps order intact for true/false or options referencing A/B/C/D labels.
 */
export function shuffleBoatOptionsOnce(
  q: BoatQuestionItem,
  seedKey: string
): BoatQuestionItem {
  if (q.type !== 'single_choice' || q.preserveOptionOrder || q.options.length <= 1) {
    return q;
  }
  const labelDependent = /(cả\s+[a-d]\s+và\s+[a-d]|tất cả các đáp án|phương án\s+[a-d]|cả hai đáp án)/i;
  if (q.options.some((o) => labelDependent.test(o.textLatex))) {
    return q;
  }
  const copy = q.options.map((o) => ({ ...o }));
  let rng = hashSeed(`${seedKey}:${q.questionId}`) || 4242;
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

export function adaptBankQuestionsForD02(
  bankQuestions: Question[],
  userRole: UserRole
): BoatQuestionItem[] {
  if (!Array.isArray(bankQuestions) || bankQuestions.length === 0) return [];
  const seen = new Set<string>();
  const out: BoatQuestionItem[] = [];

  for (const q of bankQuestions) {
    if (!q || !q.id || seen.has(q.id)) continue;
    if (q.status === 'deprecated') continue;
    if (userRole === 'student' && q.status !== 'approved') continue;
    const stem = (q.stem || '').trim();
    if (!stem) continue;

    const topic = (q.chapter || q.lesson || 'Ngân hàng Smart EDU').trim();
    const explanation = (q.explanation || 'Giáo viên hướng dẫn lời giải chi tiết trên lớp.').trim();

    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const optSeen = new Set<string>();
      const opts: BoatQuestionOption[] = [];
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

      const item: BoatQuestionItem = {
        questionId: q.id,
        type: 'single_choice',
        topic,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: opts,
        correctOptionId: matched[0].optionId,
        answerLatex: `${matched[0].label}. ${matched[0].textLatex}`,
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateBoatQuestion(item).valid) {
        seen.add(q.id);
        out.push(item);
      }
    } else if (q.type === 'short_answer' || q.type === 'essay' || q.type === 'true_false_group') {
      const answerStr =
        q.type === 'short_answer' && Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length > 0
          ? q.acceptedAnswers[0]
          : q.type === 'true_false_group' && Array.isArray(q.subItems)
            ? q.subItems.map((s) => `${s.label}) ${s.isCorrect ? 'Đúng' : 'Sai'}`).join(' · ')
            : q.sampleAnswer || 'Xem lời giải chi tiết';
      const item: BoatQuestionItem = {
        questionId: q.id,
        type: 'short_answer',
        topic,
        stemLatex: stem,
        imageUrl: q.image || null,
        options: [],
        correctOptionId: null,
        answerLatex: answerStr,
        explanationLatex: explanation,
        plainReadText: stem,
        isSample: false,
        sourceBadge: 'Ngân hàng Smart EDU',
      };
      if (validateBoatQuestion(item).valid) {
        seen.add(q.id);
        out.push(item);
      }
    }
  }

  return out;
}

// ============================================================================
// TEAM BUILDERS, IN-SESSION ROSTER SPLIT & SETUP VALIDATION
// ============================================================================

export function buildDefaultBoatTeams(mode: BoatRaceMode, teamCount: number = 4): BoatTeamConfig[] {
  if (mode === 'solo') {
    return [
      {
        teamId: 'boat_solo',
        laneIndex: 0,
        name: 'Thuyền Tự luyện',
        colorHex: '#0EA5E9',
        colorNameVi: 'Xanh biển',
        memberNames: [],
      },
    ];
  }
  if (mode === 'class_coop') {
    return [
      {
        teamId: 'boat_class',
        laneIndex: 0,
        name: 'Thuyền Cả lớp',
        colorHex: '#10B981',
        colorNameVi: 'Xanh ngọc',
        memberNames: [],
      },
    ];
  }
  const safeCount = Math.max(2, Math.min(6, Math.round(teamCount)));
  return Array.from({ length: safeCount }, (_, idx) => {
    const p = D02_TEAM_PALETTE[idx % D02_TEAM_PALETTE.length];
    return {
      teamId: `team_${idx + 1}`,
      laneIndex: idx,
      name: p.name,
      colorHex: p.colorHex,
      colorNameVi: p.colorNameVi,
      memberNames: [],
    };
  });
}

/**
 * Distributes a class roster (1–50 students) evenly across teams strictly in-session (zero DB mutation).
 */
export function distributeStudentsIntoBoatTeams(
  teams: BoatTeamConfig[],
  studentNames: string[]
): BoatTeamConfig[] {
  if (teams.length === 0) return teams;
  const buckets: string[][] = teams.map(() => []);
  studentNames.forEach((name, idx) => {
    const clean = name.trim();
    if (clean) {
      buckets[idx % teams.length].push(clean);
    }
  });
  return teams.map((t, idx) => ({
    ...t,
    memberNames: buckets[idx],
  }));
}

export function validateBoatRaceSetup(
  requestedQuestionCount: number,
  targetMeters: number,
  availableQuestionsCount: number
): { valid: boolean; error: string | null; neededCorrect: number } {
  const qCount = Math.floor(requestedQuestionCount);
  if (availableQuestionsCount <= 0) {
    return {
      valid: false,
      error: 'Bộ câu hỏi hiện tại chưa có câu hợp lệ. Vui lòng chọn bộ khác hoặc dùng bộ Dữ liệu mẫu.',
      neededCorrect: 0,
    };
  }
  if (qCount < 1 || qCount > availableQuestionsCount) {
    return {
      valid: false,
      error: `Bộ câu hỏi hiện có ${availableQuestionsCount} câu hợp lệ (không đủ ${qCount} câu). Hãy giảm số câu hoặc đổi bộ câu hỏi.`,
      neededCorrect: 0,
    };
  }
  if (targetMeters <= 0 || targetMeters % D02_STEP_METERS !== 0) {
    return {
      valid: false,
      error: `Quãng đường đích phải là số dương và là bội số của ${D02_STEP_METERS} m.`,
      neededCorrect: 0,
    };
  }
  const maxReachable = qCount * D02_STEP_METERS;
  if (targetMeters > maxReachable) {
    return {
      valid: false,
      error: `Quãng đường đích (${targetMeters} m) vượt quá tối đa ${maxReachable} m cho ${qCount} câu hỏi (mỗi câu đúng tiến ${D02_STEP_METERS} m).`,
      neededCorrect: targetMeters / D02_STEP_METERS,
    };
  }
  return {
    valid: true,
    error: null,
    neededCorrect: targetMeters / D02_STEP_METERS,
  };
}

// ============================================================================
// SINGLE-SOURCE-OF-TRUTH STANDINGS & FINISH COMPUTATION
// ============================================================================

/**
 * Computes every boat's exact distance, rank ("Đồng hạng"), and finish winners ("Đồng thắng")
 * STRICTLY from confirmed `history`. Never drifts on edits, reloads, or animation skips!
 */
export function computeBoatRaceStandings(state: BoatRaceState): BoatRaceStandingsReport {
  const target = state.config.targetMeters;
  const statsMap = new Map<
    string,
    {
      correct: number;
      wrong: number;
      noAnswer: number;
      finishedOnRound: number | null;
    }
  >();

  for (const t of state.config.teams) {
    statsMap.set(t.teamId, { correct: 0, wrong: 0, noAnswer: 0, finishedOnRound: null });
  }

  let finishingRound: number | null = null;

  for (const rec of state.history) {
    // Apply ALL teams' results from this round simultaneously before checking who hit targetMeters!
    for (const t of state.config.teams) {
      const entry = statsMap.get(t.teamId)!;
      const out = rec.outcomes[t.teamId];
      if (!out) continue;
      if (out.mark === 'correct') entry.correct += 1;
      else if (out.mark === 'wrong') entry.wrong += 1;
      else if (out.mark === 'no_answer') entry.noAnswer += 1;
    }

    if (finishingRound === null) {
      let roundHadFinisher = false;
      for (const t of state.config.teams) {
        const entry = statsMap.get(t.teamId)!;
        if (entry.correct * D02_STEP_METERS >= target) {
          entry.finishedOnRound = rec.roundNumber;
          roundHadFinisher = true;
        }
      }
      if (roundHadFinisher) {
        finishingRound = rec.roundNumber;
      }
    }
  }

  const rawRows: BoatTeamStanding[] = state.config.teams.map((t) => {
    const entry = statsMap.get(t.teamId)!;
    const rawMeters = entry.correct * D02_STEP_METERS;
    const displayMeters = Math.min(rawMeters, target);
    const remainingMeters = Math.max(0, target - displayMeters);
    const finished = rawMeters >= target;
    return {
      teamId: t.teamId,
      laneIndex: t.laneIndex,
      name: t.name,
      colorHex: t.colorHex,
      colorNameVi: t.colorNameVi,
      rawMeters,
      displayMeters,
      remainingMeters,
      correctCount: entry.correct,
      wrongCount: entry.wrong,
      noAnswerCount: entry.noAnswer,
      finished,
      finishedOnRound: entry.finishedOnRound,
      rank: 1,
      isTiedRank: false,
    };
  });

  // Sort by displayMeters descending, keeping lane order stable on exact ties
  const sorted = [...rawRows].sort((a, b) => {
    if (b.displayMeters !== a.displayMeters) return b.displayMeters - a.displayMeters;
    return a.laneIndex - b.laneIndex;
  });

  const distCounts = new Map<number, number>();
  for (const r of sorted) {
    distCounts.set(r.displayMeters, (distCounts.get(r.displayMeters) || 0) + 1);
  }

  let curRank = 1;
  const ranked = sorted.map((row, idx) => {
    if (idx > 0 && row.displayMeters < sorted[idx - 1].displayMeters) {
      curRank = idx + 1;
    }
    return {
      ...row,
      rank: curRank,
      isTiedRank: (distCounts.get(row.displayMeters) || 0) > 1,
    };
  });

  const winners =
    finishingRound !== null
      ? ranked.filter((r) => r.finished && r.finishedOnRound === finishingRound)
      : [];
  const hasFinisher = winners.length > 0;
  const isCoWin = winners.length > 1;
  const playedCount = state.history.length;

  let statusHeadline = 'Đang đua';
  if (state.endedEarly) {
    statusHeadline = `Kết thúc sớm (đã chơi ${playedCount}/${state.deck.length} câu)`;
  } else if (hasFinisher) {
    if (state.config.mode === 'solo') {
      statusHeadline = `Về đích thành công tại lượt ${finishingRound}!`;
    } else if (state.config.mode === 'class_coop') {
      statusHeadline = `Cả lớp đã đưa thuyền về đích tại lượt ${finishingRound}!`;
    } else if (isCoWin) {
      statusHeadline = `Đồng thắng tại lượt ${finishingRound}: ${winners.map((w) => w.name).join(' & ')}`;
    } else {
      statusHeadline = `${winners[0].name} về đích đầu tiên tại lượt ${finishingRound}!`;
    }
  } else if (state.phase === 'summary' || playedCount >= state.deck.length) {
    statusHeadline = 'Chưa có đội về đích';
  }

  return {
    standings: ranked,
    winners,
    hasFinisher,
    isCoWin,
    finishingRound,
    playedCount,
    statusHeadline,
  };
}

// ============================================================================
// RACE LIFECYCLE & STATE TRANSITIONS
// ============================================================================

function makeEmptyMarks(teams: BoatTeamConfig[]): Record<string, BoatTeamMark> {
  const m: Record<string, BoatTeamMark> = {};
  for (const t of teams) m[t.teamId] = 'unmarked';
  return m;
}

function makeEmptyOptionIds(teams: BoatTeamConfig[]): Record<string, string | null> {
  const m: Record<string, string | null> = {};
  for (const t of teams) m[t.teamId] = null;
  return m;
}

function makeTurnToken(raceId: string, qIndex: number, qId: string): string {
  return `${raceId}:q${qIndex}:${qId}`;
}

export function createDefaultBoatRaceConfig(overrides?: Partial<BoatRaceConfig>): BoatRaceConfig {
  const mode = overrides?.mode ?? 'teams';
  const teams =
    overrides?.teams && overrides.teams.length > 0
      ? overrides.teams.map((t, idx) => ({
          ...t,
          laneIndex: idx,
          name: (t.name || `Đội ${idx + 1}`).trim() || `Đội ${idx + 1}`,
        }))
      : buildDefaultBoatTeams(mode, 4);

  return {
    mode,
    questionSource: overrides?.questionSource ?? 'sample_math',
    requestedQuestionCount: overrides?.requestedQuestionCount ?? 10,
    targetMeters: overrides?.targetMeters ?? 800,
    timerSeconds: overrides?.timerSeconds ?? 30,
    teams,
  };
}

export function createBoatRaceSetupState(overrides?: Partial<BoatRaceConfig>): BoatRaceState {
  const config = createDefaultBoatRaceConfig(overrides);
  return {
    raceId: `d02_${Date.now()}`,
    config,
    rulesLocked: false,
    phase: 'setup',
    deck: [],
    reserveDeck: [],
    currentQuestionIndex: 0,
    turnToken: '',
    mediaReady: true,
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    timedOutCurrentRound: false,
    draftMarks: makeEmptyMarks(config.teams),
    draftOptionIds: makeEmptyOptionIds(config.teams),
    soloLockedOptionId: null,
    lastConfirmedTurnToken: null,
    editingLastConfirmed: false,
    endedEarly: false,
    readyToFinishSummary: false,
    history: [],
    statusMessage: null,
  };
}

/**
 * Validates setup, locks rules, deduplicates questions, shuffles options ONCE, and starts the race.
 */
export function startBoatRace(
  configInput: Partial<BoatRaceConfig>,
  questionPool: BoatQuestionItem[],
  raceIdOverride?: string
): { state: BoatRaceState; error: string | null } {
  const config = createDefaultBoatRaceConfig(configInput);

  // Deduplicate & validate pool
  const validPool: BoatQuestionItem[] = [];
  const seen = new Set<string>();
  for (const q of questionPool) {
    if (seen.has(q.questionId)) continue;
    if (!validateBoatQuestion(q).valid) continue;
    seen.add(q.questionId);
    validPool.push(q);
  }

  const check = validateBoatRaceSetup(
    config.requestedQuestionCount,
    config.targetMeters,
    validPool.length
  );
  if (!check.valid) {
    return {
      state: createBoatRaceSetupState(config),
      error: check.error,
    };
  }

  const raceId = raceIdOverride || `d02_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const deck = validPool
    .slice(0, config.requestedQuestionCount)
    .map((q) => shuffleBoatOptionsOnce(q, raceId));
  const reserveDeck = validPool
    .slice(config.requestedQuestionCount)
    .map((q) => shuffleBoatOptionsOnce(q, `${raceId}_res`));

  const firstToken = makeTurnToken(raceId, 0, deck[0].questionId);

  return {
    error: null,
    state: {
      raceId,
      config,
      rulesLocked: true,
      phase: 'ready',
      deck,
      reserveDeck,
      currentQuestionIndex: 0,
      turnToken: firstToken,
      mediaReady: true,
      deadlineMs: null,
      pausedRemainingMs: null,
      isPaused: false,
      timedOutCurrentRound: false,
      draftMarks: makeEmptyMarks(config.teams),
      draftOptionIds: makeEmptyOptionIds(config.teams),
      soloLockedOptionId: null,
      lastConfirmedTurnToken: null,
      editingLastConfirmed: false,
      endedEarly: false,
      readyToFinishSummary: false,
      history: [],
      statusMessage: `Đường đua ${config.targetMeters} m (cần ${check.neededCorrect} câu đúng). Bấm “Mở câu hỏi” để xuất phát lượt 1.`,
    },
  };
}

export function getCurrentBoatQuestion(state: BoatRaceState): BoatQuestionItem | null {
  return state.deck[state.currentQuestionIndex] || null;
}

/**
 * Opens current question. Starts deadline clock ONLY if `mediaReady === true` (or starts once media finishes loading).
 */
export function openBoatQuestion(
  state: BoatRaceState,
  nowMs: number = Date.now(),
  mediaReady: boolean = true
): BoatRaceState {
  if (state.phase !== 'ready') return state;
  const q = getCurrentBoatQuestion(state);
  if (!q) return state;

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
    timedOutCurrentRound: false,
    draftMarks: makeEmptyMarks(state.config.teams),
    draftOptionIds: makeEmptyOptionIds(state.config.teams),
    soloLockedOptionId: null,
    statusMessage: mediaReady
      ? state.config.mode === 'solo'
        ? 'Chọn đáp án rồi bấm “Chốt đáp án” trước khi hết giờ.'
        : 'Các đội suy nghĩ và viết đáp án vào bảng con.'
      : 'Đang chờ hình ảnh câu hỏi sẵn sàng trước khi bắt đầu tính giờ...',
  };
}

export function markBoatMediaReady(
  state: BoatRaceState,
  nowMs: number = Date.now()
): BoatRaceState {
  if (state.phase !== 'answering' || state.mediaReady) return state;
  return {
    ...state,
    mediaReady: true,
    deadlineMs:
      state.config.timerSeconds > 0 ? nowMs + state.config.timerSeconds * 1000 : null,
    statusMessage: 'Tài nguyên đã sẵn sàng — bắt đầu tính giờ trả lời!',
  };
}

/**
 * Replaces a current faulty question (e.g. broken image) from reserveDeck without repeating any question.
 */
export function replaceFaultyBoatQuestion(
  state: BoatRaceState
): { state: BoatRaceState; replaced: boolean } {
  if (
    state.phase === 'setup' ||
    state.phase === 'summary' ||
    state.reserveDeck.length === 0
  ) {
    return { state, replaced: false };
  }
  const nextReserve = [...state.reserveDeck];
  const replacement = nextReserve.shift()!;
  const nextDeck = [...state.deck];
  nextDeck[state.currentQuestionIndex] = replacement;
  const nextToken = makeTurnToken(
    state.raceId,
    state.currentQuestionIndex,
    replacement.questionId
  );

  return {
    replaced: true,
    state: {
      ...state,
      phase: 'ready',
      deck: nextDeck,
      reserveDeck: nextReserve,
      turnToken: nextToken,
      deadlineMs: null,
      pausedRemainingMs: null,
      isPaused: false,
      timedOutCurrentRound: false,
      draftMarks: makeEmptyMarks(state.config.teams),
      draftOptionIds: makeEmptyOptionIds(state.config.teams),
      soloLockedOptionId: null,
      statusMessage: 'Đã đổi sang câu dự phòng mới không trùng lặp. Bấm “Mở câu hỏi” để tiếp tục.',
    },
  };
}

// ============================================================================
// SINGLE DEADLINE CLOCK & PAUSE/RESUME
// ============================================================================

export function getBoatRemainingTimeMs(
  state: BoatRaceState,
  nowMs: number = Date.now()
): number {
  if (state.isPaused) return Math.max(0, state.pausedRemainingMs ?? 0);
  if (state.deadlineMs === null) return 0;
  return Math.max(0, state.deadlineMs - nowMs);
}

export function pauseBoatRace(state: BoatRaceState, nowMs: number = Date.now()): BoatRaceState {
  if (
    state.isPaused ||
    state.phase === 'setup' ||
    state.phase === 'summary' ||
    state.phase === 'ready'
  ) {
    return state;
  }
  const rem = state.deadlineMs !== null ? Math.max(0, state.deadlineMs - nowMs) : null;
  return {
    ...state,
    isPaused: true,
    pausedRemainingMs: rem,
    deadlineMs: null,
    statusMessage: 'Cuộc đua đang tạm dừng — đã giữ nguyên thời gian và khóa chốt đáp án.',
  };
}

export function resumeBoatRace(state: BoatRaceState, nowMs: number = Date.now()): BoatRaceState {
  if (!state.isPaused) return state;
  const nextDeadline =
    state.pausedRemainingMs !== null ? nowMs + Math.max(0, state.pausedRemainingMs) : null;
  return {
    ...state,
    isPaused: false,
    deadlineMs: nextDeadline,
    pausedRemainingMs: null,
    statusMessage: 'Đã tiếp tục cuộc đua.',
  };
}

export function checkBoatDeadline(
  state: BoatRaceState,
  nowMs: number = Date.now()
): { state: BoatRaceState; expired: boolean } {
  if (
    state.isPaused ||
    state.phase !== 'answering' ||
    !state.mediaReady ||
    state.deadlineMs === null
  ) {
    return { state, expired: false };
  }
  if (nowMs < state.deadlineMs) return { state, expired: false };

  // In Solo mode with MC/TF: expiring before clicking "Chốt" records `no_answer` (not allowed to submit after deadline!)
  const q = getCurrentBoatQuestion(state);
  if (state.config.mode === 'solo' && q && q.options.length > 0) {
    const soloId = state.config.teams[0].teamId;
    return {
      expired: true,
      state: {
        ...state,
        phase: 'revealed',
        deadlineMs: null,
        timedOutCurrentRound: true,
        draftMarks: { ...state.draftMarks, [soloId]: 'no_answer' },
        draftOptionIds: { ...state.draftOptionIds, [soloId]: null },
        statusMessage: 'Hết giờ trước khi chốt đáp án! Thuyền giữ nguyên vị trí. Bấm Xác nhận lượt.',
      },
    };
  }

  // Team / Class Coop / Oral mode: transitions to `stopped` — NEVER auto-marks mini-board answers wrong!
  return {
    expired: true,
    state: {
      ...state,
      phase: 'stopped',
      deadlineMs: null,
      timedOutCurrentRound: true,
      statusMessage:
        'Hết giờ — Dừng trả lời! Giáo viên ghi nhận đáp án các đội đã viết trên bảng con trước hạn (không tự chấm sai).',
    },
  };
}

// ============================================================================
// ANSWERING, SOLO LOCK, TEAM GRADING, REVEAL & ATOMIC CONFIRM
// ============================================================================

export function stopBoatAnswering(
  state: BoatRaceState,
  nowMs: number = Date.now()
): { state: BoatRaceState; stoppedNow: boolean } {
  if (state.isPaused) return { state, stoppedNow: false };
  if (state.phase === 'stopped') return { state, stoppedNow: false };
  if (state.phase !== 'answering') return { state, stoppedNow: false };

  const timedOut = state.deadlineMs !== null && nowMs >= state.deadlineMs;
  return {
    stoppedNow: true,
    state: {
      ...state,
      phase: 'stopped',
      deadlineMs: null,
      timedOutCurrentRound: timedOut,
      statusMessage: 'Đã dừng trả lời. Giáo viên chấm kết quả cho từng đội rồi bấm Công bố đáp án.',
    },
  };
}

/**
 * Solo Mode: Select option & click "Chốt" strictly BEFORE deadline (if timer enabled).
 */
export function submitSoloLockedOption(
  state: BoatRaceState,
  optionId: string,
  nowMs: number = Date.now()
): { state: BoatRaceState; accepted: boolean; reason?: string } {
  if (state.isPaused) {
    return { state, accepted: false, reason: 'Đang tạm dừng — không thể chốt đáp án.' };
  }
  if (state.config.mode !== 'solo' || state.phase !== 'answering') {
    return { state, accepted: false, reason: 'Không ở trạng thái trả lời tự luyện.' };
  }
  if (state.deadlineMs !== null && nowMs >= state.deadlineMs) {
    const expired = checkBoatDeadline(state, nowMs);
    return {
      state: expired.state,
      accepted: false,
      reason: 'Đã hết giờ trước khi chốt đáp án.',
    };
  }
  const q = getCurrentBoatQuestion(state);
  if (!q || !q.options.some((o) => o.optionId === optionId)) {
    return { state, accepted: false, reason: 'Phương án không hợp lệ.' };
  }
  const soloId = state.config.teams[0].teamId;
  const mark: BoatTeamMark = q.correctOptionId === optionId ? 'correct' : 'wrong';

  return {
    accepted: true,
    state: {
      ...state,
      phase: 'revealed',
      deadlineMs: null,
      soloLockedOptionId: optionId,
      draftMarks: { ...state.draftMarks, [soloId]: mark },
      draftOptionIds: { ...state.draftOptionIds, [soloId]: optionId },
      statusMessage:
        mark === 'correct'
          ? 'Đã chốt đáp án ĐÚNG (+100 m)! Xem giải thích rồi bấm Xác nhận cập nhật thuyền.'
          : 'Đã chốt đáp án chưa đúng (+0 m). Xem lời giải rồi bấm Xác nhận lượt.',
    },
  };
}

export function setBoatTeamMark(
  state: BoatRaceState,
  teamId: string,
  mark: BoatTeamMark,
  selectedOptionId: string | null = null
): BoatRaceState {
  if (state.isPaused) return state;
  const editable =
    state.phase === 'stopped' ||
    state.phase === 'revealed' ||
    (state.phase === 'round_confirmed' && state.editingLastConfirmed);
  if (!editable) return state;

  return {
    ...state,
    draftMarks: {
      ...state.draftMarks,
      [teamId]: mark,
    },
    draftOptionIds: {
      ...state.draftOptionIds,
      [teamId]: selectedOptionId,
    },
  };
}

export function setBoatTeamOption(
  state: BoatRaceState,
  teamId: string,
  optionId: string
): BoatRaceState {
  const q = getCurrentBoatQuestion(state);
  if (!q) return state;
  const mark: BoatTeamMark =
    q.correctOptionId && q.correctOptionId === optionId ? 'correct' : 'wrong';
  return setBoatTeamMark(state, teamId, mark, optionId);
}

export function areAllBoatTeamsMarked(state: BoatRaceState): boolean {
  return state.config.teams.every((t) => state.draftMarks[t.teamId] !== 'unmarked');
}

export function revealBoatAnswerAndPreview(state: BoatRaceState): {
  state: BoatRaceState;
  revealed: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, revealed: false, reason: 'Cuộc đua đang tạm dừng.' };
  }
  if (state.phase !== 'stopped') {
    return { state, revealed: false, reason: 'Chưa ở bước dừng trả lời.' };
  }
  if (!areAllBoatTeamsMarked(state)) {
    return {
      state,
      revealed: false,
      reason: 'Vui lòng chấm đủ tất cả các đội trước khi công bố (Chưa chấm không bị tính sai).',
    };
  }
  return {
    revealed: true,
    state: {
      ...state,
      phase: 'revealed',
      statusMessage: 'Đã công bố đáp án chuẩn và bản xem trước quãng đường. Bấm Xác nhận cập nhật thuyền.',
    },
  };
}

/**
 * Atomic round commit (anti-double-click + turnToken locked):
 * - Updates ALL boats simultaneously from the same round record.
 * - Also saves edits when `editingLastConfirmed === true`, recomputing distances AND finish condition
 *   cleanly from history (including canceling a just-triggered finish!).
 */
export function confirmBoatRoundResult(
  state: BoatRaceState,
  turnToken: string = state.turnToken
): {
  state: BoatRaceState;
  confirmed: boolean;
  anyAdvanced: boolean;
  reachedFinishNow: boolean;
  reason?: string;
} {
  if (state.isPaused) {
    return { state, confirmed: false, anyAdvanced: false, reachedFinishNow: false, reason: 'Đang tạm dừng.' };
  }
  const isEditing = state.phase === 'round_confirmed' && state.editingLastConfirmed;
  if (state.phase !== 'revealed' && !isEditing) {
    return {
      state,
      confirmed: false,
      anyAdvanced: false,
      reachedFinishNow: false,
      reason: 'Chưa ở bước xác nhận lượt.',
    };
  }
  if (turnToken !== state.turnToken) {
    return {
      state,
      confirmed: false,
      anyAdvanced: false,
      reachedFinishNow: false,
      reason: 'Token lượt không khớp (lượt cũ).',
    };
  }
  if (!isEditing && state.lastConfirmedTurnToken === state.turnToken) {
    return {
      state,
      confirmed: false,
      anyAdvanced: false,
      reachedFinishNow: false,
      reason: 'Lượt này đã được xác nhận.',
    };
  }
  if (!areAllBoatTeamsMarked(state)) {
    return {
      state,
      confirmed: false,
      anyAdvanced: false,
      reachedFinishNow: false,
      reason: 'Còn đội chưa chấm điểm.',
    };
  }

  const q = getCurrentBoatQuestion(state);
  if (!q) {
    return { state, confirmed: false, anyAdvanced: false, reachedFinishNow: false };
  }

  const outcomes: Record<string, BoatTeamRoundOutcome> = {};
  let anyAdvanced = false;
  for (const t of state.config.teams) {
    const mark = state.draftMarks[t.teamId];
    const gained = mark === 'correct' ? D02_STEP_METERS : 0;
    if (gained > 0) anyAdvanced = true;
    outcomes[t.teamId] = {
      teamId: t.teamId,
      mark,
      selectedOptionId: state.draftOptionIds[t.teamId] ?? null,
      metersGained: gained,
    };
  }

  let nextHistory: BoatRoundRecord[];
  if (isEditing) {
    nextHistory = [...state.history];
    for (let i = nextHistory.length - 1; i >= 0; i--) {
      if (nextHistory[i].turnToken === state.turnToken) {
        nextHistory[i] = {
          ...nextHistory[i],
          outcomes,
          editCount: nextHistory[i].editCount + 1,
          confirmedAt: Date.now(),
        };
        break;
      }
    }
  } else {
    const record: BoatRoundRecord = {
      roundNumber: state.currentQuestionIndex + 1,
      turnToken: state.turnToken,
      questionId: q.questionId,
      topic: q.topic,
      stemLatex: q.stemLatex,
      answerLatex: q.answerLatex,
      explanationLatex: q.explanationLatex,
      resultSource:
        state.config.mode === 'solo' && state.soloLockedOptionId !== null
          ? 'solo_player'
          : 'teacher_input',
      outcomes,
      editCount: 0,
      confirmedAt: Date.now(),
    };
    nextHistory = [...state.history, record];
  }

  const tentativeState: BoatRaceState = {
    ...state,
    phase: 'round_confirmed',
    lastConfirmedTurnToken: state.turnToken,
    editingLastConfirmed: false,
    history: nextHistory,
  };

  // Recompute standings from history to check if ANY boat hit targetMeters OR deck is exhausted
  const report = computeBoatRaceStandings(tentativeState);
  const deckExhausted = state.currentQuestionIndex + 1 >= state.deck.length;
  const readyToFinishSummary = report.hasFinisher || deckExhausted;

  let msg = '';
  if (report.hasFinisher) {
    msg = report.isCoWin
      ? `${report.statusHeadline} (Giáo viên vẫn có thể sửa câu vừa rồi trước khi chốt tổng kết.)`
      : `${report.statusHeadline} (Giáo viên có thể thảo luận hoặc sửa câu vừa rồi trước khi chốt tổng kết.)`;
  } else if (deckExhausted) {
    msg = 'Đã hoàn thành câu cuối cùng (Chưa có đội về đích). Bấm “Chốt tổng kết” hoặc sửa kết quả câu vừa rồi.';
  } else {
    msg = isEditing
      ? 'Đã cập nhật lại kết quả câu vừa chấm và tính lại vị trí tất cả thuyền.'
      : anyAdvanced
        ? `Đã cập nhật vị trí thuyền (+${D02_STEP_METERS} m cho đội trả lời đúng). Bấm “Câu tiếp theo” khi sẵn sàng.`
        : 'Đã xác nhận lượt (các thuyền giữ nguyên vị trí).';
  }

  return {
    confirmed: true,
    anyAdvanced,
    reachedFinishNow: report.hasFinisher,
    state: {
      ...tentativeState,
      readyToFinishSummary,
      statusMessage: msg,
    },
  };
}

/**
 * Allows teacher to edit the just-confirmed round BEFORE opening next question or locking final summary!
 * Recomputes all distances & can reverse a just-triggered finish!
 */
export function startEditingLastBoatRound(state: BoatRaceState): BoatRaceState {
  if (state.isPaused || state.phase !== 'round_confirmed' || state.editingLastConfirmed) {
    return state;
  }
  const last = [...state.history].reverse().find((r) => r.turnToken === state.turnToken);
  if (!last) return state;

  const marks = makeEmptyMarks(state.config.teams);
  const opts = makeEmptyOptionIds(state.config.teams);
  for (const t of state.config.teams) {
    marks[t.teamId] = last.outcomes[t.teamId]?.mark ?? 'unmarked';
    opts[t.teamId] = last.outcomes[t.teamId]?.selectedOptionId ?? null;
  }

  return {
    ...state,
    editingLastConfirmed: true,
    draftMarks: marks,
    draftOptionIds: opts,
    statusMessage: 'Đang sửa kết quả câu vừa xác nhận — vị trí thuyền và điều kiện về đích sẽ tự tính lại.',
  };
}

/**
 * Advances after confirmed round:
 * - If a boat reached targetMeters OR deck is exhausted -> locks into `summary`.
 * - Else -> advances to next question in `ready`.
 */
export function advanceBoatAfterConfirm(state: BoatRaceState): BoatRaceState {
  if (state.isPaused || state.phase !== 'round_confirmed' || state.editingLastConfirmed) {
    return state;
  }

  const report = computeBoatRaceStandings(state);
  const nextIndex = state.currentQuestionIndex + 1;
  if (report.hasFinisher || nextIndex >= state.deck.length) {
    return {
      ...state,
      phase: 'summary',
      deadlineMs: null,
      endedEarly: false,
      statusMessage: report.statusHeadline,
    };
  }

  const nextQ = state.deck[nextIndex];
  return {
    ...state,
    phase: 'ready',
    currentQuestionIndex: nextIndex,
    turnToken: makeTurnToken(state.raceId, nextIndex, nextQ.questionId),
    mediaReady: true,
    deadlineMs: null,
    pausedRemainingMs: null,
    timedOutCurrentRound: false,
    draftMarks: makeEmptyMarks(state.config.teams),
    draftOptionIds: makeEmptyOptionIds(state.config.teams),
    soloLockedOptionId: null,
    readyToFinishSummary: false,
    statusMessage: `Sẵn sàng Câu ${nextIndex + 1}/${state.deck.length}.`,
  };
}

export function endBoatRaceEarly(state: BoatRaceState): BoatRaceState {
  if (state.phase === 'setup' || state.phase === 'summary') return state;
  return {
    ...state,
    phase: 'summary',
    deadlineMs: null,
    pausedRemainingMs: null,
    isPaused: false,
    editingLastConfirmed: false,
    endedEarly: true,
    statusMessage: `Kết thúc sớm sau ${state.history.length} câu đã chơi.`,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE
// ============================================================================

export interface BoatPersistedSession {
  version: number;
  savedAt: number;
  state: BoatRaceState;
}

export function getD02StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D02_SESSION_STORAGE_KEY}`
    : D02_SESSION_STORAGE_KEY;
}

export function saveD02Session(state: BoatRaceState, nowMs: number = Date.now()): void {
  if (typeof window === 'undefined') return;
  try {
    const snapshot: BoatRaceState =
      state.phase === 'answering' && !state.isPaused && state.deadlineMs !== null
        ? { ...state, pausedRemainingMs: Math.max(0, state.deadlineMs - nowMs) }
        : state;
    const payload: BoatPersistedSession = {
      version: D02_SESSION_VERSION,
      savedAt: nowMs,
      state: snapshot,
    };
    window.localStorage.setItem(getD02StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage errors
  }
}

export function loadD02Session(): BoatPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getD02StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BoatPersistedSession>;
    if (
      !parsed ||
      parsed.version !== D02_SESSION_VERSION ||
      !parsed.state ||
      !parsed.state.config ||
      !Array.isArray(parsed.state.deck) ||
      !Array.isArray(parsed.state.history)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    const s = parsed.state;
    const shouldPause =
      s.phase === 'answering' && (s.deadlineMs !== null || s.pausedRemainingMs !== null);
    const rem = shouldPause
      ? Math.max(0, s.pausedRemainingMs ?? (s.deadlineMs ? Math.max(0, s.deadlineMs - Date.now()) : 0))
      : s.pausedRemainingMs;

    const restored: BoatRaceState = {
      ...s,
      editingLastConfirmed: false,
      isPaused: shouldPause ? true : Boolean(s.isPaused),
      deadlineMs: shouldPause ? null : s.deadlineMs,
      pausedRemainingMs: rem,
    };

    return {
      version: D02_SESSION_VERSION,
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

export function clearD02Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD02StorageKey());
  } catch {
    // Ignore
  }
}
