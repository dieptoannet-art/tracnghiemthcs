import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Settings,
  BookOpen,
  FileCheck2,
  AlertOctagon,
  BarChart2,
  Database,
  FileEdit,
  FileText,
  BarChart3,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Layers,
  Send,
  CheckCircle2,
  ArrowRight,
  Lightbulb,
  GraduationCap,
  Laptop,
  UserPlus
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Grade, ExamPeriod, SubjectId, UserRole } from '../types';

interface DashboardProps {
  onOpenExamMatrixModal: () => void;
  onOpenCreateExamModal: () => void;
  onOpenImportModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onOpenExamMatrixModal,
  onOpenCreateExamModal,
  onOpenImportModal
}) => {
  const {
    currentRole,
    setCurrentRole,
    user,
    userProfile,
    isDemoMode,
    openAuthModal,
    selectedGrade,
    setSelectedGrade,
    selectedSubject,
    setSelectedSubject,
    selectedPeriod,
    setSelectedPeriod,
    setCurrentView,
    questions,
    classes,
    submissions
  } = useApp();

  const [chartSubject, setChartSubject] = useState<SubjectId>('math');

  const grades: Grade[] = ['6', '7', '8', '9'];

  const periods: { id: ExamPeriod; label: string }[] = [
    { id: 'mid1', label: 'Giữa kỳ I' },
    { id: 'final1', label: 'Cuối kỳ I' },
    { id: 'mid2', label: 'Giữa kỳ II' },
    { id: 'final2', label: 'Cuối kỳ II' }
  ];

  const subjects: { id: SubjectId; label: string }[] = [
    { id: 'math', label: 'Toán' },
    { id: 'literature', label: 'Ngữ văn' },
    { id: 'english', label: 'Tiếng Anh' },
    { id: 'science', label: 'Khoa học tự nhiên' },
    { id: 'history_geo', label: 'Lịch sử và Địa lí' },
    { id: 'informatics', label: 'Tin học' },
    { id: 'technology', label: 'Công nghệ' },
    { id: 'civics', label: 'GDCD' },
    { id: 'other', label: 'Môn khác' }
  ];

  // Dynamic progress chart data based on subject
  const chartDataPoints: Record<SubjectId, { months: string[]; scores: number[]; progress: string }> = {
    math: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [10, 28, 32, 45, 48, 62, 68, 88, 0],
      progress: '+32%'
    },
    informatics: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [20, 35, 50, 60, 70, 78, 85, 92, 0],
      progress: '+40%'
    },
    science: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [15, 30, 42, 55, 58, 65, 74, 82, 0],
      progress: '+28%'
    },
    literature: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [25, 32, 40, 50, 55, 64, 70, 80, 0],
      progress: '+25%'
    },
    english: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [18, 30, 45, 52, 60, 68, 76, 85, 0],
      progress: '+35%'
    },
    history_geo: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [20, 34, 46, 54, 62, 70, 78, 84, 0],
      progress: '+30%'
    },
    technology: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [30, 40, 52, 65, 72, 80, 86, 90, 0],
      progress: '+22%'
    },
    civics: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [25, 42, 58, 68, 75, 82, 88, 94, 0],
      progress: '+38%'
    },
    other: {
      months: ['Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5'],
      scores: [20, 30, 40, 50, 60, 70, 80, 85, 0],
      progress: '+25%'
    }
  };

  const activeChart = chartDataPoints[chartSubject] || chartDataPoints.math;

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP TITLE & ROLE SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#12345B]">
            Không gian học tập và kiểm tra
          </h2>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-slate-500">Trường THCS Tây Đô • GDPT 2018</span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center space-x-1">
              <Database className="w-3 h-3 text-emerald-600" />
              <span>Đồng bộ CSDL Supabase</span>
            </span>
          </div>
        </div>

        {/* Role display & switcher (Chỉ hiển thị nút chuyển góc nhìn nếu là Quản trị viên; Học sinh không được tự nâng quyền) */}
        <div className="flex items-center space-x-2 bg-white border border-[#DCE8F7] px-3.5 py-1.5 rounded-xl shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Vai trò:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
            currentRole === 'admin'
              ? 'bg-red-100 text-red-800'
              : currentRole === 'teacher'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}>
            {currentRole === 'admin' ? 'Quản trị viên' : currentRole === 'teacher' ? 'Giáo viên' : 'Học sinh'}
          </span>
          {/* Chỉ tài khoản Quản trị viên mới có quyền chuyển đổi góc nhìn để kiểm thử */}
          {userProfile?.role === 'admin' && (
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 ml-2 border border-slate-200">
              <button
                onClick={() => setCurrentRole('student')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  currentRole === 'student' ? 'bg-[#006BFF] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Góc nhìn Học sinh"
              >
                Học sinh
              </button>
              <button
                onClick={() => setCurrentRole('teacher')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  currentRole === 'teacher' ? 'bg-[#006BFF] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Góc nhìn Giáo viên"
              >
                Giáo viên
              </button>
              <button
                onClick={() => setCurrentRole('admin')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  currentRole === 'admin' ? 'bg-[#006BFF] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Góc nhìn Quản trị"
              >
                Quản trị
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. BLUE GRADIENT HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0052cc] via-[#0066ee] to-[#00b4d8] text-white p-6 sm:p-8 lg:p-10 shadow-md">
        {/* Subtle background SVG doodle marks */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-dots" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="2" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-dots)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left max-w-xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white drop-shadow-xs">
              Học vững kiến thức – Tự tin kiểm tra
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 font-normal tracking-wide">
              Kiến thức hôm nay – Thành công ngày mai
            </p>
            {(user || userProfile) ? (
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-xs text-white px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/20">
                  <span>Xin chào, <strong>{userProfile?.fullName || 'Thầy Diệp Thanh Toàn'}</strong> ({userProfile?.role === 'teacher' ? 'Giáo viên' : userProfile?.role === 'admin' ? 'Quản trị' : 'Học sinh'})!</span>
                </div>
                <button
                  onClick={() => setCurrentView(currentRole === 'teacher' ? 'teacher_question_bank' : 'student_practice')}
                  className="px-4 py-2 bg-white text-[#0052cc] rounded-xl font-bold text-xs shadow-md hover:bg-blue-50 transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <span>{currentRole === 'teacher' ? 'Xem ngân hàng câu hỏi' : 'Bắt đầu luyện tập ngay'}</span>
                </button>
              </div>
            ) : (
              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <button
                  onClick={() => openAuthModal('register')}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white text-[#0052cc] rounded-xl text-xs font-bold shadow-md hover:bg-blue-50 transition-all cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 text-[#006BFF]" />
                  <span>Đăng ký tài khoản (Giáo viên / Học sinh)</span>
                </button>
                <button
                  onClick={() => openAuthModal('login')}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-all cursor-pointer"
                >
                  <span>Đăng nhập</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Banner Illustration Graphic */}
          <div className="relative shrink-0 flex items-center justify-center">
            <div className="w-64 h-36 sm:w-80 sm:h-44 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 shadow-lg flex items-center justify-around">
              {/* Stack of books & graduation cap */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-12 bg-amber-400 rounded-md shadow-md flex items-center justify-center text-slate-800 font-bold text-xs -mb-2 border-b-2 border-amber-600">
                  GDPT 2018
                </div>
                <div className="w-20 h-5 bg-blue-700 rounded-sm shadow-xs -mb-2"></div>
                <div className="w-24 h-6 bg-red-600 rounded-sm shadow-md"></div>
                <GraduationCap className="w-12 h-12 text-slate-900 absolute -top-3 drop-shadow-md" />
              </div>

              {/* Laptop with test results */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-700 shadow-xl w-32 h-24 flex flex-col justify-between">
                <div className="bg-slate-800 h-16 rounded p-1 flex flex-col justify-center space-y-1">
                  <div className="flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[9px] text-white">Điểm: 10/10</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full w-[95%]"></div>
                  </div>
                  <span className="text-[8px] text-slate-400">Đã nộp bài</span>
                </div>
                <div className="h-1 w-8 bg-slate-600 mx-auto rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. FILTER BAR 1: GRADE SELECTION & EXAM PERIOD SELECTION */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Grade buttons: Lớp 6, Lớp 7, Lớp 8, Lớp 9 */}
        <div className="inline-flex rounded-xl bg-white border border-[#DCE8F7] p-1 shadow-xs">
          {grades.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGrade(g)}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedGrade === g
                  ? 'bg-[#006BFF] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#006BFF] hover:bg-[#F3F8FF]'
              }`}
            >
              Lớp {g}
            </button>
          ))}
        </div>

        {/* Period buttons: Giữa kỳ I, Cuối kỳ I, Giữa kỳ II, Cuối kỳ II */}
        <div className="inline-flex rounded-xl bg-white border border-[#DCE8F7] p-1 shadow-xs overflow-x-auto">
          {periods.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriod(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                selectedPeriod === p.id
                  ? 'bg-[#006BFF] text-white shadow-xs'
                  : 'text-slate-700 hover:text-[#006BFF] hover:bg-[#F3F8FF]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. FILTER BAR 2: SUBJECT TAGS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {subjects.map(sub => (
          <button
            key={sub.id}
            onClick={() => setSelectedSubject(sub.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap shadow-2xs border ${
              selectedSubject === sub.id
                ? 'bg-[#006BFF] text-white border-[#006BFF] shadow-xs'
                : 'bg-white text-[#12345B] border-[#DCE8F7] hover:bg-[#EBF3FF] hover:border-[#006BFF]/30'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* 5. INTERACTIVE COLUMNS (Ẩn các thẻ Giáo viên & Quản trị đối với vai trò Học sinh) */}
      <div className={`grid gap-6 ${
        currentRole === 'student'
          ? 'grid-cols-1 max-w-3xl mx-auto'
          : currentRole === 'teacher'
          ? 'grid-cols-1 md:grid-cols-2'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>

        {/* COLUMN 1: HỌC SINH (Luôn hiển thị) */}
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow">
          <div
            onClick={() => setCurrentView('student_practice')}
            className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-pointer group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#006BFF] text-white flex items-center justify-center shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-[#082B52] group-hover:text-[#006BFF] transition-colors">
                HỌC SINH
              </h3>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#006BFF] group-hover:translate-x-1 transition-transform" />
          </div>

          <div className="space-y-3">
            {/* Item 1 */}
            <div
              onClick={() => setCurrentView('student_practice')}
              className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-[#006BFF] rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                    Luyện theo bài, chương
                  </h4>
                  <p className="text-xs text-slate-500">Chọn nội dung • Số câu • Mức độ</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
            </div>

            {/* Item 2 */}
            <div
              onClick={() => setCurrentView('student_assignments')}
              className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                    Kiểm tra & bài được giao
                  </h4>
                  <p className="text-xs text-slate-500">Hẹn giờ • Tự lưu • Chấm điểm</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
            </div>

            {/* Item 3 */}
            <div
              onClick={() => setCurrentView('student_wrong_book')}
              className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-red-50 text-red-500 rounded-xl">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                    Sổ câu sai & ôn tập
                  </h4>
                  <p className="text-xs text-slate-500">Luyện lại • Gợi ý nội dung cần ôn</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
            </div>

            {/* Item 4 */}
            <div
              onClick={() => setCurrentView('student_results')}
              className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                    Kết quả & học liệu
                  </h4>
                  <p className="text-xs text-slate-500">Lịch sử làm bài • Tiến bộ • Tài liệu</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
            </div>
          </div>
        </div>

        {/* COLUMN 2: GIÁO VIÊN - Ẩn đối với vai trò Học sinh */}
        {currentRole !== 'student' && (
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div
              onClick={() => setCurrentView('teacher_question_bank')}
              className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#006BFF] text-white flex items-center justify-center shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#082B52] group-hover:text-[#006BFF] transition-colors">
                  GIÁO VIÊN
                </h3>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#006BFF] group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="space-y-3">
              {/* Item 1 */}
              <div
                onClick={() => setCurrentView('teacher_question_bank')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Ngân hàng câu hỏi
                    </h4>
                    <p className="text-xs text-slate-500">Soạn online • Nhập Excel / Word</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 2 */}
              <div
                onClick={() => setCurrentView('teacher_create_exam')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-50 text-[#006BFF] rounded-xl">
                    <FileEdit className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Tạo đề & giao bài
                    </h4>
                    <p className="text-xs text-slate-500">Theo ma trận • Trộn đề • Giao theo lớp</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 3 */}
              <div
                onClick={() => setCurrentView('teacher_matrix')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Xuất hồ sơ kiểm tra
                    </h4>
                    <p className="text-xs text-slate-500">Ma trận • Đặc tả • Đề • Đáp án • Hướng dẫn chấm</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 4 */}
              <div
                onClick={() => setCurrentView('teacher_grading')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Chấm bài & báo cáo
                    </h4>
                    <p className="text-xs text-slate-500">Bảng điểm • Câu sai nhiều • Xuất Excel</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 5 */}
              <div
                onClick={() => setCurrentView('teacher_gemini')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Trợ lý Gemini theo môn
                    </h4>
                    <p className="text-xs text-slate-500">Sao chép yêu cầu • Mở trợ lý</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>
            </div>
          </div>
        )}

        {/* COLUMN 3: QUẢN TRỊ - Ẩn đối với vai trò Học sinh và Giáo viên */}
        {(currentRole === 'admin' || currentRole === 'reviewer') && (
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4 hover:shadow-md transition-shadow">
            <div
              onClick={() => setCurrentView('admin_accounts')}
              className="flex items-center justify-between pb-3 border-b border-slate-100 cursor-pointer group"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#082B52] text-white flex items-center justify-center shadow-xs">
                  <Settings className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#082B52] group-hover:text-[#006BFF] transition-colors">
                  QUẢN TRỊ
                </h3>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#006BFF] group-hover:translate-x-1 transition-transform" />
            </div>

            <div className="space-y-3">
              {/* Item 1 */}
              <div
                onClick={() => setCurrentView('admin_accounts')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-blue-50 text-[#006BFF] rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Tài khoản & phân quyền
                    </h4>
                    <p className="text-xs text-slate-500">Học sinh • Giáo viên • Người duyệt</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 2 */}
              <div
                onClick={() => setCurrentView('admin_curriculum')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Chương trình học
                    </h4>
                    <p className="text-xs text-slate-500">Khối • Môn • Bộ sách • Yêu cầu cần đạt</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 3 */}
              <div
                onClick={() => setCurrentView('admin_approval')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Kiểm duyệt ngân hàng
                    </h4>
                    <p className="text-xs text-slate-500">Nháp • Chờ duyệt • Được duyệt</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>

              {/* Item 4 */}
              <div
                onClick={() => setCurrentView('admin_settings')}
                className="p-3 rounded-xl border border-[#DCE8F7] hover:border-[#006BFF] hover:bg-[#F3F8FF] transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#082B52] group-hover:text-[#006BFF]">
                      Mẫu biểu & hệ thống
                    </h4>
                    <p className="text-xs text-slate-500">Mẫu xuất • Link Gemini • Nhật ký • Sao lưu</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#006BFF]" />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 6. BOTTOM ROW: TIẾN BỘ HỌC TẬP & QUY TRÌNH TẠO ĐỀ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* LEFT BOTTOM CARD: TIẾN BỘ HỌC TẬP (Mở rộng toàn màn hình cho Học sinh) */}
        <div className={`${currentRole === 'student' ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-[#006BFF]" />
              <h3 className="text-lg font-bold text-[#082B52]">Tiến bộ học tập</h3>
            </div>

            {/* Subject Selector Dropdown */}
            <select
              value={chartSubject}
              onChange={(e) => setChartSubject(e.target.value as SubjectId)}
              aria-label="Chọn môn học để xem tiến bộ"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#DCE8F7] bg-[#F3F8FF] text-[#12345B] focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
            >
              <option value="math">Toán</option>
              <option value="informatics">Tin học</option>
              <option value="science">Khoa học tự nhiên</option>
              <option value="literature">Ngữ văn</option>
              <option value="english">Tiếng Anh</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-end justify-between gap-4 pt-2">
            {/* SVG Interactive Line Chart matching reference image */}
            <div className="w-full sm:w-3/4 h-48 relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
                {/* Horizontal reference grid lines */}
                {[0, 20, 40, 60, 80, 100].map((val) => {
                  const y = 140 - (val / 100) * 120;
                  return (
                    <g key={val}>
                      <line x1="30" y1={y} x2="480" y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
                      <text x="10" y={y + 4} fontSize="9" fill="#94A3B8" fontFamily="Times New Roman, serif">
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Vertical bars behind dots */}
                {activeChart.scores.map((score, i) => {
                  if (i >= 8) return null; // Month 5 not yet reached
                  const x = 55 + i * 50;
                  const y = 140 - (score / 100) * 120;
                  const height = 140 - y;
                  return (
                    <rect
                      key={i}
                      x={x - 10}
                      y={y}
                      width="20"
                      height={height}
                      fill="#E0EEFF"
                      rx="3"
                    />
                  );
                })}

                {/* Polyline connect dots */}
                {(() => {
                  const points = activeChart.scores
                    .slice(0, 8)
                    .map((s, i) => `${55 + i * 50},${140 - (s / 100) * 120}`)
                    .join(' ');
                  return (
                    <polyline
                      fill="none"
                      stroke="#006BFF"
                      strokeWidth="2.5"
                      points={points}
                    />
                  );
                })()}

                {/* Circle dots */}
                {activeChart.scores.slice(0, 8).map((score, i) => {
                  const x = 55 + i * 50;
                  const y = 140 - (score / 100) * 120;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#006BFF"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Month labels at bottom */}
                {activeChart.months.map((m, i) => {
                  const x = 55 + i * 50;
                  return (
                    <text
                      key={i}
                      x={x}
                      y="155"
                      fontSize="9"
                      fill="#64748B"
                      textAnchor="middle"
                      fontFamily="Times New Roman, serif"
                    >
                      {m}
                    </text>
                  );
                })}
              </svg>
            </div>

            {/* Growth badge box matching "+32% Tiến bộ so với đầu kỳ" */}
            <div className="shrink-0 bg-[#E8F8F0] border border-[#BDEBD4] rounded-2xl p-4 text-center sm:w-40">
              <div className="flex items-center justify-center space-x-1 text-[#059669]">
                <TrendingUp className="w-5 h-5" />
                <span className="text-2xl font-bold tracking-tight">{activeChart.progress}</span>
              </div>
              <p className="text-xs text-[#065F46] font-medium mt-1">
                Tiến bộ so với đầu kỳ
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT BOTTOM CARD: QUY TRÌNH TẠO ĐỀ (Ẩn đối với vai trò Học sinh) */}
        {currentRole !== 'student' && (
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-[#006BFF]" />
              <h3 className="text-lg font-bold text-[#082B52]">Quy trình tạo đề</h3>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between gap-1 overflow-x-auto pb-2">
                {/* Step 1: Ngân hàng */}
                <div
                  onClick={() => setCurrentView('teacher_question_bank')}
                  className="flex flex-col items-center text-center cursor-pointer group min-w-[70px]"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Database className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-[#082B52] mt-2 group-hover:text-[#006BFF]">
                    Ngân hàng
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Chọn câu hỏi theo nội dung
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mb-6" />

                {/* Step 2: Ma trận */}
                <div
                  onClick={() => setCurrentView('teacher_matrix')}
                  className="flex flex-col items-center text-center cursor-pointer group min-w-[70px]"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-[#006BFF] flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-[#082B52] mt-2 group-hover:text-[#006BFF]">
                    Ma trận
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Thiết lập ma trận theo cấu trúc đề
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mb-6" />

                {/* Step 3: Tạo đề */}
                <div
                  onClick={() => setCurrentView('teacher_create_exam')}
                  className="flex flex-col items-center text-center cursor-pointer group min-w-[70px]"
                >
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-[#082B52] mt-2 group-hover:text-[#006BFF]">
                    Tạo đề
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Trộn đề và tạo mã đề
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mb-6" />

                {/* Step 4: Giao bài */}
                <div
                  onClick={() => setCurrentView('teacher_create_exam')}
                  className="flex flex-col items-center text-center cursor-pointer group min-w-[70px]"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Send className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-[#082B52] mt-2 group-hover:text-[#006BFF]">
                    Giao bài
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Giao theo lớp hoặc cá nhân
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-300 shrink-0 mb-6" />

                {/* Step 5: Thống kê */}
                <div
                  onClick={() => setCurrentView('teacher_grading')}
                  className="flex flex-col items-center text-center cursor-pointer group min-w-[70px]"
                >
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h5 className="text-xs font-bold text-[#082B52] mt-2 group-hover:text-[#006BFF]">
                    Thống kê
                  </h5>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    Chấm điểm và báo cáo
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Watermark in bottom right matching reference image */}
      <div className="flex justify-end pt-2">
        <span className="text-xs text-slate-400 italic">Giao diện minh họa</span>
      </div>
    </div>
  );
};
