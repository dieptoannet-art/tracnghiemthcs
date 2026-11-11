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
} from './studentCallRules';
import './studentCallGames.css';
import {
  Users,
  UserX,
  RotateCcw,
  History,
  Timer as TimerIcon,
  Volume2,
  VolumeX,
  Sparkles,
  Edit3,
  CheckCircle,
  HelpCircle,
  Play,
  Pause,
  Shuffle,
  Award,
  Layers,
  Gift,
  Disc,
  Mail,
  CircleDot,
  Rocket,
  UserPlus,
  ArrowRight,
  X,
  Clock,
  Trash2,
  Star,
} from 'lucide-react';

// Web Audio API Sound Synthesizer (No external assets required)
class SoundPlayer {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }

  playFanfare() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0, this.ctx.currentTime + i * 0.1);
        gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + i * 0.1 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + i * 0.1);
        osc.stop(this.ctx.currentTime + i * 0.1 + 0.45);
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
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 1.2);
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
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch {}
  }
}

const sounds = new SoundPlayer();

export const StudentCallGames: React.FC = () => {
  const { classes, user } = useApp();
  const teacherId = user?.id || 'gv_dieptoantoan';

  // State: Source of students (Class or Manual List)
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(() => {
    return classes[0]?.id || 'manual';
  });

  // Manual list state
  const [manualStudents, setManualStudents] = useState<StudentCandidate[]>(() => {
    return loadCustomManualStudents(teacherId);
  });
  const [showManualEditorModal, setShowManualEditorModal] = useState<boolean>(false);
  const [manualRawText, setManualRawText] = useState<string>('');

  // Selected Game Mode (1 of 10)
  const [selectedMode, setSelectedMode] = useState<CallGameMode>('wheel');

  // Anti-duplicate rule toggle (Default: ON)
  const [antiDuplicate, setAntiDuplicate] = useState<boolean>(true);

  // Sound Muted toggle
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Absent student IDs
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());

  // Called students in current session
  const [calledSessionIds, setCalledSessionIds] = useState<Set<string>>(new Set());

  // Call history
  const [historyItems, setHistoryItems] = useState<CallHistoryItem[]>([]);

  // Modals state
  const [showAbsentModal, setShowAbsentModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showTimerModal, setShowTimerModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);

  // Selection result modal
  const [pickedResult, setPickedResult] = useState<StudentCandidate[] | null>(null);
  const [resultScoreNote, setResultScoreNote] = useState<string>('');

  // Running game animation state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Wheel animation states
  const wheelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [wheelRotation, setWheelRotation] = useState<number>(0);

  // Card flip states
  const [flippedCards, setFlippedCards] = useState<boolean[]>([]);
  const [cardDeckStudents, setCardDeckStudents] = useState<StudentCandidate[]>([]);

  // Mystery gift boxes states
  const [openedBoxIndex, setOpenedBoxIndex] = useState<number | null>(null);

  // Rocket countdown state
  const [rocketCountdown, setRocketCountdown] = useState<number | null>(null);

  // Timer Widget state
  const [timerSeconds, setTimerSeconds] = useState<number>(30);
  const [initialTimerSeconds, setInitialTimerSeconds] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // 1. Resolve active candidate list
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
    return activeClassRoom ? `Lớp ${activeClassRoom.name}` : 'Lớp học';
  }, [selectedSourceKey, activeClassRoom]);

  // 2. Load cached absent IDs, session called IDs, and history when source changes
  useEffect(() => {
    const loadedAbsent = loadAbsentIds(teacherId, selectedSourceKey);
    setAbsentIds(new Set(loadedAbsent));

    const loadedCalled = loadCalledSessionIds(teacherId, selectedSourceKey);
    setCalledSessionIds(new Set(loadedCalled));

    const loadedHistory = loadCallHistory(teacherId, selectedSourceKey);
    setHistoryItems(loadedHistory);
  }, [teacherId, selectedSourceKey]);

  // 3. Save absent IDs when changed
  const updateAbsentIds = useCallback((newSet: Set<string>) => {
    setAbsentIds(newSet);
    saveAbsentIds(teacherId, selectedSourceKey, Array.from(newSet));
  }, [teacherId, selectedSourceKey]);

  // 4. Save session called IDs when changed
  const updateCalledSessionIds = useCallback((newSet: Set<string>) => {
    setCalledSessionIds(newSet);
    saveCalledSessionIds(teacherId, selectedSourceKey, Array.from(newSet));
  }, [teacherId, selectedSourceKey]);

  // 5. Available pool calculation
  const availableStudents = useMemo(() => {
    return getAvailableStudents(allCurrentStudents, absentIds, calledSessionIds, antiDuplicate);
  }, [allCurrentStudents, absentIds, calledSessionIds, antiDuplicate]);

  // Sound mute sync
  useEffect(() => {
    sounds.muted = isMuted;
  }, [isMuted]);

  // Timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev <= 4 && prev > 1) {
            sounds.playTimerBeep();
          } else if (prev === 1) {
            sounds.playBell();
            setIsTimerRunning(false);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  // Handle Wheel Canvas Drawing
  useEffect(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;

    ctx.clearRect(0, 0, width, height);

    // If available list is empty, draw placeholder
    const listToDraw = availableStudents.length > 0 ? availableStudents : allCurrentStudents;
    const totalSlices = Math.max(listToDraw.length, 1);
    const sliceAngle = (2 * Math.PI) / totalSlices;

    const colors = [
      '#006BFF', '#22C55E', '#F59E0B', '#EF4444',
      '#8B5CF6', '#06B6D4', '#EC4899', '#3B82F6',
      '#10B981', '#F97316'
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((wheelRotation * Math.PI) / 180);

    for (let i = 0; i < totalSlices; i++) {
      const startAngle = i * sliceAngle;
      const endAngle = startAngle + sliceAngle;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px "Times New Roman", Times, serif';

      const studentName = listToDraw[i]?.fullName || `Số ${i + 1}`;
      const displayName = studentName.length > 14 ? studentName.slice(0, 12) + '…' : studentName;
      ctx.fillText(displayName, radius - 18, 5);
      ctx.restore();
    }

    ctx.restore();

    // Center Hub
    ctx.beginPath();
    ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI);
    ctx.fillStyle = '#082B52';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#F59E0B';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText('TÂY ĐÔ', centerX, centerY + 4);
  }, [availableStudents, allCurrentStudents, wheelRotation]);

  // Trigger Call Action
  const handleStartGame = (mode: CallGameMode = selectedMode) => {
    if (isPlaying) return;

    // Check availability
    if (availableStudents.length === 0) {
      if (antiDuplicate && calledSessionIds.size > 0) {
        alert('Tất cả học sinh có mặt đã được gọi trong phiên này! Bạn có thể nhấn "Đặt lại phiên gọi" để bắt đầu vòng mới.');
      } else {
        alert('Không có học sinh khả dụng để gọi. Vui lòng kiểm tra lại danh sách hoặc danh sách vắng.');
      }
      return;
    }

    const currentMeta = CALL_GAME_MODES.find(m => m.id === mode) || CALL_GAME_MODES[0];
    const pickCount = currentMeta.pickCount;

    setIsPlaying(true);
    setPickedResult(null);
    setResultScoreNote('');

    // Pre-determine winners
    const winners = pickRandomStudents(availableStudents, pickCount);

    if (mode === 'wheel') {
      // Rotate wheel
      const spins = 5 + Math.floor(Math.random() * 3);
      const targetDegrees = wheelRotation + spins * 360 + Math.floor(Math.random() * 360);
      const duration = 3500;
      const startTime = performance.now();

      const animateWheel = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentDeg = wheelRotation + (targetDegrees - wheelRotation) * easeOut;
        setWheelRotation(currentDeg);

        if (Math.floor(currentDeg / 30) % 2 === 0) {
          sounds.playTick();
        }

        if (progress < 1) {
          requestAnimationFrame(animateWheel);
        } else {
          finishSelection(winners, mode, currentMeta.title);
        }
      };
      requestAnimationFrame(animateWheel);
    } else if (mode === 'cards') {
      // Shuffle & card flip
      const deck = pickRandomStudents(availableStudents, Math.min(6, availableStudents.length));
      if (!deck.some(d => d.id === winners[0].id)) {
        deck[0] = winners[0];
      }
      setCardDeckStudents(deck);
      setFlippedCards(new Array(deck.length).fill(false));

      setTimeout(() => {
        sounds.playTick();
        const winIdx = deck.findIndex(d => d.id === winners[0].id);
        const nextFlips = new Array(deck.length).fill(false);
        nextFlips[winIdx] = true;
        setFlippedCards(nextFlips);
        setTimeout(() => {
          finishSelection(winners, mode, currentMeta.title);
        }, 1200);
      }, 1500);
    } else if (mode === 'gift_box') {
      setOpenedBoxIndex(null);
      setTimeout(() => {
        const randBox = Math.floor(Math.random() * 6);
        setOpenedBoxIndex(randBox);
        sounds.playTick();
        setTimeout(() => {
          finishSelection(winners, mode, currentMeta.title);
        }, 1200);
      }, 1200);
    } else if (mode === 'rocket') {
      setRocketCountdown(3);
      sounds.playTick();
      const interval = setInterval(() => {
        setRocketCountdown(prev => {
          if (prev === null) return null;
          if (prev > 1) {
            sounds.playTick();
            return prev - 1;
          }
          clearInterval(interval);
          sounds.playFanfare();
          setTimeout(() => {
            setRocketCountdown(null);
            finishSelection(winners, mode, currentMeta.title);
          }, 1000);
          return 0;
        });
      }, 800);
    } else if (mode === 'speed_timer') {
      // Rapid shuffle then auto trigger 30s timer
      let counter = 0;
      const shuffleInterval = setInterval(() => {
        sounds.playTick();
        counter++;
        if (counter > 14) {
          clearInterval(shuffleInterval);
          finishSelection(winners, mode, currentMeta.title);
          // Auto start 30s timer
          setInitialTimerSeconds(30);
          setTimerSeconds(30);
          setIsTimerRunning(true);
        }
      }, 100);
    } else {
      // Generic dramatic pick with fanfare
      let counter = 0;
      const shuffleInterval = setInterval(() => {
        sounds.playTick();
        counter++;
        if (counter > 12) {
          clearInterval(shuffleInterval);
          finishSelection(winners, mode, currentMeta.title);
        }
      }, 120);
    }
  };

  const finishSelection = (
    winners: StudentCandidate[],
    mode: CallGameMode,
    modeTitle: string
  ) => {
    setIsPlaying(false);
    setPickedResult(winners);
    sounds.playFanfare();

    // 1. Add to session called IDs if antiDuplicate is on
    const newCalled = new Set(calledSessionIds);
    winners.forEach(w => newCalled.add(w.id));
    updateCalledSessionIds(newCalled);

    // 2. Add to history
    const historyEntry: CallHistoryItem = {
      id: `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      classId: selectedSourceKey,
      className: activeListName,
      mode,
      modeName: modeTitle,
      selectedStudents: winners,
    };

    const newHistory = [historyEntry, ...historyItems];
    setHistoryItems(newHistory);
    saveCallHistory(teacherId, selectedSourceKey, newHistory);
  };

  // Reset Session
  const handleResetSession = () => {
    updateCalledSessionIds(new Set());
    setShowResetConfirmModal(false);
  };

  // Clear All History
  const handleClearHistory = () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử gọi học sinh của danh sách này không?')) {
      clearCallHistory(teacherId, selectedSourceKey);
      setHistoryItems([]);
      setShowHistoryModal(false);
    }
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
  };

  // Save manual students
  const handleSaveManualList = () => {
    const lines = manualRawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Vui lòng nhập ít nhất 1 học sinh!');
      return;
    }

    const parsed: StudentCandidate[] = lines.map((line, index) => {
      const parts = line.split(/[-–—:]/).map(p => p.trim());
      let code = `HS${String(index + 1).padStart(2, '0')}`;
      let name = line;
      if (parts.length >= 2) {
        code = parts[0];
        name = parts.slice(1).join(' ');
      }
      return {
        id: `manual-${index + 1}-${Date.now()}`,
        code,
        fullName: name,
        gender: index % 2 === 0 ? 'Nam' : 'Nữ',
      };
    });

    setManualStudents(parsed);
    saveCustomManualStudents(teacherId, parsed);
    setShowManualEditorModal(false);
  };

  return (
    <div className="space-y-6 student-call-container pb-12">
      {/* 1. TOP HEADER & CLASS SELECTOR */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EBF3FC] text-[#006BFF] border border-[#DCE8F7]">
                Phân hệ Giáo viên
              </span>
              <span className="text-xs font-semibold text-slate-500">THCS Tây Đô</span>
            </div>
            <h2 className="text-2xl font-bold text-[#082B52] mt-1">
              Trò chơi Gọi học sinh & Tương tác lớp học
            </h2>
            <p className="text-sm text-slate-600">
              Công cụ gọi ngẫu nhiên công bằng, không trùng lặp, tích hợp 10 trò chơi sinh động và đồng hồ đếm ngược.
            </p>
          </div>

          {/* Quick Tools */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsMuted(prev => !prev)}
              className="px-3 py-2 rounded-xl border border-[#DCE8F7] text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center space-x-1.5 transition-colors"
              title={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
              <span>{isMuted ? 'Tắt âm' : 'Âm thanh'}</span>
            </button>

            <button
              onClick={() => setShowTimerModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <TimerIcon className="w-4 h-4 text-amber-600" />
              <span>Đồng hồ đếm ngược</span>
            </button>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="px-3.5 py-2 rounded-xl bg-[#EBF3FC] text-[#006BFF] border border-[#DCE8F7] hover:bg-blue-100 text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <History className="w-4 h-4 text-[#006BFF]" />
              <span>Lịch sử ({historyItems.length})</span>
            </button>
          </div>
        </div>

        {/* CONTROLS ROW */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Source Selector */}
          <div className="md:col-span-5 flex items-center space-x-2">
            <label className="text-xs font-bold text-slate-700 shrink-0">Chọn lớp:</label>
            <select
              value={selectedSourceKey}
              onChange={e => setSelectedSourceKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] bg-white text-sm font-bold text-[#082B52] focus:ring-2 focus:ring-[#006BFF] focus:outline-hidden"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id}>
                  Lớp {c.name} ({c.studentCount || c.students.length} học sinh)
                </option>
              ))}
              <option value="manual">📋 Danh sách nhập tay ({manualStudents.length} bạn)</option>
            </select>

            {selectedSourceKey === 'manual' && (
              <button
                onClick={() => {
                  setManualRawText(manualStudents.map(s => `${s.code} - ${s.fullName}`).join('\n'));
                  setShowManualEditorModal(true);
                }}
                className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 flex items-center space-x-1"
                title="Chỉnh sửa danh sách nhập tay"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Sửa</span>
              </button>
            )}
          </div>

          {/* Stat Badges */}
          <div className="md:col-span-7 flex flex-wrap items-center justify-start md:justify-end gap-2 text-xs">
            <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold border border-slate-200">
              Sĩ số: <b>{allCurrentStudents.length}</b>
            </span>

            <button
              onClick={() => setShowAbsentModal(true)}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors flex items-center space-x-1 ${
                absentIds.size > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Vắng mặt: <b>{absentIds.size}</b></span>
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-[#006BFF] font-semibold border border-blue-200">
              Đã gọi: <b>{calledSessionIds.size}</b>
            </span>

            <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
              Khả dụng: <b>{availableStudents.length}</b>
            </span>

            {/* Anti duplicate toggle */}
            <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#F3F8FF] border border-[#DCE8F7] cursor-pointer text-slate-700 select-none">
              <input
                type="checkbox"
                checked={antiDuplicate}
                onChange={e => setAntiDuplicate(e.target.checked)}
                className="rounded-sm text-[#006BFF] focus:ring-blue-500 h-3.5 w-3.5"
              />
              <span className="font-bold text-[11px]">Chống trùng</span>
            </label>

            <button
              onClick={() => setShowResetConfirmModal(true)}
              disabled={calledSessionIds.size === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center space-x-1"
              title="Đặt lại phiên gọi học sinh"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại phiên</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. GAME MODES SELECTOR TABS (10 MODES) */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-3 shadow-xs">
        <div className="text-xs font-bold text-slate-500 px-2 py-1 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>10 Chế độ trò chơi gọi học sinh</span>
          <span className="text-[11px] text-[#006BFF] font-semibold">Tây Đô Smart EDU</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {CALL_GAME_MODES.map(mode => {
            const isSelected = selectedMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id);
                  setPickedResult(null);
                }}
                disabled={isPlaying}
                className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#006BFF] bg-[#006BFF] text-white shadow-md'
                    : 'border-[#DCE8F7] bg-white text-slate-700 hover:bg-slate-50 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {mode.badge}
                  </span>
                  {isSelected && <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                </div>

                <div className="mt-2.5">
                  <h4 className="font-bold text-sm leading-snug">{mode.title}</h4>
                  <p
                    className={`text-[11px] line-clamp-1 mt-0.5 ${
                      isSelected ? 'text-blue-100' : 'text-slate-500'
                    }`}
                  >
                    {mode.shortDesc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. MAIN ARENA FOR SELECTED GAME */}
      <div className="bg-white rounded-2xl border border-[#DCE8F7] p-6 shadow-sm min-h-[460px] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Arena Header */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-bold text-[#082B52] text-lg">
              {CALL_GAME_MODES.find(m => m.id === selectedMode)?.title}
            </h3>
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            {availableStudents.length} học sinh sẵn sàng
          </div>
        </div>

        {/* GAME CONTENT BY MODE */}
        <div className="w-full flex flex-col items-center justify-center py-6">
          {/* MODE 1: VÒNG QUAY MAY MẮN */}
          {selectedMode === 'wheel' && (
            <div className="relative flex flex-col items-center">
              {/* Pointer Needle */}
              <div className="absolute top-0 z-20 -mt-2">
                <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-rose-600 drop-shadow-md" />
              </div>

              {/* Canvas Wheel */}
              <div className="relative rounded-full p-2 bg-gradient-to-b from-amber-300 to-amber-500 shadow-xl border-4 border-amber-600">
                <canvas
                  ref={wheelCanvasRef}
                  width={340}
                  height={340}
                  className="rounded-full bg-slate-900"
                />
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('wheel')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3.5 bg-gradient-to-r from-[#006BFF] to-blue-700 text-white font-bold text-base rounded-2xl shadow-lg hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-transform transform active:scale-95"
                >
                  <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} />
                  <span>{isPlaying ? 'Đang quay...' : 'QUAY NGAY'}</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 2: HỘP QUÀ BÍ MẬT */}
          {selectedMode === 'gift_box' && (
            <div className="w-full max-w-xl text-center">
              <p className="text-sm text-slate-600 mb-6">
                Chọn một chiếc hộp quà bên dưới hoặc bấm nút mở ngẫu nhiên để gọi học sinh!
              </p>

              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2, 3, 4, 5].map(idx => {
                  const isOpened = openedBoxIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => !isPlaying && handleStartGame('gift_box')}
                      disabled={isPlaying || availableStudents.length === 0}
                      className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center justify-center relative ${
                        isOpened
                          ? 'border-amber-400 bg-amber-50 shadow-lg scale-105 glow-gold'
                          : 'border-[#DCE8F7] bg-slate-50 hover:bg-blue-50 hover:border-[#006BFF]'
                      }`}
                    >
                      <Gift
                        className={`w-12 h-12 transition-transform ${
                          isOpened ? 'text-amber-500 scale-125' : 'text-[#006BFF] hover:scale-110'
                        }`}
                      />
                      <span className="text-xs font-bold text-[#082B52] mt-2">Hộp số {idx + 1}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('gift_box')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Đang mở quà...' : 'MỞ HỘP NGẪU NHIÊN'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 3: THẺ BÀI LẬT MỞ */}
          {selectedMode === 'cards' && (
            <div className="w-full max-w-2xl text-center">
              <p className="text-sm text-slate-600 mb-6">
                Những lá bài ma thuật đang được xáo trộn. Thẻ bài được lật sẽ mang tên học sinh!
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(cardDeckStudents.length > 0 ? cardDeckStudents : [1, 2, 3, 4, 5, 6]).map((item, idx) => {
                  const isFlipped = flippedCards[idx];
                  const student = typeof item === 'object' ? (item as StudentCandidate) : null;
                  return (
                    <div
                      key={idx}
                      className="h-36 rounded-2xl perspective-1000 cursor-pointer select-none"
                    >
                      <div
                        className={`w-full h-full duration-700 transform-style-3d rounded-2xl shadow-md border-2 ${
                          isFlipped ? 'rotate-y-180 border-amber-400 bg-amber-50' : 'border-[#082B52] bg-[#082B52]'
                        }`}
                      >
                        {/* Front of card (facedown) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-white backface-hidden">
                          <Layers className="w-8 h-8 text-amber-300 mb-2" />
                          <span className="text-xs font-bold tracking-wider">TÂY ĐÔ</span>
                          <span className="text-[10px] text-slate-300">Thẻ #{idx + 1}</span>
                        </div>

                        {/* Back of card (faceup) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 bg-gradient-to-b from-amber-50 to-amber-100 text-[#082B52] rounded-2xl backface-hidden rotate-y-180 border-2 border-amber-400">
                          <Award className="w-8 h-8 text-amber-500 mb-1" />
                          <span className="text-sm font-bold">{student?.fullName || 'Học sinh'}</span>
                          <span className="text-[11px] font-semibold text-slate-600">{student?.code}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('cards')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Đang xáo bài...' : 'XÁO VÀ LẬT THẺ'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 4: BỨC THƯ BỒ CÂU */}
          {selectedMode === 'flying_envelope' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-8 rounded-3xl bg-gradient-to-b from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 shadow-sm flex flex-col items-center animate-floating">
                <div className="w-20 h-20 rounded-full bg-white shadow-md flex items-center justify-center text-[#006BFF] mb-4 border border-blue-100">
                  <Mail className="w-10 h-10" />
                </div>
                <h4 className="font-bold text-[#082B52] text-lg">Bức thư bồ câu may mắn</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Chim bồ câu mang lá thư niêm phong sáp đỏ tới lớp học, chuẩn bị mở tên học sinh.
                </p>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('flying_envelope')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Đang mở phong bì...' : 'MỞ BỨC THƯ'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 5: LỒNG CẦU BỐC THĂM */}
          {selectedMode === 'magic_sphere' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-8 rounded-full w-56 h-56 mx-auto bg-gradient-to-tr from-blue-900 to-[#006BFF] shadow-2xl flex flex-col items-center justify-center border-4 border-amber-300 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                <CircleDot className={`w-16 h-16 text-amber-300 ${isPlaying ? 'animate-spin' : ''}`} />
                <span className="text-xs font-bold text-white mt-2 tracking-widest uppercase">LỒNG CẦU</span>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('magic_sphere')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Lồng cầu đang quay...' : 'QUAY BỐC THĂM'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 6: TÊN LỬA KHÔNG GIAN */}
          {selectedMode === 'rocket' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-8 rounded-3xl bg-[#082B52] text-white shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
                <div className={`text-6xl font-black text-amber-400 mb-4 ${rocketCountdown !== null ? 'animate-ping' : ''}`}>
                  {rocketCountdown !== null ? rocketCountdown : '🚀'}
                </div>
                <h4 className="font-bold text-lg">Bệ phóng phi thuyền Tây Đô</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Đếm ngược 3... 2... 1... đưa học sinh bay lên bục giảng!
                </p>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('rocket')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-sm rounded-xl hover:from-rose-600 hover:to-amber-600 shadow-md disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{isPlaying ? 'Đang phóng...' : 'PHÓNG TÊN LỬA'}</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 7: CẶP ĐÔI ĐỐI ĐẦU (2 BẠN) */}
          {selectedMode === 'call_pair' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-6 rounded-3xl bg-slate-50 border-2 border-[#DCE8F7] flex items-center justify-around">
                <div className="w-24 h-24 rounded-2xl bg-blue-100 border border-blue-300 flex flex-col items-center justify-center">
                  <Users className="w-8 h-8 text-[#006BFF]" />
                  <span className="text-xs font-bold text-[#082B52] mt-1">Bạn #1</span>
                </div>

                <div className="w-10 h-10 rounded-full bg-rose-500 text-white font-black text-sm flex items-center justify-center shadow-md">
                  VS
                </div>

                <div className="w-24 h-24 rounded-2xl bg-purple-100 border border-purple-300 flex flex-col items-center justify-center">
                  <Users className="w-8 h-8 text-purple-600" />
                  <span className="text-xs font-bold text-[#082B52] mt-1">Bạn #2</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('call_pair')}
                  disabled={isPlaying || availableStudents.length < 2}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Đang bắt cặp...' : 'GỌI CẶP ĐÔI (2 BẠN)'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 8: NHÓM BA BẠN (3 BẠN) */}
          {selectedMode === 'call_trio' && (
            <div className="w-full max-w-lg text-center py-4">
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-slate-50 border border-[#DCE8F7] flex flex-col items-center justify-center"
                  >
                    <UserPlus className="w-7 h-7 text-[#006BFF] mb-1" />
                    <span className="text-xs font-bold text-[#082B52]">Thành viên #{i}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('call_trio')}
                  disabled={isPlaying || availableStudents.length < 3}
                  className="px-8 py-3 bg-[#006BFF] text-white font-bold text-sm rounded-xl hover:bg-blue-600 shadow-md disabled:opacity-50"
                >
                  {isPlaying ? 'Đang lập nhóm...' : 'GỌI NHÓM BA (3 BẠN)'}
                </button>
              </div>
            </div>
          )}

          {/* MODE 9: CHIẾC NÓN TỐC ĐỘ */}
          {selectedMode === 'speed_timer' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-8 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-sm flex flex-col items-center">
                <TimerIcon className={`w-14 h-14 text-amber-600 ${isPlaying ? 'animate-spin' : ''}`} />
                <h4 className="font-bold text-[#082B52] text-lg mt-2">Thử thách 30 giây thần tốc</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xs">
                  Hệ thống chọn ngẫu nhiên 1 học sinh và ngay lập tức đếm ngược 30 giây để trả lời câu hỏi!
                </p>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('speed_timer')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl shadow-md disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  <TimerIcon className="w-4 h-4" />
                  <span>{isPlaying ? 'Đang chuẩn bị...' : 'BẮT ĐẦU TỐC ĐỘ (30s)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* MODE 10: NGÔI SAO HI VỌNG */}
          {selectedMode === 'star_of_hope' && (
            <div className="w-full max-w-md text-center py-4">
              <div className="p-8 rounded-3xl bg-gradient-to-tr from-amber-400 to-amber-200 border-2 border-amber-500 shadow-xl flex flex-col items-center glow-gold">
                <Star className="w-16 h-16 text-amber-900 fill-amber-300 animate-pulse" />
                <h4 className="font-black text-amber-950 text-xl mt-2">⭐ NGÔI SAO HI VỌNG ⭐</h4>
                <p className="text-xs text-amber-900 font-semibold mt-1 max-w-xs">
                  Học sinh được chọn nhận Ngôi sao hi vọng: Nhân đôi điểm số nếu đúng hoặc có 1 quyền trợ giúp!
                </p>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => handleStartGame('star_of_hope')}
                  disabled={isPlaying || availableStudents.length === 0}
                  className="px-8 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 text-white font-bold text-sm rounded-xl hover:from-amber-600 hover:to-yellow-700 shadow-lg disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  <Star className="w-4 h-4 fill-white" />
                  <span>{isPlaying ? 'Đang trao sao...' : 'TRAO NGÔI SAO HI VỌNG'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. MODAL CHÚC MỪNG KẾT QUẢ GỌI HỌC SINH */}
      {pickedResult && pickedResult.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border-2 border-[#006BFF] p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 text-center">
            {/* Confetti icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 to-amber-200 text-amber-900 flex items-center justify-center mx-auto shadow-lg mb-4 border-2 border-white">
              <Award className="w-9 h-9" />
            </div>

            <span className="text-xs font-bold uppercase tracking-wider text-[#006BFF] px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
              CHÚC MỪNG HỌC SINH ĐƯỢC GỌI
            </span>

            <div className="my-6 space-y-3">
              {pickedResult.map((student, idx) => (
                <div
                  key={student.id}
                  className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-[#DCE8F7] flex items-center justify-between shadow-xs"
                >
                  <div className="text-left">
                    <span className="text-xs font-bold text-[#006BFF]">#{idx + 1} • {student.code}</span>
                    <h3 className="text-xl font-bold text-[#082B52] leading-tight">
                      {student.fullName}
                    </h3>
                    <span className="text-xs text-slate-500">Giới tính: {student.gender || 'Chưa rõ'}</span>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#006BFF] text-white">
                    {activeListName}
                  </span>
                </div>
              ))}
            </div>

            {/* Optional Note / Score */}
            <div className="text-left space-y-1 mb-6">
              <label className="text-xs font-bold text-slate-700">Ghi chú / Đánh giá nhanh (tùy chọn):</label>
              <input
                type="text"
                value={resultScoreNote}
                onChange={e => setResultScoreNote(e.target.value)}
                placeholder="VD: Trả lời tốt (+2 điểm), Cần chú ý hơn..."
                className="w-full px-3 py-2 rounded-xl border border-[#DCE8F7] text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => {
                  setPickedResult(null);
                  setShowTimerModal(true);
                  setInitialTimerSeconds(30);
                  setTimerSeconds(30);
                  setIsTimerRunning(true);
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-1.5"
              >
                <TimerIcon className="w-4 h-4" />
                <span>Bật đồng hồ 30s</span>
              </button>

              <button
                onClick={() => {
                  setPickedResult(null);
                  handleStartGame(selectedMode);
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center space-x-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Gọi bạn khác</span>
              </button>

              <button
                onClick={() => setPickedResult(null)}
                className="px-6 py-2.5 bg-[#006BFF] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL ĐIỂM DANH / VẮNG MẶT */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-md w-full shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <UserX className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-[#082B52] text-lg">Điểm danh / Học sinh vắng mặt</h3>
              </div>
              <button
                onClick={() => setShowAbsentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-3">
              Tích chọn những bạn vắng mặt trong tiết học này. Những bạn bị đánh dấu vắng sẽ <strong>không bao giờ bị gọi</strong> trong các trò chơi.
            </p>

            {/* Quick actions */}
            <div className="flex items-center justify-between text-xs font-semibold mb-2 px-1">
              <span className="text-slate-500">Đang vắng: {absentIds.size} bạn</span>
              {absentIds.size > 0 && (
                <button
                  onClick={() => updateAbsentIds(new Set())}
                  className="text-[#006BFF] hover:underline"
                >
                  Có mặt tất cả (Xóa vắng)
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {allCurrentStudents.map(student => {
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

                    <span className="text-[11px] font-semibold text-slate-400">
                      {isAbsent ? 'Vắng' : 'Có mặt'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-right">
              <button
                onClick={() => setShowAbsentModal(false)}
                className="px-5 py-2 bg-[#006BFF] text-white font-bold text-xs rounded-xl hover:bg-blue-600 shadow-xs"
              >
                Xác nhận & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL LỊCH SỬ GỌI HỌC SINH */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-xl w-full shadow-2xl relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="w-5 h-5 text-[#006BFF]" />
                <h3 className="font-bold text-[#082B52] text-lg">Lịch sử gọi học sinh ({activeListName})</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
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
              <div className="flex-1 overflow-y-auto space-y-2.5 my-3 pr-1">
                {historyItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-[#006BFF]">#{historyItems.length - idx}</span>
                        <span className="font-semibold text-slate-600">[{item.modeName}]</span>
                        <span className="text-[11px] text-slate-400">
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
                        {item.selectedStudents.map(s => s.code).join(' • ')}
                      </div>
                    </div>

                    <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-semibold text-slate-600">
                      {item.className}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleClearHistory}
                disabled={historyItems.length === 0}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl flex items-center space-x-1.5 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ lịch sử</span>
              </button>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-5 py-2 bg-[#006BFF] text-white font-bold text-xs rounded-xl hover:bg-blue-600 shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL ĐỒNG HỒ ĐẾM NGƯỢC (TIMER) */}
      {showTimerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-sm w-full shadow-2xl relative text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center space-x-2">
                <TimerIcon className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-[#082B52] text-lg">Đồng hồ đếm ngược</h3>
              </div>
              <button
                onClick={() => setShowTimerModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Giant Countdown Display */}
            <div className="py-6 px-4 rounded-3xl bg-[#082B52] text-white font-mono text-6xl font-black tracking-widest shadow-inner my-2">
              {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
              {String(timerSeconds % 60).padStart(2, '0')}
            </div>

            {/* Presets */}
            <div className="grid grid-cols-4 gap-2 my-4">
              {[15, 30, 45, 60].map(sec => (
                <button
                  key={sec}
                  onClick={() => {
                    setIsTimerRunning(false);
                    setInitialTimerSeconds(sec);
                    setTimerSeconds(sec);
                  }}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    initialTimerSeconds === sec
                      ? 'bg-[#006BFF] text-white border-blue-600'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setIsTimerRunning(prev => !prev)}
                className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-md flex items-center space-x-1.5 ${
                  isTimerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isTimerRunning ? 'Tạm dừng' : 'Bắt đầu'}</span>
              </button>

              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setTimerSeconds(initialTimerSeconds);
                }}
                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL XÁC NHẬN ĐẶT LẠI PHIÊN GỌI */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-amber-200 p-6 max-w-sm w-full shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-[#082B52] text-lg">Đặt lại phiên gọi học sinh?</h3>
            <p className="text-xs text-slate-600 my-2">
              Thao tác này sẽ xóa danh sách {calledSessionIds.size} bạn đã được gọi trong phiên này để tất cả các bạn có thể được gọi lại từ đầu.
            </p>
            <div className="flex items-center justify-center gap-2.5 mt-5">
              <button
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleResetSession}
                className="px-5 py-2 rounded-xl bg-[#006BFF] text-white text-xs font-bold hover:bg-blue-600 shadow-xs"
              >
                Xác nhận đặt lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODAL CHỈNH SỬA DANH SÁCH NHẬP TAY */}
      {showManualEditorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-[#DCE8F7] p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-[#006BFF]" />
                <h3 className="font-bold text-[#082B52] text-lg">Nhập danh sách học sinh</h3>
              </div>
              <button
                onClick={() => setShowManualEditorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 my-3">
              Mỗi dòng là một học sinh. Định dạng hỗ trợ: <code>Mã - Họ và tên</code> hoặc chỉ cần nhập <code>Họ và tên</code>.
            </p>

            <textarea
              rows={10}
              value={manualRawText}
              onChange={e => setManualRawText(e.target.value)}
              placeholder="HT01 - Nguyễn Văn An&#10;HT02 - Trần Thị Bình&#10;HT03 - Lê Minh Châu"
              className="w-full p-3 rounded-xl border border-[#DCE8F7] text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#006BFF]"
            />

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowManualEditorModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleSaveManualList}
                className="px-5 py-2 bg-[#006BFF] text-white text-xs font-bold rounded-xl hover:bg-blue-600 shadow-xs"
              >
                Lưu danh sách
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
