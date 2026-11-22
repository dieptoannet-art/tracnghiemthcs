/**
 * D06 — VUA GHI ĐIỂM 3D (Tây Đô Smart EDU)
 * Pure deterministic Topic × Point-Tier Jeopardy-style Classroom Game Engine:
 * - Modes:
 *   1. 'team' (2–6 teams on one device, 1–50 students): teams take turns choosing tiles in fixed order
 *      (optional one-time random opening team), ALL teams answer simultaneously on mini-boards/paper.
 *   2. 'solo' (Tự luyện, 1 student): single scoreboard, zero fake opponents.
 *   3. 'class_shared' (Cả lớp cùng chơi, 1–50 students): single shared class scoreboard, zero fake opponents.
 * - Default Board: 3 Topic Columns × 3 Point Rows (10, 20, 30) = 9 tiles, max score per team = 180.
 * - Strict Rules:
 *   * Correct = +10 / +20 / +30 (exact tile value); incorrect / no_answer = 0; picking gives NO bonus.
 *   * Multiple teams correct -> ALL correct teams receive full tile value.
 *   * 'ungraded' ("Chưa chấm") is a distinct state; confirmation blocked until every team is graded.
 *   * Each tile's question is fixed before match start; played tiles cannot be re-opened for scoring
 *     (only viewed in Review / Xem lại lời giải).
 *   * Idempotent settlement per tileId (double-click NEVER double-awards points).
 *   * Picker turn advances ONLY once a tile is newly settled; editing the just-settled tile BEFORE
 *     opening the next tile or finalizing summary recomputes scores purely from history WITHOUT
 *     advancing the picker turn an extra time.
 *   * Ranking strictly by totalScore descending ("Đồng hạng" on ties; never uses click speed or input order).
 *   * Early finish marks "Kết thúc sớm" and reports exact tiles played (X/9).
 * - Built-in 9-tile sample pack "Vua ghi điểm – Toán THCS" ("Dữ liệu mẫu") stored separately from bank.
 * - Custom Smart EDU bank mapper with RBAC enforcement, zero question repetition, zero guessed difficulty,
 *   and explicit missing-slot reporting so teacher can fill/swap slots or switch packs.
 * - Math syntax diagnostics (identifies exact malformed LaTeX segments without comparing via rendered DOM).
 * - Demo-isolated session persistence with corrupt JSON recovery.
 */

import katex from 'katex';
import { Question, QuestionType, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type KingOfScoreMode = 'team' | 'solo' | 'class_shared';

export type KingOfScorePointValue = 10 | 20 | 30;

export type KingOfScoreTileStatus = 'unplayed' | 'playing' | 'played';

export type KingOfScoreVerdict = 'ungraded' | 'correct' | 'incorrect' | 'no_answer';

export type KingOfScoreMatchStatus = 'playing' | 'finished' | 'ended_early';

export type KingOfScoreSourceKind = 'sample' | 'bank';

export type KingOfScoreTurnPhase =
  | 'board' // Waiting for picking team to choose an unplayed tile
  | 'thinking' // Tile opened, question visible, timer running (or unlimited)
  | 'grading' // Answering stopped / time up; teacher grades each team; reveal answer/explanation
  | 'settled'; // Tile confirmed & locked; teacher explains then clicks "Quay về bảng chọn ô"

export interface KingTeamPalette {
  id: string;
  label: string;
  hex: string;
  hexNum: number;
  lightHex: string;
  textOnSolid: string;
}

export const KING_TEAM_PALETTES: KingTeamPalette[] = [
  {
    id: 'teal',
    label: 'Xanh ngọc',
    hex: '#0D9488',
    hexNum: 0x0d9488,
    lightHex: '#5EEAD4',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'gold',
    label: 'Vàng kim',
    hex: '#D97706',
    hexNum: 0xeab308,
    lightHex: '#FEF08A',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'sky',
    label: 'Xanh biển',
    hex: '#2563EB',
    hexNum: 0x2563eb,
    lightHex: '#93C5FD',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'coral',
    label: 'Cam san hô',
    hex: '#EA580C',
    hexNum: 0xea580c,
    lightHex: '#FDBA74',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'indigo',
    label: 'Tím chàm',
    hex: '#7C3AED',
    hexNum: 0x7c3aed,
    lightHex: '#C4B5FD',
    textOnSolid: '#FFFFFF',
  },
  {
    id: 'rose',
    label: 'Đỏ ruby',
    hex: '#E11D48',
    hexNum: 0xe11d48,
    lightHex: '#FDA4AF',
    textOnSolid: '#FFFFFF',
  },
];

export const KING_POINT_TIERS: KingOfScorePointValue[] = [10, 20, 30];

export const DEFAULT_TIMER_BY_POINTS: Record<KingOfScorePointValue, number> = {
  10: 20,
  20: 30,
  30: 45,
};

export const D06_SAMPLE_PACK_TITLE = 'Vua ghi điểm – Toán THCS';
export const D06_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D06_SESSION_STORAGE_KEY = 'taydo_d06_king_of_score_session_v1';
export const D06_SESSION_VERSION = 1;

export const D06_MAX_SCORE_PER_TEAM = 180; // 3 topics × (10 + 20 + 30)

export interface KingTeamConfig {
  id: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
}

export interface KingQuestionOption {
  id: string; // Stable option ID, never tied to display index
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface KingQuestionItem {
  id: string;
  code: string;
  type: QuestionType;
  topic: string;
  points: KingOfScorePointValue;
  stem: string;
  image?: string;
  subject: string;
  grade: string;
  level: string;
  options?: KingQuestionOption[];
  correctOptionId?: string;
  acceptedAnswers?: string[];
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
}

export interface KingBoardTile {
  tileId: string; // e.g. 'c0_p10'
  colIndex: number; // 0, 1, 2
  rowIndex: number; // 0 (10pt), 1 (20pt), 2 (30pt)
  topicTitle: string;
  points: KingOfScorePointValue;
  question: KingQuestionItem;
  status: KingOfScoreTileStatus;
  pickerTeamId: string | null; // Team that chose this tile
}

export interface KingTileSettlementRecord {
  tileId: string;
  colIndex: number;
  rowIndex: number;
  topicTitle: string;
  points: KingOfScorePointValue;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  pickerTeamId: string;
  verdictsByTeam: Record<string, KingOfScoreVerdict>;
  pointsAwardedByTeam: Record<string, number>;
  answerNotesByTeam: Record<string, string>;
  selectedOptionIdByTeam: Record<string, string>;
  settledAt: number;
  wasEdited?: boolean;
}

export interface KingTeamRuntime {
  teamId: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  noAnswerCount: number;
  tilesPicked: number;
}

export interface KingMatchConfig {
  mode: KingOfScoreMode;
  teams: KingTeamConfig[];
  sourceKind: KingOfScoreSourceKind;
  subjectFilter: string;
  gradeFilter: string;
  randomStarter: boolean;
  timerEnabled: boolean; // false => unlimited (0s)
  timerByPoints: Record<KingOfScorePointValue, number>;
  showOptionsInTeamMode: boolean; // Toggle displaying A/B/C/D options on projector
  topicTitles: [string, string, string];
  classSizeHint: number; // 1–50 students for classroom context
}

export interface KingStandingRow {
  teamId: string;
  teamNumber: number;
  name: string;
  paletteIndex: number;
  totalScore: number;
  correctCount: number;
  incorrectCount: number;
  noAnswerCount: number;
  rank: number; // 1-based; equal scores share identical rank
  isTied: boolean; // true when >= 2 teams share this rank
  rankLabel: string; // e.g. "Hạng 1" or "Đồng hạng 1"
}

export interface KingOfScoreState {
  config: KingMatchConfig;
  topicTitles: [string, string, string];
  tiles: KingBoardTile[]; // 9 tiles ordered col-major or row-major (fixed 3x3)
  startingPickerIndex: number; // 0..teams.length-1 determined ONCE at match creation
  currentPickerIndex: number; // 0..teams.length-1
  activeTileId: string | null;
  phase: KingOfScoreTurnPhase;
  draftVerdicts: Record<string, KingOfScoreVerdict>;
  draftAnswerNotes: Record<string, string>;
  draftSelectedOptions: Record<string, string>;
  answerRevealed: boolean;
  settledHistory: KingTileSettlementRecord[];
  teamRuntime: Record<string, KingTeamRuntime>;
  lastSettledTileId: string | null; // Editable ONLY while phase === 'board' or 'settled' before next tile
  canEditLastTile: boolean;
  status: KingOfScoreMatchStatus;
  endedEarly: boolean;
  maxPossibleScore: number;
}

export interface MathFormulaDiagnostic {
  segmentIndex: number;
  startChar: number;
  rawExpression: string;
  message: string;
}

export interface BankBoardSlotStatus {
  tileId: string;
  colIndex: number;
  rowIndex: number;
  topicTitle: string;
  points: KingOfScorePointValue;
  expectedLevelLabel: string;
  question: KingQuestionItem | null;
}

export interface BankBoardBuildResult {
  ready: boolean;
  topicTitles: [string, string, string];
  slots: BankBoardSlotStatus[];
  missingSlots: BankBoardSlotStatus[];
  eligiblePool: KingQuestionItem[];
  unclassifiedCount: number;
}

// ============================================================================
// MATH SYNTAX INSPECTOR (Safe diagnostics; never compares via rendered HTML)
// ============================================================================

export function inspectMathFormulaErrors(content: string): MathFormulaDiagnostic[] {
  if (!content) return [];
  const diagnostics: MathFormulaDiagnostic[] = [];
  const mathRegex = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\$\n]+?)\$/g;
  let match: RegExpExecArray | null;
  let segIdx = 0;

  while ((match = mathRegex.exec(content)) !== null) {
    segIdx++;
    const displayDollar = match[1];
    const displayBracket = match[2];
    const inlineParen = match[3];
    const inlineDollar = match[4];
    const isDisplay = displayDollar !== undefined || displayBracket !== undefined;
    const rawMath = (displayDollar ?? displayBracket ?? inlineParen ?? inlineDollar ?? '').trim();
    if (!rawMath) continue;

    try {
      katex.renderToString(rawMath, {
        displayMode: isDisplay,
        throwOnError: true,
        strict: 'ignore',
      });
    } catch (err) {
      diagnostics.push({
        segmentIndex: segIdx,
        startChar: match.index + 1,
        rawExpression: match[0],
        message: err instanceof Error ? err.message : 'Lỗi cú pháp công thức LaTeX',
      });
    }
  }
  return diagnostics;
}

