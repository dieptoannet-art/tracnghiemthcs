import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Award,
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
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
  Volume2,
  VolumeX,
  X,
  XCircle,
  ZoomIn,
} from 'lucide-react';
import { ClassRoom, Question, UserRole } from '../../../types';
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
  D05_SAMPLE_BADGE,
  D05_SAMPLE_PACK_TITLE,
  POINTS_PER_CORRECT,
  RELAY_TEAM_PALETTES,
  RelayMatchConfig,
  RelayMatchState,
  RelayMode,
  RelayQuestionItem,
  RelayTeamConfig,
  RelayVerdict,
  advanceRelayToNextQuestion,
  buildD05QuestionPool,
  clearD05Session,
  commitRelayTurnResult,
  computeRelayStandings,
  createDefaultRelayConfig,
  createInitialRelayMatchState,
  distributeRosterIntoTeams,
  editLastConfirmedRelayTurn,
  endRelayMatchEarly,
  evaluateRelaySoloAnswer,
  generateTempMembers,
  getActiveMember,
  getNextMember,
  loadD05Session,
  prepareRelayQuestions,
  saveD05Session,
  skipAbsentRunnerBeforeTurn,
  validateRelaySetupConfig,
} from './relayTeam3dEngine';
import RelayTeam3DScene, { RelayLaneVisualData } from './RelayTeam3DScene';

export interface RelayCandidateStudent {
  id: string;
  name: string;
  className?: string;
}

