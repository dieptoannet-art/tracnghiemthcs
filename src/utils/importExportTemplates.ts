import * as XLSX from 'xlsx';
import { CANONICAL_SUBJECT_CATALOG, stripDiacriticsLower } from './subjectCatalog';

export type ExcelImportKind = 'students' | 'teachers' | 'assignments';

export interface ParsedStudentImportRow {
  rowNumber: number;
  studentCode: string;
  fullName: string;
}

export interface ParsedTeacherImportRow {
  rowNumber: number;
  teacherCode: string;
  fullName: string;
  email: string;
}

export interface ParsedAssignmentImportRow {
  rowNumber: number;
  schoolYear: string;
  teacherCode: string;
  subjectRaw: string;
  classCode: string;
}

function sanitizeFilenameSegment(val: string): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function findColumnValue(record: Record<string, any>, aliases: string[]): string {
  const normalizedMap = new Map<string, any>();
  for (const [k, v] of Object.entries(record)) {
    normalizedMap.set(stripDiacriticsLower(k), v);
  }
  for (const alias of aliases) {
    const val = normalizedMap.get(stripDiacriticsLower(alias));
    if (val !== undefined && val !== null) {
      return String(val).trim();
    }
  }
  return '';
}

function isRowCompletelyEmpty(record: Record<string, any>): boolean {
  return Object.values(record).every(v => String(v ?? '').trim() === '');
}

/**
 * 1. Tải mẫu Excel nhập học sinh vào lớp (Chuẩn 2 cột: Mã học sinh, Họ và tên — không cần email)
 */
