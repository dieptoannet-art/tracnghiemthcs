import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit3,
  Eye,
  FastForward,
  Flag,
  HelpCircle,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Volume2,
  VolumeX,
  XCircle,
  AlertTriangle,
  Mic,
  MicOff,
  Box,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  D03_SAMPLE_BADGE,
  D03_SAMPLE_PACK_TITLE,
  TeamVerdict,
  TugMatchConfig,
  TugMatchState,
  TugMode,
  TugQuestionItem,
  advanceToNextQuestion,
  buildD03QuestionPool,
  clearD03Session,
  commitTurnResult,
  computeTurnPreview,
  createDefaultTugConfig,
  createInitialMatchState,
  editLastConfirmedTurn,
  endMatchEarly,
  evaluateSoloAnswer,
  loadD03Session,
  prepareMatchQuestions,
  saveD03Session,
  validateTugSetupConfig,
} from './tugOfWar3dEngine';
import TugOfWar3DScene from './TugOfWar3DScene';

export interface TugOfWar3DGameProps {
  questions: Question[];
  classes?: ClassRoom[];
  selectedSourceKey?: string;
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
type TurnPhase = 'answering' | 'judging' | 'post_confirm';

const SUBJECT_LABELS: Record<string, string> = {
  all: 'Tất cả môn học',
  math: 'Toán học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  science: 'Khoa học tự nhiên',
  history_geo: 'Lịch sử & Địa lí',
  informatics: 'Tin học',
  technology: 'Công nghệ',
  civics: 'GDCD',
  other: 'Môn khác',
};

const LEVEL_LABELS: Record<string, string> = {
  all: 'Tất cả mức độ',
  know: 'Nhận biết',
  understand: 'Thông hiểu',
  apply: 'Vận dụng',
};

const VERDICT_META: Record<
  TeamVerdict,
  { label: string; short: string; badgeClass: string }
> = {
  ungraded: {
    label: 'Chưa chấm',
    short: 'Chưa chấm',
    badgeClass: 'bg-slate-700 text-slate-200 border-slate-500',
  },
  correct: {
    label: 'Đúng',
    short: 'Đúng',
    badgeClass: 'bg-emerald-600 text-white border-emerald-400',
  },
  incorrect: {
    label: 'Chưa đúng',
    short: 'Chưa đúng',
    badgeClass: 'bg-rose-600 text-white border-rose-400',
  },
  no_answer: {
    label: 'Không trả lời',
    short: 'Không TL',
    badgeClass: 'bg-amber-700 text-amber-100 border-amber-400',
  },
};

export const TugOfWar3DGame: React.FC<TugOfWar3DGameProps> = ({
  questions,
  resolvedClassName,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  // Audio & Vietnamese Voice controllers (reuses Smart EDU shared engine)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const turnTokenCounterRef = useRef<number>(1);
  const activeTurnTokenRef = useRef<string>('d03_init');

  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [force2D, setForce2D] = useState<boolean>(false);
  const [webglAutoFallbackNotice, setWebglAutoFallbackNotice] = useState<boolean>(false);

  // Sync mute state with EDUGameCenter + persisted audio preference
  useEffect(() => {
    isMutedRef.current = isMuted;
    saveEduGameMuted(isMuted);
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  }, [isMuted]);

  // Initialize mute preference on mount if parent wasn't synced
  useEffect(() => {
    const persistedMute = loadEduGameMuted(isMuted);
    if (persistedMute !== isMuted) {
      // Keep parent as source of truth during session, only read voice availability
    }
    const unsub = voiceRef.current?.subscribe((snap) => {
      setHasVietnameseVoice(snap.hasVietnameseVoice);
    });
    return () => {
      unsub?.();
      soundBankRef.current?.dispose();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextAudioToken = useCallback(() => {
    turnTokenCounterRef.current += 1;
    const tok = `d03_t_${turnTokenCounterRef.current}`;
    activeTurnTokenRef.current = tok;
    soundBankRef.current?.setActiveTurnToken(tok);
    return tok;
  }, []);

  // Setup & Match state
  const [screen, setScreen] = useState<ScreenView>('setup');
  const [setupConfig, setSetupConfig] = useState<TugMatchConfig>(() =>
    createDefaultTugConfig('two_teams')
  );
  const [savedSession, setSavedSession] = useState<TugMatchState | null>(null);
  const [storageRecoveryNotice, setStorageRecoveryNotice] = useState<boolean>(false);

  // Active match state
  const [matchState, setMatchState] = useState<TugMatchState | null>(null);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('answering');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timerExpiredNotice, setTimerExpiredNotice] = useState<boolean>(false);

  // Per-turn judging inputs
  const [teamAVerdict, setTeamAVerdict] = useState<TeamVerdict>('ungraded');
  const [teamBVerdict, setTeamBVerdict] = useState<TeamVerdict>('ungraded');
  const [teamAAnswerNote, setTeamAAnswerNote] = useState<string>('');
  const [teamBAnswerNote, setTeamBAnswerNote] = useState<string>('');
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);

  // Solo practice inputs
  const [soloSelectedOptionId, setSoloSelectedOptionId] = useState<string | null>(null);
  const [soloTrueFalseMap, setSoloTrueFalseMap] = useState<Record<string, boolean>>({});
  const [soloShortInput, setSoloShortInput] = useState<string>('');
  const [soloTeacherVerdict, setSoloTeacherVerdict] = useState<TeamVerdict>('ungraded');

  // Edit-last-confirmed-turn state
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);
  const [editTeamAVerdict, setEditTeamAVerdict] = useState<TeamVerdict>('ungraded');
  const [editTeamBVerdict, setEditTeamBVerdict] = useState<TeamVerdict>('ungraded');
  const [editSoloVerdict, setEditSoloVerdict] = useState<TeamVerdict>('ungraded');

  // Animation & UI controls
  const [pullEventId, setPullEventId] = useState<number>(0);
  const [lastDelta, setLastDelta] = useState<number>(0);
  const [skipToken, setSkipToken] = useState<number>(0);
  const [isPullAnimating, setIsPullAnimating] = useState<boolean>(false);
  const [brokenImageMap, setBrokenImageMap] = useState<Record<string, boolean>>({});
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState<boolean>(false);
  const [showSummaryKnowledge, setShowSummaryKnowledge] = useState<boolean>(true);
  const [commitGuardBusy, setCommitGuardBusy] = useState<boolean>(false);

  const summaryReviewRef = useRef<HTMLDivElement | null>(null);

  // Load any saved session safely on mount
  useEffect(() => {
    const loaded = loadD03Session();
    if (loaded.recoveredFromCorruption) {
      setStorageRecoveryNotice(true);
    }
    if (loaded.state && loaded.state.status === 'playing') {
      setSavedSession(loaded.state);
    }
  }, []);

  // Build available question pools for Setup screen
  const availableBankAll = useMemo(
    () =>
      buildD03QuestionPool({
        sourceKind: 'bank',
        bankQuestions: questions,
        userRole,
      }),
    [questions, userRole]
  );

  const availablePool = useMemo(
    () =>
      buildD03QuestionPool({
        sourceKind: setupConfig.sourceKind,
        bankQuestions: questions,
        userRole,
        subjectFilter: setupConfig.subjectFilter,
        gradeFilter: setupConfig.gradeFilter,
        levelFilter: setupConfig.levelFilter,
      }),
    [
      setupConfig.sourceKind,
      setupConfig.subjectFilter,
      setupConfig.gradeFilter,
      setupConfig.levelFilter,
      questions,
      userRole,
    ]
  );

  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    availableBankAll.forEach((q) => set.add(q.subject));
    return Array.from(set);
  }, [availableBankAll]);

  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    availableBankAll.forEach((q) => set.add(q.grade));
    return Array.from(set).sort();
  }, [availableBankAll]);

  const setupValidation = useMemo(
    () => validateTugSetupConfig(setupConfig, availablePool.length),
    [setupConfig, availablePool.length]
  );

  const currentQuestion: TugQuestionItem | null = useMemo(() => {
    if (!matchState) return null;
    return matchState.questionOrder[matchState.currentQuestionIndex] ?? null;
  }, [matchState]);

  const isCurrentQuestionCommitted = useMemo(() => {
    if (!matchState || !currentQuestion) return false;
    return matchState.history.some((h) => h.questionId === currentQuestion.id);
  }, [matchState, currentQuestion]);

  const lastCommittedRecord = useMemo(() => {
    if (!matchState || matchState.history.length === 0) return null;
    return matchState.history[matchState.history.length - 1];
  }, [matchState]);

  const resetPerQuestionInputs = useCallback((timerSecs: number) => {
    setTurnPhase('answering');
    setRemainingSeconds(timerSecs);
    setIsPaused(false);
    setTimerExpiredNotice(false);
    setTeamAVerdict('ungraded');
    setTeamBVerdict('ungraded');
    setTeamAAnswerNote('');
    setTeamBAnswerNote('');
    setAnswerRevealed(false);
    setSoloSelectedOptionId(null);
    setSoloTrueFalseMap({});
    setSoloShortInput('');
    setSoloTeacherVerdict('ungraded');
    setIsEditingLastTurn(false);
    setCommitGuardBusy(false);
  }, []);

  // Single monotonic countdown timer per question (pausing preserves exact time)
  useEffect(() => {
    if (
      screen !== 'match' ||
      !matchState ||
      matchState.status !== 'playing' ||
      turnPhase !== 'answering' ||
      isPaused ||
      matchState.config.timerSeconds <= 0
    ) {
      return;
    }

    if (remainingSeconds <= 0) {
      // Timer expired: end answering phase WITHOUT auto-marking teams wrong!
      setTimerExpiredNotice(true);
      soundBankRef.current?.playTimerBell(isMutedRef.current);
      if (matchState.config.mode === 'two_teams') {
        setTurnPhase('judging');
      }
      return;
    }

    const id = window.setTimeout(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearTimeout(id);
  }, [screen, matchState, turnPhase, isPaused, remainingSeconds]);

  // Persist match state on every change
  useEffect(() => {
    if (!matchState) return;
    if (matchState.status === 'playing') {
      saveD03Session(matchState);
    } else {
      clearD03Session();
    }
  }, [matchState]);

  const handleToggleVoice = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    saveEduGameVoiceEnabled(next);
    if (!next) {
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  };

  const handleStopPullAudioOnSettle = useCallback(() => {
    setIsPullAnimating(false);
    soundBankRef.current?.stopTugPullLoop();
  }, []);

  const handleSkipAnimation = useCallback(() => {
    setSkipToken((prev) => prev + 1);
    setIsPullAnimating(false);
    soundBankRef.current?.stopTugPullLoop();
  }, []);

  const announceMatchSummaryVoice = useCallback(
    (state: TugMatchState, turnId: string) => {
      if (isMutedRef.current || !voiceEnabled) return;
      let text = '';
      if (state.status === 'win_a_target' || state.status === 'win_a_position') {
        text = `Chúc mừng ${state.config.teamAName} đã giành chiến thắng!`;
      } else if (state.status === 'win_b_target' || state.status === 'win_b_position') {
        text = `Chúc mừng ${state.config.teamBName} đã giành chiến thắng!`;
      } else if (state.status === 'draw') {
        text = 'Trận đấu kết thúc với tỉ số hòa đầy kịch tính!';
      } else if (state.status === 'solo_win') {
        text = 'Chúc mừng cả lớp đã hoàn thành mục tiêu Tự luyện!';
      }
      if (!text) return;
      voiceRef.current
        ?.announceStudentOnce({
          turnId,
          studentName: state.config.teamAName,
          customText: text,
          isMuted: isMutedRef.current,
          voiceEnabled,
          onBeforeSpeak: () => soundBankRef.current?.stopTugPullLoop(),
        })
        .catch(() => {});
    },
    [voiceEnabled]
  );

  // Start a fresh match
  const handleStartMatch = (overrideConfig?: TugMatchConfig) => {
    const cfg = overrideConfig ?? setupConfig;
    const pool = buildD03QuestionPool({
      sourceKind: cfg.sourceKind,
      bankQuestions: questions,
      userRole,
      subjectFilter: cfg.subjectFilter,
      gradeFilter: cfg.gradeFilter,
      levelFilter: cfg.levelFilter,
    });
    const validation = validateTugSetupConfig(cfg, pool.length);
    if (!validation.valid) return;

    const effectiveConfig: TugMatchConfig = {
      ...cfg,
      questionCount: validation.effectiveQuestionCount,
      winTarget: validation.effectiveWinTarget,
      rulesLocked: true,
    };
    const preparedQuestions = prepareMatchQuestions(pool, effectiveConfig);
    const initial = createInitialMatchState(effectiveConfig, preparedQuestions);

    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    voiceRef.current?.resetTurnDedupe();
    const tok = nextAudioToken();
    soundBankRef.current?.playTugWhistle(isMutedRef.current, tok);

    setMatchState(initial);
    setSavedSession(null);
    setLastDelta(0);
    setIsPullAnimating(false);
    setShowEndEarlyConfirm(false);
    resetPerQuestionInputs(effectiveConfig.timerSeconds);
    setScreen('match');
  };

  // Resume saved session from localStorage
  const handleResumeSavedSession = () => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    setMatchState(savedSession);
    setSetupConfig(savedSession.config);
    setSavedSession(null);
    setLastDelta(0);
    setIsPullAnimating(false);
    resetPerQuestionInputs(savedSession.config.timerSeconds);
    setScreen(savedSession.status === 'playing' ? 'match' : 'summary');
  };

  // Teacher stops answering phase early in two-team mode
  const handleStopAnsweringPhase = () => {
    if (isPaused) return;
    soundBankRef.current?.unlock();
    setTurnPhase('judging');
  };

  // Live preview of rope movement before committing
  const liveTurnPreview = useMemo(() => {
    if (!matchState) return null;
    if (matchState.config.mode === 'two_teams') {
      if (teamAVerdict === 'ungraded' || teamBVerdict === 'ungraded') return null;
      return computeTurnPreview({
        mode: 'two_teams',
        teamAName: matchState.config.teamAName,
        teamBName: matchState.config.teamBName,
        teamAVerdict,
        teamBVerdict,
      });
    }
    if (currentQuestion?.requiresTeacherGrading && soloTeacherVerdict !== 'ungraded') {
      return computeTurnPreview({
        mode: 'solo_practice',
        teamAName: '',
        teamBName: '',
        teamAVerdict: 'ungraded',
        teamBVerdict: 'ungraded',
        soloVerdict: soloTeacherVerdict,
      });
    }
    return null;
  }, [matchState, teamAVerdict, teamBVerdict, currentQuestion, soloTeacherVerdict]);

  // Two-team atomic commit (idempotent per question)
  const handleCommitTwoTeams = () => {
    if (!matchState || !currentQuestion || isPaused || commitGuardBusy) return;
    if (teamAVerdict === 'ungraded' || teamBVerdict === 'ungraded') return;
    setCommitGuardBusy(true);

    const result = commitTurnResult(matchState, {
      question: currentQuestion,
      teamAVerdict,
      teamBVerdict,
      teamAAnswerNote: teamAAnswerNote.trim() || undefined,
      teamBAnswerNote: teamBAnswerNote.trim() || undefined,
      resultSource: 'teacher_single_device',
    });

    if (!result.committed || !result.record) {
      setCommitGuardBusy(false);
      return;
    }

    const tok = nextAudioToken();
    const delta = result.record.ropeDelta;
    setAnswerRevealed(true);
    setMatchState(result.state);
    setTurnPhase('post_confirm');
    setLastDelta(delta);
    setPullEventId((p) => p + 1);

    if (delta !== 0 && !reducedMotion) {
      setIsPullAnimating(true);
      soundBankRef.current?.startTugPullLoop(() => isMutedRef.current, tok);
    } else if (delta === 0) {
      setIsPullAnimating(false);
      soundBankRef.current?.playTugNeutralTick(isMutedRef.current, tok);
    } else {
      setIsPullAnimating(false);
    }

    // Play end chime/fanfare if match just finished
    if (result.state.status !== 'playing') {
      const endDelay = delta !== 0 && !reducedMotion ? 850 : 120;
      window.setTimeout(() => {
        if (activeTurnTokenRef.current !== tok) return;
        soundBankRef.current?.stopTugPullLoop();
        if (result.state.status === 'draw') {
          soundBankRef.current?.playTugDrawChime(isMutedRef.current, tok);
        } else {
          soundBankRef.current?.playTugWinFanfare(isMutedRef.current, tok);
        }
        announceMatchSummaryVoice(result.state, `summary_${tok}`);
      }, endDelay);
    }
  };

  // Solo practice submit / teacher grade commit
  const handleCommitSoloTurn = (explicitTeacherVerdict?: TeamVerdict) => {
    if (!matchState || !currentQuestion || isPaused || commitGuardBusy) return;
    setCommitGuardBusy(true);

    let verdict: TeamVerdict;
    let note: string;
    let source: 'teacher_single_device' | 'student_auto' = 'student_auto';

    if (currentQuestion.requiresTeacherGrading || explicitTeacherVerdict) {
      verdict = explicitTeacherVerdict ?? soloTeacherVerdict;
      if (verdict === 'ungraded') {
        setCommitGuardBusy(false);
        return;
      }
      note = soloShortInput.trim() || VERDICT_META[verdict].label;
      source = 'teacher_single_device';
    } else {
      const evalRes = evaluateSoloAnswer(currentQuestion, {
        selectedOptionId: soloSelectedOptionId,
        trueFalseSelections: soloTrueFalseMap,
        shortAnswerText: soloShortInput,
      });
      verdict = evalRes.isCorrect ? 'correct' : 'incorrect';
      note = evalRes.answerNote;
    }

    const result = commitTurnResult(matchState, {
      question: currentQuestion,
      teamAVerdict: 'ungraded',
      teamBVerdict: 'ungraded',
      soloVerdict: verdict,
      soloAnswerNote: note,
      resultSource: source,
    });

    if (!result.committed || !result.record) {
      setCommitGuardBusy(false);
      return;
    }

    const tok = nextAudioToken();
    const delta = result.record.ropeDelta;
    setAnswerRevealed(true);
    setMatchState(result.state);
    setTurnPhase('post_confirm');
    setLastDelta(delta);
    setPullEventId((p) => p + 1);

    if (delta !== 0 && !reducedMotion) {
      setIsPullAnimating(true);
      soundBankRef.current?.startTugPullLoop(() => isMutedRef.current, tok);
    } else {
      setIsPullAnimating(false);
      soundBankRef.current?.playTugNeutralTick(isMutedRef.current, tok);
    }

    if (result.state.status !== 'playing') {
      const endDelay = delta !== 0 && !reducedMotion ? 850 : 120;
      window.setTimeout(() => {
        if (activeTurnTokenRef.current !== tok) return;
        soundBankRef.current?.stopTugPullLoop();
        if (result.state.status === 'solo_win') {
          soundBankRef.current?.playTugWinFanfare(isMutedRef.current, tok);
        } else {
          soundBankRef.current?.playTugDrawChime(isMutedRef.current, tok);
        }
        announceMatchSummaryVoice(result.state, `summary_${tok}`);
      }, endDelay);
    }
  };

  // Open inline edit for the just-confirmed question
  const handleStartEditLastTurn = () => {
    if (!lastCommittedRecord || !matchState) return;
    soundBankRef.current?.stopTugPullLoop();
    setIsPullAnimating(false);
    setEditTeamAVerdict(lastCommittedRecord.teamAVerdict);
    setEditTeamBVerdict(lastCommittedRecord.teamBVerdict);
    setEditSoloVerdict(lastCommittedRecord.soloVerdict ?? 'incorrect');
    setIsEditingLastTurn(true);
  };

  // Save edited last turn and recompute full match state from history
  const handleSaveEditLastTurn = () => {
    if (!matchState) return;
    const prevRope = matchState.ropePosition;
    const res =
      matchState.config.mode === 'two_teams'
        ? editLastConfirmedTurn(matchState, {
            teamAVerdict: editTeamAVerdict,
            teamBVerdict: editTeamBVerdict,
          })
        : editLastConfirmedTurn(matchState, {
            soloVerdict: editSoloVerdict,
          });

    if (!res.edited || !res.record) return;

    const tok = nextAudioToken();
    setMatchState(res.state);
    setIsEditingLastTurn(false);
    const ropeDiff = res.state.ropePosition - prevRope;
    setLastDelta(Math.sign(ropeDiff));
    setPullEventId((p) => p + 1);

    if (ropeDiff !== 0 && !reducedMotion) {
      setIsPullAnimating(true);
      soundBankRef.current?.startTugPullLoop(() => isMutedRef.current, tok);
    } else {
      setIsPullAnimating(false);
      soundBankRef.current?.playTugNeutralTick(isMutedRef.current, tok);
    }
  };

  // Advance manually to next question (or summary if finished)
  const handleNextOrSummary = () => {
    if (!matchState) return;
    soundBankRef.current?.stopTugPullLoop();
    setIsPullAnimating(false);

    if (matchState.status !== 'playing') {
      setScreen('summary');
      return;
    }

    const next = advanceToNextQuestion(matchState);
    setMatchState(next);
    resetPerQuestionInputs(next.config.timerSeconds);
  };

  // Stop match early
  const handleConfirmEndEarly = () => {
    if (!matchState) return;
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    const ended = endMatchEarly(matchState);
    setMatchState(ended);
    setShowEndEarlyConfirm(false);
    setScreen('summary');
  };

  // Safe exit back to library
  const handleExitLibrary = () => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
    onCloseGame();
  };

  // Keyboard shortcuts (Space to pause/resume during answering, Escape to close modal)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape' && showEndEarlyConfirm) {
        setShowEndEarlyConfirm(false);
        return;
      }
      if (
        e.code === 'Space' &&
        screen === 'match' &&
        turnPhase === 'answering' &&
        matchState?.config.timerSeconds &&
        matchState.config.timerSeconds > 0
      ) {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, turnPhase, matchState, showEndEarlyConfirm]);

  const demoModeActive = isKhktDemoRuntime();

  // ============================================================================
  // RENDER: SETUP SCREEN
  // ============================================================================
  if (screen === 'setup') {
    const isTwoTeams = setupConfig.mode === 'two_teams';

    return (
      <div
        className={`w-full bg-[#091224] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
          isFullscreen ? 'h-full rounded-none border-0' : ''
        }`}
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#0E1A32] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExitLibrary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Về thư viện
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-extrabold text-amber-300">D03</span>
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Kéo co kiến thức 3D
                </h2>
                {demoModeActive && (
                  <span className="text-[11px] font-bold text-amber-300 border border-amber-400/40 bg-amber-500/10 rounded px-2 py-0.5">
                    Bản demo KHKT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Giáo viên điều khiển trên một máy · Trình chiếu trực tiếp cho lớp 1–50 học sinh
                {resolvedClassName ? ` · Lớp: ${resolvedClassName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer ${
                isMuted
                  ? 'border-rose-500/50 bg-rose-950/60 text-rose-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Đang tắt tiếng' : 'Âm thanh'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          </div>
        </div>

        {/* Setup Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Storage recovery / Resume session notices */}
          {storageRecoveryNotice && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Dữ liệu phiên lưu trước bị lỗi định dạng và đã được tự động làm mới an toàn.</span>
              </div>
              <button
                type="button"
                onClick={() => setStorageRecoveryNotice(false)}
                className="text-amber-300 hover:text-white font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {savedSession && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/50 bg-sky-950/45 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-sky-100">
                  Có trận đấu đang tạm dở ({savedSession.history.length}/
                  {savedSession.questionOrder.length} câu đã chấm)
                </p>
                <p className="text-xs text-sky-300 mt-0.5">
                  {savedSession.config.mode === 'two_teams'
                    ? `${savedSession.config.teamAName} vs ${savedSession.config.teamBName} · Vị trí dây: ${
                        savedSession.ropePosition > 0
                          ? `+${savedSession.ropePosition}`
                          : savedSession.ropePosition
                      }`
                    : `Tự luyện · Đạt ${savedSession.ropePosition}/${savedSession.config.winTarget} vạch`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="rounded-lg bg-sky-500 hover:bg-sky-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Tiếp tục trận đang dở
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearD03Session();
                    setSavedSession(null);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          {/* 3D Arena Live Preview */}
          <TugOfWar3DScene
            mode={setupConfig.mode}
            teamAName={setupConfig.teamAName || 'Đội A'}
            teamBName={setupConfig.teamBName || 'Đội B'}
            soloName={setupConfig.soloName || 'Tự luyện'}
            ropePosition={0}
            winTarget={setupConfig.winTarget}
            lastDelta={0}
            pullEventId={0}
            skipToken={0}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={true}
            matchStatus="playing"
            winner={null}
            onWebGLFallback={() => setWebglAutoFallbackNotice(true)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: Mode + Teams */}
            <div className="lg:col-span-6 space-y-4 rounded-xl border border-slate-800 bg-[#0E1A32] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-2.5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  1. Chọn chế độ thi đấu
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        mode: 'two_teams',
                        questionCount: Math.min(10, Math.max(1, availablePool.length || 10)),
                        winTarget: 3,
                      }))
                    }
                    className={`text-left rounded-xl border-2 p-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      isTwoTeams
                        ? 'border-sky-400 bg-sky-950/50'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white">Kéo co hai đội</span>
                      <span className="text-[11px] font-bold text-sky-300">Mặc định</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Hai đội cùng giải 1 câu hỏi. Chỉ một đội đúng dây mới dịch 1 vạch về đội đó.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        mode: 'solo_practice',
                        questionCount: Math.min(5, Math.max(1, availablePool.length || 5)),
                        winTarget: 3,
                      }))
                    }
                    className={`text-left rounded-xl border-2 p-3.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                      !isTwoTeams
                        ? 'border-amber-400 bg-amber-950/40'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-extrabold text-white">Tự luyện</span>
                      <span className="text-[11px] font-bold text-amber-300">Không AI giả</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Học sinh hoặc cả lớp kéo dây về vạch đích. Mỗi câu đúng tiến 1 vạch.
                    </p>
                  </button>
                </div>
              </div>

              {/* Team Name Inputs */}
              {isTwoTeams ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 p-3">
                    <label
                      htmlFor="d03-team-a"
                      className="flex items-center gap-2 text-xs font-extrabold text-blue-200 mb-1.5"
                    >
                      <span className="inline-block h-3 w-3 rounded-sm bg-blue-500" />
                      Đội bên trái (Vạch −{setupConfig.winTarget})
                    </label>
                    <input
                      id="d03-team-a"
                      type="text"
                      value={setupConfig.teamAName}
                      maxLength={32}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({ ...prev, teamAName: e.target.value }))
                      }
                      placeholder="VD: Đội Xanh (Tổ 1-2)"
                      className="w-full rounded-lg border border-blue-500/40 bg-slate-950 px-3 py-2 text-sm font-bold text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  <div className="rounded-xl border border-orange-500/40 bg-orange-950/30 p-3">
                    <label
                      htmlFor="d03-team-b"
                      className="flex items-center gap-2 text-xs font-extrabold text-orange-200 mb-1.5"
                    >
                      <span className="inline-block h-3 w-3 rounded-sm bg-orange-500" />
                      Đội bên phải (Vạch +{setupConfig.winTarget})
                    </label>
                    <input
                      id="d03-team-b"
                      type="text"
                      value={setupConfig.teamBName}
                      maxLength={32}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({ ...prev, teamBName: e.target.value }))
                      }
                      placeholder="VD: Đội Cam (Tổ 3-4)"
                      className="w-full rounded-lg border border-orange-500/40 bg-slate-950 px-3 py-2 text-sm font-bold text-white placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 p-3">
                  <label
                    htmlFor="d03-solo-name"
                    className="block text-xs font-extrabold text-blue-200 mb-1.5"
                  >
                    Tên lớp / người tham gia Tự luyện (tùy chọn)
                  </label>
                  <input
                    id="d03-solo-name"
                    type="text"
                    value={setupConfig.soloName}
                    maxLength={40}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({ ...prev, soloName: e.target.value }))
                    }
                    placeholder="VD: Lớp 6A1 – Ôn tập Toán"
                    className="w-full rounded-lg border border-blue-500/40 bg-slate-950 px-3 py-2 text-sm font-bold text-white placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                  />
                </div>
              )}

              {/* Rules Summary Box */}
              <div className="rounded-xl border border-slate-700/80 bg-slate-950/70 p-3.5 text-xs text-slate-300 space-y-1.5">
                <p className="font-extrabold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Luật kéo co cố định khi vào trận:
                </p>
                {isTwoTeams ? (
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    <li>Chỉ Đội Trái đúng → dây dịch 1 vạch sang trái; chỉ Đội Phải đúng → dịch 1 vạch sang phải.</li>
                    <li>Cả hai đội cùng đúng → dây giữ nguyên và cả hai đội đều được cộng 1 câu đúng.</li>
                    <li>Cả hai đội chưa đúng / không trả lời → dây giữ nguyên.</li>
                    <li>Chạm vạch −{setupConfig.winTarget} hoặc +{setupConfig.winTarget} thắng ngay; hết câu hỏi xét vị trí cuối trận hoặc Hòa.</li>
                  </ul>
                ) : (
                  <ul className="space-y-1 list-disc list-inside text-slate-300">
                    <li>Trả lời đúng → dây kéo tiến thêm 1 vạch về vạch đích ({setupConfig.winTarget} vạch).</li>
                    <li>Trả lời chưa đúng → vị trí dây giữ nguyên, xem lời giải để rút kinh nghiệm.</li>
                  </ul>
                )}
              </div>
            </div>

            {/* Right Column: Question Source + Match Parameters */}
            <div className="lg:col-span-6 space-y-4 rounded-xl border border-slate-800 bg-[#0E1A32] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-2.5 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  2. Nguồn câu hỏi & thông số trận đấu
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        sourceKind: 'sample',
                      }))
                    }
                    className={`text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      setupConfig.sourceKind === 'sample'
                        ? 'border-emerald-400 bg-emerald-950/40'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white">{D03_SAMPLE_PACK_TITLE}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-300">{D03_SAMPLE_BADGE}</span>
                      <span className="font-mono text-slate-300">10 câu</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        sourceKind: 'bank',
                      }))
                    }
                    className={`text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      setupConfig.sourceKind === 'bank'
                        ? 'border-sky-400 bg-sky-950/40'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-white">Ngân hàng câu hỏi Smart EDU</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="font-bold text-sky-300">Tái sử dụng NHCH</span>
                      <span className="font-mono text-slate-300">{availableBankAll.length} câu</span>
                    </div>
                  </button>
                </div>

                {/* Smart EDU Bank Filters */}
                {setupConfig.sourceKind === 'bank' && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      aria-label="Lọc môn học"
                      value={setupConfig.subjectFilter}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-100"
                    >
                      <option value="all">Tất cả môn</option>
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>
                          {SUBJECT_LABELS[s] || s}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Lọc khối lớp"
                      value={setupConfig.gradeFilter}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-100"
                    >
                      <option value="all">Tất cả khối</option>
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>
                          Khối {g}
                        </option>
                      ))}
                    </select>

                    <select
                      aria-label="Lọc mức độ"
                      value={setupConfig.levelFilter}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({ ...prev, levelFilter: e.target.value }))
                      }
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-100"
                    >
                      {Object.entries(LEVEL_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2">
                  <span>Số câu hợp lệ sẵn sàng trong nguồn đang chọn:</span>
                  <span className="font-mono font-extrabold text-emerald-300">
                    {availablePool.length} câu
                  </span>
                </div>
              </div>

              {/* Numeric Controls: Question Count, Win Target, Timer */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="d03-q-count"
                    className="block text-xs font-bold text-slate-300 mb-1"
                  >
                    Số câu hỏi tối đa
                  </label>
                  <input
                    id="d03-q-count"
                    type="number"
                    min={1}
                    max={Math.max(1, availablePool.length || 30)}
                    value={setupConfig.questionCount}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 1);
                      setSetupConfig((prev) => ({
                        ...prev,
                        questionCount: val,
                        winTarget: Math.min(prev.winTarget, val),
                      }));
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="d03-win-target"
                    className="block text-xs font-bold text-slate-300 mb-1"
                  >
                    Vạch thắng (mục tiêu)
                  </label>
                  <input
                    id="d03-win-target"
                    type="number"
                    min={1}
                    max={Math.max(1, Math.min(10, setupConfig.questionCount))}
                    value={setupConfig.winTarget}
                    onChange={(e) => {
                      const val = Math.max(1, Number(e.target.value) || 1);
                      setSetupConfig((prev) => ({ ...prev, winTarget: val }));
                    }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="d03-timer"
                    className="block text-xs font-bold text-slate-300 mb-1"
                  >
                    Thời gian / câu
                  </label>
                  <select
                    id="d03-timer"
                    value={setupConfig.timerSeconds}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        timerSeconds: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-bold text-white"
                  >
                    <option value={15}>15 giây</option>
                    <option value={30}>30 giây (Mặc định)</option>
                    <option value={45}>45 giây</option>
                    <option value={60}>60 giây</option>
                    <option value={0}>Không giới hạn</option>
                  </select>
                </div>
              </div>

              {/* Shuffle & Display Options */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-200 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupConfig.shuffleQuestions}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                    }
                    className="rounded border-slate-600 bg-slate-900 accent-sky-500"
                  />
                  Trộn thứ tự câu hỏi
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupConfig.shuffleOptions}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                    }
                    className="rounded border-slate-600 bg-slate-900 accent-sky-500"
                  />
                  Trộn phương án A/B/C/D (giữ nguyên đáp án đúng)
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 accent-sky-500"
                  />
                  Giảm chuyển động
                </label>
              </div>

              {/* Validation Warnings / Errors */}
              {setupValidation.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-xs text-amber-200 space-y-1">
                  {setupValidation.warnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                </div>
              )}

              {setupValidation.errors.length > 0 && (
                <div className="rounded-lg border border-rose-500/50 bg-rose-950/50 px-3 py-2 text-xs text-rose-200 space-y-1">
                  {setupValidation.errors.map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={!setupValidation.valid}
                onClick={() => handleStartMatch()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 px-5 py-3.5 text-base font-extrabold text-white shadow-lg transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                <Play className="w-5 h-5 fill-current" />
                {isTwoTeams ? 'Bắt đầu trận Kéo co 3D' : 'Bắt đầu Tự luyện Kéo co 3D'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: SUMMARY SCREEN
  // ============================================================================
  if (screen === 'summary' && matchState) {
    const isTwoTeams = matchState.config.mode === 'two_teams';
    const headline =
      matchState.status === 'win_a_target' || matchState.status === 'win_a_position'
        ? `${matchState.config.teamAName} chiến thắng!`
        : matchState.status === 'win_b_target' || matchState.status === 'win_b_position'
          ? `${matchState.config.teamBName} chiến thắng!`
          : matchState.status === 'draw'
            ? 'Trận đấu kết thúc Hòa!'
            : matchState.status === 'solo_win'
              ? 'Chinh phục vạch đích thành công!'
              : matchState.status === 'ended_early'
                ? 'Trận đấu kết thúc sớm'
                : 'Hoàn thành phiên Tự luyện';

    return (
      <div
        className={`w-full bg-[#091224] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
          isFullscreen ? 'h-full rounded-none border-0' : ''
        }`}
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0E1A32] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-sm sm:text-base text-white">
              Tổng kết D03 — Kéo co kiến thức 3D
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 3D Final Arena Pose */}
          <TugOfWar3DScene
            mode={matchState.config.mode}
            teamAName={matchState.config.teamAName}
            teamBName={matchState.config.teamBName}
            soloName={matchState.config.soloName}
            ropePosition={matchState.ropePosition}
            winTarget={matchState.config.winTarget}
            lastDelta={0}
            pullEventId={0}
            skipToken={skipToken}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={true}
            matchStatus={matchState.status}
            winner={matchState.winner}
          />

          {/* Result Hero Card */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#122343] via-[#0E1B34] to-[#111C33] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  {matchState.endReasonLabel}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">{headline}</h2>
                <p className="text-sm text-slate-300 mt-1.5">
                  Đã chấm <strong className="text-white">{matchState.history.length}</strong> /{' '}
                  {matchState.questionOrder.length} câu hỏi · Vị trí dây cuối trận:{' '}
                  <strong className="font-mono text-amber-300">
                    {matchState.ropePosition > 0
                      ? `+${matchState.ropePosition}`
                      : matchState.ropePosition}
                  </strong>{' '}
                  (Mục tiêu: {isTwoTeams ? `±${matchState.config.winTarget}` : matchState.config.winTarget}{' '}
                  vạch)
                </p>
              </div>

              {isTwoTeams ? (
                <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                  <div className="rounded-xl border border-blue-400/50 bg-blue-950/50 px-4 py-3 text-center min-w-[138px]">
                    <p className="text-xs font-bold text-blue-200 truncate">
                      {matchState.config.teamAName}
                    </p>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">
                      {matchState.teamACorrect}
                    </p>
                    <p className="text-[11px] text-blue-300">câu trả lời đúng</p>
                  </div>
                  <div className="rounded-xl border border-orange-400/50 bg-orange-950/50 px-4 py-3 text-center min-w-[138px]">
                    <p className="text-xs font-bold text-orange-200 truncate">
                      {matchState.config.teamBName}
                    </p>
                    <p className="text-2xl font-black font-mono text-white mt-0.5">
                      {matchState.teamBCorrect}
                    </p>
                    <p className="text-[11px] text-orange-300">câu trả lời đúng</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/40 px-5 py-3 text-center">
                  <p className="text-xs font-bold text-emerald-200">Số câu đúng</p>
                  <p className="text-2xl font-black font-mono text-white mt-0.5">
                    {matchState.soloCorrect} / {matchState.history.length}
                  </p>
                  <p className="text-[11px] text-emerald-300">
                    Đạt {matchState.ropePosition}/{matchState.config.winTarget} vạch
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowSummaryKnowledge(true);
                  summaryReviewRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-900/50 hover:bg-emerald-800/60 px-4 py-2.5 text-sm font-bold text-emerald-100 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Xem lại kiến thức
              </button>

              <button
                type="button"
                onClick={() => handleStartMatch(matchState.config)}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Đấu lại
              </button>

              <button
                type="button"
                onClick={() => {
                  soundBankRef.current?.stopAll();
                  voiceRef.current?.stop();
                  setSetupConfig({ ...matchState.config, rulesLocked: false });
                  setMatchState(null);
                  setScreen('setup');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-sm font-bold text-white cursor-pointer"
              >
                <Users className="w-4 h-4" />
                Đổi đội
              </button>

              <button
                type="button"
                onClick={handleExitLibrary}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-4 py-2.5 text-sm font-bold text-slate-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Về thư viện
              </button>
            </div>
          </div>

          {/* Knowledge Review List */}
          <div
            ref={summaryReviewRef}
            className="rounded-2xl border border-slate-800 bg-[#0E1A32] p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Ôn tập lời giải các câu đã thi đấu ({matchState.history.length} câu)
              </h3>
              <button
                type="button"
                onClick={() => setShowSummaryKnowledge((prev) => !prev)}
                className="text-xs font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
              >
                {showSummaryKnowledge ? 'Thu gọn' : 'Mở rộng'}
              </button>
            </div>

            {showSummaryKnowledge && (
              <div className="space-y-3">
                {matchState.history.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có câu hỏi nào được chấm trong trận này.</p>
                ) : (
                  matchState.history.map((rec, idx) => (
                    <div
                      key={rec.questionId}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/75 p-4 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-sky-300">
                          Câu {idx + 1} · {rec.questionCode}
                          {rec.wasEdited ? ' (Đã chỉnh sửa kết quả)' : ''}
                        </span>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {isTwoTeams ? (
                            <>
                              <span
                                className={`rounded border px-2 py-0.5 font-bold ${
                                  VERDICT_META[rec.teamAVerdict].badgeClass
                                }`}
                              >
                                {matchState.config.teamAName}: {VERDICT_META[rec.teamAVerdict].short}
                              </span>
                              <span
                                className={`rounded border px-2 py-0.5 font-bold ${
                                  VERDICT_META[rec.teamBVerdict].badgeClass
                                }`}
                              >
                                {matchState.config.teamBName}: {VERDICT_META[rec.teamBVerdict].short}
                              </span>
                            </>
                          ) : (
                            <span
                              className={`rounded border px-2 py-0.5 font-bold ${
                                VERDICT_META[rec.soloVerdict ?? 'ungraded'].badgeClass
                              }`}
                            >
                              {VERDICT_META[rec.soloVerdict ?? 'ungraded'].label}
                            </span>
                          )}
                          <span className="font-mono font-bold text-amber-300">
                            Dây: {rec.ropeAfter > 0 ? `+${rec.ropeAfter}` : rec.ropeAfter}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm sm:text-base font-bold text-white">{rec.questionStem}</p>
                      <p className="text-sm text-emerald-300 font-bold">
                        Đáp án: {rec.officialAnswerText}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Lời giải: {rec.explanation}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: ACTIVE MATCH VIEW
  // ============================================================================
  if (!matchState || !currentQuestion) {
    return null;
  }

  const isTwoTeams = matchState.config.mode === 'two_teams';
  const bothTeamsGraded = teamAVerdict !== 'ungraded' && teamBVerdict !== 'ungraded';
  const soloCanSubmit =
    currentQuestion.requiresTeacherGrading
      ? soloTeacherVerdict !== 'ungraded'
      : currentQuestion.type === 'single_choice'
        ? Boolean(soloSelectedOptionId)
        : currentQuestion.type === 'true_false_group'
          ? Boolean(
              currentQuestion.subItems?.every(
                (s) => typeof soloTrueFalseMap[s.id] === 'boolean'
              )
            )
          : soloShortInput.trim().length > 0;

  return (
    <div
      className={`w-full bg-[#091224] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
        isFullscreen ? 'h-full rounded-none border-0' : ''
      }`}
    >
      {/* Compact Classroom Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#0E1A32] border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-extrabold text-amber-300 shrink-0">D03</span>
          <span className="text-sm sm:text-base font-extrabold text-white truncate">
            {isTwoTeams ? 'Kéo co hai đội' : 'Tự luyện Kéo co'}
          </span>
          <span className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 font-mono text-xs font-extrabold text-sky-200 shrink-0">
            Câu {matchState.currentQuestionIndex + 1}/{matchState.questionOrder.length}
          </span>
          <span className="hidden md:inline-block rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
            {currentQuestion.sourceBadge}
          </span>
        </div>

        {/* Scoreboard + Timer */}
        <div className="flex flex-wrap items-center gap-2">
          {isTwoTeams ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold">
              <span className="text-blue-300 font-mono">
                {matchState.config.teamAName.slice(0, 12)}: {matchState.teamACorrect}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-orange-300 font-mono">
                {matchState.config.teamBName.slice(0, 12)}: {matchState.teamBCorrect}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-bold">
              <span className="text-emerald-300">Đúng: {matchState.soloCorrect}</span>
              <span className="text-slate-600">|</span>
              <span className="text-amber-300">
                Còn {Math.max(0, matchState.config.winTarget - matchState.ropePosition)} vạch
              </span>
            </div>
          )}

          {/* Countdown Timer & Pause */}
          {matchState.config.timerSeconds > 0 && turnPhase === 'answering' && (
            <div className="flex items-center gap-1.5">
              <div
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs sm:text-sm font-extrabold ${
                  remainingSeconds <= 5
                    ? 'border-rose-500 bg-rose-950/70 text-rose-200'
                    : 'border-amber-400/50 bg-slate-950 text-amber-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{remainingSeconds}s</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                title={isPaused ? 'Tiếp tục đồng hồ (Space)' : 'Tạm dừng đồng hồ (Space)'}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                  isPaused
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>
            </div>
          )}

          {/* Utility controls */}
          <button
            type="button"
            onClick={() => setForce2D((f) => !f)}
            title={force2D ? 'Chuyển sang sân 3D' : 'Chuyển sang sân 2D gọn nhẹ'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {force2D ? <Box className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            <span>{force2D ? '3D' : '2D'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleVoice}
            title={
              hasVietnameseVoice
                ? voiceEnabled
                  ? 'Tắt giọng đọc tiếng Việt'
                  : 'Bật giọng đọc tiếng Việt'
                : 'Trình duyệt chưa có giọng tiếng Việt'
            }
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'border-sky-500/50 bg-sky-950/60 text-sky-200'
                : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold cursor-pointer ${
              isMuted
                ? 'border-rose-500/60 bg-rose-950/70 text-rose-200'
                : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => setShowEndEarlyConfirm(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/50 px-2.5 py-1 text-xs font-bold text-amber-200 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kết thúc sớm</span>
          </button>
        </div>
      </div>

      {/* Main Match Content Area */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {webglAutoFallbackNotice && (
          <div className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-2 text-xs text-sky-200 flex items-center justify-between">
            <span>Thiết bị đang dùng sân Kéo co 2D gọn nhẹ thay cho WebGL 3D.</span>
            <button
              type="button"
              onClick={() => setWebglAutoFallbackNotice(false)}
              className="font-bold text-sky-300 cursor-pointer"
            >
              Ẩn
            </button>
          </div>
        )}

        {/* Paused Lock Overlay Notice */}
        {isPaused && (
          <div className="rounded-xl border border-amber-400/60 bg-amber-950/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
              <Pause className="w-4 h-4 text-amber-300" />
              Trận đấu đang tạm dừng — đồng hồ giữ nguyên tại {remainingSeconds}s và khóa thao tác chấm.
            </div>
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
            >
              Tiếp tục ngay
            </button>
          </div>
        )}

        {/* 3D / 2D Arena Stage (Compact while answering, Hero height on post-confirm pull reveal) */}
        <div className="relative">
          <TugOfWar3DScene
            mode={matchState.config.mode}
            teamAName={matchState.config.teamAName}
            teamBName={matchState.config.teamBName}
            soloName={matchState.config.soloName}
            ropePosition={matchState.ropePosition}
            winTarget={matchState.config.winTarget}
            lastDelta={lastDelta}
            pullEventId={pullEventId}
            skipToken={skipToken}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={turnPhase !== 'post_confirm'}
            matchStatus={matchState.status}
            winner={matchState.winner}
            onPullSettled={handleStopPullAudioOnSettle}
            onWebGLFallback={() => setWebglAutoFallbackNotice(true)}
          />

          {/* Skip Animation button (stops pull animation & pull audio immediately) */}
          {isPullAnimating && (
            <button
              type="button"
              onClick={handleSkipAnimation}
              className="absolute right-3 bottom-10 z-10 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-slate-950/92 hover:bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-amber-200 shadow-lg cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              Bỏ qua hoạt ảnh
            </button>
          )}
        </div>

        {/* High-Contrast Classroom Question Card */}
        <div className="rounded-2xl border border-slate-700/90 bg-[#0F1E3A] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-mono font-extrabold text-sky-300">{currentQuestion.code}</span>
              <span>·</span>
              <span>
                {currentQuestion.type === 'single_choice'
                  ? 'Trắc nghiệm 1 đáp án'
                  : currentQuestion.type === 'true_false_group'
                    ? 'Đúng / Sai nhiều ý'
                    : currentQuestion.type === 'short_answer'
                      ? 'Trả lời ngắn'
                      : 'Tự luận (Giáo viên chấm)'}
              </span>
            </div>
            {currentQuestion.isSample && (
              <span className="font-bold text-emerald-300">{D03_SAMPLE_BADGE}</span>
            )}
          </div>

          {/* Large Readable Stem */}
          <h3 className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-white leading-snug">
            {currentQuestion.stem}
          </h3>

          {/* Optional Image with graceful fallback */}
          {currentQuestion.image && !brokenImageMap[currentQuestion.id] && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 inline-block max-w-full">
              <img
                src={currentQuestion.image}
                alt={`Minh họa câu hỏi ${currentQuestion.code}`}
                onError={() =>
                  setBrokenImageMap((prev) => ({ ...prev, [currentQuestion.id]: true }))
                }
                className="max-h-56 rounded-lg object-contain mx-auto"
              />
            </div>
          )}
          {currentQuestion.image && brokenImageMap[currentQuestion.id] && (
            <p className="text-xs text-amber-300">
              Không tải được hình minh họa của câu hỏi này; học sinh vẫn có thể giải theo nội dung đề bài.
            </p>
          )}

          {/* Options Display (Interactive in Solo Mode, Crisp Projection Cards in Two-Team Mode) */}
          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQuestion.options.map((opt) => {
                const isOfficialCorrect =
                  answerRevealed && opt.id === currentQuestion.correctOptionId;
                const isSoloSelected = !isTwoTeams && soloSelectedOptionId === opt.id;

                if (!isTwoTeams && turnPhase === 'answering' && !currentQuestion.requiresTeacherGrading) {
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={isPaused}
                      onClick={() => setSoloSelectedOptionId(opt.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                        isSoloSelected
                          ? 'border-sky-400 bg-sky-900/60 text-white'
                          : 'border-slate-700 bg-slate-900/80 text-slate-100 hover:border-slate-500'
                      }`}
                    >
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black ${
                          isSoloSelected
                            ? 'bg-sky-400 text-slate-950'
                            : 'bg-slate-800 text-sky-300'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-base sm:text-lg font-bold">{opt.text}</span>
                    </button>
                  );
                }

                return (
                  <div
                    key={opt.id}
                    className={`flex items-center gap-3 rounded-xl border-2 p-3.5 ${
                      isOfficialCorrect
                        ? 'border-emerald-400 bg-emerald-950/60 text-emerald-50'
                        : isSoloSelected
                          ? 'border-sky-400 bg-sky-950/50 text-white'
                          : 'border-slate-700/90 bg-slate-900/75 text-slate-100'
                    }`}
                  >
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-black ${
                        isOfficialCorrect
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-sky-300'
                      }`}
                    >
                      {opt.label}
                    </span>
                    <span className="text-base sm:text-lg font-bold">{opt.text}</span>
                    {isOfficialCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* True / False Group Display */}
          {currentQuestion.type === 'true_false_group' && currentQuestion.subItems && (
            <div className="space-y-2.5">
              {currentQuestion.subItems.map((sub) => (
                <div
                  key={sub.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3"
                >
                  <p className="text-sm sm:text-base font-semibold text-white">
                    <span className="font-mono font-extrabold text-sky-300 mr-2">{sub.label})</span>
                    {sub.text}
                  </p>
                  {!isTwoTeams && turnPhase === 'answering' ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={() =>
                          setSoloTrueFalseMap((prev) => ({ ...prev, [sub.id]: true }))
                        }
                        className={`rounded-lg border px-3 py-1 text-xs font-extrabold cursor-pointer ${
                          soloTrueFalseMap[sub.id] === true
                            ? 'border-emerald-400 bg-emerald-600 text-white'
                            : 'border-slate-600 bg-slate-800 text-slate-200'
                        }`}
                      >
                        Đúng
                      </button>
                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={() =>
                          setSoloTrueFalseMap((prev) => ({ ...prev, [sub.id]: false }))
                        }
                        className={`rounded-lg border px-3 py-1 text-xs font-extrabold cursor-pointer ${
                          soloTrueFalseMap[sub.id] === false
                            ? 'border-rose-400 bg-rose-600 text-white'
                            : 'border-slate-600 bg-slate-800 text-slate-200'
                        }`}
                      >
                        Sai
                      </button>
                    </div>
                  ) : (
                    answerRevealed && (
                      <span
                        className={`rounded px-2.5 py-0.5 text-xs font-extrabold ${
                          sub.isCorrect
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {sub.isCorrect ? 'Đúng' : 'Sai'}
                      </span>
                    )
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Short Answer / Essay Input for Solo Mode */}
          {!isTwoTeams &&
            (currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay') &&
            turnPhase === 'answering' && (
              <div className="space-y-2">
                <label
                  htmlFor="d03-solo-short"
                  className="block text-xs font-bold text-slate-300"
                >
                  {currentQuestion.requiresTeacherGrading
                    ? 'Ghi chú câu trả lời (Câu tự luận / mở — Giáo viên chấm trực tiếp)'
                    : 'Nhập đáp án của bạn:'}
                </label>
                <input
                  id="d03-solo-short"
                  type="text"
                  disabled={isPaused}
                  value={soloShortInput}
                  onChange={(e) => setSoloShortInput(e.target.value)}
                  placeholder="Nhập câu trả lời..."
                  className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base font-bold text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none"
                />
              </div>
            )}

          {/* Official Answer & Concise Explanation (Revealed AFTER lock-in / judging) */}
          {answerRevealed && (
            <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/45 p-4 space-y-1.5">
              <p className="text-sm sm:text-base font-extrabold text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                Đáp án chính thức: {currentQuestion.officialAnswerText}
              </p>
              <p className="text-xs sm:text-sm text-emerald-100/95 leading-relaxed">
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* TWO-TEAM CONTROL FLOW (ANSWERING -> JUDGING -> POST_CONFIRM)         */}
        {/* ==================================================================== */}
        {isTwoTeams && (
          <div className="space-y-4">
            {/* Step 1: Answering phase */}
            {turnPhase === 'answering' && (
              <div className="rounded-2xl border border-slate-700 bg-[#0E1A32] p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-extrabold text-white">
                    Bước 1: Hai đội thảo luận và viết đáp án ra bảng con / giấy
                  </p>
                  <p className="text-xs text-slate-300">
                    Khi hết giờ hoặc hai đội đã giơ bảng, nhấn <strong>“Dừng trả lời”</strong> để ghi nhận kết quả đồng thời.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isPaused}
                  onClick={handleStopAnsweringPhase}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Dừng trả lời & Chấm điểm
                </button>
              </div>
            )}

            {/* Step 2: Simultaneous Two-Team Judging */}
            {turnPhase === 'judging' && (
              <div className="space-y-4">
                {timerExpiredNotice && (
                  <div className="rounded-xl border border-amber-400/50 bg-amber-950/45 px-4 py-2.5 text-xs sm:text-sm font-bold text-amber-200">
                    Đã hết thời gian suy nghĩ. Hệ thống KHÔNG tự đánh sai — giáo viên ghi nhận kết quả bảng con của cả hai đội bên dưới.
                  </div>
                )}

                {/* Equal-width Team A (left) and Team B (right) judging panels */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* TEAM A PANEL */}
                  <div className="rounded-2xl border-2 border-blue-500/60 bg-[#0E1E3E] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-3.5 w-3.5 rounded-sm bg-blue-500 shrink-0" />
                        <h4 className="text-sm sm:text-base font-extrabold text-blue-100 truncate">
                          {matchState.config.teamAName}
                        </h4>
                      </div>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-extrabold shrink-0 ${
                          VERDICT_META[teamAVerdict].badgeClass
                        }`}
                      >
                        {VERDICT_META[teamAVerdict].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(['correct', 'incorrect', 'no_answer'] as TeamVerdict[]).map((v) => {
                        const active = teamAVerdict === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={isPaused}
                            onClick={() => setTeamAVerdict(v)}
                            className={`rounded-xl border-2 py-2.5 px-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                              active
                                ? v === 'correct'
                                  ? 'border-emerald-300 bg-emerald-600 text-white'
                                  : v === 'incorrect'
                                    ? 'border-rose-300 bg-rose-600 text-white'
                                    : 'border-amber-300 bg-amber-600 text-white'
                                : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {VERDICT_META[v].label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={teamAAnswerNote}
                      onChange={(e) => setTeamAAnswerNote(e.target.value)}
                      placeholder="Ghi đáp án đội chọn (tùy chọn)..."
                      className="w-full rounded-lg border border-blue-500/30 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-400 focus:outline-none"
                    />
                  </div>

                  {/* TEAM B PANEL */}
                  <div className="rounded-2xl border-2 border-orange-500/60 bg-[#251A1C] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-block h-3.5 w-3.5 rounded-sm bg-orange-500 shrink-0" />
                        <h4 className="text-sm sm:text-base font-extrabold text-orange-100 truncate">
                          {matchState.config.teamBName}
                        </h4>
                      </div>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-extrabold shrink-0 ${
                          VERDICT_META[teamBVerdict].badgeClass
                        }`}
                      >
                        {VERDICT_META[teamBVerdict].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(['correct', 'incorrect', 'no_answer'] as TeamVerdict[]).map((v) => {
                        const active = teamBVerdict === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={isPaused}
                            onClick={() => setTeamBVerdict(v)}
                            className={`rounded-xl border-2 py-2.5 px-2 text-xs sm:text-sm font-extrabold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 ${
                              active
                                ? v === 'correct'
                                  ? 'border-emerald-300 bg-emerald-600 text-white'
                                  : v === 'incorrect'
                                    ? 'border-rose-300 bg-rose-600 text-white'
                                    : 'border-amber-300 bg-amber-600 text-white'
                                : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {VERDICT_META[v].label}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={teamBAnswerNote}
                      onChange={(e) => setTeamBAnswerNote(e.target.value)}
                      placeholder="Ghi đáp án đội chọn (tùy chọn)..."
                      className="w-full rounded-lg border border-orange-500/30 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Live Rope Shift Preview + Reveal Answer + Atomic Confirm */}
                <div className="rounded-2xl border border-slate-700 bg-[#0E1A32] p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    {liveTurnPreview ? (
                      <>
                        <p className="text-sm sm:text-base font-black text-amber-300">
                          Dự kiến sau xác nhận: {liveTurnPreview.label}
                        </p>
                        <p className="text-xs text-slate-300">{liveTurnPreview.detail}</p>
                      </>
                    ) : (
                      <p className="text-xs sm:text-sm text-slate-300 flex items-center gap-1.5">
                        <HelpCircle className="w-4 h-4 text-sky-400 shrink-0" />
                        Chọn kết quả cho cả hai đội để xem trước hướng dịch chuyển dây và xác nhận đồng thời.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      Nguồn kết quả: Giáo viên nhập trực tiếp trên một máy (thứ tự bấm không ảnh hưởng kết quả).
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {!answerRevealed && (
                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={() => setAnswerRevealed(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/60 bg-emerald-950/60 hover:bg-emerald-900/70 px-4 py-2.5 text-sm font-bold text-emerald-100 cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        Công bố đáp án & lời giải
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={
                        isPaused ||
                        !bothTeamsGraded ||
                        commitGuardBusy ||
                        isCurrentQuestionCommitted
                      }
                      onClick={handleCommitTwoTeams}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 px-5 py-2.5 text-sm sm:text-base font-extrabold text-slate-950 shadow-lg cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Xác nhận kết quả
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Post-Confirm (Pull Reveal + Edit Last Result + Next Question) */}
            {turnPhase === 'post_confirm' && lastCommittedRecord && (
              <div className="rounded-2xl border border-slate-700 bg-[#0E1A32] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base sm:text-lg font-black text-amber-300">
                      {lastCommittedRecord.ropeDelta < 0
                        ? `Dây dịch 1 vạch về ${matchState.config.teamAName}!`
                        : lastCommittedRecord.ropeDelta > 0
                          ? `Dây dịch 1 vạch về ${matchState.config.teamBName}!`
                          : 'Dây giữ nguyên vị trí!'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      Vị trí hiện tại:{' '}
                      <strong className="font-mono text-white">
                        {matchState.ropePosition > 0
                          ? `+${matchState.ropePosition}`
                          : matchState.ropePosition}
                      </strong>{' '}
                      · {matchState.config.teamAName}: {matchState.teamACorrect} đúng ·{' '}
                      {matchState.config.teamBName}: {matchState.teamBCorrect} đúng
                      {matchState.status !== 'playing' && (
                        <span className="ml-2 font-extrabold text-emerald-300">
                          — {matchState.endReasonLabel}!
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {!isEditingLastTurn && (
                      <button
                        type="button"
                        onClick={handleStartEditLastTurn}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-200 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                        Sửa kết quả câu vừa chấm
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isEditingLastTurn}
                      onClick={handleNextOrSummary}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 disabled:text-slate-400 px-5 py-2.5 text-sm sm:text-base font-extrabold text-slate-950 shadow cursor-pointer"
                    >
                      {matchState.status === 'playing' ? (
                        <>
                          Câu tiếp theo
                          <ChevronRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Xem tổng kết trận đấu
                          <Award className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Inline Edit Panel for Just-Confirmed Question */}
                {isEditingLastTurn && (
                  <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 p-4 space-y-3">
                    <p className="text-xs sm:text-sm font-extrabold text-amber-300">
                      Chỉnh sửa kết quả câu vừa chấm (Hệ thống sẽ tính lại toàn bộ vị trí dây & trạng thái thắng/thua từ lịch sử):
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-blue-200">
                          {matchState.config.teamAName}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['correct', 'incorrect', 'no_answer'] as TeamVerdict[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setEditTeamAVerdict(v)}
                              className={`rounded-lg border py-1.5 text-xs font-extrabold cursor-pointer ${
                                editTeamAVerdict === v
                                  ? 'border-blue-300 bg-blue-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300'
                              }`}
                            >
                              {VERDICT_META[v].short}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-orange-200">
                          {matchState.config.teamBName}
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['correct', 'incorrect', 'no_answer'] as TeamVerdict[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => setEditTeamBVerdict(v)}
                              className={`rounded-lg border py-1.5 text-xs font-extrabold cursor-pointer ${
                                editTeamBVerdict === v
                                  ? 'border-orange-300 bg-orange-600 text-white'
                                  : 'border-slate-700 bg-slate-900 text-slate-300'
                              }`}
                            >
                              {VERDICT_META[v].short}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditingLastTurn(false)}
                        className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300 cursor-pointer"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditLastTurn}
                        className="rounded-lg bg-amber-400 hover:bg-amber-300 px-4 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                      >
                        Lưu & tính lại vị trí dây
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* SOLO PRACTICE CONTROL FLOW                                           */}
        {/* ==================================================================== */}
        {!isTwoTeams && (
          <div className="rounded-2xl border border-slate-700 bg-[#0E1A32] p-4 sm:p-5 space-y-3">
            {turnPhase === 'answering' ? (
              currentQuestion.requiresTeacherGrading ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold text-white">
                        Câu hỏi mở / tự luận — Giáo viên đối chiếu & ghi nhận kết quả
                      </p>
                      <p className="text-xs text-slate-400">
                        Nguồn kết quả: Giáo viên nhập trực tiếp trên một máy
                      </p>
                    </div>
                    {!answerRevealed && (
                      <button
                        type="button"
                        onClick={() => setAnswerRevealed(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-200 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Xem đáp án gợi ý
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => {
                        setSoloTeacherVerdict('correct');
                        handleCommitSoloTurn('correct');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-extrabold text-white cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Chốt: Đúng (+1 vạch)
                    </button>
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => {
                        setSoloTeacherVerdict('incorrect');
                        handleCommitSoloTurn('incorrect');
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2.5 text-sm font-extrabold text-white cursor-pointer"
                    >
                      <XCircle className="w-4 h-4" />
                      Chốt: Chưa đúng (Giữ nguyên)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs sm:text-sm text-slate-300">
                    Chọn phương án hoặc nhập đáp án, sau đó nhấn <strong>“Chốt đáp án”</strong> để kéo dây về vạch đích.
                  </p>
                  <button
                    type="button"
                    disabled={isPaused || !soloCanSubmit || commitGuardBusy}
                    onClick={() => handleCommitSoloTurn()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 px-5 py-2.5 text-sm sm:text-base font-extrabold text-slate-950 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Chốt đáp án
                  </button>
                </div>
              )
            ) : (
              lastCommittedRecord && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-amber-300">
                        {lastCommittedRecord.soloVerdict === 'correct'
                          ? 'Chính xác! Dây kéo tiến thêm 1 vạch!'
                          : 'Chưa chính xác — vị trí dây giữ nguyên.'}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                        Đã đúng <strong>{matchState.soloCorrect}</strong> câu · Còn{' '}
                        <strong>
                          {Math.max(0, matchState.config.winTarget - matchState.ropePosition)}
                        </strong>{' '}
                        vạch để chạm đích
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!isEditingLastTurn && (
                        <button
                          type="button"
                          onClick={handleStartEditLastTurn}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Sửa kết quả câu vừa chấm
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isEditingLastTurn}
                        onClick={handleNextOrSummary}
                        className="inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-5 py-2.5 text-sm font-extrabold text-slate-950 cursor-pointer"
                      >
                        {matchState.status === 'playing' ? (
                          <>
                            Câu tiếp theo
                            <ChevronRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            Xem tổng kết
                            <Award className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {isEditingLastTurn && (
                    <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 p-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {(['correct', 'incorrect'] as TeamVerdict[]).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setEditSoloVerdict(v)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-extrabold cursor-pointer ${
                              editSoloVerdict === v
                                ? 'border-amber-300 bg-amber-500 text-slate-950'
                                : 'border-slate-700 bg-slate-900 text-slate-300'
                            }`}
                          >
                            {VERDICT_META[v].label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingLastTurn(false)}
                          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-300 cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditLastTurn}
                          className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                        >
                          Lưu & tính lại
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* In-App Confirm Modal for Ending Match Early (Never window.confirm) */}
      {showEndEarlyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="d03-end-early-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0E1A32] p-5 shadow-2xl space-y-4">
            <h3 id="d03-end-early-title" className="text-lg font-extrabold text-white">
              Kết thúc sớm trận đấu?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Trận đấu sẽ chuyển sang màn hình tổng kết với trạng thái{' '}
              <strong className="text-amber-300">“Kết thúc sớm”</strong>, giữ nguyên vị trí dây (
              {matchState.ropePosition > 0 ? `+${matchState.ropePosition}` : matchState.ropePosition}
              ) và {matchState.history.length} câu đã chấm.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowEndEarlyConfirm(false)}
                className="rounded-xl border border-slate-600 bg-slate-900 hover:bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 cursor-pointer"
              >
                Tiếp tục thi đấu
              </button>
              <button
                type="button"
                onClick={handleConfirmEndEarly}
                className="rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 text-sm font-extrabold text-slate-950 cursor-pointer"
              >
                Xác nhận kết thúc sớm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TugOfWar3DGame;
