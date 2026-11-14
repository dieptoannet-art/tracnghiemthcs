import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CALL_GAME_MODES,
  CallGameMode,
  CallHistoryItem,
  StudentCandidate,
  getAvailableStudents,
  pickRandomStudents,
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
  computeWheelTargetRotation,
  parseManualStudentsText,
} from './studentCallRules';
import { GameCardArtwork } from './GameIllustrations';
import './studentCallGames.css';
import {
  Users,
  UserX,
  RotateCcw,
  History,
  Timer as TimerIcon,
  Volume2,
  VolumeX,
  Edit3,
  Play,
  Pause,
  Disc,
  Gift,
  Layers,
  Rocket,
  UserPlus,
  X,
  Trash2,
  Star,
  Maximize2,
  Minimize2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

// Web Audio API Sound Synthesizer (No external audio files required)
class SoundPlayer {
  private ctx: AudioContext | null = null;
  public muted = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
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
    } catch {
      // ignore audio context restrictions
    }
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
    } catch {
      // ignore audio errors
    }
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
    } catch {
      // ignore audio errors
    }
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
    } catch {
      // ignore audio errors
    }
  }
}

const sounds = new SoundPlayer();

const WHEEL_SLICE_COLORS = [
  '#1D4ED8',
  '#059669',
  '#D97706',
  '#DC2626',
  '#7C3AED',
  '#0891B2',
  '#DB2777',
  '#2563EB',
  '#15803D',
  '#EA580C',
];

const CARD_PASTEL_STYLES: Record<CallGameMode, string> = {
  wheel: 'bg-[#EEF5FF] border-[#C9DDFD] hover:border-[#006BFF]',
  gift_box: 'bg-[#FFF3EE] border-[#FAD4C5] hover:border-[#EA580C]',
  cards: 'bg-[#ECFDF5] border-[#BEEAD7] hover:border-[#059669]',
  flying_envelope: 'bg-[#F3F0FF] border-[#D7CCF9] hover:border-[#7C3AED]',
  rocket: 'bg-[#FFF8E6] border-[#F8DF9F] hover:border-[#D97706]',
  magic_sphere: 'bg-[#ECFEFF] border-[#BAE6FD] hover:border-[#0891B2]',
  call_pair: 'bg-[#FEF2F2] border-[#FECACA] hover:border-[#DC2626]',
  call_trio: 'bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#16A34A]',
  speed_timer: 'bg-[#FFFBEB] border-[#FDE68A] hover:border-[#D97706]',
  star_of_hope: 'bg-[#FEFCE8] border-[#FEF08A] hover:border-[#CA8A04]',
};

const formatClassDisplayName = (rawName: string) => {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return 'Lớp học';
  return trimmed.toLowerCase().startsWith('lớp') ? trimmed : `Lớp ${trimmed}`;
};

