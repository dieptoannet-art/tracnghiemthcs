import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  ActivityMode,
  ActivityState,
  StudentGroupItem,
  ToolStudentItem,
  divideStudentsIntoGroups,
} from './teachingToolsEngine';

// ============================================================================
// TYPES & INTERFACES: ĐIỀU PHỐI HOẠT ĐỘNG NHÓM CHUYÊN SÂU
// ============================================================================

export type ActivityGroupSourceMode = 'from_divider' | 'quick_split' | 'names_only';

export type ActivityRunStatus = 'idle' | 'running' | 'paused' | 'completed';

export type ActivityPhaseKind =
  | 'station_work'
  | 'station_transition'
  | 'jigsaw_expert'
  | 'jigsaw_move'
  | 'jigsaw_share'
  | 'tablecloth_individual'
  | 'tablecloth_consensus'
  | 'gallery_visit'
  | 'gallery_transition'
  | 'gallery_review';

export interface ActivityWorkingMember {
  id: string;
  code: string;
  fullName: string;
  displayName: string;
  homeGroupId: string;
  homeGroupName: string;
}

export interface ActivityWorkingGroup {
  id: string;
  index: number; // 1-based display index
  name: string;
  color: string;
  members: ActivityWorkingMember[];
  /** Used in Khăn trải bàn when working only with group names & manual paper count */
  effectiveMemberCount: number;
}

export interface StationProItem {
  id: string;
  title: string;
  task: string;
  capacity: number;
  materials: string;
}

export interface StationRotationConfig {
  stations: StationProItem[];
  workSeconds: number;
  transitionSeconds: number;
  allowWaitingTurns: boolean;
}

export interface JigsawTopicItem {
  id: string;
  title: string;
  task: string;
  materials: string;
}

export interface JigsawConfig {
  topics: JigsawTopicItem[];
  expertSeconds: number;
  moveSeconds: number;
  homeShareSeconds: number;
  allowDualExpertRole: boolean;
}

export interface TableclothConfig {
  sharedPrompt: string;
  usePerGroupPrompts: boolean;
  perGroupPrompts: Record<string, string>;
  individualSeconds: number;
  consensusSeconds: number;
  manualBoxCountPerGroup: number;
}

export interface GalleryProductConfig {
  title: string;
  subtitle: string;
  imageUrl?: string;
}

export interface GalleryWalkConfig {
  products: Record<string, GalleryProductConfig>;
  visitSeconds: number;
  transitionSeconds: number;
  includeFinalReviewPhase: boolean;
  finalReviewSeconds: number;
  feedbackChecklist: string[];
}

export interface ActivityGroupSourceConfig {
  sourceMode: ActivityGroupSourceMode;
  quickGroupCount: number;
  quickPasteText: string;
  manualGroupCount: number;
  manualGroupNames: string[];
}

export interface TableclothNotesMap {
  /** groupId -> memberSlotIndex (0..n-1) -> note */
  individualNotes: Record<string, Record<number, string>>;
  /** groupId -> center consensus note */
  consensusNotes: Record<string, string>;
}

export interface GalleryFeedbackRecord {
  id: string;
  fromGroupId: string;
  fromGroupName: string;
  targetGroupId: string;
  targetProductNumber: number;
  strength: string;
  question: string;
  suggestion: string;
}

export interface ActivityPhaseCardItem {
  cardId: string;
  badge: string;
  title: string;
  subtitle?: string;
  accentColor: string;
  body: string;
  materials?: string;
  isWaiting?: boolean;
  members?: Array<{
    id: string;
    label: string;
    roleTag?: string;
    homeGroupLabel?: string;
  }>;
  meta?: Record<string, string | number | boolean>;
}

export interface ActivitySchedulePhase {
  phaseId: string;
  phaseIndex: number; // 0-indexed across all phases
  roundNumber: number; // 1-indexed logical round/turn
  totalRounds: number;
  kind: ActivityPhaseKind;
  isTransition: boolean;
  title: string;
  subtitle: string;
  durationSeconds: number;
  instructions: string;
  cards: ActivityPhaseCardItem[];
}

export interface ActivityScheduleResult {
  mode: ActivityMode;
  phases: ActivitySchedulePhase[];
  totalPhases: number;
  totalRounds: number;
  totalDurationSeconds: number;
  warnings: string[];
  errors: string[];
  canStart: boolean;
  jigsawMissingTopicsInfo?: {
    shortHomeGroups: Array<{ groupId: string; groupName: string; memberCount: number }>;
    missingTopicsCount: number;
    recommendedMaxTopics: number;
  };
  stationMatrix?: Array<{
    roundNumber: number;
    assignments: Array<{
      groupId: string;
      groupName: string;
      groupColor: string;
      stationId: string;
      stationTitle: string;
      isWaiting: boolean;
    }>;
  }>;
  jigsawAssignments?: Array<{
    memberId: string;
    displayName: string;
    homeGroupId: string;
    homeGroupName: string;
    expertTurns: Array<{
      turnNumber: number;
      topicId: string;
      topicTitle: string;
    }>;
  }>;
  galleryMatrix?: Array<{
    roundNumber: number;
    visits: Array<{
      visitingGroupId: string;
      visitingGroupName: string;
      visitingGroupColor: string;
      targetGroupId: string;
      targetProductNumber: number;
      targetProductTitle: string;
    }>;
  }>;
}

export interface ActivityProSessionState {
  version: 2;
  classId: string;
  className: string;
  mode: ActivityMode;
  groupSource: ActivityGroupSourceConfig;
  stationConfig: StationRotationConfig;
  jigsawConfig: JigsawConfig;
  tableclothConfig: TableclothConfig;
  galleryConfig: GalleryWalkConfig;
  autoAdvance: boolean;
  bellMuted: boolean;
  teacherPrivateNote: string;
  tableclothNotes: TableclothNotesMap;
  galleryFeedbacks: GalleryFeedbackRecord[];
  // Runtime Execution State
  status: ActivityRunStatus;
  currentPhaseIndex: number;
  phaseEndAtMs: number | null;
  remainingMsWhenPaused: number;
  activePhaseToken: number;
  bellHandledForToken: number;
  startedAtMs: number | null;
  endedAtMs: number | null;
  lockedGroupsSnapshot: ActivityWorkingGroup[] | null;
  lockedSchedule: ActivityScheduleResult | null;
  updatedAtMs: number;
}

export interface ActivityPresetTemplate {
  id: string;
  title: string;
  mode: ActivityMode;
  badge: string;
  description: string;
  apply: (current: ActivityProSessionState) => ActivityProSessionState;
}

// ============================================================================
// CONSTANTS & PALETTE
// ============================================================================

export const ACTIVITY_TAB_META: Array<{
  mode: ActivityMode;
  label: string;
  shortLabel: string;
  tagline: string;
  accentHex: string;
}> = [
  {
    mode: 'station_rotation',
    label: 'Dạy học theo trạm',
    shortLabel: 'Theo trạm',
    tagline: 'Các nhóm luân chuyển qua từng trạm nhiệm vụ kèm thời gian chuyển trạm.',
    accentHex: '#047857',
  },
  {
    mode: 'jigsaw',
    label: 'Mảnh ghép',
    shortLabel: 'Mảnh ghép',
    tagline: 'Vòng Chuyên gia theo chủ đề, di chuyển và chia sẻ tại Nhóm mảnh ghép.',
    accentHex: '#1769F4',
  },
  {
    mode: 'tablecloth',
    label: 'Khăn trải bàn',
    shortLabel: 'Khăn trải bàn',
    tagline: 'Làm việc cá nhân ở các ô xung quanh trước khi thống nhất ý kiến vào ô trung tâm.',
    accentHex: '#B45309',
  },
  {
    mode: 'gallery_walk',
    label: 'Phòng tranh',
    shortLabel: 'Phòng tranh',
    tagline: 'Các nhóm tham quan sản phẩm nhóm bạn theo vòng không trùng và ghi góp ý.',
    accentHex: '#6D28D9',
  },
];

const GROUP_COLORS = [
  '#1D4ED8',
  '#047857',
  '#B45309',
  '#BE123C',
  '#6D28D9',
  '#0E7490',
  '#C2410C',
  '#4338CA',
  '#0F766E',
  '#A21CAF',
  '#334155',
  '#15803D',
];

