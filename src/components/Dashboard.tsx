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

  const scrollToStudentFeatures = () => {
    const target = document.getElementById('student-features');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
      icon: <IconCoreKnowledge className="w-20 h-20" />
    },
    {
      id: 'student_practice',
      title: 'Luyện theo bài / chương',
      description: 'Luyện tập bài tập theo từng bài học hoặc chương, rèn luyện kỹ năng và củng cố kiến thức.',
      viewId: 'student_practice',
      icon: <IconPractice className="w-20 h-20" />
    },
    {
      id: 'student_semester_review',
      title: 'Ôn tập học kỳ',
      description: 'Hệ thống bài ôn tập tổng hợp theo từng học kỳ, giúp học sinh củng cố và hệ thống lại kiến thức.',
      viewId: 'student_semester_review',
      icon: <IconSemesterReview className="w-20 h-20" />
    },
    {
      id: 'student_assignments',
      title: 'Bài được giao',
      description: 'Xem và làm các bài tập, nhiệm vụ học tập do giáo viên giao.',
      viewId: 'student_assignments',
      icon: <IconAssignments className="w-20 h-20" />
    },
    {
      id: 'student_exam_taking',
      title: 'Kiểm tra trực tuyến',
      description: 'Tham gia các bài kiểm tra trực tuyến theo kế hoạch của giáo viên.',
      viewId: 'student_exam_taking',
      icon: <IconExamOnline className="w-20 h-20" />
    },
    {
      id: 'student_wrong_book',
      title: 'Sổ câu sai',
      description: 'Theo dõi và ôn tập lại những câu đã làm sai để rút kinh nghiệm và tránh lặp lại lỗi.',
      viewId: 'student_wrong_book',
      icon: <IconWrongBook className="w-20 h-20" />
    },
    {
      id: 'student_results',
      title: 'Kết quả & tiến bộ',
      description: 'Xem điểm số, kết quả các bài học, bài kiểm tra và theo dõi tiến bộ học tập theo thời gian.',
      viewId: 'student_results',
      icon: <IconResults className="w-20 h-20" />
    },
    {
      id: 'student_study_materials',
      title: 'Tài liệu học tập',
      description: 'Kho tài liệu học tập đa dạng, phù hợp theo từng môn học và chương trình học.',
      viewId: 'student_study_materials',
      icon: <IconMaterials className="w-20 h-20" />
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
      icon: <IconLectures className="w-20 h-20" />
    },
    {
      id: 'teacher_classes',
      title: 'Lớp học & học sinh',
      description: 'Quản lý lớp học, danh sách học sinh và theo dõi quá trình học tập.',
      viewId: 'teacher_classes',
      isTeacher: true,
      icon: <IconClasses className="w-20 h-20" />
    },
    {
      id: 'teacher_student_call',
      title: 'Trò chơi gọi học sinh',
      description: 'Tạo trò chơi tương tác để gọi học sinh, tăng hứng thú và sự tham gia của học sinh trong giờ học.',
      viewId: 'teacher_student_call',
      isTeacher: true,
      icon: <IconStudentCall className="w-20 h-20" />
    },
    {
      id: 'teacher_question_bank',
      title: 'Ngân hàng câu hỏi',
      description: 'Xây dựng và quản lý ngân hàng câu hỏi theo môn học, chủ đề và mức độ.',
      viewId: 'teacher_question_bank',
      isTeacher: true,
      icon: <IconQuestionBank className="w-20 h-20" />
    },
    {
      id: 'teacher_create_exam',
      title: 'Tạo đề & giao bài',
      description: 'Tạo đề kiểm tra, bài tập tự động từ ngân hàng câu hỏi và giao cho học sinh thực hiện.',
      viewId: 'teacher_create_exam',
      isTeacher: true,
      icon: <IconCreateExam className="w-20 h-20" />
    },
    {
      id: 'teacher_matrix',
      title: 'Ma trận & bản đặc tả',
      description: 'Lập ma trận đề và bản đặc tả theo chuẩn chương trình, đảm bảo đánh giá đúng năng lực.',
      viewId: 'teacher_matrix',
      isTeacher: true,
      icon: <IconMatrix className="w-20 h-20" />
    },
    {
      id: 'teacher_grading',
      title: 'Chấm bài & thống kê',
      description: 'Chấm bài, xem điểm và thống kê kết quả theo lớp, theo bài, hỗ trợ đánh giá hiệu quả dạy học.',
      viewId: 'teacher_grading',
      isTeacher: true,
      icon: <IconGrading className="w-20 h-20" />
    }
  ];

  return (
    <div className="space-y-8 pb-16 font-serif">
      {/* 1. WELCOME BANNER (Nền xanh da trời nhạt, minh họa sách bút thước ê-ke) */}
      <div className="bg-[#EAF5FF] border border-[#CFDCED] rounded-2xl p-6 sm:p-8 lg:p-10 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Banner Left Text */}
          <div className="max-w-xl space-y-3 text-left">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0F2D52] tracking-tight leading-tight">
              Chào mừng đến với<br />
              Tây Đô Smart EDU
            </h1>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Nền tảng dạy học, luyện tập và kiểm tra trực tuyến dành cho THCS.
            </p>
            <div className="pt-2">
              <button
                onClick={scrollToStudentFeatures}
                className="inline-flex items-center space-x-2 px-6 py-3 bg-[#1769C2] hover:bg-[#12549e] text-white text-sm sm:text-base font-bold rounded-xl transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                <span>Khám phá các chức năng</span>
              </button>
            </div>
          </div>

          {/* Banner Right Illustration */}
          <div className="w-full md:w-auto shrink-0 flex justify-center md:justify-end">
            <img
              src="/assets/banner_illustration.jpg"
              alt="Minh họa giáo dục Tây Đô Smart EDU"
              className="w-full max-w-[280px] sm:max-w-[340px] lg:max-w-[380px] rounded-2xl shadow-sm object-contain"
            />
          </div>
        </div>
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
              <div className="h-32 sm:h-36 bg-[#F4F9FF] border-b border-[#E2EEFB] flex items-center justify-center p-3 group-hover:bg-[#EAF3FD] transition-colors">
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

      {/* 3. DÀNH CHO GIÁO VIÊN (7 thẻ giới thiệu chức năng) */}
      <div className="space-y-5 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F2D52]">
            Dành cho giáo viên
          </h2>
          {currentRole === 'student' && (
            <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              Yêu cầu tài khoản Giáo viên
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {teacherFeatures.map((item) => (
            <div
              key={item.id}
              onClick={() => handleCardClick(item.viewId)}
              className="bg-white rounded-2xl border border-[#CFDCED] overflow-hidden hover:border-[#1769C2] hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between group"
            >
              {/* Top Illustration Area */}
              <div className="h-32 sm:h-36 bg-[#F4F9FF] border-b border-[#E2EEFB] flex items-center justify-center p-3 group-hover:bg-[#EAF3FD] transition-colors">
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
    </div>
  );
};
