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
  DuckRace3DState,
  DuckRaceDurationSec,
  DuckRaceCameraMode,
  DuckRaceHeatMode,
  DuckRaceQualityPreset,
  DuckRacerEntry,
  DuckRaceTurnPlan,
  DuckFrameState,
  MAX_DUCK_LANES,
  TRACK_START_X,
  TRACK_FINISH_X,
  TRACK_LENGTH,
  LANE_SPACING,
  COUNTDOWN_TOTAL_MS,
  FINISHING_SLOWMO_MS,
  computeHeatBuckets,
  buildPreviewLineup,
  createFairDuckRaceTurnPlan,
  evaluateDuckRaceFrame,
  DuckRaceTurnDeduplicator,
} from './duckRace3dMath';
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
  Sparkles,
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
} from 'lucide-react';

export interface DuckRace3DGameProps {
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

export interface DuckRaceTurnRecord {
  turnId: string;
  turnIndex: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  sttNumber: number;
  formattedStt: string;
  durationSec: DuckRaceDurationSec;
  heatMode: DuckRaceHeatMode;
  heatLabel: string;
  bonusPoints: number;
  note: string;
  selectedAt: string;
  cloudStatus: 'saved' | 'local_only' | 'error';
}

const LOCAL_RECORDS_PREFIX = 'taydo_a05_duckrace3d_records_v1';

// Pre-allocated scratch math helpers (never allocate inside requestAnimationFrame)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpMatrix = new THREE.Matrix4();
const _tmpEuler = new THREE.Euler();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();

// Audio & strict Vietnamese voice synthesis are managed via shared EduGameSoundBank & EduGameVoiceController.

// ============================================================================
// HIGH-DPI CANVAS TEXTURE BUILDERS (Vietnamese Labels & Banners)
// ============================================================================
function createBannerTexture(
  titleText: string,
  subText: string,
  bgHex: string,
  borderHex: string,
  titleHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Rounded backdrop
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.roundRect(12, 12, canvas.width - 24, canvas.height - 24, 34);
  ctx.fill();

  ctx.lineWidth = 10;
  ctx.strokeStyle = borderHex;
  ctx.stroke();

  // Checkered accents left & right
  const sq = 22;
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#FFFFFF' : '#10294A';
      ctx.fillRect(36 + c * sq, 46 + r * sq, sq, sq);
      ctx.fillRect(canvas.width - 36 - (3 - c) * sq, 46 + r * sq, sq, sq);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = titleHex;
  ctx.font = '900 66px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(titleText, canvas.width / 2, 92);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 34px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillText(subText, canvas.width / 2, 156);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

function createDuckNameplateTexture(
  racer: DuckRacerEntry,
  isHighlightedWinner: boolean
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 148;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Card shell
  ctx.fillStyle = isHighlightedWinner ? '#FFCC33' : 'rgba(16, 41, 74, 0.94)';
  ctx.beginPath();
  ctx.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 28);
  ctx.fill();

  ctx.lineWidth = isHighlightedWinner ? 7 : 5;
  ctx.strokeStyle = isHighlightedWinner ? '#FFFFFF' : racer.palette.bodyHex;
  ctx.stroke();

  // Lane badge circle
  ctx.fillStyle = racer.palette.badgeHex;
  ctx.beginPath();
  ctx.roundRect(26, 28, 92, 92, 22);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 40px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`L${racer.laneNumber}`, 72, 75);

  // Name & STT/Code
  ctx.textAlign = 'left';
  ctx.fillStyle = isHighlightedWinner ? '#10294A' : '#FFFFFF';
  ctx.font = '800 36px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(racer.displayLabel, 134, 58, 400);

  ctx.fillStyle = isHighlightedWinner ? '#1E3A8A' : '#93E5FA';
  ctx.font = '700 26px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(`STT #${racer.formattedStt} · ${racer.safeCode}`, 134, 103, 400);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ============================================================================
// COMPOSITE 3D DUCK RIG (9-10+ Distinct Anatomical & Sport Parts)
// ============================================================================
interface DuckRig3D {
  root: THREE.Group;
  hull: THREE.Group;
  wingLeft: THREE.Mesh;
  wingRight: THREE.Mesh;
  footLeft: THREE.Mesh;
  footRight: THREE.Mesh;
  nameSprite: THREE.Sprite;
  nameMaterial: THREE.SpriteMaterial;
  haloRing: THREE.Mesh;
  racer: DuckRacerEntry;
}

interface DuckSharedGeometries {
  body: THREE.SphereGeometry;
  head: THREE.SphereGeometry;
  tail: THREE.ConeGeometry;
  beakUpper: THREE.ConeGeometry;
  wing: THREE.SphereGeometry;
  eye: THREE.SphereGeometry;
  eyeHighlight: THREE.SphereGeometry;
  goggleBand: THREE.TorusGeometry;
  goggleLens: THREE.CylinderGeometry;
  foot: THREE.BoxGeometry;
  halo: THREE.RingGeometry;
}

function createSharedDuckGeometries(): DuckSharedGeometries {
  return {
    body: new THREE.SphereGeometry(0.46, 22, 16),
    head: new THREE.SphereGeometry(0.28, 20, 16),
    tail: new THREE.ConeGeometry(0.16, 0.34, 14),
    beakUpper: new THREE.ConeGeometry(0.14, 0.28, 14),
    wing: new THREE.SphereGeometry(0.22, 16, 12),
    eye: new THREE.SphereGeometry(0.048, 12, 10),
    eyeHighlight: new THREE.SphereGeometry(0.018, 8, 8),
    goggleBand: new THREE.TorusGeometry(0.265, 0.028, 10, 24),
    goggleLens: new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14),
    foot: new THREE.BoxGeometry(0.22, 0.045, 0.16),
    halo: new THREE.RingGeometry(0.58, 0.72, 32),
  };
}