// ============================================================================
// SAMPLE 50-STUDENT CLASSROOM ROSTER HELPER (No emails required)
// ============================================================================

const SAMPLE_SURNAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Võ',
  'Đặng',
];
const SAMPLE_MIDDLES = ['Minh', 'Gia', 'Ngọc', 'Thanh', 'Quốc', 'Bảo', 'Hoài', 'Khánh', 'Thùy', 'Anh'];
const SAMPLE_GIVENS = ['An', 'Bình', 'Châu', 'Dũng', 'Hà', 'Huy', 'Khôi', 'Lan', 'Linh', 'Nam'];

export function createSampleStudentList(count = 50): string[] {
  const safeCount = Math.max(1, Math.min(50, Math.round(count)));
  const out: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const s = SAMPLE_SURNAMES[i % SAMPLE_SURNAMES.length];
    const m = SAMPLE_MIDDLES[Math.floor(i / 5) % SAMPLE_MIDDLES.length];
    const g = SAMPLE_GIVENS[(i * 3 + Math.floor(i / 10)) % SAMPLE_GIVENS.length];
    out.push(`${String(i + 1).padStart(2, '0')}. ${s} ${m} ${g}`);
  }
  return out;
}

// ============================================================================
// BUILT-IN 9-TILE SAMPLE PACK: "Vua ghi điểm – Toán THCS" ("Dữ liệu mẫu")
// ============================================================================

export const D06_SAMPLE_TOPICS: [string, string, string] = [
  'SỐ VÀ PHÉP TÍNH',
  'BIỂU THỨC VÀ PHƯƠNG TRÌNH',
  'HÌNH HỌC VÀ ĐO LƯỜNG',
];

