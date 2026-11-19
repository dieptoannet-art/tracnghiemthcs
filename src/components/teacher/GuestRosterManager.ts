import * as XLSX from 'xlsx';
import { KHKT_DEMO_KEYS, isKhktDemoRuntime } from '../../utils/khktDemoSandbox';

export interface GuestStudentItem {
  guestStudentId: string;
  stt: number;
  fullName: string;
  participating: boolean;
  note?: string;
}

export interface GuestClassSession {
  guestSessionId: string;
  className: string;
  activityName: string;
  note: string;
  students: GuestStudentItem[];
  calledStudentIds: string[];
  allowRepeat: boolean;
  shareAcrossGames: boolean;
  updatedAt: string;
}

export interface GuestTurnHistoryItem {
  turnId: string;
  guestSessionId: string;
  gameId: string;
  gameCode: string;
  gameTitle: string;
  guestStudentId: string;
  studentName: string;
  className: string;
  timestamp: string;
  status: 'CALLED' | 'COMPLETED' | 'SKIPPED';
  note?: string;
}

export interface ParsedGuestRowPreview {
  stt: number;
  fullName: string;
  note?: string;
  isDuplicateInBatch: boolean;
  isDuplicateWithExisting: boolean;
}

export interface ParseGuestRosterResult {
  validRows: ParsedGuestRowPreview[];
  skippedCount: number;
  duplicateNames: string[];
}

const GUEST_SESSION_STORAGE_KEY = 'taydo_edu_guest_roster_session_v1';
const GUEST_HISTORY_STORAGE_KEY = 'taydo_edu_guest_turn_history_v1';
const GUEST_MODE_PREF_KEY = 'taydo_edu_roster_mode_pref_v1';

function getGuestSessionStorageKey(): string {
  return isKhktDemoRuntime() ? KHKT_DEMO_KEYS.GAME_GUEST_SESSION : GUEST_SESSION_STORAGE_KEY;
}
function getGuestHistoryStorageKey(): string {
  return isKhktDemoRuntime() ? KHKT_DEMO_KEYS.GAME_GUEST_HISTORY : GUEST_HISTORY_STORAGE_KEY;
}
function getGuestModePrefStorageKey(): string {
  return isKhktDemoRuntime() ? KHKT_DEMO_KEYS.GAME_MODE_PREF : GUEST_MODE_PREF_KEY;
}

// In-memory fallback when localStorage is unavailable or blocked
let memoryGuestSession: GuestClassSession | null = null;
let memoryGuestHistory: GuestTurnHistoryItem[] = [];
let memoryModePref: 'guest' | 'teacher' | null = null;

export function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const testKey = '__taydo_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function generateGuestId(prefix: string = 'guest'): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
}

