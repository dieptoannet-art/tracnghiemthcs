import * as XLSX from 'xlsx';
import { cryptoRandomInt } from '../games/wheel3dMath';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  extractMatrixFromXlsxBuffer,
  parseDelimitedRosterText,
} from './namePickerEngine';
import type { SeatingState, ToolStudentItem } from './teachingToolsEngine';

export const MAX_SEATING_STUDENTS = 50;

export type SeatingViewOrientation = 'front_board' | 'back_of_class';
export type DeskNumberingDirection = 'front_to_back' | 'back_to_front';
export type SeatingColorTheme = 'monochrome' | 'multicolor' | 'bw';
export type SeatingNameDisplayMode = 'full' | 'last_two' | 'stt_name';
export type SeatingAssignmentMode = 'random_valid' | 'balanced_aisles';
export type SeatingRosterScope = 'all_students' | 'present_only';
export type SeatingRosterSourceType = 'real_readonly' | 'sample_editable' | 'imported_local';

export interface SeatingStudentRecord {
  id: string;
  code: string; // String preserving leading zeros like "001"
  fullName: string;
  present: boolean;
  frontPriority: boolean;
}

export interface SeatingDeskConfig {
  id: string; // Stable internal desk ID (e.g. "desk_a1_1")
  seatIds: string[]; // Stable internal seat IDs inside this desk
}

export interface SeatingAisleConfig {
  id: string; // Stable internal aisle ID (e.g. "aisle_1")
  name: string; // e.g. "Dãy 1"
  desks: SeatingDeskConfig[]; // Ordered physically front -> back
}

export interface SeatingRoomConfig {
  aisleCount: number;
  defaultDesksPerAisle: number;
  defaultSeatsPerDesk: number;
  deskNumbering: DeskNumberingDirection;
  aisles: SeatingAisleConfig[];
}

export interface SeatingClassMeta {
  className: string;
  teacherName: string;
  academicNote: string; // Năm học / Học kỳ
  createdDateIso: string; // YYYY-MM-DD
  showDateOnChart: boolean;
}

export interface SeatingConstraintsConfig {
  assignmentMode: SeatingAssignmentMode;
  frontPriorityDeskCount: number; // Number of front-most desks per aisle considered "gần bảng"
  noSameDeskPairs: [string, string][]; // Pairs of student IDs that MUST NOT share a desk
}

export interface SeatingRevealTurn {
  turnId: string;
  previousAssignments?: Record<string, string | null>;
  committedAssignments: Record<string, string | null>;
  revealOrderSeatIds: string[];
  balanceNote: string;
  unmetPriorityNames: string[];
  status: 'animating' | 'revealed';
  startedAtMs: number;
  durationSeconds: number;
}

export interface SeatingUndoSnapshot {
  actionLabel: string;
  timestampMs: number;
  room: SeatingRoomConfig;
  assignments: Record<string, string | null>;
  lockedSeatIds: string[];
  pinnedSeatIds: string[];
  students: SeatingStudentRecord[];
  constraints: SeatingConstraintsConfig;
}

export interface SeatingProState {
  version: 2;
  classId: string;
  sourceType: SeatingRosterSourceType;
  meta: SeatingClassMeta;
  students: SeatingStudentRecord[];
  rosterScope: SeatingRosterScope;
  nameDisplayMode: SeatingNameDisplayMode;
  colorTheme: SeatingColorTheme;
  orientation: SeatingViewOrientation;
  effectDurationSeconds: number; // Default 30s
  room: SeatingRoomConfig;
  lockedSeatIds: string[];
  pinnedSeatIds: string[];
  assignments: Record<string, string | null>; // seatId -> studentId
  constraints: SeatingConstraintsConfig;
  activeReveal: SeatingRevealTurn | null;
  lastBalanceNote: string;
  lastUnmetPriorities: string[];
  lastError: string;
  undoStack: SeatingUndoSnapshot[];
  updatedAtMs: number;
}

export interface SeatResolvedLocation {
  seatId: string;
  aisleId: string;
  aisleIndex: number; // 0-based left-to-right physical
  aisleName: string;
  deskId: string;
  deskPhysicalIndex: number; // 0-based front-to-back physical
  deskDisplayNumber: number; // Respects deskNumbering
  seatIndexInDesk: number; // 0-based left-to-right inside desk
  seatDisplayNumber: number; // 1-based
  deskLabel: string; // e.g. "Dãy 2 – Bàn 1"
  fullSeatLabel: string; // e.g. "Dãy 2 – Bàn 1 – Chỗ 3"
}

export interface RoomCapacitySummary {
  totalSeats: number;
  lockedSeats: number;
  availableSeats: number;
  assignedSeats: number;
  emptyAvailableSeats: number;
  pinnedCount: number;
}

export interface ConfigImpactReport {
  hasImpact: boolean;
  lostSeats: {
    seatId: string;
    label: string;
    studentId: string | null;
    studentName: string | null;
    wasPinned: boolean;
  }[];
  affectedStudentNames: string[];
}

export interface AisleStatItem {
  aisleId: string;
  aisleName: string;
  assignedCount: number;
  pinnedCount: number;
  availableCount: number;
  totalCount: number;
}

export interface SeatingStatsSummary {
  aisles: AisleStatItem[];
  minAssigned: number;
  maxAssigned: number;
  spread: number;
}

