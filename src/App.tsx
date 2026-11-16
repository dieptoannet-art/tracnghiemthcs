import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';

// Portals & KHKT Showcase
import { HomeEntryHub } from './components/portal/HomeEntryHub';
import { LoginPortalView } from './components/portal/LoginPortalView';
import { PublicGuestPortal } from './components/explore/PublicGuestPortal';
import { KhktShowcaseView } from './components/khkt/KhktShowcaseView';
import { KhktPresentationMode } from './components/khkt/KhktPresentationMode';

// Student views
import { CoreKnowledgeView } from './components/student/CoreKnowledgeView';
import { PracticeMode } from './components/student/PracticeMode';
import { SemesterReview } from './components/student/SemesterReview';
import { StudentAssignmentsView } from './components/student/StudentAssignmentsView';
import { ExamTaking } from './components/student/ExamTaking';
import { WrongQuestionsBook } from './components/student/WrongQuestionsBook';
import { StudentResults } from './components/student/StudentResults';
import { StudyMaterials } from './components/student/StudyMaterials';

// Teacher views
import { ClassManagement } from './components/teacher/ClassManagement';
import { QuestionBank } from './components/teacher/QuestionBank';
import { CreateExamModal } from './components/teacher/CreateExamModal';
import { ExamMatrixModal } from './components/teacher/ExamMatrixModal';
import { GradingAndReports } from './components/teacher/GradingAndReports';
import { GeminiAssistantView } from './components/teacher/GeminiAssistantView';
import { QuestionImportModal } from './components/teacher/QuestionImportModal';
import { StudentCallGames } from './components/teacher/StudentCallGames';
import { TeacherLectures } from './components/teacher/TeacherLectures';
import { SmartMathLabView } from './components/math-lab/SmartMathLabView';

// Admin views
import { AccountManagement } from './components/admin/AccountManagement';
import { CurriculumManagement } from './components/admin/CurriculumManagement';
import { QuestionApproval } from './components/admin/QuestionApproval';
import { SystemSettings } from './components/admin/SystemSettings';

