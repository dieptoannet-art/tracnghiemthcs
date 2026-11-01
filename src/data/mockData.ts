import {
  Question,
  ClassRoom,
  ExamMatrix,
  Exam,
  Assignment,
  Submission,
  GeminiAssistantConfig,
  AuditLog,
  StudyDocument
} from '../types';

export const INITIAL_QUESTIONS: Question[] = [
  // --- TOÁN 8 (KNTT / Cánh Diều) ---
  {
    id: 'q-t8-01',
    code: 'TOAN8-GK1-NB01',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Đa thức',
    lesson: 'Bài 1: Đơn thức và đa thức nhiều biến',
    yccd: 'Nhận biết được đơn thức, đơn thức thu gọn, bậc của đơn thức.',
    competency: 'Năng lực tư duy và lập luận toán học',
    level: 'know',
    type: 'single_choice',
    stem: 'Trong các biểu thức sau, biểu thức nào là đơn thức nhiều biến?',
    points: 0.25,
    explanation: 'Biểu thức $2x^2y$ chỉ chứa phép nhân giữa các số và các biến với số mũ nguyên dương, do đó là đơn thức. Các biểu thức còn lại có chứa phép cộng, trừ giữa các biến.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$2x^2y$' },
      { id: 'opt-2', label: 'B', text: '$x^2 + 2y$' },
      { id: 'opt-3', label: 'C', text: '$\\frac{3x}{y}$' },
      { id: 'opt-4', label: 'D', text: '$2x - \\sqrt{y}$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t8-02',
    code: 'TOAN8-GK1-TH02',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Đa thức',
    lesson: 'Bài 2: Các phép toán với đa thức nhiều biến',
    yccd: 'Thực hiện được phép nhân đơn thức với đa thức và nhân đa thức với đa thức.',
    competency: 'Năng lực giải quyết vấn đề toán học',
    level: 'understand',
    type: 'single_choice',
    stem: 'Thu gọn biểu thức $A = 2x(x - 3y) + 6xy$ ta được kết quả là:',
    points: 0.25,
    explanation: 'Ta có: $A = 2x(x - 3y) + 6xy = 2x^2 - 6xy + 6xy = 2x^2$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$2x^2$' },
      { id: 'opt-2', label: 'B', text: '$2x^2 - 12xy$' },
      { id: 'opt-3', label: 'C', text: '$2x^2 + 6xy$' },
      { id: 'opt-4', label: 'D', text: '$2x^2 + 12xy$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t8-03',
    code: 'TOAN8-GK1-TF01',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Đa thức',
    lesson: 'Bài 3: Hằng đẳng thức đáng nhớ',
    yccd: 'Vận dụng các hằng đẳng thức hiệu hai bình phương và bình phương một tổng/hiệu.',
    competency: 'Năng lực tính toán và lập luận',
    level: 'understand',
    type: 'true_false_group',
    stem: 'Cho biểu thức $P(x) = (x - 3)^2 - (x + 2)(x - 2)$. Xét tính Đúng/Sai của các khẳng định sau:',
    points: 1.0,
    explanation: 'Khai triển: $(x - 3)^2 = x^2 - 6x + 9$; $(x + 2)(x - 2) = x^2 - 4$.\nDo đó: $P(x) = (x^2 - 6x + 9) - (x^2 - 4) = -6x + 13$.\n- Ý a: Khai triển $(x-3)^2 = x^2 - 6x + 9$ là Đúng.\n- Ý b: Thu gọn $P(x) = -6x + 13$ là Đúng.\n- Ý c: Tại $x = 2$, $P(2) = -6(2) + 13 = 1$ là Đúng.\n- Ý d: Đa thức $P(x)$ có bậc 2 là Sai (bậc là 1).',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    subItems: [
      { id: 'sub-1', label: 'a', text: 'Khai triển $(x - 3)^2 = x^2 - 6x + 9$.', isCorrect: true, level: 'know', yccd: 'Khai triển bình phương của một hiệu' },
      { id: 'sub-2', label: 'b', text: 'Rút gọn biểu thức ta được $P(x) = -6x + 13$.', isCorrect: true, level: 'understand', yccd: 'Rút gọn đa thức' },
      { id: 'sub-3', label: 'c', text: 'Giá trị của $P(x)$ tại $x = 2$ là bằng $1$.', isCorrect: true, level: 'understand', yccd: 'Tính giá trị biểu thức' },
      { id: 'sub-4', label: 'd', text: '$P(x)$ là một đa thức bậc hai đối với biến $x$.', isCorrect: false, level: 'know', yccd: 'Xác định bậc đa thức' }
    ]
  },
  {
    id: 'q-t8-04',
    code: 'TOAN8-GK1-SA01',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Đa thức',
    lesson: 'Bài 4: Phân tích đa thức thành nhân tử',
    yccd: 'Tìm giá trị của biến thông qua giải phương trình tích đơn giản.',
    competency: 'Năng lực giải quyết vấn đề toán học',
    level: 'apply',
    type: 'short_answer',
    stem: 'Tìm giá trị dương của $x$ thỏa mãn phương trình: $x^2 - 16 = 0$.',
    points: 0.5,
    explanation: 'Ta có $x^2 - 16 = 0 \\iff (x - 4)(x + 4) = 0 \\iff x = 4$ hoặc $x = -4$.\nVì đề bài yêu cầu tìm giá trị dương của $x$ nên ta chọn $x = 4$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    acceptedAnswers: ['4', 'x = 4', 'x=4', '+4'],
    isNumericTolerance: false
  },
  {
    id: 'q-t8-05',
    code: 'TOAN8-GK1-ES01',
    grade: '8',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 3: Tứ giác',
    lesson: 'Bài 10: Tứ giác - Hình bình hành',
    yccd: 'Chứng minh một tứ giác là hình bình hành, tính số đo góc.',
    competency: 'Năng lực tư duy hình học và suy luận logic',
    level: 'apply',
    type: 'essay',
    stem: 'Cho tam giác $ABC$ cân tại $A$. Gọi $M$ là trung điểm của $BC$. Từ $M$ kẻ $MD \\parallel AC$ ($D \\in AB$) và $ME \\parallel AB$ ($E \\in AC$).\na) Chứng minh tứ giác $ADME$ là hình bình hành.\nb) Chứng minh tam giác $MBD$ cân tại $D$.',
    points: 2.0,
    explanation: 'a) Tứ giác $ADME$ có $MD \\parallel AE$ và $ME \\parallel AD$ (theo giả thiết) nên là hình bình hành theo định nghĩa.\nb) Vì $\\triangle ABC$ cân tại $A$ nên $\\widehat{B} = \\widehat{C}$. Vì $MD \\parallel AC$ nên $\\widehat{DMB} = \\widehat{C}$ (hai góc đồng vị). Do đó $\\widehat{B} = \\widehat{DMB} \\implies \\triangle MBD$ cân tại $D$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    sampleAnswer: 'a) Tứ giác ADME có các cạnh đối song song nên là hình bình hành (1.0đ).\nb) Sử dụng tính chất góc đồng vị do MD // AC kết hợp tam giác ABC cân tại A suy ra góc B = góc DMB, kết luận tam giác MBD cân (1.0đ).',
    rubric: [
      { id: 'rb-1', criterion: 'Vẽ hình chính xác, ghi giả thiết kết luận rõ ràng', maxPoints: 0.25 },
      { id: 'rb-2', criterion: 'Chứng minh câu a: Tứ giác ADME là hình bình hành (dấu hiệu các cạnh đối //)', maxPoints: 0.75 },
      { id: 'rb-3', criterion: 'Chứng minh câu b: Chỉ ra góc đồng vị và tam giác MBD cân tại D', maxPoints: 1.0 }
    ]
  },

  // --- TIN HỌC 8 ---
  {
    id: 'q-tin8-01',
    code: 'TIN8-GK1-NB01',
    grade: '8',
    subject: 'informatics',
    textbook: 'Cánh Diều',
    chapter: 'Chủ đề A: Máy tính và cộng đồng',
    lesson: 'Bài 1: Lịch sử phát triển máy tính điện tử',
    yccd: 'Nhận biết các thế hệ máy tính điện tử và thành phần điện tử cốt lõi.',
    competency: 'Năng lực sử dụng công nghệ thông tin',
    level: 'know',
    type: 'single_choice',
    stem: 'Thế hệ máy tính điện tử thứ nhất (1945 - 1955) sử dụng linh kiện điện tử cơ bản nào sau đây?',
    points: 0.25,
    explanation: 'Thế hệ máy tính thứ nhất sử dụng đèn điện tử chân không (chân không tube). Thế hệ thứ 2 dùng bóng bán dẫn (transistor), thế hệ thứ 3 dùng mạch tích hợp (IC), thế hệ thứ 4 dùng vi xử lý (VLSI).',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Đèn điện tử chân không' },
      { id: 'opt-2', label: 'B', text: 'Bóng bán dẫn (Transistor)' },
      { id: 'opt-3', label: 'C', text: 'Mạch tích hợp (IC)' },
      { id: 'opt-4', label: 'D', text: 'Mạch vi xử lý siêu quy mô (VLSI)' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-tin8-02',
    code: 'TIN8-GK1-TH01',
    grade: '8',
    subject: 'informatics',
    textbook: 'Cánh Diều',
    chapter: 'Chủ đề E: Ứng dụng tin học',
    lesson: 'Bài 3: Xử lý dữ liệu với bảng tính điện tử',
    yccd: 'Hiểu và vận dụng hàm tính toán có điều kiện COUNTIF, SUMIF.',
    competency: 'Năng lực ứng dụng CNTT trong học tập',
    level: 'understand',
    type: 'single_choice',
    stem: 'Trong phần mềm bảng tính Excel, công thức `=COUNTIF(B2:B10, ">=8")` thực hiện công việc gì?',
    points: 0.25,
    explanation: 'Hàm COUNTIF đếm số ô thỏa mãn một điều kiện nhất định. Cú pháp COUNTIF(range, criteria) sẽ đếm các ô trong vùng B2:B10 có giá trị lớn hơn hoặc bằng 8.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Đếm số ô có giá trị lớn hơn hoặc bằng 8 trong khối B2:B10' },
      { id: 'opt-2', label: 'B', text: 'Tính tổng các ô có giá trị lớn hơn hoặc bằng 8 trong khối B2:B10' },
      { id: 'opt-3', label: 'C', text: 'Tính trung bình cộng các ô từ B2 đến B10' },
      { id: 'opt-4', label: 'D', text: 'Tìm giá trị lớn nhất trong dãy ô từ B2 đến B10' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-tin8-03',
    code: 'TIN8-GK1-TF01',
    grade: '8',
    subject: 'informatics',
    textbook: 'Cánh Diều',
    chapter: 'Chủ đề B: Mạng máy tính và Internet',
    lesson: 'Bài 2: An toàn thông tin trên không gian mạng',
    yccd: 'Nhận diện các hành vi an toàn và nguy cơ mất an toàn trên mạng xã hội.',
    competency: 'Năng lực đạo đức và pháp luật công nghệ số',
    level: 'understand',
    type: 'true_false_group',
    stem: 'Khi sử dụng mạng xã hội và email, các phát biểu sau đây là Đúng hay Sai về nguyên tắc an toàn?',
    points: 1.0,
    explanation: 'Mật khẩu cần mạnh kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt. Tuyệt đối không bấm vào link lạ hay chia sẻ mã OTP cho bất kỳ ai.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    subItems: [
      { id: 'tin-sub-1', label: 'a', text: 'Nên đặt mật khẩu chứa cả chữ cái, chữ số và ký tự đặc biệt, độ dài từ 8 ký tự trở lên.', isCorrect: true, level: 'know' },
      { id: 'tin-sub-2', label: 'b', text: 'Có thể chia sẻ mã xác thực OTP gửi về điện thoại cho người lạ nếu họ xưng là tổng đài viên hỗ trợ.', isCorrect: false, level: 'understand' },
      { id: 'tin-sub-3', label: 'c', text: 'Nhấp ngay vào các liên kết nhận quà tặng miễn phí được gửi từ các tài khoản không quen biết.', isCorrect: false, level: 'know' },
      { id: 'tin-sub-4', label: 'd', text: 'Bật tính năng xác thực hai yếu tố (2FA) giúp tăng cường bảo mật cho tài khoản cá nhân.', isCorrect: true, level: 'understand' }
    ]
  },
  {
    id: 'q-tin8-04',
    code: 'TIN8-GK1-SA01',
    grade: '8',
    subject: 'informatics',
    textbook: 'Cánh Diều',
    chapter: 'Chủ đề F: Giải quyết vấn đề với sự trợ giúp của máy tính',
    lesson: 'Bài 4: Biểu diễn thuật toán và sơ đồ khối',
    yccd: 'Xác định giá trị đầu ra của thuật toán lặp.',
    competency: 'Năng lực tư duy thuật toán',
    level: 'apply',
    type: 'short_answer',
    stem: 'Cho đoạn chương trình mô phỏng thuật toán:\n```\nS = 0\nCho i chạy từ 1 đến 4:\n    S = S + i * 2\nIn ra giá trị của S\n```\nSau khi thực hiện xong, giá trị cuối cùng in ra của $S$ là bao nhiêu?',
    points: 0.5,
    explanation: 'Với i = 1: S = 0 + 2 = 2\nVới i = 2: S = 2 + 4 = 6\nVới i = 3: S = 6 + 6 = 12\nVới i = 4: S = 12 + 8 = 20.\nKết quả cuối cùng là 20.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    acceptedAnswers: ['20', 'S = 20', 'S=20'],
    isNumericTolerance: false
  },

  // --- TOÁN 6 ---
  {
    id: 'q-t6-01',
    code: 'TOAN6-GK1-NB01',
    grade: '6',
    subject: 'math',
    textbook: 'Cánh Diều',
    chapter: 'Chương 1: Số tự nhiên',
    lesson: 'Bài 1: Tập hợp số tự nhiên',
    yccd: 'Nhận biết các phần tử thuộc hoặc không thuộc tập hợp.',
    competency: 'Năng lực tư duy và lập luận toán học',
    level: 'know',
    type: 'single_choice',
    stem: 'Cho tập hợp $M = \\{x \\in \\mathbb{N} \\mid 5 < x \\le 9\\}$. Khẳng định nào sau đây là đúng?',
    points: 0.25,
    explanation: 'Tập hợp $M$ gồm các số tự nhiên lớn hơn 5 và nhỏ hơn hoặc bằng 9: $M = \\{6; 7; 8; 9\\}$. Do đó $5 \\notin M$, $9 \\in M$, $10 \\notin M$.',
    status: 'approved',
    author: 'Cô Lê Thị Mai',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$9 \\in M$' },
      { id: 'opt-2', label: 'B', text: '$5 \\in M$' },
      { id: 'opt-3', label: 'C', text: '$10 \\in M$' },
      { id: 'opt-4', label: 'D', text: '$4 \\in M$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t6-02',
    code: 'TOAN6-GK1-TH01',
    grade: '6',
    subject: 'math',
    textbook: 'Cánh Diều',
    chapter: 'Chương 1: Số tự nhiên',
    lesson: 'Bài 4: Phép nhân và phép chia số tự nhiên',
    yccd: 'Thực hiện phép tính lũy thừa với số mũ tự nhiên.',
    competency: 'Năng lực tính toán',
    level: 'understand',
    type: 'single_choice',
    stem: 'Viết tích $3^4 \\cdot 3^2$ dưới dạng một lũy thừa ta được:',
    points: 0.25,
    explanation: 'Áp dụng quy tắc nhân hai lũy thừa cùng cơ số: $a^m \\cdot a^n = a^{m+n}$. Do đó $3^4 \\cdot 3^2 = 3^{4+2} = 3^6$.',
    status: 'approved',
    author: 'Cô Lê Thị Mai',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$3^6$' },
      { id: 'opt-2', label: 'B', text: '$3^8$' },
      { id: 'opt-3', label: 'C', text: '$9^6$' },
      { id: 'opt-4', label: 'D', text: '$9^8$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t6-03',
    code: 'TOAN6-GK1-TF01',
    grade: '6',
    subject: 'math',
    textbook: 'Cánh Diều',
    chapter: 'Chương 1: Số tự nhiên',
    lesson: 'Bài 8: Dấu hiệu chia hết cho 2, cho 5, cho 3, cho 9',
    yccd: 'Nhận biết và vận dụng dấu hiệu chia hết của số tự nhiên.',
    competency: 'Năng lực lập luận toán học',
    level: 'understand',
    type: 'true_false_group',
    stem: 'Xét số tự nhiên $A = 2025$. Đánh giá tính Đúng/Sai của các mệnh đề sau:',
    points: 1.0,
    explanation: '- $A = 2025$ có chữ số tận cùng là 5 nên chia hết cho 5, không chia hết cho 2.\n- Tổng các chữ số: $2 + 0 + 2 + 5 = 9$, chia hết cho cả 3 và 9.',
    status: 'approved',
    author: 'Cô Lê Thị Mai',
    version: 1,
    subItems: [
      { id: 't6-sub-1', label: 'a', text: 'Số $A$ chia hết cho 2.', isCorrect: false, level: 'know' },
      { id: 't6-sub-2', label: 'b', text: 'Số $A$ chia hết cho 5.', isCorrect: true, level: 'know' },
      { id: 't6-sub-3', label: 'c', text: 'Số $A$ chia hết cho cả 3 và 9.', isCorrect: true, level: 'understand' },
      { id: 't6-sub-4', label: 'd', text: 'Số $A$ là một số nguyên tố.', isCorrect: false, level: 'understand' }
    ]
  },
  {
    id: 'q-t6-04',
    code: 'TOAN6-GK1-SA01',
    grade: '6',
    subject: 'math',
    textbook: 'Cánh Diều',
    chapter: 'Chương 1: Số tự nhiên',
    lesson: 'Bài 11: Ước chung lớn nhất và bội chung nhỏ nhất',
    yccd: 'Tính ƯCLN của hai số tự nhiên.',
    competency: 'Năng lực giải quyết vấn đề toán học',
    level: 'apply',
    type: 'short_answer',
    stem: 'Tìm ước chung lớn nhất của hai số $24$ và $36$. Viết kết quả dưới dạng số tự nhiên.',
    points: 0.5,
    explanation: 'Ta có $24 = 2^3 \\cdot 3$ và $36 = 2^2 \\cdot 3^2$.\nƯCLN(24, 36) = $2^2 \\cdot 3 = 4 \\cdot 3 = 12$.',
    status: 'approved',
    author: 'Cô Lê Thị Mai',
    version: 1,
    acceptedAnswers: ['12', 'ƯCLN = 12', 'UCLN = 12'],
    isNumericTolerance: false
  },

  // --- TOÁN 7 ---
  {
    id: 'q-t7-01',
    code: 'TOAN7-GK1-NB01',
    grade: '7',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Số hữu tỉ',
    lesson: 'Bài 1: Tập hợp các số hữu tỉ',
    yccd: 'Nhận biết số hữu tỉ và biểu diễn số hữu tỉ.',
    competency: 'Năng lực tư duy toán học',
    level: 'know',
    type: 'single_choice',
    stem: 'Số đối của số hữu tỉ $-\\frac{3}{5}$ là:',
    points: 0.25,
    explanation: 'Hai số đối nhau có tổng bằng 0. Số đối của $-\\frac{3}{5}$ là $\\frac{3}{5}$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$\\frac{3}{5}$' },
      { id: 'opt-2', label: 'B', text: '$-\\frac{5}{3}$' },
      { id: 'opt-3', label: 'C', text: '$\\frac{5}{3}$' },
      { id: 'opt-4', label: 'D', text: '$-\\frac{3}{5}$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t7-02',
    code: 'TOAN7-GK1-TH01',
    grade: '7',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 3: Góc và đường thẳng song song',
    lesson: 'Bài 8: Định lí và chứng minh định lí',
    yccd: 'Hiểu tính chất hai đường thẳng song song bị cắt bởi một cát tuyến.',
    competency: 'Năng lực suy luận logic',
    level: 'understand',
    type: 'single_choice',
    stem: 'Cho hai đường thẳng song song $a$ và $b$. Đường thẳng $c$ cắt $a$ và $b$ lần lượt tại $A$ và $B$. Biết $\\widehat{A_1} = 65^\\circ$. Số đo góc so le trong với $\\widehat{A_1}$ tại đỉnh $B$ là:',
    points: 0.25,
    explanation: 'Nếu một đường thẳng cắt hai đường thẳng song song thì hai góc so le trong bằng nhau. Do đó góc so le trong bằng $65^\\circ$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$65^\\circ$' },
      { id: 'opt-2', label: 'B', text: '$115^\\circ$' },
      { id: 'opt-3', label: 'C', text: '$180^\\circ$' },
      { id: 'opt-4', label: 'D', text: '$25^\\circ$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t7-03',
    code: 'TOAN7-GK1-SA01',
    grade: '7',
    subject: 'math',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Số hữu tỉ',
    lesson: 'Bài 2: Các phép tính với số hữu tỉ',
    yccd: 'Tính toán giá trị biểu thức số hữu tỉ.',
    competency: 'Năng lực giải quyết vấn đề toán học',
    level: 'understand',
    type: 'short_answer',
    stem: 'Tính giá trị của biểu thức: $M = \\left(-\\frac{1}{2}\\right)^2 + \\frac{3}{4}$. Nhập kết quả dưới dạng số nguyên.',
    points: 0.5,
    explanation: 'Ta có $\\left(-\\frac{1}{2}\\right)^2 = \\frac{1}{4}$.\n$M = \\frac{1}{4} + \\frac{3}{4} = \\frac{4}{4} = 1$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    acceptedAnswers: ['1', 'M = 1', 'M=1'],
    isNumericTolerance: false
  },

  // --- TOÁN 9 ---
  {
    id: 'q-t9-01',
    code: 'TOAN9-GK1-NB01',
    grade: '9',
    subject: 'math',
    textbook: 'Chân trời sáng tạo',
    chapter: 'Chương 1: Phương trình và hệ hai phương trình bậc nhất hai ẩn',
    lesson: 'Bài 1: Phương trình bậc nhất hai ẩn',
    yccd: 'Nhận biết phương trình bậc nhất hai ẩn.',
    competency: 'Năng lực tư duy toán học',
    level: 'know',
    type: 'single_choice',
    stem: 'Phương trình nào dưới đây là phương trình bậc nhất hai ẩn $x, y$?',
    points: 0.25,
    explanation: 'Phương trình bậc nhất hai ẩn có dạng $ax + by = c$ với $a, b$ không đồng thời bằng 0 và các biến có số mũ là 1. Do đó $2x - 3y = 5$ là phương trình bậc nhất hai ẩn.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$2x - 3y = 5$' },
      { id: 'opt-2', label: 'B', text: '$x^2 + y = 1$' },
      { id: 'opt-3', label: 'C', text: '$2x + 3y^2 = 0$' },
      { id: 'opt-4', label: 'D', text: '$\\frac{1}{x} + y = 3$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t9-02',
    code: 'TOAN9-GK1-TH01',
    grade: '9',
    subject: 'math',
    textbook: 'Chân trời sáng tạo',
    chapter: 'Chương 3: Căn bậc hai và căn bậc ba',
    lesson: 'Bài 1: Căn bậc hai',
    yccd: 'Tìm điều kiện xác định của biểu thức chứa căn bậc hai.',
    competency: 'Năng lực suy luận toán học',
    level: 'understand',
    type: 'single_choice',
    stem: 'Biểu thức $\\sqrt{2x - 6}$ xác định khi và chỉ khi:',
    points: 0.25,
    explanation: 'Biểu thức $\\sqrt{A}$ xác định khi $A \\ge 0$. Do đó $2x - 6 \\ge 0 \\iff 2x \\ge 6 \\iff x \\ge 3$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: '$x \\ge 3$' },
      { id: 'opt-2', label: 'B', text: '$x > 3$' },
      { id: 'opt-3', label: 'C', text: '$x \\le 3$' },
      { id: 'opt-4', label: 'D', text: '$x \\ge -3$' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-t9-03',
    code: 'TOAN9-GK1-TF01',
    grade: '9',
    subject: 'math',
    textbook: 'Chân trời sáng tạo',
    chapter: 'Chương 1: Phương trình và hệ phương trình',
    lesson: 'Bài 2: Hệ hai phương trình bậc nhất hai ẩn',
    yccd: 'Giải hệ phương trình bằng phương pháp thế hoặc cộng đại số.',
    competency: 'Năng lực mô hình hóa toán học',
    level: 'understand',
    type: 'true_false_group',
    stem: 'Cho hệ phương trình: $\\begin{cases} x + y = 5 \\\\ 2x - y = 1 \\end{cases}$. Xét tính Đúng/Sai của các phát biểu:',
    points: 1.0,
    explanation: 'Cộng hai phương trình vế theo vế: $3x = 6 \\implies x = 2$. Thay vào $x + y = 5 \\implies y = 3$.\nNghiệm duy nhất $(x; y) = (2; 3)$. Tổng $x + y = 5$, tích $xy = 6$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    subItems: [
      { id: 't9-sub-1', label: 'a', text: 'Hệ phương trình có nghiệm duy nhất $(x; y) = (2; 3)$.', isCorrect: true, level: 'understand' },
      { id: 't9-sub-2', label: 'b', text: 'Cặp số $(x; y) = (3; 2)$ là một nghiệm của hệ.', isCorrect: false, level: 'know' },
      { id: 't9-sub-3', label: 'c', text: 'Tích $x \\cdot y$ của nghiệm hệ phương trình bằng $6$.', isCorrect: true, level: 'understand' },
      { id: 't9-sub-4', label: 'd', text: 'Hệ phương trình vô nghiệm.', isCorrect: false, level: 'know' }
    ]
  },
  {
    id: 'q-t9-04',
    code: 'TOAN9-GK1-ES01',
    grade: '9',
    subject: 'math',
    textbook: 'Chân trời sáng tạo',
    chapter: 'Chương 4: Hệ thức lượng trong tam giác vuông',
    lesson: 'Bài 1: Tỉ số lượng giác của góc nhọn',
    yccd: 'Vận dụng hệ thức lượng và tỉ số lượng giác để tính độ dài cạnh và chiều cao thực tế.',
    competency: 'Năng lực mô hình hóa và giải quyết vấn đề toán học',
    level: 'apply',
    type: 'essay',
    stem: 'Một người đứng ở vị trí $A$ trên mặt đất cách chân tháp hải đăng một khoảng $BC = 45\\text{ m}$. Dùng giác kế người đó đo được góc nâng từ điểm quan sát đến đỉnh tháp là $35^\\circ$. Biết chiều cao từ mặt đất đến mắt quan sát là $1,5\\text{ m}$.\na) Hãy vẽ hình mô tả tình huống và tính chiều cao của tháp hải đăng (làm tròn đến mét).\nb) Nêu ý nghĩa thực tiễn của phương pháp đo góc gián tiếp này.',
    points: 2.0,
    explanation: 'Gọi chiều cao tháp là $h$. Đoạn từ mắt quan sát đến đỉnh tháp: $h_1 = 45 \\cdot \\tan(35^\\circ) \\approx 45 \\cdot 0,7002 \\approx 31,51\\text{ m}$.\nTổng chiều cao tháp: $h = h_1 + 1,5 = 31,51 + 1,5 = 33,01\\text{ m} \\approx 33\\text{ m}$.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    sampleAnswer: 'a) Vẽ hình đúng (0.5đ). Tính cạnh góc vuông theo góc tan: h1 = 45 * tan(35) = 31.5m (0.75đ). Cộng thêm chiều cao mắt người 1.5m ra kết quả 33m (0.5đ).\nb) Nêu được ý nghĩa đo gián tiếp các công trình cao mà không cần trèo lên đo trực tiếp (0.25đ).',
    rubric: [
      { id: 'rb-t9-1', criterion: 'Vẽ sơ đồ hình học, đặt đúng các đỉnh tam giác vuông và số liệu', maxPoints: 0.5 },
      { id: 'rb-t9-2', criterion: 'Vận dụng đúng tỉ số tan trong tam giác vuông để tính cạnh đối', maxPoints: 0.75 },
      { id: 'rb-t9-3', criterion: 'Cộng chiều cao giác kế và làm tròn đáp số theo yêu cầu đề bài (33 m)', maxPoints: 0.5 },
      { id: 'rb-t9-4', criterion: 'Nhận xét thực tiễn về ứng dụng đo đạc gián tiếp', maxPoints: 0.25 }
    ]
  },

  // --- KHOA HỌC TỰ NHIÊN 8 ---
  {
    id: 'q-khtn8-01',
    code: 'KHTN8-GK1-NB01',
    grade: '8',
    subject: 'science',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Phản ứng hóa học',
    lesson: 'Bài 2: Biến đổi vật lí và biến đổi hóa học',
    yccd: 'Phân biệt hiện tượng vật lí và hiện tượng hóa học.',
    competency: 'Năng lực nhận thức khoa học tự nhiên',
    level: 'know',
    type: 'single_choice',
    stem: 'Hiện tượng nào sau đây là hiện tượng hóa học?',
    points: 0.25,
    explanation: 'Cơm để lâu bị ôi thiu có sự biến đổi chất tạo thành chất mới có mùi chua, đó là biến đổi hóa học. Nước đá tan, cồn bay hơi, bẻ gập đinh sắt chỉ là biến đổi trạng thái hoặc hình dạng (vật lí).',
    status: 'approved',
    author: 'Cô Nguyễn Thu Hà',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Cơm để lâu ngoài không khí bị ôi thiu' },
      { id: 'opt-2', label: 'B', text: 'Nước đá để ở nhiệt độ phòng bị tan chảy' },
      { id: 'opt-3', label: 'C', text: 'Cồn y tế để trong lọ mở nắp bị bay hơi' },
      { id: 'opt-4', label: 'D', text: 'Bẻ cong một thanh kim loại' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-khtn8-02',
    code: 'KHTN8-GK1-TH01',
    grade: '8',
    subject: 'science',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Phản ứng hóa học',
    lesson: 'Bài 5: Định luật bảo toàn khối lượng và phương trình hóa học',
    yccd: 'Vận dụng định luật bảo toàn khối lượng để tính khối lượng chất phản ứng hoặc sản phẩm.',
    competency: 'Năng lực tìm hiểu tự nhiên',
    level: 'understand',
    type: 'short_answer',
    stem: 'Đốt cháy hoàn toàn $6\\text{ gam}$ magie (Mg) trong khí oxi ($O_2$) thu được $10\\text{ gam}$ magie oxit (MgO). Khối lượng khí oxi đã tham gia phản ứng là bao nhiêu gam?',
    points: 0.5,
    explanation: 'Theo định luật bảo toàn khối lượng:\n$m_{\\text{Mg}} + m_{O_2} = m_{\\text{MgO}}$\n$\\implies m_{O_2} = 10 - 6 = 4\\text{ gam}$.',
    status: 'approved',
    author: 'Cô Nguyễn Thu Hà',
    version: 1,
    acceptedAnswers: ['4', '4 gam', '4g', '4 gram'],
    isNumericTolerance: false
  },

  // --- NGỮ VĂN 8 ---
  {
    id: 'q-van8-01',
    code: 'VAN8-GK1-NB01',
    grade: '8',
    subject: 'literature',
    textbook: 'Kết nối tri thức',
    chapter: 'Bài 1: Gương mặt thân yêu',
    lesson: 'Tri thức tiếng Việt: Từ tượng hình và từ tượng thanh',
    yccd: 'Nhận biết đặc điểm và tác dụng của từ tượng thanh, từ tượng hình.',
    competency: 'Năng lực ngôn ngữ',
    level: 'know',
    type: 'single_choice',
    stem: 'Từ nào sau đây là từ tượng hình gợi tả dáng vẻ của con người?',
    points: 0.25,
    explanation: '"Lom khom" là từ tượng hình mô tả dáng dấp còng xuống, thấp xuống của người già hoặc người đang gồng gánh.',
    status: 'approved',
    author: 'Thầy Trần Văn Bình',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Lom khom' },
      { id: 'opt-2', label: 'B', text: 'Róc rách' },
      { id: 'opt-3', label: 'C', text: 'Ào ào' },
      { id: 'opt-4', label: 'D', text: 'Râm ran' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-van8-02',
    code: 'VAN8-GK1-TF01',
    grade: '8',
    subject: 'literature',
    textbook: 'Kết nối tri thức',
    chapter: 'Bài 1: Gương mặt thân yêu',
    lesson: 'Văn bản: Lão Hạc (Nam Cao)',
    yccd: 'Cảm nhận tình cảm và phẩm chất cao đẹp của nhân vật Lão Hạc.',
    competency: 'Năng lực thẩm mĩ văn học',
    level: 'understand',
    type: 'true_false_group',
    stem: 'Nhận xét về nhân vật Lão Hạc trong truyện ngắn cùng tên của nhà văn Nam Cao, các ý sau Đúng hay Sai?',
    points: 1.0,
    explanation: 'Lão Hạc là người nông dân nghèo khổ nhưng giàu lòng tự trọng và tình yêu thương con vô bờ bến. Lão thà chọn cái chết dữ dội để giữ lại mảnh vườn cho con trai chứ quyết không tiêu lạm vào tiền dưỡng già của con.',
    status: 'approved',
    author: 'Thầy Trần Văn Bình',
    version: 1,
    subItems: [
      { id: 'van-sub-1', label: 'a', text: 'Lão Hạc bán con chó Vàng vì lão quá túng thiếu và không còn tiền nuôi nó.', isCorrect: true, level: 'know' },
      { id: 'van-sub-2', label: 'b', text: 'Lão Hạc đã tiêu hết số tiền dành dụm sau khi bán con Vàng để mua đồ ăn ngon cho bản thân.', isCorrect: false, level: 'understand' },
      { id: 'van-sub-3', label: 'c', text: 'Cái chết của Lão Hạc thể hiện đức hy sinh cao cả và lòng tự trọng vô ngần của người nông dân nghèo.', isCorrect: true, level: 'understand' },
      { id: 'van-sub-4', label: 'd', text: 'Lão Hạc đã gửi tiền và mảnh vườn cho ông giáo để giữ gìn cho con trai khi anh đi đồn điền cao su trở về.', isCorrect: true, level: 'know' }
    ]
  },

  // --- TIẾNG ANH 8 ---
  {
    id: 'q-eng8-01',
    code: 'ENG8-GK1-NB01',
    grade: '8',
    subject: 'english',
    textbook: 'Kết nối tri thức',
    chapter: 'Unit 1: Leisure Time',
    lesson: 'A Closer Look 1: Vocabulary & Grammar',
    yccd: 'Recognize verbs of liking followed by gerunds (V-ing).',
    competency: 'Language competence (Grammar)',
    level: 'know',
    type: 'single_choice',
    stem: 'My brother is crazy about ______ football with his friends after school.',
    points: 0.25,
    explanation: 'Cụm từ "crazy about" đi kèm giới từ "about", do đó động từ theo sau phải ở dạng V-ing (playing).',
    status: 'approved',
    author: 'Cô Hoàng Thu Thảo',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'playing' },
      { id: 'opt-2', label: 'B', text: 'play' },
      { id: 'opt-3', label: 'C', text: 'played' },
      { id: 'opt-4', label: 'D', text: 'to play' }
    ],
    correctAnswer: 'A'
  },
  {
    id: 'q-eng8-02',
    code: 'ENG8-GK1-SA01',
    grade: '8',
    subject: 'english',
    textbook: 'Kết nối tri thức',
    chapter: 'Unit 2: Life in the Countryside',
    lesson: 'A Closer Look 2: Comparative Adverbs',
    yccd: 'Use comparative form of adverbs correctly.',
    competency: 'Language competence (Writing)',
    level: 'understand',
    type: 'short_answer',
    stem: 'Fill in the blank with the correct comparative form of the adverb in bracket:\n"A horse can run _________ than a buffalo." (fast)',
    points: 0.5,
    explanation: 'Trạng từ "fast" là trạng từ ngắn đặc biệt, dạng so sánh hơn là "faster".',
    status: 'approved',
    author: 'Cô Hoàng Thu Thảo',
    version: 1,
    acceptedAnswers: ['faster', 'Faster'],
    isNumericTolerance: false
  },

  // --- LỊCH SỬ & ĐỊA LÍ 8 ---
  {
    id: 'q-ls8-01',
    code: 'LS8-GK1-NB01',
    grade: '8',
    subject: 'history_geo',
    textbook: 'Chân trời sáng tạo',
    chapter: 'Chương 1: Cách mạng tư sản',
    lesson: 'Bài 1: Các cuộc cách mạng tư sản thời cận đại',
    yccd: 'Nhận biết thời gian và khẩu hiệu của Tuyên ngôn Nhân quyền và Dân quyền.',
    competency: 'Năng lực tìm hiểu lịch sử',
    level: 'know',
    type: 'single_choice',
    stem: 'Khẩu hiệu nổi tiếng "Tự do - Bình đẳng - Bác ái" bắt nguồn từ cuộc cách mạng tư sản nào?',
    points: 0.25,
    explanation: 'Khẩu hiệu "Tự do - Bình đẳng - Bác ái" (Liberté, Égalité, Fraternité) bắt nguồn từ cuộc Cách mạng tư sản Pháp cuối thế kỉ XVIII (1789).',
    status: 'approved',
    author: 'Thầy Võ Hoàng Long',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Cách mạng tư sản Pháp' },
      { id: 'opt-2', label: 'B', text: 'Cách mạng tư sản Anh' },
      { id: 'opt-3', label: 'C', text: 'Chiến tranh giành độc lập của các thuộc địa Anh ở Bắc Mĩ' },
      { id: 'opt-4', label: 'D', text: 'Cách mạng Tân Hợi (Trung Quốc)' }
    ],
    correctAnswer: 'A'
  },

  // --- CÔNG NGHỆ 8 ---
  {
    id: 'q-cn8-01',
    code: 'CN8-GK1-NB01',
    grade: '8',
    subject: 'technology',
    textbook: 'Kết nối tri thức',
    chapter: 'Chương 1: Vẽ kĩ thuật',
    lesson: 'Bài 1: Khái niệm và vai trò của bản vẽ kĩ thuật',
    yccd: 'Nhận biết các hình chiếu vuông góc cơ bản.',
    competency: 'Năng lực công nghệ',
    level: 'know',
    type: 'single_choice',
    stem: 'Trong phương pháp chiếu vuông góc, hình chiếu bằng có hướng chiếu từ đâu đến?',
    points: 0.25,
    explanation: 'Hình chiếu đứng có hướng chiếu từ trước tới; hình chiếu bằng có hướng chiếu từ trên xuống; hình chiếu cạnh có hướng chiếu từ trái sang.',
    status: 'approved',
    author: 'Thầy Diệp Thanh Toàn',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Từ trên xuống' },
      { id: 'opt-2', label: 'B', text: 'Từ trước tới' },
      { id: 'opt-3', label: 'C', text: 'Từ trái sang' },
      { id: 'opt-4', label: 'D', text: 'Từ phải sang' }
    ],
    correctAnswer: 'A'
  },

  // --- GDCD 8 ---
  {
    id: 'q-gdcd8-01',
    code: 'GDCD8-GK1-NB01',
    grade: '8',
    subject: 'civics',
    textbook: 'Cánh Diều',
    chapter: 'Chủ đề 1: Tự hào về truyền thống dân tộc',
    lesson: 'Bài 1: Tự hào về truyền thống dân tộc Việt Nam',
    yccd: 'Nhận biết các truyền thống tốt đẹp của dân tộc.',
    competency: 'Năng lực điều chỉnh hành vi và công dân',
    level: 'know',
    type: 'single_choice',
    stem: 'Hành vi nào sau đây thể hiện niềm tự hào và gìn giữ truyền thống dân tộc?',
    points: 0.25,
    explanation: 'Tích cực tham gia và quảng bá các lễ hội văn hóa truyền thống, học hỏi các giá trị đạo đức dân tộc thể hiện tinh thần giữ gìn và phát huy truyền thống.',
    status: 'approved',
    author: 'Cô Đặng Thị Hạnh',
    version: 1,
    options: [
      { id: 'opt-1', label: 'A', text: 'Tích cực tham gia tìm hiểu các làn điệu dân ca và trò chơi dân gian' },
      { id: 'opt-2', label: 'B', text: 'Chê bai trang phục áo dài truyền thống là lỗi thời' },
      { id: 'opt-3', label: 'C', text: 'Xa lánh các di tích lịch sử địa phương' },
      { id: 'opt-4', label: 'D', text: 'Chỉ chuộng văn hóa ngoại lai mà xem nhẹ văn hóa cội nguồn' }
    ],
    correctAnswer: 'A'
  }
];

