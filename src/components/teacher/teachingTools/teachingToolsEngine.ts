import {
  ClassRoleAssignment,
  ClassRoom,
  TeachingAssignment,
  UserRole,
} from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

import type { QuickActivitySessionState } from './quickActivitiesEngine';
import type { ToolQuestionSet } from './questionBankEngine';

export type TeachingToolId =
  | 'groups'
  | 'seating'
  | 'activity'
  | 'timer'
  | 'scoreboard'
  | 'packages'
  | 'question_bank'
  | 'review_games'
  | 'quick_activities';

export interface ToolStudentItem {
  id: string; // Stable unique identifier (disambiguates identical names!)
  code: string;
  fullName: string;
  gender?: 'Nam' | 'Nữ';
}

// ============================================================================
// TOOL A: CHIA NHÓM HỌC SINH
// ============================================================================
export type GroupSplitMode = 'by_group_count' | 'by_max_size';

export interface StudentGroupItem {
  id: string;
  name: string;
  color: string;
  studentIds: string[];
}

export interface GroupConfigState {
  splitMode: GroupSplitMode;
  groupCount: number;
  maxPerGroup: number;
  groups: StudentGroupItem[];
}

// ============================================================================
// TOOL B: SƠ ĐỒ CHỖ NGỒI
// ============================================================================
export type SeatingViewOrientation = 'front_board' | 'back_of_class';

export interface SeatingState {
  rows: number;
  cols: number;
  blockedSeatKeys: string[]; // "r-c" coordinates marked unusable/empty
  pinnedSeatKeys: string[]; // "r-c" coordinates locked during re-shuffle
  assignments: Record<string, string | null>; // "r-c" -> studentId
  orientation: SeatingViewOrientation;
  lastError: string;
}

export interface OrientedSeatCell {
  seatKey: string;
  row: number;
  col: number;
  displayRow: number;
  displayCol: number;
  isBlocked: boolean;
  isPinned: boolean;
  studentId: string | null;
}

// ============================================================================
// TOOL C: ĐIỀU PHỐI HOẠT ĐỘNG NHÓM
// ============================================================================
export type ActivityMode =
  | 'station_rotation'
  | 'jigsaw'
  | 'tablecloth'
  | 'gallery_walk';

export interface ActivityStationItem {
  id: string;
  title: string;
  task: string;
  capacity: number;
}

export interface ActivityState {
  mode: ActivityMode;
  stations: ActivityStationItem[];
  roundDurationSeconds: number;
  splitMultiTurn: boolean;
  instructions: string;
  currentRound: number; // 1-indexed
  totalRounds: number;
  status: 'idle' | 'running' | 'paused' | 'completed';
  roundTargetEndAtMs: number | null;
  remainingMsWhenPaused: number;
  lastError: string;
}

export interface ActivityScheduleAssignment {
  groupId: string;
  groupName: string;
  groupColor: string;
  turnNumber: number;
  stationId: string;
  stationTitle: string;
  task: string;
}

export interface ActivityScheduleRound {
  roundNumber: number;
  assignments: ActivityScheduleAssignment[];
}

// ============================================================================
// TOOL D: ĐỒNG HỒ LỚP HỌC
// ============================================================================
export type ClassroomTimerMode = 'countdown' | 'stopwatch';

export interface ClassroomTimerState {
  mode: ClassroomTimerMode;
  configuredMinutes: number;
  configuredSeconds: number;
  bellEnabled: boolean;
  status: 'idle' | 'running' | 'paused' | 'finished';
  targetEndAtMs: number | null; // Anchors countdown against wall clock
  remainingMsWhenPaused: number;
  stopwatchStartedAtMs: number | null;
  elapsedMsWhenPaused: number;
  bellFiredForRun: boolean;
}

// ============================================================================
// TOOL E: BẢNG ĐIỂM ĐỘI
// ============================================================================
export interface ScoreTeamItem {
  id: string;
  name: string;
  color: string;
  score: number;
  memberStudentIds: string[];
}

export interface ScoreHistoryEntry {
  actionId: string;
  teamId: string;
  teamName: string;
  delta: number;
  reason: string;
  timestampMs: number;
  undone: boolean;
}

export interface ScoreboardState {
  teams: ScoreTeamItem[];
  quickDeltas: number[];
  history: ScoreHistoryEntry[];
  processedActionIds: string[];
}

export interface ScoreboardRankedTeam {
  teamId: string;
  name: string;
  color: string;
  score: number;
  rank: number; // Preserves equal tie rank (1, 1, 3)
  memberCount: number;
}

// ============================================================================
// TOOL F: GÓI TIẾT DẠY & PHIÊN LÀM VIỆC THEO LỚP
// ============================================================================
export interface LessonPackageConfigPayload {
  groupSplitMode: GroupSplitMode;
  groupCount: number;
  maxPerGroup: number;
  groupNames: string[];
  seatingRows: number;
  seatingCols: number;
  blockedSeatKeys: string[];
  activityMode: ActivityMode;
  activityStations: ActivityStationItem[];
  activityRoundDurationSeconds: number;
  activitySplitMultiTurn: boolean;
  activityInstructions: string;
  timerMode: ClassroomTimerMode;
  timerMinutes: number;
  timerSeconds: number;
  timerBellEnabled: boolean;
  scoreboardTeamCount: number;
  scoreboardTeamNames: string[];
  scoreboardQuickDeltas: number[];
  // Optional Đợt 2 fields (backward-compatible with Đợt 1 packages)
  questionSetId?: string | null;
  embeddedQuestionSet?: ToolQuestionSet | null;
  reviewGameMode?: 'puzzle' | 'race' | 'golden_bell';
  reviewRoundSeconds?: number;
  reviewPointsPerCorrect?: number;
  reviewTurnRule?: 'rotate_every_question' | 'keep_on_correct';
}

export interface LessonPackageItem {
  packageId: string;
  schemaVersion: 1;
  packageType: 'taydo_lesson_package';
  name: string;
  description: string;
  createdAtIso: string;
  updatedAtIso: string;
  config: LessonPackageConfigPayload;
}

export interface ClassTeachingSessionState {
  version: 1;
  classId: string;
  className: string;
  absentStudentIds: string[];
  groupsState: GroupConfigState;
  seatingState: SeatingState;
  activityState: ActivityState;
  timerState: ClassroomTimerState;
  scoreboardState: ScoreboardState;
  activePackageId: string | null;
  transferredReviewSessionIds?: string[];
  quickActivityState?: QuickActivitySessionState;
  pendingReviewGamePrefill?: {
    questionSetId?: string | null;
    mode?: 'puzzle' | 'race' | 'golden_bell';
    secondsPerQuestion?: number;
    pointsPerCorrect?: number;
    turnRule?: 'rotate_every_question' | 'keep_on_correct';
  } | null;
  updatedAtMs: number;
}

// ============================================================================
// CONSTANTS & DEFAULTS
// ============================================================================
const GROUP_PALETTE = [
  '#1D4ED8',
  '#047857',
  '#B45309',
  '#BE123C',
  '#6D28D9',
  '#0E7490',
  '#C2410C',
  '#4338CA',
];

export const ACTIVITY_MODE_META: Record<
  ActivityMode,
  {
    label: string;
    shortDesc: string;
    defaultInstructions: string;
    defaultStations: ActivityStationItem[];
  }
