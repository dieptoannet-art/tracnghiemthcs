import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cloud,
  FileText,
  Info,
  Key,
  Layers,
  MonitorSmartphone,
  RefreshCw,
  RotateCcw,
  Users
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { subjectKeyToDisplayName } from '../../utils/yccdCsvParser';
import {
  AssignmentBucket,
  MISSING_OR_INVALID_EXAM_MESSAGE,
  StudentAssignmentItem,
  classifyStudentAssignments,
  validateAssignmentExamLink
} from '../../utils/studentAssignments';

interface StudentAssignmentsViewProps {
  onOpenAssignment: (assignmentId: string) => void;
  onViewResults: () => void;
  onOpenSupabaseConfig?: () => void;
}

export const StudentAssignmentsView: React.FC<StudentAssignmentsViewProps> = ({
  onOpenAssignment,
  onViewResults,
  onOpenSupabaseConfig
}) => {
  const {
    assignments,
    classes,
    enrolledClassIds,
    exams,
    submissions,
    studentUser,
    userProfile,
    currentRole,
    isUsingDemoAssignmentsData,
    assignmentDataLoading,
    assignmentDataError,
    retryLoadAssignmentData,
    joinClassByInviteCodeAsync,
    openAuthModal
  } = useApp();

  const [activeTab, setActiveTab] = useState<AssignmentBucket>('todo');
  const [openError, setOpenError] = useState<string | null>(null);

  // Join-by-invite-code form when student account is not yet enrolled in any class
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [isJoiningClass, setIsJoiningClass] = useState(false);
  const [joinClassMsg, setJoinClassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const studentIdentity = useMemo(
    () => ({
      id: userProfile?.id || studentUser.id,
      email: userProfile?.email || null,
      code: userProfile ? (userProfile.studentCode || null) : (currentRole === 'student' ? studentUser.code : null),
      role: currentRole
    }),
    [userProfile, studentUser.id, studentUser.code, currentRole]
  );

  const classified = useMemo(() => {
    return classifyStudentAssignments({
      assignments,
      classes,
      exams,
      submissions,
      identity: studentIdentity,
      enrolledClassIds: enrolledClassIds ?? undefined
    });
  }, [assignments, classes, enrolledClassIds, exams, submissions, studentIdentity]);

  const activeItems: StudentAssignmentItem[] = useMemo(() => {
    if (activeTab === 'todo') return classified.todo;
    if (activeTab === 'submitted') return classified.submitted;
    return classified.overdue;
  }, [activeTab, classified]);

  const handleOpenTask = (item: StudentAssignmentItem) => {
    setOpenError(null);
    if (item.isNotYetOpen) return;

    const validation = validateAssignmentExamLink(item.assignment, exams, {
      requireLoadedQuestions: false
    });
    if (!validation.valid || !validation.exam) {
      setOpenError(validation.error || MISSING_OR_INVALID_EXAM_MESSAGE);
      return;
    }

    onOpenAssignment(item.assignment.id);
  };

  const handleJoinClassByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isJoiningClass || !inviteCodeInput.trim()) return;

    setJoinClassMsg(null);
    setIsJoiningClass(true);
    try {
      const res = await joinClassByInviteCodeAsync(inviteCodeInput.trim());
      if (!res.success) {
        setJoinClassMsg({
          type: 'error',
          text: res.error || 'Không tìm thấy lớp với mã mời này.'
        });
        return;
      }
      setInviteCodeInput('');
      setJoinClassMsg({
        type: 'success',
        text: `Đã tham gia lớp ${res.className || ''} thành công! Danh sách bài giao đã được cập nhật.`
      });
    } finally {
      setIsJoiningClass(false);
    }
  };

  const tabDefinitions: { id: AssignmentBucket; label: string; count: number }[] = [
    { id: 'todo', label: 'Cần làm', count: classified.todo.length },
    { id: 'submitted', label: 'Đã nộp', count: classified.submitted.length },
    { id: 'overdue', label: 'Quá hạn', count: classified.overdue.length }
  ];

  const getEmptyMessage = () => {
    if (!classified.hasEnrolledClasses) {
      return currentRole !== 'student'
        ? 'Bạn đang xem ở vai trò Giáo viên / Quản trị viên'
        : 'Tài khoản chưa vào lớp';
    }
    if (classified.totalVisible === 0 || activeTab === 'todo') {
      return 'Chưa có bài được giao';
    }
    if (activeTab === 'submitted') {
      return 'Chưa có bài đã nộp';
    }
    return 'Không có bài quá hạn';
  };

  const getEmptyDescription = () => {
    if (!classified.hasEnrolledClasses) {
      return currentRole !== 'student'
        ? 'Tài khoản hiện tại không nằm trong danh sách lớp học sinh. Hãy đăng nhập bằng tài khoản học sinh để xem các bài giáo viên đã giao cho lớp.'
        : 'Tài khoản của bạn hiện chưa được thêm vào lớp học nào. Hãy cung cấp email hoặc mã học sinh cho giáo viên, hoặc nhập mã mời lớp học bên dưới.';
    }
    if (classified.totalVisible === 0) {
      return 'Lớp của bạn hiện chưa có nhiệm vụ hay đề kiểm tra nào được giáo viên phát hành.';
    }
    if (activeTab === 'todo') {
      return 'Hiện không còn nhiệm vụ nào cần hoàn thành trong lớp của bạn.';
    }
    if (activeTab === 'submitted') {
      return 'Các bài tập hoặc bài kiểm tra sau khi nộp sẽ hiển thị tại thẻ này.';
    }
    return 'Bạn chưa có nhiệm vụ nào bị quá hạn nộp.';
  };

  return (
    <div className="space-y-6 font-serif">
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#EAF5FF] text-[#1769C2] rounded-xl border border-[#CBE2FB]">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-[#082B52]">Bài được giao</h1>
          </div>
          <p className="text-sm text-slate-600">
            {currentRole === 'student' ? (
              <>
                Học sinh: <strong className="text-[#082B52]">{studentUser.fullName}</strong>
                {userProfile?.studentCode
                  ? ` • Mã HS: ${userProfile.studentCode}`
                  : isUsingDemoAssignmentsData && studentUser.code
                  ? ` • Mã HS: ${studentUser.code}`
                  : ''}
              </>
            ) : (
              <>
                Đang xem ở chế độ{' '}
                <strong className="text-[#082B52]">
                  {currentRole === 'teacher' ? 'Giáo viên' : currentRole === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt'}
                </strong>
                {' '}— chỉ hiển thị nhiệm vụ mà tài khoản học sinh hiện tại được phép xem.
              </>
            )}
          </p>
          <div>
            {isUsingDemoAssignmentsData ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <MonitorSmartphone className="w-3.5 h-3.5" />
                <span>Chế độ dữ liệu mẫu (Demo cục bộ)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                <Cloud className="w-3.5 h-3.5" />
                <span>Đã đồng bộ trực tiếp từ Supabase</span>
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setOpenError(null);
            retryLoadAssignmentData();
          }}
          disabled={assignmentDataLoading}
          className="inline-flex items-center justify-center space-x-2 px-4 min-h-[44px] rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] text-[#082B52] hover:bg-[#E4F0FF] text-sm font-bold transition-colors disabled:opacity-60 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 text-[#006BFF] ${assignmentDataLoading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Explicit Demo Banner when unauthenticated */}
      {isUsingDemoAssignmentsData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Đang xem dữ liệu mẫu (Demo cục bộ)</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Dữ liệu hiển thị dưới đây chỉ lưu trên trình duyệt này. Để nhận bài giáo viên giao từ thiết bị khác, hãy đăng nhập tài khoản học sinh Supabase.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-4 min-h-[40px] bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shrink-0"
          >
            Đăng nhập Supabase
          </button>
        </div>
      )}

      {/* Join class feedback */}
      {joinClassMsg && (
        <div
          role={joinClassMsg.type === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold ${
            joinClassMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          <span>{joinClassMsg.text}</span>
          <button
            type="button"
            onClick={() => setJoinClassMsg(null)}
            className="underline shrink-0 text-xs"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Invalid / missing exam link alert */}
      {openError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-red-900 shadow-xs"
        >
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm sm:text-base">{openError}</p>
              <p className="text-xs text-red-700 mt-0.5">
                Hệ thống không thể đối chiếu đề kiểm tra hợp lệ cho nhiệm vụ này.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenError(null)}
            className="px-4 min-h-[40px] rounded-xl border border-red-300 bg-white text-red-800 text-xs font-bold hover:bg-red-100 transition-colors self-end sm:self-center"
          >
            Đóng thông báo
          </button>
        </div>
      )}

      {/* Three Tabs: Cần làm, Đã nộp, Quá hạn */}
      <div
        role="tablist"
        aria-label="Phân loại bài được giao"
        className="grid grid-cols-3 gap-2 bg-white p-1.5 rounded-2xl border border-[#DCE8F7] shadow-xs"
      >
        {tabDefinitions.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                setOpenError(null);
              }}
              className={`min-h-[44px] px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                isActive
                  ? 'bg-[#006BFF] text-white shadow-xs'
                  : 'text-[#082B52] hover:bg-[#F3F8FF]'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#EAF3FF] text-[#1769C2]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Data Loading State */}
      {assignmentDataLoading ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-10 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-7 h-7 text-[#006BFF] animate-spin mx-auto" />
          <p className="text-base font-bold text-[#082B52]">Đang tải danh sách bài được giao...</p>
          <p className="text-sm text-slate-500">Vui lòng đợi trong giây lát.</p>
        </div>
      ) : assignmentDataError ? (
        /* Data Load Error State */
        <div
          role="alert"
          className="bg-white rounded-2xl border border-red-200 p-6 sm:p-8 text-center space-y-4 shadow-xs"
        >
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[#082B52]">Không thể tải dữ liệu bài được giao</h2>
            <p className="text-sm text-red-700 max-w-xl mx-auto leading-relaxed">{assignmentDataError}</p>
          </div>

          {assignmentDataError.includes('migration') && (
            <div className="max-w-xl mx-auto text-left bg-[#F8FBFF] border border-[#DCE8F7] rounded-xl p-4 space-y-2 text-xs text-slate-700">
              <p className="font-bold text-[#082B52]">Cách khắc phục cho Quản trị viên / Giáo viên trên Supabase SQL Editor:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  Chạy file Bước 1: <code className="font-mono font-bold text-[#082B52]">src/data/01_bootstrap_assignment_tables.sql</code> (tạo các bảng <code className="font-mono">classes, class_members, exams, assignments, submissions</code>).
                </li>
                <li>
                  Chạy tiếp file Bước 2: <code className="font-mono font-bold text-[#082B52]">src/data/02_sync_classes_exams_assignments.sql</code> (bổ sung <code className="font-mono">exam_protected_keys</code>, RLS và hàm <code className="font-mono">get_student_assigned_summaries</code>).
                </li>
                <li>Sau khi hoàn tất cả 2 bước trên Supabase, bấm nút <strong>Thử lại</strong> bên dưới.</li>
              </ol>
              {currentRole !== 'student' && (
                <p className="text-[11px] text-slate-600 pt-1 border-t border-[#DCE8F7]">
                  Lưu ý: Bạn đang đăng nhập ở vai trò <strong>{currentRole === 'teacher' ? 'Giáo viên' : currentRole === 'admin' ? 'Quản trị viên' : 'Kiểm duyệt'}</strong>. Sau khi đồng bộ CSDL xong, để kiểm tra góc nhìn học sinh nhận bài, hãy đăng nhập bằng tài khoản Học sinh thuộc lớp.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => retryLoadAssignmentData()}
              className="inline-flex items-center justify-center space-x-2 px-5 min-h-[44px] bg-[#006BFF] hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Thử lại</span>
            </button>
            {currentRole !== 'student' && onOpenSupabaseConfig && (
              <button
                type="button"
                onClick={onOpenSupabaseConfig}
                className="inline-flex items-center justify-center space-x-2 px-4 min-h-[44px] border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] text-[#082B52] text-sm font-bold rounded-xl transition-colors"
              >
                <Cloud className="w-4 h-4 text-[#006BFF]" />
                <span>Cấu hình &amp; SQL Supabase</span>
              </button>
            )}
          </div>
        </div>
      ) : activeItems.length === 0 ? (
        /* Unenrolled vs Empty List State */
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 sm:p-10 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-[#F3F8FF] border border-[#DCE8F7] text-[#1769C2] flex items-center justify-center mx-auto">
            {!classified.hasEnrolledClasses ? (
              <Users className="w-6 h-6" />
            ) : (
              <FileText className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[#082B52]">{getEmptyMessage()}</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              {getEmptyDescription()}
            </p>
          </div>

          {!classified.hasEnrolledClasses &&
            currentRole === 'student' &&
            !isUsingDemoAssignmentsData && (
              <form
                onSubmit={handleJoinClassByCode}
                className="max-w-sm mx-auto pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="relative flex-1">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={inviteCodeInput}
                    onChange={e => setInviteCodeInput(e.target.value)}
                    placeholder="Nhập mã mời lớp (VD: TAYDO-8A2-...)"
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs sm:text-sm border border-[#DCE8F7] rounded-xl font-mono uppercase focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isJoiningClass || !inviteCodeInput.trim()}
                  className="min-h-[44px] px-4 py-2 bg-[#006BFF] hover:bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-xl disabled:opacity-50 shrink-0"
                >
                  {isJoiningClass ? 'Đang tham gia...' : 'Tham gia lớp'}
                </button>
              </form>
            )}
        </div>
      ) : (
        /* Task Cards List (Mobile-friendly single card per assignment) */
        <div className="grid grid-cols-1 gap-4">
          {activeItems.map(item => {
            const { assignment, exam, taskTypeLabel, deadlineLabel, hasInProgressDraft, submission } = item;
            const subjectLabel = subjectKeyToDisplayName(assignment.subject);
            const title = assignment.examTitle || exam?.title || 'Nhiệm vụ học tập';

            return (
              <article
                key={assignment.id}
                className="bg-white rounded-2xl border border-[#DCE8F7] hover:border-[#99C2FF] p-4 sm:p-5 shadow-xs transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2.5 flex-1 min-w-0">
                  {/* Title */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-[#082B52] leading-snug">
                      {title}
                    </h2>
                    {assignment.roundLabel && (
                      <span className="text-xs font-bold text-[#1769C2] bg-[#EAF3FF] border border-[#CBE2FB] px-2 py-0.5 rounded-md">
                        {assignment.roundLabel}
                      </span>
                    )}
                    {item.bucket === 'todo' && hasInProgressDraft && (
                      <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        Đang làm dở
                      </span>
                    )}
                    {item.bucket === 'submitted' && submission && (
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{submission.status === 'graded' ? 'Đã chấm điểm' : 'Đã nộp (Chờ chấm tự luận)'}</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata line: Môn, Loại nhiệm vụ, Hạn nộp, Lớp & Thời lượng */}
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1.5 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#006BFF] shrink-0" />
                      <dt className="text-slate-500 shrink-0">Môn:</dt>
                      <dd className="font-bold text-[#082B52] truncate">{subjectLabel}</dd>
                    </div>

                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#1769C2] shrink-0" />
                      <dt className="text-slate-500 shrink-0">Loại:</dt>
                      <dd className="font-semibold text-[#082B52] truncate">{taskTypeLabel}</dd>
                    </div>

                    {deadlineLabel && (
                      <div className="flex items-center gap-2">
                        <CalendarClock
                          className={`w-4 h-4 shrink-0 ${
                            item.bucket === 'overdue' ? 'text-red-600' : 'text-[#006BFF]'
                          }`}
                        />
                        <dt className="text-slate-500 shrink-0">Hạn nộp:</dt>
                        <dd
                          className={`font-semibold tabular-nums truncate ${
                            item.bucket === 'overdue' ? 'text-red-700' : 'text-[#082B52]'
                          }`}
                        >
                          {deadlineLabel}
                        </dd>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                      <dt className="text-slate-500 shrink-0">Thời lượng:</dt>
                      <dd className="font-semibold tabular-nums text-slate-700">
                        {assignment.durationMinutes} phút
                      </dd>
                    </div>
                  </dl>

                  {/* Extra line for class & submission score */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                    {assignment.className && (
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>{assignment.className}</span>
                      </span>
                    )}
                    {item.bucket === 'submitted' && submission && (
                      <span className="tabular-nums font-bold text-[#006BFF]">
                        Điểm: {submission.score.toFixed(2)} / {submission.maxScore}
                        {submission.submittedAt ? ` • Nộp lúc: ${submission.submittedAt}` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right / Bottom Action Area */}
                <div className="flex items-center justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  {item.bucket === 'todo' && (
                    <button
                      type="button"
                      disabled={item.isNotYetOpen}
                      onClick={() => handleOpenTask(item)}
                      className={`w-full md:w-auto min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-xs ${
                        item.isNotYetOpen
                          ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                          : hasInProgressDraft
                          ? 'bg-amber-600 hover:bg-amber-700 text-white'
                          : 'bg-[#006BFF] hover:bg-blue-600 text-white'
                      }`}
                    >
                      <span>{item.actionLabel}</span>
                      {!item.isNotYetOpen && <ArrowRight className="w-4 h-4" />}
                    </button>
                  )}

                  {item.bucket === 'submitted' && (
                    <button
                      type="button"
                      onClick={onViewResults}
                      className="w-full md:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-[#E4F0FF] text-[#082B52] text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <span>Xem kết quả</span>
                      <ArrowRight className="w-4 h-4 text-[#006BFF]" />
                    </button>
                  )}

                  {item.bucket === 'overdue' && (
                    <span className="w-full md:w-auto min-h-[44px] px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-bold inline-flex items-center justify-center">
                      Đã quá hạn nộp
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
