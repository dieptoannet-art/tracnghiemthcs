import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FastForward,
  Flag,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Ship,
  ShieldAlert,
  Sparkles,
  StopCircle,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
} from '../../../utils/eduGameAudioController';
import {
  BoatQuestionSource,
  BoatRaceMode,
  BoatRaceState,
  BoatTeamConfig,
  BoatTeamMark,
  D02_SAMPLE_BADGE,
  D02_SAMPLE_MATH_QUESTIONS,
  D02_STEP_METERS,
  adaptBankQuestionsForD02,
  advanceBoatAfterConfirm,
  areAllBoatTeamsMarked,
  buildDefaultBoatTeams,
  checkBoatDeadline,
  clearD02Session,
  computeBoatRaceStandings,
  confirmBoatRoundResult,
  createBoatRaceSetupState,
  distributeStudentsIntoBoatTeams,
  endBoatRaceEarly,
  getBoatRemainingTimeMs,
  getCurrentBoatQuestion,
  loadD02Session,
  markBoatMediaReady,
  openBoatQuestion,
  pauseBoatRace,
  replaceFaultyBoatQuestion,
  resumeBoatRace,
  revealBoatAnswerAndPreview,
  saveD02Session,
  setBoatTeamMark,
  setBoatTeamOption,
  startBoatRace,
  startEditingLastBoatRound,
  stopBoatAnswering,
  submitSoloLockedOption,
  validateBoatRaceSetup,
} from './boatRace3dEngine';
import { BoatRace3DScene } from './BoatRace3DScene';

export interface BoatRace3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const TIMER_PRESETS = [
  { value: 0, label: 'Không giới hạn' },
  { value: 20, label: '20 giây' },
  { value: 30, label: '30 giây (Mặc định)' },
  { value: 45, label: '45 giây' },
  { value: 60, label: '60 giây' },
];

