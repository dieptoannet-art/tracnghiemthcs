import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';

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

// Supabase guide modal
import { SupabaseGuideModal } from './components/SupabaseGuideModal';
import { AuthModal } from './components/auth/AuthModal';
import { ShieldAlert } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    currentRole,
    user,
    authLoading,
    profileStatus,
    profileError,
    retryLoadProfile,
    isSupabaseLiveConfigured,
    importQuestionsBatch,
    authModalOpen,
    setAuthModalOpen,
    openAuthModal
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

  // ROUTE GUARD: Chặn truy cập trái quyền ở cấp độ Route & URL trực tiếp
  // Ngoại lệ: 'teacher_student_call' (EDU Game Center) cho phép Chế độ Khách & Học sinh truy cập không cần đăng nhập
  const isTeacherRoute = currentView.startsWith('teacher_') && currentView !== 'teacher_student_call';
  const isAdminRoute = currentView.startsWith('admin_');
  const isAdminOnlyRoute =
    currentView === 'admin_accounts' ||
    currentView === 'admin_settings' ||
    currentView === 'admin_curriculum';

  const renderGuardShell = (content: React.ReactNode) => (
    <div className="min-h-screen bg-[#F3F8FF] flex flex-col font-serif">
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
      {supabaseModalOpen && (
        <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />
      )}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );

  // 1. Khi đang khôi phục phiên hoặc nạp vai trò từ CSDL, tránh nháy màn hình sai quyền
  if (isSupabaseLiveConfigured && (authLoading || (user && profileStatus === 'loading')) && (isTeacherRoute || isAdminRoute)) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-md shadow-xs space-y-3">
        <p className="text-base font-bold text-[#082B52]">Đang xác minh phiên đăng nhập & phân quyền...</p>
        <p className="text-xs text-slate-500">Hệ thống đang đối chiếu vai trò thực tế từ bảng hồ sơ Supabase.</p>
      </div>
    );
  }

  // 2. Chặn truy cập trực tiếp vào khu vực Giáo viên / Quản trị khi chưa đăng nhập
  if (isSupabaseLiveConfigured && !user && (isTeacherRoute || isAdminRoute)) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center max-w-lg shadow-sm space-y-4">
        <div className="w-16 h-16 bg-blue-50 text-[#006BFF] rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#082B52]">Yêu cầu đăng nhập</h3>
          <p className="text-xs text-slate-500 mt-1">Đường dẫn yêu cầu xác thực: {currentView}</p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Vui lòng đăng nhập bằng tài khoản được cấp quyền phù hợp để truy cập phân hệ này.
        </p>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs"
          >
            Đăng nhập ngay
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50"
          >
            Quay lại Trang chủ
          </button>
        </div>
      </div>
    );
  }

  // 3. Nếu nạp hồ sơ/vai trò bị lỗi DB/RLS, chặn truy cập đặc quyền và hiển thị lỗi rõ ràng
  if (user && profileStatus === 'error' && (isTeacherRoute || isAdminRoute)) {
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
            className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors"
          >
            Thử tải lại hồ sơ
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50"
          >
            Về Trang chủ
          </button>
        </div>
      </div>
    );
  }

  // 4. Chặn Học sinh vào route Giáo viên / Quản trị
  if (currentRole === 'student' && (isTeacherRoute || isAdminRoute)) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-lg shadow-sm space-y-4">
        <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#082B52]">Từ chối truy cập (403 Forbidden)</h3>
          <p className="text-xs text-red-600 font-semibold mt-1">Phát hiện truy cập trái quyền ở route: {currentView}</p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Tài khoản của bạn hiện tại có vai trò <strong>Học sinh</strong> và không được cấp quyền truy cập các phân hệ nghiệp vụ dành cho Giáo viên hoặc Quản trị viên.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs"
          >
            Quay lại Trang chủ
          </button>
        </div>
      </div>
    );
  }

  // 5. Chặn Giáo viên truy cập route Quản trị, và chặn Kiểm duyệt viên vào Tài khoản & phân quyền / Cấu hình
  if (
    (currentRole === 'teacher' && isAdminRoute) ||
    (currentRole === 'reviewer' && isAdminOnlyRoute)
  ) {
    return renderGuardShell(
      <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center max-w-lg shadow-sm space-y-4">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#082B52]">Từ chối truy cập khu vực Quản trị (403)</h3>
          <p className="text-xs text-amber-700 font-semibold mt-1">Route yêu cầu quyền Quản trị viên: {currentView}</p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Phân hệ này chỉ dành riêng cho <strong>Quản trị viên</strong> trường THCS Tây Đô.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setCurrentView('dashboard')}
            className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs"
          >
            Quay lại Trang chủ
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
    <div className="min-h-screen bg-[#F6FAFF] flex flex-col font-serif">
      {/* Top Header */}
      <Header
        onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
      />

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onResetStudentAssignments={() => setSelectedAssignmentId(null)}
        />

        {/* Content View Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-5">
            {user && profileStatus === 'error' && profileError && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-bold">Không thể tải hồ sơ & vai trò từ bảng public.profiles</p>
                    <p className="text-red-800 mt-0.5">{profileError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => retryLoadProfile()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0"
                >
                  Thử tải lại hồ sơ
                </button>
              </div>
            )}
            {renderCurrentView()}
          </div>
        </main>
      </div>

      {/* Supabase Connection Modal */}
      {supabaseModalOpen && (
        <SupabaseGuideModal onClose={() => setSupabaseModalOpen(false)} />
      )}

      {/* Excel/Word Import Modal */}
      {importModalOpen && (
        <QuestionImportModal
          onClose={() => setImportModalOpen(false)}
          onImportSuccess={importQuestionsBatch}
        />
      )}

      {/* Supabase Authentication Modal */}
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
