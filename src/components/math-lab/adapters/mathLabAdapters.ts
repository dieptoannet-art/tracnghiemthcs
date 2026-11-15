import { Question } from '../../../types';
import {
  MathActivityResultRecord,
  MathClassroomSession,
  MathGrade,
  MathSavedConstruction,
  MathToolId,
} from '../types';

const STORAGE_KEYS = {
  RESULTS: 'taydo_math_lab_v1_results',
  CONSTRUCTIONS: 'taydo_math_lab_v1_constructions',
  RECENT_TOOLS: 'taydo_math_lab_v1_recent_tools',
  SESSIONS: 'taydo_math_lab_v1_sessions',
} as const;

export interface MathQuizQuestion {
  id: string;
  grade: MathGrade;
  topic: string;
  question: string;
  options: [string, string, string, string];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  source: 'SYSTEM_BANK' | 'GDPT2018_CURATED';
}

export const CURATED_GDPT2018_MATH_QUESTIONS: MathQuizQuestion[] = [
  // Lớp 6
  {
    id: 'm11-g6-01',
    grade: 6,
    topic: 'Phân số & Số nguyên',
    question: 'Kết quả rút gọn tối giản của phép tính $\\frac{-3}{4} + \\frac{5}{6}$ là:',
    options: ['$\\frac{1}{12}$', '$\\frac{2}{10}$', '$\\frac{-1}{12}$', '$\\frac{19}{12}$'],
    correctAnswer: 'A',
    explanation: 'Quy đồng mẫu số chung 12: $\\frac{-9}{12} + \\frac{10}{12} = \\frac{1}{12}$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g6-02',
    grade: 6,
    topic: 'Hình học trực quan',
    question: 'Hình chữ nhật có chiều dài $8\\text{ cm}$ và chiều rộng $5\\text{ cm}$. Chu vi và diện tích lần lượt là:',
    options: [
      '$26\\text{ cm}$ và $40\\text{ cm}^2$',
      '$13\\text{ cm}$ và $40\\text{ cm}^2$',
      '$40\\text{ cm}$ và $26\\text{ cm}^2$',
      '$26\\text{ cm}$ và $13\\text{ cm}^2$',
    ],
    correctAnswer: 'A',
    explanation: 'Chu vi $P = 2 \\cdot (8 + 5) = 26\\text{ cm}$; Diện tích $S = 8 \\cdot 5 = 40\\text{ cm}^2$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g6-03',
    grade: 6,
    topic: 'Xác suất thực nghiệm',
    question: 'Tung một đồng xu cân đối 40 lần, mặt Ngửa (N) xuất hiện 18 lần. Xác suất thực nghiệm của mặt Ngửa là:',
    options: ['$0{,}45$', '$0{,}55$', '$0{,}18$', '$0{,}50$'],
    correctAnswer: 'A',
    explanation: 'Xác suất thực nghiệm $P = \\frac{18}{40} = \\frac{9}{20} = 0{,}45$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g6-04',
    grade: 6,
    topic: 'Số nguyên',
    question: 'Giá trị của biểu thức $(-15) + 23 - (-7)$ bằng:',
    options: ['$15$', '$1$', '$-1$', '$31$'],
    correctAnswer: 'A',
    explanation: '$(-15) + 23 + 7 = 8 + 7 = 15$.',
    source: 'GDPT2018_CURATED',
  },

  // Lớp 7
  {
    id: 'm11-g7-01',
    grade: 7,
    topic: 'Tổng ba góc của tam giác',
    question: 'Cho $\\triangle ABC$ có $\\hat{A} = 55^\\circ$ và $\\hat{B} = 65^\\circ$. Số đo góc $\\hat{C}$ là:',
    options: ['$60^\\circ$', '$70^\\circ$', '$50^\\circ$', '$120^\\circ$'],
    correctAnswer: 'A',
    explanation: 'Tổng 3 góc trong tam giác bằng $180^\\circ \\Rightarrow \\hat{C} = 180^\\circ - (55^\\circ + 65^\\circ) = 60^\\circ$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g7-02',
    grade: 7,
    topic: 'Tỉ lệ thức & Đại lượng tỉ lệ',
    question: 'Tìm $x$ trong tỉ lệ thức $\\frac{x}{6} = \\frac{10}{15}$:',
    options: ['$x = 4$', '$x = 5$', '$x = 6$', '$x = 9$'],
    correctAnswer: 'A',
    explanation: '$x = \\frac{6 \\cdot 10}{15} = \\frac{60}{15} = 4$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g7-03',
    grade: 7,
    topic: 'Hình hộp chữ nhật & Hình lập phương',
    question: 'Thể tích hình lập phương có cạnh $a = 4\\text{ cm}$ là:',
    options: ['$64\\text{ cm}^3$', '$16\\text{ cm}^3$', '$96\\text{ cm}^3$', '$48\\text{ cm}^3$'],
    correctAnswer: 'A',
    explanation: 'Thể tích hình lập phương $V = a^3 = 4^3 = 64\\text{ cm}^3$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g7-04',
    grade: 7,
    topic: 'Biểu thức đại số',
    question: 'Giá trị của đa thức $P(x) = 2x^2 - 3x + 1$ tại $x = 2$ là:',
    options: ['$3$', '$5$', '$1$', '$7$'],
    correctAnswer: 'A',
    explanation: '$P(2) = 2 \\cdot 2^2 - 3 \\cdot 2 + 1 = 8 - 6 + 1 = 3$.',
    source: 'GDPT2018_CURATED',
  },

  // Lớp 8
  {
    id: 'm11-g8-01',
    grade: 8,
    topic: 'Hằng đẳng thức đáng nhớ',
    question: 'Khai triển hằng đẳng thức $(x + 3)^2$ ta được:',
    options: [
      '$x^2 + 6x + 9$',
      '$x^2 + 3x + 9$',
      '$x^2 + 9$',
      '$x^2 - 6x + 9$',
    ],
    correctAnswer: 'A',
    explanation: 'Áp dụng $(A + B)^2 = A^2 + 2AB + B^2 = x^2 + 2 \\cdot x \\cdot 3 + 3^2 = x^2 + 6x + 9$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g8-02',
    grade: 8,
    topic: 'Hàm số bậc nhất $y = ax + b$',
    question: 'Đồ thị hàm số $y = 2x - 4$ cắt trục hoành $Ox$ tại điểm có tọa độ:',
    options: ['$(2; 0)$', '$(0; -4)$', '$(-2; 0)$', '$(4; 0)$'],
    correctAnswer: 'A',
    explanation: 'Cho $y = 0 \\Rightarrow 2x - 4 = 0 \\Rightarrow x = 2$. Giao điểm với trục hoành là $(2; 0)$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g8-03',
    grade: 8,
    topic: 'Định lí Pythagore',
    question: 'Tam giác vuông có hai cạnh góc vuông $a = 6\\text{ cm}, b = 8\\text{ cm}$. Độ dài cạnh huyền $c$ là:',
    options: ['$10\\text{ cm}$', '$14\\text{ cm}$', '$12\\text{ cm}$', '$100\\text{ cm}$'],
    correctAnswer: 'A',
    explanation: 'Theo định lí Pythagore: $c = \\sqrt{6^2 + 8^2} = \\sqrt{36 + 64} = \\sqrt{100} = 10\\text{ cm}$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g8-04',
    grade: 8,
    topic: 'Phương trình bậc nhất một ẩn',
    question: 'Nghiệm của phương trình $3x - 5 = x + 7$ là:',
    options: ['$x = 6$', '$x = 1$', '$x = 3$', '$x = -6$'],
    correctAnswer: 'A',
    explanation: '$3x - x = 7 + 5 \\Leftrightarrow 2x = 12 \\Leftrightarrow x = 6$.',
    source: 'GDPT2018_CURATED',
  },

  // Lớp 9
  {
    id: 'm11-g9-01',
    grade: 9,
    topic: 'Hàm số $y = ax^2$ ($a \\neq 0$)',
    question: 'Điểm nào sau đây thuộc đồ thị hàm số Parabol $y = \\frac{1}{2}x^2$?',
    options: ['$M(2; 2)$', '$N(2; 4)$', '$P(1; 2)$', '$Q(-2; -2)$'],
    correctAnswer: 'A',
    explanation: 'Thay $x = 2$ vào $y = \\frac{1}{2}x^2$ ta được $y = \\frac{1}{2} \\cdot 4 = 2$. Vậy $M(2; 2)$ thuộc Parabol.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g9-02',
    grade: 9,
    topic: 'Hệ thức lượng trong tam giác vuông',
    question: 'Trong $\\triangle ABC$ vuông tại $A$ có $BC = 10\\text{ cm}$ và $\\hat{B} = 30^\\circ$. Độ dài cạnh đối $AC$ là:',
    options: ['$5\\text{ cm}$', '$5\\sqrt{3}\\text{ cm}$', '$10\\text{ cm}$', '$\\frac{10}{\\sqrt{3}}\\text{ cm}$'],
    correctAnswer: 'A',
    explanation: '$AC = BC \\cdot \\sin B = 10 \\cdot \\sin 30^\\circ = 10 \\cdot 0{,}5 = 5\\text{ cm}$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g9-03',
    grade: 9,
    topic: 'Hình trụ – Hình nón – Hình cầu',
    question: 'Thể tích hình trụ có bán kính đáy $r = 3\\text{ cm}$ và chiều cao $h = 5\\text{ cm}$ (lấy theo $\\pi$) là:',
    options: ['$45\\pi\\text{ cm}^3$', '$15\\pi\\text{ cm}^3$', '$30\\pi\\text{ cm}^3$', '$90\\pi\\text{ cm}^3$'],
    correctAnswer: 'A',
    explanation: '$V = \\pi r^2 h = \\pi \\cdot 3^2 \\cdot 5 = 45\\pi\\text{ cm}^3$.',
    source: 'GDPT2018_CURATED',
  },
  {
    id: 'm11-g9-04',
    grade: 9,
    topic: 'Tương giao Parabol và đường thẳng',
    question: 'Số giao điểm của Parabol $y = x^2$ và đường thẳng $y = 2x + 3$ là:',
    options: ['2 giao điểm phân biệt', '1 giao điểm (tiếp xúc)', 'Không có giao điểm', '3 giao điểm'],
    correctAnswer: 'A',
    explanation: 'Phương trình hoành độ giao điểm $x^2 - 2x - 3 = 0$ có $\\Delta\' = 1 - (-3) = 4 > 0$, nên có 2 giao điểm phân biệt $(-1; 1)$ và $(3; 9)$.',
    source: 'GDPT2018_CURATED',
  },
];

