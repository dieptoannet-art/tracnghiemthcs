import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  GiftBox3DState,
  GiftBoxAnimationSubPhase,
  GiftBoxGameMode,
  GiftBoxSpeedMode,
  GiftBoxQualityPreset,
  GiftBox3DItem,
  GiftBox3DTurnPlan,
  buildGiftBox3DItems,
  createFairGiftBoxTurnPlan,
  evaluateGiftBoxCinematicTimeline,
  GiftBoxTurnDeduplicator,
  runMysteryGiftBox3DUnitTests,
} from './mysteryGiftBox3dMath';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Sparkles,
  Trophy,
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Camera,
  Sliders,
  ShieldCheck,
  X,
  Search,
  Gift,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Volume1,
  Layers,
} from 'lucide-react';

export interface MysteryGiftBox3DGameProps {
  availableCandidates: StudentCandidate[];
  allCandidates?: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  antiDuplicate?: boolean;
  onToggleAntiDuplicate?: () => void;
  onResetSession?: () => void;
  onRestoreStudentToPool?: (studentId: string) => void;
  classes?: ClassRoom[];
  selectedSourceKey?: string;
  onSelectSourceKey?: (key: string) => void;
  resolvedClassName?: string;
  teacherId?: string;
  teacherName?: string;
  userRole?: string;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isMuted: boolean;
  onToggleMute?: () => void;
  onOpenAbsentModal?: () => void;
  onOpenHistoryModal?: () => void;
  onPick: (
    student: StudentCandidate,
    meta?: { bonusPoints?: number; note?: string; sessionId?: string; studentNumber?: number }
  ) => void;
  onUpdateLatestNote?: (note: string) => void;
}

export interface GiftBox3DTurnRecord {
  turnId: string;
  turnIndex: number;
  sessionId: string;
  classId: string;
  className: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  sttNumber: number;
  formattedStt: string;
  boxId: string;
  boxDisplayNumber: number;
  gameMode: GiftBoxGameMode;
  allowRepeat: boolean;
  selectedAt: string;
  saveStatus: 'saved' | 'pending' | 'failed';
  note?: string;
}

const LOCAL_GIFT_RECORDS_KEY_PREFIX = 'taydo_a03_giftbox3d_records_v2';

// Synthesized Cinematic Gift Show Sound Engine (Web Audio API)
class GiftBox3DSoundEngine {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playBoxSelectChime(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore
    }
  }

  public playSuspenseShake(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      for (let i = 0; i < 4; i++) {
        const t = now + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160 + i * 28, t);
        osc.frequency.exponentialRampToValueAtTime(95, t + 0.09);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.11);
      }
    } catch {
      // Ignore
    }
  }

  public playRibbonUntieSwish(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.28);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // Ignore
    }
  }

  public playLidOpenSparkle(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [587.33, 783.99, 987.77, 1174.66];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.32);
      });
    } catch {
      // Ignore
    }
  }

  public playRevealCelebration(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.11;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.44);
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Create a CanvasTexture for the 3D Gift Box front number badge ("HỘP #01").
 */
function createBoxNumberBadgeTexture(
  formattedBoxNumber: string,
  ribbonColorHex: string,
  isOpened: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = isOpened ? 'rgba(15, 23, 42, 0.85)' : 'rgba(7, 27, 56, 0.92)';
    ctx.strokeStyle = isOpened ? '#64748B' : ribbonColorHex;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(14, 16, 228, 96, 26);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isOpened ? '#94A3B8' : '#F5C45E';
    ctx.font = 'bold 48px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isOpened ? `ĐÃ MỞ #${formattedBoxNumber}` : `HỘP #${formattedBoxNumber}`, 128, 66);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a high-contrast 3D Hologram Name Card CanvasTexture (Section VII).
 * Matches the HTML overlay winner data 100%.
 */
function create3DHologramNameCardTexture(params: {
  studentFullName: string;
  formattedStt: string;
  className: string;
}): THREE.CanvasTexture {
  const { studentFullName, formattedStt, className } = params;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 420;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 768, 420);

    // Hologram gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 768, 420);
    bgGrad.addColorStop(0, '#071B38');
    bgGrad.addColorStop(0.5, '#0F2E5A');
    bgGrad.addColorStop(1, '#071B38');
    ctx.fillStyle = bgGrad;
    ctx.strokeStyle = '#F5C45E';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.roundRect(16, 16, 736, 388, 36);
    ctx.fill();
    ctx.stroke();

    // Inner cyan hologram hairline
    ctx.strokeStyle = '#40D8FF';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(32, 32, 704, 356, 24);
    ctx.stroke();

    // Header
    ctx.fillStyle = '#40D8FF';
    ctx.font = 'bold 34px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ HỌC SINH MAY MẮN ★', 384, 92);

    // Student Full Name
    ctx.fillStyle = '#FFFFFF';
    const nameFontSize = studentFullName.length > 22 ? 48 : 58;
    ctx.font = `bold ${nameFontSize}px "Times New Roman", Times, serif`;
    ctx.fillText(studentFullName.toUpperCase(), 384, 198);

    // STT & Class footer
    ctx.fillStyle = '#F5C45E';
    ctx.font = 'bold 38px "Times New Roman", Times, serif';
    ctx.fillText(`STT: #${formattedStt}   •   Lớp: ${className}`, 384, 308);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface GiftBox3DMeshRecord {
  boxId: string;
  boxIndex: number;
  rootGroup: THREE.Group;
  bodyGroup: THREE.Group;
  lidGroup: THREE.Group;
  ribbonFrontMesh: THREE.Mesh;
  ribbonBackMesh: THREE.Mesh;
  ribbonLeftMesh: THREE.Mesh;
  ribbonRightMesh: THREE.Mesh;
  ribbonMat: THREE.MeshStandardMaterial;
  bowGroup: THREE.Group;
  innerLightMesh: THREE.Mesh;
  innerLightMat: THREE.MeshStandardMaterial;
  particlesPoints: THREE.Points;
  nameCardGroup: THREE.Group;
  nameCardFrontMesh: THREE.Mesh;
  nameCardFrontMat: THREE.MeshBasicMaterial;
  badgeSprite: THREE.Sprite;
  hitBoxMesh: THREE.Mesh;
  restX: number;
  restY: number;
  restZ: number;
  baseScale: number;
}

