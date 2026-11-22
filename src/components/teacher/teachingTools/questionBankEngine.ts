import * as XLSX from 'xlsx';
import { CognitiveLevel, Grade, Question } from '../../../types';
import { KHKT_DEMO_STORAGE_PREFIX, isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export type ToolQuestionType = 'mcq' | 'true_false' | 'short_answer';
export type ShortAnswerGradingRule =
  | 'manual_only'
  | 'exact_trimmed'
  | 'case_insensitive'
  | 'numeric_tolerance';

export interface ToolMcqOption {
  id: string;
  text: string;
}

export interface ToolTfStatement {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

export interface ToolQuestionItem {
  id: string;
  code: string;
  grade: Grade;
  subject: string;
  lesson: string;
  level: CognitiveLevel;
  type: ToolQuestionType;
  stem: string;
  imageDataUrl?: string;
  explanation: string;
  // MCQ: answer MUST track option.id so option reordering preserves answer
  options?: ToolMcqOption[];
  correctOptionId?: string;
  // True/False: each statement has its own boolean
  statements?: ToolTfStatement[];
  // Short Answer: reference + grading rule
  referenceAnswer?: string;
  acceptedAnswers?: string[];
  shortAnswerRule?: ShortAnswerGradingRule;
  numericTolerance?: number;
  requiresManualReviewNote?: string;
}

export interface ToolQuestionSet {
  id: string;
  title: string;
  grade: Grade;
  subject: string;
  lesson: string;
  description: string;
  createdAtIso: string;
  updatedAtIso: string;
  questions: ToolQuestionItem[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  sectionLabel: string;
  code: string;
  grade: Grade;
  subject: string;
  lesson: string;
  level: CognitiveLevel;
  type: ToolQuestionType;
  stem: string;
  options: ToolMcqOption[];
  correctOptionLetter: 'A' | 'B' | 'C' | 'D' | '';
  statements: ToolTfStatement[];
  referenceAnswer: string;
  shortAnswerRule: ShortAnswerGradingRule;
  explanation: string;
  errors: string[];
}

export interface PdfPageTextInput {
  pageNumber: number;
  text: string;
  isImageOnly?: boolean;
}

export interface PdfAndKeyParseResult {
  rows: ImportPreviewRow[];
  imageOnlyPages: number[];
  missingAnswerCodes: string[];
  duplicateCodes: string[];
  orphanAnswerCodes: string[];
  warnings: string[];
}

// ============================================================================
// VIETNAMESE ACCENT-INSENSITIVE NORMALIZATION & SEARCH
// ============================================================================
export function stripVietnameseAccents(input: string): string {
  return String(input || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSubjectLabel(raw: string): string {
  const norm = stripVietnameseAccents(raw);
  if (norm === 'math' || norm.startsWith('toan')) return 'Toán';
  if (norm === 'informatics' || norm.startsWith('tin')) return 'Tin học';
  if (norm === 'literature' || norm.includes('ngu van') || norm === 'van') return 'Ngữ văn';
  if (norm === 'english' || norm.includes('tieng anh')) return 'Tiếng Anh';
  if (norm === 'science' || norm.includes('khtn') || norm.includes('khoa hoc')) return 'KHTN';
  if (norm === 'history_geo' || norm.includes('lich su')) return 'Lịch sử & Địa lí';
  if (norm === 'technology' || norm.includes('cong nghe')) return 'Công nghệ';
  if (norm === 'civics' || norm.includes('gdcd')) return 'GDCD';
  return raw.trim() || 'Toán';
}

export function filterToolQuestions(params: {
  questions: ToolQuestionItem[];
  query?: string;
  grade?: string;
  subject?: string;
  lesson?: string;
  level?: string;
  type?: string;
}): ToolQuestionItem[] {
  const {
    questions,
    query = '',
    grade = 'all',
    subject = 'all',
    lesson = 'all',
    level = 'all',
    type = 'all',
  } = params;

  const cleanQuery = stripVietnameseAccents(query);
  const cleanSubj = subject !== 'all' ? stripVietnameseAccents(normalizeSubjectLabel(subject)) : 'all';
  const cleanLesson = lesson !== 'all' ? stripVietnameseAccents(lesson) : 'all';

  return questions.filter((q) => {
    if (grade !== 'all' && String(q.grade) !== String(grade)) return false;
    if (cleanSubj !== 'all' && stripVietnameseAccents(normalizeSubjectLabel(q.subject)) !== cleanSubj) {
      return false;
    }
    if (cleanLesson !== 'all' && stripVietnameseAccents(q.lesson) !== cleanLesson) return false;
    if (level !== 'all' && q.level !== level) return false;
    if (type !== 'all' && q.type !== type) return false;

    if (cleanQuery) {
      const haystack = stripVietnameseAccents(
        [
          q.code,
          q.stem,
          q.subject,
          q.lesson,
          q.explanation,
          ...(q.options?.map((o) => o.text) || []),
          ...(q.statements?.map((s) => s.text) || []),
          q.referenceAnswer || '',
        ].join(' ')
      );
      if (!haystack.includes(cleanQuery)) return false;
    }
    return true;
  });
}

// ============================================================================
// QUESTION CREATION, OPTION REORDERING & ANSWER GRADING
// ============================================================================
export function makeStableId(prefix = 'tq'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Reorders an MCQ option up or down while strictly preserving `correctOptionId`!
 * Never stores answer as display index or 'A'/'B'/'C'/'D' letter.
 */
export function reorderMcqOption(
  question: ToolQuestionItem,
  optionId: string,
  direction: 'up' | 'down'
): ToolQuestionItem {
  if (question.type !== 'mcq' || !question.options) return question;
  const idx = question.options.findIndex((o) => o.id === optionId);
  if (idx < 0) return question;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= question.options.length) return question;

  const nextOptions = question.options.slice();
  const tmp = nextOptions[idx];
  nextOptions[idx] = nextOptions[swapIdx];
  nextOptions[swapIdx] = tmp;

  return {
    ...question,
    options: nextOptions,
    correctOptionId: question.correctOptionId, // Remains pinned to stable option.id
  };
}

export function isMcqSelectionCorrect(
  question: ToolQuestionItem,
  selectedOptionId: string
): boolean {
  if (question.type !== 'mcq' || !question.correctOptionId) return false;
  return question.correctOptionId === selectedOptionId;
}

export function getMcqDisplayLabelForCorrectOption(question: ToolQuestionItem): string {
  if (question.type !== 'mcq' || !question.options || !question.correctOptionId) return '—';
  const idx = question.options.findIndex((o) => o.id === question.correctOptionId);
  if (idx < 0) return '—';
  return String.fromCharCode(65 + idx);
}

/**
 * Evaluates a short-answer submission strictly according to the teacher-selected rule.
 * If rule is `manual_only` or expression contains units / formatting requiring judgment,
 * returns `needs_manual` so the teacher explicitly marks Đúng / Sai.
 */
export function evaluateShortAnswerSubmission(
  question: ToolQuestionItem,
  submittedRaw: string
): {
  outcome: 'correct' | 'wrong' | 'needs_manual';
  reason: string;
} {
  const rule: ShortAnswerGradingRule = question.shortAnswerRule || 'manual_only';
  const submitted = (submittedRaw || '').trim();
  const refs = [
    question.referenceAnswer || '',
    ...(question.acceptedAnswers || []),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  if (rule === 'manual_only' || refs.length === 0) {
    return {
      outcome: 'needs_manual',
      reason: 'Giáo viên kiểm tra đơn vị, cách viết tương đương và chấm trực tiếp.',
    };
  }

  if (!submitted) {
    return { outcome: 'wrong', reason: 'Chưa có câu trả lời.' };
  }

  if (rule === 'exact_trimmed') {
    const matched = refs.some((r) => r === submitted);
    return matched
      ? { outcome: 'correct', reason: 'Khớp chính xác chuỗi đáp án chuẩn.' }
      : {
          outcome: 'needs_manual',
          reason: 'Không khớp chính xác từng ký tự — giáo viên kiểm tra cách viết tương đương.',
        };
  }

  if (rule === 'case_insensitive') {
    const normSub = stripVietnameseAccents(submitted);
    const matched = refs.some((r) => stripVietnameseAccents(r) === normSub);
    return matched
      ? { outcome: 'correct', reason: 'Khớp đáp án không phân biệt hoa/thường.' }
      : {
          outcome: 'needs_manual',
          reason: 'Chưa khớp mẫu văn bản — giáo viên kiểm tra thêm đơn vị hoặc cách diễn đạt.',
        };
  }

  // numeric_tolerance
  const numSub = Number(submitted.replace(/,/g, '.'));
  const hasUnitsOrWords = /[a-zA-Z\u00C0-\u024F/%]/.test(submitted);
  if (!Number.isFinite(numSub) || hasUnitsOrWords) {
    return {
      outcome: 'needs_manual',
      reason: 'Câu trả lời có chứa đơn vị hoặc ký hiệu chữ — giáo viên quyết định kết quả.',
    };
  }
  const tol = Math.max(0, Number(question.numericTolerance ?? 0.01));
  for (const r of refs) {
    const numRef = Number(r.replace(/,/g, '.'));
    if (Number.isFinite(numRef) && Math.abs(numSub - numRef) <= tol) {
      return {
        outcome: 'correct',
        reason: `Đáp án số nằm trong sai số ±${tol}.`,
      };
    }
  }
  return { outcome: 'wrong', reason: `Giá trị số lệch ngoài sai số ±${tol}.` };
}

export function duplicateToolQuestion(q: ToolQuestionItem): ToolQuestionItem {
  const newId = makeStableId('tq');
  let newOptions: ToolMcqOption[] | undefined;
  let newCorrectId = q.correctOptionId;

  if (q.options) {
    newOptions = q.options.map((o) => {
      const copyOptId = makeStableId('opt');
      if (o.id === q.correctOptionId) {
        newCorrectId = copyOptId;
      }
      return { id: copyOptId, text: o.text };
    });
  }

  return {
    ...q,
    id: newId,
    code: `${q.code}-SAO`,
    options: newOptions,
    correctOptionId: newCorrectId,
    statements: q.statements?.map((s) => ({ ...s, id: makeStableId('tf') })),
    acceptedAnswers: q.acceptedAnswers ? [...q.acceptedAnswers] : undefined,
  };
}

// ============================================================================
// BUILT-IN 10-QUESTION THCS MATH SAMPLE SET (3 Biết · 4 Hiểu · 3 Vận dụng)
// ============================================================================
export const SAMPLE_MATH_SET_ID = 'tqs_sample_math_thcs_10';

export function createSampleThcsMathQuestionSet(): ToolQuestionSet {
  const nowIso = '2026-11-22T08:00:00.000Z';
  const questions: ToolQuestionItem[] = [
    // 3 Biết (know)
    {
      id: 'sm_01',
      code: 'TOAN8-B1',
      grade: '8',
      subject: 'Toán',
      lesson: 'Phương trình bậc nhất một ẩn',
      level: 'know',
      type: 'mcq',
      stem: 'Phương trình nào sau đây là phương trình bậc nhất một ẩn?',
      options: [
        { id: 'sm01_a', text: '$2x - 6 = 0$' },
        { id: 'sm01_b', text: '$x^2 + 3 = 0$' },
        { id: 'sm01_c', text: '$0x + 5 = 0$' },
        { id: 'sm01_d', text: '$\\frac{1}{x} - 2 = 0$' },
      ],
      correctOptionId: 'sm01_a',
      explanation: 'Phương trình bậc nhất một ẩn có dạng $ax + b = 0$ với $a \\neq 0$, nên $2x - 6 = 0$ đúng.',
    },
    {
      id: 'sm_02',
      code: 'TOAN8-B2',
      grade: '8',
      subject: 'Toán',
      lesson: 'Hằng đẳng thức đáng nhớ',
      level: 'know',
      type: 'mcq',
      stem: 'Khai triển đúng của hằng đẳng thức $(a + b)^2$ là:',
      options: [
        { id: 'sm02_a', text: '$a^2 + b^2$' },
        { id: 'sm02_b', text: '$a^2 + 2ab + b^2$' },
        { id: 'sm02_c', text: '$a^2 - 2ab + b^2$' },
        { id: 'sm02_d', text: '$a^2 + ab + b^2$' },
      ],
      correctOptionId: 'sm02_b',
      explanation: 'Bình phương của một tổng: $(a + b)^2 = a^2 + 2ab + b^2$.',
    },
    {
      id: 'sm_03',
      code: 'TOAN8-B3',
      grade: '8',
      subject: 'Toán',
      lesson: 'Tứ giác và Hình bình hành',
      level: 'know',
      type: 'true_false',
      stem: 'Xét tính đúng/sai của các khẳng định về hình bình hành $ABCD$:',
      statements: [
        { id: 'sm03_s1', label: 'a', text: 'Các cạnh đối song song và bằng nhau.', isCorrect: true },
        { id: 'sm03_s2', label: 'b', text: 'Hai đường chéo luôn bằng nhau.', isCorrect: false },
        { id: 'sm03_s3', label: 'c', text: 'Các góc đối bằng nhau.', isCorrect: true },
        { id: 'sm03_s4', label: 'd', text: 'Hai đường chéo cắt nhau tại trung điểm của mỗi đường.', isCorrect: true },
      ],
      explanation: 'Hình bình hành không nhất thiết có hai đường chéo bằng nhau (chỉ hình chữ nhật mới có).',
    },

    // 4 Hiểu (understand)
    {
      id: 'sm_04',
      code: 'TOAN8-H1',
      grade: '8',
      subject: 'Toán',
      lesson: 'Phương trình bậc nhất một ẩn',
      level: 'understand',
      type: 'mcq',
      stem: 'Nghiệm của phương trình $3(x - 2) = 12$ là:',
      options: [
        { id: 'sm04_a', text: '$x = 2$' },
        { id: 'sm04_b', text: '$x = 4$' },
        { id: 'sm04_c', text: '$x = 6$' },
        { id: 'sm04_d', text: '$x = -2$' },
      ],
      correctOptionId: 'sm04_c',
      explanation: 'Chia hai vế cho $3$: $x - 2 = 4 \\Rightarrow x = 6$.',
    },
    {
      id: 'sm_05',
      code: 'TOAN8-H2',
      grade: '8',
      subject: 'Toán',
      lesson: 'Hằng đẳng thức đáng nhớ',
      level: 'understand',
      type: 'short_answer',
      stem: 'Tính giá trị biểu thức $A = x^2 - 4x + 4$ tại $x = 12$.',
      referenceAnswer: '100',
      acceptedAnswers: ['100'],
      shortAnswerRule: 'numeric_tolerance',
      numericTolerance: 0,
      explanation: '$A = (x - 2)^2 = (12 - 2)^2 = 10^2 = 100$.',
    },
    {
      id: 'sm_06',
      code: 'TOAN8-H3',
      grade: '8',
      subject: 'Toán',
      lesson: 'Định lí Pythagore',
      level: 'understand',
      type: 'mcq',
      stem: 'Tam giác vuông có hai cạnh góc vuông dài $6\\text{ cm}$ và $8\\text{ cm}$. Độ dài cạnh huyền là:',
      options: [
        { id: 'sm06_a', text: '$10\\text{ cm}$' },
        { id: 'sm06_b', text: '$12\\text{ cm}$' },
        { id: 'sm06_c', text: '$14\\text{ cm}$' },
        { id: 'sm06_d', text: '$48\\text{ cm}$' },
      ],
      correctOptionId: 'sm06_a',
      explanation: 'Theo định lí Pythagore: $c = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10\\text{ cm}$.',
    },
    {
      id: 'sm_07',
      code: 'TOAN8-H4',
      grade: '8',
      subject: 'Toán',
      lesson: 'Phân thức đại số',
      level: 'understand',
      type: 'true_false',
      stem: 'Cho phân thức $P = \\frac{x^2 - 9}{x - 3}$:',
      statements: [
        { id: 'sm07_s1', label: 'a', text: 'Điều kiện xác định của $P$ là $x \\neq 3$.', isCorrect: true },
        { id: 'sm07_s2', label: 'b', text: 'Với $x \\neq 3$, phân thức rút gọn thành $x + 3$.', isCorrect: true },
        { id: 'sm07_s3', label: 'c', text: 'Giá trị của $P$ tại $x = 3$ bằng $6$.', isCorrect: false },
        { id: 'sm07_s4', label: 'd', text: '$P = 0$ khi $x = -3$.', isCorrect: true },
      ],
      explanation: 'Tại $x = 3$, mẫu thức $x - 3 = 0$ nên $P$ không xác định.',
    },

    // 3 Vận dụng (apply)
    {
      id: 'sm_08',
      code: 'TOAN8-VD1',
      grade: '8',
      subject: 'Toán',
      lesson: 'Giải bài toán bằng cách lập phương trình',
      level: 'apply',
      type: 'mcq',
      stem: 'Một mảnh vườn hình chữ nhật có chiều dài hơn chiều rộng $4\\text{ m}$ và chu vi bằng $48\\text{ m}$. Diện tích mảnh vườn là:',
      options: [
        { id: 'sm08_a', text: '$120\\text{ m}^2$' },
        { id: 'sm08_b', text: '$140\\text{ m}^2$' },
        { id: 'sm08_c', text: '$160\\text{ m}^2$' },
        { id: 'sm08_d', text: '$192\\text{ m}^2$' },
      ],
      correctOptionId: 'sm08_b',
      explanation: 'Nửa chu vi $24\\text{ m}$. Gọi rộng là $x \\Rightarrow x + (x + 4) = 24 \\Rightarrow x = 10\\text{ m}$, dài $14\\text{ m}$. Diện tích $10 \\times 14 = 140\\text{ m}^2$.',
    },
    {
      id: 'sm_09',
      code: 'TOAN8-VD2',
      grade: '8',
      subject: 'Toán',
      lesson: 'Hàm số bậc nhất',
      level: 'apply',
      type: 'short_answer',
      stem: 'Đồ thị hàm số $y = ax + 3$ đi qua điểm $M(2; 9)$. Tìm hệ số góc $a$.',
      referenceAnswer: '3',
      acceptedAnswers: ['3'],
      shortAnswerRule: 'numeric_tolerance',
      numericTolerance: 0,
      explanation: 'Thay $x = 2, y = 9$ vào $y = ax + 3$: $9 = 2a + 3 \\Rightarrow 2a = 6 \\Rightarrow a = 3$.',
    },
    {
      id: 'sm_10',
      code: 'TOAN8-VD3',
      grade: '8',
      subject: 'Toán',
      lesson: 'Định lí Pythagore & Ứng dụng thực tế',
      level: 'apply',
      type: 'short_answer',
      stem: 'Một chiếc thang dài $5\\text{ m}$ dựa vào tường, chân thang cách chân tường $3\\text{ m}$. Đỉnh thang chạm tường ở độ cao bao nhiêu mét (ghi cả đơn vị nếu có)?',
      referenceAnswer: '4 m',
      acceptedAnswers: ['4', '4 m', '4m'],
      shortAnswerRule: 'manual_only',
      requiresManualReviewNote: 'Cần đối chiếu đơn vị (4 m hoặc 4 mét) trước khi chốt điểm.',
      explanation: 'Áp dụng định lí Pythagore: $h = \\sqrt{5^2 - 3^2} = \\sqrt{16} = 4\\text{ m}$.',
    },
  ];

  return {
    id: SAMPLE_MATH_SET_ID,
    title: 'Bộ mẫu Toán THCS (10 câu chuẩn 3 Biết · 4 Hiểu · 3 Vận dụng)',
    grade: '8',
    subject: 'Toán',
    lesson: 'Ôn tập tổng hợp Toán 8',
    description: 'Bộ đề mẫu chuẩn công thức KaTeX dùng chung cho cả 3 trò chơi: Mở mảnh ghép, Đường đua và Rung chuông vàng.',
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    questions,
  };
}

// ============================================================================
// IMPORT 1: CSV / EXCEL PASTE / SPREADSHEET TEMPLATE PARSER
// ============================================================================
export function generateCsvSampleTemplate(): string {
  const headers = [
    'Mã câu',
    'Khối',
    'Môn',
    'Bài học',
    'Mức độ (Biết/Hiểu/Vận dụng)',
    'Dạng (ABCD/Đúng-Sai/Trả lời ngắn)',
    'Nội dung câu hỏi',
    'Phương án A / Ý a (Đ/S)',
    'Phương án B / Ý b (Đ/S)',
    'Phương án C / Ý c (Đ/S)',
    'Phương án D / Ý d (Đ/S)',
    'Đáp án đúng (A..D / Đ,S,Đ,S / Đáp án ngắn)',
    'Lời giải',
  ];
  const sampleRows = [
    [
      'TOAN8-M01',
      '8',
      'Toán',
      'Phương trình bậc nhất',
      'Biết',
      'ABCD',
      'Giải phương trình $2x - 8 = 0$',
      '$x = 2$',
      '$x = 4$',
      '$x = -4$',
      '$x = 8$',
      'B',
      '$2x = 8 \\Rightarrow x = 4$',
    ],
    [
      'TOAN8-M02',
      '8',
      'Toán',
      'Hình bình hành',
      'Hiểu',
      'Đúng-Sai',
      'Các nhận định sau về hình thoi đúng hay sai?',
      'Bốn cạnh bằng nhau',
      'Hai đường chéo vuông góc',
      'Hai đường chéo luôn bằng nhau',
      'Các góc đối bằng nhau',
      'Đ,Đ,S,Đ',
      'Hình thoi chỉ có hai đường chéo bằng nhau khi là hình vuông.',
    ],
    [
      'TOAN8-M03',
      '8',
      'Toán',
      'Hằng đẳng thức',
      'Vận dụng',
      'Trả lời ngắn',
      'Tính giá trị biểu thức $x^2 - 1$ tại $x = 11$',
      '',
      '',
      '',
      '',
      '120',
      '$11^2 - 1 = 121 - 1 = 120$',
    ],
  ];
  const escapeCell = (c: string) =>
    c.includes(',') || c.includes('"') || c.includes('\n')
      ? `"${c.replace(/"/g, '""')}"`
      : c;
  return [headers, ...sampleRows]
    .map((r) => r.map(escapeCell).join(','))
    .join('\n');
}

function parseDelimitedText(raw: string): string[][] {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Detect tab-separated paste from Excel vs comma/semicolon CSV
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t')
    ? '\t'
    : firstLine.split(';').length > firstLine.split(',').length
      ? ';'
      : ',';

  if (delimiter === '\t') {
    return lines.map((l) => l.split('\t').map((c) => c.trim()));
  }

  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

function parseCognitiveLevelText(val: string): CognitiveLevel {
  const norm = stripVietnameseAccents(val);
  if (norm.includes('van dung') || norm === 'apply' || norm === 'vd') return 'apply';
  if (norm.includes('hieu') || norm === 'understand' || norm === 'th') return 'understand';
  return 'know';
}

function parseQuestionTypeText(val: string): ToolQuestionType {
  const norm = stripVietnameseAccents(val);
  if (norm.includes('dung') || norm.includes('sai') || norm.includes('tf')) return 'true_false';
  if (norm.includes('ngan') || norm.includes('short') || norm.includes('tu luan')) return 'short_answer';
  return 'mcq';
}

export function parseSpreadsheetQuestionImport(
  rawTextOrRows: string | string[][],
  defaults?: { grade?: Grade; subject?: string; lesson?: string }
): ImportPreviewRow[] {
  const matrix = Array.isArray(rawTextOrRows)
    ? rawTextOrRows
    : parseDelimitedText(rawTextOrRows);
  if (matrix.length === 0) return [];

  // Skip header row if first cell looks like header
  const firstCellNorm = stripVietnameseAccents(matrix[0][0] || '');
  const hasHeader =
    firstCellNorm.includes('ma cau') ||
    firstCellNorm.includes('code') ||
    firstCellNorm.includes('cau hoi') ||
    firstCellNorm.includes('stt');
  const dataRows = hasHeader ? matrix.slice(1) : matrix;

  const seenCodes = new Map<string, number>();
  const out: ImportPreviewRow[] = [];

  dataRows.forEach((cols, idx) => {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const code = (cols[0] || `CAU-${idx + 1}`).trim();
    const gradeRaw = (cols[1] || defaults?.grade || '8').replace(/[^6-9]/g, '');
    const grade = (['6', '7', '8', '9'].includes(gradeRaw) ? gradeRaw : '8') as Grade;
    const subject = normalizeSubjectLabel(cols[2] || defaults?.subject || 'Toán');
    const lesson = (cols[3] || defaults?.lesson || 'Ôn tập').trim();
    const level = parseCognitiveLevelText(cols[4] || 'Biết');
    const type = parseQuestionTypeText(cols[5] || 'ABCD');
    const stem = (cols[6] || '').trim();
    const optAText = (cols[7] || '').trim();
    const optBText = (cols[8] || '').trim();
    const optCText = (cols[9] || '').trim();
    const optDText = (cols[10] || '').trim();
    const answerRaw = (cols[11] || '').trim();
    const explanation = (cols[12] || '').trim();

    const errors: string[] = [];
    if (!stem) errors.push('Thiếu nội dung câu hỏi.');

    const upperCode = code.toUpperCase();
    if (seenCodes.has(upperCode)) {
      errors.push(`Trùng mã câu hỏi "${code}" (đã xuất hiện ở dòng ${seenCodes.get(upperCode)}).`);
    } else {
      seenCodes.set(upperCode, rowNumber);
    }

    let options: ToolMcqOption[] = [];
    let correctOptionLetter: 'A' | 'B' | 'C' | 'D' | '' = '';
    let statements: ToolTfStatement[] = [];
    let referenceAnswer = '';

    if (type === 'mcq') {
      options = [
        { id: makeStableId('optA'), text: optAText },
        { id: makeStableId('optB'), text: optBText },
        { id: makeStableId('optC'), text: optCText },
        { id: makeStableId('optD'), text: optDText },
      ].filter((o) => o.text.length > 0);
      if (options.length < 2) {
        errors.push('Câu ABCD cần ít nhất 2 phương án trả lời.');
      }
      const upperAns = answerRaw.toUpperCase().replace(/[^A-D]/g, '');
      if (!upperAns || !['A', 'B', 'C', 'D'].includes(upperAns[0])) {
        errors.push('Thiếu hoặc sai đáp án ABCD (chỉ nhận A, B, C hoặc D).');
      } else {
        correctOptionLetter = upperAns[0] as 'A' | 'B' | 'C' | 'D';
        const letterIdx = correctOptionLetter.charCodeAt(0) - 65;
        if (!options[letterIdx]) {
          errors.push(`Đáp án ${correctOptionLetter} không có nội dung phương án tương ứng.`);
        }
      }
    } else if (type === 'true_false') {
      const rawFlags = answerRaw
        .split(/[,;/\s]+/)
        .map((s) => stripVietnameseAccents(s))
        .filter(Boolean);
      const rawTexts = [optAText, optBText, optCText, optDText];
      rawTexts.forEach((txt, sIdx) => {
        if (!txt) return;
        const flagStr = rawFlags[sIdx] || '';
        const isTrue = flagStr === 'd' || flagStr === 'dung' || flagStr === 't' || flagStr === 'true' || flagStr === '1';
        const isFalse = flagStr === 's' || flagStr === 'sai' || flagStr === 'f' || flagStr === 'false' || flagStr === '0';
        if (!isTrue && !isFalse) {
          errors.push(`Thiếu đáp án Đ/S cho ý ${String.fromCharCode(97 + sIdx)}.`);
        }
        statements.push({
          id: makeStableId('tf'),
          label: String.fromCharCode(97 + sIdx),
          text: txt,
          isCorrect: isTrue,
        });
      });
      if (statements.length === 0) {
        errors.push('Câu Đúng/Sai cần ít nhất 1 ý nhận định.');
      }
    } else {
      referenceAnswer = answerRaw;
      if (!referenceAnswer) {
        errors.push('Câu Trả lời ngắn cần đáp án tham chiếu.');
      }
    }

    out.push({
      rowNumber,
      sectionLabel: 'Bảng nhập',
      code,
      grade,
      subject,
      lesson,
      level,
      type,
      stem,
      options,
      correctOptionLetter,
      statements,
      referenceAnswer,
      shortAnswerRule: type === 'short_answer' ? 'manual_only' : 'exact_trimmed',
      explanation,
      errors,
    });
  });

  return out;
}

export function parseXlsxWorkbookToPreview(
  workbook: XLSX.WorkBook,
  defaults?: { grade?: Grade; subject?: string; lesson?: string }
): ImportPreviewRow[] {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
  return parseSpreadsheetQuestionImport(
    matrix.map((row) => row.map((cell) => String(cell ?? '').trim())),
    defaults
  );
}

// ============================================================================
// IMPORT 2: PDF TEXT LAYER + TABLE ANSWER KEY PARSER
// ============================================================================
function normalizeSectionTag(rawSection: string): string {
  const norm = stripVietnameseAccents(rawSection);
  if (!norm || norm === 'mac dinh' || norm === 'chung') return 'CHUNG';
  if (norm.includes('iii') || norm.includes('3')) return 'PHAN_3';
  if (norm.includes('ii') || norm.includes('2')) return 'PHAN_2';
  if (norm.includes('i') || norm.includes('1')) return 'PHAN_1';
  return norm.toUpperCase().replace(/\s+/g, '_');
}

function normalizeQuestionKeyLabel(sectionTag: string, labelNum: string): string {
  return `${sectionTag}::CAU_${labelNum}`;
}

/**
 * Parses PDF pages with text layer + an answer key table (CSV/TSV/Text).
 * Detects:
 * - Image-only PDF pages (empty or non-textual pages needing manual handling)
 * - Labels "Câu 1", "Câu 2"... grouped by Phần I / Phần II / Phần III
 * - Missing answers, duplicate question codes, orphan answer keys
 */
export function parsePdfTextAndAnswerKey(params: {
  pages: PdfPageTextInput[];
  answerKeyText: string;
  defaults?: { grade?: Grade; subject?: string; lesson?: string };
}): PdfAndKeyParseResult {
  const { pages, answerKeyText, defaults } = params;

  const imageOnlyPages: number[] = [];
  const rawQuestions: {
    sectionTag: string;
    sectionLabel: string;
    questionNum: string;
    code: string;
    bodyText: string;
  }[] = [];

  let activeSectionTag = 'CHUNG';
  let activeSectionLabel = 'Phần chung';

  for (const page of pages) {
    const cleanText = (page.text || '').trim();
    const looksImageOnly = page.isImageOnly || cleanText.length < 15;
    if (looksImageOnly) {
      imageOnlyPages.push(page.pageNumber);
      continue;
    }

    const lines = cleanText.replace(/\r\n/g, '\n').split('\n');
    let currentEntry: {
      sectionTag: string;
      sectionLabel: string;
      questionNum: string;
      code: string;
      lines: string[];
    } | null = null;

    const flushEntry = () => {
      if (currentEntry) {
        rawQuestions.push({
          sectionTag: currentEntry.sectionTag,
          sectionLabel: currentEntry.sectionLabel,
          questionNum: currentEntry.questionNum,
          code: currentEntry.code,
          bodyText: currentEntry.lines.join('\n').trim(),
        });
        currentEntry = null;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      const secMatch = line.match(/^(?:PHẦN|Phần)\s+([IVX1-3]+)\b/i);
      if (secMatch) {
        flushEntry();
        activeSectionTag = normalizeSectionTag(secMatch[1]);
        activeSectionLabel = `Phần ${secMatch[1].toUpperCase()}`;
        continue;
      }

      const qMatch = line.match(/^(?:Câu|Bài)\s*(\d+)\s*[:.)\-]?\s*(.*)$/i);
      if (qMatch) {
        flushEntry();
        const qNum = qMatch[1];
        const remainder = (qMatch[2] || '').trim();
        const codePrefix = activeSectionTag === 'CHUNG' ? 'C' : `${activeSectionTag.replace('PHAN_', 'P')}C`;
        currentEntry = {
          sectionTag: activeSectionTag,
          sectionLabel: activeSectionLabel,
          questionNum: qNum,
          code: `${codePrefix}-${qNum}`,
          lines: remainder ? [remainder] : [],
        };
        continue;
      }

      if (currentEntry) {
        currentEntry.lines.push(line);
      }
    }
    flushEntry();
  }

  // Parse answer key table: supports formats:
  // "Câu 1 | B | Lời giải" or "Phần I | Câu 1 | B | Lời giải" or "P1C-1, B"
  const answerMatrix = parseDelimitedText(answerKeyText);
  const answerMap = new Map<string, { answer: string; explanation: string; count: number }>();
  const duplicateAnswerKeys: string[] = [];

  answerMatrix.forEach((cols, rIdx) => {
    if (cols.length < 2) return;
    const c0Norm = stripVietnameseAccents(cols[0]);
    if (rIdx === 0 && (c0Norm.includes('phan') || c0Norm.includes('cau') || c0Norm.includes('ma'))) {
      const secondNorm = stripVietnameseAccents(cols[1]);
      if (secondNorm.includes('dap an') || secondNorm.includes('cau')) return;
    }

    let secTag = 'CHUNG';
    let qNum = '';
    let ans = '';
    let exp = '';

    if (cols.length >= 3 && stripVietnameseAccents(cols[0]).includes('phan')) {
      secTag = normalizeSectionTag(cols[0]);
      const m = cols[1].match(/(\d+)/);
      qNum = m ? m[1] : cols[1].trim();
      ans = cols[2].trim();
      exp = (cols[3] || '').trim();
    } else if (cols[0].match(/^(?:PHẦN|Phần)\s*[IVX1-3]+/i)) {
      secTag = normalizeSectionTag(cols[0]);
      const m = cols[1].match(/(\d+)/);
      qNum = m ? m[1] : cols[1].trim();
      ans = (cols[2] || '').trim();
      exp = (cols[3] || '').trim();
    } else {
      const qMatch = cols[0].match(/(?:P(\d+)[\-_]?)?C?(?:âu|au)?\s*(\d+)/i);
      if (qMatch) {
        if (qMatch[1]) secTag = `PHAN_${qMatch[1]}`;
        qNum = qMatch[2];
      } else {
        qNum = cols[0].trim();
      }
      ans = cols[1].trim();
      exp = (cols[2] || '').trim();
    }

    const key = normalizeQuestionKeyLabel(secTag, qNum);
    const existing = answerMap.get(key);
    if (existing) {
      duplicateAnswerKeys.push(cols[0]);
      existing.count += 1;
    } else {
      answerMap.set(key, { answer: ans, explanation: exp, count: 1 });
    }
  });

  // Detect duplicate codes inside PDF questions
  const codeCount = new Map<string, number>();
  const duplicateCodes: string[] = [...duplicateAnswerKeys];
  for (const rq of rawQuestions) {
    const key = normalizeQuestionKeyLabel(rq.sectionTag, rq.questionNum);
    codeCount.set(key, (codeCount.get(key) || 0) + 1);
  }
  for (const [k, cnt] of codeCount.entries()) {
    if (cnt > 1) {
      duplicateCodes.push(k.replace('::', ' · '));
    }
  }

  const matchedKeys = new Set<string>();
  const missingAnswerCodes: string[] = [];

  const rows: ImportPreviewRow[] = rawQuestions.map((rq, idx) => {
    const compositeKey = normalizeQuestionKeyLabel(rq.sectionTag, rq.questionNum);
    const ansEntry =
      answerMap.get(compositeKey) ||
      answerMap.get(normalizeQuestionKeyLabel('CHUNG', rq.questionNum));
    if (ansEntry) {
      matchedKeys.add(compositeKey);
      matchedKeys.add(normalizeQuestionKeyLabel('CHUNG', rq.questionNum));
    }

    // Extract inline A. B. C. D. options or a) b) c) d) statements
    const body = rq.bodyText;
    const mcMatches = Array.from(
      body.matchAll(/(?:^|\n|\s)([A-D])[.)]\s*([\s\S]*?)(?=(?:\s+[A-D][.)]\s)|$)/g)
    );
    const tfMatches = Array.from(
      body.matchAll(/(?:^|\n|\s)([a-d])[.)]\s*([\s\S]*?)(?=(?:\s+[a-d][.)]\s)|$)/g)
    );

    let type: ToolQuestionType = 'short_answer';
    let stem = body;
    let options: ToolMcqOption[] = [];
    let statements: ToolTfStatement[] = [];
    let correctOptionLetter: 'A' | 'B' | 'C' | 'D' | '' = '';
    let referenceAnswer = '';
    const errors: string[] = [];

    if (mcMatches.length >= 2) {
      type = 'mcq';
      const firstIdx = mcMatches[0].index ?? 0;
      stem = body.slice(0, firstIdx).trim() || body;
      options = mcMatches.slice(0, 4).map((m) => ({
        id: makeStableId('opt'),
        text: m[2].trim(),
      }));
    } else if (tfMatches.length >= 2) {
      type = 'true_false';
      const firstIdx = tfMatches[0].index ?? 0;
      stem = body.slice(0, firstIdx).trim() || body;
      const flags = (ansEntry?.answer || '')
        .split(/[,;/\s]+/)
        .map((s) => stripVietnameseAccents(s))
        .filter(Boolean);
      statements = tfMatches.slice(0, 4).map((m, sIdx) => ({
        id: makeStableId('tf'),
        label: m[1].toLowerCase(),
        text: m[2].trim(),
        isCorrect: ['d', 'dung', 't', 'true', '1'].includes(flags[sIdx] || ''),
      }));
    }

    if ((codeCount.get(compositeKey) || 0) > 1) {
      errors.push(`Trùng mã câu hỏi "${rq.code}" trong cùng phần.`);
    }

    if (!ansEntry || !ansEntry.answer) {
      missingAnswerCodes.push(rq.code);
      errors.push(`Thiếu đáp án cho ${rq.code}.`);
    } else if (type === 'mcq') {
      const letter = ansEntry.answer.toUpperCase().replace(/[^A-D]/g, '');
      if (letter && ['A', 'B', 'C', 'D'].includes(letter[0])) {
        correctOptionLetter = letter[0] as 'A' | 'B' | 'C' | 'D';
      } else {
        errors.push(`Đáp án "${ansEntry.answer}" không hợp lệ cho dạng ABCD.`);
      }
    } else if (type === 'short_answer') {
      referenceAnswer = ansEntry.answer;
    }

    return {
      rowNumber: idx + 1,
      sectionLabel: rq.sectionLabel,
      code: rq.code,
      grade: defaults?.grade || '8',
      subject: normalizeSubjectLabel(defaults?.subject || 'Toán'),
      lesson: defaults?.lesson || 'Nhập từ PDF',
      level: 'understand',
      type,
      stem,
      options,
      correctOptionLetter,
      statements,
      referenceAnswer,
      shortAnswerRule: type === 'short_answer' ? 'manual_only' : 'exact_trimmed',
      explanation: ansEntry?.explanation || '',
      errors,
    };
  });

  const orphanAnswerCodes: string[] = [];
  for (const key of answerMap.keys()) {
    if (!matchedKeys.has(key)) {
      orphanAnswerCodes.push(key.replace('::', ' · '));
    }
  }

  const warnings: string[] = [];
  if (imageOnlyPages.length > 0) {
    warnings.push(
      `Trang PDF dạng ảnh (không có lớp văn bản, cần xử lý thủ công): trang ${imageOnlyPages.join(', ')}.`
    );
  }
  if (missingAnswerCodes.length > 0) {
    warnings.push(`Câu thiếu đáp án: ${missingAnswerCodes.join(', ')}.`);
  }
  if (duplicateCodes.length > 0) {
    warnings.push(`Phát hiện mã câu trùng: ${duplicateCodes.join(', ')}.`);
  }
  if (orphanAnswerCodes.length > 0) {
    warnings.push(`Dòng đáp án chưa ghép được câu hỏi: ${orphanAnswerCodes.join(', ')}.`);
  }

  return {
    rows,
    imageOnlyPages,
    missingAnswerCodes,
    duplicateCodes,
    orphanAnswerCodes,
    warnings,
  };
}

export function buildQuestionItemsFromPreviewRows(
  rows: ImportPreviewRow[]
): ToolQuestionItem[] {
  return rows.map((row) => {
    let correctOptionId: string | undefined;
    if (row.type === 'mcq' && row.options.length > 0) {
      const idx = row.correctOptionLetter
        ? row.correctOptionLetter.charCodeAt(0) - 65
        : 0;
      correctOptionId = row.options[idx]?.id || row.options[0].id;
    }

    return {
      id: makeStableId('tq'),
      code: row.code,
      grade: row.grade,
      subject: row.subject,
      lesson: row.lesson,
      level: row.level,
      type: row.type,
      stem: row.stem,
      explanation: row.explanation,
      options: row.type === 'mcq' ? row.options : undefined,
      correctOptionId: row.type === 'mcq' ? correctOptionId : undefined,
      statements: row.type === 'true_false' ? row.statements : undefined,
      referenceAnswer: row.type === 'short_answer' ? row.referenceAnswer : undefined,
      acceptedAnswers:
        row.type === 'short_answer' && row.referenceAnswer
          ? [row.referenceAnswer]
          : undefined,
      shortAnswerRule: row.type === 'short_answer' ? row.shortAnswerRule : undefined,
    };
  });
}

export function importFromSystemBankQuestions(
  bankQuestions: Question[],
  title = 'Trích xuất từ Ngân hàng câu hỏi chung Smart EDU'
): ToolQuestionSet {
  const nowIso = new Date().toISOString();
  const converted: ToolQuestionItem[] = bankQuestions
    .filter((q) => q.type !== 'essay')
    .map((q) => {
      if (q.type === 'single_choice') {
        const opts: ToolMcqOption[] = (q.options || []).map((o) => ({
          id: o.id || makeStableId('opt'),
          text: o.text,
        }));
        const matchedOpt =
          opts.find((o) => o.id === q.correctAnswer) ||
          opts[
            q.correctAnswer && ['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())
              ? q.correctAnswer.toUpperCase().charCodeAt(0) - 65
              : 0
          ] ||
          opts[0];
        return {
          id: q.id || makeStableId('tq'),
          code: q.code || 'CH',
          grade: q.grade || '8',
          subject: normalizeSubjectLabel(String(q.subject || 'Toán')),
          lesson: q.lesson || 'Chung',
          level: q.level || 'know',
          type: 'mcq',
          stem: q.stem,
          imageDataUrl: q.image,
          explanation: q.explanation || '',
          options: opts,
          correctOptionId: matchedOpt?.id,
        };
      }
      if (q.type === 'true_false_group') {
        return {
          id: q.id || makeStableId('tq'),
          code: q.code || 'CH',
          grade: q.grade || '8',
          subject: normalizeSubjectLabel(String(q.subject || 'Toán')),
          lesson: q.lesson || 'Chung',
          level: q.level || 'understand',
          type: 'true_false',
          stem: q.stem,
          imageDataUrl: q.image,
          explanation: q.explanation || '',
          statements: (q.subItems || []).map((s) => ({
            id: s.id || makeStableId('tf'),
            label: s.label,
            text: s.text,
            isCorrect: Boolean(s.isCorrect),
          })),
        };
      }
      return {
        id: q.id || makeStableId('tq'),
        code: q.code || 'CH',
        grade: q.grade || '8',
        subject: normalizeSubjectLabel(String(q.subject || 'Toán')),
        lesson: q.lesson || 'Chung',
        level: q.level || 'apply',
        type: 'short_answer',
        stem: q.stem,
        imageDataUrl: q.image,
        explanation: q.explanation || '',
        referenceAnswer: q.acceptedAnswers?.[0] || q.sampleAnswer || '',
        acceptedAnswers: q.acceptedAnswers || [],
        shortAnswerRule: q.isNumericTolerance ? 'numeric_tolerance' : 'manual_only',
        numericTolerance: q.numericTolerance,
      };
    });

  return {
    id: makeStableId('tqs'),
    title,
    grade: converted[0]?.grade || '8',
    subject: converted[0]?.subject || 'Toán',
    lesson: 'Tổng hợp từ Ngân hàng Smart EDU',
    description: `Gồm ${converted.length} câu hỏi được nạp trực tiếp từ kho câu hỏi hiện có của Smart EDU.`,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    questions: converted,
  };
}

// ============================================================================
// ISOLATED STORAGE FOR QUESTION SETS (/demo vs Production Account)
// ============================================================================
export function getQuestionSetsStorageKey(accountId?: string | null): string {
  const safeAccount = (accountId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const base = `taydo_teaching_tools_v2_qsets_${safeAccount}`;
  return isKhktDemoRuntime() ? `${KHKT_DEMO_STORAGE_PREFIX}${base}` : base;
}

export function loadToolQuestionSets(accountId?: string | null): ToolQuestionSet[] {
  const sample = createSampleThcsMathQuestionSet();
  if (typeof window === 'undefined') return [sample];
  const key = getQuestionSetsStorageKey(accountId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify([sample]));
      return [sample];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [sample];
    }
    return parsed as ToolQuestionSet[];
  } catch {
    return [sample];
  }
}

export function saveToolQuestionSets(
  sets: ToolQuestionSet[],
  accountId?: string | null
): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(
      getQuestionSetsStorageKey(accountId),
      JSON.stringify(sets)
    );
    return true;
  } catch {
    return false;
  }
}
