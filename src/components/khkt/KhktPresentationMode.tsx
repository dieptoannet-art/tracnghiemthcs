import React, { useState } from 'react';
import {
  Presentation,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  RotateCcw,
  Maximize2,
  Minimize2,
  Play,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  KHKT_PRESENTATION_STEPS,
  KHKT_TECH_ARCHITECTURE,
  KHKT_EVIDENCE_ITEMS,
  KhktPresentationStep
} from './khktContentData';

export const KhktPresentationMode: React.FC = () => {
  const {
    khktPresentationStep,
    setKhktPresentationStep,
    enterKhktShowcase,
    enterDemoRole,
    openCoreKnowledgeLesson,
    setPreferredDemoAssignmentId,
    setCurrentView,
    resetDemoSandbox,
  } = useApp();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeStep =
    KHKT_PRESENTATION_STEPS.find((s) => s.stepNumber === khktPresentationStep) ||
    KHKT_PRESENTATION_STEPS[0];

  const handleToggleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  const executeStepAction = (target: KhktPresentationStep['actionTarget']) => {
    switch (target) {
      case 'teacher_demo_classes':
        enterDemoRole('teacher', 'teacher_classes');
        break;
      case 'game_a05_50':
      case 'game_a01_50':
        enterDemoRole('teacher', 'teacher_student_call');
        break;
      case 'math_lab':
        setCurrentView('math_lab');
        break;
      case 'lesson_tin6_b1':
        openCoreKnowledgeLesson('tin_6_cd1_b1');
        break;
      case 'exam_tin6_demo':
        enterDemoRole('student');
        setPreferredDemoAssignmentId('demo-asg-tin6-b1');
        setCurrentView('student_assignments');
        break;
      case 'architecture':
        setKhktPresentationStep(5);
        break;
      case 'evidence':
        setKhktPresentationStep(6);
        break;
    }
  };

  return (
    <div className="space-y-6 font-edtech pb-10">
      {/* Presenter Top Bar */}
      <div className="bg-[#102C54] text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-200 tabular-nums">
              CHẾ ĐỘ TRÌNH DIỄN BAN GIÁM KHẢO KHKT · BƯỚC {activeStep.stepNumber}/6
            </div>
            <h1 className="text-lg sm:text-xl font-extrabold">{activeStep.title}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setKhktPresentationStep(1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Về Bước 1</span>
          </button>
          <button
            type="button"
            onClick={resetDemoSandbox}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Đặt lại Demo 50 HS</span>
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
          <button
            type="button"
            onClick={() => enterKhktShowcase(false)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-[#102C54] hover:bg-sky-50 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Hồ sơ KHKT (/khkt)</span>
          </button>
        </div>
      </div>

      {/* 6-Step Stepper Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {KHKT_PRESENTATION_STEPS.map((st) => {
          const isCurrent = st.stepNumber === activeStep.stepNumber;
          const isCompleted = st.stepNumber < activeStep.stepNumber;
          return (
            <button
              key={st.stepNumber}
              type="button"
              onClick={() => setKhktPresentationStep(st.stepNumber)}
              className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : isCompleted
                  ? 'bg-emerald-50/70 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-white text-slate-700 border-[#E2E8F0] hover:bg-[#F6F9FD]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-extrabold">
                <span className="font-mono-num">BƯỚC {st.stepNumber}</span>
                {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
              <div className="text-xs font-bold mt-1 truncate">{st.shortLabel}</div>
            </button>
          );
        })}
      </div>

      {/* Active Presentation Stage */}
      <section className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <p className="text-sm sm:text-base font-bold text-indigo-700">{activeStep.subtitle}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold tabular-nums shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Thời lượng gợi ý: {activeStep.timeBudget}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Key Script / Points */}
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Nội dung thuyết trình trọng tâm
            </h2>
            <ul className="space-y-3">
              {activeStep.talkingPoints.map((pt, idx) => (
                <li
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F6F9FD] border border-[#C7DCFA] flex items-start gap-3 text-sm text-[#102C54] leading-relaxed"
                >
                  <span className="w-6 h-6 rounded-lg bg-[#1769F4] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 font-mono-num">
                    {idx + 1}
                  </span>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Interactive Live Demo Panel */}
          <div className="lg:col-span-5 bg-[#F6F9FD] rounded-2xl border border-[#E2E8F0] p-5 space-y-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
              Thao tác Demo Trực tiếp cho Bước {activeStep.stepNumber}
            </h2>

            {activeStep.stepNumber === 5 ? (
              <div className="space-y-2.5">
                {KHKT_TECH_ARCHITECTURE.map((layer) => (
                  <div key={layer.layer} className="p-3 bg-white rounded-xl border border-[#E2E8F0] space-y-1">
                    <div className="text-[11px] font-extrabold text-[#1769F4] uppercase">{layer.layer}</div>
                    <div className="text-xs font-mono-num font-bold text-[#102C54]">{layer.stack}</div>
                    <div className="text-[11px] text-slate-600">{layer.role}</div>
                  </div>
                ))}
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <span>
                    Không có Secret Key trên frontend; mọi thao tác Admin thật đều khóa khỏi chế độ Demo.
                  </span>
                </div>
              </div>
            ) : activeStep.stepNumber === 6 ? (
              <div className="space-y-2.5">
                {KHKT_EVIDENCE_ITEMS.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-xl border space-y-1 ${
                      ev.status === 'VERIFIED_TECH_SPEC'
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#102C54]">{ev.title}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-900">
                      {ev.status === 'VERIFIED_TECH_SPEC' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                      )}
                      <span>{ev.displayText}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Nhấp để mở ngay phân hệ thực tế tương ứng. Thanh điều hướng Sandbox phía trên luôn giữ nút <strong>Quay lại Trình diễn KHKT (Bước {activeStep.stepNumber})</strong> để quay về sân khấu chỉ bằng 1 chạm.
                </p>
                <button
                  type="button"
                  onClick={() => executeStepAction(activeStep.actionTarget)}
                  className="w-full py-3 px-4 rounded-xl bg-[#1769F4] hover:bg-[#1255CC] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  <span>{activeStep.actionLabel}</span>
                </button>
                {activeStep.secondaryLabel && activeStep.secondaryTarget && (
                  <button
                    type="button"
                    onClick={() => executeStepAction(activeStep.secondaryTarget!)}
                    className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#102C54] border border-[#C7DCFA] text-xs font-bold cursor-pointer"
                  >
                    {activeStep.secondaryLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={activeStep.stepNumber <= 1}
            onClick={() => setKhktPresentationStep(activeStep.stepNumber - 1)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Bước trước</span>
          </button>

          <div className="flex items-center gap-2">
            {activeStep.stepNumber < 6 && (
              <button
                type="button"
                onClick={() => setKhktPresentationStep(6)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Tới Kết luận (Bước 6)</span>
              </button>
            )}
            <button
              type="button"
              disabled={activeStep.stepNumber >= 6}
              onClick={() => setKhktPresentationStep(activeStep.stepNumber + 1)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Bước tiếp theo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
