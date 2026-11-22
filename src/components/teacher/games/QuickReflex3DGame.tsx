import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  RotateCcw,
  ArrowLeft,
  Play,
  Pause,
  CheckCircle2,
  Edit3,
  Trophy,
  Sparkles,
  Users,
  User,
  BookOpen,
  SlidersHorizontal,
  Box,
  Layers,
  EyeOff,
  Eye,
  Volume1,
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
import { QuickReflex3DScene, ReflexConsoleVisualState } from './QuickReflex3DScene';
import {
  ReflexGameMode,
  ReflexOptionLetter,
  REFLEX_OPTION_LETTERS,
  ReflexMathParticipantMode,
  ReflexQuestionSourceKind,
  E03_SAMPLE_BADGE,
  E03_SAMPLE_PACK_TITLE,
  E03_DEVICE_TIMING_LABEL,
  E03_DEVICE_TIMING_NOTE,
  E03_SIGNAL_TIMEOUT_MS,
  E03_POINTS_PER_CORRECT,
  REFLEX_TEAM_PALETTES,
  SignalSessionFormat,
  SignalSessionState,
  createDefaultSignalConfig,
  createInitialSignalState,
  getTotalSignalTrials,
  getSignalTrialDisplayMeta,
  startSignalTrial,
  triggerSignalGo,
  recordSignalResponse,
  recordSignalTimeout,
  interruptSignalTrial,
  redoInterruptedSignalTrial,
  advanceToNextSignalTrial,
  computeSignalSummary,
  ReflexMathConfig,
  ReflexMathState,
  MathParticipantGradeChoice,
  createDefaultReflexMathConfig,
  createReflexTeams,
  getReflexParticipants,
  getCorrectOptionLabelForReflexQuestion,
  buildE03MathQuestionPool,
  validateReflexMathSetup,
  createInitialReflexMathState,
  createEmptyDraftGrades,
  areAllMathParticipantsGraded,
  getUngradedMathParticipantNames,
  commitReflexMathTurn,
  editCurrentReflexMathTurn,
  advanceReflexMathQuestion,
  computeMathStandingsFromHistory,
  loadE03Session,
  saveE03Session,
} from './quickReflex3dEngine';

export interface QuickReflex3DGameProps {
  bankQuestions?: Question[];
  userRole?: UserRole;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary?: () => void;
}

function stripLatexForSpeech(raw: string): string {
  return raw
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1 phần $2')
    .replace(/\\sqrt\{([^}]+)\}/g, 'căn bậc hai của $1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\times/g, ' nhân ')
    .replace(/\\%/g, ' phần trăm')
    .replace(/\\,|\\\(|\\\)|\\\[|\\\]|\$/g, ' ')
    .replace(/\{,\}/g, ' phẩy ')
    .replace(/\^2/g, ' bình phương')
    .replace(/\s+/g, ' ')
    .trim();
}

