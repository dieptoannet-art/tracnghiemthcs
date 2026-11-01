import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, Copy, ExternalLink, Check, BookOpen, Layers } from 'lucide-react';

export const GeminiAssistantView: React.FC = () => {
  const { geminiAssistants, selectedGrade, selectedSubject } = useApp();

  const [promptGrade, setPromptGrade] = useState('8');
  const [promptSubject, setPromptSubject] = useState('Toán');
  const [promptTextbook, setPromptTextbook] = useState('Kết nối tri thức');
  const [promptLesson, setPromptLesson] = useState('Chương 1: Đa thức - Bài 3: Hằng đẳng thức đáng nhớ');
  const [promptYccd, setPromptYccd] = useState('Vận dụng được các hằng đẳng thức để khai triển và rút gọn đa thức');
  const [promptCount, setPromptCount] = useState(4);
  const [promptType, setPromptType] = useState('Đúng - Sai nhiều ý (4 ý)');
  const [promptLevel, setPromptLevel] = useState('Thông hiểu & Vận dụng');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate standardized prompt for Gemini
  const generatedPrompt = `Bạn là chuyên gia biên soạn đề thi môn ${promptSubject} THCS theo Chương trình Giáo dục phổ thông 2018 (Trường THCS Tây Đô).
Hãy xây dựng bộ câu hỏi kiểm tra đánh giá chuẩn mực với các thông số sau:
- Khối lớp: Lớp ${promptGrade}
- Bộ sách giáo khoa: ${promptTextbook}
- Nội dung bài học: ${promptLesson}
- Yêu cầu cần đạt (YCCĐ): ${promptYccd}
- Số lượng câu hỏi: ${promptCount} câu
- Dạng câu: ${promptType}
- Mức độ nhận thức: ${promptLevel}

Yêu cầu định dạng đầu ra:
1. Viết công thức toán học chuẩn LaTeX đặt giữa cặp dấu $. Ví dụ: $x^2 - 4x + 4 = (x - 2)^2$.
2. Cung cấp đầy đủ: Mã câu hỏi, Đề bài, Phương án lựa chọn (hoặc 4 ý a, b, c, d), Đáp án đúng, Điểm số từng ý.
3. Lời giải chi tiết: Giải thích rõ ràng vì sao từng ý Đúng hay Sai theo chuẩn phương pháp sư phạm.`;

  const handleCopyPrompt = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <span>Trợ lý Gemini theo môn học</span>
        </h2>
        <p className="text-sm text-slate-500">
          Tạo prompt yêu cầu sư phạm chuẩn GDPT 2018, sao chép sang Google Gemini và nhập kết quả vào ngân hàng câu hỏi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Prompt Builder Form (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#082B52] border-b pb-2 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#006BFF]" />
            <span>Biểu mẫu tạo yêu cầu (Prompt Generator)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Khối:</label>
              <select
                value={promptGrade}
                onChange={e => setPromptGrade(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="6">Lớp 6</option>
                <option value="7">Lớp 7</option>
                <option value="8">Lớp 8</option>
                <option value="9">Lớp 9</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Môn học:</label>
              <select
                value={promptSubject}
                onChange={e => setPromptSubject(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="Toán">Toán học</option>
                <option value="Tin học">Tin học</option>
                <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
                <option value="Ngữ văn">Ngữ văn</option>
                <option value="Tiếng Anh">Tiếng Anh</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bộ sách:</label>
              <select
                value={promptTextbook}
                onChange={e => setPromptTextbook(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="Kết nối tri thức">Kết nối tri thức</option>
                <option value="Cánh Diều">Cánh Diều</option>
                <option value="Chân trời sáng tạo">Chân trời sáng tạo</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Dạng câu hỏi:</label>
              <select
                value={promptType}
                onChange={e => setPromptType(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white"
              >
                <option value="Trắc nghiệm 1 đáp án (A, B, C, D)">Trắc nghiệm 1 ĐA</option>
                <option value="Đúng - Sai nhiều ý (4 ý a, b, c, d)">Đúng - Sai (4 ý)</option>
                <option value="Trả lời ngắn">Trả lời ngắn</option>
                <option value="Tự luận kèm thang điểm rubric">Tự luận kèm rubric</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Bài học / Chủ đề:</label>
              <input
                type="text"
                value={promptLesson}
                onChange={e => setPromptLesson(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Yêu cầu cần đạt (YCCĐ):</label>
              <input
                type="text"
                value={promptYccd}
                onChange={e => setPromptYccd(e.target.value)}
                className="w-full p-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Generated Prompt Output Box */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Prompt chuẩn sẵn sàng sao chép:</label>
              <button
                type="button"
                onClick={() => handleCopyPrompt('generator', generatedPrompt)}
                className="flex items-center space-x-1 text-xs text-[#006BFF] font-bold hover:underline"
              >
                {copiedId === 'generator' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'generator' ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép yêu cầu'}</span>
              </button>
            </div>

            <textarea
              rows={6}
              readOnly
              value={generatedPrompt}
              className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-mono text-slate-800 leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Assistants Directory (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-[#082B52] border-b pb-2 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-purple-600" />
              <span>Danh bạ trợ lý Gemini bộ môn</span>
            </h3>

            <div className="space-y-3">
              {geminiAssistants.map(asst => (
                <div key={asst.id} className="p-3.5 rounded-xl border border-slate-200 hover:border-purple-300 transition-all space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-[#082B52]">{asst.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{asst.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      onClick={() => handleCopyPrompt(asst.id, asst.samplePromptTemplate)}
                      className="flex-1 py-1.5 px-3 bg-[#F3F8FF] text-[#006BFF] border border-[#DCE8F7] rounded-lg text-xs font-bold hover:bg-blue-50 flex items-center justify-center space-x-1"
                    >
                      {copiedId === asst.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === asst.id ? 'Đã chép' : 'Sao chép mẫu'}</span>
                    </button>

                    {asst.externalUrl ? (
                      <a
                        href={asst.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-3 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center space-x-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở Gemini</span>
                      </a>
                    ) : (
                      <span className="py-1.5 px-3 bg-slate-100 text-slate-400 rounded-lg text-xs font-semibold cursor-not-allowed">
                        Chưa cấu hình link
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
              * Ghi chú quy trình: Sau khi tạo câu hỏi trên Gemini, giáo viên dán vào file Excel mẫu và tải lên chức năng <b>Nhập Excel</b> để hệ thống kiểm tra tính hợp lệ trước khi đưa vào ngân hàng.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