export function formatDurationVietnamese(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs} giây`;
  if (secs === 0) return `${mins} phút`;
  return `${mins} phút ${secs} giây`;
}

export function formatClockMMSS(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ============================================================================
// DEFAULT CONFIG FACTORIES
// ============================================================================

export function createDefaultStationConfig(): StationRotationConfig {
  return {
    stations: [
      { id: 'st_1', title: 'Trạm 1 · Khởi động & Đọc tư liệu', task: 'Đọc đoạn tư liệu trọng tâm và gạch chân 3 từ khóa chính.', capacity: 1, materials: 'Phiếu tư liệu số 1, bút highlight' },
      { id: 'st_2', title: 'Trạm 2 · Quan sát thí nghiệm / Mô hình', task: 'Quan sát mô hình hoặc video thí nghiệm và mô tả hiện tượng.', capacity: 1, materials: 'Bộ mẫu vật / QR video' },
      { id: 'st_3', title: 'Trạm 3 · Luyện tập bài toán ứng dụng', task: 'Giải 2 bài tập vận dụng ngắn vào bảng nhóm.', capacity: 1, materials: 'Bảng nhóm + bút dạ' },
      { id: 'st_4', title: 'Trạm 4 · Phản biện & Liên hệ thực tế', task: 'Đặt 1 câu hỏi phản biện và nêu 1 ví dụ ngoài đời sống.', capacity: 1, materials: 'Thẻ gợi ý tình huống' },
    ],
    workSeconds: 300,
    transitionSeconds: 30,
    allowWaitingTurns: true,
  };
}

export function createDefaultJigsawConfig(): JigsawConfig {
  return {
    topics: [
      { id: 'top_1', title: 'Chủ đề 1 · Khái niệm & Bản chất', task: 'Nghiên cứu định nghĩa và xác định dấu hiệu nhận biết cốt lõi.', materials: 'Phiếu chuyên gia 1' },
      { id: 'top_2', title: 'Chủ đề 2 · Cơ chế / Quy trình', task: 'Vẽ sơ đồ các bước diễn biến theo trình tự logic.', materials: 'Phiếu chuyên gia 2' },
      { id: 'top_3', title: 'Chủ đề 3 · Ví dụ minh họa', task: 'Tìm 2 ví dụ chuẩn xác và phân tích điểm dễ nhầm lẫn.', materials: 'Phiếu chuyên gia 3' },
      { id: 'top_4', title: 'Chủ đề 4 · Vận dụng thực tiễn', task: 'Giải quyết tình huống thực tế và chuẩn bị câu hỏi kiểm tra bạn.', materials: 'Phiếu chuyên gia 4' },
    ],
    expertSeconds: 600,
    moveSeconds: 60,
    homeShareSeconds: 720,
    allowDualExpertRole: false,
  };
}

export function createDefaultTableclothConfig(): TableclothConfig {
  return {
    sharedPrompt: 'Theo em, yếu tố nào quyết định thành công của giải pháp nhóm? Hãy viết ý kiến riêng vào ô của mình.',
    usePerGroupPrompts: false,
    perGroupPrompts: {},
    individualSeconds: 240,
    consensusSeconds: 360,
    manualBoxCountPerGroup: 4,
  };
}

export function createDefaultGalleryConfig(): GalleryWalkConfig {
  return {
    products: {},
    visitSeconds: 240,
    transitionSeconds: 30,
    includeFinalReviewPhase: true,
    finalReviewSeconds: 120,
    feedbackChecklist: [
      '1 điểm mạnh nổi bật nhất của sản phẩm',
      '1 câu hỏi muốn nhóm tác giả giải thích thêm',
      '1 đề xuất giúp sản phẩm hoàn thiện hơn',
    ],
  };
}

export function createInitialActivityProSession(params: {
  classId: string;
  className: string;
  dividerGroups?: StudentGroupItem[];
  presentStudents?: ToolStudentItem[];
  legacyActivityState?: ActivityState | null;
  nowMs?: number;
}): ActivityProSessionState {
  const { classId, className, dividerGroups = [], presentStudents = [], legacyActivityState, nowMs = Date.now() } = params;

  const baseStations = createDefaultStationConfig();
  if (legacyActivityState && Array.isArray(legacyActivityState.stations) && legacyActivityState.stations.length > 0) {
    baseStations.stations = legacyActivityState.stations.map((s, idx) => ({
      id: s.id || `st_${idx + 1}`,
      title: s.title || `Trạm ${idx + 1}`,
      task: s.task || '',
      capacity: Math.max(1, s.capacity || 1),
      materials: '',
    }));
    baseStations.workSeconds = Math.max(30, legacyActivityState.roundDurationSeconds || 300);
    baseStations.allowWaitingTurns = Boolean(legacyActivityState.splitMultiTurn);
  }

  const defaultSourceMode: ActivityGroupSourceMode =
    dividerGroups.some((g) => g.studentIds.length > 0)
      ? 'from_divider'
      : presentStudents.length > 0
      ? 'quick_split'
      : 'names_only';

  const groupCountHint = Math.max(2, Math.min(12, dividerGroups.length || 4));
  const initialManualNames = Array.from({ length: groupCountHint }, (_, i) => `Nhóm ${i + 1}`);

  return {
    version: 2,
    classId,
    className,
    mode: legacyActivityState?.mode || 'station_rotation',
    groupSource: {
      sourceMode: defaultSourceMode,
      quickGroupCount: Math.max(2, Math.min(12, Math.round(presentStudents.length / 4) || 4)),
      quickPasteText: '',
      manualGroupCount: groupCountHint,
      manualGroupNames: initialManualNames,
    },
    stationConfig: baseStations,
    jigsawConfig: createDefaultJigsawConfig(),
    tableclothConfig: createDefaultTableclothConfig(),
    galleryConfig: createDefaultGalleryConfig(),
    autoAdvance: true,
    bellMuted: false,
    teacherPrivateNote: legacyActivityState?.instructions || '',
    tableclothNotes: {
      individualNotes: {},
      consensusNotes: {},
    },
    galleryFeedbacks: [],
    status: 'idle',
    currentPhaseIndex: 0,
    phaseEndAtMs: null,
    remainingMsWhenPaused: baseStations.workSeconds * 1000,
    activePhaseToken: 1,
    bellHandledForToken: 0,
    startedAtMs: null,
    endedAtMs: null,
    lockedGroupsSnapshot: null,
    lockedSchedule: null,
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// QUICK INPUT PARSERS
// ============================================================================

export function parseStationsMultiline(rawText: string): StationProItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  return lines.map((line, idx) => {
    const colonIdx = line.indexOf(':');
    const dashIdx = line.indexOf(' - ');
    let title = `Trạm ${idx + 1}`;
    let task = line;
    if (colonIdx > 0 && colonIdx < 60) {
      title = line.slice(0, colonIdx).trim();
      task = line.slice(colonIdx + 1).trim();
    } else if (dashIdx > 0 && dashIdx < 60) {
      title = line.slice(0, dashIdx).trim();
      task = line.slice(dashIdx + 3).trim();
    } else {
      title = line;
      task = `Thực hiện nhiệm vụ tại ${line}`;
    }
    return {
      id: `st_paste_${idx + 1}`,
      title: title || `Trạm ${idx + 1}`,
      task: task || title,
      capacity: 1,
      materials: '',
    };
  });
}

export function parseQuickPasteStudents(rawText: string): ToolStudentItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 50);

  return lines.map((line, idx) => {
    const code = `HS${String(idx + 1).padStart(3, '0')}`;
    return {
      id: `local_paste_${idx + 1}_${code}`,
      code,
      fullName: line,
    };
  });
}

// ============================================================================
// GROUP SOURCE RESOLUTION (1–50 STUDENTS, MAX 12 GROUPS, ZERO EMPTY GROUPS)
// ============================================================================

export function resolveWorkingGroups(params: {
  sourceConfig: ActivityGroupSourceConfig;
  dividerGroups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
  manualBoxCountPerGroup?: number;
}): {
  groups: ActivityWorkingGroup[];
  warnings: string[];
  errors: string[];
} {
  const { sourceConfig, dividerGroups, presentStudents, manualBoxCountPerGroup = 4 } = params;
  const warnings: string[] = [];
  const errors: string[] = [];

  // Map all students with duplicate-name detection
  const buildDuplicateSet = (list: ToolStudentItem[]): Set<string> => {
    const counts = new Map<string, number>();
    for (const st of list) {
      const key = st.fullName.trim().toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dup = new Set<string>();
    for (const [k, cnt] of counts.entries()) {
      if (cnt > 1) dup.add(k);
    }
    return dup;
  };

  if (sourceConfig.sourceMode === 'from_divider') {
    const studentById = new Map<string, ToolStudentItem>();
    for (const st of presentStudents) studentById.set(st.id, st);
    const dupNames = buildDuplicateSet(presentStudents);

    const nonEmptyDivider = dividerGroups
      .filter((g) => g.studentIds.some((id) => studentById.has(id)))
      .slice(0, 12);

    if (dividerGroups.length > 12) {
      warnings.push('Công cụ Hoạt động nhóm hỗ trợ tối đa 12 nhóm; các nhóm sau nhóm 12 không được đưa vào lượt chia.');
    }

    if (nonEmptyDivider.length === 0) {
      // Fallback: check if divider groups exist as named groups with no matching present students
      if (dividerGroups.length > 0 && presentStudents.length === 0) {
        const namedOnly = dividerGroups.slice(0, 12).map((g, idx) => ({
          id: g.id,
          index: idx + 1,
          name: g.name || `Nhóm ${idx + 1}`,
          color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length],
          members: [],
          effectiveMemberCount: Math.max(1, Math.min(10, manualBoxCountPerGroup)),
        }));
        warnings.push('Lớp chưa có học sinh có mặt; đang dùng tên các nhóm đã tạo.');
        return { groups: namedOnly, warnings, errors };
      }
      errors.push('Chưa có nhóm nào có thành viên có mặt từ công cụ Chia nhóm học sinh. Hãy chia nhóm trước hoặc chọn "Chia nhanh" / "Chỉ dùng tên nhóm".');
      return { groups: [], warnings, errors };
    }

    const groups: ActivityWorkingGroup[] = nonEmptyDivider.map((g, idx) => {
      const validMembers: ActivityWorkingMember[] = [];
      for (const sid of g.studentIds) {
        const st = studentById.get(sid);
        if (!st) continue;
        const isDup = dupNames.has(st.fullName.trim().toLowerCase());
        validMembers.push({
          id: st.id,
          code: st.code,
          fullName: st.fullName,
          displayName: isDup ? `${st.fullName} (${st.code})` : st.fullName,
          homeGroupId: g.id,
          homeGroupName: g.name || `Nhóm ${idx + 1}`,
        });
      }
      return {
        id: g.id,
        index: idx + 1,
        name: g.name || `Nhóm ${idx + 1}`,
        color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length],
        members: validMembers,
        effectiveMemberCount: validMembers.length,
      };
    });

    return { groups, warnings, errors };
  }

  if (sourceConfig.sourceMode === 'quick_split') {
    const pasted = parseQuickPasteStudents(sourceConfig.quickPasteText);
    const roster = pasted.length > 0 ? pasted : presentStudents.slice(0, 50);

    if (presentStudents.length > 50 && pasted.length === 0) {
      warnings.push('Lớp có hơn 50 học sinh; hệ thống giới hạn 50 học sinh đầu tiên trong phiên hoạt động.');
    }

    if (roster.length === 0) {
      errors.push('Chưa có danh sách học sinh để chia nhanh. Hãy chọn lớp có học sinh, dán danh sách (mỗi dòng 1 tên) hoặc chuyển sang "Chỉ dùng tên nhóm".');
      return { groups: [], warnings, errors };
    }

    const requestedGroups = Math.max(1, Math.min(12, Math.round(sourceConfig.quickGroupCount || 4)));
    const safeGroupCount = Math.min(requestedGroups, roster.length);
    if (safeGroupCount < requestedGroups) {
      warnings.push(`Chỉ có ${roster.length} học sinh nên số nhóm được điều chỉnh còn ${safeGroupCount} nhóm để không có nhóm rỗng.`);
    }

    const dupNames = buildDuplicateSet(roster);
    const divided = divideStudentsIntoGroups({
      presentStudents: roster,
      splitMode: 'by_group_count',
      groupCount: safeGroupCount,
      maxPerGroup: Math.ceil(roster.length / safeGroupCount),
      shuffleSeed: 'quick_deterministic',
    });

    const studentById = new Map(roster.map((s) => [s.id, s]));
    const groups: ActivityWorkingGroup[] = divided
      .filter((g) => g.studentIds.length > 0)
      .slice(0, 12)
      .map((g, idx) => {
        const members: ActivityWorkingMember[] = g.studentIds
          .map((id) => studentById.get(id))
          .filter((s): s is ToolStudentItem => Boolean(s))
          .map((st) => {
            const isDup = dupNames.has(st.fullName.trim().toLowerCase());
            return {
              id: st.id,
              code: st.code,
              fullName: st.fullName,
              displayName: isDup ? `${st.fullName} (${st.code})` : st.fullName,
              homeGroupId: g.id,
              homeGroupName: g.name,
            };
          });
        return {
          id: g.id,
          index: idx + 1,
          name: g.name,
          color: g.color || GROUP_COLORS[idx % GROUP_COLORS.length],
          members,
          effectiveMemberCount: members.length,
        };
      });

    return { groups, warnings, errors };
  }

  // 'names_only'
  const count = Math.max(1, Math.min(12, Math.round(sourceConfig.manualGroupCount || 4)));
  const safeBoxCount = Math.max(1, Math.min(10, Math.round(manualBoxCountPerGroup || 4)));
  const groups: ActivityWorkingGroup[] = Array.from({ length: count }, (_, idx) => {
    const customName = (sourceConfig.manualGroupNames[idx] || '').trim();
    return {
      id: `grp_named_${idx + 1}`,
      index: idx + 1,
      name: customName || `Nhóm ${idx + 1}`,
      color: GROUP_COLORS[idx % GROUP_COLORS.length],
      members: [],
      effectiveMemberCount: safeBoxCount,
    };
  });

  return { groups, warnings, errors };
}

// ============================================================================
// SCHEDULE BUILDERS FOR ALL 4 MODES
// ============================================================================

function buildStationRotationSchedule(
  groups: ActivityWorkingGroup[],
  config: StationRotationConfig
): ActivityScheduleResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const stations = config.stations.filter((s) => s.title.trim() || s.task.trim());

  if (groups.length === 0) {
    errors.push('Cần ít nhất 1 nhóm để tạo lịch Trạm.');
  }
  if (stations.length === 0) {
    errors.push('Cần ít nhất 1 trạm nhiệm vụ.');
  }

  if (errors.length > 0) {
    return {
      mode: 'station_rotation',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
    };
  }

  const totalCapacity = stations.reduce((acc, st) => acc + Math.max(1, st.capacity || 1), 0);
  if (totalCapacity < groups.length && !config.allowWaitingTurns) {
    errors.push(
      `Tổng sức chứa các trạm (${totalCapacity} chỗ) nhỏ hơn số nhóm (${groups.length}). Hãy tăng sức chứa mỗi trạm hoặc bật tùy chọn "Chia lượt chờ (Nhóm chờ)".`
    );
    return {
      mode: 'station_rotation',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
    };
  }

  const workSeconds = Math.max(15, Math.round(config.workSeconds || 300));
  const transitionSeconds = Math.max(0, Math.round(config.transitionSeconds || 0));

  const nGroups = groups.length;
  const nStations = stations.length;
  const allStationsSingleSlot = stations.every((s) => Math.max(1, s.capacity || 1) >= 1);

  type RawRoundRow = Array<{
    groupIdx: number;
    stationIdx: number | null; // null === Nhóm chờ
  }>;

  const rawRounds: RawRoundRow[] = [];

  if (nGroups === nStations && allStationsSingleSlot) {
    // Classic Latin square: every group visits every station across N rounds, 0 waiting groups!
    for (let r = 0; r < nStations; r++) {
      const row: RawRoundRow = [];
      for (let g = 0; g < nGroups; g++) {
        row.push({ groupIdx: g, stationIdx: (g + r) % nStations });
      }
      rawRounds.push(row);
    }
  } else {
    // General constrained scheduler:
    // Every group visits every station exactly once; no station exceeds capacity in any round;
    // no group is assigned to two stations in the same round.
    const unvisited: Array<Set<number>> = groups.map(
      () => new Set(Array.from({ length: nStations }, (_, i) => i))
    );
    const maxSafetyRounds = nGroups * nStations + 4;

    while (unvisited.some((s) => s.size > 0) && rawRounds.length < maxSafetyRounds) {
      const capLeft = stations.map((s) => Math.max(1, s.capacity || 1));
      const assignedStationForGroup = new Array<number | null>(nGroups).fill(null);

      // Process groups with the MOST remaining stations first, tie-break by rotating index to spread wait turns fairly
      const roundOffset = rawRounds.length;
      const groupOrder = Array.from({ length: nGroups }, (_, i) => (i + roundOffset) % nGroups).sort(
        (a, b) => unvisited[b].size - unvisited[a].size
      );

      for (const gIdx of groupOrder) {
        if (unvisited[gIdx].size === 0) continue;
        // Prefer stations with highest remaining demand across all groups and available capacity
        const candidateStations = Array.from(unvisited[gIdx])
          .filter((sIdx) => capLeft[sIdx] > 0)
          .sort((sa, sb) => {
            // Demand across other unvisited groups
            const demandA = unvisited.filter((u) => u.has(sa)).length;
            const demandB = unvisited.filter((u) => u.has(sb)).length;
            if (demandB !== demandA) return demandB - demandA;
            return capLeft[sb] - capLeft[sa];
          });

        if (candidateStations.length > 0) {
          const chosen = candidateStations[0];
          assignedStationForGroup[gIdx] = chosen;
          capLeft[chosen] -= 1;
          unvisited[gIdx].delete(chosen);
        }
      }

      const row: RawRoundRow = [];
      for (let g = 0; g < nGroups; g++) {
        row.push({ groupIdx: g, stationIdx: assignedStationForGroup[g] });
      }
      rawRounds.push(row);
    }

    if (rawRounds.length > nStations) {
      warnings.push(
        `Do số nhóm (${nGroups}) và sức chứa từng trạm, hệ thống tự động chia thành ${rawRounds.length} vòng để mỗi nhóm hoàn thành đủ ${nStations} trạm mà không vượt quá sức chứa.`
      );
    }
  }

  if (groups.length === 1) {
    warnings.push('Lớp hiện có 1 nhóm: lịch sẽ đi tuần tự qua từng trạm nhiệm vụ.');
  }

  const totalRounds = rawRounds.length;
  const phases: ActivitySchedulePhase[] = [];
  const stationMatrix: ActivityScheduleResult['stationMatrix'] = [];

  for (let r = 0; r < totalRounds; r++) {
    const roundNumber = r + 1;
    const row = rawRounds[r];

    const matrixAssignments = row.map((item) => {
      const grp = groups[item.groupIdx];
      if (item.stationIdx === null) {
        return {
          groupId: grp.id,
          groupName: grp.name,
          groupColor: grp.color,
          stationId: '__wait__',
          stationTitle: 'Nhóm chờ',
          isWaiting: true,
        };
      }
      const st = stations[item.stationIdx];
      return {
        groupId: grp.id,
        groupName: grp.name,
        groupColor: grp.color,
        stationId: st.id,
        stationTitle: st.title,
        isWaiting: false,
      };
    });
    stationMatrix.push({ roundNumber, assignments: matrixAssignments });

    const workCards: ActivityPhaseCardItem[] = row.map((item) => {
      const grp = groups[item.groupIdx];
      if (item.stationIdx === null) {
        return {
          cardId: `r${roundNumber}_g_${grp.id}`,
          badge: grp.name,
          title: 'Nhóm chờ · Chuẩn bị / Rà soát nhanh',
          subtitle: 'Không tính đã hoàn thành trạm trong lượt này',
          accentColor: '#64748B',
          body: 'Nhóm đọc trước hướng dẫn hoặc tự rà soát lại ghi chép từ trạm trước trong lúc chờ chỗ trống.',
          isWaiting: true,
          members: grp.members.map((m) => ({ id: m.id, label: m.displayName })),
        };
      }
      const st = stations[item.stationIdx];
      return {
        cardId: `r${roundNumber}_g_${grp.id}`,
        badge: grp.name,
        title: st.title,
        subtitle: `Trạm số ${item.stationIdx + 1}/${nStations}`,
        accentColor: grp.color,
        body: st.task || 'Thực hiện nhiệm vụ theo phiếu tại trạm.',
        materials: st.materials,
        isWaiting: false,
        members: grp.members.map((m) => ({ id: m.id, label: m.displayName })),
      };
    });

    phases.push({
      phaseId: `station_work_${roundNumber}`,
      phaseIndex: phases.length,
      roundNumber,
      totalRounds,
      kind: 'station_work',
      isTransition: false,
      title: `Vòng ${roundNumber}/${totalRounds} · Thực hiện tại trạm`,
      subtitle: `${nGroups} nhóm · ${nStations} trạm`,
      durationSeconds: workSeconds,
      instructions:
        'Các nhóm tập trung hoàn thành nhiệm vụ được phân công đúng tại trạm của mình.',
      cards: workCards,
    });

    // Transition phase between rounds (never after the final round)
    if (transitionSeconds > 0 && roundNumber < totalRounds) {
      const nextRow = rawRounds[r + 1];
      const transitionCards: ActivityPhaseCardItem[] = row.map((item, idx) => {
        const grp = groups[item.groupIdx];
        const nextItem = nextRow[idx];
        const fromLabel = item.stationIdx === null ? 'Nhóm chờ' : stations[item.stationIdx].title;
        const toLabel =
          nextItem.stationIdx === null ? 'Nhóm chờ' : stations[nextItem.stationIdx].title;
        return {
          cardId: `trans_${roundNumber}_g_${grp.id}`,
          badge: grp.name,
          title: `${fromLabel}  →  ${toLabel}`,
          subtitle: 'Thu dọn bàn & di chuyển có trật tự',
          accentColor: grp.color,
          body: `Di chuyển sang ${toLabel}. Kiểm tra đầy đủ dụng cụ trước khi bắt đầu vòng ${roundNumber + 1}.`,
          isWaiting: nextItem.stationIdx === null,
        };
      });

      phases.push({
        phaseId: `station_transition_${roundNumber}`,
        phaseIndex: phases.length,
        roundNumber,
        totalRounds,
        kind: 'station_transition',
        isTransition: true,
        title: `Chuyển trạm · Vòng ${roundNumber} → Vòng ${roundNumber + 1}`,
        subtitle: `${transitionSeconds} giây di chuyển`,
        durationSeconds: transitionSeconds,
        instructions: 'Dừng viết, thu dọn vật dụng và di chuyển nhanh theo mũi tên tới trạm tiếp theo.',
        cards: transitionCards,
      });
    }
  }

  const totalDurationSeconds = phases.reduce((acc, p) => acc + p.durationSeconds, 0);

  return {
    mode: 'station_rotation',
    phases,
    totalPhases: phases.length,
    totalRounds,
    totalDurationSeconds,
    warnings,
    errors,
    canStart: true,
    stationMatrix,
  };
}

function buildJigsawSchedule(
  groups: ActivityWorkingGroup[],
  config: JigsawConfig
): ActivityScheduleResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const topics = config.topics.filter((t) => t.title.trim() || t.task.trim()).slice(0, 6);

  if (topics.length < 2) {
    errors.push('Kỹ thuật Mảnh ghép cần tối thiểu 2 chủ đề chuyên gia.');
  }

  const hasAnyMissingMembers = groups.some((g) => g.members.length === 0);
  if (groups.length === 0 || hasAnyMissingMembers) {
    errors.push(
      'Kỹ thuật Mảnh ghép cần danh sách thành viên trong từng nhóm gốc để phân vai chuyên gia. Hãy chọn nguồn "Dùng nhóm đã chia" hoặc "Chia nhanh".'
    );
  }

  if (errors.length > 0) {
    return {
      mode: 'jigsaw',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
    };
  }

  if (groups.length === 1) {
    warnings.push(
      'Hiện chỉ có 1 nhóm gốc: học sinh vẫn có thể nghiên cứu riêng theo chủ đề rồi chia sẻ lại, nhưng hiệu quả Mảnh ghép tốt nhất khi có từ 2 nhóm trở lên.'
    );
  }

  // Check if any home group has fewer members than topics
  const shortHomeGroups = groups
    .filter((g) => g.members.length < topics.length)
    .map((g) => ({
      groupId: g.id,
      groupName: g.name,
      memberCount: g.members.length,
    }));

  const minMembersInAnyGroup = Math.min(...groups.map((g) => g.members.length));

  if (shortHomeGroups.length > 0 && !config.allowDualExpertRole) {
    const names = shortHomeGroups.map((g) => `${g.groupName} (${g.memberCount} HS)`).join(', ');
    errors.push(
      `Các nhóm ${names} đang có ít thành viên hơn số chủ đề (${topics.length}), nên sẽ thiếu chuyên gia ở một số chủ đề. Hãy giảm số chủ đề xuống ${minMembersInAnyGroup}, chia lại nhóm hoặc bật "Cho phép HS đóng vai kép (chia thêm lượt chuyên gia)".`
    );
    return {
      mode: 'jigsaw',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
      jigsawMissingTopicsInfo: {
        shortHomeGroups,
        missingTopicsCount: topics.length - minMembersInAnyGroup,
        recommendedMaxTopics: Math.max(1, minMembersInAnyGroup),
      },
    };
  }

  // Determine how many non-overlapping expert turns are required
  const expertTurnsNeeded = Math.max(
    1,
    ...groups.map((g) => Math.ceil(topics.length / Math.max(1, g.members.length)))
  );

  if (expertTurnsNeeded > 1) {
    warnings.push(
      `Do có nhóm ít người hơn ${topics.length} chủ đề, hệ thống tạo ${expertTurnsNeeded} lượt Chuyên gia tách biệt để mỗi học sinh chỉ ở một phòng chuyên gia tại một thời điểm.`
    );
  }

  // Build assignments per member per expert turn
  const jigsawAssignments: NonNullable<ActivityScheduleResult['jigsawAssignments']> = [];
  const turnTopicBuckets: Array<Map<string, Array<{ member: ActivityWorkingMember; homeGroupColor: string }>>> =
    Array.from({ length: expertTurnsNeeded }, () => {
      const m = new Map<string, Array<{ member: ActivityWorkingMember; homeGroupColor: string }>>();
      for (const tp of topics) m.set(tp.id, []);
      return m;
    });

  // Track cumulative expert counts per topic for extra member balancing
  const globalTopicCounts = new Map<string, number>();
  for (const tp of topics) globalTopicCounts.set(tp.id, 0);

  for (const grp of groups) {
    const members = grp.members;
    const memberCount = members.length;

    // Assign Turn 1..expertTurnsNeeded cleanly
    const memberTurns = new Map<string, Array<{ turnNumber: number; topicId: string; topicTitle: string }>>();
    for (const m of members) memberTurns.set(m.id, []);

    if (memberCount >= topics.length) {
      // Every topic gets at least 1 dedicated member from this home group in Turn 1!
      for (let idx = 0; idx < memberCount; idx++) {
        const mem = members[idx];
        let chosenTopic: JigsawTopicItem;
        if (idx < topics.length) {
          chosenTopic = topics[idx];
        } else {
          // Pick topic with lowest global count so expert groups stay balanced (max diff <= 1)
          const sortedTopics = topics.slice().sort(
            (a, b) => (globalTopicCounts.get(a.id) || 0) - (globalTopicCounts.get(b.id) || 0)
          );
          chosenTopic = sortedTopics[0];
        }
        globalTopicCounts.set(chosenTopic.id, (globalTopicCounts.get(chosenTopic.id) || 0) + 1);
        turnTopicBuckets[0].get(chosenTopic.id)!.push({ member: mem, homeGroupColor: grp.color });
        memberTurns.get(mem.id)!.push({
          turnNumber: 1,
          topicId: chosenTopic.id,
          topicTitle: chosenTopic.title,
        });
      }
    } else {
      // Dual-role multi-turn: assign every topic across turns without placing a student in 2 topics in the same turn
      for (let tIdx = 0; tIdx < topics.length; tIdx++) {
        const turnIdx = Math.floor(tIdx / memberCount);
        const memberIdx = tIdx % memberCount;
        const mem = members[memberIdx];
        const tp = topics[tIdx];
        globalTopicCounts.set(tp.id, (globalTopicCounts.get(tp.id) || 0) + 1);
        turnTopicBuckets[turnIdx].get(tp.id)!.push({ member: mem, homeGroupColor: grp.color });
        memberTurns.get(mem.id)!.push({
          turnNumber: turnIdx + 1,
          topicId: tp.id,
          topicTitle: tp.title,
        });
      }
    }

    for (const mem of members) {
      jigsawAssignments.push({
        memberId: mem.id,
        displayName: mem.displayName,
        homeGroupId: grp.id,
        homeGroupName: grp.name,
        expertTurns: memberTurns.get(mem.id) || [],
      });
    }
  }

  const expertSeconds = Math.max(15, Math.round(config.expertSeconds || 600));
  const moveSeconds = Math.max(0, Math.round(config.moveSeconds || 0));
  const homeShareSeconds = Math.max(15, Math.round(config.homeShareSeconds || 720));

  const phases: ActivitySchedulePhase[] = [];
  const totalRounds = expertTurnsNeeded + (moveSeconds > 0 ? 2 : 1);

  for (let turn = 0; turn < expertTurnsNeeded; turn++) {
    const turnNumber = turn + 1;
    const buckets = turnTopicBuckets[turn];
    const expertCards: ActivityPhaseCardItem[] = [];

    for (let tIdx = 0; tIdx < topics.length; tIdx++) {
      const tp = topics[tIdx];
      const list = buckets.get(tp.id) || [];
      if (list.length === 0 && expertTurnsNeeded > 1) continue;
      expertCards.push({
        cardId: `expert_turn${turnNumber}_${tp.id}`,
        badge: `Nhóm chuyên gia ${tIdx + 1}`,
        title: tp.title,
        subtitle: `${list.length} chuyên gia tham gia`,
        accentColor: GROUP_COLORS[tIdx % GROUP_COLORS.length],
        body: tp.task || 'Thảo luận sâu để nắm vững nội dung chủ đề này.',
        materials: tp.materials,
        members: list.map((item) => ({
          id: item.member.id,
          label: item.member.displayName,
          homeGroupLabel: item.member.homeGroupName,
        })),
      });
    }

    phases.push({
      phaseId: `jigsaw_expert_${turnNumber}`,
      phaseIndex: phases.length,
      roundNumber: turnNumber,
      totalRounds,
      kind: 'jigsaw_expert',
      isTransition: false,
      title:
        expertTurnsNeeded > 1
          ? `Pha Chuyên gia (Lượt ${turnNumber}/${expertTurnsNeeded})`
          : 'Pha 1 · Thảo luận nhóm Chuyên gia',
      subtitle: `${topics.length} chủ đề · Mỗi thành viên nắm vững 1 mảnh kiến thức`,
      durationSeconds: expertSeconds,
      instructions:
        'Các thành viên cùng chủ đề tập trung thành Nhóm Chuyên gia để nghiên cứu sâu và chuẩn bị nội dung giảng lại cho nhóm gốc.',
      cards: expertCards,
    });
  }

  if (moveSeconds > 0) {
    const moveCards: ActivityPhaseCardItem[] = groups.map((grp) => ({
      cardId: `jigsaw_move_${grp.id}`,
      badge: grp.name,
      title: `Tập hợp đủ thành viên về ${grp.name}`,
      subtitle: `${grp.members.length} thành viên quay về bàn gốc`,
      accentColor: grp.color,
      body: 'Các chuyên gia nhanh chóng di chuyển về đúng nhóm gốc của mình.',
      members: grp.members.map((m) => {
        const assign = jigsawAssignments.find((a) => a.memberId === m.id);
        const roles = assign?.expertTurns.map((e) => e.topicTitle).join(', ') || '';
        return {
          id: m.id,
          label: m.displayName,
          roleTag: roles,
        };
      }),
    }));

    phases.push({
      phaseId: 'jigsaw_move',
      phaseIndex: phases.length,
      roundNumber: expertTurnsNeeded + 1,
      totalRounds,
      kind: 'jigsaw_move',
      isTransition: true,
      title: `Pha ${phases.length + 1} · Di chuyển về Nhóm mảnh ghép`,
      subtitle: `${moveSeconds} giây chuyển nhóm`,
      durationSeconds: moveSeconds,
      instructions: 'Các chuyên gia quay trở lại nhóm gốc ban đầu và ổn định chỗ ngồi.',
      cards: moveCards,
    });
  }

  const shareCards: ActivityPhaseCardItem[] = groups.map((grp) => ({
    cardId: `jigsaw_share_${grp.id}`,
    badge: grp.name,
    title: `${grp.name} · Ghép đủ ${topics.length} mảnh kiến thức`,
    subtitle: `${grp.members.length} thành viên lần lượt trình bày`,
    accentColor: grp.color,
    body: 'Lần lượt từng chuyên gia trình bày lại kiến thức mình phụ trách; cả nhóm đặt câu hỏi và tổng hợp sản phẩm chung.',
    members: grp.members.map((m) => {
      const assign = jigsawAssignments.find((a) => a.memberId === m.id);
      const roles = assign?.expertTurns.map((e) => e.topicTitle).join(' + ') || '';
      return {
        id: m.id,
        label: m.displayName,
        roleTag: roles,
      };
    }),
  }));

  phases.push({
    phaseId: 'jigsaw_home_share',
    phaseIndex: phases.length,
    roundNumber: totalRounds,
    totalRounds,
    kind: 'jigsaw_share',
    isTransition: false,
    title: `Pha ${phases.length + 1} · Chia sẻ tại Nhóm mảnh ghép`,
    subtitle: `${groups.length} nhóm gốc tổng hợp toàn bộ chủ đề`,
    durationSeconds: homeShareSeconds,
    instructions:
      'Từng thành viên giảng lại mảnh kiến thức của mình; cả nhóm tổng hợp thành sơ đồ hoặc kết luận hoàn chỉnh.',
    cards: shareCards,
  });

  const totalDurationSeconds = phases.reduce((acc, p) => acc + p.durationSeconds, 0);

  return {
    mode: 'jigsaw',
    phases,
    totalPhases: phases.length,
    totalRounds,
    totalDurationSeconds,
    warnings,
    errors,
    canStart: true,
    jigsawAssignments,
  };
}

function buildTableclothSchedule(
  groups: ActivityWorkingGroup[],
  config: TableclothConfig
): ActivityScheduleResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (groups.length === 0) {
    errors.push('Cần ít nhất 1 nhóm để tổ chức Khăn trải bàn.');
    return {
      mode: 'tablecloth',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
    };
  }

  if (groups.length === 1 && groups[0].effectiveMemberCount === 1) {
    warnings.push('Lớp hiện có 1 học sinh: thực hiện pha suy nghĩ cá nhân rồi tự tổng hợp ý chính vào ô trung tâm.');
  }

  const individualSeconds = Math.max(15, Math.round(config.individualSeconds || 240));
  const consensusSeconds = Math.max(15, Math.round(config.consensusSeconds || 360));

  const getGroupPrompt = (grp: ActivityWorkingGroup): string => {
    if (config.usePerGroupPrompts && config.perGroupPrompts[grp.id]?.trim()) {
      return config.perGroupPrompts[grp.id].trim();
    }
    return config.sharedPrompt.trim() || 'Trình bày ý kiến cá nhân về câu hỏi thảo luận của tiết học.';
  };

  const phase1Cards: ActivityPhaseCardItem[] = groups.map((grp) => ({
    cardId: `tc_ind_${grp.id}`,
    badge: grp.name,
    title: `${grp.effectiveMemberCount} ô cá nhân`,
    subtitle: 'Ô trung tâm tạm khóa · Điền ở bước 2',
    accentColor: grp.color,
    body: getGroupPrompt(grp),
    members:
      grp.members.length > 0
        ? grp.members.map((m, idx) => ({ id: m.id, label: `Ô ${idx + 1}: ${m.displayName}` }))
        : Array.from({ length: grp.effectiveMemberCount }, (_, idx) => ({
            id: `${grp.id}_slot_${idx + 1}`,
            label: `Góc cá nhân ${idx + 1}`,
          })),
    meta: {
      centerLocked: true,
      boxCount: grp.effectiveMemberCount,
      prompt: getGroupPrompt(grp),
    },
  }));

  const phase2Cards: ActivityPhaseCardItem[] = groups.map((grp) => ({
    cardId: `tc_con_${grp.id}`,
    badge: grp.name,
    title: 'Mở khóa ô trung tâm · Thống nhất nhóm',
    subtitle: `Tổng hợp từ ${grp.effectiveMemberCount} ý kiến cá nhân`,
    accentColor: grp.color,
    body: getGroupPrompt(grp),
    members:
      grp.members.length > 0
        ? grp.members.map((m, idx) => ({ id: m.id, label: `Ô ${idx + 1}: ${m.displayName}` }))
        : Array.from({ length: grp.effectiveMemberCount }, (_, idx) => ({
            id: `${grp.id}_slot_${idx + 1}`,
            label: `Góc cá nhân ${idx + 1}`,
          })),
    meta: {
      centerLocked: false,
      boxCount: grp.effectiveMemberCount,
      prompt: getGroupPrompt(grp),
    },
  }));

  const phases: ActivitySchedulePhase[] = [
    {
      phaseId: 'tablecloth_individual',
      phaseIndex: 0,
      roundNumber: 1,
      totalRounds: 2,
      kind: 'tablecloth_individual',
      isTransition: false,
      title: 'Pha 1 · Làm việc cá nhân',
      subtitle: 'Mỗi thành viên viết vào góc riêng · Ô trung tâm điền ở bước 2',
      durationSeconds: individualSeconds,
      instructions:
        'Giữ im lặng làm việc độc lập. Mỗi học sinh ghi câu trả lời vào góc cá nhân trên khăn trải bàn.',
      cards: phase1Cards,
    },
    {
      phaseId: 'tablecloth_consensus',
      phaseIndex: 1,
      roundNumber: 2,
      totalRounds: 2,
      kind: 'tablecloth_consensus',
      isTransition: false,
      title: 'Pha 2 · Thảo luận và thống nhất',
      subtitle: 'Mở ô trung tâm · Tổng hợp ý kiến chung toàn nhóm',
      durationSeconds: consensusSeconds,
      instructions:
        'Cả nhóm đọc chéo các góc cá nhân, chọn lọc điểm đồng thuận và viết kết luận vào ô trung tâm.',
      cards: phase2Cards,
    },
  ];

  return {
    mode: 'tablecloth',
    phases,
    totalPhases: 2,
    totalRounds: 2,
    totalDurationSeconds: individualSeconds + consensusSeconds,
    warnings,
    errors,
    canStart: true,
  };
}

function buildGalleryWalkSchedule(
  groups: ActivityWorkingGroup[],
  config: GalleryWalkConfig
): ActivityScheduleResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (groups.length < 2) {
    errors.push(
      'Phòng tranh cần tối thiểu 2 nhóm để các nhóm tham quan và góp ý chéo sản phẩm của nhau. Hãy tăng số nhóm hoặc chuyển sang Dạy học theo trạm / Khăn trải bàn.'
    );
    return {
      mode: 'gallery_walk',
      phases: [],
      totalPhases: 0,
      totalRounds: 0,
      totalDurationSeconds: 0,
      warnings,
      errors,
      canStart: false,
    };
  }

  const visitSeconds = Math.max(15, Math.round(config.visitSeconds || 240));
  const transitionSeconds = Math.max(0, Math.round(config.transitionSeconds || 0));
  const finalReviewSeconds = Math.max(15, Math.round(config.finalReviewSeconds || 120));

  const n = groups.length;
  const totalViewingRounds = n - 1;
  const totalRounds = totalViewingRounds + (config.includeFinalReviewPhase ? 1 : 0);

  const getProductTitle = (grp: ActivityWorkingGroup, idx: number): string => {
    const custom = config.products[grp.id]?.title?.trim();
    return custom || `Sản phẩm số ${idx + 1} (${grp.name})`;
  };

  const phases: ActivitySchedulePhase[] = [];
  const galleryMatrix: NonNullable<ActivityScheduleResult['galleryMatrix']> = [];
  const checklistText =
    config.feedbackChecklist.filter(Boolean).join(' · ') ||
    '1 điểm mạnh · 1 câu hỏi · 1 đề xuất';

  for (let r = 1; r <= totalViewingRounds; r++) {
    const visits = groups.map((visitor, i) => {
      const targetIdx = (i + r) % n; // Never equals i because 1 <= r <= n-1
      const owner = groups[targetIdx];
      return {
        visitingGroupId: visitor.id,
        visitingGroupName: visitor.name,
        visitingGroupColor: visitor.color,
        targetGroupId: owner.id,
        targetProductNumber: targetIdx + 1,
        targetProductTitle: getProductTitle(owner, targetIdx),
      };
    });

    galleryMatrix.push({ roundNumber: r, visits });

    const visitCards: ActivityPhaseCardItem[] = visits.map((v) => {
      const owner = groups.find((g) => g.id === v.targetGroupId)!;
      const customProd = config.products[owner.id];
      return {
        cardId: `gal_r${r}_${v.visitingGroupId}`,
        badge: v.visitingGroupName,
        title: `Xem Tranh #${v.targetProductNumber} · ${v.targetProductTitle}`,
        subtitle: `Chủ sở hữu: ${owner.name}`,
        accentColor: v.visitingGroupColor,
        body: `Gợi ý góp ý: ${checklistText}`,
        materials: customProd?.subtitle || undefined,
        meta: {
          targetGroupId: v.targetGroupId,
          targetProductNumber: v.targetProductNumber,
          imageUrl: customProd?.imageUrl || '',
        },
      };
    });

    phases.push({
      phaseId: `gallery_visit_${r}`,
      phaseIndex: phases.length,
      roundNumber: r,
      totalRounds,
      kind: 'gallery_visit',
      isTransition: false,
      title: `Lượt xem ${r}/${totalViewingRounds} · Tham quan & Ghi góp ý`,
      subtitle: `${n} nhóm di chuyển đồng loạt không xem sản phẩm của mình`,
      durationSeconds: visitSeconds,
      instructions: `Mỗi nhóm đọc kỹ sản phẩm đang ghé thăm và dán phiếu: ${checklistText}.`,
      cards: visitCards,
    });

    if (transitionSeconds > 0 && r < totalViewingRounds) {
      const nextRoundNumber = r + 1;
      const transCards: ActivityPhaseCardItem[] = visits.map((v, i) => {
        const nextTargetIdx = (i + nextRoundNumber) % n;
        const nextOwner = groups[nextTargetIdx];
        return {
          cardId: `gal_trans_${r}_${v.visitingGroupId}`,
          badge: v.visitingGroupName,
          title: `Tranh #${v.targetProductNumber}  →  Tranh #${nextTargetIdx + 1}`,
          subtitle: getProductTitle(nextOwner, nextTargetIdx),
          accentColor: v.visitingGroupColor,
          body: 'Gắn xong giấy nhớ và di chuyển sang gian trưng bày kế tiếp.',
        };
      });

      phases.push({
        phaseId: `gallery_transition_${r}`,
        phaseIndex: phases.length,
        roundNumber: r,
        totalRounds,
        kind: 'gallery_transition',
        isTransition: true,
        title: `Chuyển lượt · Tranh lượt ${r} → Lượt ${nextRoundNumber}`,
        subtitle: `${transitionSeconds} giây di chuyển`,
        durationSeconds: transitionSeconds,
        instructions: 'Dán xong góp ý và di chuyển nhanh sang sản phẩm tiếp theo theo mũi tên.',
        cards: transCards,
      });
    }
  }

  if (config.includeFinalReviewPhase) {
    const finalCards: ActivityPhaseCardItem[] = groups.map((grp, idx) => ({
      cardId: `gal_final_${grp.id}`,
      badge: grp.name,
      title: `Quay về Tranh #${idx + 1} · ${getProductTitle(grp, idx)}`,
      subtitle: 'Đọc các góp ý nhận được & tổng hợp điểm cải tiến',
      accentColor: grp.color,
      body: 'Cả nhóm phân loại các thẻ góp ý, giải đáp câu hỏi và chọn 2 ý cải tiến tốt nhất để báo cáo.',
      members: grp.members.map((m) => ({ id: m.id, label: m.displayName })),
      meta: {
        targetGroupId: grp.id,
        targetProductNumber: idx + 1,
      },
    }));

    phases.push({
      phaseId: 'gallery_final_review',
      phaseIndex: phases.length,
      roundNumber: totalRounds,
      totalRounds,
      kind: 'gallery_review',
      isTransition: false,
      title: 'Tổng hợp cuối · Đọc góp ý tại gian hàng của nhóm',
      subtitle: `${finalReviewSeconds} giây rà soát & phản hồi`,
      durationSeconds: finalReviewSeconds,
      instructions:
        'Các nhóm quay về vị trí sản phẩm của mình, tổng hợp toàn bộ phiếu góp ý từ các nhóm bạn.',
      cards: finalCards,
    });
  }

  const totalDurationSeconds = phases.reduce((acc, p) => acc + p.durationSeconds, 0);

  return {
    mode: 'gallery_walk',
    phases,
    totalPhases: phases.length,
    totalRounds,
    totalDurationSeconds,
    warnings,
    errors,
    canStart: true,
    galleryMatrix,
  };
}

