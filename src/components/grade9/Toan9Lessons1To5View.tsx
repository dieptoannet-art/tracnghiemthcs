import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Info,
  Lightbulb,
  Monitor,
  Play,
  RotateCcw,
  Target,
  Volume2,
  VolumeX,
  AlertTriangle,
  FileCode2,
} from 'lucide-react';
import { Bai2LinearSystemLessonView } from './Bai2LinearSystemLessonView';
import { ExplorerRobot3D, TextbookToan9Badge3D } from './Bai2LinearSystem3DAssets';

export type Toan9LessonId =
  | 'toan_9_c1_b1'
  | 'toan_9_c1_b2'
  | 'toan_9_c1_b3'
  | 'toan_9_c2_b4'
  | 'toan_9_c2_b5';

export const TOAN9_INTEGRATED_LESSON_IDS = new Set<string>([
  'toan_9_c1_b1',
  'toan_9_c1_b2',
  'toan_9_c1_b3',
  'toan_9_c2_b4',
  'toan_9_c2_b5',
]);

interface GuidedStepItem {
  prompt: string;
  expectedAnswers: string[];
  placeholder: string;
  hint: string;
  solutionText: string;
}

interface LessonActivityData {
  id: number;
  shortTitle: string;
  fullTitle: string;
  sgkPageBadge: string;
  studentObjective: string;
  visualType:
    | 'b1_linear_eq_balance'
    | 'b1_coord_line'
    | 'b1_system_intersection'
    | 'b3_modeling_pipeline'
    | 'b3_motion_tickets'
    | 'b4_product_equation'
    | 'b4_rational_domain'
    | 'b5_number_line_order'
    | 'b5_multiply_negative';
  theorySummary: string[];
  formulaDisplay: string;
  guidedTaskTitle: string;
  guidedProblemStatement: string;
  guidedSteps: GuidedStepItem[];
  faqTitle: string;
  faqAnswer: string;
  processTitle: string;
  processSteps: string[];
  importantTip: string;
  teacherGoal: string;
  teacherQuestion: string;
  teacherMistake: string;
}

