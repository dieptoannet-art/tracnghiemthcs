import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Edit3,
  Eye,
  FastForward,
  HelpCircle,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
} from '../../../utils/eduGameAudioController';
import imgC10Cover from '../../../assets/images/game_c10_clean_ocean_3d_1795310755840.jpg';
import {
  C10_FINAL_HINT_POINTS,
  C10_FINAL_POINTS,
  C10_ILLUSTRATIVE_CAPTION,
  C10_REGULAR_HINT_POINTS,
  C10_REGULAR_POINTS,
  C10_SAMPLE_BADGE,
  C10_SAMPLE_CS_QUESTIONS,
  C10_SAMPLE_MATH_QUESTIONS,
  C10_ZONES,
  OceanGameMode,
  OceanGameState,
  OceanGraphicsQuality,
  OceanMark,
  OceanQuestionSource,
  OceanTeamConfig,
  OceanZoneId,
  adaptBankQuestionsForC10,
  areAllOceanParticipantsMarked,
  buildDefaultOceanTeams,
  checkOceanDeadline,
  clearC10Session,
  computeMissionPoints,
  computeOceanMaxScore,
  computeOceanProgressReport,
  confirmOceanMissionResult,
  continueAfterOceanMission,
  createOceanSetupState,
  distributeStudentsIntoOceanTeams,
  endOceanVoyageEarly,
  enterOceanZone,
  finishOrSkipOceanAnimation,
  getActiveOceanMission,
  getOceanRemainingTimeMs,
  getPointsPreviewForActiveMission,
  isMissionCompleted,
  loadC10Session,
  markOceanMediaReady,
  openOceanQuestion,
  pauseOceanVoyage,
  recordPracticeRetry,
  resumeOceanVoyage,
  returnToOceanMap,
  revealOceanAnswerAndPreview,
  saveC10Session,
  selectOceanMission,
  setOceanParticipantMark,
  setOceanParticipantOption,
  startEditingLastOceanMission,
  startOceanVoyage,
  stopOceanAnswering,
  submitCoopDirectOption,
  submitCoopTypedAnswer,
  useOceanHint,
  validateOceanSetup,
} from './cleanOcean3dEngine';
import { CleanOcean3DScene } from './CleanOcean3DScene';

export interface CleanOcean3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const TIMER_OPTIONS = [
  { value: 0, label: 'Không giới hạn' },
  { value: 30, label: '30 giây' },
  { value: 45, label: '45 giây (mặc định)' },
  { value: 60, label: '60 giây' },
  { value: 90, label: '90 giây' },
];