export const INITIAL_CLASSES: ClassRoom[] = [
  {
    id: 'cls-8a1',
    name: 'Lớp 8A1',
    grade: '8',
    teacherName: 'Diệp Thanh Toàn',
    studentCount: 38,
    inviteCode: 'TAYDO-8A1-2026',
    students: [
      { id: 'stu-01', code: 'HS80101', fullName: 'Nguyễn Văn An', email: 'an.nv@taydo.edu.vn', gender: 'Nam' },
      { id: 'stu-02', code: 'HS80102', fullName: 'Trần Thị Bích', email: 'bich.tt@taydo.edu.vn', gender: 'Nữ' },
      { id: 'stu-03', code: 'HS80103', fullName: 'Lê Hoàng Cường', email: 'cuong.lh@taydo.edu.vn', gender: 'Nam' },
      { id: 'stu-04', code: 'HS80104', fullName: 'Phạm Thị Duyên', email: 'duyen.pt@taydo.edu.vn', gender: 'Nữ' },
      { id: 'stu-05', code: 'HS80105', fullName: 'Đỗ Minh Đức', email: 'duc.dm@taydo.edu.vn', gender: 'Nam' }
    ]
  },
  {
    id: 'cls-7a2',
    name: 'Lớp 7A2',
    grade: '7',
    teacherName: 'Diệp Thanh Toàn',
    studentCount: 36,
    inviteCode: 'TAYDO-7A2-2026',
    students: [
      { id: 'stu-701', code: 'HS70201', fullName: 'Vũ Đức Hải', email: 'hai.vd@taydo.edu.vn', gender: 'Nam' },
      { id: 'stu-702', code: 'HS70202', fullName: 'Ngô Thanh Hương', email: 'huong.nt@taydo.edu.vn', gender: 'Nữ' }
    ]
  },
  {
    id: 'cls-6a1',
    name: 'Lớp 6A1',
    grade: '6',
    teacherName: 'Lê Thị Mai',
    studentCount: 40,
    inviteCode: 'TAYDO-6A1-2026',
    students: [
      { id: 'stu-601', code: 'HS60101', fullName: 'Bùi Gia Khang', email: 'khang.bg@taydo.edu.vn', gender: 'Nam' },
      { id: 'stu-602', code: 'HS60102', fullName: 'Đặng Ngọc Lan', email: 'lan.dn@taydo.edu.vn', gender: 'Nữ' }
    ]
  },
  {
    id: 'cls-9a3',
    name: 'Lớp 9A3',
    grade: '9',
    teacherName: 'Diệp Thanh Toàn',
    studentCount: 35,
    inviteCode: 'TAYDO-9A3-2026',
    students: [
      { id: 'stu-901', code: 'HS90301', fullName: 'Phan Minh Quang', email: 'quang.pm@taydo.edu.vn', gender: 'Nam' }
    ]
  }
];