export function buildActivityScheduleForState(params: {
  session: ActivityProSessionState;
  dividerGroups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
}): {
  groups: ActivityWorkingGroup[];
  schedule: ActivityScheduleResult;
} {
  const { session, dividerGroups, presentStudents } = params;

  const resolved = resolveWorkingGroups({
    sourceConfig: session.groupSource,
    dividerGroups,
    presentStudents,
    manualBoxCountPerGroup: session.tableclothConfig.manualBoxCountPerGroup,
  });

  if (resolved.errors.length > 0 || resolved.groups.length === 0) {
    return {
      groups: resolved.groups,
      schedule: {
        mode: session.mode,
        phases: [],
        totalPhases: 0,
        totalRounds: 0,
        totalDurationSeconds: 0,
        warnings: resolved.warnings,
        errors: resolved.errors,
        canStart: false,
      },
    };
  }

  let built: ActivityScheduleResult;
  switch (session.mode) {
    case 'station_rotation':
      built = buildStationRotationSchedule(resolved.groups, session.stationConfig);
      break;
    case 'jigsaw':
      built = buildJigsawSchedule(resolved.groups, session.jigsawConfig);
      break;
    case 'tablecloth':
      built = buildTableclothSchedule(resolved.groups, session.tableclothConfig);
      break;
    case 'gallery_walk':
      built = buildGalleryWalkSchedule(resolved.groups, session.galleryConfig);
      break;
  }

  return {
    groups: resolved.groups,
    schedule: {
      ...built,
      warnings: [...resolved.warnings, ...built.warnings],
    },
  };
}

