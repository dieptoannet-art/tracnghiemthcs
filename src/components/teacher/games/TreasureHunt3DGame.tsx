import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Eye,
  FastForward,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Lock,
  MapPin,
  Maximize2,
  Minimize2,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trophy,
  Unlock,
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
import imgC06Cover from '../../../assets/images/game_c06_treasure_hunt_3d_1795320312684.jpg';
import {
  C06GameState,
  C06GraphicsQuality,
  C06ParticipationMode,
  C06QuestionSource,
  C06SetupConfig,
  C06StationId,
  C06_CHEST_POINTS,
  C06_MAX_TOTAL_POINTS,
  C06_SAMPLE_BADGE,
  C06_SAMPLE_CHEST_QUESTION,
  C06_STATION_COUNT,
  C06_STATION_POINTS,
  C06_STATION_TEMPLATES,
  advanceInsideC06Station,
  attemptOpenC06Chest,
  clearC06Session,
  computeC06Summary,
  createC06SetupState,
  createDefaultC06SetupConfig,
  enterC06Station,
  finishC06ToSummary,
  getC06ActiveStation,
  getC06CollectedShardCount,
  loadC06Session,
  markC06SolutionViewed,
  pickNextC06Student,
  returnToC06Map,
  revealC06Hint,
  saveC06Session,
  skipC06RevealAnimation,
  startC06Adventure,
  submitC06ChestAnswer,
  submitC06StationAnswer,
} from './treasureHunt3dEngine';
import { TreasureHunt3DScene } from './TreasureHunt3DScene';

export interface TreasureHunt3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const DEFAULT_TEAM_LABELS = [
  'Nhóm La Bàn',
  'Nhóm Hải Đăng',
  'Nhóm Pha Lê',
  'Nhóm Cổ Thụ',
  'Nhóm Thám Hiểm',
  'Nhóm Đỉnh Vàng',
];

