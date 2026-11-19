import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { StudentCandidate } from '../studentCallRules';
import { ClassRoom } from '../../../types';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import {
  EduGameSoundBank,
  EduGameVoiceController,
  loadEduGameVoiceEnabled,
  saveEduGameVoiceEnabled,
} from '../../../utils/eduGameAudioController';
import {
  HorseRace3DState,
  HorseRaceDurationSec,
  HorseRaceCameraMode,
  HorseRaceHeatMode,
  HorseRaceQualityPreset,
  HorseRacerEntry,
  HorseRaceTurnPlan,
  HorseRaceTurnRecord,
  HorseFrameState,
  MAX_HORSE_LANES,
  TRACK_START_X,
  TRACK_FINISH_X,
  TRACK_LENGTH,
  LANE_SPACING,
  COUNTDOWN_TOTAL_MS,
  FINISHING_SLOWMO_MS,
  computeHorseHeatBuckets,
  buildHorsePreviewLineup,
  createFairHorseRaceTurnPlan,
  evaluateHorseRaceFrame,
  HorseRaceTurnDeduplicator,
  formatHorseResultNote,
} from './horseRace3dMath';
import {
  Play,
  Pause,
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
  Flag,
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
} from 'lucide-react';

export interface HorseRace3DGameProps {
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

const LOCAL_RECORDS_PREFIX = 'taydo_a06_horserace3d_records_v1';

// Pre-allocated scratch math objects (zero allocations inside RAF loop)
const _tmpVecA = new THREE.Vector3();
const _tmpMatrix = new THREE.Matrix4();
const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();

// Audio & strict Vietnamese voice synthesis are managed via shared EduGameSoundBank & EduGameVoiceController.

// ============================================================================
// PROCEDURAL TEXTURE BUILDERS (High-DPI CanvasTextures, SRGBColorSpace)
// ============================================================================
function createSandTrackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm compacted equestrian dirt/sand base
  ctx.fillStyle = '#C99B63';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle horizontal harrowed dirt furrows & natural pebbles
  for (let y = 0; y < 512; y += 8) {
    ctx.fillStyle = y % 16 === 0 ? 'rgba(139, 90, 43, 0.08)' : 'rgba(245, 222, 179, 0.08)';
    ctx.fillRect(0, y, 512, 4);
  }
  for (let i = 0; i < 2400; i++) {
    const px = (i * 73) % 512;
    const py = (i * 139) % 512;
    const sz = (i % 3) + 1;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(110, 68, 32, 0.14)' : 'rgba(252, 234, 198, 0.14)';
    ctx.fillRect(px, py, sz, sz);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createTurfTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2E7D32';
  ctx.fillRect(0, 0, 512, 512);

  // Mowed stadium turf stripes
  for (let x = 0; x < 512; x += 64) {
    ctx.fillStyle = (x / 64) % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, 0, 64, 512);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createGateBannerTexture(
  titleText: string,
  subText: string,
  bgHex: string,
  borderHex: string,
  titleHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 30);
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = borderHex;
  ctx.stroke();

  const sq = 22;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#FFFFFF' : '#0F2942';
      ctx.fillRect(34 + c * sq, 46 + r * sq, sq, sq);
      ctx.fillRect(canvas.width - 34 - (3 - c) * sq, 46 + r * sq, sq, sq);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = titleHex;
  ctx.font = '900 62px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(titleText, canvas.width / 2, 90);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 32px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
  ctx.fillText(subText, canvas.width / 2, 156);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createSaddleNumberTexture(
  laneNumber: number,
  saddleHex: string,
  trimHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = saddleHex;
  ctx.fillRect(0, 0, 160, 160);

  ctx.strokeStyle = trimHex;
  ctx.lineWidth = 12;
  ctx.strokeRect(10, 10, 140, 140);

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(80, 80, 48, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 64px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(String(laneNumber), 80, 84);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHorseNameplateTexture(
  racer: HorseRacerEntry,
  isHighlightedWinner: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 580;
  canvas.height = 148;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = isHighlightedWinner ? '#FACC15' : 'rgba(15, 23, 42, 0.94)';
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 26);
  ctx.fill();

  ctx.lineWidth = isHighlightedWinner ? 7 : 5;
  ctx.strokeStyle = isHighlightedWinner ? '#FFFFFF' : racer.palette.saddleHex;
  ctx.stroke();

  // Lane Number Box
  ctx.fillStyle = racer.palette.saddleHex;
  ctx.beginPath();
  ctx.roundRect(26, 28, 92, 92, 20);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 42px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`${racer.laneNumber}`, 72, 75);

  // Student Full Name & STT/Code
  ctx.textAlign = 'left';
  ctx.fillStyle = isHighlightedWinner ? '#0F172A' : '#FFFFFF';
  ctx.font = '800 35px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(racer.displayLabel, 134, 58, 420);

  ctx.fillStyle = isHighlightedWinner ? '#1E3A8A' : '#93C5FD';
  ctx.font = '700 25px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`STT #${racer.formattedStt} · ${racer.safeCode}`, 134, 103, 420);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(4, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function drawScoreboardCanvas(
  ctx: CanvasRenderingContext2D,
  statusText: string,
  timerText: string,
  leaderText: string
) {
  const w = 1024;
  const h = 320;
  ctx.fillStyle = '#091529';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  // Top Header Strip
  ctx.fillStyle = '#14294A';
  ctx.fillRect(24, 24, w - 48, 72);

  ctx.fillStyle = '#FACC15';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '900 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('TÂY ĐÔ DERBY · ĐUA NGỰA 3D', 46, 62);

  ctx.fillStyle = '#38BDF8';
  ctx.textAlign = 'right';
  ctx.font = '800 30px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(statusText, w - 46, 62);

  // Center Digital Timer
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.font = '900 84px monospace';
  ctx.fillText(timerText, w / 2, 174);

  // Bottom Leader Strip
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(leaderText, w / 2, 258, w - 90);
}

// ============================================================================
// ARTICULATED PROCEDURAL 3D HORSE RIG (12+ Anatomical & Sport Components)
// Grounded bottom-center at y = 0.0 (hooves touch track cleanly)
// ============================================================================
interface HorseLegJoints {
  upperPivot: THREE.Group;
  lowerPivot: THREE.Group;
}

interface HorseRig3D {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  neckGroup: THREE.Group;
  headGroup: THREE.Group;
  tailUpper: THREE.Group;
  tailLower: THREE.Group;
  maneMeshes: THREE.Mesh[];
  legFL: HorseLegJoints;
  legFR: HorseLegJoints;
  legBL: HorseLegJoints;
  legBR: HorseLegJoints;
  nameSprite: THREE.Sprite;
  nameMaterial: THREE.SpriteMaterial;
  haloRing: THREE.Mesh;
  racer: HorseRacerEntry;
}

interface SharedHorseGeometries {
  chest: THREE.SphereGeometry;
  barrel: THREE.CapsuleGeometry;
  rump: THREE.SphereGeometry;
  neck: THREE.CylinderGeometry;
  head: THREE.BoxGeometry;
  muzzle: THREE.CylinderGeometry;
  ear: THREE.ConeGeometry;
  eye: THREE.SphereGeometry;
  eyeHighlight: THREE.SphereGeometry;
  maneTuft: THREE.BoxGeometry;
  tailSeg: THREE.ConeGeometry;
  upperLeg: THREE.CylinderGeometry;
  lowerLeg: THREE.CylinderGeometry;
  hoof: THREE.CylinderGeometry;
  saddlePad: THREE.BoxGeometry;
  saddleSeat: THREE.CapsuleGeometry;
  numberPatch: THREE.PlaneGeometry;
  jockeyTorso: THREE.CapsuleGeometry;
  jockeyHead: THREE.SphereGeometry;
  helmetVisor: THREE.BoxGeometry;
  contactShadow: THREE.CircleGeometry;
  halo: THREE.RingGeometry;
}

function createSharedHorseGeometries(): SharedHorseGeometries {
  const barrel = new THREE.CapsuleGeometry(0.27, 0.56, 8, 16);
  barrel.rotateZ(Math.PI / 2);

  const saddleSeat = new THREE.CapsuleGeometry(0.14, 0.24, 6, 12);
  saddleSeat.rotateZ(Math.PI / 2);

  return {
    chest: new THREE.SphereGeometry(0.29, 18, 14),
    barrel,
    rump: new THREE.SphereGeometry(0.30, 18, 14),
    neck: new THREE.CylinderGeometry(0.13, 0.22, 0.56, 14),
    head: new THREE.BoxGeometry(0.34, 0.19, 0.18),
    muzzle: new THREE.CylinderGeometry(0.068, 0.095, 0.24, 12),
    ear: new THREE.ConeGeometry(0.036, 0.12, 8),
    eye: new THREE.SphereGeometry(0.028, 10, 8),
    eyeHighlight: new THREE.SphereGeometry(0.011, 6, 6),
    maneTuft: new THREE.BoxGeometry(0.08, 0.12, 0.055),
    tailSeg: new THREE.ConeGeometry(0.08, 0.42, 10),
    upperLeg: new THREE.CylinderGeometry(0.082, 0.058, 0.42, 10),
    lowerLeg: new THREE.CylinderGeometry(0.052, 0.042, 0.34, 10),
    hoof: new THREE.CylinderGeometry(0.05, 0.062, 0.08, 10),
    saddlePad: new THREE.BoxGeometry(0.54, 0.34, 0.58),
    saddleSeat,
    numberPatch: new THREE.PlaneGeometry(0.28, 0.28),
    jockeyTorso: new THREE.CapsuleGeometry(0.11, 0.22, 6, 10),
    jockeyHead: new THREE.SphereGeometry(0.11, 14, 12),
    helmetVisor: new THREE.BoxGeometry(0.12, 0.025, 0.14),
    contactShadow: new THREE.CircleGeometry(0.75, 24),
    halo: new THREE.RingGeometry(0.72, 0.88, 32),
  };
}

function createArticulatedHorseRig(
  racer: HorseRacerEntry,
  geos: SharedHorseGeometries,
  isHighlightedWinner: boolean,
  maxAnisotropy: number
): HorseRig3D {
  const root = new THREE.Group();
  root.position.set(TRACK_START_X, 0, racer.laneZ);

  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const coatMat = new THREE.MeshStandardMaterial({
    color: racer.palette.coatHex,
    roughness: 0.46,
    metalness: 0.04,
  });
  const muzzleMat = new THREE.MeshStandardMaterial({
    color: racer.palette.muzzleHex,
    roughness: 0.55,
    metalness: 0.02,
  });
  const maneMat = new THREE.MeshStandardMaterial({
    color: racer.palette.maneHex,
    roughness: 0.72,
    metalness: 0.0,
  });
  const hoofMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    roughness: 0.28,
    metalness: 0.12,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: '#451A03',
    roughness: 0.32,
    metalness: 0.08,
  });
  const saddleClothMat = new THREE.MeshStandardMaterial({
    color: racer.palette.saddleHex,
    roughness: 0.52,
    metalness: 0.04,
  });
  const jockeySilkMat = new THREE.MeshStandardMaterial({
    color: racer.palette.jockeyHex,
    roughness: 0.35,
    metalness: 0.08,
  });
  const helmetTrimMat = new THREE.MeshStandardMaterial({
    color: racer.palette.trimHex,
    roughness: 0.22,
    metalness: 0.38,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.12 });
  const eyeHlMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

  // 1. Torso (Chest + Barrel + Hindquarters) centered around y = 0.92
  const barrel = new THREE.Mesh(geos.barrel, coatMat);
  barrel.position.set(0, 0.92, 0);
  barrel.scale.set(1, 1.06, 0.96);
  barrel.castShadow = true;
  barrel.receiveShadow = true;
  bodyGroup.add(barrel);

  const chest = new THREE.Mesh(geos.chest, coatMat);
  chest.position.set(0.32, 0.95, 0);
  chest.scale.set(1.06, 1.04, 0.92);
  chest.castShadow = true;
  bodyGroup.add(chest);

  const rump = new THREE.Mesh(geos.rump, coatMat);
  rump.position.set(-0.34, 0.94, 0);
  rump.scale.set(1.08, 1.02, 0.92);
  rump.castShadow = true;
  bodyGroup.add(rump);

  // 2. Saddle Pad, Racing Saddle & Side Number Badges (1..6)
  const saddlePad = new THREE.Mesh(geos.saddlePad, saddleClothMat);
  saddlePad.position.set(-0.02, 1.06, 0);
  saddlePad.castShadow = true;
  bodyGroup.add(saddlePad);

  const saddleSeat = new THREE.Mesh(geos.saddleSeat, leatherMat);
  saddleSeat.position.set(0.02, 1.18, 0);
  saddleSeat.scale.set(1, 0.62, 1.12);
  bodyGroup.add(saddleSeat);