export function normalizeVietnameseName(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADER_KEYWORDS = new Set([
  'stt',
  'so thu tu',
  'số thứ tự',
  'ho va ten',
  'họ và tên',
  'ho ten',
  'họ tên',
  'ten hoc sinh',
  'tên học sinh',
  'hoc sinh',
  'học sinh',
  'ten',
  'tên',
  'full name',
  'fullname',
  'student name',
  'name',
  'ghi chu',
  'ghi chú',
  'note',
]);

function isLikelyHeaderToken(text: string): boolean {
  const cleaned = normalizeVietnameseName(text).toLowerCase();
  return HEADER_KEYWORDS.has(cleaned);
}

function isPureOrderNumber(text: string): boolean {
  const cleaned = text.trim();
  // Matches "1", "01", "1.", "1)", "#1", "STT 1"
  return /^(?:#|stt\s*)?\d{1,4}[.)]?$/i.test(cleaned);
}

/**
 * Parses a single raw row (array of cell strings) into { fullName, note } or null if empty/header.
 */
export function extractStudentFromCells(cells: string[], rowIndex: number): { fullName: string; note?: string } | null {
  const trimmedCells = cells.map(c => normalizeVietnameseName(String(c ?? ''))).filter(Boolean);
  if (trimmedCells.length === 0) return null;

  // Check if first row is a header row
  if (rowIndex === 0) {
    const headerMatches = trimmedCells.filter(c => isLikelyHeaderToken(c));
    if (headerMatches.length >= 1 && (trimmedCells.length === 1 ? isLikelyHeaderToken(trimmedCells[0]) : headerMatches.length >= 1)) {
      const anyHeader = trimmedCells.some(c =>
        ['họ và tên', 'ho va ten', 'họ tên', 'ho ten', 'tên học sinh', 'ten hoc sinh', 'full name', 'student name', 'stt', 'số thứ tự'].includes(c.toLowerCase())
      );
      if (anyHeader) return null;
    }
  }

  // Case 1: Single cell (might be "1. Nguyễn Văn An" or "1\tNguyễn Văn An" or "Nguyễn Văn An")
  if (trimmedCells.length === 1) {
    const single = trimmedCells[0];
    if (isPureOrderNumber(single)) return null;
    // Strip leading order number like "1. Nguyễn Văn An" or "01 - Trần Thị Bình"
    const stripped = single.replace(/^\d{1,4}\s*[.)-]\s+/, '').trim();
    if (!stripped || isLikelyHeaderToken(stripped)) return null;
    return { fullName: stripped };
  }

  // Case 2: Two or more cells
  // E.g. [STT, Họ và tên] or [STT, Họ đệm, Tên, Ghi chú] or [Họ và tên, Ghi chú]
  let startIdx = 0;
  if (isPureOrderNumber(trimmedCells[0])) {
    startIdx = 1;
  }

  const remaining = trimmedCells.slice(startIdx);
  if (remaining.length === 0) return null;

  // Check if header row
  if (remaining.some(c => isLikelyHeaderToken(c)) && rowIndex === 0) {
    return null;
  }

  const fullName = remaining[0].replace(/^\d{1,4}\s*[.)-]\s+/, '').trim();
  if (!fullName || isPureOrderNumber(fullName)) return null;

  const note = remaining.length > 1 ? remaining.slice(1).join(' - ') : undefined;
  return { fullName, note };
}

/**
 * Parses multi-line text pasted from Excel, Google Sheets, Word, or direct input.
 */
export function parseRawTextToGuestRows(
  rawText: string,
  existingStudents: GuestStudentItem[] = []
): ParseGuestRosterResult {
  const lines = rawText.split(/\r?\n/);
  const existingNameSet = new Set(
    existingStudents.map(s => normalizeVietnameseName(s.fullName).toLowerCase())
  );
  const seenInBatch = new Set<string>();
  const duplicateNamesSet = new Set<string>();
  const validRows: ParsedGuestRowPreview[] = [];
  let skippedCount = 0;

  lines.forEach((line, idx) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (lines.length > 1) skippedCount++;
      return;
    }

    // Split by tab first (Excel/Google Sheets default), or semicolon/pipe, or comma if it looks like CSV
    let cells: string[];
    if (trimmedLine.includes('\t')) {
      cells = trimmedLine.split('\t');
    } else if (trimmedLine.includes('|')) {
      cells = trimmedLine.split('|');
    } else if (trimmedLine.includes(';')) {
      cells = trimmedLine.split(';');
    } else if (/^\d{1,4}\s*,\s*[^,]+/.test(trimmedLine)) {
      cells = trimmedLine.split(',');
    } else {
      cells = [trimmedLine];
    }

    const extracted = extractStudentFromCells(cells, idx);
    if (!extracted || !extracted.fullName) {
      skippedCount++;
      return;
    }

    const lowerName = extracted.fullName.toLowerCase();
    const isDuplicateInBatch = seenInBatch.has(lowerName);
    const isDuplicateWithExisting = existingNameSet.has(lowerName);

    if (isDuplicateInBatch || isDuplicateWithExisting) {
      duplicateNamesSet.add(extracted.fullName);
    }
    seenInBatch.add(lowerName);

    validRows.push({
      stt: existingStudents.length + validRows.length + 1,
      fullName: extracted.fullName,
      note: extracted.note,
      isDuplicateInBatch,
      isDuplicateWithExisting,
    });
  });

  return {
    validRows,
    skippedCount,
    duplicateNames: Array.from(duplicateNamesSet),
  };
}

