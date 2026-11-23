import * as XLSX from 'xlsx';
import { cryptoRandomInt } from '../games/wheel3dMath';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export const MAX_PICKER_STUDENTS = 50;
export const MAX_NUMBER_RANGE_SPAN = 10000;

export type PickerCallMode =
  | 'wheel'
  | 'draw_box'
  | 'slot_machine'
  | 'flip_cards'
  | 'elimination';

export const PICKER_CALL_MODE_META: Record<
  PickerCallMode,
  { id: PickerCallMode; code: string; label: string; shortDesc: string }
> = {
  wheel: {
    id: 'wheel',
    code: 'A',
    label: 'Vòng quay',
    shortDesc: 'Vòng quay may mắn hiển thị STT/tên rút gọn khi lớp đông và dừng đúng tên đã chốt.',
  },
  draw_box: {
    id: 'draw_box',
    code: 'B',
    label: 'Hộp bốc thăm',
    shortDesc: 'Mở hộp bốc thăm lấy từng phiếu tên rồi giữ trọn danh sách kết quả để đọc.',
  },
  slot_machine: {
    id: 'slot_machine',
    code: 'C',
    label: 'Máy xèng',
    shortDesc: 'Trục tên quay nhanh rồi hãm dần trên khung chủ đề lớp học, dừng đúng kết quả.',
  },
  flip_cards: {
    id: 'flip_cards',
    code: 'D',
    label: 'Lật thẻ bí ẩn',
    shortDesc: 'Các thẻ úp bí mật; bấm thẻ hoặc phím chọn để lật mở kết quả đã chốt.',
  },
  elimination: {
    id: 'elimination',
    code: 'E',
    label: 'Loại trừ dần',
    shortDesc: 'Làm mờ lần lượt các ứng viên rời sân khấu và giữ lại đúng k người chiến thắng.',
  },
};

export type PickerScope = 'all_present' | 'starred_only';
export type PickerClassSourceType = 'real_readonly' | 'sample_editable' | 'imported_local';

export interface PickerStudentItem {
  id: string;
  code: string; // Always string so leading zeros like "001" stay intact
  fullName: string;
  present: boolean;
  starred: boolean;
  score: number;
}

export interface PickerLocalClassRecord {
  id: string;
  name: string;
  sourceType: 'sample_editable' | 'imported_local';
  createdAtMs: number;
  students: {
    id: string;
    code: string;
    fullName: string;
    present: boolean;
  }[];
}

export interface PickerTurnRecord {
  turnId: string;
  classId: string;
  mode: PickerCallMode;
  scope: PickerScope;
  requestedK: number;
  pickedStudents: { id: string; code: string; fullName: string }[];
  status: 'animating' | 'revealed';
  startedAtMs: number;
  recordedInHistory: boolean;
}

export interface PickerHistoryEntry {
  turnId: string;
  timestampMs: number;
  mode: PickerCallMode;
  modeLabel: string;
  scope: PickerScope;
  pickedStudents: { id: string; code: string; fullName: string }[];
}

export interface PickerScoreUndoEntry {
  actionId: string;
  studentId: string;
  studentName: string;
  delta: 1 | -1;
  timestampMs: number;
}

export interface NamePickerClassState {
  version: 1;
  classId: string;
  className: string;
  sourceType: PickerClassSourceType;
  students: PickerStudentItem[];
  scope: PickerScope;
  noRepeatInRound: boolean;
  requestedK: number;
  calledIdsInRound: string[];
  history: PickerHistoryEntry[];
  activeTurn: PickerTurnRecord | null;
  lastScoreUndo: PickerScoreUndoEntry | null;
  processedScoreActionIds: string[];
  updatedAtMs: number;
}

export interface PickerEligibilityResult {
  presentCount: number;
  eligiblePool: PickerStudentItem[];
  remainingPool: PickerStudentItem[];
  canCallNow: boolean;
  shortfall: { remainingCount: number; requestedK: number } | null;
  blockedReason: string;
}

// ============================================================================
// RANDOM UTILITIES STATE (STRICTLY ISOLATED FROM STUDENT PICKER)
// ============================================================================
export interface DiceRollEntry {
  rollId: string;
  diceCount: 1 | 2 | 3;
  values: number[];
  sum: number;
  timestampMs: number;
}

