import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  SpaceRocket3DState,
  SpaceRocketDurationSec,
  SpaceRocketCameraMode,
  SpaceRocketHeatMode,
  SpaceRocketQualityPreset,
  RocketPadEntry,
  SpaceRocketTurnPlan,
  SpaceRocketTurnRecord,
  RocketFrameState,
  MAX_ROCKET_PADS,
  ROCKET_START_Y,
  ROCKET_FINISH_Y,
  COUNTDOWN_TOTAL_MS,
  FINISHING_SLOWMO_MS,
  computeRocketPadX,
  computeRocketPadZ,
  computeSpaceRocketHeatBuckets,
  buildSpaceRocketPreviewLineup,
  createFairSpaceRocketTurnPlan,
  evaluateSpaceRocketFrame,
  SpaceRocketTurnDeduplicator,
  formatSpaceRocketResultNote,
} from './spaceRocket3dMath';
import {
  SpaceRocketVoiceManager,
  RocketVoicePreferences,
  RocketVoiceAvailability,
  RocketVoiceGender,
  RocketVoiceRegion,
  loadRocketVoicePreferences,
} from './SpaceRocketVoiceManager';
import {
  Rocket,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  Trophy,
  History,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Camera,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Award,
  Clock,
  Sliders,
  ArrowLeft,
  UserCheck,
  Save,
  Eye,
  Music,
  Mic,
  MicOff,
  Sparkles,
} from 'lucide-react';

export interface SpaceRocket3DGameProps {
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

const LOCAL_RECORDS_PREFIX = 'taydo_a07_spacerocket3d_records_v1';

// Pre-allocated scratch math objects (zero allocations inside RAF loop)
const _tmpVecA = new THREE.Vector3();
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();
const _tmpColorC = new THREE.Color();
const _tmpMatrix = new THREE.Matrix4();
const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();

// Sky & Fog transition stops from Launchpad Day -> Stratosphere -> Deep Space
const SKY_PAD_COLOR = new THREE.Color('#2B7EC1');
const SKY_STRATO_COLOR = new THREE.Color('#113E79');
const SKY_SPACE_COLOR = new THREE.Color('#081B38');

// ============================================================================
// WEB AUDIO SPACE MUSIC & SOUND EFFECTS ENGINE (Zero external MP3/404 deps)
// Classroom-balanced, strictly initiated on user interaction
// ============================================================================
class SpaceRocketAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private thrusterSource: AudioBufferSourceNode | null = null;
  private thrusterGain: GainNode | null = null;
  private thrusterFilter: BiquadFilterNode | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;

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
    if (this.ctx && !this.noiseBuffer) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 2.0, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlockAndWarmup() {
    this.ensureContext();
  }

  public startThrusterLoop(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    this.stopThrusterLoop();
    try {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(220, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 0.35);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(ctx.currentTime);

      this.thrusterSource = src;
      this.thrusterFilter = filter;
      this.thrusterGain = gain;
    } catch {
      // Ignore Web Audio errors
    }
  }

  public updateThrusterIntensity(u: number, muted: boolean) {
    if (muted || !this.ctx || !this.thrusterFilter || !this.thrusterGain) return;
    try {
      const now = this.ctx.currentTime;
      const cutoff = 180 + u * 520;
      const vol = 0.045 + Math.sin(u * Math.PI) * 0.035;
      this.thrusterFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
      this.thrusterGain.gain.setTargetAtTime(vol, now, 0.08);
    } catch {
      // Ignore
    }
  }

  public stopThrusterLoop() {
    if (this.thrusterGain && this.ctx) {
      try {
        this.thrusterGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      } catch {
        // Ignore
      }
    }
    if (this.thrusterSource) {
      try {
        this.thrusterSource.stop(this.ctx ? this.ctx.currentTime + 0.14 : 0);
      } catch {
        // Ignore
      }
      this.thrusterSource = null;
    }
    this.thrusterFilter = null;
    this.thrusterGain = null;
  }

  public startSpaceMusicLoop(mode: 'AMBIENT' | 'TENSE' | 'OFF', muted: boolean) {
    this.stopSpaceMusicLoop();
    if (muted || mode === 'OFF') return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const scaleAmbient = [261.63, 329.63, 392.0, 493.88, 523.25, 392.0];
    const scaleTense = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25];
    const intervalMs = mode === 'TENSE' ? 420 : 880;

    const triggerNote = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      try {
        const now = this.ctx.currentTime;
        const seq = mode === 'TENSE' ? scaleTense : scaleAmbient;
        const freq = seq[this.musicStep % seq.length];
        this.musicStep++;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = mode === 'TENSE' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now);

        const peak = mode === 'TENSE' ? 0.035 : 0.025;
        const dur = mode === 'TENSE' ? 0.36 : 0.82;
        gain.gain.setValueAtTime(0.0005, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.04);
      } catch {
        // Ignore
      }
    };

    triggerNote();
    this.musicTimer = window.setInterval(triggerNote, intervalMs);
  }

  public stopSpaceMusicLoop() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playCountdownBeep(step: 3 | 2 | 1, muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const freq = step === 3 ? 440 : step === 2 ? 554.37 : 659.25;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore
    }
  }

  public playLaunchHornAndIgnition(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      // Launch command klaxon + ignition pulse
      [587.33, 880.0].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(i === 0 ? 0.14 : 0.08, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.58);
      });
    } catch {
      // Ignore
    }
  }

  public playWarpBoostWhoosh(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    try {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(1400, now + 0.45);
      filter.Q.setValueAtTime(1.8, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      src.stop(now + 0.68);
    } catch {
      // Ignore
    }
  }

  public playGateAndVictoryFanfare(muted: boolean) {
    if (muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
      fanfare.forEach((freq, idx) => {
        const start = now + idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx >= 3 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.11, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + (idx === 5 ? 0.8 : 0.34));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.85);
      });
    } catch {
      // Ignore
    }
  }

  public dispose() {
    this.stopThrusterLoop();
    this.stopSpaceMusicLoop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.noiseBuffer = null;
  }
}

// ============================================================================
// PROCEDURAL CANVAS TEXTURES (High-DPI SRGBColorSpace)
// ============================================================================
function createLaunchDeckTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0B1D39';
  ctx.fillRect(0, 0, 512, 512);

  // Clean aerospace concrete panel grid + cyan markings
  ctx.strokeStyle = 'rgba(0, 200, 255, 0.22)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Subtle surface micro-speckle for concrete realism
  for (let i = 0; i < 1600; i++) {
    const px = (i * 97) % 512;
    const py = (i * 151) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(px, py, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createPadNumberTexture(
  padNumber: number,
  accentHex: string,
  badgeHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#081B38';
  ctx.fillRect(0, 0, 192, 192);

  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 14;
  ctx.strokeRect(12, 12, 168, 168);

  ctx.fillStyle = badgeHex;
  ctx.beginPath();
  ctx.arc(96, 96, 56, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 72px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(String(padNumber), 96, 100);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createRocketNameplateTexture(
  racer: RocketPadEntry,
  isWinnerHighlight: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 152;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = isWinnerHighlight ? '#FFD54F' : 'rgba(8, 27, 56, 0.94)';
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 26);
  ctx.fill();

  ctx.lineWidth = isWinnerHighlight ? 7 : 5;
  ctx.strokeStyle = isWinnerHighlight ? '#FFFFFF' : racer.palette.finHex;
  ctx.stroke();

  // Rocket Pad Badge
  ctx.fillStyle = racer.palette.badgeHex;
  ctx.beginPath();
  ctx.roundRect(26, 28, 94, 94, 22);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 42px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${racer.padNumber}`, 73, 76);

  // Astronaut Student Name & STT/Code
  ctx.textAlign = 'left';
  ctx.fillStyle = isWinnerHighlight ? '#081B38' : '#FFFFFF';
  ctx.font = '800 35px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(racer.displayLabel, 136, 58, 436);

  ctx.fillStyle = isWinnerHighlight ? '#113E79' : '#00C8FF';
  ctx.font = '700 25px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`STT #${racer.formattedStt} · ${racer.safeCode}`, 136, 104, 436);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function drawMissionScoreboardCanvas(
  ctx: CanvasRenderingContext2D,
  statusText: string,
  timerText: string,
  leaderText: string
) {
  const w = 1024;
  const h = 320;
  ctx.fillStyle = '#081B38';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#00C8FF';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.fillStyle = '#113E79';
  ctx.fillRect(24, 24, w - 48, 72);

  ctx.fillStyle = '#FFD54F';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TÂY ĐÔ SPACEPORT · TÊN LỬA 3D', 46, 62);

  ctx.fillStyle = '#00C8FF';
  ctx.textAlign = 'right';
  ctx.font = '800 29px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(statusText, w - 46, 62);

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '900 84px monospace';
  ctx.fillText(timerText, w / 2, 174);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 33px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(leaderText, w / 2, 258, w - 90);
}

// ============================================================================
// ARTICULATED MULTI-PART 3D SPACE ROCKET RIG (10+ Aerospace Subcomponents)
// Bottom nozzle rests cleanly on launch pad deck (y = 0)
// ============================================================================
interface RocketRig3D {
  root: THREE.Group;
  craftGroup: THREE.Group;
  flameOuter: THREE.Mesh;
  flameInner: THREE.Mesh;
  thrusterGlow: THREE.Mesh;
  nameSprite: THREE.Sprite;
  nameMaterial: THREE.SpriteMaterial;
  padHaloRing: THREE.Mesh;
  racer: RocketPadEntry;
}

interface SharedRocketGeometries {
  mainHull: THREE.CylinderGeometry;
  noseCone: THREE.LatheGeometry;
  collarRing: THREE.CylinderGeometry;
  finGeo: THREE.ExtrudeGeometry;
  boosterTube: THREE.CylinderGeometry;
  boosterNose: THREE.ConeGeometry;
  portholeFrame: THREE.TorusGeometry;
  portholeGlass: THREE.SphereGeometry;
  engineNozzle: THREE.CylinderGeometry;
  thrusterCore: THREE.SphereGeometry;
  flameOuter: THREE.ConeGeometry;
  flameInner: THREE.ConeGeometry;
  badgePlate: THREE.BoxGeometry;
  padHalo: THREE.RingGeometry;
}

function createSharedRocketGeometries(): SharedRocketGeometries {
  // Smooth ogive nose profile via LatheGeometry
  const nosePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const r = Math.max(0.015, Math.pow(1 - t, 0.62) * 0.50);
    const y = t * 1.38;
    nosePts.push(new THREE.Vector2(r, y));
  }
  const noseCone = new THREE.LatheGeometry(nosePts, 24);

  // Swept aerospace fin via beveled ExtrudeGeometry
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.68, -0.34);
  finShape.lineTo(0.68, 0.36);
  finShape.lineTo(0, 1.05);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 2,
  });
  finGeo.translate(0, 0, -0.03);

  const flameOuter = new THREE.ConeGeometry(0.42, 2.35, 16);
  flameOuter.rotateX(Math.PI);
  flameOuter.translate(0, -1.18, 0);

  const flameInner = new THREE.ConeGeometry(0.24, 1.55, 14);
  flameInner.rotateX(Math.PI);
  flameInner.translate(0, -0.78, 0);

  return {
    mainHull: new THREE.CylinderGeometry(0.49, 0.52, 2.65, 24),
    noseCone,
    collarRing: new THREE.CylinderGeometry(0.515, 0.515, 0.34, 24),
    finGeo,
    boosterTube: new THREE.CylinderGeometry(0.15, 0.16, 1.55, 14),
    boosterNose: new THREE.ConeGeometry(0.15, 0.38, 14),
    portholeFrame: new THREE.TorusGeometry(0.22, 0.045, 10, 20),
    portholeGlass: new THREE.SphereGeometry(0.19, 16, 12),
    engineNozzle: new THREE.CylinderGeometry(0.22, 0.42, 0.48, 20, 1, true),
    thrusterCore: new THREE.SphereGeometry(0.22, 12, 10),
    flameOuter,
    flameInner,
    badgePlate: new THREE.BoxGeometry(0.52, 0.52, 0.04),
    padHalo: new THREE.RingGeometry(1.05, 1.28, 32),
  };
}

function createArticulatedRocketRig(
  racer: RocketPadEntry,
  geos: SharedRocketGeometries,
  isWinnerHighlight: boolean,
  maxAnisotropy: number
): RocketRig3D {
  const root = new THREE.Group();
  root.position.set(racer.padX, ROCKET_START_Y, racer.padZ);

  const craftGroup = new THREE.Group();
  root.add(craftGroup);

  const hullMat = new THREE.MeshStandardMaterial({
    color: racer.palette.hullHex,
    roughness: 0.28,
    metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: racer.palette.accentHex,
    roughness: 0.32,
    metalness: 0.22,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: racer.palette.finHex,
    roughness: 0.26,
    metalness: 0.36,
  });
  const titaniumMat = new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.35,
    metalness: 0.78,
    side: THREE.DoubleSide,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: '#E2E8F0',
    roughness: 0.16,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#00C8FF',
    emissive: '#0284C7',
    emissiveIntensity: 0.65,
    roughness: 0.1,
    metalness: 0.25,
  });

  // 1. Main Cylindrical Fuselage (bottom sits above nozzle y = 0.48)
  const hull = new THREE.Mesh(geos.mainHull, hullMat);
  hull.position.set(0, 1.82, 0);
  hull.castShadow = true;
  hull.receiveShadow = true;
  craftGroup.add(hull);

  // 2. Color Stage Collar Band
  const collar = new THREE.Mesh(geos.collarRing, accentMat);
  collar.position.set(0, 2.86, 0);
  collar.castShadow = true;
  craftGroup.add(collar);

  // 3. Aerodynamic Ogive Nose Cone
  const nose = new THREE.Mesh(geos.noseCone, accentMat);
  nose.position.set(0, 3.12, 0);
  nose.castShadow = true;
  craftGroup.add(nose);

  // 4. Cockpit Glass Porthole & Chrome Frame (Front facing camera +Z)
  const frame = new THREE.Mesh(geos.portholeFrame, chromeMat);
  frame.position.set(0, 2.26, 0.48);
  craftGroup.add(frame);

  const glass = new THREE.Mesh(geos.portholeGlass, glassMat);
  glass.scale.set(1, 1, 0.45);
  glass.position.set(0, 2.26, 0.47);
  craftGroup.add(glass);

  // 5. Four Swept Stabilizer Fins around fuselage
  for (let f = 0; f < 4; f++) {
    const finPivot = new THREE.Group();
    finPivot.rotation.y = (f * Math.PI) / 2 + Math.PI / 4;
    const fin = new THREE.Mesh(geos.finGeo, finMat);
    fin.position.set(0.46, 0.62, 0);
    fin.castShadow = true;
    finPivot.add(fin);
    craftGroup.add(finPivot);
  }

  // 6. Twin Side Solid Rocket Boosters
  [-0.58, 0.58].forEach((bx) => {
    const bTube = new THREE.Mesh(geos.boosterTube, hullMat);
    bTube.position.set(bx, 1.25, 0);
    bTube.castShadow = true;
    craftGroup.add(bTube);

    const bCone = new THREE.Mesh(geos.boosterNose, finMat);
    bCone.position.set(bx, 2.21, 0);
    craftGroup.add(bCone);
  });

  // 7. Pad Number Identification Plaque on Fuselage
  const numTex = createPadNumberTexture(
    racer.padNumber,
    racer.palette.accentHex,
    racer.palette.badgeHex
  );
  const badgeMat = new THREE.MeshStandardMaterial({
    map: numTex,
    roughness: 0.35,
  });
  const badgeFront = new THREE.Mesh(geos.badgePlate, badgeMat);
  badgeFront.position.set(0, 1.38, 0.51);
  craftGroup.add(badgeFront);

  // 8. Flared Engine Bell Nozzle & Glowing Thruster Core
  const nozzle = new THREE.Mesh(geos.engineNozzle, titaniumMat);
  nozzle.position.set(0, 0.28, 0);
  craftGroup.add(nozzle);

  const thrusterCoreMat = new THREE.MeshBasicMaterial({
    color: racer.palette.flameCoreHex,
    transparent: true,
    opacity: 0.45,
  });
  const thrusterGlow = new THREE.Mesh(geos.thrusterCore, thrusterCoreMat);
  thrusterGlow.position.set(0, 0.14, 0);
  craftGroup.add(thrusterGlow);

  // 9. Animated Layered Exhaust Flame Cones (Outer Plasma + Inner Hot Core)
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: racer.palette.flameOuterHex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameOuter = new THREE.Mesh(geos.flameOuter, flameOuterMat);
  flameOuter.position.set(0, 0.12, 0);
  flameOuter.scale.set(0.01, 0.01, 0.01);
  craftGroup.add(flameOuter);

  const flameInnerMat = new THREE.MeshBasicMaterial({
    color: racer.palette.flameCoreHex,
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flameInner = new THREE.Mesh(geos.flameInner, flameInnerMat);
  flameInner.position.set(0, 0.12, 0);
  flameInner.scale.set(0.01, 0.01, 0.01);
  craftGroup.add(flameInner);

  // 10. Leader / Winner Halo Ring
  const haloMat = new THREE.MeshBasicMaterial({
    color: isWinnerHighlight ? '#FFD54F' : racer.palette.finHex,
    transparent: true,
    opacity: isWinnerHighlight ? 0.92 : 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const padHaloRing = new THREE.Mesh(geos.padHalo, haloMat);
  padHaloRing.rotation.x = -Math.PI / 2;
  padHaloRing.position.set(0, 0.06, 0);
  root.add(padHaloRing);

  // 11. Crisp Astronaut Nameplate Sprite (Always tracks rocket cleanly, never obscured)
  const nameTex = createRocketNameplateTexture(racer, isWinnerHighlight, maxAnisotropy);
  const nameMaterial = new THREE.SpriteMaterial({
    map: nameTex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const nameSprite = new THREE.Sprite(nameMaterial);
  nameSprite.scale.set(3.15, 0.80, 1);
  nameSprite.position.set(0, 5.25, 0);
  root.add(nameSprite);

  return {
    root,
    craftGroup,
    flameOuter,
    flameInner,
    thrusterGlow,
    nameSprite,
    nameMaterial,
    padHaloRing,
    racer,
  };
}

function disposeSingleMaterial(m: THREE.Material) {
  const anyMat = m as unknown as Record<string, unknown>;
  for (const key of ['map', 'emissiveMap', 'alphaMap', 'roughnessMap', 'metalnessMap', 'normalMap']) {
    const tex = anyMat[key] as THREE.Texture | undefined;
    if (tex && typeof tex.dispose === 'function') {
      tex.dispose();
    }
  }
  m.dispose();
}

function disposeObject3DMaterialsAndTextures(obj: THREE.Object3D) {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
      mesh.geometry.dispose();
    }
    const mat = (mesh as { material?: THREE.Material | THREE.Material[] }).material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => disposeSingleMaterial(m));
    } else if (mat) {
      disposeSingleMaterial(mat);
    }
  });
}

