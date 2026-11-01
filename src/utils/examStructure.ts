import { normalizeSubject } from '../components/teacher/QuestionBank';

export interface ExamStructureConfig {
  subjectKey: string;
  subjectName: string;
  singleChoiceCount: number; // Số câu trắc nghiệm ABCD (Phần I)
  singleChoicePoints: number; // Tổng điểm trắc nghiệm ABCD
  trueFalseCount: number; // Số câu đúng - sai 4 ý (Phần II)
  trueFalsePoints: number; // Tổng điểm đúng - sai
  essayCount: number; // Số câu tự luận / trả lời ngắn (Phần III)
  essayPoints: number; // Tổng điểm tự luận
  knowPercent: number; // % Nhận biết (chuẩn 40)
  understandPercent: number; // % Thông hiểu (chuẩn 30)
  applyPercent: number; // % Vận dụng (chuẩn 30)
  durationMinutes: number; // Thời gian làm bài (45 hoặc 90 phút)
}

/**
 * Cấu hình chuẩn ma trận & định dạng đề kiểm tra Giữa kỳ & Cuối kỳ GDPT 2018:
 * - Môn Toán: 16 câu ABCD, 2 câu Đúng-Sai, 4 câu Tự luận. (40-20-40). Biết 40 - Hiểu 30 - Vận dụng 30. (Tổng 22 câu = 10đ)
 * - Môn Tin học: 12 câu ABCD, 4 câu Đúng-Sai, 3 câu Tự luận. (30-40-30). Biết 40 - Hiểu 30 - Vận dụng 30. (Tổng 19 câu = 10đ)
 * - Các môn khác: cấu hình tương tự chuẩn GDPT 2018
 */
export const DEFAULT_EXAM_STRUCTURES: Record<string, ExamStructureConfig> = {
  toan: {
    subjectKey: 'toan',
    subjectName: 'Toán học',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0, // 40% (0.25đ/câu)
    trueFalseCount: 2,
    trueFalsePoints: 2.0, // 20% (1.0đ/câu: đúng 1=0.1, 2=0.25, 3=0.5, 4=1.0)
    essayCount: 4,
    essayPoints: 4.0, // 40% (1.0đ/câu)
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  tin_hoc: {
    subjectKey: 'tin_hoc',
    subjectName: 'Tin học',
    singleChoiceCount: 12,
    singleChoicePoints: 3.0, // 30% (0.25đ/câu)
    trueFalseCount: 4,
    trueFalsePoints: 4.0, // 40% (1.0đ/câu: đúng 1=0.1, 2=0.25, 3=0.5, 4=1.0)
    essayCount: 3,
    essayPoints: 3.0, // 30% (1.0đ/câu)
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  khtn: {
    subjectKey: 'khtn',
    subjectName: 'Khoa học tự nhiên',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 4,
    essayPoints: 4.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  lich_su_dia_li: {
    subjectKey: 'lich_su_dia_li',
    subjectName: 'Lịch sử và Địa lí',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 4,
    essayPoints: 4.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  cong_nghe: {
    subjectKey: 'cong_nghe',
    subjectName: 'Công nghệ',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 4,
    essayPoints: 4.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  gdcd: {
    subjectKey: 'gdcd',
    subjectName: 'Giáo dục công dân',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 4,
    essayPoints: 4.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  tieng_anh: {
    subjectKey: 'tieng_anh',
    subjectName: 'Tiếng Anh',
    singleChoiceCount: 20,
    singleChoicePoints: 5.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 3,
    essayPoints: 3.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  },
  ngu_van: {
    subjectKey: 'ngu_van',
    subjectName: 'Ngữ văn',
    singleChoiceCount: 8,
    singleChoicePoints: 2.0,
    trueFalseCount: 2,
    trueFalsePoints: 1.0,
    essayCount: 2,
    essayPoints: 7.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 90
  },
  default: {
    subjectKey: 'default',
    subjectName: 'Môn học khác',
    singleChoiceCount: 16,
    singleChoicePoints: 4.0,
    trueFalseCount: 2,
    trueFalsePoints: 2.0,
    essayCount: 4,
    essayPoints: 4.0,
    knowPercent: 40,
    understandPercent: 30,
    applyPercent: 30,
    durationMinutes: 45
  }
};

const STORAGE_PREFIX = 'taydo_exam_structure_';

/**
 * Lấy cấu hình cấu trúc đề thi của một môn học
 * Ưu tiên cấu hình tùy chỉnh do Giáo viên đã lưu trong LocalStorage
 */
export function getExamStructure(subject: string = 'toan'): ExamStructureConfig {
  const normKey = normalizeSubject(subject);
  const defaultCfg = DEFAULT_EXAM_STRUCTURES[normKey] || DEFAULT_EXAM_STRUCTURES.default;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${normKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultCfg,
          ...parsed,
          subjectKey: normKey
        };
      }
    } catch {
      // ignore
    }
  }

  return { ...defaultCfg };
}

/**
 * Lưu cấu hình cấu trúc đề thi tùy chỉnh do Giáo viên thiết lập
 */
export function saveExamStructure(subject: string, config: ExamStructureConfig): void {
  const normKey = normalizeSubject(subject);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${normKey}`, JSON.stringify(config));
    } catch (e) {
      console.warn('Lỗi lưu cấu hình đề thi:', e);
    }
  }
}

/**
 * Khôi phục cấu hình mặc định chuẩn Bộ Giáo dục & Đào tạo cho môn học
 */
export function resetExamStructure(subject: string): ExamStructureConfig {
  const normKey = normalizeSubject(subject);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${normKey}`);
    } catch {
      // ignore
    }
  }
  return DEFAULT_EXAM_STRUCTURES[normKey] || DEFAULT_EXAM_STRUCTURES.default;
}