export const D06_SAMPLE_QUESTIONS: KingQuestionItem[] = [
  // Column 0: SỐ VÀ PHÉP TÍNH
  {
    id: 'd06_sample_c0_10',
    code: 'D06-SO-10',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[0],
    points: 10,
    stem: 'Tính \\(-9+14\\).',
    subject: 'Toán',
    grade: 'Khối 7',
    level: 'Nhận biết',
    options: [
      { id: 'c0_10_a', label: 'A', text: '\\(5\\)' },
      { id: 'c0_10_b', label: 'B', text: '\\(-5\\)' },
      { id: 'c0_10_c', label: 'C', text: '\\(23\\)' },
      { id: 'c0_10_d', label: 'D', text: '\\(-23\\)' },
    ],
    correctOptionId: 'c0_10_a',
    acceptedAnswers: ['5', '+5'],
    officialAnswerText: '\\(5\\)',
    explanation: 'Cộng hai số nguyên trái dấu: \\(-9+14 = 14-9 = 5\\).',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c0_20',
    code: 'D06-SO-20',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[0],
    points: 20,
    stem: 'Tính \\(\\frac{3}{4}+\\frac{1}{6}\\).',
    subject: 'Toán',
    grade: 'Khối 7',
    level: 'Thông hiểu',
    options: [
      { id: 'c0_20_a', label: 'A', text: '\\(\\frac{4}{10}\\)' },
      { id: 'c0_20_b', label: 'B', text: '\\(\\frac{11}{12}\\)' },
      { id: 'c0_20_c', label: 'C', text: '\\(\\frac{5}{12}\\)' },
      { id: 'c0_20_d', label: 'D', text: '\\(\\frac{7}{12}\\)' },
    ],
    correctOptionId: 'c0_20_b',
    acceptedAnswers: ['11/12'],
    officialAnswerText: '\\(\\frac{11}{12}\\)',
    explanation:
      'Quy đồng mẫu chung là \\(12\\): \\[\\frac{3}{4}+\\frac{1}{6} = \\frac{9}{12}+\\frac{2}{12} = \\frac{11}{12}.\\]',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c0_30',
    code: 'D06-SO-30',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[0],
    points: 30,
    stem: 'Tính \\((-3)^2-3^2+\\sqrt{64}\\).',
    subject: 'Toán',
    grade: 'Khối 7',
    level: 'Vận dụng',
    options: [
      { id: 'c0_30_a', label: 'A', text: '\\(26\\)' },
      { id: 'c0_30_b', label: 'B', text: '\\(-10\\)' },
      { id: 'c0_30_c', label: 'C', text: '\\(8\\)' },
      { id: 'c0_30_d', label: 'D', text: '\\(16\\)' },
    ],
    correctOptionId: 'c0_30_c',
    acceptedAnswers: ['8'],
    officialAnswerText: '\\(8\\)',
    explanation:
      'Lưu ý dấu ngoặc: \\((-3)^2 = 9\\), còn \\(-3^2 = -9\\) và \\(\\sqrt{64} = 8\\). Do đó \\[(-3)^2-3^2+\\sqrt{64} = 9-9+8 = 8.\\]',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },

  // Column 1: BIỂU THỨC VÀ PHƯƠNG TRÌNH
  {
    id: 'd06_sample_c1_10',
    code: 'D06-PT-10',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[1],
    points: 10,
    stem: 'Thu gọn \\(7x-3x\\).',
    subject: 'Toán',
    grade: 'Khối 8',
    level: 'Nhận biết',
    options: [
      { id: 'c1_10_a', label: 'A', text: '\\(4x\\)' },
      { id: 'c1_10_b', label: 'B', text: '\\(10x\\)' },
      { id: 'c1_10_c', label: 'C', text: '\\(4\\)' },
      { id: 'c1_10_d', label: 'D', text: '\\(-4x\\)' },
    ],
    correctOptionId: 'c1_10_a',
    acceptedAnswers: ['4x'],
    officialAnswerText: '\\(4x\\)',
    explanation: 'Trừ các hệ số của hai đơn thức đồng dạng: \\(7x-3x = (7-3)x = 4x\\).',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c1_20',
    code: 'D06-PT-20',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[1],
    points: 20,
    stem: 'Giải \\(3x-5=16\\).',
    subject: 'Toán',
    grade: 'Khối 8',
    level: 'Thông hiểu',
    options: [
      { id: 'c1_20_a', label: 'A', text: '\\(x=\\frac{11}{3}\\)' },
      { id: 'c1_20_b', label: 'B', text: '\\(x=7\\)' },
      { id: 'c1_20_c', label: 'C', text: '\\(x=6\\)' },
      { id: 'c1_20_d', label: 'D', text: '\\(x=-7\\)' },
    ],
    correctOptionId: 'c1_20_b',
    acceptedAnswers: ['7', 'x=7'],
    officialAnswerText: '\\(x=7\\)',
    explanation: 'Chuyển vế đổi dấu: \\(3x = 16+5 = 21\\), suy ra \\(x = \\frac{21}{3} = 7\\).',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c1_30',
    code: 'D06-PT-30',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[1],
    points: 30,
    stem: 'Giải \\(\\frac{x-1}{2}+\\frac{x+2}{3}=4\\).',
    subject: 'Toán',
    grade: 'Khối 8',
    level: 'Vận dụng',
    options: [
      { id: 'c1_30_a', label: 'A', text: '\\(x=\\frac{23}{5}\\)' },
      { id: 'c1_30_b', label: 'B', text: '\\(x=5\\)' },
      { id: 'c1_30_c', label: 'C', text: '\\(x=\\frac{25}{5}\\)' },
      { id: 'c1_30_d', label: 'D', text: '\\(x=\\frac{21}{5}\\)' },
    ],
    correctOptionId: 'c1_30_a',
    acceptedAnswers: ['23/5', 'x=23/5', '4.6', '4,6'],
    officialAnswerText: '\\(x=\\frac{23}{5}\\)',
    explanation:
      'Nhân cả hai vế với mẫu chung \\(6\\): \\[3(x-1)+2(x+2)=24 \\Leftrightarrow 3x-3+2x+4=24 \\Leftrightarrow 5x+1=24 \\Leftrightarrow x=\\frac{23}{5}.\\]',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },

  // Column 2: HÌNH HỌC VÀ ĐO LƯỜNG
  {
    id: 'd06_sample_c2_10',
    code: 'D06-HH-10',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[2],
    points: 10,
    stem: 'Hình vuông cạnh \\(6\\,\\mathrm{cm}\\) có chu vi bao nhiêu?',
    subject: 'Toán',
    grade: 'Khối 6',
    level: 'Nhận biết',
    options: [
      { id: 'c2_10_a', label: 'A', text: '\\(12\\,\\mathrm{cm}\\)' },
      { id: 'c2_10_b', label: 'B', text: '\\(36\\,\\mathrm{cm}\\)' },
      { id: 'c2_10_c', label: 'C', text: '\\(24\\,\\mathrm{cm}\\)' },
      { id: 'c2_10_d', label: 'D', text: '\\(18\\,\\mathrm{cm}\\)' },
    ],
    correctOptionId: 'c2_10_c',
    acceptedAnswers: ['24', '24cm', '24 cm'],
    officialAnswerText: '\\(24\\,\\mathrm{cm}\\)',
    explanation: 'Chu vi hình vuông cạnh \\(a\\) là \\(C = 4a = 4 \\times 6 = 24\\,\\mathrm{cm}\\).',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c2_20',
    code: 'D06-HH-20',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[2],
    points: 20,
    stem: 'Hình thang có hai đáy \\(8\\,\\mathrm{cm}\\), \\(12\\,\\mathrm{cm}\\), chiều cao \\(5\\,\\mathrm{cm}\\). Diện tích bao nhiêu?',
    subject: 'Toán',
    grade: 'Khối 6',
    level: 'Thông hiểu',
    options: [
      { id: 'c2_20_a', label: 'A', text: '\\(100\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_20_b', label: 'B', text: '\\(50\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_20_c', label: 'C', text: '\\(40\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_20_d', label: 'D', text: '\\(25\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'c2_20_b',
    acceptedAnswers: ['50', '50cm2', '50 cm2'],
    officialAnswerText: '\\(50\\,\\mathrm{cm}^2\\)',
    explanation:
      'Áp dụng công thức diện tích hình thang: \\[S = \\frac{(a+b)\\cdot h}{2} = \\frac{(8+12)\\cdot 5}{2} = 50\\,\\mathrm{cm}^2.\\]',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
  {
    id: 'd06_sample_c2_30',
    code: 'D06-HH-30',
    type: 'single_choice',
    topic: D06_SAMPLE_TOPICS[2],
    points: 30,
    stem: 'Hình chữ nhật có chu vi \\(38\\,\\mathrm{cm}\\). Chiều dài hơn chiều rộng \\(3\\,\\mathrm{cm}\\). Diện tích bao nhiêu?',
    subject: 'Toán',
    grade: 'Khối 8',
    level: 'Vận dụng',
    options: [
      { id: 'c2_30_a', label: 'A', text: '\\(88\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_30_b', label: 'B', text: '\\(90\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_30_c', label: 'C', text: '\\(114\\,\\mathrm{cm}^2\\)' },
      { id: 'c2_30_d', label: 'D', text: '\\(72\\,\\mathrm{cm}^2\\)' },
    ],
    correctOptionId: 'c2_30_a',
    acceptedAnswers: ['88', '88cm2', '88 cm2'],
    officialAnswerText: '\\(88\\,\\mathrm{cm}^2\\)',
    explanation:
      'Nửa chu vi hình chữ nhật là \\(38 : 2 = 19\\,\\mathrm{cm}\\). Chiều rộng là \\((19-3):2 = 8\\,\\mathrm{cm}\\), chiều dài là \\(8+3 = 11\\,\\mathrm{cm}\\). Diện tích: \\[S = 11 \\times 8 = 88\\,\\mathrm{cm}^2.\\]',
    isSample: true,
    sourceBadge: D06_SAMPLE_BADGE,
  },
];

// ============================================================================
// TEAM FACTORY & CONFIG DEFAULTS
// ============================================================================

export function createDefaultKingTeams(mode: KingOfScoreMode, count = 3): KingTeamConfig[] {
  if (mode === 'solo') {
    return [{ id: 'solo_1', teamNumber: 1, name: 'Học sinh tự luyện', paletteIndex: 0 }];
  }
  if (mode === 'class_shared') {
    return [{ id: 'class_1', teamNumber: 1, name: 'Cả lớp', paletteIndex: 0 }];
  }
  const safeCount = Math.max(2, Math.min(6, Math.round(count)));
  return Array.from({ length: safeCount }, (_, idx) => ({
    id: `team_${idx + 1}`,
    teamNumber: idx + 1,
    name: `Đội ${String.fromCharCode(65 + idx)}`,
    paletteIndex: idx % KING_TEAM_PALETTES.length,
  }));
}

export function createDefaultKingConfig(mode: KingOfScoreMode = 'team'): KingMatchConfig {
  return {
    mode,
    teams: createDefaultKingTeams(mode, mode === 'team' ? 3 : 1),
    sourceKind: 'sample',
    subjectFilter: 'ALL',
    gradeFilter: 'ALL',
    randomStarter: false,
    timerEnabled: true,
    timerByPoints: { ...DEFAULT_TIMER_BY_POINTS },
    showOptionsInTeamMode: true,
    topicTitles: [...D06_SAMPLE_TOPICS] as [string, string, string],
    classSizeHint: 36,
  };
}

// ============================================================================
// SMART EDU BANK ADAPTER (RBAC + Explicit Level Classification, Zero Guessing)
// ============================================================================

function mapExplicitLevelToPoints(rawLevel?: string): KingOfScorePointValue | null {
  if (!rawLevel) return null;
  const norm = rawLevel.trim().toLowerCase();
  if (!norm) return null;
  if (
    norm === 'know' ||
    norm === 'nhận biết' ||
    norm === 'nhan biet' ||
    norm === 'dễ' ||
    norm === 'de' ||
    norm === 'easy' ||
    norm === 'nb'
  ) {
    return 10;
  }
  if (
    norm === 'understand' ||
    norm === 'thông hiểu' ||
    norm === 'thong hieu' ||
    norm === 'trung bình' ||
    norm === 'trung binh' ||
    norm === 'medium' ||
    norm === 'th'
  ) {
    return 20;
  }
  if (
    norm === 'apply' ||
    norm === 'vận dụng' ||
    norm === 'van dung' ||
    norm === 'vận dụng cao' ||
    norm === 'van dung cao' ||
    norm === 'khó' ||
    norm === 'kho' ||
    norm === 'hard' ||
    norm === 'vd' ||
    norm === 'vdc'
  ) {
    return 30;
  }
  return null;
}

function getOfficialAnswerFromBankQuestion(q: Question): {
  options?: KingQuestionOption[];
  correctOptionId?: string;
  acceptedAnswers?: string[];
  officialAnswerText: string;
} {
  if (q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2) {
    const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    const opts: KingQuestionOption[] = q.options.slice(0, 4).map((opt, idx) => ({
      id: opt.id || `${q.id}_opt_${idx}`,
      label: opt.label || labels[idx],
      text: opt.text,
    }));
    const targetRaw = (q.correctAnswer || '').trim();
    const chosen = opts.find(
      (o) =>
        o.id === targetRaw ||
        o.label.toUpperCase() === targetRaw.toUpperCase()
    );
    return {
      options: opts,
      correctOptionId: chosen?.id,
      officialAnswerText: chosen
        ? `${chosen.label}. ${chosen.text}`
        : q.correctAnswer || 'Theo đáp án giáo viên',
    };
  }

  if (q.type === 'true_false_group' && Array.isArray(q.subItems) && q.subItems.length > 0) {
    const summary = q.subItems
      .map((sq, idx) => `${sq.label || String.fromCharCode(97 + idx)}) ${sq.isCorrect ? 'Đúng' : 'Sai'}`)
      .join(' · ');
    return {
      officialAnswerText: summary,
    };
  }

  if (q.type === 'short_answer') {
    const accepted = Array.isArray(q.acceptedAnswers)
      ? q.acceptedAnswers.filter((s) => Boolean(s && s.trim()))
      : [];
    const primary = (q.correctAnswer || accepted[0] || '').trim();
    return {
      acceptedAnswers: accepted.length > 0 ? accepted : primary ? [primary] : [],
      officialAnswerText: primary || 'Theo đáp án giáo viên',
    };
  }

  return {
    officialAnswerText: (
      q.correctAnswer ||
      q.sampleAnswer ||
      q.explanation ||
      'Theo hướng dẫn chấm của giáo viên'
    ).trim(),
  };
}

export function isBankQuestionAccessible(
  q: Question,
  userRole: UserRole,
  currentUserId?: string
): boolean {
  if (!q || !q.id || !q.stem || !q.stem.trim()) return false;
  if (q.status === 'deprecated') return false;
  if (userRole === 'student') {
    return q.status === 'approved';
  }
  if (q.status === 'approved') return true;
  if (userRole === 'admin') return true;
  if (currentUserId && q.author === currentUserId) return true;
  return q.status === 'draft' || q.status === 'pending';
}

export function buildBankBoardCandidate(params: {
  bankQuestions: Question[];
  userRole: UserRole;
  currentUserId?: string;
  subjectFilter?: string;
  gradeFilter?: string;
  manualOverrides?: Record<string, string>; // tileId -> questionId chosen by teacher
}): BankBoardBuildResult {
  const {
    bankQuestions,
    userRole,
    currentUserId,
    subjectFilter = 'ALL',
    gradeFilter = 'ALL',
    manualOverrides = {},
  } = params;

  const seenIds = new Set<string>();
  const eligiblePool: KingQuestionItem[] = [];
  let unclassifiedCount = 0;

  for (const q of bankQuestions || []) {
    if (!isBankQuestionAccessible(q, userRole, currentUserId)) continue;
    if (seenIds.has(q.id)) continue;
    if (subjectFilter !== 'ALL' && q.subject !== subjectFilter) continue;
    if (gradeFilter !== 'ALL' && q.grade !== gradeFilter) continue;

    const explicitPts = mapExplicitLevelToPoints(q.level);
    if (!explicitPts) {
      unclassifiedCount++;
      continue; // Strict rule: NEVER guess difficulty if unclassified
    }

    seenIds.add(q.id);
    const ans = getOfficialAnswerFromBankQuestion(q);
    const topicName = (q.chapter || q.lesson || String(q.subject || 'Chủ đề chung')).trim();

    eligiblePool.push({
      id: q.id,
      code: q.code || q.id.slice(0, 8).toUpperCase(),
      type: q.type,
      topic: topicName,
      points: explicitPts,
      stem: q.stem.trim(),
      image: q.image,
      subject: String(q.subject || 'Khác'),
      grade: q.grade || '8',
      level: q.level || '',
      options: ans.options,
      correctOptionId: ans.correctOptionId,
      acceptedAnswers: ans.acceptedAnswers,
      officialAnswerText: ans.officialAnswerText,
      explanation: (q.explanation || 'Giáo viên đối chiếu và giải thích trực tiếp trên lớp.').trim(),
      isSample: false,
      sourceBadge: 'Ngân hàng Smart EDU',
    });
  }

  // Group distinct topic names by coverage
  const topicCounts = new Map<string, number>();
  for (const item of eligiblePool) {
    topicCounts.set(item.topic, (topicCounts.get(item.topic) ?? 0) + 1);
  }
  const rankedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
    .map(([topic]) => topic);

  const topicTitles: [string, string, string] = [
    rankedTopics[0] || 'Chủ đề 1',
    rankedTopics[1] || 'Chủ đề 2',
    rankedTopics[2] || 'Chủ đề 3',
  ];

  const poolById = new Map(eligiblePool.map((item) => [item.id, item]));
  const usedQuestionIds = new Set<string>();
  const slots: BankBoardSlotStatus[] = [];

  const levelLabels: Record<KingOfScorePointValue, string> = {
    10: 'Nhận biết (10 điểm)',
    20: 'Thông hiểu (20 điểm)',
    30: 'Vận dụng (30 điểm)',
  };

  // First pass: apply valid manual overrides (strictly no duplicates)
  const resolvedByTile = new Map<string, KingQuestionItem | null>();
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      const pts = KING_POINT_TIERS[row];
      const tileId = `c${col}_p${pts}`;
      const overrideId = manualOverrides[tileId];
      if (overrideId && poolById.has(overrideId) && !usedQuestionIds.has(overrideId)) {
        const picked = poolById.get(overrideId)!;
        usedQuestionIds.add(picked.id);
        resolvedByTile.set(tileId, { ...picked, points: pts, topic: topicTitles[col] });
      }
    }
  }

  // Second pass: fill remaining slots matching exact point tier (prefer matching topic first, then any unused of same explicit tier — NEVER repeating & NEVER guessing unclassified)
  for (let col = 0; col < 3; col++) {
    const colTopic = topicTitles[col];
    for (let row = 0; row < 3; row++) {
      const pts = KING_POINT_TIERS[row];
      const tileId = `c${col}_p${pts}`;
      let assigned = resolvedByTile.get(tileId) ?? null;

      if (!assigned) {
        const exactTopicMatch = eligiblePool.find(
          (q) => !usedQuestionIds.has(q.id) && q.points === pts && q.topic === colTopic
        );
        const sameTierMatch =
          exactTopicMatch ||
          eligiblePool.find((q) => !usedQuestionIds.has(q.id) && q.points === pts);

        if (sameTierMatch) {
          usedQuestionIds.add(sameTierMatch.id);
          assigned = { ...sameTierMatch, points: pts, topic: colTopic };
        }
      }

      slots.push({
        tileId,
        colIndex: col,
        rowIndex: row,
        topicTitle: colTopic,
        points: pts,
        expectedLevelLabel: levelLabels[pts],
        question: assigned,
      });
    }
  }

  const missingSlots = slots.filter((s) => !s.question);

  return {
    ready: missingSlots.length === 0 && slots.length === 9,
    topicTitles,
    slots,
    missingSlots,
    eligiblePool,
    unclassifiedCount,
  };
}

// ============================================================================
// PURE MATCH CREATION, SCORING RECOMPUTATION & RANKING
// ============================================================================

export function buildSampleBoardTiles(): KingBoardTile[] {
  const tiles: KingBoardTile[] = [];
  for (let col = 0; col < 3; col++) {
    const topicTitle = D06_SAMPLE_TOPICS[col];
    for (let row = 0; row < 3; row++) {
      const pts = KING_POINT_TIERS[row];
      const question = D06_SAMPLE_QUESTIONS.find(
        (q) => q.topic === topicTitle && q.points === pts
      );
      if (!question) {
        throw new Error(`Missing built-in sample question for ${topicTitle} (${pts})`);
      }
      tiles.push({
        tileId: `c${col}_p${pts}`,
        colIndex: col,
        rowIndex: row,
        topicTitle,
        points: pts,
        question,
        status: 'unplayed',
        pickerTeamId: null,
      });
    }
  }
  return tiles;
}

export function recomputeTeamRuntimeFromHistory(
  teams: KingTeamConfig[],
  settledHistory: KingTileSettlementRecord[]
): Record<string, KingTeamRuntime> {
  const runtime: Record<string, KingTeamRuntime> = {};
  for (const t of teams) {
    runtime[t.id] = {
      teamId: t.id,
      teamNumber: t.teamNumber,
      name: t.name,
      paletteIndex: t.paletteIndex,
      totalScore: 0,
      correctCount: 0,
      incorrectCount: 0,
      noAnswerCount: 0,
      tilesPicked: 0,
    };
  }

  for (const rec of settledHistory) {
    if (runtime[rec.pickerTeamId]) {
      runtime[rec.pickerTeamId].tilesPicked += 1;
    }
    for (const t of teams) {
      const verdict = rec.verdictsByTeam[t.id];
      const entry = runtime[t.id];
      if (!entry) continue;
      if (verdict === 'correct') {
        entry.totalScore += rec.points;
        entry.correctCount += 1;
      } else if (verdict === 'incorrect') {
        entry.incorrectCount += 1;
      } else if (verdict === 'no_answer') {
        entry.noAnswerCount += 1;
      }
    }
  }

  return runtime;
}

/**
 * Pure competition standings strictly sorted by totalScore descending.
 * Equal scores ALWAYS receive identical rank and isTied = true ("Đồng hạng").
 * Preserves teamNumber order only for deterministic display within a tie — never breaks ties.
 */
export function computeKingStandings(state: KingOfScoreState): KingStandingRow[] {
  const entries = state.config.teams.map((t) => {
    const rt = state.teamRuntime[t.id] || {
      teamId: t.id,
      teamNumber: t.teamNumber,
      name: t.name,
      paletteIndex: t.paletteIndex,
      totalScore: 0,
      correctCount: 0,
      incorrectCount: 0,
      noAnswerCount: 0,
      tilesPicked: 0,
    };
    return rt;
  });

  const sorted = [...entries].sort(
    (a, b) => b.totalScore - a.totalScore || a.teamNumber - b.teamNumber
  );

  // Assign standard competition rank (1, 1, 3...)
  const scoreFreq = new Map<number, number>();
  for (const row of sorted) {
    scoreFreq.set(row.totalScore, (scoreFreq.get(row.totalScore) ?? 0) + 1);
  }

  let currentRank = 1;
  return sorted.map((row, idx) => {
    if (idx > 0 && row.totalScore < sorted[idx - 1].totalScore) {
      currentRank = idx + 1;
    }
    const isTied = (scoreFreq.get(row.totalScore) ?? 0) > 1;
    return {
      teamId: row.teamId,
      teamNumber: row.teamNumber,
      name: row.name,
      paletteIndex: row.paletteIndex,
      totalScore: row.totalScore,
      correctCount: row.correctCount,
      incorrectCount: row.incorrectCount,
      noAnswerCount: row.noAnswerCount,
      rank: currentRank,
      isTied,
      rankLabel: isTied ? `Đồng hạng ${currentRank}` : `Hạng ${currentRank}`,
    };
  });
}

export function createKingOfScoreMatch(params: {
  config: KingMatchConfig;
  customTiles?: KingBoardTile[];
  randomFn?: () => number;
}): KingOfScoreState {
  const { config, customTiles, randomFn = Math.random } = params;
  const sanitizedTeams = config.teams.map((t, idx) => ({
    ...t,
    teamNumber: idx + 1,
    name: t.name.trim() || (config.mode === 'team' ? `Đội ${String.fromCharCode(65 + idx)}` : config.mode === 'solo' ? 'Học sinh tự luyện' : 'Cả lớp'),
  }));

  const tiles: KingBoardTile[] =
    customTiles && customTiles.length === 9
      ? customTiles.map((tile) => ({
          ...tile,
          status: 'unplayed',
          pickerTeamId: null,
        }))
      : buildSampleBoardTiles();

  const topicTitles: [string, string, string] = [
    tiles.find((t) => t.colIndex === 0)?.topicTitle || config.topicTitles[0] || D06_SAMPLE_TOPICS[0],
    tiles.find((t) => t.colIndex === 1)?.topicTitle || config.topicTitles[1] || D06_SAMPLE_TOPICS[1],
    tiles.find((t) => t.colIndex === 2)?.topicTitle || config.topicTitles[2] || D06_SAMPLE_TOPICS[2],
  ];

  // Random starter determined ONCE at match creation; otherwise index 0
  const startingPickerIndex =
    config.mode === 'team' && config.randomStarter && sanitizedTeams.length > 1
      ? Math.floor(Math.max(0, Math.min(0.999999, randomFn())) * sanitizedTeams.length)
      : 0;

  const maxPossibleScore = tiles.reduce((sum, tile) => sum + tile.points, 0);

  const normalizedConfig: KingMatchConfig = {
    ...config,
    teams: sanitizedTeams,
    topicTitles,
  };

  return {
    config: normalizedConfig,
    topicTitles,
    tiles,
    startingPickerIndex,
    currentPickerIndex: startingPickerIndex,
    activeTileId: null,
    phase: 'board',
    draftVerdicts: {},
    draftAnswerNotes: {},
    draftSelectedOptions: {},
    answerRevealed: false,
    settledHistory: [],
    teamRuntime: recomputeTeamRuntimeFromHistory(sanitizedTeams, []),
    lastSettledTileId: null,
    canEditLastTile: false,
    status: 'playing',
    endedEarly: false,
    maxPossibleScore,
  };
}

// ============================================================================
// TURN OPERATIONS (OPEN TILE -> STOP/GRADE -> REVEAL -> SETTLE -> EDIT -> NEXT)
// ============================================================================

export function getCurrentPickerTeam(state: KingOfScoreState): KingTeamConfig {
  const teams = state.config.teams;
  const idx = Math.max(0, Math.min(teams.length - 1, state.currentPickerIndex));
  return teams[idx];
}

export function getActiveTile(state: KingOfScoreState): KingBoardTile | null {
  if (!state.activeTileId) return null;
  return state.tiles.find((t) => t.tileId === state.activeTileId) ?? null;
}

export function getTimerSecondsForTile(
  config: KingMatchConfig,
  points: KingOfScorePointValue
): number {
  if (!config.timerEnabled) return 0;
  return Math.max(0, Math.round(config.timerByPoints[points] ?? DEFAULT_TIMER_BY_POINTS[points]));
}

export function openBoardTile(
  state: KingOfScoreState,
  tileId: string
): { state: KingOfScoreState; opened: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { state, opened: false, reason: 'Trận đấu đã kết thúc.' };
  }
  if (state.phase !== 'board' || state.activeTileId !== null) {
    return { state, opened: false, reason: 'Đang có ô câu hỏi mở, không thể mở ô khác.' };
  }
  const target = state.tiles.find((t) => t.tileId === tileId);
  if (!target) {
    return { state, opened: false, reason: 'Không tìm thấy ô đã chọn.' };
  }
  if (target.status !== 'unplayed') {
    return {
      state,
      opened: false,
      reason: 'Ô này đã chơi và đã khóa điểm. Chỉ có thể đọc lại trong mục Xem lại lời giải.',
    };
  }

  const picker = getCurrentPickerTeam(state);
  const initialVerdicts: Record<string, KingOfScoreVerdict> = {};
  const initialNotes: Record<string, string> = {};
  const initialOptions: Record<string, string> = {};
  for (const t of state.config.teams) {
    initialVerdicts[t.id] = 'ungraded';
    initialNotes[t.id] = '';
    initialOptions[t.id] = '';
  }

  const nextTiles: KingBoardTile[] = state.tiles.map((t) =>
    t.tileId === tileId
      ? { ...t, status: 'playing', pickerTeamId: picker.id }
      : t
  );

  return {
    opened: true,
    state: {
      ...state,
      tiles: nextTiles,
      activeTileId: tileId,
      phase: 'thinking',
      draftVerdicts: initialVerdicts,
      draftAnswerNotes: initialNotes,
      draftSelectedOptions: initialOptions,
      answerRevealed: false,
      // Opening a new tile locks editing of any previous tile
      canEditLastTile: false,
    },
  };
}