export type CoinSide = 'Sấp' | 'Ngửa';

export interface NumberDrawEntry {
  drawId: string;
  value: number;
  timestampMs: number;
}

export interface PickerUtilitiesState {
  diceCount: 1 | 2 | 3;
  lastDiceValues: number[];
  lastDiceSum: number | null;
  diceHistory: DiceRollEntry[];
  lastCoinSide: CoinSide | null;
  coinHeadsCount: number; // Ngửa
  coinTailsCount: number; // Sấp
  coinTotalFlips: number;
  numberFrom: number;
  numberTo: number;
  numberNoRepeat: boolean;
  activeRangeFrom: number;
  activeRangeTo: number;
  lastDrawnNumber: number | null;
  drawnNumbers: number[];
  numberHistory: NumberDrawEntry[];
  numberError: string;
  numberExhausted: boolean;
}

export function createDefaultUtilitiesState(): PickerUtilitiesState {
  return {
    diceCount: 2,
    lastDiceValues: [1, 6],
    lastDiceSum: null,
    diceHistory: [],
    lastCoinSide: null,
    coinHeadsCount: 0,
    coinTailsCount: 0,
    coinTotalFlips: 0,
    numberFrom: 1,
    numberTo: 50,
    numberNoRepeat: true,
    activeRangeFrom: 1,
    activeRangeTo: 50,
    lastDrawnNumber: null,
    drawnNumbers: [],
    numberHistory: [],
    numberError: '',
    numberExhausted: false,
  };
}

