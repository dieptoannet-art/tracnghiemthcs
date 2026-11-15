import React from 'react';
import { ArrowRight } from 'lucide-react';
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
  isTeacher?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = () => {
  const { setCurrentView, currentRole } = useApp();

  const handleCardClick = (viewId: string) => {
    setCurrentView(viewId);
  };

  // 8 mục HỌC SINH
  const studentFeatures: FeatureCardItem[] = [
    {
      id: 'student_core_knowledge',
      title: 'Kiến thức trọng tâm',
      description: 'Hệ thống kiến thức cốt lõi theo từng môn học, giúp học sinh nắm vững và ôn tập hiệu quả.',
      viewId: 'student_core_knowledge',
      icon: <IconCoreKnowledge className="w-28 h-24 sm:w-32 sm:h-28" />
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

  // 7 mục GIÁO VIÊN
  const teacherFeatures: FeatureCardItem[] = [
    {
      id: 'teacher_lectures',
      title: 'Bài giảng',
      description: 'Kho bài giảng số trực quan, sinh động, hỗ trợ dạy học và tự học mọi lúc, mọi nơi.',
      viewId: 'teacher_lectures',
      isTeacher: true,
      icon: <IconLectures className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_classes',
      title: 'Lớp & phân công của tôi',
      description: 'Xem các lớp học, môn được phân công giảng dạy và danh sách học sinh theo phạm vi phụ trách.',
      viewId: 'teacher_classes',
      isTeacher: true,
      icon: <IconClasses className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_student_call',
      title: 'EDU Game Center – Trò chơi giáo dục',
      description: 'Tổ chức trò chơi gọi tên 3D & khởi động tiết học. Hỗ trợ Chế độ Khách (tự nhập danh sách, không cần đăng nhập) và Chế độ Giáo viên.',
      viewId: 'teacher_student_call',
      isTeacher: true,
      icon: <IconStudentCall className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_question_bank',
      title: 'Ngân hàng câu hỏi',
      description: 'Xây dựng và quản lý ngân hàng câu hỏi theo môn học, chủ đề và mức độ.',
      viewId: 'teacher_question_bank',
      isTeacher: true,
      icon: <IconQuestionBank className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_create_exam',
      title: 'Tạo đề & giao bài',
      description: 'Tạo đề kiểm tra, bài tập tự động từ ngân hàng câu hỏi và giao cho học sinh thực hiện.',
      viewId: 'teacher_create_exam',
      isTeacher: true,
      icon: <IconCreateExam className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_matrix',
      title: 'Ma trận & bản đặc tả',
      description: 'Lập ma trận đề và bản đặc tả theo chuẩn chương trình, đảm bảo đánh giá đúng năng lực.',
      viewId: 'teacher_matrix',
      isTeacher: true,
      icon: <IconMatrix className="w-28 h-24 sm:w-32 sm:h-28" />
    },
    {
      id: 'teacher_grading',
      title: 'Chấm bài & thống kê',
      description: 'Chấm bài, xem điểm và thống kê kết quả theo lớp, theo bài, hỗ trợ đánh giá hiệu quả dạy học.',
      viewId: 'teacher_grading',
      isTeacher: true,
      icon: <IconGrading className="w-28 h-24 sm:w-32 sm:h-28" />
    }
  ];

  return (
    <div className="space-y-8 pb-16 font-serif">
      {/* 1. WELCOME BANNER */}
      <div className="rounded-2xl border border-[#CFDCED] shadow-xs overflow-hidden bg-[#EAF5FF]">
        <img
          src="/assets/aistudio/image_54b299b4.png"
          alt="Tây Đô Smart EDU - Trường THCS Tây Đô"
          className="w-full h-auto block"
        />
      </div>

      {/* QUICK ACCESS BANNER: EDU GAME CENTER (GUEST & TEACHER MODE) */}
      <div className="bg-gradient-to-r from-[#082B52] via-[#0F3D73] to-[#1769C2] rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-300/30 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center md:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-bold">
            <span>MỚI · CHƠI NGAY KHÔNG CẦN ĐĂNG NHẬP</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">
            EDU Game Center – Thế giới trò chơi tương tác lớp học 3D
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-2xl">
            Khách truy cập và giáo viên có thể mở ngay toàn bộ trò chơi gọi học sinh 3D (Vòng quay 3D, Máy gắp thú 3D, Hộp quà bí mật 3D...) và trò chơi khởi động bằng cách tự nhập hoặc dán danh sách học sinh từ Excel / Google Sheets mà không cần đăng nhập.
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleCardClick('teacher_student_call')}
          className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#082B52] font-bold text-sm sm:text-base shadow-lg shrink-0 flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Mở EDU Game Center ngay</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* 2. DÀNH CHO HỌC SINH (8 thẻ giới thiệu chức năng) */}
      <div id="student-features" className="scroll-mt-24 space-y-5">
        <h2 className="text-2xl sm:text-3xl font-bold text-[#0F2D52]">
          Dành cho học sinh
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {studentFeatures.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item.viewId)}
              className="bg-white rounded-2xl border border-[#CFDCED] overflow-hidden hover:border-[#1769C2] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
            >
              {/* Top Illustration Area */}
              <div className="h-36 sm:h-40 bg-[#F0F7FF] border-b border-[#E2EEFB] flex items-center justify-center p-2 group-hover:bg-[#EAF3FD] transition-colors">
                <div className="group-hover:scale-105 transition-transform duration-200">
                  {item.icon}
                </div>
              </div>

              {/* Bottom Information */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h3 className="text-lg font-bold text-[#0F2D52] group-hover:text-[#1769C2] transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed min-h-[44px]">
                    {item.description}
                  </p>
                </div>

                <div className="flex justify-end pt-2 text-[#1769C2]">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center group-hover:translate-x-1.5 transition-transform">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. DÀNH CHO GIÁO VIÊN - Ẩn khi vai trò là học sinh */}
      {currentRole !== 'student' && (
        <div className="space-y-5 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0F2D52]">
              Dành cho giáo viên
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {teacherFeatures.map((item) => (
              <div
                key={item.id}
                onClick={() => handleCardClick(item.viewId)}
                className="bg-white rounded-2xl border border-[#CFDCED] overflow-hidden hover:border-[#1769C2] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
              >
                {/* Top Illustration Area */}
                <div className="h-36 sm:h-40 bg-[#F0F7FF] border-b border-[#E2EEFB] flex items-center justify-center p-2 group-hover:bg-[#EAF3FD] transition-colors">
                  <div className="group-hover:scale-105 transition-transform duration-200">
                    {item.icon}
                  </div>
                </div>

                {/* Bottom Information */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    <h3 className="text-lg font-bold text-[#0F2D52] group-hover:text-[#1769C2] transition-colors leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed min-h-[44px]">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex justify-end pt-2 text-[#1769C2]">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center group-hover:translate-x-1.5 transition-transform">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
