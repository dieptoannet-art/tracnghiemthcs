export interface KhktPresentationStep {
  stepNumber: number;
  shortLabel: string;
  title: string;
  subtitle: string;
  timeBudget: string;
  talkingPoints: string[];
  actionLabel: string;
  actionTarget: 'game_a05_50' | 'game_a01_50' | 'math_lab' | 'lesson_tin6_b1' | 'exam_tin6_demo' | 'teacher_demo_classes' | 'architecture' | 'evidence';
  secondaryLabel?: string;
  secondaryTarget?: 'game_a05_50' | 'game_a01_50' | 'math_lab' | 'lesson_tin6_b1' | 'exam_tin6_demo' | 'teacher_demo_classes';
}

export interface KhktEvidenceItem {
  id: string;
  title: string;
  category: string;
  status: 'NOT_PROVIDED' | 'VERIFIED_TECH_SPEC';
  displayText: string;
  detail: string;
}

export const KHKT_PROJECT_OVERVIEW = {
  title: 'Tây Đô Smart EDU — Hệ sinh thái Dạy học Tương tác, Phòng thí nghiệm Toán 2D/3D & Game Lớp học Thông minh THCS',
  domain: 'Khoa học Kỹ thuật · Phần mềm Hệ thống & Công nghệ Giáo dục (EdTech)',
  targetUsers: 'Học sinh & Giáo viên bậc THCS (Lớp 6–9) theo Chương trình GDPT 2018',
  problemStatement: [
    'Trong lớp học THCS đông học sinh (40–50 em/lớp), việc gọi tên công bằng, chống trùng lặp và tạo hứng thú đầu giờ hoặc củng cố kiến thức thường mất nhiều thời gian hoặc thiếu trực quan.',
    'Nhiều nội dung trừu tượng trong Toán THCS (Định lý Pythagore, hình học không gian 3D, xác suất thực nghiệm) và Tin học cần công cụ mô phỏng trực tiếp thay vì chỉ trình chiếu hình tĩnh.',
    'Giáo viên cần quy trình liền mạch từ xây dựng ma trận đề chuẩn 4 mức độ, giao bài trực tuyến đến chấm điểm và phân tích kết quả lớp học.'
  ],
  objectives: [
    'Xây dựng cổng học liệu & đánh giá thống nhất cho 4 khối lớp (6, 7, 8, 9) với 553 bài học GDPT 2018 đã lập chỉ mục.',
    'Tích hợp Phòng thí nghiệm Toán học Smart Math Lab M01–M17 cho phép tương tác trực tiếp các tham số hình học, đại số và khối 3D.',
    'Phát triển thư viện 50 mã trò chơi lớp học (18 trò chơi đã hoàn thiện sẵn sàng A01–A12, B01–B06) tối ưu cho lớp 1–50 học sinh và trình chiếu bảng tương tác.',
    'Tách biệt nghiêm ngặt Cổng Trải nghiệm Công khai / Trình diễn KHKT (Sandbox) khỏi Dữ liệu Vận hành Trường học (Supabase Auth + PostgreSQL RLS).'
  ],
};

