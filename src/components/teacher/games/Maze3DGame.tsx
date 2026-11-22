import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Undo2,
  Lightbulb,
  Play,
  StepForward,
  Square,
  RotateCcw,
  Trash2,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Compass,
  ListOrdered,
  ChevronUp,
  ChevronDown,
  Monitor,
  Layers,
  Award,
  BookOpen,
} from 'lucide-react';
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
  F04_SAMPLE_LEVELS,
  F04_SAMPLE_BADGE,
  MazeDirection,
  MazeGameState,
  MazePlayMode,
  GridPos,
  D_DIRECTION_DELTA,
  DIRECTION_LABELS_VI,
  DIRECTION_ARROWS,
  getMazeLevelById,
  validateMazeGrid,
  buildMazeOptimalMathExplanation,
  createMazeGameState,
  stepExploreMaze,
  undoExploreStep,
  requestExploreHint,
  applyActiveExploreHint,
  addPlanCommand,
  removePlanCommandAt,
  movePlanCommand,
  replacePlanCommandAt,
  clearPlanCommands,
  startPlanRunFromStart,
  advancePlanRunOneStep,
  stopPlanRunMidway,
  computePlanDiagnosticHint,
  saveF04Session,
  loadF04Session,
} from './maze3dEngine';
import { Maze3DScene, Maze2DBoard } from './Maze3DScene';

export interface Maze3DGameProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const ALL_DIRECTIONS: MazeDirection[] = ['up', 'down', 'left', 'right'];

function computeSamplePathCells(start: GridPos | null, dirs: MazeDirection[]): GridPos[] {
  if (!start || dirs.length === 0) return [];
  const cells: GridPos[] = [{ ...start }];
  let cur = { ...start };
  for (const d of dirs) {
    cur = {
      row: cur.row + D_DIRECTION_DELTA[d].row,
      col: cur.col + D_DIRECTION_DELTA[d].col,
    };
    cells.push({ ...cur });
  }
  return cells;
}