/**
 * Parses an ArrayBuffer from an uploaded .xlsx, .xls, or .csv file completely client-side.
 */
export function parseExcelBufferToGuestRows(
  buffer: ArrayBuffer,
  existingStudents: GuestStudentItem[] = []
): ParseGuestRosterResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { validRows: [], skippedCount: 0, duplicateNames: [] };
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rawMatrix = XLSX.utils.sheet_to_json< unknown[] >(sheet, { header: 1, defval: '' });

  const existingNameSet = new Set(
    existingStudents.map(s => normalizeVietnameseName(s.fullName).toLowerCase())
  );
  const seenInBatch = new Set<string>();
  const duplicateNamesSet = new Set<string>();
  const validRows: ParsedGuestRowPreview[] = [];
  let skippedCount = 0;

  rawMatrix.forEach((row, idx) => {
    if (!Array.isArray(row)) {
      skippedCount++;
      return;
    }
    const cells = row.map(cell => String(cell ?? ''));
    const allEmpty = cells.every(c => !c.trim());
    if (allEmpty) {
      skippedCount++;
      return;
    }

    const extracted = extractStudentFromCells(cells, idx);
    if (!extracted || !extracted.fullName) {
      skippedCount++;
      return;
    }

    const lowerName = extracted.fullName.toLowerCase();
    const isDuplicateInBatch = seenInBatch.has(lowerName);
    const isDuplicateWithExisting = existingNameSet.has(lowerName);

    if (isDuplicateInBatch || isDuplicateWithExisting) {
      duplicateNamesSet.add(extracted.fullName);
    }
    seenInBatch.add(lowerName);

    validRows.push({
      stt: existingStudents.length + validRows.length + 1,
      fullName: extracted.fullName,
      note: extracted.note,
      isDuplicateInBatch,
      isDuplicateWithExisting,
    });
  });

  return {
    validRows,
    skippedCount,
    duplicateNames: Array.from(duplicateNamesSet),
  };
}

/**
 * Converts parsed rows into GuestStudentItem objects with unique guestStudentId.
 */
export function createGuestStudentItems(
  rows: { fullName: string; note?: string }[],
  startIndex: number = 0
): GuestStudentItem[] {
  return rows.map((r, idx) => ({
    guestStudentId: generateGuestId(`gst_${startIndex + idx + 1}`),
    stt: startIndex + idx + 1,
    fullName: normalizeVietnameseName(r.fullName),
    participating: true,
    note: r.note ? normalizeVietnameseName(r.note) : undefined,
  }));
}

/**
 * Re-indexes STT numbers 1..N after deletion or reordering while preserving guestStudentId.
 */
export function reindexGuestStudents(students: GuestStudentItem[]): GuestStudentItem[] {
  return students.map((s, idx) => ({
    ...s,
    stt: idx + 1,
  }));
}

/**
 * Returns duplicate names found within a list of GuestStudentItem (case-insensitive).
 */
export function findDuplicateNamesInRoster(students: GuestStudentItem[]): string[] {
  const counts = new Map<string, { count: number; display: string }>();
  for (const s of students) {
    const key = normalizeVietnameseName(s.fullName).toLowerCase();
    if (!key) continue;
    const prev = counts.get(key);
    if (prev) {
      prev.count += 1;
    } else {
      counts.set(key, { count: 1, display: s.fullName });
    }
  }
  const duplicates: string[] = [];
  counts.forEach(val => {
    if (val.count > 1) duplicates.push(val.display);
  });
  return duplicates;
}