export function downloadClassStudentsTemplate(className?: string, schoolYear?: string) {
  const cleanClassTag = sanitizeFilenameSegment(className || '9A1').toUpperCase() || '9A1';
  const sampleRows = [
    {
      'Mã học sinh': `HS${cleanClassTag}01`,
      'Họ và tên': 'Nguyễn Minh An'
    },
    {
      'Mã học sinh': `HS${cleanClassTag}02`,
      'Họ và tên': 'Trần Thảo Vy'
    }
  ];

  const guideRows = [
    {
      'Cột': 'Mã học sinh',
      'Bắt buộc': 'Có',
      'Ghi chú':
        'Mã định danh duy nhất của học sinh, đồng thời là Tên đăng nhập của học sinh (VD: HS9A101). Không cần nhập email học sinh.'
    },
    {
      'Cột': 'Họ và tên',
      'Bắt buộc': 'Có',
      'Ghi chú': 'Họ và tên đầy đủ có dấu của học sinh.'
    },
    {
      'Cột': 'Cơ chế tài khoản & mật khẩu',
      'Bắt buộc': 'Tự động',
      'Ghi chú':
        'Hệ thống tự tạo mật khẩu khởi tạo ngẫu nhiên cho học sinh mới (không gửi email). Tài khoản đã tồn tại được giữ nguyên mật khẩu và chỉ liên kết vào lớp.'
    }
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [{ wch: 22 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsData, 'Danh_Sach_Hoc_Sinh');

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 76 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_Dan');

  const clsPart = sanitizeFilenameSegment(className || 'Lop');
  const yearPart = sanitizeFilenameSegment(schoolYear || '2026_2027');
  XLSX.writeFile(wb, `Mau_Nhap_Hoc_Sinh_${clsPart}_${yearPart}.xlsx`);
}

/**
 * 2. Tải mẫu Excel nhập danh sách giáo viên (Mã giáo viên, Họ và tên, Email đăng nhập)
 */
export function downloadTeachersTemplate() {
  const sampleRows = [
    {
      'Mã giáo viên': 'GV001',
      'Họ và tên': 'Nguyễn Văn Hùng',
      'Email đăng nhập': 'hung.toan@taydo.edu.vn'
    },
    {
      'Mã giáo viên': 'GV002',
      'Họ và tên': 'Lê Thị Mai',
      'Email đăng nhập': 'mai.tin@taydo.edu.vn'
    }
  ];

  const guideRows = [
    {
      'Cột': 'Mã giáo viên',
      'Bắt buộc': 'Có',
      'Ghi chú': 'Mã giáo viên duy nhất dùng cho phân công giảng dạy (VD: GV001).'
    },
    {
      'Cột': 'Họ và tên',
      'Bắt buộc': 'Có',
      'Ghi chú': 'Họ và tên đầy đủ của giáo viên.'
    },
    {
      'Cột': 'Email đăng nhập',
      'Bắt buộc': 'Có',
      'Ghi chú': 'Email dùng để gửi lời mời kích hoạt hoặc liên kết tài khoản giáo viên hiện có.'
    }
  ];

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsData, 'Danh_Sach_Giao_Vien');

  const wsGuide = XLSX.utils.json_to_sheet(guideRows);
  wsGuide['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 64 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_Dan');

  XLSX.writeFile(wb, 'Mau_Nhap_Danh_Sach_Giao_Vien_THCS_Tay_Do.xlsx');
}

/**
 * 3. Tải mẫu Excel phân công giảng dạy (Năm học, Mã giáo viên, Môn, Mã lớp)
 */
export function downloadTeachingAssignmentsTemplate(sampleSchoolYear = '2025-2026') {
  const sampleRows = [
    {
      'Năm học': sampleSchoolYear,
      'Mã giáo viên': 'GV001',
      'Môn': 'Toán',
      'Mã lớp': '8A1'
    },
    {
      'Năm học': sampleSchoolYear,
      'Mã giáo viên': 'GV001',
      'Môn': 'Toán',
      'Mã lớp': '8A2'
    },
    {
      'Năm học': sampleSchoolYear,
      'Mã giáo viên': 'GV002',
      'Môn': 'Tin học',
      'Mã lớp': '8A1'
    }
  ];

  const subjectGuide = CANONICAL_SUBJECT_CATALOG.map(s => ({
    'Tên môn chuẩn': s.name,
    'Mã môn': s.shortCode,
    'Ghi chú': `Có thể nhập "${s.name}" hoặc "${s.shortCode}"`
  }));

  const wb = XLSX.utils.book_new();
  const wsData = XLSX.utils.json_to_sheet(sampleRows);
  wsData['!cols'] = [{ wch: 16 }, { wch: 18 }, { wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsData, 'Phan_Cong_Giang_Day');

  const wsSubjects = XLSX.utils.json_to_sheet(subjectGuide);
  wsSubjects['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, wsSubjects, 'Danh_Muc_Mon');

  XLSX.writeFile(wb, 'Mau_Phan_Cong_Giang_Day_THCS_Tay_Do.xlsx');
}

/**
 * Đọc file Excel (.xlsx / .xls) hoặc CSV (.csv UTF-8) thành danh sách bản ghi theo loại
 */
export async function parseExcelImportFile(
  file: File,
  kind: ExcelImportKind
): Promise<{
  rows: ParsedStudentImportRow[] | ParsedTeacherImportRow[] | ParsedAssignmentImportRow[];
  sheetName: string;
}> {
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
  let workbook: XLSX.WorkBook;
  if (isCsv) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array', codepage: 65001 });
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Tệp tải lên không chứa trang tính (sheet) hoặc dữ liệu hợp lệ.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    defval: '',
    raw: false
  });

  if (kind === 'students') {
    const rows: ParsedStudentImportRow[] = [];
    rawObjects.forEach((raw, idx) => {
      if (isRowCompletelyEmpty(raw)) return;
      rows.push({
        rowNumber: idx + 2,
        studentCode: findColumnValue(raw, [
          'Mã học sinh',
          'Ma hoc sinh',
          'Mã HS',
          'Ma HS',
          'student_code',
          'Ma_HS'
        ]),
        fullName: findColumnValue(raw, [
          'Họ và tên',
          'Ho va ten',
          'Họ tên',
          'Ho ten',
          'Tên học sinh',
          'Ten hoc sinh',
          'full_name'
        ])
      });
    });
    return { rows, sheetName };
  }

  if (kind === 'teachers') {
    const rows: ParsedTeacherImportRow[] = [];
    rawObjects.forEach((raw, idx) => {
      if (isRowCompletelyEmpty(raw)) return;
      rows.push({
        rowNumber: idx + 2,
        teacherCode: findColumnValue(raw, ['Mã giáo viên', 'Ma giao vien', 'teacher_code', 'Ma_GV']),
        fullName: findColumnValue(raw, ['Họ và tên', 'Ho va ten', 'Họ tên', 'full_name']),
        email: findColumnValue(raw, ['Email đăng nhập', 'Email dang nhap', 'Email', 'email'])
      });
    });
    return { rows, sheetName };
  }

  const rows: ParsedAssignmentImportRow[] = [];
  rawObjects.forEach((raw, idx) => {
    if (isRowCompletelyEmpty(raw)) return;
    rows.push({
      rowNumber: idx + 2,
      schoolYear: findColumnValue(raw, ['Năm học', 'Nam hoc', 'school_year']),
      teacherCode: findColumnValue(raw, ['Mã giáo viên', 'Ma giao vien', 'teacher_code', 'Ma_GV']),
      subjectRaw: findColumnValue(raw, ['Môn', 'Mon', 'Môn học', 'Mon hoc', 'subject']),
      classCode: findColumnValue(raw, ['Mã lớp', 'Ma lop', 'Lớp', 'class_code'])
    });
  });
  return { rows, sheetName };
}

export interface ImportReportRow {
  rowNumber: number;
  statusLabel: string;
  message: string;
  columns: Record<string, string>;
}

/**
 * Tải xuống file Excel báo cáo kết quả nhập từng dòng (KHÔNG lưu mật khẩu trong file báo cáo trạng thái)
 */
export function downloadImportResultReport(kind: ExcelImportKind, rows: ImportReportRow[]) {
  const sheetRows = rows.map(r => ({
    'Dòng': r.rowNumber,
    ...r.columns,
    'Kết quả': r.statusLabel,
    'Chi tiết': r.message
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Ket_Qua_Nhap');

  const prefix =
    kind === 'students'
      ? 'Ket_Qua_Nhap_Hoc_Sinh'
      : kind === 'teachers'
      ? 'Ket_Qua_Nhap_Giao_Vien'
      : 'Ket_Qua_Nhap_Phan_Cong';
  const datePart = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${prefix}_${datePart}.xlsx`);
}

export interface StudentInitialCredentialItem {
  studentCode: string;
  fullName: string;
  initialPassword: string;
}

/**
 * Tải xuống Phiếu thông tin đăng nhập khởi tạo (chỉ dành cho Quản trị viên trong phiên vừa tạo tài khoản mới)
 */
export function downloadStudentInitialCredentialsSheet(
  className: string,
  schoolYear: string,
  items: StudentInitialCredentialItem[]
) {
  if (!items || items.length === 0) return;

  const sheetRows = items.map((item, index) => ({
    'STT': index + 1,
    'Lớp': className,
    'Năm học': schoolYear,
    'Tên đăng nhập (Mã học sinh)': item.studentCode,
    'Họ và tên': item.fullName,
    'Mật khẩu khởi tạo': item.initialPassword,
    'Lưu ý bảo mật': 'Học sinh đăng nhập bằng Mã học sinh và bắt buộc đổi mật khẩu ngay lần đầu.'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 12 },
    { wch: 14 },
    { wch: 26 },
    { wch: 28 },
    { wch: 20 },
    { wch: 56 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Thong_Tin_Dang_Nhap_Khoi_Tao');

  const clsPart = sanitizeFilenameSegment(className || 'Lop');
  const yearPart = sanitizeFilenameSegment(schoolYear || '2026_2027');
  XLSX.writeFile(wb, `Phieu_Mat_Khau_Khoi_Tao_${clsPart}_${yearPart}.xlsx`);
}