> = {
  station_rotation: {
    label: 'Luân chuyển trạm',
    shortDesc: 'Các nhóm lần lượt di chuyển qua từng trạm nhiệm vụ theo hiệu lệnh vòng.',
    defaultInstructions:
      'Mỗi nhóm hoàn thành phiếu nhiệm vụ tại trạm hiện tại. Khi hết giờ, di chuyển theo chiều kim đồng hồ sang trạm kế tiếp.',
    defaultStations: [
      { id: 'st_1', title: 'Trạm 1 · Khởi động kiến thức', task: 'Đọc tư liệu và gạch chân 3 ý trọng tâm.', capacity: 2 },
      { id: 'st_2', title: 'Trạm 2 · Luyện tập thực hành', task: 'Giải 2 bài tập vận dụng nhanh trên bảng nhóm.', capacity: 2 },
      { id: 'st_3', title: 'Trạm 3 · Mở rộng & Thử thách', task: 'Đặt câu hỏi phản biện và giải bài toán thực tế.', capacity: 2 },
      { id: 'st_4', title: 'Trạm 4 · Tự kiểm tra', task: 'Đối chiếu đáp án chuẩn và tự đánh giá mức độ hiểu bài.', capacity: 2 },
    ],
  },
  jigsaw: {
    label: 'Kỹ thuật Mảnh ghép',
    shortDesc: 'Vòng chuyên sâu theo mảnh kiến thức, sau đó ghép nhóm chia sẻ lại.',
    defaultInstructions:
      'Vòng 1 (Nhóm chuyên gia): nghiên cứu sâu một phần kiến thức. Vòng 2 (Nhóm mảnh ghép): mỗi thành viên trình bày lại phần của mình để hoàn thành nhiệm vụ chung.',
    defaultStations: [
      { id: 'jg_1', title: 'Mảnh ghép A · Khái niệm nền tảng', task: 'Phân tích định nghĩa, tính chất và ví dụ minh họa.', capacity: 2 },
      { id: 'jg_2', title: 'Mảnh ghép B · Phương pháp giải', task: 'Tóm tắt quy trình giải từng bước và lưu ý lỗi sai.', capacity: 2 },
      { id: 'jg_3', title: 'Mảnh ghép C · Ứng dụng thực tiễn', task: 'Liên hệ bài toán thực tế và đề xuất tình huống mới.', capacity: 2 },
    ],
  },
  tablecloth: {
    label: 'Khăn trải bàn',
    shortDesc: 'Mỗi cá nhân ghi ý kiến ở góc riêng trước khi thống nhất vào ô trung tâm.',
    defaultInstructions:
      'Giai đoạn 1: Làm việc cá nhân tại góc giấy của mình. Giai đoạn 2: Cả nhóm thảo luận, chọn lọc ý chung ghi vào khung trung tâm.',
    defaultStations: [
      { id: 'tc_1', title: 'Bàn 1 · Phân tích đề bài', task: 'Cá nhân nêu giả thiết/hướng tiếp cận (2 phút), nhóm thống nhất dàn ý chung.', capacity: 2 },
      { id: 'tc_2', title: 'Bàn 2 · Trình bày lời giải', task: 'Cá nhân nháp bước tính, nhóm tổng hợp lời giải hoàn chỉnh vào ô giữa.', capacity: 2 },
      { id: 'tc_3', title: 'Bàn 3 · Kiểm chứng & Phản biện', task: 'Kiểm tra điều kiện xác định và cách giải thay thế.', capacity: 2 },
    ],
  },
  gallery_walk: {
    label: 'Kỹ thuật Phòng tranh',
    shortDesc: 'Các nhóm treo sản phẩm, di chuyển tham quan và góp ý bằng phiếu nhận xét.',
    defaultInstructions:
      'Các nhóm trưng bày sản phẩm tại vị trí trạm. Khi có hiệu lệnh, di chuyển xem sản phẩm nhóm bạn và ghi 1 điểm sáng + 1 góp ý xây dựng.',
    defaultStations: [
      { id: 'gw_1', title: 'Góc trưng bày 1', task: 'Xem sản phẩm, ghi nhận xét vào phiếu góp ý màu xanh.', capacity: 2 },
      { id: 'gw_2', title: 'Góc trưng bày 2', task: 'Đánh giá tính chính xác và cách trình bày trực quan.', capacity: 2 },
      { id: 'gw_3', title: 'Góc trưng bày 3', task: 'Đặt 1 câu hỏi mở rộng cho nhóm tác giả.', capacity: 2 },
    ],
  },
};

export function seatKey(row: number, col: number): string {
  return `${row}-${col}`;
}

export function parseSeatKey(key: string): { row: number; col: number } | null {
  const parts = key.split('-');
  if (parts.length !== 2) return null;
  const r = Number(parts[0]);
  const c = Number(parts[1]);
  if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0) return null;
  return { row: r, col: c };
}

// ============================================================================
// RBAC CLASS SCOPING (Matches ClassManagement.tsx security rules)
// ============================================================================
export function resolvePermittedTeacherClasses(params: {
  classes: ClassRoom[];
  userId?: string | null;
  currentRole: UserRole;
  isDemoSandbox: boolean;
  isUsingDemoAssignmentsData: boolean;
  teachingAssignments?: TeachingAssignment[];
  classRoles?: ClassRoleAssignment[];
  teachingSchemaWarning?: string | null;
}): ClassRoom[] {
  const {
    classes,
    userId,
    currentRole,
    isDemoSandbox,
    isUsingDemoAssignmentsData,
    teachingAssignments = [],
    classRoles = [],
    teachingSchemaWarning = null,
  } = params;

  if (isDemoSandbox || isUsingDemoAssignmentsData || currentRole === 'admin') {
    return classes;
  }
  if (!userId) return [];

  if (
    teachingSchemaWarning &&
    teachingAssignments.length === 0 &&
    classRoles.length === 0
  ) {
    return classes.filter((c) => !c.teacherId || c.teacherId === userId);
  }

  const activeClassIds = new Set<string>();
  for (const ta of teachingAssignments) {
    if (
      ta.teacherId === userId &&
      ta.status === 'active' &&
      !ta.needsSubjectCompletion &&
      Boolean(ta.subject)
    ) {
      const cls = classes.find((c) => c.id === ta.classId);
      if (!cls?.schoolYear || ta.schoolYear === cls.schoolYear) {
        activeClassIds.add(ta.classId);
      }
    }
  }
  for (const cr of classRoles) {
    if (cr.teacherId === userId && cr.status === 'active') {
      const cls = classes.find((c) => c.id === cr.classId);
      if (!cls?.schoolYear || cr.schoolYear === cls.schoolYear) {
        activeClassIds.add(cr.classId);
      }
    }
  }
  return classes.filter((c) => activeClassIds.has(c.id));
}

export function getPresentStudents(
  students: ToolStudentItem[],
  absentStudentIds: string[]
): ToolStudentItem[] {
  const absentSet = new Set(absentStudentIds);
  return students.filter((s) => !absentSet.has(s.id));
}