export const KHKT_INNOVATION_PILLARS = [
  {
    code: '01',
    title: 'Đồ họa WebGL 3D & Gọi tên Công bằng 50 HS',
    summary:
      'Game A01 (Vòng quay 3D), A02 (Máy gắp thú 3D), A03 (Hộp quà bí ẩn 3D) và A05 (Vịt đua 3D) dùng Web Crypto + Three.js WebGL cùng bộ quản lý chống trùng lặp danh sách lớp lên đến 50 học sinh.',
    verifiedScope: '18/50 trò chơi sẵn sàng · Lớp mẫu 8A1 (50 HS) chạy ngay không cần đăng nhập',
  },
  {
    code: '02',
    title: 'Smart Math Lab M01–M17 Đồng bộ Sư phạm',
    summary:
      '17 phòng thí nghiệm Toán học tương tác bao trùm Số học, Hình học phẳng (M01), Định lý Pythagore ghép diện tích (M15), Khối 3D (M08) và Xác suất thực nghiệm (M03).',
    verifiedScope: '17/17 chuyên đề M01–M17 hoạt động thực tế (M18–M24 chưa phát triển)',
  },
  {
    code: '03',
    title: 'Học liệu HTML5 Độc lập & Kiểm tra Chuẩn Ma trận',
    summary:
      'Nhúng mượt 553 bài học GDPT 2018 (bao gồm Tin học 6 – Bài 1: Thông tin và dữ liệu) kết hợp đề kiểm tra tự luận/trắc nghiệm và quy trình giáo viên mô phỏng.',
    verifiedScope: 'Bài giảng mở thẳng qua CoreKnowledgeView · Chấm điểm tức thì trong Sandbox',
  },
  {
    code: '04',
    title: 'Kiến trúc Tách biệt Sandbox Demo & Production RLS',
    summary:
      'Mọi lượt trải nghiệm công khai đều chạy trong kho dữ liệu cô lập taydo_demo_sandbox_v1. Tuyệt đối không cấp quyền quản trị thật và không ghi vào cơ sở dữ liệu sản xuất.',
    verifiedScope: 'Backend verifyAdminCaller / verifyStaffCaller + Supabase RLS độc lập',
  },
];

export const KHKT_TECH_ARCHITECTURE = [
  {
    layer: 'Frontend UI & Visualization',
    stack: 'React 18 + TypeScript + Tailwind CSS + Three.js WebGL + SVG Geometry + Web Audio & Vietnamese TTS',
    role: 'Giao diện Light Academic tốc độ cao, chạy cả trên laptop giáo viên lẫn máy chiếu màn hình lớn.',
  },
  {
    layer: 'Public & KHKT Sandbox Layer',
    stack: 'Dual-Store Isolation (AppContext + taydo_demo_sandbox_v1 + taydo_edu_guest_roster_session_v1)',
    role: 'Cho phép khách & BGK trải nghiệm Public Guest / Giáo viên Demo (50 HS) / Học sinh Demo không cần đăng nhập và reset trạng thái bất kỳ lúc nào.',
  },
  {
    layer: 'Production Auth & Data Security',
    stack: 'Supabase Auth (JWT) + PostgreSQL RLS + Node/Express Admin/Teacher Middleware',
    role: 'Vai trò thật luôn đọc từ public.profiles trên server; khóa admin_* và API /api/admin, /api/teacher nghiêm ngặt khỏi khách.',
  },
];

export const KHKT_EVIDENCE_ITEMS: KhktEvidenceItem[] = [
  {
    id: 'ev-school-survey',
    title: 'Số liệu khảo sát mức độ hứng thú & thời gian tổ chức lớp học tại trường',
    category: 'Thực nghiệm sư phạm',
    status: 'NOT_PROVIDED',
    displayText: 'Chưa cung cấp minh chứng thực nghiệm',
    detail: 'Chưa đính kèm bộ số liệu pre-test / post-test hoặc phiếu khảo sát đã được trường phê duyệt.',
  },
  {
    id: 'ev-score-comparison',
    title: 'Bảng đối chứng kết quả học tập nhóm thực nghiệm và nhóm đối chứng',
    category: 'Đánh giá hiệu quả',
    status: 'NOT_PROVIDED',
    displayText: 'Chưa cung cấp minh chứng thực nghiệm',
    detail: 'Hệ thống giữ nguyên trạng thái trung thực, không tự tạo tỷ lệ phần trăm hay điểm số giả.',
  },
  {
    id: 'ev-trial-photos-video',
    title: 'Biên bản dạy thực nghiệm, ảnh lớp học và video quay trực tiếp tiết học',
    category: 'Tài liệu minh chứng',
    status: 'NOT_PROVIDED',
    displayText: 'Chưa cung cấp minh chứng thực nghiệm',
    detail: 'Vui lòng đính kèm biên bản/video thực tế của nhóm tác giả khi nộp hồ sơ chính thức.',
  },
  {
    id: 'ev-tech-verification',
    title: 'Kiểm chứng kỹ thuật trực tiếp ngay trên sản phẩm (Live Interactive Demo)',
    category: 'Sản phẩm đang chạy',
    status: 'VERIFIED_TECH_SPEC',
    displayText: 'Trải nghiệm trực tiếp ngay trong ứng dụng',
    detail: '18 trò chơi sẵn sàng (A01–A12, B01–B06), 17 chuyên đề Smart Math Lab M01–M17, lớp mẫu 50 HS và bài học Tin học 6 Bài 1 có thể kiểm chứng ngay.',
  },
];

