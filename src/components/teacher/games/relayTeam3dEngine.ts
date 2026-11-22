/**
 * D05 — TIẾP SỨC ĐỒNG ĐỘI 3D (Tây Đô Smart EDU)
 * Pure deterministic relay engine:
 * - Modes: 'team_relay' (2–6 teams), 'class_relay' (1 team whole class), 'solo_practice' (1 student)
 * - Strict separation of "Lượt đã hoàn thành" (turnsCompleted) and "Điểm kiến thức" (+10 per correct, 0 otherwise)
 * - Deterministic baton rotation (advances after every confirmed turn right/wrong, wraps around to member 0)
 * - Pre-turn absentee skipping (absent students are NEVER marked wrong; runner is locked once question opens)
 * - Edit-last-confirmed-turn recalculation (recomputes scores cleanly while keeping exactly 1 baton pass)
 * - Tie-aware competition ranking ("Đồng hạng"), double-click idempotency, Math LaTeX sample pack ("Tiếp sức Toán THCS")
 * - Smart EDU RBAC question bank adapter & demo-safe persistence
 */

import { Question, QuestionType, UserRole } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export type RelayMode = 'team_relay' | 'class_relay' | 'solo_practice';

export type RelayVerdict = 'ungraded' | 'correct' | 'incorrect' | 'no_answer';

export type RelayMatchStatus = 'playing' | 'finished' | 'ended_early';

export type RelayQuestionSource = 'sample' | 'bank';

export interface RelayTeamPalette {
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

export const RELAY_TEAM_PALETTES: RelayTeamPalette[] = [
  {
    id: 'blue',
    label: 'Xanh dương',
    hex: '#2563EB',
    hexNum: 0x2563eb,
    accentHex: '#93C5FD',
    accentNum: 0x93c5fd,
    bgClass: 'bg-blue-950/45',
    borderClass: 'border-blue-500/60',
    textClass: 'text-blue-200',
    badgeClass: 'bg-blue-600 text-white',
  },
  {
    id: 'orange',
    label: 'Cam rực',
    hex: '#EA580C',
    hexNum: 0xea580c,
    accentHex: '#FDBA74',
    accentNum: 0xfdba74,
    bgClass: 'bg-orange-950/40',
    borderClass: 'border-orange-500/60',
    textClass: 'text-orange-200',
    badgeClass: 'bg-orange-600 text-white',
  },
  {
    id: 'emerald',
    label: 'Xanh ngọc',
    hex: '#059669',
    hexNum: 0x059669,
    accentHex: '#6EE7B7',
    accentNum: 0x6ee7b7,
    bgClass: 'bg-emerald-950/40',
    borderClass: 'border-emerald-500/60',
    textClass: 'text-emerald-200',
    badgeClass: 'bg-emerald-600 text-white',
  },
  {
    id: 'amber',
    label: 'Vàng đồng',
    hex: '#D97706',
    hexNum: 0xd97706,
    accentHex: '#FDE68A',
    accentNum: 0xfde68a,
    bgClass: 'bg-amber-950/40',
    borderClass: 'border-amber-500/60',
    textClass: 'text-amber-200',
    badgeClass: 'bg-amber-600 text-slate-950',
  },
  {
    id: 'violet',
    label: 'Tím chàm',
    hex: '#7C3AED',
    hexNum: 0x7c3aed,
    accentHex: '#C4B5FD',
    accentNum: 0xc4b5fd,
    bgClass: 'bg-violet-950/40',
    borderClass: 'border-violet-500/60',
    textClass: 'text-violet-200',
    badgeClass: 'bg-violet-600 text-white',
  },
  {
    id: 'rose',
    label: 'Đỏ san hô',
    hex: '#E11D48',
    hexNum: 0xe11d48,
    accentHex: '#FDA4AF',
    accentNum: 0xfda4af,
    bgClass: 'bg-rose-950/40',
    borderClass: 'border-rose-500/60',
    textClass: 'text-rose-200',
    badgeClass: 'bg-rose-600 text-white',
  },
];

export const POINTS_PER_CORRECT = 10;
export const D05_SAMPLE_PACK_TITLE = 'Tiếp sức Toán THCS';
export const D05_SAMPLE_BADGE = 'Dữ liệu mẫu';
export const D05_SESSION_STORAGE_KEY = 'taydo_d05_relay_team_session_v1';
export const D05_SESSION_VERSION = 1;

export interface RelayMember {
  id: string;
  name: string;
}

export interface RelayTeamConfig {
  id: string;
  name: string;
  paletteIndex: number;
  members: RelayMember[];
}

export interface RelayQuestionOption {
  id: string; // Stable option ID (never tied to array index)
  label: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface RelayTrueFalseItem {
  id: string;
  label: 'a' | 'b' | 'c' | 'd';
  text: string;
  isCorrect: boolean;
}

export interface RelayQuestionItem {
  id: string;
  code: string;
  type: QuestionType;
  stem: string;
  image?: string;
  subject: string;
  grade: string;
  level: string;
  options?: RelayQuestionOption[];
  correctOptionId?: string;
  subItems?: RelayTrueFalseItem[];
  acceptedAnswers?: string[];
  isNumericTolerance?: boolean;
  numericTolerance?: number;
  officialAnswerText: string;
  explanation: string;
  isSample: boolean;
  sourceBadge: string;
  requiresTeacherGrading: boolean;
}

export interface RelayMatchConfig {
  mode: RelayMode;
  teams: RelayTeamConfig[];
  sourceKind: RelayQuestionSource;
  subjectFilter: string;
  gradeFilter: string;
  levelFilter: string;
  questionCount: number;
  timerSeconds: number; // Default 30s; 0 = unlimited
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  rulesLocked: boolean;
}

export interface RelayTeamTurnOutcome {
  teamId: string;
  runnerMemberId: string;
  runnerName: string;
  runnerIndexBefore: number;
  runnerIndexAfter: number;
  verdict: RelayVerdict;
  pointsAwarded: number;
  answerNote?: string;
}

export interface RelayAbsentSkipLog {
  teamId: string;
  memberId: string;
  memberName: string;
  beforeQuestionIndex: number;
  skippedAt: number;
}

export interface RelayTurnRecord {
  turnIndex: number;
  questionId: string;
  questionCode: string;
  questionStem: string;
  officialAnswerText: string;
  explanation: string;
  teamOutcomes: Record<string, RelayTeamTurnOutcome>;
  resultSource: 'teacher_single_device' | 'student_auto';
  committedAt: number;
  wasEdited?: boolean;
}

export interface RelayTeamRuntimeState {
  teamId: string;
  name: string;
  paletteIndex: number;
  members: RelayMember[];
  currentMemberIndex: number;
  score: number;
  correctCount: number;
  turnsCompleted: number;
  absentSkipCount: number;
}

export interface RelayMatchState {
  config: RelayMatchConfig;
  questionOrder: RelayQuestionItem[];
  teamRuntime: Record<string, RelayTeamRuntimeState>;
  history: RelayTurnRecord[];
  absentSkipLogs: RelayAbsentSkipLog[];
  currentQuestionIndex: number;
  status: RelayMatchStatus;
  endedEarly: boolean;
}

export interface RelayTeamStanding {
  teamId: string;
  name: string;
  paletteIndex: number;
  score: number;
  correctCount: number;
  turnsCompleted: number;
  memberCount: number;
  rank: number;
  isTied: boolean;
}

export interface RelayConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveQuestionCount: number;
  maxTeamSize: number;
}

const OPTION_LABELS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];

