import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Compass,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Minimize2,
  MonitorPlay,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Trophy,
  Users,
} from 'lucide-react';
import { MathView } from '../MathView';
import {
  KNOWLEDGE_STRAND_LABELS,
  MathActivityResultRecord,
  MathActivitySpec,
  MathGrade,
  MathToolMetadata,
  PEDAGOGICAL_MODE_LABELS,
  PedagogicalMode,
  SIX_STEP_LABELS,
  SixStepLearningPhase,
} from './types';
import { saveMathActivityResult } from './adapters/mathLabAdapters';

interface MathToolShellProps {
  tool: MathToolMetadata;
  activeGrade: MathGrade;
  onGradeChange: (grade: MathGrade) => void;
  activeActivity: MathActivitySpec;
  onActivityChange: (activity: MathActivitySpec) => void;
  pedagogicalMode: PedagogicalMode;
  onPedagogicalModeChange: (mode: PedagogicalMode) => void;
  isPresentationMode: boolean;
  onTogglePresentationMode: () => void;
  isDarkTheme: boolean;
  onToggleDarkTheme: () => void;
  selectedClassName?: string;
  studentCount?: number;
  currentUserName?: string;
  onBackToHub: () => void;
  onResetTool: () => void;
  onResultSaved?: (record: MathActivityResultRecord) => void;
  children: React.ReactNode;
}

const STEP_ORDER: SixStepLearningPhase[] = [
  'PREDICT',
  'MANIPULATE',
  'OBSERVE',
  'EXPLAIN',
  'CONCLUDE',
  'PRACTICE',
];