/**
 * Step 3: Teacher clicks "Dừng trả lời" or timer reaches 0 -> transitions to grading phase.
 * Answers written before deadline remain gradable.
 */
export function stopAnsweringAndBeginGrading(state: KingOfScoreState): KingOfScoreState {
  if (state.status !== 'playing' || state.phase !== 'thinking' || !state.activeTileId) {
    return state;
  }
  return {
    ...state,
    phase: 'grading',
  };
}

/**
 * Step 4: Set verdict for a single team ("Đúng", "Chưa đúng", "Không trả lời", or back to "Chưa chấm").
 */
export function setTeamDraftVerdict(
  state: KingOfScoreState,
  teamId: string,
  verdict: KingOfScoreVerdict
): KingOfScoreState {
  if (state.status !== 'playing' || (state.phase !== 'grading' && state.phase !== 'thinking')) {
    return state;
  }
  if (!state.config.teams.some((t) => t.id === teamId)) return state;
  return {
    ...state,
    draftVerdicts: {
      ...state.draftVerdicts,
      [teamId]: verdict,
    },
  };
}

/**
 * Optional helper for entering a team's written/selected MCQ answer (compares by stable option ID, never rendered HTML).
 */
export function setTeamDraftOptionChoice(
  state: KingOfScoreState,
  teamId: string,
  optionId: string
): KingOfScoreState {
  const tile = getActiveTile(state);
  if (!tile || state.status !== 'playing' || (state.phase !== 'grading' && state.phase !== 'thinking')) {
    return state;
  }
  const hasOption = Boolean(tile.question.options?.some((o) => o.id === optionId));
  if (!hasOption) return state;

  const isCorrect = Boolean(tile.question.correctOptionId && tile.question.correctOptionId === optionId);
  return {
    ...state,
    draftSelectedOptions: {
      ...state.draftSelectedOptions,
      [teamId]: optionId,
    },
    draftVerdicts: {
      ...state.draftVerdicts,
      [teamId]: isCorrect ? 'correct' : 'incorrect',
    },
  };
}

