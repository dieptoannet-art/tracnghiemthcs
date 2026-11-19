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
  Hand,
  HelpCircle,
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
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  M07_ACTIVITY_METADATA,
  M07_TASK_BANK,
  M07ActivityId,
  M07CompareOperator,
  M07Difficulty,
  M07RealWorldContext,
  M07RescueCard,
  M07TaskSpec,
  M07TickStep,
  NumberLineViewport,
  compareIntegers,
  computeAutoNumberLineRange,
  computeJumpOperation,
  explainIntegerComparison,
  findOptimalRescueSolution,
  formatIntegerTerm,
  generateNumberLineTicks,
  getAbsoluteValue,
  getDistanceBetweenPoints,
  getOppositeInteger,
  getTasksByActivity,
  normalizeInteger,
  numberToSvgX,
  snapValueToNumberLine,
  sortIntegers,
  svgXToNumber,
  verifyRescueSequence,
} from '../mathEngine/integerNumberLineEngine';
import {
  ActivityHeaderBadgeIcon3D,
  Elevator3DProp,
  M07ActivityThumbnail3D,
  RobotExplorer3D,
  TayDoSmartMathLogo3D,
  Thermometer3DProp,
} from './M07Integer3DAssets';
import { MathActivityResultRecord, MathGrade } from '../types';
import { saveMathActivityResult } from '../adapters/mathLabAdapters';

// ============================================================================
// SCOPED LOCAL STORAGE FOR M07 PROGRESS (SECTION 7)
// ============================================================================

const M07_STORAGE_KEY = 'taydo_smart_edu_m07_integer_lab_v1';

interface M07ProgressState {
  version: 1;
  completedTaskIds: string[];
  attemptsByTask: Record<string, number>;
  hintsUsedByTask: Record<string, number>;
  classOrgMode: 'INDIVIDUAL' | 'GROUP' | 'TEACHER_COMMON';
  studentCount: number;
  groups: { id: string; name: string; score: number }[];
  updatedAt: string;
}

const DEFAULT_GROUPS = [
  { id: 'g1', name: 'Nhóm 1 – Sao Bắc Đẩu', score: 0 },
  { id: 'g2', name: 'Nhóm 2 – Tia Chớp', score: 0 },
  { id: 'g3', name: 'Nhóm 3 – Nhà Thám Hiểm', score: 0 },
  { id: 'g4', name: 'Nhóm 4 – Trí Tuệ Số', score: 0 },
];