function createCompositeDuckRig(
  racer: DuckRacerEntry,
  geos: DuckSharedGeometries,
  isHighlightedWinner: boolean
): DuckRig3D {
  const root = new THREE.Group();
  root.position.set(TRACK_START_X, 0.16, racer.laneZ);

  const hull = new THREE.Group();
  root.add(hull);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: racer.palette.bodyHex,
    roughness: 0.28,
    metalness: 0.06,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: racer.palette.wingHex,
    roughness: 0.34,
    metalness: 0.05,
  });
  const beakMat = new THREE.MeshStandardMaterial({
    color: racer.palette.beakHex,
    roughness: 0.32,
    metalness: 0.04,
  });
  const goggleMat = new THREE.MeshStandardMaterial({
    color: racer.palette.goggleHex,
    roughness: 0.25,
    metalness: 0.28,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: '#14C9E5',
    roughness: 0.12,
    metalness: 0.45,
    emissive: '#0B4B6B',
    emissiveIntensity: 0.35,
  });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.15 });
  const highlightMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });

  // 1. Sculpted Body (elongated oval along +X)
  const body = new THREE.Mesh(geos.body, bodyMat);
  body.scale.set(1.24, 0.84, 0.92);
  body.position.set(-0.04, 0.16, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  hull.add(body);

  // 2. Sculpted Head
  const head = new THREE.Mesh(geos.head, bodyMat);
  head.position.set(0.42, 0.56, 0);
  head.castShadow = true;
  hull.add(head);

  // 3. Perky Tail Crest
  const tail = new THREE.Mesh(geos.tail, wingMat);
  tail.position.set(-0.56, 0.36, 0);
  tail.rotation.z = Math.PI * 0.34;
  tail.castShadow = true;
  hull.add(tail);

  // 4. Sculpted Beak (+X forward)
  const beak = new THREE.Mesh(geos.beakUpper, beakMat);
  beak.scale.set(0.9, 1.1, 1.25);
  beak.rotation.z = -Math.PI * 0.5;
  beak.position.set(0.75, 0.52, 0);
  beak.castShadow = true;
  hull.add(beak);

  // 5 & 6. Articulated Left & Right Wings
  const wingLeft = new THREE.Mesh(geos.wing, wingMat);
  wingLeft.scale.set(1.35, 0.42, 0.85);
  wingLeft.position.set(-0.06, 0.24, 0.44);
  wingLeft.rotation.x = 0.22;
  wingLeft.castShadow = true;
  hull.add(wingLeft);

  const wingRight = new THREE.Mesh(geos.wing, wingMat);
  wingRight.scale.set(1.35, 0.42, 0.85);
  wingRight.position.set(-0.06, 0.24, -0.44);
  wingRight.rotation.x = -0.22;
  wingRight.castShadow = true;
  hull.add(wingRight);

  // 7. Expressive Eyes + Catchlights
  const eyeL = new THREE.Mesh(geos.eye, eyeMat);
  eyeL.position.set(0.61, 0.62, 0.14);
  hull.add(eyeL);
  const eyeR = new THREE.Mesh(geos.eye, eyeMat);
  eyeR.position.set(0.61, 0.62, -0.14);
  hull.add(eyeR);

  const hlL = new THREE.Mesh(geos.eyeHighlight, highlightMat);
  hlL.position.set(0.648, 0.64, 0.145);
  hull.add(hlL);
  const hlR = new THREE.Mesh(geos.eyeHighlight, highlightMat);
  hlR.position.set(0.648, 0.64, -0.145);
  hull.add(hlR);

  // 8. Racing Helmet Strap & Swim Goggles
  const goggleBand = new THREE.Mesh(geos.goggleBand, goggleMat);
  goggleBand.position.set(0.42, 0.64, 0);
  goggleBand.rotation.x = Math.PI * 0.5;
  goggleBand.rotation.y = 0.22;
  hull.add(goggleBand);

  const lensL = new THREE.Mesh(geos.goggleLens, lensMat);
  lensL.rotation.z = Math.PI * 0.5;
  lensL.position.set(0.63, 0.72, 0.11);
  hull.add(lensL);

  const lensR = new THREE.Mesh(geos.goggleLens, lensMat);
  lensR.rotation.z = Math.PI * 0.5;
  lensR.position.set(0.63, 0.72, -0.11);
  hull.add(lensR);

  // 9 & 10. Paddling Webbed Feet
  const footLeft = new THREE.Mesh(geos.foot, beakMat);
  footLeft.position.set(-0.18, -0.12, 0.22);
  hull.add(footLeft);

  const footRight = new THREE.Mesh(geos.foot, beakMat);
  footRight.position.set(-0.18, -0.12, -0.22);
  hull.add(footRight);

  // Glowing Water Halo Ring (bright gold on winner)
  const haloMat = new THREE.MeshBasicMaterial({
    color: isHighlightedWinner ? '#FFCC33' : '#14C9E5',
    transparent: true,
    opacity: isHighlightedWinner ? 0.92 : 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const haloRing = new THREE.Mesh(geos.halo, haloMat);
  haloRing.rotation.x = -Math.PI / 2;
  haloRing.position.set(0, -0.12, 0);
  root.add(haloRing);

  // Floating Crisp Nameplate Sprite
  const nameTex = createDuckNameplateTexture(racer, isHighlightedWinner);
  const nameMaterial = new THREE.SpriteMaterial({
    map: nameTex,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const nameSprite = new THREE.Sprite(nameMaterial);
  nameSprite.scale.set(2.5, 0.66, 1);
  nameSprite.position.set(0, 1.38, 0);
  root.add(nameSprite);

  return {
    root,
    hull,
    wingLeft,
    wingRight,
    footLeft,
    footRight,
    nameSprite,
    nameMaterial,
    haloRing,
    racer,
  };
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

// ============================================================================
// 2D CANVAS AQUATIC FALLBACK (If WebGL unavailable or lost on older devices)
// ============================================================================
function draw2DFallbackAquaticTrack(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lineup: DuckRacerEntry[],
  frames: DuckFrameState[] | null,
  raceState: DuckRace3DState,
  countdownLabel: string,
  elapsedSec: number,
  durationSec: number,
  winnerLaneIndex: number
) {
  ctx.clearRect(0, 0, width, height);

  // Stadium Sky + Water Backdrop
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#0D2647');
  skyGrad.addColorStop(0.24, '#10294A');
  skyGrad.addColorStop(0.25, '#009FE3');
  skyGrad.addColorStop(1, '#055E8C');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  const poolTop = Math.round(height * 0.25);
  const poolBottom = Math.round(height * 0.94);
  const poolHeight = poolBottom - poolTop;
  const startX = Math.round(width * 0.08);
  const finishX = Math.round(width * 0.89);
  const trackSpan = finishX - startX;

  // Stadium Banner Header
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TÂY ĐÔ AQUATIC ARENA · ĐƯỜNG ĐUA 2D AN TOÀN (WEBGL FALLBACK)', width / 2, poolTop * 0.55);

  // Checkered Finish Line
  const sq = 12;
  for (let y = poolTop; y < poolBottom; y += sq) {
    for (let c = 0; c < 2; c++) {
      ctx.fillStyle = (Math.floor((y - poolTop) / sq) + c) % 2 === 0 ? '#FFFFFF' : '#10294A';
      ctx.fillRect(finishX + c * sq, y, sq, Math.min(sq, poolBottom - y));
    }
  }
  ctx.fillStyle = '#FFCC33';
  ctx.font = '900 13px system-ui, sans-serif';
  ctx.fillText('ĐÍCH', finishX + 12, poolTop - 10);

  // Start Line
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(startX, poolTop);
  ctx.lineTo(startX, poolBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  const laneCount = Math.max(1, lineup.length);
  const laneH = poolHeight / laneCount;

  // Lanes & Vector Rubber Ducks
  lineup.forEach((racer, idx) => {
    const laneTop = poolTop + idx * laneH;
    const laneMidY = laneTop + laneH * 0.56;

    // Alternating water tint
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(20, 201, 229, 0.22)' : 'rgba(16, 41, 74, 0.14)';
    ctx.fillRect(0, laneTop, width, laneH);

    // Buoy divider
    if (idx > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, laneTop);
      ctx.lineTo(width, laneTop);
      ctx.stroke();
    }

    const progress = frames && frames[idx] ? frames[idx].progress : 0;
    const duckX = startX + progress * trackSpan;
    const bob = Math.sin(performance.now() * 0.008 + racer.bobPhaseOffset) * 3;
    const duckY = laneMidY + bob;

    // Wake ripples
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(Math.max(startX - 18, duckX - 42), duckY + 8);
    ctx.lineTo(duckX - 16, duckY + 4);
    ctx.stroke();

    // Vector Duck Body
    const scale = Math.max(0.68, Math.min(1.05, laneH / 64));
    ctx.save();
    ctx.translate(duckX, duckY);
    ctx.scale(scale, scale);

    if ((raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex) {
      ctx.strokeStyle = '#FFCC33';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 6, 30, 18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = racer.palette.bodyHex;
    ctx.beginPath();
    ctx.ellipse(0, 5, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = racer.palette.wingHex;
    ctx.beginPath();
    ctx.ellipse(-4, 6, 11, 7, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = racer.palette.bodyHex;
    ctx.beginPath();
    ctx.arc(14, -10, 11, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = racer.palette.beakHex;
    ctx.beginPath();
    ctx.moveTo(23, -12);
    ctx.lineTo(35, -9);
    ctx.lineTo(23, -5);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(18, -12, 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crisp Label Tag
    const tagText = `L${racer.laneNumber} · ${racer.displayLabel}`;
    ctx.font = '700 12px system-ui, sans-serif';
    const textW = ctx.measureText(tagText).width + 18;
    const tagX = Math.max(12, Math.min(width - textW - 12, duckX - textW / 2));
    const tagY = Math.max(poolTop + 4, laneMidY - 29 * scale);

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex
        ? '#FFCC33'
        : 'rgba(16, 41, 74, 0.9)';
    ctx.beginPath();
    ctx.roundRect(tagX, tagY, textW, 20, 6);
    ctx.fill();

    ctx.fillStyle =
      (raceState === 'FINISHING' || raceState === 'RESULT') && idx === winnerLaneIndex
        ? '#10294A'
        : '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.fillText(tagText, tagX + 9, tagY + 14);
  });

  // Countdown Banner
  if (raceState === 'COUNTDOWN' && countdownLabel) {
    ctx.fillStyle = 'rgba(16, 41, 74, 0.78)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 110, height / 2 - 48, 220, 96, 22);
    ctx.fill();
    ctx.strokeStyle = '#FFCC33';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#FFCC33';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(countdownLabel, width / 2, height / 2 + 16);
  }

  // Footer timer info
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${elapsedSec.toFixed(1)}s / ${durationSec}s`, width - 20, height - 14);
}

// ============================================================================
// MAIN COMPONENT: DUCK RACE 3D PREMIUM 2027
// ============================================================================
export const DuckRace3DGame: React.FC<DuckRace3DGameProps> = ({
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
  // Full roster fallback
  const fullRoster = useMemo(
    () => (allCandidates && allCandidates.length > 0 ? allCandidates : availableCandidates),
    [allCandidates, availableCandidates]
  );

  // Deduplicated eligible pool (guards duplicate IDs & absent students)
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

  // Game Controls & State
  const [raceState, setRaceState] = useState<DuckRace3DState>(
    eligibleStudents.length > 0 ? 'READY' : 'IDLE'
  );
  const [durationSec, setDurationSec] = useState<DuckRaceDurationSec>(10);
  const [cameraMode, setCameraMode] = useState<DuckRaceCameraMode>('OVERVIEW');
  const [heatMode, setHeatMode] = useState<DuckRaceHeatMode>('REPRESENTATIVE_FAIR');
  const [heatIndex, setHeatIndex] = useState<number>(0);
  const [qualityPreset, setQualityPreset] = useState<DuckRaceQualityPreset>('HIGH');
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);
  const [countdownLabel, setCountdownLabel] = useState<string>('');
  const [elapsedDisplaySec, setElapsedDisplaySec] = useState<number>(0);
  const [liveTop3, setLiveTop3] = useState<
    Array<{ laneNumber: number; displayLabel: string; progressPct: number; badgeHex: string }>
  >([]);

  // Result & Note/Bonus State
  const [activeWinnerEntry, setActiveWinnerEntry] = useState<DuckRacerEntry | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [bonusPoints, setBonusPoints] = useState<number>(0);
  const [resultNote, setResultNote] = useState<string>('');
  const [noteSaveFeedback, setNoteSaveFeedback] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'local_only' | 'error'>('idle');
  const [showRecordsDrawer, setShowRecordsDrawer] = useState<boolean>(false);
  const [rendererFallback2D, setRendererFallback2D] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => loadEduGameVoiceEnabled(true));

  // Local Turn Records (per teacher + class)
  const recordsStorageKey = `${LOCAL_RECORDS_PREFIX}_${teacherId}_${selectedSourceKey || 'default'}`;
  const [turnRecords, setTurnRecords] = useState<DuckRaceTurnRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      return raw ? (JSON.parse(raw) as DuckRaceTurnRecord[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(recordsStorageKey);
      setTurnRecords(raw ? (JSON.parse(raw) as DuckRaceTurnRecord[]) : []);
    } catch {
      setTurnRecords([]);
    }
  }, [recordsStorageKey]);

  const persistLocalRecords = useCallback(
    (next: DuckRaceTurnRecord[]) => {
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

  // Heat buckets for classes > 8
  const heatBuckets = useMemo(
    () => computeHeatBuckets(eligibleStudents, MAX_DUCK_LANES),
    [eligibleStudents]
  );
  const safeHeatIndex = useMemo(
    () => (heatBuckets.length === 0 ? 0 : Math.max(0, Math.min(heatIndex, heatBuckets.length - 1))),
    [heatBuckets.length, heatIndex]
  );

  // Preview Lineup when not actively racing
  const previewData = useMemo(
    () =>
      buildPreviewLineup({
        eligibleStudents,
        fullRoster,
        heatMode,
        heatIndex: safeHeatIndex,
      }),
    [eligibleStudents, fullRoster, heatMode, safeHeatIndex]
  );

  // Mutable Refs for deterministic animation loop (never cause re-render jitter)
  const stageMountRef = useRef<HTMLDivElement | null>(null);
  const fallbackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const soundEngineRef = useRef<EduGameSoundBank | null>(null);
  const voiceControllerRef = useRef<EduGameVoiceController | null>(null);
  const deduplicatorRef = useRef<DuckRaceTurnDeduplicator>(new DuckRaceTurnDeduplicator());

  const raceStateRef = useRef<DuckRace3DState>(raceState);
  const activeTurnIdRef = useRef<string | null>(null);
  const activePlanRef = useRef<DuckRaceTurnPlan | null>(null);
  const countdownStartPerfRef = useRef<number>(0);
  const countdownLastBeepRef = useRef<number>(0);
  const racePhaseStartPerfRef = useRef<number>(0);
  const raceAccumulatedMsRef = useRef<number>(0);
  const finishingStartPerfRef = useRef<number>(0);
  const lastHudUpdatePerfRef = useRef<number>(0);
  const framesScratchRef = useRef<DuckFrameState[]>([]);

  const cameraModeRef = useRef<DuckRaceCameraMode>(cameraMode);
  const isMutedRef = useRef<boolean>(isMuted);
  const speechEnabledRef = useRef<boolean>(speechEnabled);
  const qualityPresetRef = useRef<DuckRaceQualityPreset>(qualityPreset);
  const previewLineupRef = useRef<DuckRacerEntry[]>(previewData.lineup);
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    raceStateRef.current = raceState;
  }, [raceState]);
  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);
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
    previewLineupRef.current = previewData.lineup;
  }, [previewData.lineup]);

  // Three.js scene refs so we can rebuild duck lineup dynamically without tearing down the WebGLRenderer
  const threeRefs = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    duckGroupContainer: THREE.Group | null;
    duckRigs: DuckRig3D[];
    sharedDuckGeos: DuckSharedGeometries | null;
    trafficRedMat: THREE.MeshStandardMaterial | null;
    trafficAmberMat: THREE.MeshStandardMaterial | null;
    trafficGreenMat: THREE.MeshStandardMaterial | null;
    trophyGroup: THREE.Group | null;
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
    wakeInstanced: THREE.InstancedMesh | null;
    wakeSeeds: Float32Array;
    waterUniformTime: { value: number };
    camPos: THREE.Vector3;
    camTarget: THREE.Vector3;
    isSoftwareGl: boolean;
  }>({
    renderer: null,
    scene: null,
    camera: null,
    duckGroupContainer: null,
    duckRigs: [],
    sharedDuckGeos: null,
    trafficRedMat: null,
    trafficAmberMat: null,
    trafficGreenMat: null,
    trophyGroup: null,
    confettiInstanced: null,
    confettiStates: [],
    wakeInstanced: null,
    wakeSeeds: new Float32Array(0),
    waterUniformTime: { value: 0 },
    camPos: new THREE.Vector3(0, 12.2, 19.2),
    camTarget: new THREE.Vector3(0, 0.3, 0),
    isSoftwareGl: false,
  });

  // Helper to populate 3D duck meshes cleanly for any lineup (preview or active race plan)
  const rebuild3DDucksForLineup = useCallback(
    (lineup: DuckRacerEntry[], highlightedWinnerId: string | null) => {
      const { duckGroupContainer, duckRigs, sharedDuckGeos } = threeRefs.current;
      if (!duckGroupContainer || !sharedDuckGeos) return;

      // Cleanly dispose old duck rigs (geometries are shared, only dispose per-duck materials + CanvasTextures!)
      duckRigs.forEach((rig) => {
        rig.root.traverse((child) => {
          const mat = (child as { material?: THREE.Material | THREE.Material[] }).material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => disposeSingleMaterial(m));
          } else if (mat) {
            disposeSingleMaterial(mat);
          }
        });
        duckGroupContainer.remove(rig.root);
      });

      const nextRigs: DuckRig3D[] = lineup.map((racer) => {
        const rig = createCompositeDuckRig(
          racer,
          sharedDuckGeos,
          Boolean(highlightedWinnerId && racer.student.id === highlightedWinnerId)
        );
        duckGroupContainer.add(rig.root);
        return rig;
      });
      threeRefs.current.duckRigs = nextRigs;
    },
    []
  );

  // Sync lineup whenever pool changes in IDLE / READY
  useEffect(() => {
    if (
      raceStateRef.current === 'IDLE' ||
      raceStateRef.current === 'READY' ||
      raceStateRef.current === 'RESET'
    ) {
      const nextState: DuckRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      raceStateRef.current = nextState;
      setRaceState(nextState);
      rebuild3DDucksForLineup(previewData.lineup, null);
      setLiveTop3(
        previewData.lineup.slice(0, 3).map((r) => ({
          laneNumber: r.laneNumber,
          displayLabel: r.displayLabel,
          progressPct: 0,
          badgeHex: r.palette.badgeHex,
        }))
      );
    }
  }, [eligibleStudents.length, previewData.lineup, rebuild3DDucksForLineup]);

  // Hard reset when switching class / sourceKey
  const prevSourceKeyRef = useRef(selectedSourceKey);
  useEffect(() => {
    if (prevSourceKeyRef.current !== selectedSourceKey) {
      prevSourceKeyRef.current = selectedSourceKey;
      activeTurnIdRef.current = null;
      activePlanRef.current = null;
      raceAccumulatedMsRef.current = 0;
      soundEngineRef.current?.setActiveTurnToken(null);
      soundEngineRef.current?.stopAll();
      voiceControllerRef.current?.stop();
      setHeatIndex(0);
      setActiveWinnerEntry(null);
      setActiveTurnId(null);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('idle');
      setCountdownLabel('');
      setElapsedDisplaySec(0);
      const nextState: DuckRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
      raceStateRef.current = nextState;
      setRaceState(nextState);
      rebuild3DDucksForLineup(previewData.lineup, null);
    }
  }, [selectedSourceKey, eligibleStudents.length, previewData.lineup, rebuild3DDucksForLineup]);

  // Supabase cloud logging (Teacher authenticated only; Guest skips safely)
  const syncTurnToSupabase = useCallback(
    async (
      plan: DuckRaceTurnPlan,
      winnerEntry: DuckRacerEntry,
      points: number,
      noteText: string
    ): Promise<'saved' | 'local_only' | 'error'> => {
      if (
        !isSupabaseConfigured ||
        selectedSourceKey === 'guest_mode' ||
        selectedSourceKey.startsWith('demo-') ||
        teacherId.startsWith('demo_') ||
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
            : `Đại diện công bằng (1/${eligibleStudents.length || plan.racers.length})`;

        const detailsText = [
          `Trò chơi: A05 - Vịt Đua 3D Premium`,
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
          action: 'EDU_GAME_A05_DUCK_RACE_3D',
          target: `A05 (${resolvedClassName}) - ${winnerEntry.safeName}`,
          details: detailsText,
          actor_id: authUser.id,
          metadata: {
            game_id: 'A05',
            game_title: 'Vịt đua 3D',
            turn_id: plan.turnId,
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
        console.warn('A05 Supabase audit_logs warning:', err);
        return 'error';
      }
    },
    [eligibleStudents.length, resolvedClassName, selectedSourceKey, teacherId, teacherName, userRole]
  );

  // Commit Race Winner ONCE when finishing completes
  const commitRaceWinner = useCallback(
    (plan: DuckRaceTurnPlan) => {
      if (!isMountedRef.current) return;
      if (activeTurnIdRef.current !== plan.turnId) return;
      if (!deduplicatorRef.current.markCommitted(plan.turnId)) return;

      const winnerEntry = plan.racers[plan.winnerLaneIndex];
      if (!winnerEntry) return;

      // Update nameplate texture to bright gold champion badge
      rebuild3DDucksForLineup(plan.racers, winnerEntry.student.id);
      // Snap positions to final completed frames
      const endEval = evaluateDuckRaceFrame(plan, plan.durationMs);
      threeRefs.current.duckRigs.forEach((rig, idx) => {
        const f = endEval.frames[idx];
        if (f) {
          rig.root.position.set(f.x, 0.16, f.z);
        }
      });

      setActiveWinnerEntry(winnerEntry);
      setActiveTurnId(plan.turnId);
      setBonusPoints(0);
      setResultNote('');
      setNoteSaveFeedback(null);
      setCloudSyncStatus('saving');

      // Strict Vietnamese voice announcement (at most once per turnId, never falls back to English)
      void voiceControllerRef.current?.announceStudentOnce({
        turnId: plan.turnId,
        studentName: winnerEntry.safeName,
        customText: `Xin chúc mừng bạn ${winnerEntry.safeName} đã về nhất!`,
        isMuted: isMutedRef.current,
        voiceEnabled: speechEnabledRef.current,
        onBeforeSpeak: () => {
          soundEngineRef.current?.stopLoops();
        },
      });

      // Trigger EDUGameCenter existing call pipeline
      onPick(winnerEntry.student, {
        bonusPoints: 0,
        note: `Vịt Đua 3D (Làn #${winnerEntry.laneNumber} · ${plan.durationSec}s)`,
        sessionId: plan.turnId,
        studentNumber: winnerEntry.sttNumber,
      });

      const heatLabel =
        plan.heatMode === 'BRACKET_HEATS' && plan.totalHeats > 1
          ? `Bảng ${plan.heatIndex + 1}/${plan.totalHeats}`
          : `Toàn lớp (1/${eligibleStudents.length})`;

      const baseRecord: DuckRaceTurnRecord = {
        turnId: plan.turnId,
        turnIndex: turnRecords.length + 1,
        classId: selectedSourceKey,
        className: resolvedClassName,
        studentId: winnerEntry.student.id,
        studentName: winnerEntry.safeName,
        studentCode: winnerEntry.safeCode,
        sttNumber: winnerEntry.sttNumber,
        formattedStt: winnerEntry.formattedStt,
        durationSec: plan.durationSec,
        heatMode: plan.heatMode,
        heatLabel,
        bonusPoints: 0,
        note: '',
        selectedAt: new Date().toISOString(),
        cloudStatus: 'local_only',
      };

      persistLocalRecords([baseRecord, ...turnRecords]);

      syncTurnToSupabase(plan, winnerEntry, 0, '').then((status) => {
        if (!isMountedRef.current) return;
        setCloudSyncStatus(status);
        setTurnRecords((prev) => {
          const updated = prev.map((rec) =>
            rec.turnId === plan.turnId ? { ...rec, cloudStatus: status } : rec
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
      eligibleStudents.length,
      onPick,
      persistLocalRecords,
      rebuild3DDucksForLineup,
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

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });

      const gl = renderer.getContext();
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
      const isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa/i.test(rendererStr);

      threeRefs.current.isSoftwareGl = isSoftwareGl;
      threeRefs.current.renderer = renderer;

      const dprCap =
        isSoftwareGl || qualityPresetRef.current === 'LOW'
          ? 1
          : qualityPresetRef.current === 'MEDIUM'
          ? 1.5
          : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      renderer.setSize(initWidth, initHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = !isSoftwareGl && qualityPresetRef.current !== 'LOW';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = 'w-full h-full block outline-none select-none';
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      mountEl.innerHTML = '';
      mountEl.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#0B2444');
      scene.fog = new THREE.Fog('#0B2444', 36, 92);
      threeRefs.current.scene = scene;

      // Environment Lighting via RoomEnvironment
      pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      roomEnv.dispose();
      pmrem.dispose();
      pmrem = null;

      const camera = new THREE.PerspectiveCamera(44, initWidth / initHeight, 0.1, 150);
      camera.position.copy(threeRefs.current.camPos);
      camera.lookAt(threeRefs.current.camTarget);
      threeRefs.current.camera = camera;

      // Key Sun Light + Sky Hemisphere Light + Rim Fill
      const hemi = new THREE.HemisphereLight('#C6F1FF', '#10294A', 0.92);
      scene.add(hemi);

      const sunLight = new THREE.DirectionalLight('#FFF7E6', 2.05);
      sunLight.position.set(12, 22, 16);
      if (renderer.shadowMap.enabled) {
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.set(1024, 1024);
        sunLight.shadow.camera.left = -22;
        sunLight.shadow.camera.right = 22;
        sunLight.shadow.camera.top = 15;
        sunLight.shadow.camera.bottom = -15;
        sunLight.shadow.bias = -0.0005;
      }
      scene.add(sunLight);

      const rimLight = new THREE.DirectionalLight('#14C9E5', 0.65);
      rimLight.position.set(-14, 10, -14);
      scene.add(rimLight);

      // ------------------------------------------------------------------------
      // AQUATIC ARENA ARCHITECTURE
      // ------------------------------------------------------------------------
      // 1. Deep Pool Floor
      const floorGeo = new THREE.PlaneGeometry(38, 19);
      const floorMat = new THREE.MeshStandardMaterial({
        color: '#073B66',
        roughness: 0.78,
        metalness: 0.05,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = -0.95;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // 2. Animated Ocean Water Surface (custom wave displacement shader)
      const waterGeo = new THREE.PlaneGeometry(37.5, 18.4, isSoftwareGl ? 24 : 56, isSoftwareGl ? 14 : 28);
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: '#009FE3',
        emissive: '#05446B',
        emissiveIntensity: 0.25,
        roughness: 0.16,
        metalness: 0.08,
        transmission: 0.25,
        transparent: true,
        opacity: 0.86,
        clearcoat: 0.9,
        clearcoatRoughness: 0.14,
      });
      waterMat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = threeRefs.current.waterUniformTime;
        shader.vertexShader = `uniform float uTime;\n` + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float waveA = sin(position.x * 0.75 + uTime * 2.2) * 0.045;
          float waveB = cos(position.y * 1.15 - uTime * 1.7) * 0.032;
          transformed.z += waveA + waveB;`
        );
      };
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.rotation.x = -Math.PI / 2;
      waterMesh.position.y = 0;
      waterMesh.receiveShadow = true;
      scene.add(waterMesh);

      // 3. White & Navy Pool Coping Borders
      const deckWhiteMat = new THREE.MeshStandardMaterial({ color: '#F1F5F9', roughness: 0.45 });
      const deckNavyMat = new THREE.MeshStandardMaterial({ color: '#10294A', roughness: 0.4, metalness: 0.1 });
      const goldMat = new THREE.MeshStandardMaterial({
        color: '#FFCC33',
        roughness: 0.2,
        metalness: 0.85,
      });

      const northCoping = new THREE.Mesh(new THREE.BoxGeometry(40, 0.9, 1.4), deckWhiteMat);
      northCoping.position.set(0, 0.12, -9.8);
      northCoping.receiveShadow = true;
      scene.add(northCoping);

      const southCoping = new THREE.Mesh(new THREE.BoxGeometry(40, 0.9, 1.4), deckWhiteMat);
      southCoping.position.set(0, 0.12, 9.8);
      southCoping.receiveShadow = true;
      scene.add(southCoping);

      const westWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 21), deckNavyMat);
      westWall.position.set(-19.3, 0.12, 0);
      scene.add(westWall);

      const eastWall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 21), deckNavyMat);
      eastWall.position.set(19.3, 0.12, 0);
      scene.add(eastWall);

      // Stepped Mini Stadium Bleachers (North & South backdrops)
      for (let tier = 0; tier < 3; tier++) {
        const tierMat = tier % 2 === 0 ? deckNavyMat : new THREE.MeshStandardMaterial({ color: '#0284C7', roughness: 0.5 });
        const stepN = new THREE.Mesh(new THREE.BoxGeometry(40, 0.65, 1.3), tierMat);
        stepN.position.set(0, 0.65 + tier * 0.65, -11.3 - tier * 1.25);
        scene.add(stepN);

        const stepS = new THREE.Mesh(new THREE.BoxGeometry(40, 0.65, 1.3), tierMat);
        stepS.position.set(0, 0.65 + tier * 0.65, 11.3 + tier * 1.25);
        scene.add(stepS);
      }

      // 4. Instanced Lane Divider Buoys (9 divider ropes * 22 buoys = 198 instances)
      const buoyGeo = new THREE.CapsuleGeometry(0.08, 0.16, 4, 8);
      buoyGeo.rotateZ(Math.PI / 2);
      const buoyMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.05 });
      const totalBuoys = 9 * 22;
      const buoyInst = new THREE.InstancedMesh(buoyGeo, buoyMat, totalBuoys);
      const colWhite = new THREE.Color('#FFFFFF');
      const colOcean = new THREE.Color('#14C9E5');
      const colGold = new THREE.Color('#FFCC33');

      let bIdx = 0;
      for (let row = 0; row < 9; row++) {
        const zPos = (row - 4) * LANE_SPACING;
        for (let col = 0; col < 22; col++) {
          const xPos = TRACK_START_X - 1 + (col / 21) * (TRACK_LENGTH + 2);
          _tmpVecA.set(xPos, 0.04, zPos);
          _tmpQuat.identity();
          _tmpScale.set(1, 1, 1);
          _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
          buoyInst.setMatrixAt(bIdx, _tmpMatrix);
          if (col === 20) {
            buoyInst.setColorAt(bIdx, colGold);
          } else {
            buoyInst.setColorAt(bIdx, col % 2 === 0 ? colWhite : colOcean);
          }
          bIdx++;
        }
      }
      buoyInst.instanceMatrix.needsUpdate = true;
      if (buoyInst.instanceColor) buoyInst.instanceColor.needsUpdate = true;
      scene.add(buoyInst);

      // 5. Start Gate Arch + 3D Traffic Signal Lights
      const startArchGroup = new THREE.Group();
      startArchGroup.position.set(TRACK_START_X - 0.85, 0, 0);
      const pillarGeo = new THREE.BoxGeometry(0.55, 4.4, 0.55);
      const sPillarL = new THREE.Mesh(pillarGeo, deckNavyMat);
      sPillarL.position.set(0, 2.2, -8.5);
      startArchGroup.add(sPillarL);
      const sPillarR = new THREE.Mesh(pillarGeo, deckNavyMat);
      sPillarR.position.set(0, 2.2, 8.5);
      startArchGroup.add(sPillarR);
      const sBeam = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.65, 17.6), deckNavyMat);
      sBeam.position.set(0, 4.25, 0);
      startArchGroup.add(sBeam);

      // Start Banner
      const startTex = createBannerTexture(
        'XUẤT PHÁT · START',
        'SMART EDU DUCK RACE 3D',
        '#10294A',
        '#14C9E5',
        '#FFCC33'
      );
      const startSign = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 1.45),
        new THREE.MeshBasicMaterial({ map: startTex, side: THREE.DoubleSide })
      );
      startSign.position.set(0.35, 4.28, 0);
      startSign.rotation.y = Math.PI / 2;
      startArchGroup.add(startSign);

      // 3 Traffic Lights facing track
      const lightSphereGeo = new THREE.SphereGeometry(0.24, 16, 12);
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
      rLight.position.set(0.35, 3.25, -4.4);
      startArchGroup.add(rLight);
      const aLight = new THREE.Mesh(lightSphereGeo, trafficAmberMat);
      aLight.position.set(0.35, 3.25, -5.1);
      startArchGroup.add(aLight);
      const gLight = new THREE.Mesh(lightSphereGeo, trafficGreenMat);
      gLight.position.set(0.35, 3.25, -5.8);
      startArchGroup.add(gLight);
      scene.add(startArchGroup);

      // 6. Finish Arch + Floating Finish Line + 3D Golden Trophy
      const finishArchGroup = new THREE.Group();
      finishArchGroup.position.set(TRACK_FINISH_X, 0, 0);
      const fPillarL = new THREE.Mesh(pillarGeo, deckNavyMat);
      fPillarL.position.set(0, 2.35, -8.5);
      finishArchGroup.add(fPillarL);
      const fPillarR = new THREE.Mesh(pillarGeo, deckNavyMat);
      fPillarR.position.set(0, 2.35, 8.5);
      finishArchGroup.add(fPillarR);
      const fBeam = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 17.8), goldMat);
      fBeam.position.set(0, 4.45, 0);
      finishArchGroup.add(fBeam);

      const finishTex = createBannerTexture(
        'VỀ ĐÍCH · FINISH',
        'NHÀ VÔ ĐỊCH TÂY ĐÔ',
        '#10294A',
        '#FFCC33',
        '#FFCC33'
      );
      const finishSign = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 1.55),
        new THREE.MeshBasicMaterial({ map: finishTex, side: THREE.DoubleSide })
      );
      finishSign.position.set(-0.42, 4.5, 0);
      finishSign.rotation.y = -Math.PI / 2;
      finishArchGroup.add(finishSign);

      // Floating finish line bar
      const finishTape = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 16.8), goldMat);
      finishTape.position.set(0, 0.04, 0);
      finishArchGroup.add(finishTape);
      scene.add(finishArchGroup);

      // 3D Golden Trophy on Floating Podium beyond Finish
      const trophyGroup = new THREE.Group();
      trophyGroup.position.set(TRACK_FINISH_X + 2.2, 0.25, 0);
      const pedMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 0.55, 24), deckNavyMat);
      pedMesh.position.y = 0.2;
      trophyGroup.add(pedMesh);
      const cupBase = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 0.35, 20), goldMat);
      cupBase.position.y = 0.65;
      trophyGroup.add(cupBase);
      const cupStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.45, 16), goldMat);
      cupStem.position.y = 1.02;
      trophyGroup.add(cupStem);
      const cupBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.26, 0.72, 24), goldMat);
      cupBowl.position.y = 1.56;
      trophyGroup.add(cupBowl);
      const handleL = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 10, 18, Math.PI), goldMat);
      handleL.rotation.z = Math.PI / 2;
      handleL.position.set(0, 1.56, 0.46);
      trophyGroup.add(handleL);
      const handleR = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.055, 10, 18, Math.PI), goldMat);
      handleR.rotation.z = -Math.PI / 2;
      handleR.position.set(0, 1.56, -0.46);
      trophyGroup.add(handleR);
      scene.add(trophyGroup);
      threeRefs.current.trophyGroup = trophyGroup;

      // 7. Duck Container & Shared Geometries
      const duckContainer = new THREE.Group();
      scene.add(duckContainer);
      threeRefs.current.duckGroupContainer = duckContainer;
      threeRefs.current.sharedDuckGeos = createSharedDuckGeometries();

      // 8. Instanced Wake Splash Particles (96 droplets)
      const wakeGeo = new THREE.SphereGeometry(0.085, 8, 6);
      const wakeMat = new THREE.MeshBasicMaterial({
        color: '#E0F7FF',
        transparent: true,
        opacity: 0.78,
      });
      const wakeCount = 96;
      const wakeInstanced = new THREE.InstancedMesh(wakeGeo, wakeMat, wakeCount);
      wakeInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const wakeSeeds = new Float32Array(wakeCount);
      for (let i = 0; i < wakeCount; i++) {
        wakeSeeds[i] = (i * 0.6180339887) % 1;
        _tmpMatrix.makeScale(0, 0, 0);
        wakeInstanced.setMatrixAt(i, _tmpMatrix);
      }
      scene.add(wakeInstanced);
      threeRefs.current.wakeInstanced = wakeInstanced;
      threeRefs.current.wakeSeeds = wakeSeeds;

      // 9. Instanced Victory Confetti (120 ribbons)
      const confettiCount = 120;
      const confettiGeo = new THREE.BoxGeometry(0.18, 0.03, 0.12);
      const confettiMat = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 });
      const confettiInst = new THREE.InstancedMesh(confettiGeo, confettiMat, confettiCount);
      confettiInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const confColors = [
        new THREE.Color('#FFCC33'),
        new THREE.Color('#14C9E5'),
        new THREE.Color('#FFFFFF'),
        new THREE.Color('#FF7849'),
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
          x: TRACK_FINISH_X + (Math.random() - 0.5) * 6,
          y: -10,
          z: (Math.random() - 0.5) * 14,
          vy: 1.5 + Math.random() * 2.2,
          vx: (Math.random() - 0.5) * 1.4,
          vz: (Math.random() - 0.5) * 1.4,
          rotSpeed: 2 + Math.random() * 4,
        });
        confettiInst.setColorAt(i, confColors[i % confColors.length]);
        _tmpMatrix.makeScale(0, 0, 0);
        confettiInst.setMatrixAt(i, _tmpMatrix);
      }
      if (confettiInst.instanceColor) confettiInst.instanceColor.needsUpdate = true;
      scene.add(confettiInst);
      threeRefs.current.confettiInstanced = confettiInst;
      threeRefs.current.confettiStates = confettiStates;

      // Build Initial Duck Lineup
      rebuild3DDucksForLineup(previewLineupRef.current, null);

      // ResizeObserver for crisp layout & fullscreen transitions
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

      // ------------------------------------------------------------------------
      // MONOTONIC CLOCK ANIMATION TICK
      // ------------------------------------------------------------------------
      let prevPerf = performance.now();

      const afterDraw = (cb: FrameRequestCallback) => {
        if (threeRefs.current.isSoftwareGl) {
          setTimeout(() => {
            if (!disposed) animFrameId = requestAnimationFrame(cb);
          }, 0);
        } else {
          animFrameId = requestAnimationFrame(cb);
        }
      };

      const tick = (nowPerf: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (nowPerf - prevPerf) / 1000));
        prevPerf = nowPerf;
        const tSec = nowPerf * 0.001;

        threeRefs.current.waterUniformTime.value = tSec;
        const st = raceStateRef.current;
        const plan = activePlanRef.current;

        // Traffic Light Signal Emission Update
        if (
          threeRefs.current.trafficRedMat &&
          threeRefs.current.trafficAmberMat &&
          threeRefs.current.trafficGreenMat
        ) {
          let rEm = 0.25;
          let aEm = 0.25;
          let gEm = 0.25;
          if (st === 'COUNTDOWN') {
            const cdElapsed = nowPerf - countdownStartPerfRef.current;
            if (cdElapsed < 900) rEm = 3.2;
            else if (cdElapsed < 1800) aEm = 3.2;
            else if (cdElapsed < 2700) aEm = 3.2;
            else gEm = 3.6;
          } else if (st === 'RACING' || st === 'FINISHING') {
            gEm = 2.8;
          } else if (st === 'PAUSED') {
            aEm = 2.2;
          }
          threeRefs.current.trafficRedMat.emissiveIntensity = rEm;
          threeRefs.current.trafficAmberMat.emissiveIntensity = aEm;
          threeRefs.current.trafficGreenMat.emissiveIntensity = gEm;
        }

        // Countdown Logic
        if (st === 'COUNTDOWN' && plan && activeTurnIdRef.current === plan.turnId) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900) {
            if (countdownLastBeepRef.current !== 3) {
              countdownLastBeepRef.current = 3;
              setCountdownLabel('3');
              soundEngineRef.current?.playCountdownBeep(3, isMutedRef.current, plan.turnId);
            }
          } else if (cdMs < 1800) {
            if (countdownLastBeepRef.current !== 2) {
              countdownLastBeepRef.current = 2;
              setCountdownLabel('2');
              soundEngineRef.current?.playCountdownBeep(2, isMutedRef.current, plan.turnId);
            }
          } else if (cdMs < 2600) {
            if (countdownLastBeepRef.current !== 1) {
              countdownLastBeepRef.current = 1;
              setCountdownLabel('1');
              soundEngineRef.current?.playCountdownBeep(1, isMutedRef.current, plan.turnId);
            }
          } else if (cdMs < COUNTDOWN_TOTAL_MS) {
            if (countdownLastBeepRef.current !== 0) {
              countdownLastBeepRef.current = 0;
              setCountdownLabel('XUẤT PHÁT!');
              soundEngineRef.current?.playDuckStartSignal(isMutedRef.current, plan.turnId);
            }
          } else {
            // Transition cleanly to RACING
            countdownLastBeepRef.current = -1;
            setCountdownLabel('');
            raceAccumulatedMsRef.current = 0;
            racePhaseStartPerfRef.current = nowPerf;
            raceStateRef.current = 'RACING';
            setRaceState('RACING');
            soundEngineRef.current?.startWaterSwimLoop(isMutedRef.current, plan.turnId);
          }
        }

        // Evaluate Race Kinematics
        let evalRes: ReturnType<typeof evaluateDuckRaceFrame> | null = null;
        let currentRaceElapsedMs = raceAccumulatedMsRef.current;

        if (st === 'RACING' && plan && activeTurnIdRef.current === plan.turnId) {
          currentRaceElapsedMs =
            raceAccumulatedMsRef.current + (nowPerf - racePhaseStartPerfRef.current);
          evalRes = evaluateDuckRaceFrame(plan, currentRaceElapsedMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          if (evalRes.isRaceCompleted) {
            raceAccumulatedMsRef.current = plan.durationMs;
            finishingStartPerfRef.current = nowPerf;
            raceStateRef.current = 'FINISHING';
            setRaceState('FINISHING');
            soundEngineRef.current?.playDuckFinishFanfare(isMutedRef.current, plan.turnId);
          }
        } else if (st === 'PAUSED' && plan) {
          evalRes = evaluateDuckRaceFrame(
            plan,
            raceAccumulatedMsRef.current,
            framesScratchRef.current
          );
          framesScratchRef.current = evalRes.frames;
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          evalRes = evaluateDuckRaceFrame(plan, plan.durationMs, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;

          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            raceStateRef.current = 'RESULT';
            setRaceState('RESULT');
            commitRaceWinnerRef.current(plan);
          }
        }

        // Throttled React HUD Updates (~12 Hz so WebGL stays butter smooth)
        if (nowPerf - lastHudUpdatePerfRef.current > 85) {
          lastHudUpdatePerfRef.current = nowPerf;
          if (evalRes && plan) {
            setElapsedDisplaySec(Math.min(plan.durationSec, currentRaceElapsedMs / 1000));
            const sorted = evalRes.frames
              .map((f, idx) => ({
                laneNumber: plan.racers[idx].laneNumber,
                displayLabel: plan.racers[idx].displayLabel,
                progressPct: Math.round(f.progress * 100),
                badgeHex: plan.racers[idx].palette.badgeHex,
              }))
              .sort((a, b) => b.progressPct - a.progressPct)
              .slice(0, 3);
            setLiveTop3(sorted);
          }
        }

        // Update 3D Duck Meshes
        const rigs = threeRefs.current.duckRigs;
        for (let i = 0; i < rigs.length; i++) {
          const rig = rigs[i];
          const f = evalRes && evalRes.frames[i] ? evalRes.frames[i] : null;
          const xPos = f ? f.x : TRACK_START_X;
          const zPos = f ? f.z : rig.racer.laneZ;
          const speed = st === 'RACING' && f ? Math.max(0.6, f.speedNorm) : 0.2;

          const waveY =
            Math.sin(xPos * 0.75 + tSec * 2.2) * 0.045 +
            Math.cos(zPos * 1.15 - tSec * 1.7) * 0.03;
          const bobOffset = Math.sin(tSec * (st === 'RACING' ? 7.5 : 3.0) + rig.racer.bobPhaseOffset) * 0.035;

          const isChampionCelebration =
            (st === 'FINISHING' || st === 'RESULT') && plan && i === plan.winnerLaneIndex;

          const jumpY = isChampionCelebration ? Math.abs(Math.sin(tSec * 5.2)) * 0.28 : 0;

          rig.root.position.set(xPos, 0.16 + waveY + bobOffset + jumpY, zPos);

          // Subtle pitch / roll while swimming
          rig.hull.rotation.z =
            (st === 'RACING' ? -0.06 * speed : 0) + Math.sin(tSec * 4.5 + i) * 0.04;
          rig.hull.rotation.x = Math.cos(tSec * 3.8 + rig.racer.bobPhaseOffset) * 0.05;

          // Articulated wing flapping
          const flapAmp = st === 'RACING' ? 0.42 : isChampionCelebration ? 0.58 : 0.08;
          const flapSpeed = st === 'RACING' ? 14 : isChampionCelebration ? 15 : 3;
          const flap = Math.sin(tSec * flapSpeed + rig.racer.wingPhaseOffset) * flapAmp;
          rig.wingLeft.rotation.x = 0.22 + flap;
          rig.wingRight.rotation.x = -0.22 - flap;

          // Webbed feet paddling
          const pad = Math.sin(tSec * (st === 'RACING' ? 16 : 3.2) + i);
          rig.footLeft.rotation.z = pad * 0.45;
          rig.footRight.rotation.z = -pad * 0.45;

          // Winner Halo Pulse
          const haloMat = rig.haloRing.material as THREE.MeshBasicMaterial;
          if (isChampionCelebration) {
            haloMat.color.set('#FFCC33');
            haloMat.opacity = 0.75 + Math.sin(tSec * 6) * 0.22;
            const hs = 1.2 + Math.sin(tSec * 5) * 0.12;
            rig.haloRing.scale.set(hs, hs, 1);
          } else if (f?.isLeading && st === 'RACING') {
            haloMat.color.set('#FFCC33');
            haloMat.opacity = 0.65;
            rig.haloRing.scale.set(1.06, 1.06, 1);
          } else {
            haloMat.color.set('#14C9E5');
            haloMat.opacity = 0.28;
            rig.haloRing.scale.set(1, 1, 1);
          }
        }

        // Update Trophy Rotation
        if (threeRefs.current.trophyGroup) {
          threeRefs.current.trophyGroup.rotation.y = tSec * 0.75;
          threeRefs.current.trophyGroup.position.y = 0.25 + Math.sin(tSec * 2.1) * 0.08;
        }

        // Update Instanced Water Wake Droplets behind active ducks
        if (threeRefs.current.wakeInstanced && rigs.length > 0) {
          const wakeInst = threeRefs.current.wakeInstanced;
          const seeds = threeRefs.current.wakeSeeds;
          const activeWake = st === 'RACING' || st === 'FINISHING';
          for (let i = 0; i < wakeInst.count; i++) {
            if (!activeWake) {
              _tmpMatrix.makeScale(0, 0, 0);
              wakeInst.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            const rig = rigs[i % rigs.length];
            const phase = (tSec * 1.85 + seeds[i]) % 1;
            const wx = rig.root.position.x - 0.55 - phase * 1.9;
            const wz = rig.root.position.z + (seeds[(i + 17) % wakeInst.count] - 0.5) * 0.45;
            const wy = 0.06 + Math.sin(phase * Math.PI) * 0.18;
            const sc = (1 - phase) * 1.15;
            _tmpVecA.set(wx, wy, wz);
            _tmpQuat.identity();
            _tmpScale.set(sc, sc, sc);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            wakeInst.setMatrixAt(i, _tmpMatrix);
          }
          wakeInst.instanceMatrix.needsUpdate = true;
        }

        // Update Victory Confetti
        if (threeRefs.current.confettiInstanced) {
          const conf = threeRefs.current.confettiInstanced;
          const cStates = threeRefs.current.confettiStates;
          const showConfetti = st === 'FINISHING' || st === 'RESULT';
          for (let i = 0; i < cStates.length; i++) {
            const c = cStates[i];
            if (!showConfetti) {
              _tmpMatrix.makeScale(0, 0, 0);
              conf.setMatrixAt(i, _tmpMatrix);
              continue;
            }
            if (c.y < -1) {
              c.y = 4.2 + Math.random() * 3.4;
              c.x = TRACK_FINISH_X + (Math.random() - 0.5) * 7.2;
              c.z = (Math.random() - 0.5) * 13.5;
            }
            c.y -= c.vy * dt * 1.25;
            c.x += Math.sin(tSec * 2 + i) * 0.6 * dt;
            _tmpVecA.set(c.x, c.y, c.z);
            _tmpEuler.set(tSec * c.rotSpeed, tSec * (c.rotSpeed * 0.7), i);
            _tmpQuat.setFromEuler(_tmpEuler);
            _tmpScale.set(1, 1, 1);
            _tmpMatrix.compose(_tmpVecA, _tmpQuat, _tmpScale);
            conf.setMatrixAt(i, _tmpMatrix);
          }
          conf.instanceMatrix.needsUpdate = true;
        }

        // Smooth Damped 3-Angle Camera
        if (threeRefs.current.camera) {
          let desiredMode = cameraModeRef.current;
          // Auto-showcase finish close-up during victory if following pack
          if ((st === 'FINISHING' || st === 'RESULT') && desiredMode === 'FOLLOW_PACK') {
            desiredMode = 'FINISH_CLOSEUP';
          }

          let tx = 0;
          let ty = 12.2;
          let tz = 19.2;
          let lx = 0;
          let ly = 0.35;
          let lz = 0;

          if (desiredMode === 'FOLLOW_PACK') {
            const packX = evalRes ? evalRes.packCenterX : TRACK_START_X + 2;
            const leadX =
              evalRes && evalRes.frames[evalRes.leaderLaneIndex]
                ? evalRes.frames[evalRes.leaderLaneIndex].x
                : packX;
            const focusX = packX * 0.55 + leadX * 0.45;
            tx = Math.min(TRACK_FINISH_X - 2, focusX - 6.8);
            ty = 6.4;
            tz = 12.2;
            lx = Math.min(TRACK_FINISH_X + 1.5, focusX + 3.4);
            ly = 0.55;
            lz = 0;
          } else if (desiredMode === 'FINISH_CLOSEUP') {
            const winZ =
              plan && plan.racers[plan.winnerLaneIndex]
                ? plan.racers[plan.winnerLaneIndex].laneZ * 0.45
                : 0;
            tx = TRACK_FINISH_X - 5.2;
            ty = 4.6;
            tz = 9.4;
            lx = TRACK_FINISH_X + 0.8;
            ly = 0.85;
            lz = winZ;
          }

          const camLambda = 4.2;
          threeRefs.current.camPos.x = THREE.MathUtils.damp(threeRefs.current.camPos.x, tx, camLambda, dt);
          threeRefs.current.camPos.y = THREE.MathUtils.damp(threeRefs.current.camPos.y, ty, camLambda, dt);
          threeRefs.current.camPos.z = THREE.MathUtils.damp(threeRefs.current.camPos.z, tz, camLambda, dt);

          threeRefs.current.camTarget.x = THREE.MathUtils.damp(threeRefs.current.camTarget.x, lx, camLambda, dt);
          threeRefs.current.camTarget.y = THREE.MathUtils.damp(threeRefs.current.camTarget.y, ly, camLambda, dt);
          threeRefs.current.camTarget.z = THREE.MathUtils.damp(threeRefs.current.camTarget.z, lz, camLambda, dt);

          threeRefs.current.camera.position.copy(threeRefs.current.camPos);
          threeRefs.current.camera.lookAt(threeRefs.current.camTarget);
        }

        // Render WebGL Scene
        if (renderer && scene && threeRefs.current.camera) {
          renderer.render(scene, threeRefs.current.camera);
        }

        afterDraw(tick);
      };

      animFrameId = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('A05 WebGL initialization unavailable, activating 2D Aquatic Track fallback:', err);
      setRendererFallback2D(true);
    }

    return () => {
      disposed = true;
      isMountedRef.current = false;
      activeTurnIdRef.current = null;
      cancelAnimationFrame(animFrameId);
      if (resizeObserver) resizeObserver.disconnect();
      soundEngineRef.current?.dispose();
      soundEngineRef.current = null;
      voiceControllerRef.current?.dispose();
      voiceControllerRef.current = null;

      if (threeRefs.current.sharedDuckGeos) {
        Object.values(threeRefs.current.sharedDuckGeos).forEach((g) => g.dispose());
        threeRefs.current.sharedDuckGeos = null;
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
      threeRefs.current.duckRigs = [];
    };
  }, [rebuild3DDucksForLineup]);

  // Apply dynamic quality preset changes to live WebGLRenderer
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

  // Pure 2D Fallback Animation Loop if WebGL init failed completely (no renderer)
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

        if (st === 'COUNTDOWN' && plan) {
          const cdMs = nowPerf - countdownStartPerfRef.current;
          if (cdMs < 900 && countdownLastBeepRef.current !== 3) {
            countdownLastBeepRef.current = 3;
            setCountdownLabel('3');
            soundEngineRef.current?.playCountdownBeep(3, isMutedRef.current, plan.turnId);
          } else if (cdMs >= 900 && cdMs < 1800 && countdownLastBeepRef.current !== 2) {
            countdownLastBeepRef.current = 2;
            setCountdownLabel('2');
            soundEngineRef.current?.playCountdownBeep(2, isMutedRef.current, plan.turnId);
          } else if (cdMs >= 1800 && cdMs < 2600 && countdownLastBeepRef.current !== 1) {
            countdownLastBeepRef.current = 1;
            setCountdownLabel('1');
            soundEngineRef.current?.playCountdownBeep(1, isMutedRef.current, plan.turnId);
          } else if (cdMs >= 2600 && cdMs < COUNTDOWN_TOTAL_MS && countdownLastBeepRef.current !== 0) {
            countdownLastBeepRef.current = 0;
            setCountdownLabel('XUẤT PHÁT!');
            soundEngineRef.current?.playDuckStartSignal(isMutedRef.current, plan.turnId);
          } else if (cdMs >= COUNTDOWN_TOTAL_MS) {
            countdownLastBeepRef.current = -1;
            setCountdownLabel('');
            raceAccumulatedMsRef.current = 0;
            racePhaseStartPerfRef.current = nowPerf;
            raceStateRef.current = 'RACING';
            setRaceState('RACING');
            soundEngineRef.current?.startWaterSwimLoop(isMutedRef.current, plan.turnId);
          }
        }

        let elapsed = raceAccumulatedMsRef.current;
        let evalRes: ReturnType<typeof evaluateDuckRaceFrame> | null = null;
        if (st === 'RACING' && plan) {
          elapsed = raceAccumulatedMsRef.current + (nowPerf - racePhaseStartPerfRef.current);
          evalRes = evaluateDuckRaceFrame(plan, elapsed, framesScratchRef.current);
          framesScratchRef.current = evalRes.frames;
          setElapsedDisplaySec(Math.min(plan.durationSec, elapsed / 1000));
          if (evalRes.isRaceCompleted) {
            raceAccumulatedMsRef.current = plan.durationMs;
            finishingStartPerfRef.current = nowPerf;
            raceStateRef.current = 'FINISHING';
            setRaceState('FINISHING');
            soundEngineRef.current?.playDuckFinishFanfare(isMutedRef.current, plan.turnId);
          }
        } else if (st === 'PAUSED' && plan) {
          evalRes = evaluateDuckRaceFrame(plan, raceAccumulatedMsRef.current, framesScratchRef.current);
        } else if ((st === 'FINISHING' || st === 'RESULT') && plan) {
          evalRes = evaluateDuckRaceFrame(plan, plan.durationMs, framesScratchRef.current);
          if (st === 'FINISHING' && nowPerf - finishingStartPerfRef.current >= FINISHING_SLOWMO_MS) {
            raceStateRef.current = 'RESULT';
            setRaceState('RESULT');
            commitRaceWinnerRef.current(plan);
          }
        }

        if (ctx) {
          draw2DFallbackAquaticTrack(
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
            plan ? plan.durationSec : durationSec,
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
  }, [durationSec, rendererFallback2D]);

  // ============================================================================
  // RACE CONTROLS (Start, Pause, Resume, Reset, Note/Bonus Save)
  // ============================================================================
  const startNewRace = useCallback(() => {
    if (eligibleStudents.length === 0) return;
    const st = raceStateRef.current;
    if (st === 'COUNTDOWN' || st === 'RACING' || st === 'FINISHING' || st === 'PAUSED') return;

    // Unlock Web Audio synchronously inside user gesture & clear any leftover sound/voice
    soundEngineRef.current?.unlock();
    soundEngineRef.current?.stopAll();
    voiceControllerRef.current?.stop();

    const plan = createFairDuckRaceTurnPlan({
      eligibleStudents,
      fullRoster,
      durationSec,
      heatMode,
      heatIndex: safeHeatIndex,
    });

    soundEngineRef.current?.setActiveTurnToken(plan.turnId);
    activeTurnIdRef.current = plan.turnId;
    activePlanRef.current = plan;
    framesScratchRef.current = [];
    raceAccumulatedMsRef.current = 0;
    countdownLastBeepRef.current = -1;
    countdownStartPerfRef.current = performance.now();

    setActiveWinnerEntry(null);
    setActiveTurnId(null);
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
        badgeHex: r.palette.badgeHex,
      }))
    );

    rebuild3DDucksForLineup(plan.racers, null);

    raceStateRef.current = 'COUNTDOWN';
    setRaceState('COUNTDOWN');
  }, [durationSec, eligibleStudents, fullRoster, heatMode, rebuild3DDucksForLineup, safeHeatIndex]);

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
    soundEngineRef.current?.startWaterSwimLoop(
      isMutedRef.current,
      activeTurnIdRef.current ?? undefined
    );
  }, []);

  const resetRace = useCallback(() => {
    soundEngineRef.current?.setActiveTurnToken(null);
    soundEngineRef.current?.stopAll();
    voiceControllerRef.current?.stop();
    activeTurnIdRef.current = null;
    activePlanRef.current = null;
    raceAccumulatedMsRef.current = 0;
    countdownLastBeepRef.current = -1;
    setCountdownLabel('');
    setElapsedDisplaySec(0);
    setActiveWinnerEntry(null);
    setActiveTurnId(null);
    setNoteSaveFeedback(null);
    setCloudSyncStatus('idle');
    rebuild3DDucksForLineup(previewData.lineup, null);
    const nextState: DuckRace3DState = eligibleStudents.length > 0 ? 'READY' : 'IDLE';
    raceStateRef.current = nextState;
    setRaceState(nextState);
  }, [eligibleStudents.length, previewData.lineup, rebuild3DDucksForLineup]);

  const handleSaveBonusAndNote = useCallback(async () => {
    if (!activeWinnerEntry || !activeTurnId || !activePlanRef.current) return;
    const parts = [
      bonusPoints > 0 ? `+${bonusPoints}đ` : '',
      resultNote.trim(),
    ].filter(Boolean);
    const combinedNote = parts.length > 0 ? parts.join(' - ') : 'Hoàn thành lượt đua Vịt 3D';

    onUpdateLatestNote?.(combinedNote);

    const updated = turnRecords.map((rec) =>
      rec.turnId === activeTurnId
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
    setCloudSyncStatus(status);
    setNoteSaveFeedback('Đã lưu điểm thưởng & ghi chú!');
    setTimeout(() => {
      if (isMountedRef.current) setNoteSaveFeedback(null);
    }, 2600);
  }, [
    activeTurnId,
    activeWinnerEntry,
    bonusPoints,
    onUpdateLatestNote,
    persistLocalRecords,
    resultNote,
    syncTurnToSupabase,
    turnRecords,
  ]);

  // Keyboard shortcuts for Classroom Projector Efficiency
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
        setCameraMode('OVERVIEW');
      } else if (e.key === '2') {
        setCameraMode('FOLLOW_PACK');
      } else if (e.key === '3') {
        setCameraMode('FINISH_CLOSEUP');
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
          : 'rounded-3xl border-2 border-[#009FE3]/40 shadow-2xl min-h-[640px]'
      }`}
    >
      {/* ====================================================================
          TOP COMPACT TEACHER & PROJECTOR CONTROL HEADER
         ==================================================================== */}
      <div className="bg-[#10294A] border-b border-[#14C9E5]/25 px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left: Title + Class Selector + Roster Counters */}
        <div className="flex flex-wrap items-center gap-2">
          {onCloseGame && (
            <button
              type="button"
              onClick={onCloseGame}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1 transition-colors cursor-pointer"
              title="Trở về thư viện trò chơi"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Thư viện</span>
            </button>
          )}

          <div className="flex items-center gap-2 bg-[#071830] border border-[#009FE3]/40 rounded-xl px-2.5 py-1">
            <span className="px-1.5 py-0.5 bg-[#FFCC33] text-[#10294A] rounded text-[11px] font-black tracking-wide">
              A05
            </span>
            <h2 className="text-xs sm:text-sm font-black tracking-tight text-white">
              VỊT ĐUA 3D PREMIUM
            </h2>
          </div>

          {classes.length > 0 && onSelectSourceKey ? (
            <select
              value={selectedSourceKey}
              onChange={(e) => onSelectSourceKey(e.target.value)}
              disabled={isBusyRacing}
              className="bg-[#071830] border border-[#14C9E5]/40 text-white text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none cursor-pointer disabled:opacity-50"
              aria-label="Chọn lớp học"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id} className="bg-[#10294A] text-white">
                  Lớp {cls.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2.5 py-1 bg-[#071830] border border-[#14C9E5]/30 rounded-xl text-xs font-bold text-[#14C9E5]">
              {resolvedClassName}
            </span>
          )}

          {/* Compact Roster Stats */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className="px-2 py-1 rounded-lg bg-[#009FE3]/20 border border-[#009FE3]/40 text-cyan-100 tabular-nums">
              Sẵn sàng: <strong className="text-[#FFCC33]">{eligibleStudents.length}</strong>/{presentTotal}
            </span>
            {absentCount > 0 && (
              <span className="px-2 py-1 rounded-lg bg-rose-500/20 border border-rose-400/40 text-rose-200 tabular-nums">
                Vắng: {absentCount}
              </span>
            )}
            <span className="hidden md:inline-block px-2 py-1 rounded-lg bg-white/10 text-slate-200 tabular-nums">
              Đã gọi: {calledCount}
            </span>
          </div>
        </div>

        {/* Right: Race Config + Classroom Utility Actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Anti-duplicate toggle */}
          {onToggleAntiDuplicate && (
            <button
              type="button"
              onClick={onToggleAntiDuplicate}
              disabled={isBusyRacing}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer disabled:opacity-50 ${
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

          {/* Duration Selector 5s / 10s / 15s */}
          <div className="flex items-center bg-[#071830] border border-white/15 rounded-xl p-0.5">
            {([5, 10, 15] as DuckRaceDurationSec[]).map((sec) => (
              <button
                key={sec}
                type="button"
                disabled={isBusyRacing}
                onClick={() => setDurationSec(sec)}
                className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer disabled:opacity-50 ${
                  durationSec === sec
                    ? 'bg-[#FFCC33] text-[#10294A]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {sec}s
              </button>
            ))}
          </div>

          {/* Quality Toggle */}
          <button
            type="button"
            onClick={() =>
              setQualityPreset((q) => (q === 'HIGH' ? 'MEDIUM' : q === 'MEDIUM' ? 'LOW' : 'HIGH'))
            }
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-slate-100 cursor-pointer"
            title="Chất lượng đồ họa 3D"
          >
            <Sliders className="w-3.5 h-3.5 text-[#14C9E5]" />
            <span>{qualityPreset === 'HIGH' ? '3D Cao' : qualityPreset === 'MEDIUM' ? '3D Vừa' : '3D Nhẹ'}</span>
          </button>

          {/* Absent & History */}
          {onOpenAbsentModal && (
            <button
              type="button"
              onClick={onOpenAbsentModal}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer"
              title="Điểm danh / Học sinh vắng"
            >
              <Users className="w-3.5 h-3.5 text-[#14C9E5]" />
              <span className="hidden lg:inline">Vắng / DS</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRecordsDrawer((v) => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
              showRecordsDrawer
                ? 'bg-[#FFCC33] text-[#10294A]'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Bảng xếp hạng & Lịch sử các lượt đua"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lịch sử ({turnRecords.length})</span>
          </button>

          {onOpenHistoryModal && (
            <button
              type="button"
              onClick={onOpenHistoryModal}
              className="px-2 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-cyan-200 cursor-pointer"
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
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-rose-500/30 text-[11px] font-bold text-white flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Làm mới chu kỳ gọi cả lớp"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FFCC33]" />
              <span className="hidden xl:inline">Làm mới chu kỳ</span>
            </button>
          )}

          {/* Audio & Speech */}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              title={isMuted ? 'Bật âm thanh (M)' : 'Tắt âm thanh (M)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-300" /> : <Volume2 className="w-4 h-4 text-[#14C9E5]" />}
            </button>
          )}

          {/* 16:9 Presentation / Fullscreen */}
          <button
            type="button"
            onClick={() => {
              if (onToggleFullscreen) onToggleFullscreen();
              else setIsPresentationMode((v) => !v);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-[#009FE3] hover:bg-[#14C9E5] text-white text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
            title="Chế độ trình chiếu máy chiếu (F)"
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
          SECONDARY BAR: HEAT MODE (>8 HS) & 3 CAMERA PRESETS
         ==================================================================== */}
      <div className="bg-[#0B203D] border-b border-white/10 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        {/* Camera Angle Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mr-1">
            <Camera className="w-3.5 h-3.5 text-[#14C9E5]" />
            Góc máy:
          </span>
          {(
            [
              { key: 'OVERVIEW', label: '1 · Toàn cảnh' },
              { key: 'FOLLOW_PACK', label: '2 · Theo đoàn' },
              { key: 'FINISH_CLOSEUP', label: '3 · Về đích' },
            ] as Array<{ key: DuckRaceCameraMode; label: string }>
          ).map((cam) => (
            <button
              key={cam.key}
              type="button"
              onClick={() => setCameraMode(cam.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                cameraMode === cam.key
                  ? 'bg-[#009FE3] text-white shadow-xs'
                  : 'bg-white/10 text-slate-200 hover:bg-white/20'
              }`}
            >
              {cam.label}
            </button>
          ))}
        </div>

        {/* Heat Mode for Large Classes (>8 students) */}
        <div className="flex flex-wrap items-center gap-2">
          {eligibleStudents.length > MAX_DUCK_LANES ? (
            <>
              <div className="flex items-center bg-[#071830] rounded-lg p-0.5 border border-white/10">
                <button
                  type="button"
                  disabled={isBusyRacing}
                  onClick={() => setHeatMode('REPRESENTATIVE_FAIR')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                    heatMode === 'REPRESENTATIVE_FAIR'
                      ? 'bg-[#14C9E5] text-[#10294A]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Chọn công bằng 1/N từ toàn bộ sĩ số sẵn sàng, lên 8 làn đại diện rõ nét"
                >
                  Công bằng toàn lớp (1/{eligibleStudents.length})
                </button>
                <button
                  type="button"
                  disabled={isBusyRacing}
                  onClick={() => setHeatMode('BRACKET_HEATS')}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer disabled:opacity-50 ${
                    heatMode === 'BRACKET_HEATS'
                      ? 'bg-[#14C9E5] text-[#10294A]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Chia thành các bảng đấu lần lượt, mỗi bảng tối đa 8 làn"
                >
                  Chia bảng ({heatBuckets.length} bảng)
                </button>
              </div>

              {heatMode === 'BRACKET_HEATS' && heatBuckets.length > 1 && (
                <div className="flex items-center gap-1 bg-[#071830] border border-white/15 rounded-lg px-1.5 py-0.5">
                  <button
                    type="button"
                    disabled={isBusyRacing || safeHeatIndex === 0}
                    onClick={() => setHeatIndex((i) => Math.max(0, i - 1))}
                    className="p-0.5 hover:bg-white/15 rounded disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-extrabold text-[#FFCC33] px-1 tabular-nums">
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
            <span className="text-[11px] font-bold text-[#14C9E5]">
              Đang hiển thị đủ {eligibleStudents.length} làn đua trên hồ 3D
            </span>
          )}

          <button
            type="button"
            onClick={() => setSpeechEnabled((v) => !v)}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
              speechEnabled
                ? 'bg-[#FFCC33]/20 border-[#FFCC33]/50 text-[#FFCC33]'
                : 'bg-white/5 border-white/10 text-slate-300'
            }`}
            title="Đọc tên học sinh thắng bằng giọng nói trình duyệt"
          >
            {speechEnabled ? 'Đọc tên: BẬT' : 'Đọc tên: TẮT'}
          </button>
        </div>
      </div>

      {/* ====================================================================
          MAIN 16:9 3D AQUATIC STAGE + HUD OVERLAYS (No backdrop-blur over WebGL)
         ==================================================================== */}
      <div className="relative flex-1 min-h-[450px] lg:min-h-[520px] w-full bg-[#0B2444] overflow-hidden">
        {/* WebGL Mount Point */}
        <div
          ref={stageMountRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'hidden' : 'block'}`}
        />

        {/* Automatic 2D Canvas Fallback if WebGL unavailable/lost */}
        <canvas
          ref={fallbackCanvasRef}
          className={`absolute inset-0 w-full h-full ${rendererFallback2D ? 'block' : 'hidden'}`}
        />

        {/* Top-Left Live Race Telemetry HUD */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-2 pointer-events-none max-w-[300px]">
          <div className="bg-[#10294A]/92 border border-[#14C9E5]/45 rounded-2xl px-3.5 py-2 shadow-lg flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FFCC33]" />
              <span className="text-sm sm:text-base font-black tabular-nums text-white">
                {elapsedDisplaySec.toFixed(1)}s
              </span>
              <span className="text-xs font-bold text-slate-300">/ {durationSec}s</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                raceState === 'RACING'
                  ? 'bg-emerald-500 text-white'
                  : raceState === 'COUNTDOWN'
                  ? 'bg-[#FFCC33] text-[#10294A]'
                  : raceState === 'PAUSED'
                  ? 'bg-amber-500 text-[#10294A]'
                  : raceState === 'FINISHING' || raceState === 'RESULT'
                  ? 'bg-[#009FE3] text-white'
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
                ? 'CÁN ĐÍCH!'
                : 'HOÀN TẤT'}
            </span>
          </div>

          {/* Live Top 3 Leaderboard during Racing */}
          {liveTop3.length > 0 && (raceState === 'RACING' || raceState === 'PAUSED' || raceState === 'FINISHING') && (
            <div className="bg-[#10294A]/90 border border-white/15 rounded-2xl px-3 py-2 shadow-lg space-y-1">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#14C9E5]">
                Dẫn đầu đường đua
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
                  <span className="font-black text-[#FFCC33] tabular-nums shrink-0">
                    {item.progressPct}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Center Countdown Banner (3 - 2 - 1 - XUẤT PHÁT!) */}
        {raceState === 'COUNTDOWN' && countdownLabel && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#10294A]/92 border-4 border-[#FFCC33] rounded-3xl px-10 py-6 shadow-2xl text-center animate-bounce">
              <div className="text-xs font-extrabold uppercase tracking-widest text-[#14C9E5] mb-1">
                CHUẨN BỊ XUẤT PHÁT
              </div>
              <div className="text-5xl sm:text-6xl font-black text-[#FFCC33] tracking-tight">
                {countdownLabel}
              </div>
            </div>
          </div>
        )}

        {/* Empty Eligible Pool Guard Banner */}
        {eligibleStudents.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#081933]/80">
            <div className="bg-[#10294A] border-2 border-[#FFCC33] rounded-3xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFCC33]/20 border border-[#FFCC33]/50 flex items-center justify-center">
                <UserCheck className="w-7 h-7 text-[#FFCC33]" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-white">
                  {presentTotal === 0
                    ? 'Chưa có học sinh tham gia đường đua'
                    : 'Đã gọi hết 100% học sinh có mặt!'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {presentTotal === 0
                    ? 'Vui lòng kiểm tra danh sách lớp hoặc bỏ đánh dấu vắng để đưa học sinh vào làn đua.'
                    : 'Cơ chế chống trùng đang BẬT để đảm bảo công bằng. Thầy/cô bấm Làm mới chu kỳ để bắt đầu vòng gọi tên mới.'}
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
                    className="px-5 py-2.5 rounded-xl bg-[#FFCC33] hover:bg-amber-300 text-[#10294A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-lg"
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

        {/* ==================================================================
            NON-OCCLUDING CHAMPION RESULT PANEL (Docked Top-Right Corner)
            Keeps the 3D winning duck + finish podium unobstructed!
           ================================================================== */}
        {raceState === 'RESULT' && activeWinnerEntry && (
          <div className="absolute top-3 right-3 z-20 w-[calc(100%-24px)] sm:w-[375px] bg-[#10294A]/95 border-2 border-[#FFCC33] rounded-3xl p-4 shadow-2xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FFCC33] text-[#10294A] flex items-center justify-center shrink-0 shadow-md">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-[#FFCC33]">
                    NHÀ VÔ ĐỊCH · LÀN #{activeWinnerEntry.laneNumber}
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
                    {activeWinnerEntry.safeName}
                  </h3>
                </div>
              </div>
              <span className="px-2 py-1 rounded-lg bg-[#009FE3]/25 border border-[#14C9E5]/40 text-[11px] font-extrabold text-[#14C9E5] shrink-0">
                #{activeWinnerEntry.formattedStt}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-200 bg-[#071830] rounded-xl px-3 py-2 border border-white/10">
              <span>Mã HS: <strong className="text-[#FFCC33]">{activeWinnerEntry.safeCode}</strong></span>
              <span>·</span>
              <span>Lớp: <strong className="text-white">{resolvedClassName}</strong></span>
              <span>·</span>
              <span>{durationSec}s</span>
            </div>

            {/* Bonus Points Quick Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                <span>Điểm thưởng nhanh:</span>
                {bonusPoints > 0 && (
                  <span className="text-[#FFCC33] font-black">+{bonusPoints} điểm</span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[0, 1, 2, 5, 10].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => setBonusPoints(pts)}
                    className={`py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                      bonusPoints === pts
                        ? 'bg-[#FFCC33] text-[#10294A]'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {pts === 0 ? '0đ' : `+${pts}đ`}
                  </button>
                ))}
              </div>
            </div>

            {/* Note Input + Save */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
                placeholder="Ghi chú nhận xét nhanh..."
                className="flex-1 bg-[#071830] border border-white/20 focus:border-[#14C9E5] rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={handleSaveBonusAndNote}
                className="px-3 py-2 rounded-xl bg-[#009FE3] hover:bg-[#14C9E5] text-white text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                title="Lưu điểm thưởng & ghi chú"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu</span>
              </button>
            </div>

            {/* Sync / Save Feedback */}
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#14C9E5]" />
                    <span className="text-cyan-200">Đã lưu phiên tại máy</span>
                  </>
                )}
              </span>
              {noteSaveFeedback && (
                <span className="text-[#FFCC33] font-extrabold">{noteSaveFeedback}</span>
              )}
            </div>

            {/* Next Race Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={startNewRace}
                disabled={eligibleStudents.length === 0}
                className="py-2.5 px-3 rounded-xl bg-[#FFCC33] hover:bg-amber-300 text-[#10294A] font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 shadow-lg"
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
                <span>Về vạch xuất phát</span>
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================
            LOCAL TURN HISTORY DRAWER (Top-Right Slide Panel when toggled)
           ================================================================== */}
        {showRecordsDrawer && (
          <div className="absolute top-3 right-3 z-30 w-[calc(100%-24px)] sm:w-[390px] max-h-[82%] bg-[#10294A]/96 border-2 border-[#14C9E5]/60 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#FFCC33]" />
                <h4 className="text-sm font-black text-white">
                  Lịch sử Vịt Đua ({turnRecords.length})
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
                  Chưa có lượt đua nào được ghi nhận cho lớp này.
                </p>
              ) : (
                turnRecords.map((rec) => (
                  <div
                    key={rec.turnId}
                    className="bg-[#071830] border border-white/10 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-black text-white truncate">
                        #{rec.turnIndex} · {rec.studentName}
                      </div>
                      <div className="text-[11px] text-slate-300 flex flex-wrap gap-1.5">
                        <span>STT #{rec.formattedStt}</span>
                        <span>·</span>
                        <span>{rec.durationSec}s</span>
                        {rec.bonusPoints > 0 && (
                          <span className="text-[#FFCC33] font-black">+{rec.bonusPoints}đ</span>
                        )}
                      </div>
                      {rec.note && (
                        <div className="text-[11px] text-[#14C9E5] truncate mt-0.5">{rec.note}</div>
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

        {/* ==================================================================
            BOTTOM PRIMARY CONTROL DOCK
           ================================================================== */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-2.5 px-3 w-full max-w-2xl pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2.5 bg-[#10294A]/92 border border-[#14C9E5]/45 rounded-2xl px-3.5 py-2 shadow-2xl">
            {(raceState === 'READY' || raceState === 'IDLE' || raceState === 'RESULT') && (
              <button
                type="button"
                disabled={eligibleStudents.length === 0}
                onClick={startNewRace}
                className="px-6 py-2.5 rounded-xl bg-[#FFCC33] hover:bg-amber-300 text-[#10294A] font-black text-sm sm:text-base flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer disabled:opacity-45"
              >
                <Play className="w-5 h-5 fill-[#10294A]" />
                <span>{raceState === 'RESULT' ? 'ĐUA LƯỢT TIẾP (Space)' : 'BẮT ĐẦU ĐUA (Space)'}</span>
              </button>
            )}

            {raceState === 'COUNTDOWN' && (
              <div className="px-5 py-2 rounded-xl bg-[#009FE3]/30 border border-[#14C9E5]/50 text-[#FFCC33] font-black text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Đang đếm ngược xuất phát...</span>
              </div>
            )}

            {raceState === 'RACING' && (
              <button
                type="button"
                onClick={pauseRace}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#10294A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Pause className="w-4 h-4 fill-[#10294A]" />
                <span>TẠM DỪNG (Space)</span>
              </button>
            )}

            {raceState === 'PAUSED' && (
              <button
                type="button"
                onClick={resumeRace}
                className="px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#10294A] font-black text-sm flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Play className="w-4 h-4 fill-[#10294A]" />
                <span>TIẾP TỤC ĐUA (Space)</span>
              </button>
            )}

            {raceState === 'FINISHING' && (
              <div className="px-5 py-2 rounded-xl bg-[#FFCC33] text-[#10294A] font-black text-sm flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                <span>ĐANG TRAO CÚP VỀ ĐÍCH!</span>
              </div>
            )}

            {(raceState === 'RACING' || raceState === 'PAUSED' || raceState === 'COUNTDOWN') && (
              <button
                type="button"
                onClick={resetRace}
                className="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
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
          FOOTER LANE STRIP (Quick overview of who is in each lane 1..8)
         ==================================================================== */}
      <div className="bg-[#071830] border-t border-white/10 px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0">
        <span className="text-[11px] font-extrabold text-[#14C9E5] uppercase tracking-wider shrink-0">
          Làn đua ({(activePlanRef.current && isBusyRacing ? activePlanRef.current.racers : previewData.lineup).length}):
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
                  ? 'bg-[#FFCC33] text-[#10294A] border-white font-black'
                  : 'bg-[#10294A] text-slate-100 border-white/15'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: r.palette.bodyHex }}
              />
              <span>L{r.laneNumber}:</span>
              <span className="truncate max-w-[130px]">{r.displayLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DuckRace3DGame;