const Maze3DGame: React.FC<Maze3DGameProps> = ({
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Restore persisted session safely (reloads mid-auto-run ALWAYS come back in STOPPED state)
  const initialSession = useMemo(() => loadF04Session(), []);

  const [gameState, setGameState] = useState<MazeGameState>(() =>
    initialSession ? initialSession.state : createMazeGameState({ levelId: F04_SAMPLE_LEVELS[0].id, mode: 'explore' })
  );
  const [showTrail, setShowTrail] = useState<boolean>(() =>
    initialSession ? initialSession.showTrail : true
  );
  const [renderMode, setRenderMode] = useState<'3d' | '2d'>('3d');
  const [webglAutoFallback, setWebglAutoFallback] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  // Audio & Vietnamese voice synced with A01/A02
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));

  // UI helper panels
  const [showSummaryModal, setShowSummaryModal] = useState<boolean>(false);
  const [showMathPanel, setShowMathPanel] = useState<boolean>(true);
  const [showSamplePathPreview, setShowSamplePathPreview] = useState<boolean>(false);
  const [planDiagnostic, setPlanDiagnostic] = useState<ReturnType<typeof computePlanDiagnosticHint> | null>(null);

  // Refs for audio, timers, and anti-double-click Run guard
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const autoRunTimerRef = useRef<number | null>(null);
  const runLockRef = useRef<boolean>(false);
  const isMutedRef = useRef<boolean>(isMuted);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const stateRef = useRef<MazeGameState>(gameState);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  // Initialize shared sound bank & strict vi-VN voice controller
  useEffect(() => {
    soundBankRef.current = new EduGameSoundBank();
    voiceRef.current = new EduGameVoiceController();
    return () => {
      if (autoRunTimerRef.current !== null) {
        window.clearTimeout(autoRunTimerRef.current);
        autoRunTimerRef.current = null;
      }
      soundBankRef.current?.stopAll();
      soundBankRef.current?.dispose();
      voiceRef.current?.stop();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Persist session changes automatically
  useEffect(() => {
    saveF04Session(gameState, showTrail);
  }, [gameState, showTrail]);

  const currentLevel = useMemo(() => getMazeLevelById(gameState.levelId), [gameState.levelId]);
  const validation = useMemo(() => validateMazeGrid(currentLevel.grid), [currentLevel.grid]);
  const mathExplanation = useMemo(
    () => buildMazeOptimalMathExplanation(validation),
    [validation]
  );

  const samplePathCells = useMemo(() => {
    if (!showSamplePathPreview || !validation.valid) return [];
    return computeSamplePathCells(validation.start, validation.sampleOptimalPath);
  }, [showSamplePathPreview, validation]);

  const clearAutoRunTimer = useCallback(() => {
    if (autoRunTimerRef.current !== null) {
      window.clearTimeout(autoRunTimerRef.current);
      autoRunTimerRef.current = null;
    }
    runLockRef.current = false;
  }, []);

  const stopAllAudio = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const announceVictoryOnce = useCallback((nextState: MazeGameState) => {
    soundBankRef.current?.playMazeGoalFanfare(isMutedRef.current);
    const turnId = `f04-win-${nextState.levelId}-${nextState.mode}-${nextState.stepCount}-${nextState.runAttempts}`;
    const msg = nextState.isOptimal
      ? `Chúc mừng! Robot đã về đích với ${nextState.stepCount} bước tối ưu.`
      : `Robot đã về đích sau ${nextState.stepCount} bước.`;
    voiceRef.current
      ?.announceStudentOnce({
        turnId,
        studentName: '',
        customText: msg,
        isMuted: isMutedRef.current,
        voiceEnabled: voiceEnabledRef.current,
      })
      .catch(() => {});
  }, []);

  // Toggle mute (immediate cut)
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    saveEduGameMuted(next);
    if (next) {
      stopAllAudio();
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

  // Reset / change level / switch mode
  const handleSelectLevel = (levelId: string) => {
    clearAutoRunTimer();
    stopAllAudio();
    setShowSummaryModal(false);
    setShowSamplePathPreview(false);
    setPlanDiagnostic(null);
    voiceRef.current?.resetTurnDedupe();
    setGameState((prev) =>
      createMazeGameState({
        levelId,
        mode: prev.mode,
        classroomEnabled: prev.classroomEnabled,
        groupCount: prev.groupCount,
        classSizeHint: prev.classSizeHint,
      })
    );
  };

  const handleSwitchMode = (nextMode: MazePlayMode) => {
    if (nextMode === gameState.mode) return;
    clearAutoRunTimer();
    stopAllAudio();
    setShowSummaryModal(false);
    setShowSamplePathPreview(false);
    setPlanDiagnostic(null);
    voiceRef.current?.resetTurnDedupe();
    setGameState((prev) =>
      createMazeGameState({
        levelId: prev.levelId,
        mode: nextMode,
        classroomEnabled: prev.classroomEnabled,
        groupCount: prev.groupCount,
        classSizeHint: prev.classSizeHint,
      })
    );
  };

  const handleReplayCurrentLevel = () => {
    clearAutoRunTimer();
    stopAllAudio();
    setShowSummaryModal(false);
    setShowSamplePathPreview(false);
    setPlanDiagnostic(null);
    voiceRef.current?.resetTurnDedupe();
    setGameState((prev) => {
      const fresh = createMazeGameState({
        levelId: prev.levelId,
        mode: prev.mode,
        classroomEnabled: prev.classroomEnabled,
        groupCount: prev.groupCount,
        classSizeHint: prev.classSizeHint,
      });
      // In Plan mode, preserve drafted program when clicking Replay from Summary if desired?
      // Actually "Chơi lại" from summary starts fresh; "Chạy lại" in Plan panel re-runs kept program.
      return fresh;
    });
  };

  // ============================================================================
  // EXPLORE MODE HANDLERS (1 step per click/key, no auto-repeat)
  // ============================================================================

  const handleExploreMove = useCallback(
    (dir: MazeDirection) => {
      const cur = stateRef.current;
      if (cur.mode !== 'explore' || cur.completed) return;
      soundBankRef.current?.unlock();
      const res = stepExploreMaze(cur, dir);
      setGameState(res.state);

      if (res.blocked) {
        soundBankRef.current?.playMazeWallBump(isMutedRef.current);
      } else if (res.moved) {
        if (res.completedNow) {
          announceVictoryOnce(res.state);
          setShowSummaryModal(true);
        } else {
          soundBankRef.current?.playMazeStep(isMutedRef.current);
        }
      }
    },
    [announceVictoryOnce]
  );

  const handleExploreUndo = () => {
    soundBankRef.current?.unlock();
    const res = undoExploreStep(gameState);
    if (res.undone) {
      setGameState(res.state);
      soundBankRef.current?.playMazeStep(isMutedRef.current);
    }
  };

  const handleRequestExploreHint = () => {
    soundBankRef.current?.unlock();
    setGameState((prev) => requestExploreHint(prev));
  };

  const handleApplyExploreHint = () => {
    soundBankRef.current?.unlock();
    const res = applyActiveExploreHint(gameState);
    if (res.applied) {
      setGameState(res.state);
      if (res.completedNow) {
        announceVictoryOnce(res.state);
        setShowSummaryModal(true);
      } else {
        soundBankRef.current?.playMazeStep(isMutedRef.current);
      }
    }
  };

  // Keyboard listener for Explore mode — strictly blocks key-hold auto-repeat (e.repeat)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return; // CRITICAL: holding key never sends continuous burst of steps
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (showSummaryModal) return;
      const cur = stateRef.current;
      if (cur.mode !== 'explore' || cur.completed) return;

      let dir: MazeDirection | null = null;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') dir = 'up';
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') dir = 'down';
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') dir = 'left';
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') dir = 'right';

      if (dir) {
        e.preventDefault();
        handleExploreMove(dir);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExploreMove, showSummaryModal]);

  // ============================================================================
  // PLAN MODE HANDLERS (Compose -> Run / Step / Stop / Restart / Diagnose)
  // ============================================================================

  const scheduleNextAutoStep = useCallback(
    (delayMs: number) => {
      if (autoRunTimerRef.current !== null) {
        window.clearTimeout(autoRunTimerRef.current);
      }
      autoRunTimerRef.current = window.setTimeout(() => {
        autoRunTimerRef.current = null;
        const cur = stateRef.current;
        if (!cur.isAutoRunning || cur.planOutcome.status !== 'running') {
          runLockRef.current = false;
          return;
        }
        const step = advancePlanRunOneStep(cur);
        setGameState(step.state);

        if (step.stepOutcome === 'moved') {
          soundBankRef.current?.playMazeStep(isMutedRef.current);
          scheduleNextAutoStep(reducedMotion ? 210 : 420);
        } else if (step.stepOutcome === 'blocked') {
          runLockRef.current = false;
          soundBankRef.current?.playMazeWallBump(isMutedRef.current);
          setPlanDiagnostic(computePlanDiagnosticHint(step.state));
        } else if (step.stepOutcome === 'completed') {
          runLockRef.current = false;
          announceVictoryOnce(step.state);
          setShowSummaryModal(true);
        } else {
          // incomplete or noop
          runLockRef.current = false;
          soundBankRef.current?.playMazeWallBump(isMutedRef.current);
        }
      }, delayMs);
    },
    [announceVictoryOnce, reducedMotion]
  );

  const handlePlanAutoRun = () => {
    // Anti-double-click guard
    if (runLockRef.current || gameState.isAutoRunning) return;
    soundBankRef.current?.unlock();
    setShowSummaryModal(false);
    setPlanDiagnostic(null);

    const startRes = startPlanRunFromStart(gameState, true);
    setGameState(startRes.state);
    if (!startRes.started) return;

    runLockRef.current = true;
    scheduleNextAutoStep(reducedMotion ? 160 : 300);
  };

  const handlePlanStepOnce = () => {
    if (gameState.isAutoRunning) return;
    soundBankRef.current?.unlock();
    setShowSummaryModal(false);
    setPlanDiagnostic(null);

    let working = gameState;
    if (working.planOutcome.status !== 'running') {
      const startRes = startPlanRunFromStart(working, false);
      if (!startRes.started) {
        setGameState(startRes.state);
        return;
      }
      working = startRes.state;
    }

    const step = advancePlanRunOneStep(working);
    setGameState(step.state);

    if (step.stepOutcome === 'moved') {
      soundBankRef.current?.playMazeStep(isMutedRef.current);
    } else if (step.stepOutcome === 'blocked') {
      soundBankRef.current?.playMazeWallBump(isMutedRef.current);
      setPlanDiagnostic(computePlanDiagnosticHint(step.state));
    } else if (step.stepOutcome === 'completed') {
      announceVictoryOnce(step.state);
      setShowSummaryModal(true);
    } else if (step.stepOutcome === 'incomplete') {
      soundBankRef.current?.playMazeWallBump(isMutedRef.current);
    }
  };

  const handlePlanStop = () => {
    clearAutoRunTimer();
    stopAllAudio();
    setGameState((prev) => stopPlanRunMidway(prev));
  };

  const handlePlanRestartKeepProgram = () => {
    clearAutoRunTimer();
    stopAllAudio();
    setShowSummaryModal(false);
    setPlanDiagnostic(null);
    voiceRef.current?.resetTurnDedupe();
    const startRes = startPlanRunFromStart(
      {
        ...gameState,
        completed: false,
        isAutoRunning: false,
      },
      true
    );
    setGameState(startRes.state);
    if (startRes.started) {
      runLockRef.current = true;
      scheduleNextAutoStep(reducedMotion ? 160 : 300);
    }
  };

  const handlePlanDiagnoseHint = () => {
    soundBankRef.current?.unlock();
    const diag = computePlanDiagnosticHint(gameState);
    setPlanDiagnostic(diag);
  };

  const handleExitToLibrary = () => {
    clearAutoRunTimer();
    stopAllAudio();
    onBackToLibrary();
  };

  // Classroom group controls (shared class progress only)
  const handleAdvanceGroupTurn = () => {
    setGameState((prev) => ({
      ...prev,
      activeGroupIndex: (prev.activeGroupIndex + 1) % prev.groupCount,
    }));
  };

  const cycleDirection = (dir: MazeDirection): MazeDirection => {
    const idx = ALL_DIRECTIONS.indexOf(dir);
    return ALL_DIRECTIONS[(idx + 1) % ALL_DIRECTIONS.length];
  };

  const isPlanEditingLocked = gameState.isAutoRunning;
  const activeHintPos = gameState.mode === 'explore' ? gameState.activeHint?.nextPos ?? null : null;

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-full p-2.5 sm:p-3.5' : 'rounded-2xl p-3 sm:p-4 border border-teal-500/30 shadow-2xl'
      } bg-[#050C1C] text-slate-100 flex flex-col gap-3 overflow-y-auto`}
    >
      {/* TOP BAR — Clean Projector Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/90">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thư viện</span>
          </button>

          <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/40 text-teal-300 text-xs font-extrabold tracking-wide">
            F04
          </span>
          <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
            Mê cung trí tuệ 3D
          </h1>
          <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-amber-300 text-[11px] font-bold">
            {F04_SAMPLE_BADGE}
          </span>
        </div>

        {/* Utility Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Show/Hide Visited Trail */}
          <button
            type="button"
            onClick={() => setShowTrail((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              showTrail
                ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Bật hoặc tắt dấu đường robot đã đi"
          >
            {showTrail ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Dấu đường</span>
          </button>

          {/* 3D / 2D Lightweight Mode */}
          <button
            type="button"
            onClick={() => setRenderMode((m) => (m === '3d' ? '2d' : '3d'))}
            disabled={webglAutoFallback}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-60 ${
              renderMode === '3d'
                ? 'bg-indigo-500/20 border-indigo-400/45 text-indigo-200'
                : 'bg-slate-800/80 border-slate-600 text-slate-200'
            }`}
            title={
              webglAutoFallback
                ? 'Trình duyệt không hỗ trợ WebGL — đang dùng bản 2D nhẹ'
                : 'Chuyển giữa sa bàn 3D và bản đồ 2D nhẹ'
            }
          >
            {renderMode === '3d' ? <Layers className="w-3.5 h-3.5" /> : <Monitor className="w-3.5 h-3.5" />}
            <span>{renderMode === '3d' ? '3D' : '2D nhẹ'}</span>
          </button>

          {/* Reduced Motion */}
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              reducedMotion
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Giảm hiệu ứng chuyển động"
          >
            {reducedMotion ? 'Ít động: Bật' : 'Ít động'}
          </button>

          {/* Shared Audio Mute (synced with A01/A02) */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Đang tắt âm thanh' : 'Đang bật âm thanh'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
          </button>

          {/* Strict Vietnamese Voice Toggle */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
            title="Bật hoặc tắt giọng đọc tiếng Việt (vi-VN)"
          >
            {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Giọng Việt</span>
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* LEVEL & MODE SELECTOR STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B1730] border border-slate-800 rounded-xl px-3 py-2">
        {/* Level selector */}
        <div className="flex flex-wrap items-center gap-1.5">
          {F04_SAMPLE_LEVELS.map((lvl, i) => {
            const active = lvl.id === gameState.levelId;
            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => handleSelectLevel(lvl.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                Màn {i + 1}: {lvl.difficultyLabel}
              </button>
            );
          })}
        </div>

        {/* Mode Switch + Optional Classroom Mode */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => handleSwitchMode('explore')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                gameState.mode === 'explore'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>A. Khám phá</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('plan')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-extrabold transition-colors cursor-pointer ${
                gameState.mode === 'plan'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>B. Lập kế hoạch</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setGameState((prev) => ({
                ...prev,
                classroomEnabled: !prev.classroomEnabled,
              }))
            }
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              gameState.classroomEnabled
                ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Cả lớp</span>
          </button>
        </div>
      </div>

      {/* OPTIONAL CLASSROOM PRESENTATION BAR (1–50 students, 2–6 rotating groups, shared progress only) */}
      {gameState.classroomEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-teal-950/45 border border-teal-500/35 rounded-xl px-3.5 py-2 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-extrabold text-teal-300">
              CHẾ ĐỘ TRÌNH CHIẾU LỚP HỌC (1–50 HS · Tiến độ chung):
            </span>
            <span className="px-2.5 py-1 rounded-md bg-amber-400 text-slate-950 font-extrabold">
              Lượt đề xuất: Nhóm {gameState.activeGroupIndex + 1} / {gameState.groupCount}
            </span>
            <button
              type="button"
              onClick={handleAdvanceGroupTurn}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold cursor-pointer"
            >
              Chuyển sang Nhóm {((gameState.activeGroupIndex + 1) % gameState.groupCount) + 1} →
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
              <span>Số nhóm:</span>
              <select
                value={gameState.groupCount}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  setGameState((prev) => ({
                    ...prev,
                    groupCount: g,
                    activeGroupIndex: prev.activeGroupIndex % g,
                  }));
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-bold"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} nhóm
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
              <span>Sĩ số:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={gameState.classSizeHint}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                  setGameState((prev) => ({ ...prev, classSizeHint: v }));
                }}
                className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white font-bold text-center"
              />
            </label>
          </div>
        </div>
      )}

      {/* VALIDATION GUARD (never allows unsolvable/malformed maze) */}
      {!validation.valid ? (
        <div className="p-6 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-100 space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-base">
            <AlertTriangle className="w-5 h-5 text-rose-400" />
            <span>Mê cung không hợp lệ — đã chặn chạy để đảm bảo an toàn</span>
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      ) : (
        /* MAIN WORKSPACE: Stage left (top on mobile), Controls right (bottom on mobile) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">
          {/* LEFT / TOP: 3D OR 2D MAZE STAGE */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-2.5 min-h-[360px]">
            {/* Compact Stage Metrics Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0B1730] border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-slate-400 font-semibold">Số bước hợp lệ: </span>
                  <span className="text-white font-extrabold text-base">{gameState.stepCount}</span>
                </div>
                <span className="text-slate-700">|</span>
                <div>
                  <span className="text-slate-400 font-semibold">Ngắn nhất (BFS): </span>
                  <span className="text-amber-300 font-extrabold text-base">
                    {validation.shortestDistance} bước
                  </span>
                </div>
                <span className="text-slate-700 hidden sm:inline">|</span>
                <div className="hidden sm:block text-slate-300 font-semibold">
                  Vị trí: hàng {gameState.robotPos.row + 1}, cột {gameState.robotPos.col + 1}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gameState.completed && !showSummaryModal && (
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-extrabold cursor-pointer"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Xem tổng kết</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleReplayCurrentLevel}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
              </div>
            </div>

            {/* Stage Canvas Container */}
            <div className="relative flex-1 min-h-[340px] sm:min-h-[430px] rounded-xl border border-teal-500/30 bg-[#061024] overflow-hidden shadow-inner">
              {renderMode === '3d' && !webglAutoFallback ? (
                <Maze3DScene
                  grid={currentLevel.grid}
                  robotPos={gameState.robotPos}
                  facing={gameState.facing}
                  visitedTrail={gameState.visitedTrail}
                  showTrail={showTrail}
                  lastBlockedPos={gameState.lastBlockedPos}
                  hintPos={activeHintPos}
                  samplePathCells={samplePathCells}
                  completed={gameState.completed}
                  reducedMotion={reducedMotion}
                  onWebGLFallback={handleWebGLFallback}
                />
              ) : (
                <Maze2DBoard
                  grid={currentLevel.grid}
                  robotPos={gameState.robotPos}
                  facing={gameState.facing}
                  visitedTrail={gameState.visitedTrail}
                  showTrail={showTrail}
                  lastBlockedPos={gameState.lastBlockedPos}
                  hintPos={activeHintPos}
                  samplePathCells={samplePathCells}
                  completed={gameState.completed}
                  reducedMotion={reducedMotion}
                />
              )}

              {/* Subtle Legend Strip (bottom-left corner) */}
              <div className="absolute bottom-2.5 left-2.5 flex flex-wrap items-center gap-2 bg-slate-950/85 backdrop-blur-sm border border-slate-700/80 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-200 pointer-events-none">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 inline-block" /> S Xuất phát
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> E Đích
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#f1ece1] inline-block" /> Tường
                </span>
              </div>

              {/* WebGL Auto-Fallback Notice */}
              {webglAutoFallback && (
                <div className="absolute top-2.5 right-2.5 bg-slate-900/90 border border-amber-400/40 text-amber-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                  Tự động dùng bản 2D (thiếu WebGL)
                </div>
              )}

              {/* Completion Summary Modal Overlay */}
              {showSummaryModal && gameState.completed && (
                <div className="absolute inset-0 z-20 bg-slate-950/82 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full max-w-md bg-[#0B1730] border-2 border-amber-400/70 rounded-2xl p-5 shadow-2xl space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center text-amber-300">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-lg font-extrabold text-white">
                            {gameState.isOptimal
                              ? 'Hoàn thành tối ưu!'
                              : 'Robot đã về đích!'}
                          </h2>
                          <p className="text-xs text-slate-300 font-semibold">
                            {currentLevel.title} ·{' '}
                            {gameState.mode === 'explore' ? 'Chế độ Khám phá' : 'Chế độ Lập kế hoạch'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                          gameState.isOptimal
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40'
                            : 'bg-sky-500/20 text-sky-200 border border-sky-400/40'
                        }`}
                      >
                        {gameState.isOptimal ? 'Đường ngắn nhất' : 'Đường hợp lệ'}
                      </span>
                    </div>

                    {/* Summary Metrics Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                        <div className="text-[11px] text-slate-400 font-semibold">Số bước thực tế</div>
                        <div className="text-xl font-extrabold text-white">{gameState.stepCount}</div>
                      </div>
                      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                        <div className="text-[11px] text-slate-400 font-semibold">Ngắn nhất (BFS)</div>
                        <div className="text-xl font-extrabold text-amber-300">
                          {validation.shortestDistance}
                        </div>
                      </div>
                      {gameState.mode === 'plan' ? (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                          <div className="text-[11px] text-slate-400 font-semibold">Số lần chạy thử</div>
                          <div className="text-xl font-extrabold text-teal-300">
                            {gameState.runAttempts}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
                          <div className="text-[11px] text-slate-400 font-semibold">Hoàn tác / Gợi ý</div>
                          <div className="text-lg font-extrabold text-teal-300">
                            {gameState.undoCount} / {gameState.hintsAppliedCount}
                          </div>
                        </div>
                      )}
                    </div>

                    {gameState.mode === 'plan' && gameState.planOutcome.unusedCommandsCount > 0 && (
                      <div className="text-xs bg-amber-500/15 border border-amber-400/35 text-amber-200 rounded-lg px-3 py-2 font-semibold">
                        Robot đã dừng ngay tại ô đích E — còn thừa{' '}
                        <strong>{gameState.planOutcome.unusedCommandsCount}</strong> lệnh ở cuối chuỗi
                        không cần dùng.
                      </div>
                    )}

                    {/* MathView Optimal Path Insight */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 leading-relaxed">
                      <MathView content={mathExplanation} />
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowTrail(true);
                          setShowSummaryModal(false);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/50 text-teal-200 text-xs font-extrabold cursor-pointer"
                      >
                        Xem lại đường đi
                      </button>
                      <button
                        type="button"
                        onClick={handleReplayCurrentLevel}
                        className="px-3 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer"
                      >
                        Chơi lại màn này
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const idx = F04_SAMPLE_LEVELS.findIndex((l) => l.id === gameState.levelId);
                          const next = F04_SAMPLE_LEVELS[(idx + 1) % F04_SAMPLE_LEVELS.length];
                          handleSelectLevel(next.id);
                        }}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Đổi mê cung →
                      </button>
                      <button
                        type="button"
                        onClick={handleExitToLibrary}
                        className="px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Về thư viện
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Live Status Feedback Banner */}
            {gameState.statusMessage && (
              <div
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold border ${
                  gameState.lastBlockedPos || gameState.planOutcome.status === 'blocked'
                    ? 'bg-rose-950/60 border-rose-500/50 text-rose-200'
                    : gameState.completed
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                      : 'bg-slate-900/90 border-slate-700 text-slate-200'
                }`}
              >
                {gameState.lastBlockedPos || gameState.planOutcome.status === 'blocked' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : gameState.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                )}
                <span>{gameState.statusMessage}</span>
              </div>
            )}
          </div>

          {/* RIGHT / BOTTOM: CONTROLS PANEL */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-3 min-h-0">
            {gameState.mode === 'explore' ? (
              /* MODE A: EXPLORE CONTROLS */
              <div className="bg-[#0B1730] border border-slate-800 rounded-xl p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-extrabold text-white">
                    Điều khiển trực tiếp (4 hướng cố định theo bản đồ)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bấm nút hoặc nhấn từng phím mũi tên / W-A-S-D. Mỗi lần bấm đi đúng 1 ô.
                  </p>
                </div>

                {/* Tactile Directional Pad */}
                <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
                  <div />
                  <button
                    type="button"
                    onClick={() => handleExploreMove('up')}
                    disabled={gameState.completed}
                    className="h-14 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 active:scale-95 border border-slate-700 flex flex-col items-center justify-center font-extrabold text-xs transition-all cursor-pointer disabled:opacity-45"
                    aria-label="Đi Lên"
                  >
                    <ArrowUp className="w-5 h-5" />
                    <span>Lên</span>
                  </button>
                  <div />

                  <button
                    type="button"
                    onClick={() => handleExploreMove('left')}
                    disabled={gameState.completed}
                    className="h-14 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 active:scale-95 border border-slate-700 flex flex-col items-center justify-center font-extrabold text-xs transition-all cursor-pointer disabled:opacity-45"
                    aria-label="Đi Trái"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Trái</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExploreMove('down')}
                    disabled={gameState.completed}
                    className="h-14 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 active:scale-95 border border-slate-700 flex flex-col items-center justify-center font-extrabold text-xs transition-all cursor-pointer disabled:opacity-45"
                    aria-label="Đi Xuống"
                  >
                    <ArrowDown className="w-5 h-5" />
                    <span>Xuống</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExploreMove('right')}
                    disabled={gameState.completed}
                    className="h-14 rounded-xl bg-slate-800 hover:bg-teal-500 hover:text-slate-950 active:scale-95 border border-slate-700 flex flex-col items-center justify-center font-extrabold text-xs transition-all cursor-pointer disabled:opacity-45"
                    aria-label="Đi Phải"
                  >
                    <ArrowRight className="w-5 h-5" />
                    <span>Phải</span>
                  </button>
                </div>

                {/* Undo + Hint Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExploreUndo}
                    disabled={gameState.completed || gameState.visitedTrail.length <= 1}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-extrabold text-slate-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Undo2 className="w-4 h-4" />
                    <span>Hoàn tác ({gameState.undoCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestExploreHint}
                    disabled={gameState.completed}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-extrabold text-amber-200 disabled:opacity-40 cursor-pointer"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>Gợi ý bước tiếp</span>
                  </button>
                </div>

                {/* Active BFS Hint Box — ONLY applies on explicit click */}
                {gameState.activeHint && gameState.activeHint.recommendedDirection && (
                  <div className="rounded-xl bg-amber-950/45 border border-amber-400/50 p-3 space-y-2.5">
                    <div className="text-xs text-amber-100 leading-relaxed">
                      <MathView content={gameState.activeHint.explanationLatex} />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleApplyExploreHint}
                        className="flex-1 px-3 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer"
                      >
                        Áp dụng gợi ý ({DIRECTION_LABELS_VI[gameState.activeHint.recommendedDirection]}{' '}
                        {DIRECTION_ARROWS[gameState.activeHint.recommendedDirection]})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameState((prev) => ({ ...prev, activeHint: null }))}
                        className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}

                {/* Separate counters readout */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 font-semibold">
                  <span>Hoàn tác đã dùng: {gameState.undoCount}</span>
                  <span>Gợi ý đã áp dụng: {gameState.hintsAppliedCount}</span>
                </div>
              </div>
            ) : (
              /* MODE B: PLAN / COMMAND SEQUENCE BUILDER */
              <div className="bg-[#0B1730] border border-slate-800 rounded-xl p-3.5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-extrabold text-white">
                      Lập chuỗi lệnh ({gameState.program.length} lệnh)
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Bấm thêm lệnh theo thứ tự, sau đó Chạy thử từ ô S.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-teal-300 bg-teal-500/15 border border-teal-500/35 px-2 py-0.5 rounded-md">
                    Lần chạy: {gameState.runAttempts}
                  </span>
                </div>

                {/* Add Direction Buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {ALL_DIRECTIONS.map((dir) => (
                    <button
                      key={dir}
                      type="button"
                      disabled={isPlanEditingLocked || gameState.completed}
                      onClick={() => {
                        setPlanDiagnostic(null);
                        setGameState((prev) => addPlanCommand(prev, dir));
                      }}
                      className="py-2 px-1.5 rounded-lg bg-slate-800 hover:bg-teal-500 hover:text-slate-950 border border-slate-700 text-xs font-extrabold flex flex-col items-center gap-0.5 transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <span className="text-base leading-none">{DIRECTION_ARROWS[dir]}</span>
                      <span>{DIRECTION_LABELS_VI[dir]}</span>
                    </button>
                  ))}
                </div>

                {/* Sequence List (clickable edit / reorder / delete without drag-and-drop) */}
                <div className="max-h-[210px] overflow-y-auto space-y-1.5 pr-1 bg-slate-950/60 border border-slate-800 rounded-xl p-2">
                  {gameState.program.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                      Chưa có lệnh nào. Bấm các nút hướng phía trên để tạo chuỗi lệnh.
                    </div>
                  ) : (
                    gameState.program.map((dir, idx) => {
                      const isExecuting =
                        gameState.planOutcome.status === 'running' &&
                        gameState.planOutcome.currentStepIndex === idx;
                      const isBlockedCmd = gameState.planOutcome.blockedCommandIndex === idx;
                      const isExecutedOk =
                        gameState.planOutcome.currentStepIndex >= idx &&
                        !isBlockedCmd &&
                        gameState.planOutcome.status !== 'idle';

                      return (
                        <div
                          key={`${idx}-${dir}`}
                          className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                            isBlockedCmd
                              ? 'bg-rose-950/75 border-rose-500 text-rose-100'
                              : isExecuting
                                ? 'bg-amber-400/25 border-amber-400 text-amber-100'
                                : isExecutedOk
                                  ? 'bg-teal-950/50 border-teal-500/45 text-teal-100'
                                  : 'bg-slate-900/90 border-slate-800 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-[11px] font-extrabold text-slate-400">
                              #{idx + 1}
                            </span>
                            <button
                              type="button"
                              disabled={isPlanEditingLocked || gameState.completed}
                              onClick={() => {
                                setPlanDiagnostic(null);
                                setGameState((prev) =>
                                  replacePlanCommandAt(prev, idx, cycleDirection(dir))
                                );
                              }}
                              title="Bấm để đổi hướng nhanh cho lệnh này"
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-extrabold cursor-pointer disabled:opacity-60"
                            >
                              <span>{DIRECTION_ARROWS[dir]}</span>
                              <span>{DIRECTION_LABELS_VI[dir]}</span>
                            </button>
                            {isBlockedCmd && (
                              <span className="text-[10px] font-extrabold text-rose-300">
                                Gặp tường
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={isPlanEditingLocked || gameState.completed || idx === 0}
                              onClick={() =>
                                setGameState((prev) => movePlanCommand(prev, idx, -1))
                              }
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              aria-label={`Đưa lệnh ${idx + 1} lên trước`}
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={
                                isPlanEditingLocked ||
                                gameState.completed ||
                                idx === gameState.program.length - 1
                              }
                              onClick={() =>
                                setGameState((prev) => movePlanCommand(prev, idx, 1))
                              }
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                              aria-label={`Đưa lệnh ${idx + 1} xuống sau`}
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={isPlanEditingLocked || gameState.completed}
                              onClick={() => {
                                setPlanDiagnostic(null);
                                setGameState((prev) => removePlanCommandAt(prev, idx));
                              }}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                              aria-label={`Xóa lệnh ${idx + 1}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Execution Controls */}
                <div className="grid grid-cols-2 gap-2">
                  {!gameState.isAutoRunning ? (
                    <button
                      type="button"
                      onClick={handlePlanAutoRun}
                      disabled={gameState.program.length === 0}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-extrabold disabled:opacity-40 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      <span>Chạy thử</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePlanStop}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-extrabold cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      <span>Dừng chạy</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handlePlanStepOnce}
                    disabled={gameState.isAutoRunning || gameState.program.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-extrabold disabled:opacity-40 cursor-pointer"
                  >
                    <StepForward className="w-4 h-4" />
                    <span>Chạy từng bước</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePlanRestartKeepProgram}
                    disabled={gameState.program.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Chạy lại từ S</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPlanEditingLocked || gameState.program.length === 0}
                    onClick={() => {
                      setPlanDiagnostic(null);
                      setGameState((prev) => clearPlanCommands(prev));
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa chuỗi</span>
                  </button>
                </div>

                {/* Diagnostic Hint FIRST + Separate Optional Sample Path Toggle */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handlePlanDiagnoseHint}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-extrabold cursor-pointer"
                  >
                    <Lightbulb className="w-3.5 h-3.5" />
                    <span>Gợi ý sửa lệnh</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSamplePathPreview((v) => !v)}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold cursor-pointer ${
                      showSamplePathPreview
                        ? 'bg-amber-400 text-slate-950 border-amber-300'
                        : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300'
                    }`}
                  >
                    {showSamplePathPreview ? 'Ẩn đường mẫu' : 'Xem đường mẫu'}
                  </button>
                </div>

                {planDiagnostic && (
                  <div className="rounded-xl bg-amber-950/45 border border-amber-400/50 p-3 text-xs space-y-1">
                    <div className="font-extrabold text-amber-300">{planDiagnostic.title}</div>
                    <p className="text-amber-100 leading-relaxed">{planDiagnostic.detail}</p>
                  </div>
                )}

                {showSamplePathPreview && validation.sampleOptimalPath.length > 0 && (
                  <div className="rounded-xl bg-slate-900/90 border border-amber-400/40 p-2.5 text-xs space-y-1">
                    <div className="font-extrabold text-amber-300">
                      Một đường mẫu ngắn nhất ({validation.sampleOptimalPath.length} bước):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {validation.sampleOptimalPath.map((d, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-100 font-bold text-[11px]"
                        >
                          {i + 1}.{DIRECTION_ARROWS[d]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SHARED MATHVIEW PANEL — Explains shortest path mathematics */}
            <div className="bg-[#0B1730] border border-slate-800 rounded-xl p-3.5 space-y-2">
              <button
                type="button"
                onClick={() => setShowMathPanel((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-extrabold text-teal-300 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Góc Toán học · Đường đi ngắn nhất</span>
                </span>
                <span className="text-slate-400">{showMathPanel ? 'Thu gọn' : 'Mở rộng'}</span>
              </button>
              {showMathPanel && (
                <div className="text-xs text-slate-200 leading-relaxed space-y-1.5 pt-1 border-t border-slate-800/80">
                  <p className="text-slate-400">{currentLevel.description}</p>
                  <MathView content={mathExplanation} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maze3DGame;
