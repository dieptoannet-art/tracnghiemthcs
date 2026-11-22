/**
 * E01 — NHẢY THEO LỆNH 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * - Mode 1 ("Làm theo lệnh"): 2–3 min classroom warm-up (default 8 turns, 4-step cadence, zero speed/accuracy scoring)
 * - Mode 2 ("Giải Toán – Ra động tác"): Solo Practice, Whole Class (1–50 HS, non-scored), or 2–6 Teams (10 pts/correct, ties => Đồng hạng)
 * - Front-facing 3D school gym instructor + Standing ("Tại chỗ") / Seated ("Ngồi tại bàn") + 2D gesture card fallback
 * - Shared KaTeX MathView, strict anti-spoiler state machine, A01/A02 audio & strict vi-VN voice, demo-isolated persistence
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FastForward,
  HelpCircle,
  Layers,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import { VoiceManagerSnapshot } from '../../../utils/vietnameseVoiceManager';
import {
  E01_GESTURES,
  E01_POINTS_CORRECT,
  E01_SAMPLE_BADGE,
  E01_SAMPLE_PACK_TITLE,
  FollowTurnSubPhase,
  JUMP_TEAM_PALETTES,
  JumpCommandConfig,
  JumpCommandState,
  JumpGestureId,
  JumpOptionLetter,
  JumpQuestionItem,
  JumpTeamVerdict,
  MathTurnSubPhase,
  OPTION_TO_GESTURE_MAP,
  advanceJumpCommandTurn,
  buildE01QuestionPool,
  clearE01Session,
  commitMathGestureTurn,
  completeFollowCommandTurn,
  computeJumpStandings,
  createDefaultJumpCommandConfig,
  createInitialJumpCommandState,
  createJumpTeams,
  editLastMathGestureTurn,
  getAllowedGesturesForPosture,
  getCorrectGestureIdForQuestion,
  getCorrectOptionLabelForQuestion,
  getGestureSpec,
  loadE01Session,
  resolveInstructorGestureForPhase,
  sanitizeFollowGesturesForPosture,
  saveE01Session,
  validateJumpSetupConfig,
} from './jumpCommand3dEngine';
import { JumpCommand3DScene } from './JumpCommand3DScene';

export interface JumpCommand3DGameProps {
  bankQuestions: Question[];
  userRole?: UserRole;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary: () => void;
}

const OPTION_LETTERS: JumpOptionLetter[] = ['A', 'B', 'C', 'D'];

function getTeamPalette(index: number) {
  return JUMP_TEAM_PALETTES[index % JUMP_TEAM_PALETTES.length];
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, ' nhân ')
    .replace(/\\pm/g, ' cộng trừ ')
    .replace(/\\Rightarrow/g, ' suy ra ')
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$|\$/g, ' ')
    .replace(/\{,\}/g, ' phẩy ')
    .replace(/[{}^_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function subjectLabel(subject: string): string {
  switch (subject) {
    case 'math':
      return 'Toán học';
    case 'physics':
      return 'Vật lí';
    case 'chemistry':
      return 'Hóa học';
    case 'biology':
      return 'Sinh học';
    case 'literature':
      return 'Ngữ văn';
    case 'english':
      return 'Tiếng Anh';
    case 'history':
      return 'Lịch sử';
    case 'geography':
      return 'Địa lí';
    case 'informatics':
      return 'Tin học';
    case 'natural_science':
      return 'KHTN';
    default:
      return subject === 'all' ? 'Tất cả môn' : subject;
  }
}

function levelLabel(level: string): string {
  switch (level) {
    case 'know':
      return 'Nhận biết';
    case 'understand':
      return 'Thông hiểu';
    case 'apply':
      return 'Vận dụng';
    case 'apply_high':
      return 'Vận dụng cao';
    default:
      return level || 'Tổng hợp';
  }
}

export const JumpCommand3DGame: React.FC<JumpCommand3DGameProps> = ({
  bankQuestions,
  userRole,
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const isDemo = isKhktDemoRuntime();

  // ---- AUDIO & STRICT VIETNAMESE VOICE CONTROLLERS (A01/A02 Consistent) ----
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceManagerSnapshot>(() =>
    voiceRef.current!.getSnapshot()
  );
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // ---- 3D / 2D & MOTION CONTROLS ----
  const [use3D, setUse3D] = useState<boolean>(true);
  const [webglAutoFallback, setWebglAutoFallback] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [skipAnimationKey, setSkipAnimationKey] = useState<number>(0);

  // ---- SETUP & PREVIEW STATE ----
  const [config, setConfig] = useState<JumpCommandConfig>(() =>
    createDefaultJumpCommandConfig('follow_command')
  );
  const [previewGesture, setPreviewGesture] = useState<JumpGestureId>('raise_two_hands');
  const [savedSession, setSavedSession] = useState<JumpCommandState | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState<boolean>(false);

  // ---- ACTIVE SESSION STATE ----
  const [gameState, setGameState] = useState<JumpCommandState | null>(null);
  const [followSubPhase, setFollowSubPhase] = useState<FollowTurnSubPhase>('demo');
  const [mathSubPhase, setMathSubPhase] = useState<MathTurnSubPhase>('thinking');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [countdownStep, setCountdownStep] = useState<number | null>(null);
  const [thinkRemaining, setThinkRemaining] = useState<number>(20);
  const [questionDisplayReady, setQuestionDisplayReady] = useState<boolean>(false);

  // Grading drafts for Math-Gesture mode
  const [draftTeamChoices, setDraftTeamChoices] = useState<Record<string, JumpTeamVerdict>>({});
  const [soloPickedOptionId, setSoloPickedOptionId] = useState<string | null>(null);
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);

  // Modals
  const [showKnowledgeReview, setShowKnowledgeReview] = useState<boolean>(false);
  const [zoomQuestion, setZoomQuestion] = useState<JumpQuestionItem | null>(null);

  // Strict single-fire & anti-double-click guards
  const actionLockRef = useRef<boolean>(false);
  const executeSignalFiredKeysRef = useRef<Set<string>>(new Set());
  const countdownTimerRef = useRef<number | null>(null);
  const thinkAnchorMsRef = useRef<number>(0);
  const thinkRemainingAtAnchorRef = useRef<number>(0);
  const lastThinkBeepRef = useRef<number>(-1);

  const clearCountdownInterval = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const stopAllAudioAndPending = useCallback(() => {
    clearCountdownInterval();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, [clearCountdownInterval]);

  // Subscribe to Vietnamese voice manager & cleanup on unmount
  useEffect(() => {
    const voice = voiceRef.current!;
    const unsub = voice.subscribe((snap) => setVoiceSnapshot(snap));
    return () => {
      unsub();
      clearCountdownInterval();
      soundBankRef.current?.stopAll();
      voice.stop();
      stopAllGlobalEduSpeech();
    };
  }, [clearCountdownInterval]);

  // Load saved E01 session on mount
  useEffect(() => {
    const loaded = loadE01Session();
    if (loaded.recoveredFromCorruption) {
      setRecoveredNotice(true);
    }
    if (loaded.state) {
      setSavedSession(loaded.state);
    }
  }, []);

  // Persist active session automatically
  useEffect(() => {
    if (gameState) {
      saveE01Session(gameState);
    }
  }, [gameState]);

  useEffect(() => {
    if (!noticeBanner) return;
    const id = window.setTimeout(() => setNoticeBanner(null), 3800);
    return () => window.clearTimeout(id);
  }, [noticeBanner]);

  // ---- AUDIO & VOICE TOGGLES ----
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, []);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  const handleExitToLibrary = useCallback(() => {
    stopAllAudioAndPending();
    onBackToLibrary();
  }, [stopAllAudioAndPending, onBackToLibrary]);

  const speakVietnameseSafe = useCallback(
    async (text: string, silentIfUnavailable = false) => {
      if (isMuted || !voiceEnabled) {
        if (!silentIfUnavailable) {
          setNoticeBanner('Âm thanh hoặc giọng đọc tiếng Việt đang tắt — hiển thị đầy đủ bằng chữ và hình.');
        }
        return;
      }
      if (!voiceSnapshot.hasVietnameseVoice) {
        if (!silentIfUnavailable) {
          setNoticeBanner(
            'Thiết bị hiện chưa có giọng đọc tiếng Việt (vi-VN) — không đọc thay bằng tiếng Anh; lớp theo dõi bằng chữ và hình.'
          );
        }
        return;
      }
      await voiceRef.current?.replayText({
        text,
        isMuted,
        voiceEnabled,
        onBeforeSpeak: () => soundBankRef.current?.stopLoops(),
      });
    },
    [isMuted, voiceEnabled, voiceSnapshot.hasVietnameseVoice]
  );

  // ---- QUESTION POOL & VALIDATION (SETUP) ----
  const bankFacets = useMemo(() => {
    const allowed = buildE01QuestionPool({
      sourceKind: 'bank',
      bankQuestions,
      userRole,
    });
    const subjects = Array.from(new Set(allowed.map((q) => q.subject))).sort();
    const grades = Array.from(new Set(allowed.map((q) => q.grade))).sort(
      (a, b) => Number(a) - Number(b)
    );
    const levels = Array.from(new Set(allowed.map((q) => q.level)));
    return { totalBankCount: allowed.length, subjects, grades, levels };
  }, [bankQuestions, userRole]);

  const availablePool = useMemo(() => {
    return buildE01QuestionPool({
      sourceKind: config.sourceKind,
      bankQuestions,
      userRole,
      subjectFilter: config.subjectFilter,
      gradeFilter: config.gradeFilter,
      levelFilter: config.levelFilter,
    });
  }, [
    config.sourceKind,
    config.subjectFilter,
    config.gradeFilter,
    config.levelFilter,
    bankQuestions,
    userRole,
  ]);

  const setupValidation = useMemo(
    () => validateJumpSetupConfig(config, availablePool.length),
    [config, availablePool.length]
  );

  const allowedSetupGestures = useMemo(
    () => getAllowedGesturesForPosture(config.posture),
    [config.posture]
  );

  // Keep previewGesture valid if teacher switches to seated mode while previewing step_in_place
  useEffect(() => {
    if (config.posture === 'seated' && previewGesture === 'step_in_place') {
      setPreviewGesture('raise_two_hands');
    }
  }, [config.posture, previewGesture]);

  // ---- DERIVED ACTIVE DATA ----
  const currentFollowGesture = useMemo(() => {
    if (!gameState || gameState.config.mode !== 'follow_command') return null;
    return gameState.followSequence[gameState.currentTurnIndex] || null;
  }, [gameState]);

  const currentQuestion: JumpQuestionItem | null = useMemo(() => {
    if (!gameState || gameState.config.mode !== 'math_gesture') return null;
    return gameState.questionOrder[gameState.currentTurnIndex] || null;
  }, [gameState]);

  const standings = useMemo(() => {
    if (!gameState) return [];
    return computeJumpStandings(gameState);
  }, [gameState]);

  const resetMathDrafts = useCallback((state: JumpCommandState) => {
    const fresh: Record<string, JumpTeamVerdict> = {};
    state.config.teams.forEach((t) => {
      fresh[t.id] = 'ungraded';
    });
    setDraftTeamChoices(fresh);
    setSoloPickedOptionId(null);
    setIsEditingLastTurn(false);
    actionLockRef.current = false;
  }, []);

  // ---- GUARANTEE THINK TIMER STARTS ONLY AFTER QUESTION & KATEX ARE RENDERED ----
  useEffect(() => {
    if (!gameState || gameState.config.mode !== 'math_gesture' || gameState.status !== 'playing') {
      setQuestionDisplayReady(false);
      return;
    }
    if (mathSubPhase !== 'thinking' || !currentQuestion) {
      setQuestionDisplayReady(false);
      return;
    }

    setQuestionDisplayReady(false);
    const rafId = window.requestAnimationFrame(() => {
      setQuestionDisplayReady(true);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [gameState, mathSubPhase, currentQuestion?.id]);

  // ---- SINGLE-FIRE EXECUTE SIGNAL HELPER ----
  const fireExecuteSignalOnce = useCallback(
    (signalKey: string, spokenPhrase?: string) => {
      if (executeSignalFiredKeysRef.current.has(signalKey)) return;
      executeSignalFiredKeysRef.current.add(signalKey);
      soundBankRef.current?.playJumpExecuteSignal(isMuted);
      if (spokenPhrase) {
        void speakVietnameseSafe(spokenPhrase, true);
      }
    },
    [isMuted, speakVietnameseSafe]
  );

  // ---- FOLLOW-COMMAND 3-2-1 COUNTDOWN EFFECT ----
  useEffect(() => {
    if (
      !gameState ||
      gameState.config.mode !== 'follow_command' ||
      gameState.status !== 'playing' ||
      followSubPhase !== 'prepare' ||
      countdownStep === null ||
      isPaused
    ) {
      clearCountdownInterval();
      return;
    }

    clearCountdownInterval();
    countdownTimerRef.current = window.setInterval(() => {
      setCountdownStep((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearCountdownInterval();
          setFollowSubPhase('execute');
          const gSpec = currentFollowGesture ? getGestureSpec(currentFollowGesture) : null;
          fireExecuteSignalOnce(
            `follow_exec_${gameState.currentTurnIndex}`,
            gSpec ? `Thực hiện! ${gSpec.name}` : 'Thực hiện!'
          );
          return null;
        }
        const nextVal = prev - 1;
        soundBankRef.current?.playCountdownBeep(nextVal as 1 | 2 | 3, isMuted);
        return nextVal;
      });
    }, 900);

    return () => clearCountdownInterval();
  }, [
    gameState,
    followSubPhase,
    countdownStep,
    isPaused,
    currentFollowGesture,
    isMuted,
    clearCountdownInterval,
    fireExecuteSignalOnce,
  ]);

  // ---- MATH-GESTURE MONOTONIC THINK TIMER ----
  useEffect(() => {
    if (
      !gameState ||
      gameState.config.mode !== 'math_gesture' ||
      gameState.status !== 'playing' ||
      mathSubPhase !== 'thinking' ||
      !questionDisplayReady ||
      isPaused
    ) {
      return;
    }
    if (gameState.config.thinkTimerSeconds <= 0) return;

    thinkAnchorMsRef.current = performance.now();
    thinkRemainingAtAnchorRef.current = thinkRemaining;

    const intervalId = window.setInterval(() => {
      const elapsedSec = (performance.now() - thinkAnchorMsRef.current) / 1000;
      const nextRemaining = Math.max(0, Math.ceil(thinkRemainingAtAnchorRef.current - elapsedSec));
      setThinkRemaining(nextRemaining);

      if (nextRemaining <= 3 && nextRemaining >= 1 && lastThinkBeepRef.current !== nextRemaining) {
        lastThinkBeepRef.current = nextRemaining;
        soundBankRef.current?.playCountdownBeep(nextRemaining as 1 | 2 | 3, isMuted);
      }

      if (nextRemaining <= 0) {
        window.clearInterval(intervalId);
        if (gameState.config.participantMode !== 'solo_practice') {
          setMathSubPhase('execute_collect');
          fireExecuteSignalOnce(
            `math_exec_${gameState.currentTurnIndex}`,
            'Thực hiện! Mời cả lớp ra động tác hoặc giơ thẻ đáp án!'
          );
        } else {
          soundBankRef.current?.playTimerBell(isMuted);
        }
      }
    }, 150);

    return () => window.clearInterval(intervalId);
  }, [
    gameState,
    mathSubPhase,
    questionDisplayReady,
    isPaused,
    isMuted,
    fireExecuteSignalOnce,
  ]);

  // ---- START NEW SESSION ----
  const handleStartSession = useCallback(() => {
    if (!setupValidation.valid) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();
    executeSignalFiredKeysRef.current.clear();

    const initial = createInitialJumpCommandState({
      config,
      questionPool: availablePool,
    });

    clearE01Session();
    setSavedSession(null);
    setGameState(initial);
    setIsPaused(false);
    setCountdownStep(null);
    setShowKnowledgeReview(false);
    setZoomQuestion(null);
    actionLockRef.current = false;

    if (initial.config.mode === 'follow_command') {
      setFollowSubPhase('demo');
      soundBankRef.current?.playJumpPrepareCue(isMuted);
      const firstG = initial.followSequence[0];
      if (firstG) {
        void speakVietnameseSafe(`Lượt 1. ${getGestureSpec(firstG).name}`, true);
      }
    } else {
      resetMathDrafts(initial);
      setMathSubPhase('thinking');
      lastThinkBeepRef.current = -1;
      setThinkRemaining(initial.config.thinkTimerSeconds);
      soundBankRef.current?.playJumpPrepareCue(isMuted);
    }
  }, [
    setupValidation.valid,
    config,
    availablePool,
    isMuted,
    stopAllAudioAndPending,
    speakVietnameseSafe,
    resetMathDrafts,
  ]);

  // ---- RESUME SAVED SESSION ----
  const handleResumeSavedSession = useCallback(() => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();
    executeSignalFiredKeysRef.current.clear();
    setGameState(savedSession);
    setIsPaused(false);
    setCountdownStep(null);

    if (savedSession.config.mode === 'follow_command') {
      const doneHere = savedSession.followHistory.some(
        (h) => h.turnIndex === savedSession.currentTurnIndex
      );
      setFollowSubPhase(doneHere ? 'rest' : 'demo');
    } else {
      resetMathDrafts(savedSession);
      const currentQ = savedSession.questionOrder[savedSession.currentTurnIndex];
      const doneHere = Boolean(
        currentQ && savedSession.mathHistory.some((h) => h.questionId === currentQ.id)
      );
      setMathSubPhase(doneHere ? 'revealed' : 'thinking');
      lastThinkBeepRef.current = -1;
      setThinkRemaining(savedSession.config.thinkTimerSeconds);
    }
  }, [savedSession, stopAllAudioAndPending, resetMathDrafts]);

  // ---- FOLLOW-COMMAND CONTROLS ----
  const handleFollowGoPrepare = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();
    setFollowSubPhase('prepare');
    if (gameState.config.followUseCountdown) {
      setCountdownStep(3);
      soundBankRef.current?.playCountdownBeep(3, isMuted);
    } else {
      setCountdownStep(null);
      soundBankRef.current?.playJumpPrepareCue(isMuted);
    }
  }, [gameState, isPaused, isMuted, stopAllAudioAndPending]);

  const handleFollowTriggerExecute = useCallback(() => {
    if (!gameState || isPaused) return;
    clearCountdownInterval();
    setCountdownStep(null);
    setFollowSubPhase('execute');
    const gSpec = currentFollowGesture ? getGestureSpec(currentFollowGesture) : null;
    fireExecuteSignalOnce(
      `follow_exec_${gameState.currentTurnIndex}`,
      gSpec ? `Thực hiện! ${gSpec.name}` : 'Thực hiện!'
    );
  }, [gameState, isPaused, currentFollowGesture, clearCountdownInterval, fireExecuteSignalOnce]);

  const handleFollowFinishTurnToRest = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    actionLockRef.current = true;
    stopAllAudioAndPending();

    const completed = completeFollowCommandTurn(gameState);
    setGameState(completed.state);
    setFollowSubPhase('rest');
    if (completed.state.status === 'finished') {
      soundBankRef.current?.playJumpSessionSummary(isMuted);
    }
    window.setTimeout(() => {
      actionLockRef.current = false;
    }, 180);
  }, [gameState, isPaused, isMuted, stopAllAudioAndPending]);

  const handleFollowNextTurn = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    actionLockRef.current = true;
    stopAllAudioAndPending();

    const nextState = advanceJumpCommandTurn(gameState);
    setGameState(nextState);
    setFollowSubPhase('demo');
    setCountdownStep(null);
    soundBankRef.current?.playJumpPrepareCue(isMuted);

    const nextG = nextState.followSequence[nextState.currentTurnIndex];
    if (nextG) {
      void speakVietnameseSafe(
        `Lượt ${nextState.currentTurnIndex + 1}. ${getGestureSpec(nextG).name}`,
        true
      );
    }
    window.setTimeout(() => {
      actionLockRef.current = false;
    }, 180);
  }, [gameState, isPaused, isMuted, stopAllAudioAndPending, speakVietnameseSafe]);

  // 1-student Follow-Command simplified step ("Tiếp theo")
  const handleFollowSoloStep = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    actionLockRef.current = true;
    stopAllAudioAndPending();

    const completed = completeFollowCommandTurn(gameState);
    if (completed.state.status === 'finished') {
      setGameState(completed.state);
      soundBankRef.current?.playJumpSessionSummary(isMuted);
    } else {
      const nextState = advanceJumpCommandTurn(completed.state);
      setGameState(nextState);
      setFollowSubPhase('demo');
      soundBankRef.current?.playJumpPrepareCue(isMuted);
    }
    window.setTimeout(() => {
      actionLockRef.current = false;
    }, 180);
  }, [gameState, isPaused, isMuted, stopAllAudioAndPending]);

  // ---- MATH-GESTURE CONTROLS ----
  const handleMathTriggerExecute = useCallback(() => {
    if (!gameState || isPaused) return;
    setMathSubPhase('execute_collect');
    fireExecuteSignalOnce(
      `math_exec_${gameState.currentTurnIndex}`,
      'Thực hiện! Mời cả lớp biểu thị đáp án bằng động tác hoặc giơ thẻ!'
    );
  }, [gameState, isPaused, fireExecuteSignalOnce]);

  const allTeamsGraded = useMemo(() => {
    if (!gameState || gameState.config.participantMode !== 'teams') return true;
    return gameState.config.teams.every((t) => {
      const v = draftTeamChoices[t.id];
      return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'no_answer';
    });
  }, [gameState, draftTeamChoices]);

  const handleConfirmMathTurnAndReveal = useCallback(() => {
    if (!gameState || !currentQuestion || isPaused || actionLockRef.current) return;
    if (gameState.config.participantMode === 'teams' && !allTeamsGraded) return;
    actionLockRef.current = true;

    if (isEditingLastTurn) {
      const edited = editLastMathGestureTurn(gameState, draftTeamChoices);
      window.setTimeout(() => {
        actionLockRef.current = false;
      }, 180);
      if (!edited.edited) return;
      setGameState(edited.state);
      setIsEditingLastTurn(false);
      setMathSubPhase('revealed');
      setNoticeBanner('Đã cập nhật lựa chọn và tính lại điểm chính xác.');
      return;
    }

    const res = commitMathGestureTurn(gameState, {
      question: currentQuestion,
      verdictsByParticipant:
        gameState.config.participantMode === 'teams' ? draftTeamChoices : undefined,
      soloSelectedOptionId:
        gameState.config.participantMode === 'solo_practice' ? soloPickedOptionId : undefined,
    });

    window.setTimeout(() => {
      actionLockRef.current = false;
    }, 180);
    if (!res.committed) return;

    setGameState(res.state);
    setMathSubPhase('revealed');

    const correctLabel = getCorrectOptionLabelForQuestion(currentQuestion);
    const correctGesture = getGestureSpec(getCorrectGestureIdForQuestion(currentQuestion));
    if (res.state.status === 'finished') {
      soundBankRef.current?.playJumpSessionSummary(isMuted);
    } else {
      soundBankRef.current?.playRevealChime(isMuted);
    }
    void speakVietnameseSafe(
      `Đáp án đúng là ${correctLabel}: ${correctGesture.name}`,
      true
    );
  }, [
    gameState,
    currentQuestion,
    isPaused,
    allTeamsGraded,
    isEditingLastTurn,
    draftTeamChoices,
    soloPickedOptionId,
    isMuted,
    speakVietnameseSafe,
  ]);

  const handleStartEditLastMathTurn = useCallback(() => {
    if (!gameState || gameState.mathHistory.length === 0) return;
    const last = gameState.mathHistory[gameState.mathHistory.length - 1];
    const prefill: Record<string, JumpTeamVerdict> = {};
    gameState.config.teams.forEach((t) => {
      prefill[t.id] = last.choiceByParticipant[t.id] || 'no_answer';
    });
    setDraftTeamChoices(prefill);
    setIsEditingLastTurn(true);
    setMathSubPhase('execute_collect');
  }, [gameState]);

  const handleMathNextTurn = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    actionLockRef.current = true;
    stopAllAudioAndPending();

    const nextState = advanceJumpCommandTurn(gameState);
    setGameState(nextState);
    resetMathDrafts(nextState);
    setMathSubPhase('thinking');
    lastThinkBeepRef.current = -1;
    setThinkRemaining(nextState.config.thinkTimerSeconds);
    soundBankRef.current?.playJumpPrepareCue(isMuted);

    window.setTimeout(() => {
      actionLockRef.current = false;
    }, 180);
  }, [gameState, isPaused, isMuted, stopAllAudioAndPending, resetMathDrafts]);

  // ---- PAUSE / SKIP ANIMATION / REPLAY ----
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopAllAudioAndPending();
      } else {
        thinkAnchorMsRef.current = performance.now();
        thinkRemainingAtAnchorRef.current = thinkRemaining;
      }
      return next;
    });
  }, [stopAllAudioAndPending, thinkRemaining]);

  const handleSkipAnimation = useCallback(() => {
    stopAllAudioAndPending();
    setSkipAnimationKey((k) => k + 1);
    if (
      gameState?.config.mode === 'follow_command' &&
      followSubPhase === 'prepare' &&
      countdownStep !== null
    ) {
      setCountdownStep(null);
      setFollowSubPhase('execute');
      fireExecuteSignalOnce(`follow_exec_${gameState.currentTurnIndex}`);
    }
  }, [stopAllAudioAndPending, gameState, followSubPhase, countdownStep, fireExecuteSignalOnce]);

  const handleReplay = useCallback(() => {
    stopAllAudioAndPending();
    executeSignalFiredKeysRef.current.clear();
    clearE01Session();
    setSavedSession(null);
    if (gameState) {
      setConfig(gameState.config);
    }
    setGameState(null);
    setIsPaused(false);
    setCountdownStep(null);
    setShowKnowledgeReview(false);
    setZoomQuestion(null);
  }, [gameState, stopAllAudioAndPending]);

  // Escape closes modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomQuestion(null);
        setShowKnowledgeReview(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ============================================================================
  // SHARED TOP BAR (A01/A02 Consistent)
  // ============================================================================

  const renderTopBar = () => (
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#071226] border-b border-teal-500/25 text-white">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleExitToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-100 whitespace-nowrap shrink-0 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về thư viện</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-black text-teal-300 whitespace-nowrap shrink-0">E01</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
            Nhảy theo lệnh 3D
          </h1>
          {isDemo && (
            <span className="hidden sm:inline text-xs font-bold text-amber-300 whitespace-nowrap shrink-0">
              · Bản demo KHKT
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setUse3D((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${
            use3D && !webglAutoFallback
              ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
              : 'bg-slate-800 border-slate-600 text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{use3D && !webglAutoFallback ? '3D' : '2D minh họa'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReducedMotion((v) => !v)}
          className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${
            reducedMotion
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{reducedMotion ? 'Giảm chuyển động' : 'Hoạt ảnh'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleVoice}
          title={
            voiceSnapshot.hasVietnameseVoice
              ? 'Bật/tắt giọng đọc tiếng Việt (vi-VN)'
              : 'Thiết bị chưa có giọng tiếng Việt (chỉ dùng chữ và hình)'
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${
            voiceEnabled && voiceSnapshot.hasVietnameseVoice && !isMuted
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              : 'bg-slate-800 border-slate-600 text-slate-400'
          }`}
        >
          {voiceEnabled && voiceSnapshot.hasVietnameseVoice && !isMuted ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Giọng VI</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap transition-colors ${
            isMuted
              ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
              : 'bg-yellow-400/20 border-yellow-400/60 text-yellow-200'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 whitespace-nowrap transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        )}
      </div>
    </header>
  );

  // Persistent A-D <-> Gesture Conversion Table (Visible throughout Math-Gesture session)
  const renderConversionLegend = (highlightLetter?: JumpOptionLetter | null) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {OPTION_LETTERS.map((letter) => {
        const spec = getGestureSpec(OPTION_TO_GESTURE_MAP[letter]);
        const isHighlighted = highlightLetter === letter;
        return (
          <div
            key={letter}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${
              isHighlighted
                ? 'bg-emerald-500/25 border-emerald-400 text-white'
                : 'bg-[#0B1B34] border-slate-700/80 text-slate-100'
            }`}
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                isHighlighted ? 'bg-emerald-400 text-[#071226]' : 'bg-yellow-400 text-[#071226]'
              }`}
            >
              {letter}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-extrabold leading-tight truncate">{spec.name}</div>
              <div className="text-[11px] text-slate-300 truncate">Hoặc giơ thẻ {letter}</div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ============================================================================
  // VIEW 1: SETUP SCREEN (WITH LIVE 3D GESTURE PREVIEW)
  // ============================================================================

  if (!gameState) {
    return (
      <div className="flex flex-col h-full min-h-[660px] bg-[#061021] text-slate-100 rounded-2xl overflow-hidden border border-teal-500/25 shadow-2xl">
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="max-w-6xl mx-auto space-y-5">
            {recoveredNotice && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-100 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Dữ liệu phiên E01 bị lỗi định dạng đã được tự động dọn sạch an toàn.</span>
                </div>
                <button type="button" onClick={() => setRecoveredNotice(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {savedSession && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-teal-500/15 border border-teal-400/45">
                <div>
                  <div className="text-sm font-extrabold text-teal-200">
                    Có phiên E01 đang lưu (
                    {savedSession.config.mode === 'follow_command'
                      ? `Làm theo lệnh · ${savedSession.followHistory.length}/${savedSession.followSequence.length} lượt`
                      : `Giải Toán – Ra động tác · ${savedSession.mathHistory.length}/${savedSession.questionOrder.length} câu`}
                    )
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Tư thế: {savedSession.config.posture === 'seated' ? 'Ngồi tại bàn' : 'Đứng tại chỗ'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSavedSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#071226] text-xs font-extrabold"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Tiếp tục phiên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearE01Session();
                      setSavedSession(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
                  >
                    Xóa phiên cũ
                  </button>
                </div>
              </div>
            )}

            {/* Mode & Posture Top Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#0B1D3A] border border-teal-500/35">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Thiết lập Nhảy theo lệnh 3D
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Nhân vật hướng dẫn 3D chính diện, an toàn tại chỗ hoặc ngồi tại bàn. Bắt đầu ngay
                  với bộ lệnh/câu hỏi mẫu, không yêu cầu email hay danh sách lớp.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex rounded-xl bg-[#071226] p-1 border border-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        mode: 'follow_command',
                      }))
                    }
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${
                      config.mode === 'follow_command'
                        ? 'bg-teal-500 text-[#071226]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Activity className="w-4 h-4" />
                    <span>Làm theo lệnh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        mode: 'math_gesture',
                      }))
                    }
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold whitespace-nowrap transition-colors ${
                      config.mode === 'math_gesture'
                        ? 'bg-yellow-400 text-[#071226]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Giải Toán – Ra động tác</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT: LIVE 3D GESTURE PREVIEW + POSTURE SELECTOR */}
              <div className="lg:col-span-5 space-y-3">
                <div className="h-[310px] sm:h-[340px]">
                  <JumpCommand3DScene
                    gesture={previewGesture}
                    posture={config.posture}
                    signalBannerText="Xem thử động tác"
                    signalTone="neutral"
                    use3D={use3D && !webglAutoFallback}
                    reducedMotion={reducedMotion}
                    skipAnimationKey={skipAnimationKey}
                    onWebGLUnavailable={() => setWebglAutoFallback(true)}
                  />
                </div>

                {/* Posture Selector ("Tại chỗ" vs "Ngồi tại bàn") */}
                <div className="p-4 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-teal-200">
                      Tư thế thực hiện của lớp
                    </span>
                    <span className="text-[11px] text-slate-400">Không yêu cầu nhảy rời vị trí</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          posture: 'standing',
                        }))
                      }
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-colors ${
                        config.posture === 'standing'
                          ? 'bg-teal-500/20 border-teal-400 text-white'
                          : 'bg-[#071226] border-slate-700 text-slate-300'
                      }`}
                    >
                      Tại chỗ (Đứng)
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          posture: 'seated',
                          selectedFollowGestureIds: sanitizeFollowGesturesForPosture(
                            prev.selectedFollowGestureIds,
                            'seated'
                          ),
                        }))
                      }
                      className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-colors ${
                        config.posture === 'seated'
                          ? 'bg-teal-500/20 border-teal-400 text-white'
                          : 'bg-[#071226] border-slate-700 text-slate-300'
                      }`}
                    >
                      Ngồi tại bàn
                    </button>
                  </div>

                  {/* Interactive Gesture Preview Buttons */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 mb-1.5">
                      Bấm để nhân vật làm mẫu trước khi bắt đầu:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreviewGesture('ready_wait')}
                        className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                          previewGesture === 'ready_wait'
                            ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                            : 'bg-[#071226] text-slate-200 border-slate-700 hover:border-slate-500'
                        }`}
                      >
                        Tư thế chờ
                      </button>
                      {allowedSetupGestures.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setPreviewGesture(g.id)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                            previewGesture === g.id
                              ? 'bg-teal-400 text-[#071226] border-teal-300'
                              : 'bg-[#071226] text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {g.optionLetter ? `${g.optionLetter}: ` : ''}
                          {g.shortLabel}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: MODE CONFIGURATION */}
              <div className="lg:col-span-7 space-y-4">
                {config.mode === 'follow_command' ? (
                  <section className="p-5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-4">
                    <div>
                      <h3 className="text-base font-black text-white">
                        Chế độ “Làm theo lệnh” (Khởi động 2–3 phút)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Mỗi lượt gồm 4 nhịp rõ ràng: Làm mẫu → Chuẩn bị (3–2–1) → Thực hiện → Nghỉ.
                        Không chấm tốc độ hay độ chính xác động tác.
                      </p>
                    </div>

                    {/* Control Style */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Hình thức điều khiển
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({ ...prev, followControlStyle: 'teacher_class' }))
                          }
                          className={`p-3 rounded-xl border text-left ${
                            config.followControlStyle === 'teacher_class'
                              ? 'bg-teal-500/20 border-teal-400 text-white'
                              : 'bg-[#071226] border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-black">Giáo viên điều khiển (Mặc định)</div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            Chiếu cho lớp 1–50 học sinh, chủ động mở từng nhịp và chuyển lượt.
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({ ...prev, followControlStyle: 'solo_screen' }))
                          }
                          className={`p-3 rounded-xl border text-left ${
                            config.followControlStyle === 'solo_screen'
                              ? 'bg-teal-500/20 border-teal-400 text-white'
                              : 'bg-[#071226] border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="text-xs font-black">1 học sinh tự tập trên màn hình</div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            Xem nhân vật hướng dẫn, làm theo rồi bấm “Tiếp theo” khi sẵn sàng.
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Turn Count */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Số lượt vận động (mặc định 8 lượt)
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[4, 6, 8, 10, 12].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setConfig((prev) => ({ ...prev, followTurnCount: cnt }))}
                            className={`py-2 rounded-lg border text-xs font-extrabold tabular-nums ${
                              config.followTurnCount === cnt
                                ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                : 'bg-[#071226] text-slate-200 border-slate-700'
                            }`}
                          >
                            {cnt} lượt
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Selectable Gestures */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Bộ động tác sử dụng ({config.posture === 'seated' ? 'Ngồi tại bàn' : 'Tại chỗ'})
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {allowedSetupGestures.map((g) => {
                          const checked = config.selectedFollowGestureIds.includes(g.id);
                          return (
                            <label
                              key={g.id}
                              className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors ${
                                checked
                                  ? 'bg-teal-500/15 border-teal-400/70'
                                  : 'bg-[#071226] border-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setConfig((prev) => {
                                    const next = on
                                      ? Array.from(new Set([...prev.selectedFollowGestureIds, g.id]))
                                      : prev.selectedFollowGestureIds.filter((id) => id !== g.id);
                                    return {
                                      ...prev,
                                      selectedFollowGestureIds: next.length > 0 ? next : [g.id],
                                    };
                                  });
                                  setPreviewGesture(g.id);
                                }}
                                className="accent-teal-400 mt-0.5 w-4 h-4 shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-extrabold text-white">{g.name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {config.posture === 'seated' ? g.seatedGuide : g.standingGuide}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {config.followControlStyle === 'teacher_class' && (
                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#071226] border border-slate-700 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={config.followUseCountdown}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              followUseCountdown: e.target.checked,
                            }))
                          }
                          className="accent-yellow-400 w-4 h-4"
                        />
                        <span>
                          Hiện đếm ngược 3–2–1 ở bước Chuẩn bị (có thể bấm “Bắt đầu” ngay bất cứ lúc nào)
                        </span>
                      </label>
                    )}
                  </section>
                ) : (
                  <section className="p-5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-4">
                    <div>
                      <h3 className="text-base font-black text-white">
                        Chế độ “Giải Toán – Ra động tác”
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Học sinh suy nghĩ chọn A–D rồi biểu thị bằng động tác hoặc giơ thẻ sau tín
                        hiệu “Thực hiện”. Điểm chỉ tính theo đáp án đã chọn (+10 đúng, 0 sai/không TL).
                      </p>
                    </div>

                    {/* Conversion Preview */}
                    {renderConversionLegend()}

                    {/* Participant Mode */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Đối tượng tham gia (không bật camera hay chấm tư thế)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          {
                            id: 'whole_class' as const,
                            label: 'Cả lớp (1–50 HS)',
                            desc: 'Vận động trả lời chung, không chấm điểm',
                            icon: Users,
                          },
                          {
                            id: 'teams' as const,
                            label: '2–6 đội tính điểm',
                            desc: 'GV ghi A/B/C/D cho từng đội (+10đ)',
                            icon: Trophy,
                          },
                          {
                            id: 'solo_practice' as const,
                            label: 'Tự luyện 1 HS',
                            desc: 'Chọn A/B/C/D trực tiếp và chốt đáp án',
                            icon: User,
                          },
                        ].map((item) => {
                          const Icon = item.icon;
                          const active = config.participantMode === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() =>
                                setConfig((prev) => ({ ...prev, participantMode: item.id }))
                              }
                              className={`p-3 rounded-xl border text-left transition-colors ${
                                active
                                  ? 'bg-teal-500/20 border-teal-400 text-white'
                                  : 'bg-[#071226] border-slate-700 text-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs font-black">
                                <Icon className="w-3.5 h-3.5 text-yellow-400" />
                                <span>{item.label}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">{item.desc}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Team Names when participantMode === 'teams' */}
                    {config.participantMode === 'teams' && (
                      <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-teal-200">
                            Số đội &amp; tên đội (chỉ cần tên hoặc nhãn tạm)
                          </span>
                          <div className="flex items-center gap-1">
                            {[2, 3, 4, 5, 6].map((cnt) => (
                              <button
                                key={cnt}
                                type="button"
                                onClick={() =>
                                  setConfig((prev) => ({
                                    ...prev,
                                    teams: createJumpTeams(
                                      cnt,
                                      prev.teams.map((t) => t.name)
                                    ),
                                  }))
                                }
                                className={`px-2.5 py-1 rounded-md text-xs font-black border ${
                                  config.teams.length === cnt
                                    ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                    : 'bg-slate-800 text-slate-300 border-slate-600'
                                }`}
                              >
                                {cnt} đội
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {config.teams.map((team, idx) => {
                            const pal = getTeamPalette(team.paletteIndex);
                            return (
                              <div
                                key={team.id}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0B1B34] border border-slate-700"
                              >
                                <span
                                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-black shrink-0"
                                  style={{ backgroundColor: pal.hex, color: pal.textOnSolid }}
                                >
                                  {team.teamNumber}
                                </span>
                                <input
                                  type="text"
                                  value={team.name}
                                  maxLength={32}
                                  placeholder={`Đội ${idx + 1}`}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setConfig((prev) => ({
                                      ...prev,
                                      teams: prev.teams.map((t) =>
                                        t.id === team.id ? { ...t, name: val } : t
                                      ),
                                    }));
                                  }}
                                  className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Question Source */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                        className={`p-3 rounded-xl border text-left ${
                          config.sourceKind === 'sample'
                            ? 'bg-teal-500/20 border-teal-400'
                            : 'bg-[#071226] border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black text-white">
                          {E01_SAMPLE_PACK_TITLE}
                        </div>
                        <div className="text-[11px] text-amber-300 font-semibold mt-0.5">
                          {E01_SAMPLE_BADGE} · 8 câu Toán THCS chuẩn KaTeX
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'bank' }))}
                        className={`p-3 rounded-xl border text-left ${
                          config.sourceKind === 'bank'
                            ? 'bg-teal-500/20 border-teal-400'
                            : 'bg-[#071226] border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-black text-white">Ngân hàng câu hỏi</div>
                        <div className="text-[11px] text-teal-300 font-semibold mt-0.5">
                          {bankFacets.totalBankCount} câu trắc nghiệm 4 phương án A–D
                        </div>
                      </button>
                    </div>

                    {config.sourceKind === 'bank' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                          value={config.subjectFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                          }
                          className="px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả môn</option>
                          {bankFacets.subjects.map((s) => (
                            <option key={s} value={s}>
                              {subjectLabel(s)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={config.gradeFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                          }
                          className="px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả lớp</option>
                          {bankFacets.grades.map((g) => (
                            <option key={g} value={g}>
                              Lớp {g}
                            </option>
                          ))}
                        </select>
                        <select
                          value={config.levelFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, levelFilter: e.target.value }))
                          }
                          className="px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả mức độ</option>
                          {bankFacets.levels.map((lv) => (
                            <option key={lv} value={lv}>
                              {levelLabel(lv)}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Question Count & Think Timer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Số câu hỏi (mặc định 8 câu)
                        </label>
                        <div className="grid grid-cols-5 gap-1.5">
                          {[4, 6, 8, 10, 12].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() =>
                                setConfig((prev) => ({ ...prev, mathQuestionCount: cnt }))
                              }
                              className={`py-2 rounded-lg border text-xs font-extrabold tabular-nums ${
                                config.mathQuestionCount === cnt
                                  ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                  : 'bg-[#071226] text-slate-200 border-slate-700'
                              }`}
                            >
                              {cnt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Thời gian suy nghĩ (mặc định 20 giây)
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
                          {[0, 10, 15, 20, 30, 45].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() =>
                                setConfig((prev) => ({ ...prev, thinkTimerSeconds: sec }))
                              }
                              className={`py-2 rounded-lg border text-xs font-extrabold tabular-nums ${
                                config.thinkTimerSeconds === sec
                                  ? 'bg-teal-500 text-[#071226] border-teal-300'
                                  : 'bg-[#071226] text-slate-200 border-slate-700'
                              }`}
                            >
                              {sec === 0 ? 'KGH' : `${sec}s`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#071226] border border-slate-700 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={config.shuffleQuestions}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                          }
                          className="accent-teal-400 w-4 h-4"
                        />
                        <span>Xáo trộn thứ tự câu hỏi</span>
                      </label>
                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#071226] border border-slate-700 cursor-pointer text-xs font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={config.shuffleOptions}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                          }
                          className="accent-teal-400 w-4 h-4"
                        />
                        <span>Xáo trộn phương án A–D</span>
                      </label>
                    </div>
                  </section>
                )}

                {/* Validation & Start CTA */}
                <div className="p-4 rounded-2xl bg-[#0E2444] border border-teal-400/40 space-y-3">
                  {setupValidation.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/50 space-y-2">
                      {setupValidation.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                      {config.sourceKind === 'bank' && (
                        <button
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                          className="px-3 py-1.5 rounded-lg bg-teal-500 text-[#071226] text-xs font-extrabold"
                        >
                          Dùng bộ mẫu 8 câu ngay
                        </button>
                      )}
                    </div>
                  )}

                  {setupValidation.warnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100">
                      {setupValidation.warnings.join(' ')}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!setupValidation.valid}
                    onClick={handleStartSession}
                    className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all ${
                      setupValidation.valid
                        ? 'bg-gradient-to-r from-teal-400 via-emerald-400 to-yellow-400 hover:brightness-105 text-[#071226] shadow-lg'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {config.mode === 'follow_command'
                        ? `Bắt đầu Làm theo lệnh (${setupValidation.effectiveTurnCount} lượt)`
                        : `Bắt đầu Giải Toán – Ra động tác (${setupValidation.effectiveTurnCount} câu)`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: ACTIVE SESSION & SUMMARY
  // ============================================================================

  const isFinished = gameState.status === 'finished';
  const instructorGesture = isFinished
    ? 'raise_two_hands'
    : resolveInstructorGestureForPhase({
        mode: gameState.config.mode,
        followSubPhase,
        activeFollowGesture: currentFollowGesture || undefined,
        mathSubPhase,
        currentQuestion,
      });

  const sceneSignalBanner = isFinished
    ? 'Hoàn thành phiên!'
    : gameState.config.mode === 'follow_command'
    ? followSubPhase === 'demo'
      ? 'Bước 1 · Làm mẫu động tác'
      : followSubPhase === 'prepare'
      ? 'Bước 2 · Tư thế chuẩn bị'
      : followSubPhase === 'execute'
      ? 'THỰC HIỆN!'
      : 'Nghỉ · Sẵn sàng lượt tiếp'
    : mathSubPhase === 'thinking'
    ? 'Đang suy nghĩ · Giữ tư thế chờ'
    : mathSubPhase === 'execute_collect'
    ? 'THỰC HIỆN! Giơ động tác / thẻ'
    : currentQuestion
    ? `Đáp án ${getCorrectOptionLabelForQuestion(currentQuestion)} · Minh họa động tác`
    : null;

  const sceneSignalTone: 'neutral' | 'prepare' | 'execute' | 'reveal' = isFinished
    ? 'reveal'
    : (gameState.config.mode === 'follow_command' && followSubPhase === 'execute') ||
      (gameState.config.mode === 'math_gesture' && mathSubPhase === 'execute_collect')
    ? 'execute'
    : gameState.config.mode === 'math_gesture' && mathSubPhase === 'revealed'
    ? 'reveal'
    : gameState.config.mode === 'follow_command' && followSubPhase === 'prepare'
    ? 'prepare'
    : 'neutral';

  return (
    <div className="relative flex flex-col h-full min-h-[660px] bg-[#061021] text-slate-100 rounded-2xl overflow-hidden border border-teal-500/25 shadow-2xl">
      {renderTopBar()}

      {noticeBanner && (
        <div className="px-4 py-2 bg-[#0D2140] border-b border-teal-400/35 flex items-center justify-between gap-2 text-xs font-bold text-teal-100">
          <span>{noticeBanner}</span>
          <button type="button" onClick={() => setNoticeBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-6xl mx-auto space-y-3.5">
          {/* Control & Progress Strip */}
          {!isFinished && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#0B1B34] border border-slate-700/80">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200 tabular-nums">
                <span className="text-teal-300 font-black">
                  {gameState.config.mode === 'follow_command'
                    ? `Làm theo lệnh · Lượt ${gameState.currentTurnIndex + 1}/${gameState.followSequence.length}`
                    : `Giải Toán – Ra động tác · Câu ${gameState.currentTurnIndex + 1}/${gameState.questionOrder.length}`}
                </span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span>
                  {gameState.config.posture === 'seated' ? 'Ngồi tại bàn' : 'Đứng tại chỗ'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap ${
                    isPaused
                      ? 'bg-amber-400 text-[#071226] border-amber-300'
                      : 'bg-slate-800 text-slate-100 border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipAnimation}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 whitespace-nowrap"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Bỏ qua hoạt ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={handleReplay}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Thiết lập lại</span>
                </button>
              </div>
            </div>
          )}

          {/* Pause Banner */}
          {isPaused && !isFinished && (
            <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-400/55 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-amber-100">
              <span>
                Đang tạm dừng — thời gian còn lại được giữ nguyên và các thao tác chốt đang tạm khóa.
              </span>
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-3 py-1 rounded-lg bg-amber-400 text-[#071226] font-black"
              >
                Tiếp tục ngay
              </button>
            </div>
          )}

          {/* Persistent Conversion Legend in Math-Gesture Mode */}
          {gameState.config.mode === 'math_gesture' && !isFinished && (
            renderConversionLegend(
              mathSubPhase === 'revealed' && currentQuestion
                ? getCorrectOptionLabelForQuestion(currentQuestion)
                : null
            )
          )}

          {/* ================================================================ */}
          {/* ACTIVE VIEW: FOLLOW-COMMAND MODE                                 */}
          {/* ================================================================ */}
          {!isFinished && gameState.config.mode === 'follow_command' && currentFollowGesture && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-7 h-[340px] sm:h-[420px]">
                <JumpCommand3DScene
                  gesture={instructorGesture}
                  posture={gameState.config.posture}
                  signalBannerText={sceneSignalBanner}
                  signalTone={sceneSignalTone}
                  countdownNumber={followSubPhase === 'prepare' ? countdownStep : null}
                  use3D={use3D && !webglAutoFallback}
                  reducedMotion={reducedMotion}
                  skipAnimationKey={skipAnimationKey}
                  onWebGLUnavailable={() => setWebglAutoFallback(true)}
                />
              </div>

              <div className="lg:col-span-5 p-5 rounded-2xl bg-[#0B1B34] border border-teal-500/35 flex flex-col justify-between gap-4">
                {(() => {
                  const spec = getGestureSpec(currentFollowGesture);
                  return (
                    <>
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-teal-300">
                          Lượt {gameState.currentTurnIndex + 1} / {gameState.followSequence.length}
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                          {spec.name}
                        </h2>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          {gameState.config.posture === 'seated'
                            ? spec.seatedGuide
                            : spec.standingGuide}
                        </p>
                        <p className="text-xs text-teal-300 font-semibold">
                          Lựa chọn thay thế: {spec.cardFallbackText}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            void speakVietnameseSafe(
                              `${spec.name}. ${
                                gameState.config.posture === 'seated'
                                  ? spec.seatedGuide
                                  : spec.standingGuide
                              }`
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100"
                        >
                          <Volume2 className="w-3.5 h-3.5 text-yellow-400" />
                          <span>Đọc lệnh tiếng Việt</span>
                        </button>

                        {/* 4-Step Cadence Indicator (Teacher Class Mode) */}
                        {gameState.config.followControlStyle === 'teacher_class' && (
                          <div className="grid grid-cols-4 gap-1.5 pt-2">
                            {(
                              [
                                ['demo', '1. Mẫu'],
                                ['prepare', '2. Chuẩn bị'],
                                ['execute', '3. Thực hiện'],
                                ['rest', '4. Nghỉ'],
                              ] as Array<[FollowTurnSubPhase, string]>
                            ).map(([phaseId, label]) => (
                              <div
                                key={phaseId}
                                className={`py-2 px-1.5 rounded-lg text-center text-[11px] font-extrabold border ${
                                  followSubPhase === phaseId
                                    ? phaseId === 'execute'
                                      ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                      : 'bg-teal-500 text-[#071226] border-teal-300'
                                    : 'bg-[#071226] text-slate-400 border-slate-700'
                                }`}
                              >
                                {label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Primary Action Button */}
                      <div className="space-y-2 pt-2 border-t border-slate-700">
                        {gameState.config.followControlStyle === 'solo_screen' ? (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleFollowSoloStep}
                            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 ${
                              isPaused
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-400 to-yellow-400 text-[#071226]'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {gameState.currentTurnIndex + 1 >= gameState.followSequence.length
                                ? 'Hoàn thành phiên khởi động'
                                : 'Tiếp theo'}
                            </span>
                          </button>
                        ) : followSubPhase === 'demo' ? (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleFollowGoPrepare}
                            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 ${
                              isPaused
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-teal-500 hover:bg-teal-400 text-[#071226]'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>
                              {gameState.config.followUseCountdown
                                ? 'Chuẩn bị & Đếm ngược 3–2–1'
                                : 'Về tư thế chuẩn bị'}
                            </span>
                          </button>
                        ) : followSubPhase === 'prepare' ? (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleFollowTriggerExecute}
                            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 ${
                              isPaused
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-yellow-400 hover:bg-yellow-300 text-[#071226]'
                            }`}
                          >
                            <Activity className="w-4 h-4" />
                            <span>Bắt đầu — THỰC HIỆN!</span>
                          </button>
                        ) : followSubPhase === 'execute' ? (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleFollowFinishTurnToRest}
                            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 ${
                              isPaused
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-emerald-400 hover:bg-emerald-300 text-[#071226]'
                            }`}
                          >
                            <Check className="w-4 h-4" />
                            <span>Nghỉ · Xong lượt này</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleFollowNextTurn}
                            className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 ${
                              isPaused
                                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-teal-400 to-yellow-400 text-[#071226]'
                            }`}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>Mở lượt tiếp theo</span>
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* ACTIVE VIEW: MATH-GESTURE MODE                                   */}
          {/* ================================================================ */}
          {!isFinished && gameState.config.mode === 'math_gesture' && currentQuestion && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* LEFT: 3D INSTRUCTOR (Holds 'ready_wait' until revealed!) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="h-[300px] sm:h-[360px]">
                  <JumpCommand3DScene
                    gesture={instructorGesture}
                    posture={gameState.config.posture}
                    signalBannerText={sceneSignalBanner}
                    signalTone={sceneSignalTone}
                    use3D={use3D && !webglAutoFallback}
                    reducedMotion={reducedMotion}
                    skipAnimationKey={skipAnimationKey}
                    onWebGLUnavailable={() => setWebglAutoFallback(true)}
                  />
                </div>

                {/* Live Mini Scoreboard for Teams Mode */}
                {gameState.config.participantMode === 'teams' && (
                  <div className="p-3.5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-2">
                    <div className="text-xs font-extrabold text-yellow-300">
                      Bảng điểm các đội (+{E01_POINTS_CORRECT}đ mỗi câu đúng)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {standings.map((row) => {
                        const pal = getTeamPalette(row.paletteIndex);
                        return (
                          <div
                            key={row.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-[#071226] border border-slate-700 text-xs"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: pal.hex }}
                              />
                              <span className="font-bold text-white truncate">{row.name}</span>
                            </div>
                            <span className="font-black text-teal-300 tabular-nums shrink-0">
                              {row.points}đ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* RIGHT: QUESTION CARD (MathView) + COLLECT/GRADING + REVEAL */}
              <div className="lg:col-span-7 space-y-3.5">
                <section className="p-5 rounded-2xl bg-white text-slate-900 border-2 border-teal-500/60 shadow-xl space-y-4">
                  {/* Question Metadata & Timer Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                      <span className="text-[#071226] font-black">
                        Câu {gameState.currentTurnIndex + 1}/{gameState.questionOrder.length}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {currentQuestion.topic || subjectLabel(currentQuestion.subject)} (Lớp{' '}
                        {currentQuestion.grade})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-700">{currentQuestion.sourceBadge}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {mathSubPhase === 'thinking' && (
                        <div
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black tabular-nums border ${
                            gameState.config.thinkTimerSeconds <= 0
                              ? 'bg-slate-100 border-slate-300 text-slate-700'
                              : thinkRemaining <= 5
                              ? 'bg-rose-100 border-rose-400 text-rose-700'
                              : 'bg-[#071226] border-teal-500 text-teal-300'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {gameState.config.thinkTimerSeconds <= 0
                              ? 'Không giới hạn'
                              : `${thinkRemaining}s`}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setZoomQuestion(currentQuestion)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Phóng to</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void speakVietnameseSafe(stripLatexForSpeech(currentQuestion.stem))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-300 text-xs font-bold text-teal-900"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Đọc đề</span>
                      </button>
                    </div>
                  </div>

                  {/* Question Stem (Scrollable on Mobile for Long Formulas) */}
                  <div className="text-xl sm:text-2xl font-bold leading-relaxed text-slate-900 max-w-full overflow-x-auto">
                    <MathView content={currentQuestion.stem} />
                  </div>

                  {currentQuestion.image && (
                    <div className="flex justify-center">
                      <img
                        src={currentQuestion.image}
                        alt="Hình minh họa câu hỏi"
                        className="max-h-48 rounded-xl border border-slate-200 object-contain"
                      />
                    </div>
                  )}

                  {/* Four Options A-D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQuestion.options.map((opt) => {
                      const isCorrectOpt = opt.id === currentQuestion.correctOptionId;
                      const isSoloPicked =
                        gameState.config.participantMode === 'solo_practice' &&
                        soloPickedOptionId === opt.id;
                      const showRevealStyle = mathSubPhase === 'revealed';
                      const gSpec = getGestureSpec(OPTION_TO_GESTURE_MAP[opt.label]);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={
                            gameState.config.participantMode !== 'solo_practice' ||
                            mathSubPhase !== 'thinking' ||
                            isPaused
                          }
                          onClick={() => setSoloPickedOptionId(opt.id)}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                            showRevealStyle && isCorrectOpt
                              ? 'bg-emerald-50 border-emerald-600'
                              : isSoloPicked
                              ? 'bg-teal-50 border-teal-600'
                              : 'bg-slate-50 border-slate-200'
                          } ${
                            gameState.config.participantMode !== 'solo_practice' ||
                            mathSubPhase !== 'thinking'
                              ? 'cursor-default'
                              : 'hover:border-teal-400'
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                              showRevealStyle && isCorrectOpt
                                ? 'bg-emerald-600 text-white'
                                : isSoloPicked
                                ? 'bg-teal-600 text-white'
                                : 'bg-[#071226] text-yellow-300'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-base sm:text-lg font-bold text-slate-900 overflow-x-auto">
                              <MathView content={opt.text} />
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              {gSpec.shortLabel}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Official Answer & Explanation (STRICTLY shown ONLY in 'revealed'!) */}
                  {mathSubPhase === 'revealed' && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-400 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-black text-emerald-950">
                          Đáp án đúng: {getCorrectOptionLabelForQuestion(currentQuestion)} —{' '}
                          <MathView content={currentQuestion.officialAnswerText} />
                        </div>
                        <span className="text-xs font-extrabold text-emerald-800">
                          Động tác: {getGestureSpec(getCorrectGestureIdForQuestion(currentQuestion)).name}
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-emerald-900 overflow-x-auto">
                        <MathView content={currentQuestion.explanation} />
                      </div>
                    </div>
                  )}

                  {/* Footer Controls for Thinking / Solo / Whole-Class / Revealed */}
                  {mathSubPhase === 'thinking' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <span className="text-xs font-semibold text-slate-500">
                        {gameState.config.participantMode === 'solo_practice'
                          ? soloPickedOptionId
                            ? 'Đã chọn đáp án — bấm “Chốt đáp án” để kiểm tra.'
                            : 'Chọn A, B, C hoặc D rồi bấm “Chốt đáp án”.'
                          : gameState.config.participantMode === 'teams'
                          ? 'Nhân vật đang giữ tư thế chờ. Các đội có thể ghi lựa chọn lên bảng con trước khi ra hiệu.'
                          : 'Nhân vật đang giữ tư thế chờ. Khi lớp suy nghĩ xong, bấm phát hiệu lệnh.'}
                      </span>

                      {gameState.config.participantMode === 'solo_practice' ? (
                        <button
                          type="button"
                          disabled={
                            isPaused ||
                            (!soloPickedOptionId &&
                              !(gameState.config.thinkTimerSeconds > 0 && thinkRemaining === 0))
                          }
                          onClick={handleConfirmMathTurnAndReveal}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                            isPaused ||
                            (!soloPickedOptionId &&
                              !(gameState.config.thinkTimerSeconds > 0 && thinkRemaining === 0))
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-teal-600 hover:bg-teal-500 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {!soloPickedOptionId &&
                            gameState.config.thinkTimerSeconds > 0 &&
                            thinkRemaining === 0
                              ? 'Chốt (Không trả lời)'
                              : 'Chốt đáp án'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleMathTriggerExecute}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                            isPaused
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-[#071226] hover:bg-[#0D2140] text-yellow-300 shadow-md'
                          }`}
                        >
                          <Activity className="w-4 h-4" />
                          <span>Hiệu lệnh: THỰC HIỆN!</span>
                        </button>
                      )}
                    </div>
                  )}

                  {mathSubPhase === 'execute_collect' &&
                    gameState.config.participantMode === 'whole_class' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                        <span className="text-xs font-bold text-amber-800">
                          Cả lớp biểu thị bằng động tác hoặc giơ thẻ A/B/C/D. Sau đó công bố đáp án.
                        </span>
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleConfirmMathTurnAndReveal}
                          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                            isPaused
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Công bố đáp án &amp; Minh họa động tác</span>
                        </button>
                      </div>
                    )}

                  {mathSubPhase === 'revealed' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <div>
                        {gameState.config.participantMode === 'teams' && (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleStartEditLastMathTurn}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold ${
                              isPaused
                                ? 'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900'
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa lựa chọn vừa chấm</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={handleMathNextTurn}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#071226] hover:bg-[#0D2140] text-yellow-300 text-sm font-black"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>
                          Câu tiếp theo ({gameState.currentTurnIndex + 2}/
                          {gameState.questionOrder.length})
                        </span>
                      </button>
                    </div>
                  )}
                </section>

                {/* TEAM GRADING PANEL (Shown strictly in 'execute_collect' when participantMode === 'teams') */}
                {mathSubPhase === 'execute_collect' &&
                  gameState.config.participantMode === 'teams' && (
                    <section className="p-4 rounded-2xl bg-[#0B1B34] border border-yellow-400/50 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-black text-yellow-300">
                          {isEditingLastTurn
                            ? 'Sửa lựa chọn A/B/C/D của các đội'
                            : 'Ghi nhận lựa chọn A/B/C/D của từng đội (sau tín hiệu Thực hiện)'}
                        </h3>
                        <span className="text-[11px] text-slate-300">
                          Phân biệt rõ “Chưa chấm” và “Không trả lời”
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {gameState.config.teams.map((team) => {
                          const pal = getTeamPalette(team.paletteIndex);
                          const val = draftTeamChoices[team.id] || 'ungraded';
                          return (
                            <div
                              key={team.id}
                              className={`p-3 rounded-xl border space-y-2 ${
                                val === 'ungraded'
                                  ? 'bg-[#071226] border-amber-400/50'
                                  : 'bg-slate-900/90 border-teal-500/45'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: pal.hex }}
                                  />
                                  <span className="text-xs font-extrabold text-white truncate">
                                    {team.name}
                                  </span>
                                </div>
                                <span
                                  className={`text-[11px] font-black ${
                                    val === 'ungraded'
                                      ? 'text-amber-300'
                                      : val === 'no_answer'
                                      ? 'text-slate-400'
                                      : 'text-teal-300'
                                  }`}
                                >
                                  {val === 'ungraded'
                                    ? 'Chưa chấm'
                                    : val === 'no_answer'
                                    ? 'Không trả lời'
                                    : `Chọn ${val}`}
                                </span>
                              </div>

                              <div className="grid grid-cols-5 gap-1">
                                {OPTION_LETTERS.map((letter) => (
                                  <button
                                    key={letter}
                                    type="button"
                                    disabled={isPaused}
                                    onClick={() =>
                                      setDraftTeamChoices((prev) => ({
                                        ...prev,
                                        [team.id]: letter,
                                      }))
                                    }
                                    className={`py-1.5 rounded-lg text-xs font-black border ${
                                      isPaused
                                        ? 'bg-slate-900 text-slate-500 border-slate-700 cursor-not-allowed'
                                        : val === letter
                                        ? 'bg-teal-400 text-[#071226] border-teal-300'
                                        : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                                    }`}
                                  >
                                    {letter}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  disabled={isPaused}
                                  onClick={() =>
                                    setDraftTeamChoices((prev) => ({
                                      ...prev,
                                      [team.id]: 'no_answer',
                                    }))
                                  }
                                  className={`py-1.5 rounded-lg text-[11px] font-extrabold border ${
                                    isPaused
                                      ? 'bg-slate-900 text-slate-500 border-slate-700 cursor-not-allowed'
                                      : val === 'no_answer'
                                      ? 'bg-slate-300 text-[#071226] border-white'
                                      : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                                  }`}
                                >
                                  Không TL
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-slate-300">
                          {allTeamsGraded
                            ? 'Đã ghi đủ tất cả các đội — sẵn sàng công bố đáp án & động tác đúng.'
                            : 'Hãy chọn A/B/C/D hoặc “Không TL” cho tất cả đội còn ở trạng thái “Chưa chấm”.'}
                        </span>
                        <div className="flex items-center gap-2">
                          {isEditingLastTurn && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsEditingLastTurn(false);
                                setMathSubPhase('revealed');
                              }}
                              className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-200"
                            >
                              Hủy sửa
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={!allTeamsGraded || isPaused}
                            onClick={handleConfirmMathTurnAndReveal}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                              allTeamsGraded && !isPaused
                                ? 'bg-gradient-to-r from-teal-400 to-yellow-400 text-[#071226] shadow-lg'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {isEditingLastTurn
                                ? 'Lưu chỉnh sửa'
                                : 'Chốt kết quả & Công bố đáp án'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </section>
                  )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* FINAL SUMMARY SCREEN                                             */}
          {/* ================================================================ */}
          {isFinished && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-5 h-[280px] sm:h-[340px]">
                <JumpCommand3DScene
                  gesture="raise_two_hands"
                  posture={gameState.config.posture}
                  signalBannerText="Hoàn thành xuất sắc!"
                  signalTone="reveal"
                  use3D={use3D && !webglAutoFallback}
                  reducedMotion={reducedMotion}
                  skipAnimationKey={skipAnimationKey}
                  onWebGLUnavailable={() => setWebglAutoFallback(true)}
                />
              </div>

              <section className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#0B1B34] border border-yellow-400/45 space-y-5">
                <div>
                  <div className="text-xs font-black text-teal-300">
                    {gameState.config.mode === 'follow_command'
                      ? 'Tổng kết phiên khởi động · Làm theo lệnh'
                      : 'Tổng kết Giải Toán – Ra động tác'}
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">
                    {gameState.config.mode === 'follow_command'
                      ? `Đã hoàn thành ${gameState.followHistory.length} lượt vận động!`
                      : gameState.config.participantMode === 'whole_class'
                      ? `Cả lớp đã hoàn thành ${gameState.mathHistory.length} câu hỏi!`
                      : gameState.config.participantMode === 'solo_practice'
                      ? `Đạt ${standings[0]?.points ?? 0} điểm (${standings[0]?.correctCount ?? 0}/${gameState.mathHistory.length} câu đúng)`
                      : standings[0]?.isTied
                      ? 'Kết quả Đồng hạng nhất — Chúc mừng các đội!'
                      : `Đội dẫn đầu: ${standings[0]?.name ?? ''}`}
                  </h2>
                </div>

                {/* Follow-Command Summary (Turns completed only, ZERO speed/accuracy score) */}
                {gameState.config.mode === 'follow_command' && (
                  <div className="space-y-3">
                    <p className="text-xs sm:text-sm text-slate-300">
                      Phiên khởi động giúp lớp thư giãn và tập trung ngay tại vị trí, không chấm
                      tốc độ hay độ chính xác của động tác.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {E01_GESTURES.filter((g) =>
                        gameState.followHistory.some((h) => h.gestureId === g.id)
                      ).map((g) => {
                        const cnt = gameState.followHistory.filter(
                          (h) => h.gestureId === g.id
                        ).length;
                        return (
                          <div
                            key={g.id}
                            className="p-3 rounded-xl bg-[#071226] border border-slate-700"
                          >
                            <div className="text-xs font-extrabold text-white">{g.name}</div>
                            <div className="text-lg font-black text-teal-300 tabular-nums mt-0.5">
                              {cnt} lượt
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Math-Gesture Whole-Class Summary (Non-scored) */}
                {gameState.config.mode === 'math_gesture' &&
                  gameState.config.participantMode === 'whole_class' && (
                    <div className="p-4 rounded-xl bg-[#071226] border border-teal-500/35 space-y-1">
                      <div className="text-sm font-extrabold text-teal-200">
                        Số lượt cả lớp đã hoàn thành: {gameState.mathHistory.length} /{' '}
                        {gameState.questionOrder.length} câu
                      </div>
                      <p className="text-xs text-slate-300">
                        Chế độ vận động chung cả lớp không chấm điểm cá nhân. Bấm “Xem lại kiến
                        thức” để ôn nhanh toàn bộ đáp án và lời giải.
                      </p>
                    </div>
                  )}

                {/* Math-Gesture Teams Standings */}
                {gameState.config.mode === 'math_gesture' &&
                  gameState.config.participantMode === 'teams' && (
                    <div className="space-y-2">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-700 text-xs text-slate-400">
                              <th className="py-2 pr-3">Thứ hạng</th>
                              <th className="py-2 pr-3">Đội</th>
                              <th className="py-2 px-3 text-center">Điểm</th>
                              <th className="py-2 pl-3 text-right">Câu đúng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standings.map((row) => {
                              const pal = getTeamPalette(row.paletteIndex);
                              return (
                                <tr key={row.id} className="border-b border-slate-800">
                                  <td className="py-2.5 pr-3 font-black text-yellow-300 whitespace-nowrap">
                                    {row.isTied ? `Đồng hạng #${row.rank}` : `Hạng #${row.rank}`}
                                  </td>
                                  <td className="py-2.5 pr-3 font-extrabold text-white">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="w-3 h-3 rounded-full shrink-0"
                                        style={{ backgroundColor: pal.hex }}
                                      />
                                      <span>{row.name}</span>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-black text-teal-300 tabular-nums">
                                    {row.points}
                                  </td>
                                  <td className="py-2.5 pl-3 text-right font-bold text-slate-200 tabular-nums">
                                    {row.correctCount}/{gameState.mathHistory.length}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Điểm phản ánh đáp án đã chọn (+{E01_POINTS_CORRECT} đúng, 0 sai/không trả
                        lời), không phụ thuộc vào cách biểu thị bằng động tác hay giơ thẻ.
                      </p>
                    </div>
                  )}

                {/* Math-Gesture Solo Practice Summary */}
                {gameState.config.mode === 'math_gesture' &&
                  gameState.config.participantMode === 'solo_practice' && (
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700 text-center">
                        <div className="text-[11px] font-bold text-slate-400">Tổng điểm</div>
                        <div className="text-2xl font-black text-yellow-300 tabular-nums mt-1">
                          {standings[0]?.points ?? 0}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700 text-center">
                        <div className="text-[11px] font-bold text-slate-400">Số câu đúng</div>
                        <div className="text-2xl font-black text-emerald-300 tabular-nums mt-1">
                          {standings[0]?.correctCount ?? 0}/{gameState.mathHistory.length}
                        </div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700 text-center">
                        <div className="text-[11px] font-bold text-slate-400">Tỉ lệ đúng</div>
                        <div className="text-2xl font-black text-teal-300 tabular-nums mt-1">
                          {gameState.mathHistory.length > 0
                            ? `${Math.round(
                                ((standings[0]?.correctCount ?? 0) / gameState.mathHistory.length) *
                                  100
                              )}%`
                            : '0%'}
                        </div>
                      </div>
                    </div>
                  )}

                {/* Summary Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-700">
                  {gameState.config.mode === 'math_gesture' && (
                    <button
                      type="button"
                      onClick={() => setShowKnowledgeReview(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/55 text-xs font-extrabold text-teal-100"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Xem lại kiến thức</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleReplay}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#071226] text-xs font-black"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExitToLibrary}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Về thư viện</span>
                  </button>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: FORMULA ZOOM MODAL (KaTeX MathView)                         */}
      {/* ==================================================================== */}
      {zoomQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-slate-900 border-2 border-teal-500 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-[#071226]">
                Phóng to câu hỏi &amp; công thức Toán
              </h3>
              <button
                type="button"
                onClick={() => setZoomQuestion(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-2xl sm:text-3xl font-bold leading-relaxed overflow-x-auto">
              <MathView content={zoomQuestion.stem} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {zoomQuestion.options.map((opt) => (
                <div
                  key={opt.id}
                  className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-300"
                >
                  <span className="w-9 h-9 rounded-lg bg-[#071226] text-yellow-300 flex items-center justify-center font-black shrink-0">
                    {opt.label}
                  </span>
                  <div className="text-xl font-bold overflow-x-auto flex-1">
                    <MathView content={opt.text} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: KNOWLEDGE REVIEW MODAL (MathView)                           */}
      {/* ==================================================================== */}
      {showKnowledgeReview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white text-slate-900 border-2 border-teal-500 p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#071226]">
                  Xem lại kiến thức ({gameState.mathHistory.length} câu đã hoàn thành)
                </h3>
                <p className="text-xs text-slate-500">
                  Hiển thị đầy đủ đề bài, đáp án chuẩn, động tác tương ứng và lời giải KaTeX.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKnowledgeReview(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {gameState.mathHistory.map((rec, idx) => (
                <div
                  key={rec.questionId}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600">
                    <span className="text-[#071226] font-black">
                      Câu {idx + 1} · {rec.questionCode}
                    </span>
                    <span className="text-teal-700">
                      Đáp án {rec.correctOptionLabel}: {getGestureSpec(rec.correctGestureId).name}
                    </span>
                  </div>
                  <div className="text-base font-bold text-slate-900 overflow-x-auto">
                    <MathView content={rec.questionStem} />
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm space-y-1">
                    <div className="font-black text-emerald-950">
                      Đáp án đúng: <MathView content={rec.officialAnswerText} />
                    </div>
                    <div className="text-emerald-900 overflow-x-auto">
                      <MathView content={rec.explanation} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JumpCommand3DGame;