// ============================================================================
// ID & DATE HELPERS
// ============================================================================
export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatIsoDateVi(isoDate: string): string {
  const parts = (isoDate || '').split('-');
  if (parts.length !== 3) return isoDate || getTodayIsoDate();
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function makeStableDeskId(aisleIdx: number, deskOrdinal: number, suffix?: string): string {
  return suffix
    ? `desk_a${aisleIdx + 1}_d${deskOrdinal}_${suffix}`
    : `desk_a${aisleIdx + 1}_d${deskOrdinal}`;
}

function makeStableSeatId(deskId: string, seatOrdinal: number): string {
  return `${deskId}_s${seatOrdinal}`;
}

// ============================================================================
// DEFAULT ROOM: 3 DÃY × 6 BÀN × 2 CHỖ = 36 GHẾ
// ============================================================================
export function createDefaultRoomConfig(
  aisleCount = 3,
  desksPerAisle = 6,
  seatsPerDesk = 2,
  deskNumbering: DeskNumberingDirection = 'front_to_back'
): SeatingRoomConfig {
  const aCnt = Math.max(1, Math.min(6, Math.round(aisleCount)));
  const dCnt = Math.max(1, Math.min(12, Math.round(desksPerAisle)));
  const sCnt = Math.max(1, Math.min(4, Math.round(seatsPerDesk)));

  const aisles: SeatingAisleConfig[] = Array.from({ length: aCnt }, (_, aIdx) => {
    const desks: SeatingDeskConfig[] = Array.from({ length: dCnt }, (_, dIdx) => {
      const deskId = makeStableDeskId(aIdx, dIdx + 1);
      const seatIds = Array.from({ length: sCnt }, (_, sIdx) =>
        makeStableSeatId(deskId, sIdx + 1)
      );
      return { id: deskId, seatIds };
    });
    return {
      id: `aisle_${aIdx + 1}`,
      name: `Dãy ${aIdx + 1}`,
      desks,
    };
  });

  return {
    aisleCount: aCnt,
    defaultDesksPerAisle: dCnt,
    defaultSeatsPerDesk: sCnt,
    deskNumbering,
    aisles,
  };
}

export function indexRoomSeats(room: SeatingRoomConfig): {
  locationsById: Map<string, SeatResolvedLocation>;
  orderedSeatIds: string[];
  deskMap: Map<string, { aisleIndex: number; aisleName: string; deskPhysicalIndex: number; deskDisplayNumber: number; deskLabel: string; seatIds: string[] }>;
} {
  const locationsById = new Map<string, SeatResolvedLocation>();
  const orderedSeatIds: string[] = [];
  const deskMap = new Map<
    string,
    {
      aisleIndex: number;
      aisleName: string;
      deskPhysicalIndex: number;
      deskDisplayNumber: number;
      deskLabel: string;
      seatIds: string[];
    }
  >();

  room.aisles.forEach((aisle, aIdx) => {
    const totalDesks = aisle.desks.length;
    aisle.desks.forEach((desk, dIdx) => {
      const displayNum =
        room.deskNumbering === 'front_to_back' ? dIdx + 1 : totalDesks - dIdx;
      const deskLabel = `${aisle.name} – Bàn ${displayNum}`;
      deskMap.set(desk.id, {
        aisleIndex: aIdx,
        aisleName: aisle.name,
        deskPhysicalIndex: dIdx,
        deskDisplayNumber: displayNum,
        deskLabel,
        seatIds: desk.seatIds.slice(),
      });
      desk.seatIds.forEach((seatId, sIdx) => {
        orderedSeatIds.push(seatId);
        locationsById.set(seatId, {
          seatId,
          aisleId: aisle.id,
          aisleIndex: aIdx,
          aisleName: aisle.name,
          deskId: desk.id,
          deskPhysicalIndex: dIdx,
          deskDisplayNumber: displayNum,
          seatIndexInDesk: sIdx,
          seatDisplayNumber: sIdx + 1,
          deskLabel,
          fullSeatLabel: `${deskLabel} – Chỗ ${sIdx + 1}`,
        });
      });
    });
  });

  return { locationsById, orderedSeatIds, deskMap };
}

export function getRoomCapacitySummary(state: SeatingProState): RoomCapacitySummary {
  const { orderedSeatIds } = indexRoomSeats(state.room);
  const validSet = new Set(orderedSeatIds);
  const lockedSet = new Set(state.lockedSeatIds.filter((id) => validSet.has(id)));
  const pinnedSet = new Set(
    state.pinnedSeatIds.filter((id) => validSet.has(id) && !lockedSet.has(id))
  );

  let assignedSeats = 0;
  for (const sId of orderedSeatIds) {
    if (!lockedSet.has(sId) && state.assignments[sId]) {
      assignedSeats++;
    }
  }

  const totalSeats = orderedSeatIds.length;
  const lockedSeats = lockedSet.size;
  const availableSeats = totalSeats - lockedSeats;

  return {
    totalSeats,
    lockedSeats,
    availableSeats,
    assignedSeats,
    emptyAvailableSeats: Math.max(0, availableSeats - assignedSeats),
    pinnedCount: pinnedSet.size,
  };
}

// ============================================================================
// SAMPLE ROSTERS & INITIALIZATION + LEGACY ĐỢT 1 MIGRATION
// ============================================================================
export function createSeatingSampleStudents(
  preset: 'standard_36' | 'sample_25' | 'sample_50' | 'sample_1' | 'sample_dup_absent' | 'sample_empty'
): SeatingStudentRecord[] {
  const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Đặng', 'Bùi', 'Đỗ'];
  const middles = ['Văn', 'Minh', 'Ngọc', 'Thanh', 'Gia', 'Bảo', 'Hoàng', 'Phương'];
  const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hiếu', 'Hương', 'Khang', 'Linh', 'Mai', 'Nam', 'Nhi', 'Quân', 'Thảo', 'Trang'];

  const build = (count: number): SeatingStudentRecord[] =>
    Array.from({ length: count }, (_, idx) => ({
      id: `seat_sample_s_${String(idx + 1).padStart(3, '0')}`,
      code: String(idx + 1).padStart(3, '0'),
      fullName: `${surnames[idx % surnames.length]} ${middles[(idx * 3) % middles.length]} ${firstNames[(idx * 5) % firstNames.length]}`,
      present: true,
      frontPriority: false,
    }));

  switch (preset) {
    case 'sample_empty':
      return [];
    case 'sample_1':
      return build(1);
    case 'sample_25':
      return build(25);
    case 'sample_50': {
      const list = build(50);
      list[0].fullName = 'Nguyễn Minh An';
      list[1].fullName = 'Nguyễn Minh An';
      return list;
    }
    case 'sample_dup_absent':
      return [
        { id: 'dup_001', code: '001', fullName: 'Nguyễn Văn An', present: true, frontPriority: false },
        { id: 'dup_002', code: '002', fullName: 'Nguyễn Văn An', present: true, frontPriority: false },
        { id: 'dup_003', code: '003', fullName: 'Trần Thị Bình', present: false, frontPriority: false },
        { id: 'dup_004', code: '004', fullName: 'Lê Hoàng Châu', present: true, frontPriority: false },
        { id: 'dup_005', code: '005', fullName: 'Phạm Gia Huy', present: true, frontPriority: false },
        { id: 'dup_006', code: '006', fullName: 'Đỗ Phương Thảo', present: true, frontPriority: false },
      ];
    case 'standard_36':
    default:
      return build(36);
  }
}

export function createInitialSeatingProState(params: {
  classId: string;
  className: string;
  teacherName?: string;
  sourceType: SeatingRosterSourceType;
  students: { id: string; code: string; fullName: string; present?: boolean }[];
  legacySeating?: SeatingState | null;
}): SeatingProState {
  const {
    classId,
    className,
    teacherName = 'Giáo viên phụ trách',
    sourceType,
    students,
    legacySeating,
  } = params;

  const roster: SeatingStudentRecord[] = students.slice(0, MAX_SEATING_STUDENTS).map((s, idx) => ({
    id: s.id || `${classId}_stu_${idx + 1}`,
    code: String(s.code || String(idx + 1).padStart(3, '0')).trim(),
    fullName: (s.fullName || `Học sinh ${idx + 1}`).trim(),
    present: s.present ?? true,
    frontPriority: false,
  }));

  // Migrate legacy Đợt 1 saved seating ONLY if it actually contains saved placements/blocks/pins;
  // otherwise initialize the clean 3 dãy × 6 bàn × 2 chỗ = 36 ghế default!
  const hasLegacyContent = Boolean(
    legacySeating &&
      (Object.keys(legacySeating.assignments || {}).length > 0 ||
        (legacySeating.blockedSeatKeys || []).length > 0 ||
        (legacySeating.pinnedSeatKeys || []).length > 0)
  );

  if (hasLegacyContent && legacySeating) {
    return migrateLegacySeatingToProState({
      classId,
      className,
      teacherName,
      sourceType,
      students: roster,
      legacySeating,
    });
  }

  return {
    version: 2,
    classId,
    sourceType,
    meta: {
      className,
      teacherName,
      academicNote: 'Năm học 2026–2027',
      createdDateIso: getTodayIsoDate(),
      showDateOnChart: true,
    },
    students: roster,
    rosterScope: 'present_only',
    nameDisplayMode: 'full',
    colorTheme: 'monochrome',
    orientation: 'front_board',
    effectDurationSeconds: 30,
    room: createDefaultRoomConfig(3, 6, 2, 'front_to_back'),
    lockedSeatIds: [],
    pinnedSeatIds: [],
    assignments: {},
    constraints: {
      assignmentMode: 'balanced_aisles',
      frontPriorityDeskCount: 2,
      noSameDeskPairs: [],
    },
    activeReveal: null,
    lastBalanceNote: '',
    lastUnmetPriorities: [],
    lastError: '',
    undoStack: [],
    updatedAtMs: Date.now(),
  };
}

/**
 * Seamlessly upgrades a saved Đợt 1 `SeatingState` (row × col grid) into the
 * structured Dãy → Bàn → Chỗ room model without losing assignments, pins, or blocked seats.
 */
export function migrateLegacySeatingToProState(params: {
  classId: string;
  className: string;
  teacherName?: string;
  sourceType: SeatingRosterSourceType;
  students: SeatingStudentRecord[];
  legacySeating: SeatingState;
}): SeatingProState {
  const {
    classId,
    className,
    teacherName = 'Giáo viên phụ trách',
    sourceType,
    students,
    legacySeating,
  } = params;

  const desksPerAisle = Math.max(1, Math.min(12, legacySeating.rows || 5));
  const cols = Math.max(1, Math.min(12, legacySeating.cols || 10));
  const aisleCount = cols <= 2 ? 1 : Math.min(5, Math.ceil(cols / 2));

  // Distribute legacy `cols` cleanly across `aisleCount` aisles (usually 2 seats per desk)
  const aisleColSlices: number[][] = Array.from({ length: aisleCount }, () => []);
  for (let c = 0; c < cols; c++) {
    const aIdx = Math.min(aisleCount - 1, Math.floor((c * aisleCount) / cols));
    aisleColSlices[aIdx].push(c);
  }

  const keyToSeatId = new Map<string, string>();
  const aisles: SeatingAisleConfig[] = aisleColSlices.map((colIndices, aIdx) => {
    const desks: SeatingDeskConfig[] = Array.from({ length: desksPerAisle }, (_, dIdx) => {
      const deskId = makeStableDeskId(aIdx, dIdx + 1);
      const seatIds = colIndices.map((c, sIdx) => {
        const seatId = makeStableSeatId(deskId, sIdx + 1);
        keyToSeatId.set(`${dIdx}-${c}`, seatId);
        return seatId;
      });
      return { id: deskId, seatIds };
    });
    return {
      id: `aisle_${aIdx + 1}`,
      name: `Dãy ${aIdx + 1}`,
      desks,
    };
  });

  const assignments: Record<string, string | null> = {};
  for (const [legacyKey, studentId] of Object.entries(legacySeating.assignments || {})) {
    const newSeatId = keyToSeatId.get(legacyKey);
    if (newSeatId && studentId) {
      assignments[newSeatId] = studentId;
    }
  }

  const lockedSeatIds = (legacySeating.blockedSeatKeys || [])
    .map((k) => keyToSeatId.get(k))
    .filter((id): id is string => Boolean(id));
  const pinnedSeatIds = (legacySeating.pinnedSeatKeys || [])
    .map((k) => keyToSeatId.get(k))
    .filter((id): id is string => Boolean(id));

  return {
    version: 2,
    classId,
    sourceType,
    meta: {
      className,
      teacherName,
      academicNote: 'Năm học 2026–2027',
      createdDateIso: getTodayIsoDate(),
      showDateOnChart: true,
    },
    students,
    rosterScope: 'present_only',
    nameDisplayMode: 'full',
    colorTheme: 'monochrome',
    orientation: legacySeating.orientation === 'back_of_class' ? 'back_of_class' : 'front_board',
    effectDurationSeconds: 30,
    room: {
      aisleCount,
      defaultDesksPerAisle: desksPerAisle,
      defaultSeatsPerDesk: Math.max(1, Math.round(cols / aisleCount)),
      deskNumbering: 'front_to_back',
      aisles,
    },
    lockedSeatIds,
    pinnedSeatIds,
    assignments,
    constraints: {
      assignmentMode: 'balanced_aisles',
      frontPriorityDeskCount: 2,
      noSameDeskPairs: [],
    },
    activeReveal: null,
    lastBalanceNote: '',
    lastUnmetPriorities: [],
    lastError: legacySeating.lastError || '',
    undoStack: [],
    updatedAtMs: Date.now(),
  };
}

/**
 * Syncs upstream real roster into local state without touching assignments/pins unless IDs disappear.
 */
export function syncSeatingWithUpstreamStudents(
  state: SeatingProState,
  upstream: ToolStudentItem[]
): SeatingProState {
  if (state.sourceType !== 'real_readonly') return state;
  const prevMap = new Map(state.students.map((s) => [s.id, s]));
  const merged: SeatingStudentRecord[] = upstream.slice(0, MAX_SEATING_STUDENTS).map((u, idx) => {
    const old = prevMap.get(u.id);
    return {
      id: u.id,
      code: String(u.code || String(idx + 1).padStart(3, '0')),
      fullName: u.fullName,
      present: old ? old.present : true,
      frontPriority: old ? old.frontPriority : false,
    };
  });
  return {
    ...state,
    students: merged,
  };
}

// ============================================================================
// STUDENT NAME FORMATTING & DISAMBIGUATION
// ============================================================================
export function formatStudentDisplayName(params: {
  student: SeatingStudentRecord;
  sttIndex: number; // 1-based position in student list
  mode: SeatingNameDisplayMode;
  allStudents: SeatingStudentRecord[];
}): { primary: string; secondaryCode: string | null } {
  const { student, sttIndex, mode, allStudents } = params;
  const sttStr = String(sttIndex).padStart(2, '0');
  const full = student.fullName.trim();
  const words = full.split(/\s+/).filter(Boolean);
  const lastTwo = words.length <= 2 ? full : `${words[words.length - 2]} ${words[words.length - 1]}`;

  if (mode === 'stt_name') {
    const dupFull = allStudents.filter((s) => s.fullName.trim() === full).length > 1;
    return {
      primary: `${sttStr}. ${full}`,
      secondaryCode: dupFull ? `Mã ${student.code}` : null,
    };
  }

  if (mode === 'last_two') {
    const dupLastTwo =
      allStudents.filter((s) => {
        const w = s.fullName.trim().split(/\s+/).filter(Boolean);
        const l2 = w.length <= 2 ? s.fullName.trim() : `${w[w.length - 2]} ${w[w.length - 1]}`;
        return l2.toLowerCase() === lastTwo.toLowerCase();
      }).length > 1;

    return {
      primary: dupLastTwo ? `${sttStr}. ${lastTwo}` : lastTwo,
      secondaryCode: dupLastTwo ? `Mã ${student.code}` : null,
    };
  }

  // 'full'
  const dupFull = allStudents.filter((s) => s.fullName.trim() === full).length > 1;
  return {
    primary: full,
    secondaryCode: dupFull ? `STT ${sttStr} · Mã ${student.code}` : null,
  };
}

// ============================================================================
// ELIGIBLE STUDENTS & UNDO SNAPSHOT HELPERS
// ============================================================================
export function getEligibleSeatingStudents(state: SeatingProState): SeatingStudentRecord[] {
  return state.rosterScope === 'present_only'
    ? state.students.filter((s) => s.present)
    : state.students.slice();
}

export function getUnassignedStudents(state: SeatingProState): SeatingStudentRecord[] {
  const eligible = getEligibleSeatingStudents(state);
  const { orderedSeatIds } = indexRoomSeats(state.room);
  const validSet = new Set(orderedSeatIds);
  const lockedSet = new Set(state.lockedSeatIds);

  const placedIds = new Set<string>();
  for (const [seatId, stuId] of Object.entries(state.assignments)) {
    if (stuId && validSet.has(seatId) && !lockedSet.has(seatId)) {
      placedIds.add(stuId);
    }
  }
  return eligible.filter((s) => !placedIds.has(s.id));
}

function pushUndoSnapshot(state: SeatingProState, actionLabel: string): SeatingUndoSnapshot[] {
  const snap: SeatingUndoSnapshot = {
    actionLabel,
    timestampMs: Date.now(),
    room: JSON.parse(JSON.stringify(state.room)) as SeatingRoomConfig,
    assignments: { ...state.assignments },
    lockedSeatIds: state.lockedSeatIds.slice(),
    pinnedSeatIds: state.pinnedSeatIds.slice(),
    students: state.students.map((s) => ({ ...s })),
    constraints: {
      ...state.constraints,
      noSameDeskPairs: state.constraints.noSameDeskPairs.map((p) => [p[0], p[1]]),
    },
  };
  return [snap, ...state.undoStack].slice(0, 25);
}

export function undoLastSeatingAction(state: SeatingProState): SeatingProState {
  if (state.undoStack.length === 0) return state;
  const [latest, ...rest] = state.undoStack;
  return {
    ...state,
    room: latest.room,
    assignments: latest.assignments,
    lockedSeatIds: latest.lockedSeatIds,
    pinnedSeatIds: latest.pinnedSeatIds,
    students: latest.students,
    constraints: latest.constraints,
    undoStack: rest,
    activeReveal: null,
    lastError: '',
    updatedAtMs: Date.now(),
  };
}

// ============================================================================
// ROOM CONFIGURATION & SAFE IMPACT DETECTION
// ============================================================================
export function rebuildRoomGridDimensions(
  current: SeatingRoomConfig,
  aisleCount: number,
  desksPerAisle: number,
  seatsPerDesk: number
): SeatingRoomConfig {
  const nextA = Math.max(1, Math.min(6, Math.round(aisleCount || 1)));
  const nextD = Math.max(1, Math.min(12, Math.round(desksPerAisle || 1)));
  const nextS = Math.max(1, Math.min(4, Math.round(seatsPerDesk || 1)));

  const aisles: SeatingAisleConfig[] = Array.from({ length: nextA }, (_, aIdx) => {
    const existingAisle = current.aisles[aIdx];
    const desks: SeatingDeskConfig[] = Array.from({ length: nextD }, (_, dIdx) => {
      const existingDesk = existingAisle?.desks[dIdx];
      const deskId = existingDesk?.id || makeStableDeskId(aIdx, dIdx + 1);
      const seatIds = Array.from({ length: nextS }, (_, sIdx) => {
        return existingDesk?.seatIds[sIdx] || makeStableSeatId(deskId, sIdx + 1);
      });
      return { id: deskId, seatIds };
    });
    return {
      id: existingAisle?.id || `aisle_${aIdx + 1}`,
      name: existingAisle?.name || `Dãy ${aIdx + 1}`,
      desks,
    };
  });

  return {
    aisleCount: nextA,
    defaultDesksPerAisle: nextD,
    defaultSeatsPerDesk: nextS,
    deskNumbering: current.deskNumbering,
    aisles,
  };
}

export function adjustDeskSeatCount(
  room: SeatingRoomConfig,
  aisleId: string,
  deskId: string,
  nextSeatCount: number
): SeatingRoomConfig {
  const sCnt = Math.max(1, Math.min(4, Math.round(nextSeatCount || 1)));
  return {
    ...room,
    aisles: room.aisles.map((a) => {
      if (a.id !== aisleId) return a;
      return {
        ...a,
        desks: a.desks.map((d) => {
          if (d.id !== deskId) return d;
          const seatIds = Array.from({ length: sCnt }, (_, idx) => {
            return d.seatIds[idx] || makeStableSeatId(d.id, idx + 1);
          });
          return { ...d, seatIds };
        }),
      };
    }),
  };
}

export function addDeskToAisle(room: SeatingRoomConfig, aisleId: string): SeatingRoomConfig {
  return {
    ...room,
    aisles: room.aisles.map((a, aIdx) => {
      if (a.id !== aisleId || a.desks.length >= 12) return a;
      const uniqueSuffix = Date.now().toString(36).slice(-3);
      const nextOrdinal = a.desks.length + 1;
      let deskId = makeStableDeskId(aIdx, nextOrdinal);
      if (a.desks.some((d) => d.id === deskId)) {
        deskId = makeStableDeskId(aIdx, nextOrdinal, uniqueSuffix);
      }
      const seatIds = Array.from(
        { length: Math.max(1, room.defaultSeatsPerDesk) },
        (_, sIdx) => makeStableSeatId(deskId, sIdx + 1)
      );
      return {
        ...a,
        desks: [...a.desks, { id: deskId, seatIds }],
      };
    }),
  };
}

export function removeDeskFromAisle(
  room: SeatingRoomConfig,
  aisleId: string,
  deskId: string
): SeatingRoomConfig {
  return {
    ...room,
    aisles: room.aisles.map((a) => {
      if (a.id !== aisleId || a.desks.length <= 1) return a;
      return {
        ...a,
        desks: a.desks.filter((d) => d.id !== deskId),
      };
    }),
  };
}

export function evaluateRoomChangeImpact(
  state: SeatingProState,
  candidateRoom: SeatingRoomConfig
): ConfigImpactReport {
  const { locationsById } = indexRoomSeats(state.room);
  const { orderedSeatIds: nextSeatIds } = indexRoomSeats(candidateRoom);
  const nextSet = new Set(nextSeatIds);
  const pinnedSet = new Set(state.pinnedSeatIds);
  const studentMap = new Map(state.students.map((s) => [s.id, s]));

  const lostSeats: ConfigImpactReport['lostSeats'] = [];
  const affectedNamesSet = new Set<string>();

  for (const [seatId, loc] of locationsById.entries()) {
    if (nextSet.has(seatId)) continue;
    const stuId = state.assignments[seatId] || null;
    const wasPinned = pinnedSet.has(seatId);
    if (stuId || wasPinned) {
      const stu = stuId ? studentMap.get(stuId) : null;
      if (stu) affectedNamesSet.add(stu.fullName);
      lostSeats.push({
        seatId,
        label: loc.fullSeatLabel,
        studentId: stuId,
        studentName: stu ? stu.fullName : null,
        wasPinned,
      });
    }
  }

  return {
    hasImpact: lostSeats.length > 0,
    lostSeats,
    affectedStudentNames: Array.from(affectedNamesSet),
  };
}

export function applyCandidateRoomConfig(
  state: SeatingProState,
  candidateRoom: SeatingRoomConfig,
  actionLabel = 'Thay đổi cấu hình phòng học'
): SeatingProState {
  const { orderedSeatIds } = indexRoomSeats(candidateRoom);
  const validSet = new Set(orderedSeatIds);

  const nextAssignments: Record<string, string | null> = {};
  for (const [seatId, stuId] of Object.entries(state.assignments)) {
    if (validSet.has(seatId) && stuId) {
      nextAssignments[seatId] = stuId;
    }
  }

  return {
    ...state,
    undoStack: pushUndoSnapshot(state, actionLabel),
    room: candidateRoom,
    lockedSeatIds: state.lockedSeatIds.filter((id) => validSet.has(id)),
    pinnedSeatIds: state.pinnedSeatIds.filter((id) => validSet.has(id)),
    assignments: nextAssignments,
    activeReveal: null,
    lastError: '',
    updatedAtMs: Date.now(),
  };
}

// ============================================================================
// MANUAL EDITING: SWAP, LOCK, PIN, CLEAR / LÀM LẠI
// ============================================================================
function buildNoSameDeskMap(pairs: [string, string][]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [a, b] of pairs) {
    if (!a || !b || a === b) continue;
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a)!.add(b);
    map.get(b)!.add(a);
  }
  return map;
}