export const INITIAL_MATRICES: ExamMatrix[] = [
  {
    id: 'mtx-toan8-gk1',
    title: 'Ma trận kiểm tra Giữa học kỳ I - Toán 8 (Năm học 2025 - 2026)',
    grade: '8',
    subject: 'math',
    period: 'mid1',
    schoolYear: '2025 - 2026',
    durationMinutes: 60,
    totalPoints: 10.0,
    cognitiveRatio: {
      knowPercent: 40,
      understandPercent: 40,
      applyPercent: 20
    },
    rows: [
      {
        id: 'mr-1',
        topic: 'Đơn thức và đa thức nhiều biến',
        unit: 'Đơn thức, đa thức nhiều biến; các phép toán cộng trừ nhân',
        yccd: 'Nhận biết đơn thức, bậc; thực hiện nhân đơn thức với đa thức',
        questionType: 'single_choice',
        knowCount: 2,
        knowPoints: 0.5,
        understandCount: 2,
        understandPoints: 0.5,
        applyCount: 0,
        applyPoints: 0
      },
      {
        id: 'mr-2',
        topic: 'Hằng đẳng thức đáng nhớ',
        unit: '7 Hằng đẳng thức và ứng dụng phân tích nhân tử',
        yccd: 'Vận dụng hằng đẳng thức khai triển và thu gọn đa thức',
        questionType: 'true_false_group',
        knowCount: 1, // ý Biết
        knowPoints: 0.25,
        understandCount: 2, // 2 ý Hiểu
        understandPoints: 0.5,
        applyCount: 1, // 1 ý Vận dụng
        applyPoints: 0.25
      },
      {
        id: 'mr-3',
        topic: 'Phân tích đa thức thành nhân tử',
        unit: 'Phương pháp đặt nhân tử chung, hằng đẳng thức, nhóm hạng tử',
        yccd: 'Tìm x và rút gọn biểu thức đại số',
        questionType: 'short_answer',
        knowCount: 0,
        knowPoints: 0,
        understandCount: 1,
        understandPoints: 0.5,
        applyCount: 1,
        applyPoints: 0.5
      },
      {
        id: 'mr-4',
        topic: 'Tứ giác - Hình thang cân - Hình bình hành',
        unit: 'Định nghĩa, tính chất và dấu hiệu nhận biết hình bình hành',
        yccd: 'Chứng minh hình học và vận dụng tính chất đối xứng, góc đồng vị',
        questionType: 'essay',
        knowCount: 0,
        knowPoints: 0,
        understandCount: 1,
        understandPoints: 1.0,
        applyCount: 1,
        applyPoints: 1.0
      }
    ]
  }
];