// Modals & Guards
import { SupabaseGuideModal } from './components/SupabaseGuideModal';
import { AuthModal } from './components/auth/AuthModal';
import { checkViewAccessPermission } from './types/accessMode';
import { usePremiumUi2027 } from './config/uiThemeFlag';
import { ShieldAlert, RotateCcw, Presentation, Lock, Home } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    accessMode,
    isDemoSandbox,
    enterPublicGuest,
    enterDemoRole,
    enterKhktShowcase,
    exitDemoToWorkspace,
    resetDemoSandbox,
    khktPresentationStep,
    preferredDemoAssignmentId,
    setPreferredDemoAssignmentId,
    reducedMotion,
    currentView,
    setCurrentView,
    authenticatedProdUser,
    authenticatedProdRole,
    user,
    authLoading,
    profileStatus,
    profileError,
    retryLoadProfile,
    isSupabaseLiveConfigured,
    importQuestionsBatch,
    authModalOpen,
    setAuthModalOpen,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [sandboxResetNote, setSandboxResetNote] = useState(false);
  const [isPremium2027] = usePremiumUi2027();

  // Deep-link selected demo assignment into StudentAssignmentsView / ExamTaking cleanly
  useEffect(() => {
    if (currentView === 'student_assignments' && preferredDemoAssignmentId) {
      setSelectedAssignmentId(preferredDemoAssignmentId);
      setPreferredDemoAssignmentId(null);
    }
  }, [currentView, preferredDemoAssignmentId, setPreferredDemoAssignmentId]);

  useEffect(() => {
    if (currentView !== 'student_assignments') {
      setSelectedAssignmentId(null);
    }
  }, [currentView]);

  const handleSandboxReset = () => {
    resetDemoSandbox();
    setSelectedAssignmentId(null);
    setSandboxResetNote(true);
    window.setTimeout(() => setSandboxResetNote(false), 2000);
  };

  // Standalone full-bleed entry portals (no left sidebar clutter)
  if (currentView === 'home_portal') {
    return (
      <div className={reducedMotion ? 'smart-reduce-motion' : ''}>
        <HomeEntryHub />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  if (currentView === 'login_portal') {
    return (
      <div className={reducedMotion ? 'smart-reduce-motion' : ''}>
        <LoginPortalView />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  // Evaluate RBAC + Sandbox isolation
  const permission = checkViewAccessPermission({
    view: currentView,
    accessMode,
    prodRole: authenticatedProdRole,
    prodAuthenticated: Boolean(authenticatedProdUser),
    prodProfileStatus: profileStatus,
    isSupabaseConfigured: isSupabaseLiveConfigured,
  });

  const renderSandboxTopBanner = () => {
    if (!isDemoSandbox) return null;
    return (
      <div className="bg-[#102C54] text-white border-b border-[#1D467E] px-4 sm:px-6 py-2 text-xs font-edtech shrink-0">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-extrabold uppercase text-[10px]">
              SANDBOX ĐỘC LẬP
            </span>
            <span className="text-blue-100 hidden sm:inline">
              Mọi thay đổi chỉ lưu trên trình duyệt, không ảnh hưởng dữ liệu trường học thật.
            </span>

            {/* Quick role toggles */}
            <div className="inline-flex items-center rounded-lg bg-white/10 p-0.5 gap-0.5">
              <button
                type="button"
                onClick={enterPublicGuest}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  accessMode === 'PUBLIC_GUEST' ? 'bg-white text-[#082B52]' : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                Khách
              </button>
              <button
                type="button"
                onClick={() => enterDemoRole('teacher', currentView)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  accessMode === 'DEMO_TEACHER' ? 'bg-emerald-400 text-[#082B52]' : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                GV Demo (50 HS)
              </button>
              <button
                type="button"
                onClick={() =>
                  enterDemoRole(
                    'student',
                    currentView.startsWith('teacher_') && currentView !== 'teacher_student_call'
                      ? 'public_explore'
                      : currentView
                  )
                }
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                  accessMode === 'DEMO_STUDENT' ? 'bg-amber-300 text-[#082B52]' : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                HS Demo
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {accessMode === 'KHKT_SHOWCASE' && currentView !== 'khkt_presentation' && (
              <button
                type="button"
                onClick={() => enterKhktShowcase(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white font-bold cursor-pointer"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>Về Trình diễn KHKT (Bước {khktPresentationStep})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSandboxReset}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{sandboxResetNote ? 'Đã đặt lại!' : 'Đặt lại Demo'}</span>
            </button>

            <button
              type="button"
              onClick={() => exitDemoToWorkspace('dashboard')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-[#082B52] hover:bg-sky-50 font-bold cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>{authenticatedProdUser ? 'Về Workspace Thật' : 'Đăng nhập Thật'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const shellThemeClasses = isPremium2027
    ? 'bg-[#F6F9FD] text-[#172B4D] font-edtech'
    : 'bg-[#F6FAFF] text-[#0F2D52] font-serif';

  const renderGuardShell = (content: React.ReactNode) => (
    <div className={`min-h-screen flex flex-col ${shellThemeClasses} ${reducedMotion ? 'smart-reduce-motion' : ''}`}>
      {renderSandboxTopBanner()}
      <Header
        onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onResetStudentAssignments={() => setSelectedAssignmentId(null)}
        />
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center">
          {content}
        </main>
      </div>
      {supabaseModalOpen && <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );

  // Loading guard for authenticated production routes
  if (
    !isDemoSandbox &&
    isSupabaseLiveConfigured &&
    (authLoading || (user && profileStatus === 'loading')) &&
    (currentView.startsWith('admin_') ||
      (currentView.startsWith('teacher_') && currentView !== 'teacher_student_call'))
  ) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-md shadow-xs space-y-3">
        <p className="text-base font-bold text-[#082B52]">Đang xác minh phiên đăng nhập &amp; phân quyền...</p>
        <p className="text-xs text-slate-500">Hệ thống đang đối chiếu vai trò thực tế từ bảng hồ sơ Supabase.</p>
      </div>
    );
  }

  // Permission denial rendering
  if (!permission.allowed) {
    if (permission.reason === 'ADMIN_PRODUCTION_ONLY') {
      return renderGuardShell(
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center max-w-lg shadow-sm space-y-4 font-edtech">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[#082B52]">
              Phân hệ Quản trị bị khóa trong Chế độ Demo / Khách
            </h3>
            <p className="text-xs text-amber-800 font-semibold mt-1">
              Đường dẫn bảo vệ: {currentView}
            </p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Để bảo vệ tài khoản và cơ sở dữ liệu thật của trường THCS Tây Đô, hệ thống không cấp quyền Quản trị viên trong chế độ trải nghiệm công khai.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={enterPublicGuest}
              className="px-5 py-2.5 bg-[#0B63CE] text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-[#084FA6] cursor-pointer"
            >
              Về Cổng Trải nghiệm (/explore)
            </button>
            <button
              type="button"
              onClick={() => exitDemoToWorkspace(currentView)}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Đăng nhập Quản trị Chính thức
            </button>
          </div>
        </div>
      );
    }

    if (permission.reason === 'DEMO_STUDENT_FORBIDDEN_TEACHER_ROUTE') {
      return renderGuardShell(
        <div className="bg-white rounded-2xl border border-[#CBE0FA] p-8 text-center max-w-lg shadow-sm space-y-4 font-edtech">
          <div className="w-16 h-16 bg-[#EBF3FF] text-[#0B63CE] rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[#082B52]">
              Phân hệ Giáo viên ({currentView})
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Bạn đang ở vai trò <strong>{accessMode}</strong>. Hãy chuyển sang <strong>Giáo viên Demo (50 HS)</strong> để dùng thử phân hệ này trong Sandbox!
            </p>
          </div>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => enterDemoRole('teacher', currentView)}
              className="px-5 py-2.5 bg-emerald-600 text-white text-xs sm:text-sm font-bold rounded-xl hover:bg-emerald-700 cursor-pointer"
            >
              Mở với Giáo viên Demo (50 HS)
            </button>
            <button
              type="button"
              onClick={enterPublicGuest}
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs sm:text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Về Cổng Trải nghiệm
            </button>
          </div>
        </div>
      );
    }

    if (permission.reason === 'AUTH_REQUIRED') {
      return renderGuardShell(
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-lg shadow-sm space-y-4 font-edtech">
          <div className="w-16 h-16 bg-blue-50 text-[#006BFF] rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#082B52]">Yêu cầu đăng nhập</h3>
            <p className="text-xs text-slate-500 mt-1">Đường dẫn yêu cầu xác thực: {currentView}</p>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Vui lòng đăng nhập bằng tài khoản được cấp quyền phù hợp để truy cập phân hệ chính thức này.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCurrentView('login_portal')}
              className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs cursor-pointer"
            >
              Đăng nhập ngay
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('home_portal')}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>Về Cổng chính</span>
            </button>
          </div>
        </div>
      );
    }

    if (permission.reason === 'PROFILE_ERROR') {
      return renderGuardShell(
        <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-lg shadow-sm space-y-4">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-[#082B52]">Không thể xác minh phân quyền tài khoản</h3>
          <p className="text-sm text-red-700 leading-relaxed">{profileError}</p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => retryLoadProfile()}
              className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors cursor-pointer"
            >
              Thử tải lại hồ sơ
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              Về Bảng tổng quan
            </button>
          </div>
        </div>
      );
    }

    // STUDENT_FORBIDDEN or ADMIN_ONLY
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-lg shadow-sm space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#082B52]">Từ chối truy cập (403 Forbidden)</h3>
          <p className="text-xs text-red-600 font-semibold mt-1">
            Phát hiện truy cập trái quyền ở route: {currentView}
          </p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Tài khoản hiện tại không được cấp quyền truy cập phân hệ này.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs cursor-pointer"
          >
            Quay lại Bảng tổng quan
          </button>
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'public_explore':
        return <PublicGuestPortal />;
      case 'khkt_showcase':
        return <KhktShowcaseView />;
      case 'khkt_presentation':
        return <KhktPresentationMode />;

      case 'dashboard':
        return (
          <Dashboard
            onOpenExamMatrixModal={() => setCurrentView('teacher_matrix')}
            onOpenCreateExamModal={() => setCurrentView('teacher_create_exam')}
            onOpenImportModal={() => setImportModalOpen(true)}
          />
        );

      // Student views
      case 'student_core_knowledge':
        return <CoreKnowledgeView />;
      case 'student_practice':
        return <PracticeMode />;
      case 'student_semester_review':
        return <SemesterReview />;
      case 'student_assignments':
        if (selectedAssignmentId) {
          return (
            <ExamTaking
              assignmentId={selectedAssignmentId}
              strictAssignmentMode={true}
              onBackToAssignments={() => setSelectedAssignmentId(null)}
              onBackToDashboard={() => {
                setSelectedAssignmentId(null);
                setCurrentView(isDemoSandbox ? 'public_explore' : 'dashboard');
              }}
            />
          );
        }
        return (
          <StudentAssignmentsView
            onOpenAssignment={(asgId) => setSelectedAssignmentId(asgId)}
            onViewResults={() => setCurrentView('student_results')}
            onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
          />
        );
      case 'student_exam_taking':
        return <ExamTaking onBackToDashboard={() => setCurrentView(isDemoSandbox ? 'public_explore' : 'dashboard')} />;
      case 'student_wrong_book':
        return <WrongQuestionsBook />;
      case 'student_results':
        return <StudentResults />;
      case 'student_study_materials':
        return <StudyMaterials />;
      case 'math_lab':
        return <SmartMathLabView />;

      // Teacher views
      case 'teacher_lectures':
        return <TeacherLectures />;
      case 'teacher_classes':
        return <ClassManagement />;
      case 'teacher_student_call':
        return <StudentCallGames />;
      case 'teacher_question_bank':
        return <QuestionBank />;
      case 'teacher_create_exam':
        return <CreateExamModal />;
      case 'teacher_matrix':
        return <ExamMatrixModal />;
      case 'teacher_grading':
        return <GradingAndReports />;
      case 'teacher_gemini':
        return <GeminiAssistantView />;

      // Admin views (Production Only)
      case 'admin_accounts':
        return <AccountManagement />;
      case 'admin_curriculum':
        return <CurriculumManagement />;
      case 'admin_approval':
        return <QuestionApproval />;
      case 'admin_settings':
        return <SystemSettings onOpenSupabaseConfig={() => setSupabaseModalOpen(true)} />;

      default:
        return <HomeEntryHub />;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${shellThemeClasses} ${reducedMotion ? 'smart-reduce-motion' : ''}`}>
      {renderSandboxTopBanner()}
      <Header
        onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onResetStudentAssignments={() => setSelectedAssignmentId(null)}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-5">
            {!isDemoSandbox && user && profileStatus === 'error' && profileError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold">Không thể tải hồ sơ &amp; vai trò từ bảng public.profiles</p>
                    <p className="text-red-800 mt-0.5">{profileError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => retryLoadProfile()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                >
                  Thử tải lại hồ sơ
                </button>
              </div>
            )}
            {renderCurrentView()}
          </div>
        </main>
      </div>

      {supabaseModalOpen && (
        <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />
      )}

      {importModalOpen && (
        <QuestionImportModal
          onClose={() => setImportModalOpen(false)}
          onImportSuccess={importQuestionsBatch}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