// ============================================================================
// TOOL A IMPLEMENTATION: CHIA NHÓM HỌC SINH
// ============================================================================
function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const copy = items.slice();
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 202703;
  for (let i = copy.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function divideStudentsIntoGroups(params: {
  presentStudents: ToolStudentItem[];
  splitMode: GroupSplitMode;
  groupCount: number;
  maxPerGroup: number;
  existingNames?: string[];
  shuffleSeed?: string;
}): StudentGroupItem[] {
  const {
    presentStudents,
    splitMode,
    groupCount,
    maxPerGroup,
    existingNames = [],
    shuffleSeed,
  } = params;

  const n = presentStudents.length;
  if (n === 0) return [];

  // Deduplicate by stable student.id cleanly
  const uniqueMap = new Map<string, ToolStudentItem>();
  for (const s of presentStudents) {
    if (!uniqueMap.has(s.id)) {
      uniqueMap.set(s.id, s);
    }
  }
  const uniqueStudents = Array.from(uniqueMap.values());
  const total = uniqueStudents.length;

  let effectiveGroupCount: number;
  if (total === 1) {
    // Requirement: With 1 student, strictly create 1 group
    effectiveGroupCount = 1;
  } else if (splitMode === 'by_max_size') {
    const cap = Math.max(1, Math.round(maxPerGroup || 1));
    effectiveGroupCount = Math.max(1, Math.ceil(total / cap));
  } else {
    const req = Math.max(1, Math.round(groupCount || 1));
    effectiveGroupCount = Math.min(total, req);
  }

  const ordered =
    shuffleSeed !== undefined
      ? seededShuffle(uniqueStudents, shuffleSeed)
      : uniqueStudents
          .slice()
          .sort(() => Math.random() - 0.5);

  const buckets: string[][] = Array.from({ length: effectiveGroupCount }, () => []);

  // Round-robin guarantees balanced distribution: e.g. 41 / 5 => [9, 8, 8, 8, 8]
  ordered.forEach((student, idx) => {
    buckets[idx % effectiveGroupCount].push(student.id);
  });

  return buckets.map((studentIds, idx) => ({
    id: `grp_${idx + 1}`,
    name: (existingNames[idx] || '').trim() || `Nhóm ${idx + 1}`,
    color: GROUP_PALETTE[idx % GROUP_PALETTE.length],
    studentIds,
  }));
}

export function renameStudentGroup(
  groups: StudentGroupItem[],
  groupId: string,
  newName: string
): StudentGroupItem[] {
  const clean = newName.trim();
  if (!clean) return groups;
  return groups.map((g) => (g.id === groupId ? { ...g, name: clean } : g));
}

export function moveStudentBetweenGroups(
  groups: StudentGroupItem[],
  studentId: string,
  targetGroupId: string
): StudentGroupItem[] {
  if (!groups.some((g) => g.id === targetGroupId)) return groups;
  return groups.map((g) => {
    const filtered = g.studentIds.filter((id) => id !== studentId);
    if (g.id === targetGroupId) {
      return { ...g, studentIds: [...filtered, studentId] };
    }
    return { ...g, studentIds: filtered };
  });
}

// ============================================================================
// TOOL B IMPLEMENTATION: SƠ ĐỒ CHỖ NGỒI
// ============================================================================
export function createDefaultSeatingState(rows = 5, cols = 10): SeatingState {
  return {
    rows: Math.max(1, Math.min(12, rows)),
    cols: Math.max(1, Math.min(12, cols)),
    blockedSeatKeys: [],
    pinnedSeatKeys: [],
    assignments: {},
    orientation: 'front_board',
    lastError: '',
  };
}

export function getAllValidSeatKeys(rows: number, cols: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(seatKey(r, c));
    }
  }
  return out;
}

export function getAvailableSeatKeys(seating: SeatingState): string[] {
  const blocked = new Set(seating.blockedSeatKeys);
  return getAllValidSeatKeys(seating.rows, seating.cols).filter(
    (k) => !blocked.has(k)
  );
}

export function updateSeatingDimensions(
  seating: SeatingState,
  rows: number,
  cols: number
): SeatingState {
  const nextRows = Math.max(1, Math.min(12, Math.round(rows || 1)));
  const nextCols = Math.max(1, Math.min(12, Math.round(cols || 1)));
  const validSet = new Set(getAllValidSeatKeys(nextRows, nextCols));

  const nextAssignments: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(seating.assignments)) {
    if (validSet.has(k) && v) nextAssignments[k] = v;
  }

  return {
    ...seating,
    rows: nextRows,
    cols: nextCols,
    blockedSeatKeys: seating.blockedSeatKeys.filter((k) => validSet.has(k)),
    pinnedSeatKeys: seating.pinnedSeatKeys.filter((k) => validSet.has(k)),
    assignments: nextAssignments,
    lastError: '',
  };
}

export function toggleSeatBlocked(
  seating: SeatingState,
  key: string
): SeatingState {
  const parsed = parseSeatKey(key);
  if (!parsed || parsed.row >= seating.rows || parsed.col >= seating.cols) {
    return seating;
  }
  const blocked = new Set(seating.blockedSeatKeys);
  const pinned = new Set(seating.pinnedSeatKeys);
  const nextAssignments = { ...seating.assignments };

  if (blocked.has(key)) {
    blocked.delete(key);
  } else {
    blocked.add(key);
    pinned.delete(key);
    delete nextAssignments[key];
  }

  return {
    ...seating,
    blockedSeatKeys: Array.from(blocked),
    pinnedSeatKeys: Array.from(pinned),
    assignments: nextAssignments,
    lastError: '',
  };
}

export function toggleSeatPinned(
  seating: SeatingState,
  key: string
): SeatingState {
  if (seating.blockedSeatKeys.includes(key)) return seating;
  const pinned = new Set(seating.pinnedSeatKeys);
  if (pinned.has(key)) {
    pinned.delete(key);
  } else {
    // Only meaningful if seat is currently occupied (or allow empty pin cleanly)
    pinned.add(key);
  }
  return {
    ...seating,
    pinnedSeatKeys: Array.from(pinned),
    lastError: '',
  };
}

export function assignSeatsRandomly(params: {
  seating: SeatingState;
  presentStudents: ToolStudentItem[];
  shuffleSeed?: string;
}): { ok: boolean; shortageCount: number; seating: SeatingState } {
  const { seating, presentStudents, shuffleSeed } = params;
  const presentIdsSet = new Set(presentStudents.map((s) => s.id));
  const availableKeys = getAvailableSeatKeys(seating);

  if (presentStudents.length > availableKeys.length) {
    const shortage = presentStudents.length - availableKeys.length;
    const errorMsg = `Thiếu ${shortage} ghế khả dụng (${presentStudents.length} học sinh có mặt / ${availableKeys.length} ghế khả dụng). Vui lòng tăng số hàng/ghế hoặc mở thêm ghế trống trước khi xếp.`;
    return {
      ok: false,
      shortageCount: shortage,
      seating: {
        ...seating,
        lastError: errorMsg,
      },
    };
  }

  const availableSet = new Set(availableKeys);
  const nextAssignments: Record<string, string | null> = {};
  const preservedPins: string[] = [];
  const placedStudentIds = new Set<string>();

  // Step 1: Strictly keep valid pinned students at their pinned seats
  for (const pKey of seating.pinnedSeatKeys) {
    if (!availableSet.has(pKey)) continue;
    const occupantId = seating.assignments[pKey];
    if (occupantId && presentIdsSet.has(occupantId) && !placedStudentIds.has(occupantId)) {
      nextAssignments[pKey] = occupantId;
      placedStudentIds.add(occupantId);
      preservedPins.push(pKey);
    }
  }

  // Step 2: Gather unpinned present students & unpinned available seats
  const remainingStudents = presentStudents.filter(
    (s) => !placedStudentIds.has(s.id)
  );
  const pinnedSet = new Set(preservedPins);
  const remainingSeats = availableKeys.filter((k) => !pinnedSet.has(k));

  const shuffledStudents =
    shuffleSeed !== undefined
      ? seededShuffle(remainingStudents, shuffleSeed)
      : remainingStudents.slice().sort(() => Math.random() - 0.5);

  shuffledStudents.forEach((student, idx) => {
    const targetSeat = remainingSeats[idx];
    if (targetSeat) {
      nextAssignments[targetSeat] = student.id;
    }
  });

  return {
    ok: true,
    shortageCount: 0,
    seating: {
      ...seating,
      pinnedSeatKeys: preservedPins,
      assignments: nextAssignments,
      lastError: '',
    },
  };
}

