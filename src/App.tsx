import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';

// Portals
import { LoginPortalView } from './components/portal/LoginPortalView';

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
import { KhktDemoBanner } from './components/demo/KhktDemoBanner';
import { evaluateProductionRouteAccess } from './utils/khktDemoSandbox';
import { ShieldAlert, Home, Lock, LogIn, Sparkles } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    reducedMotion,
    currentView,
    setCurrentView,
    isDemoSandbox,
    demoResetVersion,
    enterKhktDemo,
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

  useEffect(() => {
    if (currentView !== 'student_assignments') {
      setSelectedAssignmentId(null);
    }
  }, [currentView]);

  useEffect(() => {
    if (isDemoSandbox) {
      setSelectedAssignmentId(null);
      setSupabaseModalOpen(false);
    }
  }, [demoResetVersion, isDemoSandbox]);

  if (!isDemoSandbox && currentView === 'login_portal') {
    return (
      <div className={reducedMotion ? 'smart-reduce-motion' : ''}>
        <LoginPortalView />
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    );
  }

  const shellThemeClasses = 'bg-[#F6FAFF] text-[#0F2D52] font-serif';

  const renderGuardShell = (content: React.ReactNode) => (
    <div className={`min-h-screen flex flex-col ${shellThemeClasses} ${reducedMotion ? 'smart-reduce-motion' : ''}`}>
      {isDemoSandbox && <KhktDemoBanner />}
      <Header
        onOpenSupabaseConfig={() => {
          if (!isDemoSandbox) setSupabaseModalOpen(true);
        }}
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
      {!isDemoSandbox && supabaseModalOpen && (
        <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />
      )}
      {!isDemoSandbox && (
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      )}
    </div>
  );

  // Loading guard for authenticated production routes (never fires inside /demo)
  if (
    !isDemoSandbox &&
    isSupabaseLiveConfigured &&
    (authLoading || (user && profileStatus === 'loading')) &&
    (currentView.startsWith('admin_') ||
      (currentView.startsWith('teacher_') && currentView !== 'teacher_student_call'))
  ) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-md shadow-xs space-y-3 font-edtech">
        <p className="text-base font-bold text-[#082B52]">Đang xác minh phiên đăng nhập &amp; phân quyền...</p>
        <p className="text-xs text-slate-500">Hệ thống đang đối chiếu vai trò thực tế từ bảng hồ sơ Supabase.</p>
      </div>
    );
  }

  // Strict production authentication & RBAC guard for real teacher/admin URLs outside /demo
  const routeAccess = evaluateProductionRouteAccess({
    isDemoSandbox,
    currentView,
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
    isAuthenticated: Boolean(authenticatedProdUser),
    authenticatedRole: authenticatedProdRole,
  });

  if (!routeAccess.allowed) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-7 sm:p-8 text-center max-w-lg shadow-sm space-y-4 font-edtech">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-[#082B52]">
            {routeAccess.reason === 'unauthenticated'
              ? 'Yêu cầu đăng nhập tài khoản thật'
              : 'Không đủ quyền truy cập khu vực này'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {routeAccess.reason === 'unauthenticated'
              ? `Khu vực này dành cho ${routeAccess.requiredLabel || 'tài khoản được phân quyền'} trên hệ thống chính thức. Vui lòng đăng nhập hoặc mở Bản demo KHKT để trải nghiệm dữ liệu mẫu.`
              : `Tài khoản hiện tại không có quyền ${routeAccess.requiredLabel || 'phù hợp'} để truy cập trang này.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {!isDemoSandbox && (
            <button
              type="button"
              onClick={() => setCurrentView('login_portal')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1769F4] hover:bg-[#0F56D3] text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập tài khoản thật</span>
            </button>
          )}
          {!isDemoSandbox && (
            <button
              type="button"
              onClick={() => enterKhktDemo('dashboard')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F2D52] text-xs sm:text-sm font-extrabold cursor-pointer transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span>Mở Bản demo KHKT</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-bold cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ</span>
          </button>
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
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
                setCurrentView('dashboard');
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
        return <ExamTaking onBackToDashboard={() => setCurrentView('dashboard')} />;
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

      // Admin views
      case 'admin_accounts':
        return <AccountManagement />;
      case 'admin_curriculum':
        return <CurriculumManagement />;
      case 'admin_approval':
        return <QuestionApproval />;
      case 'admin_settings':
        return <SystemSettings onOpenSupabaseConfig={() => setSupabaseModalOpen(true)} />;

      default:
        return (
          <Dashboard
            onOpenExamMatrixModal={() => setCurrentView('teacher_matrix')}
            onOpenCreateExamModal={() => setCurrentView('teacher_create_exam')}
            onOpenImportModal={() => setImportModalOpen(true)}
          />
        );
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${shellThemeClasses} ${reducedMotion ? 'smart-reduce-motion' : ''}`}>
      {isDemoSandbox && <KhktDemoBanner />}
      <Header
        onOpenSupabaseConfig={() => {
          if (!isDemoSandbox) setSupabaseModalOpen(true);
        }}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onResetStudentAssignments={() => setSelectedAssignmentId(null)}
        />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div
            key={isDemoSandbox ? `khkt-demo-${demoResetVersion}` : 'prod-workspace'}
            className="max-w-7xl mx-auto space-y-5"
          >
            {!isDemoSandbox && user && profileStatus === 'error' && profileError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 font-edtech"
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

      {!isDemoSandbox && supabaseModalOpen && (
        <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />
      )}

      {importModalOpen && (
        <QuestionImportModal
          onClose={() => setImportModalOpen(false)}
          onImportSuccess={importQuestionsBatch}
        />
      )}

      {!isDemoSandbox && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
      )}
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
