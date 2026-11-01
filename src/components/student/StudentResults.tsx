import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Submission } from '../../types';
import { MathView } from '../MathView';
import {
  BarChart2,
  Award,
  Clock,
  Calendar,
  CheckCircle2,
  FileText,
  Eye,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  X
} from 'lucide-react';

export const StudentResults: React.FC = () => {
  const { submissions, studentUser, questions } = useApp();
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    zoom: number;
    rotation: number;
  } | null>(null);

  const userSubmissions = submissions.filter(s => s.studentId === studentUser.id);
  const avgScore = userSubmissions.length > 0
    ? (userSubmissions.reduce((acc, s) => acc + s.score, 0) / userSubmissions.length).toFixed(1)
    : '8.5';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#082B52]">Kết quả & Tiến bộ học tập</h2>
        <p className="text-sm text-slate-500">
          Theo dõi lịch sử làm bài, điểm số định kỳ và mức độ hoàn thành các yêu cầu cần đạt
        </p>
        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md inline-block mt-1">
          Dữ liệu trên trình duyệt ({userSubmissions.length} lượt bài)
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-[#006BFF] rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase">Điểm trung bình</span>
            <div className="text-2xl font-bold text-[#082B52]">{avgScore} / 10</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase">Bài đã hoàn thành</span>
            <div className="text-2xl font-bold text-[#082B52]">{userSubmissions.length} bài</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <BarChart2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-bold uppercase">Mức độ đạt chuẩn</span>
            <div className="text-2xl font-bold text-purple-700">Tốt (85%)</div>
          </div>
        </div>
      </div>

      {/* Submission History Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
        <h3 className="text-lg font-bold text-[#082B52]">Lịch sử nộp bài gần đây</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F3F8FF] text-[#12345B] text-xs uppercase font-bold border-b border-[#DCE8F7]">
              <tr>
                <th className="py-3 px-4">Tên bài kiểm tra</th>
                <th className="py-3 px-4">Thời gian nộp</th>
                <th className="py-3 px-4">Thời lượng</th>
                <th className="py-3 px-4 text-center">Điểm số</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {userSubmissions.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-semibold text-[#082B52]">
                    {sub.examTitle}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {sub.submittedAt}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {Math.round(sub.timeSpentSeconds / 60)} phút
                  </td>
                  <td className="py-3 px-4 text-center font-bold text-[#006BFF] text-base">
                    {sub.score.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      {sub.status === 'graded' ? 'Đã chấm điểm' : 'Chờ chấm tự luận'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setSelectedSubmission(sub)}
                      className="px-3 py-1 bg-[#006BFF] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 mx-auto transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem bài</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal View Submission Details */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#082B52]">
                  Chi tiết bài làm: {selectedSubmission.examTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  Thời gian nộp: {selectedSubmission.submittedAt} • Tổng điểm: <b>{selectedSubmission.score.toFixed(2)}/{selectedSubmission.maxScore}</b>
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {Object.entries(selectedSubmission.answers).map(([qId, ans], idx) => {
                const qData = questions.find(q => q.id === qId);
                return (
                  <div key={qId} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center font-bold text-[#082B52]">
                      <span>Câu {idx + 1}: [{qId}]</span>
                      <span className="text-[#006BFF] font-mono text-sm">
                        Điểm: {ans.pointsAwarded ?? 0}đ
                      </span>
                    </div>

                    {qData && (
                      <div className="text-slate-700 my-1.5">
                        <MathView content={qData.stem} />
                      </div>
                    )}

                    {ans.questionType === 'single_choice' && (
                      <p className="text-slate-700">
                        Bạn đã chọn đáp án: <b>{ans.selectedOption}</b>
                      </p>
                    )}

                    {ans.questionType === 'short_answer' && (
                      <p className="text-slate-700">
                        Câu trả lời ngắn của bạn: <b>{ans.shortAnswerText}</b>
                      </p>
                    )}

                    {ans.questionType === 'essay' && (
                      <div className="space-y-3 pt-2 border-t border-slate-200">
                        <div className="p-3 bg-white rounded-lg border border-slate-200">
                          <b className="text-slate-800 block mb-1">Bài viết tự luận của bạn:</b>
                          <p className="whitespace-pre-line text-slate-700">
                            {ans.essayAnswerText || '(Không nhập văn bản)'}
                          </p>
                        </div>

                        {ans.essayImages && ans.essayImages.length > 0 && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                            <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                              <ImageIcon className="w-4 h-4 text-[#006BFF]" />
                              <span>Ảnh bài làm đính kèm ({ans.essayImages.length} ảnh):</span>
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {ans.essayImages.map((imgUrl, i) => (
                                <div
                                  key={i}
                                  onClick={() => setPreviewModal({ url: imgUrl, title: `Bài làm câu ${idx + 1} - Trang ${i + 1}`, zoom: 1, rotation: 0 })}
                                  className="group relative cursor-pointer border rounded-lg overflow-hidden bg-slate-100 aspect-4/3 hover:border-[#006BFF] transition-all"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Bài làm ${i + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                    <Eye className="w-4 h-4" />
                                  </div>
                                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                                    Trang {i + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {ans.teacherFeedback && (
                          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900">
                            <span className="font-bold block mb-0.5">Nhận xét của giáo viên:</span>
                            <p>{ans.teacherFeedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t">
              <button
                onClick={() => setSelectedSubmission(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal for Student viewing photos */}
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