export function swapSeats(
  seating: SeatingState,
  seatKeyA: string,
  seatKeyB: string
): SeatingState {
  if (seatKeyA === seatKeyB) return seating;
  if (
    seating.blockedSeatKeys.includes(seatKeyA) ||
    seating.blockedSeatKeys.includes(seatKeyB)
  ) {
    return seating;
  }

  const nextAssignments = { ...seating.assignments };
  const valA = nextAssignments[seatKeyA] ?? null;
  const valB = nextAssignments[seatKeyB] ?? null;

  if (valB) nextAssignments[seatKeyA] = valB;
  else delete nextAssignments[seatKeyA];

  if (valA) nextAssignments[seatKeyB] = valA;
  else delete nextAssignments[seatKeyB];

  // Transfer pinned flags along with occupants if swapped cleanly
  const pinnedSet = new Set(seating.pinnedSeatKeys);
  const wasPinnedA = pinnedSet.has(seatKeyA);
  const wasPinnedB = pinnedSet.has(seatKeyB);
  if (wasPinnedA) pinnedSet.delete(seatKeyA);
  if (wasPinnedB) pinnedSet.delete(seatKeyB);
  if (wasPinnedA) pinnedSet.add(seatKeyB);
  if (wasPinnedB) pinnedSet.add(seatKeyA);

  return {
    ...seating,
    assignments: nextAssignments,
    pinnedSeatKeys: Array.from(pinnedSet),
    lastError: '',
  };
}

export function getOrientedSeatingGrid(seating: SeatingState): OrientedSeatCell[][] {
  const blockedSet = new Set(seating.blockedSeatKeys);
  const pinnedSet = new Set(seating.pinnedSeatKeys);
  const grid: OrientedSeatCell[][] = [];

  for (let dr = 0; dr < seating.rows; dr++) {
    const rowCells: OrientedSeatCell[] = [];
    const actualRow =
      seating.orientation === 'front_board' ? dr : seating.rows - 1 - dr;
    for (let dc = 0; dc < seating.cols; dc++) {
      const actualCol =
        seating.orientation === 'front_board' ? dc : seating.cols - 1 - dc;
      const key = seatKey(actualRow, actualCol);
      rowCells.push({
        seatKey: key,
        row: actualRow,
        col: actualCol,
        displayRow: dr,
        displayCol: dc,
        isBlocked: blockedSet.has(key),
        isPinned: pinnedSet.has(key),
        studentId: seating.assignments[key] ?? null,
      });
    }
    grid.push(rowCells);
  }
  return grid;
}

// ============================================================================
// TOOL C IMPLEMENTATION: ĐIỀU PHỐI HOẠT ĐỘNG NHÓM
// ============================================================================
export function createDefaultActivityState(
  mode: ActivityMode = 'station_rotation'
): ActivityState {
  const meta = ACTIVITY_MODE_META[mode];
  return {
    mode,
    stations: meta.defaultStations.map((s) => ({ ...s })),
    roundDurationSeconds: 180,
    splitMultiTurn: false,
    instructions: meta.defaultInstructions,
    currentRound: 1,
    totalRounds: Math.max(1, meta.defaultStations.length),
    status: 'idle',
    roundTargetEndAtMs: null,
    remainingMsWhenPaused: 180 * 1000,
    lastError: '',
  };
}

export function validateActivityCapacity(
  activity: ActivityState,
  groups: StudentGroupItem[]
): {
  ok: boolean;
  totalCapacity: number;
  groupCount: number;
  turnsRequired: number;
  error?: string;
} {
  const stations = activity.stations;
  if (stations.length === 0) {
    return {
      ok: false,
      totalCapacity: 0,
      groupCount: groups.length,
      turnsRequired: 0,
      error: 'Cần có ít nhất 1 trạm/bàn nhiệm vụ trước khi điều phối hoạt động.',
    };
  }
  if (groups.length === 0) {
    return {
      ok: false,
      totalCapacity: stations.reduce((acc, s) => acc + Math.max(1, s.capacity), 0),
      groupCount: 0,
      turnsRequired: 0,
      error: 'Chưa có nhóm học sinh nào. Vui lòng chia nhóm hoặc tạo nhóm trước khi bắt đầu.',
    };
  }

  const totalCapacity = stations.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.capacity || 1)),
    0
  );
  const turnsRequired = Math.max(1, Math.ceil(groups.length / totalCapacity));

  if (groups.length > totalCapacity && !activity.splitMultiTurn) {
    return {
      ok: false,
      totalCapacity,
      groupCount: groups.length,
      turnsRequired,
      error: `Số nhóm (${groups.length}) vượt quá tổng sức chứa của các trạm (${totalCapacity} nhóm). Hãy tăng sức chứa/thêm trạm hoặc bật "Chia nhiều lượt" trước khi bắt đầu.`,
    };
  }

  return {
    ok: true,
    totalCapacity,
    groupCount: groups.length,
    turnsRequired,
  };
}

export function previewActivitySchedule(
  activity: ActivityState,
  groups: StudentGroupItem[]
): ActivityScheduleRound[] {
  const stations = activity.stations;
  if (stations.length === 0 || groups.length === 0) return [];

  const totalCapacity = stations.reduce(
    (sum, s) => sum + Math.max(1, Math.round(s.capacity || 1)),
    0
  );

  // Build slot pool mapped to station indices
  const slotStationIndices: number[] = [];
  stations.forEach((st, stIdx) => {
    const cap = Math.max(1, Math.round(st.capacity || 1));
    for (let k = 0; k < cap; k++) {
      slotStationIndices.push(stIdx);
    }
  });

  const batchSize = activity.splitMultiTurn ? totalCapacity : groups.length;
  const roundsCount = stations.length;
  const out: ActivityScheduleRound[] = [];

  for (let r = 0; r < roundsCount; r++) {
    const assignments: ActivityScheduleAssignment[] = [];
    groups.forEach((grp, gIdx) => {
      const turnNumber = Math.floor(gIdx / batchSize) + 1;
      const slotIdx = (gIdx % Math.max(1, slotStationIndices.length));
      const baseStIdx = slotStationIndices[slotIdx] ?? 0;
      const rotatedStIdx = (baseStIdx + r) % stations.length;
      const st = stations[rotatedStIdx];
      assignments.push({
        groupId: grp.id,
        groupName: grp.name,
        groupColor: grp.color,
        turnNumber,
        stationId: st.id,
        stationTitle: st.title,
        task: st.task,
      });
    });
    out.push({
      roundNumber: r + 1,
      assignments,
    });
  }
  return out;
}

