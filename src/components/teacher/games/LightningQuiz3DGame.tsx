import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FastForward,
  HelpCircle,
  Keyboard,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
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
import imgB10Cover from '../../../assets/images/game_b10_lightning_quiz_3d_1795314870960.jpg';
import {
  B10ClockMode,
  B10ExplanationTiming,
  B10GameState,
  B10GraphicsQuality,
  B10ParticipationMode,
  B10QuestionSource,
  B10SetupConfig,
  B10WholeTurnBudgetSec,
  B10_DEFAULT_PER_QUESTION_SEC,
  B10_POINTS_PER_CORRECT,
  B10_SAMPLE_BADGE,
  B10_SAMPLE_QUESTIONS,
  B10_WHOLE_TURN_BUDGET_OPTIONS,
  adjudicateB10Deadline,
  advanceB10Question,
  clearB10Session,
  computeB10Summary,
  createB10SetupState,
  createDefaultB10SetupConfig,
  endB10Early,
  getB10ActiveRemainingMs,
  loadB10Session,
  lockB10Option,
  markB10MediaReady,
  pauseB10Session,
  pickNextB10Student,
  resumeB10Session,
  revealB10Hint,
  saveB10Session,
  skipB10Question,
  skipB10RevealAnimation,
  startB10Session,
} from './lightningQuiz3dEngine';
import { LightningQuiz3DScene } from './LightningQuiz3DScene';

export interface LightningQuiz3DGameProps {
  classes: ClassRoom[];
  bankQuestions: Question[];
  userRole: UserRole;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onBackToLibrary: () => void;
}

const PER_Q_DURATION_CHOICES = [10, 15, 20, 30];

