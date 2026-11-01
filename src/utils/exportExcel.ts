import * as XLSX from 'xlsx';
import { Question, Submission, ClassRoom } from '../types';

/**
 * Xuất file Excel bảng điểm học sinh của một bài kiểm tra
 */
export function exportGradeSheetToExcel(
  examTitle: string,
  className: string,
  submissions: Submission[]
) {
  const data = submissions.map((sub, index) => ({
    'STT': index + 1,
    'Mã học sinh': sub.studentId,
    'Họ và tên': sub.studentName,
    'Lớp': sub.studentClass,
    'Điểm số': sub.score.toFixed(2),
    'Điểm tối đa': sub.maxScore,
    'Thời gian nộp': sub.submittedAt,
    'Thời lượng (phút)': Math.round(sub.timeSpentSeconds / 60),
    'Số lần rời tab': sub.tabSwitchCount,
    'Trạng thái': sub.status === 'graded' ? 'Đã chấm' : 'Đã nộp'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bảng điểm');

  // Đặt tên file
  const filename = `Bang_Diem_${className}_${examTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

/**
 * Tải file Excel mẫu để giáo viên nhập câu hỏi
 */
export function downloadQuestionImportTemplate() {
  const templateRows = [
    {
      'Mã câu hỏi': 'TOAN8-GK1-01',
      'Khối': '8',
      'Môn': 'Toán',
      'Bộ sách': 'Kết nối tri thức',
      'Chương': 'Chương 1: Đa thức',
      'Bài': 'Bài 1: Đơn thức và đa thức nhiều biến',
      'Dạng câu': 'Trắc nghiệm', // Trắc nghiệm | Đúng - Sai | Trả lời ngắn | Tự luận
      'Mức độ': 'Biết', // Biết | Hiểu | Vận dụng
      'Yêu cầu cần đạt': 'Nhận biết được đơn thức thu gọn',
      'Nội dung câu hỏi': 'Biểu thức nào sau đây là đơn thức?',
      'Phương án A': '2x^2*y',
      'Phương án B': 'x + 2y',
      'Phương án C': '3x/y',
      'Phương án D': '2x - 1',
      'Đáp án': 'A',
      'Điểm': 0.25,
      'Lời giải chi tiết': 'Đơn thức chỉ chứa tích giữa các số và biến số mũ nguyên dương.'
    },
    {
      'Mã câu hỏi': 'TOAN8-GK1-02',
      'Khối': '8',
      'Môn': 'Toán',
      'Bộ sách': 'Kết nối tri thức',
      'Chương': 'Chương 1: Đa thức',
      'Bài': 'Bài 3: Hằng đẳng thức',
      'Dạng câu': 'Trả lời ngắn',
      'Mức độ': 'Hiểu',
      'Yêu cầu cần đạt': 'Tìm nghiệm đơn giản',
      'Nội dung câu hỏi': 'Tìm giá trị dương của x biết x^2 = 25',
      'Phương án A': '',
      'Phương án B': '',
      'Phương án C': '',
      'Phương án D': '',
      'Đáp án': '5',
      'Điểm': 0.5,
      'Lời giải chi tiết': 'x^2 = 25 suy ra x = 5 hoặc x = -5. Do x dương nên x = 5.'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mau_Nhap_Cau_Hoi');
  XLSX.writeFile(workbook, 'Mau_Nhap_Cau_Hoi_THCS_Tay_Do.xlsx');
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
}

export interface ImportValidationResult {
  validQuestions: Partial<Question>[];
  errors: ImportError[];
}

/**
 * Kiểm tra xác thực file nhập câu hỏi (mô phỏng hoặc thực tế từ ArrayBuffer)
 */
export function validateQuestionRows(rawRows: any[]): ImportValidationResult {
  const errors: ImportError[] = [];
  const validQuestions: Partial<Question>[] = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // Tính dòng từ dòng 2 (dòng 1 là tiêu đề)

    const code = row['Mã câu hỏi'] || row['Ma_cau_hoi'];
    const stem = row['Nội dung câu hỏi'] || row['Noi_dung'];
    const answer = row['Đáp án'] || row['Dap_an'];
    const levelStr = row['Mức độ'] || row['Muc_do'];
    const typeStr = row['Dạng câu'] || row['Dang_cau'];
    const grade = row['Khối'] || row['Khoi'];

    if (!code) {
      errors.push({ row: rowNum, field: 'Mã câu hỏi', message: 'Thiếu mã câu hỏi định danh.' });
    } else if (seenCodes.has(code)) {
      errors.push({ row: rowNum, field: 'Mã câu hỏi', message: `Trùng mã câu hỏi "${code}".` });
    } else {
      seenCodes.add(code);
    }

    if (!stem || String(stem).trim().length < 5) {
      errors.push({ row: rowNum, field: 'Nội dung', message: 'Nội dung câu hỏi quá ngắn hoặc bị trống.' });
    }

    if (!answer && typeStr !== 'Tự luận') {
      errors.push({ row: rowNum, field: 'Đáp án', message: 'Thiếu đáp án cho câu hỏi trắc nghiệm/ngắn.' });
    }

    if (levelStr && !['Biết', 'Hiểu', 'Vận dụng', 'know', 'understand', 'apply'].includes(levelStr)) {
      errors.push({ row: rowNum, field: 'Mức độ', message: `Mức độ "${levelStr}" không hợp lệ (chỉ chấp nhận Biết / Hiểu / Vận dụng).` });
    }

    if (errors.filter(e => e.row === rowNum).length === 0) {
      validQuestions.push({
        code: String(code),
        stem: String(stem),
        grade: (['6', '7', '8', '9'].includes(String(grade)) ? String(grade) : '8') as any,
        points: parseFloat(row['Điểm']) || 0.25,
        explanation: row['Lời giải chi tiết'] || '',
        yccd: row['Yêu cầu cần đạt'] || 'Chuẩn kiến thức GDPT 2018',
        chapter: row['Chương'] || 'Chương tổng quát',
        lesson: row['Bài'] || 'Bài học thực tế',
        status: 'pending',
        type: (typeStr?.includes('Đúng') ? 'true_false_group' : typeStr?.includes('ngắn') ? 'short_answer' : typeStr?.includes('luận') ? 'essay' : 'single_choice') as any,
        level: (levelStr?.includes('Hiểu') ? 'understand' : levelStr?.includes('Vận') ? 'apply' : 'know') as any
      });
    }
  });

  return { validQuestions, errors };
}