// ============================================================================
// SAMPLE CLASS PRESET GENERATORS
// ============================================================================
export function createPickerSampleClass(params: {
  preset: 'standard_12' | 'sample_50' | 'sample_1' | 'sample_empty' | 'sample_dup_001';
  customName?: string;
  nowMs?: number;
}): PickerLocalClassRecord {
  const { preset, customName, nowMs = Date.now() } = params;
  const id = `picker_sample_${preset}_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

  const makeRoster = (count: number, prefix: string, includeDup = false) => {
    const surnames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Phan', 'Đặng', 'Bùi', 'Đỗ'];
    const middles = ['Văn', 'Minh', 'Ngọc', 'Thanh', 'Gia', 'Bảo', 'Hoàng', 'Phương'];
    const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Hiếu', 'Hương', 'Khang', 'Linh', 'Mai', 'Nam', 'Nhi', 'Quân', 'Thảo', 'Trang'];
    return Array.from({ length: count }, (_, idx) => {
      const code = String(idx + 1).padStart(3, '0');
      let fullName = `${surnames[idx % surnames.length]} ${middles[(idx * 3) % middles.length]} ${firstNames[(idx * 5) % firstNames.length]}`;
      if (includeDup && (idx === 0 || idx === 1)) {
        fullName = 'Nguyễn Minh An';
      }
      return {
        id: `${prefix}_${code}_${idx + 1}`,
        code,
        fullName,
        present: true,
      };
    });
  };

  if (preset === 'sample_empty') {
    return {
      id,
      name: customName?.trim() || 'Lớp mẫu trống (0 HS)',
      sourceType: 'sample_editable',
      createdAtMs: nowMs,
      students: [],
    };
  }
  if (preset === 'sample_1') {
    return {
      id,
      name: customName?.trim() || 'Lớp mẫu 1 HS',
      sourceType: 'sample_editable',
      createdAtMs: nowMs,
      students: makeRoster(1, id, false),
    };
  }
  if (preset === 'sample_50') {
    return {
      id,
      name: customName?.trim() || 'Lớp mẫu 50 HS (Mã 001–050)',
      sourceType: 'sample_editable',
      createdAtMs: nowMs,
      students: makeRoster(50, id, true),
    };
  }
  if (preset === 'sample_dup_001') {
    return {
      id,
      name: customName?.trim() || 'Lớp mẫu trùng tên & 1 vắng',
      sourceType: 'sample_editable',
      createdAtMs: nowMs,
      students: [
        { id: `${id}_001`, code: '001', fullName: 'Nguyễn Văn An', present: true },
        { id: `${id}_002`, code: '002', fullName: 'Nguyễn Văn An', present: true },
        { id: `${id}_003`, code: '003', fullName: 'Trần Thị Bình', present: false },
        { id: `${id}_004`, code: '004', fullName: 'Lê Hoàng Châu', present: true },
        { id: `${id}_005`, code: '005', fullName: 'Phạm Gia Huy', present: true },
      ],
    };
  }
  return {
    id,
    name: customName?.trim() || 'Lớp mẫu chuẩn 12 HS',
    sourceType: 'sample_editable',
    createdAtMs: nowMs,
    students: makeRoster(12, id, false),
  };
}

export function createInitialClassState(params: {
  classId: string;
  className: string;
  sourceType: PickerClassSourceType;
  students: { id: string; code: string; fullName: string; present?: boolean }[];
  nowMs?: number;
}): NamePickerClassState {
  const nowMs = params.nowMs ?? Date.now();
  return {
    version: 1,
    classId: params.classId,
    className: params.className,
    sourceType: params.sourceType,
    students: params.students.slice(0, MAX_PICKER_STUDENTS).map((s, idx) => ({
      id: s.id || `${params.classId}_stu_${idx + 1}`,
      code: String(s.code || String(idx + 1).padStart(3, '0')).trim(),
      fullName: (s.fullName || `Học sinh ${idx + 1}`).trim(),
      present: s.present ?? true,
      starred: false,
      score: 0,
    })),
    scope: 'all_present',
    noRepeatInRound: true,
    requestedK: 1,
    calledIdsInRound: [],
    history: [],
    activeTurn: null,
    lastScoreUndo: null,
    processedScoreActionIds: [],
    updatedAtMs: nowMs,
  };
}

/**
 * Syncs a loaded class state with upstream roster when source is 'real_readonly',
 * preserving session attendance/stars/scores by stable student.id without mutating upstream DB.
 */
export function syncRealClassRosterWithState(
  state: NamePickerClassState,
  upstreamStudents: { id: string; code: string; fullName: string }[]
): NamePickerClassState {
  if (state.sourceType !== 'real_readonly') return state;
  const existingMap = new Map(state.students.map((s) => [s.id, s]));
  const merged: PickerStudentItem[] = upstreamStudents
    .slice(0, MAX_PICKER_STUDENTS)
    .map((u, idx) => {
      const prev = existingMap.get(u.id);
      return {
        id: u.id,
        code: String(u.code || String(idx + 1).padStart(3, '0')),
        fullName: u.fullName,
        present: prev ? prev.present : true,
        starred: prev ? prev.starred : false,
        score: prev ? prev.score : 0,
      };
    });
  return {
    ...state,
    students: merged,
  };
}

// ============================================================================
// EXCEL (.XLSX) & CLIPBOARD PASTE IMPORT / EXPORT (PRESERVES LEADING ZEROS!)
// ============================================================================
export interface PickerExcelPreviewRow {
  rowNumber: number;
  code: string;
  fullName: string;
  present: boolean;
  errors: string[];
}

export interface PickerExcelPreviewResult {
  rows: PickerExcelPreviewRow[];
  validRows: PickerExcelPreviewRow[];
  errorCount: number;
  hasDuplicateCodes: boolean;
  exceedsMaxStudents: boolean;
  globalError: string;
}

function parsePresentCell(raw: string): boolean {
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

export function extractMatrixFromXlsxBuffer(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: 'array', raw: false });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  if (!sheet || !sheet['!ref']) return [];

  const range = XLSX.utils.decode_range(sheet['!ref']);
  const matrix: string[][] = [];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowCells: string[] = [];
    let hasAnyContent = false;
    for (let c = range.s.c; c <= Math.min(range.e.c, range.s.c + 5); c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = sheet[addr];
      // Prefer formatted text `.w` or raw string `.v` so "001" stored as Text never degrades!
      const rawVal = cell
        ? cell.t === 's'
          ? String(cell.v ?? '')
          : typeof cell.w === 'string' && cell.w.length > 0
            ? cell.w
            : String(cell.v ?? '')
        : '';
      const trimmed = rawVal.trim();
      if (trimmed) hasAnyContent = true;
      rowCells.push(trimmed);
    }
    if (hasAnyContent) {
      matrix.push(rowCells);
    }
  }
  return matrix;
}

export function parseDelimitedRosterText(raw: string): string[][] {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const first = lines[0];
  const sep = first.includes('\t') ? '\t' : first.split(';').length > first.split(',').length ? ';' : ',';
  return lines.map((line) => line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

export function parsePickerExcelPreview(
  rawInput: string | string[][]
): PickerExcelPreviewResult {
  const matrix = Array.isArray(rawInput)
    ? rawInput
    : parseDelimitedRosterText(rawInput);

  if (matrix.length === 0) {
    return {
      rows: [],
      validRows: [],
      errorCount: 0,
      hasDuplicateCodes: false,
      exceedsMaxStudents: false,
      globalError: 'Chưa có dữ liệu học sinh để xem trước.',
    };
  }

  // Detect and skip explicit header row ("Mã học sinh", "Họ và tên", ...) without catching student names like "Học sinh 1" or "Hoàng..."
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
    c1Norm.includes('full name') ||
    c1Norm === 'name';

  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  const seenCodes = new Map<string, number>();
  let hasDuplicateCodes = false;

  const rows: PickerExcelPreviewRow[] = dataRows.map((cols, idx) => {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const code = String(cols[0] ?? '').trim();
    const fullName = String(cols[1] ?? '').trim();
    const present = parsePresentCell(cols[2] ?? '');
    const errors: string[] = [];

    if (!code) {
      errors.push('Thiếu Mã học sinh.');
    }
    if (!fullName) {
      errors.push('Thiếu Họ và tên.');
    }

    if (code) {
      const upper = code.toUpperCase();
      if (seenCodes.has(upper)) {
        hasDuplicateCodes = true;
        errors.push(`Trùng mã "${code}" (đã có ở dòng ${seenCodes.get(upper)}).`);
      } else {
        seenCodes.set(upper, rowNumber);
      }
    }

    if (idx + 1 > MAX_PICKER_STUDENTS) {
      errors.push(`Vượt giới hạn tối đa ${MAX_PICKER_STUDENTS} học sinh/lớp.`);
    }

    return { rowNumber, code, fullName, present, errors };
  });

  const exceedsMaxStudents = dataRows.length > MAX_PICKER_STUDENTS;
  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorCount = rows.filter((r) => r.errors.length > 0).length;

  let globalError = '';
  if (exceedsMaxStudents) {
    globalError = `Danh sách có ${dataRows.length} dòng, vượt giới hạn ${MAX_PICKER_STUDENTS} học sinh mỗi lớp.`;
  } else if (hasDuplicateCodes) {
    globalError = 'Phát hiện mã học sinh bị trùng trong danh sách. Hãy sửa mã trước khi nhập.';
  } else if (errorCount > 0) {
    globalError = `Có ${errorCount} dòng bị thiếu hoặc lỗi dữ liệu.`;
  }

  return {
    rows,
    validRows,
    errorCount,
    hasDuplicateCodes,
    exceedsMaxStudents,
    globalError,
  };
}

/**
 * Builds an XLSX binary Uint8Array with explicit STRING cell formatting (`t: 's'`, `z: '@'`)
 * on the "Mã học sinh" column so leading zeros ("001", "002") survive Excel save/reload 100%.
 */
export function buildPickerXlsxBytes(
  students: { code: string; fullName: string; present?: boolean }[],
  sheetName = 'DanhSachHocSinh'
): Uint8Array {
  const header = ['Mã học sinh', 'Họ và tên', 'Có mặt'];
  const aoa: (string)[][] = [
    header,
    ...students.map((s) => [
      String(s.code),
      String(s.fullName),
      s.present === false ? 'Vắng' : 'Có',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Enforce Text format `@` on every code cell in column A (index 0)
  for (let r = 1; r <= students.length; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    ws[addr] = {
      t: 's',
      v: String(students[r - 1].code),
      z: '@',
    };
  }
  ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'DanhSach');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(out);
}

export function buildPickerSampleXlsxBytes(): Uint8Array {
  return buildPickerXlsxBytes(
    [
      { code: '001', fullName: 'Nguyễn Minh An', present: true },
      { code: '002', fullName: 'Trần Thị Bảo Ngọc', present: true },
      { code: '003', fullName: 'Nguyễn Minh An', present: true },
      { code: '004', fullName: 'Lê Hoàng Gia Khang', present: true },
      { code: '005', fullName: 'Phạm Vũ Quỳnh Như', present: false },
      { code: '006', fullName: 'Đỗ Thanh Phương Thảo', present: true },
    ],
    'Mau_Goi_Ten'
  );
}

// ============================================================================
// SHARED SELECTION & ROUND ENGINE (USED IDENTICALLY BY ALL 5 MODES)
// ============================================================================
export function resolvePickerEligibility(
  state: NamePickerClassState,
  overrideK?: number
): PickerEligibilityResult {
  const k = Math.max(1, Math.round(overrideK ?? state.requestedK));
  const present = state.students.filter((s) => s.present);
  const eligiblePool =
    state.scope === 'starred_only' ? present.filter((s) => s.starred) : present;

  if (eligiblePool.length === 0) {
    return {
      presentCount: present.length,
      eligiblePool: [],
      remainingPool: [],
      canCallNow: false,
      shortfall: null,
      blockedReason:
        present.length === 0
          ? 'Lớp hiện chưa có học sinh nào có mặt. Hãy đánh dấu Có mặt hoặc thêm học sinh.'
          : 'Chưa có học sinh nào đang có mặt được gắn dấu sao Ưu tiên.',
    };
  }

  const calledSet = new Set(state.calledIdsInRound);
  const remainingPool = state.noRepeatInRound
    ? eligiblePool.filter((s) => !calledSet.has(s.id))
    : eligiblePool.slice();

  if (remainingPool.length === 0) {
    return {
      presentCount: present.length,
      eligiblePool,
      remainingPool: [],
      canCallNow: false,
      shortfall: null,
      blockedReason:
        'Tất cả học sinh trong phạm vi hiện tại đã được gọi hết trong vòng này. Nhấn "Bắt đầu vòng mới" để gọi tiếp.',
    };
  }

  if (remainingPool.length < k) {
    return {
      presentCount: present.length,
      eligiblePool,
      remainingPool,
      canCallNow: true,
      shortfall: { remainingCount: remainingPool.length, requestedK: k },
      blockedReason: '',
    };
  }

  return {
    presentCount: present.length,
    eligiblePool,
    remainingPool,
    canCallNow: true,
    shortfall: null,
    blockedReason: '',
  };
}

/**
 * Uniform unbiased selection of `count` distinct candidates without replacement.
 * Stars ONLY affect scope membership, NEVER probability weights.
 */
export function pickRandomStudentsUnbiased(
  pool: PickerStudentItem[],
  count: number,
  rngInt: (max: number) => number = cryptoRandomInt
): PickerStudentItem[] {
  if (pool.length === 0 || count <= 0) return [];
  const k = Math.min(pool.length, Math.max(1, Math.floor(count)));
  const working = pool.slice();
  const picked: PickerStudentItem[] = [];

  for (let i = 0; i < k; i++) {
    const idx = rngInt(working.length);
    const chosen = working.splice(idx, 1)[0];
    if (chosen) picked.push(chosen);
  }
  return picked;
}

export function beginPickerTurn(params: {
  state: NamePickerClassState;
  mode: PickerCallMode;
  countOverride?: number;
  skipAnimation?: boolean;
  nowMs?: number;
  rngInt?: (max: number) => number;
}): {
  ok: boolean;
  error?: string;
  requiresShortfallDecision?: { remainingCount: number; requestedK: number };
  nextState: NamePickerClassState;
} {
  const {
    state,
    mode,
    countOverride,
    skipAnimation = false,
    nowMs = Date.now(),
    rngInt = cryptoRandomInt,
  } = params;

  // Strictly lock trigger if an animation turn is already in progress (prevents double click / hold R)
  if (state.activeTurn && state.activeTurn.status === 'animating') {
    return {
      ok: false,
      error: 'Lượt gọi đang diễn ra.',
      nextState: state,
    };
  }

  const desiredK = Math.max(1, Math.round(countOverride ?? state.requestedK));
  const eligibility = resolvePickerEligibility(state, desiredK);

  if (!eligibility.canCallNow) {
    return {
      ok: false,
      error: eligibility.blockedReason,
      nextState: state,
    };
  }

  // If countOverride wasn't explicitly capped by user and remaining < desiredK, stop to ask user!
  if (eligibility.shortfall && countOverride === undefined) {
    return {
      ok: false,
      requiresShortfallDecision: eligibility.shortfall,
      nextState: state,
    };
  }

  const actualK = Math.min(desiredK, eligibility.remainingPool.length);
  const picked = pickRandomStudentsUnbiased(eligibility.remainingPool, actualK, rngInt);

  const turn: PickerTurnRecord = {
    turnId: `turn_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    classId: state.classId,
    mode,
    scope: state.scope,
    requestedK: actualK,
    pickedStudents: picked.map((s) => ({ id: s.id, code: s.code, fullName: s.fullName })),
    status: skipAnimation ? 'revealed' : 'animating',
    startedAtMs: nowMs,
    recordedInHistory: false,
  };

  let nextState: NamePickerClassState = {
    ...state,
    activeTurn: turn,
    updatedAtMs: nowMs,
  };

  if (skipAnimation) {
    nextState = finalizePickerTurn(nextState, nowMs);
  }

  return { ok: true, nextState };
}

