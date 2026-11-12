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
  Presentation
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { currentView, setCurrentView, currentRole } = useApp();

  const handleNav = (viewId: string) => {
    setCurrentView(viewId);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (id: string) => {
    const isActive = currentView === id;
    return `w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
      isActive
        ? 'bg-[#1769C2] text-white shadow-xs font-semibold'
        : 'text-slate-300 hover:bg-white/10 hover:text-white'
    }`;
  };

  const sidebarContent = (
    <div className="w-[250px] bg-[#0F2D52] text-white flex flex-col h-full border-r border-[#1a3e6d] select-none font-serif">
      {/* Scrollable menu items */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6">
        
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
                onClick={() => handleNav('teacher_classes')}
                className={navItemClass('teacher_classes')}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>Lớp học & học sinh</span>
              </button>

              <button
                onClick={() => handleNav('teacher_student_call')}
                className={navItemClass('teacher_student_call')}
              >
                <Dices className="w-4 h-4 shrink-0 text-amber-300" />
                <span>Trò chơi gọi học sinh</span>
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
                  <span>Tài khoản & phân quyền</span>
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

      {/* School Footer branding */}
      <div className="p-3 bg-[#0a1e38] border-t border-[#1a3e6d] text-[11px] text-slate-400 text-center">
        <p className="font-bold text-slate-200 tracking-wider">THCS TÂY ĐÔ</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Phiên bản 2026 · GDPT 2018</p>
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
