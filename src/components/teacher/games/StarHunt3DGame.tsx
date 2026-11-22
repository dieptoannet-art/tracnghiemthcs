/**
 * E05 — SĂN SAO KIẾN THỨC 3D (Tây Đô Smart EDU | Premium EdTech 2027)
 * - 3D Constellation Star Map (3 clusters, default 9 stars) + full-featured 2D 3-cluster fallback
 * - Exact 9-question sample pack "Săn sao kiến thức – Toán THCS" ("Dữ liệu mẫu") + Smart EDU RBAC question bank
 * - 3 Participant Modes: Tự luyện (1 HS), Cả lớp hợp tác (1–50 HS), Thi đua 2–6 đội (rotating star pick,
 *   all teams answer simultaneously, +1 star per correct team, map star lights ONCE if >= 1 team is right,
 *   equal stars => Đồng hạng, strictly distinguishes "Chưa ghi nhận" from "Không trả lời")
 * - Compact map bar when projecting questions, KaTeX MathView with mobile scroll & Zoom modal,
 *   timer starts only after formula mount & allows teacher entry after timeout, Pause, Skip animation,
 *   Edit-last-turn recomputing team stars + map + constellations, separate "Ôn lại câu chưa đúng" practice
 * - Unified A01/A02 audio + strict vi-VN voice, /demo-isolated persistence
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  FastForward,
  Layers,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
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
  E05_SAMPLE_BADGE,
  E05_SAMPLE_PACK_TITLE,
  STAR_OPTION_LETTERS,
  STAR_TEAM_PALETTES,
  StarHuntConfig,
  StarHuntParticipantMode,
  StarHuntState,
  StarNode,
  StarOptionLetter,
  StarTeamChoice,
  buildE05QuestionPool,
  clearE05Session,
  commitStarTurn,
  computeClusterProgress,
  computeMapLitStarCount,
  computeStarStandings,
  createDefaultStarHuntConfig,
  createInitialStarHuntState,
  createStarTeams,
  editLastStarTurn,
  getCorrectOptionLabelForStarQuestion,
  getCurrentPickingTeam,
  getMissedStarsForReview,
  getStarNodeStatus,
  loadE05Session,
  openStarOnMap,
  recordStarReviewAttempt,
  returnToStarMap,
  saveE05Session,
  validateStarSetupConfig,
} from './starHunt3dEngine';
import { StarHunt3DScene } from './StarHunt3DScene';

export interface StarHunt3DGameProps {
  bankQuestions?: Question[];
  userRole?: UserRole;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onBackToLibrary: () => void;
}

const TIMER_PRESETS = [
  { label: 'Không giới hạn', value: 0 },
  { label: '20 giây', value: 20 },
  { label: '30 giây', value: 30 },
  { label: '45 giây', value: 45 },
];

const SUBJECT_LABELS: Record<string, string> = {
  all: 'Tất cả môn',
  math: 'Toán học',
  physics: 'Vật lí',
  chemistry: 'Hóa học',
  biology: 'Sinh học',
  literature: 'Ngữ văn',
  english: 'Tiếng Anh',
  history: 'Lịch sử',
  geography: 'Địa lí',
  informatics: 'Tin học',
};

function buildUnrecordedTeams(config: StarHuntConfig): Record<string, StarTeamChoice> {
  const m: Record<string, StarTeamChoice> = {};
  config.teams.forEach((t) => {
    m[t.id] = 'unrecorded';
  });
  return m;
}

export const StarHunt3DGame: React.FC<StarHunt3DGameProps> = ({
  bankQuestions = [],
  userRole,
  isFullscreen = false,
  onToggleFullscreen,
  onBackToLibrary,
}) => {
  // Audio & Vietnamese Voice controllers (consistent with A01/A02)
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
  const [config, setConfig] = useState<StarHuntConfig>(() =>
    createDefaultStarHuntConfig('solo_practice')
  );
  const [session, setSession] = useState<StarHuntState | null>(null);
  const [savedSessionToResume, setSavedSessionToResume] = useState<StarHuntState | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  // Active star question state
  const [singleChoice, setSingleChoice] = useState<StarOptionLetter | 'no_answer' | null>(null);
  const [teamChoices, setTeamChoices] = useState<Record<string, StarTeamChoice>>({});
  const [questionDisplayReady, setQuestionDisplayReady] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [skipAnimationKey, setSkipAnimationKey] = useState<number>(0);

  // Modals & Drawers
  const [inspectedStarId, setInspectedStarId] = useState<string | null>(null);
  const [isEditingLastTurn, setIsEditingLastTurn] = useState<boolean>(false);
  const [editSingleDraft, setEditSingleDraft] = useState<StarOptionLetter | 'no_answer'>('no_answer');
  const [editTeamsDraft, setEditTeamsDraft] = useState<Record<string, StarTeamChoice>>({});
  const [showZoomModal, setShowZoomModal] = useState<boolean>(false);
  const [showReviewPracticeModal, setShowReviewPracticeModal] = useState<boolean>(false);
  const [reviewPracticeIndex, setReviewPracticeIndex] = useState<number>(0);
  const [reviewSelectedLetter, setReviewSelectedLetter] = useState<StarOptionLetter | null>(null);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Refs for anti-double-click, turn token, and delayed audio cancellation
  const actionLockUntilRef = useRef<number>(0);
  const turnTokenRef = useRef<string>('e05_init');
  const pendingTimersRef = useRef<number[]>([]);
  const isDemo = isKhktDemoRuntime();

  const clearPendingAudioTimers = useCallback(() => {
    pendingTimersRef.current.forEach((id) => window.clearTimeout(id));
    pendingTimersRef.current = [];
  }, []);

  const scheduleAudioTimer = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);

  const stopAllAudio = useCallback(() => {
    clearPendingAudioTimers();
    soundBankRef.current?.stopAll();
    voiceCtrlRef.current?.stop();
    stopAllGlobalEduSpeech();
  }, [clearPendingAudioTimers]);

  // Mount/unmount lifecycle
  useEffect(() => {
    const loaded = loadE05Session();
    if (loaded.state) {
      setSavedSessionToResume(loaded.state);
    } else if (loaded.recoveredFromCorruption) {
      setStorageNotice('Phiên lưu E05 trước đó bị lỗi định dạng và đã được đặt lại an toàn.');
    }

    const unsub = voiceCtrlRef.current?.subscribe((snap) => setVoiceSnapshot(snap));

    return () => {
      unsub?.();
      stopAllAudio();
      soundBankRef.current?.dispose();
      voiceCtrlRef.current?.dispose();
    };
  }, [stopAllAudio]);

  // Persist active session automatically
  useEffect(() => {
    if (session) {
      saveE05Session(session);
    }
  }, [session]);

  const showToast = useCallback((msg: string) => setToastNotice(msg), []);

  useEffect(() => {
    if (!toastNotice) return;
    const id = window.setTimeout(() => setToastNotice(null), 3400);
    return () => window.clearTimeout(id);
  }, [toastNotice]);

  // Available bank subjects & question pool for setup
  const availableBankSubjects = useMemo(() => {
    const set = new Set<string>();
    bankQuestions.forEach((q) => {
      if (q.subject) set.add(q.subject);
    });
    return ['all', ...Array.from(set)];
  }, [bankQuestions]);

  const setupPool = useMemo(
    () =>
      buildE05QuestionPool({
        sourceKind: config.sourceKind,
        bankQuestions,
        userRole,
        subjectFilter: config.subjectFilter,
        gradeFilter: config.gradeFilter,
        levelFilter: config.levelFilter,
      }),
    [config.sourceKind, bankQuestions, userRole, config.subjectFilter, config.gradeFilter, config.levelFilter]
  );

  const setupValidation = useMemo(
    () => validateStarSetupConfig(config, setupPool.length),
    [config, setupPool.length]
  );

  // Derived active session data
  const activeStar: StarNode | null = useMemo(() => {
    if (!session || !session.activeStarId) return null;
    return session.stars.find((s) => s.id === session.activeStarId) || null;
  }, [session]);

  const activeStarRecord = useMemo(() => {
    if (!session || !activeStar) return null;
    return session.history.find((h) => h.starId === activeStar.id) || null;
  }, [session, activeStar]);

  const isActiveStarRevealed = Boolean(activeStarRecord);

  const lastCommittedRecord = useMemo(() => {
    if (!session || session.history.length === 0) return null;
    return session.history[session.history.length - 1];
  }, [session]);

  const pickingTeam = useMemo(() => {
    if (!session) return null;
    return getCurrentPickingTeam(session);
  }, [session]);

  const standings = useMemo(() => (session ? computeStarStandings(session) : []), [session]);
  const clusterProgress = useMemo(() => (session ? computeClusterProgress(session) : []), [session]);
  const mapLitCount = useMemo(() => (session ? computeMapLitStarCount(session) : 0), [session]);
  const completedClustersCount = useMemo(
    () => clusterProgress.filter((c) => c.isComplete).length,
    [clusterProgress]
  );
  const missedStars = useMemo(() => (session ? getMissedStarsForReview(session) : []), [session]);

  const unrecordedTeamsCount = useMemo(() => {
    if (!session || session.config.participantMode !== 'teams') return 0;
    return session.config.teams.filter(
      (t) => !teamChoices[t.id] || teamChoices[t.id] === 'unrecorded'
    ).length;
  }, [session, teamChoices]);

  const inspectedStar = useMemo(() => {
    if (!session || !inspectedStarId) return null;
    return session.stars.find((s) => s.id === inspectedStarId) || null;
  }, [session, inspectedStarId]);

  const inspectedStarRecord = useMemo(() => {
    if (!session || !inspectedStarId) return null;
    return session.history.find((h) => h.starId === inspectedStarId) || null;
  }, [session, inspectedStarId]);

  // Action lock helper against double-clicking
  const acquireActionLock = useCallback((ms = 180): boolean => {
    const now = Date.now();
    if (now < actionLockUntilRef.current) return false;
    actionLockUntilRef.current = now + ms;
    return true;
  }, []);

  const beginAudioTurn = useCallback((): string => {
    stopAllAudio();
    const token = `e05_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    soundBankRef.current?.setActiveTurnToken(token);
    turnTokenRef.current = token;
    return token;
  }, [stopAllAudio]);

  // Mark question formulas ready ONLY after React commits & browser paints the MathView DOM
  useEffect(() => {
    if (!activeStar || isActiveStarRevealed) {
      setQuestionDisplayReady(false);
      return;
    }
    setQuestionDisplayReady(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setQuestionDisplayReady(true);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [activeStar?.id, isActiveStarRevealed]);

  // Countdown timer: starts ONLY when `questionDisplayReady` is true, pauses cleanly, never locks teacher grading after timeout
  useEffect(() => {
    if (
      !session ||
      !activeStar ||
      isActiveStarRevealed ||
      !questionDisplayReady ||
      isPaused ||
      session.config.timerSeconds <= 0
    ) {
      return;
    }
    if (remainingSeconds <= 0) return;

    const id = window.setInterval(() => {
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

    return () => window.clearInterval(id);
  }, [
    session,
    activeStar,
    isActiveStarRevealed,
    questionDisplayReady,
    isPaused,
    remainingSeconds,
    isMuted,
  ]);

  // Top-bar toggles
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      saveEduGameMuted(next);
      if (next) stopAllAudio();
      else soundBankRef.current?.unlock();
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
    if (!session || !activeStar || isActiveStarRevealed) return;
    setIsPaused((prev) => {
      const next = !prev;
      if (next) stopAllAudio();
      return next;
    });
  }, [session, activeStar, isActiveStarRevealed, stopAllAudio]);

  // Start new session
  const handleStartSession = useCallback(() => {
    if (!setupValidation.valid || !acquireActionLock(220)) return;
    soundBankRef.current?.unlock();
    beginAudioTurn();
    const initial = createInitialStarHuntState({
      config: {
        ...config,
        starCount: setupValidation.effectiveStarCount,
      },
      pool: setupPool,
    });
    setSession(initial);
    setSavedSessionToResume(null);
    setSingleChoice(null);
    setTeamChoices(buildUnrecordedTeams(initial.config));
    setIsPaused(false);
    setInspectedStarId(null);
    setIsEditingLastTurn(false);
    setShowReviewPracticeModal(false);
  }, [setupValidation, acquireActionLock, beginAudioTurn, config, setupPool]);

  // Resume saved session cleanly
  const handleResumeSavedSession = useCallback(() => {
    if (!savedSessionToResume || !acquireActionLock(220)) return;
    soundBankRef.current?.unlock();
    beginAudioTurn();
    setConfig(savedSessionToResume.config);
    setSession(savedSessionToResume);
    setSavedSessionToResume(null);
    setSingleChoice(null);
    setTeamChoices(buildUnrecordedTeams(savedSessionToResume.config));
    setRemainingSeconds(savedSessionToResume.config.timerSeconds);
    setIsPaused(false);
    setInspectedStarId(null);
    setIsEditingLastTurn(false);
  }, [savedSessionToResume, acquireActionLock, beginAudioTurn]);

  // Replay with same configuration
  const handleReplaySameConfig = useCallback(() => {
    if (!session || !acquireActionLock(220)) return;
    soundBankRef.current?.unlock();
    beginAudioTurn();
    const pool = buildE05QuestionPool({
      sourceKind: session.config.sourceKind,
      bankQuestions,
      userRole,
      subjectFilter: session.config.subjectFilter,
      gradeFilter: session.config.gradeFilter,
      levelFilter: session.config.levelFilter,
    });
    const fresh = createInitialStarHuntState({
      config: session.config,
      pool: pool.length > 0 ? pool : buildE05QuestionPool({ sourceKind: 'sample' }),
    });
    setSession(fresh);
    setSingleChoice(null);
    setTeamChoices(buildUnrecordedTeams(fresh.config));
    setIsPaused(false);
    setInspectedStarId(null);
    setIsEditingLastTurn(false);
    setShowReviewPracticeModal(false);
  }, [session, acquireActionLock, beginAudioTurn, bankQuestions, userRole]);

  const handleReturnToSetup = useCallback(() => {
    stopAllAudio();
    setSession(null);
    setInspectedStarId(null);
    setShowZoomModal(false);
    setShowReviewPracticeModal(false);
    setIsEditingLastTurn(false);
    setIsPaused(false);
    const loaded = loadE05Session();
    setSavedSessionToResume(loaded.state);
  }, [stopAllAudio]);

  const handleExitToLibrary = useCallback(() => {
    stopAllAudio();
    onBackToLibrary();
  }, [stopAllAudio, onBackToLibrary]);

  // Open an unopened star on the map
  const handleSelectStar = useCallback(
    (starId: string) => {
      if (!session || isPaused || !acquireActionLock(180)) return;
      const res = openStarOnMap(session, starId);
      if (!res.opened) {
        if (res.reason === 'star_already_active') {
          showToast('Đang mở một ngôi sao khác — hãy hoàn tất câu hiện tại trước.');
        }
        return;
      }

      soundBankRef.current?.unlock();
      const token = beginAudioTurn();
      soundBankRef.current?.playStarSelectCue(isMuted, token);

      const star = res.state.stars.find((s) => s.id === starId);
      if (star && voiceEnabled && !isMuted) {
        voiceCtrlRef.current?.replayText({
          text: `Sao số ${star.starNumber}, chủ đề ${star.topicLabel}.`,
          isMuted,
          voiceEnabled,
        });
      }

      setSession(res.state);
      setSingleChoice(null);
      setTeamChoices(buildUnrecordedTeams(res.state.config));
      setRemainingSeconds(res.state.config.timerSeconds);
      setIsPaused(false);
      setIsEditingLastTurn(false);
      setInspectedStarId(null);
    },
    [session, isPaused, acquireActionLock, beginAudioTurn, isMuted, voiceEnabled, showToast]
  );

  // Confirm Solo / Whole-Class answer
  const handleCommitSingleChoice = useCallback(() => {
    if (!session || !activeStar || isActiveStarRevealed || isPaused) return;
    if (!singleChoice) {
      showToast('Hãy chọn một phương án A, B, C, D hoặc “Không trả lời” trước khi chốt.');
      return;
    }
    if (!acquireActionLock(200)) return;

    soundBankRef.current?.unlock();
    voiceCtrlRef.current?.stop();
    const token = turnTokenRef.current;

    const res = commitStarTurn(session, {
      starId: activeStar.id,
      singleChoice,
    });
    if (!res.committed || !res.record) return;

    setSession(res.state);

    if (res.record.mapStarLit) {
      soundBankRef.current?.playStarLitCue(isMuted, token);
      if (res.newlyCompletedClusterId) {
        scheduleAudioTimer(() => {
          soundBankRef.current?.playConstellationCompleteCue(isMuted, token);
        }, 420);
      }
    } else {
      soundBankRef.current?.playStarMissCue(isMuted, token);
    }
  }, [
    session,
    activeStar,
    isActiveStarRevealed,
    isPaused,
    singleChoice,
    acquireActionLock,
    showToast,
    isMuted,
    scheduleAudioTimer,
  ]);

  // Confirm Teams answer (strictly blocks any unrecorded team)
  const handleCommitTeamsChoice = useCallback(() => {
    if (!session || !activeStar || isActiveStarRevealed || isPaused) return;
    if (unrecordedTeamsCount > 0) {
      showToast(
        `Còn ${unrecordedTeamsCount} đội ở trạng thái “Chưa ghi nhận”. Vui lòng ghi nhận đủ trước khi xác nhận.`
      );
      return;
    }
    if (!acquireActionLock(200)) return;

    soundBankRef.current?.unlock();
    voiceCtrlRef.current?.stop();
    const token = turnTokenRef.current;

    const res = commitStarTurn(session, {
      starId: activeStar.id,
      teamChoices,
    });
    if (!res.committed || !res.record) {
      if (res.reason === 'unrecorded_team') {
        showToast('Cần ghi nhận đủ tất cả các đội trước khi xác nhận.');
      }
      return;
    }

    setSession(res.state);

    // Unified single cue even if multiple teams answered right
    if (res.record.mapStarLit) {
      soundBankRef.current?.playStarLitCue(isMuted, token);
      if (res.newlyCompletedClusterId) {
        scheduleAudioTimer(() => {
          soundBankRef.current?.playConstellationCompleteCue(isMuted, token);
        }, 420);
      }
    } else {
      soundBankRef.current?.playStarMissCue(isMuted, token);
    }
  }, [
    session,
    activeStar,
    isActiveStarRevealed,
    isPaused,
    unrecordedTeamsCount,
    acquireActionLock,
    showToast,
    teamChoices,
    isMuted,
    scheduleAudioTimer,
  ]);

  // Return to star map (or transition to summary after last star)
  const handleBackToMap = useCallback(() => {
    if (!session || !isActiveStarRevealed || isPaused) return;
    if (!acquireActionLock(180)) return;

    const token = beginAudioTurn();
    const next = returnToStarMap(session);
    setSession(next);
    setSingleChoice(null);
    setTeamChoices(buildUnrecordedTeams(next.config));
    setIsEditingLastTurn(false);
    setShowZoomModal(false);

    if (next.status === 'finished') {
      soundBankRef.current?.playStarSessionSummary(isMuted, token);
    }
  }, [session, isActiveStarRevealed, isPaused, acquireActionLock, beginAudioTurn, isMuted]);

  // Open edit-last-turn modal before moving on
  const handleOpenEditLastTurn = useCallback(() => {
    if (!session || !lastCommittedRecord || isPaused) return;
    if (session.config.participantMode === 'teams') {
      const draft: Record<string, StarTeamChoice> = {};
      session.config.teams.forEach((t) => {
        draft[t.id] = lastCommittedRecord.chosenLabelByParticipant[t.id] || 'unrecorded';
      });
      setEditTeamsDraft(draft);
    } else {
      setEditSingleDraft(lastCommittedRecord.chosenLabelByParticipant.solo_1 || 'no_answer');
    }
    setIsEditingLastTurn(true);
  }, [session, lastCommittedRecord, isPaused]);

  const handleSaveEditedLastTurn = useCallback(() => {
    if (!session || !acquireActionLock(180)) return;
    const res = editLastStarTurn(
      session,
      session.config.participantMode === 'teams'
        ? { teamChoices: editTeamsDraft }
        : { singleChoice: editSingleDraft }
    );
    if (!res.edited) {
      showToast('Vui lòng chọn rõ kết quả cho tất cả các đội trước khi lưu.');
      return;
    }
    setSession(res.state);
    setIsEditingLastTurn(false);
    showToast('Đã tính lại sao cá nhân, bản đồ sao và chòm sao từ lịch sử.');
  }, [session, acquireActionLock, editTeamsDraft, editSingleDraft, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        if (showZoomModal) return setShowZoomModal(false);
        if (inspectedStarId) return setInspectedStarId(null);
        if (isEditingLastTurn) return setIsEditingLastTurn(false);
        if (showReviewPracticeModal) return setShowReviewPracticeModal(false);
        return;
      }

      if (!session || session.status !== 'playing') return;

      if (e.key === 'p' || e.key === 'P') {
        if (activeStar && !isActiveStarRevealed) {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (isPaused || showZoomModal || inspectedStarId || isEditingLastTurn || showReviewPracticeModal) {
        return;
      }

      // On Map: keys 1..9 open star
      if (!activeStar) {
        const num = Number(e.key);
        if (Number.isInteger(num) && num >= 1 && num <= session.stars.length) {
          const target = session.stars.find((s) => s.starNumber === num);
          if (target) {
            const st = getStarNodeStatus(session, target.id);
            if (st === 'unopened') {
              e.preventDefault();
              handleSelectStar(target.id);
            } else if (st === 'lit' || st === 'solution_viewed') {
              e.preventDefault();
              setInspectedStarId(target.id);
            }
          }
        }
        return;
      }

      // Inside active star question (Solo / Whole-Class)
      if (!isActiveStarRevealed && session.config.participantMode !== 'teams') {
        const upper = e.key.toUpperCase();
        if (upper === 'A' || upper === 'B' || upper === 'C' || upper === 'D') {
          e.preventDefault();
          setSingleChoice(upper as StarOptionLetter);
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (isActiveStarRevealed) {
          handleBackToMap();
        } else if (session.config.participantMode !== 'teams' && singleChoice) {
          handleCommitSingleChoice();
        } else if (session.config.participantMode === 'teams' && unrecordedTeamsCount === 0) {
          handleCommitTeamsChoice();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    session,
    activeStar,
    isActiveStarRevealed,
    isPaused,
    singleChoice,
    unrecordedTeamsCount,
    showZoomModal,
    inspectedStarId,
    isEditingLastTurn,
    showReviewPracticeModal,
    handleTogglePause,
    handleSelectStar,
    handleBackToMap,
    handleCommitSingleChoice,
    handleCommitTeamsChoice,
  ]);

  // ============================================================================
  // SHARED TOP BAR (Consistent with A01/A02/E01/E02/E04)
  // ============================================================================
  const renderTopBar = () => (
    <header className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#09162D] border-b border-teal-500/25 shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={handleExitToLibrary}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600/80 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Về thư viện</span>
        </button>

        <div className="min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-amber-300 tracking-wide shrink-0">E05</span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <h1 className="text-sm sm:text-base font-black text-white truncate">
            Săn sao kiến thức 3D
          </h1>
          {isDemo && (
            <span className="text-[11px] font-bold text-amber-200/90 whitespace-nowrap">
              · Bản demo KHKT
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setForce2D((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
            force2D
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
              : 'bg-slate-800/90 text-slate-200 border-slate-600/80 hover:bg-slate-700'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{force2D ? 'Bản đồ 2D' : 'Bản đồ 3D'}</span>
        </button>

        <button
          type="button"
          onClick={() => setReducedMotion((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
            reducedMotion
              ? 'bg-teal-500/20 text-teal-200 border-teal-400/50'
              : 'bg-slate-800/90 text-slate-200 border-slate-600/80 hover:bg-slate-700'
          }`}
        >
          <FastForward className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{reducedMotion ? 'Giảm CĐ' : 'Hoạt ảnh'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleVoice}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
            voiceEnabled && !isMuted
              ? 'bg-teal-600/30 text-teal-100 border-teal-400/60'
              : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title={
            voiceSnapshot.hasVietnameseVoice
              ? 'Bật/tắt giọng đọc tiếng Việt'
              : 'Trình duyệt thiếu giọng tiếng Việt (vi-VN) — trò chơi vẫn chạy bình thường'
          }
        >
          {voiceEnabled && !isMuted ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Giọng VI</span>
        </button>

        <button
          type="button"
          onClick={handleToggleMute}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
            isMuted
              ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
              : 'bg-amber-400/20 text-amber-100 border-amber-400/50 hover:bg-amber-400/30'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Tắt loa' : 'Âm thanh'}</span>
        </button>

        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600/80 transition-colors cursor-pointer whitespace-nowrap"
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
    return (
      <div
        className={`w-full bg-[#061024] text-slate-100 flex flex-col overflow-hidden ${
          isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[680px]'
        }`}
      >
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-5">
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

            {savedSessionToResume && (
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-teal-500/15 border border-teal-400/40">
                <div className="space-y-0.5">
                  <p className="text-sm font-black text-teal-100">
                    Có phiên E05 đang lưu ({savedSessionToResume.history.length}/{savedSessionToResume.stars.length} sao đã mở · {computeMapLitStarCount(savedSessionToResume)} sao đã thắp sáng)
                  </p>
                  <p className="text-xs text-teal-200/80">
                    Khôi phục giữ nguyên vị trí sao, câu hỏi gắn từng sao, lượt chọn đội và toàn bộ kết quả đã ghi.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResumeSavedSession}
                    className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#061024] text-xs font-black cursor-pointer"
                  >
                    Tiếp tục phiên cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      clearE05Session();
                      setSavedSessionToResume(null);
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-600 cursor-pointer"
                  >
                    Xóa phiên cũ
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left: Setup Controls */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1. Participant Mode */}
                <section className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-4 sm:p-5 space-y-3.5">
                  <h2 className="text-sm font-black text-teal-200">
                    1. Chọn hình thức tham gia (1–50 học sinh)
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        {
                          id: 'solo_practice' as StarHuntParticipantMode,
                          icon: User,
                          title: 'Tự luyện (1 HS)',
                          desc: 'Chọn sao tự do, chốt đáp án để thắp sáng sao; cuối phiên có mục Ôn lại câu chưa đúng.',
                        },
                        {
                          id: 'whole_class' as StarHuntParticipantMode,
                          icon: Users,
                          title: 'Cả lớp hợp tác',
                          desc: '1–50 HS cùng giải để thắp sáng cả 3 chòm sao; sai vẫn xem lời giải & ôn lại riêng.',
                        },
                        {
                          id: 'teams' as StarHuntParticipantMode,
                          icon: Trophy,
                          title: 'Thi đua 2–6 đội',
                          desc: 'Luân phiên quyền chọn sao, mọi đội cùng giải, đúng +1 sao riêng, đồng điểm Đồng hạng.',
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
                          className={`text-left p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
                            active
                              ? 'bg-amber-400/15 border-amber-400 text-white'
                              : 'bg-[#08152E] border-slate-700/80 text-slate-300 hover:border-slate-500'
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

                  {config.participantMode === 'teams' && (
                    <div className="p-3.5 rounded-xl bg-[#08152E] border border-slate-700/80 space-y-3">
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
                                  teams: createStarTeams(
                                    n,
                                    prev.teams.map((t) => t.name)
                                  ),
                                }))
                              }
                              className={`w-8 h-8 rounded-lg text-xs font-black border cursor-pointer tabular-nums ${
                                config.teams.length === n
                                  ? 'bg-amber-400 text-[#061024] border-amber-300'
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
                          const pal = STAR_TEAM_PALETTES[team.paletteIndex % STAR_TEAM_PALETTES.length];
                          return (
                            <div
                              key={team.id}
                              className="flex items-center gap-2 bg-[#0C1D3B] px-2.5 py-1.5 rounded-lg border border-slate-700"
                            >
                              <span
                                className="w-3 h-3 rounded-full shrink-0"
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
                                className="w-full bg-transparent text-xs font-bold text-white focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* 2. Question Source & Star Count */}
                <section className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-4 sm:p-5 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-black text-teal-200">
                      2. Nguồn câu hỏi & thời gian mỗi sao
                    </h2>
                    <span className="text-xs font-bold text-slate-300 tabular-nums">
                      Khả dụng: {setupPool.length} câu
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          sourceKind: 'sample',
                          starCount: 9,
                        }))
                      }
                      className={`text-left p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
                        config.sourceKind === 'sample'
                          ? 'bg-teal-500/15 border-teal-400 text-white'
                          : 'bg-[#08152E] border-slate-700/80 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-xs font-black text-white">{E05_SAMPLE_PACK_TITLE}</p>
                      <p className="text-[11px] text-amber-200 font-bold mt-0.5">
                        {E05_SAMPLE_BADGE} · 9 sao chia 3 cụm
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Tách biệt ngân hàng thật, bắt đầu ngay không cần danh sách lớp.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          sourceKind: 'bank',
                        }))
                      }
                      className={`text-left p-3.5 rounded-xl border-2 transition-colors cursor-pointer ${
                        config.sourceKind === 'bank'
                          ? 'bg-teal-500/15 border-teal-400 text-white'
                          : 'bg-[#08152E] border-slate-700/80 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <p className="text-xs font-black text-white">Ngân hàng câu hỏi Smart EDU</p>
                      <p className="text-[11px] text-teal-200 font-bold mt-0.5">
                        Câu trắc nghiệm 4 lựa chọn · Giữ đúng phân quyền
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Không lặp câu; nếu ít hơn 9 câu có thể giảm số sao hoặc quay về bộ mẫu.
                      </p>
                    </button>
                  </div>

                  {config.sourceKind === 'bank' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <select
                        value={config.subjectFilter}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, subjectFilter: e.target.value }))
                        }
                        className="px-3 py-2 rounded-lg bg-[#08152E] border border-slate-700 text-xs font-bold text-slate-100"
                      >
                        {availableBankSubjects.map((s) => (
                          <option key={s} value={s}>
                            {SUBJECT_LABELS[s] || s}
                          </option>
                        ))}
                      </select>

                      <select
                        value={config.gradeFilter}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, gradeFilter: e.target.value }))
                        }
                        className="px-3 py-2 rounded-lg bg-[#08152E] border border-slate-700 text-xs font-bold text-slate-100"
                      >
                        <option value="all">Tất cả khối lớp</option>
                        {['6', '7', '8', '9'].map((g) => (
                          <option key={g} value={g}>
                            Khối {g}
                          </option>
                        ))}
                      </select>

                      <select
                        value={config.starCount}
                        onChange={(e) =>
                          setConfig((prev) => ({ ...prev, starCount: Number(e.target.value) }))
                        }
                        className="px-3 py-2 rounded-lg bg-[#08152E] border border-slate-700 text-xs font-bold text-slate-100"
                      >
                        {[3, 6, 9].map((cnt) => (
                          <option key={cnt} value={cnt}>
                            {cnt} sao trên bản đồ
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Timer & Option Shuffle */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-300" />
                      Thời gian mỗi câu
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {TIMER_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() =>
                            setConfig((prev) => ({ ...prev, timerSeconds: p.value }))
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                            config.timerSeconds === p.value
                              ? 'bg-teal-500 text-[#061024] border-teal-300'
                              : 'bg-[#08152E] text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#08152E] border border-slate-700/80 cursor-pointer">
                    <span className="text-xs font-bold text-slate-200">
                      Xáo trộn thứ tự phương án A/B/C/D (chấm theo mã đáp án ổn định)
                    </span>
                    <input
                      type="checkbox"
                      checked={config.shuffleOptions}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, shuffleOptions: e.target.checked }))
                      }
                      className="w-4 h-4 accent-teal-400 shrink-0"
                    />
                  </label>

                  {setupValidation.warnings.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}

                  {setupValidation.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-bold"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </section>
              </div>

              {/* Right: Cluster Overview & Launch Card */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-5 space-y-4">
                  <div>
                    <h2 className="text-base font-black text-white">
                      Cấu trúc bản đồ 3 cụm sao
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Mặc định 9 sao chia đều 3 cụm. Khi cả 3 sao trong cùng một cụm được thắp sáng, đường nối chòm sao ánh vàng sẽ hiện lên minh họa tiến độ.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-[#08152E] border border-teal-500/25">
                      <p className="text-xs font-black text-teal-200">Cụm 1 — Số và phép tính</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Sao 1: Số nguyên · Sao 2: Phân số · Sao 3: Lũy thừa & Căn bậc hai
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#08152E] border border-sky-500/25">
                      <p className="text-xs font-black text-sky-200">Cụm 2 — Biểu thức và phương trình</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Sao 4: Thu gọn biểu thức · Sao 5: Phương trình bậc nhất · Sao 6: Hệ phương trình
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-[#08152E] border border-amber-400/25">
                      <p className="text-xs font-black text-amber-200">Cụm 3 — Hình học và xác suất</p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        Sao 7: Diện tích HCN · Sao 8: Góc kề bù · Sao 9: Xác suất xúc xắc
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/80 space-y-3">
                    <div className="text-xs text-slate-300 space-y-1">
                      <p>• Chọn sao theo thứ tự tùy ý · Công thức Toán hiển thị chuẩn KaTeX</p>
                      <p>• Sao đã chơi vẫn mở lại xem lời giải bất cứ lúc nào</p>
                      <p>• Phím tắt: 1–9 chọn sao, A/B/C/D chọn đáp án, Enter xác nhận, P tạm dừng</p>
                    </div>

                    <button
                      type="button"
                      disabled={!setupValidation.valid}
                      onClick={handleStartSession}
                      className="w-full py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-45 text-[#061024] text-sm font-black shadow-lg shadow-amber-950/40 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Star className="w-4 h-4 fill-current" />
                      <span>
                        Bắt đầu Săn sao ({setupValidation.effectiveStarCount} sao)
                      </span>
                    </button>
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
  // VIEW 2: SUMMARY SCREEN
  // ============================================================================
  if (session.status === 'finished' && !activeStar) {
    const reviewStarsList = missedStars;
    const activeReviewStar = reviewStarsList[reviewPracticeIndex] || null;
    const activeReviewAttempt = activeReviewStar
      ? session.reviewPractice[activeReviewStar.id]
      : undefined;
    const reviewCorrectCount = Object.values(session.reviewPractice).filter((r) => r.isCorrect).length;

    return (
      <div
        className={`w-full bg-[#061024] text-slate-100 flex flex-col overflow-hidden ${
          isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[680px]'
        }`}
      >
        {renderTopBar()}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Hero Summary Banner */}
            <div className="rounded-2xl bg-[#0C1D3B] border border-amber-400/45 p-6 text-center space-y-2">
              <p className="text-xs font-black text-amber-300 tracking-wider">
                TỔNG KẾT BẢN ĐỒ SAO E05
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-white">
                Đã thắp sáng {mapLitCount}/{session.stars.length} ngôi sao · Hoàn thành {completedClustersCount}/3 chòm sao
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                {session.config.participantMode === 'teams'
                  ? 'Xếp hạng theo số sao từng đội đạt được · Bằng số sao được tính Đồng hạng · Không cộng điểm tốc độ.'
                  : 'Mọi câu chưa đúng có thể luyện lại trong mục “Ôn lại câu chưa đúng” mà không làm thay đổi số sao của lượt chơi chính.'}
              </p>
            </div>

            {/* 3 Constellation Progress Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {clusterProgress.map(({ cluster, litStars, totalStars, isComplete }) => (
                <div
                  key={cluster.id}
                  className={`p-4 rounded-xl border ${
                    isComplete
                      ? 'bg-amber-400/15 border-amber-400/65'
                      : 'bg-[#0C1D3B] border-teal-500/25'
                  }`}
                >
                  <p className="text-xs font-black text-white">{cluster.name}</p>
                  <p className="text-lg font-black text-amber-300 mt-1 tabular-nums">
                    {litStars}/{totalStars} sao sáng
                  </p>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {isComplete ? 'Chòm sao đã nối sáng hoàn chỉnh' : 'Chưa nối đủ 3 sao'}
                  </p>
                </div>
              ))}
            </div>

            {/* Standings Table */}
            <div className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-5 space-y-3">
              <h3 className="text-base font-black text-white">
                {session.config.participantMode === 'teams'
                  ? 'Thành tích các đội'
                  : 'Thành tích lượt chơi chính'}
              </h3>
              <div className="space-y-2">
                {standings.map((row) => {
                  const pal = STAR_TEAM_PALETTES[row.paletteIndex % STAR_TEAM_PALETTES.length];
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#08152E] border border-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/50 text-amber-200 font-black text-sm flex items-center justify-center tabular-nums">
                          #{row.rank}
                        </span>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: pal.hex }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white">{row.name}</span>
                            {row.isTied && (
                              <span className="text-xs font-black text-amber-300">· Đồng hạng</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 tabular-nums">
                            Đúng {row.correctCount} · Sai {row.incorrectCount} · Không trả lời {row.noAnswerCount}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-300">
                        <Star className="w-5 h-5 fill-amber-300" />
                        <span className="text-xl font-black tabular-nums">{row.stars}</span>
                        <span className="text-xs font-bold text-slate-400">sao</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {Object.keys(session.reviewPractice).length > 0 && (
                <p className="text-xs font-bold text-teal-200 pt-1">
                  Kết quả ôn lại riêng: đã làm đúng {reviewCorrectCount}/{reviewStarsList.length} câu chưa đúng (không cộng vào số sao lượt chính).
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {reviewStarsList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewPracticeIndex(0);
                    setReviewSelectedLetter(null);
                    setShowReviewPracticeModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-[#061024] text-sm font-black cursor-pointer"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Ôn lại câu chưa đúng ({reviewStarsList.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleReplaySameConfig}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-sm font-black cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại</span>
              </button>

              <button
                type="button"
                onClick={handleReturnToSetup}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold border border-slate-600 cursor-pointer"
              >
                <span>Đổi thiết lập</span>
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

            {/* Solutions of All Played Stars */}
            <div className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-5 space-y-3">
              <h3 className="text-base font-black text-white">Lời giải toàn bộ các sao đã chơi</h3>
              <div className="space-y-2.5">
                {session.stars.map((star) => {
                  const rec = session.history.find((h) => h.starId === star.id);
                  const correctLabel = getCorrectOptionLabelForStarQuestion(star.question);
                  return (
                    <div
                      key={star.id}
                      className="p-4 rounded-xl bg-[#08152E] border border-slate-700/90 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-black text-teal-200">
                          Sao {star.starNumber} · {star.topicLabel}
                        </span>
                        <span
                          className={`font-black ${
                            rec?.mapStarLit ? 'text-amber-300' : 'text-slate-300'
                          }`}
                        >
                          {rec?.mapStarLit ? '★ Đã thắp sáng' : 'Đã xem lời giải'} · Đáp án {correctLabel}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-white overflow-x-auto">
                        <MathView content={star.question.stem} />
                      </div>
                      <div className="text-xs text-slate-300 overflow-x-auto">
                        <MathView content={star.question.explanation} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated "Ôn lại câu chưa đúng" Practice Modal (NEVER alters main star count!) */}
        {showReviewPracticeModal && activeReviewStar && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl max-h-[88vh] rounded-2xl bg-[#0C1D3B] border-2 border-teal-400/60 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700">
                <div>
                  <h3 className="text-base font-black text-white">
                    Ôn lại câu chưa đúng ({reviewPracticeIndex + 1}/{reviewStarsList.length})
                  </h3>
                  <p className="text-[11px] text-teal-200">
                    Ghi nhận riêng kết quả ôn tập · Giữ nguyên số sao lượt chơi chính ({mapLitCount} sao)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReviewPracticeModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="p-4 rounded-xl bg-[#08152E] border border-slate-700 overflow-x-auto">
                  <p className="text-xs font-bold text-teal-300 mb-1.5">
                    Sao {activeReviewStar.starNumber} · {activeReviewStar.topicLabel}
                  </p>
                  <div className="text-lg font-black text-white">
                    <MathView content={activeReviewStar.question.stem} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeReviewStar.question.options.map((opt) => {
                    const selected = reviewSelectedLetter === opt.label;
                    const isRight = opt.id === activeReviewStar.question.correctOptionId;
                    const showResult = Boolean(activeReviewAttempt);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={showResult}
                        onClick={() => setReviewSelectedLetter(opt.label)}
                        className={`p-3.5 rounded-xl border-2 text-left flex items-center gap-3 overflow-x-auto cursor-pointer ${
                          showResult && isRight
                            ? 'bg-teal-500/20 border-teal-400 text-white'
                            : showResult && activeReviewAttempt?.chosenOptionId === opt.id && !isRight
                            ? 'bg-rose-500/20 border-rose-400 text-white'
                            : selected
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-[#08152E] border-slate-700 text-slate-200 hover:border-slate-500'
                        }`}
                      >
                        <span className="w-7 h-7 rounded-lg bg-slate-800 text-amber-300 font-black text-xs flex items-center justify-center shrink-0">
                          {opt.label}
                        </span>
                        <div className="text-sm font-bold min-w-0">
                          <MathView content={opt.text} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {activeReviewAttempt && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs space-y-1 overflow-x-auto ${
                      activeReviewAttempt.isCorrect
                        ? 'bg-teal-500/15 border-teal-400 text-teal-100'
                        : 'bg-amber-500/15 border-amber-400 text-amber-100'
                    }`}
                  >
                    <p className="font-black">
                      {activeReviewAttempt.isCorrect
                        ? 'Chính xác ở lượt ôn tập!'
                        : `Chưa đúng — Đáp án là ${getCorrectOptionLabelForStarQuestion(
                            activeReviewStar.question
                          )}.`}
                    </p>
                    <MathView content={activeReviewStar.question.explanation} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-slate-700 bg-[#08152E]">
                <button
                  type="button"
                  disabled={reviewPracticeIndex === 0}
                  onClick={() => {
                    setReviewPracticeIndex((i) => Math.max(0, i - 1));
                    setReviewSelectedLetter(null);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Câu trước
                </button>

                {!activeReviewAttempt ? (
                  <button
                    type="button"
                    disabled={!reviewSelectedLetter}
                    onClick={() => {
                      if (!reviewSelectedLetter) return;
                      setSession((prev) =>
                        prev
                          ? recordStarReviewAttempt(prev, activeReviewStar.id, reviewSelectedLetter)
                          : prev
                      );
                    }}
                    className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#061024] text-xs font-black cursor-pointer"
                  >
                    Kiểm tra câu ôn tập
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (reviewPracticeIndex + 1 < reviewStarsList.length) {
                        setReviewPracticeIndex((i) => i + 1);
                        setReviewSelectedLetter(null);
                      } else {
                        setShowReviewPracticeModal(false);
                      }
                    }}
                    className="px-5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-[#061024] text-xs font-black cursor-pointer"
                  >
                    {reviewPracticeIndex + 1 < reviewStarsList.length
                      ? 'Câu ôn tiếp theo'
                      : 'Hoàn tất ôn tập'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: ACTIVE GAMEPLAY (MAP VIEW OR COMPACT-MAP + QUESTION VIEW)
  // ============================================================================
  return (
    <div
      className={`w-full bg-[#061024] text-slate-100 flex flex-col overflow-hidden relative ${
        isFullscreen ? 'h-dvh rounded-none' : 'rounded-2xl border border-teal-500/30 min-h-[700px]'
      }`}
    >
      {renderTopBar()}

      {/* Sub-header Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-[#0C1D3B] border-b border-slate-700/70 shrink-0 text-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-black text-amber-300 tabular-nums">
            ★ {mapLitCount}/{session.stars.length} sao sáng
          </span>
          <span className="text-slate-600" aria-hidden="true">·</span>
          <span className="font-bold text-teal-200 tabular-nums">
            {completedClustersCount}/3 chòm sao hoàn thành
          </span>
          {pickingTeam && (
            <>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <span className="font-black text-white">
                Quyền chọn sao: <span className="text-amber-300">{pickingTeam.name}</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeStar && session.config.timerSeconds > 0 && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black border tabular-nums ${
                remainingSeconds === 0 && !isActiveStarRevealed
                  ? 'bg-rose-500/20 border-rose-400/60 text-rose-200'
                  : 'bg-[#08152E] border-teal-500/40 text-teal-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{remainingSeconds}s</span>
            </span>
          )}

          {activeStar && !isActiveStarRevealed && (
            <button
              type="button"
              onClick={handleTogglePause}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                isPaused
                  ? 'bg-amber-400 text-[#061024] border-amber-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? 'Tiếp tục (P)' : 'Tạm dừng (P)'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSkipAnimationKey((k) => k + 1)}
            disabled={isPaused}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-45 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer"
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

      {/* MAIN WORKSPACE */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5">
        {!activeStar ? (
          /* ---------------- FULL 3D/2D STAR MAP MODE ---------------- */
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            <div className="lg:col-span-9 aspect-video min-h-[360px] lg:min-h-[480px]">
              <StarHunt3DScene
                state={session}
                onSelectStar={handleSelectStar}
                onInspectPlayedStar={(id) => setInspectedStarId(id)}
                skipAnimationKey={skipAnimationKey}
                reducedMotion={reducedMotion}
                force2D={force2D}
                disabled={isPaused}
              />
            </div>

            {/* Right Sidebar: Scoreboard & Quick Actions */}
            <div className="lg:col-span-3 flex flex-col gap-3">
              {pickingTeam && (
                <div className="rounded-2xl bg-[#0C1D3B] border-2 border-amber-400/60 p-4 space-y-1">
                  <p className="text-[11px] font-bold text-amber-300">LƯỢT CHỌN SAO</p>
                  <p className="text-base font-black text-white">{pickingTeam.name}</p>
                  <p className="text-[11px] text-slate-300 leading-snug">
                    Chọn một ngôi sao chưa mở trên bản đồ. Sau đó tất cả các đội cùng trả lời (không có điểm thưởng riêng).
                  </p>
                </div>
              )}

              <div className="rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-4 space-y-2.5 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-teal-200 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    Bảng sao thành tích
                  </h3>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    {session.history.length}/{session.stars.length} đã mở
                  </span>
                </div>

                <div className="space-y-1.5">
                  {standings.map((row) => {
                    const pal = STAR_TEAM_PALETTES[row.paletteIndex % STAR_TEAM_PALETTES.length];
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#08152E] border border-slate-700/80"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-black text-amber-300 w-5 tabular-nums">
                            #{row.rank}
                          </span>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: pal.hex }}
                          />
                          <span className="text-xs font-bold text-white truncate">{row.name}</span>
                          {row.isTied && (
                            <span className="text-[10px] font-black text-amber-200 shrink-0">
                              Đồng hạng
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-black text-amber-300 flex items-center gap-1 shrink-0 tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-amber-300" />
                          {row.stars}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {lastCommittedRecord && (
                  <button
                    type="button"
                    onClick={handleOpenEditLastTurn}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Sửa kết quả sao {lastCommittedRecord.starNumber} vừa chốt</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ---------------- QUESTION PROJECTION MODE (COMPACT MAP BAR + LARGE QUESTION) ---------------- */
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Compact Collapsed Star Map Strip */}
            <div className="rounded-xl bg-[#0C1D3B] border border-teal-500/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-teal-200">Bản đồ thu gọn:</span>
                {session.stars.map((s) => {
                  const st = getStarNodeStatus(session, s.id);
                  return (
                    <span
                      key={s.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-black tabular-nums border ${
                        st === 'active'
                          ? 'bg-sky-400 text-[#061024] border-sky-300'
                          : st === 'lit'
                          ? 'bg-amber-400/20 text-amber-200 border-amber-400/60'
                          : st === 'solution_viewed'
                          ? 'bg-slate-700 text-slate-300 border-slate-500'
                          : 'bg-[#08152E] text-slate-400 border-slate-700'
                      }`}
                    >
                      {st === 'lit' && <Star className="w-3 h-3 fill-amber-300 text-amber-300" />}
                      {s.starNumber}
                    </span>
                  );
                })}
              </div>
              <span className="text-xs font-bold text-slate-300">
                Đang xử lý Sao {activeStar.starNumber} · {activeStar.topicLabel} (đã khóa mở sao khác)
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* Left (7/12): Question Stem, KaTeX Math & 4 Options */}
              <div className="lg:col-span-7 rounded-2xl bg-[#0C1D3B] border-2 border-teal-400/40 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-amber-300">
                      SAO SỐ {activeStar.starNumber}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="font-bold text-teal-200">{activeStar.topicLabel}</span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-300">
                      {activeStar.question.sourceBadge}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowZoomModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-600 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Phóng to</span>
                  </button>
                </div>

                {/* Question Stem (overflow-x-auto for system of equations on mobile) */}
                <div className="rounded-xl bg-[#08152E] border border-slate-700 px-4 py-5 overflow-x-auto">
                  <div className="text-xl sm:text-2xl md:text-3xl font-black text-white leading-relaxed">
                    <MathView content={activeStar.question.stem} />
                  </div>
                </div>

                {/* 4 Options A/B/C/D */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeStar.question.options.map((opt) => {
                    const isCorrectOpt = opt.id === activeStar.question.correctOptionId;
                    const isSoloSelected =
                      session.config.participantMode !== 'teams' && singleChoice === opt.label;
                    const interactive =
                      session.config.participantMode !== 'teams' &&
                      !isActiveStarRevealed &&
                      !isPaused;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={!interactive}
                        onClick={() => {
                          if (interactive) setSingleChoice(opt.label);
                        }}
                        className={`p-4 rounded-xl border-2 text-left flex items-center gap-3 overflow-x-auto transition-all ${
                          isActiveStarRevealed && isCorrectOpt
                            ? 'bg-teal-500/20 border-teal-400 text-white shadow-lg'
                            : isActiveStarRevealed && isSoloSelected && !isCorrectOpt
                            ? 'bg-rose-500/20 border-rose-400 text-white'
                            : isSoloSelected
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-[#08152E] border-slate-700 text-slate-100'
                        } ${interactive ? 'cursor-pointer hover:border-teal-400' : 'cursor-default'}`}
                      >
                        <span
                          className={`w-9 h-9 rounded-lg font-black text-base flex items-center justify-center shrink-0 ${
                            isActiveStarRevealed && isCorrectOpt
                              ? 'bg-teal-400 text-[#061024]'
                              : isSoloSelected
                              ? 'bg-amber-400 text-[#061024]'
                              : 'bg-slate-800 text-amber-300 border border-slate-600'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <div className="text-base sm:text-lg font-bold min-w-0">
                          <MathView content={opt.text} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Reveal Explanation Panel */}
                {isActiveStarRevealed && activeStarRecord && (
                  <div
                    className={`rounded-xl p-4 border-2 space-y-2 ${
                      activeStarRecord.mapStarLit
                        ? 'bg-amber-400/15 border-amber-400 text-amber-100'
                        : 'bg-slate-800/90 border-slate-500 text-slate-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm sm:text-base font-black flex items-center gap-2">
                        {activeStarRecord.mapStarLit ? (
                          <>
                            <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
                            <span>
                              Ngôi sao số {activeStar.starNumber} đã thắp sáng! Đáp án đúng: {activeStarRecord.correctOptionLabel}
                            </span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-5 h-5 text-slate-300" />
                            <span>
                              Chưa thắp sáng sao số {activeStar.starNumber} · Đáp án đúng: {activeStarRecord.correctOptionLabel}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-100 overflow-x-auto">
                      <MathView content={activeStar.question.explanation} />
                    </div>
                  </div>
                )}
              </div>

              {/* Right (5/12): Answer Lock / Teams Grading Panel */}
              <div className="lg:col-span-5 rounded-2xl bg-[#0C1D3B] border border-teal-500/25 p-4 sm:p-5 space-y-4">
                {session.config.participantMode !== 'teams' ? (
                  /* SOLO / WHOLE-CLASS PANEL */
                  <div className="space-y-3.5">
                    <h3 className="text-sm font-black text-white">
                      {session.config.participantMode === 'whole_class'
                        ? 'Chốt đáp án chung của cả lớp'
                        : 'Chốt phương án của bạn'}
                    </h3>

                    {!isActiveStarRevealed ? (
                      <>
                        {remainingSeconds === 0 && session.config.timerSeconds > 0 && (
                          <div className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/45 text-amber-200 text-xs font-bold">
                            Đã hết thời gian đếm ngược — vẫn có thể chốt đáp án đã chuẩn bị hoặc chọn “Không trả lời”.
                          </div>
                        )}

                        <p className="text-xs text-slate-300">
                          Đã chọn:{' '}
                          <strong className="text-amber-300">
                            {singleChoice === 'no_answer'
                              ? 'Không trả lời'
                              : singleChoice
                              ? `Phương án ${singleChoice}`
                              : 'Chưa chọn'}
                          </strong>
                        </p>

                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={() => setSingleChoice('no_answer')}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold border cursor-pointer ${
                            singleChoice === 'no_answer'
                              ? 'bg-slate-600 text-white border-slate-400'
                              : 'bg-[#08152E] text-slate-300 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          Đánh dấu “Không trả lời” (xem lời giải)
                        </button>

                        <button
                          type="button"
                          disabled={isPaused || !singleChoice}
                          onClick={handleCommitSingleChoice}
                          className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#061024] text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Chốt đáp án (Enter)</span>
                        </button>
                      </>
                    ) : (
                      <div className="space-y-2.5">
                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleOpenEditLastTurn}
                          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Sửa kết quả câu vừa chốt</span>
                        </button>

                        <button
                          type="button"
                          disabled={isPaused}
                          onClick={handleBackToMap}
                          className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-sm font-black cursor-pointer"
                        >
                          {session.history.length >= session.stars.length
                            ? 'Xem tổng kết bản đồ sao (Enter)'
                            : 'Quay lại bản đồ sao (Enter)'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* TEAMS (2–6 TEAMS) GRADING PANEL */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-white">
                        Ghi nhận kết quả {session.config.teams.length} đội
                      </h3>
                      {!isActiveStarRevealed && (
                        <span className="text-xs font-bold text-amber-200 tabular-nums">
                          {session.config.teams.length - unrecordedTeamsCount}/{session.config.teams.length} đã ghi
                        </span>
                      )}
                    </div>

                    {!isActiveStarRevealed ? (
                      <>
                        {remainingSeconds === 0 && session.config.timerSeconds > 0 ? (
                          <div className="px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/45 text-amber-200 text-xs font-bold">
                            Đã hết giờ — giáo viên vẫn tiếp tục nhập đáp án các đội đã ghi trên bảng con trước hạn.
                          </div>
                        ) : (
                          <p className="text-xs text-slate-300">
                            Các đội ghi phương án lên bảng con hoặc giơ thẻ; giáo viên ghi nhận sau khi các đội chốt.
                          </p>
                        )}

                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
                          {session.config.teams.map((team) => {
                            const pal =
                              STAR_TEAM_PALETTES[team.paletteIndex % STAR_TEAM_PALETTES.length];
                            const val = teamChoices[team.id] || 'unrecorded';
                            return (
                              <div
                                key={team.id}
                                className="p-2.5 rounded-xl bg-[#08152E] border border-slate-700/90 space-y-2"
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
                                    className={`text-[11px] font-bold ${
                                      val === 'unrecorded' ? 'text-rose-300' : 'text-teal-200'
                                    }`}
                                  >
                                    {val === 'unrecorded'
                                      ? 'Chưa ghi nhận'
                                      : val === 'no_answer'
                                      ? 'Không trả lời'
                                      : `Chọn ${val}`}
                                  </span>
                                </div>

                                <div className="grid grid-cols-5 gap-1">
                                  {STAR_OPTION_LETTERS.map((letter) => (
                                    <button
                                      key={letter}
                                      type="button"
                                      disabled={isPaused}
                                      onClick={() =>
                                        setTeamChoices((prev) => ({ ...prev, [team.id]: letter }))
                                      }
                                      className={`py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                                        val === letter
                                          ? 'bg-amber-400 text-[#061024] border-amber-300'
                                          : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'
                                      }`}
                                    >
                                      {letter}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    disabled={isPaused}
                                    onClick={() =>
                                      setTeamChoices((prev) => ({ ...prev, [team.id]: 'no_answer' }))
                                    }
                                    className={`py-1.5 rounded-lg text-[10px] font-black border cursor-pointer ${
                                      val === 'no_answer'
                                        ? 'bg-slate-500 text-white border-slate-300'
                                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                                    }`}
                                    title="Không trả lời"
                                  >
                                    KTL
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {unrecordedTeamsCount > 0 && (
                          <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-400/35 text-[11px] text-amber-200 space-y-1">
                            <p className="font-bold">
                              Còn {unrecordedTeamsCount} đội “Chưa ghi nhận” (khác với “Không trả lời”).
                            </p>
                            <button
                              type="button"
                              disabled={isPaused}
                              onClick={() => {
                                setTeamChoices((prev) => {
                                  const next = { ...prev };
                                  session.config.teams.forEach((t) => {
                                    if (!next[t.id] || next[t.id] === 'unrecorded') {
                                      next[t.id] = 'no_answer';
                                    }
                                  });
                                  return next;
                                });
                              }}
                              className="underline font-black text-amber-100 hover:text-white cursor-pointer"
                            >
                              Đánh dấu nhanh các đội còn lại là “Không trả lời”
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={isPaused || unrecordedTeamsCount > 0}
                          onClick={handleCommitTeamsChoice}
                          className="w-full py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-[#061024] text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Xác nhận & Công bố đáp án</span>
                        </button>
                      </>
                    ) : (
                      <div className="space-y-3">
                        {activeStarRecord && (
                          <div className="space-y-1.5">
                            {session.config.teams.map((team) => {
                              const label =
                                activeStarRecord.chosenLabelByParticipant[team.id] || 'no_answer';
                              const earned =
                                activeStarRecord.starsEarnedByParticipant[team.id] || 0;
                              return (
                                <div
                                  key={team.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#08152E] border border-slate-700 text-xs"
                                >
                                  <span className="font-bold text-white truncate">{team.name}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-slate-300">
                                      {label === 'no_answer' ? 'Không trả lời' : `Chọn ${label}`}
                                    </span>
                                    <span
                                      className={`font-black tabular-nums ${
                                        earned > 0 ? 'text-amber-300' : 'text-slate-400'
                                      }`}
                                    >
                                      {earned > 0 ? '+1 ★' : '0 ★'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleOpenEditLastTurn}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold border border-slate-600 cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Sửa kết quả vừa chốt</span>
                          </button>

                          <button
                            type="button"
                            disabled={isPaused}
                            onClick={handleBackToMap}
                            className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-sm font-black cursor-pointer"
                          >
                            {session.history.length >= session.stars.length
                              ? 'Tổng kết (Enter)'
                              : 'Về bản đồ sao (Enter)'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pause Overlay */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-[#061024]/90 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-[#0C1D3B] border-2 border-amber-400/60 p-6 text-center space-y-4">
            <Pause className="w-10 h-10 text-amber-400 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-xl font-black text-white">Phiên chơi đang tạm dừng</h3>
              <p className="text-xs text-slate-300">
                Âm thanh đã dừng và thời gian còn lại được giữ nguyên
                {session.config.timerSeconds > 0 ? ` (${remainingSeconds} giây)` : ''}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleTogglePause}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-sm font-black cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Tiếp tục (P)</span>
            </button>
          </div>
        </div>
      )}

      {/* Inspect Already-Played Star Solution Modal */}
      {inspectedStar && inspectedStarRecord && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4"
          onClick={() => setInspectedStarId(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#0C1D3B] border-2 border-teal-400/50 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-black text-white">
                Xem lại Sao {inspectedStar.starNumber} · {inspectedStar.topicLabel}
              </h3>
              <button
                type="button"
                onClick={() => setInspectedStarId(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#08152E] border border-slate-700 overflow-x-auto">
              <div className="text-lg font-black text-white">
                <MathView content={inspectedStar.question.stem} />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-teal-500/15 border border-teal-400/50 space-y-1.5 overflow-x-auto">
              <p className="text-sm font-black text-teal-100">
                Đáp án đúng: {inspectedStarRecord.correctOptionLabel} ({inspectedStarRecord.mapStarLit ? 'Sao đã thắp sáng' : 'Đã xem lời giải'})
              </p>
              <div className="text-xs sm:text-sm text-slate-100">
                <MathView content={inspectedStar.question.explanation} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Last Committed Turn Modal */}
      {isEditingLastTurn && lastCommittedRecord && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#0C1D3B] border-2 border-amber-400/55 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">
                Sửa kết quả Sao {lastCommittedRecord.starNumber} vừa chốt
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingLastTurn(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {session.config.participantMode === 'teams' ? (
              <div className="space-y-2 max-h-[55vh] overflow-y-auto">
                {session.config.teams.map((team) => {
                  const val = editTeamsDraft[team.id] || 'unrecorded';
                  return (
                    <div
                      key={team.id}
                      className="p-3 rounded-xl bg-[#08152E] border border-slate-700 space-y-2"
                    >
                      <p className="text-xs font-black text-white">{team.name}</p>
                      <div className="grid grid-cols-5 gap-1">
                        {STAR_OPTION_LETTERS.map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() =>
                              setEditTeamsDraft((prev) => ({ ...prev, [team.id]: letter }))
                            }
                            className={`py-1.5 rounded-lg text-xs font-black border cursor-pointer ${
                              val === letter
                                ? 'bg-amber-400 text-[#061024] border-amber-300'
                                : 'bg-slate-800 text-slate-200 border-slate-700'
                            }`}
                          >
                            {letter}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setEditTeamsDraft((prev) => ({ ...prev, [team.id]: 'no_answer' }))
                          }
                          className={`py-1.5 rounded-lg text-[10px] font-black border cursor-pointer ${
                            val === 'no_answer'
                              ? 'bg-slate-500 text-white border-slate-300'
                              : 'bg-slate-900 text-slate-400 border-slate-700'
                          }`}
                        >
                          KTL
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {STAR_OPTION_LETTERS.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => setEditSingleDraft(letter)}
                    className={`py-2.5 rounded-lg text-sm font-black border cursor-pointer ${
                      editSingleDraft === letter
                        ? 'bg-amber-400 text-[#061024] border-amber-300'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    {letter}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditSingleDraft('no_answer')}
                  className={`py-2.5 rounded-lg text-xs font-black border cursor-pointer ${
                    editSingleDraft === 'no_answer'
                      ? 'bg-slate-500 text-white border-slate-300'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  KTL
                </button>
              </div>
            )}

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
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#061024] text-xs font-black cursor-pointer"
              >
                Lưu & tính lại sao
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom Question Modal */}
      {showZoomModal && activeStar && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-4"
          onClick={() => setShowZoomModal(false)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl bg-[#0C1D3B] border-2 border-teal-400/60 p-6 sm:p-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-300">
                SAO SỐ {activeStar.starNumber} · {activeStar.topicLabel}
              </span>
              <button
                type="button"
                onClick={() => setShowZoomModal(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 overflow-x-auto text-2xl sm:text-4xl font-black text-white leading-relaxed">
              <MathView content={activeStar.question.stem} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeStar.question.options.map((opt) => (
                <div
                  key={opt.id}
                  className="p-4 rounded-xl bg-[#08152E] border border-slate-700 flex items-center gap-3 overflow-x-auto"
                >
                  <span className="w-9 h-9 rounded-lg bg-slate-800 text-amber-300 font-black flex items-center justify-center shrink-0">
                    {opt.label}
                  </span>
                  <div className="text-lg sm:text-2xl font-bold text-white">
                    <MathView content={opt.text} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StarHunt3DGame;