export function setTeamDraftAnswerNote(
  state: KingOfScoreState,
  teamId: string,
  note: string
): KingOfScoreState {
  if (!state.config.teams.some((t) => t.id === teamId)) return state;
  return {
    ...state,
    draftAnswerNotes: {
      ...state.draftAnswerNotes,
      [teamId]: note,
    },
  };
}

/**
 * Step 5: Reveal official answer & explanation once teams have stopped answering.
 */
export function revealActiveAnswer(state: KingOfScoreState): KingOfScoreState {
  if (state.status !== 'playing' || !state.activeTileId) return state;
  return {
    ...state,
    phase: state.phase === 'thinking' ? 'grading' : state.phase,
    answerRevealed: true,
  };
}

export function areAllTeamsGraded(state: KingOfScoreState): boolean {
  return state.config.teams.every((t) => {
    const v = state.draftVerdicts[t.id];
    return v === 'correct' || v === 'incorrect' || v === 'no_answer';
  });
}

export function getPreviewPointsByTeam(state: KingOfScoreState): Record<string, number> {
  const tile = getActiveTile(state);
  const pts = tile?.points ?? 0;
  const out: Record<string, number> = {};
  for (const t of state.config.teams) {
    out[t.id] = state.draftVerdicts[t.id] === 'correct' ? pts : 0;
  }
  return out;
}

