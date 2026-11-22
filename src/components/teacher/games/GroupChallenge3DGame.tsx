/**
 * D07 — THÁCH ĐẤU NHÓM 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * Full Round-Robin tournament (2–6 teams) + 1-student solo practice (zero fake opponents)
 * - Single-device teacher control for classes of 1–50 students
 * - Shared KaTeX MathView across stems, options, answers, explanations, zoom modal & knowledge review
 * - Consistent A01/A02 audio & strict Vietnamese voice controls
 * - Demo-isolated session persistence & corrupt-storage recovery
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  FastForward,
  Flag,
  HelpCircle,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
  Users,
  User,
  Volume2,
  VolumeX,
  X,
  XCircle,
  ZoomIn,
  ListOrdered,
  Mic,
  MicOff,
  AlertTriangle,
} from 'lucide-react';
import { Question, UserRole } from '../../../types';
import { MathView } from '../../MathView';
import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameMuted,
  loadEduGameVoiceEnabled,
  saveEduGameMuted,
  saveEduGameVoiceEnabled,
  stopAllGlobalEduSpeech,
} from '../../../utils/eduGameAudioController';
import { VoiceManagerSnapshot } from '../../../utils/vietnameseVoiceManager';
import {
  CHALLENGE_TEAM_PALETTES,
  ChallengeMatchConfig,
  ChallengeQuestionItem,
  ChallengeTeamConfig,
  D07_SAMPLE_BADGE,
  D07_SAMPLE_PACK_TITLE,
  GroupChallengeMode,
  GroupChallengeState,
  GroupChallengeVerdict,
  advanceGroupChallengePointer,
  buildD07QuestionPool,
  clearD07Session,
  commitGroupChallengeQuestionResult,
  computeGroupChallengeStandings,
  createChallengeTeams,
  createDefaultGroupChallengeConfig,
  createInitialGroupChallengeState,
  editLastConfirmedGroupChallengeQuestion,
  endGroupChallengeEarly,
  evaluateGroupChallengeSoloAnswer,
  getActiveTeamIdsInRound,
  getGlobalQuestionIndex,
  loadD07Session,
  prepareGroupChallengeQuestions,
  saveD07Session,
  validateGroupChallengeSetupConfig,
} from './groupChallenge3dEngine';
import {
  ActiveMatchupVisual,
  ChallengeArenaPhase,
  GroupChallenge3DScene,
} from './GroupChallenge3DScene';

export interface GroupChallenge3DGameProps {
  bankQuestions: Question[];
  userRole?: UserRole;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary: () => void;
}

type ActiveUiPhase =
  | 'round_briefing'
  | 'answering'
  | 'judging'
  | 'question_done'
  | 'round_summary'
  | 'summary';

function getPalette(index: number) {
  return CHALLENGE_TEAM_PALETTES[index % CHALLENGE_TEAM_PALETTES.length];
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\begin\{cases\}/g, 'hệ phương trình ')
    .replace(/\\end\{cases\}/g, '')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, ' nhân ')
    .replace(/\\pm/g, ' cộng trừ ')
    .replace(/\\pi/g, ' pi ')
    .replace(/\\le/g, ' nhỏ hơn hoặc bằng ')
    .replace(/\\ge/g, ' lớn hơn hoặc bằng ')
    .replace(/\\neq/g, ' khác ')
    .replace(/\\Rightarrow/g, ' suy ra ')
    .replace(/\\\\/g, ' và ')
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$|\$/g, ' ')
    .replace(/\{,\}/g, ' phẩy ')
    .replace(/[{}^_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levelLabel(level: string): string {
  switch (level) {
    case 'know':
      return 'Nhận biết';
    case 'understand':
      return 'Thông hiểu';
    case 'apply':
      return 'Vận dụng';
    case 'apply_high':
      return 'Vận dụng cao';
    default:
      return level || 'Tổng hợp';
  }
}

function subjectLabel(subject: string): string {
  switch (subject) {
    case 'math':
      return 'Toán học';
    case 'physics':
      return 'Vật lí';
    case 'chemistry':
      return 'Hóa học';
    case 'biology':
      return 'Sinh học';
    case 'literature':
      return 'Ngữ văn';
    case 'english':
      return 'Tiếng Anh';
    case 'history':
      return 'Lịch sử';
    case 'geography':
      return 'Địa lí';
    case 'informatics':
      return 'Tin học';
    case 'natural_science':
      return 'KHTN';
    default:
      return subject === 'all' ? 'Tất cả môn' : subject;
  }
}

export const GroupChallenge3DGame: React.FC<GroupChallenge3DGameProps> = ({
  bankQuestions,
  userRole,
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  const isDemo = isKhktDemoRuntime();

  // ---- AUDIO & VIETNAMESE VOICE CONTROLLERS (A01/A02 Consistent) ----
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceRef = useRef<EduGameVoiceController | null>(null);

  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceRef.current) {
    voiceRef.current = new EduGameVoiceController(null);
  }

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceManagerSnapshot>(() =>
    voiceRef.current!.getSnapshot()
  );
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const [use3D, setUse3D] = useState<boolean>(true);
  const [webglAutoFallback, setWebglAutoFallback] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // ---- SETUP & SAVED SESSION STATE ----
  const [config, setConfig] = useState<ChallengeMatchConfig>(() =>
    createDefaultGroupChallengeConfig('round_robin', 4)
  );
  const [savedSession, setSavedSession] = useState<GroupChallengeState | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState<boolean>(false);

  // ---- ACTIVE TOURNAMENT STATE ----
  const [gameState, setGameState] = useState<GroupChallengeState | null>(null);
  const [uiPhase, setUiPhase] = useState<ActiveUiPhase>('round_briefing');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [timerExpired, setTimerExpired] = useState<boolean>(false);
  const [showOfficialAnswer, setShowOfficialAnswer] = useState<boolean>(false);
  const [revealPulseKey, setRevealPulseKey] = useState<number>(0);

  // Grading drafts (fixed order per active round pairs)
  const [draftVerdicts, setDraftVerdicts] = useState<Record<string, GroupChallengeVerdict>>({});
  const [draftSelectedOpts, setDraftSelectedOpts] = useState<Record<string, string | undefined>>(
    {}
  );
  const [isEditingLastQuestion, setIsEditingLastQuestion] = useState<boolean>(false);

  // Solo practice answer drafts
  const [soloSelectedOptionId, setSoloSelectedOptionId] = useState<string | null>(null);
  const [soloTrueFalseMap, setSoloTrueFalseMap] = useState<Record<string, boolean>>({});
  const [soloShortAnswer, setSoloShortAnswer] = useState<string>('');

  // Drawers & Modals (schedule & standings collapsed during answering!)
  const [showScheduleDrawer, setShowScheduleDrawer] = useState<boolean>(false);
  const [showStandingsDrawer, setShowStandingsDrawer] = useState<boolean>(false);
  const [showKnowledgeReview, setShowKnowledgeReview] = useState<boolean>(false);
  const [zoomQuestion, setZoomQuestion] = useState<ChallengeQuestionItem | null>(null);
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const commitLockRef = useRef<boolean>(false);
  const lastCountdownBeepRef = useRef<number>(-1);
  const timerAnchorMsRef = useRef<number>(0);
  const timerRemainingAtAnchorRef = useRef<number>(0);

  // Subscribe to Vietnamese voice manager & cleanup on unmount
  useEffect(() => {
    const voice = voiceRef.current!;
    const unsub = voice.subscribe((snap) => setVoiceSnapshot(snap));
    return () => {
      unsub();
      soundBankRef.current?.stopAll();
      voice.stop();
      stopAllGlobalEduSpeech();
    };
  }, []);

  // Load any saved D07 session on mount
  useEffect(() => {
    const loaded = loadD07Session();
    if (loaded.recoveredFromCorruption) {
      setRecoveredNotice(true);
    }
    if (loaded.state) {
      setSavedSession(loaded.state);
    }
  }, []);

  // Persist active session automatically
  useEffect(() => {
    if (gameState) {
      saveD07Session(gameState);
    }
  }, [gameState]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const id = window.setTimeout(() => setToastMessage(null), 3600);
    return () => window.clearTimeout(id);
  }, [toastMessage]);

  useEffect(() => {
    if (!voiceNotice) return;
    const id = window.setTimeout(() => setVoiceNotice(null), 3800);
    return () => window.clearTimeout(id);
  }, [voiceNotice]);

  // ---- AUDIO HELPERS ----
  const stopAllAudioAndVoice = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        stopAllAudioAndVoice();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, [stopAllAudioAndVoice]);

  const handleToggleVoice = useCallback(() => {
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

  const handleExitToLibrary = useCallback(() => {
    stopAllAudioAndVoice();
    onBackToLibrary();
  }, [stopAllAudioAndVoice, onBackToLibrary]);

  // ---- QUESTION POOL & VALIDATION (SETUP) ----
  const bankFacets = useMemo(() => {
    const allAllowed = buildD07QuestionPool({
      sourceKind: 'bank',
      bankQuestions,
      userRole,
    });
    const subjects = Array.from(new Set(allAllowed.map((q) => q.subject))).sort();
    const grades = Array.from(new Set(allAllowed.map((q) => q.grade))).sort(
      (a, b) => Number(a) - Number(b)
    );
    const levels = Array.from(new Set(allAllowed.map((q) => q.level)));
    return { totalBankCount: allAllowed.length, subjects, grades, levels };
  }, [bankQuestions, userRole]);

  const availablePool = useMemo(() => {
    return buildD07QuestionPool({
      sourceKind: config.sourceKind,
      bankQuestions,
      userRole,
      subjectFilter: config.subjectFilter,
      gradeFilter: config.gradeFilter,
      levelFilter: config.levelFilter,
    });
  }, [
    config.sourceKind,
    config.subjectFilter,
    config.gradeFilter,
    config.levelFilter,
    bankQuestions,
    userRole,
  ]);

  const setupValidation = useMemo(() => {
    return validateGroupChallengeSetupConfig(config, availablePool.length);
  }, [config, availablePool.length]);

  // ---- ACTIVE GAME DERIVED DATA ----
  const teamMap = useMemo(() => {
    const map: Record<string, ChallengeTeamConfig> = {};
    (gameState?.config.teams || []).forEach((t) => {
      map[t.id] = t;
    });
    return map;
  }, [gameState]);

  const currentRound = useMemo(() => {
    if (!gameState || gameState.config.mode !== 'round_robin') return null;
    return gameState.rounds[gameState.currentRoundIndex] || null;
  }, [gameState]);

  const currentByeTeam = useMemo(() => {
    if (!currentRound?.byeTeamId) return null;
    return teamMap[currentRound.byeTeamId] || null;
  }, [currentRound, teamMap]);

  const currentQuestion: ChallengeQuestionItem | null = useMemo(() => {
    if (!gameState) return null;
    const globalIdx = getGlobalQuestionIndex(
      gameState.config,
      gameState.currentRoundIndex,
      gameState.currentQuestionInRound
    );
    return gameState.questionOrder[globalIdx] || null;
  }, [gameState]);

  const activeMatchupsVisual: ActiveMatchupVisual[] = useMemo(() => {
    if (!gameState || !currentRound) return [];
    return currentRound.matches.map((pair) => {
      const mr = gameState.matchResults[pair.matchId];
      return {
        matchId: pair.matchId,
        pairIndex: pair.pairIndex,
        teamA: teamMap[pair.teamAId],
        teamB: teamMap[pair.teamBId],
        scoreA: mr?.scoreA ?? 0,
        scoreB: mr?.scoreB ?? 0,
        pointsA: mr?.pointsA ?? 0,
        pointsB: mr?.pointsB ?? 0,
        outcome: mr?.outcome ?? 'pending',
        isCompleted: Boolean(mr?.isCompleted),
      };
    });
  }, [gameState, currentRound, teamMap]);

  const standings = useMemo(() => {
    if (!gameState) return [];
    return computeGroupChallengeStandings(gameState);
  }, [gameState]);

  const soloStats = useMemo(() => {
    if (!gameState || gameState.config.mode !== 'solo_practice') {
      return { correct: 0, totalAnswered: 0, totalQuestions: 0 };
    }
    const soloTeamId = gameState.config.teams[0]?.id;
    const rt = soloTeamId ? gameState.teamRuntime[soloTeamId] : null;
    return {
      correct: rt?.totalCorrect ?? 0,
      totalAnswered: gameState.questionHistory.length,
      totalQuestions: gameState.questionOrder.length,
    };
  }, [gameState]);

  // ---- MONOTONIC COUNTDOWN TIMER (DURING 'answering') ----
  const startQuestionTimer = useCallback((seconds: number) => {
    lastCountdownBeepRef.current = -1;
    setTimerExpired(false);
    setIsPaused(false);
    setRemainingSeconds(seconds);
    timerAnchorMsRef.current = performance.now();
    timerRemainingAtAnchorRef.current = seconds;
  }, []);

  useEffect(() => {
    if (!gameState || uiPhase !== 'answering' || isPaused) return;
    if (gameState.config.timerSeconds <= 0) return;

    timerAnchorMsRef.current = performance.now();
    timerRemainingAtAnchorRef.current = remainingSeconds;

    const intervalId = window.setInterval(() => {
      const elapsedSec = (performance.now() - timerAnchorMsRef.current) / 1000;
      const nextRemaining = Math.max(0, Math.ceil(timerRemainingAtAnchorRef.current - elapsedSec));
      setRemainingSeconds(nextRemaining);

      if (nextRemaining <= 3 && nextRemaining >= 1 && lastCountdownBeepRef.current !== nextRemaining) {
        lastCountdownBeepRef.current = nextRemaining;
        soundBankRef.current?.playCountdownBeep(nextRemaining as 1 | 2 | 3, isMuted);
      }

      if (nextRemaining <= 0) {
        window.clearInterval(intervalId);
        setTimerExpired(true);
        soundBankRef.current?.playTimerBell(isMuted);
        if (gameState.config.mode === 'round_robin') {
          setUiPhase('judging');
        }
      }
    }, 150);

    return () => window.clearInterval(intervalId);
  }, [gameState, uiPhase, isPaused, isMuted]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => {
      if (prev) {
        timerAnchorMsRef.current = performance.now();
        timerRemainingAtAnchorRef.current = remainingSeconds;
      }
      return !prev;
    });
  }, [remainingSeconds]);

  // ---- INITIALIZE DRAFT VERDICTS FOR A QUESTION ----
  const resetQuestionDrafts = useCallback((state: GroupChallengeState, roundIdx: number) => {
    const activeIds = getActiveTeamIdsInRound(state, roundIdx);
    const freshVerdicts: Record<string, GroupChallengeVerdict> = {};
    activeIds.forEach((tid) => {
      freshVerdicts[tid] = 'ungraded';
    });
    setDraftVerdicts(freshVerdicts);
    setDraftSelectedOpts({});
    setIsEditingLastQuestion(false);
    setShowOfficialAnswer(false);
    setSoloSelectedOptionId(null);
    setSoloTrueFalseMap({});
    setSoloShortAnswer('');
    commitLockRef.current = false;
  }, []);

  // ---- START NEW TOURNAMENT / SOLO PRACTICE ----
  const handleStartTournament = useCallback(() => {
    if (!setupValidation.valid) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndVoice();

    const requiredCount = setupValidation.requiredQuestions;
    const preparedQuestions = prepareGroupChallengeQuestions(availablePool, config, requiredCount);
    const initial = createInitialGroupChallengeState(config, preparedQuestions);

    clearD07Session();
    setSavedSession(null);
    setGameState(initial);
    setShowScheduleDrawer(false);
    setShowStandingsDrawer(false);
    setShowKnowledgeReview(false);
    setShowEndEarlyConfirm(false);
    resetQuestionDrafts(initial, 0);

    if (initial.config.mode === 'solo_practice') {
      setUiPhase('answering');
      startQuestionTimer(initial.config.timerSeconds);
      soundBankRef.current?.playChallengeRoundOpen(isMuted);
    } else {
      setUiPhase('round_briefing');
      soundBankRef.current?.playChallengeRoundOpen(isMuted);
    }
  }, [
    setupValidation,
    availablePool,
    config,
    isMuted,
    stopAllAudioAndVoice,
    resetQuestionDrafts,
    startQuestionTimer,
  ]);

  // ---- RESUME SAVED SESSION ----
  const handleResumeSavedSession = useCallback(() => {
    if (!savedSession) return;
    soundBankRef.current?.unlock();
    stopAllAudioAndVoice();
    setGameState(savedSession);
    setShowScheduleDrawer(false);
    setShowStandingsDrawer(false);

    if (savedSession.status !== 'playing') {
      setUiPhase('summary');
      return;
    }

    resetQuestionDrafts(savedSession, savedSession.currentRoundIndex);
    const currentGlobal = getGlobalQuestionIndex(
      savedSession.config,
      savedSession.currentRoundIndex,
      savedSession.currentQuestionInRound
    );
    const alreadyGradedHere = savedSession.questionHistory.some(
      (h) => h.globalQuestionIndex === currentGlobal
    );

    if (alreadyGradedHere) {
      const isEndOfRound =
        savedSession.config.mode === 'round_robin' &&
        savedSession.currentQuestionInRound >= savedSession.config.questionsPerMatch - 1;
      setUiPhase(isEndOfRound ? 'round_summary' : 'question_done');
      setShowOfficialAnswer(true);
    } else if (
      savedSession.config.mode === 'round_robin' &&
      savedSession.currentQuestionInRound === 0
    ) {
      setUiPhase('round_briefing');
    } else {
      setUiPhase('answering');
      startQuestionTimer(savedSession.config.timerSeconds);
    }
  }, [savedSession, stopAllAudioAndVoice, resetQuestionDrafts, startQuestionTimer]);

  // ---- START ACTIVE ROUND (FROM BRIEFING) ----
  const handleBeginRoundFromBriefing = useCallback(() => {
    if (!gameState) return;
    soundBankRef.current?.unlock();
    soundBankRef.current?.playChallengeRoundOpen(isMuted);
    setShowScheduleDrawer(false);
    setShowStandingsDrawer(false);
    resetQuestionDrafts(gameState, gameState.currentRoundIndex);
    setUiPhase('answering');
    startQuestionTimer(gameState.config.timerSeconds);
  }, [gameState, isMuted, resetQuestionDrafts, startQuestionTimer]);

  // ---- READ QUESTION ALOUD (STRICT VIETNAMESE VOICE) ----
  const handleSpeakQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    if (isMuted) {
      setVoiceNotice('Loa đang tắt. Hãy bật loa ở thanh trên cùng để nghe đọc tiếng Việt.');
      return;
    }
    if (!voiceEnabled) {
      setVoiceNotice('Giọng đọc tiếng Việt đang tắt. Hãy bật biểu tượng micro ở thanh trên cùng.');
      return;
    }
    if (!voiceSnapshot.hasVietnameseVoice) {
      setVoiceNotice(
        'Trình duyệt hiện chưa có giọng đọc tiếng Việt (vi-VN). Giáo viên có thể đọc trực tiếp cho lớp.'
      );
      return;
    }
    const spokenText = stripLatexForSpeech(currentQuestion.stem);
    if (!spokenText) return;
    const res = await voiceRef.current!.replayText({
      text: spokenText,
      isMuted,
      voiceEnabled,
      onBeforeSpeak: () => soundBankRef.current?.stopLoops(),
    });
    if (!res.spoken && res.reason === 'no_vietnamese_voice') {
      setVoiceNotice('Thiết bị chưa có giọng tiếng Việt nên không đọc thay bằng tiếng Anh.');
    }
  }, [currentQuestion, isMuted, voiceEnabled, voiceSnapshot.hasVietnameseVoice]);

  // ---- STOP ANSWERING -> OPEN GRADING ----
  const handleOpenJudging = useCallback(() => {
    if (!gameState || isPaused) return;
    soundBankRef.current?.playChallengeQuestionLock(isMuted);
    setUiPhase('judging');
  }, [gameState, isPaused, isMuted]);

  // ---- SELECT QUICK OPTION OR VERDICT FOR A TEAM ----
  const handleSetTeamOption = useCallback(
    (teamId: string, optionId: string) => {
      if (!currentQuestion) return;
      const isCorrect = optionId === currentQuestion.correctOptionId;
      setDraftSelectedOpts((prev) => ({ ...prev, [teamId]: optionId }));
      setDraftVerdicts((prev) => ({
        ...prev,
        [teamId]: isCorrect ? 'correct' : 'incorrect',
      }));
    },
    [currentQuestion]
  );

  const handleSetTeamVerdict = useCallback((teamId: string, verdict: GroupChallengeVerdict) => {
    setDraftSelectedOpts((prev) => ({ ...prev, [teamId]: undefined }));
    setDraftVerdicts((prev) => ({ ...prev, [teamId]: verdict }));
  }, []);

  // Check if all active competing teams are graded
  const allActiveTeamsGraded = useMemo(() => {
    if (!gameState || gameState.config.mode !== 'round_robin') return false;
    const activeIds = getActiveTeamIdsInRound(gameState, gameState.currentRoundIndex);
    if (activeIds.length === 0) return false;
    return activeIds.every((tid) => {
      const v = draftVerdicts[tid];
      return v === 'correct' || v === 'incorrect' || v === 'no_answer';
    });
  }, [gameState, draftVerdicts]);

  // ---- CONFIRM ROUND-ROBIN QUESTION GRADING (OR SAVE EDIT OF LAST QUESTION) ----
  const handleConfirmQuestionGrading = useCallback(() => {
    if (!gameState || !currentQuestion || isPaused || commitLockRef.current) return;
    if (!allActiveTeamsGraded) return;
    commitLockRef.current = true;

    if (isEditingLastQuestion) {
      const edited = editLastConfirmedGroupChallengeQuestion(
        gameState,
        draftVerdicts,
        draftSelectedOpts
      );
      commitLockRef.current = false;
      if (!edited.edited) return;

      setGameState(edited.state);
      setIsEditingLastQuestion(false);
      setShowOfficialAnswer(true);
      setRevealPulseKey((k) => k + 1);
      soundBankRef.current?.playChallengeScoreReveal(isMuted);
      showToast('Đã cập nhật lại kết quả câu vừa chấm và tính lại điểm giải.');

      const isEndOfRound =
        edited.state.currentQuestionInRound >= edited.state.config.questionsPerMatch - 1;
      setUiPhase(isEndOfRound ? 'round_summary' : 'question_done');
      return;
    }

    const result = commitGroupChallengeQuestionResult(gameState, {
      question: currentQuestion,
      verdictsByTeam: draftVerdicts,
      selectedOptionByTeam: draftSelectedOpts,
      resultSource: 'teacher_single_device',
    });

    commitLockRef.current = false;
    if (!result.committed) return;

    setGameState(result.state);
    setShowOfficialAnswer(true);
    setRevealPulseKey((k) => k + 1);

    // ONE unified score reveal cue even when multiple pairs finish simultaneously
    soundBankRef.current?.playChallengeScoreReveal(isMuted);

    if (result.roundJustCompleted) {
      setUiPhase('round_summary');
    } else {
      setUiPhase('question_done');
    }
  }, [
    gameState,
    currentQuestion,
    isPaused,
    allActiveTeamsGraded,
    isEditingLastQuestion,
    draftVerdicts,
    draftSelectedOpts,
    isMuted,
    showToast,
  ]);

  // ---- EDIT LAST GRADED QUESTION (INCLUDING LAST QUESTION OF A ROUND!) ----
  const handleStartEditLastQuestion = useCallback(() => {
    if (!gameState || gameState.questionHistory.length === 0) return;
    const last = gameState.questionHistory[gameState.questionHistory.length - 1];
    setDraftVerdicts({ ...last.verdictsByTeam });
    setDraftSelectedOpts({ ...(last.selectedOptionByTeam || {}) });
    setIsEditingLastQuestion(true);
    setUiPhase('judging');
  }, [gameState]);

  // ---- SOLO PRACTICE SUBMIT ----
  const handleSubmitSoloAnswer = useCallback(() => {
    if (!gameState || !currentQuestion || isPaused || commitLockRef.current) return;
    const soloTeamId = gameState.config.teams[0]?.id;
    if (!soloTeamId) return;

    commitLockRef.current = true;
    const evalRes = evaluateGroupChallengeSoloAnswer(currentQuestion, {
      selectedOptionId: soloSelectedOptionId,
      trueFalseSelections: soloTrueFalseMap,
      shortAnswerText: soloShortAnswer,
    });

    const verdict: GroupChallengeVerdict = evalRes.isCorrect
      ? 'correct'
      : evalRes.answerNote === 'Không trả lời'
      ? 'no_answer'
      : 'incorrect';

    const committed = commitGroupChallengeQuestionResult(gameState, {
      question: currentQuestion,
      verdictsByTeam: { [soloTeamId]: verdict },
      selectedOptionByTeam: { [soloTeamId]: soloSelectedOptionId ?? undefined },
      answerNotesByTeam: { [soloTeamId]: evalRes.answerNote },
      resultSource: 'student_auto',
    });

    commitLockRef.current = false;
    if (!committed.committed) return;

    setGameState(committed.state);
    setShowOfficialAnswer(true);
    setRevealPulseKey((k) => k + 1);
    soundBankRef.current?.playChallengeScoreReveal(isMuted);
    setUiPhase('question_done');
  }, [
    gameState,
    currentQuestion,
    isPaused,
    soloSelectedOptionId,
    soloTrueFalseMap,
    soloShortAnswer,
    isMuted,
  ]);

  // ---- ADVANCE TO NEXT QUESTION, NEXT ROUND, OR FINAL SUMMARY ----
  const handleAdvanceNext = useCallback(() => {
    if (!gameState) return;
    stopAllAudioAndVoice();

    if (gameState.status !== 'playing') {
      const nextStandings = computeGroupChallengeStandings(gameState);
      const isTopTie = nextStandings.length > 0 && nextStandings[0].isTied;
      setUiPhase('summary');
      soundBankRef.current?.playChallengeTournamentFinish(
        isMuted,
        gameState.trophyAwarded,
        isTopTie
      );
      if (
        gameState.config.mode === 'round_robin' &&
        gameState.trophyAwarded &&
        nextStandings[0] &&
        voiceSnapshot.hasVietnameseVoice
      ) {
        const announceMsg = isTopTie
          ? 'Giải đấu kết thúc với kết quả đồng hạng nhất! Xin chúc mừng các đội!'
          : `Xin chúc mừng ${nextStandings[0].name} đã vô địch giải Thách đấu nhóm!`;
        void voiceRef.current?.announceStudentOnce({
          turnId: `d07_finish_${gameState.questionHistory.length}_${nextStandings[0].teamId}`,
          studentName: nextStandings[0].name,
          customText: announceMsg,
          isMuted,
          voiceEnabled,
        });
      }
      return;
    }

    const prevRound = gameState.currentRoundIndex;
    const advanced = advanceGroupChallengePointer(gameState);
    setGameState(advanced);
    resetQuestionDrafts(advanced, advanced.currentRoundIndex);
    setShowScheduleDrawer(false);
    setShowStandingsDrawer(false);

    if (advanced.config.mode === 'round_robin' && advanced.currentRoundIndex > prevRound) {
      setUiPhase('round_briefing');
      soundBankRef.current?.playChallengeRoundOpen(isMuted);
    } else {
      setUiPhase('answering');
      startQuestionTimer(advanced.config.timerSeconds);
    }
  }, [
    gameState,
    isMuted,
    voiceEnabled,
    voiceSnapshot.hasVietnameseVoice,
    stopAllAudioAndVoice,
    resetQuestionDrafts,
    startQuestionTimer,
  ]);

  // ---- END TOURNAMENT EARLY ("Giải chưa hoàn tất", NO TROPHY) ----
  const handleConfirmEndEarly = useCallback(() => {
    if (!gameState) return;
    stopAllAudioAndVoice();
    const ended = endGroupChallengeEarly(gameState);
    setGameState(ended);
    setShowEndEarlyConfirm(false);
    setUiPhase('summary');
    soundBankRef.current?.playChallengeTournamentFinish(isMuted, false, false);
  }, [gameState, isMuted, stopAllAudioAndVoice]);

  // ---- REPLAY / RETURN TO SETUP ----
  const handleReplay = useCallback(() => {
    stopAllAudioAndVoice();
    clearD07Session();
    setSavedSession(null);
    if (gameState) {
      setConfig({
        ...gameState.config,
        rulesLocked: false,
      });
    }
    setGameState(null);
    setUiPhase('round_briefing');
    setShowKnowledgeReview(false);
    setShowScheduleDrawer(false);
    setShowStandingsDrawer(false);
    setShowEndEarlyConfirm(false);
  }, [gameState, stopAllAudioAndVoice]);

  // ---- KEYBOARD SHORTCUTS (Teacher Projector Flow) ----
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.key === 'Escape') {
        setZoomQuestion(null);
        setShowScheduleDrawer(false);
        setShowStandingsDrawer(false);
        setShowKnowledgeReview(false);
        setShowEndEarlyConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ============================================================================
  // SHARED TOP BAR (A01 / A02 / D04 / D05 CONSISTENT)
  // ============================================================================

  const renderTopBar = () => (
    <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#071226] border-b border-teal-500/25 text-white">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleExitToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/80 text-xs font-bold text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về thư viện</span>
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/50 text-teal-300 text-xs font-black tracking-wide shrink-0">
            D07
          </span>
          <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white truncate">
            Thách đấu nhóm 3D
          </h1>
          {isDemo && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[11px] font-bold">
              Bản demo KHKT
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* 3D / 2D Lightweight Toggle */}
        <button
          type="button"
          onClick={() => setUse3D((v) => !v)}
          title={
            webglAutoFallback
              ? 'Trình duyệt tự chuyển sang chế độ 2D nhẹ do WebGL không khả dụng'
              : 'Chuyển giữa sân đấu 3D và giao diện 2D nhẹ cho máy cấu hình thấp'
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            use3D && !webglAutoFallback
              ? 'bg-teal-500/20 border-teal-400/50 text-teal-200'
              : 'bg-slate-800 border-slate-600 text-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{use3D && !webglAutoFallback ? '3D' : '2D nhẹ'}</span>
        </button>

        {/* Reduced Motion Toggle */}
        <button
          type="button"
          onClick={() => setReducedMotion((v) => !v)}
          title="Giảm chuyển động 3D khi trình chiếu"
          className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            reducedMotion
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{reducedMotion ? 'Giảm chuyển động' : 'Hiệu ứng'}</span>
        </button>

        {/* Strict Vietnamese Voice Toggle */}
        <button
          type="button"
          onClick={handleToggleVoice}
          title={
            voiceSnapshot.hasVietnameseVoice
              ? 'Bật/tắt giọng đọc tiếng Việt (vi-VN)'
              : 'Thiết bị chưa có giọng đọc tiếng Việt (không đọc tiếng Anh thay thế)'
          }
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            voiceEnabled && voiceSnapshot.hasVietnameseVoice && !isMuted
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
              : 'bg-slate-800 border-slate-600 text-slate-400'
          }`}
        >
          {voiceEnabled && voiceSnapshot.hasVietnameseVoice && !isMuted ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Giọng VI</span>
        </button>

        {/* Speaker Mute Button (A01/A02 Consistent) */}
        <button
          type="button"
          onClick={handleToggleMute}
          aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          title={isMuted ? 'Đang tắt âm thanh — bấm để bật' : 'Đang bật âm thanh — bấm để tắt ngay'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
            isMuted
              ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
              : 'bg-yellow-400/20 border-yellow-400/60 text-yellow-200'
          }`}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
        </button>

        {/* Fullscreen Button */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Trình chiếu toàn màn hình'}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-100 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        )}
      </div>
    </header>
  );

  // ============================================================================
  // VIEW 1: SETUP SCREEN (Before Tournament Starts)
  // ============================================================================

  if (!gameState) {
    return (
      <div className="flex flex-col h-full min-h-[640px] bg-[#061021] text-slate-100 rounded-2xl overflow-hidden border border-teal-500/25 shadow-2xl">
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Corrupt storage auto-recovery notice */}
            {recoveredNotice && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-100 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>
                    Dữ liệu phiên lưu trước đó bị lỗi định dạng và đã được tự động dọn sạch an toàn.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRecoveredNotice(false)}
                  className="text-amber-200 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Resume saved tournament banner */}
            {savedSession && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-teal-500/15 border border-teal-400/45">
                <div>
                  <div className="text-sm font-extrabold text-teal-200">
                    Có phiên D07 đang lưu dở (
                    {savedSession.config.mode === 'solo_practice'
                      ? 'Tự luyện cá nhân'
                      : `${savedSession.config.teams.length} đội · Vòng ${
                          savedSession.currentRoundIndex + 1
                        }/${savedSession.rounds.length}`}
                    )
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Đã chấm {savedSession.questionHistory.length}/
                    {savedSession.totalQuestionsRequired} câu hỏi · Trạng thái:{' '}
                    {savedSession.status === 'playing'
                      ? 'Đang thi đấu'
                      : savedSession.endedEarly
                      ? 'Giải chưa hoàn tất'
                      : 'Đã hoàn thành'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSavedSession}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#071226] text-xs font-extrabold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Tiếp tục phiên đã lưu</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearD07Session();
                      setSavedSession(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
                  >
                    Xóa phiên cũ
                  </button>
                </div>
              </div>
            )}

            {/* Hero Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#0B1D3A] via-[#0F274B] to-[#0B1D3A] border border-teal-500/35">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-teal-300">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span>Giải đấu vòng tròn trên một máy · 1–50 học sinh</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                  Thiết lập giải Thách đấu nhóm 3D
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Mỗi cặp đội gặp nhau đúng 1 lần, cùng giải bộ câu hỏi theo vòng và xếp hạng theo
                  tổng điểm giải (Thắng 3 · Hòa 1 · Thua 0). Chỉ cần đặt tên đội hoặc nhãn tạm.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex rounded-xl bg-[#071226] p-1 border border-slate-700 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = createDefaultGroupChallengeConfig('round_robin', 4);
                    setConfig((prev) => ({
                      ...next,
                      sourceKind: prev.sourceKind,
                      timerSeconds: prev.timerSeconds,
                    }));
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                    config.mode === 'round_robin'
                      ? 'bg-teal-500 text-[#071226]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Giải 2–6 đội</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = createDefaultGroupChallengeConfig('solo_practice', 1);
                    setConfig((prev) => ({
                      ...next,
                      sourceKind: prev.sourceKind,
                      timerSeconds: prev.timerSeconds,
                    }));
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors ${
                    config.mode === 'solo_practice'
                      ? 'bg-yellow-400 text-[#071226]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>Tự luyện 1 HS</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* LEFT COLUMN: Teams + Question Source */}
              <div className="lg:col-span-7 space-y-5">
                {/* Team Setup (Round-Robin) */}
                {config.mode === 'round_robin' ? (
                  <section className="p-4 sm:p-5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                          <Users className="w-4 h-4 text-teal-400" />
                          <span>Số đội tham gia &amp; tên đội (không cần email)</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Hỗ trợ 2 đến 6 đội; có thể chia lớp 1–50 học sinh vào các đội hoặc đặt
                          nhãn tạm.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            teams: prev.teams.map((t, i) => ({ ...t, name: `Đội ${i + 1}` })),
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-slate-200"
                      >
                        Dùng nhãn Đội 1–{config.teams.length}
                      </button>
                    </div>

                    {/* Team count buttons 2..6 */}
                    <div className="grid grid-cols-5 gap-2">
                      {[2, 3, 4, 5, 6].map((cnt) => {
                        const active = config.teams.length === cnt;
                        return (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                teams: createChallengeTeams(
                                  cnt,
                                  prev.teams.map((t) => t.name)
                                ),
                              }))
                            }
                            className={`py-2.5 rounded-xl border text-center transition-all ${
                              active
                                ? 'bg-teal-500/20 border-teal-400 text-white font-black'
                                : 'bg-[#071226] border-slate-700 text-slate-300 hover:border-slate-500 font-bold'
                            }`}
                          >
                            <div className="text-base">{cnt} đội</div>
                            <div className="text-[10px] text-slate-400">
                              {cnt % 2 === 1 ? 'Có đội nghỉ' : `${cnt / 2} cặp/vòng`}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Team name inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {config.teams.map((team, idx) => {
                        const pal = getPalette(team.paletteIndex);
                        return (
                          <div
                            key={team.id}
                            className="flex items-center gap-2 p-2 rounded-xl bg-[#071226] border border-slate-700/90"
                          >
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                              style={{ backgroundColor: pal.hex, color: pal.textOnSolid }}
                            >
                              {team.teamNumber}
                            </span>
                            <input
                              type="text"
                              value={team.name}
                              maxLength={32}
                              placeholder={`Đội ${idx + 1}`}
                              onChange={(e) => {
                                const val = e.target.value;
                                setConfig((prev) => ({
                                  ...prev,
                                  teams: prev.teams.map((t) =>
                                    t.id === team.id ? { ...t, name: val } : t
                                  ),
                                }));
                              }}
                              className="w-full bg-transparent text-sm font-bold text-white placeholder-slate-500 focus:outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <section className="p-4 sm:p-5 rounded-2xl bg-[#0B1B34] border border-yellow-400/35 space-y-3">
                    <div className="flex items-center gap-2 text-yellow-300 font-extrabold text-sm">
                      <User className="w-4 h-4" />
                      <span>Chế độ Tự luyện 1 học sinh (không tạo đối thủ ảo)</span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Học sinh tự chọn đáp án hoặc nhập kết quả từng câu hỏi, xem đáp án và lời giải
                      chi tiết ngay sau mỗi câu. Không chấm điểm vòng tròn giả lập.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs font-bold text-slate-300 shrink-0">Tên người luyện:</span>
                      <input
                        type="text"
                        value={config.teams[0]?.name || ''}
                        maxLength={32}
                        placeholder="Học sinh tự luyện"
                        onChange={(e) => {
                          const val = e.target.value;
                          setConfig((prev) => ({
                            ...prev,
                            teams: prev.teams.map((t, i) => (i === 0 ? { ...t, name: val } : t)),
                          }));
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-[#071226] border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </section>
                )}

                {/* Question Source Selector */}
                <section className="p-4 sm:p-5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-yellow-400" />
                    <span>Nguồn câu hỏi thi đấu</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        config.sourceKind === 'sample'
                          ? 'bg-teal-500/20 border-teal-400'
                          : 'bg-[#071226] border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-white">{D07_SAMPLE_PACK_TITLE}</span>
                        <span className="px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-300 text-[10px] font-bold">
                          {D07_SAMPLE_BADGE}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        15 câu Toán THCS chuẩn KaTeX (đủ cho 6 đội × 5 vòng × 3 câu không lặp).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'bank' }))}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        config.sourceKind === 'bank'
                          ? 'bg-teal-500/20 border-teal-400'
                          : 'bg-[#071226] border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-white">Ngân hàng câu hỏi</span>
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-teal-200 text-[10px] font-bold">
                          {bankFacets.totalBankCount} câu
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1">
                        Dùng câu hỏi Smart EDU theo phân quyền hiện có, lọc theo môn, lớp và mức độ.
                      </p>
                    </button>
                  </div>

                  {/* Bank Filters */}
                  {config.sourceKind === 'bank' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Môn học
                        </label>
                        <select
                          value={config.subjectFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả môn</option>
                          {bankFacets.subjects.map((s) => (
                            <option key={s} value={s}>
                              {subjectLabel(s)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Lớp</label>
                        <select
                          value={config.gradeFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả lớp</option>
                          {bankFacets.grades.map((g) => (
                            <option key={g} value={g}>
                              Lớp {g}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Mức độ
                        </label>
                        <select
                          value={config.levelFilter}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, levelFilter: e.target.value }))
                          }
                          className="w-full px-2.5 py-2 rounded-lg bg-[#071226] border border-slate-700 text-xs font-bold text-white"
                        >
                          <option value="all">Tất cả mức độ</option>
                          {bankFacets.levels.map((lv) => (
                            <option key={lv} value={lv}>
                              {levelLabel(lv)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </section>
              </div>

              {/* RIGHT COLUMN: Rules + Pre-start Tournament Summary */}
              <div className="lg:col-span-5 space-y-5">
                <section className="p-4 sm:p-5 rounded-2xl bg-[#0B1B34] border border-slate-700/80 space-y-4">
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span>Luật thi đấu (khóa sau khi bắt đầu)</span>
                  </h3>

                  {/* Questions per match (or solo question count) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      {config.mode === 'round_robin'
                        ? 'Số câu hỏi mỗi trận (mặc định 3 câu)'
                        : 'Số câu tự luyện'}
                    </label>
                    {config.mode === 'round_robin' ? (
                      <div className="grid grid-cols-3 gap-2">
                        {([1, 3, 5] as const).map((qpm) => (
                          <button
                            key={qpm}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({ ...prev, questionsPerMatch: qpm }))
                            }
                            className={`py-2 rounded-lg border text-xs font-extrabold transition-colors ${
                              config.questionsPerMatch === qpm
                                ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                : 'bg-[#071226] text-slate-200 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {qpm} câu/trận
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5">
                        {[3, 5, 8, 10, 15].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({ ...prev, soloQuestionCount: cnt }))
                            }
                            className={`py-2 rounded-lg border text-xs font-extrabold transition-colors ${
                              config.soloQuestionCount === cnt
                                ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                                : 'bg-[#071226] text-slate-200 border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {cnt} câu
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timer per question */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Thời gian trả lời mỗi câu (mặc định 30 giây)
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[0, 15, 20, 30, 45, 60].map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, timerSeconds: sec }))}
                          className={`py-2 rounded-lg border text-xs font-extrabold transition-colors ${
                            config.timerSeconds === sec
                              ? 'bg-teal-500 text-[#071226] border-teal-300'
                              : 'bg-[#071226] text-slate-200 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {sec === 0 ? 'Không GH' : `${sec}s`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shuffle checkboxes */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#071226] border border-slate-700 cursor-pointer text-xs font-bold text-slate-200">
                      <input
                        type="checkbox"
                        checked={config.shuffleQuestions}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                        }
                        className="accent-teal-400 w-4 h-4"
                      />
                      <span>Trộn câu cân bằng</span>
                    </label>
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#071226] border border-slate-700 cursor-pointer text-xs font-bold text-slate-200">
                      <input
                        type="checkbox"
                        checked={config.shuffleOptions}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                        }
                        className="accent-teal-400 w-4 h-4"
                      />
                      <span>Đảo phương án A–D</span>
                    </label>
                  </div>
                </section>

                {/* Pre-Start Tournament Summary Card */}
                <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#0E2444] to-[#091830] border border-teal-400/40 space-y-3.5">
                  <h3 className="text-sm font-extrabold text-teal-200 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-yellow-400" />
                    <span>Tóm tắt trước khi bắt đầu</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-[#071226]/90 border border-slate-700/80">
                      <div className="text-[11px] text-slate-400 font-semibold">Số vòng đấu</div>
                      <div className="text-lg font-black text-white">
                        {setupValidation.roundCount} vòng
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#071226]/90 border border-slate-700/80">
                      <div className="text-[11px] text-slate-400 font-semibold">Tổng số trận</div>
                      <div className="text-lg font-black text-white">
                        {config.mode === 'solo_practice'
                          ? 'Tự luyện'
                          : `${setupValidation.matchesTotal} trận`}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#071226]/90 border border-slate-700/80">
                      <div className="text-[11px] text-slate-400 font-semibold">
                        Câu cần dùng / Hiện có
                      </div>
                      <div
                        className={`text-lg font-black ${
                          availablePool.length >= setupValidation.requiredQuestions
                            ? 'text-teal-300'
                            : 'text-rose-400'
                        }`}
                      >
                        {setupValidation.requiredQuestions} / {availablePool.length} câu
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#071226]/90 border border-slate-700/80">
                      <div className="text-[11px] text-slate-400 font-semibold">Đội nghỉ mỗi vòng</div>
                      <div className="text-sm font-extrabold text-amber-200 mt-1">
                        {config.mode === 'solo_practice'
                          ? 'Không áp dụng'
                          : setupValidation.hasByePerRound
                          ? '1 đội nghỉ / vòng'
                          : 'Không có đội nghỉ'}
                      </div>
                    </div>
                  </div>

                  {/* Validation Errors & Quick Fix */}
                  {setupValidation.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/50 space-y-2">
                      {setupValidation.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-rose-200">
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          <span>{err}</span>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {setupValidation.suggestedQuestionsPerMatch && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                questionsPerMatch: setupValidation.suggestedQuestionsPerMatch!,
                              }))
                            }
                            className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-[#071226] text-xs font-extrabold"
                          >
                            Giảm xuống {setupValidation.suggestedQuestionsPerMatch} câu/trận
                          </button>
                        )}
                        {config.sourceKind === 'bank' && (
                          <button
                            type="button"
                            onClick={() => setConfig((prev) => ({ ...prev, sourceKind: 'sample' }))}
                            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#071226] text-xs font-extrabold"
                          >
                            Chuyển sang bộ mẫu 15 câu
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {setupValidation.warnings.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-xs text-amber-100 space-y-1">
                      {setupValidation.warnings.map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!setupValidation.valid}
                    onClick={handleStartTournament}
                    className={`w-full py-3.5 rounded-xl font-black text-sm tracking-wide flex items-center justify-center gap-2 transition-all ${
                      setupValidation.valid
                        ? 'bg-gradient-to-r from-teal-400 via-emerald-400 to-yellow-400 hover:brightness-105 text-[#071226] shadow-lg'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {config.mode === 'solo_practice'
                        ? 'Bắt đầu tự luyện'
                        : `Bắt đầu giải vòng tròn (${config.teams.length} đội)`}
                    </span>
                  </button>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: ACTIVE TOURNAMENT / SOLO PRACTICE / SUMMARY
  // ============================================================================

  const isSummary = uiPhase === 'summary';
  const scenePhase: ChallengeArenaPhase = uiPhase;
  const totalRoundsDisplay =
    gameState.config.mode === 'solo_practice' ? 1 : gameState.rounds.length;
  const qPerMatchDisplay =
    gameState.config.mode === 'solo_practice'
      ? gameState.questionOrder.length
      : gameState.config.questionsPerMatch;

  return (
    <div className="relative flex flex-col h-full min-h-[660px] bg-[#061021] text-slate-100 rounded-2xl overflow-hidden border border-teal-500/25 shadow-2xl">
      {renderTopBar()}

      {/* Toast / Voice Notice Strip */}
      {(toastMessage || voiceNotice) && (
        <div className="px-4 py-2 bg-[#0D2140] border-b border-teal-400/35 flex items-center justify-between gap-2 text-xs font-bold text-teal-100">
          <span>{toastMessage || voiceNotice}</span>
          <button
            type="button"
            onClick={() => {
              setToastMessage(null);
              setVoiceNotice(null);
            }}
            className="text-slate-300 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Scrollable Stage */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
        <div className="max-w-6xl mx-auto space-y-3.5">
          {/* 3D / 2D Arena Stage (Compact during question play so Math takes focus; taller on summary podium) */}
          <div
            className={`w-full transition-all ${
              uiPhase === 'summary'
                ? 'h-[240px] sm:h-[270px]'
                : uiPhase === 'answering'
                ? 'h-[165px] sm:h-[185px]'
                : 'h-[190px] sm:h-[215px]'
            }`}
          >
            <GroupChallenge3DScene
              mode={gameState.config.mode}
              phase={scenePhase}
              roundNumber={gameState.currentRoundIndex + 1}
              totalRounds={totalRoundsDisplay}
              questionNumberInRound={gameState.currentQuestionInRound + 1}
              questionsPerMatch={qPerMatchDisplay}
              activeMatchups={activeMatchupsVisual}
              byeTeam={currentByeTeam}
              standings={standings}
              trophyAwarded={gameState.trophyAwarded}
              endedEarly={gameState.endedEarly}
              soloCorrectCount={soloStats.correct}
              soloTotalAnswered={soloStats.totalAnswered}
              use3D={use3D && !webglAutoFallback}
              reducedMotion={reducedMotion}
              revealPulseKey={revealPulseKey}
              onWebGLUnavailable={() => setWebglAutoFallback(true)}
            />
          </div>

          {/* Tournament Utility Action Bar (Schedule & Standings drawers collapsed by default during answering) */}
          {uiPhase !== 'summary' && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B1B34] border border-slate-700/80">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                {gameState.config.mode === 'round_robin' ? (
                  <>
                    <span className="px-2.5 py-1 rounded-md bg-teal-500/20 border border-teal-400/40 text-teal-200">
                      Vòng {gameState.currentRoundIndex + 1}/{gameState.rounds.length}
                    </span>
                    <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-600 text-slate-200">
                      Câu {gameState.currentQuestionInRound + 1}/{gameState.config.questionsPerMatch}
                    </span>
                    <span className="hidden sm:inline text-slate-400">
                      Đã chấm {gameState.questionHistory.length}/{gameState.totalQuestionsRequired}{' '}
                      câu
                    </span>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-md bg-yellow-400/20 border border-yellow-400/40 text-yellow-200">
                      Tự luyện · Câu {gameState.currentQuestionInRound + 1}/
                      {gameState.questionOrder.length}
                    </span>
                    <span className="text-slate-300">
                      Đúng {soloStats.correct}/{soloStats.totalAnswered} câu
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {gameState.config.mode === 'round_robin' && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowScheduleDrawer((v) => !v);
                        setShowStandingsDrawer(false);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        showScheduleDrawer
                          ? 'bg-teal-500 text-[#071226] border-teal-300'
                          : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>Lịch đấu</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowStandingsDrawer((v) => !v);
                        setShowScheduleDrawer(false);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                        showStandingsDrawer
                          ? 'bg-yellow-400 text-[#071226] border-yellow-300'
                          : 'bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700'
                      }`}
                    >
                      <ListOrdered className="w-3.5 h-3.5" />
                      <span>Bảng xếp hạng</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowEndEarlyConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/45 text-rose-200 text-xs font-bold transition-colors"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Kết thúc sớm</span>
                </button>
              </div>
            </div>
          )}

          {/* Collapsible Schedule Panel (Closed by default during answering) */}
          {showScheduleDrawer && gameState.config.mode === 'round_robin' && uiPhase !== 'summary' && (
            <div className="p-4 rounded-2xl bg-[#0B1B34] border border-teal-400/40 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-teal-200 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-yellow-400" />
                  <span>Lịch đấu vòng tròn toàn giải ({gameState.rounds.length} vòng)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowScheduleDrawer(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {gameState.rounds.map((r) => {
                  const isCurrent = r.roundIndex === gameState.currentRoundIndex;
                  const bye = r.byeTeamId ? teamMap[r.byeTeamId] : null;
                  return (
                    <div
                      key={r.roundIndex}
                      className={`p-3 rounded-xl border ${
                        isCurrent
                          ? 'bg-teal-500/15 border-teal-400/60'
                          : 'bg-[#071226] border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-extrabold mb-2">
                        <span className={isCurrent ? 'text-teal-200' : 'text-slate-300'}>
                          Vòng {r.roundIndex + 1}
                        </span>
                        {bye && (
                          <span className="text-[11px] font-semibold text-amber-300">
                            Nghỉ: {bye.name}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {r.matches.map((m) => {
                          const mr = gameState.matchResults[m.matchId];
                          return (
                            <div
                              key={m.matchId}
                              className="flex items-center justify-between gap-2 text-xs bg-slate-900/75 px-2.5 py-1.5 rounded-lg"
                            >
                              <span className="truncate font-semibold text-slate-200 flex-1">
                                {teamMap[m.teamAId]?.name}
                              </span>
                              <span className="font-black text-yellow-300 shrink-0">
                                {mr ? `${mr.scoreA}–${mr.scoreB}` : 'vs'}
                              </span>
                              <span className="truncate font-semibold text-slate-200 flex-1 text-right">
                                {teamMap[m.teamBId]?.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collapsible Live Standings Panel */}
          {showStandingsDrawer && gameState.config.mode === 'round_robin' && uiPhase !== 'summary' && (
            <div className="p-4 rounded-2xl bg-[#0B1B34] border border-yellow-400/40 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-yellow-300 flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  <span>Bảng xếp hạng hiện tại (Xếp theo điểm giải · Thắng 3 · Hòa 1 · Thua 0)</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowStandingsDrawer(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400">
                      <th className="py-2 pr-2">Hạng</th>
                      <th className="py-2 pr-2">Đội</th>
                      <th className="py-2 px-2 text-center">Điểm giải</th>
                      <th className="py-2 px-2 text-center">Số trận</th>
                      <th className="py-2 px-2 text-center">T–H–B</th>
                      <th className="py-2 pl-2 text-right">Câu đúng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row) => {
                      const pal = getPalette(row.paletteIndex);
                      return (
                        <tr key={row.teamId} className="border-b border-slate-800/80">
                          <td className="py-2 pr-2 font-black text-yellow-300">
                            {row.isTied ? `Đồng hạng #${row.rank}` : `#${row.rank}`}
                          </td>
                          <td className="py-2 pr-2 font-bold text-white flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: pal.hex }}
                            />
                            <span>{row.name}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-black text-teal-300">
                            {row.tournamentPoints}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-300">
                            {row.matchesCompleted}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-300">
                            {row.wins}–{row.draws}–{row.losses}
                          </td>
                          <td className="py-2 pl-2 text-right font-bold text-slate-200">
                            {row.totalCorrect}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* PHASE A: ROUND BRIEFING (Round-Robin)                            */}
          {/* ================================================================ */}
          {uiPhase === 'round_briefing' && currentRound && (
            <section className="p-5 sm:p-6 rounded-2xl bg-[#0B1B34] border border-teal-400/45 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-teal-300">
                    Sắp bắt đầu vòng thi đấu
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                    Vòng {currentRound.roundIndex + 1} / {gameState.rounds.length}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1">
                    Các cặp đội thi đấu đồng thời <strong>{gameState.config.questionsPerMatch} câu hỏi</strong>{' '}
                    (mỗi câu đúng +1 trong trận; chốt trận Thắng 3 · Hòa 1 · Thua 0 điểm giải).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleBeginRoundFromBriefing}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-yellow-400 hover:brightness-105 text-[#071226] text-sm font-black shadow-lg"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Bắt đầu vòng {currentRound.roundIndex + 1}</span>
                </button>
              </div>

              <div
                className={`grid gap-3 ${
                  activeMatchupsVisual.length === 1
                    ? 'grid-cols-1 max-w-xl mx-auto'
                    : activeMatchupsVisual.length === 2
                    ? 'grid-cols-1 md:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-3'
                }`}
              >
                {activeMatchupsVisual.map((m) => {
                  const palA = getPalette(m.teamA.paletteIndex);
                  const palB = getPalette(m.teamB.paletteIndex);
                  return (
                    <div
                      key={m.matchId}
                      className="p-4 rounded-xl bg-[#071226] border border-teal-500/35 space-y-2.5"
                    >
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-teal-300">
                        Cặp đấu {m.pairIndex + 1}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 p-2.5 rounded-lg text-center font-extrabold text-sm truncate"
                             style={{ backgroundColor: palA.hex, color: palA.textOnSolid }}>
                          {m.teamA.name}
                        </div>
                        <span className="px-2 text-xs font-black text-yellow-400">VS</span>
                        <div className="flex-1 p-2.5 rounded-lg text-center font-extrabold text-sm truncate"
                             style={{ backgroundColor: palB.hex, color: palB.textOnSolid }}>
                          {m.teamB.name}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {currentByeTeam && (
                <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-100">
                    <HelpCircle className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>
                      Đội nghỉ vòng này: <strong className="text-yellow-300">{currentByeTeam.name}</strong>
                    </span>
                  </div>
                  <span className="text-xs text-amber-200/90">
                    Có thể làm bài trên giấy để luyện tập; không tính điểm thi đấu hay số trận ở vòng này.
                  </span>
                </div>
              )}
            </section>
          )}

          {/* ================================================================ */}
          {/* PHASE B: ANSWERING (Question & KaTeX MathView Take Primary Stage)*/}
          {/* ================================================================ */}
          {uiPhase === 'answering' && currentQuestion && (
            <section className="p-5 sm:p-6 rounded-2xl bg-white text-slate-900 border-2 border-teal-500/60 shadow-xl space-y-4">
              {/* Question Header & Timer Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#071226] text-yellow-300 text-xs font-black">
                    Câu {gameState.currentQuestionInRound + 1} / {qPerMatchDisplay}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
                    {currentQuestion.topic || subjectLabel(currentQuestion.subject)} · Lớp{' '}
                    {currentQuestion.grade}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                    {levelLabel(currentQuestion.level)}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                    {currentQuestion.sourceBadge}
                  </span>
                </div>

                {/* Timer + Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-sm border ${
                      gameState.config.timerSeconds <= 0
                        ? 'bg-slate-100 border-slate-300 text-slate-700'
                        : isPaused
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : remainingSeconds <= 5
                        ? 'bg-rose-100 border-rose-400 text-rose-700'
                        : 'bg-[#071226] border-teal-500 text-teal-300'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>
                      {gameState.config.timerSeconds <= 0
                        ? 'Không giới hạn'
                        : isPaused
                        ? `Tạm dừng (${remainingSeconds}s)`
                        : `${remainingSeconds}s`}
                    </span>
                  </div>

                  {gameState.config.timerSeconds > 0 && (
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800"
                    >
                      {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setZoomQuestion(currentQuestion)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-bold text-slate-800"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Phóng to</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSpeakQuestion}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-300 text-xs font-bold text-teal-900"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Đọc câu hỏi</span>
                  </button>
                </div>
              </div>

              {/* Pause Overlay Banner */}
              {isPaused && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                  <span>
                    Đang tạm dừng đồng hồ ({remainingSeconds}s còn lại) — khóa thao tác xác nhận cho
                    đến khi tiếp tục.
                  </span>
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-white font-extrabold"
                  >
                    Tiếp tục ngay
                  </button>
                </div>
              )}

              {/* Question Stem (Large Projector Typography + Shared KaTeX MathView) */}
              <div className="text-xl sm:text-2xl font-bold leading-relaxed text-slate-900 overflow-x-auto">
                <MathView content={currentQuestion.stem} />
              </div>

              {currentQuestion.image && (
                <div className="flex justify-center">
                  <img
                    src={currentQuestion.image}
                    alt="Hình minh họa câu hỏi"
                    className="max-h-56 rounded-xl border border-slate-200 object-contain"
                  />
                </div>
              )}

              {/* Options Display (Interactive in Solo Mode, Projector Clear Grid in Round-Robin) */}
              {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {currentQuestion.options.map((opt) => {
                    const isPickedSolo =
                      gameState.config.mode === 'solo_practice' && soloSelectedOptionId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={gameState.config.mode !== 'solo_practice' || isPaused}
                        onClick={() => setSoloSelectedOptionId(opt.id)}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          isPickedSolo
                            ? 'bg-teal-50 border-teal-600 shadow-sm'
                            : 'bg-slate-50 border-slate-200 hover:border-teal-400'
                        } ${gameState.config.mode !== 'solo_practice' ? 'cursor-default' : ''}`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                            isPickedSolo
                              ? 'bg-teal-600 text-white'
                              : 'bg-[#071226] text-yellow-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <div className="text-base sm:text-lg font-semibold text-slate-900 pt-0.5 overflow-x-auto flex-1">
                          <MathView content={opt.text} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {currentQuestion.type === 'true_false_group' && currentQuestion.subItems && (
                <div className="space-y-2.5 pt-1">
                  {currentQuestion.subItems.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200"
                    >
                      <div className="text-base font-semibold text-slate-900 flex items-start gap-2 flex-1">
                        <span className="font-black text-teal-700">{sub.label})</span>
                        <MathView content={sub.text} />
                      </div>
                      {gameState.config.mode === 'solo_practice' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={() =>
                              setSoloTrueFalseMap((prev) => ({ ...prev, [sub.id]: true }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                              soloTrueFalseMap[sub.id] === true
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-300'
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border ${
                              soloTrueFalseMap[sub.id] === false
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                          >
                            Sai
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(currentQuestion.type === 'short_answer' || currentQuestion.type === 'essay') &&
                gameState.config.mode === 'solo_practice' && (
                  <div className="pt-1">
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Nhập câu trả lời của em:
                    </label>
                    <input
                      type="text"
                      disabled={isPaused}
                      value={soloShortAnswer}
                      onChange={(e) => setSoloShortAnswer(e.target.value)}
                      placeholder="Nhập kết quả..."
                      className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-300 focus:border-teal-600 focus:outline-none text-base font-bold text-slate-900"
                    />
                  </div>
                )}

              {/* Bottom Action Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                <p className="text-xs text-slate-500 font-semibold">
                  {gameState.config.mode === 'round_robin'
                    ? 'Các cặp đội viết đáp án ra bảng con hoặc giấy nháp, sau đó giáo viên bấm dừng trả lời để chấm.'
                    : timerExpired
                    ? 'Hết giờ — em vẫn có thể chốt đáp án hoặc xem lời giải.'
                    : 'Chọn phương án rồi bấm "Chốt đáp án" để kiểm tra.'}
                </p>

                {gameState.config.mode === 'round_robin' ? (
                  <button
                    type="button"
                    disabled={isPaused}
                    onClick={handleOpenJudging}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      isPaused
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-[#071226] hover:bg-[#0D2140] text-yellow-300 shadow-md'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Dừng trả lời · Chấm điểm các cặp</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isPaused}
                    onClick={handleSubmitSoloAnswer}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      isPaused
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-500 text-white shadow-md'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Chốt đáp án</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* PHASE C: JUDGING (Fixed-Position Matchup Pair Grading Cards)     */}
          {/* ================================================================ */}
          {uiPhase === 'judging' && currentQuestion && gameState.config.mode === 'round_robin' && (
            <section className="space-y-3.5">
              {/* Compact Question + Answer Reveal Card */}
              <div className="p-4 rounded-2xl bg-white text-slate-900 border border-teal-500/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-[#071226] text-yellow-300 text-xs font-black">
                      {isEditingLastQuestion
                        ? 'Sửa kết quả câu vừa chấm'
                        : `Chấm điểm Câu ${gameState.currentQuestionInRound + 1}/${qPerMatchDisplay}`}
                    </span>
                    {timerExpired && !isEditingLastQuestion && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold">
                        Hết giờ — vẫn chấm đầy đủ đáp án các đội viết trước khi hết giờ
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setZoomQuestion(currentQuestion)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Phóng to</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOfficialAnswer((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-extrabold"
                    >
                      {showOfficialAnswer ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                      <span>{showOfficialAnswer ? 'Ẩn đáp án' : 'Công bố đáp án & lời giải'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-base sm:text-lg font-bold text-slate-900 overflow-x-auto">
                  <MathView content={currentQuestion.stem} />
                </div>

                {showOfficialAnswer && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 space-y-1">
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      Đáp án đúng:{' '}
                      <span className="text-sm font-black text-emerald-950 normal-case">
                        <MathView content={currentQuestion.officialAnswerText} />
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-emerald-900 overflow-x-auto">
                      <MathView content={currentQuestion.explanation} />
                    </div>
                  </div>
                )}
              </div>

              {/* FIXED-POSITION MATCHUP PAIR GRADING CARDS (Never reorder!) */}
              <div
                className={`grid gap-3 ${
                  activeMatchupsVisual.length === 1
                    ? 'grid-cols-1 max-w-2xl mx-auto'
                    : activeMatchupsVisual.length === 2
                    ? 'grid-cols-1 lg:grid-cols-2'
                    : 'grid-cols-1 lg:grid-cols-3'
                }`}
              >
                {activeMatchupsVisual.map((m) => (
                  <div
                    key={m.matchId}
                    className="p-4 rounded-2xl bg-[#0B1B34] border border-teal-500/35 space-y-3"
                  >
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                        Cặp đấu {m.pairIndex + 1}
                      </span>
                      <span className="text-xs font-extrabold text-yellow-300">
                        Tỉ số hiện tại: {m.scoreA} – {m.scoreB}
                      </span>
                    </div>

                    {[m.teamA, m.teamB].map((team) => {
                      const pal = getPalette(team.paletteIndex);
                      const verdict = draftVerdicts[team.id] || 'ungraded';
                      const pickedOpt = draftSelectedOpts[team.id];
                      return (
                        <div
                          key={team.id}
                          className={`p-3 rounded-xl border transition-colors ${
                            verdict === 'ungraded'
                              ? 'bg-[#071226] border-amber-400/50'
                              : verdict === 'correct'
                              ? 'bg-emerald-950/50 border-emerald-400/60'
                              : verdict === 'incorrect'
                              ? 'bg-rose-950/40 border-rose-400/55'
                              : 'bg-slate-900/90 border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: pal.hex }}
                              />
                              <span className="text-sm font-extrabold text-white truncate">
                                {team.name}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-black shrink-0 ${
                                verdict === 'ungraded'
                                  ? 'bg-amber-400/20 text-amber-200'
                                  : verdict === 'correct'
                                  ? 'bg-emerald-500/25 text-emerald-200'
                                  : verdict === 'incorrect'
                                  ? 'bg-rose-500/25 text-rose-200'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {verdict === 'ungraded'
                                ? 'Chưa chấm'
                                : verdict === 'correct'
                                ? 'Đúng (+1)'
                                : verdict === 'incorrect'
                                ? 'Chưa đúng (0)'
                                : 'Không TL (0)'}
                            </span>
                          </div>

                          {/* Quick A–D Option Buttons on single_choice */}
                          {currentQuestion.type === 'single_choice' && currentQuestion.options && (
                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                              {currentQuestion.options.map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleSetTeamOption(team.id, opt.id)}
                                  className={`py-1.5 rounded-lg text-xs font-black border transition-colors ${
                                    pickedOpt === opt.id
                                      ? opt.id === currentQuestion.correctOptionId
                                        ? 'bg-emerald-500 text-[#071226] border-emerald-300'
                                        : 'bg-rose-500 text-white border-rose-300'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                                  }`}
                                >
                                  Chọn {opt.label}
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Direct Verdict Buttons */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'correct')}
                              className={`py-1.5 rounded-lg text-xs font-extrabold border inline-flex items-center justify-center gap-1 ${
                                verdict === 'correct'
                                  ? 'bg-emerald-500 text-[#071226] border-emerald-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-emerald-200 border-slate-600'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Đúng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'incorrect')}
                              className={`py-1.5 rounded-lg text-xs font-extrabold border inline-flex items-center justify-center gap-1 ${
                                verdict === 'incorrect'
                                  ? 'bg-rose-500 text-white border-rose-300'
                                  : 'bg-slate-800 hover:bg-slate-700 text-rose-200 border-slate-600'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Chưa đúng</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetTeamVerdict(team.id, 'no_answer')}
                              className={`py-1.5 rounded-lg text-xs font-extrabold border ${
                                verdict === 'no_answer'
                                  ? 'bg-slate-400 text-[#071226] border-slate-200'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                              }`}
                            >
                              Không TL
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Bye Team Note & Confirm Grading Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0B1B34] border border-slate-700">
                <div className="text-xs text-slate-300">
                  {currentByeTeam ? (
                    <span>
                      Đội nghỉ vòng này: <strong className="text-amber-300">{currentByeTeam.name}</strong>{' '}
                      (không cần chấm điểm thi đấu).
                    </span>
                  ) : allActiveTeamsGraded ? (
                    <span className="text-emerald-300 font-bold">
                      Đã chấm đủ tất cả các đội thi đấu — sẵn sàng xác nhận.
                    </span>
                  ) : (
                    <span className="text-amber-200 font-bold">
                      Hãy chấm đủ tất cả đội đang ở trạng thái “Chưa chấm” trước khi xác nhận.
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isEditingLastQuestion && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingLastQuestion(false);
                        const isEndOfRound =
                          gameState.currentQuestionInRound >=
                          gameState.config.questionsPerMatch - 1;
                        setUiPhase(isEndOfRound ? 'round_summary' : 'question_done');
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
                    >
                      Hủy sửa
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!allActiveTeamsGraded || isPaused}
                    onClick={handleConfirmQuestionGrading}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                      allActiveTeamsGraded && !isPaused
                        ? 'bg-gradient-to-r from-teal-400 to-yellow-400 hover:brightness-105 text-[#071226] shadow-lg'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isEditingLastQuestion
                        ? 'Lưu chỉnh sửa & tính lại điểm'
                        : 'Xác nhận kết quả câu'}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* PHASE D: QUESTION DONE / ROUND SUMMARY                           */}
          {/* ================================================================ */}
          {(uiPhase === 'question_done' || uiPhase === 'round_summary') && currentQuestion && (
            <section className="space-y-4">
              {/* Updated Scores / Round Settlement Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#0B1B34] border border-yellow-400/45 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
                      {uiPhase === 'round_summary'
                        ? `Hoàn thành Vòng ${gameState.currentRoundIndex + 1} / ${gameState.rounds.length}`
                        : gameState.config.mode === 'solo_practice'
                        ? `Kết quả Câu ${gameState.currentQuestionInRound + 1} / ${qPerMatchDisplay}`
                        : `Đã cập nhật tỉ số Câu ${gameState.currentQuestionInRound + 1} / ${qPerMatchDisplay}`}
                    </span>
                    <h3 className="text-lg font-black text-white mt-0.5">
                      {uiPhase === 'round_summary'
                        ? 'Chốt tỉ số trận & cộng điểm giải đấu'
                        : gameState.config.mode === 'solo_practice'
                        ? gameState.questionHistory[gameState.questionHistory.length - 1]
                            ?.verdictsByTeam[gameState.config.teams[0].id] === 'correct'
                          ? 'Chính xác! Em đã trả lời đúng câu này.'
                          : 'Chưa chính xác — hãy xem lời giải chi tiết bên dưới.'
                        : 'Kết quả các cặp đấu sau câu vừa chấm'}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={stopAllAudioAndVoice}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
                    >
                      <FastForward className="w-3.5 h-3.5" />
                      <span>Bỏ qua hiệu ứng</span>
                    </button>

                    {gameState.config.mode === 'round_robin' && (
                      <button
                        type="button"
                        onClick={handleStartEditLastQuestion}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-extrabold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa kết quả câu vừa chấm</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Pair Score Cards (Round-Robin) */}
                {gameState.config.mode === 'round_robin' && (
                  <div
                    className={`grid gap-3 ${
                      activeMatchupsVisual.length === 1
                        ? 'grid-cols-1 max-w-xl mx-auto'
                        : activeMatchupsVisual.length === 2
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1 md:grid-cols-3'
                    }`}
                  >
                    {activeMatchupsVisual.map((m) => {
                      const palA = getPalette(m.teamA.paletteIndex);
                      const palB = getPalette(m.teamB.paletteIndex);
                      return (
                        <div
                          key={m.matchId}
                          className={`p-3.5 rounded-xl bg-[#071226] border ${
                            m.isCompleted ? 'border-yellow-400/70' : 'border-teal-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] font-bold mb-2">
                            <span className="text-teal-300">Cặp {m.pairIndex + 1}</span>
                            {m.isCompleted ? (
                              <span className="text-yellow-300 font-black">
                                {m.outcome === 'draw'
                                  ? 'Hòa (+1 / +1 điểm giải)'
                                  : m.outcome === 'teamA_win'
                                  ? `${m.teamA.name} thắng (+3 / +0)`
                                  : `${m.teamB.name} thắng (+0 / +3)`}
                              </span>
                            ) : (
                              <span className="text-slate-400">Đang đấu</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: palA.hex }}
                              />
                              <span className="text-sm font-extrabold text-white truncate">
                                {m.teamA.name}
                              </span>
                            </div>
                            <span className="px-3 py-1 rounded-lg bg-slate-900 border border-yellow-400/50 text-lg font-black text-yellow-300 shrink-0">
                              {m.scoreA} – {m.scoreB}
                            </span>
                            <div className="flex items-center justify-end gap-1.5 min-w-0 flex-1">
                              <span className="text-sm font-extrabold text-white truncate text-right">
                                {m.teamB.name}
                              </span>
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: palB.hex }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Official Answer & Explanation (MathView) */}
                <div className="p-3.5 rounded-xl bg-white text-slate-900 border border-emerald-400/60 space-y-1.5">
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-700">
                    Đáp án chuẩn:{' '}
                    <span className="text-sm text-emerald-950 normal-case">
                      <MathView content={currentQuestion.officialAnswerText} />
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm text-slate-700 overflow-x-auto">
                    <MathView content={currentQuestion.explanation} />
                  </div>
                </div>

                {/* Compact Standings Preview on Round Summary */}
                {uiPhase === 'round_summary' && gameState.config.mode === 'round_robin' && (
                  <div className="p-3.5 rounded-xl bg-[#071226] border border-slate-700/80 space-y-2">
                    <div className="text-xs font-extrabold text-teal-300 uppercase tracking-wider">
                      Bảng xếp hạng tạm thời sau Vòng {gameState.currentRoundIndex + 1}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {standings.map((row) => {
                        const pal = getPalette(row.paletteIndex);
                        return (
                          <div
                            key={row.teamId}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-black text-yellow-300 shrink-0">
                                {row.isTied ? `=#${row.rank}` : `#${row.rank}`}
                              </span>
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: pal.hex }}
                              />
                              <span className="font-bold text-white truncate">{row.name}</span>
                            </div>
                            <span className="font-black text-teal-300 shrink-0">
                              {row.tournamentPoints}đ ({row.wins}-{row.draws}-{row.losses})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary Next Step CTA */}
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAdvanceNext}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-400 to-yellow-400 hover:brightness-105 text-[#071226] text-sm font-black shadow-lg"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      {gameState.status !== 'playing'
                        ? gameState.config.mode === 'solo_practice'
                          ? 'Xem tổng kết tự luyện'
                          : 'Xem bục trao cúp & bảng xếp hạng'
                        : uiPhase === 'round_summary'
                        ? `Mở vòng ${gameState.currentRoundIndex + 2}`
                        : `Câu tiếp theo (Câu ${gameState.currentQuestionInRound + 2}/${qPerMatchDisplay})`}
                    </span>
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ================================================================ */}
          {/* PHASE E: FINAL SUMMARY & PODIUM                                  */}
          {/* ================================================================ */}
          {isSummary && (
            <section className="p-5 sm:p-6 rounded-2xl bg-[#0B1B34] border border-yellow-400/45 space-y-5">
              {/* Header Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 pb-4">
                <div>
                  {gameState.endedEarly ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/55 text-amber-200 text-xs font-black uppercase tracking-wide">
                      <Flag className="w-3.5 h-3.5" />
                      <span>Giải chưa hoàn tất · Không trao cúp vô địch</span>
                    </span>
                  ) : gameState.config.mode === 'solo_practice' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-500/20 border border-teal-400/50 text-teal-200 text-xs font-black uppercase tracking-wide">
                      <Award className="w-3.5 h-3.5" />
                      <span>Hoàn thành phiên tự luyện cá nhân</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-yellow-400/20 border border-yellow-400/60 text-yellow-200 text-xs font-black uppercase tracking-wide">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Hoàn thành giải đấu vòng tròn</span>
                    </span>
                  )}

                  <h2 className="text-xl sm:text-2xl font-black text-white mt-2">
                    {gameState.endedEarly
                      ? 'Giải chưa hoàn tất — Bảng tổng hợp các trận đã đấu'
                      : gameState.config.mode === 'solo_practice'
                      ? `Kết quả tự luyện: ${soloStats.correct} / ${soloStats.totalAnswered} câu đúng`
                      : standings[0]?.isTied
                      ? 'Kết quả Đồng hạng nhất — Chúc mừng các đội dẫn đầu!'
                      : standings[0]
                      ? `Vô địch giải đấu: ${standings[0].name}`
                      : 'Tổng kết giải đấu'}
                  </h2>
                </div>

                {/* Required Summary Buttons: Xem lịch đấu, Xem lại kiến thức, Chơi lại, Về thư viện */}
                <div className="flex flex-wrap items-center gap-2">
                  {gameState.config.mode === 'round_robin' && (
                    <button
                      type="button"
                      onClick={() => setShowScheduleDrawer(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-slate-100"
                    >
                      <CalendarDays className="w-4 h-4 text-teal-300" />
                      <span>Xem lịch đấu</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowKnowledgeReview(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/55 text-xs font-extrabold text-teal-100"
                  >
                    <BookOpen className="w-4 h-4 text-teal-300" />
                    <span>Xem lại kiến thức</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleReplay}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-[#071226] text-xs font-black"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExitToLibrary}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-slate-100"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Về thư viện</span>
                  </button>
                </div>
              </div>

              {/* Standings Table (Round-Robin) or Solo Breakdown */}
              {gameState.config.mode === 'round_robin' ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="py-2.5 pr-3">Thứ hạng</th>
                        <th className="py-2.5 pr-3">Đội thi đấu</th>
                        <th className="py-2.5 px-3 text-center">Điểm giải</th>
                        <th className="py-2.5 px-3 text-center">Số trận đã đấu</th>
                        <th className="py-2.5 px-3 text-center">Thắng – Hòa – Thua</th>
                        <th className="py-2.5 pl-3 text-right">Số câu đúng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row) => {
                        const pal = getPalette(row.paletteIndex);
                        return (
                          <tr
                            key={row.teamId}
                            className={`border-b border-slate-800 ${
                              row.rank === 1 && gameState.trophyAwarded ? 'bg-yellow-400/10' : ''
                            }`}
                          >
                            <td className="py-3 pr-3 font-black text-yellow-300 whitespace-nowrap">
                              {row.isTied ? `Đồng hạng #${row.rank}` : `Hạng #${row.rank}`}
                            </td>
                            <td className="py-3 pr-3 font-extrabold text-white">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: pal.hex }}
                                />
                                <span>{row.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-black text-lg text-teal-300">
                              {row.tournamentPoints}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-200">
                              {row.matchesCompleted}
                            </td>
                            <td className="py-3 px-3 text-center font-semibold text-slate-300">
                              {row.wins} – {row.draws} – {row.losses}
                            </td>
                            <td className="py-3 pl-3 text-right font-extrabold text-slate-100">
                              {row.totalCorrect}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#071226] border border-teal-500/35 text-center">
                    <div className="text-xs font-bold text-slate-400">Số câu đã hoàn thành</div>
                    <div className="text-2xl font-black text-white mt-1">
                      {soloStats.totalAnswered} / {soloStats.totalQuestions}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#071226] border border-emerald-500/35 text-center">
                    <div className="text-xs font-bold text-slate-400">Số câu đúng</div>
                    <div className="text-2xl font-black text-emerald-300 mt-1">
                      {soloStats.correct}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#071226] border border-yellow-400/35 text-center">
                    <div className="text-xs font-bold text-slate-400">Tỉ lệ chính xác</div>
                    <div className="text-2xl font-black text-yellow-300 mt-1">
                      {soloStats.totalAnswered > 0
                        ? `${Math.round((soloStats.correct / soloStats.totalAnswered) * 100)}%`
                        : '0%'}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: FORMULA ZOOM MODAL (KaTeX MathView)                         */}
      {/* ==================================================================== */}
      {zoomQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-slate-900 border-2 border-teal-500 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-[#071226]">
                Phóng to câu hỏi &amp; công thức Toán
              </h3>
              <button
                type="button"
                onClick={() => setZoomQuestion(null)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-2xl sm:text-3xl font-bold leading-relaxed overflow-x-auto">
              <MathView content={zoomQuestion.stem} />
            </div>
            {zoomQuestion.options && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {zoomQuestion.options.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-300"
                  >
                    <span className="w-9 h-9 rounded-lg bg-[#071226] text-yellow-300 flex items-center justify-center font-black shrink-0">
                      {opt.label}
                    </span>
                    <div className="text-xl font-bold overflow-x-auto flex-1">
                      <MathView content={opt.text} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: FULL SCHEDULE MODAL (From Summary "Xem lịch đấu")           */}
      {/* ==================================================================== */}
      {showScheduleDrawer && isSummary && gameState.config.mode === 'round_robin' && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl bg-[#0B1B34] text-white border border-teal-400/50 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-base font-black text-teal-200 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-yellow-400" />
                <span>Lịch đấu &amp; kết quả từng vòng</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowScheduleDrawer(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {gameState.rounds.map((r) => {
                const bye = r.byeTeamId ? teamMap[r.byeTeamId] : null;
                return (
                  <div
                    key={r.roundIndex}
                    className="p-3.5 rounded-xl bg-[#071226] border border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-extrabold">
                      <span className="text-teal-300">Vòng {r.roundIndex + 1}</span>
                      {bye && <span className="text-amber-300">Nghỉ: {bye.name}</span>}
                    </div>
                    {r.matches.map((m) => {
                      const mr = gameState.matchResults[m.matchId];
                      return (
                        <div
                          key={m.matchId}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900/90 text-xs"
                        >
                          <span className="font-bold truncate flex-1">{teamMap[m.teamAId]?.name}</span>
                          <span className="px-2 py-0.5 rounded bg-[#071226] border border-yellow-400/40 font-black text-yellow-300">
                            {mr ? `${mr.scoreA} – ${mr.scoreB}` : '—'}
                          </span>
                          <span className="font-bold truncate flex-1 text-right">
                            {teamMap[m.teamBId]?.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: KNOWLEDGE REVIEW MODAL ("Xem lại kiến thức" with MathView)  */}
      {/* ==================================================================== */}
      {showKnowledgeReview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white text-slate-900 border-2 border-teal-500 p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#071226]">
                  Xem lại kiến thức ({gameState.questionHistory.length} câu đã đấu)
                </h3>
                <p className="text-xs text-slate-500">
                  Toàn bộ đề bài, đáp án chuẩn và lời giải chi tiết được hiển thị bằng KaTeX.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKnowledgeReview(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {gameState.questionHistory.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Chưa có câu hỏi nào được hoàn thành trong phiên này.
              </p>
            ) : (
              <div className="space-y-3">
                {gameState.questionHistory.map((rec, idx) => (
                  <div
                    key={rec.questionId}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                      <span className="px-2 py-0.5 rounded bg-[#071226] text-yellow-300">
                        Câu {idx + 1} · {rec.questionCode}
                      </span>
                      {gameState.config.mode === 'round_robin' && (
                        <span className="text-slate-500">
                          Vòng {rec.roundIndex + 1} · Câu {rec.questionIndexInRound + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-base font-bold text-slate-900 overflow-x-auto">
                      <MathView content={rec.questionStem} />
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm space-y-1">
                      <div className="font-black text-emerald-900">
                        Đáp án đúng: <MathView content={rec.officialAnswerText} />
                      </div>
                      <div className="text-emerald-800 overflow-x-auto">
                        <MathView content={rec.explanation} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: END EARLY CONFIRMATION (No window.confirm!)                 */}
      {/* ==================================================================== */}
      {showEndEarlyConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0B1B34] text-white border border-rose-400/50 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-300 font-black text-base">
              <Flag className="w-5 h-5" />
              <span>Kết thúc sớm giải đấu?</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Giải đấu sẽ được đánh dấu là <strong>“Giải chưa hoàn tất”</strong>, hiển thị đúng số
              trận đã hoàn thành của từng đội và <strong>không trao cúp vô địch</strong>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEndEarlyConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200"
              >
                Tiếp tục thi đấu
              </button>
              <button
                type="button"
                onClick={handleConfirmEndEarly}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-black"
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

export default GroupChallenge3DGame;