export const MathToolShell: React.FC<MathToolShellProps> = ({
  tool,
  activeGrade,
  onGradeChange,
  activeActivity,
  onActivityChange,
  pedagogicalMode,
  onPedagogicalModeChange,
  isPresentationMode,
  onTogglePresentationMode,
  isDarkTheme,
  onToggleDarkTheme,
  selectedClassName,
  studentCount,
  currentUserName = 'Học sinh THCS Tây Đô',
  onBackToHub,
  onResetTool,
  onResultSaved,
  children,
}) => {
  const [currentStep, setCurrentStep] = useState<SixStepLearningPhase>('PREDICT');
  const [completedSteps, setCompletedSteps] = useState<SixStepLearningPhase[]>([]);
  const [predictionText, setPredictionText] = useState('');
  const [observationNotes, setObservationNotes] = useState('');
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [practiceCorrect, setPracticeCorrect] = useState<boolean | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStepDrawerMobile, setShowStepDrawerMobile] = useState(false);

  const expectedAnswerText =
    activeActivity.targetExpression ||
    (activeActivity.targetNumericValue !== undefined
      ? String(activeActivity.targetNumericValue)
      : activeActivity.expectedOutcomeSummary);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const markStepComplete = (step: SixStepLearningPhase, nextStep?: SixStepLearningPhase) => {
    setCompletedSteps((prev) => (prev.includes(step) ? prev : [...prev, step]));
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  };

  const handleCheckPractice = () => {
    const rawInput = practiceAnswer.trim();
    let isMatch = false;

    if (activeActivity.targetNumericValue !== undefined) {
      const parsedNum = Number(rawInput.replace(',', '.'));
      const tol = activeActivity.numericTolerance ?? 0.5;
      if (Number.isFinite(parsedNum)) {
        isMatch = Math.abs(parsedNum - activeActivity.targetNumericValue) <= tol;
      }
    }

    if (!isMatch && rawInput.length > 0) {
      const normalizedUser = rawInput.toLowerCase().replace(/\s+/g, '');
      const normalizedExpected = String(expectedAnswerText).toLowerCase().replace(/\s+/g, '');
      isMatch =
        normalizedUser === normalizedExpected ||
        normalizedExpected.includes(normalizedUser) ||
        normalizedUser.includes(normalizedExpected);
    }

    setPracticeSubmitted(true);
    setPracticeCorrect(isMatch);
    const updatedSteps: SixStepLearningPhase[] = completedSteps.includes('PRACTICE')
      ? completedSteps
      : [...completedSteps, 'PRACTICE'];
    setCompletedSteps(updatedSteps);

    const score = isMatch ? 100 : Math.min(80, updatedSteps.length * 15);
    const record: MathActivityResultRecord = {
      id: `mres-${Date.now()}`,
      toolId: tool.id,
      activityId: activeActivity.id,
      studentName: currentUserName,
      className: selectedClassName || `Lớp ${activeGrade}`,
      completedSteps: updatedSteps,
      predictionText,
      conclusionText: observationNotes,
      practiceAnswer,
      isCorrect: isMatch,
      score,
      maxScore: 100,
      completedAt: new Date().toISOString(),
    };
    saveMathActivityResult(record);
    if (onResultSaved) onResultSaved(record);
  };

  const handleResetAll = () => {
    setCompletedSteps([]);
    setCurrentStep('PREDICT');
    setPredictionText('');
    setObservationNotes('');
    setPracticeAnswer('');
    setPracticeSubmitted(false);
    setPracticeCorrect(null);
    onResetTool();
  };

  return (
    <div
      className={`min-h-[calc(100dvh-2rem)] rounded-2xl border transition-colors flex flex-col overflow-hidden ${
        isDarkTheme
          ? 'bg-slate-950 border-slate-800 text-slate-100'
          : 'bg-slate-50 border-slate-200 text-slate-900'
      }`}
    >
      {/* THANH ĐIỀU KHIỂN TRÊN CÙNG (TOP COMMAND BAR) */}
      <header
        className={`px-3 sm:px-5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
          isDarkTheme ? 'bg-slate-900/95 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBackToHub}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border transition ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Thư viện Toán</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold bg-teal-600 text-white shrink-0">
              {tool.id}
            </span>
            <div className="truncate">
              <h1
                className={`font-bold truncate ${
                  isPresentationMode ? 'text-base sm:text-xl' : 'text-sm sm:text-base'
                }`}
              >
                {tool.nameVi}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden md:block">
                {KNOWLEDGE_STRAND_LABELS[tool.strand]} • Chuẩn GDPT 2018 (Kết nối tri thức)
              </p>
            </div>
          </div>
        </div>

        {/* Bộ chọn Khối lớp & Chế độ Sư phạm */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Chọn khối lớp */}
          <div
            className={`inline-flex items-center rounded-xl p-0.5 border ${
              isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}
          >
            {([6, 7, 8, 9] as MathGrade[]).map((g) => {
              const supported = tool.grades.includes(String(g) as '6' | '7' | '8' | '9');
              const isSelected = activeGrade === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => onGradeChange(g)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    isSelected
                      ? 'bg-teal-600 text-white shadow-xs'
                      : supported
                      ? 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                      : 'text-slate-400 dark:text-slate-500 opacity-60'
                  }`}
                  title={supported ? `Toán lớp ${g}` : `Mở rộng cho lớp ${g}`}
                >
                  Lớp {g}
                </button>
              );
            })}
          </div>

          {/* Chọn chế độ học tập */}
          <select
            value={pedagogicalMode}
            onChange={(e) => onPedagogicalModeChange(e.target.value as PedagogicalMode)}
            aria-label="Chọn chế độ sư phạm"
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border outline-none ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {(Object.keys(PEDAGOGICAL_MODE_LABELS) as PedagogicalMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {PEDAGOGICAL_MODE_LABELS[mode]}
              </option>
            ))}
          </select>

          {/* Chuyển đổi Trình chiếu / Thực hành */}
          <button
            type="button"
            onClick={onTogglePresentationMode}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
              isPresentationMode
                ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-xs'
                : isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
            }`}
            title="Bật/tắt chế độ Giáo viên trình chiếu trên TV/Máy chiếu"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span>{isPresentationMode ? 'Đang Trình chiếu TV' : 'Chế độ Trình chiếu'}</span>
          </button>

          {/* Nút mở tiến trình 6 bước trên mobile */}
          {!isPresentationMode && (
            <button
              type="button"
              onClick={() => setShowStepDrawerMobile((v) => !v)}
              className="xl:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>6 Bước ({completedSteps.length}/6)</span>
            </button>
          )}

          {/* Reset */}
          <button
            type="button"
            onClick={handleResetAll}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
            title="Đặt lại thí nghiệm về mặc định"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>

          {/* Sáng / Tối */}
          <button
            type="button"
            onClick={onToggleDarkTheme}
            className={`p-1.5 rounded-xl border transition ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title={isDarkTheme ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối chống chói'}
          >
            {isDarkTheme ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Toàn màn hình */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-xl border transition ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Hướng dẫn sư phạm */}
          <button
            type="button"
            onClick={() => setShowHelpModal(true)}
            className={`p-1.5 rounded-xl border transition ${
              isDarkTheme
                ? 'bg-slate-800 border-slate-700 text-teal-400 hover:bg-slate-700'
                : 'bg-white border-slate-200 text-teal-700 hover:bg-teal-50'
            }`}
            title="Hướng dẫn sử dụng & Mục tiêu GDPT 2018"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* THANH CHỌN BÀI HỌC / NHIỆM VỤ MẪU */}
      <div
        className={`px-3 sm:px-5 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs ${
          isDarkTheme ? 'bg-slate-900/60 border-slate-800' : 'bg-teal-50/60 border-teal-100'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-teal-700 dark:text-teal-400 inline-flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            Kịch bản bài học mẫu:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {tool.sampleActivities.map((act) => {
              const active = act.id === activeActivity.id;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onActivityChange(act)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition border ${
                    active
                      ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                      : isDarkTheme
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
                  }`}
                >
                  {act.title}
                </button>
              );
            })}
          </div>
        </div>

        {selectedClassName && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold">
            <Users className="w-3.5 h-3.5" />
            <span>
              Lớp: {selectedClassName} {studentCount ? `(${studentCount} HS)` : ''}
            </span>
          </div>
        )}
      </div>

      {/* KHÔNG GIAN CHÍNH: VÙNG TƯƠNG TÁC TRUNG TÂM + KHUNG SƯ PHẠM 6 BƯỚC */}
      <div className="flex-1 flex flex-col xl:flex-row min-h-0 overflow-hidden">
        {/* VÙNG CANVAS TƯƠNG TÁC TRUNG TÂM */}
        <main
          className={`flex-1 min-w-0 overflow-y-auto p-3 sm:p-5 ${
            isPresentationMode ? 'text-base sm:text-lg' : ''
          }`}
        >
          {children}
        </main>

        {/* KHUNG HOẠT ĐỘNG SƯ PHẠM 6 BƯỚC (Ẩn khi ở Chế độ Trình chiếu TV toàn màn hình) */}
        {!isPresentationMode && (
          <aside
            className={`${
              showStepDrawerMobile ? 'block' : 'hidden xl:flex'
            } xl:w-96 shrink-0 border-t xl:border-t-0 xl:border-l flex-col overflow-y-auto ${
              isDarkTheme ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tiến trình khám phá 6 bước
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300">
                  {completedSteps.length}/6 hoàn thành
                </span>
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {activeActivity.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeActivity.relatedLesson}
              </p>
            </div>

            {/* Thanh tab 6 bước */}
            <div className="grid grid-cols-3 gap-1 p-2.5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
              {STEP_ORDER.map((step) => {
                const isCurrent = currentStep === step;
                const isDone = completedSteps.includes(step);
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setCurrentStep(step)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold text-left transition flex items-center justify-between ${
                      isCurrent
                        ? 'bg-teal-600 text-white shadow-xs'
                        : isDone
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{SIX_STEP_LABELS[step]}</span>
                    {isDone && <CheckCircle2 className="w-3 h-3 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>

            {/* Nội dung chi tiết của bước hiện tại */}
            <div className="p-4 flex-1 flex flex-col justify-between space-y-4 text-xs sm:text-sm">
              {currentStep === 'PREDICT' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
                    <div className="font-bold mb-1 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                      Câu hỏi dự đoán ban đầu:
                    </div>
                    <MathView
                      content={
                        activeActivity.predictionQuestion || activeActivity.prompt
                      }
                    />
                  </div>
                  {activeActivity.predictionOptions &&
                    activeActivity.predictionOptions.length > 0 && (
                      <div className="grid grid-cols-1 gap-1.5">
                        {activeActivity.predictionOptions.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setPredictionText(opt)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-left border transition ${
                              predictionText === opt
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  <div>
                    <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-300">
                      Ghi lại dự đoán của em trước khi thao tác:
                    </label>
                    <textarea
                      rows={2}
                      value={predictionText}
                      onChange={(e) => setPredictionText(e.target.value)}
                      placeholder="Nhập dự đoán của em..."
                      className={`w-full rounded-xl p-2.5 text-xs border outline-none ${
                        isDarkTheme
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => markStepComplete('PREDICT', 'MANIPULATE')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Lưu dự đoán & Chuyển sang Bước 2: Thao tác</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {currentStep === 'MANIPULATE' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 space-y-1.5">
                    <div className="font-bold text-teal-800 dark:text-teal-300">
                      Hướng dẫn thao tác trực tiếp trên mô hình:
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-xs">
                      {activeActivity.instructions.map((inst, i) => (
                        <li key={i}>
                          <MathView content={inst} />
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => markStepComplete('MANIPULATE', 'OBSERVE')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Đã thao tác xong & Sang Bước 3: Quan sát</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {currentStep === 'OBSERVE' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <div className="font-bold text-sky-800 dark:text-sky-300 mb-1">
                      Nhiệm vụ quan sát số liệu / hình ảnh:
                    </div>
                    <MathView content={activeActivity.prompt} />
                  </div>
                  <textarea
                    rows={3}
                    value={observationNotes}
                    onChange={(e) => setObservationNotes(e.target.value)}
                    placeholder="Ghi lại quy luật hoặc số liệu em quan sát được..."
                    className={`w-full rounded-xl p-2.5 text-xs border outline-none ${
                      isDarkTheme
                        ? 'bg-slate-800 border-slate-700 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => markStepComplete('OBSERVE', 'EXPLAIN')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Tiếp tục Bước 4: Giải thích toán học</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {currentStep === 'EXPLAIN' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <div className="font-bold text-indigo-800 dark:text-indigo-300 mb-1">
                      Giải thích bản chất Toán học:
                    </div>
                    <MathView content={activeActivity.explanationLatex} />
                  </div>
                  <button
                    type="button"
                    onClick={() => markStepComplete('EXPLAIN', 'CONCLUDE')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Xem Bước 5: Kết luận kiến thức chuẩn</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {currentStep === 'CONCLUDE' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                    <div className="font-extrabold text-emerald-800 dark:text-emerald-300">
                      Ghi nhớ kiến thức chuẩn GDPT 2018:
                    </div>
                    <MathView content={activeActivity.expectedOutcomeSummary} />
                    <MathView content={activeActivity.explanationLatex} />
                  </div>
                  <button
                    type="button"
                    onClick={() => markStepComplete('CONCLUDE', 'PRACTICE')}
                    className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition"
                  >
                    <span>Chuyển sang Bước 6: Câu hỏi Luyện tập</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {currentStep === 'PRACTICE' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-1">
                    <div className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      Tiêu chí hoàn thành & Đánh giá:
                    </div>
                    <MathView content={activeActivity.completionCriteria} />
                    <div className="text-[11px] text-slate-500">
                      {activeActivity.gradingRuleDescription}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Nhập kết quả / đáp án của em (gợi ý: {expectedAnswerText}):
                    </label>
                    <input
                      type="text"
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      placeholder="Nhập số hoặc biểu thức kết quả..."
                      className={`w-full rounded-xl px-3 py-2 text-xs border outline-none ${
                        isDarkTheme
                          ? 'bg-slate-800 border-slate-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleCheckPractice}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    Chấm điểm & Lưu kết quả hoạt động
                  </button>

                  {practiceSubmitted && (
                    <div
                      className={`p-3 rounded-xl border text-xs ${
                        practiceCorrect
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
                          : 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
                      }`}
                    >
                      <div className="font-bold mb-1">
                        {practiceCorrect
                          ? 'Chính xác! Em đã nắm vững bản chất toán học của hoạt động.'
                          : `Đáp án chuẩn: ${expectedAnswerText}`}
                      </div>
                      <MathView content={activeActivity.explanationLatex} />
                    </div>
                  )}
                </div>
              )}

              {/* Chân trang tóm tắt mục tiêu */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-300">Mục tiêu cần đạt: </strong>
                <MathView content={activeActivity.objective} />
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL HƯỚNG DẪN SƯ PHẠM & CHUẨN CHƯƠNG TRÌNH */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`max-w-lg w-full rounded-2xl border p-6 shadow-xl space-y-4 ${
              isDarkTheme
                ? 'bg-slate-900 border-slate-700 text-slate-100'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-xs">
                  {tool.id}
                </span>
                <span>{tool.nameVi}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800"
              >
                Đóng
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              {tool.shortDescription}
            </p>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-2">
                Tính năng tương tác cốt lõi
              </h4>
              <ul className="space-y-1.5 text-xs">
                {tool.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs space-y-1">
              <div className="font-bold text-teal-800 dark:text-teal-300">
                Mẹo sử dụng cho Giáo viên trên lớp:
              </div>
              <p>
                • Bật <strong>Chế độ Trình chiếu</strong> khi chiếu trên Tivi/Máy chiếu để phóng đại vùng đồ thị/hình học và ẩn thanh bên.
              </p>
              <p>
                • Chuyển sang <strong>Thực hành học sinh</strong> để học sinh thực hiện tuần tự 6 bước khám phá và lưu điểm tự động.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