function loadM07Progress(): M07ProgressState {
  try {
    const raw = window.localStorage.getItem(M07_STORAGE_KEY);
    if (!raw) {
      return {
        version: 1,
        completedTaskIds: [],
        attemptsByTask: {},
        hintsUsedByTask: {},
        classOrgMode: 'INDIVIDUAL',
        studentCount: 35,
        groups: DEFAULT_GROUPS,
        updatedAt: new Date().toISOString(),
      };
    }
    const parsed = JSON.parse(raw) as M07ProgressState;
    if (parsed && parsed.version === 1) {
      return {
        ...parsed,
        groups: Array.isArray(parsed.groups) && parsed.groups.length > 0 ? parsed.groups : DEFAULT_GROUPS,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    version: 1,
    completedTaskIds: [],
    attemptsByTask: {},
    hintsUsedByTask: {},
    classOrgMode: 'INDIVIDUAL',
    studentCount: 35,
    groups: DEFAULT_GROUPS,
    updatedAt: new Date().toISOString(),
  };
}

function saveM07Progress(state: M07ProgressState): void {
  try {
    window.localStorage.setItem(
      M07_STORAGE_KEY,
      JSON.stringify({ ...state, updatedAt: new Date().toISOString() })
    );
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// SUBTLE WEB AUDIO FEEDBACK (DEFAULT MUTED, ONLY PLAYS ON USER INTERACTION)
// ============================================================================

function playM07Tone(kind: 'STEP' | 'SUCCESS' | 'HINT' | 'WRONG', isMuted: boolean): void {
  if (isMuted || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'SUCCESS') {
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.start(now);
      osc.stop(now + 0.32);
    } else if (kind === 'WRONG') {
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.setValueAtTime(195, now + 0.1);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else {
      osc.frequency.setValueAtTime(kind === 'HINT' ? 587.33 : 440, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore audio errors
  }
}

export interface M07IntegerNumberLineRoomProps {
  grade?: MathGrade;
  isPresentationMode?: boolean;
  onTogglePresentationMode?: () => void;
  isDarkTheme?: boolean;
  resetSignal?: number;
  selectedClassName?: string;
  studentCount?: number;
  currentUserName?: string;
  initialActivityPreset?: string;
  onBackToHub?: () => void;
  onResultSaved?: (record: MathActivityResultRecord) => void;
}

export const M07IntegerNumberLineTool: React.FC<M07IntegerNumberLineRoomProps> = ({
  grade = 6,
  isPresentationMode: externalPresentationMode = false,
  onTogglePresentationMode,
  resetSignal = 0,
  selectedClassName = 'Lớp 6A1',
  studentCount: initialClassStudentCount,
  currentUserName = 'Học sinh THCS Tây Đô',
  initialActivityPreset,
  onBackToHub,
  onResultSaved,
}) => {
  // --------------------------------------------------------------------------
  // 1. ROOM MODE, ACTIVITY & TASK STATE
  // --------------------------------------------------------------------------
  const [learningMode, setLearningMode] = useState<'EXPLORE' | 'CHALLENGE'>('EXPLORE');
  const [activeActivityId, setActiveActivityId] = useState<M07ActivityId>(() => {
    if (
      initialActivityPreset === 'EXPLORE_NEGATIVE' ||
      initialActivityPreset === 'PLACE_ON_LINE' ||
      initialActivityPreset === 'COMPARE_INTEGERS' ||
      initialActivityPreset === 'OPPOSITE_DISTANCE' ||
      initialActivityPreset === 'JUMP_ADD_SUB' ||
      initialActivityPreset === 'RESCUE_MISSION'
    ) {
      return initialActivityPreset;
    }
    // Open Activity 5 by default to match the flagship reference screen, with 1-click access to all 6 activities
    return 'JUMP_ADD_SUB';
  });

  const [progress, setProgress] = useState<M07ProgressState>(() => loadM07Progress());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [inPagePresentation, setInPagePresentation] = useState<boolean>(externalPresentationMode);
  const [showThumbnailsStrip, setShowThumbnailsStrip] = useState<boolean>(true);
  const [showLeftSidebarMobile, setShowLeftSidebarMobile] = useState<boolean>(false);
  const [showClassroomModal, setShowClassroomModal] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true); // Default muted per Section 8

  const isPresentationActive = isFullscreen || inPagePresentation || externalPresentationMode;

  const activityTasks = useMemo(
    () => getTasksByActivity(activeActivityId),
    [activeActivityId]
  );
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number>(0);
  const currentTask: M07TaskSpec = useMemo(
    () => activityTasks[selectedTaskIndex] || activityTasks[0] || M07_TASK_BANK[0],
    [activityTasks, selectedTaskIndex]
  );

  // Challenge & Feedback state (cleared automatically whenever task or activity changes)
  const [userAnswerInput, setUserAnswerInput] = useState<string>('');
  const [predictionInput, setPredictionInput] = useState<string>('');
  const [hasPredicted, setHasPredicted] = useState<boolean>(false);
  const [hintLevelShown, setHintLevelShown] = useState<0 | 1 | 2 | 3>(0);
  const [submissionStatus, setSubmissionStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG' | 'REVEALED'>('IDLE');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string>('g1');
  const [optionalRosterText, setOptionalRosterText] = useState<string>('');

  // --------------------------------------------------------------------------
  // 2. SHARED NUMBER LINE VIEWPORT & TICK CONFIGURATION
  // --------------------------------------------------------------------------
  const [tickStep, setTickStep] = useState<M07TickStep>(1);
  const [viewCenterOffset, setViewCenterOffset] = useState<number>(0);
  const [viewHalfSpan, setViewHalfSpan] = useState<number>(5);
  const [hideIntermediateLabels, setHideIntermediateLabels] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // --------------------------------------------------------------------------
  // 3. ACTIVITY-SPECIFIC INTERACTIVE STATES
  // --------------------------------------------------------------------------

  // Activity 1: Khám phá số âm
  const [act1Context, setAct1Context] = useState<M07RealWorldContext>('THERMOMETER');
  const [act1Value, setAct1Value] = useState<number>(-5);
  const [act1CompareValue, setAct1CompareValue] = useState<number>(-7);

  // Activity 2: Đặt số trên trục số
  const [act2Targets, setAct2Targets] = useState<number[]>([-3, 2]);
  const [act2PlacedMap, setAct2PlacedMap] = useState<Record<number, number | null>>({
    [-3]: -3,
    2: 2,
  });
  const [act2ActiveCard, setAct2ActiveCard] = useState<number | null>(-3);
  const [act2DraggingCard, setAct2DraggingCard] = useState<number | null>(null);
  const [act2ProbePoint, setAct2ProbePoint] = useState<number>(0);

  // Activity 3: So sánh số nguyên
  const [act3SubMode, setAct3SubMode] = useState<'PAIR' | 'SORT'>('PAIR');
  const [act3PointA, setAct3PointA] = useState<number>(-4);
  const [act3PointB, setAct3PointB] = useState<number>(-1);
  const [act3ChosenOp, setAct3ChosenOp] = useState<M07CompareOperator | null>('<');
  const [act3SortCards, setAct3SortCards] = useState<number[]>([-5, 3, -1, 0]);
  const [act3DraggingEnd, setAct3DraggingEnd] = useState<'A' | 'B' | null>(null);

  // Activity 4: Số đối và khoảng cách
  const [act4SubMode, setAct4SubMode] = useState<'TO_ZERO' | 'BETWEEN_TWO'>('TO_ZERO');
  const [act4PointA, setAct4PointA] = useState<number>(-3);
  const [act4PointB, setAct4PointB] = useState<number>(2);
  const [act4ShowAbsNotation, setAct4ShowAbsNotation] = useState<boolean>(true);
  const [act4DraggingPoint, setAct4DraggingPoint] = useState<'A' | 'B' | null>(null);

  // Activity 5: Cộng, trừ bằng bước nhảy (Flagship Default: (-3) - (-5) = (-3) + 5 = 2)
  const [jumpA, setJumpA] = useState<number>(-3);
  const [jumpOp, setJumpOp] = useState<'+' | '-'>('-');
  const [jumpB, setJumpB] = useState<number>(-5);
  const [jumpStepIndex, setJumpStepIndex] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [jumpRobotPos, setJumpRobotPos] = useState<number>(2);
  const [isJumpPlaying, setIsJumpPlaying] = useState<boolean>(false);
  const [jumpSpeed, setJumpSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [showUnitHops, setShowUnitHops] = useState<boolean>(false);
  const [showCustomJumpControls, setShowCustomJumpControls] = useState<boolean>(false);

  // Activity 6: Giải cứu trên trục số
  const [rescueTier, setRescueTier] = useState<M07Difficulty>('EASY');
  const [rescueStart, setRescueStart] = useState<number>(-4);
  const [rescueTarget, setRescueTarget] = useState<number>(2);
  const [rescueMaxMoves, setRescueMaxMoves] = useState<number>(1);
  const [rescueAvailableCards, setRescueAvailableCards] = useState<M07RescueCard[]>([
    { id: 'c1', op: '+', operand: 6, effectiveDelta: 6, label: '+ 6' },
    { id: 'c2', op: '-', operand: 6, effectiveDelta: -6, label: '- 6' },
    { id: 'c3', op: '+', operand: 2, effectiveDelta: 2, label: '+ 2' },
    { id: 'c4', op: '+', operand: -2, effectiveDelta: -2, label: '+ (-2)' },
  ]);
  const [rescueChosenCards, setRescueChosenCards] = useState<M07RescueCard[]>([]);
  const [rescueRobotPos, setRescueRobotPos] = useState<number>(-4);
  const [isRescueAnimating, setIsRescueAnimating] = useState<boolean>(false);

  // --------------------------------------------------------------------------
  // 4. CANCELLABLE ANIMATION ENGINE (SECTION 4.5 & SECTION 7)
  // --------------------------------------------------------------------------
  const animTokenRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const stepTimeoutRef = useRef<number | null>(null);

  const cancelActiveAnimations = useCallback(() => {
    animTokenRef.current += 1;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (stepTimeoutRef.current !== null) {
      window.clearTimeout(stepTimeoutRef.current);
      stepTimeoutRef.current = null;
    }
    setIsJumpPlaying(false);
    setIsRescueAnimating(false);
  }, []);

  useEffect(() => {
    return () => {
      cancelActiveAnimations();
    };
  }, [cancelActiveAnimations]);

  // Escape key to exit fullscreen / presentation mode (Section 5)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inPagePresentation) setInPagePresentation(false);
        if (showClassroomModal) setShowClassroomModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inPagePresentation, showClassroomModal]);

  // Sync task parameters when task or activity changes (Section 9: clears old feedback/answer)
  const applyTaskPreset = useCallback(
    (task: M07TaskSpec, mode: 'EXPLORE' | 'CHALLENGE') => {
      cancelActiveAnimations();
      setUserAnswerInput('');
      setPredictionInput('');
      setHasPredicted(false);
      setHintLevelShown(0);
      setSubmissionStatus('IDLE');
      setFeedbackMessage(null);
      setViewCenterOffset(0);

      const p = task.params;
      setTickStep(p.tickStep || 1);
      setHideIntermediateLabels(Boolean(p.hideIntermediateLabels));

      if (task.activityId === 'EXPLORE_NEGATIVE') {
        setAct1Context(p.context || 'THERMOMETER');
        setAct1Value(mode === 'CHALLENGE' ? 0 : p.targetValue ?? -5);
        setAct1CompareValue(p.secondValue ?? -7);
        setViewHalfSpan(10);
      } else if (task.activityId === 'PLACE_ON_LINE') {
        const cards = p.numberCards || [-3, 2];
        setAct2Targets(cards);
        const initialMap: Record<number, number | null> = {};
        cards.forEach((c) => {
          initialMap[c] = mode === 'CHALLENGE' ? null : c;
        });
        setAct2PlacedMap(initialMap);
        setAct2ActiveCard(cards[0] ?? null);
        const maxAbs = Math.max(6, ...cards.map((c) => Math.abs(c)), Math.abs(p.minRange || 6), Math.abs(p.maxRange || 6));
        setViewHalfSpan(maxAbs);
      } else if (task.activityId === 'COMPARE_INTEGERS') {
        const a = p.compareA ?? -4;
        const b = p.compareB ?? -1;
        setAct3PointA(a);
        setAct3PointB(b);
        setAct3ChosenOp(mode === 'CHALLENGE' ? null : compareIntegers(a, b));
        if (p.numberCards && p.numberCards.length >= 3) {
          setAct3SubMode('SORT');
          setAct3SortCards([...p.numberCards]);
        } else {
          setAct3SubMode('PAIR');
        }
        setViewHalfSpan(Math.max(6, Math.abs(a) + 2, Math.abs(b) + 2));
      } else if (task.activityId === 'OPPOSITE_DISTANCE') {
        const sub = p.oppositeSubMode || 'TO_ZERO';
        setAct4SubMode(sub);
        const a = p.pointA ?? -3;
        const b = p.pointB ?? 2;
        setAct4PointA(a);
        setAct4PointB(b);
        setViewHalfSpan(Math.max(6, Math.abs(a) + 2, Math.abs(b) + 2));
      } else if (task.activityId === 'JUMP_ADD_SUB') {
        const a = p.jumpA ?? -3;
        const op = p.jumpOp ?? '-';
        const b = p.jumpB ?? -5;
        setJumpA(a);
        setJumpOp(op);
        setJumpB(b);
        const calc = computeJumpOperation(a, op, b);
        if (mode === 'CHALLENGE') {
          setJumpStepIndex(1);
          setJumpRobotPos(a);
        } else {
          setJumpStepIndex(5);
          setJumpRobotPos(calc.result);
        }
        const autoRange = computeAutoNumberLineRange([a, calc.result, 0], 5, 1);
        setViewHalfSpan(Math.max(5, Math.abs(autoRange.min), Math.abs(autoRange.max)));
      } else if (task.activityId === 'RESCUE_MISSION') {
        const start = p.rescueStart ?? -4;
        const target = p.rescueTarget ?? 2;
        const maxM = p.rescueMaxMoves ?? 1;
        const cards = p.rescueCards || [];
        setRescueTier(task.difficulty);
        setRescueStart(start);
        setRescueTarget(target);
        setRescueMaxMoves(maxM);
        setRescueAvailableCards(cards);
        setRescueChosenCards([]);
        setRescueRobotPos(start);
        const autoRange = computeAutoNumberLineRange([start, target, 0], 6, 1);
        setViewHalfSpan(Math.max(6, Math.abs(autoRange.min), Math.abs(autoRange.max)));
      }
    },
    [cancelActiveAnimations]
  );

  useEffect(() => {
    applyTaskPreset(currentTask, learningMode);
  }, [currentTask, learningMode, applyTaskPreset, resetSignal]);

  // --------------------------------------------------------------------------
  // 5. JUMP ANIMATION CONTROLLER (ACTIVITY 5 — SECTION 4.5)
  // --------------------------------------------------------------------------
  const jumpCalc = useMemo(
    () => computeJumpOperation(jumpA, jumpOp, jumpB),
    [jumpA, jumpOp, jumpB]
  );

  // Automatically widen viewport if user types larger jumpA or jumpB so start & end are always visible
  useEffect(() => {
    if (activeActivityId !== 'JUMP_ADD_SUB') return;
    const neededBound = Math.max(5, Math.abs(jumpCalc.a) + 1, Math.abs(jumpCalc.result) + 1);
    if (neededBound > viewHalfSpan) {
      setViewHalfSpan(Math.min(30, neededBound));
    }
  }, [activeActivityId, jumpCalc.a, jumpCalc.result, viewHalfSpan]);

  const animateRobotFromTo = useCallback(
    (
      fromVal: number,
      toVal: number,
      durationMs: number,
      token: number,
      onPositionUpdate: (val: number) => void,
      onComplete: () => void
    ) => {
      if (reduceMotion || durationMs <= 0 || fromVal === toVal) {
        onPositionUpdate(toVal);
        onComplete();
        return;
      }
      const startTime = performance.now();
      const frame = (now: number) => {
        if (animTokenRef.current !== token) return;
        const elapsed = now - startTime;
        const progressRatio = Math.min(1, elapsed / durationMs);
        // Smooth easeInOutCubic
        const eased =
          progressRatio < 0.5
            ? 4 * progressRatio * progressRatio * progressRatio
            : 1 - Math.pow(-2 * progressRatio + 2, 3) / 2;
        const currentVal = fromVal + (toVal - fromVal) * eased;
        onPositionUpdate(currentVal);
        if (progressRatio < 1) {
          rafIdRef.current = requestAnimationFrame(frame);
        } else {
          onPositionUpdate(toVal);
          onComplete();
        }
      };
      rafIdRef.current = requestAnimationFrame(frame);
    },
    [reduceMotion]
  );

  const handleStepByStepJump = () => {
    cancelActiveAnimations();
    playM07Tone('STEP', isMuted);
    setJumpStepIndex((prev) => {
      const next = prev >= 5 ? 1 : ((prev + 1) as 1 | 2 | 3 | 4 | 5);
      if (next <= 3) {
        setJumpRobotPos(jumpCalc.a);
      } else {
        const token = animTokenRef.current;
        animateRobotFromTo(
          jumpCalc.a,
          jumpCalc.result,
          reduceMotion ? 0 : 650 / jumpSpeed,
          token,
          setJumpRobotPos,
          () => {}
        );
      }
      return next;
    });
  };

  const handlePlayJumpSequence = (startFromBeginning: boolean = false) => {
    cancelActiveAnimations();
    const token = animTokenRef.current;
    setIsJumpPlaying(true);
    playM07Tone('STEP', isMuted);

    const startStep: 1 | 2 | 3 | 4 | 5 = startFromBeginning || jumpStepIndex >= 5 ? 1 : jumpStepIndex;
    setJumpStepIndex(startStep);
    if (startStep <= 3) {
      setJumpRobotPos(jumpCalc.a);
    }

    if (reduceMotion) {
      // Respect reduced motion while still showing all explanation steps clearly
      setJumpStepIndex(5);
      setJumpRobotPos(jumpCalc.result);
      setIsJumpPlaying(false);
      return;
    }

    const stepDelay = Math.round(750 / jumpSpeed);

    const advance = (step: 1 | 2 | 3 | 4 | 5) => {
      if (animTokenRef.current !== token) return;
      setJumpStepIndex(step);
      if (step < 4) {
        setJumpRobotPos(jumpCalc.a);
        stepTimeoutRef.current = window.setTimeout(() => {
          advance((step + 1) as 1 | 2 | 3 | 4 | 5);
        }, stepDelay);
      } else if (step === 4) {
        animateRobotFromTo(
          jumpCalc.a,
          jumpCalc.result,
          Math.max(400, Math.round((Math.max(1, jumpCalc.distanceUnits) * 220) / jumpSpeed)),
          token,
          setJumpRobotPos,
          () => {
            if (animTokenRef.current !== token) return;
            stepTimeoutRef.current = window.setTimeout(() => {
              if (animTokenRef.current !== token) return;
              setJumpStepIndex(5);
              setIsJumpPlaying(false);
              playM07Tone('SUCCESS', isMuted);
            }, 250);
          }
        );
      }
    };

    advance(startStep);
  };

  const handleReplayJumpFromA = () => {
    // Section 4.5: "Chạy lại luôn bắt đầu tại a."
    setJumpRobotPos(jumpCalc.a);
    setJumpStepIndex(1);
    handlePlayJumpSequence(true);
  };

  const handleResetCurrentTask = () => {
    // Section 4.5: "Làm lại xóa thao tác của nhiệm vụ hiện tại."
    applyTaskPreset(currentTask, learningMode);
  };

  // --------------------------------------------------------------------------
  // 6. RESCUE MISSION CONTROLLER (ACTIVITY 6 — SECTION 4.6)
  // --------------------------------------------------------------------------
  const rescueVerification = useMemo(
    () =>
      verifyRescueSequence(
        rescueStart,
        rescueTarget,
        rescueChosenCards,
        rescueAvailableCards,
        rescueMaxMoves
      ),
    [rescueStart, rescueTarget, rescueChosenCards, rescueAvailableCards, rescueMaxMoves]
  );

  const handleRunRescueSequence = () => {
    if (rescueChosenCards.length === 0) return;
    cancelActiveAnimations();
    const token = animTokenRef.current;
    setIsRescueAnimating(true);
    setRescueRobotPos(rescueStart);

    const steps = rescueVerification.stepsApplied;
    if (reduceMotion) {
      setRescueRobotPos(rescueVerification.finalPosition);
      setIsRescueAnimating(false);
      if (rescueVerification.reachedTarget) {
        setSubmissionStatus('CORRECT');
        setFeedbackMessage(
          `Giải cứu thành công! Robot đã đến đúng đích ${rescueTarget} sau ${steps.length} bước.`
        );
        playM07Tone('SUCCESS', isMuted);
      } else {
        setSubmissionStatus('WRONG');
        setFeedbackMessage(
          `Robot dừng tại ${rescueVerification.finalPosition}, chưa tới đích ${rescueTarget}. Em hãy điều chỉnh lại thẻ phép tính nhé!`
        );
        playM07Tone('WRONG', isMuted);
      }
      return;
    }

    const runStepIdx = (idx: number) => {
      if (animTokenRef.current !== token) return;
      if (idx >= steps.length) {
        setIsRescueAnimating(false);
        if (rescueVerification.reachedTarget) {
          setSubmissionStatus('CORRECT');
          setFeedbackMessage(
            `Giải cứu thành công! Robot đã đến đúng đích ${rescueTarget} sau ${steps.length} bước.`
          );
          playM07Tone('SUCCESS', isMuted);
        } else {
          setSubmissionStatus('WRONG');
          setFeedbackMessage(
            `Robot dừng tại ${rescueVerification.finalPosition}, chưa tới đích ${rescueTarget}. Hãy thử đổi thẻ khác!`
          );
          playM07Tone('WRONG', isMuted);
        }
        return;
      }
      const st = steps[idx];
      playM07Tone('STEP', isMuted);
      animateRobotFromTo(st.from, st.to, 550, token, setRescueRobotPos, () => {
        stepTimeoutRef.current = window.setTimeout(() => runStepIdx(idx + 1), 220);
      });
    };

    runStepIdx(0);
  };

  // --------------------------------------------------------------------------
  // 7. CHALLENGE ANSWER CHECKING & PEDAGOGICAL FEEDBACK (SECTION 5 & 6)
  // --------------------------------------------------------------------------
  const recordTaskSuccess = useCallback(
    (taskId: string) => {
      setProgress((prev) => {
        const completed = prev.completedTaskIds.includes(taskId)
          ? prev.completedTaskIds
          : [...prev.completedTaskIds, taskId];
        const updatedGroups =
          prev.classOrgMode === 'GROUP'
            ? prev.groups.map((g) => (g.id === activeGroupId ? { ...g, score: g.score + 10 } : g))
            : prev.groups;
        const next: M07ProgressState = {
          ...prev,
          completedTaskIds: completed,
          groups: updatedGroups,
          updatedAt: new Date().toISOString(),
        };
        saveM07Progress(next);
        return next;
      });

      const record: MathActivityResultRecord = {
        id: `m07-${Date.now()}`,
        toolId: 'M07',
        activityId: taskId,
        studentName: currentUserName,
        className: selectedClassName,
        completedSteps: ['PREDICT', 'MANIPULATE', 'OBSERVE', 'EXPLAIN', 'CONCLUDE', 'PRACTICE'],
        practiceAnswer: userAnswerInput || String(currentTask.expectedAnswer),
        isCorrect: true,
        score: 100,
        maxScore: 100,
        completedAt: new Date().toISOString(),
      };
      saveMathActivityResult(record);
      if (onResultSaved) onResultSaved(record);
    },
    [activeGroupId, currentTask.expectedAnswer, currentUserName, onResultSaved, selectedClassName, userAnswerInput]
  );

  const handleCheckAnswer = () => {
    setProgress((prev) => {
      const prevAtt = prev.attemptsByTask[currentTask.id] || 0;
      const next = {
        ...prev,
        attemptsByTask: { ...prev.attemptsByTask, [currentTask.id]: prevAtt + 1 },
      };
      saveM07Progress(next);
      return next;
    });

    const cleanedInput = userAnswerInput.trim();
    let isCorrect = false;

    // Activity-specific interactive model check + typed input check
    if (activeActivityId === 'PLACE_ON_LINE') {
      const allCardsPlacedCorrectly = act2Targets.every((t) => act2PlacedMap[t] === t);
      const matchesTyped =
        cleanedInput !== '' &&
        (cleanedInput === String(currentTask.expectedAnswer) ||
          (currentTask.acceptedAnswers || []).map(String).includes(cleanedInput));

      if (allCardsPlacedCorrectly && (cleanedInput === '' || matchesTyped)) {
        isCorrect = true;
      } else if (!allCardsPlacedCorrectly) {
        isCorrect = false;
        const wrongCards = act2Targets.filter((t) => act2PlacedMap[t] !== t);
        const firstWrong = wrongCards[0];
        const placedAt = act2PlacedMap[firstWrong];
        playM07Tone('WRONG', isMuted);
        setSubmissionStatus('WRONG');
        setFeedbackMessage(
          placedAt === null || placedAt === undefined
            ? `Em chưa đặt thẻ số ${firstWrong} lên trục số. Gợi ý: ${firstWrong} nằm ở bên ${
                firstWrong < 0 ? 'trái' : 'phải'
              } số 0 và cách 0 đúng ${Math.abs(firstWrong)} đơn vị.`
            : `Thẻ ${firstWrong} đang đặt ở vạch ${placedAt}. Hãy dịch chuyển thẻ về đúng vạch ${firstWrong} (giữ nguyên vị trí hiện tại để em sửa trực tiếp).`
        );
        return;
      }
    } else if (activeActivityId === 'COMPARE_INTEGERS' && act3SubMode === 'PAIR') {
      const expectedOp = compareIntegers(act3PointA, act3PointB);
      if (act3ChosenOp === expectedOp || cleanedInput === expectedOp) {
        isCorrect = true;
      }
    } else if (
      activeActivityId === 'RESCUE_MISSION' &&
      currentTask.params.rescueMode === 'CHOOSE_CARDS'
    ) {
      if (rescueVerification.reachedTarget && rescueVerification.withinStepLimit) {
        isCorrect = true;
      }
    }

    if (!isCorrect && cleanedInput.length > 0) {
      const acceptedList = [
        String(currentTask.expectedAnswer),
        ...(currentTask.acceptedAnswers || []).map(String),
      ].map((s) => s.trim().toLowerCase());
      isCorrect = acceptedList.includes(cleanedInput.toLowerCase());
    }

    if (isCorrect) {
      playM07Tone('SUCCESS', isMuted);
      setSubmissionStatus('CORRECT');
      setFeedbackMessage(`Chính xác! ${currentTask.explanationVi}`);
      if (activeActivityId === 'JUMP_ADD_SUB') {
        setJumpStepIndex(5);
        setJumpRobotPos(jumpCalc.result);
      }
      recordTaskSuccess(currentTask.id);
    } else {
      playM07Tone('WRONG', isMuted);
      setSubmissionStatus('WRONG');
      const nextHintLvl = Math.min(3, hintLevelShown + 1) as 1 | 2 | 3;
      setHintLevelShown(nextHintLvl);
      setFeedbackMessage(
        `Chưa chính xác. Gợi ý mức ${nextHintLvl}: ${currentTask.hints[nextHintLvl - 1]}`
      );
    }
  };

  // --------------------------------------------------------------------------
  // 8. NUMBER LINE SVG COORDINATE GEOMETRY & POINTER DRAG HANDLERS
  // --------------------------------------------------------------------------
  const nlViewport: NumberLineViewport = useMemo(() => {
    const min = normalizeInteger(-viewHalfSpan + viewCenterOffset);
    const max = normalizeInteger(viewHalfSpan + viewCenterOffset);
    return {
      min,
      max,
      leftPx: 68,
      rightPx: 752,
    };
  }, [viewHalfSpan, viewCenterOffset]);

  const nlTicks = useMemo(
    () => generateNumberLineTicks(nlViewport.min, nlViewport.max, tickStep),
    [nlViewport.min, nlViewport.max, tickStep]
  );

  const clientXToSnappedInteger = useCallback(
    (clientX: number, snapExactInteger: boolean = true): number => {
      if (!svgRef.current) return 0;
      const rect = svgRef.current.getBoundingClientRect();
      if (rect.width <= 0) return 0;
      const svgX = ((clientX - rect.left) / rect.width) * 820;
      const rawVal = svgXToNumber(svgX, nlViewport);
      return snapValueToNumberLine(
        rawVal,
        tickStep,
        nlViewport.min,
        nlViewport.max,
        0,
        snapExactInteger
      );
    },
    [nlViewport, tickStep]
  );

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (activeActivityId === 'PLACE_ON_LINE' && act2DraggingCard !== null) {
      const snapped = clientXToSnappedInteger(e.clientX, true);
      setAct2PlacedMap((prev) => ({ ...prev, [act2DraggingCard]: snapped }));
      setAct2ProbePoint(snapped);
    } else if (activeActivityId === 'COMPARE_INTEGERS' && act3DraggingEnd !== null) {
      const snapped = clientXToSnappedInteger(e.clientX, true);
      if (act3DraggingEnd === 'A') setAct3PointA(snapped);
      else setAct3PointB(snapped);
    } else if (activeActivityId === 'OPPOSITE_DISTANCE' && act4DraggingPoint !== null) {
      const snapped = clientXToSnappedInteger(e.clientX, true);
      if (act4DraggingPoint === 'A') setAct4PointA(snapped);
      else setAct4PointB(snapped);
    }
  };

  const handleSvgPointerUp = () => {
    setAct2DraggingCard(null);
    setAct3DraggingEnd(null);
    setAct4DraggingPoint(null);
  };

  const toggleFullscreenRoom = () => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {
          // Browser doesn't allow fullscreen -> fallback to in-page presentation mode
          setInPagePresentation((v) => !v);
        });
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
    if (onTogglePresentationMode) onTogglePresentationMode();
  };

  const activeMeta = useMemo(
    () =>
      M07_ACTIVITY_METADATA.find((m) => m.id === activeActivityId) ||
      M07_ACTIVITY_METADATA[4],
    [activeActivityId]
  );

  const shouldHideJumpResultInChallenge =
    learningMode === 'CHALLENGE' &&
    submissionStatus !== 'CORRECT' &&
    submissionStatus !== 'REVEALED' &&
    jumpStepIndex < 5;

  // --------------------------------------------------------------------------
  // RENDER STAGE TOP EXPRESSION BANNER PER ACTIVITY
  // --------------------------------------------------------------------------
  const renderStageHeadlineBanner = () => {
    if (activeActivityId === 'EXPLORE_NEGATIVE') {
      const unit = act1Context === 'THERMOMETER' ? '°C' : act1Context === 'SEA_LEVEL' ? ' m' : '';
      const prefix =
        act1Context === 'THERMOMETER'
          ? 'Nhiệt độ:'
          : act1Context === 'ELEVATOR'
          ? 'Tầng thang máy (Tầng trệt = 0):'
          : 'Độ cao (Mực nước biển = 0 m):';
      return (
        <div className="inline-flex flex-wrap items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
          <span className="text-sm sm:text-base font-bold text-[#1F3A32]">{prefix}</span>
          <span
            className={`text-xl sm:text-2xl font-black tabular-nums ${
              act1Value < 0
                ? 'text-[#D96B16]'
                : act1Value > 0
                ? 'text-[#15803D]'
                : 'text-[#0F766E]'
            }`}
          >
            {act1Value > 0 ? `+${act1Value}` : act1Value}
            {unit}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-[#5C6B64]">
            ({act1Value < 0 ? 'Số nguyên âm' : act1Value > 0 ? 'Số nguyên dương' : 'Mốc gốc 0'})
          </span>
        </div>
      );
    }

    if (activeActivityId === 'PLACE_ON_LINE') {
      return (
        <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
          <span className="text-sm sm:text-base font-bold text-[#1F3A32]">
            Thẻ số cần đặt lên trục:
          </span>
          {act2Targets.map((cardVal) => {
            const placed = act2PlacedMap[cardVal];
            const isMatched = placed === cardVal;
            const isSelected = act2ActiveCard === cardVal;
            return (
              <button
                key={cardVal}
                type="button"
                onClick={() => setAct2ActiveCard(cardVal)}
                className={`min-h-[38px] px-3.5 py-1 rounded-xl font-black text-base tabular-nums border transition cursor-pointer ${
                  isSelected
                    ? 'bg-[#D96B16] text-white border-[#B45309] shadow-sm scale-105'
                    : isMatched && learningMode === 'EXPLORE'
                    ? 'bg-[#15803D] text-white border-[#166534]'
                    : 'bg-white text-[#13382E] border-[#C9BFA8] hover:border-[#136F50]'
                }`}
              >
                {cardVal} {placed !== null && placed !== undefined ? `(tại ${placed})` : '(chưa đặt)'}
              </button>
            );
          })}
        </div>
      );
    }

    if (activeActivityId === 'COMPARE_INTEGERS') {
      if (act3SubMode === 'SORT' && act3SortCards.length > 0) {
        const minVal = Math.min(...act3SortCards);
        const maxVal = Math.max(...act3SortCards);
        return (
          <div className="inline-flex flex-wrap items-center justify-center gap-2.5 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
            <span className="text-sm sm:text-base font-bold text-[#1F3A32]">
              Thứ tự thẻ hiện tại:
            </span>
            {act3SortCards.map((val, idx) => (
              <React.Fragment key={`${val}-${idx}`}>
                <span className="px-3 py-1 rounded-xl bg-[#136F50] text-white text-base sm:text-lg font-black tabular-nums">
                  {val}
                </span>
                {idx < act3SortCards.length - 1 && (
                  <span className="text-[#64748B] font-black">,</span>
                )}
              </React.Fragment>
            ))}
            {learningMode === 'EXPLORE' && (
              <span className="text-xs font-bold text-[#0F766E] ml-1">
                (Min: {minVal} • Max: {maxVal})
              </span>
            )}
          </div>
        );
      }

      const rel = compareIntegers(act3PointA, act3PointB);
      const displayOp =
        learningMode === 'CHALLENGE' && submissionStatus === 'IDLE'
          ? act3ChosenOp || '?'
          : rel;
      return (
        <div className="inline-flex items-center justify-center gap-3 px-7 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
          <span className="px-3.5 py-1 rounded-xl bg-[#2563EB] text-white text-xl sm:text-2xl font-black tabular-nums">
            {act3PointA}
          </span>
          <span className="px-3.5 py-1 rounded-xl bg-white border-2 border-[#D6CFC2] text-[#0F172A] text-xl sm:text-2xl font-black">
            {displayOp}
          </span>
          <span className="px-3.5 py-1 rounded-xl bg-[#16A34A] text-white text-xl sm:text-2xl font-black tabular-nums">
            {act3PointB}
          </span>
        </div>
      );
    }

    if (activeActivityId === 'OPPOSITE_DISTANCE') {
      if (act4SubMode === 'TO_ZERO') {
        const opp = getOppositeInteger(act4PointA);
        const absVal = getAbsoluteValue(act4PointA);
        return (
          <div className="inline-flex flex-wrap items-center justify-center gap-4 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
            <span className="text-base sm:text-lg font-extrabold text-[#13382E] tabular-nums">
              Số đối của <strong className="text-[#D96B16]">{act4PointA}</strong> là{' '}
              <strong className="text-[#15803D]">
                {learningMode === 'CHALLENGE' && submissionStatus === 'IDLE' ? '?' : opp}
              </strong>
            </span>
            <span className="text-[#C8BFA8]">|</span>
            <span className="text-base sm:text-lg font-extrabold text-[#13382E] tabular-nums">
              {act4ShowAbsNotation ? `|${act4PointA}|` : `Khoảng cách từ ${act4PointA} đến 0`} ={' '}
              <strong className="text-[#0F766E]">
                {learningMode === 'CHALLENGE' && submissionStatus === 'IDLE' ? '?' : `${absVal} đơn vị`}
              </strong>
            </span>
          </div>
        );
      }
      const dist = getDistanceBetweenPoints(act4PointA, act4PointB);
      return (
        <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)]">
          <span className="text-base sm:text-xl font-extrabold text-[#13382E] tabular-nums">
            Khoảng cách giữa <strong className="text-[#D96B16]">{act4PointA}</strong> và{' '}
            <strong className="text-[#2563EB]">{act4PointB}</strong>:{' '}
            {act4ShowAbsNotation && (
              <span className="font-mono">
                |{formatIntegerTerm(act4PointA)} - {formatIntegerTerm(act4PointB)}| ={' '}
              </span>
            )}
            <strong className="text-[#15803D]">
              {learningMode === 'CHALLENGE' && submissionStatus === 'IDLE' ? '?' : `${dist} đơn vị`}
            </strong>
          </span>
        </div>
      );
    }

    if (activeActivityId === 'JUMP_ADD_SUB') {
      const aStr = formatIntegerTerm(jumpCalc.a, jumpCalc.a < 0);
      const bStr = formatIntegerTerm(jumpCalc.b, jumpCalc.b < 0);
      return (
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-7 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_22px_rgba(24,52,42,0.09)] text-xl sm:text-[26px] font-black tracking-tight text-[#12382B] tabular-nums">
          <span>
            {aStr} {jumpCalc.op} {bStr}
          </span>
          {jumpCalc.transformedExpression && jumpStepIndex >= 2 && (
            <>
              <span>=</span>
              <span>{jumpCalc.transformedExpression}</span>
            </>
          )}
          <span>=</span>
          <span className="text-[#15803D]">
            {shouldHideJumpResultInChallenge ? '?' : jumpCalc.result}
          </span>
        </div>
      );
    }

    // Activity 6: Rescue Mission
    return (
      <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-[#FAF5EA]/95 border border-[#DFD4C0] shadow-[0_8px_20px_rgba(24,52,42,0.08)] text-sm sm:text-base font-extrabold text-[#12382B] tabular-nums">
        <span>
          Xuất phát: <strong className="text-[#D96B16]">{rescueStart}</strong>
        </span>
        <span>➔</span>
        <span>
          Chuỗi phép tính:{' '}
          <strong className="text-[#0F766E]">
            {rescueChosenCards.length === 0
              ? '(Chọn thẻ bên dưới)'
              : rescueChosenCards.map((c) => c.label).join('  ')}
          </strong>
        </span>
        <span>➔</span>
        <span>
          Đích kho báu: <strong className="text-[#15803D]">{rescueTarget}</strong> (Tối đa{' '}
          {rescueMaxMoves} bước)
        </span>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER ORTHOGRAPHIC SVG NUMBER LINE OVERLAYS PER ACTIVITY (SECTION 2 & 4)
  // --------------------------------------------------------------------------
  const axisY = 178;

  const renderNumberLineActivityLayer = () => {
    if (activeActivityId === 'EXPLORE_NEGATIVE') {
      const xVal = numberToSvgX(act1Value, nlViewport);
      const xZero = numberToSvgX(0, nlViewport);
      return (
        <g>
          {/* Highlight bar from 0 to act1Value */}
          <line
            x1={xZero}
            y1={axisY}
            x2={xVal}
            y2={axisY}
            stroke={act1Value < 0 ? '#D96B16' : '#15803D'}
            strokeWidth="6"
            strokeLinecap="round"
          />
          <circle cx={xZero} cy={axisY} r="6.5" fill="#0F766E" stroke="#FFFFFF" strokeWidth="2" />
          <circle
            cx={xVal}
            cy={axisY}
            r="8.5"
            fill={act1Value < 0 ? '#D96B16' : '#15803D'}
            stroke="#FFFFFF"
            strokeWidth="2.2"
          />
          <g transform={`translate(${xVal}, ${axisY - 12})`}>
            <RobotExplorer3D
              pose="THUMBS_UP"
              facing={act1Value < 0 ? 'LEFT' : 'RIGHT'}
              scale={0.82}
            />
          </g>
        </g>
      );
    }

    if (activeActivityId === 'PLACE_ON_LINE') {
      return (
        <g>
          {act2Targets.map((cardVal, idx) => {
            const placedAt = act2PlacedMap[cardVal];
            if (placedAt === null || placedAt === undefined) return null;
            const xPos = numberToSvgX(placedAt, nlViewport);
            const isCorrectSpot = placedAt === cardVal;
            const pinColor =
              learningMode === 'CHALLENGE' && submissionStatus === 'IDLE'
                ? idx % 2 === 0
                  ? '#EA580C'
                  : '#0284C7'
                : isCorrectSpot
                ? '#15803D'
                : '#DC2626';

            return (
              <g
                key={cardVal}
                transform={`translate(${xPos}, ${axisY})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setAct2ActiveCard(cardVal);
                  setAct2DraggingCard(cardVal);
                }}
              >
                <circle cx="0" cy="0" r="7.5" fill={pinColor} stroke="#FFFFFF" strokeWidth="2" />
                <path
                  d="M0 -8C-14 -24 -20 -34 -20 -45C-20 -56 -11 -64 0 -64C11 -64 20 -56 20 -45C20 -34 14 -24 0 -8Z"
                  fill={pinColor}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
                <text
                  x="0"
                  y="-39"
                  textAnchor="middle"
                  fontSize="15"
                  fontWeight="900"
                  fill="#FFFFFF"
                  fontFamily="Be Vietnam Pro, sans-serif"
                >
                  {cardVal}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    if (activeActivityId === 'COMPARE_INTEGERS') {
      if (act3SubMode === 'SORT' && act3SortCards.length > 0) {
        return (
          <g>
            {act3SortCards.map((val, idx) => {
              const xPos = numberToSvgX(val, nlViewport);
              const badgeY = idx % 2 === 0 ? -48 : -82;
              return (
                <g key={`${val}-${idx}`} transform={`translate(${xPos}, ${axisY})`}>
                  <line x1="0" y1="0" x2="0" y2={badgeY + 26} stroke="#0F766E" strokeWidth="2" strokeDasharray="3 2" />
                  <circle cx="0" cy="0" r="7" fill="#0F766E" stroke="#FFFFFF" strokeWidth="2" />
                  <rect
                    x="-20"
                    y={badgeY}
                    width="40"
                    height="26"
                    rx="7"
                    fill={val < 0 ? '#D96B16' : val > 0 ? '#15803D' : '#0284C7'}
                    stroke="#FFFFFF"
                    strokeWidth="1.6"
                  />
                  <text
                    x="0"
                    y={badgeY + 18}
                    textAnchor="middle"
                    fontSize="13.5"
                    fontWeight="900"
                    fill="#FFFFFF"
                  >
                    {val}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }

      const xA = numberToSvgX(act3PointA, nlViewport);
      const xB = numberToSvgX(act3PointB, nlViewport);
      const minX = Math.min(xA, xB);
      const maxX = Math.max(xA, xB);
      return (
        <g>
          {/* Directional comparison arrow from left (smaller) to right (larger) */}
          {act3PointA !== act3PointB && (
            <g>
              <line
                x1={minX}
                y1={axisY - 46}
                x2={maxX}
                y2={axisY - 46}
                stroke="#0F766E"
                strokeWidth="3"
                strokeDasharray="5 4"
              />
              <text
                x={(minX + maxX) / 2}
                y={axisY - 56}
                textAnchor="middle"
                fontSize="12.5"
                fontWeight="800"
                fill="#0F766E"
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                Bên phải lớn hơn bên trái ➔
              </text>
            </g>
          )}

          {/* Draggable Point A */}
          <g
            transform={`translate(${xA}, ${axisY})`}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.stopPropagation();
              setAct3DraggingEnd('A');
            }}
          >
            <circle cx="0" cy="0" r="8" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.2" />
            <rect x="-22" y="-44" width="44" height="30" rx="8" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.8" />
            <text x="0" y="-24" textAnchor="middle" fontSize="14" fontWeight="900" fill="#FFFFFF">
              A({act3PointA})
            </text>
          </g>

          {/* Draggable Point B */}
          <g
            transform={`translate(${xB}, ${axisY})`}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.stopPropagation();
              setAct3DraggingEnd('B');
            }}
          >
            <circle cx="0" cy="0" r="8" fill="#16A34A" stroke="#FFFFFF" strokeWidth="2.2" />
            <rect x="-22" y="-82" width="44" height="30" rx="8" fill="#16A34A" stroke="#FFFFFF" strokeWidth="1.8" />
            <text x="0" y="-62" textAnchor="middle" fontSize="14" fontWeight="900" fill="#FFFFFF">
              B({act3PointB})
            </text>
          </g>
        </g>
      );
    }

    if (activeActivityId === 'OPPOSITE_DISTANCE') {
      const xZero = numberToSvgX(0, nlViewport);
      const xA = numberToSvgX(act4PointA, nlViewport);
      const oppA = getOppositeInteger(act4PointA);
      const xOpp = numberToSvgX(oppA, nlViewport);
      const xB = numberToSvgX(act4PointB, nlViewport);

      if (act4SubMode === 'TO_ZERO') {
        const absVal = getAbsoluteValue(act4PointA);
        return (
          <g>
            {/* 3D Mirror at Center of Symmetry 0 */}
            <g transform={`translate(${xZero}, ${axisY})`}>
              <rect
                x="-6"
                y="-86"
                width="12"
                height="82"
                rx="6"
                fill="#E0F2FE"
                fillOpacity="0.82"
                stroke="#0284C7"
                strokeWidth="2"
              />
              <line x1="0" y1="-92" x2="0" y2="12" stroke="#0284C7" strokeWidth="2" strokeDasharray="4 3" />
              <text
                x="0"
                y="-96"
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="800"
                fill="#0369A1"
              >
                Tâm đối xứng 0
              </text>
            </g>

            {/* Distance brackets to 0 */}
            {act4PointA !== 0 && (
              <>
                <line x1={xA} y1={axisY - 26} x2={xZero} y2={axisY - 26} stroke="#EA580C" strokeWidth="3.5" />
                <text
                  x={(xA + xZero) / 2}
                  y={axisY - 34}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="900"
                  fill="#EA580C"
                >
                  |{act4PointA}| = {absVal}
                </text>

                <line x1={xZero} y1={axisY - 26} x2={xOpp} y2={axisY - 26} stroke="#16A34A" strokeWidth="3.5" strokeDasharray="4 3" />
                <text
                  x={(xZero + xOpp) / 2}
                  y={axisY - 34}
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="900"
                  fill="#16A34A"
                >
                  |{oppA}| = {absVal}
                </text>
              </>
            )}

            {/* Point A (Draggable) */}
            <g
              transform={`translate(${xA}, ${axisY})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => {
                e.stopPropagation();
                setAct4DraggingPoint('A');
              }}
            >
              <circle cx="0" cy="0" r="10" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2.2" />
              <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFFFFF">
                A
              </text>
            </g>

            {/* Symmetric Point A' at -a */}
            <g transform={`translate(${xOpp}, ${axisY})`}>
              <circle cx="0" cy="0" r="10" fill="#16A34A" stroke="#FFFFFF" strokeWidth="2.2" />
              <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFFFFF">
                A′
              </text>
            </g>
          </g>
        );
      }

      // Sub-mode: Distance between two points A and B (|a - b|)
      const distAB = getDistanceBetweenPoints(act4PointA, act4PointB);
      return (
        <g>
          <line
            x1={xA}
            y1={axisY - 34}
            x2={xB}
            y2={axisY - 34}
            stroke="#0F766E"
            strokeWidth="4"
          />
          <line x1={xA} y1={axisY - 42} x2={xA} y2={axisY} stroke="#EA580C" strokeWidth="2" strokeDasharray="3 3" />
          <line x1={xB} y1={axisY - 42} x2={xB} y2={axisY} stroke="#2563EB" strokeWidth="2" strokeDasharray="3 3" />
          <rect
            x={(xA + xB) / 2 - 64}
            y={axisY - 68}
            width="128"
            height="26"
            rx="8"
            fill="#0F766E"
          />
          <text
            x={(xA + xB) / 2}
            y={axisY - 51}
            textAnchor="middle"
            fontSize="13"
            fontWeight="900"
            fill="#FFFFFF"
          >
            |a - b| = {distAB} đơn vị
          </text>

          <g
            transform={`translate(${xA}, ${axisY})`}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.stopPropagation();
              setAct4DraggingPoint('A');
            }}
          >
            <circle cx="0" cy="0" r="9.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2.2" />
          </g>
          <g
            transform={`translate(${xB}, ${axisY})`}
            className="cursor-grab active:cursor-grabbing"
            onPointerDown={(e) => {
              e.stopPropagation();
              setAct4DraggingPoint('B');
            }}
          >
            <circle cx="0" cy="0" r="9.5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="2.2" />
          </g>
        </g>
      );
    }

    if (activeActivityId === 'JUMP_ADD_SUB') {
      const xStart = numberToSvgX(jumpCalc.a, nlViewport);
      const xEnd = numberToSvgX(jumpCalc.result, nlViewport);
      const xRobot = numberToSvgX(jumpRobotPos, nlViewport);
      const midX = (xStart + xEnd) / 2;
      const arcSpanPx = Math.abs(xEnd - xStart);
      const arcPeakY = axisY - Math.min(118, Math.max(58, arcSpanPx * 0.36));
      const jumpColor =
        jumpCalc.direction === 'RIGHT'
          ? '#15803D'
          : jumpCalc.direction === 'LEFT'
          ? '#D96B16'
          : '#0F766E';
      const signedDeltaLabel =
        jumpCalc.effectiveDelta > 0
          ? `+${jumpCalc.effectiveDelta}`
          : `${jumpCalc.effectiveDelta}`;

      // Calculate arrow tangent near xEnd for crisp arrowhead
      const dx = xEnd - midX;
      const dy = axisY - 8 - arcPeakY;
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

      // Unit hops array if showUnitHops is enabled
      const unitHopSegments: { from: number; to: number }[] = [];
      if (showUnitHops && jumpCalc.distanceUnits > 0 && jumpCalc.distanceUnits <= 20) {
        const stepDir = jumpCalc.effectiveDelta > 0 ? 1 : -1;
        for (let i = 0; i < jumpCalc.distanceUnits; i++) {
          unitHopSegments.push({
            from: jumpCalc.a + i * stepDir,
            to: jumpCalc.a + (i + 1) * stepDir,
          });
        }
      }

      return (
        <g>
          {/* Optional small unit hops underneath main arc so they never conflict */}
          {showUnitHops &&
            jumpStepIndex >= 3 &&
            unitHopSegments.map((seg, idx) => {
              const ux1 = numberToSvgX(seg.from, nlViewport);
              const ux2 = numberToSvgX(seg.to, nlViewport);
              const umid = (ux1 + ux2) / 2;
              return (
                <path
                  key={idx}
                  d={`M ${ux1} ${axisY} Q ${umid} ${axisY - 24} ${ux2} ${axisY}`}
                  fill="none"
                  stroke={jumpColor}
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />
              );
            })}

          {/* Main Parabolic Jump Arc (Shown from Step 3 onwards) */}
          {jumpStepIndex >= 3 && jumpCalc.distanceUnits > 0 && (
            <g>
              <path
                d={`M ${xStart} ${axisY} Q ${midX} ${arcPeakY} ${xEnd} ${axisY - 6}`}
                fill="none"
                stroke={jumpColor}
                strokeWidth="4.2"
                strokeLinecap="round"
              />
              {/* Arrowhead at xEnd */}
              <g transform={`translate(${xEnd}, ${axisY - 6}) rotate(${angleDeg})`}>
                <polygon points="0,0 -13,-6.5 -10,0 -13,6.5" fill={jumpColor} />
              </g>
              {/* Signed Displacement Label above Arc Peak (e.g. +5) */}
              <text
                x={midX}
                y={arcPeakY + 14}
                textAnchor="middle"
                fontSize="28"
                fontWeight="900"
                fill={jumpColor}
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                {signedDeltaLabel}
              </text>
            </g>
          )}

          {/* Start Point Node at a (Orange Circle matching reference image) */}
          <circle
            cx={xStart}
            cy={axisY}
            r="9.5"
            fill="#E06D1A"
            stroke="#FFFDF9"
            strokeWidth="2.2"
          />

          {/* End Point Node at a + delta (Green Circle matching reference image) */}
          {jumpStepIndex >= 4 && !shouldHideJumpResultInChallenge && (
            <circle
              cx={xEnd}
              cy={axisY}
              r="9.5"
              fill="#15803D"
              stroke="#FFFDF9"
              strokeWidth="2.2"
            />
          )}

          {/* 3D Explorer Robot positioned at current jumpRobotPos */}
          <g transform={`translate(${xRobot}, ${axisY - 12})`}>
            <RobotExplorer3D
              pose={isJumpPlaying ? 'WALKING' : 'THUMBS_UP'}
              facing={jumpCalc.direction === 'LEFT' ? 'LEFT' : 'FRONT'}
              scale={0.92}
            />
          </g>
        </g>
      );
    }

    // Activity 6: Rescue Mission on the Number Line
    const xStart = numberToSvgX(rescueStart, nlViewport);
    const xTarget = numberToSvgX(rescueTarget, nlViewport);
    const xRobot = numberToSvgX(rescueRobotPos, nlViewport);

    return (
      <g>
        {/* Step arcs for each chosen rescue card */}
        {rescueVerification.stepsApplied.map((st, idx) => {
          const sx1 = numberToSvgX(st.from, nlViewport);
          const sx2 = numberToSvgX(st.to, nlViewport);
          const smid = (sx1 + sx2) / 2;
          const peak = axisY - 46 - idx * 16;
          const color = idx % 2 === 0 ? '#15803D' : '#0284C7';
          return (
            <g key={`${st.card.id}-${idx}`}>
              <path
                d={`M ${sx1} ${axisY} Q ${smid} ${peak} ${sx2} ${axisY}`}
                fill="none"
                stroke={color}
                strokeWidth="3.2"
                strokeDasharray="5 3"
              />
              <text
                x={smid}
                y={peak + 12}
                textAnchor="middle"
                fontSize="14"
                fontWeight="900"
                fill={color}
              >
                {st.card.label}
              </text>
            </g>
          );
        })}

        {/* Start Marker */}
        <circle cx={xStart} cy={axisY} r="8.5" fill="#EA580C" stroke="#FFFFFF" strokeWidth="2" />

        {/* Target Golden Treasure Chest on Number Line */}
        <g transform={`translate(${xTarget}, ${axisY - 22})`}>
          <circle cx="0" cy="0" r="22" fill="#FDE047" fillOpacity="0.35" />
          <rect x="-18" y="-8" width="36" height="22" rx="4" fill="#92400E" stroke="#F59E0B" strokeWidth="2" />
          <path d="M-19 -8C-19 -18 19 -18 19 -8Z" fill="#B45309" stroke="#F59E0B" strokeWidth="2" />
          <rect x="-4" y="-6" width="8" height="9" rx="2" fill="#FACC15" stroke="#78350F" strokeWidth="1" />
        </g>
        <circle cx={xTarget} cy={axisY} r="8.5" fill="#15803D" stroke="#FFFFFF" strokeWidth="2" />

        {/* Robot Explorer */}
        <g transform={`translate(${xRobot}, ${axisY - 12})`}>
          <RobotExplorer3D
            pose={isRescueAnimating ? 'WALKING' : 'THUMBS_UP'}
            facing={rescueTarget < rescueStart ? 'LEFT' : 'FRONT'}
            scale={0.86}
          />
        </g>
      </g>
    );
  };

  return (
    <div
      className={`rounded-[26px] border border-[#DFD5C3] bg-[#F5EFE2] text-[#14332A] shadow-[0_14px_38px_rgba(20,51,42,0.09)] overflow-hidden flex flex-col select-none ${
        isPresentationActive ? 'fixed inset-2 z-50 rounded-[22px]' : ''
      }`}
      style={{
        fontFamily:
          '"Be Vietnam Pro", "Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
      }}
    >
      {/* ====================================================================
          1. TOP HEADER BAR (MATCHING REFERENCE IMAGE / SECTION 3)
          ==================================================================== */}
      <header className="px-3.5 sm:px-6 py-3 bg-[#F7F2E7] border-b border-[#E2D9C5] flex flex-wrap items-center justify-between gap-3">
        {/* Left: Back to Library + Brand & Room Title */}
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          {onBackToHub && (
            <button
              type="button"
              onClick={onBackToHub}
              className="min-h-[44px] px-4 py-2 rounded-full bg-[#EFE8D8] hover:bg-[#E5DEC9] border border-[#D5CBB6] text-[#173A30] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 transition cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#136F50]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Về thư viện</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <TayDoSmartMathLogo3D />
            <div className="leading-tight">
              <div className="text-xs sm:text-sm font-black tracking-tight text-[#135E46]">
                TÂY ĐÔ SMART EDU
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold tracking-wider text-[#6E7A74] uppercase">
                SMART MATH LAB
              </div>
            </div>
          </div>

          <span className="hidden md:inline-block h-7 w-[1.5px] bg-[#D6CCB8] mx-1" aria-hidden="true" />

          <h1 className="text-lg sm:text-2xl lg:text-[26px] font-black text-[#124E3B] tracking-tight truncate">
            Số nguyên và trục số
          </h1>
        </div>

        {/* Right: Khám phá | Thử thách | Lớp học | Toàn màn hình */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLearningMode('EXPLORE')}
            aria-pressed={learningMode === 'EXPLORE'}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition cursor-pointer ${
              learningMode === 'EXPLORE'
                ? 'bg-[#136F50] text-white border-[#0E573E] shadow-[0_4px_12px_rgba(19,111,80,0.28)]'
                : 'bg-[#EFE8D8] text-[#173A30] border-[#D5CBB6] hover:bg-[#E6DEC9]'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>Khám phá</span>
          </button>

          <button
            type="button"
            onClick={() => setLearningMode('CHALLENGE')}
            aria-pressed={learningMode === 'CHALLENGE'}
            className={`min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border transition cursor-pointer ${
              learningMode === 'CHALLENGE'
                ? 'bg-gradient-to-b from-[#FAD691] to-[#E6A647] text-[#5C3409] border-[#C98627] shadow-[0_4px_12px_rgba(217,119,6,0.25)]'
                : 'bg-[#F5E3BE] text-[#6E4212] border-[#DFC28C] hover:bg-[#F0D6A4]'
            }`}
          >
            <Trophy className="w-4 h-4 shrink-0 text-[#B45309]" />
            <span>Thử thách</span>
          </button>

          <button
            type="button"
            onClick={() => setShowClassroomModal(true)}
            className="min-h-[44px] px-3.5 py-2 rounded-full bg-[#EFE8D8] hover:bg-[#E5DEC9] border border-[#D5CBB6] text-[#173A30] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            title="Tổ chức lớp học (Cá nhân / Nhóm / Giáo viên điều khiển chung, 1–50 HS)"
          >
            <Users className="w-4 h-4 text-[#136F50]" />
            <span className="hidden sm:inline">Tổ chức lớp</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Bật âm thanh phản hồi' : 'Tắt âm thanh phản hồi'}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-full bg-[#EFE8D8] hover:bg-[#E5DEC9] border border-[#D5CBB6] text-[#173A30] inline-flex items-center justify-center transition cursor-pointer"
            title={isMuted ? 'Âm thanh đang tắt (Mặc định tắt)' : 'Âm thanh đang bật'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-[#64748B]" /> : <Volume2 className="w-4 h-4 text-[#136F50]" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreenRoom}
            className="min-h-[44px] px-4 py-2 rounded-full bg-[#EFE8D8] hover:bg-[#E5DEC9] border border-[#D5CBB6] text-[#173A30] text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition cursor-pointer"
          >
            {isPresentationActive ? (
              <>
                <Minimize2 className="w-4 h-4 shrink-0" />
                <span>Thoát trình chiếu</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4 shrink-0" />
                <span>Toàn màn hình</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ====================================================================
          2. MAIN 3-COLUMN WORKSPACE (LEFT 6 ACTIVITIES | CENTER 3D STAGE | RIGHT MISSION)
          ==================================================================== */}
      <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-stretch">
        {/* ------------------------------------------------------------------
            LEFT COLUMN: 6 ACTIVITIES LIST
            ------------------------------------------------------------------ */}
        <aside
          aria-label="Danh sách 6 hoạt động Số nguyên và trục số"
          className={`${
            isPresentationActive ? 'lg:col-span-2' : 'lg:col-span-3 xl:col-span-2'
          } bg-[#F8F4EC] rounded-[22px] border border-[#DFD6C3] shadow-xs overflow-hidden flex flex-col justify-between`}
        >
          <div>
            <div className="bg-[#136F50] text-white px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                <Layers className="w-4 h-4 shrink-0" />
                <span>6 hoạt động</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLeftSidebarMobile((v) => !v)}
                className="lg:hidden text-xs font-bold px-2.5 py-1 rounded-lg bg-white/15 text-white cursor-pointer"
              >
                {showLeftSidebarMobile ? 'Thu gọn' : 'Mở danh sách'}
              </button>
            </div>

            <div className={`${showLeftSidebarMobile ? 'block' : 'hidden lg:block'} p-2.5 space-y-2`}>
              {M07_ACTIVITY_METADATA.map((act) => {
                const isActive = act.id === activeActivityId;
                const actTasks = getTasksByActivity(act.id);
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
                      setShowLeftSidebarMobile(false);
                    }}
                    className={`w-full min-h-[48px] px-3 py-2.5 rounded-2xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-[#136F50] text-white border-[#0D523A] shadow-[0_6px_14px_rgba(19,111,80,0.25)]'
                        : 'bg-[#F3EDE0] hover:bg-[#EAE1CE] text-[#1C382F] border-[#E0D6C2]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center shrink-0 tabular-nums ${
                          isActive
                            ? 'bg-white text-[#136F50]'
                            : 'bg-[#E2D9C5] text-[#2B473E]'
                        }`}
                      >
                        {act.number}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-[13px] font-extrabold truncate">
                          {act.shortTitle}
                        </div>
                        {doneCount > 0 && (
                          <div
                            className={`text-[10px] font-semibold tabular-nums ${
                              isActive ? 'text-emerald-100' : 'text-[#15803D]'
                            }`}
                          >
                            Đã hoàn thành {doneCount}/{actTasks.length}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-[#6E7A74]'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle 6 3D Thumbnail Strip & Reduce Motion */}
          <div className="p-2.5 border-t border-[#E5DEC9] space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => setShowThumbnailsStrip((v) => !v)}
              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#EFE8D8] hover:bg-[#E4DCC7] text-[#173A30] font-bold flex items-center justify-between cursor-pointer"
            >
              <span>Thẻ 3D 6 hoạt động</span>
              <span>{showThumbnailsStrip ? 'Thu gọn' : 'Mở lại'}</span>
            </button>

            <button
              type="button"
              onClick={() => setReduceMotion((v) => !v)}
              aria-pressed={reduceMotion}
              className={`w-full min-h-[38px] px-3 py-1.5 rounded-xl font-semibold flex items-center justify-between cursor-pointer border ${
                reduceMotion
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-white/70 border-[#E2D9C5] text-[#475B53]'
              }`}
            >
              <span>Giảm chuyển động</span>
              <span>{reduceMotion ? 'Đang bật' : 'Tắt'}</span>
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------------------------
            CENTER COLUMN: 3D INTERACTIVE STAGE ("SÂN KHẤU TƯƠNG TÁC LỚN")
            ------------------------------------------------------------------ */}
        <section
          aria-label="Sân khấu mô hình 3D và trục số tương tác"
          className={`${
            isPresentationActive ? 'lg:col-span-7' : 'lg:col-span-6 xl:col-span-7'
          } relative rounded-[24px] border border-[#DDD2BE] bg-gradient-to-b from-[#F5ECDC] via-[#FAF5EA] to-[#E6DAC3] shadow-[inset_0_2px_18px_rgba(255,255,255,0.85),0_10px_28px_rgba(20,51,42,0.08)] flex flex-col justify-between overflow-hidden min-h-[470px]`}
        >
          {/* Soft Studio Spotlights at Top Corners */}
          <div
            className="pointer-events-none absolute -top-12 left-16 w-64 h-40 rounded-full bg-[#FFF7E2]/90 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -top-12 right-16 w-64 h-40 rounded-full bg-[#FFF7E2]/90 blur-2xl"
            aria-hidden="true"
          />

          {/* Top Bar inside Stage: Activity Title Tab + Viewport Zoom/Step Controls */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
            {/* Floating Activity Title Tab matching reference image */}
            <div className="inline-flex items-center gap-3 pr-5 pl-2 py-1.5 rounded-2xl bg-[#EFE6D4]/95 border border-[#DDD1BC] shadow-xs">
              <ActivityHeaderBadgeIcon3D activityId={activeActivityId} />
              <div>
                <h2 className="text-base sm:text-xl font-black text-[#12382B] tracking-tight">
                  {activeMeta.fullTitle}
                </h2>
                <p className="text-[11px] font-semibold text-[#5B6E65] hidden sm:block">
                  {activeMeta.subtitle}
                </p>
              </div>
            </div>

            {/* Number Line Axis Controls: Step (1, 2, 5), Pan & Zoom */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#F7F2E7]/90 border border-[#DFD5C2] rounded-2xl px-2.5 py-1.5 text-xs">
              <span className="font-bold text-[#4B5E56] mr-1">Bước chia:</span>
              {([1, 2, 5] as M07TickStep[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setTickStep(st);
                    if (st === 5 && viewHalfSpan < 15) setViewHalfSpan(15);
                    if (st === 2 && viewHalfSpan < 8) setViewHalfSpan(10);
                  }}
                  className={`min-w-[32px] min-h-[32px] px-2 rounded-lg font-extrabold cursor-pointer transition ${
                    tickStep === st
                      ? 'bg-[#136F50] text-white'
                      : 'bg-white text-[#1C382F] hover:bg-[#EAE1CE]'
                  }`}
                >
                  {st}
                </button>
              ))}

              <span className="mx-1 text-[#C8BFA8]">|</span>

              <button
                type="button"
                onClick={() => setHideIntermediateLabels((v) => !v)}
                className={`min-h-[32px] px-2.5 rounded-lg font-bold inline-flex items-center gap-1 cursor-pointer border ${
                  hideIntermediateLabels
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-white border-[#DFD5C2] text-[#1C382F]'
                }`}
                title="Bật/tắt ẩn nhãn số trên trục để tăng độ khó"
              >
                {hideIntermediateLabels ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden xl:inline">
                  {hideIntermediateLabels ? 'Đang ẩn nhãn' : 'Hiện nhãn'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewHalfSpan((s) => Math.max(5, s - 2))}
                aria-label="Phóng to trục số"
                className="min-w-[32px] min-h-[32px] rounded-lg bg-white border border-[#DFD5C2] flex items-center justify-center hover:bg-[#EAE1CE] cursor-pointer"
                title="Phóng to trục số"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewHalfSpan((s) => Math.min(30, s + 5))}
                aria-label="Thu nhỏ mở rộng trục số"
                className="min-w-[32px] min-h-[32px] rounded-lg bg-white border border-[#DFD5C2] flex items-center justify-center hover:bg-[#EAE1CE] cursor-pointer"
                title="Mở rộng phạm vi trục số"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Formula / Status Banner */}
          <div className="relative z-10 px-4 pt-2 flex justify-center">
            {renderStageHeadlineBanner()}
          </div>

          {/* 3D Stage Scene: Left Thermometer + Center Orthographic SVG Number Line + Right Glass Elevator */}
          <div className="relative z-10 flex-1 flex items-center justify-between px-2 sm:px-4 py-1 gap-1">
            {/* Left 3D Prop: Thermometer 3D */}
            <div className="hidden md:flex flex-col items-center shrink-0">
              <Thermometer3DProp
                temperatureC={
                  activeActivityId === 'EXPLORE_NEGATIVE'
                    ? act1Value
                    : activeActivityId === 'JUMP_ADD_SUB'
                    ? jumpCalc.a
                    : -5
                }
                interactive={activeActivityId === 'EXPLORE_NEGATIVE'}
                onChangeTemp={(deg) => setAct1Value(deg)}
              />
            </div>

            {/* Center Orthographic SVG Number Line (Never distorted by 3D perspective!) */}
            <div className="flex-1 min-w-0 flex flex-col items-center">
              <svg
                ref={svgRef}
                viewBox="0 0 820 235"
                className="w-full h-auto overflow-visible select-none touch-none"
                onPointerMove={handleSvgPointerMove}
                onPointerUp={handleSvgPointerUp}
                onPointerLeave={handleSvgPointerUp}
                onClick={(e) => {
                  if (activeActivityId === 'PLACE_ON_LINE' && act2ActiveCard !== null) {
                    const snapped = clientXToSnappedInteger(e.clientX, true);
                    setAct2PlacedMap((prev) => ({ ...prev, [act2ActiveCard]: snapped }));
                    setAct2ProbePoint(snapped);
                  }
                }}
              >
                {/* Main Horizontal Orthographic Axis */}
                <line
                  x1={nlViewport.leftPx - 26}
                  y1={axisY}
                  x2={nlViewport.rightPx + 26}
                  y2={axisY}
                  stroke="#0F1D2E"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                />
                {/* Left & Right Axis Arrowheads */}
                <polygon
                  points={`${nlViewport.leftPx - 32},${axisY} ${nlViewport.leftPx - 18},${axisY - 7} ${nlViewport.leftPx - 18},${axisY + 7}`}
                  fill="#0F1D2E"
                />
                <polygon
                  points={`${nlViewport.rightPx + 32},${axisY} ${nlViewport.rightPx + 18},${axisY - 7} ${nlViewport.rightPx + 18},${axisY + 7}`}
                  fill="#0F1D2E"
                />

                {/* Ticks & Crisp Separated Labels */}
                {nlTicks.map((t) => {
                  const x = numberToSvgX(t.value, nlViewport);
                  const isHighlightedStart =
                    activeActivityId === 'JUMP_ADD_SUB' && t.value === jumpCalc.a;
                  const isHighlightedEnd =
                    activeActivityId === 'JUMP_ADD_SUB' &&
                    !shouldHideJumpResultInChallenge &&
                    jumpStepIndex >= 4 &&
                    t.value === jumpCalc.result;

                  const showLabel =
                    t.isZero ||
                    isHighlightedStart ||
                    isHighlightedEnd ||
                    (!hideIntermediateLabels && t.isMajor);

                  const labelColor = isHighlightedStart
                    ? '#D96B16'
                    : isHighlightedEnd
                    ? '#15803D'
                    : t.isZero
                    ? '#0F766E'
                    : '#13262F';

                  return (
                    <g key={t.value}>
                      <line
                        x1={x}
                        y1={t.isZero ? axisY - 13 : t.isMajor ? axisY - 10 : axisY - 5}
                        x2={x}
                        y2={t.isZero ? axisY + 13 : t.isMajor ? axisY + 10 : axisY + 5}
                        stroke={t.isZero ? '#0F766E' : '#0F1D2E'}
                        strokeWidth={t.isZero ? '3.4' : t.isMajor ? '2.6' : '1.4'}
                        strokeLinecap="round"
                      />
                      {showLabel && (
                        <text
                          x={x}
                          y={axisY + 36}
                          textAnchor="middle"
                          fontSize={isHighlightedStart || isHighlightedEnd ? '22' : '18'}
                          fontWeight={
                            isHighlightedStart || isHighlightedEnd || t.isZero ? '900' : '700'
                          }
                          fill={labelColor}
                          fontFamily="Be Vietnam Pro, sans-serif"
                        >
                          {t.value}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Activity-Specific Interactive Layer on the Number Line */}
                {renderNumberLineActivityLayer()}
              </svg>
            </div>

            {/* Right 3D Prop: Brushed-Steel Glass Elevator */}
            <div className="hidden md:flex flex-col items-center shrink-0">
              <Elevator3DProp
                floor={
                  activeActivityId === 'EXPLORE_NEGATIVE'
                    ? Math.max(-5, Math.min(5, act1Value))
                    : activeActivityId === 'JUMP_ADD_SUB'
                    ? Math.max(-5, Math.min(5, Math.round(jumpRobotPos)))
                    : 0
                }
              />
            </div>
          </div>

          {/* ================================================================
              3D MARBLE PEDESTAL BASE & ACTIVITY CONTROL DECK (BOTTOM OF STAGE)
              ================================================================ */}
          <div className="relative z-10 px-3 sm:px-6 pb-3 pt-1">
            {/* 3D Pedestal Rim & Stacked Books / Pi Cup Props */}
            <div className="relative rounded-[24px] bg-gradient-to-b from-[#EFE7D6] via-[#E5D8BF] to-[#D4C3A3] border-t-2 border-[#FFFDF7] shadow-[0_8px_20px_rgba(20,51,42,0.14)] px-3 sm:px-5 py-3">
              {/* Warm Golden LED Rim Glow under Pedestal Top */}
              <div
                className="pointer-events-none absolute top-0 left-8 right-8 h-1 rounded-full bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent opacity-75"
                aria-hidden="true"
              />

              {/* Left Decorative 3D Stacked Books ("Số nguyên" & "Trục số") */}
              <div
                className="hidden xl:flex flex-col gap-0.5 absolute -left-2 bottom-3 select-none pointer-events-none"
                aria-hidden="true"
              >
                <div className="px-3 py-1 rounded-r-lg bg-[#16654A] text-white text-[10px] font-black shadow-sm border border-[#228B67] -rotate-2">
                  Số nguyên
                </div>
                <div className="px-3.5 py-1 rounded-r-lg bg-[#D96B16] text-white text-[10px] font-black shadow-sm border border-[#F59E0B]">
                  Trục số
                </div>
              </div>

              {/* Right Decorative 3D Ceramic π Cup */}
              <div
                className="hidden xl:flex items-center justify-center absolute right-3 bottom-3 w-10 h-11 rounded-b-xl rounded-t-md bg-gradient-to-r from-[#FAF6EE] to-[#DFD7C8] border border-[#C8BFA8] shadow-sm text-[#135E46] font-serif font-black text-lg select-none pointer-events-none"
                aria-hidden="true"
              >
                π
              </div>

              {/* Activity-Specific Interactive Control Bar */}
              {activeActivityId === 'JUMP_ADD_SUB' && (
                <div className="space-y-2.5">
                  {/* Primary Action Buttons matching reference image */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleStepByStepJump}
                      className="min-h-[44px] px-5 py-2 rounded-full bg-gradient-to-b from-[#FBF7EE] to-[#E9DFC8] hover:from-white hover:to-[#EFE6D2] border border-[#CBBFA6] text-[#14332A] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <FastForward className="w-4 h-4 text-[#136F50]" />
                      <span>Từng bước ({jumpStepIndex}/5)</span>
                    </button>

                    {!isJumpPlaying ? (
                      <button
                        type="button"
                        onClick={() => handlePlayJumpSequence(false)}
                        className="min-h-[44px] px-5 py-2 rounded-full bg-gradient-to-b from-[#FBF7EE] to-[#E9DFC8] hover:from-white hover:to-[#EFE6D2] border border-[#CBBFA6] text-[#14332A] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Play className="w-4 h-4 text-[#15803D]" />
                        <span>Chạy</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={cancelActiveAnimations}
                        className="min-h-[44px] px-5 py-2 rounded-full bg-amber-100 border border-amber-400 text-amber-950 text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Tạm dừng</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleReplayJumpFromA}
                      className="min-h-[44px] px-5 py-2 rounded-full bg-gradient-to-b from-[#FBF7EE] to-[#E9DFC8] hover:from-white hover:to-[#EFE6D2] border border-[#CBBFA6] text-[#14332A] text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-[#136F50]" />
                      <span>Chạy lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCurrentTask}
                      className="min-h-[44px] px-4 py-2 rounded-full bg-gradient-to-b from-[#FBF7EE] to-[#E9DFC8] hover:from-white hover:to-[#EFE6D2] border border-[#CBBFA6] text-[#14332A] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <span>Làm lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCustomJumpControls((v) => !v)}
                      aria-expanded={showCustomJumpControls}
                      className={`min-h-[44px] px-5 py-2 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 border shadow-sm transition cursor-pointer ${
                        showCustomJumpControls
                          ? 'bg-[#0E5A40] text-white border-[#093D2B]'
                          : 'bg-[#136F50] hover:bg-[#0F5C42] text-white border-[#0D523A]'
                      }`}
                    >
                      <Hand className="w-4 h-4" />
                      <span>Tự thao tác</span>
                    </button>
                  </div>

                  {/* Expandable Custom Input Deck for a, op (+ / -), b, Speed, and Unit Hops */}
                  {showCustomJumpControls && (
                    <div className="pt-2 border-t border-[#D5C8AE] flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm">
                      <label className="inline-flex items-center gap-1.5 font-bold text-[#14332A]">
                        <span>Số đầu a:</span>
                        <input
                          type="number"
                          min={-25}
                          max={25}
                          value={jumpA}
                          onChange={(e) => {
                            cancelActiveAnimations();
                            const val = normalizeInteger(Number(e.target.value));
                            setJumpA(val);
                            setJumpRobotPos(val);
                            setJumpStepIndex(5);
                          }}
                          className="w-16 min-h-[38px] px-2 rounded-xl bg-white border border-[#C6B99F] text-center font-black tabular-nums"
                        />
                      </label>

                      <div className="inline-flex rounded-xl bg-white p-0.5 border border-[#C6B99F]">
                        <button
                          type="button"
                          onClick={() => {
                            cancelActiveAnimations();
                            setJumpOp('+');
                            setJumpStepIndex(5);
                          }}
                          className={`min-w-[40px] min-h-[36px] rounded-lg font-black text-base cursor-pointer ${
                            jumpOp === '+'
                              ? 'bg-[#15803D] text-white'
                              : 'text-[#14332A] hover:bg-[#F3EDE0]'
                          }`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            cancelActiveAnimations();
                            setJumpOp('-');
                            setJumpStepIndex(5);
                          }}
                          className={`min-w-[40px] min-h-[36px] rounded-lg font-black text-base cursor-pointer ${
                            jumpOp === '-'
                              ? 'bg-[#D96B16] text-white'
                              : 'text-[#14332A] hover:bg-[#F3EDE0]'
                          }`}
                        >
                          −
                        </button>
                      </div>

                      <label className="inline-flex items-center gap-1.5 font-bold text-[#14332A]">
                        <span>Số thứ hai b:</span>
                        <input
                          type="number"
                          min={-25}
                          max={25}
                          value={jumpB}
                          onChange={(e) => {
                            cancelActiveAnimations();
                            const val = normalizeInteger(Number(e.target.value));
                            setJumpB(val);
                            setJumpStepIndex(5);
                          }}
                          className="w-16 min-h-[38px] px-2 rounded-xl bg-white border border-[#C6B99F] text-center font-black tabular-nums"
                        />
                      </label>

                      <label className="inline-flex items-center gap-1.5 font-bold text-[#14332A] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showUnitHops}
                          onChange={(e) => setShowUnitHops(e.target.checked)}
                          className="w-4 h-4 accent-[#136F50]"
                        />
                        <span>Hiện từng đơn vị</span>
                      </label>

                      <div className="inline-flex items-center gap-1 font-bold text-[#14332A]">
                        <span>Tốc độ:</span>
                        {([0.5, 1, 1.5, 2] as const).map((sp) => (
                          <button
                            key={sp}
                            type="button"
                            onClick={() => setJumpSpeed(sp)}
                            className={`px-2 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                              jumpSpeed === sp
                                ? 'bg-[#136F50] text-white'
                                : 'bg-white text-[#14332A]'
                            }`}
                          >
                            {sp}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Activity 1 Controls: Switch Context + Slider */}
              {activeActivityId === 'EXPLORE_NEGATIVE' && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {([
                    { id: 'THERMOMETER', label: 'Nhiệt kế (°C)' },
                    { id: 'ELEVATOR', label: 'Thang máy (Tầng trệt = 0)' },
                    { id: 'SEA_LEVEL', label: 'Mực nước biển (0 m)' },
                  ] as const).map((ctx) => (
                    <button
                      key={ctx.id}
                      type="button"
                      onClick={() => setAct1Context(ctx.id)}
                      className={`min-h-[42px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold border transition cursor-pointer ${
                        act1Context === ctx.id
                          ? 'bg-[#136F50] text-white border-[#0D523A]'
                          : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6]'
                      }`}
                    >
                      {ctx.label}
                    </button>
                  ))}

                  <div className="flex items-center gap-2 bg-[#FAF5EA] px-4 py-1.5 rounded-full border border-[#CBBFA6]">
                    <button
                      type="button"
                      onClick={() => setAct1Value((v) => Math.max(-20, v - 1))}
                      className="w-8 h-8 rounded-full bg-[#EFE8D8] font-black text-base cursor-pointer"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min={-20}
                      max={20}
                      value={act1Value}
                      onChange={(e) => setAct1Value(normalizeInteger(Number(e.target.value)))}
                      aria-label="Điều chỉnh giá trị số nguyên trong thực tiễn"
                      className="w-32 sm:w-44 accent-[#136F50]"
                    />
                    <button
                      type="button"
                      onClick={() => setAct1Value((v) => Math.min(20, v + 1))}
                      className="w-8 h-8 rounded-full bg-[#EFE8D8] font-black text-base cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Activity 2 Controls: Keyboard / Step Placement Controls */}
              {activeActivityId === 'PLACE_ON_LINE' && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm">
                  <span className="font-bold text-[#14332A]">
                    Thẻ đang chọn:{' '}
                    <strong className="text-[#D96B16]">{act2ActiveCard ?? 'Chưa chọn'}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (act2ActiveCard === null) return;
                      const cur = act2PlacedMap[act2ActiveCard] ?? 0;
                      const next = Math.max(nlViewport.min, cur - 1);
                      setAct2PlacedMap((prev) => ({ ...prev, [act2ActiveCard]: next }));
                    }}
                    className="min-h-[42px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBFA6] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Dịch trái 1 đơn vị</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (act2ActiveCard === null) return;
                      const cur = act2PlacedMap[act2ActiveCard] ?? 0;
                      const next = Math.min(nlViewport.max, cur + 1);
                      setAct2PlacedMap((prev) => ({ ...prev, [act2ActiveCard]: next }));
                    }}
                    className="min-h-[42px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBFA6] font-extrabold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Dịch phải 1 đơn vị</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3.5 py-1.5 rounded-full border border-[#CBBFA6] font-bold">
                    <span>Đặt tại tọa độ:</span>
                    <input
                      type="number"
                      min={nlViewport.min}
                      max={nlViewport.max}
                      value={act2ActiveCard !== null ? act2PlacedMap[act2ActiveCard] ?? 0 : 0}
                      onChange={(e) => {
                        if (act2ActiveCard === null) return;
                        const v = normalizeInteger(Number(e.target.value));
                        setAct2PlacedMap((prev) => ({ ...prev, [act2ActiveCard]: v }));
                      }}
                      className="w-16 px-2 py-0.5 rounded-lg bg-white border border-[#CBBFA6] text-center font-black tabular-nums"
                    />
                  </label>
                </div>
              )}

              {/* Activity 3 Controls: Compare A & B or Sort 3–5 Cards */}
              {activeActivityId === 'COMPARE_INTEGERS' && (
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAct3SubMode('PAIR')}
                      className={`min-h-[38px] px-3.5 py-1 rounded-full font-extrabold border cursor-pointer ${
                        act3SubMode === 'PAIR'
                          ? 'bg-[#136F50] text-white border-[#0D523A]'
                          : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6]'
                      }`}
                    >
                      So sánh 2 số (A và B)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAct3SubMode('SORT');
                        if (act3SortCards.length === 0) {
                          setAct3SortCards([-5, 2, -1, 0, -3]);
                        }
                      }}
                      className={`min-h-[38px] px-3.5 py-1 rounded-full font-extrabold border cursor-pointer ${
                        act3SubMode === 'SORT'
                          ? 'bg-[#136F50] text-white border-[#0D523A]'
                          : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6]'
                      }`}
                    >
                      Sắp xếp 3–5 thẻ số & Tìm Max/Min
                    </button>
                  </div>

                  {act3SubMode === 'PAIR' ? (
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3 py-1.5 rounded-full border border-[#CBBFA6] font-bold">
                        <span className="text-[#2563EB]">Điểm A:</span>
                        <input
                          type="number"
                          min={-25}
                          max={25}
                          value={act3PointA}
                          onChange={(e) => setAct3PointA(normalizeInteger(Number(e.target.value)))}
                          className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#CBBFA6] text-center font-black"
                        />
                      </label>

                      <div className="inline-flex items-center gap-1.5">
                        {(['<', '=', '>'] as M07CompareOperator[]).map((op) => (
                          <button
                            key={op}
                            type="button"
                            onClick={() => {
                              setAct3ChosenOp(op);
                              setUserAnswerInput(op);
                            }}
                            className={`min-w-[44px] min-h-[44px] rounded-xl font-black text-lg border transition cursor-pointer ${
                              act3ChosenOp === op
                                ? 'bg-[#136F50] text-white border-[#0D523A] shadow-sm'
                                : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6] hover:bg-white'
                            }`}
                          >
                            {op}
                          </button>
                        ))}
                      </div>

                      <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3 py-1.5 rounded-full border border-[#CBBFA6] font-bold">
                        <span className="text-[#16A34A]">Điểm B:</span>
                        <input
                          type="number"
                          min={-25}
                          max={25}
                          value={act3PointB}
                          onChange={(e) => setAct3PointB(normalizeInteger(Number(e.target.value)))}
                          className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#CBBFA6] text-center font-black"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {act3SortCards.map((val, idx) => (
                        <div
                          key={`${val}-${idx}`}
                          className="inline-flex items-center gap-1 bg-[#FAF5EA] px-2.5 py-1 rounded-xl border border-[#CBBFA6]"
                        >
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...act3SortCards];
                                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                setAct3SortCards(next);
                              }}
                              aria-label={`Đổi chỗ ${val} sang trái`}
                              className="w-6 h-6 rounded-md bg-[#EFE8D8] hover:bg-[#E2D8C1] font-black text-xs cursor-pointer"
                            >
                              ◀
                            </button>
                          )}
                          <span className="px-2 py-0.5 font-black text-sm text-[#12382B] tabular-nums">
                            {val}
                          </span>
                          {idx < act3SortCards.length - 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = [...act3SortCards];
                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                setAct3SortCards(next);
                              }}
                              aria-label={`Đổi chỗ ${val} sang phải`}
                              className="w-6 h-6 rounded-md bg-[#EFE8D8] hover:bg-[#E2D8C1] font-black text-xs cursor-pointer"
                            >
                              ▶
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => setAct3SortCards(sortIntegers(act3SortCards, 'ASC'))}
                        className="min-h-[36px] px-3 py-1 rounded-xl bg-white border border-[#CBBFA6] font-extrabold text-xs text-[#136F50] hover:bg-[#EFE8D8] cursor-pointer"
                      >
                        Xếp tăng dần
                      </button>
                      <button
                        type="button"
                        onClick={() => setAct3SortCards(sortIntegers(act3SortCards, 'DESC'))}
                        className="min-h-[36px] px-3 py-1 rounded-xl bg-white border border-[#CBBFA6] font-extrabold text-xs text-[#D96B16] hover:bg-[#EFE8D8] cursor-pointer"
                      >
                        Xếp giảm dần
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Activity 4 Controls: Toggle Submode |a| vs |a - b| */}
              {activeActivityId === 'OPPOSITE_DISTANCE' && (
                <div className="flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm">
                  <button
                    type="button"
                    onClick={() => setAct4SubMode('TO_ZERO')}
                    className={`min-h-[42px] px-4 py-1.5 rounded-full font-extrabold border cursor-pointer ${
                      act4SubMode === 'TO_ZERO'
                        ? 'bg-[#136F50] text-white border-[#0D523A]'
                        : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6]'
                    }`}
                  >
                    Số đối & Khoảng cách đến 0 (|a|)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAct4SubMode('BETWEEN_TWO')}
                    className={`min-h-[42px] px-4 py-1.5 rounded-full font-extrabold border cursor-pointer ${
                      act4SubMode === 'BETWEEN_TWO'
                        ? 'bg-[#136F50] text-white border-[#0D523A]'
                        : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6]'
                    }`}
                  >
                    Khoảng cách giữa hai điểm (|a − b|)
                  </button>

                  <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3 py-1.5 rounded-full border border-[#CBBFA6] font-bold">
                    <span>Điểm A:</span>
                    <input
                      type="number"
                      min={-20}
                      max={20}
                      value={act4PointA}
                      onChange={(e) => setAct4PointA(normalizeInteger(Number(e.target.value)))}
                      className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#CBBFA6] text-center font-black"
                    />
                  </label>

                  {act4SubMode === 'BETWEEN_TWO' && (
                    <label className="inline-flex items-center gap-1.5 bg-[#FAF5EA] px-3 py-1.5 rounded-full border border-[#CBBFA6] font-bold">
                      <span>Điểm B:</span>
                      <input
                        type="number"
                        min={-20}
                        max={20}
                        value={act4PointB}
                        onChange={(e) => setAct4PointB(normalizeInteger(Number(e.target.value)))}
                        className="w-14 px-1.5 py-0.5 rounded-lg bg-white border border-[#CBBFA6] text-center font-black"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Activity 6 Controls: Operation Cards & Run Rescue */}
              {activeActivityId === 'RESCUE_MISSION' && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {rescueAvailableCards.map((card) => {
                    const isPicked = rescueChosenCards.some((c) => c.id === card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          if (isPicked) {
                            setRescueChosenCards((prev) => prev.filter((c) => c.id !== card.id));
                          } else if (rescueChosenCards.length < rescueMaxMoves) {
                            setRescueChosenCards((prev) => [...prev, card]);
                          }
                        }}
                        className={`min-h-[42px] px-4 py-1.5 rounded-xl font-black text-sm tabular-nums border transition cursor-pointer ${
                          isPicked
                            ? 'bg-[#D96B16] text-white border-[#B45309] shadow-sm'
                            : 'bg-[#FAF5EA] text-[#14332A] border-[#CBBFA6] hover:bg-white'
                        }`}
                      >
                        Thẻ {card.label}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleRunRescueSequence}
                    disabled={rescueChosenCards.length === 0 || isRescueAnimating}
                    className="min-h-[42px] px-5 py-1.5 rounded-full bg-[#136F50] hover:bg-[#0E573E] disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>Chạy giải cứu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      cancelActiveAnimations();
                      setRescueChosenCards([]);
                      setRescueRobotPos(rescueStart);
                    }}
                    className="min-h-[42px] px-3.5 py-1.5 rounded-full bg-[#FAF5EA] border border-[#CBBFA6] text-xs font-bold cursor-pointer"
                  >
                    Xóa thẻ chọn
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            RIGHT COLUMN: MISSION, PREDICTION/INPUT, HINTS & RESULT CARD
            ------------------------------------------------------------------ */}
        <aside
          aria-label="Bảng nhiệm vụ, kiểm tra đáp án và phản hồi sư phạm"
          className={`${
            isPresentationActive ? 'lg:col-span-3' : 'lg:col-span-3 xl:col-span-3'
          } bg-[#F8F4EC] rounded-[22px] border border-[#DFD6C3] shadow-xs overflow-hidden flex flex-col justify-between`}
        >
          <div>
            {/* Deep Emerald Header matching reference image */}
            <div className="bg-[#136F50] text-white px-4 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>Nhiệm vụ</span>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/15 tabular-nums">
                Mẫu {selectedTaskIndex + 1}/{activityTasks.length}
              </span>
            </div>

            <div className="p-3.5 space-y-3">
              {/* Task Selector Strip (8 tasks per activity = 48 total tasks) */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1">
                  {activityTasks.map((t, idx) => {
                    const isSelected = idx === selectedTaskIndex;
                    const isDone = progress.completedTaskIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTaskIndex(idx)}
                        className={`min-w-[30px] min-h-[30px] px-2 rounded-lg text-xs font-black tabular-nums border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#136F50] text-white border-[#0D523A]'
                            : isDone
                            ? 'bg-emerald-100 text-[#15803D] border-emerald-300'
                            : 'bg-white text-[#2B473E] border-[#DFD6C3] hover:bg-[#EFE8D8]'
                        }`}
                        title={t.titleVi}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step / Context Cards matching the reference right panel */}
              {activeActivityId === 'JUMP_ADD_SUB' ? (
                <div className="space-y-2">
                  <div className="p-3 rounded-2xl bg-[#F2ECE0] border border-[#E2D9C5] flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#1B392F]">
                    <span className="w-6 h-6 rounded-full bg-[#136F50]/15 text-[#136F50] flex items-center justify-center font-black shrink-0">
                      1
                    </span>
                    <span>
                      Bắt đầu tại <strong className="font-black text-[#D96B16]">{jumpCalc.a}</strong>
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#F2ECE0] border border-[#E2D9C5] flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#1B392F]">
                    <ArrowRight className="w-4 h-4 text-[#136F50] shrink-0" />
                    <span>
                      {jumpCalc.direction === 'STAY'
                        ? 'Đứng yên (0 đơn vị)'
                        : `Di chuyển ${jumpCalc.distanceUnits} đơn vị sang ${
                            jumpCalc.direction === 'RIGHT' ? 'phải' : 'trái'
                          }`}
                    </span>
                  </div>

                  {/* Current Step Pedagogical Explanation */}
                  <div className="p-3 rounded-2xl bg-white/85 border border-[#E2D9C5] text-xs text-[#2B473E] leading-relaxed">
                    <div className="font-extrabold text-[#136F50] mb-0.5">
                      Bước {jumpStepIndex}/5:{' '}
                      {jumpCalc.pedagogicalSteps[jumpStepIndex - 1]?.title}
                    </div>
                    <p>{jumpCalc.pedagogicalSteps[jumpStepIndex - 1]?.detail}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-[#F2ECE0] border border-[#E2D9C5] space-y-1.5">
                  <div className="text-xs font-extrabold text-[#136F50]">
                    {currentTask.titleVi}
                  </div>
                  <p className="text-xs text-[#2B473E] leading-relaxed">
                    {currentTask.promptVi}
                  </p>
                  {activeActivityId === 'COMPARE_INTEGERS' && learningMode === 'EXPLORE' && (
                    <p className="text-[11px] font-semibold text-[#0F766E] pt-1 border-t border-[#E2D9C5]">
                      {explainIntegerComparison(act3PointA, act3PointB)}
                    </p>
                  )}
                </div>
              )}

              {/* Challenge Question & Answer Input / Prediction */}
              <div className="p-3 rounded-2xl bg-white border border-[#E2D9C5] space-y-2.5">
                <div className="text-xs font-extrabold text-[#14332A]">
                  {currentTask.questionVi}
                </div>

                {learningMode === 'CHALLENGE' && !hasPredicted && (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={predictionInput}
                      onChange={(e) => setPredictionInput(e.target.value)}
                      placeholder="Nhập dự đoán trước..."
                      className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#F8F4EC] border border-[#D5CBB6] text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (predictionInput.trim()) {
                          setHasPredicted(true);
                          setUserAnswerInput(predictionInput.trim());
                        }
                      }}
                      className="min-h-[38px] px-3 rounded-xl bg-[#0F766E] text-white text-xs font-bold cursor-pointer"
                    >
                      Dự đoán
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={userAnswerInput}
                    onChange={(e) => setUserAnswerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCheckAnswer();
                    }}
                    aria-label="Nhập đáp án của nhiệm vụ"
                    placeholder="Nhập đáp án (ví dụ: 2, -5, <)..."
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#F8F4EC] border border-[#CBBFA6] text-xs sm:text-sm font-extrabold text-[#14332A] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#136F50]"
                  />
                  <button
                    type="button"
                    onClick={handleCheckAnswer}
                    className="min-h-[42px] px-4 rounded-xl bg-[#136F50] hover:bg-[#0E573E] text-white text-xs sm:text-sm font-extrabold cursor-pointer shrink-0"
                  >
                    Kiểm tra
                  </button>
                </div>

                {/* Hint & Reveal Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playM07Tone('HINT', isMuted);
                      const nextLvl = Math.min(3, hintLevelShown + 1) as 1 | 2 | 3;
                      setHintLevelShown(nextLvl);
                      setFeedbackMessage(`Gợi ý ${nextLvl}/3: ${currentTask.hints[nextLvl - 1]}`);
                    }}
                    className="min-h-[36px] px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                    <span>Gợi ý ({hintLevelShown}/3)</span>
                  </button>

                  {learningMode === 'CHALLENGE' && submissionStatus !== 'CORRECT' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubmissionStatus('REVEALED');
                        setFeedbackMessage(
                          `Lời giải chuẩn: Đáp án là ${currentTask.expectedAnswer}. ${currentTask.explanationVi}`
                        );
                        if (activeActivityId === 'JUMP_ADD_SUB') {
                          setJumpStepIndex(5);
                          setJumpRobotPos(jumpCalc.result);
                        }
                      }}
                      className="min-h-[36px] px-3 py-1 rounded-xl bg-[#EFE8D8] hover:bg-[#E2D9C5] text-[#475B53] text-xs font-bold cursor-pointer"
                    >
                      Xem lời giải
                    </button>
                  )}
                </div>

                {feedbackMessage && (
                  <div
                    role="status"
                    className={`p-2.5 rounded-xl text-xs font-semibold leading-relaxed border ${
                      submissionStatus === 'CORRECT'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : submissionStatus === 'WRONG'
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-sky-50 border-sky-200 text-sky-950'
                    }`}
                  >
                    {feedbackMessage}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Prominent Emerald Result Card at Bottom of Right Column (Matching reference image) */}
          <div className="p-3.5 pt-0">
            <div className="rounded-2xl bg-gradient-to-b from-[#17825D] to-[#116547] text-white px-4 py-3.5 shadow-[0_8px_18px_rgba(17,101,71,0.28)] flex items-center justify-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
              <span className="text-lg sm:text-xl font-black tracking-tight tabular-nums">
                Kết quả:{' '}
                {activeActivityId === 'JUMP_ADD_SUB'
                  ? shouldHideJumpResultInChallenge
                    ? '?'
                    : jumpCalc.result
                  : learningMode === 'CHALLENGE' &&
                    submissionStatus !== 'CORRECT' &&
                    submissionStatus !== 'REVEALED'
                  ? '?'
                  : currentTask.expectedAnswer}
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* ====================================================================
          3. BOTTOM 6-CARD 3D ACTIVITY THUMBNAIL STRIP (MATCHING REFERENCE IMAGE)
          ==================================================================== */}
      {showThumbnailsStrip && !isPresentationActive && (
        <section
          aria-label="Thẻ hình ảnh 3D chọn nhanh 6 hoạt động"
          className="px-3.5 sm:px-4 pb-4 pt-1"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {M07_ACTIVITY_METADATA.map((act) => {
              const isSelected = act.id === activeActivityId;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => {
                    setActiveActivityId(act.id);
                    setSelectedTaskIndex(0);
                  }}
                  className={`group rounded-[20px] p-2 border text-center transition flex flex-col items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-2 border-[#136F50] shadow-[0_8px_20px_rgba(19,111,80,0.16)] -translate-y-0.5'
                      : 'bg-[#FAF6EE] hover:bg-white border-[#DFD5C2] shadow-2xs'
                  }`}
                >
                  <div className="w-full aspect-[11/5] rounded-xl overflow-hidden bg-[#EFECE6]">
                    <M07ActivityThumbnail3D activityId={act.id} />
                  </div>
                  <span
                    className={`text-xs sm:text-[13px] font-extrabold pb-1 ${
                      isSelected ? 'text-[#136F50]' : 'text-[#1A362D]'
                    }`}
                  >
                    {act.shortTitle}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ====================================================================
          4. CLASSROOM ORGANIZATION & MODULE PROGRESS MODAL (SECTION 5 & 7)
          ==================================================================== */}
      {showClassroomModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-xl w-full rounded-[24px] bg-[#FAF6EE] border border-[#D8CEB8] p-5 sm:p-6 shadow-2xl space-y-4 text-[#14332A]">
            <div className="flex items-center justify-between border-b border-[#E2D9C5] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#124E3B]">
                  Tổ chức lớp học & Tiến độ cục bộ (Phòng M07)
                </h3>
                <p className="text-xs text-[#5B6E65]">
                  Lưu cục bộ trên thiết bị này — không yêu cầu email hay đồng bộ nhiều máy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowClassroomModal(false)}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#EFE8D8] font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Mode selector: Individual / Group / Teacher-led */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'INDIVIDUAL', label: 'Cá nhân tự học' },
                { id: 'GROUP', label: 'Thi đấu theo nhóm' },
                { id: 'TEACHER_COMMON', label: 'GV điều khiển chung' },
              ] as const).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const next = { ...progress, classOrgMode: m.id };
                    setProgress(next);
                    saveM07Progress(next);
                  }}
                  className={`min-h-[42px] px-3 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    progress.classOrgMode === m.id
                      ? 'bg-[#136F50] text-white border-[#0D523A]'
                      : 'bg-white text-[#14332A] border-[#D8CEB8]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Student count 1-50 & optional roster */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="block space-y-1 font-bold">
                <span>Số lượng học sinh tham gia (1–50):</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={progress.studentCount || initialClassStudentCount || 35}
                  onChange={(e) => {
                    const count = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                    const next = { ...progress, studentCount: count };
                    setProgress(next);
                    saveM07Progress(next);
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#CBBFA6] font-black tabular-nums"
                />
              </label>

              <label className="block space-y-1 font-bold">
                <span>Danh sách tên tùy chọn (không cần email):</span>
                <input
                  type="text"
                  value={optionalRosterText}
                  onChange={(e) => setOptionalRosterText(e.target.value)}
                  placeholder="VD: An, Bình, Chi, Dũng..."
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white border border-[#CBBFA6]"
                />
              </label>
            </div>

            {/* Group Scoreboard when in Group Mode */}
            {progress.classOrgMode === 'GROUP' && (
              <div className="space-y-2">
                <div className="text-xs font-extrabold text-[#136F50]">
                  Bảng điểm các nhóm (Chọn nhóm đang trả lời để cộng +10 điểm):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {progress.groups.map((grp) => (
                    <div
                      key={grp.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        activeGroupId === grp.id
                          ? 'bg-emerald-50 border-[#136F50]'
                          : 'bg-white border-[#D8CEB8]'
                      }`}
                    >
                      <input
                        type="text"
                        value={grp.name}
                        onChange={(e) => {
                          const nextGroups = progress.groups.map((g) =>
                            g.id === grp.id ? { ...g, name: e.target.value } : g
                          );
                          const next = { ...progress, groups: nextGroups };
                          setProgress(next);
                          saveM07Progress(next);
                        }}
                        className="text-xs font-bold bg-transparent border-b border-transparent focus:border-[#136F50] outline-hidden min-w-0 flex-1"
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-sm text-[#15803D] tabular-nums">
                          {grp.score} đ
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveGroupId(grp.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                            activeGroupId === grp.id
                              ? 'bg-[#136F50] text-white'
                              : 'bg-[#EFE8D8] text-[#14332A]'
                          }`}
                        >
                          {activeGroupId === grp.id ? 'Đang chọn' : 'Chọn'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scoped Progress Summary & Clear Button */}
            <div className="pt-3 border-t border-[#E2D9C5] flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#475B53]">
                Đã hoàn thành: <strong>{progress.completedTaskIds.length}/48</strong> nhiệm vụ trong ngân hàng
              </span>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.localStorage.removeItem(M07_STORAGE_KEY);
                  } catch {
                    // Ignore
                  }
                  setProgress({
                    version: 1,
                    completedTaskIds: [],
                    attemptsByTask: {},
                    hintsUsedByTask: {},
                    classOrgMode: 'INDIVIDUAL',
                    studentCount: 35,
                    groups: DEFAULT_GROUPS,
                    updatedAt: new Date().toISOString(),
                  });
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa riêng tiến độ phòng M07</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default M07IntegerNumberLineTool;