/**
 * Idempotently finalizes the currently locked `activeTurn`.
 * - Records picked students into `calledIdsInRound` & `history` STRICTLY ONCE per `turnId`.
 * - Safe across mid-animation reloads or duplicate finalize calls!
 */
export function finalizePickerTurn(
  state: NamePickerClassState,
  nowMs = Date.now()
): NamePickerClassState {
  const turn = state.activeTurn;
  if (!turn) return state;

  const alreadyRecorded =
    turn.recordedInHistory || state.history.some((h) => h.turnId === turn.turnId);

  if (alreadyRecorded) {
    if (turn.status !== 'revealed') {
      return {
        ...state,
        activeTurn: { ...turn, status: 'revealed', recordedInHistory: true },
        updatedAtMs: nowMs,
      };
    }
    return state;
  }

  const newlyCalledIds = turn.pickedStudents.map((s) => s.id);
  const mergedCalledIds = Array.from(new Set([...state.calledIdsInRound, ...newlyCalledIds]));
  const historyEntry: PickerHistoryEntry = {
    turnId: turn.turnId,
    timestampMs: nowMs,
    mode: turn.mode,
    modeLabel: PICKER_CALL_MODE_META[turn.mode].label,
    scope: turn.scope,
    pickedStudents: turn.pickedStudents.map((s) => ({ ...s })),
  };

  return {
    ...state,
    calledIdsInRound: mergedCalledIds,
    history: [historyEntry, ...state.history].slice(0, 200),
    activeTurn: {
      ...turn,
      status: 'revealed',
      recordedInHistory: true,
    },
    updatedAtMs: nowMs,
  };
}