export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam-toan8-gk1-101',
    code: 'ĐỀ 101 - TOÁN 8 GK1',
    title: 'Kiểm tra Giữa học kỳ I - Môn Toán 8',
    grade: '8',
    subject: 'math',
    period: 'mid1',
    durationMinutes: 45,
    totalPoints: 10.0,
    author: 'Thầy Diệp Thanh Toàn',
    createdAt: '2026-10-15',
    questions: [
      INITIAL_QUESTIONS[0], // q-t8-01: Biết trắc nghiệm
      INITIAL_QUESTIONS[1], // q-t8-02: Hiểu trắc nghiệm
      INITIAL_QUESTIONS[2], // q-t8-03: Đúng sai 4 ý
      INITIAL_QUESTIONS[3], // q-t8-04: Trả lời ngắn
      INITIAL_QUESTIONS[4]  // q-t8-05: Tự luận 2 điểm
    ]
  },
  {
    id: 'exam-tin8-gk1-101',
    code: 'ĐỀ 101 - TIN HỌC 8 GK1',
    title: 'Kiểm tra Giữa học kỳ I - Tin học 8',
    grade: '8',
    subject: 'informatics',
    period: 'mid1',
    durationMinutes: 45,
    totalPoints: 10.0,
    author: 'Thầy Diệp Thanh Toàn',
    createdAt: '2026-10-18',
    questions: [
      INITIAL_QUESTIONS[5], // q-tin8-01
      INITIAL_QUESTIONS[6], // q-tin8-02
      INITIAL_QUESTIONS[7], // q-tin8-03 (TF)
      INITIAL_QUESTIONS[8]  // q-tin8-04 (Short answer)
    ]
  }
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-01',
    examId: 'exam-toan8-gk1-101',
    examTitle: 'Kiểm tra Giữa học kỳ I - Môn Toán 8 (Chính thức)',
    classId: 'cls-8a1',
    className: 'Lớp 8A1',
    grade: '8',
    subject: 'math',
    openTime: '2026-10-20 07:00',
    closeTime: '2026-11-15 23:59',
    durationMinutes: 45,
    attemptsAllowed: 2,
    allowReview: true,
    showSolutionAfterSubmit: true,
    shuffleQuestions: true,
    shuffleOptions: true,
    isComputerLabMode: false,
    status: 'active'
  },
  {
    id: 'asg-02',
    examId: 'exam-tin8-gk1-101',
    examTitle: 'Kiểm tra Thực hành Tin học 8 - Khối 8',
    classId: 'cls-8a1',
    className: 'Lớp 8A1',
    grade: '8',
    subject: 'informatics',
    openTime: '2026-10-22 08:00',
    closeTime: '2026-11-20 18:00',
    durationMinutes: 40,
    attemptsAllowed: 1,
    allowReview: true,
    showSolutionAfterSubmit: false,
    shuffleQuestions: false,
    shuffleOptions: true,
    isComputerLabMode: true,
    status: 'active'
  }
];

