import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FastForward,
  Flag,
  Layers,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  CAR_TEAM_PALETTES,
  CarRaceMatchConfig,
  CarRaceMatchState,
  CarRaceMode,
  CarRaceQuestionItem,
  CarRaceVerdict,
  D04_SAMPLE_BADGE,
  D04_SAMPLE_PACK_TITLE,
  TURBO_STREAK_TARGET,
  advanceCarRaceToNextQuestion,
  buildD04QuestionPool,
  clearD04Session,
  commitCarRaceTurnResult,
  computeCarRaceStandings,
  computeTrackTotalStages,
  createCarRaceTeams,
  createDefaultCarRaceConfig,
  createInitialCarRaceMatchState,
  editLastConfirmedCarRaceTurn,
  endCarRaceEarly,
  evaluateCarRaceSoloAnswer,
  loadD04Session,
  prepareCarRaceQuestions,
  previewCarRaceTurnOutcomes,
  saveD04Session,
  validateCarRaceSetupConfig,
} from './carRacing3dEngine';
import CarRacing3DScene, { CarLaneVisualData } from './CarRacing3DScene';

export interface CarRacing3DGameProps {
  questions: Question[];
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onCloseGame: () => void;
}

type ScreenView = 'setup' | 'match' | 'summary';
type TurnPhase = 'countdown' | 'answering' | 'judging' | 'moving' | 'settled';

const SUBJECT_LABELS: Record<string, string> = {
  all: 'Tất cả môn học',
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  civic: 'Giáo dục công dân',
};

const LEVEL_LABELS: Record<string, string> = {
  all: 'Tất cả mức độ',
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
  apply_high: 'Vận dụng cao',
};

const QUESTION_COUNT_PRESETS = [5, 10, 15] as const;
const TIMER_PRESETS = [0, 15, 20, 30, 45, 60] as const;

