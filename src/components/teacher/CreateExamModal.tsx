import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExamPeriod } from '../../types';
import { generateRequestUuid, isValidUuid } from '../../utils/supabaseAssignmentSync';
import { formatAssignmentDeadline } from '../../utils/studentAssignments';
import {
  FileEdit,
  Send,
  Check,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  Cloud,
  MonitorSmartphone,
  Info,
  CalendarClock,
  Users
} from 'lucide-react';

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function advanceRoundLabel(label: string): string {
  const match = label.trim().match(/^(.*?)(\d+)$/);
  if (match) {
    return `${match[1]}${Number(match[2]) + 1}`;
  }
  return `${label.trim()} (Đợt mới)`;
}

export const CreateExamModal: React.FC = () => {
  const {
    questions,
    exams,
    classes,
    assignments,
    selectedGrade,
    selectedSubject,
    user,
    currentRole,
    setCurrentView,
    isUsingDemoAssignmentsData,
    publishExamAssignmentAsync,
    openAuthModal
  } = useApp();

  const [examSourceMode, setExamSourceMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingExamId, setSelectedExistingExamId] = useState<string>('');

  const [examTitle, setExamTitle] = useState('Kiểm tra Giữa kỳ I - Đề số 2');
  const [examCode, setExamCode] = useState('ĐỀ 102 - TOÁN 8 GK1');
  const [examPeriod, setExamPeriod] = useState<ExamPeriod>('mid1');
  const [duration, setDuration] = useState<number>(45);
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
  const [roundLabel, setRoundLabel] = useState<string>('Đợt 1');
  const [openTimeLocal, setOpenTimeLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [closeTimeLocal, setCloseTimeLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date(Date.now() + 14 * 24 * 3600 * 1000))
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState<number>(1);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [showSolutionAfterSubmit, setShowSolutionAfterSubmit] = useState<boolean>(true);
  const [isComputerLabMode, setIsComputerLabMode] = useState<boolean>(false);

  // Idempotency keys preserved across retries on error, rotated only after confirmed success
  const [publishRequestId, setPublishRequestId] = useState<string>(() => generateRequestUuid());
  const [examRequestId, setExamRequestId] = useState<string>(() => generateRequestUuid());

  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishSuccessMsg, setPublishSuccessMsg] = useState<string | null>(null);

  // Sync targetClassId when classes list changes (e.g. loaded from Supabase)
  useEffect(() => {
    if (classes.length === 0) {
      setTargetClassId('');
      return;
    }
    if (!classes.some(c => c.id === targetClassId)) {
      setTargetClassId(classes[0].id);
    }
  }, [classes, targetClassId]);

  // Filter reusable exams teacher is allowed to assign
  const assignableExams = useMemo(() => {
    if (isUsingDemoAssignmentsData) return exams;
    return exams.filter(ex => {
      if (!isValidUuid(ex.id)) return false;
      if (currentRole === 'admin') return true;
      return !ex.authorId || ex.authorId === user?.id;
    });
  }, [exams, isUsingDemoAssignmentsData, currentRole, user?.id]);

  useEffect(() => {
    if (assignableExams.length === 0) {
      setSelectedExistingExamId('');
      return;
    }
    if (!assignableExams.some(e => e.id === selectedExistingExamId)) {
      setSelectedExistingExamId(assignableExams[0].id);
    }
  }, [assignableExams, selectedExistingExamId]);

  // Pick questions from the current grade & subject
  const availableQ = useMemo(
    () => questions.filter(q => q.grade === selectedGrade && q.subject === selectedSubject),
    [questions, selectedGrade, selectedSubject]
  );

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(() =>
    availableQ.slice(0, 5).map(q => q.id)
  );
  const [lockedIds, setLockedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const validIds = new Set(availableQ.map(q => q.id));
    setSelectedQuestionIds(prev => {
      const kept = prev.filter(id => validIds.has(id));
      return kept.length > 0 ? kept : availableQ.slice(0, 5).map(q => q.id);
    });
  }, [availableQ]);

  const toggleSelect = (id: string) => {
    setSelectedQuestionIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleLock = (id: string) => {
    setLockedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedClass = classes.find(c => c.id === targetClassId) || null;
  const selectedExistingExam =
    assignableExams.find(e => e.id === selectedExistingExamId) || null;

  const classAssignments = useMemo(() => {
    if (!targetClassId) return [];
    return assignments.filter(a => a.classId === targetClassId);
  }, [assignments, targetClassId]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishing) return;

    setPublishError(null);
    setPublishSuccessMsg(null);

    if (!selectedClass) {
      setPublishError('Vui lòng chọn hoặc tạo lớp học trước khi giao bài.');
      return;
    }

    const openDate = new Date(openTimeLocal);
    const closeDate = new Date(closeTimeLocal);
    if (Number.isNaN(openDate.getTime()) || Number.isNaN(closeDate.getTime())) {
      setPublishError('Thời gian mở đề hoặc hạn nộp không hợp lệ.');
      return;
    }
    if (closeDate.getTime() <= openDate.getTime()) {
      setPublishError('Hạn nộp bài phải sau thời gian mở đề.');
      return;
    }

    if (examSourceMode === 'new') {
      if (!examTitle.trim() || !examCode.trim()) {
        setPublishError('Vui lòng nhập đầy đủ tên bài kiểm tra và mã đề.');
        return;
      }
      if (selectedQuestionIds.length === 0) {
        setPublishError('Vui lòng chọn ít nhất 1 câu hỏi vào đề.');
        return;
      }
    } else if (!selectedExistingExam) {
      setPublishError('Vui lòng chọn một đề kiểm tra hợp lệ để giao lại.');
      return;
    }

    const chosenQuestions = questions.filter(q => selectedQuestionIds.includes(q.id));
    const totalPts = parseFloat(chosenQuestions.reduce((sum, q) => sum + q.points, 0).toFixed(2));

    setIsPublishing(true);
    try {
      const res = await publishExamAssignmentAsync({
        targetClass: selectedClass,
        existingExam: examSourceMode === 'existing' ? selectedExistingExam : null,
        newExamDraft:
          examSourceMode === 'new'
            ? {
                code: examCode.trim().toUpperCase(),
                title: examTitle.trim(),
                grade: selectedGrade,
                subject: selectedSubject,
                period: examPeriod,
                durationMinutes: duration,
                questions: chosenQuestions,
                totalPoints: totalPts
              }
            : undefined,
        assignmentSettings: {
          openTimeIso: openDate.toISOString(),
          closeTimeIso: closeDate.toISOString(),
          durationMinutes: duration,
          attemptsAllowed: Math.max(1, attemptsAllowed),
          allowReview: true,
          showSolutionAfterSubmit,
          shuffleQuestions,
          shuffleOptions,
          isComputerLabMode,
          roundLabel: roundLabel.trim() || 'Đợt 1'
        },
        publishRequestId,
        examRequestId
      });

      if (!res.success || !res.assignment) {
        // Keep form state & same idempotency keys so retry stays idempotent
        setPublishError(res.error || 'Không thể giao bài. Vui lòng thử lại.');
        return;
      }

      // Only show "Giao bài thành công" and rotate request IDs AFTER confirmed persistence
      setPublishSuccessMsg(
        res.isDemo
          ? `Giao bài thành công (Chế độ Demo cục bộ) cho ${res.assignment.className}!`
          : `Giao bài thành công! Đề "${res.assignment.examTitle}" đã đồng bộ lên Supabase cho lớp ${res.assignment.className}.`
      );
      setPublishRequestId(generateRequestUuid());
      setExamRequestId(generateRequestUuid());
      setRoundLabel(prev => advanceRoundLabel(prev));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 font-serif">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <FileEdit className="w-6 h-6 text-[#006BFF]" />
            <span>Tạo đề kiểm tra & Giao bài theo lớp</span>
          </h2>
          <p className="text-sm text-slate-500">
            Trộn đề tự động, phân mã đề (101, 102...), thiết lập hạn nộp và giao bài theo lớp học
          </p>
          <div className="mt-1">
            {isUsingDemoAssignmentsData ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                <MonitorSmartphone className="w-3.5 h-3.5" />
                <span>Chế độ Demo cục bộ (Chỉ lưu trên trình duyệt này)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                <Cloud className="w-3.5 h-3.5" />
                <span>Đồng bộ trực tiếp lên Supabase cho học sinh trong lớp</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {isUsingDemoAssignmentsData && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Đang ở chế độ Demo cục bộ</p>
              <p className="text-amber-800 mt-0.5">
                Bài giao ở chế độ này không gửi tới học sinh đăng nhập ở thiết bị khác. Hãy đăng nhập tài khoản Giáo viên Supabase để đồng bộ thật.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shrink-0"
          >
            Đăng nhập Supabase
          </button>
        </div>
      )}

      {publishError && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-start justify-between gap-3 text-sm"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Giao bài chưa thành công</p>
              <p className="text-xs text-red-800 mt-0.5">{publishError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPublishError(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      {publishSuccessMsg && (
        <div
          role="status"
          className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center justify-between gap-3 text-sm font-bold"
        >
          <div className="flex items-center space-x-3">
            <Check className="w-5 h-5 text-emerald-700 shrink-0" />
            <span>{publishSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setPublishSuccessMsg(null)}
            className="text-xs underline shrink-0"
          >
            Đóng
          </button>
        </div>
      )}

      <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-5">
          <h3 className="text-base font-bold text-[#082B52] border-b border-slate-100 pb-2">
            1. Thông số đề kiểm tra & Giao bài theo lớp
          </h3>

          {/* Source Mode Switch */}
          <div className="grid grid-cols-2 gap-2 bg-[#F3F8FF] p-1 rounded-xl border border-[#DCE8F7]">
            <button
              type="button"
              onClick={() => {
                setExamSourceMode('new');
                setPublishError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                examSourceMode === 'new'
                  ? 'bg-[#006BFF] text-white shadow-xs'
                  : 'text-[#082B52] hover:bg-white'
              }`}
            >
              Tạo đề mới từ ngân hàng câu hỏi
            </button>
            <button
              type="button"
              onClick={() => {
                setExamSourceMode('existing');
                setPublishError(null);
              }}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors ${
                examSourceMode === 'existing'
                  ? 'bg-[#006BFF] text-white shadow-xs'
                  : 'text-[#082B52] hover:bg-white'
              }`}
            >
              Giao lại đề đã có ({assignableExams.length})
            </button>
          </div>

          <div className="space-y-4">
            {examSourceMode === 'new' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tên bài kiểm tra:</label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Mã đề thi:</label>
                    <input
                      type="text"
                      value={examCode}
                      onChange={e => setExamCode(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-xs border rounded-xl font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Đợt / Loại đề:</label>
                    <select
                      value={examPeriod}
                      onChange={e => setExamPeriod(e.target.value as ExamPeriod)}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                    >
                      <option value="mid1">Giữa kỳ I</option>
                      <option value="final1">Cuối kỳ I</option>
                      <option value="mid2">Giữa kỳ II</option>
                      <option value="final2">Cuối kỳ II</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Thời lượng làm bài:</label>
                    <select
                      value={duration}
                      onChange={e => setDuration(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                    >
                      <option value={15}>15 phút (Thường xuyên)</option>
                      <option value={45}>45 phút (1 tiết)</option>
                      <option value={60}>60 phút (Giữa / Cuối kỳ)</option>
                      <option value={90}>90 phút (Khảo sát)</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chọn đề kiểm tra đã tạo:</label>
                  {assignableExams.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      Chưa có đề kiểm tra nào trên tài khoản hiện tại. Hãy chọn &quot;Tạo đề mới từ ngân hàng câu hỏi&quot;.
                    </div>
                  ) : (
                    <select
                      value={selectedExistingExamId}
                      onChange={e => setSelectedExistingExamId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-xl font-semibold text-[#082B52]"
                    >
                      {assignableExams.map(ex => (
                        <option key={ex.id} value={ex.id}>
                          [{ex.code}] {ex.title} — Khối {ex.grade} ({ex.questionCount ?? ex.questions.length} câu, {ex.durationMinutes} phút)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thời lượng áp dụng cho đợt này:</label>
                  <select
                    value={duration}
                    onChange={e => setDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border rounded-xl"
                  >
                    <option value={15}>15 phút</option>
                    <option value={45}>45 phút</option>
                    <option value={60}>60 phút</option>
                    <option value={90}>90 phút</option>
                  </select>
                </div>
              </div>
            )}

            {/* Target Class & Round */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Giao cho lớp học:</label>
                {classes.length === 0 ? (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2">
                    <span>Chưa có lớp nào.</span>
                    <button
                      type="button"
                      onClick={() => setCurrentView('teacher_classes')}
                      className="font-bold underline text-[#006BFF] shrink-0"
                    >
                      Tạo lớp ngay
                    </button>
                  </div>
                ) : (
                  <select
                    value={targetClassId}
                    onChange={e => setTargetClassId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-xl font-semibold text-[#082B52]"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.studentCount} HS) - Khối {c.grade}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nhãn đợt giao bài (cho phép giao nhiều đợt):</label>
                <input
                  type="text"
                  value={roundLabel}
                  onChange={e => setRoundLabel(e.target.value)}
                  placeholder="Ví dụ: Đợt 1, Đợt kiểm tra bù..."
                  className="w-full px-3 py-2 text-sm border rounded-xl"
                />
              </div>
            </div>

            {/* Open/Close Times & Attempts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian mở đề:</label>
                <input
                  type="datetime-local"
                  value={openTimeLocal}
                  onChange={e => setOpenTimeLocal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hạn nộp bài:</label>
                <input
                  type="datetime-local"
                  value={closeTimeLocal}
                  onChange={e => setCloseTimeLocal(e.target.value)}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số lần làm bài:</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={attemptsAllowed}
                  onChange={e => setAttemptsAllowed(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                />
              </div>
            </div>

            {/* Checkbox configs */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 block">Cấu hình chống gian lận & Trộn đề:</span>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleQuestions}
                  onChange={e => setShuffleQuestions(e.target.checked)}
                  className="w-4 h-4 text-[#006BFF] rounded-sm"
                />
                <span><b>Xáo trộn thứ tự câu hỏi</b> ngẫu nhiên theo từng học sinh</span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={shuffleOptions}
                  onChange={e => setShuffleOptions(e.target.checked)}
                  className="w-4 h-4 text-[#006BFF] rounded-sm"
                />
                <span><b>Xáo trộn thứ tự các phương án A, B, C, D</b></span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSolutionAfterSubmit}
                  onChange={e => setShowSolutionAfterSubmit(e.target.checked)}
                  className="w-4 h-4 text-[#006BFF] rounded-sm"
                />
                <span>Cho phép học sinh <b>xem lời giải chi tiết ngay sau khi nộp</b></span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isComputerLabMode}
                  onChange={e => setIsComputerLabMode(e.target.checked)}
                  className="w-4 h-4 text-[#006BFF] rounded-sm"
                />
                <span><b>Chế độ phòng máy:</b> Tự động đăng xuất tài khoản sau khi nộp bài</span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Pick questions or review selected exam (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            {examSourceMode === 'new' ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
                  <h3 className="text-base font-bold text-[#082B52]">
                    2. Chọn câu hỏi vào đề ({selectedQuestionIds.length} câu)
                  </h3>
                  <span className="text-xs text-emerald-700 font-bold">
                    Tổng: {questions.filter(q => selectedQuestionIds.includes(q.id)).reduce((s, q) => s + q.points, 0).toFixed(2)}đ
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {availableQ.map(q => {
                    const isSelected = selectedQuestionIds.includes(q.id);
                    const isLocked = lockedIds[q.id];

                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-xl border transition-all text-xs flex items-start justify-between gap-2 ${
                          isSelected ? 'border-[#006BFF] bg-blue-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start space-x-2 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(q.id)}
                            className="w-4 h-4 text-[#006BFF] rounded-sm mt-0.5"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5 font-bold text-[#082B52]">
                              <span>[{q.code}]</span>
                              <span className="text-slate-500 font-normal">({q.points}đ)</span>
                            </div>
                            <p className="text-slate-600 line-clamp-2 mt-0.5">{q.stem}</p>
                          </div>
                        </div>

                        {isSelected && (
                          <button
                            type="button"
                            onClick={() => toggleLock(q.id)}
                            className={`p-1 rounded-md text-[10px] font-bold shrink-0 ${
                              isLocked ? 'text-amber-800 bg-amber-100' : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title={isLocked ? 'Đã khóa vị trí câu không bị xáo trộn' : 'Khóa cố định vị trí câu'}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {availableQ.length === 0 && (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                      Chưa có câu hỏi cho khối/môn đang chọn ở thanh trên. Hãy đổi Khối/Môn hoặc thêm câu hỏi mới.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h3 className="text-base font-bold text-[#082B52] border-b border-slate-100 pb-2">
                  2. Tóm tắt đề thi được chọn
                </h3>
                {selectedExistingExam ? (
                  <div className="p-4 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7] space-y-2 text-xs text-[#082B52]">
                    <p className="font-bold text-sm">{selectedExistingExam.title}</p>
                    <p>Mã đề: <b className="font-mono">{selectedExistingExam.code}</b></p>
                    <p>Số câu hỏi: <b>{selectedExistingExam.questionCount ?? selectedExistingExam.questions.length} câu</b></p>
                    <p>Tổng điểm: <b>{selectedExistingExam.totalPoints} điểm</b></p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Chưa chọn đề thi.</p>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={
              isPublishing ||
              !selectedClass ||
              (examSourceMode === 'new' ? selectedQuestionIds.length === 0 : !selectedExistingExam)
            }
            className="w-full py-3 bg-[#006BFF] text-white font-bold rounded-xl shadow-xs hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            {isPublishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang phát hành & đồng bộ...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Phát hành & Giao bài cho lớp</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Assigned rounds for the currently selected class */}
      {selectedClass && (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#082B52] flex items-center gap-2">
              <Users className="w-4 h-4 text-[#006BFF]" />
              <span>Các lượt bài đã giao cho {selectedClass.name} ({classAssignments.length})</span>
            </h3>
          </div>
          {classAssignments.length === 0 ? (
            <p className="text-xs text-slate-500">Lớp này chưa có bài được giao nào.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classAssignments.map(asg => (
                <div
                  key={asg.id}
                  className="p-3.5 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#082B52] truncate">{asg.examTitle}</span>
                    {asg.roundLabel && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#006BFF] font-bold shrink-0">
                        {asg.roundLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <CalendarClock className="w-3.5 h-3.5 text-[#006BFF]" />
                    <span>Hạn nộp: {formatAssignmentDeadline(asg.closeTime) || asg.closeTime}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