  const numTex = createSaddleNumberTexture(
    racer.laneNumber,
    racer.palette.saddleHex,
    racer.palette.trimHex
  );
  const numMat = new THREE.MeshStandardMaterial({
    map: numTex,
    roughness: 0.38,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const numLeft = new THREE.Mesh(geos.numberPatch, numMat);
  numLeft.position.set(-0.02, 1.03, 0.295);
  bodyGroup.add(numLeft);

  const numRight = new THREE.Mesh(geos.numberPatch, numMat);
  numRight.position.set(-0.02, 1.03, -0.295);
  numRight.rotation.y = Math.PI;
  bodyGroup.add(numRight);

  // 3. Stylized Aerodynamic Racing Jockey (adds unmistakable racehorse identity)
  const jockeyGroup = new THREE.Group();
  jockeyGroup.position.set(0.06, 1.24, 0);
  jockeyGroup.rotation.z = -0.58; // crouching aerodynamic racing posture
  bodyGroup.add(jockeyGroup);

  const jockeyTorso = new THREE.Mesh(geos.jockeyTorso, jockeySilkMat);
  jockeyTorso.position.set(0, 0.16, 0);
  jockeyTorso.castShadow = true;
  jockeyGroup.add(jockeyTorso);

  const jockeyHead = new THREE.Mesh(geos.jockeyHead, jockeySilkMat);
  jockeyHead.position.set(0.06, 0.38, 0);
  jockeyHead.castShadow = true;
  jockeyGroup.add(jockeyHead);

  const visor = new THREE.Mesh(geos.helmetVisor, helmetTrimMat);
  visor.position.set(0.14, 0.36, 0);
  jockeyGroup.add(visor);

  // 4. Articulated Neck & Head Group + Ears + Bridle + Flowing Mane
  const neckGroup = new THREE.Group();
  neckGroup.position.set(0.42, 1.02, 0);
  neckGroup.rotation.z = -0.52; // forward graceful angle
  bodyGroup.add(neckGroup);

  const neckMesh = new THREE.Mesh(geos.neck, coatMat);
  neckMesh.position.set(0, 0.25, 0);
  neckMesh.castShadow = true;
  neckGroup.add(neckMesh);

  // 4 Mane Segments along dorsal edge of neck
  const maneMeshes: THREE.Mesh[] = [];
  for (let m = 0; m < 4; m++) {
    const tuft = new THREE.Mesh(geos.maneTuft, maneMat);
    tuft.position.set(-0.14, 0.12 + m * 0.11, 0);
    tuft.rotation.z = 0.28;
    neckGroup.add(tuft);
    maneMeshes.push(tuft);
  }

  const headGroup = new THREE.Group();
  headGroup.position.set(0.06, 0.52, 0);
  headGroup.rotation.z = 0.22; // head angled slightly forward/down
  neckGroup.add(headGroup);

  const headMesh = new THREE.Mesh(geos.head, coatMat);
  headMesh.position.set(0.11, 0.02, 0);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const muzzleMesh = new THREE.Mesh(geos.muzzle, muzzleMat);
  muzzleMesh.rotation.z = -Math.PI / 2;
  muzzleMesh.position.set(0.32, -0.01, 0);
  muzzleMesh.castShadow = true;
  headGroup.add(muzzleMesh);

  // Ears
  const earL = new THREE.Mesh(geos.ear, coatMat);
  earL.position.set(0.02, 0.15, 0.06);
  earL.rotation.z = 0.15;
  headGroup.add(earL);

  const earR = new THREE.Mesh(geos.ear, coatMat);
  earR.position.set(0.02, 0.15, -0.06);
  earR.rotation.z = 0.15;
  headGroup.add(earR);

  // Eyes + catchlights
  const eyeL = new THREE.Mesh(geos.eye, eyeMat);
  eyeL.position.set(0.16, 0.06, 0.09);
  headGroup.add(eyeL);
  const eyeR = new THREE.Mesh(geos.eye, eyeMat);
  eyeR.position.set(0.16, 0.06, -0.09);
  headGroup.add(eyeR);

  const hlL = new THREE.Mesh(geos.eyeHighlight, eyeHlMat);
  hlL.position.set(0.175, 0.072, 0.105);
  headGroup.add(hlL);
  const hlR = new THREE.Mesh(geos.eyeHighlight, eyeHlMat);
  hlR.position.set(0.175, 0.072, -0.105);
  headGroup.add(hlR);

  // 5. Multi-Segment Articulated Flowing Tail
  const tailUpper = new THREE.Group();
  tailUpper.position.set(-0.62, 1.0, 0);
  tailUpper.rotation.z = -0.58; // angled down & back
  bodyGroup.add(tailUpper);

  const tailTopMesh = new THREE.Mesh(geos.tailSeg, maneMat);
  tailTopMesh.position.set(0, -0.2, 0);
  tailTopMesh.rotation.z = Math.PI;
  tailTopMesh.castShadow = true;
  tailUpper.add(tailTopMesh);

  const tailLower = new THREE.Group();
  tailLower.position.set(0, -0.36, 0);
  tailUpper.add(tailLower);

  const tailTipMesh = new THREE.Mesh(geos.tailSeg, maneMat);
  tailTipMesh.scale.set(0.8, 0.9, 0.8);
  tailTipMesh.position.set(0, -0.18, 0);
  tailTipMesh.rotation.z = Math.PI;
  tailLower.add(tailTipMesh);

  // 6. Four Multi-Jointed Articulated Legs (upper + lower + dark hoof -> y = 0.0 at rest)
  const createLeg = (x: number, z: number): HorseLegJoints => {
    const upperPivot = new THREE.Group();
    upperPivot.position.set(x, 0.80, z);
    bodyGroup.add(upperPivot);

    const upperMesh = new THREE.Mesh(geos.upperLeg, coatMat);
    upperMesh.position.set(0, -0.20, 0);
    upperMesh.castShadow = true;
    upperPivot.add(upperMesh);

    const lowerPivot = new THREE.Group();
    lowerPivot.position.set(0, -0.38, 0);
    upperPivot.add(lowerPivot);

    const lowerMesh = new THREE.Mesh(geos.lowerLeg, coatMat);
    lowerMesh.position.set(0, -0.17, 0);
    lowerMesh.castShadow = true;
    lowerPivot.add(lowerMesh);

    const hoofMesh = new THREE.Mesh(geos.hoof, hoofMat);
    hoofMesh.position.set(0.01, -0.38, 0);
    hoofMesh.castShadow = true;
    lowerPivot.add(hoofMesh);

    return { upperPivot, lowerPivot };
  };

  const legFL = createLeg(0.36, 0.16);
  const legFR = createLeg(0.36, -0.16);
  const legBL = createLeg(-0.36, 0.16);
  const legBR = createLeg(-0.36, -0.16);

  // 7. Grounding Contact Shadow Disc (y = 0.012, prevents floating on Low/Software WebGL)
  const contactMat = new THREE.MeshBasicMaterial({
    color: '#1E140A',
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const contactDisc = new THREE.Mesh(geos.contactShadow, contactMat);
  contactDisc.rotation.x = -Math.PI / 2;
  contactDisc.scale.set(1.25, 0.72, 1);
  contactDisc.position.set(0, 0.012, 0);
  root.add(contactDisc);

  // 8. Champion / Leader Halo Ring on Track
  const haloMat = new THREE.MeshBasicMaterial({
    color: isHighlightedWinner ? '#FACC15' : racer.palette.saddleHex,
    transparent: true,
    opacity: isHighlightedWinner ? 0.92 : 0.24,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const haloRing = new THREE.Mesh(geos.halo, haloMat);
  haloRing.rotation.x = -Math.PI / 2;
  haloRing.position.set(0, 0.018, 0);
  root.add(haloRing);

  // 9. Crisp Student Nameplate Sprite
  const nameTex = createHorseNameplateTexture(racer, isHighlightedWinner, maxAnisotropy);
  const nameMaterial = new THREE.SpriteMaterial({
    map: nameTex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const nameSprite = new THREE.Sprite(nameMaterial);
  nameSprite.scale.set(2.85, 0.74, 1);
  nameSprite.position.set(0, 2.38, 0);
  root.add(nameSprite);

  return {
    root,
    bodyGroup,
    neckGroup,
    headGroup,
    tailUpper,
    tailLower,
    maneMeshes,
    legFL,
    legFR,
    legBL,
    legBR,
    nameSprite,
    nameMaterial,
    haloRing,
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
// 2D CANVAS EQUESTRIAN FALLBACK (When WebGL unavailable or context lost)
// ============================================================================
function draw2DFallbackHorseTrack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineup: HorseRacerEntry[],
  frames: HorseFrameState[] | null,
  raceState: HorseRace3DState,
  countdownLabel: string,
  elapsedSec: number,
  durationSec: number,
  winnerLaneIndex: number
) {
  ctx.clearRect(0, 0, width, height);

  // Sky & Turf Backdrop
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#0C2444');
  skyGrad.addColorStop(0.22, '#1E4E79');
  skyGrad.addColorStop(0.23, '#2E7D32');
  skyGrad.addColorStop(0.27, '#B9854B');
  skyGrad.addColorStop(1, '#8D5F30');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  const trackTop = Math.round(height * 0.27);
  const trackBottom = Math.round(height * 0.94);
  const trackHeight = trackBottom - trackTop;
  const startX = Math.round(width * 0.08);
  const finishX = Math.round(width * 0.89);
  const trackSpan = finishX - startX;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TÂY ĐÔ DERBY · ĐƯỜNG ĐUA NGỰA 2D AN TOÀN (WEBGL FALLBACK)', width / 2, trackTop * 0.5);

  // Checkered Finish Wire
  const sq = 12;
  for (let y = trackTop; y < trackBottom; y += sq) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (Math.floor((y - trackTop) / sq) + c) % 2 === 0 ? '#FFFFFF' : '#0F172A';
      ctx.fillRect(finishX + c * sq, y, sq, Math.min(sq, trackBottom - y));
    }
  }
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillText('ĐÍCH', finishX + 12, trackTop - 10);

  // Start Line
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(startX, trackTop);
  ctx.lineTo(startX, trackBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  const laneCount = Math.max(1, lineup.length);
  const laneH = trackHeight / laneCount;

  lineup.forEach((racer, idx) => {
    const laneTop = trackTop + idx * laneH;
    const laneMidY = laneTop + laneH * 0.60;

    ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, laneTop, width, laneH);

    if (idx > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, laneTop);
      ctx.lineTo(width, laneTop);
      ctx.stroke();
    }

    const progress = frames && frames[idx] ? frames[idx].progress : 0;
    const hx = startX + progress * trackSpan;
    const gallopPhase = raceState === 'RACING' ? performance.now() * 0.018 + racer.stridePhaseOffset : 0;
    const bounce = raceState === 'RACING' ? Math.sin(gallopPhase) * 3 : 0;
    const hy = laneMidY + bounce;

    // Dust kick behind hooves
    if (raceState === 'RACING') {
      ctx.fillStyle = 'rgba(245, 222, 179, 0.45)';
      for (let d = 1; d <= 3; d++) {
        ctx.beginPath();
        ctx.arc(hx - 24 - d * 10, hy + 12 + (d % 2) * 3, 5 - d, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Vector Galloping Horse
    const sc = Math.max(0.65, Math.min(1.05, laneH / 68));
    ctx.save();
    ctx.translate(hx, hy);
    ctx.scale(sc, sc);

    if ((raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 2, 34, 22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const legSwing = raceState === 'RACING' ? Math.sin(gallopPhase) * 10 : 0;

    // Legs
    ctx.strokeStyle = racer.palette.coatHex;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.lineTo(-18 - legSwing, 20);
    ctx.moveTo(14, 6);
    ctx.lineTo(18 + legSwing, 20);
    ctx.stroke();

    // Tail
    ctx.strokeStyle = racer.palette.maneHex;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(-36, -2, -34, 10);
    ctx.stroke();

    // Body
    ctx.fillStyle = racer.palette.coatHex;
    ctx.beginPath();
    ctx.ellipse(0, 2, 24, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Saddle cloth
    ctx.fillStyle = racer.palette.saddleHex;
    ctx.fillRect(-9, -9, 18, 13);

    // Neck & Head
    ctx.fillStyle = racer.palette.coatHex;
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(26, -18);
    ctx.lineTo(39, -12);
    ctx.lineTo(35, -5);
    ctx.lineTo(24, -4);
    ctx.lineTo(18, 7);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Crisp Label Tag
    const tagText = `L${racer.laneNumber} · ${racer.displayLabel}`;
    ctx.font = '700 12px "Plus Jakarta Sans", system-ui, sans-serif';
    const textW = ctx.measureText(tagText).width + 18;
    const tagX = Math.max(12, Math.min(width - textW - 12, hx - textW / 2));
    const tagY = Math.max(trackTop + 4, laneMidY - 34 * sc);

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex
        ? '#FACC15'
        : 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, textW, 20, 6);
    ctx.fill();

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex
        ? '#0F172A'
        : '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(tagText, tagX + 9, tagY + 14);
  });

  if (raceState === 'COUNTDOWN' && countdownLabel) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 120, height / 2 - 48, 240, 96, 22);
    ctx.fill();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.font = '900 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(countdownLabel, width / 2, height / 2 + 15);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '700 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${elapsedSec.toFixed(1)}s / ${durationSec}s`, width - 20, height - 14);
}

// ============================================================================
// MAIN COMPONENT: HORSE RACE 3D PREMIUM 2027
// ============================================================================
export const HorseRace3DGame: React.FC<HorseRace3DGameProps> = ({
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

  const [raceState, setRaceState] = useState<HorseRace3DState>(
    eligibleStudents.length > 0 ? 'READY' : 'IDLE'
  );
  const [durationSec, setDurationSec] = useState<HorseRaceDurationSec>(10);
  const [cameraMode, setCameraMode] = useState<HorseRaceCameraMode>('WIDE_STADIUM');
  const [autoCamera, setAutoCamera] = useState<boolean>(true);
  const [heatMode, setHeatMode] = useState<HorseRaceHeatMode>('REPRESENTATIVE_FAIR');
  const [heatIndex, setHeatIndex] = useState<number>(0);
  const [qualityPreset, setQualityPreset] = useState<HorseRaceQualityPreset>('HIGH');
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [countdownLabel, setCountdownLabel] = useState<string>('');
  const [elapsedDisplaySec, setElapsedDisplaySec] = useState<number>(0);
  const [liveTop3, setLiveTop3] = useState<
    Array<{ laneNumber: number; displayLabel: string; progressPct: number; badgeHex: string }>
  >([]);

  // Result & Note/Bonus State
  const [activeWinnerEntry, setActiveWinnerEntry] = useState<HorseRacerEntry | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [resultNote, setResultNote] = useState<string>('');
  const [noteSaveFeedback, setNoteSaveFeedback] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'local_only' | 'error'>('idle');
  const [showRecordsDrawer, setShowRecordsDrawer] = useState<boolean>(false);
  const [rendererFallback2D, setRendererFallback2D] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));

  const recordsStorageKey = `${LOCAL_RECORDS_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`;
  const [turnRecords, setTurnRecords] = useState<HorseRaceTurnRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      return raw ? (JSON.parse(raw) as HorseRaceTurnRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      setTurnRecords(raw ? (JSON.parse(raw) as HorseRaceTurnRecord[]) : []);
    } catch {
      setTurnRecords([]);
    }
  }, [recordsStorageKey]);

  const persistLocalRecords = useCallback(
    (next: HorseRaceTurnRecord[]) => {
      setTurnRecords(next);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(recordsStorageKey, JSON.stringify(next.slice(0, 60)));
        } catch {
          // Ignore quota errors
        }
      }
    },
    [recordsStorageKey]
  );

  const heatBuckets = useMemo(
    () => computeHorseHeatBuckets(eligibleStudents, MAX_HORSE_LANES),
    [eligibleStudents]
  );
  const safeHeatIndex = useMemo(
    () => (heatBuckets.length === 0 ? 0 : Math.max(0, Math.min(heatIndex, heatBuckets.length - 1))),
    [heatBuckets.length, heatIndex]
  );

  const previewData = useMemo(
    () =>
      buildHorsePreviewLineup({
        eligibleStudents,
        fullRoster,
        heatMode,
        heatIndex: safeHeatIndex,
      }),
    [eligibleStudents, fullRoster, heatMode, safeHeatIndex]
  );

  // Refs for deterministic animation loop (prevent React re-render jitter & stale closures)
  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundEngineRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const deduplicatorRef = useRef<HorseRaceTurnDeduplicator>(new HorseRaceTurnDeduplicator());

  const raceStateRef = useRef<HorseRace3DState>(raceState);
  const activeSessionIdRef = useRef<string | null>(null);
  const activePlanRef = useRef<HorseRaceTurnPlan | null>(null);
  const countdownStartPerfRef = useRef<number>(0);
  const countdownLastBeepRef = useRef<number>(-1);
  const racePhaseStartPerfRef = useRef<number>(0);
  const raceAccumulatedMsRef = useRef<number>(0);
  const finishingStartPerfRef = useRef<number>(0);
  const lastHudUpdatePerfRef = useRef<number>(0);
  const framesScratchRef = useRef<HorseFrameState[]>([]);
  const horseStrideAccumRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const horsePrevXRef = useRef<number[]>([
    TRACK_START_X,
    TRACK_START_X,
    TRACK_START_X,
    TRACK_START_X,
    TRACK_START_X,
    TRACK_START_X,
  ]);
  const noteTimeoutRef = useRef<number | null>(null);

  const cameraModeRef = useRef<HorseRaceCameraMode>(cameraMode);
  const autoCameraRef = useRef<boolean>(autoCamera);
  const isMutedRef = useRef<boolean>(isMuted);
  const speechEnabledRef = useRef<boolean>(speechEnabled);
  const qualityPresetRef = useRef<HorseRaceQualityPreset>(qualityPreset);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const previewLineupRef = useRef<HorseRacerEntry[]>(previewData.lineup);
  const durationSecRef = useRef<HorseRaceDurationSec>(durationSec);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    raceStateRef.current = raceState;
  }, [raceState]);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);
  useEffect(() => {
    autoCameraRef.current = autoCamera;
  }, [autoCamera]);
  useEffect(() => {
    isMutedRef.current = isMuted;
    if (isMuted) {
      soundEngineRef.current?.stopAll();
      voiceControllerRef.current?.stop();
    }
  }, [isMuted]);
  useEffect(() => {
    speechEnabledRef.current = speechEnabled;
    saveEduGameVoiceEnabled(speechEnabled);
    if (!speechEnabled) {
      voiceControllerRef.current?.stop();
    }
  }, [speechEnabled]);
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

  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    horseGroupContainer: THREE.Group | null;
    horseRigs: HorseRig3D[];
    sharedHorseGeos: SharedHorseGeometries | null;
    gateDoors: THREE.Group[];
    trafficRedMat: THREE.MeshStandardMaterial | null;
    trafficAmberMat: THREE.MeshStandardMaterial | null;
    trafficGreenMat: THREE.MeshStandardMaterial | null;
    scoreboardCtx: CanvasRenderingContext2D | null;
    scoreboardTex: THREE.CanvasTexture | null;
    lastScoreboardDrawMs: number;
    trophyGroup: THREE.Group | null;
    victorySpotLight: THREE.SpotLight | null;
    spectatorInstanced: THREE.InstancedMesh | null;
    spectatorBasePositions: Array<{ x: number; y: number; z: number; phase: number }>;
    dustInstanced: THREE.InstancedMesh | null;
    dustSeeds: Float32Array;
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
    horseGroupContainer: null,
    horseRigs: [],
    sharedHorseGeos: null,
    gateDoors: [],
    trafficRedMat: null,
    trafficAmberMat: null,
    trafficGreenMat: null,
    scoreboardCtx: null,
    scoreboardTex: null,
    lastScoreboardDrawMs: 0,
    trophyGroup: null,
    victorySpotLight: null,
    spectatorInstanced: null,
    spectatorBasePositions: [],
    dustInstanced: null,
    dustSeeds: new Float32Array(0),
    confettiInstanced: null,
    confettiStates: [],
    camPos: new THREE.Vector3(0, 12.2, 22.0),
    camTarget: new THREE.Vector3(0, 1.0, 0),
    isSoftwareGl: false,
    maxAnisotropy: 4,
  });

  const rebuild3DHorsesForLineup = useCallback(
    (lineup: HorseRacerEntry[], highlightedWinnerId: string | null) => {
      const { horseGroupContainer, horseRigs, sharedHorseGeos, maxAnisotropy } = threeRefs.current;
      if (!horseGroupContainer || !sharedHorseGeos) return;

      horseRigs.forEach((rig) => {
        rig.root.traverse((child) => {
          const mat = (child as { material?: THREE.Material | THREE.Material[] }).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => disposeSingleMaterial(m));
          } else if (mat) {
            disposeSingleMaterial(mat);
          }
        });
        horseGroupContainer.remove(rig.root);
      });

      const nextRigs: HorseRig3D[] = lineup.map((racer) => {
        const rig = createArticulatedHorseRig(
          racer,
          sharedHorseGeos,
          Boolean(highlightedWinnerId && racer.student.id === highlightedWinnerId),
          maxAnisotropy
        );
        horseGroupContainer.add(rig.root);
        return rig;
      });
      threeRefs.current.horseRigs = nextRigs;
      horseStrideAccumRef.current = lineup.map(() => 0);
      horsePrevXRef.current = lineup.map(() => TRACK_START_X);
    },
    []
  );

  // Sync lineup whenever eligible pool changes in IDLE / READY
  useEffect(() => {
    if (
      raceStateRef.current === 'IDLE' ||
      raceStateRef.current === 'READY' ||
      raceStateRef.current === 'RESET'
    ) {
      const nextState: HorseRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      raceStateRef.current = nextState;
      setRaceState(nextState);
      rebuild3DHorsesForLineup(previewData.lineup, null);
      setLiveTop3(
        previewData.lineup.slice(0, 3).map((r) => ({
          laneNumber: r.laneNumber,
          displayLabel: r.displayLabel,
          progressPct: 0,
          badgeHex: r.palette.saddleHex,
        }))
      );
    }
  }, [eligibleStudents.length, previewData.lineup, rebuild3DHorsesForLineup]);

  // Hard reset when class / source changes (aborts any active race cleanly)
  const prevSourceKeyRef = useRef(selectedSourceKey);
  useEffect(() => {
    if (prevSourceKeyRef.current !== selectedSourceKey) {
      prevSourceKeyRef.current = selectedSourceKey;
      activeSessionIdRef.current = null;
      activePlanRef.current = null;
      raceAccumulatedMsRef.current = 0;
      countdownLastBeepRef.current = -1;
      soundEngineRef.current?.setActiveTurnToken(null);
      soundEngineRef.current?.stopAll();
      voiceControllerRef.current?.stop();
      setHeatIndex(0);
      setActiveWinnerEntry(null);
      setActiveSessionId(null);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('idle');
      setCountdownLabel('');
      setElapsedDisplaySec(0);
      const nextState: HorseRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      raceStateRef.current = nextState;
      setRaceState(nextState);
      rebuild3DHorsesForLineup(previewData.lineup, null);
    }
  }, [selectedSourceKey, eligibleStudents.length, previewData.lineup, rebuild3DHorsesForLineup]);

  // Supabase cloud logging (Teacher authenticated only; Guest/Demo KHKT skips safely)
  const syncTurnToSupabase = useCallback(
    async (
      plan: HorseRaceTurnPlan,
      winnerEntry: HorseRacerEntry,
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
          `Trò chơi: A06 - Đua Ngựa 3D Premium 2027`,
          `Lớp: ${resolvedClassName}`,
          `Học sinh thắng cuộc: ${winnerEntry.safeName} (STT #${winnerEntry.formattedStt} · ${winnerEntry.safeCode})`,
          `Làn #${winnerEntry.laneNumber}/${plan.racers.length} · Thời lượng ${plan.durationSec}s · ${heatText}`,
          points > 0 ? `Điểm thưởng: +${points}đ` : '',
          noteText.trim() ? `Ghi chú: ${noteText.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ');

        const { error } = await supabase.from('audit_logs').insert({
          actor_name: teacherName || 'Giáo viên',
          role: userRole || 'teacher',
          action: 'EDU_GAME_A06_HORSE_RACE_3D',
          target: `A06 (${resolvedClassName}) - ${winnerEntry.safeName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            game_id: 'A06',
            game_title: 'Đua ngựa 3D',
            session_id: plan.sessionId,
            class_id: selectedSourceKey,
            class_name: resolvedClassName,
            student_id: winnerEntry.student.id,
            student_code: winnerEntry.safeCode,
            student_name: winnerEntry.safeName,
            student_stt: winnerEntry.sttNumber,
            lane_number: winnerEntry.laneNumber,
            lane_count: plan.racers.length,
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
        console.warn('A06 Supabase audit_logs warning:', err);
        return 'error';
      }
    },
    [resolvedClassName, selectedSourceKey, teacherId, teacherName, userRole]
  );

  // Module 3 Result Commit (Strictly once per sessionId)
  const commitRaceWinner = useCallback(
    (plan: HorseRaceTurnPlan) => {
      if (!isMountedRef.current) return;
      if (activeSessionIdRef.current !== plan.sessionId) return;
      if (!deduplicatorRef.current.markCommitted(plan.sessionId)) return;

      const winnerEntry = plan.racers[plan.winnerLaneIndex];
      if (!winnerEntry) return;

      rebuild3DHorsesForLineup(plan.racers, winnerEntry.student.id);
      const endEval = evaluateHorseRaceFrame(plan, plan.durationMs);
      threeRefs.current.horseRigs.forEach((rig, idx) => {
        const f = endEval.frames[idx];
        if (f) {
          const finalX = idx === plan.winnerLaneIndex ? TRACK_FINISH_X + 2.2 : f.x;
          rig.root.position.set(finalX, 0, f.z);
        }
      });

      setActiveWinnerEntry(winnerEntry);
      setActiveSessionId(plan.sessionId);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('saving');

      // Strict Vietnamese voice announcement (at most once per sessionId, never falls back to English)
      void voiceControllerRef.current?.announceStudentOnce({
        turnId: plan.sessionId,
        studentName: winnerEntry.safeName,
        customText: `Xin chúc mừng bạn ${winnerEntry.safeName} đã giành chiến thắng đường đua ngựa!`,
        isMuted: isMutedRef.current,
        voiceEnabled: speechEnabledRef.current,
        onBeforeSpeak: () => {
          soundEngineRef.current?.stopLoops();
        },
      });

      onPick(winnerEntry.student, {
        bonusPoints: 0,
        note: `Đua Ngựa 3D (Làn #${winnerEntry.laneNumber} · ${plan.durationSec}s)`,
        sessionId: plan.sessionId,
        studentNumber: winnerEntry.sttNumber,
      });

      const heatLabel =
        plan.heatMode === 'BRACKET_HEATS' && plan.totalHeats > 1
          ? `Bảng ${plan.heatIndex + 1}/${plan.totalHeats}`
          : `Toàn lớp (1/${plan.eligibleCount})`;

      const baseRecord: HorseRaceTurnRecord = {
        sessionId: plan.sessionId,
        turnIndex: turnRecords.length + 1,
        classId: selectedSourceKey,
        className: resolvedClassName,
        studentId: winnerEntry.student.id,
        studentName: winnerEntry.safeName,
        studentCode: winnerEntry.safeCode,
        sttNumber: winnerEntry.sttNumber,
        formattedStt: winnerEntry.formattedStt,
        laneNumber: winnerEntry.laneNumber,
        laneCount: plan.racers.length,
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
      rebuild3DHorsesForLineup,
      recordsStorageKey,
      resolvedClassName,
      selectedSourceKey,
      syncTurnToSupabase,
      turnRecords,
    ]
  );

  const commitRaceWinnerRef = useRef(commitRaceWinner);
  useEffect(() => {
    commitRaceWinnerRef.current = commitRaceWinner;
  }, [commitRaceWinner]);

  // ============================================================================
  // THREE.JS INITIALIZATION & MONOTONIC ANIMATION LOOP
  // ============================================================================
  useEffect(() => {
    isMountedRef.current = true;
    soundEngineRef.current = new EduGameSoundBank();
    voiceControllerRef.current = new EduGameVoiceController();

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
      if (!disposed) {
        setRendererFallback2D(true);
      }
    };
    const handleContextRestored = () => {
      if (!disposed) {
        setRendererFallback2D(false);
      }
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
      renderer.toneMappingExposure = 1.06;
      renderer.shadowMap.enabled = !isSoftwareGl && qualityPresetRef.current !== 'LOW';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = 'w-full h-full block outline-none select-none';
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      mountEl.innerHTML = '';
      mountEl.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#86CBEF');
      scene.fog = new THREE.Fog('#9FD8F5', 42, 118);
      threeRefs.current.scene = scene;

      // Studio / Sky Environment IBL via RoomEnvironment
      pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      roomEnv.dispose();
      pmrem.dispose();
      pmrem = null;

      const camera = new THREE.PerspectiveCamera(44, initWidth / initHeight, 0.1, 200);
      camera.position.copy(threeRefs.current.camPos);
      camera.lookAt(threeRefs.current.camTarget);
      threeRefs.current.camera = camera;

      // Natural Sunlight + Sky Hemisphere + Cool Rim + Victory Spotlight
      const hemi = new THREE.HemisphereLight('#E0F4FF', '#2E6F36', 0.95);
      scene.add(hemi);

      const sunLight = new THREE.DirectionalLight('#FFF5DB', 2.05);
      sunLight.position.set(16, 26, 18);
      if (renderer.shadowMap.enabled) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.camera.left = -24;
        sunLight.shadow.camera.right = 24;
        sunLight.shadow.camera.top = 16;
        sunLight.shadow.camera.bottom = -16;
        sunLight.shadow.camera.near = 2;
        sunLight.shadow.camera.far = 68;
        sunLight.shadow.bias = -0.0005;
        sunLight.shadow.normalBias = 0.02;
      }
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight('#93C5FD', 0.55);
      rimLight.position.set(-16, 12, -16);
      scene.add(rimLight);

      const victorySpot = new THREE.SpotLight('#FACC15', 0, 26, Math.PI / 5, 0.5, 1.4);
      victorySpot.position.set(TRACK_FINISH_X + 2.2, 10.5, 0);
      victorySpot.target.position.set(TRACK_FINISH_X + 2.2, 0.5, 0);
      scene.add(victorySpot);
      scene.add(victorySpot.target);
      threeRefs.current.victorySpotLight = victorySpot;

      // ----------------------------------------------------------------------
      // OUTDOOR STADIUM TERRAIN & EQUESTRIAN DIRT TRACK
      // ----------------------------------------------------------------------
      const turfTex = createTurfTexture(maxAniso);
      const outerField = new THREE.Mesh(
        new THREE.PlaneGeometry(180, 140),
        new THREE.MeshStandardMaterial({
          map: turfTex,
          roughness: 0.88,
          metalness: 0.0,
        })
      );
      outerField.rotation.x = -Math.PI / 2;
      outerField.position.y = -0.04;
      outerField.receiveShadow = true;
      scene.add(outerField);

      // Soft Distant Hills Perimeter (avoids abrupt flat edge)
      const hillMat = new THREE.MeshStandardMaterial({ color: '#266B2F', roughness: 0.92 });
      const hillGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      const hillCoords = [
        { x: -45, z: -48, sx: 26, sy: 7.5, sz: 18 },
        { x: 0, z: -55, sx: 34, sy: 9.5, sz: 20 },
        { x: 48, z: -46, sx: 28, sy: 8.0, sz: 18 },
        { x: -64, z: -12, sx: 22, sy: 6.5, sz: 24 },
        { x: 64, z: -10, sx: 22, sy: 6.0, sz: 24 },
      ];
      hillCoords.forEach((h) => {
        const hm = new THREE.Mesh(hillGeo, hillMat);
        hm.position.set(h.x, -0.2, h.z);
        hm.scale.set(h.sx, h.sy, h.sz);
        scene!.add(hm);
      });

      // 3D Sand / Dirt Track Surface
      const trackWidth = MAX_HORSE_LANES * LANE_SPACING + 1.1; // ~14.0
      const sandTex = createSandTrackTexture(maxAniso);
      const trackMesh = new THREE.Mesh(
        new THREE.BoxGeometry(40, 0.12, trackWidth),
        new THREE.MeshStandardMaterial({
          map: sandTex,
          roughness: 0.86,
          metalness: 0.02,
        })
      );
      trackMesh.position.set(0, -0.06, 0);
      trackMesh.receiveShadow = true;
      scene.add(trackMesh);

      // Crisp White Lane Lines (7 dividers for 6 lanes, polygonOffset prevents Z-fighting)
      const laneLineGeo = new THREE.PlaneGeometry(36.5, 0.08);
      const laneLineMat = new THREE.MeshBasicMaterial({
        color: '#F8FAFC',
        transparent: true,
        opacity: 0.72,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      for (let r = 0; r <= MAX_HORSE_LANES; r++) {
        const zLine = (r - MAX_HORSE_LANES / 2) * LANE_SPACING;
        const line = new THREE.Mesh(laneLineGeo, laneLineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.014, zLine);
        scene.add(line);
      }

      // Low White & Wood Paddock Rails (North & South track borders)
      const railWhiteMat = new THREE.MeshStandardMaterial({ color: '#F8FAFC', roughness: 0.42 });
      const railPostGeo = new THREE.BoxGeometry(0.14, 0.92, 0.14);
      const railBarGeo = new THREE.BoxGeometry(40, 0.10, 0.09);

      [-trackWidth / 2 - 0.35, trackWidth / 2 + 0.35].forEach((zBorder) => {
        const topRail = new THREE.Mesh(railBarGeo, railWhiteMat);
        topRail.position.set(0, 0.82, zBorder);
        topRail.castShadow = true;
        scene!.add(topRail);

        const midRail = new THREE.Mesh(railBarGeo, railWhiteMat);
        midRail.position.set(0, 0.44, zBorder);
        scene!.add(midRail);
      });

      // Instanced Fence Posts (26 * 2 = 52 posts)
      const postCount = 52;
      const postInst = new THREE.InstancedMesh(railPostGeo, railWhiteMat, postCount);
      let pIdx = 0;
      [-trackWidth / 2 - 0.35, trackWidth / 2 + 0.35].forEach((zBorder) => {
        for (let col = 0; col < 26; col++) {
          const xPos = -19.5 + (col / 25) * 39;
          _tmpVecA.set(xPos, 0.46, zBorder);
          _tmpQuat.identity();
          _tmpScale.set(1, 1, 1);
          _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
          postInst.setMatrixAt(pIdx++, _tmpMatrix);
        }
      });
      postInst.instanceMatrix.needsUpdate = true;
      postInst.computeBoundingSphere();
      scene.add(postInst);

      // ----------------------------------------------------------------------
      // GRANDSTAND BLEACHERS + ROOF + INSTANCED SPECTATORS + SCOREBOARD
      // ----------------------------------------------------------------------
      const navyMat = new THREE.MeshStandardMaterial({ color: '#0F2942', roughness: 0.42, metalness: 0.15 });
      const steelMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', roughness: 0.3, metalness: 0.72 });
      const goldMat = new THREE.MeshStandardMaterial({ color: '#FACC15', roughness: 0.2, metalness: 0.85 });

      const standGroup = new THREE.Group();
      standGroup.position.set(0, 0, -trackWidth / 2 - 2.2);
      for (let tier = 0; tier < 4; tier++) {
        const stepMat = tier % 2 === 0 ? navyMat : new THREE.MeshStandardMaterial({ color: '#1E40AF', roughness: 0.55 });
        const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(36, 0.72, 1.35), stepMat);
        tierMesh.position.set(0, 0.36 + tier * 0.72, -tier * 1.25);
        tierMesh.receiveShadow = true;
        standGroup.add(tierMesh);
      }
      // Roof Canopy
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(37, 0.28, 6.2), navyMat);
      canopy.position.set(0, 5.4, -2.5);
      canopy.rotation.x = 0.12;
      standGroup.add(canopy);
      [-17, -6, 6, 17].forEach((px) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 5.4, 10), steelMat);
        col.position.set(px, 2.7, -4.8);
        standGroup.add(col);
      });
      scene.add(standGroup);

      // Instanced Spectators (150 cheering fans across tiers)
      const specGeo = new THREE.CapsuleGeometry(0.16, 0.34, 4, 8);
      const specMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
      const specCount = 150;
      const specInst = new THREE.InstancedMesh(specGeo, specMat, specCount);
      specInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      specInst.frustumCulled = false;

      const fanPalette = [
        new THREE.Color('#EF4444'),
        new THREE.Color('#FACC15'),
        new THREE.Color('#38BDF8'),
        new THREE.Color('#FFFFFF'),
        new THREE.Color('#10B981'),
        new THREE.Color('#F97316'),
      ];
      const specBase: Array<{ x: number; y: number; z: number; phase: number }> = [];
      for (let i = 0; i < specCount; i++) {
        const tier = i % 4;
        const x = -16.2 + ((Math.floor(i / 4) * 32.4) / (specCount / 4 - 1));
        const y = 0.98 + tier * 0.72;
        const z = -trackWidth / 2 - 2.2 - tier * 1.25;
        specBase.push({ x, y, z, phase: (i * 1.37) % (Math.PI * 2) });
        specInst.setColorAt(i, fanPalette[i % fanPalette.length]);
        _tmpVecA.set(x, y, z);
        _tmpQuat.identity();
        _tmpScale.set(1, 1, 1);
        _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
        specInst.setMatrixAt(i, _tmpMatrix);
      }
      if (specInst.instanceColor) specInst.instanceColor.needsUpdate = true;
      specInst.instanceMatrix.needsUpdate = true;
      scene.add(specInst);
      threeRefs.current.spectatorInstanced = specInst;
      threeRefs.current.spectatorBasePositions = specBase;

      // Electronic Stadium Jumbotron Scoreboard
      const sbCanvas = document.createElement('canvas');
      sbCanvas.width = 1024;
      sbCanvas.height = 320;
      const sbCtx = sbCanvas.getContext('2d')!;
      drawScoreboardCanvas(sbCtx, 'SẴN SÀNG', '00.0s / 10.0s', 'TÂY ĐÔ SMART EDU · A06');
      const sbTex = new THREE.CanvasTexture(sbCanvas);
      sbTex.colorSpace = THREE.SRGBColorSpace;
      sbTex.anisotropy = Math.min(8, maxAniso);
      threeRefs.current.scoreboardCtx = sbCtx;
      threeRefs.current.scoreboardTex = sbTex;

      const sbFrame = new THREE.Mesh(new THREE.BoxGeometry(10.6, 3.5, 0.42), navyMat);
      sbFrame.position.set(1.5, 7.6, -trackWidth / 2 - 6.6);
      scene.add(sbFrame);
      const sbScreen = new THREE.Mesh(
        new THREE.PlaneGeometry(10.0, 3.12),
        new THREE.MeshBasicMaterial({ map: sbTex })
      );
      sbScreen.position.set(1.5, 7.6, -trackWidth / 2 - 6.37);
      scene.add(sbScreen);

      // ----------------------------------------------------------------------
      // STARTING GATE (6 STALLS + HINGED DOORS + TRAFFIC LIGHTS + BANNER)
      // ----------------------------------------------------------------------
      const startGateGroup = new THREE.Group();
      startGateGroup.position.set(TRACK_START_X - 0.55, 0, 0);

      const gatePillarGeo = new THREE.BoxGeometry(0.45, 4.4, 0.45);
      const sPilL = new THREE.Mesh(gatePillarGeo, steelMat);
      sPilL.position.set(0, 2.2, -trackWidth / 2 - 0.2);
      startGateGroup.add(sPilL);
      const sPilR = new THREE.Mesh(gatePillarGeo, steelMat);
      sPilR.position.set(0, 2.2, trackWidth / 2 + 0.2);
      startGateGroup.add(sPilR);

      const sBeam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.68, trackWidth + 0.8), navyMat);
      sBeam.position.set(0, 4.3, 0);
      startGateGroup.add(sBeam);

      // 6 Individual Hinged Stall Gates ahead of horses (swing up/open on GO!)
      const gateDoors: THREE.Group[] = [];
      const doorBarGeo = new THREE.BoxGeometry(0.06, 0.9, LANE_SPACING * 0.82);
      const doorMat = new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.35, metalness: 0.4 });
      for (let lane = 0; lane < MAX_HORSE_LANES; lane++) {
        const lz = (lane - (MAX_HORSE_LANES - 1) / 2) * LANE_SPACING;
        const divider = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.35, 0.08), steelMat);
        divider.position.set(-0.3, 0.68, lz - LANE_SPACING / 2);
        startGateGroup.add(divider);

        const doorPivot = new THREE.Group();
        doorPivot.position.set(0.82, 1.38, lz);
        const doorMesh = new THREE.Mesh(doorBarGeo, doorMat);
        doorMesh.position.set(0, -0.45, 0);
        doorPivot.add(doorMesh);
        startGateGroup.add(doorPivot);
        gateDoors.push(doorPivot);
      }
      threeRefs.current.gateDoors = gateDoors;

      const startTex = createGateBannerTexture(
        'XUẤT PHÁT · START',
        'HORSE RACE 3D PREMIUM',
        '#0F2942',
        '#38BDF8',
        '#FACC15',
        maxAniso
      );
      const startSign = new THREE.Mesh(
        new THREE.PlaneGeometry(7.6, 1.55),
        new THREE.MeshBasicMaterial({ map: startTex, side: THREE.DoubleSide })
      );
      startSign.position.set(0.42, 4.35, 0);
      startSign.rotation.y = Math.PI / 2;
      startGateGroup.add(startSign);

      // Traffic Signal Lights (Red / Amber / Green)
      const lightSphereGeo = new THREE.SphereGeometry(0.24, 14, 12);
      const trafficRedMat = new THREE.MeshStandardMaterial({
        color: '#EF4444',
        emissive: '#7F1D1D',
        emissiveIntensity: 0.25,
        roughness: 0.2,
      });
      const trafficAmberMat = new THREE.MeshStandardMaterial({
        color: '#F59E0B',
        emissive: '#78350F',
        emissiveIntensity: 0.25,
        roughness: 0.2,
      });
      const trafficGreenMat = new THREE.MeshStandardMaterial({
        color: '#10B981',
        emissive: '#064E3B',
        emissiveIntensity: 0.25,
        roughness: 0.2,
      });
      threeRefs.current.trafficRedMat = trafficRedMat;
      threeRefs.current.trafficAmberMat = trafficAmberMat;
      threeRefs.current.trafficGreenMat = trafficGreenMat;

      const rLight = new THREE.Mesh(lightSphereGeo, trafficRedMat);
      rLight.position.set(0.42, 3.25, -4.3);
      startGateGroup.add(rLight);
      const aLight = new THREE.Mesh(lightSphereGeo, trafficAmberMat);
      aLight.position.set(0.42, 3.25, -5.0);
      startGateGroup.add(aLight);
      const gLight = new THREE.Mesh(lightSphereGeo, trafficGreenMat);
      gLight.position.set(0.42, 3.25, -5.7);
      startGateGroup.add(gLight);
      scene.add(startGateGroup);

      // ----------------------------------------------------------------------
      // FINISH ARCH + CHECKERED WIRE + 3D GOLDEN CHAMPIONSHIP TROPHY PODIUM
      // ----------------------------------------------------------------------
      const finishArchGroup = new THREE.Group();
      finishArchGroup.position.set(TRACK_FINISH_X, 0, 0);

      const fPilL = new THREE.Mesh(gatePillarGeo, navyMat);
      fPilL.position.set(0, 2.3, -trackWidth / 2 - 0.2);
      finishArchGroup.add(fPilL);
      const fPilR = new THREE.Mesh(gatePillarGeo, navyMat);
      fPilR.position.set(0, 2.3, trackWidth / 2 + 0.2);
      finishArchGroup.add(fPilR);
      const fBeam = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.78, trackWidth + 0.9), goldMat);
      fBeam.position.set(0, 4.5, 0);
      finishArchGroup.add(fBeam);

      const finishTex = createGateBannerTexture(
        'VỀ ĐÍCH · FINISH',
        'QUÁN QUÂN TÂY ĐÔ DERBY',
        '#0F2942',
        '#FACC15',
        '#FACC15',
        maxAniso
      );
      const finishSign = new THREE.Mesh(
        new THREE.PlaneGeometry(7.8, 1.6),
        new THREE.MeshBasicMaterial({ map: finishTex, side: THREE.DoubleSide })
      );
      finishSign.position.set(-0.46, 4.54, 0);
      finishSign.rotation.y = -Math.PI / 2;
      finishArchGroup.add(finishSign);

      // Checkered Finish Line Strip
      const finishLineStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.48, trackWidth - 0.4),
        new THREE.MeshBasicMaterial({
          color: '#FFFFFF',
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      finishLineStrip.rotation.x = -Math.PI / 2;
      finishLineStrip.position.set(0, 0.016, 0);
      finishArchGroup.add(finishLineStrip);
      scene.add(finishArchGroup);

      // 3D Golden Trophy on Victory Pedestal
      const trophyGroup = new THREE.Group();
      trophyGroup.position.set(TRACK_FINISH_X + 2.6, 0, -trackWidth / 2 + 2.2);
      const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.55, 24), navyMat);
      pedBase.position.y = 0.275;
      trophyGroup.add(pedBase);
      const cupFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.46, 0.36, 20), goldMat);
      cupFoot.position.y = 0.72;
      trophyGroup.add(cupFoot);
      const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.48, 16), goldMat);
      cupStem.position.y = 1.12;
      trophyGroup.add(cupStem);
      const cupBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.28, 0.78, 24), goldMat);
      cupBowl.position.y = 1.72;
      trophyGroup.add(cupBowl);
      const cupHandleL = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 10, 18, Math.PI), goldMat);
      cupHandleL.rotation.z = Math.PI / 2;
      cupHandleL.position.set(0, 1.72, 0.50);
      trophyGroup.add(cupHandleL);
      const cupHandleR = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 10, 18, Math.PI), goldMat);
      cupHandleR.rotation.z = -Math.PI / 2;
      cupHandleR.position.set(0, 1.72, -0.50);
      trophyGroup.add(cupHandleR);
      scene.add(trophyGroup);
      threeRefs.current.trophyGroup = trophyGroup;

      // Horse Container & Shared Geometries
      const horseContainer = new THREE.Group();
      scene.add(horseContainer);
      threeRefs.current.horseGroupContainer = horseContainer;
      threeRefs.current.sharedHorseGeos = createSharedHorseGeometries();

      // ----------------------------------------------------------------------
      // INSTANCED DIRT/SAND DUST PARTICLES & VICTORY CONFETTI
      // ----------------------------------------------------------------------
      const dustCount = 144;
      const dustGeo = new THREE.SphereGeometry(0.11, 7, 6);
      const dustMat = new THREE.MeshBasicMaterial({
        color: '#E6C9A2',
        transparent: true,
        opacity: 0.64,
      });
      const dustInstanced = new THREE.InstancedMesh(dustGeo, dustMat, dustCount);
      dustInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      dustInstanced.frustumCulled = false;
      const dustSeeds = new Float32Array(dustCount);
      for (let i = 0; i < dustCount; i++) {
        dustSeeds[i] = (i * 0.6180339887) % 1;
        _tmpMatrix.makeScale(0, 0, 0);
        dustInstanced.setMatrixAt(i, _tmpMatrix);
      }
      scene.add(dustInstanced);
      threeRefs.current.dustInstanced = dustInstanced;
      threeRefs.current.dustSeeds = dustSeeds;

      const confettiCount = 140;
      const confettiGeo = new THREE.BoxGeometry(0.20, 0.03, 0.13);
      const confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.25 });
      const confettiInst = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
      confettiInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      confettiInst.frustumCulled = false;
      const confColors = [
        new THREE.Color('#FACC15'),
        new THREE.Color('#EF4444'),
        new THREE.Color('#38BDF8'),
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
          x: TRACK_FINISH_X + (Math.random() - 0.5) * 7,
          y: -10,
          z: (Math.random() - 0.5) * 14,
          vy: 1.8 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 1.4,
          vz: (Math.random() - 0.5) * 1.4,
          rotSpeed: 2.2 + Math.random() * 4.0,
        });
        confettiInst.setColorAt(i, confColors[i % confColors.length]);
        _tmpMatrix.makeScale(0, 0, 0);
        confettiInst.setMatrixAt(i, _tmpMatrix);
      }
      if (confettiInst.instanceColor) confettiInst.instanceColor.needsUpdate = true;
      scene.add(confettiInst);
      threeRefs.current.confettiInstanced = confettiInst;
      threeRefs.current.confettiStates = confettiStates;

      // Initial horses
      rebuild3DHorsesForLineup(previewLineupRef.current, null);

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

        const st = raceStateRef.current;
        const plan = activePlanRef.current;
        const isReduced = reducedMotionRef.current;

        // 1. Traffic Lights & Starting Gate Doors
        if (
          threeRefs.current.trafficRedMat &&
          threeRefs.current.trafficAmberMat &&
          threeRefs.current.trafficGreenMat
        ) {
          let rEm = 0.25;
          let aEm = 0.25;
          let gEm = 0.25;
          let targetDoorAngle = 0;

          if (st === 'COUNTDOWN') {
            const cdElapsed = nowPerf - countdownStartPerfRef.current;
            if (cdElapsed < 900) rEm = 3.2;
            else if (cdElapsed < 2600) aEm = 3.2;
            else {
              gEm = 3.6;
              targetDoorAngle = 1.48; // Gate doors swing open!
            }
          } else if (st === 'RACING' || st === 'FINISHING' || st === 'RESULT') {
            gEm = 2.8;
            targetDoorAngle = 1.48;
          } else if (st === 'PAUSED') {
            aEm = 2.2;
            targetDoorAngle = 1.48;
          }

          threeRefs.current.trafficRedMat.emissiveIntensity = rEm;
          threeRefs.current.trafficAmberMat.emissiveIntensity = aEm;
          threeRefs.current.trafficGreenMat.emissiveIntensity = gEm;

          threeRefs.current.gateDoors.forEach((door) => {
            door.rotation.z = THREE.MathUtils.damp(door.rotation.z, targetDoorAngle, 14, dt);
          });
        }

        // 2. Countdown State Machine
        if (st === 'COUNTDOWN' && plan && activeSessionIdRef.current === plan.sessionId) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900) {
            if (countdownLastBeepRef.current !== 3) {
              countdownLastBeepRef.current = 3;
              setCountdownLabel('3');
              soundEngineRef.current?.playCountdownBeep(3, isMutedRef.current, plan.sessionId);
            }
          } else if (cdMs < 1800) {
            if (countdownLastBeepRef.current !== 2) {
              countdownLastBeepRef.current = 2;
              setCountdownLabel('2');
              soundEngineRef.current?.playCountdownBeep(2, isMutedRef.current, plan.sessionId);
            }
          } else if (cdMs < 2600) {
            if (countdownLastBeepRef.current !== 1) {
              countdownLastBeepRef.current = 1;
              setCountdownLabel('1');
              soundEngineRef.current?.playCountdownBeep(1, isMutedRef.current, plan.sessionId);
            }
          } else if (cdMs < COUNTDOWN_TOTAL_MS) {
            if (countdownLastBeepRef.current !== 0) {
              countdownLastBeepRef.current = 0;
              setCountdownLabel('XUẤT PHÁT!');
              soundEngineRef.current?.playHorseStartBell(isMutedRef.current, plan.sessionId);
            }
          } else {
            countdownLastBeepRef.current = -1;
            setCountdownLabel('');
            raceAccumulatedMsRef.current = 0;
            racePhaseStartPerfRef.current = nowPerf;
            raceStateRef.current = 'RACING';
            setRaceState('RACING');
            soundEngineRef.current?.startHoofbeatLoop(() => isMutedRef.current, plan.sessionId);
          }
        }

        // 3. Evaluate Monotonic Race Kinematics
        let evalRes: ReturnType<typeof evaluateHorseRaceFrame> | null = null;
        let currentRaceElapsedMs = raceAccumulatedMsRef.current;

        if (st === 'RACING' && plan && activeSessionIdRef.current === plan.sessionId) {
          currentRaceElapsedMs =
            raceAccumulatedMsRef.current + (nowPerf - racePhaseStartPerfRef.current);
          evalRes = evaluateHorseRaceFrame(plan, currentRaceElapsedMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          // Update single shared hoofbeat rhythm cadence
          soundEngineRef.current?.updateHoofbeatProgress(evalRes.u);

          if (evalRes.isRaceCompleted) {
            raceAccumulatedMsRef.current = plan.durationMs;
            finishingStartPerfRef.current = nowPerf;
            raceStateRef.current = 'FINISHING';
            setRaceState('FINISHING');
            soundEngineRef.current?.playHorseFinishFanfare(isMutedRef.current, plan.sessionId);
          }
        } else if (st === 'PAUSED' && plan) {
          evalRes = evaluateHorseRaceFrame(
            plan,
            raceAccumulatedMsRef.current,
            framesScratchRef.current
          );
          framesScratchRef.current = evalRes.frames;
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          evalRes = evaluateHorseRaceFrame(plan, plan.durationMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            raceStateRef.current = 'RESULT';
            setRaceState('RESULT');
            commitRaceWinnerRef.current(plan);
          }
        }

        // 4. Throttled React HUD & Electronic Stadium Scoreboard (~10 Hz)
        if (nowPerf - lastHudUpdatePerfRef.current > 95) {
          lastHudUpdatePerfRef.current = nowPerf;
          if (evalRes && plan) {
            setElapsedDisplaySec(Math.min(plan.durationSec, currentRaceElapsedMs / 1000));
            const sorted = evalRes.frames
              .map((f, idx) => ({
                laneNumber: plan.racers[idx].laneNumber,
                displayLabel: plan.racers[idx].displayLabel,
                progressPct: Math.round(f.progress * 100),
                badgeHex: plan.racers[idx].palette.saddleHex,
              }))
              .sort((a, b) => b.progressPct - a.progressPct)
              .slice(0, 3);
            setLiveTop3(sorted);
          }

          if (threeRefs.current.scoreboardCtx && threeRefs.current.scoreboardTex) {
            const sStatus =
              st === 'RACING'
                ? 'ĐANG TRANH TÀI'
                : st === 'COUNTDOWN'
                ? 'XUẤT PHÁT'
                : st === 'FINISHING'
                ? 'CÁN ĐÍCH!'
                : st === 'RESULT'
                ? 'CHIẾN THẮNG'
                : st === 'PAUSED'
                ? 'TẠM DỪNG'
                : 'SẴN SÀNG';
            const dur = plan ? plan.durationSec : durationSecRef.current;
            const sTimer = `${Math.min(dur, currentRaceElapsedMs / 1000).toFixed(1)}s / ${dur}s`;
            const leaderIdx = evalRes ? evalRes.leaderLaneIndex : 0;
            const leaderEntry =
              plan && plan.racers[leaderIdx]
                ? plan.racers[leaderIdx]
                : previewLineupRef.current[0];
            const sLeader =
              st === 'RESULT' && plan
                ? `QUÁN QUÂN: ${plan.winnerDisplayLabel}`
                : leaderEntry
                ? `DẪN ĐẦU: L${leaderEntry.laneNumber} · ${leaderEntry.displayLabel}`
                : 'SẴN SÀNG ĐƯỜNG ĐUA';

            drawScoreboardCanvas(threeRefs.current.scoreboardCtx, sStatus, sTimer, sLeader);
            threeRefs.current.scoreboardTex.needsUpdate = true;
          }
        }

        // 5. Update Articulated 3D Horse Rigs (Gallop Cycle, Mane, Tail, Ground Contact)
        const rigs = threeRefs.current.horseRigs;
        const slowMoFactor = st === 'FINISHING' ? 0.35 : 1.0;

        for (let i = 0; i < rigs.length; i++) {
          const rig = rigs[i];
          const f = evalRes && evalRes.frames[i] ? evalRes.frames[i] : null;
          let xPos = f ? f.x : TRACK_START_X;
          const zPos = f ? f.z : rig.racer.laneZ;

          const isWinnerCelebrate =
            (st === 'FINISHING' || st === 'RESULT') && plan && i === plan.winnerLaneIndex;

          // Winner glides past finish wire toward victory podium during finishing/result
          if (st === 'FINISHING' && plan) {
            const finU = Math.min(1, (nowPerf - finishingStartPerfRef.current) / FINISHING_SLOWMO_MS);
            if (i === plan.winnerLaneIndex) {
              xPos = TRACK_FINISH_X + finU * 2.2;
            } else {
              xPos = Math.min(TRACK_FINISH_X - 0.35, xPos + finU * 0.45);
            }
          } else if (st === 'RESULT' && plan && i === plan.winnerLaneIndex) {
            xPos = TRACK_FINISH_X + 2.2;
          }

          rig.root.position.set(xPos, 0, zPos);

          // Advance gallop phase monotonically proportional to distance travelled
          const dx = Math.max(0, xPos - (horsePrevXRef.current[i] ?? xPos));
          horsePrevXRef.current[i] = xPos;
          if (st === 'RACING' || st === 'FINISHING') {
            horseStrideAccumRef.current[i] =
              (horseStrideAccumRef.current[i] ?? 0) + dx * 3.1 * slowMoFactor;
          }

          const isGalloping = st === 'RACING' || (st === 'FINISHING' && dx > 0.001);
          const phase = (horseStrideAccumRef.current[i] ?? 0) + rig.racer.stridePhaseOffset;

          if (isGalloping) {
            const speedIntensity = f ? Math.min(1.35, Math.max(0.75, f.speedNorm)) : 1.0;

            // Body gallop suspension bounce & pitch
            const bounce = Math.abs(Math.sin(phase)) * 0.14 * speedIntensity;
            const pitch = Math.cos(phase) * 0.075 * speedIntensity;
            rig.bodyGroup.position.y = bounce;
            rig.bodyGroup.rotation.z = pitch;

            // Neck & Head rhythmic gallop thrust
            rig.neckGroup.rotation.z = -0.52 + Math.sin(phase - 0.6) * 0.14;
            rig.headGroup.rotation.z = 0.22 + Math.cos(phase - 0.4) * 0.10;

            // 4-beat asymmetric gallop leg cycle (FL, FR, BL, BR)
            const flP = phase;
            const frP = phase + 0.72;
            const blP = phase + Math.PI;
            const brP = phase + Math.PI + 0.68;

            rig.legFL.upperPivot.rotation.z = Math.sin(flP) * 0.68;
            rig.legFL.lowerPivot.rotation.z = -0.32 - Math.max(0, -Math.cos(flP)) * 0.75;

            rig.legFR.upperPivot.rotation.z = Math.sin(frP) * 0.68;
            rig.legFR.lowerPivot.rotation.z = -0.32 - Math.max(0, -Math.cos(frP)) * 0.75;

            rig.legBL.upperPivot.rotation.z = Math.sin(blP) * 0.64;
            rig.legBL.lowerPivot.rotation.z = 0.26 + Math.max(0, Math.cos(blP)) * 0.52;

            rig.legBR.upperPivot.rotation.z = Math.sin(brP) * 0.64;
            rig.legBR.lowerPivot.rotation.z = 0.26 + Math.max(0, Math.cos(brP)) * 0.52;

            // Mane & Tail wind ripple
            rig.maneMeshes.forEach((tuft, mIdx) => {
              tuft.rotation.z = 0.35 + Math.sin(tSec * 14 + mIdx * 0.7 + i) * 0.22;
            });
            rig.tailUpper.rotation.z = -1.18 + Math.sin(tSec * 12 + i) * 0.16;
            rig.tailLower.rotation.z = -0.25 + Math.cos(tSec * 14 + i) * 0.24;
          } else if (isWinnerCelebrate && st === 'RESULT') {
            // Victory proud stance (gentle heroic head nod & triumphant tail sway)
            const vicT = tSec * 3.2 + rig.racer.idlePhaseOffset;
            rig.bodyGroup.position.y = Math.abs(Math.sin(vicT)) * 0.05;
            rig.bodyGroup.rotation.z = Math.sin(vicT) * 0.035;
            rig.neckGroup.rotation.z = -0.44 + Math.sin(vicT * 0.8) * 0.06;
            rig.headGroup.rotation.z = 0.16 + Math.cos(vicT * 0.9) * 0.06;
            // Raised front foreleg proud pose
            rig.legFL.upperPivot.rotation.z = 0.38 + Math.sin(vicT) * 0.14;
            rig.legFL.lowerPivot.rotation.z = -0.65;
            rig.legFR.upperPivot.rotation.z = 0;
            rig.legFR.lowerPivot.rotation.z = 0;
            rig.legBL.upperPivot.rotation.z = 0;
            rig.legBL.lowerPivot.rotation.z = 0;
            rig.legBR.upperPivot.rotation.z = 0;
            rig.legBR.lowerPivot.rotation.z = 0;
            rig.tailUpper.rotation.z = -0.72 + Math.sin(tSec * 4) * 0.14;
            rig.tailLower.rotation.z = Math.sin(tSec * 4.5) * 0.18;
          } else {
            // Calm Idle Breathing / Standing at Gate
            const idleT = tSec * 2.2 + rig.racer.idlePhaseOffset;
            rig.bodyGroup.position.y = Math.sin(idleT) * 0.014;
            rig.bodyGroup.rotation.z = 0;
            rig.neckGroup.rotation.z = -0.52 + Math.sin(idleT * 0.7) * 0.04;
            rig.headGroup.rotation.z = 0.22 + Math.cos(idleT * 0.85) * 0.04;
            rig.legFL.upperPivot.rotation.z = 0;
            rig.legFL.lowerPivot.rotation.z = 0;
            rig.legFR.upperPivot.rotation.z = 0;
            rig.legFR.lowerPivot.rotation.z = 0;
            rig.legBL.upperPivot.rotation.z = 0;
            rig.legBL.lowerPivot.rotation.z = 0;
            rig.legBR.upperPivot.rotation.z = 0;
            rig.legBR.lowerPivot.rotation.z = 0;
            rig.maneMeshes.forEach((tuft, mIdx) => {
              tuft.rotation.z = 0.28 + Math.sin(tSec * 2.4 + mIdx) * 0.05;
            });
            rig.tailUpper.rotation.z = -0.58 + Math.sin(tSec * 2.6 + i) * 0.09;
            rig.tailLower.rotation.z = Math.cos(tSec * 2.6 + i) * 0.08;
          }

          // Leader / Champion Halo Ring
          const haloMat = rig.haloRing.material as THREE.MeshBasicMaterial;
          if (isWinnerCelebrate) {
            haloMat.color.set('#FACC15');
            haloMat.opacity = isReduced ? 0.85 : 0.75 + Math.sin(tSec * 5) * 0.2;
            const hs = isReduced ? 1.18 : 1.18 + Math.sin(tSec * 4.5) * 0.1;
            rig.haloRing.scale.set(hs, hs, 1);
          } else if (f?.isLeading && st === 'RACING') {
            haloMat.color.set('#FACC15');
            haloMat.opacity = 0.65;
            rig.haloRing.scale.set(1.06, 1.06, 1);
          } else {
            haloMat.color.set(rig.racer.palette.saddleHex);
            haloMat.opacity = 0.24;
            rig.haloRing.scale.set(1, 1, 1);
          }
        }

        // 6. Victory Spotlight & Rotating 3D Golden Trophy
        if (threeRefs.current.trophyGroup) {
          threeRefs.current.trophyGroup.rotation.y = isReduced ? 0.4 : tSec * 0.75;
          threeRefs.current.trophyGroup.position.y =
            isReduced ? 0 : Math.sin(tSec * 2.0) * 0.06;
        }
        if (threeRefs.current.victorySpotLight) {
          const targetSpotIntensity = st === 'RESULT' ? 42 : st === 'FINISHING' ? 24 : 0;
          threeRefs.current.victorySpotLight.intensity = THREE.MathUtils.damp(
            threeRefs.current.victorySpotLight.intensity,
            targetSpotIntensity,
            6,
            dt
          );
          if (plan && plan.racers[plan.winnerLaneIndex]) {
            const wz = plan.racers[plan.winnerLaneIndex].laneZ;
            threeRefs.current.victorySpotLight.position.set(TRACK_FINISH_X + 2.2, 10.5, wz);
            threeRefs.current.victorySpotLight.target.position.set(TRACK_FINISH_X + 2.2, 0.5, wz);
          }
        }

        // 7. Instanced Cheering Spectators
        if (threeRefs.current.spectatorInstanced) {
          const sInst = threeRefs.current.spectatorInstanced;
          const base = threeRefs.current.spectatorBasePositions;
          const cheerAmp =
            isReduced ? 0 : st === 'RACING' ? 0.14 : st === 'FINISHING' || st === 'RESULT' ? 0.22 : 0.02;
          const cheerSpeed = st === 'FINISHING' || st === 'RESULT' ? 8.5 : 5.5;
          for (let i = 0; i < base.length; i++) {
            const b = base[i];
            const dy = Math.abs(Math.sin(tSec * cheerSpeed + b.phase)) * cheerAmp;
            _tmpVecA.set(b.x, b.y + dy, b.z);
            _tmpQuat.identity();
            _tmpScale.set(1, 1, 1);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            sInst.setMatrixAt(i, _tmpMatrix);
          }
          sInst.instanceMatrix.needsUpdate = true;
        }

        // 8. Instanced Dirt/Sand Dust Behind Galloping Hooves
        if (threeRefs.current.dustInstanced && rigs.length > 0) {
          const dInst = threeRefs.current.dustInstanced;
          const seeds = threeRefs.current.dustSeeds;
          const activeDust = (st === 'RACING' || st === 'FINISHING') && !isReduced;
          for (let i = 0; i < dInst.count; i++) {
            if (!activeDust) {
              _tmpMatrix.makeScale(0, 0, 0);
              dInst.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            const rig = rigs[i % rigs.length];
            const ph = (tSec * 2.4 + seeds[i]) % 1;
            const dx = rig.root.position.x - 0.55 - ph * 2.4;
            const dz = rig.root.position.z + (seeds[(i + 19) % dInst.count] - 0.5) * 0.52;
            const dy = 0.08 + ph * 0.48;
            const sc = (1 - ph) * 1.35;
            _tmpVecA.set(dx, dy, dz);
            _tmpQuat.identity();
            _tmpScale.set(sc, sc, sc);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            dInst.setMatrixAt(i, _tmpMatrix);
          }
          dInst.instanceMatrix.needsUpdate = true;
        }

        // 9. Instanced Victory Confetti
        if (threeRefs.current.confettiInstanced) {
          const conf = threeRefs.current.confettiInstanced;
          const cStates = threeRefs.current.confettiStates;
          const showConfetti = (st === 'FINISHING' || st === 'RESULT') && !isReduced;
          for (let i = 0; i < cStates.length; i++) {
            const c = cStates[i];
            if (!showConfetti) {
              _tmpMatrix.makeScale(0, 0, 0);
              conf.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            if (c.y < -0.5) {
              c.y = 4.6 + Math.random() * 3.8;
              c.x = TRACK_FINISH_X + 1.2 + (Math.random() - 0.5) * 7.5;
              c.z = (Math.random() - 0.5) * 13.5;
            }
            c.y -= c.vy * dt * 1.25;
            c.x += Math.sin(tSec * 2 + i) * 0.65 * dt;
            _tmpVecA.set(c.x, c.y, c.z);
            _tmpEuler.set(tSec * c.rotSpeed, tSec * (c.rotSpeed * 0.7), i);
            _tmpQuat.setFromEuler(_tmpEuler);
            _tmpScale.set(1, 1, 1);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            conf.setMatrixAt(i, _tmpMatrix);
          }
          conf.instanceMatrix.needsUpdate = true;
        }

        // 10. Smooth Damped 5-Angle Camera Choreography (never covers student nameplates)
        if (threeRefs.current.camera) {
          let desiredMode = cameraModeRef.current;

          if (autoCameraRef.current && !isReduced) {
            if (st === 'READY') {
              desiredMode = 'WIDE_STADIUM';
            } else if (st === 'COUNTDOWN') {
              desiredMode = 'SIDE_TRACKING';
            } else if (st === 'RACING' && evalRes) {
              if (evalRes.u < 0.16) desiredMode = 'WIDE_STADIUM';
              else if (evalRes.u < 0.58) desiredMode = 'SIDE_TRACKING';
              else if (evalRes.u < 0.80) desiredMode = 'FRONT_CHASE';
              else desiredMode = 'FINISH_LINE';
            } else if (st === 'FINISHING' || st === 'RESULT') {
              desiredMode = 'FINISH_LINE';
            }
          }

          const packX = evalRes ? evalRes.packCenterX : TRACK_START_X + 2;
          const leadX =
            evalRes && evalRes.frames[evalRes.leaderLaneIndex]
              ? evalRes.frames[evalRes.leaderLaneIndex].x
              : packX;
          const focusX = packX * 0.45 + leadX * 0.55;
          const winZ =
            plan && plan.racers[plan.winnerLaneIndex]
              ? plan.racers[plan.winnerLaneIndex].laneZ * 0.45
              : 0;

          let tx = 0;
          let ty = 12.2;
          let tz = 22.0;
          let lx = 0;
          let ly = 1.05;
          let lz = 0;

          if (st === 'READY' && desiredMode === 'WIDE_STADIUM' && !isReduced) {
            // Gentle stadium fly-by drift while waiting at starting gate
            tx = Math.sin(tSec * 0.35) * 4.5;
            ty = 11.4 + Math.cos(tSec * 0.3) * 0.6;
            tz = 21.5;
            lx = -2.0;
            ly = 1.1;
            lz = 0;
          } else if (desiredMode === 'SIDE_TRACKING') {
            tx = Math.min(TRACK_FINISH_X - 3, focusX - 3.0);
            ty = 5.4;
            tz = 13.6;
            lx = Math.min(TRACK_FINISH_X + 1.5, focusX + 2.4);
            ly = 1.25;
            lz = 0;
          } else if (desiredMode === 'FRONT_CHASE') {
            tx = Math.min(TRACK_FINISH_X + 5.5, leadX + 11.0);
            ty = 4.2;
            tz = 7.4;
            lx = focusX - 1.2;
            ly = 1.15;
            lz = 0;
          } else if (desiredMode === 'AERIAL_VIEW') {
            tx = focusX - 0.5;
            ty = 20.5;
            tz = 10.5;
            lx = focusX + 0.5;
            ly = 0.5;
            lz = 0;
          } else if (desiredMode === 'FINISH_LINE') {
            tx = TRACK_FINISH_X - 3.6;
            ty = 4.8;
            tz = 11.4;
            lx = TRACK_FINISH_X + 1.2;
            ly = 1.25;
            lz = winZ;
          }

          const camLambda = isReduced ? 8.0 : 3.8;
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
      console.warn('A06 WebGL unavailable, switching to 2D Equestrian Track fallback:', err);
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
      soundEngineRef.current?.dispose();
      soundEngineRef.current = null;
      voiceControllerRef.current?.dispose();
      voiceControllerRef.current = null;

      if (threeRefs.current.sharedHorseGeos) {
        Object.values(threeRefs.current.sharedHorseGeos).forEach((g) => g.dispose());
        threeRefs.current.sharedHorseGeos = null;
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
      threeRefs.current.horseRigs = [];
    };
  }, [rebuild3DHorsesForLineup]);

  // Apply Quality Preset updates dynamically
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

  // Pure 2D Fallback Animation Loop if WebGL unavailable
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
        const st = raceStateRef.current;
        const plan = activePlanRef.current;

        if (st === 'COUNTDOWN' && plan && activeSessionIdRef.current === plan.sessionId) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900 && countdownLastBeepRef.current !== 3) {
            countdownLastBeepRef.current = 3;
            setCountdownLabel('3');
            soundEngineRef.current?.playCountdownBeep(3, isMutedRef.current, plan.sessionId);
          } else if (cdMs >= 900 && cdMs < 1800 && countdownLastBeepRef.current !== 2) {
            countdownLastBeepRef.current = 2;
            setCountdownLabel('2');
            soundEngineRef.current?.playCountdownBeep(2, isMutedRef.current, plan.sessionId);
          } else if (cdMs >= 1800 && cdMs < 2600 && countdownLastBeepRef.current !== 1) {
            countdownLastBeepRef.current = 1;
            setCountdownLabel('1');
            soundEngineRef.current?.playCountdownBeep(1, isMutedRef.current, plan.sessionId);
          } else if (cdMs >= 2600 && cdMs < COUNTDOWN_TOTAL_MS && countdownLastBeepRef.current !== 0) {
            countdownLastBeepRef.current = 0;
            setCountdownLabel('XUẤT PHÁT!');
            soundEngineRef.current?.playHorseStartBell(isMutedRef.current, plan.sessionId);
          } else if (cdMs >= COUNTDOWN_TOTAL_MS) {
            countdownLastBeepRef.current = -1;
            setCountdownLabel('');
            raceAccumulatedMsRef.current = 0;
            racePhaseStartPerfRef.current = nowPerf;
            raceStateRef.current = 'RACING';
            setRaceState('RACING');
            soundEngineRef.current?.startHoofbeatLoop(() => isMutedRef.current, plan.sessionId);
          }
        }

        let elapsed = raceAccumulatedMsRef.current;
        let evalRes: ReturnType<typeof evaluateHorseRaceFrame> | null = null;
        if (st === 'RACING' && plan && activeSessionIdRef.current === plan.sessionId) {
          elapsed = raceAccumulatedMsRef.current + (nowPerf - racePhaseStartPerfRef.current);
          evalRes = evaluateHorseRaceFrame(plan, elapsed, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;
          soundEngineRef.current?.updateHoofbeatProgress(evalRes.u);
          setElapsedDisplaySec(Math.min(plan.durationSec, elapsed / 1000));
          if (evalRes.isRaceCompleted) {
            raceAccumulatedMsRef.current = plan.durationMs;
            finishingStartPerfRef.current = nowPerf;
            raceStateRef.current = 'FINISHING';
            setRaceState('FINISHING');
            soundEngineRef.current?.playHorseFinishFanfare(isMutedRef.current, plan.sessionId);
          }
        } else if (st === 'PAUSED' && plan) {
          evalRes = evaluateHorseRaceFrame(plan, raceAccumulatedMsRef.current, framesScratchRef.current);
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          evalRes = evaluateHorseRaceFrame(plan, plan.durationMs, framesScratchRef.current);
          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            raceStateRef.current = 'RESULT';
            setRaceState('RESULT');
            commitRaceWinnerRef.current(plan);
          }
        }

        if (ctx) {
          draw2DFallbackHorseTrack(
            ctx,
            w,
            h,
            plan ? plan.racers : previewLineupRef.current,
            evalRes ? evalRes.frames : null,
            st,
            countdownLastBeepRef.current === 3
              ? '3'
              : countdownLastBeepRef.current === 2
              ? '2'
              : countdownLastBeepRef.current === 1
              ? '1'
              : countdownLastBeepRef.current === 0
              ? 'XUẤT PHÁT!'
              : '',
            elapsed / 1000,
            plan ? plan.durationSec : durationSecRef.current,
            plan ? plan.winnerLaneIndex : -1
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
  // RACE CONTROLS (Session-guarded against double-click & stale callbacks)
  // ============================================================================
  const startNewRace = useCallback(() => {
    if (eligibleStudents.length === 0) return;
    const st = raceStateRef.current;
    if (st === 'COUNTDOWN' || st === 'RACING' || st === 'FINISHING' || st === 'PAUSED') return;

    // Unlock Web Audio synchronously inside user gesture & clear any leftover sound/voice
    soundEngineRef.current?.unlock();
    soundEngineRef.current?.stopAll();
    voiceControllerRef.current?.stop();

    // Immediate synchronous ref lock prevents rapid double-click race condition
    raceStateRef.current = 'COUNTDOWN';

    const plan = createFairHorseRaceTurnPlan({
      eligibleStudents,
      fullRoster,
      durationSec,
      heatMode,
      heatIndex: safeHeatIndex,
    });

    soundEngineRef.current?.setActiveTurnToken(plan.sessionId);
    activeSessionIdRef.current = plan.sessionId;
    activePlanRef.current = plan;
    framesScratchRef.current = [];
    raceAccumulatedMsRef.current = 0;
    countdownLastBeepRef.current = -1;
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
      plan.racers.slice(0, 3).map((r) => ({
        laneNumber: r.laneNumber,
        displayLabel: r.displayLabel,
        progressPct: 0,
        badgeHex: r.palette.saddleHex,
      }))
    );

    rebuild3DHorsesForLineup(plan.racers, null);
    setRaceState('COUNTDOWN');
  }, [durationSec, eligibleStudents, fullRoster, heatMode, rebuild3DHorsesForLineup, safeHeatIndex]);

  const pauseRace = useCallback(() => {
    if (raceStateRef.current !== 'RACING') return;
    raceAccumulatedMsRef.current += performance.now() - racePhaseStartPerfRef.current;
    soundEngineRef.current?.stopLoops();
    raceStateRef.current = 'PAUSED';
    setRaceState('PAUSED');
  }, []);

  const resumeRace = useCallback(() => {
    if (raceStateRef.current !== 'PAUSED') return;
    soundEngineRef.current?.unlock();
    racePhaseStartPerfRef.current = performance.now();
    raceStateRef.current = 'RACING';
    setRaceState('RACING');
    soundEngineRef.current?.startHoofbeatLoop(
      () => isMutedRef.current,
      activeSessionIdRef.current ?? undefined
    );
  }, []);

  const resetRace = useCallback(() => {
    soundEngineRef.current?.setActiveTurnToken(null);
    soundEngineRef.current?.stopAll();
    voiceControllerRef.current?.stop();
    activeSessionIdRef.current = null;
    activePlanRef.current = null;
    raceAccumulatedMsRef.current = 0;
    countdownLastBeepRef.current = -1;
    setCountdownLabel('');
    setElapsedDisplaySec(0);
    setActiveWinnerEntry(null);
    setActiveSessionId(null);
    setNoteSaveFeedback(null);
    setCloudSyncStatus('idle');
    rebuild3DHorsesForLineup(previewData.lineup, null);
    const nextState: HorseRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
    raceStateRef.current = nextState;
    setRaceState(nextState);
  }, [eligibleStudents.length, previewData.lineup, rebuild3DHorsesForLineup]);

  const handleSaveBonusAndNote = useCallback(async () => {
    if (!activeWinnerEntry || !activeSessionId || !activePlanRef.current) return;
    const combinedNote = formatHorseResultNote(bonusPoints, resultNote);

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

  // Keyboard shortcuts for classroom projector efficiency
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
        const st = raceStateRef.current;
        if (st === 'READY' || st === 'RESULT') startNewRace();
        else if (st === 'RACING') pauseRace();
        else if (st === 'PAUSED') resumeRace();
      } else if (e.key === '1') {
        setAutoCamera(false);
        setCameraMode('WIDE_STADIUM');
      } else if (e.key === '2') {
        setAutoCamera(false);
        setCameraMode('SIDE_TRACKING');
      } else if (e.key === '3') {
        setAutoCamera(false);
        setCameraMode('FRONT_CHASE');
      } else if (e.key === '4') {
        setAutoCamera(false);
        setCameraMode('AERIAL_VIEW');
      } else if (e.key === '5') {
        setAutoCamera(false);
        setCameraMode('FINISH_LINE');
      } else if (e.key === 'm' || e.key === 'M') {
        onToggleMute?.();
      } else if (e.key === 'f' || e.key === 'F') {
        if (onToggleFullscreen) onToggleFullscreen();
        else setIsPresentationMode((v) => !v);
      } else if (e.key === 'r' || e.key === 'R') {
        resetRace();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleFullscreen, onToggleMute, pauseRace, resetRace, resumeRace, startNewRace]);

  const isBusyRacing =
    raceState === 'COUNTDOWN' ||
    raceState === 'RACING' ||
    raceState === 'PAUSED' ||
    raceState === 'FINISHING';

  const presentTotal = fullRoster.filter((s) => !absentIds?.has(s.id)).length;
  const absentCount = absentIds ? absentIds.size : 0;
  const calledCount = calledSessionIds ? calledSessionIds.size : 0;

  return (
    <div
      className={`w-full flex flex-col bg-[#081933] text-white select-none overflow-hidden ${
        isFullscreen
          ? 'h-dvh w-screen rounded-none border-0'
          : isPresentationMode
          ? 'fixed inset-0 z-50 h-dvh w-screen rounded-none border-0'
          : 'rounded-3xl border border-[#1E3A5F] shadow-2xl min-h-[640px]'
      }`}
    >
      {/* ====================================================================
          TOP COMPACT TEACHER & PROJECTOR CONTROL BAR (Synced with A05)
         ==================================================================== */}
      <div className="bg-[#0F2442] border-b border-white/10 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
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

          <div className="flex items-center gap-2 bg-[#07152B] border border-amber-400/40 rounded-xl px-2.5 py-1 shrink-0">
            <span className="px-1.5 py-0.5 bg-[#FACC15] text-[#0F172A] rounded text-[11px] font-black tracking-wide">
              A06
            </span>
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-white whitespace-nowrap">
              ĐUA NGỰA 3D
            </h2>
          </div>

          {classes.length > 0 && onSelectSourceKey ? (
            <select
              value={selectedSourceKey}
              onChange={(e) => onSelectSourceKey(e.target.value)}
              disabled={isBusyRacing}
              className="bg-[#07152B] border border-sky-400/35 text-white text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer disabled:opacity-50 max-w-[180px]"
              aria-label="Chọn lớp học"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-[#0F2442] text-white">
                  Lớp {cls.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2.5 py-1 bg-[#07152B] border border-sky-400/30 rounded-xl text-xs font-bold text-sky-300 whitespace-nowrap">
              {resolvedClassName}
            </span>
          )}

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300 tabular-nums whitespace-nowrap">
            <span>
              Sẵn sàng: <strong className="text-[#FACC15]">{eligibleStudents.length}</strong>/{presentTotal}
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
              disabled={isBusyRacing}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0 ${
                antiDuplicate
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-amber-500/20 border-amber-400/50 text-amber-200'
              }`}
              title="Bật/Tắt cơ chế chống gọi trùng trong phiên"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{antiDuplicate ? 'Chống trùng: BẬT' : 'Chống trùng: TẮT'}</span>
            </button>
          )}

          {/* Speed / Duration Selector: 5s / 10s / 15s */}
          <div className="flex items-center bg-[#07152B] border border-white/15 rounded-xl p-0.5 shrink-0">
            {(
              [
                { sec: 5 as HorseRaceDurationSec, label: 'Nhanh 5s' },
                { sec: 10 as HorseRaceDurationSec, label: 'Thường 10s' },
                { sec: 15 as HorseRaceDurationSec, label: 'Kịch tính 15s' },
              ]
            ).map((opt) => (
              <button
                key={opt.sec}
                type="button"
                disabled={isBusyRacing}
                onClick={() => setDurationSec(opt.sec)}
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                  durationSec === opt.sec
                    ? 'bg-[#FACC15] text-[#0F172A]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 3D Quality Toggle */}
          <button
            type="button"
            onClick={() =>
              setQualityPreset((q) => (q === 'HIGH' ? 'MEDIUM' : q === 'MEDIUM' ? 'LOW' : 'HIGH'))
            }
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-100 cursor-pointer whitespace-nowrap shrink-0"
            title="Chất lượng đồ họa 3D (hạ xuống Nhẹ cho máy cấu hình yếu)"
          >
            <Sliders className="w-3.5 h-3.5 text-sky-300" />
            <span>{qualityPreset === 'HIGH' ? '3D Cao' : qualityPreset === 'MEDIUM' ? '3D Vừa' : '3D Nhẹ'}</span>
          </button>

          {/* Reduced Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion((v) => !v)}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer border whitespace-nowrap shrink-0 ${
              reducedMotion
                ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
                : 'bg-white/10 border-transparent text-slate-200 hover:bg-white/20'
            }`}
            title="Giảm chuyển động & hiệu ứng nhấp nháy"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{reducedMotion ? 'Giảm CĐ: BẬT' : 'Giảm CĐ'}</span>
          </button>

          {onOpenAbsentModal && (
            <button
              type="button"
              onClick={onOpenAbsentModal}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              title="Điểm danh / Học sinh vắng"
            >
              <Users className="w-3.5 h-3.5 text-sky-300" />
              <span className="hidden lg:inline">Vắng / DS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRecordsDrawer((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              showRecordsDrawer
                ? 'bg-[#FACC15] text-[#0F172A]'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Bảng kết quả các lượt đua ngựa"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lịch sử ({turnRecords.length})</span>
          </button>

          {onOpenHistoryModal && (
            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-sky-200 cursor-pointer shrink-0"
              title="Lịch sử chung toàn bộ trò chơi"
            >
              <Award className="w-3.5 h-3.5" />
            </button>
          )}

          {onResetSession && (
            <button
              type="button"
              onClick={() => {
                resetRace();
                onResetSession();
              }}
              disabled={isBusyRacing}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap shrink-0"
              title="Làm mới chu kỳ gọi cả lớp"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FACC15]" />
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
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-sky-300" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (onToggleFullscreen) onToggleFullscreen();
              else setIsPresentationMode((v) => !v);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
            title="Chế độ trình chiếu máy chiếu 16:9 (F)"
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
          SECONDARY BAR: 5 CAMERA ANGLES + AUTO DIRECTOR + FAIRNESS HEAT MODE
         ==================================================================== */}
      <div className="bg-[#0A1B35] border-b border-white/10 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mr-1 whitespace-nowrap">
            <Camera className="w-3.5 h-3.5 text-sky-300" />
            Camera:
          </span>
          {(
            [
              { key: 'WIDE_STADIUM', label: '1 · Toàn cảnh' },
              { key: 'SIDE_TRACKING', label: '2 · Song song' },
              { key: 'FRONT_CHASE', label: '3 · Phía trước' },
              { key: 'AERIAL_VIEW', label: '4 · Trên cao' },
              { key: 'FINISH_LINE', label: '5 · Vạch đích' },
            ] as Array<{ key: HorseRaceCameraMode; label: string }>
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
                  ? 'bg-[#0284C7] text-white'
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
                ? 'bg-[#FACC15] text-[#0F172A] border-[#FACC15]'
                : 'bg-white/5 text-slate-300 border-white/15 hover:bg-white/15'
            }`}
            title="Tự động chuyển góc máy mượt theo diễn biến cuộc đua"
          >
            {autoCamera ? 'Tự động: BẬT' : 'Tự động: TẮT'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {eligibleStudents.length > MAX_HORSE_LANES ? (
            <>
              <div className="flex items-center bg-[#07152B] rounded-lg p-0.5 border border-white/10">
                <button
                  type="button"
                  disabled={isBusyRacing}
                  onClick={() => setHeatMode('REPRESENTATIVE_FAIR')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                    heatMode === 'REPRESENTATIVE_FAIR'
                      ? 'bg-[#38BDF8] text-[#0F172A]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Chọn công bằng xác suất 1/N từ toàn bộ sĩ số sẵn sàng, lên 6 làn đua rõ nét"
                >
                  Gọi 1 HS công bằng (1/{eligibleStudents.length})
                </button>
                <button
                  type="button"
                  disabled={isBusyRacing}
                  onClick={() => setHeatMode('BRACKET_HEATS')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                    heatMode === 'BRACKET_HEATS'
                      ? 'bg-[#38BDF8] text-[#0F172A]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Thi đấu nhiều vòng theo bảng, mỗi bảng tối đa 6 làn"
                >
                  Chia bảng ({heatBuckets.length} bảng)
                </button>
              </div>

              {heatMode === 'BRACKET_HEATS' && heatBuckets.length > 1 && (
                <div className="flex items-center gap-1 bg-[#07152B] border border-white/15 rounded-lg px-1.5 py-0.5">
                  <button
                    type="button"
                    disabled={isBusyRacing || safeHeatIndex === 0}
                    onClick={() => setHeatIndex((i) => Math.max(0, i - 1))}
                    className="p-0.5 hover:bg-white/15 rounded disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold text-[#FACC15] px-1 tabular-nums whitespace-nowrap">
                    Bảng {safeHeatIndex + 1}/{heatBuckets.length}
                  </span>
                  <button
                    type="button"
                    disabled={isBusyRacing || safeHeatIndex >= heatBuckets.length - 1}
                    onClick={() => setHeatIndex((i) => Math.min(heatBuckets.length - 1, i + 1))}
                    className="p-0.5 hover:bg-white/15 rounded disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <span className="text-[11px] font-bold text-sky-300 whitespace-nowrap">
              Đang hiển thị đủ {eligibleStudents.length} làn đua trên sân vận động 3D
            </span>
          )}

          <button
            type="button"
            onClick={() => setSpeechEnabled((v) => !v)}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer border whitespace-nowrap ${
              speechEnabled
                ? 'bg-[#FACC15]/20 border-[#FACC15]/50 text-[#FACC15]'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
          >
            {speechEnabled ? 'Đọc tên: BẬT' : 'Đọc tên: TẮT'}
          </button>
        </div>
      </div>

      {/* ====================================================================
          MAIN 16:9 3D EQUESTRIAN ARENA STAGE + NON-OCCLUDING HUD
         ==================================================================== */}
      <div className="relative flex-1 min-h-[460px] lg:min-h-[540px] w-full bg-[#0C2444] overflow-hidden">
        {/* WebGL Mount Point */}
        <div
          ref={stageMountRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'hidden' : 'block'}`}
        />

        {/* Automatic 2D Canvas Fallback */}
        <canvas
          ref={fallbackCanvasRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'block' : 'hidden'}`}
        />

        {/* Top-Left Live Race Clock & Top 3 Standings (No backdrop-blur over WebGL) */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none max-w-[295px]">
          <div className="bg-[#0F2442]/92 border border-sky-400/40 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FACC15]" />
              <span className="text-sm sm:text-base font-black tabular-nums text-white">
                {elapsedDisplaySec.toFixed(1)}s
              </span>
              <span className="text-xs font-bold text-slate-300 tabular-nums">/ {durationSec}s</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                raceState === 'RACING'
                  ? 'bg-emerald-500 text-white'
                  : raceState === 'COUNTDOWN'
                  ? 'bg-[#FACC15] text-[#0F172A]'
                  : raceState === 'PAUSED'
                  ? 'bg-amber-500 text-[#0F172A]'
                  : raceState === 'FINISHING' || raceState === 'RESULT'
                  ? 'bg-[#0284C7] text-white'
                  : 'bg-white/15 text-slate-200'
              }`}
            >
              {raceState === 'IDLE'
                ? 'HẾT LƯỢT'
                : raceState === 'READY'
                ? 'SẴN SÀNG'
                : raceState === 'COUNTDOWN'
                ? 'CHUẨN BỊ'
                : raceState === 'RACING'
                ? 'ĐANG ĐUA'
                : raceState === 'PAUSED'
                ? 'TẠM DỪNG'
                : raceState === 'FINISHING'
                ? 'CÁN ĐÍCH'
                : 'HOÀN TẤT'}
            </span>
          </div>

          {liveTop3.length > 0 && (raceState === 'RACING' || raceState === 'PAUSED' || raceState === 'FINISHING') && (
            <div className="bg-[#0F2442]/92 border border-white/15 rounded-2xl px-3 py-2 shadow-lg space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300">
                Bảng xếp hạng trực tiếp
              </div>
              {liveTop3.map((item, idx) => (
                <div key={item.laneNumber} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      style={{ backgroundColor: item.badgeHex }}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-bold text-white truncate">{item.displayLabel}</span>
                  </div>
                  <span className="font-black text-[#FACC15] tabular-nums shrink-0">
                    {item.progressPct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Countdown Signal Banner (3 - 2 - 1 - XUẤT PHÁT!) */}
        {raceState === 'COUNTDOWN' && countdownLabel && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#0F2442]/94 border-4 border-[#FACC15] rounded-3xl px-10 py-6 shadow-2xl text-center">
              <div className="text-xs font-extrabold uppercase tracking-widest text-sky-300 mb-1">
                CHUẨN BỊ XUẤT PHÁT
              </div>
              <div className="text-5xl sm:text-6xl font-black text-[#FACC15] tracking-tight">
                {countdownLabel}
              </div>
            </div>
          </div>
        )}

        {/* Empty Eligible Pool Guard */}
        {eligibleStudents.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#081933]/85">
            <div className="bg-[#0F2442] border-2 border-[#FACC15] rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FACC15]/20 border border-[#FACC15]/50 flex items-center justify-center">
                <UserCheck className="w-7 h-7 text-[#FACC15]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white">
                  {presentTotal === 0
                    ? 'Chưa có học sinh tham gia đường đua'
                    : 'Đã gọi hết 100% học sinh có mặt!'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {presentTotal === 0
                    ? 'Vui lòng kiểm tra danh sách lớp hoặc bỏ đánh dấu vắng để đưa học sinh lên đường đua.'
                    : 'Cơ chế chống trùng đang BẬT để đảm bảo công bằng. Thầy/cô bấm Làm mới chu kỳ để bắt đầu vòng mới.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                {presentTotal > 0 && onResetSession && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetSession();
                      resetRace();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-300 text-[#0F172A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg"
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

        {/* Compact Top-Right Winner Result Panel (Never obscures 3D horse & podium) */}
        {raceState === 'RESULT' && activeWinnerEntry && (
          <div className="absolute top-3 right-3 z-20 w-[calc(100%-24px)] sm:w-[370px] bg-[#0F2442]/96 border-2 border-[#FACC15] rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FACC15] text-[#0F172A] flex items-center justify-center shrink-0 shadow-md">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-[#FACC15]">
                    QUÁN QUÂN · LÀN #{activeWinnerEntry.laneNumber}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                    {activeWinnerEntry.safeName}
                  </h3>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-sky-500/25 border border-sky-400/40 text-[11px] font-extrabold text-sky-200 shrink-0 tabular-nums">
                #{activeWinnerEntry.formattedStt}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200 bg-[#07152B] rounded-xl px-3 py-2 border border-white/10">
              <span>Mã HS: <strong className="text-[#FACC15]">{activeWinnerEntry.safeCode}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Lớp: <strong className="text-white">{resolvedClassName}</strong></span>
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
                  <span className="text-[#FACC15] font-black tabular-nums">+{bonusPoints} điểm</span>
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
                        ? 'bg-[#FACC15] text-[#0F172A]'
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
                className="flex-1 bg-[#07152B] border border-white/20 focus:border-sky-400 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveBonusAndNote}
                className="px-3 py-2 rounded-xl bg-[#0284C7] hover:bg-[#0EA5E9] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
            </div>

            {/* Sync Status */}
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-sky-300" />
                    <span className="text-sky-200">Đã lưu phiên tại máy</span>
                  </>
                )}
              </span>
              {noteSaveFeedback && (
                <span className="text-[#FACC15] font-extrabold">{noteSaveFeedback}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={startNewRace}
                disabled={eligibleStudents.length === 0}
                className="py-2.5 px-3 rounded-xl bg-[#FACC15] hover:bg-amber-300 text-[#0F172A] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 shadow-lg"
              >
                <Flag className="w-4 h-4" />
                <span>Đua lượt tiếp</span>
              </button>
              <button
                type="button"
                onClick={resetRace}
                className="py-2.5 px-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Làm mới phiên</span>
              </button>
            </div>
          </div>
        )}

        {/* Turn History Drawer */}
        {showRecordsDrawer && (
          <div className="absolute top-3 right-3 z-30 w-[calc(100%-24px)] sm:w-[390px] max-h-[82%] bg-[#0F2442]/96 border-2 border-sky-400/60 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#FACC15]" />
                <h4 className="text-sm font-black text-white">
                  Lịch sử Đua Ngựa ({turnRecords.length})
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
                  Chưa có lượt đua ngựa nào được ghi nhận cho lớp này.
                </p>
              ) : (
                turnRecords.map((rec) => (
                  <div
                    key={rec.sessionId}
                    className="bg-[#07152B] border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">
                        #{rec.turnIndex} · {rec.studentName}
                      </div>
                      <div className="text-[11px] text-slate-300 flex flex-wrap gap-1.5 tabular-nums">
                        <span>STT #{rec.formattedStt}</span>
                        <span>·</span>
                        <span>Làn {rec.laneNumber}</span>
                        <span>·</span>
                        <span>{rec.durationSec}s</span>
                        {rec.bonusPoints > 0 && (
                          <span className="text-[#FACC15] font-black">+{rec.bonusPoints}đ</span>
                        )}
                      </div>
                      {rec.note && (
                        <div className="text-[11px] text-sky-300 truncate mt-0.5">{rec.note}</div>
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
          <div className="pointer-events-auto flex items-center gap-2.5 bg-[#0F2442]/92 border border-sky-400/40 rounded-2xl px-3.5 py-2 shadow-2xl">
            {(raceState === 'READY' || raceState === 'IDLE' || raceState === 'RESULT') && (
              <button
                type="button"
                disabled={eligibleStudents.length === 0}
                onClick={startNewRace}
                className="px-6 py-2.5 rounded-xl bg-[#FACC15] hover:bg-amber-300 text-[#0F172A] font-black text-sm sm:text-base flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-45 whitespace-nowrap"
              >
                <Play className="w-5 h-5 fill-[#0F172A]" />
                <span>{raceState === 'RESULT' ? 'ĐUA LƯỢT TIẾP (Space)' : 'BẮT ĐẦU ĐUA (Space)'}</span>
              </button>
            )}

            {raceState === 'COUNTDOWN' && (
              <div className="px-5 py-2 rounded-xl bg-sky-500/25 border border-sky-400/50 text-[#FACC15] font-black text-sm whitespace-nowrap">
                Đang đếm ngược xuất phát...
              </div>
            )}

            {raceState === 'RACING' && (
              <button
                type="button"
                onClick={pauseRace}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#0F172A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-md whitespace-nowrap"
              >
                <Pause className="w-4 h-4 fill-[#0F172A]" />
                <span>TẠM DỪNG (Space)</span>
              </button>
            )}

            {raceState === 'PAUSED' && (
              <button
                type="button"
                onClick={resumeRace}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#0F172A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-md whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-[#0F172A]" />
                <span>TIẾP TỤC ĐUA (Space)</span>
              </button>
            )}

            {raceState === 'FINISHING' && (
              <div className="px-5 py-2 rounded-xl bg-[#FACC15] text-[#0F172A] font-black text-sm flex items-center gap-2 whitespace-nowrap">
                <Trophy className="w-4 h-4" />
                <span>ĐANG TRAO CÚP VỀ ĐÍCH!</span>
              </div>
            )}

            {(raceState === 'RACING' || raceState === 'PAUSED' || raceState === 'COUNTDOWN') && (
              <button
                type="button"
                onClick={resetRace}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Hủy lượt hiện tại và đặt lại vị trí (R)"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Đặt lại</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          FOOTER LANE STRIP (6 Participating Horses Overview)
         ==================================================================== */}
      <div className="bg-[#07152B] border-t border-white/10 px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[11px] font-extrabold text-sky-300 uppercase tracking-wider shrink-0">
          Làn đua ({(activePlanRef.current && (isBusyRacing || raceState === 'RESULT')
            ? activePlanRef.current.racers
            : previewData.lineup
          ).length}):
        </span>
        {(activePlanRef.current && (isBusyRacing || raceState === 'RESULT')
          ? activePlanRef.current.racers
          : previewData.lineup
        ).map((r) => {
          const isWin = raceState === 'RESULT' && activeWinnerEntry?.student.id === r.student.id;
          return (
            <div
              key={`${r.laneNumber}_${r.student.id}`}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 shrink-0 border ${
                isWin
                  ? 'bg-[#FACC15] text-[#0F172A] border-white font-black'
                  : 'bg-[#0F2442] text-slate-100 border-white/15'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: r.palette.saddleHex }}
              />
              <span>L{r.laneNumber}:</span>
              <span className="truncate max-w-[140px]">{r.displayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HorseRace3DGame;
