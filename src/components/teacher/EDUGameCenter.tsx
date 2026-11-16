import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  EDU_GAMES_CATALOG,
  EDU_GAME_CATEGORIES,
  EduGameItem,
} from '../../data/eduGameCatalog';
import {
  StudentCandidate,
  loadCallHistory,
  saveCallHistory,
  clearCallHistory,
  loadAbsentIds,
  saveAbsentIds,
  loadCalledSessionIds,
  saveCalledSessionIds,
  loadCustomManualStudents,
  saveCustomManualStudents,
  mapClassStudentsToCandidates,
  CallHistoryItem,
} from './studentCallRules';
import {
  History,
  Timer as TimerIcon,
  Volume2,
  VolumeX,
  Play,
  Sparkles,
  RotateCcw,
  Trash2,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Search,
  Users,
  Gamepad2,
  PlusCircle,
  Star,
  BarChart2,
  HelpCircle,
  AlertCircle,
  Heart,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Clock,
} from 'lucide-react';

import { MagicLotteryGame } from './games/MagicLotteryGame';
import { HorseRaceGame } from './games/HorseRaceGame';
import { RocketGame } from './games/RocketGame';
import { BalloonsGame } from './games/BalloonsGame';
import { DiceGame } from './games/DiceGame';
import { SecretCardGame } from './games/SecretCardGame';
import { NumberWheelGame } from './games/NumberWheelGame';
import { RobotGame } from './games/RobotGame';
import { SpeedChallengeGame } from './games/SpeedChallengeGame';
import { MysteryPictureGame } from './games/MysteryPictureGame';
import { CrosswordGame } from './games/CrosswordGame';
import { SecretCodeGame } from './games/SecretCodeGame';
import { TrueFalseGame } from './games/TrueFalseGame';
import { PictureWordGame } from './games/PictureWordGame';

const StudentWheel3DGame = React.lazy(() => import('./games/StudentWheel3DGame'));
const ClawMachine3DGame = React.lazy(() => import('./games/ClawMachine3DGame'));
const MysteryGiftBox3DGame = React.lazy(() => import('./games/MysteryGiftBox3DGame'));
const DuckRace3DGame = React.lazy(() => import('./games/DuckRace3DGame'));
import {
  CATEGORY_META,
  BannerGamepadSVG,
  BannerTrophyBooksSVG,
  GameCardIllustration,
} from './gameLibraryHelpers';
import {
  GuestClassSession,
  GuestTurnHistoryItem,
  loadGuestSession,
  saveGuestSession,
  loadGuestHistory,
  appendGuestTurnHistory,
  clearAllGuestData,
  loadRosterModePreference,
  saveRosterModePreference,
  buildGuestHistoryCsvContent,
} from './GuestRosterManager';
import { GameRosterSetup } from './GameRosterSetup';
import { ClassRoom } from '../../types';

// Web Audio Sound Synthesizer
class SoundPlayer {
  private ctx: AudioContext | null = null;
  public muted = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playTick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(860, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.07, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.045);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.045);
    } catch {}
  }

  playFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.09);
        gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + i * 0.09 + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.09 + 0.38);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.09);
        osc.stop(this.ctx.currentTime + i * 0.09 + 0.4);
      });
    } catch {}
  }

  playBell() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.0);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.0);
    } catch {}
  }

  playTimerBeep() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(700, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {}
  }
}

const sounds = new SoundPlayer();

const SLICE_COLORS = [
  '#006BFF', '#059669', '#D97706', '#DC2626', '#7C3AED',
  '#0891B2', '#DB2777', '#2563EB', '#15803D', '#EA580C',
];

const PLUSH_ICONS = ['🧸', '🐰', '🐱', '🐶', '🦊', '🐼', '🐸', '🐥', '🦁', '🐯'];