function checkDeskPairViolation(params: {
  deskId: string;
  candidateStudentId: string;
  ignoreSeatId?: string;
  assignments: Record<string, string | null>;
  deskMap: ReturnType<typeof indexRoomSeats>['deskMap'];
  noSameMap: Map<string, Set<string>>;
  studentMap: Map<string, SeatingStudentRecord>;
}): string | null {
  const forbidden = params.noSameMap.get(params.candidateStudentId);
  if (!forbidden || forbidden.size === 0) return null;
  const desk = params.deskMap.get(params.deskId);
  if (!desk) return null;

  for (const sId of desk.seatIds) {
    if (sId === params.ignoreSeatId) continue;
    const otherId = params.assignments[sId];
    if (otherId && forbidden.has(otherId)) {
      const stuA = params.studentMap.get(params.candidateStudentId)?.fullName || params.candidateStudentId;
      const stuB = params.studentMap.get(otherId)?.fullName || otherId;
      return `Vi phạm ràng buộc "Không ngồi cùng bàn" tại ${desk.deskLabel}: ${stuA} và ${stuB} không được xếp chung bàn.`;
    }
  }
  return null;
}

export function swapOrMoveSeatAction(
  state: SeatingProState,
  seatIdA: string,
  seatIdB: string
): { ok: boolean; error?: string; nextState: SeatingProState } {
  if (seatIdA === seatIdB) return { ok: true, nextState: state };
  const { locationsById, deskMap } = indexRoomSeats(state.room);
  const locA = locationsById.get(seatIdA);
  const locB = locationsById.get(seatIdB);
  if (!locA || !locB) {
    return { ok: false, error: 'Ghế không tồn tại.', nextState: state };
  }

  const lockedSet = new Set(state.lockedSeatIds);
  if (lockedSet.has(seatIdA) || lockedSet.has(seatIdB)) {
    return {
      ok: false,
      error: 'Ghế đang bị khóa không thể nhận học sinh hoặc đổi chỗ.',
      nextState: { ...state, lastError: 'Ghế đang bị khóa không thể nhận học sinh hoặc đổi chỗ.' },
    };
  }

  const pinnedSet = new Set(state.pinnedSeatIds);
  const stuA = state.assignments[seatIdA] || null;
  const stuB = state.assignments[seatIdB] || null;
  if (!stuA && !stuB) return { ok: true, nextState: state };

  if (stuA && pinnedSet.has(seatIdA)) {
    const stuName = state.students.find((s) => s.id === stuA)?.fullName || 'Học sinh';
    const msg = `${stuName} đang được ghim tại ${locA.fullSeatLabel}. Hãy bỏ ghim trước khi di chuyển.`;
    return { ok: false, error: msg, nextState: { ...state, lastError: msg } };
  }
  if (stuB && pinnedSet.has(seatIdB)) {
    const stuName = state.students.find((s) => s.id === stuB)?.fullName || 'Học sinh';
    const msg = `${stuName} đang được ghim tại ${locB.fullSeatLabel}. Hãy bỏ ghim trước khi đổi chỗ.`;
    return { ok: false, error: msg, nextState: { ...state, lastError: msg } };
  }

  // Enforce "Không ngồi cùng bàn" on manual swaps!
  const nextAssignments = { ...state.assignments };
  if (stuB) nextAssignments[seatIdA] = stuB;
  else delete nextAssignments[seatIdA];

  if (stuA) nextAssignments[seatIdB] = stuA;
  else delete nextAssignments[seatIdB];

  const noSameMap = buildNoSameDeskMap(state.constraints.noSameDeskPairs);
  const studentMap = new Map(state.students.map((s) => [s.id, s]));

  if (stuA) {
    const errA = checkDeskPairViolation({
      deskId: locB.deskId,
      candidateStudentId: stuA,
      ignoreSeatId: seatIdB,
      assignments: nextAssignments,
      deskMap,
      noSameMap,
      studentMap,
    });
    if (errA) {
      return { ok: false, error: errA, nextState: { ...state, lastError: errA } };
    }
  }
  if (stuB) {
    const errB = checkDeskPairViolation({
      deskId: locA.deskId,
      candidateStudentId: stuB,
      ignoreSeatId: seatIdA,
      assignments: nextAssignments,
      deskMap,
      noSameMap,
      studentMap,
    });
    if (errB) {
      return { ok: false, error: errB, nextState: { ...state, lastError: errB } };
    }
  }

  return {
    ok: true,
    nextState: {
      ...state,
      undoStack: pushUndoSnapshot(state, stuA && stuB ? 'Đổi chỗ 2 học sinh' : 'Chuyển sang ghế trống'),
      assignments: nextAssignments,
      lastError: '',
      updatedAtMs: Date.now(),
    },
  };
}

export function assignWaitingStudentToSeat(
  state: SeatingProState,
  studentId: string,
  targetSeatId: string
): { ok: boolean; error?: string; nextState: SeatingProState } {
  const { locationsById, deskMap } = indexRoomSeats(state.room);
  const loc = locationsById.get(targetSeatId);
  if (!loc) return { ok: false, error: 'Ghế không tồn tại.', nextState: state };
  if (state.lockedSeatIds.includes(targetSeatId)) {
    return { ok: false, error: 'Ghế đang bị khóa.', nextState: { ...state, lastError: 'Ghế đang bị khóa.' } };
  }
  if (state.pinnedSeatIds.includes(targetSeatId) && state.assignments[targetSeatId]) {
    return {
      ok: false,
      error: 'Ghế đích đang có học sinh được ghim. Hãy bỏ ghim trước.',
      nextState: { ...state, lastError: 'Ghế đích đang có học sinh được ghim. Hãy bỏ ghim trước.' },
    };
  }

  const nextAssignments = { ...state.assignments };
  for (const [sId, assignedId] of Object.entries(nextAssignments)) {
    if (assignedId === studentId) delete nextAssignments[sId];
  }
  nextAssignments[targetSeatId] = studentId;

  const noSameMap = buildNoSameDeskMap(state.constraints.noSameDeskPairs);
  const studentMap = new Map(state.students.map((s) => [s.id, s]));
  const err = checkDeskPairViolation({
    deskId: loc.deskId,
    candidateStudentId: studentId,
    ignoreSeatId: targetSeatId,
    assignments: nextAssignments,
    deskMap,
    noSameMap,
    studentMap,
  });
  if (err) {
    return { ok: false, error: err, nextState: { ...state, lastError: err } };
  }

  return {
    ok: true,
    nextState: {
      ...state,
      undoStack: pushUndoSnapshot(state, 'Xếp học sinh từ danh sách chờ'),
      assignments: nextAssignments,
      lastError: '',
      updatedAtMs: Date.now(),
    },
  };
}

export function toggleSeatPinAction(
  state: SeatingProState,
  seatId: string
): { ok: boolean; error?: string; nextState: SeatingProState } {
  const { locationsById } = indexRoomSeats(state.room);
  if (!locationsById.has(seatId)) return { ok: false, nextState: state };
  if (state.lockedSeatIds.includes(seatId)) {
    const msg = 'Không thể ghim ghế đang bị khóa.';
    return { ok: false, error: msg, nextState: { ...state, lastError: msg } };
  }

  const pinnedSet = new Set(state.pinnedSeatIds);
  const willPin = !pinnedSet.has(seatId);
  if (willPin && !state.assignments[seatId]) {
    const msg = 'Chỉ ghim được ghế đã có học sinh ngồi.';
    return { ok: false, error: msg, nextState: { ...state, lastError: msg } };
  }

  if (willPin) pinnedSet.add(seatId);
  else pinnedSet.delete(seatId);

  return {
    ok: true,
    nextState: {
      ...state,
      undoStack: pushUndoSnapshot(state, willPin ? 'Ghim chỗ' : 'Bỏ ghim chỗ'),
      pinnedSeatIds: Array.from(pinnedSet),
      lastError: '',
      updatedAtMs: Date.now(),
    },
  };
}