/**
 * Adapter đọc ngân hàng câu hỏi Toán từ hệ thống (chỉ đọc, không sửa ngân hàng câu hỏi gốc)
 */
export function getMathQuizQuestionsForGrade(
  systemQuestions: Question[] | undefined,
  grade?: MathGrade | 'ALL'
): MathQuizQuestion[] {
  const convertedSystem: MathQuizQuestion[] = [];

  if (Array.isArray(systemQuestions)) {
    for (const q of systemQuestions) {
      const isMath =
        !q.subject ||
        String(q.subject).toLowerCase().includes('math') ||
        String(q.subject).toLowerCase().includes('toán');
      if (!isMath) continue;
      if (!Array.isArray(q.options) || q.options.length < 4) continue;

      const parsedGrade = Number(q.grade);
      const qGrade: MathGrade =
        parsedGrade === 6 || parsedGrade === 7 || parsedGrade === 8 || parsedGrade === 9
          ? (parsedGrade as MathGrade)
          : 9;

      const ansRaw = String(q.correctAnswer || 'A').trim().toUpperCase();
      let letter: 'A' | 'B' | 'C' | 'D' = 'A';
      if (ansRaw === 'A' || ansRaw === 'B' || ansRaw === 'C' || ansRaw === 'D') {
        letter = ansRaw;
      } else {
        const matchedOpt = q.options.find(
          (opt) => opt.id === q.correctAnswer || opt.label === ansRaw
        );
        if (matchedOpt) letter = matchedOpt.label;
      }

      convertedSystem.push({
        id: `sys-${q.id}`,
        grade: qGrade,
        topic: q.lesson || q.chapter || `Toán ${qGrade}`,
        question: q.stem,
        options: [
          q.options[0].text,
          q.options[1].text,
          q.options[2].text,
          q.options[3].text,
        ],
        correctAnswer: letter,
        explanation: q.explanation || 'Áp dụng kiến thức chuẩn chương trình GDPT 2018.',
        source: 'SYSTEM_BANK',
      });
    }
  }

  const merged = [...CURATED_GDPT2018_MATH_QUESTIONS, ...convertedSystem];
  if (!grade || grade === 'ALL') return merged;
  return merged.filter((q) => q.grade === grade);
}