// ============================================================================
// 2D CANVAS SPACE LAUNCH FALLBACK (When WebGL unavailable or context lost)
// ============================================================================
function draw2DFallbackSpaceLaunch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineup: RocketPadEntry[],
  frames: RocketFrameState[] | null,
  raceState: SpaceRocket3DState,
  countdownLabel: string,
  elapsedSec: number,
  durationSec: number,
  winnerPadIndex: number
) {
  ctx.clearRect(0, 0, width, height);

  // Space-to-sky gradient backdrop
  const spaceGrad = ctx.createLinearGradient(0, 0, 0, height);
  spaceGrad.addColorStop(0, '#081B38');
  spaceGrad.addColorStop(0.55, '#113E79');
  spaceGrad.addColorStop(1, '#1E5B9A');
  ctx.fillStyle = spaceGrad;
  ctx.fillRect(0, 0, width, height);

  // Crisp stars in upper cosmos
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  for (let s = 0; s < 55; s++) {
    const sx = ((s * 173 + 29) % 1000) * (width / 1000);
    const sy = ((s * 97 + 17) % 520) * (height / 1000);
    const r = (s % 2) + 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const gateY = Math.round(height * 0.14);
  const padY = Math.round(height * 0.87);
  const climbSpan = padY - gateY;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 16px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'TÂY ĐÔ SPACEPORT · BỆ PHÓNG TÊN LỬA 2D AN TOÀN (WEBGL FALLBACK)',
    width / 2,
    28
  );

  // Space Finish Gate Band
  ctx.strokeStyle = '#00C8FF';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 6]);
  ctx.beginPath();
  ctx.moveTo(40, gateY);
  ctx.lineTo(width - 40, gateY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#FFD54F';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillText('CỔNG KHÔNG GIAN · ĐÍCH', width / 2, gateY - 10);

  // Launchpad floor
  ctx.fillStyle = '#0E2448';
  ctx.fillRect(0, padY + 8, width, height - padY);

  const count = Math.max(1, lineup.length);
  const colW = (width - 80) / count;

  lineup.forEach((racer, idx) => {
    const cx = 40 + colW * (idx + 0.5);
    const progress = frames && frames[idx] ? frames[idx].progress : 0;
    const ry = padY - progress * climbSpan;

    // Launch Pad Base
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 24, padY + 2, 48, 10);

    // Exhaust Flame during launch/flight
    if (
      raceState === 'COUNTDOWN' ||
      raceState === 'LAUNCHING' ||
      raceState === 'FLYING' ||
      raceState === 'FINISHING'
    ) {
      const fLen = raceState === 'COUNTDOWN' ? 14 : 26 + ((performance.now() * 0.05 + idx * 7) % 12);
      ctx.fillStyle = racer.palette.flameOuterHex;
      ctx.beginPath();
      ctx.moveTo(cx - 8, ry + 12);
      ctx.lineTo(cx, ry + 12 + fLen);
      ctx.lineTo(cx + 8, ry + 12);
      ctx.closePath();
      ctx.fill();
    }

    // Winner ring
    if ((raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerPadIndex) {
      ctx.strokeStyle = '#FFD54F';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, ry - 8, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Vector 2D Rocket
    ctx.fillStyle = racer.palette.finHex;
    ctx.beginPath();
    ctx.moveTo(cx - 10, ry + 6);
    ctx.lineTo(cx - 19, ry + 16);
    ctx.lineTo(cx - 10, ry + 12);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 10, ry + 6);
    ctx.lineTo(cx + 19, ry + 16);
    ctx.lineTo(cx + 10, ry + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(cx - 10, ry - 18, 20, 30, 6);
    ctx.fill();

    ctx.fillStyle = racer.palette.accentHex;
    ctx.beginPath();
    ctx.moveTo(cx - 10, ry - 16);
    ctx.lineTo(cx, ry - 34);
    ctx.lineTo(cx + 10, ry - 16);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#00C8FF';
    ctx.beginPath();
    ctx.arc(cx, ry - 5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Student Nameplate
    const tagText = `${racer.padNumber} · ${racer.displayLabel}`;
    ctx.font = '700 11px "Plus Jakarta Sans", system-ui, sans-serif';
    const textW = Math.min(colW - 6, ctx.measureText(tagText).width + 14);
    const tx = Math.max(8, Math.min(width - textW - 8, cx - textW / 2));
    const ty = Math.min(padY + 14, ry + 26);

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerPadIndex
        ? '#FFD54F'
        : 'rgba(8, 27, 56, 0.92)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, textW, 20, 6);
    ctx.fill();

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerPadIndex
        ? '#081B38'
        : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(tagText, tx + textW / 2, ty + 14, textW - 8);
  });

  if (raceState === 'COUNTDOWN' && countdownLabel) {
    ctx.fillStyle = 'rgba(8, 27, 56, 0.88)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 125, height / 2 - 50, 250, 100, 22);
    ctx.fill();
    ctx.strokeStyle = '#FFD54F';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(countdownLabel, width / 2, height / 2 + 15);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${elapsedSec.toFixed(1)}s / ${durationSec}s`, width - 18, height - 14);
}

// ============================================================================
// MAIN COMPONENT: A07 SPACE ROCKET 3D PREMIUM 2027
// ============================================================================
export const SpaceRocket3DGame: React.FC<SpaceRocket3DGameProps> = ({
  availableCandidates,
  allCandidates,
  absentIds,
  calledSessionIds,
  antiDuplicate = true,
  onToggleAntiDuplicate,
  onResetSession,
  classes = [],
  selectedSourceKey = '',
  onSelectSourceKey,
  resolvedClassName = 'Lớp học',
  teacherId = 'local_teacher',
  teacherName = 'Giáo viên',
  userRole = 'teacher',
  isFullscreen = false,
  onToggleFullscreen,
  onCloseGame,
  isMuted,
  onToggleMute,
  onOpenAbsentModal,
  onOpenHistoryModal,
  onPick,
  onUpdateLatestNote,
}) => {
  const fullRoster = useMemo(
    () => (allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates),
    [allCandidates, availableCandidates]
  );

  // Deduplicated eligible pool
  const eligibleStudents = useMemo(() => {
    const seen = new Set<string>();
    const out: StudentCandidate[] = [];
    for (const s of availableCandidates) {
      if (!s || !s.id) continue;
      if (absentIds?.has(s.id)) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
    return out;
  }, [availableCandidates, absentIds]);

  const [flightState, setFlightState] = useState<SpaceRocket3DState>(
    eligibleStudents.length > 0 ? 'READY' : 'IDLE'
  );
  const [durationSec, setDurationSec] = useState<SpaceRocketDurationSec>(10);
  const [cameraMode, setCameraMode] = useState<SpaceRocketCameraMode>('LAUNCHPAD_WIDE');
  const [autoCamera, setAutoCamera] = useState<boolean>(true);
  const [heatMode, setHeatMode] = useState<SpaceRocketHeatMode>('REPRESENTATIVE_FAIR');
  const [heatIndex, setHeatIndex] = useState<number>(0);
  const [qualityPreset, setQualityPreset] = useState<SpaceRocketQualityPreset>('HIGH');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [voicePrefs, setVoicePrefs] = useState<RocketVoicePreferences>(() =>
    loadRocketVoicePreferences()
  );
  const [voiceAvailability, setVoiceAvailability] = useState<RocketVoiceAvailability>({
    supported: false,
    hasVietnameseVoice: false,
    vietnameseVoiceCount: 0,
    selectedVoiceName: null,
    selectedVoiceLang: null,
  });
  const [voiceCaption, setVoiceCaption] = useState<string>('');
  const [showVoicePanel, setShowVoicePanel] = useState<boolean>(false);

  const [countdownLabel, setCountdownLabel] = useState<string>('');
  const [elapsedDisplaySec, setElapsedDisplaySec] = useState<number>(0);
  const [liveTop3, setLiveTop3] = useState<
    Array<{ padNumber: number; displayLabel: string; progressPct: number; badgeHex: string }>
  >([]);

  // Result & Note/Bonus State
  const [activeWinnerEntry, setActiveWinnerEntry] = useState<RocketPadEntry | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [resultNote, setResultNote] = useState<string>('');
  const [noteSaveFeedback, setNoteSaveFeedback] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'idle' | 'saving' | 'saved' | 'local_only' | 'error'
  >('idle');
  const [showRecordsDrawer, setShowRecordsDrawer] = useState<boolean>(false);
  const [rendererFallback2D, setRendererFallback2D] = useState<boolean>(false);

  const recordsStorageKey = `${LOCAL_RECORDS_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`;
  const [turnRecords, setTurnRecords] = useState<SpaceRocketTurnRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      return raw ? (JSON.parse(raw) as SpaceRocketTurnRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      setTurnRecords(raw ? (JSON.parse(raw) as SpaceRocketTurnRecord[]) : []);
    } catch {
      setTurnRecords([]);
    }
  }, [recordsStorageKey]);

  const persistLocalRecords = useCallback(
    (next: SpaceRocketTurnRecord[]) => {
      setTurnRecords(next);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(recordsStorageKey, JSON.stringify(next.slice(0, 60)));
        } catch {
          // Ignore quota
        }
      }
    },
    [recordsStorageKey]
  );

  const heatBuckets = useMemo(
    () => computeSpaceRocketHeatBuckets(eligibleStudents, MAX_ROCKET_PADS),
    [eligibleStudents]
  );
  const safeHeatIndex = useMemo(
    () => (heatBuckets.length === 0 ? 0 : Math.max(0, Math.min(heatIndex, heatBuckets.length - 1))),
    [heatBuckets.length, heatIndex]
  );

  const previewData = useMemo(
    () =>
      buildSpaceRocketPreviewLineup({
        eligibleStudents,
        fullRoster,
        heatMode,
        heatIndex: safeHeatIndex,
      }),
    [eligibleStudents, fullRoster, heatMode, safeHeatIndex]
  );

  // Refs for deterministic monotonic loop & instant safe cancellation
  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioEngineRef = useRef<SpaceRocketAudioEngine | null>(null);
  const voiceManagerRef = useRef<SpaceRocketVoiceManager | null>(null);
  const deduplicatorRef = useRef<SpaceRocketTurnDeduplicator>(new SpaceRocketTurnDeduplicator());

  const flightStateRef = useRef<SpaceRocket3DState>(flightState);
  const activeSessionIdRef = useRef<string | null>(null);
  const activePlanRef = useRef<SpaceRocketTurnPlan | null>(null);
  const countdownStartPerfRef = useRef<number>(0);
  const countdownLastStepRef = useRef<number>(-1);
  const flightStartPerfRef = useRef<number>(0);
  const finishingStartPerfRef = useRef<number>(0);
  const boostAnnouncedRef = useRef<boolean>(false);
  const warpSoundPlayedRef = useRef<boolean>(false);
  const lastHudUpdatePerfRef = useRef<number>(0);
  const framesScratchRef = useRef<RocketFrameState[]>([]);
  const noteTimeoutRef = useRef<number | null>(null);

  const cameraModeRef = useRef<SpaceRocketCameraMode>(cameraMode);
  const autoCameraRef = useRef<boolean>(autoCamera);
  const isMutedRef = useRef<boolean>(isMuted);
  const musicEnabledRef = useRef<boolean>(musicEnabled);
  const qualityPresetRef = useRef<SpaceRocketQualityPreset>(qualityPreset);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const previewLineupRef = useRef<RocketPadEntry[]>(previewData.lineup);
  const durationSecRef = useRef<SpaceRocketDurationSec>(durationSec);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    flightStateRef.current = flightState;
  }, [flightState]);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);
  useEffect(() => {
    autoCameraRef.current = autoCamera;
  }, [autoCamera]);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      audioEngineRef.current?.stopThrusterLoop();
      audioEngineRef.current?.stopSpaceMusicLoop();
      voiceManagerRef.current?.cancel();
    }
  }, [isMuted]);
  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
    if (!musicEnabled) {
      audioEngineRef.current?.stopSpaceMusicLoop();
    }
  }, [musicEnabled]);
  useEffect(() => {
    qualityPresetRef.current = qualityPreset;
  }, [qualityPreset]);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  useEffect(() => {
    previewLineupRef.current = previewData.lineup;
  }, [previewData.lineup]);
  useEffect(() => {
    durationSecRef.current = durationSec;
  }, [durationSec]);

  // Initialize strict Vietnamese Voice Manager
  useEffect(() => {
    const vm = new SpaceRocketVoiceManager(voicePrefs);
    voiceManagerRef.current = vm;
    const unsub = vm.subscribe((avail) => {
      if (isMountedRef.current) {
        setVoiceAvailability(avail);
      }
    });
    return () => {
      unsub();
      vm.dispose();
      voiceManagerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    voiceManagerRef.current?.setPreferences(voicePrefs);
  }, [voicePrefs]);

  const speakClassroomLine = useCallback((line: string) => {
    setVoiceCaption(line);
    voiceManagerRef.current?.speakVietnamese(line, isMutedRef.current);
  }, []);

  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    rocketGroupContainer: THREE.Group | null;
    rocketRigs: RocketRig3D[];
    sharedRocketGeos: SharedRocketGeometries | null;
    trafficRedMat: THREE.MeshStandardMaterial | null;
    trafficAmberMat: THREE.MeshStandardMaterial | null;
    trafficGreenMat: THREE.MeshStandardMaterial | null;
    gantryArms: THREE.Group[];
    scoreboardCtx: CanvasRenderingContext2D | null;
    scoreboardTex: THREE.CanvasTexture | null;
    starPoints: THREE.Points | null;
    starMat: THREE.PointsMaterial | null;
    planetGroup: THREE.Group | null;
    satelliteGroup: THREE.Group | null;
    finishGateGroup: THREE.Group | null;
    finishRingOuter: THREE.Mesh | null;
    finishRingInner: THREE.Mesh | null;
    trophyGroup: THREE.Group | null;
    victorySpotLight: THREE.SpotLight | null;
    smokeInstanced: THREE.InstancedMesh | null;
    smokeSeeds: Float32Array;
    confettiInstanced: THREE.InstancedMesh | null;
    confettiStates: Array<{
      x: number;
      y: number;
      z: number;
      vy: number;
      vx: number;
      vz: number;
      rotSpeed: number;
    }>;
    camPos: THREE.Vector3;
    camTarget: THREE.Vector3;
    isSoftwareGl: boolean;
    maxAnisotropy: number;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    rocketGroupContainer: null,
    rocketRigs: [],
    sharedRocketGeos: null,
    trafficRedMat: null,
    trafficAmberMat: null,
    trafficGreenMat: null,
    gantryArms: [],
    scoreboardCtx: null,
    scoreboardTex: null,
    starPoints: null,
    starMat: null,
    planetGroup: null,
    satelliteGroup: null,
    finishGateGroup: null,
    finishRingOuter: null,
    finishRingInner: null,
    trophyGroup: null,
    victorySpotLight: null,
    smokeInstanced: null,
    smokeSeeds: new Float32Array(0),
    confettiInstanced: null,
    confettiStates: [],
    camPos: new THREE.Vector3(0, 7.2, 22.5),
    camTarget: new THREE.Vector3(0, 3.0, 0),
    isSoftwareGl: false,
    maxAnisotropy: 4,
  });

  const rebuild3DRocketsForLineup = useCallback(
    (lineup: RocketPadEntry[], highlightedWinnerId: string | null) => {
      const { rocketGroupContainer, rocketRigs, sharedRocketGeos, maxAnisotropy } =
        threeRefs.current;
      if (!rocketGroupContainer || !sharedRocketGeos) return;

      rocketRigs.forEach((rig) => {
        rig.root.traverse((child) => {
          const mat = (child as { material?: THREE.Material | THREE.Material[] }).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => disposeSingleMaterial(m));
          } else if (mat) {
            disposeSingleMaterial(mat);
          }
        });
        rocketGroupContainer.remove(rig.root);
      });

      const nextRigs: RocketRig3D[] = lineup.map((racer) => {
        const rig = createArticulatedRocketRig(
          racer,
          sharedRocketGeos,
          Boolean(highlightedWinnerId && racer.student.id === highlightedWinnerId),
          maxAnisotropy
        );
        rocketGroupContainer.add(rig.root);
        return rig;
      });
      threeRefs.current.rocketRigs = nextRigs;
    },
    []
  );

  // Sync pad lineup when eligible roster changes in IDLE / READY
  useEffect(() => {
    if (flightStateRef.current === 'IDLE' || flightStateRef.current === 'READY') {
      const nextState: SpaceRocket3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      flightStateRef.current = nextState;
      setFlightState(nextState);
      rebuild3DRocketsForLineup(previewData.lineup, null);
      setLiveTop3(
        previewData.lineup.slice(0, 3).map((r) => ({
          padNumber: r.padNumber,
          displayLabel: r.displayLabel,
          progressPct: 0,
          badgeHex: r.palette.badgeHex,
        }))
      );
    }
  }, [eligibleStudents.length, previewData.lineup, rebuild3DRocketsForLineup]);

  // Hard reset when class/source switches (prevents stale roster or orphaned launch)
  const prevSourceKeyRef = useRef(selectedSourceKey);
  useEffect(() => {
    if (prevSourceKeyRef.current !== selectedSourceKey) {
      prevSourceKeyRef.current = selectedSourceKey;
      activeSessionIdRef.current = null;
      activePlanRef.current = null;
      countdownLastStepRef.current = -1;
      boostAnnouncedRef.current = false;
      warpSoundPlayedRef.current = false;
      audioEngineRef.current?.stopThrusterLoop();
      audioEngineRef.current?.stopSpaceMusicLoop();
      voiceManagerRef.current?.cancel();
      setHeatIndex(0);
      setActiveWinnerEntry(null);
      setActiveSessionId(null);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('idle');
      setCountdownLabel('');
      setElapsedDisplaySec(0);
      setVoiceCaption('');
      const nextState: SpaceRocket3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      flightStateRef.current = nextState;
      setFlightState(nextState);
      rebuild3DRocketsForLineup(previewData.lineup, null);
    }
  }, [selectedSourceKey, eligibleStudents.length, previewData.lineup, rebuild3DRocketsForLineup]);

  // Supabase cloud logging (Authenticated Teacher only; Guest/KHKT skips cleanly)
  const syncTurnToSupabase = useCallback(
    async (
      plan: SpaceRocketTurnPlan,
      winnerEntry: RocketPadEntry,
      points: number,
      noteText: string
    ): Promise<'saved' | 'local_only' | 'error'> => {
      if (
        !isSupabaseConfigured ||
        selectedSourceKey === 'guest_mode' ||
        teacherId.startsWith('gsess_') ||
        teacherId.startsWith('guest_')
      ) {
        return 'local_only';
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user;
        if (!authUser) {
          return 'local_only';
        }

        const heatText =
          plan.heatMode === 'BRACKET_HEATS' && plan.totalHeats > 1
            ? `Bảng ${plan.heatIndex + 1}/${plan.totalHeats}`
            : `Đại diện công bằng (1/${plan.eligibleCount})`;

        const detailsText = [
          `Trò chơi: A07 - Tên Lửa Chọn Bạn 3D Premium 2027`,
          `Lớp: ${resolvedClassName}`,
          `Phi hành gia chiến thắng: ${winnerEntry.safeName} (STT #${winnerEntry.formattedStt} · ${winnerEntry.safeCode})`,
          `Bệ phóng #${winnerEntry.padNumber}/${plan.rockets.length} · Thời lượng ${plan.durationSec}s · ${heatText}`,
          points > 0 ? `Điểm thưởng: +${points}đ` : '',
          noteText.trim() ? `Ghi chú: ${noteText.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const { error } = await supabase.from('audit_logs').insert({
          actor_name: teacherName || 'Giáo viên',
          role: userRole || 'teacher',
          action: 'EDU_GAME_A07_SPACE_ROCKET_3D',
          target: `A07 (${resolvedClassName}) - ${winnerEntry.safeName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            game_id: 'A07',
            game_title: 'Tên lửa chọn bạn 3D',
            session_id: plan.sessionId,
            class_id: selectedSourceKey,
            class_name: resolvedClassName,
            student_id: winnerEntry.student.id,
            student_code: winnerEntry.safeCode,
            student_name: winnerEntry.safeName,
            student_stt: winnerEntry.sttNumber,
            pad_number: winnerEntry.padNumber,
            pad_count: plan.rockets.length,
            duration_sec: plan.durationSec,
            heat_mode: plan.heatMode,
            heat_index: plan.heatIndex,
            total_heats: plan.totalHeats,
            reward_points: points,
            note: noteText.trim(),
            selected_at: new Date().toISOString(),
          },
        });

        if (error) throw error;
        return 'saved';
      } catch (err) {
        console.warn('A07 Supabase audit_logs warning:', err);
        return 'error';
      }
    },
    [resolvedClassName, selectedSourceKey, teacherId, teacherName, userRole]
  );

  // Module 3 Result Commit (Strictly once per sessionId)
  const commitRocketWinner = useCallback(
    (plan: SpaceRocketTurnPlan) => {
      if (!isMountedRef.current) return;
      if (activeSessionIdRef.current !== plan.sessionId) return;
      if (!deduplicatorRef.current.markCommitted(plan.sessionId)) return;

      const winnerEntry = plan.rockets[plan.winnerPadIndex];
      if (!winnerEntry) return;

      audioEngineRef.current?.stopThrusterLoop();
      audioEngineRef.current?.stopSpaceMusicLoop();

      rebuild3DRocketsForLineup(plan.rockets, winnerEntry.student.id);
      const endEval = evaluateSpaceRocketFrame(plan, plan.durationMs);
      threeRefs.current.rocketRigs.forEach((rig, idx) => {
        const f = endEval.frames[idx];
        if (f) {
          const finalY = idx === plan.winnerPadIndex ? ROCKET_FINISH_Y + 3.0 : f.y;
          rig.root.position.set(f.x, finalY, f.z);
        }
      });

      setActiveWinnerEntry(winnerEntry);
      setActiveSessionId(plan.sessionId);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('saving');

      speakClassroomLine(`Chúc mừng bạn ${winnerEntry.safeName}!`);

      onPick(winnerEntry.student, {
        bonusPoints: 0,
        note: `Tên lửa 3D (Bệ #${winnerEntry.padNumber} · ${plan.durationSec}s)`,
        sessionId: plan.sessionId,
        studentNumber: winnerEntry.sttNumber,
      });

      const heatLabel =
        plan.heatMode === 'BRACKET_HEATS' && plan.totalHeats > 1
          ? `Bảng ${plan.heatIndex + 1}/${plan.totalHeats}`
          : `Toàn lớp (1/${plan.eligibleCount})`;

      const baseRecord: SpaceRocketTurnRecord = {
        sessionId: plan.sessionId,
        turnIndex: turnRecords.length + 1,
        classId: selectedSourceKey,
        className: resolvedClassName,
        studentId: winnerEntry.student.id,
        studentName: winnerEntry.safeName,
        studentCode: winnerEntry.safeCode,
        sttNumber: winnerEntry.sttNumber,
        formattedStt: winnerEntry.formattedStt,
        padNumber: winnerEntry.padNumber,
        padCount: plan.rockets.length,
        durationSec: plan.durationSec,
        heatMode: plan.heatMode,
        heatLabel,
        bonusPoints: 0,
        note: '',
        selectedAt: new Date().toISOString(),
        cloudStatus: 'local_only',
      };

      const nextRecords = [baseRecord, ...turnRecords];
      persistLocalRecords(nextRecords);

      syncTurnToSupabase(plan, winnerEntry, 0, '').then((status) => {
        if (!isMountedRef.current || activeSessionIdRef.current !== plan.sessionId) return;
        setCloudSyncStatus(status);
        setTurnRecords((prev) => {
          const updated = prev.map((rec) =>
            rec.sessionId === plan.sessionId ? { ...rec, cloudStatus: status } : rec
          );
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(recordsStorageKey, JSON.stringify(updated.slice(0, 60)));
            } catch {
              // Ignore
            }
          }
          return updated;
        });
      });
    },
    [
      onPick,
      persistLocalRecords,
      rebuild3DRocketsForLineup,
      recordsStorageKey,
      resolvedClassName,
      selectedSourceKey,
      speakClassroomLine,
      syncTurnToSupabase,
      turnRecords,
    ]
  );

  const commitRocketWinnerRef = useRef(commitRocketWinner);
  useEffect(() => {
    commitRocketWinnerRef.current = commitRocketWinner;
  }, [commitRocketWinner]);

  const speakClassroomLineRef = useRef(speakClassroomLine);
  useEffect(() => {
    speakClassroomLineRef.current = speakClassroomLine;
  }, [speakClassroomLine]);

  // ============================================================================
  // THREE.JS SPACEPORT & COSMOS INITIALIZATION (Mounted once, clean disposal)
  // ============================================================================
  useEffect(() => {
    isMountedRef.current = true;
    audioEngineRef.current = new SpaceRocketAudioEngine();

    const mountEl = stageMountRef.current;
    if (!mountEl) return;

    let animFrameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let envRT: THREE.WebGLRenderTarget | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    let scene: THREE.Scene | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let disposed = false;

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      if (!disposed) setRendererFallback2D(true);
    };
    const handleContextRestored = () => {
      if (!disposed) setRendererFallback2D(false);
    };

    try {
      const initWidth = Math.max(320, mountEl.clientWidth || 960);
      const initHeight = Math.max(260, mountEl.clientHeight || 540);

      // Probe Software WebGL safely
      const isSoftwareGl = (() => {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa/i.test(gpu);
      })();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });

      threeRefs.current.isSoftwareGl = isSoftwareGl;
      threeRefs.current.renderer = renderer;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      threeRefs.current.maxAnisotropy = maxAniso;

      const dprCap =
        isSoftwareGl || qualityPresetRef.current === 'LOW'
          ? 1
          : qualityPresetRef.current === 'MEDIUM'
          ? 1.5
          : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      renderer.setSize(initWidth, initHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSoftwareGl && qualityPresetRef.current !== 'LOW';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = 'w-full h-full block outline-none select-none';
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      mountEl.innerHTML = '';
      mountEl.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = SKY_PAD_COLOR.clone();
      scene.fog = new THREE.Fog('#4BA3E3', 48, 165);
      threeRefs.current.scene = scene;

      // Studio PBR Environment reflection
      pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      roomEnv.dispose();
      pmrem.dispose();
      pmrem = null;

      const camera = new THREE.PerspectiveCamera(46, initWidth / initHeight, 0.1, 320);
      camera.position.copy(threeRefs.current.camPos);
      camera.lookAt(threeRefs.current.camTarget);
      threeRefs.current.camera = camera;

      // Balanced Three-Point Cosmic & Daylight Illumination
      const hemi = new THREE.HemisphereLight('#E0F2FE', '#081B38', 0.95);
      scene.add(hemi);

      const sunLight = new THREE.DirectionalLight('#FFF7E0', 1.95);
      sunLight.position.set(22, 34, 24);
      if (renderer.shadowMap.enabled) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.camera.left = -22;
        sunLight.shadow.camera.right = 22;
        sunLight.shadow.camera.top = 20;
        sunLight.shadow.camera.bottom = -14;
        sunLight.shadow.camera.near = 2;
        sunLight.shadow.camera.far = 85;
        sunLight.shadow.bias = -0.0005;
        sunLight.shadow.normalBias = 0.02;
      }
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight('#00C8FF', 0.72);
      rimLight.position.set(-18, 16, -22);
      scene.add(rimLight);

      const victorySpot = new THREE.SpotLight('#FFD54F', 0, 34, Math.PI / 5, 0.5, 1.4);
      victorySpot.position.set(0, ROCKET_FINISH_Y + 12, 6);
      victorySpot.target.position.set(0, ROCKET_FINISH_Y + 2, 0);
      scene.add(victorySpot);
      scene.add(victorySpot.target);
      threeRefs.current.victorySpotLight = victorySpot;

      // ----------------------------------------------------------------------
      // SPACEPORT TERRAIN, LAUNCH COMPLEX DECK & 6 BLAST PADS
      // ----------------------------------------------------------------------
      const deckTex = createLaunchDeckTexture(maxAniso);
      const outerGround = new THREE.Mesh(
        new THREE.CircleGeometry(150, 48),
        new THREE.MeshStandardMaterial({
          color: '#113E79',
          roughness: 0.9,
          metalness: 0.05,
        })
      );
      outerGround.rotation.x = -Math.PI / 2;
      outerGround.position.y = -0.22;
      outerGround.receiveShadow = true;
      scene.add(outerGround);

      // Distant natural aerospace ridges (avoids floating edge)
      const ridgeMat = new THREE.MeshStandardMaterial({ color: '#0A2752', roughness: 0.92 });
      const ridgeGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      [
        { x: -55, z: -64, sx: 36, sy: 9.5, sz: 22 },
        { x: 0, z: -72, sx: 46, sy: 12.0, sz: 24 },
        { x: 56, z: -60, sx: 38, sy: 10.0, sz: 22 },
      ].forEach((r) => {
        const rm = new THREE.Mesh(ridgeGeo, ridgeMat);
        rm.position.set(r.x, -0.3, r.z);
        rm.scale.set(r.sx, r.sy, r.sz);
        scene!.add(rm);
      });

      const launchDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(15.5, 16.5, 0.44, 8),
        new THREE.MeshStandardMaterial({
          map: deckTex,
          roughness: 0.72,
          metalness: 0.16,
        })
      );
      launchDeck.position.set(0, -0.22, 0);
      launchDeck.receiveShadow = true;
      scene.add(launchDeck);

      const navySteelMat = new THREE.MeshStandardMaterial({
        color: '#081B38',
        roughness: 0.38,
        metalness: 0.62,
      });
      const cyanTrimMat = new THREE.MeshStandardMaterial({
        color: '#00C8FF',
        emissive: '#0284C7',
        emissiveIntensity: 0.55,
        roughness: 0.28,
      });
      const goldMat = new THREE.MeshStandardMaterial({
        color: '#FFD54F',
        roughness: 0.22,
        metalness: 0.85,
      });
      const steelTowerMat = new THREE.MeshStandardMaterial({
        color: '#94A3B8',
        roughness: 0.32,
        metalness: 0.72,
      });

      // 6 Individual Launch Pads + Umbilical Swing Towers
      const gantryArms: THREE.Group[] = [];
      const padBaseGeo = new THREE.CylinderGeometry(1.15, 1.38, 0.24, 16);
      const towerMastGeo = new THREE.BoxGeometry(0.22, 4.6, 0.22);
      const swingArmGeo = new THREE.BoxGeometry(0.95, 0.14, 0.14);

      for (let p = 0; p < MAX_ROCKET_PADS; p++) {
        const px = computeRocketPadX(p, MAX_ROCKET_PADS);
        const pz = computeRocketPadZ(p, MAX_ROCKET_PADS);

        const padMesh = new THREE.Mesh(padBaseGeo, navySteelMat);
        padMesh.position.set(px, 0.02, pz);
        padMesh.receiveShadow = true;
        scene.add(padMesh);

        const padRing = new THREE.Mesh(new THREE.TorusGeometry(1.20, 0.045, 8, 24), cyanTrimMat);
        padRing.rotation.x = Math.PI / 2;
        padRing.position.set(px, 0.14, pz);
        scene.add(padRing);

        // Umbilical service tower behind each pad
        const towerMast = new THREE.Mesh(towerMastGeo, steelTowerMat);
        towerMast.position.set(px, 2.3, pz - 1.25);
        towerMast.castShadow = true;
        scene.add(towerMast);

        const armPivot = new THREE.Group();
        armPivot.position.set(px, 2.75, pz - 1.15);
        const armMesh = new THREE.Mesh(swingArmGeo, cyanTrimMat);
        armMesh.rotation.y = Math.PI / 2;
        armMesh.position.set(0, 0, 0.45);
        armPivot.add(armMesh);
        scene.add(armPivot);
        gantryArms.push(armPivot);
      }
      threeRefs.current.gantryArms = gantryArms;

      // Mission Control Tower + Signal Lights + Electronic Scoreboard
      const ctrlTower = new THREE.Group();
      ctrlTower.position.set(-12.5, 0, -5.5);
      const ctrlBody = new THREE.Mesh(new THREE.BoxGeometry(3.2, 8.2, 3.2), navySteelMat);
      ctrlBody.position.y = 4.1;
      ctrlTower.add(ctrlBody);
      const ctrlObs = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 1.8, 1.4, 8),
        new THREE.MeshStandardMaterial({
          color: '#00C8FF',
          emissive: '#0369A1',
          emissiveIntensity: 0.45,
          roughness: 0.2,
        })
      );
      ctrlObs.position.y = 8.9;
      ctrlTower.add(ctrlObs);
      scene.add(ctrlTower);

      // Countdown Traffic Signal Mast
      const trafficMast = new THREE.Group();
      trafficMast.position.set(11.8, 0, -4.2);
      const tPole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 12), steelTowerMat);
      tPole.position.y = 3.1;
      trafficMast.add(tPole);
      const tHousing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.8, 0.65), navySteelMat);
      tHousing.position.y = 5.4;
      trafficMast.add(tHousing);

      const lightGeo = new THREE.SphereGeometry(0.28, 14, 12);
      const tRedMat = new THREE.MeshStandardMaterial({
        color: '#EF4444',
        emissive: '#7F1D1D',
        emissiveIntensity: 0.25,
      });
      const tAmberMat = new THREE.MeshStandardMaterial({
        color: '#FF7A21',
        emissive: '#7C2D12',
        emissiveIntensity: 0.25,
      });
      const tGreenMat = new THREE.MeshStandardMaterial({
        color: '#10B981',
        emissive: '#064E3B',
        emissiveIntensity: 0.25,
      });
      threeRefs.current.trafficRedMat = tRedMat;
      threeRefs.current.trafficAmberMat = tAmberMat;
      threeRefs.current.trafficGreenMat = tGreenMat;

      const tRed = new THREE.Mesh(lightGeo, tRedMat);
      tRed.position.set(0, 6.2, 0.32);
      trafficMast.add(tRed);
      const tAmber = new THREE.Mesh(lightGeo, tAmberMat);
      tAmber.position.set(0, 5.4, 0.32);
      trafficMast.add(tAmber);
      const tGreen = new THREE.Mesh(lightGeo, tGreenMat);
      tGreen.position.set(0, 4.6, 0.32);
      trafficMast.add(tGreen);
      scene.add(trafficMast);

      // Electronic Mission Control Scoreboard
      const sbCanvas = document.createElement('canvas');
      sbCanvas.width = 1024;
      sbCanvas.height = 320;
      const sbCtx = sbCanvas.getContext('2d')!;
      drawMissionScoreboardCanvas(sbCtx, 'SẴN SÀNG PHÓNG', '00.0s / 10.0s', 'TÂY ĐÔ SPACEPORT · A07');
      const sbTex = new THREE.CanvasTexture(sbCanvas);
      sbTex.colorSpace = THREE.SRGBColorSpace;
      sbTex.anisotropy = Math.min(8, maxAniso);
      threeRefs.current.scoreboardCtx = sbCtx;
      threeRefs.current.scoreboardTex = sbTex;

      const sbFrame = new THREE.Mesh(new THREE.BoxGeometry(11.4, 3.7, 0.42), navySteelMat);
      sbFrame.position.set(0, 7.6, -7.2);
      scene.add(sbFrame);
      const sbScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(10.8, 3.32),
        new THREE.MeshBasicMaterial({ map: sbTex })
      );
      sbScreen.position.set(0, 7.6, -6.96);
      scene.add(sbScreen);

      // ----------------------------------------------------------------------
      // CLOUD LAYER (Instanced Clouds at y = 16..28)
      // ----------------------------------------------------------------------
      const cloudCount = 34;
      const cloudGeo = new THREE.SphereGeometry(1, 10, 8);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.95,
        transparent: true,
        opacity: 0.88,
      });
      const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
      for (let c = 0; c < cloudCount; c++) {
        const ang = (c / cloudCount) * Math.PI * 2;
        const rad = 18 + (c % 5) * 7.5;
        const cx = Math.cos(ang) * rad;
        const cz = Math.sin(ang) * rad - 8;
        const cy = 16 + (c % 4) * 3.4;
        _tmpVecA.set(cx, cy, cz);
        _tmpQuat.identity();
        _tmpScale.set(4.5 + (c % 3) * 1.4, 1.5 + (c % 2) * 0.6, 3.4 + (c % 3));
        _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
        cloudInst.setMatrixAt(c, _tmpMatrix);
      }
      cloudInst.instanceMatrix.needsUpdate = true;
      scene.add(cloudInst);

      // ----------------------------------------------------------------------
      // DEEP SPACE STARS, RINGED PLANET & ORBITING SATELLITE
      // ----------------------------------------------------------------------
      const starCount = 1200;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        starPos[i * 3] = (Math.random() - 0.5) * 220;
        starPos[i * 3 + 1] = 20 + Math.random() * 140;
        starPos[i * 3 + 2] = -15 - Math.random() * 150;
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: '#FFFFFF',
        size: 0.52,
        transparent: true,
        opacity: 0.15,
      });
      const starPoints = new THREE.Points(starGeo, starMat);
      scene.add(starPoints);
      threeRefs.current.starPoints = starPoints;
      threeRefs.current.starMat = starMat;

      // Ringed Cosmic Planet in Upper Background
      const planetGroup = new THREE.Group();
      planetGroup.position.set(26, 62, -52);
      const planetSphere = new THREE.Mesh(
        new THREE.SphereGeometry(8.5, 28, 22),
        new THREE.MeshStandardMaterial({
          color: '#1D4ED8',
          emissive: '#0F172A',
          roughness: 0.65,
        })
      );
      planetGroup.add(planetSphere);
      const planetRing = new THREE.Mesh(
        new THREE.TorusGeometry(13.2, 1.15, 6, 48),
        new THREE.MeshStandardMaterial({
          color: '#FFD54F',
          roughness: 0.4,
          metalness: 0.35,
          transparent: true,
          opacity: 0.85,
        })
      );
      planetRing.rotation.x = Math.PI / 2.4;
      planetRing.rotation.y = 0.28;
      planetGroup.add(planetRing);
      scene.add(planetGroup);
      threeRefs.current.planetGroup = planetGroup;

      // Warm Orange Moon Planetoid on Left Sky
      const moonSphere = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 22, 18),
        new THREE.MeshStandardMaterial({
          color: '#FF7A21',
          emissive: '#7C2D12',
          emissiveIntensity: 0.25,
          roughness: 0.78,
        })
      );
      moonSphere.position.set(-28, 56, -46);
      scene.add(moonSphere);

      // Orbiting Solar-Panel Satellite
      const satelliteGroup = new THREE.Group();
      satelliteGroup.position.set(-14, 48, -18);
      const satBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 12), goldMat);
      satBody.rotation.z = Math.PI / 2;
      satelliteGroup.add(satBody);
      const satPanelL = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.9), cyanTrimMat);
      satPanelL.position.set(-2.0, 0, 0);
      satelliteGroup.add(satPanelL);
      const satPanelR = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.9), cyanTrimMat);
      satPanelR.position.set(2.0, 0, 0);
      satelliteGroup.add(satPanelR);
      scene.add(satelliteGroup);
      threeRefs.current.satelliteGroup = satelliteGroup;

      // ----------------------------------------------------------------------
      // SPACE WARP FINISH GATE (y = ROCKET_FINISH_Y) + 3D GOLDEN TROPHY
      // ----------------------------------------------------------------------
      const finishGateGroup = new THREE.Group();
      finishGateGroup.position.set(0, ROCKET_FINISH_Y, 0);

      const finishRingOuter = new THREE.Mesh(
        new THREE.TorusGeometry(11.5, 0.42, 12, 48),
        new THREE.MeshStandardMaterial({
          color: '#00C8FF',
          emissive: '#0284C7',
          emissiveIntensity: 0.9,
          roughness: 0.2,
          metalness: 0.65,
        })
      );
      finishRingOuter.rotation.x = Math.PI / 2;
      finishGateGroup.add(finishRingOuter);

      const finishRingInner = new THREE.Mesh(
        new THREE.TorusGeometry(10.2, 0.22, 10, 48),
        goldMat
      );
      finishRingInner.rotation.x = Math.PI / 2;
      finishGateGroup.add(finishRingInner);

      scene.add(finishGateGroup);
      threeRefs.current.finishGateGroup = finishGateGroup;
      threeRefs.current.finishRingOuter = finishRingOuter;
      threeRefs.current.finishRingInner = finishRingInner;

      // 3D Golden Space Champion Trophy floating cleanly beside summit
      const trophyGroup = new THREE.Group();
      trophyGroup.position.set(6.5, ROCKET_FINISH_Y + 3.2, -3.5);
      const tBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.35, 0.6, 24), navySteelMat);
      tBase.position.y = 0.3;
      trophyGroup.add(tBase);
      const tStem = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 16), goldMat);
      tStem.position.y = 1.0;
      trophyGroup.add(tStem);
      const tCup = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.35, 1.05, 24), goldMat);
      tCup.position.y = 1.85;
      trophyGroup.add(tCup);
      const tStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), goldMat);
      tStar.position.y = 2.75;
      trophyGroup.add(tStar);
      scene.add(trophyGroup);
      threeRefs.current.trophyGroup = trophyGroup;

      // Rocket Container & Shared Geometries
      const rocketContainer = new THREE.Group();
      scene.add(rocketContainer);
      threeRefs.current.rocketGroupContainer = rocketContainer;
      threeRefs.current.sharedRocketGeos = createSharedRocketGeometries();

      // ----------------------------------------------------------------------
      // INSTANCED IGNITION SMOKE & VICTORY CONFETTI
      // ----------------------------------------------------------------------
      const smokeCount = 144;
      const smokeGeo = new THREE.SphereGeometry(0.28, 7, 6);
      const smokeMat = new THREE.MeshBasicMaterial({
        color: '#E2E8F0',
        transparent: true,
        opacity: 0.56,
      });
      const smokeInstanced = new THREE.InstancedMesh(smokeGeo, smokeMat, smokeCount);
      smokeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      smokeInstanced.frustumCulled = false;
      const smokeSeeds = new Float32Array(smokeCount);
      for (let i = 0; i < smokeCount; i++) {
        smokeSeeds[i] = (i * 0.6180339887) % 1;
        _tmpMatrix.makeScale(0, 0, 0);
        smokeInstanced.setMatrixAt(i, _tmpMatrix);
      }
      scene.add(smokeInstanced);
      threeRefs.current.smokeInstanced = smokeInstanced;
      threeRefs.current.smokeSeeds = smokeSeeds;

      const confettiCount = 150;
      const confettiGeo = new THREE.BoxGeometry(0.26, 0.04, 0.16);
      const confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.3 });
      const confettiInst = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
      confettiInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      confettiInst.frustumCulled = false;
      const confPalette = [
        new THREE.Color('#FFD54F'),
        new THREE.Color('#00C8FF'),
        new THREE.Color('#FF7A21'),
        new THREE.Color('#10B981'),
        new THREE.Color('#FFFFFF'),
      ];
      const confettiStates: Array<{
        x: number;
        y: number;
        z: number;
        vy: number;
        vx: number;
        vz: number;
        rotSpeed: number;
      }> = [];
      for (let i = 0; i < confettiCount; i++) {
        confettiStates.push({
          x: (Math.random() - 0.5) * 14,
          y: ROCKET_FINISH_Y - 12,
          z: (Math.random() - 0.5) * 10,
          vy: 2.2 + Math.random() * 2.5,
          vx: (Math.random() - 0.5) * 1.8,
          vz: (Math.random() - 0.5) * 1.8,
          rotSpeed: 2.0 + Math.random() * 3.8,
        });
        confettiInst.setColorAt(i, confPalette[i % confPalette.length]);
        _tmpMatrix.makeScale(0, 0, 0);
        confettiInst.setMatrixAt(i, _tmpMatrix);
      }
      if (confettiInst.instanceColor) confettiInst.instanceColor.needsUpdate = true;
      scene.add(confettiInst);
      threeRefs.current.confettiInstanced = confettiInst;
      threeRefs.current.confettiStates = confettiStates;

      // Initial rockets standing on launch pads
      rebuild3DRocketsForLineup(previewLineupRef.current, null);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      resizeObserver = new ResizeObserver((entries) => {
        if (disposed || !renderer || !threeRefs.current.camera) return;
        for (const entry of entries) {
          const w = Math.max(320, Math.round(entry.contentRect.width));
          const h = Math.max(240, Math.round(entry.contentRect.height));
          threeRefs.current.camera.aspect = w / h;
          threeRefs.current.camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      });
      resizeObserver.observe(mountEl);

      // ----------------------------------------------------------------------
      // MONOTONIC CLOCK ANIMATION LOOP (Software-WebGL FenceSync Paced)
      // ----------------------------------------------------------------------
      let prevPerf = performance.now();

      const afterDraw = (cb: FrameRequestCallback) => {
        if (disposed) return;
        if (threeRefs.current.isSoftwareGl && renderer) {
          const gl = renderer.getContext() as WebGL2RenderingContext;
          if (typeof gl.fenceSync === 'function') {
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            const poll = () => {
              if (disposed) return;
              const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
              if (state === gl.UNSIGNALED) {
                animFrameId = window.setTimeout(poll, 5);
              } else {
                if (sync) gl.deleteSync(sync);
                animFrameId = window.setTimeout(() => {
                  if (!disposed) animFrameId = requestAnimationFrame(cb);
                }, 75);
              }
            };
            animFrameId = window.setTimeout(poll, 5);
            return;
          }
          animFrameId = window.setTimeout(() => {
            if (!disposed) animFrameId = requestAnimationFrame(cb);
          }, 75);
        } else {
          animFrameId = requestAnimationFrame(cb);
        }
      };

      const tick = (nowPerf: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (nowPerf - prevPerf) / 1000));
        prevPerf = nowPerf;
        const tSec = nowPerf * 0.001;

        const st = flightStateRef.current;
        const plan = activePlanRef.current;
        const isReduced = reducedMotionRef.current;
        const muted = isMutedRef.current;

        // 1. Traffic Signal Mast & Umbilical Gantry Arms
        if (
          threeRefs.current.trafficRedMat &&
          threeRefs.current.trafficAmberMat &&
          threeRefs.current.trafficGreenMat
        ) {
          let rEm = 0.25;
          let aEm = 0.25;
          let gEm = 0.25;
          let targetArmAngle = 0;

          if (st === 'COUNTDOWN') {
            const cdMs = nowPerf - countdownStartPerfRef.current;
            if (cdMs < 900) rEm = 3.2;
            else if (cdMs < 2700) {
              aEm = 3.2;
              targetArmAngle = 0.45;
            } else {
              gEm = 3.8;
              targetArmAngle = 1.25; // Swing gantry arms clear!
            }
          } else if (st === 'LAUNCHING' || st === 'FLYING' || st === 'FINISHING' || st === 'RESULT') {
            gEm = 2.8;
            targetArmAngle = 1.25;
          }

          threeRefs.current.trafficRedMat.emissiveIntensity = rEm;
          threeRefs.current.trafficAmberMat.emissiveIntensity = aEm;
          threeRefs.current.trafficGreenMat.emissiveIntensity = gEm;

          threeRefs.current.gantryArms.forEach((arm) => {
            arm.rotation.y = THREE.MathUtils.damp(arm.rotation.y, targetArmAngle, 10, dt);
          });
        }

        // 2. Countdown State Machine: 3 - 2 - 1 - PHÓNG!
        if (st === 'COUNTDOWN' && plan && activeSessionIdRef.current === plan.sessionId) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900) {
            if (countdownLastStepRef.current !== 3) {
              countdownLastStepRef.current = 3;
              setCountdownLabel('3');
              audioEngineRef.current?.playCountdownBeep(3, muted);
              speakClassroomLineRef.current('Ba, hai, một, phóng!');
            }
          } else if (cdMs < 1800) {
            if (countdownLastStepRef.current !== 2) {
              countdownLastStepRef.current = 2;
              setCountdownLabel('2');
              audioEngineRef.current?.playCountdownBeep(2, muted);
            }
          } else if (cdMs < 2700) {
            if (countdownLastStepRef.current !== 1) {
              countdownLastStepRef.current = 1;
              setCountdownLabel('1');
              audioEngineRef.current?.playCountdownBeep(1, muted);
            }
          } else if (cdMs < COUNTDOWN_TOTAL_MS) {
            if (countdownLastStepRef.current !== 0) {
              countdownLastStepRef.current = 0;
              setCountdownLabel('PHÓNG!');
              audioEngineRef.current?.playLaunchHornAndIgnition(muted);
              audioEngineRef.current?.startThrusterLoop(muted);
              if (musicEnabledRef.current) {
                audioEngineRef.current?.startSpaceMusicLoop('TENSE', muted);
              }
            }
          } else {
            countdownLastStepRef.current = -1;
            setCountdownLabel('');
            flightStartPerfRef.current = nowPerf;
            flightStateRef.current = 'LAUNCHING';
            setFlightState('LAUNCHING');
          }
        }

        // 3. Monotonic Rocket Trajectory Evaluation
        let evalRes: ReturnType<typeof evaluateSpaceRocketFrame> | null = null;
        let currentElapsedMs = 0;

        if ((st === 'LAUNCHING' || st === 'FLYING') && plan && activeSessionIdRef.current === plan.sessionId) {
          currentElapsedMs = nowPerf - flightStartPerfRef.current;
          evalRes = evaluateSpaceRocketFrame(plan, currentElapsedMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          audioEngineRef.current?.updateThrusterIntensity(evalRes.u, muted);

          if (st === 'LAUNCHING' && evalRes.u >= 0.16) {
            flightStateRef.current = 'FLYING';
            setFlightState('FLYING');
          }

          if (!boostAnnouncedRef.current && evalRes.u >= 0.52) {
            boostAnnouncedRef.current = true;
            audioEngineRef.current?.playWarpBoostWhoosh(muted);
            speakClassroomLineRef.current('Tên lửa đang tăng tốc!');
          }

          if (!warpSoundPlayedRef.current && evalRes.u >= 0.88) {
            warpSoundPlayedRef.current = true;
            audioEngineRef.current?.playWarpBoostWhoosh(muted);
          }

          if (evalRes.isFlightCompleted) {
            finishingStartPerfRef.current = nowPerf;
            flightStateRef.current = 'FINISHING';
            setFlightState('FINISHING');
            audioEngineRef.current?.playGateAndVictoryFanfare(muted);
          }
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          currentElapsedMs = plan.durationMs;
          evalRes = evaluateSpaceRocketFrame(plan, plan.durationMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            flightStateRef.current = 'RESULT';
            setFlightState('RESULT');
            commitRocketWinnerRef.current(plan);
          }
        }

        // 4. Atmosphere -> Stratosphere -> Deep Space Sky & Stars Interpolation
        const climbProgress = evalRes ? evalRes.u : st === 'FINISHING' || st === 'RESULT' ? 1 : 0;
        if (scene) {
          if (climbProgress < 0.45) {
            const k = climbProgress / 0.45;
            _tmpColorA.copy(SKY_PAD_COLOR).lerp(SKY_STRATO_COLOR, k);
          } else {
            const k = (climbProgress - 0.45) / 0.55;
            _tmpColorA.copy(SKY_STRATO_COLOR).lerp(SKY_SPACE_COLOR, k);
          }
          (scene.background as THREE.Color).copy(_tmpColorA);
          if (scene.fog instanceof THREE.Fog) {
            _tmpColorB.set('#4BA3E3');
            _tmpColorC.set('#081B38');
            scene.fog.color.copy(_tmpColorB.lerp(_tmpColorC, climbProgress));
          }
        }
        if (threeRefs.current.starMat) {
          threeRefs.current.starMat.opacity = 0.16 + climbProgress * 0.78;
        }
        if (threeRefs.current.planetGroup && !isReduced) {
          threeRefs.current.planetGroup.rotation.y = tSec * 0.08;
        }
        if (threeRefs.current.satelliteGroup && !isReduced) {
          threeRefs.current.satelliteGroup.position.x = -14 + Math.sin(tSec * 0.35) * 6;
          threeRefs.current.satelliteGroup.rotation.y = tSec * 0.45;
        }
        if (threeRefs.current.finishRingOuter && threeRefs.current.finishRingInner && !isReduced) {
          threeRefs.current.finishRingOuter.rotation.z = tSec * 0.65;
          threeRefs.current.finishRingInner.rotation.z = -tSec * 0.95;
        }

        // 5. Throttled React HUD & Mission Control Scoreboard (~10 Hz)
        if (nowPerf - lastHudUpdatePerfRef.current > 95) {
          lastHudUpdatePerfRef.current = nowPerf;
          if (evalRes && plan) {
            setElapsedDisplaySec(Math.min(plan.durationSec, currentElapsedMs / 1000));
            const sorted = evalRes.frames
              .map((f, idx) => ({
                padNumber: plan.rockets[idx].padNumber,
                displayLabel: plan.rockets[idx].displayLabel,
                progressPct: Math.round(f.progress * 100),
                badgeHex: plan.rockets[idx].palette.badgeHex,
              }))
              .sort((a, b) => b.progressPct - a.progressPct)
              .slice(0, 3);
            setLiveTop3(sorted);
          }

          if (threeRefs.current.scoreboardCtx && threeRefs.current.scoreboardTex) {
            const sStatus =
              st === 'COUNTDOWN'
                ? 'ĐẾM NGƯỢC PHÓNG'
                : st === 'LAUNCHING'
                ? 'RỜI BỆ PHÓNG'
                : st === 'FLYING'
                ? 'BAY VÀO VŨ TRỤ'
                : st === 'FINISHING'
                ? 'VƯỢT CỔNG!'
                : st === 'RESULT'
                ? 'HOÀN TẤT'
                : 'SẴN SÀNG';
            const dur = plan ? plan.durationSec : durationSecRef.current;
            const sTimer = `${Math.min(dur, currentElapsedMs / 1000).toFixed(1)}s / ${dur}s`;
            const leaderIdx = evalRes ? evalRes.leaderPadIndex : 0;
            const leaderEntry =
              plan && plan.rockets[leaderIdx]
                ? plan.rockets[leaderIdx]
                : previewLineupRef.current[0];
            const sLeader =
              st === 'RESULT' && plan
                ? `CHIẾN THẮNG: ${plan.winnerDisplayLabel}`
                : leaderEntry
                ? `DẪN ĐẦU: Bệ #${leaderEntry.padNumber} · ${leaderEntry.displayLabel}`
                : 'ĐANG CHỜ PHI HÀNH GIA';

            drawMissionScoreboardCanvas(threeRefs.current.scoreboardCtx, sStatus, sTimer, sLeader);
            threeRefs.current.scoreboardTex.needsUpdate = true;
          }
        }

        // 6. Update Articulated 3D Rocket Rigs & Exhaust Plumes
        const rigs = threeRefs.current.rocketRigs;
        for (let i = 0; i < rigs.length; i++) {
          const rig = rigs[i];
          const f = evalRes && evalRes.frames[i] ? evalRes.frames[i] : null;
          const rx = f ? f.x : rig.racer.padX;
          let ry = f ? f.y : ROCKET_START_Y;
          const rz = f ? f.z : rig.racer.padZ;

          const isWinnerCelebrate =
            (st === 'FINISHING' || st === 'RESULT') && plan && i === plan.winnerPadIndex;

          if (st === 'FINISHING' && plan) {
            const finU = Math.min(1, (nowPerf - finishingStartPerfRef.current) / FINISHING_SLOWMO_MS);
            if (i === plan.winnerPadIndex) {
              ry = ROCKET_FINISH_Y + finU * 3.0;
            } else {
              ry = Math.min(ROCKET_FINISH_Y - 1.5, ry + finU * 0.6);
            }
          } else if (st === 'RESULT' && plan && i === plan.winnerPadIndex) {
            ry = ROCKET_FINISH_Y + 3.0;
          }

          // Subtle liftoff vibration (suppressed when reducedMotion ON)
          const vib =
            !isReduced && (st === 'COUNTDOWN' && countdownLastStepRef.current === 0)
              ? Math.sin(tSec * 52 + i) * 0.04
              : !isReduced && (st === 'LAUNCHING' || st === 'FLYING')
              ? Math.sin(tSec * 36 + i * 2) * 0.025
              : 0;

          rig.root.position.set(rx + vib, ry, rz);

          // Flame Plume Scale & Intensity
          const flameOuterMat = rig.flameOuter.material as THREE.MeshBasicMaterial;
          const flameInnerMat = rig.flameInner.material as THREE.MeshBasicMaterial;
          const glowMat = rig.thrusterGlow.material as THREE.MeshBasicMaterial;

          if (st === 'COUNTDOWN') {
            const cdMs = nowPerf - countdownStartPerfRef.current;
            const ign = Math.max(0, (cdMs - 1400) / 1800);
            const flicker = isReduced ? 1 : 0.85 + Math.sin(tSec * 40 + i) * 0.15;
            rig.flameOuter.scale.set(0.75 * ign, 0.7 * ign * flicker, 0.75 * ign);
            rig.flameInner.scale.set(0.6 * ign, 0.6 * ign * flicker, 0.6 * ign);
            flameOuterMat.opacity = ign * 0.72;
            flameInnerMat.opacity = ign * 0.88;
            glowMat.opacity = 0.4 + ign * 0.55;
          } else if (st === 'LAUNCHING' || st === 'FLYING' || st === 'FINISHING') {
            const boost = f ? Math.min(1.6, Math.max(0.85, f.speedNorm)) : 1.0;
            const flicker = isReduced ? 1 : 0.88 + Math.sin(tSec * 46 + i * 1.7) * 0.16;
            rig.flameOuter.scale.set(1.0 * boost, 1.15 * boost * flicker, 1.0 * boost);
            rig.flameInner.scale.set(0.85 * boost, 1.05 * boost * flicker, 0.85 * boost);
            flameOuterMat.opacity = 0.82;
            flameInnerMat.opacity = 0.96;
            glowMat.opacity = 0.95;
            if (!isReduced) {
              rig.craftGroup.rotation.y = Math.sin(tSec * 1.4 + rig.racer.phaseOffset) * 0.08;
            }
          } else if (isWinnerCelebrate && st === 'RESULT') {
            rig.flameOuter.scale.set(0.55, 0.55, 0.55);
            rig.flameInner.scale.set(0.45, 0.45, 0.45);
            flameOuterMat.opacity = 0.5;
            flameInnerMat.opacity = 0.7;
            glowMat.opacity = 0.85;
            if (!isReduced) {
              rig.craftGroup.rotation.y = tSec * 0.75;
            }
          } else {
            rig.flameOuter.scale.set(0.01, 0.01, 0.01);
            rig.flameInner.scale.set(0.01, 0.01, 0.01);
            flameOuterMat.opacity = 0;
            flameInnerMat.opacity = 0;
            glowMat.opacity = 0.35;
            rig.craftGroup.rotation.y = 0;
          }

          // Champion Halo Ring
          const haloMat = rig.padHaloRing.material as THREE.MeshBasicMaterial;
          if (isWinnerCelebrate) {
            haloMat.color.set('#FFD54F');
            haloMat.opacity = isReduced ? 0.88 : 0.72 + Math.sin(tSec * 5) * 0.2;
            const hs = isReduced ? 1.25 : 1.22 + Math.sin(tSec * 4) * 0.12;
            rig.padHaloRing.scale.set(hs, hs, 1);
          } else if (f?.isLeading && (st === 'LAUNCHING' || st === 'FLYING')) {
            haloMat.color.set('#FFD54F');
            haloMat.opacity = 0.65;
            rig.padHaloRing.scale.set(1.08, 1.08, 1);
          } else {
            haloMat.color.set(rig.racer.palette.finHex);
            haloMat.opacity = 0.28;
            rig.padHaloRing.scale.set(1, 1, 1);
          }
        }

        // 7. Victory Golden Trophy & Spotlight
        if (threeRefs.current.trophyGroup) {
          threeRefs.current.trophyGroup.rotation.y = isReduced ? 0.3 : tSec * 0.8;
          threeRefs.current.trophyGroup.position.y =
            ROCKET_FINISH_Y + 3.2 + (isReduced ? 0 : Math.sin(tSec * 2.2) * 0.25);
        }
        if (threeRefs.current.victorySpotLight) {
          const targetInt = st === 'RESULT' ? 46 : st === 'FINISHING' ? 28 : 0;
          threeRefs.current.victorySpotLight.intensity = THREE.MathUtils.damp(
            threeRefs.current.victorySpotLight.intensity,
            targetInt,
            6,
            dt
          );
          if (plan && plan.rockets[plan.winnerPadIndex]) {
            const wx = plan.rockets[plan.winnerPadIndex].padX;
            threeRefs.current.victorySpotLight.position.set(wx, ROCKET_FINISH_Y + 12, 6);
            threeRefs.current.victorySpotLight.target.position.set(wx, ROCKET_FINISH_Y + 2.5, 0);
          }
        }

        // 8. Instanced Ignition Smoke Plumes
        if (threeRefs.current.smokeInstanced && rigs.length > 0) {
          const sInst = threeRefs.current.smokeInstanced;
          const seeds = threeRefs.current.smokeSeeds;
          const showSmoke =
            !isReduced &&
            (st === 'COUNTDOWN' || st === 'LAUNCHING' || st === 'FLYING' || st === 'FINISHING');
          for (let i = 0; i < sInst.count; i++) {
            if (!showSmoke) {
              _tmpMatrix.makeScale(0, 0, 0);
              sInst.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            const rig = rigs[i % rigs.length];
            const ph = (tSec * 1.9 + seeds[i]) % 1;
            const spread = st === 'COUNTDOWN' ? 1.85 : 0.85;
            const sx = rig.root.position.x + Math.cos(i * 2.3) * ph * spread;
            const sy = Math.max(0.15, rig.root.position.y - 0.3 - ph * (st === 'COUNTDOWN' ? 0.1 : 4.2));
            const sz = rig.root.position.z + Math.sin(i * 1.9) * ph * spread;
            const sc = (1 - ph * 0.65) * (st === 'COUNTDOWN' ? 1.5 : 1.15);
            _tmpVecA.set(sx, sy, sz);
            _tmpQuat.identity();
            _tmpScale.set(sc, sc, sc);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            sInst.setMatrixAt(i, _tmpMatrix);
          }
          sInst.instanceMatrix.needsUpdate = true;
        }

        // 9. Instanced Victory Confetti & Golden Sparkles
        if (threeRefs.current.confettiInstanced) {
          const conf = threeRefs.current.confettiInstanced;
          const cStates = threeRefs.current.confettiStates;
          const showConf = (st === 'FINISHING' || st === 'RESULT') && !isReduced;
          const wx =
            plan && plan.rockets[plan.winnerPadIndex] ? plan.rockets[plan.winnerPadIndex].padX : 0;

          for (let i = 0; i < cStates.length; i++) {
            const c = cStates[i];
            if (!showConf) {
              _tmpMatrix.makeScale(0, 0, 0);
              conf.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            if (c.y < ROCKET_FINISH_Y - 6) {
              c.y = ROCKET_FINISH_Y + 6 + Math.random() * 5.5;
              c.x = wx + (Math.random() - 0.5) * 14;
              c.z = (Math.random() - 0.5) * 9;
            }
            c.y -= c.vy * dt * 1.3;
            c.x += Math.sin(tSec * 2.2 + i) * 0.7 * dt;
            _tmpVecA.set(c.x, c.y, c.z);
            _tmpEuler.set(tSec * c.rotSpeed, tSec * (c.rotSpeed * 0.7), i);
            _tmpQuat.setFromEuler(_tmpEuler);
            _tmpScale.set(1, 1, 1);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            conf.setMatrixAt(i, _tmpMatrix);
          }
          conf.instanceMatrix.needsUpdate = true;
        }

        // 10. Smooth 5-Angle Cinematic Camera Choreography
        if (threeRefs.current.camera) {
          let desiredMode = cameraModeRef.current;

          if (autoCameraRef.current && !isReduced) {
            if (st === 'READY' || st === 'IDLE') desiredMode = 'LAUNCHPAD_WIDE';
            else if (st === 'COUNTDOWN') desiredMode = 'LAUNCHPAD_WIDE';
            else if ((st === 'LAUNCHING' || st === 'FLYING') && evalRes) {
              if (evalRes.u < 0.25) desiredMode = 'TRACKING_CLIMB';
              else if (evalRes.u < 0.65) desiredMode = 'HERO_ASCENT';
              else if (evalRes.u < 0.86) desiredMode = 'COSMIC_AERIAL';
              else desiredMode = 'FINISH_GATE';
            } else if (st === 'FINISHING' || st === 'RESULT') {
              desiredMode = 'FINISH_GATE';
            }
          }

          const packY = evalRes ? evalRes.packCenterY : ROCKET_START_Y;
          const leadFrame = evalRes ? evalRes.frames[evalRes.leaderPadIndex] : null;
          const leadY = leadFrame ? leadFrame.y : packY;
          const leadX = leadFrame ? leadFrame.x : 0;
          const winX =
            plan && plan.rockets[plan.winnerPadIndex] ? plan.rockets[plan.winnerPadIndex].padX : 0;

          let tx = 0;
          let ty = 7.4;
          let tz = 22.5;
          let lx = 0;
          let ly = 3.2;
          let lz = 0;

          if ((st === 'READY' || st === 'IDLE') && desiredMode === 'LAUNCHPAD_WIDE' && !isReduced) {
            tx = Math.sin(tSec * 0.32) * 5.0;
            ty = 7.6 + Math.cos(tSec * 0.28) * 0.55;
            tz = 22.5;
            lx = 0;
            ly = 3.2;
            lz = 0;
          } else if (desiredMode === 'TRACKING_CLIMB') {
            const baseY = packY * 0.45 + leadY * 0.55;
            tx = leadX * 0.25;
            ty = baseY + 3.2;
            tz = 21.0;
            lx = 0;
            ly = baseY + 3.5;
            lz = 0;
          } else if (desiredMode === 'HERO_ASCENT') {
            tx = leadX * 0.5 + 3.8;
            ty = Math.max(2.0, leadY - 3.6);
            tz = 13.5;
            lx = leadX * 0.4;
            ly = leadY + 3.2;
            lz = 0;
          } else if (desiredMode === 'COSMIC_AERIAL') {
            tx = 0;
            ty = Math.min(ROCKET_FINISH_Y + 8, leadY + 12.0);
            tz = 26.0;
            lx = 0;
            ly = Math.min(ROCKET_FINISH_Y, packY + 4.5);
            lz = 0;
          } else if (desiredMode === 'FINISH_GATE') {
            tx = winX * 0.35 - 2.5;
            ty = ROCKET_FINISH_Y + 5.0;
            tz = 17.5;
            lx = winX * 0.4;
            ly = ROCKET_FINISH_Y + 2.6;
            lz = 0;
          }

          const camLambda = isReduced ? 8.0 : 3.6;
          threeRefs.current.camPos.x = THREE.MathUtils.damp(threeRefs.current.camPos.x, tx, camLambda, dt);
          threeRefs.current.camPos.y = THREE.MathUtils.damp(threeRefs.current.camPos.y, ty, camLambda, dt);
          threeRefs.current.camPos.z = THREE.MathUtils.damp(threeRefs.current.camPos.z, tz, camLambda, dt);

          threeRefs.current.camTarget.x = THREE.MathUtils.damp(threeRefs.current.camTarget.x, lx, camLambda, dt);
          threeRefs.current.camTarget.y = THREE.MathUtils.damp(threeRefs.current.camTarget.y, ly, camLambda, dt);
          threeRefs.current.camTarget.z = THREE.MathUtils.damp(threeRefs.current.camTarget.z, lz, camLambda, dt);

          threeRefs.current.camera.position.copy(threeRefs.current.camPos);
          threeRefs.current.camera.lookAt(threeRefs.current.camTarget);
        }

        if (renderer && scene && threeRefs.current.camera) {
          renderer.render(scene, threeRefs.current.camera);
        }

        afterDraw(tick);
      };

      animFrameId = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('A07 WebGL unavailable, switching to 2D Spaceport fallback:', err);
      setRendererFallback2D(true);
    }

    return () => {
      disposed = true;
      isMountedRef.current = false;
      activeSessionIdRef.current = null;
      cancelAnimationFrame(animFrameId);
      clearTimeout(animFrameId);
      if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
      if (resizeObserver) resizeObserver.disconnect();
      audioEngineRef.current?.dispose();
      voiceManagerRef.current?.cancel();

      if (threeRefs.current.sharedRocketGeos) {
        Object.values(threeRefs.current.sharedRocketGeos).forEach((g) => g.dispose());
        threeRefs.current.sharedRocketGeos = null;
      }

      if (scene) {
        disposeObject3DMaterialsAndTextures(scene);
      }
      if (envRT) envRT.dispose();
      if (pmrem) pmrem.dispose();

      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
        renderer.dispose();
      }
      threeRefs.current.renderer = null;
      threeRefs.current.scene = null;
      threeRefs.current.camera = null;
      threeRefs.current.rocketRigs = [];
    };
  }, [rebuild3DRocketsForLineup]);

  // Apply 3D Quality Preset dynamically without rebuilding context
  useEffect(() => {
    const r = threeRefs.current.renderer;
    if (!r) return;
    const cap =
      threeRefs.current.isSoftwareGl || qualityPreset === 'LOW'
        ? 1
        : qualityPreset === 'MEDIUM'
        ? 1.5
        : 2;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    r.shadowMap.enabled = !threeRefs.current.isSoftwareGl && qualityPreset !== 'LOW';
  }, [qualityPreset]);

  // Pure 2D Canvas Spaceport Fallback Animation Loop
  useEffect(() => {
    if (!rendererFallback2D) return;
    let raf = 0;
    let active = true;
    const step2D = (nowPerf: number) => {
      if (!active) return;
      const canvas = fallbackCanvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(400, Math.round(rect.width));
        const h = Math.max(300, Math.round(rect.height));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        const st = flightStateRef.current;
        const plan = activePlanRef.current;
        const muted = isMutedRef.current;

        if (st === 'COUNTDOWN' && plan && activeSessionIdRef.current === plan.sessionId) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900 && countdownLastStepRef.current !== 3) {
            countdownLastStepRef.current = 3;
            setCountdownLabel('3');
            audioEngineRef.current?.playCountdownBeep(3, muted);
            speakClassroomLineRef.current('Ba, hai, một, phóng!');
          } else if (cdMs >= 900 && cdMs < 1800 && countdownLastStepRef.current !== 2) {
            countdownLastStepRef.current = 2;
            setCountdownLabel('2');
            audioEngineRef.current?.playCountdownBeep(2, muted);
          } else if (cdMs >= 1800 && cdMs < 2700 && countdownLastStepRef.current !== 1) {
            countdownLastStepRef.current = 1;
            setCountdownLabel('1');
            audioEngineRef.current?.playCountdownBeep(1, muted);
          } else if (cdMs >= 2700 && cdMs < COUNTDOWN_TOTAL_MS && countdownLastStepRef.current !== 0) {
            countdownLastStepRef.current = 0;
            setCountdownLabel('PHÓNG!');
            audioEngineRef.current?.playLaunchHornAndIgnition(muted);
          } else if (cdMs >= COUNTDOWN_TOTAL_MS) {
            countdownLastStepRef.current = -1;
            setCountdownLabel('');
            flightStartPerfRef.current = nowPerf;
            flightStateRef.current = 'LAUNCHING';
            setFlightState('LAUNCHING');
          }
        }

        let elapsed = 0;
        let evalRes: ReturnType<typeof evaluateSpaceRocketFrame> | null = null;
        if ((st === 'LAUNCHING' || st === 'FLYING') && plan && activeSessionIdRef.current === plan.sessionId) {
          elapsed = nowPerf - flightStartPerfRef.current;
          evalRes = evaluateSpaceRocketFrame(plan, elapsed, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;
          setElapsedDisplaySec(Math.min(plan.durationSec, elapsed / 1000));
          if (st === 'LAUNCHING' && evalRes.u >= 0.16) {
            flightStateRef.current = 'FLYING';
            setFlightState('FLYING');
          }
          if (evalRes.isFlightCompleted) {
            finishingStartPerfRef.current = nowPerf;
            flightStateRef.current = 'FINISHING';
            setFlightState('FINISHING');
            audioEngineRef.current?.playGateAndVictoryFanfare(muted);
          }
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          elapsed = plan.durationMs;
          evalRes = evaluateSpaceRocketFrame(plan, plan.durationMs, framesScratchRef.current);
          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            flightStateRef.current = 'RESULT';
            setFlightState('RESULT');
            commitRocketWinnerRef.current(plan);
          }
        }

        if (ctx) {
          draw2DFallbackSpaceLaunch(
            ctx,
            w,
            h,
            plan ? plan.rockets : previewLineupRef.current,
            evalRes ? evalRes.frames : null,
            st,
            countdownLastStepRef.current === 3
              ? '3'
              : countdownLastStepRef.current === 2
              ? '2'
              : countdownLastStepRef.current === 1
              ? '1'
              : countdownLastStepRef.current === 0
              ? 'PHÓNG!'
              : '',
            elapsed / 1000,
            plan ? plan.durationSec : durationSecRef.current,
            plan ? plan.winnerPadIndex : -1
          );
        }
      }
      raf = requestAnimationFrame(step2D);
    };
    raf = requestAnimationFrame(step2D);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
    };
  }, [rendererFallback2D]);

  // ============================================================================
  // MISSION CONTROL ACTIONS (Strict session locking against rapid double-click)
  // ============================================================================
  const startMissionLaunch = useCallback(() => {
    if (eligibleStudents.length === 0) return;
    const st = flightStateRef.current;
    if (st === 'COUNTDOWN' || st === 'LAUNCHING' || st === 'FLYING' || st === 'FINISHING') return;

    // Synchronous ref lock prevents concurrent session creation
    flightStateRef.current = 'COUNTDOWN';
    audioEngineRef.current?.unlockAndWarmup();

    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents,
      fullRoster,
      durationSec,
      heatMode,
      heatIndex: safeHeatIndex,
    });

    activeSessionIdRef.current = plan.sessionId;
    activePlanRef.current = plan;
    framesScratchRef.current = [];
    countdownLastStepRef.current = -1;
    boostAnnouncedRef.current = false;
    warpSoundPlayedRef.current = false;
    countdownStartPerfRef.current = performance.now();

    setActiveWinnerEntry(null);
    setActiveSessionId(null);
    setBonusPoints(0);
    setResultNote('');
    setNoteSaveFeedback(null);
    setCloudSyncStatus('idle');
    setElapsedDisplaySec(0);
    setCountdownLabel('3');
    setLiveTop3(
      plan.rockets.slice(0, 3).map((r) => ({
        padNumber: r.padNumber,
        displayLabel: r.displayLabel,
        progressPct: 0,
        badgeHex: r.palette.badgeHex,
      }))
    );

    rebuild3DRocketsForLineup(plan.rockets, null);
    if (musicEnabledRef.current && !isMutedRef.current) {
      audioEngineRef.current?.startSpaceMusicLoop('AMBIENT', isMutedRef.current);
    }
    setFlightState('COUNTDOWN');
  }, [durationSec, eligibleStudents, fullRoster, heatMode, rebuild3DRocketsForLineup, safeHeatIndex]);

  const resetMission = useCallback(() => {
    activeSessionIdRef.current = null;
    activePlanRef.current = null;
    countdownLastStepRef.current = -1;
    boostAnnouncedRef.current = false;
    warpSoundPlayedRef.current = false;
    audioEngineRef.current?.stopThrusterLoop();
    audioEngineRef.current?.stopSpaceMusicLoop();
    voiceManagerRef.current?.cancel();
    setCountdownLabel('');
    setElapsedDisplaySec(0);
    setVoiceCaption('');
    setActiveWinnerEntry(null);
    setActiveSessionId(null);
    setNoteSaveFeedback(null);
    setCloudSyncStatus('idle');
    rebuild3DRocketsForLineup(previewData.lineup, null);
    const nextState: SpaceRocket3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
    flightStateRef.current = nextState;
    setFlightState(nextState);
  }, [eligibleStudents.length, previewData.lineup, rebuild3DRocketsForLineup]);

  const handleSaveBonusAndNote = useCallback(async () => {
    if (!activeWinnerEntry || !activeSessionId || !activePlanRef.current) return;
    const combinedNote = formatSpaceRocketResultNote(bonusPoints, resultNote);

    onUpdateLatestNote?.(combinedNote);

    const updated = turnRecords.map((rec) =>
      rec.sessionId === activeSessionId
        ? { ...rec, bonusPoints, note: resultNote.trim() }
        : rec
    );
    persistLocalRecords(updated);

    setCloudSyncStatus('saving');
    const status = await syncTurnToSupabase(
      activePlanRef.current,
      activeWinnerEntry,
      bonusPoints,
      resultNote.trim()
    );
    if (!isMountedRef.current) return;
    setCloudSyncStatus(status);
    setNoteSaveFeedback('Đã lưu điểm thưởng & ghi chú!');
    if (noteTimeoutRef.current) clearTimeout(noteTimeoutRef.current);
    noteTimeoutRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setNoteSaveFeedback(null);
    }, 2600);
  }, [
    activeSessionId,
    activeWinnerEntry,
    bonusPoints,
    onUpdateLatestNote,
    persistLocalRecords,
    resultNote,
    syncTurnToSupabase,
    turnRecords,
  ]);

  // Classroom Projector Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        const st = flightStateRef.current;
        if (st === 'READY' || st === 'RESULT') startMissionLaunch();
      } else if (e.key === '1') {
        setAutoCamera(false);
        setCameraMode('LAUNCHPAD_WIDE');
      } else if (e.key === '2') {
        setAutoCamera(false);
        setCameraMode('TRACKING_CLIMB');
      } else if (e.key === '3') {
        setAutoCamera(false);
        setCameraMode('HERO_ASCENT');
      } else if (e.key === '4') {
        setAutoCamera(false);
        setCameraMode('COSMIC_AERIAL');
      } else if (e.key === '5') {
        setAutoCamera(false);
        setCameraMode('FINISH_GATE');
      } else if (e.key === 'm' || e.key === 'M') {
        onToggleMute?.();
      } else if (e.key === 'f' || e.key === 'F') {
        if (onToggleFullscreen) onToggleFullscreen();
        else setIsPresentationMode((v) => !v);
      } else if (e.key === 'r' || e.key === 'R') {
        resetMission();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleFullscreen, onToggleMute, resetMission, startMissionLaunch]);

  const isBusyFlight =
    flightState === 'COUNTDOWN' ||
    flightState === 'LAUNCHING' ||
    flightState === 'FLYING' ||
    flightState === 'FINISHING';

  const presentTotal = fullRoster.filter((s) => !absentIds?.has(s.id)).length;
  const absentCount = absentIds ? absentIds.size : 0;
  const calledCount = calledSessionIds ? calledSessionIds.size : 0;

  return (
    <div
      className={`w-full flex flex-col bg-[#081B38] text-white select-none overflow-hidden ${
        isFullscreen
          ? 'h-dvh w-screen rounded-none border-0'
          : isPresentationMode
          ? 'fixed inset-0 z-50 h-dvh w-screen rounded-none border-0'
          : 'rounded-3xl border border-[#113E79] shadow-2xl min-h-[650px]'
      }`}
    >
      {/* ====================================================================
          TOP COMPACT CONTROL BAR (Teacher & Projector Controls)
         ==================================================================== */}
      <div className="bg-[#0B2246] border-b border-white/10 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {onCloseGame && (
            <button
              type="button"
              onClick={onCloseGame}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Trở về thư viện trò chơi"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thư viện</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-[#081B38] border border-[#00C8FF]/40 rounded-xl px-2.5 py-1 shrink-0">
            <span className="px-1.5 py-0.5 bg-[#FFD54F] text-[#081B38] rounded text-[11px] font-black tracking-wide">
              A07
            </span>
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-white whitespace-nowrap">
              TÊN LỬA 3D
            </h2>
          </div>

          {classes.length > 0 && onSelectSourceKey ? (
            <select
              value={selectedSourceKey}
              onChange={(e) => onSelectSourceKey(e.target.value)}
              disabled={isBusyFlight}
              className="bg-[#081B38] border border-[#00C8FF]/40 text-white text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer disabled:opacity-50 max-w-[180px]"
              aria-label="Chọn lớp học"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-[#081B38] text-white">
                  Lớp {cls.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2.5 py-1 bg-[#081B38] border border-[#00C8FF]/30 rounded-xl text-xs font-bold text-[#00C8FF] whitespace-nowrap">
              {resolvedClassName}
            </span>
          )}

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300 tabular-nums whitespace-nowrap">
            <span>
              Sẵn sàng: <strong className="text-[#FFD54F]">{eligibleStudents.length}</strong>/{presentTotal}
            </span>
            {absentCount > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-rose-300">Vắng: {absentCount}</span>
              </>
            )}
            <span className="hidden md:inline" aria-hidden="true">·</span>
            <span className="hidden md:inline text-slate-300">Đã gọi: {calledCount}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onToggleAntiDuplicate && (
            <button
              type="button"
              onClick={onToggleAntiDuplicate}
              disabled={isBusyFlight}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${
                antiDuplicate
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              }`}
              title="Bật/Tắt chống gọi trùng trong phiên"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{antiDuplicate ? 'Chống trùng: BẬT' : 'Chống trùng: TẮT'}</span>
            </button>
          )}

          {/* Speed / Flight Duration Selector */}
          <div className="flex items-center bg-[#081B38] border border-white/15 rounded-xl p-0.5 shrink-0">
            {(
              [
                { sec: 5 as SpaceRocketDurationSec, label: 'Nhanh 5s' },
                { sec: 10 as SpaceRocketDurationSec, label: 'Thường 10s' },
                { sec: 15 as SpaceRocketDurationSec, label: 'Kịch tính 15s' },
              ]
            ).map((opt) => (
              <button
                key={opt.sec}
                type="button"
                disabled={isBusyFlight}
                onClick={() => setDurationSec(opt.sec)}
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                  durationSec === opt.sec
                    ? 'bg-[#FFD54F] text-[#081B38]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 3D Quality Preset */}
          <button
            type="button"
            onClick={() =>
              setQualityPreset((q) => (q === 'HIGH' ? 'MEDIUM' : q === 'MEDIUM' ? 'LOW' : 'HIGH'))
            }
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
            title="Chế độ đồ họa: High Quality / Balanced / Performance"
          >
            <Sliders className="w-3.5 h-3.5 text-[#00C8FF]" />
            <span>{qualityPreset === 'HIGH' ? '3D Cao' : qualityPreset === 'MEDIUM' ? 'Cân bằng' : '3D Nhẹ'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border whitespace-nowrap shrink-0 ${
              reducedMotion
                ? 'bg-[#00C8FF]/25 border-[#00C8FF]/60 text-[#00C8FF]'
                : 'bg-white/10 border-transparent text-slate-200 hover:bg-white/20'
            }`}
            title="Chế độ giảm chuyển động & hiệu ứng nhấp nháy"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{reducedMotion ? 'Giảm CĐ: BẬT' : 'Giảm CĐ'}</span>
          </button>

          {/* Music Toggle */}
          <button
            type="button"
            onClick={() => setMusicEnabled((v) => !v)}
            className={`p-1.5 rounded-xl text-[11px] font-bold cursor-pointer border shrink-0 ${
              musicEnabled && !isMuted
                ? 'bg-[#113E79] border-[#00C8FF]/50 text-[#00C8FF]'
                : 'bg-white/10 border-transparent text-slate-400'
            }`}
            title={musicEnabled ? 'Tắt nhạc nền vũ trụ' : 'Bật nhạc nền vũ trụ'}
          >
            <Music className="w-4 h-4" />
          </button>

          {/* Vietnamese Voice Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowVoicePanel((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer border whitespace-nowrap shrink-0 ${
              showVoicePanel
                ? 'bg-[#FFD54F] text-[#081B38] border-[#FFD54F]'
                : voicePrefs.enabled
                ? 'bg-[#113E79] border-[#00C8FF]/45 text-white'
                : 'bg-white/10 border-transparent text-slate-300'
            }`}
            title="Cài đặt giọng đọc tiếng Việt (Nam/Nữ · Bắc/Trung/Nam)"
          >
            {voicePrefs.enabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Giọng Việt</span>
          </button>

          {onOpenAbsentModal && (
            <button
              type="button"
              onClick={onOpenAbsentModal}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Điểm danh / Học sinh vắng"
            >
              <Users className="w-3.5 h-3.5 text-[#00C8FF]" />
              <span className="hidden lg:inline">Vắng / DS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRecordsDrawer((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              showRecordsDrawer
                ? 'bg-[#FFD54F] text-[#081B38]'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Lịch sử phóng tên lửa"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lịch sử ({turnRecords.length})</span>
          </button>

          {onOpenHistoryModal && (
            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-[#00C8FF] cursor-pointer shrink-0"
              title="Lịch sử chung toàn bộ trò chơi"
            >
              <Award className="w-3.5 h-3.5" />
            </button>
          )}

          {onResetSession && (
            <button
              type="button"
              onClick={() => {
                resetMission();
                onResetSession();
              }}
              disabled={isBusyFlight}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              title="Làm mới chu kỳ cả lớp"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FFD54F]" />
              <span className="hidden xl:inline">Làm mới chu kỳ</span>
            </button>
          )}

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer shrink-0"
              title={isMuted ? 'Bật âm thanh (M)' : 'Tắt âm thanh (M)'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-300" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#00C8FF]" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onToggleFullscreen) onToggleFullscreen();
              else setIsPresentationMode((v) => !v);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#FF7A21] hover:bg-orange-500 text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title="Trình chiếu toàn màn hình 16:9 (F)"
          >
            {isFullscreen || isPresentationMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Trình chiếu</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ====================================================================
          SECONDARY BAR: 5 CINEMATIC CAMERAS + FAIRNESS HEAT MODE
         ==================================================================== */}
      <div className="bg-[#091F40] border-b border-white/10 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mr-1 whitespace-nowrap">
            <Camera className="w-3.5 h-3.5 text-[#00C8FF]" />
            Camera:
          </span>
          {(
            [
              { key: 'LAUNCHPAD_WIDE', label: '1 · Bệ phóng' },
              { key: 'TRACKING_CLIMB', label: '2 · Bám tên lửa' },
              { key: 'HERO_ASCENT', label: '3 · Ngước tăng tốc' },
              { key: 'COSMIC_AERIAL', label: '4 · Vũ trụ rộng' },
              { key: 'FINISH_GATE', label: '5 · Cổng không gian' },
            ] as Array<{ key: SpaceRocketCameraMode; label: string }>
          ).map((cam) => (
            <button
              key={cam.key}
              type="button"
              onClick={() => {
                setAutoCamera(false);
                setCameraMode(cam.key);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                !autoCamera && cameraMode === cam.key
                  ? 'bg-[#00C8FF] text-[#081B38]'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAutoCamera((v) => !v)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer whitespace-nowrap border ${
              autoCamera
                ? 'bg-[#FFD54F] text-[#081B38] border-[#FFD54F]'
                : 'bg-white/5 text-slate-300 border-white/15 hover:bg-white/15'
            }`}
          >
            {autoCamera ? 'Tự động: BẬT' : 'Tự động: TẮT'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {eligibleStudents.length > MAX_ROCKET_PADS ? (
            <>
              <div className="flex items-center bg-[#081B38] rounded-lg p-0.5 border border-white/10">
                <button
                  type="button"
                  disabled={isBusyFlight}
                  onClick={() => setHeatMode('REPRESENTATIVE_FAIR')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                    heatMode === 'REPRESENTATIVE_FAIR'
                      ? 'bg-[#00C8FF] text-[#081B38]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Chọn công bằng 1/N từ toàn bộ sĩ số sẵn sàng, hiển thị trên 6 bệ phóng"
                >
                  Gọi 1 HS công bằng (1/{eligibleStudents.length})
                </button>
                <button
                  type="button"
                  disabled={isBusyFlight}
                  onClick={() => setHeatMode('BRACKET_HEATS')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                    heatMode === 'BRACKET_HEATS'
                      ? 'bg-[#00C8FF] text-[#081B38]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Phóng nhiều đợt theo bảng 6 tên lửa"
                >
                  Chia đợt ({heatBuckets.length} đợt)
                </button>
              </div>

              {heatMode === 'BRACKET_HEATS' && heatBuckets.length > 1 && (
                <div className="flex items-center gap-1 bg-[#081B38] border border-white/15 rounded-lg px-1.5 py-0.5">
                  <button
                    type="button"
                    disabled={isBusyFlight || safeHeatIndex === 0}
                    onClick={() => setHeatIndex((i) => Math.max(0, i - 1))}
                    className="p-0.5 hover:bg-white/15 rounded disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold text-[#FFD54F] px-1 tabular-nums whitespace-nowrap">
                    Đợt {safeHeatIndex + 1}/{heatBuckets.length}
                  </span>
                  <button
                    type="button"
                    disabled={isBusyFlight || safeHeatIndex >= heatBuckets.length - 1}
                    onClick={() => setHeatIndex((i) => Math.min(heatBuckets.length - 1, i + 1))}
                    className="p-0.5 hover:bg-white/15 rounded disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-[11px] font-bold text-[#00C8FF] whitespace-nowrap">
              Đủ {eligibleStudents.length} bệ phóng tên lửa 3D trên sân phóng
            </span>
          )}
        </div>
      </div>

      {/* ====================================================================
          MAIN 3D COSMOS ARENA STAGE + NON-OCCLUDING HUD
         ==================================================================== */}
      <div className="relative flex-1 min-h-[470px] lg:min-h-[550px] w-full bg-[#081B38] overflow-hidden">
        <div
          ref={stageMountRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'hidden' : 'block'}`}
        />

        <canvas
          ref={fallbackCanvasRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'block' : 'hidden'}`}
        />

        {/* Top-Left Live Mission Timer & Altitude Standings */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none max-w-[300px]">
          <div className="bg-[#081B38]/92 border border-[#00C8FF]/45 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FFD54F]" />
              <span className="text-sm sm:text-base font-black tabular-nums text-white">
                {elapsedDisplaySec.toFixed(1)}s
              </span>
              <span className="text-xs font-bold text-slate-300 tabular-nums">/ {durationSec}s</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                flightState === 'FLYING' || flightState === 'LAUNCHING'
                  ? 'bg-[#FF7A21] text-white'
                  : flightState === 'COUNTDOWN'
                  ? 'bg-[#FFD54F] text-[#081B38]'
                  : flightState === 'FINISHING' || flightState === 'RESULT'
                  ? 'bg-[#00C8FF] text-[#081B38]'
                  : 'bg-white/15 text-slate-200'
              }`}
            >
              {flightState === 'IDLE'
                ? 'HẾT LƯỢT'
                : flightState === 'READY'
                ? 'SẴN SÀNG'
                : flightState === 'COUNTDOWN'
                ? 'ĐẾM NGƯỢC'
                : flightState === 'LAUNCHING'
                ? 'RỜI BỆ PHÓNG'
                : flightState === 'FLYING'
                ? 'VÀO VŨ TRỤ'
                : flightState === 'FINISHING'
                ? 'VỀ ĐÍCH'
                : 'HOÀN TẤT'}
            </span>
          </div>

          {liveTop3.length > 0 &&
            (flightState === 'LAUNCHING' || flightState === 'FLYING' || flightState === 'FINISHING') && (
              <div className="bg-[#081B38]/92 border border-white/15 rounded-2xl px-3 py-2 shadow-lg space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#00C8FF]">
                  Độ cao trực tiếp
                </div>
                {liveTop3.map((item, idx) => (
                  <div key={item.padNumber} className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
                        style={{ backgroundColor: item.badgeHex }}
                      >
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white truncate">{item.displayLabel}</span>
                    </div>
                    <span className="font-black text-[#FFD54F] tabular-nums shrink-0">
                      {item.progressPct}%
                    </span>
                  </div>
                ))}
              </div>
            )}

          {voiceCaption && (
            <div className="bg-[#081B38]/92 border border-[#FFD54F]/45 rounded-xl px-3 py-1.5 text-xs font-bold text-[#FFD54F] shadow-md">
              {voiceCaption}
            </div>
          )}
        </div>

        {/* Center Countdown Signal (3 - 2 - 1 - PHÓNG!) */}
        {flightState === 'COUNTDOWN' && countdownLabel && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#081B38]/94 border-4 border-[#FFD54F] rounded-3xl px-10 py-6 shadow-2xl text-center">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#00C8FF] mb-1">
                KÍCH HOẠT ĐỘNG CƠ TÊN LỬA
              </div>
              <div className="text-5xl sm:text-6xl font-black text-[#FFD54F] tracking-tight">
                {countdownLabel}
              </div>
            </div>
          </div>
        )}

        {/* Vietnamese Voice Customization Popover Panel */}
        {showVoicePanel && (
          <div className="absolute top-3 right-3 z-30 w-[calc(100%-24px)] sm:w-[360px] bg-[#081B38]/96 border-2 border-[#00C8FF]/65 rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#FFD54F]" />
                <h4 className="text-sm font-black text-white">Giọng đọc tiếng Việt</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowVoicePanel(false)}
                className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer"
              >
                Đóng
              </button>
            </div>

            <div className="flex items-center justify-between bg-[#113E79]/60 rounded-2xl px-3 py-2">
              <span className="text-xs font-bold text-white">Bật giọng đọc MC lớp học</span>
              <button
                type="button"
                onClick={() => setVoicePrefs((p) => ({ ...p, enabled: !p.enabled }))}
                className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer ${
                  voicePrefs.enabled
                    ? 'bg-[#00C8FF] text-[#081B38]'
                    : 'bg-white/15 text-slate-300'
                }`}
              >
                {voicePrefs.enabled ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300">Giới tính giọng đọc:</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { key: 'AUTO', label: 'Tự động' },
                    { key: 'FEMALE', label: 'Giọng Nữ' },
                    { key: 'MALE', label: 'Giọng Nam' },
                  ] as Array<{ key: RocketVoiceGender; label: string }>
                ).map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setVoicePrefs((p) => ({ ...p, gender: g.key }))}
                    className={`py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                      voicePrefs.gender === g.key
                        ? 'bg-[#FFD54F] text-[#081B38]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold text-slate-300">Vùng miền (tiếng Việt):</div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { key: 'AUTO', label: 'Tự động' },
                    { key: 'BAC', label: 'Bắc' },
                    { key: 'TRUNG', label: 'Trung' },
                    { key: 'NAM', label: 'Nam Bộ' },
                  ] as Array<{ key: RocketVoiceRegion; label: string }>
                ).map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setVoicePrefs((p) => ({ ...p, region: r.key }))}
                    className={`py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                      voicePrefs.region === r.key
                        ? 'bg-[#00C8FF] text-[#081B38]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {voiceAvailability.hasVietnameseVoice ? (
              <div className="bg-emerald-500/15 border border-emerald-400/40 rounded-xl px-3 py-2 text-[11px] text-emerald-200">
                Đang dùng giọng Việt: <strong>{voiceAvailability.selectedVoiceName}</strong> (
                {voiceAvailability.selectedVoiceLang})
              </div>
            ) : (
              <div className="bg-amber-500/15 border border-amber-400/45 rounded-xl px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
                Thiết bị chưa cài gói giọng tiếng Việt (`vi-VN`). Hệ thống giữ chữ hiển thị tiếng
                Việt và hiệu ứng âm thanh, không tự chuyển sang tiếng Anh.
              </div>
            )}

            <button
              type="button"
              onClick={() => speakClassroomLine('Các phi hành gia đã sẵn sàng!')}
              className="w-full py-2 rounded-xl bg-[#FF7A21] hover:bg-orange-500 text-white text-xs font-black cursor-pointer"
            >
              Nghe thử: "Các phi hành gia đã sẵn sàng!"
            </button>
          </div>
        )}

        {/* Empty Eligible Roster Guard */}
        {eligibleStudents.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#081B38]/88">
            <div className="bg-[#0B2246] border-2 border-[#FFD54F] rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFD54F]/20 border border-[#FFD54F]/50 flex items-center justify-center">
                <UserCheck className="w-7 h-7 text-[#FFD54F]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white">
                  {presentTotal === 0
                    ? 'Chưa có học sinh trên bệ phóng'
                    : 'Đã gọi hết 100% học sinh có mặt!'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {presentTotal === 0
                    ? 'Vui lòng chọn lớp hoặc bỏ đánh dấu vắng để đưa học sinh lên bệ phóng tên lửa.'
                    : 'Chống trùng đang BẬT để đảm bảo công bằng. Bấm Làm mới chu kỳ để bắt đầu vòng mới.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {presentTotal > 0 && onResetSession && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetSession();
                      resetMission();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#FFD54F] hover:bg-amber-300 text-[#081B38] font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Làm mới chu kỳ
                  </button>
                )}
                {onOpenAbsentModal && (
                  <button
                    type="button"
                    onClick={onOpenAbsentModal}
                    className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm cursor-pointer"
                  >
                    Quản lý danh sách
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Compact Winner Result Card (Never obscures 3D Rocket & Golden Trophy) */}
        {flightState === 'RESULT' && activeWinnerEntry && (
          <div className="absolute top-3 right-3 z-20 w-[calc(100%-24px)] sm:w-[375px] bg-[#081B38]/96 border-2 border-[#FFD54F] rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FFD54F] text-[#081B38] flex items-center justify-center shrink-0 shadow-md">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-[#FFD54F]">
                    PHI HÀNH GIA CHIẾN THẮNG · BỆ #{activeWinnerEntry.padNumber}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                    {activeWinnerEntry.safeName}
                  </h3>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-[#00C8FF]/20 border border-[#00C8FF]/45 text-[11px] font-extrabold text-[#00C8FF] shrink-0 tabular-nums">
                #{activeWinnerEntry.formattedStt}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200 bg-[#113E79]/60 rounded-xl px-3 py-2 border border-white/10">
              <span>
                Mã HS: <strong className="text-[#FFD54F]">{activeWinnerEntry.safeCode}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Lớp: <strong className="text-white">{resolvedClassName}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{durationSec}s</span>
              <span aria-hidden="true">·</span>
              <span className={antiDuplicate ? 'text-emerald-300' : 'text-amber-300'}>
                {antiDuplicate ? 'Chống trùng BẬT' : 'Chống trùng TẮT'}
              </span>
            </div>

            {/* Quick Bonus Points */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Điểm thưởng nhanh:</span>
                {bonusPoints > 0 && (
                  <span className="text-[#FFD54F] font-black tabular-nums">+{bonusPoints} điểm</span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 5, 10].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setBonusPoints(pts)}
                    className={`py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer tabular-nums ${
                      bonusPoints === pts
                        ? 'bg-[#FFD54F] text-[#081B38]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {pts === 0 ? '0đ' : `+${pts}đ`}
                  </button>
                ))}
              </div>
            </div>

            {/* Note + Save */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
                placeholder="Ghi chú nhận xét nhanh..."
                className="flex-1 bg-[#113E79]/55 border border-white/20 focus:border-[#00C8FF] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveBonusAndNote}
                className="px-3 py-2 rounded-xl bg-[#00C8FF] hover:bg-sky-300 text-[#081B38] text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
            </div>

            {/* Cloud Sync Status */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 flex items-center gap-1">
                {cloudSyncStatus === 'saving' ? (
                  <>Đang đồng bộ kết quả...</>
                ) : cloudSyncStatus === 'saved' ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Đã lưu Cloud & Máy</span>
                  </>
                ) : cloudSyncStatus === 'error' ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300">Đã lưu tại máy</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#00C8FF]" />
                    <span className="text-[#00C8FF]">Đã lưu phiên tại máy</span>
                  </>
                )}
              </span>
              {noteSaveFeedback && (
                <span className="text-[#FFD54F] font-extrabold">{noteSaveFeedback}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={startMissionLaunch}
                disabled={eligibleStudents.length === 0}
                className="py-2.5 px-3 rounded-xl bg-[#FFD54F] hover:bg-amber-300 text-[#081B38] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>Chơi tiếp</span>
              </button>
              <button
                type="button"
                onClick={resetMission}
                className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm mới</span>
              </button>
            </div>
          </div>
        )}

        {/* Turn History Drawer */}
        {showRecordsDrawer && (
          <div className="absolute top-3 right-3 z-30 w-[calc(100%-24px)] sm:w-[390px] max-h-[82%] bg-[#081B38]/96 border-2 border-[#00C8FF]/65 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#FFD54F]" />
                <h4 className="text-sm font-black text-white">
                  Lịch sử Tên Lửa 3D ({turnRecords.length})
                </h4>
              </div>
              <div className="flex items-center gap-1.5">
                {turnRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => persistLocalRecords([])}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 text-[11px] font-bold cursor-pointer"
                  >
                    Xóa log máy
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowRecordsDrawer(false)}
                  className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="overflow-y-auto space-y-2 pr-1">
              {turnRecords.length === 0 ? (
                <p className="text-xs text-slate-300 text-center py-6">
                  Chưa có lượt phóng tên lửa nào được ghi nhận cho lớp này.
                </p>
              ) : (
                turnRecords.map((rec) => (
                  <div
                    key={rec.sessionId}
                    className="bg-[#113E79]/45 border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">
                        #{rec.turnIndex} · {rec.studentName}
                      </div>
                      <div className="text-[11px] text-slate-300 flex flex-wrap gap-1.5 tabular-nums">
                        <span>STT #{rec.formattedStt}</span>
                        <span>·</span>
                        <span>Bệ {rec.padNumber}</span>
                        <span>·</span>
                        <span>{rec.durationSec}s</span>
                        {rec.bonusPoints > 0 && (
                          <span className="text-[#FFD54F] font-black">+{rec.bonusPoints}đ</span>
                        )}
                      </div>
                      {rec.note && (
                        <div className="text-[11px] text-[#00C8FF] truncate mt-0.5">{rec.note}</div>
                      )}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        rec.cloudStatus === 'saved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {rec.cloudStatus === 'saved' ? 'Cloud' : 'Máy'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Bottom Primary Control Dock */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-2.5 px-3 w-full max-w-2xl pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 bg-[#081B38]/92 border border-[#00C8FF]/45 rounded-2xl px-3.5 py-2 shadow-2xl">
            {(flightState === 'READY' || flightState === 'IDLE' || flightState === 'RESULT') && (
              <button
                type="button"
                disabled={eligibleStudents.length === 0}
                onClick={startMissionLaunch}
                className="px-6 py-2.5 rounded-xl bg-[#FF7A21] hover:bg-orange-500 text-white font-black text-sm sm:text-base flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <Rocket className="w-5 h-5" />
                <span>{flightState === 'RESULT' ? 'CHƠI TIẾP (Space)' : 'BẮT ĐẦU PHÓNG (Space)'}</span>
              </button>
            )}

            {flightState === 'COUNTDOWN' && (
              <div className="px-5 py-2 rounded-xl bg-[#113E79] border border-[#00C8FF]/50 text-[#FFD54F] font-black text-sm whitespace-nowrap">
                Đang đếm ngược phóng tên lửa...
              </div>
            )}

            {(flightState === 'LAUNCHING' || flightState === 'FLYING') && (
              <div className="px-5 py-2 rounded-xl bg-[#113E79] border border-[#00C8FF]/50 text-[#00C8FF] font-black text-sm flex items-center gap-2 whitespace-nowrap">
                <Play className="w-4 h-4 fill-[#00C8FF]" />
                <span>TÊN LỬA ĐANG BAY VÀO VŨ TRỤ...</span>
              </div>
            )}

            {flightState === 'FINISHING' && (
              <div className="px-5 py-2 rounded-xl bg-[#FFD54F] text-[#081B38] font-black text-sm flex items-center gap-2 whitespace-nowrap">
                <Trophy className="w-4 h-4" />
                <span>ĐANG VƯỢT CỔNG KHÔNG GIAN!</span>
              </div>
            )}

            {isBusyFlight && (
              <button
                type="button"
                onClick={resetMission}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Hủy lượt hiện tại và đưa tên lửa về bệ phóng (R)"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm mới</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          FOOTER LAUNCHPAD LINEUP STRIP
         ==================================================================== */}
      <div className="bg-[#081B38] border-t border-white/10 px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[11px] font-extrabold text-[#00C8FF] uppercase tracking-wider shrink-0">
          Bệ phóng ({(activePlanRef.current && (isBusyFlight || flightState === 'RESULT')
            ? activePlanRef.current.rockets
            : previewData.lineup
          ).length}):
        </span>
        {(activePlanRef.current && (isBusyFlight || flightState === 'RESULT')
          ? activePlanRef.current.rockets
          : previewData.lineup
        ).map((r) => {
          const isWin = flightState === 'RESULT' && activeWinnerEntry?.student.id === r.student.id;
          return (
            <div
              key={`${r.padNumber}_${r.student.id}`}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 border ${
                isWin
                  ? 'bg-[#FFD54F] text-[#081B38] border-white font-black'
                  : 'bg-[#113E79]/60 text-slate-100 border-white/15'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: r.palette.accentHex }}
              />
              <span>Bệ {r.padNumber}:</span>
              <span className="truncate max-w-[140px]">{r.displayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SpaceRocket3DGame;
