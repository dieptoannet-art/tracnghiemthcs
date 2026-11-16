import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  Claw3DState,
  ClawAnimationSubPhase,
  ClawControlMode,
  ClawSpeedMode,
  ClawQualityPreset,
  ClawCameraPreset,
  Claw3DCapsuleItem,
  Claw3DTurnPlan,
  CLAW_CHAMBER_BOUNDS,
  buildClaw3DCapsules,
  createFairClawTurnPlan,
  evaluateClawMechanicalTimeline,
  ClawTurnDeduplicator,
  runClawMachine3DUnitTests,
} from './clawMachine3dMath';
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
  Gamepad2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  UserCheck,
  Volume1,
  Eye,
} from 'lucide-react';

export interface ClawMachine3DGameProps {
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

export interface Claw3DTurnRecord {
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
  selectedAt: string;
  allowRepeat: boolean;
  saveStatus: 'saved' | 'pending' | 'failed';
  note?: string;
}

const LOCAL_CLAW_RECORDS_KEY_PREFIX = 'taydo_a02_claw3d_records_v2';

// Web Audio Arcade Sound Synthesizer
class Claw3DSoundEngine {
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

  public playServoMove(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.linearRampToValueAtTime(210, now + 0.18);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch {
      // Ignore
    }
  }

  public playClawClamp(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Ignore
    }
  }

  public playCapsuleDropBounce(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [320, 440].forEach((freq, i) => {
        const start = now + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(150, start + 0.11);
        gain.gain.setValueAtTime(0.15, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.13);
      });
    } catch {
      // Ignore
    }
  }

  public playCapsulePopAndFanfare(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      });
    } catch {
      // Ignore
    }
  }
}

/**
 * Create a crisp CanvasTexture badge for a 3D capsule showing STT ("01".."50") and short label.
 */
function createCapsuleBadgeTexture(
  formattedStt: string,
  shortLabel: string,
  accentHex: string,
  showShortName: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);

    // Rounded badge background
    ctx.fillStyle = 'rgba(7, 17, 38, 0.88)';
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(12, 12, 232, 104, 28);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = `bold ${showShortName ? 46 : 62}px "Times New Roman", Times, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`#${formattedStt}`, 128, showShortName ? 48 : 66);

    if (showShortName) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px "Times New Roman", Times, serif';
      ctx.fillText(shortLabel, 128, 88);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface Capsule3DMeshRecord {
  capsuleIndex: number;
  studentId: string;
  rootGroup: THREE.Group;
  topDomeGroup: THREE.Group;
  bottomDomeMesh: THREE.Mesh;
  coreGlowMesh: THREE.Mesh;
  coreGlowMat: THREE.MeshStandardMaterial;
  badgeSprite: THREE.Sprite;
  restX: number;
  restY: number;
  restZ: number;
}

