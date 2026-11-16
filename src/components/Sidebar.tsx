import React from 'react';
import {
  Home,
  Book,
  BookOpen,
  GraduationCap,
  FileText,
  Monitor,
  AlertOctagon,
  BarChart2,
  FolderOpen,
  Users,
  Database,
  FileEdit,
  LayoutGrid,
  BarChart3,
  Sparkles,
  UserCheck,
  ShieldCheck,
  Settings,
  Dices,
  Presentation,
  FlaskConical
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SidebarFooterBooks3D } from './student/coreKnowledgeThumbnails';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onResetStudentAssignments?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile, onResetStudentAssignments }) => {
  const { currentView, setCurrentView, currentRole } = useApp();

  const handleNav = (viewId: string) => {
    setCurrentView(viewId);
    if (viewId === 'student_assignments' && onResetStudentAssignments) {
      onResetStudentAssignments();
    }
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (id: string) => {
    const isActive = currentView === id;
    return `w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
      isActive
        ? 'bg-gradient-to-r from-[#2482FF] to-[#0E5CE6] text-white shadow-[0_4px_14px_rgba(23,107,255,0.45)] border border-[#76BAFF]/50 font-bold'
        : 'text-slate-200/90 hover:bg-white/10 hover:text-white border border-transparent'
    }`;
  };

  const sidebarContent = (
    <div className="w-[250px] bg-gradient-to-b from-[#0E2749] via-[#112D55] to-[#0D2342] text-white flex flex-col h-full border-r border-[#1a3e6d] select-none font-sans">
      {/* Scrollable menu items */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
        
        {/* Trang chủ */}
        <div>
          <button
            onClick={() => handleNav('dashboard')}
            className={navItemClass('dashboard')}
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>Trang chủ</span>
          </button>
        </div>

        {/* HỌC SINH */}
        <div>
          <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
            HỌC SINH
          </h3>
          <div className="space-y-1">
            <button
              onClick={() => handleNav('student_core_knowledge')}
              className={navItemClass('student_core_knowledge')}
            >
              <Book className="w-4 h-4 shrink-0" />
              <span>Kiến thức trọng tâm</span>
            </button>

            <button
              onClick={() => handleNav('student_practice')}
              className={navItemClass('student_practice')}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Luyện theo bài / chương</span>
            </button>

            <button
              onClick={() => handleNav('student_semester_review')}
              className={navItemClass('student_semester_review')}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Ôn tập học kỳ</span>
            </button>

            <button
              onClick={() => handleNav('student_assignments')}
              className={navItemClass('student_assignments')}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Bài được giao</span>
            </button>

            <button
              onClick={() => handleNav('student_exam_taking')}
              className={navItemClass('student_exam_taking')}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span>Kiểm tra trực tuyến</span>
            </button>

            <button
              onClick={() => handleNav('student_wrong_book')}
              className={navItemClass('student_wrong_book')}
            >
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>Sổ câu sai</span>
            </button>

            <button
              onClick={() => handleNav('student_results')}
              className={navItemClass('student_results')}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              <span>Kết quả & tiến bộ</span>
            </button>

            <button
              onClick={() => handleNav('student_study_materials')}
              className={navItemClass('student_study_materials')}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span>Tài liệu học tập</span>
            </button>

            <button
              onClick={() => handleNav('math_lab')}
              className={navItemClass('math_lab')}
            >
              <FlaskConical className="w-4 h-4 shrink-0 text-teal-300" />
              <span>Phòng thí nghiệm Toán</span>
            </button>

            {currentRole === 'student' && (
              <button
                onClick={() => handleNav('teacher_student_call')}
                className={navItemClass('teacher_student_call')}
              >
                <Dices className="w-4 h-4 shrink-0 text-amber-300" />
                <span>EDU Game Center (Khách)</span>
              </button>
            )}
          </div>
        </div>

        {/* GIÁO VIÊN - Ẩn đối với vai trò Học sinh */}
        {currentRole !== 'student' && (
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              GIÁO VIÊN
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => handleNav('teacher_lectures')}
                className={navItemClass('teacher_lectures')}
              >
                <Presentation className="w-4 h-4 shrink-0 text-cyan-300" />
                <span>Bài giảng</span>
              </button>

              <button
                onClick={() => handleNav('math_lab')}
                className={navItemClass('math_lab')}
              >
                <FlaskConical className="w-4 h-4 shrink-0 text-teal-300" />
                <span>Phòng thí nghiệm Toán</span>
              </button>

              <button
                onClick={() => handleNav('teacher_classes')}
                className={navItemClass('teacher_classes')}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Lớp &amp; phân công của tôi</span>
              </button>

              <button
                onClick={() => handleNav('teacher_student_call')}
                className={navItemClass('teacher_student_call')}
              >
                <Dices className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Trò chơi giáo dục</span>
              </button>

              <button
                onClick={() => handleNav('teacher_question_bank')}
                className={navItemClass('teacher_question_bank')}
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>Ngân hàng câu hỏi</span>
              </button>

              <button
                onClick={() => handleNav('teacher_create_exam')}
                className={navItemClass('teacher_create_exam')}
              >
                <FileEdit className="w-4 h-4 shrink-0" />
                <span>Tạo đề & giao bài</span>
              </button>

              <button
                onClick={() => handleNav('teacher_matrix')}
                className={navItemClass('teacher_matrix')}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>Ma trận & bản đặc tả</span>
              </button>

              <button
                onClick={() => handleNav('teacher_grading')}
                className={navItemClass('teacher_grading')}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Chấm bài & thống kê</span>
              </button>

              <button
                onClick={() => handleNav('teacher_gemini')}
                className={navItemClass('teacher_gemini')}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Trợ lý Gemini</span>
              </button>
            </div>
          </div>
        )}

        {/* QUẢN TRỊ - Chỉ hiển thị cho Quản trị viên (hoặc người kiểm duyệt duyệt câu hỏi) */}
        {(currentRole === 'admin' || currentRole === 'reviewer') && (
          <div>
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              QUẢN TRỊ
            </h3>
            <div className="space-y-1">
              {currentRole === 'admin' && (
                <button
                  onClick={() => handleNav('admin_accounts')}
                  className={navItemClass('admin_accounts')}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Quản lý lớp &amp; tài khoản</span>
                </button>
              )}

              <button
                onClick={() => handleNav('admin_approval')}
                className={navItemClass('admin_approval')}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Duyệt câu hỏi</span>
              </button>

              {currentRole === 'admin' && (
                <button
                  onClick={() => handleNav('admin_settings')}
                  className={navItemClass('admin_settings')}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Cấu hình & sao lưu</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* 3D Books & Graduation Cap Illustration + School Footer Branding */}
      <div className="shrink-0 relative overflow-hidden bg-gradient-to-b from-transparent to-[#091B34]">
        <SidebarFooterBooks3D />
        <div className="px-3 py-2 bg-[#081A33]/90 border-t border-[#1D4477]/70 text-[11px] text-slate-300 text-center">
          <p className="font-extrabold text-white tracking-wider">THCS TÂY ĐÔ</p>
          <p className="text-[10px] text-blue-200/80 mt-0.5">Smart EDU · GDPT 2018</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <aside className="hidden md:block shrink-0 h-full">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
