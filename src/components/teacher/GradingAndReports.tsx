import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { Submission } from '../../types';
import { exportGradeSheetToExcel } from '../../utils/exportExcel';
import { isValidUuid, syncGradeSubmissionViaRpc } from '../../utils/supabaseAssignmentSync';
import { getSubjectDisplayName, resolveCanonicalSubject } from '../../utils/subjectCatalog';
import { MathView } from '../MathView';
import {
  BarChart3,
  Download,
  AlertTriangle,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Eye,
  Check,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

export const GradingAndReports: React.FC = () => {
  const {
    submissions,
    classes,
    assignments,
    exams,
    questions,
    teachingAssignments,
    teachingSchemaWarning,
    gradeEssayQuestion,
    user,
    userProfile,
    currentRole,
    isDemoSandbox,
    isUsingDemoAssignmentsData
  } = useApp();

  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [essayPoints, setEssayPoints] = useState<number>(1.75);
  const [teacherFeedback, setTeacherFeedback] = useState<string>('Bài làm tốt, lập luận rõ ràng.');
  const [savingGrade, setSavingGrade] = useState<boolean>(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [pageSuccess, setPageSuccess] = useState<string | null>(null);

  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    zoom: number;
    rotation: number;
  } | null>(null);

  // Scope submissions strictly to active (class_id, subject) teaching assignments for teachers
  const scopedSubmissions = useMemo(() => {
    if (isDemoSandbox || isUsingDemoAssignmentsData || currentRole === 'admin') {
      return submissions;
    }
    if (!user?.id) return [];

    const legacyFallback = Boolean(teachingSchemaWarning && teachingAssignments.length === 0);

    return submissions.filter(sub => {
      const asg = assignments.find(a => a.id === sub.assignmentId);
      const exam = exams.find(e => e.id === (asg?.examId || ''));
      const subClassId = asg?.classId;
      const subSubject = asg?.subject || exam?.subject;

      if (legacyFallback) {
        if (!subClassId) return true;
        const cls = classes.find(c => c.id === subClassId);
        return !cls?.teacherId || cls.teacherId === user.id;
      }

      if (!subClassId || !subSubject) {
        return false;
      }

      const resolvedSub = resolveCanonicalSubject(subSubject);
      const normalizedSubSubject =
        resolvedSub.ok && resolvedSub.subjectId
          ? resolvedSub.subjectId
          : String(subSubject).trim().toLowerCase();

      return teachingAssignments.some(ta => {
        if (
          ta.teacherId !== user.id ||
          ta.status !== 'active' ||
          ta.needsSubjectCompletion ||
          ta.classId !== subClassId ||
          !ta.subject
        ) {
          return false;
        }
        const resolvedTa = resolveCanonicalSubject(ta.subject);
        const normalizedTaSubject =
          resolvedTa.ok && resolvedTa.subjectId
            ? resolvedTa.subjectId
            : String(ta.subject).trim().toLowerCase();
        return normalizedTaSubject === normalizedSubSubject;
      });
    });
  }, [
    submissions,
    assignments,
    exams,
    classes,
    teachingAssignments,
    teachingSchemaWarning,
    isUsingDemoAssignmentsData,
    currentRole,
    user?.id
  ]);

  const kpiStats = useMemo(() => {
    const count = scopedSubmissions.length;
    if (count === 0) {
      return {
        count: 0,
        avgScore: '0.00',
        maxScore: '0.00',
        topStudent: 'Chưa có bài nộp',
        pendingEssayCount: 0
      };
    }
    const avg = (
      scopedSubmissions.reduce((acc, s) => acc + Number(s.score || 0), 0) / count
    ).toFixed(2);
    const best = scopedSubmissions.reduce((prev, cur) =>
      Number(cur.score || 0) > Number(prev.score || 0) ? cur : prev
    );
    const pendingEssayCount = scopedSubmissions.filter(s => s.status !== 'graded').length;
    return {
      count,
      avgScore: avg,
      maxScore: Number(best.score || 0).toFixed(2),
      topStudent: best.studentName || 'Học sinh',
      pendingEssayCount
    };
  }, [scopedSubmissions]);

  const handleExportExcel = () => {
    if (scopedSubmissions.length === 0) return;
    exportGradeSheetToExcel('Bao_Cao_Ket_Qua_THCS_Tay_Do', 'Danh_Sach_Lop', scopedSubmissions);
  };

  const handleOpenGradingModal = (sub: Submission) => {
    setGradeError(null);
    setSelectedSub(sub);
    const firstEssay = Object.values(sub.answers || {}).find(a => a.questionType === 'essay');
    if (firstEssay) {
      const detail = sub.gradingDetails?.[firstEssay.questionId];
      setEssayPoints(detail?.pointsAwarded ?? firstEssay.pointsAwarded ?? 1.5);
      setTeacherFeedback(
        detail?.teacherFeedback ||
          firstEssay.teacherFeedback ||
          sub.teacherFeedback ||
          'Bài làm tốt, lập luận rõ ràng.'
      );
    } else if (sub.teacherFeedback) {
      setTeacherFeedback(sub.teacherFeedback);
    }
  };

  const handleSaveGrade = async (submissionId: string, questionId: string, maxPts = 10) => {
    if (savingGrade) return;
    setGradeError(null);
    setPageSuccess(null);

    if (!Number.isFinite(essayPoints) || essayPoints < 0 || essayPoints > maxPts) {
      setGradeError(`Điểm tự luận phải nằm trong khoảng từ 0 đến ${maxPts}.`);
      return;
    }

    if (!isDemoSandbox && isSupabaseConfigured && user && !isUsingDemoAssignmentsData && isValidUuid(submissionId)) {
      setSavingGrade(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          setGradeError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          return;
        }

        const res = await fetch(`/api/teacher/submissions/${submissionId}/grade`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            questionId,
            pointsAwarded: essayPoints,
            feedback: teacherFeedback
          })
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok || !payload?.ok) {
          // If backend endpoint unavailable in static/edge setup (404/503), attempt direct RLS/RPC fallback
          if (res.status === 404 || res.status === 503) {
            const rpcFallback = await syncGradeSubmissionViaRpc({
              submissionId,
              questionId,
              pointsAwarded: essayPoints,
              feedback: teacherFeedback
            });
            if (!rpcFallback.success) {
              setGradeError(rpcFallback.error || payload?.message || `Máy chủ từ chối lưu điểm (${res.status}).`);
              return;
            }
          } else {
            setGradeError(payload?.message || `Máy chủ từ chối lưu điểm (${res.status}).`);
            return;
          }
        }
      } catch (err: any) {
        setGradeError(err?.message || 'Lỗi mạng khi đồng bộ điểm chấm tự luận.');
        return;
      } finally {
        setSavingGrade(false);
      }
    }

    gradeEssayQuestion(submissionId, questionId, essayPoints, teacherFeedback);
    setSelectedSub(null);
    setPageSuccess('Đã lưu điểm và nhận xét chấm bài (không làm thay đổi bài làm gốc của học sinh).');
  };

  return (
    <div className="space-y-6 font-edtech">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#102C54] flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-[#1769F4]" />
            <span>Chấm bài, Thống kê &amp; Báo cáo kết quả</span>
          </h2>
          <p className="text-sm text-slate-600">
            Trường THCS Tây Đô · Tài khoản:{' '}
            <b>{userProfile?.fullName || (currentRole === 'admin' ? 'Quản trị viên' : 'Giáo viên')}</b>
            {!isUsingDemoAssignmentsData && currentRole === 'teacher' && (
              <span> · Chỉ hiển thị bài nộp thuộc lớp &amp; môn được phân công</span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          disabled={scopedSubmissions.length === 0}
          className="flex items-center space-x-2 px-4 py-2 bg-[#12A879] text-white rounded-xl text-xs font-bold hover:bg-[#0F8F67] shadow-xs whitespace-nowrap shrink-0 disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Bảng điểm Excel (.xlsx)</span>
        </button>
      </div>

      {pageSuccess && (
        <div className="p-3.5 rounded-2xl bg-[#ECFDF7] border border-[#12A879]/25 text-[#0B6E4F] text-xs font-bold flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#12A879] shrink-0" />
            {pageSuccess}
          </span>
          <button type="button" onClick={() => setPageSuccess(null)} className="underline whitespace-nowrap shrink-0">
            Đóng
          </button>
        </div>
      )}

      {/* Analytics KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Tổng lượt nộp trong phạm vi</span>
          <div className="text-2xl font-bold text-[#102C54] mt-1 tabular-nums">
            {kpiStats.count} bài
          </div>
          <span className="text-[11px] text-slate-500">
            {isUsingDemoAssignmentsData ? 'Dữ liệu demo' : 'Đồng bộ Supabase'}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Điểm trung bình</span>
          <div className="text-2xl font-bold text-[#1769F4] mt-1 tabular-nums">
            {kpiStats.avgScore}
          </div>
          <span className="text-[11px] text-slate-500">Thang điểm 10</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Điểm cao nhất</span>
          <div className="text-2xl font-bold text-[#12A879] mt-1 tabular-nums">
            {kpiStats.maxScore}
          </div>
          <span className="text-[11px] text-slate-500 truncate block">
            {kpiStats.topStudent}
          </span>
        </div>

        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-500">Bài chờ chấm tự luận</span>
          <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            {kpiStats.pendingEssayCount} bài
          </div>
          <span className="text-[11px] text-slate-500">Cần giáo viên duyệt điểm</span>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#102C54]">Danh sách bài nộp của học sinh</h3>
          <span className="text-xs text-slate-500 tabular-nums">{scopedSubmissions.length} bản ghi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F6F9FD] text-[#102C54] text-xs uppercase font-bold border-b border-[#E2E8F0]">
              <tr>
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-4">Lớp / Môn</th>
                <th className="py-3 px-4">Bài kiểm tra</th>
                <th className="py-3 px-4">Thời gian nộp</th>
                <th className="py-3 px-4 text-center">Rời tab</th>
                <th className="py-3 px-4 text-center">Điểm số</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scopedSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-slate-400">
                    Chưa có bài nộp nào trong phạm vi lớp – môn bạn được phân công.
                  </td>
                </tr>
              ) : (
                scopedSubmissions.map(sub => {
                  const asg = assignments.find(a => a.id === sub.assignmentId);
                  const subjName = asg?.subject ? getSubjectDisplayName(asg.subject) : '';
                  return (
                    <tr key={sub.id} className="hover:bg-[#F6F9FD]">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#102C54]">{sub.studentName}</div>
                        <div className="font-mono text-[11px] text-[#1769F4]">
                          {sub.studentId.slice(0, 12)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <div className="font-bold">{sub.studentClass}</div>
                        {subjName && <div className="text-slate-500">{subjName}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 max-w-[200px] truncate">
                        {sub.examTitle}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 tabular-nums">
                        {sub.submittedAt || '—'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs tabular-nums">
                        {sub.tabSwitchCount > 0 ? (
                          <span className="text-amber-600 font-bold">{sub.tabSwitchCount} lần</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-base text-[#102C54] tabular-nums">
                        {Number(sub.score || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${
                            sub.status === 'graded'
                              ? 'bg-[#ECFDF7] border-[#12A879]/25 text-[#0B6E4F]'
                              : 'bg-amber-50 border-amber-200 text-amber-800'
                          }`}
                        >
                          {sub.status === 'graded' ? 'Đã chấm' : 'Chờ chấm tự luận'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenGradingModal(sub)}
                          className="px-3 py-1 bg-[#1769F4] text-white rounded-lg text-xs font-semibold hover:bg-[#1255CC] whitespace-nowrap shrink-0"
                        >
                          Xem &amp; Chấm
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Grading Essay */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 border border-[#E2E8F0]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#102C54]">
                  Chi tiết bài làm: {selectedSub.studentName} ({selectedSub.studentClass})
                </h3>
                <p className="text-xs text-slate-500">Bài thi: {selectedSub.examTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {gradeError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="font-semibold">{gradeError}</span>
              </div>
            )}

            {selectedSub.teacherFeedback && (
              <div className="p-3 rounded-xl bg-[#ECFDF7] border border-[#12A879]/25 text-xs text-[#0B6E4F]">
                <span className="font-bold">Nhận xét chung đã lưu: </span>
                <span>{selectedSub.teacherFeedback}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {Object.entries(selectedSub.answers).map(([qId, ans]) => (
                <div key={qId} className="p-3 bg-[#F6F9FD] rounded-xl border border-[#E2E8F0] space-y-2">
                  <div className="flex justify-between items-center font-bold text-[#102C54]">
                    <span>
                      Câu hỏi: {qId} ({ans.questionType})
                    </span>
                    <span className="text-[#0B6E4F] tabular-nums">
                      Điểm: {ans.pointsAwarded ?? 0}
                    </span>
                  </div>

                  {ans.questionType === 'single_choice' && (
                    <p>
                      Học sinh chọn: <b>{ans.selectedOption}</b>
                    </p>
                  )}

                  {ans.questionType === 'short_answer' && (
                    <p>
                      Học sinh trả lời: <b>{ans.shortAnswerText}</b>
                    </p>
                  )}

                  {ans.questionType === 'essay' && (() => {
                    const qData = questions.find(q => q.id === qId);
                    const maxPts = qData?.points || 2.0;
                    return (
                      <div className="space-y-3 pt-2 border-t border-[#E2E8F0]">
                        {qData && (
                          <div className="p-3 bg-white rounded-lg border border-[#E2E8F0] text-xs">
                            <span className="font-bold text-[#102C54] block mb-1">
                              Nội dung câu hỏi:
                            </span>
                            <div className="text-slate-800">
                              <MathView content={qData.stem} />
                            </div>
                          </div>
                        )}

                        {qData?.rubric && qData.rubric.length > 0 && (
                          <div className="p-3 bg-[#EAF3FF] rounded-lg border border-[#C7DCFA] text-xs">
                            <span className="font-bold text-[#1769F4] block mb-1.5">
                              Thang tiêu chí chấm (Rubric):
                            </span>
                            <div className="space-y-1 text-[11px] text-slate-700">
                              {qData.rubric.map(r => (
                                <div key={r.id} className="flex justify-between items-start">
                                  <span>• {r.criterion}</span>
                                  <b className="text-[#0B6E4F] ml-2 shrink-0 tabular-nums">
                                    Tối đa {r.maxPoints}đ
                                  </b>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                          <b className="text-[#102C54] block mb-1">
                            1. Bài viết tự luận của học sinh:
                          </b>
                          <p className="whitespace-pre-line text-slate-800 bg-[#F6F9FD] p-2.5 rounded-lg border border-slate-100">
                            {ans.essayAnswerText || '(Học sinh không nhập văn bản)'}
                          </p>
                        </div>

                        {ans.essayImages && ans.essayImages.length > 0 ? (
                          <div className="p-3 bg-white rounded-lg border border-[#E2E8F0] space-y-2">
                            <div className="flex items-center justify-between">
                              <b className="text-[#102C54] flex items-center space-x-1.5">
                                <ImageIcon className="w-4 h-4 text-[#1769F4]" />
                                <span className="tabular-nums">
                                  2. Ảnh chụp bài làm &amp; hình vẽ ({ans.essayImages.length} ảnh):
                                </span>
                              </b>
                              <span className="text-[11px] text-slate-500 italic">
                                Nhấn vào ảnh để xem to và xoay ảnh
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {ans.essayImages.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  onClick={() =>
                                    setPreviewModal({
                                      url: imgUrl,
                                      title: `Bài làm của ${selectedSub.studentName} - Trang ${idx + 1}`,
                                      zoom: 1,
                                      rotation: 0
                                    })
                                  }
                                  className="relative group border border-[#E2E8F0] rounded-lg overflow-hidden bg-slate-100 aspect-4/3 cursor-pointer hover:border-[#1769F4] shadow-2xs transition-all"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Trang ${idx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 text-white text-xs font-bold">
                                    <Eye className="w-4 h-4" />
                                    <span>Phóng to</span>
                                  </div>
                                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded tabular-nums">
                                    Trang {idx + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="p-2.5 bg-slate-100 rounded-lg text-slate-500 text-[11px] italic">
                            (Học sinh không đính kèm ảnh chụp)
                          </div>
                        )}

                        {/* Grading Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-xs font-bold text-slate-700 tabular-nums">
                                Chấm điểm tự luận (Tối đa {maxPts}đ):
                              </label>
                              <div className="flex items-center space-x-1">
                                {[0.5, 1.0, 1.5, 1.75, 2.0]
                                  .filter(p => p <= maxPts)
                                  .map(p => (
                                    <button
                                      key={p}
                                      type="button"
                                      onClick={() => setEssayPoints(p)}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                                        essayPoints === p
                                          ? 'bg-[#1769F4] text-white border-[#1769F4]'
                                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                      }`}
                                    >
                                      {p}đ
                                    </button>
                                  ))}
                              </div>
                            </div>
                            <input
                              type="number"
                              step="0.25"
                              max={maxPts}
                              min="0"
                              value={essayPoints}
                              onChange={e => setEssayPoints(parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl bg-white text-sm font-bold text-[#102C54] tabular-nums"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Nhận xét của giáo viên:
                            </label>
                            <input
                              type="text"
                              value={teacherFeedback}
                              onChange={e => setTeacherFeedback(e.target.value)}
                              placeholder="Nhận xét cụ thể bài làm của học sinh..."
                              className="w-full px-3 py-2 border border-[#E2E8F0] rounded-xl bg-white text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={savingGrade}
                          onClick={() => handleSaveGrade(selectedSub.id, qId, maxPts)}
                          className="mt-2 px-4 py-2 bg-[#12A879] text-white rounded-xl font-bold hover:bg-[#0F8F67] flex items-center space-x-1.5 text-xs transition-colors shadow-xs whitespace-nowrap shrink-0 disabled:opacity-40"
                        >
                          {savingGrade ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          <span>
                            {savingGrade ? 'Đang lưu lên máy chủ...' : 'Lưu điểm & Nhận xét tự luận'}
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal for Teacher Inspecting Student Essay Photos */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4">
          <div className="relative max-w-4xl w-full max-h-[92vh] bg-slate-900 rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between p-3.5 bg-slate-800 text-white border-b border-slate-700">
              <span className="font-bold text-sm truncate max-w-xs sm:max-w-md">
                {previewModal.title}
              </span>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewModal(prev =>
                      prev ? { ...prev, zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))) } : null
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors shrink-0"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 min-w-[45px] text-center tabular-nums">
                  {Math.round(previewModal.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewModal(prev =>
                      prev ? { ...prev, zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))) } : null
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors shrink-0"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewModal(prev =>
                      prev ? { ...prev, rotation: (prev.rotation + 90) % 360 } : null
                    )
                  }
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center space-x-1 text-xs transition-colors whitespace-nowrap shrink-0"
                  title="Xoay 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Xoay 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white ml-2 transition-colors shrink-0"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/40 min-h-[350px]">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                referrerPolicy="no-referrer"
                style={{
                  transform: `rotate(${previewModal.rotation}deg) scale(${previewModal.zoom})`,
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '70vh'
                }}
                className="object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