export const CleanOcean3DGame: React.FC<CleanOcean3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & strict vi-VN voice controllers
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [ambientWaterOn, setAmbientWaterOn] = useState(false); // Strictly OFF by default!
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isVoiceReading, setIsVoiceReading] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState(() => ({
    hasVietnameseVoice: false,
    statusMessage: '',
  }));

  // Graphics & accessibility toggles
  const [quality, setQuality] = useState<OceanGraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [disableCameraTransition, setDisableCameraTransition] = useState(false);
  const [panoramaMode, setPanoramaMode] = useState(false);

  // Setup state
  const [setupMode, setSetupMode] = useState<OceanGameMode>('coop');
  const [questionSource, setQuestionSource] = useState<OceanQuestionSource>('sample_math');
  const [zoneCount, setZoneCount] = useState<2 | 3>(3);
  const [questionsPerZone, setQuestionsPerZone] = useState<number>(4);
  const [includeFinalChallenge, setIncludeFinalChallenge] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(45);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true);
  const [teamCount, setTeamCount] = useState<number>(4);
  const [setupTeams, setSetupTeams] = useState<OceanTeamConfig[]>(() =>
    buildDefaultOceanTeams('coop', 1)
  );
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [setupError, setSetupError] = useState<string | null>(null);

  // Game state & saved session recovery
  const [savedSession, setSavedSession] = useState<OceanGameState | null>(() => {
    const loaded = loadC10Session();
    return loaded && loaded.state.phase !== 'setup' ? loaded.state : null;
  });
  const [gameState, setGameState] = useState<OceanGameState>(() =>
    createOceanSetupState({ mode: 'coop', questionSource: 'sample_math' })
  );

  // Active mission UI helpers
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [typedInput, setTypedInput] = useState('');
  const [isImeComposing, setIsImeComposing] = useState(false);
  const [allowDiacriticInsensitive, setAllowDiacriticInsensitive] = useState(false);
  const [hintConfirmPending, setHintConfirmPending] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [showEarlyEndModal, setShowEarlyEndModal] = useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  // Optional 50-student speaking-turn picker drawer (never mutates DB or grades!)
  const [showRosterDrawer, setShowRosterDrawer] = useState(false);
  const [rosterClassId, setRosterClassId] = useState<string>(() => classes[0]?.id || '');
  const [rosterSearch, setRosterSearch] = useState('');
  const [pickedStudentIds, setPickedStudentIds] = useState<string[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<{ id: string; fullName: string } | null>(null);

  // Initialize sound & voice once
  useEffect(() => {
    const sb = new EduGameSoundBank();
    const vc = new EduGameVoiceController();
    soundBankRef.current = sb;
    voiceRef.current = vc;
    const snap = vc.getSnapshot();
    setVoiceSnapshot({
      hasVietnameseVoice: snap.hasVietnameseVoice,
      statusMessage: snap.statusMessage,
    });
    const unsub = vc.subscribe((next) => {
      setVoiceSnapshot({
        hasVietnameseVoice: next.hasVietnameseVoice,
        statusMessage: next.statusMessage,
      });
    });
    return () => {
      unsub();
      vc.dispose();
      sb.dispose();
    };
  }, []);

  // Optional subtle ambient water pulse (OFF by default; respects global mute & pause)
  useEffect(() => {
    if (!ambientWaterOn || isMuted || gameState.isPaused || gameState.phase === 'setup') return;
    const id = window.setInterval(() => {
      soundBankRef.current?.playOceanWaterPulse(false, gameState.turnToken);
    }, 6500);
    return () => window.clearInterval(id);
  }, [ambientWaterOn, isMuted, gameState.isPaused, gameState.phase, gameState.turnToken]);

  // Persist active session cleanly
  useEffect(() => {
    if (gameState.phase !== 'setup') {
      saveC10Session(gameState, Date.now());
    }
  }, [gameState]);

  // Single deadline countdown loop
  useEffect(() => {
    if (
      gameState.phase !== 'answering' ||
      gameState.isPaused ||
      !gameState.mediaReady ||
      gameState.deadlineMs === null
    ) {
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      setGameState((prev) => {
        const res = checkOceanDeadline(prev, now);
        if (res.expired) {
          soundBankRef.current?.playOceanLockAnswer(isMuted, prev.turnToken);
          return res.state;
        }
        return prev;
      });
    }, 150);
    return () => window.clearInterval(id);
  }, [
    gameState.phase,
    gameState.isPaused,
    gameState.mediaReady,
    gameState.deadlineMs,
    isMuted,
  ]);

  // Auto-settle animating phase after 1.35s so animation NEVER blocks the teacher
  useEffect(() => {
    if (gameState.phase !== 'animating' || gameState.isPaused) return;
    const delayMs = reducedMotion ? 350 : 1350;
    const t = window.setTimeout(() => {
      setGameState((prev) => finishOrSkipOceanAnimation(prev));
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [gameState.phase, gameState.isPaused, gameState.activeMissionId, reducedMotion]);

  // Cancel speech on phase/mission change, mute, or pause
  const stopVoice = useCallback(() => {
    voiceRef.current?.stop();
    setIsVoiceReading(false);
  }, []);

  useEffect(() => {
    if (isMuted || gameState.isPaused) {
      stopVoice();
    }
  }, [isMuted, gameState.isPaused, stopVoice]);

  // Adapt Smart EDU bank with strict RBAC
  const bankAdapted = useMemo(
    () => adaptBankQuestionsForC10(bankQuestions, userRole),
    [bankQuestions, userRole]
  );

  const activePool = useMemo(() => {
    if (questionSource === 'sample_math') return C10_SAMPLE_MATH_QUESTIONS;
    if (questionSource === 'sample_cs') return C10_SAMPLE_CS_QUESTIONS;
    return bankAdapted;
  }, [questionSource, bankAdapted]);

  const setupValidation = useMemo(
    () => validateOceanSetup(zoneCount, questionsPerZone, includeFinalChallenge, activePool.length),
    [zoneCount, questionsPerZone, includeFinalChallenge, activePool.length]
  );

  const report = useMemo(() => computeOceanProgressReport(gameState), [gameState]);
  const activeMission = useMemo(() => getActiveOceanMission(gameState), [gameState]);
  const pointsPreview = useMemo(() => getPointsPreviewForActiveMission(gameState), [gameState]);
  const allMarked = useMemo(() => areAllOceanParticipantsMarked(gameState), [gameState]);

  const completedMissionIds = useMemo(
    () => new Set(gameState.history.map((r) => r.missionId)),
    [gameState.history]
  );

  const remainingMs = getOceanRemainingTimeMs(gameState, nowMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const totalTimerMs = Math.max(1000, gameState.config.timerSeconds * 1000);
  const timerPercent =
    gameState.config.timerSeconds > 0
      ? Math.max(0, Math.min(100, (remainingMs / totalTimerMs) * 100))
      : 100;

  // Roster candidates for 50-student speaking turn picker
  const rosterStudents = useMemo(() => {
    const cls = classes.find((c) => c.id === rosterClassId) || classes[0];
    if (!cls) return [];
    const q = rosterSearch.trim().toLowerCase();
    return cls.students
      .map((s, idx) => ({
        id: s.id || `${cls.id}_s_${idx}`,
        fullName: s.fullName,
      }))
      .filter((s) => !q || s.fullName.toLowerCase().includes(q));
  }, [classes, rosterClassId, rosterSearch]);

  // ============================================================================
  // SETUP HANDLERS
  // ============================================================================

  const handleModeChange = (mode: OceanGameMode) => {
    setSetupMode(mode);
    setSelectedClassId('');
    setSetupTeams(buildDefaultOceanTeams(mode, mode === 'teams' ? teamCount : 1));
    setSetupError(null);
  };

  const handleTeamCountChange = (count: number) => {
    const safe = Math.max(2, Math.min(6, count));
    setTeamCount(safe);
    setSetupTeams((prev) => {
      const base = buildDefaultOceanTeams('teams', safe);
      const merged = base.map((def, idx) =>
        prev[idx] ? { ...def, name: prev[idx].name, memberNames: [] } : def
      );
      if (selectedClassId) {
        const cls = classes.find((c) => c.id === selectedClassId);
        if (cls) {
          return distributeStudentsIntoOceanTeams(
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
      distributeStudentsIntoOceanTeams(
        prev,
        cls.students.map((s) => s.fullName)
      )
    );
  };

  const handleStartVoyage = () => {
    soundBankRef.current?.unlock();
    const cleanedTeams = setupTeams.map((t, idx) => ({
      ...t,
      index: idx,
      name: t.name.trim() || (setupMode === 'coop' ? 'Đoàn Hải trình xanh' : `Đội ${idx + 1}`),
    }));
    const res = startOceanVoyage(
      {
        mode: setupMode,
        questionSource,
        zoneCount,
        questionsPerZone,
        includeFinalChallenge,
        timerSeconds,
        hintsEnabled,
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
    setShowReviewPanel(false);
    setPanoramaMode(false);
    soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
    soundBankRef.current?.playOceanSelectMission(isMuted, res.state.turnToken);
    setGameState(res.state);
  };

  const handleResumeSaved = () => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.setActiveTurnToken(savedSession.turnToken);
    setGameState(savedSession);
    setSavedSession(null);
  };

  const handleDiscardSaved = () => {
    clearC10Session();
    setSavedSession(null);
  };

  // ============================================================================
  // ACTIVE VOYAGE HANDLERS
  // ============================================================================

  const handleEnterZone = useCallback(
    (zoneId: OceanZoneId) => {
      soundBankRef.current?.unlock();
      stopVoice();
      setGameState((prev) => {
        const res = enterOceanZone(prev, zoneId);
        if (res.entered) {
          soundBankRef.current?.playOceanSelectMission(isMuted, res.state.turnToken);
        }
        return res.state;
      });
    },
    [isMuted, stopVoice]
  );

  const handleSelectMission = useCallback(
    (missionId: string) => {
      soundBankRef.current?.unlock();
      stopVoice();
      setTypedInput('');
      setHintConfirmPending(false);
      setImageBroken(false);
      setGameState((prev) => {
        const res = selectOceanMission(prev, missionId);
        if (res.selected) {
          soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
          soundBankRef.current?.playOceanSelectMission(isMuted, res.state.turnToken);
        }
        return res.state;
      });
    },
    [isMuted, stopVoice]
  );

  const handleOpenQuestion = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const hasImg = Boolean(activeMission?.question.imageUrl);
    const now = Date.now();
    setNowMs(now);
    setImageBroken(false);
    setHintConfirmPending(false);
    setGameState((prev) => openOceanQuestion(prev, now, !hasImg));
  };

  const handleUseHint = () => {
    soundBankRef.current?.unlock();
    setHintConfirmPending(false);
    setGameState((prev) => {
      const res = useOceanHint(prev);
      if (res.used) {
        soundBankRef.current?.playOceanSelectMission(isMuted, prev.turnToken);
      }
      return res.state;
    });
  };

  const handleReadQuestionVoice = () => {
    // NEVER read hidden answer! Strictly read question stem only.
    if (!activeMission || isMuted || !voiceEnabled || !voiceSnapshot.hasVietnameseVoice) return;
    setIsVoiceReading(true);
    voiceRef.current
      ?.replayText({
        text: activeMission.question.plainReadText,
        isMuted,
        voiceEnabled,
      })
      .finally(() => setIsVoiceReading(false));
  };

  const handleCoopDirectChoice = (optionId: string) => {
    soundBankRef.current?.unlock();
    stopVoice();
    const now = Date.now();
    setNowMs(now);
    const res = submitCoopDirectOption(gameState, optionId, now);
    if (res.accepted) {
      soundBankRef.current?.playOceanLockAnswer(isMuted, res.state.turnToken);
    }
    setGameState(res.state);
  };

  const handleCoopTypedSubmit = () => {
    if (isImeComposing || !typedInput.trim()) return;
    soundBankRef.current?.unlock();
    stopVoice();
    const now = Date.now();
    setNowMs(now);
    const res = submitCoopTypedAnswer(gameState, typedInput, now, allowDiacriticInsensitive);
    if (res.accepted) {
      soundBankRef.current?.playOceanLockAnswer(isMuted, res.state.turnToken);
    }
    setGameState(res.state);
  };

  const handleStopAnswering = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const now = Date.now();
    setNowMs(now);
    const res = stopOceanAnswering(gameState, now);
    if (res.stopped) {
      soundBankRef.current?.playOceanLockAnswer(isMuted, res.state.turnToken);
    }
    setGameState(res.state);
  };

  const handleRevealAnswer = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const res = revealOceanAnswerAndPreview(gameState);
    if (res.revealed) {
      soundBankRef.current?.playOceanLockAnswer(isMuted, res.state.turnToken);
    }
    setGameState(res.state);
  };

  const handleConfirmMission = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const res = confirmOceanMissionResult(gameState, gameState.turnToken);
    if (!res.confirmed) return;
    setGameState(res.state);
    if (res.zoneJustCompleted) {
      soundBankRef.current?.playOceanZoneComplete(isMuted, res.state.turnToken);
    } else {
      soundBankRef.current?.playOceanResultCue(isMuted, res.anyCorrect, res.state.turnToken);
    }
  };

  const handleContinueAfterMission = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const next = continueAfterOceanMission(gameState);
    if (next.phase === 'summary') {
      soundBankRef.current?.playOceanVoyageSummary(isMuted, next.turnToken);
    }
    setGameState(next);
  };

  const handleTogglePause = () => {
    soundBankRef.current?.unlock();
    const now = Date.now();
    setNowMs(now);
    setGameState((prev) =>
      prev.isPaused ? resumeOceanVoyage(prev, now) : pauseOceanVoyage(prev, now)
    );
  };

  const handleReplaySameSetup = () => {
    soundBankRef.current?.unlock();
    stopVoice();
    const pool =
      gameState.config.questionSource === 'sample_math'
        ? C10_SAMPLE_MATH_QUESTIONS
        : gameState.config.questionSource === 'sample_cs'
          ? C10_SAMPLE_CS_QUESTIONS
          : bankAdapted;
    const res = startOceanVoyage(gameState.config, pool);
    if (!res.error) {
      setPanoramaMode(false);
      setShowReviewPanel(false);
      soundBankRef.current?.setActiveTurnToken(res.state.turnToken);
      soundBankRef.current?.playOceanSelectMission(isMuted, res.state.turnToken);
      setGameState(res.state);
    }
  };

  const handleBackToSetup = () => {
    stopVoice();
    clearC10Session();
    setSavedSession(null);
    setShowEarlyEndModal(false);
    setPanoramaMode(false);
    setGameState(createOceanSetupState(gameState.config));
  };

  const handleExitLibrary = () => {
    stopVoice();
    soundBankRef.current?.stopAll();
    onBackToLibrary();
  };

  const handlePickRandomSpeaker = () => {
    const cls = classes.find((c) => c.id === rosterClassId) || classes[0];
    if (!cls || cls.students.length === 0) return;
    const normalized = cls.students.map((s, idx) => ({
      id: s.id || `${cls.id}_s_${idx}`,
      fullName: s.fullName,
    }));
    const unpicked = normalized.filter((s) => !pickedStudentIds.includes(s.id));
    const pool = unpicked.length > 0 ? unpicked : normalized;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setCurrentSpeaker(picked);
    setPickedStudentIds((prev) => (unpicked.length > 0 ? [...prev, picked.id] : [picked.id]));
  };

  const isQuestionFocused =
    gameState.phase === 'question_ready' ||
    gameState.phase === 'answering' ||
    gameState.phase === 'grading' ||
    gameState.phase === 'revealed';

  const currentZoneMissions = useMemo(
    () => gameState.missions.filter((m) => m.zoneId === gameState.selectedZoneId),
    [gameState.missions, gameState.selectedZoneId]
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={`w-full flex flex-col bg-[#041d30] text-slate-50 ${
        isFullscreen
          ? 'h-full overflow-y-auto p-3 sm:p-4'
          : 'rounded-2xl border border-cyan-500/35 shadow-2xl p-3 sm:p-5'
      }`}
    >
      {/* TOP BAR */}
      <header className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-cyan-500/25">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleExitLibrary}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-xs font-bold text-cyan-100"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Thư viện</span>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500/25 border border-cyan-400/45 text-[11px] font-black text-cyan-200">
                C10
              </span>
              <h2 className="text-sm sm:text-base font-extrabold text-white truncate">
                Giải cứu đại dương 3D — Hải trình xanh
              </h2>
            </div>
          </div>
        </div>

        {/* Utility controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {gameState.phase !== 'setup' && (
            <>
              <div className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-400/35 text-xs font-bold text-cyan-100 tabular-nums">
                Tiến độ nhiệm vụ: {report.completedMissions}/{report.totalMissions}
              </div>

              {classes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowRosterDrawer((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold ${
                    showRosterDrawer
                      ? 'bg-amber-500/25 border-amber-400 text-amber-100'
                      : 'bg-slate-900/80 border-cyan-500/30 text-cyan-100 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Gọi HS (1–50)</span>
                </button>
              )}

              {gameState.phase !== 'summary' && gameState.phase !== 'map' && (
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-xs font-bold text-cyan-100"
                >
                  {gameState.isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Tiếp tục</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5 text-amber-300" />
                      <span>Tạm dừng</span>
                    </>
                  )}
                </button>
              )}

              {gameState.phase !== 'summary' && (
                <button
                  type="button"
                  onClick={() => setShowEarlyEndModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 border border-rose-400/35 text-xs font-bold text-rose-100"
                >
                  <Square className="w-3 h-3" />
                  <span className="hidden md:inline">Kết thúc sớm</span>
                </button>
              )}
            </>
          )}

          {/* Graphics quality selector */}
          <select
            aria-label="Chất lượng hiển thị"
            value={quality}
            onChange={(e) => setQuality(e.target.value as OceanGraphicsQuality)}
            className="px-2 py-1.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 text-xs font-bold text-cyan-100"
          >
            <option value="high">3D Cao</option>
            <option value="lite">3D Nhẹ</option>
            <option value="2d">Bản đồ 2D</option>
          </select>

          {/* Ambient water toggle (OFF by default) */}
          <button
            type="button"
            disabled={isMuted}
            onClick={() => setAmbientWaterOn((v) => !v)}
            title="Âm nền sóng nước nhẹ (mặc định tắt)"
            className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-45 ${
              ambientWaterOn && !isMuted
                ? 'bg-teal-500/25 border-teal-400/50 text-teal-100'
                : 'bg-slate-900/80 border-cyan-500/30 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{ambientWaterOn ? 'Nước: Bật' : 'Nước: Tắt'}</span>
          </button>

          {/* Master mute */}
          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            title={isMuted ? 'Bật âm thanh' : 'Tắt toàn bộ âm thanh'}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-cyan-100"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình trình chiếu'}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-cyan-100"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* PHASE 0: SETUP SCREEN                                                */}
      {/* ==================================================================== */}
      {gameState.phase === 'setup' && (
        <div className="space-y-4">
          {/* Saved session banner */}
          {savedSession && (
            <div className="rounded-xl bg-amber-500/15 border border-amber-400/45 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-amber-100">
                  Có phiên Giải cứu đại dương chưa hoàn tất ({savedSession.history.length}/{savedSession.missions.length} nhiệm vụ)
                </p>
                <p className="text-xs text-amber-200/85">
                  Khôi phục sẽ giữ nguyên điểm số và trạng thái làm sạch 3D đã xác nhận (không cộng đúp điểm).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSaved}
                  className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black"
                >
                  Tiếp tục phiên cũ
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSaved}
                  className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-600 text-xs font-bold text-slate-200"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          {/* Hero banner with custom 16:9 cover */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-cyan-400/35 bg-[#062e49] flex flex-col justify-between">
              <img
                src={imgC10Cover}
                alt="Giải cứu đại dương 3D — Hải trình xanh"
                className="w-full h-48 sm:h-56 lg:h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#041d30] via-[#041d30]/35 to-transparent" />
              <div className="absolute bottom-3 left-3.5 right-3.5">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-300">
                  Nhóm C · Củng cố kiến thức · THCS (1–50 HS)
                </p>
                <h3 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  Hải trình xanh – Phục hồi đại dương
                </h3>
                <p className="text-xs text-cyan-100/90 mt-1">
                  Giải câu hỏi theo 3 khu vực biển và Trạm đại dương để thu gom rác thải minh họa, bảo vệ sinh vật biển và ôn tập kiến thức cuối buổi.
                </p>
              </div>
            </div>

            {/* Configuration controls */}
            <div className="lg:col-span-7 rounded-2xl bg-slate-950/55 border border-cyan-500/25 p-4 space-y-4">
              {/* Mode selection */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-cyan-200 mb-2">
                  1. Chế độ chơi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleModeChange('coop')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      setupMode === 'coop'
                        ? 'bg-cyan-500/20 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="text-sm font-extrabold">Hải trình hợp tác (Mặc định)</div>
                    <p className="text-xs text-cyan-100/80 mt-0.5">
                      Cả lớp hoặc 1 học sinh cùng chung tiến độ phục hồi và điểm tổng.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeChange('teams')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      setupMode === 'teams'
                        ? 'bg-cyan-500/20 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300 hover:border-cyan-500/50'
                    }`}
                  >
                    <div className="text-sm font-extrabold">Đội thám hiểm đại dương (2–6 đội)</div>
                    <p className="text-xs text-cyan-100/80 mt-0.5">
                      Các đội cùng giải câu hỏi công bằng, tính điểm riêng và cùng làm sạch đại dương.
                    </p>
                  </button>
                </div>
              </div>

              {/* Question pack selection */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wide text-cyan-200 mb-2">
                  2. Nguồn câu hỏi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionSource('sample_math')}
                    className={`p-2.5 rounded-xl border text-left ${
                      questionSource === 'sample_math'
                        ? 'bg-cyan-500/20 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Toán THCS (13 câu)</div>
                    <div className="text-[11px] text-cyan-200/80 mt-0.5">
                      Hải trình tính toán · {C10_SAMPLE_BADGE}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('sample_cs')}
                    className={`p-2.5 rounded-xl border text-left ${
                      questionSource === 'sample_cs'
                        ? 'bg-cyan-500/20 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold">Tin học THCS (13 câu)</div>
                    <div className="text-[11px] text-cyan-200/80 mt-0.5">
                      Đại dương thông tin · {C10_SAMPLE_BADGE}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('bank')}
                    className={`p-2.5 rounded-xl border text-left ${
                      questionSource === 'bank'
                        ? 'bg-cyan-500/20 border-cyan-300 text-white'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold">
                      Ngân hàng Smart EDU ({bankAdapted.length})
                    </div>
                    <div className="text-[11px] text-cyan-200/80 mt-0.5">
                      Tự lọc theo quyền RBAC
                    </div>
                  </button>
                </div>
              </div>

              {/* Zones, questions per zone, final challenge, timer, hints */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    Số khu vực học
                  </label>
                  <select
                    value={zoneCount}
                    onChange={(e) => setZoneCount(Number(e.target.value) === 2 ? 2 : 3)}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs font-bold text-white"
                  >
                    <option value={3}>3 khu vực (Mặc định)</option>
                    <option value={2}>2 khu vực</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    Câu mỗi khu vực
                  </label>
                  <select
                    value={questionsPerZone}
                    onChange={(e) => setQuestionsPerZone(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs font-bold text-white"
                  >
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} câu {n === 4 ? '(Mặc định)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    Đồng hồ mỗi câu
                  </label>
                  <select
                    value={timerSeconds}
                    onChange={(e) => setTimerSeconds(Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs font-bold text-white"
                  >
                    {TIMER_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-cyan-200 mb-1">
                    Đồ họa / Chuyển động
                  </label>
                  <button
                    type="button"
                    onClick={() => setReducedMotion((v) => !v)}
                    className={`w-full px-2.5 py-2 rounded-lg border text-xs font-bold ${
                      reducedMotion
                        ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                        : 'bg-slate-900 border-cyan-500/30 text-cyan-100'
                    }`}
                  >
                    {reducedMotion ? 'Giảm chuyển động: Bật' : 'Chuyển động: Chuẩn'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-cyan-100">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFinalChallenge}
                    onChange={(e) => setIncludeFinalChallenge(e.target.checked)}
                    className="rounded border-cyan-400"
                  />
                  <span>Bật Thử thách cuối tại Trạm đại dương (+30 điểm)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hintsEnabled}
                    onChange={(e) => setHintsEnabled(e.target.checked)}
                    className="rounded border-cyan-400"
                  />
                  <span>Cho phép gợi ý (còn 5đ / 15đ)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disableCameraTransition}
                    onChange={(e) => setDisableCameraTransition(e.target.checked)}
                    className="rounded border-cyan-400"
                  />
                  <span>Tắt chuyển cảnh camera</span>
                </label>
              </div>

              {/* Team setup when mode === 'teams' */}
              {setupMode === 'teams' && (
                <div className="rounded-xl bg-slate-900/70 border border-cyan-500/25 p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-cyan-200">Số đội:</span>
                      {[2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => handleTeamCountChange(n)}
                          className={`w-7 h-7 rounded-lg text-xs font-black ${
                            teamCount === n
                              ? 'bg-cyan-400 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    {classes.length > 0 && (
                      <select
                        value={selectedClassId}
                        onChange={(e) => handleApplyClassRoster(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-cyan-500/30 text-xs font-bold text-cyan-100"
                      >
                        <option value="">Chia nhanh từ lớp học (tùy chọn)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            Lớp {c.name} ({c.students.length} HS)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {setupTeams.map((t, idx) => (
                      <div
                        key={t.teamId}
                        className="flex items-center gap-2 rounded-lg bg-slate-950/70 border border-slate-700 px-2.5 py-1.5"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: t.colorHex }}
                        />
                        <input
                          type="text"
                          value={t.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSetupTeams((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                            );
                          }}
                          className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                          placeholder={`Đội ${idx + 1}`}
                        />
                        {t.memberNames.length > 0 && (
                          <span className="text-[10px] font-bold text-cyan-300 shrink-0">
                            {t.memberNames.length} HS
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pre-start transparent rule summary */}
              <div className="rounded-xl bg-cyan-950/60 border border-cyan-400/30 p-3 text-xs text-cyan-100 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2 font-extrabold text-white">
                  <span>
                    Tổng nhiệm vụ: {setupValidation.totalQuestions} câu ({zoneCount} khu × {questionsPerZone} câu
                    {includeFinalChallenge ? ' + 1 thử thách cuối' : ''})
                  </span>
                  <span className="text-amber-300">
                    Điểm tối đa: {setupValidation.maxScore} điểm
                  </span>
                </div>
                <p className="text-[11px] text-cyan-200/90">
                  Quy tắc điểm: Câu thường +{C10_REGULAR_POINTS}đ (dùng gợi ý còn +{C10_REGULAR_HINT_POINTS}đ) · Thử thách cuối +{C10_FINAL_POINTS}đ (dùng gợi ý còn +{C10_FINAL_HINT_POINTS}đ) · Câu không có gợi ý không giảm điểm · Không trừ điểm âm · Trả lời sai vẫn xem giải thích để hoàn thành nhiệm vụ.
                </p>
              </div>

              {(setupError || !setupValidation.valid) && (
                <div className="rounded-lg bg-rose-500/20 border border-rose-400/45 px-3 py-2 text-xs font-bold text-rose-100">
                  {setupError || setupValidation.error}
                </div>
              )}

              <button
                type="button"
                disabled={!setupValidation.valid}
                onClick={handleStartVoyage}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 disabled:opacity-45 text-slate-950 font-black text-sm sm:text-base shadow-lg transition-all"
              >
                Khởi hành Hải trình xanh ({setupValidation.totalQuestions} nhiệm vụ · tối đa {setupValidation.maxScore} điểm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ACTIVE VOYAGE (MAP / ZONE / QUESTION FLOW / SUMMARY)                 */}
      {/* ==================================================================== */}
      {gameState.phase !== 'setup' && (
        <div className="space-y-3.5 relative">
          {/* Optional 50-student speaking-turn picker drawer (compact, scrollable, zero DB write) */}
          {showRosterDrawer && classes.length > 0 && (
            <div className="rounded-xl bg-slate-950/90 border border-amber-400/45 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-extrabold text-amber-100">
                    Chọn học sinh phát biểu (tối đa 50 HS · chỉ dùng trong phiên, không ghi điểm sổ)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRosterDrawer(false)}
                  className="p-1 rounded hover:bg-slate-800 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={rosterClassId}
                  onChange={(e) => {
                    setRosterClassId(e.target.value);
                    setPickedStudentIds([]);
                    setCurrentSpeaker(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs font-bold text-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.students.length} HS)
                    </option>
                  ))}
                </select>

                <div className="relative flex-1 min-w-[160px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Tìm tên học sinh..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handlePickRandomSpeaker}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black"
                >
                  Chọn ngẫu nhiên 1 HS
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPickedStudentIds([]);
                    setCurrentSpeaker(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                >
                  Đặt lại lượt
                </button>
              </div>

              {currentSpeaker && (
                <div className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-sm font-black text-emerald-100">
                  Mời học sinh phát biểu: {currentSpeaker.fullName}
                </div>
              )}

              <div className="max-h-32 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5 pr-1">
                {rosterStudents.map((s) => {
                  const picked = pickedStudentIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setCurrentSpeaker(s);
                        if (!picked) setPickedStudentIds((prev) => [...prev, s.id]);
                      }}
                      className={`px-2 py-1.5 rounded-lg border text-left text-xs font-semibold truncate ${
                        currentSpeaker?.id === s.id
                          ? 'bg-amber-400/25 border-amber-300 text-amber-100'
                          : picked
                            ? 'bg-emerald-950/60 border-emerald-500/35 text-emerald-200/80'
                            : 'bg-slate-900/70 border-slate-700 text-slate-200 hover:border-cyan-400'
                      }`}
                    >
                      {s.fullName}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3D / 2D OCEAN STAGE (compact during question focus so question dominates screen) */}
          <CleanOcean3DScene
            zones={report.zones}
            missions={gameState.missions}
            completedMissionIds={completedMissionIds}
            selectedZoneId={gameState.selectedZoneId}
            activeMissionId={gameState.activeMissionId}
            phase={gameState.phase}
            quality={quality}
            reducedMotion={reducedMotion}
            disableCameraTransition={disableCameraTransition}
            panoramaMode={panoramaMode || gameState.phase === 'summary'}
            compact={isQuestionFocused}
            onSelectZone={
              gameState.phase === 'map' || gameState.phase === 'zone'
                ? handleEnterZone
                : undefined
            }
            onSelectMission={
              gameState.phase === 'map' || gameState.phase === 'zone'
                ? handleSelectMission
                : undefined
            }
            onWebGLFallback={() => setQuality('2d')}
          />

          {/* SCOREBOARD & PROGRESS STRIP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch">
            <div className="lg:col-span-4 rounded-xl bg-slate-950/60 border border-cyan-500/25 p-3 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-extrabold text-cyan-200">
                <span>Tiến độ nhiệm vụ đại dương</span>
                <span className="tabular-nums text-white">
                  {report.completedMissions}/{report.totalMissions} ({report.missionProgressPercent}%)
                </span>
              </div>
              <div className="my-1.5 h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 transition-all duration-300"
                  style={{ width: `${report.missionProgressPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-cyan-200/80">
                {gameState.statusMessage || C10_ILLUSTRATIVE_CAPTION}
              </p>
            </div>

            <div className="lg:col-span-8 rounded-xl bg-slate-950/60 border border-cyan-500/25 p-3">
              <div className="flex flex-wrap items-center gap-2">
                {report.standings.map((s) => (
                  <div
                    key={s.participantId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-cyan-500/25"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: s.colorHex }}
                    />
                    <span className="text-xs font-extrabold text-white">{s.name}</span>
                    <span className="text-sm font-black text-amber-300 tabular-nums">
                      {s.score}đ
                    </span>
                    <span className="text-[11px] text-cyan-200/75 tabular-nums">
                      (Đúng {s.correctCount})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================== */}
          {/* MAP VIEW: 4 ZONES OVERVIEW                                         */}
          {/* ================================================================== */}
          {gameState.phase === 'map' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {report.zones.map((z) => {
                const locked = z.status === 'locked';
                const done = z.status === 'completed';
                return (
                  <button
                    key={z.zoneId}
                    type="button"
                    disabled={locked}
                    onClick={() => handleEnterZone(z.zoneId)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      done
                        ? 'bg-emerald-500/15 border-emerald-400/45 hover:bg-emerald-500/20'
                        : locked
                          ? 'bg-slate-950/50 border-slate-800 opacity-60 cursor-not-allowed'
                          : z.isFinalStation
                            ? 'bg-amber-500/20 border-amber-300 hover:bg-amber-500/25 shadow-lg'
                            : 'bg-cyan-950/60 border-cyan-400/45 hover:border-cyan-200 hover:bg-cyan-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-black text-white flex items-center gap-1.5">
                        {z.isFinalStation ? (
                          <Anchor className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Compass className="w-4 h-4 text-cyan-300" />
                        )}
                        {z.title}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                          done
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : locked
                              ? 'bg-slate-800 text-slate-400'
                              : 'bg-cyan-500/25 text-cyan-100'
                        }`}
                      >
                        {done
                          ? 'Hoàn thành'
                          : locked
                            ? 'Chưa mở'
                            : z.status === 'in_progress'
                              ? 'Đang thực hiện'
                              : 'Đã mở'}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-100/85 mb-2.5">{z.subtitle}</p>
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-cyan-200">
                        Nhiệm vụ: {z.completedMissions}/{z.totalMissions}
                      </span>
                      <span className="text-amber-300">
                        {locked ? 'Hoàn thành khu trước' : done ? 'Xem khu vực' : 'Vào khu vực →'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* ================================================================== */}
          {/* ZONE VIEW: MISSION CARDS FOR CURRENT ZONE                          */}
          {/* ================================================================== */}
          {gameState.phase === 'zone' && (
            <div className="rounded-2xl bg-slate-950/65 border border-cyan-500/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-black text-white">
                    {C10_ZONES[gameState.selectedZoneId].title} —{' '}
                    {C10_ZONES[gameState.selectedZoneId].subtitle}
                  </h3>
                  <p className="text-xs text-cyan-200/85">
                    Chọn một điểm rác thải đang mở (trên cảnh 3D hoặc nút bên dưới) để mở câu hỏi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGameState((prev) => returnToOceanMap(prev))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-xs font-bold text-cyan-100"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Về bản đồ 4 khu vực</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {currentZoneMissions.map((m, idx) => {
                  const done = isMissionCompleted(gameState, m.missionId);
                  const rec = gameState.history.find((r) => r.missionId === m.missionId);
                  return (
                    <button
                      key={m.missionId}
                      type="button"
                      disabled={done}
                      onClick={() => handleSelectMission(m.missionId)}
                      className={`rounded-xl border p-3.5 text-left transition-all ${
                        done
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100 cursor-default'
                          : m.isFinalChallenge
                            ? 'bg-amber-500/20 border-amber-300 hover:bg-amber-500/25 text-white shadow-lg'
                            : 'bg-cyan-950/70 border-cyan-400/40 hover:border-cyan-200 text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-black uppercase tracking-wide text-cyan-200">
                          {m.isFinalChallenge ? 'Thử thách tổng kết' : `Nhiệm vụ ${idx + 1}`}
                        </span>
                        <span className="text-xs font-black text-amber-300">
                          {done
                            ? rec?.completionKind === 'completed_direct'
                              ? 'Đúng'
                              : 'Đã ôn lại'
                            : m.isFinalChallenge
                              ? `+${C10_FINAL_POINTS}đ`
                              : `+${C10_REGULAR_POINTS}đ`}
                        </span>
                      </div>
                      <div className="text-sm font-extrabold">{m.debrisLabel}</div>
                      <p className="text-[11px] text-cyan-200/80 mt-1">
                        {done
                          ? `Đã hoàn tất · Đích: ${m.binLabel}`
                          : `Chủ đề: ${m.question.topic}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ================================================================== */}
          {/* QUESTION FLOW: READY -> ANSWERING -> GRADING -> REVEALED           */}
          {/* ================================================================== */}
          {isQuestionFocused && activeMission && (
            <div className="relative rounded-2xl bg-slate-950/90 border border-cyan-400/40 p-4 sm:p-6 space-y-4 shadow-xl">
              {/* PAUSE CURTAIN (hides question & locks commits) */}
              {gameState.isPaused && (
                <div className="absolute inset-0 z-30 rounded-2xl bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center gap-3">
                  <Pause className="w-10 h-10 text-amber-300" />
                  <h3 className="text-xl font-black text-white">Hải trình đang tạm dừng</h3>
                  <p className="text-sm text-cyan-100/85 max-w-md">
                    Nội dung câu hỏi đã được che và đồng hồ được giữ nguyên. Bấm Tiếp tục khi cả lớp sẵn sàng.
                  </p>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm"
                  >
                    Tiếp tục hải trình
                  </button>
                </div>
              )}

              {/* Question header bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-cyan-500/25">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-xs font-black text-cyan-100">
                    {activeMission.isFinalChallenge
                      ? 'Trạm đại dương · Thử thách cuối'
                      : `${C10_ZONES[activeMission.zoneId].title} · ${activeMission.debrisLabel}`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-200">
                    {activeMission.question.topic}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-bold text-emerald-200">
                    {activeMission.question.sourceBadge}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-black text-amber-200">
                    Điểm hiện tại: +{pointsPreview.currentReward}đ
                  </span>
                </div>

                {/* Voice + Timer */}
                <div className="flex flex-wrap items-center gap-2">
                  {gameState.phase !== 'question_ready' && (
                    <>
                      <button
                        type="button"
                        disabled={isMuted || !voiceEnabled || !voiceSnapshot.hasVietnameseVoice}
                        onClick={handleReadQuestionVoice}
                        title={
                          voiceSnapshot.hasVietnameseVoice
                            ? 'Đọc đề câu hỏi bằng giọng tiếng Việt (không đọc đáp án)'
                            : 'Thiết bị chưa cài giọng tiếng Việt (trò chơi vẫn hoạt động bình thường)'
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-xs font-bold text-cyan-100"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Đọc đề</span>
                      </button>
                      {isVoiceReading && (
                        <button
                          type="button"
                          onClick={stopVoice}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/25 border border-amber-400/50 text-xs font-bold text-amber-100"
                        >
                          Bỏ qua đọc
                        </button>
                      )}
                    </>
                  )}

                  {gameState.config.timerSeconds > 0 && gameState.phase === 'answering' && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-black tabular-nums ${
                        !gameState.mediaReady
                          ? 'bg-slate-800 border-slate-600 text-slate-300'
                          : remainingSec <= 5
                            ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                            : 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>{!gameState.mediaReady ? 'Chờ ảnh...' : `${remainingSec}s`}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Countdown progress bar */}
              {gameState.config.timerSeconds > 0 && gameState.phase === 'answering' && (
                <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      remainingSec <= 5 ? 'bg-rose-400' : 'bg-cyan-400'
                    }`}
                    style={{ width: `${timerPercent}%` }}
                  />
                </div>
              )}

              {/* STEP: QUESTION READY */}
              {gameState.phase === 'question_ready' && (
                <div className="py-6 text-center space-y-4">
                  <p className="text-base sm:text-lg font-extrabold text-cyan-100">
                    Sẵn sàng giải nhiệm vụ: {activeMission.debrisLabel}
                  </p>
                  <p className="text-sm text-cyan-200/80">
                    Trả lời đúng nhận +{pointsPreview.withoutHint} điểm (nếu mở gợi ý nhận +{pointsPreview.withHint} điểm).
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenQuestion}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 text-slate-950 font-black text-base shadow-lg"
                    >
                      Bắt đầu câu hỏi
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setGameState((prev) => ({
                          ...prev,
                          phase: 'zone',
                          activeMissionId: null,
                        }))
                      }
                      className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold"
                    >
                      Chọn nhiệm vụ khác
                    </button>
                  </div>
                </div>
              )}

              {/* QUESTION STEM + IMAGE + HINT */}
              {gameState.phase !== 'question_ready' && (
                <div className="space-y-4">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-relaxed">
                    <MathView content={activeMission.question.stemLatex} />
                  </div>

                  {/* Optional image with mediaReady gating */}
                  {activeMission.question.imageUrl && (
                    <div className="space-y-2">
                      {!imageBroken ? (
                        <img
                          src={activeMission.question.imageUrl}
                          alt="Hình minh họa câu hỏi"
                          onLoad={() => setGameState((prev) => markOceanMediaReady(prev, Date.now()))}
                          onError={() => {
                            setImageBroken(true);
                            setGameState((prev) => markOceanMediaReady(prev, Date.now()));
                          }}
                          className="max-h-60 rounded-xl border border-cyan-500/30 bg-white/95 p-1"
                        />
                      ) : (
                        <div className="px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-100">
                          Không tải được hình minh họa — đã tự động mở đồng hồ để lớp tiếp tục làm bài.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hint panel & button (strictly shows remaining points BEFORE confirming; missing hint NEVER reduces score) */}
                  {gameState.config.hintsEnabled && gameState.phase === 'answering' && (
                    <div className="rounded-xl bg-slate-900/75 border border-cyan-500/25 p-3">
                      {gameState.hintRevealedForActive && activeMission.question.hintLatex ? (
                        <div className="flex items-start gap-2 text-sm text-amber-100">
                          <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-1" />
                          <div>
                            <div className="text-xs font-extrabold uppercase text-amber-300 mb-0.5">
                              Gợi ý chung (trả lời đúng còn +{pointsPreview.withHint} điểm)
                            </div>
                            <MathView content={activeMission.question.hintLatex} />
                          </div>
                        </div>
                      ) : !activeMission.question.hintLatex ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                          <HelpCircle className="w-4 h-4 text-slate-400" />
                          <span>
                            Câu hỏi này không có gợi ý kèm theo (điểm giữ nguyên +{pointsPreview.withoutHint}đ, không bị giảm điểm).
                          </span>
                        </div>
                      ) : hintConfirmPending ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-amber-200">
                            Xác nhận mở gợi ý? Nếu trả lời đúng, điểm câu này giảm từ +{pointsPreview.withoutHint}đ còn +{pointsPreview.withHint}đ.
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleUseHint}
                              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black"
                            >
                              Mở gợi ý (+{pointsPreview.withHint}đ)
                            </button>
                            <button
                              type="button"
                              onClick={() => setHintConfirmPending(false)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 font-bold"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setHintConfirmPending(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/45 text-xs font-extrabold text-amber-100"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>
                            Mở gợi ý (điểm đúng: {pointsPreview.withoutHint}đ → {pointsPreview.withHint}đ)
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* MULTIPLE CHOICE / TRUE-FALSE OPTIONS */}
                  {activeMission.question.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeMission.question.options.map((opt) => {
                        const isRevealed = gameState.phase === 'revealed';
                        const isCorrectOpt = opt.optionId === activeMission.question.correctOptionId;
                        const coopChosen =
                          gameState.config.mode === 'coop' &&
                          gameState.draftOptionIds[gameState.config.teams[0]?.teamId] === opt.optionId;
                        const canClickCoop =
                          gameState.config.mode === 'coop' && gameState.phase === 'answering';

                        return (
                          <button
                            key={opt.optionId}
                            type="button"
                            disabled={!canClickCoop}
                            onClick={() => canClickCoop && handleCoopDirectChoice(opt.optionId)}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                              isRevealed && isCorrectOpt
                                ? 'bg-emerald-500/25 border-emerald-300 text-white'
                                : isRevealed && coopChosen && !isCorrectOpt
                                  ? 'bg-rose-500/20 border-rose-400 text-rose-100'
                                  : canClickCoop
                                    ? 'bg-slate-900/80 border-cyan-500/35 hover:border-cyan-200 hover:bg-cyan-950/70 text-white cursor-pointer'
                                    : 'bg-slate-900/65 border-slate-700 text-slate-100 cursor-default'
                            }`}
                          >
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                                isRevealed && isCorrectOpt
                                  ? 'bg-emerald-400 text-slate-950'
                                  : 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/40'
                              }`}
                            >
                              {opt.label}
                            </span>
                            <div className="text-base sm:text-lg font-semibold leading-snug pt-0.5">
                              <MathView content={opt.textLatex} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* SHORT ANSWER INPUT (Coop answering mode, IME-safe) */}
                  {activeMission.question.type === 'short_answer' &&
                    gameState.config.mode === 'coop' &&
                    gameState.phase === 'answering' && (
                      <div className="rounded-xl bg-slate-900/80 border border-cyan-500/30 p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            value={typedInput}
                            onCompositionStart={() => setIsImeComposing(true)}
                            onCompositionEnd={() => setIsImeComposing(false)}
                            onChange={(e) => setTypedInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !isImeComposing) {
                                e.preventDefault();
                                handleCoopTypedSubmit();
                              }
                            }}
                            placeholder="Nhập câu trả lời tiếng Việt rồi bấm Chốt đáp án..."
                            className="flex-1 min-w-[200px] px-3.5 py-2.5 rounded-lg bg-slate-950 border border-cyan-400/40 text-base text-white"
                          />
                          <button
                            type="button"
                            disabled={!typedInput.trim()}
                            onClick={handleCoopTypedSubmit}
                            className="px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 disabled:opacity-45 text-slate-950 font-black text-sm"
                          >
                            Chốt đáp án
                          </button>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-cyan-200/85 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={allowDiacriticInsensitive}
                            onChange={(e) => setAllowDiacriticInsensitive(e.target.checked)}
                          />
                          <span>Cho phép so khớp không phân biệt dấu tiếng Việt (mặc định phân biệt dấu)</span>
                        </label>
                      </div>
                    )}

                  {/* ANSWERING CONTROLS (stop clock / go to grading) */}
                  {gameState.phase === 'answering' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <span className="text-xs text-cyan-200/80">
                        {gameState.config.mode === 'teams'
                          ? 'Các đội ghi đáp án ra bảng con. Đáp án chuẩn được giữ kín cho đến khi chấm đủ các đội.'
                          : 'Bấm trực tiếp phương án trên màn hình hoặc bấm Dừng để giáo viên tự chấm.'}
                      </span>
                      <button
                        type="button"
                        onClick={handleStopAnswering}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm"
                      >
                        {gameState.config.mode === 'teams'
                          ? 'Dừng & Chấm kết quả các đội'
                          : 'Dừng đồng hồ / Giáo viên chấm'}
                      </button>
                    </div>
                  )}

                  {/* STEP: GRADING MATRIX (Answer stays HIDDEN until ALL participants marked!) */}
                  {gameState.phase === 'grading' && (
                    <div className="rounded-xl bg-slate-900/90 border border-amber-400/40 p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-black text-amber-200">
                            Chấm kết quả (Đáp án đang ẩn để đảm bảo công bằng)
                          </h4>
                          <p className="text-xs text-slate-300">
                            Phải chấm đủ tất cả đội/lớp (phân biệt rõ “Chưa chấm” và “Không trả lời”) trước khi công bố đáp án.
                          </p>
                        </div>
                        {gameState.timedOutCurrentMission && (
                          <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-100">
                            Hết giờ — ghi nhận đáp án đã viết trước hạn
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {gameState.config.teams.map((t) => {
                          const mark = gameState.draftMarks[t.teamId] || 'unmarked';
                          return (
                            <div
                              key={t.teamId}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/80 border border-slate-800 px-3 py-2.5"
                            >
                              <div className="flex items-center gap-2 min-w-[140px]">
                                <span
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: t.colorHex }}
                                />
                                <span className="text-sm font-extrabold text-white">{t.name}</span>
                                {mark === 'unmarked' && (
                                  <span className="text-[11px] font-bold text-amber-300">
                                    (Chưa chấm)
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                {/* Optional A/B/C/D quick pick for MC */}
                                {activeMission.question.options.length > 0 && (
                                  <div className="flex items-center gap-1 mr-1">
                                    {activeMission.question.options.map((opt) => (
                                      <button
                                        key={opt.optionId}
                                        type="button"
                                        onClick={() =>
                                          setGameState((prev) =>
                                            setOceanParticipantOption(prev, t.teamId, opt.optionId)
                                          )
                                        }
                                        className={`w-7 h-7 rounded-lg text-xs font-black border ${
                                          gameState.draftOptionIds[t.teamId] === opt.optionId
                                            ? 'bg-cyan-400 text-slate-950 border-cyan-200'
                                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-cyan-400'
                                        }`}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {(
                                  [
                                    { val: 'correct', label: 'Đúng', cls: 'bg-emerald-500 text-slate-950' },
                                    { val: 'wrong', label: 'Chưa đúng', cls: 'bg-rose-500 text-white' },
                                    { val: 'no_answer', label: 'Không trả lời', cls: 'bg-slate-500 text-white' },
                                  ] as { val: OceanMark; label: string; cls: string }[]
                                ).map((btn) => (
                                  <button
                                    key={btn.val}
                                    type="button"
                                    onClick={() =>
                                      setGameState((prev) =>
                                        setOceanParticipantMark(prev, t.teamId, btn.val, null)
                                      )
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                                      mark === btn.val
                                        ? btn.cls
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={!allMarked}
                          onClick={handleRevealAnswer}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 disabled:opacity-40 text-slate-950 font-black text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Công bố đáp án & Xem trước điểm</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP: REVEALED ANSWER + EXPLANATION + CONFIRM */}
                  {gameState.phase === 'revealed' && (
                    <div className="rounded-xl bg-emerald-950/45 border border-emerald-400/45 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs font-black uppercase tracking-wide text-emerald-300">
                            Đáp án chuẩn
                          </div>
                          <div className="text-lg font-black text-white">
                            <MathView content={activeMission.question.answerLatex} />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setGameState((prev) => recordPracticeRetry(prev))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/35 text-xs font-bold text-cyan-100"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>
                            {gameState.practiceRetryUsed
                              ? 'Đã luyện tập lại (0đ)'
                              : 'Thử lại luyện tập (0đ)'}
                          </span>
                        </button>
                      </div>

                      <div className="rounded-lg bg-slate-950/65 border border-cyan-500/20 p-3 text-sm text-cyan-50 leading-relaxed">
                        <span className="font-extrabold text-cyan-300 mr-1.5">Giải thích:</span>
                        <MathView content={activeMission.question.explanationLatex} />
                      </div>

                      {/* Score preview */}
                      <div className="flex flex-wrap items-center gap-2">
                        {gameState.config.teams.map((t) => {
                          const mark = gameState.draftMarks[t.teamId] || 'no_answer';
                          const pts = computeMissionPoints(
                            activeMission.isFinalChallenge,
                            mark,
                            gameState.hintRevealedForActive
                          );
                          return (
                            <span
                              key={t.teamId}
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                                mark === 'correct'
                                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-100'
                                  : 'bg-slate-900 border-slate-700 text-slate-300'
                              }`}
                            >
                              {t.name}: {mark === 'correct' ? `+${pts}đ` : '0đ (ôn lại)'}
                            </span>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-cyan-200/85">
                          {activeMission.question.actionMessage}
                        </span>
                        <button
                          type="button"
                          onClick={handleConfirmMission}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-300 hover:from-emerald-300 hover:to-cyan-200 text-slate-950 font-black text-sm shadow-lg"
                        >
                          <Check className="w-4 h-4" />
                          <span>Xác nhận & Thu gom rác minh họa</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* ANIMATING PHASE (with Skip Animation button)                       */}
          {/* ================================================================== */}
          {gameState.phase === 'animating' && activeMission && (
            <div className="rounded-2xl bg-cyan-950/75 border border-cyan-400/45 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-amber-300 animate-pulse shrink-0" />
                <div>
                  <div className="text-sm font-black text-white">
                    Thiết bị đang đưa “{activeMission.debrisLabel}” vào {activeMission.binLabel}
                  </div>
                  <p className="text-xs text-cyan-200/85">
                    {activeMission.question.actionMessage} · ({C10_ILLUSTRATIVE_CAPTION})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGameState((prev) => finishOrSkipOceanAnimation(prev))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Bỏ qua hoạt ảnh</span>
              </button>
            </div>
          )}

          {/* ================================================================== */}
          {/* MISSION DONE PHASE (with Edit Last Confirmed Round!)               */}
          {/* ================================================================== */}
          {gameState.phase === 'mission_done' && (
            <div className="rounded-2xl bg-slate-950/85 border border-emerald-400/45 p-4 space-y-3">
              {gameState.editingLastConfirmed && activeMission ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-black text-amber-200">
                    Sửa kết quả câu vừa xác nhận (tự tính lại toàn bộ điểm số)
                  </h4>
                  <div className="space-y-2">
                    {gameState.config.teams.map((t) => {
                      const mark = gameState.draftMarks[t.teamId] || 'unmarked';
                      return (
                        <div
                          key={t.teamId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 border border-slate-700 px-3 py-2"
                        >
                          <span className="text-sm font-extrabold text-white">{t.name}</span>
                          <div className="flex items-center gap-1.5">
                            {(
                              [
                                { val: 'correct', label: 'Đúng' },
                                { val: 'wrong', label: 'Chưa đúng' },
                                { val: 'no_answer', label: 'Không trả lời' },
                              ] as { val: OceanMark; label: string }[]
                            ).map((b) => (
                              <button
                                key={b.val}
                                type="button"
                                onClick={() =>
                                  setGameState((prev) =>
                                    setOceanParticipantMark(prev, t.teamId, b.val, null)
                                  )
                                }
                                className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                  mark === b.val
                                    ? 'bg-cyan-400 text-slate-950'
                                    : 'bg-slate-800 text-slate-300'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGameState((prev) => ({ ...prev, editingLastConfirmed: false }))
                      }
                      className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold"
                    >
                      Hủy sửa
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmMission}
                      className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black"
                    >
                      Lưu kết quả sửa & Tính lại điểm
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
                    <div>
                      <div className="text-sm font-black text-white">
                        Đã hoàn thành nhiệm vụ! ({report.completedMissions}/{report.totalMissions})
                      </div>
                      <p className="text-xs text-cyan-200/85">{gameState.statusMessage}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setGameState((prev) => startEditingLastOceanMission(prev))}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa kết quả câu vừa rồi</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueAfterMission}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 text-slate-950 font-black text-sm"
                    >
                      {report.voyageCompleted ? 'Xem tổng kết hải trình →' : 'Tiếp tục →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* SUMMARY PHASE                                                      */}
          {/* ================================================================== */}
          {gameState.phase === 'summary' && (
            <div className="rounded-2xl bg-slate-950/90 border border-cyan-400/45 p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-500/25 pb-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/45 text-xs font-black text-amber-200 mb-2">
                    <Award className="w-4 h-4" />
                    <span>
                      {report.voyageCompleted
                        ? 'Hoàn thành hải trình'
                        : 'Tổng kết phiên (Kết thúc sớm)'}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    Tổng kết Hải trình xanh — Phục hồi đại dương
                  </h3>
                  <p className="text-xs text-cyan-200/85 mt-1">
                    {report.finalChallengeLabel} · {C10_ILLUSTRATIVE_CAPTION}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPanoramaMode((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-900/70 hover:bg-cyan-800 border border-cyan-400/40 text-xs font-bold text-cyan-100"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>{panoramaMode ? 'Thu gọn toàn cảnh' : 'Xem toàn cảnh đại dương'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowReviewPanel((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Xem lại kiến thức ({gameState.history.length} câu)</span>
                  </button>
                </div>
              </div>

              {/* Key metrics: Mission Progress STRICTLY separate from Accuracy */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-slate-900/80 border border-cyan-500/25 p-3">
                  <div className="text-[11px] font-bold text-cyan-300">Tiến độ nhiệm vụ</div>
                  <div className="text-xl font-black text-white tabular-nums mt-0.5">
                    {report.completedMissions}/{report.totalMissions} ({report.missionProgressPercent}%)
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-cyan-500/25 p-3">
                  <div className="text-[11px] font-bold text-cyan-300">Điểm tối đa bộ đề</div>
                  <div className="text-xl font-black text-amber-300 tabular-nums mt-0.5">
                    {report.maxTotalPoints} điểm
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-cyan-500/25 p-3">
                  <div className="text-[11px] font-bold text-cyan-300">Số lần dùng gợi ý</div>
                  <div className="text-xl font-black text-white tabular-nums mt-0.5">
                    {report.totalHintsUsed} câu
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/80 border border-cyan-500/25 p-3">
                  <div className="text-[11px] font-bold text-cyan-300">Trạm đại dương</div>
                  <div className="text-sm font-black text-emerald-300 mt-1">
                    {report.finalChallengeLabel}
                  </div>
                </div>
              </div>

              {/* Standings table */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-cyan-200">
                  Kết quả học tập chi tiết (Câu chưa chơi không bị tính sai)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {report.standings.map((s) => (
                    <div
                      key={s.participantId}
                      className="rounded-xl bg-slate-900/85 border border-cyan-500/30 p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-sm font-black text-cyan-100 shrink-0">
                          #{s.rank}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: s.colorHex }}
                            />
                            <span className="text-sm font-black text-white truncate">{s.name}</span>
                            {s.isTiedRank && gameState.config.mode === 'teams' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px] font-extrabold text-amber-200">
                                Đồng hạng
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                            Đúng: {s.correctCount} · Chưa đúng: {s.wrongCount} · Không trả lời: {s.noAnswerCount}
                            {s.unplayedCount > 0 ? ` · Chưa chơi: ${s.unplayedCount}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-amber-300 tabular-nums">
                          {s.score}/{s.maxPossibleScore}đ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Knowledge review accordion */}
              {showReviewPanel && (
                <div className="rounded-xl bg-slate-900/80 border border-cyan-500/25 p-4 space-y-3 max-h-96 overflow-y-auto">
                  <h4 className="text-sm font-black text-cyan-100">
                    Ôn lại kiến thức ({gameState.history.length} nhiệm vụ đã hoàn thành)
                  </h4>
                  {gameState.history.map((rec, idx) => (
                    <div
                      key={rec.missionId}
                      className="rounded-xl bg-slate-950/80 border border-slate-800 p-3 space-y-1.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-black text-cyan-200">
                          #{idx + 1} · {C10_ZONES[rec.zoneId].title} · {rec.topic}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            rec.completionKind === 'completed_direct'
                              ? 'bg-emerald-500/20 text-emerald-200'
                              : 'bg-amber-500/20 text-amber-200'
                          }`}
                        >
                          {rec.completionKind === 'completed_direct'
                            ? 'Giải đúng'
                            : 'Hoàn thành sau khi ôn lại'}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        <MathView content={rec.stemLatex} />
                      </div>
                      <div className="text-xs text-emerald-300 font-bold">
                        Đáp án: <MathView content={rec.answerLatex} />
                      </div>
                      <div className="text-xs text-slate-300">
                        Giải thích: <MathView content={rec.explanationLatex} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom summary actions */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-cyan-500/20">
                <button
                  type="button"
                  onClick={handleReplaySameSetup}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 text-slate-950 font-black text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToSetup}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-white"
                >
                  Chọn bộ câu hỏi / Cấu hình khác
                </button>
                <button
                  type="button"
                  onClick={handleExitLibrary}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-xs font-extrabold text-cyan-100"
                >
                  Về thư viện trò chơi
                </button>
              </div>
            </div>
          )}

          {/* INLINE EARLY END CONFIRMATION MODAL (No window.confirm!) */}
          {showEarlyEndModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="max-w-md w-full rounded-2xl bg-[#06243b] border border-cyan-400/45 p-5 space-y-4 shadow-2xl">
                <h3 className="text-lg font-black text-white">Kết thúc sớm hải trình?</h3>
                <p className="text-sm text-cyan-100/85">
                  Hệ thống sẽ tổng kết dựa trên {report.completedMissions}/{report.totalMissions} nhiệm vụ đã hoàn thành. Các câu chưa chơi sẽ không bị tính là sai.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEarlyEndModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
                  >
                    Quay lại chơi tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      stopVoice();
                      setShowEarlyEndModal(false);
                      setGameState((prev) => endOceanVoyageEarly(prev));
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black"
                  >
                    Xác nhận tổng kết ngay
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CleanOcean3DGame;