function stripLatexForSpeech(raw: string): string {
  return String(raw || '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\text\{([^}]+)\}/g, ' $1 ')
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\^2/g, ' bình phương')
    .replace(/\^3/g, ' lập phương')
    .replace(/\\times|\\cdot/g, ' nhân ')
    .replace(/\\%/g, ' phần trăm')
    .replace(/:/g, ' chia ')
    .replace(/=/g, ' bằng ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CarRacing3DGame: React.FC<CarRacing3DGameProps> = ({
  questions,
  resolvedClassName,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  const isDemoMode = isKhktDemoRuntime();

  // Audio controllers (consistent with A01 & A02)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState<boolean>(true);
  const [force2D, setForce2D] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Setup & match state
  const [screen, setScreen] = useState<ScreenView>('setup');
  const [config, setConfig] = useState<CarRaceMatchConfig>(() =>
    createDefaultCarRaceConfig('team_race', 2)
  );
  const [matchState, setMatchState] = useState<CarRaceMatchState | null>(null);
  const [savedSessionPrompt, setSavedSessionPrompt] = useState<CarRaceMatchState | null>(null);
  const [corruptRecoveryNotice, setCorruptRecoveryNotice] = useState<boolean>(false);

  // Active turn runtime state
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('answering');
  const [startLightPhase, setStartLightPhase] = useState<'idle' | 'countdown' | 'go'>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timeExpired, setTimeExpired] = useState<boolean>(false);
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);
  const [verdictsByTeam, setVerdictsByTeam] = useState<Record<string, CarRaceVerdict>>({});
  const [selectedOptionByTeam, setSelectedOptionByTeam] = useState<
    Record<string, string | undefined>
  >({});
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);
  const [prevStageSnapshot, setPrevStageSnapshot] = useState<Record<string, number>>({});
  const [moveEventId, setMoveEventId] = useState<number>(0);
  const [skipToken, setSkipToken] = useState<number>(0);
  const [zoomQuestionModal, setZoomQuestionModal] = useState<boolean>(false);
  const [showReviewSolutions, setShowReviewSolutions] = useState<boolean>(false);
  const [confirmEarlyEnd, setConfirmEarlyEnd] = useState<boolean>(false);

  // Solo practice inputs
  const [soloSelectedOptionId, setSoloSelectedOptionId] = useState<string | null>(null);
  const [soloTrueFalse, setSoloTrueFalse] = useState<Record<string, boolean>>({});
  const [soloShortAnswer, setSoloShortAnswer] = useState<string>('');

  // Monotonic timer refs & countdown timeout ref
  const timerStartMsRef = useRef<number>(0);
  const timerBudgetSecRef = useRef<number>(0);
  const countdownTimerRef = useRef<number | null>(null);
  const activeTurnTokenRef = useRef<string>('d04_init');
  const finishFanfarePlayedRef = useRef<boolean>(false);

  // Initialize shared EduGameSoundBank & EduGameVoiceController
  useEffect(() => {
    const bank = new EduGameSoundBank();
    const voice = new EduGameVoiceController();
    soundBankRef.current = bank;
    voiceRef.current = voice;

    const snap = voice.getSnapshot();
    setHasVietnameseVoice(snap.hasVietnameseVoice);
    const unsub = voice.subscribe((nextSnap) => {
      setHasVietnameseVoice(nextSnap.hasVietnameseVoice);
    });

    return () => {
      if (countdownTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(countdownTimerRef.current);
      }
      unsub();
      bank.dispose();
      voice.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Immediately stop all sound & speech when muted (consistent with A01 & A02)
  useEffect(() => {
    saveEduGameMuted(isMuted);
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  }, [isMuted]);

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  // Load any saved session on mount
  useEffect(() => {
    const loaded = loadD04Session();
    if (loaded.recoveredFromCorruption) {
      setCorruptRecoveryNotice(true);
    }
    if (loaded.state && loaded.state.status === 'playing') {
      setSavedSessionPrompt(loaded.state);
    }
  }, []);

  // Persist active match session cleanly
  useEffect(() => {
    if (matchState && screen === 'match' && matchState.status === 'playing') {
      saveD04Session(matchState);
    }
  }, [matchState, screen]);

  // Available bank filter options
  const bankPoolAll = useMemo(
    () =>
      buildD04QuestionPool({
        sourceKind: 'bank',
        bankQuestions: questions,
        userRole,
      }),
    [questions, userRole]
  );

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    bankPoolAll.forEach((q) => set.add(q.subject));
    return ['all', ...Array.from(set)];
  }, [bankPoolAll]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    bankPoolAll.forEach((q) => set.add(q.grade));
    return ['all', ...Array.from(set).sort()];
  }, [bankPoolAll]);

  const activeQuestionPool = useMemo(
    () =>
      buildD04QuestionPool({
        sourceKind: config.sourceKind,
        bankQuestions: questions,
        userRole,
        subjectFilter: config.subjectFilter,
        gradeFilter: config.gradeFilter,
        levelFilter: config.levelFilter,
      }),
    [
      config.sourceKind,
      config.subjectFilter,
      config.gradeFilter,
      config.levelFilter,
      questions,
      userRole,
    ]
  );

  const setupValidation = useMemo(
    () => validateCarRaceSetupConfig(config, activeQuestionPool.length),
    [config, activeQuestionPool.length]
  );

  const currentQuestion: CarRaceQuestionItem | null = useMemo(() => {
    if (!matchState) return null;
    return matchState.questionOrder[matchState.currentQuestionIndex] ?? null;
  }, [matchState]);

  const clearPendingCountdown = useCallback(() => {
    if (countdownTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const stopAllAudioNow = useCallback(() => {
    clearPendingCountdown();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, [clearPendingCountdown]);

  const initTurnUI = useCallback(
    (state: CarRaceMatchState, withCountdown = false) => {
      clearPendingCountdown();
      const token = `d04_q${state.currentQuestionIndex}_${Date.now()}`;
      activeTurnTokenRef.current = token;
      soundBankRef.current?.setActiveTurnToken(token);

      const initialVerdicts: Record<string, CarRaceVerdict> = {};
      const stageSnap: Record<string, number> = {};
      state.config.teams.forEach((t) => {
        initialVerdicts[t.id] = 'ungraded';
        stageSnap[t.id] = state.teamRuntime[t.id]?.stage ?? 0;
      });

      setVerdictsByTeam(initialVerdicts);
      setSelectedOptionByTeam({});
      setPrevStageSnapshot(stageSnap);
      setAnswerRevealed(false);
      setIsEditingLastTurn(false);
      setIsPaused(false);
      setTimeExpired(false);
      setConfirmEarlyEnd(false);
      setSoloSelectedOptionId(null);
      setSoloTrueFalse({});
      setSoloShortAnswer('');

      const budget = state.config.timerSeconds;
      setRemainingSeconds(budget);
      timerBudgetSecRef.current = budget;
      timerStartMsRef.current = performance.now();

      if (withCountdown && !reducedMotion) {
        setTurnPhase('countdown');
        setStartLightPhase('countdown');
        soundBankRef.current?.unlock();
        soundBankRef.current?.playCarStartCountdown(isMutedRef.current, token);

        countdownTimerRef.current = window.setTimeout(() => {
          setStartLightPhase('go');
          setTurnPhase('answering');
          timerStartMsRef.current = performance.now();
          countdownTimerRef.current = window.setTimeout(() => {
            setStartLightPhase('idle');
          }, 800);
        }, 920);
      } else {
        setStartLightPhase(withCountdown ? 'go' : 'idle');
        setTurnPhase('answering');
      }
    },
    [clearPendingCountdown, reducedMotion]
  );

  // Monotonic per-question timer (starts only during 'answering', respects Pause cleanly)
  useEffect(() => {
    if (screen !== 'match' || turnPhase !== 'answering' || !matchState) return;
    if (matchState.config.timerSeconds <= 0 || isPaused || timeExpired) return;

    timerStartMsRef.current = performance.now();
    const budgetAtResume = timerBudgetSecRef.current;

    const id = window.setInterval(() => {
      const elapsedSec = (performance.now() - timerStartMsRef.current) / 1000;
      const nextRemaining = Math.max(0, Math.ceil(budgetAtResume - elapsedSec));
      setRemainingSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        timerBudgetSecRef.current = 0;
        setTimeExpired(true);
        // Timer expiry ends answering time cleanly; teacher can still grade team answers written before deadline!
        if (matchState.config.mode === 'team_race') {
          setTurnPhase('judging');
        }
      }
    }, 150);

    return () => window.clearInterval(id);
  }, [screen, turnPhase, matchState, isPaused, timeExpired]);

  const handleTogglePause = useCallback(() => {
    if (turnPhase !== 'answering' || !matchState || matchState.config.timerSeconds <= 0) return;
    if (!isPaused) {
      const elapsedSec = (performance.now() - timerStartMsRef.current) / 1000;
      const left = Math.max(0, timerBudgetSecRef.current - elapsedSec);
      timerBudgetSecRef.current = left;
      setRemainingSeconds(Math.ceil(left));
      setIsPaused(true);
    } else {
      timerStartMsRef.current = performance.now();
      setIsPaused(false);
    }
  }, [turnPhase, matchState, isPaused]);

  // Mode change on setup
  const handleSelectMode = (nextMode: CarRaceMode) => {
    setConfig((prev) => {
      if (prev.mode === nextMode) return prev;
      if (nextMode === 'solo_practice') {
        return {
          ...prev,
          mode: 'solo_practice',
          teams: [{ id: 'car_solo', carNumber: 1, name: 'Xe Tự Luyện', paletteIndex: 0 }],
        };
      }
      const existingNames = prev.teams.length >= 2 ? prev.teams.map((t) => t.name) : undefined;
      return {
        ...prev,
        mode: 'team_race',
        teams: createCarRaceTeams(2, existingNames),
      };
    });
  };

  const handleSetTeamCount = (count: number) => {
    const safe = Math.max(2, Math.min(6, count));
    setConfig((prev) => ({
      ...prev,
      teams: createCarRaceTeams(
        safe,
        prev.teams.map((t) => t.name)
      ),
    }));
  };

  const handleRenameTeam = (teamId: string, name: string) => {
    setConfig((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
    }));
  };

  const handleStartRace = (overrideConfig?: CarRaceMatchConfig) => {
    const targetConfig = overrideConfig ?? config;
    const pool = buildD04QuestionPool({
      sourceKind: targetConfig.sourceKind,
      bankQuestions: questions,
      userRole,
      subjectFilter: targetConfig.subjectFilter,
      gradeFilter: targetConfig.gradeFilter,
      levelFilter: targetConfig.levelFilter,
    });
    const validation = validateCarRaceSetupConfig(targetConfig, pool.length);
    if (!validation.valid) return;

    stopAllAudioNow();
    soundBankRef.current?.unlock();
    finishFanfarePlayedRef.current = false;

    const prepared = prepareCarRaceQuestions(pool, targetConfig);
    const initial = createInitialCarRaceMatchState(targetConfig, prepared);
    setMatchState(initial);
    setSavedSessionPrompt(null);
    setShowReviewSolutions(false);
    setScreen('match');
    initTurnUI(initial, true);
  };

  const handleResumeSavedSession = () => {
    if (!savedSessionPrompt) return;
    stopAllAudioNow();
    soundBankRef.current?.unlock();
    finishFanfarePlayedRef.current = false;
    setConfig(savedSessionPrompt.config);
    setMatchState(savedSessionPrompt);
    setSavedSessionPrompt(null);
    setScreen('match');
    initTurnUI(savedSessionPrompt, false);
  };

  const handleDiscardSavedSession = () => {
    clearD04Session();
    setSavedSessionPrompt(null);
  };

  const handleSpeakQuestion = () => {
    if (!currentQuestion || isMuted || !voiceEnabled) return;
    soundBankRef.current?.unlock();
    const spoken = stripLatexForSpeech(currentQuestion.stem);
    if (!spoken) return;
    voiceRef.current?.replayText({
      text: `Câu ${matchState ? matchState.currentQuestionIndex + 1 : 1}. ${spoken}`,
      isMuted,
      voiceEnabled,
    });
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

  // Stop answering -> move to judging phase
  const handleStopAnswering = () => {
    if (turnPhase !== 'answering') return;
    setIsPaused(false);
    setTurnPhase('judging');
  };

  // Quick option select for a team in single_choice questions -> auto-marks correct/incorrect
  const handleTeamPickOption = (teamId: string, optionId: string) => {
    if (!currentQuestion || currentQuestion.type !== 'single_choice') return;
    const isCorrect = optionId === currentQuestion.correctOptionId;
    setSelectedOptionByTeam((prev) => ({ ...prev, [teamId]: optionId }));
    setVerdictsByTeam((prev) => ({
      ...prev,
      [teamId]: isCorrect ? 'correct' : 'incorrect',
    }));
  };

  const handleSetTeamVerdict = (teamId: string, verdict: CarRaceVerdict) => {
    setSelectedOptionByTeam((prev) => ({ ...prev, [teamId]: undefined }));
    setVerdictsByTeam((prev) => ({ ...prev, [teamId]: verdict }));
  };

  // Compute live pre-confirm preview for judging cards
  const turnPreviewMap = useMemo(() => {
    if (!matchState) return {};
    return previewCarRaceTurnOutcomes(matchState, verdictsByTeam);
  }, [matchState, verdictsByTeam]);

  const allTeamsGraded = useMemo(() => {
    if (!matchState) return false;
    return matchState.config.teams.every((t) => {
      const v = verdictsByTeam[t.id];
      return v === 'correct' || v === 'incorrect' || v === 'no_answer';
    });
  }, [matchState, verdictsByTeam]);

  const triggerCarMovementAndAudio = useCallback(
    (nextState: CarRaceMatchState, prevStages: Record<string, number>) => {
      const anyMoved = nextState.config.teams.some(
        (t) => (nextState.teamRuntime[t.id]?.stage ?? 0) > (prevStages[t.id] ?? 0)
      );
      const anyTurbo = nextState.config.teams.some(
        (t) => nextState.teamRuntime[t.id]?.lastTurboTriggered
      );

      setPrevStageSnapshot(prevStages);
      setMoveEventId((v) => v + 1);

      if (!anyMoved || reducedMotion || force2D) {
        if (anyTurbo) {
          soundBankRef.current?.playCarTurboBoost(
            isMutedRef.current,
            activeTurnTokenRef.current
          );
        }
        setTurnPhase('settled');
        return;
      }

      setTurnPhase('moving');
      soundBankRef.current?.unlock();
      soundBankRef.current?.startCarEngineLoop(
        () => isMutedRef.current,
        activeTurnTokenRef.current
      );
      if (anyTurbo) {
        // ONE unified Turbo boost cue even if multiple cars trigger Turbo simultaneously!
        soundBankRef.current?.playCarTurboBoost(
          isMutedRef.current,
          activeTurnTokenRef.current
        );
      }
    },
    [reducedMotion, force2D]
  );

  const handleMovementSettled = useCallback(() => {
    soundBankRef.current?.stopCarEngineLoop();
    setTurnPhase((prev) => (prev === 'moving' ? 'settled' : prev));
  }, []);

  const handleSkipAnimation = () => {
    soundBankRef.current?.stopAll();
    setSkipToken((v) => v + 1);
    setTurnPhase('settled');
  };

  // Confirm team grading (or save edited last turn)
  const handleConfirmTeamTurn = () => {
    if (!matchState || !currentQuestion || !allTeamsGraded) return;
    soundBankRef.current?.unlock();

    if (isEditingLastTurn) {
      const lastRecord = matchState.history[matchState.history.length - 1];
      const prevStages: Record<string, number> = {};
      matchState.config.teams.forEach((t) => {
        prevStages[t.id] = lastRecord?.teamOutcomes[t.id]?.stageBefore ?? 0;
      });
      const res = editLastConfirmedCarRaceTurn(
        matchState,
        verdictsByTeam,
        selectedOptionByTeam
      );
      if (!res.edited) return;
      setMatchState(res.state);
      setIsEditingLastTurn(false);
      setAnswerRevealed(true);
      triggerCarMovementAndAudio(res.state, prevStages);
      return;
    }

    const prevStages: Record<string, number> = {};
    matchState.config.teams.forEach((t) => {
      prevStages[t.id] = matchState.teamRuntime[t.id]?.stage ?? 0;
    });

    const result = commitCarRaceTurnResult(matchState, {
      question: currentQuestion,
      verdictsByTeam,
      selectedOptionByTeam,
      resultSource: 'teacher_single_device',
    });

    if (!result.committed) return;
    setMatchState(result.state);
    setAnswerRevealed(true);
    triggerCarMovementAndAudio(result.state, prevStages);
  };

  // Solo practice submit ("Chốt đáp án")
  const handleSoloSubmit = () => {
    if (!matchState || !currentQuestion || turnPhase !== 'answering') return;
    if (isPaused) return;
    if (matchState.config.timerSeconds > 0 && timeExpired) return;
    soundBankRef.current?.unlock();

    if (currentQuestion.requiresTeacherGrading) {
      setTurnPhase('judging');
      setAnswerRevealed(true);
      return;
    }

    const soloTeamId = matchState.config.teams[0].id;
    const evalRes = evaluateCarRaceSoloAnswer(currentQuestion, {
      selectedOptionId: soloSelectedOptionId,
      trueFalseSelections: soloTrueFalse,
      shortAnswerText: soloShortAnswer,
    });

    const prevStages = {
      [soloTeamId]: matchState.teamRuntime[soloTeamId]?.stage ?? 0,
    };

    const res = commitCarRaceTurnResult(matchState, {
      question: currentQuestion,
      verdictsByTeam: { [soloTeamId]: evalRes.isCorrect ? 'correct' : 'incorrect' },
      selectedOptionByTeam: { [soloTeamId]: soloSelectedOptionId ?? undefined },
      answerNotesByTeam: { [soloTeamId]: evalRes.answerNote },
      resultSource: 'student_auto',
    });
    if (!res.committed) return;

    setVerdictsByTeam({ [soloTeamId]: evalRes.isCorrect ? 'correct' : 'incorrect' });
    setMatchState(res.state);
    setAnswerRevealed(true);
    triggerCarMovementAndAudio(res.state, prevStages);
  };

  // Solo expired -> mark no_answer so user can advance cleanly
  const handleSoloRecordTimeout = () => {
    if (!matchState || !currentQuestion) return;
    const soloTeamId = matchState.config.teams[0].id;
    const prevStages = {
      [soloTeamId]: matchState.teamRuntime[soloTeamId]?.stage ?? 0,
    };
    const res = commitCarRaceTurnResult(matchState, {
      question: currentQuestion,
      verdictsByTeam: { [soloTeamId]: 'no_answer' },
      answerNotesByTeam: { [soloTeamId]: 'Hết thời gian' },
      resultSource: 'student_auto',
    });
    if (!res.committed) return;
    setVerdictsByTeam({ [soloTeamId]: 'no_answer' });
    setMatchState(res.state);
    setAnswerRevealed(true);
    setTurnPhase('settled');
    setPrevStageSnapshot(prevStages);
  };

  const handleOpenEditLastTurn = () => {
    if (!matchState || matchState.history.length === 0) return;
    stopAllAudioNow();
    const last = matchState.history[matchState.history.length - 1];
    const restoredVerdicts: Record<string, CarRaceVerdict> = {};
    const restoredOptions: Record<string, string | undefined> = {};
    matchState.config.teams.forEach((t) => {
      restoredVerdicts[t.id] = last.teamOutcomes[t.id]?.verdict ?? 'ungraded';
      restoredOptions[t.id] = last.teamOutcomes[t.id]?.selectedOptionId;
    });
    setVerdictsByTeam(restoredVerdicts);
    setSelectedOptionByTeam(restoredOptions);
    setIsEditingLastTurn(true);
    setTurnPhase('judging');
  };

  const openSummaryWithFanfare = useCallback(
    (finalState: CarRaceMatchState) => {
      stopAllAudioNow();
      clearD04Session();
      setMatchState(finalState);
      setScreen('summary');

      if (!finishFanfarePlayedRef.current) {
        finishFanfarePlayedRef.current = true;
        const standings = computeCarRaceStandings(finalState);
        const topTied = standings.length > 1 && standings[0].isTied;
        soundBankRef.current?.playCarFinishFanfare(isMutedRef.current, topTied);
      }
    },
    [stopAllAudioNow]
  );

  const handleNextOrSummary = () => {
    if (!matchState) return;
    stopAllAudioNow();
    if (matchState.status === 'finished' || matchState.history.length >= matchState.questionOrder.length) {
      openSummaryWithFanfare(matchState);
      return;
    }
    const next = advanceCarRaceToNextQuestion(matchState);
    setMatchState(next);
    initTurnUI(next, false);
  };

  const handleConfirmEarlyEnd = () => {
    if (!matchState) return;
    const ended = endCarRaceEarly(matchState);
    setConfirmEarlyEnd(false);
    openSummaryWithFanfare(ended);
  };

  const handleReplaySameTeams = () => {
    stopAllAudioNow();
    clearD04Session();
    if (matchState) {
      handleStartRace({ ...matchState.config, rulesLocked: false });
    } else {
      handleStartRace(config);
    }
  };

  const handleChangeTeams = () => {
    stopAllAudioNow();
    clearD04Session();
    setMatchState(null);
    setScreen('setup');
  };

  const handleExitToLibrary = () => {
    stopAllAudioNow();
    onCloseGame();
  };

  // Build visual lanes for 3D / 2D track
  const visualLanes: CarLaneVisualData[] = useMemo(() => {
    if (!matchState) return [];
    return matchState.config.teams.map((team) => {
      const rt = matchState.teamRuntime[team.id];
      return {
        teamId: team.id,
        carNumber: rt.carNumber,
        teamName: rt.name,
        paletteIndex: rt.paletteIndex,
        prevStage: prevStageSnapshot[team.id] ?? rt.stage,
        targetStage: rt.stage,
        correctCount: rt.correctCount,
        currentStreak: rt.currentStreak,
        turboCount: rt.turboCount,
        lastStagesGained: rt.lastStagesGained,
        turboTriggered: turnPhase === 'moving' || turnPhase === 'settled' ? rt.lastTurboTriggered : false,
      };
    });
  }, [matchState, prevStageSnapshot, turnPhase]);

  const standings = useMemo(
    () => (matchState ? computeCarRaceStandings(matchState) : []),
    [matchState]
  );

  const compactTrackView =
    screen === 'match' && (turnPhase === 'answering' || turnPhase === 'judging');

  // ============================================================================
  // RENDER HEADER (Consistent A01/A02 Speaker & Fullscreen Controls)
  // ============================================================================

  const renderTopBar = () => (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#071126] border-b border-slate-800 text-white shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={handleExitToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Về thư viện
        </button>
        <div className="min-w-0 flex items-center gap-2 text-sm">
          <span className="font-extrabold tracking-tight text-white whitespace-nowrap">
            D04 · Đua xe tốc độ 3D
          </span>
          <span className="hidden sm:inline text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="hidden sm:inline text-xs text-slate-300 truncate">
            {isDemoMode
              ? 'Bản demo KHKT (Dữ liệu mẫu tách biệt)'
              : resolvedClassName || 'Trình chiếu lớp học'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {screen === 'match' && (
          <button
            type="button"
            onClick={() => setForce2D((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
            title="Chuyển đổi góc nhìn 3D và sơ đồ 2D"
          >
            {force2D ? <Box className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            {force2D ? 'Bật 3D' : 'Sơ đồ 2D'}
          </button>
        )}

        <button
          type="button"
          onClick={handleToggleVoice}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 ${
            voiceEnabled && !isMuted
              ? 'bg-slate-800 hover:bg-slate-700 text-sky-300'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-400'
          }`}
          title={
            hasVietnameseVoice
              ? 'Bật/tắt giọng đọc tiếng Việt'
              : 'Trình duyệt chưa có giọng tiếng Việt — trò chơi vẫn hoạt động bình thường'
          }
        >
          {voiceEnabled && !isMuted ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden md:inline">Đọc tiếng Việt</span>
        </button>

        {/* Speaker toggle identical in behavior to A01 & A02 */}
        <button
          type="button"
          onClick={() => {
            if (isMuted) {
              soundBankRef.current?.unlock();
            } else {
              stopAllAudioNow();
            }
            onToggleMute();
          }}
          aria-pressed={!isMuted}
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400 ${
            isMuted
              ? 'bg-rose-950/70 text-rose-200 border border-rose-700/60 hover:bg-rose-900/70'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {isMuted ? 'Đang tắt loa' : 'Âm thanh bật'}
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-amber-400"
          aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="hidden lg:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
        </button>
      </div>
    </header>
  );

  // ============================================================================
  // RENDER SETUP SCREEN
  // ============================================================================

  const renderSetup = () => {
    const previewStages = computeTrackTotalStages(
      Math.max(1, setupValidation.effectiveQuestionCount || config.questionCount),
      config.turboEnabled
    );

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#060E1F] text-slate-100">
        <div className="max-w-6xl mx-auto space-y-5">
          {corruptRecoveryNotice && (
            <div className="rounded-xl bg-amber-950/40 border border-amber-600/50 px-4 py-3 text-xs text-amber-200 flex items-center justify-between gap-3">
              <span>
                Phát hiện dữ liệu phiên lưu cũ bị hỏng — hệ thống đã tự làm sạch an toàn để bạn bắt đầu trận mới.
              </span>
              <button
                type="button"
                onClick={() => setCorruptRecoveryNotice(false)}
                className="text-amber-300 hover:text-white font-bold"
              >
                Đóng
              </button>
            </div>
          )}

          {savedSessionPrompt && (
            <div className="rounded-xl bg-blue-950/50 border border-blue-500/60 px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-blue-100">
                <p className="font-bold text-white">Có trận Đua xe tốc độ đang dở</p>
                <p className="text-xs text-blue-200 mt-0.5 tabular-nums">
                  Đã chấm {savedSessionPrompt.history.length}/{savedSessionPrompt.questionOrder.length} câu ·{' '}
                  {savedSessionPrompt.config.teams.length} xe · Đích {savedSessionPrompt.totalStages} chặng
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition-colors"
                >
                  Tiếp tục trận cũ
                </button>
                <button
                  type="button"
                  onClick={handleDiscardSavedSession}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          {/* Mode Selector + Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Column: Mode + Teams (Only team names required, no email!) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl bg-[#0B1730] border border-slate-800 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-white">1. Chọn chế độ & Đội đua</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Chỉ cần tên đội — giáo viên điều khiển trên một máy cho lớp từ 1 đến 50 học sinh.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleSelectMode('team_race')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                        config.mode === 'team_race'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Đua theo đội (2–6)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectMode('solo_practice')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                        config.mode === 'solo_practice'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Tự luyện (1 xe)
                    </button>
                  </div>
                </div>

                {config.mode === 'team_race' ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                      <span className="text-xs font-semibold text-slate-300">Số lượng đội đua:</span>
                      <div className="flex items-center gap-1.5">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleSetTeamCount(cnt)}
                            className={`w-9 h-8 rounded-lg text-xs font-extrabold transition-colors tabular-nums ${
                              config.teams.length === cnt
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {config.teams.map((team) => {
                        const pal = CAR_TEAM_PALETTES[team.paletteIndex % CAR_TEAM_PALETTES.length];
                        return (
                          <div
                            key={team.id}
                            className="flex items-center gap-2.5 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2.5"
                          >
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0"
                              style={{
                                backgroundColor: pal.hex,
                                color: pal.hex === '#EAB308' ? '#071126' : '#ffffff',
                              }}
                            >
                              #{team.carNumber}
                            </span>
                            <div className="flex-1 min-w-0">
                              <label className="sr-only" htmlFor={`team-name-${team.id}`}>
                                Tên đội {team.carNumber}
                              </label>
                              <input
                                id={`team-name-${team.id}`}
                                type="text"
                                value={team.name}
                                maxLength={28}
                                onChange={(e) => handleRenameTeam(team.id, e.target.value)}
                                placeholder={`Nhập tên đội ${team.carNumber}`}
                                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-md px-2.5 py-1.5 text-sm font-bold text-white outline-none"
                              />
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Làn {team.carNumber} · Màu {pal.label}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-slate-900/80 border border-slate-800 p-3.5 space-y-2.5">
                    <p className="text-xs text-slate-300">
                      Chế độ Tự luyện sử dụng đúng <strong>1 xe</strong> (cho 1 học sinh hoặc cả lớp cùng giải), không tạo xe đối thủ giả.
                    </p>
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                        #1
                      </span>
                      <input
                        type="text"
                        value={config.teams[0]?.name || ''}
                        maxLength={28}
                        onChange={(e) =>
                          handleRenameTeam(config.teams[0]?.id || 'car_solo', e.target.value)
                        }
                        placeholder="Tên xe / tên học sinh hoặc lớp"
                        className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-md px-3 py-1.5 text-sm font-bold text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Question Source Panel */}
              <div className="rounded-xl bg-[#0B1730] border border-slate-800 p-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-white">2. Nguồn câu hỏi</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Bộ mẫu lưu tách khỏi ngân hàng thật · Hiện có{' '}
                      <strong className="text-amber-300 tabular-nums">
                        {activeQuestionPool.length} câu hợp lệ
                      </strong>
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setConfig((p) => ({ ...p, sourceKind: 'sample' }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                        config.sourceKind === 'sample'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {D04_SAMPLE_PACK_TITLE}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig((p) => ({ ...p, sourceKind: 'bank' }))}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap ${
                        config.sourceKind === 'bank'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Ngân hàng Smart EDU ({bankPoolAll.length})
                    </button>
                  </div>
                </div>

                {config.sourceKind === 'sample' ? (
                  <div className="rounded-lg bg-slate-900/70 border border-slate-800 px-3.5 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Gói <strong className="text-white">{D04_SAMPLE_PACK_TITLE}</strong> · 10 câu Toán THCS có đáp án & lời giải ngắn.
                    </span>
                    <span className="font-bold text-amber-300">{D04_SAMPLE_BADGE}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={config.subjectFilter}
                      onChange={(e) => setConfig((p) => ({ ...p, subjectFilter: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-semibold"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>
                          {SUBJECT_LABELS[s] || s}
                        </option>
                      ))}
                    </select>
                    <select
                      value={config.gradeFilter}
                      onChange={(e) => setConfig((p) => ({ ...p, gradeFilter: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-semibold"
                    >
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          {g === 'all' ? 'Tất cả khối lớp' : `Lớp ${g}`}
                        </option>
                      ))}
                    </select>
                    <select
                      value={config.levelFilter}
                      onChange={(e) => setConfig((p) => ({ ...p, levelFilter: e.target.value }))}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white font-semibold"
                    >
                      {Object.entries(LEVEL_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Rules & Turbo Config (Locked once race starts) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-xl bg-[#0B1730] border border-slate-800 p-4 space-y-4">
                <h2 className="text-base font-extrabold text-white">3. Cấu hình & Luật Turbo</h2>

                {/* Question count: 5, 10, 15 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">Số câu hỏi của chặng đua</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      Đích: {previewStages} chặng
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {QUESTION_COUNT_PRESETS.map((n) => {
                      const disabled = activeQuestionPool.length < n && n > activeQuestionPool.length && activeQuestionPool.length > 0 && n !== 5 && n !== 10;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setConfig((p) => ({ ...p, questionCount: n }))}
                          className={`py-2 rounded-lg text-xs font-extrabold transition-colors tabular-nums ${
                            config.questionCount === n
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                          } ${disabled ? 'opacity-65' : ''}`}
                        >
                          {n} câu
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Timer selector */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 block">
                    Thời gian mỗi câu
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                    {TIMER_PRESETS.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setConfig((p) => ({ ...p, timerSeconds: sec }))}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-colors tabular-nums ${
                          config.timerSeconds === sec
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        {sec === 0 ? 'Không GH' : `${sec}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Turbo toggle */}
                <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/90 border border-slate-800 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Chế độ Turbo (3 đúng liên tiếp +1 chặng)
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {config.turboEnabled
                        ? 'Bật: Đường đua dài N + ⌊N/3⌋ chặng (10 câu = 13 chặng).'
                        : 'Tắt: Đường đua dài đúng N chặng, ẩn bộ đếm chuỗi Turbo.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.turboEnabled}
                    onClick={() => setConfig((p) => ({ ...p, turboEnabled: !p.turboEnabled }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors shrink-0 ${
                      config.turboEnabled
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {config.turboEnabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </div>

                {/* Shuffle toggles */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 rounded-lg bg-slate-900/70 border border-slate-800 px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.shuffleQuestions}
                      onChange={(e) =>
                        setConfig((p) => ({ ...p, shuffleQuestions: e.target.checked }))
                      }
                      className="accent-blue-500"
                    />
                    <span className="text-slate-200 font-medium">Xáo thứ tự câu</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-lg bg-slate-900/70 border border-slate-800 px-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.shuffleOptions}
                      onChange={(e) =>
                        setConfig((p) => ({ ...p, shuffleOptions: e.target.checked }))
                      }
                      className="accent-blue-500"
                    />
                    <span className="text-slate-200 font-medium">Xáo đáp án A–D</span>
                  </label>
                </div>

                {/* Explicit Pre-Race Rule Summary */}
                <div className="rounded-lg bg-[#071126] border border-slate-800 p-3 text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                    Luật thi đấu (khóa cố định khi bắt đầu)
                  </p>
                  <p>• Trả lời đúng: tiến <strong>+1 chặng</strong>.</p>
                  {config.turboEnabled && (
                    <p>
                      • Đúng <strong>3 câu liên tiếp</strong>: kích hoạt <strong>Turbo +1 chặng</strong> (tổng +2 chặng ở câu thứ 3) và đặt lại chuỗi về 0.
                    </p>
                  )}
                  <p>• Chưa đúng / Không trả lời: xe giữ nguyên vị trí, chuỗi Turbo về 0.</p>
                  <p>• Đua đủ số câu đã chọn; xếp hạng theo tổng chặng (bằng chặng thì Đồng hạng).</p>
                </div>

                {/* Validation Errors & Warnings */}
                {setupValidation.errors.length > 0 && (
                  <div className="rounded-lg bg-rose-950/60 border border-rose-700/70 p-3 text-xs text-rose-200 space-y-1">
                    {setupValidation.errors.map((err, i) => (
                      <p key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                        <span>{err}</span>
                      </p>
                    ))}
                  </div>
                )}

                {setupValidation.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-950/40 border border-amber-700/50 p-3 text-xs text-amber-200 space-y-1">
                    {setupValidation.warnings.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  disabled={!setupValidation.valid}
                  onClick={() => handleStartRace()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 disabled:opacity-40 text-white text-sm font-extrabold tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-amber-400"
                >
                  <Flag className="w-4 h-4" />
                  Bắt đầu cuộc đua ({setupValidation.effectiveQuestionCount} câu · {previewStages} chặng)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER ACTIVE MATCH SCREEN (16:9 Projector + Mobile Vertical Stack)
  // ============================================================================

  const renderMatch = () => {
    if (!matchState || !currentQuestion) return null;
    const isTeamMode = matchState.config.mode === 'team_race';
    const isLastQuestion =
      matchState.history.length >= matchState.questionOrder.length ||
      matchState.currentQuestionIndex >= matchState.questionOrder.length - 1;

    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-[#060E1F] text-slate-100">
        <div className="max-w-7xl mx-auto space-y-3">
          {/* 3D / 2D Stadium Track */}
          <CarRacing3DScene
            mode={matchState.config.mode}
            lanes={visualLanes}
            totalStages={matchState.totalStages}
            turboEnabled={matchState.config.turboEnabled}
            startLightPhase={startLightPhase}
            moveEventId={moveEventId}
            skipToken={skipToken}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={compactTrackView}
            onMovementSettled={handleMovementSettled}
            onWebGLFallback={() => setForce2D(true)}
          />

          {/* Compact Team Scoreboard Strip (Stages, Correct Count, Current Turbo Streak) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {matchState.config.teams.map((team) => {
              const rt = matchState.teamRuntime[team.id];
              const pal = CAR_TEAM_PALETTES[team.paletteIndex % CAR_TEAM_PALETTES.length];
              const showTurboHit =
                (turnPhase === 'moving' || turnPhase === 'settled') && rt.lastTurboTriggered;
              return (
                <div
                  key={team.id}
                  className={`rounded-lg bg-[#0B1730] border px-3 py-2 transition-colors ${
                    showTurboHit ? 'border-amber-400' : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs shrink-0"
                      style={{
                        backgroundColor: pal.hex,
                        color: pal.hex === '#EAB308' ? '#071126' : '#ffffff',
                      }}
                    >
                      {rt.carNumber}
                    </span>
                    <span className="text-xs font-bold text-white truncate">{rt.name}</span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs tabular-nums">
                    <span className="font-extrabold text-amber-300">
                      {rt.stage}/{matchState.totalStages} chặng
                    </span>
                    <span className="text-slate-300">{rt.correctCount} đúng</span>
                  </div>
                  {matchState.config.turboEnabled && (
                    <div className="mt-1 flex items-center justify-between text-[11px] tabular-nums">
                      <span className="text-sky-300">
                        Chuỗi Turbo: {rt.currentStreak}/{TURBO_STREAK_TARGET}
                      </span>
                      {showTurboHit ? (
                        <span className="font-extrabold text-amber-300">⚡ +1</span>
                      ) : (
                        <span className="text-slate-400">{rt.turboCount} lần</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Question & Control Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* Main Question Panel */}
            <div className="lg:col-span-7 rounded-xl bg-[#0B1730] border border-slate-800 p-4 sm:p-5 space-y-4">
              {/* Top Turn Metadata & Timer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  <span className="text-sm font-extrabold text-white tabular-nums">
                    Câu {matchState.currentQuestionIndex + 1} / {matchState.questionOrder.length}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{currentQuestion.sourceBadge}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {turnPhase === 'countdown'
                      ? 'Đèn xuất phát...'
                      : turnPhase === 'answering'
                      ? isPaused
                        ? 'Đang tạm dừng'
                        : timeExpired
                        ? 'Hết giờ trả lời'
                        : 'Đang trả lời'
                      : turnPhase === 'judging'
                      ? isEditingLastTurn
                        ? 'Đang sửa kết quả câu vừa chấm'
                        : 'Chấm đáp án các đội'
                      : turnPhase === 'moving'
                      ? 'Các xe đang bứt tốc...'
                      : 'Đã cập nhật vị trí xe'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {matchState.config.timerSeconds > 0 && (
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold tabular-nums ${
                        timeExpired
                          ? 'bg-rose-950/70 text-rose-200 border border-rose-700/60'
                          : remainingSeconds <= 5
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-500/60'
                          : 'bg-slate-900 text-sky-300 border border-slate-700'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                      {timeExpired ? '0s · Hết giờ' : `${remainingSeconds}s`}
                    </div>
                  )}

                  {turnPhase === 'answering' && matchState.config.timerSeconds > 0 && !timeExpired && (
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setZoomQuestionModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    title="Phóng to câu hỏi và công thức"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    Phóng to
                  </button>

                  <button
                    type="button"
                    onClick={handleSpeakQuestion}
                    disabled={isMuted || !voiceEnabled}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-200 text-xs font-semibold"
                    title="Đọc câu hỏi bằng giọng tiếng Việt"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Đọc câu hỏi
                  </button>
                </div>
              </div>

              {/* Large Projector-Ready Question Stem */}
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-white leading-relaxed">
                <MathView content={currentQuestion.stem} />
              </div>

              {/* Options / Inputs */}
              {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentQuestion.options.map((opt) => {
                    const isOfficialCorrect =
                      answerRevealed && opt.id === currentQuestion.correctOptionId;
                    const isSoloPicked = !isTeamMode && soloSelectedOptionId === opt.id;
                    const canSoloPick =
                      !isTeamMode &&
                      turnPhase === 'answering' &&
                      !isPaused &&
                      !(matchState.config.timerSeconds > 0 && timeExpired);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!canSoloPick}
                        onClick={() => canSoloPick && setSoloSelectedOptionId(opt.id)}
                        className={`text-left rounded-xl border px-3.5 py-3 flex items-center gap-3 transition-all ${
                          isOfficialCorrect
                            ? 'bg-emerald-950/60 border-emerald-400 text-white'
                            : isSoloPicked
                            ? 'bg-blue-950/70 border-sky-400 text-white'
                            : 'bg-slate-900/90 border-slate-800 text-slate-100'
                        } ${canSoloPick ? 'hover:border-sky-400 cursor-pointer' : 'cursor-default'}`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                            isOfficialCorrect
                              ? 'bg-emerald-500 text-slate-950'
                              : isSoloPicked
                              ? 'bg-sky-400 text-slate-950'
                              : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-base sm:text-lg font-semibold min-w-0 flex-1">
                          <MathView content={opt.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'true_false_group' && currentQuestion.subItems && (
                <div className="space-y-2">
                  {currentQuestion.subItems.map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded-lg bg-slate-900/90 border border-slate-800 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="text-sm sm:text-base text-slate-100 flex-1 min-w-0">
                        <strong className="text-amber-300 mr-2">{sub.label})</strong>
                        <MathView content={sub.text} />
                      </div>
                      {!isTeamMode && turnPhase === 'answering' && (
                        <div className="flex items-center gap-1.5">
                          {[true, false].map((val) => (
                            <button
                              key={String(val)}
                              type="button"
                              disabled={isPaused || (matchState.config.timerSeconds > 0 && timeExpired)}
                              onClick={() =>
                                setSoloTrueFalse((p) => ({ ...p, [sub.id]: val }))
                              }
                              className={`px-3 py-1 rounded-md text-xs font-bold ${
                                soloTrueFalse[sub.id] === val
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {val ? 'Đúng' : 'Sai'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay') &&
                !isTeamMode &&
                turnPhase === 'answering' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Nhập câu trả lời của học sinh:
                    </label>
                    <input
                      type="text"
                      disabled={isPaused || (matchState.config.timerSeconds > 0 && timeExpired)}
                      value={soloShortAnswer}
                      onChange={(e) => setSoloShortAnswer(e.target.value)}
                      placeholder="Nhập đáp án ngắn..."
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-amber-400 px-3.5 py-2.5 text-base text-white outline-none"
                    />
                  </div>
                )}

              {/* Revealed Official Answer & Explanation */}
              {answerRevealed && (
                <div className="rounded-xl bg-emerald-950/35 border border-emerald-600/50 p-3.5 space-y-1.5">
                  <div className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      Đáp án đúng: <MathView content={currentQuestion.officialAnswerText} />
                    </span>
                  </div>
                  <div className="text-sm text-slate-200 leading-relaxed">
                    <MathView content={currentQuestion.explanation} />
                  </div>
                </div>
              )}
            </div>

            {/* Right Control & Grading Console */}
            <div className="lg:col-span-5 rounded-xl bg-[#0B1730] border border-slate-800 p-4 space-y-3.5">
              {/* Phase 1: Answering Controls */}
              {turnPhase === 'countdown' && (
                <div className="py-8 text-center space-y-2">
                  <p className="text-lg font-extrabold text-amber-300">
                    Đèn xuất phát đang đếm ngược...
                  </p>
                  <p className="text-xs text-slate-400">
                    Các đội chuẩn bị bảng con / thẻ đáp án!
                  </p>
                </div>
              )}

              {turnPhase === 'answering' && isTeamMode && (
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-white">Điều khiển lượt trả lời</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Các đội ghi đáp án ra bảng con / giấy hoặc giơ thẻ đáp án. Khi các đội đã chốt xong, giáo viên bấm <strong>Dừng trả lời</strong> để chấm đồng thời.
                  </p>
                  <button
                    type="button"
                    onClick={handleStopAnswering}
                    className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Dừng trả lời & Chấm các đội
                  </button>
                </div>
              )}

              {turnPhase === 'answering' && !isTeamMode && (
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-white">Chế độ Tự luyện (1 xe)</h3>
                  <p className="text-xs text-slate-300">
                    Chọn phương án ở khung bên trái rồi bấm <strong>Chốt đáp án</strong> trước khi hết giờ.
                  </p>
                  {timeExpired && matchState.config.timerSeconds > 0 ? (
                    <div className="space-y-2.5">
                      <p className="text-xs text-rose-300 font-semibold">
                        Đã hết thời gian trả lời của câu này (không nhận chốt sau hạn).
                      </p>
                      <button
                        type="button"
                        onClick={handleSoloRecordTimeout}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold"
                      >
                        Ghi nhận hết giờ & Xem đáp án
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        isPaused ||
                        (currentQuestion.type === 'single_choice' && !soloSelectedOptionId)
                      }
                      onClick={handleSoloSubmit}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Chốt đáp án
                    </button>
                  )}
                </div>
              )}

              {/* Phase 2: Teacher Simultaneous Grading */}
              {turnPhase === 'judging' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-extrabold text-white">
                      {isEditingLastTurn
                        ? 'Sửa kết quả câu vừa chấm'
                        : 'Chấm kết quả đồng thời'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAnswerRevealed((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-sky-300 hover:text-sky-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {answerRevealed ? 'Ẩn đáp án' : 'Công bố đáp án & lời giải'}
                    </button>
                  </div>

                  {timeExpired && (
                    <p className="text-xs text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded-lg px-3 py-1.5">
                      Đã hết giờ — giáo viên vẫn có thể chấm đáp án các đội đã chốt trước hạn.
                    </p>
                  )}

                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {matchState.config.teams.map((team) => {
                      const pal = CAR_TEAM_PALETTES[team.paletteIndex % CAR_TEAM_PALETTES.length];
                      const verdict = verdictsByTeam[team.id] ?? 'ungraded';
                      const preview = turnPreviewMap[team.id];
                      const pickedOpt = selectedOptionByTeam[team.id];

                      return (
                        <div
                          key={team.id}
                          className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs shrink-0"
                                style={{
                                  backgroundColor: pal.hex,
                                  color: pal.hex === '#EAB308' ? '#071126' : '#ffffff',
                                }}
                              >
                                {team.carNumber}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {team.name}
                              </span>
                            </div>

                            {/* Live Stage & Turbo Preview */}
                            <span className="text-[11px] font-bold tabular-nums shrink-0">
                              {verdict === 'ungraded' ? (
                                <span className="text-slate-400">Chưa chấm</span>
                              ) : preview?.willTriggerTurbo ? (
                                <span className="text-amber-300">
                                  +{preview.stagesGained} chặng (⚡ Turbo +1)
                                </span>
                              ) : preview && preview.stagesGained > 0 ? (
                                <span className="text-emerald-300">+{preview.stagesGained} chặng</span>
                              ) : (
                                <span className="text-slate-400">+0 chặng</span>
                              )}
                            </span>
                          </div>

                          {/* Optional quick A/B/C/D picker for single-choice */}
                          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400 shrink-0">Chọn PA:</span>
                              {currentQuestion.options.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleTeamPickOption(team.id, opt.id)}
                                  className={`px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                                    pickedOpt === opt.id
                                      ? 'bg-sky-500 text-slate-950'
                                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Direct Verdict Buttons */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'correct')}
                              className={`py-1.5 rounded-md text-xs font-bold transition-colors ${
                                verdict === 'correct'
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              Đúng
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'incorrect')}
                              className={`py-1.5 rounded-md text-xs font-bold transition-colors ${
                                verdict === 'incorrect'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                              }`}
                            >
                              Chưa đúng
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'no_answer')}
                              className={`py-1.5 rounded-md text-xs font-bold transition-colors ${
                                verdict === 'no_answer'
                                  ? 'bg-slate-500 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              Không TL
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={!allTeamsGraded}
                    onClick={handleConfirmTeamTurn}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-500 hover:to-sky-400 disabled:opacity-40 text-white text-sm font-extrabold transition-all flex items-center justify-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    {isEditingLastTurn
                      ? 'Cập nhật lại kết quả câu vừa chấm'
                      : 'Xác nhận kết quả & Cho xe chạy'}
                  </button>
                  {!allTeamsGraded && (
                    <p className="text-[11px] text-slate-400 text-center">
                      Hãy chấm đủ tất cả các đội trước khi xác nhận.
                    </p>
                  )}
                </div>
              )}

              {/* Phase 3: Moving / Settled Controls */}
              {(turnPhase === 'moving' || turnPhase === 'settled') && (
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-white">
                    {turnPhase === 'moving' ? 'Các xe đang di chuyển...' : 'Kết quả lượt đua'}
                  </h3>

                  {/* Outcome summary per car */}
                  <div className="space-y-1.5">
                    {matchState.config.teams.map((team) => {
                      const rt = matchState.teamRuntime[team.id];
                      const pal = CAR_TEAM_PALETTES[team.paletteIndex % CAR_TEAM_PALETTES.length];
                      return (
                        <div
                          key={team.id}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-5 h-5 rounded flex items-center justify-center font-black text-[11px] shrink-0"
                              style={{
                                backgroundColor: pal.hex,
                                color: pal.hex === '#EAB308' ? '#071126' : '#ffffff',
                              }}
                            >
                              {team.carNumber}
                            </span>
                            <span className="font-bold text-white truncate">{team.name}</span>
                          </div>
                          <div className="flex items-center gap-2 tabular-nums shrink-0">
                            {rt.lastTurboTriggered ? (
                              <span className="font-extrabold text-amber-300">
                                +{rt.lastStagesGained} chặng (⚡ Turbo +1 chặng)
                              </span>
                            ) : rt.lastStagesGained > 0 ? (
                              <span className="font-bold text-emerald-300">
                                +{rt.lastStagesGained} chặng
                              </span>
                            ) : (
                              <span className="text-slate-400">Giữ nguyên vị trí</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {turnPhase === 'moving' ? (
                    <button
                      type="button"
                      onClick={handleSkipAnimation}
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-extrabold flex items-center justify-center gap-1.5"
                    >
                      <FastForward className="w-4 h-4" />
                      Bỏ qua hoạt ảnh
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={handleNextOrSummary}
                        className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-extrabold transition-colors flex items-center justify-center gap-2"
                      >
                        {isLastQuestion ? (
                          <>
                            <Trophy className="w-4 h-4" />
                            Xem bảng tổng kết cuộc đua
                          </>
                        ) : (
                          <>
                            Câu tiếp theo
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {isTeamMode && (
                        <button
                          type="button"
                          onClick={handleOpenEditLastTurn}
                          className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa kết quả câu vừa chấm
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Utility Bar: Early End */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
                <span className="text-slate-400 tabular-nums">
                  Đã chấm: {matchState.questionsGraded}/{matchState.questionOrder.length} câu
                </span>
                {!confirmEarlyEnd ? (
                  <button
                    type="button"
                    onClick={() => setConfirmEarlyEnd(true)}
                    className="text-rose-300 hover:text-rose-200 font-semibold"
                  >
                    Kết thúc sớm
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmEarlyEnd}
                      className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold"
                    >
                      Xác nhận dừng
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmEarlyEnd(false)}
                      className="px-2 py-1 rounded bg-slate-800 text-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER SUMMARY SCREEN
  // ============================================================================

  const renderSummary = () => {
    if (!matchState) return null;
    const topWinner = standings[0];
    const hasTopTie = standings.length > 1 && Boolean(topWinner?.isTied);

    return (
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#060E1F] text-slate-100">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="rounded-2xl bg-[#0B1730] border border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-amber-300">
                  {matchState.endedEarly
                    ? `Kết thúc sớm · Đã chấm ${matchState.questionsGraded}/${matchState.questionOrder.length} câu · Chưa chơi ${matchState.questionsUnplayed} câu`
                    : `Hoàn thành đủ ${matchState.questionOrder.length} câu hỏi · Đích ${matchState.totalStages} chặng`}
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {matchState.config.mode === 'solo_practice'
                    ? `Kết quả Tự luyện: ${topWinner?.stage ?? 0}/${matchState.totalStages} chặng`
                    : hasTopTie
                    ? 'Về đích Đồng hạng Nhất!'
                    : `Vô địch đường đua: ${topWinner?.name || ''}`}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewSolutions((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-200 text-xs font-bold"
                >
                  <BookOpen className="w-4 h-4" />
                  {showReviewSolutions ? 'Ẩn lời giải' : 'Xem lại lời giải'}
                </button>
                <button
                  type="button"
                  onClick={handleReplaySameTeams}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold"
                >
                  <RotateCcw className="w-4 h-4" />
                  Đua lại
                </button>
                <button
                  type="button"
                  onClick={handleChangeTeams}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                >
                  <Users className="w-4 h-4" />
                  Đổi đội
                </button>
                <button
                  type="button"
                  onClick={handleExitToLibrary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Về thư viện
                </button>
              </div>
            </div>

            {/* Standings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2.5 px-3 font-semibold">Thứ hạng</th>
                    <th className="py-2.5 px-3 font-semibold">Đội / Xe</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Tổng chặng</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Số câu đúng</th>
                    {matchState.config.turboEnabled && (
                      <th className="py-2.5 px-3 font-semibold text-right">Số lần Turbo</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 tabular-nums">
                  {standings.map((row) => {
                    const pal = CAR_TEAM_PALETTES[row.paletteIndex % CAR_TEAM_PALETTES.length];
                    return (
                      <tr key={row.teamId} className="hover:bg-slate-900/50">
                        <td className="py-3 px-3 font-extrabold text-white whitespace-nowrap">
                          {row.isTied ? `Đồng hạng #${row.rank}` : `Hạng #${row.rank}`}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-7 h-7 rounded-md flex items-center justify-center font-black text-xs shrink-0"
                              style={{
                                backgroundColor: pal.hex,
                                color: pal.hex === '#EAB308' ? '#071126' : '#ffffff',
                              }}
                            >
                              {row.carNumber}
                            </span>
                            <span className="font-bold text-white">{row.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-amber-300">
                          {row.stage} / {matchState.totalStages}
                        </td>
                        <td className="py-3 px-3 text-right font-semibold text-emerald-300">
                          {row.correctCount} / {matchState.questionsGraded}
                        </td>
                        {matchState.config.turboEnabled && (
                          <td className="py-3 px-3 text-right font-semibold text-sky-300">
                            {row.turboCount}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Review Solutions Panel */}
          {showReviewSolutions && (
            <div className="rounded-2xl bg-[#0B1730] border border-slate-800 p-5 space-y-3">
              <h3 className="text-base font-extrabold text-white">
                Xem lại lời giải ({matchState.history.length} câu đã chấm)
              </h3>
              {matchState.history.length === 0 ? (
                <p className="text-xs text-slate-400">Chưa có câu hỏi nào được chấm trong trận này.</p>
              ) : (
                <div className="space-y-3">
                  {matchState.history.map((rec) => (
                    <div
                      key={rec.questionId}
                      className="rounded-xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-2"
                    >
                      <div className="text-sm font-bold text-white">
                        <span className="text-amber-300 mr-2">Câu {rec.turnIndex + 1}:</span>
                        <MathView content={rec.questionStem} />
                      </div>
                      <div className="text-xs text-emerald-300 font-bold">
                        Đáp án: <MathView content={rec.officialAnswerText} />
                      </div>
                      <div className="text-xs text-slate-300">
                        Lời giải: <MathView content={rec.explanation} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`w-full flex flex-col bg-[#060E1F] text-white overflow-hidden ${
        isFullscreen ? 'h-full' : 'min-h-[640px] rounded-xl border border-slate-800'
      }`}
    >
      {renderTopBar()}
      {screen === 'setup' && renderSetup()}
      {screen === 'match' && renderMatch()}
      {screen === 'summary' && renderSummary()}

      {/* Zoom Question / Formula Modal for Back-of-Classroom Readability */}
      {zoomQuestionModal && currentQuestion && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/90 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Phóng to câu hỏi"
        >
          <div className="w-full max-w-4xl rounded-2xl bg-[#0B1730] border border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <span className="text-sm font-bold text-amber-300">
                Câu {matchState ? matchState.currentQuestionIndex + 1 : 1} · Chế độ phóng to máy chiếu
              </span>
              <button
                type="button"
                onClick={() => setZoomQuestionModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                aria-label="Đóng cửa sổ phóng to"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-relaxed">
              <MathView content={currentQuestion.stem} />
            </div>
            {currentQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-xl font-semibold text-white flex items-center gap-3"
                  >
                    <span className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 font-black flex items-center justify-center shrink-0">
                      {opt.label}
                    </span>
                    <MathView content={opt.text} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CarRacing3DGame;
