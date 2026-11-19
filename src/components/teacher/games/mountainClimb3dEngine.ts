import { Question } from '../../../types';
import { StudentCandidate } from '../studentCallRules';

// ============================================================================
// C08: ĐƯỜNG LÊN ĐỈNH NÚI 3D ("CHINH PHỤC ĐỈNH TRI THỨC")
// Deterministic Scoring, Mountain Spline Geometry, Question Engine & Session Storage
// ============================================================================

export type C08PlayMode = 'JOURNEY' | 'CONQUEST';
export type C08OrgMode = 'CLASS' | 'INDIVIDUAL' | 'TEAMS';
export type C08QuestionCountOption = 5 | 10 | 12 | 15 | 'ALL';
export type C08TimeLimitSec = 0 | 30 | 45 | 60 | 90;
export type C08DatasetKey = 'SAMPLE_MATH' | 'SAMPLE_INFORMATICS' | 'QUESTION_BANK';
export type C08QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER';
export type C08QualityPreset = 'HIGH' | 'MEDIUM' | 'LOW';
export type C08CameraPreset = 'FOLLOW' | 'OVERVIEW' | 'SUMMIT';

export type C08StagePhase =
  | 'SETUP'
  | 'READY'
  | 'ANSWERING'
  | 'REVEALED'
  | 'GRADING'
  | 'CONFIRMED'
  | 'MOVING'
  | 'STAGE_SUMMARY'
  | 'FINISHED';

export type C08MarkStatus = 'UNGRADED' | 'CORRECT' | 'WRONG' | 'NO_ANSWER';

export interface C08OptionItem {
  optionId: string;
  text: string;
}

export interface C08DisplayOption extends C08OptionItem {
  displayLabel: 'A' | 'B' | 'C' | 'D';
}

export interface C08QuestionItem {
  questionId: string;
  questionType: C08QuestionType;
  stem: string;
  options?: C08OptionItem[];
  correctOptionId?: string;
  correctAnswerText: string;
  explanation: string;
  hint?: string;
  topic?: string;
  difficultyLabel?: string;
  imageUrl?: string;
  allowShuffle: boolean;
  isSample?: boolean;
}

export interface C08Participant {
  participantId: string;
  stt: number;
  name: string;
  code: string;
  colorHex: string;
  isTeam?: boolean;
  isTemporaryLabel?: boolean;
  isSampleStudent?: boolean;
}

export interface C08QuestionRecord {
  questionIndex: number; // 0-based
  questionNumber: number; // 1-based
  questionId: string;
  stageNumber: number; // 1, 2, 3
  hintUsed: boolean;
  maxPointsForQuestion: number;
  marks: Record<string, C08MarkStatus>; // participantId -> CORRECT | WRONG | NO_ANSWER
  selectedOptionId?: string; // Used in CLASS mode
  directSubmittedText?: string; // Used in CLASS short-answer if typed
  confirmedAt: number;
  editCount: number;
}

export interface C08ComputedEntityState {
  participant: C08Participant;
  score: number;
  progress: number; // Clamped [0, 1] strictly by mode & rules
  correctCount: number;
  wrongCount: number;
  noAnswerCount: number;
  answeredCount: number;
  reachedSummit: boolean;
  rank: number; // 1-based competition rank (equal score = equal rank)
}

export interface C08StageInfo {
  stageNumber: 1 | 2 | 3;
  stageName: string;
  startIndex: number; // inclusive
  endIndex: number; // inclusive
}

export interface C08SessionConfig {
  playMode: C08PlayMode;
  orgMode: C08OrgMode;
  datasetKey: C08DatasetKey;
  questionCount: C08QuestionCountOption;
  pointsPerQuestion: number;
  summitThreshold: number;
  timeLimitSec: C08TimeLimitSec;
  hintsEnabled: boolean;
  showJourneyScoreboard: boolean;
  qualityPreset: C08QualityPreset;
  reducedMotion: boolean;
  cameraMotionEnabled: boolean;
  voiceEnabled: boolean;
}

export interface C08PersistedSession {
  version: number;
  savedAt: number;
  sessionId: string;
  config: C08SessionConfig;
  participants: C08Participant[];
  questionPool: C08QuestionItem[];
  optionOrdersByQuestionId: Record<string, string[]>;
  currentQuestionIndex: number;
  stagePhase: C08StagePhase;
  records: C08QuestionRecord[];
  currentHintUsed: boolean;
  currentSelectedOptionId: string | null;
  draftMarks: Record<string, C08MarkStatus>;
  isPaused: boolean;
  pausedRemainingMs: number | null;
}

export const C08_STORAGE_KEY = 'taydo_smart_edu_c08_active_session_v1';
export const C08_STORAGE_VERSION = 1;
const C08_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const C08_TEAM_COLORS = [
  '#06B6D4', // Cyan
  '#F59E0B', // Gold
  '#10B981', // Emerald
  '#3B82F6', // Royal Blue
  '#F97316', // Coral Amber
  '#8B5CF6', // Violet
];

export const C08_PLAYER_PALETTE = [
  '#06B6D4',
  '#F59E0B',
  '#10B981',
  '#38BDF8',
  '#F97316',
  '#A855F7',
  '#EC4899',
  '#14B8A6',
];

// ============================================================================
// 1. MOUNTAIN 3D PATH GEOMETRY (MATHEMATICAL SPIRAL TRAIL ON MOUNTAIN SURFACE)
// ============================================================================

export interface MountainPoint3D {
  x: number;
  y: number;
  z: number;
  tangentX: number;
  tangentY: number;
  tangentZ: number;
}

export const MOUNTAIN_HEIGHT = 13.8;
export const MOUNTAIN_BASE_RADIUS = 9.4;
export const MOUNTAIN_TOP_RADIUS = 1.35;

/**
 * Computes exact mountain cone radius at normalized altitude t in [0, 1].
 * Matches the 3D terrain mesh profile so trail & props never float or sink.
 */