export const ClawMachine3DGame: React.FC<ClawMachine3DGameProps> = ({
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
  const [clawState, setClawState] = useState<Claw3DState>('READY');
  const [subPhase, setSubPhase] = useState<ClawAnimationSubPhase>('IDLE');
  const [controlMode, setControlMode] = useState<ClawControlMode>('AUTO');
  const [speedMode, setSpeedMode] = useState<ClawSpeedMode>('NORMAL');
  const [qualityPreset, setQualityPreset] = useState<ClawQualityPreset>('HIGH');
  const [cameraPreset, setCameraPreset] = useState<ClawCameraPreset>('ISO_34');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [visualCapLimitMode, setVisualCapLimitMode] = useState<boolean>(false);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'presentation' | 'management'>('presentation');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [showRosterDrawer, setShowRosterDrawer] = useState<boolean>(false);

  // Search & UI Modals
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [showWinnerModal, setShowWinnerModal] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [winnerCapsule, setWinnerCapsule] = useState<Claw3DCapsuleItem | null>(null);
  const [winnerNote, setWinnerNote] = useState<string>('');
  const [winnerBonusPoints, setWinnerBonusPoints] = useState<number>(1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Session & Turn History
  const [sessionId] = useState<string>(() => `a02_sess_${Date.now().toString(36)}`);
  const [turnRecords, setTurnRecords] = useState<Claw3DTurnRecord[]>([]);

  // Refs for Three.js & Anti-Stall Animation
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const soundEngineRef = useRef<Claw3DSoundEngine>(new Claw3DSoundEngine());
  const deduplicatorRef = useRef<ClawTurnDeduplicator>(new ClawTurnDeduplicator());

  const activeTurnIdRef = useRef<string | null>(null);
  const activeTurnPlanRef = useRef<Claw3DTurnPlan | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const lastSoundSubPhaseRef = useRef<ClawAnimationSubPhase>('IDLE');
  const watchdogTimerRef = useRef<number | null>(null);

  // Live carriage coordinates (for Joystick mode & smooth transitions)
  const carriagePosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const joystickTiltRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });

  // Camera orbit & target lookAt refs
  const targetCamRef = useRef<{
    azimuth: number;
    elevation: number;
    distance: number;
    lookX: number;
    lookY: number;
    lookZ: number;
  }>({
    azimuth: 0.34,
    elevation: 0.16,
    distance: 7.45,
    lookX: 0,
    lookY: 0.15,
    lookZ: 0,
  });
  const currentCamRef = useRef<{
    azimuth: number;
    elevation: number;
    distance: number;
    lookX: number;
    lookY: number;
    lookZ: number;
  }>({
    azimuth: 0.34,
    elevation: 0.16,
    distance: 7.45,
    lookX: 0,
    lookY: 0.15,
    lookZ: 0,
  });
  const isDraggingCameraRef = useRef<boolean>(false);
  const prevPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Three.js scene references
  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    gantryBridgeGroup: THREE.Group;
    trolleyCarriageGroup: THREE.Group;
    cableMesh: THREE.Mesh;
    clawHeadGroup: THREE.Group;
    prongPivots: THREE.Group[];
    arcadeJoystickStickGroup: THREE.Group;
    marqueeBulbsInstanced: THREE.InstancedMesh;
    capsulesContainerGroup: THREE.Group;
    capsuleMeshes: Capsule3DMeshRecord[];
    traySpotlight: THREE.PointLight;
  } | null>(null);

  // Run automated unit tests once on mount
  const unitTestReport = useMemo(() => runClawMachine3DUnitTests(), []);

  // Build full roster & eligible capsules
  const fullRoster = useMemo(
    () => (allCandidates.length > 0 ? allCandidates : availableCandidates),
    [allCandidates, availableCandidates]
  );

  const allEligibleCapsules = useMemo(
    () => buildClaw3DCapsules(availableCandidates, fullRoster),
    [availableCandidates, fullRoster]
  );

  // Optional visual representation cap for 35+ students if enabled by teacher (Section IV)
  const displayedCapsules = useMemo(() => {
    if (!visualCapLimitMode || allEligibleCapsules.length <= 24) {
      return allEligibleCapsules;
    }
    const activeTargetId = activeTurnPlanRef.current?.selectedCapsule.student.id;
    const subset = allEligibleCapsules.slice(0, 24);
    if (activeTargetId && !subset.some((c) => c.student.id === activeTargetId)) {
      const targetCap = allEligibleCapsules.find((c) => c.student.id === activeTargetId);
      if (targetCap) {
        subset[subset.length - 1] = targetCap;
      }
    }
    return subset;
  }, [allEligibleCapsules, visualCapLimitMode]);

  // Filtered full roster for right-side search & STT reference panel
  const filteredRosterReference = useMemo(() => {
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

  // LocalStorage key for turn history
  const localRecordsKey = useMemo(
    () => `${LOCAL_CLAW_RECORDS_KEY_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`,
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
    (nextRecords: Claw3DTurnRecord[]) => {
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
      clawState === 'TARGET_SELECTED' ||
      clawState === 'MOVING' ||
      clawState === 'LOWERING' ||
      clawState === 'GRABBING' ||
      clawState === 'LIFTING' ||
      clawState === 'DROPPING' ||
      clawState === 'OPENING';

    if (isBusy) return;

    if (allEligibleCapsules.length === 0) {
      setClawState('FINISHED');
    } else if (clawState === 'FINISHED' || clawState === 'SETUP') {
      setClawState('READY');
    }
  }, [allEligibleCapsules.length, clawState]);

  // Update camera target preset (Section 2.2)
  const applyCameraPreset = useCallback((preset: ClawCameraPreset) => {
    setCameraPreset(preset);
    if (preset === 'FRONT') {
      targetCamRef.current = {
        azimuth: 0,
        elevation: 0.08,
        distance: 7.35,
        lookX: 0,
        lookY: 0.15,
        lookZ: 0,
      };
    } else if (preset === 'ISO_34') {
      targetCamRef.current = {
        azimuth: 0.36,
        elevation: 0.17,
        distance: 7.55,
        lookX: 0,
        lookY: 0.15,
        lookZ: 0,
      };
    } else if (preset === 'CLAW_CLOSEUP') {
      targetCamRef.current = {
        azimuth: 0.22,
        elevation: 0.24,
        distance: 4.5,
        lookX: carriagePosRef.current.x,
        lookY: 0.85,
        lookZ: carriagePosRef.current.z,
      };
    } else if (preset === 'DROP_CHUTE') {
      targetCamRef.current = {
        azimuth: -0.28,
        elevation: 0.18,
        distance: 4.8,
        lookX: CLAW_CHAMBER_BOUNDS.dropChuteX,
        lookY: -0.35,
        lookZ: CLAW_CHAMBER_BOUNDS.dropChuteZ,
      };
    } else if (preset === 'RESULT_TRAY') {
      targetCamRef.current = {
        azimuth: -0.18,
        elevation: 0.06,
        distance: 4.1,
        lookX: CLAW_CHAMBER_BOUNDS.dropChuteX,
        lookY: CLAW_CHAMBER_BOUNDS.trayLandingY + 0.15,
        lookZ: CLAW_CHAMBER_BOUNDS.dropChuteZ + 0.35,
      };
    }
  }, []);

  // Stop active Vietnamese speech synthesis
  const stopVietnameseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }, []);

  // Speak Vietnamese Winner Announcement (Section IX)
  const speakWinnerAnnouncement = useCallback(
    (studentFullName: string, forceSpeak = false) => {
      if ((isMuted || !voiceEnabled) && !forceSpeak) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const text = `Xin chúc mừng! Máy gắp may mắn đã chọn được bạn ${studentFullName}. Mời bạn tham gia hoạt động.`;
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
    async (record: Claw3DTurnRecord): Promise<'saved' | 'failed'> => {
      if (
        !isSupabaseConfigured ||
        !record.teacherId ||
        record.teacherId.startsWith('demo_') ||
        record.teacherId.startsWith('gsess_') ||
        record.teacherId.startsWith('guest_') ||
        record.classId === 'guest_mode' ||
        record.classId.startsWith('demo-')
      ) {
        return 'saved';
      }
      try {
        const { error } = await supabase.from('audit_logs').insert({
          actor_id: record.teacherId || null,
          actor_role: 'teacher',
          action: 'A02_CLAW_3D_PICK',
          entity_type: 'edu_game_session',
          entity_id: record.sessionId,
          metadata: {
            game_id: 'A02',
            game_version: 'EDU_3D_LUCKY_CLAW_2.0',
            turn_id: record.turnId,
            session_id: record.sessionId,
            class_id: record.classId,
            class_name: record.className,
            teacher_id: record.teacherId,
            student_id: record.studentId,
            student_name: record.studentName,
            stt_number: record.sttNumber,
            turn_index: record.turnIndex,
            selected_at: record.selectedAt,
            allow_repeat: record.allowRepeat,
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

  // Finalize turn deterministically (guarded by turnId so it runs once per turn)
  const finalizeClawTurn = useCallback(
    async (plan: Claw3DTurnPlan) => {
      if (activeTurnIdRef.current !== plan.turnId) return;
      if (!deduplicatorRef.current.markCompleted(plan.turnId)) return;

      activeTurnIdRef.current = null;
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }

      carriagePosRef.current = { x: 0, z: 0 };
      const chosenCapsule = plan.selectedCapsule;

      setWinnerCapsule(chosenCapsule);
      setWinnerNote('');
      setWinnerBonusPoints(1);
      setClawState('REVEALING');
      setSubPhase('RESULT_REVEAL');
      setShowWinnerModal(true);

      soundEngineRef.current.playCapsulePopAndFanfare(isMuted);
      speakWinnerAnnouncement(chosenCapsule.student.fullName);

      // Notify parent EDUGameCenter (updates session calledSessionIds & main history)
      onPick(chosenCapsule.student, {
        bonusPoints: 1,
        note: `Gắp trúng viên nang #${chosenCapsule.formattedStt} (Máy gắp 3D A02)`,
        sessionId,
        studentNumber: chosenCapsule.sttNumber,
      });

      setClawState('SAVING');
      const newRecord: Claw3DTurnRecord = {
        turnId: plan.turnId,
        turnIndex: turnRecords.length + 1,
        sessionId,
        classId: selectedSourceKey || resolvedClassName || 'class',
        className: resolvedClassName,
        teacherId,
        studentId: chosenCapsule.student.id,
        studentName: chosenCapsule.student.fullName,
        sttNumber: chosenCapsule.sttNumber,
        formattedStt: chosenCapsule.formattedStt,
        selectedAt: new Date().toISOString(),
        allowRepeat: !antiDuplicate,
        saveStatus: 'pending',
      };

      const nextList = [newRecord, ...turnRecords];
      persistLocalTurnRecords(nextList);

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

      setClawState('COMPLETED');
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

  // Start a Fair 3D Claw Turn (works from both AUTO button and JOYSTICK "HẠ MÓNG GẮP" button)
  const startClawGrabTurn = useCallback(() => {
    setErrorMessage(null);

    const isBusy =
      clawState === 'TARGET_SELECTED' ||
      clawState === 'MOVING' ||
      clawState === 'LOWERING' ||
      clawState === 'GRABBING' ||
      clawState === 'LIFTING' ||
      clawState === 'DROPPING' ||
      clawState === 'OPENING';

    if (isBusy) return;

    if (allEligibleCapsules.length === 0) {
      setClawState('FINISHED');
      return;
    }

    try {
      stopVietnameseSpeech();
      setShowWinnerModal(false);
      setWinnerCapsule(null);

      // Fair cryptographic selection over ALL eligible capsules (Section V)
      const plan = createFairClawTurnPlan({
        capsules: allEligibleCapsules,
        startCarriageX: carriagePosRef.current.x,
        startCarriageZ: carriagePosRef.current.z,
        speedMode,
      });

      activeTurnIdRef.current = plan.turnId;
      activeTurnPlanRef.current = plan;
      turnStartTimeRef.current = performance.now();
      lastSoundSubPhaseRef.current = 'TARGET_SELECTED';

      setClawState('TARGET_SELECTED');
      setSubPhase('TARGET_SELECTED');
      soundEngineRef.current.playServoMove(isMuted);

      // Watchdog anti-stall timer (Section XIII)
      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
      }
      watchdogTimerRef.current = window.setTimeout(() => {
        if (activeTurnIdRef.current === plan.turnId && activeTurnPlanRef.current) {
          finalizeClawTurn(activeTurnPlanRef.current);
        }
      }, plan.durationMs + 500);
    } catch (err) {
      activeTurnIdRef.current = null;
      activeTurnPlanRef.current = null;
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể khởi tạo lượt gắp 3D.'
      );
      setClawState('ERROR_RECOVERY');
    }
  }, [
    clawState,
    allEligibleCapsules,
    stopVietnameseSpeech,
    speedMode,
    isMuted,
    finalizeClawTurn,
  ]);

  // Manual Joystick Carriage Nudge (Section 6.2)
  const nudgeJoystickCarriage = useCallback(
    (dx: number, dz: number) => {
      const isBusy =
        clawState === 'TARGET_SELECTED' ||
        clawState === 'MOVING' ||
        clawState === 'LOWERING' ||
        clawState === 'GRABBING' ||
        clawState === 'LIFTING' ||
        clawState === 'DROPPING' ||
        clawState === 'OPENING';
      if (isBusy) return;

      carriagePosRef.current.x = Math.min(
        Math.max(carriagePosRef.current.x + dx, CLAW_CHAMBER_BOUNDS.minX),
        CLAW_CHAMBER_BOUNDS.maxX
      );
      carriagePosRef.current.z = Math.min(
        Math.max(carriagePosRef.current.z + dz, CLAW_CHAMBER_BOUNDS.minZ),
        CLAW_CHAMBER_BOUNDS.maxZ
      );
      joystickTiltRef.current = {
        x: Math.sign(dx) * 0.35,
        z: Math.sign(dz) * 0.35,
      };
      soundEngineRef.current.playServoMove(isMuted);
      window.setTimeout(() => {
        joystickTiltRef.current = { x: 0, z: 0 };
      }, 180);
    },
    [clawState, isMuted]
  );

  // Initialize Three.js WebGL 3D Arcade Machine Scene (Sections II, III, IV, XV)
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
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 580);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !softwareGl && qualityPreset === 'HIGH';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050D1E');
    scene.fog = new THREE.FogExp2('#050D1E', 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 800) / (container.clientHeight || 580),
      0.1,
      100
    );

    // Studio & Arcade Cabinet Lighting
    const ambientLight = new THREE.AmbientLight('#1E3A8A', 0.95);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 2.2);
    keyLight.position.set(5.5, 8.0, 7.5);
    if (!softwareGl && qualityPreset === 'HIGH') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(keyLight);

    const cyanFillLight = new THREE.DirectionalLight('#38BDF8', 1.35);
    cyanFillLight.position.set(-6.0, 4.0, 5.0);
    scene.add(cyanFillLight);

    const chamberCeilingLight = new THREE.PointLight('#E0F2FE', 2.6, 10);
    chamberCeilingLight.position.set(0, 2.2, 0);
    scene.add(chamberCeilingLight);

    const traySpotlight = new THREE.PointLight('#F59E0B', 2.5, 6);
    traySpotlight.position.set(
      CLAW_CHAMBER_BOUNDS.dropChuteX,
      CLAW_CHAMBER_BOUNDS.trayLandingY + 0.75,
      CLAW_CHAMBER_BOUNDS.dropChuteZ + 0.35
    );
    scene.add(traySpotlight);

    // Shared Materials (Section 2.1: Navy, Tech Blue, Cyan, Gold, Glass)
    const navyCabinetMat = new THREE.MeshStandardMaterial({
      color: '#0B1938',
      metalness: 0.78,
      roughness: 0.25,
    });
    const techBlueMat = new THREE.MeshStandardMaterial({
      color: '#1D4ED8',
      metalness: 0.65,
      roughness: 0.28,
    });
    const goldTrimMat = new THREE.MeshStandardMaterial({
      color: '#F59E0B',
      metalness: 0.88,
      roughness: 0.18,
    });
    const chromeSteelMat = new THREE.MeshStandardMaterial({
      color: '#E2E8F0',
      metalness: 0.92,
      roughness: 0.14,
    });
    const cyanNeonMat = new THREE.MeshStandardMaterial({
      color: '#38BDF8',
      emissive: '#0284C7',
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    const glassPanelMat = new THREE.MeshPhysicalMaterial({
      color: '#E0F2FE',
      transparent: true,
      opacity: 0.15,
      roughness: 0.08,
      metalness: 0.08,
      reflectivity: 0.6,
      depthWrite: false,
    });

    const machineRoot = new THREE.Group();
    machineRoot.position.set(0, 0.1, 0);
    scene.add(machineRoot);

    // =========================================================================
    // 1. LOWER CABINET BASE, DROP CHUTE & COLLECTION TRAY (Section 2.1)
    // =========================================================================
    // Main Lower Cabinet Body (with recessed cutout on front-left for the collection tray)
    const lowerBaseRightGeo = new THREE.BoxGeometry(3.1, 1.55, 3.0);
    const lowerBaseRight = new THREE.Mesh(lowerBaseRightGeo, navyCabinetMat);
    lowerBaseRight.position.set(0.75, -1.62, 0);
    machineRoot.add(lowerBaseRight);

    const lowerBaseLeftRearGeo = new THREE.BoxGeometry(1.5, 1.55, 1.9);
    const lowerBaseLeftRear = new THREE.Mesh(lowerBaseLeftRearGeo, navyCabinetMat);
    lowerBaseLeftRear.position.set(-1.55, -1.62, -0.55);
    machineRoot.add(lowerBaseLeftRear);

    // Collection Tray Floor & Walls (`Khay nhận kết quả` at front-left)
    const trayFloorGeo = new THREE.BoxGeometry(1.52, 0.18, 1.25);
    const trayFloorMesh = new THREE.Mesh(trayFloorGeo, techBlueMat);
    trayFloorMesh.position.set(-1.55, -2.28, 0.92);
    machineRoot.add(trayFloorMesh);

    const trayRimGeo = new THREE.BoxGeometry(1.56, 0.34, 0.12);
    const trayRimMesh = new THREE.Mesh(trayRimGeo, goldTrimMat);
    trayRimMesh.position.set(-1.55, -2.05, 1.52);
    machineRoot.add(trayRimMesh);

    // Stepped Arcade Pedestal Feet
    const footPlateGeo = new THREE.BoxGeometry(4.85, 0.24, 3.35);
    const footPlateMesh = new THREE.Mesh(footPlateGeo, goldTrimMat);
    footPlateMesh.position.set(0, -2.48, 0.08);
    machineRoot.add(footPlateMesh);

    // Front Arcade Control Deck (with 3D Joystick & Glowing Grab Button)
    const controlDeckGeo = new THREE.BoxGeometry(2.85, 0.28, 0.72);
    const controlDeckMesh = new THREE.Mesh(controlDeckGeo, techBlueMat);
    controlDeckMesh.position.set(0.78, -1.02, 1.65);
    controlDeckMesh.rotation.x = 0.22;
    machineRoot.add(controlDeckMesh);

    // 3D Arcade Joystick on the Control Deck
    const arcadeJoystickStickGroup = new THREE.Group();
    arcadeJoystickStickGroup.position.set(0.25, -0.84, 1.68);
    machineRoot.add(arcadeJoystickStickGroup);

    const stickShaftGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.28, 12);
    const stickShaft = new THREE.Mesh(stickShaftGeo, chromeSteelMat);
    stickShaft.position.set(0, 0.14, 0);
    arcadeJoystickStickGroup.add(stickShaft);

    const stickBallGeo = new THREE.SphereGeometry(0.11, 18, 18);
    const stickBallMat = new THREE.MeshStandardMaterial({
      color: '#E11D48',
      emissive: '#9F1239',
      emissiveIntensity: 0.4,
      roughness: 0.15,
    });
    const stickBall = new THREE.Mesh(stickBallGeo, stickBallMat);
    stickBall.position.set(0, 0.3, 0);
    arcadeJoystickStickGroup.add(stickBall);

    // 3D Pushbutton on the Control Deck
    const deckBtnGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.08, 20);
    const deckBtnMat = new THREE.MeshStandardMaterial({
      color: '#FEF08A',
      emissive: '#F59E0B',
      emissiveIntensity: 1.2,
    });
    const deckBtn = new THREE.Mesh(deckBtnGeo, deckBtnMat);
    deckBtn.position.set(1.15, -0.85, 1.68);
    deckBtn.rotation.x = 0.22;
    machineRoot.add(deckBtn);

    // =========================================================================
    // 2. CHAMBER FLOOR, DROP CHUTE OPENING & TRANSPARENT GLASS WALLS
    // =========================================================================
    // Chamber Floor leaving front-left chute opening (`x in [-2.1, -1.0], z in [0.25, 1.25]`)
    const floorMainRightGeo = new THREE.BoxGeometry(3.2, 0.12, 2.84);
    const floorMainRight = new THREE.Mesh(floorMainRightGeo, navyCabinetMat);
    floorMainRight.position.set(0.68, CLAW_CHAMBER_BOUNDS.floorY - 0.06, 0);
    floorMainRight.receiveShadow = true;
    machineRoot.add(floorMainRight);

    const floorLeftBackGeo = new THREE.BoxGeometry(1.4, 0.12, 1.72);
    const floorLeftBack = new THREE.Mesh(floorLeftBackGeo, navyCabinetMat);
    floorLeftBack.position.set(-1.58, CLAW_CHAMBER_BOUNDS.floorY - 0.06, -0.56);
    floorLeftBack.receiveShadow = true;
    machineRoot.add(floorLeftBack);

    // Glowing Chute Guard Fence around Front-Left Drop Chute
    const chuteFenceXGeo = new THREE.BoxGeometry(1.15, 0.36, 0.08);
    const chuteFenceX = new THREE.Mesh(chuteFenceXGeo, cyanNeonMat);
    chuteFenceX.position.set(-1.52, CLAW_CHAMBER_BOUNDS.floorY + 0.16, 0.24);
    machineRoot.add(chuteFenceX);

    const chuteFenceZGeo = new THREE.BoxGeometry(0.08, 0.36, 1.05);
    const chuteFenceZ = new THREE.Mesh(chuteFenceZGeo, cyanNeonMat);
    chuteFenceZ.position.set(-0.96, CLAW_CHAMBER_BOUNDS.floorY + 0.16, 0.74);
    machineRoot.add(chuteFenceZ);

    // 4 Corner Metallic Pillars & Neon Vertical Strips
    const pillarGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.35, 18);
    const pillarCoords: Array<[number, number]> = [
      [-2.24, -1.38],
      [2.24, -1.38],
      [-2.24, 1.38],
      [2.24, 1.38],
    ];
    pillarCoords.forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(pillarGeo, goldTrimMat);
      pillar.position.set(px, 0.82, pz);
      machineRoot.add(pillar);
    });

    // Transparent Glass Panels (Front, Left, Right, Back)
    const frontGlassGeo = new THREE.PlaneGeometry(4.32, 3.22);
    const frontGlass = new THREE.Mesh(frontGlassGeo, glassPanelMat);
    frontGlass.position.set(0, 0.82, 1.38);
    machineRoot.add(frontGlass);

    const backPanelGeo = new THREE.PlaneGeometry(4.42, 3.28);
    const backPanelMat = new THREE.MeshStandardMaterial({
      color: '#091530',
      metalness: 0.5,
      roughness: 0.4,
    });
    const backPanel = new THREE.Mesh(backPanelGeo, backPanelMat);
    backPanel.position.set(0, 0.82, -1.4);
    machineRoot.add(backPanel);

    const sideGlassGeo = new THREE.PlaneGeometry(2.72, 3.22);
    const leftGlass = new THREE.Mesh(sideGlassGeo, glassPanelMat);
    leftGlass.rotation.y = Math.PI / 2;
    leftGlass.position.set(-2.24, 0.82, 0);
    machineRoot.add(leftGlass);

    const rightGlass = new THREE.Mesh(sideGlassGeo, glassPanelMat);
    rightGlass.rotation.y = -Math.PI / 2;
    rightGlass.position.set(2.24, 0.82, 0);
    machineRoot.add(rightGlass);

    // =========================================================================
    // 3. TOP ILLUMINATED MARQUEE CANOPY (`Hộp đèn phía trên`)
    // =========================================================================
    const canopyGeo = new THREE.BoxGeometry(4.72, 0.52, 3.02);
    const canopyMesh = new THREE.Mesh(canopyGeo, techBlueMat);
    canopyMesh.position.set(0, 2.68, 0);
    machineRoot.add(canopyMesh);

    const canopyRimGeo = new THREE.BoxGeometry(4.82, 0.12, 3.12);
    const canopyRimBottom = new THREE.Mesh(canopyRimGeo, goldTrimMat);
    canopyRimBottom.position.set(0, 2.42, 0);
    machineRoot.add(canopyRimBottom);

    const canopyRimTop = new THREE.Mesh(canopyRimGeo, goldTrimMat);
    canopyRimTop.position.set(0, 2.95, 0);
    machineRoot.add(canopyRimTop);

    // 20 Chasing Marquee LED Bulbs across the front canopy
    const bulbCount = 20;
    const bulbGeo = new THREE.SphereGeometry(0.065, 12, 12);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: '#FEF08A',
      emissive: '#F59E0B',
      emissiveIntensity: 1.6,
    });
    const marqueeBulbsInstanced = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbCount);
    const bulbDummy = new THREE.Object3D();
    for (let i = 0; i < bulbCount; i++) {
      const bx = -2.15 + (i / (bulbCount - 1)) * 4.3;
      bulbDummy.position.set(bx, 2.68, 1.54);
      bulbDummy.updateMatrix();
      marqueeBulbsInstanced.setMatrixAt(i, bulbDummy.matrix);
    }
    marqueeBulbsInstanced.instanceMatrix.needsUpdate = true;
    machineRoot.add(marqueeBulbsInstanced);

    // =========================================================================
    // 4. TRUE 3-PRONG MECHANICAL CLAW ASSEMBLY (Section III)
    // =========================================================================
    // Fixed Side Guide Rails along Z axis near ceiling
    const zSideRailGeo = new THREE.CylinderGeometry(0.045, 0.045, 2.65, 12);
    zSideRailGeo.rotateX(Math.PI / 2);
    const leftZRail = new THREE.Mesh(zSideRailGeo, chromeSteelMat);
    leftZRail.position.set(-2.05, CLAW_CHAMBER_BOUNDS.railY, 0);
    machineRoot.add(leftZRail);

    const rightZRail = new THREE.Mesh(zSideRailGeo, chromeSteelMat);
    rightZRail.position.set(2.05, CLAW_CHAMBER_BOUNDS.railY, 0);
    machineRoot.add(rightZRail);

    // Gantry Bridge Group (`Thanh ray ngang` — moves along Z axis)
    const gantryBridgeGroup = new THREE.Group();
    gantryBridgeGroup.position.set(0, CLAW_CHAMBER_BOUNDS.railY, 0);
    machineRoot.add(gantryBridgeGroup);

    const xBridgeRailGeo = new THREE.CylinderGeometry(0.055, 0.055, 4.15, 16);
    xBridgeRailGeo.rotateZ(Math.PI / 2);
    const xBridgeRail = new THREE.Mesh(xBridgeRailGeo, chromeSteelMat);
    gantryBridgeGroup.add(xBridgeRail);

    // Trolley Carriage & Winch Motor (`Xe trượt + Động cơ` — moves along X axis on Gantry Bridge)
    const trolleyCarriageGroup = new THREE.Group();
    trolleyCarriageGroup.position.set(0, CLAW_CHAMBER_BOUNDS.railY, 0);
    machineRoot.add(trolleyCarriageGroup);

    const carriageBoxGeo = new THREE.BoxGeometry(0.48, 0.24, 0.38);
    const carriageBox = new THREE.Mesh(carriageBoxGeo, goldTrimMat);
    trolleyCarriageGroup.add(carriageBox);

    const motorDrumGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.34, 18);
    motorDrumGeo.rotateZ(Math.PI / 2);
    const motorDrum = new THREE.Mesh(motorDrumGeo, techBlueMat);
    motorDrum.position.set(0, -0.1, 0);
    trolleyCarriageGroup.add(motorDrum);

    // Dynamic Steel Cable (`Dây cáp thay đổi chiều dài`)
    const cableGeo = new THREE.CylinderGeometry(0.024, 0.024, 1.0, 10);
    const cableMesh = new THREE.Mesh(cableGeo, chromeSteelMat);
    machineRoot.add(cableMesh);

    // Claw Head Hub (`Cụm đầu gắp` + `Trục nâng hạ`)
    const clawHeadGroup = new THREE.Group();
    clawHeadGroup.position.set(0, CLAW_CHAMBER_BOUNDS.restClawHeadY, 0);
    machineRoot.add(clawHeadGroup);

    const pistonRodGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.24, 16);
    const pistonRod = new THREE.Mesh(pistonRodGeo, chromeSteelMat);
    pistonRod.position.set(0, 0.16, 0);
    clawHeadGroup.add(pistonRod);

    const hubCylinderGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.22, 24);
    const hubCylinder = new THREE.Mesh(hubCylinderGeo, techBlueMat);
    clawHeadGroup.add(hubCylinder);

    const hubNeonRingGeo = new THREE.TorusGeometry(0.26, 0.032, 12, 24);
    hubNeonRingGeo.rotateX(Math.PI / 2);
    const hubNeonRing = new THREE.Mesh(hubNeonRingGeo, cyanNeonMat);
    hubNeonRing.position.set(0, 0.02, 0);
    clawHeadGroup.add(hubNeonRing);

    // Three Articulated Mechanical Prongs (`Ba chấu cơ khí có khớp xoay riêng`)
    const prongPivots: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const yawAngle = (i * Math.PI * 2) / 3;
      const mountGroup = new THREE.Group();
      mountGroup.rotation.y = yawAngle;
      clawHeadGroup.add(mountGroup);

      // Pivot joint located at outer rim of the claw hub (`x = 0.22, y = -0.08`)
      const pivotGroup = new THREE.Group();
      pivotGroup.position.set(0.22, -0.08, 0);
      pivotGroup.rotation.z = 0.22; // Dynamic opening/closing angle!
      mountGroup.add(pivotGroup);

      // Knuckle Hinge Sphere
      const hingeGeo = new THREE.SphereGeometry(0.055, 12, 12);
      const hingeMesh = new THREE.Mesh(hingeGeo, goldTrimMat);
      pivotGroup.add(hingeMesh);

      // Upper Arm Strut (extends outward and downward)
      const upperArmGeo = new THREE.CylinderGeometry(0.032, 0.028, 0.34, 12);
      const upperArmMesh = new THREE.Mesh(upperArmGeo, chromeSteelMat);
      upperArmMesh.position.set(0.09, -0.15, 0);
      upperArmMesh.rotation.z = 0.48;
      pivotGroup.add(upperArmMesh);

      // Middle Elbow Joint
      const elbowGeo = new THREE.SphereGeometry(0.048, 12, 12);
      const elbowMesh = new THREE.Mesh(elbowGeo, goldTrimMat);
      elbowMesh.position.set(0.17, -0.3, 0);
      pivotGroup.add(elbowMesh);

      // Lower Curved Finger Blade (hooks inward toward the capsule center)
      const lowerFingerGeo = new THREE.CylinderGeometry(0.026, 0.018, 0.34, 12);
      const lowerFingerMesh = new THREE.Mesh(lowerFingerGeo, chromeSteelMat);
      lowerFingerMesh.position.set(0.08, -0.44, 0);
      lowerFingerMesh.rotation.z = -0.55;
      pivotGroup.add(lowerFingerMesh);

      // Inner Rubberized Gold Grip Tip
      const gripTipGeo = new THREE.SphereGeometry(0.042, 12, 12);
      const gripTipMesh = new THREE.Mesh(gripTipGeo, goldTrimMat);
      gripTipMesh.position.set(-0.01, -0.57, 0);
      pivotGroup.add(gripTipMesh);

      prongPivots.push(pivotGroup);
    }

    // =========================================================================
    // 5. CAPSULES CONTAINER GROUP
    // =========================================================================
    const capsulesContainerGroup = new THREE.Group();
    machineRoot.add(capsulesContainerGroup);

    threeSceneRef.current = {
      renderer,
      scene,
      camera,
      gantryBridgeGroup,
      trolleyCarriageGroup,
      cableMesh,
      clawHeadGroup,
      prongPivots,
      arcadeJoystickStickGroup,
      marqueeBulbsInstanced,
      capsulesContainerGroup,
      capsuleMeshes: [],
      traySpotlight,
    };

    const handleResize = () => {
      if (!mountContainerRef.current || !threeSceneRef.current) return;
      const w = mountContainerRef.current.clientWidth || 800;
      const h = mountContainerRef.current.clientHeight || 580;
      threeSceneRef.current.camera.aspect = w / h;
      threeSceneRef.current.camera.updateProjectionMatrix();
      threeSceneRef.current.renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Master Animation Loop
    let rafId = 0;
    let afterDrawTime = performance.now();
    const minFrameGapMs = softwareGl ? 33 : 0;
    const tempBulbColor = new THREE.Color();

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const now = performance.now();
      if (now - afterDrawTime < minFrameGapMs) return;

      const refs = threeSceneRef.current;
      if (!refs) return;

      const activePlan = activeTurnPlanRef.current;
      const activeTurnId = activeTurnIdRef.current;

      let carriageX = carriagePosRef.current.x;
      let carriageZ = carriagePosRef.current.z;
      let clawHeadY = CLAW_CHAMBER_BOUNDS.restClawHeadY;
      let cableLength = CLAW_CHAMBER_BOUNDS.railY - clawHeadY;
      let prongAngle = 0.22;

      if (activePlan && activeTurnId === activePlan.turnId) {
        const elapsedMs = now - turnStartTimeRef.current;
        const normT = Math.min(Math.max(elapsedMs / activePlan.durationMs, 0), 1);
        const frame = evaluateClawMechanicalTimeline(activePlan, normT);

        carriageX = frame.carriageX;
        carriageZ = frame.carriageZ;
        carriagePosRef.current = { x: carriageX, z: carriageZ };
        clawHeadY = frame.clawHeadY;
        cableLength = frame.cableLength;
        prongAngle = frame.prongOpenAngleRad;

        // Play mechanical sound effects on sub-phase transitions
        if (frame.subPhase !== lastSoundSubPhaseRef.current) {
          lastSoundSubPhaseRef.current = frame.subPhase;
          if (
            frame.subPhase === 'MOVING_TO_TARGET' ||
            frame.subPhase === 'LIFTING' ||
            frame.subPhase === 'MOVING_TO_DROP'
          ) {
            soundEngineRef.current.playServoMove(isMuted);
          } else if (frame.subPhase === 'CLAW_CLOSING') {
            soundEngineRef.current.playClawClamp(isMuted);
          } else if (frame.subPhase === 'CAPSULE_FALLING') {
            soundEngineRef.current.playCapsuleDropBounce(isMuted);
          }
        }

        // Update Target Capsule 3D Transform & Two-Hemisphere Split Opening
        const targetMeshRec = refs.capsuleMeshes.find(
          (m) => m.studentId === activePlan.selectedCapsule.student.id
        );
        if (targetMeshRec) {
          targetMeshRec.rootGroup.position.set(frame.capsuleX, frame.capsuleY, frame.capsuleZ);
          targetMeshRec.topDomeGroup.position.y = frame.capsuleSplitDistance;
          targetMeshRec.topDomeGroup.rotation.x = -frame.capsuleSplitTiltRad;
          targetMeshRec.coreGlowMat.emissiveIntensity = frame.capsuleGlowIntensity * 3.2;
          targetMeshRec.coreGlowMesh.scale.setScalar(0.6 + frame.capsuleGlowIntensity * 0.85);
        }

        setClawState((prev) =>
          prev !== frame.stateMachinePhase ? frame.stateMachinePhase : prev
        );
        setSubPhase((prev) => (prev !== frame.subPhase ? frame.subPhase : prev));

        if (frame.shouldTriggerReveal) {
          finalizeClawTurn(activePlan);
        }
      }

      // Apply Mechanical Transforms to Gantry, Trolley, Cable, Claw Head & 3 Prongs
      refs.gantryBridgeGroup.position.z = carriageZ;
      refs.trolleyCarriageGroup.position.set(carriageX, CLAW_CHAMBER_BOUNDS.railY, carriageZ);

      refs.cableMesh.scale.set(1, cableLength, 1);
      refs.cableMesh.position.set(
        carriageX,
        CLAW_CHAMBER_BOUNDS.railY - cableLength / 2,
        carriageZ
      );

      refs.clawHeadGroup.position.set(carriageX, clawHeadY, carriageZ);
      refs.prongPivots.forEach((pivot) => {
        pivot.rotation.z = prongAngle;
      });

      // Animate 3D Arcade Joystick Stick on the Control Deck
      refs.arcadeJoystickStickGroup.rotation.z = -joystickTiltRef.current.x;
      refs.arcadeJoystickStickGroup.rotation.x = joystickTiltRef.current.z;

      // Animate Chasing Marquee Bulbs
      const bulbSpeed = activePlan ? 12 : 3.5;
      for (let i = 0; i < bulbCount; i++) {
        const wave = 0.5 + 0.5 * Math.sin(now * 0.001 * bulbSpeed - i * 0.45);
        tempBulbColor.setHSL(0.12 + wave * 0.06, 0.95, 0.45 + wave * 0.4);
        refs.marqueeBulbsInstanced.setColorAt(i, tempBulbColor);
      }
      if (refs.marqueeBulbsInstanced.instanceColor) {
        refs.marqueeBulbsInstanced.instanceColor.needsUpdate = true;
      }

      // If camera is in CLAW_CLOSEUP preset, smoothly follow the claw head
      if (cameraPreset === 'CLAW_CLOSEUP') {
        targetCamRef.current.lookX = carriageX;
        targetCamRef.current.lookY = clawHeadY - 0.25;
        targetCamRef.current.lookZ = carriageZ;
      }

      // Smooth Camera Orbit Interpolation
      const cur = currentCamRef.current;
      const tgt = targetCamRef.current;
      cur.azimuth += (tgt.azimuth - cur.azimuth) * 0.1;
      cur.elevation += (tgt.elevation - cur.elevation) * 0.1;
      cur.distance += (tgt.distance - cur.distance) * 0.1;
      cur.lookX += (tgt.lookX - cur.lookX) * 0.12;
      cur.lookY += (tgt.lookY - cur.lookY) * 0.12;
      cur.lookZ += (tgt.lookZ - cur.lookZ) * 0.12;

      const camX =
        cur.lookX + cur.distance * Math.sin(cur.azimuth) * Math.cos(cur.elevation);
      const camY = cur.lookY + cur.distance * Math.sin(cur.elevation);
      const camZ =
        cur.lookZ + cur.distance * Math.cos(cur.azimuth) * Math.cos(cur.elevation);

      refs.camera.position.set(camX, camY, camZ);
      refs.camera.lookAt(cur.lookX, cur.lookY, cur.lookZ);

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
  }, [qualityPreset]);

  // Rebuild 3D Student Capsules inside the Glass Chamber whenever displayedCapsules change (Section IV)
  useEffect(() => {
    const refs = threeSceneRef.current;
    if (!refs) return;

    // Dispose previous capsule meshes & badge textures cleanly
    refs.capsuleMeshes.forEach((rec) => {
      refs.capsulesContainerGroup.remove(rec.rootGroup);
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
        }
      });
    });
    refs.capsuleMeshes = [];

    const count = displayedCapsules.length;
    if (count === 0) return;

    const showShortNameOnBadge = count <= 20;
    const sphereSegs = qualityPreset === 'LOW' ? 14 : 22;

    const newMeshRecords: Capsule3DMeshRecord[] = displayedCapsules.map((item) => {
      const r = item.radius;
      const rootGroup = new THREE.Group();
      rootGroup.position.set(item.restX, item.restY, item.restZ);

      // Bottom Colored Metallic Hemisphere
      const bottomGeo = new THREE.SphereGeometry(
        r,
        sphereSegs,
        Math.max(8, Math.floor(sphereSegs / 2)),
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2
      );
      const bottomMat = new THREE.MeshStandardMaterial({
        color: item.colorHex,
        metalness: 0.45,
        roughness: 0.22,
      });
      const bottomDomeMesh = new THREE.Mesh(bottomGeo, bottomMat);
      rootGroup.add(bottomDomeMesh);

      // Equatorial Gold Seam Ring
      const seamGeo = new THREE.TorusGeometry(r * 1.01, r * 0.055, 10, sphereSegs);
      seamGeo.rotateX(Math.PI / 2);
      const seamMat = new THREE.MeshStandardMaterial({
        color: item.accentHex,
        metalness: 0.85,
        roughness: 0.2,
      });
      const seamMesh = new THREE.Mesh(seamGeo, seamMat);
      rootGroup.add(seamMesh);

      // Top Translucent Dome Hemisphere (mounted in topDomeGroup so it can hinge & lift open!)
      const topDomeGroup = new THREE.Group();
      const topGeo = new THREE.SphereGeometry(
        r,
        sphereSegs,
        Math.max(8, Math.floor(sphereSegs / 2)),
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
      );
      const topMat = new THREE.MeshStandardMaterial({
        color: item.topDomeHex,
        transparent: true,
        opacity: 0.78,
        metalness: 0.2,
        roughness: 0.15,
      });
      const topDomeMesh = new THREE.Mesh(topGeo, topMat);
      topDomeGroup.add(topDomeMesh);
      rootGroup.add(topDomeGroup);

      // Inner Golden Light Core (illuminates when capsule splits open in the tray)
      const coreGeo = new THREE.SphereGeometry(r * 0.48, 12, 12);
      const coreGlowMat = new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: '#F59E0B',
        emissiveIntensity: 0.2,
      });
      const coreGlowMesh = new THREE.Mesh(coreGeo, coreGlowMat);
      rootGroup.add(coreGlowMesh);

      // Crisp STT Badge Sprite facing the camera above/in front of the capsule
      const badgeTex = createCapsuleBadgeTexture(
        item.formattedStt,
        item.shortLabel,
        item.accentHex,
        showShortNameOnBadge
      );
      const badgeMat = new THREE.SpriteMaterial({
        map: badgeTex,
        transparent: true,
        depthTest: false,
      });
      const badgeSprite = new THREE.Sprite(badgeMat);
      badgeSprite.position.set(0, r * 0.35, r * 0.85);
      badgeSprite.scale.set(r * 2.1, r * 1.05, 1);
      rootGroup.add(badgeSprite);

      refs.capsulesContainerGroup.add(rootGroup);

      return {
        capsuleIndex: item.capsuleIndex,
        studentId: item.student.id,
        rootGroup,
        topDomeGroup,
        bottomDomeMesh,
        coreGlowMesh,
        coreGlowMat,
        badgeSprite,
        restX: item.restX,
        restY: item.restY,
        restZ: item.restZ,
      };
    });

    refs.capsuleMeshes = newMeshRecords;
  }, [displayedCapsules, qualityPreset]);

  // Keyboard Controls: Space = Grab, Arrow/WASD = Joystick Move, R = Reset, M = Mute, F = Fullscreen
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
        startClawGrabTurn();
      } else if (controlMode === 'JOYSTICK') {
        const step = 0.24;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          nudgeJoystickCarriage(-step, 0);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          nudgeJoystickCarriage(step, 0);
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          nudgeJoystickCarriage(0, -step);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          nudgeJoystickCarriage(0, step);
        }
      }

      if (e.key === 'r' || e.key === 'R') {
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
  }, [
    startClawGrabTurn,
    controlMode,
    nudgeJoystickCarriage,
    onToggleMute,
    onToggleFullscreen,
  ]);

  // Interactive Pointer Drag for 3D Camera Orbit
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingCameraRef.current = true;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCameraRef.current) return;
    const dx = e.clientX - prevPointerRef.current.x;
    const dy = e.clientY - prevPointerRef.current.y;
    prevPointerRef.current = { x: e.clientX, y: e.clientY };

    targetCamRef.current.azimuth = Math.min(
      Math.max(targetCamRef.current.azimuth - dx * 0.0055, -0.85),
      0.85
    );
    targetCamRef.current.elevation = Math.min(
      Math.max(targetCamRef.current.elevation + dy * 0.0045, -0.15),
      0.55
    );
  };

  const handleStagePointerUp = () => {
    isDraggingCameraRef.current = false;
  };

  const isGrabbingNow =
    clawState === 'TARGET_SELECTED' ||
    clawState === 'MOVING' ||
    clawState === 'LOWERING' ||
    clawState === 'GRABBING' ||
    clawState === 'LIFTING' ||
    clawState === 'DROPPING' ||
    clawState === 'OPENING';

  const subPhaseLabelMap: Record<ClawAnimationSubPhase, string> = {
    IDLE: 'MÓNG GẮP SẴN SÀNG',
    TARGET_SELECTED: 'ĐÃ CHỐT RNG CÔNG BẰNG',
    MOVING_TO_TARGET: 'XE TRƯỢT DI CHUYỂN TỚI VIÊN NANG',
    LOWERING: 'DÂY CÁP ĐANG HẠ MÓNG',
    CLAW_OPENING: 'BA CHẤU MỞ RỘNG',
    CLAW_CLOSING: 'BA CHẤU KHÉP KẸP VIÊN NANG',
    CAPSULE_ATTACHED: 'GIỮ CHẶT VIÊN NANG MỤC TIÊU',
    LIFTING: 'THU DÂY CÁP NÂNG VIÊN NANG',
    MOVING_TO_DROP: 'ĐƯA VIÊN NANG VỀ CỬA THẢ',
    RELEASING: 'MỞ CHẤU THẢ VIÊN NANG',
    CAPSULE_FALLING: 'VIÊN NANG RƠI XUỐNG KHAY NHẬN',
    CAPSULE_OPENING: 'MỞ TÁCH HAI NỬA VIÊN NANG',
    RESULT_REVEAL: 'CÔNG BỐ HỌC SINH MAY MẮN',
    RESETTING: 'MÓNG TRỞ VỀ VỊ TRÍ CHỜ',
    COMPLETED: 'HOÀN TẤT LƯỢT GẮP',
  };

  return (
    <div
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      className="w-full bg-gradient-to-b from-[#050C1C] via-[#091736] to-[#060E22] text-white rounded-3xl border-2 border-cyan-400/50 shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Top Arcade Studio Bar */}
      <div className="px-4 sm:px-6 py-3 bg-[#081530] border-b border-cyan-400/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 flex items-center justify-center font-black text-base shadow-md">
            A02
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-wide text-amber-300 uppercase">
                Máy Gắp Học Sinh May Mắn 3D · Lucky Claw 2.0
              </h3>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-bold text-cyan-200">
                3-Prong WebGL 3D
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Lớp: <strong className="text-white">{resolvedClassName}</strong> · Sẵn sàng:{' '}
              <strong className="text-emerald-400 tabular-nums">
                {allEligibleCapsules.length}
              </strong>
              /<span className="tabular-nums">{fullRoster.length}</span> HS · Đã gọi:{' '}
              <strong className="text-amber-300 tabular-nums">{calledSessionIds.size}</strong>
            </p>
          </div>
        </div>

        {/* Top Right Quick Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle: Presentation (Trình chiếu) vs Management (Quản lý) */}
          <div className="flex items-center bg-[#0D1E45] border border-cyan-400/30 rounded-xl p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode('presentation')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                viewMode === 'presentation'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Trình chiếu</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('management')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                viewMode === 'management'
                  ? 'bg-cyan-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Quản lý</span>
            </button>
          </div>

          {/* Control Mode Toggle: AUTO vs JOYSTICK (Section VI) */}
          <div className="flex items-center bg-[#0D1E45] border border-cyan-400/30 rounded-xl p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setControlMode('AUTO')}
              className={`px-3 py-1 rounded-lg transition-colors ${
                controlMode === 'AUTO'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Tự động
            </button>
            <button
              type="button"
              onClick={() => setControlMode('JOYSTICK')}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                controlMode === 'JOYSTICK'
                  ? 'bg-cyan-400 text-slate-950 font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>Joystick</span>
            </button>
          </div>

          {/* Anti-repeat button */}
          <button
            type="button"
            onClick={onToggleAntiDuplicate}
            disabled={isGrabbingNow}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              antiDuplicate
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>{antiDuplicate ? 'Không lặp: BẬT' : 'Cho phép lặp'}</span>
          </button>

          {/* Reset Session */}
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            disabled={isGrabbingNow}
            className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-bold text-rose-200 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại phiên</span>
          </button>

          {/* Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-2 rounded-xl bg-[#0D1E45] hover:bg-[#162C63] border border-cyan-400/30 text-amber-300"
            title="Bật/tắt âm thanh (Phím M)"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Fullscreen */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-2 rounded-xl bg-[#0D1E45] hover:bg-[#162C63] border border-cyan-400/30 text-cyan-300"
              title="Toàn màn hình (Phím F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Main Layout: Presentation Mode (Expanded 3D Stage + Floating Drawers) vs Management Mode (3-Column Layout) */}
      {viewMode === 'presentation' ? (
        <div className="relative flex-1 flex flex-col min-h-[620px]">
          {/* Floating Top-Left & Top-Right Drawer Toggle Buttons for Presentation Mode */}
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-[#0B1938]/90 hover:bg-[#0F2350] border border-cyan-400/50 text-amber-300 text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md"
            >
              <History className="w-3.5 h-3.5" />
              <span>Lịch sử ({turnRecords.length})</span>
            </button>
          </div>

          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRosterDrawer((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-[#0B1938]/90 hover:bg-[#0F2350] border border-cyan-400/50 text-cyan-300 text-xs font-bold shadow-lg flex items-center gap-1.5 backdrop-blur-md"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Danh sách lớp ({allEligibleCapsules.length}/{fullRoster.length})</span>
            </button>
          </div>

          {/* History Drawer Modal / Dropdown in Presentation Mode */}
          {showHistoryDrawer && (
            <div className="absolute top-14 left-3 z-40 max-w-sm w-full bg-[#071126]/95 border-2 border-amber-400 rounded-3xl p-4 shadow-2xl backdrop-blur-lg space-y-3 max-h-[460px] flex flex-col animate-fadeIn">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-2">
                <span className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                  <History className="w-4 h-4" />
                  <span>Lịch sử lượt gắp trong phiên</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 rounded-full bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {turnRecords.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Chưa có lượt gắp nào.</p>
                ) : (
                  turnRecords.map((rec) => (
                    <div key={rec.turnId} className="p-2.5 rounded-xl bg-[#0D1E45] border border-cyan-400/20 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-amber-300">
                        <span>Lượt #{rec.turnIndex} · STT #{rec.formattedStt}</span>
                        <span className="text-[10px] text-slate-400">{new Date(rec.selectedAt).toLocaleTimeString('vi-VN')}</span>
                      </div>
                      <p className="font-black text-white text-sm">{rec.studentName}</p>
                      {rec.note && <p className="text-[11px] text-amber-200 italic">“{rec.note}”</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Roster Drawer Modal / Dropdown in Presentation Mode */}
          {showRosterDrawer && (
            <div className="absolute top-14 right-3 z-40 max-w-sm w-full bg-[#071126]/95 border-2 border-cyan-400 rounded-3xl p-4 shadow-2xl backdrop-blur-lg space-y-3 max-h-[460px] flex flex-col animate-fadeIn">
              <div className="flex items-center justify-between border-b border-cyan-400/20 pb-2">
                <span className="text-xs font-black text-cyan-300 uppercase flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  <span>Danh sách học sinh ({resolvedClassName})</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowRosterDrawer(false)}
                  className="p-1 rounded-full bg-slate-800 text-slate-300 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  placeholder="Tìm STT hoặc tên học sinh..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#071126] border border-cyan-400/30 text-xs text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {filteredRosterReference.map((item) => (
                  <div key={item.student.id} className="px-3 py-2 rounded-xl bg-[#0F2350] border border-cyan-400/20 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-cyan-500/25 text-amber-300 font-black text-xs flex items-center justify-center tabular-nums">
                        {item.formattedStt}
                      </span>
                      <span className="font-bold text-white">{item.student.fullName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{item.isCalled ? 'Đã gắp' : 'Còn lại'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full-Width Maximized 3D Stage in Presentation Mode */}
          <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#050D1E] via-[#091A3A] to-[#050C1C] overflow-hidden">
            {/* Top Camera HUD */}
            <div className="relative z-10 px-4 pt-3 flex flex-wrap items-center justify-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-[#081530]/95 border border-cyan-400/50 shadow-lg flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isGrabbingNow ? 'bg-amber-400 animate-ping' : clawState === 'FINISHED' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                <span className="text-xs font-black tracking-wider text-amber-300 uppercase">{subPhaseLabelMap[subPhase]}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1 bg-[#081530]/95 border border-cyan-400/30 rounded-xl p-1 shadow-lg text-[11px] font-bold">
                <Camera className="w-3.5 h-3.5 text-cyan-300 ml-1" />
                {(
                  [
                    { key: 'FRONT', label: 'Chính diện' },
                    { key: 'ISO_34', label: 'Nghiêng 3/4' },
                    { key: 'CLAW_CLOSEUP', label: 'Cận móng' },
                    { key: 'DROP_CHUTE', label: 'Cửa thả' },
                    { key: 'RESULT_TRAY', label: 'Khay nhận' },
                  ] as Array<{ key: ClawCameraPreset; label: string }>
                ).map((cam) => (
                  <button
                    key={cam.key}
                    type="button"
                    onClick={() => applyCameraPreset(cam.key)}
                    className={`px-2 py-1 rounded-lg transition-colors ${cameraPreset === cam.key ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-300 hover:text-white'}`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Maximized 3D WebGL Canvas Viewport for Presentation Mode */}
            <div
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerLeave={handleStagePointerUp}
              className="relative w-full h-[460px] sm:h-[540px] lg:h-[620px] cursor-grab active:cursor-grabbing select-none"
              title="Kéo chuột để xoay góc nhìn 3D quanh máy gắp"
            >
              {webglSupported ? (
                <div ref={mountContainerRef} className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-amber-400" />
                  <p className="text-base font-black text-amber-300">Trình duyệt không bật WebGL 3D</p>
                </div>
              )}

              {clawState === 'FINISHED' && (
                <div className="absolute inset-0 bg-[#050C1C]/85 flex items-center justify-center p-6 z-20">
                  <div className="max-w-md w-full bg-[#0D1E45] border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                    <Sparkles className="w-10 h-10 text-amber-300 mx-auto" />
                    <h4 className="text-xl font-black text-amber-300 uppercase">Đã gắp hết học sinh trong phiên!</h4>
                    <button
                      type="button"
                      onClick={() => {
                        onResetSession?.();
                        setWinnerCapsule(null);
                        setClawState('READY');
                        setSubPhase('IDLE');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm shadow-lg"
                    >
                      BẮT ĐẦU PHIÊN MỚI
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Control Deck in Presentation Mode */}
            <div className="relative z-10 px-4 pb-6 pt-2 bg-gradient-to-t from-[#040A18] via-[#081530]/95 to-transparent space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={startClawGrabTurn}
                  disabled={isGrabbingNow || allEligibleCapsules.length === 0}
                  className="px-10 sm:px-14 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-lg sm:text-xl tracking-wider uppercase shadow-[0_0_40px_rgba(245,158,11,0.6)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 border-2 border-yellow-200"
                >
                  <Play className="w-6 h-6 fill-slate-950" />
                  <span>
                    {isGrabbingNow
                      ? 'MÓNG 3 CHẤU ĐANG GẮP...'
                      : clawState === 'COMPLETED'
                      ? 'GẮP TIẾP HỌC SINH (SPACE)'
                      : 'GẮP NGẪU NHIÊN (SPACE)'}
                  </span>
                </button>

                {winnerCapsule && !isGrabbingNow && (
                  <button
                    type="button"
                    onClick={() => setShowWinnerModal(true)}
                    className="px-5 py-4 rounded-2xl bg-blue-600/90 hover:bg-blue-500 border-2 border-cyan-300 text-white font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-xl"
                  >
                    <Trophy className="w-5 h-5 text-amber-300" />
                    <span>
                      Vừa trúng: #{winnerCapsule.formattedStt} {winnerCapsule.student.fullName}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[600px]">
        {/* LEFT COLUMN (lg:col-span-3): Turn History & Session Persistence */}
        <div className="order-3 lg:order-1 lg:col-span-3 bg-[#071126] border-t lg:border-t-0 lg:border-r border-cyan-400/25 flex flex-col max-h-[580px] lg:max-h-none">
          <div className="px-4 py-3 bg-[#0B1938] border-b border-cyan-400/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-black text-amber-300 uppercase">
              <History className="w-4 h-4" />
              <span>Lịch sử lượt gắp ({turnRecords.length})</span>
            </div>
            {onOpenHistoryModal && (
              <button
                type="button"
                onClick={onOpenHistoryModal}
                className="text-[11px] font-bold text-cyan-300 hover:underline"
              >
                Tất cả
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {turnRecords.length === 0 ? (
              <div className="text-center py-12 px-3 text-slate-400 text-xs space-y-2">
                <Gamepad2 className="w-8 h-8 mx-auto text-cyan-400/60" />
                <p className="font-bold text-slate-200">Chưa có lượt gắp nào trong phiên</p>
                <p>Nhấn nút GẮP NGẪU NHIÊN để móng gắp 3 chấu chọn viên nang học sinh đầu tiên.</p>
              </div>
            ) : (
              turnRecords.map((rec) => (
                <div
                  key={rec.turnId}
                  className="p-3 rounded-2xl bg-[#0D1E45]/85 border border-cyan-400/25 space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 font-black tabular-nums">
                      Lượt #{rec.turnIndex} · STT #{rec.formattedStt}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {new Date(rec.selectedAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-sm font-black text-white">{rec.studentName}</p>
                  {rec.note && <p className="text-xs text-amber-200 italic">“{rec.note}”</p>}
                  <div className="flex items-center justify-between pt-1 border-t border-cyan-400/15 text-[11px]">
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
                        Lưu lại
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Fairness Badge */}
          <div className="p-3 border-t border-cyan-400/20 bg-[#08132B]">
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Kiểm định RNG & Cơ học ({unitTestReport.totalChecks} test OK)</span>
            </button>
          </div>
        </div>

        {/* CENTER COLUMN (lg:col-span-6): 3D WebGL Arcade Claw Machine Stage */}
        <div className="order-1 lg:order-2 lg:col-span-6 relative flex flex-col justify-between bg-gradient-to-b from-[#050D1E] via-[#091A3A] to-[#050C1C] overflow-hidden">
          {/* Top Camera Angle Presets & Mechanical Status HUD (Section 2.2) */}
          <div className="relative z-10 px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
            {/* Mechanical State Badge */}
            <div className="px-3 py-1.5 rounded-xl bg-[#081530]/95 border border-cyan-400/50 shadow-lg flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isGrabbingNow
                    ? 'bg-amber-400 animate-ping'
                    : clawState === 'FINISHED'
                    ? 'bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="text-xs font-black tracking-wider text-amber-300 uppercase">
                {subPhaseLabelMap[subPhase]}
              </span>
            </div>

            {/* 5 Camera View Presets + Reset View */}
            <div className="flex flex-wrap items-center gap-1 bg-[#081530]/95 border border-cyan-400/30 rounded-xl p-1 shadow-lg text-[11px] font-bold">
              <Camera className="w-3.5 h-3.5 text-cyan-300 ml-1" />
              {(
                [
                  { key: 'FRONT', label: 'Chính diện' },
                  { key: 'ISO_34', label: 'Nghiêng 3/4' },
                  { key: 'CLAW_CLOSEUP', label: 'Cận móng' },
                  { key: 'DROP_CHUTE', label: 'Cửa thả' },
                  { key: 'RESULT_TRAY', label: 'Khay nhận' },
                ] as Array<{ key: ClawCameraPreset; label: string }>
              ).map((cam) => (
                <button
                  key={cam.key}
                  type="button"
                  onClick={() => applyCameraPreset(cam.key)}
                  className={`px-2 py-1 rounded-lg transition-colors ${
                    cameraPreset === cam.key
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {cam.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => applyCameraPreset('ISO_34')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300"
                title="Đặt lại góc nhìn mặc định"
              >
                Reset góc
              </button>
            </div>
          </div>

          {/* Visual Representation Notice when >24 capsules are capped */}
          {visualCapLimitMode && allEligibleCapsules.length > 24 && (
            <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-bold flex items-center justify-between">
              <span>
                Đang hiển thị 24 viên nang đại diện trực quan — Thuật toán RNG vẫn chọn công bằng
                trên toàn bộ {allEligibleCapsules.length} học sinh hợp lệ.
              </span>
            </div>
          )}

          {/* 3D WebGL Canvas Viewport */}
          <div
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerLeave={handleStagePointerUp}
            className="relative w-full h-[420px] sm:h-[470px] lg:h-[500px] cursor-grab active:cursor-grabbing select-none"
            title="Kéo chuột để xoay góc nhìn 3D quanh máy gắp"
          >
            {webglSupported ? (
              <div ref={mountContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-base font-black text-amber-300">
                  Trình duyệt hiện tại không bật WebGL 3D
                </p>
                <p className="text-xs text-slate-300 max-w-md">
                  Hệ thống vẫn đảm bảo chọn ngẫu nhiên công bằng học sinh bằng thuật toán
                  crypto.getRandomValues. Hãy nhấn nút GẮP NGẪU NHIÊN bên dưới.
                </p>
              </div>
            )}

            {/* FINISHED Session Overlay (All eligible students called) */}
            {clawState === 'FINISHED' && (
              <div className="absolute inset-0 bg-[#050C1C]/85 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#0D1E45] border-2 border-amber-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <Sparkles className="w-10 h-10 text-amber-300 mx-auto" />
                  <h4 className="text-xl font-black text-amber-300 uppercase">
                    Đã gắp hết học sinh trong phiên!
                  </h4>
                  <p className="text-sm text-slate-200">
                    Tất cả học sinh có mặt của lớp <strong>{resolvedClassName}</strong> đều đã được
                    máy gắp chọn công bằng.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetSession?.();
                        setWinnerCapsule(null);
                        setClawState('READY');
                        setSubPhase('IDLE');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm shadow-lg"
                    >
                      BẮT ĐẦU PHIÊN MỚI
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Recovery Overlay */}
            {clawState === 'ERROR_RECOVERY' && errorMessage && (
              <div className="absolute inset-0 bg-[#050C1C]/85 flex items-center justify-center p-6 z-20">
                <div className="max-w-md w-full bg-[#1E1B4B] border-2 border-rose-400 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
                  <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
                  <h4 className="text-lg font-black text-white">Khôi phục trạng thái máy gắp</h4>
                  <p className="text-sm text-rose-200">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setClawState(allEligibleCapsules.length > 0 ? 'READY' : 'FINISHED');
                      setSubPhase('IDLE');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
                  >
                    Sẵn sàng gắp tiếp
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Control Deck: AUTO Button vs Interactive Virtual Joystick + Fairness Notice */}
          <div className="relative z-10 px-4 pb-4 pt-2 bg-gradient-to-t from-[#040A18] via-[#081530]/95 to-transparent space-y-3">
            {controlMode === 'JOYSTICK' && (
              <div className="p-3 rounded-2xl bg-[#0B1C40]/95 border border-cyan-400/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-3 gap-1 w-28">
                    <div />
                    <button
                      type="button"
                      disabled={isGrabbingNow}
                      onClick={() => nudgeJoystickCarriage(0, -0.26)}
                      className="p-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/45 border border-cyan-400/50 text-cyan-200 flex items-center justify-center disabled:opacity-40"
                      title="Tiến (W / Mũi tên lên)"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <div />
                    <button
                      type="button"
                      disabled={isGrabbingNow}
                      onClick={() => nudgeJoystickCarriage(-0.26, 0)}
                      className="p-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/45 border border-cyan-400/50 text-cyan-200 flex items-center justify-center disabled:opacity-40"
                      title="Trái (A / Mũi tên trái)"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isGrabbingNow}
                      onClick={() => nudgeJoystickCarriage(0, 0.26)}
                      className="p-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/45 border border-cyan-400/50 text-cyan-200 flex items-center justify-center disabled:opacity-40"
                      title="Lùi (S / Mũi tên xuống)"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isGrabbingNow}
                      onClick={() => nudgeJoystickCarriage(0.26, 0)}
                      className="p-2 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/45 border border-cyan-400/50 text-cyan-200 flex items-center justify-center disabled:opacity-40"
                      title="Phải (D / Mũi tên phải)"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-200 space-y-0.5 max-w-xs">
                    <p className="font-black text-cyan-300 uppercase">
                      Chế độ Joystick Trình diễn Công bằng
                    </p>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Lưu ý: Joystick điều khiển vị trí xe trượt trình diễn; kết quả học sinh vẫn
                      được chọn bằng thuật toán ngẫu nhiên công bằng và móng sẽ tự căn chỉnh khi nhấn
                      HẠ MÓNG.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startClawGrabTurn}
                  disabled={isGrabbingNow || allEligibleCapsules.length === 0}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-black text-sm uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>HẠ MÓNG GẮP NGAY</span>
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={startClawGrabTurn}
                disabled={isGrabbingNow || allEligibleCapsules.length === 0}
                className="px-8 sm:px-10 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2.5 border-2 border-yellow-200"
              >
                <Play className="w-5 h-5 fill-slate-950" />
                <span>
                  {isGrabbingNow
                    ? 'MÓNG 3 CHẤU ĐANG GẮP...'
                    : clawState === 'COMPLETED'
                    ? 'GẮP TIẾP HỌC SINH (SPACE)'
                    : 'GẮP NGẪU NHIÊN (SPACE)'}
                </span>
              </button>

              {winnerCapsule && !isGrabbingNow && (
                <button
                  type="button"
                  onClick={() => setShowWinnerModal(true)}
                  className="px-4 py-3.5 rounded-2xl bg-blue-600/90 hover:bg-blue-500 border border-cyan-300/50 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                >
                  <Trophy className="w-4 h-4 text-amber-300" />
                  <span>
                    Vừa trúng: #{winnerCapsule.formattedStt} {winnerCapsule.student.fullName}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-3): Class Controls, Searchable Student Roster & 3D Settings */}
        <div className="order-2 lg:order-3 lg:col-span-3 bg-[#071126] border-t lg:border-t-0 lg:border-l border-cyan-400/25 flex flex-col max-h-[580px] lg:max-h-none">
          {/* Class Selector & Absent Controls */}
          <div className="p-3 bg-[#0B1938] border-b border-cyan-400/20 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-black text-amber-300 uppercase">
                Quản lý Lớp & Viên nang
              </span>
              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={onOpenAbsentModal}
                  disabled={isGrabbingNow}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 font-bold flex items-center gap-1"
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
                disabled={isGrabbingNow}
                className="w-full px-3 py-2 rounded-xl bg-[#0F2350] border border-cyan-400/40 text-xs font-bold text-white focus:outline-none"
              >
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                    Lớp {cls.name} ({cls.students?.length || 0} HS)
                  </option>
                ))}
              </select>
            )}

            {/* Search Student Input (Section X) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Tìm STT hoặc họ tên học sinh..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#071126] border border-cyan-400/30 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* STT -> Full Name Capsule List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {filteredRosterReference.map((item) => {
              const isLastWinner =
                winnerCapsule?.student.id === item.student.id && !isGrabbingNow;

              return (
                <div
                  key={item.student.id}
                  className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                    isLastWinner
                      ? 'bg-amber-400/25 border-amber-400 text-white shadow-md'
                      : item.isAbsent
                      ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through'
                      : item.isCalled && antiDuplicate
                      ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                      : 'bg-[#0F2350]/75 border-cyan-400/20 text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                        isLastWinner
                          ? 'bg-amber-400 text-slate-950'
                          : item.isEligibleNow
                          ? 'bg-cyan-500/25 text-amber-300 border border-amber-400/40'
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
                          ? 'Đã gắp trong phiên'
                          : 'Trong buồng kính 3D'}
                      </p>
                    </div>
                  </div>

                  {isLastWinner ? (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[10px] shrink-0">
                      VỪA TRÚNG
                    </span>
                  ) : item.isCalled && antiDuplicate && onRestoreStudentToPool ? (
                    <button
                      type="button"
                      onClick={() => onRestoreStudentToPool(item.student.id)}
                      className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-200 font-bold text-[10px] shrink-0"
                    >
                      Đưa lại
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* 3D Quality, Speed & Voice Settings Footer */}
          <div className="p-3 bg-[#0B1938] border-t border-cyan-400/20 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Đồ họa 3D:</span>
              </span>
              <div className="flex items-center gap-1">
                {(['LOW', 'MEDIUM', 'HIGH'] as ClawQualityPreset[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQualityPreset(q)}
                    className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                      qualityPreset === q
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-[#071126] text-slate-300'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-300">Tốc độ gắp:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSpeedMode('NORMAL')}
                  className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                    speedMode === 'NORMAL'
                      ? 'bg-cyan-400 text-slate-950 font-black'
                      : 'bg-[#071126] text-slate-300'
                  }`}
                >
                  Chuẩn (7.8s)
                </button>
                <button
                  type="button"
                  onClick={() => setSpeedMode('FAST')}
                  className={`px-2.5 py-0.5 rounded font-bold text-[11px] ${
                    speedMode === 'FAST'
                      ? 'bg-cyan-400 text-slate-950 font-black'
                      : 'bg-[#071126] text-slate-300'
                  }`}
                >
                  Nhanh (5.2s)
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setVoiceEnabled((v) => !v)}
                className="flex-1 py-1.5 px-2 rounded-lg bg-[#071126] border border-cyan-400/30 font-bold text-[11px] text-emerald-300 flex items-center justify-center gap-1"
              >
                <Volume1 className="w-3.5 h-3.5" />
                <span>Giọng đọc: {voiceEnabled ? 'BẬT' : 'TẮT'}</span>
              </button>

              {allEligibleCapsules.length > 24 && (
                <button
                  type="button"
                  onClick={() => setVisualCapLimitMode((v) => !v)}
                  className="py-1.5 px-2 rounded-lg bg-[#071126] border border-amber-400/30 font-bold text-[11px] text-amber-300 flex items-center gap-1"
                  title="Tối ưu hiển thị 24 viên nang đại diện cho lớp đông"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{visualCapLimitMode ? '24 viên' : 'Tất cả'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Winner Reveal Modal after Capsule Splits Open (Section VIII) */}
      {showWinnerModal && winnerCapsule && (
        <div className="fixed inset-0 bg-slate-950/85 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-xl w-full bg-gradient-to-b from-[#0D1E45] via-[#091530] to-[#050C1C] border-4 border-amber-400 rounded-3xl p-6 sm:p-8 text-white shadow-[0_0_60px_rgba(245,158,11,0.5)] space-y-6 relative overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setShowWinnerModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-4 h-4" />
                <span>CHÚC MỪNG! HỌC SINH MAY MẮN</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-amber-300 uppercase">
                Viên Nang #{winnerCapsule.formattedStt} Đã Mở!
              </h2>
            </div>

            <div className="p-6 rounded-2xl bg-[#050D1E] border-2 border-amber-400/70 text-center space-y-3 shadow-inner">
              <div className="inline-flex items-center justify-center px-4 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-base tabular-nums">
                Số thứ tự: #{winnerCapsule.formattedStt}
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white tracking-wide py-1">
                {winnerCapsule.student.fullName}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm text-cyan-200 font-bold">
                <span>Lớp: {resolvedClassName}</span>
                <span>•</span>
                <span>Lượt gắp: #{turnRecords.length}</span>
                <span>•</span>
                <span>Còn lại: {allEligibleCapsules.length} HS</span>
              </div>
            </div>

            {/* Quick Bonus Points & Teacher Note */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-200">
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
                  'Giải thích xuất sắc (+2đ)',
                  'Hoàn thành nhiệm vụ tốt',
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
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-black'
                        : 'bg-[#0F2350] border-cyan-400/30 text-slate-200'
                    }`}
                  >
                    {presetNote}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons Required by Section VIII */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowWinnerModal(false);
                  setTimeout(() => startClawGrabTurn(), 120);
                }}
                disabled={allEligibleCapsules.length === 0}
                className="py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>GẮP TIẾP</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  speakWinnerAnnouncement(winnerCapsule.student.fullName, true)
                }
                className="py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
              >
                <Volume1 className="w-4 h-4" />
                <span>ĐỌC LẠI TÊN</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowWinnerModal(false);
                  if (onOpenHistoryModal) onOpenHistoryModal();
                }}
                className="py-3 px-4 rounded-2xl bg-[#0F2350] hover:bg-[#162F6A] border border-cyan-400/40 text-cyan-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                <History className="w-4 h-4" />
                <span>XEM LỊCH SỬ</span>
              </button>

              <button
                type="button"
                onClick={() => setShowWinnerModal(false)}
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
            className="max-w-md w-full bg-[#0D1E45] border-2 border-amber-400 rounded-3xl p-6 text-white space-y-4 shadow-2xl text-center"
          >
            <RotateCcw className="w-10 h-10 text-amber-400 mx-auto" />
            <h4 className="text-xl font-black text-amber-300 uppercase">
              Đặt lại phiên máy gắp 3D?
            </h4>
            <p className="text-sm text-slate-200">
              Tất cả viên nang học sinh đã gắp trong phiên này sẽ được đưa trở lại buồng kính để bắt
              đầu vòng mới. Dữ liệu lịch sử cũ không bị xóa.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onResetSession?.();
                  setWinnerCapsule(null);
                  setShowResetModal(false);
                  setClawState('READY');
                  setSubPhase('IDLE');
                }}
                className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-sm"
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

      {/* RNG & Mechanical Verification Modal (Section XVI) */}
      {showVerifyModal && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center p-4 z-50">
          <div
            style={{ fontFamily: '"Times New Roman", Times, serif' }}
            className="max-w-lg w-full bg-[#0D1E45] border-2 border-emerald-400 rounded-3xl p-6 text-white space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300">
                <ShieldCheck className="w-6 h-6" />
                <h4 className="text-lg font-black uppercase">
                  Kiểm định Máy Gắp 3D & RNG Công bằng (A02)
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

            <div className="p-4 rounded-2xl bg-[#050C1C] border border-emerald-400/30 space-y-2 text-xs sm:text-sm">
              <p className="font-bold text-emerald-300">
                Kết quả Unit Test tự động:{' '}
                {unitTestReport.passed ? 'ĐẠT 100%' : 'CÓ CẢNH BÁO'} (
                {unitTestReport.totalChecks}/{unitTestReport.totalChecks} kiểm thử chính xác)
              </p>
              <ul className="space-y-1.5 text-slate-200 list-disc pl-5">
                <li>
                  <strong>Ngẫu nhiên công bằng:</strong> Chọn <code>student_id</code> trước bằng{' '}
                  <code>crypto.getRandomValues</code> (Rejection Sampling), tuyệt đối không phụ
                  thuộc viên nang tình cờ nằm gần móng.
                </li>
                <li>
                  <strong>Ánh xạ 1-1 Viên nang ↔ Học sinh:</strong> Kiểm nghiệm cho lớp 1, 2, 10, 30
                  và 50 học sinh; móng 3 chấu luôn di chuyển tới đúng tọa độ <code>(x, y, z)</code>{' '}
                  của viên nang mục tiêu.
                </li>
                <li>
                  <strong>Chống lặp & Chống lưu trùng:</strong> Kiểm thử 20 lượt liên tiếp không
                  trùng học sinh và khóa <code>turnId</code> duy nhất.
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

export default ClawMachine3DGame;
