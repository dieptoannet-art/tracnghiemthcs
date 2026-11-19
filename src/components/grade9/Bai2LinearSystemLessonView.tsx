import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Compass,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  Lightbulb,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  AlertTriangle,
  Calculator,
  Layers,
} from 'lucide-react';
import {
  ExactRational,
  LinearSystem2x2,
  SystemSolutionType,
  makeRational,
  formatRational,
  parseRationalInput,
  solveLinearSystem2x2,
  verifySubstitutionIsolationStep,
  verifySubstitutedSingleVarEquation,
  verifyEliminationMultipliers,
  verifyEliminationCombinedEquationInput,
  verifySystemFinalAnswer,
  SUBSTITUTION_ITEMS,
  ELIMINATION_ITEMS,
  CALCULATOR_ITEMS,
  TEXTBOOK_EXERCISES_16_TO_19,
  SUPPLEMENTARY_EXERCISES,
  DIAGNOSTIC_QUIZ_6,
} from './bai2LinearSystemEngine';
import {
  ExplorerRobot3D,
  TextbookToan9Badge3D,
  CabbageGarden3DVisual,
  ThreeCasesCoordinateGraphSVG,
} from './Bai2LinearSystem3DAssets';

// Scoped localStorage key with schema version for Toán 9 Chương I Bài 2
export const BAI2_STORAGE_KEY = 'taydo_smart_edu_toan9_c1_b2_v1';

interface SavedBai2Progress {
  version: 1;
  completedActivities: number[]; // 1..6
  solvedExerciseIds: string[];
  quizAnswers: Record<string, number>;
  quizSubmitted: boolean;
  lastActivityId: number;
}

const DEFAULT_PROGRESS: SavedBai2Progress = {
  version: 1,
  completedActivities: [1, 2],
  solvedExerciseIds: [],
  quizAnswers: {},
  quizSubmitted: false,
  lastActivityId: 2,
};

