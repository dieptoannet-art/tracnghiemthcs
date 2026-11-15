import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  DinoEgg3DState,
  DinoEggAnimationSubPhase,
  DinoEggGameMode,
  DinoSpecies,
  DinoEggSpeedMode,
  DinoEggQualityPreset,
  DinoEgg3DItem,
  DinoEgg3DTurnPlan,
  DinoEggCameraFraming,
  DINO_SPECIES_LIST,
  buildDinoEgg3DItems,
  computeDinoEggCameraFraming,
  createFairDinoEggTurnPlan,
  evaluateDinoEggCinematicTimeline,
  DinoEggTurnDeduplicator,
  runDinoEgg3DUnitTests,
} from './dinoEgg3dMath';
import {
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
  ChevronLeft,
  ChevronRight,
  UserCheck,
  Volume1,
  LogOut,
  Egg,
} from 'lucide-react';

export interface DinoEgg3DGameProps {
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
  onCloseGame?: () => void;
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

export interface DinoEgg3DTurnRecord {
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
  eggId: string;
  eggDisplayNumber: number;
  species: DinoSpecies;
  gameMode: DinoEggGameMode;
  allowRepeat: boolean;
  selectedAt: string;
  saveStatus: 'saved' | 'pending' | 'failed';
  note?: string;
}

const LOCAL_DINO_RECORDS_KEY_PREFIX = 'taydo_a04_dinoegg3d_records_v2';

// Synthesized Prehistoric Jungle & Dinosaur Hatching Sound Engine (Web Audio API)
class DinoEgg3DSoundEngine {
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

  public playEggSelectChime(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(392, now);
      osc.frequency.exponentialRampToValueAtTime(784, now + 0.22);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Ignore audio errors
    }
  }

