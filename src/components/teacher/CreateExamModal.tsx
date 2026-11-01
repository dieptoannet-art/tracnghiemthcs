import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Exam, Assignment } from '../../types';
import { FileEdit, Shuffle, Send, Check, Lock, Unlock, Clock, Calendar } from 'lucide-react';

export const CreateExamModal: React.FC = () => {
  const { questions, exams, classes, assignments, selectedGrade, selectedSubject, createExam, createAssignment } = useApp();

  const [examTitle, setExamTitle] = useState('Kiểm tra Giữa kỳ I - Đề số 2');
  const [examCode, setExamCode] = useState(`ĐỀ 102 - TOÁN 8 GK1`);
  const [duration, setDuration] = useState<number>(45);
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || '');
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [showSolutionAfterSubmit, setShowSolutionAfterSubmit] = useState<boolean>(true);
  const [isComputerLabMode, setIsComputerLabMode] = useState<boolean>(false);
  const [createdSuccess, setCreatedSuccess] = useState<boolean>(false);

  // Pick questions from the current grade & subject
  const availableQ = questions.filter(q => q.grade === selectedGrade && q.subject === selectedSubject);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    availableQ.slice(0, 5).map(q => q.id)
  );
  const [lockedIds, setLockedIds] = useState<Record<string, boolean>>({});

  const toggleSelect = (id: string) => {
    setSelectedQuestionIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleLock = (id: string) => {
    setLockedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedQuestionIds.length === 0) return;

    const chosenQuestions = questions.filter(q => selectedQuestionIds.includes(q.id));
    const totalPts = chosenQuestions.reduce((sum, q) => sum + q.points, 0);

    const newExam: Exam = {
      id: `exam-${Date.now()}`,
      code: examCode.trim().toUpperCase(),
      title: examTitle.trim(),
      grade: selectedGrade,
      subject: selectedSubject,
      period: 'mid1',
      durationMinutes: duration,
      questions: chosenQuestions,
      totalPoints: totalPts,
      createdAt: new Date().toISOString().split('T')[0],
      author: 'Thầy Diệp Thanh Toàn'
    };
    createExam(newExam);

    const assignedClass = classes.find(c => c.id === targetClassId) || classes[0];
    const newAssignment: Assignment = {
      id: `asg-${Date.now()}`,
      examId: newExam.id,
      examTitle: newExam.title,
      classId: assignedClass.id,
      className: assignedClass.name,
      grade: selectedGrade,
      subject: selectedSubject,
      openTime: new Date().toLocaleString('vi-VN'),
      closeTime: new Date(Date.now() + 14 * 24 * 3600 * 1000).toLocaleString('vi-VN'),
      durationMinutes: duration,
      attemptsAllowed: 1,
      allowReview: true,
      showSolutionAfterSubmit,
      shuffleQuestions,
      shuffleOptions,
      isComputerLabMode,
      status: 'active'
    };
    createAssignment(newAssignment);

    setCreatedSuccess(true);
    setTimeout(() => setCreatedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
          <FileEdit className="w-6 h-6 text-[#006BFF]" />
          <span>Tạo đề kiểm tra & Giao bài theo lớp</span>
        </h2>
        <p className="text-sm text-slate-500">
          Trộn đề tự động, phân mã đề (101, 102...), cấu hình bảo mật phòng máy và giao bài
        </p>
      </div>

      {createdSuccess && (
        <div className="p-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-2xl flex items-center space-x-3 text-sm font-bold">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>Tạo đề thi và giao bài cho lớp thành công! Học sinh có thể bắt đầu làm bài ngay.</span>
        </div>
      )}

      <form onSubmit={handlePublish} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Settings (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-5">
          <h3 className="text-base font-bold text-[#082B52] border-b border-slate-100 pb-2">
            1. Thông số đề kiểm tra & Quy định thi
          </h3>

          <div className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian làm bài:</label>
                <select
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border rounded-xl"
                >
                  <option value={15}>15 phút (Kiểm tra thường xuyên)</option>
                  <option value={45}>45 phút (1 tiết)</option>
                  <option value={60}>60 phút (Giữa kỳ / Cuối kỳ)</option>
                  <option value={90}>90 phút (Khảo sát chất lượng)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giao cho lớp học:</label>
              <select
                value={targetClassId}
                onChange={e => setTargetClassId(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-xl font-semibold text-[#082B52]"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.studentCount} học sinh) - Khối {c.grade}
                  </option>
                ))}
              </select>
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

        {/* Right Column: Pick questions from bank (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h3 className="text-base font-bold text-[#082B52]">2. Chọn câu hỏi vào đề ({selectedQuestionIds.length} câu)</h3>
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
            </div>
          </div>

          <button
            type="submit"
            disabled={selectedQuestionIds.length === 0}
            className="w-full py-3 bg-[#006BFF] text-white font-bold rounded-xl shadow-xs hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
            <span>Phát hành & Giao bài cho lớp</span>
          </button>
        </div>
      </form>
    </div>
  );
};
