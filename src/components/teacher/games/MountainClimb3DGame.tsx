import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Edit3,
  Eye,
  Flag,
  History,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ClassRoom, Question } from '../../../types';
import { StudentCandidate } from '../studentCallRules';
import { MathView } from '../../MathView';
import { SpaceRocketVoiceManager } from './SpaceRocketVoiceManager';
import {
  C08CameraPreset,
  C08ComputedEntityState,
  C08DatasetKey,
  C08DisplayOption,
  C08MarkStatus,
  C08OrgMode,
  C08Participant,
  C08PersistedSession,
  C08PlayMode,
  C08QualityPreset,
  C08QuestionCountOption,
  C08QuestionItem,
  C08QuestionRecord,
  C08SessionConfig,
  C08StagePhase,
  C08TimeLimitSec,
  SAMPLE_INFORMATICS_C08_QUESTIONS,
  SAMPLE_MATH_C08_QUESTIONS,
  buildDisplayOptionsForC08,
  buildStagesForTotalQuestions,
  clearC08PersistedSession,
  computeC08EntityStates,
  createClassExpeditionParticipant,
  createSampleStudentParticipants,
  createTeamParticipants,
  getQuestionMaxPoints,
  getStageForQuestionIndex,
  loadC08PersistedSession,
  mapCandidatesToC08Participants,
  mapQuestionBankToC08Pool,
  saveC08PersistedSession,
} from './mountainClimb3dEngine';
import MountainClimb3DScene from './MountainClimb3DScene';

// ============================================================================
// PROCEDURAL WEB AUDIO SOUND ENGINE (NO EXTERNAL AUDIO ASSETS REQUIRED)
// ============================================================================

class MountainClimbSoundEngine {
  private ctx: AudioContext | null = null;
  private lastPlayed: Record<string, number> = {};

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  private canPlay(key: string, cooldownMs = 180): boolean {
    const now = performance.now();
    const prev = this.lastPlayed[key] || 0;
    if (now - prev < cooldownMs) return false;
    this.lastPlayed[key] = now;
    return true;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.08,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + durationSec + 0.03);
    } catch {
      // Ignore WebAudio node errors
    }
  }

  public playStageStart(isMuted: boolean): void {
    if (isMuted || !this.canPlay('stageStart', 300)) return;
    this.playTone(440, 0.14, 'triangle', 0.08, 0);
    this.playTone(554.37, 0.16, 'triangle', 0.08, 0.09);
    this.playTone(659.25, 0.24, 'triangle', 0.09, 0.18);
  }

  public playLockIn(isMuted: boolean): void {
    if (isMuted || !this.canPlay('lockIn', 150)) return;
    this.playTone(523.25, 0.1, 'sine', 0.07, 0);
  }

  public playCorrect(isMuted: boolean): void {
    if (isMuted || !this.canPlay('correct', 250)) return;
    this.playTone(523.25, 0.14, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.09, 0.08);
    this.playTone(783.99, 0.26, 'triangle', 0.1, 0.16);
  }

  public playNeutralMiss(isMuted: boolean): void {
    if (isMuted || !this.canPlay('miss', 250)) return;
    this.playTone(349.23, 0.16, 'sine', 0.06, 0);
    this.playTone(311.13, 0.22, 'sine', 0.05, 0.1);
  }

  public playStepClimb(isMuted: boolean): void {
    if (isMuted || !this.canPlay('step', 450)) return;
    this.playTone(392.0, 0.09, 'sine', 0.05, 0);
    this.playTone(493.88, 0.12, 'sine', 0.06, 0.08);
  }

  public playSummitFanfare(isMuted: boolean): void {
    if (isMuted || !this.canPlay('summit', 900)) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      this.playTone(f, idx === 3 ? 0.45 : 0.18, 'triangle', 0.1, idx * 0.11);
    });
  }

  public playSummary(isMuted: boolean): void {
    if (isMuted || !this.canPlay('summary', 500)) return;
    this.playTone(440, 0.15, 'sine', 0.07, 0);
    this.playTone(587.33, 0.22, 'sine', 0.08, 0.11);
    this.playTone(880, 0.35, 'triangle', 0.09, 0.22);
  }
}

// ============================================================================
// PROPS & TYPES
// ============================================================================

export interface MountainClimb3DGameProps {
  availableCandidates: StudentCandidate[];
  allCandidates: StudentCandidate[];
  absentIds: Set<string>;
  classes: ClassRoom[];
  questions: Question[];
  selectedSourceKey: string;
  onSelectSourceKey: (key: string) => void;
  resolvedClassName: string;
  teacherId: string;
  teacherName: string;
  userRole: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenAbsentModal: () => void;
  onOpenHistoryModal: () => void;
  onPick?: (chosen: StudentCandidate, meta?: { bonusPoints?: number; note?: string; sessionId?: string }) => void;
  onCloseGame: () => void;
}

type IndividualRosterSource = 'CLASS_ROSTER' | 'SAMPLE_1' | 'SAMPLE_50' | 'CUSTOM_TEMP';

