import React from 'react';
import { X, FileText, Clock, Award, Lock } from 'lucide-react';
import { ExamPeriod, Grade, Question, SubjectId } from '../../types';
import { MathView } from '../MathView';
import {
  EXAM_PERIOD_META,
  QUESTION_LEVEL_LABELS,
  QUESTION_TYPE_LABELS,
  getSubjectOption
} from '../../utils/examCatalogScope';

interface ExamPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  code: string;
  grade: Grade;
  subject: SubjectId;
  textbook?: string;
  period: ExamPeriod;
  durationMinutes: number;
  questions: Question[];
  lockedIds: Record<string, boolean>;
}

export const ExamPreviewModal: React.FC<ExamPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  code,
  grade,
  subject,
  textbook,
  period,
  durationMinutes,
  questions,
  lockedIds
}) => {
  if (!isOpen) return null;

  const subjectInfo = getSubjectOption(subject);
  const periodLabel = EXAM_PERIOD_META.find(p => p.id === period)?.label || 'Kiểm tra';
  const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 font-serif"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-preview-title"
    >
      <div className="bg-white rounded-2xl border border-[#DCE8F7] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#082B52] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-blue-300 shrink-0" />
            <div className="min-w-0">
              <h3 id="exam-preview-title" className="text-base font-bold truncate">
                Xem trước đề kiểm tra: {title || 'Chưa đặt tên đề'}
              </h3>
              <p className="text-xs text-blue-200 truncate">
                Mã đề: {code || 'CHƯA CÓ MÃ'} • Khối {grade} – Môn {subjectInfo.name}
                {textbook && textbook !== 'all' ? ` • Bộ sách: ${textbook}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-100 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Đóng xem trước"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta Paper Banner */}
        <div className="px-6 py-4 bg-[#F3F8FF] border-b border-[#DCE8F7] shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#082B52]">
            <div>
              <p className="font-bold uppercase tracking-wide">TRƯỜNG THCS TÂY ĐÔ</p>
              <p className="text-slate-600 mt-0.5">
                Đợt kiểm tra: <b>{periodLabel}</b> • Môn: <b>{subjectInfo.name} {grade}</b>
              </p>
            </div>
            <div className="flex flex-wrap items-center md:justify-end gap-4">
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-[#006BFF]" />
                Thời gian: {durationMinutes} phút
              </span>
              <span className="inline-flex items-center gap-1.5 font-bold">
                <Award className="w-4 h-4 text-emerald-700" />
                {questions.length} câu • {totalPoints.toFixed(2)} điểm
              </span>
            </div>
          </div>
        </div>

        {/* Question Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-white">
          {questions.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">
              Chưa có câu hỏi nào trong đề đang soạn.
            </div>
          ) : (
            questions.map((q, index) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-[#DCE8F7] bg-[#FBFDFF] space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#082B52]">
                    <span className="px-2 py-0.5 rounded bg-[#006BFF] text-white">
                      Câu {index + 1}
                    </span>
                    <span className="font-mono text-slate-600">[{q.code}]</span>
                    <span className="text-emerald-700">({Number(q.points).toFixed(2)} điểm)</span>
                    {lockedIds[q.id] && (
                      <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        <Lock className="w-3 h-3" />
                        Cố định vị trí
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {QUESTION_TYPE_LABELS[q.type]} • {QUESTION_LEVEL_LABELS[q.level]}
                  </span>
                </div>

                <div className="text-sm text-slate-900">
                  <MathView content={q.stem} />
                </div>

                {q.type === 'single_choice' && Array.isArray(q.options) && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {q.options.map(opt => (
                      <div
                        key={opt.id || opt.label}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 flex items-start gap-2"
                      >
                        <span className="font-bold text-[#082B52] shrink-0">{opt.label}.</span>
                        <MathView content={opt.text} />
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'true_false_group' && Array.isArray(q.subItems) && q.subItems.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {q.subItems.map(sub => (
                      <div
                        key={sub.id || sub.label}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 flex items-start gap-2"
                      >
                        <span className="font-bold text-[#082B52] shrink-0">{sub.label})</span>
                        <MathView content={sub.text} />
                      </div>
                    ))}
                  </div>
                )}

                {q.chapter && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Phạm vi: {q.chapter}
                    {q.lesson ? ` — ${q.lesson}` : ''}
                  </p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#006BFF] text-white text-xs font-bold hover:bg-blue-600 transition-colors"
          >
            Đóng xem trước
          </button>
        </div>
      </div>
    </div>
  );
};