export const LightningQuiz3DGame: React.FC<LightningQuiz3DGameProps> = ({
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
  const lastWarnSecRef = useRef<number | null>(null);
  const lastSoundTurnRef = useRef<string>('');

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted(false));
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));
  const [isVoiceReading, setIsVoiceReading] = useState(false);
  const [voiceSnapshot, setVoiceSnapshot] = useState(() => ({
    hasVietnameseVoice: false,
    statusMessage: '',
  }));

  const [quality, setQuality] = useState<B10GraphicsQuality>('high');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showSamplePreview, setShowSamplePreview] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [expandedReviewIds, setExpandedReviewIds] = useState<Record<string, boolean>>({});
  const [focusedOptionIdx, setFocusedOptionIdx] = useState<number>(0);

  // Setup configuration state
  const [clockMode, setClockMode] = useState<B10ClockMode>('per_question');
  const [perQuestionSec, setPerQuestionSec] = useState<number>(B10_DEFAULT_PER_QUESTION_SEC);
  const [wholeTurnSec, setWholeTurnSec] = useState<B10WholeTurnBudgetSec>(90);
  const [participationMode, setParticipationMode] = useState<B10ParticipationMode>('solo_class');
  const [explanationTiming, setExplanationTiming] = useState<B10ExplanationTiming>('after_question');
  const [questionSource, setQuestionSource] = useState<B10QuestionSource>('sample_pack');
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [hintsEnabled, setHintsEnabled] = useState<boolean>(true);
  const [teamCount, setTeamCount] = useState<number>(2);
  const [teamNames, setTeamNames] = useState<string[]>([
    'Đội Sao Mai',
    'Đội Tia Chớp',
    'Đội Tri Thức',
    'Đội Phượng Hoàng',
    'Đội Sóng Xanh',
    'Đội Đỉnh Cao',
  ]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Persisted session restore banner
  const [savedSession, setSavedSession] = useState<B10GameState | null>(() => {
    const loaded = loadB10Session();
    return loaded && loaded.phase !== 'setup' ? loaded : null;
  });

  const [gameState, setGameState] = useState<B10GameState>(() => createB10SetupState());
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());

  const activeQuestion = gameState.questions[gameState.currentIndex] ?? null;
  const activeRecord = gameState.records[gameState.currentIndex] ?? null;

  // Derived approved/valid bank count for preview badge
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

  // Initialize shared EduGameSoundBank & EduGameVoiceController
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

  // Save session whenever meaningful state updates
  useEffect(() => {
    if (gameState.phase === 'setup') return;
    saveB10Session(gameState, Date.now());
  }, [gameState]);

  // Media readiness gate: start clock ONLY after question text/image has rendered & become ready
  useEffect(() => {
    if (gameState.phase !== 'question_ready' || !activeQuestion) return;
    lastWarnSecRef.current = null;
    setFocusedOptionIdx(0);

    // If no external image, confirm DOM frame rendered via rAF before starting countdown
    if (!activeQuestion.image) {
      const raf = window.requestAnimationFrame(() => {
        setGameState((prev) => markB10MediaReady(prev, Date.now()));
      });
      return () => window.cancelAnimationFrame(raf);
    }

    // Fallback safety timer in case external image stalls
    const fallbackTimer = window.setTimeout(() => {
      setGameState((prev) => markB10MediaReady(prev, Date.now()));
    }, 2500);
    return () => window.clearTimeout(fallbackTimer);
  }, [gameState.phase, gameState.currentIndex, gameState.turnToken, activeQuestion]);

  // Clear tick/audio cleanly when transitioning out of answering or changing question
  useEffect(() => {
    if (gameState.phase !== 'answering') {
      lastWarnSecRef.current = null;
      soundBankRef.current?.setActiveTurnToken(null);
    } else {
      soundBankRef.current?.setActiveTurnToken(gameState.turnToken);
    }
  }, [gameState.phase, gameState.turnToken]);

  // Real-time deadline interval + tab visibility wake check (never grants free time on tab switch!)
  useEffect(() => {
    if (gameState.phase !== 'answering') return;

    const tick = () => {
      const now = Date.now();
      setNowTickMs(now);
      setGameState((prev) => {
        if (prev.phase !== 'answering') return prev;
        const checked = adjudicateB10Deadline(prev, now);
        if (checked !== prev && hasUserGestureRef.current && !isMuted) {
          soundBankRef.current?.stopAll();
          soundBankRef.current?.playLightningResultCue(isMuted, 'timeout', prev.turnToken);
          if (checked.phase === 'summary') {
            soundBankRef.current?.playLightningSummaryFanfare(isMuted);
          }
        }
        return checked;
      });
    };

    tick();
    const intervalId = window.setInterval(tick, 120);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [gameState.phase, isMuted]);

  // Short warning pulse <= 5 seconds (stops immediately on question switch, lock, mute, or summary)
  const activeRemainingMs = getB10ActiveRemainingMs(gameState, nowTickMs);
  const activeRemainingSec = Math.ceil(activeRemainingMs / 1000);

  useEffect(() => {
    if (
      gameState.phase !== 'answering' ||
      !hasUserGestureRef.current ||
      isMuted ||
      activeRemainingMs <= 0
    ) {
      return;
    }
    if (activeRemainingSec <= 5 && activeRemainingSec >= 1) {
      if (lastWarnSecRef.current !== activeRemainingSec) {
        lastWarnSecRef.current = activeRemainingSec;
        soundBankRef.current?.playLightningTickWarn(
          isMuted,
          activeRemainingSec <= 2,
          gameState.turnToken
        );
      }
    }
  }, [gameState.phase, gameState.turnToken, activeRemainingMs, activeRemainingSec, isMuted]);

  // Auto-complete reveal animation timer unless skipped by user or reducedMotion
  useEffect(() => {
    if (gameState.phase !== 'revealed' || gameState.revealAnimDone) return;
    if (reducedMotion) {
      setGameState((prev) => skipB10RevealAnimation(prev));
      return;
    }
    const timer = window.setTimeout(() => {
      setGameState((prev) => skipB10RevealAnimation(prev));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [gameState.phase, gameState.revealAnimDone, reducedMotion]);

  // Speak Vietnamese question stem cleanly when ready (if voice enabled & vi-VN available)
  const speakCurrentQuestion = useCallback(
    (questionStemPlain: string, turnToken: string) => {
      if (!hasUserGestureRef.current || isMuted || !voiceEnabled || !voiceRef.current) return;
      const clean = questionStemPlain
        .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
        .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, '$1 phần $2')
        .replace(/\\sqrt\{([^}]*)\}/g, 'căn bậc hai của $1')
        .replace(/\\cdot/g, ' nhân ')
        .replace(/\^\{\\circ\}|\\circ/g, ' độ ')
        .replace(/\\text\{([^}]*)\}/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;
      setIsVoiceReading(true);
      voiceRef.current
        .announceStudentOnce({
          turnId: `stem_${turnToken}`,
          studentName: '',
          customText: clean,
          isMuted,
          voiceEnabled,
          onBeforeSpeak: () => {
            // Do not interrupt short click cues harshly, just ensure clean speech
          },
        })
        .catch(() => {})
        .finally(() => setIsVoiceReading(false));
    },
    [isMuted, voiceEnabled]
  );

  const handleStartNewGame = useCallback(() => {
    markUserGesture();
    setSetupError(null);
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    voiceRef.current?.resetTurnDedupe();
    setIsVoiceReading(false);

    const cfg: B10SetupConfig = createDefaultB10SetupConfig({
      clockMode,
      perQuestionSec,
      wholeTurnSec,
      participationMode,
      explanationTiming,
      questionSource,
      shuffleOptions,
      hintsEnabled,
      teamCount,
      teamNames,
      classStudents: selectedClassStudents,
      selectedClassId,
      questionLimit: 10,
    });

    const result = startB10Session({
      config: cfg,
      bankQuestions,
      userRole,
      nowMs: Date.now(),
    });

    if (!result.ok || !result.state) {
      setSetupError(result.error || 'Không thể khởi tạo phiên thi.');
      return;
    }

    clearB10Session();
    setSavedSession(null);
    setExpandedReviewIds({});
    setGameState(result.state);
    soundBankRef.current?.setActiveTurnToken(result.state.turnToken);
    soundBankRef.current?.playLightningStartCue(isMuted, result.state.turnToken);
  }, [
    markUserGesture,
    clockMode,
    perQuestionSec,
    wholeTurnSec,
    participationMode,
    explanationTiming,
    questionSource,
    shuffleOptions,
    hintsEnabled,
    teamCount,
    teamNames,
    selectedClassStudents,
    selectedClassId,
    bankQuestions,
    userRole,
    isMuted,
  ]);

  const handleResumeSavedSession = useCallback(() => {
    markUserGesture();
    if (!savedSession) return;
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    setGameState(savedSession);
    setSavedSession(null);
  }, [markUserGesture, savedSession]);

  const handleLockOption = useCallback(
    (optionId: string) => {
      markUserGesture();
      const now = Date.now();
      setGameState((prev) => {
        if (prev.phase !== 'answering') return prev;
        const token = prev.turnToken;
        const next = lockB10Option({
          state: prev,
          optionId,
          turnToken: token,
          nowMs: now,
        });
        if (next === prev) return prev;

        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        setIsVoiceReading(false);

        const rec = next.records[next.currentIndex];
        if (lastSoundTurnRef.current !== token) {
          lastSoundTurnRef.current = token;
          soundBankRef.current?.playLightningLockCue(isMuted);
          if (rec && rec.outcome !== 'unseen') {
            soundBankRef.current?.playLightningResultCue(isMuted, rec.outcome);
          }
          if (next.phase === 'summary') {
            soundBankRef.current?.playLightningSummaryFanfare(isMuted);
          }
        }
        return next;
      });
    },
    [markUserGesture, isMuted]
  );

  const handleSkipQuestion = useCallback(() => {
    markUserGesture();
    const now = Date.now();
    setGameState((prev) => {
      if (prev.phase !== 'answering' && prev.phase !== 'paused') return prev;
      const next = skipB10Question(prev, prev.turnToken, now);
      if (next !== prev) {
        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        setIsVoiceReading(false);
        soundBankRef.current?.playLightningResultCue(isMuted, 'skipped');
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleTogglePause = useCallback(() => {
    markUserGesture();
    const now = Date.now();
    setGameState((prev) => {
      if (prev.phase === 'answering') {
        soundBankRef.current?.stopAll();
        voiceRef.current?.stop();
        setIsVoiceReading(false);
        return pauseB10Session(prev, now);
      }
      if (prev.phase === 'paused') {
        setNowTickMs(now);
        return resumeB10Session(prev, now);
      }
      return prev;
    });
  }, [markUserGesture]);

  const handleAdvanceQuestion = useCallback(() => {
    markUserGesture();
    const now = Date.now();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    setIsVoiceReading(false);

    setGameState((prev) => {
      const next = advanceB10Question(prev, now);
      if (next.phase === 'summary') {
        soundBankRef.current?.playLightningSummaryFanfare(isMuted);
      } else if (next.phase === 'question_ready') {
        soundBankRef.current?.setActiveTurnToken(next.turnToken);
        soundBankRef.current?.playLightningStartCue(isMuted, next.turnToken);
      }
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleEndEarly = useCallback(() => {
    markUserGesture();
    soundBankRef.current?.stopAll();
    voiceRef.current?.stop();
    setIsVoiceReading(false);
    setGameState((prev) => {
      const next = endB10Early(prev, Date.now());
      soundBankRef.current?.playLightningSummaryFanfare(isMuted);
      return next;
    });
  }, [markUserGesture, isMuted]);

  const handleSelectTeam = useCallback((teamIdx: number) => {
    setGameState((prev) => ({
      ...prev,
      activeTeamIndex: Math.max(0, Math.min(prev.teams.length - 1, teamIdx)),
    }));
  }, []);

  const handlePickStudent = useCallback(() => {
    markUserGesture();
    setGameState((prev) => {
      const next = pickNextB10Student(prev);
      if (
        next.activeCallerStudent &&
        hasUserGestureRef.current &&
        !isMuted &&
        voiceEnabled &&
        voiceRef.current
      ) {
        setIsVoiceReading(true);
        voiceRef.current
          .replayText({
            text: `Mời bạn ${next.activeCallerStudent.fullName}`,
            isMuted,
            voiceEnabled,
          })
          .catch(() => {})
          .finally(() => setIsVoiceReading(false));
      }
      return next;
    });
  }, [markUserGesture, isMuted, voiceEnabled]);

  // Keyboard navigation across setup / answering / revealed phases
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (showGuideModal || showSamplePreview) {
        if (e.key === 'Escape') {
          setShowGuideModal(false);
          setShowSamplePreview(false);
        }
        return;
      }

      const key = e.key.toLowerCase();

      if (gameState.phase === 'setup') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleStartNewGame();
        }
        return;
      }

      if (gameState.phase === 'answering' && activeQuestion) {
        const idxMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        if (key in idxMap) {
          const target = activeQuestion.options[idxMap[key]];
          if (target) {
            e.preventDefault();
            setFocusedOptionIdx(idxMap[key]);
            handleLockOption(target.optionId);
          }
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          e.preventDefault();
          setFocusedOptionIdx((idx) => (idx + 1) % activeQuestion.options.length);
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          e.preventDefault();
          setFocusedOptionIdx((idx) => (idx - 1 + activeQuestion.options.length) % activeQuestion.options.length);
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          const target = activeQuestion.options[focusedOptionIdx];
          if (target) {
            e.preventDefault();
            handleLockOption(target.optionId);
          }
          return;
        }
        if (key === 's') {
          e.preventDefault();
          handleSkipQuestion();
          return;
        }
        if (key === 'h' && gameState.config.hintsEnabled) {
          e.preventDefault();
          setGameState((prev) => revealB10Hint(prev));
          return;
        }
        if (key === 'p') {
          e.preventDefault();
          handleTogglePause();
          return;
        }
      }

      if (gameState.phase === 'paused' && key === 'p') {
        e.preventDefault();
        handleTogglePause();
        return;
      }

      if (gameState.phase === 'revealed') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleAdvanceQuestion();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    showGuideModal,
    showSamplePreview,
    gameState.phase,
    gameState.config.hintsEnabled,
    activeQuestion,
    focusedOptionIdx,
    handleStartNewGame,
    handleLockOption,
    handleSkipQuestion,
    handleTogglePause,
    handleAdvanceQuestion,
  ]);

  const totalBudgetMs =
    gameState.config.clockMode === 'whole_turn'
      ? gameState.config.wholeTurnSec * 1000
      : Math.max(5, gameState.config.perQuestionSec) * 1000;

  const summary = useMemo(() => computeB10Summary(gameState), [gameState]);

  const statusText = useMemo(() => {
    switch (gameState.phase) {
      case 'question_ready':
        return 'Mở đề';
      case 'answering':
        return 'Tiếp nhận thao tác';
      case 'paused':
        return 'Tạm dừng';
      case 'locked':
        return 'Đã chốt';
      case 'revealed':
        return 'Công bố';
      case 'summary':
        return 'Tổng kết';
      default:
        return 'Chuẩn bị';
    }
  }, [gameState.phase]);

  const isExpiredText =
    activeRemainingMs <= 0 &&
    (gameState.phase === 'answering' ||
      activeRecord?.outcome === 'timeout' ||
      gameState.finishReason === 'stopped_on_budget');

  return (
    <div
      onPointerDown={markUserGesture}
      className={`w-full flex flex-col bg-[#061128] text-white rounded-2xl border border-cyan-500/25 overflow-hidden shadow-xl ${
        isFullscreen ? 'h-full min-h-0' : ''
      }`}
    >
      {/* Top Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-[#091838] border-b border-cyan-500/25 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              soundBankRef.current?.stopAll();
              voiceRef.current?.stop();
              stopAllGlobalEduSpeech();
              onBackToLibrary();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-100 border border-slate-600 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về thư viện</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/45 text-amber-300 text-xs font-black">
              B10
            </span>
            <h2 className="text-sm sm:text-base font-extrabold text-white">
              Câu hỏi chớp nhoáng 3D
            </h2>
            {gameState.phase !== 'setup' && (
              <span className="hidden md:inline-block px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/35 text-[11px] font-bold text-cyan-200">
                {gameState.config.questionSource === 'sample_pack'
                  ? B10_SAMPLE_BADGE
                  : 'Ngân hàng Smart EDU'}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {/* 3D / 2D Toggle */}
          <button
            type="button"
            onClick={() => setQuality((q) => (q === 'high' ? '2d' : 'high'))}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              quality === '2d'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                : 'bg-slate-800/90 border-slate-600 text-slate-200 hover:bg-slate-700'
            }`}
            title="Chuyển giữa Bảng tăng tốc 3D và chế độ 2D nhẹ"
          >
            {quality === 'high' ? '3D Studio' : '2D Nhẹ'}
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              reducedMotion
                ? 'bg-indigo-500/25 border-indigo-400 text-indigo-200'
                : 'bg-slate-800/90 border-slate-600 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <span>{reducedMotion ? 'Đã giảm chuyển động' : 'Giảm chuyển động'}</span>
          </button>

          {/* Mute Toggle (Synced with A01/A02) */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
            }`}
            title={isMuted ? 'Đang tắt âm thanh' : 'Đang bật âm thanh'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isMuted ? 'Tắt tiếng' : 'Âm thanh'}</span>
          </button>

          {/* Vietnamese Voice Toggle */}
          <button
            type="button"
            onClick={handleToggleVoice}
            className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
              voiceEnabled && !isMuted
                ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}
            title={
              voiceSnapshot.hasVietnameseVoice
                ? 'Đọc tiếng Việt (vi-VN)'
                : 'Thiết bị chưa có giọng đọc vi-VN — hiển thị chữ và tín hiệu ngắn'
            }
          >
            <span>{isVoiceReading ? 'Đang đọc...' : voiceEnabled ? 'Giọng vi-VN' : 'Tắt giọng đọc'}</span>
          </button>

          {/* Guide Drawer Trigger */}
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Hướng dẫn</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 cursor-pointer"
            title={isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình trình chiếu'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Scrollable Content Container */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3">
        {/* ==================== SETUP SCREEN ==================== */}
        {gameState.phase === 'setup' && (
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Resume saved session banner if available */}
            {savedSession && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-amber-500/15 border border-amber-400/50">
                <div className="space-y-0.5">
                  <div className="text-sm font-extrabold text-amber-200">
                    Có phiên Câu hỏi chớp nhoáng đang lưu dở (Câu {savedSession.currentIndex + 1}/{savedSession.questions.length} · {savedSession.score} điểm)
                  </div>
                  <div className="text-xs text-amber-100/80">
                    Tiếp tục giữ nguyên điểm, câu đã chốt và cấu hình trước đó.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSavedSession}
                    className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Tiếp tục phiên cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearB10Session();
                      setSavedSession(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer"
                  >
                    Xóa phiên cũ
                  </button>
                </div>
              </div>
            )}

            {/* Studio Cover & Core Rules Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center rounded-2xl bg-gradient-to-br from-[#0b1c3f] to-[#08132d] border border-cyan-500/30 p-4">
              <div className="md:col-span-5">
                <img
                  src={imgB10Cover}
                  alt="B10 Câu hỏi chớp nhoáng 3D"
                  className="w-full aspect-video object-cover rounded-xl border border-cyan-400/35 shadow-md"
                />
              </div>
              <div className="md:col-span-7 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-xs font-extrabold">
                    <Zap className="w-3.5 h-3.5" /> Khởi động tiết học tức thì
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-extrabold">
                    10 câu mặc định · +10đ/câu đúng (100đ)
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white leading-tight">
                  Bảng tăng tốc 3D — Sẵn sàng mở câu mẫu ngay
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Mở ngay bộ đề mẫu 10 câu (không yêu cầu đăng nhập email hay tạo danh sách lớp trước). Giáo viên có thể trình chiếu cho 1–50 học sinh hoặc học sinh tự luyện nhanh đầu tiết.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSamplePreview(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem trước đề mẫu (10 câu)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-amber-200 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Xem hướng dẫn & phím tắt</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Configuration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Clock Mode */}
              <div className="rounded-2xl bg-[#0a1938] border border-slate-700/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-200">
                  <Clock className="w-4 h-4" />
                  <span>1. Chế độ đồng hồ & nhịp độ</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setClockMode('per_question')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      clockMode === 'per_question'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Hỏi chớp nhoáng từng câu</div>
                    <div className="text-[11px] opacity-85 mt-0.5">Mặc định 20 giây mỗi câu</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setClockMode('whole_turn')}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                      clockMode === 'whole_turn'
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Thử thách toàn lượt</div>
                    <div className="text-[11px] opacity-85 mt-0.5">Tổng quỹ 60 / 90 / 120 giây</div>
                  </button>
                </div>

                {clockMode === 'per_question' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Thời gian mỗi câu (giây):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {PER_Q_DURATION_CHOICES.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setPerQuestionSec(sec)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            perQuestionSec === sec
                              ? 'bg-cyan-500 text-slate-950 border-cyan-300'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {sec}s{sec === 20 ? ' (Mặc định)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Quỹ thời gian toàn lượt (dừng chuyển câu khi hết giờ):
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {B10_WHOLE_TURN_BUDGET_OPTIONS.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setWholeTurnSec(sec)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            wholeTurnSec === sec
                              ? 'bg-amber-400 text-slate-950 border-amber-300'
                              : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {sec} giây
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Participation & Explanation Timing */}
              <div className="rounded-2xl bg-[#0a1938] border border-slate-700/80 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
                  <Users className="w-4 h-4" />
                  <span>2. Hình thức chơi & công bố lời giải</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setParticipationMode('solo_class')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'solo_class'
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Tự luyện / Cả lớp</div>
                    <div className="text-[11px] opacity-85 mt-0.5">Chốt nhanh 1 đáp án trên màn hình</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setParticipationMode('teams_oral')}
                    className={`p-3 rounded-xl border text-left cursor-pointer ${
                      participationMode === 'teams_oral'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-900/70 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="text-xs font-black">Thi đua Đội / Gọi HS</div>
                    <div className="text-[11px] opacity-85 mt-0.5">2–6 đội · hỗ trợ lớp 1–50 HS</div>
                  </button>
                </div>

                {participationMode === 'teams_oral' && (
                  <div className="space-y-2 pt-1 border-t border-slate-700/70">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-300">Số đội thi đua:</span>
                      <div className="flex gap-1.5">
                        {[2, 3, 4, 5, 6].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setTeamCount(cnt)}
                            className={`w-7 h-7 rounded-md text-xs font-black border cursor-pointer ${
                              teamCount === cnt
                                ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Array.from({ length: teamCount }).map((_, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={teamNames[idx] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTeamNames((prev) => prev.map((n, i) => (i === idx ? val : n)));
                          }}
                          placeholder={`Tên Đội ${idx + 1}`}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 pt-1 border-t border-slate-700/70">
                  <label className="block text-xs font-bold text-slate-300">
                    Thời điểm hiện lời giải chi tiết:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setExplanationTiming('after_question')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        explanationTiming === 'after_question'
                          ? 'bg-sky-500 text-slate-950 border-sky-300'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      Sau mỗi câu
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplanationTiming('end_of_round')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                        explanationTiming === 'end_of_round'
                          ? 'bg-sky-500 text-slate-950 border-sky-300'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      Cuối ván (Tổng kết)
                    </button>
                  </div>
                </div>
              </div>

              {/* Question Source & Classroom Roster (Optional) */}
              <div className="rounded-2xl bg-[#0a1938] border border-slate-700/80 p-4 space-y-3 md:col-span-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-sm font-extrabold text-cyan-200">
                      3. Nguồn câu hỏi & tùy chọn ván
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setQuestionSource('sample_pack')}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          questionSource === 'sample_pack'
                            ? 'bg-cyan-500/20 border-cyan-400 text-white'
                            : 'bg-slate-900/70 border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-black">Bộ đề mẫu B10 (10 câu)</div>
                        <div className="text-[11px] text-amber-300 font-bold mt-0.5">
                          Nhãn: {B10_SAMPLE_BADGE}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuestionSource('bank')}
                        className={`p-3 rounded-xl border text-left cursor-pointer ${
                          questionSource === 'bank'
                            ? 'bg-indigo-500/20 border-indigo-400 text-white'
                            : 'bg-slate-900/70 border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-black">Ngân hàng Smart EDU</div>
                        <div className="text-[11px] opacity-85 mt-0.5">
                          Hiện có {availableBankCount} câu trắc nghiệm hợp lệ
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-extrabold text-slate-200">
                      Tùy chọn hỗ trợ & lớp học (không bắt buộc)
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shuffleOptions}
                          onChange={(e) => setShuffleOptions(e.target.checked)}
                          className="accent-cyan-400 w-4 h-4"
                        />
                        <span>Xáo thứ tự đáp án A/B/C/D</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hintsEnabled}
                          onChange={(e) => setHintsEnabled(e.target.checked)}
                          className="accent-amber-400 w-4 h-4"
                        />
                        <span>Cho phép mở Gợi ý</span>
                      </label>
                    </div>

                    {classes.length > 0 && (
                      <div className="pt-1">
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white focus:outline-none focus:border-cyan-400"
                        >
                          <option value="">Không gắn danh sách lớp (Chơi ngay)</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>
                              Lớp {cls.name} ({cls.students?.length || 0} học sinh)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {setupError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400 text-xs font-bold text-rose-100">
                    {setupError}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-700/70">
                  <div className="text-xs text-slate-300 font-semibold">
                    Điểm tối đa: <strong className="text-amber-300">100 điểm</strong> ({B10_POINTS_PER_CORRECT} điểm / câu đúng) · Điều khiển đầy đủ bằng chuột, cảm ứng hoặc bàn phím.
                  </div>
                  <button
                    type="button"
                    onClick={handleStartNewGame}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 hover:from-cyan-300 hover:to-sky-300 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>Bắt đầu ngay</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ACTIVE GAMEPLAY ==================== */}
        {gameState.phase !== 'setup' && gameState.phase !== 'summary' && activeQuestion && (
          <div className="max-w-6xl mx-auto space-y-3">
            {/* Compact HUD Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0a1938] border border-cyan-500/30">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 text-xs font-black">
                  Câu {gameState.currentIndex + 1} / {gameState.questions.length}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold">
                  {activeQuestion.topicLabel}
                </span>
                <span
                  className={`px-2.5 py-1 rounded-lg border text-xs font-extrabold ${
                    gameState.phase === 'answering'
                      ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                      : gameState.phase === 'paused'
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-sky-500/20 border-sky-400/50 text-sky-200'
                  }`}
                >
                  Trạng thái: {statusText}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-400/45 text-amber-200 text-xs font-black tabular-nums">
                  {gameState.score} / {gameState.maxScore} điểm
                </div>
                <div
                  className={`px-3 py-1 rounded-lg border text-xs font-black tabular-nums ${
                    isExpiredText
                      ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                      : activeRemainingSec <= 5 && gameState.phase === 'answering'
                        ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                        : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                  }`}
                >
                  {isExpiredText
                    ? 'Hết giờ'
                    : `Còn ${activeRemainingSec}s`}
                </div>

                {(gameState.phase === 'answering' || gameState.phase === 'paused') && (
                  <>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white cursor-pointer"
                    >
                      {gameState.phase === 'paused' ? (
                        <>
                          <Play className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Tiếp tục (P)</span>
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5 text-amber-300" />
                          <span>Tạm dừng (P)</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipQuestion}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/50 text-xs font-bold text-violet-200 cursor-pointer"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      <span>Bỏ câu (S)</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleEndEarly}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  Tổng kết sớm
                </button>
              </div>
            </div>

            {/* Teams / Student Caller Bar (when teams_oral or class selected) */}
            {(gameState.config.participationMode === 'teams_oral' ||
              gameState.config.classStudents.length > 0) && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700">
                {gameState.config.participationMode === 'teams_oral' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-300 mr-1">Đội trả lời:</span>
                    {gameState.teams.map((t, idx) => {
                      const active = idx === gameState.activeTeamIndex;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTeam(idx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border cursor-pointer transition-colors ${
                            active
                              ? 'bg-emerald-500/25 border-emerald-400 text-white'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {t.name}: {t.score}đ
                        </button>
                      );
                    })}
                  </div>
                )}

                {gameState.config.classStudents.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-200">
                      HS lượt này:{' '}
                      <strong>{gameState.activeCallerStudent?.fullName || 'Chưa chọn'}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handlePickStudent}
                      className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-xs font-bold text-cyan-100 cursor-pointer"
                    >
                      Gọi bạn khác
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3D Acceleration Board Stage */}
            <LightningQuiz3DScene
              records={gameState.records}
              currentIndex={gameState.currentIndex}
              phase={gameState.phase}
              clockMode={gameState.config.clockMode}
              remainingMs={activeRemainingMs}
              totalBudgetMs={totalBudgetMs}
              score={gameState.score}
              streak={gameState.streak}
              quality={quality}
              reducedMotion={reducedMotion}
              onWebGLFallback={() => setQuality('2d')}
            />

            {/* Fixed High-Contrast Question & Options Card (Separated from 3D camera) */}
            <div className="rounded-2xl bg-[#091836] border border-cyan-500/35 p-4 sm:p-5 space-y-3.5 shadow-lg">
              {gameState.phase === 'paused' ? (
                <div className="py-6 text-center space-y-3">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-200 text-sm font-black">
                    <Pause className="w-4 h-4" />
                    <span>Đang tạm dừng — Phần thời gian còn lại ({activeRemainingSec}s) được giữ nguyên</span>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleTogglePause}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-sm cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      <span>Tiếp tục làm bài (P)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Question Stem */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 text-base sm:text-xl font-bold text-white leading-relaxed overflow-x-auto">
                      <MathView content={activeQuestion.stem} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {gameState.config.hintsEnabled &&
                        gameState.phase === 'answering' &&
                        !gameState.activeHintRevealed && (
                          <button
                            type="button"
                            onClick={() => setGameState((prev) => revealB10Hint(prev))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-extrabold cursor-pointer"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Xem gợi ý (H)</span>
                          </button>
                        )}
                      {voiceEnabled && !isMuted && (
                        <button
                          type="button"
                          onClick={() => speakCurrentQuestion(activeQuestion.stem, `${gameState.turnToken}_manual_${Date.now()}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-sky-200 cursor-pointer"
                          title="Đọc câu hỏi bằng tiếng Việt"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Đọc đề</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Optional Image (triggers markB10MediaReady onLoad / onError) */}
                  {activeQuestion.image && (
                    <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950 max-w-md">
                      <img
                        src={activeQuestion.image}
                        alt={`Minh họa câu ${gameState.currentIndex + 1}`}
                        onLoad={() => setGameState((prev) => markB10MediaReady(prev, Date.now()))}
                        onError={() => setGameState((prev) => markB10MediaReady(prev, Date.now()))}
                        className="w-full max-h-48 object-contain"
                      />
                    </div>
                  )}

                  {/* Hint Box (Only displayed when explicitly opened) */}
                  {gameState.activeHintRevealed && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/45 text-xs sm:text-sm text-amber-100 flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div className="min-w-0 overflow-x-auto">
                        <strong className="text-amber-300 mr-1.5">Gợi ý:</strong>
                        <MathView content={activeQuestion.hintText} />
                      </div>
                    </div>
                  )}

                  {/* 4 High-Contrast Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeQuestion.options.map((opt, optIdx) => {
                      const isRevealed = gameState.phase === 'revealed';
                      const isSelected = activeRecord?.selectedOptionId === opt.optionId;
                      const isCorrect = activeQuestion.correctOptionId === opt.optionId;
                      const isFocused = gameState.phase === 'answering' && focusedOptionIdx === optIdx;

                      let btnStyle =
                        'bg-[#0f234c] hover:bg-[#163166] border-cyan-500/35 text-white';
                      if (isRevealed) {
                        if (isCorrect) {
                          btnStyle = 'bg-emerald-500/25 border-emerald-400 text-emerald-100';
                        } else if (isSelected) {
                          btnStyle = 'bg-rose-500/25 border-rose-400 text-rose-100';
                        } else {
                          btnStyle = 'bg-slate-900/70 border-slate-700 text-slate-400';
                        }
                      } else if (isFocused) {
                        btnStyle =
                          'bg-[#17346b] border-cyan-300 text-white ring-2 ring-cyan-300/80';
                      }

                      return (
                        <button
                          key={opt.optionId}
                          type="button"
                          disabled={gameState.phase !== 'answering'}
                          onClick={() => {
                            setFocusedOptionIdx(optIdx);
                            handleLockOption(opt.optionId);
                          }}
                          className={`group flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${btnStyle}`}
                        >
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                              isRevealed && isCorrect
                                ? 'bg-emerald-400 text-slate-950'
                                : isRevealed && isSelected
                                  ? 'bg-rose-400 text-slate-950'
                                  : 'bg-cyan-500/25 border border-cyan-400/50 text-cyan-200'
                            }`}
                          >
                            {opt.labelKey}
                          </span>
                          <div className="flex-1 min-w-0 text-sm sm:text-base font-bold overflow-x-auto">
                            <MathView content={opt.text} />
                          </div>
                          {isFocused && gameState.phase === 'answering' && (
                            <span className="hidden md:inline-block px-1.5 py-0.5 rounded bg-cyan-400/20 text-[10px] font-bold text-cyan-200 shrink-0">
                              Enter
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Revealed Feedback & Explanation / Skip Animation / Next */}
                  {gameState.phase === 'revealed' && activeRecord && (
                    <div className="rounded-xl bg-slate-950/85 border border-cyan-500/35 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                              activeRecord.outcome === 'correct'
                                ? 'bg-emerald-500 text-slate-950'
                                : activeRecord.outcome === 'skipped'
                                  ? 'bg-violet-400 text-slate-950'
                                  : activeRecord.outcome === 'timeout'
                                    ? 'bg-amber-400 text-slate-950'
                                    : 'bg-rose-500 text-white'
                            }`}
                          >
                            {activeRecord.outcome === 'correct'
                              ? `Chính xác! +${activeRecord.pointsAwarded} điểm`
                              : activeRecord.outcome === 'skipped'
                                ? 'Đã bỏ câu (0 điểm)'
                                : activeRecord.outcome === 'timeout'
                                  ? 'Hết giờ! (0 điểm)'
                                  : 'Chưa chính xác (0 điểm)'}
                          </span>
                          {activeRecord.answeredByLabel && (
                            <span className="text-xs font-bold text-slate-300">
                              {activeRecord.answeredByLabel}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {!gameState.revealAnimDone && (
                            <button
                              type="button"
                              onClick={() => setGameState((prev) => skipB10RevealAnimation(prev))}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                            >
                              <FastForward className="w-3.5 h-3.5" />
                              <span>Bỏ qua hoạt ảnh</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleAdvanceQuestion}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs sm:text-sm font-black cursor-pointer"
                          >
                            <span>
                              {gameState.currentIndex + 1 >= gameState.questions.length
                                ? 'Xem tổng kết (Enter)'
                                : 'Câu tiếp theo (Enter)'}
                            </span>
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {gameState.config.explanationTiming === 'after_question' ? (
                        <div className="text-xs sm:text-sm text-slate-200 leading-relaxed overflow-x-auto border-t border-slate-800 pt-2">
                          <strong className="text-cyan-300 mr-1.5">Lời giải:</strong>
                          <MathView content={activeQuestion.explanationText} />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-300 border-t border-slate-800 pt-2">
                          Đã ghi nhận đáp án — lời giải chi tiết sẽ hiển thị đầy đủ tại màn Tổng kết cuối ván.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Keyboard Focus & Shortcut Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-semibold text-slate-300">
                    <div className="inline-flex items-center gap-1.5">
                      <Keyboard className="w-3.5 h-3.5 text-cyan-300" />
                      <span>
                        Phím tắt: <strong>1–4</strong> / <strong>A–D</strong> chọn đáp án ·{' '}
                        <strong>Mũi tên + Enter</strong> chốt · <strong>S</strong> bỏ câu ·{' '}
                        <strong>P</strong> tạm dừng
                      </span>
                    </div>
                    {!voiceSnapshot.hasVietnameseVoice && voiceEnabled && (
                      <span className="text-slate-400">
                        {voiceSnapshot.statusMessage || 'Thiết bị không có giọng đọc vi-VN — hiển thị chữ trực tiếp'}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ==================== SUMMARY SCREEN ==================== */}
        {gameState.phase === 'summary' && (
          <div className="max-w-5xl mx-auto space-y-4">
            {/* Hero Score Card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0b1f47] to-[#08132d] border border-amber-400/45 p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/50 text-amber-300 text-xs font-extrabold">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>
                      {gameState.finishReason === 'stopped_on_budget'
                        ? 'Hết quỹ thời gian toàn lượt — Dừng chuyển câu'
                        : gameState.finishReason === 'ended_early'
                          ? 'Đã kết thúc lượt sớm'
                          : 'Hoàn thành lượt Câu hỏi chớp nhoáng'}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white">
                    Tổng điểm: <span className="text-amber-300">{summary.score}</span> /{' '}
                    {summary.maxScore} điểm
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-semibold">
                    Chính xác {summary.accuracyPercent}% · Chuỗi đúng dài nhất: {gameState.bestStreak} câu · Lượt dùng gợi ý: {summary.totalHintsUsed}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartNewGame}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Chơi lại ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearB10Session();
                      setGameState(createB10SetupState());
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    <span>Đổi cấu hình</span>
                  </button>
                </div>
              </div>

              {/* 5 Distinct Outcome Buckets */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-400/45 text-center">
                  <div className="text-xl font-black text-emerald-300 tabular-nums">
                    {summary.correctCount}
                  </div>
                  <div className="text-xs font-bold text-emerald-100">Đúng</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-400/45 text-center">
                  <div className="text-xl font-black text-rose-300 tabular-nums">
                    {summary.wrongCount}
                  </div>
                  <div className="text-xs font-bold text-rose-100">Sai</div>
                </div>
                <div className="p-3 rounded-xl bg-violet-500/15 border border-violet-400/45 text-center">
                  <div className="text-xl font-black text-violet-300 tabular-nums">
                    {summary.skippedCount}
                  </div>
                  <div className="text-xs font-bold text-violet-100">Đã bỏ câu</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/45 text-center">
                  <div className="text-xl font-black text-amber-300 tabular-nums">
                    {summary.timeoutCount}
                  </div>
                  <div className="text-xs font-bold text-amber-100">Hết giờ</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-600 text-center col-span-2 sm:col-span-1">
                  <div className="text-xl font-black text-slate-200 tabular-nums">
                    {summary.unseenCount}
                  </div>
                  <div className="text-xs font-bold text-slate-300">Chưa thấy câu</div>
                </div>
              </div>

              {/* Team Standings if teams_oral */}
              {gameState.config.participationMode === 'teams_oral' && gameState.teams.length > 1 && (
                <div className="pt-2 border-t border-slate-700/70 space-y-2">
                  <div className="text-xs font-extrabold text-cyan-200">Bảng điểm các đội:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                    {[...gameState.teams]
                      .sort((a, b) => b.score - a.score)
                      .map((t) => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-center"
                        >
                          <div className="text-xs font-extrabold text-white truncate">{t.name}</div>
                          <div className="text-base font-black text-amber-300">{t.score}đ</div>
                          <div className="text-[11px] text-slate-400">{t.correctCount} câu đúng</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Completed & Unseen Question Review List with "Xem lời giải" */}
            <div className="rounded-2xl bg-[#091836] border border-cyan-500/30 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-cyan-300" />
                  <span>Xem lại từng câu & lời giải chi tiết</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const allOpen = gameState.records.every((r) => expandedReviewIds[r.questionId]);
                    const next: Record<string, boolean> = {};
                    gameState.records.forEach((r) => {
                      next[r.questionId] = !allOpen;
                    });
                    setExpandedReviewIds(next);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-cyan-200 cursor-pointer"
                >
                  Mở / Thu gọn tất cả lời giải
                </button>
              </div>

              <div className="space-y-2.5">
                {gameState.records.map((rec) => {
                  const correctOpt = rec.options.find((o) => o.optionId === rec.correctOptionId);
                  const selectedOpt = rec.options.find((o) => o.optionId === rec.selectedOptionId);
                  const isExpanded = Boolean(expandedReviewIds[rec.questionId]);

                  const pillStyle =
                    rec.outcome === 'correct'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                      : rec.outcome === 'wrong'
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : rec.outcome === 'skipped'
                          ? 'bg-violet-500/20 border-violet-400 text-violet-200'
                          : rec.outcome === 'timeout'
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                            : 'bg-slate-800 border-slate-600 text-slate-300';

                  const pillLabel =
                    rec.outcome === 'correct'
                      ? 'Đúng (+10đ)'
                      : rec.outcome === 'wrong'
                        ? 'Sai'
                        : rec.outcome === 'skipped'
                          ? 'Đã bỏ câu'
                          : rec.outcome === 'timeout'
                            ? 'Hết giờ'
                            : 'Chưa thấy câu';

                  return (
                    <div
                      key={rec.questionId}
                      className="rounded-xl bg-slate-900/80 border border-slate-700 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-black text-cyan-300">
                              Câu {rec.index + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${pillStyle}`}>
                              {pillLabel}
                            </span>
                            {rec.hintUsed && (
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/40 text-[10px] font-bold text-amber-200">
                                Đã mở gợi ý
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-bold text-white overflow-x-auto">
                            <MathView content={rec.stem} />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReviewIds((prev) => ({
                              ...prev,
                              [rec.questionId]: !prev[rec.questionId],
                            }))
                          }
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-xs font-extrabold text-cyan-200 shrink-0 cursor-pointer"
                        >
                          {isExpanded ? 'Ẩn lời giải' : 'Xem lời giải'}
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                        {selectedOpt && (
                          <span>
                            Đã chọn: <strong className="text-white">{selectedOpt.labelKey}. </strong>
                            <MathView content={selectedOpt.text} />
                          </span>
                        )}
                        {correctOpt && (
                          <span>
                            Đáp án đúng:{' '}
                            <strong className="text-emerald-300">{correctOpt.labelKey}. </strong>
                            <MathView content={correctOpt.text} />
                          </span>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="p-2.5 rounded-lg bg-[#08152e] border border-cyan-500/25 text-xs sm:text-sm text-cyan-100 overflow-x-auto">
                          <strong className="text-amber-300 mr-1.5">Hướng dẫn giải:</strong>
                          <MathView content={rec.explanationText} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== MODAL: SAMPLE QUESTIONS PREVIEW ==================== */}
      {showSamplePreview && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl bg-[#091838] border border-cyan-400/45 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <h3 className="text-sm sm:text-base font-black text-white">
                  Xem trước Bộ đề mẫu B10 (10 câu · {B10_SAMPLE_BADGE})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSamplePreview(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {B10_SAMPLE_QUESTIONS.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-3 rounded-xl bg-slate-900/90 border border-slate-700 space-y-1.5"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                    <span>Câu {idx + 1}</span>
                    <span className="text-slate-400">· {q.topicLabel}</span>
                  </div>
                  <div className="text-sm font-bold text-white overflow-x-auto">
                    <MathView content={q.stem} />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs text-slate-300">
                    {q.options.map((o) => (
                      <div
                        key={o.optionId}
                        className={`px-2 py-1 rounded border ${
                          o.optionId === q.correctOptionId
                            ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200 font-bold'
                            : 'bg-slate-800/80 border-slate-700'
                        }`}
                      >
                        <span className="mr-1 font-black">{o.labelKey}.</span>
                        <MathView content={o.text} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RULES & SHORTCUTS GUIDE ==================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[#091838] border border-amber-400/45 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <h3 className="text-sm sm:text-base font-black text-white">
                  Hướng dẫn luật chơi & Phím tắt B10
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs sm:text-sm text-slate-200 leading-relaxed">
              <p>
                <strong className="text-cyan-300">1. Quy tắc điểm chuẩn:</strong> Mặc định gồm 10 câu hỏi, mỗi câu đúng được <strong>+10 điểm</strong> (tối đa <strong>100 điểm</strong>). Bấm “Xem gợi ý” chỉ hỗ trợ tư duy học tập, không làm thay đổi đáp án đã chọn.
              </p>
              <p>
                <strong className="text-cyan-300">2. Hai chế độ đồng hồ:</strong>{' '}
                <em>Hỏi chớp nhoáng từng câu</em> (mặc định 20 giây/câu) và <em>Thử thách toàn lượt</em> (60s / 90s / 120s cho cả ván; khi hết quỹ giờ chung, hệ thống dừng chuyển câu ngay và tách các câu chưa mở thành “Chưa thấy câu”).
              </p>
              <p>
                <strong className="text-cyan-300">3. Thống kê minh bạch:</strong> Màn tổng kết tách rõ 5 nhóm: <strong>Đúng</strong>, <strong>Sai</strong>, <strong>Đã bỏ câu</strong>, <strong>Hết giờ</strong> và <strong>Chưa thấy câu</strong>.
              </p>
              <p>
                <strong className="text-cyan-300">4. Phím tắt điều khiển:</strong> Phím <strong>1–4</strong> hoặc <strong>A–D</strong> chốt đáp án; <strong>Mũi tên + Enter</strong> di chuyển & xác nhận; <strong>S</strong> bỏ qua câu; <strong>H</strong> mở gợi ý; <strong>P</strong> tạm dừng / tiếp tục; <strong>Enter</strong> ở màn công bố để chuyển câu.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LightningQuiz3DGame;