const DEFAULT_CONFIG: C08SessionConfig = {
  playMode: 'JOURNEY',
  orgMode: 'CLASS',
  datasetKey: 'SAMPLE_MATH',
  questionCount: 12,
  pointsPerQuestion: 10,
  summitThreshold: 100,
  timeLimitSec: 45,
  hintsEnabled: true,
  showJourneyScoreboard: true,
  qualityPreset: 'MEDIUM',
  reducedMotion: false,
  cameraMotionEnabled: true,
  voiceEnabled: true,
};

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\$\$/g, ' ')
    .replace(/\$/g, ' ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
    .replace(/\\widehat\{([^}]*)\}/g, 'góc $1')
    .replace(/\^\\circ/g, ' độ')
    .replace(/\\cdot|\\times/g, ' nhân ')
    .replace(/\\approx/g, ' xấp xỉ ')
    .replace(/\\Rightarrow/g, ' suy ra ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/[\\{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const MountainClimb3DGame: React.FC<MountainClimb3DGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds,
  classes,
  questions,
  selectedSourceKey,
  onSelectSourceKey,
  resolvedClassName,
  isFullscreen,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onCloseGame,
}) => {
  const soundRef = useRef<MountainClimbSoundEngine | null>(null);
  if (!soundRef.current) soundRef.current = new MountainClimbSoundEngine();

  const voiceRef = useRef<SpaceRocketVoiceManager | null>(null);
  const [voiceAvail, setVoiceAvail] = useState({
    supported: true,
    hasVietnameseVoice: true,
    selectedVoiceName: null as string | null,
  });
  const [dismissedVoiceWarning, setDismissedVoiceWarning] = useState(false);

  // Setup Configuration States
  const [config, setConfig] = useState<C08SessionConfig>(DEFAULT_CONFIG);
  const [individualSource, setIndividualSource] = useState<IndividualRosterSource>(
    availableCandidates.length > 0 ? 'CLASS_ROSTER' : 'SAMPLE_1'
  );
  const [customTempNamesText, setCustomTempNamesText] = useState<string>(
    'Nguyễn Minh An\nTrần Bảo Châu\nLê Hoàng Long'
  );
  const [teamCount, setTeamCount] = useState<number>(4);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Đội Sao Mai',
    'Đội Đỉnh Cao',
    'Đội Tia Chớp',
    'Đội Khám Phá',
    'Đội Bứt Phá',
    'Đội Chiến Thắng',
  ]);
  const [force2DFallback, setForce2DFallback] = useState<boolean>(false);

  // Recovery Banner State
  const [pendingRecovery, setPendingRecovery] = useState<C08PersistedSession | null>(() =>
    loadC08PersistedSession()
  );

  // Active Game Session State
  const [sessionId, setSessionId] = useState<string>(() => `c08_${Date.now()}`);
  const [stagePhase, setStagePhase] = useState<C08StagePhase>('SETUP');
  const [participants, setParticipants] = useState<C08Participant[]>([]);
  const [questionPool, setQuestionPool] = useState<C08QuestionItem[]>([]);
  const [optionOrdersByQuestionId, setOptionOrdersByQuestionId] = useState<
    Record<string, string[]>
  >({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [records, setRecords] = useState<C08QuestionRecord[]>([]);

  // Per-Question Interaction States
  const [currentHintUsed, setCurrentHintUsed] = useState<boolean>(false);
  const [currentSelectedOptionId, setCurrentSelectedOptionId] = useState<string | null>(null);
  const [classShortAnswerText, setClassShortAnswerText] = useState<string>('');
  const [draftMarks, setDraftMarks] = useState<Record<string, C08MarkStatus>>({});
  const [mediaReady, setMediaReady] = useState<boolean>(true);
  const [mediaError, setMediaError] = useState<boolean>(false);

  // Grading Filter / Search UI
  const [gradingSearch, setGradingSearch] = useState<string>('');
  const [gradingFilter, setGradingFilter] = useState<
    'ALL' | 'UNGRADED' | 'CORRECT' | 'WRONG' | 'NO_ANSWER'
  >('ALL');

  // Edit Last Question Inline Panel
  const [editingLastRecord, setEditingLastRecord] = useState<boolean>(false);
  const [editLastDraftMarks, setEditLastDraftMarks] = useState<Record<string, C08MarkStatus>>({});

  // Pause & Deadline-based Timer States (single source of truth)
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const deadlineMsRef = useRef<number | null>(null);
  const pausedRemainingMsRef = useRef<number | null>(null);

  // Camera & Summary UI States
  const [cameraPreset, setCameraPreset] = useState<C08CameraPreset>('OVERVIEW');
  const [showLeaderboardDrawer, setShowLeaderboardDrawer] = useState<boolean>(true);
  const [showAllMountainModal, setShowAllMountainModal] = useState<boolean>(false);
  const [showConfirmResetModal, setShowConfirmResetModal] = useState<boolean>(false);
  const [summitCelebrateToast, setSummitCelebrateToast] = useState<string | null>(null);

  // Race / Double-Click / Stale Timer Protectors
  const stepTokenRef = useRef<number>(1);
  const confirmLockRef = useRef<boolean>(false);
  const movingTimerRef = useRef<number | null>(null);
  const prevSummitCountRef = useRef<number>(0);

  // Validated Question Bank Pool
  const validBankPool = useMemo(() => mapQuestionBankToC08Pool(questions), [questions]);

  // Voice Manager Lifecycle
  useEffect(() => {
    const vm = new SpaceRocketVoiceManager();
    voiceRef.current = vm;
    const unsub = vm.subscribe((avail) => {
      setVoiceAvail({
        supported: avail.supported,
        hasVietnameseVoice: avail.hasVietnameseVoice,
        selectedVoiceName: avail.selectedVoiceName,
      });
    });
    return () => {
      unsub();
      vm.dispose();
      voiceRef.current = null;
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (movingTimerRef.current) {
        window.clearTimeout(movingTimerRef.current);
      }
      voiceRef.current?.cancel();
    };
  }, []);

  // Selected raw dataset preview in SETUP
  const rawDatasetPool = useMemo(() => {
    if (config.datasetKey === 'SAMPLE_MATH') return SAMPLE_MATH_C08_QUESTIONS;
    if (config.datasetKey === 'SAMPLE_INFORMATICS') return SAMPLE_INFORMATICS_C08_QUESTIONS;
    return validBankPool;
  }, [config.datasetKey, validBankPool]);

  const effectiveSetupQuestionCount = useMemo(() => {
    if (config.questionCount === 'ALL') return rawDatasetPool.length;
    return Math.min(config.questionCount, rawDatasetPool.length);
  }, [config.questionCount, rawDatasetPool.length]);

  const setupMaxPossibleScore = effectiveSetupQuestionCount * config.pointsPerQuestion;

  // Auto-keep summitThreshold clamped cleanly when question count or points change during setup
  useEffect(() => {
    if (stagePhase !== 'SETUP') return;
    if (setupMaxPossibleScore <= 0) return;
    setConfig((prev) => {
      if (prev.summitThreshold > setupMaxPossibleScore) {
        return {
          ...prev,
          summitThreshold: Math.max(prev.pointsPerQuestion, Math.round(setupMaxPossibleScore * 0.8)),
        };
      }
      return prev;
    });
  }, [setupMaxPossibleScore, stagePhase]);

  const setupBankShortage =
    config.datasetKey === 'QUESTION_BANK' &&
    config.questionCount !== 'ALL' &&
    validBankPool.length > 0 &&
    validBankPool.length < config.questionCount;

  const setupThresholdError =
    config.playMode === 'CONQUEST' &&
    (config.summitThreshold <= 0 || config.summitThreshold > Math.max(1, setupMaxPossibleScore));

  // Build candidate participants preview in SETUP
  const setupParticipantsPreview = useMemo<C08Participant[]>(() => {
    if (config.orgMode === 'CLASS') {
      return createClassExpeditionParticipant(resolvedClassName);
    }
    if (config.orgMode === 'TEAMS') {
      return createTeamParticipants(teamCount, teamNames);
    }
    if (individualSource === 'SAMPLE_1') {
      return createSampleStudentParticipants(1);
    }
    if (individualSource === 'SAMPLE_50') {
      return createSampleStudentParticipants(50);
    }
    if (individualSource === 'CUSTOM_TEMP') {
      const lines = customTempNamesText
        .split(/\r?\n|,/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 50);
      return lines.map((name, idx) => ({
        participantId: `c08_custom_${idx + 1}_${name.slice(0, 6)}`,
        stt: idx + 1,
        name,
        code: String(idx + 1).padStart(2, '0'),
        colorHex: ['#06B6D4', '#F59E0B', '#10B981', '#38BDF8', '#F97316', '#A855F7'][idx % 6],
        isTemporaryLabel: true,
      }));
    }
    return mapCandidatesToC08Participants(availableCandidates);
  }, [
    config.orgMode,
    resolvedClassName,
    teamCount,
    teamNames,
    individualSource,
    customTempNamesText,
    availableCandidates,
  ]);

  // Active Game Totals & Deterministic Entity Computation
  const totalQuestions = Math.max(1, questionPool.length);
  const stages = useMemo(() => buildStagesForTotalQuestions(totalQuestions), [totalQuestions]);
  const currentQuestion = questionPool[currentQuestionIndex] || null;
  const currentStage = useMemo(
    () => getStageForQuestionIndex(currentQuestionIndex, stages),
    [currentQuestionIndex, stages]
  );

  const activeMaxPossibleScore = useMemo(
    () => totalQuestions * config.pointsPerQuestion,
    [totalQuestions, config.pointsPerQuestion]
  );

  const computedEntities = useMemo<C08ComputedEntityState[]>(
    () =>
      computeC08EntityStates({
        participants,
        records,
        totalQuestions,
        playMode: config.playMode,
        summitThreshold: config.summitThreshold,
      }),
    [participants, records, totalQuestions, config.playMode, config.summitThreshold]
  );

  // Sorted ranking view (never mutates original participant array order)
  const rankedEntities = useMemo(
    () =>
      [...computedEntities].sort(
        (a, b) => b.score - a.score || a.participant.stt - b.participant.stt
      ),
    [computedEntities]
  );

  // Preview entities during GRADING (shows live altitude & score preview before confirmation)
  const previewEntities = useMemo(() => {
    if (stagePhase !== 'GRADING' && stagePhase !== 'REVEALED') return computedEntities;
    if (!currentQuestion) return computedEntities;
    const maxPtsQ = getQuestionMaxPoints(
      config.pointsPerQuestion,
      currentHintUsed,
      Boolean(currentQuestion.hint)
    );
    const previewRec: C08QuestionRecord = {
      questionIndex: currentQuestionIndex,
      questionNumber: currentQuestionIndex + 1,
      questionId: currentQuestion.questionId,
      stageNumber: currentStage.stageNumber,
      hintUsed: currentHintUsed,
      maxPointsForQuestion: maxPtsQ,
      marks: draftMarks,
      confirmedAt: Date.now(),
      editCount: 0,
    };
    const merged = [
      ...records.filter((r) => r.questionIndex !== currentQuestionIndex),
      previewRec,
    ];
    return computeC08EntityStates({
      participants,
      records: merged,
      totalQuestions,
      playMode: config.playMode,
      summitThreshold: config.summitThreshold,
    });
  }, [
    stagePhase,
    currentQuestion,
    config.pointsPerQuestion,
    config.playMode,
    config.summitThreshold,
    currentHintUsed,
    currentQuestionIndex,
    currentStage.stageNumber,
    draftMarks,
    records,
    participants,
    totalQuestions,
    computedEntities,
  ]);

  const currentDisplayOptions = useMemo<C08DisplayOption[]>(() => {
    if (!currentQuestion) return [];
    return buildDisplayOptionsForC08(
      currentQuestion,
      optionOrdersByQuestionId[currentQuestion.questionId]
    );
  }, [currentQuestion, optionOrdersByQuestionId]);

  const currentQuestionMaxPts = useMemo(() => {
    if (!currentQuestion) return config.pointsPerQuestion;
    return getQuestionMaxPoints(
      config.pointsPerQuestion,
      currentHintUsed,
      Boolean(currentQuestion.hint)
    );
  }, [currentQuestion, config.pointsPerQuestion, currentHintUsed]);

  // Reachability tracker for CONQUEST mode (neutral banner without lowering threshold)
  const maxRemainingScoreAfterCurrent = useMemo(() => {
    if (config.playMode !== 'CONQUEST') return 0;
    const unrecordedQuestions = Math.max(0, totalQuestions - records.length);
    const currentContribution = records.some((r) => r.questionIndex === currentQuestionIndex)
      ? 0
      : currentQuestionMaxPts;
    const futureCount = Math.max(
      0,
      unrecordedQuestions - (records.some((r) => r.questionIndex === currentQuestionIndex) ? 0 : 1)
    );
    return currentContribution + futureCount * config.pointsPerQuestion;
  }, [
    config.playMode,
    totalQuestions,
    records,
    currentQuestionIndex,
    currentQuestionMaxPts,
    config.pointsPerQuestion,
  ]);

  const highestReachableScore = useMemo(() => {
    if (computedEntities.length === 0) return 0;
    const topScore = Math.max(...computedEntities.map((e) => e.score));
    return topScore + maxRemainingScoreAfterCurrent;
  }, [computedEntities, maxRemainingScoreAfterCurrent]);

  const thresholdUnreachableForAll =
    config.playMode === 'CONQUEST' &&
    stagePhase !== 'SETUP' &&
    stagePhase !== 'FINISHED' &&
    computedEntities.every((e) => !e.reachedSummit) &&
    highestReachableScore < config.summitThreshold;

  // Summit celebration chime + toast when someone reaches summit for the first time
  useEffect(() => {
    const summitCount = computedEntities.filter((e) => e.reachedSummit).length;
    if (
      summitCount > prevSummitCountRef.current &&
      stagePhase !== 'SETUP' &&
      records.length > 0
    ) {
      soundRef.current?.playSummitFanfare(isMuted);
      const winners = computedEntities.filter((e) => e.reachedSummit).map((e) => e.participant.name);
      if (winners.length === 1) {
        setSummitCelebrateToast(`${winners[0]} đã chinh phục Đỉnh Tri Thức!`);
      } else {
        setSummitCelebrateToast(`${winners.length} người chơi/đội đã đặt chân lên Đỉnh Tri Thức!`);
      }
      const tid = window.setTimeout(() => setSummitCelebrateToast(null), 4500);
      prevSummitCountRef.current = summitCount;
      return () => window.clearTimeout(tid);
    }
    prevSummitCountRef.current = summitCount;
  }, [computedEntities, stagePhase, records.length, isMuted]);

  // Persist active session cleanly to isolated key
  useEffect(() => {
    if (stagePhase === 'SETUP' || questionPool.length === 0 || participants.length === 0) return;
    const persisted: C08PersistedSession = {
      version: 1,
      savedAt: Date.now(),
      sessionId,
      config,
      participants,
      questionPool,
      optionOrdersByQuestionId,
      currentQuestionIndex,
      stagePhase: stagePhase === 'MOVING' ? 'CONFIRMED' : stagePhase,
      records,
      currentHintUsed,
      currentSelectedOptionId,
      draftMarks,
      isPaused,
      pausedRemainingMs: pausedRemainingMsRef.current,
    };
    saveC08PersistedSession(persisted);
  }, [
    stagePhase,
    sessionId,
    config,
    participants,
    questionPool,
    optionOrdersByQuestionId,
    currentQuestionIndex,
    records,
    currentHintUsed,
    currentSelectedOptionId,
    draftMarks,
    isPaused,
  ]);

  // ==========================================================================
  // DEADLINE-BASED TIMER & TIMEOUT HANDLING
  // ==========================================================================

  const enterAnsweringForQuestion = useCallback(
    (qItem: C08QuestionItem, customRemainingMs?: number) => {
      stepTokenRef.current += 1;
      confirmLockRef.current = false;
      setCurrentHintUsed(false);
      setCurrentSelectedOptionId(null);
      setClassShortAnswerText('');
      setEditingLastRecord(false);
      const initMarks: Record<string, C08MarkStatus> = {};
      participants.forEach((p) => {
        initMarks[p.participantId] = 'UNGRADED';
      });
      setDraftMarks(initMarks);
      setGradingSearch('');
      setGradingFilter('ALL');

      const hasImg = Boolean(qItem.imageUrl);
      setMediaError(false);
      setMediaReady(!hasImg);

      const ms =
        typeof customRemainingMs === 'number'
          ? customRemainingMs
          : config.timeLimitSec > 0
          ? config.timeLimitSec * 1000
          : 0;
      setRemainingMs(ms);
      pausedRemainingMsRef.current = ms;
      deadlineMsRef.current = !hasImg && ms > 0 ? Date.now() + ms : null;

      setStagePhase('ANSWERING');
      setIsPaused(false);
      soundRef.current?.playStageStart(isMuted);
    },
    [participants, config.timeLimitSec, isMuted]
  );

  // Start timer once media image finishes loading/failing
  useEffect(() => {
    if (stagePhase !== 'ANSWERING' || isPaused) return;
    if (mediaReady && config.timeLimitSec > 0 && deadlineMsRef.current === null && remainingMs > 0) {
      deadlineMsRef.current = Date.now() + remainingMs;
    }
  }, [mediaReady, stagePhase, isPaused, config.timeLimitSec, remainingMs]);

  const handleConfirmRecord = useCallback(
    (
      finalMarks: Record<string, C08MarkStatus>,
      selectedOptionId?: string,
      shortText?: string
    ) => {
      if (confirmLockRef.current || !currentQuestion) return;
      // Validate zero UNGRADED entries
      const hasUngraded = participants.some(
        (p) => !finalMarks[p.participantId] || finalMarks[p.participantId] === 'UNGRADED'
      );
      if (hasUngraded) return;

      confirmLockRef.current = true;
      deadlineMsRef.current = null;
      voiceRef.current?.cancel();

      const maxPtsQ = getQuestionMaxPoints(
        config.pointsPerQuestion,
        currentHintUsed,
        Boolean(currentQuestion.hint)
      );

      const newRec: C08QuestionRecord = {
        questionIndex: currentQuestionIndex,
        questionNumber: currentQuestionIndex + 1,
        questionId: currentQuestion.questionId,
        stageNumber: currentStage.stageNumber,
        hintUsed: currentHintUsed,
        maxPointsForQuestion: maxPtsQ,
        marks: { ...finalMarks },
        selectedOptionId,
        directSubmittedText: shortText,
        confirmedAt: Date.now(),
        editCount: 0,
      };

      setRecords((prev) => {
        const withoutSame = prev.filter((r) => r.questionIndex !== currentQuestionIndex);
        return [...withoutSame, newRec].sort((a, b) => a.questionIndex - b.questionIndex);
      });

      const anyCorrect = Object.values(finalMarks).some((m) => m === 'CORRECT');
      if (anyCorrect) {
        soundRef.current?.playCorrect(isMuted);
      } else {
        soundRef.current?.playNeutralMiss(isMuted);
      }

      if (movingTimerRef.current) {
        window.clearTimeout(movingTimerRef.current);
      }
      const tokenSnapshot = stepTokenRef.current;

      if (config.reducedMotion) {
        setStagePhase('CONFIRMED');
      } else {
        setStagePhase('MOVING');
        soundRef.current?.playStepClimb(isMuted);
        movingTimerRef.current = window.setTimeout(() => {
          if (stepTokenRef.current === tokenSnapshot) {
            setStagePhase((prev) => (prev === 'MOVING' ? 'CONFIRMED' : prev));
          }
        }, 1450);
      }
    },
    [
      currentQuestion,
      participants,
      config.pointsPerQuestion,
      config.reducedMotion,
      currentHintUsed,
      currentQuestionIndex,
      currentStage.stageNumber,
      isMuted,
    ]
  );

  const handleTimeoutExpired = useCallback(() => {
    if (stagePhase !== 'ANSWERING' || !currentQuestion) return;
    deadlineMsRef.current = null;
    setRemainingMs(0);

    if (config.orgMode === 'CLASS') {
      if (currentQuestion.questionType !== 'SHORT_ANSWER') {
        const classPid = participants[0]?.participantId;
        if (!classPid) return;
        let mark: C08MarkStatus = 'NO_ANSWER';
        if (currentSelectedOptionId) {
          mark =
            currentSelectedOptionId === currentQuestion.correctOptionId ? 'CORRECT' : 'WRONG';
        }
        handleConfirmRecord({ [classPid]: mark }, currentSelectedOptionId || undefined);
      } else {
        // Short answer enters REVEALED so teacher inspects answer & grades
        setStagePhase('REVEALED');
        soundRef.current?.playLockIn(isMuted);
      }
    } else {
      // INDIVIDUAL / TEAMS move to GRADING sheet
      setStagePhase('GRADING');
      soundRef.current?.playLockIn(isMuted);
    }
  }, [
    stagePhase,
    currentQuestion,
    config.orgMode,
    participants,
    currentSelectedOptionId,
    handleConfirmRecord,
    isMuted,
  ]);

  // Single monotonic deadline interval
  useEffect(() => {
    if (stagePhase !== 'ANSWERING' || isPaused || config.timeLimitSec <= 0 || !mediaReady) {
      return;
    }
    const tokenAtStart = stepTokenRef.current;
    const intervalId = window.setInterval(() => {
      if (stepTokenRef.current !== tokenAtStart || deadlineMsRef.current === null) return;
      const left = Math.max(0, deadlineMsRef.current - Date.now());
      setRemainingMs(left);
      if (left <= 0) {
        window.clearInterval(intervalId);
        handleTimeoutExpired();
      }
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [stagePhase, isPaused, config.timeLimitSec, mediaReady, handleTimeoutExpired]);

  // ==========================================================================
  // USER ACTIONS: START, RESUME, HINT, LOCK-IN, GRADING, EDIT, NEXT
  // ==========================================================================

  const handleStartNewExpedition = () => {
    soundRef.current?.unlock();
    if (setupParticipantsPreview.length === 0) return;
    if (rawDatasetPool.length === 0) return;
    if (setupThresholdError) return;

    const chosenPool = rawDatasetPool.slice(0, effectiveSetupQuestionCount);
    const optionMap: Record<string, string[]> = {};
    chosenPool.forEach((q) => {
      const built = buildDisplayOptionsForC08(q);
      if (built.length > 0) {
        optionMap[q.questionId] = built.map((o) => o.optionId);
      }
    });

    clearC08PersistedSession();
    setPendingRecovery(null);
    setSessionId(`c08_${Date.now()}`);
    setParticipants(setupParticipantsPreview);
    setQuestionPool(chosenPool);
    setOptionOrdersByQuestionId(optionMap);
    setRecords([]);
    setCurrentQuestionIndex(0);
    prevSummitCountRef.current = 0;

    setStagePhase('READY');
    setTimeout(() => {
      enterAnsweringForQuestion(chosenPool[0]);
    }, 60);
  };

  const handleResumePersistedSession = () => {
    if (!pendingRecovery) return;
    soundRef.current?.unlock();
    setSessionId(pendingRecovery.sessionId);
    setConfig(pendingRecovery.config);
    setParticipants(pendingRecovery.participants);
    setQuestionPool(pendingRecovery.questionPool);
    setOptionOrdersByQuestionId(pendingRecovery.optionOrdersByQuestionId || {});
    setCurrentQuestionIndex(pendingRecovery.currentQuestionIndex);
    setRecords(pendingRecovery.records);
    setCurrentHintUsed(Boolean(pendingRecovery.currentHintUsed));
    setCurrentSelectedOptionId(pendingRecovery.currentSelectedOptionId || null);
    setDraftMarks(pendingRecovery.draftMarks || {});
    setIsPaused(Boolean(pendingRecovery.isPaused));

    const savedMs = pendingRecovery.pausedRemainingMs ?? pendingRecovery.config.timeLimitSec * 1000;
    pausedRemainingMsRef.current = savedMs;
    setRemainingMs(savedMs);

    const restoredPhase =
      pendingRecovery.stagePhase === 'SETUP' ? 'ANSWERING' : pendingRecovery.stagePhase;
    if (restoredPhase === 'ANSWERING' && !pendingRecovery.isPaused && savedMs > 0) {
      deadlineMsRef.current = Date.now() + savedMs;
    } else {
      deadlineMsRef.current = null;
    }
    setStagePhase(restoredPhase);
    setPendingRecovery(null);
  };

  const handleDiscardPersistedSession = () => {
    clearC08PersistedSession();
    setPendingRecovery(null);
  };

  const handleTogglePause = () => {
    if (stagePhase !== 'ANSWERING') return;
    if (!isPaused) {
      const left = deadlineMsRef.current
        ? Math.max(0, deadlineMsRef.current - Date.now())
        : remainingMs;
      pausedRemainingMsRef.current = left;
      setRemainingMs(left);
      deadlineMsRef.current = null;
      voiceRef.current?.cancel();
      setIsPaused(true);
    } else {
      const resumeMs = pausedRemainingMsRef.current ?? remainingMs;
      if (config.timeLimitSec > 0 && mediaReady && resumeMs > 0) {
        deadlineMsRef.current = Date.now() + resumeMs;
      }
      setIsPaused(false);
    }
  };

  const handleUseHint = () => {
    if (stagePhase !== 'ANSWERING' || isPaused) return;
    if (!config.hintsEnabled || !currentQuestion?.hint || currentHintUsed) return;
    setCurrentHintUsed(true);
    soundRef.current?.playLockIn(isMuted);
  };

  const handleSpeakQuestion = () => {
    if (!currentQuestion || isPaused || isMuted || !config.voiceEnabled) return;
    const vm = voiceRef.current;
    if (!vm) return;
    let text = `Câu ${currentQuestionIndex + 1}. ${stripLatexForSpeech(currentQuestion.stem)}`;
    if (
      (stagePhase === 'ANSWERING' || stagePhase === 'READY') &&
      currentDisplayOptions.length > 0
    ) {
      const opts = currentDisplayOptions
        .map((o) => `Phương án ${o.displayLabel}: ${stripLatexForSpeech(o.text)}`)
        .join('. ');
      text += `. ${opts}`;
    }
    vm.speakVietnamese(text, isMuted);
  };

  const handleClassLockInAnswer = () => {
    if (stagePhase !== 'ANSWERING' || isPaused || !currentQuestion) return;
    const classPid = participants[0]?.participantId;
    if (!classPid) return;
    if (currentQuestion.questionType === 'SHORT_ANSWER') {
      deadlineMsRef.current = null;
      setStagePhase('REVEALED');
      soundRef.current?.playLockIn(isMuted);
      return;
    }
    if (!currentSelectedOptionId) return;
    const isRight = currentSelectedOptionId === currentQuestion.correctOptionId;
    handleConfirmRecord(
      { [classPid]: isRight ? 'CORRECT' : 'WRONG' },
      currentSelectedOptionId
    );
  };

  const handleClassMarkNoAnswer = () => {
    if (stagePhase !== 'ANSWERING' || isPaused || !currentQuestion) return;
    const classPid = participants[0]?.participantId;
    if (!classPid) return;
    handleConfirmRecord({ [classPid]: 'NO_ANSWER' });
  };

  const handleClassShortAnswerSelfMark = (mark: 'CORRECT' | 'WRONG' | 'NO_ANSWER') => {
    if (stagePhase !== 'REVEALED' || !currentQuestion) return;
    const classPid = participants[0]?.participantId;
    if (!classPid) return;
    handleConfirmRecord({ [classPid]: mark }, undefined, classShortAnswerText.trim() || undefined);
  };

  const handleOpenGradingSheet = () => {
    if (stagePhase !== 'ANSWERING' || isPaused) return;
    deadlineMsRef.current = null;
    voiceRef.current?.cancel();
    setStagePhase('GRADING');
    soundRef.current?.playLockIn(isMuted);
  };

  const handleMarkParticipant = (participantId: string, mark: C08MarkStatus) => {
    setDraftMarks((prev) => ({ ...prev, [participantId]: mark }));
  };

  const handleBatchMarkUngraded = (mark: 'CORRECT' | 'WRONG' | 'NO_ANSWER') => {
    setDraftMarks((prev) => {
      const next = { ...prev };
      participants.forEach((p) => {
        if (!next[p.participantId] || next[p.participantId] === 'UNGRADED') {
          next[p.participantId] = mark;
        }
      });
      return next;
    });
  };

  const ungradedCount = useMemo(
    () =>
      participants.filter(
        (p) => !draftMarks[p.participantId] || draftMarks[p.participantId] === 'UNGRADED'
      ).length,
    [participants, draftMarks]
  );

  const filteredGradingParticipants = useMemo(() => {
    const q = gradingSearch.trim().toLowerCase();
    return participants.filter((p) => {
      const m = draftMarks[p.participantId] || 'UNGRADED';
      if (gradingFilter !== 'ALL' && m !== gradingFilter) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [participants, draftMarks, gradingFilter, gradingSearch]);

  const handleProceedAfterConfirmed = () => {
    if (movingTimerRef.current) {
      window.clearTimeout(movingTimerRef.current);
      movingTimerRef.current = null;
    }
    voiceRef.current?.cancel();
    setEditingLastRecord(false);

    if (currentQuestionIndex >= totalQuestions - 1) {
      setStagePhase('FINISHED');
      setCameraPreset('SUMMIT');
      soundRef.current?.playSummary(isMuted);
      return;
    }

    // Show stage summary at stage transitions (end of Stage 1 or Stage 2)
    if (currentQuestionIndex === currentStage.endIndex && currentStage.stageNumber < 3) {
      setStagePhase('STAGE_SUMMARY');
      soundRef.current?.playSummary(isMuted);
      return;
    }

    const nextIdx = currentQuestionIndex + 1;
    setCurrentQuestionIndex(nextIdx);
    enterAnsweringForQuestion(questionPool[nextIdx]);
  };

  const handleStartNextStage = () => {
    const nextIdx = currentQuestionIndex + 1;
    if (nextIdx >= totalQuestions) {
      setStagePhase('FINISHED');
      soundRef.current?.playSummary(isMuted);
      return;
    }
    setCurrentQuestionIndex(nextIdx);
    enterAnsweringForQuestion(questionPool[nextIdx]);
  };

  const handleOpenEditLastRecord = () => {
    const targetRec = records.find((r) => r.questionIndex === currentQuestionIndex);
    if (!targetRec) return;
    setEditLastDraftMarks({ ...targetRec.marks });
    setEditingLastRecord(true);
  };

  const handleSaveEditLastRecord = () => {
    setRecords((prev) =>
      prev.map((rec) =>
        rec.questionIndex === currentQuestionIndex
          ? {
              ...rec,
              marks: { ...editLastDraftMarks },
              editCount: rec.editCount + 1,
            }
          : rec
      )
    );
    setEditingLastRecord(false);
    soundRef.current?.playLockIn(isMuted);
  };

  const handleReplaySameConfig = () => {
    clearC08PersistedSession();
    setRecords([]);
    setCurrentQuestionIndex(0);
    prevSummitCountRef.current = 0;
    setCameraPreset('OVERVIEW');
    enterAnsweringForQuestion(questionPool[0]);
  };

  const handleReturnToSetup = () => {
    voiceRef.current?.cancel();
    deadlineMsRef.current = null;
    if (movingTimerRef.current) window.clearTimeout(movingTimerRef.current);
    clearC08PersistedSession();
    setShowConfirmResetModal(false);
    setStagePhase('SETUP');
  };

  // Review Missed Knowledge (strictly played questions with WRONG or NO_ANSWER)
  const missedKnowledgeItems = useMemo(() => {
    return records
      .map((rec) => {
        const wrongCount = Object.values(rec.marks).filter((m) => m === 'WRONG').length;
        const noAnsCount = Object.values(rec.marks).filter((m) => m === 'NO_ANSWER').length;
        if (wrongCount === 0 && noAnsCount === 0) return null;
        const q = questionPool[rec.questionIndex];
        if (!q) return null;
        return { rec, question: q, wrongCount, noAnsCount };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [records, questionPool]);

  // Session Aggregate Stats for Summary
  const summaryStats = useMemo(() => {
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalNoAnswer = 0;
    let hintsUsedCount = 0;
    records.forEach((rec) => {
      if (rec.hintUsed) hintsUsedCount++;
      Object.values(rec.marks).forEach((m) => {
        if (m === 'CORRECT') totalCorrect++;
        else if (m === 'WRONG') totalWrong++;
        else if (m === 'NO_ANSWER') totalNoAnswer++;
      });
    });
    const summitWinners = rankedEntities.filter((e) => e.reachedSummit);
    const totalScoreSum = computedEntities.reduce((s, e) => s + e.score, 0);
    const maxParticipantScore =
      rankedEntities.length > 0 ? rankedEntities[0].score : 0;
    return {
      totalCorrect,
      totalWrong,
      totalNoAnswer,
      hintsUsedCount,
      summitWinners,
      totalScoreSum,
      maxParticipantScore,
    };
  }, [records, rankedEntities, computedEntities]);

  const currentRecord = useMemo(
    () => records.find((r) => r.questionIndex === currentQuestionIndex) || null,
    [records, currentQuestionIndex]
  );

  // Determine layout emphasis: mountain takes primary focus on SETUP, MOVING, CONFIRMED, STAGE_SUMMARY, FINISHED
  const mountainPrimary =
    stagePhase === 'SETUP' ||
    stagePhase === 'MOVING' ||
    stagePhase === 'CONFIRMED' ||
    stagePhase === 'STAGE_SUMMARY' ||
    stagePhase === 'FINISHED';

  // Entities currently visible on mountain (shows live preview during grading)
  const mountainEntities = useMemo(() => {
    if (stagePhase === 'SETUP') {
      return setupParticipantsPreview.map((p, idx) => ({
        participant: p,
        score: 0,
        progress: 0,
        correctCount: 0,
        wrongCount: 0,
        noAnswerCount: 0,
        answeredCount: 0,
        reachedSummit: false,
        rank: 1,
      }));
    }
    return stagePhase === 'GRADING' || stagePhase === 'REVEALED'
      ? previewEntities
      : computedEntities;
  }, [stagePhase, setupParticipantsPreview, previewEntities, computedEntities]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div
      className={`w-full flex flex-col bg-[#08172E] text-white ${
        isFullscreen
          ? 'h-dvh overflow-y-auto'
          : 'rounded-3xl border border-cyan-500/30 shadow-2xl overflow-hidden'
      }`}
    >
      {/* 1. COMPACT CLASSROOM TOP BAR (NO HORIZONTAL OVERFLOW) */}
      <header className="w-full bg-[#061124] border-b border-white/10 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              voiceRef.current?.cancel();
              onCloseGame();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            ← Thư viện
          </button>

          {stagePhase !== 'SETUP' && (
            <button
              type="button"
              onClick={() => {
                if (records.length > 0 && stagePhase !== 'FINISHED') {
                  setShowConfirmResetModal(true);
                } else {
                  handleReturnToSetup();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-400/30 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Thiết lập</span>
            </button>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[11px] font-black">
              C08
            </span>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
              Đường lên đỉnh núi 3D
            </h1>
          </div>
        </div>

        {/* Center Status Badges */}
        {stagePhase !== 'SETUP' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold tabular-nums">
            <span className="px-2.5 py-1 rounded-xl bg-[#0F2D52] border border-cyan-400/30 text-cyan-100">
              {currentStage.stageName.split('·')[0].trim()} · Câu{' '}
              {Math.min(currentQuestionIndex + 1, totalQuestions)}/{totalQuestions}
            </span>
            {config.playMode === 'JOURNEY' ? (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-950/90 border border-emerald-400/40 text-emerald-200">
                Hành trình ôn tập · Trạm {records.length}/{totalQuestions}
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-xl bg-amber-950/90 border border-amber-400/40 text-amber-200">
                Chinh phục · Đích {config.summitThreshold}/{activeMaxPossibleScore}đ
              </span>
            )}
          </div>
        )}

        {/* Right Classroom Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Camera Controls */}
          <div className="flex items-center bg-[#0F2D52] rounded-xl p-0.5 border border-white/10">
            {(
              [
                { id: 'OVERVIEW', label: 'Toàn núi' },
                { id: 'FOLLOW', label: 'Theo dõi' },
                { id: 'SUMMIT', label: 'Đỉnh núi' },
              ] as { id: C08CameraPreset; label: string }[]
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === cam.id
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              setConfig((prev) => ({
                ...prev,
                cameraMotionEnabled: !prev.cameraMotionEnabled,
              }))
            }
            className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
              config.cameraMotionEnabled
                ? 'bg-slate-800 border-white/15 text-slate-200'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
            }`}
            title="Khóa hoặc bật chuyển động camera tự động"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">
              {config.cameraMotionEnabled ? 'Cam động' : 'Cam tĩnh'}
            </span>
          </button>

          {stagePhase === 'ANSWERING' && (
            <button
              type="button"
              onClick={handleTogglePause}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                isPaused
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenHistoryModal}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
            title="Lịch sử gọi tên"
            aria-label="Lịch sử gọi tên"
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className={`p-1.5 rounded-xl cursor-pointer ${
              isMuted
                ? 'bg-rose-950 border border-rose-500/40 text-rose-300'
                : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
            }`}
            title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            aria-label="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Celebration Toast when climber reaches summit */}
      {summitCelebrateToast && (
        <div className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-4 py-2 text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg">
          <Trophy className="w-4 h-4 shrink-0" />
          <span>{summitCelebrateToast}</span>
        </div>
      )}

      {/* Non-blocking Vietnamese Voice Notice */}
      {!voiceAvail.hasVietnameseVoice && !dismissedVoiceWarning && config.voiceEnabled && stagePhase !== 'SETUP' && (
        <div className="bg-slate-900 border-b border-amber-400/30 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-200 font-semibold">
            Thiết bị chưa cài giọng đọc Tiếng Việt (vi-VN). Nội dung câu hỏi vẫn hiển thị đầy đủ trên bảng.
          </span>
          <button
            type="button"
            onClick={() => {
              setDismissedVoiceWarning(true);
              setConfig((p) => ({ ...p, voiceEnabled: false }));
            }}
            className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
          >
            Bỏ qua đọc
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SETUP SCREEN                                                         */}
      {/* ==================================================================== */}
      {stagePhase === 'SETUP' && (
        <div className="p-3 sm:p-5 space-y-4">
          {/* Active Session Recovery Banner */}
          {pendingRecovery && (
            <div className="rounded-2xl bg-gradient-to-r from-cyan-950 to-blue-950 border border-cyan-400/50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-cyan-300 text-xs font-black uppercase tracking-wider">
                  <RefreshCw className="w-4 h-4" />
                  <span>Phát hiện phiên leo núi đang dở</span>
                </div>
                <p className="text-sm font-bold text-white">
                  Chế độ:{' '}
                  {pendingRecovery.config.playMode === 'JOURNEY'
                    ? 'Hành trình ôn tập'
                    : 'Chinh phục theo điểm'}{' '}
                  · Câu {pendingRecovery.currentQuestionIndex + 1}/{pendingRecovery.questionPool.length}{' '}
                  · Đã chấm {pendingRecovery.records.length} câu
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardPersistedSession}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  Bỏ qua, lập mới
                </button>
                <button
                  type="button"
                  onClick={handleResumePersistedSession}
                  className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Khôi phục phiên
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            {/* Left: 3D Mountain Preview + Rule Summary */}
            <div className="xl:col-span-5 flex flex-col gap-3">
              <div className="h-[340px] sm:h-[410px] rounded-2xl overflow-hidden">
                <MountainClimb3DScene
                  entities={mountainEntities}
                  playMode={config.playMode}
                  summitThreshold={config.summitThreshold}
                  maxPossibleScore={setupMaxPossibleScore}
                  qualityPreset={config.qualityPreset}
                  reducedMotion={config.reducedMotion}
                  cameraPreset={cameraPreset}
                  cameraMotionEnabled={config.cameraMotionEnabled}
                  force2DFallback={force2DFallback}
                  stageLabel="Khởi hành chân núi"
                />
              </div>

              {/* Pre-game Rule Preview Box */}
              <div className="rounded-2xl bg-[#0F2D52] border border-cyan-400/25 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Flag className="w-4 h-4" />
                    Tóm tắt luật chơi trước khi bắt đầu
                  </span>
                  <span className="text-amber-300 font-black tabular-nums">
                    {effectiveSetupQuestionCount} câu · 3 chặng
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-200">
                  <div className="bg-[#08172E] rounded-xl p-2.5">
                    <div className="text-[11px] text-slate-400">Chế độ</div>
                    <div className="font-extrabold text-white">
                      {config.playMode === 'JOURNEY'
                        ? 'Hành trình ôn tập'
                        : 'Chinh phục theo điểm'}
                    </div>
                  </div>
                  <div className="bg-[#08172E] rounded-xl p-2.5 tabular-nums">
                    <div className="text-[11px] text-slate-400">Tổng điểm tối đa</div>
                    <div className="font-extrabold text-amber-300">
                      {setupMaxPossibleScore} điểm ({config.pointsPerQuestion}đ/câu)
                    </div>
                  </div>
                  <div className="bg-[#08172E] rounded-xl p-2.5">
                    <div className="text-[11px] text-slate-400">Điều kiện lên đỉnh</div>
                    <div className="font-extrabold text-emerald-300">
                      {config.playMode === 'JOURNEY'
                        ? `Hoàn thành ${effectiveSetupQuestionCount}/${effectiveSetupQuestionCount} trạm`
                        : `Đạt ≥ ${config.summitThreshold} điểm`}
                    </div>
                  </div>
                  <div className="bg-[#08172E] rounded-xl p-2.5">
                    <div className="text-[11px] text-slate-400">Quy tắc Gợi ý & Xếp hạng</div>
                    <div className="font-extrabold text-cyan-200">
                      {config.hintsEnabled ? 'Dùng gợi ý: còn 50% điểm' : 'Không dùng gợi ý'} · Đồng điểm đồng hạng
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Configuration Panel */}
            <div className="xl:col-span-7 rounded-2xl bg-[#0F2D52] border border-white/10 p-4 sm:p-5 space-y-4">
              {/* Row 1: Play Mode */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-cyan-300 block">
                  1. Chọn chế độ chơi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, playMode: 'JOURNEY' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      config.playMode === 'JOURNEY'
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md'
                        : 'bg-[#08172E] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white">
                        Hành trình ôn tập
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/25 text-emerald-300 text-[10px] font-black">
                        Mặc định
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Cả đoàn tiến đều 1 trạm sau mỗi câu. Sai vẫn đi tiếp cùng lớp, tính điểm để ôn tập nhẹ nhàng.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, playMode: 'CONQUEST' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      config.playMode === 'CONQUEST'
                        ? 'bg-amber-500/20 border-amber-400 shadow-md'
                        : 'bg-[#08172E] border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-white">
                        Chinh phục theo điểm
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-500/25 text-amber-300 text-[10px] font-black">
                        Đặt ngưỡng đỉnh
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">
                      Đúng mới tăng cao độ ({`score / ngưỡng`}). Sai đứng nguyên tại trạm, không tụt lùi, chạm ngưỡng mới lên đỉnh.
                    </p>
                  </button>
                </div>
              </div>

              {/* Row 2: Organization Mode */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-cyan-300 block">
                  2. Hình thức tham gia
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'CLASS', label: 'Cả lớp (1 màn hình)' },
                      { id: 'INDIVIDUAL', label: 'Cá nhân (1–50 HS)' },
                      { id: 'TEAMS', label: 'Theo đội (2–6 đội)' },
                    ] as { id: C08OrgMode; label: string }[]
                  ).map((org) => (
                    <button
                      key={org.id}
                      type="button"
                      onClick={() => setConfig((p) => ({ ...p, orgMode: org.id }))}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                        config.orgMode === org.id
                          ? 'bg-cyan-400 text-slate-950 border-cyan-300'
                          : 'bg-[#08172E] text-slate-200 border-white/10 hover:border-white/25'
                      }`}
                    >
                      {org.label}
                    </button>
                  ))}
                </div>

                {/* Sub-panel for INDIVIDUAL or TEAMS */}
                {config.orgMode === 'INDIVIDUAL' && (
                  <div className="rounded-xl bg-[#08172E] border border-white/10 p-3 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'CLASS_ROSTER', label: `Danh sách lớp (${availableCandidates.length})` },
                          { id: 'SAMPLE_1', label: '1 HS mẫu' },
                          { id: 'SAMPLE_50', label: '50 HS mẫu' },
                          { id: 'CUSTOM_TEMP', label: 'Nhập nhanh danh sách' },
                        ] as { id: IndividualRosterSource; label: string }[]
                      ).map((src) => (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => setIndividualSource(src.id)}
                          className={`px-2.5 py-1.5 rounded-lg font-bold cursor-pointer ${
                            individualSource === src.id
                              ? 'bg-cyan-500 text-slate-950'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                        >
                          {src.label}
                        </button>
                      ))}
                    </div>

                    {individualSource === 'CLASS_ROSTER' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-slate-300">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>Lớp:</span>
                          <select
                            value={selectedSourceKey}
                            onChange={(e) => onSelectSourceKey(e.target.value)}
                            className="bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1 text-white font-bold"
                          >
                            {classes.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                            <option value="manual">Danh sách tự do</option>
                          </select>
                          <span className="text-cyan-300 font-bold">
                            Có mặt: {availableCandidates.length}/{allCandidates.length}
                            {absentIds.size > 0 ? ` (Vắng ${absentIds.size})` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={onOpenAbsentModal}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold cursor-pointer"
                        >
                          Điểm danh / Sửa DS
                        </button>
                      </div>
                    )}

                    {individualSource === 'CUSTOM_TEMP' && (
                      <div className="space-y-1">
                        <textarea
                          rows={3}
                          value={customTempNamesText}
                          onChange={(e) => setCustomTempNamesText(e.target.value)}
                          placeholder="Mỗi dòng 1 tên học sinh (tối đa 50)..."
                          className="w-full rounded-lg bg-slate-900 border border-white/15 p-2 text-white text-xs"
                        />
                        <p className="text-[11px] text-slate-400">
                          Danh sách tạm chỉ dùng cho phiên chơi này, không tạo tài khoản thật. Hiện có{' '}
                          <strong className="text-cyan-300">{setupParticipantsPreview.length}</strong> học sinh.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {config.orgMode === 'TEAMS' && (
                  <div className="rounded-xl bg-[#08172E] border border-white/10 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200">Số lượng đội (2–6 đội):</span>
                      <div className="flex items-center gap-1">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setTeamCount(cnt)}
                            className={`w-7 h-7 rounded-lg font-black cursor-pointer ${
                              teamCount === cnt
                                ? 'bg-cyan-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Array.from({ length: teamCount }, (_, i) => (
                        <input
                          key={i}
                          type="text"
                          value={teamNames[i] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeamNames((prev) => {
                              const next = [...prev];
                              next[i] = val;
                              return next;
                            });
                          }}
                          placeholder={`Đội ${i + 1}`}
                          className="bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Dataset & Question Bank */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-cyan-300 block">
                  3. Nguồn câu hỏi
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: 'SAMPLE_MATH',
                        title: 'Toán THCS · Hình học',
                        badge: 'Dữ liệu mẫu · 12 câu',
                      },
                      {
                        id: 'SAMPLE_INFORMATICS',
                        title: 'Tin học THCS · Số hóa',
                        badge: 'Dữ liệu mẫu · 12 câu',
                      },
                      {
                        id: 'QUESTION_BANK',
                        title: 'Ngân hàng câu hỏi',
                        badge: `${validBankPool.length} câu hợp lệ`,
                      },
                    ] as { id: C08DatasetKey; title: string; badge: string }[]
                  ).map((ds) => (
                    <button
                      key={ds.id}
                      type="button"
                      onClick={() => setConfig((p) => ({ ...p, datasetKey: ds.id }))}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        config.datasetKey === ds.id
                          ? 'bg-cyan-500/20 border-cyan-400'
                          : 'bg-[#08172E] border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-black text-white">{ds.title}</div>
                      <div className="text-[11px] font-bold text-amber-300 mt-0.5">{ds.badge}</div>
                    </button>
                  ))}
                </div>

                {setupBankShortage && (
                  <div className="rounded-xl bg-amber-950/70 border border-amber-400/40 p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
                    <span>
                      Ngân hàng hiện chỉ có <strong>{validBankPool.length}</strong> câu đã duyệt (ít hơn{' '}
                      {config.questionCount} câu). Hệ thống tuyệt đối không lặp câu.
                    </span>
                    <button
                      type="button"
                      onClick={() => setConfig((p) => ({ ...p, questionCount: 'ALL' }))}
                      className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black cursor-pointer"
                    >
                      Dùng đủ {validBankPool.length} câu
                    </button>
                  </div>
                )}

                {config.datasetKey === 'QUESTION_BANK' && validBankPool.length === 0 && (
                  <div className="rounded-xl bg-rose-950/70 border border-rose-400/40 p-2.5 text-xs text-rose-100 font-semibold">
                    Ngân hàng câu hỏi chưa có câu trắc nghiệm / trả lời ngắn đã duyệt. Vui lòng chọn một trong hai bộ Dữ liệu mẫu ở trên.
                  </div>
                )}
              </div>

              {/* Row 4: Rules, Points, Threshold, Timer & Graphics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-300 font-bold block">Số câu hỏi</span>
                  <select
                    value={String(config.questionCount)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setConfig((p) => ({
                        ...p,
                        questionCount: v === 'ALL' ? 'ALL' : (Number(v) as C08QuestionCountOption),
                      }));
                    }}
                    className="w-full bg-[#08172E] border border-white/15 rounded-xl px-2.5 py-2 text-white font-bold"
                  >
                    <option value="5">5 câu</option>
                    <option value="10">10 câu</option>
                    <option value="12">12 câu (3 chặng)</option>
                    <option value="15">15 câu</option>
                    <option value="ALL">Tất cả ({rawDatasetPool.length} câu)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-300 font-bold block">Điểm / câu</span>
                  <select
                    value={config.pointsPerQuestion}
                    onChange={(e) => {
                      const pts = Number(e.target.value);
                      setConfig((p) => ({
                        ...p,
                        pointsPerQuestion: pts,
                        summitThreshold:
                          effectiveSetupQuestionCount === 12 && pts === 10
                            ? 100
                            : Math.max(pts, Math.round(effectiveSetupQuestionCount * pts * 0.8)),
                      }));
                    }}
                    className="w-full bg-[#08172E] border border-white/15 rounded-xl px-2.5 py-2 text-white font-bold"
                  >
                    <option value={5}>5 điểm</option>
                    <option value={10}>10 điểm</option>
                    <option value={15}>15 điểm</option>
                    <option value={20}>20 điểm</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-300 font-bold block">Thời gian / câu</span>
                  <select
                    value={config.timeLimitSec}
                    onChange={(e) =>
                      setConfig((p) => ({
                        ...p,
                        timeLimitSec: Number(e.target.value) as C08TimeLimitSec,
                      }))
                    }
                    className="w-full bg-[#08172E] border border-white/15 rounded-xl px-2.5 py-2 text-white font-bold"
                  >
                    <option value={0}>Không giới hạn</option>
                    <option value={30}>30 giây</option>
                    <option value={45}>45 giây</option>
                    <option value={60}>60 giây</option>
                    <option value={90}>90 giây</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-300 font-bold block">
                    {config.playMode === 'CONQUEST' ? 'Ngưỡng lên đỉnh' : 'Đồ họa 3D'}
                  </span>
                  {config.playMode === 'CONQUEST' ? (
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, setupMaxPossibleScore)}
                      value={config.summitThreshold}
                      onChange={(e) =>
                        setConfig((p) => ({
                          ...p,
                          summitThreshold: Number(e.target.value) || 0,
                        }))
                      }
                      className={`w-full bg-[#08172E] border rounded-xl px-2.5 py-2 text-amber-300 font-black tabular-nums ${
                        setupThresholdError ? 'border-rose-500' : 'border-amber-400/40'
                      }`}
                    />
                  ) : (
                    <select
                      value={force2DFallback ? '2D' : config.qualityPreset}
                      onChange={(e) => {
                        if (e.target.value === '2D') {
                          setForce2DFallback(true);
                        } else {
                          setForce2DFallback(false);
                          setConfig((p) => ({
                            ...p,
                            qualityPreset: e.target.value as C08QualityPreset,
                          }));
                        }
                      }}
                      className="w-full bg-[#08172E] border border-white/15 rounded-xl px-2.5 py-2 text-white font-bold"
                    >
                      <option value="HIGH">3D Cao</option>
                      <option value="MEDIUM">3D Chuẩn</option>
                      <option value="LOW">3D Nhẹ</option>
                      <option value="2D">Bản đồ 2D nhẹ</option>
                    </select>
                  )}
                </div>
              </div>

              {setupThresholdError && (
                <div className="text-xs text-rose-300 font-bold bg-rose-950/60 border border-rose-500/40 rounded-xl px-3 py-2">
                  Ngưỡng lên đỉnh phải lớn hơn 0 và không vượt quá tổng điểm tối đa ({setupMaxPossibleScore}đ).
                </div>
              )}

              {/* Toggles Row */}
              <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-bold">
                  <input
                    type="checkbox"
                    checked={config.hintsEnabled}
                    onChange={(e) => setConfig((p) => ({ ...p, hintsEnabled: e.target.checked }))}
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <span>Cho phép Gợi ý (-50% điểm câu)</span>
                </label>

                {config.playMode === 'JOURNEY' && (
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-bold">
                    <input
                      type="checkbox"
                      checked={config.showJourneyScoreboard}
                      onChange={(e) =>
                        setConfig((p) => ({ ...p, showJourneyScoreboard: e.target.checked }))
                      }
                      className="accent-cyan-400 w-4 h-4"
                    />
                    <span>Hiện bảng điểm ôn tập</span>
                  </label>
                )}

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-bold">
                  <input
                    type="checkbox"
                    checked={config.reducedMotion}
                    onChange={(e) => setConfig((p) => ({ ...p, reducedMotion: e.target.checked }))}
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <span>Giảm chuyển động</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-200 font-bold">
                  <input
                    type="checkbox"
                    checked={config.voiceEnabled}
                    onChange={(e) => setConfig((p) => ({ ...p, voiceEnabled: e.target.checked }))}
                    className="accent-cyan-400 w-4 h-4"
                  />
                  <span>Nút đọc Tiếng Việt</span>
                </label>
              </div>

              {/* Start Action Button */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/10">
                <div className="text-xs text-slate-300">
                  Sẵn sàng với{' '}
                  <strong className="text-cyan-300">{setupParticipantsPreview.length}</strong>{' '}
                  {config.orgMode === 'TEAMS' ? 'đội' : 'người/đoàn'} và{' '}
                  <strong className="text-amber-300">{effectiveSetupQuestionCount}</strong> câu hỏi.
                </div>

                <button
                  type="button"
                  disabled={
                    setupParticipantsPreview.length === 0 ||
                    effectiveSetupQuestionCount === 0 ||
                    setupThresholdError
                  }
                  onClick={handleStartNewExpedition}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm sm:text-base flex items-center gap-2 shadow-xl cursor-pointer transition-all"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>Bắt đầu leo núi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* ACTIVE GAMEPLAY STAGE                                                */}
      {/* ==================================================================== */}
      {stagePhase !== 'SETUP' && stagePhase !== 'FINISHED' && stagePhase !== 'STAGE_SUMMARY' && (
        <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch flex-1">
          {/* 3D MOUNTAIN VIEWPORT (Prominent during MOVING/CONFIRMED, persistent side/top during ANSWERING) */}
          <div
            className={`${
              mountainPrimary ? 'lg:col-span-7 min-h-[420px] lg:min-h-[560px]' : 'lg:col-span-5 min-h-[300px] lg:min-h-[520px]'
            } flex flex-col gap-3`}
          >
            <div className="flex-1 min-h-[300px] rounded-2xl overflow-hidden">
              <MountainClimb3DScene
                entities={mountainEntities}
                playMode={config.playMode}
                summitThreshold={config.summitThreshold}
                maxPossibleScore={activeMaxPossibleScore}
                qualityPreset={config.qualityPreset}
                reducedMotion={config.reducedMotion}
                cameraPreset={cameraPreset}
                cameraMotionEnabled={config.cameraMotionEnabled}
                force2DFallback={force2DFallback}
                stageLabel={currentStage.stageName}
                compactBackdrop={false}
                onAnimationSettled={() => {
                  setStagePhase((prev) => (prev === 'MOVING' ? 'CONFIRMED' : prev));
                }}
              />
            </div>

            {/* Live Compact Standings Ribbon under/beside 3D view */}
            {(config.playMode === 'CONQUEST' || config.showJourneyScoreboard) && (
              <div className="rounded-2xl bg-[#0F2D52] border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-cyan-300 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span>Bảng cao độ & Điểm số ({rankedEntities.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLeaderboardDrawer((v) => !v)}
                    className="text-[11px] font-bold text-slate-300 hover:text-white cursor-pointer"
                  >
                    {showLeaderboardDrawer ? 'Thu gọn' : 'Mở rộng'}
                  </button>
                </div>

                {showLeaderboardDrawer && (
                  <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                    {rankedEntities.map((item) => (
                      <div
                        key={item.participant.participantId}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#08172E] border border-white/10 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-slate-400 tabular-nums w-5">
                            #{item.rank}
                          </span>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.participant.colorHex }}
                          />
                          <span className="font-bold text-white truncate">
                            {item.participant.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 tabular-nums">
                          <span className="font-black text-amber-300">{item.score}đ</span>
                          <span className="text-cyan-300 font-bold">
                            {Math.round(item.progress * 100)}%
                          </span>
                          {item.reachedSummit && (
                            <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* QUESTION / GRADING / CONFIRMATION PANEL */}
          <div
            className={`${
              mountainPrimary ? 'lg:col-span-5' : 'lg:col-span-7'
            } rounded-2xl bg-[#0F2D52] border border-cyan-400/25 p-4 sm:p-5 flex flex-col justify-between gap-4 relative`}
          >
            {/* Unreachable Summit Neutral Notice (CONQUEST) */}
            {thresholdUnreachableForAll && (
              <div className="rounded-xl bg-amber-950/80 border border-amber-400/40 px-3 py-2 text-xs text-amber-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Với số câu còn lại, tổng điểm tối đa có thể đạt là{' '}
                  <strong>{highestReachableScore}đ</strong> (thấp hơn ngưỡng {config.summitThreshold}đ). Hãy tiếp tục hoàn thành để ghi nhận kết quả cao nhất!
                </span>
              </div>
            )}

            {/* Top Meta Row of Question Card */}
            {currentQuestion && (
              <div className="space-y-3 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-extrabold">
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                      Câu {currentQuestionIndex + 1}/{totalQuestions}
                    </span>
                    {currentQuestion.topic && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200">
                        {currentQuestion.topic}
                      </span>
                    )}
                    {currentQuestion.difficultyLabel && (
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/25 text-indigo-200">
                        {currentQuestion.difficultyLabel}
                      </span>
                    )}
                    {currentQuestion.isSample && (
                      <span className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200">
                        Dữ liệu mẫu
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-black">
                      +{currentQuestionMaxPts}đ
                    </span>

                    {config.timeLimitSec > 0 && stagePhase === 'ANSWERING' && (
                      <span
                        className={`px-2.5 py-1 rounded-lg border text-xs font-black flex items-center gap-1 ${
                          remainingMs <= 8000
                            ? 'bg-rose-500/30 border-rose-400 text-rose-200 animate-pulse'
                            : 'bg-slate-900 border-white/15 text-amber-300'
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>{Math.ceil(remainingMs / 1000)}s</span>
                      </span>
                    )}

                    {config.voiceEnabled && stagePhase === 'ANSWERING' && !isPaused && (
                      <button
                        type="button"
                        onClick={handleSpeakQuestion}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Đọc câu hỏi bằng Tiếng Việt"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Đọc đề</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* PAUSE MASK OVERLAY */}
                {isPaused && stagePhase === 'ANSWERING' ? (
                  <div className="flex-1 min-h-[260px] rounded-2xl bg-[#08172E] border-2 border-amber-400/50 p-6 flex flex-col items-center justify-center text-center gap-4">
                    <Pause className="w-12 h-12 text-amber-400" />
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-white">ĐANG TẠM DỪNG</h3>
                      <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                        Đề bài, các phương án trả lời và đồng hồ đếm ngược đã được ẩn & khóa tạm thời. Nhấn Tiếp tục để hiển thị lại câu hỏi.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="px-6 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>Tiếp tục trò chơi</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Question Stem & Optional Image */}
                    {(stagePhase === 'ANSWERING' ||
                      stagePhase === 'REVEALED' ||
                      stagePhase === 'GRADING') && (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-[#08172E] border border-white/10 p-4 text-base sm:text-lg font-bold text-white leading-relaxed">
                          <MathView content={currentQuestion.stem} />
                        </div>

                        {currentQuestion.imageUrl && (
                          <div className="rounded-xl overflow-hidden bg-slate-950 border border-white/10 max-h-52 flex items-center justify-center">
                            {!mediaError ? (
                              <img
                                src={currentQuestion.imageUrl}
                                alt="Hình minh họa câu hỏi"
                                onLoad={() => setMediaReady(true)}
                                onError={() => {
                                  setMediaError(true);
                                  setMediaReady(true);
                                }}
                                className="max-h-52 object-contain"
                              />
                            ) : (
                              <div className="p-4 text-xs text-amber-300 font-semibold">
                                Không tải được ảnh minh họa — câu hỏi vẫn hiển thị bình thường.
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hint Controls & Display */}
                        {config.hintsEnabled && stagePhase === 'ANSWERING' && (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            {currentQuestion.hint ? (
                              !currentHintUsed ? (
                                <button
                                  type="button"
                                  onClick={handleUseHint}
                                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Lightbulb className="w-4 h-4 text-amber-300" />
                                  <span>
                                    Dùng gợi ý (điểm câu còn{' '}
                                    {getQuestionMaxPoints(
                                      config.pointsPerQuestion,
                                      true,
                                      true
                                    )}
                                    /{config.pointsPerQuestion}đ)
                                  </span>
                                </button>
                              ) : (
                                <div className="w-full rounded-xl bg-amber-950/75 border border-amber-400/45 p-3 text-xs sm:text-sm text-amber-100 flex items-start gap-2">
                                  <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-black text-amber-300 mr-1.5">
                                      Gợi ý (còn {currentQuestionMaxPts}đ):
                                    </span>
                                    <MathView content={currentQuestion.hint} />
                                  </div>
                                </div>
                              )
                            ) : (
                              <span className="text-[11px] text-slate-400 font-semibold">
                                Câu hỏi này không có gợi ý (không trừ điểm).
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* PHASE: ANSWERING (CLASS vs INDIVIDUAL/TEAMS) */}
                    {stagePhase === 'ANSWERING' && (
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        {currentQuestion.questionType !== 'SHORT_ANSWER' ? (
                          <div
                            className={`grid gap-2.5 ${
                              currentDisplayOptions.length === 2
                                ? 'grid-cols-1 sm:grid-cols-2'
                                : 'grid-cols-1 sm:grid-cols-2'
                            }`}
                          >
                            {currentDisplayOptions.map((opt) => {
                              const isSelected =
                                config.orgMode === 'CLASS' &&
                                currentSelectedOptionId === opt.optionId;
                              return (
                                <button
                                  key={opt.optionId}
                                  type="button"
                                  disabled={config.orgMode !== 'CLASS'}
                                  onClick={() => {
                                    if (config.orgMode !== 'CLASS') return;
                                    setCurrentSelectedOptionId(opt.optionId);
                                    soundRef.current?.playLockIn(isMuted);
                                  }}
                                  className={`p-3.5 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                                    config.orgMode === 'CLASS' ? 'cursor-pointer' : 'cursor-default'
                                  } ${
                                    isSelected
                                      ? 'bg-cyan-500/25 border-cyan-300 shadow-lg ring-2 ring-cyan-400/50'
                                      : 'bg-[#08172E] border-white/15 hover:border-cyan-400/50'
                                  }`}
                                >
                                  <span
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                      isSelected
                                        ? 'bg-cyan-400 text-slate-950'
                                        : 'bg-slate-800 text-cyan-300'
                                    }`}
                                  >
                                    {opt.displayLabel}
                                  </span>
                                  <span className="text-sm sm:text-base font-bold text-white pt-0.5">
                                    <MathView content={opt.text} />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-xl bg-[#08172E] border border-white/10 p-3.5 space-y-2 text-xs text-slate-300">
                            <span className="font-bold text-cyan-200 block">
                              Câu hỏi trả lời ngắn
                            </span>
                            {config.orgMode === 'CLASS' && (
                              <input
                                type="text"
                                value={classShortAnswerText}
                                onChange={(e) => setClassShortAnswerText(e.target.value)}
                                placeholder="Nhập nhanh câu trả lời của lớp (không bắt buộc)..."
                                className="w-full rounded-xl bg-slate-900 border border-white/15 px-3 py-2 text-sm text-white font-bold"
                              />
                            )}
                          </div>
                        )}

                        {/* Answering Bottom Action Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          {config.orgMode === 'CLASS' ? (
                            <>
                              <button
                                type="button"
                                onClick={handleClassMarkNoAnswer}
                                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                              >
                                Chưa có đáp án (0đ)
                              </button>
                              {currentQuestion.questionType !== 'SHORT_ANSWER' ? (
                                <button
                                  type="button"
                                  disabled={!currentSelectedOptionId}
                                  onClick={handleClassLockInAnswer}
                                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                                >
                                  <Check className="w-4 h-4" />
                                  <span>Chốt đáp án</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleClassLockInAnswer}
                                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>Mở đáp án & Chấm điểm</span>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-xs text-slate-300">
                                Học sinh/đội trả lời xong, giáo viên bấm mở đáp án để chấm điểm.
                              </span>
                              <button
                                type="button"
                                onClick={handleOpenGradingSheet}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                                <span>Mở đáp án & Chấm điểm</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* PHASE: REVEALED (CLASS Short-Answer Teacher Check) */}
                    {stagePhase === 'REVEALED' && (
                      <div className="space-y-3">
                        <div className="rounded-xl bg-emerald-950/75 border border-emerald-400/40 p-3.5 space-y-1.5">
                          <div className="text-xs font-black text-emerald-300 uppercase">
                            Đáp án đúng:
                          </div>
                          <div className="text-base font-black text-white">
                            <MathView content={currentQuestion.correctAnswerText} />
                          </div>
                          {classShortAnswerText.trim() && (
                            <div className="text-xs text-cyan-200 pt-1">
                              Câu trả lời đã ghi: <strong>{classShortAnswerText}</strong>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => handleClassShortAnswerSelfMark('CORRECT')}
                            className="py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                          >
                            Đúng (+{currentQuestionMaxPts}đ)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClassShortAnswerSelfMark('WRONG')}
                            className="py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs sm:text-sm cursor-pointer"
                          >
                            Chưa đúng (0đ)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClassShortAnswerSelfMark('NO_ANSWER')}
                            className="py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs sm:text-sm cursor-pointer"
                          >
                            Không trả lời
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PHASE: GRADING SHEET (INDIVIDUAL 1..50 / TEAMS 2..6) */}
                    {stagePhase === 'GRADING' && (
                      <div className="space-y-3 flex-1 flex flex-col">
                        <div className="rounded-xl bg-emerald-950/75 border border-emerald-400/40 p-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-black uppercase text-emerald-300 block">
                              Đáp án chuẩn
                            </span>
                            <span className="text-sm sm:text-base font-black text-white">
                              <MathView content={currentQuestion.correctAnswerText} />
                            </span>
                          </div>
                          <span className="text-xs font-black text-amber-300 tabular-nums">
                            {ungradedCount > 0
                              ? `Còn ${ungradedCount}/${participants.length} chưa chấm`
                              : 'Đã chấm đủ 100%'}
                          </span>
                        </div>

                        {/* Search + Filter + Explicit-scope Batch Mark */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={gradingSearch}
                                onChange={(e) => setGradingSearch(e.target.value)}
                                placeholder="Tìm tên hoặc STT..."
                                className="w-full bg-[#08172E] border border-white/15 rounded-lg pl-8 pr-2.5 py-1.5 text-white text-xs"
                              />
                            </div>
                            <select
                              value={gradingFilter}
                              onChange={(e) =>
                                setGradingFilter(e.target.value as typeof gradingFilter)
                              }
                              className="bg-[#08172E] border border-white/15 rounded-lg px-2 py-1.5 text-white text-xs font-bold"
                            >
                              <option value="ALL">Tất cả ({participants.length})</option>
                              <option value="UNGRADED">Chưa chấm ({ungradedCount})</option>
                              <option value="CORRECT">Đúng</option>
                              <option value="WRONG">Chưa đúng</option>
                              <option value="NO_ANSWER">Trống</option>
                            </select>
                          </div>

                          <div className="flex flex-wrap items-center gap-1">
                            <span className="text-[11px] text-slate-300 font-bold mr-1">
                              Mục chưa chấm:
                            </span>
                            <button
                              type="button"
                              disabled={ungradedCount === 0}
                              onClick={() => handleBatchMarkUngraded('CORRECT')}
                              className="px-2 py-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/40 disabled:opacity-40 text-emerald-200 font-bold cursor-pointer"
                            >
                              Đúng hết
                            </button>
                            <button
                              type="button"
                              disabled={ungradedCount === 0}
                              onClick={() => handleBatchMarkUngraded('WRONG')}
                              className="px-2 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 disabled:opacity-40 text-rose-200 font-bold cursor-pointer"
                            >
                              Sai hết
                            </button>
                            <button
                              type="button"
                              disabled={ungradedCount === 0}
                              onClick={() => handleBatchMarkUngraded('NO_ANSWER')}
                              className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 font-bold cursor-pointer"
                            >
                              Trống hết
                            </button>
                          </div>
                        </div>

                        {/* Grading Rows */}
                        <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                          {filteredGradingParticipants.map((p) => {
                            const status = draftMarks[p.participantId] || 'UNGRADED';
                            const prevEnt = previewEntities.find(
                              (e) => e.participant.participantId === p.participantId
                            );
                            return (
                              <div
                                key={p.participantId}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#08172E] border border-white/10 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: p.colorHex }}
                                  />
                                  <span className="font-mono text-slate-400">{p.code}</span>
                                  <span className="font-bold text-white truncate max-w-[140px]">
                                    {p.name}
                                  </span>
                                  {prevEnt && (
                                    <span className="text-[11px] text-cyan-300 tabular-nums font-bold">
                                      → {prevEnt.score}đ ({Math.round(prevEnt.progress * 100)}%)
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkParticipant(p.participantId, 'CORRECT')}
                                    className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                                      status === 'CORRECT'
                                        ? 'bg-emerald-400 text-slate-950'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    Đúng
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkParticipant(p.participantId, 'WRONG')}
                                    className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                                      status === 'WRONG'
                                        ? 'bg-rose-500 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    Sai
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleMarkParticipant(p.participantId, 'NO_ANSWER')
                                    }
                                    className={`px-2.5 py-1 rounded-lg font-extrabold cursor-pointer ${
                                      status === 'NO_ANSWER'
                                        ? 'bg-slate-500 text-white'
                                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    }`}
                                  >
                                    Trống
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <span className="text-[11px] text-amber-200 font-semibold">
                            {ungradedCount > 0
                              ? 'Vui lòng chấm đủ tất cả thành viên trước khi xác nhận.'
                              : 'Sẵn sàng chốt điểm và cho nhân vật leo núi!'}
                          </span>
                          <button
                            type="button"
                            disabled={ungradedCount > 0}
                            onClick={() => handleConfirmRecord(draftMarks)}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                          >
                            Xác nhận & Leo núi
                          </button>
                        </div>
                      </div>
                    )}

                    {/* PHASE: MOVING / CONFIRMED */}
                    {(stagePhase === 'MOVING' || stagePhase === 'CONFIRMED') && currentRecord && (
                      <div className="space-y-3 flex-1 flex flex-col justify-between">
                        <div className="space-y-3">
                          <div className="rounded-xl bg-emerald-950/75 border border-emerald-400/45 p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-emerald-300 uppercase">
                                Kết quả & Giải thích kiến thức
                              </span>
                              <span className="text-amber-300 font-black tabular-nums">
                                Điểm tối đa lượt này: {currentRecord.maxPointsForQuestion}đ
                              </span>
                            </div>
                            <div className="text-sm sm:text-base font-black text-white">
                              Đáp án đúng: <MathView content={currentQuestion.correctAnswerText} />
                            </div>
                            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                              <MathView content={currentQuestion.explanation} />
                            </p>
                          </div>

                          {/* Class feedback or Team/Individual tally */}
                          <div className="rounded-xl bg-[#08172E] border border-white/10 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            {(() => {
                              const vals = Object.values(currentRecord.marks);
                              const c = vals.filter((v) => v === 'CORRECT').length;
                              const w = vals.filter((v) => v === 'WRONG').length;
                              const n = vals.filter((v) => v === 'NO_ANSWER').length;
                              return (
                                <div className="flex flex-wrap items-center gap-3 font-extrabold">
                                  <span className="text-emerald-300">Đúng: {c}</span>
                                  <span className="text-rose-300">Chưa đúng: {w}</span>
                                  <span className="text-slate-300">Không trả lời: {n}</span>
                                </div>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={handleOpenEditLastRecord}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Sửa kết quả câu vừa rồi</span>
                            </button>
                          </div>

                          {/* Inline Edit Last Question Drawer */}
                          {editingLastRecord && (
                            <div className="rounded-xl bg-slate-900 border border-amber-400/50 p-3 space-y-2 text-xs">
                              <div className="flex items-center justify-between font-black text-amber-300">
                                <span>Chỉnh sửa lại kết quả Câu {currentQuestionIndex + 1}</span>
                                <button
                                  type="button"
                                  onClick={() => setEditingLastRecord(false)}
                                  className="text-slate-300 hover:text-white cursor-pointer"
                                >
                                  Đóng
                                </button>
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-1.5">
                                {participants.map((p) => {
                                  const st = editLastDraftMarks[p.participantId] || 'NO_ANSWER';
                                  return (
                                    <div
                                      key={p.participantId}
                                      className="flex items-center justify-between gap-2 bg-[#08172E] px-2.5 py-1.5 rounded-lg"
                                    >
                                      <span className="font-bold text-white truncate">
                                        {p.name}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {(['CORRECT', 'WRONG', 'NO_ANSWER'] as const).map((val) => (
                                          <button
                                            key={val}
                                            type="button"
                                            onClick={() =>
                                              setEditLastDraftMarks((prev) => ({
                                                ...prev,
                                                [p.participantId]: val,
                                              }))
                                            }
                                            className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                                              st === val
                                                ? val === 'CORRECT'
                                                  ? 'bg-emerald-400 text-slate-950'
                                                  : val === 'WRONG'
                                                  ? 'bg-rose-500 text-white'
                                                  : 'bg-slate-500 text-white'
                                                : 'bg-slate-800 text-slate-300'
                                            }`}
                                          >
                                            {val === 'CORRECT'
                                              ? 'Đúng'
                                              : val === 'WRONG'
                                              ? 'Sai'
                                              : 'Trống'}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={handleSaveEditLastRecord}
                                  className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black cursor-pointer"
                                >
                                  Lưu & Tính lại điểm
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                          {stagePhase === 'MOVING' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (movingTimerRef.current) {
                                  window.clearTimeout(movingTimerRef.current);
                                  movingTimerRef.current = null;
                                }
                                setStagePhase('CONFIRMED');
                              }}
                              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                              <span>Bỏ qua hoạt ảnh</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleProceedAfterConfirmed}
                            className="ml-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm flex items-center gap-2 cursor-pointer"
                          >
                            <span>
                              {currentQuestionIndex >= totalQuestions - 1
                                ? 'Tổng kết đỉnh núi'
                                : currentQuestionIndex === currentStage.endIndex &&
                                  currentStage.stageNumber < 3
                                ? 'Tổng kết chặng'
                                : 'Câu tiếp theo'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STAGE SUMMARY BETWEEN STAGES                                         */}
      {/* ==================================================================== */}
      {stagePhase === 'STAGE_SUMMARY' && (
        <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-6 min-h-[380px] rounded-2xl overflow-hidden">
            <MountainClimb3DScene
              entities={computedEntities}
              playMode={config.playMode}
              summitThreshold={config.summitThreshold}
              maxPossibleScore={activeMaxPossibleScore}
              qualityPreset={config.qualityPreset}
              reducedMotion={config.reducedMotion}
              cameraPreset="OVERVIEW"
              cameraMotionEnabled={config.cameraMotionEnabled}
              force2DFallback={force2DFallback}
              stageLabel={`Hoàn thành ${currentStage.stageName}`}
            />
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-[#0F2D52] border border-cyan-400/35 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                  Hoàn thành Chặng {currentStage.stageNumber}/3
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {currentStage.stageName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  Các nhà leo núi đã vượt qua trạm nghỉ! Hãy xem bảng tổng kết tạm thời trước khi bước vào chặng tiếp theo.
                </p>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {rankedEntities.slice(0, 12).map((item) => (
                  <div
                    key={item.participant.participantId}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#08172E] border border-white/10 text-xs sm:text-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-black text-amber-300 tabular-nums">
                        Hạng {item.rank}
                      </span>
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.participant.colorHex }}
                      />
                      <span className="font-bold text-white truncate">
                        {item.participant.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums shrink-0">
                      <span className="text-emerald-300 font-bold">
                        {item.correctCount} đúng
                      </span>
                      <span className="font-black text-amber-300">{item.score}đ</span>
                      <span className="text-cyan-300 font-bold">
                        {Math.round(item.progress * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartNextStage}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Tiếp tục Chặng {currentStage.stageNumber + 1}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FINAL SUMMARY SCREEN                                                 */}
      {/* ==================================================================== */}
      {stagePhase === 'FINISHED' && (
        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-6 min-h-[380px] rounded-2xl overflow-hidden">
              <MountainClimb3DScene
                entities={computedEntities}
                playMode={config.playMode}
                summitThreshold={config.summitThreshold}
                maxPossibleScore={activeMaxPossibleScore}
                qualityPreset={config.qualityPreset}
                reducedMotion={config.reducedMotion}
                cameraPreset={cameraPreset}
                cameraMotionEnabled={config.cameraMotionEnabled}
                force2DFallback={force2DFallback}
                stageLabel="Tổng kết hành trình"
              />
            </div>

            <div className="lg:col-span-6 rounded-2xl bg-[#0F2D52] border border-amber-400/35 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <span className="text-xs font-black uppercase text-amber-300 tracking-wider">
                      Tổng kết C08 ·{' '}
                      {config.playMode === 'JOURNEY'
                        ? 'Hành trình ôn tập'
                        : 'Chinh phục theo điểm'}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      Kết quả Chinh phục Đỉnh Tri Thức
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllMountainModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-black cursor-pointer"
                  >
                    Xem toàn núi 3D
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs tabular-nums">
                  <div className="rounded-xl bg-[#08172E] p-3">
                    <div className="text-slate-400">Số câu hoàn thành</div>
                    <div className="text-base font-black text-white mt-0.5">
                      {records.length}/{totalQuestions}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#08172E] p-3">
                    <div className="text-slate-400">Điểm cao nhất</div>
                    <div className="text-base font-black text-amber-300 mt-0.5">
                      {summaryStats.maxParticipantScore}/{activeMaxPossibleScore}đ
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#08172E] p-3">
                    <div className="text-slate-400">Lượt đúng / Sai / Trống</div>
                    <div className="text-sm font-black mt-0.5">
                      <span className="text-emerald-300">{summaryStats.totalCorrect}</span> ·{' '}
                      <span className="text-rose-300">{summaryStats.totalWrong}</span> ·{' '}
                      <span className="text-slate-300">{summaryStats.totalNoAnswer}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#08172E] p-3">
                    <div className="text-slate-400">Gợi ý đã dùng</div>
                    <div className="text-base font-black text-cyan-300 mt-0.5">
                      {summaryStats.hintsUsedCount} lượt
                    </div>
                  </div>
                </div>

                {/* Summit Conquerors Recognition */}
                <div className="rounded-xl bg-[#08172E] border border-amber-400/30 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
                    <Flag className="w-4 h-4" />
                    <span>
                      {config.playMode === 'CONQUEST'
                        ? `Danh sách chạm đỉnh (≥ ${config.summitThreshold}đ)`
                        : 'Đoàn hoàn thành hành trình lên đỉnh'}
                    </span>
                  </div>
                  {summaryStats.summitWinners.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {summaryStats.summitWinners.map((w) => (
                        <span
                          key={w.participant.participantId}
                          className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-100 text-xs font-extrabold tabular-nums"
                        >
                          {w.participant.name} ({w.score}đ)
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300 font-semibold">
                      Chưa có người chơi/đội nào đạt ngưỡng {config.summitThreshold} điểm để chạm Đỉnh Tri Thức. Hãy ôn lại các câu chưa đúng và thử sức lại!
                    </p>
                  )}
                </div>

                {/* Final Ranking Table */}
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {rankedEntities.map((item) => (
                    <div
                      key={item.participant.participantId}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#08172E] border border-white/10 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-black text-amber-300 tabular-nums">
                          Hạng {item.rank}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.participant.colorHex }}
                        />
                        <span className="font-bold text-white truncate">
                          {item.participant.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums shrink-0">
                        <span className="text-emerald-300 font-bold">
                          {item.correctCount}đúng
                        </span>
                        <span className="font-black text-amber-300">{item.score}đ</span>
                        <span className="text-cyan-300 font-bold">
                          {Math.round(item.progress * 100)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReplaySameConfig}
                  className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                >
                  Chơi lại bộ này
                </button>
                <button
                  type="button"
                  onClick={handleReturnToSetup}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Chọn bộ khác / Đổi chế độ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearC08PersistedSession();
                    onCloseGame();
                  }}
                  className="ml-auto px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Về thư viện
                </button>
              </div>
            </div>
          </div>

          {/* Review Missed Knowledge (strictly played WRONG or NO_ANSWER) */}
          <div className="rounded-2xl bg-[#0F2D52] border border-white/10 p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-cyan-200 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-300" />
                <span>Kiến thức cần ôn lại ({missedKnowledgeItems.length} câu)</span>
              </h3>
            </div>

            {missedKnowledgeItems.length === 0 ? (
              <p className="text-xs sm:text-sm text-emerald-300 font-bold">
                Tuyệt vời! Toàn bộ các câu hỏi đã hoàn thành đều trả lời chính xác 100%.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {missedKnowledgeItems.map(({ rec, question, wrongCount, noAnsCount }) => (
                  <div
                    key={question.questionId}
                    className="rounded-xl bg-[#08172E] border border-white/10 p-3.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="text-cyan-300">
                        Câu {rec.questionNumber} · {question.topic || 'Kiến thức'}
                      </span>
                      <span className="text-amber-300">
                        {wrongCount > 0 ? `${wrongCount} chưa đúng` : ''}{' '}
                        {noAnsCount > 0 ? `${noAnsCount} bỏ trống` : ''}
                      </span>
                    </div>
                    <div className="font-bold text-white text-sm">
                      <MathView content={question.stem} />
                    </div>
                    <div className="text-emerald-300 font-extrabold">
                      Đáp án: <MathView content={question.correctAnswerText} />
                    </div>
                    <div className="text-slate-300 leading-relaxed">
                      <MathView content={question.explanation} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Mountain 3D Modal from Summary */}
      {showAllMountainModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white">Toàn cảnh Đỉnh Tri Thức 3D</h3>
            <button
              type="button"
              onClick={() => setShowAllMountainModal(false)}
              className="px-4 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
            >
              Đóng
            </button>
          </div>
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden">
            <MountainClimb3DScene
              entities={computedEntities}
              playMode={config.playMode}
              summitThreshold={config.summitThreshold}
              maxPossibleScore={activeMaxPossibleScore}
              qualityPreset={config.qualityPreset}
              reducedMotion={config.reducedMotion}
              cameraPreset="OVERVIEW"
              cameraMotionEnabled={config.cameraMotionEnabled}
              force2DFallback={force2DFallback}
              stageLabel="Toàn cảnh kết thúc"
            />
          </div>
        </div>
      )}

      {/* Confirm Return to Setup Modal */}
      {showConfirmResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0F2D52] border border-cyan-400/40 p-5 space-y-4">
            <h3 className="text-base font-black text-white">Quay lại màn hình Thiết lập?</h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Phiên leo núi hiện tại đã chấm {records.length}/{totalQuestions} câu. Quay lại Thiết lập sẽ đặt lại tiến trình để bạn chọn bộ câu hỏi hoặc chế độ mới.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Tiếp tục chơi
              </button>
              <button
                type="button"
                onClick={handleReturnToSetup}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                Đồng ý thiết lập lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MountainClimb3DGame;
