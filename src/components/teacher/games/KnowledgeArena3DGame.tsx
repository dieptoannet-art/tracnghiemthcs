import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FastForward,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Maximize2,
  Minimize2,
  MinusCircle,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
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
import imgC03Cover from '../../../assets/images/game_c03_knowledge_arena_3d_1795347421617.jpg';
import {
  C03GameState,
  C03GraphicsQuality,
  C03ParticipationMode,
  C03QuestionSource,
  C03SetupConfig,
  C03TeamOutcomeStatus,
  C03_MAX_MAIN_SCORE,
  C03_ROUND_POINTS,
  C03_SAMPLE_BADGE,
  C03_TOTAL_MAIN_QUESTIONS,
  adaptBankQuestionsForC03,
  advanceC03NextQuestion,
  canAdvanceFromC03Question,
  clearC03Session,
  computeC03Summary,
  createC03SetupState,
  createDefaultC03SetupConfig,
  finishC03ToSummary,
  getC03RoundPoints,
  gradeC03TeamAnswer,
  gradeC03TiebreakerTeam,
  holdC03TeamWhiteboard,
  commitAllC03HeldWhiteboards,
  loadC03Session,
  revealC03Hint,
  revealC03Solution,
  saveC03Session,
  skipC03RevealAnimation,
  startC03Arena,
} from './knowledgeArena3dEngine';
import { KnowledgeArena3DScene } from './KnowledgeArena3DScene';

export interface KnowledgeArena3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

function stripMathForSpeech(input: string): string {
  return input
    .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'căn bậc hai của $1')
    .replace(/\^\\circ/g, ' độ')
    .replace(/\^2/g, ' bình phương')
    .replace(/\^3/g, ' lập phương')
    .replace(/\\times|\\cdot/g, ' nhân ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatOutcomeBadge(status: C03TeamOutcomeStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'submitted':
      return {
        label: 'Đã nộp (chờ chốt)',
        className: 'bg-sky-500/20 border-sky-400/60 text-sky-200',
      };
    case 'correct_independent':
      return {
        label: 'Đúng tự làm',
        className: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200',
      };
    case 'correct_with_hint':
      return {
        label: 'Đúng có hỗ trợ',
        className: 'bg-amber-500/20 border-amber-400/60 text-amber-200',
      };
    case 'wrong':
      return {
        label: 'Chưa đúng (0đ)',
        className: 'bg-rose-500/20 border-rose-400/60 text-rose-200',
      };
    case 'wrong_viewed_solution':
      return {
        label: 'Đã xem lời giải (0đ)',
        className: 'bg-purple-500/20 border-purple-400/60 text-purple-200',
      };
    case 'skipped':
      return {
        label: 'Bỏ qua (0đ)',
        className: 'bg-slate-600/30 border-slate-500/60 text-slate-300',
      };
    default:
      return {
        label: 'Chưa chấm',
        className: 'bg-slate-800/80 border-slate-600 text-slate-300',
      };
  }
}

