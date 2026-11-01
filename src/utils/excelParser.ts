import * as XLSX from 'xlsx';
import { CognitiveLevel, QuestionType, QuestionStatus } from '../types';

export interface ParsedQuestionRow {
  code: string;
  grade: string;
  subject: string;
  textbook: string;
  chapter: string;
  lesson: string;
  lessonCode?: string;
  yccd: string;
  competency?: string;
  level: CognitiveLevel;
  type: QuestionType;
  stem: string;
  points: number;
  options?: { id: string; text: string }[];
  correctAnswer?: string;
  subItems?: { id: string; text: string; level: CognitiveLevel }[];
  subItemAnswers?: { id: string; isCorrect: boolean }[];
  sampleEssayAnswer?: string;
  rubric?: { text: string; max_points: number };
  explanation: string;
  status: QuestionStatus;
  sheetSource: string;
  rowNumber: number;
}

export interface ParseExcelResult {
  isMultiSheetFormat: boolean;
  lessonList: { code: string; topic: string; order: number; name: string }[];
  questions: ParsedQuestionRow[];
  errors: { sheet: string; row: number; field: string; message: string }[];
  duplicatesInFile: string[];
  counts: {
    singleChoice: number;
    trueFalse: number;
    essay: number;
    total: number;
  };
}

/**
 * Chuẩn hóa mức độ nhận thức từ text sang enum: know | understand | apply
 */
function normalizeCognitiveLevel(val: any): CognitiveLevel {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('nhận') || str.includes('biết') || str === 'know') return 'know';
  if (str.includes('thông') || str.includes('hiểu') || str === 'understand') return 'understand';
  if (str.includes('vận') || str.includes('dụng') || str === 'apply') return 'apply';
  return 'know';
}

/**
 * Chuẩn hóa trạng thái câu hỏi
 */
function normalizeStatus(val: any): QuestionStatus {
  const str = String(val || '').trim().toLowerCase();
  if (str.includes('duyệt') && !str.includes('chờ')) return 'approved';
  if (str.includes('chờ') || str === 'pending') return 'pending';
  if (str.includes('ngừng') || str === 'deprecated') return 'deprecated';
  return 'pending'; // Mặc định là Chờ duyệt theo quy định đề bài
}

/**
 * Tìm giá trị trong object dòng Excel bất kể tên cột có viết hoa/thường hay khoảng trắng
 */
function getRowVal(row: any, ...aliases: string[]): any {
  if (!row || typeof row !== 'object') return '';
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of keys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanAlias) {
        return row[key];
      }
    }
  }
  return '';
}

/**
 * Phân tích Workbook Excel theo cấu trúc chuẩn giáo dục THCS
 * Hỗ trợ cả định dạng đa sheet chuẩn:
 * - 01_Danh_muc_bai_hoc
 * - 02_Trac_nghiem_ABCD
 * - 03_Dung_Sai
 * - 04_Tu_luan
 * Và định dạng đơn sheet truyền thống
 */