export function createDefaultGuestSession(): GuestClassSession {
  if (isKhktDemoRuntime()) {
    return {
      guestSessionId: generateGuestId('demo_gsess'),
      className: 'Lớp 8A1 (Demo KHKT)',
      activityName: 'Trình diễn KHKT – Trò chơi tương tác 3D',
      note: 'Dữ liệu học sinh mẫu cục bộ cho bản demo KHKT',
      students: generateSampleVietnameseRoster(50),
      calledStudentIds: [],
      allowRepeat: false,
      shareAcrossGames: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    guestSessionId: generateGuestId('gsess'),
    className: 'Lớp 6A1 (Khách)',
    activityName: 'Hoạt động khởi động tiết học',
    note: '',
    students: [],
    calledStudentIds: [],
    allowRepeat: false,
    shareAcrossGames: true,
    updatedAt: new Date().toISOString(),
  };
}

export function loadGuestSession(): GuestClassSession {
  const storageKey = getGuestSessionStorageKey();
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GuestClassSession>;
        if (parsed && Array.isArray(parsed.students)) {
          return {
            guestSessionId: parsed.guestSessionId || generateGuestId('gsess'),
            className: parsed.className ?? (isKhktDemoRuntime() ? 'Lớp 8A1 (Demo KHKT)' : 'Lớp 6A1 (Khách)'),
            activityName: parsed.activityName ?? '',
            note: parsed.note ?? '',
            students: reindexGuestStudents(
              parsed.students.map((s, i) => ({
                guestStudentId: s.guestStudentId || generateGuestId(`gst_${i + 1}`),
                stt: i + 1,
                fullName: normalizeVietnameseName(s.fullName || ''),
                participating: s.participating !== false,
                note: s.note,
              })).filter(s => s.fullName.length > 0)
            ),
            calledStudentIds: Array.isArray(parsed.calledStudentIds) ? parsed.calledStudentIds : [],
            allowRepeat: Boolean(parsed.allowRepeat),
            shareAcrossGames: parsed.shareAcrossGames !== false,
            updatedAt: parsed.updatedAt || new Date().toISOString(),
          };
        }
      }
    } catch {
      // Fallback to memory
    }
  }
  if (!isKhktDemoRuntime() && memoryGuestSession) return memoryGuestSession;
  const fresh = createDefaultGuestSession();
  if (!isKhktDemoRuntime()) memoryGuestSession = fresh;
  return fresh;
}

export function saveGuestSession(session: GuestClassSession): boolean {
  const updated: GuestClassSession = {
    ...session,
    students: reindexGuestStudents(session.students),
    updatedAt: new Date().toISOString(),
  };
  if (!isKhktDemoRuntime()) memoryGuestSession = updated;
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(getGuestSessionStorageKey(), JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function loadGuestHistory(): GuestTurnHistoryItem[] {
  if (isLocalStorageAvailable()) {
    try {
      const raw = window.localStorage.getItem(getGuestHistoryStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
  }
  return isKhktDemoRuntime() ? [] : memoryGuestHistory;
}

export function appendGuestTurnHistory(item: Omit<GuestTurnHistoryItem, 'turnId' | 'timestamp'>): GuestTurnHistoryItem {
  const fullItem: GuestTurnHistoryItem = {
    ...item,
    turnId: generateGuestId('gturn'),
    timestamp: new Date().toISOString(),
  };
  const current = loadGuestHistory();
  const next = [fullItem, ...current].slice(0, 500);
  if (!isKhktDemoRuntime()) memoryGuestHistory = next;
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(getGuestHistoryStorageKey(), JSON.stringify(next));
    } catch {
      // fallback in memory
    }
  }
  return fullItem;
}

export function clearAllGuestData(): GuestClassSession {
  const fresh = createDefaultGuestSession();
  if (!isKhktDemoRuntime()) {
    memoryGuestSession = fresh;
    memoryGuestHistory = [];
  }
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.removeItem(getGuestSessionStorageKey());
      window.localStorage.removeItem(getGuestHistoryStorageKey());
    } catch {
      // ignore
    }
  }
  return fresh;
}