export function getMountainSlopeRadiusAtT(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  // Concave alpine profile: wider verdant foothill tapering to crisp summit plaza
  const shaped = Math.pow(1 - clamped, 0.84);
  return MOUNTAIN_TOP_RADIUS + (MOUNTAIN_BASE_RADIUS - MOUNTAIN_TOP_RADIUS) * shaped;
}

/**
 * Evaluates a point along the winding mountain trail for progress u in [0, 1].
 * Loops ~1.45 turns smoothly around the mountain face toward the front-facing summit.
 */
export function getMountainTrailPoint(u: number): MountainPoint3D {
  const clamped = Math.max(0, Math.min(1, u));
  // Start in front-left base, spiral nicely so camera clearly sees progression
  const startAngle = Math.PI * 0.72;
  const totalTurns = Math.PI * 2.55;
  const theta = startAngle + clamped * totalTurns;

  const y = 0.25 + clamped * (MOUNTAIN_HEIGHT - 0.35);
  // Sit slightly outside the rocky slope surface (+0.34m deck thickness)
  const r = getMountainSlopeRadiusAtT(clamped) + 0.34;

  const x = Math.cos(theta) * r;
  const z = Math.sin(theta) * r;

  // Finite difference for smooth tangent vector
  const eps = 0.004;
  const uNext = Math.min(1, clamped + eps);
  const uPrev = Math.max(0, clamped - eps);
  const tNext = startAngle + uNext * totalTurns;
  const tPrev = startAngle + uPrev * totalTurns;
  const rNext = getMountainSlopeRadiusAtT(uNext) + 0.34;
  const rPrev = getMountainSlopeRadiusAtT(uPrev) + 0.34;
  const dx = Math.cos(tNext) * rNext - Math.cos(tPrev) * rPrev;
  const dy = (uNext - uPrev) * (MOUNTAIN_HEIGHT - 0.35);
  const dz = Math.sin(tNext) * rNext - Math.sin(tPrev) * rPrev;
  const len = Math.hypot(dx, dy, dz) || 1;

  return {
    x,
    y,
    z,
    tangentX: dx / len,
    tangentY: dy / len,
    tangentZ: dz / len,
  };
}

/**
 * Computes lateral position for summit plaza or multi-climber spread without overlapping.
 */
export function getClimberWorldPosition(
  progress: number,
  slotIndex: number,
  slotTotal: number
): { x: number; y: number; z: number; yaw: number } {
  const clamped = Math.max(0, Math.min(1, progress));

  // If climber has reached the summit plaza (progress >= 0.999), arrange on spacious summit ring
  if (clamped >= 0.999) {
    const ringRadius = slotTotal <= 1 ? 0 : Math.min(1.05, 0.42 + slotTotal * 0.11);
    const angle = slotTotal <= 1 ? 0 : (slotIndex / Math.max(1, slotTotal)) * Math.PI * 2 + 0.4;
    return {
      x: Math.cos(angle) * ringRadius,
      y: MOUNTAIN_HEIGHT + 0.16,
      z: Math.sin(angle) * ringRadius,
      yaw: Math.atan2(-Math.cos(angle), -Math.sin(angle)) + Math.PI,
    };
  }

  const pt = getMountainTrailPoint(clamped);
  // Perpendicular horizontal offset across path deck width
  const horizLen = Math.hypot(pt.tangentX, pt.tangentZ) || 1;
  const perpX = -pt.tangentZ / horizLen;
  const perpZ = pt.tangentX / horizLen;

  const spreadStep = slotTotal <= 1 ? 0 : 0.36;
  const centeredOffset = (slotIndex - (slotTotal - 1) / 2) * spreadStep;

  return {
    x: pt.x + perpX * centeredOffset,
    y: pt.y + 0.08,
    z: pt.z + perpZ * centeredOffset,
    yaw: Math.atan2(pt.tangentX, pt.tangentZ),
  };
}

// ============================================================================
// 2. STAGE SPLITTING, PROGRESS FORMULA & DETERMINISTIC LEDGER
// ============================================================================

export function buildStagesForTotalQuestions(totalQuestions: number): C08StageInfo[] {
  const n = Math.max(1, totalQuestions);
  if (n <= 3) {
    return [
      { stageNumber: 1, stageName: 'Chặng 1 · Khởi động chân núi', startIndex: 0, endIndex: n - 1 },
    ];
  }
  const c1 = Math.ceil(n / 3);
  const c2 = Math.ceil((n - c1) / 2);
  return [
    {
      stageNumber: 1,
      stageName: 'Chặng 1 · Khởi động chân núi',
      startIndex: 0,
      endIndex: c1 - 1,
    },
    {
      stageNumber: 2,
      stageName: 'Chặng 2 · Vượt dốc sườn đá',
      startIndex: c1,
      endIndex: c1 + c2 - 1,
    },
    {
      stageNumber: 3,
      stageName: 'Chặng 3 · Bứt phá đỉnh mây',
      startIndex: c1 + c2,
      endIndex: n - 1,
    },
  ];
}

export function getStageForQuestionIndex(
  questionIndex: number,
  stages: C08StageInfo[]
): C08StageInfo {
  for (const s of stages) {
    if (questionIndex >= s.startIndex && questionIndex <= s.endIndex) {
      return s;
    }
  }
  return stages[stages.length - 1] || {
    stageNumber: 1,
    stageName: 'Chặng 1 · Khởi động chân núi',
    startIndex: 0,
    endIndex: 0,
  };
}

/**
 * Hint point rule (Section 10):
 * - Using a hint that exists halves the points for that question (e.g. 10 -> 5).
 * - If a question has no hint, points stay full.
 */
export function getQuestionMaxPoints(
  pointsPerQuestion: number,
  hintUsed: boolean,
  hasHintText: boolean
): number {
  const base = Math.max(1, Math.round(pointsPerQuestion));
  if (hintUsed && hasHintText) {
    return Math.max(1, Math.floor(base / 2));
  }
  return base;
}

