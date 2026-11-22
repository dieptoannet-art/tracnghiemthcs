import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  Layers,
  Monitor,
  Play,
  Pause,
  Square,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Zap,
  RotateCcw,
  Award,
  AlertTriangle,
  FastForward,
  Edit3,
  BookOpen,
  Clock,
  Users,
  User,
  ZoomIn,
  X,
  Lightbulb,
} from 'lucide-react';
import { Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  saveEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import {
  D08_SAMPLE_BADGE,
  D08_SAMPLE_QUESTIONS,
  D08_SAMPLE_RESERVE,
  DEFAULT_ARENA_TEAMS,
  ArenaGameState,
  ArenaMatchConfig,
  ArenaPlayMode,
  ArenaQuestionSource,
  ArenaTeamSlotId,
  adaptBankQuestionsForD08,
  getMaxPossibleScore,
  computeArenaTeamStats,
  computeArenaRankings,
  previewRoundPoints,
  createDefaultArenaConfig,
  createArenaSetupState,
  startArenaMatch,
  toggleTeamPendingDouble,
  openCurrentQuestion,
  toggleArenaPause,
  tickArenaTimerOneSecond,
  stopAnsweringPhase,
  setTeamRoundMark,
  setTeamSelectedOption,
  areAllActiveTeamsMarked,
  commitCurrentRound,
  startEditingLastCommittedRound,
  cancelCurrentQuestionForError,
  advanceToNextQuestion,
  endArenaMatchEarly,
  saveD08Session,
  loadD08Session,
  clearD08Session,
} from './fourTeamsArena3dEngine';
import { FourTeamsArena3DScene, FourTeamsArena2DBoard } from './FourTeamsArena3DScene';

export interface FourTeamsArena3DGameProps {
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const TIMER_OPTIONS = [
  { label: '20 giây', value: 20 },
  { label: '30 giây (mặc định)', value: 30 },
  { label: '45 giây', value: 45 },
  { label: '60 giây', value: 60 },
  { label: 'Không giới hạn', value: 0 },
];

const FourTeamsArena3DGame: React.FC<FourTeamsArena3DGameProps> = ({
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Adapt Smart EDU question bank honoring RBAC & zero duplicates
  const adaptedBankPool = useMemo(
    () => adaptBankQuestionsForD08(bankQuestions, userRole),
    [bankQuestions, userRole]
  );

  // Restore persisted match session safely without double-counting or refunding consumed Doubles
  const restoredSession = useMemo(() => loadD08Session(), []);

  const [gameState, setGameState] = useState<ArenaGameState>(() =>
    restoredSession ? restoredSession.state : createArenaSetupState()
  );

  // Setup draft state
  const [setupConfig, setSetupConfig] = useState<ArenaMatchConfig>(() =>
    restoredSession ? restoredSession.state.config : createDefaultArenaConfig()
  );
  const [setupError, setSetupError] = useState<string | null>(null);

  // Visual / accessibility toggles
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [webglAutoFallback, setWebglAutoFallback] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Animation & overlay helpers
  const [skipEffectToken, setSkipEffectToken] = useState<number>(0);
  const [scorePulseToken, setScorePulseToken] = useState<number>(0);
  const [isScoreAnimating, setIsScoreAnimating] = useState<boolean>(false);
  const [showHintBox, setShowHintBox] = useState<boolean>(false);
  const [zoomedFormula, setZoomedFormula] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelReasonText, setCancelReasonText] = useState<string>('Câu hỏi bị lỗi hiển thị / nội dung');
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(false);

  // Shared A01/A02 audio & strict vi-VN voice
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));

  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const commitLockRef = useRef<boolean>(false);
  const scoreAnimTimerRef = useRef<number | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    soundBankRef.current = new EduGameSoundBank();
    voiceRef.current = new EduGameVoiceController();
    return () => {
      if (scoreAnimTimerRef.current !== null) {
        window.clearTimeout(scoreAnimTimerRef.current);
      }
      soundBankRef.current?.stopAll();
      soundBankRef.current?.dispose();
      voiceRef.current?.stop();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Persist active match state automatically
  useEffect(() => {
    if (gameState.phase !== 'setup') {
      saveD08Session(gameState);
    }
  }, [gameState]);

  // Countdown timer — runs strictly ONLY in `answering` phase when NOT paused and timer > 0
  useEffect(() => {
    if (
      gameState.phase !== 'answering' ||
      gameState.isPaused ||
      gameState.config.timerSeconds <= 0
    ) {
      return;
    }
    const id = window.setInterval(() => {
      setGameState((prev) => tickArenaTimerOneSecond(prev).state);
    }, 1000);
    return () => window.clearInterval(id);
  }, [gameState.phase, gameState.isPaused, gameState.config.timerSeconds]);

  const stopAllAudioAndPending = useCallback(() => {
    if (scoreAnimTimerRef.current !== null) {
      window.clearTimeout(scoreAnimTimerRef.current);
      scoreAnimTimerRef.current = null;
    }
    setIsScoreAnimating(false);
    commitLockRef.current = false;
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    saveEduGameMuted(next);
    if (next) {
      stopAllAudioAndPending();
    } else {
      soundBankRef.current?.unlock();
    }
  };

  const handleToggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveEduGameVoiceEnabled(next);
    if (!next) {
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  };

  const handleWebGLFallback = useCallback(() => {
    setWebglAutoFallback(true);
    setRenderMode('2d');
  }, []);

  // Derived authoritative stats & rankings
  const teamStats = useMemo(() => computeArenaTeamStats(gameState), [gameState]);
  const rankings = useMemo(() => computeArenaRankings(gameState), [gameState]);
  const currentQuestion = gameState.activeDeck[gameState.currentDeckIndex] || null;
  const maxPossibleScore = useMemo(
    () => getMaxPossibleScore(gameState.activeDeck.length, gameState.config.doublePowerEnabled),
    [gameState.activeDeck.length, gameState.config.doublePowerEnabled]
  );

  // Active Doubles map for 3D podium crown illumination
  const activeDoublesForScene = useMemo(() => {
    if (gameState.phase === 'pre_open') return gameState.pendingDoubles;
    if (
      gameState.phase === 'answering' ||
      gameState.phase === 'scoring' ||
      gameState.phase === 'committed'
    ) {
      return gameState.lockedDoubles;
    }
    return { A: false, B: false, C: false, D: false };
  }, [gameState.phase, gameState.pendingDoubles, gameState.lockedDoubles]);

  // Setup pool availability
  const setupAvailablePool =
    setupConfig.questionSource === 'sample' ? D08_SAMPLE_QUESTIONS : adaptedBankPool;
  const setupAvailableCount = setupAvailablePool.length;
  const setupMaxScorePreview = getMaxPossibleScore(
    Math.min(setupConfig.requestedQuestionCount, Math.max(1, setupAvailableCount)),
    setupConfig.playMode === 'four_teams' && setupConfig.doublePowerEnabled
  );

  // ============================================================================
  // MATCH HANDLERS
  // ============================================================================

  const handleStartMatch = () => {
    stopAllAudioAndPending();
    soundBankRef.current?.unlock();
    const pool =
      setupConfig.questionSource === 'sample' ? D08_SAMPLE_QUESTIONS : adaptedBankPool;
    const reserve = setupConfig.questionSource === 'sample' ? D08_SAMPLE_RESERVE : [];
    const res = startArenaMatch(setupConfig, pool, reserve);
    if (res.error) {
      setSetupError(res.error);
      return;
    }
    setSetupError(null);
    setShowHintBox(false);
    setShowReviewPanel(false);
    setGameState(res.state);
  };

  const handleToggleDouble = (teamId: ArenaTeamSlotId) => {
    soundBankRef.current?.unlock();
    const res = toggleTeamPendingDouble(gameState, teamId);
    if (res.changed) {
      setGameState(res.state);
      if (res.state.pendingDoubles[teamId]) {
        soundBankRef.current?.playArenaDoubleLock(isMutedRef.current);
      }
    }
  };

  const handleOpenQuestion = () => {
    soundBankRef.current?.unlock();
    setShowHintBox(false);
    setGameState((prev) => openCurrentQuestion(prev));
    soundBankRef.current?.playArenaOpenQuestion(isMutedRef.current);
  };

  const handleReadCurrentQuestion = () => {
    if (isMuted || !voiceEnabled || !currentQuestion) return;
    soundBankRef.current?.unlock();
    voiceRef.current
      ?.replayText({
        text: `Câu ${gameState.validRoundsCompleted + 1}. ${currentQuestion.plainReadText}`,
        isMuted,
        voiceEnabled,
      })
      .catch(() => {});
  };

  const handleCommitRound = () => {
    if (commitLockRef.current) return;
    commitLockRef.current = true;
    soundBankRef.current?.unlock();

    const res = commitCurrentRound(gameState);
    if (!res.committed) {
      commitLockRef.current = false;
      if (res.reason) {
        setGameState((prev) => ({ ...prev, statusMessage: res.reason! }));
      }
      return;
    }

    setGameState(res.state);
    if (res.anyScored) {
      // SINGLE shared sound effect even when 2–4 teams score simultaneously!
      soundBankRef.current?.playArenaScoreAward(isMutedRef.current, res.hasDoubleWinner);
      setScorePulseToken((n) => n + 1);
      if (!reducedMotion) {
        setIsScoreAnimating(true);
        scoreAnimTimerRef.current = window.setTimeout(() => {
          scoreAnimTimerRef.current = null;
          setIsScoreAnimating(false);
          commitLockRef.current = false;
        }, 900);
      } else {
        setSkipEffectToken((n) => n + 1);
        commitLockRef.current = false;
      }
    } else {
      commitLockRef.current = false;
    }
  };

  const handleSkipScoreEffect = () => {
    stopAllAudioAndPending();
    setSkipEffectToken((n) => n + 1);
  };

  const handleNextOrFinish = () => {
    stopAllAudioAndPending();
    setShowHintBox(false);
    const next = advanceToNextQuestion(gameState);
    setGameState(next);
    if (next.phase === 'finished') {
      soundBankRef.current?.playArenaSummaryFanfare(isMutedRef.current);
    }
  };

  const handleConfirmCancelQuestion = () => {
    stopAllAudioAndPending();
    const res = cancelCurrentQuestionForError(gameState, cancelReasonText);
    setGameState(res.state);
    setShowCancelModal(false);
    setShowHintBox(false);
  };

  const handleEndEarly = () => {
    stopAllAudioAndPending();
    setGameState((prev) => endArenaMatchEarly(prev));
    soundBankRef.current?.playArenaSummaryFanfare(isMutedRef.current);
  };

  const handleReplaySameConfig = () => {
    stopAllAudioAndPending();
    clearD08Session();
    const pool =
      gameState.config.questionSource === 'sample' ? D08_SAMPLE_QUESTIONS : adaptedBankPool;
    const reserve = gameState.config.questionSource === 'sample' ? D08_SAMPLE_RESERVE : [];
    const res = startArenaMatch(gameState.config, pool, reserve);
    if (!res.error) {
      setShowReviewPanel(false);
      setShowHintBox(false);
      setGameState(res.state);
    }
  };

  const handleGoToSetupEditTeams = () => {
    stopAllAudioAndPending();
    clearD08Session();
    setSetupConfig(gameState.config);
    setShowReviewPanel(false);
    setGameState(createArenaSetupState(gameState.config));
  };

  const handleExitToLibrary = () => {
    stopAllAudioAndPending();
    onBackToLibrary();
  };

  const allTeamsMarked = areAllActiveTeamsMarked(gameState);
  const isEditingScore =
    gameState.phase === 'scoring' ||
    (gameState.phase === 'committed' && gameState.editingLastCommitted);

  return (
    <div
      className={`w-full ${
        isFullscreen
          ? 'h-full p-3 sm:p-4'
          : 'rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-2xl'
      } bg-[#050C1C] text-slate-100 flex flex-col gap-3.5 overflow-y-auto`}
    >
      {/* TOP BAR — Clean unboxed metadata + single-line utility buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thư viện</span>
          </button>

          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight whitespace-nowrap">
              D08 · Đấu trường 4 đội 3D
            </h1>
            <span className="text-xs text-slate-400" aria-hidden="true">
              ·
            </span>
            <span className="text-xs font-medium text-teal-300 whitespace-nowrap">
              {gameState.config.questionSource === 'sample'
                ? D08_SAMPLE_BADGE
                : 'Ngân hàng Smart EDU'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {isScoreAnimating && (
            <button
              type="button"
              onClick={handleSkipScoreEffect}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span>Bỏ qua hiệu ứng</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setRenderMode((m) => (m === '3d' ? '2d' : '3d'))}
            disabled={webglAutoFallback}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            {renderMode === '3d' ? <Layers className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            <span>{renderMode === '3d' ? '3D' : '2D nhẹ'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              reducedMotion
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {reducedMotion ? 'Ít động: Bật' : 'Ít động'}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              isMuted
                ? 'bg-rose-950 border-rose-500/60 text-rose-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-teal-950 border-teal-500/60 text-teal-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Giọng Việt</span>
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 cursor-pointer"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PHASE 0: SETUP SCREEN */}
      {/* ===================================================================== */}
      {gameState.phase === 'setup' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left: 3D Arena Preview + Rules overview */}
          <div className="lg:col-span-5 space-y-3">
            {renderMode === '3d' && !webglAutoFallback ? (
              <FourTeamsArena3DScene
                playMode={setupConfig.playMode}
                teamStats={
                  setupConfig.playMode === 'practice'
                    ? [
                        {
                          teamId: 'A',
                          name: 'Bảng điểm chung',
                          colorHex: '#14B8A6',
                          score: 40,
                          correctCount: 4,
                          doubleUsedOnRound: null,
                          doubleAvailable: false,
                        },
                      ]
                    : setupConfig.teams.map((t, i) => ({
                        teamId: t.id,
                        name: t.name,
                        colorHex: t.colorHex,
                        score: [40, 60, 50, 30][i],
                        correctCount: [4, 5, 5, 3][i],
                        doubleUsedOnRound: null,
                        doubleAvailable: setupConfig.doublePowerEnabled,
                      }))
                }
                activeDoubles={{ A: false, B: setupConfig.doublePowerEnabled, C: false, D: false }}
                maxPossibleScore={setupMaxScorePreview}
                compact={false}
                reducedMotion={reducedMotion}
                skipEffectToken={skipEffectToken}
                scorePulseToken={scorePulseToken}
                onWebGLFallback={handleWebGLFallback}
              />
            ) : (
              <FourTeamsArena2DBoard
                playMode={setupConfig.playMode}
                teamStats={setupConfig.teams.slice(0, setupConfig.playMode === 'practice' ? 1 : 4).map((t) => ({
                  teamId: t.id,
                  name: setupConfig.playMode === 'practice' ? 'Bảng điểm chung' : t.name,
                  colorHex: t.colorHex,
                  score: 0,
                  correctCount: 0,
                  doubleUsedOnRound: null,
                  doubleAvailable: setupConfig.doublePowerEnabled && setupConfig.playMode === 'four_teams',
                }))}
                activeDoubles={{ A: false, B: false, C: false, D: false }}
                maxPossibleScore={setupMaxScorePreview}
                compact={false}
                reducedMotion={reducedMotion}
                skipEffectToken={skipEffectToken}
                scorePulseToken={scorePulseToken}
              />
            )}

            <div className="rounded-xl bg-[#0A162E] border border-slate-800 p-4 space-y-2 text-xs text-slate-300 leading-relaxed">
              <div className="text-sm font-bold text-white">Luật thi đấu minh bạch</div>
              <ul className="space-y-1.5 list-disc pl-4">
                <li>
                  Trả lời đúng: <strong className="text-white">+10 điểm</strong>. Sai hoặc không trả
                  lời: <strong className="text-white">0 điểm</strong> (không trừ điểm).
                </li>
                <li>
                  <strong className="text-amber-300">Quyền Nhân đôi (×2)</strong>: mỗi đội có 1 lần
                  dùng, chọn sau khi nghe chủ đề và <strong>khóa trước khi mở đề</strong>. Đúng được{' '}
                  <strong className="text-amber-300">+20 điểm</strong>, sai/không trả lời được 0 điểm
                  và vẫn tiêu hao quyền.
                </li>
                <li>
                  Điểm tối đa cấu hình hiện tại:{' '}
                  <strong className="text-teal-300 tabular-nums">{setupMaxScorePreview} điểm</strong>{' '}
                  / đội.
                </li>
              </ul>
            </div>
          </div>

          {/* Right: Configuration Form */}
          <div className="lg:col-span-7 rounded-xl bg-[#0A162E] border border-slate-800 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-white">Thiết lập trận Đấu trường 4 đội</h2>
              <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() =>
                    setSetupConfig((c) => ({ ...c, playMode: 'four_teams', doublePowerEnabled: true }))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    setupConfig.playMode === 'four_teams'
                      ? 'bg-teal-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Đấu trường 4 đội</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSetupConfig((c) => ({ ...c, playMode: 'practice', doublePowerEnabled: false }))
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                    setupConfig.playMode === 'practice'
                      ? 'bg-teal-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Luyện tập (&lt;4 HS)</span>
                </button>
              </div>
            </div>

            {/* Editable 4 Team Names */}
            {setupConfig.playMode === 'four_teams' ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Tên 4 đội thi (vị trí A–D cố định trong suốt trận):
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {setupConfig.teams.map((team, idx) => (
                    <div
                      key={team.id}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2"
                    >
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                        style={{ backgroundColor: team.colorHex }}
                      >
                        {team.id}
                      </span>
                      <input
                        type="text"
                        maxLength={24}
                        value={team.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSetupConfig((prev) => ({
                            ...prev,
                            teams: prev.teams.map((t, i) => (i === idx ? { ...t, name: val } : t)),
                          }));
                        }}
                        placeholder={DEFAULT_ARENA_TEAMS[idx].name}
                        className="w-full bg-transparent text-sm font-semibold text-white focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-slate-900 border border-slate-700 p-3 text-xs text-slate-300">
                Chế độ <strong className="text-white">Luyện tập</strong> dùng một bảng điểm chung
                duy nhất cho 1–3 học sinh, không tạo đội đối thủ giả.
              </div>
            )}

            {/* Question Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Nguồn câu hỏi</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSetupError(null);
                      setSetupConfig((c) => ({
                        ...c,
                        questionSource: 'sample',
                        requestedQuestionCount: Math.min(c.requestedQuestionCount, D08_SAMPLE_QUESTIONS.length),
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left cursor-pointer ${
                      setupConfig.questionSource === 'sample'
                        ? 'bg-teal-500/20 border-teal-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>Dữ liệu mẫu</div>
                    <div className="text-[11px] text-teal-300">12 câu Toán THCS</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupError(null);
                      setSetupConfig((c) => ({
                        ...c,
                        questionSource: 'bank',
                        requestedQuestionCount:
                          adaptedBankPool.length > 0
                            ? Math.min(c.requestedQuestionCount, adaptedBankPool.length)
                            : c.requestedQuestionCount,
                      }));
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left cursor-pointer ${
                      setupConfig.questionSource === 'bank'
                        ? 'bg-teal-500/20 border-teal-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div>Ngân hàng lớp</div>
                    <div className="text-[11px] text-slate-400 tabular-nums">
                      {adaptedBankPool.length} câu khả dụng
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Số câu thi đấu (không tự lặp câu)
                </label>
                <select
                  value={Math.min(setupConfig.requestedQuestionCount, Math.max(1, setupAvailableCount))}
                  onChange={(e) =>
                    setSetupConfig((c) => ({
                      ...c,
                      requestedQuestionCount: Number(e.target.value),
                    }))
                  }
                  disabled={setupAvailableCount === 0}
                  className="w-full h-11 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm font-semibold text-white tabular-nums"
                >
                  {[4, 6, 8, 10, 12, 15, 20]
                    .filter((n) => n <= setupAvailableCount)
                    .concat(
                      setupAvailableCount > 0 &&
                        ![4, 6, 8, 10, 12, 15, 20].includes(setupAvailableCount)
                        ? [setupAvailableCount]
                        : []
                    )
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n} câu {n === 12 ? '(mặc định)' : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {setupConfig.questionSource === 'bank' && adaptedBankPool.length === 0 && (
              <div className="rounded-lg bg-amber-950/50 border border-amber-400/50 px-3.5 py-2.5 text-xs text-amber-200">
                Ngân hàng câu hỏi hiện chưa có câu hợp lệ theo quyền truy cập hiện tại. Vui lòng chọn
                bộ <strong>Dữ liệu mẫu (12 câu Toán THCS)</strong> để chơi ngay.
              </div>
            )}

            {/* Timer + Double Power + Class Size */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Thời gian mỗi câu</label>
                <select
                  value={setupConfig.timerSeconds}
                  onChange={(e) =>
                    setSetupConfig((c) => ({ ...c, timerSeconds: Number(e.target.value) }))
                  }
                  className="w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-2.5 text-xs font-semibold text-white"
                >
                  {TIMER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Quyền Nhân đôi (×2)</label>
                <button
                  type="button"
                  disabled={setupConfig.playMode === 'practice'}
                  onClick={() =>
                    setSetupConfig((c) => ({ ...c, doublePowerEnabled: !c.doublePowerEnabled }))
                  }
                  className={`w-full h-10 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 ${
                    setupConfig.doublePowerEnabled && setupConfig.playMode === 'four_teams'
                      ? 'bg-amber-400/20 border-amber-400 text-amber-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>
                    {setupConfig.doublePowerEnabled && setupConfig.playMode === 'four_teams'
                      ? 'Đang bật (1 lần/đội)'
                      : 'Đang tắt'}
                  </span>
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Sĩ số lớp (1–50 HS)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={setupConfig.classSizeHint}
                  onChange={(e) =>
                    setSetupConfig((c) => ({
                      ...c,
                      classSizeHint: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm font-bold text-white text-center tabular-nums"
                />
              </div>
            </div>

            {setupError && (
              <div className="rounded-lg bg-rose-950/60 border border-rose-500/60 px-3 py-2 text-xs text-rose-200 font-medium">
                {setupError}
              </div>
            )}

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={setupAvailableCount === 0}
              className="w-full h-12 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-45 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Bắt đầu trận đấu ({Math.min(setupConfig.requestedQuestionCount, setupAvailableCount)} câu)</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ACTIVE MATCH PHASES: pre_open | answering | scoring | committed */}
      {/* ===================================================================== */}
      {gameState.phase !== 'setup' && gameState.phase !== 'finished' && currentQuestion && (
        <div className="flex flex-col gap-3 flex-1">
          {/* Compact 3D / 2D Arena Stage (collapses cleanly while question is open!) */}
          {renderMode === '3d' && !webglAutoFallback ? (
            <FourTeamsArena3DScene
              playMode={gameState.config.playMode}
              teamStats={teamStats}
              activeDoubles={activeDoublesForScene}
              maxPossibleScore={maxPossibleScore}
              compact={gameState.phase !== 'pre_open'}
              reducedMotion={reducedMotion}
              skipEffectToken={skipEffectToken}
              scorePulseToken={scorePulseToken}
              onWebGLFallback={handleWebGLFallback}
            />
          ) : (
            <FourTeamsArena2DBoard
              playMode={gameState.config.playMode}
              teamStats={teamStats}
              activeDoubles={activeDoublesForScene}
              maxPossibleScore={maxPossibleScore}
              compact={gameState.phase !== 'pre_open'}
              reducedMotion={reducedMotion}
              skipEffectToken={skipEffectToken}
              scorePulseToken={scorePulseToken}
            />
          )}

          {/* CENTRAL PROJECTOR QUESTION BOARD */}
          <div className="rounded-xl bg-[#0A162E] border border-slate-800 p-4 sm:p-5 space-y-3.5">
            {/* Round Header & Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
              <div className="flex flex-wrap items-baseline gap-2 text-xs sm:text-sm tabular-nums">
                <span className="font-extrabold text-teal-300">
                  Câu {Math.min(gameState.currentDeckIndex + 1, gameState.activeDeck.length)} /{' '}
                  {gameState.activeDeck.length}
                </span>
                <span className="text-slate-500" aria-hidden="true">
                  ·
                </span>
                <span className="font-bold text-white">Chủ đề: {currentQuestion.topic}</span>
                <span className="text-slate-500 hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  {currentQuestion.sourceBadge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 tabular-nums">
                {gameState.phase === 'answering' && gameState.config.timerSeconds > 0 && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-extrabold ${
                      gameState.timeRemainingSec <= 5
                        ? 'bg-rose-950 border-rose-500 text-rose-200'
                        : 'bg-slate-900 border-slate-700 text-amber-300'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{gameState.timeRemainingSec}s</span>
                  </div>
                )}

                {(gameState.phase === 'answering' || gameState.phase === 'scoring') && (
                  <button
                    type="button"
                    onClick={() => setGameState((prev) => toggleArenaPause(prev))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    {gameState.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{gameState.isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                  </button>
                )}

                {gameState.phase !== 'pre_open' && (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 border border-slate-700 text-xs font-semibold text-rose-200 cursor-pointer"
                    title="Hủy câu bị lỗi nội dung, hoàn quyền Nhân đôi và nạp câu thay thế"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Hủy câu lỗi</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleEndEarly}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                >
                  Kết thúc sớm
                </button>
              </div>
            </div>

            {/* PHASE 1: PRE-OPEN (Topic preview + Double power selection BEFORE revealing question!) */}
            {gameState.phase === 'pre_open' ? (
              <div className="py-4 text-center space-y-4">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-teal-300">
                    BƯỚC 1 · THÔNG BÁO CHỦ ĐỀ & CHỐT QUYỀN NHÂN ĐÔI
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    {currentQuestion.topic}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto">
                    {gameState.config.doublePowerEnabled && gameState.config.playMode === 'four_teams'
                      ? 'Các đội muốn dùng Quyền Nhân đôi (+20 điểm nếu đúng, 0 điểm nếu sai) hãy báo ngay bên dưới. Sau khi bấm “Mở câu hỏi”, quyền sẽ được khóa lập tức.'
                      : 'Các đội sẵn sàng bảng con/thẻ đáp án. Bấm “Mở câu hỏi” để hiển thị đề và bắt đầu đếm giờ.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenQuestion}
                  className="px-7 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-base inline-flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Mở câu hỏi {gameState.currentDeckIndex + 1}</span>
                </button>
              </div>
            ) : (
              /* PHASE 2 / 3 / 4: QUESTION STEM & OPTIONS (Center Stage, High-Legibility KaTeX) */
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 overflow-x-auto text-lg sm:text-2xl font-bold text-white leading-relaxed py-1">
                    <MathView content={currentQuestion.stemLatex} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setZoomedFormula(currentQuestion.stemLatex)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
                      title="Phóng to đề bài / công thức"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleReadCurrentQuestion}
                      disabled={isMuted || !voiceEnabled}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 disabled:opacity-45 cursor-pointer"
                    >
                      <Volume2 className="w-4 h-4 text-teal-300" />
                      <span className="hidden sm:inline">Đọc câu hỏi</span>
                    </button>
                  </div>
                </div>

                {/* Multiple-choice Options A–D */}
                {currentQuestion.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQuestion.options.map((opt) => {
                      const isCorrectOpt =
                        (gameState.answerRevealedInScoring || gameState.phase === 'committed') &&
                        opt.id === currentQuestion.correctOptionId;
                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-base sm:text-lg overflow-x-auto ${
                            isCorrectOpt
                              ? 'bg-emerald-950/65 border-emerald-400 text-emerald-100 font-bold'
                              : 'bg-slate-900/90 border-slate-700 text-white font-semibold'
                          }`}
                        >
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shrink-0 ${
                              isCorrectOpt
                                ? 'bg-emerald-500 text-slate-950'
                                : 'bg-slate-800 text-teal-300'
                            }`}
                          >
                            {opt.label}
                          </span>
                          <div className="flex-1 min-w-0">
                            <MathView content={opt.textLatex} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hint + Phase Action Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowHintBox((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-200 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{showHintBox ? 'Ẩn gợi ý' : 'Xem gợi ý'}</span>
                    </button>

                    {gameState.phase === 'scoring' && !gameState.answerRevealedInScoring && (
                      <button
                        type="button"
                        onClick={() =>
                          setGameState((prev) => ({ ...prev, answerRevealedInScoring: true }))
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-teal-200 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Công bố đáp án & lời giải</span>
                      </button>
                    )}
                  </div>

                  {gameState.phase === 'answering' && (
                    <button
                      type="button"
                      disabled={gameState.isPaused}
                      onClick={() => setGameState((prev) => stopAnsweringPhase(prev))}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm inline-flex items-center gap-2 disabled:opacity-45 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Dừng trả lời & Chấm điểm</span>
                    </button>
                  )}
                </div>

                {showHintBox && (
                  <div className="rounded-lg bg-amber-950/40 border border-amber-400/45 px-3.5 py-2.5 text-sm text-amber-100">
                    <MathView content={currentQuestion.hintLatex} />
                  </div>
                )}

                {/* Answer & Explanation Panel (ONLY after teams have locked in: scoring revealed or committed) */}
                {(gameState.answerRevealedInScoring || gameState.phase === 'committed') && (
                  <div className="rounded-xl bg-[#0B203B] border border-teal-500/45 p-3.5 space-y-1.5 text-sm">
                    <div className="font-bold text-teal-300 flex items-center gap-2 flex-wrap">
                      <span>Đáp án đúng:</span>
                      <span className="text-white">
                        <MathView content={currentQuestion.answerLatex} />
                      </span>
                    </div>
                    <div className="text-slate-200 leading-relaxed overflow-x-auto">
                      <MathView content={currentQuestion.explanationLatex} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FIXED-POSITION TEAM CARDS (grid-cols-2 on mobile, 4 equal columns on desktop; NEVER reordered while scoring!) */}
          <div
            className={`grid gap-2.5 ${
              gameState.config.playMode === 'practice'
                ? 'grid-cols-1 max-w-xl mx-auto w-full'
                : 'grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {teamStats.map((team) => {
              const isPreOpen = gameState.phase === 'pre_open';
              const isDoubledPending = Boolean(gameState.pendingDoubles[team.teamId]);
              const isDoubledLocked = Boolean(gameState.lockedDoubles[team.teamId]);
              const mark = gameState.draftMarks[team.teamId];
              const selectedOpt = gameState.draftOptionIds[team.teamId];
              const deltaPreview = previewRoundPoints(mark, isDoubledLocked);

              return (
                <div
                  key={team.teamId}
                  className={`rounded-xl bg-[#0A162E] border p-3 flex flex-col justify-between gap-2.5 tabular-nums ${
                    isDoubledLocked || isDoubledPending
                      ? 'border-amber-400/80'
                      : 'border-slate-800'
                  }`}
                >
                  {/* Team Identity + Score */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                        style={{ backgroundColor: team.colorHex }}
                      >
                        {team.teamId}
                      </span>
                      <span className="text-sm font-bold text-white truncate">{team.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-white leading-none">
                        {team.score}
                      </div>
                      {isEditingScore && mark !== 'unmarked' && (
                        <div className="text-[11px] font-bold text-amber-300 mt-0.5">
                          Dự kiến: +{deltaPreview}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Double Power Status / Pre-open Toggle */}
                  {gameState.config.playMode === 'four_teams' &&
                    gameState.config.doublePowerEnabled && (
                      <div>
                        {isPreOpen ? (
                          <button
                            type="button"
                            disabled={!team.doubleAvailable}
                            onClick={() => handleToggleDouble(team.teamId)}
                            className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 ${
                              isDoubledPending
                                ? 'bg-amber-400 text-slate-950 border-amber-300'
                                : team.doubleAvailable
                                  ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>
                              {isDoubledPending
                                ? 'Đã chọn ×2 (20đ)'
                                : team.doubleAvailable
                                  ? 'Chọn Nhân đôi (×2)'
                                  : `Đã dùng ×2 (Câu ${team.doubleUsedOnRound})`}
                            </span>
                          </button>
                        ) : (
                          <div
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-md text-center ${
                              isDoubledLocked
                                ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                                : team.doubleAvailable
                                  ? 'bg-slate-900 text-teal-300'
                                  : 'bg-slate-900 text-slate-500'
                            }`}
                          >
                            {isDoubledLocked
                              ? 'ĐANG NHÂN ĐÔI (×2 · ĐÃ KHÓA)'
                              : team.doubleAvailable
                                ? 'Còn quyền Nhân đôi'
                                : `Đã dùng ×2 ở Câu ${team.doubleUsedOnRound}`}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Simultaneous Scoring Controls (Phase 3 scoring OR editing last committed) */}
                  {isEditingScore && (
                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      {/* Quick option buttons A/B/C/D if available */}
                      {currentQuestion.options.length > 0 && (
                        <div className="grid grid-cols-4 gap-1">
                          {currentQuestion.options.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={gameState.isPaused}
                              onClick={() =>
                                setGameState((prev) =>
                                  setTeamSelectedOption(prev, team.teamId, opt.id)
                                )
                              }
                              className={`py-1 rounded text-xs font-bold border cursor-pointer disabled:opacity-40 ${
                                selectedOpt === opt.id
                                  ? 'bg-teal-500 text-slate-950 border-teal-400'
                                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Direct Correct / Wrong / No Answer buttons */}
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          disabled={gameState.isPaused}
                          onClick={() =>
                            setGameState((prev) => setTeamRoundMark(prev, team.teamId, 'correct'))
                          }
                          className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-40 ${
                            mark === 'correct'
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-emerald-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đúng</span>
                        </button>
                        <button
                          type="button"
                          disabled={gameState.isPaused}
                          onClick={() =>
                            setGameState((prev) => setTeamRoundMark(prev, team.teamId, 'wrong'))
                          }
                          className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-40 ${
                            mark === 'wrong'
                              ? 'bg-rose-500 text-white border-rose-400'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-rose-300'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Sai</span>
                        </button>
                        <button
                          type="button"
                          disabled={gameState.isPaused}
                          onClick={() =>
                            setGameState((prev) => setTeamRoundMark(prev, team.teamId, 'no_answer'))
                          }
                          className={`py-1.5 px-1 rounded-lg border text-[11px] font-bold flex flex-col items-center gap-0.5 cursor-pointer disabled:opacity-40 ${
                            mark === 'no_answer'
                              ? 'bg-slate-500 text-white border-slate-400'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span>Bỏ qua</span>
                        </button>
                      </div>

                      {mark === 'unmarked' && (
                        <div className="text-[11px] text-amber-300 font-semibold text-center">
                          Trạng thái: Chưa chấm
                        </div>
                      )}
                    </div>
                  )}

                  {/* Committed Round Readout */}
                  {gameState.phase === 'committed' && !gameState.editingLastCommitted && (
                    <div className="text-xs font-bold text-center py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                      {mark === 'correct' ? (
                        <span className="text-emerald-300">
                          Đúng (+{deltaPreview} điểm)
                        </span>
                      ) : mark === 'wrong' ? (
                        <span className="text-rose-300">Chưa đúng (+0 điểm)</span>
                      ) : (
                        <span className="text-slate-400">Không trả lời (+0 điểm)</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BOTTOM TEACHER COMMIT / NEXT ACTION BAR */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#0A162E] border border-slate-800 px-4 py-3">
            <div className="text-xs sm:text-sm text-slate-200 font-medium">
              {gameState.statusMessage || 'Sẵn sàng điều phối lượt thi.'}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isEditingScore && (
                <button
                  type="button"
                  disabled={!allTeamsMarked || gameState.isPaused}
                  onClick={handleCommitRound}
                  className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-sm disabled:opacity-40 cursor-pointer"
                >
                  {gameState.editingLastCommitted
                    ? 'Lưu kết quả đã sửa'
                    : 'Xác nhận cộng điểm'}
                </button>
              )}

              {gameState.phase === 'committed' && !gameState.editingLastCommitted && (
                <>
                  <button
                    type="button"
                    onClick={() => setGameState((prev) => startEditingLastCommittedRound(prev))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa kết quả câu vừa chấm</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleNextOrFinish}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm cursor-pointer"
                  >
                    {gameState.currentDeckIndex + 1 >= gameState.activeDeck.length
                      ? 'Chốt tổng kết →'
                      : `Mở chuẩn bị Câu ${gameState.currentDeckIndex + 2} →`}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* FINAL SUMMARY & REVIEW SCREEN */}
      {/* ===================================================================== */}
      {gameState.phase === 'finished' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#0A162E] border border-amber-400/60 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    {gameState.endedEarly
                      ? 'Tổng kết trận đấu · Kết thúc sớm'
                      : 'Tổng kết Đấu trường 4 đội 3D'}
                  </h2>
                  <p className="text-xs text-slate-300 tabular-nums">
                    Đã chấm {gameState.validRoundsCompleted} / {gameState.activeDeck.length} câu ·
                    Điểm tối đa cấu hình: {maxPossibleScore} điểm
                  </p>
                </div>
              </div>

              {gameState.endedEarly && (
                <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-bold">
                  Kết thúc sớm ({gameState.validRoundsCompleted} câu đã chấm)
                </span>
              )}
            </div>

            {/* Leaderboard with Tie Handling ("Đồng hạng") */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
              {rankings.map((r) => (
                <div
                  key={r.teamId}
                  className={`rounded-xl p-4 border space-y-2 ${
                    r.rank === 1
                      ? 'bg-amber-950/35 border-amber-400/70'
                      : 'bg-slate-900/90 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-amber-300">
                      Hạng {r.rank} {r.isTied ? '· Đồng hạng' : ''}
                    </span>
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold text-white"
                      style={{ backgroundColor: r.colorHex }}
                    >
                      {r.teamId}
                    </span>
                  </div>
                  <div className="text-base font-bold text-white truncate">{r.name}</div>
                  <div className="text-3xl font-extrabold text-white">{r.score} đ</div>
                  <div className="text-xs text-slate-300 space-y-0.5">
                    <div>Số câu đúng: {r.correctCount}</div>
                    {gameState.config.playMode === 'four_teams' &&
                      gameState.config.doublePowerEnabled && (
                        <div>
                          Quyền ×2:{' '}
                          {r.doubleUsedOnRound ? `Đã dùng ở Câu ${r.doubleUsedOnRound}` : 'Chưa dùng'}
                        </div>
                      )}
                  </div>
                </div>
              ))}
            </div>

            {/* Required 4 Summary Action Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewPanel((v) => !v)}
                className="px-4 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 text-xs font-bold cursor-pointer"
              >
                {showReviewPanel ? 'Ẩn lời giải chi tiết' : 'Xem lại lời giải'}
              </button>
              <button
                type="button"
                onClick={handleReplaySameConfig}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Chơi lại</span>
              </button>
              <button
                type="button"
                onClick={handleGoToSetupEditTeams}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                Đổi đội
              </button>
              <button
                type="button"
                onClick={handleExitToLibrary}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
              >
                Về thư viện
              </button>
            </div>
          </div>

          {/* Per-Question History & Full KaTeX Solutions Review */}
          {showReviewPanel && (
            <div className="rounded-2xl bg-[#0A162E] border border-slate-800 p-5 space-y-3">
              <h3 className="text-base font-bold text-white">
                Chi tiết điểm từng câu & Lời giải ({gameState.history.length} lượt ghi nhận)
              </h3>
              {gameState.history.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có câu nào được chấm điểm.</p>
              ) : (
                <div className="space-y-3">
                  {gameState.history.map((rec, idx) => (
                    <div
                      key={`${rec.questionId}-${idx}`}
                      className={`rounded-xl p-4 border space-y-2 text-sm ${
                        rec.cancelled
                          ? 'bg-rose-950/35 border-rose-500/50'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-teal-300">
                          {rec.cancelled
                            ? `Lượt đã hủy (${rec.questionTopic})`
                            : `Câu ${rec.roundNumber} · ${rec.questionTopic}`}
                        </span>
                        {rec.cancelled && (
                          <span className="text-rose-300 font-bold">
                            Lý do hủy: {rec.cancelReason} (đã hoàn quyền ×2)
                          </span>
                        )}
                      </div>

                      <div className="text-white font-semibold overflow-x-auto">
                        <MathView content={rec.questionStemLatex} />
                      </div>

                      {!rec.cancelled && (
                        <>
                          <div className="text-xs sm:text-sm text-emerald-200 overflow-x-auto">
                            <strong>Đáp án: </strong>
                            <MathView content={rec.answerLatex} />
                          </div>
                          <div className="text-xs sm:text-sm text-slate-300 overflow-x-auto">
                            <MathView content={rec.explanationLatex} />
                          </div>
                          <div className="flex flex-wrap gap-2 pt-1 text-xs tabular-nums">
                            {teamStats.map((t) => {
                              const o = rec.outcomes[t.teamId];
                              return (
                                <span
                                  key={t.teamId}
                                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-200"
                                >
                                  <strong>{t.name}</strong>: +{o?.pointsAwarded ?? 0}đ
                                  {o?.usedDouble ? ' (×2)' : ''}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ZOOM FORMULA MODAL (for long formulas / systems of equations on mobile & projector) */}
      {zoomedFormula && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-[#0A162E] border border-teal-400/60 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-teal-300">Phóng to đề bài & công thức</h3>
              <button
                type="button"
                onClick={() => setZoomedFormula(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto text-2xl sm:text-3xl font-bold text-white leading-relaxed py-4">
              <MathView content={zoomedFormula} />
            </div>
          </div>
        </div>
      )}

      {/* CANCEL FAULTY QUESTION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0A162E] border border-rose-500/60 p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-base">
              <AlertTriangle className="w-5 h-5" />
              <span>Hủy câu hỏi lỗi & hoàn quyền Nhân đôi</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Lượt hiện tại sẽ được đánh dấu không hợp lệ trong lịch sử, hoàn lại Quyền Nhân đôi
              cho các đội đã bật ở câu này, và nạp một câu thay thế chưa từng xuất hiện (nếu còn).
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Lý do hủy câu:</label>
              <input
                type="text"
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleConfirmCancelQuestion}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-xs font-bold text-white cursor-pointer"
              >
                Xác nhận hủy câu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FourTeamsArena3DGame;