// ============================================================================
// REAL-CLOCK PHASE STATE MACHINE (PAUSE / RELOAD / AUTO-ADVANCE / GUARD)
// ============================================================================

export function startActivityRun(params: {
  session: ActivityProSessionState;
  dividerGroups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
  nowMs?: number;
}): { ok: boolean; error?: string; nextState: ActivityProSessionState } {
  const { session, dividerGroups, presentStudents, nowMs = Date.now() } = params;
  const { groups, schedule } = buildActivityScheduleForState({
    session,
    dividerGroups,
    presentStudents,
  });

  if (!schedule.canStart || schedule.phases.length === 0) {
    return {
      ok: false,
      error: schedule.errors[0] || 'Cấu hình chưa hợp lệ để bắt đầu hoạt động.',
      nextState: session,
    };
  }

  const firstPhase = schedule.phases[0];
  const nextToken = session.activePhaseToken + 1;

  return {
    ok: true,
    nextState: {
      ...session,
      status: 'running',
      currentPhaseIndex: 0,
      phaseEndAtMs: nowMs + firstPhase.durationSeconds * 1000,
      remainingMsWhenPaused: firstPhase.durationSeconds * 1000,
      activePhaseToken: nextToken,
      bellHandledForToken: 0,
      startedAtMs: nowMs,
      endedAtMs: null,
      lockedGroupsSnapshot: groups,
      lockedSchedule: schedule,
      updatedAtMs: nowMs,
    },
  };
}