// ============================================================================
// SAMPLE QUESTION PACK (10 QUESTIONS — "Tiếp sức Toán THCS" WITH KATEX MATH)
// Contains ALL 5 mandatory prompt cases verbatim + 5 rich THCS Math items
// ============================================================================

export const D05_SAMPLE_QUESTIONS: RelayQuestionItem[] = [
  {
    id: 'd05_sample_01',
    code: 'D05-M01',
    type: 'single_choice',
    stem: 'Tính giá trị của phép trừ phân số: \\(\\frac{3}{4} - \\frac{1}{2}\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd05_s01_a', label: 'A', text: '\\(\\frac{1}{4}\\)' },
      { id: 'd05_s01_b', label: 'B', text: '\\(\\frac{1}{2}\\)' },
      { id: 'd05_s01_c', label: 'C', text: '\\(\\frac{2}{2}\\)' },
      { id: 'd05_s01_d', label: 'D', text: '\\(\\frac{1}{8}\\)' },
    ],
    correctOptionId: 'd05_s01_a',
    acceptedAnswers: ['1/4', '0.25', '0,25'],
    officialAnswerText: '\\(\\frac{1}{4}\\)',
    explanation:
      'Quy đồng mẫu số chung là \\(4\\): \\(\\frac{1}{2} = \\frac{2}{4}\\). Khi đó \\(\\frac{3}{4} - \\frac{1}{2} = \\frac{3}{4} - \\frac{2}{4} = \\frac{1}{4}\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_02',
    code: 'D05-M02',
    type: 'single_choice',
    stem: 'Tính giá trị của lũy thừa: \\((-3)^2\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd05_s02_a', label: 'A', text: '\\(-9\\)' },
      { id: 'd05_s02_b', label: 'B', text: '\\(9\\)' },
      { id: 'd05_s02_c', label: 'C', text: '\\(-6\\)' },
      { id: 'd05_s02_d', label: 'D', text: '\\(6\\)' },
    ],
    correctOptionId: 'd05_s02_b',
    acceptedAnswers: ['9', '+9'],
    officialAnswerText: '\\(9\\)',
    explanation:
      'Vì có dấu ngoặc bao quanh cả dấu âm nên \\((-3)^2 = (-3) \\cdot (-3) = 9\\). Lưu ý phân biệt với \\(-3^2 = -9\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_03',
    code: 'D05-M03',
    type: 'single_choice',
    stem: 'Tính giá trị của căn bậc hai số học: \\(\\sqrt{(-5)^2}\\).',
    subject: 'math',
    grade: '9',
    level: 'understand',
    options: [
      { id: 'd05_s03_a', label: 'A', text: '\\(-5\\)' },
      { id: 'd05_s03_b', label: 'B', text: '\\(25\\)' },
      { id: 'd05_s03_c', label: 'C', text: '\\(5\\)' },
      { id: 'd05_s03_d', label: 'D', text: '\\(\\pm 5\\)' },
    ],
    correctOptionId: 'd05_s03_c',
    acceptedAnswers: ['5'],
    officialAnswerText: '\\(5\\)',
    explanation:
      'Áp dụng hằng đẳng thức \\(\\sqrt{a^2} = |a|\\), ta có \\(\\sqrt{(-5)^2} = |-5| = 5\\) (hoặc \\(\\sqrt{25} = 5\\)).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_04',
    code: 'D05-M04',
    type: 'single_choice',
    stem: 'Tìm nghiệm của phương trình bậc nhất: \\(2x + 3 = 11\\).',
    subject: 'math',
    grade: '8',
    level: 'know',
    options: [
      { id: 'd05_s04_a', label: 'A', text: '\\(x = 7\\)' },
      { id: 'd05_s04_b', label: 'B', text: '\\(x = 4\\)' },
      { id: 'd05_s04_c', label: 'C', text: '\\(x = 3\\)' },
      { id: 'd05_s04_d', label: 'D', text: '\\(x = 8\\)' },
    ],
    correctOptionId: 'd05_s04_b',
    acceptedAnswers: ['4', 'x=4', 'x = 4'],
    officialAnswerText: '\\(x = 4\\)',
    explanation:
      'Chuyển vế và chia hai vế cho \\(2\\): \\(2x = 11 - 3 = 8 \\Rightarrow x = \\frac{8}{2} = 4\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_05',
    code: 'D05-M05',
    type: 'single_choice',
    stem: 'Tung một xúc xắc cân đối sáu mặt. Xác suất xuất hiện số chẵn là bao nhiêu?',
    subject: 'math',
    grade: '8',
    level: 'understand',
    options: [
      { id: 'd05_s05_a', label: 'A', text: '\\(\\frac{1}{6}\\)' },
      { id: 'd05_s05_b', label: 'B', text: '\\(\\frac{1}{3}\\)' },
      { id: 'd05_s05_c', label: 'C', text: '\\(\\frac{1}{2}\\)' },
      { id: 'd05_s05_d', label: 'D', text: '\\(\\frac{2}{3}\\)' },
    ],
    correctOptionId: 'd05_s05_c',
    acceptedAnswers: ['1/2', '3/6', '0.5', '0,5'],
    officialAnswerText: '\\(\\frac{3}{6} = \\frac{1}{2}\\)',
    explanation:
      'Xúc xắc có \\(6\\) kết quả đồng khả năng \\(\\{1; 2; 3; 4; 5; 6\\}\\), trong đó có \\(3\\) số chẵn là \\(2, 4, 6\\). Xác suất là \\(\\frac{3}{6} = \\frac{1}{2}\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_06',
    code: 'D05-M06',
    type: 'single_choice',
    stem: 'Tính giá trị biểu thức số thập phân: \\(2{,}5 \\times 4 - 1{,}5\\).',
    subject: 'math',
    grade: '6',
    level: 'know',
    options: [
      { id: 'd05_s06_a', label: 'A', text: '\\(8{,}5\\)' },
      { id: 'd05_s06_b', label: 'B', text: '\\(6{,}25\\)' },
      { id: 'd05_s06_c', label: 'C', text: '\\(9{,}5\\)' },
      { id: 'd05_s06_d', label: 'D', text: '\\(7{,}5\\)' },
    ],
    correctOptionId: 'd05_s06_a',
    acceptedAnswers: ['8,5', '8.5'],
    officialAnswerText: '\\(8{,}5\\)',
    explanation:
      'Thực hiện phép nhân trước: \\(2{,}5 \\times 4 = 10\\). Sau đó trừ: \\(10 - 1{,}5 = 8{,}5\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_07',
    code: 'D05-M07',
    type: 'single_choice',
    stem: 'Rút gọn biểu thức đại số: \\(3(x - 2) + 2x\\).',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'd05_s07_a', label: 'A', text: '\\(5x - 2\\)' },
      { id: 'd05_s07_b', label: 'B', text: '\\(5x - 6\\)' },
      { id: 'd05_s07_c', label: 'C', text: '\\(5x + 6\\)' },
      { id: 'd05_s07_d', label: 'D', text: '\\(x - 6\\)' },
    ],
    correctOptionId: 'd05_s07_b',
    acceptedAnswers: ['5x-6', '5x - 6'],
    officialAnswerText: '\\(5x - 6\\)',
    explanation:
      'Nhân phân phối rồi cộng các hạng tử đồng dạng: \\(3(x - 2) + 2x = 3x - 6 + 2x = 5x - 6\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_08',
    code: 'D05-M08',
    type: 'single_choice',
    stem: 'Trong tam giác \\(ABC\\), biết \\(\\widehat{A} = 65^\\circ\\) và \\(\\widehat{B} = 55^\\circ\\). Số đo \\(\\widehat{C}\\) là bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'd05_s08_a', label: 'A', text: '\\(50^\\circ\\)' },
      { id: 'd05_s08_b', label: 'B', text: '\\(60^\\circ\\)' },
      { id: 'd05_s08_c', label: 'C', text: '\\(70^\\circ\\)' },
      { id: 'd05_s08_d', label: 'D', text: '\\(120^\\circ\\)' },
    ],
    correctOptionId: 'd05_s08_b',
    acceptedAnswers: ['60', '60°', '60 độ'],
    officialAnswerText: '\\(60^\\circ\\)',
    explanation:
      'Tổng ba góc trong một tam giác bằng \\(180^\\circ\\). Vậy \\(\\widehat{C} = 180^\\circ - (65^\\circ + 55^\\circ) = 180^\\circ - 120^\\circ = 60^\\circ\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_09',
    code: 'D05-M09',
    type: 'single_choice',
    stem: 'Một hình vuông có diện tích bằng \\(49\\text{ cm}^2\\). Chu vi của hình vuông đó bằng bao nhiêu?',
    subject: 'math',
    grade: '7',
    level: 'understand',
    options: [
      { id: 'd05_s09_a', label: 'A', text: '\\(14\\text{ cm}\\)' },
      { id: 'd05_s09_b', label: 'B', text: '\\(28\\text{ cm}\\)' },
      { id: 'd05_s09_c', label: 'C', text: '\\(21\\text{ cm}\\)' },
      { id: 'd05_s09_d', label: 'D', text: '\\(49\\text{ cm}\\)' },
    ],
    correctOptionId: 'd05_s09_b',
    acceptedAnswers: ['28 cm', '28cm', '28'],
    officialAnswerText: '\\(28\\text{ cm}\\)',
    explanation:
      'Độ dài cạnh hình vuông là \\(\\sqrt{49} = 7\\text{ cm}\\). Chu vi hình vuông là \\(4 \\times 7 = 28\\text{ cm}\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
  {
    id: 'd05_sample_10',
    code: 'D05-M10',
    type: 'single_choice',
    stem: 'Tính giá trị của biểu thức sau: \\[A = \\frac{2^3 + 4}{3} - (-2)\\]',
    subject: 'math',
    grade: '7',
    level: 'apply',
    options: [
      { id: 'd05_s10_a', label: 'A', text: '\\(2\\)' },
      { id: 'd05_s10_b', label: 'B', text: '\\(4\\)' },
      { id: 'd05_s10_c', label: 'C', text: '\\(6\\)' },
      { id: 'd05_s10_d', label: 'D', text: '\\(8\\)' },
    ],
    correctOptionId: 'd05_s10_c',
    acceptedAnswers: ['6'],
    officialAnswerText: '\\(6\\)',
    explanation:
      'Ta có \\(2^3 = 8\\), nên \\(\\frac{2^3 + 4}{3} = \\frac{12}{3} = 4\\). Do đó \\(A = 4 - (-2) = 4 + 2 = 6\\).',
    isSample: true,
    sourceBadge: D05_SAMPLE_BADGE,
    requiresTeacherGrading: false,
  },
];

