import React from 'react';
import { useApp } from '../../context/AppContext';
import { MathView } from '../MathView';
import { ShieldCheck, Check, X, Eye } from 'lucide-react';

export const QuestionApproval: React.FC = () => {
  const { questions, approveQuestion, deleteQuestion } = useApp();

  const pendingQuestions = questions.filter(q => q.status === 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#082B52] flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-amber-600" />
          <span>Kiểm duyệt & Thẩm định ngân hàng câu hỏi</span>
        </h2>
        <p className="text-sm text-slate-500">
          Quy trình thẩm định: Nháp → Chờ duyệt → Được duyệt → Ngừng sử dụng. Chỉ câu được duyệt mới phát hành cho học sinh.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h3 className="font-bold text-sm text-[#082B52]">
            Hàng đợi câu hỏi chờ phê duyệt ({pendingQuestions.length} câu)
          </h3>
        </div>

        {pendingQuestions.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            Hiện tại không có câu hỏi nào đang chờ duyệt. Tất cả câu hỏi trong ngân hàng đã được thẩm định!
          </div>
        ) : (
          <div className="space-y-4">
            {pendingQuestions.map(q => (
              <div key={q.id} className="p-4 rounded-xl border border-amber-200 bg-amber-50/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded">
                      {q.code}
                    </span>
                    <span className="text-xs text-slate-500">Người soạn: {q.author}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => approveQuestion(q.id)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center space-x-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Phê duyệt</span>
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="px-3 py-1 border border-red-300 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 flex items-center space-x-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Từ chối</span>
                    </button>
                  </div>
                </div>

                <div className="text-sm font-medium text-[#12345B]">
                  <MathView content={q.stem} />
                </div>

                <div className="text-xs text-slate-600 bg-white p-2.5 rounded border">
                  <b>Lời giải: </b>
                  <MathView content={q.explanation} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
