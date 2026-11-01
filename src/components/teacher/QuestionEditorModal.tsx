import React, { useState } from 'react';
import { Question, QuestionType, CognitiveLevel, Textbook, Grade, SubjectId, SingleChoiceOption, TrueFalseSubItem } from '../../types';
import { MathView } from '../MathView';
import { X, Eye, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface QuestionEditorModalProps {
  question?: Question | null;
  onClose: () => void;
  onSave: (q: Question) => void;
}

export const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  question,
  onClose,
  onSave
}) => {
  const isEditing = !!question;

  const [code, setCode] = useState(question?.code || `CH-${Date.now().toString().slice(-4)}`);
  const [grade, setGrade] = useState<Grade>(question?.grade || '8');
  const [subject, setSubject] = useState<SubjectId>(question?.subject || 'math');
  const [textbook, setTextbook] = useState<Textbook>(question?.textbook || 'Kết nối tri thức');
  const [chapter, setChapter] = useState(question?.chapter || 'Chương 1: Đa thức');
  const [lesson, setLesson] = useState(question?.lesson || 'Bài 1: Khái niệm đơn thức, đa thức');
  const [yccd, setYccd] = useState(question?.yccd || 'Nhận biết được đơn thức và bậc của đơn thức');
  const [level, setLevel] = useState<CognitiveLevel>(question?.level || 'know');
  const [type, setType] = useState<QuestionType>(question?.type || 'single_choice');
  const [stem, setStem] = useState(question?.stem || '');
  const [points, setPoints] = useState<number>(question?.points || 0.25);
  const [explanation, setExplanation] = useState(question?.explanation || '');
  const [status, setStatus] = useState(question?.status || 'approved');

  // Options for single choice
  const [options, setOptions] = useState<SingleChoiceOption[]>(question?.options || [
    { id: 'opt-1', label: 'A', text: '' },
    { id: 'opt-2', label: 'B', text: '' },
    { id: 'opt-3', label: 'C', text: '' },
    { id: 'opt-4', label: 'D', text: '' }
  ]);
  const [correctAnswer, setCorrectAnswer] = useState<string>(question?.correctAnswer || 'A');

  // Sub-items for true/false group
  const [subItems, setSubItems] = useState<TrueFalseSubItem[]>(question?.subItems || [
    { id: 'sub-1', label: 'a', text: '', isCorrect: true },
    { id: 'sub-2', label: 'b', text: '', isCorrect: false },
    { id: 'sub-3', label: 'c', text: '', isCorrect: true },
    { id: 'sub-4', label: 'd', text: '', isCorrect: false }
  ]);

  // Short answer
  const [acceptedAnswersStr, setAcceptedAnswersStr] = useState(
    question?.acceptedAnswers ? question.acceptedAnswers.join('; ') : ''
  );

  // Essay sample answer & rubric
  const [sampleAnswer, setSampleAnswer] = useState(question?.sampleAnswer || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stem.trim()) return;

    const acceptedAnswers = acceptedAnswersStr
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    const savedQ: Question = {
      id: question?.id || `q-${Date.now()}`,
      code: code.trim().toUpperCase(),
      grade,
      subject,
      textbook,
      chapter,
      lesson,
      yccd,
      level,
      type,
      stem,
      points: Number(points) || 0.25,
      explanation,
      status: status as any,
      author: question?.author || 'Thầy Diệp Thanh Toàn',
      version: (question?.version || 0) + 1,
      options: type === 'single_choice' ? options : undefined,
      correctAnswer: type === 'single_choice' ? correctAnswer : undefined,
      subItems: type === 'true_false_group' ? subItems : undefined,
      acceptedAnswers: type === 'short_answer' ? acceptedAnswers : undefined,
      sampleAnswer: type === 'essay' ? sampleAnswer : undefined
    };

    onSave(savedQ);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-[#082B52]">
              {isEditing ? `Chỉnh sửa câu hỏi [${code}]` : 'Thêm câu hỏi mới vào ngân hàng'}
            </h3>
            <p className="text-xs text-slate-500">
              Hỗ trợ công thức Toán chuẩn KaTeX giữa cặp dấu $, ví dụ: $x^2 + 2x = 0$
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mã câu hỏi:</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border rounded-lg uppercase font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp:</label>
              <select
                value={grade}
                onChange={e => setGrade(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              >
                <option value="6">Lớp 6</option>
                <option value="7">Lớp 7</option>
                <option value="8">Lớp 8</option>
                <option value="9">Lớp 9</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Môn học:</label>
              <select
                value={subject}
                onChange={e => setSubject(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              >
                <option value="math">Toán</option>
                <option value="informatics">Tin học</option>
                <option value="science">Khoa học tự nhiên</option>
                <option value="literature">Ngữ văn</option>
                <option value="english">Tiếng Anh</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bộ sách:</label>
              <select
                value={textbook}
                onChange={e => setTextbook(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              >
                <option value="Kết nối tri thức">Kết nối tri thức</option>
                <option value="Cánh Diều">Cánh Diều</option>
                <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
              </select>
            </div>
          </div>

          {/* Metadata Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dạng câu hỏi:</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg font-semibold text-[#006BFF]"
              >
                <option value="single_choice">Trắc nghiệm 1 đáp án (A, B, C, D)</option>
                <option value="true_false_group">Đúng - Sai nhiều ý (a, b, c, d)</option>
                <option value="short_answer">Trả lời ngắn</option>
                <option value="essay">Tự luận</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mức độ nhận thức:</label>
              <select
                value={level}
                onChange={e => setLevel(e.target.value as any)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              >
                <option value="know">Nhận biết (Biết)</option>
                <option value="understand">Thông hiểu (Hiểu)</option>
                <option value="apply">Vận dụng (Vận dụng cao)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Điểm số định mức:</label>
              <input
                type="number"
                step="0.05"
                value={points}
                onChange={e => setPoints(parseFloat(e.target.value))}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
          </div>

          {/* Curriculum mapping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chương / Bài học:</label>
              <input
                type="text"
                value={lesson}
                onChange={e => setLesson(e.target.value)}
                placeholder="Bài 1: Đơn thức và đa thức..."
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Yêu cầu cần đạt (YCCĐ):</label>
              <input
                type="text"
                value={yccd}
                onChange={e => setYccd(e.target.value)}
                placeholder="Ví dụ: Nhận biết được đơn thức thu gọn..."
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
          </div>

          {/* Question Stem */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Nội dung câu hỏi (Đề bài):</label>
            <textarea
              rows={3}
              value={stem}
              onChange={e => setStem(e.target.value)}
              placeholder="Nhập nội dung câu hỏi. Dùng $công thức$ để hiển thị toán, ví dụ: Cho biểu thức $A = 2x^2 + 5x$..."
              className="w-full px-3 py-2 text-sm border rounded-xl"
            />
            {/* Live KaTeX preview */}
            {stem && (
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-[#082B52]">
                <span className="font-bold text-blue-700 block mb-1">Xem trước công thức:</span>
                <MathView content={stem} />
              </div>
            )}
          </div>

          {/* Type-Specific Answer Inputs */}
          {type === 'single_choice' && (
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">Các phương án và đáp án đúng:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {options.map((opt, i) => (
                  <div key={opt.id} className="flex items-center space-x-2 bg-white p-2 rounded-lg border">
                    <input
                      type="radio"
                      name="correct_choice"
                      id={`opt-radio-${opt.label}`}
                      checked={correctAnswer === opt.label}
                      onChange={() => setCorrectAnswer(opt.label)}
                      className="w-4 h-4 text-[#006BFF]"
                    />
                    <label htmlFor={`opt-radio-${opt.label}`} className="font-bold text-xs w-4">
                      {opt.label}.
                    </label>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={e => {
                        const copy = [...options];
                        copy[i].text = e.target.value;
                        setOptions(copy);
                      }}
                      placeholder={`Nội dung phương án ${opt.label}...`}
                      className="w-full text-xs px-2 py-1 border rounded"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 italic">Chọn nút tròn để xác định phương án đúng.</p>
            </div>
          )}

          {type === 'true_false_group' && (
            <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block">4 ý Đúng / Sai:</span>
              {subItems.map((sub, i) => (
                <div key={sub.id} className="flex items-center space-x-3 bg-white p-2.5 rounded-lg border">
                  <span className="font-bold text-xs text-[#006BFF] w-4">{sub.label})</span>
                  <input
                    type="text"
                    value={sub.text}
                    onChange={e => {
                      const copy = [...subItems];
                      copy[i].text = e.target.value;
                      setSubItems(copy);
                    }}
                    placeholder={`Nội dung ý ${sub.label}...`}
                    className="flex-1 text-xs px-2 py-1 border rounded"
                  />
                  <div className="flex items-center space-x-2 shrink-0">
                    <label className="text-xs font-semibold flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`tf-${sub.id}`}
                        checked={sub.isCorrect === true}
                        onChange={() => {
                          const copy = [...subItems];
                          copy[i].isCorrect = true;
                          setSubItems(copy);
                        }}
                      />
                      <span className="text-emerald-700">Đúng</span>
                    </label>
                    <label className="text-xs font-semibold flex items-center space-x-1 cursor-pointer">
                      <input
                        type="radio"
                        name={`tf-${sub.id}`}
                        checked={sub.isCorrect === false}
                        onChange={() => {
                          const copy = [...subItems];
                          copy[i].isCorrect = false;
                          setSubItems(copy);
                        }}
                      />
                      <span className="text-red-700">Sai</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {type === 'short_answer' && (
            <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">Các đáp án chấp nhận (cách nhau bởi dấu chấm phẩy ;):</label>
              <input
                type="text"
                value={acceptedAnswersStr}
                onChange={e => setAcceptedAnswersStr(e.target.value)}
                placeholder="Ví dụ: 4; x=4; +4"
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              />
            </div>
          )}

          {type === 'essay' && (
            <div className="space-y-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-700">Đáp án mẫu và Hướng dẫn chấm:</label>
              <textarea
                rows={3}
                value={sampleAnswer}
                onChange={e => setSampleAnswer(e.target.value)}
                placeholder="Nêu các bước chấm điểm, hướng dẫn phân bổ điểm..."
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
              />
            </div>
          )}

          {/* Explanation */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Lời giải chi tiết (Hiển thị khi học sinh xem lại bài):</label>
            <textarea
              rows={2}
              value={explanation}
              onChange={e => setExplanation(e.target.value)}
              placeholder="Giải thích rõ ràng từng bước và vì sao các phương án khác sai..."
              className="w-full px-3 py-2 text-xs border rounded-xl"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#006BFF] text-white rounded-xl text-xs font-bold hover:bg-blue-600 shadow-xs"
            >
              {isEditing ? 'Lưu thay đổi' : 'Thêm vào ngân hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