/**
 * Step 6: Confirm & commit the active tile ONCE.
 * - Strictly blocked if any team is still 'ungraded'.
 * - Strictly idempotent: if `tileId` is already in `settledHistory`, returns unchanged state with `committed: false`.
 * - Advances picker turn strictly by +1 (modulo teams.length).
 * - Stays in phase === 'settled' so teacher can explain then actively click "Quay về bảng chọn ô".
 */
export function confirmTileSettlement(
  state: KingOfScoreState,
  nowMs = Date.now()
): { state: KingOfScoreState; committed: boolean; scorersCount: number; reason?: string } {
  if (state.status !== 'playing' || !state.activeTileId) {
    return { state, committed: false, scorersCount: 0, reason: 'Không có ô đang mở.' };
  }
  if (state.phase === 'settled') {
    return { state, committed: false, scorersCount: 0, reason: 'Ô này đã được xác nhận.' };
  }
  const tile = getActiveTile(state);
  if (!tile) {
    return { state, committed: false, scorersCount: 0, reason: 'Không tìm thấy ô đang mở.' };
  }
  // Idempotency guard against double-click
  if (state.settledHistory.some((rec) => rec.tileId === tile.tileId)) {
    return { state, committed: false, scorersCount: 0, reason: 'Ô này đã được chấm trước đó.' };
  }
  if (!areAllTeamsGraded(state)) {
    return {
      state,
      committed: false,
      scorersCount: 0,
      reason: 'Cần chấm đủ tất cả các đội (không còn trạng thái Chưa chấm) trước khi xác nhận.',
    };
  }

  const verdictsByTeam: Record<string, KingOfScoreVerdict> = {};
  const pointsAwardedByTeam: Record<string, number> = {};
  let scorersCount = 0;

  for (const t of state.config.teams) {
    const v = state.draftVerdicts[t.id];
    verdictsByTeam[t.id] = v;
    const pts = v === 'correct' ? tile.points : 0;
    pointsAwardedByTeam[t.id] = pts;
    if (pts > 0) scorersCount += 1;
  }

  const record: KingTileSettlementRecord = {
    tileId: tile.tileId,
    colIndex: tile.colIndex,
    rowIndex: tile.rowIndex,
    topicTitle: tile.topicTitle,
    points: tile.points,
    questionId: tile.question.id,
    questionCode: tile.question.code,
    questionStem: tile.question.stem,
    officialAnswerText: tile.question.officialAnswerText,
    explanation: tile.question.explanation,
    pickerTeamId: tile.pickerTeamId || getCurrentPickerTeam(state).id,
    verdictsByTeam,
    pointsAwardedByTeam,
    answerNotesByTeam: { ...state.draftAnswerNotes },
    selectedOptionIdByTeam: { ...state.draftSelectedOptions },
    settledAt: nowMs,
    wasEdited: false,
  };

  const nextHistory = [...state.settledHistory, record];
  const nextTiles: KingBoardTile[] = state.tiles.map((t) =>
    t.tileId === tile.tileId ? { ...t, status: 'played' } : t
  );
  const nextRuntime = recomputeTeamRuntimeFromHistory(state.config.teams, nextHistory);
  const nextPickerIndex =
    state.config.teams.length > 0
      ? (state.currentPickerIndex + 1) % state.config.teams.length
      : 0;

  return {
    committed: true,
    scorersCount,
    state: {
      ...state,
      tiles: nextTiles,
      phase: 'settled',
      answerRevealed: true,
      settledHistory: nextHistory,
      teamRuntime: nextRuntime,
      currentPickerIndex: nextPickerIndex,
      lastSettledTileId: tile.tileId,
      canEditLastTile: true,
    },
  };
}

