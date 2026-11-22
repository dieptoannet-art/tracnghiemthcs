import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  FastForward,
  Flag,
  HelpCircle,
  History,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  XCircle,
  Zap,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import {
  D01_SAMPLE_BADGE,
  D01_SAMPLE_INFO_MAIN,
  D01_SAMPLE_INFO_TIEBREAKERS,
  D01_SAMPLE_MATH_MAIN,
  D01_SAMPLE_MATH_TIEBREAKERS,
  D01_SAMPLE_PLAYER_PRESETS,
  D01_SAMPLE_TEAM_PRESETS,
  DuelAnswerMode,
  DuelBuzzerTriggerSource,
  DuelContestant,
  DuelGameState,
  DuelMark,
  DuelPlayStyle,
  DuelQuestionItem,
  DuelQuestionSource,
  DuelSideId,
  adaptBankQuestionsForD01,
  advanceDuelAfterConfirm,
  areRequiredSidesMarked,
  checkDuelDeadline,
  claimBuzzerRight,
  clearD01Session,
  computeDuelScoreboard,
  confirmBothSidesLocked,
  confirmDuelRoundResult,
  createDuelSetupState,
  endDuelMatchEarly,
  getCurrentQuestion,
  getRemainingTimeMs,
  loadD01Session,
  lockSimultaneousAnswers,
  openDuelQuestion,
  pauseDuelMatch,
  previewDuelRoundPoints,
  resolveBuzzerAttempt,
  resumeDuelMatch,
  revealAndPrepareScoring,
  rollbackToPreviousRound,
  saveD01Session,
  setSideDraftMark,
  setSideDraftOption,
  setSideDraftShortAnswer,
  skipBuzzerNoClaim,
  startBuzzerResponsePhase,
  startDuelMatch,
  startEditingLastConfirmedRound,
  teacherOverrideBuzzerSide,
} from './duel1v13dEngine';
import { Duel1v13DScene } from './Duel1v13DScene';

interface Duel1v13DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const MARK_LABELS: Record<DuelMark, string> = {
  unmarked: 'Chưa chấm',
  correct: 'Đúng',
  wrong: 'Chưa đúng',
  no_answer: 'Không trả lời',
};