export function pauseActivityRun(
  session: ActivityProSessionState,
  nowMs = Date.now()
): ActivityProSessionState {
  if (session.status !== 'running') return session;
  const remaining =
    session.phaseEndAtMs !== null
      ? Math.max(0, session.phaseEndAtMs - nowMs)
      : session.remainingMsWhenPaused;

  return {
    ...session,
    status: 'paused',
    phaseEndAtMs: null,
    remainingMsWhenPaused: remaining,
    updatedAtMs: nowMs,
  };
}

export function resumeActivityRun(
  session: ActivityProSessionState,
  nowMs = Date.now()
): ActivityProSessionState {
  if (session.status !== 'paused' || !session.lockedSchedule) return session;
  const phase = session.lockedSchedule.phases[session.currentPhaseIndex];
  const remaining =
    session.remainingMsWhenPaused > 0
      ? session.remainingMsWhenPaused
      : (phase?.durationSeconds || 60) * 1000;

  return {
    ...session,
    status: 'running',
    phaseEndAtMs: nowMs + remaining,
    remainingMsWhenPaused: remaining,
    updatedAtMs: nowMs,
  };
}

export function goToActivityPhase(params: {
  session: ActivityProSessionState;
  targetPhaseIndex: number;
  expectedToken?: number;
  nowMs?: number;
}): ActivityProSessionState {
  const { session, targetPhaseIndex, expectedToken, nowMs = Date.now() } = params;
  if (expectedToken !== undefined && session.activePhaseToken !== expectedToken) {
    // Prevent double-step race between manual click and auto-advance tick
    return session;
  }
  const schedule = session.lockedSchedule;
  if (!schedule || schedule.phases.length === 0) return session;

  if (targetPhaseIndex >= schedule.phases.length) {
    return finishActivityRun(session, nowMs);
  }

  const clampedIdx = Math.max(0, Math.min(schedule.phases.length - 1, targetPhaseIndex));
  const targetPhase = schedule.phases[clampedIdx];
  const durationMs = targetPhase.durationSeconds * 1000;
  const nextToken = session.activePhaseToken + 1;

  return {
    ...session,
    status: session.status === 'completed' ? 'paused' : session.status,
    currentPhaseIndex: clampedIdx,
    remainingMsWhenPaused: durationMs,
    phaseEndAtMs: session.status === 'running' ? nowMs + durationMs : null,
    activePhaseToken: nextToken,
    endedAtMs: null,
    updatedAtMs: nowMs,
  };
}

