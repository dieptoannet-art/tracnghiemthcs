import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MathView } from '../MathView';
import { supabase } from '../../lib/supabase';
import { Question, Grade } from '../../types';
import { normalizeGrade, isQuestionInSubject, getSubjectDisplayName } from '../teacher/QuestionBank';
import {
  AlertOctagon,
  RotateCcw,
  BookOpen,
  Check,
  X,
  Sparkles,
  Filter,
  CheckCircle2,
  Trash2,
  Eye,
  FileText
} from 'lucide-react';

export const WrongQuestionsBook: React.FC = () => {
  const {
    questions: localQuestions,
    selectedGrade: contextGrade,
    selectedSubject: contextSubject,
    submissions,
    setCurrentView
  } = useApp();

  const [selectedGrade, setSelectedGrade] = useState<string>(() => normalizeGrade(contextGrade) || '6');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [supabaseQuestions, setSupabaseQuestions] = useState<any[]>([]);
  const [storedWrongIds, setStoredWrongIds] = useState<string[]>([]);
  const [practicingId, setPracticingId] = useState<string | null>(null);
  const [retryAnswer, setRetryAnswer] = useState<any>('');
  const [retryResult, setRetryResult] = useState<{ isCorrect: boolean; message: string } | null>(null);

  // Nạp danh sách ID câu sai từ LocalStorage
  const loadStoredWrongIds = () => {
    try {
      const stored = localStorage.getItem('taydo_wrong_question_ids');
      if (stored) {
        setStoredWrongIds(JSON.parse(stored));
      } else {
        setStoredWrongIds([]);
      }
    } catch {
      setStoredWrongIds([]);
    }
  };

  useEffect(() => {
    loadStoredWrongIds();
  }, []);

  // Nạp câu hỏi từ Supabase
  useEffect(() => {
    const fetchSupabase = async () => {
      try {
        const { data } = await supabase
          .from('questions')
          .select('*')
          .limit(1000);
        if (data) setSupabaseQuestions(data);
      } catch (e) {
        console.warn('Lỗi tải câu hỏi từ CSDL cho sổ câu sai:', e);
      }
    };
    fetchSupabase();
  }, []);

  // Tổng hợp kho câu hỏi (Local + Supabase)
  const allMasterQuestions = useMemo<Question[]>(() => {
    const map = new Map<string, Question>();
    (localQuestions || []).forEach(q => map.set(q.id, q));

    supabaseQuestions.forEach((sq: any) => {
      let parsedOptions: any[] = [];
      if (Array.isArray(sq.options)) parsedOptions = sq.options;
      else if (typeof sq.options === 'string') {
        try { parsedOptions = JSON.parse(sq.options); } catch { parsedOptions = []; }
      }
      const formattedOptions = parsedOptions.map((opt, i) => ({
        id: opt.id || `opt-${i}`,
        label: opt.label || String.fromCharCode(65 + i),
        text: opt.text || ''
      }));

      map.set(sq.id, {
        id: sq.id,
        code: sq.code || `Q-${sq.id.slice(0, 8)}`,
        grade: (normalizeGrade(sq.grade) || '6') as Grade,
        subject: sq.subject || 'Tin học',
        textbook: sq.textbook || 'Kết nối tri thức',
        chapter: sq.chapter || 'Chủ đề chung',
        lesson: sq.lesson || 'Bài học chung',
        yccd: sq.yccd || '',
        competency: sq.competency || '',
        level: sq.level || 'know',
        type: sq.type || 'single_choice',
        stem: sq.stem || '',
        points: Number(sq.points) || 1.0,
        options: formattedOptions,
        correctAnswer: sq.correctAnswer || (formattedOptions[0]?.label || 'A'),
        explanation: sq.explanation || 'Xem lại kiến thức lý thuyết trong sách giáo khoa.',
        acceptedAnswers: sq.acceptedAnswers || [],
        rubric: sq.rubric || undefined,
        sampleAnswer: sq.sample_answer || sq.sampleAnswer || undefined,
        status: sq.status || 'approved',
        author: sq.author || 'Tổ Chuyên môn THCS Tây Đô',
        version: sq.version || 1
      });
    });

    return Array.from(map.values());
  }, [localQuestions, supabaseQuestions]);

  // Lọc ra các câu hỏi sai theo lưu trữ hoặc mẫu
  const wrongQuestions = useMemo(() => {
    // 1. Nếu có ID trong localStorage
    let wrongList: Question[] = [];
    if (storedWrongIds.length > 0) {
      const qMap = new Map<string, Question>();
      allMasterQuestions.forEach(q => qMap.set(q.id, q));
      storedWrongIds.forEach(id => {
        const found = qMap.get(id);
        if (found) wrongList.push(found);
      });
    }

    // 2. Nếu chưa có câu sai từ thực hành, lấy 3 câu gợi ý từ môn đang chọn
    if (wrongList.length === 0) {
      wrongList = allMasterQuestions.slice(0, 3);
    }

    // Lọc theo khối lớp & môn học nếu người dùng chọn
    return wrongList.filter(q => {
      const matchGrade = selectedGrade === 'all' || normalizeGrade(q.grade) === selectedGrade;
      const matchSub = selectedSubject === 'all' || isQuestionInSubject(q, selectedSubject);
      return matchGrade && matchSub;
    });
  }, [allMasterQuestions, storedWrongIds, selectedGrade, selectedSubject]);

  const handleStartRetry = (qId: string) => {
    setPracticingId(qId);
    setRetryAnswer('');
    setRetryResult(null);
  };

  const handleCheckRetry = (q: any) => {
    if (q.type === 'single_choice') {
      const isCorrect = String(retryAnswer).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
      setRetryResult({
        isCorrect,
        message: isCorrect
          ? 'Chính xác! Bạn đã hiểu bài và khắc phục được câu sai này.'
          : 'Chưa chính xác, hãy xem kỹ lại phần lời giải chi tiết bên dưới!'
      });
    } else if (q.type === 'short_answer') {
      const isCorrect = q.acceptedAnswers?.some((a: string) => a.toLowerCase().trim() === String(retryAnswer).toLowerCase().trim());
      setRetryResult({
        isCorrect: Boolean(isCorrect),
        message: isCorrect
          ? 'Chính xác! Đáp án hoàn toàn khớp.'
          : 'Chưa đúng, hãy đối chiếu với đáp án chuẩn nhé!'
      });
    } else if (q.type === 'essay') {
      const hasContent = String(retryAnswer).trim().length > 10;
      setRetryResult({
        isCorrect: hasContent,
        message: hasContent
          ? 'Đã ghi nhận bài giải tự luận! Hãy đối chiếu với barem điểm và đáp án mẫu bên dưới.'
          : 'Vui lòng trình bày chi tiết các bước giải thích hoặc lập luận.'
      });
    }
  };

  const handleRemoveFromWrongBook = (qId: string) => {
    const nextIds = storedWrongIds.filter(id => id !== qId);
    setStoredWrongIds(nextIds);
    localStorage.setItem('taydo_wrong_question_ids', JSON.stringify(nextIds));
  };

  const handleClearAllWrong = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách câu sai trong sổ?')) {
      setStoredWrongIds([]);
      localStorage.removeItem('taydo_wrong_question_ids');
    }
  };

  return (
    <div className="space-y-6 font-serif">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
            <AlertOctagon className="w-6 h-6 text-red-500" />
            <span>Sổ câu sai & Khắc phục lỗ hổng kiến thức</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động lưu trữ câu hỏi làm sai từ các phiên luyện tập để học sinh ôn lại và củng cố vững chắc
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {storedWrongIds.length > 0 && (
            <button
              onClick={handleClearAllWrong}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa tất cả câu đã thuộc</span>
            </button>
          )}

          <button
            onClick={() => setCurrentView('student_practice')}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Luyện tập ngay</span>
          </button>
        </div>
      </div>

      {/* Bộ lọc Khối & Môn */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700 flex items-center space-x-1">
            <Filter className="w-3.5 h-3.5 text-[#006BFF]" />
            <span>Lọc theo khối:</span>
          </span>
          {['all', '6', '7', '8', '9'].map(g => (
            <button
              key={g}
              onClick={() => setSelectedGrade(g)}
              className={`px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                selectedGrade === g
                  ? 'bg-[#006BFF] text-white border-[#006BFF]'
                  : 'bg-[#F3F8FF] text-slate-600 border-[#DCE8F7] hover:bg-slate-100'
              }`}
            >
              {g === 'all' ? 'Tất cả khối' : `Lớp ${g}`}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-700">Môn học:</span>
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="px-3 py-1 rounded-lg border border-[#DCE8F7] bg-white text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-[#006BFF]"
          >
            <option value="all">Tất cả môn học</option>
            <option value="Tin học">Tin học</option>
            <option value="Toán">Toán học</option>
            <option value="Ngữ văn">Ngữ văn</option>
            <option value="Khoa học tự nhiên">KHTN</option>
          </select>
        </div>
      </div>

      {/* Main List */}
      {wrongQuestions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#DCE8F7] p-8 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-[#082B52]">Không có câu hỏi sai nào trong danh mục!</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tuyệt vời! Bạn chưa có câu làm sai nào trong bộ lọc này, hoặc bạn đã khắc phục xong toàn bộ câu sai.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCurrentView('student_practice')}
              className="px-4 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors"
            >
              Làm bài luyện tập mới
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {wrongQuestions.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white rounded-2xl border border-red-100 p-5 shadow-xs space-y-4 hover:border-red-300 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-xs">
                    Cần ôn tập
                  </span>
                  <span className="font-mono font-bold text-xs text-[#082B52]">[{q.code}]</span>
                  <span className="text-xs text-slate-500">• Khối {q.grade} • {q.subject} • {q.lesson}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800">
                    {q.type === 'single_choice'
                      ? 'Trắc nghiệm ABCD'
                      : q.type === 'true_false_group'
                      ? 'Đúng - Sai 4 ý'
                      : q.type === 'essay'
                      ? 'Tự luận'
                      : 'Trả lời ngắn'}
                  </span>
                  <button
                    onClick={() => handleRemoveFromWrongBook(q.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa câu này khỏi sổ (đã hiểu rõ)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Question Stem */}
              <div className="text-sm sm:text-base font-bold text-[#12345B]">
                <MathView content={q.stem} />
              </div>

              {/* Explanation & Rubric */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                <div className="flex items-center space-x-1.5 text-blue-900 font-bold uppercase tracking-wider">
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>Gợi ý chuẩn & Phương pháp giải:</span>
                </div>

                {q.type === 'essay' && (q.sampleAnswer || q.rubric) && (
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 space-y-1.5">
                    {q.sampleAnswer && (
                      <div>
                        <b className="text-emerald-800 block">Đáp án mẫu:</b>
                        <MathView content={q.sampleAnswer} />
                      </div>
                    )}
                    {q.rubric && (
                      <div>
                        <b className="text-blue-900 block">Barem điểm:</b>
                        <MathView content={typeof q.rubric === 'string' ? q.rubric : JSON.stringify(q.rubric)} />
                      </div>
                    )}
                  </div>
                )}

                <div className="leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200">
                  <MathView content={q.explanation} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => handleStartRetry(q.id)}
                  className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#006BFF] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{practicingId === q.id ? 'Ẩn khung làm lại' : 'Làm lại câu này'}</span>
                </button>

                <button
                  onClick={() => setCurrentView('student_practice')}
                  className="inline-flex items-center space-x-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Luyện bộ câu tương tự</span>
                </button>
              </div>

              {/* Inline Retry Box */}
              {practicingId === q.id && (
                <div className="mt-3 p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <h5 className="text-xs font-bold text-blue-900">Thực hành làm lại câu hỏi:</h5>
                  {q.type === 'single_choice' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => setRetryAnswer(opt.label)}
                          className={`p-2.5 rounded-lg text-xs font-semibold border text-left transition-colors ${
                            retryAnswer === opt.label ? 'bg-[#006BFF] text-white border-[#006BFF]' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <b>{opt.label}.</b> <MathView content={opt.text} />
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'short_answer' && (
                    <input
                      type="text"
                      value={retryAnswer}
                      onChange={e => setRetryAnswer(e.target.value)}
                      placeholder="Nhập câu trả lời ngắn..."
                      className="w-full px-3 py-2 text-xs rounded-lg border bg-white focus:ring-1 focus:ring-blue-500"
                    />
                  )}

                  {q.type === 'essay' && (
                    <textarea
                      rows={4}
                      value={retryAnswer}
                      onChange={e => setRetryAnswer(e.target.value)}
                      placeholder="Trình bày bài giải tự luận hoặc lập luận của bạn..."
                      className="w-full px-3 py-2 text-xs rounded-lg border bg-white focus:ring-1 focus:ring-blue-500 leading-relaxed"
                    />
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => handleCheckRetry(q)}
                      disabled={!retryAnswer}
                      className="px-4 py-1.5 bg-[#006BFF] text-white rounded-lg text-xs font-bold hover:bg-blue-600 disabled:opacity-40 transition-colors"
                    >
                      Kiểm tra kết quả
                    </button>
                    <button
                      onClick={() => setPracticingId(null)}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Đóng
                    </button>
                  </div>

                  {retryResult && (
                    <div className={`p-2.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${
                      retryResult.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {retryResult.isCorrect ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      <span>{retryResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