/**
 * Lưu và đọc kết quả hoạt động học tập trong localStorage
 */
export function loadMathActivityResults(): MathActivityResultRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RESULTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMathActivityResult(record: MathActivityResultRecord): MathActivityResultRecord[] {
  try {
    const existing = loadMathActivityResults();
    const next = [record, ...existing].slice(0, 150);
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(next));
    return next;
  } catch {
    return [record];
  }
}

/**
 * Lưu và đọc hình vẽ / cấu hình thí nghiệm của giáo viên & học sinh
 */
export function loadSavedMathConstructions(toolId?: MathToolId): MathSavedConstruction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONSTRUCTIONS);
    if (!raw) return [];
    const parsed: MathSavedConstruction[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return toolId ? parsed.filter((item) => item.toolId === toolId) : parsed;
  } catch {
    return [];
  }
}

export function saveMathConstruction(item: MathSavedConstruction): MathSavedConstruction[] {
  try {
    const existing = loadSavedMathConstructions();
    const filtered = existing.filter((x) => x.id !== item.id);
    const next = [item, ...filtered].slice(0, 60);
    localStorage.setItem(STORAGE_KEYS.CONSTRUCTIONS, JSON.stringify(next));
    return next;
  } catch {
    return [item];
  }
}

/**
 * Lưu danh sách công cụ truy cập gần đây
 */