/**
 * Pure deterministic ledger computation (Section 5, 6, 11, 12).
 * Recomputes every score, progress, summit status, and rank directly from confirmed records.
 * Never double-counts on edit or restore.
 */
export function computeC08EntityStates(params: {
  participants: C08Participant[];
  records: C08QuestionRecord[];
  totalQuestions: number;
  playMode: C08PlayMode;
  summitThreshold: number;
}): C08ComputedEntityState[] {
  const { participants, records, totalQuestions, playMode, summitThreshold } = params;
  const safeTotal = Math.max(1, totalQuestions);
  const safeThreshold = Math.max(1, summitThreshold);
  const completedQuestions = records.length;

  const rawList = participants.map((participant) => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let noAnswerCount = 0;

    for (const rec of records) {
      const mark = rec.marks[participant.participantId];
      if (mark === 'CORRECT') {
        score += rec.maxPointsForQuestion;
        correctCount++;
      } else if (mark === 'WRONG') {
        wrongCount++;
      } else if (mark === 'NO_ANSWER') {
        noAnswerCount++;
      }
    }

    const progress =
      playMode === 'JOURNEY'
        ? Math.min(completedQuestions / safeTotal, 1)
        : Math.min(score / safeThreshold, 1);

    const reachedSummit =
      playMode === 'JOURNEY'
        ? completedQuestions >= safeTotal
        : score >= safeThreshold;

    return {
      participant,
      score,
      progress,
      correctCount,
      wrongCount,
      noAnswerCount,
      answeredCount: correctCount + wrongCount + noAnswerCount,
      reachedSummit,
      rank: 1,
    };
  });

  // Compute competition ranking (equal score = equal rank, no speed tiebreaker)
  const sortedScores = [...rawList].sort((a, b) => b.score - a.score);
  let currentRank = 1;
  for (let i = 0; i < sortedScores.length; i++) {
    if (i > 0 && sortedScores[i].score < sortedScores[i - 1].score) {
      currentRank = i + 1;
    }
    const target = rawList.find(
      (item) => item.participant.participantId === sortedScores[i].participant.participantId
    );
    if (target) target.rank = currentRank;
  }

  return rawList;
}

// ============================================================================
// 3. QUESTION VALIDATION & POSITIONAL-SAFE OPTION SHUFFLING (SECTION 13)
// ============================================================================

const POSITIONAL_OPTION_PATTERNS = [
  /cả\s+a\s+và\s+b/i,
  /cả\s+a,\s*b/i,
  /cả\s+b\s+và\s+c/i,
  /cả\s+a,\s*b,\s*c/i,
  /tất\s+cả\s+các\s+đáp\s+án/i,
  /tất\s+cả\s+đều\s+đúng/i,
  /tất\s+cả\s+đều\s+sai/i,
  /cả\s+hai\s+đáp\s+án/i,
  /cả\s+3\s+đáp\s+án/i,
  /cả\s+ba\s+đáp\s+án/i,
  /đáp\s+án\s+a\s+và\s+b/i,
];

export function hasPositionalOptionDependency(options?: C08OptionItem[]): boolean {
  if (!options || options.length === 0) return false;
  return options.some((opt) =>
    POSITIONAL_OPTION_PATTERNS.some((pattern) => pattern.test(opt.text))
  );
}

export function buildDisplayOptionsForC08(
  question: C08QuestionItem,
  savedOrder?: string[]
): C08DisplayOption[] {
  if (!question.options || question.options.length === 0) return [];
  const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];

  let ordered: C08OptionItem[];
  if (savedOrder && savedOrder.length === question.options.length) {
    const byId = new Map(question.options.map((o) => [o.optionId, o]));
    const reconstructed = savedOrder
      .map((id) => byId.get(id))
      .filter((o): o is C08OptionItem => Boolean(o));
    ordered = reconstructed.length === question.options.length ? reconstructed : [...question.options];
  } else if (
    question.questionType === 'MULTIPLE_CHOICE' &&
    question.allowShuffle &&
    !hasPositionalOptionDependency(question.options)
  ) {
    ordered = [...question.options].sort(() => Math.random() - 0.5);
  } else {
    ordered = [...question.options];
  }

  return ordered.slice(0, 4).map((opt, idx) => ({
    ...opt,
    displayLabel: labels[idx] || 'A',
  }));
}

export function mapQuestionBankToC08Pool(questions: Question[]): C08QuestionItem[] {
  const seenIds = new Set<string>();
  const out: C08QuestionItem[] = [];

  for (const q of questions) {
    if (!q || !q.stem) continue;
    const stem = q.stem.trim();
    if (!stem) continue;
    const qId = q.id || `bank_c08_${out.length + 1}`;
    if (seenIds.has(qId)) continue;

    // Only include questions that are approved or valid active bank questions (respects workflow)
    if (q.status && q.status !== 'approved') continue;

    const topicLabel = q.chapter || q.lesson || q.subject || 'Ngân hàng câu hỏi';
    const difficultyLabel =
      q.level === 'know'
        ? 'Nhận biết'
        : q.level === 'understand'
        ? 'Thông hiểu'
        : q.level === 'apply'
        ? 'Vận dụng'
        : undefined;

    if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
      const optionItems: C08OptionItem[] = q.options.slice(0, 4).map((opt, idx) => ({
        optionId: `${qId}_opt_${opt.id || opt.label || idx}`,
        text: (opt.text || '').trim(),
      }));
      if (optionItems.some((o) => !o.text)) continue;

      const target = String(q.correctAnswer || '').trim().toLowerCase();
      const matchedIndices = q.options
        .slice(0, 4)
        .map((opt, idx) =>
          (opt.id || '').trim().toLowerCase() === target ||
          (opt.label || '').trim().toLowerCase() === target ||
          (opt.text || '').trim().toLowerCase() === target
            ? idx
            : -1
        )
        .filter((idx) => idx >= 0);

      // Single choice must have exactly 1 unambiguously matched correct answer
      if (matchedIndices.length !== 1) continue;
      const correctIdx = matchedIndices[0];

      seenIds.add(qId);
      out.push({
        questionId: qId,
        questionType: 'MULTIPLE_CHOICE',
        stem,
        options: optionItems,
        correctOptionId: optionItems[correctIdx].optionId,
        correctAnswerText: optionItems[correctIdx].text,
        explanation:
          (q.explanation || '').trim() ||
          `Đáp án đúng là: ${optionItems[correctIdx].text}.`,
        topic: topicLabel,
        difficultyLabel,
        imageUrl: q.image,
        allowShuffle: !hasPositionalOptionDependency(optionItems),
        isSample: false,
      });
    } else if (q.type === 'short_answer' && (q.correctAnswer || q.sampleAnswer || (q.acceptedAnswers && q.acceptedAnswers.length > 0))) {
      const ans = String(
        q.correctAnswer || (q.acceptedAnswers && q.acceptedAnswers[0]) || q.sampleAnswer || ''
      ).trim();
      if (!ans) continue;
      seenIds.add(qId);
      out.push({
        questionId: qId,
        questionType: 'SHORT_ANSWER',
        stem,
        correctAnswerText: ans,
        explanation: (q.explanation || '').trim() || `Đáp án đúng: ${ans}.`,
        topic: topicLabel,
        difficultyLabel,
        imageUrl: q.image,
        allowShuffle: false,
        isSample: false,
      });
    }
  }

  return out;
}