export const INITIAL_SUBMISSIONS: Submission[] = [
  {
    id: 'sub-demo-01',
    assignmentId: 'asg-01',
    examId: 'exam-toan8-gk1-101',
    examTitle: 'Kiểm tra Giữa học kỳ I - Môn Toán 8',
    studentId: 'stu-01',
    studentName: 'Nguyễn Văn An',
    studentClass: 'Lớp 8A1',
    grade: '8',
    subject: 'math',
    startTime: '2026-10-25 08:00',
    submittedAt: '2026-10-25 08:35',
    timeSpentSeconds: 2100,
    status: 'graded',
    score: 8.5,
    maxScore: 10.0,
    tabSwitchCount: 0,
    answers: {
      'q-t8-01': {
        questionId: 'q-t8-01',
        questionType: 'single_choice',
        selectedOption: 'A',
        isCorrect: true,
        pointsAwarded: 0.25
      },
      'q-t8-02': {
        questionId: 'q-t8-02',
        questionType: 'single_choice',
        selectedOption: 'A',
        isCorrect: true,
        pointsAwarded: 0.25
      },
      'q-t8-03': {
        questionId: 'q-t8-03',
        questionType: 'true_false_group',
        trueFalseAnswers: {
          'sub-1': true,
          'sub-2': true,
          'sub-3': true,
          'sub-4': false
        },
        isCorrect: true,
        pointsAwarded: 1.0
      },
      'q-t8-04': {
        questionId: 'q-t8-04',
        questionType: 'short_answer',
        shortAnswerText: '4',
        isCorrect: true,
        pointsAwarded: 0.5
      },
      'q-t8-05': {
        questionId: 'q-t8-05',
        questionType: 'essay',
        essayAnswerText: 'a) Tứ giác ADME có MD // AE và ME // AD theo giả thiết nên là hình bình hành theo định nghĩa.\nb) Do tam giác ABC cân tại A nên góc B = góc C. Vì MD // AC nên góc DMB = góc C (đồng vị). Từ đó suy ra góc B = góc DMB nên tam giác MBD cân tại D.',
        essayImages: [
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400' width='100%' height='100%' style='background:%23ffffff;'><rect width='100%' height='100%' fill='%23fefdf9' stroke='%23e2e8f0' stroke-width='2'/><path d='M300,50 L120,320 L480,320 Z' fill='none' stroke='%231e293b' stroke-width='3'/><circle cx='300' cy='320' r='5' fill='%232563eb'/><line x1='120' y1='320' x2='480' y2='320' stroke='%232563eb' stroke-dasharray='4,4'/><path d='M300,320 L210,185' stroke='%23dc2626' stroke-width='2.5'/><path d='M300,320 L390,185' stroke='%23dc2626' stroke-width='2.5'/><line x1='210' y1='185' x2='300' y2='50' stroke='%23059669' stroke-width='2.5'/><line x1='390' y1='185' x2='300' y2='50' stroke='%23059669' stroke-width='2.5'/><text x='295' y='40' font-size='18' font-weight='bold' fill='%230f172a'>A</text><text x='95' y='335' font-size='18' font-weight='bold' fill='%230f172a'>B</text><text x='490' y='335' font-size='18' font-weight='bold' fill='%230f172a'>C</text><text x='295' y='350' font-size='18' font-weight='bold' fill='%232563eb'>M</text><text x='185' y='180' font-size='18' font-weight='bold' fill='%23dc2626'>D</text><text x='405' y='180' font-size='18' font-weight='bold' fill='%23dc2626'>E</text><text x='30' y='385' font-size='13' fill='%2364748b' font-family='sans-serif'>Hình vẽ bài 5: Tứ giác ADME có MD // AC, ME // AB</text></svg>"
        ],
        pointsAwarded: 1.75,
        teacherFeedback: 'Bài làm rất tốt, lập luận chặt chẽ, câu b trình bày rõ ràng.'
      }
    }
  }
];