export function loadRecentMathTools(): MathToolId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.RECENT_TOOLS);
    if (!raw) return ['M01', 'M02', 'M08', 'M03'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ['M01', 'M02', 'M08', 'M03'];
  } catch {
    return ['M01', 'M02', 'M08', 'M03'];
  }
}

export function recordRecentMathTool(toolId: MathToolId): MathToolId[] {
  try {
    const current = loadRecentMathTools().filter((id) => id !== toolId);
    const next = [toolId, ...current].slice(0, 6);
    localStorage.setItem(STORAGE_KEYS.RECENT_TOOLS, JSON.stringify(next));
    return next;
  } catch {
    return [toolId];
  }
}

/**
 * Quản lý phiên học tập trên lớp (Classroom Session)
 */
export function loadMathClassroomSessions(): MathClassroomSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createMathClassroomSession(params: {
  toolId: MathToolId;
  activityId: string;
  grade: MathGrade;
  classId: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
}): MathClassroomSession {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const session: MathClassroomSession = {
    id: `msess-${Date.now()}`,
    code: `TOAN${params.grade}-${randomDigits}`,
    toolId: params.toolId,
    activityId: params.activityId,
    grade: params.grade,
    classId: params.classId,
    className: params.className,
    teacherId: params.teacherId,
    teacherName: params.teacherName,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    participantCount: 0,
  };
  try {
    const existing = loadMathClassroomSessions();
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([session, ...existing].slice(0, 30)));
  } catch {
    // ignore storage quota errors
  }
  return session;
}

/**
 * Xuất kết quả hoạt động ra chuỗi CSV chuẩn UTF-8 (có BOM cho Excel tiếng Việt)
 */
export function exportMathResultsToCSV(records: MathActivityResultRecord[]): string {
  const headers = [
    'Mã kết quả',
    'Mã công cụ',
    'Hoạt động',
    'Học sinh',
    'Lớp',
    'Điểm số',
    'Điểm tối đa',
    'Số bước đã hoàn thành',
    'Dự đoán ban đầu',
    'Kết luận của học sinh',
    'Thời gian hoàn thành',
  ];
  const escapeCSV = (val: string | number | undefined) => {
    const str = String(val ?? '').replace(/"/g, '""');
    return `"${str}"`;
  };
  const rows = records.map((r) =>
    [
      r.id,
      r.toolId,
      r.activityId,
      r.studentName,
      r.className || 'Tự luyện',
      r.score,
      r.maxScore,
      `${r.completedSteps.length}/6`,
      r.predictionText || '',
      r.conclusionText || '',
      new Date(r.completedAt).toLocaleString('vi-VN'),
    ]
      .map(escapeCSV)
      .join(',')
  );

  return '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\n');
}