// ============================================================================
// TEAM BUILDERS & DEFAULT CONFIG
// ============================================================================

export function generateTempMembers(count: number, startNumber = 1, prefix = 'Bạn'): RelayMember[] {
  const safeCount = Math.max(1, Math.min(50, Math.floor(count)));
  return Array.from({ length: safeCount }, (_, i) => ({
    id: `m_${startNumber + i}_${Math.random().toString(36).slice(2, 7)}`,
    name: `${prefix} ${startNumber + i}`,
  }));
}

export function distributeRosterIntoTeams(
  studentNames: string[],
  teamCount: number,
  existingTeamNames?: string[]
): RelayTeamConfig[] {
  const safeTeamCount = Math.max(1, Math.min(6, Math.floor(teamCount)));
  const cleanNames = studentNames.map((n) => n.trim()).filter(Boolean).slice(0, 50);

  const defaultNames = [
    'Đội Xanh Dương',
    'Đội Cam Rực',
    'Đội Xanh Ngọc',
    'Đội Vàng Đồng',
    'Đội Tím Chàm',
    'Đội Đỏ San Hô',
  ];

  const teams: RelayTeamConfig[] = Array.from({ length: safeTeamCount }, (_, idx) => ({
    id: `team_${idx + 1}`,
    name: existingTeamNames?.[idx]?.trim() || defaultNames[idx] || `Đội ${idx + 1}`,
    paletteIndex: idx % RELAY_TEAM_PALETTES.length,
    members: [],
  }));

  if (cleanNames.length === 0) {
    // Fallback to temporary labels "Bạn 1, Bạn 2..."
    const perTeam = safeTeamCount === 1 ? 5 : 4;
    let cursor = 1;
    for (const t of teams) {
      t.members = generateTempMembers(perTeam, cursor);
      cursor += perTeam;
    }
    return teams;
  }

  // Round-robin balanced distribution (supports unequal sizes naturally, e.g. 50 across 6 -> 9,9,8,8,8,8)
  cleanNames.forEach((name, idx) => {
    const teamIdx = idx % safeTeamCount;
    teams[teamIdx].members.push({
      id: `st_${idx + 1}`,
      name,
    });
  });

  // Guarantee every team has at least 1 member if roster was smaller than teamCount
  let extraNum = cleanNames.length + 1;
  for (const t of teams) {
    if (t.members.length === 0) {
      t.members.push({ id: `st_extra_${extraNum}`, name: `Bạn ${extraNum}` });
      extraNum += 1;
    }
  }

  return teams;
}

