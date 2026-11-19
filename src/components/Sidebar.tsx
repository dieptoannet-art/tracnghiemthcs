import React, { useState, useEffect } from 'react';
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
  FlaskConical,
  Compass,
  Award,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SidebarFooterBooks3D } from './student/coreKnowledgeThumbnails';
import { KHKT_DEMO_STORAGE_PREFIX } from '../utils/khktDemoSandbox';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  onResetStudentAssignments?: () => void;
}

const SIDEBAR_COLLAPSED_KEY = 'taydo_sidebar_collapsed';
const DEMO_SIDEBAR_COLLAPSED_KEY = `${KHKT_DEMO_STORAGE_PREFIX}sidebar_collapsed`;

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile, onResetStudentAssignments }) => {
  const {
    currentView,
    setCurrentView,
    currentRole,
    isDemoSandbox,
    authenticatedProdRole,
  } = useApp();

  const sidebarStorageKey = isDemoSandbox ? DEMO_SIDEBAR_COLLAPSED_KEY : SIDEBAR_COLLAPSED_KEY;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(sidebarStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(sidebarStorageKey, String(collapsed));
    } catch {
      // ignore storage failure
    }
  }, [collapsed, sidebarStorageKey]);

  const [mathLabSection, setMathLabSection] = useState<'student' | 'teacher'>(() =>
    currentRole === 'student' ? 'student' : 'teacher'
  );

  useEffect(() => {
    if (currentRole === 'student') {
      setMathLabSection('student');
    } else if (currentView !== 'math_lab') {
      setMathLabSection('teacher');
    }
  }, [currentRole, currentView]);

  const handleNav = (viewId: string, sectionHint?: 'student' | 'teacher') => {
    if (viewId === 'math_lab' && sectionHint) {
      setMathLabSection(sectionHint);
    }
    setCurrentView(viewId);
    if (viewId === 'student_assignments' && onResetStudentAssignments) {
      onResetStudentAssignments();
    }
    if (onCloseMobile) onCloseMobile();
  };

  const handleAction = (fn: () => void) => {
    fn();
    if (onCloseMobile) onCloseMobile();
  };

  const showAdminMenu =
    !isDemoSandbox && (authenticatedProdRole === 'admin' || authenticatedProdRole === 'reviewer');

  const renderSidebarContent = (isCompact: boolean) => {
    const navItemClass = (id: string, mathSection?: 'student' | 'teacher') => {
      const isActive =
        id === 'math_lab' && mathSection
          ? currentView === 'math_lab' &&
            (currentRole === 'student' ? mathSection === 'student' : mathLabSection === mathSection)
          : currentView === id;
      return `w-full flex items-center ${isCompact ? 'justify-center px-2' : 'space-x-3 px-3.5'} py-2.5 rounded-xl text-[13.5px] font-medium transition-all cursor-pointer ${
        isActive
          ? 'bg-[#1769F4] text-white shadow-[0_6px_18px_rgba(23,105,244,0.42)] border border-[#76BAFF]/45 font-bold'
          : 'text-slate-200/90 hover:bg-white/10 hover:text-white border border-transparent'
      }`;
    };

    const groupHeader = (label: string) =>
      isCompact ? (
        <div className="h-px bg-white/10 mx-2 my-2" aria-hidden="true" />
      ) : (
        <h3 className="text-[11px] font-bold text-slate-400/90 uppercase tracking-wider px-3 mb-2">
          {label}
        </h3>
      );

    return (
      <div
        className={`${
          isCompact ? 'w-[76px]' : 'w-[254px]'
        } bg-gradient-to-b from-[#102C54] via-[#12315D] to-[#0B203F] text-white flex flex-col h-full border-r border-[#1D4073] select-none font-edtech transition-[width] duration-200`}
      >
        {/* Desktop Rail Toggle */}
        <div className={`hidden md:flex items-center ${isCompact ? 'justify-center px-2' : 'justify-between px-4'} pt-3 pb-1 shrink-0`}>
          {!isCompact && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200/75">
              Điều hướng
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed(prev => !prev)}
            title={isCompact ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={isCompact ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isCompact ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable menu items */}
        <div className={`flex-1 overflow-y-auto ${isCompact ? 'px-2.5' : 'px-3.5'} py-3 space-y-5`}>
        {/* TRANG CHỦ */}
        <div className="space-y-1">
          <button
            onClick={() => handleNav('dashboard')}
            title="Trang chủ"
            className={navItemClass('dashboard')}
          >
            <Home className="w-4 h-4 shrink-0 text-amber-300" />
            {!isCompact && <span className="truncate">Trang chủ</span>}
          </button>
        </div>

        {/* HỌC SINH */}
        <div>
          {groupHeader('HỌC SINH')}
          <div className="space-y-1">
            <button
              onClick={() => handleNav('student_core_knowledge')}
              title="Kiến thức trọng tâm"
              className={navItemClass('student_core_knowledge')}
            >
              <Book className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Kiến thức trọng tâm</span>}
            </button>

            <button
              onClick={() => handleNav('student_practice')}
              title="Luyện theo bài / chương"
              className={navItemClass('student_practice')}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Luyện theo bài / chương</span>}
            </button>

            <button
              onClick={() => handleNav('student_semester_review')}
              title="Ôn tập học kỳ"
              className={navItemClass('student_semester_review')}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Ôn tập học kỳ</span>}
            </button>

            <button
              onClick={() => handleNav('student_assignments')}
              title="Bài được giao"
              className={navItemClass('student_assignments')}
            >
              <FileText className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Bài được giao</span>}
            </button>

            <button
              onClick={() => handleNav('student_exam_taking')}
              title="Kiểm tra trực tuyến"
              className={navItemClass('student_exam_taking')}
            >
              <Monitor className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Kiểm tra trực tuyến</span>}
            </button>

            <button
              onClick={() => handleNav('student_wrong_book')}
              title="Sổ câu sai"
              className={navItemClass('student_wrong_book')}
            >
              <AlertOctagon className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Sổ câu sai</span>}
            </button>

            <button
              onClick={() => handleNav('student_results')}
              title="Kết quả & tiến bộ"
              className={navItemClass('student_results')}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Kết quả &amp; tiến bộ</span>}
            </button>

            <button
              onClick={() => handleNav('student_study_materials')}
              title="Tài liệu học tập"
              className={navItemClass('student_study_materials')}
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              {!isCompact && <span className="truncate">Tài liệu học tập</span>}
            </button>

            <button
              onClick={() => handleNav('math_lab', 'student')}
              title="Phòng thí nghiệm Toán"
              className={navItemClass('math_lab', 'student')}
            >
              <FlaskConical className="w-4 h-4 shrink-0 text-emerald-300" />
              {!isCompact && <span className="truncate">Phòng thí nghiệm Toán</span>}
            </button>

            {currentRole === 'student' && (
              <button
                onClick={() => handleNav('teacher_student_call')}
                title="EDU Game Center (Khách)"
                className={navItemClass('teacher_student_call')}
              >
                <Dices className="w-4 h-4 shrink-0 text-amber-300" />
                {!isCompact && <span className="truncate">EDU Game Center (Khách)</span>}
              </button>
            )}
          </div>
        </div>

        {/* GIÁO VIÊN - Hiện cho Giáo viên thật & Giáo viên Demo */}
        {currentRole !== 'student' && (
          <div>
            {groupHeader(isDemoSandbox ? 'GIÁO VIÊN (DEMO KHKT)' : 'GIÁO VIÊN')}
            <div className="space-y-1">
              <button
                onClick={() => handleNav('teacher_lectures')}
                title="Bài giảng"
                className={navItemClass('teacher_lectures')}
              >
                <Presentation className="w-4 h-4 shrink-0 text-cyan-300" />
                {!isCompact && <span className="truncate">Bài giảng</span>}
              </button>

              <button
                onClick={() => handleNav('math_lab', 'teacher')}
                title="Phòng thí nghiệm Toán"
                className={navItemClass('math_lab', 'teacher')}
              >
                <FlaskConical className="w-4 h-4 shrink-0 text-emerald-300" />
                {!isCompact && <span className="truncate">Phòng thí nghiệm Toán</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_classes')}
                title="Lớp & phân công của tôi"
                className={navItemClass('teacher_classes')}
              >
                <Users className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Lớp &amp; phân công của tôi</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_student_call')}
                title="Trò chơi giáo dục"
                className={navItemClass('teacher_student_call')}
              >
                <Dices className="w-4 h-4 shrink-0 text-amber-300" />
                {!isCompact && <span className="truncate">Trò chơi giáo dục</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_question_bank')}
                title="Ngân hàng câu hỏi"
                className={navItemClass('teacher_question_bank')}
              >
                <Database className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Ngân hàng câu hỏi</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_create_exam')}
                title="Tạo đề & giao bài"
                className={navItemClass('teacher_create_exam')}
              >
                <FileEdit className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Tạo đề &amp; giao bài</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_matrix')}
                title="Ma trận & bản đặc tả"
                className={navItemClass('teacher_matrix')}
              >
                <LayoutGrid className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Ma trận &amp; bản đặc tả</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_grading')}
                title="Chấm bài & thống kê"
                className={navItemClass('teacher_grading')}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Chấm bài &amp; thống kê</span>}
              </button>

              <button
                onClick={() => handleNav('teacher_gemini')}
                title="Trợ lý Gemini"
                className={navItemClass('teacher_gemini')}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-amber-300" />
                {!isCompact && <span className="truncate">Trợ lý Gemini</span>}
              </button>
            </div>
          </div>
        )}

        {/* QUẢN TRỊ - Tuyệt đối chỉ hiển thị ở Không gian Chính thức cho Admin / Reviewer thật */}
        {showAdminMenu && (
          <div>
            {groupHeader('QUẢN TRỊ')}
            <div className="space-y-1">
              {authenticatedProdRole === 'admin' && (
                <button
                  onClick={() => handleNav('admin_accounts')}
                  title="Quản lý lớp & tài khoản"
                  className={navItemClass('admin_accounts')}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  {!isCompact && <span className="truncate">Quản lý lớp &amp; tài khoản</span>}
                </button>
              )}

              <button
                onClick={() => handleNav('admin_approval')}
                title="Duyệt câu hỏi"
                className={navItemClass('admin_approval')}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                {!isCompact && <span className="truncate">Duyệt câu hỏi</span>}
              </button>

              {authenticatedProdRole === 'admin' && (
                <button
                  onClick={() => handleNav('admin_settings')}
                  title="Cấu hình & sao lưu"
                  className={navItemClass('admin_settings')}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  {!isCompact && <span className="truncate">Cấu hình &amp; sao lưu</span>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="shrink-0 relative overflow-hidden bg-gradient-to-b from-transparent to-[#091B34]">
        {!isCompact && <SidebarFooterBooks3D />}
        <div className="px-3 py-2.5 bg-[#081A33]/90 border-t border-[#1D4477]/70 text-[11px] text-slate-300 text-center">
          {isCompact ? (
            <p className="font-extrabold text-white tracking-wider">TĐ</p>
          ) : (
            <>
              <p className="font-extrabold text-white tracking-wider">THCS TÂY ĐÔ</p>
              <p className="text-[10px] text-blue-200/80 mt-0.5">Smart EDU · GDPT 2018</p>
            </>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <>
      <aside className="hidden md:block shrink-0 h-full">
        {renderSidebarContent(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 h-full">
            {renderSidebarContent(false)}
          </div>
        </div>
      )}
    </>
  );
};