// ============================================================================
// 4. SAMPLE DATASETS (SECTION 18: 2 COMPLETE 12-QUESTION SETS, 3 STAGES x 4)
// ============================================================================

export const SAMPLE_MATH_C08_QUESTIONS: C08QuestionItem[] = [
  // --- Chặng 1: Khởi động chân núi (4 câu) ---
  {
    questionId: 'c08_math_01',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Hai góc bù nhau có tổng số đo bằng bao nhiêu độ?',
    options: [
      { optionId: 'cm01_a', text: '$180^\\circ$' },
      { optionId: 'cm01_b', text: '$90^\\circ$' },
      { optionId: 'cm01_c', text: '$120^\\circ$' },
      { optionId: 'cm01_d', text: '$360^\\circ$' },
    ],
    correctOptionId: 'cm01_a',
    correctAnswerText: '$180^\\circ$',
    hint: 'Hai góc kề bù tạo thành một góc bẹt trên đường thẳng.',
    explanation: 'Theo định nghĩa, hai góc bù nhau có tổng số đo bằng $180^\\circ$ (góc bẹt).',
    topic: 'Góc và đường thẳng',
    difficultyLabel: 'Nhận biết',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_02',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Hai góc đối đỉnh thì luôn có số đo bằng nhau.”',
    options: [
      { optionId: 'cm02_true', text: 'Đúng' },
      { optionId: 'cm02_false', text: 'Sai' },
    ],
    correctOptionId: 'cm02_true',
    correctAnswerText: 'Đúng',
    hint: 'Nhớ lại tính chất cơ bản của hai góc đối đỉnh khi hai đường thẳng cắt nhau.',
    explanation: 'Hai góc đối đỉnh là hai góc mà mỗi cạnh của góc này là tia đối của một cạnh của góc kia và chúng luôn bằng nhau.',
    topic: 'Góc đối đỉnh',
    difficultyLabel: 'Nhận biết',
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c08_math_03',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một hình chữ nhật có chiều dài $9\\text{ cm}$ và chiều rộng $5\\text{ cm}$. Chu vi của hình chữ nhật đó là bao nhiêu?',
    options: [
      { optionId: 'cm03_a', text: '$28\\text{ cm}$' },
      { optionId: 'cm03_b', text: '$45\\text{ cm}$' },
      { optionId: 'cm03_c', text: '$14\\text{ cm}$' },
      { optionId: 'cm03_d', text: '$24\\text{ cm}$' },
    ],
    correctOptionId: 'cm03_a',
    correctAnswerText: '$28\\text{ cm}$',
    hint: 'Chu vi hình chữ nhật bằng $2 \\times (\\text{dài} + \\text{rộng})$.',
    explanation: 'Chu vi $P = 2 \\cdot (9 + 5) = 2 \\cdot 14 = 28\\text{ cm}$.',
    topic: 'Chu vi hình phẳng',
    difficultyLabel: 'Nhận biết',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_04',
    questionType: 'SHORT_ANSWER',
    stem: 'Một tam giác đều có chu vi bằng $24\\text{ cm}$. Độ dài mỗi cạnh của tam giác đó bằng bao nhiêu $\\text{cm}$?',
    correctAnswerText: '8 cm',
    hint: 'Tam giác đều có 3 cạnh bằng nhau.',
    explanation: 'Vì 3 cạnh bằng nhau nên độ dài mỗi cạnh là $24 : 3 = 8\\text{ cm}$.',
    topic: 'Tam giác đều',
    difficultyLabel: 'Nhận biết',
    allowShuffle: false,
    isSample: true,
  },

  // --- Chặng 2: Vượt dốc sườn đá (4 câu) ---
  {
    questionId: 'c08_math_05',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cho tam giác $ABC$ có $\\widehat{A} = 50^\\circ$ và $\\widehat{B} = 65^\\circ$. Số đo góc $\\widehat{C}$ là bao nhiêu?',
    options: [
      { optionId: 'cm05_a', text: '$65^\\circ$' },
      { optionId: 'cm05_b', text: '$75^\\circ$' },
      { optionId: 'cm05_c', text: '$55^\\circ$' },
      { optionId: 'cm05_d', text: '$115^\\circ$' },
    ],
    correctOptionId: 'cm05_a',
    correctAnswerText: '$65^\\circ$',
    hint: 'Tổng ba góc trong một tam giác luôn bằng $180^\\circ$.',
    explanation: 'Ta có $\\widehat{C} = 180^\\circ - (50^\\circ + 65^\\circ) = 180^\\circ - 115^\\circ = 65^\\circ$.',
    topic: 'Tổng ba góc tam giác',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_06',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một hình thang có độ dài hai đáy lần lượt là $8\\text{ cm}$ và $12\\text{ cm}$, chiều cao $5\\text{ cm}$. Diện tích hình thang đó bằng bao nhiêu?',
    options: [
      { optionId: 'cm06_a', text: '$50\\text{ cm}^2$' },
      { optionId: 'cm06_b', text: '$100\\text{ cm}^2$' },
      { optionId: 'cm06_c', text: '$40\\text{ cm}^2$' },
      { optionId: 'cm06_d', text: '$60\\text{ cm}^2$' },
    ],
    correctOptionId: 'cm06_a',
    correctAnswerText: '$50\\text{ cm}^2$',
    hint: 'Áp dụng công thức $S = \\frac{(a + b) \\cdot h}{2}$.',
    explanation: 'Diện tích hình thang là $S = \\frac{(8 + 12) \\cdot 5}{2} = \\frac{20 \\cdot 5}{2} = 50\\text{ cm}^2$.',
    topic: 'Diện tích hình thang',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_07',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Trong một hình thoi, hai đường chéo vuông góc với nhau và cắt nhau tại trung điểm của mỗi đường.”',
    options: [
      { optionId: 'cm07_true', text: 'Đúng' },
      { optionId: 'cm07_false', text: 'Sai' },
    ],
    correctOptionId: 'cm07_true',
    correctAnswerText: 'Đúng',
    hint: 'Hình thoi là tứ giác có 4 cạnh bằng nhau, đồng thời là một hình bình hành đặc biệt.',
    explanation: 'Hình thoi có hai đường chéo cắt nhau tại trung điểm mỗi đường, vuông góc với nhau và là tia phân giác các góc của hình thoi.',
    topic: 'Tính chất hình thoi',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c08_math_08',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một hình thoi có độ dài hai đường chéo là $10\\text{ cm}$ và $14\\text{ cm}$. Diện tích của hình thoi đó là:',
    options: [
      { optionId: 'cm08_a', text: '$70\\text{ cm}^2$' },
      { optionId: 'cm08_b', text: '$140\\text{ cm}^2$' },
      { optionId: 'cm08_c', text: '$48\\text{ cm}^2$' },
      { optionId: 'cm08_d', text: '$35\\text{ cm}^2$' },
    ],
    correctOptionId: 'cm08_a',
    correctAnswerText: '$70\\text{ cm}^2$',
    hint: 'Diện tích hình thoi bằng nửa tích độ dài hai đường chéo.',
    explanation: 'Ta có $S = \\frac{1}{2} \\cdot d_1 \\cdot d_2 = \\frac{1}{2} \\cdot 10 \\cdot 14 = 70\\text{ cm}^2$.',
    topic: 'Diện tích hình thoi',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },

  // --- Chặng 3: Bứt phá đỉnh mây (4 câu) ---
  {
    questionId: 'c08_math_09',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Cho tam giác $ABC$ vuông tại $A$ có hai cạnh góc vuông $AB = 6\\text{ cm}$ và $AC = 8\\text{ cm}$. Độ dài cạnh huyền $BC$ là bao nhiêu?',
    options: [
      { optionId: 'cm09_a', text: '$10\\text{ cm}$' },
      { optionId: 'cm09_b', text: '$14\\text{ cm}$' },
      { optionId: 'cm09_c', text: '$12\\text{ cm}$' },
      { optionId: 'cm09_d', text: '$100\\text{ cm}$' },
    ],
    correctOptionId: 'cm09_a',
    correctAnswerText: '$10\\text{ cm}$',
    hint: 'Dùng định lí Pythagore: $BC^2 = AB^2 + AC^2$.',
    explanation: 'Theo định lí Pythagore: $BC^2 = 6^2 + 8^2 = 36 + 64 = 100 \\Rightarrow BC = 10\\text{ cm}$.',
    topic: 'Định lí Pythagore',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_10',
    questionType: 'SHORT_ANSWER',
    stem: 'Một bể cá dạng hình hộp chữ nhật có kích thước lòng bể là $5\\text{ dm}$, $4\\text{ dm}$ và chiều cao $3\\text{ dm}$. Thể tích tối đa của bể cá đó là bao nhiêu đề-xi-mét khối ($\\text{dm}^3$)?',
    correctAnswerText: '60 dm³',
    hint: 'Thể tích hình hộp chữ nhật bằng tích ba kích thước: dài $\\times$ rộng $\\times$ cao.',
    explanation: 'Thể tích bể cá: $V = 5 \\cdot 4 \\cdot 3 = 60\\text{ dm}^3$ (tương ứng $60$ lít nước).',
    topic: 'Hình khối trong thực tiễn',
    difficultyLabel: 'Vận dụng',
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c08_math_11',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một hình tròn có bán kính $R = 5\\text{ cm}$. Lấy $\\pi \\approx 3{,}14$, chu vi của hình tròn đó xấp xỉ bằng:',
    options: [
      { optionId: 'cm11_a', text: '$31{,}4\\text{ cm}$' },
      { optionId: 'cm11_b', text: '$15{,}7\\text{ cm}$' },
      { optionId: 'cm11_c', text: '$78{,}5\\text{ cm}$' },
      { optionId: 'cm11_d', text: '$25{,}12\\text{ cm}$' },
    ],
    correctOptionId: 'cm11_a',
    correctAnswerText: '$31{,}4\\text{ cm}$',
    hint: 'Chu vi hình tròn được tính theo công thức $C = 2\\pi R$.',
    explanation: 'Chu vi hình tròn là $C = 2 \\cdot 3{,}14 \\cdot 5 = 31{,}4\\text{ cm}$.',
    topic: 'Đường tròn & Hình tròn',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_math_12',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Một tấm biển báo giao thông hình tam giác có độ dài cạnh đáy $60\\text{ cm}$ và chiều cao tương ứng $50\\text{ cm}$. Diện tích mặt tấm biển báo đó bằng bao nhiêu?',
    options: [
      { optionId: 'cm12_a', text: '$1500\\text{ cm}^2$' },
      { optionId: 'cm12_b', text: '$3000\\text{ cm}^2$' },
      { optionId: 'cm12_c', text: '$1100\\text{ cm}^2$' },
      { optionId: 'cm12_d', text: '$2500\\text{ cm}^2$' },
    ],
    correctOptionId: 'cm12_a',
    correctAnswerText: '$1500\\text{ cm}^2$',
    hint: 'Diện tích tam giác bằng một nửa tích của đáy và chiều cao tương ứng.',
    explanation: 'Diện tích tấm biển là $S = \\frac{1}{2} \\cdot 60 \\cdot 50 = 1500\\text{ cm}^2$.',
    topic: 'Ứng dụng diện tích tam giác',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
];

export const SAMPLE_INFORMATICS_C08_QUESTIONS: C08QuestionItem[] = [
  // --- Chặng 1: Khởi động chân núi (4 câu) ---
  {
    questionId: 'c08_info_01',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Khi em đọc bản tin dự báo thời tiết trên điện thoại để biết trời sắp mưa, con số nhiệt độ trên màn hình là dữ liệu, còn việc biết “hôm nay cần mang áo mưa” là gì?',
    options: [
      { optionId: 'ci01_a', text: 'Thông tin' },
      { optionId: 'ci01_b', text: 'Vật mang tin' },
      { optionId: 'ci01_c', text: 'Phần cứng' },
      { optionId: 'ci01_d', text: 'Địa chỉ IP' },
    ],
    correctOptionId: 'ci01_a',
    correctAnswerText: 'Thông tin',
    hint: 'Con người thu nhận dữ liệu và hiểu được ý nghĩa để ra quyết định.',
    explanation: 'Thông tin là những gì đem lại sự hiểu biết cho con người và giúp đưa ra quyết định phù hợp.',
    topic: 'Thông tin & Dữ liệu',
    difficultyLabel: 'Nhận biết',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_02',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong máy tính, $1\\text{ Byte}$ bằng bao nhiêu $\\text{bit}$?',
    options: [
      { optionId: 'ci02_a', text: '$8\\text{ bit}$' },
      { optionId: 'ci02_b', text: '$4\\text{ bit}$' },
      { optionId: 'ci02_c', text: '$10\\text{ bit}$' },
      { optionId: 'ci02_d', text: '$1024\\text{ bit}$' },
    ],
    correctOptionId: 'ci02_a',
    correctAnswerText: '$8\\text{ bit}$',
    hint: 'Đây là đơn vị chuẩn cơ bản gồm 8 chữ số nhị phân 0 hoặc 1.',
    explanation: 'Theo quy ước quốc tế trong Tin học, $1\\text{ Byte} = 8\\text{ bit}$.',
    topic: 'Biểu diễn dữ liệu',
    difficultyLabel: 'Nhận biết',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_03',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Bàn phím, chuột và micro là các thiết bị vào (Input Device) của máy tính.”',
    options: [
      { optionId: 'ci03_true', text: 'Đúng' },
      { optionId: 'ci03_false', text: 'Sai' },
    ],
    correctOptionId: 'ci03_true',
    correctAnswerText: 'Đúng',
    hint: 'Các thiết bị này đưa ký tự, thao tác trỏ và âm thanh từ người dùng vào máy tính.',
    explanation: 'Bàn phím, chuột và micro thu nhận dữ liệu từ bên ngoài truyền vào cho máy tính xử lý nên là thiết bị vào.',
    topic: 'Thiết bị số',
    difficultyLabel: 'Nhận biết',
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c08_info_04',
    questionType: 'SHORT_ANSWER',
    stem: 'Trong hệ thống quản lý dữ liệu máy tính, phần ngăn chứa dùng để phân loại và chứa các tệp tin cùng thư mục con gọi là gì?',
    correctAnswerText: 'Thư mục (Folder)',
    hint: 'Biểu tượng thường có màu vàng giống kẹp hồ sơ trên Windows.',
    explanation: 'Thư mục (Folder / Directory) giúp sắp xếp cây dữ liệu khoa học, có thể chứa nhiều tệp tin và thư mục con.',
    topic: 'Tệp & Thư mục',
    difficultyLabel: 'Nhận biết',
    allowShuffle: false,
    isSample: true,
  },

  // --- Chặng 2: Vượt dốc sườn đá (4 câu) ---
  {
    questionId: 'c08_info_05',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Phần mở rộng của tệp tin `BaoCao_Toan9.pptx` cho biết đó là loại tệp gì?',
    options: [
      { optionId: 'ci05_a', text: 'Tệp bài trình chiếu (PowerPoint)' },
      { optionId: 'ci05_b', text: 'Tệp bảng tính điện tử (Excel)' },
      { optionId: 'ci05_c', text: 'Tệp âm thanh nén' },
      { optionId: 'ci05_d', text: 'Tệp ảnh tĩnh' },
    ],
    correctOptionId: 'ci05_a',
    correctAnswerText: 'Tệp bài trình chiếu (PowerPoint)',
    hint: 'Chữ viết tắt `ppt` bắt nguồn từ PowerPoint.',
    explanation: 'Đuôi tệp `.pptx` là định dạng chuẩn của phần mềm trình chiếu Microsoft PowerPoint.',
    topic: 'Tệp & Thư mục',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_06',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong công cụ tìm kiếm Google, muốn tìm kiếm chính xác cả cụm từ “Đường lên đỉnh núi” không bị tách rời từng từ, ta nên gõ như thế nào?',
    options: [
      { optionId: 'ci06_a', text: '"Đường lên đỉnh núi"' },
      { optionId: 'ci06_b', text: '#Đường lên đỉnh núi' },
      { optionId: 'ci06_c', text: '(Đường lên đỉnh núi)' },
      { optionId: 'ci06_d', text: '*Đường lên đỉnh núi*' },
    ],
    correctOptionId: 'ci06_a',
    correctAnswerText: '"Đường lên đỉnh núi"',
    hint: 'Đặt cụm từ khóa vào cặp dấu nháy đôi.',
    explanation: 'Dấu ngoặc kép `"..."` báo cho máy tìm kiếm chỉ trả về các trang có chứa đúng nguyên văn cụm từ đó.',
    topic: 'Internet & Tìm kiếm',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_07',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Bộ phận nào trong máy tính có chức năng xử lý trung tâm, thực hiện các phép toán số học và điều khiển hoạt động máy tính?',
    options: [
      { optionId: 'ci07_a', text: 'CPU (Bộ xử lý trung tâm)' },
      { optionId: 'ci07_b', text: 'Máy in (Printer)' },
      { optionId: 'ci07_c', text: 'Loa ngoài (Speaker)' },
      { optionId: 'ci07_d', text: 'Màn hình (Monitor)' },
    ],
    correctOptionId: 'ci07_a',
    correctAnswerText: 'CPU (Bộ xử lý trung tâm)',
    hint: 'Viết tắt của Central Processing Unit.',
    explanation: 'CPU được ví như “bộ não” của máy tính, thực hiện mọi lệnh tính toán và điều phối dữ liệu.',
    topic: 'Thiết bị số',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_08',
    questionType: 'TRUE_FALSE',
    stem: 'Khẳng định sau Đúng hay Sai: “Hành vi đăng tải thông tin sai sự thật hoặc ảnh riêng tư của bạn lên mạng xã hội khi chưa được đồng ý là vi phạm quy tắc an toàn và đạo đức số.”',
    options: [
      { optionId: 'ci08_true', text: 'Đúng' },
      { optionId: 'ci08_false', text: 'Sai' },
    ],
    correctOptionId: 'ci08_true',
    correctAnswerText: 'Đúng',
    hint: 'Tôn trọng quyền riêng tư và tính xác thực là nguyên tắc cốt lõi khi giao tiếp trên mạng.',
    explanation: 'Luôn tôn trọng quyền riêng tư của người khác và không lan truyền tin giả trên môi trường mạng.',
    topic: 'An toàn & Đạo đức số',
    difficultyLabel: 'Thông hiểu',
    allowShuffle: false,
    isSample: true,
  },

  // --- Chặng 3: Bứt phá đỉnh mây (4 câu) ---
  {
    questionId: 'c08_info_09',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Ba cấu trúc điều khiển cơ bản dùng để mô tả mọi thuật toán là gì?',
    options: [
      { optionId: 'ci09_a', text: 'Tuần tự, Rẽ nhánh và Lặp' },
      { optionId: 'ci09_b', text: 'Bật máy, Gõ phím và Lưu tệp' },
      { optionId: 'ci09_c', text: 'Sao chép, Dán và Đổi tên' },
      { optionId: 'ci09_d', text: 'Tải xuống, Cài đặt và Gỡ bỏ' },
    ],
    correctOptionId: 'ci09_a',
    correctAnswerText: 'Tuần tự, Rẽ nhánh và Lặp',
    hint: 'Gồm thực hiện từng bước nối tiếp, kiểm tra điều kiện và thực hiện lặp lại.',
    explanation: 'Mọi thuật toán lập trình đều cấu thành từ 3 cấu trúc cơ bản: Tuần tự (Sequence), Rẽ nhánh (Selection) và Lặp (Iteration).',
    topic: 'Thuật toán',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_10',
    questionType: 'SHORT_ANSWER',
    stem: 'Cho đoạn thuật toán: Ban đầu `T = 2`. Thực hiện lặp 3 lần phép gán `T = T * 2`. Sau khi kết thúc vòng lặp, giá trị của `T` bằng bao nhiêu?',
    correctAnswerText: '16',
    hint: 'Sau mỗi lần lặp giá trị của T nhân đôi: $2 \\to 4 \\to 8 \\to \\dots$',
    explanation: 'Lần 1: $T = 4$; Lần 2: $T = 8$; Lần 3: $T = 16$. Vậy kết quả cuối cùng là $16$.',
    topic: 'Thuật toán – Vòng lặp',
    difficultyLabel: 'Vận dụng',
    allowShuffle: false,
    isSample: true,
  },
  {
    questionId: 'c08_info_11',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Trong phần mềm bảng tính, công thức `=AVERAGE(B2:B5)` thực hiện công việc gì?',
    options: [
      { optionId: 'ci11_a', text: 'Tính trung bình cộng các giá trị từ ô B2 đến ô B5' },
      { optionId: 'ci11_b', text: 'Tính tổng các ô từ B2 đến B5' },
      { optionId: 'ci11_c', text: 'Tìm giá trị lớn nhất trong vùng B2:B5' },
      { optionId: 'ci11_d', text: 'Đếm số ô trống trong vùng B2:B5' },
    ],
    correctOptionId: 'ci11_a',
    correctAnswerText: 'Tính trung bình cộng các giá trị từ ô B2 đến ô B5',
    hint: 'Từ tiếng Anh “Average” có nghĩa là trung bình.',
    explanation: 'Hàm `AVERAGE` dùng để tính trung bình cộng các giá trị số trong vùng địa chỉ được chọn.',
    topic: 'Bảng tính điện tử',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
  {
    questionId: 'c08_info_12',
    questionType: 'MULTIPLE_CHOICE',
    stem: 'Khi nhận được một email lạ có đính kèm tệp `.exe` và lời hứa trúng thưởng yêu cầu nhập mật khẩu tài khoản học tập, em nên làm gì?',
    options: [
      { optionId: 'ci12_a', text: 'Không mở tệp, không nhập mật khẩu và báo cho thầy cô/người lớn' },
      { optionId: 'ci12_b', text: 'Tải tệp về chạy thử xem phần thưởng là gì' },
      { optionId: 'ci12_c', text: 'Nhập mật khẩu giả rồi gửi cho bạn bè thử cùng' },
      { optionId: 'ci12_d', text: 'Chuyển tiếp email đó cho cả lớp' },
    ],
    correctOptionId: 'ci12_a',
    correctAnswerText: 'Không mở tệp, không nhập mật khẩu và báo cho thầy cô/người lớn',
    hint: 'Đây là dấu hiệu điển hình của thư rác chứa mã độc và lừa đảo Phishing.',
    explanation: 'Không bao giờ mở tệp thực thi lạ (`.exe`) hoặc cung cấp mật khẩu qua đường link/email không rõ nguồn gốc để tránh mất tài khoản và nhiễm mã độc.',
    topic: 'An toàn số',
    difficultyLabel: 'Vận dụng',
    allowShuffle: true,
    isSample: true,
  },
];

// ============================================================================
// 5. ROSTER & TEAM HELPERS (1–50 STUDENTS, 2–6 TEAMS, TEMPORARY LABELS)
// ============================================================================

const SAMPLE_STUDENT_NAMES_50: string[] = [
  'Nguyễn Minh An', 'Trần Hoàng Bách', 'Lê Ngọc Bảo Châu', 'Phạm Gia Bảo', 'Hoàng Minh Chiến',
  'Vũ Phương Dung', 'Đặng Quốc Đạt', 'Bùi Khánh Duy', 'Đỗ Thảo Giang', 'Ngô Gia Hân',
  'Dương Tuấn Hiển', 'Lý Minh Hiếu', 'Trương Bảo Hoàng', 'Phan Thanh Huyền', 'Huỳnh Gia Hưng',
  'Đinh Thiên Kim', 'Cao Tuấn Kiệt', 'Mai Ngọc Lan', 'Lâm Hoàng Long', 'Tạ Phương Linh',
  'Trịnh Quang Minh', 'Hà Bảo Nam', 'Võ Khánh Ngân', 'Đoàn Bích Ngọc', 'Nguyễn Khôi Nguyên',
  'Trần Thảo Nhi', 'Lê Hoàng Phong', 'Phạm Minh Phúc', 'Hoàng Bảo Quân', 'Vũ Thiên Quang',
  'Đặng Minh Sơn', 'Bùi Thanh Tâm', 'Đỗ Đức Thắng', 'Ngô Phương Thảo', 'Dương Quốc Thịnh',
  'Lý Minh Thư', 'Trương Thủy Tiên', 'Phan Anh Toàn', 'Huỳnh Bảo Trâm', 'Đinh Ngọc Trinh',
  'Cao Minh Triết', 'Mai Quốc Trung', 'Lâm Anh Tuấn', 'Tạ Thanh Tùng', 'Trịnh Cát Tường',
  'Hà Thảo Uyên', 'Võ Khánh Vân', 'Đoàn Quốc Việt', 'Nguyễn Hoàng Vũ', 'Trần Như Ý',
];

export function createClassExpeditionParticipant(classLabel: string): C08Participant[] {
  return [
    {
      participantId: 'c08_class_expedition',
      stt: 1,
      name: classLabel ? `Đoàn ${classLabel}` : 'Cả lớp cùng chinh phục',
      code: 'CL',
      colorHex: '#06B6D4',
      isTemporaryLabel: true,
    },
  ];
}

export function createTeamParticipants(teamCount: number, customNames?: string[]): C08Participant[] {
  const count = Math.max(2, Math.min(6, Math.round(teamCount)));
  return Array.from({ length: count }, (_, idx) => ({
    participantId: `c08_team_${idx + 1}`,
    stt: idx + 1,
    name: (customNames && customNames[idx]?.trim()) || `Đội ${idx + 1}`,
    code: `Đ${idx + 1}`,
    colorHex: C08_TEAM_COLORS[idx % C08_TEAM_COLORS.length],
    isTeam: true,
    isTemporaryLabel: true,
  }));
}

export function createSampleStudentParticipants(count: number): C08Participant[] {
  const safe = Math.max(1, Math.min(50, Math.round(count)));
  return Array.from({ length: safe }, (_, idx) => {
    const stt = idx + 1;
    const name = SAMPLE_STUDENT_NAMES_50[idx] || `Học sinh Mẫu ${String(stt).padStart(2, '0')}`;
    return {
      participantId: `c08_sample_stu_${stt}`,
      stt,
      name,
      code: String(stt).padStart(2, '0'),
      colorHex: C08_PLAYER_PALETTE[idx % C08_PLAYER_PALETTE.length],
      isSampleStudent: true,
      isTemporaryLabel: true,
    };
  });
}

export function mapCandidatesToC08Participants(
  candidates: StudentCandidate[]
): C08Participant[] {
  return candidates.slice(0, 50).map((c, idx) => ({
    participantId: c.id || `c08_cand_${idx + 1}`,
    stt: idx + 1,
    name: c.fullName || `Học sinh ${idx + 1}`,
    code: String(idx + 1).padStart(2, '0'),
    colorHex: C08_PLAYER_PALETTE[idx % C08_PLAYER_PALETTE.length],
  }));
}

// ============================================================================
// 6. SAFE SESSION STORAGE (ISOLATED KEY, NEVER CALLS localStorage.clear())
// ============================================================================

export function saveC08PersistedSession(session: C08PersistedSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(C08_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore quota errors
  }
}

export function clearC08PersistedSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(C08_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadC08PersistedSession(): C08PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(C08_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<C08PersistedSession>;
    if (
      !parsed ||
      parsed.version !== C08_STORAGE_VERSION ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > C08_SESSION_TTL_MS ||
      !parsed.config ||
      !Array.isArray(parsed.participants) ||
      parsed.participants.length === 0 ||
      !Array.isArray(parsed.questionPool) ||
      parsed.questionPool.length === 0 ||
      !Array.isArray(parsed.records) ||
      typeof parsed.currentQuestionIndex !== 'number'
    ) {
      clearC08PersistedSession();
      return null;
    }

    if (
      parsed.currentQuestionIndex < 0 ||
      parsed.currentQuestionIndex >= parsed.questionPool.length
    ) {
      clearC08PersistedSession();
      return null;
    }

    return parsed as C08PersistedSession;
  } catch {
    clearC08PersistedSession();
    return null;
  }
}
