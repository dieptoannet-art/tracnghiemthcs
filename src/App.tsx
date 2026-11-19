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
import { ShieldAlert, Home } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
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

  useEffect(() => {
    if (currentView !== 'student_assignments') {
      setSelectedAssignmentId(null);
    }
  }, [currentView]);

  if (currentView === 'login_portal') {
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
            {user && profileStatus === 'error' && profileError && (
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