export const INITIAL_GEMINI_ASSISTANTS: GeminiAssistantConfig[] = [
  {
    id: 'asst-toan',
    subject: 'math',
    name: 'Trợ lý Soạn thảo & Ma trận Toán THCS',
    description: 'Hỗ trợ giáo viên xây dựng câu hỏi trắc nghiệm chuẩn 4 dạng, biểu thức KaTeX, thiết lập ma trận đề và bản đặc tả theo Thông tư 22 & Chương trình GDPT 2018.',
    externalUrl: 'https://gemini.google.com/',
    samplePromptTemplate: `Bạn là chuyên gia khảo thí môn Toán THCS (Chương trình GDPT 2018).
Hãy tạo bộ câu hỏi trắc nghiệm khách quan chuẩn theo thông tin sau:
- Khối lớp: {GRADE}
- Bộ sách: {TEXTBOOK}
- Bài học: {LESSON}
- Yêu cầu cần đạt: {YCCD}
- Số lượng: {COUNT} câu
- Dạng câu: {TYPE}
- Mức độ nhận thức: {LEVEL}
Yêu cầu định dạng đầu ra:
1. Viết công thức toán học chuẩn LaTeX đặt giữa cặp dấu $.
2. Đầy đủ đáp án, lời giải chi tiết giải thích rõ vì sao đúng/sai.
3. Bảng mã câu hỏi, mức độ và yêu cầu cần đạt tương ứng.`
  },
  {
    id: 'asst-tin',
    subject: 'informatics',
    name: 'Trợ lý Tin học THCS',
    description: 'Chuyên hỗ trợ soạn câu hỏi thuật toán, sơ đồ khối, cú pháp bảng tính Excel/Google Sheets, an toàn thông tin và ngôn ngữ lập trình Scratch/Python.',
    externalUrl: 'https://gemini.google.com/',
    samplePromptTemplate: `Bạn là giáo viên Tin học THCS. Hãy soạn thảo ngân hàng câu hỏi môn Tin học:
- Khối: {GRADE} | Bộ sách: {TEXTBOOK}
- Chủ đề: {LESSON}
- Yêu cầu cần đạt: {YCCD}
- Mức độ: {LEVEL} | Số lượng: {COUNT}
- Dạng câu: Trắc nghiệm 1 đáp án / Đúng - Sai nhiều ý / Trả lời ngắn
Kèm theo đoạn mã hoặc bảng dữ liệu minh họa rõ ràng và đáp án chi tiết.`
  },
  {
    id: 'asst-khtn',
    subject: 'science',
    name: 'Trợ lý Khoa học Tự nhiên',
    description: 'Tạo câu hỏi Vật lí, Hóa học, Sinh học tích hợp; tình huống thực nghiệm khoa học và bảo toàn khối lượng năng lượng.',
    externalUrl: 'https://gemini.google.com/',
    samplePromptTemplate: `Hãy thiết kế câu hỏi Khoa học tự nhiên lớp {GRADE}:
- Phân môn: Vật lí / Hóa học / Sinh học
- Bài học: {LESSON}
- Yêu cầu cần đạt: {YCCD}
- Mức độ nhận thức: {LEVEL}
Gắn với các hiện tượng thực tế đời sống hàng ngày của học sinh.`
  },
  {
    id: 'asst-van',
    subject: 'literature',
    name: 'Trợ lý Ngữ văn THCS',
    description: 'Hỗ trợ ngữ liệu Đọc hiểu ngoài sách giáo khoa, câu hỏi trắc nghiệm tiếng Việt và gợi ý dàn ý bài văn nghị luận.',
    externalUrl: 'https://gemini.google.com/',
    samplePromptTemplate: `Hãy chọn một ngữ liệu văn bản phù hợp lứa tuổi học sinh lớp {GRADE} (ngoài SGK) và xây dựng hệ thống 4 câu hỏi đọc hiểu kèm ma trận đặc tả.`
  },
  {
    id: 'asst-anh',
    subject: 'english',
    name: 'Trợ lý Tiếng Anh THCS',
    description: 'Xây dựng bài tập Ngữ âm, Từ vựng, Ngữ pháp, Đọc hiểu và Viết lại câu chuẩn khung năng lực ngoại ngữ 6 bậc.',
    externalUrl: 'https://gemini.google.com/',
    samplePromptTemplate: `Create an English quiz for Grade {GRADE}:
- Topic: {LESSON}
- Level: CEFR A2/B1
- Types: Multiple choice, error identification, sentence transformation.`
  }
];