export const KHKT_PRESENTATION_STEPS: KhktPresentationStep[] = [
  {
    stepNumber: 1,
    shortLabel: 'Đặt vấn đề',
    title: 'Bước 1: Bài toán thực tiễn & Mục tiêu Tây Đô Smart EDU',
    subtitle: 'Vì sao lớp học THCS 40–50 học sinh cần một hệ sinh thái tương tác tích hợp?',
    timeBudget: '60 giây',
    talkingPoints: [
      'Giáo viên THCS hiện phải rời rạc giữa nhiều công cụ: file trình chiếu tĩnh, trang gọi tên ngẫu nhiên đơn giản, ứng dụng vẽ hình riêng và hệ thống thi riêng.',
      'Tây Đô Smart EDU hợp nhất 4 mảng trong một nền tảng: Trò chơi lớp học 50 HS, Phòng thí nghiệm Toán M01–M17, Bài giảng HTML5 GDPT 2018 và Kiểm tra – Chấm điểm.',
      'Toàn bộ trải nghiệm tại hội đồng thi chạy trong Sandbox độc lập 50 học sinh mẫu, an toàn tuyệt đối với hệ thống vận hành thật.',
    ],
    actionLabel: 'Mở Lớp 8A1 (50 HS Demo) ở chế độ GV Demo',
    actionTarget: 'teacher_demo_classes',
  },
  {
    stepNumber: 2,
    shortLabel: 'Game 3D & 50 HS',
    title: 'Bước 2: Tương tác Lớp học 50 HS với Đồ họa 3D (A01–A05)',
    subtitle: 'Trình diễn gọi học sinh công bằng bằng WebGL 3D & Web Crypto',
    timeBudget: '90 giây',
    talkingPoints: [
      'Hỗ trợ danh sách 1–50 học sinh với cơ chế chống trùng lặp (không gọi lại học sinh đã trả lời trừ khi làm mới phiên) và loại trừ học sinh vắng.',
      'Tích hợp Đua vịt 3D (A05) có chia lượt/làn đua thông minh cho lớp đông và Vòng quay may mắn 3D (A01) tối ưu máy chiếu.',
      'Cho phép nhập ghi chú, cộng điểm thưởng trực tiếp ngay trên sân khấu trình chiếu.',
    ],
    actionLabel: 'Chạy thử Đua vịt 3D / EDU Game Center (50 HS)',
    actionTarget: 'game_a05_50',
    secondaryLabel: 'Xem thêm 18 trò chơi sẵn sàng',
    secondaryTarget: 'game_a01_50',
  },
  {
    stepNumber: 3,
    shortLabel: 'Math Lab M01–M17',
    title: 'Bước 3: Phòng thí nghiệm Toán học Trực quan (M01–M17)',
    subtitle: 'Từ Định lý Pythagore ghép diện tích (M15) đến Khối hình 3D (M08)',
    timeBudget: '90 giây',
    talkingPoints: [
      '17 chuyên đề (M01–M17) giúp học sinh kéo thả trực tiếp các đỉnh, thay đổi tham số và quan sát công thức đồng bộ theo thời gian thực.',
      'Chuyên đề M15 Pythagore cho phép dựng 3 hình vuông trên ba cạnh, ghép mảnh bảo toàn diện tích và kiểm tra định lý đảo.',
      'Hỗ trợ chế độ trình chiếu bảng lớn giúp giáo viên giảng bài trực tiếp trước lớp.',
    ],
    actionLabel: 'Mở Smart Math Lab (M01–M17)',
    actionTarget: 'math_lab',
  },
  {
    stepNumber: 4,
    shortLabel: 'Bài học & Đề mẫu',
    title: 'Bước 4: Học liệu GDPT 2018 & Kiểm tra Chấm điểm Tự động',
    subtitle: 'Liên thông từ bài học Tin học 6 – Bài 1 đến bài kiểm tra trắc nghiệm & tự luận',
    timeBudget: '90 giây',
    talkingPoints: [
      'Mở trực tiếp bài giảng tương tác Tin học 6 – Chủ đề 1 – Bài 1: Thông tin và dữ liệu (/lessons/lop-6/tin-hoc/chu-de-01/bai-01/index.html).',
      'Học sinh làm bài kiểm tra mẫu trực tuyến với bộ đếm thời gian, đánh dấu câu hỏi, tự động lưu nháp và chấm điểm tức thì khi nộp bài.',
      'Giáo viên Demo có thể tạo đề, xem thống kê chấm bài và danh sách 50 học sinh mẫu.',
    ],
    actionLabel: 'Mở ngay Bài học Tin học 6 – Bài 1',
    actionTarget: 'lesson_tin6_b1',
    secondaryLabel: 'Mở Đề kiểm tra Tin học 6 Demo',
    secondaryTarget: 'exam_tin6_demo',
  },
  {
    stepNumber: 5,
    shortLabel: 'Kiến trúc & Bảo mật',
    title: 'Bước 5: Kiến trúc Sandbox Độc lập & Bảo mật Đa tầng',
    subtitle: 'Làm thế nào để mở công khai cho mọi người dùng thử mà không lộ dữ liệu thật?',
    timeBudget: '60 giây',
    talkingPoints: [
      'Dual-Store Architecture: Chế độ Khách, GV Demo, HS Demo và KHKT Showcase chỉ đọc/ghi trên taydo_demo_sandbox_v1.',
      'Mọi route Quản trị (/admin*) và API /api/admin, /api/teacher đều khóa xác thực Bearer Token + kiểm tra vai trò từ public.profiles trên server.',
      'Không đưa Service Role Key vào frontend; chỉ sử dụng biến môi trường an toàn.',
    ],
    actionLabel: 'Xem chi tiết Sơ đồ Kiến trúc & Quy tắc Bảo mật',
    actionTarget: 'architecture',
  },
  {
    stepNumber: 6,
    shortLabel: 'Tổng kết & Minh chứng',
    title: 'Bước 6: Hiện trạng Kỹ thuật, Minh chứng & Hướng phát triển',
    subtitle: 'Trung thực hoàn toàn về phần đã hoàn thành và nội dung cần bổ sung',
    timeBudget: '60 giây',
    talkingPoints: [
      'Đã hoàn thiện: 18/50 Game (A01–A12, B01–B06), 17 chuyên đề Math Lab (M01–M17), 553 bài học GDPT 2018, 50 học sinh Demo, phân hệ Thi – Chấm điểm & Bảo mật Production.',
      'Chưa hoàn thiện / ngoài phạm vi hiện tại: 32 mã Game còn lại (C–F), Math Lab M18–M24.',
      'Minh chứng thực nghiệm tại trường: Hiện hiển thị "Chưa cung cấp minh chứng thực nghiệm" cho đến khi nhóm tác giả bổ sung số liệu và video chính thức.',
    ],
    actionLabel: 'Xem Bảng Minh chứng & Tổng kết KHKT',
    actionTarget: 'evidence',
  },
];