export function startActivityRun(
  activity: ActivityState,
  groups: StudentGroupItem[],
  nowMs = Date.now()
): ActivityState {
  const cap = validateActivityCapacity(activity, groups);
  if (!cap.ok) {
    return {
      ...activity,
      lastError: cap.error || 'Không đủ sức chứa trạm.',
    };
  }
  const durMs = Math.max(10, activity.roundDurationSeconds) * 1000;
  return {
    ...activity,
    currentRound: 1,
    totalRounds: Math.max(1, activity.stations.length),
    status: 'running',
    roundTargetEndAtMs: nowMs + durMs,
    remainingMsWhenPaused: durMs,
    lastError: '',
  };
}

export function pauseActivityRun(
  activity: ActivityState,
  nowMs = Date.now()
): ActivityState {
  if (activity.status !== 'running') return activity;
  const remaining =
    activity.roundTargetEndAtMs !== null
      ? Math.max(0, activity.roundTargetEndAtMs - nowMs)
      : activity.remainingMsWhenPaused;
  return {
    ...activity,
    status: 'paused',
    roundTargetEndAtMs: null,
    remainingMsWhenPaused: remaining,
  };
}

export function resumeActivityRun(
  activity: ActivityState,
  nowMs = Date.now()
): ActivityState {
  if (activity.status !== 'paused') return activity;
  const rem = Math.max(0, activity.remainingMsWhenPaused);
  return {
    ...activity,
    status: 'running',
    roundTargetEndAtMs: nowMs + rem,
  };
}

export function advanceActivityRound(
  activity: ActivityState,
  delta: 1 | -1,
  nowMs = Date.now()
): ActivityState {
  const total = Math.max(1, activity.stations.length);
  const nextRound = activity.currentRound + delta;
  if (nextRound < 1) return activity;
  if (nextRound > total) {
    return {
      ...activity,
      currentRound: total,
      status: 'completed',
      roundTargetEndAtMs: null,
      remainingMsWhenPaused: 0,
    };
  }
  const durMs = Math.max(10, activity.roundDurationSeconds) * 1000;
  const keepRunning = activity.status === 'running';
  return {
    ...activity,
    currentRound: nextRound,
    totalRounds: total,
    status: keepRunning ? 'running' : 'paused',
    roundTargetEndAtMs: keepRunning ? nowMs + durMs : null,
    remainingMsWhenPaused: durMs,
  };
}

export function computeActivityRemainingMs(
  activity: ActivityState,
  nowMs = Date.now()
): number {
  if (activity.status === 'running' && activity.roundTargetEndAtMs !== null) {
    return Math.max(0, activity.roundTargetEndAtMs - nowMs);
  }
  return Math.max(0, activity.remainingMsWhenPaused);
}

// ============================================================================
// TOOL D IMPLEMENTATION: ĐỒNG HỒ LỚP HỌC (TIMESTAMP-ANCHORED & SINGLE BELL)
// ============================================================================
export function createDefaultTimerState(): ClassroomTimerState {
  return {
    mode: 'countdown',
    configuredMinutes: 5,
    configuredSeconds: 0,
    bellEnabled: true,
    status: 'idle',
    targetEndAtMs: null,
    remainingMsWhenPaused: 5 * 60 * 1000,
    stopwatchStartedAtMs: null,
    elapsedMsWhenPaused: 0,
    bellFiredForRun: false,
  };
}

export function getTimerDurationMs(timer: ClassroomTimerState): number {
  const mins = Math.max(0, Math.min(180, Math.round(timer.configuredMinutes || 0)));
  const secs = Math.max(0, Math.min(59, Math.round(timer.configuredSeconds || 0)));
  return (mins * 60 + secs) * 1000;
}

export function startClassroomTimer(
  timer: ClassroomTimerState,
  nowMs = Date.now()
): ClassroomTimerState {
  if (timer.mode === 'countdown') {
    const baseMs =
      timer.status === 'paused' && timer.remainingMsWhenPaused > 0
        ? timer.remainingMsWhenPaused
        : getTimerDurationMs(timer);
    if (baseMs <= 0) return timer;
    return {
      ...timer,
      status: 'running',
      targetEndAtMs: nowMs + baseMs,
      remainingMsWhenPaused: baseMs,
      bellFiredForRun: false,
    };
  }
  // Stopwatch
  const baseElapsed =
    timer.status === 'paused' ? timer.elapsedMsWhenPaused : 0;
  return {
    ...timer,
    status: 'running',
    stopwatchStartedAtMs: nowMs - baseElapsed,
    elapsedMsWhenPaused: baseElapsed,
    bellFiredForRun: false,
  };
}

export function pauseClassroomTimer(
  timer: ClassroomTimerState,
  nowMs = Date.now()
): ClassroomTimerState {
  if (timer.status !== 'running') return timer;
  if (timer.mode === 'countdown') {
    const rem =
      timer.targetEndAtMs !== null
        ? Math.max(0, timer.targetEndAtMs - nowMs)
        : timer.remainingMsWhenPaused;
    return {
      ...timer,
      status: rem <= 0 ? 'finished' : 'paused',
      targetEndAtMs: null,
      remainingMsWhenPaused: rem,
    };
  }
  const elapsed =
    timer.stopwatchStartedAtMs !== null
      ? Math.max(0, nowMs - timer.stopwatchStartedAtMs)
      : timer.elapsedMsWhenPaused;
  return {
    ...timer,
    status: 'paused',
    stopwatchStartedAtMs: null,
    elapsedMsWhenPaused: elapsed,
  };
}

export function resetClassroomTimer(
  timer: ClassroomTimerState
): ClassroomTimerState {
  const configuredMs = getTimerDurationMs(timer);
  return {
    ...timer,
    status: 'idle',
    targetEndAtMs: null,
    remainingMsWhenPaused: configuredMs,
    stopwatchStartedAtMs: null,
    elapsedMsWhenPaused: 0,
    bellFiredForRun: false,
  };
}

export function tickTimerSnapshot(
  timer: ClassroomTimerState,
  nowMs = Date.now()
): {
  displayMs: number;
  shouldRingBell: boolean;
  nextState: ClassroomTimerState;
} {
  if (timer.mode === 'stopwatch') {
    const elapsed =
      timer.status === 'running' && timer.stopwatchStartedAtMs !== null
        ? Math.max(0, nowMs - timer.stopwatchStartedAtMs)
        : timer.elapsedMsWhenPaused;
    return {
      displayMs: elapsed,
      shouldRingBell: false,
      nextState: timer,
    };
  }

  // Countdown mode: strictly anchored to targetEndAtMs
  if (timer.status === 'running' && timer.targetEndAtMs !== null) {
    const rem = Math.max(0, timer.targetEndAtMs - nowMs);
    if (rem === 0) {
      const shouldRing = timer.bellEnabled && !timer.bellFiredForRun;
      return {
        displayMs: 0,
        shouldRingBell: shouldRing,
        nextState: {
          ...timer,
          status: 'finished',
          targetEndAtMs: null,
          remainingMsWhenPaused: 0,
          bellFiredForRun: timer.bellFiredForRun || shouldRing,
        },
      };
    }
    return {
      displayMs: rem,
      shouldRingBell: false,
      nextState: timer,
    };
  }

  return {
    displayMs: Math.max(0, timer.remainingMsWhenPaused),
    shouldRingBell: false,
    nextState: timer,
  };
}