export function loadRosterModePreference(isLoggedInTeacher: boolean): 'guest' | 'teacher' {
  if (isKhktDemoRuntime()) {
    if (isLocalStorageAvailable()) {
      try {
        const saved = window.localStorage.getItem(getGuestModePrefStorageKey());
        if (saved === 'guest' || saved === 'teacher') return saved;
      } catch {
        // ignore
      }
    }
    return 'teacher';
  }
  if (!isLoggedInTeacher) return 'guest';
  if (isLocalStorageAvailable()) {
    try {
      const saved = window.localStorage.getItem(getGuestModePrefStorageKey());
      if (saved === 'guest' || saved === 'teacher') return saved;
    } catch {
      // ignore
    }
  }
  if (memoryModePref) return memoryModePref;
  return 'teacher';
}

export function saveRosterModePreference(mode: 'guest' | 'teacher'): void {
  if (!isKhktDemoRuntime()) memoryModePref = mode;
  if (isLocalStorageAvailable()) {
    try {
      window.localStorage.setItem(getGuestModePrefStorageKey(), mode);
    } catch {
      // ignore
    }
  }
}

export function buildGuestHistoryCsvContent(history: GuestTurnHistoryItem[]): string {
  const headers = ['STT', 'Thời gian', 'Lớp / Nhóm', 'Mã trò chơi', 'Tên trò chơi', 'Mã học sinh (Guest ID)', 'Họ và tên học sinh', 'Trạng thái'];
  const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const rows = history.map((h, idx) => [
    String(idx + 1),
    new Date(h.timestamp).toLocaleString('vi-VN'),
    h.className || 'Lớp Khách',
    h.gameCode,
    h.gameTitle,
    h.guestStudentId,
    h.studentName,
    h.status === 'CALLED' ? 'Đã gọi' : h.status === 'COMPLETED' ? 'Hoàn thành' : 'Bỏ qua',
  ].map(escapeCsv).join(','));

  // Add UTF-8 BOM for Vietnamese characters in Excel
  return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
}

/**
 * Generates sample Vietnamese THCS students for quick demo or testing (N students).
 */
export function generateSampleVietnameseRoster(count: number = 30): GuestStudentItem[] {
  const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
  const middleNames = ['Văn', 'Thị', 'Minh', 'Hoàng', 'Ngọc', 'Thanh', 'Quốc', 'Gia', 'Bảo', 'Đức', 'Phương', 'Thùy', 'Anh', 'Khánh', 'Hữu', 'Tuấn'];
  const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Hân', 'Hiếu', 'Hoàng', 'Hùng', 'Hương', 'Khang', 'Khánh', 'Khoa', 'Khôi', 'Linh', 'Long', 'Mai', 'Minh', 'My', 'Nam', 'Ngân', 'Ngọc', 'Nhân', 'Nhi', 'Nhung', 'Oanh', 'Phát', 'Phong', 'Phúc', 'Phương', 'Quân', 'Quang', 'Quỳnh', 'Sơn', 'Tâm', 'Tân', 'Thảo', 'Thắng', 'Thịnh', 'Thư', 'Thương', 'Tiến', 'Toàn', 'Trang', 'Trí', 'Trinh', 'Trung', 'Trúc', 'Tú', 'Tuấn', 'Tùng', 'Uyên', 'Vân', 'Việt', 'Vinh', 'Vy', 'Yến'];

  const rows: { fullName: string; note?: string }[] = [];
  for (let i = 0; i < count; i++) {
    const ln = lastNames[i % lastNames.length];
    const mn = middleNames[(i * 3) % middleNames.length];
    const fn = firstNames[(i * 7) % firstNames.length];
    rows.push({
      fullName: `${ln} ${mn} ${fn}`,
      note: `Tổ ${(i % 4) + 1}`,
    });
  }
  return createGuestStudentItems(rows, 0);
}