/**
 * Teacher actively returns from a settled tile to the board (or finishes match if all 9 tiles played).
 */
export function returnToBoardAfterSettlement(state: KingOfScoreState): KingOfScoreState {
  if (state.status !== 'playing' || state.phase !== 'settled') {
    return state;
  }
  const allPlayed = state.tiles.every((t) => t.status === 'played');
  if (allPlayed) {
    return {
      ...state,
      activeTileId: null,
      phase: 'board',
      status: 'finished',
      endedEarly: false,
      canEditLastTile: false,
    };
  }
  return {
    ...state,
    activeTileId: null,
    phase: 'board',
    answerRevealed: false,
    // Teacher may still edit the just-settled tile from the board BEFORE opening the next tile
    canEditLastTile: Boolean(state.lastSettledTileId),
  };
}

/**
 * Edit the result of the MOST RECENTLY settled tile BEFORE opening the next tile or finalizing summary.
 * Recomputes ALL scores strictly from settledHistory and NEVER advances `currentPickerIndex` again.
 */
export function editLastSettledTileVerdicts(
  state: KingOfScoreState,
  updatedVerdicts: Record<string, KingOfScoreVerdict>,
  nowMs = Date.now()
): { state: KingOfScoreState; edited: boolean; reason?: string } {
  if (state.status !== 'playing') {
    return { state, edited: false, reason: 'Không thể sửa sau khi trận đấu đã chốt tổng kết.' };
  }
  if (!state.canEditLastTile || !state.lastSettledTileId) {
    return {
      state,
      edited: false,
      reason: 'Chỉ có thể sửa kết quả ô vừa chấm trước khi mở ô kế tiếp.',
    };
  }
  if (state.phase === 'thinking' || state.phase === 'grading') {
    return {
      state,
      edited: false,
      reason: 'Đang mở ô kế tiếp, không thể sửa ô trước đó.',
    };
  }

  const allGraded = state.config.teams.every((t) => {
    const v = updatedVerdicts[t.id];
    return v === 'correct' || v === 'incorrect' || v === 'no_answer';
  });
  if (!allGraded) {
    return {
      state,
      edited: false,
      reason: 'Tất cả đội phải có trạng thái Đúng, Chưa đúng hoặc Không trả lời.',
    };
  }

  const targetIdx = state.settledHistory.findIndex((r) => r.tileId === state.lastSettledTileId);
  if (targetIdx < 0) {
    return { state, edited: false, reason: 'Không tìm thấy lịch sử ô vừa chấm.' };
  }

  const oldRec = state.settledHistory[targetIdx];
  const pointsAwardedByTeam: Record<string, number> = {};
  const cleanVerdicts: Record<string, KingOfScoreVerdict> = {};
  for (const t of state.config.teams) {
    const v = updatedVerdicts[t.id];
    cleanVerdicts[t.id] = v;
    pointsAwardedByTeam[t.id] = v === 'correct' ? oldRec.points : 0;
  }

  const nextHistory = state.settledHistory.map((rec, idx) =>
    idx === targetIdx
      ? {
          ...rec,
          verdictsByTeam: cleanVerdicts,
          pointsAwardedByTeam,
          settledAt: nowMs,
          wasEdited: true,
        }
      : rec
  );

  const nextRuntime = recomputeTeamRuntimeFromHistory(state.config.teams, nextHistory);

  return {
    edited: true,
    state: {
      ...state,
      settledHistory: nextHistory,
      teamRuntime: nextRuntime,
      draftVerdicts: state.activeTileId === oldRec.tileId ? cleanVerdicts : state.draftVerdicts,
      // Explicitly preserve currentPickerIndex — NEVER rotate an extra time on edit!
      currentPickerIndex: state.currentPickerIndex,
    },
  };
}