export function parseExcelQuestionWorkbook(
  workbook: XLSX.WorkBook,
  defaultGrade: string = '6',
  defaultSubject: string = 'Tin học',
  defaultTextbook: string = 'Kết nối tri thức với cuộc sống'
): ParseExcelResult {
  const result: ParseExcelResult = {
    isMultiSheetFormat: false,
    lessonList: [],
    questions: [],
    errors: [],
    duplicatesInFile: [],
    counts: { singleChoice: 0, trueFalse: 0, essay: 0, total: 0 }
  };

  const sheetNames = workbook.SheetNames;
  const findSheet = (keywords: string[]) => {
    return sheetNames.find(name => {
      const lower = name.toLowerCase();
      return keywords.some(kw => lower.includes(kw.toLowerCase()));
    });
  };

  const sheet01 = findSheet(['01', 'danh_muc_bai_hoc', 'bai_hoc']);
  const sheet02 = findSheet(['02', 'trac_nghiem', 'abcd']);
  const sheet03 = findSheet(['03', 'dung_sai', 'true_false']);
  const sheet04 = findSheet(['04', 'tu_luan', 'essay']);

  const seenCodes = new Set<string>();

  // Kiểm tra nếu là cấu trúc đa sheet
  if (sheet02 || sheet03 || sheet04) {
    result.isMultiSheetFormat = true;

    // 1. Đọc Sheet 01: Danh mục bài học
    const lessonMap = new Map<string, { topic: string; name: string }>();
    if (sheet01 && workbook.Sheets[sheet01]) {
      const raw01 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet01]);
      raw01.forEach((row: any) => {
        const lessonCode = String(getRowVal(row, 'Mã bài', 'Ma_bai', 'Mã bài học') || '').trim();
        const topic = String(getRowVal(row, 'Chủ đề', 'Chu_de', 'Chương') || '').trim();
        const order = parseInt(getRowVal(row, 'STT bài', 'STT', 'Thứ tự') || '0', 10);
        const name = String(getRowVal(row, 'Tên bài học', 'Ten_bai', 'Tên bài') || '').trim();

        if (lessonCode) {
          lessonMap.set(lessonCode, { topic, name });
          result.lessonList.push({ code: lessonCode, topic, order, name });
        }
      });
    }

    // 2. Đọc Sheet 02: Trắc nghiệm ABCD
    if (sheet02 && workbook.Sheets[sheet02]) {
      const raw02 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet02]);
      raw02.forEach((row: any, idx: number) => {
        const rowNum = idx + 2;
        const code = String(getRowVal(row, 'Mã câu hỏi', 'Ma_cau_hoi', 'Mã câu') || '').trim();
        const lessonCode = String(getRowVal(row, 'Mã bài', 'Ma_bai') || '').trim();
        const lessonName = String(getRowVal(row, 'Tên bài', 'Ten_bai', 'Tên bài học') || '').trim();
        const levelStr = getRowVal(row, 'Mức độ', 'Muc_do');
        const stem = String(getRowVal(row, 'Nội dung câu hỏi', 'Noi_dung', 'Câu hỏi') || '').trim();
        const optA = String(getRowVal(row, 'Đáp án A', 'Phương án A', 'A') || '').trim();
        const optB = String(getRowVal(row, 'Đáp án B', 'Phương án B', 'B') || '').trim();
        const optC = String(getRowVal(row, 'Đáp án C', 'Phương án C', 'C') || '').trim();
        const optD = String(getRowVal(row, 'Đáp án D', 'Phương án D', 'D') || '').trim();
        const rawAns = String(getRowVal(row, 'Đáp án đúng', 'Đáp án', 'Dap_an') || '').trim().toUpperCase();
        const explanation = String(getRowVal(row, 'Giải thích đáp án', 'Lời giải', 'Hướng dẫn', 'Giai_thich') || '').trim();
        const points = parseFloat(getRowVal(row, 'Điểm', 'Diem') || '0.25') || 0.25;
        const status = normalizeStatus(getRowVal(row, 'Trạng thái', 'Trang_thai'));

        if (!code) {
          result.errors.push({ sheet: sheet02, row: rowNum, field: 'Mã câu hỏi', message: 'Mã câu hỏi bị trống.' });
          return;
        }

        if (seenCodes.has(code)) {
          result.duplicatesInFile.push(code);
          result.errors.push({ sheet: sheet02, row: rowNum, field: 'Mã câu hỏi', message: `Trùng mã câu hỏi "${code}" trong tệp.` });
          return;
        }
        seenCodes.add(code);

        if (!stem) {
          result.errors.push({ sheet: sheet02, row: rowNum, field: 'Nội dung câu hỏi', message: 'Nội dung câu hỏi bị trống.' });
        }
        if (!optA || !optB || !optC || !optD) {
          result.errors.push({ sheet: sheet02, row: rowNum, field: 'Phương án', message: 'Phải đủ 4 phương án A, B, C, D.' });
        }
        if (!['A', 'B', 'C', 'D'].includes(rawAns)) {
          result.errors.push({ sheet: sheet02, row: rowNum, field: 'Đáp án đúng', message: `Đáp án "${rawAns}" không hợp lệ (phải là A, B, C hoặc D).` });
        }

        const lessonInfo = lessonMap.get(lessonCode);
        const finalChapter = lessonInfo?.topic || 'Chủ đề chung';
        const finalLesson = lessonName || lessonInfo?.name || lessonCode || 'Bài 1';

        result.questions.push({
          code,
          grade: defaultGrade,
          subject: defaultSubject,
          textbook: defaultTextbook,
          chapter: finalChapter,
          lesson: finalLesson,
          lessonCode,
          yccd: '', // Yêu cầu cần đạt để trống theo yêu cầu đề bài
          level: normalizeCognitiveLevel(levelStr),
          type: 'single_choice',
          stem,
          points,
          options: [
            { id: 'A', text: optA },
            { id: 'B', text: optB },
            { id: 'C', text: optC },
            { id: 'D', text: optD }
          ],
          correctAnswer: rawAns,
          explanation,
          status,
          sheetSource: sheet02,
          rowNumber: rowNum
        });
        result.counts.singleChoice++;
      });
    }

    // 3. Đọc Sheet 03: Đúng - Sai nhiều ý (a, b, c, d)
    if (sheet03 && workbook.Sheets[sheet03]) {
      const raw03 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet03]);
      raw03.forEach((row: any, idx: number) => {
        const rowNum = idx + 2;
        const code = String(getRowVal(row, 'Mã câu hỏi', 'Ma_cau_hoi', 'Mã câu') || '').trim();
        const lessonCode = String(getRowVal(row, 'Mã bài', 'Ma_bai') || '').trim();
        const lessonName = String(getRowVal(row, 'Tên bài', 'Ten_bai') || '').trim();
        const stem = String(getRowVal(row, 'Nội dung câu dẫn', 'Nội dung câu hỏi', 'Noi_dung') || '').trim();

        const claimA = String(getRowVal(row, 'Nhận định a', 'Ý a', 'a') || '').trim();
        const ansA = String(getRowVal(row, 'Đáp án a', 'Dap_an_a') || '').trim().toLowerCase();
        const lvlA = normalizeCognitiveLevel(getRowVal(row, 'Mức độ a', 'Muc_do_a'));

        const claimB = String(getRowVal(row, 'Nhận định b', 'Ý b', 'b') || '').trim();
        const ansB = String(getRowVal(row, 'Đáp án b', 'Dap_an_b') || '').trim().toLowerCase();
        const lvlB = normalizeCognitiveLevel(getRowVal(row, 'Mức độ b', 'Muc_do_b'));

        const claimC = String(getRowVal(row, 'Nhận định c', 'Ý c', 'c') || '').trim();
        const ansC = String(getRowVal(row, 'Đáp án c', 'Dap_an_c') || '').trim().toLowerCase();
        const lvlC = normalizeCognitiveLevel(getRowVal(row, 'Mức độ c', 'Muc_do_c'));

        const claimD = String(getRowVal(row, 'Nhận định d', 'Ý d', 'd') || '').trim();
        const ansD = String(getRowVal(row, 'Đáp án d', 'Dap_an_d') || '').trim().toLowerCase();
        const lvlD = normalizeCognitiveLevel(getRowVal(row, 'Mức độ d', 'Muc_do_d'));

        const explanation = String(getRowVal(row, 'Giải thích / Hướng dẫn chấm', 'Giải thích', 'Hướng dẫn chấm', 'Lời giải') || '').trim();
        const points = parseFloat(getRowVal(row, 'Điểm tối đa', 'Điểm', 'Diem') || '1.0') || 1.0;
        const status = normalizeStatus(getRowVal(row, 'Trạng thái', 'Trang_thai'));

        if (!code) {
          result.errors.push({ sheet: sheet03, row: rowNum, field: 'Mã câu hỏi', message: 'Mã câu hỏi bị trống.' });
          return;
        }

        if (seenCodes.has(code)) {
          result.duplicatesInFile.push(code);
          result.errors.push({ sheet: sheet03, row: rowNum, field: 'Mã câu hỏi', message: `Trùng mã câu hỏi "${code}".` });
          return;
        }
        seenCodes.add(code);

        if (!stem) {
          result.errors.push({ sheet: sheet03, row: rowNum, field: 'Nội dung câu dẫn', message: 'Nội dung câu dẫn bị trống.' });
        }
        if (!claimA || !claimB || !claimC || !claimD) {
          result.errors.push({ sheet: sheet03, row: rowNum, field: 'Nhận định a-d', message: 'Phải đủ bốn nhận định a, b, c, d.' });
        }

        const parseBool = (str: string) => {
          return str.includes('đúng') || str === 'd' || str === 'true' || str === '1';
        };

        const lessonInfo = lessonMap.get(lessonCode);
        const finalChapter = lessonInfo?.topic || 'Chủ đề chung';
        const finalLesson = lessonName || lessonInfo?.name || lessonCode || 'Bài 1';

        result.questions.push({
          code,
          grade: defaultGrade,
          subject: defaultSubject,
          textbook: defaultTextbook,
          chapter: finalChapter,
          lesson: finalLesson,
          lessonCode,
          yccd: '',
          level: lvlA, // Mức độ câu cha tham chiếu ý đầu
          type: 'true_false_group',
          stem,
          points,
          subItems: [
            { id: 'a', text: claimA, level: lvlA },
            { id: 'b', text: claimB, level: lvlB },
            { id: 'c', text: claimC, level: lvlC },
            { id: 'd', text: claimD, level: lvlD }
          ],
          subItemAnswers: [
            { id: 'a', isCorrect: parseBool(ansA) },
            { id: 'b', isCorrect: parseBool(ansB) },
            { id: 'c', isCorrect: parseBool(ansC) },
            { id: 'd', isCorrect: parseBool(ansD) }
          ],
          explanation,
          status,
          sheetSource: sheet03,
          rowNumber: rowNum
        });
        result.counts.trueFalse++;
      });
    }

    // 4. Đọc Sheet 04: Tự luận
    if (sheet04 && workbook.Sheets[sheet04]) {
      const raw04 = XLSX.utils.sheet_to_json(workbook.Sheets[sheet04]);
      raw04.forEach((row: any, idx: number) => {
        const rowNum = idx + 2;
        const code = String(getRowVal(row, 'Mã câu hỏi', 'Ma_cau_hoi', 'Mã câu') || '').trim();
        const lessonCode = String(getRowVal(row, 'Mã bài', 'Ma_bai') || '').trim();
        const lessonName = String(getRowVal(row, 'Tên bài', 'Ten_bai') || '').trim();
        const levelStr = getRowVal(row, 'Mức độ', 'Muc_do');
        const stem = String(getRowVal(row, 'Nội dung câu hỏi', 'Noi_dung') || '').trim();
        const sampleAnswer = String(getRowVal(row, 'Đáp án mẫu', 'Dap_an_mau') || '').trim();
        const rubricText = String(getRowVal(row, 'Hướng dẫn chấm', 'Huong_dan_cham', 'Tiêu chuẩn chấm') || '').trim();
        const points = parseFloat(getRowVal(row, 'Điểm tối đa', 'Điểm', 'Diem') || '1.0') || 1.0;
        const competency = String(getRowVal(row, 'Năng lực Tin học', 'Năng lực', 'Nang_luc') || '').trim();
        const status = normalizeStatus(getRowVal(row, 'Trạng thái', 'Trang_thai'));

        if (!code) {
          result.errors.push({ sheet: sheet04, row: rowNum, field: 'Mã câu hỏi', message: 'Mã câu hỏi bị trống.' });
          return;
        }

        if (seenCodes.has(code)) {
          result.duplicatesInFile.push(code);
          result.errors.push({ sheet: sheet04, row: rowNum, field: 'Mã câu hỏi', message: `Trùng mã câu hỏi "${code}".` });
          return;
        }
        seenCodes.add(code);

        if (!stem) {
          result.errors.push({ sheet: sheet04, row: rowNum, field: 'Nội dung câu hỏi', message: 'Nội dung tự luận bị trống.' });
        }

        const lessonInfo = lessonMap.get(lessonCode);
        const finalChapter = lessonInfo?.topic || 'Chủ đề chung';
        const finalLesson = lessonName || lessonInfo?.name || lessonCode || 'Bài 1';

        result.questions.push({
          code,
          grade: defaultGrade,
          subject: defaultSubject,
          textbook: defaultTextbook,
          chapter: finalChapter,
          lesson: finalLesson,
          lessonCode,
          yccd: '',
          competency,
          level: normalizeCognitiveLevel(levelStr),
          type: 'essay',
          stem,
          points,
          sampleEssayAnswer: sampleAnswer,
          rubric: { text: rubricText, max_points: points },
          explanation: rubricText || sampleAnswer,
          status,
          sheetSource: sheet04,
          rowNumber: rowNum
        });
        result.counts.essay++;
      });
    }
  } else {
    // Định dạng 1 sheet đơn truyền thống
    const firstSheetName = sheetNames[0];
    const raw = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
    raw.forEach((row: any, idx: number) => {
      const rowNum = idx + 2;
      const code = String(getRowVal(row, 'Mã câu hỏi', 'Ma_cau_hoi', 'code') || '').trim();
      const stem = String(getRowVal(row, 'Nội dung câu hỏi', 'Noi_dung', 'stem') || '').trim();
      const ans = String(getRowVal(row, 'Đáp án', 'Dap_an', 'correct_answer') || '').trim();
      const levelStr = getRowVal(row, 'Mức độ', 'level');
      const typeStr = String(getRowVal(row, 'Dạng câu', 'type') || '').toLowerCase();
      const grade = String(getRowVal(row, 'Khối', 'grade') || defaultGrade);
      const points = parseFloat(getRowVal(row, 'Điểm', 'points') || '0.25') || 0.25;

      if (!code) {
        result.errors.push({ sheet: firstSheetName, row: rowNum, field: 'Mã câu hỏi', message: 'Thiếu mã câu hỏi định danh.' });
        return;
      }
      if (seenCodes.has(code)) {
        result.duplicatesInFile.push(code);
        result.errors.push({ sheet: firstSheetName, row: rowNum, field: 'Mã câu hỏi', message: `Trùng mã câu hỏi "${code}".` });
        return;
      }
      seenCodes.add(code);

      const isEssay = typeStr.includes('luận') || typeStr.includes('essay');
      const isTF = typeStr.includes('đúng') || typeStr.includes('sai') || typeStr.includes('true');

      let qType: QuestionType = 'single_choice';
      if (isEssay) qType = 'essay';
      else if (isTF) qType = 'true_false_group';

      result.questions.push({
        code,
        grade,
        subject: defaultSubject,
        textbook: defaultTextbook,
        chapter: String(getRowVal(row, 'Chương', 'Chủ đề') || 'Chương 1'),
        lesson: String(getRowVal(row, 'Bài', 'Bài học') || 'Bài 1'),
        yccd: String(getRowVal(row, 'Yêu cầu cần đạt', 'yccd') || ''),
        level: normalizeCognitiveLevel(levelStr),
        type: qType,
        stem,
        points,
        options: qType === 'single_choice' ? [
          { id: 'A', text: String(getRowVal(row, 'Phương án A', 'A') || '') },
          { id: 'B', text: String(getRowVal(row, 'Phương án B', 'B') || '') },
          { id: 'C', text: String(getRowVal(row, 'Phương án C', 'C') || '') },
          { id: 'D', text: String(getRowVal(row, 'Phương án D', 'D') || '') }
        ] : undefined,
        correctAnswer: ans,
        explanation: String(getRowVal(row, 'Lời giải chi tiết', 'Giải thích', 'explanation') || ''),
        status: 'pending',
        sheetSource: firstSheetName,
        rowNumber: rowNum
      });

      if (qType === 'single_choice') result.counts.singleChoice++;
      else if (qType === 'true_false_group') result.counts.trueFalse++;
      else result.counts.essay++;
    });
  }

  result.counts.total = result.questions.length;
  return result;
}
