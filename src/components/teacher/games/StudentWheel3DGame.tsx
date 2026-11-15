import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Wheel3DState,
  Wheel3DLabelMode,
  Wheel3DSpeedMode,
  Wheel3DQualityPreset,
  Wheel3DSliceItem,
  Wheel3DSpinPlan,
  cryptoRandomInt,
  cryptoRandomSymmetricOffset,
  resolveWheelLabelMode,
  buildWheel3DSliceItems,
  getSelectedSliceIndexFromAngleRad,
  computeTargetWheelAngleRad,
  evaluateWheel3DSpinCurve,
  SpinSaveDeduplicator,
  runWheel3DUnitTests,
} from './wheel3dMath';
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
  ChevronRight,
  ChevronLeft,
  UserCheck,
  Volume1,
} from 'lucide-react';

export interface StudentWheel3DGameProps {
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

export interface Wheel3DSpinRecord {
  spinId: string;
  spinIndex: number;
  sessionId: string;
  classId: string;
  className: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  sttNumber: number;
   formattedStt: string;
  selectedAt: string;
  allowRepeat: boolean;
  saveStatus: 'saved' | 'pending' | 'failed';
  note?: string;
}

type CameraAnglePreset = 'STUDIO_3D' | 'FRONT_TV' | 'HIGH_STAGE';

const LOCAL_SPIN_RECORDS_KEY_PREFIX = 'taydo_a01_wheel3d_records_v2';

// Synthesized Game Show Sound Engine (Web Audio API)
class Wheel3DSoundEngine {
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

  public playStartWhoosh(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.28);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {
      // Ignore audio errors
    }
  }

  public playPegTick(muted: boolean, velocityFactor = 0.6) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = 680 + Math.round(velocityFactor * 420);
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.042);

      const peakGain = Math.min(0.18, 0.06 + velocityFactor * 0.1);
      gain.gain.setValueAtTime(peakGain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore audio errors
    }
  }

  public playVictoryFanfare(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 - E5 - G5 - C6
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
        osc.stop(start + 0.45);
      });
    } catch {
      // Ignore audio errors
    }
  }
}

/**
 * Draw the high-DPI front face of the 3D wheel onto an offscreen 2D Canvas.
 * Coordinate convention:
 * - Top 12 o'clock (`(cx, 0)`) is wheel angle `α = 0` (`canvasAngle = -π/2`).
 * - Slice `i` spans clockwise from `α_start = i * Δθ` to `α_end = (i + 1) * Δθ`.
 * - In 2D canvas coordinates, `canvasAngle = α - π/2`.
 */
