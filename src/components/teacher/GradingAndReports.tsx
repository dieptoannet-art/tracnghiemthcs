import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Submission, SubmissionAnswer } from '../../types';
import { exportGradeSheetToExcel } from '../../utils/exportExcel';
import { MathView } from '../MathView';
import {
  BarChart3,
  Download,
  Award,
  AlertTriangle,
  CheckCircle2,
  Search,
  Edit2,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X,
  Eye,
  FileText,
  Check
} from 'lucide-react';

export const GradingAndReports: React.FC = () => {
  const { submissions, classes, exams, questions, gradeEssayQuestion } = useApp();
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);

  // Essay grading inputs
  const [essayPoints, setEssayPoints] = useState<number>(1.75);
  const [teacherFeedback, setTeacherFeedback] = useState<string>('Bài làm rất tốt, lập luận chặt chẽ.');

  // Lightbox for grading uploaded student photos
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    zoom: number;
    rotation: number;
  } | null>(null);

  const handleExportExcel = () => {
    if (submissions.length === 0) return;
    exportGradeSheetToExcel('Kiem_Tra_Giu_Ky_I_Toan_8', 'Lop_8A1', submissions);
  };

  const handleSaveGrade = (submissionId: string, questionId: string) => {
    gradeEssayQuestion(submissionId, questionId, essayPoints, teacherFeedback);
    setSelectedSub(null);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-amber-600" />
            <span>Chấm bài, Thống kê & Báo cáo kết quả</span>
          </h2>
          <p className="text-sm text-slate-500">
            Trường THCS Tây Đô • Giáo viên phụ trách: <b>Diệp Thanh Toàn</b>
          </p>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md inline-block mt-1">
            Dữ liệu trên trình duyệt ({submissions.length} bài nộp)
          </span>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-xs"
        >
          <Download className="w-4 h-4" />
          <span>Xuất Bảng điểm Excel (.xlsx)</span>
        </button>
      </div>

      {/* Analytics KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Tổng lượt nộp</span>
          <div className="text-2xl font-bold text-[#082B52] mt-1">{submissions.length} bài</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Tỉ lệ nộp bài: 100%</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Điểm trung bình lớp</span>
          <div className="text-2xl font-bold text-[#006BFF] mt-1">
            {(submissions.reduce((acc, s) => acc + s.score, 0) / (submissions.length || 1)).toFixed(2)}
          </div>
          <span className="text-[11px] text-slate-500">Thang điểm 10</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Điểm cao nhất</span>
          <div className="text-2xl font-bold text-emerald-600 mt-1">9.50</div>
          <span className="text-[11px] text-slate-500">Học sinh: Nguyễn Văn An</span>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Câu học sinh hay sai</span>
          <div className="text-xl font-bold text-rose-600 mt-1">Câu 3 (Hằng đẳng thức)</div>
          <span className="text-[11px] text-slate-500">Tỉ lệ sai: 28%</span>
        </div>
      </div>

      {/* Submissions Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#082B52]">
            Danh sách bài nộp của học sinh
          </h3>
          <span className="text-xs text-slate-500">{submissions.length} bản ghi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
              <tr>
                <th className="py-3 px-4">Mã học sinh</th>
                <th className="py-3 px-4">Họ và tên</th>
                <th className="py-3 px-4">Lớp</th>
                <th className="py-3 px-4">Thời gian nộp</th>
                <th className="py-3 px-4 text-center">Rời tab</th>
                <th className="py-3 px-4 text-center">Điểm số</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-xs text-[#006BFF]">{sub.studentId}</td>
                  <td className="py-3 px-4 font-semibold text-[#082B52]">{sub.studentName}</td>
                  <td className="py-3 px-4 text-xs text-slate-600">{sub.studentClass}</td>
                  <td className="py-3 px-4 text-xs text-slate-500">{sub.submittedAt}</td>
                  <td className="py-3 px-4 text-center text-xs">
                    {sub.tabSwitchCount > 0 ? (
                      <span className="text-amber-600 font-bold">{sub.tabSwitchCount} lần</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-base text-[#082B52]">
                    {sub.score.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {sub.status === 'graded' ? 'Đã chấm' : 'Chờ chấm tự luận'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="px-3 py-1 bg-[#006BFF] text-white rounded-lg text-xs font-semibold hover:bg-blue-600"
                    >
                      Xem & Chấm
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Grading Essay */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#082B52]">
                  Chi tiết bài làm: {selectedSub.studentName} ({selectedSub.studentClass})
                </h3>
                <p className="text-xs text-slate-500">Bài thi: {selectedSub.examTitle}</p>
              </div>
              <button onClick={() => setSelectedSub(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {Object.entries(selectedSub.answers).map(([qId, ans]) => (
                <div key={qId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center font-bold text-[#082B52]">
                    <span>Câu hỏi: {qId} ({ans.questionType})</span>
                    <span className="text-emerald-700">Điểm: {ans.pointsAwarded ?? 0}</span>
                  </div>

                  {ans.questionType === 'single_choice' && (
                    <p>Học sinh chọn: <b>{ans.selectedOption}</b></p>
                  )}

                  {ans.questionType === 'short_answer' && (
                    <p>Học sinh trả lời: <b>{ans.shortAnswerText}</b></p>
                  )}

                  {ans.questionType === 'essay' && (() => {
                    const qData = questions.find(q => q.id === qId);
                    const maxPts = qData?.points || 2.0;
                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        {/* Question Stem preview */}
                        {qData && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
                            <span className="font-bold text-[#082B52] block mb-1">Nội dung câu hỏi:</span>
                            <div className="text-slate-800">
                              <MathView content={qData.stem} />
                            </div>
                          </div>
                        )}

                        {/* Rubric display */}
                        {qData?.rubric && qData.rubric.length > 0 && (
                          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-xs">
                            <span className="font-bold text-[#006BFF] block mb-1.5">Thang tiêu chí chấm (Rubric):</span>
                            <div className="space-y-1 text-[11px] text-slate-700">
                              {qData.rubric.map(r => (
                                <div key={r.id} className="flex justify-between items-start">
                                  <span>• {r.criterion}</span>
                                  <b className="text-emerald-700 ml-2 shrink-0">Tối đa {r.maxPoints}đ</b>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Student text answer */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <b className="text-blue-900 block mb-1">1. Bài viết tự luận của học sinh:</b>
                          <p className="whitespace-pre-line text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {ans.essayAnswerText || '(Học sinh không nhập văn bản)'}
                          </p>
                        </div>

                        {/* Student uploaded images */}
                        {ans.essayImages && ans.essayImages.length > 0 ? (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <b className="text-blue-900 flex items-center space-x-1.5">
                                <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                                <span>2. Ảnh chụp bài làm & hình vẽ ({ans.essayImages.length} ảnh):</span>
                              </b>
                              <span className="text-[11px] text-slate-500 italic">Nhấn vào ảnh để xem to và xoay ảnh</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {ans.essayImages.map((imgUrl, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => setPreviewModal({ url: imgUrl, title: `Bài làm của ${selectedSub.studentName} - Trang ${idx + 1}`, zoom: 1, rotation: 0 })}
                                  className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-100 aspect-4/3 cursor-pointer hover:border-[#006BFF] shadow-2xs transition-all"
                                >
                                  <img src={imgUrl} alt={`Trang ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-1 text-white text-xs font-bold">
                                    <Eye className="w-4 h-4" />
                                    <span>Phóng to</span>
                                  </div>
                                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
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
                              <label className="text-xs font-bold text-slate-700">Chấm điểm tự luận (Tối đa {maxPts}đ):</label>
                              <div className="flex items-center space-x-1">
                                {[0.5, 1.0, 1.5, 1.75, 2.0].filter(p => p <= maxPts).map(p => (
                                  <button
                                    key={p}
                                    type="button"
                                    onClick={() => setEssayPoints(p)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                      essayPoints === p ? 'bg-[#006BFF] text-white border-[#006BFF]' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
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
                              className="w-full px-3 py-2 border rounded-xl bg-white text-sm font-bold text-[#082B52]"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Nhận xét của giáo viên:</label>
                            <input
                              type="text"
                              value={teacherFeedback}
                              onChange={e => setTeacherFeedback(e.target.value)}
                              placeholder="Nhận xét cụ thể bài làm của học sinh..."
                              className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleSaveGrade(selectedSub.id, qId)}
                          className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center space-x-1.5 text-xs transition-colors shadow-xs"
                        >
                          <Check className="w-4 h-4" />
                          <span>Lưu điểm & Nhận xét tự luận</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 bg-slate-800 text-white border-b border-slate-700">
              <span className="font-bold text-sm truncate max-w-xs sm:max-w-md">{previewModal.title}</span>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))) }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1 min-w-[45px] text-center">{Math.round(previewModal.zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))) }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
                  title="Phóng to"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(prev => prev ? ({ ...prev, rotation: (prev.rotation + 90) % 360 }) : null)}
                  className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white flex items-center space-x-1 text-xs transition-colors"
                  title="Xoay 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Xoay 90°</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white ml-2 transition-colors"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Image viewer */}
            <div className="p-4 overflow-auto flex items-center justify-center flex-1 bg-black/40 min-h-[350px]">
              <img
                src={previewModal.url}
                alt={previewModal.title}
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
