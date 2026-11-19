import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  FastForward,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  M05_ACTIVITY_METADATA,
  M05_TASK_BANK,
  M05ActivityId,
  M05CompareOperator,
  M05Difficulty,
  M05ShapeModel,
  M05TaskSpec,
  RawFraction,
  areFractionsEqual,
  cleanInt,
  coalesceFractionByM,
  compareExactFractions,
  computeFractionAddSub,
  expandFractionByK,
  explainFractionComparisonVi,
  formatFractionString,
  fractionToSvgX,
  fromMixedNumberInput,
  gcdInt,
  getM05TasksByActivity,
  lcmInt,
  normalizeFractionSign,
  readFractionInVietnamese,
  simplifyFraction,
  sortExactFractions,
  svgXToSnappedFraction,
  toMixedNumber,
  validateStudentFractionSubmission,
} from '../mathEngine/fractionDiscoveryEngine';
import {
  ActivitySidebarIcon3D,
  FractionRibbonBanner3D,
  FractionRobotGuide3D,
  FractionWheelStand3D,
  M05ActivityThumbnail3D,
  OrthographicFractionBarSVG,
  OrthographicFractionCircleSVG,
  StackedFractionBadge,
  TayDoFractionBrandLogo3D,
} from './M05Fraction3DAssets';
import { MathActivityResultRecord, MathGrade } from '../types';
import { saveMathActivityResult } from '../adapters/mathLabAdapters';

// ============================================================================
// SCOPED LOCAL STORAGE KEY (VERSIONED, NEVER OVERWRITES OTHER ROOMS)
// ============================================================================

const M05_STORAGE_KEY = 'taydo_smart_edu_m05_fraction_explorer_v1';

interface M05SavedProgress {
  version: 1;
  completedTaskIds: string[];
  score: number;
  streak: number;
  lastActivityId: M05ActivityId;
  classroomMode: 'INDIVIDUAL' | 'GROUP' | 'TEACHER_PRESENTATION';
  studentCount: number;
  groups: { id: string; name: string; points: number; turns: number }[];
}

const DEFAULT_M05_PROGRESS: M05SavedProgress = {
  version: 1,
  completedTaskIds: [],
  score: 0,
  streak: 0,
  lastActivityId: 'EQUIVALENT_FRACTIONS',
  classroomMode: 'INDIVIDUAL',
  studentCount: 35,
  groups: [
    { id: 'g1', name: 'Nhóm 1 – Sao Khuê', points: 0, turns: 0 },
    { id: 'g2', name: 'Nhóm 2 – Ánh Dương', points: 0, turns: 0 },
    { id: 'g3', name: 'Nhóm 3 – Tri Thức', points: 0, turns: 0 },
    { id: 'g4', name: 'Nhóm 4 – Sáng Tạo', points: 0, turns: 0 },
  ],
};

function loadM05Progress(): M05SavedProgress {
  try {
    const raw = localStorage.getItem(M05_STORAGE_KEY);
    if (!raw) return DEFAULT_M05_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<M05SavedProgress>;
    if (parsed.version !== 1) return DEFAULT_M05_PROGRESS;
    return {
      ...DEFAULT_M05_PROGRESS,
      ...parsed,
      completedTaskIds: Array.isArray(parsed.completedTaskIds)
        ? parsed.completedTaskIds
        : [],
      groups:
        Array.isArray(parsed.groups) && parsed.groups.length > 0
          ? parsed.groups
          : DEFAULT_M05_PROGRESS.groups,
    };
  } catch {
    return DEFAULT_M05_PROGRESS;
  }
}

function saveM05Progress(state: M05SavedProgress): void {
  try {
    localStorage.setItem(M05_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota issues safely
  }
}

// ============================================================================
// SOUND FEEDBACK HELPER (DEFAULT OFF PER ACCESSIBILITY RULES)
// ============================================================================

function playM05Tone(type: 'correct' | 'hint' | 'step', enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'correct') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.13);
    }
  } catch {
    // Ignore audio context restriction
  }
}

export interface M05FractionExplorerToolProps {
  grade: MathGrade;
  isPresentationMode?: boolean;
  onTogglePresentationMode?: () => void;
  isDarkTheme?: boolean;
  resetSignal?: number;
  onBackToHub?: () => void;
  selectedClassName?: string;
  studentCount?: number;
  currentUserName?: string;
  onResultSaved?: (record: MathActivityResultRecord) => void;
  initialActivityPreset?: string;
}