export function finishActivityRun(
  session: ActivityProSessionState,
  nowMs = Date.now()
): ActivityProSessionState {
  return {
    ...session,
    status: 'completed',
    phaseEndAtMs: null,
    remainingMsWhenPaused: 0,
    endedAtMs: nowMs,
    updatedAtMs: nowMs,
  };
}

export function resetActivityToIdle(
  session: ActivityProSessionState,
  previewSchedule?: ActivityScheduleResult,
  nowMs = Date.now()
): ActivityProSessionState {
  const firstSeconds = previewSchedule?.phases[0]?.durationSeconds ?? session.stationConfig.workSeconds;
  return {
    ...session,
    status: 'idle',
    currentPhaseIndex: 0,
    phaseEndAtMs: null,
    remainingMsWhenPaused: firstSeconds * 1000,
    activePhaseToken: session.activePhaseToken + 1,
    bellHandledForToken: 0,
    startedAtMs: null,
    endedAtMs: null,
    lockedGroupsSnapshot: null,
    lockedSchedule: null,
    updatedAtMs: nowMs,
  };
}

export function rebuildLockedScheduleWhilePaused(params: {
  session: ActivityProSessionState;
  dividerGroups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
  nowMs?: number;
}): { ok: boolean; error?: string; nextState: ActivityProSessionState } {
  const { session, dividerGroups, presentStudents, nowMs = Date.now() } = params;
  const { groups, schedule } = buildActivityScheduleForState({
    session,
    dividerGroups,
    presentStudents,
  });

  if (!schedule.canStart || schedule.phases.length === 0) {
    return {
      ok: false,
      error: schedule.errors[0] || 'Không thể dựng lại lịch vì thiếu cấu hình.',
      nextState: session,
    };
  }

  const nextIdx = Math.min(session.currentPhaseIndex, schedule.phases.length - 1);
  const currentPhase = schedule.phases[nextIdx];
  const nextToken = session.activePhaseToken + 1;

  return {
    ok: true,
    nextState: {
      ...session,
      status: 'paused',
      currentPhaseIndex: nextIdx,
      phaseEndAtMs: null,
      remainingMsWhenPaused: currentPhase.durationSeconds * 1000,
      activePhaseToken: nextToken,
      lockedGroupsSnapshot: groups,
      lockedSchedule: schedule,
      updatedAtMs: nowMs,
    },
  };
}