export const KnowledgeArena3DGame: React.FC<KnowledgeArena3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const [setupConfig, setSetupConfig] = useState<C03SetupConfig>(() =>
    createDefaultC03SetupConfig()
  );
  const [gameState, setGameState] = useState<C03GameState>(() =>
    createC03SetupState()
  );
  const [restoredBanner, setRestoredBanner] = useState<boolean>(false);
  const [setupError, setSetupError] = useState<string>('');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [showReviewAccordion, setShowReviewAccordion] = useState<boolean>(false);

  const [quality, setQuality] = useState<C03GraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() =>
    loadEduGameVoiceEnabled()
  );
  const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);

  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  // Restore saved session cleanly on mount
  useEffect(() => {
    const saved = loadC03Session();
    if (saved && saved.phase !== 'setup' && saved.deck.length === C03_TOTAL_MAIN_QUESTIONS) {
      setGameState(saved);
      setSetupConfig(saved.config);
      setRestoredBanner(true);
    }
  }, []);

  // Persist active game session
  useEffect(() => {
    if (gameState.phase !== 'setup') {
      saveC03Session(gameState);
    }
  }, [gameState]);

  // Dispose audio & voice cleanly on unmount
  useEffect(() => {
    return () => {
      soundBankRef.current?.stopAll();
      soundBankRef.current?.dispose();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Sync turnToken with SoundBank
  useEffect(() => {
    soundBankRef.current?.setActiveTurnToken(gameState.turnToken);
  }, [gameState.turnToken]);

  const cancelPendingAudioAndSpeech = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const adaptedBankCount = useMemo(
    () => adaptBankQuestionsForC03(bankQuestions, userRole).length,
    [bankQuestions, userRole]
  );

  const currentQuestionProgress = useMemo(
    () => gameState.deck[gameState.currentQuestionIndex] ?? null,
    [gameState.deck, gameState.currentQuestionIndex]
  );

  const activeTeam =
    gameState.teams[gameState.activeTeamCursor] ?? gameState.teams[0] ?? null;

  const canAdvance = useMemo(
    () => canAdvanceFromC03Question(gameState),
    [gameState]
  );

  const summaryStats = useMemo(
    () => computeC03Summary(gameState),
    [gameState]
  );

  const handleToggleMute = useCallback(() => {
    setHasUserInteracted(true);
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        cancelPendingAudioAndSpeech();
      }
      return next;
    });
  }, [cancelPendingAudioAndSpeech]);

  const handleToggleVoice = useCallback(() => {
    setHasUserInteracted(true);
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

  const speakVietnamese = useCallback(
    (text: string) => {
      if (!hasUserInteracted || isMuted || !voiceEnabled) return;
      voiceRef.current?.replayText({
        text: stripMathForSpeech(text),
        isMuted,
        voiceEnabled,
      });
    },
    [hasUserInteracted, isMuted, voiceEnabled]
  );

  const handleSelectClass = useCallback(
    (classId: string) => {
      const found = classes.find((c) => c.id === classId);
      const mappedStudents = found
        ? found.students.slice(0, 50).map((s) => ({
            id: s.id,
            fullName: s.fullName,
          }))
        : [];
      setSetupConfig((prev) => ({
        ...prev,
        selectedClassId: classId,
        classStudents: mappedStudents,
      }));
    },
    [classes]
  );

  const handleStartArena = useCallback(() => {
    setHasUserInteracted(true);
    cancelPendingAudioAndSpeech();
    setSetupError('');
    setRestoredBanner(false);

    const res = startC03Arena({
      config: setupConfig,
      bankQuestions,
      userRole,
    });
    if (!res.ok || !res.state) {
      setSetupError(res.error || 'Không thể khởi tạo Đấu trường kiến thức.');
      return;
    }

    const nextState = res.state;
    setGameState(nextState);
    soundBankRef.current?.setActiveTurnToken(nextState.turnToken);
    soundBankRef.current?.playC03OpenQuestion(isMuted, nextState.turnToken);
    const firstQ = nextState.deck[0]?.question;
    if (firstQ) {
      speakVietnamese(`Vòng 1, câu 1, 10 điểm. ${firstQ.stem}`);
    }
  }, [
    bankQuestions,
    cancelPendingAudioAndSpeech,
    isMuted,
    setupConfig,
    speakVietnamese,
    userRole,
  ]);

  const handleOptionAction = useCallback(
    (optionId: string) => {
      if (!activeTeam) return;
      setHasUserInteracted(true);
      if (gameState.phase !== 'playing' && gameState.phase !== 'question_revealed') {
        return;
      }

      if (gameState.config.whiteboardHoldMode && gameState.phase === 'playing') {
        const currentSub =
          currentQuestionProgress?.submissions[activeTeam.id];
        if (currentSub && !currentSub.graded) {
          setGameState((prev) =>
            holdC03TeamWhiteboard({
              state: prev,
              teamId: activeTeam.id,
              optionId,
            })
          );
          soundBankRef.current?.playC03LockAnswer(
            isMuted,
            true,
            gameState.turnToken
          );
          return;
        }
      }

      const nextState = gradeC03TeamAnswer({
        state: gameState,
        turnToken: gameState.turnToken,
        teamId: activeTeam.id,
        optionId,
      });
      setGameState(nextState);

      const gradedSub =
        nextState.deck[nextState.currentQuestionIndex]?.submissions[activeTeam.id];
      if (gradedSub?.graded) {
        soundBankRef.current?.playC03LockAnswer(
          isMuted,
          gradedSub.pointsAwarded > 0,
          nextState.turnToken
        );
      }
    },
    [activeTeam, currentQuestionProgress, gameState, isMuted]
  );

  const handleTeacherDirectGrade = useCallback(
    (teamId: string, mode: 'correct' | 'wrong' | 'skip') => {
      setHasUserInteracted(true);
      const nextState = gradeC03TeamAnswer({
        state: gameState,
        turnToken: gameState.turnToken,
        teamId,
        skip: mode === 'skip',
        teacherConfirmCorrect: mode === 'skip' ? undefined : mode === 'correct',
      });
      setGameState(nextState);
      if (mode !== 'skip') {
        soundBankRef.current?.playC03LockAnswer(
          isMuted,
          mode === 'correct',
          nextState.turnToken
        );
      }
    },
    [gameState, isMuted]
  );

  const handleCommitWhiteboards = useCallback(() => {
    setHasUserInteracted(true);
    const nextState = commitAllC03HeldWhiteboards(
      gameState,
      gameState.turnToken
    );
    setGameState(nextState);
    soundBankRef.current?.playC03LockAnswer(
      isMuted,
      true,
      nextState.turnToken
    );
  }, [gameState, isMuted]);

  const handleRevealHint = useCallback(() => {
    setHasUserInteracted(true);
    setGameState((prev) => revealC03Hint(prev));
  }, []);

  const handleRevealSolution = useCallback(() => {
    setHasUserInteracted(true);
    setGameState((prev) => revealC03Solution(prev));
  }, []);

  const handleSkipRevealAnimation = useCallback(() => {
    setHasUserInteracted(true);
    setGameState((prev) => skipC03RevealAnimation(prev));
  }, []);

  const handleAdvanceNext = useCallback(() => {
    setHasUserInteracted(true);
    // Cancel any round celebration / previous cue immediately BEFORE advancing to next question
    cancelPendingAudioAndSpeech();

    const nextState = advanceC03NextQuestion(gameState);
    setGameState(nextState);
    soundBankRef.current?.setActiveTurnToken(nextState.turnToken);

    if (nextState.phase === 'round_summary') {
      soundBankRef.current?.playC03RoundTransition(
        isMuted,
        nextState.currentRoundIndex + 1,
        nextState.turnToken
      );
    } else if (nextState.phase === 'summary') {
      soundBankRef.current?.playC03RoundTransition(
        isMuted,
        3,
        nextState.turnToken
      );
    } else if (nextState.phase === 'playing') {
      const qProg = nextState.deck[nextState.currentQuestionIndex];
      soundBankRef.current?.playC03OpenQuestion(isMuted, nextState.turnToken);
      if (qProg) {
        const pts = getC03RoundPoints(nextState.currentRoundIndex);
        speakVietnamese(
          `Vòng ${nextState.currentRoundIndex + 1}, câu ${qProg.questionInRoundIndex + 1}, ${pts} điểm. ${qProg.question.stem}`
        );
      }
    }
  }, [cancelPendingAudioAndSpeech, gameState, isMuted, speakVietnamese]);

  const handleSelectTeamFromStage = useCallback(
    (teamId: string) => {
      const idx = gameState.teams.findIndex((t) => t.id === teamId);
      if (idx >= 0) {
        setGameState((prev) => ({ ...prev, activeTeamCursor: idx }));
      }
    },
    [gameState.teams]
  );

  const handleResetToSetup = useCallback(() => {
    cancelPendingAudioAndSpeech();
    clearC03Session();
    setRestoredBanner(false);
    setGameState(createC03SetupState(setupConfig));
  }, [cancelPendingAudioAndSpeech, setupConfig]);

  const handleExitToLibrary = useCallback(() => {
    cancelPendingAudioAndSpeech();
    onBackToLibrary();
  }, [cancelPendingAudioAndSpeech, onBackToLibrary]);

  // Global keyboard shortcuts with visible focus indicator & input guard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showGuideModal) {
        if (e.key === 'Escape') setShowGuideModal(false);
        return;
      }
      if (gameState.phase === 'setup' || gameState.phase === 'summary') return;

      const lower = e.key.toLowerCase();
      if (lower === 'm') {
        e.preventDefault();
        handleToggleMute();
        return;
      }
      if (lower === 's') {
        e.preventDefault();
        handleSkipRevealAnimation();
        return;
      }
      if (lower === 'h' && gameState.phase === 'playing') {
        e.preventDefault();
        handleRevealHint();
        return;
      }
      if (e.key === 'Tab' && gameState.teams.length > 1) {
        e.preventDefault();
        setGameState((prev) => ({
          ...prev,
          activeTeamCursor: (prev.activeTeamCursor + 1) % prev.teams.length,
        }));
        return;
      }

      if (
        (e.key === 'Enter' || e.key === 'ArrowRight') &&
        (gameState.phase === 'round_summary' || canAdvance)
      ) {
        e.preventDefault();
        handleAdvanceNext();
        return;
      }

      if (gameState.phase === 'playing' && currentQuestionProgress) {
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        if (lower in keyMap) {
          const opt = currentQuestionProgress.question.options[keyMap[lower]];
          if (opt) {
            e.preventDefault();
            handleOptionAction(opt.optionId);
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canAdvance,
    currentQuestionProgress,
    gameState.phase,
    gameState.teams.length,
    handleAdvanceNext,
    handleOptionAction,
    handleRevealHint,
    handleSkipRevealAnimation,
    handleToggleMute,
    showGuideModal,
  ]);

  const currentRoundPts = getC03RoundPoints(gameState.currentRoundIndex);
  const roundBannerColor =
    gameState.currentRoundIndex === 0
      ? 'text-sky-300 border-sky-500/50 bg-sky-950/60'
      : gameState.currentRoundIndex === 1
        ? 'text-amber-300 border-amber-500/50 bg-amber-950/60'
        : 'text-emerald-300 border-emerald-500/50 bg-emerald-950/60';

  const outerShellClass = isFullscreen
    ? 'w-full h-full flex flex-col bg-[#050C1C] text-slate-100 overflow-hidden'
    : 'w-full rounded-2xl bg-[#050C1C] border border-slate-800 text-slate-100 overflow-hidden shadow-xl flex flex-col';

  return (
    <div className={outerShellClass}>
      {/* Top Header Bar */}
      <header className="px-3 sm:px-4 py-2.5 bg-[#08132B] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thư viện</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[11px] font-extrabold">
                C03
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                Đấu trường kiến thức
              </h2>
              <span className="px-2 py-0.5 rounded border border-sky-500/40 bg-sky-500/15 text-[11px] font-semibold text-sky-200">
                {gameState.config.questionSource === 'sample_pack'
                  ? C03_SAMPLE_BADGE
                  : 'Ngân hàng Smart EDU'}
              </span>
            </div>
          </div>
        </div>

        {/* Utility Controls */}
        <div className="flex items-center flex-wrap gap-1.5">
          {gameState.phase !== 'setup' && (
            <span
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold tabular-nums ${roundBannerColor}`}
            >
              Vòng {gameState.currentRoundIndex + 1}/3 · Câu{' '}
              {(currentQuestionProgress?.questionInRoundIndex ?? 0) + 1}/4 ·{' '}
              {currentRoundPts}đ/câu
            </span>
          )}

          <button
            type="button"
            onClick={() => setQuality((q) => (q === 'high' ? '2d' : 'high'))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title="Chuyển đổi 3D / 2D nhẹ"
          >
            {quality === 'high' ? '3D Sân khấu' : '2D Nhẹ'}
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              reducedMotion
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {reducedMotion ? 'Giảm chuyển động: Bật' : 'Giảm chuyển động'}
          </button>

          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title="Tắt/Mở âm thanh (M)"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden md:inline">{isMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              voiceEnabled && !isMuted
                ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            Giọng đọc
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title="Toàn màn hình"
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </header>

      {/* Restored Session Banner */}
      {restoredBanner && (
        <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
          <span>
            Đã khôi phục phiên Đấu trường 3 Vòng trước đó (Vòng{' '}
            {gameState.currentRoundIndex + 1}, câu {gameState.currentQuestionIndex + 1}
            /12).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRestoredBanner(false)}
              className="px-2.5 py-1 rounded bg-amber-400 text-slate-950 font-bold cursor-pointer"
            >
              Tiếp tục
            </button>
            <button
              type="button"
              onClick={handleResetToSetup}
              className="px-2.5 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 font-semibold cursor-pointer"
            >
              Bắt đầu trận mới
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PHASE 1: SETUP SCREEN                                               */}
      {/* =================================================================== */}
      {gameState.phase === 'setup' && (
        <div className="p-4 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Hero & Rules Overview */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-2xl overflow-hidden border border-slate-700/80 bg-[#08132B]">
              <div className="aspect-video w-full overflow-hidden bg-slate-900">
                <img
                  src={imgC03Cover}
                  alt="Đấu trường kiến thức 3D Tây Đô Smart EDU"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-amber-300">
                    Luật Đấu trường Ba Vòng 3D
                  </h3>
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    Tối đa 240đ
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {([0, 1, 2] as const).map((r) => (
                    <div
                      key={r}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-700"
                    >
                      <div className="font-bold text-white">Vòng {r + 1}</div>
                      <div className="text-amber-300 font-mono font-bold">
                        4 câu × {C03_ROUND_POINTS[r]}đ
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {r === 0
                          ? 'Nhận biết (40đ)'
                          : r === 1
                            ? 'Thông hiểu (80đ)'
                            : 'Vận dụng (120đ)'}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Tất cả đội giải cùng một câu hỏi mỗi lượt. Mỗi cặp (đội, câu) chỉ được
                  cộng điểm tối đa một lần. Nút chuyển câu chỉ mở khi tất cả đội đã chấm
                  hoặc được xác nhận bỏ qua.
                </p>
              </div>
            </div>
          </div>

          {/* Right Setup Form */}
          <div className="lg:col-span-7 bg-[#08132B] rounded-2xl border border-slate-700/80 p-4 sm:p-5 space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Thiết lập trận Đấu trường C03
            </h3>

            {/* Participation Mode */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                1. Chế độ thi đấu
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      key: 'teams',
                      title: 'Đấu đội (2–6 đội · Lớp 1–50 HS)',
                      desc: 'Trình chiếu cả lớp, mỗi đội có cột điểm riêng và chốt câu trước khi sang câu mới.',
                      icon: Users,
                    },
                    {
                      key: 'solo',
                      title: 'Tự luyện cá nhân (1 thí sinh)',
                      desc: 'Giải đủ 3 vòng 12 câu với thang điểm 10 / 20 / 30đ và lời giải từng bước.',
                      icon: UserCheck,
                    },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = setupConfig.participationMode === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setSetupConfig((prev) => ({
                          ...prev,
                          participationMode: item.key as C03ParticipationMode,
                        }))
                      }
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                        active
                          ? 'bg-amber-500/15 border-amber-400 text-white'
                          : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                        <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-300">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team count, names & optional classroom roster */}
            {setupConfig.participationMode === 'teams' && (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-900/65 border border-slate-700/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Số đội tham gia (2–6 đội)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[2, 3, 4, 5, 6].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() =>
                          setSetupConfig((prev) => ({ ...prev, teamCount: cnt }))
                        }
                        className={`w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          setupConfig.teamCount === cnt
                            ? 'bg-amber-400 border-white text-slate-950'
                            : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: setupConfig.teamCount }, (_, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={setupConfig.teamNames[idx] ?? `Đội ${idx + 1}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSetupConfig((prev) => {
                          const nextNames = [...prev.teamNames];
                          nextNames[idx] = val;
                          return { ...prev, teamNames: nextNames };
                        });
                      }}
                      maxLength={24}
                      placeholder={`Tên đội ${idx + 1}`}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-semibold text-white focus:border-amber-400 focus:outline-none"
                    />
                  ))}
                </div>

                {classes.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                    <span className="text-[11px] text-slate-300">
                      Gắn danh sách lớp 1–50 HS (tùy chọn):
                    </span>
                    <select
                      value={setupConfig.selectedClassId}
                      onChange={(e) => handleSelectClass(e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Không cần danh sách lớp (chơi nhanh)</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name} ({cls.students.length} HS)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Question Source */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                2. Nguồn câu hỏi (đủ 12 câu cho 3 vòng)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setSetupConfig((prev) => ({
                      ...prev,
                      questionSource: 'sample_pack' as C03QuestionSource,
                    }))
                  }
                  className={`p-3 rounded-xl border text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    setupConfig.questionSource === 'sample_pack'
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-slate-900/70 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm">
                      Gói Toán mẫu C03 (12 câu)
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 text-[10px] font-extrabold">
                      Dữ liệu mẫu
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Chuẩn KaTeX, có phương trình 2(3x - 1) = 10, độ khó tăng dần 3 vòng.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSetupConfig((prev) => ({
                      ...prev,
                      questionSource: 'bank' as C03QuestionSource,
                    }))
                  }
                  className={`p-3 rounded-xl border text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    setupConfig.questionSource === 'bank'
                      ? 'bg-emerald-500/20 border-emerald-400 text-white'
                      : 'bg-slate-900/70 border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm">
                      Ngân hàng Smart EDU
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 text-[10px] font-bold">
                      {adaptedBankCount} câu hợp lệ
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-300">
                    Tự động lọc theo quyền ({userRole}) & sắp tăng dần độ khó qua 3 vòng.
                  </p>
                </button>
              </div>
            </div>

            {/* Extra Settings */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/65 border border-slate-700 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={setupConfig.shuffleOptions}
                  onChange={(e) =>
                    setSetupConfig((prev) => ({
                      ...prev,
                      shuffleOptions: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                <span>Xáo thứ tự A/B/C/D</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/65 border border-slate-700 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={setupConfig.whiteboardHoldMode}
                  onChange={(e) =>
                    setSetupConfig((prev) => ({
                      ...prev,
                      whiteboardHoldMode: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                <span>Giữ bảng con (Đã nộp)</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/65 border border-slate-700 cursor-pointer text-xs text-slate-200">
                <input
                  type="checkbox"
                  checked={setupConfig.enableTiebreaker}
                  onChange={(e) =>
                    setSetupConfig((prev) => ({
                      ...prev,
                      enableTiebreaker: e.target.checked,
                    }))
                  }
                  className="accent-amber-400"
                />
                <span>Cho phép Câu phụ</span>
              </label>
            </div>

            {setupError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/60 text-xs font-semibold text-rose-200">
                {setupError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGuideModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Xem luật & phím tắt</span>
              </button>

              <button
                type="button"
                onClick={handleStartArena}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm cursor-pointer shadow-lg shadow-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Khai mạc Đấu trường 3D</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PHASE 2: ACTIVE GAMEPLAY / ROUND SUMMARY / TIEBREAKER               */}
      {/* =================================================================== */}
      {(gameState.phase === 'playing' ||
        gameState.phase === 'question_revealed' ||
        gameState.phase === 'round_summary' ||
        gameState.phase === 'tiebreaker') && (
        <div className="flex-1 p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-y-auto">
          {/* Left: 3D Arena Stage (or 2D Fallback) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="rounded-2xl overflow-hidden border border-slate-700/80 min-h-[300px] lg:min-h-[430px] flex flex-col">
              <KnowledgeArena3DScene
                teams={gameState.teams}
                currentRoundIndex={gameState.currentRoundIndex}
                questionInRoundIndex={
                  currentQuestionProgress?.questionInRoundIndex ?? 0
                }
                phase={gameState.phase}
                quality={quality}
                reducedMotion={reducedMotion}
                onSelectTeam={handleSelectTeamFromStage}
                onWebGLFallback={() => setQuality('2d')}
              />
            </div>

            {/* Status Notice Bar */}
            <div className="p-2.5 rounded-xl bg-[#08132B] border border-slate-700 text-xs text-slate-200 flex items-center justify-between gap-2">
              <span>{gameState.lastActionNotice}</span>
              <button
                type="button"
                onClick={() =>
                  setGameState((prev) => finishC03ToSummary(prev))
                }
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-semibold text-slate-300 shrink-0 cursor-pointer"
              >
                Kết thúc sớm
              </button>
            </div>
          </div>

          {/* Right: Question Panel / Round Summary / Tiebreaker */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* ROUND SUMMARY VIEW BETWEEN ROUNDS 1 -> 2 AND 2 -> 3 */}
            {gameState.phase === 'round_summary' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#08132B] border border-amber-400/60 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-amber-300">
                      TỔNG KẾT VÒNG {gameState.currentRoundIndex + 1}
                    </span>
                    <h3 className="text-lg font-extrabold text-white">
                      Hoàn thành 4/4 câu ({currentRoundPts}đ/câu · Tối đa{' '}
                      {4 * currentRoundPts}đ)
                    </h3>
                  </div>
                  <Trophy className="w-8 h-8 text-amber-400 shrink-0" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {gameState.teams.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: t.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">
                            {t.name}
                          </div>
                          <div className="text-[11px] text-slate-300">
                            Đúng Vòng {gameState.currentRoundIndex + 1}:{' '}
                            {t.roundCorrectCounts[gameState.currentRoundIndex]}/4 câu
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-extrabold text-amber-300">
                          +{t.roundScores[gameState.currentRoundIndex]}đ
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          Tổng: {t.mainScore}đ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAdvanceNext}
                  className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span>
                    Bước vào Vòng {gameState.currentRoundIndex + 2} (
                    {getC03RoundPoints((gameState.currentRoundIndex + 1) as 0 | 1 | 2)}
                    đ/câu)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* SEPARATE TIEBREAKER QUESTION VIEW */}
            {gameState.phase === 'tiebreaker' && (
              <div className="p-4 sm:p-5 rounded-2xl bg-[#08132B] border border-purple-400/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-purple-300">
                      CÂU PHỤ PHÂN HẠNG (ĐIỂM TÁCH BIỆT KHỎI TỔNG 240đ)
                    </span>
                    <h3 className="text-base font-extrabold text-white">
                      {gameState.tiebreakerDeck[gameState.tiebreakerIndex]?.topicLabel}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setGameState((prev) => finishC03ToSummary(prev))
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    Quay lại Bảng xếp hạng
                  </button>
                </div>

                {gameState.tiebreakerDeck[gameState.tiebreakerIndex] && (
                  <>
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white">
                      <MathView
                        content={
                          gameState.tiebreakerDeck[gameState.tiebreakerIndex].stem
                        }
                      />
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200">
                      <span className="font-bold">Đáp án & lời giải: </span>
                      <MathView
                        content={
                          gameState.tiebreakerDeck[gameState.tiebreakerIndex]
                            .explanationText
                        }
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  {gameState.teams.map((t) => (
                    <div
                      key={t.id}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: t.color }}
                        />
                        <span className="text-sm font-bold text-white">{t.name}</span>
                        <span className="text-xs font-mono text-slate-400">
                          Chính: {t.mainScore}đ · Phụ: {t.tiebreakerScore}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setGameState((prev) =>
                              gradeC03TiebreakerTeam({
                                state: prev,
                                teamId: t.id,
                                isCorrect: true,
                              })
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold cursor-pointer"
                        >
                          +1 Câu phụ
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setGameState((prev) =>
                              gradeC03TiebreakerTeam({
                                state: prev,
                                teamId: t.id,
                                isCorrect: false,
                              })
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-300 cursor-pointer"
                        >
                          Chưa đúng
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MAIN QUESTION CARD (PLAYING / QUESTION_REVEALED) */}
            {(gameState.phase === 'playing' ||
              gameState.phase === 'question_revealed') &&
              currentQuestionProgress && (
                <div className="p-4 sm:p-5 rounded-2xl bg-[#08132B] border border-slate-700/80 space-y-4">
                  {/* Question Meta Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold">
                        Vòng {currentQuestionProgress.roundIndex + 1} · Câu{' '}
                        {currentQuestionProgress.questionInRoundIndex + 1}/4
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-200">
                        {currentQuestionProgress.question.difficultyLabel} · +
                        {currentRoundPts}đ
                      </span>
                      <span className="text-xs text-slate-300">
                        {currentQuestionProgress.question.topicLabel}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleSkipRevealAnimation}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      title="Bỏ qua hoạt ảnh và giữ nguyên trạng thái đã khóa (S)"
                    >
                      <FastForward className="w-3.5 h-3.5 text-amber-400" />
                      <span>Bỏ qua hoạt ảnh (S)</span>
                    </button>
                  </div>

                  {/* Team Cursor Selector & Live Per-Team Submission State */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>
                        Chọn đội để nhập/chấm đáp án (nhấn <kbd className="px-1 rounded bg-slate-800 border border-slate-600">Tab</kbd> để chuyển nhanh):
                      </span>
                      {gameState.config.whiteboardHoldMode && (
                        <button
                          type="button"
                          onClick={handleCommitWhiteboards}
                          className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-[11px] cursor-pointer"
                        >
                          Chốt đồng loạt bảng con Đã nộp
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {gameState.teams.map((team, idx) => {
                        const sub = currentQuestionProgress.submissions[team.id];
                        const isCursor = idx === gameState.activeTeamCursor;
                        const badge = formatOutcomeBadge(sub?.status ?? 'unattempted');

                        return (
                          <div
                            key={team.id}
                            onClick={() =>
                              setGameState((prev) => ({
                                ...prev,
                                activeTeamCursor: idx,
                              }))
                            }
                            className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                              isCursor
                                ? 'bg-slate-800/95 border-amber-400 ring-1 ring-amber-400/60'
                                : 'bg-slate-900/80 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-sm shrink-0"
                                style={{ backgroundColor: team.color }}
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {team.name}
                                </div>
                                <span
                                  className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${badge.className}`}
                                >
                                  {badge.label}
                                </span>
                              </div>
                            </div>

                            {/* Quick per-team grading buttons (disabled once sub.graded === true) */}
                            <div
                              className="flex items-center gap-1 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={Boolean(sub?.graded)}
                                onClick={() =>
                                  handleTeacherDirectGrade(team.id, 'correct')
                                }
                                title={`Chấm Đúng (+${currentRoundPts}đ)`}
                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 disabled:opacity-35 border border-emerald-400/50 text-emerald-300 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(sub?.graded)}
                                onClick={() =>
                                  handleTeacherDirectGrade(team.id, 'wrong')
                                }
                                title="Chấm Sai (0đ)"
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 disabled:opacity-35 border border-rose-400/50 text-rose-300 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(sub?.graded)}
                                onClick={() =>
                                  handleTeacherDirectGrade(team.id, 'skip')
                                }
                                title="Xác nhận Bỏ qua (0đ)"
                                className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-35 border border-slate-500 text-slate-200 cursor-pointer disabled:cursor-not-allowed"
                              >
                                <MinusCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Question Stem */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-3">
                    <div className="text-base sm:text-lg font-bold text-white leading-relaxed">
                      <MathView content={currentQuestionProgress.question.stem} />
                    </div>
                    {currentQuestionProgress.question.image && (
                      <img
                        src={currentQuestionProgress.question.image}
                        alt="Minh họa câu hỏi"
                        className="max-h-48 rounded-lg border border-slate-700 object-contain"
                      />
                    )}
                  </div>

                  {/* 4 Options A/B/C/D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQuestionProgress.question.options.map((opt, idx) => {
                      const activeSub = activeTeam
                        ? currentQuestionProgress.submissions[activeTeam.id]
                        : undefined;
                      const isChosenByCursor =
                        activeSub?.selectedOptionId === opt.optionId;
                      const showTruth =
                        gameState.phase === 'question_revealed' ||
                        currentQuestionProgress.solutionRevealed;
                      const isCorrectOpt =
                        opt.optionId ===
                        currentQuestionProgress.question.correctOptionId;

                      let btnCls =
                        'bg-slate-900 border-slate-700 hover:border-amber-400 text-slate-100';
                      if (showTruth && isCorrectOpt) {
                        btnCls =
                          'bg-emerald-500/20 border-emerald-400 text-emerald-100';
                      } else if (isChosenByCursor && activeSub?.status === 'submitted') {
                        btnCls = 'bg-sky-500/25 border-sky-400 text-sky-100';
                      } else if (
                        isChosenByCursor &&
                        activeSub?.graded &&
                        !isCorrectOpt
                      ) {
                        btnCls = 'bg-rose-500/20 border-rose-400 text-rose-100';
                      }

                      return (
                        <button
                          key={opt.optionId}
                          type="button"
                          disabled={Boolean(activeSub?.graded)}
                          onClick={() => handleOptionAction(opt.optionId)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${btnCls}`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-600 text-xs font-extrabold text-amber-300 flex items-center justify-center shrink-0">
                            {opt.labelKey || idx + 1}
                          </span>
                          <span className="text-sm font-semibold min-w-0 break-words">
                            <MathView content={opt.text} />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* STATIC DOM HINT & EXPLANATION PANEL (Never overlaps stage or next question) */}
                  {(currentQuestionProgress.hintRevealed ||
                    currentQuestionProgress.solutionRevealed) && (
                    <div className="space-y-2">
                      {currentQuestionProgress.hintRevealed && (
                        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs sm:text-sm text-amber-100">
                          <span className="font-bold text-amber-300">Gợi ý: </span>
                          <MathView
                            content={currentQuestionProgress.question.hintText}
                          />
                        </div>
                      )}
                      {currentQuestionProgress.solutionRevealed && (
                        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-xs sm:text-sm text-emerald-100">
                          <span className="font-bold text-emerald-300">
                            Lời giải chi tiết:{' '}
                          </span>
                          <MathView
                            content={
                              currentQuestionProgress.question.explanationText
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Controls */}
                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleRevealHint}
                        disabled={currentQuestionProgress.hintRevealed}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 border border-slate-600 text-xs font-bold text-amber-300 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Gợi ý (H)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRevealSolution}
                        disabled={currentQuestionProgress.solutionRevealed}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-45 border border-slate-600 text-xs font-bold text-emerald-300 cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem lời giải</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={!canAdvance}
                      onClick={handleAdvanceNext}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                        canAdvance
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer shadow-md'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <span>
                        {!canAdvance
                          ? 'Chấm hoặc bỏ qua đủ các đội để tiếp tục'
                          : currentQuestionProgress.questionInRoundIndex === 3
                            ? currentQuestionProgress.roundIndex < 2
                              ? `Tổng kết Vòng ${currentQuestionProgress.roundIndex + 1}`
                              : 'Hoàn thành Đấu trường'
                            : 'Câu tiếp theo'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* PHASE 3: FINAL SUMMARY & 12-QUESTION KNOWLEDGE REVIEW               */}
      {/* =================================================================== */}
      {gameState.phase === 'summary' && (
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Header Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#0B1D42] to-[#13295A] border border-amber-400/50 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-300">
                  TỔNG KẾT ĐẤU TRƯỜNG KIẾN THỨC 3D (C03)
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">
                  {summaryStats.isTieAtTop
                    ? 'ĐỒNG HẠNG NHẤT — Hai đội dẫn đầu cùng số điểm!'
                    : `Quán quân: ${summaryStats.rankings[0]?.name || ''} (${summaryStats.rankings[0]?.mainScore || 0}/${C03_MAX_MAIN_SCORE}đ)`}
                </h3>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {gameState.config.enableTiebreaker && summaryStats.isTieAtTop && (
                <button
                  type="button"
                  onClick={() =>
                    setGameState((prev) => ({ ...prev, phase: 'tiebreaker' }))
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Mở Câu phụ phân hạng riêng</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleStartArena}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại ngay</span>
              </button>

              <button
                type="button"
                onClick={handleResetToSetup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold text-xs cursor-pointer"
              >
                <span>Cấu hình mới</span>
              </button>
            </div>
          </div>

          {/* Team Ranking & Round Matrix */}
          <div className="overflow-x-auto rounded-2xl border border-slate-700 bg-[#08132B]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-900 text-slate-300 border-b border-slate-700">
                <tr>
                  <th className="px-3.5 py-2.5">Hạng</th>
                  <th className="px-3.5 py-2.5">Đội / Thí sinh</th>
                  <th className="px-3.5 py-2.5">Vòng 1 (10đ)</th>
                  <th className="px-3.5 py-2.5">Vòng 2 (20đ)</th>
                  <th className="px-3.5 py-2.5">Vòng 3 (30đ)</th>
                  <th className="px-3.5 py-2.5">Tổng chính (/240)</th>
                  {summaryStats.tiebreakerUsed && (
                    <th className="px-3.5 py-2.5 text-purple-300">Câu phụ</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {summaryStats.rankings.map((row) => (
                  <tr key={row.teamId} className="hover:bg-slate-900/50">
                    <td className="px-3.5 py-2.5 font-mono font-extrabold text-amber-300">
                      #{row.rank}
                    </td>
                    <td className="px-3.5 py-2.5 font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 shrink-0" style={{ color: row.color }} />
                      <span>{row.name}</span>
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-200">
                      {row.roundScores[0]}đ ({row.roundCorrectCounts[0]}/4)
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-200">
                      {row.roundScores[1]}đ ({row.roundCorrectCounts[1]}/4)
                    </td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-200">
                      {row.roundScores[2]}đ ({row.roundCorrectCounts[2]}/4)
                    </td>
                    <td className="px-3.5 py-2.5 font-mono font-extrabold text-emerald-300">
                      {row.mainScore}đ
                    </td>
                    {summaryStats.tiebreakerUsed && (
                      <td className="px-3.5 py-2.5 font-mono font-bold text-purple-300">
                        +{row.tiebreakerScore}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transparent Outcome Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
            {[
              {
                label: 'Đúng tự làm',
                val: summaryStats.independentCount,
                cls: 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200',
              },
              {
                label: 'Đúng có hỗ trợ',
                val: summaryStats.assistedCount,
                cls: 'border-amber-500/50 bg-amber-950/40 text-amber-200',
              },
              {
                label: 'Chưa đúng',
                val: summaryStats.wrongCount,
                cls: 'border-rose-500/50 bg-rose-950/40 text-rose-200',
              },
              {
                label: 'Đã xem lời giải',
                val: summaryStats.viewedSolutionCount,
                cls: 'border-purple-500/50 bg-purple-950/40 text-purple-200',
              },
              {
                label: 'Bỏ qua',
                val: summaryStats.skippedCount,
                cls: 'border-slate-600 bg-slate-900 text-slate-300',
              },
            ].map((item) => (
              <div key={item.label} className={`p-3 rounded-xl border ${item.cls}`}>
                <div className="text-lg font-mono font-extrabold">{item.val}</div>
                <div className="text-[11px] font-semibold">{item.label}</div>
              </div>
            ))}
          </div>

          {/* Expandable 12-Question Knowledge Review */}
          <div className="rounded-2xl border border-slate-700 bg-[#08132B] overflow-hidden">
            <button
              type="button"
              onClick={() => setShowReviewAccordion((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-sm font-extrabold text-white hover:bg-slate-900/60 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-400" />
                <span>Xem lại toàn bộ 12 câu hỏi & lời giải KaTeX</span>
              </span>
              {showReviewAccordion ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showReviewAccordion && (
              <div className="p-4 border-t border-slate-800 space-y-3">
                {gameState.deck.map((item, idx) => {
                  const correctOpt = item.question.options.find(
                    (o) => o.optionId === item.question.correctOptionId
                  );
                  return (
                    <div
                      key={item.question.questionId}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1.5 text-xs sm:text-sm"
                    >
                      <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                        <span>
                          Câu {idx + 1}/12 · Vòng {item.roundIndex + 1} (
                          {getC03RoundPoints(item.roundIndex)}đ)
                        </span>
                        <span>{item.question.difficultyLabel}</span>
                      </div>
                      <div className="font-bold text-white">
                        <MathView content={item.question.stem} />
                      </div>
                      {correctOpt && (
                        <div className="text-emerald-300 font-semibold">
                          Đáp án đúng ({correctOpt.labelKey}):{' '}
                          <MathView content={correctOpt.text} />
                        </div>
                      )}
                      <div className="text-slate-300">
                        <span className="font-semibold text-sky-300">Giải thích: </span>
                        <MathView content={item.question.explanationText} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* GUIDE & KEYBOARD MODAL                                              */}
      {/* =================================================================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0B1734] border border-slate-700 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-amber-300 flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                <span>Hướng dẫn Đấu trường kiến thức 3D (C03)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <p>
                <strong>Thể lệ 3 vòng (12 câu · tối đa 240đ):</strong> Vòng 1 (4 câu × 10đ = 40đ),
                Vòng 2 (4 câu × 20đ = 80đ), Vòng 3 (4 câu × 30đ = 120đ). Vòng 3 luôn tính 30đ/câu.
              </p>
              <p>
                <strong>Chống cộng điểm lặp & đồng bộ chuyển câu:</strong> Mỗi cặp (đội, câu) chỉ
                tính điểm tối đa 1 lần. Chỉ sang câu mới sau khi mọi đội đều đã được chấm hoặc xác
                nhận Bỏ qua.
              </p>
              <p>
                <strong>Xếp hạng hòa điểm:</strong> Nếu hai đội bằng điểm và không mở Câu phụ, hệ
                thống giữ nguyên đồng hạng (#1, #1, #3).
              </p>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1 text-xs">
                <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">1–4</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">A–D</kbd>: Chọn đáp án cho đội đang trỏ</div>
                <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">Tab</kbd>: Đổi đội đang trỏ</div>
                <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">H</kbd>: Mở gợi ý · <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">S</kbd>: Bỏ qua hoạt ảnh · <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">M</kbd>: Tắt/Bật tiếng</div>
                <div><kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600">Enter</kbd>: Chuyển câu sau khi đã chấm đủ các đội</div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeArena3DGame;