interface LessonQuizItem {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LessonExerciseItem {
  id: string;
  code: string;
  title: string;
  statement: string;
  expectedInputLabel: string;
  expectedAnswers: string[];
  placeholder: string;
  hint: string;
  fullSolution: string[];
}

interface Toan9LessonSpec {
  id: Toan9LessonId;
  chapterBreadcrumb: string;
  lessonShortCode: string;
  lessonTitle: string;
  sgkPagesRange: string;
  htmlUrl: string;
  storageKey: string;
  prevLessonId?: Toan9LessonId;
  prevLessonLabel?: string;
  nextLessonId?: Toan9LessonId;
  nextLessonLabel?: string;
  activities: LessonActivityData[]; // 1..5 interactive + 6 is Luyện tập & Vận dụng SGK
  quiz: LessonQuizItem[];
  exercises: LessonExerciseItem[];
}

const TOAN9_LESSONS_SPEC: Record<Exclude<Toan9LessonId, 'toan_9_c1_b2'>, Toan9LessonSpec> = {
  toan_9_c1_b1: {
    id: 'toan_9_c1_b1',
    chapterBreadcrumb: 'Toán 9 • Chương I • Bài 1',
    lessonShortCode: 'Bài 1',
    lessonTitle: 'Khái niệm phương trình và hệ hai phương trình bậc nhất hai ẩn',
    sgkPagesRange: 'SGK trang 5–10',
    htmlUrl: '/lessons/lop-9/toan/chuong-01/bai-01/index.html',
    storageKey: 'taydo_smart_edu_toan9_c1_b1_v1',
    nextLessonId: 'toan_9_c1_b2',
    nextLessonLabel: 'Bài 2 →',
    activities: [
      {
        id: 1,
        shortTitle: '1. Bài toán cổ Gà & Chó',
        fullTitle: 'Khởi động • Bài toán dân gian Gà và Chó (SGK trang 5)',
        sgkPageBadge: 'Mở đầu • SGK trang 5',
        studentObjective: 'Biểu diễn hai đại lượng chưa biết x, y bằng các hệ thức có hai ẩn.',
        visualType: 'b1_linear_eq_balance',
        theorySummary: [
          '“Vừa gà vừa chó, bó lại cho tròn, ba mươi sáu con, một trăm chân chẵn”.',
          'Gọi x là số gà, y là số chó (x, y ∈ ℕ*). Tổng số con cho phương trình: x + y = 36.',
          'Mỗi con gà có 2 chân, mỗi con chó có 4 chân nên tổng số chân là: 2x + 4y = 100.',
        ],
        formulaDisplay: 'x + y = 36   và   2x + 4y = 100',
        guidedTaskTitle: 'Ví dụ mở đầu • Kiểm tra cặp số (x; y)',
        guidedProblemStatement:
          'Xét bài toán Gà và Chó với hai hệ thức x + y = 36 (1) và 2x + 4y = 100 (2). Thử kiểm tra xem x = 22 con gà và y = 14 con chó có thỏa mãn cả hai hệ thức không.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Thay x = 22, y = 14 vào vế trái của (1): x + y bằng bao nhiêu?',
            expectedAnswers: ['36'],
            placeholder: 'Nhập kết quả (VD: 36)',
            hint: 'Tính 22 + 14.',
            solutionText: '22 + 14 = 36 (đúng bằng vế phải của phương trình 1).',
          },
          {
            prompt: 'Bước 2: Thay x = 22, y = 14 vào vế trái của (2): 2x + 4y bằng bao nhiêu?',
            expectedAnswers: ['100'],
            placeholder: 'Nhập tổng số chân (VD: 100)',
            hint: 'Tính 2·22 + 4·14 = 44 + 56.',
            solutionText: '2·22 + 4·14 = 44 + 56 = 100 (đúng bằng vế phải của phương trình 2).',
          },
        ],
        faqTitle: 'Vì sao cần dùng tới hai ẩn x và y?',
        faqAnswer:
          'Khi bài toán có hai đại lượng chưa biết liên hệ với nhau theo hai điều kiện độc lập (tổng số con và tổng số chân), việc đặt hai ẩn x, y giúp lập phương trình trực tiếp, rõ ràng.',
        processTitle: 'Nhận diện phương trình bậc nhất hai ẩn',
        processSteps: [
          'Dạng tổng quát: ax + by = c (trong đó a, b, c là các số đã biết, a ≠ 0 hoặc b ≠ 0).',
          'Nếu tại x = x₀, y = y₀ mà hai vế của phương trình có giá trị bằng nhau thì cặp số (x₀; y₀) gọi là một nghiệm.',
        ],
        importantTip: 'Điều kiện a ≠ 0 hoặc b ≠ 0 nghĩa là a và b không đồng thời bằng 0 (a² + b² ≠ 0).',
        teacherGoal: 'Giúp học sinh kết nối bài toán thực tế với khái niệm phương trình bậc nhất hai ẩn.',
        teacherQuestion: 'Trong hệ thức 2x + 4y = 100, các hệ số a, b, c bằng bao nhiêu?',
        teacherMistake: 'Học sinh quên điều kiện a và b không đồng thời bằng 0 (0x + 0y = c không phải PT bậc nhất hai ẩn).',
      },
      {
        id: 2,
        shortTitle: '2. PT bậc nhất hai ẩn',
        fullTitle: 'Phương trình bậc nhất hai ẩn & Nghiệm của phương trình (SGK trang 5–6)',
        sgkPageBadge: 'Mục 1 • SGK trang 5–6',
        studentObjective: 'Xác định hệ số a, b, c và kiểm tra một cặp số (x₀; y₀) có là nghiệm hay không.',
        visualType: 'b1_linear_eq_balance',
        theorySummary: [
          'Phương trình bậc nhất hai ẩn x và y là hệ thức dạng ax + by = c, trong đó a, b, c là các số đã biết (a ≠ 0 hoặc b ≠ 0).',
          'Mỗi cặp số (x₀; y₀) thỏa mãn ax₀ + by₀ = c được gọi là một nghiệm của phương trình.',
        ],
        formulaDisplay: 'ax + by = c   (a ≠ 0 hoặc b ≠ 0)',
        guidedTaskTitle: 'Luyện tập 1 & 2 (SGK trang 6) • Tìm nghiệm của 2x - y = 1',
        guidedProblemStatement:
          'Cho phương trình bậc nhất hai ẩn: 2x − y = 1. Hãy kiểm tra và tìm các cặp nghiệm (x; y).',
        guidedSteps: [
          {
            prompt: 'Bước 1: Với x = 3, thay vào 2x − y = 1 thì y bằng bao nhiêu?',
            expectedAnswers: ['5'],
            placeholder: 'Nhập giá trị y',
            hint: '2·3 − y = 1 ⇒ 6 − y = 1 ⇒ y = 5.',
            solutionText: 'Khi x = 3 thì 2(3) − y = 1 ⇒ y = 5. Cặp số (3; 5) là một nghiệm.',
          },
          {
            prompt: 'Bước 2: Biểu diễn y theo x từ phương trình 2x − y = 1, ta được y = ?',
            expectedAnswers: ['2x-1', '2*x-1', '-1+2x'],
            placeholder: 'Nhập biểu thức theo x (VD: 2x - 1)',
            hint: 'Chuyển −y sang vế phải và 1 sang vế trái: y = 2x − 1.',
            solutionText: 'Mọi nghiệm của phương trình 2x − y = 1 đều có dạng (x; 2x − 1) với x ∈ ℝ tùy ý.',
          },
        ],
        faqTitle: 'Một phương trình bậc nhất hai ẩn có bao nhiêu nghiệm?',
        faqAnswer:
          'Mỗi phương trình bậc nhất hai ẩn ax + by = c luôn có VÔ SỐ NGHIỆM. Với mỗi giá trị của x (khi b ≠ 0), ta luôn tính được duy nhất một giá trị tương ứng của y.',
        processTitle: 'Cách kiểm tra cặp số (x₀; y₀) là nghiệm',
        processSteps: [
          'Bước 1: Thay x = x₀ và y = y₀ vào vế trái ax + by.',
          'Bước 2: So sánh kết quả với vế phải c. Nếu bằng nhau thì (x₀; y₀) là nghiệm.',
        ],
        importantTip: 'Chú ý thứ tự trong cặp số (x₀; y₀): hoành độ x₀ viết trước, tung độ y₀ viết sau.',
        teacherGoal: 'Học sinh nắm vững định nghĩa nghiệm và biết biểu diễn một ẩn theo ẩn kia.',
        teacherQuestion: 'Cặp số (5; 3) và cặp số (3; 5) có phải là cùng một nghiệm của 2x − y = 1 không?',
        teacherMistake: 'Nhầm lẫn thứ tự (x₀; y₀) thành (y₀; x₀) khi kết luận nghiệm.',
      },
      {
        id: 3,
        shortTitle: '3. Biểu diễn trên Oxy',
        fullTitle: 'Biểu diễn hình học tập nghiệm bằng đường thẳng trên Oxy (SGK trang 7)',
        sgkPageBadge: 'Nhận xét • SGK trang 7',
        studentObjective: 'Hiểu tập nghiệm của ax + by = c được biểu diễn bởi đường thẳng d: ax + by = c trên mặt phẳng tọa độ.',
        visualType: 'b1_coord_line',
        theorySummary: [
          'Trong mặt phẳng tọa độ Oxy, mỗi nghiệm (x₀; y₀) của ax + by = c được biểu diễn bởi điểm M(x₀; y₀).',
          'Tập nghiệm của phương trình ax + by = c được biểu diễn bởi đường thẳng d: ax + by = c.',
          'Trường hợp đặc biệt: 0x + by = c ⇒ y = c/b (song song hoặc trùng trục Ox); ax + 0y = c ⇒ x = c/a (song song hoặc trùng trục Oy).',
        ],
        formulaDisplay: 'd: ax + by = c  ⇔  y = −(a/b)x + c/b  (khi b ≠ 0)',
        guidedTaskTitle: 'Ví dụ 3 (SGK trang 7) • Vẽ đường thẳng 2x + y = 3',
        guidedProblemStatement:
          'Để vẽ đường thẳng biểu diễn tập nghiệm của phương trình 2x + y = 3 trên mặt phẳng tọa độ Oxy, ta tìm hai điểm thuộc đường thẳng.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Cho x = 0 thì y = ? (Giao điểm với trục tung Oy)',
            expectedAnswers: ['3'],
            placeholder: 'Nhập giá trị y khi x = 0',
            hint: 'Thay x = 0 vào 2x + y = 3 ⇒ 2·0 + y = 3.',
            solutionText: 'Khi x = 0 ⇒ y = 3. Đường thẳng đi qua điểm A(0; 3) trên trục Oy.',
          },
          {
            prompt: 'Bước 2: Cho x = 1 thì y = ? (Điểm thứ hai thuộc đường thẳng)',
            expectedAnswers: ['1'],
            placeholder: 'Nhập giá trị y khi x = 1',
            hint: 'Thay x = 1 vào 2x + y = 3 ⇒ 2·1 + y = 3.',
            solutionText: 'Khi x = 1 ⇒ y = 1. Đường thẳng đi qua điểm B(1; 1). Nối A(0; 3) và B(1; 1) ta được đường thẳng 2x + y = 3.',
          },
        ],
        faqTitle: 'Khi nào đường thẳng ax + by = c song song với trục tọa độ?',
        faqAnswer:
          'Nếu a = 0, b ≠ 0 thì phương trình có dạng y = c/b (đường thẳng ngang, song song trục Ox nếu c ≠ 0). Nếu b = 0, a ≠ 0 thì phương trình có dạng x = c/a (đường thẳng đứng, song song trục Oy nếu c ≠ 0).',
        processTitle: 'Quy trình biểu diễn tập nghiệm trên Oxy',
        processSteps: [
          'Bước 1: Chọn 2 giá trị của x dễ tính để tìm 2 điểm A(x₁; y₁) và B(x₂; y₂) thuộc đường thẳng.',
          'Bước 2: Biểu diễn A, B trên mặt phẳng tọa độ Oxy và kẻ đường thẳng đi qua A, B.',
        ],
        importantTip: 'Mọi điểm nằm trên đường thẳng d đều có tọa độ là nghiệm của phương trình.',
        teacherGoal: 'Giúp học sinh trực quan hóa mối liên hệ giữa đại số (cặp nghiệm) và hình học (điểm trên đường thẳng).',
        teacherQuestion: 'Cần xác định tối thiểu mấy điểm phân biệt để vẽ được đường thẳng ax + by = c?',
        teacherMistake: 'Nhầm lẫn giữa phương trình y = 2 (song song Ox) và x = 2 (song song Oy).',
      },
      {
        id: 4,
        shortTitle: '4. Hệ hai phương trình',
        fullTitle: 'Hệ hai phương trình bậc nhất hai ẩn & Nghiệm chung (SGK trang 8–9)',
        sgkPageBadge: 'Mục 2 • SGK trang 8–9',
        studentObjective: 'Nắm vững khái niệm hệ hai phương trình bậc nhất hai ẩn và ý nghĩa hình học của nghiệm chung (giao điểm).',
        visualType: 'b1_system_intersection',
        theorySummary: [
          'Cho hai phương trình bậc nhất hai ẩn a₁x + b₁y = c₁ và a₂x + b₂y = c₂. Khi kết hợp chúng ta có một hệ hai phương trình bậc nhất hai ẩn.',
          'Nếu hai phương trình ấy có nghiệm chung (x₀; y₀) thì (x₀; y₀) được gọi là một nghiệm của hệ.',
          'Trên mặt phẳng tọa độ, nghiệm của hệ chính là tọa độ giao điểm của hai đường thẳng d₁ và d₂.',
        ],
        formulaDisplay: '{ a₁x + b₁y = c₁  (d₁) ;  a₂x + b₂y = c₂  (d₂) }',
        guidedTaskTitle: 'Luyện tập 4 (SGK trang 9) • Kiểm tra nghiệm chung của hệ',
        guidedProblemStatement:
          'Cho hệ phương trình: { x + 2y = 4 (1) ; 3x − y = 5 (2) }. Hãy kiểm tra xem cặp số (2; 1) có phải là nghiệm của hệ không.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Thay x = 2, y = 1 vào vế trái của phương trình (1): x + 2y = ?',
            expectedAnswers: ['4'],
            placeholder: 'Nhập giá trị x + 2y',
            hint: '2 + 2·1 = 4.',
            solutionText: 'x + 2y = 2 + 2(1) = 4 (thỏa mãn phương trình 1).',
          },
          {
            prompt: 'Bước 2: Thay x = 2, y = 1 vào vế trái của phương trình (2): 3x − y = ?',
            expectedAnswers: ['5'],
            placeholder: 'Nhập giá trị 3x - y',
            hint: '3·2 − 1 = 5.',
            solutionText: '3x − y = 3(2) − 1 = 5 (thỏa mãn phương trình 2). Vậy (2; 1) là nghiệm của hệ!',
          },
        ],
        faqTitle: 'Nếu cặp số (x₀; y₀) chỉ thỏa mãn phương trình (1) mà không thỏa mãn phương trình (2) thì sao?',
        faqAnswer:
          'Khi đó (x₀; y₀) KHÔNG PHẢI là nghiệm của hệ. Một cặp số chỉ là nghiệm của hệ khi nó đồng thời là nghiệm của cả hai phương trình trong hệ.',
        processTitle: 'Kiểm tra cặp số (x₀; y₀) có là nghiệm của hệ',
        processSteps: [
          'Bước 1: Thay x = x₀, y = y₀ vào phương trình thứ nhất.',
          'Bước 2: Thay x = x₀, y = y₀ vào phương trình thứ hai.',
          'Bước 3: Kết luận là nghiệm của hệ nếu cả hai phương trình cùng thỏa mãn.',
        ],
        importantTip: 'Về mặt hình học, nghiệm (2; 1) chính là giao điểm M(2; 1) của hai đường thẳng d₁ và d₂.',
        teacherGoal: 'Học sinh hiểu rõ khái niệm nghiệm chung cả về đại số lẫn hình học.',
        teacherQuestion: 'Hai đường thẳng cắt nhau tại 1 điểm thì hệ phương trình có mấy nghiệm?',
        teacherMistake: 'Chỉ thay cặp số vào phương trình (1) thấy đúng đã vội kết luận là nghiệm của hệ.',
      },
      {
        id: 5,
        shortTitle: '5. Thực hành tổng hợp',
        fullTitle: 'Vận dụng • Lập hệ phương trình từ bài toán thực tiễn (SGK trang 9)',
        sgkPageBadge: 'Vận dụng • SGK trang 9',
        studentObjective: 'Lập phương trình và hệ phương trình bậc nhất hai ẩn mô tả tình huống mua sắm, dinh dưỡng thực tế.',
        visualType: 'b1_system_intersection',
        theorySummary: [
          'Trong thực tế, nhiều bài toán về giá tiền, khối lượng, dinh dưỡng có thể biểu diễn gọn bằng hệ hai phương trình bậc nhất hai ẩn.',
          'Sau khi lập hệ, ta có thể kiểm tra phương án cho trước bằng cách thay trực tiếp vào hai phương trình.',
        ],
        formulaDisplay: 'Tổng số con: x + y = 36  |  Tổng số chân: 2x + 4y = 100  ⇒  (x; y) = (22; 14)',
        guidedTaskTitle: 'Vận dụng • Bài toán mua cam và quýt',
        guidedProblemStatement:
          'Bạn Nam mua x kg cam (giá 30 nghìn đồng/kg) và y kg quýt (giá 40 nghìn đồng/kg). Tổng khối lượng là 5 kg và tổng số tiền là 170 nghìn đồng (rút gọn cho 10 được 3x + 4y = 17).',
        guidedSteps: [
          {
            prompt: 'Bước 1: Phương trình biểu diễn tổng khối lượng 5 kg là x + y = ?',
            expectedAnswers: ['5'],
            placeholder: 'Nhập vế phải',
            hint: 'Tổng số kg cam và quýt là 5.',
            solutionText: 'Phương trình tổng khối lượng: x + y = 5.',
          },
          {
            prompt: 'Bước 2: Kiểm tra cặp (x; y) = (3; 2): Khi x = 3 kg cam, y = 2 kg quýt thì 3x + 4y bằng bao nhiêu?',
            expectedAnswers: ['17'],
            placeholder: 'Nhập giá trị 3x + 4y',
            hint: 'Tính 3·3 + 4·2.',
            solutionText: '3(3) + 4(2) = 9 + 8 = 17 (tức 170 nghìn đồng). Vậy Nam mua 3 kg cam và 2 kg quýt!',
          },
        ],
        faqTitle: 'Khi lập phương trình từ bài toán có đơn vị (nghìn đồng, đồng), cần chú ý gì?',
        faqAnswer:
          'Phải thống nhất cùng một đơn vị đo cho các số hạng trong cùng một phương trình (ví dụ cùng tính theo nghìn đồng hoặc cùng tính theo đồng).',
        processTitle: 'Tóm tắt kiến thức trọng tâm Bài 1',
        processSteps: [
          '1. Phương trình bậc nhất hai ẩn: ax + by = c (a ≠ 0 hoặc b ≠ 0).',
          '2. Tập nghiệm biểu diễn bởi đường thẳng d: ax + by = c trên Oxy.',
          '3. Nghiệm của hệ là nghiệm chung của cả hai phương trình.',
        ],
        importantTip: 'Sau Bài 1, chúng ta sẽ sang Bài 2 để học hai phương pháp tìm nghiệm của hệ: Phương pháp thế và Cộng đại số.',
        teacherGoal: 'Củng cố toàn bộ kiến thức Bài 1 và tạo cầu nối sang Bài 2.',
        teacherQuestion: 'Nếu không cho trước cặp số để thử, làm thế nào để tìm được nghiệm (22; 14) của bài toán Gà và Chó?',
        teacherMistake: 'Không đồng nhất đơn vị tiền tệ khi lập phương trình.',
      },
    ],
    quiz: [
      {
        id: 'b1_q1',
        stem: 'Phương trình nào sau đây là phương trình bậc nhất hai ẩn x, y?',
        options: ['2x − 3y = 5', '0x + 0y = 4', 'x² + y = 2', '2x + 3xy = 1'],
        correctIndex: 0,
        explanation: '2x − 3y = 5 có dạng ax + by = c với a = 2, b = −3 (không đồng thời bằng 0) và bậc 1.',
      },
      {
        id: 'b1_q2',
        stem: 'Cặp số nào sau đây là một nghiệm của phương trình 3x + y = 7?',
        options: ['(2; 1)', '(1; 2)', '(3; 2)', '(0; 3)'],
        correctIndex: 0,
        explanation: 'Thay x = 2, y = 1 vào 3x + y ta được 3(2) + 1 = 7 (đúng).',
      },
      {
        id: 'b1_q3',
        stem: 'Đường thẳng biểu diễn tập nghiệm của phương trình 0x + 2y = 6 là:',
        options: [
          'Đường thẳng y = 3 song song với trục hoành Ox',
          'Đường thẳng x = 3 song song với trục tung Oy',
          'Đường thẳng đi qua gốc tọa độ O(0; 0)',
          'Trục tung Oy',
        ],
        correctIndex: 0,
        explanation: '0x + 2y = 6 ⇔ y = 3, là đường thẳng song song với trục Ox và cắt trục Oy tại điểm (0; 3).',
      },
      {
        id: 'b1_q4',
        stem: 'Cặp số (1; −1) là nghiệm của hệ phương trình nào dưới đây?',
        options: [
          '{ x + y = 0 ; 2x − y = 3 }',
          '{ x + y = 2 ; 2x − y = 3 }',
          '{ x − y = 0 ; x + y = 2 }',
          '{ 2x + y = 3 ; x − y = 0 }',
        ],
        correctIndex: 0,
        explanation: 'Thay x = 1, y = −1: 1 + (−1) = 0 và 2(1) − (−1) = 3 (cả hai phương trình đều thỏa mãn).',
      },
    ],
    exercises: [
      {
        id: 'ex_1_1',
        code: 'Bài 1.1 (SGK trang 9)',
        title: 'Kiểm tra cặp số là nghiệm của phương trình bậc nhất hai ẩn',
        statement: 'Cho phương trình 5x − 4y = 8. Với x = 0, hãy tìm giá trị của y để cặp số (0; y) là nghiệm của phương trình.',
        expectedInputLabel: 'y =',
        expectedAnswers: ['-2'],
        placeholder: 'Nhập giá trị y (VD: -2)',
        hint: 'Thay x = 0 vào 5x − 4y = 8 ta được −4y = 8.',
        fullSolution: [
          'Thay x = 0 vào phương trình 5x − 4y = 8, ta có: 5·0 − 4y = 8.',
          'Suy ra −4y = 8 ⇒ y = −2.',
          'Vậy cặp số (0; −2) là một nghiệm của phương trình.',
        ],
      },
      {
        id: 'ex_1_3',
        code: 'Bài 1.3 (SGK trang 10)',
        title: 'Kiểm tra nghiệm của hệ hai phương trình bậc nhất hai ẩn',
        statement: 'Cho hệ phương trình { 3x + 2y = 7 ; x − y = 4 }. Thay cặp số (3; −1) vào biểu thức 3x + 2y, kết quả bằng bao nhiêu?',
        expectedInputLabel: '3x + 2y =',
        expectedAnswers: ['7'],
        placeholder: 'Nhập kết quả',
        hint: 'Tính 3·3 + 2·(−1).',
        fullSolution: [
          'Thay x = 3, y = −1 vào phương trình thứ nhất: 3(3) + 2(−1) = 9 − 2 = 7 (đúng).',
          'Thay x = 3, y = −1 vào phương trình thứ hai: 3 − (−1) = 4 (đúng).',
          'Vậy (3; −1) là nghiệm chung của hệ phương trình.',
        ],
      },
    ],
  },

  toan_9_c1_b3: {
    id: 'toan_9_c1_b3',
    chapterBreadcrumb: 'Toán 9 • Chương I • Bài 3',
    lessonShortCode: 'Bài 3',
    lessonTitle: 'Giải bài toán bằng cách lập hệ phương trình',
    sgkPagesRange: 'SGK trang 21–23',
    htmlUrl: '/lessons/lop-9/toan/chuong-01/bai-03/index.html',
    storageKey: 'taydo_smart_edu_toan9_c1_b3_v1',
    prevLessonId: 'toan_9_c1_b2',
    prevLessonLabel: '← Bài 2',
    nextLessonId: 'toan_9_c2_b4',
    nextLessonLabel: 'Bài 4 (Chương II) →',
    activities: [
      {
        id: 1,
        shortTitle: '1. Quy trình 3 bước',
        fullTitle: 'Quy trình giải bài toán bằng cách lập hệ phương trình (SGK trang 21)',
        sgkPageBadge: 'Quy trình • SGK trang 21',
        studentObjective: 'Nắm vững 3 bước chuẩn SGK: Chọn ẩn & đặt điều kiện → Lập hệ phương trình & Giải hệ → Kiểm tra điều kiện & Kết luận.',
        visualType: 'b3_modeling_pipeline',
        theorySummary: [
          'Bước 1. Lập hệ phương trình: Chọn hai ẩn biểu thị hai đại lượng chưa biết và đặt điều kiện thích hợp cho các ẩn; biểu diễn các đại lượng liên quan theo các ẩn và lập hệ hai phương trình bậc nhất hai ẩn.',
          'Bước 2. Giải hệ hai phương trình nói trên.',
          'Bước 3. Kiểm tra xem trong các nghiệm vừa tìm được, nghiệm nào thỏa mãn điều kiện của ẩn rồi kết luận.',
        ],
        formulaDisplay: 'Chọn ẩn (x, y) + Điều kiện  ➜  Lập hệ 2 PT  ➜  Giải hệ  ➜  Đối chiếu ĐK & Kết luận',
        guidedTaskTitle: 'Khởi động • Bài toán tìm hai số tự nhiên',
        guidedProblemStatement:
          'Tìm hai số tự nhiên x và y biết tổng của chúng bằng 36 và hiệu của số lớn x trừ số bé y bằng 10.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Cộng từng vế hai phương trình x + y = 36 và x − y = 10, ta tìm được số lớn x bằng bao nhiêu?',
            expectedAnswers: ['23'],
            placeholder: 'Nhập giá trị x',
            hint: '2x = 36 + 10 = 46 ⇒ x = 23.',
            solutionText: 'Cộng hai phương trình: 2x = 46 ⇒ x = 23.',
          },
          {
            prompt: 'Bước 2: Từ x + y = 36 với x = 23, số bé y bằng bao nhiêu?',
            expectedAnswers: ['13'],
            placeholder: 'Nhập giá trị y',
            hint: 'y = 36 − 23.',
            solutionText: 'y = 36 − 23 = 13. Cả hai số 23 và 13 đều là số tự nhiên thỏa mãn đề bài.',
          },
        ],
        faqTitle: 'Vì sao phải đặt điều kiện cho ẩn ngay ở Bước 1?',
        faqAnswer:
          'Trong thực tế, số người, số vé, số sản phẩm phải là số nguyên dương (ℕ*), vận tốc và thời gian phải là số dương (> 0). Đặt điều kiện giúp loại bỏ các nghiệm âm hoặc lẻ không hợp lý.',
        processTitle: '3 bước giải bài toán bằng cách lập hệ phương trình',
        processSteps: [
          'Bước 1: Chọn 2 ẩn, ghi rõ đơn vị và điều kiện; lập 2 phương trình từ 2 dữ kiện.',
          'Bước 2: Giải hệ bằng phương pháp thế hoặc cộng đại số.',
          'Bước 3: Đối chiếu điều kiện của ẩn và trả lời câu hỏi thực tế.',
        ],
        importantTip: 'Luôn ghi rõ đơn vị của ẩn (km/h, giờ, sản phẩm, nghìn đồng...) khi gọi ẩn.',
        teacherGoal: 'Hình thành tư duy mô hình hóa toán học theo 3 bước chuẩn SGK trang 21.',
        teacherQuestion: 'Nếu quên đối chiếu điều kiện ở Bước 3 thì có thể dẫn đến sai sót gì?',
        teacherMistake: 'Gọi ẩn không kèm đơn vị và không đặt điều kiện (VD: x > 0, x ∈ ℕ*).',
      },
      {
        id: 2,
        shortTitle: '2. Toán Chuyển động',
        fullTitle: 'Ví dụ 1 & Luyện tập 1 • Bài toán chuyển động (SGK trang 21–22)',
        sgkPageBadge: 'Ví dụ 1 • SGK trang 21',
        studentObjective: 'Vận dụng công thức s = v·t để lập hệ phương trình cho bài toán chuyển động trên bộ và trên dòng nước.',
        visualType: 'b3_motion_tickets',
        theorySummary: [
          'Công thức cơ bản: Quãng đường = Vận tốc × Thời gian (s = v · t ⇒ t = s / v).',
          'Chuyển động trên dòng nước: Vận tốc xuôi dòng = v_thực + v_nước; Vận tốc ngược dòng = v_thực − v_nước.',
        ],
        formulaDisplay: 's = v · t   |   v_xuôi = x + y   |   v_ngược = x − y  (x > y > 0)',
        guidedTaskTitle: 'Bài toán hai xe khởi hành ngược chiều',
        guidedProblemStatement:
          'Hai ô tô khởi hành cùng lúc từ A và B cách nhau 210 km, đi ngược chiều và gặp nhau sau 2 giờ. Biết vận tốc xe đi từ A (x km/h) lớn hơn vận tốc xe đi từ B (y km/h) là 15 km/h.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Vì gặp nhau sau 2 giờ trên quãng đường 210 km nên 2x + 2y = 210. Rút gọn cho 2, ta được x + y = ?',
            expectedAnswers: ['105'],
            placeholder: 'Nhập tổng vận tốc x + y',
            hint: 'Chia cả hai vế của 2x + 2y = 210 cho 2.',
            solutionText: '2x + 2y = 210 ⇔ x + y = 105 (1). Kết hợp với x − y = 15 (2).',
          },
          {
            prompt: 'Bước 2: Giải hệ { x + y = 105 ; x − y = 15 }, vận tốc xe đi từ A (x km/h) bằng bao nhiêu?',
            expectedAnswers: ['60'],
            placeholder: 'Nhập vận tốc x (km/h)',
            hint: '2x = 105 + 15 = 120 ⇒ x = 60.',
            solutionText: 'x = 60 (km/h) và y = 45 (km/h). Cả hai đều thỏa mãn điều kiện x > y > 0.',
          },
        ],
        faqTitle: 'Khi nào cần đổi đơn vị thời gian trước khi lập phương trình?',
        faqAnswer:
          'Khi vận tốc tính bằng km/h mà thời gian đề bài cho bằng phút (ví dụ 24 phút), ta phải đổi ra giờ: 24 phút = 24/60 giờ = 2/5 giờ = 0,4 giờ.',
        processTitle: 'Kỹ thuật lập bảng cho bài toán chuyển động',
        processSteps: [
          'Cột 1: Vận tốc v (km/h).',
          'Cột 2: Thời gian t (giờ).',
          'Cột 3: Quãng đường s = v·t (km).',
        ],
        importantTip: 'Nếu hai xe đi ngược chiều gặp nhau sau thời gian t thì tổng hai quãng đường bằng khoảng cách ban đầu: s₁ + s₂ = AB.',
        teacherGoal: 'Giúp học sinh lập bảng đại lượng s, v, t để không nhầm lẫn phương trình.',
        teacherQuestion: 'Vì sao điều kiện của vận tốc thực x và vận tốc dòng nước y khi đi ngược dòng là x > y > 0?',
        teacherMistake: 'Quên đổi phút sang giờ khi vận tốc tính bằng km/h.',
      },
      {
        id: 3,
        shortTitle: '3. Toán Phần trăm & Năng suất',
        fullTitle: 'Ví dụ 2 & Luyện tập 2 • Bài toán năng suất và tỉ lệ phần trăm (SGK trang 22–23)',
        sgkPageBadge: 'Ví dụ 2 • SGK trang 22',
        studentObjective: 'Phân biệt mức theo kế hoạch (x, y) và mức vượt kế hoạch / tăng phần trăm trong thực tế.',
        visualType: 'b3_modeling_pipeline',
        theorySummary: [
          'Nếu theo kế hoạch tổ I làm được x sản phẩm và vượt mức 15% thì số sản phẩm làm thêm là 0,15x; tổng số sản phẩm thực tế là 1,15x.',
          'Ta có thể lập phương trình theo số sản phẩm tăng thêm hoặc theo tổng sản phẩm thực tế.',
        ],
        formulaDisplay: 'Kế hoạch: x + y = A   |   Vượt mức: a%·x + b%·y = ΔA',
        guidedTaskTitle: 'Ví dụ 2 (SGK trang 22) • Hai phân xưởng làm khẩu trang',
        guidedProblemStatement:
          'Theo kế hoạch hai tổ sản xuất 600 sản phẩm (x + y = 600). Do cải tiến kỹ thuật, tổ I vượt mức 18% (0,18x) và tổ II vượt mức 21% (0,21y), nên cả hai tổ làm vượt mức 120 sản phẩm: 0,18x + 0,21y = 120.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Từ x + y = 600 và 0,18x + 0,21y = 120, tìm số sản phẩm theo kế hoạch của tổ I (x = ?):',
            expectedAnswers: ['200'],
            placeholder: 'Nhập x (sản phẩm)',
            hint: 'Nhân x + y = 600 với 0,21 được 0,21x + 0,21y = 126. Trừ phương trình hai được 0,03x = 6 ⇒ x = 200.',
            solutionText: '0,21(x + y) − (0,18x + 0,21y) = 126 − 120 ⇒ 0,03x = 6 ⇒ x = 200 (sản phẩm).',
          },
          {
            prompt: 'Bước 2: Suy ra số sản phẩm theo kế hoạch của tổ II (y = 600 − x) bằng bao nhiêu?',
            expectedAnswers: ['400'],
            placeholder: 'Nhập y (sản phẩm)',
            hint: '600 − 200 = 400.',
            solutionText: 'y = 600 − 200 = 400 (sản phẩm). Cả hai giá trị nguyên dương thỏa mãn điều kiện.',
          },
        ],
        faqTitle: 'Nên lập phương trình theo lượng vượt mức hay tổng lượng thực tế?',
        faqAnswer:
          'Lập theo lượng vượt mức (0,18x + 0,21y = 120) có hệ số nhỏ gọn hơn lập theo tổng thực tế (1,18x + 1,21y = 720), nhưng cả hai phương trình đều tương đương và cho cùng một nghiệm.',
        processTitle: 'Công thức phần trăm cần nhớ',
        processSteps: [
          'Lượng tăng thêm a% của x là: (a/100)·x.',
          'Tổng lượng mới sau khi tăng a% là: x + (a/100)·x = (1 + a/100)·x.',
        ],
        importantTip: 'Đọc kỹ câu hỏi cuối bài: Đề hỏi số sản phẩm THEO KẾ HOẠCH (x, y) hay số sản phẩm THỰC TẾ!',
        teacherGoal: 'Học sinh thành thạo chuyển đổi tỉ số phần trăm thành hệ số thập phân hoặc phân số tối giản.',
        teacherQuestion: 'Làm thế nào để khử số thập phân trong phương trình 0,18x + 0,21y = 120?',
        teacherMistake: 'Tìm xong x, y theo kế hoạch nhưng đề hỏi số sản phẩm thực tế mà quên nhân thêm tỉ lệ.',
      },
      {
        id: 4,
        shortTitle: '4. Liên môn Hóa học & Vé',
        fullTitle: 'Vận dụng • Cân bằng phương trình hóa học & Bài toán mua vé (SGK trang 23)',
        sgkPageBadge: 'Vận dụng • SGK trang 23',
        studentObjective: 'Ứng dụng hệ phương trình bậc nhất hai ẩn để tìm hệ số cân bằng phản ứng hóa học và bài toán kinh tế.',
        visualType: 'b3_motion_tickets',
        theorySummary: [
          'Định luật bảo toàn nguyên tố: Số nguyên tử của mỗi nguyên tố ở hai vế phản ứng hóa học phải bằng nhau.',
          'Trong bài toán vé tham quan: Tổng số tiền = (Giá vé người lớn × Số vé người lớn) + (Giá vé trẻ em × Số vé trẻ em).',
        ],
        formulaDisplay: 'x + y = 20 (vé)   và   50x + 30y = 760 (nghìn đồng)',
        guidedTaskTitle: 'Mô hình hóa • Bài toán mua 20 vé tham quan',
        guidedProblemStatement:
          'Một đoàn khách mua 20 vé gồm x vé người lớn (50 nghìn đồng/vé) và y vé trẻ em (30 nghìn đồng/vé) hết tổng cộng 760 nghìn đồng. Ta có hệ: { x + y = 20 ; 50x + 30y = 760 }.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Chia hai vế của 50x + 30y = 760 cho 10, rồi trừ đi 3(x + y) = 60, ta tìm được số vé người lớn x = ?',
            expectedAnswers: ['8'],
            placeholder: 'Nhập số vé người lớn x',
            hint: '5x + 3y = 76 và 3x + 3y = 60 ⇒ 2x = 16 ⇒ x = 8.',
            solutionText: '2x = 16 ⇒ x = 8 (vé người lớn).',
          },
          {
            prompt: 'Bước 2: Số vé trẻ em y = 20 − x bằng bao nhiêu?',
            expectedAnswers: ['12'],
            placeholder: 'Nhập số vé trẻ em y',
            hint: '20 − 8 = 12.',
            solutionText: 'y = 20 − 8 = 12 (vé trẻ em). Thử lại: 8·50 + 12·30 = 400 + 360 = 760 nghìn đồng!',
          },
        ],
        faqTitle: 'Vì sao hệ phương trình có thể dùng để cân bằng phản ứng hóa học?',
        faqAnswer:
          'Mỗi nguyên tố hóa học cho một phương trình bậc nhất liên hệ giữa các hệ số x, y trước công thức hóa học.',
        processTitle: 'Kiểm tra tính hợp lý của nghiệm thực tế',
        processSteps: [
          'Số vé, số người, số con vật: phải là số tự nhiên.',
          'Thay ngược vào đề bài gốc bằng lời văn để kiểm tra một lần nữa.',
        ],
        importantTip: 'Chia cả hai vế của phương trình tiền tệ cho 10 hoặc 1000 giúp việc tính nhẩm nhanh và ít sai sót.',
        teacherGoal: 'Mở rộng ứng dụng liên môn Khoa học tự nhiên (Hóa học) và Tài chính cá nhân.',
        teacherQuestion: 'Nếu giải ra x = 8,5 vé tham quan thì ta kết luận như thế nào?',
        teacherMistake: 'Không rút gọn các số 0 ở hai vế dẫn đến nhân chia số lớn dễ nhầm.',
      },
      {
        id: 5,
        shortTitle: '5. Tổng kết Chương I',
        fullTitle: 'Tổng kết phương pháp giải toán bằng cách lập hệ phương trình',
        sgkPageBadge: 'Tổng kết • SGK trang 23',
        studentObjective: 'Hệ thống hóa các dạng toán thực tế thường gặp trong Chương I Toán 9.',
        visualType: 'b3_modeling_pipeline',
        theorySummary: [
          'Dạng 1: Toán tìm hai số, chữ số của số tự nhiên có hai chữ số (ab = 10a + b).',
          'Dạng 2: Toán chuyển động (ngược chiều, cùng chiều, xuôi/ngược dòng nước).',
          'Dạng 3: Toán năng suất, phần trăm vượt kế hoạch, làm chung – làm riêng.',
        ],
        formulaDisplay: 'Số có hai chữ số:  ab̅ = 10a + b   (a ∈ {1..9}, b ∈ {0..9})',
        guidedTaskTitle: 'Bài toán tìm số tự nhiên có hai chữ số',
        guidedProblemStatement:
          'Tìm số tự nhiên có hai chữ số ab̅, biết tổng hai chữ số a + b = 9 và nếu đổi chỗ hai chữ số cho nhau thì được số mới ba̅ lớn hơn số cũ 27 đơn vị: (10b + a) − (10a + b) = 27 ⇔ b − a = 3.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Từ hệ { a + b = 9 ; −a + b = 3 }, chữ số hàng đơn vị b bằng bao nhiêu?',
            expectedAnswers: ['6'],
            placeholder: 'Nhập chữ số b',
            hint: 'Cộng hai phương trình: 2b = 12 ⇒ b = 6.',
            solutionText: '2b = 12 ⇒ b = 6, suy ra chữ số hàng chục a = 9 − 6 = 3.',
          },
          {
            prompt: 'Bước 2: Vậy số tự nhiên có hai chữ số cần tìm ab̅ là số nào?',
            expectedAnswers: ['36'],
            placeholder: 'Nhập số có hai chữ số',
            hint: 'Ghép a = 3 và b = 6.',
            solutionText: 'Số cần tìm là 36 (đổi chỗ thành 63, và 63 − 36 = 27).',
          },
        ],
        faqTitle: 'Biểu diễn số tự nhiên có hai chữ số ab̅ như thế nào trong phương trình?',
        faqAnswer:
          'Không được viết là a·b (tích hai chữ số), mà phải viết theo cấu tạo thập phân: ab̅ = 10a + b, trong đó a ∈ ℕ, 1 ≤ a ≤ 9 và b ∈ ℕ, 0 ≤ b ≤ 9.',
        processTitle: 'Bí quyết đạt điểm tối đa bài toán lập hệ phương trình',
        processSteps: [
          '1. Gọi ẩn rõ ràng + Đơn vị + Điều kiện chặt chẽ.',
          '2. Lập luận từng phương trình từ dữ kiện đề bài trước khi ghép thành hệ.',
          '3. Giải hệ chính xác, ghi rõ “(thỏa mãn điều kiện)” và kết luận.',
        ],
        importantTip: 'Với bài toán làm chung công việc: Nếu đội A làm riêng xong trong x giờ thì mỗi giờ đội A làm được 1/x công việc.',
        teacherGoal: 'Tổng kết toàn diện các dạng bài tập trong Bài 3 và chuẩn bị kiểm tra Chương I.',
        teacherQuestion: 'Vì sao khi đổi chỗ hai chữ số của ab̅, hiệu (10b + a) − (10a + b) luôn chia hết cho 9?',
        teacherMistake: 'Viết nhầm giá trị số có hai chữ số ab̅ thành a + b hoặc a·b.',
      },
    ],
    quiz: [
      {
        id: 'b3_q1',
        stem: 'Bước đầu tiên khi giải bài toán bằng cách lập hệ phương trình là gì?',
        options: [
          'Chọn hai ẩn và đặt điều kiện thích hợp cho chúng',
          'Cộng ngay hai phương trình',
          'Kết luận nghiệm của bài toán',
          'Vẽ đồ thị hai đường thẳng',
        ],
        correctIndex: 0,
        explanation: 'Theo SGK trang 21, Bước 1 là chọn ẩn, đặt điều kiện thích hợp và biểu diễn các đại lượng để lập hệ.',
      },
      {
        id: 'b3_q2',
        stem: 'Một ca nô có vận tốc riêng x (km/h) chạy trên sông có vận tốc dòng nước y (km/h) (x > y > 0). Vận tốc ca nô khi đi ngược dòng là:',
        options: ['x − y (km/h)', 'x + y (km/h)', 'x · y (km/h)', 'y − x (km/h)'],
        correctIndex: 0,
        explanation: 'Khi đi ngược dòng, dòng nước cản chuyển động nên vận tốc thực tế là x − y (km/h).',
      },
      {
        id: 'b3_q3',
        stem: 'Gọi a là chữ số hàng chục, b là chữ số hàng đơn vị của số tự nhiên có hai chữ số. Giá trị của số đó được biểu diễn là:',
        options: ['10a + b', 'a + b', 'a · b', '10b + a'],
        correctIndex: 0,
        explanation: 'Chữ số hàng chục có giá trị gấp 10 lần nên ab̅ = 10a + b.',
      },
      {
        id: 'b3_q4',
        stem: 'Hai số có tổng bằng 30 và hiệu bằng 6. Số lớn bằng bao nhiêu?',
        options: ['18', '12', '24', '15'],
        correctIndex: 0,
        explanation: 'Từ x + y = 30 và x − y = 6, cộng hai phương trình được 2x = 36 ⇒ x = 18.',
      },
    ],
    exercises: [
      {
        id: 'ex_1_10',
        code: 'Bài 1.10 (SGK trang 23)',
        title: 'Bài toán cổ • Bó cỏ cho trâu ăn',
        statement: 'Hai người cùng mua chung một tấm vải hết 420 nghìn đồng, người thứ nhất trả nhiều hơn người thứ hai 60 nghìn đồng. Hỏi người thứ nhất phải trả bao nhiêu nghìn đồng?',
        expectedInputLabel: 'Số tiền người thứ nhất (nghìn đồng) =',
        expectedAnswers: ['240'],
        placeholder: 'Nhập số nghìn đồng (VD: 240)',
        hint: 'Gọi x, y là số tiền hai người trả: x + y = 420 và x − y = 60 ⇒ 2x = 480.',
        fullSolution: [
          'Gọi x, y (nghìn đồng) lần lượt là số tiền người thứ nhất và người thứ hai trả (x > y > 0).',
          'Ta có hệ phương trình: { x + y = 420 ; x − y = 60 }.',
          'Cộng từng vế hai phương trình: 2x = 480 ⇒ x = 240; suy ra y = 180 (thỏa mãn).',
        ],
      },
      {
        id: 'ex_1_12',
        code: 'Bài 1.12 (SGK trang 23)',
        title: 'Bài toán mua vở và bút',
        statement: 'Mua 3 quyển vở và 2 chiếc bút hết 46 nghìn đồng; mua 2 quyển vở và 3 chiếc bút cùng loại hết 44 nghìn đồng. Giá một quyển vở là bao nhiêu nghìn đồng?',
        expectedInputLabel: 'Giá 1 quyển vở (nghìn đồng) =',
        expectedAnswers: ['10'],
        placeholder: 'Nhập giá 1 quyển vở (VD: 10)',
        hint: 'Giải hệ { 3x + 2y = 46 ; 2x + 3y = 44 }.',
        fullSolution: [
          'Gọi giá 1 quyển vở là x (nghìn đồng), giá 1 chiếc bút là y (nghìn đồng) (x > 0, y > 0).',
          'Ta có hệ: { 3x + 2y = 46 ; 2x + 3y = 44 }.',
          'Nhân PT(1) với 3, PT(2) với 2: { 9x + 6y = 138 ; 4x + 6y = 88 } ⇒ 5x = 50 ⇒ x = 10, y = 8.',
        ],
      },
    ],
  },

  toan_9_c2_b4: {
    id: 'toan_9_c2_b4',
    chapterBreadcrumb: 'Toán 9 • Chương II • Bài 4',
    lessonShortCode: 'Bài 4',
    lessonTitle: 'Phương trình quy về phương trình bậc nhất một ẩn',
    sgkPagesRange: 'SGK trang 26–30',
    htmlUrl: '/lessons/lop-9/toan/chuong-02/bai-04/index.html',
    storageKey: 'taydo_smart_edu_toan9_c2_b4_v1',
    prevLessonId: 'toan_9_c1_b3',
    prevLessonLabel: '← Bài 3 (Chương I)',
    nextLessonId: 'toan_9_c2_b5',
    nextLessonLabel: 'Bài 5 →',
    activities: [
      {
        id: 1,
        shortTitle: '1. Phương trình tích',
        fullTitle: 'Phương trình tích (ax + b)(cx + d) = 0 (SGK trang 26)',
        sgkPageBadge: 'Mục 1 • SGK trang 26',
        studentObjective: 'Nắm vững nguyên lý tích bằng 0: A·B = 0 ⇔ A = 0 hoặc B = 0 để giải phương trình tích.',
        visualType: 'b4_product_equation',
        theorySummary: [
          'Trong một tích, nếu có một thừa số bằng 0 thì tích bằng 0; ngược lại, nếu tích bằng 0 thì ít nhất một trong các thừa số của tích phải bằng 0.',
          'Muốn giải phương trình (ax + b)(cx + d) = 0, ta giải hai phương trình ax + b = 0 và cx + d = 0, rồi lấy tất cả các nghiệm của chúng.',
        ],
        formulaDisplay: '(ax + b)(cx + d) = 0   ⇔   ax + b = 0  hoặc  cx + d = 0',
        guidedTaskTitle: 'Ví dụ 1 (SGK trang 26) • Giải phương trình tích',
        guidedProblemStatement:
          'Giải phương trình tích: (x + 3)(2x − 6) = 0 bằng cách giải hai phương trình bậc nhất một ẩn.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Giải phương trình thứ nhất x + 3 = 0, ta được nghiệm x₁ bằng bao nhiêu?',
            expectedAnswers: ['-3'],
            placeholder: 'Nhập nghiệm x₁ (VD: -3)',
            hint: 'x + 3 = 0 ⇒ x = −3.',
            solutionText: 'x + 3 = 0 ⇒ x = −3.',
          },
          {
            prompt: 'Bước 2: Giải phương trình thứ hai 2x − 6 = 0, ta được nghiệm x₂ bằng bao nhiêu?',
            expectedAnswers: ['3'],
            placeholder: 'Nhập nghiệm x₂ (VD: 3)',
            hint: '2x = 6 ⇒ x = 3.',
            solutionText: '2x − 6 = 0 ⇒ x = 3. Vậy phương trình có hai nghiệm là x = −3 và x = 3.',
          },
        ],
        faqTitle: 'Khi kết luận nghiệm của phương trình tích, dùng từ “và” hay “hoặc”?',
        faqAnswer:
          'Khi biến đổi phương trình ta viết “ax + b = 0 HOẶC cx + d = 0”, còn khi kết luận tập nghiệm của phương trình ta nêu đầy đủ: “Phương trình có hai nghiệm là x = x₁ và x = x₂” (hoặc S = {x₁; x₂}).',
        processTitle: 'Các bước giải phương trình tích',
        processSteps: [
          'Bước 1: Đưa phương trình về dạng (ax + b)(cx + d) = 0.',
          'Bước 2: Giải hai phương trình bậc nhất ax + b = 0 và cx + d = 0.',
          'Bước 3: Tập hợp tất cả các nghiệm tìm được và kết luận.',
        ],
        importantTip: 'Vế phải của phương trình tích bắt buộc phải bằng 0 trước khi cho từng nhân tử bằng 0!',
        teacherGoal: 'Học sinh hiểu bản chất phép biến đổi tương đương đưa phương trình tích về hai phương trình bậc nhất.',
        teacherQuestion: 'Nếu phương trình có dạng (x + 1)(x − 2) = 4 thì có được suy ra x + 1 = 4 hoặc x − 2 = 4 không?',
        teacherMistake: 'Áp dụng nhầm quy tắc phương trình tích khi vế phải khác 0!',
      },
      {
        id: 2,
        shortTitle: '2. Phân tích thành nhân tử',
        fullTitle: 'Đưa phương trình về dạng tích bằng phân tích đa thức thành nhân tử (SGK trang 27)',
        sgkPageBadge: 'Ví dụ 2 • SGK trang 27',
        studentObjective: 'Chuyển vế sang vế trái và phân tích đa thức thành nhân tử để tạo phương trình tích.',
        visualType: 'b4_product_equation',
        theorySummary: [
          'Nhiều phương trình chưa có ngay dạng tích nhưng có thể đưa về dạng tích bằng cách chuyển tất cả các hạng tử sang vế trái (vế phải bằng 0), rồi phân tích vế trái thành nhân tử.',
          'Các kỹ thuật thường dùng: Đặt nhân tử chung, dùng hằng đẳng thức (A² − B² = (A − B)(A + B)).',
        ],
        formulaDisplay: 'A(x)·B(x) + A(x)·C(x) = 0   ⇔   A(x)·[B(x) + C(x)] = 0',
        guidedTaskTitle: 'Luyện tập 1 (SGK trang 27) • Phân tích thành nhân tử',
        guidedProblemStatement:
          'Giải phương trình: (x − 4)(2x + 1) − (x − 4)(x − 2) = 0 bằng cách đặt nhân tử chung (x − 4).',
        guidedSteps: [
          {
            prompt: 'Bước 1: Đặt (x − 4) làm nhân tử chung: (x − 4)[(2x + 1) − (x − 2)] = 0. Thu gọn ngoặc vuông được biểu thức nào?',
            expectedAnswers: ['x+3', '3+x'],
            placeholder: 'Nhập biểu thức thu gọn (VD: x + 3)',
            hint: '(2x + 1) − (x − 2) = 2x + 1 − x + 2 = x + 3.',
            solutionText: '(2x + 1) − (x − 2) = x + 3. Phương trình trở thành (x − 4)(x + 3) = 0.',
          },
          {
            prompt: 'Bước 2: Nghiệm dương của phương trình (x − 4)(x + 3) = 0 là x = ?',
            expectedAnswers: ['4'],
            placeholder: 'Nhập nghiệm dương x',
            hint: 'x − 4 = 0 ⇒ x = 4; x + 3 = 0 ⇒ x = −3.',
            solutionText: 'Phương trình có hai nghiệm là x = 4 và x = −3.',
          },
        ],
        faqTitle: 'Có được chia cả hai vế của phương trình (x − 4)(2x + 1) = (x − 4)(x − 2) cho (x − 4) không?',
        faqAnswer:
          'TUYỆT ĐỐI KHÔNG! Nếu chia cả hai vế cho (x − 4) ta sẽ làm MẤT NGHIỆM x = 4. Phải chuyển vế và đặt (x − 4) làm nhân tử chung!',
        processTitle: 'Quy tắc vàng khi gặp nhân tử chung ở hai vế',
        processSteps: [
          '1. Chuyển toàn bộ các hạng tử sang vế trái để vế phải bằng 0.',
          '2. Đặt nhân tử chung hoặc dùng hằng đẳng thức.',
          '3. Chú ý đổi dấu khi bỏ ngoặc có dấu trừ đằng trước.',
        ],
        importantTip: 'Không bao giờ giản ước (chia) hai vế cho một biểu thức chứa ẩn vì sẽ làm mất nghiệm.',
        teacherGoal: 'Rèn kỹ năng đặt nhân tử chung và cảnh báo lỗi chia hai vế làm mất nghiệm.',
        teacherQuestion: 'Trong phương trình x² − 5x = 0, nếu chia hai vế cho x thì ta bị mất nghiệm nào?',
        teacherMistake: 'Chia cả hai vế cho nhân tử chứa ẩn (làm mất nghiệm) hoặc quên đổi dấu khi trừ đa thức.',
      },
      {
        id: 3,
        shortTitle: '3. Điều kiện xác định',
        fullTitle: 'Phương trình chứa ẩn ở mẫu & Điều kiện xác định (SGK trang 28)',
        sgkPageBadge: 'Mục 2 • SGK trang 28',
        studentObjective: 'Tìm đúng điều kiện xác định (ĐKXĐ) để tất cả các mẫu thức trong phương trình đều khác 0.',
        visualType: 'b4_rational_domain',
        theorySummary: [
          'Trong phương trình chứa ẩn ở mẫu, các giá trị của ẩn làm cho ít nhất một mẫu thức nhận giá trị bằng 0 không thể là nghiệm của phương trình.',
          'Điều kiện của ẩn để tất cả các mẫu thức trong phương trình đều khác 0 được gọi là điều kiện xác định (viết tắt là ĐKXĐ) của phương trình.',
        ],
        formulaDisplay: 'Mẫu thức M(x) ≠ 0   ⇔   ĐKXĐ của phương trình',
        guidedTaskTitle: 'Ví dụ 3 & Luyện tập 2 (SGK trang 28) • Tìm ĐKXĐ',
        guidedProblemStatement:
          'Xét phương trình chứa ẩn ở mẫu:  (x + 2)/(x − 3) = (2x + 1)/[x(x − 3)]. Hãy xác định các giá trị của x bị loại bởi ĐKXĐ.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Từ mẫu thức (x − 3) ≠ 0, suy ra x phải khác số nào?',
            expectedAnswers: ['3'],
            placeholder: 'Nhập giá trị x cần khác',
            hint: 'x − 3 ≠ 0 ⇒ x ≠ 3.',
            solutionText: 'x − 3 ≠ 0 ⇔ x ≠ 3.',
          },
          {
            prompt: 'Bước 2: Từ mẫu thức x(x − 3) ≠ 0, ngoài x ≠ 3 thì x còn phải khác số nào nữa?',
            expectedAnswers: ['0'],
            placeholder: 'Nhập giá trị thứ hai',
            hint: 'Thừa số x ở mẫu cũng phải khác 0.',
            solutionText: 'ĐKXĐ đầy đủ của phương trình là: x ≠ 0 và x ≠ 3.',
          },
        ],
        faqTitle: 'Khi viết nhiều điều kiện xác định, ta dùng từ “và” hay “hoặc”?',
        faqAnswer:
          'Phải dùng từ “VÀ” (ví dụ: x ≠ 0 VÀ x ≠ 3), vì tại một giá trị x muốn phương trình có nghĩa thì TẤT CẢ các mẫu thức phải đồng thời khác 0.',
        processTitle: 'Cách tìm ĐKXĐ nhanh và không sót',
        processSteps: [
          'Bước 1: Phân tích các mẫu thức thành nhân tử (nếu có mẫu bậc hai như x² − 4 = (x − 2)(x + 2)).',
          'Bước 2: Cho từng nhân tử chứa ẩn ở mẫu khác 0 và kết nối bằng từ “và”.',
        ],
        importantTip: 'Nếu mẫu thức là một số khác 0 (như 2, 5) hoặc luôn dương (như x² + 1) thì không cần đặt điều kiện cho mẫu đó.',
        teacherGoal: 'Học sinh phân biệt rõ liên từ “và” trong ĐKXĐ với liên từ “hoặc” trong phương trình tích.',
        teacherQuestion: 'Vì sao trong ĐKXĐ ta viết “x ≠ 1 và x ≠ −1” chứ không viết “hoặc”?',
        teacherMistake: 'Viết nhầm “x ≠ 1 hoặc x ≠ −1” trong điều kiện xác định.',
      },
      {
        id: 4,
        shortTitle: '4. Giải PT chứa ẩn ở mẫu',
        fullTitle: 'Quy trình 4 bước giải phương trình chứa ẩn ở mẫu (SGK trang 28–29)',
        sgkPageBadge: 'Ví dụ 4 • SGK trang 28–29',
        studentObjective: 'Thực hiện trọn vẹn 4 bước giải phương trình chứa ẩn ở mẫu và biết loại nghiệm không thỏa mãn ĐKXĐ.',
        visualType: 'b4_rational_domain',
        theorySummary: [
          'Bước 1: Tìm điều kiện xác định của phương trình.',
          'Bước 2: Quy đồng mẫu hai vế của phương trình rồi khử mẫu.',
          'Bước 3: Giải phương trình vừa nhận được.',
          'Bước 4 (Kết luận): Đối chiếu ĐKXĐ để nhận hoặc loại nghiệm.',
        ],
        formulaDisplay: 'Bước 1: ĐKXĐ  ➜  Bước 2: Quy đồng & Khử mẫu  ➜  Bước 3: Giải PT  ➜  Bước 4: Đối chiếu ĐKXĐ',
        guidedTaskTitle: 'Ví dụ 4 (SGK trang 28) • Giải và đối chiếu ĐKXĐ',
        guidedProblemStatement:
          'Giải phương trình:  2/(x − 1) + 1/(x + 1) = 3/(x² − 1)  với ĐKXĐ: x ≠ 1 và x ≠ −1.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Quy đồng với mẫu chung (x − 1)(x + 1) và khử mẫu: 2(x + 1) + (x − 1) = 3. Thu gọn vế trái 2(x + 1) + (x − 1) được biểu thức nào?',
            expectedAnswers: ['3x+1', '1+3x'],
            placeholder: 'Nhập vế trái thu gọn (VD: 3x + 1)',
            hint: '2x + 2 + x − 1 = 3x + 1.',
            solutionText: 'Khử mẫu ta được: 2(x + 1) + (x − 1) = 3 ⇔ 3x + 1 = 3.',
          },
          {
            prompt: 'Bước 2: Từ 3x + 1 = 3, nghiệm x tìm được (dạng phân số a/b) là bao nhiêu?',
            expectedAnswers: ['2/3'],
            placeholder: 'Nhập phân số (VD: 2/3)',
            hint: '3x = 2 ⇒ x = 2/3.',
            solutionText: '3x = 2 ⇒ x = 2/3 (thỏa mãn ĐKXĐ x ≠ ±1). Vậy nghiệm của phương trình là x = 2/3.',
          },
        ],
        faqTitle: 'Vì sao bước khử mẫu dùng dấu suy ra (⇒) chứ không dùng dấu tương đương (⇔)?',
        faqAnswer:
          'Khi khử mẫu (nhân hai vế với mẫu thức chung), phương trình mới có thể xuất hiện thêm nghiệm ngoại lai làm mẫu bằng 0. Do đó phải đối chiếu ĐKXĐ ở Bước 4!',
        processTitle: '4 bước chuẩn giải phương trình chứa ẩn ở mẫu',
        processSteps: [
          'Bước 1: Tìm ĐKXĐ.',
          'Bước 2: Quy đồng mẫu hai vế rồi khử mẫu.',
          'Bước 3: Giải phương trình bậc nhất / phương trình tích sau khi khử mẫu.',
          'Bước 4: Kiểm tra ĐKXĐ và kết luận nghiệm.',
        ],
        importantTip: 'Nếu tìm ra x = 1 mà ĐKXĐ là x ≠ 1 thì phải ghi rõ “(loại vì không thỏa mãn ĐKXĐ)”.',
        teacherGoal: 'Nhấn mạnh tầm quan trọng của Bước 4 (đối chiếu ĐKXĐ để loại nghiệm ngoại lai).',
        teacherQuestion: 'Nếu bỏ qua Bước 1 và Bước 4 thì bài giải sẽ mắc sai lầm nghiêm trọng nào?',
        teacherMistake: 'Quên đối chiếu ĐKXĐ dẫn đến nhận cả nghiệm làm mẫu bằng 0.',
      },
      {
        id: 5,
        shortTitle: '5. Vận dụng thực tế',
        fullTitle: 'Vận dụng • Giải bài toán thực tế bằng phương trình chứa ẩn ở mẫu (SGK trang 29–30)',
        sgkPageBadge: 'Vận dụng • SGK trang 29–30',
        studentObjective: 'Vận dụng phương trình tích và phương trình chứa ẩn ở mẫu vào bài toán chuyển động và hình học.',
        visualType: 'b4_product_equation',
        theorySummary: [
          'Trong bài toán chuyển động có quãng đường s không đổi, thời gian t = s / v thường tạo ra phương trình chứa ẩn ở mẫu.',
          'Trong bài toán diện tích hình học, biểu thức diện tích thường đưa về phương trình tích.',
        ],
        formulaDisplay: 't₁ − t₂ = Δt   ⇔   s / x − s / (x + a) = Δt',
        guidedTaskTitle: 'Vận dụng • Bài toán diện tích khu vườn',
        guidedProblemStatement:
          'Một mảnh đất hình chữ nhật có chiều rộng x (m) và chiều dài (2x − 3) (m) (x > 1,5). Sau khi biến đổi điều kiện diện tích, ta thu được phương trình tích (x − 6)(2x + 9) = 0.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Giải phương trình (x − 6)(2x + 9) = 0, nghiệm dương thỏa mãn điều kiện x > 1,5 là x = ?',
            expectedAnswers: ['6'],
            placeholder: 'Nhập chiều rộng x (m)',
            hint: 'x = 6 (nhận) hoặc x = −9/2 (loại vì âm).',
            solutionText: 'x = 6 (thỏa mãn x > 1,5), còn x = −4,5 bị loại.',
          },
          {
            prompt: 'Bước 2: Với chiều rộng x = 6 (m), chiều dài 2x − 3 bằng bao nhiêu mét?',
            expectedAnswers: ['9'],
            placeholder: 'Nhập chiều dài (m)',
            hint: '2·6 − 3 = 9.',
            solutionText: 'Chiều dài mảnh đất là 2(6) − 3 = 9 (m).',
          },
        ],
        faqTitle: 'Khi giải bài toán thực tế dẫn đến phương trình tích, vì sao thường loại một nghiệm?',
        faqAnswer:
          'Vì độ dài cạnh hình học, vận tốc, thời gian phải là số dương, nên nghiệm âm của phương trình tích sẽ bị loại khi đối chiếu điều kiện.',
        processTitle: 'Tổng kết kiến thức Bài 4',
        processSteps: [
          '1. Phương trình tích: (ax + b)(cx + d) = 0 ⇔ ax + b = 0 hoặc cx + d = 0.',
          '2. Phương trình chứa ẩn ở mẫu: Tìm ĐKXĐ → Quy đồng khử mẫu → Giải → Đối chiếu ĐKXĐ.',
        ],
        importantTip: 'Luôn kiểm tra cả ĐKXĐ của mẫu thức lẫn điều kiện thực tế (x > 0) của bài toán có lời văn.',
        teacherGoal: 'Kết nối hai dạng phương trình của Bài 4 với ứng dụng thực tiễn.',
        teacherQuestion: 'Bài toán thực tế nào dẫn đến phương trình chứa ẩn ở mẫu?',
        teacherMistake: 'Nhận cả nghiệm âm khi tính độ dài cạnh hoặc vận tốc.',
      },
    ],
    quiz: [
      {
        id: 'b4_q1',
        stem: 'Tập nghiệm của phương trình (x − 5)(3x + 6) = 0 là:',
        options: ['S = {5; −2}', 'S = {−5; 2}', 'S = {5; 2}', 'S = {−5; −2}'],
        correctIndex: 0,
        explanation: 'x − 5 = 0 ⇔ x = 5; 3x + 6 = 0 ⇔ x = −2. Vậy S = {5; −2}.',
      },
      {
        id: 'b4_q2',
        stem: 'Điều kiện xác định của phương trình 5/(x − 2) + x/(x + 4) = 1 là:',
        options: ['x ≠ 2 và x ≠ −4', 'x ≠ −2 và x ≠ 4', 'x ≠ 2 hoặc x ≠ −4', 'x > 2'],
        correctIndex: 0,
        explanation: 'Tất cả các mẫu thức phải đồng thời khác 0: x − 2 ≠ 0 và x + 4 ≠ 0 ⇔ x ≠ 2 và x ≠ −4.',
      },
      {
        id: 'b4_q3',
        stem: 'Phương trình x² − 7x = 0 có các nghiệm là:',
        options: ['x = 0 và x = 7', 'Chỉ có x = 7', 'x = 0 và x = −7', 'x = 7 và x = −7'],
        correctIndex: 0,
        explanation: 'Đặt nhân tử chung x(x − 7) = 0 ⇔ x = 0 hoặc x = 7.',
      },
      {
        id: 'b4_q4',
        stem: 'Giải phương trình (x + 2)/(x − 2) − 1/x = 2/[x(x − 2)] ta được:',
        options: ['Phương trình vô nghiệm (vì x = 2 không thỏa ĐKXĐ)', 'x = 2', 'x = 0', 'x = −2'],
        correctIndex: 0,
        explanation: 'ĐKXĐ: x ≠ 0 và x ≠ 2. Khử mẫu: x(x + 2) − (x − 2) = 2 ⇒ x² + x = 0 ⇒ x = 0 (loại) hoặc x = −1.',
      },
    ],
    exercises: [
      {
        id: 'ex_2_1',
        code: 'Bài 2.1 (SGK trang 30)',
        title: 'Giải phương trình tích',
        statement: 'Giải phương trình (2x − 8)(x + 5) = 0. Hãy nhập nghiệm dương của phương trình.',
        expectedInputLabel: 'Nghiệm dương x =',
        expectedAnswers: ['4'],
        placeholder: 'Nhập nghiệm dương (VD: 4)',
        hint: '2x − 8 = 0 ⇒ x = 4; x + 5 = 0 ⇒ x = −5.',
        fullSolution: [
          '(2x − 8)(x + 5) = 0 ⇔ 2x − 8 = 0 hoặc x + 5 = 0.',
          '• 2x − 8 = 0 ⇔ x = 4.',
          '• x + 5 = 0 ⇔ x = −5.',
          'Vậy phương trình có hai nghiệm là x = 4 và x = −5.',
        ],
      },
      {
        id: 'ex_2_3',
        code: 'Bài 2.3 (SGK trang 30)',
        title: 'Giải phương trình chứa ẩn ở mẫu',
        statement: 'Giải phương trình (2x − 5)/(x + 3) = 1. Nghiệm x bằng bao nhiêu?',
        expectedInputLabel: 'x =',
        expectedAnswers: ['8'],
        placeholder: 'Nhập nghiệm x (VD: 8)',
        hint: 'ĐKXĐ: x ≠ −3. Khử mẫu: 2x − 5 = x + 3 ⇒ x = 8.',
        fullSolution: [
          'Điều kiện xác định: x ≠ −3.',
          'Quy đồng và khử mẫu: 2x − 5 = x + 3.',
          'Chuyển vế: 2x − x = 3 + 5 ⇔ x = 8 (thỏa mãn ĐKXĐ).',
          'Vậy nghiệm của phương trình là x = 8.',
        ],
      },
    ],
  },

  toan_9_c2_b5: {
    id: 'toan_9_c2_b5',
    chapterBreadcrumb: 'Toán 9 • Chương II • Bài 5',
    lessonShortCode: 'Bài 5',
    lessonTitle: 'Bất đẳng thức và tính chất',
    sgkPagesRange: 'SGK trang 31–35',
    htmlUrl: '/lessons/lop-9/toan/chuong-02/bai-05/index.html',
    storageKey: 'taydo_smart_edu_toan9_c2_b5_v1',
    prevLessonId: 'toan_9_c2_b4',
    prevLessonLabel: '← Bài 4',
    activities: [
      {
        id: 1,
        shortTitle: '1. Khái niệm Bất đẳng thức',
        fullTitle: 'Khái niệm bất đẳng thức & Thứ tự trên trục số (SGK trang 31–32)',
        sgkPageBadge: 'Mục 1 • SGK trang 31–32',
        studentObjective: 'Nhận biết vế trái, vế phải của bất đẳng thức (a < b, a > b, a ≤ b, a ≥ b) và tính chất bắc cầu.',
        visualType: 'b5_number_line_order',
        theorySummary: [
          'Trên trục số nằm ngang, nếu số thực a nằm bên trái số thực b thì a nhỏ hơn b (ký hiệu a < b).',
          'Hệ thức dạng a < b (hay a > b, a ≤ b, a ≥ b) được gọi là bất đẳng thức, trong đó a là vế trái, b là vế phải.',
          'Tính chất bắc cầu: Nếu a < b và b < c thì a < c.',
        ],
        formulaDisplay: 'a < b  và  b < c   ⇒   a < c   (Tính chất bắc cầu)',
        guidedTaskTitle: 'Ví dụ thực tế (SGK trang 31) • Biển báo tốc độ tối đa',
        guidedProblemStatement:
          'Biển báo giao thông hình tròn viền đỏ ghi số 50 cho biết vận tốc tối đa cho phép của xe cơ giới là 50 km/h (nghĩa là v ≤ 50).',
        guidedSteps: [
          {
            prompt: 'Bước 1: Trong bất đẳng thức v ≤ 50, vế phải của bất đẳng thức bằng bao nhiêu?',
            expectedAnswers: ['50'],
            placeholder: 'Nhập vế phải',
            hint: 'Biểu thức bên phải dấu ≤ là 50.',
            solutionText: 'Trong bất đẳng thức v ≤ 50, vế trái là v và vế phải là 50.',
          },
          {
            prompt: 'Bước 2: Áp dụng tính chất bắc cầu: Biết x < −2 và −2 < 0, điền dấu thích hợp (< hoặc >) giữa x và 0:',
            expectedAnswers: ['<'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Vì x < −2 và −2 < 0 nên theo tính chất bắc cầu x < 0.',
            solutionText: 'Theo tính chất bắc cầu: x < −2 và −2 < 0 ⇒ x < 0.',
          },
        ],
        faqTitle: 'Hai bất đẳng thức cùng chiều và ngược chiều là gì?',
        faqAnswer:
          'Hai bất đẳng thức a < b và c < d (hoặc a > b và c > d) được gọi là hai bất đẳng thức CÙNG CHIỀU. Hai bất đẳng thức a < b và c > d được gọi là hai bất đẳng thức NGƯỢC CHIỀU.',
        processTitle: 'Ký hiệu bất đẳng thức không ngặt (≤, ≥)',
        processSteps: [
          'a ≤ b đọc là “a nhỏ hơn hoặc bằng b” (không lớn hơn b).',
          'a ≥ b đọc là “a lớn hơn hoặc bằng b” (không nhỏ hơn b).',
          'Với mọi số thực x, ta luôn có: x² ≥ 0.',
        ],
        importantTip: 'Cụm từ “tối đa M” hoặc “không vượt quá M” viết là x ≤ M; cụm từ “tối thiểu M” hoặc “ít nhất M” viết là x ≥ M.',
        teacherGoal: 'Giúp học sinh chuyển đổi chính xác ngôn ngữ thực tế sang ký hiệu bất đẳng thức.',
        teacherQuestion: '“Số tuổi t để được đi xe gắn máy dưới 50 phân khối là từ đủ 16 tuổi trở lên” viết thành bất đẳng thức nào?',
        teacherMistake: 'Nhầm lẫn giữa “nhỏ hơn 50” (v < 50) và “không vượt quá 50” (v ≤ 50).',
      },
      {
        id: 2,
        shortTitle: '2. Liên hệ với phép cộng',
        fullTitle: 'Liên hệ giữa thứ tự và phép cộng (SGK trang 33)',
        sgkPageBadge: 'Mục 2 • SGK trang 33',
        studentObjective: 'Vận dụng tính chất cộng cùng một số c vào cả hai vế của bất đẳng thức thì giữ nguyên chiều.',
        visualType: 'b5_number_line_order',
        theorySummary: [
          'Khi cộng cùng một số vào cả hai vế của một bất đẳng thức ta được bất đẳng thức mới cùng chiều với bất đẳng thức đã cho.',
          'Với ba số a, b, c bất kỳ: Nếu a < b thì a + c < b + c (tương tự với >, ≤, ≥).',
        ],
        formulaDisplay: 'Nếu  a < b  thì  a + c < b + c  (với mọi số thực c ∈ ℝ)',
        guidedTaskTitle: 'Luyện tập 2 (SGK trang 33) • So sánh không cần tính giá trị',
        guidedProblemStatement:
          'Cho a < b và so sánh hai tổng bằng tính chất liên hệ giữa thứ tự và phép cộng.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Biết −2024 < −2023. Điền dấu (< hoặc >) để so sánh (−2024 + 15) và (−2023 + 15):',
            expectedAnswers: ['<'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Cộng cùng số 15 vào hai vế của −2024 < −2023 giữ nguyên chiều.',
            solutionText: 'Vì −2024 < −2023 nên cộng 15 vào cả hai vế ta được: −2024 + 15 < −2023 + 15.',
          },
          {
            prompt: 'Bước 2: Cho a > b. Điền dấu (< hoặc >) để so sánh (a − 9) và (b − 9):',
            expectedAnswers: ['>'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Trừ 9 tức là cộng (−9) vào cả hai vế, bất đẳng thức giữ nguyên chiều (>).',
            solutionText: 'Vì a > b nên cộng (−9) vào hai vế ta được: a − 9 > b − 9.',
          },
        ],
        faqTitle: 'Khi cộng một số âm vào cả hai vế của bất đẳng thức thì chiều có đổi không?',
        faqAnswer:
          'KHÔNG ĐỔI CHIỀU! Đối với phép cộng (hoặc phép trừ), dù cộng với số dương hay số âm thì bất đẳng thức luôn GIỮ NGUYÊN CHIỀU.',
        processTitle: 'Ứng dụng tính chất cộng để so sánh hai biểu thức',
        processSteps: [
          'Bước 1: Xác định số hạng giống nhau ở cả hai biểu thức (c).',
          'Bước 2: So sánh hai số hạng còn lại (a và b), sau đó cộng c vào hai vế.',
        ],
        importantTip: 'Trừ hai vế cho cùng một số c cũng chính là cộng hai vế với (−c), nên luôn giữ nguyên chiều!',
        teacherGoal: 'Học sinh không bị nhầm lẫn giữa cộng với số âm (giữ chiều) và nhân với số âm (đổi chiều).',
        teacherQuestion: 'Trên trục số, việc cộng thêm c vào cả a và b làm hai điểm dịch chuyển như thế nào?',
        teacherMistake: 'Thấy dấu trừ (ví dụ a − 5 và b − 5) lại tưởng là phải đổi chiều bất đẳng thức.',
      },
      {
        id: 3,
        shortTitle: '3. Nhân với số dương',
        fullTitle: 'Liên hệ giữa thứ tự và phép nhân với số dương (SGK trang 34)',
        sgkPageBadge: 'Mục 3a • SGK trang 34',
        studentObjective: 'Nhân cả hai vế của bất đẳng thức với một số dương (c > 0) thì được bất đẳng thức mới cùng chiều.',
        visualType: 'b5_multiply_negative',
        theorySummary: [
          'Khi nhân cả hai vế của một bất đẳng thức với cùng một số dương, ta được bất đẳng thức mới cùng chiều với bất đẳng thức đã cho.',
          'Với ba số a, b, c mà c > 0: Nếu a < b thì a·c < b·c (và nếu a ≤ b thì a·c ≤ b·c).',
        ],
        formulaDisplay: 'Nếu  a < b  và  c > 0   thì   a · c < b · c   (Giữ nguyên chiều)',
        guidedTaskTitle: 'Ví dụ • Nhân với số dương và kết hợp phép cộng',
        guidedProblemStatement:
          'Cho a < b. Hãy so sánh hai biểu thức 5a + 3 và 5b + 3 qua hai bước biến đổi.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Từ a < b, nhân hai vế với 5 (5 > 0), điền dấu (< hoặc >) giữa 5a và 5b:',
            expectedAnswers: ['<'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Nhân với số dương 5 giữ nguyên chiều (<).',
            solutionText: 'Vì a < b và 5 > 0 nên 5a < 5b.',
          },
          {
            prompt: 'Bước 2: Cộng 3 vào cả hai vế của 5a < 5b, điền dấu (< hoặc >) giữa (5a + 3) và (5b + 3):',
            expectedAnswers: ['<'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Cộng 3 vào hai vế giữ nguyên chiều (<).',
            solutionText: 'Cộng 3 vào hai vế của 5a < 5b ta được 5a + 3 < 5b + 3.',
          },
        ],
        faqTitle: 'Chia cả hai vế cho cùng một số dương c > 0 thì sao?',
        faqAnswer:
          'Chia cho số dương c > 0 chính là nhân với số dương 1/c > 0, nên bất đẳng thức cũng GIỮ NGUYÊN CHIỀU.',
        processTitle: 'So sánh m·a + k và m·b + k (với m > 0)',
        processSteps: [
          'Bước 1: Từ a < b và m > 0 suy ra m·a < m·b.',
          'Bước 2: Cộng k vào cả hai vế suy ra m·a + k < m·b + k.',
        ],
        importantTip: 'Luôn kiểm tra dấu của thừa số nhân c trước khi viết dấu bất đẳng thức.',
        teacherGoal: 'Kết hợp nhuần nhuyễn tính chất nhân số dương và tính chất cộng.',
        teacherQuestion: 'Cho 3a + 1 < 3b + 1, làm thế nào để suy ngược lại a < b?',
        teacherMistake: 'Quên giải thích “vì c > 0” khi trình bày tự luận.',
      },
      {
        id: 4,
        shortTitle: '4. Nhân với số âm (Đổi chiều)',
        fullTitle: 'Liên hệ giữa thứ tự và phép nhân với số âm (SGK trang 34–35)',
        sgkPageBadge: 'Mục 3b • SGK trang 34–35',
        studentObjective: 'Nắm vững quy tắc ĐỔI CHIỀU bất đẳng thức khi nhân (hoặc chia) cả hai vế với cùng một số âm (c < 0).',
        visualType: 'b5_multiply_negative',
        theorySummary: [
          'Khi nhân cả hai vế của một bất đẳng thức với cùng một số âm, ta được bất đẳng thức mới NGƯỢC CHIỀU với bất đẳng thức đã cho.',
          'Với ba số a, b, c mà c < 0: Nếu a < b thì a·c > b·c (và nếu a ≤ b thì a·c ≥ b·c).',
        ],
        formulaDisplay: 'Nếu  a < b  và  c < 0   thì   a · c > b · c   (ĐỔI CHIỀU!)',
        guidedTaskTitle: 'Luyện tập 4 (SGK trang 35) • Nhân với số âm',
        guidedProblemStatement:
          'Cho a < b. Hãy so sánh −4a + 7 và −4b + 7.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Từ a < b, nhân cả hai vế với (−4 < 0), điền dấu (< hoặc >) giữa (−4a) và (−4b):',
            expectedAnswers: ['>'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Nhân với số âm (−4 < 0) phải ĐỔI CHIỀU từ < sang >.',
            solutionText: 'Vì a < b và −4 < 0 nên khi nhân hai vế với −4 ta đổi chiều được: −4a > −4b.',
          },
          {
            prompt: 'Bước 2: Cộng 7 vào hai vế của −4a > −4b, điền dấu (< hoặc >) giữa (−4a + 7) và (−4b + 7):',
            expectedAnswers: ['>'],
            placeholder: 'Nhập dấu < hoặc >',
            hint: 'Cộng 7 giữ nguyên chiều (>) vừa có ở Bước 1.',
            solutionText: 'Cộng 7 vào hai vế của −4a > −4b ta được: −4a + 7 > −4b + 7.',
          },
        ],
        faqTitle: 'Vì sao khi nhân với −1 thì a < b lại đổi thành −a > −b?',
        faqAnswer:
          'Trên trục số, phép lấy số đối (nhân với −1) là phép đối xứng qua gốc 0: điểm nằm bên trái (nhỏ hơn) khi lấy đối xứng qua 0 sẽ sang nằm bên phải (lớn hơn). Ví dụ 2 < 5 nhưng −2 > −5.',
        processTitle: 'Quy trình so sánh m·a + k và m·b + k khi m < 0',
        processSteps: [
          'Bước 1: Từ a < b và m < 0, ĐỔI CHIỀU thành m·a > m·b.',
          'Bước 2: Cộng k vào hai vế (giữ nguyên chiều mới): m·a + k > m·b + k.',
        ],
        importantTip: 'Chia hai vế cho số âm (c < 0) cũng bắt buộc phải ĐỔI CHIỀU bất đẳng thức!',
        teacherGoal: 'Khắc sâu quy tắc đổi chiều khi nhân/chia số âm — nền tảng trực tiếp để giải bất phương trình ở Bài 6.',
        teacherQuestion: 'Cho −3x < 12, nếu chia hai vế cho −3 thì ta được x < −4 hay x > −4?',
        teacherMistake: 'Quên đổi chiều bất đẳng thức khi nhân hoặc chia hai vế cho số âm.',
      },
      {
        id: 5,
        shortTitle: '5. Vận dụng & BĐT mở rộng',
        fullTitle: 'Vận dụng thực tế & Chứng minh bất đẳng thức cơ bản (SGK trang 35)',
        sgkPageBadge: 'Vận dụng • SGK trang 35',
        studentObjective: 'Chứng minh bất đẳng thức dựa trên tính chất (A − B)² ≥ 0 và vận dụng vào bài toán thực tế.',
        visualType: 'b5_number_line_order',
        theorySummary: [
          'Với mọi số thực A, ta luôn có A² ≥ 0 (dấu “=” xảy ra khi và chỉ khi A = 0).',
          'Từ (a − b)² ≥ 0 ⇔ a² − 2ab + b² ≥ 0, cộng 2ab vào hai vế ta chứng minh được: a² + b² ≥ 2ab với mọi a, b ∈ ℝ.',
        ],
        formulaDisplay: '(a − b)² ≥ 0   ⇒   a² + b² ≥ 2ab  (∀a, b ∈ ℝ)',
        guidedTaskTitle: 'Thử thách • Chứng minh a² + 1 ≥ 2a với mọi số thực a',
        guidedProblemStatement:
          'Xét hiệu (a − 1)². Vì bình phương của mọi số thực luôn không âm nên (a − 1)² ≥ 0.',
        guidedSteps: [
          {
            prompt: 'Bước 1: Khai triển hằng đẳng thức (a − 1)² ≥ 0 được a² − 2a + k ≥ 0. Số k bằng bao nhiêu?',
            expectedAnswers: ['1'],
            placeholder: 'Nhập hằng số k',
            hint: '(a − 1)² = a² − 2a + 1.',
            solutionText: '(a − 1)² = a² − 2a + 1 ≥ 0 với mọi a ∈ ℝ.',
          },
          {
            prompt: 'Bước 2: Dấu “=” trong bất đẳng thức a² + 1 ≥ 2a xảy ra khi a bằng bao nhiêu?',
            expectedAnswers: ['1'],
            placeholder: 'Nhập giá trị a',
            hint: '(a − 1)² = 0 ⇔ a − 1 = 0 ⇔ a = 1.',
            solutionText: 'Cộng 2a vào hai vế của a² − 2a + 1 ≥ 0 được a² + 1 ≥ 2a. Dấu “=” xảy ra khi a = 1.',
          },
        ],
        faqTitle: 'Làm thế nào để chứng minh A ≥ B?',
        faqAnswer:
          'Cách phổ biến nhất là xét hiệu A − B và biến đổi hiệu đó về dạng bình phương của một biểu thức (hoặc tổng các bình phương cộng số dương) để suy ra A − B ≥ 0 ⇒ A ≥ B.',
        processTitle: 'Tóm tắt toàn bộ tính chất Bất đẳng thức (Bài 5)',
        processSteps: [
          '1. Tính chất bắc cầu: a < b và b < c ⇒ a < c.',
          '2. Cộng cùng số c: a < b ⇒ a + c < b + c (Giữ chiều).',
          '3. Nhân số dương c > 0: a < b ⇒ a·c < b·c (Giữ chiều).',
          '4. Nhân số âm c < 0: a < b ⇒ a·c > b·c (ĐỔI CHIỀU).',
        ],
        importantTip: 'Tính chất (a − b)² ≥ 0 là công cụ rất mạnh để tìm giá trị nhỏ nhất, lớn nhất trong các câu hỏi vận dụng cao.',
        teacherGoal: 'Tổng kết Bài 5 và giới thiệu phương pháp chứng minh bất đẳng thức bằng hằng đẳng thức.',
        teacherQuestion: 'Từ a² + b² ≥ 2ab, nếu a > 0, b > 0 thì trung bình cộng (x + y)/2 và trung bình nhân √(xy) quan hệ thế nào?',
        teacherMistake: 'Quên chỉ ra điều kiện xảy ra dấu “=” khi tìm giá trị lớn nhất / nhỏ nhất.',
      },
    ],
    quiz: [
      {
        id: 'b5_q1',
        stem: 'Cho a < b. Khẳng định nào sau đây là SAI?',
        options: ['−2a < −2b', 'a + 3 < b + 3', '2a < 2b', 'a − 5 < b − 5'],
        correctIndex: 0,
        explanation: 'Vì −2 < 0 nên khi nhân hai vế của a < b với −2 ta phải đổi chiều thành −2a > −2b.',
      },
      {
        id: 'b5_q2',
        stem: 'Biết −5x > −5y. So sánh x và y ta được:',
        options: ['x < y', 'x > y', 'x = y', 'x ≥ y'],
        correctIndex: 0,
        explanation: 'Nhân cả hai vế của −5x > −5y với (−1/5 < 0), bất đẳng thức đổi chiều thành x < y.',
      },
      {
        id: 'b5_q3',
        stem: 'Biển báo tải trọng cầu ghi “15t” (tối đa 15 tấn). Gọi m (tấn) là khối lượng xe qua cầu, hệ thức đúng là:',
        options: ['m ≤ 15', 'm < 15', 'm ≥ 15', 'm > 15'],
        correctIndex: 0,
        explanation: 'Tối đa 15 tấn nghĩa là khối lượng xe không vượt quá 15 tấn: m ≤ 15.',
      },
      {
        id: 'b5_q4',
        stem: 'Cho m > n. So sánh 4m − 7 và 4n − 7 ta được:',
        options: ['4m − 7 > 4n − 7', '4m − 7 < 4n − 7', '4m − 7 = 4n − 7', '4m − 7 ≤ 4n − 7'],
        correctIndex: 0,
        explanation: 'Từ m > n, nhân với 4 > 0 được 4m > 4n, rồi cộng (−7) vào hai vế được 4m − 7 > 4n − 7.',
      },
    ],
    exercises: [
      {
        id: 'ex_2_7',
        code: 'Bài 2.7 (SGK trang 35)',
        title: 'So sánh hai tích khi nhân với số âm',
        statement: 'Không thực hiện phép tính, hãy điền dấu (< hoặc >) thích hợp để so sánh (−15)·(−9) ở vế trái với 12·(−9) ở vế phải:',
        expectedInputLabel: 'Dấu so sánh =',
        expectedAnswers: ['>'],
        placeholder: 'Nhập dấu < hoặc >',
        hint: 'Vì −15 < 12 và nhân cả hai vế với (−9 < 0) nên phải đổi chiều thành >.',
        fullSolution: [
          'Ta có −15 < 12.',
          'Nhân cả hai vế của bất đẳng thức −15 < 12 với số âm (−9 < 0), bất đẳng thức đổi chiều:',
          '(−15)·(−9) > 12·(−9).',
        ],
      },
      {
        id: 'ex_2_8',
        code: 'Bài 2.8 (SGK trang 35)',
        title: 'Biến đổi bất đẳng thức nhiều bước',
        statement: 'Cho a < b. Hãy điền dấu (< hoặc >) thích hợp để so sánh (−3a − 4) ở vế trái với (−3b − 4) ở vế phải:',
        expectedInputLabel: 'Dấu so sánh =',
        expectedAnswers: ['>'],
        placeholder: 'Nhập dấu < hoặc >',
        hint: 'a < b ⇒ −3a > −3b (vì −3 < 0) ⇒ −3a − 4 > −3b − 4.',
        fullSolution: [
          'Vì a < b và −3 < 0 nên nhân hai vế với −3 ta được: −3a > −3b.',
          'Cộng (−4) vào cả hai vế của −3a > −3b ta được: −3a − 4 > −3b − 4.',
        ],
      },
    ],
  },
};