export function startNewPickerRound(
  state: NamePickerClassState,
  nowMs = Date.now()
): NamePickerClassState {
  return {
    ...state,
    calledIdsInRound: [],
    updatedAtMs: nowMs,
  };
}

export function clearClassPickerHistory(
  state: NamePickerClassState,
  nowMs = Date.now()
): NamePickerClassState {
  return {
    ...state,
    history: [],
    activeTurn:
      state.activeTurn && state.activeTurn.status === 'revealed' ? null : state.activeTurn,
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// SESSION ACTIVITY SCORE (+1 / -1, UNDO LATEST, CONFIRMED CLASS RESET)
// ============================================================================
export function adjustPickerStudentScore(params: {
  state: NamePickerClassState;
  studentId: string;
  delta: 1 | -1;
  actionId: string;
  nowMs?: number;
}): NamePickerClassState {
  const { state, studentId, delta, actionId, nowMs = Date.now() } = params;
  if (state.processedScoreActionIds.includes(actionId)) return state;
  const target = state.students.find((s) => s.id === studentId);
  if (!target) return state;

  return {
    ...state,
    students: state.students.map((s) =>
      s.id === studentId ? { ...s, score: s.score + delta } : s
    ),
    lastScoreUndo: {
      actionId,
      studentId,
      studentName: target.fullName,
      delta,
      timestampMs: nowMs,
    },
    processedScoreActionIds: [...state.processedScoreActionIds.slice(-150), actionId],
    updatedAtMs: nowMs,
  };
}

export function undoLastPickerScore(
  state: NamePickerClassState,
  nowMs = Date.now()
): NamePickerClassState {
  const last = state.lastScoreUndo;
  if (!last) return state;
  return {
    ...state,
    students: state.students.map((s) =>
      s.id === last.studentId ? { ...s, score: s.score - last.delta } : s
    ),
    lastScoreUndo: null,
    updatedAtMs: nowMs,
  };
}

export function resetClassPickerScores(
  state: NamePickerClassState,
  nowMs = Date.now()
): NamePickerClassState {
  return {
    ...state,
    students: state.students.map((s) => ({ ...s, score: 0 })),
    lastScoreUndo: null,
    updatedAtMs: nowMs,
  };
}

// ============================================================================
// THREE RANDOM UTILITIES (ISOLATED STATE & OPERATIONS)
// ============================================================================
export function rollPickerDice(
  utilities: PickerUtilitiesState,
  diceCount: 1 | 2 | 3,
  nowMs = Date.now(),
  rngInt: (max: number) => number = cryptoRandomInt
): PickerUtilitiesState {
  const values = Array.from({ length: diceCount }, () => rngInt(6) + 1);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const entry: DiceRollEntry = {
    rollId: `dice_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    diceCount,
    values,
    sum,
    timestampMs: nowMs,
  };
  return {
    ...utilities,
    diceCount,
    lastDiceValues: values,
    lastDiceSum: sum,
    diceHistory: [entry, ...utilities.diceHistory].slice(0, 30),
  };
}

export function flipPickerCoin(
  utilities: PickerUtilitiesState,
  rngInt: (max: number) => number = cryptoRandomInt
): PickerUtilitiesState {
  const side: CoinSide = rngInt(2) === 0 ? 'Sấp' : 'Ngửa';
  return {
    ...utilities,
    lastCoinSide: side,
    coinTailsCount: utilities.coinTailsCount + (side === 'Sấp' ? 1 : 0),
    coinHeadsCount: utilities.coinHeadsCount + (side === 'Ngửa' ? 1 : 0),
    coinTotalFlips: utilities.coinTotalFlips + 1,
  };
}

export function resetCoinStats(utilities: PickerUtilitiesState): PickerUtilitiesState {
  return {
    ...utilities,
    lastCoinSide: null,
    coinHeadsCount: 0,
    coinTailsCount: 0,
    coinTotalFlips: 0,
  };
}

export function drawPickerRandomNumber(params: {
  utilities: PickerUtilitiesState;
  fromInput: number;
  toInput: number;
  noRepeat: boolean;
  nowMs?: number;
  rngInt?: (max: number) => number;
}): PickerUtilitiesState {
  const {
    utilities,
    fromInput,
    toInput,
    noRepeat,
    nowMs = Date.now(),
    rngInt = cryptoRandomInt,
  } = params;

  const from = Math.trunc(Number(fromInput));
  const to = Math.trunc(Number(toInput));

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return {
      ...utilities,
      numberError: 'Khoảng số phải là hai số nguyên hợp lệ.',
    };
  }
  if (from > to) {
    return {
      ...utilities,
      numberFrom: from,
      numberTo: to,
      numberError: `Số bắt đầu (${from}) không được lớn hơn số kết thúc (${to}).`,
    };
  }
  const span = to - from + 1;
  if (span > MAX_NUMBER_RANGE_SPAN) {
    return {
      ...utilities,
      numberFrom: from,
      numberTo: to,
      numberError: `Phạm vi bốc số tối đa là ${MAX_NUMBER_RANGE_SPAN} số mỗi khoảng (hiện tại: ${span}).`,
    };
  }

  // Detect range change -> automatically start fresh history for the new range!
  const rangeChanged =
    from !== utilities.activeRangeFrom || to !== utilities.activeRangeTo;
  const baseDrawn = rangeChanged ? [] : utilities.drawnNumbers;
  const baseHistory = rangeChanged ? [] : utilities.numberHistory;

  const drawnSet = new Set(baseDrawn);
  const candidates: number[] = [];
  if (noRepeat) {
    for (let n = from; n <= to; n++) {
      if (!drawnSet.has(n)) candidates.push(n);
    }
    if (candidates.length === 0) {
      return {
        ...utilities,
        numberFrom: from,
        numberTo: to,
        numberNoRepeat: noRepeat,
        activeRangeFrom: from,
        activeRangeTo: to,
        drawnNumbers: baseDrawn,
        numberHistory: baseHistory,
        numberExhausted: true,
        numberError: `Đã bốc hết toàn bộ ${span} số trong khoảng ${from}–${to}. Nhấn "Làm mới" để bắt đầu lại.`,
      };
    }
  }

  const picked = noRepeat
    ? candidates[rngInt(candidates.length)]
    : from + rngInt(span);

  const entry: NumberDrawEntry = {
    drawId: `num_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    value: picked,
    timestampMs: nowMs,
  };

  const nextDrawn = noRepeat ? [...baseDrawn, picked] : baseDrawn;
  return {
    ...utilities,
    numberFrom: from,
    numberTo: to,
    numberNoRepeat: noRepeat,
    activeRangeFrom: from,
    activeRangeTo: to,
    lastDrawnNumber: picked,
    drawnNumbers: nextDrawn,
    numberHistory: [entry, ...baseHistory].slice(0, 100),
    numberExhausted: noRepeat && nextDrawn.length >= span,
    numberError: '',
  };
}

export function resetNumberDrawState(utilities: PickerUtilitiesState): PickerUtilitiesState {
  return {
    ...utilities,
    activeRangeFrom: utilities.numberFrom,
    activeRangeTo: utilities.numberTo,
    lastDrawnNumber: null,
    drawnNumbers: [],
    numberHistory: [],
    numberError: '',
    numberExhausted: false,
  };
}

// ============================================================================
// ISOLATED STORAGE PER CLASS, ACCOUNT & /demo
// ============================================================================
function getPickerScopePrefix(accountId?: string | null): string {
  const safeAccount = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_name_picker_v1_${safeAccount}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function getNamePickerClassStorageKey(
  classId: string,
  accountId?: string | null
): string {
  const safeCls = (classId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${getPickerScopePrefix(accountId)}_cls_${safeCls}`;
}

export function getNamePickerLocalClassesKey(accountId?: string | null): string {
  return `${getPickerScopePrefix(accountId)}_local_classes`;
}

export function getNamePickerUtilitiesKey(accountId?: string | null): string {
  return `${getPickerScopePrefix(accountId)}_utilities`;
}

export function saveNamePickerClassState(
  state: NamePickerClassState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getNamePickerClassStorageKey(state.classId, accountId),
      JSON.stringify(state)
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads class picker state and performs atomic reload recovery:
 * If `activeTurn` was locked in `'animating'` right before reload, commits it ONCE to
 * `calledIdsInRound` + `history` and reveals the exact pre-locked students without duplication!
 */
export function loadNamePickerClassState(
  classId: string,
  accountId?: string | null
): NamePickerClassState | null {
  if (typeof window === 'undefined') return null;
  const key = getNamePickerClassStorageKey(classId, accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<NamePickerClassState>;
    if (!parsed || parsed.version !== 1 || parsed.classId !== classId || !Array.isArray(parsed.students)) {
      return null;
    }
    let loaded = parsed as NamePickerClassState;
    if (loaded.activeTurn && loaded.activeTurn.status === 'animating') {
      loaded = finalizePickerTurn(loaded, Date.now());
      saveNamePickerClassState(loaded, accountId);
    }
    return loaded;
  } catch {
    return null;
  }
}

export function loadPickerLocalClasses(accountId?: string | null): PickerLocalClassRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getNamePickerLocalClassesKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PickerLocalClassRecord[]) : [];
  } catch {
    return [];
  }
}

export function savePickerLocalClasses(
  classes: PickerLocalClassRecord[],
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getNamePickerLocalClassesKey(accountId),
      JSON.stringify(classes)
    );
    return true;
  } catch {
    return false;
  }
}

export function loadPickerUtilitiesState(accountId?: string | null): PickerUtilitiesState {
  if (typeof window === 'undefined') return createDefaultUtilitiesState();
  try {
    const raw = window.localStorage.getItem(getNamePickerUtilitiesKey(accountId));
    if (!raw) return createDefaultUtilitiesState();
    const parsed = JSON.parse(raw) as Partial<PickerUtilitiesState>;
    return {
      ...createDefaultUtilitiesState(),
      ...parsed,
    };
  } catch {
    return createDefaultUtilitiesState();
  }
}

export function savePickerUtilitiesState(
  utilities: PickerUtilitiesState,
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getNamePickerUtilitiesKey(accountId),
      JSON.stringify(utilities)
    );
    return true;
  } catch {
    return false;
  }
}