export interface RelayTeam3DGameProps {
  allCandidates?: RelayCandidateStudent[];
  classes?: ClassRoom[];
  questions: Question[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
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
type TurnPhase = 'prep' | 'answering' | 'judging' | 'handoff';

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
  RelayVerdict,
  { label: string; short: string; badgeClass: string }
> = {
  ungraded: {
    label: 'Chưa chấm',
    short: 'Chưa chấm',
    badgeClass: 'bg-slate-700 text-slate-200 border-slate-500',
  },
  correct: {
    label: `Đúng (+${POINTS_PER_CORRECT}đ)`,
    short: 'Đúng',
    badgeClass: 'bg-emerald-600 text-white border-emerald-400',
  },
  incorrect: {
    label: 'Chưa đúng (0đ)',
    short: 'Chưa đúng',
    badgeClass: 'bg-rose-600 text-white border-rose-400',
  },
  no_answer: {
    label: 'Không trả lời (0đ)',
    short: 'Không TL',
    badgeClass: 'bg-amber-700 text-amber-100 border-amber-400',
  },
};

export const RelayTeam3DGame: React.FC<RelayTeam3DGameProps> = ({
  allCandidates = [],
  classes = [],
  questions,
  selectedSourceKey,
  onSelectSourceKey,
  resolvedClassName,
  userRole,
  isFullscreen,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onCloseGame,
}) => {
  // Audio & Vietnamese Voice controllers (reuses A01/A02 shared engine)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const turnTokenCounterRef = useRef<number>(1);
  const activeTurnTokenRef = useRef<string>('d05_init');

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

  useEffect(() => {
    isMutedRef.current = isMuted;
    saveEduGameMuted(isMuted);
    if (isMuted) {
      soundBankRef.current?.stopAll();
      voiceRef.current?.stop();
      stopAllGlobalEduSpeech();
    }
  }, [isMuted]);

  useEffect(() => {
    const unsub = voiceRef.current?.subscribe((snap) => {
      setHasVietnameseVoice(snap.hasVietnameseVoice);
    });
    return () => {
      unsub?.();
      soundBankRef.current?.dispose();
      voiceRef.current?.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const nextAudioToken = useCallback(() => {
    turnTokenCounterRef.current += 1;
    const tok = `d05_t_${turnTokenCounterRef.current}`;
    activeTurnTokenRef.current = tok;
    soundBankRef.current?.setActiveTurnToken(tok);
    return tok;
  }, []);

  const candidateNames = useMemo(
    () => allCandidates.map((c) => c.name.trim()).filter(Boolean),
    [allCandidates]
  );

  // Setup & Match state
  const [screen, setScreen] = useState<ScreenView>('setup');
  const [setupConfig, setSetupConfig] = useState<RelayMatchConfig>(() =>
    createDefaultRelayConfig('team_relay', candidateNames)
  );
  const [tempTotalStudents, setTempTotalStudents] = useState<number>(
    Math.min(50, Math.max(4, candidateNames.length || 8))
  );
  const [newMemberDraftByTeam, setNewMemberDraftByTeam] = useState<Record<string, string>>({});
  const [savedSession, setSavedSession] = useState<RelayMatchState | null>(null);
  const [storageRecoveryNotice, setStorageRecoveryNotice] = useState<boolean>(false);

  // Active match state
  const [matchState, setMatchState] = useState<RelayMatchState | null>(null);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('prep');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [timerExpiredNotice, setTimerExpiredNotice] = useState<boolean>(false);
  const [lockedRunnerIndexByTeam, setLockedRunnerIndexByTeam] = useState<Record<string, number>>({});
  const [absentNotice, setAbsentNotice] = useState<string | null>(null);

  // Per-turn judging inputs (teams)
  const [verdictsByTeam, setVerdictsByTeam] = useState<Record<string, RelayVerdict>>({});
  const [answerNotesByTeam, setAnswerNotesByTeam] = useState<Record<string, string>>({});
  const [answerRevealed, setAnswerRevealed] = useState<boolean>(false);

  // Solo practice inputs
  const [soloSelectedOptionId, setSoloSelectedOptionId] = useState<string | null>(null);
  const [soloTrueFalseMap, setSoloTrueFalseMap] = useState<Record<string, boolean>>({});
  const [soloShortInput, setSoloShortInput] = useState<string>('');
  const [soloTeacherVerdict, setSoloTeacherVerdict] = useState<RelayVerdict>('ungraded');

  // Edit-last-confirmed-turn state
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);
  const [editVerdictsByTeam, setEditVerdictsByTeam] = useState<Record<string, RelayVerdict>>({});

  // Animation & UI modals
  const [handoffEventId, setHandoffEventId] = useState<number>(0);
  const [batonHandedOff, setBatonHandedOff] = useState<boolean>(false);
  const [skipToken, setSkipToken] = useState<number>(0);
  const [isHandoffAnimating, setIsHandoffAnimating] = useState<boolean>(false);
  const [brokenImageMap, setBrokenImageMap] = useState<Record<string, boolean>>({});
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState<boolean>(false);
  const [showFormulaZoomModal, setShowFormulaZoomModal] = useState<boolean>(false);
  const [showSummarySolutions, setShowSummarySolutions] = useState<boolean>(true);
  const [commitGuardBusy, setCommitGuardBusy] = useState<boolean>(false);

  const summarySolutionsRef = useRef<HTMLDivElement | null>(null);

  // Load saved session safely on mount
  useEffect(() => {
    const loaded = loadD05Session();
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
      buildD05QuestionPool({
        sourceKind: 'bank',
        bankQuestions: questions,
        userRole,
      }),
    [questions, userRole]
  );

  const availablePool = useMemo(
    () =>
      buildD05QuestionPool({
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
    () => validateRelaySetupConfig(setupConfig, availablePool.length),
    [setupConfig, availablePool.length]
  );

  const currentQuestion: RelayQuestionItem | null = useMemo(() => {
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

  // Build visual lane data for 3D / 2D scene
  const buildVisualLanes = useCallback(
    (state: RelayMatchState): RelayLaneVisualData[] => {
      return state.config.teams.map((team) => {
        const rt = state.teamRuntime[team.id];
        const active = getActiveMember(rt);
        const next = getNextMember(rt);
        return {
          teamId: rt.teamId,
          teamName: rt.name,
          paletteIndex: rt.paletteIndex,
          currentRunnerName: active.name,
          nextRunnerName: next.name,
          score: rt.score,
          turnsCompleted: rt.turnsCompleted,
          totalQuestions: state.questionOrder.length,
        };
      });
    },
    []
  );

  const setupPreviewLanes: RelayLaneVisualData[] = useMemo(
    () =>
      setupConfig.teams.map((team) => ({
        teamId: team.id,
        teamName: team.name || 'Đội',
        paletteIndex: team.paletteIndex,
        currentRunnerName: team.members[0]?.name || 'Bạn 1',
        nextRunnerName: team.members[1]?.name || team.members[0]?.name || 'Bạn 1',
        score: 0,
        turnsCompleted: 0,
        totalQuestions: setupConfig.questionCount,
      })),
    [setupConfig]
  );

  const resetPerTurnUI = useCallback((state: RelayMatchState) => {
    const isSolo = state.config.mode === 'solo_practice';
    setTurnPhase(isSolo ? 'answering' : 'prep');
    setRemainingSeconds(state.config.timerSeconds);
    setIsPaused(false);
    setTimerExpiredNotice(false);
    setAbsentNotice(null);
    setAnswerRevealed(false);
    setBatonHandedOff(false);
    setIsHandoffAnimating(false);
    setIsEditingLastTurn(false);
    setCommitGuardBusy(false);

    const initVerdicts: Record<string, RelayVerdict> = {};
    const initNotes: Record<string, string> = {};
    const initLocked: Record<string, number> = {};
    state.config.teams.forEach((t) => {
      initVerdicts[t.id] = 'ungraded';
      initNotes[t.id] = '';
      initLocked[t.id] = state.teamRuntime[t.id]?.currentMemberIndex ?? 0;
    });
    setVerdictsByTeam(initVerdicts);
    setAnswerNotesByTeam(initNotes);
    setLockedRunnerIndexByTeam(initLocked);

    setSoloSelectedOptionId(null);
    setSoloTrueFalseMap({});
    setSoloShortInput('');
    setSoloTeacherVerdict('ungraded');
  }, []);

  // Single monotonic countdown timer (pausing preserves exact seconds & locks grading)
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
      setTimerExpiredNotice(true);
      soundBankRef.current?.playTimerBell(isMutedRef.current);
      if (matchState.config.mode !== 'solo_practice') {
        setTurnPhase('judging');
      }
      return;
    }

    const id = window.setTimeout(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [screen, matchState, turnPhase, isPaused, remainingSeconds]);

  // Persist active session cleanly
  useEffect(() => {
    if (!matchState) return;
    if (matchState.status === 'playing') {
      saveD05Session(matchState);
    } else {
      clearD05Session();
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

  const handleBatonContactSound = useCallback(() => {
    soundBankRef.current?.playRelayBatonPass(isMutedRef.current, activeTurnTokenRef.current);
  }, []);

  const handleHandoffSettled = useCallback(() => {
    setIsHandoffAnimating(false);
    soundBankRef.current?.stopRelayStepLoop();
  }, []);

  const handleSkipAnimation = useCallback(() => {
    setSkipToken((prev) => prev + 1);
    setIsHandoffAnimating(false);
    soundBankRef.current?.stopRelayStepLoop();
  }, []);

  const announceTurnHoldersVoice = useCallback(
    (state: RelayMatchState, turnId: string) => {
      if (isMutedRef.current || !voiceEnabled) return;
      if (state.config.mode === 'solo_practice') return;
      const parts = state.config.teams.map((t) => {
        const holder = getActiveMember(state.teamRuntime[t.id]);
        return `${t.name}: bạn ${holder.name}`;
      });
      const text = `Câu ${state.currentQuestionIndex + 1}. Người cầm gậy: ${parts.join(', ')}.`;
      voiceRef.current
        ?.announceStudentOnce({
          turnId,
          studentName: state.config.teams[0]?.name || 'Đội 1',
          customText: text,
          isMuted: isMutedRef.current,
          voiceEnabled,
          onBeforeSpeak: () => soundBankRef.current?.stopRelayStepLoop(),
        })
        .catch(() => {});
    },
    [voiceEnabled]
  );

  // ============================================================================
  // SETUP TEAM BUILDER HANDLERS
  // ============================================================================

  const handleModeChange = (nextMode: RelayMode) => {
    setSetupConfig((prev) => {
      const defaults = createDefaultRelayConfig(nextMode, candidateNames);
      return {
        ...prev,
        mode: nextMode,
        teams: defaults.teams,
      };
    });
  };

  const handleChangeTeamCount = (count: number) => {
    const safeCount = Math.max(2, Math.min(6, count));
    setSetupConfig((prev) => {
      const existingNames = prev.teams.map((t) => t.name);
      const allExistingMembers = prev.teams.flatMap((t) => t.members.map((m) => m.name));
      const sourceNames =
        allExistingMembers.length >= safeCount ? allExistingMembers : candidateNames;
      return {
        ...prev,
        teams: distributeRosterIntoTeams(sourceNames, safeCount, existingNames),
      };
    });
  };

  const handleApplyClassRoster = () => {
    const teamCount = setupConfig.mode === 'team_relay' ? setupConfig.teams.length : 1;
    const existingNames = setupConfig.teams.map((t) => t.name);
    setSetupConfig((prev) => ({
      ...prev,
      teams: distributeRosterIntoTeams(candidateNames, teamCount, existingNames),
    }));
  };

  const handleApplyTempLabels = (totalCount: number) => {
    const clamped = Math.max(1, Math.min(50, Math.floor(totalCount || 1)));
    const labels = Array.from({ length: clamped }, (_, i) => `Bạn ${i + 1}`);
    const teamCount = setupConfig.mode === 'team_relay' ? setupConfig.teams.length : 1;
    const existingNames = setupConfig.teams.map((t) => t.name);
    setSetupConfig((prev) => ({
      ...prev,
      teams: distributeRosterIntoTeams(labels, teamCount, existingNames),
    }));
  };

  const handleUpdateTeam = (teamId: string, updater: (t: RelayTeamConfig) => RelayTeamConfig) => {
    setSetupConfig((prev) => ({
      ...prev,
      teams: prev.teams.map((t) => (t.id === teamId ? updater(t) : t)),
    }));
  };

  const handleMoveMember = (teamId: string, idx: number, dir: -1 | 1) => {
    handleUpdateTeam(teamId, (team) => {
      const target = idx + dir;
      if (target < 0 || target >= team.members.length) return team;
      const next = [...team.members];
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...team, members: next };
    });
  };

  const handleAddMemberToTeam = (teamId: string) => {
    const draft = (newMemberDraftByTeam[teamId] || '').trim();
    handleUpdateTeam(teamId, (team) => {
      const fallbackName = `Bạn ${team.members.length + 1}`;
      return {
        ...team,
        members: [
          ...team.members,
          ...generateTempMembers(1, team.members.length + 1, draft || 'Bạn').map((m) => ({
            ...m,
            name: draft || fallbackName,
          })),
        ],
      };
    });
    setNewMemberDraftByTeam((prev) => ({ ...prev, [teamId]: '' }));
  };

  const handleRemoveMemberFromTeam = (teamId: string, memberId: string) => {
    handleUpdateTeam(teamId, (team) => {
      if (team.members.length <= 1) return team;
      return { ...team, members: team.members.filter((m) => m.id !== memberId) };
    });
  };

  // ============================================================================
  // MATCH LIFECYCLE HANDLERS
  // ============================================================================

  const handleStartMatch = (overrideConfig?: RelayMatchConfig) => {
    const cfg = overrideConfig ?? setupConfig;
    const pool = buildD05QuestionPool({
      sourceKind: cfg.sourceKind,
      bankQuestions: questions,
      userRole,
      subjectFilter: cfg.subjectFilter,
      gradeFilter: cfg.gradeFilter,
      levelFilter: cfg.levelFilter,
    });
    const validation = validateRelaySetupConfig(cfg, pool.length);
    if (!validation.valid) return;

    const effectiveConfig: RelayMatchConfig = {
      ...cfg,
      questionCount: validation.effectiveQuestionCount,
      rulesLocked: true,
    };
    const prepared = prepareRelayQuestions(pool, effectiveConfig);
    const initial = createInitialRelayMatchState(effectiveConfig, prepared);

    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    voiceRef.current?.resetTurnDedupe();
    const tok = nextAudioToken();
    soundBankRef.current?.playRelayWhistle(isMutedRef.current, tok);

    setMatchState(initial);
    setSavedSession(null);
    setShowEndEarlyConfirm(false);
    resetPerTurnUI(initial);
    setScreen('match');
  };

  const handleResumeSavedSession = () => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    setMatchState(savedSession);
    setSetupConfig(savedSession.config);
    setSavedSession(null);
    resetPerTurnUI(savedSession);
    setScreen(savedSession.status === 'playing' ? 'match' : 'summary');
  };

  // Skip absent student BEFORE opening question (never marks wrong!)
  const handleSkipAbsentInPrep = (teamId: string) => {
    if (!matchState || turnPhase !== 'prep') return;
    const res = skipAbsentRunnerBeforeTurn(matchState, teamId);
    if (res.skippedMember && res.replacementMember) {
      setMatchState(res.state);
      setAbsentNotice(
        `Đã bỏ qua bạn ${res.skippedMember.name} (vắng mặt, không tính sai). Người thay cầm gậy: ${res.replacementMember.name}.`
      );
    }
  };

  // Lock current baton holders and open the question + start timer
  const handleOpenQuestionFromPrep = () => {
    if (!matchState) return;
    soundBankRef.current?.unlock();
    const locked: Record<string, number> = {};
    matchState.config.teams.forEach((t) => {
      locked[t.id] = matchState.teamRuntime[t.id].currentMemberIndex;
    });
    setLockedRunnerIndexByTeam(locked);
    setRemainingSeconds(matchState.config.timerSeconds);
    setTimerExpiredNotice(false);
    setAbsentNotice(null);
    setTurnPhase('answering');

    const tok = nextAudioToken();
    soundBankRef.current?.playRelayWhistle(isMutedRef.current, tok);
    announceTurnHoldersVoice(matchState, `prep_q_${matchState.currentQuestionIndex}_${tok}`);
  };

  const handleStopAnsweringPhase = () => {
    if (isPaused) return;
    soundBankRef.current?.unlock();
    setTurnPhase('judging');
  };

  // Atomic commit for team_relay / class_relay (idempotent per question)
  const handleCommitTeamsTurn = () => {
    if (!matchState || !currentQuestion || isPaused || commitGuardBusy) return;
    const allGraded = matchState.config.teams.every(
      (t) => verdictsByTeam[t.id] && verdictsByTeam[t.id] !== 'ungraded'
    );
    if (!allGraded) return;
    setCommitGuardBusy(true);

    const res = commitRelayTurnResult(matchState, {
      question: currentQuestion,
      verdictsByTeam,
      answerNotesByTeam,
      lockedRunnerIndexByTeam,
      resultSource: 'teacher_single_device',
    });

    if (!res.committed || !res.record) {
      setCommitGuardBusy(false);
      return;
    }

    const tok = nextAudioToken();
    setAnswerRevealed(true);
    setMatchState(res.state);
    setTurnPhase('handoff');
    setBatonHandedOff(true);
    setHandoffEventId((n) => n + 1);

    if (!reducedMotion) {
      setIsHandoffAnimating(true);
      soundBankRef.current?.startRelayStepLoop(() => isMutedRef.current, tok);
    } else {
      setIsHandoffAnimating(false);
      soundBankRef.current?.playRelayBatonPass(isMutedRef.current, tok);
    }

    if (res.state.status === 'finished') {
      const delay = reducedMotion ? 220 : 1200;
      window.setTimeout(() => {
        if (activeTurnTokenRef.current !== tok) return;
        soundBankRef.current?.stopRelayStepLoop();
        soundBankRef.current?.playRelayFinishFanfare(isMutedRef.current, tok);
      }, delay);
    }
  };

  // Solo practice submit / teacher grade commit
  const handleCommitSoloTurn = (explicitVerdict?: RelayVerdict) => {
    if (!matchState || !currentQuestion || isPaused || commitGuardBusy) return;
    const soloTeamId = matchState.config.teams[0]?.id;
    if (!soloTeamId) return;
    setCommitGuardBusy(true);

    let verdict: RelayVerdict;
    let note: string;
    let source: 'teacher_single_device' | 'student_auto' = 'student_auto';

    if (currentQuestion.requiresTeacherGrading || explicitVerdict) {
      verdict = explicitVerdict ?? soloTeacherVerdict;
      if (verdict === 'ungraded') {
        setCommitGuardBusy(false);
        return;
      }
      note = soloShortInput.trim() || VERDICT_META[verdict].short;
      source = 'teacher_single_device';
    } else {
      const evalRes = evaluateRelaySoloAnswer(currentQuestion, {
        selectedOptionId: soloSelectedOptionId,
        trueFalseSelections: soloTrueFalseMap,
        shortAnswerText: soloShortInput,
      });
      verdict = evalRes.isCorrect ? 'correct' : 'incorrect';
      note = evalRes.answerNote;
    }

    const res = commitRelayTurnResult(matchState, {
      question: currentQuestion,
      verdictsByTeam: { [soloTeamId]: verdict },
      answerNotesByTeam: { [soloTeamId]: note },
      resultSource: source,
    });

    if (!res.committed) {
      setCommitGuardBusy(false);
      return;
    }

    const tok = nextAudioToken();
    setAnswerRevealed(true);
    setMatchState(res.state);
    setTurnPhase('handoff');
    setBatonHandedOff(true);
    setHandoffEventId((n) => n + 1);

    if (!reducedMotion) {
      setIsHandoffAnimating(true);
      soundBankRef.current?.startRelayStepLoop(() => isMutedRef.current, tok);
    } else {
      setIsHandoffAnimating(false);
      soundBankRef.current?.playRelayBatonPass(isMutedRef.current, tok);
    }

    if (res.state.status === 'finished') {
      const delay = reducedMotion ? 220 : 1200;
      window.setTimeout(() => {
        if (activeTurnTokenRef.current !== tok) return;
        soundBankRef.current?.stopRelayStepLoop();
        soundBankRef.current?.playRelayFinishFanfare(isMutedRef.current, tok);
      }, delay);
    }
  };

  // Edit just-confirmed turn (recomputes scores from history, keeps 1 baton pass!)
  const handleStartEditLastTurn = () => {
    if (!lastCommittedRecord || !matchState) return;
    soundBankRef.current?.stopRelayStepLoop();
    setIsHandoffAnimating(false);
    const map: Record<string, RelayVerdict> = {};
    matchState.config.teams.forEach((t) => {
      map[t.id] = lastCommittedRecord.teamOutcomes[t.id]?.verdict ?? 'incorrect';
    });
    setEditVerdictsByTeam(map);
    setIsEditingLastTurn(true);
  };

  const handleSaveEditLastTurn = () => {
    if (!matchState) return;
    const res = editLastConfirmedRelayTurn(matchState, editVerdictsByTeam);
    if (!res.edited) return;
    setMatchState(res.state);
    setIsEditingLastTurn(false);
  };

  const handleNextOrSummary = () => {
    if (!matchState) return;
    soundBankRef.current?.stopRelayStepLoop();
    setIsHandoffAnimating(false);

    if (matchState.status !== 'playing') {
      setScreen('summary');
      return;
    }

    const next = advanceRelayToNextQuestion(matchState);
    setMatchState(next);
    resetPerTurnUI(next);
  };

  const handleConfirmEndEarly = () => {
    if (!matchState) return;
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    const ended = endRelayMatchEarly(matchState);
    setMatchState(ended);
    setShowEndEarlyConfirm(false);
    setScreen('summary');
  };

  const handleExitLibrary = () => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
    onCloseGame();
  };

  // Keyboard shortcuts (Space pause/resume, Escape close modals)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        if (showFormulaZoomModal) setShowFormulaZoomModal(false);
        if (showEndEarlyConfirm) setShowEndEarlyConfirm(false);
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
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, turnPhase, matchState, showEndEarlyConfirm, showFormulaZoomModal]);

  const demoModeActive = isKhktDemoRuntime();

  // ============================================================================
  // RENDER: SETUP SCREEN
  // ============================================================================
  if (screen === 'setup') {
    const isTeamMode = setupConfig.mode === 'team_relay';
    const isSoloMode = setupConfig.mode === 'solo_practice';

    return (
      <div
        className={`w-full bg-[#091428] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
          isFullscreen ? 'h-full rounded-none border-0' : ''
        }`}
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-[#0E1D38] border-b border-slate-800">
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
                <span className="font-mono text-xs font-extrabold text-amber-300">D05</span>
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Tiếp sức đồng đội 3D
                </h2>
                {demoModeActive && (
                  <span className="text-xs font-bold text-amber-300">· Bản demo KHKT</span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Luân phiên cầm gậy 1–50 học sinh · Tách biệt Lượt đã hoàn thành & Điểm kiến thức
                {resolvedClassName ? ` · Lớp: ${resolvedClassName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer ${
                isMuted
                  ? 'border-rose-500/60 bg-rose-950/60 text-rose-200'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Đang tắt tiếng' : 'Âm thanh'}</span>
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          </div>
        </div>

        {/* Setup Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {storageRecoveryNotice && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-950/40 px-4 py-2.5 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Dữ liệu phiên lưu trước bị lỗi định dạng và đã được làm mới an toàn.</span>
              </div>
              <button
                type="button"
                onClick={() => setStorageRecoveryNotice(false)}
                className="font-bold text-amber-300 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {savedSession && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-500/50 bg-sky-950/45 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-sky-100">
                  Có phiên Tiếp sức đang tạm dở ({savedSession.history.length}/
                  {savedSession.questionOrder.length} lượt đã hoàn thành)
                </p>
                <p className="text-xs text-sky-300 mt-0.5">
                  {savedSession.config.teams.length} đội · Khôi phục nguyên thứ tự thành viên, người cầm gậy và điểm số.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResumeSavedSession}
                  className="rounded-lg bg-sky-500 hover:bg-sky-400 px-3.5 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                >
                  Tiếp tục phiên đang dở
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearD05Session();
                    setSavedSession(null);
                  }}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Bỏ phiên cũ
                </button>
              </div>
            </div>
          )}

          {/* 3D Track Live Preview */}
          <RelayTeam3DScene
            mode={setupConfig.mode}
            lanes={setupPreviewLanes}
            turnsCompleted={0}
            totalQuestions={setupConfig.questionCount}
            handoffEventId={0}
            batonHandedOff={false}
            skipToken={0}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={true}
            onWebGLFallback={() => setWebglAutoFallbackNotice(true)}
          />

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Left Column: Mode & Team Roster Builder */}
            <div className="xl:col-span-7 space-y-4 rounded-xl border border-slate-800 bg-[#0E1D38] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-2.5 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  1. Chọn chế độ tiếp sức
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(
                    [
                      {
                        key: 'team_relay',
                        title: 'Tiếp sức theo đội',
                        sub: '2–6 đội song song · Mỗi đội 1 gậy',
                      },
                      {
                        key: 'class_relay',
                        title: 'Cả lớp cùng tiếp sức',
                        sub: '1 đội · 1 gậy luân phiên cả lớp',
                      },
                      {
                        key: 'solo_practice',
                        title: 'Tự luyện',
                        sub: '1 học sinh làm các câu liên tiếp',
                      },
                    ] as Array<{ key: RelayMode; title: string; sub: string }>
                  ).map((item) => {
                    const active = setupConfig.mode === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => handleModeChange(item.key)}
                        className={`text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                          active
                            ? 'border-sky-400 bg-sky-950/55'
                            : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                        }`}
                      >
                        <p className="text-sm font-extrabold text-white">{item.title}</p>
                        <p className="text-[11px] text-slate-300 mt-1">{item.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Team Count + Quick Roster Distribution Tools */}
              {!isSoloMode && (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {isTeamMode && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-300">Số đội:</span>
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => handleChangeTeamCount(cnt)}
                            className={`h-8 w-8 rounded-lg font-mono text-xs font-extrabold cursor-pointer ${
                              setupConfig.teams.length === cnt
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Authorized Class Selector (reuse Smart EDU selector) */}
                    {classes.length > 0 && onSelectSourceKey && (
                      <select
                        aria-label="Chọn lớp học trong Smart EDU"
                        value={selectedSourceKey || ''}
                        onChange={(e) => onSelectSourceKey(e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-100"
                      >
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            Lớp {c.name} ({c.students.length} HS)
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Quick populate row */}
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/65 p-2.5">
                    {candidateNames.length > 0 && (
                      <button
                        type="button"
                        onClick={handleApplyClassRoster}
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-extrabold text-white cursor-pointer"
                      >
                        Chia đều {candidateNames.length} HS lớp hiện tại
                      </button>
                    )}

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-300">Hoặc tạo nhanh nhãn tạm:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={tempTotalStudents}
                        onChange={(e) =>
                          setTempTotalStudents(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
                        }
                        aria-label="Tổng số học sinh nhãn tạm"
                        className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-mono font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyTempLabels(tempTotalStudents)}
                        className="rounded-lg border border-sky-500/60 bg-sky-950/60 hover:bg-sky-900/70 px-2.5 py-1.5 text-xs font-bold text-sky-200 cursor-pointer"
                      >
                        Tạo “Bạn 1…{tempTotalStudents}”
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Per-Team Cards (Reorder / Add / Rename Members) */}
              <div
                className={`grid gap-3 ${
                  setupConfig.teams.length === 1
                    ? 'grid-cols-1'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}
              >
                {setupConfig.teams.map((team) => {
                  const palette =
                    RELAY_TEAM_PALETTES[team.paletteIndex % RELAY_TEAM_PALETTES.length];
                  return (
                    <div
                      key={team.id}
                      className={`rounded-xl border ${palette.borderClass} ${palette.bgClass} p-3 space-y-2.5`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: palette.hex }}
                        />
                        <input
                          type="text"
                          value={team.name}
                          maxLength={32}
                          onChange={(e) =>
                            handleUpdateTeam(team.id, (t) => ({ ...t, name: e.target.value }))
                          }
                          aria-label={`Tên ${team.name}`}
                          className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1 text-sm font-extrabold text-white focus:border-sky-400 focus:outline-none"
                        />
                        <span className="font-mono text-xs font-bold text-slate-300 shrink-0">
                          {team.members.length} HS
                        </span>
                      </div>

                      {!isSoloMode ? (
                        <>
                          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                            {team.members.map((member, mIdx) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-1.5 rounded-lg bg-slate-950/80 border border-slate-800 px-2 py-1 text-xs"
                              >
                                <span className="font-mono text-[11px] font-bold text-slate-400 w-5">
                                  #{mIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={member.name}
                                  maxLength={32}
                                  onChange={(e) =>
                                    handleUpdateTeam(team.id, (t) => ({
                                      ...t,
                                      members: t.members.map((m) =>
                                        m.id === member.id ? { ...m, name: e.target.value } : m
                                      ),
                                    }))
                                  }
                                  className="flex-1 min-w-0 bg-transparent text-slate-100 font-semibold focus:outline-none"
                                />
                                <button
                                  type="button"
                                  disabled={mIdx === 0}
                                  onClick={() => handleMoveMember(team.id, mIdx, -1)}
                                  title="Đưa lên trước"
                                  className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={mIdx === team.members.length - 1}
                                  onClick={() => handleMoveMember(team.id, mIdx, 1)}
                                  title="Đưa xuống sau"
                                  className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={team.members.length <= 1}
                                  onClick={() => handleRemoveMemberFromTeam(team.id, member.id)}
                                  title="Xóa thành viên"
                                  className="p-0.5 text-rose-400 hover:text-rose-200 disabled:opacity-30 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newMemberDraftByTeam[team.id] || ''}
                              onChange={(e) =>
                                setNewMemberDraftByTeam((prev) => ({
                                  ...prev,
                                  [team.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMemberToTeam(team.id);
                                }
                              }}
                              placeholder="Thêm tên HS (nhấn +)..."
                              className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder:text-slate-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddMemberToTeam(team.id)}
                              className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-bold text-white cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Thêm
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-300">
                          Cùng một học sinh sẽ làm liên tiếp các câu hỏi và xem lời giải chi tiết từng câu.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Question Source, Parameters & Start */}
            <div className="xl:col-span-5 space-y-4 rounded-xl border border-slate-800 bg-[#0E1D38] p-4 sm:p-5">
              <div>
                <h3 className="text-sm font-extrabold text-white mb-2.5 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  2. Bộ câu hỏi & luật tiếp sức
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({ ...prev, sourceKind: 'sample' }))
                    }
                    className={`text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      setupConfig.sourceKind === 'sample'
                        ? 'border-emerald-400 bg-emerald-950/40'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-white">{D05_SAMPLE_PACK_TITLE}</p>
                    <p className="mt-1 text-[11px] text-emerald-300 font-bold">
                      {D05_SAMPLE_BADGE} · 10 câu KaTeX
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSetupConfig((prev) => ({ ...prev, sourceKind: 'bank' }))
                    }
                    className={`text-left rounded-xl border-2 p-3 transition-colors cursor-pointer ${
                      setupConfig.sourceKind === 'bank'
                        ? 'border-sky-400 bg-sky-950/40'
                        : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-xs font-extrabold text-white">Ngân hàng câu hỏi Smart EDU</p>
                    <p className="mt-1 text-[11px] text-sky-300 font-bold">
                      Sẵn sàng · {availableBankAll.length} câu
                    </p>
                  </button>
                </div>

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

                <div className="mt-2.5 flex items-center justify-between text-xs text-slate-300 bg-slate-950/75 border border-slate-800 rounded-lg px-3 py-2">
                  <span>Số câu hỏi hợp lệ trong bộ đang chọn:</span>
                  <span className="font-mono font-extrabold text-emerald-300">
                    {availablePool.length} câu
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="d05-q-count" className="block text-xs font-bold text-slate-300 mb-1">
                    Số câu hỏi (mặc định 10)
                  </label>
                  <input
                    id="d05-q-count"
                    type="number"
                    min={1}
                    max={Math.max(1, availablePool.length)}
                    value={setupConfig.questionCount}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({
                        ...prev,
                        questionCount: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-white"
                  />
                </div>

                <div>
                  <label htmlFor="d05-timer" className="block text-xs font-bold text-slate-300 mb-1">
                    Thời gian / câu
                  </label>
                  <select
                    id="d05-timer"
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

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-200">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setupConfig.shuffleQuestions}
                    onChange={(e) =>
                      setSetupConfig((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                    }
                    className="accent-sky-500"
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
                    className="accent-sky-500"
                  />
                  Trộn phương án A/B/C/D
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => setReducedMotion(e.target.checked)}
                    className="accent-sky-500"
                  />
                  Giảm chuyển động
                </label>
              </div>

              <div className="rounded-xl border border-slate-700/80 bg-slate-950/75 p-3.5 text-xs text-slate-300 space-y-1">
                <p className="font-extrabold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Luật tiếp sức công bằng:
                </p>
                <p>• Mỗi câu đúng +{POINTS_PER_CORRECT} điểm; sai hoặc không trả lời 0 điểm.</p>
                <p>• Sau mỗi câu đã chấm, mọi đội đều chuyền gậy sang người tiếp theo (đến cuối quay lại người đầu).</p>
                <p>• Xếp hạng theo tổng điểm; bằng điểm xếp Đồng hạng, không phân thắng thua theo tốc độ bấm.</p>
              </div>

              {setupValidation.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-500/50 bg-amber-950/45 px-3 py-2 text-xs text-amber-200 space-y-1">
                  {setupValidation.warnings.map((w, i) => (
                    <p key={i}>• {w}</p>
                  ))}
                  {availablePool.length >= setupValidation.maxTeamSize &&
                    setupConfig.questionCount < setupValidation.maxTeamSize && (
                      <button
                        type="button"
                        onClick={() =>
                          setSetupConfig((prev) => ({
                            ...prev,
                            questionCount: setupValidation.maxTeamSize,
                          }))
                        }
                        className="mt-1 inline-flex items-center gap-1 rounded bg-amber-400 px-2.5 py-1 text-[11px] font-extrabold text-slate-950 cursor-pointer"
                      >
                        Tăng lên {setupValidation.maxTeamSize} câu để mọi thành viên đều đến lượt
                      </button>
                    )}
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 px-5 py-3.5 text-base font-extrabold text-white shadow-lg cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                Bắt đầu Tiếp sức đồng đội 3D
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
    const standings = computeRelayStandings(matchState);
    const topRankTeams = standings.filter((s) => s.rank === 1);
    const headline = matchState.endedEarly
      ? 'Trận tiếp sức kết thúc sớm'
      : topRankTeams.length > 1
        ? `Đồng hạng Nhất: ${topRankTeams.map((t) => t.name).join(' & ')}`
        : matchState.config.mode === 'solo_practice'
          ? 'Hoàn thành phiên Tự luyện!'
          : `Đội vô địch: ${topRankTeams[0]?.name || ''}`;

    return (
      <div
        className={`w-full bg-[#091428] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
          isFullscreen ? 'h-full rounded-none border-0' : ''
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-[#0E1D38] border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-sm sm:text-base text-white">
              Tổng kết D05 — Tiếp sức đồng đội 3D
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-200 cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Result Banner & Podium Standings Table */}
          <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#122647] via-[#0E1D38] to-[#0E1A30] p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  {matchState.endedEarly
                    ? 'Kết thúc sớm'
                    : `Hoàn thành ${matchState.history.length}/${matchState.questionOrder.length} lượt`}
                </p>
                <h2 className="text-2xl sm:text-3xl font-black text-white mt-1">{headline}</h2>
              </div>
              <div className="text-right font-mono text-xs sm:text-sm text-slate-300">
                <p>Tổng lượt đã chấm: <strong className="text-white">{matchState.history.length}</strong></p>
                <p>Điểm tối đa khả thi: <strong className="text-amber-300">{matchState.history.length * POINTS_PER_CORRECT}đ</strong></p>
              </div>
            </div>

            {/* Standings Table (Strictly by Total Score, Explicit Ties) */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                    <th className="py-2 pr-3 font-bold">Hạng</th>
                    <th className="py-2 pr-3 font-bold">Đội / Người chơi</th>
                    <th className="py-2 px-3 font-bold text-right">Điểm kiến thức</th>
                    <th className="py-2 px-3 font-bold text-right">Số câu đúng</th>
                    <th className="py-2 pl-3 font-bold text-right">Lượt đã tham gia</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row) => {
                    const palette =
                      RELAY_TEAM_PALETTES[row.paletteIndex % RELAY_TEAM_PALETTES.length];
                    return (
                      <tr
                        key={row.teamId}
                        className="border-b border-slate-800/80 last:border-0"
                      >
                        <td className="py-3 pr-3 font-mono font-black text-amber-300 whitespace-nowrap">
                          #{row.rank}
                          {row.isTied && (
                            <span className="ml-1.5 font-sans text-xs font-bold text-sky-300">
                              (Đồng hạng)
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2 font-extrabold text-white">
                            <span
                              className="inline-block h-3 w-3 rounded-sm shrink-0"
                              style={{ backgroundColor: palette.hex }}
                            />
                            <span>{row.name}</span>
                            <span className="text-xs font-normal text-slate-400">
                              ({row.memberCount} thành viên)
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-lg text-amber-300">
                          {row.score} đ
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-300">
                          {row.correctCount}/{row.turnsCompleted}
                        </td>
                        <td className="py-3 pl-3 text-right font-mono font-bold text-slate-200">
                          {row.turnsCompleted} lượt
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSummarySolutions(true);
                  summarySolutionsRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-900/50 hover:bg-emerald-800/60 px-4 py-2.5 text-sm font-bold text-emerald-100 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                Xem lại lời giải
              </button>
              <button
                type="button"
                onClick={() => handleStartMatch(matchState.config)}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2.5 text-sm font-extrabold text-slate-950 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Chơi lại
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

          {/* Full Knowledge & Solution Review (with MathView) */}
          <div
            ref={summarySolutionsRef}
            className="rounded-2xl border border-slate-800 bg-[#0E1D38] p-4 sm:p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Xem lại đề bài & lời giải ({matchState.history.length} câu đã chấm)
              </h3>
              <button
                type="button"
                onClick={() => setShowSummarySolutions((prev) => !prev)}
                className="text-xs font-bold text-sky-300 cursor-pointer"
              >
                {showSummarySolutions ? 'Thu gọn' : 'Mở rộng'}
              </button>
            </div>

            {showSummarySolutions && (
              <div className="space-y-3">
                {matchState.history.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có câu hỏi nào được chấm.</p>
                ) : (
                  matchState.history.map((rec, idx) => (
                    <div
                      key={rec.questionId}
                      className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-4 space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-extrabold text-sky-300">
                          Lượt {idx + 1} · {rec.questionCode}
                          {rec.wasEdited ? ' (Đã chỉnh sửa kết quả)' : ''}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {matchState.config.teams.map((t) => {
                            const out = rec.teamOutcomes[t.id];
                            if (!out) return null;
                            return (
                              <span
                                key={t.id}
                                className={`rounded border px-2 py-0.5 font-bold ${
                                  VERDICT_META[out.verdict].badgeClass
                                }`}
                              >
                                {t.name} ({out.runnerName}): {VERDICT_META[out.verdict].short} (+{out.pointsAwarded}đ)
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="text-sm sm:text-base font-bold text-white">
                        <MathView content={rec.questionStem} block />
                      </div>
                      <div className="text-sm font-bold text-emerald-300">
                        Đáp án: <MathView content={rec.officialAnswerText} />
                      </div>
                      <div className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                        Lời giải: <MathView content={rec.explanation} />
                      </div>
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
  if (!matchState || !currentQuestion) return null;

  const visualLanes = buildVisualLanes(matchState);
  const isSolo = matchState.config.mode === 'solo_practice';
  const allTeamsGraded = matchState.config.teams.every(
    (t) => verdictsByTeam[t.id] && verdictsByTeam[t.id] !== 'ungraded'
  );

  const soloCanSubmit = currentQuestion.requiresTeacherGrading
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
      className={`w-full bg-[#091428] text-slate-100 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col ${
        isFullscreen ? 'h-full rounded-none border-0' : ''
      }`}
    >
      {/* Classroom Control Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#0E1D38] border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-extrabold text-amber-300 shrink-0">D05</span>
          <span className="text-sm sm:text-base font-extrabold text-white truncate">
            {matchState.config.mode === 'team_relay'
              ? 'Tiếp sức theo đội'
              : matchState.config.mode === 'class_relay'
                ? 'Cả lớp cùng tiếp sức'
                : 'Tự luyện Tiếp sức'}
          </span>
          <span className="font-mono text-xs font-extrabold text-sky-200 shrink-0">
            Câu {matchState.currentQuestionIndex + 1}/{matchState.questionOrder.length}
          </span>
          <span className="hidden md:inline text-xs text-slate-400">·</span>
          <span className="hidden md:inline font-mono text-xs font-bold text-amber-300 shrink-0">
            Lượt hoàn thành: {matchState.history.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Timer + Pause/Resume */}
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
                title={isPaused ? 'Tiếp tục (Space)' : 'Tạm dừng (Space)'}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold cursor-pointer ${
                  isPaused
                    ? 'border-amber-400 bg-amber-400 text-slate-950'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setForce2D((f) => !f)}
            title={force2D ? 'Chuyển sang sân 3D' : 'Chuyển sang sơ đồ 2D'}
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

      {/* Main Scrollable Stage */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {webglAutoFallbackNotice && (
          <div className="rounded-lg border border-sky-500/40 bg-sky-950/40 px-3 py-2 text-xs text-sky-200 flex items-center justify-between">
            <span>Thiết bị đang sử dụng sơ đồ làn chạy 2D gọn nhẹ thay cho WebGL 3D.</span>
            <button
              type="button"
              onClick={() => setWebglAutoFallbackNotice(false)}
              className="font-bold text-sky-300 cursor-pointer"
            >
              Ẩn
            </button>
          </div>
        )}

        {isPaused && (
          <div className="rounded-xl border border-amber-400/60 bg-amber-950/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
              <Pause className="w-4 h-4 text-amber-300" />
              Đang tạm dừng — giữ nguyên {remainingSeconds}s và khóa thao tác chốt đáp án.
            </div>
            <button
              type="button"
              onClick={() => setIsPaused(false)}
              className="rounded-lg bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
            >
              Tiếp tục
            </button>
          </div>
        )}

        {/* 3D / 2D Relay Track Arena (compact while question is active) */}
        <div className="relative">
          <RelayTeam3DScene
            mode={matchState.config.mode}
            lanes={visualLanes}
            turnsCompleted={matchState.history.length}
            totalQuestions={matchState.questionOrder.length}
            handoffEventId={handoffEventId}
            batonHandedOff={batonHandedOff}
            skipToken={skipToken}
            reducedMotion={reducedMotion}
            force2D={force2D}
            compactView={turnPhase === 'answering' || turnPhase === 'judging'}
            onBatonContact={handleBatonContactSound}
            onHandoffSettled={handleHandoffSettled}
            onWebGLFallback={() => setWebglAutoFallbackNotice(true)}
          />

          {isHandoffAnimating && (
            <button
              type="button"
              onClick={handleSkipAnimation}
              className="absolute right-3 bottom-12 z-10 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-slate-950/92 hover:bg-slate-900 px-3 py-1.5 text-xs font-extrabold text-amber-200 shadow-lg cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              Bỏ qua hoạt ảnh
            </button>
          )}
        </div>

        {/* ==================================================================== */}
        {/* PHASE 1: PREP (BATON HOLDERS PREVIEW & ABSENTEE SKIP BEFORE OPENING) */}
        {/* ==================================================================== */}
        {turnPhase === 'prep' && !isSolo && (
          <div className="rounded-2xl border border-slate-700 bg-[#0E1D38] p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-white">
                  Chuẩn bị Câu {matchState.currentQuestionIndex + 1} / {matchState.questionOrder.length} — Điểm danh người cầm gậy
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Kiểm tra người đang cầm gậy của từng đội. Nếu học sinh vắng, bấm <strong>“Vắng – Đổi người tiếp”</strong> trước khi mở câu hỏi (học sinh vắng không bị tính sai).
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenQuestionFromPrep}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 px-5 py-3 text-sm sm:text-base font-extrabold text-white shadow-lg cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Mở câu hỏi & Bắt đầu giờ
              </button>
            </div>

            {absentNotice && (
              <div className="rounded-xl border border-sky-400/50 bg-sky-950/50 px-4 py-2.5 text-xs sm:text-sm font-semibold text-sky-100">
                {absentNotice}
              </div>
            )}

            <div
              className={`grid gap-3 ${
                matchState.config.teams.length === 1
                  ? 'grid-cols-1'
                  : matchState.config.teams.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {matchState.config.teams.map((team) => {
                const rt = matchState.teamRuntime[team.id];
                const palette = RELAY_TEAM_PALETTES[rt.paletteIndex % RELAY_TEAM_PALETTES.length];
                const active = getActiveMember(rt);
                const next = getNextMember(rt);

                return (
                  <div
                    key={team.id}
                    className={`rounded-xl border-2 ${palette.borderClass} ${palette.bgClass} p-4 space-y-2.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-sm shrink-0"
                          style={{ backgroundColor: palette.hex }}
                        />
                        <span className="text-sm sm:text-base font-extrabold text-white truncate">
                          {rt.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-black text-amber-300 shrink-0">
                        {rt.score}đ
                      </span>
                    </div>

                    <div className="rounded-lg bg-slate-950/85 border border-slate-700/80 p-3 space-y-1">
                      <p className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        Đang trả lời (Cầm gậy)
                      </p>
                      <p className="text-lg sm:text-xl font-black text-white truncate">
                        {active.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        Người tiếp theo: <strong className="text-slate-200">{next.name}</strong>
                      </p>
                    </div>

                    {rt.members.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleSkipAbsentInPrep(team.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900/90 hover:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        <UserMinus className="w-3.5 h-3.5 text-amber-300" />
                        Vắng – Đổi sang {next.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* QUESTION PROJECTION CARD (ACTIVE DURING ANSWERING / JUDGING / HANDOFF) */}
        {/* ==================================================================== */}
        {turnPhase !== 'prep' && (
          <div className="rounded-2xl border border-slate-700/90 bg-[#0F203D] p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
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
                <span>·</span>
                <span className="font-bold text-emerald-300">{currentQuestion.sourceBadge}</span>
              </div>

              <button
                type="button"
                onClick={() => setShowFormulaZoomModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-900 hover:bg-slate-800 px-2.5 py-1 text-xs font-bold text-sky-200 cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                Phóng to công thức
              </button>
            </div>

            {/* Large Classroom-Readable Stem with Shared MathView */}
            <div className="text-xl sm:text-2xl lg:text-[26px] font-extrabold text-white leading-snug overflow-x-auto">
              <MathView content={currentQuestion.stem} block />
            </div>

            {/* Optional Image with graceful fallback */}
            {currentQuestion.image && !brokenImageMap[currentQuestion.id] && (
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-2 inline-block max-w-full">
                <img
                  src={currentQuestion.image}
                  alt={`Minh họa câu hỏi ${currentQuestion.code}`}
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenImageMap((prev) => ({ ...prev, [currentQuestion.id]: true }))
                  }
                  className="max-h-56 rounded-lg object-contain mx-auto"
                />
              </div>
            )}
            {currentQuestion.image && brokenImageMap[currentQuestion.id] && (
              <p className="text-xs text-amber-300">
                Không tải được hình minh họa; các đội vẫn có thể trả lời theo nội dung đề bài.
              </p>
            )}

            {/* Options (MathView in EVERY option, preserving stable option.id) */}
            {currentQuestion.type === 'single_choice' && currentQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt) => {
                  const isOfficialCorrect =
                    answerRevealed && opt.id === currentQuestion.correctOptionId;
                  const isSoloSelected = isSolo && soloSelectedOptionId === opt.id;

                  if (isSolo && turnPhase === 'answering' && !currentQuestion.requiresTeacherGrading) {
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isPaused}
                        onClick={() => setSoloSelectedOptionId(opt.id)}
                        className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                          isSoloSelected
                            ? 'border-sky-400 bg-sky-900/60 text-white'
                            : 'border-slate-700 bg-slate-900/85 text-slate-100 hover:border-slate-500'
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
                        <span className="text-base sm:text-lg font-bold min-w-0 overflow-x-auto">
                          <MathView content={opt.text} />
                        </span>
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
                            : 'border-slate-700/90 bg-slate-900/80 text-slate-100'
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
                      <span className="text-base sm:text-lg font-bold min-w-0 overflow-x-auto">
                        <MathView content={opt.text} />
                      </span>
                      {isOfficialCorrect && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* True/False Group */}
            {currentQuestion.type === 'true_false_group' && currentQuestion.subItems && (
              <div className="space-y-2.5">
                {currentQuestion.subItems.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3"
                  >
                    <div className="text-sm sm:text-base font-semibold text-white">
                      <span className="font-mono font-extrabold text-sky-300 mr-2">{sub.label})</span>
                      <MathView content={sub.text} />
                    </div>
                    {isSolo && turnPhase === 'answering' ? (
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
                            sub.isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
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

            {/* Solo Short Answer / Essay Input */}
            {isSolo &&
              (currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay') &&
              turnPhase === 'answering' && (
                <div className="space-y-2">
                  <label htmlFor="d05-solo-short" className="block text-xs font-bold text-slate-300">
                    {currentQuestion.requiresTeacherGrading
                      ? 'Ghi chú câu trả lời (Câu mở / tự luận — Giáo viên chấm trực tiếp)'
                      : 'Nhập đáp án:'}
                  </label>
                  <input
                    id="d05-solo-short"
                    type="text"
                    disabled={isPaused}
                    value={soloShortInput}
                    onChange={(e) => setSoloShortInput(e.target.value)}
                    placeholder="Nhập câu trả lời..."
                    className="w-full rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base font-bold text-white"
                  />
                </div>
              )}

            {/* Official Answer & Solution (MathView) */}
            {answerRevealed && (
              <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/45 p-4 space-y-1.5">
                <div className="text-sm sm:text-base font-extrabold text-emerald-300 flex flex-wrap items-center gap-2">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Đáp án chính thức:</span>
                  <MathView content={currentQuestion.officialAnswerText} />
                </div>
                <div className="text-xs sm:text-sm text-emerald-100/95 leading-relaxed">
                  <MathView content={currentQuestion.explanation} block />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* PHASE 2: ANSWERING CONTROLS                                          */}
        {/* ==================================================================== */}
        {turnPhase === 'answering' && !isSolo && (
          <div className="rounded-2xl border border-slate-700 bg-[#0E1D38] p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-extrabold text-white">
                Người cầm gậy đã khóa cho lượt này — học sinh viết đáp án ra bảng con / giấy
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {matchState.config.teams.map((t) => {
                  const rt = matchState.teamRuntime[t.id];
                  const idx = lockedRunnerIndexByTeam[t.id] ?? rt.currentMemberIndex;
                  const holder = rt.members[idx] ?? getActiveMember(rt);
                  return (
                    <span key={t.id}>
                      <strong className="text-sky-200">{rt.name}:</strong> {holder.name}
                    </span>
                  );
                })}
              </div>
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

        {turnPhase === 'answering' && isSolo && (
          <div className="rounded-2xl border border-slate-700 bg-[#0E1D38] p-4 space-y-3">
            {currentQuestion.requiresTeacherGrading ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-white">
                      Câu mở / tự luận — Giáo viên chấm trực tiếp
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
                    Chốt: Đúng (+{POINTS_PER_CORRECT}đ)
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
                    Chốt: Chưa đúng (0đ)
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs sm:text-sm text-slate-300">
                  Chọn phương án hoặc nhập đáp án rồi nhấn <strong>“Chốt đáp án”</strong>.
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
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* PHASE 3: SIMULTANEOUS TEAM JUDGING                                   */}
        {/* ==================================================================== */}
        {turnPhase === 'judging' && !isSolo && (
          <div className="space-y-4">
            {timerExpiredNotice && (
              <div className="rounded-xl border border-amber-400/50 bg-amber-950/45 px-4 py-2.5 text-xs sm:text-sm font-bold text-amber-200">
                Hết thời gian suy nghĩ. Giáo viên vẫn ghi nhận đầy đủ đáp án các đội đã viết trước hạn bên dưới.
              </div>
            )}

            <div
              className={`grid gap-3.5 ${
                matchState.config.teams.length === 1
                  ? 'grid-cols-1'
                  : matchState.config.teams.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {matchState.config.teams.map((team) => {
                const rt = matchState.teamRuntime[team.id];
                const palette = RELAY_TEAM_PALETTES[rt.paletteIndex % RELAY_TEAM_PALETTES.length];
                const lockedIdx = lockedRunnerIndexByTeam[team.id] ?? rt.currentMemberIndex;
                const runner = rt.members[lockedIdx] ?? getActiveMember(rt);
                const verdict = verdictsByTeam[team.id] ?? 'ungraded';

                return (
                  <div
                    key={team.id}
                    className={`rounded-2xl border-2 ${palette.borderClass} ${palette.bgClass} p-4 space-y-3`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3.5 w-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: palette.hex }}
                          />
                          <h4 className="text-sm sm:text-base font-extrabold text-white truncate">
                            {rt.name}
                          </h4>
                        </div>
                        <p className="text-xs text-sky-200 font-bold mt-0.5 truncate">
                          Đang trả lời: {runner.name}
                        </p>
                      </div>
                      <span
                        className={`rounded border px-2 py-0.5 text-xs font-extrabold shrink-0 ${
                          VERDICT_META[verdict].badgeClass
                        }`}
                      >
                        {VERDICT_META[verdict].short}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {(['correct', 'incorrect', 'no_answer'] as RelayVerdict[]).map((v) => {
                        const active = verdict === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            disabled={isPaused}
                            onClick={() =>
                              setVerdictsByTeam((prev) => ({ ...prev, [team.id]: v }))
                            }
                            className={`rounded-xl border-2 py-2 px-1.5 text-xs font-extrabold transition-all cursor-pointer ${
                              active
                                ? v === 'correct'
                                  ? 'border-emerald-300 bg-emerald-600 text-white'
                                  : v === 'incorrect'
                                    ? 'border-rose-300 bg-rose-600 text-white'
                                    : 'border-amber-300 bg-amber-600 text-white'
                                : 'border-slate-700 bg-slate-900/90 text-slate-200 hover:border-slate-500'
                            }`}
                          >
                            {VERDICT_META[v].short}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={answerNotesByTeam[team.id] || ''}
                      onChange={(e) =>
                        setAnswerNotesByTeam((prev) => ({ ...prev, [team.id]: e.target.value }))
                      }
                      placeholder="Ghi đáp án bảng con (tùy chọn)..."
                      className="w-full rounded-lg border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-500"
                    />
                  </div>
                );
              })}
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#0E1D38] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-white">
                  {allTeamsGraded
                    ? 'Tất cả đội đã được chấm — sẵn sàng công bố & trao gậy đồng thời.'
                    : 'Hãy chấm đầy đủ cho tất cả các đội trước khi xác nhận.'}
                </p>
                <p className="text-[11px] text-slate-400">
                  Nguồn kết quả: Giáo viên nhập trực tiếp trên một máy · Chống bấm đúp một lượt chỉ cộng điểm & chuyển gậy 1 lần.
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
                    isPaused || !allTeamsGraded || commitGuardBusy || isCurrentQuestionCommitted
                  }
                  onClick={handleCommitTeamsTurn}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 px-5 py-2.5 text-sm sm:text-base font-extrabold text-slate-950 shadow-lg cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Xác nhận kết quả & Trao gậy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* PHASE 4: POST-CONFIRM HANDOFF & EDIT LAST RESULT                     */}
        {/* ==================================================================== */}
        {turnPhase === 'handoff' && lastCommittedRecord && (
          <div className="rounded-2xl border border-slate-700 bg-[#0E1D38] p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-base sm:text-lg font-black text-amber-300">
                  Đã hoàn thành Lượt {matchState.history.length}/{matchState.questionOrder.length} & Trao gậy!
                </p>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Điểm kiến thức đã được cập nhật. Bạn có thể sửa kết quả câu vừa chấm trước khi mở câu tiếp theo.
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
                      {isSolo ? 'Câu tiếp theo' : 'Chuẩn bị câu tiếp theo'}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      Xem bảng tổng kết
                      <Award className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Per-Team Post-Handoff Summary Cards */}
            <div
              className={`grid gap-2.5 ${
                matchState.config.teams.length === 1
                  ? 'grid-cols-1'
                  : matchState.config.teams.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}
            >
              {matchState.config.teams.map((t) => {
                const rt = matchState.teamRuntime[t.id];
                const outcome = lastCommittedRecord.teamOutcomes[t.id];
                const newHolder = getActiveMember(rt);
                const palette = RELAY_TEAM_PALETTES[rt.paletteIndex % RELAY_TEAM_PALETTES.length];
                if (!outcome) return null;

                return (
                  <div
                    key={t.id}
                    className={`rounded-xl border ${palette.borderClass} bg-slate-950/75 p-3 space-y-1 text-xs`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-white truncate">{rt.name}</span>
                      <span className="font-mono font-black text-amber-300">{rt.score}đ</span>
                    </div>
                    <p className="text-slate-300">
                      Vừa trả lời: <strong>{outcome.runnerName}</strong> —{' '}
                      <span
                        className={
                          outcome.verdict === 'correct'
                            ? 'text-emerald-300 font-extrabold'
                            : 'text-rose-300 font-bold'
                        }
                      >
                        {VERDICT_META[outcome.verdict].label}
                      </span>
                    </p>
                    {!isSolo && (
                      <p className="text-sky-200 font-bold">
                        Gậy chuyển sang: {newHolder.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Inline Edit Last Confirmed Turn */}
            {isEditingLastTurn && (
              <div className="rounded-xl border border-amber-400/50 bg-slate-950/90 p-4 space-y-3">
                <p className="text-xs sm:text-sm font-extrabold text-amber-300">
                  Chỉnh sửa kết quả câu vừa chấm (tính lại điểm từ lịch sử, giữ đúng 1 lần chuyển gậy):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matchState.config.teams.map((t) => {
                    const out = lastCommittedRecord.teamOutcomes[t.id];
                    return (
                      <div key={t.id} className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-200">
                          {t.name} ({out?.runnerName})
                        </span>
                        <div className="grid grid-cols-3 gap-1">
                          {(['correct', 'incorrect', 'no_answer'] as RelayVerdict[]).map((v) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() =>
                                setEditVerdictsByTeam((prev) => ({ ...prev, [t.id]: v }))
                              }
                              className={`rounded-lg border py-1.5 text-[11px] font-extrabold cursor-pointer ${
                                editVerdictsByTeam[t.id] === v
                                  ? 'border-amber-300 bg-amber-400 text-slate-950'
                                  : 'border-slate-700 bg-slate-900 text-slate-300'
                              }`}
                            >
                              {VERDICT_META[v].short}
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
                    onClick={() => setIsEditingLastTurn(false)}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditLastTurn}
                    className="rounded-lg bg-amber-400 hover:bg-amber-300 px-4 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                  >
                    Lưu & tính lại điểm
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Formula Zoom Modal (for long formulas on classroom projectors) */}
      {showFormulaZoomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Phóng to đề bài và công thức Toán"
        >
          <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-sky-400/50 bg-[#0E1D38] p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-3">
              <span className="font-mono text-sm font-extrabold text-sky-300">
                Phóng to câu hỏi {currentQuestion.code}
              </span>
              <button
                type="button"
                onClick={() => setShowFormulaZoomModal(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
                Đóng (Esc)
              </button>
            </div>

            <div className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-relaxed overflow-x-auto">
              <MathView content={currentQuestion.stem} block />
            </div>

            {currentQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {currentQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/85 p-4 text-xl sm:text-2xl font-bold text-white"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 font-mono text-base font-black text-sky-300">
                      {opt.label}
                    </span>
                    <MathView content={opt.text} />
                  </div>
                ))}
              </div>
            )}

            {answerRevealed && (
              <div className="rounded-xl border border-emerald-400/50 bg-emerald-950/50 p-4 text-lg sm:text-xl text-emerald-100 space-y-2">
                <p className="font-extrabold text-emerald-300">
                  Đáp án: <MathView content={currentQuestion.officialAnswerText} />
                </p>
                <MathView content={currentQuestion.explanation} block />
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-App Confirm Modal for Ending Early (Never window.confirm) */}
      {showEndEarlyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="d05-end-early-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0E1D38] p-5 shadow-2xl space-y-4">
            <h3 id="d05-end-early-title" className="text-lg font-extrabold text-white">
              Kết thúc sớm phiên Tiếp sức?
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              Trò chơi sẽ chuyển sang bảng tổng kết với <strong className="text-white">{matchState.history.length}</strong> lượt đã hoàn thành và xếp hạng theo tổng điểm hiện tại.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowEndEarlyConfirm(false)}
                className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-bold text-slate-200 cursor-pointer"
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

export default RelayTeam3DGame;