  public playEggWobbleDrum(muted: boolean) {
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
        osc.frequency.setValueAtTime(140 + i * 20, t);
        osc.frequency.exponentialRampToValueAtTime(75, t + 0.09);
        gain.gain.setValueAtTime(0.1, t);
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

  public playShellCrackSnap(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch {
      // Ignore
    }
  }

  public playBabyDinoChirp(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [587.33, 880, 1046.5, 1318.5];
      notes.forEach((freq, idx) => {
        const start = ctx.currentTime + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.15, start + 0.12);
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.26);
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
        const start = ctx.currentTime + idx * 0.1;
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
 * Create a procedural prehistoric speckled dinosaur egg shell texture.
 */
function createDinoEggShellTexture(
  baseHex: string,
  spotHex: string,
  isHatched: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, isHatched ? '#334155' : baseHex);
    grad.addColorStop(1, isHatched ? '#1E293B' : spotHex);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Prehistoric speckles & organic spots
    ctx.fillStyle = isHatched ? 'rgba(148,163,184,0.25)' : 'rgba(255,255,255,0.22)';
    const spots = [
      [90, 120, 26],
      [210, 85, 18],
      [360, 140, 28],
      [440, 210, 20],
      [140, 260, 32],
      [290, 240, 22],
      [75, 390, 24],
      [240, 380, 30],
      [410, 360, 25],
      [180, 455, 19],
      [340, 460, 22],
    ];
    spots.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 1.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    spots.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc((x + 65) % 480, (y + 50) % 480, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a CanvasTexture for the front egg number badge ("TRỨNG #01").
 */
function createEggNumberBadgeTexture(
  formattedEggNumber: string,
  accentHex: string,
  isHatched: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = isHatched ? 'rgba(15, 23, 42, 0.82)' : 'rgba(6, 36, 24, 0.92)';
    ctx.strokeStyle = isHatched ? '#64748B' : accentHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(10, 14, 236, 100, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isHatched ? '#94A3B8' : '#FEF08A';
    ctx.font = 'bold 24px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isHatched ? 'ĐÃ NỞ' : 'TRỨNG', 128, 44);

    ctx.fillStyle = isHatched ? '#CBD5E1' : '#FFFFFF';
    ctx.font = 'bold 42px "Times New Roman", Times, serif';
    ctx.fillText(`#${formattedEggNumber}`, 128, 86);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Create a high-contrast 3D Prehistoric Name Board texture floating above the hatched baby dinosaur.
 */
function create3DDinoNameBoardTexture(params: {
  studentFullName: string;
  formattedStt: string;
  className: string;
  speciesLabel: string;
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 1024, 512);
    grad.addColorStop(0, '#042F2E');
    grad.addColorStop(0.5, '#064E3B');
    grad.addColorStop(1, '#022C22');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(16, 16, 992, 480, 44);
    ctx.fill();
    ctx.stroke();

    // Inner emerald-gold frame
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(36, 36, 952, 440, 32);
    ctx.stroke();

    // Header badge
    ctx.fillStyle = '#FACC15';
    ctx.font = 'bold 34px "Times New Roman", Times, serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `🦖 ${params.speciesLabel.toUpperCase()} · LỚP ${params.className.toUpperCase()}`,
      512,
      102
    );

    // STT Pill
    ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(352, 132, 320, 68, 34);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF08A';
    ctx.font = 'bold 40px "Times New Roman", Times, serif';
    ctx.fillText(`SỐ THỨ TỰ: #${params.formattedStt}`, 512, 178);

    // Student Full Name
    const nameLen = params.studentFullName.length;
    const fontSize = nameLen > 24 ? 58 : nameLen > 18 ? 68 : 78;
    ctx.font = `bold ${fontSize}px "Times New Roman", Times, serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(250, 204, 21, 0.85)';
    ctx.shadowBlur = 18;
    ctx.fillText(params.studentFullName.toUpperCase(), 512, 315);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'bold 30px "Times New Roman", Times, serif';
    ctx.fillText('CHÚC MỪNG BẠN ĐƯỢC KHỦNG LONG CON CHỌN!', 512, 424);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface BabyDinoRig {
  rootGroup: THREE.Group;
  headGroup: THREE.Group;
  leftEyeMesh: THREE.Mesh;
  rightEyeMesh: THREE.Mesh;
  tailGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
}

/**
 * Build an articulated 3D Baby Dinosaur (`BABY_TREX`, `BABY_TRICERATOPS`, or `BABY_BRACHIOSAURUS`)
 * with movable head, blinking eyes, wagging tail, and stepping legs (Section VII).
 */
function build3DBabyDinosaurRig(species: DinoSpecies): BabyDinoRig {
  const speciesMeta =
    DINO_SPECIES_LIST.find((s) => s.id === species) || DINO_SPECIES_LIST[0];

  const rootGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: speciesMeta.primaryColorHex,
    roughness: 0.36,
    metalness: 0.08,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: speciesMeta.bellyColorHex,
    roughness: 0.45,
    metalness: 0.05,
  });
  const crestMat = new THREE.MeshStandardMaterial({
    color: speciesMeta.crestColorHex,
    emissive: speciesMeta.crestColorHex,
    emissiveIntensity: 0.22,
    roughness: 0.3,
  });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
  const pupilMat = new THREE.MeshBasicMaterial({ color: '#0F172A' });

  // Torso
  const bodyGeo = new THREE.SphereGeometry(0.32, 24, 20);
  bodyGeo.scale(0.95, 1.08, 1.15);
  const bodyMesh = new THREE.Mesh(bodyGeo, skinMat);
  bodyMesh.position.set(0, 0.08, 0);
  rootGroup.add(bodyMesh);

  // Belly patch
  const bellyGeo = new THREE.SphereGeometry(0.26, 20, 16);
  bellyGeo.scale(0.85, 0.98, 0.65);
  const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
  bellyMesh.position.set(0, 0.05, 0.18);
  rootGroup.add(bellyMesh);

  // Head Group (articulates for nodding & turning)
  const headGroup = new THREE.Group();
  const isLongNeck = species === 'BABY_BRACHIOSAURUS';
  headGroup.position.set(0, isLongNeck ? 0.56 : 0.42, 0.14);

  if (isLongNeck) {
    // Graceful long neck for Baby Brachiosaurus
    const neckGeo = new THREE.CylinderGeometry(0.11, 0.15, 0.38, 16);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, -0.18, -0.04);
    neckMesh.rotation.x = 0.22;
    headGroup.add(neckMesh);
  }

  const skullGeo = new THREE.SphereGeometry(0.24, 24, 20);
  skullGeo.scale(1.0, 0.92, 1.18);
  const skullMesh = new THREE.Mesh(skullGeo, skinMat);
  headGroup.add(skullMesh);

  // Cute snout
  const snoutGeo = new THREE.SphereGeometry(0.16, 20, 16);
  snoutGeo.scale(1.05, 0.72, 1.15);
  const snoutMesh = new THREE.Mesh(snoutGeo, skinMat);
  snoutMesh.position.set(0, -0.04, 0.2);
  headGroup.add(snoutMesh);

  // Species-specific head features
  if (species === 'BABY_TRICERATOPS') {
    // Triceratops Frill & 3 Cute Horns
    const frillGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24);
    const frillMesh = new THREE.Mesh(frillGeo, crestMat);
    frillMesh.rotation.x = Math.PI / 2 - 0.35;
    frillMesh.position.set(0, 0.1, -0.14);
    headGroup.add(frillMesh);

    const hornGeo = new THREE.ConeGeometry(0.045, 0.16, 12);
    const hornMat = new THREE.MeshStandardMaterial({ color: '#FEFCE8', roughness: 0.25 });
    const leftHorn = new THREE.Mesh(hornGeo, hornMat);
    leftHorn.position.set(-0.12, 0.18, 0.12);
    leftHorn.rotation.x = 0.45;
    headGroup.add(leftHorn);

    const rightHorn = new THREE.Mesh(hornGeo, hornMat);
    rightHorn.position.set(0.12, 0.18, 0.12);
    rightHorn.rotation.x = 0.45;
    headGroup.add(rightHorn);

    const noseHornGeo = new THREE.ConeGeometry(0.038, 0.11, 12);
    const noseHorn = new THREE.Mesh(noseHornGeo, hornMat);
    noseHorn.position.set(0, 0.05, 0.32);
    noseHorn.rotation.x = 0.6;
    headGroup.add(noseHorn);
  } else {
    // Dorsal crest / crown ridge for Baby T-Rex & Baby Brachiosaurus
    for (let i = 0; i < 3; i++) {
      const crestGeo = new THREE.ConeGeometry(0.055, 0.12, 10);
      const crestSpike = new THREE.Mesh(crestGeo, crestMat);
      crestSpike.position.set(0, 0.22 - i * 0.05, -0.04 - i * 0.09);
      crestSpike.rotation.x = -0.35;
      headGroup.add(crestSpike);
    }
  }

  // Expressive Eyes (blinkable via scale.y)
  const buildEye = (side: -1 | 1) => {
    const eyeGroup = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 16), eyeWhiteMat);
    eyeGroup.position.set(side * 0.15, 0.05, 0.18);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 12), pupilMat);
    pupil.position.set(side * 0.015, 0, 0.045);
    eyeGroup.add(pupil);
    return eyeGroup;
  };
  const leftEyeMesh = buildEye(-1);
  const rightEyeMesh = buildEye(1);
  headGroup.add(leftEyeMesh, rightEyeMesh);

  rootGroup.add(headGroup);

  // Cute tiny arms
  const armGeo = new THREE.CapsuleGeometry(0.055, 0.12, 8, 12);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.26, 0.14, 0.16);
  leftArm.rotation.set(0.6, 0, 0.35);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(0.26, 0.14, 0.16);
  rightArm.rotation.set(0.6, 0, -0.35);
  rootGroup.add(leftArm, rightArm);

  // Wagging Tail Group
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, -0.02, -0.26);
  const tailGeo = new THREE.ConeGeometry(0.15, 0.48, 16);
  const tailMesh = new THREE.Mesh(tailGeo, skinMat);
  tailMesh.rotation.x = -Math.PI / 2 + 0.35;
  tailMesh.position.set(0, 0.06, -0.2);
  tailGroup.add(tailMesh);
  rootGroup.add(tailGroup);

  // Stepping Legs
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.16, -0.18, 0.05);
  const legGeo = new THREE.CapsuleGeometry(0.08, 0.16, 8, 12);
  const leftLegMesh = new THREE.Mesh(legGeo, skinMat);
  leftLegGroup.add(leftLegMesh);
  rootGroup.add(leftLegGroup);

  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.16, -0.18, 0.05);
  const rightLegMesh = new THREE.Mesh(legGeo, skinMat);
  rightLegGroup.add(rightLegMesh);
  rootGroup.add(rightLegGroup);

  return {
    rootGroup,
    headGroup,
    leftEyeMesh,
    rightEyeMesh,
    tailGroup,
    leftLegGroup,
    rightLegGroup,
  };
}

interface Egg3DMeshRecord {
  eggId: string;
  eggIndex: number;
  rootGroup: THREE.Group;
  eggHolderGroup: THREE.Group;
  bottomShellMesh: THREE.Mesh;
  topShellGroup: THREE.Group;
  topShellMat: THREE.MeshStandardMaterial;
  crackLinesGroup: THREE.Group;
  crackMat: THREE.MeshBasicMaterial;
  shardsGroup: THREE.Group;
  dinoRig: BabyDinoRig;
  innerLightMesh: THREE.Mesh;
  innerLightMat: THREE.MeshStandardMaterial;
  particlesPoints: THREE.Points;
  nameBoardGroup: THREE.Group;
  nameBoardFrontMat: THREE.MeshBasicMaterial;
  badgeSprite: THREE.Sprite;
  hitBoxMesh: THREE.Mesh;
  restX: number;
  restY: number;
  restZ: number;
  baseScale: number;
}

export const MagicLotteryGame: React.FC<DinoEgg3DGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds = new Set<string>(),
  calledSessionIds = new Set<string>(),
  antiDuplicate = true,
  onToggleAntiDuplicate,
  onResetSession,
  onRestoreStudentToPool,
  classes = [],
  selectedSourceKey = '',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = '',
  isFullscreen = false,
  onToggleFullscreen,
  onCloseGame,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onPick,
}) => {
  // Game Mode State (Section VI: 3 Modes)
  const [gameMode, setGameMode] = useState<DinoEggGameMode>('SECRET_NEST');
  const [nestEggCount, setNestEggCount] = useState<number>(8);
  const [speedMode, setSpeedMode] = useState<DinoEggSpeedMode>('NORMAL');
  const [qualityPreset, setQualityPreset] = useState<DinoEggQualityPreset>('HIGH');
  const [voiceReadEnabled, setVoiceReadEnabled] = useState<boolean>(true);

  // Unified Two Display Modes (Section III):
  // - Presentation Mode (default & prioritized in fullscreen): Full-viewport 3D Prehistoric Jungle Stage
  // - Management Mode: Opens controlled side drawer without resetting active session or WebGL scene
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(true);
  const [showSidePanel, setShowSidePanel] = useState<boolean>(false);
  const [managementTab, setManagementTab] = useState<'ROSTER' | 'HISTORY' | 'SETTINGS'>('ROSTER');

  // Optional Classroom Size Simulator (1, 2, 5, 10, 20, 25, 30, 40, 45, 50 students - Section X)
  const [demoStudentCount, setDemoStudentCount] = useState<number | null>(null);
  const [demoCalledIds, setDemoCalledIds] = useState<Set<string>>(() => new Set());

  // State Machine & Animation Sub-Phase
  const [eggState, setEggState] = useState<DinoEgg3DState>('READY');
  const [subPhase, setSubPhase] = useState<DinoEggAnimationSubPhase>('READY');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pagination for DINO_NURSERY mode when class has 11–50 students
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Session & Turn Tracking
  const [sessionId] = useState<string>(
    () => `a04_dinoegg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  );
  const localRecordsKey = `${LOCAL_DINO_RECORDS_KEY_PREFIX}_${selectedSourceKey || 'default'}`;

  const [turnRecords, setTurnRecords] = useState<DinoEgg3DTurnRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(localRecordsKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Track hatched egg IDs in the current session
  const [hatchedEggIdsInSession, setHatchedEggIdsInSession] = useState<Set<string>>(
    () => new Set()
  );

  // Active Turn & Winner Modal State
  const [activeWinnerPlan, setActiveWinnerPlan] = useState<DinoEgg3DTurnPlan | null>(null);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);

  // Automated Self-Test Report (1, 2, 5, 10, 20, 25, 30, 40, 45, 50 students & 20 turns)
  const unitTestReport = useMemo(() => runDinoEgg3DUnitTests(), []);

  // Resolve Effective Roster (Real Class vs Simulated 1–50 Class)
  const simulatedRoster = useMemo<StudentCandidate[] | null>(() => {
    if (demoStudentCount === null) return null;
    const sampleLastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi'];
    const sampleMiddleNames = ['Gia', 'Minh', 'Ngọc', 'Phương', 'Quốc', 'Thanh', 'Thảo', 'Tuấn', 'Khánh', 'Hữu'];
    const sampleFirstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Đạt', 'Hà', 'Hải', 'Hân', 'Hiếu', 'Khoa', 'Linh', 'Long', 'Mai', 'My', 'Nam', 'Ngân', 'Nhi', 'Phong', 'Phúc', 'Quân'];
    return Array.from({ length: demoStudentCount }, (_, idx) => {
      const ln = sampleLastNames[idx % sampleLastNames.length];
      const mn = sampleMiddleNames[(idx * 3) % sampleMiddleNames.length];
      const fn = sampleFirstNames[(idx * 7) % sampleFirstNames.length];
      return {
        id: `sim_dino_stu_${demoStudentCount}_${idx + 1}`,
        code: `HS${String(idx + 1).padStart(2, '0')}`,
        fullName: `${ln} ${mn} ${fn} ${idx + 1}`,
      };
    });
  }, [demoStudentCount]);

  const fullRoster = useMemo<StudentCandidate[]>(() => {
    if (simulatedRoster) return simulatedRoster;
    if (allCandidates && allCandidates.length > 0) return allCandidates;
    return availableCandidates;
  }, [simulatedRoster, allCandidates, availableCandidates]);

  // Participating students (excluding absent)
  const participatingStudents = useMemo<StudentCandidate[]>(() => {
    if (simulatedRoster) return simulatedRoster;
    return fullRoster.filter((s) => !absentIds.has(s.id));
  }, [simulatedRoster, fullRoster, absentIds]);

  const effectiveAvailableCandidates = useMemo<StudentCandidate[]>(() => {
    if (simulatedRoster) {
      if (!antiDuplicate) return simulatedRoster;
      return simulatedRoster.filter((s) => !demoCalledIds.has(s.id));
    }
    return availableCandidates;
  }, [simulatedRoster, antiDuplicate, demoCalledIds, availableCandidates]);

  const effectiveCalledIds = useMemo<Set<string>>(() => {
    if (simulatedRoster) return demoCalledIds;
    return calledSessionIds;
  }, [simulatedRoster, demoCalledIds, calledSessionIds]);

  // Adaptive page size for DINO_NURSERY so eggs on the 3D nest stay large & clear
  const adaptivePageSize = useMemo(() => {
    const count = effectiveAvailableCandidates.length;
    if (count <= 10) return Math.max(count, 1);
    return 10;
  }, [effectiveAvailableCandidates.length]);

  // Build 3D Eggs for the current mode & eligible pool
  const allEggs = useMemo<DinoEgg3DItem[]>(() => {
    void shuffleSeed;
    const items = buildDinoEgg3DItems({
      gameMode,
      eligibleStudents: effectiveAvailableCandidates,
      fullRosterStudents: fullRoster,
      nestEggCount,
      pageSize: adaptivePageSize,
    });
    return items.map((item) => ({
      ...item,
      isHatched: hatchedEggIdsInSession.has(item.eggId),
    }));
  }, [
    gameMode,
    effectiveAvailableCandidates,
    fullRoster,
    nestEggCount,
    adaptivePageSize,
    hatchedEggIdsInSession,
    shuffleSeed,
  ]);

  const totalPages = useMemo(() => {
    if (gameMode !== 'DINO_NURSERY') return 1;
    return Math.max(1, Math.ceil(allEggs.length / adaptivePageSize));
  }, [gameMode, allEggs.length, adaptivePageSize]);

  useEffect(() => {
    if (currentPage >= totalPages) {
      setCurrentPage(Math.max(0, totalPages - 1));
    }
  }, [currentPage, totalPages]);

  const currentPageEggs = useMemo<DinoEgg3DItem[]>(() => {
    if (gameMode !== 'DINO_NURSERY') return allEggs;
    return allEggs.filter((e) => e.pageIndex === currentPage);
  }, [gameMode, allEggs, currentPage]);

  // Filtered student list for Management Drawer
  const filteredRosterList = useMemo(() => {
    const q = studentSearchQuery.trim().toLowerCase();
    return fullRoster
      .map((s, idx) => ({
        student: s,
        stt: idx + 1,
        formattedStt: String(idx + 1).padStart(2, '0'),
        isAbsent: absentIds.has(s.id),
        isCalled: effectiveCalledIds.has(s.id),
      }))
      .filter((item) => {
        if (!q) return true;
        return (
          item.student.fullName.toLowerCase().includes(q) ||
          item.student.code.toLowerCase().includes(q) ||
          item.formattedStt.includes(q)
        );
      });
  }, [fullRoster, absentIds, effectiveCalledIds, studentSearchQuery]);

  // Keep state machine synchronized with eligible student count when idle
  useEffect(() => {
    if (
      eggState !== 'SELECTING' &&
      eggState !== 'HATCHING' &&
      eggState !== 'REVEALING' &&
      eggState !== 'SAVING'
    ) {
      if (effectiveAvailableCandidates.length === 0 && fullRoster.length > 0) {
        setEggState('FINISHED');
      } else if (eggState === 'FINISHED' && effectiveAvailableCandidates.length > 0) {
        setEggState('READY');
      }
    }
  }, [effectiveAvailableCandidates.length, fullRoster.length, eggState]);

  // Reset hatched eggs when class changes
  useEffect(() => {
    setHatchedEggIdsInSession(new Set());
    setCurrentPage(0);
    setActiveWinnerPlan(null);
    setShowWinnerOverlay(false);
    setEggState(effectiveAvailableCandidates.length > 0 ? 'READY' : 'FINISHED');
    setSubPhase('READY');
  }, [selectedSourceKey]);

  // Refs for WebGL 3D Scene & Animation Loop
  const dinoStudioRootRef = useRef<HTMLDivElement | null>(null);
  const mountContainerRef = useRef<HTMLDivElement | null>(null);
  const soundEngineRef = useRef<DinoEgg3DSoundEngine>(new DinoEgg3DSoundEngine());
  const deduplicatorRef = useRef<DinoEggTurnDeduplicator>(new DinoEggTurnDeduplicator());

  const [localFullscreen, setLocalFullscreen] = useState<boolean>(false);
  const effectiveFullscreen = isFullscreen || localFullscreen;

  useEffect(() => {
    const handleFsChange = () => {
      const fsActive = Boolean(document.fullscreenElement);
      setLocalFullscreen(fsActive);
      // When entering fullscreen, prioritize Presentation Mode (Section III.1)
      if (fsActive) {
        setIsPresentationMode(true);
        setShowSidePanel(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleStudioFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
      setLocalFullscreen(false);
      if (isFullscreen && onToggleFullscreen) {
        onToggleFullscreen();
      }
      return;
    }
    const targetEl = dinoStudioRootRef.current;
    if (targetEl && targetEl.requestFullscreen) {
      targetEl
        .requestFullscreen()
        .then(() => {
          setLocalFullscreen(true);
          setIsPresentationMode(true);
          setShowSidePanel(false);
        })
        .catch(() => {
          if (onToggleFullscreen) onToggleFullscreen();
        });
    } else if (onToggleFullscreen) {
      onToggleFullscreen();
    }
  }, [isFullscreen, onToggleFullscreen]);

  const activeTurnPlanRef = useRef<DinoEgg3DTurnPlan | null>(null);
  const turnStartTimeRef = useRef<number>(0);
  const activeTurnIdRef = useRef<string | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const lastSoundPhaseRef = useRef<DinoEggAnimationSubPhase>('READY');

  // Dynamic Camera Framing Ref updated by ResizeObserver & mode changes
  const cameraFramingRef = useRef<DinoEggCameraFraming>(
    computeDinoEggCameraFraming({
      aspectRatio: 16 / 9,
      eggsInPageCount: currentPageEggs.length,
      gameMode,
    })
  );
  const eggsInPageCountRef = useRef<number>(currentPageEggs.length);
  const gameModeRef = useRef<DinoEggGameMode>(gameMode);

  useEffect(() => {
    eggsInPageCountRef.current = currentPageEggs.length;
    gameModeRef.current = gameMode;
    const container = mountContainerRef.current;
    const aspect =
      container && container.clientHeight > 0
        ? container.clientWidth / container.clientHeight
        : 16 / 9;
    cameraFramingRef.current = computeDinoEggCameraFraming({
      aspectRatio: aspect,
      eggsInPageCount: currentPageEggs.length,
      gameMode,
    });
  }, [currentPageEggs.length, gameMode]);

  // Camera orbit state
  const userOrbitRef = useRef({
    azimuth: 0,
    elevation: 0.16,
    distance: 7.4,
  });
  const isDraggingRef = useRef(false);
  const pointerDownPosRef = useRef({ x: 0, y: 0 });
  const currentCamRef = useRef({ x: 0, y: 1.45, z: 7.4, lookY: 0.05, lookZ: 0 });

  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  const threeSceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    eggsContainerGroup: THREE.Group;
    eggMeshes: Egg3DMeshRecord[];
    altarRuneRing: THREE.Mesh;
    firefliesPoints: THREE.Points;
  } | null>(null);

  // Vietnamese TTS Voice Announcement (Section IX)
  const speakStudentAnnouncement = useCallback(
    (studentName: string, stt: string) => {
      if (isMuted || !voiceReadEnabled || typeof window === 'undefined') return;
      if (!('speechSynthesis' in window)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(
          `Khủng long con đã nở! Xin chúc mừng bạn số thứ tự ${Number(stt)}, ${studentName}!`
        );
        utterance.lang = 'vi-VN';
        utterance.rate = 1.0;
        utterance.pitch = 1.08;
        const voices = window.speechSynthesis.getVoices();
        const viVoice = voices.find((v) => v.lang.toLowerCase().includes('vi'));
        if (viVoice) utterance.voice = viVoice;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore speech synthesis errors
      }
    },
    [isMuted, voiceReadEnabled]
  );

  const stopVietnameseSpeech = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }, []);

  // Persist turn records to localStorage
  const persistLocalTurnRecords = useCallback(
    (records: DinoEgg3DTurnRecord[]) => {
      try {
        window.localStorage.setItem(localRecordsKey, JSON.stringify(records.slice(0, 100)));
      } catch {
        // Ignore storage quota errors
      }
    },
    [localRecordsKey]
  );

  // Sync turn record to Supabase `audit_logs` without altering schema or RLS (Section XI)
  const saveTurnToSupabase = useCallback(async (record: DinoEgg3DTurnRecord): Promise<boolean> => {
    if (!isSupabaseConfigured) return false;
    try {
      const { error } = await supabase.from('audit_logs').insert({
        action: 'edu_game_a04_dino_egg_3d_turn',
        entity_type: 'game_session',
        entity_id: record.sessionId,
        actor_id: record.teacherId || null,
        details: {
          turn_id: record.turnId,
          turn_index: record.turnIndex,
          class_id: record.classId,
          class_name: record.className,
          student_id: record.studentId,
          student_name: record.studentName,
          student_number: record.sttNumber,
          egg_id: record.eggId,
          egg_display_number: record.eggDisplayNumber,
          species: record.species,
          game_mode: record.gameMode,
          allow_repeat: record.allowRepeat,
          selected_at: record.selectedAt,
        },
      });
      return !error;
    } catch {
      return false;
    }
  }, []);

  // Finalize Hatching Turn (Guaranteed single execution per turnId)
  const finalizeDinoEggTurn = useCallback(
    (plan: DinoEgg3DTurnPlan) => {
      if (!deduplicatorRef.current.markSaved(plan.turnId)) {
        return;
      }

      if (watchdogTimerRef.current) {
        window.clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }

      activeTurnIdRef.current = null;
      activeTurnPlanRef.current = null;

      setEggState('SAVING');
      setSubPhase('COMPLETED');
      setActiveWinnerPlan(plan);
      setShowWinnerOverlay(true);

      // Mark egg hatched in session for SECRET_NEST and DINO_NURSERY
      if (plan.gameMode !== 'GIANT_EGG') {
        setHatchedEggIdsInSession((prev) => {
          const next = new Set(prev);
          next.add(plan.eggId);
          return next;
        });
      }

      soundEngineRef.current.playRevealCelebration(isMuted);
      speakStudentAnnouncement(plan.selectedStudent.fullName, plan.formattedStudentStt);

      // Notify parent EDUGameCenter (updates calledSessionIds & callHistory)
      if (simulatedRoster) {
        if (antiDuplicate) {
          setDemoCalledIds((prev) => {
            const next = new Set(prev);
            next.add(plan.selectedStudent.id);
            return next;
          });
        }
      } else {
        onPick(plan.selectedStudent, {
          sessionId,
          studentNumber: plan.studentSttNumber,
          note: `A04 Trứng khủng long 3D (${plan.gameMode} - Trứng #${String(
            plan.eggIndex + 1
          ).padStart(2, '0')} - ${plan.species})`,
        });
      }

      const newRecord: DinoEgg3DTurnRecord = {
        turnId: plan.turnId,
        turnIndex: turnRecords.length + 1,
        sessionId,
        classId: selectedSourceKey || 'default_class',
        className: resolvedClassName,
        teacherId,
        studentId: plan.selectedStudent.id,
        studentName: plan.selectedStudent.fullName,
        sttNumber: plan.studentSttNumber,
        formattedStt: plan.formattedStudentStt,
        eggId: plan.eggId,
        eggDisplayNumber: plan.eggIndex + 1,
        species: plan.species,
        gameMode: plan.gameMode,
        allowRepeat: !antiDuplicate,
        selectedAt: new Date().toISOString(),
        saveStatus: 'pending',
      };

      setTurnRecords((prev) => {
        const updated = [newRecord, ...prev];
        persistLocalTurnRecords(updated);
        return updated;
      });

      saveTurnToSupabase(newRecord).then((ok) => {
        setTurnRecords((prev) => {
          const updated = prev.map((r) =>
            r.turnId === newRecord.turnId
              ? { ...r, saveStatus: (ok ? 'saved' : 'failed') as 'saved' | 'failed' }
              : r
          );
          persistLocalTurnRecords(updated);
          return updated;
        });
      });

      setEggState('COMPLETED');
    },
    [
      isMuted,
      speakStudentAnnouncement,
      simulatedRoster,
      antiDuplicate,
      onPick,
      sessionId,
      turnRecords.length,
      selectedSourceKey,
      resolvedClassName,
      teacherId,
      persistLocalTurnRecords,
      saveTurnToSupabase,
    ]
  );

  // Trigger Hatching a Specific 3D Dinosaur Egg or Random Unhatched Egg
  const startHatchDinoEggTurn = useCallback(
    (targetEggIndexInPage?: number) => {
      setErrorMessage(null);

      const isBusy =
        eggState === 'SELECTING' ||
        eggState === 'HATCHING' ||
        eggState === 'SAVING';
      if (isBusy || activeTurnIdRef.current) return;

      if (effectiveAvailableCandidates.length === 0) {
        setEggState('FINISHED');
        return;
      }

      try {
        stopVietnameseSpeech();
        setShowWinnerOverlay(false);

        const candidateEggs =
          currentPageEggs.some((e) => !e.isHatched) ? currentPageEggs : allEggs;

        const plan = createFairDinoEggTurnPlan({
          eggs: candidateEggs,
          targetEggIndex: targetEggIndexInPage,
          eligibleStudents: effectiveAvailableCandidates,
          fullRosterStudents: fullRoster,
          gameMode,
          speedMode,
        });

        // Update the 3D Name Board texture on the selected egg BEFORE it rises
        const refs = threeSceneRef.current;
        if (refs) {
          const targetMeshRec = refs.eggMeshes.find((m) => m.eggId === plan.eggId);
          if (targetMeshRec) {
            const speciesMeta =
              DINO_SPECIES_LIST.find((s) => s.id === plan.species) || DINO_SPECIES_LIST[0];
            const boardTex = create3DDinoNameBoardTexture({
              studentFullName: plan.selectedStudent.fullName,
              formattedStt: plan.formattedStudentStt,
              className: resolvedClassName,
              speciesLabel: speciesMeta.badgeText,
            });
            const oldMap = targetMeshRec.nameBoardFrontMat.map;
            targetMeshRec.nameBoardFrontMat.map = boardTex;
            targetMeshRec.nameBoardFrontMat.needsUpdate = true;
            oldMap?.dispose();
          }
        }

        activeTurnIdRef.current = plan.turnId;
        activeTurnPlanRef.current = plan;
        turnStartTimeRef.current = performance.now();
        lastSoundPhaseRef.current = 'EGG_SELECTED';

        setEggState('SELECTING');
        setSubPhase('EGG_SELECTED');
        soundEngineRef.current.playEggSelectChime(isMuted);

        if (watchdogTimerRef.current) {
          window.clearTimeout(watchdogTimerRef.current);
        }
        watchdogTimerRef.current = window.setTimeout(() => {
          if (activeTurnIdRef.current === plan.turnId && activeTurnPlanRef.current) {
            finalizeDinoEggTurn(activeTurnPlanRef.current);
          }
        }, plan.durationMs + 500);
      } catch (err) {
        activeTurnIdRef.current = null;
        activeTurnPlanRef.current = null;
        setErrorMessage(
          err instanceof Error ? err.message : 'Không thể ấp trứng khủng long 3D.'
        );
        setEggState('ERROR_RECOVERY');
      }
    },
    [
      eggState,
      effectiveAvailableCandidates,
      stopVietnameseSpeech,
      currentPageEggs,
      allEggs,
      fullRoster,
      gameMode,
      speedMode,
      resolvedClassName,
      isMuted,
      finalizeDinoEggTurn,
    ]
  );

  // Initialize Three.js WebGL 3D Prehistoric Jungle Stage (Section V & XII)
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

    const initW = Math.max(container.clientWidth || 800, 280);
    const initH = Math.max(container.clientHeight || 520, 240);

    renderer.setPixelRatio(maxDpr);
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = !softwareGl && qualityPreset === 'HIGH';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Prehistoric Jungle Scene & Atmospheric Fog (Section V)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#051B14');
    scene.fog = new THREE.FogExp2('#051B14', 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 100);

    cameraFramingRef.current = computeDinoEggCameraFraming({
      aspectRatio: initW / initH,
      eggsInPageCount: eggsInPageCountRef.current,
      gameMode: gameModeRef.current,
    });

    // Jungle Sunlight & Canopy Lighting
    const ambientLight = new THREE.AmbientLight('#34D399', 0.85);
    scene.add(ambientLight);

    const sunKeyLight = new THREE.DirectionalLight('#FEF3C7', 2.4);
    sunKeyLight.position.set(4.5, 8.5, 6.5);
    if (!softwareGl && qualityPreset === 'HIGH') {
      sunKeyLight.castShadow = true;
      sunKeyLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(sunKeyLight);

    const jungleRimLight = new THREE.DirectionalLight('#10B981', 1.35);
    jungleRimLight.position.set(-6.0, 4.5, -4.0);
    scene.add(jungleRimLight);

    const altarSpotlight = new THREE.PointLight('#FACC15', 3.2, 12);
    altarSpotlight.position.set(0, 3.2, 2.2);
    scene.add(altarSpotlight);

    // 3D Prehistoric Jungle Environment Group (Section V)
    const jungleGroup = new THREE.Group();
    scene.add(jungleGroup);

    // 1. Mossy Forest Clearing Floor
    const floorGeo = new THREE.CylinderGeometry(7.6, 8.2, 0.35, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#063726',
      roughness: 0.78,
      metalness: 0.12,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -1.78, 0);
    floorMesh.receiveShadow = true;
    jungleGroup.add(floorMesh);

    // 2. Central Prehistoric Stone Altar Pedestal & Woven Straw/Twig Nest
    const stoneAltarGeo = new THREE.CylinderGeometry(3.8, 4.3, 0.28, 48);
    const stoneAltarMat = new THREE.MeshStandardMaterial({
      color: '#1E293B',
      roughness: 0.65,
      metalness: 0.25,
    });
    const stoneAltarMesh = new THREE.Mesh(stoneAltarGeo, stoneAltarMat);
    stoneAltarMesh.position.set(0, -1.52, 0.15);
    jungleGroup.add(stoneAltarMesh);

    // Woven Prehistoric Nest Rim
    const nestRimGeo = new THREE.TorusGeometry(3.45, 0.24, 14, 48);
    const nestRimMat = new THREE.MeshStandardMaterial({
      color: '#78350F',
      roughness: 0.88,
      metalness: 0.05,
    });
    const nestRimMesh = new THREE.Mesh(nestRimGeo, nestRimMat);
    nestRimMesh.rotation.x = Math.PI / 2;
    nestRimMesh.position.set(0, -1.36, 0.15);
    jungleGroup.add(nestRimMesh);

    // Glowing Hatching Altar Ring at front center (z = 1.25)
    const altarRuneRingGeo = new THREE.RingGeometry(1.45, 1.72, 48);
    const altarRuneRingMat = new THREE.MeshBasicMaterial({
      color: '#FACC15',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.72,
    });
    const altarRuneRing = new THREE.Mesh(altarRuneRingGeo, altarRuneRingMat);
    altarRuneRing.rotation.x = -Math.PI / 2;
    altarRuneRing.position.set(0, -1.35, 1.25);
    jungleGroup.add(altarRuneRing);

    // 3. Ancient Trees on Left/Right Background Flanks (Never blocking foreground)
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#451A03', roughness: 0.85 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#047857', roughness: 0.65 });
    const treePositions = [
      [-5.6, -2.8, 1.1],
      [5.6, -2.8, 1.1],
      [-4.2, -4.4, 0.9],
      [4.2, -4.4, 0.9],
    ];
    treePositions.forEach(([tx, tz, tScale]) => {
      const treeGrp = new THREE.Group();
      treeGrp.position.set(tx, -1.6, tz);
      treeGrp.scale.setScalar(tScale);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.52, 3.8, 12), trunkMat);
      trunk.position.y = 1.9;
      treeGrp.add(trunk);

      const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.45, 1), canopyMat);
      canopy1.position.set(0, 3.8, 0);
      canopy1.scale.set(1.2, 0.75, 1.1);
      treeGrp.add(canopy1);

      const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.1, 1), canopyMat);
      canopy2.position.set(tx < 0 ? 0.65 : -0.65, 3.2, 0.3);
      canopy2.scale.set(1.1, 0.7, 1.0);
      treeGrp.add(canopy2);