/**
 * Self-contained automated unit test suite for GuestRosterManager.
 */
export function runGuestRosterUnitTests(): { passed: number; failed: number; details: string[] } {
  let passed = 0;
  let failed = 0;
  const details: string[] = [];

  const assert = (condition: boolean, label: string) => {
    if (condition) {
      passed++;
    } else {
      failed++;
      details.push(`FAIL: ${label}`);
    }
  };

  // 1. Test 1-column direct text paste with blank lines and whitespace
  const sample1Col = `
    Nguyễn Văn An
    
    Trần Thị Bình   
    Lê Hoàng Cường
  `;
  const res1 = parseRawTextToGuestRows(sample1Col);
  assert(res1.validRows.length === 3, '1-column parse count === 3');
  assert(res1.validRows[0].fullName === 'Nguyễn Văn An', '1-column preserves Vietnamese diacritics');
  assert(res1.skippedCount >= 2, '1-column skips blank lines');

  // 2. Test 2-column & 3-column Excel TSV paste with header row
  const sampleExcelTsv = [
    'STT\tHọ và tên\tGhi chú',
    '1\tNguyễn Văn An\tTổ 1',
    '2\tTrần Thị Bình\tTổ 2',
    '3\tNguyễn Văn An\tTổ 3 (Trùng tên)',
    '\t\t',
    '4\tPhạm Minh Đức\tTổ 4',
  ].join('\n');
  const res2 = parseRawTextToGuestRows(sampleExcelTsv);
  assert(res2.validRows.length === 4, 'Excel TSV skips header & empty line, parses 4 students');
  assert(res2.validRows[0].fullName === 'Nguyễn Văn An' && res2.validRows[0].note === 'Tổ 1', 'Excel TSV extracts fullName and note');
  assert(res2.duplicateNames.includes('Nguyễn Văn An'), 'Excel TSV detects duplicate name Nguyễn Văn An without deleting');

  // 3. Test unique guestStudentId for duplicate names
  const itemsWithDup = createGuestStudentItems(res2.validRows);
  assert(itemsWithDup.length === 4, 'createGuestStudentItems keeps all 4 students including duplicate name');
  assert(
    itemsWithDup[0].guestStudentId !== itemsWithDup[2].guestStudentId,
    'Duplicate named students have distinct guestStudentId'
  );

  // 4. Test Excel .xlsx binary buffer parsing
  const ws = XLSX.utils.aoa_to_sheet([
    ['STT', 'Họ và tên', 'Ghi chú'],
    [1, 'Hoàng Gia Bảo', 'Lớp trưởng'],
    [2, 'Đặng Thùy Trâm', 'Lớp phó'],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach');
  const xlsxArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const resXlsx = parseExcelBufferToGuestRows(xlsxArray);
  assert(resXlsx.validRows.length === 2, 'XLSX buffer parser extracts 2 valid students and skips header');
  assert(resXlsx.validRows[0].fullName === 'Hoàng Gia Bảo', 'XLSX buffer parser reads Vietnamese name accurately');

  // 5. Test 1, 30, and 50 student rosters + anti-repeat by guestStudentId
  for (const size of [1, 30, 50]) {
    const roster = generateSampleVietnameseRoster(size);
    assert(roster.length === size, `Roster size ${size} generated accurately`);
    const idSet = new Set(roster.map(s => s.guestStudentId));
    assert(idSet.size === size, `Roster size ${size} has ${size} unique guestStudentId keys`);
  }

  return { passed, failed, details };
}