interface SavedLessonProgress {
  version: 1;
  completedActivities: number[];
  solvedExerciseIds: string[];
  quizAnswers: Record<string, number>;
  quizSubmitted: boolean;
  lastActivityId: number;
}

function loadLessonProgress(storageKey: string): SavedLessonProgress {
  const fallback: SavedLessonProgress = {
    version: 1,
    completedActivities: [1],
    solvedExerciseIds: [],
    quizAnswers: {},
    quizSubmitted: false,
    lastActivityId: 1,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return fallback;
    return {
      version: 1,
      completedActivities: Array.isArray(parsed.completedActivities) ? parsed.completedActivities : [1],
      solvedExerciseIds: Array.isArray(parsed.solvedExerciseIds) ? parsed.solvedExerciseIds : [],
      quizAnswers: parsed.quizAnswers && typeof parsed.quizAnswers === 'object' ? parsed.quizAnswers : {},
      quizSubmitted: Boolean(parsed.quizSubmitted),
      lastActivityId:
        typeof parsed.lastActivityId === 'number' && parsed.lastActivityId >= 1 && parsed.lastActivityId <= 6
          ? parsed.lastActivityId
          : 1,
    };
  } catch {
    return fallback;
  }
}

function normalizeAnswerToken(val: string): string {
  return val.trim().toLowerCase().replace(/\s+/g, '');
}