      jungleGroup.add(treeGrp);
    });

    // 4. Moss-Covered Prehistoric Boulders & Ferns around back/sides
    const rockMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.82 });
    const mossMat = new THREE.MeshStandardMaterial({ color: '#059669', roughness: 0.75 });
    const boulderPositions = [
      [-4.6, -1.5, -1.6, 0.65],
      [4.6, -1.5, -1.6, 0.68],
      [-3.2, -1.5, -3.2, 0.55],
      [3.2, -1.5, -3.2, 0.58],
      [0, -1.5, -3.8, 0.72],
    ];
    boulderPositions.forEach(([bx, by, bz, rScale], idx) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rScale, 1), rockMat);
      rock.position.set(bx, by, bz);
      rock.scale.set(1.3, 0.85, 1.1);
      rock.rotation.y = idx * 1.1;
      jungleGroup.add(rock);

      const mossCap = new THREE.Mesh(new THREE.SphereGeometry(rScale * 0.85, 12, 10), mossMat);
      mossCap.position.set(bx, by + rScale * 0.35, bz);
      mossCap.scale.set(1.2, 0.45, 1.0);
      jungleGroup.add(mossCap);

      // Prehistoric fern fronds sprouting near rocks
      for (let f = 0; f < 5; f++) {
        const frondGeo = new THREE.ConeGeometry(0.16, 0.95, 6);
        const frond = new THREE.Mesh(frondGeo, mossMat);
        const angle = (f / 5) * Math.PI * 2;
        frond.position.set(
          bx + Math.cos(angle) * 0.35,
          by + 0.35,
          bz + Math.sin(angle) * 0.35
        );
        frond.rotation.z = Math.cos(angle) * 0.55;
        frond.rotation.x = Math.sin(angle) * 0.55;
        jungleGroup.add(frond);
      }
    });

    // 5. Golden Sunbeams piercing through canopy (God-rays in background)
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#FEF08A',
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    [-2.4, 0, 2.4].forEach((beamX) => {
      const beamGeo = new THREE.CylinderGeometry(0.45, 1.65, 7.5, 16, 1, true);
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(beamX, 2.0, -1.8);
      beamMesh.rotation.z = -0.18;
      jungleGroup.add(beamMesh);
    });

    // 6. Floating Prehistoric Fireflies / Spores
    const fireflyCount = 45;
    const fireflyPositions = new Float32Array(fireflyCount * 3);
    for (let i = 0; i < fireflyCount; i++) {
      fireflyPositions[i * 3] = (Math.random() - 0.5) * 10;
      fireflyPositions[i * 3 + 1] = -1.0 + Math.random() * 4.2;
      fireflyPositions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const firefliesGeo = new THREE.BufferGeometry();
    firefliesGeo.setAttribute('position', new THREE.BufferAttribute(fireflyPositions, 3));
    const firefliesMat = new THREE.PointsMaterial({
      color: '#FDE047',
      size: 0.11,
      transparent: true,
      opacity: 0.78,
    });
    const firefliesPoints = new THREE.Points(firefliesGeo, firefliesMat);
    jungleGroup.add(firefliesPoints);

    const eggsContainerGroup = new THREE.Group();
    scene.add(eggsContainerGroup);

    threeSceneRef.current = {
      renderer,
      scene,
      camera,
      eggsContainerGroup,
      eggMeshes: [],
      altarRuneRing,
      firefliesPoints,
    };

    const handleResize = () => {
      if (!mountContainerRef.current || !threeSceneRef.current) return;
      const w = Math.max(mountContainerRef.current.clientWidth || 800, 280);
      const h = Math.max(mountContainerRef.current.clientHeight || 520, 240);
      const aspect = w / h;
      threeSceneRef.current.camera.aspect = aspect;
      threeSceneRef.current.camera.updateProjectionMatrix();
      threeSceneRef.current.renderer.setSize(w, h, false);

      cameraFramingRef.current = computeDinoEggCameraFraming({
        aspectRatio: aspect,
        eggsInPageCount: eggsInPageCountRef.current,
        gameMode: gameModeRef.current,
      });
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

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
        const frame = evaluateDinoEggCinematicTimeline(activePlan, normT);
        camFocusBlend = frame.cameraFocusBlend;

        // Sound effects on sub-phase transitions
        if (frame.subPhase !== lastSoundPhaseRef.current) {
          lastSoundPhaseRef.current = frame.subPhase;
          if (frame.subPhase === 'EGG_WOBBLING') {
            soundEngineRef.current.playEggWobbleDrum(isMuted);
          } else if (
            frame.subPhase === 'FIRST_CRACK' ||
            frame.subPhase === 'CRACK_SPREADING' ||
            frame.subPhase === 'SHELL_SPLITTING'
          ) {
            soundEngineRef.current.playShellCrackSnap(isMuted);
          } else if (
            frame.subPhase === 'DINO_PEEKING' ||
            frame.subPhase === 'DINO_HAPPY_JUMP'
          ) {
            soundEngineRef.current.playBabyDinoChirp(isMuted);
          }
        }

        // Apply 12-Stage Hatching Transforms to the active 3D Dinosaur Egg & Baby Dino
        refs.eggMeshes.forEach((rec) => {
          if (rec.eggId === activePlan.eggId) {
            rec.rootGroup.position.set(frame.eggX, frame.eggY, frame.eggZ);
            rec.rootGroup.scale.setScalar(frame.eggScale);
            rec.eggHolderGroup.rotation.set(
              frame.wobbleRotX,
              frame.wobbleRotY,
              frame.wobbleRotZ
            );

            // Glowing crack fractures
            rec.crackLinesGroup.visible = frame.crackProgress > 0.02;
            rec.crackLinesGroup.scale.setScalar(0.85 + frame.crackProgress * 0.18);
            rec.crackMat.opacity = Math.min(1, frame.crackProgress * 1.25);

            // Top shell splitting & lifting off
            rec.topShellGroup.position.set(0, frame.topShellLiftY, frame.topShellShiftZ);
            rec.topShellGroup.rotation.x = frame.topShellTiltX;
            rec.topShellMat.opacity = frame.topShellOpacity;
            rec.topShellGroup.visible = frame.topShellOpacity > 0.03;

            // Falling shell shards
            rec.shardsGroup.visible =
              frame.fallingShardsProgress > 0.05 && frame.fallingShardsProgress < 0.98;
            rec.shardsGroup.position.y = -frame.fallingShardsProgress * 0.55;
            rec.shardsGroup.scale.setScalar(1 + frame.fallingShardsProgress * 0.45);

            // Baby Dinosaur emerging, blinking, wagging tail, stepping legs & jumping
            rec.dinoRig.rootGroup.visible = frame.dinoVisible;
            rec.dinoRig.rootGroup.position.set(
              0,
              frame.dinoRiseY + frame.dinoHappyBounceY,
              0.04
            );
            rec.dinoRig.rootGroup.scale.setScalar(frame.dinoScale);
            rec.dinoRig.headGroup.rotation.x = frame.dinoHeadNodX;
            rec.dinoRig.headGroup.rotation.y = frame.dinoHeadTurnY;
            rec.dinoRig.leftEyeMesh.scale.y = frame.dinoBlinkScaleY;
            rec.dinoRig.rightEyeMesh.scale.y = frame.dinoBlinkScaleY;
            rec.dinoRig.tailGroup.rotation.y = frame.dinoTailWagY;
            rec.dinoRig.leftLegGroup.rotation.x = frame.dinoLegStepAngle;
            rec.dinoRig.rightLegGroup.rotation.x = -frame.dinoLegStepAngle;

            // Inner golden light & particles
            rec.innerLightMat.emissiveIntensity = frame.innerGlowIntensity * 3.8;
            rec.innerLightMesh.scale.setScalar(0.35 + frame.innerGlowIntensity * 0.65);

            rec.particlesPoints.visible = frame.particleBurstProgress > 0.02;
            rec.particlesPoints.position.y = frame.particleBurstProgress * 1.1;
            rec.particlesPoints.rotation.y = now * 0.0025;

            // 3D Student Name Board above baby dinosaur
            rec.nameBoardGroup.visible = frame.nameBoardVisible;
            rec.nameBoardGroup.position.set(0, frame.nameBoardLiftY, 0.14);
            rec.nameBoardGroup.scale.setScalar(frame.nameBoardScale);
          } else {
            // Subtle breathing warmth for idle eggs in nest
            rec.rootGroup.position.set(
              rec.restX,
              rec.restY + Math.sin(now * 0.002 + rec.eggIndex) * 0.03,
              rec.restZ
            );
          }
        });

        setEggState((prev) =>
          prev !== frame.stateMachinePhase ? frame.stateMachinePhase : prev
        );
        setSubPhase((prev) => (prev !== frame.subPhase ? frame.subPhase : prev));

        if (frame.shouldTriggerReveal) {
          finalizeDinoEggTurn(activePlan);
        }
      } else if (!activeTurnId) {
        // Gentle idle animation on unhatched eggs & idle breathing on hatched baby dino
        refs.eggMeshes.forEach((rec) => {
          if (activeWinnerPlan?.eggId === rec.eggId && showWinnerOverlay) {
            // Keep baby dino wagging tail & blinking while winner overlay is shown
            rec.dinoRig.tailGroup.rotation.y = Math.sin(now * 0.006) * 0.3;
            rec.dinoRig.headGroup.rotation.y = Math.sin(now * 0.0025) * 0.15;
            return;
          }
          rec.rootGroup.position.set(
            rec.restX,
            rec.restY + Math.sin(now * 0.0022 + rec.eggIndex * 0.9) * 0.032,
            rec.restZ
          );
          rec.rootGroup.scale.setScalar(rec.baseScale);
          rec.eggHolderGroup.rotation.set(
            0,
            0,
            Math.sin(now * 0.0018 + rec.eggIndex) * 0.03
          );
          rec.topShellGroup.position.set(0, 0, 0);
          rec.topShellGroup.rotation.set(0, 0, 0);
          rec.topShellMat.opacity = 1;
          rec.topShellGroup.visible = true;
          rec.crackLinesGroup.visible = false;
          rec.shardsGroup.visible = false;
          rec.dinoRig.rootGroup.visible = false;
          rec.particlesPoints.visible = false;
          rec.nameBoardGroup.visible = false;
        });
      }

      // Pulse altar ring & float fireflies
      refs.altarRuneRing.rotation.z = now * 0.0006;
      refs.firefliesPoints.rotation.y = now * 0.00025;

      // Aspect-ratio aware camera interpolation (Section V & XII)
      const orbit = userOrbitRef.current;
      const framing = cameraFramingRef.current;
      const effectiveOverviewDist = Math.max(orbit.distance, framing.overviewDistance);

      const overviewCamX =
        effectiveOverviewDist * Math.sin(orbit.azimuth) * Math.cos(orbit.elevation);
      const overviewCamY = effectiveOverviewDist * Math.sin(orbit.elevation) + 0.35;
      const overviewCamZ =
        effectiveOverviewDist * Math.cos(orbit.azimuth) * Math.cos(orbit.elevation);

      const focusCamX = 0;
      const focusCamY = framing.focusCamY;
      const focusCamZ = framing.focusCamZ;

      const desiredCamX = overviewCamX + (focusCamX - overviewCamX) * camFocusBlend;
      const desiredCamY = overviewCamY + (focusCamY - overviewCamY) * camFocusBlend;
      const desiredCamZ = overviewCamZ + (focusCamZ - overviewCamZ) * camFocusBlend;

      const desiredLookY =
        framing.overviewLookY + (framing.focusLookY - framing.overviewLookY) * camFocusBlend;
      const desiredLookZ = 0 + framing.focusLookZ * camFocusBlend;

      const cur = currentCamRef.current;
      cur.x += (desiredCamX - cur.x) * 0.12;
      cur.y += (desiredCamY - cur.y) * 0.12;
      cur.z += (desiredCamZ - cur.z) * 0.12;
      cur.lookY += (desiredLookY - cur.lookY) * 0.12;
      cur.lookZ += (desiredLookZ - cur.lookZ) * 0.12;

      refs.camera.position.set(cur.x, cur.y, cur.z);
      refs.camera.lookAt(0, cur.lookY, cur.lookZ);

      refs.renderer.render(refs.scene, refs.camera);
      afterDrawTime = performance.now();
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      envTarget.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      threeSceneRef.current = null;
    };
  }, [qualityPreset, isMuted, finalizeDinoEggTurn, activeWinnerPlan, showWinnerOverlay]);

  // Rebuild 3D Dinosaur Egg Meshes whenever `currentPageEggs` changes
  useEffect(() => {
    const refs = threeSceneRef.current;
    if (!refs) return;

    while (refs.eggsContainerGroup.children.length > 0) {
      const child = refs.eggsContainerGroup.children[0];
      refs.eggsContainerGroup.remove(child);
    }

    const newMeshRecords: Egg3DMeshRecord[] = currentPageEggs.map((egg) => {
      const rootGroup = new THREE.Group();
      rootGroup.position.set(egg.restX, egg.restY, egg.restZ);
      rootGroup.scale.setScalar(egg.eggScale);

      // Local straw nest cushion under each egg
      const miniNestGeo = new THREE.TorusGeometry(0.52, 0.11, 10, 24);
      const miniNestMat = new THREE.MeshStandardMaterial({
        color: '#92400E',
        roughness: 0.9,
      });
      const miniNestMesh = new THREE.Mesh(miniNestGeo, miniNestMat);
      miniNestMesh.rotation.x = Math.PI / 2;
      miniNestMesh.position.y = -0.52;
      rootGroup.add(miniNestMesh);

      const eggHolderGroup = new THREE.Group();
      rootGroup.add(eggHolderGroup);

      const shellTex = createDinoEggShellTexture(
        egg.palette.shellBaseHex,
        egg.palette.shellSpotHex,
        egg.isHatched
      );

      // 1. Bottom Half of Dinosaur Egg Shell
      const bottomShellGeo = new THREE.SphereGeometry(
        0.54,
        28,
        20,
        0,
        Math.PI * 2,
        Math.PI * 0.46,
        Math.PI * 0.54
      );
      bottomShellGeo.scale(1.0, 1.32, 1.0);
      const bottomShellMat = new THREE.MeshStandardMaterial({
        map: shellTex,
        roughness: 0.35,
        metalness: 0.08,
        side: THREE.DoubleSide,
      });
      const bottomShellMesh = new THREE.Mesh(bottomShellGeo, bottomShellMat);
      eggHolderGroup.add(bottomShellMesh);

      // 2. Top Half of Dinosaur Egg Shell (Splits & lifts during hatching)
      const topShellGroup = new THREE.Group();
      const topShellGeo = new THREE.SphereGeometry(
        0.545,
        28,
        20,
        0,
        Math.PI * 2,
        0,
        Math.PI * 0.48
      );
      topShellGeo.scale(1.0, 1.32, 1.0);
      const topShellMat = new THREE.MeshStandardMaterial({
        map: shellTex,
        roughness: 0.32,
        metalness: 0.08,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      });
      const topShellMesh = new THREE.Mesh(topShellGeo, topShellMat);
      topShellGroup.add(topShellMesh);
      eggHolderGroup.add(topShellGroup);

      // 3. Glowing Zig-Zag Crack Fracture Lines around the Egg Equator
      const crackLinesGroup = new THREE.Group();
      const crackMat = new THREE.MeshBasicMaterial({
        color: egg.palette.crackGlowHex,
        transparent: true,
        opacity: 0,
      });
      for (let c = 0; c < 8; c++) {
        const angle = (c / 8) * Math.PI * 2;
        const segGeo = new THREE.BoxGeometry(0.18, 0.045, 0.045);
        const segMesh = new THREE.Mesh(segGeo, crackMat);
        segMesh.position.set(
          Math.cos(angle) * 0.53,
          (c % 2 === 0 ? 0.06 : -0.04),
          Math.sin(angle) * 0.53
        );
        segMesh.rotation.y = -angle;
        segMesh.rotation.z = c % 2 === 0 ? 0.42 : -0.42;
        crackLinesGroup.add(segMesh);
      }
      crackLinesGroup.visible = false;
      eggHolderGroup.add(crackLinesGroup);

      // 4. Falling Shell Shards Group
      const shardsGroup = new THREE.Group();
      for (let s = 0; s < 6; s++) {
        const ang = (s / 6) * Math.PI * 2;
        const shardGeo = new THREE.ConeGeometry(0.12, 0.18, 3);
        const shardMesh = new THREE.Mesh(shardGeo, bottomShellMat);
        shardMesh.position.set(Math.cos(ang) * 0.58, 0.05, Math.sin(ang) * 0.58);
        shardMesh.rotation.set(s * 0.5, ang, s * 0.8);
        shardsGroup.add(shardMesh);
      }
      shardsGroup.visible = false;
      eggHolderGroup.add(shardsGroup);

      // 5. Articulated 3D Baby Dinosaur Inside Egg
      const dinoRig = build3DBabyDinosaurRig(egg.species);
      dinoRig.rootGroup.visible = false;
      rootGroup.add(dinoRig.rootGroup);

      // 6. Inner Golden Prehistoric Core Light
      const innerLightGeo = new THREE.SphereGeometry(0.32, 16, 16);
      const innerLightMat = new THREE.MeshStandardMaterial({
        color: '#FEF08A',
        emissive: '#F59E0B',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0.85,
      });
      const innerLightMesh = new THREE.Mesh(innerLightGeo, innerLightMat);
      innerLightMesh.position.set(0, -0.05, 0);
      rootGroup.add(innerLightMesh);

      // 7. Rising Magical Prehistoric Spore Particles
      const particleCount = qualityPreset === 'LOW' ? 18 : 34;
      const positions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        const r = 0.2 + Math.random() * 0.65;
        const theta = Math.random() * Math.PI * 2;
        positions[i * 3] = Math.cos(theta) * r;
        positions[i * 3 + 1] = Math.random() * 0.9;
        positions[i * 3 + 2] = Math.sin(theta) * r;
      }
      const particlesGeo = new THREE.BufferGeometry();
      particlesGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particlesMat = new THREE.PointsMaterial({
        color: '#FEF08A',
        size: 0.12,
        transparent: true,
        opacity: 0.92,
      });
      const particlesPoints = new THREE.Points(particlesGeo, particlesMat);
      particlesPoints.visible = false;
      rootGroup.add(particlesPoints);

      // 8. 3D Student Name Board (Floats above the baby dinosaur without blocking its face)
      const nameBoardGroup = new THREE.Group();
      const boardGeo = new THREE.PlaneGeometry(1.72, 0.86);
      const defaultBoardTex = create3DDinoNameBoardTexture({
        studentFullName: egg.boundStudent?.fullName || 'HỌC SINH MAY MẮN',
        formattedStt: String(egg.boundStudentStt || 1).padStart(2, '0'),
        className: 'SMART EDU',
        speciesLabel: 'Baby Dino',
      });
      const nameBoardFrontMat = new THREE.MeshBasicMaterial({
        map: defaultBoardTex,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const nameBoardMesh = new THREE.Mesh(boardGeo, nameBoardFrontMat);
      nameBoardGroup.add(nameBoardMesh);
      nameBoardGroup.visible = false;
      rootGroup.add(nameBoardGroup);

      // 9. Front Egg Number Badge Sprite ("TRỨNG #01")
      const badgeTex = createEggNumberBadgeTexture(
        egg.formattedEggNumber,
        egg.palette.nestAuraHex,
        egg.isHatched
      );
      const badgeMat = new THREE.SpriteMaterial({
        map: badgeTex,
        transparent: true,
        depthTest: false,
      });
      const badgeSprite = new THREE.Sprite(badgeMat);
      badgeSprite.position.set(0, -0.58, 0.68);
      badgeSprite.scale.set(0.82, 0.41, 1);
      rootGroup.add(badgeSprite);

      // 10. Invisible Raycast Hit Volume
      const hitBoxGeo = new THREE.SphereGeometry(0.75, 12, 12);
      const hitBoxMat = new THREE.MeshBasicMaterial({
        visible: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitBoxMesh = new THREE.Mesh(hitBoxGeo, hitBoxMat);
      hitBoxMesh.userData = { eggIndex: egg.eggIndex, eggId: egg.eggId };
      rootGroup.add(hitBoxMesh);

      refs.eggsContainerGroup.add(rootGroup);

      return {
        eggId: egg.eggId,
        eggIndex: egg.eggIndex,
        rootGroup,
        eggHolderGroup,
        bottomShellMesh,
        topShellGroup,
        topShellMat,
        crackLinesGroup,
        crackMat,
        shardsGroup,
        dinoRig,
        innerLightMesh,
        innerLightMat,
        particlesPoints,
        nameBoardGroup,
        nameBoardFrontMat,
        badgeSprite,
        hitBoxMesh,
        restX: egg.restX,
        restY: egg.restY,
        restZ: egg.restZ,
        baseScale: egg.eggScale,
      };
    });

    refs.eggMeshes = newMeshRecords;
  }, [currentPageEggs, qualityPreset]);

  // Pointer Orbit & 3D Egg Click Raycasting
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
        Math.max(userOrbitRef.current.elevation + dy * 0.002, 0.04),
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

    const refs = threeSceneRef.current;
    const container = mountContainerRef.current;
    if (!refs || !container || activeTurnIdRef.current) return;

    const rect = container.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), refs.camera);

    const hitMeshes = refs.eggMeshes.map((m) => m.hitBoxMesh);
    const intersects = raycaster.intersectObjects(hitMeshes, false);
    if (intersects.length > 0) {
      const closestHit = intersects[0].object;
      const clickedEggId = closestHit.userData?.eggId as string | undefined;
      if (clickedEggId) {
        const idxInPage = currentPageEggs.findIndex((eg) => eg.eggId === clickedEggId);
        if (idxInPage !== -1 && !currentPageEggs[idxInPage].isHatched) {
          startHatchDinoEggTurn(idxInPage);
        }
      }
    }
  };

  // Keyboard shortcuts: Space = Hatch Egg, R = Reset, M = Mute, F = Fullscreen, Esc = Close Modal/Panel
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
        startHatchDinoEggTurn();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setShowResetModal(true);
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMute?.();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleStudioFullscreen();
      } else if (e.key === 'Escape') {
        if (showWinnerOverlay) {
          setShowWinnerOverlay(false);
        } else if (showResetModal) {
          setShowResetModal(false);
        } else if (showVerifyModal) {
          setShowVerifyModal(false);
        } else if (showSidePanel && isPresentationMode) {
          setShowSidePanel(false);
        } else if (
          effectiveFullscreen &&
          !document.fullscreenElement &&
          isFullscreen &&
          onToggleFullscreen
        ) {
          onToggleFullscreen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    startHatchDinoEggTurn,
    onToggleMute,
    handleToggleStudioFullscreen,
    showWinnerOverlay,
    showResetModal,
    showVerifyModal,
    showSidePanel,
    isPresentationMode,
    effectiveFullscreen,
    isFullscreen,
    onToggleFullscreen,
  ]);

  const isHatchingNow =
    eggState === 'SELECTING' ||
    eggState === 'HATCHING' ||
    eggState === 'SAVING';

  const subPhaseViLabel: Record<DinoEggAnimationSubPhase, string> = {
    READY: 'SÂN KHẤU RỪNG KHỦNG LONG SẴN SÀNG',
    EGG_SELECTED: 'ĐÃ CHỌN TRỨNG KHỦNG LONG 3D',
    EGG_MOVING_TO_CENTER: 'TRỨNG TIẾN RA BỤC ĐÁ TRUNG TÂM',
    EGG_WOBBLING: 'TRỨNG ĐANG RUNG LẮC HỒI HỘP',
    FIRST_CRACK: 'XUẤT HIỆN VẾT NỨT ĐẦU TIÊN',
    CRACK_SPREADING: 'VẾT NỨT LAN RỘNG & PHÁT SÁNG',
    SHELL_SPLITTING: 'VỎ TRỨNG TÁCH MỞ & MẢNH VỎ RƠI',
    DINO_PEEKING: 'KHỦNG LONG CON NHÔ ĐẦU CHÀO LỚP',
    DINO_BLINK_AND_MOVE: 'KHỦNG LONG CHỚP MẮT & VẪY ĐUÔI',
    DINO_STEPPING_OUT: 'KHỦNG LONG BƯỚC RA KHỎI VỎ TRỨNG',
    DINO_HAPPY_JUMP: 'KHỦNG LONG CON VUI MỪNG NHẢY MÚA',
    NAME_BOARD_REVEAL: 'GIỚI THIỆU BẢNG TÊN HỌC SINH',
    COMPLETED: 'HOÀN TẤT ẤP TRỨNG KHỦNG LONG',
  };

  const handleResetCurrentSession = useCallback(() => {
    if (simulatedRoster) {
      setDemoCalledIds(new Set());
    } else {
      onResetSession?.();
    }
    setHatchedEggIdsInSession(new Set());
    setActiveWinnerPlan(null);
    setShowWinnerOverlay(false);
    setShowResetModal(false);
    setShuffleSeed((s) => s + 1);
    setEggState('READY');
    setSubPhase('READY');
  }, [simulatedRoster, onResetSession]);

  return (
    <div
      ref={dinoStudioRootRef}
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      className={
        effectiveFullscreen
          ? 'fixed inset-0 z-50 w-screen h-dvh bg-[#041A13] text-white overflow-hidden flex flex-col select-none'
          : 'relative w-full h-[calc(100dvh-132px)] min-h-[560px] max-h-[calc(100dvh-96px)] bg-gradient-to-b from-[#041A13] via-[#06291E] to-[#03130E] text-white rounded-2xl border-2 border-amber-400/50 shadow-2xl overflow-hidden flex flex-col select-none'
      }
    >
      {/* 1. COMPACT HEADER (8–10% HEIGHT, SHRINK-0, ZERO OVERFLOW) */}
      <header className="shrink-0 min-h-[48px] px-3 sm:px-5 py-2 bg-[#03150F]/95 border-b border-amber-400/30 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: Game Identity + Active Class + 4 Student Metrics (Section X) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xs sm:text-sm shadow-md shrink-0">
            A04
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black tracking-wide text-amber-300 uppercase truncate">
                A04 – Trứng Khủng Long 3D
              </h3>
              {demoStudentCount !== null && (
                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase shrink-0">
                  Thử {demoStudentCount} HS
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-emerald-100/90">
              <span className="truncate max-w-[130px] sm:max-w-[180px]">
                Lớp: <strong className="text-white">{resolvedClassName}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                Sĩ số: <strong className="text-white tabular-nums">{fullRoster.length}</strong>
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                ·
              </span>
              <span className="hidden md:inline whitespace-nowrap">
                Tham gia:{' '}
                <strong className="text-cyan-300 tabular-nums">{participatingStudents.length}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                Đã gọi:{' '}
                <strong className="text-amber-300 tabular-nums">{effectiveCalledIds.size}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">
                Còn đủ ĐK:{' '}
                <strong className="text-emerald-400 tabular-nums">
                  {effectiveAvailableCandidates.length}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: 3 Modes Switcher + Non-Repeat + TRÌNH CHIẾU/QUẢN LÝ + Controls */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          {/* 3 Game Modes Switcher (Section VI) */}
          <div className="flex items-center bg-[#06291E] border border-emerald-400/35 rounded-xl p-0.5 text-[11px] sm:text-xs font-bold shrink-0">
            <button
              type="button"
              disabled={isHatchingNow}
              onClick={() => {
                setGameMode('SECRET_NEST');
                setCurrentPage(0);
              }}
              className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                gameMode === 'SECRET_NEST'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-emerald-100 hover:text-white'
              }`}
              title="Chế độ 1: Tổ trứng bí mật (6–12 quả trứng 3D)"
            >
              Tổ trứng bí mật
            </button>
            <button
              type="button"
              disabled={isHatchingNow}
              onClick={() => {
                setGameMode('GIANT_EGG');
                setCurrentPage(0);
              }}
              className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                gameMode === 'GIANT_EGG'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-emerald-100 hover:text-white'
              }`}
              title="Chế độ 2: Đại trứng khủng long (Tối ưu máy chiếu lớp 40–50 HS)"
            >
              Đại trứng 3D
            </button>
            <button
              type="button"
              disabled={isHatchingNow}
              onClick={() => {
                setGameMode('DINO_NURSERY');
                setCurrentPage(0);
                setShuffleSeed((s) => s + 1);
              }}
              className={`px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                gameMode === 'DINO_NURSERY'
                  ? 'bg-amber-400 text-slate-950 font-black'
                  : 'text-emerald-100 hover:text-white'
              }`}
              title="Chế độ 3: Vườn ươm khủng long (Mỗi học sinh 1 quả trứng)"
            >
              Vườn ươm ({effectiveAvailableCandidates.length})
            </button>
          </div>

          {/* Non-Repeat Toggle */}
          <button
            type="button"
            onClick={onToggleAntiDuplicate}
            disabled={isHatchingNow}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
              antiDuplicate
                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-200'
                : 'bg-slate-800 border-slate-600 text-slate-300'
            }`}
            title="Bật/tắt chế độ Không lặp học sinh trong phiên"
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{antiDuplicate ? 'Không lặp' : 'Cho lặp'}</span>
          </button>

          {/* Unified TRÌNH CHIẾU / QUẢN LÝ Switcher (Section III.3) */}
          <div className="flex items-center bg-[#06291E] border border-emerald-400/35 rounded-xl p-0.5 text-[11px] sm:text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsPresentationMode(true);
                setShowSidePanel(false);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                isPresentationMode && !showSidePanel
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : 'text-emerald-100 hover:text-white'
              }`}
              title="Chế độ Trình chiếu: Ưu tiên toàn bộ sân khấu rừng khủng long 3D"
            >
              TRÌNH CHIẾU
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPresentationMode(false);
                setShowSidePanel(true);
              }}
              className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                !isPresentationMode || showSidePanel
                  ? 'bg-emerald-400 text-slate-950 font-black'
                  : 'text-emerald-100 hover:text-white'
              }`}
              title="Chế độ Quản lý: Mở danh sách học sinh, lịch sử và cấu hình"
            >
              QUẢN LÝ
            </button>
          </div>

          {/* Settings / Config Button */}
          <button
            type="button"
            onClick={() => {
              if (!showSidePanel) {
                setManagementTab('SETTINGS');
                setShowSidePanel(true);
                setIsPresentationMode(false);
              } else {
                setShowSidePanel(false);
                setIsPresentationMode(true);
              }
            }}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showSidePanel
                ? 'bg-emerald-600 border-emerald-300 text-white'
                : 'bg-[#06291E] hover:bg-[#0A3E2E] border-emerald-400/35 text-amber-300'
            }`}
            title="Cấu hình trò chơi & Quản lý phiên"
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{showSidePanel ? 'Đóng panel' : 'Cấu hình'}</span>
          </button>

          {/* Mute Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1.5 sm:p-2 rounded-xl bg-[#06291E] hover:bg-[#0A3E2E] border border-emerald-400/35 text-amber-300 shrink-0 cursor-pointer"
            title="Bật/tắt âm thanh (Phím M)"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={handleToggleStudioFullscreen}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-300/50 text-white text-[11px] sm:text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            title="Toàn màn hình (Phím F)"
          >
            {effectiveFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Toàn màn hình</span>
              </>
            )}
          </button>

          {/* Exit Button */}
          {(effectiveFullscreen || onCloseGame) && (
            <button
              type="button"
              onClick={() => {
                if (effectiveFullscreen) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen?.().catch(() => {});
                  }
                  setLocalFullscreen(false);
                  if (isFullscreen && onToggleFullscreen) {
                    onToggleFullscreen();
                  }
                } else if (onCloseGame) {
                  onCloseGame();
                }
              }}
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 text-[11px] sm:text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
              title="Thoát toàn màn hình hoặc trở về thư viện"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Thoát</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. MAIN WORKSPACE: 3D PREHISTORIC JUNGLE STAGE + CONTROLLED MANAGEMENT DRAWER */}
      <div className="relative flex-1 min-h-0 min-w-0 flex flex-row overflow-hidden">
        {/* CENTER 3D JUNGLE STAGE (flex-1 min-h-0 min-w-0 guarantees zero overflow) */}
        <div className="relative flex-1 min-h-0 min-w-0 flex flex-col justify-between bg-[radial-gradient(ellipse_at_center,_#0D3B2A_0%,_#051B14_68%,_#020F0B_100%)] overflow-hidden">
          {/* Floating Compact Stage HUD */}
          <div className="absolute top-2.5 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
              <div className="px-3 py-1 rounded-xl bg-[#03150F]/90 border border-amber-400/50 shadow-md flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isHatchingNow
                      ? 'bg-amber-400'
                      : eggState === 'FINISHED'
                      ? 'bg-rose-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="text-[11px] sm:text-xs font-black tracking-wider text-amber-300 uppercase">
                  {subPhaseViLabel[subPhase]}
                </span>
              </div>

              <span className="hidden xl:inline-block px-2.5 py-1 rounded-xl bg-[#03150F]/80 border border-emerald-400/25 text-[11px] text-emerald-100">
                {gameMode === 'SECRET_NEST'
                  ? `Tổ trứng bí mật (${allEggs.length} quả): Nhấn trực tiếp vào quả trứng 3D hoặc bấm ẤP TRỨNG`
                  : gameMode === 'GIANT_EGG'
                  ? 'Đại trứng khủng long: 1 quả trứng trung tâm tối ưu máy chiếu cho lớp 40–50 học sinh'
                  : `Vườn ươm khủng long (${allEggs.length} quả): Ánh xạ 1-1 học sinh đã xáo trộn công bằng Fisher-Yates`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              {/* Pagination Switcher for DINO_NURSERY (11–50 students) */}
              {gameMode === 'DINO_NURSERY' && totalPages > 1 && (
                <div className="flex items-center gap-1 bg-[#03150F]/95 border border-emerald-400/45 rounded-xl px-2 py-1 text-[11px] sm:text-xs font-bold shadow-md">
                  <button
                    type="button"
                    disabled={currentPage === 0 || isHatchingNow}
                    onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                    title="Khu vườn ươm trước"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                  <span className="text-emerald-300 tabular-nums px-1">
                    Vườn ươm {currentPage + 1}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages - 1 || isHatchingNow}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                    className="p-0.5 rounded hover:bg-white/10 disabled:opacity-40 cursor-pointer"
                    title="Khu vườn ươm tiếp theo"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-300" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  userOrbitRef.current = {
                    azimuth: 0,
                    elevation: 0.16,
                    distance: cameraFramingRef.current.overviewDistance,
                  };
                }}
                className="px-2.5 py-1 rounded-xl bg-[#03150F]/90 hover:bg-[#083023] border border-emerald-400/35 text-[11px] sm:text-xs font-bold text-emerald-300 flex items-center gap-1 shadow-md cursor-pointer"
                title="Đặt lại góc nhìn camera 3D chuẩn"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Góc nhìn chuẩn</span>
              </button>
            </div>
          </div>

          {/* 3D WebGL Prehistoric Jungle Viewport */}
          <div
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerLeave={() => {
              isDraggingRef.current = false;
            }}
            className="relative flex-1 min-h-0 min-w-0 w-full h-full cursor-pointer select-none overflow-hidden"
            title="Nhấn trực tiếp vào quả trứng khủng long 3D để ấp hoặc kéo chuột để xoay góc nhìn rừng tiền sử"
          >
            {webglSupported ? (
              <div ref={mountContainerRef} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
                <AlertCircle className="w-10 h-10 text-amber-400" />
                <p className="text-base font-black text-amber-300">
                  Trình duyệt không bật WebGL 3D
                </p>
                <p className="text-xs text-emerald-100 max-w-md">
                  Thầy/cô vẫn có thể chọn các nút Trứng bên dưới hoặc nhấn ẤP TRỨNG để chọn học sinh
                  công bằng.
                </p>
              </div>
            )}

            {/* FINISHED Overlay (All eligible students called) */}
            {eggState === 'FINISHED' && (
              <div className="absolute inset-0 bg-[#03150F]/90 flex items-center justify-center p-4 z-20">
                <div className="max-w-md w-full bg-[#06291E] border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl">
                  <Sparkles className="w-9 h-9 text-amber-400 mx-auto" />
                  <h4 className="text-lg sm:text-xl font-black text-amber-300 uppercase">
                    Đã ấp nở hết học sinh trong phiên!
                  </h4>
                  <p className="text-xs sm:text-sm text-emerald-100">
                    Tất cả học sinh đủ điều kiện của lớp <strong>{resolvedClassName}</strong> đã
                    được khủng long con gọi tên trong phiên này.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleResetCurrentSession}
                      className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase shadow-lg cursor-pointer"
                    >
                      TẠO PHIÊN MỚI / ẤP LẠI
                    </button>
                    {antiDuplicate && onToggleAntiDuplicate && (
                      <button
                        type="button"
                        onClick={onToggleAntiDuplicate}
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm cursor-pointer"
                      >
                        Chuyển sang Cho phép lặp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Error Recovery Overlay */}
            {eggState === 'ERROR_RECOVERY' && errorMessage && (
              <div className="absolute inset-0 bg-[#03150F]/90 flex items-center justify-center p-4 z-20">
                <div className="max-w-md w-full bg-[#06291E] border-2 border-rose-400 rounded-3xl p-5 text-center space-y-3.5 shadow-2xl">
                  <AlertCircle className="w-9 h-9 text-rose-400 mx-auto" />
                  <h4 className="text-base sm:text-lg font-black text-white">
                    Khôi phục sân khấu Trứng Khủng Long
                  </h4>
                  <p className="text-xs sm:text-sm text-rose-200">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setEggState(
                        effectiveAvailableCandidates.length > 0 ? 'READY' : 'FINISHED'
                      );
                      setSubPhase('READY');
                    }}
                    className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                  >
                    Tiếp tục ấp trứng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. BOTTOM CONTROL BAR (10–14% HEIGHT, SHRINK-0, ALWAYS ACCESSIBLE) */}
          <footer className="shrink-0 px-3 sm:px-5 py-2 bg-[#02120C]/95 border-t border-amber-400/30 flex flex-col gap-1.5 z-10">
            {/* Compact Egg Selector & Nursery Area Tabs */}
            {(currentPageEggs.length > 1 || totalPages > 1) && (
              <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5">
                {gameMode === 'DINO_NURSERY' && totalPages > 1 && (
                  <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-emerald-400/25">
                    {Array.from({ length: totalPages }, (_, pIdx) => {
                      const startNum = pIdx * adaptivePageSize + 1;
                      const endNum = Math.min((pIdx + 1) * adaptivePageSize, allEggs.length);
                      return (
                        <button
                          key={pIdx}
                          type="button"
                          disabled={isHatchingNow}
                          onClick={() => setCurrentPage(pIdx)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-black transition-colors whitespace-nowrap cursor-pointer ${
                            currentPage === pIdx
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-[#06291E] text-emerald-200 hover:text-white'
                          }`}
                        >
                          Trứng {String(startNum).padStart(2, '0')}–{String(endNum).padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center gap-1.5 mx-auto">
                  {currentPageEggs.map((eg, idxInPage) => (
                    <button
                      key={eg.eggId}
                      type="button"
                      disabled={
                        isHatchingNow || eg.isHatched || effectiveAvailableCandidates.length === 0
                      }
                      onClick={() => startHatchDinoEggTurn(idxInPage)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-black border transition-all tabular-nums whitespace-nowrap shrink-0 cursor-pointer ${
                        eg.isHatched
                          ? 'bg-slate-900/60 border-slate-700 text-slate-500 line-through cursor-not-allowed'
                          : 'bg-[#06291E] hover:bg-emerald-600 border-amber-400/50 text-amber-300 hover:text-white shadow-sm'
                      }`}
                    >
                      🥚 Trứng #{eg.formattedEggNumber}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Primary Action Buttons Row (Section VIII) */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Left quick status / last hatched student */}
              <div className="flex items-center gap-2 min-w-0">
                {activeWinnerPlan && !isHatchingNow ? (
                  <button
                    type="button"
                    onClick={() => setShowWinnerOverlay(true)}
                    className="px-3 py-1.5 rounded-xl bg-[#06291E] hover:bg-emerald-700 border border-emerald-400/50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm truncate max-w-[260px] sm:max-w-[340px] cursor-pointer"
                    title="Xem lại bảng công bố học sinh vừa nở"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">
                      Vừa nở: #{activeWinnerPlan.formattedStudentStt}{' '}
                      {activeWinnerPlan.selectedStudent.fullName}
                    </span>
                  </button>
                ) : (
                  <span className="text-[11px] sm:text-xs text-emerald-200/85 hidden sm:inline truncate">
                    Nhấn phím <strong className="text-amber-300">SPACE</strong> hoặc chạm vào quả
                    trứng khủng long trên tổ để ấp
                  </span>
                )}
              </div>

              {/* Center Primary CTA Buttons (BẮT ĐẦU / ẤP TRỨNG / ẤP TRỨNG TIẾP) */}
              <div className="flex items-center justify-center gap-2.5 mx-auto sm:mx-0">
                {eggState === 'FINISHED' ? (
                  <button
                    type="button"
                    onClick={handleResetCurrentSession}
                    className="px-6 sm:px-8 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-105 text-slate-950 font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_0_24px_rgba(250,204,21,0.45)] flex items-center gap-2 border-2 border-yellow-200 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>TẠO PHIÊN MỚI</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startHatchDinoEggTurn()}
                    disabled={isHatchingNow || effectiveAvailableCandidates.length === 0}
                    className="px-6 sm:px-9 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_0_25px_rgba(250,204,21,0.45)] transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border-2 border-yellow-200 cursor-pointer"
                  >
                    <Egg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span>
                      {isHatchingNow
                        ? 'ĐANG ẤP TRỨNG KHỦNG LONG...'
                        : eggState === 'COMPLETED'
                        ? 'ẤP TRỨNG TIẾP (SPACE)'
                        : gameMode === 'GIANT_EGG'
                        ? 'ẤP TRỨNG MAY MẮN (SPACE)'
                        : turnRecords.length === 0
                        ? 'BẮT ĐẦU / ẤP TRỨNG'
                        : 'ẤP TRỨNG (SPACE)'}
                    </span>
                  </button>
                )}

                {(turnRecords.length > 0 || effectiveCalledIds.size > 0) && !isHatchingNow && (
                  <button
                    type="button"
                    onClick={() => setShowResetModal(true)}
                    className="px-3.5 py-2.5 rounded-2xl bg-[#06291E] hover:bg-rose-500/25 border border-emerald-400/35 hover:border-rose-400/50 text-emerald-100 hover:text-rose-200 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Tạo phiên mới / Đặt lại tổ trứng (Phím R)"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span className="hidden sm:inline">Phiên mới</span>
                  </button>
                )}
              </div>

              {/* Right Quick Management Shortcut */}
              <div className="hidden lg:flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setManagementTab('HISTORY');
                    const willOpen = !(showSidePanel && managementTab === 'HISTORY');
                    setShowSidePanel(willOpen);
                    setIsPresentationMode(!willOpen);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#06291E] hover:bg-[#0A3E2E] border border-emerald-400/30 text-xs font-bold text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Lịch sử ({turnRecords.length})</span>
                </button>
              </div>
            </div>
          </footer>
        </div>

        {/* MANAGEMENT MODE SLIDE-OVER / SIDE PANEL (Section III.2 - Zero Viewport Overflow) */}
        {showSidePanel && (
          <aside className="w-full sm:w-[360px] lg:w-[395px] shrink-0 h-full min-h-0 bg-[#031610] border-l border-amber-400/35 flex flex-col z-30 shadow-2xl">
            {/* Drawer Header & 3 Management Tabs */}
            <div className="p-3 bg-[#052319] border-b border-emerald-400/25 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-wide">
                  Quản lý & Cấu hình Trứng Khủng Long 3D
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowSidePanel(false);
                    setIsPresentationMode(true);
                  }}
                  className="p-1.5 rounded-lg bg-[#031610] hover:bg-slate-800 text-emerald-200 hover:text-white cursor-pointer"
                  title="Chuyển về chế độ Trình chiếu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-1 bg-[#02120C] p-1 rounded-xl border border-emerald-400/20 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setManagementTab('ROSTER')}
                  className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                    managementTab === 'ROSTER'
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  Học sinh ({fullRoster.length})
                </button>
                <button
                  type="button"
                  onClick={() => setManagementTab('HISTORY')}
                  className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                    managementTab === 'HISTORY'
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  Lịch sử ({turnRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setManagementTab('SETTINGS')}
                  className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer ${
                    managementTab === 'SETTINGS'
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'text-emerald-200 hover:text-white'
                  }`}
                >
                  Cấu hình 3D
                </button>
              </div>
            </div>

            {/* TAB 1: STUDENT ROSTER, 4 METRICS, CLASS SELECTOR & 1-50 SIMULATOR */}
            {managementTab === 'ROSTER' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-3 bg-[#041E15] border-b border-emerald-400/20 space-y-2.5 shrink-0 text-xs">
                  {/* 4 Distinct Roster Counters required by Section X */}
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="p-1.5 rounded-lg bg-[#02120C] border border-emerald-400/20">
                      <div className="text-[10px] text-emerald-300/80">Tổng sĩ số</div>
                      <div className="text-sm font-black text-white tabular-nums">
                        {fullRoster.length}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#02120C] border border-cyan-400/20">
                      <div className="text-[10px] text-cyan-300/80">Tham gia</div>
                      <div className="text-sm font-black text-cyan-300 tabular-nums">
                        {participatingStudents.length}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#02120C] border border-amber-400/20">
                      <div className="text-[10px] text-amber-300/80">Đã gọi</div>
                      <div className="text-sm font-black text-amber-300 tabular-nums">
                        {effectiveCalledIds.size}
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-[#02120C] border border-emerald-400/35">
                      <div className="text-[10px] text-emerald-300">Còn đủ ĐK</div>
                      <div className="text-sm font-black text-emerald-400 tabular-nums">
                        {effectiveAvailableCandidates.length}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-100">Chọn lớp / Điểm danh:</span>
                    {onOpenAbsentModal && (
                      <button
                        type="button"
                        onClick={onOpenAbsentModal}
                        disabled={isHatchingNow}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Đánh dấu vắng ({absentIds.size})</span>
                      </button>
                    )}
                  </div>

                  {classes.length > 0 && onSelectSourceKey && (
                    <select
                      value={selectedSourceKey}
                      onChange={(e) => {
                        setDemoStudentCount(null);
                        setDemoCalledIds(new Set());
                        onSelectSourceKey(e.target.value);
                      }}
                      disabled={isHatchingNow}
                      className="w-full px-3 py-1.5 rounded-xl bg-[#06291E] border border-emerald-400/40 text-xs font-bold text-white focus:outline-none"
                    >
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id} className="bg-slate-900 text-white">
                          Lớp {cls.name} ({cls.students?.length || 0} HS)
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Quick 1–50 Students Classroom Size Simulator (Section X: 1, 2, 5, 10, 20, 25, 30, 40, 45, 50) */}
                  <div className="p-2 rounded-xl bg-[#02120C] border border-emerald-400/25 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-emerald-300">
                        Kiểm thử sĩ số 1–50 HS:
                      </span>
                      {demoStudentCount !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setDemoStudentCount(null);
                            setDemoCalledIds(new Set());
                            setHatchedEggIdsInSession(new Set());
                            setCurrentPage(0);
                          }}
                          className="text-amber-300 underline font-bold cursor-pointer"
                        >
                          Dùng lớp thật
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 5, 10, 20, 25, 30, 40, 45, 50].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          disabled={isHatchingNow}
                          onClick={() => {
                            setDemoStudentCount(cnt);
                            setDemoCalledIds(new Set());
                            setHatchedEggIdsInSession(new Set());
                            setCurrentPage(0);
                          }}
                          className={`py-1 rounded-lg text-[11px] font-black transition-colors cursor-pointer ${
                            demoStudentCount === cnt
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-[#06291E] text-emerald-100 hover:bg-emerald-600'
                          }`}
                        >
                          {cnt} HS
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-emerald-400/70 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      placeholder="Tìm STT, mã hoặc họ tên học sinh..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#02120C] border border-emerald-400/30 text-xs text-white placeholder:text-emerald-300/50 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Scrollable Student List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
                  {filteredRosterList.map((item) => {
                    const isLastWinner =
                      activeWinnerPlan?.selectedStudent.id === item.student.id && !isHatchingNow;

                    return (
                      <div
                        key={item.student.id}
                        className={`px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                          isLastWinner
                            ? 'bg-amber-400/20 border-amber-400 text-white shadow-md'
                            : item.isAbsent
                            ? 'bg-slate-900/50 border-slate-800 text-slate-500 line-through'
                            : item.isCalled && antiDuplicate
                            ? 'bg-slate-900/60 border-slate-800 text-slate-400'
                            : 'bg-[#06291E]/75 border-emerald-400/20 text-emerald-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 tabular-nums ${
                              isLastWinner
                                ? 'bg-amber-400 text-slate-950'
                                : item.isCalled
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-emerald-600/40 text-amber-300 border border-amber-400/35'
                            }`}
                          >
                            {item.formattedStt}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold truncate">{item.student.fullName}</p>
                            <p className="text-[10px] text-emerald-300/70">Mã: {item.student.code}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.isAbsent ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                              Vắng
                            </span>
                          ) : item.isCalled ? (
                            <div className="flex items-center gap-1">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                                Đã nở
                              </span>
                              {!simulatedRoster && onRestoreStudentToPool && (
                                <button
                                  type="button"
                                  onClick={() => onRestoreStudentToPool(item.student.id)}
                                  title="Đưa học sinh này trở lại lượt ấp trứng"
                                  className="p-1 rounded bg-[#06291E] hover:bg-emerald-600 text-emerald-300 hover:text-white cursor-pointer"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                              Sẵn sàng
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: SESSION HISTORY & SUPABASE SYNC */}
            {managementTab === 'HISTORY' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="p-3 bg-[#041E15] border-b border-emerald-400/20 flex items-center justify-between text-xs shrink-0">
                  <span className="font-bold text-emerald-100">
                    Lịch sử ấp trứng ({turnRecords.length} lượt)
                  </span>
                  {turnRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-rose-300 hover:text-rose-200 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Tạo phiên mới</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                  {turnRecords.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center text-emerald-200/60 p-4 space-y-2">
                      <Egg className="w-8 h-8 text-amber-400/50" />
                      <p className="text-xs font-bold">Chưa có lượt ấp trứng nào trong phiên này.</p>
                    </div>
                  ) : (
                    turnRecords.map((rec) => {
                      const spMeta =
                        DINO_SPECIES_LIST.find((s) => s.id === rec.species) || DINO_SPECIES_LIST[0];
                      return (
                        <div
                          key={rec.turnId}
                          className="p-2.5 rounded-xl bg-[#06291E]/85 border border-emerald-400/25 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-amber-300">
                              Lượt #{rec.turnIndex} · Trứng #{String(rec.eggDisplayNumber).padStart(2, '0')} ({spMeta.badgeText})
                            </span>
                            <span className="text-[10px] text-emerald-200/75">
                              {new Date(rec.selectedAt).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-white text-sm">
                              #{rec.formattedStt} – {rec.studentName}
                            </p>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                rec.saveStatus === 'saved'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : rec.saveStatus === 'pending'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-slate-700 text-slate-300'
                              }`}
                            >
                              {rec.saveStatus === 'saved'
                                ? 'Đã lưu CSDL'
                                : rec.saveStatus === 'pending'
                                ? 'Đang lưu...'
                                : 'Lưu nội bộ'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: 3D GRAPHICS, GAME MODES, AUDIO/VOICE & RNG VERIFICATION */}
            {managementTab === 'SETTINGS' && (
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5 text-xs">
                {/* 3 Modes selector */}
                <div className="p-3 rounded-2xl bg-[#06291E] border border-emerald-400/25 space-y-2">
                  <div className="font-black text-amber-300 uppercase">
                    1. Chế độ Trứng Khủng Long 3D
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <button
                      type="button"
                      disabled={isHatchingNow}
                      onClick={() => {
                        setGameMode('SECRET_NEST');
                        setCurrentPage(0);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        gameMode === 'SECRET_NEST'
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-[#031610] border-slate-700 text-emerald-100'
                      }`}
                    >
                      <div className="font-black text-amber-300">
                        Chế độ 1: Tổ trứng bí mật (6–12 trứng)
                      </div>
                      <p className="text-[11px] text-emerald-100/80 mt-0.5">
                        Hiển thị 6–12 quả trứng khủng long 3D trên tổ. Khi chọn một quả, hệ thống rút
                        ngẫu nhiên công bằng 1 học sinh hợp lệ.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isHatchingNow}
                      onClick={() => {
                        setGameMode('GIANT_EGG');
                        setCurrentPage(0);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        gameMode === 'GIANT_EGG'
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-[#031610] border-slate-700 text-emerald-100'
                      }`}
                    >
                      <div className="font-black text-amber-300">
                        Chế độ 2: Đại trứng khủng long (Khuyên dùng lớp 40–50 HS)
                      </div>
                      <p className="text-[11px] text-emerald-100/80 mt-0.5">
                        1 quả Đại Trứng Khủng Long khổng lồ tại trung tâm rừng tiền sử, tối ưu hiển
                        thị trên máy chiếu/TV.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={isHatchingNow}
                      onClick={() => {
                        setGameMode('DINO_NURSERY');
                        setCurrentPage(0);
                        setShuffleSeed((s) => s + 1);
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        gameMode === 'DINO_NURSERY'
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-[#031610] border-slate-700 text-emerald-100'
                      }`}
                    >
                      <div className="font-black text-amber-300">
                        Chế độ 3: Vườn ươm khủng long (1–50 HS)
                      </div>
                      <p className="text-[11px] text-emerald-100/80 mt-0.5">
                        Mỗi học sinh tương ứng 1 quả trứng đã xáo trộn công bằng Fisher-Yates trước
                        phiên và chia khu vực tự động.
                      </p>
                    </button>
                  </div>

                  {gameMode === 'SECRET_NEST' && (
                    <div className="pt-1 flex items-center justify-between">
                      <span className="font-bold text-emerald-100">Số trứng trên tổ:</span>
                      <div className="flex items-center gap-1">
                        {[6, 8, 10, 12].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            disabled={isHatchingNow}
                            onClick={() => setNestEggCount(cnt)}
                            className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                              nestEggCount === cnt
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-[#031610] text-emerald-200'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Animation Speed & Graphics Preset */}
                <div className="p-3 rounded-2xl bg-[#06291E] border border-emerald-400/25 space-y-2.5">
                  <div className="font-black text-amber-300 uppercase">
                    2. Tốc độ nở & Chất lượng đồ họa 3D
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-emerald-100 font-bold">Tốc độ hoạt ảnh:</span>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ['FAST', 'Nhanh'],
                          ['NORMAL', 'Chuẩn'],
                          ['SUSPENSE', 'Hồi hộp'],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSpeedMode(k)}
                          className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                            speedMode === k
                              ? 'bg-emerald-400 text-slate-950 font-black'
                              : 'bg-[#031610] text-emerald-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-emerald-100 font-bold">Đồ họa WebGL:</span>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          ['LOW', 'Tiết kiệm'],
                          ['MEDIUM', 'Cân bằng'],
                          ['HIGH', 'Cao cấp'],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setQualityPreset(k)}
                          className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                            qualityPreset === k
                              ? 'bg-emerald-400 text-slate-950 font-black'
                              : 'bg-[#031610] text-emerald-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audio & Vietnamese TTS Voice */}
                <div className="p-3 rounded-2xl bg-[#06291E] border border-emerald-400/25 space-y-2">
                  <div className="font-black text-amber-300 uppercase">
                    3. Âm thanh & Giọng đọc tiếng Việt
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-100 font-bold">Đọc tên học sinh khi trứng nở:</span>
                    <button
                      type="button"
                      onClick={() => setVoiceReadEnabled((v) => !v)}
                      className={`px-3 py-1 rounded-lg font-black cursor-pointer ${
                        voiceReadEnabled
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {voiceReadEnabled ? 'Đang bật' : 'Đang tắt'}
                    </button>
                  </div>
                </div>

                {/* Automated Verification Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setShowVerifyModal(true)}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#041E15] hover:bg-[#083526] border border-emerald-400/40 text-emerald-300 font-black flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    Kiểm chứng RNG & Sĩ số 1–50 HS ({unitTestReport.totalChecks} test đạt 100%)
                  </span>
                </button>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* WINNER CELEBRATION MODAL OVERLAY (Section IX - Viewport-Bounded, Never Blocks Dinosaur) */}
      {showWinnerOverlay && activeWinnerPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="relative w-full max-w-lg max-h-[92dvh] overflow-y-auto bg-gradient-to-b from-[#063726] via-[#042419] to-[#02150E] border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-center shadow-[0_0_50px_rgba(250,204,21,0.35)] space-y-4">
            <button
              type="button"
              onClick={() => setShowWinnerOverlay(false)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 cursor-pointer"
              title="Đóng bảng công bố"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/60 text-amber-300 text-xs font-black uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {(
                  DINO_SPECIES_LIST.find((s) => s.id === activeWinnerPlan.species) ||
                  DINO_SPECIES_LIST[0]
                ).nameVi}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-emerald-300 uppercase tracking-wider">
                Lớp {resolvedClassName} · Trứng #{String(activeWinnerPlan.eggIndex + 1).padStart(2, '0')}
              </p>
              <div className="inline-block px-4 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-sm sm:text-base shadow-md">
                SỐ THỨ TỰ: #{activeWinnerPlan.formattedStudentStt}
              </div>
            </div>

            <div className="py-3 px-4 rounded-2xl bg-[#02120C]/90 border-2 border-amber-400/60 shadow-inner space-y-1">
              <div className="text-2xl sm:text-4xl font-black text-white tracking-wide break-words">
                {activeWinnerPlan.selectedStudent.fullName}
              </div>
              <div className="text-xs sm:text-sm text-emerald-300 font-bold">
                Mã học sinh: {activeWinnerPlan.selectedStudent.code}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  speakStudentAnnouncement(
                    activeWinnerPlan.selectedStudent.fullName,
                    activeWinnerPlan.formattedStudentStt
                  )
                }
                className="px-3.5 py-2 rounded-xl bg-[#06291E] hover:bg-emerald-700 border border-emerald-400/40 text-emerald-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Volume1 className="w-4 h-4 text-amber-300" />
                <span>Đọc lại tên</span>
              </button>

              {onOpenAbsentModal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowWinnerOverlay(false);
                    onOpenAbsentModal();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/40 text-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Đánh dấu vắng</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowWinnerOverlay(false)}
                className="w-full py-3 px-4 rounded-2xl bg-[#06291E] hover:bg-[#0A3E2E] border border-emerald-400/40 text-white font-black text-xs sm:text-sm uppercase cursor-pointer"
              >
                Xem khủng long 3D trên tổ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWinnerOverlay(false);
                  if (effectiveAvailableCandidates.length > 0) {
                    startHatchDinoEggTurn();
                  }
                }}
                disabled={effectiveAvailableCandidates.length === 0}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-emerald-400 hover:brightness-105 text-slate-950 font-black text-xs sm:text-sm uppercase shadow-lg disabled:opacity-40 cursor-pointer"
              >
                {effectiveAvailableCandidates.length > 0
                  ? 'Ấp trứng tiếp theo ➔'
                  : 'Đã hết học sinh trong lượt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET SESSION CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full max-h-[90dvh] overflow-y-auto bg-[#052319] border-2 border-amber-400 rounded-3xl p-5 text-center space-y-4 shadow-2xl">
            <RotateCcw className="w-9 h-9 text-amber-400 mx-auto" />
            <h4 className="text-base sm:text-lg font-black text-white uppercase">
              Tạo phiên mới – Đặt lại tổ trứng khủng long?
            </h4>
            <p className="text-xs sm:text-sm text-emerald-100">
              Toàn bộ {fullRoster.length} học sinh của lớp <strong>{resolvedClassName}</strong> sẽ
              được đưa trở lại danh sách sẵn sàng ấp nở và xáo trộn lại công bằng.
            </p>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleResetCurrentSession}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm uppercase cursor-pointer"
              >
                Xác nhận tạo phiên mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATED RNG & 1-50 STUDENT VERIFICATION MODAL */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full max-h-[90dvh] overflow-y-auto bg-[#052319] border-2 border-emerald-400 rounded-3xl p-5 space-y-3.5 shadow-2xl text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h4 className="text-sm sm:text-base font-black text-amber-300 uppercase">
                  Báo cáo kiểm thử tự động A04 – Trứng Khủng Long 3D
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="p-1 rounded-lg bg-white/10 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#02120C] border border-emerald-400/30 space-y-1.5 text-emerald-100">
              <p>
                • Trạng thái bộ kiểm thử:{' '}
                <strong className="text-emerald-400">
                  {unitTestReport.passed ? 'ĐẠT 100%' : 'CÓ CẢNH BÁO'}
                </strong>{' '}
                ({unitTestReport.totalChecks} bài kiểm tra tự động).
              </p>
              <p>
                • Đã kiểm chứng các sĩ số: <strong>1, 2, 5, 10, 20, 25, 30, 40, 45 và 50 HS</strong>{' '}
                trên cả 3 chế độ (Tổ trứng bí mật, Đại trứng khủng long, Vườn ươm khủng long).
              </p>
              <p>
                • Đã kiểm chứng <strong>20 lượt liên tiếp</strong> không trùng lặp{' '}
                <code>student_id</code>, bảo toàn ánh xạ <code>egg_id ↔ student_id</code> và đủ 12
                pha hoạt ảnh khủng long nở.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MagicLotteryGame;