export function toggleSeatLockAction(
  state: SeatingProState,
  seatId: string,
  confirmedMoveToWaiting = false
): {
  ok: boolean;
  requiresConfirm?: { seatId: string; seatLabel: string; studentName: string };
  error?: string;
  nextState: SeatingProState;
} {
  const { locationsById } = indexRoomSeats(state.room);
  const loc = locationsById.get(seatId);
  if (!loc) return { ok: false, error: 'Ghế không tồn tại.', nextState: state };

  const lockedSet = new Set(state.lockedSeatIds);
  const isCurrentlyLocked = lockedSet.has(seatId);

  if (isCurrentlyLocked) {
    lockedSet.delete(seatId);
    return {
      ok: true,
      nextState: {
        ...state,
        undoStack: pushUndoSnapshot(state, `Mở khóa ${loc.fullSeatLabel}`),
        lockedSeatIds: Array.from(lockedSet),
        lastError: '',
        updatedAtMs: Date.now(),
      },
    };
  }

  // Attempting to LOCK seat:
  if (state.pinnedSeatIds.includes(seatId)) {
    const stuName =
      state.students.find((s) => s.id === state.assignments[seatId])?.fullName || 'học sinh';
    const msg = `Ghế ${loc.fullSeatLabel} đang ghim (${stuName}). Vui lòng bỏ ghim trước khi khóa.`;
    return { ok: false, error: msg, nextState: { ...state, lastError: msg } };
  }

  const occupantId = state.assignments[seatId];
  if (occupantId && !confirmedMoveToWaiting) {
    const studentName =
      state.students.find((s) => s.id === occupantId)?.fullName || occupantId;
    return {
      ok: false,
      requiresConfirm: {
        seatId,
        seatLabel: loc.fullSeatLabel,
        studentName,
      },
      nextState: state,
    };
  }

  lockedSet.add(seatId);
  const nextAssignments = { ...state.assignments };
  delete nextAssignments[seatId];

  return {
    ok: true,
    nextState: {
      ...state,
      undoStack: pushUndoSnapshot(state, `Khóa ${loc.fullSeatLabel}`),
      lockedSeatIds: Array.from(lockedSet),
      assignments: nextAssignments,
      lastError: '',
      updatedAtMs: Date.now(),
    },
  };
}

/**
 * "Làm lại": Xóa các vị trí tự động và đổi chỗ chưa ghim, giữ nguyên cấu hình phòng,
 * ghế khóa và các học sinh đang ghim.
 */
export function resetUnpinnedPlacements(state: SeatingProState): SeatingProState {
  const pinnedSet = new Set(state.pinnedSeatIds);
  const lockedSet = new Set(state.lockedSeatIds);
  const nextAssignments: Record<string, string | null> = {};

  for (const [seatId, stuId] of Object.entries(state.assignments)) {
    if (stuId && pinnedSet.has(seatId) && !lockedSet.has(seatId)) {
      nextAssignments[seatId] = stuId;
    }
  }

  return {
    ...state,
    undoStack: pushUndoSnapshot(state, 'Làm lại sơ đồ (giữ ghế ghim & khóa)'),
    assignments: nextAssignments,
    activeReveal: null,
    lastBalanceNote: '',
    lastUnmetPriorities: [],
    lastError: '',
    updatedAtMs: Date.now(),
  };
}

// ============================================================================
// RANDOM SEATING SOLVER & AISLE BALANCER
// ============================================================================
export interface SeatingSolveResult {
  ok: boolean;
  reason?: string;
  shortageCount?: number;
  timedOut?: boolean;
  nextState: SeatingProState;
}

function validatePreSolveConflicts(state: SeatingProState): {
  ok: boolean;
  reason?: string;
  shortageCount?: number;
  eligibleStudents: SeatingStudentRecord[];
  availableSeatIds: string[];
  pinnedStudentToSeat: Map<string, string>;
} {
  const eligibleStudents = getEligibleSeatingStudents(state);
  const eligibleIds = new Set(eligibleStudents.map((s) => s.id));
  const { locationsById, orderedSeatIds, deskMap } = indexRoomSeats(state.room);
  const lockedSet = new Set(state.lockedSeatIds);
  const availableSeatIds = orderedSeatIds.filter((id) => !lockedSet.has(id));

  if (eligibleStudents.length === 0) {
    return {
      ok: false,
      reason: 'Không có học sinh nào trong phạm vi cần xếp.',
      eligibleStudents,
      availableSeatIds,
      pinnedStudentToSeat: new Map(),
    };
  }

  if (eligibleStudents.length > availableSeatIds.length) {
    const shortage = eligibleStudents.length - availableSeatIds.length;
    return {
      ok: false,
      shortageCount: shortage,
      reason: `Thiếu ${shortage} ghế khả dụng (${eligibleStudents.length} học sinh cần xếp / ${availableSeatIds.length} ghế khả dụng). Hãy thêm bàn/chỗ hoặc mở khóa ghế trước khi xếp.`,
      eligibleStudents,
      availableSeatIds,
      pinnedStudentToSeat: new Map(),
    };
  }

  const studentMap = new Map(state.students.map((s) => [s.id, s]));
  const pinnedStudentToSeat = new Map<string, string>();
  const pinnedSeatToStudent = new Map<string, string>();
  const seatToPinnedConflict = new Map<string, string[]>();

  for (const seatId of state.pinnedSeatIds) {
    if (!locationsById.has(seatId)) continue;
    if (lockedSet.has(seatId)) {
      const loc = locationsById.get(seatId)!;
      return {
        ok: false,
        reason: `Mâu thuẫn: ${loc.fullSeatLabel} vừa bị khóa vừa được ghim.`,
        eligibleStudents,
        availableSeatIds,
        pinnedStudentToSeat,
      };
    }
    const stuId = state.assignments[seatId];
    if (!stuId) continue;

    if (!eligibleIds.has(stuId)) {
      const stuName = studentMap.get(stuId)?.fullName || stuId;
      const loc = locationsById.get(seatId)!;
      return {
        ok: false,
        reason: `${stuName} đang ghim tại ${loc.fullSeatLabel} nhưng hiện đang vắng mặt (không nằm trong danh sách cần xếp). Hãy bỏ ghim hoặc đánh dấu Có mặt.`,
        eligibleStudents,
        availableSeatIds,
        pinnedStudentToSeat,
      };
    }

    if (pinnedStudentToSeat.has(stuId)) {
      const stuName = studentMap.get(stuId)?.fullName || stuId;
      return {
        ok: false,
        reason: `Mâu thuẫn: Học sinh ${stuName} bị ghim trùng ở nhiều hơn một ghế.`,
        eligibleStudents,
        availableSeatIds,
        pinnedStudentToSeat,
      };
    }

    const listAtSeat = seatToPinnedConflict.get(seatId) || [];
    listAtSeat.push(stuId);
    seatToPinnedConflict.set(seatId, listAtSeat);
    pinnedStudentToSeat.set(stuId, seatId);
    pinnedSeatToStudent.set(seatId, stuId);
  }

  // Hard constraint conflict check among pinned seats on the same desk
  const noSameMap = buildNoSameDeskMap(state.constraints.noSameDeskPairs);
  for (const desk of deskMap.values()) {
    const pinnedInDesk: string[] = [];
    for (const sId of desk.seatIds) {
      const stuId = pinnedSeatToStudent.get(sId);
      if (stuId) pinnedInDesk.push(stuId);
    }
    for (let i = 0; i < pinnedInDesk.length; i++) {
      for (let j = i + 1; j < pinnedInDesk.length; j++) {
        const a = pinnedInDesk[i];
        const b = pinnedInDesk[j];
        if (noSameMap.get(a)?.has(b)) {
          const nameA = studentMap.get(a)?.fullName || a;
          const nameB = studentMap.get(b)?.fullName || b;
          return {
            ok: false,
            reason: `Mâu thuẫn trước khi xếp tại ${desk.deskLabel}: "${nameA}" và "${nameB}" đều đang được ghim vào cùng một bàn nhưng nằm trong cặp "Không ngồi cùng bàn". Hãy bỏ ghim một trong hai em.`,
            eligibleStudents,
            availableSeatIds,
            pinnedStudentToSeat,
          };
        }
      }
    }
  }

  return {
    ok: true,
    eligibleStudents,
    availableSeatIds,
    pinnedStudentToSeat,
  };
}

function computeBalancedAisleTargets(params: {
  totalStudents: number;
  aisleIds: string[];
  pinnedByAisle: Map<string, number>;
  availableByAisle: Map<string, number>;
  rngInt: (max: number) => number;
}): { targets: Map<string, number>; idealAchieved: boolean; reasonNote: string } {
  const { totalStudents, aisleIds, pinnedByAisle, availableByAisle, rngInt } = params;
  const targets = new Map<string, number>();
  const aCount = aisleIds.length;
  if (aCount === 0) return { targets, idealAchieved: true, reasonNote: '' };

  for (const aId of aisleIds) {
    targets.set(aId, pinnedByAisle.get(aId) || 0);
  }

  let remaining =
    totalStudents - aisleIds.reduce((sum, aId) => sum + (pinnedByAisle.get(aId) || 0), 0);

  // Water-filling step: repeatedly assign +1 to an aisle with minimum current count that still has free capacity
  while (remaining > 0) {
    let minVal = Infinity;
    const candidates: string[] = [];
    for (const aId of aisleIds) {
      const cur = targets.get(aId) || 0;
      const cap = availableByAisle.get(aId) || 0;
      if (cur >= cap) continue;
      if (cur < minVal) {
        minVal = cur;
        candidates.length = 0;
        candidates.push(aId);
      } else if (cur === minVal) {
        candidates.push(aId);
      }
    }
    if (candidates.length === 0) break;
    const chosen = candidates[rngInt(candidates.length)];
    targets.set(chosen, (targets.get(chosen) || 0) + 1);
    remaining--;
  }

  const vals = aisleIds.map((aId) => targets.get(aId) || 0);
  const spread = Math.max(...vals) - Math.min(...vals);
  const idealSpread = totalStudents % aCount === 0 ? 0 : 1;
  const idealAchieved = spread <= idealSpread;

  let reasonNote = '';
  if (!idealAchieved) {
    const distStr = aisleIds.map((aId, i) => `Dãy ${i + 1}: ${targets.get(aId) || 0}`).join(', ');
    reasonNote = `Phân bố thực tế (${distStr}) chênh ${spread} HS do sức chứa khả dụng từng dãy, ghế khóa hoặc vị trí ghim hiện tại.`;
  }
  return { targets, idealAchieved, reasonNote };
}