export interface Toan9Lessons1To5ViewProps {
  lessonId: Toan9LessonId;
  initialRole?: 'student' | 'teacher';
  allowTeacherMode?: boolean;
  onBackToCatalog: () => void;
  onSelectLesson: (nextLessonId: string) => void;
}

export const Toan9Lessons1To5View: React.FC<Toan9Lessons1To5ViewProps> = ({
  lessonId,
  initialRole = 'teacher',
  allowTeacherMode = true,
  onBackToCatalog,
  onSelectLesson,
}) => {
  // Delegate Bài 2 directly to the full 3D Bai2LinearSystemLessonView
  if (lessonId === 'toan_9_c1_b2') {
    return (
      <Bai2LinearSystemLessonView
        initialRole={allowTeacherMode ? initialRole : 'student'}
        allowTeacherMode={allowTeacherMode}
        onBackToCatalog={onBackToCatalog}
        onSelectLesson={onSelectLesson}
      />
    );
  }

  const spec = TOAN9_LESSONS_SPEC[lessonId];
  return (
    <Toan9Standard3DLessonStudio
      key={spec.id}
      spec={spec}
      initialRole={allowTeacherMode ? initialRole : 'student'}
      allowTeacherMode={allowTeacherMode}
      onBackToCatalog={onBackToCatalog}
      onSelectLesson={onSelectLesson}
    />
  );
};