export const M05FractionExplorerTool: React.FC<M05FractionExplorerToolProps> = ({
  grade,
  isPresentationMode = false,
  onTogglePresentationMode,
  resetSignal = 0,
  onBackToHub,
  selectedClassName = 'Lớp 6A1',
  studentCount: initialStudentCount = 35,
  currentUserName = 'Học sinh THCS Tây Đô',
  onResultSaved,
  initialActivityPreset,
}) => {
  // --------------------------------------------------------------------------
  // 1. PERSISTED ROOM STATE & GLOBAL UI CONTROLS
  // --------------------------------------------------------------------------
  const [progress, setProgress] = useState<M05SavedProgress>(() => loadM05Progress());
  const [activeActivityId, setActiveActivityId] = useState<M05ActivityId>(() => {
    if (
      initialActivityPreset &&
      M05_ACTIVITY_METADATA.some((m) => m.id === initialActivityPreset)
    ) {
      return initialActivityPreset as M05ActivityId;
    }
    return 'EQUIVALENT_FRACTIONS'; // Featured activity per Section D.3
  });

  const [learningMode, setLearningMode] = useState<'EXPLORE' | 'CHALLENGE'>('EXPLORE');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [inPagePresentation, setInPagePresentation] = useState<boolean>(isPresentationMode);
  const [showThumbnailsStrip, setShowThumbnailsStrip] = useState<boolean>(true);
  const [showClassroomModal, setShowClassroomModal] = useState<boolean>(false);
  const [activeGroupId, setActiveGroupId] = useState<string>('g1');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false); // Default OFF
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [showPartLabels, setShowPartLabels] = useState<boolean>(true);
  const [showLeftMobileMenu, setShowLeftMobileMenu] = useState<boolean>(false);

  // Task & Hint state
  const [difficultyFilter, setDifficultyFilter] = useState<M05Difficulty | 'ALL'>('ALL');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const [revealedHintLevel, setRevealedHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [submissionStatus, setSubmissionStatus] = useState<
    'IDLE' | 'CORRECT' | 'EQUIVALENT_UNSIMPLIFIED' | 'INVALID_ZERO_DEN' | 'INCORRECT'
  >('IDLE');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');

  // Student answer input controls (Standard Fraction or Mixed Number)
  const [inputMode, setInputMode] = useState<'FRACTION' | 'MIXED'>('FRACTION');
  const [ansNum, setAnsNum] = useState<number>(2);
  const [ansDen, setAnsDen] = useState<number>(4);
  const [ansMixedNeg, setAnsMixedNeg] = useState<boolean>(false);
  const [ansMixedWhole, setAnsMixedWhole] = useState<number>(1);
  const [ansMixedNum, setAnsMixedNum] = useState<number>(3);
  const [ansMixedDen, setAnsMixedDen] = useState<number>(4);
  const [ansInteger, setAnsInteger] = useState<number>(1);
  const [ansOperator, setAnsOperator] = useState<M05CompareOperator>('<');
  const [ansChoice, setAnsChoice] = useState<string>('');

  // --------------------------------------------------------------------------
  // 2. ACTIVITY-SPECIFIC INTERACTIVE STATES (ACTIVITIES 1..6)
  // --------------------------------------------------------------------------

  // Activity 1: Chia phần bằng nhau (EQUAL_PARTS)
  const [act1Model, setAct1Model] = useState<M05ShapeModel>('CIRCLE');
  const [act1TotalParts, setAct1TotalParts] = useState<number>(4);
  const [act1ShadedParts, setAct1ShadedParts] = useState<number>(3);
  const [act1UnequalDemo, setAct1UnequalDemo] = useState<boolean>(false);

  // Activity 2: Tạo và đọc phân số (BUILD_READ_FRACTION)
  const [act2Model, setAct2Model] = useState<'STRIP' | 'CIRCLE'>('STRIP');
  const [act2Num, setAct2Num] = useState<number>(3);
  const [act2Den, setAct2Den] = useState<number>(4);

  // Activity 3: Phân số bằng nhau (EQUIVALENT_FRACTIONS — Default 1/2 = 2/4)
  const [act3Base, setAct3Base] = useState<RawFraction>({ num: 1, den: 2 });
  const [act3CandNum, setAct3CandNum] = useState<number>(2);
  const [act3CandDen, setAct3CandDen] = useState<number>(4);
  const [act3FactorK, setAct3FactorK] = useState<number>(2);
  const [act3CoalesceMsg, setAct3CoalesceMsg] = useState<string>('');

  // Activity 4: So sánh phân số (COMPARE_FRACTIONS)
  const [act4SubMode, setAct4SubMode] = useState<'PAIR' | 'SORT'>('PAIR');
  const [act4Left, setAct4Left] = useState<RawFraction>({ num: 1, den: 4 });
  const [act4Right, setAct4Right] = useState<RawFraction>({ num: 3, den: 4 });
  const [act4ShowCommonGrid, setAct4ShowCommonGrid] = useState<boolean>(false);
  const [act4UseNumberLine, setAct4UseNumberLine] = useState<boolean>(false);
  const [act4SortCards, setAct4SortCards] = useState<RawFraction[]>([
    { num: 3, den: 4 },
    { num: 1, den: 2 },
    { num: 5, den: 8 },
  ]);

  // Activity 5: Phân số trên trục số (FRACTION_NUMBER_LINE)
  const [act5Subdivisions, setAct5Subdivisions] = useState<number>(4);
  const [act5PointNum, setAct5PointNum] = useState<number>(3); // Point is act5PointNum / act5Subdivisions
  const [act5ShowNegative, setAct5ShowNegative] = useState<boolean>(false);
  const [act5HideMysteryLabel, setAct5HideMysteryLabel] = useState<boolean>(false);
  const [act5IsDragging, setAct5IsDragging] = useState<boolean>(false);
  const nlSvgRef = useRef<SVGSVGElement | null>(null);

  // Activity 6: Cộng, trừ phân số (ADD_SUB_FRACTIONS — Default 1/2 + 1/3 = 5/6)
  const [act6Tab, setAct6Tab] = useState<'SAME_DEN' | 'DIFF_DEN'>('DIFF_DEN');
  const [act6FracA, setAct6FracA] = useState<RawFraction>({ num: 1, den: 2 });
  const [act6FracB, setAct6FracB] = useState<RawFraction>({ num: 1, den: 3 });
  const [act6Op, setAct6Op] = useState<'+' | '-'>('+');
  const [act6Step, setAct6Step] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [act6ViewMode, setAct6ViewMode] = useState<'STRIP' | 'NUMBER_LINE'>('STRIP');
  const [act6IsPlaying, setAct6IsPlaying] = useState<boolean>(false);

  // Single-animation token guard so rapid clicks or tab changes cancel old timers immediately
  const animTokenRef = useRef<number>(0);

  const cancelRunningAnimations = useCallback(() => {
    animTokenRef.current += 1;
    setAct6IsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      animTokenRef.current += 1;
    };
  }, []);

  // Sync progress to scoped localStorage
  useEffect(() => {
    saveM05Progress(progress);
  }, [progress]);

  // Escape key exits presentation mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inPagePresentation) setInPagePresentation(false);
        if (showClassroomModal) setShowClassroomModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inPagePresentation, showClassroomModal]);

  // Filter tasks for active activity
  const filteredTasks = useMemo(() => {
    const list = getM05TasksByActivity(activeActivityId);
    if (difficultyFilter === 'ALL') return list;
    const byDiff = list.filter((t) => t.difficulty === difficultyFilter);
    return byDiff.length > 0 ? byDiff : list;
  }, [activeActivityId, difficultyFilter]);

  const currentTask: M05TaskSpec = useMemo(() => {
    return filteredTasks[selectedTaskIndex] || filteredTasks[0] || M05_TASK_BANK[0];
  }, [filteredTasks, selectedTaskIndex]);

  // Apply task preset whenever currentTask changes
  const applyTaskPreset = useCallback(
    (task: M05TaskSpec) => {
      cancelRunningAnimations();
      setRevealedHintLevel(0);
      setSubmissionStatus('IDLE');
      setFeedbackMessage('');
      setAct3CoalesceMsg('');

      const p = task.preset;

      if (task.activityId === 'EQUAL_PARTS') {
        if (p.shapeModel) setAct1Model(p.shapeModel);
        const tot = p.totalParts ?? 4;
        const sh = p.shadedCount ?? 3;
        setAct1TotalParts(tot);
        setAct1ShadedParts(sh);
        setAct1UnequalDemo(Boolean(p.isUnequalDemo));
        setAnsNum(sh);
        setAnsDen(tot);
        if (task.expectedInteger !== undefined) setAnsInteger(task.expectedInteger);
        if (task.choiceOptions && task.choiceOptions.length > 0) {
          setAnsChoice(
            learningMode === 'EXPLORE'
              ? task.expectedChoice || task.choiceOptions[0]
              : ''
          );
        }
      } else if (task.activityId === 'BUILD_READ_FRACTION') {
        if (p.shapeModel === 'CIRCLE' || p.shapeModel === 'STRIP') {
          setAct2Model(p.shapeModel);
        }
        const tf = p.targetFraction ?? { num: 3, den: 4 };
        setAct2Num(tf.num);
        setAct2Den(tf.den);
        setAnsNum(tf.num);
        setAnsDen(tf.den);
        if (task.expectedInteger !== undefined) setAnsInteger(task.expectedInteger);
      } else if (task.activityId === 'EQUIVALENT_FRACTIONS') {
        const bf = p.baseFraction ?? { num: 1, den: 2 };
        const tNum = p.targetNum ?? 2;
        const tDen = p.targetDen ?? 4;
        setAct3Base(bf);
        setAct3FactorK(p.scaleFactorK ?? 2);
        if (learningMode === 'CHALLENGE') {
          setAct3CandNum(bf.num);
          setAct3CandDen(tDen);
          setAnsNum(bf.num);
          setAnsDen(tDen);
        } else {
          setAct3CandNum(tNum);
          setAct3CandDen(tDen);
          setAnsNum(tNum);
          setAnsDen(tDen);
        }
        if (task.expectedInteger !== undefined) setAnsInteger(task.expectedInteger);
      } else if (task.activityId === 'COMPARE_FRACTIONS') {
        if (p.sortList && p.sortList.length > 0) {
          setAct4SubMode('SORT');
          setAct4SortCards(p.sortList);
        } else {
          setAct4SubMode('PAIR');
          const l = p.compareLeft ?? { num: 1, den: 4 };
          const r = p.compareRight ?? { num: 3, den: 4 };
          setAct4Left(l);
          setAct4Right(r);
          setAct4UseNumberLine(l.num < 0 || r.num < 0);
          setAnsOperator(compareExactFractions(l, r));
        }
      } else if (task.activityId === 'FRACTION_NUMBER_LINE') {
        const sub = p.nlSubdivisions ?? 4;
        const target = p.nlTarget ?? { num: 3, den: 4 };
        setAct5Subdivisions(sub);
        setAct5ShowNegative(Boolean(p.nlShowNegative || target.num < 0));
        const scaledNum = cleanInt((target.num * sub) / target.den);
        setAct5PointNum(learningMode === 'CHALLENGE' ? 1 : scaledNum);
        setAnsNum(target.num);
        setAnsDen(target.den);
        if (task.expectedInteger !== undefined) setAnsInteger(task.expectedInteger);
      } else if (task.activityId === 'ADD_SUB_FRACTIONS') {
        const fa = p.addSubA ?? { num: 1, den: 2 };
        const fb = p.addSubB ?? { num: 1, den: 3 };
        const op = p.addSubOp ?? '+';
        setAct6Tab(p.addSubTab ?? (fa.den === fb.den ? 'SAME_DEN' : 'DIFF_DEN'));
        setAct6FracA(fa);
        setAct6FracB(fb);
        setAct6Op(op);
        const calc = computeFractionAddSub(fa, op, fb);
        setAct6ViewMode(calc.canUseAreaModel ? 'STRIP' : 'NUMBER_LINE');
        setAct6Step(learningMode === 'CHALLENGE' ? 2 : 5);
        setAnsNum(calc.simplifiedResult.num);
        setAnsDen(calc.simplifiedResult.den);
      }
    },
    [cancelRunningAnimations, learningMode]
  );

  useEffect(() => {
    applyTaskPreset(currentTask);
  }, [currentTask, applyTaskPreset, resetSignal]);

  // --------------------------------------------------------------------------
  // 3. COMPUTED VALUES FOR ACTIVE ACTIVITIES
  // --------------------------------------------------------------------------

  const act3IsEquivalent = useMemo(() => {
    if (act3CandDen === 0) return false;
    return areFractionsEqual(act3Base, { num: act3CandNum, den: act3CandDen });
  }, [act3Base, act3CandNum, act3CandDen]);

  const act6Calculation = useMemo(
    () => computeFractionAddSub(act6FracA, act6Op, act6FracB),
    [act6FracA, act6Op, act6FracB]
  );

  const activeMeta = useMemo(
    () =>
      M05_ACTIVITY_METADATA.find((m) => m.id === activeActivityId) ||
      M05_ACTIVITY_METADATA[2],
    [activeActivityId]
  );

  // --------------------------------------------------------------------------
  // 4. INTERACTIVE HANDLERS FOR STAGE BUTTONS (CHIA NHỎ, GHÉP LẠI, KIỂM TRA...)
  // --------------------------------------------------------------------------

  const handleAct3Subdivide = () => {
    playM05Tone('step', soundEnabled);
    setAct3CoalesceMsg('');
    const nextK = act3CandDen >= 12 ? 2 : Math.min(12, Math.floor(12 / act3Base.den));
    // Subdivide candidate by 2 if within <= 24, otherwise cycle k on baseFraction
    if (act3CandDen * 2 <= 24) {
      setAct3CandNum((n) => n * 2);
      setAct3CandDen((d) => d * 2);
      setAnsNum(act3CandNum * 2);
      setAnsDen(act3CandDen * 2);
      setAct3CoalesceMsg(
        `Chia nhỏ mỗi phần thành 2 phần bằng nhau: (${act3CandNum} × 2)/(${act3CandDen} × 2) = ${
          act3CandNum * 2
        }/${act3CandDen * 2}. Lượng được tô giữ nguyên!`
      );
    } else {
      const k = (act3FactorK % Math.max(2, nextK)) + 1;
      const exp = expandFractionByK(act3Base, k);
      setAct3FactorK(k);
      setAct3CandNum(exp.num);
      setAct3CandDen(exp.den);
      setAnsNum(exp.num);
      setAnsDen(exp.den);
      setAct3CoalesceMsg(
        `Nhân cả tử và mẫu của ${act3Base.num}/${act3Base.den} với k = ${k}: được ${exp.num}/${exp.den}.`
      );
    }
  };

  const handleAct3Coalesce = () => {
    playM05Tone('step', soundEnabled);
    const g = gcdInt(act3CandNum, act3CandDen);
    const stepDivisor = g > 1 ? (g % 2 === 0 ? 2 : g % 3 === 0 ? 3 : g) : 2;
    const attempt = coalesceFractionByM(
      { num: act3CandNum, den: act3CandDen },
      stepDivisor
    );
    setAct3CoalesceMsg(attempt.reasonVi);
    if (attempt.canCoalesce && stepDivisor > 1) {
      setAct3CandNum(attempt.result.num);
      setAct3CandDen(attempt.result.den);
      setAnsNum(attempt.result.num);
      setAnsDen(attempt.result.den);
    }
  };

  const handleAct6PlayAnimation = () => {
    cancelRunningAnimations();
    const myToken = animTokenRef.current;
    if (reduceMotion) {
      setAct6Step(5);
      return;
    }
    setAct6IsPlaying(true);
    setAct6Step(1);
    const stepDelay = 750;
    ([2, 3, 4, 5] as const).forEach((st, idx) => {
      window.setTimeout(() => {
        if (animTokenRef.current !== myToken) return;
        setAct6Step(st);
        playM05Tone('step', soundEnabled);
        if (st === 5) setAct6IsPlaying(false);
      }, (idx + 1) * stepDelay);
    });
  };

  const handleCheckAnswer = () => {
    let isCorrect = false;
    let status: typeof submissionStatus = 'INCORRECT';
    let msg = '';

    if (currentTask.answerType === 'FRACTION' && currentTask.expectedFraction) {
      let submittedFrac: RawFraction;
      if (inputMode === 'MIXED') {
        if (ansMixedDen === 0) {
          setSubmissionStatus('INVALID_ZERO_DEN');
          setFeedbackMessage(
            'Mẫu số không được bằng 0! Hãy nhập mẫu số là số nguyên dương.'
          );
          return;
        }
        submittedFrac = fromMixedNumberInput(
          ansMixedNeg,
          ansMixedWhole,
          ansMixedNum,
          ansMixedDen
        );
      } else {
        submittedFrac =
          activeActivityId === 'EQUIVALENT_FRACTIONS'
            ? { num: act3CandNum, den: act3CandDen }
            : activeActivityId === 'FRACTION_NUMBER_LINE' && learningMode === 'CHALLENGE'
            ? { num: ansNum, den: ansDen }
            : { num: ansNum, den: ansDen };
      }

      const outcome = validateStudentFractionSubmission(
        submittedFrac,
        currentTask.expectedFraction,
        Boolean(currentTask.requireSimplified)
      );
      status = outcome.status;
      msg = outcome.messageVi;
      isCorrect = outcome.status === 'CORRECT';
    } else if (
      currentTask.answerType === 'INTEGER' &&
      currentTask.expectedInteger !== undefined
    ) {
      if (cleanInt(ansInteger) === cleanInt(currentTask.expectedInteger)) {
        isCorrect = true;
        status = 'CORRECT';
        msg = `Chính xác! Đáp án đúng là ${currentTask.expectedInteger}.`;
      } else {
        status = 'INCORRECT';
        msg = `Chưa chính xác (bạn nhập ${ansInteger}). Hãy xem gợi ý để kiểm tra lại nhé!`;
      }
    } else if (
      currentTask.answerType === 'OPERATOR' &&
      currentTask.expectedOperator
    ) {
      if (ansOperator === currentTask.expectedOperator) {
        isCorrect = true;
        status = 'CORRECT';
        msg = `Chính xác! ${explainFractionComparisonVi(act4Left, act4Right)}`;
      } else {
        status = 'INCORRECT';
        msg = `Dấu "${ansOperator}" chưa đúng. Hãy quan sát độ dài hai dải hoặc bật Lớp chia mẫu số chung!`;
      }
    } else if (
      currentTask.answerType === 'CHOICE' &&
      currentTask.expectedChoice
    ) {
      if (ansChoice === currentTask.expectedChoice) {
        isCorrect = true;
        status = 'CORRECT';
        msg = `Chính xác! ${currentTask.explanationVi}`;
      } else {
        status = 'INCORRECT';
        msg = 'Lựa chọn chưa chính xác. Hãy chú ý điều kiện các phần phải có diện tích bằng nhau!';
      }
    } else if (
      currentTask.answerType === 'SORT_LIST' &&
      currentTask.expectedSortStrings
    ) {
      const currentStrs = act4SortCards.map((f) => `${f.num}/${f.den}`);
      const matched =
        currentStrs.length === currentTask.expectedSortStrings.length &&
        currentStrs.every((s, idx) => s === currentTask.expectedSortStrings![idx]);
      if (matched) {
        isCorrect = true;
        status = 'CORRECT';
        msg = `Chính xác! Thứ tự đúng là: ${currentStrs.join(' < ')}.`;
      } else {
        status = 'INCORRECT';
        msg = `Thứ tự hiện tại (${currentStrs.join(', ')}) chưa đúng. Hãy quy đồng mẫu số để so sánh!`;
      }
    }

    setSubmissionStatus(status);
    setFeedbackMessage(msg);

    if (isCorrect) {
      playM05Tone('correct', soundEnabled);
      setProgress((prev) => {
        const alreadyDone = prev.completedTaskIds.includes(currentTask.id);
        const nextCompleted = alreadyDone
          ? prev.completedTaskIds
          : [...prev.completedTaskIds, currentTask.id];
        const nextGroups = prev.groups.map((g) =>
          g.id === activeGroupId
            ? { ...g, points: g.points + 10, turns: g.turns + 1 }
            : g
        );
        return {
          ...prev,
          completedTaskIds: nextCompleted,
          score: prev.score + (alreadyDone ? 2 : 10),
          streak: prev.streak + 1,
          lastActivityId: activeActivityId,
          groups: nextGroups,
        };
      });

      const record: MathActivityResultRecord = {
        id: `m05-${Date.now()}`,
        toolId: 'M05',
        activityId: currentTask.id,
        studentName:
          progress.classroomMode === 'GROUP'
            ? progress.groups.find((g) => g.id === activeGroupId)?.name || currentUserName
            : currentUserName,
        className: selectedClassName,
        completedSteps: [
          'PREDICT',
          'MANIPULATE',
          'OBSERVE',
          'EXPLAIN',
          'CONCLUDE',
          'PRACTICE',
        ],
        practiceAnswer:
          currentTask.answerType === 'FRACTION'
            ? `${ansNum}/${ansDen}`
            : String(ansInteger),
        isCorrect: true,
        score: 100,
        maxScore: 100,
        completedAt: new Date().toISOString(),
      };
      saveMathActivityResult(record);
      if (onResultSaved) {
        onResultSaved(record);
      }
    }
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          setInPagePresentation((v) => !v);
        });
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
    setInPagePresentation((v) => !v);
    if (onTogglePresentationMode) onTogglePresentationMode();
  };

  const isPresentationActive = isFullscreen || inPagePresentation || isPresentationMode;

  // --------------------------------------------------------------------------
  // 5. NUMBER LINE POINTER HANDLERS FOR ACTIVITY 5
  // --------------------------------------------------------------------------
  const act5Viewport = useMemo(
    () => ({
      minInt: act5ShowNegative ? -2 : 0,
      maxInt: 2,
      subdivisionsPerUnit: act5Subdivisions,
      leftPx: 64,
      rightPx: 716,
    }),
    [act5ShowNegative, act5Subdivisions]
  );

  const updateAct5PointFromClientX = useCallback(
    (clientX: number) => {
      if (!nlSvgRef.current) return;
      const rect = nlSvgRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const svgX = ((clientX - rect.left) / rect.width) * 780;
      const snapped = svgXToSnappedFraction(svgX, act5Viewport);
      setAct5PointNum(snapped.num);
      setAnsNum(snapped.num);
      setAnsDen(snapped.den);
    },
    [act5Viewport]
  );

  // --------------------------------------------------------------------------
  // 6. STAGE CENTER RENDERER PER ACTIVITY (1..6)
  // --------------------------------------------------------------------------

  const renderCenterStageContent = () => {
    // ========================================================================
    // ACTIVITY 1: CHIA PHẦN BẰNG NHAU (EQUAL_PARTS)
    // ========================================================================
    if (activeActivityId === 'EQUAL_PARTS') {
      const centralAngleDeg = Math.round((360 / act1TotalParts) * 10) / 10;
      return (
        <div className="w-full flex flex-col items-center gap-3">
          {/* Top Equation / Status Card */}
          <div className="px-6 py-2.5 rounded-2xl bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-sm flex flex-wrap items-center justify-center gap-3">
            {act1UnequalDemo ? (
              <div className="text-sm sm:text-base font-black text-[#B45309] flex items-center gap-2">
                <span>⚠️ Chia {act1TotalParts} mảnh KHÔNG ĐỀU:</span>
                <span className="underline">
                  Mỗi mảnh không bằng 1/{act1TotalParts} đơn vị!
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm sm:text-base font-extrabold text-[#12382B]">
                  Đã tô {act1ShadedParts} trong {act1TotalParts} phần bằng nhau:
                </span>
                <StackedFractionBadge
                  fraction={{ num: act1ShadedParts, den: act1TotalParts }}
                  size="lg"
                  variant="cream_tile"
                />
                {act1Model === 'CIRCLE' && (
                  <span className="text-xs font-bold text-[#0F766E] bg-[#E6F4EF] px-2.5 py-1 rounded-xl">
                    Mỗi góc ở tâm = {centralAngleDeg}°
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 3D Pedestal Stage with Models */}
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 px-4 py-2">
            {act1Model === 'CIRCLE' ? (
              <OrthographicFractionCircleSVG
                totalParts={act1TotalParts}
                shadedCount={act1ShadedParts}
                isUnequalDemo={act1UnequalDemo}
                interactive={true}
                sizePx={195}
                onTogglePart={(idx) => {
                  const next = idx + 1 === act1ShadedParts ? idx : idx + 1;
                  setAct1ShadedParts(next);
                  setAnsNum(next);
                  setAnsDen(act1TotalParts);
                }}
              />
            ) : (
              <div className="w-full max-w-[460px]">
                <OrthographicFractionBarSVG
                  totalParts={act1TotalParts}
                  shadedCount={act1ShadedParts}
                  isUnequalDemo={act1UnequalDemo}
                  showPartLabels={showPartLabels}
                  interactive={true}
                  onTogglePart={(idx) => {
                    const next = idx + 1 === act1ShadedParts ? idx : idx + 1;
                    setAct1ShadedParts(next);
                    setAnsNum(next);
                    setAnsDen(act1TotalParts);
                  }}
                />
              </div>
            )}

            <FractionRobotGuide3D mood={act1UnequalDemo ? 'thinking' : 'happy'} />
          </div>

          {/* Pedagogical Explanation Banner when Unequal Demo is active */}
          {act1UnequalDemo && (
            <div className="max-w-xl px-4 py-2 rounded-xl bg-amber-50 border border-amber-300 text-xs sm:text-sm font-bold text-amber-950 text-center">
              Giải thích: Dù hình được cắt thành {act1TotalParts} miếng và tô {act1ShadedParts} miếng, nhưng vì diện tích các miếng không bằng nhau nên phần được tô KHÔNG biểu diễn phân số {act1ShadedParts}/{act1TotalParts}!
            </div>
          )}
        </div>
      );
    }

    // ========================================================================
    // ACTIVITY 2: TẠO VÀ ĐỌC PHÂN SỐ (BUILD_READ_FRACTION)
    // Supports 0, < 1, = 1, and > 1 using MULTIPLE equal-sized unit frames!
    // ========================================================================
    if (activeActivityId === 'BUILD_READ_FRACTION') {
      const cleanDen = Math.max(1, Math.min(12, act2Den));
      const cleanNum = Math.max(0, Math.min(cleanDen * 3, act2Num));
      const unitsNeeded = Math.max(1, Math.ceil(cleanNum / cleanDen));
      const mixed = toMixedNumber({ num: cleanNum, den: cleanDen });
      const viReading = readFractionInVietnamese({ num: cleanNum, den: cleanDen });

      return (
        <div className="w-full flex flex-col items-center gap-3">
          {/* Top Formula & Vietnamese Reading Card */}
          <div className="px-6 py-2.5 rounded-2xl bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-sm flex flex-wrap items-center justify-center gap-4">
            <StackedFractionBadge
              fraction={{ num: cleanNum, den: cleanDen }}
              size="lg"
              variant="cream_tile"
              highlightNum
              highlightDen
            />
            {mixed && mixed.remNum > 0 && (
              <>
                <span className="text-2xl font-black text-[#12382B]">=</span>
                <StackedFractionBadge
                  wholePart={mixed.whole}
                  fraction={{ num: mixed.remNum, den: cleanDen }}
                  size="lg"
                  variant="amber"
                />
              </>
            )}
            <div className="text-left">
              <div className="text-xs font-bold text-[#5C6E64]">Cách đọc bằng chữ:</div>
              <div className="text-sm sm:text-base font-black text-[#12382B]">
                “{viReading}”
              </div>
            </div>
          </div>

          {/* Equal-sized Unit Frames (1, 2, or 3 units — NEVER shrinks the unit size!) */}
          <div className="w-full flex flex-col md:flex-row items-center justify-center gap-4 px-3">
            <div className="flex-1 flex flex-wrap items-center justify-center gap-4">
              {Array.from({ length: unitsNeeded }, (_, uIdx) => {
                const remaining = Math.max(0, cleanNum - uIdx * cleanDen);
                const shadedInThisUnit = Math.min(cleanDen, remaining);
                return act2Model === 'CIRCLE' ? (
                  <div key={uIdx} className="flex flex-col items-center">
                    <span className="text-xs font-extrabold text-[#136F50] mb-1">
                      Đơn vị {uIdx + 1} ({shadedInThisUnit}/{cleanDen})
                    </span>
                    <OrthographicFractionCircleSVG
                      totalParts={cleanDen}
                      shadedCount={shadedInThisUnit}
                      sizePx={unitsNeeded > 1 ? 148 : 184}
                    />
                  </div>
                ) : (
                  <div key={uIdx} className="w-full max-w-[430px]">
                    <OrthographicFractionBarSVG
                      totalParts={cleanDen}
                      shadedCount={shadedInThisUnit}
                      showPartLabels={showPartLabels}
                      unitIndexLabel={`Khung đơn vị ${uIdx + 1}: Đã lấy ${shadedInThisUnit}/${cleanDen} đơn vị`}
                    />
                  </div>
                );
              })}
            </div>

            <FractionRobotGuide3D mood="happy" />
          </div>
        </div>
      );
    }

    // ========================================================================
    // ACTIVITY 3: PHÂN SỐ BẰNG NHAU (EQUIVALENT_FRACTIONS — FEATURED CENTERPIECE)
    // Matches the uploaded reference image 1:1!
    // ========================================================================
    if (activeActivityId === 'EQUIVALENT_FRACTIONS') {
      const safeCandDen = Math.max(1, Math.min(24, act3CandDen));
      const safeCandNum = Math.max(
        -safeCandDen * 2,
        Math.min(safeCandDen * 2, act3CandNum)
      );

      return (
        <div className="w-full flex flex-col items-center gap-2.5">
          {/* Center Orange-Bordered Equation Card matching reference image */}
          <div className="px-8 py-2.5 rounded-[22px] bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-[0_6px_18px_rgba(224,122,27,0.14)] inline-flex items-center gap-5">
            <StackedFractionBadge fraction={act3Base} size="xl" />
            <span
              className={`text-2xl sm:text-3xl font-black ${
                act3IsEquivalent ? 'text-[#12382B]' : 'text-[#DC2626]'
              }`}
            >
              {act3IsEquivalent ? '=' : '≠'}
            </span>
            <StackedFractionBadge
              fraction={{ num: safeCandNum, den: safeCandDen }}
              size="xl"
            />
          </div>

          {/* 3D Studio Tabletop: Left Wheel + Center Equal Unit Bars + Right Robot with Pointer */}
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-3 px-2 sm:px-5 pt-1">
            {/* Left 3D Fraction Wheel on Wooden Stand */}
            <div className="hidden sm:flex flex-col items-center shrink-0">
              <FractionWheelStand3D
                totalParts={Math.max(2, Math.min(12, safeCandDen))}
                shadedParts={Math.max(0, safeCandNum)}
              />
            </div>

            {/* Center Two Identical-Length Unit Bars on Cream Pedestal */}
            <div className="flex-1 w-full max-w-[540px] flex flex-col gap-3 bg-[#F3E9D6]/90 p-3.5 rounded-[22px] border border-[#DACBB2] shadow-[0_8px_0_#C8B698]">
              {/* Top Bar: Base Fraction (e.g. 1/2) */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <OrthographicFractionBarSVG
                    totalParts={Math.abs(act3Base.den)}
                    shadedCount={Math.max(0, act3Base.num)}
                    showPartLabels={showPartLabels}
                  />
                </div>
                <StackedFractionBadge
                  fraction={act3Base}
                  size="md"
                  variant="cream_tile"
                />
              </div>

              {/* Bottom Bar: Candidate / Subdivided Fraction (e.g. 2/4) */}
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <OrthographicFractionBarSVG
                    totalParts={safeCandDen}
                    shadedCount={Math.max(0, safeCandNum)}
                    showPartLabels={showPartLabels}
                    interactive={true}
                    onTogglePart={(idx) => {
                      const next = idx + 1 === safeCandNum ? idx : idx + 1;
                      setAct3CandNum(next);
                      setAnsNum(next);
                      setAnsDen(safeCandDen);
                    }}
                  />
                </div>
                <StackedFractionBadge
                  fraction={{ num: safeCandNum, den: safeCandDen }}
                  size="md"
                  variant="cream_tile"
                />
              </div>
            </div>

            {/* Right 3D Explorer Robot with Pointer Stick */}
            <div className="hidden md:flex flex-col items-center shrink-0">
              <FractionRobotGuide3D
                mood={act3IsEquivalent ? 'happy' : 'thinking'}
              />
            </div>
          </div>

          {act3CoalesceMsg && (
            <div className="px-4 py-1.5 rounded-xl bg-[#FAF4E8] border border-[#D8C8AE] text-xs sm:text-sm font-bold text-[#134E3A] text-center max-w-xl">
              {act3CoalesceMsg}
            </div>
          )}
        </div>
      );
    }

    // ========================================================================
    // ACTIVITY 4: SO SÁNH PHÂN SỐ (COMPARE_FRACTIONS)
    // ========================================================================
    if (activeActivityId === 'COMPARE_FRACTIONS') {
      const commonDen = lcmInt(act4Left.den, act4Right.den);
      const trueOp = compareExactFractions(act4Left, act4Right);
      const shownOp =
        learningMode === 'CHALLENGE' && submissionStatus === 'IDLE'
          ? ansOperator
          : trueOp;

      if (act4SubMode === 'SORT') {
        return (
          <div className="w-full flex flex-col items-center gap-3 px-4">
            <div className="text-sm sm:text-base font-extrabold text-[#12382B]">
              Sắp xếp các thẻ phân số và đối chiếu độ dài trên cùng đơn vị:
            </div>
            <div className="w-full max-w-[520px] space-y-2.5 bg-[#F3E9D6]/90 p-4 rounded-2xl border border-[#DACBB2]">
              {act4SortCards.map((f, idx) => (
                <div key={`${f.num}/${f.den}-${idx}`} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-black text-[#475E54]">#{idx + 1}</span>
                  <div className="flex-1">
                    <OrthographicFractionBarSVG
                      totalParts={f.den}
                      shadedCount={Math.max(0, f.num)}
                      commonDenOverlay={act4ShowCommonGrid ? 8 : undefined}
                      showPartLabels={showPartLabels}
                    />
                  </div>
                  <StackedFractionBadge fraction={f} size="sm" variant="cream_tile" />
                </div>
              ))}
            </div>
          </div>
        );
      }

      return (
        <div className="w-full flex flex-col items-center gap-3 px-3">
          {/* Top Comparison Card */}
          <div className="px-7 py-2.5 rounded-2xl bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-sm inline-flex items-center gap-4">
            <StackedFractionBadge fraction={act4Left} size="lg" />
            <span className="w-11 h-11 rounded-xl bg-[#136F50] text-white text-2xl font-black flex items-center justify-center">
              {shownOp}
            </span>
            <StackedFractionBadge fraction={act4Right} size="lg" />
          </div>

          {act4UseNumberLine || act4Left.num < 0 || act4Right.num < 0 ? (
            /* Number line comparison view (required for negative fractions like -2/3 < -1/3) */
            <div className="w-full max-w-[640px] bg-[#FAF4E8] p-4 rounded-2xl border border-[#DACBB2]">
              <svg viewBox="0 0 640 120" className="w-full h-auto select-none">
                <line x1="40" y1="64" x2="600" y2="64" stroke="#12382B" strokeWidth="3.2" />
                {[-1, 0, 1].map((intVal) => {
                  const x = 320 + intVal * 220;
                  return (
                    <g key={intVal}>
                      <line x1={x} y1="52" x2={x} y2="76" stroke="#12382B" strokeWidth="3" />
                      <text x={x} y="98" textAnchor="middle" fontSize="16" fontWeight="900" fill="#12382B">
                        {intVal}
                      </text>
                    </g>
                  );
                })}
                {[
                  { f: act4Left, color: '#D96B16', yOff: -28 },
                  { f: act4Right, color: '#136F50', yOff: -54 },
                ].map((pt, i) => {
                  const x = 320 + (pt.f.num / pt.f.den) * 220;
                  return (
                    <g key={i} transform={`translate(${x}, 64)`}>
                      <circle cx="0" cy="0" r="7" fill={pt.color} stroke="#FFFFFF" strokeWidth="2" />
                      <rect x="-24" y={pt.yOff} width="48" height="22" rx="6" fill={pt.color} />
                      <text x="0" y={pt.yOff + 15} textAnchor="middle" fontSize="12" fontWeight="900" fill="#FFFFFF">
                        {pt.f.num}/{pt.f.den}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* Two aligned Equal-Unit Bars */
            <div className="w-full max-w-[540px] flex flex-col gap-3 bg-[#F3E9D6]/90 p-3.5 rounded-[22px] border border-[#DACBB2]">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <OrthographicFractionBarSVG
                    totalParts={act4Left.den}
                    shadedCount={act4Left.num}
                    commonDenOverlay={act4ShowCommonGrid ? commonDen : undefined}
                    showPartLabels={showPartLabels}
                  />
                </div>
                <StackedFractionBadge fraction={act4Left} size="md" variant="cream_tile" />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <OrthographicFractionBarSVG
                    totalParts={act4Right.den}
                    shadedCount={act4Right.num}
                    commonDenOverlay={act4ShowCommonGrid ? commonDen : undefined}
                    accentColor="amber"
                    showPartLabels={showPartLabels}
                  />
                </div>
                <StackedFractionBadge fraction={act4Right} size="md" variant="cream_tile" />
              </div>
            </div>
          )}
        </div>
      );
    }

    // ========================================================================
    // ACTIVITY 5: PHÂN SỐ TRÊN TRỤC SỐ (FRACTION_NUMBER_LINE)
    // ========================================================================
    if (activeActivityId === 'FRACTION_NUMBER_LINE') {
      const pointFrac: RawFraction = { num: act5PointNum, den: act5Subdivisions };
      const simpPoint = simplifyFraction(pointFrac).simplified;
      const mixedPoint = toMixedNumber(pointFrac);
      const xPoint = fractionToSvgX(pointFrac, act5Viewport);
      const axisY = 108;

      const minTick = act5Viewport.minInt * act5Subdivisions;
      const maxTick = act5Viewport.maxInt * act5Subdivisions;
      const ticks: number[] = [];
      for (let k = minTick; k <= maxTick; k++) ticks.push(k);

      return (
        <div className="w-full flex flex-col items-center gap-2.5 px-3">
          {/* Top Coordinate Readout Banner */}
          <div className="px-6 py-2 rounded-2xl bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-sm flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm font-extrabold text-[#12382B]">
              Điểm trên trục số:
            </span>
            {act5HideMysteryLabel && learningMode === 'CHALLENGE' && submissionStatus === 'IDLE' ? (
              <span className="px-3 py-1 rounded-xl bg-amber-100 text-amber-900 font-black">
                ? / {act5Subdivisions}
              </span>
            ) : (
              <>
                <StackedFractionBadge fraction={pointFrac} size="md" variant="cream_tile" />
                {!simplifyFraction(pointFrac).isAlreadySimplified && pointFrac.num !== 0 && (
                  <>
                    <span className="font-black text-[#12382B]">=</span>
                    <StackedFractionBadge fraction={simpPoint} size="md" variant="emerald" />
                  </>
                )}
                {mixedPoint && mixedPoint.remNum > 0 && (
                  <span className="text-xs sm:text-sm font-black text-[#B45309] bg-amber-100 px-2.5 py-1 rounded-xl">
                    Hỗn số: {mixedPoint.displayText}
                  </span>
                )}
              </>
            )}
            <span className="text-xs font-bold text-[#0F766E] bg-[#E6F4EF] px-2.5 py-1 rounded-xl">
              1 đơn vị chia {act5Subdivisions} khoảng ({act5Subdivisions + 1} mốc trên [0; 1])
            </span>
          </div>

          {/* Orthographic SVG Fraction Number Line */}
          <div className="w-full bg-[#FAF5EA] rounded-[22px] border border-[#DACBB2] p-2 shadow-inner">
            <svg
              ref={nlSvgRef}
              viewBox="0 0 780 175"
              className="w-full h-auto select-none touch-none overflow-visible cursor-pointer"
              onPointerMove={(e) => {
                if (act5IsDragging) updateAct5PointFromClientX(e.clientX);
              }}
              onPointerUp={() => setAct5IsDragging(false)}
              onPointerLeave={() => setAct5IsDragging(false)}
              onClick={(e) => updateAct5PointFromClientX(e.clientX)}
            >
              {/* Main Axis */}
              <line
                x1={act5Viewport.leftPx - 24}
                y1={axisY}
                x2={act5Viewport.rightPx + 24}
                y2={axisY}
                stroke="#12382B"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <polygon
                points={`${act5Viewport.rightPx + 30},${axisY} ${act5Viewport.rightPx + 18},${axisY - 6} ${act5Viewport.rightPx + 18},${axisY + 6}`}
                fill="#12382B"
              />
              <polygon
                points={`${act5Viewport.leftPx - 30},${axisY} ${act5Viewport.leftPx - 18},${axisY - 6} ${act5Viewport.leftPx - 18},${axisY + 6}`}
                fill="#12382B"
              />

              {/* Highlighted Interval Bracket from 0 to point */}
              <line
                x1={fractionToSvgX({ num: 0, den: 1 }, act5Viewport)}
                y1={axisY}
                x2={xPoint}
                y2={axisY}
                stroke={act5PointNum < 0 ? '#D96B16' : '#136F50'}
                strokeWidth="6"
              />

              {/* Tick Marks */}
              {ticks.map((k) => {
                const tx = fractionToSvgX({ num: k, den: act5Subdivisions }, act5Viewport);
                const isInt = k % act5Subdivisions === 0;
                const intVal = k / act5Subdivisions;
                return (
                  <g key={k}>
                    <line
                      x1={tx}
                      y1={isInt ? axisY - 14 : axisY - 7}
                      x2={tx}
                      y2={isInt ? axisY + 14 : axisY + 7}
                      stroke={intVal === 0 && isInt ? '#D96B16' : '#12382B'}
                      strokeWidth={isInt ? '3.2' : '1.6'}
                    />
                    {isInt ? (
                      <text
                        x={tx}
                        y={axisY + 36}
                        textAnchor="middle"
                        fontSize="19"
                        fontWeight="900"
                        fill={intVal === 0 ? '#D96B16' : '#12382B'}
                      >
                        {intVal}
                      </text>
                    ) : (
                      showPartLabels &&
                      act5Subdivisions <= 8 && (
                        <text
                          x={tx}
                          y={axisY + 32}
                          textAnchor="middle"
                          fontSize="11.5"
                          fontWeight="700"
                          fill="#52665C"
                        >
                          {k}/{act5Subdivisions}
                        </text>
                      )
                    )}
                  </g>
                );
              })}

              {/* Draggable Marker Pin */}
              <g
                transform={`translate(${xPoint}, ${axisY})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setAct5IsDragging(true);
                }}
              >
                <circle cx="0" cy="0" r="9" fill="#E07A1B" stroke="#FFFFFF" strokeWidth="2.5" />
                <rect
                  x="-32"
                  y="-54"
                  width="64"
                  height="34"
                  rx="10"
                  fill="#136F50"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="-32"
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="900"
                  fill="#FFFFFF"
                >
                  {act5HideMysteryLabel && learningMode === 'CHALLENGE' && submissionStatus === 'IDLE'
                    ? '?'
                    : `${act5PointNum}/${act5Subdivisions}`}
                </text>
              </g>
            </svg>
          </div>
        </div>
      );
    }

    // ========================================================================
    // ACTIVITY 6: CỘNG, TRỪ PHÂN SỐ (ADD_SUB_FRACTIONS)
    // Featured example: 1/2 + 1/3 = 3/6 + 2/6 = 5/6
    // ========================================================================
    const c = act6Calculation;
    const hideResultInChallenge =
      learningMode === 'CHALLENGE' && submissionStatus === 'IDLE' && act6Step < 5;

    return (
      <div className="w-full flex flex-col items-center gap-2.5 px-3">
        {/* Top Step-by-Step Formula Equation Banner */}
        <div className="px-6 py-2 rounded-2xl bg-[#FAF4E8] border-2 border-[#E07A1B] shadow-sm flex flex-wrap items-center justify-center gap-2.5">
          <StackedFractionBadge fraction={c.a} size="md" />
          <span className="text-xl font-black text-[#12382B]">{c.op}</span>
          <StackedFractionBadge fraction={c.b} size="md" />

          {!c.isSameDenominator && act6Step >= 2 && (
            <>
              <span className="text-xl font-black text-[#12382B]">=</span>
              <StackedFractionBadge fraction={c.expandedA} size="md" variant="amber" />
              <span className="text-xl font-black text-[#12382B]">{c.op}</span>
              <StackedFractionBadge fraction={c.expandedB} size="md" variant="amber" />
            </>
          )}

          <span className="text-xl font-black text-[#12382B]">=</span>
          {hideResultInChallenge ? (
            <span className="px-4 py-1.5 rounded-xl bg-amber-100 text-amber-900 font-black text-xl">
              ?
            </span>
          ) : (
            <>
              <StackedFractionBadge
                fraction={c.unsimplifiedResult}
                size="md"
                variant="cream_tile"
              />
              {c.gcdUsed > 1 && c.unsimplifiedResult.num !== 0 && act6Step >= 5 && (
                <>
                  <span className="text-xl font-black text-[#12382B]">=</span>
                  <StackedFractionBadge
                    fraction={c.simplifiedResult}
                    size="md"
                    variant="emerald"
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Step Indicator Pill */}
        <div className="text-xs sm:text-sm font-extrabold text-[#134E3A] bg-[#E6F4EF] px-4 py-1 rounded-full border border-[#B7DFD0]">
          Bước {act6Step}/5: {c.stepsVi[act6Step - 1]?.title}
        </div>

        {/* Visual Model: Area Strip (when non-negative & commonDen <= 24) OR Number Line (when negative result like 1/3 - 2/3 = -1/3) */}
        {act6ViewMode === 'STRIP' && c.canUseAreaModel ? (
          <div className="w-full max-w-[560px] space-y-2 bg-[#F3E9D6]/90 p-3 rounded-[20px] border border-[#DACBB2]">
            {/* Strip A */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs font-black text-[#12382B]">
                Phân số 1:
              </span>
              <div className="flex-1">
                <OrthographicFractionBarSVG
                  totalParts={act6Step >= 2 ? c.commonDen : c.a.den}
                  shadedCount={act6Step >= 2 ? c.expandedA.num : c.a.num}
                  showPartLabels={showPartLabels}
                />
              </div>
            </div>

            {/* Strip B */}
            <div className="flex items-center gap-3">
              <span className="w-20 text-xs font-black text-[#D96B16]">
                Phân số 2:
              </span>
              <div className="flex-1">
                <OrthographicFractionBarSVG
                  totalParts={act6Step >= 2 ? c.commonDen : c.b.den}
                  shadedCount={act6Step >= 2 ? c.expandedB.num : c.b.num}
                  accentColor="amber"
                  showPartLabels={showPartLabels}
                />
              </div>
            </div>

            {/* Result Strip(s) at Step >= 4 */}
            {act6Step >= 4 && !hideResultInChallenge && (
              <div className="pt-1.5 border-t border-[#D6C5A9] flex items-center gap-3">
                <span className="w-20 text-xs font-black text-[#136F50]">
                  Kết quả:
                </span>
                <div className="flex-1 space-y-1.5">
                  {Array.from(
                    {
                      length: Math.max(
                        1,
                        Math.ceil(c.unsimplifiedResult.num / c.commonDen)
                      ),
                    },
                    (_, uIdx) => {
                      const rem = Math.max(
                        0,
                        c.unsimplifiedResult.num - uIdx * c.commonDen
                      );
                      return (
                        <OrthographicFractionBarSVG
                          key={uIdx}
                          totalParts={c.commonDen}
                          shadedCount={Math.min(c.commonDen, rem)}
                          showPartLabels={showPartLabels}
                        />
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Directed Number Line for Negative Results (e.g., 1/3 - 2/3 = -1/3) */
          <div className="w-full max-w-[640px] bg-[#FAF4E8] p-3.5 rounded-2xl border border-[#DACBB2]">
            <div className="text-xs font-bold text-[#B45309] mb-1 text-center">
              Biểu diễn bằng bước nhảy có hướng trên trục số (không dùng diện tích âm):
            </div>
            <svg viewBox="0 0 640 120" className="w-full h-auto select-none">
              <line x1="40" y1="74" x2="600" y2="74" stroke="#12382B" strokeWidth="3" />
              {[-1, 0, 1, 2].map((iv) => {
                const x = 220 + iv * 160;
                return (
                  <g key={iv}>
                    <line x1={x} y1="64" x2={x} y2="84" stroke="#12382B" strokeWidth="2.8" />
                    <text x={x} y="104" textAnchor="middle" fontSize="15" fontWeight="900" fill="#12382B">
                      {iv}
                    </text>
                  </g>
                );
              })}
              {(() => {
                const xStart = 220 + (c.a.num / c.a.den) * 160;
                const xEnd =
                  220 + (c.unsimplifiedResult.num / c.unsimplifiedResult.den) * 160;
                const midX = (xStart + xEnd) / 2;
                return (
                  <g>
                    <path
                      d={`M ${xStart} 74 Q ${midX} 22 ${xEnd} 74`}
                      stroke="#D96B16"
                      strokeWidth="3.2"
                      fill="none"
                    />
                    <circle cx={xStart} cy="74" r="6" fill="#136F50" />
                    <circle cx={xEnd} cy="74" r="6.5" fill="#D96B16" />
                    <text x={midX} y="34" textAnchor="middle" fontSize="13" fontWeight="900" fill="#D96B16">
                      {c.op} ({c.b.num}/{c.b.den})
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`w-full rounded-[26px] bg-[#F5EFE2] text-[#12382B] border border-[#DED3BE] shadow-[0_14px_38px_rgba(18,56,43,0.10)] overflow-hidden select-none ${
        isPresentationActive ? 'fixed inset-0 z-50 rounded-none overflow-y-auto' : ''
      }`}
      style={{
        fontFamily:
          '"Be Vietnam Pro", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ====================================================================
          1. TOP HEADER BAR (MATCHING UPLOADED REFERENCE IMAGE)
          ==================================================================== */}
      <header className="bg-gradient-to-b from-[#FAF6EE] to-[#EFE6D5] border-b border-[#DED2BC] px-3.5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <TayDoFractionBrandLogo3D />

        {/* Right Action Pills: Về thư viện | Khám phá | Thử thách | Tổ chức lớp | Toàn màn hình */}
        <div className="flex flex-wrap items-center gap-2">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="min-h-[44px] px-4 py-2 rounded-full bg-[#FAF6ED] hover:bg-[#EFE7D6] border border-[#D4C7AE] text-[#173A30] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-2xs transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-[#136F50]" />
              <span>Về thư viện</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setLearningMode('EXPLORE')}
            aria-pressed={learningMode === 'EXPLORE'}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition cursor-pointer ${
              learningMode === 'EXPLORE'
                ? 'bg-[#136F50] text-white border-[#0C4F38] shadow-[0_4px_12px_rgba(19,111,80,0.28)]'
                : 'bg-[#FAF6ED] text-[#173A30] border-[#D4C7AE] hover:bg-[#EFE7D6]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Khám phá</span>
          </button>

          <button
            type="button"
            onClick={() => setLearningMode('CHALLENGE')}
            aria-pressed={learningMode === 'CHALLENGE'}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition cursor-pointer ${
              learningMode === 'CHALLENGE'
                ? 'bg-gradient-to-b from-[#F59E0B] to-[#D96B16] text-white border-[#B45309] shadow-sm'
                : 'bg-[#FAF6ED] text-[#173A30] border-[#D4C7AE] hover:bg-[#EFE7D6]'
            }`}
          >
            <Trophy className="w-4 h-4 text-[#D96B16]" />
            <span>Thử thách</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClassroomModal(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-full bg-[#FAF6ED] hover:bg-[#EFE7D6] border border-[#D4C7AE] text-[#173A30] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer"
            title="Tổ chức lớp học (Cá nhân / Theo nhóm / Giáo viên trình chiếu)"
          >
            <Users className="w-4 h-4 text-[#136F50]" />
            <span className="hidden md:inline">Tổ chức lớp</span>
          </button>

          <button
            type="button"
            onClick={() => setSoundEnabled((s) => !s)}
            aria-label={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-full bg-[#FAF6ED] hover:bg-[#EFE7D6] border border-[#D4C7AE] text-[#173A30] inline-flex items-center justify-center cursor-pointer"
            title={soundEnabled ? 'Âm thanh đang bật' : 'Âm thanh mặc định tắt'}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-[#136F50]" />
            ) : (
              <VolumeX className="w-4 h-4 text-[#64748B]" />
            )}
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[#FAF6ED] hover:bg-[#EFE7D6] border border-[#D4C7AE] text-[#173A30] text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            {isPresentationActive ? (
              <>
                <Minimize2 className="w-4 h-4" />
                <span>Thoát trình chiếu</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                <span>Toàn màn hình</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          2. MAIN 3-COLUMN WORKSPACE (LEFT 6 ACTIVITIES | CENTER STAGE | RIGHT MISSION)
          ==================================================================== */}
      <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* ------------------------------------------------------------------
            LEFT SIDEBAR: 6 ACTIVITIES LIST
            ------------------------------------------------------------------ */}
        {!isPresentationActive && (
          <aside
            aria-label="Danh sách 6 hoạt động Khám phá phân số"
            className="lg:col-span-3 xl:col-span-2 bg-[#F8F3E8] rounded-[24px] border border-[#DED2BC] shadow-xs flex flex-col justify-between overflow-hidden"
          >
            <div>
              <div className="bg-gradient-to-r from-[#136F50] to-[#0E543C] text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>6 hoạt động</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLeftMobileMenu((v) => !v)}
                  className="lg:hidden text-xs font-bold px-2.5 py-1 rounded-lg bg-white/15"
                >
                  {showLeftMobileMenu ? 'Thu gọn' : 'Mở'}
                </button>
              </div>

              <div
                className={`${
                  showLeftMobileMenu ? 'block' : 'hidden lg:block'
                } p-2.5 space-y-2`}
              >
                {M05_ACTIVITY_METADATA.map((act) => {
                  const isActive = act.id === activeActivityId;
                  const actTasks = getM05TasksByActivity(act.id);
                  const doneCount = actTasks.filter((t) =>
                    progress.completedTaskIds.includes(t.id)
                  ).length;

                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => {
                        setActiveActivityId(act.id);
                        setSelectedTaskIndex(0);
                        setShowLeftMobileMenu(false);
                      }}
                      className={`w-full min-h-[52px] px-3 py-2 rounded-2xl border-2 text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#136F50] text-white border-[#E07A1B] shadow-[0_6px_14px_rgba(19,111,80,0.25)]'
                          : 'bg-[#F3ECE0] hover:bg-[#EAE0CE] text-[#17382D] border-[#DFD3BD]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ActivitySidebarIcon3D activityId={act.id} active={isActive} />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-[13px] font-extrabold leading-tight">
                            {act.shortTitle}
                          </div>
                          {doneCount > 0 && (
                            <div
                              className={`text-[10px] font-bold mt-0.5 ${
                                isActive ? 'text-emerald-100' : 'text-[#136F50]'
                              }`}
                            >
                              Hoàn thành {doneCount}/{actTasks.length}
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-white' : 'text-[#78867F]'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Controls inside Left Sidebar */}
            <div className="p-2.5 border-t border-[#E2D7C3] space-y-1.5 text-xs">
              <button
                type="button"
                onClick={() => setShowThumbnailsStrip((v) => !v)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE7D6] hover:bg-[#E4D9C3] font-bold text-[#173A30] flex items-center justify-between cursor-pointer"
              >
                <span>Thẻ 3D 6 hoạt động</span>
                <span>{showThumbnailsStrip ? 'Thu gọn' : 'Mở lại'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowPartLabels((v) => !v)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white/80 border border-[#DFD3BD] font-bold text-[#173A30] flex items-center justify-between cursor-pointer"
              >
                <span>Nhãn 1/b trên mảnh</span>
                <span>{showPartLabels ? 'Đang hiện' : 'Đang ẩn'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReduceMotion((v) => !v)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-xl bg-white/80 border border-[#DFD3BD] font-semibold text-[#475E54] flex items-center justify-between cursor-pointer"
              >
                <span>Giảm chuyển động</span>
                <span>{reduceMotion ? 'Bật' : 'Tắt'}</span>
              </button>
            </div>
          </aside>
        )}

        {/* ------------------------------------------------------------------
            CENTER COLUMN: 3D STUDIO INTERACTIVE STAGE
            ------------------------------------------------------------------ */}
        <section
          aria-label="Sân khấu tương tác Khám phá phân số"
          className={`${
            isPresentationActive
              ? 'lg:col-span-9'
              : 'lg:col-span-6 xl:col-span-7'
          } relative rounded-[26px] border border-[#DACBB2] bg-gradient-to-b from-[#EDE2CE] via-[#FBF7EF] to-[#E3D4BA] shadow-[inset_0_2px_18px_rgba(255,255,255,0.85),0_10px_28px_rgba(18,56,43,0.08)] flex flex-col justify-between p-3 sm:p-5 overflow-hidden`}
        >
          {/* Top Center Ribbon Banner ("Khám phá phân số") */}
          <div className="flex flex-col items-center gap-1.5">
            <FractionRibbonBanner3D title="Khám phá phân số" />

            {/* Activity Headline with flanking orange lines matching reference image */}
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className="hidden sm:inline-block w-10 h-[2px] bg-[#E07A1B]" />
              <h2 className="text-lg sm:text-2xl font-black text-[#12382B] text-center tracking-tight">
                {activeMeta.fullTitle}
              </h2>
              <span className="hidden sm:inline-block w-10 h-[2px] bg-[#E07A1B]" />
            </div>
          </div>

          {/* Center Orthographic Fraction Models & 3D Props */}
          <div className="my-2 flex-1 flex items-center justify-center">
            {renderCenterStageContent()}
          </div>

          {/* Bottom Stage Action Deck (Matches "Chia nhỏ | Ghép lại | Làm lại | Kiểm tra" in reference image) */}
          <div className="pt-2 border-t border-[#DACBB2]/70 flex flex-col gap-2.5">
            {/* Activity-specific quick controls */}
            {activeActivityId === 'EQUAL_PARTS' && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
                {([
                  { id: 'CIRCLE', label: 'Hình tròn' },
                  { id: 'RECTANGLE', label: 'Hình chữ nhật' },
                  { id: 'STRIP', label: 'Dải phân số' },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAct1Model(m.id)}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-full font-extrabold border cursor-pointer ${
                      act1Model === m.id
                        ? 'bg-[#136F50] text-white border-[#0C4F38]'
                        : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}

                <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3 py-1.5 rounded-full border border-[#CBBBA0] font-bold">
                  <span>Số phần (2–12):</span>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={act1TotalParts}
                    onChange={(e) => {
                      const tot = Math.max(2, Math.min(12, cleanInt(Number(e.target.value))));
                      setAct1TotalParts(tot);
                      setAct1ShadedParts((s) => Math.min(tot, s));
                      setAnsDen(tot);
                    }}
                    className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#CBBBA0] text-center font-black"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setAct1UnequalDemo((v) => !v)}
                  className={`min-h-[40px] px-3.5 py-1.5 rounded-full font-extrabold border cursor-pointer ${
                    act1UnequalDemo
                      ? 'bg-[#D96B16] text-white border-[#9A4406]'
                      : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                  }`}
                >
                  {act1UnequalDemo ? 'Đang xem: Chia lệch' : 'Thử chia không đều'}
                </button>
              </div>
            )}

            {activeActivityId === 'BUILD_READ_FRACTION' && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setAct2Model((m) => (m === 'STRIP' ? 'CIRCLE' : 'STRIP'))
                  }
                  className="min-h-[40px] px-4 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold text-[#12382B] cursor-pointer"
                >
                  Đổi sang: {act2Model === 'STRIP' ? 'Hình tròn' : 'Dải phân số'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(0, act2Num - 1);
                    setAct2Num(next);
                    setAnsNum(next);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold cursor-pointer"
                >
                  − Bớt 1 mảnh (1/{act2Den})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(act2Den * 3, act2Num + 1);
                    setAct2Num(next);
                    setAnsNum(next);
                  }}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#136F50] text-white font-extrabold cursor-pointer"
                >
                  + Thêm 1 mảnh (1/{act2Den})
                </button>
              </div>
            )}

            {activeActivityId === 'COMPARE_FRACTIONS' && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() =>
                    setAct4SubMode((m) => (m === 'PAIR' ? 'SORT' : 'PAIR'))
                  }
                  className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold cursor-pointer"
                >
                  {act4SubMode === 'PAIR'
                    ? 'Chuyển sang: Sắp xếp 3–5 thẻ'
                    : 'Chuyển sang: So sánh 2 phân số'}
                </button>
                {act4SubMode === 'PAIR' ? (
                  <>
                    {(['<', '=', '>'] as M05CompareOperator[]).map((op) => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => setAnsOperator(op)}
                        className={`min-w-[44px] min-h-[40px] rounded-xl font-black text-lg border cursor-pointer ${
                          ansOperator === op
                            ? 'bg-[#136F50] text-white border-[#0C4F38]'
                            : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAct4ShowCommonGrid((v) => !v)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-full font-extrabold border cursor-pointer ${
                        act4ShowCommonGrid
                          ? 'bg-[#D96B16] text-white border-[#9A4406]'
                          : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                      }`}
                    >
                      {act4ShowCommonGrid ? 'Tắt vạch mẫu chung' : 'Bật vạch mẫu chung'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAct4UseNumberLine((v) => !v)}
                      className="min-h-[40px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold cursor-pointer"
                    >
                      {act4UseNumberLine ? 'Xem dải phân số' : 'Đối chiếu trục số'}
                    </button>
                  </>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {act4SortCards.map((card, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1 bg-[#FAF5EA] px-2.5 py-1 rounded-xl border border-[#CBBBA0]"
                      >
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...act4SortCards];
                              [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                              setAct4SortCards(next);
                            }}
                            className="w-6 h-6 rounded bg-[#EFE7D6] font-black cursor-pointer"
                          >
                            ◀
                          </button>
                        )}
                        <span className="font-black text-xs px-1">
                          {card.num}/{card.den}
                        </span>
                        {idx < act4SortCards.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...act4SortCards];
                              [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                              setAct4SortCards(next);
                            }}
                            className="w-6 h-6 rounded bg-[#EFE7D6] font-black cursor-pointer"
                          >
                            ▶
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setAct4SortCards(sortExactFractions(act4SortCards, 'ASC'))
                      }
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-white border border-[#CBBBA0] font-extrabold text-xs text-[#136F50] cursor-pointer"
                    >
                      Xếp tăng dần
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeActivityId === 'FRACTION_NUMBER_LINE' && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
                <span className="font-bold">Chia 1 đơn vị thành:</span>
                {[2, 3, 4, 5, 6, 8, 10].map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setAct5Subdivisions(sub);
                      setAct5PointNum((p) => Math.max(-2 * sub, Math.min(2 * sub, p)));
                      setAnsDen(sub);
                    }}
                    className={`min-w-[34px] min-h-[34px] px-2 rounded-xl font-black cursor-pointer ${
                      act5Subdivisions === sub
                        ? 'bg-[#136F50] text-white'
                        : 'bg-[#FAF5EA] text-[#12382B] border border-[#CBBBA0]'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(
                      act5Viewport.minInt * act5Subdivisions,
                      act5PointNum - 1
                    );
                    setAct5PointNum(next);
                    setAnsNum(next);
                    setAnsDen(act5Subdivisions);
                  }}
                  className="min-h-[38px] px-3 py-1 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Lùi 1/{act5Subdivisions}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(
                      act5Viewport.maxInt * act5Subdivisions,
                      act5PointNum + 1
                    );
                    setAct5PointNum(next);
                    setAnsNum(next);
                    setAnsDen(act5Subdivisions);
                  }}
                  className="min-h-[38px] px-3 py-1 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Tiến 1/{act5Subdivisions}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAct5ShowNegative((v) => !v)}
                  className={`min-h-[38px] px-3 py-1 rounded-full font-extrabold border cursor-pointer ${
                    act5ShowNegative
                      ? 'bg-[#D96B16] text-white border-[#9A4406]'
                      : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                  }`}
                >
                  {act5ShowNegative ? 'Đang bật: Miền âm' : 'Mở rộng phân số âm'}
                </button>
              </div>
            )}

            {activeActivityId === 'ADD_SUB_FRACTIONS' && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setAct6Tab('SAME_DEN');
                    setAct6FracA({ num: 1, den: 4 });
                    setAct6FracB({ num: 2, den: 4 });
                  }}
                  className={`min-h-[38px] px-3.5 py-1 rounded-full font-extrabold border cursor-pointer ${
                    act6Tab === 'SAME_DEN'
                      ? 'bg-[#136F50] text-white border-[#0C4F38]'
                      : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                  }`}
                >
                  Tab 1: Cùng mẫu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAct6Tab('DIFF_DEN');
                    setAct6FracA({ num: 1, den: 2 });
                    setAct6FracB({ num: 1, den: 3 });
                  }}
                  className={`min-h-[38px] px-3.5 py-1 rounded-full font-extrabold border cursor-pointer ${
                    act6Tab === 'DIFF_DEN'
                      ? 'bg-[#136F50] text-white border-[#0C4F38]'
                      : 'bg-[#FAF5EA] text-[#12382B] border-[#CBBBA0]'
                  }`}
                >
                  Tab 2: Khác mẫu (Quy đồng)
                </button>
                <button
                  type="button"
                  onClick={() => setAct6Op((o) => (o === '+' ? '-' : '+'))}
                  className="min-h-[38px] px-3.5 py-1 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-black cursor-pointer"
                >
                  Phép tính: {act6Op === '+' ? 'Cộng (+)' : 'Trừ (−)'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAct6Step((s) => (s >= 5 ? 1 : ((s + 1) as 1 | 2 | 3 | 4 | 5)))
                  }
                  className="min-h-[38px] px-3.5 py-1 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FastForward className="w-3.5 h-3.5 text-[#136F50]" />
                  <span>Từng bước ({act6Step}/5)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAct6PlayAnimation}
                  className="min-h-[38px] px-3.5 py-1 rounded-full bg-[#136F50] text-white font-extrabold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Chạy quy đồng</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAct6ViewMode((m) => (m === 'STRIP' ? 'NUMBER_LINE' : 'STRIP'))
                  }
                  className="min-h-[38px] px-3 py-1 rounded-full bg-[#FAF5EA] border border-[#CBBBA0] font-bold cursor-pointer"
                >
                  {act6ViewMode === 'STRIP' ? 'Xem trên Trục số' : 'Xem Dải phân số'}
                </button>
              </div>
            )}

            {/* Main 4 Stage Pill Buttons matching reference image ("Chia nhỏ | Ghép lại | Làm lại | Kiểm tra") */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {activeActivityId === 'EQUIVALENT_FRACTIONS' && (
                <>
                  <button
                    type="button"
                    onClick={handleAct3Subdivide}
                    className="min-h-[46px] px-6 py-2 rounded-full bg-gradient-to-b from-[#1A825E] to-[#115B41] hover:from-[#1E926A] hover:to-[#13684A] text-white font-extrabold text-sm sm:text-base inline-flex items-center gap-2 border border-[#0B422E] shadow-[0_4px_0_#0A3B29] cursor-pointer"
                  >
                    <Layers className="w-4 h-4" />
                    <span>Chia nhỏ</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAct3Coalesce}
                    className="min-h-[46px] px-6 py-2 rounded-full bg-gradient-to-b from-[#1A825E] to-[#115B41] hover:from-[#1E926A] hover:to-[#13684A] text-white font-extrabold text-sm sm:text-base inline-flex items-center gap-2 border border-[#0B422E] shadow-[0_4px_0_#0A3B29] cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Ghép lại</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => applyTaskPreset(currentTask)}
                className="min-h-[46px] px-6 py-2 rounded-full bg-gradient-to-b from-[#FBF7EE] to-[#E6DAC2] hover:from-white hover:to-[#EFE5D0] text-[#173A30] font-extrabold text-sm sm:text-base inline-flex items-center gap-2 border border-[#C9B99B] shadow-[0_4px_0_#B8A789] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-[#136F50]" />
                <span>Làm lại</span>
              </button>

              <button
                type="button"
                onClick={handleCheckAnswer}
                className="min-h-[46px] px-7 py-2 rounded-full bg-gradient-to-b from-[#F59E0B] to-[#D96B16] hover:from-[#FBBF24] hover:to-[#EA580C] text-white font-black text-sm sm:text-base inline-flex items-center gap-2 border border-[#B45309] shadow-[0_4px_0_#9A4406] cursor-pointer"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>Kiểm tra</span>
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            RIGHT SIDEBAR: MISSION PANEL ("NHIỆM VỤ")
            Matches the right panel of the reference image!
            ------------------------------------------------------------------ */}
        <aside
          aria-label="Bảng nhiệm vụ, điều khiển tử mẫu và gợi ý"
          className="lg:col-span-3 bg-[#F8F3E8] rounded-[24px] border border-[#DED2BC] shadow-xs flex flex-col justify-between overflow-hidden"
        >
          <div>
            {/* Green Header "Nhiệm vụ" */}
            <div className="bg-gradient-to-r from-[#136F50] to-[#0E543C] text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Nhiệm vụ</span>
              </div>
              <span className="text-xs font-bold bg-white/15 px-2.5 py-0.5 rounded-full tabular-nums">
                Câu {selectedTaskIndex + 1}/{filteredTasks.length}
              </span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Task Navigation & Difficulty Filter */}
              <div className="flex items-center justify-between gap-1.5 text-xs">
                <div className="inline-flex rounded-xl bg-[#EAE0CE] p-0.5">
                  {(['ALL', 'EASY', 'MEDIUM', 'HARD'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDifficultyFilter(d);
                        setSelectedTaskIndex(0);
                      }}
                      className={`px-2 py-1 rounded-lg font-extrabold cursor-pointer ${
                        difficultyFilter === d
                          ? 'bg-[#136F50] text-white'
                          : 'text-[#3E5248]'
                      }`}
                    >
                      {d === 'ALL' ? 'Tất cả' : d === 'EASY' ? 'Dễ' : d === 'MEDIUM' ? 'TB' : 'Khó'}
                    </button>
                  ))}
                </div>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTaskIndex((i) =>
                        i > 0 ? i - 1 : filteredTasks.length - 1
                      )
                    }
                    aria-label="Nhiệm vụ trước"
                    className="w-7 h-7 rounded-lg bg-[#EAE0CE] hover:bg-[#DFD2BA] font-black flex items-center justify-center cursor-pointer"
                  >
                    ◀
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTaskIndex((i) =>
                        i < filteredTasks.length - 1 ? i + 1 : 0
                      )
                    }
                    aria-label="Nhiệm vụ tiếp theo"
                    className="w-7 h-7 rounded-lg bg-[#EAE0CE] hover:bg-[#DFD2BA] font-black flex items-center justify-center cursor-pointer"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* Warm Peach Task Card matching reference image */}
              <div className="p-3.5 rounded-2xl bg-[#F6E4C8] border border-[#E6C99E] space-y-1.5">
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#9A4406]">
                  {currentTask.title}
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#12382B] leading-snug">
                  {currentTask.question}
                </p>
              </div>

              {/* Numerator & Denominator Steppers matching reference image ("Tử số [-] [2] [+]", "Mẫu số [-] [4] [+]") */}
              {currentTask.answerType === 'FRACTION' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#475E54]">Kiểu nhập đáp án:</span>
                    <button
                      type="button"
                      onClick={() =>
                        setInputMode((m) => (m === 'FRACTION' ? 'MIXED' : 'FRACTION'))
                      }
                      className="px-2.5 py-1 rounded-lg bg-[#EFE7D6] font-extrabold text-[#136F50] cursor-pointer"
                    >
                      {inputMode === 'FRACTION'
                        ? 'Đang nhập: Phân số a/b'
                        : 'Đang nhập: Hỗn số'}
                    </button>
                  </div>

                  {inputMode === 'FRACTION' ? (
                    <div className="space-y-2">
                      {/* Tử số row */}
                      <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#F2ECE1] border border-[#DED2BC]">
                        <span className="text-sm font-black text-[#12382B]">Tử số</span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next = ansNum - 1;
                              setAnsNum(next);
                              if (activeActivityId === 'EQUIVALENT_FRACTIONS')
                                setAct3CandNum(next);
                              if (activeActivityId === 'BUILD_READ_FRACTION')
                                setAct2Num(Math.max(0, next));
                            }}
                            aria-label="Giảm tử số"
                            className="w-9 h-9 rounded-xl bg-[#E5DAC5] hover:bg-[#D9CBB0] font-black text-lg cursor-pointer"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={ansNum}
                            onChange={(e) => {
                              const v = cleanInt(Number(e.target.value));
                              setAnsNum(v);
                              if (activeActivityId === 'EQUIVALENT_FRACTIONS')
                                setAct3CandNum(v);
                            }}
                            aria-label="Tử số"
                            className="w-16 h-9 rounded-xl bg-white border border-[#CBBBA0] text-center font-black text-lg text-[#12382B] tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = ansNum + 1;
                              setAnsNum(next);
                              if (activeActivityId === 'EQUIVALENT_FRACTIONS')
                                setAct3CandNum(next);
                              if (activeActivityId === 'BUILD_READ_FRACTION')
                                setAct2Num(Math.max(0, next));
                            }}
                            aria-label="Tăng tử số"
                            className="w-9 h-9 rounded-xl bg-[#E5DAC5] hover:bg-[#D9CBB0] font-black text-lg cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Mẫu số row */}
                      <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-[#F2ECE1] border border-[#DED2BC]">
                        <span className="text-sm font-black text-[#12382B]">Mẫu số</span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const next = ansDen - 1;
                              setAnsDen(next);
                              if (
                                activeActivityId === 'EQUIVALENT_FRACTIONS' &&
                                next > 0
                              )
                                setAct3CandDen(next);
                              if (
                                activeActivityId === 'BUILD_READ_FRACTION' &&
                                next > 0
                              )
                                setAct2Den(next);
                            }}
                            aria-label="Giảm mẫu số"
                            className="w-9 h-9 rounded-xl bg-[#E5DAC5] hover:bg-[#D9CBB0] font-black text-lg cursor-pointer"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            value={ansDen}
                            onChange={(e) => {
                              const v = cleanInt(Number(e.target.value));
                              setAnsDen(v);
                              if (activeActivityId === 'EQUIVALENT_FRACTIONS' && v > 0)
                                setAct3CandDen(v);
                            }}
                            aria-label="Mẫu số"
                            className="w-16 h-9 rounded-xl bg-white border border-[#CBBBA0] text-center font-black text-lg text-[#12382B] tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = ansDen + 1;
                              setAnsDen(next);
                              if (activeActivityId === 'EQUIVALENT_FRACTIONS')
                                setAct3CandDen(Math.min(24, next));
                              if (activeActivityId === 'BUILD_READ_FRACTION')
                                setAct2Den(Math.min(12, next));
                            }}
                            aria-label="Tăng mẫu số"
                            className="w-9 h-9 rounded-xl bg-[#E5DAC5] hover:bg-[#D9CBB0] font-black text-lg cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dedicated Mixed Number Input Box (Section E) */
                    <div className="p-3 rounded-2xl bg-[#F2ECE1] border border-[#DED2BC] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">Dấu của hỗn số:</span>
                        <button
                          type="button"
                          onClick={() => setAnsMixedNeg((n) => !n)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#CBBBA0] font-black cursor-pointer"
                        >
                          {ansMixedNeg ? 'Âm −(a b/c)' : 'Dương +(a b/c)'}
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex flex-col items-center font-bold">
                          <span>Phần nguyên</span>
                          <input
                            type="number"
                            min={0}
                            value={ansMixedWhole}
                            onChange={(e) =>
                              setAnsMixedWhole(Math.max(0, cleanInt(Number(e.target.value))))
                            }
                            className="w-full mt-1 py-1 rounded-lg bg-white border border-[#CBBBA0] text-center font-black text-sm"
                          />
                        </label>
                        <label className="flex flex-col items-center font-bold">
                          <span>Tử số lẻ</span>
                          <input
                            type="number"
                            min={0}
                            value={ansMixedNum}
                            onChange={(e) =>
                              setAnsMixedNum(Math.max(0, cleanInt(Number(e.target.value))))
                            }
                            className="w-full mt-1 py-1 rounded-lg bg-white border border-[#CBBBA0] text-center font-black text-sm"
                          />
                        </label>
                        <label className="flex flex-col items-center font-bold">
                          <span>Mẫu số</span>
                          <input
                            type="number"
                            min={1}
                            value={ansMixedDen}
                            onChange={(e) =>
                              setAnsMixedDen(cleanInt(Number(e.target.value)))
                            }
                            className="w-full mt-1 py-1 rounded-lg bg-white border border-[#CBBBA0] text-center font-black text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {currentTask.answerType === 'INTEGER' && (
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#F2ECE1] border border-[#DED2BC]">
                  <span className="text-sm font-black text-[#12382B]">Đáp án số:</span>
                  <input
                    type="number"
                    value={ansInteger}
                    onChange={(e) => setAnsInteger(cleanInt(Number(e.target.value)))}
                    className="w-24 h-10 rounded-xl bg-white border border-[#CBBBA0] text-center font-black text-lg"
                  />
                </div>
              )}

              {currentTask.answerType === 'CHOICE' && currentTask.choiceOptions && (
                <div className="space-y-1.5">
                  {currentTask.choiceOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAnsChoice(opt)}
                      className={`w-full p-2.5 rounded-xl text-left text-xs font-bold border transition cursor-pointer ${
                        ansChoice === opt
                          ? 'bg-[#136F50] text-white border-[#0C4F38]'
                          : 'bg-white text-[#12382B] border-[#DED2BC]'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {/* Status Badge matching "Cùng một lượng!" in reference image */}
              {(learningMode === 'EXPLORE' || submissionStatus !== 'IDLE') && (
                <div
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
                    submissionStatus === 'CORRECT' ||
                    (learningMode === 'EXPLORE' &&
                      activeActivityId === 'EQUIVALENT_FRACTIONS' &&
                      act3IsEquivalent)
                      ? 'bg-[#CBEAD5] border-[#86CFA0] text-[#0E543C]'
                      : submissionStatus === 'EQUIVALENT_UNSIMPLIFIED'
                      ? 'bg-amber-100 border-amber-300 text-amber-950'
                      : submissionStatus === 'INCORRECT' ||
                        submissionStatus === 'INVALID_ZERO_DEN'
                      ? 'bg-red-100 border-red-300 text-red-900'
                      : 'bg-[#E6F4EF] border-[#B7DFD0] text-[#0E543C]'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-[#15803D]" />
                  <div className="text-xs sm:text-sm font-black leading-snug">
                    {feedbackMessage ||
                      (activeActivityId === 'EQUIVALENT_FRACTIONS' && act3IsEquivalent
                        ? 'Cùng một lượng!'
                        : currentTask.explanationVi)}
                  </div>
                </div>
              )}

              {/* 3-Level Progressive Hints */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      playM05Tone('hint', soundEnabled);
                      setRevealedHintLevel((l) => (l < 3 ? ((l + 1) as 1 | 2 | 3) : 1));
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#EFE7D6] hover:bg-[#E4D9C3] text-xs font-extrabold text-[#12382B] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-[#D96B16]" />
                    <span>
                      Gợi ý từng bước ({revealedHintLevel}/3)
                    </span>
                  </button>
                  <span className="text-xs font-extrabold text-[#136F50]">
                    Điểm: {progress.score}
                  </span>
                </div>

                {revealedHintLevel > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1 text-xs text-amber-950">
                    {currentTask.hints.slice(0, revealedHintLevel).map((h, idx) => (
                      <div key={idx} className="font-semibold">
                        <strong>Mức {idx + 1}:</strong> {h}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Invariant Reminder matching "Giữ nguyên kích thước một đơn vị." in reference image */}
              <div className="p-3 rounded-2xl bg-[#F2ECE1] border border-[#DED2BC] flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#1F3A32]">
                <Info className="w-4 h-4 shrink-0 text-[#E07A1B]" />
                <span>Giữ nguyên kích thước một đơn vị.</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ====================================================================
          3. BOTTOM 6 3D ACTIVITY THUMBNAILS STRIP (MATCHING REFERENCE IMAGE)
          ==================================================================== */}
      {showThumbnailsStrip && !isPresentationActive && (
        <section
          aria-label="Thẻ mô hình 3D của 6 hoạt động Khám phá phân số"
          className="px-3.5 sm:px-5 pb-4 pt-1"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {M05_ACTIVITY_METADATA.map((act) => {
              const isSelected = act.id === activeActivityId;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setActiveActivityId(act.id);
                    setSelectedTaskIndex(0);
                  }}
                  className={`group rounded-[20px] p-2 border-2 transition text-center flex flex-col items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#FAF6ED] border-[#136F50] shadow-[0_6px_18px_rgba(19,111,80,0.18)] -translate-y-0.5'
                      : 'bg-[#F3ECE0] hover:bg-[#FAF6ED] border-[#DED2BC]'
                  }`}
                >
                  <div className="w-full h-24 rounded-xl overflow-hidden border border-[#E2D6C1]">
                    <M05ActivityThumbnail3D activityId={act.id} />
                  </div>
                  <span className="text-xs sm:text-[13px] font-black text-[#12382B] leading-tight py-0.5">
                    {act.thumbnailCaption}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ====================================================================
          4. CLASSROOM ORGANIZATION MODAL (SECTION G: 1–50 STUDENTS, GROUPS, RESET)
          ==================================================================== */}
      {showClassroomModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tổ chức hoạt động lớp học Khám phá phân số"
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div className="bg-[#FAF6EE] border-2 border-[#DACBB2] rounded-[24px] max-w-lg w-full p-5 space-y-4 shadow-2xl text-[#12382B]">
            <div className="flex items-center justify-between border-b border-[#E2D6C1] pb-3">
              <h3 className="text-lg font-black">
                Tổ chức lớp học – Khám phá phân số ({selectedClassName})
              </h3>
              <button
                type="button"
                onClick={() => setShowClassroomModal(false)}
                className="px-3 py-1 rounded-xl bg-[#EAE0CE] font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: 'INDIVIDUAL', label: 'Cá nhân' },
                  { id: 'GROUP', label: 'Theo nhóm' },
                  { id: 'TEACHER_PRESENTATION', label: 'GV trình chiếu' },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setProgress((p) => ({ ...p, classroomMode: m.id }))
                    }
                    className={`py-2 px-3 rounded-xl font-extrabold border cursor-pointer ${
                      progress.classroomMode === m.id
                        ? 'bg-[#136F50] text-white border-[#0C4F38]'
                        : 'bg-white text-[#12382B] border-[#D5C7AE]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <label className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#DED2BC] font-bold">
                <span>Sĩ số lớp tham gia (1–50 học sinh):</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={progress.studentCount || initialStudentCount}
                  onChange={(e) => {
                    const cnt = Math.max(
                      1,
                      Math.min(50, cleanInt(Number(e.target.value)))
                    );
                    setProgress((p) => ({ ...p, studentCount: cnt }));
                  }}
                  className="w-20 px-2 py-1 rounded-lg border border-[#CBBBA0] text-center font-black"
                />
              </label>

              {/* Group Scoreboard */}
              <div className="space-y-2">
                <div className="font-extrabold">Bảng điểm các nhóm học tập (Lưu cục bộ):</div>
                {progress.groups.map((grp, idx) => (
                  <div
                    key={grp.id}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border ${
                      activeGroupId === grp.id
                        ? 'bg-[#E6F4EF] border-[#136F50]'
                        : 'bg-white border-[#DED2BC]'
                    }`}
                  >
                    <input
                      type="text"
                      value={grp.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProgress((p) => ({
                          ...p,
                          groups: p.groups.map((g, i) =>
                            i === idx ? { ...g, name: val } : g
                          ),
                        }));
                      }}
                      className="flex-1 px-2 py-1 rounded-lg bg-[#FAF6EE] border border-[#DED2BC] font-bold text-xs"
                    />
                    <span className="font-black text-xs text-[#136F50] tabular-nums">
                      {grp.points} điểm ({grp.turns} lượt)
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveGroupId(grp.id)}
                      className="px-2.5 py-1 rounded-lg bg-[#136F50] text-white text-xs font-bold cursor-pointer"
                    >
                      {activeGroupId === grp.id ? 'Đang chọn' : 'Chọn'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2D6C1]">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(M05_STORAGE_KEY);
                  } catch {
                    // ignore
                  }
                  setProgress(DEFAULT_M05_PROGRESS);
                }}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa tiến độ phòng này</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClassroomModal(false)}
                className="min-h-[40px] px-5 py-1.5 rounded-xl bg-[#136F50] text-white text-xs font-extrabold cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