export const BoatRace3DGame: React.FC<BoatRace3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & Vietnamese voice controllers (reused cleanly from Smart EDU A01/A02 core)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  if (!soundBankRef.current) soundBankRef.current = new EduGameSoundBank();
  if (!voiceRef.current) voiceRef.current = new EduGameVoiceController(null);

  const [isMuted, setIsMuted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isVoiceReading, setIsVoiceReading] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState<
    ReturnType<EduGameVoiceController['getSnapshot']>
  >(() => voiceRef.current!.getSnapshot());

  // Graphics & projector motion settings
  const [force2D, setForce2D] = useState(false);
  const [webglAutoFallback, setWebglAutoFallback] = useState(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [skipAnimCount, setSkipAnimCount] = useState(0);

  // Setup state
  const [setupMode, setSetupMode] = useState<BoatRaceMode>('teams');
  const [teamCount, setTeamCount] = useState<number>(4);
  const [setupTeams, setSetupTeams] = useState<BoatTeamConfig[]>(() =>
    buildDefaultBoatTeams('teams', 4)
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [questionSource, setQuestionSource] = useState<BoatQuestionSource>('sample_math');
  const [requestedQuestionCount, setRequestedQuestionCount] = useState<number>(10);
  const [targetMeters, setTargetMeters] = useState<number>(800);
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Core deterministic race state
  const [raceState, setRaceState] = useState<BoatRaceState>(() => createBoatRaceSetupState());
  const [savedSession, setSavedSession] = useState<BoatRaceState | null>(() => {
    const loaded = loadD02Session();
    return loaded && loaded.state.phase !== 'setup' ? loaded.state : null;
  });

  // UI transient states
  const [soloSelectedOptionId, setSoloSelectedOptionId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [showEarlyStopConfirm, setShowEarlyStopConfirm] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);

  // Adapt Smart EDU question bank respecting RBAC
  const bankAdapted = useMemo(
    () => adaptBankQuestionsForD02(bankQuestions, userRole),
    [bankQuestions, userRole]
  );

  const activePool = useMemo(
    () => (questionSource === 'bank' ? bankAdapted : D02_SAMPLE_MATH_QUESTIONS),
    [questionSource, bankAdapted]
  );

  // Keep setup teams synced when mode or team count changes
  const handleModeChange = (nextMode: BoatRaceMode) => {
    setSetupMode(nextMode);
    setSelectedClassId('');
    setSetupTeams(buildDefaultBoatTeams(nextMode, teamCount));
    setSetupError(null);
  };

  const handleTeamCountChange = (nextCount: number) => {
    const clamped = Math.max(2, Math.min(6, nextCount));
    setTeamCount(clamped);
    setSetupTeams((prev) => {
      const defaults = buildDefaultBoatTeams('teams', clamped);
      const merged = defaults.map((def, idx) =>
        prev[idx] ? { ...def, name: prev[idx].name, memberNames: [] } : def
      );
      if (selectedClassId) {
        const cls = classes.find((c) => c.id === selectedClassId);
        if (cls) {
          return distributeStudentsIntoBoatTeams(
            merged,
            cls.students.map((s) => s.fullName)
          );
        }
      }
      return merged;
    });
  };

  const handleApplyClassRoster = (classId: string) => {
    setSelectedClassId(classId);
    if (!classId) {
      setSetupTeams((prev) => prev.map((t) => ({ ...t, memberNames: [] })));
      return;
    }
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return;
    setSetupTeams((prev) =>
      distributeStudentsIntoBoatTeams(
        prev,
        cls.students.map((s) => s.fullName)
      )
    );
  };

  const handleQuestionSourceChange = (src: BoatQuestionSource) => {
    setQuestionSource(src);
    const poolLen = src === 'bank' ? bankAdapted.length : D02_SAMPLE_MATH_QUESTIONS.length;
    const nextQ = Math.max(1, Math.min(10, poolLen || 1));
    setRequestedQuestionCount(nextQ);
    setTargetMeters((prev) => {
      const maxM = nextQ * D02_STEP_METERS;
      if (prev > maxM) return Math.max(D02_STEP_METERS, maxM);
      return prev;
    });
    setSetupError(null);
  };

  const handleQuestionCountChange = (val: number) => {
    const safeMax = Math.max(1, activePool.length);
    const clamped = Math.max(1, Math.min(safeMax, val));
    setRequestedQuestionCount(clamped);
    const maxReach = clamped * D02_STEP_METERS;
    if (targetMeters > maxReach) {
      setTargetMeters(maxReach);
    }
    setSetupError(null);
  };

  const setupValidation = useMemo(
    () => validateBoatRaceSetup(requestedQuestionCount, targetMeters, activePool.length),
    [requestedQuestionCount, targetMeters, activePool.length]
  );

  // Subscribe voice manager & cleanup on unmount
  useEffect(() => {
    const voice = voiceRef.current!;
    const sound = soundBankRef.current!;
    const unsub = voice.subscribe(setVoiceSnapshot);
    return () => {
      unsub();
      voice.dispose();
      sound.dispose();
    };
  }, []);

  // Persist active race session automatically (isolated in /demo via getD02StorageKey)
  useEffect(() => {
    if (raceState.phase === 'setup') return;
    saveD02Session(raceState);
  }, [raceState]);

  // Cancel speech on phase/question changes, pause, or mute
  useEffect(() => {
    if (isMuted || raceState.isPaused || raceState.phase === 'setup') {
      voiceRef.current?.stop();
    }
  }, [isMuted, raceState.isPaused, raceState.phase]);

  useEffect(() => {
    voiceRef.current?.stop();
    setSoloSelectedOptionId(null);
    setImageBroken(false);
  }, [raceState.turnToken]);

  // Single deadline-based countdown tick
  useEffect(() => {
    if (
      raceState.phase !== 'answering' ||
      raceState.isPaused ||
      !raceState.mediaReady ||
      raceState.deadlineMs === null
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setRaceState((prev) => {
        const res = checkBoatDeadline(prev, now);
        if (res.expired) {
          soundBankRef.current?.playBoatStopWhistle(isMuted, prev.turnToken);
          return res.state;
        }
        return prev;
      });
    }, 150);
    return () => window.clearInterval(timer);
  }, [
    raceState.phase,
    raceState.isPaused,
    raceState.mediaReady,
    raceState.deadlineMs,
    isMuted,
  ]);

  const standingsReport = useMemo(() => computeBoatRaceStandings(raceState), [raceState]);
  const currentQuestion = useMemo(() => getCurrentBoatQuestion(raceState), [raceState]);
  const allMarked = useMemo(() => areAllBoatTeamsMarked(raceState), [raceState]);

  const remainingMs = getBoatRemainingTimeMs(raceState, nowMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const totalTimerMs = Math.max(1000, raceState.config.timerSeconds * 1000);
  const timerPercent =
    raceState.config.timerSeconds > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalTimerMs) * 100))
      : 100;

  // Target distance dropdown options (multiples of 100 m up to 100 * requestedQuestionCount)
  const targetDistanceOptions = useMemo(() => {
    const maxM = Math.max(1, requestedQuestionCount) * D02_STEP_METERS;
    const list: number[] = [];
    for (let m = D02_STEP_METERS; m <= maxM; m += D02_STEP_METERS) {
      list.push(m);
    }
    return list;
  }, [requestedQuestionCount]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleStartRace = () => {
    soundBankRef.current?.unlock();
    const cleanedTeams = setupTeams.map((t, idx) => ({
      ...t,
      laneIndex: idx,
      name: t.name.trim() || `Đội ${idx + 1}`,
    }));
    const res = startBoatRace(
      {
        mode: setupMode,
        questionSource,
        requestedQuestionCount,
        targetMeters,
        timerSeconds,
        teams: cleanedTeams,
      },
      activePool
    );
    if (res.error) {
      setSetupError(res.error);
      return;
    }
    setSetupError(null);
    setSavedSession(null);
    setShowEarlyStopConfirm(false);
    soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
    soundBankRef.current?.playBoatStartHorn(isMuted, res.state.turnToken);
    setRaceState(res.state);
  };

  const handleResumeSaved = () => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.setActiveTurnToken(savedSession.turnToken);
    setRaceState(savedSession);
    setSavedSession(null);
  };

  const handleDiscardSaved = () => {
    clearD02Session();
    setSavedSession(null);
  };

  const handleOpenQuestion = () => {
    soundBankRef.current?.unlock();
    const q = getCurrentBoatQuestion(raceState);
    const hasImage = Boolean(q?.imageUrl);
    const now = Date.now();
    setNowMs(now);
    const next = openBoatQuestion(raceState, now, !hasImage);
    soundBankRef.current?.setActiveTurnToken(next.turnToken);
    soundBankRef.current?.playBoatStartHorn(isMuted, next.turnToken);
    setRaceState(next);
  };

  const handleReadCurrentQuestion = useCallback(() => {
    if (!currentQuestion || isMuted || !voiceEnabled) return;
    setIsVoiceReading(true);
    voiceRef.current
      ?.replayText({
        text: currentQuestion.plainReadText,
        isMuted,
        voiceEnabled,
      })
      .finally(() => setIsVoiceReading(false));
  }, [currentQuestion, isMuted, voiceEnabled]);

  const handleStopVoice = () => {
    voiceRef.current?.stop();
    setIsVoiceReading(false);
  };

  const handleStopAnswering = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const res = stopBoatAnswering(raceState, Date.now());
    if (res.stoppedNow) {
      soundBankRef.current?.playBoatStopWhistle(isMuted, raceState.turnToken);
      setRaceState(res.state);
    }
  };

  const handleSoloLock = () => {
    if (!soloSelectedOptionId) return;
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const res = submitSoloLockedOption(raceState, soloSelectedOptionId, Date.now());
    if (res.accepted) {
      soundBankRef.current?.playBoatStopWhistle(isMuted, raceState.turnToken);
    }
    setRaceState(res.state);
  };

  const handleRevealAnswer = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const res = revealBoatAnswerAndPreview(raceState);
    if (res.revealed) {
      setRaceState(res.state);
    }
  };

  const handleConfirmRound = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const res = confirmBoatRoundResult(raceState, raceState.turnToken);
    if (!res.confirmed) return;
    setRaceState(res.state);

    const nextReport = computeBoatRaceStandings(res.state);
    if (res.reachedFinishNow) {
      soundBankRef.current?.playBoatFinishFanfare(
        isMuted,
        nextReport.isCoWin,
        res.state.turnToken
      );
    } else if (res.anyAdvanced) {
      soundBankRef.current?.playBoatRowSplash(isMuted, res.state.turnToken);
    } else {
      soundBankRef.current?.playBoatStopWhistle(isMuted, res.state.turnToken);
    }
  };

  const handleEditLastRound = () => {
    soundBankRef.current?.unlock();
    setRaceState((prev) => startEditingLastBoatRound(prev));
  };

  const handleAdvanceAfterConfirm = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const next = advanceBoatAfterConfirm(raceState);
    soundBankRef.current?.setActiveTurnToken(next.turnToken);
    setRaceState(next);
  };

  const handleTogglePause = () => {
    soundBankRef.current?.unlock();
    const now = Date.now();
    setNowMs(now);
    setRaceState((prev) => (prev.isPaused ? resumeBoatRace(prev, now) : pauseBoatRace(prev, now)));
  };

  const handleReplaceFaulty = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const res = replaceFaultyBoatQuestion(raceState);
    if (res.replaced) {
      setImageBroken(false);
      soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
      setRaceState(res.state);
    }
  };

  const handleConfirmEarlyStop = () => {
    voiceRef.current?.stop();
    setShowEarlyStopConfirm(false);
    setRaceState((prev) => endBoatRaceEarly(prev));
  };

  const handleRematchSameSetup = () => {
    soundBankRef.current?.unlock();
    voiceRef.current?.stop();
    const pool =
      raceState.config.questionSource === 'bank' ? bankAdapted : D02_SAMPLE_MATH_QUESTIONS;
    const res = startBoatRace(raceState.config, pool);
    if (!res.error) {
      soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
      soundBankRef.current?.playBoatStartHorn(isMuted, res.state.turnToken);
      setRaceState(res.state);
    }
  };

  const handleBackToSetup = () => {
    voiceRef.current?.stop();
    clearD02Session();
    setSavedSession(null);
    setShowEarlyStopConfirm(false);
    setRaceState(createBoatRaceSetupState(raceState.config));
  };

  const handleExitToLibrary = () => {
    voiceRef.current?.stop();
    soundBankRef.current?.stopAll();
    onBackToLibrary();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const orderedLanes = useMemo(
    () => [...standingsReport.standings].sort((a, b) => a.laneIndex - b.laneIndex),
    [standingsReport.standings]
  );

  return (
    <div
      className={`w-full flex flex-col bg-[#061826] text-slate-50 ${
        isFullscreen
          ? 'h-full overflow-y-auto p-3 sm:p-4'
          : 'rounded-2xl border border-cyan-900/60 shadow-xl p-3 sm:p-5'
      }`}
    >
      {/* TOP CONTROL BAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-cyan-800/45">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitToLibrary}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold text-slate-100 transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thư viện</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-extrabold tracking-wide shrink-0">
              D02
            </span>
            <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
              Đua thuyền 3D
            </h2>
            {raceState.phase !== 'setup' && (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs font-bold text-cyan-200 shrink-0">
                <Flag className="w-3.5 h-3.5 text-amber-300" />
                Đích {raceState.config.targetMeters} m · Câu{' '}
                {Math.min(raceState.currentQuestionIndex + 1, raceState.deck.length)}/
                {raceState.deck.length}
              </span>
            )}
          </div>
        </div>

        {/* Projector & Audio Toolbar */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              soundBankRef.current?.unlock();
              setIsMuted((m) => !m);
            }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              isMuted
                ? 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                : 'bg-slate-800/85 border-slate-700 text-slate-100 hover:bg-slate-700'
            }`}
            title={isMuted ? 'Đang tắt âm' : 'Đang bật âm'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt âm' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setVoiceEnabled((v) => {
                if (v) voiceRef.current?.stop();
                return !v;
              });
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
              voiceEnabled && !isMuted
                ? 'bg-slate-800/85 border-slate-700 text-cyan-200 hover:bg-slate-700'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
            title="Bật hoặc tắt giọng đọc tiếng Việt"
          >
            <span className="hidden sm:inline">
              {voiceEnabled ? 'Giọng đọc: Bật' : 'Giọng đọc: Tắt'}
            </span>
            <span className="sm:hidden">{voiceEnabled ? 'Đọc' : 'Tắt đọc'}</span>
          </button>

          {raceState.phase !== 'setup' && (
            <>
              <button
                type="button"
                onClick={() => setForce2D((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  force2D || webglAutoFallback
                    ? 'bg-teal-900/70 border-teal-400/50 text-teal-100'
                    : 'bg-slate-800/85 border-slate-700 text-slate-100 hover:bg-slate-700'
                }`}
                title="Chuyển nhanh giữa 3D và chế độ 2D nhẹ"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{force2D || webglAutoFallback ? '2D nhẹ' : '3D'}</span>
              </button>

              <button
                type="button"
                onClick={() => setReducedMotion((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                  reducedMotion
                    ? 'bg-amber-900/60 border-amber-400/50 text-amber-100'
                    : 'bg-slate-800/85 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                <span>{reducedMotion ? 'Ít động: Bật' : 'Ít động'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSkipAnimCount((c) => c + 1)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition"
                title="Đưa ngay thuyền tới vị trí đã xác nhận"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Bỏ qua hoạt ảnh</span>
              </button>

              {raceState.phase !== 'summary' && raceState.phase !== 'ready' && (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition ${
                    raceState.isPaused
                      ? 'bg-amber-500 text-slate-950 border-amber-300'
                      : 'bg-slate-800/85 border-slate-700 text-slate-100 hover:bg-slate-700'
                  }`}
                >
                  {raceState.isPaused ? (
                    <Play className="w-3.5 h-3.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5" />
                  )}
                  <span>{raceState.isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
              )}

              {raceState.phase !== 'summary' && (
                <button
                  type="button"
                  onClick={() => setShowEarlyStopConfirm(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-xs font-bold text-rose-100 transition"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kết thúc sớm</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800/85 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition"
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình trình chiếu'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu gọn' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </header>

      {/* INLINE EARLY-STOP CONFIRMATION BAR (never window.confirm) */}
      {showEarlyStopConfirm && raceState.phase !== 'summary' && (
        <div className="mb-3 rounded-xl bg-rose-950/85 border border-rose-400/50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-rose-100">
            Xác nhận <strong>Kết thúc sớm</strong> sau {raceState.history.length} câu đã chơi?
            Các câu chưa mở sẽ không bị tính sai.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEarlyStopConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100"
            >
              Tiếp tục đua
            </button>
            <button
              type="button"
              onClick={handleConfirmEarlyStop}
              className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-xs font-extrabold text-white"
            >
              Chốt kết thúc sớm
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 1: SETUP SCREEN */}
      {/* ==================================================================== */}
      {raceState.phase === 'setup' && (
        <div className="space-y-4">
          {savedSession && (
            <div className="rounded-2xl bg-cyan-950/75 border border-cyan-400/45 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-cyan-100">
                  Phát hiện phiên Đua thuyền 3D chưa hoàn tất
                </p>
                <p className="text-xs text-cyan-200/85 mt-0.5">
                  Đích {savedSession.config.targetMeters} m · Đã chơi {savedSession.history.length}/
                  {savedSession.deck.length} câu · {savedSession.config.teams.length} thuyền.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardSaved}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  Bỏ phiên cũ
                </button>
                <button
                  type="button"
                  onClick={handleResumeSaved}
                  className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-extrabold"
                >
                  Tiếp tục cuộc đua
                </button>
              </div>
            </div>
          )}

          {/* Hero Preview & Mode Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left column: Mode & Teams */}
            <div className="lg:col-span-7 rounded-2xl bg-slate-900/85 border border-cyan-800/45 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300 mb-2">
                  1. Chọn chế độ đua
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    {
                      id: 'teams' as BoatRaceMode,
                      title: 'Thi đua 2–6 đội',
                      desc: 'Mặc định trên lớp (1–50 HS)',
                    },
                    {
                      id: 'solo' as BoatRaceMode,
                      title: 'Tự luyện (1 HS)',
                      desc: '1 thuyền · Chọn & Chốt trước giờ',
                    },
                    {
                      id: 'class_coop' as BoatRaceMode,
                      title: 'Cả lớp chung thuyền',
                      desc: '1 thuyền · Hợp lực về đích',
                    },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleModeChange(m.id)}
                      className={`text-left p-3 rounded-xl border transition ${
                        setupMode === m.id
                          ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                          : 'bg-slate-950/60 border-slate-700/80 text-slate-300 hover:border-cyan-600/60'
                      }`}
                    >
                      <div className="text-sm font-extrabold">{m.title}</div>
                      <div className="text-[11px] text-slate-300/85 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {setupMode === 'teams' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">Số đội đua:</span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleTeamCountChange(cnt)}
                            className={`w-8 h-8 rounded-lg text-xs font-extrabold transition ${
                              teamCount === cnt
                                ? 'bg-cyan-400 text-slate-950'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {classes.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-cyan-300" />
                        <select
                          value={selectedClassId}
                          onChange={(e) => handleApplyClassRoster(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-100 focus:outline-none focus:border-cyan-400"
                          aria-label="Chia nhanh danh sách lớp trong phiên"
                        >
                          <option value="">Không dùng danh sách lớp</option>
                          {classes.map((c) => (
                            <option key={c.id} value={c.id}>
                              Chia lớp {c.name} ({c.students.length} HS)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Editable team cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {setupTeams.map((team, idx) => (
                      <div
                        key={team.teamId}
                        className="rounded-xl bg-slate-950/75 border border-slate-700/80 p-2.5 flex flex-col gap-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                            style={{ backgroundColor: team.colorHex }}
                          >
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={team.name}
                            maxLength={28}
                            onChange={(e) => {
                              const v = e.target.value;
                              setSetupTeams((prev) =>
                                prev.map((t) =>
                                  t.teamId === team.teamId ? { ...t, name: v } : t
                                )
                              );
                            }}
                            placeholder={`Đội ${idx + 1}`}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                        {team.memberNames.length > 0 && (
                          <p className="text-[11px] text-cyan-200/80 truncate pl-8">
                            {team.memberNames.length} HS: {team.memberNames.slice(0, 4).join(', ')}
                            {team.memberNames.length > 4 ? '...' : ''}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {setupMode !== 'teams' && (
                <div className="rounded-xl bg-slate-950/70 border border-slate-700/80 p-3 flex items-center gap-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold shrink-0"
                    style={{ backgroundColor: setupTeams[0]?.colorHex || '#0EA5E9' }}
                  >
                    <Ship className="w-5 h-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Tên thuyền thi đấu
                    </label>
                    <input
                      type="text"
                      value={setupTeams[0]?.name || ''}
                      maxLength={32}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSetupTeams((prev) =>
                          prev.map((t, i) => (i === 0 ? { ...t, name: v } : t))
                        );
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Right column: Question Source & Race Rules */}
            <div className="lg:col-span-5 rounded-2xl bg-slate-900/85 border border-cyan-800/45 p-4 space-y-4">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-cyan-300 mb-2">
                  2. Nguồn câu hỏi & Luật đua
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => handleQuestionSourceChange('sample_math')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      questionSource === 'sample_math'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold">Toán THCS (10 câu)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-200 text-[10px] font-bold">
                        {D02_SAMPLE_BADGE}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300/85 mt-0.5">
                      Bộ mẫu “Đua thuyền Toán THCS” chuẩn KaTeX
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuestionSourceChange('bank')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      questionSource === 'bank'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-950/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-extrabold">Ngân hàng Smart EDU</span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200 text-[10px] font-bold">
                        {bankAdapted.length} câu
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300/85 mt-0.5">
                      {bankAdapted.length > 0
                        ? 'Dùng câu hỏi đúng phân quyền'
                        : 'Chưa có câu phù hợp trong ngân hàng'}
                    </p>
                  </button>
                </div>

                {/* Rule controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Số câu hỏi
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, activePool.length)}
                      value={requestedQuestionCount}
                      onChange={(e) => handleQuestionCountChange(Number(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm font-extrabold text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Quãng đường đích
                    </label>
                    <select
                      value={targetMeters}
                      onChange={(e) => setTargetMeters(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm font-extrabold text-amber-300 focus:outline-none focus:border-cyan-400"
                    >
                      {targetDistanceOptions.map((m) => (
                        <option key={m} value={m}>
                          {m} m ({m / D02_STEP_METERS} câu)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Thời gian / câu
                    </label>
                    <select
                      value={timerSeconds}
                      onChange={(e) => setTimerSeconds(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                    >
                      {TIMER_PRESETS.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Pre-start clear Rule Summary */}
              <div className="rounded-xl bg-cyan-950/60 border border-cyan-500/35 p-3 space-y-1.5 text-xs">
                <div className="font-extrabold text-cyan-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Tóm tắt luật đua (khóa khi xuất phát)</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg bg-slate-950/65 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Số câu</div>
                    <div className="text-sm font-extrabold text-white">{requestedQuestionCount} câu</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/65 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Quãng đường đích</div>
                    <div className="text-sm font-extrabold text-amber-300">{targetMeters} m</div>
                  </div>
                  <div className="rounded-lg bg-slate-950/65 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Cần trả lời đúng</div>
                    <div className="text-sm font-extrabold text-emerald-300">
                      {setupValidation.neededCorrect} câu
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300/90 pt-1 leading-relaxed">
                  Đúng tiến <strong>+100 m</strong> · Sai / Không trả lời <strong>0 m</strong>.
                  Nhiều đội chạm đích cùng một lượt sẽ <strong>Đồng thắng</strong>.
                </p>
              </div>

              {(setupError || !setupValidation.valid) && (
                <div className="rounded-xl bg-rose-950/80 border border-rose-500/50 px-3 py-2 text-xs font-semibold text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{setupError || setupValidation.error}</span>
                </div>
              )}

              <button
                type="button"
                disabled={!setupValidation.valid}
                onClick={handleStartRace}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-45 disabled:cursor-not-allowed text-slate-950 font-extrabold text-base shadow-lg transition flex items-center justify-center gap-2"
              >
                <Ship className="w-5 h-5" />
                <span>Xuất phát Đường đua tri thức</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 2: ACTIVE RACE */}
      {/* ==================================================================== */}
      {raceState.phase !== 'setup' && raceState.phase !== 'summary' && (
        <div className="space-y-3">
          {/* 3D River Racecourse Stage (or 2D lightweight track) */}
          <BoatRace3DScene
            standings={standingsReport.standings}
            targetMeters={raceState.config.targetMeters}
            reducedMotion={reducedMotion}
            skipAnimationTrigger={skipAnimCount}
            force2D={force2D}
            isFullscreen={isFullscreen}
            onWebGLFallback={() => setWebglAutoFallback(true)}
          />

          {/* Crisp Projector Lane Strip (Lane # + Color + Team Name + Exact Meters — zero color-only encoding) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {orderedLanes.map((row) => (
              <div
                key={row.teamId}
                className={`rounded-xl px-3 py-2 border flex flex-col gap-0.5 ${
                  row.finished
                    ? 'bg-amber-500/20 border-amber-400 shadow-md'
                    : 'bg-slate-900/90 border-cyan-800/45'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-extrabold text-white shrink-0"
                      style={{ backgroundColor: row.colorHex }}
                    >
                      {row.laneIndex + 1}
                    </span>
                    <span className="text-xs font-extrabold text-white truncate">{row.name}</span>
                  </div>
                  {row.finished && <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                </div>
                <div className="flex items-baseline justify-between text-xs tabular-nums">
                  <span className="font-extrabold text-cyan-200">{row.displayMeters} m</span>
                  <span className="text-[11px] text-slate-400">
                    {row.remainingMeters > 0 ? `còn ${row.remainingMeters} m` : 'Đã về đích'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* PAUSE CURTAIN (Hides question & locks all commits while preserving remaining ms) */}
          {raceState.isPaused ? (
            <div className="rounded-2xl bg-slate-900/95 border border-amber-400/50 p-8 text-center space-y-3">
              <Pause className="w-10 h-10 text-amber-300 mx-auto" />
              <h3 className="text-xl font-extrabold text-white">Cuộc đua đang tạm dừng</h3>
              <p className="text-sm text-slate-300">
                Nội dung câu hỏi tạm ẩn để đảm bảo công bằng.
                {raceState.pausedRemainingMs !== null && (
                  <>
                    {' '}
                    Thời gian còn lại được giữ nguyên:{' '}
                    <strong className="text-amber-300">
                      {Math.ceil(raceState.pausedRemainingMs / 1000)} giây
                    </strong>
                    .
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={handleTogglePause}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm"
              >
                <Play className="w-4 h-4" />
                <span>Tiếp tục cuộc đua</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-900/90 border border-cyan-800/50 p-4 space-y-4">
              {/* Status banner + Voice controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-xs font-extrabold text-cyan-200">
                    Câu {raceState.currentQuestionIndex + 1} / {raceState.deck.length}
                  </span>
                  {currentQuestion && (
                    <>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">
                        {currentQuestion.topic}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
                        {currentQuestion.sourceBadge}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {raceState.phase !== 'ready' && currentQuestion && (
                    <>
                      <button
                        type="button"
                        disabled={isMuted || !voiceSnapshot.hasVietnameseVoice}
                        onClick={handleReadCurrentQuestion}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-bold text-cyan-200"
                        title={
                          voiceSnapshot.hasVietnameseVoice
                            ? 'Đọc đề câu hỏi bằng giọng tiếng Việt'
                            : 'Thiết bị chưa cài giọng tiếng Việt (trò chơi vẫn hoạt động bình thường)'
                        }
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Đọc đề</span>
                      </button>
                      {isVoiceReading && (
                        <button
                          type="button"
                          onClick={handleStopVoice}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/25 border border-amber-400/50 text-xs font-bold text-amber-200"
                        >
                          Bỏ qua đọc
                        </button>
                      )}
                    </>
                  )}

                  {/* Single deadline clock display */}
                  {raceState.config.timerSeconds > 0 && raceState.phase === 'answering' && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-extrabold tabular-nums ${
                        !raceState.mediaReady
                          ? 'bg-slate-800 border-slate-600 text-slate-300'
                          : remainingSec <= 5
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                            : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>
                        {!raceState.mediaReady ? 'Chờ ảnh...' : `${remainingSec}s`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar for active deadline timer */}
              {raceState.config.timerSeconds > 0 &&
                raceState.phase === 'answering' &&
                raceState.mediaReady && (
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-150 ${
                        remainingSec <= 5 ? 'bg-rose-400' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${timerPercent}%` }}
                    />
                  </div>
                )}

              {/* STEP A: READY TO OPEN QUESTION */}
              {raceState.phase === 'ready' && currentQuestion && (
                <div className="py-6 text-center space-y-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-cyan-300">
                    Sẵn sàng lượt {raceState.currentQuestionIndex + 1} · Chủ đề: {currentQuestion.topic}
                  </div>
                  <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto">
                    {raceState.statusMessage}
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenQuestion}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-base shadow-lg transition"
                  >
                    <Play className="w-5 h-5" />
                    <span>Mở câu hỏi</span>
                  </button>
                </div>
              )}

              {/* QUESTION BODY (Visible in answering / stopped / revealed / round_confirmed) */}
              {raceState.phase !== 'ready' && currentQuestion && (
                <div className="space-y-4">
                  {/* Stem */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-4 sm:p-5">
                    <div className="text-lg sm:text-2xl font-bold text-white leading-relaxed">
                      <MathView content={currentQuestion.stemLatex} />
                    </div>

                    {/* Optional question image with readiness gating + faulty swap */}
                    {currentQuestion.imageUrl && (
                      <div className="mt-3">
                        {!imageBroken ? (
                          <img
                            src={currentQuestion.imageUrl}
                            alt="Hình minh họa câu hỏi"
                            onLoad={() =>
                              setRaceState((prev) => markBoatMediaReady(prev, Date.now()))
                            }
                            onError={() => {
                              setImageBroken(true);
                              setRaceState((prev) => markBoatMediaReady(prev, Date.now()));
                            }}
                            className="max-h-56 rounded-xl border border-slate-700 object-contain mx-auto bg-white/95 p-1"
                          />
                        ) : (
                          <div className="rounded-xl bg-amber-950/60 border border-amber-400/50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
                            <span>Không tải được hình ảnh minh họa của câu hỏi này.</span>
                            {raceState.reserveDeck.length > 0 && (
                              <button
                                type="button"
                                onClick={handleReplaceFaulty}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-extrabold"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Đổi câu dự phòng</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Options Grid (for single_choice / true_false) */}
                  {currentQuestion.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentQuestion.options.map((opt) => {
                        const isRevealed =
                          raceState.phase === 'revealed' || raceState.phase === 'round_confirmed';
                        const isCorrect = opt.optionId === currentQuestion.correctOptionId;
                        const isSoloPicked =
                          raceState.config.mode === 'solo' &&
                          (soloSelectedOptionId === opt.optionId ||
                            raceState.soloLockedOptionId === opt.optionId);
                        const canSoloSelect =
                          raceState.config.mode === 'solo' && raceState.phase === 'answering';

                        return (
                          <button
                            key={opt.optionId}
                            type="button"
                            disabled={!canSoloSelect}
                            onClick={() => canSoloSelect && setSoloSelectedOptionId(opt.optionId)}
                            className={`text-left rounded-xl p-3.5 border-2 transition flex items-start gap-3 ${
                              isRevealed && isCorrect
                                ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-md'
                                : isSoloPicked
                                  ? 'bg-cyan-500/25 border-cyan-400 text-white'
                                  : 'bg-slate-950/70 border-slate-700/85 text-slate-100 hover:border-cyan-500/60 disabled:hover:border-slate-700/85'
                            }`}
                          >
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-extrabold shrink-0 ${
                                isRevealed && isCorrect
                                  ? 'bg-emerald-400 text-slate-950'
                                  : isSoloPicked
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'bg-slate-800 text-cyan-200'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="text-base sm:text-lg font-bold leading-snug pt-0.5">
                              <MathView content={opt.textLatex} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* ANSWERING CONTROLS */}
                  {raceState.phase === 'answering' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <div className="text-xs sm:text-sm text-cyan-100/90 font-medium">
                        {raceState.statusMessage}
                      </div>
                      <div className="flex items-center gap-2">
                        {raceState.reserveDeck.length > 0 && (
                          <button
                            type="button"
                            onClick={handleReplaceFaulty}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200"
                            title="Thay thế câu hỏi lỗi bằng câu dự phòng chưa dùng"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Đổi câu dự phòng</span>
                          </button>
                        )}

                        {raceState.config.mode === 'solo' && currentQuestion.options.length > 0 ? (
                          <button
                            type="button"
                            disabled={!soloSelectedOptionId || !raceState.mediaReady}
                            onClick={handleSoloLock}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-45 text-slate-950 font-extrabold text-sm shadow-md"
                          >
                            <Check className="w-4 h-4" />
                            <span>Chốt đáp án</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleStopAnswering}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-md"
                          >
                            <StopCircle className="w-4 h-4" />
                            <span>Dừng trả lời & Chấm lượt</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* REVEALED EXPLANATION PANEL */}
                  {(raceState.phase === 'revealed' || raceState.phase === 'round_confirmed') && (
                    <div className="rounded-xl bg-emerald-950/55 border border-emerald-400/45 p-3.5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Đáp án đúng:</span>
                        <span className="text-white">
                          <MathView content={currentQuestion.answerLatex} />
                        </span>
                      </div>
                      <div className="text-xs sm:text-sm text-emerald-50/90 leading-relaxed">
                        <MathView content={currentQuestion.explanationLatex} />
                      </div>
                    </div>
                  )}

                  {/* TEACHER GRADING MATRIX (stopped / revealed / editingLastConfirmed) */}
                  {(raceState.phase === 'stopped' ||
                    raceState.phase === 'revealed' ||
                    (raceState.phase === 'round_confirmed' && raceState.editingLastConfirmed)) && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                          {raceState.editingLastConfirmed
                            ? 'Sửa kết quả câu vừa xác nhận (tự tính lại vị trí & về đích)'
                            : 'Ghi nhận kết quả từng đội (nhập đồng thời)'}
                        </h4>
                        {raceState.phase === 'stopped' && (
                          <span className="text-[11px] text-slate-300">
                            Chưa chấm không tự tính sai · Hãy chấm đủ tất cả đội trước khi công bố
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {orderedLanes.map((team) => {
                          const mark = raceState.draftMarks[team.teamId] || 'unmarked';
                          const pickedOptId = raceState.draftOptionIds[team.teamId] || null;
                          const previewDelta = mark === 'correct' ? D02_STEP_METERS : 0;
                          return (
                            <div
                              key={team.teamId}
                              className="rounded-xl bg-slate-950/80 border border-slate-700/80 p-3 flex flex-col gap-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                                    style={{ backgroundColor: team.colorHex }}
                                  >
                                    {team.laneIndex + 1}
                                  </span>
                                  <span className="text-sm font-extrabold text-white truncate">
                                    {team.name}
                                  </span>
                                </div>
                                <span className="text-xs font-bold tabular-nums text-cyan-200 shrink-0">
                                  {team.displayMeters} m
                                  {previewDelta > 0 && !raceState.editingLastConfirmed && (
                                    <span className="text-emerald-300"> (+{previewDelta} m)</span>
                                  )}
                                </span>
                              </div>

                              {/* Optional quick A/B/C/D selector for teacher input */}
                              {currentQuestion.options.length > 0 &&
                                raceState.config.mode !== 'solo' && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-slate-400 mr-1">Chọn nhanh:</span>
                                    {currentQuestion.options.map((opt) => (
                                      <button
                                        key={opt.optionId}
                                        type="button"
                                        onClick={() =>
                                          setRaceState((prev) =>
                                            setBoatTeamOption(prev, team.teamId, opt.optionId)
                                          )
                                        }
                                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition ${
                                          pickedOptId === opt.optionId
                                            ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}

                              {/* Direct Right / Wrong / No Answer buttons */}
                              <div className="grid grid-cols-3 gap-1.5">
                                {(
                                  [
                                    {
                                      m: 'correct' as BoatTeamMark,
                                      label: 'Đúng (+100m)',
                                      active: 'bg-emerald-500 text-slate-950 border-emerald-300',
                                    },
                                    {
                                      m: 'wrong' as BoatTeamMark,
                                      label: 'Sai (0m)',
                                      active: 'bg-rose-500 text-white border-rose-300',
                                    },
                                    {
                                      m: 'no_answer' as BoatTeamMark,
                                      label: 'Không TL (0m)',
                                      active: 'bg-slate-600 text-white border-slate-400',
                                    },
                                  ] as const
                                ).map((btn) => (
                                  <button
                                    key={btn.m}
                                    type="button"
                                    onClick={() =>
                                      setRaceState((prev) =>
                                        setBoatTeamMark(prev, team.teamId, btn.m, null)
                                      )
                                    }
                                    className={`py-1.5 px-2 rounded-lg text-xs font-extrabold border transition ${
                                      mark === btn.m
                                        ? btn.active
                                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                                    }`}
                                  >
                                    {btn.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Action Footer */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                        {raceState.phase === 'stopped' && (
                          <button
                            type="button"
                            disabled={!allMarked}
                            onClick={handleRevealAnswer}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-extrabold text-sm shadow-md"
                          >
                            <Eye className="w-4 h-4" />
                            <span>Công bố đáp án & Xem trước</span>
                          </button>
                        )}

                        {(raceState.phase === 'revealed' || raceState.editingLastConfirmed) && (
                          <button
                            type="button"
                            disabled={!allMarked}
                            onClick={handleConfirmRound}
                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-45 text-slate-950 font-extrabold text-sm shadow-md"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>
                              {raceState.editingLastConfirmed
                                ? 'Lưu chỉnh sửa & Tính lại vị trí'
                                : 'Xác nhận cập nhật thuyền'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ROUND CONFIRMED FOOTER (Supports Editing Just-Confirmed Round EVEN IF Finish Triggered!) */}
                  {raceState.phase === 'round_confirmed' && !raceState.editingLastConfirmed && (
                    <div className="rounded-xl bg-cyan-950/70 border border-cyan-400/45 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="text-sm font-extrabold text-white flex items-center gap-2">
                          {standingsReport.hasFinisher && (
                            <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
                          )}
                          <span>{raceState.statusMessage}</span>
                        </div>
                        <p className="text-xs text-cyan-200/80">
                          Mọi vị trí thuyền đều tính chuẩn từ lịch sử lượt đã xác nhận.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleEditLastRound}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-amber-200"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa kết quả câu vừa rồi</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleAdvanceAfterConfirm}
                          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-md"
                        >
                          {raceState.readyToFinishSummary ? (
                            <>
                              <Trophy className="w-4 h-4" />
                              <span>Chốt tổng kết cuộc đua</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4" />
                              <span>Câu tiếp theo</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* PHASE 3: SUMMARY & KNOWLEDGE REVIEW */}
      {/* ==================================================================== */}
      {raceState.phase === 'summary' && (
        <div className="space-y-4">
          {/* Headline Banner */}
          <div
            className={`rounded-2xl p-5 border text-center space-y-2 ${
              standingsReport.hasFinisher
                ? 'bg-gradient-to-r from-cyan-950 via-emerald-950 to-cyan-950 border-amber-400/60'
                : 'bg-slate-900/90 border-cyan-700/50'
            }`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/70 border border-cyan-400/35 text-xs font-extrabold text-cyan-200">
              {standingsReport.hasFinisher ? (
                <Trophy className="w-4 h-4 text-amber-300" />
              ) : (
                <Flag className="w-4 h-4 text-cyan-300" />
              )}
              <span>
                {raceState.endedEarly
                  ? `Kết thúc sớm · Đã chơi ${standingsReport.playedCount}/${raceState.deck.length} câu`
                  : standingsReport.hasFinisher
                    ? standingsReport.isCoWin
                      ? 'Đồng thắng về đích!'
                      : 'Hoàn thành Đường đua tri thức'
                    : 'Hết bộ câu hỏi · Chưa có đội về đích'}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white">
              {standingsReport.statusHeadline}
            </h3>
            <p className="text-xs sm:text-sm text-cyan-100/85">
              Quãng đường đích: <strong>{raceState.config.targetMeters} m</strong> · Số lượt đã
              chơi: <strong>{standingsReport.playedCount}/{raceState.deck.length}</strong>
              {raceState.endedEarly &&
                ` · Chưa mở: ${Math.max(0, raceState.deck.length - standingsReport.playedCount)} câu (không tính sai)`}
            </p>
          </div>

          {/* Final Snapshot Stage */}
          <BoatRace3DScene
            standings={standingsReport.standings}
            targetMeters={raceState.config.targetMeters}
            reducedMotion={true}
            skipAnimationTrigger={skipAnimCount + 1}
            force2D={force2D}
            isFullscreen={false}
          />

          {/* Standings Table */}
          <div className="rounded-2xl bg-slate-900/90 border border-cyan-800/45 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-cyan-200 uppercase tracking-wider">
                Bảng xếp hạng quãng đường
              </h4>
              <span className="text-xs text-slate-400">Bằng quãng đường → Đồng hạng</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/70 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Hạng</th>
                    <th className="px-4 py-2.5">Đội / Thuyền</th>
                    <th className="px-4 py-2.5 text-right">Quãng đường</th>
                    <th className="px-4 py-2.5 text-right">Đúng</th>
                    <th className="px-4 py-2.5 text-right">Sai</th>
                    <th className="px-4 py-2.5 text-right">Không TL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {standingsReport.standings.map((row) => (
                    <tr key={row.teamId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2.5 font-extrabold text-amber-300 whitespace-nowrap">
                        {row.isTiedRank ? `Đồng hạng ${row.rank}` : `Hạng ${row.rank}`}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0"
                            style={{ backgroundColor: row.colorHex }}
                          >
                            {row.laneIndex + 1}
                          </span>
                          <span className="font-bold text-white">{row.name}</span>
                          {row.finished && (
                            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[11px] font-bold">
                              Về đích lượt {row.finishedOnRound}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-cyan-200 tabular-nums">
                        {row.displayMeters} m / {raceState.config.targetMeters} m
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-300 tabular-nums">
                        {row.correctCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-rose-300 tabular-nums">
                        {row.wrongCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-300 tabular-nums">
                        {row.noAnswerCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Knowledge Review Section */}
          <div className="rounded-2xl bg-slate-900/90 border border-cyan-800/45 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-200 uppercase tracking-wider">
              <BookOpen className="w-4 h-4" />
              <span>Xem lại kiến thức ({raceState.history.length} câu đã chơi)</span>
            </div>

            {raceState.history.length === 0 ? (
              <p className="text-sm text-slate-400">Chưa có câu hỏi nào được xác nhận.</p>
            ) : (
              <div className="space-y-2.5">
                {raceState.history.map((rec) => (
                  <div
                    key={rec.turnToken}
                    className="rounded-xl bg-slate-950/75 border border-slate-800 p-3.5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-cyan-300">
                        Lượt {rec.roundNumber} · {rec.topic}
                        {rec.editCount > 0 ? ` (đã chỉnh sửa ${rec.editCount} lần)` : ''}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {raceState.config.teams.map((t) => {
                          const out = rec.outcomes[t.teamId];
                          const ok = out?.mark === 'correct';
                          return (
                            <span
                              key={t.teamId}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                ok
                                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
                                  : out?.mark === 'wrong'
                                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/35'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {ok ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {t.name}: {ok ? '+100m' : '0m'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-white">
                      <MathView content={rec.stemLatex} />
                    </div>
                    <div className="text-xs text-emerald-200 font-semibold">
                      Đáp án: <MathView content={rec.answerLatex} /> —{' '}
                      <span className="text-slate-300 font-normal">
                        <MathView content={rec.explanationLatex} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleRematchSameSetup}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-extrabold text-sm shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Đua lại (cùng cấu hình)</span>
            </button>
            <button
              type="button"
              onClick={handleBackToSetup}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-bold text-sm"
            >
              <Users className="w-4 h-4" />
              <span>Đổi đội / Luật đua</span>
            </button>
            <button
              type="button"
              onClick={handleExitToLibrary}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về thư viện</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoatRace3DGame;