function loadBai2Progress(): SavedBai2Progress {
  if (typeof window === 'undefined') return DEFAULT_PROGRESS;
  try {
    const raw = window.localStorage.getItem(BAI2_STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return DEFAULT_PROGRESS;
    return {
      version: 1,
      completedActivities: Array.isArray(parsed.completedActivities)
        ? parsed.completedActivities
        : [1, 2],
      solvedExerciseIds: Array.isArray(parsed.solvedExerciseIds) ? parsed.solvedExerciseIds : [],
      quizAnswers: parsed.quizAnswers && typeof parsed.quizAnswers === 'object' ? parsed.quizAnswers : {},
      quizSubmitted: Boolean(parsed.quizSubmitted),
      lastActivityId:
        typeof parsed.lastActivityId === 'number' &&
        parsed.lastActivityId >= 1 &&
        parsed.lastActivityId <= 6
          ? parsed.lastActivityId
          : 2,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export interface Bai2LinearSystemLessonViewProps {
  initialRole?: 'student' | 'teacher';
  allowTeacherMode?: boolean;
  onBackToCatalog?: () => void;
  onOpenLesson1?: () => void;
  onSelectLesson?: (lessonId: string) => void;
}

interface ActivityMeta {
  id: number;
  shortTitle: string;
  fullTitle: string;
  sgkPageBadge: string;
  studentObjective: string;
}

const ACTIVITIES_META: ActivityMeta[] = [
  {
    id: 1,
    shortTitle: '1. Vườn cải bắp',
    fullTitle: 'Hoạt động 1 • Mở đầu: Bài toán Vườn cải bắp',
    sgkPageBadge: 'Mở đầu • SGK trang 11',
    studentObjective: 'Lập hai phương trình từ tình huống thực tế và thu gọn xy để được hệ bậc nhất hai ẩn.',
  },
  {
    id: 2,
    shortTitle: '2. Phương pháp thế',
    fullTitle: 'Phương pháp thế • Ví dụ & Luyện tập',
    sgkPageBadge: 'Ví dụ 1 • SGK trang 11',
    studentObjective: 'Đưa hệ về phương trình một ẩn.',
  },
  {
    id: 3,
    shortTitle: '3. Phương pháp cộng đại số',
    fullTitle: 'Phương pháp cộng đại số • Ví dụ & Luyện tập',
    sgkPageBadge: 'Ví dụ 6 • SGK trang 14',
    studentObjective: 'Nhân hệ số thích hợp rồi cộng hoặc trừ từng vế để khử một ẩn.',
  },
  {
    id: 4,
    shortTitle: '4. Ba trường hợp nghiệm',
    fullTitle: 'Ba trường hợp nghiệm & Đọc thêm “Em có biết?”',
    sgkPageBadge: 'Kiến thức & Em có biết? • SGK trang 12–18',
    studentObjective: 'Phân biệt hệ có 1 nghiệm, vô nghiệm (0t = k ≠ 0) và vô số nghiệm (0t = 0).',
  },
  {
    id: 5,
    shortTitle: '5. Máy tính cầm tay',
    fullTitle: 'Sử dụng máy tính cầm tay tìm nghiệm của hệ',
    sgkPageBadge: 'Mục 3 • SGK trang 15',
    studentObjective: 'Đưa hệ về dạng chuẩn a₁x + b₁y = c₁ và kiểm tra nghiệm bằng máy tính cầm tay.',
  },
  {
    id: 6,
    shortTitle: '6. Luyện tập và vận dụng',
    fullTitle: 'Vận dụng 1–2, Bài tập 1.6–1.9, Bổ sung & Đánh giá',
    sgkPageBadge: 'Vận dụng & Bài tập • SGK trang 15–16',
    studentObjective: 'Giải trọn vẹn bài toán vườn cải bắp, pha dung dịch HCl và bài tập 1.6–1.9.',
  },
];

export const Bai2LinearSystemLessonView: React.FC<Bai2LinearSystemLessonViewProps> = ({
  initialRole = 'student',
  allowTeacherMode = true,
  onBackToCatalog,
  onOpenLesson1,
  onSelectLesson,
}) => {
  // 1. Role & Sub-mode State
  const [roleMode, setRoleMode] = useState<'student' | 'teacher'>(
    allowTeacherMode ? initialRole : 'student'
  );
  const [studentSubMode, setStudentSubMode] = useState<'guided' | 'self_practice'>('guided');
  const [isPresentationCleanMode, setIsPresentationCleanMode] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(true); // Muted by default per spec
  const [copiedStudentLink, setCopiedStudentLink] = useState<boolean>(false);
  const rootContainerRef = useRef<HTMLDivElement>(null);

  // 2. Scoped Progress State
  const [progress, setProgress] = useState<SavedBai2Progress>(() => loadBai2Progress());
  const [activeActivityId, setActiveActivityId] = useState<number>(() =>
    initialRole === 'teacher' ? 3 : 2
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(BAI2_STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore storage error
    }
  }, [progress]);

  const markActivityCompleted = (actId: number) => {
    setProgress((prev) => {
      if (prev.completedActivities.includes(actId)) return prev;
      return {
        ...prev,
        completedActivities: [...prev.completedActivities, actId].sort((a, b) => a - b),
      };
    });
  };

  const handleResetBai2Progress = () => {
    const fresh: SavedBai2Progress = {
      version: 1,
      completedActivities: [],
      solvedExerciseIds: [],
      quizAnswers: {},
      quizSubmitted: false,
      lastActivityId: activeActivityId,
    };
    setProgress(fresh);
    try {
      window.localStorage.setItem(BAI2_STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // ignore
    }
  };

  // Subtle WebAudio synthesizer (only plays if user unmutes sound)
  const playFeedbackTone = (kind: 'success' | 'warn') => {
    if (isSoundMuted || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = kind === 'success' ? 660 : 280;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {
      // ignore audio error
    }
  };

  // ============================================================================
  // ACTIVITY 1 STATE: VƯỜN CẢI BẮP (SGK trang 11)
  // ============================================================================
  const [gardenScenario, setGardenScenario] = useState<'initial' | 'change1' | 'change2'>('change1');
  const [act1Step1Simplified, setAct1Step1Simplified] = useState<boolean>(false);
  const [act1Step2Simplified, setAct1Step2Simplified] = useState<boolean>(false);
  const [act1Eq1Input, setAct1Eq1Input] = useState<string>('-3x + 8y = -84');
  const [act1Eq2Input, setAct1Eq2Input] = useState<string>('2x - 4y = 72');
  const [act1Feedback, setAct1Feedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // ============================================================================
  // ACTIVITY 2 STATE: PHƯƠNG PHÁP THẾ (SGK trang 11–12)
  // ============================================================================
  const [subItemId, setSubItemId] = useState<string>('vd1');
  const currentSubItem =
    SUBSTITUTION_ITEMS.find((it) => it.id === subItemId) || SUBSTITUTION_ITEMS[0];

  const [subChosenEq, setSubChosenEq] = useState<1 | 2>(1);
  const [subChosenVar, setSubChosenVar] = useState<'x' | 'y'>('y');
  const [subTilePlacedInSlot, setSubTilePlacedInSlot] = useState<boolean>(false);
  const [subStep1Input, setSubStep1Input] = useState<string>('');
  const [subStep2EqInput, setSubStep2EqInput] = useState<string>('');
  const [subStep2ExpandedOpen, setSubStep2ExpandedOpen] = useState<boolean>(false);
  const [subFinalStatus, setSubFinalStatus] = useState<SystemSolutionType>('unique');
  const [subFinalX, setSubFinalX] = useState<string>('');
  const [subFinalY, setSubFinalY] = useState<string>('');
  const [subCheckFeedback, setSubCheckFeedback] = useState<{
    isValid: boolean;
    messageVi: string;
    hintVi?: string;
  } | null>(null);
  const [subShowHint, setSubShowHint] = useState<boolean>(false);
  const [subRightFaq1Open, setSubRightFaq1Open] = useState<boolean>(false);
  const [subRightFaq2Open, setSubRightFaq2Open] = useState<boolean>(false);

  // Sync defaults when changing substitution sub-item
  useEffect(() => {
    setSubChosenEq(currentSubItem.defaultIsolatedEq);
    setSubChosenVar(currentSubItem.defaultIsolatedVar);
    setSubTilePlacedInSlot(false);
    setSubStep1Input('');
    setSubStep2EqInput('');
    setSubStep2ExpandedOpen(false);
    const exactSol = solveLinearSystem2x2(currentSubItem.system);
    setSubFinalStatus(exactSol.status);
    setSubFinalX('');
    setSubFinalY('');
    setSubCheckFeedback(null);
    setSubShowHint(false);
  }, [subItemId]);

  const handleCheckSubstitutionStep = () => {
    // If Step 1 input is empty, check if user clicked the tile or prompt them
    const rawStep1 = subStep1Input.trim() || (subTilePlacedInSlot ? currentSubItem.isolatedExprDisplay : '');
    const step1Check = verifySubstitutionIsolationStep(
      currentSubItem.system,
      subChosenEq,
      subChosenVar,
      rawStep1
    );
    if (!step1Check.isValid) {
      setSubCheckFeedback(step1Check);
      playFeedbackTone('warn');
      return;
    }

    // If Step 2 is open and has input, also verify Step 2 & final answer
    if (subStep2ExpandedOpen && subStep2EqInput.trim()) {
      const step2Check = verifySubstitutedSingleVarEquation(
        currentSubItem.system,
        subChosenEq,
        subChosenVar,
        subStep2EqInput
      );
      if (!step2Check.isValid) {
        setSubCheckFeedback(step2Check);
        playFeedbackTone('warn');
        return;
      }

      if (subFinalX.trim() || subFinalY.trim() || subFinalStatus === 'no_solution') {
        const finalCheck = verifySystemFinalAnswer(
          currentSubItem.system,
          subFinalStatus,
          subFinalX,
          subFinalY
        );
        setSubCheckFeedback(finalCheck);
        if (finalCheck.isValid) {
          markActivityCompleted(2);
          playFeedbackTone('success');
        } else {
          playFeedbackTone('warn');
        }
        return;
      }

      setSubCheckFeedback({
        isValid: true,
        messageVi:
          'Bước 1 và Bước 2 (thế vào phương trình còn lại) đều CHÍNH XÁC! Bây giờ em hãy nhập kết luận nghiệm của hệ.',
      });
      playFeedbackTone('success');
      return;
    }

    // Step 1 valid -> open Step 2 automatically and place tile
    setSubTilePlacedInSlot(true);
    setSubStep2ExpandedOpen(true);
    setSubCheckFeedback({
      isValid: true,
      messageVi: `${step1Check.messageVi} Tiếp theo ở Bước 2, hãy thế biểu thức vào phương trình (${
        subChosenEq === 1 ? 2 : 1
      }) và tìm nghiệm.`,
    });
    markActivityCompleted(2);
    playFeedbackTone('success');
  };

  // ============================================================================
  // ACTIVITY 3 STATE: PHƯƠNG PHÁP CỘNG ĐẠI SỐ (SGK trang 13–14)
  // ============================================================================
  const [elimItemId, setElimItemId] = useState<string>('vd6');
  const currentElimItem =
    ELIMINATION_ITEMS.find((it) => it.id === elimItemId) || ELIMINATION_ITEMS[0];

  const [elimM1Input, setElimM1Input] = useState<string>('3');
  const [elimM2Input, setElimM2Input] = useState<string>('2');
  const [elimOp, setElimOp] = useState<'add' | 'sub'>('add');
  const [elimCombinedEqInput, setElimCombinedEqInput] = useState<string>('13x = 13');
  const [elimFinalStatus, setElimFinalStatus] = useState<SystemSolutionType>('unique');
  const [elimFinalX, setElimFinalX] = useState<string>('1');
  const [elimFinalY, setElimFinalY] = useState<string>('2');
  const [elimFeedback, setElimFeedback] = useState<{
    isValid: boolean;
    messageVi: string;
    hintVi?: string;
  } | null>(null);

  useEffect(() => {
    setElimM1Input(formatRational(currentElimItem.recommendedM1));
    setElimM2Input(formatRational(currentElimItem.recommendedM2));
    setElimOp(currentElimItem.recommendedOp);
    setElimCombinedEqInput(currentElimItem.combinedEqDisplay);
    const sol = solveLinearSystem2x2(currentElimItem.system);
    setElimFinalStatus(sol.status);
    if (sol.status === 'unique' && sol.x && sol.y) {
      setElimFinalX(studentSubMode === 'guided' ? formatRational(sol.x) : '');
      setElimFinalY(studentSubMode === 'guided' ? formatRational(sol.y) : '');
    } else if (sol.status === 'infinite_solutions' && sol.parametric) {
      setElimFinalX(studentSubMode === 'guided' ? sol.parametric.xExprDisplay : '');
      setElimFinalY(studentSubMode === 'guided' ? sol.parametric.yExprDisplay : '');
    } else {
      setElimFinalX('');
      setElimFinalY('');
    }
    setElimFeedback(null);
  }, [elimItemId, studentSubMode]);

  const handleCheckEliminationStudent = () => {
    const m1 = parseRationalInput(elimM1Input) || makeRational(1);
    const m2 = parseRationalInput(elimM2Input) || makeRational(1);

    const multCheck = verifyEliminationMultipliers(currentElimItem.system, m1, m2, elimOp);
    if (!multCheck.isValid) {
      setElimFeedback(multCheck);
      playFeedbackTone('warn');
      return;
    }

    const combCheck = verifyEliminationCombinedEquationInput(
      currentElimItem.system,
      m1,
      m2,
      elimOp,
      elimCombinedEqInput
    );
    if (!combCheck.isValid) {
      setElimFeedback(combCheck);
      playFeedbackTone('warn');
      return;
    }

    const finalCheck = verifySystemFinalAnswer(
      currentElimItem.system,
      elimFinalStatus,
      elimFinalX,
      elimFinalY
    );
    setElimFeedback(finalCheck);
    if (finalCheck.isValid) {
      markActivityCompleted(3);
      playFeedbackTone('success');
    } else {
      playFeedbackTone('warn');
    }
  };

  // ============================================================================
  // TEACHER PRESENTATION STEP CONTROLS (Matching Reference Image 2)
  // ============================================================================
  const [teacherShowMultiply, setTeacherShowMultiply] = useState<boolean>(true);
  const [teacherShowAdd, setTeacherShowAdd] = useState<boolean>(true);
  const [teacherShowSolution, setTeacherShowSolution] = useState<boolean>(false);

  // Compute current teacher step (1..4) from toggles
  const teacherCurrentStep = !teacherShowMultiply
    ? 1
    : !teacherShowAdd
      ? 2
      : !teacherShowSolution
        ? 2
        : 4;

  const handleTeacherNextStep = () => {
    if (!teacherShowMultiply) {
      setTeacherShowMultiply(true);
    } else if (!teacherShowAdd) {
      setTeacherShowAdd(true);
    } else if (!teacherShowSolution) {
      setTeacherShowSolution(true);
    }
  };

  const handleTeacherPrevStep = () => {
    if (teacherShowSolution) {
      setTeacherShowSolution(false);
    } else if (teacherShowAdd) {
      setTeacherShowAdd(false);
    } else if (teacherShowMultiply) {
      setTeacherShowMultiply(false);
    }
  };

  const handleTeacherHideSolution = () => {
    setTeacherShowSolution(false);
  };

  const handleTeacherResetSteps = () => {
    setTeacherShowMultiply(true);
    setTeacherShowAdd(true);
    setTeacherShowSolution(false);
  };

  // ============================================================================
  // ACTIVITY 4 STATE: BA TRƯỜNG HỢP NGHIỆM & "EM CÓ BIẾT?" (SGK trang 12–18)
  // ============================================================================
  const [act4CaseTab, setAct4CaseTab] = useState<'unique' | 'no_solution' | 'infinite_solutions'>('unique');
  const [emCoBietExpanded, setEmCoBietExpanded] = useState<boolean>(true);

  const act4DemoSystem: LinearSystem2x2 =
    act4CaseTab === 'unique'
      ? SUBSTITUTION_ITEMS[0].system // { 2x - y = 3 ; x + 2y = 4 } -> (2; 1)
      : act4CaseTab === 'no_solution'
        ? SUBSTITUTION_ITEMS[2].system // { x - y = -2 ; 2x - 2y = 8 } -> vô nghiệm
        : SUBSTITUTION_ITEMS[3].system; // { -x + y = -2 ; 3x - 3y = 6 } -> vô số nghiệm

  // ============================================================================
  // ACTIVITY 5 STATE: MÁY TÍNH CẦM TAY (SGK trang 15)
  // ============================================================================
  const [calcModeTab, setCalcModeTab] = useState<'coeff_table' | 'key_sequence'>('coeff_table');
  const [selectedCalcItemId, setSelectedCalcItemId] = useState<string>('calc_vd');
  const [calcCoeffs, setCalcCoeffs] = useState<{
    a1: string;
    b1: string;
    c1: string;
    a2: string;
    b2: string;
    c2: string;
  }>({
    a1: '2',
    b1: '3',
    c1: '4',
    a2: '5',
    b2: '6',
    c2: '7',
  });

  const handleSelectCalcPreset = (itemId: string) => {
    setSelectedCalcItemId(itemId);
    const found = CALCULATOR_ITEMS.find((c) => c.id === itemId);
    if (!found) return;
    setCalcCoeffs({
      a1: formatRational(found.system.eq1.a, 'vi_decimal_if_clean'),
      b1: formatRational(found.system.eq1.b, 'vi_decimal_if_clean'),
      c1: formatRational(found.system.eq1.c, 'vi_decimal_if_clean'),
      a2: formatRational(found.system.eq2.a, 'vi_decimal_if_clean'),
      b2: formatRational(found.system.eq2.b, 'vi_decimal_if_clean'),
      c2: formatRational(found.system.eq2.c, 'vi_decimal_if_clean'),
    });
    markActivityCompleted(5);
  };

  const liveCalculatorSystem: LinearSystem2x2 | null = (() => {
    const a1 = parseRationalInput(calcCoeffs.a1);
    const b1 = parseRationalInput(calcCoeffs.b1);
    const c1 = parseRationalInput(calcCoeffs.c1);
    const a2 = parseRationalInput(calcCoeffs.a2);
    const b2 = parseRationalInput(calcCoeffs.b2);
    const c2 = parseRationalInput(calcCoeffs.c2);
    if (!a1 || !b1 || !c1 || !a2 || !b2 || !c2) return null;
    return {
      eq1: { a: a1, b: b1, c: c1 },
      eq2: { a: a2, b: b2, c: c2 },
    };
  })();

  const liveCalculatorResult = liveCalculatorSystem
    ? solveLinearSystem2x2(liveCalculatorSystem)
    : null;

  // ============================================================================
  // ACTIVITY 6 STATE: VẬN DỤNG 1 & 2, BÀI TẬP 1.6–1.9, 12 CÂU BỔ SUNG, PHIẾU CUỐI BÀI
  // ============================================================================
  const [act6SubTab, setAct6SubTab] = useState<
    'van_dung' | 'sgk_16_19' | 'bo_sung_12' | 'phieu_danh_gia'
  >('van_dung');
  const [selectedExId, setSelectedExId] = useState<string>('bt_1_6_a');
  const allExercises = [...TEXTBOOK_EXERCISES_16_TO_19, ...SUPPLEMENTARY_EXERCISES];
  const currentExercise =
    allExercises.find((e) => e.id === selectedExId) || TEXTBOOK_EXERCISES_16_TO_19[0];

  const [exStatusChoice, setExStatusChoice] = useState<SystemSolutionType>('unique');
  const [exXInput, setExXInput] = useState<string>('');
  const [exYInput, setExYInput] = useState<string>('');
  const [exFeedback, setExFeedback] = useState<{
    isValid: boolean;
    messageVi: string;
    hintVi?: string;
  } | null>(null);
  const [exShowGuide, setExShowGuide] = useState<boolean>(false);

  useEffect(() => {
    setExStatusChoice('unique');
    setExXInput('');
    setExYInput('');
    setExFeedback(null);
    setExShowGuide(false);
  }, [selectedExId]);

  const handleVerifyExerciseAnswer = () => {
    const check = verifySystemFinalAnswer(
      currentExercise.system,
      exStatusChoice,
      exXInput,
      exYInput
    );
    setExFeedback(check);
    if (check.isValid) {
      setProgress((prev) => ({
        ...prev,
        solvedExerciseIds: prev.solvedExerciseIds.includes(currentExercise.id)
          ? prev.solvedExerciseIds
          : [...prev.solvedExerciseIds, currentExercise.id],
      }));
      markActivityCompleted(6);
      playFeedbackTone('success');
    } else {
      playFeedbackTone('warn');
    }
  };

  // End-of-lesson 6-question quiz handlers
  const handleSelectQuizOption = (qId: string, optIdx: number) => {
    setProgress((prev) => ({
      ...prev,
      quizAnswers: { ...prev.quizAnswers, [qId]: optIdx },
    }));
  };

  const handleSubmitDiagnosticQuiz = () => {
    setProgress((prev) => ({
      ...prev,
      quizSubmitted: true,
    }));
    markActivityCompleted(6);
    playFeedbackTone('success');
  };

  const currentActivityMeta =
    ACTIVITIES_META.find((a) => a.id === activeActivityId) || ACTIVITIES_META[1];

  // Toggle Fullscreen Presentation Mode
  const handleTogglePresentationMode = () => {
    const next = !isPresentationCleanMode;
    setIsPresentationCleanMode(next);
    if (next && rootContainerRef.current && !document.fullscreenElement) {
      rootContainerRef.current.requestFullscreen?.().catch(() => {});
    } else if (!next && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  // ============================================================================
  // RENDER HELPERS FOR EACH OF THE 6 ACTIVITIES (STUDENT & TEACHER STAGE)
  // ============================================================================

  const renderActivity1CabbageGarden = () => (
    <div className="space-y-4">
      {/* Scenario Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setGardenScenario('initial')}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
              gardenScenario === 'initial'
                ? 'bg-[#195E3E] text-white border-[#195E3E] shadow-xs'
                : 'bg-[#FAF8F2] text-[#163628] border-[#D5CFC0] hover:bg-[#EFECE2]'
            }`}
          >
            1. Khu vườn ban đầu (x luống, y cây/luống)
          </button>
          <button
            type="button"
            onClick={() => setGardenScenario('change1')}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
              gardenScenario === 'change1'
                ? 'bg-[#195E3E] text-white border-[#195E3E] shadow-xs'
                : 'bg-[#FAF8F2] text-[#163628] border-[#D5CFC0] hover:bg-[#EFECE2]'
            }`}
          >
            2. Thay đổi 1: Tăng 8 luống, bớt 3 cây/luống
          </button>
          <button
            type="button"
            onClick={() => setGardenScenario('change2')}
            className={`min-h-[42px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
              gardenScenario === 'change2'
                ? 'bg-[#195E3E] text-white border-[#195E3E] shadow-xs'
                : 'bg-[#FAF8F2] text-[#163628] border-[#D5CFC0] hover:bg-[#EFECE2]'
            }`}
          >
            3. Thay đổi 2: Giảm 4 luống, thêm 2 cây/luống
          </button>
        </div>
      </div>

      {/* 3D Garden Model (Never reveals final answer 60, 12, 720 in Activity 1!) */}
      <CabbageGarden3DVisual scenario={gardenScenario} showSolvedVerification={false} />

      {/* Algebraic Modeling & Cancelling xy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Equation 1 Card */}
        <div className="rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#E6F4EA] text-[#195E3E] text-xs font-extrabold">
              Dữ kiện 1: Tăng 8 luống, mỗi luống ít đi 3 cây
            </span>
            <button
              type="button"
              onClick={() => {
                setAct1Step1Simplified((prev) => !prev);
                markActivityCompleted(1);
              }}
              className="px-3 py-1 rounded-lg bg-[#E07A16] hover:bg-[#C6690F] text-white text-xs font-bold cursor-pointer"
            >
              {act1Step1Simplified ? 'Ẩn thu gọn xy' : 'Khai triển & Khử xy'}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[#E2DDD0] font-serif text-base sm:text-lg font-bold text-[#102A43] text-center">
            (x + 8)(y − 3) = xy − 108
          </div>
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-medium">
            ⚠️ Chú ý: Phương trình trên còn chứa tích <strong>xy</strong> nên <strong>chưa phải</strong> phương trình bậc nhất hai ẩn.
          </p>
          {act1Step1Simplified && (
            <div className="p-3 rounded-xl bg-[#ECFDF5] border border-emerald-300 space-y-1 text-xs sm:text-sm text-[#064E3B]">
              <p className="font-semibold">• Khai triển: xy − 3x + 8y − 24 = xy − 108</p>
              <p className="font-bold text-sm sm:text-base text-[#195E3E]">
                • Thu gọn xy ở hai vế: −3x + 8y = −84 (hoặc 3x − 8y = 84) (1)
              </p>
            </div>
          )}
        </div>

        {/* Equation 2 Card */}
        <div className="rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E] text-xs font-extrabold">
              Dữ kiện 2: Giảm 4 luống, mỗi luống thêm 2 cây
            </span>
            <button
              type="button"
              onClick={() => {
                setAct1Step2Simplified((prev) => !prev);
                markActivityCompleted(1);
              }}
              className="px-3 py-1 rounded-lg bg-[#195E3E] hover:bg-[#134830] text-white text-xs font-bold cursor-pointer"
            >
              {act1Step2Simplified ? 'Ẩn thu gọn xy' : 'Khai triển & Khử xy'}
            </button>
          </div>
          <div className="p-3 rounded-xl bg-white border border-[#E2DDD0] font-serif text-base sm:text-lg font-bold text-[#102A43] text-center">
            (x − 4)(y + 2) = xy + 64
          </div>
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 font-medium">
            ⚠️ Chú ý: Chỉ sau khi khai triển và triệt tiêu <strong>xy</strong> ở hai vế, ta mới thu được phương trình bậc nhất hai ẩn.
          </p>
          {act1Step2Simplified && (
            <div className="p-3 rounded-xl bg-[#ECFDF5] border border-emerald-300 space-y-1 text-xs sm:text-sm text-[#064E3B]">
              <p className="font-semibold">• Khai triển: xy + 2x − 4y − 8 = xy + 64</p>
              <p className="font-bold text-sm sm:text-base text-[#195E3E]">
                • Thu gọn xy ở hai vế: 2x − 4y = 72 (hoặc x − 2y = 36) (2)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Resulting Linear System Summary (Without revealing final numbers 60, 12, 720) */}
      <div className="rounded-2xl border-2 border-[#195E3E]/30 bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-extrabold uppercase tracking-wider text-[#195E3E]">
            Hệ hai phương trình bậc nhất hai ẩn thu được:
          </div>
          <div className="font-serif text-xl sm:text-2xl font-bold text-[#102A43] flex items-center gap-2">
            <span className="text-3xl font-light text-[#195E3E]">{'{'}</span>
            <div>
              <div>−3x + 8y = −84 &nbsp;(1)</div>
              <div>2x − 4y = 72 &nbsp;&nbsp;&nbsp;&nbsp;(2)</div>
            </div>
          </div>
          <p className="text-xs text-[#475569] font-medium">
            ❓ Câu hỏi đặt ra: Làm thế nào để tìm nghiệm chung (x; y) của hệ phương trình này? Hãy khám phá <strong>Phương pháp thế</strong> và <strong>Phương pháp cộng đại số</strong>, sau đó giải trọn vẹn ở <strong>Vận dụng 1 (Mục 6)</strong>!
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            markActivityCompleted(1);
            setActiveActivityId(2);
          }}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#237A50] to-[#175839] text-white font-bold text-xs sm:text-sm shadow-md hover:brightness-105 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <span>Sang Mục 2: Phương pháp thế</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER ACTIVITY 2: PHƯƠNG PHÁP THẾ (Matching Reference Image 1 `image_2e624df4.png`)
  // ============================================================================
  const renderActivity2SubstitutionStudent = () => (
    <div className="space-y-4">
      {/* Sub-item selector pills: Ví dụ 1 (Trọng tâm), HĐ1, Ví dụ 2, Ví dụ 3, Luyện tập 1a, 1b, 2, 3 */}
      <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#E2DDD0]">
        {SUBSTITUTION_ITEMS.map((item) => {
          const active = item.id === currentSubItem.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSubItemId(item.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                active
                  ? 'bg-[#195E3E] text-white shadow-xs'
                  : 'bg-[#EFECE2] text-[#2B4336] hover:bg-[#E4DFD1]'
              }`}
            >
              {item.id === 'vd1'
                ? '⭐ Ví dụ 1 (Tr. 11)'
                : item.id === 'hd1'
                  ? 'HĐ1 (Tr. 11)'
                  : item.id === 'vd2'
                    ? 'Ví dụ 2 (Vô nghiệm)'
                    : item.id === 'vd3'
                      ? 'Ví dụ 3 (Vô số nghiệm)'
                      : item.badge.split('•')[0].trim()}
            </button>
          );
        })}
      </div>

      {/* Main 3D Stage (Exact Layout of Reference Image 1 `image_2e624df4.png`) */}
      <div className="relative rounded-2xl border border-[#DDD6C6] bg-gradient-to-b from-[#FAF8F3] to-[#F1EDE2] p-4 sm:p-5 shadow-inner">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Left: 3D Robot Mascot */}
          <div className="md:col-span-4 flex flex-col items-center justify-center">
            <ExplorerRobot3D
              mood={subCheckFeedback && !subCheckFeedback.isValid ? 'thinking' : 'happy'}
              className="w-36 h-44 sm:w-44 sm:h-52"
            />
          </div>

          {/* Right: System of Equations + 3D Ceramic Tiles + Bracket Slot */}
          <div className="md:col-span-8 flex flex-col items-center space-y-4">
            {/* System with Curly Brace */}
            <div className="flex items-center gap-3 sm:gap-5 px-5 py-3 rounded-2xl bg-white/85 border border-[#E5DEC9] shadow-2xs">
              <span className="font-serif text-5xl sm:text-6xl font-light text-[#102A43] leading-none select-none">
                {'{'}
              </span>
              <div className="space-y-2 font-serif text-xl sm:text-[26px] font-bold text-[#102A43] tracking-wide">
                <div className="flex items-center justify-between gap-8">
                  <span>{currentSubItem.systemDisplay[0]}</span>
                  <span className="text-base sm:text-xl font-semibold text-[#475569]">(1)</span>
                </div>
                <div className="flex items-center justify-between gap-8">
                  <span>{currentSubItem.systemDisplay[1]}</span>
                  <span className="text-base sm:text-xl font-semibold text-[#475569]">(2)</span>
                </div>
              </div>
            </div>

            {/* 3D Ceramic Tiles: [ y ] = [ 2x - 3 ] */}
            <div className="relative flex flex-wrap items-center justify-center gap-3">
              {/* Green Ceramic Tile [ y ] or [ x ] */}
              <div className="min-w-[68px] h-[54px] px-4 rounded-2xl bg-gradient-to-b from-[#A7D8A0] to-[#74B56B] border-2 border-[#5A9952] shadow-[0_5px_0_#467D3F] flex items-center justify-center font-serif italic font-bold text-2xl sm:text-3xl text-[#0F2918]">
                {currentSubItem.defaultIsolatedVar}
              </div>

              <span className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">=</span>

              {/* Orange Clickable/Draggable Ceramic Tile [ 2x - 3 ] */}
              <button
                type="button"
                onClick={() => {
                  setSubTilePlacedInSlot(true);
                  setSubStep1Input(currentSubItem.isolatedExprDisplay);
                  setSubStep2ExpandedOpen(true);
                  playFeedbackTone('success');
                }}
                title="Bấm để thế biểu thức này vào dấu ngoặc bên dưới"
                className="min-w-[136px] h-[54px] px-5 rounded-2xl bg-gradient-to-b from-[#FFCA80] via-[#F7A84B] to-[#E5851E] border-2 border-[#C96E0E] shadow-[0_5px_0_#A65606] hover:brightness-105 active:translate-y-0.5 flex items-center justify-center font-serif font-extrabold text-2xl sm:text-[27px] text-[#1C1917] cursor-pointer transition-all"
              >
                {currentSubItem.isolatedExprDisplay}
              </button>
            </div>

            {/* Curved Orange Arrow SVG pointing into parentheses */}
            <svg viewBox="0 0 180 42" className="w-36 h-9 -my-2 pointer-events-none" aria-hidden="true">
              <path
                d="M 118 4 Q 88 12 76 34"
                fill="none"
                stroke="#EA7B15"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <polygon points="71,29 74,39 83,33" fill="#EA7B15" />
            </svg>

            {/* Cream Ceramic Equation Slot Bar: x + 2( [ ... ] ) = 4 */}
            <div className="w-full max-w-md px-5 py-3.5 rounded-2xl bg-gradient-to-b from-[#FBF9F2] to-[#EAE3D2] border-2 border-[#D5CCB8] shadow-[0_6px_0_#C2B79F] flex items-center justify-center gap-1.5 font-serif text-xl sm:text-[27px] font-bold text-[#102A43]">
              <span>{currentSubItem.substitutedTemplatePrefix}</span>
              <button
                type="button"
                onClick={() => {
                  setSubTilePlacedInSlot((prev) => !prev);
                  if (!subStep1Input) setSubStep1Input(currentSubItem.isolatedExprDisplay);
                }}
                className={`min-w-[118px] min-h-[42px] px-3 py-1 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  subTilePlacedInSlot
                    ? 'bg-[#FFF3DC] border-[#E5851E] text-[#B45309] font-extrabold shadow-inner'
                    : 'bg-[#EFECE3] border-[#C8BFA8] text-[#94A3B8] text-sm font-sans font-semibold'
                }`}
              >
                {subTilePlacedInSlot ? currentSubItem.isolatedExprDisplay : 'Bấm thẻ để thế'}
              </button>
              <span>{currentSubItem.substitutedTemplateSuffix}</span>
            </div>
          </div>
        </div>

        {/* Step 1 & Step 2 Interactive Cards (Matching Reference Image 1) */}
        <div className="mt-5 space-y-3">
          {/* Bước 1 Card */}
          <div className="rounded-2xl border border-[#C6D9C7] bg-[#F7FAF7] overflow-hidden shadow-2xs">
            <div className="bg-[#DFEFE2] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#C6D9C7]">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#195E3E] text-white text-xs font-extrabold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm sm:text-[15px] font-bold text-[#102A43]">
                  Bước 1: Biểu diễn <em className="font-serif">{subChosenVar}</em> theo{' '}
                  <em className="font-serif">{subChosenVar === 'y' ? 'x' : 'y'}</em> từ phương trình ({subChosenEq}).
                </span>
              </div>

              {/* Allow switching which variable/equation to isolate (per prompt requirement) */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSubChosenEq(currentSubItem.defaultIsolatedEq);
                    setSubChosenVar(currentSubItem.defaultIsolatedVar);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    subChosenVar === currentSubItem.defaultIsolatedVar &&
                    subChosenEq === currentSubItem.defaultIsolatedEq
                      ? 'bg-[#195E3E] text-white'
                      : 'bg-white text-[#195E3E] border border-[#B7D4BC]'
                  }`}
                >
                  Cách 1: Rút {currentSubItem.defaultIsolatedVar} từ ({currentSubItem.defaultIsolatedEq})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const altVar = currentSubItem.defaultIsolatedVar === 'y' ? 'x' : 'y';
                    const altEq = currentSubItem.defaultIsolatedEq === 1 ? 2 : 1;
                    setSubChosenVar(altVar);
                    setSubChosenEq(altEq);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                    subChosenVar !== currentSubItem.defaultIsolatedVar ||
                    subChosenEq !== currentSubItem.defaultIsolatedEq
                      ? 'bg-[#195E3E] text-white'
                      : 'bg-white text-[#195E3E] border border-[#B7D4BC]'
                  }`}
                >
                  Cách 2: Rút {currentSubItem.defaultIsolatedVar === 'y' ? 'x' : 'y'} từ (
                  {currentSubItem.defaultIsolatedEq === 1 ? 2 : 1})
                </button>
              </div>
            </div>

            <div className="p-3.5 sm:px-6 flex flex-wrap items-center justify-center sm:justify-start gap-3 bg-[#FAF9F4]">
              <label
                htmlFor="sub-step1-input"
                className="font-serif italic font-bold text-xl sm:text-2xl text-[#102A43]"
              >
                {subChosenVar} =
              </label>
              <input
                id="sub-step1-input"
                type="text"
                value={subStep1Input}
                onChange={(e) => setSubStep1Input(e.target.value)}
                placeholder={
                  studentSubMode === 'guided'
                    ? `Nhập biểu thức (ví dụ: ${currentSubItem.isolatedExprDisplay})`
                    : 'Nhập biểu thức đại số...'
                }
                className="flex-1 max-w-md min-h-[44px] px-4 py-2 rounded-xl border-2 border-[#4B8B64] bg-white text-[#102A43] font-medium text-sm sm:text-base focus:outline-hidden focus:ring-2 focus:ring-[#195E3E]"
              />
              {studentSubMode === 'guided' && (
                <button
                  type="button"
                  onClick={() => {
                    setSubStep1Input(currentSubItem.isolatedExprDisplay);
                    setSubTilePlacedInSlot(true);
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#E9F5EC] hover:bg-[#D6ECDC] text-[#195E3E] text-xs font-bold border border-[#B7D4BC] cursor-pointer"
                >
                  Điền nhanh mẫu
                </button>
              )}
            </div>
          </div>

          {/* Bước 2 Accordion / Card */}
          <div className="rounded-2xl border border-[#D8D2C3] bg-[#F5F2EA] overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setSubStep2ExpandedOpen((prev) => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer hover:bg-[#ECE7DA] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#64748B] text-white text-xs font-extrabold flex items-center justify-center">
                  2
                </span>
                <span className="text-sm sm:text-[15px] font-bold text-[#102A43]">
                  Bước 2: Thế vào phương trình ({subChosenEq === 1 ? 2 : 1}) và kết luận nghiệm.
                </span>
              </div>
              {subStep2ExpandedOpen ? (
                <ChevronUp className="w-5 h-5 text-[#475569]" />
              ) : (
                <ChevronDown className="w-5 h-5 text-[#475569]" />
              )}
            </button>

            {subStep2ExpandedOpen && (
              <div className="p-4 bg-white border-t border-[#D8D2C3] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <label className="text-xs sm:text-sm font-bold text-[#102A43] sm:w-52 shrink-0">
                    Phương trình 1 ẩn sau khi thế:
                  </label>
                  <input
                    type="text"
                    value={subStep2EqInput}
                    onChange={(e) => setSubStep2EqInput(e.target.value)}
                    placeholder={`Ví dụ: ${currentSubItem.simplifiedSingleVarEq}`}
                    className="flex-1 min-h-[42px] px-3.5 py-1.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-sm font-semibold text-[#102A43]"
                  />
                  {studentSubMode === 'guided' && (
                    <button
                      type="button"
                      onClick={() => setSubStep2EqInput(currentSubItem.simplifiedSingleVarEq)}
                      className="min-h-[38px] px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                    >
                      Điền {currentSubItem.simplifiedSingleVarEq}
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <span className="text-xs sm:text-sm font-bold text-[#102A43]">Kết luận số nghiệm:</span>
                  {(['unique', 'no_solution', 'infinite_solutions'] as SystemSolutionType[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSubFinalStatus(st)}
                        className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                          subFinalStatus === st
                            ? 'bg-[#195E3E] text-white border-[#195E3E]'
                            : 'bg-[#FAF8F2] text-[#102A43] border-[#D5CFC0]'
                        }`}
                      >
                        {st === 'unique'
                          ? 'Có nghiệm duy nhất (x; y)'
                          : st === 'no_solution'
                            ? 'Vô nghiệm'
                            : 'Vô số nghiệm (theo t ∈ ℝ)'}
                      </button>
                    )
                  )}
                </div>

                {subFinalStatus !== 'no_solution' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-xs sm:text-sm font-bold text-[#102A43]">
                      x ={' '}
                      <input
                        type="text"
                        value={subFinalX}
                        onChange={(e) => setSubFinalX(e.target.value)}
                        placeholder={subFinalStatus === 'infinite_solutions' ? 't' : '2'}
                        className="w-28 min-h-[40px] ml-1 px-3 py-1 rounded-xl border border-[#CBD5E1] font-bold text-[#102A43]"
                      />
                    </label>
                    <label className="text-xs sm:text-sm font-bold text-[#102A43]">
                      y ={' '}
                      <input
                        type="text"
                        value={subFinalY}
                        onChange={(e) => setSubFinalY(e.target.value)}
                        placeholder={subFinalStatus === 'infinite_solutions' ? 't - 2' : '1'}
                        className="w-28 min-h-[40px] ml-1 px-3 py-1 rounded-xl border border-[#CBD5E1] font-bold text-[#102A43]"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feedback Banner */}
        {subCheckFeedback && (
          <div
            role="status"
            className={`mt-3 p-3.5 rounded-2xl border text-xs sm:text-sm font-semibold flex items-start gap-2.5 ${
              subCheckFeedback.isValid
                ? 'bg-[#ECFDF5] border-emerald-300 text-[#065F46]'
                : 'bg-[#FFF7ED] border-amber-300 text-[#9A3412]'
            }`}
          >
            {subCheckFeedback.isValid ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-bold">{subCheckFeedback.messageVi}</p>
              {subCheckFeedback.hintVi && <p className="text-xs opacity-90">{subCheckFeedback.hintVi}</p>}
            </div>
          </div>
        )}

        {/* Hint Drawer */}
        {subShowHint && (
          <div className="mt-3 p-3.5 rounded-2xl bg-[#FFFBEB] border border-amber-300 text-xs sm:text-sm text-amber-950 space-y-1">
            <div className="font-extrabold text-amber-900">💡 Hướng dẫn từng bước ({currentSubItem.badge}):</div>
            <p>• Bước 1: Biểu diễn {currentSubItem.defaultIsolatedVar} = {currentSubItem.isolatedExprDisplay}.</p>
            <p>
              • Bước 2: Thế vào phương trình còn lại: {currentSubItem.substitutedTemplatePrefix}
              {currentSubItem.isolatedExprDisplay}
              {currentSubItem.substitutedTemplateSuffix} ⇔ {currentSubItem.simplifiedSingleVarEq}.
            </p>
            <p>• Bước 3: {currentSubItem.singleVarStepResult}. {currentSubItem.backSubResult}</p>
            <p className="font-bold text-[#195E3E]">• Kết luận: {currentSubItem.conclusionDisplay}</p>
          </div>
        )}

        {/* Bottom 3 Action Buttons: Kiểm tra bước | Gợi ý | Làm lại (Matching Reference Image 1) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleCheckSubstitutionStep}
            className="min-h-[46px] px-6 py-2.5 rounded-2xl bg-gradient-to-b from-[#237A50] to-[#144B30] hover:brightness-105 text-white font-bold text-sm sm:text-base shadow-[0_5px_0_#0D3320] active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-5 h-5 stroke-[2.8]" />
            <span>Kiểm tra bước</span>
          </button>

          <button
            type="button"
            onClick={() => setSubShowHint((prev) => !prev)}
            className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#FAF8F2] to-[#E6E0D0] hover:bg-[#EFECE2] text-[#1C2D24] font-bold text-sm sm:text-base border border-[#C9C1B0] shadow-[0_4px_0_#B8AF9C] active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
          >
            <Lightbulb className="w-4 h-4 text-[#D97706]" />
            <span>Gợi ý</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSubTilePlacedInSlot(false);
              setSubStep1Input('');
              setSubStep2EqInput('');
              setSubFinalX('');
              setSubFinalY('');
              setSubCheckFeedback(null);
              setSubShowHint(false);
            }}
            className="min-h-[46px] px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#FAF8F2] to-[#E6E0D0] hover:bg-[#EFECE2] text-[#1C2D24] font-bold text-sm sm:text-base border border-[#C9C1B0] shadow-[0_4px_0_#B8AF9C] active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#195E3E]" />
            <span>Làm lại</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER ACTIVITY 3: PHƯƠNG PHÁP CỘNG ĐẠI SỐ
  // Supports both Teacher Presentation View (`image_9bfd356d.png`) and Student Interactive View
  // ============================================================================
  const renderActivity3Elimination = () => {
    const isTeacherView = roleMode === 'teacher';

    return (
      <div className="space-y-4">
        {/* Sub-item selector pills: Ví dụ 6 (Trọng tâm), HĐ2, Ví dụ 4, Ví dụ 5, Ví dụ 7, Luyện tập 4a, 4b, 5, 6 */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[#E2DDD0]">
          {ELIMINATION_ITEMS.map((item) => {
            const active = item.id === currentElimItem.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setElimItemId(item.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#195E3E] text-white shadow-xs'
                    : 'bg-[#EFECE2] text-[#2B4336] hover:bg-[#E4DFD1]'
                }`}
              >
                {item.id === 'vd6'
                  ? '⭐ Ví dụ 6 (Tr. 14)'
                  : item.id === 'hd2'
                    ? 'HĐ2 (Tr. 13)'
                    : item.id === 'vd4'
                      ? 'Ví dụ 4 (Đối nhau)'
                      : item.id === 'vd5'
                        ? 'Ví dụ 5 (Bằng nhau)'
                        : item.id === 'vd7'
                          ? 'Ví dụ 7 (Vô số nghiệm)'
                          : item.badge.split('•')[0].trim()}
              </button>
            );
          })}
        </div>

        {/* Main 3D Whiteboard & Wooden Desk Stage (Exact Match for Reference Image 2 `image_9bfd356d.png`) */}
        <div className="relative rounded-2xl border-2 border-[#D2CABB] bg-gradient-to-b from-[#FAF8F2] via-[#F5F2E8] to-[#E6DEC8] p-4 sm:p-6 shadow-md">
          {/* Title Banner on Whiteboard */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex items-center px-6 py-2 rounded-2xl bg-[#FAF8F2] border-2 border-[#D9D2C2] shadow-sm">
              <span className="w-1.5 h-6 rounded-full bg-[#EA851B] mr-3" />
              <h3 className="text-lg sm:text-2xl font-extrabold text-[#102A43] font-serif">
                {currentElimItem.title}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Left: 3D Robot with Ceramic Tiles x, y */}
            <div className="md:col-span-4 flex flex-col items-center justify-end">
              <ExplorerRobot3D
                mood="happy"
                showCeramicTiles={true}
                className="w-40 h-48 sm:w-48 sm:h-56"
              />
            </div>

            {/* Center/Right: System & Step-by-Step Algebraic Addition */}
            <div className="md:col-span-8 flex flex-col items-center space-y-4">
              {/* Original System with Curly Brace */}
              <div className="flex items-center gap-3 sm:gap-4 px-5 py-2.5 rounded-2xl bg-white/80 border border-[#E5DEC9]">
                <span className="font-serif text-5xl sm:text-6xl font-light text-[#102A43] leading-none select-none">
                  {'{'}
                </span>
                <div className="space-y-1.5 font-serif text-2xl sm:text-[31px] font-bold text-[#102A43]">
                  <div>{currentElimItem.systemDisplay[0]}</div>
                  <div>{currentElimItem.systemDisplay[1]}</div>
                </div>
              </div>

              {/* Step 1: Nhân hai phương trình (Shown when teacherShowMultiply is true or in Student Mode) */}
              {(teacherShowMultiply || !isTeacherView) && (
                <div className="w-full max-w-xl space-y-2.5 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-[#DCECE0] text-[#163628] text-xs sm:text-sm font-bold border border-[#BBD6C2]">
                      Nhân phương trình (1) với {formatRational(currentElimItem.recommendedM1)}
                    </span>
                    <span className="hidden sm:inline text-slate-500 font-bold">→</span>
                    {currentElimItem.id === 'vd6' ? (
                      <div className="font-serif text-2xl sm:text-[28px] font-bold text-[#102A43] flex items-center gap-1.5">
                        <span>9x +</span>
                        <span className="px-2 py-0.5 rounded-xl bg-[#EAF7EC] border-2 border-[#EA851B] text-[#195E3E]">
                          6y
                        </span>
                        <span>= 21</span>
                      </div>
                    ) : (
                      <div className="font-serif text-xl sm:text-2xl font-bold text-[#102A43]">
                        {currentElimItem.scaledEq1Display}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="px-3.5 py-1.5 rounded-xl bg-[#DCECE0] text-[#163628] text-xs sm:text-sm font-bold border border-[#BBD6C2]">
                      Nhân phương trình (2) với {formatRational(currentElimItem.recommendedM2)}
                    </span>
                    <span className="font-extrabold text-xl text-[#102A43]">
                      {currentElimItem.recommendedOp === 'add' ? '+' : '−'}
                    </span>
                    {currentElimItem.id === 'vd6' ? (
                      <div className="font-serif text-2xl sm:text-[28px] font-bold text-[#102A43] flex items-center gap-1.5">
                        <span>4x −</span>
                        <span className="px-2 py-0.5 rounded-xl bg-[#EAF7EC] border-2 border-[#EA851B] text-[#195E3E]">
                          6y
                        </span>
                        <span>= −8</span>
                      </div>
                    ) : (
                      <div className="font-serif text-xl sm:text-2xl font-bold text-[#102A43]">
                        {currentElimItem.scaledEq2Display}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#FFF3DC] border-2 border-[#EA851B] text-[#9A3412] text-xs sm:text-sm font-extrabold shadow-2xs">
                      <span>⚡ {currentElimItem.eliminatedCallout}</span>
                    </span>
                  </div>
                </div>
              )}

              {/* Step 2: Cộng / trừ từng vế hai phương trình */}
              {(teacherShowAdd || !isTeacherView) && (
                <div className="w-full max-w-xl flex flex-col items-center space-y-2.5">
                  <div className="w-full max-w-xs h-0.5 bg-[#102A43]" />
                  <div className="font-serif text-2xl sm:text-[32px] font-bold text-[#102A43] tracking-wider">
                    {currentElimItem.combinedEqDisplay}
                  </div>
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#DCECE0] border border-[#9CC5A6] text-xs sm:text-sm font-bold text-[#163628]">
                    <CheckCircle2 className="w-4 h-4 text-[#195E3E]" />
                    <span>Đã hiện: Nhân và cộng hai phương trình (giữ kèm 1 PT của hệ để tìm ẩn còn lại)</span>
                  </div>
                </div>
              )}

              {/* Step 3: Hiện nghiệm hoặc Câu hỏi gợi mở trên bảng */}
              {teacherShowSolution ? (
                <div className="w-full max-w-xl p-4 rounded-2xl bg-[#ECFDF5] border-2 border-[#195E3E] text-[#064E3B] space-y-1.5 shadow-sm">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-[#195E3E]">
                    ✓ Bước 3 &amp; 4: Giải phương trình một ẩn và tìm nghiệm của hệ
                  </div>
                  <p className="text-sm sm:text-base font-bold">{currentElimItem.stepSolveFirstVar}</p>
                  <p className="text-sm sm:text-base font-semibold">{currentElimItem.stepSolveSecondVar}</p>
                  <p className="text-base sm:text-lg font-extrabold text-[#195E3E]">
                    {currentElimItem.conclusionDisplay}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTeacherShowSolution(true)}
                  className="w-full max-w-xl px-5 py-3 rounded-2xl bg-gradient-to-b from-[#FFF6E5] to-[#F7E5C4] border-2 border-[#DFB06B] shadow-sm flex items-center justify-center gap-3 cursor-pointer hover:brightness-102"
                >
                  <span className="w-7 h-7 rounded-full bg-[#EA851B] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                    ?
                  </span>
                  <span className="text-sm sm:text-lg font-extrabold text-[#102A43]">
                    Tiếp theo, em tìm <em className="font-serif">x</em> và <em className="font-serif">y</em> như thế nào?
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Student Interactive Practice Section for Elimination (when in Student Mode) */}
          {!isTeacherView && (
            <div className="mt-5 pt-4 border-t border-[#D5CFC0] space-y-3">
              <div className="text-xs sm:text-sm font-extrabold text-[#195E3E]">
                ✍️ Thực hành tự biến đổi cộng đại số ({currentElimItem.badge}):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
                <label className="flex items-center gap-2 font-bold text-[#102A43]">
                  Nhân PT (1) với:
                  <input
                    type="text"
                    value={elimM1Input}
                    onChange={(e) => setElimM1Input(e.target.value)}
                    className="w-20 min-h-[40px] px-2.5 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold text-center"
                  />
                </label>
                <label className="flex items-center gap-2 font-bold text-[#102A43]">
                  Nhân PT (2) với:
                  <input
                    type="text"
                    value={elimM2Input}
                    onChange={(e) => setElimM2Input(e.target.value)}
                    className="w-20 min-h-[40px] px-2.5 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold text-center"
                  />
                </label>
                <label className="flex items-center gap-2 font-bold text-[#102A43]">
                  Phép tính:
                  <select
                    value={elimOp}
                    onChange={(e) => setElimOp(e.target.value as 'add' | 'sub')}
                    className="min-h-[40px] px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold"
                  >
                    <option value="add">Cộng từng vế (+)</option>
                    <option value="sub">Trừ từng vế (−)</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-xs sm:text-sm">
                <label className="font-bold text-[#102A43]">
                  PT thu được:
                  <input
                    type="text"
                    value={elimCombinedEqInput}
                    onChange={(e) => setElimCombinedEqInput(e.target.value)}
                    placeholder="13x = 13"
                    className="w-full mt-1 min-h-[40px] px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold"
                  />
                </label>
                <label className="font-bold text-[#102A43]">
                  Nghiệm x =
                  <input
                    type="text"
                    value={elimFinalX}
                    onChange={(e) => setElimFinalX(e.target.value)}
                    placeholder="1"
                    className="w-full mt-1 min-h-[40px] px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold"
                  />
                </label>
                <label className="font-bold text-[#102A43]">
                  Nghiệm y =
                  <input
                    type="text"
                    value={elimFinalY}
                    onChange={(e) => setElimFinalY(e.target.value)}
                    placeholder="2"
                    className="w-full mt-1 min-h-[40px] px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white font-bold"
                  />
                </label>
              </div>

              {elimFeedback && (
                <div
                  role="status"
                  className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold ${
                    elimFeedback.isValid
                      ? 'bg-[#ECFDF5] border-emerald-300 text-[#065F46]'
                      : 'bg-[#FFF7ED] border-amber-300 text-[#9A3412]'
                  }`}
                >
                  <p className="font-bold">{elimFeedback.messageVi}</p>
                  {elimFeedback.hintVi && <p className="text-xs mt-0.5">{elimFeedback.hintVi}</p>}
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCheckEliminationStudent}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#195E3E] hover:bg-[#134830] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Kiểm tra phép cộng đại số</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherShowSolution((prev) => !prev)}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-white border border-[#C9C1B0] text-[#102A43] font-bold text-xs sm:text-sm cursor-pointer"
                >
                  {teacherShowSolution ? 'Ẩn lời giải mẫu' : 'Xem lời giải mẫu'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER ACTIVITY 4: BA TRƯỜNG HỢP NGHIỆM & "EM CÓ BIẾT?" (SGK trang 12–18)
  // ============================================================================
  const renderActivity4ThreeCasesAndEmCoBiet = () => (
    <div className="space-y-4">
      {/* 3 Case Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <button
          type="button"
          onClick={() => {
            setAct4CaseTab('unique');
            markActivityCompleted(4);
          }}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            act4CaseTab === 'unique'
              ? 'bg-[#ECFDF5] border-[#195E3E] shadow-sm'
              : 'bg-[#FAF8F2] border-[#D5CFC0] hover:bg-white'
          }`}
        >
          <span className="px-2.5 py-0.5 rounded-lg bg-[#195E3E] text-white text-xs font-extrabold">
            Trường hợp 1
          </span>
          <h4 className="text-base font-extrabold text-[#102A43] mt-2">
            Hệ có nghiệm duy nhất (x₀; y₀)
          </h4>
          <p className="text-xs text-[#475569] mt-1 leading-relaxed">
            Phương trình một ẩn có dạng <strong>at = b (với a ≠ 0)</strong> ⇒ t = b/a. Ví dụ 1: 5x − 6 = 4 ⇒ (2; 1).
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setAct4CaseTab('no_solution');
            markActivityCompleted(4);
          }}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            act4CaseTab === 'no_solution'
              ? 'bg-[#FEF2F2] border-rose-600 shadow-sm'
              : 'bg-[#FAF8F2] border-[#D5CFC0] hover:bg-white'
          }`}
        >
          <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-extrabold">
            Trường hợp 2
          </span>
          <h4 className="text-base font-extrabold text-[#102A43] mt-2">
            Hệ phương trình vô nghiệm
          </h4>
          <p className="text-xs text-[#475569] mt-1 leading-relaxed">
            Phương trình một ẩn có dạng <strong>0x = k hoặc 0y = k (với k ≠ 0)</strong>. Ví dụ 2: 0y = 12 (vô lí) ⇒ Hệ vô nghiệm.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setAct4CaseTab('infinite_solutions');
            markActivityCompleted(4);
          }}
          className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
            act4CaseTab === 'infinite_solutions'
              ? 'bg-[#FFFBEB] border-amber-600 shadow-sm'
              : 'bg-[#FAF8F2] border-[#D5CFC0] hover:bg-white'
          }`}
        >
          <span className="px-2.5 py-0.5 rounded-lg bg-amber-600 text-white text-xs font-extrabold">
            Trường hợp 3
          </span>
          <h4 className="text-base font-extrabold text-[#102A43] mt-2">
            Hệ có vô số nghiệm
          </h4>
          <p className="text-xs text-[#475569] mt-1 leading-relaxed">
            Phương trình một ẩn có dạng <strong>0x = 0 (luôn đúng)</strong>. Phải giữ lại ràng buộc tuyến tính, ví dụ (t; t − 2), t ∈ ℝ.
          </p>
        </button>
      </div>

      {/* Crucial Academic Warning on 0x = 0 */}
      <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold">Lưu ý học thuật quan trọng khi gặp 0x = 0 (hoặc 0y = 0):</span>{' '}
          Tuy 0x = 0 nghiệm đúng với mọi x ∈ ℝ, nhưng <strong>không phải mọi cặp (x; y) bất kỳ trong ℝ² đều là nghiệm của hệ</strong>! Cặp (x; y) vẫn phải thỏa mãn phương trình của hệ (ví dụ ở Ví dụ 3: y = x − 2, nên nghiệm tổng quát là (t; t − 2) với t ∈ ℝ).
        </div>
      </div>

      {/* Expandable Section: Đọc thêm "Em có biết?" (SGK trang 17–18) */}
      <div className="rounded-2xl border-2 border-[#195E3E]/30 bg-white overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setEmCoBietExpanded((prev) => !prev)}
          className="w-full px-4 py-3 bg-[#E9F5EC] flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[#195E3E]" />
            <span className="text-sm sm:text-base font-extrabold text-[#102A43]">
              Đọc thêm “Em có biết?” (SGK trang 17–18): Minh họa hình học tập nghiệm của hệ phương trình
            </span>
          </div>
          {emCoBietExpanded ? (
            <ChevronUp className="w-5 h-5 text-[#195E3E]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#195E3E]" />
          )}
        </button>

        {emCoBietExpanded && (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-6">
              <ThreeCasesCoordinateGraphSVG
                system={act4DemoSystem}
                title="Mặt phẳng tọa độ Oxy — Vị trí tương đối của d₁ và d₂"
              />
            </div>
            <div className="lg:col-span-6 space-y-3 text-xs sm:text-sm text-[#102A43]">
              <p className="leading-relaxed">
                Trên mặt phẳng tọa độ Oxy, tập nghiệm của mỗi phương trình bậc nhất hai ẩn được biểu diễn bởi một đường thẳng (<strong>d₁</strong> và <strong>d₂</strong>):
              </p>
              <ul className="space-y-2">
                <li className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                  • <strong>Hai đường thẳng cắt nhau:</strong> Hệ có <strong>nghiệm duy nhất</strong> chính là tọa độ giao điểm M(x₀; y₀).
                </li>
                <li className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                  • <strong>Hai đường thẳng song song:</strong> Không có điểm chung ⇒ Hệ <strong>vô nghiệm</strong>.
                </li>
                <li className="p-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200">
                  • <strong>Hai đường thẳng trùng nhau:</strong> Mọi điểm thuộc đường thẳng chung đều là nghiệm ⇒ Hệ có <strong>vô số nghiệm</strong>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ============================================================================
  // RENDER ACTIVITY 5: SỬ DỤNG MÁY TÍNH CẦM TAY (SGK trang 15)
  // ============================================================================
  const renderActivity5Calculator = () => (
    <div className="space-y-4">
      {/* Mode Switcher: Mô phỏng chung theo bảng hệ số vs Thao tác theo dòng máy cụ thể */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#E2DDD0]">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCalcModeTab('coeff_table')}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
              calcModeTab === 'coeff_table'
                ? 'bg-[#195E3E] text-white shadow-xs'
                : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
            }`}
          >
            1. Mô phỏng chung theo bảng hệ số (a₁, b₁, c₁, a₂, b₂, c₂)
          </button>
          <button
            type="button"
            onClick={() => setCalcModeTab('key_sequence')}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
              calcModeTab === 'key_sequence'
                ? 'bg-[#195E3E] text-white shadow-xs'
                : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
            }`}
          >
            2. Phím bấm tham khảo trên một số dòng máy thông dụng
          </button>
        </div>

        {/* Preset buttons from SGK page 15 */}
        <div className="flex flex-wrap gap-1.5">
          {CALCULATOR_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectCalcPreset(item.id)}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                selectedCalcItemId === item.id
                  ? 'bg-[#E07A16] text-white'
                  : 'bg-[#EFECE2] text-[#102A43] hover:bg-[#E2DDD0]'
              }`}
            >
              {item.badge.split('•')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Normalization Rule Reminder */}
      <div className="p-3.5 rounded-2xl bg-[#ECFDF5] border border-emerald-300 text-xs sm:text-sm text-[#064E3B] flex items-center justify-between gap-3">
        <div>
          <span className="font-extrabold">📌 Quy tắc bắt buộc trước khi nhập máy (SGK trang 15):</span>{' '}
          Phải viết hệ phương trình về đúng dạng chuẩn{' '}
          <strong className="font-serif">a₁x + b₁y = c₁</strong> và{' '}
          <strong className="font-serif">a₂x + b₂y = c₂</strong> (chuyển hằng số tự do sang vế phải).
        </div>
      </div>

      {calcModeTab === 'coeff_table' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left: Coefficient Input Matrix */}
          <div className="lg:col-span-7 rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 space-y-3">
            <h4 className="text-sm sm:text-base font-extrabold text-[#102A43]">
              Bảng nhập hệ số chuẩn hóa a₁x + b₁y = c₁ ; a₂x + b₂y = c₂
            </h4>
            <div className="space-y-2.5 font-serif text-base sm:text-lg font-bold text-[#102A43]">
              <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-[#E2DDD0]">
                <span className="text-xs font-sans font-bold text-slate-500 w-14">PT (1):</span>
                <input
                  type="text"
                  aria-label="Hệ số a1"
                  value={calcCoeffs.a1}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, a1: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
                <span>x +</span>
                <input
                  type="text"
                  aria-label="Hệ số b1"
                  value={calcCoeffs.b1}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, b1: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
                <span>y =</span>
                <input
                  type="text"
                  aria-label="Hệ số c1"
                  value={calcCoeffs.c1}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, c1: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-[#E2DDD0]">
                <span className="text-xs font-sans font-bold text-slate-500 w-14">PT (2):</span>
                <input
                  type="text"
                  aria-label="Hệ số a2"
                  value={calcCoeffs.a2}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, a2: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
                <span>x +</span>
                <input
                  type="text"
                  aria-label="Hệ số b2"
                  value={calcCoeffs.b2}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, b2: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
                <span>y =</span>
                <input
                  type="text"
                  aria-label="Hệ số c2"
                  value={calcCoeffs.c2}
                  onChange={(e) => setCalcCoeffs({ ...calcCoeffs, c2: e.target.value })}
                  className="w-16 min-h-[40px] px-2 rounded-lg border border-[#94A3B8] text-center font-sans font-bold"
                />
              </div>
            </div>

            {CALCULATOR_ITEMS.find((c) => c.id === selectedCalcItemId) && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
                <div className="font-extrabold">
                  Đề bài gốc ({CALCULATOR_ITEMS.find((c) => c.id === selectedCalcItemId)!.badge}):
                </div>
                <p className="font-serif font-bold text-sm">
                  {'{ '}
                  {CALCULATOR_ITEMS.find((c) => c.id === selectedCalcItemId)!.rawSystemDisplay[0]} ;{' '}
                  {CALCULATOR_ITEMS.find((c) => c.id === selectedCalcItemId)!.rawSystemDisplay[1]}
                  {' }'}
                </p>
                <p>{CALCULATOR_ITEMS.find((c) => c.id === selectedCalcItemId)!.pedagogicalNote}</p>
              </div>
            )}
          </div>

          {/* Right: 3D Handheld Calculator LCD Screen */}
          <div className="lg:col-span-5 rounded-3xl bg-gradient-to-b from-[#2B3544] to-[#1A212C] p-5 text-white border-4 border-[#475569] shadow-xl space-y-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>SMART EDU CALC • EQN 2-VAR</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                MATH
              </span>
            </div>

            {/* LCD Display */}
            <div className="rounded-xl bg-[#C7D9C4] text-[#0F2417] p-4 font-mono border-2 border-[#8CA689] shadow-inner min-h-[130px] flex flex-col justify-between">
              <div className="text-xs font-bold border-b border-[#0F2417]/20 pb-1">
                a₁x + b₁y = c₁ | [{calcCoeffs.a1}, {calcCoeffs.b1}, {calcCoeffs.c1}]
              </div>
              {liveCalculatorResult ? (
                liveCalculatorResult.status === 'unique' ? (
                  <div className="space-y-1 py-1">
                    <div className="text-lg font-extrabold">
                      x = {formatRational(liveCalculatorResult.x!)}{' '}
                      <span className="text-xs font-normal">
                        ({formatRational(liveCalculatorResult.x!, 'vi_decimal_if_clean')})
                      </span>
                    </div>
                    <div className="text-lg font-extrabold">
                      y = {formatRational(liveCalculatorResult.y!)}{' '}
                      <span className="text-xs font-normal">
                        ({formatRational(liveCalculatorResult.y!, 'vi_decimal_if_clean')})
                      </span>
                    </div>
                  </div>
                ) : liveCalculatorResult.status === 'no_solution' ? (
                  <div className="py-2 text-base font-extrabold text-rose-900">
                    No-Solution (Vô nghiệm)
                  </div>
                ) : (
                  <div className="py-1 space-y-0.5">
                    <div className="text-sm font-extrabold text-amber-950">
                      Infinite Sol (Vô số nghiệm)
                    </div>
                    <div className="text-xs font-bold">
                      Nghiệm: ({liveCalculatorResult.parametric?.xExprDisplay};{' '}
                      {liveCalculatorResult.parametric?.yExprDisplay}), t ∈ ℝ
                    </div>
                  </div>
                )
              ) : (
                <div className="py-2 text-xs font-bold text-rose-900">
                  Hãy nhập hệ số hợp lệ.
                </div>
              )}
              <div className="text-[11px] opacity-80 text-right">Nhấn [=] để xem từng ẩn</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 space-y-3 text-xs sm:text-sm text-[#102A43]">
          <h4 className="font-extrabold text-base text-[#195E3E]">
            Hướng dẫn thao tác trên một số dòng máy tính cầm tay thông dụng (tham khảo):
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-[#E2DDD0] space-y-1.5">
              <div className="font-extrabold text-[#102A43]">• Dòng máy Casio fx-570VN PLUS:</div>
              <p>Bấm liên tiếp: <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">MODE</code> → <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">5</code> (EQN) → <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">1</code> (anX + bnY = cn).</p>
              <p>Nhập lần lượt a₁, =, b₁, =, c₁, =, a₂, =, b₂, =, c₂, = rồi nhấn = để đọc x và y.</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-[#E2DDD0] space-y-1.5">
              <div className="font-extrabold text-[#102A43]">• Dòng máy Casio fx-580VN X / fx-880BTG:</div>
              <p>Bấm: <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">MENU</code> → <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">9</code> (Hệ phương trình) → <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">1</code> → Chọn số ẩn <code className="px-1.5 py-0.5 rounded bg-slate-100 font-bold">2</code>.</p>
              <p>Lưu ý: Với hệ số phân số như 2/5 ở Bài 1.9d, dùng phím phân số hoặc phép chia 2 ÷ 5.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER ACTIVITY 6: VẬN DỤNG 1 & 2, BÀI TẬP 1.6–1.9, 12 CÂU BỔ SUNG, PHIẾU CUỐI BÀI
  // ============================================================================
  const renderActivity6PracticeAndAssessment = () => (
    <div className="space-y-4">
      {/* 4 Sub-tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-[#E2DDD0]">
        <button
          type="button"
          onClick={() => setAct6SubTab('van_dung')}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
            act6SubTab === 'van_dung'
              ? 'bg-[#195E3E] text-white'
              : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
          }`}
        >
          1. Vận dụng 1 (Vườn cải bắp) &amp; Vận dụng 2 (HCl)
        </button>
        <button
          type="button"
          onClick={() => {
            setAct6SubTab('sgk_16_19');
            setSelectedExId('bt_1_6_a');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
            act6SubTab === 'sgk_16_19'
              ? 'bg-[#195E3E] text-white'
              : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
          }`}
        >
          2. Bài tập SGK 1.6 – 1.9 (Tr. 16)
        </button>
        <button
          type="button"
          onClick={() => {
            setAct6SubTab('bo_sung_12');
            setSelectedExId('bs_01');
          }}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
            act6SubTab === 'bo_sung_12'
              ? 'bg-[#195E3E] text-white'
              : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
          }`}
        >
          3. Tự luyện Bổ sung (12 câu)
        </button>
        <button
          type="button"
          onClick={() => setAct6SubTab('phieu_danh_gia')}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer ${
            act6SubTab === 'phieu_danh_gia'
              ? 'bg-[#E07A16] text-white'
              : 'bg-[#FAF8F2] text-[#102A43] border border-[#D5CFC0]'
          }`}
        >
          4. Phiếu đánh giá cuối bài (6 câu)
        </button>
      </div>

      {/* Sub-tab 1: Vận dụng 1 & Vận dụng 2 */}
      {act6SubTab === 'van_dung' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Vận dụng 1: Giải trọn vẹn Vườn cải bắp */}
          <div className="rounded-2xl border border-[#C6D9C7] bg-[#FAF8F2] p-4 space-y-2.5">
            <span className="px-3 py-1 rounded-lg bg-[#195E3E] text-white text-xs font-extrabold">
              Vận dụng 1 • SGK trang 15 (Giải bài toán Mở đầu)
            </span>
            <h4 className="text-base font-extrabold text-[#102A43]">
              Tìm số cây cải bắp trồng ban đầu trong vườn nhà bác Đạt
            </h4>
            <div className="p-3 rounded-xl bg-white border border-[#E2DDD0] font-serif font-bold text-base text-[#102A43]">
              Hệ phương trình: {'{ −3x + 8y = −84 (1) ; 2x − 4y = 72 (2) }'}
            </div>
            <div className="text-xs sm:text-sm text-[#163628] space-y-1 leading-relaxed">
              <p>• Nhân hai vế của (2) với 2: <strong>4x − 8y = 144</strong>.</p>
              <p>• Cộng từng vế với (1): <strong>x = 60</strong> (luống, thỏa mãn x ∈ ℕ*, x &gt; 4).</p>
              <p>• Thay x = 60 vào (2): 2·60 − 4y = 72 ⇒ 4y = 48 ⇒ <strong>y = 12</strong> (cây/luống, thỏa mãn y &gt; 3).</p>
              <p className="font-extrabold text-[#195E3E] text-sm sm:text-base pt-1">
                ✓ Số cây cải bắp ban đầu: x·y = 60 × 12 = 720 (cây).
              </p>
              <p className="text-xs text-slate-600">
                Thử lại: Tăng 8 luống, bớt 3 cây/luống ⇒ 68 × 9 = 612 = 720 − 108 (Đúng). Giảm 4 luống, thêm 2 cây/luống ⇒ 56 × 14 = 784 = 720 + 64 (Đúng).
              </p>
            </div>
          </div>

          {/* Vận dụng 2: Pha dung dịch HCl */}
          <div className="rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 space-y-2.5">
            <span className="px-3 py-1 rounded-lg bg-[#E07A16] text-white text-xs font-extrabold">
              Vận dụng 2 • SGK trang 15 (Mô hình toán học nồng độ)
            </span>
            <h4 className="text-base font-extrabold text-[#102A43]">
              Tính thể tích dung dịch HCl 20% (x mL) và HCl 5% (y mL) để pha 2 lít (2000 mL) HCl 10%
            </h4>
            <p className="text-[11px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              ℹ️ Lưu ý: Đây là bài toán mô hình hóa đại số theo giả thiết SGK về thể tích và nồng độ, không phải hướng dẫn thực hành hóa chất thật.
            </p>
            <div className="p-3 rounded-xl bg-white border border-[#E2DDD0] font-serif font-bold text-base text-[#102A43]">
              Hệ phương trình: {'{ x + y = 2000 (1) ; 0,20x + 0,05y = 200 (2) }'}
            </div>
            <div className="text-xs sm:text-sm text-[#163628] space-y-1 leading-relaxed">
              <p>• Nhân hai vế của (2) với 20: <strong>4x + y = 4000</strong>.</p>
              <p>• Trừ từng vế cho (1): <strong>3x = 2000 ⇒ x = 2000/3 ≈ 666,67 (mL)</strong>.</p>
              <p>• Thay vào (1): <strong>y = 2000 − 2000/3 = 4000/3 ≈ 1333,33 (mL)</strong>.</p>
              <p className="font-extrabold text-[#195E3E]">
                ✓ Đáp số chính xác: x = 2000/3 mL (≈ 666,67 mL) và y = 4000/3 mL (≈ 1333,33 mL).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 2 & 3: Interactive Exercises 1.6-1.9 & 12 Supplementary Items */}
      {(act6SubTab === 'sgk_16_19' || act6SubTab === 'bo_sung_12') && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(act6SubTab === 'sgk_16_19'
              ? TEXTBOOK_EXERCISES_16_TO_19
              : SUPPLEMENTARY_EXERCISES
            ).map((ex) => {
              const isSolved = progress.solvedExerciseIds.includes(ex.id);
              const isSelected = ex.id === currentExercise.id;
              return (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExId(ex.id)}
                  className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#195E3E] text-white border-[#195E3E]'
                      : isSolved
                        ? 'bg-[#ECFDF5] text-[#065F46] border-emerald-300'
                        : 'bg-white text-[#102A43] border-[#D5CFC0]'
                  }`}
                >
                  {isSolved && <Check className="w-3.5 h-3.5" />}
                  <span>{ex.codeLabel.split('•')[0].trim()}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-[#D5CFC0] bg-[#FAF8F2] p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-extrabold ${
                    currentExercise.isSupplementary
                      ? 'bg-purple-100 text-purple-900 border border-purple-300'
                      : 'bg-[#195E3E] text-white'
                  }`}
                >
                  {currentExercise.codeLabel}
                </span>
                <span className="text-xs font-bold text-[#475569]">
                  {currentExercise.methodTag}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExShowGuide((prev) => !prev)}
                className="px-3 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold cursor-pointer"
              >
                {exShowGuide ? 'Ẩn hướng dẫn giải' : 'Xem hướng dẫn & Đáp án'}
              </button>
            </div>

            <p className="text-sm font-bold text-[#102A43]">{currentExercise.promptVi}</p>

            <div className="p-3.5 rounded-xl bg-white border border-[#E2DDD0] font-serif text-xl sm:text-2xl font-bold text-[#102A43] flex items-center gap-3">
              <span className="text-4xl font-light text-[#195E3E]">{'{'}</span>
              <div>
                <div>{currentExercise.systemDisplay[0]}</div>
                <div>{currentExercise.systemDisplay[1]}</div>
              </div>
            </div>

            {/* Answer verification inputs */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {(['unique', 'no_solution', 'infinite_solutions'] as SystemSolutionType[]).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setExStatusChoice(st)}
                    className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                      exStatusChoice === st
                        ? 'bg-[#195E3E] text-white border-[#195E3E]'
                        : 'bg-white text-[#102A43] border-[#CBD5E1]'
                    }`}
                  >
                    {st === 'unique'
                      ? 'Có nghiệm duy nhất (x; y)'
                      : st === 'no_solution'
                        ? 'Vô nghiệm'
                        : 'Vô số nghiệm (theo t ∈ ℝ)'}
                  </button>
                )
              )}
            </div>

            {exStatusChoice !== 'no_solution' && (
              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-[#102A43]">
                <label>
                  x =
                  <input
                    type="text"
                    value={exXInput}
                    onChange={(e) => setExXInput(e.target.value)}
                    placeholder={exStatusChoice === 'infinite_solutions' ? '3t - 4' : 'Nhập x'}
                    className="w-32 min-h-[40px] ml-1.5 px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white"
                  />
                </label>
                <label>
                  y =
                  <input
                    type="text"
                    value={exYInput}
                    onChange={(e) => setExYInput(e.target.value)}
                    placeholder={exStatusChoice === 'infinite_solutions' ? 't' : 'Nhập y'}
                    className="w-32 min-h-[40px] ml-1.5 px-3 py-1 rounded-xl border border-[#CBD5E1] bg-white"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleVerifyExerciseAnswer}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-[#195E3E] hover:bg-[#134830] text-white text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Kiểm tra đáp án</span>
              </button>
            </div>

            {exFeedback && (
              <div
                role="status"
                className={`p-3 rounded-xl border text-xs sm:text-sm font-semibold ${
                  exFeedback.isValid
                    ? 'bg-[#ECFDF5] border-emerald-300 text-[#065F46]'
                    : 'bg-[#FFF7ED] border-amber-300 text-[#9A3412]'
                }`}
              >
                <p className="font-bold">{exFeedback.messageVi}</p>
                {exFeedback.hintVi && <p className="text-xs mt-0.5">{exFeedback.hintVi}</p>}
              </div>
            )}

            {exShowGuide && (
              <div className="p-3.5 rounded-xl bg-[#FFFBEB] border border-amber-300 text-xs sm:text-sm text-amber-950 space-y-1">
                <div className="font-extrabold">Lời giải chi tiết ({currentExercise.codeLabel}):</div>
                {currentExercise.stepByStepGuide.map((line, i) => (
                  <p key={i}>• {line}</p>
                ))}
                <p className="font-extrabold text-[#195E3E] pt-1">
                  Đáp số: {currentExercise.expectedAnswerDisplay}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-tab 4: 6-Question Diagnostic Assessment */}
      {act6SubTab === 'phieu_danh_gia' && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-[#FAF8F2] border border-[#D5CFC0] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm sm:text-base font-extrabold text-[#102A43]">
                Phiếu đánh giá cuối bài (6 câu theo mục tiêu chuẩn GDPT 2018)
              </h4>
              <p className="text-xs text-[#475569]">
                Sau khi nộp bài, hệ thống chỉ rõ mục tiêu đạt được và phần kiến thức cần ôn lại.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSubmitDiagnosticQuiz}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-[#E07A16] hover:bg-[#C6690F] text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              Chấm phiếu đánh giá
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {DIAGNOSTIC_QUIZ_6.map((q, idx) => {
              const userChoice = progress.quizAnswers[q.id];
              const isCorrect = userChoice === q.correctIndex;
              return (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-white border border-[#E2DDD0] space-y-2.5 shadow-2xs"
                >
                  <div className="text-[11px] font-extrabold text-[#195E3E] uppercase">
                    Câu {idx + 1} • {q.objectiveTag}
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-[#102A43]">{q.prompt}</p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oIdx) => {
                      const selected = userChoice === oIdx;
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          onClick={() => handleSelectQuizOption(q.id, oIdx)}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-[#E9F5EC] border-[#195E3E] text-[#102A43] font-bold'
                              : 'bg-[#FAF8F2] border-[#E2DDD0] text-[#334155] hover:bg-slate-50'
                          }`}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      );
                    })}
                  </div>

                  {progress.quizSubmitted && (
                    <div
                      className={`p-2.5 rounded-xl text-xs ${
                        isCorrect
                          ? 'bg-[#ECFDF5] text-[#065F46] border border-emerald-300'
                          : 'bg-[#FFF1F2] text-rose-900 border border-rose-300'
                      }`}
                    >
                      <div className="font-extrabold">
                        {isCorrect
                          ? '✓ Đạt mục tiêu!'
                          : `✗ Chưa đúng (Đáp án đúng: ${String.fromCharCode(65 + q.correctIndex)}).`}
                      </div>
                      <p className="mt-0.5">{q.explanation}</p>
                      {!isCorrect && (
                        <button
                          type="button"
                          onClick={() => setActiveActivityId(q.reviewActivityIndex)}
                          className="mt-1.5 inline-flex items-center gap-1 underline font-bold text-rose-800 cursor-pointer"
                        >
                          <span>→ Ôn lại ngay: {q.reviewSectionName}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  const renderCenterStageContent = () => {
    switch (activeActivityId) {
      case 1:
        return renderActivity1CabbageGarden();
      case 2:
        return renderActivity2SubstitutionStudent();
      case 3:
        return renderActivity3Elimination();
      case 4:
        return renderActivity4ThreeCasesAndEmCoBiet();
      case 5:
        return renderActivity5Calculator();
      case 6:
        return renderActivity6PracticeAndAssessment();
      default:
        return renderActivity2SubstitutionStudent();
    }
  };

  // Current teacher notes metadata based on active activity
  const currentTeacherNotes =
    activeActivityId === 3
      ? {
          goal: currentElimItem.teacherGoal,
          question: currentElimItem.teacherGuidingQuestion,
          mistake: currentElimItem.commonMistakeWarning,
        }
      : activeActivityId === 2
        ? {
            goal: currentSubItem.teacherGoal,
            question: currentSubItem.teacherGuidingQuestion,
            mistake: currentSubItem.commonMistakeWarning,
          }
        : {
            goal: currentActivityMeta.studentObjective,
            question:
              activeActivityId === 1
                ? 'Vì sao phương trình (x + 8)(y − 3) = xy − 108 chỉ trở thành bậc nhất hai ẩn sau khi khử xy?'
                : 'Làm thế nào để kiểm tra một cặp số (x₀; y₀) có là nghiệm chung của cả hệ hay không?',
            mistake:
              activeActivityId === 1
                ? 'Gọi ngay phương trình còn chứa xy là phương trình bậc nhất hai ẩn.'
                : 'Chỉ thay nghiệm vào một phương trình mà quên kiểm tra phương trình thứ hai.',
          };

  // ============================================================================
  // MAIN SHELL RENDER (Supports Both Student Mode & Teacher Mode + Clean Presentation)
  // ============================================================================
  return (
    <div
      ref={rootContainerRef}
      className="rounded-[26px] border-2 border-[#D4CCB8] bg-gradient-to-b from-[#EDE8DC] via-[#F4F1E8] to-[#E5DEC9] p-3 sm:p-4 lg:p-5 text-[#102A43] shadow-[0_18px_42px_-15px_rgba(22,54,40,0.22)] font-edtech select-none"
    >
      {/* ====================================================================
          TOP HEADER BAR (Matching Reference Images 1 & 2)
          ==================================================================== */}
      <header className="rounded-2xl border border-[#D8D0BE] bg-gradient-to-b from-[#FBF9F3] to-[#EFEAE0] px-3.5 py-2.5 sm:px-5 sm:py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left Brand + Role Badge + Title Breadcrumb */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 min-w-0">
          {onBackToCatalog && (
            <button
              type="button"
              onClick={onBackToCatalog}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white hover:bg-[#F3EFE6] border border-[#D5CFC0] text-xs font-bold text-[#163628] flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Quay về danh sách Bài giảng"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay về thư viện</span>
            </button>
          )}

          {/* Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-b from-[#237A50] to-[#154C30] flex items-center justify-center text-amber-300 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="leading-none">
              <span className="block text-sm font-black tracking-tight text-[#163628]">
                TÂY ĐÔ
              </span>
              <span className="block text-[11px] font-extrabold text-[#E07A16] tracking-wider">
                SMART EDU
              </span>
            </div>
          </div>

          <span className="text-[#C8BFA8] hidden sm:inline">|</span>

          {/* Mode Badge Pill (HỌC SINH TỰ HỌC or GIÁO VIÊN GIẢNG DẠY) */}
          {roleMode === 'student' ? (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#22744D] to-[#155234] text-white text-xs sm:text-sm font-extrabold shadow-xs">
              <GraduationCap className="w-4 h-4 text-amber-200" />
              <span>HỌC SINH TỰ HỌC</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#22744D] to-[#155234] text-white text-xs sm:text-sm font-extrabold shadow-xs">
              <Monitor className="w-4 h-4 text-amber-200" />
              <span>GIÁO VIÊN GIẢNG DẠY</span>
            </div>
          )}

          {/* Breadcrumb & Lesson Title */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-bold text-[#195E3E]">
              <span>Toán 9 • Chương I • Bài 2</span>
              <span className="text-[#94A3B8]">|</span>
              <span className="text-sm sm:text-lg font-extrabold text-[#102A43] truncate">
                Giải hệ hai phương trình bậc nhất hai ẩn
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Sub-mode / Presentation / Role Switch / Audio */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {(onOpenLesson1 || onSelectLesson) && (
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (onSelectLesson) onSelectLesson('toan_9_c1_b1');
                  else if (onOpenLesson1) onOpenLesson1();
                }}
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E] cursor-pointer"
                title="Mở Bài 1: Khái niệm phương trình và hệ hai phương trình bậc nhất hai ẩn"
              >
                ← Bài 1
              </button>
              {onSelectLesson && (
                <button
                  type="button"
                  onClick={() => onSelectLesson('toan_9_c1_b3')}
                  className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E] cursor-pointer"
                  title="Mở Bài 3: Giải bài toán bằng cách lập hệ phương trình"
                >
                  Bài 3 →
                </button>
              )}
            </div>
          )}

          {roleMode === 'student' ? (
            <>
              {/* Student Sub-mode: Học có hướng dẫn vs Tự luyện */}
              <div className="inline-flex rounded-xl bg-[#E5DEC9] p-1 border border-[#CFC6B2]">
                <button
                  type="button"
                  onClick={() => setStudentSubMode('guided')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    studentSubMode === 'guided'
                      ? 'bg-[#195E3E] text-white shadow-2xs'
                      : 'text-[#163628]'
                  }`}
                >
                  Học có hướng dẫn
                </button>
                <button
                  type="button"
                  onClick={() => setStudentSubMode('self_practice')}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    studentSubMode === 'self_practice'
                      ? 'bg-[#E07A16] text-white shadow-2xs'
                      : 'text-[#163628]'
                  }`}
                >
                  Tự luyện
                </button>
              </div>

              {allowTeacherMode && (
                <button
                  type="button"
                  onClick={() => {
                    setRoleMode('teacher');
                    setIsPresentationCleanMode(false);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Monitor className="w-3.5 h-3.5 text-[#195E3E]" />
                  <span>Giáo viên giảng dạy</span>
                </button>
              )}
            </>
          ) : (
            <>
              {/* Teacher Top Buttons: Mở màn hình trình chiếu, Chia sẻ cho HS & Xem như học sinh */}
              <button
                type="button"
                onClick={handleTogglePresentationMode}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>
                  {isPresentationCleanMode ? 'Thoát màn hình trình chiếu' : 'Mở màn hình trình chiếu'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsPresentationCleanMode(false);
                  setRoleMode('student');
                }}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-[#102A43] text-xs sm:text-sm font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#195E3E]" />
                <span>Xem như học sinh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/?view=teacher_lectures&lecture=toan_9_c1_b2&mode=student`;
                  navigator.clipboard?.writeText(url).catch(() => {});
                  setCopiedStudentLink(true);
                  setTimeout(() => setCopiedStudentLink(false), 2500);
                }}
                className="min-h-[42px] px-3 py-2 rounded-xl bg-[#E6F4EA] hover:bg-[#D1F0DB] border border-[#9CC5A6] text-[#14532D] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                title="Sao chép đường dẫn chế độ Học sinh tự học để chia sẻ cho lớp"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{copiedStudentLink ? 'Đã chép link HS!' : 'Link Học sinh'}</span>
              </button>
            </>
          )}

          {/* Mute/Unmute Audio Toggle (Default Muted) */}
          <button
            type="button"
            onClick={() => setIsSoundMuted((prev) => !prev)}
            aria-label={isSoundMuted ? 'Bật âm thanh phản hồi' : 'Tắt âm thanh phản hồi'}
            title={isSoundMuted ? 'Đang tắt tiếng (mặc định)' : 'Đang bật âm thanh'}
            className="min-w-[40px] min-h-[40px] p-2 rounded-xl bg-white/90 border border-[#D5CFC0] text-[#163628] hover:bg-white flex items-center justify-center cursor-pointer"
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-[#195E3E]" />}
          </button>
        </div>
      </header>

      {/* ====================================================================
          MAIN 3-COLUMN WORKSPACE (Or 2-Column Clean Presentation Mode)
          ==================================================================== */}
      <div className="mt-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* ------------------------------------------------------------------
            LEFT SIDEBAR: Hành trình bài học (Student) / Kịch bản bài dạy (Teacher)
            ------------------------------------------------------------------ */}
        <aside className="lg:col-span-3 space-y-3">
          <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-xs">
            <div
              className={`px-4 py-3 flex items-center gap-2.5 font-extrabold text-sm sm:text-base ${
                roleMode === 'student'
                  ? 'bg-gradient-to-r from-[#195E3E] to-[#247B52] text-white'
                  : 'bg-[#EFECE2] text-[#102A43] border-b border-[#D8D0BE]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>{roleMode === 'student' ? 'Hành trình bài học' : 'Kịch bản bài dạy'}</span>
            </div>

            <div className="p-2.5 space-y-2">
              {ACTIVITIES_META.map((act) => {
                const isActive = act.id === activeActivityId;
                const isDone = progress.completedActivities.includes(act.id);
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => setActiveActivityId(act.id)}
                    className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-xl text-left font-bold text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-gradient-to-r from-[#195E3E] to-[#257C53] text-white border-[#13462E] shadow-sm'
                        : 'bg-[#FAF8F2] hover:bg-white text-[#102A43] border-[#E2DDD0]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isDone && !isActive && (
                        <CheckCircle2 className="w-4 h-4 text-[#195E3E] shrink-0" />
                      )}
                      <span className="truncate">{act.shortTitle}</span>
                    </div>

                    {act.id === 1 && roleMode === 'student' ? (
                      <span className="px-2 py-0.5 rounded-md bg-[#DCFCE7] text-[#14532D] text-[10px] font-extrabold shrink-0">
                        3D Vườn
                      </span>
                    ) : (
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Left Card: Tiến độ tự học (Student) OR SGK trang 11–18 3D Book (Teacher) */}
          {roleMode === 'student' ? (
            <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-4 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-sm text-[#102A43]">
                  <Target className="w-4 h-4 text-[#195E3E]" />
                  <span>Tiến độ tự học</span>
                </div>
                <span className="text-xs font-extrabold text-[#195E3E] tabular-nums">
                  {progress.completedActivities.length}/6 bài
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-[#DFD9C8] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#15803D] transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (progress.completedActivities.length / 6) * 100)}%`,
                  }}
                />
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-[#475569]">
                <span>Lưu cục bộ Bài 2</span>
                <button
                  type="button"
                  onClick={handleResetBai2Progress}
                  className="text-rose-700 hover:underline font-bold cursor-pointer"
                  title="Chỉ xóa dữ liệu tiến độ của Bài 2 trên thiết bị này"
                >
                  Đặt lại tiến độ
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-3.5 flex items-center gap-3 shadow-xs">
              <TextbookToan9Badge3D />
              <div className="space-y-0.5">
                <div className="text-xs font-extrabold text-[#195E3E] uppercase">
                  Kết nối tri thức
                </div>
                <div className="text-sm font-extrabold text-[#102A43]">SGK trang 11–18</div>
                <div className="text-[11px] font-medium text-[#475569]">
                  Toán 9 • Tập một (Chương I • Bài 2)
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------------------
            CENTER 3D STAGE (Spans 9 cols when Clean Presentation Mode is active, else 6 cols)
            ------------------------------------------------------------------ */}
        <section
          className={`${
            roleMode === 'teacher' && isPresentationCleanMode ? 'lg:col-span-9' : 'lg:col-span-6'
          } rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-sm`}
        >
          {/* Stage Top Header */}
          {roleMode === 'teacher' ? (
            <div className="bg-gradient-to-r from-[#2D6A4F] to-[#1B4332] text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <Monitor className="w-4 h-4 text-emerald-200" />
                <span>
                  {isPresentationCleanMode
                    ? 'Màn hình trình chiếu lớp học (Đã ẩn toàn bộ ghi chú riêng của Giáo viên)'
                    : 'Xem trước màn hình trình chiếu'}
                </span>
              </div>
              <span className="text-xs font-semibold text-emerald-100">
                {currentActivityMeta.sgkPageBadge}
              </span>
            </div>
          ) : (
            <div className="bg-[#EFECE2] px-4 py-3 border-b border-[#D8D0BE] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-5 rounded-full bg-[#E07A16]" />
                <h2 className="text-base sm:text-lg font-extrabold text-[#102A43]">
                  {activeActivityId === 2 ? currentSubItem.title : currentActivityMeta.fullTitle}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-white border border-[#D5CFC0] text-xs font-bold text-[#195E3E]">
                {studentSubMode === 'guided' ? '🧭 Học có hướng dẫn' : '✍️ Tự luyện'}
              </span>
            </div>
          )}

          {/* Stage Body */}
          <div className="p-3.5 sm:p-4">{renderCenterStageContent()}</div>
        </section>

        {/* ------------------------------------------------------------------
            RIGHT SIDEBAR:
            - Student Mode: Trợ giúp tự học (Matching Reference Image 1)
            - Teacher Mode: Ghi chú riêng (UNMOUNTED completely when isPresentationCleanMode is true!)
            ------------------------------------------------------------------ */}
        {!(roleMode === 'teacher' && isPresentationCleanMode) && (
          <aside className="lg:col-span-3 space-y-3">
            {roleMode === 'student' ? (
              <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] overflow-hidden shadow-xs">
                <div className="bg-gradient-to-r from-[#195E3E] to-[#247B52] text-white px-4 py-3 flex items-center gap-2 font-extrabold text-sm sm:text-base">
                  <BookOpen className="w-4 h-4" />
                  <span>Trợ giúp tự học</span>
                </div>

                <div className="p-3.5 space-y-3">
                  {/* Mục tiêu */}
                  <div className="p-3 rounded-xl bg-[#E6F4EA] border border-[#B7D9C2] flex items-start gap-2.5">
                    <Target className="w-5 h-5 text-[#195E3E] shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-[#102A43]">
                      <span className="font-extrabold">Mục tiêu:</span>{' '}
                      {currentActivityMeta.studentObjective}
                    </div>
                  </div>

                  {/* Accordion 1: Vì sao phải đặt ngoặc? */}
                  <div className="rounded-xl border border-[#D5CFC0] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSubRightFaq1Open((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold text-[#102A43] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>Vì sao phải đặt ngoặc?</span>
                      {subRightFaq1Open ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {subRightFaq1Open && (
                      <div className="px-3.5 pb-3 text-xs text-[#475569] leading-relaxed border-t border-slate-100 pt-2">
                        Khi thay ẩn <em className="font-serif">y</em> bằng một biểu thức có nhiều hạng tử (như{' '}
                        <strong>2x − 3</strong>) vào vị trí có hệ số nhân (như <strong>2y</strong>), phải đặt trong ngoặc{' '}
                        <strong>2(2x − 3)</strong> để nhân hệ số 2 với toàn bộ biểu thức đó.
                      </div>
                    )}
                  </div>

                  {/* Accordion 2: Xem quy trình phương pháp thế */}
                  <div className="rounded-xl border border-[#D5CFC0] bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSubRightFaq2Open((prev) => !prev)}
                      className="w-full px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold text-[#102A43] flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span>
                        {activeActivityId === 3
                          ? 'Xem quy trình cộng đại số'
                          : 'Xem quy trình phương pháp thế'}
                      </span>
                      {subRightFaq2Open ? (
                        <ChevronUp className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                    {subRightFaq2Open && (
                      <div className="px-3.5 pb-3 text-xs text-[#475569] leading-relaxed border-t border-slate-100 pt-2 space-y-1">
                        {activeActivityId === 3 ? (
                          <>
                            <p>• Bước 1: Nhân hai vế của mỗi phương trình với số thích hợp (nếu cần) để hệ số của một ẩn bằng nhau hoặc đối nhau.</p>
                            <p>• Bước 2: Cộng hoặc trừ từng vế hai phương trình để thu được phương trình một ẩn, kết hợp với một phương trình của hệ để tìm nghiệm.</p>
                          </>
                        ) : (
                          <>
                            <p>• Bước 1: Từ một phương trình của hệ, biểu diễn một ẩn theo ẩn kia rồi thế vào phương trình còn lại để được phương trình một ẩn.</p>
                            <p>• Bước 2: Giải phương trình một ẩn đó, rồi suy ra nghiệm (x; y) của hệ.</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Orange Info Callout */}
                  <div className="p-3 rounded-xl bg-[#FFF6E5] border border-[#E5B87B] flex items-start gap-2 text-xs text-[#7C3A0B]">
                    <Info className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
                    <span className="italic font-semibold">
                      Em có thể chọn biểu diễn <strong>x theo y</strong> hoặc <strong>y theo x</strong> tùy theo phương trình nào có hệ số ±1 đơn giản hơn.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* TEACHER PRIVATE NOTES PANEL (Exact Match for Reference Image 2 `image_9bfd356d.png`) */
              <div className="rounded-2xl border border-[#D4CCB8] bg-[#F7F4EC] p-4 space-y-3 shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-extrabold text-base text-[#102A43]">
                    <span>📋 Ghi chú riêng</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FDE6CE] border border-[#F3B87E] text-[#9A3412] text-xs font-extrabold">
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Không hiển thị khi trình chiếu</span>
                  </div>
                </div>

                {/* Mục tiêu */}
                <div className="p-3 rounded-xl bg-[#EAF2EC] border border-[#C6D9C7] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#195E3E]">
                    <Target className="w-4 h-4" />
                    <span>Mục tiêu</span>
                  </div>
                  <p className="text-xs font-semibold text-[#102A43]">{currentTeacherNotes.goal}</p>
                </div>

                {/* Câu hỏi gợi mở */}
                <div className="p-3 rounded-xl bg-[#EAF2EC] border border-[#C6D9C7] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#195E3E]">
                    <HelpCircle className="w-4 h-4" />
                    <span>Câu hỏi gợi mở</span>
                  </div>
                  <p className="text-xs font-semibold text-[#102A43]">{currentTeacherNotes.question}</p>
                </div>

                {/* Lỗi thường gặp */}
                <div className="p-3 rounded-xl bg-[#FFF6E5] border border-[#F3C88B] space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#B45309]">
                    <AlertTriangle className="w-4 h-4 text-[#D97706]" />
                    <span>Lỗi thường gặp</span>
                  </div>
                  <p className="text-xs font-semibold text-[#7C2D12]">{currentTeacherNotes.mistake}</p>
                </div>

                {/* 3 Presentation Reveal Switches */}
                <div className="pt-2 border-t border-[#D8D0BE] space-y-2.5 text-xs font-bold text-[#102A43]">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện bước nhân</span>
                    <input
                      type="checkbox"
                      checked={teacherShowMultiply}
                      onChange={(e) => setTeacherShowMultiply(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện bước cộng</span>
                    <input
                      type="checkbox"
                      checked={teacherShowAdd}
                      onChange={(e) => setTeacherShowAdd(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span>⚙️ Hiện nghiệm</span>
                    <input
                      type="checkbox"
                      checked={teacherShowSolution}
                      onChange={(e) => setTeacherShowSolution(e.target.checked)}
                      className="w-5 h-5 accent-[#195E3E] cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* ====================================================================
          BOTTOM NAVIGATION & STEP PLAYBACK BAR (Matching Reference Images 1 & 2)
          ==================================================================== */}
      <footer className="mt-3.5 rounded-2xl border border-[#D8D0BE] bg-gradient-to-b from-[#FAF8F2] to-[#ECE6D8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {roleMode === 'student' ? (
          <>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#163628]">
              <BookOpen className="w-4 h-4 text-[#195E3E]" />
              <span>
                {activeActivityId === 2
                  ? currentSubItem.badge
                  : activeActivityId === 3
                    ? currentElimItem.badge
                    : currentActivityMeta.sgkPageBadge}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={activeActivityId <= 1}
                onClick={() => setActiveActivityId((prev) => Math.max(1, prev - 1))}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Quay lại</span>
              </button>

              <button
                type="button"
                disabled={activeActivityId >= 6}
                onClick={() => {
                  markActivityCompleted(activeActivityId);
                  setActiveActivityId((prev) => Math.min(6, prev + 1));
                }}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              >
                <span>Tiếp tục</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          /* Teacher Bottom Control Bar (Exact Match for Reference Image 2 `image_9bfd356d.png`) */
          <div className="w-full flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={handleTeacherPrevStep}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#9CC5A6] text-xs sm:text-sm font-bold text-[#163628] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Bước trước</span>
            </button>

            <button
              type="button"
              onClick={handleTeacherNextStep}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] hover:brightness-105 text-white text-xs sm:text-sm font-extrabold shadow-[0_4px_0_#9A4E0E] flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Hiện từng bước</span>
            </button>

            <button
              type="button"
              onClick={handleTeacherHideSolution}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <EyeOff className="w-4 h-4 text-[#475569]" />
              <span>Ẩn lời giải</span>
            </button>

            <button
              type="button"
              onClick={handleTeacherResetSteps}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#FAF8F2] hover:bg-white border border-[#C9C1B0] text-xs sm:text-sm font-bold text-[#102A43] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#195E3E]" />
              <span>Đặt lại</span>
            </button>

            <span className="px-3.5 py-2 rounded-xl bg-[#DFECE2] text-[#163628] text-xs sm:text-sm font-extrabold tabular-nums">
              Bước {teacherCurrentStep}/4
            </span>
          </div>
        )}
      </footer>
    </div>
  );
};