export interface ActivityTickOutcome {
  nextState: ActivityProSessionState;
  remainingMs: number;
  displaySeconds: number;
  progressRatio: number;
  shouldRingBell: boolean;
  phaseChanged: boolean;
  completedNow: boolean;
}

/**
 * Pure timestamp-anchored clock tick.
 * - Handles tab-sleep recovery accurately against `phaseEndAtMs`.
 * - Never rings stacked duplicate bells for skipped historical phases.
 */
export function tickActivityRun(
  session: ActivityProSessionState,
  nowMs: number,
  previewSchedule?: ActivityScheduleResult
): ActivityTickOutcome {
  const activeSchedule = session.lockedSchedule || previewSchedule;
  const activePhase = activeSchedule?.phases[session.currentPhaseIndex];
  const phaseDurationMs = Math.max(1000, (activePhase?.durationSeconds || 60) * 1000);

  if (session.status === 'idle') {
    const firstMs = activeSchedule?.phases[0]
      ? activeSchedule.phases[0].durationSeconds * 1000
      : phaseDurationMs;
    return {
      nextState: session,
      remainingMs: firstMs,
      displaySeconds: Math.ceil(firstMs / 1000),
      progressRatio: 0,
      shouldRingBell: false,
      phaseChanged: false,
      completedNow: false,
    };
  }

  if (session.status === 'paused') {
    const rem = Math.max(0, session.remainingMsWhenPaused);
    return {
      nextState: session,
      remainingMs: rem,
      displaySeconds: Math.ceil(rem / 1000),
      progressRatio: Math.min(1, Math.max(0, 1 - rem / phaseDurationMs)),
      shouldRingBell: false,
      phaseChanged: false,
      completedNow: false,
    };
  }

  if (session.status === 'completed' || !activeSchedule || activeSchedule.phases.length === 0) {
    return {
      nextState: session,
      remainingMs: 0,
      displaySeconds: 0,
      progressRatio: 1,
      shouldRingBell: false,
      phaseChanged: false,
      completedNow: false,
    };
  }

  const endAt = session.phaseEndAtMs ?? nowMs + session.remainingMsWhenPaused;
  const rawRemaining = endAt - nowMs;

  if (rawRemaining > 0) {
    return {
      nextState: session,
      remainingMs: rawRemaining,
      displaySeconds: Math.ceil(rawRemaining / 1000),
      progressRatio: Math.min(1, Math.max(0, 1 - rawRemaining / phaseDurationMs)),
      shouldRingBell: false,
      phaseChanged: false,
      completedNow: false,
    };
  }

  // Phase reached 00:00 (or overslept past phaseEndAtMs)
  if (!session.autoAdvance) {
    const shouldRing = !session.bellMuted && session.bellHandledForToken !== session.activePhaseToken;
    const nextState: ActivityProSessionState = shouldRing
      ? {
          ...session,
          remainingMsWhenPaused: 0,
          bellHandledForToken: session.activePhaseToken,
          updatedAtMs: nowMs,
        }
      : session;

    return {
      nextState,
      remainingMs: 0,
      displaySeconds: 0,
      progressRatio: 1,
      shouldRingBell: shouldRing,
      phaseChanged: false,
      completedNow: false,
    };
  }

  // Auto-advance ON: walk forward cleanly from `endAt` across scheduled phases (no burst of bells!)
  let overshootMs = Math.abs(rawRemaining);
  let idx = session.currentPhaseIndex + 1;
  const phases = activeSchedule.phases;

  while (idx < phases.length) {
    const nextDurMs = phases[idx].durationSeconds * 1000;
    if (overshootMs < nextDurMs) {
      const nextRemaining = nextDurMs - overshootMs;
      const nextToken = session.activePhaseToken + 1;
      const shouldRing = !session.bellMuted && session.bellHandledForToken !== session.activePhaseToken;
      const nextState: ActivityProSessionState = {
        ...session,
        currentPhaseIndex: idx,
        phaseEndAtMs: nowMs + nextRemaining,
        remainingMsWhenPaused: nextRemaining,
        activePhaseToken: nextToken,
        bellHandledForToken: nextToken - 1,
        updatedAtMs: nowMs,
      };
      return {
        nextState,
        remainingMs: nextRemaining,
        displaySeconds: Math.ceil(nextRemaining / 1000),
        progressRatio: Math.min(1, Math.max(0, 1 - nextRemaining / nextDurMs)),
        shouldRingBell: shouldRing,
        phaseChanged: true,
        completedNow: false,
      };
    }
    overshootMs -= nextDurMs;
    idx += 1;
  }

  // Exhausted all phases -> completed! Ring at most ONE final bell.
  const shouldRingFinal = !session.bellMuted && session.bellHandledForToken !== session.activePhaseToken;
  const finalState: ActivityProSessionState = {
    ...session,
    status: 'completed',
    currentPhaseIndex: phases.length - 1,
    phaseEndAtMs: null,
    remainingMsWhenPaused: 0,
    activePhaseToken: session.activePhaseToken + 1,
    bellHandledForToken: session.activePhaseToken + 1,
    endedAtMs: nowMs,
    updatedAtMs: nowMs,
  };

  return {
    nextState: finalState,
    remainingMs: 0,
    displaySeconds: 0,
    progressRatio: 1,
    shouldRingBell: shouldRingFinal,
    phaseChanged: true,
    completedNow: true,
  };
}

// ============================================================================
// 4 BUILT-IN SAMPLE PRESETS (READY TO LAUNCH IN 1 CLICK)
// ============================================================================