function formatSecondsCeil(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

export const Duel1v13DGame: React.FC<Duel1v13DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & Vietnamese Voice controllers (reusing A01/A02 infrastructure)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceCtrlRef = useRef<EduGameVoiceController | null>(null);
  if (!soundBankRef.current) soundBankRef.current = new EduGameSoundBank();
  if (!voiceCtrlRef.current) voiceCtrlRef.current = new EduGameVoiceController();

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [viVoiceAvailable, setViVoiceAvailable] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [lightweight2D, setLightweight2D] = useState<boolean>(false);
  const [skipEffects, setSkipEffects] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState<boolean>(false);
  const [showEarlyEndConfirm, setShowEarlyEndConfirm] = useState<boolean>(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'review'>('all');
  const [imageLoadErrorId, setImageLoadErrorId] = useState<string | null>(null);
  const [isComposingInput, setIsComposingInput] = useState<boolean>(false);

  // Class Roster Picker State (reuses Smart EDU classes, supports 1-50 students cleanly)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id || '');
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Saved session detection on mount
  const [savedSessionPrompt, setSavedSessionPrompt] = useState<DuelGameState | null>(() => {
    const loaded = loadD01Session();
    if (loaded && loaded.state.phase !== 'setup') {
      return loaded.state;
    }
    return null;
  });

  // Main deterministic state
  const [gameState, setGameState] = useState<DuelGameState>(() => {
    const loaded = loadD01Session();
    return createDuelSetupState(undefined, loaded?.state.completedMatches || []);
  });

  // Setup draft fields (synced when entering setup / swapping pair)
  const [draftPlayStyle, setDraftPlayStyle] = useState<DuelPlayStyle>('duel_2_sides');
  const [draftAnswerMode, setDraftAnswerMode] = useState<DuelAnswerMode>('simultaneous');
  const [draftBuzzerSource, setDraftBuzzerSource] =
    useState<DuelBuzzerTriggerSource>('teacher_manual');
  const [draftSource, setDraftSource] = useState<DuelQuestionSource>('sample_math');
  const [draftMainCount, setDraftMainCount] = useState<number>(10);
  const [draftTimerSec, setDraftTimerSec] = useState<number>(30);
  const [draftBuzzerSec, setDraftBuzzerSec] = useState<number>(15);
  const [draftPoints, setDraftPoints] = useState<number>(10);
  const [draftTieBreaker, setDraftTieBreaker] = useState<boolean>(false);
  const [draftMaxTb, setDraftMaxTb] = useState<number>(3);
  const [draftSideA, setDraftSideA] = useState<DuelContestant>(() => ({
    ...D01_SAMPLE_PLAYER_PRESETS.sideA,
  }));
  const [draftSideB, setDraftSideB] = useState<DuelContestant>(() => ({
    ...D01_SAMPLE_PLAYER_PRESETS.sideB,
  }));

  // Live visual tick state derived from single deadline clock
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [highlightSides, setHighlightSides] = useState<{ A: boolean; B: boolean }>({
    A: false,
    B: false,
  });

  // RBAC-filtered Smart EDU bank questions
  const adaptedBank = useMemo(
    () => adaptBankQuestionsForD01(bankQuestions, userRole),
    [bankQuestions, userRole]
  );

  // Selected class students (supports 1–50 students without lag)
  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || classes[0] || null,
    [classes, selectedClassId]
  );

  const filteredClassStudents = useMemo(() => {
    const list = activeClass?.students || [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q)
    );
  }, [activeClass, studentSearch]);

  const currentPools = useMemo((): {
    main: DuelQuestionItem[];
    tieBreakers: DuelQuestionItem[];
    sourceName: string;
  } => {
    if (draftSource === 'sample_math') {
      return {
        main: D01_SAMPLE_MATH_MAIN,
        tieBreakers: D01_SAMPLE_MATH_TIEBREAKERS,
        sourceName: 'Toán THCS — Song đấu tính toán (Dữ liệu mẫu)',
      };
    }
    if (draftSource === 'sample_info') {
      return {
        main: D01_SAMPLE_INFO_MAIN,
        tieBreakers: D01_SAMPLE_INFO_TIEBREAKERS,
        sourceName: 'Tin học THCS — Song đấu thế giới số (Dữ liệu mẫu)',
      };
    }
    return {
      main: adaptedBank,
      tieBreakers: [],
      sourceName: 'Ngân hàng câu hỏi Smart EDU',
    };
  }, [draftSource, adaptedBank]);

  const scoreboard = useMemo(() => computeDuelScoreboard(gameState), [gameState]);
  const currentQuestion = useMemo(() => getCurrentQuestion(gameState), [gameState]);

  // Monitor Vietnamese voice availability & clean up on unmount
  useEffect(() => {
    const vc = voiceCtrlRef.current;
    if (!vc) return;
    const unsub = vc.subscribe((snap) => {
      setViVoiceAvailable(snap.hasVietnameseVoice);
    });
    return () => {
      unsub();
      vc.stop();
      vc.dispose();
      soundBankRef.current?.stopAll();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Persist audio preferences and stop immediately on mute
  useEffect(() => {
    saveEduGameMuted(isMuted);
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceCtrlRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  }, [isMuted]);

  useEffect(() => {
    saveEduGameVoiceEnabled(voiceEnabled);
    if (!voiceEnabled) {
      voiceCtrlRef.current?.stop();
    }
  }, [voiceEnabled]);

  // Persist match state automatically (isolated per /demo)
  useEffect(() => {
    if (gameState.phase !== 'setup' || gameState.completedMatches.length > 0) {
      saveD01Session(gameState, Date.now());
    }
  }, [gameState]);

  // Single deadline-based clock interval (tab switches NEVER add free time!)
  useEffect(() => {
    if (
      gameState.phase !== 'answering' ||
      gameState.isPaused ||
      gameState.deadlineMs === null
    ) {
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowTickMs(now);
      setGameState((prev) => {
        const res = checkDuelDeadline(prev, now);
        if (res.expired) {
          soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
          return res.state;
        }
        return prev;
      });
    }, 120);
    return () => window.clearInterval(id);
  }, [gameState.phase, gameState.isPaused, gameState.deadlineMs, isMuted]);

  // Stop voice cleanly whenever question changes or paused or exited
  useEffect(() => {
    voiceCtrlRef.current?.stop();
    setImageLoadErrorId(null);
  }, [gameState.turnToken, gameState.isPaused, gameState.phase]);

  // Trigger summary fanfare once when entering summary
  const summaryPlayedForMatchRef = useRef<string | null>(null);
  useEffect(() => {
    if (gameState.phase === 'summary' && summaryPlayedForMatchRef.current !== gameState.matchId) {
      summaryPlayedForMatchRef.current = gameState.matchId;
      soundBankRef.current?.playDuelFinishFanfare(isMuted, scoreboard.outcome === 'tie');
    }
  }, [gameState.phase, gameState.matchId, isMuted, scoreboard.outcome]);

  // Shared-keyboard buzzer listener (ONLY active during buzzer_open + shared_keyboard, never steals input focus!)
  useEffect(() => {
    if (
      gameState.phase !== 'buzzer_open' ||
      gameState.isPaused ||
      gameState.config.answerMode !== 'buzzer' ||
      gameState.config.buzzerSource !== 'shared_keyboard' ||
      gameState.inTieBreaker
    ) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.isComposing || isComposingInput) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      let claimedSide: DuelSideId | null = null;
      if (key === 'a') claimedSide = 'A';
      else if (key === 'l') claimedSide = 'B';
      if (!claimedSide) return;

      e.preventDefault();
      const now = Date.now();
      setGameState((prev) => {
        const res = claimBuzzerRight(prev, claimedSide!, prev.turnToken, now, 'shared_keyboard');
        if (res.accepted) {
          soundBankRef.current?.playDuelBuzzerClaim(isMuted, claimedSide!, prev.turnToken);
          return res.state;
        }
        return prev;
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState.phase,
    gameState.isPaused,
    gameState.config.answerMode,
    gameState.config.buzzerSource,
    gameState.inTieBreaker,
    isMuted,
    isComposingInput,
  ]);

  const stopVoiceNow = useCallback(() => {
    voiceCtrlRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const readCurrentQuestionStem = useCallback(() => {
    if (!currentQuestion || isMuted || !voiceEnabled || gameState.isPaused) return;
    // NEVER read hidden correct answer! Strictly reads stem only.
    voiceCtrlRef.current?.replayText({
      text: currentQuestion.plainReadText,
      isMuted,
      voiceEnabled,
    });
  }, [currentQuestion, isMuted, voiceEnabled, gameState.isPaused]);

  const handleAssignStudent = (side: DuelSideId, student: { id: string; fullName: string }) => {
    setSetupError(null);
    if (side === 'A') {
      if (draftPlayStyle === 'duel_2_sides' && draftSideB.studentId === student.id) {
        setSetupError('Học sinh này đang được chọn cho Bên B. Vui lòng chọn hai học sinh khác nhau.');
        return;
      }
      setDraftSideA((prev) => ({
        ...prev,
        studentId: student.id,
        label: student.fullName,
        isTempLabel: false,
      }));
    } else {
      if (draftSideA.studentId === student.id) {
        setSetupError('Học sinh này đang được chọn cho Bên A. Vui lòng chọn hai học sinh khác nhau.');
        return;
      }
      setDraftSideB((prev) => ({
        ...prev,
        studentId: student.id,
        label: student.fullName,
        isTempLabel: false,
      }));
    }
  };

  const handlePickRandomPairFromClass = () => {
    const list = activeClass?.students || [];
    if (list.length < 2) {
      setSetupError('Lớp hiện tại cần ít nhất 2 học sinh để chọn ngẫu nhiên một cặp.');
      return;
    }
    const idxA = Math.floor(Math.random() * list.length);
    let idxB = Math.floor(Math.random() * (list.length - 1));
    if (idxB >= idxA) idxB += 1;
    setSetupError(null);
    setDraftSideA((prev) => ({
      ...prev,
      studentId: list[idxA].id,
      label: list[idxA].fullName,
      isTempLabel: false,
    }));
    setDraftSideB((prev) => ({
      ...prev,
      studentId: list[idxB].id,
      label: list[idxB].fullName,
      isTempLabel: false,
    }));
  };

  const handleStartMatch = (
    overridePool?: { main: DuelQuestionItem[]; tieBreakers: DuelQuestionItem[] },
    overrideMainCount?: number
  ) => {
    stopVoiceNow();
    setSetupError(null);
    const poolMain = overridePool ? overridePool.main : currentPools.main;
    const poolTb = overridePool ? overridePool.tieBreakers : currentPools.tieBreakers;
    const requestedCount = overrideMainCount ?? draftMainCount;

    const { state, error } = startDuelMatch(
      {
        playStyle: draftPlayStyle,
        answerMode: draftAnswerMode,
        buzzerSource: draftBuzzerSource,
        questionSource: draftSource,
        requestedMainCount: requestedCount,
        timerSeconds: draftTimerSec,
        buzzerAnswerSeconds: draftBuzzerSec,
        pointsPerQuestion: draftPoints,
        tieBreakerEnabled: draftTieBreaker,
        maxTieBreakers: draftMaxTb,
        sideA: draftSideA,
        sideB: draftSideB,
      },
      poolMain,
      poolTb,
      gameState.completedMatches
    );

    if (error) {
      setSetupError(error);
      return;
    }

    setSavedSessionPrompt(null);
    setReviewFilter('all');
    setHighlightSides({ A: false, B: false });
    soundBankRef.current?.unlock();
    soundBankRef.current?.setActiveTurnToken(state.turnToken);
    soundBankRef.current?.playDuelMatchStart(isMuted, state.turnToken);
    setGameState(state);
  };

  const handleResumeSavedSession = () => {
    if (!savedSessionPrompt) return;
    stopVoiceNow();
    setGameState(savedSessionPrompt);
    setSavedSessionPrompt(null);
  };

  const handleDiscardSavedSession = () => {
    clearD01Session();
    setSavedSessionPrompt(null);
  };

  const handleOpenQuestion = () => {
    stopVoiceNow();
    setHighlightSides({ A: false, B: false });
    const now = Date.now();
    setNowTickMs(now);
    setGameState((prev) => {
      const next = openDuelQuestion(prev, now);
      soundBankRef.current?.unlock();
      soundBankRef.current?.setActiveTurnToken(next.turnToken);
      soundBankRef.current?.playDuelMatchStart(isMuted, next.turnToken);
      return next;
    });
  };

  const handleLockSimultaneous = () => {
    stopVoiceNow();
    const now = Date.now();
    setGameState((prev) => {
      const res = lockSimultaneousAnswers(prev, now);
      if (res.lockedNow) {
        soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
      }
      return res.state;
    });
  };

  const handleRevealAndScore = () => {
    setGameState((prev) => {
      const res = revealAndPrepareScoring(prev);
      if (!res.revealed && res.reason) {
        return { ...prev, statusMessage: res.reason };
      }
      return res.state;
    });
  };

  const handleConfirmRound = () => {
    stopVoiceNow();
    setGameState((prev) => {
      const res = confirmDuelRoundResult(prev, prev.turnToken);
      if (!res.confirmed) {
        return res.reason ? { ...prev, statusMessage: res.reason } : prev;
      }
      soundBankRef.current?.playDuelOutcomeTone(isMuted, res.anyCorrect, prev.turnToken);
      const last = res.state.history[res.state.history.length - 1];
      if (last) {
        setHighlightSides({
          A: last.outcomes.A.mark === 'correct',
          B: last.outcomes.B.mark === 'correct',
        });
      }
      return res.state;
    });
  };

  const handleAdvanceNext = () => {
    stopVoiceNow();
    setHighlightSides({ A: false, B: false });
    setGameState((prev) => advanceDuelAfterConfirm(prev));
  };

  const handleTogglePause = () => {
    stopVoiceNow();
    const now = Date.now();
    setNowTickMs(now);
    setGameState((prev) => (prev.isPaused ? resumeDuelMatch(prev, now) : pauseDuelMatch(prev, now)));
  };

  const handleRematch = () => {
    stopVoiceNow();
    soundBankRef.current?.stopAll();
    // Keeps identical pair & config, launches fresh matchId while preserving completedMatches archive
    const src = gameState.config.questionSource;
    const poolMain =
      src === 'sample_math'
        ? D01_SAMPLE_MATH_MAIN
        : src === 'sample_info'
          ? D01_SAMPLE_INFO_MAIN
          : adaptedBank;
    const poolTb =
      src === 'sample_math'
        ? D01_SAMPLE_MATH_TIEBREAKERS
        : src === 'sample_info'
          ? D01_SAMPLE_INFO_TIEBREAKERS
          : [];

    const { state, error } = startDuelMatch(
      gameState.config,
      poolMain,
      poolTb,
      gameState.completedMatches
    );
    if (error) {
      setSetupError(error);
      setGameState(createDuelSetupState(gameState.config, gameState.completedMatches));
      return;
    }
    setHighlightSides({ A: false, B: false });
    setReviewFilter('all');
    soundBankRef.current?.unlock();
    soundBankRef.current?.setActiveTurnToken(state.turnToken);
    soundBankRef.current?.playDuelMatchStart(isMuted, state.turnToken);
    setGameState(state);
  };

  const handleBackToSetup = (clearPair: boolean) => {
    stopVoiceNow();
    soundBankRef.current?.stopAll();
    if (clearPair) {
      setDraftSideA({ ...D01_SAMPLE_PLAYER_PRESETS.sideA });
      setDraftSideB({ ...D01_SAMPLE_PLAYER_PRESETS.sideB });
    }
    setSetupError(null);
    setGameState((prev) => createDuelSetupState(prev.config, prev.completedMatches));
  };

  const handleExitToLibrary = () => {
    stopVoiceNow();
    soundBankRef.current?.stopAll();
    onBackToLibrary();
  };

  const remainingMs = useMemo(
    () => getRemainingTimeMs(gameState, nowTickMs),
    [gameState, nowTickMs]
  );

  const isEffectiveSimultaneous =
    gameState.inTieBreaker ||
    gameState.config.answerMode === 'simultaneous' ||
    gameState.config.playStyle !== 'duel_2_sides';

  const sideBDisplayLabel =
    gameState.config.playStyle === 'solo_two_turns'
      ? 'Lượt 2 (Tự luyện)'
      : gameState.config.sideB.label;

  const isAnswerRevealed =
    gameState.phase === 'scoring' || gameState.phase === 'confirmed';

  const maxMainScore = Math.max(
    10,
    (gameState.mainDeck.length || draftMainCount) * gameState.config.pointsPerQuestion
  );

  const totalInActiveDeck = gameState.inTieBreaker
    ? gameState.tieBreakerDeck.length
    : gameState.mainDeck.length;
  const progressPct =
    totalInActiveDeck > 0
      ? Math.min(
          100,
          Math.round(
            ((gameState.currentQuestionIndex + (gameState.phase === 'confirmed' ? 1 : 0)) /
              totalInActiveDeck) *
              100
          )
        )
      : 0;

  // Render symmetrical contestant scoring column (identical size/ergonomics for Side A & Side B!)
  const renderSidePanel = (side: DuelSideId) => {
    const isA = side === 'A';
    const label = isA ? gameState.config.sideA.label : sideBDisplayLabel;
    const score = isA ? scoreboard.mainScoreA : scoreboard.mainScoreB;
    const tbScore = isA ? scoreboard.tieBreakerScoreA : scoreboard.tieBreakerScoreB;
    const draftMark = gameState.draftMarks[side];
    const draftOpt = gameState.draftOptionIds[side];
    const draftText = gameState.draftTextAnswers[side];
    const isBuzzerOwner = gameState.activeBuzzerSide === side;
    const buzzerAttempted = gameState.buzzerAttemptsUsed[side];
    const previewPts = previewDuelRoundPoints(draftMark, gameState.config.pointsPerQuestion);

    const canEditMarks =
      !gameState.isPaused &&
      (isEffectiveSimultaneous
        ? gameState.phase === 'locked' ||
          gameState.phase === 'scoring' ||
          (gameState.phase === 'confirmed' && gameState.editingLastConfirmed)
        : gameState.phase === 'confirmed' && gameState.editingLastConfirmed);

    const borderStyle = isA
      ? isBuzzerOwner || highlightSides.A
        ? 'border-blue-400 bg-blue-950/45'
        : 'border-blue-500/35 bg-[#0a1833]'
      : isBuzzerOwner || highlightSides.B
        ? 'border-amber-400 bg-amber-950/40'
        : 'border-amber-500/35 bg-[#0a1833]';

    const accentHeading = isA ? 'text-blue-300' : 'text-amber-300';
    const accentButtonActive = isA
      ? 'bg-blue-600 text-white border-blue-400'
      : 'bg-amber-500 text-slate-950 border-amber-300';

    return (
      <div className={`rounded-xl border p-3.5 flex flex-col gap-3 min-w-0 ${borderStyle}`}>
        {/* Header & Score (identical layout for A and B) */}
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <div className={`text-xs font-semibold ${accentHeading}`}>
              {isA
                ? gameState.config.playStyle === 'solo_single'
                  ? 'Học sinh tự luyện'
                  : gameState.config.playStyle === 'solo_two_turns'
                    ? 'Lượt 1 · Xanh dương'
                    : 'Bên A · Xanh dương'
                : gameState.config.playStyle === 'solo_two_turns'
                  ? 'Lượt 2 · Cam vàng'
                  : 'Bên B · Cam vàng'}
            </div>
            <h3
              className="text-base font-bold text-white break-words leading-snug mt-0.5"
              title={label}
            >
              {label}
            </h3>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono tabular-nums text-2xl font-extrabold text-white leading-none">
              {score}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">điểm chính</div>
            {tbScore > 0 && (
              <div className="font-mono tabular-nums text-xs font-bold text-cyan-300 mt-0.5">
                +{tbScore} câu phụ
              </div>
            )}
          </div>
        </div>

        {/* Status text line (never color-only!) */}
        <div className="text-xs text-slate-300 border-t border-white/10 pt-2 flex items-center justify-between gap-2">
          <span>Trạng thái:</span>
          <span className="font-semibold text-white">
            {gameState.phase === 'buzzer_open'
              ? isBuzzerOwner
                ? 'Đang giữ quyền trả lời'
                : buzzerAttempted
                  ? 'Đã dùng lượt câu này'
                  : 'Chờ giành quyền'
              : gameState.phase === 'answering'
                ? isEffectiveSimultaneous
                  ? 'Đang suy nghĩ / ghi bảng con'
                  : isBuzzerOwner
                    ? 'Đang trả lời'
                    : 'Đang chờ đối thủ'
                : MARK_LABELS[draftMark]}
          </span>
        </div>

        {/* Buzzer Claim Button (in Buzzer mode, buzzer_open) */}
        {!isEffectiveSimultaneous && gameState.phase === 'buzzer_open' && !gameState.isPaused && (
          <button
            type="button"
            disabled={
              buzzerAttempted ||
              (gameState.activeBuzzerSide !== null &&
                !gameState.nearTiePending &&
                gameState.activeBuzzerSide !== side)
            }
            onClick={() => {
              const now = Date.now();
              setGameState((prev) => {
                if (prev.nearTiePending) {
                  return teacherOverrideBuzzerSide(prev, side);
                }
                const res = claimBuzzerRight(prev, side, prev.turnToken, now, 'teacher_manual');
                if (res.accepted) {
                  soundBankRef.current?.playDuelBuzzerClaim(isMuted, side, prev.turnToken);
                  return res.state;
                }
                return prev;
              });
            }}
            className={`w-full py-2.5 px-3 rounded-lg border text-sm font-bold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              isBuzzerOwner
                ? accentButtonActive
                : 'bg-slate-800/90 hover:bg-slate-700 text-white border-slate-600'
            }`}
          >
            {buzzerAttempted
              ? 'Đã dùng cơ hội câu này'
              : isBuzzerOwner
                ? 'Đã nhận quyền trả lời'
                : gameState.config.buzzerSource === 'shared_keyboard'
                  ? `Ghi nhận quyền (Phím ${isA ? 'A' : 'L'})`
                  : 'Ghi nhận giành quyền'}
          </button>
        )}

        {/* Buzzer Active Responder Answer Input */}
        {!isEffectiveSimultaneous &&
          gameState.phase === 'answering' &&
          isBuzzerOwner &&
          !gameState.isPaused && (
            <div className="space-y-2 border-t border-white/10 pt-2">
              <div className="text-xs font-semibold text-cyan-200">
                Chốt kết quả trả lời của {label}:
              </div>
              {currentQuestion && currentQuestion.options.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {currentQuestion.options.map((opt) => (
                    <button
                      key={opt.optionId}
                      type="button"
                      onClick={() => {
                        const isRight = opt.optionId === currentQuestion.correctOptionId;
                        setGameState((prev) => {
                          const res = resolveBuzzerAttempt(
                            prev,
                            isRight ? 'correct' : 'wrong',
                            opt.optionId,
                            prev.turnToken,
                            Date.now()
                          );
                          soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
                          return res.state;
                        });
                      }}
                      className="py-2 px-2.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                    >
                      Chọn {opt.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setGameState((prev) => {
                      soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
                      return resolveBuzzerAttempt(prev, 'correct', null, prev.turnToken, Date.now())
                        .state;
                    })
                  }
                  className="py-2 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                >
                  Đúng
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGameState((prev) => {
                      soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
                      return resolveBuzzerAttempt(prev, 'wrong', null, prev.turnToken, Date.now())
                        .state;
                    })
                  }
                  className="py-2 px-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
                >
                  Chưa đúng
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setGameState((prev) => {
                      soundBankRef.current?.playDuelAnswerLock(isMuted, prev.turnToken);
                      return resolveBuzzerAttempt(
                        prev,
                        'no_answer',
                        null,
                        prev.turnToken,
                        Date.now()
                      ).state;
                    })
                  }
                  className="py-2 px-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-slate-100 cursor-pointer"
                >
                  Không TL
                </button>
              </div>
            </div>
          )}

        {/* Simultaneous / Manual Grading Controls */}
        {canEditMarks && currentQuestion && (
          <div className="space-y-2 border-t border-white/10 pt-2">
            {/* Quick option buttons for MC/TF */}
            {currentQuestion.options.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-400 mb-1">
                  Ghi nhận phương án đã viết:
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {currentQuestion.options.map((opt) => {
                    const selected = draftOpt === opt.optionId;
                    return (
                      <button
                        key={opt.optionId}
                        type="button"
                        onClick={() =>
                          setGameState((prev) =>
                            setSideDraftOption(prev, side, opt.optionId)
                          )
                        }
                        className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                          selected
                            ? accentButtonActive
                            : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Short-answer text input (IME composition-safe) */}
            {currentQuestion.type === 'short_answer' && (
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Ghi đáp án ngắn (tùy chọn):
                </label>
                <input
                  type="text"
                  value={draftText}
                  onCompositionStart={() => setIsComposingInput(true)}
                  onCompositionEnd={(e) => {
                    setIsComposingInput(false);
                    const val = e.currentTarget.value;
                    setGameState((prev) => setSideDraftShortAnswer(prev, side, val));
                  }}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (isComposingInput) {
                      setGameState((prev) =>
                        setSideDraftMark(prev, side, prev.draftMarks[side], null, val)
                      );
                    } else {
                      setGameState((prev) => setSideDraftShortAnswer(prev, side, val));
                    }
                  }}
                  placeholder="Nhập đáp án học sinh..."
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            )}

            {/* Explicit 3-way Teacher Grading Buttons (Unmarked is NEVER treated as wrong!) */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setGameState((prev) =>
                    setSideDraftMark(prev, side, 'correct', prev.draftOptionIds[side], prev.draftTextAnswers[side])
                  )
                }
                className={`py-2 px-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  draftMark === 'correct'
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Đúng
              </button>
              <button
                type="button"
                onClick={() =>
                  setGameState((prev) =>
                    setSideDraftMark(prev, side, 'wrong', prev.draftOptionIds[side], prev.draftTextAnswers[side])
                  )
                }
                className={`py-2 px-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  draftMark === 'wrong'
                    ? 'bg-rose-600 border-rose-400 text-white'
                    : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Chưa đúng
              </button>
              <button
                type="button"
                onClick={() =>
                  setGameState((prev) =>
                    setSideDraftMark(prev, side, 'no_answer', null, '')
                  )
                }
                className={`py-2 px-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                  draftMark === 'no_answer'
                    ? 'bg-slate-600 border-slate-400 text-white'
                    : 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                Không TL
              </button>
            </div>
          </div>
        )}

        {/* Score Preview (shown ONLY in scoring/confirmed phase after reveal!) */}
        {isAnswerRevealed && (
          <div className="rounded-lg bg-slate-900/90 border border-white/10 px-2.5 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-300">Điểm lượt này:</span>
            <span
              className={`font-mono tabular-nums font-extrabold ${
                previewPts > 0 ? 'text-emerald-300' : 'text-slate-400'
              }`}
            >
              +{previewPts} điểm
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`w-full flex flex-col bg-[#050d1e] text-slate-100 ${
        isFullscreen ? 'h-dvh overflow-y-auto' : 'rounded-2xl border border-cyan-500/20 overflow-hidden'
      }`}
    >
      {/* TOP BAR (Desktop 16:9 Projector Bar: Back, Title, Sound/Voice, Mode, Fullscreen) */}
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#08152e] border-b border-cyan-500/20 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-white truncate">
              D01 – Đấu trường 1 đấu 1
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isMuted
                ? 'bg-slate-800 text-slate-400 hover:text-white'
                : 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Đang tắt tiếng' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={() => setVoiceEnabled((v) => !v)}
            disabled={isMuted}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 ${
              voiceEnabled && !isMuted
                ? 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30'
                : 'bg-slate-800 text-slate-400'
            }`}
            title={
              viVoiceAvailable
                ? 'Bật/tắt giọng đọc tiếng Việt'
                : 'Thiết bị chưa có giọng Việt — vẫn chơi bình thường'
            }
          >
            <span>{voiceEnabled ? 'Giọng Việt: Bật' : 'Giọng Việt: Tắt'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLightweight2D((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              lightweight2D
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {lightweight2D ? '2D nhẹ' : '3D'}
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              reducedMotion
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {reducedMotion ? 'Ít động: Bật' : 'Ít động'}
          </button>

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Luật chơi</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* PHASE 1: SETUP SCREEN                                               */}
      {/* =================================================================== */}
      {gameState.phase === 'setup' && (
        <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-5">
          {/* Resume Saved Match Prompt */}
          {savedSessionPrompt && (
            <div className="rounded-xl border border-cyan-400/40 bg-cyan-950/35 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <div className="font-bold text-cyan-200">
                  Phát hiện trận D01 đang chơi dở ({savedSessionPrompt.config.sideA.label} vs{' '}
                  {savedSessionPrompt.config.sideB.label})
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Đã lưu tiến độ {savedSessionPrompt.history.length} câu, giữ nguyên thứ tự câu và
                  quyền đã dùng (tạm dừng an toàn để không cộng thêm giờ).
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                >
                  Khôi phục trận
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          )}

          {/* Stage Preview */}
          <Duel1v13DScene
            playStyle={draftPlayStyle}
            phase="setup"
            sideALabel={draftSideA.label}
            sideBLabel={
              draftPlayStyle === 'solo_two_turns' ? 'Lượt 2 (Tự luyện)' : draftSideB.label
            }
            scoreA={0}
            scoreB={0}
            tieBreakerScoreA={0}
            tieBreakerScoreB={0}
            maxMainScore={draftMainCount * draftPoints}
            activeBuzzerSide={null}
            highlightSides={{ A: false, B: false }}
            reducedMotion={reducedMotion}
            skipEffects={skipEffects}
            lightweight2D={lightweight2D}
            onWebGLFallback={() => setLightweight2D(true)}
          />

          {setupError && (
            <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200 font-medium">
              {setupError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Play Style & Contestants (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. Play Style & Answer Mode */}
              <div className="rounded-xl border border-slate-800 bg-[#09162e] p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white mb-2">1. Hình thức tổ chức lớp (1–50 HS)</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'duel_2_sides', label: 'Song đấu 2 bên', desc: '2 HS hoặc 2 đại diện đội' },
                        { id: 'solo_single', label: 'Tự luyện 1 người', desc: '1 HS tự luyện (không tạo đối thủ ảo)' },
                        { id: 'solo_two_turns', label: 'Tự luyện 2 lượt', desc: '1 HS so điểm giữa Lượt 1 & Lượt 2' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setDraftPlayStyle(opt.id);
                          setSetupError(null);
                          if (opt.id !== 'duel_2_sides') {
                            setDraftAnswerMode('simultaneous');
                          }
                        }}
                        className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          draftPlayStyle === opt.id
                            ? 'border-cyan-400 bg-cyan-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {draftPlayStyle === 'duel_2_sides' && (
                  <div className="border-t border-slate-800 pt-3">
                    <h3 className="text-xs font-bold text-slate-200 mb-2">Chế độ trả lời</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftAnswerMode('simultaneous')}
                        className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          draftAnswerMode === 'simultaneous'
                            ? 'border-blue-400 bg-blue-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">Đối đáp đồng thời (Mặc định)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Hai bên ghi bảng con/giấy, chốt cùng lúc, cả hai đúng đều có điểm.
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraftAnswerMode('buzzer')}
                        className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          draftAnswerMode === 'buzzer'
                            ? 'border-amber-400 bg-amber-950/35 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">Giành quyền trả lời (Tùy chọn)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Giáo viên ghi nhận giơ tay/chuông hoặc phím chung; sai chuyển quyền 1 lần.
                        </div>
                      </button>
                    </div>

                    {draftAnswerMode === 'buzzer' && (
                      <div className="mt-2.5 rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 space-y-2">
                        <div className="text-[11px] font-semibold text-amber-200">
                          Cơ chế xác định quyền trả lời:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setDraftBuzzerSource('teacher_manual')}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                              draftBuzzerSource === 'teacher_manual'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Giáo viên bấm chọn người giơ tay/chuông
                          </button>
                          <button
                            type="button"
                            onClick={() => setDraftBuzzerSource('shared_keyboard')}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                              draftBuzzerSource === 'shared_keyboard'
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            Phím chung trên máy (Bên A: phím A · Bên B: phím L)
                          </button>
                        </div>
                        {draftBuzzerSource === 'shared_keyboard' && (
                          <p className="text-[11px] text-slate-400">
                            Lưu ý minh bạch: Ghi nhận theo thứ tự sự kiện trên bàn phím dùng chung,
                            không khẳng định đo tốc độ phản xạ ngoài lớp. Nếu hai phím bấm gần nhau,
                            giáo viên sẽ quyết định hoặc chọn “Không phân định — hỏi lại”.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Two Symmetrical Contestants + Class Picker (1-50 HS) */}
              <div className="rounded-xl border border-slate-800 bg-[#09162e] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-white">2. Chọn hai bên tham gia</h2>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftSideA({ ...D01_SAMPLE_PLAYER_PRESETS.sideA });
                        setDraftSideB({ ...D01_SAMPLE_PLAYER_PRESETS.sideB });
                        setSetupError(null);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                    >
                      2 HS mẫu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftSideA({ ...D01_SAMPLE_TEAM_PRESETS.sideA });
                        setDraftSideB({ ...D01_SAMPLE_TEAM_PRESETS.sideB });
                        setSetupError(null);
                      }}
                      className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                    >
                      2 Đội mẫu
                    </button>
                  </div>
                </div>

                <div
                  className={`grid gap-3 ${
                    draftPlayStyle === 'duel_2_sides' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {/* Side A Input */}
                  <div className="rounded-lg border border-blue-500/40 bg-blue-950/20 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-blue-300">Bên A · Xanh dương</span>
                      <span className="text-[11px] text-slate-400">
                        {draftSideA.studentId ? 'Từ danh sách lớp' : 'Nhãn tạm'}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={draftSideA.label}
                      onChange={(e) =>
                        setDraftSideA((prev) => ({
                          ...prev,
                          studentId: null,
                          label: e.target.value,
                          isTempLabel: true,
                        }))
                      }
                      placeholder="Nhập tên Bên A hoặc chọn từ lớp..."
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
                    />
                  </div>

                  {/* Side B Input */}
                  {draftPlayStyle === 'duel_2_sides' && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">Bên B · Cam vàng</span>
                        <span className="text-[11px] text-slate-400">
                          {draftSideB.studentId ? 'Từ danh sách lớp' : 'Nhãn tạm'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={draftSideB.label}
                        onChange={(e) =>
                          setDraftSideB((prev) => ({
                            ...prev,
                            studentId: null,
                            label: e.target.value,
                            isTempLabel: true,
                          }))
                        }
                        placeholder="Nhập tên Bên B hoặc chọn từ lớp..."
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  Nhãn nhập tay chỉ dùng tạm cho trận này, không tạo tài khoản hoặc hồ sơ thật.
                </p>

                {/* Reuse Smart EDU Class Roster (supports up to 50 students cleanly) */}
                {classes.length > 0 && (
                  <div className="border-t border-slate-800 pt-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-300" />
                        <select
                          value={activeClass?.id || ''}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                        >
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.students.length} HS)
                            </option>
                          ))}
                        </select>
                      </div>

                      {draftPlayStyle === 'duel_2_sides' && (
                        <button
                          type="button"
                          onClick={handlePickRandomPairFromClass}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 text-xs font-bold cursor-pointer"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>Chọn ngẫu nhiên 1 cặp</span>
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Tìm nhanh học sinh theo tên hoặc STT (hỗ trợ lớp đến 50 HS)..."
                        className="w-full rounded-lg bg-slate-900 border border-slate-700 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/60 divide-y divide-slate-800/70">
                      {filteredClassStudents.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          Không có học sinh khớp từ khóa tìm kiếm.
                        </div>
                      ) : (
                        filteredClassStudents.map((st) => {
                          const isA = draftSideA.studentId === st.id;
                          const isB =
                            draftPlayStyle === 'duel_2_sides' && draftSideB.studentId === st.id;
                          return (
                            <div
                              key={st.id}
                              className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-slate-900/70"
                            >
                              <div className="min-w-0 truncate text-slate-200">
                                <span className="font-mono text-slate-500 mr-2">
                                  {st.code || '—'}
                                </span>
                                <span className="font-medium">{st.fullName}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={isB}
                                  onClick={() => handleAssignStudent('A', st)}
                                  className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer disabled:opacity-35 ${
                                    isA
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-slate-800 hover:bg-blue-600/40 text-blue-200'
                                  }`}
                                >
                                  {isA ? 'Đang là A' : 'Chọn A'}
                                </button>
                                {draftPlayStyle === 'duel_2_sides' && (
                                  <button
                                    type="button"
                                    disabled={isA}
                                    onClick={() => handleAssignStudent('B', st)}
                                    className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer disabled:opacity-35 ${
                                      isB
                                        ? 'bg-amber-500 text-slate-950'
                                        : 'bg-slate-800 hover:bg-amber-500/40 text-amber-200'
                                    }`}
                                  >
                                    {isB ? 'Đang là B' : 'Chọn B'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Question Pack, Timing, Rules & Start CTA (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl border border-slate-800 bg-[#09162e] p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white mb-2">3. Bộ câu hỏi & Thông số</h2>
                  <div className="space-y-2">
                    {(
                      [
                        {
                          id: 'sample_math',
                          title: 'Toán THCS — Song đấu tính toán',
                          meta: `${D01_SAMPLE_BADGE} · 10 câu chính + 3 câu phụ`,
                        },
                        {
                          id: 'sample_info',
                          title: 'Tin học THCS — Song đấu thế giới số',
                          meta: `${D01_SAMPLE_BADGE} · 10 câu chính + 3 câu phụ`,
                        },
                        {
                          id: 'bank',
                          title: 'Ngân hàng câu hỏi Smart EDU',
                          meta: `Hiện có ${adaptedBank.length} câu hợp lệ theo quyền ${userRole}`,
                        },
                      ] as const
                    ).map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        onClick={() => {
                          setDraftSource(src.id);
                          setSetupError(null);
                          if (src.id === 'bank' && adaptedBank.length > 0 && adaptedBank.length < draftMainCount) {
                            setDraftMainCount(Math.min(draftMainCount, adaptedBank.length));
                          } else if (src.id !== 'bank' && draftMainCount > 10) {
                            setDraftMainCount(10);
                          }
                        }}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                          draftSource === src.id
                            ? 'border-cyan-400 bg-cyan-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">{src.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{src.meta}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Bộ dữ liệu mẫu dùng để chơi thử ngay, không ghi vào ngân hàng thật và không đại
                    diện toàn bộ chương trình.
                  </p>
                </div>

                {/* Shortage notice with quick reduce count */}
                {currentPools.main.length > 0 && currentPools.main.length < draftMainCount && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-2.5 text-xs text-amber-200 space-y-2">
                    <div>
                      Bộ này có {currentPools.main.length} câu chính hợp lệ (ít hơn {draftMainCount}{' '}
                      câu). Không tự lặp câu.
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraftMainCount(currentPools.main.length)}
                      className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold cursor-pointer"
                    >
                      Giảm xuống {currentPools.main.length} câu
                    </button>
                  </div>
                )}

                {/* Question Count, Timer, Points */}
                <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Số câu chính
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[5, 10, 15].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setDraftMainCount(n)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-bold font-mono tabular-nums cursor-pointer ${
                            draftMainCount === n
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      {![5, 10, 15].includes(draftMainCount) && (
                        <span className="px-2 py-1.5 rounded-md bg-cyan-500 text-slate-950 text-xs font-bold font-mono">
                          {draftMainCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Điểm mỗi câu
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={draftPoints}
                      onChange={(e) => setDraftPoints(Math.max(1, Number(e.target.value) || 10))}
                      className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Thời gian mỗi câu
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { val: 0, label: 'Không giới hạn' },
                      { val: 20, label: '20s' },
                      { val: 30, label: '30s' },
                      { val: 45, label: '45s' },
                      { val: 60, label: '60s' },
                    ].map((t) => (
                      <button
                        key={t.val}
                        type="button"
                        onClick={() => setDraftTimerSec(t.val)}
                        className={`px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                          draftTimerSec === t.val
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draftAnswerMode === 'buzzer' && draftPlayStyle === 'duel_2_sides' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Thời gian trả lời sau khi giành quyền (giây)
                    </label>
                    <div className="flex gap-1.5">
                      {[10, 15, 20, 30].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDraftBuzzerSec(s)}
                          className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono cursor-pointer ${
                            draftBuzzerSec === s
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tie-Breaker Config */}
                {draftPlayStyle !== 'solo_single' && (
                  <div className="border-t border-slate-800 pt-3 space-y-2">
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-xs font-semibold text-slate-200">
                        Bật Câu phụ khi hòa điểm vòng chính
                      </span>
                      <input
                        type="checkbox"
                        checked={draftTieBreaker}
                        onChange={(e) => setDraftTieBreaker(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400"
                      />
                    </label>
                    {draftTieBreaker && (
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>Số câu phụ tối đa (1–3):</span>
                        <div className="flex gap-1.5">
                          {[1, 2, 3].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setDraftMaxTb(n)}
                              className={`px-2.5 py-1 rounded text-xs font-bold font-mono cursor-pointer ${
                                draftMaxTb === n
                                  ? 'bg-cyan-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleStartMatch()}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-amber-500 hover:brightness-110 text-slate-950 font-extrabold text-sm tracking-wide transition-all cursor-pointer shadow-lg"
                >
                  Bắt đầu Song đấu
                </button>
              </div>

              {/* Archive of Completed Matches (preserved when swapping pairs!) */}
              {gameState.completedMatches.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-[#09162e] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
                    <History className="w-4 h-4" />
                    <span>Lịch sử các trận đã hoàn thành ({gameState.completedMatches.length})</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5">
                    {gameState.completedMatches.map((m) => (
                      <div
                        key={m.matchId}
                        className="rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2 font-bold text-white">
                          <span className="truncate">
                            {m.sideALabel} vs {m.sideBLabel}
                          </span>
                          <span className="font-mono tabular-nums text-cyan-300 shrink-0">
                            {m.mainScoreA} – {m.mainScoreB}
                            {m.tieBreakerPlayedCount > 0
                              ? ` (Phụ: ${m.tieBreakerScoreA}–${m.tieBreakerScoreB})`
                              : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center justify-between gap-2">
                          <span className="truncate">{m.outcomeLabel}</span>
                          <span className="shrink-0">{m.mainPlayedCount} câu</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PHASE 2: ACTIVE MATCH SCREEN                                        */}
      {/* =================================================================== */}
      {gameState.phase !== 'setup' && gameState.phase !== 'summary' && currentQuestion && (
        <div className="flex-1 flex flex-col p-3 sm:p-4 gap-3 max-w-[1440px] w-full mx-auto">
          {/* Progress Bar + Clock + Quick Stage Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#09162e] border border-slate-800 px-3.5 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs sm:text-sm font-extrabold text-cyan-200 whitespace-nowrap">
                {gameState.inTieBreaker
                  ? `Câu phụ ${gameState.currentQuestionIndex + 1} / ${gameState.tieBreakerDeck.length}`
                  : `Câu ${gameState.currentQuestionIndex + 1} / ${gameState.mainDeck.length}`}
              </span>
              <span className="text-xs text-slate-400 truncate hidden sm:inline">
                {currentQuestion.topic} · {currentQuestion.difficulty} · {currentQuestion.sourceBadge}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Single Deadline Clock Display */}
              {(gameState.phase === 'answering' || gameState.isPaused) &&
                (gameState.deadlineMs !== null || gameState.pausedRemainingMs !== null) && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono tabular-nums text-sm font-extrabold ${
                      remainingMs <= 5000 && !gameState.isPaused
                        ? 'bg-rose-600/30 text-rose-200 border border-rose-500/50'
                        : 'bg-slate-900 text-cyan-200 border border-cyan-500/30'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{formatSecondsCeil(remainingMs)}</span>
                  </div>
                )}

              {gameState.phase !== 'ready' && (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                >
                  {gameState.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{gameState.isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={readCurrentQuestionStem}
                disabled={isMuted || !voiceEnabled || gameState.isPaused}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-blue-200 cursor-pointer disabled:opacity-40"
              >
                Đọc đề
              </button>

              <button
                type="button"
                onClick={stopVoiceNow}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
              >
                Bỏ qua đọc
              </button>

              <button
                type="button"
                onClick={() => setSkipEffects((s) => !s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  skipEffects ? 'bg-amber-500/20 text-amber-200' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {skipEffects ? 'Đang tắt hiệu ứng' : 'Bỏ qua hoạt ảnh'}
              </button>
            </div>
          </div>

          {/* Progress Line */}
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-400 transition-all duration-300"
              style={{ width: `${Math.max(4, progressPct)}%` }}
            />
          </div>

          {/* Compact 3D / 2D Stage */}
          <Duel1v13DScene
            playStyle={gameState.config.playStyle}
            phase={gameState.phase}
            sideALabel={gameState.config.sideA.label}
            sideBLabel={sideBDisplayLabel}
            scoreA={scoreboard.mainScoreA}
            scoreB={scoreboard.mainScoreB}
            tieBreakerScoreA={scoreboard.tieBreakerScoreA}
            tieBreakerScoreB={scoreboard.tieBreakerScoreB}
            maxMainScore={maxMainScore}
            activeBuzzerSide={gameState.activeBuzzerSide}
            highlightSides={highlightSides}
            reducedMotion={reducedMotion}
            skipEffects={skipEffects}
            lightweight2D={lightweight2D}
            compact
            onWebGLFallback={() => setLightweight2D(true)}
          />

          {/* Main 3-Zone Projector Workspace: Left Side A | Center Question | Right Side B */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start flex-1">
            {/* Side A Column (Left on desktop, top-left on small screens) */}
            <div
              className={
                gameState.config.playStyle === 'solo_single'
                  ? 'lg:col-span-4 order-2 lg:order-1'
                  : 'lg:col-span-3 order-1'
              }
            >
              {renderSidePanel('A')}
            </div>

            {/* Central Question & Answer Board (Hero Focus!) */}
            <div
              className={
                gameState.config.playStyle === 'solo_single'
                  ? 'lg:col-span-8 order-1 lg:order-2'
                  : 'lg:col-span-6 order-3 lg:order-2'
              }
            >
              <div className="rounded-xl border border-cyan-500/30 bg-[#0a1731] p-4 sm:p-5 space-y-4">
                {gameState.isPaused ? (
                  <div className="py-14 text-center space-y-3">
                    <Pause className="w-10 h-10 text-amber-300 mx-auto" />
                    <h2 className="text-lg font-extrabold text-white">Trận đấu đang tạm dừng</h2>
                    <p className="text-sm text-slate-300 max-w-md mx-auto">
                      Câu hỏi được tạm ẩn và mọi thao tác chấm điểm/giành quyền đều đã khóa. Thời
                      gian còn lại ({formatSecondsCeil(remainingMs)}) được giữ nguyên.
                    </p>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                    >
                      Tiếp tục trận đấu
                    </button>
                  </div>
                ) : gameState.phase === 'ready' ? (
                  <div className="py-8 text-center space-y-4">
                    <div className="text-xs font-semibold text-cyan-300">
                      {gameState.inTieBreaker
                        ? `Vòng Câu phụ ${gameState.currentQuestionIndex + 1}/${gameState.tieBreakerDeck.length} · Đối đáp đồng thời`
                        : `Câu ${gameState.currentQuestionIndex + 1} / ${gameState.mainDeck.length} · ${currentQuestion.topic}`}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                      {gameState.inTieBreaker
                        ? 'Sẵn sàng vào Câu phụ phân định'
                        : `Sẵn sàng Câu ${gameState.currentQuestionIndex + 1}`}
                    </h2>
                    <p className="text-sm text-slate-300 max-w-lg mx-auto">
                      {isEffectiveSimultaneous
                        ? 'Hai bên chuẩn bị bảng con hoặc giấy ghi đáp án. Khi bấm Mở câu hỏi, đồng hồ sẽ bắt đầu chạy.'
                        : 'Chế độ Giành quyền trả lời: sau khi mở câu hỏi, bên nhận quyền trước sẽ có một cơ hội trả lời.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenQuestion}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 text-white font-extrabold text-sm cursor-pointer shadow-lg"
                    >
                      <Play className="w-4 h-4" />
                      <span>Mở câu hỏi</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Question Stem */}
                    <div className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                      <MathView content={currentQuestion.stemLatex} />
                    </div>

                    {/* Optional Question Image with graceful fallback */}
                    {currentQuestion.imageUrl && imageLoadErrorId !== currentQuestion.questionId && (
                      <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950 p-2 flex justify-center">
                        <img
                          src={currentQuestion.imageUrl}
                          alt={`Minh họa câu hỏi ${currentQuestion.topic}`}
                          referrerPolicy="no-referrer"
                          onError={() => setImageLoadErrorId(currentQuestion.questionId)}
                          className="max-h-56 w-auto object-contain rounded"
                        />
                      </div>
                    )}

                    {/* Options Grid (1 col mobile, 2 cols desktop — clear typography, zero overlap) */}
                    {currentQuestion.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {currentQuestion.options.map((opt) => {
                          const isCorrectOpt =
                            isAnswerRevealed && opt.optionId === currentQuestion.correctOptionId;
                          return (
                            <div
                              key={opt.optionId}
                              className={`rounded-xl border px-3.5 py-3 flex items-start gap-2.5 text-sm sm:text-base transition-colors ${
                                isCorrectOpt
                                  ? 'border-emerald-400 bg-emerald-950/50 text-white'
                                  : 'border-slate-700/80 bg-slate-900/75 text-slate-100'
                              }`}
                            >
                              <span
                                className={`font-extrabold shrink-0 ${
                                  isCorrectOpt ? 'text-emerald-300' : 'text-cyan-300'
                                }`}
                              >
                                {opt.label}.
                              </span>
                              <div className="min-w-0 break-words leading-snug">
                                <MathView content={opt.textLatex} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Near-Tie Resolution Banner (Shared Keyboard Buzzer) */}
                    {gameState.nearTiePending && gameState.phase === 'buzzer_open' && (
                      <div className="rounded-xl border border-amber-400/60 bg-amber-950/40 p-3.5 space-y-2.5">
                        <div className="text-xs font-bold text-amber-200">
                          Hai phím đến gần nhau trên thiết bị chung — Giáo viên phân định:
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setGameState((prev) => teacherOverrideBuzzerSide(prev, 'A'))
                            }
                            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
                          >
                            Trao quyền Bên A
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGameState((prev) => teacherOverrideBuzzerSide(prev, 'B'))
                            }
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 cursor-pointer"
                          >
                            Trao quyền Bên B
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGameState((prev) => teacherOverrideBuzzerSide(prev, null))
                            }
                            className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-bold text-white cursor-pointer"
                          >
                            Không phân định — hỏi lại
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Official Answer & Explanation (ONLY shown after both sides locked/scored!) */}
                    {isAnswerRevealed && (
                      <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Đáp án chuẩn:</span>
                          <span className="text-white text-sm">
                            <MathView content={currentQuestion.answerLatex} />
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                          <span className="font-semibold text-cyan-200 mr-1">Giải thích:</span>
                          <MathView content={currentQuestion.explanationLatex} />
                        </div>
                      </div>
                    )}

                    {/* Status Line */}
                    {gameState.statusMessage && (
                      <div className="text-xs text-cyan-200/90 border-t border-white/10 pt-2.5">
                        {gameState.statusMessage}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Side B Column (Right on desktop, top-right on small screens) */}
            {gameState.config.playStyle !== 'solo_single' && (
              <div className="lg:col-span-3 order-2 lg:order-3">
                {renderSidePanel('B')}
              </div>
            )}
          </div>

          {/* BOTTOM TEACHER CONTROL DOCK */}
          <div className="rounded-xl border border-slate-800 bg-[#08152e] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Secondary Teacher Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {gameState.phase === 'confirmed' && !gameState.editingLastConfirmed && (
                <button
                  type="button"
                  onClick={() => setGameState((prev) => startEditingLastConfirmedRound(prev))}
                  disabled={gameState.isPaused}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-200 cursor-pointer disabled:opacity-40"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa kết quả câu vừa rồi</span>
                </button>
              )}

              {gameState.history.length > 0 && gameState.phase !== 'confirmed' && (
                <button
                  type="button"
                  onClick={() => setShowRollbackConfirm(true)}
                  disabled={gameState.isPaused}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer disabled:opacity-40"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Quay lại câu trước</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowEarlyEndConfirm(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-xs font-semibold text-rose-200 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Kết thúc sớm</span>
              </button>
            </div>

            {/* Primary Teacher Workflow Action */}
            <div className="flex flex-wrap items-center gap-2">
              {isEffectiveSimultaneous && gameState.phase === 'answering' && !gameState.isPaused && (
                <button
                  type="button"
                  onClick={handleLockSimultaneous}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                >
                  <span>Dừng trả lời & Chốt đáp án</span>
                </button>
              )}

              {isEffectiveSimultaneous && gameState.phase === 'locked' && !gameState.isPaused && (
                <>
                  {!gameState.bothSidesLockedConfirmed ? (
                    <button
                      type="button"
                      onClick={() => setGameState((prev) => confirmBothSidesLocked(prev))}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm cursor-pointer"
                    >
                      Xác nhận hai bên đã chốt đáp án
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRevealAndScore}
                      disabled={!areRequiredSidesMarked(gameState)}
                      className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Công bố và chấm
                    </button>
                  )}
                </>
              )}

              {!isEffectiveSimultaneous && gameState.phase === 'buzzer_open' && !gameState.isPaused && (
                <>
                  {gameState.activeBuzzerSide && !gameState.nearTiePending && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setGameState((prev) => teacherOverrideBuzzerSide(prev, null))
                        }
                        className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        Đổi / Mở lại quyền
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const now = Date.now();
                          setNowTickMs(now);
                          setGameState((prev) => startBuzzerResponsePhase(prev, now));
                        }}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                      >
                        <Zap className="w-4 h-4" />
                        <span>Bắt đầu tính giờ trả lời</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setGameState((prev) => skipBuzzerNoClaim(prev))}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                  >
                    Không bên nào giành quyền
                  </button>
                </>
              )}

              {(gameState.phase === 'scoring' ||
                (gameState.phase === 'confirmed' && gameState.editingLastConfirmed)) &&
                !gameState.isPaused && (
                  <button
                    type="button"
                    onClick={handleConfirmRound}
                    disabled={!areRequiredSidesMarked(gameState)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {gameState.editingLastConfirmed ? 'Lưu kết quả đã sửa' : 'Xác nhận kết quả'}
                    </span>
                  </button>
                )}

              {gameState.phase === 'confirmed' &&
                !gameState.editingLastConfirmed &&
                !gameState.isPaused && (
                  <button
                    type="button"
                    onClick={handleAdvanceNext}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:brightness-110 text-white font-extrabold text-sm cursor-pointer"
                  >
                    <span>
                      {gameState.inTieBreaker
                        ? 'Tiếp tục / Tổng kết'
                        : gameState.currentQuestionIndex + 1 < gameState.mainDeck.length
                          ? 'Câu tiếp theo'
                          : 'Hoàn tất vòng chính'}
                    </span>
                    <FastForward className="w-4 h-4" />
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PHASE 3: SUMMARY & KNOWLEDGE REVIEW SCREEN                          */}
      {/* =================================================================== */}
      {gameState.phase === 'summary' && (
        <div className="p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-5">
          {/* Celebratory 3D Trophy Stage */}
          <Duel1v13DScene
            playStyle={gameState.config.playStyle}
            phase="summary"
            sideALabel={gameState.config.sideA.label}
            sideBLabel={sideBDisplayLabel}
            scoreA={scoreboard.mainScoreA}
            scoreB={scoreboard.mainScoreB}
            tieBreakerScoreA={scoreboard.tieBreakerScoreA}
            tieBreakerScoreB={scoreboard.tieBreakerScoreB}
            maxMainScore={maxMainScore}
            activeBuzzerSide={null}
            highlightSides={{
              A:
                scoreboard.outcome === 'A_wins' ||
                scoreboard.outcome === 'A_wins_tiebreaker' ||
                scoreboard.outcome === 'tie',
              B:
                scoreboard.outcome === 'B_wins' ||
                scoreboard.outcome === 'B_wins_tiebreaker' ||
                scoreboard.outcome === 'tie',
            }}
            reducedMotion={reducedMotion}
            skipEffects={skipEffects}
            lightweight2D={lightweight2D}
            onWebGLFallback={() => setLightweight2D(true)}
          />

          {/* Outcome Headline Card */}
          <div className="rounded-xl border border-amber-400/40 bg-gradient-to-r from-[#0a1a38] via-[#0e2144] to-[#0a1a38] p-5 text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-amber-300 text-xs font-bold">
              <Award className="w-4 h-4" />
              <span>
                {gameState.endedEarly ? 'TRẬN KẾT THÚC SỚM' : 'TỔNG KẾT SONG ĐẤU TRI THỨC'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {scoreboard.outcomeLabel}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Chế độ:{' '}
              {gameState.config.answerMode === 'simultaneous'
                ? 'Đối đáp đồng thời'
                : 'Giành quyền trả lời'}{' '}
              · Đã chơi {scoreboard.mainPlayedCount}/{gameState.mainDeck.length} câu chính
              {scoreboard.tieBreakerPlayedCount > 0
                ? ` · ${scoreboard.tieBreakerPlayedCount} câu phụ`
                : ''}
            </p>
          </div>

          {/* Symmetrical Side-by-Side Breakdown */}
          <div
            className={`grid gap-4 ${
              gameState.config.playStyle === 'solo_single'
                ? 'grid-cols-1 max-w-md mx-auto'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            <div className="rounded-xl border border-blue-500/40 bg-[#091731] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold text-blue-300">Bên A · Xanh dương</div>
                  <div className="text-lg font-extrabold text-white break-words">
                    {gameState.config.sideA.label}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-3xl font-extrabold text-white">{scoreboard.mainScoreA}</div>
                  <div className="text-[11px] text-slate-400">điểm vòng chính</div>
                </div>
              </div>
              {scoreboard.tieBreakerPlayedCount > 0 && (
                <div className="text-xs font-bold text-cyan-300 font-mono tabular-nums">
                  Điểm câu phụ (tách riêng): +{scoreboard.tieBreakerScoreA} điểm
                </div>
              )}
              <div className="border-t border-white/10 pt-2 text-xs text-slate-300 flex items-center gap-4 font-mono tabular-nums">
                <span className="text-emerald-300">Đúng: {scoreboard.statsA.correct}</span>
                <span className="text-rose-300">Chưa đúng: {scoreboard.statsA.wrong}</span>
                <span className="text-slate-400">Không TL: {scoreboard.statsA.noAnswer}</span>
              </div>
            </div>

            {gameState.config.playStyle !== 'solo_single' && (
              <div className="rounded-xl border border-amber-500/40 bg-[#091731] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-amber-300">Bên B · Cam vàng</div>
                    <div className="text-lg font-extrabold text-white break-words">
                      {sideBDisplayLabel}
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-3xl font-extrabold text-white">{scoreboard.mainScoreB}</div>
                    <div className="text-[11px] text-slate-400">điểm vòng chính</div>
                  </div>
                </div>
                {scoreboard.tieBreakerPlayedCount > 0 && (
                  <div className="text-xs font-bold text-amber-300 font-mono tabular-nums">
                    Điểm câu phụ (tách riêng): +{scoreboard.tieBreakerScoreB} điểm
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 text-xs text-slate-300 flex items-center gap-4 font-mono tabular-nums">
                  <span className="text-emerald-300">Đúng: {scoreboard.statsB.correct}</span>
                  <span className="text-rose-300">Chưa đúng: {scoreboard.statsB.wrong}</span>
                  <span className="text-slate-400">Không TL: {scoreboard.statsB.noAnswer}</span>
                </div>
              </div>
            )}
          </div>

          {/* Summary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleRematch}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tái đấu (giữ tên hai bên)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBackToSetup(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-extrabold cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Đổi cặp</span>
            </button>
            <button
              type="button"
              onClick={() => handleBackToSetup(false)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Chọn bộ khác</span>
            </button>
            <button
              type="button"
              onClick={handleExitToLibrary}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về thư viện</span>
            </button>
          </div>

          {/* Knowledge Review Section */}
          <div className="rounded-xl border border-slate-800 bg-[#09162e] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span>Xem lại kiến thức & Nội dung cần ôn lại</span>
              </h3>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    reviewFilter === 'all' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  Tất cả ({gameState.history.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('review')}
                  className={`px-3 py-1 rounded-md text-xs font-bold cursor-pointer ${
                    reviewFilter === 'review' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                  }`}
                >
                  Cần ôn lại
                </button>
              </div>
            </div>

            {(() => {
              const items = gameState.history.filter((rec) => {
                if (reviewFilter === 'all') return true;
                const aMissed = rec.outcomes.A.mark !== 'correct';
                const bMissed =
                  gameState.config.playStyle !== 'solo_single' && rec.outcomes.B.mark !== 'correct';
                return aMissed || bMissed;
              });

              if (items.length === 0) {
                return (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    {gameState.history.length === 0
                      ? 'Chưa có câu nào được xác nhận trong trận này.'
                      : 'Tuyệt vời! Không có câu nào bị sai hoặc bỏ trống.'}
                  </p>
                );
              }

              return (
                <div className="space-y-2.5">
                  {items.map((rec) => (
                    <div
                      key={rec.turnToken}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 p-3.5 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-cyan-300">
                          {rec.isTieBreaker ? `Câu phụ ${rec.roundIndex}` : `Câu ${rec.roundIndex}`} ·{' '}
                          {rec.topic}
                          {rec.editCount > 0 ? ` (Đã chỉnh sửa ${rec.editCount} lần)` : ''}
                        </span>
                        <div className="flex items-center gap-3 font-mono tabular-nums">
                          <span className="text-blue-300">
                            A: {MARK_LABELS[rec.outcomes.A.mark]} (+{rec.outcomes.A.pointsAwarded}đ)
                          </span>
                          {gameState.config.playStyle !== 'solo_single' && (
                            <span className="text-amber-300">
                              B: {MARK_LABELS[rec.outcomes.B.mark]} (+{rec.outcomes.B.pointsAwarded}đ)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        <MathView content={rec.stemLatex} />
                      </div>
                      <div className="text-xs text-emerald-300">
                        <span className="font-bold mr-1">Đáp án chuẩn:</span>
                        <MathView content={rec.answerLatex} />
                      </div>
                      <div className="text-xs text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-200 mr-1">Giải thích:</span>
                        <MathView content={rec.explanationLatex} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODALS: RULES / ROLLBACK CONFIRM / EARLY END CONFIRM                */}
      {/* =================================================================== */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-[#0a1731] border border-cyan-500/30 p-5 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">
                Luật chơi D01 — Đấu trường 1 đấu 1
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-slate-300 list-disc pl-5">
              <li>
                <strong className="text-white">Đối đáp đồng thời (Mặc định):</strong> Hai bên ghi
                đáp án trên bảng con/giấy, chốt trước khi công bố. Mỗi bên trả lời đúng đều nhận
                trọn điểm câu (mặc định +10đ, không trừ điểm, không thưởng tốc độ).
              </li>
              <li>
                <strong className="text-white">Giành quyền trả lời (Tùy chọn):</strong> Bên nhận
                quyền có 1 lần trả lời. Đúng nhận điểm câu; sai hoặc hết giờ chuyển quyền 1 lần cho
                bên còn lại (không tự cộng điểm cho đối thủ nếu đối thủ chưa trả lời đúng).
              </li>
              <li>
                <strong className="text-white">Câu phụ (Tùy chọn 1–3 câu):</strong> Mở khi hòa điểm
                vòng chính, thi theo thể thức đồng thời. Điểm câu phụ hiển thị tách riêng, không
                làm thay đổi điểm vòng chính. Hết giới hạn vẫn hòa thì ghi nhận Đồng thắng.
              </li>
            </ul>
            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {showRollbackConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#0a1731] border border-amber-500/40 p-5 space-y-3">
            <h3 className="text-base font-extrabold text-amber-200">
              Xác nhận quay lại câu trước?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Thao tác này sẽ khôi phục lại lượt đã xác nhận gần nhất để giáo viên chấm lại; trạng
              thái của câu hiện tại sẽ bị hủy và tổng điểm được tính lại hoàn toàn từ lịch sử.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRollbackConfirm(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRollbackConfirm(false);
                  setGameState((prev) => rollbackToPreviousRound(prev, true).state);
                }}
                className="px-3.5 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-extrabold cursor-pointer"
              >
                Xác nhận quay lại
              </button>
            </div>
          </div>
        </div>
      )}

      {showEarlyEndConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#0a1731] border border-rose-500/40 p-5 space-y-3">
            <h3 className="text-base font-extrabold text-rose-200">
              Kết thúc trận đấu sớm?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Hệ thống sẽ ghi nhận trạng thái “Trận kết thúc sớm” với đúng số câu đã chơi. Các câu
              chưa chơi sẽ không bị tính sai.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEarlyEndConfirm(false)}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Tiếp tục chơi
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEarlyEndConfirm(false);
                  setGameState((prev) => endDuelMatchEarly(prev));
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold cursor-pointer"
              >
                Kết thúc sớm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Duel1v13DGame;
