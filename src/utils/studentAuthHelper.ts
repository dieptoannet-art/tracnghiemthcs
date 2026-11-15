/**
 * Bộ hàm tiện ích chuẩn hóa Mã học sinh và định danh kỹ thuật nội bộ Supabase Auth
 *
 * Nguyên tắc bảo mật & kiến trúc:
 * 1. Học sinh đăng nhập bằng Mã học sinh (student_code) và mật khẩu.
 * 2. Supabase Auth yêu cầu định dạng email cho xác thực mật khẩu, do đó hệ thống
 *    ánh xạ 1-1 ổn định từ Mã học sinh đã chuẩn hóa sang một định danh kỹ thuật
 *    thuộc namespace nội bộ (mặc định: @student-auth.taydo.internal).
 * 3. Định danh kỹ thuật này KHÔNG phải email thực của học sinh, KHÔNG nhận/gửi thư
 *    và KHÔNG hiển thị như email cá nhân trên giao diện người dùng.
 */

export const DEFAULT_STUDENT_INTERNAL_DOMAIN = 'student-auth.taydo.internal';

const INTERNAL_DOMAIN_SUFFIXES = [
  '@student-auth.taydo.internal',
  '@hs-auth.taydo.internal',
  '@taydo.internal',
  '@hs-internal.taydo.edu.vn'
];

/**
 * Chuẩn hóa Mã học sinh: cắt khoảng trắng thừa, viết hoa đồng nhất.
 */
export function normalizeStudentCode(raw?: string | null): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

/**
 * Kiểm tra định dạng Mã học sinh hợp lệ (2–32 ký tự, chữ cái ASCII, chữ số, dấu chấm/gạch ngang/gạch dưới).
 */
export function isValidStudentCode(raw?: string | null): boolean {
  const code = normalizeStudentCode(raw);
  if (!code || code.length < 2 || code.length > 32) {
    return false;
  }
  return /^[A-Z0-9._-]+$/.test(code);
}

/**
 * Chuẩn hóa phần domain nội bộ dùng cho định danh Auth học sinh.
 */
export function normalizeInternalAuthDomain(rawDomain?: string | null): string {
  const cleaned = String(rawDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '');
  if (!cleaned || !/^[a-z0-9.-]+\.[a-z]{2,63}$/.test(cleaned)) {
    return DEFAULT_STUDENT_INTERNAL_DOMAIN;
  }
  return cleaned;
}

/**
 * Sinh định danh email kỹ thuật nội bộ duy nhất và ổn định từ Mã học sinh đã chuẩn hóa.
 * Ví dụ: "HS9A101" -> "hs.hs9a101@student-auth.taydo.internal"
 */
export function buildStudentInternalAuthEmail(
  studentCode: string,
  customDomain?: string | null
): string {
  const cleanCode = normalizeStudentCode(studentCode);
  if (!cleanCode) {
    throw new Error('Mã học sinh không được để trống khi tạo định danh nội bộ.');
  }
  const safeLocalPart = cleanCode.toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (!safeLocalPart) {
    throw new Error(`Mã học sinh "${studentCode}" không thể chuẩn hóa sang định danh nội bộ.`);
  }
  const domain = normalizeInternalAuthDomain(customDomain);
  return `hs.${safeLocalPart}@${domain}`;
}

/**
 * Kiểm tra xem một chuỗi email có phải là định danh kỹ thuật nội bộ của học sinh hay không.
 */
export function isStudentInternalAuthEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = String(email).trim().toLowerCase();
  if (!lower) return false;
  if (lower.endsWith('.internal')) return true;
  for (const suffix of INTERNAL_DOMAIN_SUFFIXES) {
    if (lower.endsWith(suffix)) return true;
  }
  return false;
}

/**
 * Định dạng thông tin định danh đăng nhập để hiển thị trên giao diện (ẩn email kỹ thuật nội bộ).
 */
export function formatAccountLoginDisplay(
  email?: string | null,
  studentCode?: string | null,
  role?: string | null
): string {
  const cleanCode = normalizeStudentCode(studentCode);
  if (isStudentInternalAuthEmail(email)) {
    return cleanCode ? `Mã HS: ${cleanCode}` : 'Đăng nhập bằng Mã HS';
  }
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail && role === 'student') {
    return cleanCode ? `Mã HS: ${cleanCode}` : 'Đăng nhập bằng Mã HS';
  }
  return cleanEmail || (cleanCode ? `Mã HS: ${cleanCode}` : '—');
}