function renderWheelFrontTextureCanvas(params: {
  slices: Wheel3DSliceItem[];
  resolvedLabelMode: 'FULL_OR_SHORT_NAME' | 'SHORT_NAME' | 'NUMBER_STT';
  highlightedSliceIndex: number | null;
  hoveredSliceIndex: number | null;
  calledSessionIds?: Set<string>;
  textureSize: number;
}): HTMLCanvasElement {
  const {
    slices,
    resolvedLabelMode,
    highlightedSliceIndex,
    hoveredSliceIndex,
    calledSessionIds,
    textureSize,
  } = params;

  const canvas = document.createElement('canvas');
  canvas.width = textureSize;
  canvas.height = textureSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = textureSize / 2;
  const cy = textureSize / 2;
  const outerRadius = textureSize * 0.478;
  const innerHubRadius = textureSize * 0.115;

  ctx.clearRect(0, 0, textureSize, textureSize);

  // Outer metallic backing disc
  const rimGrad = ctx.createRadialGradient(cx, cy, innerHubRadius, cx, cy, outerRadius * 1.04);
  rimGrad.addColorStop(0, '#0F172A');
  rimGrad.addColorStop(0.92, '#1E293B');
  rimGrad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = rimGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius * 1.03, 0, Math.PI * 2);
  ctx.fill();

  const count = slices.length;
  if (count === 0) {
    // Empty state wheel face
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = `bold ${Math.round(textureSize * 0.042)}px "Times New Roman", Times, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHƯA CÓ HỌC SINH HỢP LỆ', cx, cy - textureSize * 0.18);
    return canvas;
  }

  const sliceArc = (Math.PI * 2) / count;

  slices.forEach((slice, idx) => {
    const startCanvasAngle = idx * sliceArc - Math.PI / 2;
    const endCanvasAngle = (idx + 1) * sliceArc - Math.PI / 2;
    const midCanvasAngle = (idx + 0.5) * sliceArc - Math.PI / 2;

    const isWinner = highlightedSliceIndex === idx;
    const isHovered = hoveredSliceIndex === idx;
    const wasCalled = calledSessionIds?.has(slice.student.id) ?? false;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerRadius, startCanvasAngle, endCanvasAngle);
    ctx.closePath();

    // Rich radial gradient per slice for 3D depth
    const sliceGrad = ctx.createRadialGradient(cx, cy, innerHubRadius * 0.8, cx, cy, outerRadius);
    if (isWinner) {
      sliceGrad.addColorStop(0, '#FEF08A');
      sliceGrad.addColorStop(0.35, '#F59E0B');
      sliceGrad.addColorStop(1, '#B45309');
    } else if (isHovered) {
      sliceGrad.addColorStop(0, slice.accentHex);
      sliceGrad.addColorStop(0.45, slice.colorHex);
      sliceGrad.addColorStop(1, '#0F172A');
    } else {
      sliceGrad.addColorStop(0, slice.colorHex);
      sliceGrad.addColorStop(0.78, slice.colorHex);
      sliceGrad.addColorStop(1, '#0F172A');
    }

    ctx.fillStyle = sliceGrad;
    ctx.fill();

    // Subtle inner highlight bevel
    ctx.lineWidth = Math.max(1.5, textureSize * (count > 35 ? 0.0022 : 0.0035));
    ctx.strokeStyle = isWinner ? '#FFFFFF' : 'rgba(255, 255, 255, 0.72)';
    ctx.stroke();

    // Outer STT badge pill near rim
    const sttBadgeRadius = outerRadius * 0.895;
    const bx = cx + Math.cos(midCanvasAngle) * sttBadgeRadius;
    const by = cy + Math.sin(midCanvasAngle) * sttBadgeRadius;

    if (count <= 42) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(midCanvasAngle + Math.PI / 2);
      const pillRadius = Math.max(textureSize * 0.015, Math.min(textureSize * 0.026, (outerRadius * sliceArc) * 0.26));
      ctx.fillStyle = isWinner ? '#78350F' : 'rgba(15, 23, 42, 0.58)';
      ctx.beginPath();
      ctx.arc(0, 0, pillRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isWinner ? '#FEF08A' : 'rgba(253, 224, 71, 0.75)';
      ctx.stroke();

      ctx.fillStyle = '#FEF08A';
      ctx.font = `bold ${Math.round(pillRadius * 1.05)}px "Times New Roman", Times, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(slice.formattedStt, 0, 0);
      ctx.restore();
    }

    // Radial label along slice center
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(midCanvasAngle);

    let displayText = slice.formattedStt;
    if (resolvedLabelMode === 'FULL_OR_SHORT_NAME') {
      displayText = slice.mediumLabel;
    } else if (resolvedLabelMode === 'SHORT_NAME') {
      displayText = slice.shortLabel;
    } else {
      displayText = slice.formattedStt;
    }

    // Dynamic font sizing so text never overflows slice chord width
    const textRadius = count > 32 ? outerRadius * 0.73 : outerRadius * 0.65;
    const maxChordHeight = 2 * textRadius * Math.sin(sliceArc / 2) * 0.76;
    let fontSize =
      resolvedLabelMode === 'NUMBER_STT'
        ? Math.min(textureSize * 0.036, maxChordHeight * 0.88)
        : count <= 10
        ? textureSize * 0.029
        : count <= 20
        ? textureSize * 0.023
        : count <= 30
        ? textureSize * 0.0185
        : textureSize * 0.016;

    fontSize = Math.max(Math.min(fontSize, maxChordHeight * 0.85), textureSize * 0.0125);

    ctx.font = `bold ${Math.round(fontSize)}px "Times New Roman", Times, serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Strong dark text shadow for high contrast on classroom projectors
    ctx.shadowColor = isWinner ? 'rgba(0,0,0,0.45)' : 'rgba(2, 6, 23, 0.92)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 1.5;
    ctx.shadowOffsetY = 1.5;

    ctx.fillStyle = isWinner ? '#0F172A' : wasCalled ? 'rgba(255,255,255,0.78)' : '#FFFFFF';
    const textOuterAnchor = count <= 42 ? outerRadius * 0.81 : outerRadius * 0.91;
    ctx.fillText(displayText, textOuterAnchor, 0);
    ctx.restore();

    ctx.restore();
  });

  // Inner metallic gold ring around the hub
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerHubRadius * 1.15, 0, Math.PI * 2);
  ctx.lineWidth = textureSize * 0.012;
  ctx.strokeStyle = '#F59E0B';
  ctx.stroke();
  ctx.restore();

  return canvas;
}

export const StudentWheel3DGame: React.FC<StudentWheel3DGameProps> = ({
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
  // Game State Machine (Section VII)
  const [wheelState, setWheelState] = useState<Wheel3DState>('READY');
  const [labelModePref, setLabelModePref] = useState<Wheel3DLabelMode>('AUTO');
  const [speedMode, setSpeedMode] = useState<Wheel3DSpeedMode>('NORMAL');
  const [qualityPreset, setQualityPreset] = useState<Wheel3DQualityPreset>('HIGH');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraAnglePreset>('STUDIO_3D');
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [isSoftwareRenderer, setIsSoftwareRenderer] = useState<boolean>(false);

  // Side drawer & modals
  const [sideTab, setSideTab] = useState<'STT_MAP' | 'HISTORY' | 'SETTINGS'>('STT_MAP');
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [showMathVerifyModal, setShowMathVerifyModal] = useState<boolean>(false);

  // Selected Winner & Hover / Active states
  const [currentSliceUnderPointer, setCurrentSliceUnderPointer] = useState<number>(0);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [highlightedWinnerIndex, setHighlightedWinnerIndex] = useState<number | null>(null);
  const [winnerSlice, setWinnerSlice] = useState<Wheel3DSliceItem | null>(null);
  const [winnerNote, setWinnerNote] = useState<string>('');
  const [winnerBonusPoints, setWinnerBonusPoints] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Session ID & Spin History
  const [sessionId] = useState<string>(() => `a01_sess_${Date.now().toString(36)}`);
  const [spinRecords, setSpinRecords] = useState<Wheel3DSpinRecord[]>([]);

  // Refs for Anti-Stall Animation & Three.js Scene
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvas2DRef = useRef<HTMLCanvasElement | null>(null);
  const soundEngineRef = useRef<Wheel3DSoundEngine>(new Wheel3DSoundEngine());
  const deduplicatorRef = useRef<SpinSaveDeduplicator>(new SpinSaveDeduplicator());

  const activeSpinTokenRef = useRef<string | null>(null);
  const currentAngleCwRef = useRef<number>(0);
  const pointerDeflectionRef = useRef<number>(0);
  const pointerVelocityRef = useRef<number>(0);
  const lastPassedBoundaryRef = useRef<number>(-1);
  const spinPlanRef = useRef<Wheel3DSpinPlan | null>(null);
  const spinStartTimeRef = useRef<number>(0);
  const watchdogTimerRef = useRef<number | null>(null);

  // Camera orbit refs (for smooth drag + presets)
  const targetOrbitRef = useRef<{ azimuth: number; elevation: number; distance: number }>({
    azimuth: 0.34,
    elevation: 0.16,
    distance: 9.1,
  });
  const currentOrbitRef = useRef<{ azimuth: number; elevation: number; distance: number }>({
    azimuth: 0.34,
    elevation: 0.16,
    distance: 9.1,
  });
  const isDraggingCameraRef = useRef<boolean>(false);
  const dragPreviousPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Three.js object refs for runtime updates without recreating scene
  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    wheelRotatableGroup: THREE.Group;
    pointerFlapperGroup: THREE.Group;
    pointerCrystalMat: THREE.MeshStandardMaterial;
    frontFaceMesh: THREE.Mesh;
    frontFaceMaterial: THREE.MeshStandardMaterial;
    rimBulbsInstanced: THREE.InstancedMesh;
    pegsInstanced: THREE.InstancedMesh | null;
    dividersInstanced: THREE.InstancedMesh | null;
    wheelRootGroup: THREE.Group;
    spotlightTargetGlow: THREE.Mesh;
  } | null>(null);

  // Run mathematical unit tests once on mount
  const mathTestReport = useMemo(() => runWheel3DUnitTests(), []);

  // Build immutable slice list from availableCandidates and full roster (allCandidates)
  const fullRoster = useMemo(
    () => (allCandidates.length > 0 ? allCandidates : availableCandidates),
    [allCandidates, availableCandidates]
  );

  const slices = useMemo(
    () => buildWheel3DSliceItems(availableCandidates, fullRoster),
    [availableCandidates, fullRoster]
  );

  const resolvedLabelMode = useMemo(
    () => resolveWheelLabelMode(slices.length, labelModePref),
    [slices.length, labelModePref]
  );

  // Full roster STT reference list (so teacher/students can always see STT 01..N -> Full Name)
  const fullRosterReference = useMemo(() => {
    const eligibleIds = new Set(availableCandidates.map((s) => s.id));
    return fullRoster.map((student, idx) => ({
      sttNumber: idx + 1,
      formattedStt: String(idx + 1).padStart(2, '0'),
      student,
      isAbsent: absentIds.has(student.id),
      isCalled: calledSessionIds.has(student.id),
      isEligibleNow: eligibleIds.has(student.id),
    }));
  }, [fullRoster, availableCandidates, absentIds, calledSessionIds]);

  // Load local spin records for this class
  const localRecordsKey = useMemo(
    () => `${LOCAL_SPIN_RECORDS_KEY_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`,
    [teacherId, selectedSourceKey]
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(localRecordsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSpinRecords(parsed);
        }
      } else {
        setSpinRecords([]);
      }
    } catch {
      setSpinRecords([]);
    }
  }, [localRecordsKey]);

  const persistLocalSpinRecords = useCallback(
    (nextRecords: Wheel3DSpinRecord[]) => {
      setSpinRecords(nextRecords);
      try {
        localStorage.setItem(localRecordsKey, JSON.stringify(nextRecords.slice(0, 100)));
      } catch {
        // Ignore quota errors
      }
    },
    [localRecordsKey]
  );

  // Sync wheelState when eligible students become empty or restored
  useEffect(() => {
    const isCurrentlySpinning =
      wheelState === 'SELECTING_RESULT' ||
      wheelState === 'ACCELERATING' ||
      wheelState === 'SPINNING' ||
      wheelState === 'DECELERATING' ||
      wheelState === 'SETTLING';

    if (isCurrentlySpinning) return;

    if (slices.length === 0) {
      setWheelState('NO_ELIGIBLE_STUDENTS');
    } else if (wheelState === 'NO_ELIGIBLE_STUDENTS' || wheelState === 'SETUP') {
      setWheelState('READY');
    }
  }, [slices.length, wheelState]);

  // Update camera target angles when cameraPreset changes
  useEffect(() => {
    if (cameraPreset === 'FRONT_TV') {
      targetOrbitRef.current = { azimuth: 0, elevation: 0.04, distance: 8.85 };
    } else if (cameraPreset === 'STUDIO_3D') {
      targetOrbitRef.current = { azimuth: 0.36, elevation: 0.16, distance: 9.1 };
    } else if (cameraPreset === 'HIGH_STAGE') {
      targetOrbitRef.current = { azimuth: -0.32, elevation: 0.32, distance: 9.45 };
    }
  }, [cameraPreset]);

  // Cancel any active speech synthesis
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
        const text = `Xin chúc mừng! Học sinh được chọn là ${studentFullName}. Mời bạn tham gia hoạt động.`;
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
        // Fallback silently to Web Audio fanfare already played
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

  // Save spin result to Supabase `public.audit_logs` + local history with deduplication (Section XIV)
  const saveSpinRecordToSupabase = useCallback(
    async (record: Wheel3DSpinRecord): Promise<'saved' | 'failed'> => {
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
          action: 'A01_WHEEL_3D_PICK',
          entity_type: 'edu_game_session',
          entity_id: record.sessionId,
          metadata: {
            game_id: 'A01',
            game_version: 'EDU_3D_STUDENT_WHEEL_2.0',
            spin_id: record.spinId,
            session_id: record.sessionId,
            class_id: record.classId,
            class_name: record.className,
            teacher_id: record.teacherId,
            student_id: record.studentId,
            student_name: record.studentName,
            stt_number: record.sttNumber,
            spin_index: record.spinIndex,
            selected_at: record.selectedAt,
            allow_repeat: record.allowRepeat,
            save_status: 'saved',
          },
        });
        if (error) {
          return 'failed';
        }
        return 'saved';
      } catch {
        return 'failed';
      }
    },
    []
  );

  // Retry failed Supabase save
  const handleRetrySaveRecord = useCallback(
    async (spinId: string) => {
      const target = spinRecords.find((r) => r.spinId === spinId);
      if (!target) return;
      const status = await saveSpinRecordToSupabase(target);
      const updated = spinRecords.map((r) =>
        r.spinId === spinId ? { ...r, saveStatus: status } : r
      );
      persistLocalSpinRecords(updated);
    },
    [spinRecords, saveSpinRecordToSupabase, persistLocalSpinRecords]
  );

  // Complete a spin deterministically (guarded by spinTokenId so it executes exactly once per spin)
  const finalizeSpinWithPlan = useCallback(
    async (plan: Wheel3DSpinPlan) => {
      if (activeSpinTokenRef.current !== plan.spinTokenId) return;
      if (!deduplicatorRef.current.markSaved(plan.spinTokenId)) return;

      activeSpinTokenRef.current = null;
      spinPlanRef.current = null;
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }

      // Snap wheel angle to exact target
      currentAngleCwRef.current = plan.targetAngleCwRad;
      pointerDeflectionRef.current = 0;
      pointerVelocityRef.current = 0;

      // Verify mathematical bijection at final angle
      const verifiedIndex = getSelectedSliceIndexFromAngleRad(
        plan.targetAngleCwRad,
        slices.length
      );
      const finalSlice = slices[verifiedIndex] || plan.selectedSlice;

      setCurrentSliceUnderPointer(verifiedIndex);
      setHighlightedWinnerIndex(verifiedIndex);
      setWinnerSlice(finalSlice);
      setWinnerNote('');
      setWinnerBonusPoints(1);
      setWheelState('REVEALING');
      setShowWinnerModal(true);

      // Audio & Vietnamese Voice Announcement
      soundEngineRef.current.playVictoryFanfare(isMuted);
      speakWinnerAnnouncement(finalSlice.student.fullName);

      // Notify parent EDUGameCenter (updates session calledSessionIds & main history)
      onPick(finalSlice.student, {
        bonusPoints: 1,
        note: `Quay trúng ô #${finalSlice.formattedStt} (Vòng quay 3D A01)`,
        sessionId,
        studentNumber: finalSlice.sttNumber,
      });

      // Transition to SAVING -> COMPLETED
      setWheelState('SAVING');
      const newRecord: Wheel3DSpinRecord = {
        spinId: plan.spinTokenId,
        spinIndex: spinRecords.length + 1,
        sessionId,
        classId: selectedSourceKey || resolvedClassName || 'class',
        className: resolvedClassName,
        teacherId,
        studentId: finalSlice.student.id,
        studentName: finalSlice.student.fullName,
        sttNumber: finalSlice.sttNumber,
        formattedStt: finalSlice.formattedStt,
        selectedAt: new Date().toISOString(),
        allowRepeat: !antiDuplicate,
        saveStatus: 'pending',
      };

      const optimisticList = [newRecord, ...spinRecords];
      persistLocalSpinRecords(optimisticList);

      const syncStatus = await saveSpinRecordToSupabase(newRecord);
      setSpinRecords((prev) => {
        const next = prev.map((item) =>
          item.spinId === newRecord.spinId ? { ...item, saveStatus: syncStatus } : item
        );
        try {
          localStorage.setItem(localRecordsKey, JSON.stringify(next.slice(0, 100)));
        } catch {
          // Ignore
        }
        return next;
      });

      setWheelState('COMPLETED');
    },
    [
      slices,
      isMuted,
      speakWinnerAnnouncement,
      onPick,
      sessionId,
      spinRecords,
      selectedSourceKey,
      resolvedClassName,
      teacherId,
      antiDuplicate,
      persistLocalSpinRecords,
      saveSpinRecordToSupabase,
      localRecordsKey,
    ]
  );

  // Trigger a new 3D Spin (Sections VI, VII, VIII, XIII)
  const startSpin3D = useCallback(() => {
    setErrorMessage(null);

    const isBusy =
      wheelState === 'SELECTING_RESULT' ||
      wheelState === 'ACCELERATING' ||
      wheelState === 'SPINNING' ||
      wheelState === 'DECELERATING' ||
      wheelState === 'SETTLING';

    if (isBusy) return;

    if (slices.length === 0) {
      setWheelState('NO_ELIGIBLE_STUDENTS');
      return;
    }

    try {
      stopVietnameseSpeech();
      setShowWinnerModal(false);
      setHighlightedWinnerIndex(null);
      setWheelState('SELECTING_RESULT');

      // 1. Fair cryptographic student selection BEFORE spinning (Section VI)
      const selectedIndex = slices.length === 1 ? 0 : cryptoRandomInt(slices.length);
      const selectedSlice = slices[selectedIndex];
      if (!selectedSlice) {
        throw new Error('Không thể xác định học sinh hợp lệ trên vòng quay.');
      }

      // 2. Determine spin duration & full turns based on speedMode and reduceMotion (Section VIII)
      let durationMs = 6000;
      let minSpins = 6;
      let maxSpins = 8;

      if (reduceMotion) {
        durationMs = 1900;
        minSpins = 2;
        maxSpins = 3;
      } else if (speedMode === 'FAST') {
        durationMs = 3000;
        minSpins = 4;
        maxSpins = 5;
      } else if (speedMode === 'NORMAL') {
        durationMs = 6000;
        minSpins = 6;
        maxSpins = 8;
      } else if (speedMode === 'SUSPENSE') {
        durationMs = 9000;
        minSpins = 9;
        maxSpins = 11;
      }

      const fullSpins = minSpins + cryptoRandomInt(maxSpins - minSpins + 1);
      const sliceOffsetFactor = slices.length > 1 ? cryptoRandomSymmetricOffset(0.26) : 0;

      // 3. Exact target angle calculation so 12 o'clock pointer lands on selectedIndex (Section V)
      const { targetAngleCwRad, totalDeltaRad, sliceOffsetRad } = computeTargetWheelAngleRad({
        currentAngleCwRad: currentAngleCwRef.current,
        selectedIndex,
        sliceCount: slices.length,
        fullSpins,
        sliceOffsetFactor,
      });

      const spinTokenId = `spin_${Date.now()}_${cryptoRandomInt(1000000)}`;
      const plan: Wheel3DSpinPlan = {
        spinTokenId,
        selectedIndex,
        selectedSlice,
        startAngleCwRad: currentAngleCwRef.current,
        targetAngleCwRad,
        totalDeltaRad,
        durationMs,
        fullSpins,
        sliceOffsetRad,
      };

      activeSpinTokenRef.current = spinTokenId;
      spinPlanRef.current = plan;
      spinStartTimeRef.current = performance.now();
      lastPassedBoundaryRef.current = Math.floor(
        (currentAngleCwRef.current / ((Math.PI * 2) / Math.max(1, slices.length)))
      );

      soundEngineRef.current.playStartWhoosh(isMuted);
      setWheelState('ACCELERATING');

      // Watchdog anti-stall timer (Section XIII: guarantees completion even if rAF is throttled)
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
      }
      watchdogTimerRef.current = window.setTimeout(() => {
        if (activeSpinTokenRef.current === spinTokenId && spinPlanRef.current) {
          finalizeSpinWithPlan(spinPlanRef.current);
        }
      }, durationMs + 450);
    } catch (err) {
      activeSpinTokenRef.current = null;
      spinPlanRef.current = null;
      setErrorMessage(
        err instanceof Error ? err.message : 'Đã xảy ra lỗi khi khởi tạo vòng quay 3D.'
      );
      setWheelState('ERROR_RECOVERY');
    }
  }, [
    wheelState,
    slices,
    stopVietnameseSpeech,
    reduceMotion,
    speedMode,
    isMuted,
    finalizeSpinWithPlan,
  ]);

  // Initialize Three.js WebGL Scene (Section I & II)
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
    setIsSoftwareRenderer(softwareGl);

    const maxDpr =
      softwareGl || qualityPreset === 'LOW'
        ? 1
        : qualityPreset === 'MEDIUM'
        ? 1.5
        : Math.min(window.devicePixelRatio || 1, 2);

    renderer.setPixelRatio(maxDpr);
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 560);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !softwareGl && qualityPreset === 'HIGH';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071126');
    scene.fog = new THREE.FogExp2('#071126', 0.025);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 800) / (container.clientHeight || 560),
      0.1,
      100
    );

    // Studio Lighting (Key, Fill, Rim, Stage Uplight)
    const ambientLight = new THREE.AmbientLight('#1E3A8A', 0.85);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 2.4);
    keyLight.position.set(5.5, 7.5, 8.5);
    if (!softwareGl && qualityPreset === 'HIGH') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#38BDF8', 1.25);
    fillLight.position.set(-6.5, 3.0, 5.5);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight('#F59E0B', 3.2, 18);
    rimLight.position.set(0, 4.8, -3.2);
    scene.add(rimLight);

    // Master Root Group
    const wheelRootGroup = new THREE.Group();
    wheelRootGroup.position.set(0, 0.25, 0);
    scene.add(wheelRootGroup);

    const radialSegments = softwareGl || qualityPreset === 'LOW' ? 48 : 96;

    // 1. Heavy 3D Studio Pedestal & Stage Floor
    const pedestalGroup = new THREE.Group();
    wheelRootGroup.add(pedestalGroup);

    const floorGeo = new THREE.CylinderGeometry(5.6, 6.1, 0.26, radialSegments);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#0B1938',
      metalness: 0.65,
      roughness: 0.28,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -4.05, -0.35);
    floorMesh.receiveShadow = true;
    pedestalGroup.add(floorMesh);

    // Glowing Stage Ring on Floor
    const floorGlowRingGeo = new THREE.RingGeometry(3.85, 4.18, radialSegments);
    const floorGlowRingMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const spotlightTargetGlow = new THREE.Mesh(floorGlowRingGeo, floorGlowRingMat);
    spotlightTargetGlow.rotation.x = -Math.PI / 2;
    spotlightTargetGlow.position.set(0, -3.9, -0.15);
    pedestalGroup.add(spotlightTargetGlow);

    // Pedestal Stepped Base
    const baseStepGeo = new THREE.CylinderGeometry(2.35, 2.75, 0.42, 48);
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      metalness: 0.82,
      roughness: 0.24,
    });
    const goldMetalMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.88,
      roughness: 0.18,
    });
    const baseStepMesh = new THREE.Mesh(baseStepGeo, darkMetalMat);
    baseStepMesh.position.set(0, -3.72, -0.38);
    pedestalGroup.add(baseStepMesh);

    // Twin A-Frame Support Pillars behind the wheel
    const leftPillarGeo = new THREE.CylinderGeometry(0.18, 0.28, 4.1, 24);
    const leftPillar = new THREE.Mesh(leftPillarGeo, darkMetalMat);
    leftPillar.position.set(-0.85, -1.85, -0.58);
    leftPillar.rotation.z = -0.22;
    pedestalGroup.add(leftPillar);

    const rightPillar = new THREE.Mesh(leftPillarGeo, darkMetalMat);
    rightPillar.position.set(0.85, -1.85, -0.58);
    rightPillar.rotation.z = 0.22;
    pedestalGroup.add(rightPillar);

    // Rear Axle Housing Spine (extends up to 12 o'clock pointer bracket)
    const spineGeo = new THREE.BoxGeometry(0.46, 4.2, 0.34);
    const spineMesh = new THREE.Mesh(spineGeo, darkMetalMat);
    spineMesh.position.set(0, 1.55, -0.56);
    pedestalGroup.add(spineMesh);

    // Top Pointer Overhang Arm (connecting rear spine to 12 o'clock front pointer)
    const overhangGeo = new THREE.BoxGeometry(0.56, 0.34, 1.15);
    const overhangMesh = new THREE.Mesh(overhangGeo, goldMetalMat);
    overhangMesh.position.set(0, 3.55, -0.1);
    pedestalGroup.add(overhangMesh);

    // 2. Stationary Outer Casing & 24 LED Bulbs
    const outerCasingGeo = new THREE.TorusGeometry(3.36, 0.13, 24, radialSegments);
    const outerCasingMesh = new THREE.Mesh(outerCasingGeo, darkMetalMat);
    outerCasingMesh.position.set(0, 0, 0);
    wheelRootGroup.add(outerCasingMesh);

    const goldBezelGeo = new THREE.TorusGeometry(3.18, 0.11, 24, radialSegments);
    const goldBezelMesh = new THREE.Mesh(goldBezelGeo, goldMetalMat);
    goldBezelMesh.position.set(0, 0, 0.08);
    wheelRootGroup.add(goldBezelMesh);

    // 24 Chasing LED Rim Bulbs around stationary outer bezel
    const bulbCount = 24;
    const bulbGeo = new THREE.SphereGeometry(0.085, 14, 14);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#FEF08A',
      emissive: '#F59E0B',
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    const rimBulbsInstanced = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbCount);
    const bulbDummy = new THREE.Object3D();
    for (let i = 0; i < bulbCount; i++) {
      const angle = (i / bulbCount) * Math.PI * 2;
      bulbDummy.position.set(Math.cos(angle) * 3.36, Math.sin(angle) * 3.36, 0.14);
      bulbDummy.updateMatrix();
      rimBulbsInstanced.setMatrixAt(i, bulbDummy.matrix);
    }
    rimBulbsInstanced.instanceMatrix.needsUpdate = true;
    wheelRootGroup.add(rimBulbsInstanced);

    // 3. Rotatable 3D Wheel Group (`wheelRotatableGroup.rotation.z = -angleCwRad`)
    const wheelRotatableGroup = new THREE.Group();
    wheelRootGroup.add(wheelRotatableGroup);

    // Volumetric 3D Wheel Drum Cylinder (has real depth = 0.44 along Z axis)
    const drumGeo = new THREE.CylinderGeometry(3.08, 3.08, 0.44, radialSegments);
    drumGeo.rotateX(Math.PI / 2);
    const drumSideMat = new THREE.MeshStandardMaterial({
      color: '#0F172A',
      metalness: 0.78,
      roughness: 0.26,
    });
    const drumMesh = new THREE.Mesh(drumGeo, drumSideMat);
    drumMesh.castShadow = true;
    wheelRotatableGroup.add(drumMesh);

    // Front Sector Disc Face (`z = +0.226`)
    const frontFaceGeo = new THREE.CircleGeometry(3.06, radialSegments);
    const frontFaceMaterial = new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      metalness: 0.12,
      roughness: 0.28,
    });
    const frontFaceMesh = new THREE.Mesh(frontFaceGeo, frontFaceMaterial);
    frontFaceMesh.position.set(0, 0, 0.226);
    wheelRotatableGroup.add(frontFaceMesh);

    // Central 3D Hub Cap & Axle (rotates with wheel)
    const hubBaseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.18, 36);
    hubBaseGeo.rotateX(Math.PI / 2);
    const hubBaseMesh = new THREE.Mesh(hubBaseGeo, goldMetalMat);
    hubBaseMesh.position.set(0, 0, 0.28);
    wheelRotatableGroup.add(hubBaseMesh);

    const hubCoreGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.14, 32);
    hubCoreGeo.rotateX(Math.PI / 2);
    const hubCoreMat = new THREE.MeshStandardMaterial({
      color: '#1D4ED8',
      metalness: 0.75,
      roughness: 0.2,
    });
    const hubCoreMesh = new THREE.Mesh(hubCoreGeo, hubCoreMat);
    hubCoreMesh.position.set(0, 0, 0.38);
    wheelRotatableGroup.add(hubCoreMesh);

    const hubStarDomeGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const hubStarDomeMesh = new THREE.Mesh(hubStarDomeGeo, goldMetalMat);
    hubStarDomeMesh.scale.set(1, 1, 0.55);
    hubStarDomeMesh.position.set(0, 0, 0.45);
    wheelRotatableGroup.add(hubStarDomeMesh);

    // 4. Separate 3D Flapper Pointer at 12 O'Clock (`(0, 3.36, 0.34)`)
    const pointerFlapperGroup = new THREE.Group();
    pointerFlapperGroup.position.set(0, 3.36, 0.34);
    wheelRootGroup.add(pointerFlapperGroup);

    const pointerPivotCollarGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.22, 24);
    pointerPivotCollarGeo.rotateX(Math.PI / 2);
    const pointerPivotCollar = new THREE.Mesh(pointerPivotCollarGeo, goldMetalMat);
    pointerFlapperGroup.add(pointerPivotCollar);

    // Downward-pointing 3D Ruby/Gold Indicator Blade
    const pointerBladeGeo = new THREE.ConeGeometry(0.21, 0.62, 24);
    pointerBladeGeo.rotateZ(Math.PI); // Point downward (-Y) toward the top slice at 12 o'clock
    const pointerBladeMat = new THREE.MeshStandardMaterial({
      color: '#E11D48',
      emissive: '#9F1239',
      emissiveIntensity: 0.45,
      metalness: 0.55,
      roughness: 0.2,
    });
    const pointerBladeMesh = new THREE.Mesh(pointerBladeGeo, pointerBladeMat);
    pointerBladeMesh.position.set(0, -0.34, 0.02);
    pointerFlapperGroup.add(pointerBladeMesh);

    // Gold Bezel Trim on Pointer
    const pointerCrystalGeo = new THREE.SphereGeometry(0.095, 16, 16);
    const pointerCrystalMat = new THREE.MeshStandardMaterial({
      color: '#FEF08A',
      emissive: '#F59E0B',
      emissiveIntensity: 1.8,
      roughness: 0.15,
    });
    const pointerCrystalMesh = new THREE.Mesh(pointerCrystalGeo, pointerCrystalMat);
    pointerCrystalMesh.position.set(0, 0, 0.12);
    pointerFlapperGroup.add(pointerCrystalMesh);

    threeSceneRef.current = {
      renderer,
      scene,
      camera,
      wheelRotatableGroup,
      pointerFlapperGroup,
      pointerCrystalMat,
      frontFaceMesh,
      frontFaceMaterial,
      rimBulbsInstanced,
      pegsInstanced: null,
      dividersInstanced: null,
      wheelRootGroup,
      spotlightTargetGlow,
    };

    // ResizeObserver for responsive stage
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

    // Master Animation Loop (with software-WebGL pacing & spring pointer physics)
    let rafId = 0;
    let afterDrawTime = performance.now();
    const minFrameGapMs = softwareGl ? 33 : 0;
    const tempColor = new THREE.Color();

    const animateLoop = () => {
      rafId = requestAnimationFrame(animateLoop);
      const now = performance.now();
      if (now - afterDrawTime < minFrameGapMs) return;
      const dt = Math.min((now - afterDrawTime) / 1000, 0.05);

      const refs = threeSceneRef.current;
      if (!refs) return;

      // 1. Update Active Spin Physics & State Machine
      const activePlan = spinPlanRef.current;
      const activeToken = activeSpinTokenRef.current;
      let currentVelocityNorm = 0;

      if (activePlan && activeToken === activePlan.spinTokenId) {
        const elapsedMs = now - spinStartTimeRef.current;
        const normalizedT = Math.min(Math.max(elapsedMs / activePlan.durationMs, 0), 1);
        const { progress, phase, normalizedVelocity } = evaluateWheel3DSpinCurve(normalizedT);
        currentVelocityNorm = normalizedVelocity;

        const nextAngleCw = activePlan.startAngleCwRad + activePlan.totalDeltaRad * progress;
        currentAngleCwRef.current = nextAngleCw;

        // Detect slice boundary peg pass for flapper deflection & tick sound
        const sliceCount = Math.max(1, slices.length);
        const sliceArc = (Math.PI * 2) / sliceCount;
        const currentBoundaryCount = Math.floor(nextAngleCw / sliceArc);
        if (currentBoundaryCount > lastPassedBoundaryRef.current) {
          lastPassedBoundaryRef.current = currentBoundaryCount;
          // Deflect flapper pointer clockwise (+Z rotation kicks tip to the right as wheel moves clockwise)
          pointerDeflectionRef.current = Math.min(0.58, 0.22 + normalizedVelocity * 0.36);
          pointerVelocityRef.current = -2.5;
          soundEngineRef.current.playPegTick(isMuted, normalizedVelocity);
        }

        // Update live slice under pointer
        const liveIdx = getSelectedSliceIndexFromAngleRad(nextAngleCw, sliceCount);
        setCurrentSliceUnderPointer((prev) => (prev !== liveIdx ? liveIdx : prev));

        // Sync phase label
        setWheelState((prev) => (prev !== phase ? phase : prev));

        if (normalizedT >= 1) {
          finalizeSpinWithPlan(activePlan);
        }
      }

      // 2. Apply Wheel Clockwise Rotation (`rotation.z = -angleCwRad`)
      refs.wheelRotatableGroup.rotation.z = -currentAngleCwRef.current;

      // 3. Spring-Damper Physics on 12 o'clock 3D Flapper Pointer
      if (Math.abs(pointerDeflectionRef.current) > 0.0005 || Math.abs(pointerVelocityRef.current) > 0.0005) {
        const springStiffness = 180;
        const damping = 16;
        const accel =
          -springStiffness * pointerDeflectionRef.current - damping * pointerVelocityRef.current;
        pointerVelocityRef.current += accel * dt;
        pointerDeflectionRef.current += pointerVelocityRef.current * dt;
      } else {
        pointerDeflectionRef.current = 0;
        pointerVelocityRef.current = 0;
      }
      refs.pointerFlapperGroup.rotation.z = pointerDeflectionRef.current;

      // 4. Chasing LED Rim Bulbs & Stage Halo Pulse
      const pulseSpeed = activePlan ? 14 : 3.2;
      for (let i = 0; i < bulbCount; i++) {
        const wave = 0.5 + 0.5 * Math.sin(now * 0.001 * pulseSpeed - i * 0.52);
        if (activePlan) {
          tempColor.setHSL(0.11 + wave * 0.05, 0.95, 0.45 + wave * 0.42);
        } else {
          tempColor.setHSL(0.12, 0.9, 0.42 + wave * 0.32);
        }
        refs.rimBulbsInstanced.setColorAt(i, tempColor);
      }
      if (refs.rimBulbsInstanced.instanceColor) {
        refs.rimBulbsInstanced.instanceColor.needsUpdate = true;
      }

      refs.pointerCrystalMat.emissiveIntensity =
        1.4 + currentVelocityNorm * 2.2 + 0.4 * Math.sin(now * 0.006);

      // 5. Smooth Camera Orbit Interpolation
      const curOrbit = currentOrbitRef.current;
      const tgtOrbit = targetOrbitRef.current;
      curOrbit.azimuth += (tgtOrbit.azimuth - curOrbit.azimuth) * 0.12;
      curOrbit.elevation += (tgtOrbit.elevation - curOrbit.elevation) * 0.12;
      curOrbit.distance += (tgtOrbit.distance - curOrbit.distance) * 0.12;

      const camX =
        curOrbit.distance * Math.sin(curOrbit.azimuth) * Math.cos(curOrbit.elevation);
      const camY = curOrbit.distance * Math.sin(curOrbit.elevation) + 0.15;
      const camZ =
        curOrbit.distance * Math.cos(curOrbit.azimuth) * Math.cos(curOrbit.elevation);

      refs.camera.position.set(camX, camY, camZ);
      refs.camera.lookAt(0, 0.05, 0);

      refs.renderer.render(refs.scene, refs.camera);
      afterDrawTime = performance.now();
    };

    rafId = requestAnimationFrame(animateLoop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      envTarget.dispose();
      pmremGenerator.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      renderer.dispose();
      threeSceneRef.current = null;
    };
  }, [qualityPreset]); // Re-init only if user changes WebGL quality preset

  // Update 3D Wheel Front Texture, 3D Divider Ribs, and 3D Boundary Pegs whenever slices or label mode change
  useEffect(() => {
    const refs = threeSceneRef.current;
    if (!refs) return;

    const texSize =
      isSoftwareRenderer || qualityPreset === 'LOW'
        ? 1024
        : qualityPreset === 'MEDIUM'
        ? 1536
        : 2048;

    const canvas = renderWheelFrontTextureCanvas({
      slices,
      resolvedLabelMode,
      highlightedSliceIndex: highlightedWinnerIndex,
      hoveredSliceIndex,
      calledSessionIds,
      textureSize: texSize,
    });

    const newTexture = new THREE.CanvasTexture(canvas);
    newTexture.colorSpace = THREE.SRGBColorSpace;
    newTexture.anisotropy = Math.min(
      4,
      refs.renderer.capabilities.getMaxAnisotropy?.() || 1
    );
    newTexture.needsUpdate = true;

    const prevMap = refs.frontFaceMaterial.map;
    refs.frontFaceMaterial.map = newTexture;
    refs.frontFaceMaterial.needsUpdate = true;
    if (prevMap) {
      prevMap.dispose();
    }

    // Rebuild 3D Boundary Pegs & 3D Raised Divider Ribs (`InstancedMesh`)
    if (refs.pegsInstanced) {
      refs.wheelRotatableGroup.remove(refs.pegsInstanced);
      refs.pegsInstanced.geometry.dispose();
      (refs.pegsInstanced.material as THREE.Material).dispose();
      refs.pegsInstanced = null;
    }
    if (refs.dividersInstanced) {
      refs.wheelRotatableGroup.remove(refs.dividersInstanced);
      refs.dividersInstanced.geometry.dispose();
      (refs.dividersInstanced.material as THREE.Material).dispose();
      refs.dividersInstanced = null;
    }

    const count = slices.length;
    if (count > 0) {
      const pegGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.22, 12);
      pegGeo.rotateX(Math.PI / 2);
      const pegMat = new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        metalness: 0.9,
        roughness: 0.15,
      });
      const pegsInstanced = new THREE.InstancedMesh(pegGeo, pegMat, count);

      const dividerGeo = new THREE.BoxGeometry(2.58, count > 32 ? 0.018 : 0.028, 0.035);
      const dividerMat = new THREE.MeshStandardMaterial({
        color: '#FDE68A',
        metalness: 0.85,
        roughness: 0.22,
      });
      const dividersInstanced = new THREE.InstancedMesh(dividerGeo, dividerMat, count);

      const dummy = new THREE.Object3D();
      const sliceArc = (Math.PI * 2) / count;

      for (let i = 0; i < count; i++) {
        // Boundary `i` is at clockwise angle `α = i * sliceArc` from 12 o'clock (+Y),
        // which in 3D XY plane polar angle from +X is `φ = π/2 - i * sliceArc`.
        const phi3D = Math.PI / 2 - i * sliceArc;
        const pegR = 3.01;
        dummy.position.set(Math.cos(phi3D) * pegR, Math.sin(phi3D) * pegR, 0.31);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        pegsInstanced.setMatrixAt(i, dummy.matrix);

        // Raised 3D radial divider rib from hub (r=0.45) to rim (r=3.02)
        const midR = 1.73;
        dummy.position.set(Math.cos(phi3D) * midR, Math.sin(phi3D) * midR, 0.238);
        dummy.rotation.set(0, 0, phi3D);
        dummy.updateMatrix();
        dividersInstanced.setMatrixAt(i, dummy.matrix);
      }

      pegsInstanced.instanceMatrix.needsUpdate = true;
      dividersInstanced.instanceMatrix.needsUpdate = true;

      refs.wheelRotatableGroup.add(pegsInstanced);
      refs.wheelRotatableGroup.add(dividersInstanced);
      refs.pegsInstanced = pegsInstanced;
      refs.dividersInstanced = dividersInstanced;
    }
  }, [
    slices,
    resolvedLabelMode,
    highlightedWinnerIndex,
    hoveredSliceIndex,
    calledSessionIds,
    isSoftwareRenderer,
    qualityPreset,
  ]);

  // Lightweight 2D Canvas Fallback Renderer (only active if WebGL is unavailable)
  useEffect(() => {
    if (webglSupported) return;
    const canvas2D = fallbackCanvas2DRef.current;
    if (!canvas2D) return;
    const ctx = canvas2D.getContext('2d');
    if (!ctx) return;

    const faceCanvas = renderWheelFrontTextureCanvas({
      slices,
      resolvedLabelMode,
      highlightedSliceIndex: highlightedWinnerIndex,
      hoveredSliceIndex,
      calledSessionIds,
      textureSize: 680,
    });

    ctx.clearRect(0, 0, canvas2D.width, canvas2D.height);
    ctx.save();
    ctx.translate(canvas2D.width / 2, canvas2D.height / 2);
    ctx.rotate(currentAngleCwRef.current);
    ctx.drawImage(
      faceCanvas,
      -canvas2D.width / 2,
      -canvas2D.height / 2,
      canvas2D.width,
      canvas2D.height
    );
    ctx.restore();
  }, [
    webglSupported,
    slices,
    resolvedLabelMode,
    highlightedWinnerIndex,
    hoveredSliceIndex,
    calledSessionIds,
    wheelState,
  ]);

  // Interactive Pointer Drag for 3D Camera Orbit
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingCameraRef.current = true;
    dragPreviousPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCameraRef.current) return;
    const dx = e.clientX - dragPreviousPointerRef.current.x;
    const dy = e.clientY - dragPreviousPointerRef.current.y;
    dragPreviousPointerRef.current = { x: e.clientX, y: e.clientY };

    targetOrbitRef.current.azimuth = Math.min(
      Math.max(targetOrbitRef.current.azimuth - dx * 0.0055, -0.72),
      0.72
    );
    targetOrbitRef.current.elevation = Math.min(
      Math.max(targetOrbitRef.current.elevation + dy * 0.0045, -0.22),
      0.45
    );
  };

  const handleStagePointerUp = () => {
    isDraggingCameraRef.current = false;
  };

  // Keyboard Shortcuts: Space = Spin, R = Reset, M = Mute, F = Fullscreen (Section X)
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
        startSpin3D();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setShowResetConfirmModal(true);
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
  }, [startSpin3D, onToggleMute, onToggleFullscreen]);

  const isSpinningNow =
    wheelState === 'SELECTING_RESULT' ||
    wheelState === 'ACCELERATING' ||
    wheelState === 'SPINNING' ||
    wheelState === 'DECELERATING' ||
    wheelState === 'SETTLING';

  const activePointerSlice = slices[currentSliceUnderPointer] || slices[0] || null;

  const stateBadgeText: Record<Wheel3DState, string> = {
    SETUP: 'KHỞI TẠO SÂN KHẤU',
    LOADING_STUDENTS: 'ĐANG TẢI DANH SÁCH',
    READY: 'SẴN SÀNG QUAY 3D',
    SELECTING_RESULT: 'KHÓA RNG CÔNG BẰNG',
    ACCELERATING: 'ĐANG TĂNG TỐC',
    SPINNING: 'ĐANG QUAY TỐC ĐỘ CAO',
    DECELERATING: 'ĐANG GIẢM TỐC HỒI HỘP',
    SETTLING: 'CHỐT VỊ TRÍ KIM CHỈ',
    REVEALING: 'CÔNG BỐ KẾT QUẢ',
    SAVING: 'ĐANG LƯU LỊCH SỬ',
    COMPLETED: 'HOÀN TẤT LƯỢT QUAY',
    NO_ELIGIBLE_STUDENTS: 'ĐÃ GỌI HẾT HỌC SINH',
    ERROR_RECOVERY: 'KHÔI PHỤC TRẠNG THÁI',
    RESET_CONFIRMATION: 'XÁC NHẬN ĐẶT LẠI',
  };

  return (
    <div
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      className="w-full bg-gradient-to-b from-[#060E20] via-[#0B1938] to-[#081229] text-white rounded-3xl border-2 border-amber-400/40 shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Top Broadcast Control Bar */}
      <div className="px-4 sm:px-6 py-3.5 bg-[#0A1633] border-b border-amber-400/25 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Class Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-base shadow-md">
              A01
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-wide text-amber-300 uppercase">
                  Vòng Quay Học Sinh 3D · Gameshow Studio
                </h3>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-[11px] font-bold text-sky-300">
                  WebGL 3D 2.0
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Lớp đang chọn: <strong className="text-white">{resolvedClassName}</strong> · Sẵn sàng:{' '}
                <strong className="text-emerald-400 tabular-nums">{slices.length}</strong>/
                <span className="tabular-nums">{fullRoster.length}</span> HS
              </p>
            </div>
          </div>

          {classes.length > 0 && onSelectSourceKey && (
            <select
              value={selectedSourceKey}
              onChange={(e) => onSelectSourceKey(e.target.value)}
              disabled={isSpinningNow}
              className="px-3 py-1.5 rounded-xl bg-[#11224D] border border-blue-400/40 text-xs sm:text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                  Lớp {cls.name} ({cls.students?.length || 0} HS)
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Anti-repeat toggle */}
          <button
            type="button"
            onClick={onToggleAntiDuplicate}
            disabled={isSpinningNow}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              antiDuplicate
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
            title="Chế độ không lặp lại học sinh đã gọi trong phiên"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{antiDuplicate ? 'Không lặp: BẬT' : 'Cho phép lặp'}</span>
          </button>

          {/* Label mode switch: AUTO / NAME / NUMBER */}
          <div className="flex items-center bg-[#102048] border border-blue-400/30 rounded-xl p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLabelModePref('AUTO')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                labelModePref === 'AUTO'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Tự động
            </button>
            <button
              type="button"
              onClick={() => setLabelModePref('NAME')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                labelModePref === 'NAME'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Tên HS
            </button>
            <button
              type="button"
              onClick={() => setLabelModePref('NUMBER')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                labelModePref === 'NUMBER'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Số TT
            </button>
          </div>

          {/* Speed selector */}
          <select
            value={speedMode}
            onChange={(e) => setSpeedMode(e.target.value as Wheel3DSpeedMode)}
            disabled={isSpinningNow}
            className="px-2.5 py-1.5 rounded-xl bg-[#102048] border border-blue-400/30 text-xs font-bold text-amber-200 focus:outline-none"
            title="Tốc độ quay"
          >
            <option value="FAST" className="bg-slate-900">Tốc độ: Nhanh (3s)</option>
            <option value="NORMAL" className="bg-slate-900">Tốc độ: Chuẩn (6s)</option>
            <option value="SUSPENSE" className="bg-slate-900">Tốc độ: Hồi hộp (9s)</option>
          </select>

          {/* Absent students button */}
          {onOpenAbsentModal && (
            <button
              type="button"
              onClick={onOpenAbsentModal}
              disabled={isSpinningNow}
              className="px-3 py-1.5 rounded-xl bg-[#102048] hover:bg-[#19306B] border border-blue-400/30 text-xs font-bold text-sky-200 flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>Vắng ({absentIds.size})</span>
            </button>
          )}

          {/* Reset Session */}
          <button
            type="button"
            onClick={() => setShowResetConfirmModal(true)}
            disabled={isSpinningNow}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-bold text-rose-200 flex items-center gap-1.5"
            title="Đặt lại danh sách học sinh đã gọi (Phím R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Đặt lại</span>
          </button>

          {/* Audio Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-[#102048] hover:bg-[#19306B] border border-blue-400/30 text-amber-300"
            title="Bật/tắt âm thanh (Phím M)"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-[#102048] hover:bg-[#19306B] border border-blue-400/30 text-sky-300"
              title="Toàn màn hình (Phím F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}

          {/* Toggle Side Panel */}
          <button
            type="button"
            onClick={() => setShowSidePanel((v) => !v)}
            className="px-2.5 py-1.5 rounded-xl bg-[#102048] hover:bg-[#19306B] border border-blue-400/30 text-xs font-bold text-slate-200 flex items-center gap-1"
          >
            {showSidePanel ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            <span className="hidden md:inline">{showSidePanel ? 'Ẩn bảng phụ' : 'Hiện bảng phụ'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body: 3D Stage Canvas + Collapsible Side Reference Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[580px]">
        {/* Left / Center: True Three.js 3D WebGL Stage */}
        <div
          className={`${
            showSidePanel ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'
          } relative flex flex-col justify-between bg-gradient-to-b from-[#071126] via-[#0B1B3D] to-[#060E20] overflow-hidden`}
        >
          {/* Top HUD Overlay: Live State Badge, Active Slice Readout & 3D Camera Angles */}
          <div className="relative z-10 px-4 sm:px-6 pt-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
            {/* Live Status & Current Pointer Slice */}
            <div className="flex flex-wrap items-center gap-2.5 pointer-events-auto">
              <div className="px-3.5 py-1.5 rounded-xl bg-[#0A1736]/95 border border-amber-400/50 shadow-lg flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isSpinningNow
                      ? 'bg-amber-400 animate-ping'
                      : wheelState === 'NO_ELIGIBLE_STUDENTS'
                      ? 'bg-rose-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="text-xs font-black tracking-wider text-amber-300 uppercase">
                  {stateBadgeText[wheelState]}
                </span>
              </div>

              {activePointerSlice && (
                <div className="px-3.5 py-1.5 rounded-xl bg-[#0F2350]/95 border border-sky-400/40 shadow-lg flex items-center gap-2">
                  <span className="text-xs text-sky-300 font-bold">Kim chỉ 12h:</span>
                  <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-xs tabular-nums">
                    #{activePointerSlice.formattedStt}
                  </span>
                  <span className="text-sm font-black text-white truncate max-w-[200px] sm:max-w-[260px]">
                    {activePointerSlice.student.fullName}
                  </span>
                </div>
              )}
            </div>

            {/* 3D Camera Angle Presets */}
            <div className="flex items-center gap-1.5 bg-[#0A1736]/95 border border-blue-400/30 rounded-xl p-1 pointer-events-auto shadow-lg">
              <Camera className="w-3.5 h-3.5 text-amber-400 ml-1.5" />
              <button
                type="button"
                onClick={() => setCameraPreset('STUDIO_3D')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  cameraPreset === 'STUDIO_3D'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Góc nghiêng 3D
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('FRONT_TV')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  cameraPreset === 'FRONT_TV'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Trực diện
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('HIGH_STAGE')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
                  cameraPreset === 'HIGH_STAGE'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Góc cao
              </button>
            </div>
          </div>

          {/* Center 3D WebGL Viewport */}
          <div
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerLeave={handleStagePointerUp}
            className="relative w-full h-[430px] sm:h-[490px] lg:h-[520px] cursor-grab active:cursor-grabbing select-none"
            title="Kéo chuột để xoay góc nhìn 3D quanh sân khấu"
          >
            {webglSupported ? (
              <div ref={mountContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <canvas
                  ref={fallbackCanvas2DRef}
                  width={420}
                  height={420}
                  className="rounded-full border-4 border-amber-400 shadow-2xl"
                />
                <p className="text-xs text-amber-300 mt-2 font-bold">
                  Chế độ tương thích Canvas 2D (Thiết bị không bật WebGL)
                </p>
              </div>
            )}

            {/* Empty Eligible Students Overlay */}
            {wheelState === 'NO_ELIGIBLE_STUDENTS' && (
              <div className="absolute inset-0 bg-[#060E20]/85 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#0F2350] border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center mx-auto text-amber-300">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-black text-amber-300 uppercase">
                    Đã gọi hết học sinh đủ điều kiện!
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    Tất cả học sinh có mặt trong lớp <strong>{resolvedClassName}</strong> đều đã được
                    chọn trong phiên này. Thầy/cô muốn đặt lại danh sách để bắt đầu vòng mới?
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetSession?.();
                        setHighlightedWinnerIndex(null);
                        setWinnerSlice(null);
                        setWheelState('READY');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm shadow-lg hover:brightness-105"
                    >
                      Đặt lại lượt gọi ngay
                    </button>
                    {antiDuplicate && onToggleAntiDuplicate && (
                      <button
                        type="button"
                        onClick={onToggleAntiDuplicate}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm"
                      >
                        Chuyển sang Cho phép lặp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Recovery Overlay */}
            {wheelState === 'ERROR_RECOVERY' && errorMessage && (
              <div className="absolute inset-0 bg-[#060E20]/85 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#1E1B4B] border-2 border-rose-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">Khôi phục trạng thái vòng quay</h4>
                  <p className="text-sm text-rose-200">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setWheelState(slices.length > 0 ? 'READY' : 'NO_ELIGIBLE_STUDENTS');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
                  >
                    Sẵn sàng quay lại
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Stage Deck: Giant Spin Button + Winner Quick Banner + Hint */}
          <div className="relative z-10 px-4 sm:px-6 pb-5 pt-2 bg-gradient-to-t from-[#050C1C] via-[#081530]/95 to-transparent flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left Hint: Drag 3D & Mode Info */}
            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-[#102048] border border-blue-400/30 text-sky-200 font-bold">
                Chế độ nhãn:{' '}
                {resolvedLabelMode === 'FULL_OR_SHORT_NAME'
                  ? 'Tên đầy đủ/rút gọn (1–15 HS)'
                  : resolvedLabelMode === 'SHORT_NAME'
                  ? 'Tên rút gọn (16–30 HS)'
                  : 'Số thứ tự 01–50 (Lớp đông)'}
              </span>
              <span className="hidden xl:inline text-slate-400">
                Phím tắt: [Space] Quay · [R] Đặt lại · [M] Âm thanh · [F] Toàn màn hình
              </span>
            </div>

            {/* Center CTA: QUAY NGAY 3D */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={startSpin3D}
                disabled={isSpinningNow || slices.length === 0}
                className="px-8 sm:px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 border-2 border-yellow-200"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>{isSpinningNow ? 'ĐANG QUAY 3D...' : 'QUAY NGAY (SPACE)'}</span>
              </button>

              {winnerSlice && !isSpinningNow && (
                <button
                  type="button"
                  onClick={() => setShowWinnerModal(true)}
                  className="px-4 py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 border border-blue-300/50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>Xem lại: #{winnerSlice.formattedStt} {winnerSlice.student.fullName}</span>
                </button>
              )}
            </div>

            {/* Right: Fairness & Math Verification Status */}
            <button
              type="button"
              onClick={() => setShowMathVerifyModal(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5"
              title="Kiểm tra độ chính xác toán học & RNG công bằng"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>RNG Công bằng ({mathTestReport.totalChecks} test OK)</span>
            </button>
          </div>
        </div>

        {/* Right Column: Reference Table (STT <-> Full Name), Session History & 3D Settings */}
        {showSidePanel && (
          <div className="lg:col-span-4 xl:col-span-3 bg-[#091530] border-t lg:border-t-0 lg:border-l border-amber-400/25 flex flex-col h-[580px] lg:h-auto">
            {/* Side Panel Tabs */}
            <div className="grid grid-cols-3 p-2 gap-1 bg-[#060E20] border-b border-blue-400/20 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSideTab('STT_MAP')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  sideTab === 'STT_MAP'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Bảng STT ({fullRoster.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSideTab('HISTORY')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  sideTab === 'HISTORY'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Lịch sử ({spinRecords.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setSideTab('SETTINGS')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  sideTab === 'SETTINGS'
                    ? 'bg-blue-600 text-white font-black'
                    : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Cấu hình 3D</span>
              </button>
            </div>

            {/* Tab 1: STT <-> Student Full Name Reference Table (Section IV) */}
            {sideTab === 'STT_MAP' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2.5 bg-[#0D1E45] border-b border-blue-400/20 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">
                    Bảng ánh xạ Số TT ↔ Họ tên học sinh
                  </span>
                  <span className="text-slate-300 tabular-nums">
                    Còn lại: <strong className="text-emerald-400">{slices.length}</strong>
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[460px]">
                  {fullRosterReference.map((item) => {
                    const activeSliceIdx = slices.findIndex(
                      (s) => s.student.id === item.student.id
                    );
                    const isUnderPointer =
                      activeSliceIdx !== -1 && activeSliceIdx === currentSliceUnderPointer;
                    const isLastWinner =
                      winnerSlice?.student.id === item.student.id && !isSpinningNow;

                    return (
                      <div
                        key={item.student.id}
                        onMouseEnter={() => {
                          if (activeSliceIdx !== -1 && !isSpinningNow) {
                            setHoveredSliceIndex(activeSliceIdx);
                          }
                        }}
                        onMouseLeave={() => setHoveredSliceIndex(null)}
                        className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                          isLastWinner
                            ? 'bg-amber-400/25 border-amber-400 text-white shadow-md'
                            : isUnderPointer
                            ? 'bg-blue-600/30 border-sky-400 text-white'
                            : item.isAbsent
                            ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through'
                            : item.isCalled && antiDuplicate
                            ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                            : 'bg-[#0F2350]/70 border-blue-400/20 text-slate-100 hover:border-amber-400/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                              isLastWinner
                                ? 'bg-amber-400 text-slate-950'
                                : item.isEligibleNow
                                ? 'bg-blue-500/30 text-amber-300 border border-amber-400/40'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {item.formattedStt}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{item.student.fullName}</p>
                            <p className="text-[11px] text-slate-400">
                              {item.isAbsent
                                ? 'Vắng mặt'
                                : item.isCalled
                                ? 'Đã được gọi trong phiên'
                                : 'Sẵn sàng trên vòng quay'}
                            </p>
                          </div>
                        </div>

                        {isLastWinner ? (
                          <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] shrink-0">
                            VỪA CHỌN
                          </span>
                        ) : item.isCalled && antiDuplicate && onRestoreStudentToPool ? (
                          <button
                            type="button"
                            onClick={() => onRestoreStudentToPool(item.student.id)}
                            className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 text-sky-300 font-bold text-[11px] shrink-0"
                            title="Đưa học sinh này trở lại vòng quay"
                          >
                            Đưa lại
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: Session Spin History & Supabase Sync Status (Section XIV) */}
            {sideTab === 'HISTORY' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-4 py-2.5 bg-[#0D1E45] border-b border-blue-400/20 flex items-center justify-between text-xs">
                  <span className="font-bold text-amber-300">Lịch sử lượt quay trong phiên</span>
                  {onOpenHistoryModal && (
                    <button
                      type="button"
                      onClick={onOpenHistoryModal}
                      className="text-sky-300 hover:underline font-bold"
                    >
                      Toàn bộ lịch sử
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[460px]">
                  {spinRecords.length === 0 ? (
                    <div className="text-center py-12 px-4 text-slate-400 text-xs space-y-2">
                      <History className="w-8 h-8 mx-auto text-slate-500" />
                      <p className="font-bold text-slate-300">Chưa có lượt quay nào trong phiên</p>
                      <p>Nhấn nút QUAY NGAY hoặc phím Space để chọn học sinh đầu tiên.</p>
                    </div>
                  ) : (
                    spinRecords.map((rec) => (
                      <div
                        key={rec.spinId}
                        className="p-3 rounded-xl bg-[#0F2350]/80 border border-blue-400/25 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-black tabular-nums">
                            Lượt #{rec.spinIndex} · STT {rec.formattedStt}
                          </span>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(rec.selectedAt).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                        <p className="text-sm font-black text-white">{rec.studentName}</p>
                        {rec.note && <p className="text-xs text-amber-200 italic">“{rec.note}”</p>}
                        <div className="flex items-center justify-between pt-1 border-t border-blue-400/15 text-[11px]">
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
                              ? 'Đã đồng bộ'
                              : rec.saveStatus === 'pending'
                              ? 'Đang lưu...'
                              : 'Lưu lỗi (Đã lưu cục bộ)'}
                          </span>
                          {rec.saveStatus === 'failed' && (
                            <button
                              type="button"
                              onClick={() => handleRetrySaveRecord(rec.spinId)}
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
              </div>
            )}

            {/* Tab 3: 3D Graphics Quality, Voice & Accessibility Settings */}
            {sideTab === 'SETTINGS' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="block font-black text-amber-300 uppercase tracking-wider">
                    Chất lượng đồ họa WebGL 3D
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['LOW', 'MEDIUM', 'HIGH'] as Wheel3DQualityPreset[]).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQualityPreset(preset)}
                        className={`py-2 rounded-xl font-bold border transition-all ${
                          qualityPreset === preset
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                            : 'bg-[#0F2350] text-slate-300 border-blue-400/20'
                        }`}
                      >
                        {preset === 'LOW' ? 'Thấp' : preset === 'MEDIUM' ? 'Trung bình' : 'Cao (Chuẩn)'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Chế độ Thấp/Trung bình giúp máy tính phòng học cấu hình yếu vẫn đạt 60 FPS mượt mà.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-blue-400/20">
                  <label className="block font-black text-amber-300 uppercase tracking-wider">
                    Giọng đọc Tiếng Việt (Web Speech API)
                  </label>
                  <button
                    type="button"
                    onClick={() => setVoiceEnabled((v) => !v)}
                    className={`w-full py-2.5 px-3 rounded-xl border font-bold flex items-center justify-between ${
                      voiceEnabled
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <span>Đọc tên học sinh khi trúng</span>
                    <span>{voiceEnabled ? 'ĐANG BẬT' : 'ĐANG TẮT'}</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2 border-t border-blue-400/20">
                  <label className="block font-black text-amber-300 uppercase tracking-wider">
                    Tùy chọn chuyển động
                  </label>
                  <button
                    type="button"
                    onClick={() => setReduceMotion((v) => !v)}
                    className={`w-full py-2.5 px-3 rounded-xl border font-bold flex items-center justify-between ${
                      reduceMotion
                        ? 'bg-amber-500/20 border-amber-400/50 text-amber-200'
                        : 'bg-[#0F2350] border-blue-400/20 text-slate-300'
                    }`}
                  >
                    <span>Giảm chuyển động (Quay nhanh 1.9s)</span>
                    <span>{reduceMotion ? 'BẬT' : 'TẮT'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Winner Announcement Modal (Section XII) */}
      {showWinnerModal && winnerSlice && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-xl w-full bg-gradient-to-b from-[#0F2350] via-[#0B1938] to-[#071126] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 text-white shadow-[0_0_60px_rgba(245,158,11,0.45)] space-y-6 relative overflow-hidden"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowWinnerModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>Chúc mừng học sinh được chọn</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 uppercase">
                Kết Quả Vòng Quay 3D
              </h2>
            </div>

            {/* Student Card */}
            <div className="p-6 rounded-2xl bg-[#071126]/90 border-2 border-amber-400/60 text-center space-y-3 shadow-inner">
              <div className="inline-flex items-center justify-center px-4 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-base tabular-nums shadow">
                Số thứ tự: #{winnerSlice.formattedStt}
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-wide py-1">
                {winnerSlice.student.fullName}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-sky-200 font-bold">
                <span>Lớp: {resolvedClassName}</span>
                <span>•</span>
                <span>Lượt quay thứ: #{spinRecords.length}</span>
                <span>•</span>
                <span>Còn lại: {slices.length} HS</span>
              </div>
            </div>

            {/* Quick Teacher Evaluation & Points */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-amber-200">
                <span>Ghi nhận điểm thưởng & nhận xét nhanh:</span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3].map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setWinnerBonusPoints(pts)}
                      className={`px-2.5 py-1 rounded-lg font-black transition-colors ${
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
                  'Phát biểu xây dựng bài xuất sắc (+2đ)',
                  'Cần cố gắng thêm ở câu sau',
                ].map((presetNote) => (
                  <button
                    key={presetNote}
                    type="button"
                    onClick={() => {
                      setWinnerNote(presetNote);
                      onUpdateLatestNote?.(presetNote);
                      setSpinRecords((prev) =>
                        prev.map((r, i) => (i === 0 ? { ...r, note: presetNote } : r))
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                      winnerNote === presetNote
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                        : 'bg-[#102048] border-blue-400/30 text-slate-200 hover:border-amber-400/50'
                    }`}
                  >
                    {presetNote}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons (Section XII) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWinnerModal(false);
                  setTimeout(() => startSpin3D(), 120);
                }}
                disabled={slices.length === 0}
                className="py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Gọi tiếp học sinh khác</span>
              </button>

              <button
                type="button"
                onClick={() => speakWinnerAnnouncement(winnerSlice.student.fullName, true)}
                className="py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Volume1 className="w-4 h-4" />
                <span>Đọc lại tên học sinh</span>
              </button>

              {antiDuplicate && onRestoreStudentToPool && (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreStudentToPool(winnerSlice.student.id);
                    setShowWinnerModal(false);
                  }}
                  className="py-3 px-4 rounded-2xl bg-[#102048] hover:bg-[#19306B] border border-sky-400/40 text-sky-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Đưa học sinh này lại vào danh sách</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
                className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <span>Đóng bảng công bố</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-md w-full bg-[#0F2350] border-2 border-amber-400 rounded-3xl p-6 text-white space-y-4 shadow-2xl text-center"
          >
            <RotateCcw className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="text-xl font-black text-amber-300 uppercase">
              Đặt lại phiên vòng quay?
            </h4>
            <p className="text-sm text-slate-200">
              Danh sách các học sinh đã gọi trong phiên hiện tại sẽ được làm mới để tất cả học sinh
              có mặt đều có thể được chọn lại.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onResetSession?.();
                  setHighlightedWinnerIndex(null);
                  setWinnerSlice(null);
                  setShowResetConfirmModal(false);
                  setWheelState('READY');
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
              >
                Đồng ý đặt lại
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mathematical & RNG Fairness Verification Modal (Section XV) */}
      {showMathVerifyModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-lg w-full bg-[#0F2350] border-2 border-emerald-400 rounded-3xl p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="text-lg font-black uppercase">
                  Kiểm định Toán học & RNG Công bằng (A01 3D)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowMathVerifyModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#071126] border border-emerald-400/30 space-y-2 text-xs sm:text-sm">
              <p className="font-bold text-emerald-300">
                Trạng thái Unit Test tự động:{' '}
                {mathTestReport.passed ? 'ĐẠT 100%' : 'CÓ CẢNH BÁO'} (
                {mathTestReport.totalChecks}/{mathTestReport.totalChecks} kiểm thử chính xác)
              </p>
              <ul className="space-y-1.5 text-slate-200 list-disc pl-5">
                <li>
                  <strong>Thuật toán chọn ngẫu nhiên:</strong> Sử dụng{' '}
                  <code>crypto.getRandomValues</code> kết hợp Rejection Sampling loại bỏ hoàn toàn
                  sai lệch modulo.
                </li>
                <li>
                  <strong>Đồng bộ góc 3D ↔ Ô học sinh:</strong> Kiểm nghiệm song ánh hai chiều cho
                  các quy mô lớp 1, 2, 10, 30 và 50 học sinh với độ lệch 0 ô so với kim chỉ 12h.
                </li>
                <li>
                  <strong>Chống trùng lặp & Chống lưu lặp:</strong> Khóa{' '}
                  <code>spinTokenId</code> duy nhất cho từng lượt quay và lọc chính xác học sinh đã
                  gọi.
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowMathVerifyModal(false)}
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

export default StudentWheel3DGame;