export const INITIAL_STUDY_DOCS: StudyDocument[] = [
  {
    id: 'doc-01',
    title: 'Đề cương ôn tập Giữa học kỳ I - Toán 8 (Tóm tắt kiến thức & Bài tập mẫu)',
    grade: '8',
    subject: 'math',
    type: 'de_cuong',
    author: 'Tổ Toán - THCS Tây Đô',
    size: '1.4 MB',
    uploadedDate: '2026-10-10',
    description: 'Hệ thống toàn bộ công thức 7 hằng đẳng thức đáng nhớ, quy tắc nhân chia đa thức và các dấu hiệu nhận biết tứ giác đặc biệt.'
  },
  {
    id: 'doc-02',
    title: 'Sổ tay công thức và hàm bảng tính Tin học 8 (Hàm IF, SUMIF, COUNTIF)',
    grade: '8',
    subject: 'informatics',
    type: 'cong_thuc',
    author: 'Thầy Diệp Thanh Toàn',
    size: '850 KB',
    uploadedDate: '2026-10-12',
    description: 'Cẩm nang ví dụ minh họa từng bước xử lý bảng tính Excel trong bài thực hành Tin học 8.'
  },
  {
    id: 'doc-03',
    title: 'Đề thi tham khảo Giữa học kỳ I Toán 8 có đáp án và hướng dẫn chấm chi tiết',
    grade: '8',
    subject: 'math',
    type: 'de_mau',
    author: 'Trường THCS Tây Đô',
    size: '2.1 MB',
    uploadedDate: '2026-10-14',
    description: 'Bộ đề thi chuẩn cấu trúc phòng GD&ĐT giúp học sinh tự luyện và bấm giờ trước kỳ thi.'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-01',
    timestamp: '2026-10-31 15:42',
    actor: 'Thầy Diệp Thanh Toàn',
    role: 'teacher',
    action: 'Duyệt câu hỏi',
    target: 'TOAN8-GK1-NB01',
    details: 'Đã duyệt câu hỏi vào ngân hàng chính thức sau khi kiểm tra công thức KaTeX.'
  },
  {
    id: 'log-02',
    timestamp: '2026-10-31 14:15',
    actor: 'Thầy Diệp Thanh Toàn',
    role: 'teacher',
    action: 'Giao bài kiểm tra',
    target: 'Lớp 8A1',
    details: 'Đã phát hành bài kiểm tra Giữa kỳ I - Toán 8 cho 38 học sinh.'
  },
  {
    id: 'log-03',
    timestamp: '2026-10-31 11:30',
    actor: 'Quản trị viên THCS Tây Đô',
    role: 'admin',
    action: 'Cập nhật phân quyền',
    target: 'Tài khoản giáo viên',
    details: 'Phân công nhiệm vụ giảng dạy và duyệt đề cho Thầy Diệp Thanh Toàn.'
  }
];