interface Toan9Standard3DLessonStudioProps {
  spec: Toan9LessonSpec;
  initialRole: 'student' | 'teacher';
  allowTeacherMode: boolean;
  onBackToCatalog: () => void;
  onSelectLesson: (nextLessonId: string) => void;
}

const Toan9Standard3DLessonStudio: React.FC<Toan9Standard3DLessonStudioProps> = ({
  spec,
  initialRole,
  allowTeacherMode,
  onBackToCatalog,
  onSelectLesson,
}) => {
  const [roleMode, setRoleMode] = useState<'student' | 'teacher'>(initialRole);
  const [studentSubMode, setStudentSubMode] = useState<'guided' | 'self_practice' | 'html_original'>('guided');
  const [isPresentationCleanMode, setIsPresentationCleanMode] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(true);
  const [copiedStudentLink, setCopiedStudentLink] = useState<boolean>(false);

  const [progress, setProgress] = useState<SavedLessonProgress>(() => loadLessonProgress(spec.storageKey));
  const [activeActivityId, setActiveActivityId] = useState<number>(() => progress.lastActivityId || 1);

  // Step inputs for Activities 1..5
  const [step1Input, setStep1Input] = useState<string>('');
  const [step2Input, setStep2Input] = useState<string>('');
  const [step1Verified, setStep1Verified] = useState<boolean>(false);
  const [step2Verified, setStep2Verified] = useState<boolean>(false);
  const [stepFeedback, setStepFeedback] = useState<{ type: 'ok' | 'err' | 'hint'; text: string } | null>(null);

  // Interactive visual slider state
  const [visualParam, setVisualParam] = useState<number>(2);

  // Right sidebar accordions
  const [faqOpen, setFaqOpen] = useState<boolean>(false);
  const [processOpen, setProcessOpen] = useState<boolean>(true);

  // Teacher step-by-step controls (1..4)
  const [teacherCurrentStep, setTeacherCurrentStep] = useState<number>(2);
  const [teacherShowTheory, setTeacherShowTheory] = useState<boolean>(true);
  const [teacherShowSteps, setTeacherShowSteps] = useState<boolean>(true);
  const [teacherShowConclusion, setTeacherShowConclusion] = useState<boolean>(false);

  // Activity 6 (Exercises & Quiz) state
  const [activeExerciseIdx, setActiveExerciseIdx] = useState<number>(0);
  const [exerciseInput, setExerciseInput] = useState<string>('');
  const [exerciseFeedback, setExerciseFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [showExerciseFullSolution, setShowExerciseFullSolution] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        spec.storageKey,
        JSON.stringify({
          ...progress,
          lastActivityId: activeActivityId,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [progress, activeActivityId, spec.storageKey]);

  // Reset step inputs when switching activity
  useEffect(() => {
    setStep1Input('');
    setStep2Input('');
    setStep1Verified(false);
    setStep2Verified(false);
    setStepFeedback(null);
  }, [activeActivityId]);

  const markActivityCompleted = (actId: number) => {
    setProgress((prev) => ({
      ...prev,
      completedActivities: prev.completedActivities.includes(actId)
        ? prev.completedActivities
        : [...prev.completedActivities, actId],
    }));
  };

  const handleResetLessonProgress = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(spec.storageKey);
      } catch {
        // ignore
      }
    }
    setProgress({
      version: 1,
      completedActivities: [1],
      solvedExerciseIds: [],
      quizAnswers: {},
      quizSubmitted: false,
      lastActivityId: 1,
    });
    setActiveActivityId(1);
  };

  const syncTeacherStepSwitches = (step: number) => {
    setTeacherCurrentStep(step);
    setTeacherShowTheory(step >= 1);
    setTeacherShowSteps(step >= 2);
    setTeacherShowConclusion(step >= 3);
  };

  const allActivitiesNav = [
    ...spec.activities.map((a) => ({
      id: a.id,
      shortTitle: a.shortTitle,
      fullTitle: a.fullTitle,
      sgkPageBadge: a.sgkPageBadge,
      studentObjective: a.studentObjective,
    })),
    {
      id: 6,
      shortTitle: '6. Luyện tập & Bài tập SGK',
      fullTitle: `Luyện tập, Trắc nghiệm & Bài tập (${spec.sgkPagesRange})`,
      sgkPageBadge: `Bài tập • ${spec.sgkPagesRange}`,
      studentObjective: 'Hoàn thành bài tập SGK và câu hỏi trắc nghiệm củng cố toàn bài.',
    },
  ];

  const currentNavMeta = allActivitiesNav.find((a) => a.id === activeActivityId) || allActivitiesNav[0];
  const currentActivityData: LessonActivityData =
    spec.activities.find((a) => a.id === activeActivityId) || spec.activities[spec.activities.length - 1];

  const handleCheckGuidedStep = () => {
    const step1Spec = currentActivityData.guidedSteps[0];
    const step2Spec = currentActivityData.guidedSteps[1];

    if (!step1Verified) {
      const clean1 = normalizeAnswerToken(step1Input);
      if (!clean1) {
        setStepFeedback({ type: 'err', text: 'Em hãy nhập câu trả lời cho Bước 1 trước khi kiểm tra nhé.' });
        return;
      }
      const ok1 = step1Spec.expectedAnswers.some((ans) => normalizeAnswerToken(ans) === clean1);
      if (ok1) {
        setStep1Verified(true);
        setStepFeedback({ type: 'ok', text: `Chính xác Bước 1! ${step1Spec.solutionText}` });
      } else {
        setStepFeedback({ type: 'err', text: `Chưa chính xác. Gợi ý: ${step1Spec.hint}` });
      }
      return;
    }

    if (step2Spec && !step2Verified) {
      const clean2 = normalizeAnswerToken(step2Input);
      if (!clean2) {
        setStepFeedback({ type: 'err', text: 'Em hãy nhập câu trả lời cho Bước 2 nhé.' });
        return;
      }
      const ok2 = step2Spec.expectedAnswers.some((ans) => normalizeAnswerToken(ans) === clean2);
      if (ok2) {
        setStep2Verified(true);
        markActivityCompleted(activeActivityId);
        setStepFeedback({
          type: 'ok',
          text: `Xuất sắc! Em đã hoàn thành cả 2 bước. ${step2Spec.solutionText}`,
        });
      } else {
        setStepFeedback({ type: 'err', text: `Bước 2 chưa đúng. Gợi ý: ${step2Spec.hint}` });
      }
    }
  };

  const renderInteractive3DVisual = (act: LessonActivityData) => {
    switch (act.visualType) {
      case 'b1_linear_eq_balance':
        return (
          <div className="rounded-2xl border border-[#CBD5E1] bg-gradient-to-b from-[#EFF6FF] to-[#F8FAFC] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#195E3E] uppercase tracking-wider">
                Mô hình 3D • Cân bằng đại lượng (Gà x &amp; Chó y)
              </span>
              <div className="flex items-center gap-2 text-xs font-bold text-[#102A43]">
                <span>Số gà x = {16 + visualParam * 2}</span>
                <span>•</span>
                <span>Số chó y = {36 - (16 + visualParam * 2)}</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={6}
              step={1}
              value={visualParam}
              onChange={(e) => setVisualParam(Number(e.target.value))}
              className="w-full accent-[#195E3E] cursor-pointer"
            />
            {(() => {
              const chickens = 16 + visualParam * 2;
              const dogs = 36 - chickens;
              const legs = 2 * chickens + 4 * dogs;
              const isExact = legs === 100;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">Tổng số con (x + y)</div>
                    <div className="text-lg font-black text-[#102A43]">{chickens + dogs} / 36 con</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                    <div className="text-[11px] font-bold text-slate-500">Tổng số chân (2x + 4y)</div>
                    <div className={`text-lg font-black ${isExact ? 'text-[#15803D]' : 'text-[#D97706]'}`}>
                      {legs} / 100 chân
                    </div>
                  </div>
                  <div
                    className={`p-2.5 rounded-xl border flex items-center justify-center font-extrabold text-xs ${
                      isExact
                        ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]'
                        : 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
                    }`}
                  >
                    {isExact
                      ? '✓ Nghiệm đúng: (22 gà; 14 chó)!'
                      : 'Kéo thanh trượt để đạt đúng 100 chân'}
                  </div>
                </div>
              );
            })()}
          </div>
        );

      case 'b1_coord_line':
      case 'b1_system_intersection':
        return (
          <div className="rounded-2xl border border-[#CBD5E1] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#195E3E]">
              <span>Mặt phẳng tọa độ Oxy • Giao điểm hai đường thẳng d₁ và d₂</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]">
                Giao điểm M(2; 1)
              </span>
            </div>
            <svg viewBox="0 0 420 190" className="w-full h-44 rounded-xl bg-[#F8FAFC] border border-slate-200">
              {/* Grid */}
              {[60, 110, 160, 210, 260, 310, 360].map((x) => (
                <line key={`vx-${x}`} x1={x} y1={10} x2={x} y2={180} stroke="#E2E8F0" strokeWidth="1" />
              ))}
              {[35, 75, 115, 155].map((y) => (
                <line key={`hy-${y}`} x1={20} y1={y} x2={400} y2={y} stroke="#E2E8F0" strokeWidth="1" />
              ))}
              {/* Axes */}
              <line x1={20} y1={115} x2={400} y2={115} stroke="#334155" strokeWidth="2" />
              <line x1={160} y1={15} x2={160} y2={180} stroke="#334155" strokeWidth="2" />
              <text x={390} y={132} fontSize="12" fontWeight="bold" fill="#334155">x</text>
              <text x={168} y={26} fontSize="12" fontWeight="bold" fill="#334155">y</text>
              {/* Line d1: x + 2y = 4 */}
              <line x1={60} y1={15} x2={360} y2={135} stroke="#16A34A" strokeWidth="3" />
              <text x={72} y={32} fontSize="11" fontWeight="bold" fill="#15803D">d₁: x + 2y = 4</text>
              {/* Line d2: 3x - y = 5 */}
              <line x1={210} y1={175} x2={310} y2={-45} stroke="#EA580C" strokeWidth="3" />
              <text x={295} y={42} fontSize="11" fontWeight="bold" fill="#C2410C">d₂: 3x − y = 5</text>
              {/* Intersection M(2; 1) -> x = 160 + 2*50 = 260, y = 115 - 1*40 = 75 */}
              <circle cx={260} cy={75} r={6} fill="#E11D48" stroke="#FFFFFF" strokeWidth="2" />
              <text x={270} y={72} fontSize="12" fontWeight="900" fill="#BE123C">M(2; 1)</text>
            </svg>
          </div>
        );

      case 'b3_modeling_pipeline':
      case 'b3_motion_tickets':
        return (
          <div className="rounded-2xl border border-[#CBD5E1] bg-gradient-to-r from-[#ECFDF5] via-[#F8FAFC] to-[#FFFBEB] p-4 space-y-3">
            <div className="text-xs font-extrabold text-[#195E3E] uppercase tracking-wider">
              Sơ đồ 3D • Quy trình Mô hình hóa Toán 9 (Bài 3)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3 rounded-xl bg-white border-2 border-[#86EFAC] shadow-2xs">
                <div className="text-xs font-black text-[#15803D]">BƯỚC 1 • LẬP HỆ</div>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Chọn ẩn (x, y), ghi đơn vị, đặt điều kiện và lập 2 phương trình.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border-2 border-[#93C5FD] shadow-2xs">
                <div className="text-xs font-black text-[#1D4ED8]">BƯỚC 2 • GIẢI HỆ</div>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Dùng phương pháp thế hoặc cộng đại số tìm cặp (x; y).
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border-2 border-[#FCD34D] shadow-2xs">
                <div className="text-xs font-black text-[#B45309]">BƯỚC 3 • KẾT LUẬN</div>
                <p className="text-[11px] font-semibold text-slate-600 mt-1">
                  Đối chiếu điều kiện của ẩn và trả lời bài toán thực tế.
                </p>
              </div>
            </div>
          </div>
        );

      case 'b4_product_equation':
      case 'b4_rational_domain':
        return (
          <div className="rounded-2xl border border-[#CBD5E1] bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-[#FEF3C7] p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-[#195E3E]">
              <span>Mô hình 3D • Tách phương trình tích &amp; Chốt chặn ĐKXĐ</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
                Chương II • Bài 4
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-blue-200 space-y-1">
                <div className="text-xs font-black text-blue-800">Nhánh 1: A(x) = 0</div>
                <div className="font-mono text-sm font-bold text-[#102A43]">x + 3 = 0 ⇔ x = −3</div>
              </div>
              <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-1">
                <div className="text-xs font-black text-emerald-800">Nhánh 2: B(x) = 0</div>
                <div className="font-mono text-sm font-bold text-[#102A43]">2x − 6 = 0 ⇔ x = 3</div>
              </div>
            </div>
          </div>
        );

      case 'b5_number_line_order':
      case 'b5_multiply_negative':
        return (
          <div className="rounded-2xl border border-[#CBD5E1] bg-gradient-to-b from-[#F8FAFC] to-[#ECFDF5] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#195E3E]">
                Mô phỏng 3D • Nhân hai vế của bất đẳng thức (−2 &lt; 3) với số c
              </span>
              <div className="inline-flex items-center gap-1.5">
                {[-3, -2, -1, 1, 2, 3].map((cVal) => (
                  <button
                    key={cVal}
                    type="button"
                    onClick={() => setVisualParam(cVal)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer border ${
                      visualParam === cVal
                        ? 'bg-[#195E3E] text-white border-[#195E3E]'
                        : 'bg-white text-[#102A43] border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    c = {cVal}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const cVal = visualParam === 0 ? -2 : visualParam;
              const leftVal = -2 * cVal;
              const rightVal = 3 * cVal;
              const isReversed = cVal < 0;
              return (
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm sm:text-base font-black text-[#102A43] font-mono">
                    (−2) · ({cVal}) = {leftVal} &nbsp;
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-lg text-white ${
                        isReversed ? 'bg-rose-600' : 'bg-emerald-600'
                      }`}
                    >
                      {isReversed ? '>' : '<'}
                    </span>
                    &nbsp; 3 · ({cVal}) = {rightVal}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                      isReversed
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    }`}
                  >
                    {isReversed
                      ? 'c < 0 (Số âm): ĐỔI CHIỀU từ < sang >!'
                      : 'c > 0 (Số dương): GIỮ NGUYÊN CHIỀU (<)'}
                  </span>
                </div>
              );
            })()}
          </div>
        );
    }
  };

  const renderCenterStageContent = () => {
    // Allow viewing original standalone HTML file inside the studio if selected
    if (studentSubMode === 'html_original' && roleMode === 'student') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#EFECE2] px-3.5 py-2 rounded-xl border border-[#D8D0BE]">
            <span className="text-xs font-bold text-[#102A43]">
              Đang hiển thị tệp học liệu trực tiếp: <code>{spec.htmlUrl}</code>
            </span>
            <a
              href={spec.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#195E3E] text-white text-xs font-bold"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Mở tab mới</span>
            </a>
          </div>
          <iframe
            src={spec.htmlUrl}
            title={spec.lessonTitle}
            className="w-full h-[640px] rounded-2xl border border-[#D4CCB8] bg-white"
          />
        </div>
      );
    }

    // Activity 6: Luyện tập, Bài tập SGK & Trắc nghiệm
    if (activeActivityId === 6) {
      const currentEx = spec.exercises[activeExerciseIdx] || spec.exercises[0];
      return (
        <div className="space-y-4">
          {/* Exercise Selector Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {spec.exercises.map((ex, idx) => {
              const isSolved = progress.solvedExerciseIds.includes(ex.id);
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => {
                    setActiveExerciseIdx(idx);
                    setExerciseInput('');
                    setExerciseFeedback(null);
                    setShowExerciseFullSolution(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border cursor-pointer flex items-center gap-1.5 ${
                    activeExerciseIdx === idx
                      ? 'bg-[#195E3E] text-white border-[#195E3E]'
                      : 'bg-white text-[#102A43] border-[#D5CFC0] hover:bg-[#FAF8F2]'
                  }`}
                >
                  {isSolved && <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{ex.code}</span>
                </button>
              );
            })}
          </div>

          {/* Active Exercise Card */}
          <div className="rounded-2xl border border-[#D5CFC0] bg-white p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="px-3 py-1 rounded-full bg-[#E6F4EA] text-[#195E3E] text-xs font-extrabold">
                {currentEx.code} • {currentEx.title}
              </span>
            </div>
            <p className="text-sm sm:text-base font-semibold text-[#102A43] leading-relaxed">
              {currentEx.statement}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <label className="text-sm font-extrabold text-[#102A43]">
                {currentEx.expectedInputLabel}
              </label>
              <input
                type="text"
                value={exerciseInput}
                onChange={(e) => setExerciseInput(e.target.value)}
                placeholder={currentEx.placeholder}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border-2 border-[#8FB89C] bg-[#FBFDFB] text-sm font-bold text-[#102A43] focus:outline-hidden focus:border-[#195E3E]"
              />
              <button
                type="button"
                onClick={() => {
                  const clean = normalizeAnswerToken(exerciseInput);
                  const ok = currentEx.expectedAnswers.some(
                    (ans) => normalizeAnswerToken(ans) === clean
                  );
                  if (ok) {
                    setExerciseFeedback({ ok: true, text: 'Chính xác! Em đã giải đúng bài tập SGK.' });
                    setProgress((prev) => ({
                      ...prev,
                      solvedExerciseIds: prev.solvedExerciseIds.includes(currentEx.id)
                        ? prev.solvedExerciseIds
                        : [...prev.solvedExerciseIds, currentEx.id],
                    }));
                    markActivityCompleted(6);
                  } else {
                    setExerciseFeedback({ ok: false, text: `Chưa đúng. Gợi ý: ${currentEx.hint}` });
                  }
                }}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#237A50] to-[#155234] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                ✓ Kiểm tra đáp số
              </button>
              <button
                type="button"
                onClick={() => setShowExerciseFullSolution((prev) => !prev)}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] border border-[#C9C1B0] text-xs font-bold text-[#102A43] cursor-pointer"
              >
                {showExerciseFullSolution ? 'Ẩn lời giải chi tiết' : 'Xem lời giải chuẩn SGK'}
              </button>
            </div>

            {exerciseFeedback && (
              <div
                className={`p-3 rounded-xl text-xs sm:text-sm font-bold border ${
                  exerciseFeedback.ok
                    ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]'
                    : 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
                }`}
              >
                {exerciseFeedback.text}
              </div>
            )}

            {(showExerciseFullSolution || (roleMode === 'teacher' && teacherShowConclusion)) && (
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-1.5 text-xs sm:text-sm text-[#102A43]">
                <div className="font-extrabold text-[#195E3E]">Lời giải chi tiết:</div>
                {currentEx.fullSolution.map((line, i) => (
                  <p key={i} className="font-medium">
                    • {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 4-Question Quick Diagnostic Quiz */}
          <div className="rounded-2xl border border-[#D5CFC0] bg-white p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-extrabold text-[#102A43]">
                Trắc nghiệm kiểm tra nhanh ({spec.lessonShortCode})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setProgress((prev) => ({ ...prev, quizSubmitted: true }));
                  markActivityCompleted(6);
                }}
                className="px-4 py-1.5 rounded-xl bg-[#E07A16] hover:brightness-105 text-white text-xs font-extrabold cursor-pointer"
              >
                Chấm điểm trắc nghiệm
              </button>
            </div>

            <div className="space-y-3">
              {spec.quiz.map((q, qIdx) => {
                const chosen = progress.quizAnswers[q.id];
                const isSubmitted = progress.quizSubmitted;
                return (
                  <div key={q.id} className="p-3.5 rounded-xl bg-[#FAF8F2] border border-[#E2DDD0] space-y-2">
                    <p className="text-xs sm:text-sm font-extrabold text-[#102A43]">
                      Câu {qIdx + 1}: {q.stem}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = chosen === oIdx;
                        const isCorrect = q.correctIndex === oIdx;
                        let btnStyle = 'bg-white border-[#D5CFC0] text-[#102A43] hover:bg-slate-50';
                        if (isSubmitted) {
                          if (isCorrect) btnStyle = 'bg-[#DCFCE7] border-[#22C55E] text-[#14532D] font-extrabold';
                          else if (isSelected) btnStyle = 'bg-rose-50 border-rose-300 text-rose-800';
                        } else if (isSelected) {
                          btnStyle = 'bg-[#E6F4EA] border-[#195E3E] text-[#195E3E] font-extrabold';
                        }
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() =>
                              setProgress((prev) => ({
                                ...prev,
                                quizAnswers: { ...prev.quizAnswers, [q.id]: oIdx },
                              }))
                            }
                            className={`px-3 py-2 rounded-xl border text-left text-xs font-semibold cursor-pointer transition-all ${btnStyle}`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {isSubmitted && (
                      <p className="text-xs font-semibold text-[#195E3E] pt-1">
                        💡 Giải thích: {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Activities 1..5: 3D Stage (Teacher Presentation View OR Student Guided/Practice View)
    if (roleMode === 'teacher') {
      return (
        <div className="space-y-4">
          {renderInteractive3DVisual(currentActivityData)}

          <div className="rounded-2xl border-2 border-[#D4CCB8] bg-gradient-to-b from-[#FFFEFA] to-[#F5F1E4] p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2DDD0] pb-3">
              <div className="flex items-center gap-3">
                <div className="hidden sm:block shrink-0">
                  <ExplorerRobot3D className="w-16 h-20" showCeramicTiles={false} />
                </div>
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-[#E6F4EA] text-[#195E3E] text-[11px] font-extrabold">
                    {currentActivityData.sgkPageBadge}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-[#102A43] mt-0.5">
                    {currentActivityData.guidedTaskTitle}
                  </h3>
                </div>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]/40 font-mono text-xs sm:text-sm font-black text-[#92400E]">
                {currentActivityData.formulaDisplay}
              </div>
            </div>

            {teacherShowTheory && (
              <div className="p-3.5 rounded-xl bg-[#F0F7F4] border border-[#B7D9C2] space-y-1.5">
                <div className="text-xs font-extrabold text-[#195E3E] uppercase">
                  Kiến thức trọng tâm &amp; Tình huống SGK
                </div>
                {currentActivityData.theorySummary.map((line, idx) => (
                  <p key={idx} className="text-xs sm:text-sm font-semibold text-[#102A43] leading-relaxed">
                    • {line}
                  </p>
                ))}
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-white border border-[#D8D0BE] space-y-2">
              <div className="text-xs font-extrabold text-[#B45309] uppercase">
                Bài toán trình chiếu trên lớp
              </div>
              <p className="text-sm sm:text-base font-bold text-[#102A43]">
                {currentActivityData.guidedProblemStatement}
              </p>
            </div>

            {teacherShowSteps && (
              <div className="space-y-2.5">
                {currentActivityData.guidedSteps.map((st, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-[#FAF8F2] border border-[#C9C1B0] space-y-1"
                  >
                    <div className="text-xs sm:text-sm font-bold text-[#163628]">{st.prompt}</div>
                    {teacherShowConclusion && (
                      <div className="text-xs sm:text-sm font-extrabold text-[#15803D] pt-1">
                        ✓ Đáp án: {st.solutionText}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#FFF6E5] border border-[#E5B87B] flex items-center gap-2.5 text-xs sm:text-sm font-extrabold text-[#9A3412]">
              <HelpCircle className="w-5 h-5 text-[#D97706] shrink-0" />
              <span>Câu hỏi tương tác lớp học: {currentActivityData.teacherQuestion}</span>
            </div>
          </div>
        </div>
      );
    }

    // STUDENT MODE (Học có hướng dẫn / Tự luyện)
    return (
      <div className="space-y-4">
        {renderInteractive3DVisual(currentActivityData)}

        <div className="rounded-2xl border border-[#D5CFC0] bg-white p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="hidden sm:block shrink-0">
                <ExplorerRobot3D className="w-16 h-20" showCeramicTiles={false} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-extrabold text-[#195E3E]">
                  {currentActivityData.guidedTaskTitle}
                </div>
                <p className="text-xs sm:text-sm font-semibold text-[#102A43] leading-relaxed">
                  {currentActivityData.guidedProblemStatement}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F2] border border-[#E2DDD0] text-center font-mono text-sm sm:text-base font-extrabold text-[#195E3E]">
            {currentActivityData.formulaDisplay}
          </div>

          {/* Step 1 Input */}
          <div className="rounded-xl border border-[#B7D9C2] bg-[#F4FAF6] p-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#163628]">
              <span className="w-6 h-6 rounded-full bg-[#195E3E] text-white flex items-center justify-center text-xs shrink-0">
                1
              </span>
              <span>{currentActivityData.guidedSteps[0].prompt}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-8">
              <input
                type="text"
                value={step1Input}
                onChange={(e) => setStep1Input(e.target.value)}
                placeholder={currentActivityData.guidedSteps[0].placeholder}
                className="flex-1 min-w-[200px] min-h-[42px] px-3.5 py-2 rounded-xl border-2 border-[#74B38E] bg-white text-sm font-bold text-[#102A43] focus:outline-hidden focus:border-[#195E3E]"
              />
              {step1Verified && (
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#15803D]">
                  <CheckCircle2 className="w-4 h-4" /> Đã đúng Bước 1
                </span>
              )}
            </div>
          </div>

          {/* Step 2 Input */}
          {currentActivityData.guidedSteps[1] && (
            <div
              className={`rounded-xl border p-3.5 space-y-2.5 transition-all ${
                step1Verified || studentSubMode === 'self_practice'
                  ? 'border-[#B7D9C2] bg-[#F4FAF6]'
                  : 'border-[#E2DDD0] bg-[#FAF8F2] opacity-80'
              }`}
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#163628]">
                <span className="w-6 h-6 rounded-full bg-[#64748B] text-white flex items-center justify-center text-xs shrink-0">
                  2
                </span>
                <span>{currentActivityData.guidedSteps[1].prompt}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pl-8">
                <input
                  type="text"
                  value={step2Input}
                  onChange={(e) => setStep2Input(e.target.value)}
                  placeholder={currentActivityData.guidedSteps[1].placeholder}
                  className="flex-1 min-w-[200px] min-h-[42px] px-3.5 py-2 rounded-xl border-2 border-[#CBD5E1] bg-white text-sm font-bold text-[#102A43] focus:outline-hidden focus:border-[#195E3E]"
                />
                {step2Verified && (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#15803D]">
                    <CheckCircle2 className="w-4 h-4" /> Hoàn thành!
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons: Kiểm tra bước, Gợi ý, Làm lại */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleCheckGuidedStep}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-b from-[#237A50] to-[#155234] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#0D3822] flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Kiểm tra bước</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const targetStep = !step1Verified
                  ? currentActivityData.guidedSteps[0]
                  : currentActivityData.guidedSteps[1] || currentActivityData.guidedSteps[0];
                setStepFeedback({ type: 'hint', text: `Gợi ý: ${targetStep.hint}` });
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 text-[#D97706]" />
              <span>Gợi ý</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setStep1Input('');
                setStep2Input('');
                setStep1Verified(false);
                setStep2Verified(false);
                setStepFeedback(null);
              }}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#195E3E]" />
              <span>Làm lại</span>
            </button>
          </div>

          {stepFeedback && (
            <div
              className={`p-3 rounded-xl text-xs sm:text-sm font-bold border ${
                stepFeedback.type === 'ok'
                  ? 'bg-[#DCFCE7] border-[#86EFAC] text-[#14532D]'
                  : stepFeedback.type === 'hint'
                    ? 'bg-[#FEF3C7] border-[#FDE68A] text-[#92400E]'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {stepFeedback.text}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[26px] border-2 border-[#D4CCB8] bg-gradient-to-b from-[#EDE8DC] via-[#F4F1E8] to-[#E5DEC9] p-3 sm:p-4 lg:p-5 text-[#102A43] shadow-[0_18px_42px_-15px_rgba(22,54,40,0.22)] font-edtech select-none">
      {/* ====================================================================
          TOP HEADER BAR (Synchronized with Reference Images 1 & 2)
          ==================================================================== */}
      <header className="rounded-2xl border border-[#D8D0BE] bg-gradient-to-b from-[#FBF9F3] to-[#EFEAE0] px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#D5CFC0] text-xs font-bold text-[#163628] flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Quay về danh sách Bài giảng"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay về thư viện</span>
          </button>

          {/* Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#237A50] to-[#154C30] flex items-center justify-center text-amber-300 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="leading-none">
              <span className="block text-sm font-black tracking-tight text-[#163628]">TÂY ĐÔ</span>
              <span className="block text-[11px] font-extrabold text-[#E07A16] tracking-wider">
                SMART EDU
              </span>
            </div>
          </div>

          <span className="text-[#C8BFA8] hidden sm:inline">|</span>

          {/* Mode Badge Pill */}
          {roleMode === 'student' ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#22744D] to-[#155234] text-white text-xs sm:text-sm font-extrabold shadow-xs">
              <GraduationCap className="w-4 h-4 text-amber-200" />
              <span>HỌC SINH TỰ HỌC</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#22744D] to-[#155234] text-white text-xs sm:text-sm font-extrabold shadow-xs">
              <Monitor className="w-4 h-4 text-amber-200" />
              <span>GIÁO VIÊN GIẢNG DẠY</span>
            </div>
          )}

          {/* Breadcrumb & Title */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-bold text-[#195E3E]">
              <span>{spec.chapterBreadcrumb}</span>
              <span className="text-[#94A3B8]">|</span>
              <span className="text-sm sm:text-base lg:text-lg font-extrabold text-[#102A43] truncate">
                {spec.lessonTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Prev / Next Lesson Quick Nav */}
          <div className="inline-flex items-center gap-1">
            {spec.prevLessonId && (
              <button
                type="button"
                onClick={() => onSelectLesson(spec.prevLessonId!)}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E] cursor-pointer"
              >
                {spec.prevLessonLabel}
              </button>
            )}
            {spec.nextLessonId && (
              <button
                type="button"
                onClick={() => onSelectLesson(spec.nextLessonId!)}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E] cursor-pointer"
              >
                {spec.nextLessonLabel}
              </button>
            )}
          </div>

          {roleMode === 'student' ? (
            <>
              <div className="inline-flex rounded-xl bg-[#E5DEC9] p-1 border border-[#CFC6B2]">
                <button
                  type="button"
                  onClick={() => setStudentSubMode('guided')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    studentSubMode === 'guided'
                      ? 'bg-[#195E3E] text-white shadow-2xs'
                      : 'text-[#163628]'
                  }`}
                >
                  Học có hướng dẫn
                </button>
                <button
                  type="button"
                  onClick={() => setStudentSubMode('self_practice')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    studentSubMode === 'self_practice'
                      ? 'bg-[#E07A16] text-white shadow-2xs'
                      : 'text-[#163628]'
                  }`}
                >
                  Tự luyện
                </button>
                <button
                  type="button"
                  onClick={() => setStudentSubMode('html_original')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1 ${
                    studentSubMode === 'html_original'
                      ? 'bg-[#0866FF] text-white shadow-2xs'
                      : 'text-[#163628]'
                  }`}
                  title="Xem tệp bài học HTML gốc"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Bản HTML</span>
                </button>
              </div>

              {allowTeacherMode && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleMode('teacher');
                    setIsPresentationCleanMode(false);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Monitor className="w-3.5 h-3.5 text-[#195E3E]" />
                  <span>Giáo viên giảng dạy</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsPresentationCleanMode((prev) => !prev)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>
                  {isPresentationCleanMode ? 'Thoát màn hình trình chiếu' : 'Mở màn hình trình chiếu'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPresentationCleanMode(false);
                  setRoleMode('student');
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-[#102A43] text-xs sm:text-sm font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#195E3E]" />
                <span>Xem như học sinh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?view=teacher_lectures&lecture=${spec.id}&mode=student`;
                  navigator.clipboard?.writeText(url).catch(() => {});
                  setCopiedStudentLink(true);
                  setTimeout(() => setCopiedStudentLink(false), 2500);
                }}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#E6F4EA] hover:bg-[#D1F0DB] border border-[#9CC5A6] text-[#14532D] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                title="Sao chép đường dẫn chế độ Học sinh tự học để chia sẻ cho lớp"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{copiedStudentLink ? 'Đã chép link HS!' : 'Link Học sinh'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsSoundMuted((prev) => !prev)}
            aria-label={isSoundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/90 border border-[#D5CFC0] text-[#163628] hover:bg-white flex items-center justify-center cursor-pointer"
          >
            {isSoundMuted ? (
              <VolumeX className="w-4 h-4 text-slate-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-[#195E3E]" />
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          MAIN 3-COLUMN WORKSPACE
          ==================================================================== */}
      <div className="mt-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* LEFT SIDEBAR */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-xs">
            <div
              className={`px-4 py-3 flex items-center gap-2.5 font-extrabold text-sm sm:text-base ${
                roleMode === 'student'
                  ? 'bg-gradient-to-r from-[#195E3E] to-[#247B52] text-white'
                  : 'bg-[#EFECE2] text-[#102A43] border-b border-[#D8D0BE]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>{roleMode === 'student' ? 'Hành trình bài học' : 'Kịch bản bài dạy'}</span>
            </div>

            <div className="p-2.5 space-y-2">
              {allActivitiesNav.map((act) => {
                const isActive = act.id === activeActivityId;
                const isDone = progress.completedActivities.includes(act.id);
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActiveActivityId(act.id)}
                    className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-gradient-to-r from-[#195E3E] to-[#257C53] text-white border-[#13462E] shadow-sm'
                        : 'bg-[#FAF8F2] hover:bg-white text-[#102A43] border-[#E2DDD0]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDone && !isActive && (
                        <CheckCircle2 className="w-4 h-4 text-[#195E3E] shrink-0" />
                      )}
                      <span className="truncate">{act.shortTitle}</span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {roleMode === 'student' ? (
            <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-sm text-[#102A43]">
                  <Target className="w-4 h-4 text-[#195E3E]" />
                  <span>Tiến độ tự học</span>
                </div>
                <span className="text-xs font-extrabold text-[#195E3E] tabular-nums">
                  {progress.completedActivities.length}/6 mục
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-[#DFD9C8] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#15803D] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (progress.completedActivities.length / 6) * 100)}%`,
                  }}
                />
              </div>
              <div className="pt-1 flex items-center justify-between text-[11px] text-[#475569]">
                <span>Lưu cục bộ {spec.lessonShortCode}</span>
                <button
                  type="button"
                  onClick={handleResetLessonProgress}
                  className="text-rose-700 hover:underline font-bold cursor-pointer"
                >
                  Đặt lại tiến độ
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-3.5 flex items-center gap-3 shadow-xs">
              <TextbookToan9Badge3D />
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-[#195E3E] uppercase">
                  Kết nối tri thức
                </div>
                <div className="text-sm font-extrabold text-[#102A43]">{spec.sgkPagesRange}</div>
                <div className="text-[11px] font-medium text-[#475569]">
                  {spec.chapterBreadcrumb}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER 3D STAGE */}
        <section
          className={`${
            roleMode === 'teacher' && isPresentationCleanMode ? 'lg:col-span-9' : 'lg:col-span-6'
          } rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-sm`}
        >
          {roleMode === 'teacher' ? (
            <div className="bg-gradient-to-r from-[#2D6A4F] to-[#1B4332] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <Monitor className="w-4 h-4 text-emerald-200" />
                <span>
                  {isPresentationCleanMode
                    ? 'Màn hình trình chiếu lớp học (Đã ẩn ghi chú riêng của Giáo viên)'
                    : 'Xem trước màn hình trình chiếu'}
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-100">
                {currentNavMeta.sgkPageBadge}
              </span>
            </div>
          ) : (
            <div className="bg-[#EFECE2] px-4 py-3 border-b border-[#D8D0BE] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-[#E07A16]" />
                <h2 className="text-base sm:text-lg font-extrabold text-[#102A43]">
                  {currentNavMeta.fullTitle}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E]">
                {studentSubMode === 'guided'
                  ? '🧭 Học có hướng dẫn'
                  : studentSubMode === 'self_practice'
                    ? '✍️ Tự luyện'
                    : '📄 Bản HTML'}
              </span>
            </div>
          )}

          <div className="p-3.5 sm:p-4">{renderCenterStageContent()}</div>
        </section>

        {/* RIGHT SIDEBAR (Unmounted in Teacher Clean Presentation Mode) */}
        {!(roleMode === 'teacher' && isPresentationCleanMode) && (
          <aside className="lg:col-span-3 space-y-3">
            {roleMode === 'student' ? (
              <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-xs">
                <div className="bg-gradient-to-r from-[#195E3E] to-[#247B52] text-white px-4 py-3 flex items-center gap-2 font-extrabold text-sm sm:text-base">
                  <BookOpen className="w-4 h-4" />
                  <span>Trợ giúp tự học</span>
                </div>

                <div className="p-3.5 space-y-3">
                  <div className="p-3 rounded-xl bg-[#E6F4EA] border border-[#B7D9C2] flex items-start gap-2.5">
                    <Target className="w-5 h-5 text-[#195E3E] shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-[#102A43]">
                      <span className="font-extrabold">Mục tiêu:</span>{' '}
                      {currentNavMeta.studentObjective}
                    </div>
                  </div>

                  {/* Accordion 1 */}
                  <div className="rounded-xl border border-[#D5CFC0] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setFaqOpen((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold text-[#102A43] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>{currentActivityData.faqTitle}</span>
                      {faqOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {faqOpen && (
                      <div className="px-3.5 pb-3 text-xs text-[#475569] leading-relaxed border-t border-slate-100 pt-2">
                        {currentActivityData.faqAnswer}
                      </div>
                    )}
                  </div>

                  {/* Accordion 2 */}
                  <div className="rounded-xl border border-[#D5CFC0] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setProcessOpen((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold text-[#102A43] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>{currentActivityData.processTitle}</span>
                      {processOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {processOpen && (
                      <div className="px-3.5 pb-3 text-xs text-[#475569] leading-relaxed border-t border-slate-100 pt-2 space-y-1">
                        {currentActivityData.processSteps.map((st, idx) => (
                          <p key={idx}>• {st}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Important Tip */}
                  <div className="p-3 rounded-xl bg-[#FFF6E5] border border-[#E5B87B] flex items-start gap-2 text-xs text-[#7C3A0B]">
                    <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                    <span className="italic font-semibold">{currentActivityData.importantTip}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* TEACHER PRIVATE NOTES PANEL */
              <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-4 space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-base text-[#102A43]">
                    <span>📋 Ghi chú riêng</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE6CE] border border-[#F3B87E] text-[#9A3412] text-xs font-extrabold">
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Không hiển thị khi trình chiếu</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#EAF2EC] border border-[#C6D9C7] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#195E3E]">
                    <Target className="w-4 h-4" />
                    <span>Mục tiêu</span>
                  </div>
                  <p className="text-xs font-semibold text-[#102A43]">
                    {currentActivityData.teacherGoal}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#EAF2EC] border border-[#C6D9C7] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#195E3E]">
                    <HelpCircle className="w-4 h-4" />
                    <span>Câu hỏi gợi mở</span>
                  </div>
                  <p className="text-xs font-semibold text-[#102A43]">
                    {currentActivityData.teacherQuestion}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#FFF6E5] border border-[#F3C88B] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#B45309]">
                    <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                    <span>Lỗi thường gặp</span>
                  </div>
                  <p className="text-xs font-semibold text-[#7C2D12]">
                    {currentActivityData.teacherMistake}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#D8D0BE] space-y-2.5 text-xs font-bold text-[#102A43]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện tóm tắt kiến thức</span>
                    <input
                      type="checkbox"
                      checked={teacherShowTheory}
                      onChange={(e) => setTeacherShowTheory(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện các bước biến đổi</span>
                    <input
                      type="checkbox"
                      checked={teacherShowSteps}
                      onChange={(e) => setTeacherShowSteps(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện đáp án &amp; kết luận</span>
                    <input
                      type="checkbox"
                      checked={teacherShowConclusion}
                      onChange={(e) => setTeacherShowConclusion(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ====================================================================
          BOTTOM NAVIGATION & STEP PLAYBACK BAR
          ==================================================================== */}
      <footer className="mt-3.5 rounded-2xl border border-[#D8D0BE] bg-gradient-to-b from-[#FAF8F2] to-[#ECE6D8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {roleMode === 'student' ? (
          <>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#163628]">
              <BookOpen className="w-4 h-4 text-[#195E3E]" />
              <span>{currentNavMeta.sgkPageBadge}</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={activeActivityId <= 1}
                onClick={() => setActiveActivityId((prev) => Math.max(1, prev - 1))}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>

              <button
                type="button"
                disabled={activeActivityId >= 6}
                onClick={() => {
                  markActivityCompleted(activeActivityId);
                  setActiveActivityId((prev) => Math.min(6, prev + 1));
                }}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={() => syncTeacherStepSwitches(Math.max(0, teacherCurrentStep - 1))}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#9CC5A6] text-xs sm:text-sm font-bold text-[#163628] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Bước trước</span>
            </button>

            <button
              type="button"
              onClick={() => syncTeacherStepSwitches(Math.min(4, teacherCurrentStep + 1))}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Hiện từng bước</span>
            </button>

            <button
              type="button"
              onClick={() => syncTeacherStepSwitches(0)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <EyeOff className="w-4 h-4 text-[#475569]" />
              <span>Ẩn lời giải</span>
            </button>

            <button
              type="button"
              onClick={() => syncTeacherStepSwitches(2)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#195E3E]" />
              <span>Đặt lại</span>
            </button>

            <span className="px-3.5 py-2 rounded-xl bg-[#DFECE2] text-[#163628] text-xs sm:text-sm font-extrabold tabular-nums">
              Bước {teacherCurrentStep}/4
            </span>
          </div>
        )}
      </footer>
    </div>
  );
};