function stripMathDelimitersForSpeech(input: string): string {
  return input
    .replace(/\\\(|\\\)/g, ' ')
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]*)\}/g, 'căn bậc hai của $1')
    .replace(/\^\\circ/g, ' độ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const TreasureHunt3DGame: React.FC<TreasureHunt3DGameProps> = ({
  classes,
  bankQuestions,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const hasUserGestureRef = useRef(false);
  const playedShardStationsRef = useRef<Set<string>>(new Set());
  const lastSoundTurnRef = useRef<string>('');

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [isVoiceReading, setIsVoiceReading] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState(() => ({
    hasVietnameseVoice: false,
    statusMessage: '',
  }));

  const [quality, setQuality] = useState<C06GraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showSamplePreview, setShowSamplePreview] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [focusedOptionIdx, setFocusedOptionIdx] = useState<number>(0);

  // Setup state
  const [participationMode, setParticipationMode] = useState<C06ParticipationMode>('solo');
  const [questionSource, setQuestionSource] = useState<C06QuestionSource>('sample_pack');
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [oralProjectorMode, setOralProjectorMode] = useState<boolean>(true);
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teamNames, setTeamNames] = useState<string[]>(DEFAULT_TEAM_LABELS);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Persisted session banner
  const [savedSession, setSavedSession] = useState<C06GameState | null>(() => {
    const loaded = loadC06Session();
    return loaded && loaded.phase !== 'setup' ? loaded : null;
  });

  const [gameState, setGameState] = useState<C06GameState>(() => createC06SetupState());

  const activeStation = useMemo(() => getC06ActiveStation(gameState), [gameState]);
  const collectedShards = useMemo(() => getC06CollectedShardCount(gameState), [gameState]);
  const summary = useMemo(() => computeC06Summary(gameState), [gameState]);

  const activeStationProgress = useMemo(() => {
    if (!activeStation) return null;
    return activeStation.questions[activeStation.activeQuestionIndex] ?? null;
  }, [activeStation]);

  const activeQuestionProgress = useMemo(() => {
    if (gameState.phase === 'chest_question' || gameState.phase === 'chest_revealed') {
      return gameState.chestQuestion;
    }
    if (gameState.phase === 'station_question' || gameState.phase === 'station_revealed') {
      return activeStationProgress;
    }
    return null;
  }, [gameState.phase, gameState.chestQuestion, activeStationProgress]);

  const availableBankCount = useMemo(() => {
    return bankQuestions.filter((q) => {
      if (userRole === 'student' && q.status !== 'approved') return false;
      return q.type === 'single_choice' && Array.isArray(q.options) && q.options.length >= 2;
    }).length;
  }, [bankQuestions, userRole]);

  const selectedClassStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const found = classes.find((c) => c.id === selectedClassId);
    if (!found || !Array.isArray(found.students)) return [];
    return found.students.slice(0, 50).map((s) => ({
      id: s.id,
      fullName: s.fullName || 'Học sinh',
    }));
  }, [classes, selectedClassId]);

  // Initialize SoundBank & VoiceController
  useEffect(() => {
    const sb = new EduGameSoundBank();
    const vc = new EduGameVoiceController();
    soundBankRef.current = sb;
    voiceRef.current = vc;
    const unsub = vc.subscribe((snap) => {
      setVoiceSnapshot({
        hasVietnameseVoice: snap.hasVietnameseVoice,
        statusMessage: snap.statusMessage,
      });
    });

    return () => {
      unsub();
      sb.stopAll();
      sb.dispose();
      vc.stop();
      vc.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const markUserGesture = useCallback(() => {
    hasUserGestureRef.current = true;
    soundBankRef.current?.unlock();
  }, []);

  const handleToggleMute = useCallback(() => {
    markUserGesture();
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
        setIsVoiceReading(false);
      }
      return next;
    });
  }, [markUserGesture]);

  const handleToggleVoice = useCallback(() => {
    markUserGesture();
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceRef.current?.stop();
        stopAllGlobalEduSpeech();
        setIsVoiceReading(false);
      }
      return next;
    });
  }, [markUserGesture]);

  // Persist session safely (and keep track of already collected shards so audio never replays)
  useEffect(() => {
    if (gameState.phase === 'setup') return;
    saveC06Session(gameState, Date.now());
  }, [gameState]);

  // Sync turn token to SoundBank and stop leftover speech on question/phase changes
  useEffect(() => {
    soundBankRef.current?.setActiveTurnToken(gameState.turnToken);
    if (lastSoundTurnRef.current !== gameState.turnToken) {
      lastSoundTurnRef.current = gameState.turnToken;
      setFocusedOptionIdx(0);
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
      setIsVoiceReading(false);
    }
  }, [gameState.turnToken]);

  // Play shard collect chime strictly ONCE per newly collected station shard
  useEffect(() => {
    const newlyAwardedStation = gameState.stations.find(
      (st) => st.shardCollected && st.shardNewlyAwarded
    );
    if (!newlyAwardedStation) return;
    if (playedShardStationsRef.current.has(newlyAwardedStation.stationId)) return;
    if (gameState.lastShardSoundId === newlyAwardedStation.stationId) {
      playedShardStationsRef.current.add(newlyAwardedStation.stationId);
      return;
    }

    playedShardStationsRef.current.add(newlyAwardedStation.stationId);
    if (!isMuted && hasUserGestureRef.current) {
      soundBankRef.current?.playTreasureShardCollect(isMuted, gameState.turnToken);
    }
    setGameState((prev) => ({
      ...prev,
      lastShardSoundId: newlyAwardedStation.stationId,
    }));
  }, [gameState.stations, gameState.lastShardSoundId, gameState.turnToken, isMuted]);

  const handleSpeakActiveQuestion = useCallback(() => {
    markUserGesture();
    if (!activeQuestionProgress || isMuted || !voiceEnabled) return;
    const text = stripMathDelimitersForSpeech(activeQuestionProgress.question.stem);
    if (!text || !voiceRef.current) return;
    setIsVoiceReading(true);
    voiceRef.current
      .replayText({
        text,
        isMuted,
        voiceEnabled,
      })
      .finally(() => setIsVoiceReading(false));
  }, [activeQuestionProgress, isMuted, voiceEnabled, markUserGesture]);

  const buildCurrentSetupConfig = useCallback((): C06SetupConfig => {
    return createDefaultC06SetupConfig({
      participationMode,
      questionSource,
      shuffleOptions,
      oralProjectorMode,
      teamCount,
      teamNames,
      classStudents: selectedClassStudents,
      selectedClassId,
    });
  }, [
    participationMode,
    questionSource,
    shuffleOptions,
    oralProjectorMode,
    teamCount,
    teamNames,
    selectedClassStudents,
    selectedClassId,
  ]);

  const handleStartAdventure = useCallback(() => {
    markUserGesture();
    setSetupError(null);
    playedShardStationsRef.current = new Set();
    const res = startC06Adventure({
      config: buildCurrentSetupConfig(),
      bankQuestions,
      userRole,
      nowMs: Date.now(),
    });
    if (!res.ok || !res.state) {
      setSetupError(res.error || 'Không thể khởi tạo hành trình Truy tìm kho báu.');
      return;
    }
    setSavedSession(null);
    setGameState(res.state);
    if (!isMuted) {
      soundBankRef.current?.playTreasureMapRustle(isMuted, res.state.turnToken);
    }
  }, [markUserGesture, buildCurrentSetupConfig, bankQuestions, userRole, isMuted]);

  const handleResumeSavedSession = useCallback(() => {
    markUserGesture();
    if (!savedSession) return;
    const restoredSet = new Set<string>();
    savedSession.stations.forEach((st) => {
      if (st.shardCollected) restoredSet.add(st.stationId);
    });
    playedShardStationsRef.current = restoredSet;
    setGameState({
      ...savedSession,
      stations: savedSession.stations.map((s) => ({ ...s, shardNewlyAwarded: false })),
    });
    setSavedSession(null);
  }, [markUserGesture, savedSession]);

  const handleDiscardSavedSession = useCallback(() => {
    clearC06Session();
    setSavedSession(null);
  }, []);

  const handleSelectStation = useCallback(
    (stationId: C06StationId) => {
      markUserGesture();
      setGameState((prev) => {
        const next = enterC06Station(prev, stationId, Date.now());
        if (!isMuted && next.turnToken !== prev.turnToken) {
          soundBankRef.current?.playTreasureMapRustle(isMuted, next.turnToken);
        }
        return next;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleSelectChest = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      const next = attemptOpenC06Chest(prev, Date.now());
      if (!isMuted) {
        soundBankRef.current?.playTreasureMapRustle(isMuted, next.turnToken);
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleReturnToMap = useCallback(() => {
    markUserGesture();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
    setIsVoiceReading(false);
    setGameState((prev) => {
      const next = returnToC06Map(prev, Date.now());
      if (!isMuted) {
        soundBankRef.current?.playTreasureMapRustle(isMuted, next.turnToken);
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleSubmitOption = useCallback(
    (optionId: string) => {
      markUserGesture();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
      setIsVoiceReading(false);
      setGameState((prev) => {
        if (prev.phase === 'station_question') {
          const next = submitC06StationAnswer({
            state: prev,
            turnToken: prev.turnToken,
            optionId,
            nowMs: Date.now(),
          });
          if (!isMuted && next !== prev) {
            const st = getC06ActiveStation(next);
            const prog = st ? st.questions[st.activeQuestionIndex] : null;
            soundBankRef.current?.playTreasureAnswerCue(
              isMuted,
              Boolean(prog?.firstTryCorrect),
              next.turnToken
            );
          }
          return next;
        }
        if (prev.phase === 'chest_question') {
          const next = submitC06ChestAnswer({
            state: prev,
            turnToken: prev.turnToken,
            optionId,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playTreasureChestOpen(
              isMuted,
              next.chestQuestion.firstTryCorrect,
              next.turnToken
            );
          }
          return next;
        }
        return prev;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleTeacherOralConfirm = useCallback(
    (isCorrect: boolean) => {
      markUserGesture();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
      setIsVoiceReading(false);
      setGameState((prev) => {
        if (prev.phase === 'station_question') {
          const next = submitC06StationAnswer({
            state: prev,
            turnToken: prev.turnToken,
            teacherConfirmCorrect: isCorrect,
            nowMs: Date.now(),
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playTreasureAnswerCue(isMuted, isCorrect, next.turnToken);
          }
          return next;
        }
        if (prev.phase === 'chest_question') {
          const next = submitC06ChestAnswer({
            state: prev,
            turnToken: prev.turnToken,
            teacherConfirmCorrect: isCorrect,
          });
          if (!isMuted && next !== prev) {
            soundBankRef.current?.playTreasureChestOpen(isMuted, isCorrect, next.turnToken);
          }
          return next;
        }
        return prev;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleSkipQuestion = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      if (prev.phase === 'station_question') {
        const next = submitC06StationAnswer({
          state: prev,
          turnToken: prev.turnToken,
          skip: true,
          nowMs: Date.now(),
        });
        if (!isMuted && next !== prev) {
          soundBankRef.current?.playTreasureAnswerCue(isMuted, false, next.turnToken);
        }
        return next;
      }
      if (prev.phase === 'chest_question') {
        const next = submitC06ChestAnswer({
          state: prev,
          turnToken: prev.turnToken,
          skip: true,
        });
        if (!isMuted && next !== prev) {
          soundBankRef.current?.playTreasureAnswerCue(isMuted, false, next.turnToken);
        }
        return next;
      }
      return prev;
    });
  }, [markUserGesture, isMuted]);

  const handleMarkSolutionViewed = useCallback(() => {
    markUserGesture();
    setGameState((prev) => markC06SolutionViewed(prev));
  }, [markUserGesture]);

  const handleAdvanceStation = useCallback(() => {
    markUserGesture();
    setGameState((prev) => advanceInsideC06Station(prev, Date.now()));
  }, [markUserGesture]);

  const handleSelectStationReviewIdx = useCallback((idx: 0 | 1) => {
    setGameState((prev) => {
      if (!prev.activeStationId) return prev;
      const st = prev.stations.find((s) => s.stationId === prev.activeStationId);
      if (!st) return prev;
      const targetProg = st.questions[idx];
      return {
        ...prev,
        phase: targetProg.status === 'unattempted' ? 'station_question' : 'station_revealed',
        stations: prev.stations.map((s) =>
          s.stationId === prev.activeStationId ? { ...s, activeQuestionIndex: idx } : s
        ),
        turnToken: `c06_st_${st.stationId}_q${idx}_${Date.now()}`,
        revealAnimDone: targetProg.status !== 'unattempted',
      };
    });
  }, []);

  const handleRevealHint = useCallback(() => {
    markUserGesture();
    setGameState((prev) => revealC06Hint(prev));
  }, [markUserGesture]);

  const handleSkipRevealAnimation = useCallback(() => {
    markUserGesture();
    setGameState((prev) => skipC06RevealAnimation(prev));
  }, [markUserGesture]);

  const handleSwitchTeam = useCallback((idx: number) => {
    setGameState((prev) => ({
      ...prev,
      activeTeamIndex: idx,
    }));
  }, []);

  const handlePickNextStudent = useCallback(() => {
    markUserGesture();
    setGameState((prev) => pickNextC06Student(prev));
  }, [markUserGesture]);

  const handleGoToSummary = useCallback(() => {
    markUserGesture();
    setGameState((prev) => finishC06ToSummary(prev));
  }, [markUserGesture]);

  const handleRestartSameConfig = useCallback(() => {
    markUserGesture();
    playedShardStationsRef.current = new Set();
    const res = startC06Adventure({
      config: gameState.config,
      bankQuestions,
      userRole,
      nowMs: Date.now(),
    });
    if (res.ok && res.state) {
      setGameState(res.state);
    }
  }, [markUserGesture, gameState.config, bankQuestions, userRole]);

  const handleBackToSetup = useCallback(() => {
    clearC06Session();
    playedShardStationsRef.current = new Set();
    setGameState(createC06SetupState(buildCurrentSetupConfig()));
  }, [buildCurrentSetupConfig]);

  // Keyboard navigation (1-4, A-D, Arrows + Enter, H hint, S skip, M/Escape map)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      const key = e.key.toLowerCase();
      if (gameState.phase === 'station_question' || gameState.phase === 'chest_question') {
        const opts = activeQuestionProgress?.question.options || [];
        if (key === '1' || key === 'a') {
          if (opts[0]) handleSubmitOption(opts[0].optionId);
          return;
        }
        if (key === '2' || key === 'b') {
          if (opts[1]) handleSubmitOption(opts[1].optionId);
          return;
        }
        if (key === '3' || key === 'c') {
          if (opts[2]) handleSubmitOption(opts[2].optionId);
          return;
        }
        if (key === '4' || key === 'd') {
          if (opts[3]) handleSubmitOption(opts[3].optionId);
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          if (opts.length > 0) setFocusedOptionIdx((idx) => (idx + 1) % opts.length);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          if (opts.length > 0) setFocusedOptionIdx((idx) => (idx - 1 + opts.length) % opts.length);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (opts[focusedOptionIdx]) handleSubmitOption(opts[focusedOptionIdx].optionId);
          return;
        }
        if (key === 'h') {
          handleRevealHint();
          return;
        }
        if (key === 's') {
          handleSkipQuestion();
          return;
        }
        if (key === 'm' || e.key === 'Escape') {
          if (gameState.phase === 'station_question') {
            handleReturnToMap();
          }
          return;
        }
      } else if (gameState.phase === 'station_revealed') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAdvanceStation();
          return;
        }
        if (key === 'm' || e.key === 'Escape') {
          handleReturnToMap();
        }
      } else if (gameState.phase === 'chest_revealed') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleGoToSummary();
        }
      } else if (gameState.phase === 'chest_locked_notice') {
        if (key === 'm' || e.key === 'Escape') {
          handleReturnToMap();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState.phase,
    activeQuestionProgress,
    focusedOptionIdx,
    handleSubmitOption,
    handleRevealHint,
    handleSkipQuestion,
    handleReturnToMap,
    handleAdvanceStation,
    handleGoToSummary,
  ]);

  const projectorStatusLabel = useMemo(() => {
    if (gameState.phase === 'station_revealed' || gameState.phase === 'chest_revealed') {
      return { text: 'Đã công bố', cls: 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200' };
    }
    if (gameState.phase === 'station_question' || gameState.phase === 'chest_question') {
      return { text: 'Đang làm', cls: 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200' };
    }
    if (activeQuestionProgress && activeQuestionProgress.status !== 'unattempted') {
      return { text: 'Đã nộp', cls: 'bg-amber-500/20 border-amber-400/60 text-amber-200' };
    }
    return { text: 'Chưa làm', cls: 'bg-slate-800 border-slate-600 text-slate-300' };
  }, [gameState.phase, activeQuestionProgress]);

  const activeTeam = gameState.teams[gameState.activeTeamIndex] ?? null;

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-full overflow-y-auto' : 'rounded-2xl border border-amber-400/25'
      } bg-[#050d1e] text-slate-100 p-3 sm:p-4 space-y-3`}
    >
      {/* Top Unified Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundBankRef.current?.stopAll();
              voiceRef.current?.stop();
              stopAllGlobalEduSpeech();
              onBackToLibrary();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về thư viện</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[11px] font-black">
              C06
            </span>
            <h2 className="text-sm sm:text-base font-black text-white">
              Truy tìm kho báu 3D
            </h2>
            {gameState.phase !== 'setup' && (
              <span className="px-2 py-0.5 rounded bg-sky-500/20 border border-sky-400/40 text-[11px] font-bold text-sky-200">
                {gameState.config.questionSource === 'sample_pack'
                  ? C06_SAMPLE_BADGE
                  : 'Ngân hàng Smart EDU'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {gameState.phase !== 'setup' && (
            <>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/50 text-xs font-black text-amber-200 tabular-nums">
                {gameState.score} / {C06_MAX_TOTAL_POINTS} điểm
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/50 text-xs font-black text-sky-200 tabular-nums">
                {collectedShards}/{C06_STATION_COUNT} mảnh
              </span>
              <span className={`px-2.5 py-1 rounded-lg border text-xs font-black ${projectorStatusLabel.cls}`}>
                {projectorStatusLabel.text}
              </span>
            </>
          )}

          <button
            type="button"
            onClick={() => setQuality((q) => (q === 'high' ? '2d' : 'high'))}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-cyan-200 cursor-pointer"
            title="Chuyển đổi bản đồ 3D và 2D nhẹ"
          >
            {quality === 'high' ? '3D' : '2D Nhẹ'}
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              reducedMotion
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
            }`}
            title="Giảm chuyển động 3D"
          >
            {reducedMotion ? 'Giảm chuyển động: BẬT' : 'Giảm chuyển động'}
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={voiceSnapshot.statusMessage || 'Đọc đề tiếng Việt (vi-VN)'}
          >
            {voiceEnabled ? 'Giọng vi-VN: BẬT' : 'Giọng đọc: TẮT'}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* SETUP SCREEN */}
      {gameState.phase === 'setup' && (
        <div className="space-y-4">
          {savedSession && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-bold text-amber-100">
                Phát hiện hành trình đang lưu ({getC06CollectedShardCount(savedSession)}/6 mảnh · {savedSession.score} điểm). Tiếp tục mà không mất tiến độ?
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Tiếp tục hành trình
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Showcase & Quick Info */}
            <div className="lg:col-span-5 rounded-2xl bg-[#091836] border border-amber-400/30 p-3.5 space-y-3">
              <div className="relative rounded-xl overflow-hidden aspect-video border border-amber-400/25">
                <img
                  src={imgC06Cover}
                  alt="Bản đồ Đảo Kho Báu 3D Tây Đô Smart EDU"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-amber-400/50 text-[11px] font-black text-amber-200">
                  {C06_SAMPLE_BADGE} · 6 Trạm + Rương 30đ
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                <p className="font-black text-white text-sm">
                  C06 – Truy tìm kho báu 3D · Ôn tập củng cố kiến thức
                </p>
                <p>
                  Khám phá tự do 6 địa điểm trên đảo (<strong className="text-amber-300">2 câu/điểm, +10đ/câu</strong>), thu thập đủ <strong className="text-cyan-300">6 mảnh ghép</strong> để mở khóa Rương Kho Báu (<strong className="text-emerald-300">+30đ</strong>, tối đa <strong className="text-white">150đ</strong>).
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
                  <span>Hướng dẫn luật chơi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSamplePreview(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Xem trước 13 câu mẫu</span>
                </button>
              </div>
            </div>

            {/* Right Configuration Panel */}
            <div className="lg:col-span-7 rounded-2xl bg-[#091836] border border-cyan-500/30 p-4 space-y-4">
              {setupError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs font-bold text-rose-100">
                  {setupError}
                </div>
              )}

              {/* Participation Mode */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-amber-200 uppercase tracking-wide">
                  1. Hình thức tổ chức (1–50 học sinh)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setParticipationMode('solo')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'solo'
                        ? 'bg-sky-500/20 border-sky-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Tự luyện / Cá nhân</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Học sinh hoặc cả lớp tự do chọn điểm, xem giải thích từng bước.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipationMode('class_teams')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'class_teams'
                        ? 'bg-sky-500/20 border-sky-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Trình chiếu lớp · Chia 2–6 nhóm</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Điều khiển 1 máy cho 1–50 HS, luân phiên nhóm và gọi tên ngẫu nhiên.
                    </div>
                  </button>
                </div>
              </div>

              {participationMode === 'class_teams' && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-200">Số nhóm tham gia (2–6):</span>
                    <div className="flex items-center gap-1.5">
                      {[2, 3, 4, 5, 6].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setTeamCount(cnt)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black border cursor-pointer ${
                            teamCount === cnt
                              ? 'bg-amber-400 text-slate-950 border-amber-200'
                              : 'bg-slate-800 border-slate-600 text-slate-200'
                          }`}
                        >
                          {cnt} nhóm
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Array.from({ length: teamCount }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={teamNames[idx] || ''}
                        onChange={(e) => {
                          const next = [...teamNames];
                          next[idx] = e.target.value;
                          setTeamNames(next);
                        }}
                        placeholder={`Nhóm ${idx + 1}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                      />
                    ))}
                  </div>

                  {classes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-300">Danh sách lớp (1–50 HS):</span>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                      >
                        <option value="">-- Không chọn lớp (vào chơi ngay) --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name} ({Math.min(50, cls.students?.length || 0)} HS)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Question Source */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-amber-200 uppercase tracking-wide">
                  2. Nguồn câu hỏi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestionSource('sample_pack')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      questionSource === 'sample_pack'
                        ? 'bg-emerald-500/20 border-emerald-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Bộ đề mẫu C06 ({C06_SAMPLE_BADGE})</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Chơi ngay không cần đăng nhập · 6 chuyên đề Toán + Rương 30đ chuẩn KaTeX.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestionSource('bank')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      questionSource === 'bank'
                        ? 'bg-emerald-500/20 border-emerald-300 text-white'
                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Ngân hàng Smart EDU ({availableBankCount} câu)</div>
                    <div className="text-[11px] opacity-80 mt-0.5">
                      Lấy câu trắc nghiệm theo phân quyền lớp học, tự bù mẫu nếu thiếu trạm.
                    </div>
                  </button>
                </div>
              </div>

              {/* Extra Toggles */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-200">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>Xáo trộn phương án A–D (khóa theo optionId)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={oralProjectorMode}
                    onChange={(e) => setOralProjectorMode(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  <span>Bật nút GV Xác nhận Đúng / Chưa đúng (cho giấy & bảng con)</span>
                </label>
              </div>

              <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                  <Keyboard className="w-3.5 h-3.5 text-amber-300" />
                  Phím tắt: 1–4 / A–D chọn · ↑↓ + Enter · H gợi ý · S bỏ qua · M/Esc về bản đồ
                </span>
                <button
                  type="button"
                  onClick={handleStartAdventure}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black shadow-lg cursor-pointer"
                >
                  Bắt đầu ngay →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE TEAM / STUDENT CALLER BAR */}
      {gameState.phase !== 'setup' && gameState.phase !== 'summary' && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#091836] border border-slate-700/80">
          <div className="flex flex-wrap items-center gap-2">
            {gameState.config.participationMode === 'class_teams' ? (
              gameState.teams.map((t, idx) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSwitchTeam(idx)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-black cursor-pointer transition-colors ${
                    idx === gameState.activeTeamIndex
                      ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  <span style={{ color: t.color }}>●</span> {t.name}: <span className="tabular-nums">{t.score}đ</span>
                </button>
              ))
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200">
                <Users className="w-3.5 h-3.5" />
                <span>Chế độ Tự luyện · {activeTeam?.name || 'Nhà thám hiểm'}</span>
              </span>
            )}

            {gameState.config.classStudents.length > 0 && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <span className="text-xs font-bold text-emerald-200">
                  HS lượt này: {gameState.activeCallerStudent?.fullName || 'Chưa chọn'}
                </span>
                <button
                  type="button"
                  onClick={handlePickNextStudent}
                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-[11px] font-black text-emerald-100 cursor-pointer"
                >
                  Đổi HS
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGoToSummary}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
            >
              Tổng kết hành trình
            </button>
          </div>
        </div>
      )}

      {/* PHASE: MAP & EARLY CHEST LOCKED NOTICE */}
      {(gameState.phase === 'map' || gameState.phase === 'chest_locked_notice') && (
        <div className="space-y-3">
          {gameState.phase === 'chest_locked_notice' && (
            <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/60 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-200 text-xs sm:text-sm font-black">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{gameState.lastActionNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={handleReturnToMap}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Đóng thông báo
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-300">Đi ngay tới điểm còn thiếu mảnh:</span>
                {gameState.stations
                  .filter((st) => !st.shardCollected)
                  .map((st) => (
                    <button
                      key={st.stationId}
                      type="button"
                      onClick={() => handleSelectStation(st.stationId)}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                    >
                      {st.title}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <TreasureHunt3DScene
            stations={gameState.stations}
            visitedOrder={gameState.visitedOrder}
            activeStationId={gameState.activeStationId}
            phase={gameState.phase}
            chestOpened={gameState.chestOpened}
            quality={quality}
            reducedMotion={reducedMotion}
            onSelectStation={handleSelectStation}
            onSelectChest={handleSelectChest}
            onWebGLFallback={() => setQuality('2d')}
          />
        </div>
      )}

      {/* PHASE: STATION QUESTION OR REVEALED */}
      {(gameState.phase === 'station_question' || gameState.phase === 'station_revealed') &&
        activeStation &&
        activeStationProgress && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Compact Map / Board Reference on Desktop */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="rounded-xl bg-[#091836] border border-cyan-500/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-300" />
                    <span className="text-xs font-black text-white">
                      Trạm {activeStation.orderIndex + 1}/6 · {activeStation.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleReturnToMap}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-amber-200 cursor-pointer"
                  >
                    ← Về bản đồ (M)
                  </button>
                </div>

                <div className="text-[11px] text-slate-300">
                  Mảnh ghép trạm: <strong className="text-sky-300">{activeStation.shardName}</strong> · Trạng thái:{' '}
                  <strong className="text-emerald-300">
                    {activeStation.shardCollected ? 'Đã lấy mảnh' : 'Đang làm (lưu tiến độ tự động)'}
                  </strong>
                </div>

                {/* Q1 / Q2 quick switch when reviewing completed station */}
                <div className="flex items-center gap-2 pt-1">
                  {([0, 1] as const).map((idx) => {
                    const qP = activeStation.questions[idx];
                    const isCur = activeStation.activeQuestionIndex === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectStationReviewIdx(idx)}
                        className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs font-black cursor-pointer ${
                          isCur
                            ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                            : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        Câu {idx + 1}/2 ·{' '}
                        {qP.status === 'correct_first_try'
                          ? '+10đ'
                          : qP.status === 'unattempted'
                            ? 'Chưa làm'
                            : '0đ'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Static 6-shard overview */}
              <div className="rounded-xl bg-[#091836] border border-amber-400/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
                  <span>Tiến độ 6 mảnh kho báu</span>
                  <span className="tabular-nums">{collectedShards}/6 mảnh</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {gameState.stations.map((st, idx) => (
                    <div
                      key={st.stationId}
                      className={`p-2 rounded-lg border text-center ${
                        st.shardCollected
                          ? 'bg-sky-500/20 border-sky-300 text-sky-100'
                          : st.stationId === activeStation.stationId
                            ? 'bg-cyan-500/15 border-cyan-400 text-cyan-100'
                            : 'bg-slate-950/80 border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[11px] font-black">Mảnh {idx + 1}</div>
                      <div className="text-[9px] font-bold truncate">
                        {st.shardCollected ? 'Đã ghép' : st.stationId === activeStation.stationId ? 'Đang làm' : 'Chưa có'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right High-Contrast Question & Reveal Area */}
            <div className="lg:col-span-7 rounded-2xl bg-[#0b1b3d] border border-cyan-400/35 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-xs font-black text-cyan-200">
                  {activeStationProgress.question.topicLabel} · Câu {activeStation.activeQuestionIndex + 1}/2 (+{C06_STATION_POINTS}đ)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSpeakActiveQuestion}
                    disabled={isMuted || !voiceEnabled}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>{isVoiceReading ? 'Đang đọc...' : 'Đọc đề'}</span>
                  </button>
                  {gameState.phase === 'station_question' && (
                    <button
                      type="button"
                      onClick={handleRevealHint}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 cursor-pointer"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>Gợi ý (H)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Question Stem */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-700 text-base sm:text-lg font-bold text-white overflow-x-auto leading-relaxed">
                <MathView content={activeStationProgress.question.stem} />
              </div>

              {activeStationProgress.question.image && (
                <div className="rounded-xl overflow-hidden border border-slate-700 max-h-48 bg-slate-950 flex justify-center">
                  <img
                    src={activeStationProgress.question.image}
                    alt="Minh họa câu hỏi"
                    className="max-h-48 object-contain"
                  />
                </div>
              )}

              {gameState.activeHintRevealed && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs sm:text-sm text-amber-100 overflow-x-auto">
                  <strong className="text-amber-300">Gợi ý: </strong>
                  <MathView content={activeStationProgress.question.hintText} />
                </div>
              )}

              {/* 4 Answer Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {activeStationProgress.question.options.map((opt, idx) => {
                  const isSelected = activeStationProgress.selectedOptionId === opt.optionId;
                  const isCorrectOpt = opt.optionId === activeStationProgress.question.correctOptionId;
                  const isRevealed = gameState.phase === 'station_revealed';

                  let btnCls =
                    'bg-slate-900/95 border-slate-700 text-slate-100 hover:border-amber-400 hover:bg-slate-800';
                  if (isRevealed) {
                    if (isCorrectOpt) {
                      btnCls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                    } else if (isSelected && !isCorrectOpt) {
                      btnCls = 'bg-rose-500/25 border-rose-400 text-rose-100';
                    } else {
                      btnCls = 'bg-slate-950/70 border-slate-800 text-slate-400';
                    }
                  } else if (idx === focusedOptionIdx) {
                    btnCls = 'bg-slate-800 border-amber-400 text-white ring-2 ring-amber-400/50';
                  }

                  return (
                    <button
                      key={opt.optionId}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => handleSubmitOption(opt.optionId)}
                      className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-2.5 overflow-x-auto ${
                        isRevealed ? 'cursor-default' : 'cursor-pointer'
                      } ${btnCls}`}
                    >
                      <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                        {opt.labelKey}
                      </span>
                      <div className="text-sm sm:text-base font-bold overflow-x-auto">
                        <MathView content={opt.text} />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Projector Oral / Paper Confirmation Controls + Skip */}
              {gameState.phase === 'station_question' && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  {gameState.config.oralProjectorMode ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-300">Chấm miệng / Bảng con:</span>
                      <button
                        type="button"
                        onClick={() => handleTeacherOralConfirm(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-xs font-black text-emerald-200 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Xác nhận Đúng (+{C06_STATION_POINTS}đ)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTeacherOralConfirm(false)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-xs font-black text-rose-200 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Chưa đúng (0đ)</span>
                      </button>
                    </div>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={handleSkipQuestion}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua (S)</span>
                  </button>
                </div>
              )}

              {/* Reveal & Explanation Area */}
              {gameState.phase === 'station_revealed' && (
                <div className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-400/35 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-black text-amber-200">
                      {gameState.lastActionNotice}
                    </div>
                    {!gameState.revealAnimDone && (
                      <button
                        type="button"
                        onClick={handleSkipRevealAnimation}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Bỏ qua hoạt ảnh</span>
                      </button>
                    )}
                  </div>

                  <div className="text-xs sm:text-sm text-slate-100 leading-relaxed overflow-x-auto">
                    <strong className="text-cyan-300">Giải thích từng bước: </strong>
                    <MathView content={activeStationProgress.question.explanationText} />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    {(activeStationProgress.status === 'wrong' ||
                      activeStationProgress.status === 'skipped') &&
                    !activeStationProgress.viewedSolution ? (
                      <button
                        type="button"
                        onClick={handleMarkSolutionViewed}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-xs font-black text-cyan-100 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Đã xem lời giải hướng dẫn (giữ 0đ, mở điều kiện lấy mảnh)</span>
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        {activeStationProgress.firstTryCorrect
                          ? 'Ghi nhận: Đúng lần đầu (+10đ)'
                          : activeStationProgress.viewedSolution
                            ? 'Ghi nhận: Đã xem lời giải hướng dẫn (0đ)'
                            : ''}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleAdvanceStation}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black cursor-pointer"
                    >
                      {activeStation.activeQuestionIndex === 0 &&
                      activeStation.questions[1].status === 'unattempted'
                        ? 'Sang Câu 2/2 →'
                        : activeStation.shardCollected
                          ? 'Về bản đồ (M) →'
                          : 'Hoàn thành trạm & Nhận mảnh →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      {/* PHASE: CENTRAL TREASURE CHEST QUESTION OR REVEALED (30 PTS) */}
      {(gameState.phase === 'chest_question' || gameState.phase === 'chest_revealed') && (
        <div className="rounded-2xl bg-gradient-to-br from-[#0b1e42] via-[#091836] to-[#111827] border-2 border-amber-400/60 p-4 sm:p-5 space-y-3.5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/20 border border-amber-300/60 text-amber-300">
                <Unlock className="w-5 h-5" />
              </span>
              <div>
                <div className="text-xs font-black text-amber-300 uppercase">
                  Đã ghép đủ 6/6 mảnh · Thử thách mở Rương Kho Báu
                </div>
                <h3 className="text-base font-black text-white">
                  {gameState.chestQuestion.question.topicLabel}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpeakActiveQuestion}
                disabled={isMuted || !voiceEnabled}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-300" />
                <span>Đọc đề</span>
              </button>
              {gameState.phase === 'chest_question' && (
                <button
                  type="button"
                  onClick={handleRevealHint}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-xs font-bold text-amber-200 cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Gợi ý (H)</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-400/35 text-base sm:text-lg font-bold text-white overflow-x-auto leading-relaxed">
            <MathView content={gameState.chestQuestion.question.stem} />
          </div>

          {gameState.activeHintRevealed && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 text-xs sm:text-sm text-amber-100 overflow-x-auto">
              <strong className="text-amber-300">Gợi ý: </strong>
              <MathView content={gameState.chestQuestion.question.hintText} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {gameState.chestQuestion.question.options.map((opt, idx) => {
              const isSelected = gameState.chestQuestion.selectedOptionId === opt.optionId;
              const isCorrectOpt = opt.optionId === gameState.chestQuestion.question.correctOptionId;
              const isRevealed = gameState.phase === 'chest_revealed';

              let cls = 'bg-slate-900 border-slate-700 text-slate-100 hover:border-amber-400';
              if (isRevealed) {
                if (isCorrectOpt) cls = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                else if (isSelected && !isCorrectOpt) cls = 'bg-rose-500/25 border-rose-400 text-rose-100';
                else cls = 'bg-slate-950/70 border-slate-800 text-slate-400';
              } else if (idx === focusedOptionIdx) {
                cls = 'bg-slate-800 border-amber-400 text-white ring-2 ring-amber-400/50';
              }

              return (
                <button
                  key={opt.optionId}
                  type="button"
                  disabled={isRevealed}
                  onClick={() => handleSubmitOption(opt.optionId)}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 overflow-x-auto ${
                    isRevealed ? 'cursor-default' : 'cursor-pointer'
                  } ${cls}`}
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-600 flex items-center justify-center text-xs font-black shrink-0">
                    {opt.labelKey}
                  </span>
                  <div className="text-sm sm:text-base font-bold overflow-x-auto">
                    <MathView content={opt.text} />
                  </div>
                </button>
              );
            })}
          </div>

          {gameState.phase === 'chest_question' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800">
              {gameState.config.oralProjectorMode ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-300">Chấm miệng / Bảng con:</span>
                  <button
                    type="button"
                    onClick={() => handleTeacherOralConfirm(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/60 text-xs font-black text-emerald-200 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Xác nhận Đúng (+{C06_CHEST_POINTS}đ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTeacherOralConfirm(false)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/60 text-xs font-black text-rose-200 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Chưa đúng (0đ)</span>
                  </button>
                </div>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={handleSkipQuestion}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <SkipForward className="w-3.5 h-3.5" />
                <span>Bỏ qua (S)</span>
              </button>
            </div>
          )}

          {gameState.phase === 'chest_revealed' && (
            <div className="p-4 rounded-xl bg-slate-950/90 border border-amber-400/45 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-black text-amber-200">{gameState.lastActionNotice}</div>
                {!gameState.revealAnimDone && (
                  <button
                    type="button"
                    onClick={handleSkipRevealAnimation}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <FastForward className="w-3.5 h-3.5" />
                    <span>Bỏ qua hoạt ảnh</span>
                  </button>
                )}
              </div>

              <div className="text-xs sm:text-sm text-slate-100 leading-relaxed overflow-x-auto">
                <strong className="text-cyan-300">Giải thích từng bước: </strong>
                <MathView content={gameState.chestQuestion.question.explanationText} />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGoToSummary}
                  className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black cursor-pointer"
                >
                  Xem tổng kết hành trình →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE: SUMMARY SCREEN */}
      {gameState.phase === 'summary' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-[#0c1f45] via-[#091836] to-[#0b132b] border border-amber-400/45 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-400/20 border border-amber-300/60 text-amber-300">
                  <Trophy className="w-7 h-7" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-amber-300 uppercase">
                    Hoàn thành hành trình Truy tìm kho báu 3D
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white tabular-nums">
                    Tổng điểm: {summary.totalScore} / {summary.maxScore} điểm
                  </h3>
                  <div className="text-xs text-slate-300">
                    Điểm trạm: {summary.stationScore}/120 · Điểm rương kho báu: {summary.chestScore}/30 · Mảnh ghép: {summary.shardsCollected}/6
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRestartSameConfig}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Chơi lại</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToSetup}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 cursor-pointer"
                >
                  Đổi cấu hình
                </button>
                <button
                  type="button"
                  onClick={onBackToLibrary}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Về thư viện
                </button>
              </div>
            </div>

            {/* Distinct Question Outcome Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-center">
                <div className="text-lg font-black text-emerald-200 tabular-nums">
                  {summary.stationCorrectFirstTry + (summary.chestCorrect ? 1 : 0)}
                </div>
                <div className="text-[11px] font-bold text-emerald-100">Đúng lần đầu</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-center">
                <div className="text-lg font-black text-cyan-200 tabular-nums">
                  {summary.stationWrongViewedGuide}
                </div>
                <div className="text-[11px] font-bold text-cyan-100">Sai (đã xem hướng dẫn)</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-400/50 text-center">
                <div className="text-lg font-black text-rose-200 tabular-nums">
                  {summary.stationWrong}
                </div>
                <div className="text-[11px] font-bold text-rose-100">Sai</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-center">
                <div className="text-lg font-black text-amber-200 tabular-nums">
                  {summary.stationSkipped}
                </div>
                <div className="text-[11px] font-bold text-amber-100">Bỏ qua</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                <div className="text-lg font-black text-slate-200 tabular-nums">
                  {summary.stationUnattempted + (gameState.chestQuestion.status === 'unattempted' ? 1 : 0)}
                </div>
                <div className="text-[11px] font-bold text-slate-300">Chưa làm</div>
              </div>
            </div>

            {gameState.config.participationMode === 'class_teams' && (
              <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-200">
                  <Award className="w-4 h-4" />
                  <span>Bảng điểm các nhóm</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[...gameState.teams]
                    .sort((a, b) => b.score - a.score)
                    .map((team, idx) => (
                      <div
                        key={team.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-between gap-2"
                      >
                        <div className="text-xs font-black text-white truncate">
                          #{idx + 1} · {team.name}
                        </div>
                        <span className="text-xs font-black text-amber-300 tabular-nums">
                          {team.score}đ
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Full 13-Question Review */}
            <div className="space-y-2">
              <div className="text-xs font-black text-cyan-200 uppercase">
                Xem lại toàn bộ 12 câu trạm & Câu tổng hợp Rương Kho Báu
              </div>
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {gameState.stations.flatMap((st) =>
                  st.questions.map((qp, qIdx) => {
                    const key = `${st.stationId}_${qIdx}`;
                    const open = Boolean(expandedReviewIds[key]);
                    const statusBadge =
                      qp.status === 'correct_first_try'
                        ? 'Đúng lần đầu (+10đ)'
                        : qp.status === 'wrong_viewed_guide'
                          ? 'Sai · Đã xem hướng dẫn (0đ)'
                          : qp.status === 'wrong'
                            ? 'Sai (0đ)'
                            : qp.status === 'skipped'
                              ? 'Bỏ qua (0đ)'
                              : 'Chưa làm';

                    return (
                      <div
                        key={key}
                        className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black text-white">
                            {st.title} · Câu {qIdx + 1}/2
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-amber-200">{statusBadge}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReviewIds((prev) => ({ ...prev, [key]: !open }))
                              }
                              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-200 cursor-pointer"
                            >
                              {open ? 'Ẩn lời giải' : 'Xem lời giải'}
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-slate-200 overflow-x-auto">
                          <MathView content={qp.question.stem} />
                        </div>
                        {open && (
                          <div className="p-2.5 rounded-lg bg-slate-950 border border-cyan-500/30 text-xs text-cyan-100 overflow-x-auto">
                            <MathView content={qp.question.explanationText} />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Final Chest Q */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-amber-200">
                      Rương Kho Báu Trung Tâm (30 điểm)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-white">
                        {gameState.chestQuestion.status === 'correct_first_try'
                          ? 'Đúng (+30đ)'
                          : gameState.chestQuestion.status === 'unattempted'
                            ? 'Chưa mở'
                            : 'Chưa đúng / Bỏ qua (0đ)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedReviewIds((prev) => ({
                            ...prev,
                            chest: !prev.chest,
                          }))
                        }
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-cyan-200 cursor-pointer"
                      >
                        {expandedReviewIds.chest ? 'Ẩn lời giải' : 'Xem lời giải'}
                      </button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-100 overflow-x-auto">
                    <MathView content={gameState.chestQuestion.question.stem} />
                  </div>
                  {expandedReviewIds.chest && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-amber-400/40 text-xs text-amber-100 overflow-x-auto">
                      <MathView content={gameState.chestQuestion.question.explanationText} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="max-w-lg w-full rounded-2xl bg-[#091836] border border-amber-400/50 p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-amber-200">
                <Compass className="w-4 h-4" />
                <span>Luật chơi C06 – Truy tìm kho báu 3D</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2 text-xs text-slate-200 list-disc pl-5 leading-relaxed">
              <li>Bản đồ gồm <strong>6 địa điểm</strong> quanh rương kho báu trung tâm. Học sinh được chọn tự do thứ tự khám phá.</li>
              <li>Mỗi địa điểm gồm <strong>2 câu hỏi</strong> (+10đ/câu đúng lần đầu, tối đa 120đ từ 6 trạm).</li>
              <li>Nếu trả lời sai hoặc bỏ qua tại trạm, xem <strong>lời giải hướng dẫn từng bước</strong> để nắm chắc kiến thức và vẫn nhận đủ mảnh ghép (giữ 0đ cho câu sai).</li>
              <li>Có thể rời trạm giữa chừng sau Câu 1 và quay lại làm tiếp Câu 2 mà không mất hay đổi câu hỏi.</li>
              <li>Khi ghép đủ <strong>6/6 mảnh</strong> trên Bảng ghép tĩnh, Rương Kho Báu mở khóa <strong>Câu tổng hợp 30 điểm</strong> (tổng điểm tối đa toàn hành trình: <strong>150 điểm</strong>).</li>
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAMPLE PREVIEW MODAL */}
      {showSamplePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full rounded-2xl bg-[#091836] border border-cyan-400/50 p-5 space-y-3 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-cyan-200">
                <Sparkles className="w-4 h-4" />
                <span>Xem trước 13 câu hỏi mẫu C06 ({C06_SAMPLE_BADGE})</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSamplePreview(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto space-y-2 pr-1 text-xs">
              {C06_STATION_TEMPLATES.map((tpl, stIdx) => (
                <div key={tpl.stationId} className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-1.5">
                  <div className="font-black text-amber-300">
                    Điểm {stIdx + 1}: {tpl.title} ({tpl.subtitle})
                  </div>
                  {tpl.sampleQuestions.map((q, qIdx) => (
                    <div key={q.questionId} className="text-slate-200 overflow-x-auto">
                      <strong>Câu {qIdx + 1}: </strong>
                      <MathView content={q.stem} />
                    </div>
                  ))}
                </div>
              ))}
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/50 space-y-1">
                <div className="font-black text-amber-200">Rương Kho Báu Trung Tâm (30đ)</div>
                <div className="text-slate-100 overflow-x-auto">
                  <MathView content={C06_SAMPLE_CHEST_QUESTION.stem} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasureHunt3DGame;