function shuffledWithRng<T>(arr: T[], rngInt: (max: number) => number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = rngInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function runSeatingAssignmentSolver(params: {
  state: SeatingProState;
  skipAnimation?: boolean;
  timeBudgetMs?: number;
  nowMs?: number;
  rngInt?: (max: number) => number;
}): SeatingSolveResult {
  const {
    state,
    skipAnimation = false,
    timeBudgetMs = 450,
    nowMs = Date.now(),
    rngInt = cryptoRandomInt,
  } = params;

  const pre = validatePreSolveConflicts(state);
  if (!pre.ok) {
    return {
      ok: false,
      reason: pre.reason,
      shortageCount: pre.shortageCount,
      nextState: {
        ...state,
        lastError: pre.reason || 'Không thể xếp chỗ.',
      },
    };
  }

  const { eligibleStudents, availableSeatIds, pinnedStudentToSeat } = pre;
  const { locationsById } = indexRoomSeats(state.room);
  const noSameMap = buildNoSameDeskMap(state.constraints.noSameDeskPairs);
  const frontDeskLimit = Math.max(1, Math.min(12, state.constraints.frontPriorityDeskCount || 2));

  const pinnedSeatSet = new Set(pinnedStudentToSeat.values());
  const freeSeatIds = availableSeatIds.filter((sId) => !pinnedSeatSet.has(sId));
  const unpinnedStudents = eligibleStudents.filter((s) => !pinnedStudentToSeat.has(s.id));

  // Precompute aisle stats for balanced mode
  const aisleIds = state.room.aisles.map((a) => a.id);
  const availableByAisle = new Map<string, number>();
  const pinnedByAisle = new Map<string, number>();
  for (const aId of aisleIds) {
    availableByAisle.set(aId, 0);
    pinnedByAisle.set(aId, 0);
  }
  for (const sId of availableSeatIds) {
    const loc = locationsById.get(sId)!;
    availableByAisle.set(loc.aisleId, (availableByAisle.get(loc.aisleId) || 0) + 1);
    if (pinnedSeatSet.has(sId)) {
      pinnedByAisle.set(loc.aisleId, (pinnedByAisle.get(loc.aisleId) || 0) + 1);
    }
  }

  const balancePlan =
    state.constraints.assignmentMode === 'balanced_aisles'
      ? computeBalancedAisleTargets({
          totalStudents: eligibleStudents.length,
          aisleIds,
          pinnedByAisle,
          availableByAisle,
          rngInt,
        })
      : { targets: new Map<string, number>(), idealAchieved: true, reasonNote: '' };

  const startWall = Date.now();
  let timedOut = false;

  // Base desk occupancy map for pinned students
  const baseDeskOccupants = new Map<string, string[]>();
  const baseAssignments: Record<string, string | null> = {};
  for (const [stuId, seatId] of pinnedStudentToSeat.entries()) {
    baseAssignments[seatId] = stuId;
    const loc = locationsById.get(seatId)!;
    const arr = baseDeskOccupants.get(loc.deskId) || [];
    arr.push(stuId);
    baseDeskOccupants.set(loc.deskId, arr);
  }

  const isFrontSeat = (seatId: string): boolean => {
    const loc = locationsById.get(seatId);
    return Boolean(loc && loc.deskPhysicalIndex < frontDeskLimit);
  };

  let bestSolution: Record<string, string | null> | null = null;
  let bestScore = -Infinity;

  const evaluateSolutionScore = (sol: Record<string, string | null>): number => {
    let frontMet = 0;
    const aisleCounts = new Map<string, number>();
    for (const aId of aisleIds) aisleCounts.set(aId, 0);

    for (const [sId, stuId] of Object.entries(sol)) {
      if (!stuId) continue;
      const loc = locationsById.get(sId)!;
      aisleCounts.set(loc.aisleId, (aisleCounts.get(loc.aisleId) || 0) + 1);
      const stu = eligibleStudents.find((s) => s.id === stuId);
      if (stu?.frontPriority && isFrontSeat(sId)) {
        frontMet += 100;
      }
    }

    let balancePenalty = 0;
    if (state.constraints.assignmentMode === 'balanced_aisles') {
      for (const aId of aisleIds) {
        const diff = Math.abs((aisleCounts.get(aId) || 0) - (balancePlan.targets.get(aId) || 0));
        balancePenalty += diff * 1000;
      }
      const counts = Array.from(aisleCounts.values());
      const spread = Math.max(...counts) - Math.min(...counts);
      balancePenalty += spread * 500;
    }

    return frontMet - balancePenalty;
  };

  const MAX_RESTARTS = 24;
  for (let attempt = 0; attempt < MAX_RESTARTS; attempt++) {
    if (Date.now() - startWall > timeBudgetMs) {
      timedOut = true;
      break;
    }

    // Order students: constrained first, then frontPriority, randomized within ties
    const randOrder = shuffledWithRng(unpinnedStudents, rngInt);
    randOrder.sort((a, b) => {
      const degA = noSameMap.get(a.id)?.size || 0;
      const degB = noSameMap.get(b.id)?.size || 0;
      if (degA !== degB) return degB - degA;
      if (a.frontPriority !== b.frontPriority) return a.frontPriority ? -1 : 1;
      return 0;
    });

    // Candidate seat subset for this attempt
    let chosenSeats: string[] = [];
    if (state.constraints.assignmentMode === 'balanced_aisles') {
      for (const aId of aisleIds) {
        const need = Math.max(0, (balancePlan.targets.get(aId) || 0) - (pinnedByAisle.get(aId) || 0));
        const aisleFree = shuffledWithRng(
          freeSeatIds.filter((id) => locationsById.get(id)!.aisleId === aId),
          rngInt
        );
        // Prefer keeping front seats among selected aisle slots when possible
        aisleFree.sort((sa, sb) => (isFrontSeat(sa) === isFrontSeat(sb) ? 0 : isFrontSeat(sa) ? -1 : 1));
        chosenSeats.push(...aisleFree.slice(0, need));
      }
      // If somehow short (shouldn't happen), fill from remaining free seats
      if (chosenSeats.length < unpinnedStudents.length) {
        const chosenSet = new Set(chosenSeats);
        const extra = shuffledWithRng(
          freeSeatIds.filter((id) => !chosenSet.has(id)),
          rngInt
        );
        chosenSeats.push(...extra.slice(0, unpinnedStudents.length - chosenSeats.length));
      }
    } else {
      const pool = shuffledWithRng(freeSeatIds, rngInt);
      // Still bias chosen seats to include enough front seats if frontPriority students exist
      const needFrontCount = unpinnedStudents.filter((s) => s.frontPriority).length;
      if (needFrontCount > 0) {
        const fronts = pool.filter(isFrontSeat);
        const backs = pool.filter((s) => !isFrontSeat(s));
        chosenSeats = [...fronts, ...backs].slice(0, unpinnedStudents.length);
      } else {
        chosenSeats = pool.slice(0, unpinnedStudents.length);
      }
    }

    const workAssignments: Record<string, string | null> = { ...baseAssignments };
    const workDeskOcc = new Map<string, string[]>();
    for (const [k, v] of baseDeskOccupants.entries()) workDeskOcc.set(k, v.slice());
    const usedSeats = new Set<string>();
    let steps = 0;
    const MAX_STEPS = 4500;

    const search = (idx: number): boolean => {
      steps++;
      if (steps > MAX_STEPS) return false;
      if (Date.now() - startWall > timeBudgetMs) {
        timedOut = true;
        return false;
      }
      if (idx >= randOrder.length) return true;

      const stu = randOrder[idx];
      const forbidden = noSameMap.get(stu.id);
      const seatCandidates = shuffledWithRng(
        chosenSeats.filter((sId) => !usedSeats.has(sId)),
        rngInt
      );
      if (stu.frontPriority) {
        seatCandidates.sort((a, b) => (isFrontSeat(a) === isFrontSeat(b) ? 0 : isFrontSeat(a) ? -1 : 1));
      }

      for (const seatId of seatCandidates) {
        const loc = locationsById.get(seatId)!;
        const occ = workDeskOcc.get(loc.deskId) || [];
        if (forbidden && occ.some((otherId) => forbidden.has(otherId))) {
          continue;
        }
        usedSeats.add(seatId);
        occ.push(stu.id);
        workDeskOcc.set(loc.deskId, occ);
        workAssignments[seatId] = stu.id;

        if (search(idx + 1)) return true;

        delete workAssignments[seatId];
        occ.pop();
        usedSeats.delete(seatId);
      }
      return false;
    };

    if (search(0)) {
      const sc = evaluateSolutionScore(workAssignments);
      if (sc > bestScore) {
        bestScore = sc;
        bestSolution = { ...workAssignments };
      }
      // If all front priorities met and balanced spread achieved, stop early!
      const allFrontMet = unpinnedStudents.every((stu) => {
        if (!stu.frontPriority) return true;
        const sId = Object.keys(workAssignments).find((k) => workAssignments[k] === stu.id);
        return sId ? isFrontSeat(sId) : true;
      });
      if (allFrontMet && balancePlan.idealAchieved) {
        break;
      }
    } else if (
      attempt === 0 &&
      state.constraints.assignmentMode === 'balanced_aisles' &&
      unpinnedStudents.length > 0 &&
      freeSeatIds.length > chosenSeats.length
    ) {
      // Fallback search across ALL free seats if strict quota subset hit a desk packing conflict
      const allSeatsShuffled = shuffledWithRng(freeSeatIds, rngInt);
      chosenSeats = allSeatsShuffled;
    }
  }

  if (!bestSolution) {
    const hasNoSame = state.constraints.noSameDeskPairs.length > 0;
    const msg = timedOut
      ? 'Chưa tìm được phương án xếp thỏa mãn tất cả ràng buộc trong giới hạn thời gian. Đã giữ nguyên sơ đồ trước đó.'
      : hasNoSame
        ? 'Không tìm được phương án hợp lệ vì ràng buộc "Không ngồi cùng bàn", ghế ghim hoặc ghế khóa đang xung đột quá chặt. Hãy kiểm tra lại các cặp ràng buộc.'
        : 'Không tìm được phương án hợp lệ với cấu hình ghế hiện tại. Đã giữ nguyên sơ đồ trước đó.';
    return {
      ok: false,
      timedOut,
      reason: msg,
      nextState: {
        ...state,
        lastError: msg,
      },
    };
  }

  // Final post-solve invariant verification (every eligible student strictly once, max 1 student per seat)
  const verifyStudentCounts = new Map<string, number>();
  const verifyDeskMap = indexRoomSeats(state.room).deskMap;
  for (const [seatId, stuId] of Object.entries(bestSolution)) {
    if (!stuId) continue;
    if (state.lockedSeatIds.includes(seatId)) {
      return { ok: false, reason: 'Lỗi nội bộ: ghế khóa nhận học sinh.', nextState: state };
    }
    verifyStudentCounts.set(stuId, (verifyStudentCounts.get(stuId) || 0) + 1);
  }
  for (const stu of eligibleStudents) {
    if (verifyStudentCounts.get(stu.id) !== 1) {
      return { ok: false, reason: 'Lỗi kiểm tra phương án: số lượt học sinh không hợp lệ.', nextState: state };
    }
  }
  for (const desk of verifyDeskMap.values()) {
    const occ = desk.seatIds.map((s) => bestSolution![s]).filter(Boolean) as string[];
    for (let i = 0; i < occ.length; i++) {
      for (let j = i + 1; j < occ.length; j++) {
        if (noSameMap.get(occ[i])?.has(occ[j])) {
          return { ok: false, reason: 'Lỗi kiểm tra phương án: vi phạm ràng buộc Không ngồi cùng bàn.', nextState: state };
        }
      }
    }
  }

  // Gather unmet soft front priorities
  const unmetPriorities: string[] = [];
  for (const stu of eligibleStudents) {
    if (!stu.frontPriority) continue;
    const assignedSeat = Object.keys(bestSolution).find((k) => bestSolution![k] === stu.id);
    if (!assignedSeat || !isFrontSeat(assignedSeat)) {
      unmetPriorities.push(stu.fullName);
    }
  }

  // Check actual aisle spread explanation
  const actualStats = computeSeatingStats(state.room, bestSolution, state.pinnedSeatIds, state.lockedSeatIds);
  let balanceNote = balancePlan.reasonNote;
  if (
    state.constraints.assignmentMode === 'balanced_aisles' &&
    actualStats.spread > (eligibleStudents.length % Math.max(1, aisleIds.length) === 0 ? 0 : 1)
  ) {
    const dist = actualStats.aisles.map((a) => `${a.aisleName}: ${a.assignedCount}`).join(', ');
    balanceNote = `Phân bố thực tế (${dist}) do vị trí ghim, ghế khóa hoặc ràng buộc cặp không thể chia đều tuyệt đối.`;
  }

  const revealOrderSeatIds = Object.keys(bestSolution).filter(
    (sId) => Boolean(bestSolution![sId]) && !pinnedSeatSet.has(sId)
  );
  const immediate = skipAnimation || state.effectDurationSeconds <= 0;

  const reveal: SeatingRevealTurn = {
    turnId: `rev_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    previousAssignments: { ...state.assignments },
    committedAssignments: bestSolution,
    revealOrderSeatIds: shuffledWithRng(revealOrderSeatIds, rngInt),
    balanceNote,
    unmetPriorityNames: unmetPriorities,
    status: immediate ? 'revealed' : 'animating',
    startedAtMs: nowMs,
    durationSeconds: immediate ? 0 : state.effectDurationSeconds,
  };

  return {
    ok: true,
    nextState: {
      ...state,
      undoStack: pushUndoSnapshot(state, 'Xếp chỗ ngẫu nhiên'),
      assignments: bestSolution,
      activeReveal: reveal,
      lastBalanceNote: balanceNote,
      lastUnmetPriorities: unmetPriorities,
      lastError: '',
      updatedAtMs: nowMs,
    },
  };
}

export function finalizeSeatingReveal(state: SeatingProState): SeatingProState {
  if (!state.activeReveal || state.activeReveal.status === 'revealed') return state;
  return {
    ...state,
    assignments: { ...state.activeReveal.committedAssignments },
    activeReveal: {
      ...state.activeReveal,
      status: 'revealed',
    },
    updatedAtMs: Date.now(),
  };
}

// ============================================================================
// PARABOLIC MULTI-WAVE FLIGHT CHOREOGRAPHY (NO DUPLICATE NAMES IN FLIGHT)
// ============================================================================
export interface SeatingFlightMove {
  moveId: string;
  studentId: string;
  fromSeatId: string | null; // null = arrives from waiting/roster staging
  toSeatId: string;
  waveIndex: number;
  startMs: number;
  endMs: number;
  isSwap: boolean;
}

export interface SeatingFlightPlan {
  durationMs: number;
  moves: SeatingFlightMove[];
  initialAssignments: Record<string, string | null>;
  finalAssignments: Record<string, string | null>;
}

export interface SeatingFlightFrame {
  stationaryAssignments: Record<string, string | null>;
  airborneMoves: Array<{
    move: SeatingFlightMove;
    progress: number;
    easedProgress: number;
  }>;
  recentlyLandedSeatIds: Set<string>;
  completedCount: number;
  totalMoves: number;
  isComplete: boolean;
}

/**
 * Breaks the transition from `previousAssignments` to `targetAssignments` into
 * sequential dependency-free micro-waves (both moves to empty seats and two-card swaps)
 * spanning `[0, durationSeconds * 1000]`.
 *
 * Guarantees:
 * - Locked seats and pinned seats never change or enter flight.
 * - At ANY millisecond `t`, no student ID ever appears simultaneously in two stationary seats
 *   or both stationary and airborne!
 * - At `elapsedMs >= durationMs`, stationary board equals `targetAssignments` identically.
 */
export function buildSeatingFlightPlan(params: {
  previousAssignments?: Record<string, string | null>;
  targetAssignments: Record<string, string | null>;
  orderedSeatIds: string[];
  pinnedSeatIds: string[];
  lockedSeatIds: string[];
  durationSeconds: number;
  revealOrderSeatIds?: string[];
}): SeatingFlightPlan {
  const {
    previousAssignments = {},
    targetAssignments,
    orderedSeatIds,
    pinnedSeatIds,
    lockedSeatIds,
    durationSeconds,
    revealOrderSeatIds,
  } = params;

  const durationMs = Math.max(0, Math.round(durationSeconds * 1000));
  const pinnedSet = new Set(pinnedSeatIds);
  const lockedSet = new Set(lockedSeatIds);
  const validSet = new Set(orderedSeatIds);

  // Clean initial & final maps so pinned/locked constraints hold strictly
  const initialMap: Record<string, string | null> = {};
  const finalMap: Record<string, string | null> = {};
  const usedInitialStudents = new Set<string>();

  for (const sId of orderedSeatIds) {
    if (lockedSet.has(sId)) continue;
    if (pinnedSet.has(sId) && targetAssignments[sId]) {
      initialMap[sId] = targetAssignments[sId]!;
      finalMap[sId] = targetAssignments[sId]!;
      usedInitialStudents.add(targetAssignments[sId]!);
      continue;
    }
    const targetStu = targetAssignments[sId] || null;
    if (targetStu) finalMap[sId] = targetStu;
  }

  for (const sId of orderedSeatIds) {
    if (lockedSet.has(sId) || pinnedSet.has(sId)) continue;
    const prevStu = previousAssignments[sId] || null;
    if (prevStu && !usedInitialStudents.has(prevStu)) {
      initialMap[sId] = prevStu;
      usedInitialStudents.add(prevStu);
    }
  }

  const movableSeatOrder = (revealOrderSeatIds && revealOrderSeatIds.length > 0
    ? [
        ...revealOrderSeatIds.filter((s) => validSet.has(s) && !pinnedSet.has(s) && !lockedSet.has(s)),
        ...orderedSeatIds.filter(
          (s) => !revealOrderSeatIds.includes(s) && !pinnedSet.has(s) && !lockedSet.has(s)
        ),
      ]
    : orderedSeatIds.filter((s) => !pinnedSet.has(s) && !lockedSet.has(s)));

  // Build ordered raw atomic steps transforming workingState -> finalMap
  const working: Record<string, string | null> = { ...initialMap };
  const rawSteps: Array<{
    moves: Array<{ studentId: string; fromSeatId: string | null; toSeatId: string; isSwap: boolean }>;
  }> = [];

  const findCurrentSeatOf = (stuId: string): string | null => {
    for (const sId of movableSeatOrder) {
      if (working[sId] === stuId) return sId;
    }
    return null;
  };

  let guard = 0;
  const maxSteps = orderedSeatIds.length * 3 + 20;
  while (guard < maxSteps) {
    guard++;
    const mismatchSeats = movableSeatOrder.filter((sId) => (working[sId] || null) !== (finalMap[sId] || null));
    if (mismatchSeats.length === 0) break;

    // 1. Prefer moving a needed student into a currently empty target seat
    const emptyTargetSeat = mismatchSeats.find((sId) => !working[sId] && Boolean(finalMap[sId]));
    if (emptyTargetSeat) {
      const targetStu = finalMap[emptyTargetSeat]!;
      const fromSeat = findCurrentSeatOf(targetStu);
      if (fromSeat) working[fromSeat] = null;
      working[emptyTargetSeat] = targetStu;
      rawSteps.push({
        moves: [{ studentId: targetStu, fromSeatId: fromSeat, toSeatId: emptyTargetSeat, isSwap: false }],
      });
      continue;
    }

    // 2. Otherwise clear a currently occupied seat that needs to be empty, or swap two mismatched students
    const occupiedWrongSeat = mismatchSeats.find((sId) => Boolean(working[sId]) && Boolean(finalMap[sId]));
    if (occupiedWrongSeat) {
      const curStu = working[occupiedWrongSeat]!;
      const targetStu = finalMap[occupiedWrongSeat]!;
      const otherSeat = findCurrentSeatOf(targetStu);
      if (otherSeat && otherSeat !== occupiedWrongSeat) {
        working[occupiedWrongSeat] = targetStu;
        working[otherSeat] = curStu;
        rawSteps.push({
          moves: [
            { studentId: targetStu, fromSeatId: otherSeat, toSeatId: occupiedWrongSeat, isSwap: true },
            { studentId: curStu, fromSeatId: occupiedWrongSeat, toSeatId: otherSeat, isSwap: true },
          ],
        });
        continue;
      }
      // targetStu wasn't currently seated anywhere -> curStu yields to final empty spot or gets replaced
      if (!otherSeat) {
        const curStuFinalSeat = movableSeatOrder.find((s) => finalMap[s] === curStu) || null;
        if (curStuFinalSeat && !working[curStuFinalSeat]) {
          working[occupiedWrongSeat] = targetStu;
          working[curStuFinalSeat] = curStu;
          rawSteps.push({
            moves: [
              { studentId: curStu, fromSeatId: occupiedWrongSeat, toSeatId: curStuFinalSeat, isSwap: false },
              { studentId: targetStu, fromSeatId: null, toSeatId: occupiedWrongSeat, isSwap: false },
            ],
          });
          continue;
        }
        working[occupiedWrongSeat] = targetStu;
        rawSteps.push({
          moves: [{ studentId: targetStu, fromSeatId: null, toSeatId: occupiedWrongSeat, isSwap: false }],
        });
        continue;
      }
    }

    // 3. Fallback: remove extra occupant from a seat that must end empty (rare edge)
    const extraSeat = mismatchSeats.find((sId) => Boolean(working[sId]) && !finalMap[sId]);
    if (extraSeat) {
      working[extraSeat] = null;
      continue;
    }
    break;
  }

  // Group compatible independent steps into short micro-waves (1–3 simultaneous flights per wave)
  // so the classroom sees lively staggered arcs across the countdown duration!
  const groupedWaves: Array<Array<{ studentId: string; fromSeatId: string | null; toSeatId: string; isSwap: boolean }>> = [];
  let currentBatch: Array<{ studentId: string; fromSeatId: string | null; toSeatId: string; isSwap: boolean }> = [];
  let touchedSeats = new Set<string>();
  let touchedStudents = new Set<string>();
  const maxFlightsPerWave = rawSteps.length > 24 ? 3 : 2;

  for (const step of rawSteps) {
    const conflictsWithBatch = step.moves.some((m) => {
      if (touchedStudents.has(m.studentId)) return true;
      if (touchedSeats.has(m.toSeatId)) return true;
      if (m.fromSeatId && touchedSeats.has(m.fromSeatId)) return true;
      return false;
    });

    if (
      currentBatch.length > 0 &&
      (conflictsWithBatch || currentBatch.length + step.moves.length > maxFlightsPerWave)
    ) {
      groupedWaves.push(currentBatch);
      currentBatch = [];
      touchedSeats = new Set<string>();
      touchedStudents = new Set<string>();
    }

    for (const m of step.moves) {
      currentBatch.push(m);
      touchedStudents.add(m.studentId);
      touchedSeats.add(m.toSeatId);
      if (m.fromSeatId) touchedSeats.add(m.fromSeatId);
    }
  }
  if (currentBatch.length > 0) groupedWaves.push(currentBatch);

  if (durationMs <= 0 || groupedWaves.length === 0) {
    return {
      durationMs: 0,
      moves: [],
      initialAssignments: initialMap,
      finalAssignments: finalMap,
    };
  }

  const waveCount = groupedWaves.length;
  const leadPad = Math.min(180, durationMs * 0.04);
  const tailPad = Math.min(220, durationMs * 0.05);
  const usableMs = Math.max(200, durationMs - leadPad - tailPad);
  const defaultMoveDur = Math.min(480, Math.max(280, usableMs / Math.max(1, waveCount * 0.85)));
  const strideMs =
    waveCount === 1
      ? 0
      : Math.max(60, (usableMs - defaultMoveDur) / Math.max(1, waveCount - 1));

  const moves: SeatingFlightMove[] = [];
  groupedWaves.forEach((waveMoves, wIdx) => {
    const waveStart = leadPad + wIdx * strideMs;
    const waveDur = Math.min(defaultMoveDur, Math.max(180, durationMs - tailPad - waveStart));
    waveMoves.forEach((m, mIdx) => {
      const microOffset = waveMoves.length > 1 && !m.isSwap ? mIdx * 28 : 0;
      const startMs = Math.min(durationMs - 140, Math.round(waveStart + microOffset));
      const endMs = Math.min(Math.round(durationMs - 40), Math.round(waveStart + waveDur));
      moves.push({
        moveId: `mv_${wIdx}_${mIdx}_${m.studentId}`,
        studentId: m.studentId,
        fromSeatId: m.fromSeatId,
        toSeatId: m.toSeatId,
        waveIndex: wIdx,
        startMs,
        endMs: Math.max(startMs + 120, endMs),
        isSwap: m.isSwap,
      });
    });
  });

  return {
    durationMs,
    moves,
    initialAssignments: initialMap,
    finalAssignments: finalMap,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function evaluateSeatingFlightFrame(
  plan: SeatingFlightPlan,
  elapsedMs: number
): SeatingFlightFrame {
  if (plan.moves.length === 0 || elapsedMs >= plan.durationMs) {
    const recent = new Set<string>();
    if (elapsedMs < plan.durationMs + 500) {
      for (const mv of plan.moves) {
        if (elapsedMs - mv.endMs >= 0 && elapsedMs - mv.endMs <= 550) {
          recent.add(mv.toSeatId);
        }
      }
    }
    return {
      stationaryAssignments: { ...plan.finalAssignments },
      airborneMoves: [],
      recentlyLandedSeatIds: recent,
      completedCount: plan.moves.length,
      totalMoves: plan.moves.length,
      isComplete: true,
    };
  }

  // Group moves by wave order and replay completed waves cleanly into stationaryAssignments
  const board: Record<string, string | null> = { ...plan.initialAssignments };
  const airborneMoves: SeatingFlightFrame['airborneMoves'] = [];
  const recentlyLandedSeatIds = new Set<string>();
  let completedCount = 0;

  // Replay all moves ordered by waveIndex:
  // If wave ended (all moves endMs <= elapsedMs), apply final placement!
  // If any move in the wave is currently airborne (startMs <= elapsedMs < endMs):
  //   - Clear fromSeatId for launched moves so name never duplicates!
  //   - Put into airborneMoves!
  const wavesMap = new Map<number, SeatingFlightMove[]>();
  for (const mv of plan.moves) {
    const arr = wavesMap.get(mv.waveIndex) || [];
    arr.push(mv);
    wavesMap.set(mv.waveIndex, arr);
  }
  const sortedWaveKeys = Array.from(wavesMap.keys()).sort((a, b) => a - b);

  for (const wIdx of sortedWaveKeys) {
    const wMoves = wavesMap.get(wIdx)!;
    // Clear source seats for any move that has started
    for (const mv of wMoves) {
      if (elapsedMs >= mv.startMs && mv.fromSeatId && board[mv.fromSeatId] === mv.studentId) {
        delete board[mv.fromSeatId];
      }
    }
    // Apply completed landings or register airborne
    for (const mv of wMoves) {
      if (elapsedMs >= mv.endMs) {
        board[mv.toSeatId] = mv.studentId;
        completedCount++;
        if (elapsedMs - mv.endMs <= 550) {
          recentlyLandedSeatIds.add(mv.toSeatId);
        }
      } else if (elapsedMs >= mv.startMs) {
        const span = Math.max(1, mv.endMs - mv.startMs);
        const progress = Math.min(1, Math.max(0, (elapsedMs - mv.startMs) / span));
        airborneMoves.push({
          move: mv,
          progress,
          easedProgress: easeInOutCubic(progress),
        });
      }
    }
  }

  return {
    stationaryAssignments: board,
    airborneMoves,
    recentlyLandedSeatIds,
    completedCount,
    totalMoves: plan.moves.length,
    isComplete: false,
  };
}

// ============================================================================
// AISLE STATISTICS
// ============================================================================
export function computeSeatingStats(
  room: SeatingRoomConfig,
  assignments: Record<string, string | null>,
  pinnedSeatIds: string[],
  lockedSeatIds: string[]
): SeatingStatsSummary {
  const lockedSet = new Set(lockedSeatIds);
  const pinnedSet = new Set(pinnedSeatIds);

  const aisles: AisleStatItem[] = room.aisles.map((aisle) => {
    let assignedCount = 0;
    let pinnedCount = 0;
    let availableCount = 0;
    let totalCount = 0;

    for (const desk of aisle.desks) {
      for (const sId of desk.seatIds) {
        totalCount++;
        if (lockedSet.has(sId)) continue;
        availableCount++;
        if (assignments[sId]) {
          assignedCount++;
          if (pinnedSet.has(sId)) pinnedCount++;
        }
      }
    }

    return {
      aisleId: aisle.id,
      aisleName: aisle.name,
      assignedCount,
      pinnedCount,
      availableCount,
      totalCount,
    };
  });

  if (aisles.length === 0) {
    return { aisles: [], minAssigned: 0, maxAssigned: 0, spread: 0 };
  }
  const counts = aisles.map((a) => a.assignedCount);
  const minAssigned = Math.min(...counts);
  const maxAssigned = Math.max(...counts);
  return {
    aisles,
    minAssigned,
    maxAssigned,
    spread: maxAssigned - minAssigned,
  };
}

// ============================================================================
// EXCEL / CLIPBOARD IMPORT & EXPORT (PRESERVES LEADING ZEROS)
// ============================================================================
export interface SeatingRosterPreviewRow {
  rowNumber: number;
  code: string;
  fullName: string;
  present: boolean;
  errors: string[];
}

export interface SeatingRosterPreviewResult {
  rows: SeatingRosterPreviewRow[];
  validRows: SeatingRosterPreviewRow[];
  errorCount: number;
  emptyRowsSkipped: number;
  hasDuplicateCodes: boolean;
  exceedsMaxStudents: boolean;
  globalError: string;
}

function normalizePresence(raw: string): boolean {
  const norm = (raw || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (!norm) return true;
  if (norm === '0' || norm === 'false' || norm.includes('vang') || norm === 'khong' || norm === 'no' || norm === 'x') {
    return false;
  }
  return true;
}

export function parseSeatingRosterPreview(
  rawInput: string | string[][],
  mode: 'excel_matrix' | 'names_only_lines' = 'excel_matrix'
): SeatingRosterPreviewResult {
  if (mode === 'names_only_lines' && typeof rawInput === 'string') {
    const rawLines = rawInput.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let emptyRowsSkipped = 0;
    const nonEmpty: string[] = [];
    for (const line of rawLines) {
      if (!line.trim()) emptyRowsSkipped++;
      else nonEmpty.push(line.trim());
    }
    if (nonEmpty.length === 0) {
      return {
        rows: [],
        validRows: [],
        errorCount: 0,
        emptyRowsSkipped,
        hasDuplicateCodes: false,
        exceedsMaxStudents: false,
        globalError: 'Chưa có tên học sinh nào.',
      };
    }

    const rows: SeatingRosterPreviewRow[] = nonEmpty.map((fullName, idx) => {
      const code = `HS${String(idx + 1).padStart(3, '0')}`;
      const errors =
        idx + 1 > MAX_SEATING_STUDENTS
          ? [`Vượt giới hạn tối đa ${MAX_SEATING_STUDENTS} học sinh/lớp.`]
          : [];
      return {
        rowNumber: idx + 1,
        code,
        fullName,
        present: true,
        errors,
      };
    });

    const exceedsMaxStudents = nonEmpty.length > MAX_SEATING_STUDENTS;
    const validRows = rows.filter((r) => r.errors.length === 0);
    return {
      rows,
      validRows,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
      emptyRowsSkipped,
      hasDuplicateCodes: false,
      exceedsMaxStudents,
      globalError: exceedsMaxStudents
        ? `Danh sách có ${nonEmpty.length} học sinh, vượt tối đa ${MAX_SEATING_STUDENTS} học sinh/lớp.`
        : '',
    };
  }

  const matrix = Array.isArray(rawInput) ? rawInput : parseDelimitedRosterText(rawInput);
  if (matrix.length === 0) {
    return {
      rows: [],
      validRows: [],
      errorCount: 0,
      emptyRowsSkipped: 0,
      hasDuplicateCodes: false,
      exceedsMaxStudents: false,
      globalError: 'Chưa có dữ liệu bảng để xem trước.',
    };
  }

  const c0Norm = (matrix[0][0] || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const c1Norm = (matrix[0][1] || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const hasHeader =
    c0Norm === 'ma' ||
    c0Norm.startsWith('ma ') ||
    c0Norm.includes('ma hs') ||
    c0Norm.includes('ma hoc sinh') ||
    c0Norm.includes('code') ||
    c0Norm === 'stt' ||
    c1Norm === 'ten' ||
    c1Norm.includes('ho va ten') ||
    c1Norm.includes('ho ten') ||
    c1Norm === 'name';

  const rawData = hasHeader ? matrix.slice(1) : matrix;
  let emptyRowsSkipped = 0;
  const nonEmptyEntries: { origRow: number; cols: string[] }[] = [];

  rawData.forEach((cols, idx) => {
    const joined = cols.map((c) => (c || '').trim()).join('');
    if (!joined) {
      emptyRowsSkipped++;
    } else {
      nonEmptyEntries.push({ origRow: idx + (hasHeader ? 2 : 1), cols });
    }
  });

  const seenCodes = new Map<string, number>();
  let hasDuplicateCodes = false;

  const rows: SeatingRosterPreviewRow[] = nonEmptyEntries.map((entry, idx) => {
    // Support single-column matrix cleanly by assigning local code if only 1 column is populated
    const isSingleNameCol =
      entry.cols.length === 1 || (!entry.cols[1]?.trim() && entry.cols.length <= 2 && isNaN(Number(entry.cols[0])) && !/^\d+$/.test(entry.cols[0]));
    const code = isSingleNameCol
      ? `HS${String(idx + 1).padStart(3, '0')}`
      : String(entry.cols[0] ?? '').trim();
    const fullName = isSingleNameCol
      ? String(entry.cols[0] ?? '').trim()
      : String(entry.cols[1] ?? '').trim();
    const present = normalizePresence(entry.cols[2] ?? '');
    const errors: string[] = [];

    if (!code) errors.push('Thiếu Mã học sinh.');
    if (!fullName) errors.push('Thiếu Họ và tên.');
    if (code) {
      const upper = code.toUpperCase();
      if (seenCodes.has(upper)) {
        hasDuplicateCodes = true;
        errors.push(`Trùng mã "${code}" (đã có ở dòng ${seenCodes.get(upper)}).`);
      } else {
        seenCodes.set(upper, entry.origRow);
      }
    }
    if (idx + 1 > MAX_SEATING_STUDENTS) {
      errors.push(`Vượt giới hạn ${MAX_SEATING_STUDENTS} học sinh/lớp.`);
    }
    return { rowNumber: entry.origRow, code, fullName, present, errors };
  });

  const exceedsMaxStudents = nonEmptyEntries.length > MAX_SEATING_STUDENTS;
  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  let globalError = '';
  if (exceedsMaxStudents) {
    globalError = `Danh sách có ${nonEmptyEntries.length} dòng, vượt giới hạn ${MAX_SEATING_STUDENTS} học sinh/lớp.`;
  } else if (hasDuplicateCodes) {
    globalError = 'Phát hiện mã học sinh trùng lặp trong danh sách.';
  } else if (errorCount > 0) {
    globalError = `Có ${errorCount} dòng lỗi dữ liệu.`;
  }

  return {
    rows,
    validRows,
    errorCount,
    emptyRowsSkipped,
    hasDuplicateCodes,
    exceedsMaxStudents,
    globalError,
  };
}

export function extractSeatingXlsxMatrix(buffer: ArrayBuffer): string[][] {
  return extractMatrixFromXlsxBuffer(buffer);
}

/**
 * Exports full seating map to XLSX with columns:
 * Dãy | Bàn | Chỗ | Mã học sinh (Text `@`) | Họ và tên | Trạng thái ghế
 */
export function buildSeatingChartXlsxBytes(state: SeatingProState): Uint8Array {
  const { locationsById, orderedSeatIds } = indexRoomSeats(state.room);
  const lockedSet = new Set(state.lockedSeatIds);
  const pinnedSet = new Set(state.pinnedSeatIds);
  const studentMap = new Map(state.students.map((s) => [s.id, s]));

  const header = ['Dãy', 'Bàn', 'Chỗ', 'Mã học sinh', 'Họ và tên', 'Trạng thái ghế'];
  const rows: string[][] = [header];

  for (const seatId of orderedSeatIds) {
    const loc = locationsById.get(seatId)!;
    const isLocked = lockedSet.has(seatId);
    const stuId = state.assignments[seatId];
    const stu = stuId ? studentMap.get(stuId) : null;
    const isPinned = pinnedSet.has(seatId);

    const status = isLocked
      ? 'Ghế khóa'
      : stu
        ? isPinned
          ? 'Đã ghim'
          : 'Đã xếp'
        : 'Ghế trống';

    rows.push([
      loc.aisleName,
      `Bàn ${loc.deskDisplayNumber}`,
      `Chỗ ${loc.seatDisplayNumber}`,
      stu ? String(stu.code) : '',
      stu ? stu.fullName : '',
      status,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Enforce Text format `@` on column D (index 3: Mã học sinh) so leading zeros like "001" never become numbers!
  for (let r = 1; r < rows.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 3 });
    ws[addr] = {
      t: 's',
      v: rows[r][3],
      z: '@',
    };
  }
  ws['!cols'] = [
    { wch: 10 },
    { wch: 10 },
    { wch: 10 },
    { wch: 15 },
    { wch: 28 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'SoDoChoNgoi');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function buildSeatingSampleXlsxBytes(): Uint8Array {
  const header = ['Mã học sinh', 'Họ và tên', 'Có mặt'];
  const sampleRows = [
    ['001', 'Nguyễn Minh An', 'Có'],
    ['002', 'Trần Thị Bảo Ngọc', 'Có'],
    ['003', 'Nguyễn Minh An', 'Có'],
    ['004', 'Lê Hoàng Gia Khang', 'Có'],
    ['005', 'Phạm Vũ Quỳnh Như', 'Vắng'],
    ['006', 'Đỗ Thanh Phương Thảo', 'Có'],
  ];
  const ws = XLSX.utils.aoa_to_sheet([header, ...sampleRows]);
  for (let r = 1; r <= sampleRows.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    ws[addr] = { t: 's', v: sampleRows[r - 1][0], z: '@' };
  }
  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_So_Do_Cho_Ngoi');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

// ============================================================================
// PHYSICAL ORIENTATION TRANSFORM & HIGH-DPI PNG EXPORTER
// ============================================================================
export interface OrientedAisleView {
  aisle: SeatingAisleConfig;
  aisleIndex: number;
  desks: {
    desk: SeatingDeskConfig;
    deskPhysicalIndex: number;
    deskDisplayNumber: number;
    seatIds: string[]; // Ordered left-to-right on screen for current orientation!
  }[];
}

/**
 * Pure 180-degree physical rotation when flipping between:
 * - `front_board`: Teacher looking from front board OR board at top?
 *   Wait: standard convention matching Đợt 1 `getOrientedSeatingGrid`:
 *   - `front_board` ("Nhìn từ bảng / Bảng ở trên"): Board at TOP, Dãy 1 on LEFT, Bàn gần bảng at TOP, Chỗ 1 on LEFT.
 *   - `back_of_class` ("Nhìn từ cuối lớp"): Viewer stands at back looking forward -> still facing front OR rotated 180°?
 *     Wait: Look at how Đợt 1 (`getOrientedSeatingGrid`) + Master Prompt describe it:
 *     "Đảo góc nhìn chỉ xoay cách hiển thị giữa hai hướng nhìn. Học sinh, số bàn, ghế ghim và cửa ra vào phải đi theo đúng vị trí vật lý."
 *     Rotating 180° flips:
 *     - Board, Teacher Desk, Podium move between TOP (when Board is at top / from back looking forward) and BOTTOM (when viewed from front board looking back at class)!
 *     - When flipped 180°: left<->right aisles reverse, left<->right seats inside each desk reverse, front<->back desks reverse, and Door flips from front-left to back-right!
 *     - Crucially: applying the transform TWICE returns the EXACT original arrangement (`T(T(x)) === x`), AND `assignments` / `seatId` / `deskId` NEVER mutate!
 */
export function buildOrientedAislesView(
  room: SeatingRoomConfig,
  orientation: SeatingViewOrientation
): OrientedAisleView[] {
  const isRotated180 = orientation === 'back_of_class';
  const orderedAisles = isRotated180 ? room.aisles.slice().reverse() : room.aisles.slice();

  return orderedAisles.map((aisle) => {
    const origAisleIndex = room.aisles.findIndex((a) => a.id === aisle.id);
    const totalDesks = aisle.desks.length;
    const orderedDesks = isRotated180 ? aisle.desks.slice().reverse() : aisle.desks.slice();

    return {
      aisle,
      aisleIndex: origAisleIndex,
      desks: orderedDesks.map((desk) => {
        const physIdx = aisle.desks.findIndex((d) => d.id === desk.id);
        const displayNum =
          room.deskNumbering === 'front_to_back' ? physIdx + 1 : totalDesks - physIdx;
        const seatIds = isRotated180 ? desk.seatIds.slice().reverse() : desk.seatIds.slice();
        return {
          desk,
          deskPhysicalIndex: physIdx,
          deskDisplayNumber: displayNum,
          seatIds,
        };
      }),
    };
  });
}

/**
 * Pure canvas exporter drawing the ENTIRE classroom chart (never clipped by scrollbars!)
 * including Title, Date, Teacher, Board/Podium/TeacherDesk/Door, all Aisles/Desks/Seats,
 * Student names, Pin/Lock markers, and Aisle stats.
 */
export function exportSeatingChartPngDataUrl(state: SeatingProState): string | null {
  if (typeof document === 'undefined') return null;
  const orientedAisles = buildOrientedAislesView(state.room, state.orientation);
  const studentIdxMap = new Map(state.students.map((s, idx) => [s.id, { stu: s, stt: idx + 1 }]));
  const lockedSet = new Set(state.lockedSeatIds);
  const pinnedSet = new Set(state.pinnedSeatIds);
  const summary = getRoomCapacitySummary(state);
  const stats = computeSeatingStats(state.room, state.assignments, state.pinnedSeatIds, state.lockedSeatIds);

  const aisleCount = Math.max(1, orientedAisles.length);
  const maxDesks = Math.max(1, ...orientedAisles.map((a) => a.desks.length));

  const aisleWidth = 280;
  const aisleGap = 28;
  const padX = 48;
  const headerH = 122;
  const boardZoneH = 88;
  const deskH = 86;
  const deskGap = 16;
  const footerH = 74;

  const contentW = aisleCount * aisleWidth + Math.max(0, aisleCount - 1) * aisleGap;
  const width = Math.max(960, contentW + padX * 2);
  const desksAreaH = maxDesks * deskH + Math.max(0, maxDesks - 1) * deskGap + 44;
  const height = headerH + boardZoneH + desksAreaH + boardZoneH + footerH;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(scale, scale);

  const isBW = state.colorTheme === 'bw';
  const isMulti = state.colorTheme === 'multicolor';
  const multiPalette = ['#1D4ED8', '#047857', '#B45309', '#6D28D9', '#0E7490', '#BE123C'];

  // Background
  ctx.fillStyle = isBW ? '#FFFFFF' : '#F8FBFF';
  ctx.fillRect(0, 0, width, height);

  // Header
  ctx.fillStyle = isBW ? '#000000' : '#082B52';
  ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`SƠ ĐỒ CHỖ NGỒI — ${state.meta.className || 'LỚP HỌC'}`, width / 2, 42);

  ctx.fillStyle = isBW ? '#222222' : '#475569';
  ctx.font = '600 13px "Be Vietnam Pro", system-ui, sans-serif';
  const metaParts = [
    `GV: ${state.meta.teacherName || 'Chưa nhập'}`,
    state.meta.academicNote || '',
    state.meta.showDateOnChart ? `Ngày lập: ${formatIsoDateVi(state.meta.createdDateIso)}` : '',
    `Sĩ số xếp: ${summary.assignedSeats} HS · Khả dụng: ${summary.availableSeats}/${summary.totalSeats} ghế`,
    `Góc nhìn: ${state.orientation === 'front_board' ? 'Bảng ở trên' : 'Nhìn từ bục giảng'}`,
  ].filter(Boolean);
  ctx.fillText(metaParts.join('   |   '), width / 2, 70);

  // Legend line
  ctx.font = '600 12px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.fillStyle = isBW ? '#111111' : '#64748B';
  ctx.fillText(
    `[Ghim] Giữ chỗ khi xếp lại   ·   [Khóa] Ghế không dùng   ·   Tổng: ${summary.totalSeats} | Khóa: ${summary.lockedSeats} | Khả dụng: ${summary.availableSeats}`,
    width / 2,
    94
  );

  const drawFrontFurniture = (topY: number) => {
    const isFlipped = state.orientation === 'back_of_class';
    // Door on front-left in normal view, flips to front-right when rotated 180
    const doorW = 112;
    const doorX = isFlipped ? width - padX - doorW : padX;
    ctx.fillStyle = isBW ? '#F4F4F4' : '#FEF3C7';
    ctx.strokeStyle = isBW ? '#000000' : '#D97706';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(doorX, topY + 14, doorW, 48, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isBW ? '#000000' : '#92400E';
    ctx.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CỬA RA VÀO', doorX + doorW / 2, topY + 42);

    // Blackboard + Podium centered
    const boardW = Math.min(460, width - padX * 2 - 280);
    const boardX = (width - boardW) / 2;
    ctx.fillStyle = isBW ? '#FFFFFF' : '#0F2D52';
    ctx.strokeStyle = isBW ? '#000000' : '#082B52';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(boardX, topY + 6, boardW, 38, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isBW ? '#000000' : '#FFFFFF';
    ctx.font = '800 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('BẢNG LỚP · BỤC GIẢNG', width / 2, topY + 30);

    // Teacher Desk next to board (opposite door side)
    const tdW = 128;
    const tdX = isFlipped ? padX : width - padX - tdW;
    ctx.fillStyle = isBW ? '#FFFFFF' : '#EFF6FF';
    ctx.strokeStyle = isBW ? '#000000' : '#1769F4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tdX, topY + 12, tdW, 50, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = isBW ? '#000000' : '#1E3A8A';
    ctx.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('BÀN GIÁO VIÊN', tdX + tdW / 2, topY + 42);
  };

  const frontTopY = state.orientation === 'front_board' ? headerH : height - footerH - boardZoneH;
  drawFrontFurniture(frontTopY);

  const aislesTopY = headerH + boardZoneH + 10;
  const startX = (width - contentW) / 2;

  orientedAisles.forEach((aView, viewIdx) => {
    const ax = startX + viewIdx * (aisleWidth + aisleGap);
    const accent = isBW ? '#000000' : isMulti ? multiPalette[aView.aisleIndex % multiPalette.length] : '#0F2D52';

    // Aisle label
    ctx.fillStyle = accent;
    ctx.font = '800 14px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(aView.aisle.name.toUpperCase(), ax + aisleWidth / 2, aislesTopY + 16);

    aView.desks.forEach((dView, dScreenIdx) => {
      const dy = aislesTopY + 28 + dScreenIdx * (deskH + deskGap);
      // Desk wrapper
      ctx.fillStyle = isBW ? '#FFFFFF' : '#FFFFFF';
      ctx.strokeStyle = isBW ? '#000000' : '#CBD5E1';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(ax, dy, aisleWidth, deskH, 10);
      ctx.fill();
      ctx.stroke();

      // Desk label bar
      ctx.fillStyle = isBW ? '#F3F4F6' : isMulti ? `${accent}18` : '#F1F5F9';
      ctx.beginPath();
      ctx.roundRect(ax + 1, dy + 1, aisleWidth - 2, 22, [9, 9, 0, 0]);
      ctx.fill();

      ctx.fillStyle = accent;
      ctx.font = '700 11px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Bàn ${dView.deskDisplayNumber}`, ax + 10, dy + 16);
      ctx.textAlign = 'right';
      ctx.fillStyle = isBW ? '#222222' : '#64748B';
      ctx.fillText(`${dView.seatIds.length} chỗ`, ax + aisleWidth - 10, dy + 16);

      // Seats inside desk
      const seatCount = Math.max(1, dView.seatIds.length);
      const seatGap = 6;
      const seatAreaW = aisleWidth - 16 - Math.max(0, seatCount - 1) * seatGap;
      const seatW = seatAreaW / seatCount;
      const seatY = dy + 28;
      const seatH = deskH - 35;

      dView.seatIds.forEach((seatId, sScreenIdx) => {
        const sx = ax + 8 + sScreenIdx * (seatW + seatGap);
        const isLocked = lockedSet.has(seatId);
        const isPinned = pinnedSet.has(seatId);
        const stuId = state.assignments[seatId];
        const info = stuId ? studentIdxMap.get(stuId) : undefined;

        ctx.fillStyle = isLocked
          ? isBW
            ? '#E5E7EB'
            : '#F1F5F9'
          : isPinned
            ? isBW
              ? '#FFFFFF'
              : '#EFF6FF'
            : '#FFFFFF';
        ctx.strokeStyle = isLocked
          ? isBW
            ? '#444444'
            : '#94A3B8'
          : isPinned
            ? isBW
              ? '#000000'
              : '#1769F4'
            : isBW
              ? '#000000'
              : '#E2E8F0';
        ctx.lineWidth = isPinned ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(sx, seatY, seatW, seatH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        if (isLocked) {
          ctx.fillStyle = isBW ? '#000000' : '#64748B';
          ctx.font = '700 10px "Be Vietnam Pro", system-ui, sans-serif';
          ctx.fillText('KHÓA', sx + seatW / 2, seatY + seatH / 2 + 4);
        } else if (info) {
          const formatted = formatStudentDisplayName({
            student: info.stu,
            sttIndex: info.stt,
            mode: state.nameDisplayMode,
            allStudents: state.students,
          });
          ctx.fillStyle = isBW ? '#000000' : '#0F2D52';
          ctx.font = '700 11px "Be Vietnam Pro", system-ui, sans-serif';
          // Fit text safely within seat width
          const label = isPinned ? `★ ${formatted.primary}` : formatted.primary;
          ctx.fillText(label, sx + seatW / 2, seatY + (formatted.secondaryCode ? 20 : 28), seatW - 8);
          if (formatted.secondaryCode) {
            ctx.fillStyle = isBW ? '#333333' : '#64748B';
            ctx.font = '600 9px "JetBrains Mono", monospace';
            ctx.fillText(formatted.secondaryCode, sx + seatW / 2, seatY + 37, seatW - 8);
          }
        } else {
          ctx.fillStyle = isBW ? '#555555' : '#94A3B8';
          ctx.font = '500 10px "Be Vietnam Pro", system-ui, sans-serif';
          ctx.fillText('Trống', sx + seatW / 2, seatY + seatH / 2 + 4);
        }
      });
    });
  });

  // Footer aisle summary
  const footY = height - 34;
  ctx.fillStyle = isBW ? '#000000' : '#334155';
  ctx.font = '700 12px "Be Vietnam Pro", system-ui, sans-serif';
  ctx.textAlign = 'center';
  const statText =
    stats.aisles.map((a) => `${a.aisleName}: ${a.assignedCount}/${a.availableCount} HS`).join('   ·   ') +
    `   ·   Chênh lệch các dãy: ${stats.spread} HS`;
  ctx.fillText(statText, width / 2, footY);

  return canvas.toDataURL('image/png');
}