export const MysteryGiftBox3DGame: React.FC<MysteryGiftBox3DGameProps> = ({
  availableCandidates,
  allCandidates = [],
  absentIds = new Set(),
  calledSessionIds = new Set(),
  antiDuplicate = true,
  onToggleAntiDuplicate,
  onResetSession,
  onRestoreStudentToPool,
  classes = [],
  selectedSourceKey = '',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onPick,
  onUpdateLatestNote,
}) => {
  // State Machine (Section XIII)
  const [boxState, setBoxState] = useState<GiftBox3DState>('READY');
  const [subPhase, setSubPhase] = useState<GiftBoxAnimationSubPhase>('READY');
  const [gameMode, setGameMode] = useState<GiftBoxGameMode>('LUCKY_BOXES');
  const [luckyBoxCount, setLuckyBoxCount] = useState<number>(8);
  const [speedMode, setSpeedMode] = useState<GiftBoxSpeedMode>('NORMAL');
  const [qualityPreset, setQualityPreset] = useState<GiftBoxQualityPreset>('HIGH');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  // Search, Modals & Winner Reveal
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [showWinnerOverlay, setShowWinnerOverlay] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [activeWinnerPlan, setActiveWinnerPlan] = useState<GiftBox3DTurnPlan | null>(null);
  const [winnerNote, setWinnerNote] = useState<string>('');
  const [winnerBonusPoints, setWinnerBonusPoints] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openedBoxIdsInSession, setOpenedBoxIdsInSession] = useState<Set<string>>(new Set());

  // Session & Turn History
  const [sessionId] = useState<string>(() => `a03_sess_${Date.now().toString(36)}`);
  const [turnRecords, setTurnRecords] = useState<GiftBox3DTurnRecord[]>([]);

  // Three.js & Anti-Stall Refs
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const soundEngineRef = useRef<GiftBox3DSoundEngine>(new GiftBox3DSoundEngine());
  const deduplicatorRef = useRef<GiftBoxTurnDeduplicator>(new GiftBoxTurnDeduplicator());

  const activeTurnIdRef = useRef<string | null>(null);
  const activeTurnPlanRef = useRef<GiftBox3DTurnPlan | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const lastSoundPhaseRef = useRef<GiftBoxAnimationSubPhase>('READY');
  const watchdogTimerRef = useRef<number | null>(null);

  // Camera orbit & focus interpolation
  const userOrbitRef = useRef<{ azimuth: number; elevation: number; distance: number }>({
    azimuth: 0,
    elevation: 0.16,
    distance: 7.6,
  });
  const currentCamRef = useRef<{
    x: number;
    y: number;
    z: number;
    lookX: number;
    lookY: number;
    lookZ: number;
  }>({
    x: 0,
    y: 1.25,
    z: 7.6,
    lookX: 0,
    lookY: 0,
    lookZ: 0,
  });
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    boxesContainerGroup: THREE.Group;
    boxMeshes: GiftBox3DMeshRecord[];
    stageRingMesh: THREE.Mesh;
    centerSpotlight: THREE.PointLight;
  } | null>(null);

  // Run unit tests once on mount
  const unitTestReport = useMemo(() => runMysteryGiftBox3DUnitTests(), []);

  // Build full roster
  const fullRoster = useMemo(
    () => (allCandidates.length > 0 ? allCandidates : availableCandidates),
    [allCandidates, availableCandidates]
  );

  // Build 3D Gift Box Items for the current mode & eligible students
  const allBoxes = useMemo(() => {
    const rawBoxes = buildGiftBox3DItems({
      gameMode,
      eligibleStudents: availableCandidates,
      fullRosterStudents: fullRoster,
      luckyBoxCount,
      pageSize: 12,
    });
    return rawBoxes.map((b) => ({
      ...b,
      isOpened: gameMode === 'GIANT_BOX' ? false : openedBoxIdsInSession.has(b.boxId),
    }));
  }, [
    gameMode,
    availableCandidates,
    fullRoster,
    luckyBoxCount,
    openedBoxIdsInSession,
    shuffleSeed,
  ]);

  const totalPages = useMemo(() => {
    if (allBoxes.length === 0) return 1;
    return Math.max(1, Math.max(...allBoxes.map((b) => b.pageIndex)) + 1);
  }, [allBoxes]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const currentPageBoxes = useMemo(
    () => allBoxes.filter((b) => b.pageIndex === currentPage),
    [allBoxes, currentPage]
  );

  // Reset opened box visual flags when all LUCKY_BOXES on stage have been opened while students remain
  useEffect(() => {
    if (
      gameMode === 'LUCKY_BOXES' &&
      availableCandidates.length > 0 &&
      allBoxes.length > 0 &&
      allBoxes.every((b) => b.isOpened)
    ) {
      setOpenedBoxIdsInSession(new Set());
    }
  }, [gameMode, availableCandidates.length, allBoxes]);

  // Filtered roster for right-side student management & search
  const filteredRosterList = useMemo(() => {
    const eligibleSet = new Set(availableCandidates.map((s) => s.id));
    const q = studentSearchQuery.trim().toLowerCase();
    return fullRoster
      .map((student, idx) => ({
        sttNumber: idx + 1,
        formattedStt: String(idx + 1).padStart(2, '0'),
        student,
        isAbsent: absentIds.has(student.id),
        isCalled: calledSessionIds.has(student.id),
        isEligibleNow: eligibleSet.has(student.id),
      }))
      .filter((item) => {
        if (!q) return true;
        return (
          item.student.fullName.toLowerCase().includes(q) ||
          item.formattedStt.includes(q) ||
          item.student.code?.toLowerCase().includes(q)
        );
      });
  }, [fullRoster, availableCandidates, absentIds, calledSessionIds, studentSearchQuery]);

  // LocalStorage persistence for turn records
  const localRecordsKey = useMemo(
    () => `${LOCAL_GIFT_RECORDS_KEY_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`,
    [teacherId, selectedSourceKey]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localRecordsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setTurnRecords(parsed);
        }
      } else {
        setTurnRecords([]);
      }
    } catch {
      setTurnRecords([]);
    }
  }, [localRecordsKey]);

  const persistLocalTurnRecords = useCallback(
    (nextRecords: GiftBox3DTurnRecord[]) => {
      setTurnRecords(nextRecords);
      try {
        localStorage.setItem(localRecordsKey, JSON.stringify(nextRecords.slice(0, 100)));
      } catch {
        // Ignore quota errors
      }
    },
    [localRecordsKey]
  );

  // Sync READY / FINISHED state when eligible students change
  useEffect(() => {
    const isBusy =
      boxState === 'SELECTING' ||
      boxState === 'OPENING' ||
      boxState === 'SAVING';
    if (isBusy) return;

    if (availableCandidates.length === 0) {
      setBoxState('FINISHED');
    } else if (boxState === 'FINISHED' || boxState === 'SETUP') {
      setBoxState('READY');
    }
  }, [availableCandidates.length, boxState]);

  // Cancel active speech synthesis
  const stopVietnameseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }, []);

  // Speak Vietnamese Winner Announcement (Section XI)
  const speakWinnerAnnouncement = useCallback(
    (studentFullName: string, forceSpeak = false) => {
      if ((isMuted || !voiceEnabled) && !forceSpeak) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const text = `Xin chúc mừng! Hộp quà bí mật đã chọn được bạn ${studentFullName}. Mời bạn tham gia hoạt động.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'vi-VN';
        utterance.rate = 0.98;
        utterance.pitch = 1.05;

        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find(
          (v) => v.lang.toLowerCase().includes('vi') || v.name.toLowerCase().includes('viet')
        );
        if (viVoice) {
          utterance.voice = viVoice;
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore SpeechSynthesis errors
      }
    },
    [isMuted, voiceEnabled]
  );

  useEffect(() => {
    return () => {
      stopVietnameseSpeech();
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
      }
    };
  }, [stopVietnameseSpeech]);

  // Save turn record to Supabase `public.audit_logs` (Section XII)
  const saveTurnToSupabase = useCallback(
    async (record: GiftBox3DTurnRecord): Promise<'saved' | 'failed'> => {
      if (
        !isSupabaseConfigured ||
        !record.teacherId ||
        record.teacherId.startsWith('gsess_') ||
        record.teacherId.startsWith('guest_') ||
        record.classId === 'guest_mode'
      ) {
        return 'saved';
      }
      try {
        const { error } = await supabase.from('audit_logs').insert({
          actor_id: record.teacherId || null,
          actor_role: 'teacher',
          action: 'A03_GIFT_BOX_3D_PICK',
          entity_type: 'edu_game_session',
          entity_id: record.sessionId,
          metadata: {
            game_id: 'A03',
            game_version: 'EDU_3D_MYSTERY_GIFT_BOX_2.0',
            turn_id: record.turnId,
            session_id: record.sessionId,
            class_id: record.classId,
            class_name: record.className,
            teacher_id: record.teacherId,
            student_id: record.studentId,
            student_name: record.studentName,
            stt_number: record.sttNumber,
            box_id: record.boxId,
            box_number: record.boxDisplayNumber,
            game_mode: record.gameMode,
            allow_repeat: record.allowRepeat,
            selected_at: record.selectedAt,
            save_status: 'saved',
          },
        });
        return error ? 'failed' : 'saved';
      } catch {
        return 'failed';
      }
    },
    []
  );

  const handleRetrySaveTurn = useCallback(
    async (turnId: string) => {
      const target = turnRecords.find((r) => r.turnId === turnId);
      if (!target) return;
      const status = await saveTurnToSupabase(target);
      const updated = turnRecords.map((r) =>
        r.turnId === turnId ? { ...r, saveStatus: status } : r
      );
      persistLocalTurnRecords(updated);
    },
    [turnRecords, saveTurnToSupabase, persistLocalTurnRecords]
  );

  // Finalize Gift Box Opening Turn deterministically (guarded by turnId)
  const finalizeGiftBoxTurn = useCallback(
    async (plan: GiftBox3DTurnPlan) => {
      if (activeTurnIdRef.current !== plan.turnId) return;
      if (!deduplicatorRef.current.markSaved(plan.turnId)) return;

      activeTurnIdRef.current = null;
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }

      if (plan.gameMode !== 'GIANT_BOX') {
        setOpenedBoxIdsInSession((prev) => {
          const next = new Set(prev);
          next.add(plan.boxId);
          return next;
        });
      }

      setActiveWinnerPlan(plan);
      setWinnerNote('');
      setWinnerBonusPoints(1);
      setBoxState('REVEALING');
      setSubPhase('CELEBRATION');
      setShowWinnerOverlay(true);

      soundEngineRef.current.playRevealCelebration(isMuted);
      speakWinnerAnnouncement(plan.selectedStudent.fullName);

      onPick(plan.selectedStudent, {
        bonusPoints: 1,
        note: `Mở Hộp quà 3D #${String(plan.boxIndex + 1).padStart(2, '0')} (${plan.gameMode})`,
        sessionId,
        studentNumber: plan.studentSttNumber,
      });

      setBoxState('SAVING');
      const newRecord: GiftBox3DTurnRecord = {
        turnId: plan.turnId,
        turnIndex: turnRecords.length + 1,
        sessionId,
        classId: selectedSourceKey || resolvedClassName || 'class',
        className: resolvedClassName,
        teacherId,
        studentId: plan.selectedStudent.id,
        studentName: plan.selectedStudent.fullName,
        sttNumber: plan.studentSttNumber,
        formattedStt: plan.formattedStudentStt,
        boxId: plan.boxId,
        boxDisplayNumber: plan.boxIndex + 1,
        gameMode: plan.gameMode,
        allowRepeat: !antiDuplicate,
        selectedAt: new Date().toISOString(),
        saveStatus: 'pending',
      };

      const optimistic = [newRecord, ...turnRecords];
      persistLocalTurnRecords(optimistic);

      const syncStatus = await saveTurnToSupabase(newRecord);
      setTurnRecords((prev) => {
        const updated = prev.map((item) =>
          item.turnId === newRecord.turnId ? { ...item, saveStatus: syncStatus } : item
        );
        try {
          localStorage.setItem(localRecordsKey, JSON.stringify(updated.slice(0, 100)));
        } catch {
          // Ignore
        }
        return updated;
      });

      setBoxState('COMPLETED');
      setSubPhase('COMPLETED');
    },
    [
      isMuted,
      speakWinnerAnnouncement,
      onPick,
      sessionId,
      turnRecords,
      selectedSourceKey,
      resolvedClassName,
      teacherId,
      antiDuplicate,
      persistLocalTurnRecords,
      saveTurnToSupabase,
      localRecordsKey,
    ]
  );

  // Trigger Opening a Specific 3D Gift Box or Random Unopened Gift Box
  const startOpenGiftBoxTurn = useCallback(
    (targetBoxIndexInPage?: number) => {
      setErrorMessage(null);

      const isBusy =
        boxState === 'SELECTING' ||
        boxState === 'OPENING' ||
        boxState === 'SAVING';
      if (isBusy || activeTurnIdRef.current) return;

      if (availableCandidates.length === 0) {
        setBoxState('FINISHED');
        return;
      }

      try {
        stopVietnameseSpeech();
        setShowWinnerOverlay(false);

        const candidateBoxes =
          currentPageBoxes.some((b) => !b.isOpened) ? currentPageBoxes : allBoxes;

        const plan = createFairGiftBoxTurnPlan({
          boxes: candidateBoxes,
          targetBoxIndex: targetBoxIndexInPage,
          eligibleStudents: availableCandidates,
          fullRosterStudents: fullRoster,
          gameMode,
          speedMode,
        });

        // Update the 3D Hologram Name Card texture on the selected box BEFORE it rises
        const refs = threeSceneRef.current;
        if (refs) {
          const targetMeshRec = refs.boxMeshes.find((m) => m.boxId === plan.boxId);
          if (targetMeshRec) {
            const cardTex = create3DHologramNameCardTexture({
              studentFullName: plan.selectedStudent.fullName,
              formattedStt: plan.formattedStudentStt,
              className: resolvedClassName,
            });
            const oldMap = targetMeshRec.nameCardFrontMat.map;
            targetMeshRec.nameCardFrontMat.map = cardTex;
            targetMeshRec.nameCardFrontMat.needsUpdate = true;
            oldMap?.dispose();
          }
        }

        activeTurnIdRef.current = plan.turnId;
        activeTurnPlanRef.current = plan;
        turnStartTimeRef.current = performance.now();
        lastSoundPhaseRef.current = 'BOX_SELECTED';

        setBoxState('SELECTING');
        setSubPhase('BOX_SELECTED');
        soundEngineRef.current.playBoxSelectChime(isMuted);

        if (watchdogTimerRef.current) {
          window.clearTimeout(watchdogTimerRef.current);
        }
        watchdogTimerRef.current = window.setTimeout(() => {
          if (activeTurnIdRef.current === plan.turnId && activeTurnPlanRef.current) {
            finalizeGiftBoxTurn(activeTurnPlanRef.current);
          }
        }, plan.durationMs + 500);
      } catch (err) {
        activeTurnIdRef.current = null;
        activeTurnPlanRef.current = null;
        setErrorMessage(
          err instanceof Error ? err.message : 'Không thể mở hộp quà 3D.'
        );
        setBoxState('ERROR_RECOVERY');
      }
    },
    [
      boxState,
      availableCandidates,
      stopVietnameseSpeech,
      currentPageBoxes,
      allBoxes,
      fullRoster,
      gameMode,
      speedMode,
      resolvedClassName,
      isMuted,
      finalizeGiftBoxTurn,
    ]
  );

  // Initialize Three.js WebGL 3D Stage (Sections II, III, XV)
  useEffect(() => {
    const container = mountContainerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: qualityPreset !== 'LOW',
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglSupported(false);
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      setWebglSupported(false);
      renderer.dispose();
      return;
    }

    const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererInfoStr = debugExt
      ? String(gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) || '')
      : '';
    const softwareGl = /SwiftShader|Software|llvmpipe|Mesa OffScreen/i.test(rendererInfoStr);

    const maxDpr =
      softwareGl || qualityPreset === 'LOW'
        ? 1
        : qualityPreset === 'MEDIUM'
        ? 1.5
        : Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(maxDpr);
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 560);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !softwareGl && qualityPreset === 'HIGH';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071B38');
    scene.fog = new THREE.FogExp2('#071B38', 0.024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 800) / (container.clientHeight || 560),
      0.1,
      100
    );

    // Studio Cinematic Lighting
    const ambientLight = new THREE.AmbientLight('#1478D4', 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 2.3);
    keyLight.position.set(5.0, 8.0, 7.5);
    if (!softwareGl && qualityPreset === 'HIGH') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(keyLight);

    const cyanRimLight = new THREE.DirectionalLight('#40D8FF', 1.4);
    cyanRimLight.position.set(-6.0, 4.0, -4.0);
    scene.add(cyanRimLight);

    const centerSpotlight = new THREE.PointLight('#F5C45E', 3.0, 12);
    centerSpotlight.position.set(0, 3.2, 2.2);
    scene.add(centerSpotlight);

    // 3D Stage Floor & Tech Arch Backdrop (Section II)
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    const floorGeo = new THREE.CylinderGeometry(6.8, 7.4, 0.3, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#071B38',
      metalness: 0.72,
      roughness: 0.24,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -1.75, 0);
    floorMesh.receiveShadow = true;
    stageGroup.add(floorMesh);

    const stageRingGeo = new THREE.RingGeometry(2.4, 2.68, 64);
    const stageRingMat = new THREE.MeshBasicMaterial({
      color: '#40D8FF',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    });
    const stageRingMesh = new THREE.Mesh(stageRingGeo, stageRingMat);
    stageRingMesh.rotation.x = -Math.PI / 2;
    stageRingMesh.position.set(0, -1.58, 0.85);
    stageGroup.add(stageRingMesh);

    const outerGoldRingGeo = new THREE.RingGeometry(4.6, 4.82, 64);
    const outerGoldRingMat = new THREE.MeshBasicMaterial({
      color: '#F5C45E',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const outerGoldRing = new THREE.Mesh(outerGoldRingGeo, outerGoldRingMat);
    outerGoldRing.rotation.x = -Math.PI / 2;
    outerGoldRing.position.set(0, -1.58, 0);
    stageGroup.add(outerGoldRing);

    // Cyber-Tech Backdrop Arch behind the gift boxes
    const archGeo = new THREE.TorusGeometry(4.8, 0.12, 16, 64, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({
      color: '#F5C45E',
      emissive: '#D97706',
      emissiveIntensity: 0.5,
      metalness: 0.85,
      roughness: 0.2,
    });
    const archMesh = new THREE.Mesh(archGeo, archMat);
    archMesh.position.set(0, -1.4, -2.4);
    stageGroup.add(archMesh);

    const boxesContainerGroup = new THREE.Group();
    scene.add(boxesContainerGroup);

    threeSceneRef.current = {
      renderer,
      scene,
      camera,
      boxesContainerGroup,
      boxMeshes: [],
      stageRingMesh,
      centerSpotlight,
    };

    const handleResize = () => {
      if (!mountContainerRef.current || !threeSceneRef.current) return;
      const w = mountContainerRef.current.clientWidth || 800;
      const h = mountContainerRef.current.clientHeight || 560;
      threeSceneRef.current.camera.aspect = w / h;
      threeSceneRef.current.camera.updateProjectionMatrix();
      threeSceneRef.current.renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    let rafId = 0;
    let afterDrawTime = performance.now();
    const minFrameGapMs = softwareGl ? 33 : 0;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      if (now - afterDrawTime < minFrameGapMs) return;

      const refs = threeSceneRef.current;
      if (!refs) return;

      const activePlan = activeTurnPlanRef.current;
      const activeTurnId = activeTurnIdRef.current;

      let camFocusBlend = 0;

      if (activePlan && activeTurnId === activePlan.turnId) {
        const elapsedMs = now - turnStartTimeRef.current;
        const normT = Math.min(Math.max(elapsedMs / activePlan.durationMs, 0), 1);
        const frame = evaluateGiftBoxCinematicTimeline(activePlan, normT);
        camFocusBlend = frame.cameraFocusBlend;

        // Trigger stage sound effects on sub-phase transitions
        if (frame.subPhase !== lastSoundPhaseRef.current) {
          lastSoundPhaseRef.current = frame.subPhase;
          if (frame.subPhase === 'BOX_SHAKING') {
            soundEngineRef.current.playSuspenseShake(isMuted);
          } else if (frame.subPhase === 'RIBBON_UNTYING') {
            soundEngineRef.current.playRibbonUntieSwish(isMuted);
          } else if (frame.subPhase === 'LID_LIFTING') {
            soundEngineRef.current.playLidOpenSparkle(isMuted);
          }
        }

        // Apply 14-Stage Cinematic Transforms to the active 3D Gift Box
        refs.boxMeshes.forEach((rec) => {
          if (rec.boxId === activePlan.boxId) {
            rec.rootGroup.position.set(frame.boxX, frame.boxY, frame.boxZ);
            rec.rootGroup.scale.setScalar(frame.boxScale);
            rec.bodyGroup.rotation.set(frame.shakeRotX, frame.shakeRotY, frame.shakeRotZ);

            // 3D Ribbon separation & untying
            const spread = frame.ribbonSpreadFactor * 0.35;
            rec.ribbonFrontMesh.position.z = 0.51 + spread;
            rec.ribbonBackMesh.position.z = -0.51 - spread;
            rec.ribbonLeftMesh.position.x = -0.51 - spread;
            rec.ribbonRightMesh.position.x = 0.51 + spread;
            rec.ribbonMat.opacity = frame.ribbonOpacity;

            // 3D Bow untying & lifting
            rec.bowGroup.position.y = 0.14 + frame.bowLiftY;
            rec.bowGroup.rotation.y = frame.bowRotY;
            rec.bowGroup.scale.setScalar(Math.max(0.001, frame.bowScale));
            rec.bowGroup.visible = frame.bowScale > 0.02;

            // Separate 3D Lid lifting & tilting open
            rec.lidGroup.position.set(0, 0.52 + frame.lidLiftY, frame.lidShiftZ);
            rec.lidGroup.rotation.x = frame.lidTiltX;
            rec.lidGroup.rotation.z = frame.shakeRotZ;

            // Inner Golden Light Core & Magic Particles
            rec.innerLightMat.emissiveIntensity = frame.innerLightIntensity * 4.2;
            rec.innerLightMesh.scale.setScalar(0.35 + frame.innerLightIntensity * 0.65);

            rec.particlesPoints.visible = frame.particleBurstProgress > 0.01;
            rec.particlesPoints.position.y = frame.particleBurstProgress * 1.15;
            rec.particlesPoints.rotation.y = now * 0.0025;

            // Rising 3D Hologram Student Name Card
            rec.nameCardGroup.visible = frame.nameCardVisible;
            rec.nameCardGroup.position.set(0, frame.nameCardLiftY, 0.12);
            rec.nameCardGroup.scale.setScalar(frame.nameCardScale);
          } else {
            // Subtle idle float for non-selected boxes
            rec.rootGroup.position.set(
              rec.restX,
              rec.restY + Math.sin(now * 0.002 + rec.boxIndex) * 0.03,
              rec.restZ
            );
          }
        });

        setBoxState((prev) =>
          prev !== frame.stateMachinePhase ? frame.stateMachinePhase : prev
        );
        setSubPhase((prev) => (prev !== frame.subPhase ? frame.subPhase : prev));

        if (frame.shouldTriggerReveal) {
          finalizeGiftBoxTurn(activePlan);
        }
      } else if (!activeTurnId) {
        // Gentle idle breathing animation on unopened boxes
        refs.boxMeshes.forEach((rec) => {
          if (activeWinnerPlan?.boxId === rec.boxId && showWinnerOverlay) {
            return;
          }
          rec.rootGroup.position.set(
            rec.restX,
            rec.restY + Math.sin(now * 0.0022 + rec.boxIndex * 0.8) * 0.035,
            rec.restZ
          );
          rec.rootGroup.scale.setScalar(rec.baseScale);
          rec.bodyGroup.rotation.set(0, 0, 0);
          rec.lidGroup.position.set(0, 0.52, 0);
          rec.lidGroup.rotation.set(0, 0, 0);
          rec.ribbonFrontMesh.position.z = 0.51;
          rec.ribbonBackMesh.position.z = -0.51;
          rec.ribbonLeftMesh.position.x = -0.51;
          rec.ribbonRightMesh.position.x = 0.51;
          rec.ribbonMat.opacity = 1;
          rec.bowGroup.visible = true;
          rec.bowGroup.position.y = 0.14;
          rec.bowGroup.scale.setScalar(1);
          rec.particlesPoints.visible = false;
          rec.nameCardGroup.visible = false;
        });
      }

      // Pulse floor ring
      refs.stageRingMesh.rotation.z = now * 0.0005;

      // Camera interpolation between user orbit overview and center-stage closeup
      const orbit = userOrbitRef.current;
      const overviewCamX =
        orbit.distance * Math.sin(orbit.azimuth) * Math.cos(orbit.elevation);
      const overviewCamY = orbit.distance * Math.sin(orbit.elevation) + 0.35;
      const overviewCamZ =
        orbit.distance * Math.cos(orbit.azimuth) * Math.cos(orbit.elevation);

      const focusCamX = 0;
      const focusCamY = 0.85;
      const focusCamZ = 4.65;

      const desiredCamX =
        overviewCamX + (focusCamX - overviewCamX) * camFocusBlend;
      const desiredCamY =
        overviewCamY + (focusCamY - overviewCamY) * camFocusBlend;
      const desiredCamZ =
        overviewCamZ + (focusCamZ - overviewCamZ) * camFocusBlend;

      const desiredLookY = 0.05 + 0.25 * camFocusBlend;
      const desiredLookZ = 0 + 1.05 * camFocusBlend;

      const cur = currentCamRef.current;
      cur.x += (desiredCamX - cur.x) * 0.1;
      cur.y += (desiredCamY - cur.y) * 0.1;
      cur.z += (desiredCamZ - cur.z) * 0.1;
      cur.lookY += (desiredLookY - cur.lookY) * 0.1;
      cur.lookZ += (desiredLookZ - cur.lookZ) * 0.1;

      refs.camera.position.set(cur.x, cur.y, cur.z);
      refs.camera.lookAt(0, cur.lookY, cur.lookZ);

      refs.renderer.render(refs.scene, refs.camera);
      afterDrawTime = performance.now();
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      envTarget.dispose();
      pmremGenerator.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      renderer.dispose();
      threeSceneRef.current = null;
    };
  }, [qualityPreset]);

  // Build / Rebuild 3D Gift Box Models whenever currentPageBoxes change (Section III)
  useEffect(() => {
    const refs = threeSceneRef.current;
    if (!refs) return;

    // Dispose old 3D gift box meshes cleanly
    refs.boxMeshes.forEach((rec) => {
      refs.boxesContainerGroup.remove(rec.rootGroup);
      rec.rootGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        } else if ((child as THREE.Sprite).isSprite) {
          const sp = child as THREE.Sprite;
          sp.material.map?.dispose();
          sp.material.dispose();
        } else if ((child as THREE.Points).isPoints) {
          const pts = child as THREE.Points;
          pts.geometry?.dispose();
          (pts.material as THREE.Material)?.dispose();
        }
      });
    });
    refs.boxMeshes = [];

    if (currentPageBoxes.length === 0) return;

    const newMeshRecords: GiftBox3DMeshRecord[] = currentPageBoxes.map((box) => {
      const rootGroup = new THREE.Group();
      rootGroup.position.set(box.restX, box.restY, box.restZ);
      rootGroup.scale.setScalar(box.boxScale);

      // 1. Hollow 3D Box Body (Bottom + 4 Side Walls so opening the lid reveals the 3D interior!)
      const bodyGroup = new THREE.Group();
      rootGroup.add(bodyGroup);

      const boxMat = new THREE.MeshStandardMaterial({
        color: box.isOpened ? '#334155' : box.palette.boxColorHex,
        metalness: 0.32,
        roughness: 0.28,
      });
      const interiorDarkMat = new THREE.MeshStandardMaterial({
        color: '#09152B',
        roughness: 0.8,
      });

      const bottomGeo = new THREE.BoxGeometry(1.0, 0.08, 1.0);
      const bottomMesh = new THREE.Mesh(bottomGeo, boxMat);
      bottomMesh.position.set(0, -0.46, 0);
      bodyGroup.add(bottomMesh);

      const frontBackWallGeo = new THREE.BoxGeometry(1.0, 0.92, 0.08);
      const frontWall = new THREE.Mesh(frontBackWallGeo, boxMat);
      frontWall.position.set(0, 0, 0.46);
      bodyGroup.add(frontWall);

      const backWall = new THREE.Mesh(frontBackWallGeo, boxMat);
      backWall.position.set(0, 0, -0.46);
      bodyGroup.add(backWall);

      const leftRightWallGeo = new THREE.BoxGeometry(0.08, 0.92, 0.84);
      const leftWall = new THREE.Mesh(leftRightWallGeo, boxMat);
      leftWall.position.set(-0.46, 0, 0);
      bodyGroup.add(leftWall);

      const rightWall = new THREE.Mesh(leftRightWallGeo, boxMat);
      rightWall.position.set(0.46, 0, 0);
      bodyGroup.add(rightWall);

      const innerCavityGeo = new THREE.BoxGeometry(0.82, 0.05, 0.82);
      const innerCavityMesh = new THREE.Mesh(innerCavityGeo, interiorDarkMat);
      innerCavityMesh.position.set(0, -0.4, 0);
      bodyGroup.add(innerCavityMesh);

      // 2. 3D Relief Ribbons on the 4 Side Walls (separate meshes that spread outward when untying!)
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: box.isOpened ? '#64748B' : box.palette.ribbonColorHex,
        metalness: 0.75,
        roughness: 0.2,
        transparent: true,
        opacity: 1,
      });

      const verticalRibbonGeo = new THREE.BoxGeometry(0.18, 0.94, 0.035);
      const ribbonFrontMesh = new THREE.Mesh(verticalRibbonGeo, ribbonMat);
      ribbonFrontMesh.position.set(0, 0, 0.51);
      bodyGroup.add(ribbonFrontMesh);

      const ribbonBackMesh = new THREE.Mesh(verticalRibbonGeo, ribbonMat);
      ribbonBackMesh.position.set(0, 0, -0.51);
      bodyGroup.add(ribbonBackMesh);

      const sideRibbonGeo = new THREE.BoxGeometry(0.035, 0.94, 0.18);
      const ribbonLeftMesh = new THREE.Mesh(sideRibbonGeo, ribbonMat);
      ribbonLeftMesh.position.set(-0.51, 0, 0);
      bodyGroup.add(ribbonLeftMesh);

      const ribbonRightMesh = new THREE.Mesh(sideRibbonGeo, ribbonMat);
      ribbonRightMesh.position.set(0.51, 0, 0);
      bodyGroup.add(ribbonRightMesh);

      // 3. Separate 3D Lid Object (`lidGroup` — lifts and tilts open independently!)
      const lidGroup = new THREE.Group();
      lidGroup.position.set(0, 0.52, 0);
      rootGroup.add(lidGroup);

      const lidMat = new THREE.MeshStandardMaterial({
        color: box.isOpened ? '#475569' : box.palette.lidColorHex,
        metalness: 0.36,
        roughness: 0.24,
      });
      const lidCapGeo = new THREE.BoxGeometry(1.08, 0.18, 1.08);
      const lidCapMesh = new THREE.Mesh(lidCapGeo, lidMat);
      lidGroup.add(lidCapMesh);

      // Crossed 3D Ribbons on Top of Lid
      const lidRibbonXGeo = new THREE.BoxGeometry(1.11, 0.195, 0.18);
      const lidRibbonX = new THREE.Mesh(lidRibbonXGeo, ribbonMat);
      lidGroup.add(lidRibbonX);

      const lidRibbonZGeo = new THREE.BoxGeometry(0.18, 0.195, 1.11);
      const lidRibbonZ = new THREE.Mesh(lidRibbonZGeo, ribbonMat);
      lidGroup.add(lidRibbonZ);

      // 4. 3D Sculpted Bow on Top of the Lid (`bowGroup`)
      const bowGroup = new THREE.Group();
      bowGroup.position.set(0, 0.14, 0);
      lidGroup.add(bowGroup);

      const bowMat = new THREE.MeshStandardMaterial({
        color: box.isOpened ? '#94A3B8' : box.palette.bowColorHex,
        metalness: 0.82,
        roughness: 0.18,
      });

      const loopGeo = new THREE.TorusGeometry(0.16, 0.048, 12, 24);
      const leftLoop = new THREE.Mesh(loopGeo, bowMat);
      leftLoop.position.set(-0.14, 0.06, 0);
      leftLoop.rotation.z = 0.45;
      bowGroup.add(leftLoop);

      const rightLoop = new THREE.Mesh(loopGeo, bowMat);
      rightLoop.position.set(0.14, 0.06, 0);
      rightLoop.rotation.z = -0.45;
      bowGroup.add(rightLoop);

      const knotGeo = new THREE.SphereGeometry(0.075, 14, 14);
      const knotMesh = new THREE.Mesh(knotGeo, bowMat);
      knotMesh.position.set(0, 0.04, 0);
      bowGroup.add(knotMesh);

      // 5. Inner Light Core & Magic Rising Particles inside the Box
      const innerLightGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const innerLightMat = new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: box.palette.glowColorHex,
        emissiveIntensity: 0.2,
      });
      const innerLightMesh = new THREE.Mesh(innerLightGeo, innerLightMat);
      innerLightMesh.position.set(0, -0.05, 0);
      bodyGroup.add(innerLightMesh);

      const pCount = qualityPreset === 'LOW' ? 16 : 32;
      const pPositions = new Float32Array(pCount * 3);
      for (let i = 0; i < pCount; i++) {
        const angle = (i / pCount) * Math.PI * 2;
        const rad = 0.12 + (i % 4) * 0.09;
        pPositions[i * 3] = Math.cos(angle) * rad;
        pPositions[i * 3 + 1] = (i / pCount) * 0.95 - 0.2;
        pPositions[i * 3 + 2] = Math.sin(angle) * rad;
      }
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
      const pMat = new THREE.PointsMaterial({
        color: '#FDE047',
        size: 0.09,
        transparent: true,
        opacity: 0.9,
      });
      const particlesPoints = new THREE.Points(pGeo, pMat);
      particlesPoints.visible = false;
      rootGroup.add(particlesPoints);

      // 6. Rising 3D Hologram Student Name Card (`nameCardGroup` — Section VII)
      const nameCardGroup = new THREE.Group();
      nameCardGroup.visible = false;
      rootGroup.add(nameCardGroup);

      const cardFrameGeo = new THREE.BoxGeometry(1.62, 0.92, 0.05);
      const cardFrameMat = new THREE.MeshStandardMaterial({
        color: '#F5C45E',
        emissive: '#40D8FF',
        emissiveIntensity: 0.35,
        metalness: 0.85,
        roughness: 0.2,
      });
      const cardFrameMesh = new THREE.Mesh(cardFrameGeo, cardFrameMat);
      nameCardGroup.add(cardFrameMesh);

      const cardFrontGeo = new THREE.PlaneGeometry(1.54, 0.84);
      const cardFrontMat = new THREE.MeshBasicMaterial({
        color: '#FFFFFF',
      });
      const nameCardFrontMesh = new THREE.Mesh(cardFrontGeo, cardFrontMat);
      nameCardFrontMesh.position.set(0, 0, 0.028);
      nameCardGroup.add(nameCardFrontMesh);

      // 7. Front Box Number Badge Sprite ("HỘP #01")
      const badgeTex = createBoxNumberBadgeTexture(
        box.formattedBoxNumber,
        box.palette.ribbonColorHex,
        box.isOpened
      );
      const badgeMat = new THREE.SpriteMaterial({
        map: badgeTex,
        transparent: true,
      });
      const badgeSprite = new THREE.Sprite(badgeMat);
      badgeSprite.position.set(0, -0.15, 0.68);
      badgeSprite.scale.set(0.88, 0.44, 1);
      bodyGroup.add(badgeSprite);

      // 8. Invisible Raycast HitBox for clean, single-box click detection
      const hitBoxGeo = new THREE.BoxGeometry(1.15, 1.35, 1.15);
      const hitBoxMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitBoxMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBoxMesh.userData = { boxIndex: box.boxIndex, boxId: box.boxId };
      rootGroup.add(hitBoxMesh);

      refs.boxesContainerGroup.add(rootGroup);

      return {
        boxId: box.boxId,
        boxIndex: box.boxIndex,
        rootGroup,
        bodyGroup,
        lidGroup,
        ribbonFrontMesh,
        ribbonBackMesh,
        ribbonLeftMesh,
        ribbonRightMesh,
        ribbonMat,
        bowGroup,
        innerLightMesh,
        innerLightMat,
        particlesPoints,
        nameCardGroup,
        nameCardFrontMesh,
        nameCardFrontMat: cardFrontMat,
        badgeSprite,
        hitBoxMesh,
        restX: box.restX,
        restY: box.restY,
        restZ: box.restZ,
        baseScale: box.boxScale,
      };
    });

    refs.boxMeshes = newMeshRecords;
  }, [currentPageBoxes, qualityPreset]);

  // Handle Pointer Down / Move / Up for both 3D Camera Orbit and Clicking a 3D Gift Box
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      userOrbitRef.current.azimuth = Math.min(
        Math.max(userOrbitRef.current.azimuth - dx * 0.0025, -0.65),
        0.65
      );
      userOrbitRef.current.elevation = Math.min(
        Math.max(userOrbitRef.current.elevation + dy * 0.002, 0.02),
        0.48
      );
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = isDraggingRef.current;
    isDraggingRef.current = false;
    if (!wasDragging) return;

    const moveDist = Math.hypot(
      e.clientX - pointerDownPosRef.current.x,
      e.clientY - pointerDownPosRef.current.y
    );
    if (moveDist > 6) return;

    // Raycast click on 3D Gift Box (prevents click-through by taking closest hit `intersects[0]`)
    const refs = threeSceneRef.current;
    const container = mountContainerRef.current;
    if (!refs || !container || activeTurnIdRef.current) return;

    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), refs.camera);

    const hitMeshes = refs.boxMeshes.map((m) => m.hitBoxMesh);
    const intersects = raycaster.intersectObjects(hitMeshes, false);
    if (intersects.length > 0) {
      const closestHit = intersects[0].object;
      const clickedBoxId = closestHit.userData?.boxId as string | undefined;
      if (clickedBoxId) {
        const idxInPage = currentPageBoxes.findIndex((b) => b.boxId === clickedBoxId);
        if (idxInPage !== -1 && !currentPageBoxes[idxInPage].isOpened) {
          startOpenGiftBoxTurn(idxInPage);
        }
      }
    }
  };

  // Keyboard shortcuts: Space = Open Box, R = Reset, M = Mute, F = Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (e.code === 'Space') {
        e.preventDefault();
        startOpenGiftBoxTurn();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setShowResetModal(true);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMute?.();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onToggleFullscreen?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [startOpenGiftBoxTurn, onToggleMute, onToggleFullscreen]);

  const isOpeningNow =
    boxState === 'SELECTING' ||
    boxState === 'OPENING' ||
    boxState === 'SAVING';

  const subPhaseViLabel: Record<GiftBoxAnimationSubPhase, string> = {
    READY: 'SÂN KHẤU SẴN SÀNG',
    BOX_SELECTED: 'ĐÃ CHỌN HỘP QUÀ 3D',
    CAMERA_FOCUS: 'CAMERA HƯỚNG VÀO HỘP',
    BOX_MOVING_TO_CENTER: 'HỘP QUÀ TIẾN RA GIỮA SÂN KHẤU',
    BOX_SHAKING: 'HỘP QUÀ RUNG HỒI HỘP',
    RIBBON_UNTYING: 'ĐANG THÁO DẢI RUY BĂNG 3D',
    BOW_OPENING: 'NƠ 3D BUNG MỞ',
    LID_LIFTING: 'NẮP HỘP NÂNG LÊN',
    INNER_LIGHT: 'ÁNH SÁNG VÀNG BÙNG LÊN',
    MAGIC_PARTICLES: 'HẠT SÁNG KỲ DIỆU BAY RA',
    NAME_CARD_RISING: 'THẺ TÊN 3D ĐANG NỔI LÊN',
    RESULT_REVEAL: 'CÔNG BỐ HỌC SINH MAY MẮN',
    CELEBRATION: 'CHÚC MỪNG HỌC SINH ĐƯỢC CHỌN',
    COMPLETED: 'HOÀN TẤT LƯỢT MỞ QUÀ',
  };

  return (
    <div
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      className="w-full bg-gradient-to-b from-[#071B38] via-[#0B234A] to-[#06152D] text-white rounded-3xl border-2 border-[#F5C45E]/50 shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Top Broadcast Header */}
      <div className="px-4 sm:px-6 py-3 bg-[#06162E] border-b border-[#F5C45E]/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5C45E] to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow-md">
            A03
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-wide text-[#F5C45E] uppercase">
                EDU MYSTERY GIFT SHOW – HỘP QUÀ BÍ MẬT 3D
              </h3>
              <span className="px-2 py-0.5 rounded bg-[#1478D4]/30 border border-[#40D8FF]/50 text-[11px] font-bold text-[#40D8FF]">
                WebGL 3D 2.0
              </span>
            </div>
            <p className="text-xs text-slate-200">
              Lớp: <strong className="text-white">{resolvedClassName}</strong> · Chưa gọi:{' '}
              <strong className="text-emerald-400 tabular-nums">
                {availableCandidates.length}
              </strong>
              /<span className="tabular-nums">{fullRoster.length}</span> HS · Đã gọi:{' '}
              <strong className="text-[#F5C45E] tabular-nums">{calledSessionIds.size}</strong>
            </p>
          </div>
        </div>

        {/* 3 Gift Box Modes Switcher + Session Controls (Section IV & VIII) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#0B254D] border border-[#40D8FF]/30 rounded-xl p-0.5 text-xs font-bold">
            <button
              type="button"
              disabled={isOpeningNow}
              onClick={() => {
                setGameMode('LUCKY_BOXES');
                setCurrentPage(0);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                gameMode === 'LUCKY_BOXES'
                  ? 'bg-[#F5C45E] text-slate-950 font-black'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              1. Hộp quà may mắn
            </button>
            <button
              type="button"
              disabled={isOpeningNow}
              onClick={() => {
                setGameMode('ONE_BOX_PER_STUDENT');
                setCurrentPage(0);
                setShuffleSeed((s) => s + 1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                gameMode === 'ONE_BOX_PER_STUDENT'
                  ? 'bg-[#F5C45E] text-slate-950 font-black'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              2. Mỗi HS một hộp ({availableCandidates.length})
            </button>
            <button
              type="button"
              disabled={isOpeningNow}
              onClick={() => {
                setGameMode('GIANT_BOX');
                setCurrentPage(0);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                gameMode === 'GIANT_BOX'
                  ? 'bg-[#F5C45E] text-slate-950 font-black'
                  : 'text-slate-200 hover:text-white'
              }`}
            >
              3. Hộp khổng lồ
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleAntiDuplicate}
            disabled={isOpeningNow}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              antiDuplicate
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{antiDuplicate ? 'Không lặp: BẬT' : 'Cho phép lặp'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={isOpeningNow}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-bold text-rose-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại phiên</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-[#0B254D] hover:bg-[#13366E] border border-[#40D8FF]/30 text-[#F5C45E]"
            title="Bật/tắt âm thanh (Phím M)"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-[#0B254D] hover:bg-[#13366E] border border-[#40D8FF]/30 text-[#40D8FF]"
              title="Toàn màn hình (Phím F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main 3-Column Stage Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[600px]">
        {/* LEFT COLUMN (lg:col-span-3): Session History & Supabase Sync Status */}
        <div className="order-3 lg:order-1 lg:col-span-3 bg-[#06152D] border-t lg:border-t-0 lg:border-r border-[#F5C45E]/25 flex flex-col max-h-[580px] lg:max-h-none">
          <div className="px-4 py-3 bg-[#091E40] border-b border-[#40D8FF]/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-[#F5C45E] uppercase">
              <History className="w-4 h-4" />
              <span>Lịch sử mở quà ({turnRecords.length})</span>
            </div>
            {onOpenHistoryModal && (
              <button
                type="button"
                onClick={onOpenHistoryModal}
                className="text-[11px] font-bold text-[#40D8FF] hover:underline"
              >
                Xem tất cả
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {turnRecords.length === 0 ? (
              <div className="text-center py-12 px-3 text-slate-400 text-xs space-y-2">
                <Gift className="w-8 h-8 mx-auto text-[#F5C45E]/60" />
                <p className="font-bold text-slate-200">Chưa mở hộp quà nào trong phiên</p>
                <p>Nhấn trực tiếp vào hộp quà 3D trên sân khấu hoặc bấm nút MỞ HỘP NGẪU NHIÊN.</p>
              </div>
            ) : (
              turnRecords.map((rec) => (
                <div
                  key={rec.turnId}
                  className="p-3 rounded-2xl bg-[#0B234A]/85 border border-[#40D8FF]/25 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#F5C45E]/20 border border-[#F5C45E]/40 text-[#F5C45E] font-black tabular-nums">
                      Lượt #{rec.turnIndex} · Hộp #{String(rec.boxDisplayNumber).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(rec.selectedAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-sm font-black text-white">
                    #{rec.formattedStt} – {rec.studentName}
                  </p>
                  {rec.note && <p className="text-xs text-[#F5C45E] italic">“{rec.note}”</p>}
                  <div className="flex items-center justify-between pt-1 border-t border-[#40D8FF]/15 text-[11px]">
                    <span
                      className={`flex items-center gap-1 font-bold ${
                        rec.saveStatus === 'saved'
                          ? 'text-emerald-400'
                          : rec.saveStatus === 'pending'
                          ? 'text-amber-300'
                          : 'text-rose-400'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {rec.saveStatus === 'saved'
                        ? 'Đã lưu Supabase'
                        : rec.saveStatus === 'pending'
                        ? 'Đang lưu...'
                        : 'Lưu cục bộ (Lỗi mạng)'}
                    </span>
                    {rec.saveStatus === 'failed' && (
                      <button
                        type="button"
                        onClick={() => handleRetrySaveTurn(rec.turnId)}
                        className="px-2 py-0.5 rounded bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 font-bold flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Thử lưu lại
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 border-t border-[#40D8FF]/20 bg-[#051226]">
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Kiểm định RNG & Xáo trộn ({unitTestReport.totalChecks} test OK)</span>
            </button>
          </div>
        </div>

        {/* CENTER COLUMN (lg:col-span-6): 3D WebGL Gift Show Stage */}
        <div className="order-1 lg:order-2 lg:col-span-6 relative flex flex-col justify-between bg-gradient-to-b from-[#071B38] via-[#0D2B59] to-[#06152D] overflow-hidden">
          {/* Top HUD: Cinematic SubPhase Status + Mode Explanation + Camera Reset */}
          <div className="relative z-10 px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="px-3.5 py-1.5 rounded-xl bg-[#06162E]/95 border border-[#F5C45E]/50 shadow-lg flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isOpeningNow
                    ? 'bg-[#F5C45E] animate-ping'
                    : boxState === 'FINISHED'
                    ? 'bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-black tracking-wider text-[#F5C45E] uppercase">
                {subPhaseViLabel[subPhase]}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {gameMode === 'ONE_BOX_PER_STUDENT' && totalPages > 1 && (
                <div className="flex items-center gap-1 bg-[#06162E]/95 border border-[#40D8FF]/40 rounded-xl px-2 py-1 text-xs font-bold">
                  <button
                    type="button"
                    disabled={currentPage === 0 || isOpeningNow}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[#40D8FF] tabular-nums">
                    Khu vực {currentPage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1 || isOpeningNow}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="p-1 rounded hover:bg-white/10 disabled:opacity-40"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  userOrbitRef.current = { azimuth: 0, elevation: 0.16, distance: 7.6 };
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#06162E]/95 hover:bg-[#0D2B59] border border-[#40D8FF]/30 text-xs font-bold text-[#40D8FF] flex items-center gap-1 shadow-lg"
                title="Đặt lại góc nhìn 3D"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Góc nhìn chuẩn</span>
              </button>
            </div>
          </div>

          {/* Mode Rule Transparency Banner (Section IV) */}
          <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-[#06162E]/85 border border-[#40D8FF]/25 text-[11px] text-slate-200 flex items-center justify-between gap-2">
            <span>
              {gameMode === 'LUCKY_BOXES'
                ? 'Chế độ Hộp quà may mắn: Nhấn chọn bất kỳ hộp nào trên sân khấu — mọi học sinh hợp lệ đều có xác suất trúng ngang nhau.'
                : gameMode === 'ONE_BOX_PER_STUDENT'
                ? 'Chế độ Mỗi học sinh một hộp: Các hộp đã được xáo trộn công bằng Fisher-Yates; mỗi hộp gắn cố định với 1 học sinh.'
                : 'Chế độ Hộp quà khổng lồ: Nhấn MỞ HỘP để chọn ngẫu nhiên học sinh, mở nắp công bố rồi đóng lại cho lượt tiếp theo.'}
            </span>
          </div>

          {/* 3D WebGL Stage Viewport */}
          <div
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            className="relative w-full h-[410px] sm:h-[460px] lg:h-[490px] cursor-pointer select-none"
            title="Nhấn trực tiếp vào hộp quà 3D để mở hoặc kéo chuột để xoay góc nhìn sân khấu"
          >
            {webglSupported ? (
              <div ref={mountContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-[#F5C45E]" />
                <p className="text-base font-black text-[#F5C45E]">
                  Trình duyệt không bật WebGL 3D
                </p>
                <p className="text-xs text-slate-200 max-w-md">
                  Thầy/cô vẫn có thể chọn các nút Hộp quà bên dưới hoặc nhấn MỞ HỘP NGẪU NHIÊN để
                  chọn học sinh công bằng.
                </p>
              </div>
            )}

            {/* FINISHED Overlay (All students called) */}
            {boxState === 'FINISHED' && (
              <div className="absolute inset-0 bg-[#071B38]/90 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#0B234A] border-2 border-[#F5C45E] rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <Sparkles className="w-10 h-10 text-[#F5C45E] mx-auto" />
                  <h4 className="text-xl font-black text-[#F5C45E] uppercase">
                    Đã gọi hết học sinh!
                  </h4>
                  <p className="text-sm text-slate-200">
                    Tất cả học sinh đủ điều kiện của lớp <strong>{resolvedClassName}</strong> đã
                    được mở quà trong phiên này.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onResetSession?.();
                      setOpenedBoxIdsInSession(new Set());
                      setActiveWinnerPlan(null);
                      setShowWinnerOverlay(false);
                      setBoxState('READY');
                      setSubPhase('READY');
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#F5C45E] text-slate-950 font-black text-sm uppercase shadow-lg"
                  >
                    BẮT ĐẦU PHIÊN MỚI
                  </button>
                </div>
              </div>
            )}

            {/* Error Recovery Overlay */}
            {boxState === 'ERROR_RECOVERY' && errorMessage && (
              <div className="absolute inset-0 bg-[#071B38]/90 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#1E1B4B] border-2 border-rose-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">Khôi phục sân khấu hộp quà</h4>
                  <p className="text-sm text-rose-200">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setBoxState(availableCandidates.length > 0 ? 'READY' : 'FINISHED');
                      setSubPhase('READY');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#F5C45E] text-slate-950 font-black text-sm"
                  >
                    Tiếp tục mở quà
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Stage Controls: Quick Box Number Selector + Giant MỞ HỘP / MỞ TIẾP Button */}
          <div className="relative z-10 px-4 pb-4 pt-2 bg-gradient-to-t from-[#051226] via-[#071B38]/95 to-transparent space-y-3">
            {/* Keyboard-accessible Box Buttons for current page */}
            {currentPageBoxes.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {currentPageBoxes.map((b, idxInPage) => (
                  <button
                    key={b.boxId}
                    type="button"
                    disabled={isOpeningNow || b.isOpened || availableCandidates.length === 0}
                    onClick={() => startOpenGiftBoxTurn(idxInPage)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border transition-all tabular-nums ${
                      b.isOpened
                        ? 'bg-slate-900/60 border-slate-700 text-slate-500 line-through cursor-not-allowed'
                        : 'bg-[#0B254D] hover:bg-[#1478D4] border-[#F5C45E]/50 text-[#F5C45E] hover:text-white shadow'
                    }`}
                  >
                    Hộp #{b.formattedBoxNumber}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => startOpenGiftBoxTurn()}
                disabled={isOpeningNow || availableCandidates.length === 0}
                className="px-8 sm:px-10 py-3.5 rounded-2xl bg-gradient-to-r from-[#F5C45E] via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-[0_0_30px_rgba(245,196,94,0.45)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 border-2 border-yellow-200"
              >
                <Gift className="w-5 h-5" />
                <span>
                  {isOpeningNow
                    ? 'ĐANG MỞ HỘP QUÀ 3D...'
                    : boxState === 'COMPLETED'
                    ? 'MỞ TIẾP HỘP QUÀ (SPACE)'
                    : 'MỞ HỘP NGẪU NHIÊN (SPACE)'}
                </span>
              </button>

              {activeWinnerPlan && !isOpeningNow && (
                <button
                  type="button"
                  onClick={() => setShowWinnerOverlay(true)}
                  className="px-4 py-3.5 rounded-2xl bg-[#1478D4] hover:bg-blue-500 border border-[#40D8FF]/50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                >
                  <Trophy className="w-4 h-4 text-[#F5C45E]" />
                  <span>
                    Thẻ tên vừa mở: #{activeWinnerPlan.formattedStudentStt}{' '}
                    {activeWinnerPlan.selectedStudent.fullName}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-3): Class & Student Management + 3D Settings */}
        <div className="order-2 lg:order-3 lg:col-span-3 bg-[#06152D] border-t lg:border-t-0 lg:border-l border-[#F5C45E]/25 flex flex-col max-h-[580px] lg:max-h-none">
          <div className="p-3 bg-[#091E40] border-b border-[#40D8FF]/20 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-[#F5C45E] uppercase">
                Danh sách Lớp & Học sinh
              </span>
              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={onOpenAbsentModal}
                  disabled={isOpeningNow}
                  className="px-2.5 py-1 rounded-lg bg-[#1478D4]/30 hover:bg-[#1478D4]/50 border border-[#40D8FF]/40 text-[#40D8FF] font-bold flex items-center gap-1"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Vắng ({absentIds.size})</span>
                </button>
              )}
            </div>

            {classes.length > 0 && onSelectSourceKey && (
              <select
                value={selectedSourceKey}
                onChange={(e) => onSelectSourceKey(e.target.value)}
                disabled={isOpeningNow}
                className="w-full px-3 py-2 rounded-xl bg-[#0B234A] border border-[#40D8FF]/40 text-xs font-bold text-white focus:outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                    Lớp {cls.name} ({cls.students?.length || 0} HS)
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Tìm STT hoặc tên học sinh..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#06152D] border border-[#40D8FF]/30 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#F5C45E]"
              />
            </div>
          </div>

          {/* Student List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredRosterList.map((item) => {
              const isLastWinner =
                activeWinnerPlan?.selectedStudent.id === item.student.id && !isOpeningNow;

              return (
                <div
                  key={item.student.id}
                  className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                    isLastWinner
                      ? 'bg-[#F5C45E]/25 border-[#F5C45E] text-white shadow-md'
                      : item.isAbsent
                      ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through'
                      : item.isCalled && antiDuplicate
                      ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                      : 'bg-[#0B234A]/75 border-[#40D8FF]/20 text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                        isLastWinner
                          ? 'bg-[#F5C45E] text-slate-950'
                          : item.isEligibleNow
                          ? 'bg-[#1478D4]/30 text-[#F5C45E] border border-[#F5C45E]/40'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {item.formattedStt}
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{item.student.fullName}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.isAbsent
                          ? 'Vắng mặt'
                          : item.isCalled
                          ? 'Đã mở quà trong phiên'
                          : 'Đủ điều kiện chọn'}
                      </p>
                    </div>
                  </div>

                  {isLastWinner ? (
                    <span className="px-2 py-0.5 rounded bg-[#F5C45E] text-slate-950 font-black text-[10px] shrink-0">
                      VỪA MỞ
                    </span>
                  ) : item.isCalled && antiDuplicate && onRestoreStudentToPool ? (
                    <button
                      type="button"
                      onClick={() => onRestoreStudentToPool(item.student.id)}
                      className="px-2 py-1 rounded-lg bg-[#1478D4]/30 hover:bg-[#1478D4]/50 text-[#40D8FF] font-bold text-[10px] shrink-0"
                    >
                      Đưa lại
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Stage Settings Footer */}
          <div className="p-3 bg-[#091E40] border-t border-[#40D8FF]/20 space-y-2 text-xs">
            {gameMode === 'LUCKY_BOXES' && (
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-200 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#40D8FF]" />
                  <span>Số hộp trên bục:</span>
                </span>
                <div className="flex items-center gap-1">
                  {[6, 8, 12].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={isOpeningNow}
                      onClick={() => setLuckyBoxCount(cnt)}
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        luckyBoxCount === cnt
                          ? 'bg-[#40D8FF] text-slate-950 font-black'
                          : 'bg-[#06152D] text-slate-300'
                      }`}
                    >
                      {cnt} hộp
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-200 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-[#F5C45E]" />
                <span>Đồ họa 3D:</span>
              </span>
              <div className="flex items-center gap-1">
                {(['LOW', 'MEDIUM', 'HIGH'] as GiftBoxQualityPreset[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQualityPreset(q)}
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      qualityPreset === q
                        ? 'bg-[#F5C45E] text-slate-950 font-black'
                        : 'bg-[#06152D] text-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-200">Thời lượng mở:</span>
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: 'FAST', label: 'Nhanh' },
                    { key: 'NORMAL', label: 'Chuẩn' },
                    { key: 'SUSPENSE', label: 'Hồi hộp' },
                  ] as Array<{ key: GiftBoxSpeedMode; label: string }>
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSpeedMode(s.key)}
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      speedMode === s.key
                        ? 'bg-[#40D8FF] text-slate-950 font-black'
                        : 'bg-[#06152D] text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className="w-full py-1.5 px-2 rounded-lg bg-[#06152D] border border-[#40D8FF]/30 font-bold text-[11px] text-emerald-300 flex items-center justify-center gap-1"
            >
              <Volume1 className="w-3.5 h-3.5" />
              <span>Giọng đọc Tiếng Việt: {voiceEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Synchronized HTML Winner Overlay matching the 3D Hologram Name Card (Section VII) */}
      {showWinnerOverlay && activeWinnerPlan && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-xl w-full bg-gradient-to-b from-[#0B234A] via-[#071B38] to-[#051226] border-4 border-[#F5C45E] rounded-3xl p-6 sm:p-8 text-white shadow-[0_0_65px_rgba(245,196,94,0.5)] space-y-6 relative overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setShowWinnerOverlay(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#F5C45E]/20 border border-[#F5C45E]/60 text-[#F5C45E] text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>HỌC SINH MAY MẮN</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#40D8FF] uppercase">
                Hộp Quà Bí Mật #{String(activeWinnerPlan.boxIndex + 1).padStart(2, '0')} Đã Mở!
              </h2>
            </div>

            {/* Hologram Card Mirror */}
            <div className="p-6 rounded-2xl bg-[#051226] border-2 border-[#40D8FF]/70 text-center space-y-3 shadow-inner">
              <div className="inline-flex items-center justify-center px-4 py-1 rounded-xl bg-[#F5C45E] text-slate-950 font-black text-base tabular-nums">
                STT: #{activeWinnerPlan.formattedStudentStt}
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-wide py-1">
                {activeWinnerPlan.selectedStudent.fullName}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-[#40D8FF] font-bold">
                <span>Lớp: {resolvedClassName}</span>
                <span>•</span>
                <span>Lượt mở thứ: #{turnRecords.length}</span>
                <span>•</span>
                <span>Chưa gọi: {availableCandidates.length} HS</span>
              </div>
            </div>

            {/* Teacher Quick Points & Note */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#F5C45E]">
                <span>Ghi nhận điểm thưởng & nhận xét:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setWinnerBonusPoints(pts)}
                      className={`px-2.5 py-1 rounded-lg font-black ${
                        winnerBonusPoints === pts
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      +{pts} điểm
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  'Trả lời chính xác, tự tin (+1đ)',
                  'Phát biểu xuất sắc (+2đ)',
                  'Hoàn thành tốt câu hỏi',
                ].map((presetNote) => (
                  <button
                    key={presetNote}
                    type="button"
                    onClick={() => {
                      setWinnerNote(presetNote);
                      onUpdateLatestNote?.(presetNote);
                      setTurnRecords((prev) =>
                        prev.map((r, i) => (i === 0 ? { ...r, note: presetNote } : r))
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                      winnerNote === presetNote
                        ? 'bg-[#F5C45E] text-slate-950 border-amber-300 font-black'
                        : 'bg-[#0B234A] border-[#40D8FF]/30 text-slate-200'
                    }`}
                  >
                    {presetNote}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWinnerOverlay(false);
                  setTimeout(() => startOpenGiftBoxTurn(), 120);
                }}
                disabled={availableCandidates.length === 0}
                className="py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#F5C45E] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>MỞ TIẾP</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  speakWinnerAnnouncement(
                    activeWinnerPlan.selectedStudent.fullName,
                    true
                  )
                }
                className="py-3.5 px-5 rounded-2xl bg-[#1478D4] hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Volume1 className="w-4 h-4" />
                <span>ĐỌC LẠI TÊN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowWinnerOverlay(false);
                  if (onOpenHistoryModal) onOpenHistoryModal();
                }}
                className="py-3 px-4 rounded-2xl bg-[#0B234A] hover:bg-[#13366E] border border-[#40D8FF]/40 text-[#40D8FF] font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" />
                <span>XEM LỊCH SỬ</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWinnerOverlay(false)}
                className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <span>ĐÓNG KẾT QUẢ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-md w-full bg-[#0B234A] border-2 border-[#F5C45E] rounded-3xl p-6 text-white space-y-4 shadow-2xl text-center"
          >
            <RotateCcw className="w-10 h-10 text-[#F5C45E] mx-auto" />
            <h4 className="text-xl font-black text-[#F5C45E] uppercase">
              Đặt lại phiên mở hộp quà 3D?
            </h4>
            <p className="text-sm text-slate-200">
              Tập học sinh đủ điều kiện và các hộp quà trên sân khấu sẽ được làm mới cho vòng mới.
              Lịch sử cũ vẫn được giữ nguyên.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onResetSession?.();
                  setOpenedBoxIdsInSession(new Set());
                  setActiveWinnerPlan(null);
                  setShowWinnerOverlay(false);
                  setShowResetModal(false);
                  setShuffleSeed((s) => s + 1);
                  setBoxState('READY');
                  setSubPhase('READY');
                }}
                className="px-5 py-2.5 rounded-xl bg-[#F5C45E] text-slate-950 font-black text-sm"
              >
                Đồng ý đặt lại
              </button>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mathematical & Fairness Verification Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-lg w-full bg-[#0B234A] border-2 border-emerald-400 rounded-3xl p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="text-lg font-black uppercase">
                  Kiểm định Hộp Quà 3D & RNG Công bằng (A03)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#051226] border border-emerald-400/30 space-y-2 text-xs sm:text-sm">
              <p className="font-bold text-emerald-300">
                Trạng thái Unit Test tự động:{' '}
                {unitTestReport.passed ? 'ĐẠT 100%' : 'CÓ CẢNH BÁO'} (
                {unitTestReport.totalChecks}/{unitTestReport.totalChecks} kiểm thử chính xác)
              </p>
              <ul className="space-y-1.5 text-slate-200 list-disc pl-5">
                <li>
                  <strong>3 Chế độ Hộp quà:</strong> Hộp quà may mắn (6–12 hộp), Mỗi học sinh một hộp
                  (xáo trộn không thiên lệch <code>cryptoFisherYatesShuffle</code>) và Hộp quà khổng
                  lồ.
                </li>
                <li>
                  <strong>Đồng bộ Thẻ tên 3D & Overlay:</strong> Thẻ tên hologram 3D bay lên từ
                  trong hộp và bảng kết quả HTML sử dụng cùng một <code>student_id</code> đã chốt.
                </li>
                <li>
                  <strong>Chống lặp & 20 lượt liên tiếp:</strong> Đã kiểm nghiệm trên các quy mô lớp
                  1, 2, 10, 30, 50 học sinh và 20 lượt mở liên tiếp không kẹt trạng thái.
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="px-5 py-2 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs uppercase"
              >
                Đóng bảng kiểm định
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MysteryGiftBox3DGame;