export const ACTIVITY_SAMPLE_PRESETS: ActivityPresetTemplate[] = [
  {
    id: 'preset_stations_6_groups',
    title: 'Mẫu 1 · Trạm 6 nhóm (44 phút 30 giây)',
    mode: 'station_rotation',
    badge: '6 trạm · 7p + 30s',
    description:
      '6 nhóm luân chuyển qua 6 trạm (7 phút/trạm, 30 giây chuyển trạm). Đủ 11 pha = 44 phút 30 giây.',
    apply: (current) => ({
      ...current,
      mode: 'station_rotation',
      status: 'idle',
      currentPhaseIndex: 0,
      phaseEndAtMs: null,
      lockedGroupsSnapshot: null,
      lockedSchedule: null,
      groupSource: {
        ...current.groupSource,
        sourceMode: 'names_only',
        manualGroupCount: 6,
        manualGroupNames: ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4', 'Nhóm 5', 'Nhóm 6'],
      },
      stationConfig: {
        workSeconds: 420,
        transitionSeconds: 30,
        allowWaitingTurns: true,
        stations: [
          { id: 'ps_1', title: 'Trạm 1 · Đọc hiểu tư liệu', task: 'Đọc phiếu tư liệu và tóm tắt 3 ý cốt lõi.', capacity: 1, materials: 'Phiếu số 1' },
          { id: 'ps_2', title: 'Trạm 2 · Quan sát thí nghiệm', task: 'Quan sát mẫu vật / video và ghi hiện tượng vào bảng.', capacity: 1, materials: 'Bộ mẫu vật' },
          { id: 'ps_3', title: 'Trạm 3 · Phân tích số liệu', task: 'Xử lý bảng số liệu và vẽ biểu đồ phác thảo.', capacity: 1, materials: 'Giấy A3 + thước' },
          { id: 'ps_4', title: 'Trạm 4 · Giải bài tập nhanh', task: 'Hoàn thành 2 bài tập vận dụng mức độ thông hiểu.', capacity: 1, materials: 'Bộ thẻ đề' },
          { id: 'ps_5', title: 'Trạm 5 · Tình huống thực tế', task: 'Đề xuất giải pháp cho tình huống ứng dụng đời sống.', capacity: 1, materials: 'Thẻ tình huống' },
          { id: 'ps_6', title: 'Trạm 6 · Kiểm tra chéo', task: 'Đối chiếu kết quả mẫu và ghi câu hỏi cần giải đáp.', capacity: 1, materials: 'Phiếu tự kiểm tra' },
        ],
      },
      remainingMsWhenPaused: 420 * 1000,
    }),
  },
  {
    id: 'preset_jigsaw_24hs',
    title: 'Mẫu 2 · Mảnh ghép 24 HS · 6 nhóm · 4 chủ đề (23 phút)',
    mode: 'jigsaw',
    badge: '10p + 1p + 12p',
    description:
      '24 HS chia 6 nhóm gốc, 4 chủ đề chuyên gia (10 phút chuyên gia, 1 phút di chuyển, 12 phút mảnh ghép).',
    apply: (current) => {
      const sample24 = Array.from({ length: 24 }, (_, idx) => {
        const num = String(idx + 1).padStart(2, '0');
        return `Học sinh mẫu ${num}`;
      }).join('\n');
      return {
        ...current,
        mode: 'jigsaw',
        status: 'idle',
        currentPhaseIndex: 0,
        phaseEndAtMs: null,
        lockedGroupsSnapshot: null,
        lockedSchedule: null,
        groupSource: {
          ...current.groupSource,
          sourceMode: 'quick_split',
          quickGroupCount: 6,
          quickPasteText: sample24,
        },
        jigsawConfig: {
          expertSeconds: 600,
          moveSeconds: 60,
          homeShareSeconds: 720,
          allowDualExpertRole: false,
          topics: [
            { id: 'pj_1', title: 'Chủ đề 1 · Nguyên lý cơ bản', task: 'Làm rõ định nghĩa, đặc điểm và điều kiện xảy ra.', materials: 'Phiếu Chuyên gia A' },
            { id: 'pj_2', title: 'Chủ đề 2 · Cấu trúc & Thành phần', task: 'Phân tích từng thành phần và vai trò liên kết.', materials: 'Phiếu Chuyên gia B' },
            { id: 'pj_3', title: 'Chủ đề 3 · Quy trình & Ví dụ', task: 'Lập quy trình thực hiện kèm 1 ví dụ chuẩn xác.', materials: 'Phiếu Chuyên gia C' },
            { id: 'pj_4', title: 'Chủ đề 4 · Ứng dụng & Mở rộng', task: 'Đề xuất 2 ứng dụng thực tế và lưu ý an toàn.', materials: 'Phiếu Chuyên gia D' },
          ],
        },
        remainingMsWhenPaused: 600 * 1000,
      };
    },
  },
  {
    id: 'preset_tablecloth_10m',
    title: 'Mẫu 3 · Khăn trải bàn 4 nhóm (10 phút)',
    mode: 'tablecloth',
    badge: '4p cá nhân + 6p thống nhất',
    description:
      '4 nhóm thảo luận theo 2 pha: 4 phút cá nhân viết góc riêng + 6 phút thống nhất vào ô trung tâm.',
    apply: (current) => ({
      ...current,
      mode: 'tablecloth',
      status: 'idle',
      currentPhaseIndex: 0,
      phaseEndAtMs: null,
      lockedGroupsSnapshot: null,
      lockedSchedule: null,
      groupSource: {
        ...current.groupSource,
        sourceMode: 'names_only',
        manualGroupCount: 4,
        manualGroupNames: ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4'],
      },
      tableclothConfig: {
        sharedPrompt:
          'Giải pháp nào giúp lớp mình giữ trật tự và hợp tác hiệu quả nhất trong giờ thảo luận nhóm?',
        usePerGroupPrompts: false,
        perGroupPrompts: {},
        individualSeconds: 240,
        consensusSeconds: 360,
        manualBoxCountPerGroup: 4,
      },
      remainingMsWhenPaused: 240 * 1000,
    }),
  },
  {
    id: 'preset_gallery_6_groups',
    title: 'Mẫu 4 · Phòng tranh 6 nhóm (24 phút)',
    mode: 'gallery_walk',
    badge: '5 lượt × 4p + 30s + 2p cuối',
    description:
      '6 nhóm tham quan chéo qua 5 lượt xem (4 phút/lượt, 30 giây chuyển lượt, 2 phút tổng hợp cuối = 24 phút).',
    apply: (current) => ({
      ...current,
      mode: 'gallery_walk',
      status: 'idle',
      currentPhaseIndex: 0,
      phaseEndAtMs: null,
      lockedGroupsSnapshot: null,
      lockedSchedule: null,
      groupSource: {
        ...current.groupSource,
        sourceMode: 'names_only',
        manualGroupCount: 6,
        manualGroupNames: ['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 4', 'Nhóm 5', 'Nhóm 6'],
      },
      galleryConfig: {
        products: {
          grp_named_1: { title: 'Poster · Năng lượng sạch', subtitle: 'Nhóm 1' },
          grp_named_2: { title: 'Sơ đồ tư duy · Tái chế rác', subtitle: 'Nhóm 2' },
          grp_named_3: { title: 'Infographic · Tiết kiệm nước', subtitle: 'Nhóm 3' },
          grp_named_4: { title: 'Mô hình · Lớp học xanh', subtitle: 'Nhóm 4' },
          grp_named_5: { title: 'Bảng tin · Giảm nhựa 1 lần', subtitle: 'Nhóm 5' },
          grp_named_6: { title: 'Kế hoạch · Tuần lễ môi trường', subtitle: 'Nhóm 6' },
        },
        visitSeconds: 240,
        transitionSeconds: 30,
        includeFinalReviewPhase: true,
        finalReviewSeconds: 120,
        feedbackChecklist: [
          '1 điểm mạnh nổi bật nhất',
          '1 câu hỏi muốn làm rõ thêm',
          '1 đề xuất cải tiến thiết thực',
        ],
      },
      remainingMsWhenPaused: 240 * 1000,
    }),
  },
];

// ============================================================================
// ISOLATED STORAGE & LESSON PACKAGE SERIALIZATION
// ============================================================================

export function getActivityProStorageKey(
  classId: string,
  accountId?: string | null
): string {
  const safeAccount = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClass = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_activity_pro_v2_${safeAccount}_cls_${safeClass}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function saveActivityProSession(
  session: ActivityProSessionState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = getActivityProStorageKey(session.classId, accountId);
    window.localStorage.setItem(key, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function loadActivityProSession(
  classId: string,
  accountId?: string | null
): ActivityProSessionState | null {
  if (typeof window === 'undefined') return null;
  const key = getActivityProStorageKey(classId, accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActivityProSessionState>;
    if (!parsed || parsed.version !== 2 || parsed.classId !== classId) {
      return null;
    }
    return parsed as ActivityProSessionState;
  } catch {
    return null;
  }
}

export function getActivityProjectorChannelName(classId: string): string {
  const safeClass = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `taydo_activity_projector_${safeClass}`;
}

/**
 * Strips student names/IDs/live runtime clocks when saving an ActivityPro config
 * into a reusable LessonPackage (so applying it on another class starts fresh at Phase 1).
 */
export interface ActivityProPackageTemplate {
  mode: ActivityMode;
  groupSourceMode: ActivityGroupSourceMode;
  quickGroupCount: number;
  manualGroupCount: number;
  manualGroupNames: string[];
  stationConfig: StationRotationConfig;
  jigsawConfig: JigsawConfig;
  tableclothConfig: TableclothConfig;
  galleryProductTitles: string[];
  galleryVisitSeconds: number;
  galleryTransitionSeconds: number;
  galleryIncludeFinalReviewPhase: boolean;
  galleryFinalReviewSeconds: number;
  galleryFeedbackChecklist: string[];
  autoAdvance: boolean;
  teacherPrivateNote: string;
}

export function extractActivityProTemplate(
  session: ActivityProSessionState
): ActivityProPackageTemplate {
  return {
    mode: session.mode,
    groupSourceMode:
      session.groupSource.sourceMode === 'quick_split' ? 'quick_split' : session.groupSource.sourceMode,
    quickGroupCount: session.groupSource.quickGroupCount,
    manualGroupCount: session.groupSource.manualGroupCount,
    manualGroupNames: session.groupSource.manualGroupNames.slice(),
    stationConfig: {
      ...session.stationConfig,
      stations: session.stationConfig.stations.map((s) => ({ ...s })),
    },
    jigsawConfig: {
      ...session.jigsawConfig,
      topics: session.jigsawConfig.topics.map((t) => ({ ...t })),
    },
    tableclothConfig: {
      sharedPrompt: session.tableclothConfig.sharedPrompt,
      usePerGroupPrompts: session.tableclothConfig.usePerGroupPrompts,
      perGroupPrompts: { ...session.tableclothConfig.perGroupPrompts },
      individualSeconds: session.tableclothConfig.individualSeconds,
      consensusSeconds: session.tableclothConfig.consensusSeconds,
      manualBoxCountPerGroup: session.tableclothConfig.manualBoxCountPerGroup,
    },
    galleryProductTitles: Object.values(session.galleryConfig.products).map((p) => p.title),
    galleryVisitSeconds: session.galleryConfig.visitSeconds,
    galleryTransitionSeconds: session.galleryConfig.transitionSeconds,
    galleryIncludeFinalReviewPhase: session.galleryConfig.includeFinalReviewPhase,
    galleryFinalReviewSeconds: session.galleryConfig.finalReviewSeconds,
    galleryFeedbackChecklist: session.galleryConfig.feedbackChecklist.slice(),
    autoAdvance: session.autoAdvance,
    teacherPrivateNote: session.teacherPrivateNote,
  };
}

export function hydrateActivityProFromTemplate(params: {
  template: ActivityProPackageTemplate;
  targetClassId: string;
  targetClassName: string;
  dividerGroups: StudentGroupItem[];
  presentStudents: ToolStudentItem[];
  nowMs?: number;
}): ActivityProSessionState {
  const { template, targetClassId, targetClassName, dividerGroups, presentStudents, nowMs = Date.now() } = params;
  const fresh = createInitialActivityProSession({
    classId: targetClassId,
    className: targetClassName,
    dividerGroups,
    presentStudents,
    nowMs,
  });

  return {
    ...fresh,
    mode: template.mode,
    groupSource: {
      sourceMode:
        dividerGroups.some((g) => g.studentIds.length > 0) && template.groupSourceMode === 'from_divider'
          ? 'from_divider'
          : presentStudents.length > 0 && template.groupSourceMode !== 'names_only'
          ? 'quick_split'
          : template.groupSourceMode,
      quickGroupCount: template.quickGroupCount,
      quickPasteText: '', // Strictly never carry over old class student names
      manualGroupCount: template.manualGroupCount,
      manualGroupNames: template.manualGroupNames.slice(),
    },
    stationConfig: {
      ...template.stationConfig,
      stations: template.stationConfig.stations.map((s) => ({ ...s })),
    },
    jigsawConfig: {
      ...template.jigsawConfig,
      topics: template.jigsawConfig.topics.map((t) => ({ ...t })),
    },
    tableclothConfig: {
      ...template.tableclothConfig,
      perGroupPrompts: { ...template.tableclothConfig.perGroupPrompts },
    },
    galleryConfig: {
      products: {},
      visitSeconds: template.galleryVisitSeconds,
      transitionSeconds: template.galleryTransitionSeconds,
      includeFinalReviewPhase: template.galleryIncludeFinalReviewPhase,
      finalReviewSeconds: template.galleryFinalReviewSeconds,
      feedbackChecklist: template.galleryFeedbackChecklist.slice(),
    },
    autoAdvance: template.autoAdvance,
    teacherPrivateNote: template.teacherPrivateNote,
  };
}
