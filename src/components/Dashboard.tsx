import React from 'react';
import { ArrowRight, FlaskConical, Sparkles, UserCheck, ShieldCheck, Settings } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  IconCoreKnowledge,
  IconPractice,
  IconSemesterReview,
  IconAssignments,
  IconExamOnline,
  IconWrongBook,
  IconResults,
  IconMaterials,
  IconLectures,
  IconClasses,
  IconStudentCall,
  IconQuestionBank,
  IconCreateExam,
  IconMatrix,
  IconGrading
} from './common/FeatureCardIcons';

interface DashboardProps {
  onOpenExamMatrixModal?: () => void;
  onOpenCreateExamModal?: () => void;
  onOpenImportModal?: () => void;
}

interface FeatureCardItem {
  id: string;
  title: string;
  description: string;
  viewId: string;
  icon: React.ReactNode;
  accentBg?: string;
}

export const Dashboard: React.FC<DashboardProps> = () => {
  const { setCurrentView, currentRole, authenticatedProdRole } = useApp();

  const handleCardClick = (viewId: string) => {
    setCurrentView(viewId);
  };

  const showAdminCards =
    authenticatedProdRole === 'admin' || authenticatedProdRole === 'reviewer';

  // 9 mục HỌC SINH (bao gồm Phòng thí nghiệm Toán M01–M17)
  const studentFeatures: FeatureCardItem[] = [
    {
      id: 'student_core_knowledge',
      title: 'Kiến thức trọng tâm',
      description: 'Hệ thống kiến thức cốt lõi theo từng môn học, giúp học sinh nắm vững và ôn tập hiệu quả.',
      viewId: 'student_core_knowledge',
      icon: <IconCoreKnowledge className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'math_lab',
      title: 'Phòng thí nghiệm Toán (M01–M17)',
      description: 'Mô phỏng hình học 2D/3D, hàm số, xác suất và định lý Pythagore trực quan chuẩn GDPT 2018.',
      viewId: 'math_lab',
      accentBg: 'bg-[#ECFDF5]',
      icon: (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#12A879] to-[#0E8762] text-white flex items-center justify-center shadow-[0_10px_22px_-8px_rgba(18,168,121,0.55)]">
          <FlaskConical className="w-10 h-10" />
        </div>
      )
    },
    {
      id: 'student_practice',
      title: 'Luyện theo bài / chương',
      description: 'Luyện tập bài tập theo từng bài học hoặc chương, rèn luyện kỹ năng và củng cố kiến thức.',
      viewId: 'student_practice',
      icon: <IconPractice className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_semester_review',
      title: 'Ôn tập học kỳ',
      description: 'Hệ thống bài ôn tập tổng hợp theo từng học kỳ, giúp học sinh củng cố và hệ thống lại kiến thức.',
      viewId: 'student_semester_review',
      icon: <IconSemesterReview className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_assignments',
      title: 'Bài được giao',
      description: 'Xem và làm các bài tập, nhiệm vụ học tập do giáo viên giao.',
      viewId: 'student_assignments',
      icon: <IconAssignments className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_exam_taking',
      title: 'Kiểm tra trực tuyến',
      description: 'Tham gia các bài kiểm tra trực tuyến theo kế hoạch của giáo viên.',
      viewId: 'student_exam_taking',
      icon: <IconExamOnline className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_wrong_book',
      title: 'Sổ câu sai',
      description: 'Theo dõi và ôn tập lại những câu đã làm sai để rút kinh nghiệm và tránh lặp lại lỗi.',
      viewId: 'student_wrong_book',
      icon: <IconWrongBook className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_results',
      title: 'Kết quả & tiến bộ',
      description: 'Xem điểm số, kết quả các bài học, bài kiểm tra và theo dõi tiến bộ học tập theo thời gian.',
      viewId: 'student_results',
      icon: <IconResults className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'student_study_materials',
      title: 'Tài liệu học tập',
      description: 'Kho tài liệu học tập đa dạng, phù hợp theo từng môn học và chương trình học.',
      viewId: 'student_study_materials',
      icon: <IconMaterials className="w-28 h-24 sm:w-32 sm:h-28" />
    }
  ];

  // 8 mục GIÁO VIÊN (bao gồm Trợ lý Gemini)
  const teacherFeatures: FeatureCardItem[] = [
    {
      id: 'teacher_lectures',
      title: 'Bài giảng',
      description: 'Kho bài giảng số trực quan, sinh động, hỗ trợ dạy học và tự học mọi lúc, mọi nơi.',
      viewId: 'teacher_lectures',
      icon: <IconLectures className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_classes',
      title: 'Lớp & phân công của tôi',
      description: 'Xem các lớp học, môn được phân công giảng dạy và danh sách học sinh theo phạm vi phụ trách.',
      viewId: 'teacher_classes',
      icon: <IconClasses className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_student_call',
      title: 'EDU Game Center – Trò chơi giáo dục',
      description: 'Tổ chức trò chơi gọi tên 3D & khởi động tiết học. Hỗ trợ Chế độ Khách và Chế độ Giáo viên.',
      viewId: 'teacher_student_call',
      icon: <IconStudentCall className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_question_bank',
      title: 'Ngân hàng câu hỏi',
      description: 'Xây dựng và quản lý ngân hàng câu hỏi theo môn học, chủ đề và mức độ.',
      viewId: 'teacher_question_bank',
      icon: <IconQuestionBank className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_create_exam',
      title: 'Tạo đề & giao bài',
      description: 'Tạo đề kiểm tra, bài tập tự động từ ngân hàng câu hỏi và giao cho học sinh thực hiện.',
      viewId: 'teacher_create_exam',
      icon: <IconCreateExam className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_matrix',
      title: 'Ma trận & bản đặc tả',
      description: 'Lập ma trận đề và bản đặc tả theo chuẩn chương trình, đảm bảo đánh giá đúng năng lực.',
      viewId: 'teacher_matrix',
      icon: <IconMatrix className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_grading',
      title: 'Chấm bài & thống kê',
      description: 'Chấm bài, xem điểm và thống kê kết quả theo lớp, theo bài, hỗ trợ đánh giá hiệu quả dạy học.',
      viewId: 'teacher_grading',
      icon: <IconGrading className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_gemini',
      title: 'Trợ lý soạn giảng Gemini',
      description: 'Gợi ý câu hỏi, phân tích ma trận kiến thức và hỗ trợ soạn kế hoạch bài dạy theo GDPT 2018.',
      viewId: 'teacher_gemini',
      accentBg: 'bg-[#FFFBEB]',
      icon: (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white flex items-center justify-center shadow-[0_10px_22px_-8px_rgba(245,158,11,0.55)]">
          <Sparkles className="w-10 h-10" />
        </div>
      )
    }
  ];

  const adminFeatures: FeatureCardItem[] = [
    ...(authenticatedProdRole === 'admin'
      ? [
          {
            id: 'admin_accounts',
            title: 'Quản lý lớp & tài khoản',
            description: 'Quản trị danh sách lớp, học sinh, phân công giảng dạy và tài khoản giáo viên.',
            viewId: 'admin_accounts',
            accentBg: 'bg-[#EAF3FF]',
            icon: (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#102C54] to-[#1769F4] text-white flex items-center justify-center shadow-[0_10px_22px_-8px_rgba(16,44,84,0.45)]">
                <UserCheck className="w-10 h-10" />
              </div>
            )
          }
        ]
      : []),
    {
      id: 'admin_approval',
      title: 'Duyệt câu hỏi',
      description: 'Kiểm duyệt chất lượng chuyên môn và phê duyệt câu hỏi đưa vào ngân hàng chung.',
      viewId: 'admin_approval',
      accentBg: 'bg-[#ECFDF5]',
      icon: (
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#12A879] to-[#0D8761] text-white flex items-center justify-center shadow-[0_10px_22px_-8px_rgba(18,168,121,0.45)]">
          <ShieldCheck className="w-10 h-10" />
        </div>
      )
    },
    ...(authenticatedProdRole === 'admin'
      ? [
          {
            id: 'admin_settings',
            title: 'Cấu hình & sao lưu',
            description: 'Kiểm tra kết nối Supabase, sao lưu JSON, nhật ký Audit Logs và cấu hình giao diện 2027.',
            viewId: 'admin_settings',
            accentBg: 'bg-[#F1F5F9]',
            icon: (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#334155] to-[#0F172A] text-white flex items-center justify-center shadow-[0_10px_22px_-8px_rgba(15,23,42,0.4)]">
                <Settings className="w-10 h-10" />
              </div>
            )
          }
        ]
      : [])
  ];

  const renderCard = (item: FeatureCardItem) => (
    <div
      key={item.id}
      onClick={() => handleCardClick(item.viewId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick(item.viewId);
        }
      }}
      className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:border-[#1769F4]/55 hover:-translate-y-0.5 hover:shadow-[0_16px_34px_-12px_rgba(23,105,244,0.16)] transition-all duration-200 cursor-pointer flex flex-col justify-between group"
    >
      {/* Top Illustration Area */}
      <div
        className={`h-36 sm:h-40 ${
          item.accentBg || 'bg-[#EAF3FF]/65'
        } border-b border-[#E2E8F0]/80 flex items-center justify-center p-3 group-hover:bg-[#EAF3FF] transition-colors`}
      >
        <div className="group-hover:scale-105 transition-transform duration-200">
          {item.icon}
        </div>
      </div>

      {/* Bottom Information */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <h3 className="text-[17px] font-bold text-[#102C54] group-hover:text-[#1769F4] transition-colors leading-snug">
            {item.title}
          </h3>
          <p className="text-[13.5px] text-[#64748B] mt-1.5 leading-relaxed min-h-[42px]">
            {item.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 text-[#1769F4] text-xs font-bold">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity">Mở phân hệ</span>
          <div className="w-7 h-7 rounded-full flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-16 font-edtech">
      {/* 1. WELCOME BANNER */}
      <div className="rounded-2xl border border-[#E2E8F0] shadow-[0_10px_28px_-14px_rgba(16,44,84,0.16)] overflow-hidden bg-[#EAF3FF]">
        <img
          src="/assets/aistudio/image_54b299b4.png"
          alt="Tây Đô Smart EDU - Trường THCS Tây Đô"
          referrerPolicy="no-referrer"
          className="w-full h-auto block"
        />
      </div>

      {/* QUICK ACCESS BANNER: EDU GAME CENTER (GUEST & TEACHER MODE) */}
      <div className="bg-gradient-to-br from-[#102C54] via-[#14376A] to-[#1769F4] rounded-2xl p-5 sm:p-6 text-white shadow-[0_14px_34px_-12px_rgba(16,44,84,0.35)] border border-[#60A5FA]/25 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1.5 text-center md:text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
            Mới · Chơi ngay không cần đăng nhập
          </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            EDU Game Center – Thế giới trò chơi tương tác lớp học 3D
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl leading-relaxed">
            Khách truy cập và giáo viên có thể mở ngay toàn bộ trò chơi gọi học sinh 3D (Vòng quay 3D, Vịt đua 3D, Máy gắp thú 3D, Hộp quà bí mật 3D...) bằng cách tự nhập hoặc dán danh sách học sinh từ Excel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleCardClick('teacher_student_call')}
          className="px-5 py-3 rounded-xl bg-[#FFCC33] hover:bg-[#FFD65C] text-[#102C54] font-bold text-sm shadow-lg whitespace-nowrap shrink-0 flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Mở EDU Game Center ngay</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 2. DÀNH CHO HỌC SINH */}
      <div id="student-features" className="scroll-mt-24 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-2xl sm:text-[26px] font-bold text-[#102C54] tracking-tight">
            Dành cho học sinh
          </h2>
          <span className="text-xs font-semibold text-[#64748B] tabular-nums">
            {studentFeatures.length} phân hệ học tập
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studentFeatures.map(renderCard)}
        </div>
      </div>

      {/* 3. DÀNH CHO GIÁO VIÊN - Ẩn khi vai trò là học sinh */}
      {currentRole !== 'student' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl sm:text-[26px] font-bold text-[#102C54] tracking-tight">
              Dành cho giáo viên
            </h2>
            <span className="text-xs font-semibold text-[#64748B] tabular-nums">
              {teacherFeatures.length} công cụ giảng dạy
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teacherFeatures.map(renderCard)}
          </div>
        </div>
      )}

      {/* 4. QUẢN TRỊ HỆ THỐNG (CHỈ HIỂN THỊ CHO ADMIN / REVIEWER CHÍNH THỨC) */}
      {showAdminCards && adminFeatures.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl sm:text-[26px] font-bold text-[#102C54] tracking-tight">
              Quản trị hệ thống
            </h2>
            <span className="text-xs font-semibold text-[#12A879]">
              Không gian chính thức
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {adminFeatures.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
};