export function createDefaultRelayConfig(
  mode: RelayMode = 'team_relay',
  rosterNames: string[] = []
): RelayMatchConfig {
  let teams: RelayTeamConfig[];

  if (mode === 'solo_practice') {
    const soloName = rosterNames[0]?.trim() || 'Học sinh Tự luyện';
    teams = [
      {
        id: 'team_solo',
        name: soloName,
        paletteIndex: 0,
        members: [{ id: 'solo_member_1', name: soloName }],
      },
    ];
  } else if (mode === 'class_relay') {
    teams = distributeRosterIntoTeams(rosterNames, 1, ['Cả lớp tiếp sức']);
  } else {
    teams = distributeRosterIntoTeams(rosterNames, 2);
  }

  return {
    mode,
    teams,
    sourceKind: 'sample',
    subjectFilter: 'all',
    gradeFilter: 'all',
    levelFilter: 'all',
    questionCount: 10,
    timerSeconds: 30,
    shuffleQuestions: false,
    shuffleOptions: true,
    rulesLocked: false,
  };
}

export function validateRelaySetupConfig(
  config: RelayMatchConfig,
  availableQuestionsCount: number
): RelayConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (availableQuestionsCount <= 0) {
    errors.push(
      'Nguồn câu hỏi hiện tại chưa có câu hợp lệ. Hãy đổi bộ câu hỏi hoặc dùng bộ Dữ liệu mẫu.'
    );
  }

  if (config.mode === 'team_relay') {
    if (config.teams.length < 2 || config.teams.length > 6) {
      errors.push('Chế độ Tiếp sức theo đội cần từ 2 đến 6 đội.');
    }
  } else if (config.teams.length !== 1) {
    errors.push('Chế độ này sử dụng đúng 1 đội và 1 gậy.');
  }

  let totalMembers = 0;
  let maxTeamSize = 0;
  const teamNamesLower = new Set<string>();

  config.teams.forEach((team, idx) => {
    const cleanTeamName = team.name.trim();
    if (!cleanTeamName) {
      errors.push(`Đội số ${idx + 1} chưa có tên.`);
    } else {
      const lower = cleanTeamName.toLowerCase();
      if (teamNamesLower.has(lower)) {
        warnings.push(`Có hai đội đang trùng tên "${cleanTeamName}" — nên đặt tên riêng để dễ theo dõi.`);
      }
      teamNamesLower.add(lower);
    }

    const validMembers = team.members.filter((m) => m.name.trim().length > 0);
    if (validMembers.length === 0) {
      errors.push(`Đội "${cleanTeamName || `#${idx + 1}`}" cần ít nhất 1 thành viên.`);
    }
    totalMembers += validMembers.length;
    if (validMembers.length > maxTeamSize) {
      maxTeamSize = validMembers.length;
    }
  });

  if (totalMembers > 50) {
    warnings.push(
      `Tổng số thành viên đang là ${totalMembers} (khuyến nghị tối đa 50 học sinh mỗi lớp).`
    );
  }

  const desiredCount = Math.max(1, Math.floor(config.questionCount || 1));
  const effectiveQuestionCount =
    availableQuestionsCount > 0 ? Math.min(desiredCount, availableQuestionsCount) : 0;

  if (availableQuestionsCount > 0 && desiredCount > availableQuestionsCount) {
    warnings.push(
      `Nguồn câu hỏi hiện có ${availableQuestionsCount} câu (ít hơn ${desiredCount} câu đã chọn). Hệ thống không tự lặp câu và sẽ dùng tối đa ${effectiveQuestionCount} câu.`
    );
  }

  if (
    config.mode !== 'solo_practice' &&
    effectiveQuestionCount > 0 &&
    effectiveQuestionCount < maxTeamSize
  ) {
    warnings.push(
      `Số câu hỏi (${effectiveQuestionCount}) ít hơn sĩ số đội đông nhất (${maxTeamSize} thành viên), nên một số em sẽ chưa đến lượt. Bạn có thể tăng số câu hỏi nếu ngân hàng đủ (hệ thống không tự lặp câu).`
    );
  }

  if (config.timerSeconds < 0 || config.timerSeconds > 300) {
    errors.push('Thời gian mỗi câu cần nằm trong khoảng 0 (không giới hạn) đến 300 giây.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveQuestionCount,
    maxTeamSize,
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

export function shuffleRelayOptionsPreservingId(
  item: RelayQuestionItem,
  rng: () => number = Math.random
): RelayQuestionItem {
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

export function isRelayQuestionAllowedForRole(question: Question, userRole?: UserRole): boolean {
  if (!question || question.status === 'deprecated') return false;
  if (!userRole || userRole === 'student') {
    return question.status === 'approved';
  }
  return question.status === 'approved' || question.status === 'pending';
}

export function adaptSmartEduQuestionForRelay(question: Question): RelayQuestionItem | null {
  const cleanStem = (question.stem || '').trim();
  if (!cleanStem) return null;

  const base = {
    id: String(question.id || '').trim() || `rq_${Math.random().toString(36).slice(2, 9)}`,
    code: (question.code || 'NHCH').trim(),
    type: question.type,
    stem: cleanStem,
    image: question.image?.trim() || undefined,
    subject: String(question.subject || 'other'),
    grade: String(question.grade || '6'),
    level: String(question.level || 'understand'),
    explanation: (question.explanation || 'Giáo viên chốt kiến thức trọng tâm sau lượt tiếp sức.').trim(),
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
    'Giáo viên chấm trực tiếp theo tiêu chí bài học';

  return {
    ...base,
    officialAnswerText: essayAnswer,
    requiresTeacherGrading: true,
  };
}

export function buildD05QuestionPool(params: {
  sourceKind: RelayQuestionSource;
  bankQuestions: Question[];
  userRole?: UserRole;
  subjectFilter?: string;
  gradeFilter?: string;
  levelFilter?: string;
}): RelayQuestionItem[] {
  if (params.sourceKind === 'sample') {
    return D05_SAMPLE_QUESTIONS.map((q) => ({
      ...q,
      options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
    }));
  }

  const seenIds = new Set<string>();
  const seenStems = new Set<string>();
  const adapted: RelayQuestionItem[] = [];

  for (const raw of params.bankQuestions || []) {
    if (!isRelayQuestionAllowedForRole(raw, params.userRole)) continue;
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

    const item = adaptSmartEduQuestionForRelay(raw);
    if (!item) continue;

    const stemKey = normalizeStemKey(item.stem);
    if (seenIds.has(item.id) || seenStems.has(stemKey)) continue;

    seenIds.add(item.id);
    seenStems.add(stemKey);
    adapted.push(item);
  }

  return adapted;
}

export function prepareRelayQuestions(
  pool: RelayQuestionItem[],
  config: RelayMatchConfig,
  rng: () => number = Math.random
): RelayQuestionItem[] {
  const ordered = config.shuffleQuestions ? shuffleArray(pool, rng) : [...pool];
  // Strictly NEVER repeat questions to stretch a match
  const sliced = ordered.slice(0, Math.max(1, Math.min(config.questionCount, ordered.length)));
  return config.shuffleOptions
    ? sliced.map((q) => shuffleRelayOptionsPreservingId(q, rng))
    : sliced.map((q) => ({
        ...q,
        options: q.options ? q.options.map((o) => ({ ...o })) : undefined,
      }));
}

// ============================================================================
// SOLO ANSWER EVALUATION HELPER
// ============================================================================

export function normalizeRelayShortAnswer(raw: string): string {
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

export function evaluateRelaySoloAnswer(
  question: RelayQuestionItem,
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
    const normInput = normalizeRelayShortAnswer(rawText);
    if (!normInput) return { isCorrect: false, answerNote: 'Không trả lời' };

    const hit = question.acceptedAnswers.some(
      (acc) => normalizeRelayShortAnswer(acc) === normInput
    );
    if (hit) return { isCorrect: true, answerNote: rawText };

    if (question.isNumericTolerance) {
      const numVal = Number(normInput);
      const tol = question.numericTolerance ?? 0.01;
      if (Number.isFinite(numVal)) {
        const tolHit = question.acceptedAnswers.some((acc) => {
          const target = Number(normalizeRelayShortAnswer(acc));
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
// CORE DETERMINISTIC RELAY ENGINE (ROTATION, ABSENT SKIP, SCORING, EDIT, TIE)
// ============================================================================

export function getActiveMember(team: RelayTeamRuntimeState): RelayMember {
  if (team.members.length === 0) {
    return { id: 'fallback', name: 'Bạn 1' };
  }
  const idx = ((team.currentMemberIndex % team.members.length) + team.members.length) % team.members.length;
  return team.members[idx];
}

export function getNextMember(team: RelayTeamRuntimeState): RelayMember {
  if (team.members.length === 0) {
    return { id: 'fallback', name: 'Bạn 1' };
  }
  if (team.members.length === 1) {
    return team.members[0];
  }
  const nextIdx = (team.currentMemberIndex + 1) % team.members.length;
  return team.members[nextIdx];
}

/**
 * Pure source-of-truth recomputation from config + history + absent skips + currentMemberIndex overrides.
 * Guarantees score, correctCount, turnsCompleted, and status are 100% consistent with history.
 */
export function recomputeRelayState(params: {
  config: RelayMatchConfig;
  questionOrder: RelayQuestionItem[];
  history: RelayTurnRecord[];
  absentSkipLogs: RelayAbsentSkipLog[];
  memberIndexByTeam?: Record<string, number>;
  currentQuestionIndex?: number;
  endedEarly?: boolean;
}): RelayMatchState {
  const { config, questionOrder, absentSkipLogs } = params;

  const teamRuntime: Record<string, RelayTeamRuntimeState> = {};

  for (const team of config.teams) {
    const cleanMembers =
      team.members.length > 0 ? team.members : [{ id: `${team.id}_m1`, name: 'Bạn 1' }];
    const skipCount = absentSkipLogs.filter((s) => s.teamId === team.id).length;

    // Default current index = (turns completed + absent skips) % members.length
    const computedIndex =
      cleanMembers.length > 0
        ? (params.history.length + skipCount) % cleanMembers.length
        : 0;

    const overriddenIdx = params.memberIndexByTeam?.[team.id];
    const safeIdx =
      typeof overriddenIdx === 'number' && cleanMembers.length > 0
        ? ((overriddenIdx % cleanMembers.length) + cleanMembers.length) % cleanMembers.length
        : computedIndex;

    teamRuntime[team.id] = {
      teamId: team.id,
      name: team.name,
      paletteIndex: team.paletteIndex,
      members: cleanMembers,
      currentMemberIndex: safeIdx,
      score: 0,
      correctCount: 0,
      turnsCompleted: 0,
      absentSkipCount: skipCount,
    };
  }

  // Recompute exact scores & completed turns from history
  const normalizedHistory: RelayTurnRecord[] = params.history.map((rec, turnIdx) => {
    const nextOutcomes: Record<string, RelayTeamTurnOutcome> = {};

    for (const team of config.teams) {
      const outcome = rec.teamOutcomes[team.id];
      const rt = teamRuntime[team.id];
      if (!outcome || !rt) continue;

      const pts = outcome.verdict === 'correct' ? POINTS_PER_CORRECT : 0;
      rt.score += pts;
      if (outcome.verdict === 'correct') {
        rt.correctCount += 1;
      }
      rt.turnsCompleted += 1;

      nextOutcomes[team.id] = {
        ...outcome,
        pointsAwarded: pts,
      };
    }

    return {
      ...rec,
      turnIndex: turnIdx,
      teamOutcomes: nextOutcomes,
    };
  });

  const endedEarly = Boolean(params.endedEarly);
  let status: RelayMatchStatus = 'playing';
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

  return {
    config: { ...config, rulesLocked: true },
    questionOrder,
    teamRuntime,
    history: normalizedHistory,
    absentSkipLogs: [...absentSkipLogs],
    currentQuestionIndex: safeCurrentIndex,
    status,
    endedEarly: status === 'ended_early',
  };
}

export function createInitialRelayMatchState(
  config: RelayMatchConfig,
  questionOrder: RelayQuestionItem[]
): RelayMatchState {
  const lockedConfig: RelayMatchConfig = {
    ...config,
    questionCount: questionOrder.length,
    rulesLocked: true,
  };
  return recomputeRelayState({
    config: lockedConfig,
    questionOrder,
    history: [],
    absentSkipLogs: [],
    currentQuestionIndex: 0,
    endedEarly: false,
  });
}

/**
 * Skip an absent student BEFORE the question opens (during 'prep' phase).
 * - Never marks the absent student wrong and awards/deducts 0 points.
 * - Immediately advances the team's active baton holder to the next member so teacher can preview them.
 */
export function skipAbsentRunnerBeforeTurn(
  state: RelayMatchState,
  teamId: string
): { state: RelayMatchState; skippedMember?: RelayMember; replacementMember?: RelayMember } {
  if (state.status !== 'playing') return { state };
  const rt = state.teamRuntime[teamId];
  if (!rt || rt.members.length <= 1) {
    return { state };
  }

  const absentMember = getActiveMember(rt);
  const nextIndex = (rt.currentMemberIndex + 1) % rt.members.length;
  const replacementMember = rt.members[nextIndex];

  const nextLogs: RelayAbsentSkipLog[] = [
    ...state.absentSkipLogs,
    {
      teamId,
      memberId: absentMember.id,
      memberName: absentMember.name,
      beforeQuestionIndex: state.currentQuestionIndex,
      skippedAt: Date.now(),
    },
  ];

  const memberIndexByTeam: Record<string, number> = {};
  Object.values(state.teamRuntime).forEach((t) => {
    memberIndexByTeam[t.teamId] = t.teamId === teamId ? nextIndex : t.currentMemberIndex;
  });

  const nextState = recomputeRelayState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: state.history,
    absentSkipLogs: nextLogs,
    memberIndexByTeam,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: false,
  });

  return {
    state: nextState,
    skippedMember: absentMember,
    replacementMember,
  };
}

/**
 * Atomic idempotent commit for all teams on the current question:
 * - Blocks duplicate commits for the same questionId (protects against double-clicks).
 * - Requires EVERY team to have a verdict !== 'ungraded'.
 * - Awards +10 for 'correct', 0 for 'incorrect' / 'no_answer'.
 * - Advances EVERY team's baton holder by 1 position (even on wrong/no_answer), wrapping back to index 0!
 */
export function commitRelayTurnResult(
  state: RelayMatchState,
  input: {
    question: RelayQuestionItem;
    verdictsByTeam: Record<string, RelayVerdict>;
    answerNotesByTeam?: Record<string, string>;
    lockedRunnerIndexByTeam?: Record<string, number>;
    resultSource: 'teacher_single_device' | 'student_auto';
    committedAt?: number;
  }
): {
  state: RelayMatchState;
  committed: boolean;
  reason?: string;
  record?: RelayTurnRecord;
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

  const teamOutcomes: Record<string, RelayTeamTurnOutcome> = {};
  const nextMemberIndexByTeam: Record<string, number> = {};

  for (const team of state.config.teams) {
    const rt = state.teamRuntime[team.id];
    const verdict = input.verdictsByTeam[team.id];
    const len = Math.max(1, rt.members.length);
    const beforeIdx =
      typeof input.lockedRunnerIndexByTeam?.[team.id] === 'number'
        ? ((input.lockedRunnerIndexByTeam[team.id] % len) + len) % len
        : rt.currentMemberIndex;
    const runner = rt.members[beforeIdx] ?? { id: 'fallback', name: 'Bạn 1' };
    const afterIdx = (beforeIdx + 1) % len; // Always passes baton after completed turn, wraps around!

    teamOutcomes[team.id] = {
      teamId: team.id,
      runnerMemberId: runner.id,
      runnerName: runner.name,
      runnerIndexBefore: beforeIdx,
      runnerIndexAfter: afterIdx,
      verdict,
      pointsAwarded: verdict === 'correct' ? POINTS_PER_CORRECT : 0,
      answerNote: input.answerNotesByTeam?.[team.id]?.trim() || undefined,
    };

    nextMemberIndexByTeam[team.id] = afterIdx;
  }

  const record: RelayTurnRecord = {
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

  const nextState = recomputeRelayState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: [...state.history, record],
    absentSkipLogs: state.absentSkipLogs,
    memberIndexByTeam: nextMemberIndexByTeam,
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
 * Edits the most recently confirmed turn before advancing to the next question.
 * - Recomputes every team's total score & correctCount cleanly from full history.
 * - Preserves EXACTLY ONE baton pass for that completed turn (never shifts runners a second time).
 */
export function editLastConfirmedRelayTurn(
  state: RelayMatchState,
  verdictsByTeam: Record<string, RelayVerdict>
): { state: RelayMatchState; edited: boolean; record?: RelayTurnRecord } {
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
  const updatedOutcomes: Record<string, RelayTeamTurnOutcome> = {};
  const preservedIndexByTeam: Record<string, number> = {};

  for (const team of state.config.teams) {
    const prevOutcome = last.teamOutcomes[team.id];
    const newVerdict = verdictsByTeam[team.id];
    updatedOutcomes[team.id] = {
      ...prevOutcome,
      verdict: newVerdict,
      pointsAwarded: newVerdict === 'correct' ? POINTS_PER_CORRECT : 0,
    };
    // Preserve exact post-turn runner index (one baton pass only!)
    preservedIndexByTeam[team.id] = prevOutcome.runnerIndexAfter;
  }

  const updatedHistory = [...state.history];
  updatedHistory[lastIdx] = {
    ...last,
    teamOutcomes: updatedOutcomes,
    wasEdited: true,
    committedAt: Date.now(),
  };

  const nextState = recomputeRelayState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: updatedHistory,
    absentSkipLogs: state.absentSkipLogs,
    memberIndexByTeam: preservedIndexByTeam,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: false,
  });

  return {
    state: nextState,
    edited: true,
    record: nextState.history[lastIdx],
  };
}

export function advanceRelayToNextQuestion(state: RelayMatchState): RelayMatchState {
  if (state.status !== 'playing') return state;
  const nextIdx = Math.min(state.questionOrder.length - 1, state.history.length);
  return {
    ...state,
    currentQuestionIndex: nextIdx,
  };
}

export function endRelayMatchEarly(state: RelayMatchState): RelayMatchState {
  if (state.status !== 'playing') return state;
  const preservedIndexByTeam: Record<string, number> = {};
  Object.values(state.teamRuntime).forEach((t) => {
    preservedIndexByTeam[t.teamId] = t.currentMemberIndex;
  });
  return recomputeRelayState({
    config: state.config,
    questionOrder: state.questionOrder,
    history: state.history,
    absentSkipLogs: state.absentSkipLogs,
    memberIndexByTeam: preservedIndexByTeam,
    currentQuestionIndex: state.currentQuestionIndex,
    endedEarly: true,
  });
}

/**
 * Standard competition ranking strictly by total score (ties share the exact same rank).
 * Never uses click speed, input order, or animation timing as tie-breakers.
 */
export function computeRelayStandings(state: RelayMatchState): RelayTeamStanding[] {
  const list = state.config.teams.map((team) => {
    const rt = state.teamRuntime[team.id];
    return {
      teamId: team.id,
      name: rt.name,
      paletteIndex: rt.paletteIndex,
      score: rt.score,
      correctCount: rt.correctCount,
      turnsCompleted: rt.turnsCompleted,
      memberCount: rt.members.length,
      rank: 1,
      isTied: false,
    };
  });

  list.sort((a, b) => b.score - a.score);

  const scoreFreq = new Map<number, number>();
  list.forEach((item) => {
    scoreFreq.set(item.score, (scoreFreq.get(item.score) || 0) + 1);
  });

  for (let i = 0; i < list.length; i++) {
    if (i > 0 && list[i].score === list[i - 1].score) {
      list[i].rank = list[i - 1].rank;
    } else {
      list[i].rank = i + 1;
    }
    list[i].isTied = (scoreFreq.get(list[i].score) || 0) > 1;
  }

  return list;
}

// ============================================================================
// SESSION PERSISTENCE (DEMO-ISOLATED & CORRUPT-STORAGE RESILIENT)
// ============================================================================

interface StoredD05SessionPayload {
  version: number;
  config: RelayMatchConfig;
  questionOrder: RelayQuestionItem[];
  history: RelayTurnRecord[];
  absentSkipLogs: RelayAbsentSkipLog[];
  memberIndexByTeam: Record<string, number>;
  currentQuestionIndex: number;
  endedEarly: boolean;
  updatedAt: number;
}

export function getD05SessionStorageKey(): string {
  return isKhktDemoRuntime()
    ? `${KHKT_DEMO_STORAGE_PREFIX}${D05_SESSION_STORAGE_KEY}`
    : D05_SESSION_STORAGE_KEY;
}

export function saveD05Session(state: RelayMatchState): void {
  if (typeof window === 'undefined') return;
  try {
    const memberIndexByTeam: Record<string, number> = {};
    Object.values(state.teamRuntime).forEach((t) => {
      memberIndexByTeam[t.teamId] = t.currentMemberIndex;
    });
    const payload: StoredD05SessionPayload = {
      version: D05_SESSION_VERSION,
      config: state.config,
      questionOrder: state.questionOrder,
      history: state.history,
      absentSkipLogs: state.absentSkipLogs,
      memberIndexByTeam,
      currentQuestionIndex: state.currentQuestionIndex,
      endedEarly: state.endedEarly,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(getD05SessionStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function clearD05Session(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getD05SessionStorageKey());
  } catch {
    // Ignore
  }
}

export function loadD05Session(): {
  state: RelayMatchState | null;
  recoveredFromCorruption: boolean;
} {
  if (typeof window === 'undefined') {
    return { state: null, recoveredFromCorruption: false };
  }
  const key = getD05SessionStorageKey();
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { state: null, recoveredFromCorruption: false };
  }
  if (!raw) return { state: null, recoveredFromCorruption: false };

  try {
    const parsed = JSON.parse(raw) as Partial<StoredD05SessionPayload>;
    if (
      !parsed ||
      parsed.version !== D05_SESSION_VERSION ||
      !parsed.config ||
      !Array.isArray(parsed.config.teams) ||
      parsed.config.teams.length === 0 ||
      !Array.isArray(parsed.questionOrder) ||
      parsed.questionOrder.length === 0 ||
      !Array.isArray(parsed.history)
    ) {
      clearD05Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const modeValid =
      parsed.config.mode === 'team_relay' ||
      parsed.config.mode === 'class_relay' ||
      parsed.config.mode === 'solo_practice';
    if (!modeValid) {
      clearD05Session();
      return { state: null, recoveredFromCorruption: true };
    }

    const restored = recomputeRelayState({
      config: parsed.config,
      questionOrder: parsed.questionOrder,
      history: parsed.history,
      absentSkipLogs: Array.isArray(parsed.absentSkipLogs) ? parsed.absentSkipLogs : [],
      memberIndexByTeam: parsed.memberIndexByTeam,
      currentQuestionIndex:
        typeof parsed.currentQuestionIndex === 'number'
          ? parsed.currentQuestionIndex
          : undefined,
      endedEarly: Boolean(parsed.endedEarly),
    });

    return { state: restored, recoveredFromCorruption: false };
  } catch {
    clearD05Session();
    return { state: null, recoveredFromCorruption: true };
  }
}