export const StudentCallGames: React.FC = () => {
  const { classes, user } = useApp();
  const teacherId = user?.id || 'gv_dieptoantoan';

  // Source of students (Class from AppContext/Supabase or Manual List)
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(() => {
    return classes[0]?.id || 'manual';
  });
  const hasUserSelectedSourceRef = useRef(false);

  // Manual list state
  const [manualStudents, setManualStudents] = useState<StudentCandidate[]>(() => {
    return loadCustomManualStudents(teacherId);
  });
  const [showManualEditorModal, setShowManualEditorModal] = useState<boolean>(false);
  const [manualRawText, setManualRawText] = useState<string>('');
  const [manualEditorError, setManualEditorError] = useState<string | null>(null);

  // Selected Game Mode & Library expansion
  const [selectedMode, setSelectedMode] = useState<CallGameMode>('wheel');
  const [showAllGames, setShowAllGames] = useState<boolean>(false);

  // Settings & Toggles
  const [antiDuplicate, setAntiDuplicate] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // Absent, Called, History
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [calledSessionIds, setCalledSessionIds] = useState<Set<string>>(new Set());
  const [historyItems, setHistoryItems] = useState<CallHistoryItem[]>([]);
  const [confirmClearHistory, setConfirmClearHistory] = useState<boolean>(false);

  // Modals
  const [showAbsentModal, setShowAbsentModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showTimerModal, setShowTimerModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  // Turn Result & Note
  const [pickedResult, setPickedResult] = useState<StudentCandidate[] | null>(null);
  const [lastResultHistoryId, setLastResultHistoryId] = useState<string | null>(null);
  const [resultScoreNote, setResultScoreNote] = useState<string>('');

  // Active Animation State & Cleanup Refs
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const activeTurnRecordedRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);

  // Wheel Animation States
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const wheelRotationRef = useRef<number>(0);
  const [wheelSnapshotStudents, setWheelSnapshotStudents] = useState<StudentCandidate[] | null>(null);

  // Game-specific visual states
  const [flippedCards, setFlippedCards] = useState<boolean[]>([false, false, false, false, false, false]);
  const [cardDeckStudents, setCardDeckStudents] = useState<(StudentCandidate | null)[]>([null, null, null, null, null, null]);
  const [openedBoxIndex, setOpenedBoxIndex] = useState<number | null>(null);
  const [shakingBoxIndex, setShakingBoxIndex] = useState<number | null>(null);
  const [rocketCountdown, setRocketCountdown] = useState<number | null>(null);
  const [envelopeOpened, setEnvelopeOpened] = useState<boolean>(false);
  const [rollingPreviewNames, setRollingPreviewNames] = useState<string[]>([]);

  // Timer Widget State
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  const clearAllAnimations = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    timersRef.current.forEach(id => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllAnimations();
    };
  }, [clearAllAnimations]);

  // Sync default class selection if Supabase classes arrive asynchronously
  useEffect(() => {
    if (selectedSourceKey === 'manual') {
      if (!hasUserSelectedSourceRef.current && classes.length > 0) {
        setSelectedSourceKey(classes[0].id);
      }
      return;
    }
    const exists = classes.some(c => c.id === selectedSourceKey);
    if (!exists) {
      setSelectedSourceKey(classes[0]?.id || 'manual');
    }
  }, [classes, selectedSourceKey]);

  // Active class & student lists
  const activeClassRoom = useMemo(() => {
    if (selectedSourceKey === 'manual') return null;
    return classes.find(c => c.id === selectedSourceKey) || null;
  }, [classes, selectedSourceKey]);

  const allCurrentStudents = useMemo<StudentCandidate[]>(() => {
    if (selectedSourceKey === 'manual') {
      return manualStudents;
    }
    if (activeClassRoom) {
      return mapClassStudentsToCandidates(activeClassRoom);
    }
    return [];
  }, [selectedSourceKey, manualStudents, activeClassRoom]);

  const activeListName = useMemo(() => {
    if (selectedSourceKey === 'manual') return 'Danh sách nhập tay';
    return activeClassRoom ? formatClassDisplayName(activeClassRoom.name) : 'Lớp học';
  }, [selectedSourceKey, activeClassRoom]);

  // Load cached absent IDs, session called IDs, and history when source changes
  useEffect(() => {
    clearAllAnimations();
    setIsPlaying(false);
    setPickedResult(null);
    setLastResultHistoryId(null);
    setResultScoreNote('');
    setWheelSnapshotStudents(null);
    setOpenedBoxIndex(null);
    setShakingBoxIndex(null);
    setEnvelopeOpened(false);
    setRocketCountdown(null);
    setRollingPreviewNames([]);
    setConfirmClearHistory(false);

    setAbsentIds(new Set(loadAbsentIds(teacherId, selectedSourceKey)));
    setCalledSessionIds(new Set(loadCalledSessionIds(teacherId, selectedSourceKey)));
    setHistoryItems(loadCallHistory(teacherId, selectedSourceKey));
  }, [teacherId, selectedSourceKey, clearAllAnimations]);

  // Persist absent IDs
  const updateAbsentIds = useCallback(
    (newSet: Set<string>) => {
      setAbsentIds(newSet);
      saveAbsentIds(teacherId, selectedSourceKey, Array.from(newSet));
    },
    [teacherId, selectedSourceKey]
  );

  // Persist called IDs
  const updateCalledSessionIds = useCallback(
    (newSet: Set<string>) => {
      setCalledSessionIds(newSet);
      saveCalledSessionIds(teacherId, selectedSourceKey, Array.from(newSet));
    },
    [teacherId, selectedSourceKey]
  );

  // Real statistics strictly derived from current class/list
  const currentStudentIdSet = useMemo(
    () => new Set(allCurrentStudents.map(s => s.id)),
    [allCurrentStudents]
  );

  const presentStudents = useMemo(
    () => allCurrentStudents.filter(s => !absentIds.has(s.id)),
    [allCurrentStudents, absentIds]
  );

  const absentInClassCount = useMemo(
    () => allCurrentStudents.filter(s => absentIds.has(s.id)).length,
    [allCurrentStudents, absentIds]
  );

  const calledInClassCount = useMemo(
    () => Array.from(calledSessionIds).filter(id => currentStudentIdSet.has(id)).length,
    [calledSessionIds, currentStudentIdSet]
  );

  const availableStudents = useMemo(
    () => getAvailableStudents(allCurrentStudents, absentIds, calledSessionIds, antiDuplicate),
    [allCurrentStudents, absentIds, calledSessionIds, antiDuplicate]
  );

  const currentModeMeta = useMemo(
    () => CALL_GAME_MODES.find(m => m.id === selectedMode) || CALL_GAME_MODES[0],
    [selectedMode]
  );

  // Determine exact eligibility issue (if any) for current game mode
  const eligibilityIssue = useMemo<{
    type: 'empty_class' | 'all_absent' | 'insufficient_present' | 'exhausted_session';
    message: string;
  } | null>(() => {
    const needed = currentModeMeta.pickCount;

    if (allCurrentStudents.length === 0) {
      return {
        type: 'empty_class',
        message: `${activeListName} hiện chưa có học sinh nào (0 học sinh). Hãy nhập danh sách hoặc chọn lớp khác để bắt đầu.`,
      };
    }

    if (presentStudents.length === 0) {
      return {
        type: 'all_absent',
        message: `Tất cả ${allCurrentStudents.length} học sinh của ${activeListName} đang được đánh dấu vắng mặt.`,
      };
    }

    if (presentStudents.length < needed) {
      return {
        type: 'insufficient_present',
        message: `Trò chơi “${currentModeMeta.title}” cần ${needed} học sinh có mặt, nhưng lớp hiện chỉ có ${presentStudents.length} học sinh có mặt.`,
      };
    }

    if (availableStudents.length < needed) {
      if (availableStudents.length === 0) {
        return {
          type: 'exhausted_session',
          message: `Tất cả học sinh có mặt đã được gọi trong phiên này. Hãy đặt lại phiên hoặc tắt chống trùng để tiếp tục.`,
        };
      }
      return {
        type: 'exhausted_session',
        message: `Trò chơi “${currentModeMeta.title}” cần ${needed} học sinh, nhưng chỉ còn ${availableStudents.length} học sinh chưa gọi trong phiên.`,
      };
    }

    return null;
  }, [
    allCurrentStudents.length,
    presentStudents.length,
    availableStudents.length,
    currentModeMeta.pickCount,
    currentModeMeta.title,
    activeListName,
  ]);

  const canPlay = !isPlaying && eligibilityIssue === null;

  // Sound mute sync
  useEffect(() => {
    sounds.muted = isMuted;
  }, [isMuted]);

  // Countdown timer interval
  useEffect(() => {
    if (!isTimerRunning) return;
    if (timerSeconds <= 0) {
      setIsTimerRunning(false);
      return;
    }

    const interval = window.setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 4 && prev > 1) {
          sounds.playTimerBeep();
        } else if (prev === 1) {
          sounds.playBell();
          setIsTimerRunning(false);
        }
        return Math.max(0, prev - 1);
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // Fullscreen keyboard & browser sync
  const hadNativeFullscreenRef = useRef(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && hadNativeFullscreenRef.current) {
        hadNativeFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        hadNativeFullscreenRef.current = false;
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFullscreen]);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (stageContainerRef.current && stageContainerRef.current.requestFullscreen) {
          stageContainerRef.current
            .requestFullscreen()
            .then(() => {
              hadNativeFullscreenRef.current = true;
            })
            .catch(() => {
              hadNativeFullscreenRef.current = false;
            });
        }
      } catch {
        hadNativeFullscreenRef.current = false;
      }
    } else {
      hadNativeFullscreenRef.current = false;
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {
        // ignore
      }
    }
  };

  // Determine students rendered on the wheel (freeze snapshot while spinning or displaying wheel result)
  const wheelDisplayStudents = useMemo(() => {
    if (wheelSnapshotStudents && wheelSnapshotStudents.length > 0) {
      return wheelSnapshotStudents;
    }
    return availableStudents;
  }, [wheelSnapshotStudents, availableStudents]);

  // Draw Wheel Canvas (High-DPI sharp rendering, gold rim, studs, readable labels)
  useEffect(() => {
    if (selectedMode !== 'wheel') return;
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const logicalSize = isFullscreen ? 380 : 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== logicalSize * dpr || canvas.height !== logicalSize * dpr) {
      canvas.width = logicalSize * dpr;
      canvas.height = logicalSize * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2;
    const outerRadius = logicalSize / 2 - 4;
    const wheelRadius = outerRadius - 12;

    ctx.clearRect(0, 0, logicalSize, logicalSize);

    // Outer Gold Rim
    const rimGrad = ctx.createRadialGradient(centerX, centerY, wheelRadius, centerX, centerY, outerRadius);
    rimGrad.addColorStop(0, '#F59E0B');
    rimGrad.addColorStop(0.5, '#FDE047');
    rimGrad.addColorStop(1, '#B45309');

    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Decorative gold rim bulbs
    const bulbCount = 18;
    for (let b = 0; b < bulbCount; b++) {
      const angle = (b * 2 * Math.PI) / bulbCount;
      const bx = centerX + Math.cos(angle) * (wheelRadius + 6);
      const by = centerY + Math.sin(angle) * (wheelRadius + 6);
      ctx.beginPath();
      ctx.arc(bx, by, 2.7, 0, 2 * Math.PI);
      ctx.fillStyle = b % 2 === 0 ? '#FFFBEB' : '#F59E0B';
      ctx.fill();
    }

    const listToDraw = wheelDisplayStudents;
    const isEmptyWheel = listToDraw.length === 0;
    const totalSlices = isEmptyWheel ? 8 : listToDraw.length;
    const sliceAngle = (2 * Math.PI) / totalSlices;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((wheelRotation * Math.PI) / 180);

    for (let i = 0; i < totalSlices; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, wheelRadius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = isEmptyWheel
        ? i % 2 === 0
          ? '#163A69'
          : '#1E4A84'
        : WHEEL_SLICE_COLORS[i % WHEEL_SLICE_COLORS.length];
      ctx.fill();

      if (totalSlices > 1) {
        ctx.lineWidth = totalSlices > 24 ? 1 : 2;
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.stroke();
      }

      if (!isEmptyWheel) {
        ctx.save();
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = totalSlices === 1 ? 'center' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = 3;

        const fontSize =
          totalSlices <= 6
            ? isFullscreen
              ? 15
              : 13
            : totalSlices <= 14
            ? isFullscreen
              ? 13.5
              : 11.5
            : totalSlices <= 24
            ? 10.5
            : 9;

        ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;

        const rawName = listToDraw[i]?.fullName || '';
        const maxChars = totalSlices <= 8 ? 16 : totalSlices <= 16 ? 14 : 11;
        const displayName = rawName.length > maxChars ? `${rawName.slice(0, maxChars - 1)}…` : rawName;

        const textX = totalSlices === 1 ? wheelRadius * 0.52 : wheelRadius - 14;
        ctx.fillText(displayName, textX, 0);
        ctx.restore();
      }
    }

    ctx.restore();

    // Inner Gold Ring & Center Hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, isFullscreen ? 32 : 26, 0, 2 * Math.PI);
    ctx.fillStyle = '#082B52';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#FBBF24';
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.font = `bold ${isFullscreen ? 12 : 10}px "Times New Roman", Times, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TÂY ĐÔ', centerX, centerY);

    ctx.restore();
  }, [selectedMode, wheelDisplayStudents, wheelRotation, isFullscreen]);

  // Finalize a turn cleanly — guarantees history is recorded strictly once per turn
  const finishSelection = useCallback(
    (winners: StudentCandidate[], mode: CallGameMode, modeTitle: string) => {
      if (activeTurnRecordedRef.current) return;
      activeTurnRecordedRef.current = true;

      setIsPlaying(false);
      setPickedResult(winners);
      setResultScoreNote('');
      sounds.playFanfare();

      // Update called session IDs
      setCalledSessionIds(prev => {
        const next = new Set(prev);
        winners.forEach(w => next.add(w.id));
        saveCalledSessionIds(teacherId, selectedSourceKey, Array.from(next));
        return next;
      });

      // Record single history entry
      const entryId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const historyEntry: CallHistoryItem = {
        id: entryId,
        timestamp: Date.now(),
        classId: selectedSourceKey,
        className: activeListName,
        mode,
        modeName: modeTitle,
        selectedStudents: winners,
      };

      setLastResultHistoryId(entryId);
      setHistoryItems(prev => {
        const next = [historyEntry, ...prev];
        saveCallHistory(teacherId, selectedSourceKey, next);
        return next;
      });
    },
    [teacherId, selectedSourceKey, activeListName]
  );

  // Update optional score note on the just-completed history item without adding duplicates
  const handleUpdateScoreNote = (note: string) => {
    setResultScoreNote(note);
    if (!lastResultHistoryId) return;
    setHistoryItems(prev => {
      const next = prev.map(item =>
        item.id === lastResultHistoryId ? { ...item, scoreNote: note.trim() || undefined } : item
      );
      saveCallHistory(teacherId, selectedSourceKey, next);
      return next;
    });
  };

  // Start selected game (with optional clicked index for gift_box / cards)
  const handleStartGame = (mode: CallGameMode = selectedMode, preferredVisualIndex?: number) => {
    if (isPlaying || eligibilityIssue !== null) return;

    const meta = CALL_GAME_MODES.find(m => m.id === mode) || CALL_GAME_MODES[0];
    if (availableStudents.length < meta.pickCount) return;

    clearAllAnimations();
    activeTurnRecordedRef.current = false;
    setIsPlaying(true);
    setPickedResult(null);
    setLastResultHistoryId(null);
    setResultScoreNote('');
    setEnvelopeOpened(false);
    setOpenedBoxIndex(null);
    setShakingBoxIndex(null);

    const winners = pickRandomStudents(availableStudents, meta.pickCount);

    if (mode === 'wheel') {
      // Snapshot current wheel pool so slice layout stays consistent during spin & winner reveal
      const spinList = [...availableStudents];
      setWheelSnapshotStudents(spinList);

      const winnerIndex = Math.max(
        0,
        spinList.findIndex(s => s.id === winners[0].id)
      );
      const startDeg = wheelRotationRef.current;
      const targetDeg = computeWheelTargetRotation(startDeg, winnerIndex, spinList.length, 6, 0.45);
      const duration = 3400;
      const startTime = performance.now();
      const sliceDeg = 360 / Math.max(spinList.length, 1);
      let lastTickBucket = Math.floor(startDeg / sliceDeg);

      const animateWheel = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4);
        const currentDeg = startDeg + (targetDeg - startDeg) * easeOut;

        wheelRotationRef.current = currentDeg;
        setWheelRotation(currentDeg);

        const bucket = Math.floor(currentDeg / sliceDeg);
        if (bucket !== lastTickBucket) {
          lastTickBucket = bucket;
          sounds.playTick();
        }

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animateWheel);
        } else {
          rafRef.current = null;
          wheelRotationRef.current = targetDeg;
          setWheelRotation(targetDeg);
          finishSelection(winners, mode, meta.title);
        }
      };

      rafRef.current = requestAnimationFrame(animateWheel);
      return;
    }

    if (mode === 'gift_box') {
      const targetBox =
        typeof preferredVisualIndex === 'number'
          ? preferredVisualIndex
          : Math.floor(Math.random() * 6);
      setShakingBoxIndex(targetBox);
      sounds.playTick();

      const t1 = window.setTimeout(() => {
        setShakingBoxIndex(null);
        setOpenedBoxIndex(targetBox);
        sounds.playTick();

        const t2 = window.setTimeout(() => {
          finishSelection(winners, mode, meta.title);
        }, 650);
        timersRef.current.push(t2);
      }, 900);
      timersRef.current.push(t1);
      return;
    }

    if (mode === 'cards') {
      const deckSize = 6;
      const poolSample = pickRandomStudents(
        availableStudents,
        Math.min(deckSize, availableStudents.length)
      );
      const deck: (StudentCandidate | null)[] = Array.from({ length: deckSize }, (_, idx) => {
        return poolSample[idx % poolSample.length] || winners[0];
      });
      const winSlot =
        typeof preferredVisualIndex === 'number'
          ? preferredVisualIndex
          : Math.floor(Math.random() * deckSize);
      deck[winSlot] = winners[0];

      setCardDeckStudents(deck);
      setFlippedCards(new Array(deckSize).fill(false));
      sounds.playTick();

      const t1 = window.setTimeout(() => {
        sounds.playTick();
        const nextFlips = new Array(deckSize).fill(false);
        nextFlips[winSlot] = true;
        setFlippedCards(nextFlips);

        const t2 = window.setTimeout(() => {
          finishSelection(winners, mode, meta.title);
        }, 800);
        timersRef.current.push(t2);
      }, 900);
      timersRef.current.push(t1);
      return;
    }

    if (mode === 'flying_envelope') {
      sounds.playTick();
      const t1 = window.setTimeout(() => {
        setEnvelopeOpened(true);
        sounds.playTick();
        const t2 = window.setTimeout(() => {
          finishSelection(winners, mode, meta.title);
        }, 700);
        timersRef.current.push(t2);
      }, 850);
      timersRef.current.push(t1);
      return;
    }

    if (mode === 'rocket') {
      setRocketCountdown(3);
      sounds.playTick();
      const interval = window.setInterval(() => {
        setRocketCountdown(prev => {
          if (prev === null) return null;
          if (prev > 1) {
            sounds.playTick();
            return prev - 1;
          }
          window.clearInterval(interval);
          const t1 = window.setTimeout(() => {
            setRocketCountdown(null);
            finishSelection(winners, mode, meta.title);
          }, 700);
          timersRef.current.push(t1);
          return 0;
        });
      }, 650);
      timersRef.current.push(interval);
      return;
    }

    if (mode === 'speed_timer') {
      let step = 0;
      const interval = window.setInterval(() => {
        const preview = pickRandomStudents(availableStudents, 1);
        setRollingPreviewNames(preview.map(p => p.fullName));
        sounds.playTick();
        step++;
        if (step >= 10) {
          window.clearInterval(interval);
          setRollingPreviewNames([]);
          finishSelection(winners, mode, meta.title);
          setInitialTimerSeconds(30);
          setTimerSeconds(30);
          setIsTimerRunning(true);
        }
      }, 100);
      timersRef.current.push(interval);
      return;
    }

    // magic_sphere, call_pair, call_trio, star_of_hope
    let step = 0;
    const interval = window.setInterval(() => {
      const preview = pickRandomStudents(availableStudents, meta.pickCount);
      setRollingPreviewNames(preview.map(p => p.fullName));
      sounds.playTick();
      step++;
      if (step >= 11) {
        window.clearInterval(interval);
        setRollingPreviewNames([]);
        finishSelection(winners, mode, meta.title);
      }
    }, 110);
    timersRef.current.push(interval);
  };

  // Switch game mode cleanly
  const handleSelectGameMode = (modeId: CallGameMode) => {
    if (isPlaying) return;
    setSelectedMode(modeId);
    setPickedResult(null);
    setLastResultHistoryId(null);
    setResultScoreNote('');
    setWheelSnapshotStudents(null);
    setOpenedBoxIndex(null);
    setShakingBoxIndex(null);
    setEnvelopeOpened(false);
    setFlippedCards([false, false, false, false, false, false]);
    setRollingPreviewNames([]);
  };

  // Reset current session
  const handleResetSession = () => {
    clearAllAnimations();
    setIsPlaying(false);
    updateCalledSessionIds(new Set());
    setPickedResult(null);
    setLastResultHistoryId(null);
    setResultScoreNote('');
    setWheelSnapshotStudents(null);
    setOpenedBoxIndex(null);
    setFlippedCards([false, false, false, false, false, false]);
    setEnvelopeOpened(false);
    setShowResetConfirmModal(false);
  };

  // Clear history (inline confirm, no native window.confirm)
  const handleClearHistoryConfirmed = () => {
    clearCallHistory(teacherId, selectedSourceKey);
    setHistoryItems([]);
    setConfirmClearHistory(false);
    setShowHistoryModal(false);
  };

  // Toggle Absent Student
  const handleToggleAbsent = (studentId: string) => {
    const nextSet = new Set(absentIds);
    if (nextSet.has(studentId)) {
      nextSet.delete(studentId);
    } else {
      nextSet.add(studentId);
    }
    updateAbsentIds(nextSet);
    if (!isPlaying) {
      setWheelSnapshotStudents(null);
    }
  };

  // Open Manual Editor Modal
  const openManualEditor = () => {
    setManualEditorError(null);
    setManualRawText(manualStudents.map(s => `${s.code} - ${s.fullName}`).join('\n'));
    setShowManualEditorModal(true);
  };

  // Save manual list and switch source to 'manual'
  const handleSaveManualList = () => {
    const parsed = parseManualStudentsText(manualRawText);
    if (parsed.length === 0) {
      setManualEditorError('Vui lòng nhập ít nhất 1 học sinh hoặc nhấn “Xóa trắng danh sách”.');
      return;
    }

    hasUserSelectedSourceRef.current = true;
    setManualStudents(parsed);
    saveCustomManualStudents(teacherId, parsed);
    saveCalledSessionIds(teacherId, 'manual', []);
    saveAbsentIds(teacherId, 'manual', []);
    if (selectedSourceKey === 'manual') {
      setCalledSessionIds(new Set());
      setAbsentIds(new Set());
      setPickedResult(null);
      setWheelSnapshotStudents(null);
    } else {
      setSelectedSourceKey('manual');
    }
    setManualEditorError(null);
    setShowManualEditorModal(false);
  };

  // Allow clearing manual list to empty cleanly
  const handleClearManualList = () => {
    hasUserSelectedSourceRef.current = true;
    setManualStudents([]);
    saveCustomManualStudents(teacherId, []);
    saveCalledSessionIds(teacherId, 'manual', []);
    saveAbsentIds(teacherId, 'manual', []);
    if (selectedSourceKey === 'manual') {
      setCalledSessionIds(new Set());
      setAbsentIds(new Set());
      setPickedResult(null);
      setWheelSnapshotStudents(null);
    } else {
      setSelectedSourceKey('manual');
    }
    setManualRawText('');
    setManualEditorError(null);
    setShowManualEditorModal(false);
  };

  const displayedLibraryModes = showAllGames ? CALL_GAME_MODES : CALL_GAME_MODES.slice(0, 5);

  // Reusable Play Stage renderer (shared between normal 65% column and Fullscreen presentation mode)
  const renderPlayStage = () => {
    return (
      <div
        ref={stageContainerRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 bg-gradient-to-b from-[#061D3A] via-[#082B52] to-[#0B396E] text-white p-4 sm:p-6 flex flex-col justify-between overflow-y-auto student-call-container'
            : 'bg-gradient-to-b from-[#072246] via-[#0A2E5C] to-[#08264C] text-white rounded-2xl border border-[#1B4A88] p-4 sm:p-5 shadow-md flex flex-col justify-between h-full relative overflow-hidden'
        }
      >
        {/* Stage Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/15 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg sm:text-xl font-bold text-white truncate">
                {currentModeMeta.title}
              </h3>
              <span className="text-xs font-semibold text-amber-300 whitespace-nowrap">
                · {activeListName}
              </span>
            </div>
            <p className="text-xs text-blue-200 truncate mt-0.5">
              {currentModeMeta.shortDesc}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(isTimerRunning || timerSeconds !== initialTimerSeconds || selectedMode === 'speed_timer') && (
              <button
                type="button"
                onClick={() => setShowTimerModal(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-colors flex items-center space-x-1.5 cursor-pointer tabular-nums ${
                  isTimerRunning
                    ? 'bg-amber-400 text-[#082B52] border-amber-300'
                    : 'bg-white/10 text-amber-200 border-white/20 hover:bg-white/20'
                }`}
                title="Mở điều khiển đồng hồ đếm ngược"
              >
                <TimerIcon className="w-3.5 h-3.5" />
                <span>
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                  {String(timerSeconds % 60).padStart(2, '0')}
                </span>
              </button>
            )}

            <span className="text-xs font-bold text-blue-100 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 tabular-nums whitespace-nowrap">
              Còn lại: {availableStudents.length}
            </span>

            {isFullscreen && (
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#082B52] text-xs font-bold flex items-center space-x-1.5 shadow-md cursor-pointer whitespace-nowrap"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Thoát toàn màn hình</span>
              </button>
            )}
          </div>
        </div>

        {/* Center Stage Body */}
        <div className="flex-1 flex flex-col items-center justify-center py-3 sm:py-4 gap-3.5">
          {/* 1. VÒNG QUAY MAY MẮN */}
          {selectedMode === 'wheel' && (
            <div className="relative flex flex-col items-center">
              {/* Fixed Top Pointer Needle */}
              <div className="relative z-20 -mb-3.5 drop-shadow-lg" aria-hidden="true">
                <svg width="34" height="28" viewBox="0 0 34 28">
                  <polygon
                    points="17,27 3,3 31,3"
                    fill="#EF4444"
                    stroke="#FDE047"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="rounded-full p-1.5 bg-[#061A36] shadow-[0_12px_36px_rgba(0,0,0,0.45)] border-2 border-amber-400/70">
                <canvas
                  ref={wheelCanvasRef}
                  style={{
                    width: isFullscreen ? 380 : 300,
                    height: isFullscreen ? 380 : 300,
                  }}
                  className="rounded-full block max-w-[74vw] max-h-[74vw]"
                />
              </div>
            </div>
          )}

          {/* 2. HỘP QUÀ BÍ MẬT */}
          {selectedMode === 'gift_box' && (
            <div className="w-full max-w-xl">
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                {[0, 1, 2, 3, 4, 5].map(idx => {
                  const isOpened = openedBoxIndex === idx;
                  const isShaking = shakingBoxIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStartGame('gift_box', idx)}
                      disabled={!canPlay}
                      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        isOpened
                          ? 'bg-amber-400/20 border-amber-300 glow-gold scale-105'
                          : isShaking
                          ? 'bg-white/15 border-amber-400 animate-rumble'
                          : 'bg-white/10 border-white/20 hover:bg-white/15 hover:border-amber-300'
                      }`}
                    >
                      <Gift
                        className={`w-10 h-10 sm:w-12 sm:h-12 transition-transform ${
                          isOpened ? 'text-amber-300 scale-110' : 'text-amber-200'
                        }`}
                      />
                      <span className="text-xs font-bold text-white mt-2">
                        {isOpened ? 'Đã mở!' : `Hộp quà ${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. THẺ BÀI LẬT MỞ */}
          {selectedMode === 'cards' && (
            <div className="w-full max-w-2xl">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[0, 1, 2, 3, 4, 5].map(idx => {
                  const isFlipped = flippedCards[idx];
                  const student = cardDeckStudents[idx];
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleStartGame('cards', idx)}
                      disabled={!canPlay}
                      className="h-28 sm:h-32 rounded-2xl perspective-1000 cursor-pointer text-left disabled:cursor-not-allowed"
                    >
                      <div
                        className={`w-full h-full duration-700 transform-style-3d rounded-2xl border-2 relative transition-transform ${
                          isFlipped ? 'rotate-y-180 border-amber-300' : 'border-blue-300/40'
                        }`}
                      >
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#103D7A] to-[#072144] flex flex-col items-center justify-center p-2 backface-hidden">
                          <Layers className="w-7 h-7 text-amber-300 mb-1" />
                          <span className="text-xs font-bold text-white">Thẻ số {idx + 1}</span>
                          <span className="text-[11px] text-blue-200">Tây Đô</span>
                        </div>
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100 text-[#082B52] flex flex-col items-center justify-center p-2 backface-hidden rotate-y-180">
                          <span className="text-[11px] font-bold text-[#006BFF]">
                            {student?.code || ''}
                          </span>
                          <span className="text-sm font-bold text-center leading-tight mt-0.5">
                            {student?.fullName || 'Học sinh'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. BỨC THƯ BỒ CÂU */}
          {selectedMode === 'flying_envelope' && (
            <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-3xl p-6 text-center flex flex-col items-center">
              <div className={`transition-transform duration-500 ${isPlaying ? 'animate-floating scale-105' : ''}`}>
                <GameCardArtwork mode="flying_envelope" className="w-28 h-28" />
              </div>
              <p className="text-sm font-bold text-amber-200 mt-2">
                {isPlaying
                  ? 'Chim bồ câu đang đưa lá thư tới...'
                  : envelopeOpened && pickedResult?.[0]
                  ? `Thư đã mở: ${pickedResult[0].fullName}`
                  : 'Sẵn sàng mở bức thư chọn học sinh'}
              </p>
            </div>
          )}

          {/* 5. TÊN LỬA KHÔNG GIAN */}
          {selectedMode === 'rocket' && (
            <div className="w-full max-w-md bg-[#051833] border border-blue-400/30 rounded-3xl p-6 text-center flex flex-col items-center">
              {rocketCountdown !== null ? (
                <div className="h-28 flex items-center justify-center">
                  <span className="text-6xl font-bold text-amber-300 tabular-nums animate-rumble">
                    {rocketCountdown === 0 ? 'PHÓNG!' : rocketCountdown}
                  </span>
                </div>
              ) : (
                <div className={isPlaying ? 'animate-rumble' : 'animate-floating'}>
                  <GameCardArtwork mode="rocket" className="w-28 h-28" />
                </div>
              )}
              <p className="text-sm font-bold text-blue-100 mt-2">
                {rocketCountdown !== null
                  ? 'Đang chuẩn bị rời bệ phóng...'
                  : 'Đếm ngược 3 - 2 - 1 để chọn học sinh lên bảng'}
              </p>
            </div>
          )}

          {/* 6. LỒNG CẦU BỐC THĂM */}
          {selectedMode === 'magic_sphere' && (
            <div className="w-full max-w-md bg-white/10 border border-white/20 rounded-3xl p-6 text-center flex flex-col items-center">
              <div className={isPlaying ? 'animate-tumble' : ''}>
                <GameCardArtwork mode="magic_sphere" className="w-28 h-28" />
              </div>
              <div className="mt-3 min-h-[28px] text-base font-bold text-amber-300">
                {isPlaying && rollingPreviewNames[0]
                  ? rollingPreviewNames[0]
                  : 'Quay lồng cầu chọn ngẫu nhiên 1 học sinh'}
              </div>
            </div>
          )}

          {/* 7. CẶP ĐÔI ĐỐI ĐẦU (2 BẠN) */}
          {selectedMode === 'call_pair' && (
            <div className="w-full max-w-xl bg-white/10 border border-white/20 rounded-3xl p-5 flex items-center justify-around gap-3">
              <div className="flex-1 bg-[#082B52]/90 border border-blue-300/30 rounded-2xl p-4 text-center min-h-[116px] flex flex-col items-center justify-center">
                <Users className="w-7 h-7 text-blue-300 mb-1.5" />
                <span className="text-xs text-blue-200 font-semibold">Bạn thứ 1</span>
                <span className="text-base sm:text-lg font-bold text-white mt-1">
                  {isPlaying && rollingPreviewNames[0]
                    ? rollingPreviewNames[0]
                    : pickedResult?.[0]?.fullName || 'Chờ bắt cặp'}
                </span>
              </div>

              <div className="w-12 h-12 rounded-full bg-rose-600 border-2 border-amber-300 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                VS
              </div>

              <div className="flex-1 bg-[#082B52]/90 border border-purple-300/30 rounded-2xl p-4 text-center min-h-[116px] flex flex-col items-center justify-center">
                <Users className="w-7 h-7 text-purple-300 mb-1.5" />
                <span className="text-xs text-purple-200 font-semibold">Bạn thứ 2</span>
                <span className="text-base sm:text-lg font-bold text-white mt-1">
                  {isPlaying && rollingPreviewNames[1]
                    ? rollingPreviewNames[1]
                    : pickedResult?.[1]?.fullName || 'Chờ bắt cặp'}
                </span>
              </div>
            </div>
          )}

          {/* 8. NHÓM BA BẠN (3 BẠN) */}
          {selectedMode === 'call_trio' && (
            <div className="w-full max-w-2xl bg-white/10 border border-white/20 rounded-3xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map(slot => (
                <div
                  key={slot}
                  className="bg-[#082B52]/90 border border-emerald-300/30 rounded-2xl p-4 text-center min-h-[108px] flex flex-col items-center justify-center"
                >
                  <UserPlus className="w-6 h-6 text-emerald-300 mb-1" />
                  <span className="text-xs text-emerald-200 font-semibold">Thành viên {slot + 1}</span>
                  <span className="text-sm sm:text-base font-bold text-white mt-1">
                    {isPlaying && rollingPreviewNames[slot]
                      ? rollingPreviewNames[slot]
                      : pickedResult?.[slot]?.fullName || 'Chờ chọn'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 9. CHIẾC NÓN TỐC ĐỘ */}
          {selectedMode === 'speed_timer' && (
            <div className="w-full max-w-md bg-white/10 border border-amber-300/40 rounded-3xl p-5 text-center flex flex-col items-center">
              <div className="text-5xl font-mono font-bold text-amber-300 tabular-nums tracking-wider">
                {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                {String(timerSeconds % 60).padStart(2, '0')}
              </div>
              <p className="text-sm font-bold text-white mt-2 min-h-[24px]">
                {isPlaying && rollingPreviewNames[0]
                  ? rollingPreviewNames[0]
                  : 'Chọn ngẫu nhiên 1 học sinh và bật đồng hồ 30 giây'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTimerRunning(prev => !prev)}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer"
                >
                  {isTimerRunning ? 'Tạm dừng' : 'Chạy đồng hồ'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(30);
                    setInitialTimerSeconds(30);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold text-white cursor-pointer"
                >
                  Đặt 30s
                </button>
              </div>
            </div>
          )}

          {/* 10. NGÔI SAO HI VỌNG */}
          {selectedMode === 'star_of_hope' && (
            <div className="w-full max-w-md bg-amber-400/15 border border-amber-300/50 rounded-3xl p-6 text-center flex flex-col items-center glow-gold">
              <div className={isPlaying ? 'animate-tumble' : 'animate-floating'}>
                <GameCardArtwork mode="star_of_hope" className="w-28 h-28" />
              </div>
              <p className="text-base font-bold text-amber-200 mt-2 min-h-[24px]">
                {isPlaying && rollingPreviewNames[0]
                  ? rollingPreviewNames[0]
                  : 'Trao Ngôi sao hi vọng (x2 điểm hoặc quyền trợ giúp)'}
              </p>
            </div>
          )}

          {/* Inline Result Banner (Visible in both normal & Fullscreen modes!) */}
          {pickedResult && pickedResult.length > 0 && (
            <div className="w-full max-w-xl bg-white text-[#082B52] rounded-2xl border-2 border-amber-400 p-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wide text-[#006BFF]">
                    Kết quả lượt gọi · {currentModeMeta.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickedResult(null);
                    setWheelSnapshotStudents(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-end sm:self-auto cursor-pointer"
                >
                  Đóng kết quả
                </button>
              </div>

              <div className="py-2.5 space-y-2">
                {pickedResult.map((student, idx) => (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-[#F3F8FF] border border-[#DCE8F7] rounded-xl px-4 py-2.5"
                  >
                    <div>
                      <span className="text-xs font-bold text-[#006BFF]">
                        {pickedResult.length > 1 ? `Bạn #${idx + 1} · ` : ''}
                        {student.code}
                      </span>
                      <div className="text-xl sm:text-2xl font-bold text-[#082B52] leading-tight">
                        {student.fullName}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {activeListName}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={resultScoreNote}
                  onChange={e => handleUpdateScoreNote(e.target.value)}
                  placeholder="Ghi chú nhanh (VD: +2 điểm, trả lời tốt)..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-[#DCE8F7] text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInitialTimerSeconds(30);
                    setTimerSeconds(30);
                    setIsTimerRunning(true);
                    if (!isFullscreen) setShowTimerModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center space-x-1 cursor-pointer whitespace-nowrap"
                >
                  <TimerIcon className="w-3.5 h-3.5" />
                  <span>Đếm 30s</span>
                </button>
              </div>
            </div>
          )}

          {/* Empty or Insufficient Students Notice */}
          {eligibilityIssue && (
            <div className="w-full max-w-xl bg-amber-50 text-[#082B52] border-2 border-amber-300 rounded-2xl p-3.5 sm:p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-2.5 text-xs sm:text-sm">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="font-semibold leading-snug">{eligibilityIssue.message}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {eligibilityIssue.type === 'empty_class' && (
                  <button
                    type="button"
                    onClick={openManualEditor}
                    className="px-3.5 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Nhập danh sách</span>
                  </button>
                )}

                {(eligibilityIssue.type === 'all_absent' || eligibilityIssue.type === 'insufficient_present') && (
                  <button
                    type="button"
                    onClick={() => setShowAbsentModal(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Kiểm tra vắng mặt</span>
                  </button>
                )}

                {eligibilityIssue.type === 'exhausted_session' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmModal(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Đặt lại phiên</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAntiDuplicate(false)}
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      Tắt chống trùng
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stage Bottom Primary Action Button */}
        <div className="pt-2 flex flex-col items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => handleStartGame(selectedMode)}
            disabled={!canPlay}
            className="px-9 py-3 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 text-[#082B52] font-bold text-base sm:text-lg shadow-[0_6px_20px_rgba(245,158,11,0.4)] disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none flex items-center space-x-2.5 transition-transform active:scale-95 cursor-pointer whitespace-nowrap"
          >
            {selectedMode === 'wheel' ? (
              <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} />
            ) : selectedMode === 'rocket' ? (
              <Rocket className="w-5 h-5" />
            ) : selectedMode === 'star_of_hope' ? (
              <Star className="w-5 h-5 fill-[#082B52]" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span>{isPlaying ? currentModeMeta.playingLabel : currentModeMeta.actionLabel}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 student-call-container pb-10">
      {/* 1. COMPACT TOP HEADER & TOOLBAR */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-[#082B52]">
            Trò chơi gọi học sinh
          </h2>
          <span className="text-xs text-slate-500 font-semibold">
            THCS Tây Đô · {activeListName} · {allCurrentStudents.length} học sinh
          </span>
        </div>

        {/* Single unified action bar directly below heading */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-2.5 border-t border-slate-100">
          {/* Chọn lớp */}
          <div className="flex items-center space-x-2 flex-1 min-w-[210px] sm:max-w-xs">
            <label htmlFor="class-source-select" className="text-xs font-bold text-[#082B52] whitespace-nowrap">
              Chọn lớp:
            </label>
            <select
              id="class-source-select"
              value={selectedSourceKey}
              onChange={e => {
                hasUserSelectedSourceRef.current = true;
                setSelectedSourceKey(e.target.value);
              }}
              disabled={isPlaying}
              className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-[#F8FBFF] text-xs sm:text-sm font-bold text-[#082B52] focus:ring-2 focus:ring-[#006BFF] focus:outline-hidden disabled:opacity-60"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  {formatClassDisplayName(c.name)} ({c.students.length} học sinh)
                </option>
              ))}
              <option value="manual">Danh sách nhập tay ({manualStudents.length} học sinh)</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Nhập danh sách */}
            <button
              type="button"
              onClick={openManualEditor}
              disabled={isPlaying}
              className="px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white hover:bg-[#F3F8FF] text-[#082B52] text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#006BFF]" />
              <span>Nhập danh sách</span>
            </button>

            {/* Âm thanh */}
            <button
              type="button"
              onClick={() => setIsMuted(prev => !prev)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                isMuted
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-[#DCE8F7] bg-white hover:bg-[#F3F8FF] text-[#082B52]'
              }`}
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isMuted ? 'Âm thanh: Tắt' : 'Âm thanh'}</span>
            </button>

            {/* Đếm ngược */}
            <button
              type="button"
              onClick={() => setShowTimerModal(true)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                isTimerRunning
                  ? 'bg-amber-400 border-amber-500 text-[#082B52]'
                  : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
              }`}
            >
              <TimerIcon className="w-3.5 h-3.5" />
              <span>
                {isTimerRunning
                  ? `Đếm ngược (${timerSeconds}s)`
                  : 'Đếm ngược'}
              </span>
            </button>

            {/* Toàn màn hình */}
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="px-3 py-2 rounded-xl bg-[#006BFF] hover:bg-blue-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Toàn màn hình</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN TWO-COLUMN WORKSPACE: LEFT 65% STAGE + RIGHT 35% STATS & HISTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] gap-4 items-stretch">
        {/* LEFT COLUMN (65%): ACTIVE GAME STAGE */}
        <div className="min-w-0">{renderPlayStage()}</div>

        {/* RIGHT COLUMN (35%): SESSION STATS, ANTI-DUPLICATE, HISTORY, RESET */}
        <aside className="bg-white rounded-2xl border border-[#DCE8F7] p-4 shadow-xs flex flex-col justify-between gap-3.5 min-w-0">
          {/* Top Stats + Controls */}
          <div className="space-y-3">
            {/* 4 Real Session Counters */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-[#F3F8FF] border border-[#DCE8F7]">
                <div className="text-xs font-semibold text-slate-500">Sĩ số</div>
                <div className="text-xl font-bold text-[#082B52] tabular-nums mt-0.5">
                  {allCurrentStudents.length}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="text-xs font-semibold text-[#006BFF]">Đã gọi</div>
                <div className="text-xl font-bold text-[#006BFF] tabular-nums mt-0.5">
                  {calledInClassCount}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-700">Còn lại</div>
                <div className="text-xl font-bold text-emerald-800 tabular-nums mt-0.5">
                  {availableStudents.length}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAbsentModal(true)}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  absentInClassCount > 0
                    ? 'bg-rose-50 border-rose-200 hover:bg-rose-100'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
                title="Nhấp để điểm danh học sinh vắng mặt"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-rose-700">
                  <span>Vắng mặt</span>
                  <span className="underline text-[11px]">Điểm danh</span>
                </div>
                <div className="text-xl font-bold text-rose-800 tabular-nums mt-0.5">
                  {absentInClassCount}
                </div>
              </button>
            </div>

            {/* Anti-Duplicate Switch */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#F8FBFF] border border-[#DCE8F7]">
              <div>
                <div className="text-xs font-bold text-[#082B52]">Chống trùng</div>
                <div className="text-[11px] text-slate-500">
                  Không gọi lại học sinh đã lên trong phiên
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={antiDuplicate}
                aria-label="Chống trùng"
                onClick={() => {
                  setAntiDuplicate(prev => !prev);
                  if (!isPlaying) setWheelSnapshotStudents(null);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                  antiDuplicate ? 'bg-[#006BFF]' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    antiDuplicate ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Call History Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#082B52] flex items-center space-x-1.5">
                  <History className="w-4 h-4 text-[#006BFF]" />
                  <span>Lịch sử lượt gọi ({historyItems.length})</span>
                </h3>

                <div className="flex items-center space-x-2">
                  {historyItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHistoryModal(true)}
                      className="text-xs font-bold text-[#006BFF] hover:underline cursor-pointer"
                    >
                      Mở rộng
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[196px] overflow-y-auto space-y-1.5 pr-1">
                {historyItems.length === 0 ? (
                  <div className="py-6 px-3 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-xs text-slate-500">
                    Chưa có lượt gọi nào trong danh sách này.
                  </div>
                ) : (
                  historyItems.slice(0, 12).map((item, idx) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-[#082B52] truncate">
                          #{historyItems.length - idx}. {item.selectedStudents.map(s => s.fullName).join(', ')}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {item.modeName}
                          {item.scoreNote ? ` · ${item.scoreNote}` : ''}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Bottom Reset Session Button */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowResetConfirmModal(true)}
              disabled={calledInClassCount === 0 && !pickedResult}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#082B52] disabled:opacity-45 disabled:cursor-not-allowed text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại phiên</span>
            </button>
          </div>
        </aside>
      </div>

      {/* 3. BOTTOM SECTION: 10 GAME LIBRARY ("CHỌN TRÒ CHƠI") */}
      <section className="bg-white rounded-2xl border border-[#DCE8F7] p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-[#082B52]">Chọn trò chơi</h3>
            <p className="text-xs text-slate-500">
              Chọn hình thức gọi học sinh phù hợp cho tiết dạy trình chiếu.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAllGames(prev => !prev)}
            className="px-4 py-2 rounded-xl border border-[#DCE8F7] bg-[#F3F8FF] hover:bg-blue-100 text-[#006BFF] text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            {showAllGames ? (
              <>
                <ChevronUp className="w-4 h-4" />
                <span>Thu gọn còn 5 trò</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>Xem tất cả 10 trò</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {displayedLibraryModes.map(mode => {
            const isSelected = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => handleSelectGameMode(mode.id)}
                disabled={isPlaying}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                  CARD_PASTEL_STYLES[mode.id]
                } ${
                  isSelected
                    ? 'border-2 border-[#006BFF] ring-2 ring-[#006BFF]/25 shadow-md'
                    : 'shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-14 h-14 rounded-xl bg-white/85 border border-black/5 flex items-center justify-center p-1.5 shadow-2xs">
                    <GameCardArtwork mode={mode.id} className="w-11 h-11" />
                  </div>
                  <span className="text-xs font-bold text-[#082B52]/75">
                    {mode.badge}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm sm:text-base text-[#082B52] leading-snug">
                    {mode.title}
                  </h4>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                    {mode.shortDesc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. MODAL ĐIỂM DANH / VẮNG MẶT */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-md w-full shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserX className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-[#082B52] text-lg">Điểm danh / Học sinh vắng mặt</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAbsentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-3">
              Tích chọn học sinh vắng mặt. Những học sinh này sẽ không được gọi trong tất cả trò chơi (bao gồm gọi đơn, cặp đôi và nhóm ba).
            </p>

            <div className="flex items-center justify-between text-xs font-semibold mb-2 px-1">
              <span className="text-slate-500">Đang vắng: {absentInClassCount} học sinh</span>
              {absentInClassCount > 0 && (
                <button
                  type="button"
                  onClick={() => updateAbsentIds(new Set())}
                  className="text-[#006BFF] hover:underline cursor-pointer"
                >
                  Có mặt tất cả
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {allCurrentStudents.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Danh sách lớp hiện đang trống.
                </div>
              ) : (
                allCurrentStudents.map(student => {
                  const isAbsent = absentIds.has(student.id);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                        isAbsent
                          ? 'bg-rose-50 border-rose-200 text-rose-800 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          checked={isAbsent}
                          onChange={() => handleToggleAbsent(student.id)}
                          className="rounded-sm text-rose-600 focus:ring-rose-500 h-4 w-4"
                        />
                        <span>
                          <b className="text-slate-900">{student.fullName}</b> ({student.code})
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {isAbsent ? 'Vắng' : 'Có mặt'}
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                type="button"
                onClick={() => setShowAbsentModal(false)}
                className="px-5 py-2 bg-[#006BFF] text-white font-bold text-xs rounded-xl hover:bg-blue-600 shadow-xs cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL LỊCH SỬ ĐẦY ĐỦ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-xl w-full shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-[#006BFF]" />
                <h3 className="font-bold text-[#082B52] text-lg">
                  Lịch sử lượt gọi ({activeListName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmClearHistory(false);
                  setShowHistoryModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <History className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">Chưa có lượt gọi nào trong lịch sử.</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-2 my-3 pr-1">
                {historyItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between text-xs gap-3"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-[#006BFF] tabular-nums">
                          #{historyItems.length - idx}
                        </span>
                        <span className="font-semibold text-slate-600">{item.modeName}</span>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {new Date(item.timestamp).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="font-bold text-[#082B52] text-sm">
                        {item.selectedStudents.map(s => s.fullName).join(', ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.selectedStudents.map(s => s.code).join(' · ')}
                        {item.scoreNote ? ` · Ghi chú: ${item.scoreNote}` : ''}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                      {item.className}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              {confirmClearHistory ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-700">Xác nhận xóa lịch sử?</span>
                  <button
                    type="button"
                    onClick={handleClearHistoryConfirmed}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Xóa ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearHistory(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearHistory(true)}
                  disabled={historyItems.length === 0}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center space-x-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa lịch sử</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setConfirmClearHistory(false);
                  setShowHistoryModal(false);
                }}
                className="px-5 py-2 bg-[#006BFF] text-white font-bold text-xs rounded-xl hover:bg-blue-600 shadow-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL ĐỒNG HỒ ĐẾM NGƯỢC */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <TimerIcon className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-[#082B52] text-lg">Đồng hồ đếm ngược</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTimerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-6 px-4 rounded-3xl bg-[#082B52] text-white font-mono text-6xl font-bold tracking-widest tabular-nums shadow-inner my-2">
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
              {String(timerSeconds % 60).padStart(2, '0')}
            </div>

            <div className="grid grid-cols-4 gap-2 my-4">
              {[15, 30, 45, 60].map(sec => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => {
                    setIsTimerRunning(false);
                    setInitialTimerSeconds(sec);
                    setTimerSeconds(sec);
                  }}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    initialTimerSeconds === sec
                      ? 'bg-[#006BFF] text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setIsTimerRunning(prev => !prev)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md flex items-center space-x-1.5 cursor-pointer ${
                  isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isTimerRunning ? 'Tạm dừng' : 'Bắt đầu'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(initialTimerSeconds);
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL XÁC NHẬN ĐẶT LẠI PHIÊN */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-amber-200 p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#082B52] text-lg">Đặt lại phiên gọi?</h3>
            <p className="text-xs text-slate-600 my-2 leading-relaxed">
              Thao tác này sẽ đưa {calledInClassCount} học sinh đã gọi trong phiên này quay lại danh sách chờ gọi (giữ nguyên danh sách vắng mặt).
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="px-5 py-2 rounded-xl bg-[#006BFF] text-white text-xs font-bold hover:bg-blue-600 shadow-xs cursor-pointer"
              >
                Xác nhận đặt lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL NHẬP DANH SÁCH HỌC SINH */}
      {showManualEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#006BFF]" />
                <h3 className="font-bold text-[#082B52] text-lg">Nhập danh sách học sinh</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowManualEditorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-3 leading-relaxed">
              Mỗi dòng là một học sinh. Hỗ trợ nhập <code>Mã - Họ và tên</code> hoặc chỉ nhập <code>Họ và tên</code>. Khi lưu, hệ thống sẽ chuyển sang dùng danh sách này ngay.
            </p>

            <textarea
              rows={9}
              value={manualRawText}
              onChange={e => {
                setManualRawText(e.target.value);
                setManualEditorError(null);
              }}
              placeholder="HT01 - Nguyễn Văn An&#10;HT02 - Trần Thị Bình&#10;HT03 - Lê Minh Châu"
              className="w-full p-3 rounded-xl border border-[#DCE8F7] text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
            />

            {manualEditorError && (
              <p className="text-xs font-bold text-rose-600 mt-2">{manualEditorError}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleClearManualList}
                className="px-3.5 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Xóa trắng danh sách
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualEditorModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualList}
                  className="px-5 py-2 bg-[#006BFF] text-white text-xs font-bold rounded-xl hover:bg-blue-600 shadow-xs cursor-pointer"
                >
                  Lưu danh sách
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