/**
 * Early finish before all 9 tiles are settled.
 * Unsettled active tile (if any) reverts to 'unplayed' so only genuinely settled tiles count.
 */
export function finishMatchEarly(state: KingOfScoreState): KingOfScoreState {
  if (state.status !== 'playing') return state;
  const cleanedTiles: KingBoardTile[] = state.tiles.map((t) =>
    t.status === 'playing' ? { ...t, status: 'unplayed', pickerTeamId: null } : t
  );
  const allPlayed = cleanedTiles.every((t) => t.status === 'played');
  return {
    ...state,
    tiles: cleanedTiles,
    activeTileId: null,
    phase: 'board',
    status: allPlayed ? 'finished' : 'ended_early',
    endedEarly: !allPlayed,
    canEditLastTile: false,
  };
}

// ============================================================================
// DEMO-ISOLATED SESSION PERSISTENCE (With Corrupt JSON Recovery)
// ============================================================================

export interface KingPersistedSession {
  version: number;
  savedAt: number;
  state: KingOfScoreState;
  remainingSeconds: number;
  timerPaused: boolean;
}

export function getD06StorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D06_SESSION_STORAGE_KEY}`
    : D06_SESSION_STORAGE_KEY;
}

export function saveD06Session(
  state: KingOfScoreState,
  remainingSeconds: number,
  timerPaused: boolean
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: KingPersistedSession = {
      version: D06_SESSION_VERSION,
      savedAt: Date.now(),
      state,
      remainingSeconds: Math.max(0, Math.round(remainingSeconds)),
      timerPaused: Boolean(timerPaused),
    };
    window.localStorage.setItem(getD06StorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function loadD06Session(): KingPersistedSession | null {
  if (typeof window === 'undefined') return null;
  const key = getD06StorageKey();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KingPersistedSession>;
    if (
      !parsed ||
      parsed.version !== D06_SESSION_VERSION ||
      !parsed.state ||
      !parsed.state.config ||
      !Array.isArray(parsed.state.config.teams) ||
      parsed.state.config.teams.length === 0 ||
      !Array.isArray(parsed.state.tiles) ||
      parsed.state.tiles.length !== 9 ||
      !Array.isArray(parsed.state.settledHistory)
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    // Recompute authoritative runtime from settledHistory on restore
    const recomputedRuntime = recomputeTeamRuntimeFromHistory(
      parsed.state.config.teams,
      parsed.state.settledHistory
    );

    const restoredState: KingOfScoreState = {
      ...parsed.state,
      teamRuntime: recomputedRuntime,
      currentPickerIndex: Math.max(
        0,
        Math.min(parsed.state.config.teams.length - 1, Number(parsed.state.currentPickerIndex) || 0)
      ),
    };

    return {
      version: D06_SESSION_VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      state: restoredState,
      remainingSeconds:
        typeof parsed.remainingSeconds === 'number' && Number.isFinite(parsed.remainingSeconds)
          ? Math.max(0, Math.round(parsed.remainingSeconds))
          : 0,
      timerPaused: Boolean(parsed.timerPaused),
    };
  } catch {
    // Corrupt JSON recovery
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    return null;
  }
}

export function clearD06Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD06StorageKey());
  } catch {
    // Ignore
  }
}