export const QuickReflex3DGame: React.FC<QuickReflex3DGameProps> = ({
  bankQuestions = [],
  userRole,
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Persisted session hydration (isolated automatically for /demo)
  const initialPersisted = useMemo(() => loadE03Session(), []);

  const [activeMode, setActiveMode] = useState<ReflexGameMode>(
    () => initialPersisted?.activeMode ?? 'signal'
  );

  // Audio & accessibility controls (synced with A01/A02)
  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled());
  const [hasVietnameseVoice, setHasVietnameseVoice] = useState<boolean>(true);
  const [force2D, setForce2D] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Audio controllers
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const turnTokenSeqRef = useRef<number>(1);
  const activeTurnTokenRef = useRef<string>('e03_tok_1');

  const rotateTurnToken = useCallback(() => {
    turnTokenSeqRef.current += 1;
    const tok = `e03_tok_${turnTokenSeqRef.current}`;
    activeTurnTokenRef.current = tok;
    soundBankRef.current?.stopAll();
    soundBankRef.current?.setActiveTurnToken(tok);
    voiceControllerRef.current?.stop();
    stopAllGlobalEduSpeech();
    return tok;
  }, []);

  useEffect(() => {
    const bank = new EduGameSoundBank();
    bank.setActiveTurnToken(activeTurnTokenRef.current);
    const voice = new EduGameVoiceController(null);
    soundBankRef.current = bank;
    voiceControllerRef.current = voice;

    const unsub = voice.subscribe((snap) => {
      setHasVietnameseVoice(snap.vietnameseVoices.length > 0);
    });
    setHasVietnameseVoice(voice.getSnapshot().vietnameseVoices.length > 0);

    return () => {
      unsub();
      bank.stopAll();
      bank.dispose();
      voice.stop();
      voice.dispose();
      stopAllGlobalEduSpeech();
    };
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        soundBankRef.current?.stopAll();
        voiceControllerRef.current?.stop();
        stopAllGlobalEduSpeech();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, []);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceControllerRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  // ==========================================================================
  // MODE 1 STATE: PHẢN XẠ TÍN HIỆU (SIGNAL REACTION)
  // ==========================================================================
  const [signalState, setSignalState] = useState<SignalSessionState>(
    () => initialPersisted?.signalState ?? createInitialSignalState(createDefaultSignalConfig('solo'))
  );
  const [showSignalSettings, setShowSignalSettings] = useState<boolean>(false);
  const [pressPulseSeq, setPressPulseSeq] = useState<number>(0);

  const signalStateRef = useRef<SignalSessionState>(signalState);
  useEffect(() => {
    signalStateRef.current = signalState;
  }, [signalState]);

  const attemptSeqRef = useRef<number>(1);
  const waitTimerRef = useRef<number | null>(null);
  const timeoutTimerRef = useRef<number | null>(null);
  // Blocks held-key carryover if Space was physically held when starting a trial
  const awaitingSpaceReleaseRef = useRef<boolean>(false);

  const clearSignalTimers = useCallback(() => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (timeoutTimerRef.current !== null) {
      window.clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearSignalTimers();
  }, [clearSignalTimers]);

  const handleStartSignalTrial = useCallback(() => {
    const cur = signalStateRef.current;
    if (cur.phase !== 'idle' && cur.phase !== 'interrupted') return;
    clearSignalTimers();
    soundBankRef.current?.unlock();
    const audioToken = rotateTurnToken();

    attemptSeqRef.current += 1;
    const next = startSignalTrial(cur, {
      attemptSeq: attemptSeqRef.current,
      participantLabel: cur.currentParticipantLabel,
    });
    signalStateRef.current = next;
    setSignalState(next);

    if (next.phase === 'waiting' && next.currentWaitDelayMs !== null) {
      const expectedTrialToken = next.activeTrialToken;
      // ZERO audio during waiting period!
      waitTimerRef.current = window.setTimeout(() => {
        waitTimerRef.current = null;
        // Synchronize signal appearance and monotonic start clock on the same animation frame
        requestAnimationFrame(() => {
          const latest = signalStateRef.current;
          if (latest.phase !== 'waiting' || latest.activeTrialToken !== expectedTrialToken) {
            return;
          }
          const goNowMs = performance.now();
          const goState = triggerSignalGo(latest, expectedTrialToken, goNowMs);
          signalStateRef.current = goState;
          setSignalState(goState);
          soundBankRef.current?.playReflexGoCue(isMuted, audioToken);

          // 3-second no-response timeout
          timeoutTimerRef.current = window.setTimeout(() => {
            timeoutTimerRef.current = null;
            const after = recordSignalTimeout(signalStateRef.current, expectedTrialToken);
            if (after.accepted) {
              signalStateRef.current = after.nextState;
              setSignalState(after.nextState);
              soundBankRef.current?.playReflexEarlyCue(isMuted, audioToken);
            }
          }, E03_SIGNAL_TIMEOUT_MS);
        });
      }, next.currentWaitDelayMs);
    }
  }, [clearSignalTimers, isMuted, rotateTurnToken]);

  const handleSignalResponseTap = useCallback(() => {
    const cur = signalStateRef.current;
    if (cur.phase !== 'waiting' && cur.phase !== 'go') return;

    const responseNowMs = performance.now();
    const { nextState, accepted, outcome } = recordSignalResponse(cur, {
      trialToken: cur.activeTrialToken,
      responseTimestampMs: responseNowMs,
    });
    if (!accepted) return;

    clearSignalTimers();
    signalStateRef.current = nextState;
    setSignalState(nextState);
    setPressPulseSeq((n) => n + 1);

    const tok = activeTurnTokenRef.current;
    if (outcome === 'valid') {
      soundBankRef.current?.playReflexResultCue(isMuted, tok);
    } else {
      soundBankRef.current?.playReflexEarlyCue(isMuted, tok);
    }
  }, [clearSignalTimers, isMuted]);

  const handleInterruptSignal = useCallback(
    (reason: string) => {
      const cur = signalStateRef.current;
      if (cur.phase !== 'waiting' && cur.phase !== 'go') return;
      clearSignalTimers();
      rotateTurnToken();
      const interrupted = interruptSignalTrial(cur, reason);
      signalStateRef.current = interrupted;
      setSignalState(interrupted);
    },
    [clearSignalTimers, rotateTurnToken]
  );

  const handleRedoInterrupted = useCallback(() => {
    const cur = signalStateRef.current;
    if (cur.phase !== 'interrupted') return;
    rotateTurnToken();
    const redone = redoInterruptedSignalTrial(cur);
    signalStateRef.current = redone;
    setSignalState(redone);
  }, [rotateTurnToken]);

  const handleAdvanceSignalTrial = useCallback(() => {
    const cur = signalStateRef.current;
    if (cur.phase !== 'result') return;
    clearSignalTimers();
    const tok = rotateTurnToken();
    const next = advanceToNextSignalTrial(cur);
    signalStateRef.current = next;
    setSignalState(next);
    if (next.phase === 'summary') {
      soundBankRef.current?.playReflexSummaryFanfare(isMuted, tok);
    }
  }, [clearSignalTimers, isMuted, rotateTurnToken]);

  const handleResetSignalSession = useCallback(
    (nextConfig = signalStateRef.current.config) => {
      clearSignalTimers();
      rotateTurnToken();
      const fresh = createInitialSignalState(nextConfig);
      signalStateRef.current = fresh;
      setSignalState(fresh);
    },
    [clearSignalTimers, rotateTurnToken]
  );

  // Interrupt active Signal measurement on tab switch or window blur
  useEffect(() => {
    if (activeMode !== 'signal') return;
    const onVisibility = () => {
      if (document.hidden) {
        handleInterruptSignal('Đã chuyển tab trình duyệt trong khi đang đo — lượt này được hủy để làm lại.');
      }
    };
    const onBlur = () => {
      handleInterruptSignal('Cửa sổ bị mất tiêu điểm trong khi đang đo — lượt này được hủy để làm lại.');
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [activeMode, handleInterruptSignal]);

  // ==========================================================================
  // MODE 2 STATE: TOÁN NHANH (QUICK MATH)
  // ==========================================================================
  const [mathConfig, setMathConfig] = useState<ReflexMathConfig>(
    () => initialPersisted?.mathState?.config ?? createDefaultReflexMathConfig('solo')
  );
  const [mathState, setMathState] = useState<ReflexMathState | null>(
    () => initialPersisted?.mathState ?? null
  );
  const [mathSetupOpen, setMathSetupOpen] = useState<boolean>(
    () => !(initialPersisted?.mathState && initialPersisted.mathState.questions.length > 0)
  );
  const [draftGrades, setDraftGrades] = useState<Record<string, MathParticipantGradeChoice>>({});
  const [isEditingLastMath, setIsEditingLastMath] = useState<boolean>(false);
  const [mathErrorMsg, setMathErrorMsg] = useState<string | null>(null);
  const [mathQuestionPainted, setMathQuestionPainted] = useState<boolean>(false);
  const [mathSecondsLeft, setMathSecondsLeft] = useState<number>(E03_POINTS_PER_CORRECT * 2);
  const [mathTimeExpired, setMathTimeExpired] = useState<boolean>(false);
  const [showReviewPanel, setShowReviewPanel] = useState<boolean>(false);

  const mathQuestionPool = useMemo(
    () =>
      buildE03MathQuestionPool({
        sourceKind: mathConfig.sourceKind,
        bankQuestions,
        userRole,
        subjectFilter: mathConfig.subjectFilter,
        gradeFilter: mathConfig.gradeFilter,
        levelFilter: mathConfig.levelFilter,
      }),
    [
      mathConfig.sourceKind,
      mathConfig.subjectFilter,
      mathConfig.gradeFilter,
      mathConfig.levelFilter,
      bankQuestions,
      userRole,
    ]
  );

  const mathSetupValidation = useMemo(
    () => validateReflexMathSetup(mathConfig, mathQuestionPool.length),
    [mathConfig, mathQuestionPool.length]
  );

  const availableSubjects = useMemo(() => {
    const s = new Set<string>();
    bankQuestions.forEach((q) => {
      if (q.subject) s.add(q.subject);
    });
    return Array.from(s);
  }, [bankQuestions]);

  const availableGrades = useMemo(() => {
    const g = new Set<string>();
    bankQuestions.forEach((q) => {
      if (q.grade) g.add(q.grade);
    });
    return Array.from(g).sort();
  }, [bankQuestions]);

  const currentMathQuestion = useMemo(() => {
    if (!mathState || mathState.status === 'finished') return null;
    return mathState.questions[mathState.currentIndex] ?? null;
  }, [mathState]);

  const currentMathTurnRecord = useMemo(() => {
    if (!mathState || !currentMathQuestion) return null;
    return mathState.history.find((h) => h.questionId === currentMathQuestion.id) ?? null;
  }, [mathState, currentMathQuestion]);

  const mathStandings = useMemo(
    () => (mathState ? computeMathStandingsFromHistory(mathState) : []),
    [mathState]
  );

  // Ensure draftGrades initializes cleanly whenever current question changes
  useEffect(() => {
    if (!mathState || !currentMathQuestion) return;
    if (currentMathTurnRecord) {
      const existing: Record<string, MathParticipantGradeChoice> = {};
      for (const p of getReflexParticipants(mathState.config)) {
        const lbl = currentMathTurnRecord.chosenLabelByParticipant[p.id];
        existing[p.id] = lbl ?? 'no_answer';
      }
      setDraftGrades(existing);
    } else {
      setDraftGrades(createEmptyDraftGrades(mathState.config));
    }
    setIsEditingLastMath(false);
    setMathErrorMsg(null);
    setMathTimeExpired(false);
    setMathSecondsLeft(mathState.config.timerSeconds);
    setMathQuestionPainted(false);

    // Wait two animation frames so MathView DOM formulas are visibly rendered BEFORE timer starts!
    let cancelled = false;
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (!cancelled) {
          setMathQuestionPainted(true);
        }
      });
      if (cancelled) cancelAnimationFrame(raf2);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [mathState?.currentIndex, currentMathQuestion?.id, mathState?.config.timerSeconds]);

  // Play crisp TRẢ LỜI cue & optional Vietnamese voice once question formulas are rendered
  useEffect(() => {
    if (
      activeMode !== 'math' ||
      mathSetupOpen ||
      !mathState ||
      mathState.status !== 'playing' ||
      !currentMathQuestion ||
      currentMathTurnRecord ||
      !mathQuestionPainted
    ) {
      return;
    }
    const tok = activeTurnTokenRef.current;
    soundBankRef.current?.playReflexGoCue(isMuted, tok);

    if (!isMuted && voiceEnabled && hasVietnameseVoice) {
      const spokenText = `Câu ${mathState.currentIndex + 1}: ${stripLatexForSpeech(currentMathQuestion.stem)}`;
      voiceControllerRef.current
        ?.announceStudentOnce({
          turnId: `${tok}_q_${currentMathQuestion.id}`,
          studentName: '',
          customText: spokenText,
          isMuted,
          voiceEnabled,
        })
        .catch(() => {});
    }
  }, [
    activeMode,
    mathSetupOpen,
    mathState?.currentIndex,
    mathState?.status,
    currentMathQuestion?.id,
    currentMathTurnRecord,
    mathQuestionPainted,
    isMuted,
    voiceEnabled,
    hasVietnameseVoice,
  ]);

  // Countdown timer for Quick Math (starts strictly after mathQuestionPainted === true)
  useEffect(() => {
    if (
      activeMode !== 'math' ||
      mathSetupOpen ||
      !mathState ||
      mathState.status !== 'playing' ||
      !currentMathQuestion ||
      currentMathTurnRecord ||
      !mathQuestionPainted ||
      mathState.config.timerSeconds <= 0
    ) {
      return;
    }
    if (mathSecondsLeft <= 0) {
      setMathTimeExpired(true);
      return;
    }
    const timer = window.setInterval(() => {
      setMathSecondsLeft((prev) => {
        if (prev <= 1) {
          setMathTimeExpired(true);
          soundBankRef.current?.playTimerBell(isMuted);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [
    activeMode,
    mathSetupOpen,
    mathState,
    currentMathQuestion,
    currentMathTurnRecord,
    mathQuestionPainted,
    mathSecondsLeft,
    isMuted,
  ]);

  const handleStartMathSession = useCallback(() => {
    if (!mathSetupValidation.valid) return;
    soundBankRef.current?.unlock();
    rotateTurnToken();
    const fresh = createInitialReflexMathState({
      config: {
        ...mathConfig,
        questionCount: mathSetupValidation.effectiveQuestionCount,
      },
      pool: mathQuestionPool,
    });
    setMathState(fresh);
    setDraftGrades(createEmptyDraftGrades(fresh.config));
    setMathSetupOpen(false);
    setShowReviewPanel(false);
    setIsEditingLastMath(false);
    setMathErrorMsg(null);
  }, [mathConfig, mathQuestionPool, mathSetupValidation, rotateTurnToken]);

  const handleSetParticipantGrade = useCallback(
    (participantId: string, choice: MathParticipantGradeChoice) => {
      setDraftGrades((prev) => ({
        ...prev,
        [participantId]: choice,
      }));
      setMathErrorMsg(null);
    },
    []
  );

  const handleCommitMathGrades = useCallback(() => {
    if (!mathState) return;
    const tok = activeTurnTokenRef.current;

    if (isEditingLastMath) {
      const res = editCurrentReflexMathTurn(mathState, draftGrades);
      if (!res.edited) {
        setMathErrorMsg(res.error ?? 'Không thể cập nhật chấm điểm.');
        return;
      }
      setMathState(res.nextState);
      setIsEditingLastMath(false);
      setMathErrorMsg(null);
      soundBankRef.current?.playReflexResultCue(isMuted, tok);
      return;
    }

    const res = commitReflexMathTurn(mathState, draftGrades);
    if (!res.committed) {
      setMathErrorMsg(res.error ?? 'Vui lòng chấm đủ tất cả trước khi công bố.');
      return;
    }
    setMathState(res.nextState);
    setMathErrorMsg(null);
    voiceControllerRef.current?.stop();
    soundBankRef.current?.playReflexResultCue(isMuted, tok);
  }, [draftGrades, isEditingLastMath, isMuted, mathState]);

  const handleAdvanceMathQuestion = useCallback(() => {
    if (!mathState) return;
    const tok = rotateTurnToken();
    const next = advanceReflexMathQuestion(mathState);
    setMathState(next);
    setIsEditingLastMath(false);
    setMathErrorMsg(null);
    if (next.status === 'finished') {
      soundBankRef.current?.playReflexSummaryFanfare(isMuted, tok);
    }
  }, [isMuted, mathState, rotateTurnToken]);

  const handleSpeakCurrentQuestion = useCallback(() => {
    if (!currentMathQuestion || isMuted || !hasVietnameseVoice) return;
    soundBankRef.current?.unlock();
    const spokenText = `Câu ${(mathState?.currentIndex ?? 0) + 1}: ${stripLatexForSpeech(
      currentMathQuestion.stem
    )}`;
    voiceControllerRef.current
      ?.replayText({
        text: spokenText,
        isMuted,
        voiceEnabled: true,
      })
      .catch(() => {});
  }, [currentMathQuestion, hasVietnameseVoice, isMuted, mathState?.currentIndex]);

  // Persist session to localStorage (auto-isolated in /demo)
  useEffect(() => {
    saveE03Session({
      activeMode,
      signalState,
      mathState,
    });
  }, [activeMode, signalState, mathState]);

  // Mode switching cancels pending timers & active audio cleanly
  const handleSwitchMode = useCallback(
    (nextMode: ReflexGameMode) => {
      if (nextMode === activeMode) return;
      clearSignalTimers();
      if (signalStateRef.current.phase === 'waiting' || signalStateRef.current.phase === 'go') {
        const paused = interruptSignalTrial(
          signalStateRef.current,
          'Đã chuyển sang chế độ Toán nhanh — lượt đo trước được tạm dừng.'
        );
        signalStateRef.current = paused;
        setSignalState(paused);
      }
      rotateTurnToken();
      setActiveMode(nextMode);
    },
    [activeMode, clearSignalTimers, rotateTurnToken]
  );

  // ==========================================================================
  // KEYBOARD HANDLERS (Anti-hold, Anti-double-fire, Separated Start vs Tap)
  // ==========================================================================
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (activeMode === 'signal') {
        const cur = signalStateRef.current;
        if (e.code === 'Space') {
          e.preventDefault();
          if (e.repeat || awaitingSpaceReleaseRef.current) return;
          if (cur.phase === 'waiting' || cur.phase === 'go') {
            awaitingSpaceReleaseRef.current = true;
            handleSignalResponseTap();
          }
          return;
        }
        if (e.code === 'Enter') {
          if (e.repeat) return;
          if (cur.phase === 'idle') {
            e.preventDefault();
            handleStartSignalTrial();
          } else if (cur.phase === 'result') {
            e.preventDefault();
            handleAdvanceSignalTrial();
          } else if (cur.phase === 'interrupted') {
            e.preventDefault();
            handleRedoInterrupted();
          }
        }
        return;
      }

      // Quick Math Solo keyboard shortcuts (A-D / 1-4 / Enter)
      if (
        activeMode === 'math' &&
        !mathSetupOpen &&
        mathState &&
        mathState.status === 'playing' &&
        mathState.config.participantMode === 'solo' &&
        currentMathQuestion
      ) {
        if (!currentMathTurnRecord || isEditingLastMath) {
          const mapKey: Record<string, ReflexOptionLetter> = {
            KeyA: 'A',
            Digit1: 'A',
            KeyB: 'B',
            Digit2: 'B',
            KeyC: 'C',
            Digit3: 'C',
            KeyD: 'D',
            Digit4: 'D',
          };
          const chosen = mapKey[e.code];
          if (chosen) {
            e.preventDefault();
            handleSetParticipantGrade('solo_1', chosen);
            return;
          }
          if (e.code === 'Enter' && !e.repeat) {
            if (areAllMathParticipantsGraded(mathState.config, draftGrades)) {
              e.preventDefault();
              handleCommitMathGrades();
            }
          }
        } else if (e.code === 'Enter' && !e.repeat) {
          e.preventDefault();
          handleAdvanceMathQuestion();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        awaitingSpaceReleaseRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    activeMode,
    currentMathQuestion,
    currentMathTurnRecord,
    draftGrades,
    handleAdvanceMathQuestion,
    handleAdvanceSignalTrial,
    handleCommitMathGrades,
    handleRedoInterrupted,
    handleSetParticipantGrade,
    handleSignalResponseTap,
    handleStartSignalTrial,
    isEditingLastMath,
    mathSetupOpen,
    mathState,
  ]);

  // ==========================================================================
  // COMPUTED VISUAL PROPS FOR 3D CONSOLE STAGE
  // ==========================================================================
  const signalSummary = useMemo(() => computeSignalSummary(signalState), [signalState]);
  const signalTrialMeta = useMemo(
    () => getSignalTrialDisplayMeta(signalState.config, signalState.currentTrialIndex),
    [signalState.config, signalState.currentTrialIndex]
  );

  const signalConsoleVisual: {
    visualState: ReflexConsoleVisualState;
    headline: string;
    subline: string;
    responseEnabled: boolean;
  } = useMemo(() => {
    switch (signalState.phase) {
      case 'waiting':
        return {
          visualState: 'waiting',
          headline: 'CHỜ',
          subline: 'Chờ tín hiệu xanh ngọc rồi bấm ngay (Space hoặc chạm nút)',
          responseEnabled: true,
        };
      case 'go':
        return {
          visualState: 'go',
          headline: 'BẤM!',
          subline: 'Nhấn nút tròn lớn hoặc phím Space ngay lúc này!',
          responseEnabled: true,
        };
      case 'result': {
        const res = signalState.lastResult;
        if (!res) {
          return {
            visualState: 'result_valid',
            headline: 'KẾT QUẢ',
            subline: 'Hoàn thành lượt đo',
            responseEnabled: false,
          };
        }
        if (res.outcome === 'early') {
          return {
            visualState: 'result_early',
            headline: 'KẾT QUẢ',
            subline: 'Bấm sớm — đã bấm trước khi tín hiệu bật (không tính 0 ms)',
            responseEnabled: false,
          };
        }
        if (res.outcome === 'timeout') {
          return {
            visualState: 'result_timeout',
            headline: 'KẾT QUẢ',
            subline: 'Không phản hồi trong 3 giây',
            responseEnabled: false,
          };
        }
        return {
          visualState: 'result_valid',
          headline: 'KẾT QUẢ',
          subline: `${res.reactionMs} ms · ${res.isPractice ? 'Lượt làm quen (không tính thống kê)' : E03_DEVICE_TIMING_LABEL}`,
          responseEnabled: false,
        };
      }
      case 'interrupted':
        return {
          visualState: 'interrupted',
          headline: 'CHỜ',
          subline: signalState.interruptedReason ?? 'Lượt đo bị gián đoạn — bấm Làm lại lượt này',
          responseEnabled: false,
        };
      case 'summary':
        return {
          visualState: 'summary',
          headline: 'KẾT QUẢ',
          subline:
            signalSummary.medianMs !== null
              ? `Trung vị ${signalSummary.medianMs} ms · Nhanh nhất ${signalSummary.fastestMs} ms`
              : 'Đã hoàn tất toàn bộ lượt đo',
          responseEnabled: false,
        };
      case 'idle':
      default:
        return {
          visualState: 'idle',
          headline: 'CHỜ',
          subline: `${signalTrialMeta.label} · Bấm "Sẵn sàng" để bắt đầu lượt`,
          responseEnabled: false,
        };
    }
  }, [signalState.phase, signalState.lastResult, signalState.interruptedReason, signalSummary, signalTrialMeta]);

  const mathConsoleVisual: {
    visualState: ReflexConsoleVisualState;
    headline: string;
    subline: string;
  } = useMemo(() => {
    if (mathSetupOpen || !mathState) {
      return {
        visualState: 'idle',
        headline: 'CHỜ',
        subline: 'Thiết lập chế độ Toán nhanh rồi bấm Bắt đầu',
      };
    }
    if (mathState.status === 'finished') {
      const leader = mathStandings[0];
      return {
        visualState: 'summary',
        headline: 'KẾT QUẢ',
        subline: leader
          ? `${leader.isTied ? 'Đồng hạng nhất' : 'Dẫn đầu'}: ${leader.name} (${leader.points} điểm)`
          : 'Hoàn tất phiên Toán nhanh',
      };
    }
    if (currentMathTurnRecord && !isEditingLastMath) {
      const correctLbl = currentMathTurnRecord.correctOptionLabel;
      return {
        visualState: 'result_valid',
        headline: 'KẾT QUẢ',
        subline: `Đáp án đúng: ${correctLbl} · Giáo viên giải thích rồi bấm Câu tiếp theo`,
      };
    }
    return {
      visualState: 'answer',
      headline: 'TRẢ LỜI',
      subline:
        mathState.config.timerSeconds > 0
          ? mathTimeExpired
            ? 'Đã hết thời gian — giáo viên vẫn có thể chấm bảng con đã viết trước hạn'
            : `Câu ${mathState.currentIndex + 1}/${mathState.questions.length} · Còn ${mathSecondsLeft} giây`
          : `Câu ${mathState.currentIndex + 1}/${mathState.questions.length} · Không giới hạn thời gian`,
    };
  }, [
    currentMathTurnRecord,
    isEditingLastMath,
    mathSecondsLeft,
    mathSetupOpen,
    mathStandings,
    mathState,
    mathTimeExpired,
  ]);

  const allCurrentParticipantsGraded = useMemo(() => {
    if (!mathState) return false;
    return areAllMathParticipantsGraded(mathState.config, draftGrades);
  }, [draftGrades, mathState]);

  const ungradedNames = useMemo(() => {
    if (!mathState) return [];
    return getUngradedMathParticipantNames(mathState.config, draftGrades);
  }, [draftGrades, mathState]);

  const handleExitGame = useCallback(() => {
    clearSignalTimers();
    rotateTurnToken();
    onBackToLibrary?.();
  }, [clearSignalTimers, onBackToLibrary, rotateTurnToken]);

  return (
    <div
      className={`w-full ${
        isFullscreen ? 'h-dvh overflow-y-auto' : 'min-h-[640px] rounded-2xl border border-slate-700/60'
      } bg-[#061024] text-white flex flex-col`}
    >
      {/* TOP CONTROL BAR — Clean, single-line controls, A01/A02 audio consistency */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#0B172F] border-b border-slate-700/60">
        <div className="flex items-center gap-3 min-w-0">
          {onBackToLibrary && (
            <button
              type="button"
              onClick={handleExitGame}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Thư viện</span>
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              E03 · Phản xạ nhanh 3D
            </h2>
            <p className="text-xs text-slate-300 truncate">
              {activeMode === 'signal' ? 'Chế độ Phản xạ tín hiệu' : 'Chế độ Toán nhanh · THCS'}
            </p>
          </div>
        </div>

        {/* Mode Segmented Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#071124] border border-slate-700/70">
          <button
            type="button"
            onClick={() => handleSwitchMode('signal')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'signal'
                ? 'bg-teal-400 text-[#061024]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            Phản xạ tín hiệu
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('math')}
            className={`px-3.5 py-2 min-h-[38px] rounded-lg text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'math'
                ? 'bg-amber-400 text-[#061024]'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            Toán nhanh
          </button>
        </div>

        {/* Utility Actions (Speaker A01/A02, Voice, 3D/2D, Reduced Motion, Fullscreen) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            title={isMuted ? 'Bật âm thanh (đồng bộ A01/A02)' : 'Tắt âm thanh (đồng bộ A01/A02)'}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors whitespace-nowrap cursor-pointer ${
              isMuted
                ? 'bg-slate-800/90 text-slate-300 border-slate-600'
                : 'bg-teal-500/20 text-teal-200 border-teal-400/50 hover:bg-teal-500/30'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt loa' : 'Loa bật'}</span>
          </button>

          {activeMode === 'math' && (
            <button
              type="button"
              onClick={handleToggleVoice}
              disabled={!hasVietnameseVoice}
              title={
                hasVietnameseVoice
                  ? 'Đọc đề bằng giọng tiếng Việt'
                  : 'Trình duyệt hiện không có giọng tiếng Việt'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                !hasVietnameseVoice
                  ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                  : voiceEnabled && !isMuted
                  ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30 cursor-pointer'
                  : 'bg-slate-800/90 text-slate-300 border-slate-600 cursor-pointer'
              }`}
            >
              <Volume1 className="w-4 h-4" />
              <span className="hidden md:inline">
                {!hasVietnameseVoice ? 'Chưa có giọng Việt' : voiceEnabled ? 'Đọc đề' : 'Tắt đọc'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setForce2D((v) => !v)}
            title="Chuyển giữa sân khấu 3D và giao diện 2D nhẹ"
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600/80 text-xs font-bold whitespace-nowrap cursor-pointer"
          >
            {force2D ? <Layers className="w-4 h-4 text-teal-300" /> : <Box className="w-4 h-4 text-teal-300" />}
            <span>{force2D ? '2D nhẹ' : '3D'}</span>
          </button>

          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            title="Bật/tắt chế độ giảm chuyển động"
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold border whitespace-nowrap cursor-pointer ${
              reducedMotion
                ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                : 'bg-slate-800 text-slate-300 border-slate-600/80 hover:bg-slate-700'
            }`}
          >
            {reducedMotion ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden xl:inline">Giảm CĐ</span>
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600/80 text-xs font-bold whitespace-nowrap cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden lg:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ==================================================================== */}
      {/* BODY: MODE 1 — PHẢN XẠ TÍN HIỆU                                      */}
      {/* ==================================================================== */}
      {activeMode === 'signal' && (
        <main className="flex-1 p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Left / Primary Stage: 3D Signal Console + Fixed Action Controls */}
          <section className="lg:col-span-7 flex flex-col gap-4">
            <div className="flex-1 min-h-[380px]">
              <QuickReflex3DScene
                visualState={signalConsoleVisual.visualState}
                headline={signalConsoleVisual.headline}
                subline={signalConsoleVisual.subline}
                responseEnabled={signalConsoleVisual.responseEnabled}
                pressPulseSeq={pressPulseSeq}
                reducedMotion={reducedMotion}
                force2D={force2D}
                onResponseTap={handleSignalResponseTap}
                onWebGLFallback={() => setForce2D(true)}
              />
            </div>

            {/* Primary Turn Control Strip — physically distinct from the Response Pad */}
            <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-extrabold text-white">
                  {signalState.phase === 'summary'
                    ? 'Hoàn tất phiên phản xạ tín hiệu'
                    : `${signalTrialMeta.label} · ${signalState.currentParticipantLabel}`}
                </div>
                <div className="text-xs text-slate-300 mt-0.5">
                  Phím Enter để mở/chuyển lượt · Phím Space hoặc chạm nút tròn chỉ để phản hồi
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {signalState.phase === 'idle' && (
                  <button
                    type="button"
                    onClick={handleStartSignalTrial}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-teal-400 hover:bg-teal-300 text-[#061024] font-black text-base transition-colors cursor-pointer"
                  >
                    <Play className="w-5 h-5" />
                    <span>Sẵn sàng</span>
                  </button>
                )}

                {(signalState.phase === 'waiting' || signalState.phase === 'go') && (
                  <button
                    type="button"
                    onClick={() =>
                      handleInterruptSignal(
                        'Giáo viên hoặc người chơi đã tạm dừng giữa lượt đo — bấm Làm lại lượt này.'
                      )
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-400/40 font-bold text-sm cursor-pointer"
                  >
                    <Pause className="w-4 h-4" />
                    <span>Tạm dừng</span>
                  </button>
                )}

                {signalState.phase === 'interrupted' && (
                  <button
                    type="button"
                    onClick={handleRedoInterrupted}
                    className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] font-black text-sm sm:text-base cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Làm lại lượt này</span>
                  </button>
                )}

                {signalState.phase === 'result' && (
                  <button
                    type="button"
                    onClick={handleAdvanceSignalTrial}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] font-black text-base cursor-pointer"
                  >
                    <span>
                      {signalState.currentTrialIndex + 1 >= getTotalSignalTrials(signalState.config)
                        ? 'Xem tổng kết'
                        : 'Lượt tiếp theo'}
                    </span>
                  </button>
                )}

                {signalState.phase === 'summary' && (
                  <button
                    type="button"
                    onClick={() => handleResetSignalSession(signalState.config)}
                    className="inline-flex items-center gap-2 px-5 py-3 min-h-[46px] rounded-xl bg-teal-400 hover:bg-teal-300 text-[#061024] font-black text-base cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại phiên mới</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Right Panel: Classroom / Solo Setup, Live Readout & Summary */}
          <aside className="lg:col-span-5 flex flex-col gap-4">
            {/* Session Mode & Settings */}
            <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-extrabold text-white">Thiết lập phiên đo</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSignalSettings((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{showSignalSettings ? 'Ẩn tùy chỉnh' : 'Tùy chỉnh'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetSignalSession(signalState.config)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Làm mới</span>
                  </button>
                </div>
              </div>

              {/* Solo vs Classroom 1-machine rotation */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: 'solo' as SignalSessionFormat, label: 'Cá nhân tự luyện', icon: User },
                    { key: 'class_turn' as SignalSessionFormat, label: 'Lớp 1–50 HS lên máy', icon: Users },
                  ]
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      handleResetSignalSession({
                        ...signalState.config,
                        format: key,
                      })
                    }
                    className={`flex items-center justify-center gap-2 px-3 py-2.5 min-h-[42px] rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      signalState.config.format === key
                        ? 'bg-teal-400/20 text-teal-200 border-teal-400/70'
                        : 'bg-[#081327] text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {signalState.config.format === 'class_turn' && signalState.phase !== 'summary' && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="e03-student-turn-input"
                    className="text-xs font-semibold text-slate-300 whitespace-nowrap"
                  >
                    Người lên máy:
                  </label>
                  <input
                    id="e03-student-turn-input"
                    type="text"
                    value={signalState.currentParticipantLabel}
                    disabled={signalState.phase === 'waiting' || signalState.phase === 'go'}
                    onChange={(e) =>
                      setSignalState((prev) => ({
                        ...prev,
                        currentParticipantLabel: e.target.value,
                      }))
                    }
                    maxLength={32}
                    placeholder="VD: Minh Anh / Tổ 2"
                    className="flex-1 px-3 py-2 rounded-lg bg-[#071124] border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-400"
                  />
                </div>
              )}

              {showSignalSettings && (
                <div className="pt-2 border-t border-slate-700/70 grid grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <span className="block text-slate-300 font-semibold">Lượt làm quen (không thống kê)</span>
                    <select
                      value={signalState.config.practiceTrials}
                      onChange={(e) =>
                        handleResetSignalSession({
                          ...signalState.config,
                          practiceTrials: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#071124] border border-slate-600 text-white font-bold"
                    >
                      <option value={0}>0 lượt</option>
                      <option value={1}>1 lượt (Mặc định)</option>
                      <option value={2}>2 lượt</option>
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="block text-slate-300 font-semibold">Số lượt tính thống kê</span>
                    <select
                      value={signalState.config.officialTrials}
                      onChange={(e) =>
                        handleResetSignalSession({
                          ...signalState.config,
                          officialTrials: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#071124] border border-slate-600 text-white font-bold"
                    >
                      <option value={4}>4 lượt</option>
                      <option value={6}>6 lượt</option>
                      <option value={8}>8 lượt (Mặc định)</option>
                      <option value={10}>10 lượt</option>
                      <option value={12}>12 lượt</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            {/* Official Summary & Metrics Card */}
            <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-3 flex-1 flex flex-col">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-extrabold text-white">
                  {E03_DEVICE_TIMING_LABEL}
                </h3>
                <span className="text-xs font-semibold text-slate-300 tabular-nums">
                  {signalSummary.officialTotalCount}/{signalState.config.officialTrials} lượt chính thức
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 tabular-nums">
                <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-3">
                  <div className="text-[11px] font-semibold text-slate-400">Nhanh nhất</div>
                  <div className="text-xl font-black text-teal-300 mt-0.5">
                    {signalSummary.fastestMs !== null ? `${signalSummary.fastestMs} ms` : '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-3">
                  <div className="text-[11px] font-semibold text-slate-400">Trung vị</div>
                  <div className="text-xl font-black text-amber-300 mt-0.5">
                    {signalSummary.medianMs !== null ? `${signalSummary.medianMs} ms` : '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#081327] border border-slate-700/60 p-3 col-span-2 sm:col-span-1">
                  <div className="text-[11px] font-semibold text-slate-400">Hợp lệ</div>
                  <div className="text-xl font-black text-white mt-0.5">
                    {signalSummary.validCount}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 tabular-nums">
                <span>Bấm sớm: <strong className="text-rose-300">{signalSummary.earlyCount}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Không phản hồi: <strong className="text-amber-300">{signalSummary.timeoutCount}</strong></span>
                {signalSummary.interruptedCount > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Gián đoạn (đã làm lại): <strong className="text-slate-200">{signalSummary.interruptedCount}</strong></span>
                  </>
                )}
              </div>

              {signalState.phase === 'summary' && signalSummary.validCount === 0 && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3 text-xs text-amber-100 font-medium">
                  Chưa có lượt phản hồi hợp lệ nào trong phiên này, nên chưa tính tốc độ nhanh nhất và trung vị.
                </div>
              )}

              {/* Trial History Log */}
              <div className="flex-1 min-h-[150px] max-h-[260px] overflow-y-auto rounded-xl bg-[#071124] border border-slate-800 divide-y divide-slate-800/80">
                {signalState.records.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Chưa có lượt nào hoàn tất. Lượt làm quen đầu tiên không tính vào thống kê chính thức.
                  </div>
                ) : (
                  signalState.records.map((rec, idx) => (
                    <div
                      key={`${rec.trialIndex}_${rec.completedAt}_${idx}`}
                      className="px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-bold text-white">
                          {rec.isPractice ? 'Làm quen' : `Lượt ${rec.displayNumber}`}
                        </span>
                        {signalState.config.format === 'class_turn' && (
                          <span className="text-slate-400"> · {rec.participantLabel}</span>
                        )}
                      </div>
                      <div className="shrink-0 font-extrabold">
                        {rec.outcome === 'valid' && rec.reactionMs !== null ? (
                          <span className="text-teal-300">{rec.reactionMs} ms</span>
                        ) : rec.outcome === 'early' ? (
                          <span className="text-rose-300">Bấm sớm</span>
                        ) : (
                          <span className="text-amber-300">Không phản hồi</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <p className="text-[11px] leading-relaxed text-slate-400">
                {E03_DEVICE_TIMING_NOTE}
              </p>
            </div>
          </aside>
        </main>
      )}

      {/* ==================================================================== */}
      {/* BODY: MODE 2 — TOÁN NHANH                                            */}
      {/* ==================================================================== */}
      {activeMode === 'math' && (
        <main className="flex-1 p-4 sm:p-5 flex flex-col gap-4">
          {/* Compact 3D/2D Signal Console Strip ("TRẢ LỜI" / "KẾT QUẢ") */}
          <QuickReflex3DScene
            visualState={mathConsoleVisual.visualState}
            headline={mathConsoleVisual.headline}
            subline={mathConsoleVisual.subline}
            compact
            reducedMotion={reducedMotion}
            force2D={force2D}
            onWebGLFallback={() => setForce2D(true)}
          />

          {/* SETUP VIEW FOR QUICK MATH */}
          {mathSetupOpen || !mathState ? (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-5 space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-extrabold text-white">
                    Thiết lập phiên Toán nhanh
                  </h3>
                  <span className="text-xs text-slate-300">
                    Đúng +10 điểm · Sai hoặc không trả lời 0 điểm · Đồng điểm thì Đồng hạng
                  </span>
                </div>

                {/* Participant Mode */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300">Hình thức tổ chức lớp học</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        { key: 'solo' as ReflexMathParticipantMode, title: 'Tự luyện (1 HS)', desc: 'Chọn A–D rồi bấm Chốt đáp án' },
                        { key: 'whole_class' as ReflexMathParticipantMode, title: 'Cả lớp (1–50 HS)', desc: 'Giơ thẻ / bảng con, GV chấm chung' },
                        { key: 'teams' as ReflexMathParticipantMode, title: 'Thi đấu 2–6 đội', desc: 'GV ghi A/B/C/D cho từng đội' },
                      ]
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() =>
                          setMathConfig((prev) => ({ ...prev, participantMode: m.key }))
                        }
                        className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                          mathConfig.participantMode === m.key
                            ? 'bg-teal-400/20 border-teal-400 text-white'
                            : 'bg-[#081327] border-slate-700 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-sm font-extrabold">{m.title}</div>
                        <div className="text-xs text-slate-300 mt-0.5">{m.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Team Count & Editable Names */}
                {mathConfig.participantMode === 'teams' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Số đội thi đấu (2–6 đội)</span>
                      <div className="flex items-center gap-1.5">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() =>
                              setMathConfig((prev) => ({
                                ...prev,
                                teams: createReflexTeams(cnt),
                              }))
                            }
                            className={`w-10 h-10 rounded-lg font-extrabold text-sm cursor-pointer ${
                              mathConfig.teams.length === cnt
                                ? 'bg-amber-400 text-[#061024]'
                                : 'bg-[#081327] text-slate-200 border border-slate-700 hover:border-slate-500'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {mathConfig.teams.map((team, idx) => (
                        <input
                          key={team.id}
                          type="text"
                          value={team.name}
                          maxLength={24}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMathConfig((prev) => ({
                              ...prev,
                              teams: prev.teams.map((t, i) =>
                                i === idx ? { ...t, name: val } : t
                              ),
                            }));
                          }}
                          className="px-3 py-2 rounded-lg bg-[#081327] border border-slate-600 text-sm font-bold text-white focus:outline-none focus:border-teal-400"
                          aria-label={`Tên đội ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Question Source (Sample vs Smart EDU Bank) */}
                <div className="space-y-2.5 pt-2 border-t border-slate-700/70">
                  <div className="text-xs font-bold text-slate-300">Nguồn câu hỏi</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setMathConfig((prev) => ({ ...prev, sourceKind: 'sample' }))
                      }
                      className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                        mathConfig.sourceKind === 'sample'
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-[#081327] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-sm font-extrabold">{E03_SAMPLE_PACK_TITLE}</div>
                      <div className="text-xs text-amber-200 mt-0.5">
                        {E03_SAMPLE_BADGE} · 8 câu chuẩn công thức Toán THCS
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMathConfig((prev) => ({ ...prev, sourceKind: 'bank' }))
                      }
                      className={`p-3.5 rounded-xl border text-left cursor-pointer ${
                        mathConfig.sourceKind === 'bank'
                          ? 'bg-teal-400/20 border-teal-400 text-white'
                          : 'bg-[#081327] border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <div className="text-sm font-extrabold">Ngân hàng câu hỏi Smart EDU</div>
                      <div className="text-xs text-slate-300 mt-0.5">
                        Áp dụng đúng phân quyền tài khoản · {mathConfig.sourceKind === 'bank' ? `${mathQuestionPool.length} câu phù hợp` : 'Chọn để lọc môn/khối'}
                      </div>
                    </button>
                  </div>

                  {mathConfig.sourceKind === 'bank' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                      <select
                        value={mathConfig.subjectFilter}
                        onChange={(e) =>
                          setMathConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                        }
                        className="px-3 py-2.5 rounded-lg bg-[#081327] border border-slate-600 text-white font-semibold"
                      >
                        <option value="all">Tất cả môn học</option>
                        {availableSubjects.map((subj) => (
                          <option key={subj} value={subj}>
                            Môn: {subj}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mathConfig.gradeFilter}
                        onChange={(e) =>
                          setMathConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                        }
                        className="px-3 py-2.5 rounded-lg bg-[#081327] border border-slate-600 text-white font-semibold"
                      >
                        <option value="all">Tất cả khối lớp</option>
                        {availableGrades.map((gr) => (
                          <option key={gr} value={gr}>
                            Khối {gr}
                          </option>
                        ))}
                      </select>
                      <select
                        value={mathConfig.levelFilter}
                        onChange={(e) =>
                          setMathConfig((prev) => ({ ...prev, levelFilter: e.target.value }))
                        }
                        className="px-3 py-2.5 rounded-lg bg-[#081327] border border-slate-600 text-white font-semibold"
                      >
                        <option value="all">Tất cả mức độ</option>
                        <option value="know">Nhận biết</option>
                        <option value="understand">Thông hiểu</option>
                        <option value="apply">Vận dụng</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Count, Timer & Shuffle Options */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/70 text-xs">
                  <label className="space-y-1">
                    <span className="block font-bold text-slate-300">Số câu hỏi</span>
                    <select
                      value={mathConfig.questionCount}
                      onChange={(e) =>
                        setMathConfig((prev) => ({
                          ...prev,
                          questionCount: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-[#081327] border border-slate-600 text-white font-bold"
                    >
                      <option value={4}>4 câu</option>
                      <option value={6}>6 câu</option>
                      <option value={8}>8 câu (Mặc định)</option>
                      <option value={10}>10 câu</option>
                      <option value={15}>15 câu</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="block font-bold text-slate-300">Thời gian mỗi câu</span>
                    <select
                      value={mathConfig.timerSeconds}
                      onChange={(e) =>
                        setMathConfig((prev) => ({
                          ...prev,
                          timerSeconds: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-lg bg-[#081327] border border-slate-600 text-white font-bold"
                    >
                      <option value={20}>20 giây (Mặc định)</option>
                      <option value={15}>15 giây</option>
                      <option value={30}>30 giây</option>
                      <option value={45}>45 giây</option>
                      <option value={0}>Không giới hạn thời gian</option>
                    </select>
                  </label>

                  <div className="space-y-1">
                    <span className="block font-bold text-slate-300">Xáo trộn phương án A–D</span>
                    <button
                      type="button"
                      onClick={() =>
                        setMathConfig((prev) => ({
                          ...prev,
                          shuffleOptions: !prev.shuffleOptions,
                        }))
                      }
                      className={`w-full px-3 py-2.5 rounded-lg border font-bold text-left cursor-pointer ${
                        mathConfig.shuffleOptions
                          ? 'bg-teal-400/20 text-teal-200 border-teal-400/60'
                          : 'bg-[#081327] text-slate-300 border-slate-600'
                      }`}
                    >
                      {mathConfig.shuffleOptions ? 'Đang bật (giữ đúng mã đáp án)' : 'Giữ nguyên thứ tự A–D'}
                    </button>
                  </div>
                </div>

                {/* Setup Validation Warnings / Errors */}
                {mathSetupValidation.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-amber-500/15 border border-amber-400/50 px-3.5 py-2.5 text-xs text-amber-100 font-semibold"
                  >
                    {w}
                  </div>
                ))}
                {mathSetupValidation.errors.map((err, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-rose-500/15 border border-rose-400/50 px-3.5 py-2.5 text-xs text-rose-100 font-semibold"
                  >
                    {err}
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={!mathSetupValidation.valid}
                    onClick={handleStartMathSession}
                    className="inline-flex items-center gap-2 px-6 py-3 min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 text-[#061024] font-black text-base transition-colors cursor-pointer"
                  >
                    <Play className="w-5 h-5" />
                    <span>Bắt đầu Toán nhanh ({mathSetupValidation.effectiveQuestionCount} câu)</span>
                  </button>

                  {mathState && mathState.questions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setMathSetupOpen(false)}
                      className="px-4 py-3 min-h-[46px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm cursor-pointer"
                    >
                      Quay lại phiên đang mở
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Math Rules & Sample Preview Card */}
              <aside className="lg:col-span-4 rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-5 space-y-3 text-sm text-slate-200">
                <h4 className="text-base font-extrabold text-white">Quy tắc chấm Toán nhanh</h4>
                <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
                  <li>1. Đề và công thức Toán hiển thị hoàn chỉnh trước khi đồng hồ bắt đầu đếm.</li>
                  <li>2. Tự luyện cho đổi phương án A–D trước khi bấm <strong>Chốt đáp án</strong>.</li>
                  <li>3. Trình chiếu lớp/đội: hết giờ vẫn chấm được đáp án học sinh đã viết trên bảng con trước hạn.</li>
                  <li>4. Chỉ công bố điểm khi tất cả các đội đã được ghi nhận (trạng thái <strong>Chưa chấm</strong> tách biệt với <strong>Không trả lời</strong>).</li>
                  <li>5. Đúng +10 điểm, sai hoặc không trả lời 0 điểm; không cộng điểm theo tốc độ bấm của giáo viên; đồng điểm thì <strong>Đồng hạng</strong>.</li>
                  <li>6. Cho phép sửa chấm câu vừa chốt trước khi chuyển câu tiếp theo.</li>
                </ul>
              </aside>
            </section>
          ) : mathState.status === 'finished' ? (
            /* QUICK MATH FINAL SUMMARY & REVIEW */
            <section className="space-y-5">
              <div className="rounded-2xl bg-[#0D1A33] border border-amber-400/40 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-amber-300">
                      {mathState.questions[0]?.sourceBadge ?? E03_SAMPLE_BADGE} · {mathState.questions.length} câu đã hoàn tất
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white mt-0.5">
                      Tổng kết Toán nhanh
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowReviewPanel((v) => !v)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-200 border border-teal-400/40 font-bold text-sm cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>{showReviewPanel ? 'Ẩn xem lại câu hỏi' : 'Xem lại đề & lời giải'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMathSetupOpen(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] font-black text-sm cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Thiết lập phiên mới</span>
                    </button>
                  </div>
                </div>

                {/* Standings Table (Equal points => Đồng hạng) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 tabular-nums">
                  {mathStandings.map((row) => {
                    const palette = REFLEX_TEAM_PALETTES[row.paletteIndex % REFLEX_TEAM_PALETTES.length];
                    return (
                      <div
                        key={row.id}
                        className="rounded-2xl bg-[#081327] border border-slate-700/80 p-4 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                            <Trophy
                              className="w-4 h-4 shrink-0"
                              style={{ color: row.rank === 1 ? '#FBBF24' : palette.hex }}
                            />
                            <span>
                              Hạng {row.rank}
                              {row.isTied ? ' · Đồng hạng' : ''}
                            </span>
                          </div>
                          <div className="text-lg font-extrabold text-white truncate mt-0.5">
                            {row.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Đúng {row.correctCount} · Sai {row.wrongCount} · Không TL {row.noAnswerCount}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl font-black text-amber-300">{row.points}</div>
                          <div className="text-[11px] font-semibold text-slate-400">điểm</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full Math Review List (All rendered via MathView) */}
              {showReviewPanel && (
                <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-5 space-y-4">
                  <h4 className="text-base font-extrabold text-white">
                    Xem lại toàn bộ câu hỏi, đáp án và lời giải
                  </h4>
                  <div className="space-y-3">
                    {mathState.questions.map((q, idx) => {
                      const turn = mathState.history.find((h) => h.questionId === q.id);
                      const correctLbl = getCorrectOptionLabelForReflexQuestion(q);
                      return (
                        <div
                          key={q.id}
                          className="rounded-xl bg-[#081327] border border-slate-700/70 p-4 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                            <span>
                              Câu {idx + 1} · {q.topicLabel} · {q.sourceBadge}
                            </span>
                            <span className="font-bold text-teal-300">
                              Đáp án đúng: {correctLbl}
                            </span>
                          </div>
                          <div className="text-base sm:text-lg font-bold text-white">
                            <MathView content={q.stem} />
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                            {q.options.map((opt) => {
                              const isCorrect = opt.id === q.correctOptionId;
                              return (
                                <div
                                  key={opt.id}
                                  className={`px-3 py-2 rounded-lg border ${
                                    isCorrect
                                      ? 'bg-teal-500/20 border-teal-400 text-white font-bold'
                                      : 'bg-[#0B172F] border-slate-700/70 text-slate-300'
                                  }`}
                                >
                                  <span className="font-extrabold mr-1.5">{opt.label}.</span>
                                  <MathView content={opt.text} />
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-amber-100 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                            <span className="font-bold text-amber-300 mr-1.5">Lời giải:</span>
                            <MathView content={q.explanation} />
                          </div>
                          {turn && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                              {getReflexParticipants(mathState.config).map((p) => {
                                const lbl = turn.chosenLabelByParticipant[p.id];
                                const ok = turn.isCorrectByParticipant[p.id];
                                return (
                                  <span key={p.id}>
                                    {p.name}:{' '}
                                    <strong className={ok ? 'text-teal-300' : 'text-rose-300'}>
                                      {lbl === 'no_answer' ? 'Không trả lời' : lbl} (
                                      {ok ? `+${E03_POINTS_PER_CORRECT}` : '0'})
                                    </strong>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          ) : currentMathQuestion ? (
            /* ACTIVE QUICK MATH PLAY VIEW — Prioritizes Question & 4 Options for Projector */
            <section className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left / Dominant Question & Options Zone (8 cols) */}
              <div className="lg:col-span-8 rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-5 sm:p-6 space-y-5">
                {/* Quiet Metadata Row (Zero Pills) */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-amber-300 tabular-nums">
                      Câu {mathState.currentIndex + 1}/{mathState.questions.length}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{currentMathQuestion.topicLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-teal-300 font-semibold">
                      {currentMathQuestion.sourceBadge}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {mathState.config.timerSeconds > 0 && !currentMathTurnRecord && (
                      <span
                        className={`font-black text-base tabular-nums ${
                          mathTimeExpired
                            ? 'text-rose-300'
                            : mathSecondsLeft <= 5
                            ? 'text-amber-300'
                            : 'text-teal-300'
                        }`}
                      >
                        {mathTimeExpired ? 'Hết giờ' : `${mathSecondsLeft}s`}
                      </span>
                    )}
                    {hasVietnameseVoice && !isMuted && (
                      <button
                        type="button"
                        onClick={handleSpeakCurrentQuestion}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                      >
                        Đọc lại đề
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMathSetupOpen(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                    >
                      Thiết lập
                    </button>
                  </div>
                </div>

                {/* Dominant Projector-Grade Math Question Stem */}
                <div className="rounded-2xl bg-[#071124] border border-slate-700/80 p-5 sm:p-6 text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-relaxed">
                  <MathView content={currentMathQuestion.stem} />
                </div>

                {/* 4 Clear Options (A–D) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {currentMathQuestion.options.map((opt) => {
                    const isRevealed = Boolean(currentMathTurnRecord) && !isEditingLastMath;
                    const isCorrect = opt.id === currentMathQuestion.correctOptionId;
                    const soloChosen =
                      mathState.config.participantMode === 'solo' &&
                      draftGrades['solo_1'] === opt.label;

                    let cardStyle =
                      'bg-[#08152C] border-slate-600/80 text-white hover:border-teal-400/70';
                    if (isRevealed) {
                      if (isCorrect) {
                        cardStyle = 'bg-teal-500/25 border-teal-400 text-white shadow-md';
                      } else if (soloChosen && !isCorrect) {
                        cardStyle = 'bg-rose-500/20 border-rose-400 text-rose-100';
                      } else {
                        cardStyle = 'bg-[#081327] border-slate-700/60 text-slate-400';
                      }
                    } else if (soloChosen) {
                      cardStyle = 'bg-amber-400/25 border-amber-400 text-white';
                    }

                    const interactiveSolo =
                      mathState.config.participantMode === 'solo' &&
                      (!currentMathTurnRecord || isEditingLastMath);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!interactiveSolo}
                        onClick={() => {
                          if (!interactiveSolo) return;
                          handleSetParticipantGrade('solo_1', opt.label);
                        }}
                        className={`flex items-center gap-3.5 p-4 min-h-[68px] rounded-2xl border-2 text-left transition-colors ${cardStyle} ${
                          interactiveSolo ? 'cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        <span
                          className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                            isRevealed && isCorrect
                              ? 'bg-teal-400 text-[#061024]'
                              : soloChosen
                              ? 'bg-amber-400 text-[#061024]'
                              : 'bg-slate-800 text-white border border-slate-600'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span className="text-lg sm:text-xl font-bold leading-snug break-words">
                          <MathView content={opt.text} />
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Official Answer & Explanation (Visible ONLY after committing/revealing) */}
                {currentMathTurnRecord && !isEditingLastMath && (
                  <div className="rounded-2xl bg-teal-500/12 border border-teal-400/50 p-4 sm:p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-base font-extrabold text-teal-200">
                        <CheckCircle2 className="w-5 h-5 text-teal-300 shrink-0" />
                        <span>
                          Đáp án đúng: {currentMathTurnRecord.correctOptionLabel} (
                          <MathView content={currentMathQuestion.officialAnswerText} />)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingLastMath(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-200 text-xs font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa chấm câu vừa rồi</span>
                      </button>
                    </div>
                    <div className="text-sm sm:text-base text-slate-100 leading-relaxed">
                      <span className="font-bold text-amber-300 mr-1.5">Lời giải:</span>
                      <MathView content={currentMathQuestion.explanation} />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel: Grading Dock & Live Standings (4 cols) */}
              <aside className="lg:col-span-4 flex flex-col gap-4">
                {/* Grading / Lock Panel */}
                <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-white">
                      {mathState.config.participantMode === 'solo'
                        ? 'Chốt đáp án tự luyện'
                        : mathState.config.participantMode === 'whole_class'
                        ? 'Chấm đáp án cả lớp'
                        : 'Chấm đáp án từng đội'}
                    </h4>
                    <span className="text-xs font-semibold text-slate-300">
                      +{E03_POINTS_PER_CORRECT}đ / câu đúng
                    </span>
                  </div>

                  {mathTimeExpired && !currentMathTurnRecord && (
                    <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 px-3 py-2 text-xs text-amber-100 font-semibold">
                      Đã hết giờ trả lời — bạn vẫn có thể ghi nhận đáp án đã viết trên bảng con trước hạn.
                    </div>
                  )}

                  {/* Solo commit UX */}
                  {mathState.config.participantMode === 'solo' ? (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-300">
                        {draftGrades['solo_1'] && draftGrades['solo_1'] !== 'ungraded' ? (
                          <span>
                            Đang chọn:{' '}
                            <strong className="text-amber-300">
                              {draftGrades['solo_1'] === 'no_answer'
                                ? 'Không trả lời'
                                : `Phương án ${draftGrades['solo_1']}`}
                            </strong>{' '}
                            (có thể đổi trước khi chốt)
                          </span>
                        ) : (
                          <span>Chọn một phương án A, B, C hoặc D ở khung bên trái.</span>
                        )}
                      </div>
                      {(!currentMathTurnRecord || isEditingLastMath) && (
                        <button
                          type="button"
                          onClick={() => handleSetParticipantGrade('solo_1', 'no_answer')}
                          className={`w-full py-2 min-h-[40px] rounded-xl text-xs font-bold border cursor-pointer ${
                            draftGrades['solo_1'] === 'no_answer'
                              ? 'bg-slate-600 text-white border-slate-400'
                              : 'bg-[#081327] text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          Đánh dấu: Không trả lời (0đ)
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Whole Class & Teams A/B/C/D / Không trả lời Grading Grid */
                    <div className="space-y-2.5">
                      {getReflexParticipants(mathState.config).map((p) => {
                        const val = draftGrades[p.id] ?? 'ungraded';
                        const isLocked = Boolean(currentMathTurnRecord) && !isEditingLastMath;
                        const palette =
                          REFLEX_TEAM_PALETTES[p.paletteIndex % REFLEX_TEAM_PALETTES.length];
                        return (
                          <div
                            key={p.id}
                            className="rounded-xl bg-[#081327] border border-slate-700/80 p-3 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-extrabold text-white truncate">
                                <span
                                  className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle"
                                  style={{ backgroundColor: palette.hex }}
                                  aria-hidden="true"
                                />
                                {p.name}
                              </span>
                              <span
                                className={`font-bold ${
                                  val === 'ungraded'
                                    ? 'text-amber-300'
                                    : val === 'no_answer'
                                    ? 'text-slate-400'
                                    : 'text-teal-300'
                                }`}
                              >
                                {val === 'ungraded'
                                  ? 'Chưa chấm'
                                  : val === 'no_answer'
                                  ? 'Không trả lời'
                                  : `Chọn ${val}`}
                              </span>
                            </div>
                            <div className="grid grid-cols-5 gap-1.5">
                              {REFLEX_OPTION_LETTERS.map((letter) => (
                                <button
                                  key={letter}
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => handleSetParticipantGrade(p.id, letter)}
                                  className={`py-2 min-h-[38px] rounded-lg text-xs font-black transition-colors ${
                                    val === letter
                                      ? 'bg-teal-400 text-[#061024]'
                                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                                  } ${isLocked ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                                >
                                  {letter}
                                </button>
                              ))}
                              <button
                                type="button"
                                disabled={isLocked}
                                onClick={() => handleSetParticipantGrade(p.id, 'no_answer')}
                                title="Không trả lời (0 điểm)"
                                className={`py-2 min-h-[38px] rounded-lg text-[11px] font-bold transition-colors ${
                                  val === 'no_answer'
                                    ? 'bg-rose-400 text-[#061024]'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                } ${isLocked ? 'opacity-70 cursor-default' : 'cursor-pointer'}`}
                              >
                                K.TL
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {mathErrorMsg && (
                    <div className="rounded-xl bg-rose-500/15 border border-rose-400/50 px-3 py-2 text-xs font-semibold text-rose-100">
                      {mathErrorMsg}
                    </div>
                  )}

                  {/* Primary Action: Commit or Advance */}
                  {!currentMathTurnRecord || isEditingLastMath ? (
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        disabled={!allCurrentParticipantsGraded}
                        onClick={handleCommitMathGrades}
                        className="w-full py-3 min-h-[46px] rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-slate-700 disabled:text-slate-400 text-[#061024] font-black text-sm sm:text-base transition-colors cursor-pointer"
                      >
                        {isEditingLastMath
                          ? 'Lưu điểm vừa sửa'
                          : mathState.config.participantMode === 'solo'
                          ? 'Chốt đáp án'
                          : 'Công bố đáp án & Chấm điểm'}
                      </button>
                      {!allCurrentParticipantsGraded && ungradedNames.length > 0 && (
                        <p className="text-[11px] text-amber-200/90">
                          Còn chưa chấm: {ungradedNames.join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAdvanceMathQuestion}
                      className="w-full py-3 min-h-[46px] rounded-xl bg-teal-400 hover:bg-teal-300 text-[#061024] font-black text-sm sm:text-base transition-colors cursor-pointer"
                    >
                      {mathState.currentIndex + 1 >= mathState.questions.length
                        ? 'Xem bảng tổng kết'
                        : 'Câu tiếp theo'}
                    </button>
                  )}
                </div>

                {/* Live Standings Card */}
                <div className="rounded-2xl bg-[#0D1A33] border border-slate-700/70 p-4 space-y-2.5 tabular-nums">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span className="inline-flex items-center gap-1.5 text-white">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      Bảng điểm trực tiếp
                    </span>
                    <span>Đã chấm {mathState.history.length}/{mathState.questions.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {mathStandings.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#081327] text-xs"
                      >
                        <div className="min-w-0 truncate">
                          <span className="font-extrabold text-amber-300 mr-1.5">
                            #{row.rank}
                          </span>
                          <span className="font-bold text-white">{row.name}</span>
                          {row.isTied && (
                            <span className="text-slate-400 ml-1">· Đồng hạng</span>
                          )}
                        </div>
                        <span className="font-black text-teal-300 shrink-0">
                          {row.points}đ
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </section>
          ) : null}
        </main>
      )}
    </div>
  );
};

export default QuickReflex3DGame;