export const EDUGameCenter: React.FC = () => {
  const { classes, questions, user, userProfile, currentRole, openAuthModal } = useApp();
  const isLoggedInTeacher = Boolean(user && currentRole !== 'student');
  const systemTeacherId = user?.id || 'gv_taydo';

  // Shared Guest Mode vs Teacher Mode state
  const [rosterMode, setRosterMode] = useState<'guest' | 'teacher'>(() =>
    loadRosterModePreference(Boolean(user && currentRole !== 'student'))
  );
  const [guestSession, setGuestSession] = useState<GuestClassSession>(() => loadGuestSession());
  const [guestHistory, setGuestHistory] = useState<GuestTurnHistoryItem[]>(() => loadGuestHistory());
  const [showRosterSetupModal, setShowRosterSetupModal] = useState<boolean>(false);
  const [pendingGameToLaunch, setPendingGameToLaunch] = useState<EduGameItem | null>(null);

  const handleChangeRosterMode = (nextMode: 'guest' | 'teacher') => {
    setRosterMode(nextMode);
    saveRosterModePreference(nextMode);
  };

  const handleUpdateGuestSession = (nextSession: GuestClassSession) => {
    setGuestSession(nextSession);
    saveGuestSession(nextSession);
  };

  const handleClearAllGuestData = () => {
    const fresh = clearAllGuestData();
    setGuestSession(fresh);
    setGuestHistory([]);
    setPickedResult(null);
    setPreviousResult(null);
  };

  const handleResetGuestCalledSession = () => {
    const updated: GuestClassSession = {
      ...guestSession,
      calledStudentIds: [],
    };
    handleUpdateGuestSession(updated);
    setPickedResult(null);
    setPreviousResult(null);
  };

  // Effective teacherId & class source isolated per mode
  const teacherId = rosterMode === 'guest' ? guestSession.guestSessionId : systemTeacherId;

  // Navigation Sub-Tabs within EDU Game Center
  const [activeSubTab, setActiveSubTab] = useState<'library' | 'creator' | 'my_games' | 'sessions' | 'history' | 'guide'>('library');

  // Category filter, Favorites & Sort in Library
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'ready' | 'recent'>('default');
  const [favoriteGameIds, setFavoriteGameIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(`taydo_edu_fav_games_${systemTeacherId}`);
      if (raw) return new Set(JSON.parse(raw));
    } catch {}
    return new Set(['a01', 'a02', 'a03', 'a04']);
  });

  const toggleFavoriteGame = (gameId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) next.delete(gameId);
      else next.add(gameId);
      try {
        localStorage.setItem(`taydo_edu_fav_games_${systemTeacherId}`, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Currently active running game
  const [activeGame, setActiveGame] = useState<EduGameItem | null>(null);

  // Class and Student Source (Teacher mode)
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(() => classes[0]?.id || 'manual');
  const [manualStudents] = useState<StudentCandidate[]>(() => loadCustomManualStudents(systemTeacherId));

  // Game Settings & States (Teacher mode)
  const [teacherAntiDuplicate, setTeacherAntiDuplicate] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Absent, Called, History state arrays/sets (Teacher mode)
  const [teacherAbsentIds, setTeacherAbsentIds] = useState<Set<string>>(() => new Set(loadAbsentIds(systemTeacherId, selectedSourceKey)));
  const [teacherCalledSessionIds, setTeacherCalledSessionIds] = useState<Set<string>>(() => new Set(loadCalledSessionIds(systemTeacherId, selectedSourceKey)));
  const [historyItems, setHistoryItems] = useState<CallHistoryItem[]>(() => loadCallHistory(systemTeacherId, selectedSourceKey));

  // Unified mode-aware getters & setters
  const antiDuplicate = rosterMode === 'guest' ? !guestSession.allowRepeat : teacherAntiDuplicate;
  const setAntiDuplicate = (val: boolean) => {
    if (rosterMode === 'guest') {
      handleUpdateGuestSession({ ...guestSession, allowRepeat: !val });
    } else {
      setTeacherAntiDuplicate(val);
    }
  };

  const absentIds = useMemo(() => {
    if (rosterMode === 'guest') {
      return new Set(guestSession.students.filter(s => !s.participating).map(s => s.guestStudentId));
    }
    return teacherAbsentIds;
  }, [rosterMode, guestSession.students, teacherAbsentIds]);

  const calledSessionIds = useMemo(() => {
    if (rosterMode === 'guest') {
      return new Set(guestSession.calledStudentIds);
    }
    return teacherCalledSessionIds;
  }, [rosterMode, guestSession.calledStudentIds, teacherCalledSessionIds]);

  // Candidates list (Guest mode vs Teacher mode)
  const currentCandidates = useMemo<StudentCandidate[]>(() => {
    if (rosterMode === 'guest') {
      return guestSession.students.map((s) => ({
        id: s.guestStudentId,
        code: String(s.stt).padStart(2, '0'),
        fullName: s.fullName,
      }));
    }
    if (selectedSourceKey === 'manual') {
      return manualStudents;
    }
    const foundClass = classes.find((c) => c.id === selectedSourceKey);
    if (!foundClass) return manualStudents;
    return mapClassStudentsToCandidates(foundClass);
  }, [rosterMode, guestSession.students, selectedSourceKey, classes, manualStudents]);

  const availableCandidates = useMemo(() => {
    return currentCandidates.filter((s) => !absentIds.has(s.id) && (!antiDuplicate || !calledSessionIds.has(s.id)));
  }, [currentCandidates, absentIds, antiDuplicate, calledSessionIds]);

  // Effective Classes list for child games
  const effectiveClasses = useMemo<ClassRoom[]>(() => {
    if (rosterMode === 'guest') {
      const guestClassRoom: ClassRoom = {
        id: 'guest_mode',
        name: guestSession.className || 'Lớp Khách',
        grade: '6',
        teacherName: 'Khách',
        schoolYear: '2025-2026',
        studentCount: guestSession.students.length,
        inviteCode: 'GUEST',
        students: guestSession.students.map((s) => ({
          id: s.guestStudentId,
          code: String(s.stt).padStart(2, '0'),
          fullName: s.fullName,
          email: '',
        })),
      };
      return [guestClassRoom, ...classes];
    }
    return classes;
  }, [rosterMode, guestSession.className, guestSession.students, classes]);

  const effectiveSourceKey = rosterMode === 'guest' ? 'guest_mode' : selectedSourceKey;
  const handleSelectEffectiveSourceKey = (key: string) => {
    if (key === 'guest_mode') {
      handleChangeRosterMode('guest');
    } else {
      handleChangeRosterMode('teacher');
      setSelectedSourceKey(key);
    }
  };

  // Resolved Class Name helper
  const resolvedClassName = useMemo(() => {
    if (rosterMode === 'guest') {
      return guestSession.className || 'Lớp Khách (Tự nhập)';
    }
    if (selectedSourceKey === 'manual') return 'Danh sách tự do';
    const found = classes.find((c) => c.id === selectedSourceKey);
    return found ? found.name : selectedSourceKey;
  }, [rosterMode, guestSession.className, selectedSourceKey, classes]);

  // Launch Game Request (opens GameRosterSetup if Guest Roster is empty or user opted not to share across games)
  const handleLaunchGameRequest = (game: EduGameItem) => {
    if (!game.isReady) {
      alert(
        `Trò chơi "${game.title}" (${game.code}) đang trong quá trình phát triển. Vui lòng trải nghiệm các trò chơi Nhóm A (A01–A12) và Nhóm B (B01–B06) đã sẵn sàng!`
      );
      return;
    }
    if (rosterMode === 'guest' && (guestSession.students.length === 0 || !guestSession.shareAcrossGames)) {
      setPendingGameToLaunch(game);
      setShowRosterSetupModal(true);
      return;
    }
    if (rosterMode === 'teacher' && currentCandidates.length === 0) {
      setPendingGameToLaunch(game);
      setShowRosterSetupModal(true);
      return;
    }
    setActiveGame(game);
  };

  // Modals
  const [showAbsentModal, setShowAbsentModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showTimerModal, setShowTimerModal] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [timerRemaining, setTimerRemaining] = useState<number>(30);

  // Picked Result & Previous Result for A02 distinction
  const [pickedResult, setPickedResult] = useState<StudentCandidate[] | null>(null);
  const [previousResult, setPreviousResult] = useState<StudentCandidate[] | null>(null);
  const [resultScoreNote, setResultScoreNote] = useState<string>('');
  const [isPlayingAnimation, setIsPlayingAnimation] = useState<boolean>(false);

  // Claw Machine State Machine & Coordinates
  const [clawPhase, setClawPhase] = useState<'IDLE' | 'MOVING' | 'LOWERING' | 'GRABBING' | 'LIFTING' | 'RETURNING' | 'DROPPING' | 'REVEALING'>('IDLE');
  const [clawTargetIndex, setClawTargetIndex] = useState<number>(0);
  const [heldCandidate, setHeldCandidate] = useState<StudentCandidate | null>(null);

  // Wheel specific rotation
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Gift Box State (A03)
  interface GiftBoxItem {
    id: string;
    student: StudentCandidate;
    isOpen: boolean;
    color: string;
    icon: string;
  }
  const GIFT_BOX_COLORS = ['bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-600', 'bg-purple-600', 'bg-pink-500', 'bg-cyan-600', 'bg-indigo-600'];
  const GIFT_BOX_ICONS = ['🎁', '⭐', '🎈', '🧸', '🍬', '🔮', '🏆', '💎'];

  const [giftBoxes, setGiftBoxes] = useState<GiftBoxItem[]>([]);
  const [giftBoxPhase, setGiftBoxPhase] = useState<'IDLE' | 'SHUFFLING' | 'GLOWING' | 'OPENING' | 'REVEALING'>('IDLE');
  const [activeGiftBoxIndex, setActiveGiftBoxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (activeGame?.modeKey === 'gift_box') {
      const shuffledStudents = [...currentCandidates].sort(() => Math.random() - 0.5);
      const boxes: GiftBoxItem[] = shuffledStudents.map((st, idx) => ({
        id: `box_${idx}_${st.id}`,
        student: st,
        isOpen: false,
        color: GIFT_BOX_COLORS[idx % GIFT_BOX_COLORS.length],
        icon: GIFT_BOX_ICONS[idx % GIFT_BOX_ICONS.length],
      }));
      setGiftBoxes(boxes);
      setGiftBoxPhase('IDLE');
      setActiveGiftBoxIndex(null);
    }
  }, [activeGame, currentCandidates]);

  const openGiftBox = (index: number) => {
    const box = giftBoxes[index];
    if (!box || box.isOpen || giftBoxPhase !== 'IDLE' || isPlayingAnimation) return;
    if (absentIds.has(box.student.id) || (antiDuplicate && calledSessionIds.has(box.student.id))) {
      alert('Học sinh này đã vắng hoặc đã được gọi trong phiên (chống trùng đang bật)!');
      return;
    }

    setPreviousResult(pickedResult);
    setPickedResult(null);
    setActiveGiftBoxIndex(index);
    setGiftBoxPhase('OPENING');
    setIsPlayingAnimation(true);
    sounds.playTick();

    window.setTimeout(() => {
      setGiftBoxPhase('REVEALING');
      setPickedResult([box.student]);
      setIsPlayingAnimation(false);
      setGiftBoxPhase('IDLE');
      sounds.playFanfare();

      setGiftBoxes((prev) =>
        prev.map((b, i) => (i === index ? { ...b, isOpen: true } : b))
      );

      if (rosterMode === 'guest') {
        const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, box.student.id]));
        handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
        const entry = appendGuestTurnHistory({
          guestSessionId: guestSession.guestSessionId,
          gameId: activeGame?.id || 'a03',
          gameCode: activeGame?.code || 'A03',
          gameTitle: activeGame?.title || 'Hộp quà bí ẩn',
          guestStudentId: box.student.id,
          studentName: box.student.fullName,
          className: resolvedClassName,
          status: 'CALLED',
        });
        setGuestHistory((prev) => [entry, ...prev]);
      } else {
        const newCalled = new Set(calledSessionIds);
        newCalled.add(box.student.id);
        setTeacherCalledSessionIds(newCalled);
        saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

        const historyItem: CallHistoryItem = {
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          timestamp: Date.now(),
          classId: selectedSourceKey,
          className: resolvedClassName,
          mode: 'gift_box',
          modeName: 'Hộp quà bí ẩn',
          selectedStudents: [box.student],
        };
        const updatedHistory = [historyItem, ...historyItems];
        setHistoryItems(updatedHistory);
        saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
      }
    }, 1200);
  };

  const systemPickGiftBox = () => {
    if (giftBoxPhase !== 'IDLE' || isPlayingAnimation) return;
    const unopenedIndices = giftBoxes
      .map((b, idx) => (!b.isOpen && !absentIds.has(b.student.id) && (!antiDuplicate || !calledSessionIds.has(b.student.id)) ? idx : -1))
      .filter((idx) => idx !== -1);

    if (unopenedIndices.length === 0) {
      alert('Tất cả hộp quà hợp lệ đã được mở! Vui lòng làm mới phiên gọi.');
      return;
    }

    setPreviousResult(pickedResult);
    setPickedResult(null);
    setIsPlayingAnimation(true);
    setGiftBoxPhase('GLOWING');

    let step = 0;
    const maxSteps = 10 + Math.floor(Math.random() * 5);
    const targetIdx = unopenedIndices[Math.floor(Math.random() * unopenedIndices.length)];

    const interval = window.setInterval(() => {
      step++;
      const randomGlowing = unopenedIndices[Math.floor(Math.random() * unopenedIndices.length)];
      setActiveGiftBoxIndex(randomGlowing);
      sounds.playTick();

      if (step >= maxSteps) {
        clearInterval(interval);
        setActiveGiftBoxIndex(targetIdx);
        setGiftBoxPhase('OPENING');
        sounds.playBell();

        window.setTimeout(() => {
          setGiftBoxPhase('REVEALING');
          const chosenBox = giftBoxes[targetIdx];
          setPickedResult([chosenBox.student]);
          setIsPlayingAnimation(false);
          setGiftBoxPhase('IDLE');
          sounds.playFanfare();

          setGiftBoxes((prev) =>
            prev.map((b, i) => (i === targetIdx ? { ...b, isOpen: true } : b))
          );

          if (rosterMode === 'guest') {
            const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, chosenBox.student.id]));
            handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
            const entry = appendGuestTurnHistory({
              guestSessionId: guestSession.guestSessionId,
              gameId: activeGame?.id || 'a03',
              gameCode: activeGame?.code || 'A03',
              gameTitle: activeGame?.title || 'Hộp quà bí ẩn',
              guestStudentId: chosenBox.student.id,
              studentName: chosenBox.student.fullName,
              className: resolvedClassName,
              status: 'CALLED',
            });
            setGuestHistory((prev) => [entry, ...prev]);
          } else {
            const newCalled = new Set(calledSessionIds);
            newCalled.add(chosenBox.student.id);
            setTeacherCalledSessionIds(newCalled);
            saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

            const historyItem: CallHistoryItem = {
              id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
              timestamp: Date.now(),
              classId: selectedSourceKey,
              className: resolvedClassName,
              mode: 'gift_box',
              modeName: 'Hộp quà bí ẩn',
              selectedStudents: [chosenBox.student],
            };
            const updatedHistory = [historyItem, ...historyItems];
            setHistoryItems(updatedHistory);
            saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
          }
        }, 1200);
      }
    }, 150);
  };

  const handleGamePickStudent = (
    chosen: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string }
  ) => {
    setPreviousResult(pickedResult);
    setPickedResult([chosen]);
    if (activeGame?.modeKey !== 'balloons') {
      sounds.playFanfare();
    }

    const noteParts = [
      meta?.bonusPoints && meta.bonusPoints > 0 ? `+${meta.bonusPoints}đ` : '',
      meta?.note?.trim() || '',
    ].filter(Boolean);

    if (rosterMode === 'guest') {
      const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, chosen.id]));
      handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
      const entry = appendGuestTurnHistory({
        guestSessionId: guestSession.guestSessionId,
        gameId: activeGame?.id || 'game',
        gameCode: activeGame?.code || 'A00',
        gameTitle: activeGame?.title || 'Trò chơi ngẫu nhiên',
        guestStudentId: chosen.id,
        studentName: chosen.fullName,
        className: resolvedClassName,
        status: 'CALLED',
        note: noteParts.length > 0 ? noteParts.join(' - ') : undefined,
      });
      setGuestHistory((prev) => [entry, ...prev]);
      return;
    }

    const newCalled = new Set(calledSessionIds);
    newCalled.add(chosen.id);
    setTeacherCalledSessionIds(newCalled);
    saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

    const historyItem: CallHistoryItem = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      classId: selectedSourceKey,
      className: resolvedClassName,
      mode: (activeGame?.modeKey as any) || 'wheel',
      modeName: activeGame?.title || 'Trò chơi ngẫu nhiên',
      selectedStudents: [chosen],
      scoreNote: noteParts.length > 0 ? noteParts.join(' - ') : undefined,
    };
    const updatedHistory = [historyItem, ...historyItems];
    setHistoryItems(updatedHistory);
    saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
  };

  const handleUpdateLatestHistoryNote = (noteText: string) => {
    setResultScoreNote(noteText);
    if (rosterMode === 'guest') return;
    setHistoryItems((prev) => {
      if (prev.length === 0) return prev;
      const updated = [{ ...prev[0], scoreNote: noteText }, ...prev.slice(1)];
      saveCallHistory(systemTeacherId, selectedSourceKey, updated);
      return updated;
    });
  };

  const handleResetActiveSession = () => {
    if (rosterMode === 'guest') {
      handleResetGuestCalledSession();
    } else {
      setTeacherCalledSessionIds(new Set());
      saveCalledSessionIds(systemTeacherId, selectedSourceKey, []);
      setPickedResult(null);
      setPreviousResult(null);
    }
  };

  const handleRestoreStudentToPool = (studentId: string) => {
    if (rosterMode === 'guest') {
      handleUpdateGuestSession({
        ...guestSession,
        calledStudentIds: guestSession.calledStudentIds.filter((id) => id !== studentId),
      });
    } else {
      setTeacherCalledSessionIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(next));
        return next;
      });
    }
  };

  // Reload persistence when class source changes
  useEffect(() => {
    setHistoryItems(loadCallHistory(systemTeacherId, selectedSourceKey));
    setTeacherAbsentIds(new Set(loadAbsentIds(systemTeacherId, selectedSourceKey)));
    setTeacherCalledSessionIds(new Set(loadCalledSessionIds(systemTeacherId, selectedSourceKey)));
    setPickedResult(null);
    setPreviousResult(null);
    setClawPhase('IDLE');
    setHeldCandidate(null);
  }, [systemTeacherId, selectedSourceKey]);

  // Timer effect
  useEffect(() => {
    let interval: number | null = null;
    if (timerRunning && timerRemaining > 0) {
      interval = window.setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setTimerRunning(false);
            sounds.playBell();
            return 0;
          }
          if (prev <= 5) sounds.playTimerBeep();
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerRemaining]);

  // Real statistics from catalog & history
  const totalGamesCount = EDU_GAMES_CATALOG.length;
  const readyGamesCount = useMemo(() => EDU_GAMES_CATALOG.filter((g) => g.isReady).length, []);
  const usedGamesCount = useMemo(() => {
    const modesUsed = new Set(historyItems.map((h) => h.mode));
    return modesUsed.size;
  }, [historyItems]);

  // Filtered & sorted games in library
  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = EDU_GAMES_CATALOG.filter((g) => {
      const matchCat = selectedCategory === 'all' || g.category === selectedCategory;
      const matchFav = !onlyFavorites || favoriteGameIds.has(g.id);
      const matchQuery =
        !q ||
        g.title.toLowerCase().includes(q) ||
        g.code.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.categoryLabel.toLowerCase().includes(q);
      return matchCat && matchFav && matchQuery;
    });

    if (sortBy === 'name') {
      return [...list].sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    }
    if (sortBy === 'ready') {
      return [...list].sort((a, b) => Number(b.isReady) - Number(a.isReady));
    }
    if (sortBy === 'recent') {
      const recentModes = historyItems.map((h) => h.mode);
      return [...list].sort((a, b) => {
        const idxA = recentModes.indexOf(a.modeKey as any);
        const idxB = recentModes.indexOf(b.modeKey as any);
        const scoreA = idxA === -1 ? 999 : idxA;
        const scoreB = idxB === -1 ? 999 : idxB;
        return scoreA - scoreB;
      });
    }
    return list;
  }, [selectedCategory, searchQuery, onlyFavorites, favoriteGameIds, sortBy, historyItems]);

  // Featured top 4 games (shown when in 'all' view without search/favorites filter)
  const showFeaturedSection = selectedCategory === 'all' && !searchQuery.trim() && !onlyFavorites;
  const featuredGames = useMemo(() => {
    return EDU_GAMES_CATALOG.filter((g) => g.isReady).slice(0, 4);
  }, []);

  // Main list excludes featured games when featured section is visible (no duplication)
  const mainGridGames = useMemo(() => {
    if (!showFeaturedSection) return filteredGames;
    const featuredIds = new Set(featuredGames.map((g) => g.id));
    return filteredGames.filter((g) => !featuredIds.has(g.id));
  }, [filteredGames, showFeaturedSection, featuredGames]);

  // Handle pick random students for general games
  const handlePickStudents = (count: number = 1) => {
    if (availableCandidates.length === 0) {
      alert('Tất cả học sinh trong danh sách đã được gọi hoặc vắng mặt! Vui lòng làm mới phiên gọi.');
      return;
    }

    setPreviousResult(pickedResult);
    setPickedResult(null);
    setIsPlayingAnimation(true);
    sounds.playTick();

    const timer = window.setTimeout(() => {
      const shuffled = [...availableCandidates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, Math.min(count, shuffled.length));

      setPickedResult(selected);
      setIsPlayingAnimation(false);
      sounds.playFanfare();

      if (rosterMode === 'guest') {
        const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, ...selected.map((s) => s.id)]));
        handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
        selected.forEach((st) => {
          const entry = appendGuestTurnHistory({
            guestSessionId: guestSession.guestSessionId,
            gameId: activeGame?.id || 'random',
            gameCode: activeGame?.code || 'A00',
            gameTitle: activeGame?.title || 'Gọi ngẫu nhiên',
            guestStudentId: st.id,
            studentName: st.fullName,
            className: resolvedClassName,
            status: 'CALLED',
          });
          setGuestHistory((prev) => [entry, ...prev]);
        });
      } else {
        const newCalled = new Set(calledSessionIds);
        selected.forEach((s) => newCalled.add(s.id));
        setTeacherCalledSessionIds(newCalled);
        saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

        const historyItem: CallHistoryItem = {
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          timestamp: Date.now(),
          classId: selectedSourceKey,
          className: resolvedClassName,
          mode: (activeGame?.modeKey as any) || 'wheel',
          modeName: activeGame?.title || 'Gọi ngẫu nhiên',
          selectedStudents: selected,
        };

        const updatedHistory = [historyItem, ...historyItems];
        setHistoryItems(updatedHistory);
        saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
      }
    }, 1800);

    return () => clearTimeout(timer);
  };

  // Claw Machine Precise State Machine Sequence (A02)
  const startClawMachine = () => {
    if (clawPhase !== 'IDLE' || isPlayingAnimation) return;
    if (availableCandidates.length === 0) {
      alert('Tất cả học sinh trong danh sách đã được gọi hoặc vắng mặt! Vui lòng làm mới phiên gọi.');
      return;
    }

    // Preserve previous result and hide current result during grab
    setPreviousResult(pickedResult);
    setPickedResult(null);
    setHeldCandidate(null);
    setIsPlayingAnimation(true);

    // Pick eligible student candidate
    const shuffled = [...availableCandidates].sort(() => Math.random() - 0.5);
    const chosen = shuffled[0];
    const targetIdx = currentCandidates.findIndex(c => c.id === chosen.id);
    const safeTargetIdx = targetIdx >= 0 ? targetIdx : 0;

    setClawTargetIndex(safeTargetIdx);
    setClawPhase('MOVING');
    sounds.playTick();

    // Step 4: Move horizontal to toy (1000ms)
    window.setTimeout(() => {
      setClawPhase('LOWERING');
      sounds.playTick();

      // Step 5 & 6: Lower & Grab (1000ms)
      window.setTimeout(() => {
        setClawPhase('GRABBING');
        setHeldCandidate(chosen);
        sounds.playTick();

        // Step 7 & 8: Lift up (800ms)
        window.setTimeout(() => {
          setClawPhase('LIFTING');
          sounds.playTick();

          // Step 9: Return to prize chute (1000ms)
          window.setTimeout(() => {
            setClawPhase('RETURNING');
            sounds.playTick();

            // Step 10: Drop into chute (800ms)
            window.setTimeout(() => {
              setClawPhase('DROPPING');
              setHeldCandidate(null);
              sounds.playBell();

              // Step 11 & 12: Reveal result & save history
              window.setTimeout(() => {
                setClawPhase('REVEALING');
                setPickedResult([chosen]);
                setIsPlayingAnimation(false);
                setClawPhase('IDLE');
                sounds.playFanfare();

                if (rosterMode === 'guest') {
                  const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, chosen.id]));
                  handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
                  const entry = appendGuestTurnHistory({
                    guestSessionId: guestSession.guestSessionId,
                    gameId: 'a02',
                    gameCode: 'A02',
                    gameTitle: 'Máy gắp thú',
                    guestStudentId: chosen.id,
                    studentName: chosen.fullName,
                    className: resolvedClassName,
                    status: 'CALLED',
                  });
                  setGuestHistory((prev) => [entry, ...prev]);
                } else {
                  const newCalled = new Set(calledSessionIds);
                  newCalled.add(chosen.id);
                  setTeacherCalledSessionIds(newCalled);
                  saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

                  const historyItem: CallHistoryItem = {
                    id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                    timestamp: Date.now(),
                    classId: selectedSourceKey,
                    className: resolvedClassName,
                    mode: 'claw_machine',
                    modeName: 'Máy gắp thú',
                    selectedStudents: [chosen],
                  };
                  const updatedHistory = [historyItem, ...historyItems];
                  setHistoryItems(updatedHistory);
                  saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
                }
              }, 600);
            }, 800);
          }, 1000);
        }, 800);
      }, 1000);
    }, 1000);
  };

  // Render Wheel Canvas
  useEffect(() => {
    if (!activeGame || activeGame.modeKey !== 'wheel') return;
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 15;

    ctx.clearRect(0, 0, width, height);

    const list = currentCandidates.length > 0 ? currentCandidates : [{ id: '1', code: '01', fullName: 'Chưa có học sinh' }];
    const sliceAngle = (2 * Math.PI) / list.length;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelRotation);

    list.forEach((item, i) => {
      const startAngle = i * sliceAngle;
      const endAngle = (i + 1) * sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = SLICE_COLORS[i % SLICE_COLORS.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(item.fullName.length > 14 ? item.fullName.substring(0, 12) + '...' : item.fullName, radius - 20, 5);
      ctx.restore();
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#1E3A8A';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FBBF24';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPIN', cx, cy);
  }, [activeGame, currentCandidates, wheelRotation]);

  const spinWheel = () => {
    if (isPlayingAnimation || availableCandidates.length === 0) return;
    setPreviousResult(pickedResult);
    setPickedResult(null);
    setIsPlayingAnimation(true);
    sounds.playTick();

    const extraRounds = 5 + Math.floor(Math.random() * 4);
    const targetIndex = Math.floor(Math.random() * currentCandidates.length);
    const sliceAngle = (2 * Math.PI) / currentCandidates.length;
    const targetRad = wheelRotation + extraRounds * 2 * Math.PI + (2 * Math.PI - targetIndex * sliceAngle - sliceAngle / 2);

    setWheelRotation(targetRad);

    const timer = window.setTimeout(() => {
      setIsPlayingAnimation(false);
      const chosen = currentCandidates[targetIndex];
      setPickedResult([chosen]);
      sounds.playFanfare();

      if (rosterMode === 'guest') {
        const nextCalled = Array.from(new Set([...guestSession.calledStudentIds, chosen.id]));
        handleUpdateGuestSession({ ...guestSession, calledStudentIds: nextCalled });
        const entry = appendGuestTurnHistory({
          guestSessionId: guestSession.guestSessionId,
          gameId: 'a01',
          gameCode: 'A01',
          gameTitle: 'Vòng quay may mắn',
          guestStudentId: chosen.id,
          studentName: chosen.fullName,
          className: resolvedClassName,
          status: 'CALLED',
        });
        setGuestHistory((prev) => [entry, ...prev]);
      } else {
        const newCalled = new Set(calledSessionIds);
        newCalled.add(chosen.id);
        setTeacherCalledSessionIds(newCalled);
        saveCalledSessionIds(systemTeacherId, selectedSourceKey, Array.from(newCalled));

        const historyItem: CallHistoryItem = {
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          timestamp: Date.now(),
          classId: selectedSourceKey,
          className: resolvedClassName,
          mode: 'wheel',
          modeName: 'Vòng quay may mắn',
          selectedStudents: [chosen],
        };
        const updatedHistory = [historyItem, ...historyItems];
        setHistoryItems(updatedHistory);
        saveCallHistory(systemTeacherId, selectedSourceKey, updatedHistory);
      }
    }, 3000);

    return () => clearTimeout(timer);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto space-y-5 font-sans text-[#10213D]">
      {/* 1. Top Horizontal Navigation Bar (matches reference mockup) */}
      <div className="bg-white rounded-2xl px-4 py-2.5 border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {[
            { id: 'library', label: 'Thư viện trò chơi', icon: Gamepad2 },
            { id: 'creator', label: 'Tạo trò chơi', icon: PlusCircle },
            { id: 'my_games', label: 'Trò chơi của tôi', icon: Star },
            { id: 'sessions', label: 'Quản lý phiên chơi', icon: Users },
            { id: 'history', label: 'Lịch sử & thống kê', icon: BarChart2 },
            { id: 'guide', label: 'Hướng dẫn', icon: HelpCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  if (tab.id === 'library') setActiveGame(null);
                }}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-bold flex items-center gap-2 transition-all duration-200 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0866F5] to-[#174CA8] text-white shadow-md shadow-blue-500/25'
                    : 'text-[#10213D] hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-[#10213D] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 text-[#00BF83]" />}
            <span>{isMuted ? 'Tắt âm' : 'Âm thanh'}</span>
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-1.5 bg-blue-50 text-[#0866F5] hover:bg-blue-100 rounded-full transition-colors text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Lịch sử ({historyItems.length})</span>
          </button>
        </div>
      </div>

      {/* 2. Premium 3D EDU GAME CENTER Banner (hidden while an active game stage is open) */}
      {!activeGame && (
        <>
          <div className="relative bg-gradient-to-r from-[#102C52] via-[#174CA8] to-[#102C52] rounded-[24px] px-5 py-4 sm:px-7 sm:py-5 text-white shadow-[0_14px_34px_-10px_rgba(16,44,82,0.45)] overflow-hidden border border-sky-300/25">
        {/* Studio Lighting & Subtle Ambient Bokeh */}
        <div className="absolute -left-8 -bottom-10 w-52 h-32 bg-[#20C9FF]/20 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute left-1/3 -top-12 w-80 h-40 bg-[#0866F5]/30 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-10 w-64 h-32 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-5">
          {/* Left 3D Gamepad + Center 3D Golden Title + Right-Center 3D Trophy & Textbooks */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-center sm:text-left">
            <BannerGamepadSVG className="w-24 h-24 sm:w-28 sm:h-28 shrink-0" />

            <div className="flex flex-col items-center sm:items-start">
              <h1
                className="text-2xl sm:text-3xl md:text-4xl font-black tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-b from-[#FFF7D6] via-[#FFBF25] to-[#D97706] drop-shadow-[0_3px_6px_rgba(0,0,0,0.5)]"
              >
                EDU GAME CENTER
              </h1>
              <div className="mt-2 px-5 py-1.5 bg-gradient-to-r from-[#FFBF25] via-[#FFD452] to-[#F59E0B] text-[#10213D] rounded-full shadow-[0_4px_12px_rgba(255,191,37,0.35)] border border-yellow-100/80">
                <p className="text-xs sm:text-sm font-extrabold tracking-tight">
                  Thế giới trò chơi tương tác – Tây Đô Smart EDU
                </p>
              </div>
            </div>

            <BannerTrophyBooksSVG className="hidden md:block w-28 h-24 sm:w-32 sm:h-26 shrink-0" />
          </div>

          {/* Right 4 3D Glossy Stat Cards (Real Data) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full xl:w-auto shrink-0">
            <div className="bg-gradient-to-b from-[#7C3AED]/85 to-[#312E81]/90 backdrop-blur-xs rounded-2xl px-4 py-2.5 border border-purple-300/45 flex flex-col items-center justify-center min-w-[106px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_8px_16px_rgba(0,0,0,0.25)]">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center mb-1">
                <Gamepad2 className="w-4 h-4 text-pink-200" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-white leading-tight tabular-nums">{totalGamesCount}</span>
              <span className="text-[11px] text-purple-100 font-bold">Trò chơi</span>
            </div>

            <div className="bg-gradient-to-b from-[#00BF83]/85 to-[#065F46]/90 backdrop-blur-xs rounded-2xl px-4 py-2.5 border border-emerald-300/45 flex flex-col items-center justify-center min-w-[106px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_8px_16px_rgba(0,0,0,0.25)]">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-white leading-tight tabular-nums">{readyGamesCount}</span>
              <span className="text-[11px] text-emerald-50 font-bold">Sẵn sàng</span>
            </div>

            <div className="bg-gradient-to-b from-[#6D28D9]/85 to-[#1E1B4B]/90 backdrop-blur-xs rounded-2xl px-4 py-2.5 border border-violet-300/45 flex flex-col items-center justify-center min-w-[106px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_8px_16px_rgba(0,0,0,0.25)]">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center mb-1">
                <Star className="w-4 h-4 text-[#FFBF25] fill-[#FFBF25]" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-white leading-tight tabular-nums">{favoriteGameIds.size}</span>
              <span className="text-[11px] text-violet-100 font-bold">Yêu thích</span>
            </div>

            <div className="bg-gradient-to-b from-[#0866F5]/85 to-[#102C52]/95 backdrop-blur-xs rounded-2xl px-4 py-2.5 border border-sky-300/45 flex flex-col items-center justify-center min-w-[106px] shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_8px_16px_rgba(0,0,0,0.25)]">
              <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center mb-1">
                <Clock className="w-4 h-4 text-sky-100" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-white leading-tight tabular-nums">{usedGamesCount}</span>
              <span className="text-[11px] text-sky-100 font-bold">Đã sử dụng</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 SHARED GUEST MODE & TEACHER MODE PREPARATION BAR */}
      <div className="bg-white rounded-[20px] p-4 sm:px-6 border border-slate-200/90 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleChangeRosterMode('guest')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                rosterMode === 'guest'
                  ? 'bg-[#0866F5] text-white shadow-sm'
                  : 'bg-[#F3F7FD] text-[#10213D] hover:bg-slate-200/80'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Chế độ Khách (Tự nhập DS · Không cần đăng nhập)</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeRosterMode('teacher')}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                rosterMode === 'teacher'
                  ? 'bg-[#0866F5] text-white shadow-sm'
                  : 'bg-[#F3F7FD] text-[#10213D] hover:bg-slate-200/80'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Chế độ Giáo viên (Dữ liệu hệ thống)</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            <span className="px-3.5 py-1 rounded-full bg-[#F3F7FD] text-[#10213D] font-bold border border-blue-200">
              Lớp: <strong className="text-[#0866F5]">{resolvedClassName}</strong>
            </span>
            <span className="px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 tabular-nums">
              Sĩ số: {currentCandidates.length} HS · Sẵn sàng: {availableCandidates.length} HS
            </span>
            {calledSessionIds.size > 0 && (
              <span className="px-3.5 py-1 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 tabular-nums">
                Đã gọi: {calledSessionIds.size} HS
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setPendingGameToLaunch(null);
              setShowRosterSetupModal(true);
            }}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#0866F5] to-[#174CA8] hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition-all duration-200 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>
              {rosterMode === 'guest'
                ? 'Chuẩn bị trò chơi / Nhập danh sách HS (Excel, Dán, Tự nhập)'
                : 'Chuẩn bị trò chơi / Đổi lớp hệ thống'}
            </span>
          </button>

          {calledSessionIds.size > 0 && (
            <button
              type="button"
              onClick={handleResetActiveSession}
              className="px-3.5 py-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm mới lượt gọi</span>
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {/* 3. Main Library Content Area */}
      {activeSubTab === 'library' && !activeGame && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Categories Sidebar + Class Selector */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-[20px] p-4 border border-slate-200/90 shadow-xs space-y-3">
              <h3 className="text-xs font-extrabold text-[#10213D] uppercase tracking-wider px-2 pt-1">
                DANH MỤC TRÒ CHƠI
              </h3>
              <div className="space-y-1">
                {EDU_GAME_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.key;
                  const meta = CATEGORY_META[cat.key] || CATEGORY_META.all;
                  const Icon = meta.icon;

                  return (
                    <button
                      key={cat.key}
                      onClick={() => setSelectedCategory(cat.key)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer ${
                        isSelected
                          ? 'bg-[#0866F5] text-white shadow-sm'
                          : 'text-[#10213D] hover:bg-[#F3F7FD]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : meta.color}`} />
                        <span className="truncate">{cat.label}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums ${
                          isSelected ? 'bg-white text-[#0866F5]' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Class Selector Card */}
            <div className="bg-white rounded-[20px] p-4 border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-extrabold text-[#10213D]">
                  {rosterMode === 'guest' ? 'Danh sách Khách đang dùng' : 'Lớp hệ thống đang áp dụng'}
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#0866F5]">
                  {rosterMode === 'guest' ? 'Chế độ Khách' : 'Giáo viên'}
                </span>
              </div>

              {rosterMode === 'guest' ? (
                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-[#F3F7FD] border border-blue-200 text-xs space-y-1">
                    <div className="font-bold text-[#10213D]">{resolvedClassName}</div>
                    <div className="text-slate-600 tabular-nums">
                      Tổng số: <strong>{guestSession.students.length}</strong> học sinh · Tham gia:{' '}
                      <strong>{guestSession.students.filter((s) => s.participating).length}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingGameToLaunch(null);
                      setShowRosterSetupModal(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#0866F5] hover:bg-[#174CA8] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Nhập / Dán danh sách học sinh</span>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedSourceKey}
                    onChange={(e) => setSelectedSourceKey(e.target.value)}
                    className="w-full text-xs sm:text-sm font-bold px-3.5 py-2.5 bg-[#F3F7FD] border border-slate-200 rounded-xl text-[#10213D] focus:outline-none focus:ring-2 focus:ring-[#0866F5]"
                  >
                    <option value="manual">-- Danh sách nhập tự do ({manualStudents.length} HS) --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.students?.length || 0} học sinh)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="bg-[#F3F7FD] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#00BF83]" />
                  <span>Sẵn sàng: <strong className="tabular-nums">{availableCandidates.length}</strong> bạn</span>
                </span>
                <button
                  onClick={() =>
                    rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true)
                  }
                  className="text-[#0866F5] hover:underline font-extrabold tabular-nums cursor-pointer"
                >
                  {rosterMode === 'guest' ? `Tạm nghỉ (${absentIds.size})` : `Vắng (${absentIds.size})`}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Search/Filter Bar, Featured Row, and Main Game Cards Grid */}
          <div className="lg:col-span-9 space-y-6">
            {/* Search & Filter Controls Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm tên, mã hoặc mô tả trò chơi (VD: A01, vòng quay, đua ngựa...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-full shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0866F5]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Category Filter Dropdown */}
                <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-2 shadow-2xs">
                  <Filter className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="text-xs font-bold text-[#10213D] bg-transparent focus:outline-none pr-1 cursor-pointer"
                  >
                    {EDU_GAME_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.key === 'all' ? 'Nhóm trò: Tất cả' : c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Favorites Filter Pill Button */}
                <button
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-all duration-150 shadow-2xs cursor-pointer ${
                    onlyFavorites
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'bg-white border-slate-200/90 text-[#10213D] hover:bg-slate-50'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'text-[#FFBF25] fill-[#FFBF25]' : 'text-[#FFBF25] fill-[#FFBF25]'}`} />
                  <span>Yêu thích</span>
                </button>

                {/* Sort Select */}
                <div className="relative flex items-center bg-white border border-slate-200/90 rounded-full px-3.5 py-2 shadow-2xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-xs font-bold text-[#10213D] bg-transparent focus:outline-none pr-1 cursor-pointer"
                  >
                    <option value="default">Sắp xếp: Mặc định</option>
                    <option value="ready">Sẵn sàng trước</option>
                    <option value="name">Theo tên (A-Z)</option>
                    <option value="recent">Sử dụng gần đây</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Featured Section: 4 Top Games in 1 Row (only shown in default All view) */}
            {showFeaturedSection && (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#10213D] flex items-center gap-2">
                    <Star className="w-5 h-5 text-[#FFBF25] fill-[#FFBF25]" />
                    <span>Trò chơi nổi bật & gợi ý hàng đầu</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {featuredGames.map((game) => {
                    const isFav = favoriteGameIds.has(game.id);
                    return (
                      <div
                        key={`featured_${game.id}`}
                        className="bg-white rounded-[18px] border border-slate-200/90 hover:border-[#0866F5]/60 shadow-[0_4px_14px_rgba(16,33,61,0.06)] hover:shadow-[0_14px_28px_rgba(8,102,245,0.14)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:transform-none transition-all duration-200 ease-out flex flex-col justify-between overflow-hidden group h-full"
                      >
                        {/* 4:3 Photorealistic 3D Thumbnail */}
                        <div
                          onClick={() => handleLaunchGameRequest(game)}
                          className="relative aspect-4/3 w-full overflow-hidden cursor-pointer bg-[#102C52]"
                        >
                          <div className="w-full h-full group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 transition-transform duration-200 ease-out">
                            <GameCardIllustration code={game.code} category={game.category} />
                          </div>
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-[#10213D]/85 backdrop-blur-xs text-white rounded-full text-[11px] font-extrabold tracking-wide shadow-xs">
                            {game.code}
                          </span>
                          <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 bg-[#00BF83] text-white rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-xs">
                            <CheckCircle2 className="w-3 h-3" /> Sẵn sàng
                          </span>
                        </div>

                        {/* Card Body */}
                        <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h4
                              onClick={() => handleLaunchGameRequest(game)}
                              className="text-sm sm:text-[15px] font-extrabold text-[#10213D] group-hover:text-[#0866F5] transition-colors truncate cursor-pointer"
                            >
                              {game.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-1">
                              <Trophy className="w-3.5 h-3.5 text-[#FFBF25] shrink-0" />
                              <span className="truncate">{game.categoryLabel}</span>
                            </div>
                          </div>

                          <div className="pt-0.5 flex items-center gap-2">
                            <button
                              onClick={() => handleLaunchGameRequest(game)}
                              className="flex-1 py-2 px-3 bg-gradient-to-r from-[#0866F5] to-[#174CA8] group-hover:brightness-110 text-white rounded-full text-xs font-extrabold shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Chơi ngay</span>
                            </button>
                            <button
                              onClick={(e) => toggleFavoriteGame(game.id, e)}
                              title="Yêu thích"
                              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                isFav
                                  ? 'border-rose-200 bg-rose-50 text-rose-500'
                                  : 'border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Games List Section (Remaining games without repeating Featured) */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-extrabold text-[#10213D] flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-[#0866F5]" />
                  <span>
                    {selectedCategory === 'all'
                      ? 'Danh sách trò chơi'
                      : EDU_GAME_CATEGORIES.find((c) => c.key === selectedCategory)?.label || 'Danh sách trò chơi'}
                  </span>
                </h3>
                <div className="text-xs text-slate-500 font-bold tabular-nums">
                  Hiển thị <span className="text-[#10213D] font-extrabold">{filteredGames.length}</span> / {totalGamesCount} trò chơi
                </div>
              </div>

              {mainGridGames.length === 0 ? (
                <div className="bg-white rounded-[20px] p-10 border border-slate-200 text-center space-y-2">
                  <p className="text-sm font-bold text-[#10213D]">Không tìm thấy trò chơi phù hợp</p>
                  <p className="text-xs text-slate-500">Hãy thử từ khóa khác hoặc bỏ bộ lọc Yêu thích.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {mainGridGames.map((game) => {
                    const isFav = favoriteGameIds.has(game.id);
                    return (
                      <div
                        key={game.id}
                        className="bg-white rounded-[18px] border border-slate-200/90 hover:border-[#0866F5]/60 shadow-[0_4px_14px_rgba(16,33,61,0.06)] hover:shadow-[0_14px_28px_rgba(8,102,245,0.14)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:transform-none transition-all duration-200 ease-out flex flex-col justify-between overflow-hidden group h-full"
                      >
                        {/* 4:3 Custom 3D Thumbnail */}
                        <div
                          onClick={() => handleLaunchGameRequest(game)}
                          className="relative aspect-4/3 w-full overflow-hidden cursor-pointer bg-[#102C52]"
                        >
                          <div className="w-full h-full group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 transition-transform duration-200 ease-out">
                            <GameCardIllustration code={game.code} category={game.category} />
                          </div>
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-[#10213D]/85 backdrop-blur-xs text-white rounded-full text-[11px] font-extrabold tracking-wide shadow-xs">
                            {game.code}
                          </span>
                          {game.isReady ? (
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 bg-[#00BF83] text-white rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3" /> Sẵn sàng
                            </span>
                          ) : (
                            <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 bg-amber-500/95 text-white rounded-full text-[10px] font-extrabold flex items-center gap-1 shadow-xs">
                              <AlertCircle className="w-3 h-3" /> Đang phát triển
                            </span>
                          )}
                        </div>

                        {/* Card Body */}
                        <div className="p-3.5 space-y-3 flex-1 flex flex-col justify-between">
                          <div>
                            <h4
                              onClick={() => handleLaunchGameRequest(game)}
                              className="text-sm sm:text-[15px] font-extrabold text-[#10213D] group-hover:text-[#0866F5] transition-colors truncate cursor-pointer"
                            >
                              {game.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold mt-1">
                              <Trophy className="w-3.5 h-3.5 text-[#FFBF25] shrink-0" />
                              <span className="truncate">{game.categoryLabel}</span>
                            </div>
                          </div>

                          <div className="pt-0.5 flex items-center gap-2">
                            {game.isReady ? (
                              <button
                                onClick={() => handleLaunchGameRequest(game)}
                                className="flex-1 py-2 px-3 bg-gradient-to-r from-[#0866F5] to-[#174CA8] group-hover:brightness-110 text-white rounded-full text-xs font-extrabold shadow-xs transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Chơi ngay</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLaunchGameRequest(game)}
                                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Đang phát triển</span>
                              </button>
                            )}
                            <button
                              onClick={(e) => toggleFavoriteGame(game.id, e)}
                              title="Yêu thích"
                              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                                isFav
                                  ? 'border-rose-200 bg-rose-50 text-rose-500'
                                  : 'border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50/50'
                              }`}
                            >
                              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Game Running Stage */}
      {activeGame && (
        <div
          ref={stageContainerRef}
          className={
            isFullscreen &&
            (activeGame.modeKey === 'wheel' ||
              activeGame.modeKey === 'claw_machine' ||
              activeGame.modeKey === 'gift_box' ||
              activeGame.modeKey === 'cards' ||
              activeGame.modeKey === 'duck_race')
              ? 'fixed inset-0 z-50 w-screen h-dvh bg-[#050C1C] p-0 m-0 border-0 rounded-none overflow-hidden flex flex-col'
              : 'bg-white rounded-2xl border border-slate-200 shadow-md p-3 sm:p-4 space-y-3'
          }
        >
          {!(
            isFullscreen &&
            (activeGame.modeKey === 'wheel' ||
              activeGame.modeKey === 'claw_machine' ||
              activeGame.modeKey === 'gift_box' ||
              activeGame.modeKey === 'cards' ||
              activeGame.modeKey === 'duck_race')
          ) && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    if (isFullscreen) {
                      document.exitFullscreen?.().catch(() => {});
                      setIsFullscreen(false);
                    }
                    setActiveGame(null);
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  ← Trở về thư viện
                </button>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-100 text-[#006BFF] rounded text-[11px] font-bold">
                    {activeGame.code}
                  </span>
                  <h2 className="text-base sm:text-lg font-extrabold text-[#0F2D52]">{activeGame.title}</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPendingGameToLaunch(null);
                    setShowRosterSetupModal(true);
                  }}
                  className="px-3 py-1.5 bg-[#EAF4FF] text-[#006BFF] hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>
                    {rosterMode === 'guest'
                      ? `DS Khách: ${resolvedClassName} (${availableCandidates.length}/${currentCandidates.length} HS)`
                      : `Đổi danh sách / Lớp (${resolvedClassName})`}
                  </span>
                </button>
                <button
                  onClick={() => setShowTimerModal(true)}
                  className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <TimerIcon className="w-3.5 h-3.5 text-amber-600" />
                  <span>Hẹn giờ ({timerSeconds}s)</span>
                </button>
                <button
                  onClick={() => {
                    if (!stageContainerRef.current) return;
                    if (!isFullscreen) {
                      stageContainerRef.current.requestFullscreen?.().catch(() => {});
                      setIsFullscreen(true);
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                      setIsFullscreen(false);
                    }
                  }}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer"
                  title="Phóng to toàn màn hình"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {activeGame.modeKey === 'wheel' ? (
            <React.Suspense
              fallback={
                <div className="w-full min-h-[540px] rounded-3xl bg-[#071126] border-2 border-amber-400/40 flex flex-col items-center justify-center text-white p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
                  <p className="text-base font-extrabold text-amber-300">
                    Đang khởi tạo sân khấu Vòng quay 3D (WebGL Studio)...
                  </p>
                </div>
              }
            >
              <StudentWheel3DGame
                availableCandidates={availableCandidates}
                allCandidates={currentCandidates}
                absentIds={absentIds}
                calledSessionIds={calledSessionIds}
                antiDuplicate={antiDuplicate}
                onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
                onResetSession={handleResetActiveSession}
                onRestoreStudentToPool={handleRestoreStudentToPool}
                classes={effectiveClasses}
                selectedSourceKey={effectiveSourceKey}
                onSelectSourceKey={handleSelectEffectiveSourceKey}
                resolvedClassName={resolvedClassName}
                teacherId={teacherId}
                teacherName={userProfile?.fullName || (rosterMode === 'guest' ? 'Khách' : 'Giáo viên')}
                userRole={currentRole}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  if (!stageContainerRef.current) return;
                  if (!isFullscreen) {
                    stageContainerRef.current.requestFullscreen?.();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen?.();
                    setIsFullscreen(false);
                  }
                }}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
                onOpenHistoryModal={() => setShowHistoryModal(true)}
                onPick={handleGamePickStudent}
                onUpdateLatestNote={handleUpdateLatestHistoryNote}
              />
            </React.Suspense>
          ) : activeGame.modeKey === 'claw_machine' ? (
            <React.Suspense
              fallback={
                <div className="w-full min-h-[560px] rounded-3xl bg-[#050C1C] border-2 border-cyan-400/50 flex flex-col items-center justify-center text-white p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-cyan-400 border-t-transparent animate-spin" />
                  <p className="text-base font-extrabold text-amber-300">
                    Đang khởi tạo Máy Gắp Học Sinh 3D (WebGL Arcade Studio)...
                  </p>
                </div>
              }
            >
              <ClawMachine3DGame
                availableCandidates={availableCandidates}
                allCandidates={currentCandidates}
                absentIds={absentIds}
                calledSessionIds={calledSessionIds}
                antiDuplicate={antiDuplicate}
                onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
                onResetSession={handleResetActiveSession}
                onRestoreStudentToPool={handleRestoreStudentToPool}
                classes={effectiveClasses}
                selectedSourceKey={effectiveSourceKey}
                onSelectSourceKey={handleSelectEffectiveSourceKey}
                resolvedClassName={resolvedClassName}
                teacherId={teacherId}
                teacherName={userProfile?.fullName || (rosterMode === 'guest' ? 'Khách' : 'Giáo viên')}
                userRole={currentRole}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  if (!stageContainerRef.current) return;
                  if (!isFullscreen) {
                    stageContainerRef.current.requestFullscreen?.();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen?.();
                    setIsFullscreen(false);
                  }
                }}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
                onOpenHistoryModal={() => setShowHistoryModal(true)}
                onPick={handleGamePickStudent}
                onUpdateLatestNote={handleUpdateLatestHistoryNote}
              />
            </React.Suspense>
          ) : activeGame.modeKey === 'gift_box' ? (
            <React.Suspense
              fallback={
                <div className="w-full min-h-[560px] rounded-3xl bg-[#071B38] border-2 border-[#F5C45E]/50 flex flex-col items-center justify-center text-white p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-[#F5C45E] border-t-transparent animate-spin" />
                  <p className="text-base font-extrabold text-[#F5C45E]">
                    Đang khởi tạo Sân khấu Hộp Quà Bí Mật 3D (WebGL Gift Show)...
                  </p>
                </div>
              }
            >
              <MysteryGiftBox3DGame
                availableCandidates={availableCandidates}
                allCandidates={currentCandidates}
                absentIds={absentIds}
                calledSessionIds={calledSessionIds}
                antiDuplicate={antiDuplicate}
                onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
                onResetSession={handleResetActiveSession}
                onRestoreStudentToPool={handleRestoreStudentToPool}
                classes={effectiveClasses}
                selectedSourceKey={effectiveSourceKey}
                onSelectSourceKey={handleSelectEffectiveSourceKey}
                resolvedClassName={resolvedClassName}
                teacherId={teacherId}
                teacherName={userProfile?.fullName || (rosterMode === 'guest' ? 'Khách' : 'Giáo viên')}
                userRole={currentRole}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  if (!stageContainerRef.current) return;
                  if (!isFullscreen) {
                    stageContainerRef.current.requestFullscreen?.();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen?.();
                    setIsFullscreen(false);
                  }
                }}
                onCloseGame={() => {
                  if (isFullscreen) {
                    document.exitFullscreen?.().catch(() => {});
                    setIsFullscreen(false);
                  }
                  setActiveGame(null);
                }}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
                onOpenHistoryModal={() => setShowHistoryModal(true)}
                onPick={handleGamePickStudent}
                onUpdateLatestNote={handleUpdateLatestHistoryNote}
              />
            </React.Suspense>
          ) : activeGame.modeKey === 'cards' ? (
            <MagicLotteryGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              onRestoreStudentToPool={handleRestoreStudentToPool}
              classes={effectiveClasses}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || (rosterMode === 'guest' ? 'Khách' : 'Giáo viên')}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              onCloseGame={() => {
                if (isFullscreen) {
                  document.exitFullscreen?.().catch(() => {});
                  setIsFullscreen(false);
                }
                setActiveGame(null);
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'duck_race' ? (
            <React.Suspense
              fallback={
                <div className="w-full min-h-[560px] rounded-3xl bg-[#081933] border-2 border-[#14C9E5]/50 flex flex-col items-center justify-center text-white p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full border-4 border-[#FFCC33] border-t-transparent animate-spin" />
                  <p className="text-base font-extrabold text-[#FFCC33]">
                    Đang khởi tạo Đường Đua Vịt 3D Premium (WebGL Aquatic Arena)...
                  </p>
                </div>
              }
            >
              <DuckRace3DGame
                availableCandidates={availableCandidates}
                allCandidates={currentCandidates}
                absentIds={absentIds}
                calledSessionIds={calledSessionIds}
                antiDuplicate={antiDuplicate}
                onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
                onResetSession={handleResetActiveSession}
                onRestoreStudentToPool={handleRestoreStudentToPool}
                classes={effectiveClasses}
                selectedSourceKey={effectiveSourceKey}
                onSelectSourceKey={handleSelectEffectiveSourceKey}
                resolvedClassName={resolvedClassName}
                teacherId={teacherId}
                teacherName={userProfile?.fullName || (rosterMode === 'guest' ? 'Khách' : 'Giáo viên')}
                userRole={currentRole}
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => {
                  if (!stageContainerRef.current) return;
                  if (!isFullscreen) {
                    stageContainerRef.current.requestFullscreen?.();
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen?.();
                    setIsFullscreen(false);
                  }
                }}
                onCloseGame={() => {
                  if (isFullscreen) {
                    document.exitFullscreen?.().catch(() => {});
                    setIsFullscreen(false);
                  }
                  setActiveGame(null);
                }}
                isMuted={isMuted}
                onToggleMute={() => setIsMuted(!isMuted)}
                onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
                onOpenHistoryModal={() => setShowHistoryModal(true)}
                onPick={handleGamePickStudent}
                onUpdateLatestNote={handleUpdateLatestHistoryNote}
              />
            </React.Suspense>
          ) : activeGame.modeKey === 'balloons' ? (
            <BalloonsGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              classes={effectiveClasses}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'dice' ? (
            <DiceGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              classes={effectiveClasses}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'secret_card' ? (
            <SecretCardGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'number_wheel' ? (
            <NumberWheelGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              classes={effectiveClasses}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'robot_picker' ? (
            <RobotGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              calledSessionIds={calledSessionIds}
              antiDuplicate={antiDuplicate}
              onToggleAntiDuplicate={() => setAntiDuplicate(!antiDuplicate)}
              onResetSession={handleResetActiveSession}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
              onUpdateLatestNote={handleUpdateLatestHistoryNote}
            />
          ) : activeGame.modeKey === 'warmup_quiz' ? (
            <SpeedChallengeGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
              onPick={handleGamePickStudent}
            />
          ) : activeGame.modeKey === 'reveal_image' ? (
            <MysteryPictureGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
            />
          ) : activeGame.modeKey === 'crossword_basic' ? (
            <CrosswordGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
            />
          ) : activeGame.modeKey === 'decode_cipher' ? (
            <SecretCodeGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
            />
          ) : activeGame.modeKey === 'true_false' ? (
            <TrueFalseGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
            />
          ) : activeGame.modeKey === 'catch_word' ? (
            <PictureWordGame
              availableCandidates={availableCandidates}
              allCandidates={currentCandidates}
              absentIds={absentIds}
              classes={effectiveClasses}
              questions={questions}
              selectedSourceKey={effectiveSourceKey}
              onSelectSourceKey={handleSelectEffectiveSourceKey}
              resolvedClassName={resolvedClassName}
              teacherId={teacherId}
              teacherName={userProfile?.fullName || 'Giáo viên'}
              userRole={currentRole}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => {
                if (!stageContainerRef.current) return;
                if (!isFullscreen) {
                  stageContainerRef.current.requestFullscreen?.();
                  setIsFullscreen(true);
                } else {
                  document.exitFullscreen?.();
                  setIsFullscreen(false);
                }
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
              onOpenAbsentModal={() => (rosterMode === 'guest' ? setShowRosterSetupModal(true) : setShowAbsentModal(true))}
              onOpenHistoryModal={() => setShowHistoryModal(true)}
            />
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-8 bg-[#F8FAFC] rounded-2xl border border-slate-200 p-6 flex flex-col justify-between relative overflow-hidden">
              {activeGame.modeKey === 'wheel' ? (
                <div className="space-y-6 flex flex-col items-center justify-center py-8">
                  <div className="relative inline-block">
                    <canvas ref={wheelCanvasRef} width={340} height={340} className="rounded-full shadow-lg bg-white" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-0 h-0 border-x-8 border-x-transparent border-t-[16px] border-t-red-600 z-10" />
                  </div>
                  <button
                    onClick={spinWheel}
                    disabled={isPlayingAnimation}
                    className="px-8 py-3.5 bg-gradient-to-r from-[#006BFF] to-[#1769C2] text-white hover:from-blue-600 hover:to-blue-700 rounded-2xl text-base font-extrabold shadow-md transition-all disabled:opacity-50"
                  >
                    {isPlayingAnimation ? 'Đang quay...' : 'QUAY NGAY ➔'}
                  </button>
                </div>
              ) : activeGame.modeKey === 'gift_box' ? (
                <div className="w-full flex flex-col justify-between h-full space-y-4">
                  {/* Mystery Gift Boxes Stage Container */}
                  <div className="relative w-full min-h-[400px] lg:min-h-[450px] bg-gradient-to-b from-slate-950 via-purple-950 to-indigo-950 rounded-3xl border-4 border-amber-400/60 p-6 shadow-2xl overflow-hidden flex flex-col justify-between">
                    <div className="flex items-center justify-between text-amber-300 text-xs sm:text-sm font-bold uppercase tracking-widest px-2 z-20">
                      <span>🎁 TÂY ĐÔ MYSTERY GIFT BOX · HỘP QUÀ BÍ ẨN</span>
                      <span className="bg-amber-500/20 px-3 py-1 rounded-lg text-amber-200">Lớp: {resolvedClassName}</span>
                    </div>

                    {/* Boxes Grid */}
                    <div className="relative z-10 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3.5 p-4 my-auto items-center justify-center max-h-[300px] overflow-y-auto">
                      {giftBoxes.map((box, idx) => {
                        const isGlowing = activeGiftBoxIndex === idx && (giftBoxPhase === 'GLOWING' || giftBoxPhase === 'OPENING');
                        const isChosen = pickedResult?.some((p) => p.id === box.student.id);

                        return (
                          <div
                            key={box.id}
                            onClick={() => openGiftBox(idx)}
                            className={`relative group cursor-pointer transition-all duration-300 p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 ${
                              box.isOpen
                                ? 'bg-slate-800/80 border-slate-600 opacity-60 cursor-not-allowed'
                                : isGlowing
                                ? 'bg-amber-400 border-white scale-110 ring-4 ring-amber-300 animate-bounce z-20'
                                : `${box.color} border-amber-300/60 hover:scale-105 hover:ring-4 hover:ring-amber-200`
                            }`}
                          >
                            {/* Ribbon & Bow */}
                            <div className="absolute top-0 w-3 h-full bg-amber-300/80 mx-auto" />
                            <div className="absolute top-4 h-3 w-full bg-amber-300/80 my-auto" />
                            <div className="absolute -top-3 text-2xl animate-pulse">🎀</div>

                            {box.isOpen ? (
                              <div className="relative z-10 text-center space-y-1 py-2">
                                <span className="text-xl">✅</span>
                                <p className="text-[11px] font-bold text-white truncate max-w-[80px]">{box.student.fullName.split(' ').pop()}</p>
                              </div>
                            ) : (
                              <div className="relative z-10 text-center space-y-1 py-3">
                                <span className="text-3xl">{box.icon}</span>
                                <div className="bg-black/40 px-2 py-0.5 rounded text-[11px] font-extrabold text-amber-200">
                                  Hộp #{idx + 1}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center text-xs text-amber-200/80 z-20">
                      💡 Bấm chọn hộp thủ công hoặc sử dụng hệ thống ngẫu nhiên bên dưới.
                    </div>
                  </div>

                  {/* System Random Pick Button */}
                  <button
                    onClick={systemPickGiftBox}
                    disabled={isPlayingAnimation || availableCandidates.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-amber-500 via-purple-600 to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <span>{isPlayingAnimation ? '🎁 ĐANG MỞ HỘP QUÀ BÍ ẨN...' : '🎁 CHỌN HỘP NGẪU NHIÊN ➔'}</span>
                  </button>
                </div>
              ) : activeGame.modeKey === 'cards' ? (
                <MagicLotteryGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'horse_race' ? (
                <HorseRaceGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'rocket' ? (
                <RocketGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'balloons' ? (
                <BalloonsGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'dice' ? (
                <DiceGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'secret_card' ? (
                <SecretCardGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'number_wheel' ? (
                <NumberWheelGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'robot_picker' ? (
                <RobotGame availableCandidates={availableCandidates} onPick={handleGamePickStudent} isMuted={isMuted} />
              ) : activeGame.modeKey === 'claw_machine' ? (
                <div className="w-full flex flex-col justify-between h-full space-y-4">
                  {/* Arcade Glass Cabinet Container (Expanded & Balanced) */}
                  <div className="relative w-full h-[400px] lg:h-[450px] bg-gradient-to-b from-slate-950 via-indigo-950 to-blue-950 rounded-3xl border-4 border-cyan-400/60 p-5 shadow-2xl overflow-hidden flex flex-col justify-between">
                    {/* Top Arcade Header */}
                    <div className="flex items-center justify-between text-cyan-300 text-xs sm:text-sm font-bold uppercase tracking-widest px-2 z-30">
                      <span>🕹️ TÂY ĐÔ CLAW ARCADE · MÁY GẮP THÚ THẦN KỲ</span>
                      <span className="bg-cyan-500/20 px-3 py-1 rounded-lg text-cyan-200">Lớp: {resolvedClassName}</span>
                    </div>

                    {/* Mechanical Rail & Moving Claw (Precise Row & Col target alignment) */}
                    <div className="absolute top-16 left-0 right-0 h-48 pointer-events-none z-30">
                      <div
                        className="absolute top-0 transition-all duration-1000 ease-in-out flex flex-col items-center"
                        style={{
                          left: `${Math.min(Math.max((clawTargetIndex % 6) * 15 + 10, 8), 88)}%`,
                        }}
                      >
                        {/* Cable String (extends further down if target is on row 1+) */}
                        <div
                          className={`w-1.5 bg-cyan-300 shadow-md transition-all duration-700 ${
                            clawPhase === 'LOWERING' || clawPhase === 'GRABBING'
                              ? Math.floor(clawTargetIndex / 6) > 0 ? 'h-48' : 'h-36'
                              : 'h-10'
                          }`}
                        />
                        {/* 3-Prong Mechanical Claw */}
                        <div className="relative flex flex-col items-center">
                          <div className="w-14 h-7 bg-cyan-600 rounded-lg border-2 border-white flex items-center justify-center shadow-xl">
                            <span className="text-[10px] text-white font-extrabold tracking-wider">CLAW</span>
                          </div>
                          <div className="flex gap-1.5 -mt-0.5">
                            <div className={`w-2 h-5 bg-cyan-300 rounded-full transition-transform ${clawPhase === 'GRABBING' ? 'rotate-12' : '-rotate-45'}`} />
                            <div className="w-2 h-5 bg-cyan-300 rounded-full" />
                            <div className={`w-2 h-5 bg-cyan-300 rounded-full transition-transform ${clawPhase === 'GRABBING' ? '-rotate-12' : 'rotate-45'}`} />
                          </div>

                          {/* Held Plush Toy attached during lifting */}
                          {(clawPhase === 'GRABBING' || clawPhase === 'LIFTING' || clawPhase === 'RETURNING') && heldCandidate && (
                            <div className="absolute top-12 bg-amber-400 text-slate-900 px-3 py-1.5 rounded-xl text-sm font-extrabold shadow-xl animate-bounce flex items-center gap-1.5 whitespace-nowrap">
                              <span>{PLUSH_ICONS[currentCandidates.findIndex(c => c.id === heldCandidate.id) % PLUSH_ICONS.length]}</span>
                              <span>{heldCandidate.fullName.split(' ').pop()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Plush Toy Capsules Grid (Centered vertically & horizontally, supports multiple rows) */}
                    <div className="relative z-10 grid grid-cols-4 sm:grid-cols-6 gap-3 p-4 bg-blue-950/70 backdrop-blur-xs rounded-2xl border border-cyan-500/30 max-h-[280px] overflow-y-auto shadow-inner my-auto items-center justify-center">
                      {currentCandidates.map((c, idx) => {
                        const isTarget = clawPhase !== 'IDLE' && clawPhase !== 'REVEALING' && idx === clawTargetIndex;
                        const isRevealed = pickedResult?.some((p) => p.id === c.id);
                        const plushIcon = PLUSH_ICONS[idx % PLUSH_ICONS.length];

                        return (
                          <div
                            key={c.id}
                            className={`p-3 rounded-2xl text-center text-xs font-bold transition-all shadow-md flex flex-col items-center justify-center relative ${
                              isTarget && (clawPhase === 'LOWERING' || clawPhase === 'GRABBING')
                                ? 'bg-amber-400 text-slate-900 scale-110 ring-4 ring-amber-200 z-20 animate-pulse'
                                : isRevealed
                                ? 'bg-emerald-500 text-white scale-110 ring-4 ring-emerald-200 z-20 animate-bounce'
                                : 'bg-white/10 hover:bg-white/20 text-blue-100 border border-cyan-400/20'
                            }`}
                          >
                            <span className="text-2xl">{plushIcon}</span>
                            <span className="truncate w-full mt-1">{c.fullName.split(' ').pop()}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Prize Chute Corner */}
                    <div className="absolute bottom-3 right-4 w-20 h-14 bg-black/80 border-2 border-cyan-400 rounded-2xl flex flex-col items-center justify-center text-cyan-300 text-[10px] font-bold shadow-lg z-20">
                      <span>CỬA NHẬN</span>
                      <span className="text-amber-300 text-xs">PRIZE ➔</span>
                    </div>
                  </div>

                  {/* Integrated Control Button right beneath the cabinet */}
                  <button
                    onClick={startClawMachine}
                    disabled={isPlayingAnimation || availableCandidates.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 via-[#006BFF] to-indigo-600 text-white hover:opacity-95 rounded-2xl text-lg font-extrabold shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <span>{isPlayingAnimation ? '🕹️ MÁY ĐANG GẮP THÚ THẦN KỲ...' : '🕹️ BẮT ĐẦU GẮP THÚ NGAY'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 flex flex-col items-center justify-center py-12">
                  <div className="w-24 h-24 bg-blue-100 text-[#006BFF] rounded-3xl flex items-center justify-center mx-auto shadow-inner">
                    <Sparkles className={`w-12 h-12 ${isPlayingAnimation ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-xl font-bold text-[#0F2D52]">
                      {isPlayingAnimation ? 'Đang chọn học sinh...' : activeGame.title}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Sẵn sàng bốc thăm từ danh sách lớp <span className="font-bold text-[#006BFF]">{resolvedClassName}</span> ({availableCandidates.length} bạn sẵn sàng).
                    </p>
                  </div>
                  <button
                    onClick={() => handlePickStudents(activeGame.modeKey === 'call_pair' ? 2 : activeGame.modeKey === 'call_trio' ? 3 : 1)}
                    disabled={isPlayingAnimation}
                    className="px-8 py-3.5 bg-[#006BFF] text-white hover:bg-blue-600 rounded-2xl text-base font-extrabold shadow-md transition-all disabled:opacity-50"
                  >
                    {isPlayingAnimation ? 'Đang chọn...' : 'BẮT ĐẦU CHỌN ➔'}
                  </button>
                </div>
              )}
            </div>

            {/* Results Panel Right Side */}
            <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-6 h-full flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Kết quả lượt gọi</h4>

                {/* While clawing / animating -> show "Máy đang gắp thú..." */}
                {isPlayingAnimation ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center space-y-3 animate-pulse shadow-xs">
                    <div className="w-12 h-12 bg-cyan-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-inner text-xl">
                      🕹️
                    </div>
                    <h5 className="text-base font-bold text-[#0F2D52]">Máy đang gắp thú...</h5>
                    <p className="text-xs text-slate-600 leading-relaxed">Cần gắp đang di chuyển đến vị trí thú bông mục tiêu của học sinh.</p>
                  </div>
                ) : pickedResult && pickedResult.length > 0 ? (
                  /* Current round result revealed */
                  <div className="space-y-4">
                    {pickedResult.map((st, idx) => (
                      <div key={st.id} className="bg-white rounded-2xl p-5 border-2 border-emerald-400 shadow-md space-y-1.5 animate-fadeIn">
                        <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">🎯 Trúng thưởng #{idx + 1}</span>
                        <h5 className="text-xl font-extrabold text-[#0F2D52]">{st.fullName}</h5>
                        <p className="text-xs text-slate-500 font-medium">Mã học sinh: {st.code}</p>
                      </div>
                    ))}

                    <div className="pt-2">
                      <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú / Điểm thưởng</label>
                      <input
                        type="text"
                        placeholder="VD: Trả lời xuất sắc (+10đ)..."
                        value={resultScoreNote}
                        onChange={(e) => setResultScoreNote(e.target.value)}
                        className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#006BFF]"
                      />
                    </div>
                  </div>
                ) : previousResult && previousResult.length > 0 ? (
                  /* Previous round result labeled clearly */
                  <div className="space-y-3 opacity-90">
                    <div className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[11px] font-bold">
                      Kết quả lượt trước
                    </div>
                    {previousResult.map((st, idx) => (
                      <div key={st.id} className="bg-white/80 rounded-xl p-4 border border-slate-200 shadow-xs space-y-1">
                        <h5 className="text-base font-bold text-slate-700">{st.fullName}</h5>
                        <p className="text-xs text-slate-500">Mã: {st.code}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 space-y-3">
                    <Users className="w-12 h-12 mx-auto opacity-30" />
                    <p className="text-xs font-medium">Chưa có kết quả. Hãy bấm bắt đầu gắp thú để chọn học sinh!</p>
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                  <span className="font-semibold">Chống trùng học sinh:</span>
                  <button
                    onClick={() => setAntiDuplicate(!antiDuplicate)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      antiDuplicate ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {antiDuplicate ? 'BẬT' : 'TẮT'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleResetActiveSession();
                    setClawPhase('IDLE');
                    setHeldCandidate(null);
                    alert('Đã đặt lại toàn bộ phiên mới! Bộ đếm và kết quả cũ đã được làm mới.');
                  }}
                  className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-2 shadow-xs"
                >
                  <RotateCcw className="w-4 h-4 text-[#006BFF]" />
                  <span>Làm mới phiên gọi</span>
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* Sub-tab: Creator */}
      {activeSubTab === 'creator' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6 max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-blue-50 text-[#006BFF] rounded-full flex items-center justify-center mx-auto shadow-inner">
            <PlusCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#0F2D52]">Tạo trò chơi tương tác tùy chỉnh</h2>
            <p className="text-xs text-slate-600 max-w-lg mx-auto">
              Giáo viên có thể nhập câu hỏi, danh sách từ vựng hoặc kịch bản trò chơi riêng để tích hợp vào các mẫu trò chơi trong trung tâm.
            </p>
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-left space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Tiêu đề trò chơi / Chủ đề</label>
              <input type="text" placeholder="VD: Ôn tập chương 1 Hình học 6..." className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Chọn mẫu trò chơi cơ sở</label>
              <select className="w-full text-xs px-3 py-2.5 bg-white border border-slate-300 rounded-xl">
                <option>Vòng quay may mắn (A01)</option>
                <option>Máy gắp thú (A02)</option>
                <option>Ai là triệu phú (C01)</option>
              </select>
            </div>
            <button onClick={() => alert('Đã lưu trò chơi tùy chỉnh vào danh sách của tôi!')} className="w-full py-3 bg-[#006BFF] text-white hover:bg-blue-600 rounded-xl text-xs font-bold shadow-xs">
              Lưu & Xuất bản trò chơi
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab: My Games */}
      {activeSubTab === 'my_games' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6 max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Star className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F2D52]">Trò chơi yêu thích & tự tạo</h2>
          <p className="text-xs text-slate-600">Bạn chưa lưu trò chơi cá nhân nào. Hãy đánh dấu sao các trò chơi trong thư viện để truy cập nhanh tại đây.</p>
        </div>
      )}

      {/* Sub-tab: Sessions */}
      {activeSubTab === 'sessions' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6 max-w-3xl mx-auto text-center">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#0F2D52]">Quản lý phiên chơi & lớp học</h2>
          <p className="text-xs text-slate-600">
            Chế độ hiện tại: <strong>{rosterMode === 'guest' ? 'Chế độ Khách (Tự nhập danh sách)' : 'Chế độ Giáo viên (Hệ thống)'}</strong> · Lớp:{' '}
            <strong className="text-[#006BFF]">{resolvedClassName}</strong>. Tổng số học sinh đã gọi trong phiên: {calledSessionIds.size}.
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setShowRosterSetupModal(true)}
              className="px-6 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white rounded-xl text-xs sm:text-sm font-bold"
            >
              Mở bảng Chuẩn bị trò chơi &amp; Quản lý danh sách
            </button>
          </div>
        </div>
      )}

      {/* Sub-tab: History */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
            <h3 className="text-base font-bold text-[#0F2D52]">
              {rosterMode === 'guest'
                ? `Lịch sử Chế độ Khách (${guestHistory.length} lượt)`
                : `Lịch sử các lượt gọi & trò chơi hệ thống (${historyItems.length} lượt)`}
            </h3>
            <div className="flex items-center gap-2">
              {rosterMode === 'guest' && guestHistory.length > 0 && (
                <button
                  onClick={() => {
                    const csv = buildGuestHistoryCsvContent(guestHistory);
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lich_su_khach_${new Date().toISOString().slice(0, 10)}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold"
                >
                  Tải CSV lịch sử khách
                </button>
              )}
              <button
                onClick={() => {
                  if (rosterMode === 'guest') {
                    handleClearAllGuestData();
                  } else if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử?')) {
                    clearCallHistory(systemTeacherId, selectedSourceKey);
                    setHistoryItems([]);
                  }
                }}
                className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Xóa lịch sử
              </button>
            </div>
          </div>

          {rosterMode === 'guest' ? (
            guestHistory.length > 0 ? (
              <div className="space-y-2">
                {guestHistory.map((item) => (
                  <div key={item.turnId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-[#006BFF]">{item.gameCode} - {item.gameTitle}</span> ({item.className})
                      <p className="text-slate-600 mt-0.5">
                        Đã chọn: <strong className="text-[#0F2D52]">{item.studentName}</strong>
                        {item.note && (
                          <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold">
                            {item.note}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString('vi-VN')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 text-center py-8">Chưa có lịch sử gọi học sinh trong Chế độ Khách.</p>
            )
          ) : historyItems.length > 0 ? (
            <div className="space-y-2">
              {historyItems.map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#006BFF]">{item.modeName}</span> ({item.className})
                    <p className="text-slate-600 mt-0.5">
                      Đã chọn: <strong className="text-[#0F2D52]">{item.selectedStudents.map((s) => s.fullName).join(', ')}</strong>
                      {item.scoreNote && (
                        <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md font-bold">
                          {item.scoreNote}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 text-center py-8">Chưa có lịch sử gọi học sinh.</p>
          )}
        </div>
      )}

      {/* Sub-tab: Guide */}
      {activeSubTab === 'guide' && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xs space-y-6 max-w-3xl mx-auto text-left font-serif">
          <h2 className="text-xl font-extrabold text-[#0F2D52] border-b pb-3">Hướng dẫn sử dụng EDU Game Center</h2>
          <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <p><strong>1. Chế độ Khách (Không cần đăng nhập):</strong> Cho phép giáo viên thỉnh giảng, học sinh hoặc khách truy cập tự nhập danh sách học sinh, dán trực tiếp từ Excel / Google Sheets hoặc tải tệp <code>.xlsx</code>, <code>.csv</code> để chơi ngay mọi trò chơi mà không cần tài khoản.</p>
            <p><strong>2. Chế độ Giáo viên (Dữ liệu hệ thống):</strong> Sử dụng danh sách lớp học chính thức và ngân hàng câu hỏi của trường THCS Tây Đô khi đã đăng nhập.</p>
            <p><strong>3. Thư viện 50 trò chơi:</strong> Chia thành 7 nhóm phù hợp cho mọi hoạt động từ gọi học sinh ngẫu nhiên 3D (A01–A12), khởi động tiết học (B01–B10) đến củng cố và thi đua.</p>
          </div>
        </div>
      )}

      {/* Timer Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0F2D52]">Hẹn giờ trả lời</h3>
            <div className="flex items-center justify-center gap-3">
              {[15, 30, 45, 60].map((sec) => (
                <button
                  key={sec}
                  onClick={() => {
                    setTimerSeconds(sec);
                    setTimerRemaining(sec);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold ${
                    timerSeconds === sec ? 'bg-[#006BFF] text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
            <div className="text-center py-4">
              <span className="text-4xl font-extrabold text-[#006BFF]">{timerRemaining}s</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTimerRunning(!timerRunning)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-white ${timerRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#006BFF] hover:bg-blue-600'}`}
              >
                {timerRunning ? 'Tạm dừng' : 'Bắt đầu đếm'}
              </button>
              <button onClick={() => setShowTimerModal(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Absent Management Modal (Teacher Mode) */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0F2D52]">Quản lý học sinh vắng mặt</h3>
            <p className="text-xs text-slate-500">Đánh dấu học sinh vắng để hệ thống tạm thời không gọi tên trong phiên này.</p>
            <div className="max-h-60 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-3">
              {currentCandidates.map((st) => {
                const isAbs = absentIds.has(st.id);
                return (
                  <label key={st.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs">
                    <span className={isAbs ? 'line-through text-slate-400 font-semibold' : 'font-bold text-slate-800'}>
                      {st.code} - {st.fullName}
                    </span>
                    <input
                      type="checkbox"
                      checked={isAbs}
                      onChange={() => {
                        if (rosterMode === 'guest') {
                          handleUpdateGuestSession({
                            ...guestSession,
                            students: guestSession.students.map((s) =>
                              s.guestStudentId === st.id ? { ...s, participating: isAbs } : s
                            ),
                          });
                        } else {
                          const newAbs = new Set(teacherAbsentIds);
                          if (isAbs) newAbs.delete(st.id);
                          else newAbs.add(st.id);
                          setTeacherAbsentIds(newAbs);
                          saveAbsentIds(systemTeacherId, selectedSourceKey, Array.from(newAbs));
                        }
                      }}
                      className="rounded text-[#006BFF]"
                    />
                  </label>
                );
              })}
            </div>
            <button onClick={() => setShowAbsentModal(false)} className="w-full py-2.5 bg-[#006BFF] text-white hover:bg-blue-600 rounded-xl text-xs font-bold">
              Hoàn tất
            </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#0F2D52]">
              {rosterMode === 'guest'
                ? `Lịch sử phiên gọi Chế độ Khách (${guestHistory.length})`
                : `Lịch sử phiên gọi (${historyItems.length})`}
            </h3>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {rosterMode === 'guest'
                ? guestHistory.map((item) => (
                    <div key={item.turnId} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#006BFF]">{item.gameCode} · {item.gameTitle}</span>
                        <p className="text-slate-600 mt-0.5">
                          Gọi: <strong className="text-[#0F2D52]">{item.studentName}</strong> ({item.className})
                        </p>
                      </div>
                      <span className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  ))
                : historyItems.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-[#006BFF]">{item.modeName}</span>
                        <p className="text-slate-600 mt-0.5">Gọi: <strong className="text-[#0F2D52]">{item.selectedStudents.map((s) => s.fullName).join(', ')}</strong></p>
                      </div>
                      <span className="text-[11px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
            </div>
            <button onClick={() => setShowHistoryModal(false)} className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Shared GameRosterSetup Modal ("CHUẨN BỊ TRÒ CHƠI") */}
      <GameRosterSetup
        isOpen={showRosterSetupModal}
        onClose={() => {
          setShowRosterSetupModal(false);
          setPendingGameToLaunch(null);
        }}
        onStartGame={() => {
          setShowRosterSetupModal(false);
          if (pendingGameToLaunch) {
            setActiveGame(pendingGameToLaunch);
            setPendingGameToLaunch(null);
          }
        }}
        targetGameTitle={pendingGameToLaunch?.title || activeGame?.title}
        targetGameCode={pendingGameToLaunch?.code || activeGame?.code}
        rosterMode={rosterMode}
        onChangeRosterMode={handleChangeRosterMode}
        guestSession={guestSession}
        onUpdateGuestSession={handleUpdateGuestSession}
        guestHistory={guestHistory}
        onClearAllGuestData={handleClearAllGuestData}
        onResetGuestCalledSession={handleResetGuestCalledSession}
        isLoggedInTeacher={isLoggedInTeacher}
        teacherClasses={classes}
        selectedTeacherClassId={selectedSourceKey}
        onSelectTeacherClassId={(classId) => setSelectedSourceKey(classId)}
        onRequestLogin={() => {
          setShowRosterSetupModal(false);
          openAuthModal?.('login');
        }}
      />
    </div>
  );
};
