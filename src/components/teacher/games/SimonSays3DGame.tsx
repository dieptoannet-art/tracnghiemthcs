/**
 * E04 — SIMON SAYS (SIMON BẢO) 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * - School auditorium 3D stage with front-facing articulated 3D instructor + 2D SVG fallback
 * - 2 Modes:
 *   1. "Simon bảo" ('simon_says'): rule + 2 non-scored warm-up turns + 8 scored turns (4 with "Simon bảo:", 4 direct)
 *   2. "Đúng thì làm – Toán THCS" ('math_true_do'): 8 sample Math turns (4 True -> Execute, 4 False -> Hold), KaTeX MathView
 * - 3 Participant Modes: Tự luyện (1 HS), Cả lớp (1–50 HS, không tính điểm), Nhiều đội (2–6 đội, tính điểm)
 * - Strict anti-spoiler before reveal: identical typography/color/layout & neutral signal; instructor stays ready_wait until reveal
 * - Teams mode strictly distinguishes "Chưa ghi nhận" ('unrecorded') from "Giữ nguyên" ('hold') and "Không trả lời" ('no_answer')
 * - Unified A01/A02 audio + strict vi-VN voice, Pause/Skip/Edit-last-turn, keyboard shortcuts, /demo-isolated persistence
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FastForward,
  Hand,
  HelpCircle,
  Layers,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
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
  E04_GESTURES,
  E04_MATH_PACK_TITLE,
  E04_POINTS_CORRECT,
  E04_SAMPLE_BADGE,
  SIMON_TEAM_PALETTES,
  SimonActionGestureId,
  SimonDecision,
  SimonGameMode,
  SimonGestureId,
  SimonParticipantMode,
  SimonPostureSetting,
  SimonSaysConfig,
  SimonSaysState,
  SimonTeamInput,
  SimonTurnSubPhase,
  advanceSimonTurn,
  buildSimonCommandDisplayText,
  buildSimonCommandSpeechText,
  clearE04Session,
  commitSimonTurn,
  computeSimonStandings,
  createDefaultSimonSaysConfig,
  createInitialSimonSaysState,
  createSimonTeams,
  editLastSimonTurn,
  getExpectedDecisionForTurn,
  getSimonGestureSpec,
  loadE04Session,
  resolveSimonInstructorPoseForPhase,
  saveE04Session,
  validateSimonSetupConfig,
} from './simonSays3dEngine';
import { SimonSays3DScene } from './SimonSays3DScene';

export interface SimonSays3DGameProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary: () => void;
}

const TIMER_PRESETS = [
  { label: 'Không giới hạn', value: 0 },
  { label: '10 giây', value: 10 },
  { label: '15 giây', value: 15 },
  { label: '20 giây', value: 20 },
];

const DECISION_LABELS: Record<SimonDecision | 'no_answer' | 'unrecorded', string> = {
  execute: 'Thực hiện',
  hold: 'Giữ nguyên',
  no_answer: 'Không trả lời',
  unrecorded: 'Chưa ghi nhận',
};

function buildUnrecordedTeamMap(config: SimonSaysConfig): Record<string, SimonTeamInput> {
  const map: Record<string, SimonTeamInput> = {};
  config.teams.forEach((t) => {
    map[t.id] = 'unrecorded';
  });
  return map;
}

export const SimonSays3DGame: React.FC<SimonSays3DGameProps> = ({
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & Voice controllers (shared A01/A02 architecture)
  const soundBankRef = useRef<EduGameSoundBank | null>(null);
  const voiceCtrlRef = useRef<EduGameVoiceController | null>(null);
  if (!soundBankRef.current) {
    soundBankRef.current = new EduGameSoundBank();
  }
  if (!voiceCtrlRef.current) {
    voiceCtrlRef.current = new EduGameVoiceController();
  }

  const [isMuted, setIsMuted] = useState<boolean>(() => loadEduGameMuted());
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled());
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceManagerSnapshot>(() =>
    voiceCtrlRef.current!.getSnapshot()
  );
  const [force2D, setForce2D] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Setup & Session state
  const [config, setConfig] = useState<SimonSaysConfig>(() =>
    createDefaultSimonSaysConfig('simon_says')
  );
  const [session, setSession] = useState<SimonSaysState | null>(null);
  const [savedSessionToResume, setSavedSessionToResume] = useState<SimonSaysState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [setupPreviewGesture, setSetupPreviewGesture] = useState<SimonGestureId>('raise_one_hand');

  // Active turn runtime state
  const [subPhase, setSubPhase] = useState<SimonTurnSubPhase>('thinking');
  const [soloChoice, setSoloChoice] = useState<SimonDecision | 'no_answer' | null>(null);
  const [teamChoices, setTeamChoices] = useState<Record<string, SimonTeamInput>>({});
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [skipAnimationKey, setSkipAnimationKey] = useState<number>(0);

  // Edit-last-turn modal/drawer & review/zoom modals
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);
  const [editDraftChoices, setEditDraftChoices] = useState<Record<string, SimonTeamInput>>({});
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Anti-double-click & turn token refs
  const actionLockUntilRef = useRef<number>(0);
  const turnTokenRef = useRef<string>('e04_init');

  const isDemo = isKhktDemoRuntime();

  const stopAllAudio = useCallback(() => {
    soundBankRef.current?.stopAll();
    voiceCtrlRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, []);

  // Load saved session & subscribe to Vietnamese voice availability
  useEffect(() => {
    const loaded = loadE04Session();
    if (loaded.state) {
      setSavedSessionToResume(loaded.state);
    } else if (loaded.recoveredFromCorruption) {
      setStorageNotice('Phiên lưu E04 trước đó không hợp lệ và đã được đặt lại an toàn.');
    }

    const unsubscribe = voiceCtrlRef.current?.subscribe((snap) => {
      setVoiceSnapshot(snap);
    });

    return () => {
      unsubscribe?.();
      stopAllAudio();
      soundBankRef.current?.dispose();
      voiceCtrlRef.current?.dispose();
    };
  }, [stopAllAudio]);

  // Persist active session whenever it updates
  useEffect(() => {
    if (session) {
      saveE04Session(session);
    }
  }, [session]);

  const showToast = useCallback((msg: string) => {
    setToastNotice(msg);
  }, []);

  useEffect(() => {
    if (!toastNotice) return;
    const t = window.setTimeout(() => setToastNotice(null), 3200);
    return () => window.clearTimeout(t);
  }, [toastNotice]);

  // Derived active turn & standings
  const currentTurn = useMemo(() => {
    if (!session || session.status !== 'playing') return null;
    return session.turns[session.currentTurnIndex] || null;
  }, [session]);

  const lastCommittedRecord = useMemo(() => {
    if (!session || session.history.length === 0) return null;
    return session.history[session.history.length - 1];
  }, [session]);

  const currentTurnRecord = useMemo(() => {
    if (!session || !currentTurn) return null;
    return session.history.find((h) => h.turnId === currentTurn.id) || null;
  }, [session, currentTurn]);

  const standings = useMemo(() => {
    if (!session) return [];
    return computeSimonStandings(session);
  }, [session]);

  const setupValidation = useMemo(() => validateSimonSetupConfig(config), [config]);

  const scoredTurnsTotal = useMemo(() => {
    if (!session) return 0;
    return session.turns.filter((t) => !t.isWarmup).length;
  }, [session]);

  const scoredTurnOrdinal = useMemo(() => {
    if (!session || !currentTurn || currentTurn.isWarmup) return 0;
    let count = 0;
    for (let i = 0; i <= session.currentTurnIndex; i++) {
      if (session.turns[i] && !session.turns[i].isWarmup) count += 1;
    }
    return count;
  }, [session, currentTurn]);

  const warmupTurnOrdinal = useMemo(() => {
    if (!session || !currentTurn || !currentTurn.isWarmup) return 0;
    let count = 0;
    for (let i = 0; i <= session.currentTurnIndex; i++) {
      if (session.turns[i]?.isWarmup) count += 1;
    }
    return count;
  }, [session, currentTurn]);

  const unrecordedTeamsCount = useMemo(() => {
    if (!session || session.config.participantMode !== 'teams') return 0;
    return session.config.teams.filter(
      (t) => !teamChoices[t.id] || teamChoices[t.id] === 'unrecorded'
    ).length;
  }, [session, teamChoices]);

  const activeInstructorPose: SimonGestureId = useMemo(() => {
    if (!session) return setupPreviewGesture;
    const poseTurn =
      currentTurn || (session.turns.length > 0 ? session.turns[session.turns.length - 1] : null);
    return resolveSimonInstructorPoseForPhase({
      phase: subPhase,
      turn: poseTurn,
    });
  }, [session, setupPreviewGesture, subPhase, currentTurn]);

  // Helper to guard against rapid double-click
  const acquireActionLock = useCallback((ms = 180): boolean => {
    const now = Date.now();
    if (now < actionLockUntilRef.current) return false;
    actionLockUntilRef.current = now + ms;
    return true;
  }, []);

  // Reset per-turn UI state when starting/advancing a turn
  const prepareTurnRuntime = useCallback(
    (nextSession: SimonSaysState) => {
      stopAllAudio();
      const token = `e04_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      soundBankRef.current?.setActiveTurnToken(token);
      turnTokenRef.current = token;
      setSubPhase('thinking');
      setSoloChoice(null);
      setTeamChoices(buildUnrecordedTeamMap(nextSession.config));
      setIsPaused(false);
      setIsEditingLastTurn(false);
      setRemainingSeconds(nextSession.config.timerSeconds);
    },
    [stopAllAudio]
  );

  // Toggle sound / voice / pause
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) {
        stopAllAudio();
      } else {
        soundBankRef.current?.unlock();
      }
      return next;
    });
  }, [stopAllAudio]);

  const handleToggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      saveEduGameVoiceEnabled(next);
      if (!next) {
        voiceCtrlRef.current?.stop();
        stopAllGlobalEduSpeech();
      }
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    if (!session || session.status !== 'playing') return;
    setIsPaused((prev) => {
      const next = !prev;
      if (next) {
        stopAllAudio();
      }
      return next;
    });
  }, [session, stopAllAudio]);

  // Countdown timer (only runs when timerSeconds > 0, not paused, not revealed)
  useEffect(() => {
    if (
      !session ||
      session.status !== 'playing' ||
      session.config.timerSeconds <= 0 ||
      isPaused ||
      subPhase === 'revealed'
    ) {
      return;
    }
    if (remainingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          soundBankRef.current?.playTimerBell(isMuted);
          return 0;
        }
        if (prev >= 2 && prev <= 4) {
          const step = (prev - 1) as 1 | 2 | 3;
          soundBankRef.current?.playCountdownBeep(step, isMuted, turnTokenRef.current);
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, isPaused, subPhase, remainingSeconds, isMuted]);

  // Speak verbatim current command in Vietnamese (never adds "Simon bảo" to direct commands!)
  const speakCurrentCommand = useCallback(
    (turnOverride?: typeof currentTurn) => {
      const target = turnOverride ?? currentTurn;
      if (!target || isMuted || !voiceEnabled) return;
      const verbatim = buildSimonCommandSpeechText(target);
      voiceCtrlRef.current?.replayText({
        text: verbatim,
        isMuted,
        voiceEnabled,
      });
    },
    [currentTurn, isMuted, voiceEnabled]
  );

  // Start new session from setup
  const handleStartSession = useCallback(() => {
    if (!setupValidation.valid || !acquireActionLock(220)) return;
    soundBankRef.current?.unlock();
    const initial = createInitialSimonSaysState({ config });
    setSession(initial);
    setSavedSessionToResume(null);
    prepareTurnRuntime(initial);
  }, [setupValidation.valid, acquireActionLock, config, prepareTurnRuntime]);

  // Resume saved session
  const handleResumeSavedSession = useCallback(() => {
    if (!savedSessionToResume || !acquireActionLock(220)) return;
    soundBankRef.current?.unlock();
    const restored = advanceSimonTurn(savedSessionToResume);
    setConfig(restored.config);
    setSession(restored);
    setSavedSessionToResume(null);
    prepareTurnRuntime(restored);
  }, [savedSessionToResume, acquireActionLock, prepareTurnRuntime]);

  // Replay with same config (re-shuffles scored turns in Simon mode)
  const handleReplaySameConfig = useCallback(() => {
    if (!session || !acquireActionLock(220)) return;
    stopAllAudio();
    soundBankRef.current?.unlock();
    const fresh = createInitialSimonSaysState({ config: session.config });
    setSession(fresh);
    setShowReviewModal(false);
    setShowZoomModal(false);
    prepareTurnRuntime(fresh);
  }, [session, acquireActionLock, stopAllAudio, prepareTurnRuntime]);

  // Return to setup screen
  const handleReturnToSetup = useCallback(() => {
    stopAllAudio();
    setSession(null);
    setShowReviewModal(false);
    setShowZoomModal(false);
    setIsEditingLastTurn(false);
    setIsPaused(false);
    const loaded = loadE04Session();
    setSavedSessionToResume(loaded.state);
  }, [stopAllAudio]);

  // Teacher clicks "Ra hiệu" (plays ONE neutral start signal + optional verbatim Vietnamese speech)
  const handleTriggerSignal = useCallback(() => {
    if (!session || !currentTurn || isPaused || subPhase === 'revealed') return;
    if (!acquireActionLock(180)) return;
    soundBankRef.current?.unlock();
    const token = turnTokenRef.current;
    soundBankRef.current?.playSimonSignalCue(isMuted, token);
    speakCurrentCommand(currentTurn);
    if (subPhase === 'thinking') {
      setSubPhase('signal_collect');
    }
  }, [session, currentTurn, isPaused, subPhase, acquireActionLock, isMuted, speakCurrentCommand]);

  // Solo Practice: student clicks "Thực hiện" or "Giữ nguyên" immediately once displayed
  const handleSoloSelectDecision = useCallback(
    (decision: SimonDecision) => {
      if (
        !session ||
        !currentTurn ||
        session.config.participantMode !== 'solo_practice' ||
        isPaused ||
        subPhase === 'revealed'
      ) {
        return;
      }
      if (!acquireActionLock(200)) return;
      soundBankRef.current?.unlock();
      voiceCtrlRef.current?.stop();

      const res = commitSimonTurn(session, {
        turn: currentTurn,
        soloChoice: decision,
      });
      if (!res.committed) return;

      setSoloChoice(decision);
      setSession(res.state);
      setSubPhase('revealed');

      const expected = getExpectedDecisionForTurn(currentTurn);
      const isRight = decision === expected;
      soundBankRef.current?.playSimonFeedbackCue(isRight, isMuted, turnTokenRef.current);
      if (res.state.status === 'finished') {
        window.setTimeout(() => {
          soundBankRef.current?.playSimonSessionSummary(isMuted, turnTokenRef.current);
        }, 380);
      }
    },
    [session, currentTurn, isPaused, subPhase, acquireActionLock, isMuted]
  );

  // Whole-Class or Warm-up reveal (non-scored)
  const handleRevealNonScored = useCallback(() => {
    if (!session || !currentTurn || isPaused || subPhase === 'revealed') return;
    if (!acquireActionLock(200)) return;
    soundBankRef.current?.unlock();
    voiceCtrlRef.current?.stop();

    const res = commitSimonTurn(session, {
      turn: currentTurn,
    });
    if (!res.committed) return;

    setSession(res.state);
    setSubPhase('revealed');
    soundBankRef.current?.playSimonFeedbackCue(true, isMuted, turnTokenRef.current);
    if (res.state.status === 'finished') {
      window.setTimeout(() => {
        soundBankRef.current?.playSimonSessionSummary(isMuted, turnTokenRef.current);
      }, 380);
    }
  }, [session, currentTurn, isPaused, subPhase, acquireActionLock, isMuted]);

  // Teams mode: record choice per team
  const handleSetTeamChoice = useCallback(
    (teamId: string, choice: SimonTeamInput) => {
      if (isPaused || subPhase === 'revealed') return;
      setTeamChoices((prev) => ({
        ...prev,
        [teamId]: choice,
      }));
    },
    [isPaused, subPhase]
  );

  // Teams mode: bulk set all unrecorded teams to a specific explicit choice
  const handleMarkRemainingTeams = useCallback(
    (choice: SimonDecision | 'no_answer') => {
      if (!session || isPaused || subPhase === 'revealed') return;
      setTeamChoices((prev) => {
        const next = { ...prev };
        session.config.teams.forEach((t) => {
          if (!next[t.id] || next[t.id] === 'unrecorded') {
            next[t.id] = choice;
          }
        });
        return next;
      });
    },
    [session, isPaused, subPhase]
  );

  // Teams mode: confirm & reveal scored turn (strictly rejects unrecorded teams)
  const handleConfirmTeamsTurn = useCallback(() => {
    if (!session || !currentTurn || isPaused || subPhase === 'revealed') return;
    if (!acquireActionLock(200)) return;

    if (currentTurn.isWarmup) {
      handleRevealNonScored();
      return;
    }

    if (unrecordedTeamsCount > 0) {
      showToast(
        `Còn ${unrecordedTeamsCount} đội ở trạng thái “Chưa ghi nhận”. Vui lòng ghi nhận đầy đủ trước khi xác nhận.`
      );
      return;
    }

    soundBankRef.current?.unlock();
    voiceCtrlRef.current?.stop();

    const res = commitSimonTurn(session, {
      turn: currentTurn,
      teamChoices,
    });
    if (!res.committed) {
      if (res.reason === 'unrecorded_team') {
        showToast('Vui lòng ghi nhận đủ tất cả các đội trước khi xác nhận.');
      }
      return;
    }

    setSession(res.state);
    setSubPhase('revealed');

    const anyRight = Object.values(res.record?.isCorrectByParticipant || {}).some(Boolean);
    soundBankRef.current?.playSimonFeedbackCue(anyRight, isMuted, turnTokenRef.current);
    if (res.state.status === 'finished') {
      window.setTimeout(() => {
        soundBankRef.current?.playSimonSessionSummary(isMuted, turnTokenRef.current);
      }, 380);
    }
  }, [
    session,
    currentTurn,
    isPaused,
    subPhase,
    acquireActionLock,
    handleRevealNonScored,
    unrecordedTeamsCount,
    showToast,
    teamChoices,
    isMuted,
  ]);

  // Open edit-last-turn drawer
  const handleOpenEditLastTurn = useCallback(() => {
    if (
      !session ||
      session.config.participantMode !== 'teams' ||
      !lastCommittedRecord ||
      lastCommittedRecord.isWarmup ||
      isPaused
    ) {
      return;
    }
    const draft: Record<string, SimonTeamInput> = {};
    session.config.teams.forEach((t) => {
      draft[t.id] = lastCommittedRecord.choiceByParticipant[t.id] || 'unrecorded';
    });
    setEditDraftChoices(draft);
    setIsEditingLastTurn(true);
  }, [session, lastCommittedRecord, isPaused]);

  const handleSaveEditedLastTurn = useCallback(() => {
    if (!session || !acquireActionLock(180)) return;
    const res = editLastSimonTurn(session, editDraftChoices);
    if (!res.edited) {
      showToast('Vui lòng chọn rõ kết quả cho tất cả các đội trước khi lưu.');
      return;
    }
    setSession(res.state);
    setIsEditingLastTurn(false);
    showToast('Đã cập nhật điểm lượt vừa chấm từ lịch sử.');
  }, [session, acquireActionLock, editDraftChoices, showToast]);

  // Advance to next turn (teacher-paced)
  const handleNextTurn = useCallback(() => {
    if (!session || isPaused) return;
    if (!acquireActionLock(180)) return;
    stopAllAudio();
    if (session.status === 'finished') {
      setSubPhase('revealed');
      return;
    }
    const next = advanceSimonTurn(session);
    setSession(next);
    prepareTurnRuntime(next);
  }, [session, isPaused, acquireActionLock, stopAllAudio, prepareTurnRuntime]);

  // Keyboard shortcuts: 1/E = Thực hiện, 2/G = Giữ nguyên, Enter = Signal/Confirm/Next, P = Pause, Esc = Close modals
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        if (showZoomModal) {
          setShowZoomModal(false);
          return;
        }
        if (showReviewModal) {
          setShowReviewModal(false);
          return;
        }
        if (isEditingLastTurn) {
          setIsEditingLastTurn(false);
          return;
        }
        return;
      }

      const onSummaryScreen = session ? session.status === 'finished' && subPhase !== 'revealed' : false;
      if (!session || onSummaryScreen) return;

      if (e.key === 'p' || e.key === 'P') {
        if (session.status === 'playing') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (isPaused || showZoomModal || showReviewModal || isEditingLastTurn) return;

      if (session.config.participantMode === 'solo_practice' && subPhase !== 'revealed') {
        if (e.key === '1' || e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          handleSoloSelectDecision('execute');
          return;
        }
        if (e.key === '2' || e.key === 'g' || e.key === 'G') {
          e.preventDefault();
          handleSoloSelectDecision('hold');
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (subPhase === 'revealed') {
          if (session.status === 'finished') {
            setSubPhase('thinking');
          } else {
            handleNextTurn();
          }
        } else if (subPhase === 'thinking' && session.config.participantMode !== 'solo_practice') {
          handleTriggerSignal();
        } else if (subPhase === 'signal_collect') {
          if (session.config.participantMode === 'whole_class' || currentTurn?.isWarmup) {
            handleRevealNonScored();
          } else if (session.config.participantMode === 'teams' && unrecordedTeamsCount === 0) {
            handleConfirmTeamsTurn();
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    session,
    isPaused,
    subPhase,
    currentTurn,
    unrecordedTeamsCount,
    showZoomModal,
    showReviewModal,
    isEditingLastTurn,
    handleTogglePause,
    handleSoloSelectDecision,
    handleNextTurn,
    handleTriggerSignal,
    handleRevealNonScored,
    handleConfirmTeamsTurn,
  ]);

  // Handle back to library with full audio cleanup
  const handleExitToLibrary = useCallback(() => {
    stopAllAudio();
    onBackToLibrary();
  }, [stopAllAudio, onBackToLibrary]);

  // ============================================================================
  // SHARED TOP BAR (Consistent with A01/A02/E01/E02)
  // ============================================================================
  const renderTopBar = () => (
    <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#09162D] border-b border-teal-500/25 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={handleExitToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600/80 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về thư viện</span>
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-teal-500/20 border border-teal-400/50 text-teal-200 text-[11px] font-black tracking-wide">
              E04
            </span>
            <h1 className="text-sm sm:text-base font-black text-white truncate">
              Simon Says (Simon bảo) 3D
            </h1>
            {isDemo && (
              <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[10px] font-bold">
                Bản demo KHKT
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setForce2D((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            force2D
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
              : 'bg-slate-800/90 text-slate-200 border-slate-600/80 hover:bg-slate-700'
          }`}
          title="Chuyển đổi giữa sân khấu 3D và chế độ 2D dự phòng"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{force2D ? 'Đang dùng 2D' : 'Sân khấu 3D'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReducedMotion((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            reducedMotion
              ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
              : 'bg-slate-800/90 text-slate-200 border-slate-600/80 hover:bg-slate-700'
          }`}
          title="Giảm chuyển động cho máy cấu hình thấp hoặc người nhạy cảm"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{reducedMotion ? 'Giảm CĐ' : 'Hoạt ảnh'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleVoice}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            voiceEnabled && !isMuted
              ? 'bg-teal-600/30 text-teal-100 border-teal-400/60'
              : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title={
            voiceSnapshot.hasVietnameseVoice
              ? 'Bật/tắt giọng đọc tiếng Việt (nguyên văn câu lệnh)'
              : 'Trình duyệt hiện không có giọng đọc tiếng Việt (vi-VN) — vẫn chơi mượt bằng chữ'
          }
        >
          {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Giọng VI</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
            isMuted
              ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
              : 'bg-amber-400/20 text-amber-100 border-amber-400/50 hover:bg-amber-400/30'
          }`}
          title="Bật/tắt toàn bộ âm thanh & giọng đọc"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600/80 transition-colors cursor-pointer"
            title="Chế độ toàn màn hình trình chiếu"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        )}
      </div>
    </header>
  );

  // ============================================================================
  // VIEW 1: SETUP SCREEN
  // ============================================================================
  if (!session) {
    const previewSpec = getSimonGestureSpec(
      setupPreviewGesture === 'ready_wait' ? 'raise_one_hand' : setupPreviewGesture
    );

    return (
      <div
        className={`w-full bg-[#071226] text-slate-100 flex flex-col overflow-hidden ${
          isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[680px]'
        }`}
      >
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-5">
            {storageNotice && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{storageNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStorageNotice(null)}
                  className="p-1 hover:bg-amber-500/20 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {voiceEnabled && !isMuted && !voiceSnapshot.hasVietnameseVoice && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-800/90 border border-slate-600 text-slate-200 text-xs">
                <MicOff className="w-4 h-4 text-amber-300 shrink-0" />
                <span>
                  Trình duyệt chưa có giọng đọc tiếng Việt (vi-VN). Trò chơi vẫn giữ nguyên hiệu lệnh chữ lớn trên sân khấu và âm thanh báo hiệu chuẩn.
                </span>
              </div>
            )}

            {savedSessionToResume && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-teal-500/15 border border-teal-400/40">
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-teal-100">
                    Có phiên E04 đang lưu dở ({savedSessionToResume.history.length}/{savedSessionToResume.turns.length} lượt)
                  </p>
                  <p className="text-xs text-teal-200/80">
                    Chế độ:{' '}
                    {savedSessionToResume.config.mode === 'simon_says'
                      ? 'Simon bảo'
                      : E04_MATH_PACK_TITLE}{' '}
                    ·{' '}
                    {savedSessionToResume.config.participantMode === 'solo_practice'
                      ? 'Tự luyện (1 HS)'
                      : savedSessionToResume.config.participantMode === 'whole_class'
                      ? 'Cả lớp (không tính điểm)'
                      : `${savedSessionToResume.config.teams.length} đội`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSavedSession}
                    className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#071226] text-xs font-black transition-colors cursor-pointer"
                  >
                    Tiếp tục phiên cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearE04Session();
                      setSavedSessionToResume(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-600 cursor-pointer"
                  >
                    Xóa phiên cũ
                  </button>
                </div>
              </div>
            )}

            {/* Main Setup Grid: Left Config + Right Live 3D Auditorium Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Game Mode, Posture, Participants, Rules */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Mode Selection */}
                <section className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 sm:p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      1. Chọn chế độ chơi
                    </h2>
                    <span className="px-2.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                      {E04_SAMPLE_BADGE} · Chơi ngay
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          mode: 'simon_says',
                        }))
                      }
                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        config.mode === 'simon_says'
                          ? 'bg-teal-500/15 border-teal-400 shadow-lg shadow-teal-950/50'
                          : 'bg-[#09162D] border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-base font-black text-white">“Simon bảo”</span>
                        <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-200 text-[10px] font-black">
                          2 làm quen + 8 lượt
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Chỉ <strong className="text-teal-200">Thực hiện</strong> khi câu lệnh bắt đầu bằng{' '}
                        <strong className="text-amber-300">“Simon bảo:”</strong>. Lệnh trực tiếp không có lời dẫn →{' '}
                        <strong className="text-slate-100">Giữ nguyên</strong>.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          mode: 'math_true_do',
                        }))
                      }
                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        config.mode === 'math_true_do'
                          ? 'bg-amber-500/15 border-amber-400 shadow-lg shadow-amber-950/40'
                          : 'bg-[#09162D] border-slate-700/80 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-base font-black text-white">“Đúng thì làm”</span>
                        <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[10px] font-black">
                          Toán THCS · 8 lượt
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Mệnh đề Toán <strong className="text-teal-200">ĐÚNG</strong> →{' '}
                        <strong className="text-teal-200">Thực hiện</strong> động tác yêu cầu. Mệnh đề{' '}
                        <strong className="text-amber-200">SAI</strong> →{' '}
                        <strong className="text-slate-100">Giữ nguyên</strong>.
                      </p>
                    </button>
                  </div>

                  {/* Mode-specific toggles */}
                  {config.mode === 'simon_says' ? (
                    <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#09162D] border border-slate-700/80 cursor-pointer">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Bật 2 lượt làm quen không tính điểm trước khi vào 8 lượt chính thức
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Lượt 1 có “Simon bảo:” (Thực hiện), lượt 2 không có “Simon bảo:” (Giữ nguyên). 8 lượt chính thức gồm 4 có – 4 không, trộn 1 lần khi bắt đầu.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.includeWarmupInSimonMode}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            includeWarmupInSimonMode: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-teal-400 shrink-0"
                      />
                    </label>
                  ) : (
                    <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#09162D] border border-slate-700/80 cursor-pointer">
                      <div>
                        <p className="text-xs font-bold text-white">
                          Trộn thứ tự 8 mệnh đề Toán THCS mẫu (4 Đúng · 4 Sai)
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Bộ câu mẫu tách biệt ngân hàng câu hỏi thật, hiển thị công thức chuẩn KaTeX.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={config.shuffleMathOrder}
                        onChange={(e) =>
                          setConfig((prev) => ({
                            ...prev,
                            shuffleMathOrder: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 accent-amber-400 shrink-0"
                      />
                    </label>
                  )}
                </section>

                {/* 2. Posture & Participant Mode */}
                <section className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 sm:p-5 space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-wider text-teal-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" />
                    2. Tư thế lớp học & hình thức tham gia
                  </h2>

                  {/* Posture */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-300">Tư thế nhân vật & lớp học</p>
                    <div className="grid grid-cols-2 gap-2.5">
                      {(
                        [
                          {
                            value: 'standing' as SimonPostureSetting,
                            title: 'Đứng tại chỗ',
                            desc: 'Phù hợp không gian rộng, khởi động giữa tiết.',
                          },
                          {
                            value: 'seated' as SimonPostureSetting,
                            title: 'Ngồi tại bàn',
                            desc: 'An toàn cho lớp đông 40–50 HS, không cần di chuyển.',
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setConfig((prev) => ({ ...prev, posture: opt.value }))}
                          className={`text-left px-3.5 py-2.5 rounded-xl border-2 transition-colors cursor-pointer ${
                            config.posture === opt.value
                              ? 'bg-teal-500/15 border-teal-400 text-white'
                              : 'bg-[#09162D] border-slate-700/80 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <p className="text-xs font-black">{opt.title}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Participant Mode */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-300">Hình thức tổ chức (1–50 học sinh)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          {
                            id: 'solo_practice' as SimonParticipantMode,
                            icon: User,
                            title: 'Tự luyện (1 HS)',
                            desc: 'Chọn ngay Thực hiện / Giữ nguyên trên màn hình, tự chấm +10đ.',
                          },
                          {
                            id: 'whole_class' as SimonParticipantMode,
                            icon: Users,
                            title: 'Cả lớp (không tính điểm)',
                            desc: '1–50 HS cùng tập trung, GV Ra hiệu & Công bố đáp án.',
                          },
                          {
                            id: 'teams' as SimonParticipantMode,
                            icon: Trophy,
                            title: 'Nhiều đội (2–6 đội)',
                            desc: 'Đội ghi bảng con / giơ thẻ, chấm +10đ, đồng điểm Đồng hạng.',
                          },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = config.participantMode === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setConfig((prev) => ({
                                ...prev,
                                participantMode: opt.id,
                              }))
                            }
                            className={`text-left p-3 rounded-xl border-2 transition-colors cursor-pointer ${
                              active
                                ? 'bg-amber-400/15 border-amber-400 text-white'
                                : 'bg-[#09162D] border-slate-700/80 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className="w-4 h-4 text-amber-300 shrink-0" />
                              <span className="text-xs font-black">{opt.title}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Teams customization */}
                  {config.participantMode === 'teams' && (
                    <div className="p-3.5 rounded-xl bg-[#09162D] border border-slate-700/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">Số lượng đội (2–6 đội)</span>
                        <div className="flex items-center gap-1.5">
                          {[2, 3, 4, 5, 6].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() =>
                                setConfig((prev) => ({
                                  ...prev,
                                  teams: createSimonTeams(
                                    n,
                                    prev.teams.map((t) => t.name)
                                  ),
                                }))
                              }
                              className={`w-8 h-8 rounded-lg text-xs font-black border transition-colors cursor-pointer ${
                                config.teams.length === n
                                  ? 'bg-teal-500 text-[#071226] border-teal-300'
                                  : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {config.teams.map((team, idx) => {
                          const pal = SIMON_TEAM_PALETTES[team.paletteIndex % SIMON_TEAM_PALETTES.length];
                          return (
                            <div
                              key={team.id}
                              className="flex items-center gap-2 bg-[#0D1E3B] px-2.5 py-1.5 rounded-lg border border-slate-700"
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: pal.hex }}
                              />
                              <input
                                type="text"
                                value={team.name}
                                maxLength={26}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setConfig((prev) => ({
                                    ...prev,
                                    teams: prev.teams.map((t, i) =>
                                      i === idx ? { ...t, name: val } : t
                                    ),
                                  }));
                                }}
                                placeholder={`Đội ${idx + 1}`}
                                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Optional Timer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                      <Clock className="w-4 h-4 text-teal-300" />
                      <span>Đồng hồ suy nghĩ mỗi lượt</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TIMER_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({ ...prev, timerSeconds: preset.value }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                            config.timerSeconds === preset.value
                              ? 'bg-teal-500 text-[#071226] border-teal-300'
                              : 'bg-[#09162D] text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Launch Bar */}
                <div className="rounded-2xl bg-[#0D1E3B] border border-amber-400/35 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      Không loại học sinh · Không dùng camera · Phím tắt: 1/E, 2/G, Enter, P
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Học sinh không tiện vận động có thể giơ thẻ “Thực hiện” / “Giữ nguyên” hoặc bấm nút ngay trên màn hình.
                    </p>
                    {!setupValidation.valid && (
                      <p className="text-xs font-bold text-rose-300">
                        {setupValidation.errors.join(' ')}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!setupValidation.valid}
                    onClick={handleStartSession}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black shadow-lg shadow-amber-950/40 transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      Bắt đầu ({setupValidation.warmupTurnCount > 0 ? `${setupValidation.warmupTurnCount} làm quen + ` : ''}
                      {setupValidation.scoredTurnCount} lượt)
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Live 3D Stage & 4 Short Gestures Preview */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Hand className="w-4 h-4 text-teal-300" />
                      Nhân vật hướng dẫn 3D ({config.posture === 'standing' ? 'Đứng tại chỗ' : 'Ngồi tại bàn'})
                    </h2>
                    <span className="text-[11px] font-bold text-teal-200">
                      Xem trước động tác
                    </span>
                  </div>

                  <div className="aspect-video w-full">
                    <SimonSays3DScene
                      activeGesture={setupPreviewGesture}
                      posture={config.posture}
                      isRevealed={setupPreviewGesture !== 'ready_wait'}
                      expectedDecision={setupPreviewGesture === 'ready_wait' ? 'hold' : 'execute'}
                      skipAnimationKey={skipAnimationKey}
                      reducedMotion={reducedMotion}
                      force2D={force2D}
                      compact
                    />
                  </div>

                  {/* 4 Short Gesture Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    {E04_GESTURES.map((g) => {
                      const active = setupPreviewGesture === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setSetupPreviewGesture(g.id as SimonActionGestureId)}
                          className={`px-3 py-2 rounded-xl text-left text-xs font-bold border transition-colors cursor-pointer ${
                            active
                              ? 'bg-teal-500/20 border-teal-400 text-teal-100'
                              : 'bg-[#09162D] border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {g.actionText}
                        </button>
                      );
                    })}
                  </div>

                  <div className="px-3.5 py-2.5 rounded-xl bg-[#09162D] border border-slate-700/80 space-y-1">
                    <p className="text-xs font-bold text-amber-200">
                      Hướng dẫn nhanh: {previewSpec.actionText}
                    </p>
                    <p className="text-[11px] text-slate-300">
                      {config.posture === 'standing'
                        ? previewSpec.standingGuide
                        : previewSpec.seatedGuide}
                    </p>
                    <p className="text-[11px] text-teal-300/90">{previewSpec.cardFallbackText}.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: SUMMARY SCREEN (When session is finished AND user has moved past last reveal)
  // ============================================================================
  const showSummaryScreen = session.status === 'finished' && subPhase !== 'revealed';

  if (showSummaryScreen) {
    const scoredHistory = session.history.filter((h) => !h.isWarmup);
    const warmupHistory = session.history.filter((h) => h.isWarmup);

    return (
      <div
        className={`w-full bg-[#071226] text-slate-100 flex flex-col overflow-hidden ${
          isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[680px]'
        }`}
      >
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="rounded-2xl bg-[#0D1E3B] border border-amber-400/40 p-6 text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs font-black">
                <Trophy className="w-4 h-4" />
                <span>HOÀN THÀNH PHIÊN CHƠI E04</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                {session.config.mode === 'simon_says'
                  ? 'Tổng kết phiên “Simon bảo”'
                  : `Tổng kết phiên “${E04_MATH_PACK_TITLE}”`}
              </h2>
              <p className="text-sm text-slate-300">
                Đã hoàn thành <strong>{scoredHistory.length}</strong> lượt chính thức
                {warmupHistory.length > 0 ? ` và ${warmupHistory.length} lượt làm quen (không tính điểm)` : ''} · Không loại học sinh.
              </p>
            </div>

            {session.config.participantMode === 'whole_class' ? (
              <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/30 p-6 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-teal-400 mx-auto" />
                <h3 className="text-lg font-black text-white">
                  Cả lớp đã hoàn thành trọn vẹn {session.history.length} lượt tương tác
                </h3>
                <p className="text-sm text-slate-300 max-w-xl mx-auto">
                  Chế độ <strong>Cả lớp (1–50 HS)</strong> được thiết kế không tính điểm để mọi học sinh cùng tập trung lắng nghe, phản xạ an toàn tại chỗ hoặc giơ thẻ lựa chọn.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/30 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-black text-white">Bảng xếp hạng phiên chơi</h3>
                  <span className="text-xs font-bold text-slate-300">
                    Đúng: +{E04_POINTS_CORRECT}đ · Sai / Không trả lời: 0đ · Đồng điểm: Đồng hạng
                  </span>
                </div>

                <div className="space-y-2">
                  {standings.map((row) => {
                    const pal = SIMON_TEAM_PALETTES[row.paletteIndex % SIMON_TEAM_PALETTES.length];
                    return (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#09162D] border border-slate-700/90"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-200 font-black text-sm flex items-center justify-center">
                            #{row.rank}
                          </span>
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: pal.hex }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-white">{row.name}</span>
                              {row.isTied && (
                                <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/50 text-amber-200 text-[10px] font-black">
                                  Đồng hạng
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">
                              Đúng {row.correctCount} · Sai {row.incorrectCount} · Không trả lời {row.noAnswerCount}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xl font-black text-teal-300">{row.points}</span>
                          <span className="text-xs font-bold text-slate-400 ml-1">điểm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold border border-slate-600 cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-teal-300" />
                <span>Xem lại các lượt & lời giải</span>
              </button>

              <button
                type="button"
                onClick={handleReplaySameConfig}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#071226] text-sm font-black cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại (trộn lượt mới)</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToSetup}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-bold cursor-pointer"
              >
                <span>Đổi chế độ / Thiết lập</span>
              </button>

              <button
                type="button"
                onClick={handleExitToLibrary}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-bold border border-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Về thư viện</span>
              </button>
            </div>
          </div>
        </div>

        {/* Review Modal */}
        {showReviewModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl bg-[#0D1E3B] border border-teal-400/40 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
                <h3 className="text-base font-black text-white">Xem lại toàn bộ các lượt & lời giải</h3>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {session.history.map((rec, idx) => (
                  <div
                    key={rec.turnId}
                    className="p-4 rounded-xl bg-[#09162D] border border-slate-700/90 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-teal-300">
                        {rec.isWarmup ? `Làm quen (${rec.code})` : `Lượt #${idx + 1} (${rec.code})`}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-black ${
                          rec.expectedDecision === 'execute'
                            ? 'bg-teal-500/20 text-teal-200 border border-teal-400/50'
                            : 'bg-amber-400/20 text-amber-200 border border-amber-400/50'
                        }`}
                      >
                        Đáp án: {rec.expectedDecision === 'execute' ? `Thực hiện (${rec.actionText})` : 'Giữ nguyên'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white overflow-x-auto">
                      {session.config.mode === 'math_true_do' ? (
                        <MathView content={rec.displayPrompt} />
                      ) : (
                        <span>{rec.displayPrompt}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-300 overflow-x-auto">
                      <MathView content={rec.explanation} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: ACTIVE GAMEPLAY SCREEN (16:9 Projector + Mobile Responsive)
  // ============================================================================
  const displayTurn =
    currentTurn ||
    (session.turns[session.turns.length - 1] ?? null);
  const expectedDecision = displayTurn ? getExpectedDecisionForTurn(displayTurn) : null;
  const activeRecord = displayTurn
    ? session.history.find((h) => h.turnId === displayTurn.id) || null
    : null;
  const isRevealed = subPhase === 'revealed';
  const isLastTurnCompleted = session.status === 'finished' && isRevealed;

  const turnHeaderLabel = displayTurn
    ? displayTurn.isWarmup
      ? `Làm quen ${warmupTurnOrdinal}/2 · Không tính điểm`
      : `Lượt ${scoredTurnOrdinal}/${scoredTurnsTotal}`
    : '';

  const ruleText =
    session.config.mode === 'simon_says'
      ? 'Luật chơi: Chỉ THỰC HIỆN khi câu lệnh bắt đầu bằng “Simon bảo:”. Không có “Simon bảo:” → GIỮ NGUYÊN.'
      : 'Luật chơi: Mệnh đề Toán ĐÚNG → THỰC HIỆN động tác yêu cầu. Mệnh đề SAI → GIỮ NGUYÊN.';

  return (
    <div
      className={`w-full bg-[#071226] text-slate-100 flex flex-col overflow-hidden relative ${
        isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[700px]'
      }`}
    >
      {renderTopBar()}

      {/* Session Controls & Rule Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-[#0D1E3B] border-b border-slate-700/70 shrink-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span
            className={`px-2.5 py-0.5 rounded text-xs font-black ${
              displayTurn?.isWarmup
                ? 'bg-sky-500/20 border border-sky-400/50 text-sky-200'
                : 'bg-amber-400/20 border border-amber-400/50 text-amber-200'
            }`}
          >
            {turnHeaderLabel}
          </span>
          <span className="text-xs font-semibold text-slate-200 truncate">
            {ruleText}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {session.config.timerSeconds > 0 && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border ${
                remainingSeconds === 0 && !isRevealed
                  ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                  : 'bg-[#09162D] border-teal-500/40 text-teal-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{remainingSeconds}s</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleTogglePause}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              isPaused
                ? 'bg-amber-400 text-[#071226] border-amber-300'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Tiếp tục (P)' : 'Tạm dừng (P)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSkipAnimationKey((k) => k + 1)}
            disabled={isPaused}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer"
            title="Bỏ qua hiệu ứng chuyển động nhân vật"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bỏ qua hoạt ảnh</span>
          </button>

          <button
            type="button"
            onClick={handleReturnToSetup}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-600 cursor-pointer"
          >
            Thiết lập
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastNotice && (
        <div className="mx-4 mt-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-100 text-xs font-bold flex items-center justify-between gap-2">
          <span>{toastNotice}</span>
          <button
            type="button"
            onClick={() => setToastNotice(null)}
            className="p-0.5 hover:bg-amber-500/20 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main 16:9 Stage + Control Workspace */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* LEFT COLUMN (7/12): 3D Auditorium Stage + Command/Math Board */}
          <div className="lg:col-span-7 flex flex-col gap-3.5">
            {/* Command / Math Proposition Board (STRICT ANTI-SPOILER: IDENTICAL FONT, COLOR, BORDER BEFORE REVEAL) */}
            {displayTurn && (
              <div className="rounded-2xl bg-[#0D1E3B] border-2 border-teal-400/40 p-4 sm:p-5 space-y-3 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs font-black">
                      {displayTurn.mode === 'simon_says' ? 'HIỆU LỆNH' : 'MỆNH ĐỀ TOÁN THCS'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-200 text-[11px] font-bold">
                      {displayTurn.sourceBadge}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => {
                        soundBankRef.current?.unlock();
                        speakCurrentCommand(displayTurn);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-teal-200 text-xs font-bold border border-slate-600 cursor-pointer"
                      title="Đọc lại nguyên văn lệnh bằng tiếng Việt"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Đọc lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowZoomModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer"
                      title="Phóng to hiệu lệnh / công thức cho cả lớp"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Phóng to</span>
                    </button>
                  </div>
                </div>

                {/* Main Command / Formula Display: 100% uniform typography & styling for both Simon & direct commands */}
                <div className="rounded-xl bg-[#09162D] border border-slate-700 px-4 py-5 text-center overflow-x-auto">
                  {displayTurn.mode === 'simon_says' ? (
                    <p className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-snug">
                      {buildSimonCommandDisplayText(displayTurn)}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-2xl sm:text-3xl font-black text-white leading-relaxed">
                        <MathView content={displayTurn.statementLatex || ''} />
                      </div>
                      <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg bg-teal-500/15 border border-teal-400/40 text-sm font-bold text-teal-100">
                        <span>Động tác nếu ĐÚNG:</span>
                        <span className="text-amber-300 font-black">{displayTurn.actionText}</span>
                        <span className="text-slate-400">·</span>
                        <span>Nếu SAI: Giữ nguyên</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reveal Result Banner (ONLY shown after reveal!) */}
                {isRevealed && expectedDecision && (
                  <div
                    className={`rounded-xl px-4 py-3 border-2 space-y-1.5 ${
                      expectedDecision === 'execute'
                        ? 'bg-teal-500/15 border-teal-400 text-teal-100'
                        : 'bg-amber-400/15 border-amber-400 text-amber-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm sm:text-base font-black">
                        Đáp án chính xác:{' '}
                        {expectedDecision === 'execute'
                          ? `THỰC HIỆN — ${displayTurn.actionText}`
                          : 'GIỮ NGUYÊN (không thực hiện)'}
                      </p>
                      {activeRecord?.resultMode === 'solo_auto' && (
                        <span
                          className={`px-2.5 py-0.5 rounded text-xs font-black ${
                            activeRecord.isCorrectByParticipant.solo_1
                              ? 'bg-teal-500 text-[#071226]'
                              : 'bg-rose-500 text-white'
                          }`}
                        >
                          {activeRecord.isCorrectByParticipant.solo_1
                            ? `+${E04_POINTS_CORRECT} điểm · Chính xác!`
                            : '0 điểm · Chưa chính xác'}
                        </span>
                      )}
                      {activeRecord?.resultMode === 'warmup' && (
                        <span className="px-2.5 py-0.5 rounded bg-sky-500/30 text-sky-100 text-xs font-black">
                          Lượt làm quen · Không tính điểm
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-100/95 overflow-x-auto">
                      <MathView content={displayTurn.explanation} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3D Auditorium Stage */}
            <div className="aspect-video w-full flex-1 min-h-[260px]">
              <SimonSays3DScene
                activeGesture={activeInstructorPose}
                posture={session.config.posture}
                isRevealed={isRevealed}
                expectedDecision={isRevealed ? expectedDecision : null}
                skipAnimationKey={skipAnimationKey}
                reducedMotion={reducedMotion}
                force2D={force2D}
              />
            </div>
          </div>

          {/* RIGHT COLUMN (5/12): Controls, Large Action Buttons, Teams Grading & Standings */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* Control Panel */}
            <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 space-y-4">
              {/* SOLO PRACTICE CONTROLS */}
              {session.config.participantMode === 'solo_practice' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">Chọn phản ứng của bạn</h3>
                    <span className="text-[11px] font-bold text-slate-400">
                      Phím tắt: 1/E · 2/G
                    </span>
                  </div>

                  {!isRevealed ? (
                    <>
                      <p className="text-xs text-slate-300">
                        Bạn có thể chọn ngay <strong>Thực hiện</strong> hoặc <strong>Giữ nguyên</strong> ngay khi hiệu lệnh hiển thị.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={() => handleSoloSelectDecision('execute')}
                          className="py-5 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-[#071226] font-black text-base sm:text-lg shadow-lg transition-transform active:scale-[0.98] cursor-pointer flex flex-col items-center gap-1"
                        >
                          <Hand className="w-6 h-6" />
                          <span>Thực hiện</span>
                          <span className="text-[11px] font-bold opacity-80">Phím 1 / E</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={() => handleSoloSelectDecision('hold')}
                          className="py-5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] font-black text-base sm:text-lg shadow-lg transition-transform active:scale-[0.98] cursor-pointer flex flex-col items-center gap-1"
                        >
                          <ShieldCheck className="w-6 h-6" />
                          <span>Giữ nguyên</span>
                          <span className="text-[11px] font-bold opacity-80">Phím 2 / G</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={handleTriggerSignal}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-teal-200 text-xs font-bold border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Phát tín hiệu & đọc lệnh (tùy chọn)</span>
                      </button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="px-3.5 py-2.5 rounded-xl bg-[#09162D] border border-slate-700 text-xs text-slate-200 flex items-center justify-between">
                        <span>Bạn đã chọn:</span>
                        <strong className="text-white">
                          {soloChoice ? DECISION_LABELS[soloChoice] : 'Chưa chọn'}
                        </strong>
                      </div>

                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={() => {
                          if (isLastTurnCompleted) {
                            setSubPhase('thinking');
                          } else {
                            handleNextTurn();
                          }
                        }}
                        className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer"
                      >
                        {isLastTurnCompleted ? 'Xem tổng kết phiên (Enter)' : 'Lượt tiếp theo (Enter)'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* WHOLE CLASS CONTROLS (1–50 HS, non-scored) */}
              {session.config.participantMode === 'whole_class' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">Điều khiển cả lớp (1–50 HS)</h3>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">
                      Không tính điểm
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Học sinh thực hiện tại chỗ hoặc giơ thẻ <strong>Thực hiện / Giữ nguyên</strong>. Nhân vật 3D luôn giữ tư thế chờ cho tới khi GV bấm <strong>Công bố đáp án</strong>.
                  </p>

                  {!isRevealed ? (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={handleTriggerSignal}
                        className="w-full py-4 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-[#071226] text-base font-black shadow-lg cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Bell className="w-5 h-5" />
                        <span>
                          {subPhase === 'thinking' ? 'Ra hiệu (Phát tín hiệu & đọc lệnh)' : 'Phát lại tín hiệu Ra hiệu'}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={isPaused}
                        onClick={handleRevealNonScored}
                        className="w-full py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Công bố đáp án</span>
                      </button>

                      {/* Accessible visual legend of the two decisions */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="px-3 py-2 rounded-xl bg-[#09162D] border border-teal-500/30 text-center">
                          <p className="text-xs font-black text-teal-200">Thực hiện</p>
                          <p className="text-[11px] text-slate-400">Làm động tác / Giơ thẻ</p>
                        </div>
                        <div className="px-3 py-2 rounded-xl bg-[#09162D] border border-amber-400/30 text-center">
                          <p className="text-xs font-black text-amber-200">Giữ nguyên</p>
                          <p className="text-[11px] text-slate-400">Đứng/ngồi yên tại chỗ</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => {
                        if (isLastTurnCompleted) {
                          setSubPhase('thinking');
                        } else {
                          handleNextTurn();
                        }
                      }}
                      className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer"
                    >
                      {isLastTurnCompleted ? 'Xem tổng kết phiên (Enter)' : 'Lượt tiếp theo (Enter)'}
                    </button>
                  )}
                </div>
              )}

              {/* TEAMS CONTROLS (2–6 teams, scored) */}
              {session.config.participantMode === 'teams' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black text-white">
                      {displayTurn?.isWarmup
                        ? 'Lượt làm quen (không tính điểm)'
                        : `Ghi nhận ${session.config.teams.length} đội`}
                    </h3>
                    {!displayTurn?.isWarmup && !isRevealed && (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-black ${
                          unrecordedTeamsCount === 0
                            ? 'bg-teal-500/20 text-teal-200'
                            : 'bg-amber-400/20 text-amber-200'
                        }`}
                      >
                        Đã ghi nhận {session.config.teams.length - unrecordedTeamsCount}/{session.config.teams.length}
                      </span>
                    )}
                  </div>

                  {!isRevealed ? (
                    displayTurn?.isWarmup ? (
                      <div className="space-y-2.5">
                        <p className="text-xs text-slate-300">
                          Lượt làm quen giúp các đội hiểu rõ luật trước khi bắt đầu tính điểm.
                        </p>
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleTriggerSignal}
                          className="w-full py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Bell className="w-4 h-4" />
                          <span>Ra hiệu làm quen</span>
                        </button>
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleRevealNonScored}
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer"
                        >
                          Công bố đáp án làm quen
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleTriggerSignal}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-[#071226] text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Bell className="w-4 h-4" />
                            <span>
                              {subPhase === 'thinking'
                                ? 'Ra hiệu (Các đội ghi bảng con / giơ thẻ)'
                                : 'Phát lại tín hiệu Ra hiệu'}
                            </span>
                          </button>
                        </div>

                        {/* Team Rows — strictly distinguishes "Chưa ghi nhận" from "Giữ nguyên" */}
                        <div className="space-y-2 max-h-[290px] overflow-y-auto pr-0.5">
                          {session.config.teams.map((team) => {
                            const pal =
                              SIMON_TEAM_PALETTES[team.paletteIndex % SIMON_TEAM_PALETTES.length];
                            const choice = teamChoices[team.id] || 'unrecorded';
                            return (
                              <div
                                key={team.id}
                                className="p-2.5 rounded-xl bg-[#09162D] border border-slate-700/90 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: pal.hex }}
                                    />
                                    <span className="text-xs font-black text-white truncate">
                                      {team.name}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      choice === 'unrecorded'
                                        ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                                        : 'bg-teal-500/20 text-teal-200'
                                    }`}
                                  >
                                    {DECISION_LABELS[choice]}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-1.5">
                                  {(
                                    [
                                      { val: 'execute' as const, label: 'Thực hiện' },
                                      { val: 'hold' as const, label: 'Giữ nguyên' },
                                      { val: 'no_answer' as const, label: 'Không trả lời' },
                                    ] as const
                                  ).map((btn) => {
                                    const active = choice === btn.val;
                                    return (
                                      <button
                                        key={btn.val}
                                        type="button"
                                        disabled={isPaused}
                                        onClick={() => handleSetTeamChoice(team.id, btn.val)}
                                        className={`py-2 px-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                                          active
                                            ? btn.val === 'execute'
                                              ? 'bg-teal-500 text-[#071226] border-teal-300'
                                              : btn.val === 'hold'
                                              ? 'bg-amber-400 text-[#071226] border-amber-300'
                                              : 'bg-slate-600 text-white border-slate-400'
                                            : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:border-slate-500'
                                        }`}
                                      >
                                        {btn.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {unrecordedTeamsCount > 0 && (
                          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/35 text-[11px] text-amber-200 space-y-1.5">
                            <p className="font-bold">
                              Còn {unrecordedTeamsCount} đội ở trạng thái “Chưa ghi nhận” — hệ thống không tự coi là “Giữ nguyên”.
                            </p>
                            <button
                              type="button"
                              disabled={isPaused}
                              onClick={() => handleMarkRemainingTeams('no_answer')}
                              className="underline font-black text-amber-100 hover:text-white cursor-pointer"
                            >
                              Đánh dấu nhanh các đội còn lại là “Không trả lời”
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={isPaused || unrecordedTeamsCount > 0}
                          onClick={handleConfirmTeamsTurn}
                          className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed text-[#071226] text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Xác nhận & Công bố đáp án</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      {activeRecord && !activeRecord.isWarmup && (
                        <div className="space-y-1.5">
                          {session.config.teams.map((team) => {
                            const choice = activeRecord.choiceByParticipant[team.id] || 'no_answer';
                            const isRight = Boolean(activeRecord.isCorrectByParticipant[team.id]);
                            const delta = activeRecord.pointsDeltaByParticipant[team.id] || 0;
                            return (
                              <div
                                key={team.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#09162D] border border-slate-700 text-xs"
                              >
                                <span className="font-bold text-white truncate">{team.name}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-slate-300">{DECISION_LABELS[choice]}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded font-black ${
                                      isRight
                                        ? 'bg-teal-500/20 text-teal-200'
                                        : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    +{delta}đ
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {activeRecord && !activeRecord.isWarmup && (
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleOpenEditLastTurn}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 text-xs font-bold border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa lượt vừa chấm</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={() => {
                            if (isLastTurnCompleted) {
                              setSubPhase('thinking');
                            } else {
                              handleNextTurn();
                            }
                          }}
                          className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#071226] text-sm font-black cursor-pointer"
                        >
                          {isLastTurnCompleted ? 'Xem tổng kết (Enter)' : 'Lượt tiếp theo (Enter)'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Standings Card (for Solo Practice & Teams) */}
            {session.config.participantMode !== 'whole_class' && (
              <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Bảng điểm hiện tại
                  </h3>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    Đúng +{E04_POINTS_CORRECT}đ · Không loại HS
                  </span>
                </div>

                <div className="space-y-1.5">
                  {standings.map((row) => {
                    const pal = SIMON_TEAM_PALETTES[row.paletteIndex % SIMON_TEAM_PALETTES.length];
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#09162D] border border-slate-700/80"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-black text-amber-300 w-5">#{row.rank}</span>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: pal.hex }}
                          />
                          <span className="text-xs font-bold text-white truncate">{row.name}</span>
                          {row.isTied && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-200 text-[10px] font-black">
                              Đồng hạng
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-black text-teal-300 shrink-0">
                          {row.points}đ
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Progress Card for Whole Class */}
            {session.config.participantMode === 'whole_class' && (
              <div className="rounded-2xl bg-[#0D1E3B] border border-teal-500/25 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span className="flex items-center gap-1.5 text-teal-300 font-black">
                    <HelpCircle className="w-4 h-4" />
                    Tiến độ cả lớp
                  </span>
                  <span>
                    {session.history.length} / {session.turns.length} lượt đã hoàn thành
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#09162D] overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-teal-400 to-amber-400 transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (session.history.length / Math.max(1, session.turns.length)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pause Overlay (Locks all actions while retaining remaining timer) */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-[#071226]/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#0D1E3B] border-2 border-amber-400/60 p-6 text-center space-y-4 shadow-2xl">
            <Pause className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Phiên chơi đang tạm dừng</h3>
              <p className="text-xs text-slate-300">
                Mọi thao tác chấm lượt đã được khóa tạm thời và âm thanh đã dừng.
                {session.config.timerSeconds > 0
                  ? ` Thời gian còn lại được giữ nguyên: ${remainingSeconds} giây.`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={handleTogglePause}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#071226] text-sm font-black cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Tiếp tục phiên chơi (P)</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Last Turn Modal */}
      {isEditingLastTurn && lastCommittedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0D1E3B] border border-amber-400/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                Sửa lượt vừa chấm ({lastCommittedRecord.code})
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingLastTurn(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {session.config.teams.map((team) => {
                const choice = editDraftChoices[team.id] || 'unrecorded';
                return (
                  <div
                    key={team.id}
                    className="p-3 rounded-xl bg-[#09162D] border border-slate-700 space-y-2"
                  >
                    <p className="text-xs font-black text-white">{team.name}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { val: 'execute' as const, label: 'Thực hiện' },
                          { val: 'hold' as const, label: 'Giữ nguyên' },
                          { val: 'no_answer' as const, label: 'Không trả lời' },
                        ] as const
                      ).map((btn) => (
                        <button
                          key={btn.val}
                          type="button"
                          onClick={() =>
                            setEditDraftChoices((prev) => ({
                              ...prev,
                              [team.id]: btn.val,
                            }))
                          }
                          className={`py-2 rounded-lg text-xs font-black border cursor-pointer ${
                            choice === btn.val
                              ? 'bg-teal-500 text-[#071226] border-teal-300'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
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

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingLastTurn(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditedLastTurn}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#071226] text-xs font-black cursor-pointer"
              >
                Lưu & tính lại điểm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Command / Formula Modal */}
      {showZoomModal && displayTurn && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setShowZoomModal(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-[#0D1E3B] border-2 border-teal-400/60 p-6 sm:p-10 text-center space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-teal-300">
                {displayTurn.mode === 'simon_says' ? 'Hiệu lệnh phóng to' : 'Mệnh đề Toán THCS phóng to'}
              </span>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 overflow-x-auto">
              {displayTurn.mode === 'simon_says' ? (
                <p className="text-3xl sm:text-5xl font-black text-white leading-tight">
                  {buildSimonCommandDisplayText(displayTurn)}
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="text-3xl sm:text-5xl font-black text-white leading-snug">
                    <MathView content={displayTurn.statementLatex || ''} />
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-amber-300">
                    Nếu ĐÚNG → {displayTurn.actionText} · Nếu SAI → Giữ nguyên
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimonSays3DGame;