// ============================================================================
// ISOLATED LOCAL STORAGE PER CLASS / ACCOUNT / DEMO
// ============================================================================
function getSeatingProScopePrefix(accountId?: string | null): string {
  const safe = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_seating_pro_v2_${safe}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function getSeatingProClassKey(classId: string, accountId?: string | null): string {
  const safeCls = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${getSeatingProScopePrefix(accountId)}_cls_${safeCls}`;
}

export function getSeatingProLocalClassesKey(accountId?: string | null): string {
  return `${getSeatingProScopePrefix(accountId)}_local_classes`;
}

export interface SeatingLocalClassPreset {
  id: string;
  name: string;
  teacherName: string;
  sourceType: 'sample_editable' | 'imported_local';
  students: SeatingStudentRecord[];
}

export function saveSeatingProState(
  state: SeatingProState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getSeatingProClassKey(state.classId, accountId);
    window.localStorage.setItem(key, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadSeatingProState(
  classId: string,
  accountId?: string | null
): SeatingProState | null {
  if (typeof window === 'undefined') return null;
  const key = getSeatingProClassKey(classId, accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SeatingProState>;
    if (!parsed || parsed.version !== 2 || parsed.classId !== classId || !parsed.room) {
      return null;
    }
    // If reload happened mid-animation, commit & reveal cleanly without duplicating or losing placements
    if (parsed.activeReveal && parsed.activeReveal.status === 'animating') {
      const recovered: SeatingProState = {
        ...(parsed as SeatingProState),
        assignments: { ...parsed.activeReveal.committedAssignments },
        activeReveal: {
          ...parsed.activeReveal,
          status: 'revealed',
        },
      };
      window.localStorage.setItem(key, JSON.stringify(recovered));
      return recovered;
    }
    return parsed as SeatingProState;
  } catch {
    return null;
  }
}

export function loadSeatingLocalClasses(
  accountId?: string | null
): SeatingLocalClassPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getSeatingProLocalClassesKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SeatingLocalClassPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveSeatingLocalClasses(
  classes: SeatingLocalClassPreset[],
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getSeatingProLocalClassesKey(accountId),
      JSON.stringify(classes)
    );
    return true;
  } catch {
    return false;
  }
}