export function formatTimerClock(ms: number): string {
  const totalSec = Math.ceil(Math.max(0, ms) / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// TOOL E IMPLEMENTATION: BẢNG ĐIỂM ĐỘI
// ============================================================================
export function createDefaultScoreboardState(): ScoreboardState {
  return {
    teams: [
      { id: 'sb_team_1', name: 'Đội 1', color: GROUP_PALETTE[0], score: 0, memberStudentIds: [] },
      { id: 'sb_team_2', name: 'Đội 2', color: GROUP_PALETTE[1], score: 0, memberStudentIds: [] },
    ],
    quickDeltas: [1, 5, 10, -1, -5],
    history: [],
    processedActionIds: [],
  };
}

export function importGroupsToScoreboard(
  groups: StudentGroupItem[],
  currentScoreboard: ScoreboardState
): ScoreboardState {
  if (groups.length === 0) return currentScoreboard;
  const teams: ScoreTeamItem[] = groups.map((g, idx) => ({
    id: g.id,
    name: g.name,
    color: g.color || GROUP_PALETTE[idx % GROUP_PALETTE.length],
    score: 0,
    memberStudentIds: g.studentIds.slice(),
  }));
  return {
    ...currentScoreboard,
    teams,
    history: [],
    processedActionIds: [],
  };
}

/**
 * Applies a delta score update to one team.
 * - Distinct actionIds (e.g. two manual teacher clicks) are BOTH recorded cleanly.
 * - Duplicate replay with the SAME actionId is deduplicated strictly once!
 */
export function applyTeamScoreAction(params: {
  state: ScoreboardState;
  teamId: string;
  delta: number;
  reason?: string;
  actionId: string;
  nowMs?: number;
}): ScoreboardState {
  const { state, teamId, delta, reason = '', actionId, nowMs = Date.now() } = params;
  if (!actionId || state.processedActionIds.includes(actionId)) {
    return state;
  }
  const targetTeam = state.teams.find((t) => t.id === teamId);
  if (!targetTeam || delta === 0) return state;

  const nextTeams = state.teams.map((t) =>
    t.id === teamId ? { ...t, score: t.score + delta } : t
  );
  const entry: ScoreHistoryEntry = {
    actionId,
    teamId,
    teamName: targetTeam.name,
    delta,
    reason: reason.trim() || (delta > 0 ? 'Cộng điểm nhanh' : 'Trừ điểm nhanh'),
    timestampMs: nowMs,
    undone: false,
  };

  return {
    ...state,
    teams: nextTeams,
    history: [entry, ...state.history].slice(0, 200),
    processedActionIds: [...state.processedActionIds.slice(-199), actionId],
  };
}

export function undoLastScoreAction(state: ScoreboardState): ScoreboardState {
  const idx = state.history.findIndex((h) => !h.undone);
  if (idx < 0) return state;
  const target = state.history[idx];
  const nextTeams = state.teams.map((t) =>
    t.id === target.teamId ? { ...t, score: t.score - target.delta } : t
  );
  const nextHistory = state.history.map((h, i) =>
    i === idx ? { ...h, undone: true } : h
  );
  return {
    ...state,
    teams: nextTeams,
    history: nextHistory,
  };
}

export function computeScoreboardRankings(
  teams: ScoreTeamItem[]
): ScoreboardRankedTeam[] {
  const sorted = teams.slice().sort((a, b) => b.score - a.score);
  const out: ScoreboardRankedTeam[] = [];
  let prevRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (i > 0 && t.score !== sorted[i - 1].score) {
      prevRank = i + 1;
    }
    out.push({
      teamId: t.id,
      name: t.name,
      color: t.color,
      score: t.score,
      rank: prevRank,
      memberCount: t.memberStudentIds.length,
    });
  }
  return out;
}

// ============================================================================
// TOOL F IMPLEMENTATION: GÓI TIẾT DẠY & LƯU PHIÊN THEO LỚP + TÀI KHOẢN / DEMO
// ============================================================================
export function createFreshClassTeachingSession(
  classRoom: { id: string; name: string; students: ToolStudentItem[] },
  nowMs = Date.now()
): ClassTeachingSessionState {
  const initialGroups = divideStudentsIntoGroups({
    presentStudents: classRoom.students,
    splitMode: 'by_group_count',
    groupCount: 4,
    maxPerGroup: 6,
    shuffleSeed: `init_${classRoom.id}_${nowMs}`,
  });

  const scoreboardTeams: ScoreTeamItem[] =
    initialGroups.length >= 2
      ? initialGroups.map((g, idx) => ({
          id: g.id,
          name: g.name,
          color: g.color || GROUP_PALETTE[idx % GROUP_PALETTE.length],
          score: 0,
          memberStudentIds: g.studentIds.slice(),
        }))
      : createDefaultScoreboardState().teams;

  return {
    version: 1,
    classId: classRoom.id,
    className: classRoom.name,
    absentStudentIds: [],
    groupsState: {
      splitMode: 'by_group_count',
      groupCount: 4,
      maxPerGroup: 6,
      groups: initialGroups,
    },
    seatingState: createDefaultSeatingState(5, 10),
    activityState: createDefaultActivityState('station_rotation'),
    timerState: createDefaultTimerState(),
    scoreboardState: {
      ...createDefaultScoreboardState(),
      teams: scoreboardTeams,
    },
    activePackageId: null,
    updatedAtMs: nowMs,
  };
}

export function buildPackageFromSession(params: {
  name: string;
  description?: string;
  session: ClassTeachingSessionState;
  questionSet?: ToolQuestionSet | null;
  reviewConfig?: {
    mode?: 'puzzle' | 'race' | 'golden_bell';
    secondsPerQuestion?: number;
    pointsPerCorrect?: number;
    turnRule?: 'rotate_every_question' | 'keep_on_correct';
  } | null;
  nowIso?: string;
}): LessonPackageItem {
  const nowIso = params.nowIso || new Date().toISOString();
  const s = params.session;
  return {
    packageId: `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    schemaVersion: 1,
    packageType: 'taydo_lesson_package',
    name: params.name.trim() || 'Gói tiết dạy mới',
    description: (params.description || '').trim() || 'Cấu hình nhóm, hoạt động, đồng hồ và bảng điểm.',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    config: {
      groupSplitMode: s.groupsState.splitMode,
      groupCount: s.groupsState.groupCount,
      maxPerGroup: s.groupsState.maxPerGroup,
      groupNames: s.groupsState.groups.map((g) => g.name),
      seatingRows: s.seatingState.rows,
      seatingCols: s.seatingState.cols,
      blockedSeatKeys: s.seatingState.blockedSeatKeys.slice(),
      activityMode: s.activityState.mode,
      activityStations: s.activityState.stations.map((st) => ({ ...st })),
      activityRoundDurationSeconds: s.activityState.roundDurationSeconds,
      activitySplitMultiTurn: s.activityState.splitMultiTurn,
      activityInstructions: s.activityState.instructions,
      timerMode: s.timerState.mode,
      timerMinutes: s.timerState.configuredMinutes,
      timerSeconds: s.timerState.configuredSeconds,
      timerBellEnabled: s.timerState.bellEnabled,
      scoreboardTeamCount: s.scoreboardState.teams.length,
      scoreboardTeamNames: s.scoreboardState.teams.map((t) => t.name),
      scoreboardQuickDeltas: s.scoreboardState.quickDeltas.slice(),
      questionSetId: params.questionSet?.id || s.pendingReviewGamePrefill?.questionSetId || null,
      embeddedQuestionSet: params.questionSet
        ? {
            ...params.questionSet,
            questions: params.questionSet.questions.map((q) => ({ ...q })),
          }
        : null,
      reviewGameMode: params.reviewConfig?.mode || s.pendingReviewGamePrefill?.mode,
      reviewRoundSeconds:
        params.reviewConfig?.secondsPerQuestion ?? s.pendingReviewGamePrefill?.secondsPerQuestion,
      reviewPointsPerCorrect:
        params.reviewConfig?.pointsPerCorrect ?? s.pendingReviewGamePrefill?.pointsPerCorrect,
      reviewTurnRule: params.reviewConfig?.turnRule || s.pendingReviewGamePrefill?.turnRule,
    },
  };
}

/**
 * Exports a shareable JSON string strictly WITHOUT any student roster,
 * student names, student IDs, or live scores.
 */
export function serializePackageForShare(pkg: LessonPackageItem): string {
  const sanitized: LessonPackageItem = {
    packageId: pkg.packageId,
    schemaVersion: 1,
    packageType: 'taydo_lesson_package',
    name: pkg.name,
    description: pkg.description,
    createdAtIso: pkg.createdAtIso,
    updatedAtIso: pkg.updatedAtIso,
    config: {
      groupSplitMode: pkg.config.groupSplitMode,
      groupCount: pkg.config.groupCount,
      maxPerGroup: pkg.config.maxPerGroup,
      groupNames: [...pkg.config.groupNames],
      seatingRows: pkg.config.seatingRows,
      seatingCols: pkg.config.seatingCols,
      blockedSeatKeys: [...pkg.config.blockedSeatKeys],
      activityMode: pkg.config.activityMode,
      activityStations: pkg.config.activityStations.map((s) => ({ ...s })),
      activityRoundDurationSeconds: pkg.config.activityRoundDurationSeconds,
      activitySplitMultiTurn: pkg.config.activitySplitMultiTurn,
      activityInstructions: pkg.config.activityInstructions,
      timerMode: pkg.config.timerMode,
      timerMinutes: pkg.config.timerMinutes,
      timerSeconds: pkg.config.timerSeconds,
      timerBellEnabled: pkg.config.timerBellEnabled,
      scoreboardTeamCount: pkg.config.scoreboardTeamCount,
      scoreboardTeamNames: [...pkg.config.scoreboardTeamNames],
      scoreboardQuickDeltas: [...pkg.config.scoreboardQuickDeltas],
      questionSetId: pkg.config.questionSetId ?? null,
      embeddedQuestionSet: pkg.config.embeddedQuestionSet ?? null,
      reviewGameMode: pkg.config.reviewGameMode,
      reviewRoundSeconds: pkg.config.reviewRoundSeconds,
      reviewPointsPerCorrect: pkg.config.reviewPointsPerCorrect,
      reviewTurnRule: pkg.config.reviewTurnRule,
    },
  };
  return JSON.stringify(sanitized, null, 2);
}

/**
 * Validates incoming JSON text strictly BEFORE touching saved packages.
 */
export function validateAndImportPackageJson(
  rawJson: string
): { ok: boolean; pkg?: LessonPackageItem; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return {
      ok: false,
      error: 'Tệp JSON không hợp lệ (lỗi cú pháp). Đã giữ nguyên danh sách gói đã lưu.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      error: 'Cấu trúc tệp không đúng định dạng Gói tiết dạy Smart EDU.',
    };
  }

  const obj = parsed as Partial<LessonPackageItem>;
  if (
    obj.packageType !== 'taydo_lesson_package' ||
    obj.schemaVersion !== 1 ||
    typeof obj.name !== 'string' ||
    !obj.name.trim() ||
    !obj.config ||
    typeof obj.config !== 'object'
  ) {
    return {
      ok: false,
      error: 'Thiếu trường nhận diện gói tiết dạy hợp lệ (taydo_lesson_package / schemaVersion 1).',
    };
  }

  const c = obj.config as Partial<LessonPackageConfigPayload>;
  if (
    (c.groupSplitMode !== 'by_group_count' && c.groupSplitMode !== 'by_max_size') ||
    typeof c.groupCount !== 'number' ||
    c.groupCount < 1 ||
    typeof c.maxPerGroup !== 'number' ||
    c.maxPerGroup < 1 ||
    !Array.isArray(c.activityStations) ||
    typeof c.activityRoundDurationSeconds !== 'number' ||
    c.activityRoundDurationSeconds < 10 ||
    (c.timerMode !== 'countdown' && c.timerMode !== 'stopwatch') ||
    typeof c.timerMinutes !== 'number' ||
    typeof c.timerSeconds !== 'number'
  ) {
    return {
      ok: false,
      error: 'Thông số cấu hình nhóm, hoạt động hoặc đồng hồ trong tệp JSON không hợp lệ.',
    };
  }

  const nowIso = new Date().toISOString();
  const imported: LessonPackageItem = {
    packageId: `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    schemaVersion: 1,
    packageType: 'taydo_lesson_package',
    name: obj.name.trim(),
    description: typeof obj.description === 'string' ? obj.description : '',
    createdAtIso: typeof obj.createdAtIso === 'string' ? obj.createdAtIso : nowIso,
    updatedAtIso: nowIso,
    config: {
      groupSplitMode: c.groupSplitMode,
      groupCount: Math.max(1, Math.round(c.groupCount)),
      maxPerGroup: Math.max(1, Math.round(c.maxPerGroup)),
      groupNames: Array.isArray(c.groupNames) ? c.groupNames.map(String) : [],
      seatingRows: typeof c.seatingRows === 'number' ? Math.max(1, Math.min(12, Math.round(c.seatingRows))) : 5,
      seatingCols: typeof c.seatingCols === 'number' ? Math.max(1, Math.min(12, Math.round(c.seatingCols))) : 10,
      blockedSeatKeys: Array.isArray(c.blockedSeatKeys) ? c.blockedSeatKeys.map(String) : [],
      activityMode: ACTIVITY_MODE_META[c.activityMode as ActivityMode] ? (c.activityMode as ActivityMode) : 'station_rotation',
      activityStations: c.activityStations.map((st, idx) => ({
        id: String(st.id || `st_${idx + 1}`),
        title: String(st.title || `Trạm ${idx + 1}`),
        task: String(st.task || ''),
        capacity: Math.max(1, Math.round(Number(st.capacity || 2))),
      })),
      activityRoundDurationSeconds: Math.max(10, Math.round(c.activityRoundDurationSeconds)),
      activitySplitMultiTurn: Boolean(c.activitySplitMultiTurn),
      activityInstructions: typeof c.activityInstructions === 'string' ? c.activityInstructions : '',
      timerMode: c.timerMode,
      timerMinutes: Math.max(0, Math.min(180, Math.round(c.timerMinutes))),
      timerSeconds: Math.max(0, Math.min(59, Math.round(c.timerSeconds))),
      timerBellEnabled: Boolean(c.timerBellEnabled),
      scoreboardTeamCount: typeof c.scoreboardTeamCount === 'number' ? Math.max(1, Math.round(c.scoreboardTeamCount)) : 4,
      scoreboardTeamNames: Array.isArray(c.scoreboardTeamNames) ? c.scoreboardTeamNames.map(String) : [],
      scoreboardQuickDeltas: Array.isArray(c.scoreboardQuickDeltas) ? c.scoreboardQuickDeltas.map(Number) : [1, 5, 10, -1, -5],
      questionSetId: typeof c.questionSetId === 'string' ? c.questionSetId : null,
      embeddedQuestionSet:
        c.embeddedQuestionSet && typeof c.embeddedQuestionSet === 'object'
          ? (c.embeddedQuestionSet as ToolQuestionSet)
          : null,
      reviewGameMode:
        c.reviewGameMode === 'puzzle' || c.reviewGameMode === 'race' || c.reviewGameMode === 'golden_bell'
          ? c.reviewGameMode
          : undefined,
      reviewRoundSeconds: typeof c.reviewRoundSeconds === 'number' ? c.reviewRoundSeconds : undefined,
      reviewPointsPerCorrect:
        typeof c.reviewPointsPerCorrect === 'number' ? c.reviewPointsPerCorrect : undefined,
      reviewTurnRule:
        c.reviewTurnRule === 'rotate_every_question' || c.reviewTurnRule === 'keep_on_correct'
          ? c.reviewTurnRule
          : undefined,
    },
  };

  return { ok: true, pkg: imported };
}

/**
 * Applies a saved LessonPackage for a FRESH lesson on `targetClass`.
 * - Resets scoreboard scores & history to zero
 * - Resets timer & activity progress to round 1 idle
 * - Pulls students strictly from `targetClass.students`!
 */
export function applyPackageForNewLesson(params: {
  pkg: LessonPackageItem;
  targetClass: { id: string; name: string; students: ToolStudentItem[] };
  nowMs?: number;
}): ClassTeachingSessionState {
  const { pkg, targetClass, nowMs = Date.now() } = params;
  const c = pkg.config;

  const groups = divideStudentsIntoGroups({
    presentStudents: targetClass.students,
    splitMode: c.groupSplitMode,
    groupCount: c.groupCount,
    maxPerGroup: c.maxPerGroup,
    existingNames: c.groupNames,
    shuffleSeed: `pkg_${pkg.packageId}_${targetClass.id}_${nowMs}`,
  });

  const teams: ScoreTeamItem[] =
    groups.length > 0
      ? groups.map((g, idx) => ({
          id: g.id,
          name: c.scoreboardTeamNames[idx] || g.name,
          color: g.color,
          score: 0,
          memberStudentIds: g.studentIds.slice(),
        }))
      : Array.from({ length: Math.max(2, c.scoreboardTeamCount) }, (_, idx) => ({
          id: `sb_team_${idx + 1}`,
          name: c.scoreboardTeamNames[idx] || `Đội ${idx + 1}`,
          color: GROUP_PALETTE[idx % GROUP_PALETTE.length],
          score: 0,
          memberStudentIds: [],
        }));

  const timerMs = (c.timerMinutes * 60 + c.timerSeconds) * 1000;

  return {
    version: 1,
    classId: targetClass.id,
    className: targetClass.name,
    absentStudentIds: [],
    groupsState: {
      splitMode: c.groupSplitMode,
      groupCount: c.groupCount,
      maxPerGroup: c.maxPerGroup,
      groups,
    },
    seatingState: {
      rows: c.seatingRows,
      cols: c.seatingCols,
      blockedSeatKeys: c.blockedSeatKeys.slice(),
      pinnedSeatKeys: [],
      assignments: {},
      orientation: 'front_board',
      lastError: '',
    },
    activityState: {
      mode: c.activityMode,
      stations: c.activityStations.map((st) => ({ ...st })),
      roundDurationSeconds: c.activityRoundDurationSeconds,
      splitMultiTurn: c.activitySplitMultiTurn,
      instructions: c.activityInstructions,
      currentRound: 1,
      totalRounds: Math.max(1, c.activityStations.length),
      status: 'idle',
      roundTargetEndAtMs: null,
      remainingMsWhenPaused: c.activityRoundDurationSeconds * 1000,
      lastError: '',
    },
    timerState: {
      mode: c.timerMode,
      configuredMinutes: c.timerMinutes,
      configuredSeconds: c.timerSeconds,
      bellEnabled: c.timerBellEnabled,
      status: 'idle',
      targetEndAtMs: null,
      remainingMsWhenPaused: timerMs,
      stopwatchStartedAtMs: null,
      elapsedMsWhenPaused: 0,
      bellFiredForRun: false,
    },
    scoreboardState: {
      teams,
      quickDeltas: c.scoreboardQuickDeltas.slice(),
      history: [],
      processedActionIds: [],
    },
    activePackageId: pkg.packageId,
    transferredReviewSessionIds: [],
    pendingReviewGamePrefill: c.questionSetId || c.reviewGameMode
      ? {
          questionSetId: c.questionSetId || c.embeddedQuestionSet?.id || null,
          mode: c.reviewGameMode || 'puzzle',
          secondsPerQuestion: c.reviewRoundSeconds ?? 30,
          pointsPerCorrect: c.reviewPointsPerCorrect ?? 10,
          turnRule: c.reviewTurnRule || 'rotate_every_question',
        }
      : null,
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// ACCOUNT & DEMO ISOLATED STORAGE
// ============================================================================
export function getTeachingToolsScopeKey(accountId?: string | null): string {
  const safeAccount = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_teaching_tools_v1_${safeAccount}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function getClassSessionStorageKey(
  classId: string,
  accountId?: string | null
): string {
  const safeClass = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${getTeachingToolsScopeKey(accountId)}_cls_${safeClass}`;
}

export function getLessonPackagesStorageKey(accountId?: string | null): string {
  return `${getTeachingToolsScopeKey(accountId)}_packages`;
}

export function saveClassTeachingSession(
  session: ClassTeachingSessionState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getClassSessionStorageKey(session.classId, accountId);
    window.localStorage.setItem(key, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function loadClassTeachingSession(
  classId: string,
  accountId?: string | null
): ClassTeachingSessionState | null {
  if (typeof window === 'undefined') return null;
  const key = getClassSessionStorageKey(classId, accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClassTeachingSessionState>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      parsed.classId !== classId ||
      !parsed.groupsState ||
      !parsed.seatingState ||
      !parsed.activityState ||
      !parsed.timerState ||
      !parsed.scoreboardState
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed as ClassTeachingSessionState;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore cleanup error
    }
    return null;
  }
}

export function saveLessonPackagesList(
  packages: LessonPackageItem[],
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getLessonPackagesStorageKey(accountId),
      JSON.stringify(packages)
    );
    return true;
  } catch {
    return false;
  }
}

export function loadLessonPackagesList(
  accountId?: string | null
): LessonPackageItem[] {
  if (typeof window === 'undefined') return [];
  const key = getLessonPackagesStorageKey(accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is LessonPackageItem =>
        Boolean(item) &&
        typeof item === 'object' &&
        item.packageType === 'taydo_lesson_package' &&
        item.schemaVersion === 1
    );
  } catch {
    return [];
  }
}
