/**
 * E02 — BẮT BÓNG KIẾN THỨC 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * - Interactive 3D school sports hall + 4 balls A–D + catching hoop + lightweight 2D SVG fallback
 * - 3 participant modes: Solo Practice (1 HS), Whole Class (1–50 HS shared answer), Teams (2–6 teams)
 * - Strict anti-spoiler before reveal, +10 correct / 0 wrong or no_answer, ties => Đồng hạng
 * - Shared KaTeX MathView, 8-question sample pack "Bắt bóng kiến thức – Toán THCS", RBAC bank adapter
 * - A01/A02 unified audio + strict vi-VN voice, Pause/Skip/Edit-last-turn, keyboard shortcuts, /demo persistence
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FastForward,
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
  AlertTriangle,
  CircleDot,
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
  CATCH_OPTION_LETTERS,
  CATCH_TEAM_PALETTES,
  CatchBallConfig,
  CatchBallState,
  CatchOptionLetter,
  CatchQuestionItem,
  CatchTeamChoice,
  E02_BALL_SLOT_THEMES,
  E02_POINTS_CORRECT,
  E02_SAMPLE_BADGE,
  E02_SAMPLE_PACK_TITLE,
  advanceCatchBallTurn,
  buildE02QuestionPool,
  clearE02Session,
  commitCatchBallTurn,
  computeCatchStandings,
  createCatchTeams,
  createDefaultCatchBallConfig,
  createInitialCatchBallState,
  editLastCatchBallTurn,
  getCorrectOptionLabelForCatchQuestion,
  loadE02Session,
  saveE02Session,
  validateCatchSetupConfig,
} from './catchBall3dEngine';
import { CatchBall3DScene } from './CatchBall3DScene';

export interface CatchBall3DGameProps {
  bankQuestions: Question[];
  userRole?: UserRole;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary: () => void;
}

function getTeamPalette(index: number) {
  return CATCH_TEAM_PALETTES[index % CATCH_TEAM_PALETTES.length];
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\{,\}/g, ' phẩy ')
    .replace(/\\times/g, ' nhân ')
    .replace(/\\pm/g, ' cộng trừ ')
    .replace(/\\,|\\;|\\!/g, ' ')
    .replace(/\\[\(\)\[\]]/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const CatchBall3DGame: React.FC<CatchBall3DGameProps> = ({
  bankQuestions,
  userRole,
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const isDemo = isKhktDemoRuntime();

  // ---- Audio & Strict Vietnamese Voice (A01/A02 consistent) ----
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceCtrlRef = useRef<EduGameVoiceController | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled());
  const [voiceSnap, setVoiceSnap] = useState<VoiceManagerSnapshot | null>(null);

  // ---- Visual / Accessibility Preferences ----
  const [force2D, setForce2D] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [skipAnimationKey, setSkipAnimationKey] = useState<number>(0);

  // ---- Setup & Session State ----
  const [config, setConfig] = useState<CatchBallConfig>(() =>
    createDefaultCatchBallConfig('solo_practice')
  );
  const [gameState, setGameState] = useState<CatchBallState | null>(null);
  const [savedSession, setSavedSession] = useState<CatchBallState | null>(null);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);

  // ---- Turn Interactive State ----
  const [turnPhase, setTurnPhase] = useState<'selecting' | 'revealed'>('selecting');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [questionDisplayReady, setQuestionDisplayReady] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(20);
  const [timeExpired, setTimeExpired] = useState<boolean>(false);
  const [draftSingleChoice, setDraftSingleChoice] = useState<CatchOptionLetter | 'no_answer' | null>(
    null
  );
  const [draftTeamChoices, setDraftTeamChoices] = useState<Record<string, CatchTeamChoice>>({});
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);

  // ---- Modals ----
  const [zoomQuestion, setZoomQuestion] = useState<CatchQuestionItem | null>(null);
  const [showSolutionReview, setShowSolutionReview] = useState<boolean>(false);

  // ---- Refs for timers, pending audio timeouts & double-click locks ----
  const pendingTimeoutsRef = useRef<number[]>([]);
  const actionLockRef = useRef<boolean>(false);
  const timerAnchorMsRef = useRef<number>(0);
  const timerRemainingAtAnchorRef = useRef<number>(20);
  const lastCountdownBeepRef = useRef<number>(-1);
  const turnTokenRef = useRef<string>('init');

  const clearPendingTimeouts = useCallback(() => {
    pendingTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    pendingTimeoutsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimeoutsRef.current.push(id);
    return id;
  }, []);

  const stopAllAudioAndPending = useCallback(() => {
    clearPendingTimeouts();
    soundBankRef.current?.stopAll();
    voiceCtrlRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, [clearPendingTimeouts]);

  // Mount / Unmount audio + load saved session
  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController();
    soundBankRef.current = bank;
    voiceCtrlRef.current = voice;
    setVoiceSnap(voice.getSnapshot());
    const unsub = voice.subscribe((snap) => setVoiceSnap(snap));

    const loaded = loadE02Session();
    if (loaded.recoveredFromCorruption) {
      setNoticeBanner('Dữ liệu phiên lưu trước không hợp lệ và đã được đặt lại an toàn.');
    } else if (loaded.state) {
      setSavedSession(loaded.state);
    }

    return () => {
      unsub();
      clearPendingTimeouts();
      bank.stopAll();
      bank.dispose();
      voice.stop();
      voice.dispose();
      stopAllGlobalEduSpeech();
    };
  }, [clearPendingTimeouts]);

  // Persist active session automatically
  useEffect(() => {
    if (gameState) {
      saveE02Session(gameState);
    }
  }, [gameState]);

  // ---- Audio Toggle Handlers ----
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        stopAllAudioAndPending();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, [stopAllAudioAndPending]);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceCtrlRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  const speakVietnameseSafe = useCallback(
    async (text: string) => {
      if (isMuted || !voiceEnabled || !voiceCtrlRef.current) return;
      try {
        await voiceCtrlRef.current.replayText({
          text: stripLatexForSpeech(text),
          isMuted,
          voiceEnabled,
        });
      } catch {
        // Text & visual cues remain completely functional
      }
    },
    [isMuted, voiceEnabled]
  );

  // ---- Question Pool & Setup Validation ----
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    (bankQuestions || []).forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return Array.from(set);
  }, [bankQuestions]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    (bankQuestions || []).forEach((q) => {
      if (q.grade) set.add(String(q.grade));
    });
    return Array.from(set).sort();
  }, [bankQuestions]);

  const activePool = useMemo(
    () =>
      buildE02QuestionPool({
        sourceKind: config.sourceKind,
        bankQuestions,
        userRole,
        subjectFilter: config.subjectFilter,
        gradeFilter: config.gradeFilter,
        levelFilter: config.levelFilter,
      }),
    [config.sourceKind, bankQuestions, userRole, config.subjectFilter, config.gradeFilter, config.levelFilter]
  );

  const setupValidation = useMemo(
    () => validateCatchSetupConfig(config, activePool.length),
    [config, activePool.length]
  );

  // ---- Active Derived Values ----
  const currentQuestion: CatchQuestionItem | null = useMemo(() => {
    if (!gameState) return null;
    return gameState.questionOrder[gameState.currentTurnIndex] || null;
  }, [gameState]);

  const standings = useMemo(
    () => (gameState ? computeCatchStandings(gameState) : []),
    [gameState]
  );

  const currentTurnRecord = useMemo(() => {
    if (!gameState || !currentQuestion) return null;
    return gameState.history.find((h) => h.questionId === currentQuestion.id) || null;
  }, [gameState, currentQuestion]);

  const canEditLastTurn = useMemo(() => {
    if (!gameState || !currentQuestion || turnPhase !== 'revealed' || isEditingLastTurn) {
      return false;
    }
    const last = gameState.history[gameState.history.length - 1];
    return Boolean(last && last.questionId === currentQuestion.id);
  }, [gameState, currentQuestion, turnPhase, isEditingLastTurn]);

  const resetTurnDrafts = useCallback((st: CatchBallState) => {
    setDraftSingleChoice(null);
    const map: Record<string, CatchTeamChoice> = {};
    st.config.teams.forEach((t) => {
      map[t.id] = 'ungraded';
    });
    setDraftTeamChoices(map);
    setIsEditingLastTurn(false);
    setTimeExpired(false);
  }, []);

  // Ensure question + 4 options + KaTeX are fully painted before starting timer
  useEffect(() => {
    if (!gameState || gameState.status !== 'playing' || !currentQuestion) {
      setQuestionDisplayReady(false);
      return;
    }
    setQuestionDisplayReady(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setQuestionDisplayReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [gameState?.currentTurnIndex, currentQuestion?.id, gameState?.status]);

  // ---- Monotonic Question Timer ----
  useEffect(() => {
    if (
      !gameState ||
      gameState.status !== 'playing' ||
      turnPhase !== 'selecting' ||
      !questionDisplayReady ||
      isPaused ||
      isEditingLastTurn
    ) {
      return;
    }
    if (gameState.config.timerSeconds <= 0) return;

    timerAnchorMsRef.current = performance.now();
    timerRemainingAtAnchorRef.current = timeRemaining;

    const intervalId = window.setInterval(() => {
      const elapsedSec = (performance.now() - timerAnchorMsRef.current) / 1000;
      const nextRem = Math.max(0, Math.ceil(timerRemainingAtAnchorRef.current - elapsedSec));
      setTimeRemaining(nextRem);

      if (nextRem <= 3 && nextRem >= 1 && lastCountdownBeepRef.current !== nextRem) {
        lastCountdownBeepRef.current = nextRem;
        soundBankRef.current?.playCountdownBeep(nextRem as 1 | 2 | 3, isMuted, turnTokenRef.current);
      }

      if (nextRem <= 0) {
        window.clearInterval(intervalId);
        setTimeExpired(true);
        soundBankRef.current?.playTimerBell(isMuted);
      }
    }, 150);

    return () => window.clearInterval(intervalId);
  }, [
    gameState,
    turnPhase,
    questionDisplayReady,
    isPaused,
    isEditingLastTurn,
    isMuted,
  ]);

  // ---- Start New Session ----
  const handleStartSession = useCallback(() => {
    if (!setupValidation.valid) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();

    const nextState = createInitialCatchBallState({
      config,
      questionPool: activePool,
    });
    const token = `e02_turn_0_${Date.now()}`;
    turnTokenRef.current = token;
    soundBankRef.current?.setActiveTurnToken(token);

    setGameState(nextState);
    setSavedSession(null);
    setNoticeBanner(null);
    setIsPaused(false);
    setTurnPhase('selecting');
    resetTurnDrafts(nextState);
    lastCountdownBeepRef.current = -1;
    setTimeRemaining(nextState.config.timerSeconds);
    setShowSolutionReview(false);
    setZoomQuestion(null);

    soundBankRef.current?.playBallBounceCue(isMuted, token);
  }, [setupValidation.valid, config, activePool, stopAllAudioAndPending, resetTurnDrafts, isMuted]);

  // ---- Resume Saved Session ----
  const handleResumeSavedSession = useCallback(() => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();

    const token = `e02_resume_${Date.now()}`;
    turnTokenRef.current = token;
    soundBankRef.current?.setActiveTurnToken(token);

    setGameState(savedSession);
    setNoticeBanner(null);
    setIsPaused(false);
    resetTurnDrafts(savedSession);

    const curQ = savedSession.questionOrder[savedSession.currentTurnIndex];
    const doneHere = Boolean(curQ && savedSession.history.some((h) => h.questionId === curQ.id));
    setTurnPhase(doneHere ? 'revealed' : 'selecting');
    lastCountdownBeepRef.current = -1;
    setTimeRemaining(savedSession.config.timerSeconds);
  }, [savedSession, stopAllAudioAndPending, resetTurnDrafts]);

  // ---- Select a Ball (NEVER auto-commits!) ----
  const handleSelectBallLabel = useCallback(
    (letter: CatchOptionLetter) => {
      if (!gameState || isPaused || turnPhase !== 'selecting') return;
      if (gameState.config.participantMode === 'teams') return;
      soundBankRef.current?.unlock();
      setDraftSingleChoice(letter);
    },
    [gameState, isPaused, turnPhase]
  );

  // ---- Teams Grading Completeness Check ----
  const allTeamsGraded = useMemo(() => {
    if (!gameState || gameState.config.participantMode !== 'teams') return true;
    return gameState.config.teams.every((t) => {
      const v = draftTeamChoices[t.id];
      return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'no_answer';
    });
  }, [gameState, draftTeamChoices]);

  const canConfirmCatch = useMemo(() => {
    if (!gameState || !currentQuestion || isPaused || turnPhase !== 'selecting') return false;
    if (gameState.config.participantMode === 'teams') {
      return allTeamsGraded;
    }
    if (draftSingleChoice !== null) return true;
    // Allow explicit "no_answer" commit when timer expired
    return timeExpired;
  }, [gameState, currentQuestion, isPaused, turnPhase, allTeamsGraded, draftSingleChoice, timeExpired]);

  // ---- Confirm Catch & Reveal Result ----
  const handleConfirmCatch = useCallback(() => {
    if (!gameState || !currentQuestion || isPaused || actionLockRef.current) return;
    if (!canConfirmCatch) return;
    actionLockRef.current = true;
    soundBankRef.current?.unlock();
    stopAllAudioAndPending();

    const activeToken = turnTokenRef.current;

    if (isEditingLastTurn) {
      const edited = editLastCatchBallTurn(gameState, {
        selectedLabel:
          gameState.config.participantMode !== 'teams'
            ? draftSingleChoice ?? 'no_answer'
            : undefined,
        teamChoices: gameState.config.participantMode === 'teams' ? draftTeamChoices : undefined,
      });
      scheduleTimeout(() => {
        actionLockRef.current = false;
      }, 180);
      if (!edited.edited) return;
      setGameState(edited.state);
      setIsEditingLastTurn(false);
      setTurnPhase('revealed');
      setNoticeBanner('Đã cập nhật kết quả lượt vừa chấm và tính lại điểm từ lịch sử.');
      return;
    }

    const res = commitCatchBallTurn(gameState, {
      question: currentQuestion,
      selectedLabel:
        gameState.config.participantMode !== 'teams' ? draftSingleChoice ?? 'no_answer' : undefined,
      teamChoices: gameState.config.participantMode === 'teams' ? draftTeamChoices : undefined,
    });

    scheduleTimeout(() => {
      actionLockRef.current = false;
    }, 180);
    if (!res.committed || !res.record) return;

    setGameState(res.state);
    setTurnPhase('revealed');

    // Play catch swish immediately, then ONE unified outcome cue (even when multiple teams score!)
    soundBankRef.current?.playBallCatchWhoosh(isMuted, activeToken);
    const anyCorrect = Object.values(res.record.isCorrectByParticipant).some(Boolean);
    scheduleTimeout(() => {
      if (res.state.status === 'finished') {
        soundBankRef.current?.playBallSessionSummary(isMuted, activeToken);
      } else {
        soundBankRef.current?.playBallOutcomeCue(anyCorrect, isMuted, activeToken);
      }
    }, reducedMotion ? 80 : 320);

    const correctLabel = getCorrectOptionLabelForCatchQuestion(currentQuestion);
    void speakVietnameseSafe(
      `Đáp án đúng là ${correctLabel}. ${currentQuestion.officialAnswerText}`
    );
  }, [
    gameState,
    currentQuestion,
    isPaused,
    canConfirmCatch,
    stopAllAudioAndPending,
    isEditingLastTurn,
    draftSingleChoice,
    draftTeamChoices,
    scheduleTimeout,
    isMuted,
    reducedMotion,
    speakVietnameseSafe,
  ]);

  // ---- Edit Last Confirmed Turn (before opening next question) ----
  const handleStartEditLastTurn = useCallback(() => {
    if (!gameState || !canEditLastTurn || isPaused) return;
    const last = gameState.history[gameState.history.length - 1];
    if (!last) return;
    stopAllAudioAndPending();

    if (gameState.config.participantMode === 'teams') {
      const prefill: Record<string, CatchTeamChoice> = {};
      gameState.config.teams.forEach((t) => {
        prefill[t.id] = last.choiceByParticipant[t.id] || 'no_answer';
      });
      setDraftTeamChoices(prefill);
    } else {
      const pid = gameState.config.participantMode === 'solo_practice' ? 'solo_1' : 'class_1';
      setDraftSingleChoice(last.choiceByParticipant[pid] || 'no_answer');
    }
    setIsEditingLastTurn(true);
    setTurnPhase('selecting');
  }, [gameState, canEditLastTurn, isPaused, stopAllAudioAndPending]);

  // ---- Next Question ----
  const handleNextQuestion = useCallback(() => {
    if (!gameState || isPaused || actionLockRef.current) return;
    actionLockRef.current = true;
    stopAllAudioAndPending();

    const nextState = advanceCatchBallTurn(gameState);
    const token = `e02_turn_${nextState.currentTurnIndex}_${Date.now()}`;
    turnTokenRef.current = token;
    soundBankRef.current?.setActiveTurnToken(token);

    setGameState(nextState);
    resetTurnDrafts(nextState);
    setTurnPhase('selecting');
    lastCountdownBeepRef.current = -1;
    setTimeRemaining(nextState.config.timerSeconds);
    setNoticeBanner(null);

    soundBankRef.current?.playBallBounceCue(isMuted, token);

    scheduleTimeout(() => {
      actionLockRef.current = false;
    }, 180);
  }, [gameState, isPaused, stopAllAudioAndPending, resetTurnDrafts, isMuted, scheduleTimeout]);

  // ---- Pause / Skip Animation / Replay ----
  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopAllAudioAndPending();
      } else {
        timerAnchorMsRef.current = performance.now();
        timerRemainingAtAnchorRef.current = timeRemaining;
      }
      return next;
    });
  }, [stopAllAudioAndPending, timeRemaining]);

  const handleSkipAnimation = useCallback(() => {
    setSkipAnimationKey((k) => k + 1);
  }, []);

  const handleReplay = useCallback(() => {
    stopAllAudioAndPending();
    clearE02Session();
    setSavedSession(null);
    if (gameState) {
      setConfig(gameState.config);
    }
    setGameState(null);
    setIsPaused(false);
    setTurnPhase('selecting');
    setIsEditingLastTurn(false);
    setShowSolutionReview(false);
    setZoomQuestion(null);
    setNoticeBanner(null);
  }, [gameState, stopAllAudioAndPending]);

  // ---- Keyboard Controls (A/B/C/D or 1/2/3/4, Enter, P, Escape) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        setZoomQuestion(null);
        setShowSolutionReview(false);
        return;
      }

      if (!gameState || gameState.status !== 'playing') return;

      const keyUpper = e.key.toUpperCase();
      if (keyUpper === 'P') {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      if (isPaused) return;

      // Ball selection shortcuts in Solo / Whole-Class modes
      if (turnPhase === 'selecting' && gameState.config.participantMode !== 'teams') {
        const keyMap: Record<string, CatchOptionLetter> = {
          A: 'A',
          B: 'B',
          C: 'C',
          D: 'D',
          '1': 'A',
          '2': 'B',
          '3': 'C',
          '4': 'D',
        };
        const mapped = keyMap[keyUpper];
        if (mapped) {
          e.preventDefault();
          handleSelectBallLabel(mapped);
          return;
        }
      }

      if (e.key === 'Enter') {
        if (turnPhase === 'selecting' && canConfirmCatch) {
          e.preventDefault();
          handleConfirmCatch();
        } else if (turnPhase === 'revealed' && gameState.status === 'playing') {
          e.preventDefault();
          handleNextQuestion();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    isPaused,
    turnPhase,
    canConfirmCatch,
    handleTogglePause,
    handleSelectBallLabel,
    handleConfirmCatch,
    handleNextQuestion,
  ]);

  // ---- Compute 3D/2D Stage Props (STRICT ANTI-SPOILER) ----
  const stageSelectedLabels = useMemo<CatchOptionLetter[]>(() => {
    if (!gameState) return [];
    if (turnPhase === 'selecting') {
      if (gameState.config.participantMode === 'teams') {
        const picked = new Set<CatchOptionLetter>();
        Object.values(draftTeamChoices).forEach((v) => {
          if (v === 'A' || v === 'B' || v === 'C' || v === 'D') picked.add(v);
        });
        return Array.from(picked);
      }
      return draftSingleChoice && draftSingleChoice !== 'no_answer' ? [draftSingleChoice] : [];
    }
    return [];
  }, [gameState, turnPhase, draftTeamChoices, draftSingleChoice]);

  const stageCaughtLabels = useMemo<CatchOptionLetter[]>(() => {
    if (!gameState || turnPhase !== 'revealed' || !currentTurnRecord) return [];
    const set = new Set<CatchOptionLetter>();
    Object.values(currentTurnRecord.choiceByParticipant).forEach((v) => {
      if (v === 'A' || v === 'B' || v === 'C' || v === 'D') set.add(v);
    });
    return Array.from(set);
  }, [gameState, turnPhase, currentTurnRecord]);

  const stageCorrectLabel: CatchOptionLetter | null =
    turnPhase === 'revealed' && currentQuestion
      ? getCorrectOptionLabelForCatchQuestion(currentQuestion)
      : null;

  const totalMaxPoints = gameState ? gameState.questionOrder.length * E02_POINTS_CORRECT : 80;

  // ============================================================================
  // SHARED TOP BAR (Consistent with A01 / A02 / E01)
  // ============================================================================
  const renderTopBar = () => (
    <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#071226] border-b border-slate-700/80 text-white shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => {
            stopAllAudioAndPending();
            onBackToLibrary();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về thư viện</span>
        </button>

        <div className="min-w-0 flex items-center gap-2 text-sm font-extrabold tracking-tight truncate">
          <span className="text-yellow-300 whitespace-nowrap">E02</span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="truncate">Bắt bóng kiến thức 3D</span>
          {isDemo && (
            <span className="text-xs font-semibold text-teal-300 whitespace-nowrap">
              · Bản demo KHKT
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setForce2D((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
          title="Chuyển đổi giữa sân 3D và minh họa 2D nhẹ"
        >
          <Layers className="w-3.5 h-3.5 text-teal-300" />
          <span>{force2D ? 'Đang dùng 2D' : 'Sân 3D'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReducedMotion((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
          title="Giảm chuyển động cho máy chiếu hoặc người nhạy cảm chuyển động"
        >
          <CircleDot className="w-3.5 h-3.5 text-amber-300" />
          <span>{reducedMotion ? 'Giảm CĐ: Bật' : 'Hoạt ảnh'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleVoice}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
            voiceEnabled && !isMuted
              ? 'bg-teal-900/80 text-teal-200 border border-teal-600/60'
              : 'bg-slate-800 text-slate-400'
          }`}
          title={
            voiceSnap && !voiceSnap.hasVietnameseVoice
              ? 'Trình duyệt không có giọng tiếng Việt — trò chơi vẫn chạy bình thường bằng chữ và hình'
              : 'Bật/tắt đọc đáp án bằng giọng tiếng Việt'
          }
        >
          {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span>Giọng VI</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
            isMuted
              ? 'bg-rose-950/90 text-rose-200 border border-rose-700/60'
              : 'bg-slate-800 hover:bg-slate-700 text-yellow-300'
          }`}
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 whitespace-nowrap"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        )}
      </div>
    </header>
  );

  // ============================================================================
  // 1. SETUP VIEW (No email or student roster required; instant sample start)
  // ============================================================================
  if (!gameState) {
    return (
      <div
        className={`w-full flex flex-col bg-[#0A162C] text-white ${
          isFullscreen ? 'h-full overflow-y-auto' : 'rounded-2xl border border-slate-700/80 overflow-hidden'
        }`}
      >
        {renderTopBar()}

        <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-5">
          {noticeBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-100 text-xs font-semibold">
              <span>{noticeBanner}</span>
              <button
                type="button"
                onClick={() => setNoticeBanner(null)}
                className="text-amber-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {savedSession && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-teal-950/70 border border-teal-500/50">
              <div className="text-xs sm:text-sm text-teal-100 font-semibold">
                Có phiên E02 đang lưu dở ({savedSession.history.length}/
                {savedSession.questionOrder.length} câu đã chấm).
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-[#071226] text-xs font-black"
                >
                  Tiếp tục phiên cũ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearE02Session();
                    setSavedSession(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Xóa bản lưu
                </button>
              </div>
            </div>
          )}

          {/* Hero Split: Live 3D Court Preview + Clear Rules */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7 flex flex-col gap-3">
              <CatchBall3DScene
                selectedLabels={['B']}
                caughtLabels={[]}
                isRevealed={false}
                correctLabel={null}
                canInteract={false}
                skipAnimationKey={skipAnimationKey}
                reducedMotion={reducedMotion}
                force2D={force2D}
                turnKey="setup_preview"
                compact
              />
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 rounded-xl bg-[#0F2140] border border-slate-700/70">
                  <div className="text-xs text-slate-400">Chấm điểm minh bạch</div>
                  <div className="text-sm font-black text-yellow-300 tabular-nums mt-0.5">
                    +10đ đúng · 0đ sai
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0F2140] border border-slate-700/70">
                  <div className="text-xs text-slate-400">Bộ mẫu sẵn sàng</div>
                  <div className="text-sm font-black text-teal-300 tabular-nums mt-0.5">
                    8 câu · Tối đa 80đ
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0F2140] border border-slate-700/70">
                  <div className="text-xs text-slate-400">Phím nhanh</div>
                  <div className="text-sm font-black text-white mt-0.5">
                    A–D / 1–4 · Enter
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#0F2140] border border-slate-700/80 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
                  Thiết lập phiên Bắt bóng kiến thức 3D
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Bốn quả bóng A–D hiển thị rõ trong cùng khung hình kèm thẻ công thức Toán phẳng.
                  Chọn bóng trước rồi bấm <strong className="text-yellow-300">Bắt bóng</strong> để chốt;
                  không thưởng tốc độ bấm, đồng điểm xếp <strong className="text-teal-300">Đồng hạng</strong>.
                </p>

                {/* Participant Mode Selector */}
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-300">Hình thức tổ chức</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'solo_practice', label: 'Tự luyện', sub: '1 học sinh', icon: User },
                        { id: 'whole_class', label: 'Cả lớp', sub: '1–50 HS', icon: Users },
                        { id: 'teams', label: 'Nhiều đội', sub: '2–6 đội', icon: Trophy },
                      ] as const
                    ).map((item) => {
                      const Icon = item.icon;
                      const active = config.participantMode === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({ ...prev, participantMode: item.id }))
                          }
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'bg-teal-500/20 border-teal-400 text-white'
                              : 'bg-[#071226] border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-xs font-black">
                            <Icon className="w-3.5 h-3.5 text-teal-300 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.sub}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Teams Config (Only when participantMode === 'teams') */}
                {config.participantMode === 'teams' && (
                  <div className="space-y-2 p-3 rounded-xl bg-[#071226] border border-slate-700/80">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">Số đội tham gia (2–6)</span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                teams: createCatchTeams(
                                  n,
                                  prev.teams.map((t) => t.name)
                                ),
                              }))
                            }
                            className={`w-7 h-7 rounded-lg text-xs font-black tabular-nums ${
                              config.teams.length === n
                                ? 'bg-yellow-400 text-[#071226]'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {config.teams.map((team, idx) => {
                        const pal = getTeamPalette(team.paletteIndex);
                        return (
                          <div
                            key={team.id}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pal.hex }}
                            />
                            <input
                              type="text"
                              value={team.name}
                              maxLength={24}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  teams: prev.teams.map((t, i) =>
                                    i === idx ? { ...t, name: val } : t
                                  ),
                                }));
                              }}
                              aria-label={`Tên đội ${idx + 1}`}
                              className="w-full bg-transparent text-xs font-bold text-white outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={!setupValidation.valid}
                onClick={handleStartSession}
                className={`w-full py-3 px-4 rounded-xl text-sm font-black inline-flex items-center justify-center gap-2 transition-colors ${
                  setupValidation.valid
                    ? 'bg-gradient-to-r from-teal-400 to-yellow-400 hover:from-teal-300 hover:to-yellow-300 text-[#071226] shadow-lg'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  Bắt đầu Bắt bóng ({setupValidation.effectiveQuestionCount} câu)
                </span>
              </button>
            </div>
          </div>

          {/* Question Source, Timer & Shuffle Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-[#0F2140] border border-slate-700/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black text-white">Nguồn câu hỏi</h3>
                <span className="text-xs font-semibold text-teal-300 tabular-nums">
                  {activePool.length} câu 4 phương án sẵn sàng
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                  className={`p-3 rounded-xl border text-left ${
                    config.sourceKind === 'sample'
                      ? 'bg-teal-500/20 border-teal-400 text-white'
                      : 'bg-[#071226] border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-black">{E02_SAMPLE_PACK_TITLE}</div>
                  <div className="text-[11px] text-teal-300 mt-0.5">
                    8 câu Toán THCS · {E02_SAMPLE_BADGE}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'bank' }))}
                  className={`p-3 rounded-xl border text-left ${
                    config.sourceKind === 'bank'
                      ? 'bg-teal-500/20 border-teal-400 text-white'
                      : 'bg-[#071226] border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="text-xs font-black">Ngân hàng câu hỏi Smart EDU</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Lọc câu trắc nghiệm 4 phương án theo quyền
                  </div>
                </button>
              </div>

              {config.sourceKind === 'bank' && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <select
                    value={config.subjectFilter}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#071226] border border-slate-700 text-xs font-semibold text-slate-200"
                    aria-label="Lọc môn học"
                  >
                    <option value="all">Tất cả môn</option>
                    {availableSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <select
                    value={config.gradeFilter}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#071226] border border-slate-700 text-xs font-semibold text-slate-200"
                    aria-label="Lọc khối lớp"
                  >
                    <option value="all">Tất cả khối</option>
                    {availableGrades.map((g) => (
                      <option key={g} value={g}>
                        Khối {g}
                      </option>
                    ))}
                  </select>
                  <select
                    value={config.levelFilter}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, levelFilter: e.target.value }))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#071226] border border-slate-700 text-xs font-semibold text-slate-200"
                    aria-label="Lọc mức độ"
                  >
                    <option value="all">Mọi mức độ</option>
                    <option value="know">Nhận biết</option>
                    <option value="understand">Thông hiểu</option>
                    <option value="apply">Vận dụng</option>
                    <option value="high_apply">Vận dụng cao</option>
                  </select>
                </div>
              )}

              {setupValidation.errors.map((err, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-950/70 border border-rose-600/60 text-xs text-rose-200"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
                  <span>{err}</span>
                </div>
              ))}
              {setupValidation.warnings.map((warn, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-950/60 border border-amber-500/50 text-xs text-amber-200"
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                  <span>{warn}</span>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-[#0F2140] border border-slate-700/80 space-y-3">
              <h3 className="text-sm font-black text-white">Số câu, đồng hồ &amp; xáo trộn</h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Số câu (mặc định 8)</label>
                  <div className="flex flex-wrap gap-1">
                    {[4, 6, 8, 10, 12].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, questionCount: n }))}
                        className={`px-2.5 py-1 rounded-lg text-xs font-black tabular-nums ${
                          config.questionCount === n
                            ? 'bg-teal-400 text-[#071226]'
                            : 'bg-[#071226] text-slate-300 border border-slate-700'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Thời gian mỗi câu</label>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { v: 0, l: 'Không giới hạn' },
                      { v: 15, l: '15s' },
                      { v: 20, l: '20s' },
                      { v: 30, l: '30s' },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, timerSeconds: opt.v }))}
                        className={`px-2 py-1 rounded-lg text-xs font-black tabular-nums ${
                          config.timerSeconds === opt.v
                            ? 'bg-yellow-400 text-[#071226]'
                            : 'bg-[#071226] text-slate-300 border border-slate-700'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold text-slate-200">
                <label className="inline-flex items-center gap-2 cursor-pointer">
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
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.shuffleOptions}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                    }
                    className="accent-teal-400 w-4 h-4"
                  />
                  <span>Xáo trộn phương án A–D (giữ mã ổn định)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. FINISHED SUMMARY VIEW
  // ============================================================================
  if (gameState.status === 'finished' && turnPhase === 'revealed' && !isEditingLastTurn) {
    const primaryRow = standings[0];
    return (
      <div
        className={`w-full flex flex-col bg-[#0A162C] text-white ${
          isFullscreen ? 'h-full overflow-y-auto' : 'rounded-2xl border border-slate-700/80 overflow-hidden'
        }`}
      >
        {renderTopBar()}

        <div className="p-4 sm:p-6 max-w-5xl w-full mx-auto space-y-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-[#0F2140] border border-teal-500/40 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-teal-300">
                  Tổng kết phiên · {gameState.questionOrder.length} câu hỏi · Tối đa {totalMaxPoints} điểm
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Hoàn thành Bắt bóng kiến thức 3D!
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSolutionReview(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#071226] text-xs sm:text-sm font-black"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Xem lại lời giải</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplay}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#071226] text-xs sm:text-sm font-black"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAllAudioAndPending();
                    onBackToLibrary();
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Về thư viện</span>
                </button>
              </div>
            </div>

            {/* Standings Table (Solo / Whole Class / 2-6 Teams with Đồng hạng) */}
            {gameState.config.participantMode !== 'teams' && primaryRow ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700">
                  <div className="text-xs text-slate-400">Tổng điểm</div>
                  <div className="text-2xl font-black text-yellow-300 tabular-nums mt-0.5">
                    {primaryRow.points} / {totalMaxPoints}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#071226] border border-emerald-700/60">
                  <div className="text-xs text-emerald-300">Số câu đúng</div>
                  <div className="text-2xl font-black text-emerald-300 tabular-nums mt-0.5">
                    {primaryRow.correctCount}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#071226] border border-amber-700/60">
                  <div className="text-xs text-amber-300">Chưa đúng</div>
                  <div className="text-2xl font-black text-amber-300 tabular-nums mt-0.5">
                    {primaryRow.incorrectCount}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700">
                  <div className="text-xs text-slate-400">Không trả lời</div>
                  <div className="text-2xl font-black text-slate-200 tabular-nums mt-0.5">
                    {primaryRow.noAnswerCount}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-700/80">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#071226] text-slate-300 border-b border-slate-700">
                      <th className="py-2.5 px-3 font-bold">Hạng</th>
                      <th className="py-2.5 px-3 font-bold">Đội</th>
                      <th className="py-2.5 px-3 font-bold text-right">Điểm</th>
                      <th className="py-2.5 px-3 font-bold text-right">Đúng</th>
                      <th className="py-2.5 px-3 font-bold text-right">Chưa đúng</th>
                      <th className="py-2.5 px-3 font-bold text-right">Không TL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60">
                    {standings.map((row) => {
                      const pal = getTeamPalette(row.paletteIndex);
                      return (
                        <tr key={row.id} className="bg-[#0B1B36]">
                          <td className="py-2.5 px-3 font-black text-yellow-300 tabular-nums whitespace-nowrap">
                            #{row.rank} {row.isTied ? '· Đồng hạng' : ''}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: pal.hex }}
                              />
                              <span>{row.name}</span>
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-black text-right text-teal-300 tabular-nums">
                            {row.points}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-300 font-bold tabular-nums">
                            {row.correctCount}
                          </td>
                          <td className="py-2.5 px-3 text-right text-amber-300 font-bold tabular-nums">
                            {row.incorrectCount}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300 font-bold tabular-nums">
                            {row.noAnswerCount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-400">
              Điểm tính hoàn toàn theo đáp án đã chọn (+10 điểm đúng, 0 điểm sai hoặc không trả lời),
              không cộng tốc độ bấm và không trừ điểm khi bỏ qua hoạt ảnh.
            </p>
          </div>

          {/* Inline Preview of All Questions & Solutions */}
          <div className="space-y-3">
            <h3 className="text-sm font-black text-teal-200">
              Tóm tắt đáp án và lời giải ({gameState.history.length} câu)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameState.history.map((rec, idx) => (
                <div
                  key={rec.questionId}
                  className="p-3.5 rounded-xl bg-white text-slate-900 border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>
                      Câu {idx + 1} · {rec.questionCode}
                    </span>
                    <span className="text-emerald-700 font-black">
                      Đáp án {rec.correctOptionLabel}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 overflow-x-auto">
                    <MathView content={rec.questionStem} />
                  </div>
                  <div className="text-xs font-bold text-emerald-800 overflow-x-auto">
                    Đáp án chuẩn: <MathView content={rec.officialAnswerText} />
                  </div>
                  <div className="text-xs text-slate-700 overflow-x-auto">
                    <MathView content={rec.explanation} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Full Solution Review Modal */}
        {showSolutionReview && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[88vh] bg-white text-slate-900 rounded-2xl border border-slate-300 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#071226] text-white">
                <h3 className="text-base font-black">Xem lại toàn bộ lời giải E02</h3>
                <button
                  type="button"
                  onClick={() => setShowSolutionReview(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto space-y-4">
                {gameState.history.map((rec, idx) => (
                  <div
                    key={rec.questionId}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="text-xs font-bold text-slate-500">
                      Câu {idx + 1} · {rec.questionCode} · Đáp án đúng: {rec.correctOptionLabel}
                    </div>
                    <div className="text-base font-bold text-slate-900 overflow-x-auto">
                      <MathView content={rec.questionStem} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rec.optionsSnapshot.map((opt) => (
                        <div
                          key={opt.id}
                          className={`px-3 py-2 rounded-lg border text-sm font-bold overflow-x-auto ${
                            opt.id === rec.correctOptionId
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="mr-2 font-black">{opt.label}.</span>
                          <MathView content={opt.text} />
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-950 overflow-x-auto">
                      <span className="font-black">Lời giải: </span>
                      <MathView content={rec.explanation} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // 3. ACTIVE GAMEPLAY VIEW (16:9 Projector-Optimized + Mobile Single-Column)
  // ============================================================================
  const singleParticipantId =
    gameState.config.participantMode === 'solo_practice' ? 'solo_1' : 'class_1';
  const singleTurnChoice = currentTurnRecord?.choiceByParticipant[singleParticipantId];
  const singleTurnCorrect = Boolean(currentTurnRecord?.isCorrectByParticipant[singleParticipantId]);

  return (
    <div
      className={`w-full flex flex-col bg-[#0A162C] text-white ${
        isFullscreen ? 'h-full overflow-y-auto' : 'rounded-2xl border border-slate-700/80 overflow-hidden'
      }`}
    >
      {renderTopBar()}

      {/* Sub-header: Turn Progress, Live Score, Timer, Pause, Skip Animation */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#0F2140] border-b border-slate-700/80 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-bold text-slate-200">
          <span className="text-yellow-300 font-black tabular-nums">
            Câu {gameState.currentTurnIndex + 1}/{gameState.questionOrder.length}
          </span>
          <span className="text-slate-500" aria-hidden="true">
            ·
          </span>
          <span>
            {gameState.config.participantMode === 'solo_practice'
              ? 'Tự luyện (1 HS)'
              : gameState.config.participantMode === 'whole_class'
              ? 'Cả lớp (1–50 HS)'
              : `Nhiều đội (${gameState.config.teams.length} đội)`}
          </span>
          {currentQuestion && (
            <>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-teal-300">{currentQuestion.sourceBadge}</span>
            </>
          )}
          {gameState.config.participantMode !== 'teams' && standings[0] && (
            <>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-yellow-300 font-black tabular-nums">
                Điểm: {standings[0].points}/{totalMaxPoints}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timer Display */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black tabular-nums ${
              gameState.config.timerSeconds <= 0
                ? 'bg-slate-800 text-teal-200'
                : timeExpired
                ? 'bg-amber-900/90 text-amber-200 border border-amber-500/60'
                : timeRemaining <= 5
                ? 'bg-rose-900/90 text-rose-100 border border-rose-500/60'
                : 'bg-[#071226] text-yellow-300 border border-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {gameState.config.timerSeconds <= 0
                ? 'Không giới hạn'
                : timeExpired
                ? 'Hết giờ (vẫn chốt được)'
                : `${timeRemaining}s`}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTogglePause}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
              isPaused
                ? 'bg-yellow-400 text-[#071226]'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
          </button>

          <button
            type="button"
            onClick={handleSkipAnimation}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
            title="Bỏ qua hoạt ảnh bay bóng — không ảnh hưởng điểm số"
          >
            <FastForward className="w-3.5 h-3.5 text-teal-300" />
            <span className="hidden sm:inline">Bỏ qua hoạt ảnh</span>
          </button>
        </div>
      </div>

      {isPaused && (
        <div className="px-4 py-2 bg-amber-400 text-[#071226] text-xs sm:text-sm font-black flex items-center justify-between gap-2">
          <span>
            Đang tạm dừng — thời gian còn lại được giữ nguyên và thao tác chọn/chốt đang khóa.
          </span>
          <button
            type="button"
            onClick={handleTogglePause}
            className="px-3 py-1 rounded-lg bg-[#071226] text-yellow-300 text-xs font-black"
          >
            Tiếp tục ngay
          </button>
        </div>
      )}

      {noticeBanner && (
        <div className="px-4 py-2 bg-teal-950/90 border-b border-teal-500/40 text-teal-100 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{noticeBanner}</span>
          <button type="button" onClick={() => setNoticeBanner(null)}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {currentQuestion && (
        <div className="p-3 sm:p-4 max-w-6xl w-full mx-auto space-y-3.5">
          {/* QUESTION CARD (Large Projector Typography + KaTeX + Mobile Scroll) */}
          <section className="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-xs font-bold text-slate-500">
                  {currentQuestion.code}
                  {currentQuestion.topic ? ` · ${currentQuestion.topic}` : ''} · Lớp{' '}
                  {currentQuestion.grade}
                </div>
                <div className="text-xl sm:text-2xl lg:text-[26px] font-extrabold leading-relaxed text-slate-900 max-w-full overflow-x-auto">
                  <MathView content={currentQuestion.stem} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setZoomQuestion(currentQuestion)}
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                title="Phóng to đề bài cho cuối lớp"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Phóng to</span>
              </button>
            </div>

            {currentQuestion.image && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48 flex justify-center bg-slate-50">
                <img
                  src={currentQuestion.image}
                  alt="Hình minh họa câu hỏi"
                  referrerPolicy="no-referrer"
                  className="max-h-48 object-contain"
                />
              </div>
            )}
          </section>

          {/* 3D COURT STAGE WITH 4 INTERACTIVE BALLS + CATCHING HOOP */}
          <CatchBall3DScene
            selectedLabels={stageSelectedLabels}
            caughtLabels={stageCaughtLabels}
            isRevealed={turnPhase === 'revealed'}
            correctLabel={stageCorrectLabel}
            canInteract={
              !isPaused &&
              turnPhase === 'selecting' &&
              gameState.config.participantMode !== 'teams'
            }
            onSelectLabel={handleSelectBallLabel}
            skipAnimationKey={skipAnimationKey}
            reducedMotion={reducedMotion}
            force2D={force2D}
            turnKey={`${currentQuestion.id}_${isEditingLastTurn ? 'edit' : 'play'}`}
          />

          {/* 4 FIXED-POSITION FLAT OPTION CARDS ATTACHED TO BALLS A–D
              (1 column on mobile, 2 cols on sm, 4 cols on lg matching the 4 balls cleanly) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {currentQuestion.options.map((opt) => {
              const slotTheme = E02_BALL_SLOT_THEMES[opt.label];
              const isSelected =
                gameState.config.participantMode !== 'teams' &&
                turnPhase === 'selecting' &&
                draftSingleChoice === opt.label;
              const isRevealedHere = turnPhase === 'revealed';
              const isCorrectOpt = isRevealedHere && opt.id === currentQuestion.correctOptionId;
              const isPickedOnReveal =
                isRevealedHere &&
                gameState.config.participantMode !== 'teams' &&
                singleTurnChoice === opt.label;

              const interactiveCard =
                !isPaused &&
                turnPhase === 'selecting' &&
                gameState.config.participantMode !== 'teams';

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!interactiveCard}
                  onClick={() => interactiveCard && handleSelectBallLabel(opt.label)}
                  className={`text-left p-3.5 rounded-xl border-2 transition-colors flex items-start gap-3 min-h-[72px] ${
                    isCorrectOpt
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md'
                      : isPickedOnReveal && !isCorrectOpt
                      ? 'bg-amber-50 border-amber-500 text-amber-950'
                      : isSelected
                      ? 'bg-yellow-50 border-yellow-400 text-slate-900 shadow-md'
                      : 'bg-white border-slate-200 text-slate-900 hover:border-teal-400'
                  } ${!interactiveCard ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span
                    className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-black ${
                      isCorrectOpt
                        ? 'bg-emerald-600 text-white'
                        : isSelected
                        ? 'bg-yellow-400 text-[#071226]'
                        : `${slotTheme.badgeBgClass} ${slotTheme.badgeTextClass}`
                    }`}
                  >
                    {opt.label}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-base sm:text-lg font-extrabold leading-snug max-w-full overflow-x-auto">
                      <MathView content={opt.text} />
                    </div>
                    {isSelected && !isRevealedHere && (
                      <div className="text-[11px] font-bold text-amber-800">
                        Đang chọn · bấm “Bắt bóng” để chốt
                      </div>
                    )}
                    {isCorrectOpt && (
                      <div className="text-[11px] font-black text-emerald-700 inline-flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Đáp án đúng</span>
                      </div>
                    )}
                    {isPickedOnReveal && !isCorrectOpt && (
                      <div className="text-[11px] font-black text-amber-700">
                        Lựa chọn vừa chốt (Chưa đúng)
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* TEAMS GRADING PANEL (Teams Mode during 'selecting') */}
          {gameState.config.participantMode === 'teams' && turnPhase === 'selecting' && (
            <section className="p-4 rounded-2xl bg-[#0F2140] border border-yellow-400/50 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-black text-yellow-300">
                  {isEditingLastTurn
                    ? 'Sửa kết quả các đội cho câu vừa chấm'
                    : 'Ghi nhận phương án A/B/C/D của từng đội (từ bảng con hoặc giơ thẻ)'}
                </h3>
                <span className="text-xs text-slate-300">
                  Phân biệt rõ “Chưa chấm” và “Không trả lời”
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {gameState.config.teams.map((team) => {
                  const pal = getTeamPalette(team.paletteIndex);
                  const val = draftTeamChoices[team.id] || 'ungraded';
                  return (
                    <div
                      key={team.id}
                      className={`p-3 rounded-xl border space-y-2 ${
                        val === 'ungraded'
                          ? 'bg-[#071226] border-amber-400/60'
                          : 'bg-slate-900/90 border-teal-500/50'
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
                          className={`text-[11px] font-black whitespace-nowrap ${
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
                            : `Bóng ${val}`}
                        </span>
                      </div>

                      <div className="grid grid-cols-5 gap-1">
                        {CATCH_OPTION_LETTERS.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            disabled={isPaused}
                            onClick={() =>
                              setDraftTeamChoices((prev) => ({ ...prev, [team.id]: letter }))
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
                            setDraftTeamChoices((prev) => ({ ...prev, [team.id]: 'no_answer' }))
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
                    ? 'Đã ghi đủ tất cả đội — sẵn sàng bắt bóng và công bố đáp án.'
                    : 'Hãy chọn A/B/C/D hoặc “Không TL” cho tất cả đội còn ở trạng thái “Chưa chấm”.'}
                </span>
                <div className="flex items-center gap-2">
                  {isEditingLastTurn && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLastTurn(false);
                        setTurnPhase('revealed');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                    >
                      Hủy sửa
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canConfirmCatch}
                    onClick={handleConfirmCatch}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                      canConfirmCatch
                        ? 'bg-gradient-to-r from-teal-400 to-yellow-400 text-[#071226] shadow-lg'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isEditingLastTurn ? 'Lưu chỉnh sửa điểm' : 'Bắt bóng & Công bố đáp án'}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ACTION BAR FOR SOLO & WHOLE-CLASS DURING 'selecting' */}
          {gameState.config.participantMode !== 'teams' && turnPhase === 'selecting' && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#0F2140] border border-slate-700/80">
              <div className="text-xs sm:text-sm font-semibold text-slate-200">
                {draftSingleChoice && draftSingleChoice !== 'no_answer' ? (
                  <span>
                    Đã chọn <strong className="text-yellow-300">Bóng {draftSingleChoice}</strong> —
                    có thể đổi bóng khác trước khi chốt.
                  </span>
                ) : draftSingleChoice === 'no_answer' ? (
                  <span className="text-amber-300 font-bold">
                    Đã chọn trạng thái “Không trả lời” (0 điểm).
                  </span>
                ) : (
                  <span>
                    {gameState.config.participantMode === 'solo_practice'
                      ? 'Chọn bóng A, B, C hoặc D rồi bấm “Bắt bóng” để chốt.'
                      : 'Cả lớp chốt phương án rồi giáo viên chọn bóng đại diện (hoặc Không trả lời).'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {gameState.config.participantMode === 'whole_class' && (
                  <button
                    type="button"
                    disabled={isPaused}
                    onClick={() => setDraftSingleChoice('no_answer')}
                    className={`px-3 py-2 rounded-xl text-xs font-extrabold border ${
                      isPaused
                        ? 'bg-slate-900 text-slate-500 border-slate-700 cursor-not-allowed'
                        : draftSingleChoice === 'no_answer'
                        ? 'bg-slate-200 text-[#071226] border-white'
                        : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                    }`}
                  >
                    Không trả lời
                  </button>
                )}

                {isEditingLastTurn && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingLastTurn(false);
                      setTurnPhase('revealed');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                  >
                    Hủy sửa
                  </button>
                )}

                <button
                  type="button"
                  disabled={!canConfirmCatch}
                  onClick={handleConfirmCatch}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                    canConfirmCatch
                      ? 'bg-gradient-to-r from-teal-400 to-yellow-400 hover:from-teal-300 hover:to-yellow-300 text-[#071226] shadow-lg'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isEditingLastTurn
                      ? 'Lưu chỉnh sửa'
                      : !draftSingleChoice && timeExpired
                      ? 'Chốt (Không trả lời)'
                      : 'Bắt bóng'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* REVEAL PANEL: Explicit Text Verdict, Official Answer, Explanation, Team Ball Badges & Next */}
          {turnPhase === 'revealed' && currentTurnRecord && (
            <section className="p-4 sm:p-5 rounded-2xl bg-[#0F2140] border border-emerald-400/50 space-y-4">
              {/* Explicit Text Outcome Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  {gameState.config.participantMode !== 'teams' ? (
                    <div
                      className={`text-base sm:text-lg font-black ${
                        singleTurnCorrect
                          ? 'text-emerald-300'
                          : singleTurnChoice === 'no_answer'
                          ? 'text-slate-300'
                          : 'text-amber-300'
                      }`}
                    >
                      {singleTurnCorrect
                        ? `Chính xác! +${E02_POINTS_CORRECT} điểm (Bóng ${singleTurnChoice})`
                        : singleTurnChoice === 'no_answer'
                        ? 'Không trả lời · 0 điểm'
                        : `Chưa đúng · 0 điểm (Đã chọn Bóng ${singleTurnChoice})`}
                    </div>
                  ) : (
                    <div className="text-base sm:text-lg font-black text-emerald-300">
                      Đã công bố đáp án chuẩn: Bóng {currentTurnRecord.correctOptionLabel}
                    </div>
                  )}
                  <div className="text-sm font-bold text-white overflow-x-auto">
                    Đáp án chuẩn:{' '}
                    <span className="text-yellow-300">
                      {currentTurnRecord.correctOptionLabel}.{' '}
                      <MathView content={currentTurnRecord.officialAnswerText} />
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {canEditLastTurn && (
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={handleStartEditLastTurn}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-extrabold ${
                        isPaused
                          ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-400/20 hover:bg-amber-400/30 border-amber-400/60 text-amber-200'
                      }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa kết quả vừa chấm</span>
                    </button>
                  )}

                  {gameState.status === 'playing' && (
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={handleNextQuestion}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black ${
                        isPaused
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-teal-400 to-yellow-400 text-[#071226] shadow-lg'
                      }`}
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        Câu tiếp theo ({gameState.currentTurnIndex + 2}/
                        {gameState.questionOrder.length})
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Explanation box */}
              <div className="p-3.5 rounded-xl bg-white text-slate-900 text-sm leading-relaxed overflow-x-auto">
                <span className="font-black text-emerald-700">Lời giải: </span>
                <MathView content={currentTurnRecord.explanation} />
              </div>

              {/* Team Cards showing each team's chosen ball badge + live rank */}
              {gameState.config.participantMode === 'teams' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {standings.map((row) => {
                    const pal = getTeamPalette(row.paletteIndex);
                    const picked = currentTurnRecord.choiceByParticipant[row.id];
                    const isRight = currentTurnRecord.isCorrectByParticipant[row.id];
                    const ballTheme =
                      picked && picked !== 'no_answer' ? E02_BALL_SLOT_THEMES[picked] : null;
                    return (
                      <div
                        key={row.id}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                          isRight
                            ? 'bg-emerald-950/60 border-emerald-500/60'
                            : 'bg-[#071226] border-slate-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-yellow-300 tabular-nums">
                              #{row.rank}
                            </span>
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pal.hex }}
                            />
                            <span className="text-xs font-extrabold text-white truncate">
                              {row.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-1 tabular-nums">
                            Tổng: <strong className="text-teal-300">{row.points}đ</strong>
                            {row.isTied ? ' · Đồng hạng' : ''}
                          </div>
                        </div>

                        {/* Visual ball badge chosen by this team */}
                        <div className="flex items-center gap-2 shrink-0">
                          {ballTheme ? (
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 ${ballTheme.badgeBgClass} ${ballTheme.badgeTextClass} ${
                                isRight ? 'border-emerald-400' : 'border-amber-400'
                              }`}
                              title={`Đã chọn Bóng ${picked}`}
                            >
                              {picked}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300">
                              Không TL
                            </span>
                          )}
                          <span
                            className={`text-xs font-black tabular-nums ${
                              isRight ? 'text-emerald-300' : 'text-slate-400'
                            }`}
                          >
                            {isRight ? `+${E02_POINTS_CORRECT}` : '+0'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ZOOM QUESTION MODAL */}
      {zoomQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl border border-slate-300 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-[#071226] text-white">
              <span className="text-sm font-black">
                Phóng to câu hỏi · {zoomQuestion.code}
              </span>
              <button
                type="button"
                onClick={() => setZoomQuestion(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
                aria-label="Đóng phóng to"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="text-2xl sm:text-3xl font-extrabold leading-relaxed overflow-x-auto">
                <MathView content={zoomQuestion.stem} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {zoomQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3"
                  >
                    <span className="w-9 h-9 rounded-full bg-[#071226] text-yellow-300 font-black flex items-center justify-center shrink-0">
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
        </div>
      )}
    </div>
  );
};

export default CatchBall3DGame;
