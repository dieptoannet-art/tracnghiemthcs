import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';

// Student views
import { CoreKnowledgeView } from './components/student/CoreKnowledgeView';
import { PracticeMode } from './components/student/PracticeMode';
import { SemesterReview } from './components/student/SemesterReview';
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
  const { currentView, setCurrentView, currentRole, importQuestionsBatch, authModalOpen, setAuthModalOpen } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [supabaseModalOpen, setSupabaseModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // ROUTE GUARD: Chặn truy cập trái quyền ở cấp độ Route
  const isTeacherRoute = currentView.startsWith('teacher_');
  const isAdminRoute = currentView.startsWith('admin_');

  if (currentRole === 'student' && (isTeacherRoute || isAdminRoute)) {
    return (
      <div className="min-h-screen bg-[#F3F8FF] flex flex-col font-serif">
        <Header
          onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center">
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
                  onClick={() => setCurrentView('dashboard')}
                  className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs"
                >
                  Quay lại Trang chủ
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Chặn giáo viên truy cập route quản trị (trừ duyệt câu hỏi nếu được phân công)
  if (currentRole === 'teacher' && isAdminRoute) {
    return (
      <div className="min-h-screen bg-[#F3F8FF] flex flex-col font-serif">
        <Header
          onOpenSupabaseConfig={() => setSupabaseModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
          <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center">
            <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center max-w-lg shadow-sm space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#082B52]">Khu vực Quản trị hệ thống</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Phân hệ này chỉ dành riêng cho <strong>Quản trị viên</strong> trường THCS Tây Đô.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className="px-6 py-2.5 bg-[#006BFF] text-white text-sm font-bold rounded-xl hover:bg-blue-600 transition-colors shadow-xs"
                >
                  Quay lại Trang chủ
                </button>
              </div>
            </div>
          </main>
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
      case 'student_exam_taking':
        return <ExamTaking onBackToDashboard={() => setCurrentView('dashboard')} />;
      case 'student_wrong_book':
        return <WrongQuestionsBook />;
      case 'student_results':
        return <StudentResults />;
      case 'student_study_materials':
        return <StudyMaterials />;

      // Teacher views
      case 'teacher_classes':
        return <ClassManagement />;
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
    <div className="min-h-screen bg-[#F3F8FF] flex flex-col font-serif">
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
        />

        {/* Content View Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="max-w-7xl mx-auto">
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
