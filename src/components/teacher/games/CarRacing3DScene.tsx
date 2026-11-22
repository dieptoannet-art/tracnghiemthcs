import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CAR_TEAM_PALETTES,
  CarRaceMode,
  TURBO_STREAK_TARGET,
} from './carRacing3dEngine';

export interface CarLaneVisualData {
  teamId: string;
  carNumber: number;
  teamName: string;
  paletteIndex: number;
  prevStage: number;
  targetStage: number;
  correctCount: number;
  currentStreak: number;
  turboCount: number;
  lastStagesGained: number;
  turboTriggered: boolean;
}

export interface CarRacing3DSceneProps {
  mode: CarRaceMode;
  lanes: CarLaneVisualData[];
  totalStages: number;
  turboEnabled: boolean;
  startLightPhase: 'idle' | 'countdown' | 'go';
  moveEventId: number; // increments when confirmed turn moves cars from prevStage -> targetStage
  skipToken: number; // increments when teacher clicks "Bỏ qua hoạt ảnh"
  reducedMotion: boolean;
  force2D: boolean;
  compactView: boolean;
  onMovementSettled?: () => void;
  onWebGLFallback?: () => void;
}

// Shared track X bounds so EVERY lane uses the exact same progress scale
// -> Cars with equal stage ALWAYS align horizontally side-by-side!
const TRACK_START_X = -10.8;
const TRACK_FINISH_X = 10.6;
const MOVE_DURATION_SEC = 1.28;

function stageToTrackX(stage: number, totalStages: number): number {
  const safeTotal = Math.max(1, totalStages);
  const ratio = Math.max(0, Math.min(1, stage / safeTotal));
  return TRACK_START_X + ratio * (TRACK_FINISH_X - TRACK_START_X);
}

function createAsphaltTrackTexture(
  laneCount: number,
  totalStages: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Deep motorsport asphalt base
    ctx.fillStyle = '#1b2333';
    ctx.fillRect(0, 0, w, h);

    const safeLanes = Math.max(1, Math.min(6, laneCount));
    const marginY = 38;
    const usableH = h - marginY * 2;
    const laneH = usableH / safeLanes;

    // Alternating subtle lane contrast
    for (let i = 0; i < safeLanes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#1f293d' : '#192234';
      ctx.fillRect(0, marginY + i * laneH, w, laneH);
    }

    // Fine asphalt aggregate grain
    ctx.fillStyle = 'rgba(255,255,255,0.032)';
    for (let i = 0; i < 2400; i++) {
      const gx = (i * 257) % w;
      const gy = (i * 419) % h;
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Blue/white stadium curbs top & bottom
    const curbSeg = 32;
    for (let x = 0; x < w; x += curbSeg) {
      const isBlue = (x / curbSeg) % 2 === 0;
      ctx.fillStyle = isBlue ? '#1d63ed' : '#f8fafc';
      ctx.fillRect(x, 12, curbSeg, 18);
      ctx.fillRect(x, h - 30, curbSeg, 18);
    }

    // Compute pixel positions matching TRACK_START_X (-10.8) and TRACK_FINISH_X (+10.6) on 26-unit track width
    const trackWidthWorld = 26;
    const worldToPxX = (wx: number) => ((wx + trackWidthWorld / 2) / trackWidthWorld) * w;
    const startPx = worldToPxX(TRACK_START_X);
    const finishPx = worldToPxX(TRACK_FINISH_X);

    // Stage progress ticks across the whole track (identical scale for all lanes)
    const safeStages = Math.max(1, Math.min(25, totalStages));
    for (let s = 1; s < safeStages; s++) {
      const sx = startPx + (s / safeStages) * (finishPx - startPx);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(sx, marginY);
      ctx.lineTo(sx, h - marginY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stage tick marker at bottom edge
      ctx.fillStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.fillRect(sx - 2, h - marginY + 2, 4, 8);
    }

    // Crisp Start Line (white + electric blue strip)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(startPx - 4, marginY, 8, usableH);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(startPx - 10, marginY, 4, usableH);

    // Checkered Finish Line (2 columns of black/white squares)
    const checkSize = 14;
    const rows = Math.ceil(usableH / checkSize);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0b1120';
        ctx.fillRect(
          finishPx - checkSize + c * checkSize,
          marginY + r * checkSize,
          checkSize,
          Math.min(checkSize, h - marginY - (marginY + r * checkSize))
        );
      }
    }

    // Crisp white lane dividers
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.lineWidth = 4;
    for (let i = 0; i <= safeLanes; i++) {
      const y = marginY + i * laneH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Lane numbers printed on asphalt near start
    for (let i = 0; i < safeLanes; i++) {
      const cy = marginY + (i + 0.5) * laneH;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, startPx - 32, cy);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createCheckeredBannerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const sq = 24;
    for (let y = 0; y < canvas.height; y += sq) {
      for (let x = 0; x < canvas.width; x += sq) {
        ctx.fillStyle = ((x / sq) + (y / sq)) % 2 === 0 ? '#f8fafc' : '#0b1120';
        ctx.fillRect(x, y, sq, sq);
      }
    }
    // Gold edge trim top & bottom
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, canvas.width, 6);
    ctx.fillRect(0, canvas.height - 6, canvas.width, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  return tex;
}

function createCarBadgeTexture(
  carNumber: number,
  teamName: string,
  colorHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // High-contrast navy backing with team border
    ctx.fillStyle = 'rgba(7, 17, 38, 0.94)';
    ctx.beginPath();
    ctx.roundRect(6, 10, canvas.width - 12, canvas.height - 20, 18);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    // Car number circle
    ctx.fillStyle = colorHex;
    ctx.beginPath();
    ctx.arc(52, 48, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = colorHex === '#EAB308' ? '#071126' : '#ffffff';
    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${carNumber}`, 52, 49);

    // Team name readable from back of classroom
    const shortName = teamName.length > 16 ? `${teamName.slice(0, 15)}…` : teamName;
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(shortName, 92, 49);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createHoodNumberTexture(carNumber: number, colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.roundRect(8, 8, 112, 112, 22);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = colorHex;
    ctx.stroke();

    ctx.fillStyle = '#071126';
    ctx.font = '900 72px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${carNumber}`, 64, 68);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

interface CarRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  turboFlame: THREE.Group;
  contactShadow: THREE.Mesh;
  nameSprite: THREE.Sprite;
  currentX: number;
  startX: number;
  targetX: number;
  turboActive: boolean;
}

/**
 * Composite 10-part procedural 3D racing car (bottom-center grounded at y = 0).
 * Faces +X (toward checkered finish line).
 */
function buildRaceCarRig(
  carNumber: number,
  teamName: string,
  paletteIndex: number,
  isSoftwareGl: boolean
): CarRig {
  const palette = CAR_TEAM_PALETTES[paletteIndex % CAR_TEAM_PALETTES.length];
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.hexNum,
    roughness: 0.24,
    metalness: 0.42,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.2,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.72,
    metalness: 0.15,
  });
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.12,
    metalness: 0.78,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.85,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.88,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.85,
  });

  // 1. Contact shadow plane right above asphalt
  const shadowGeo = new THREE.PlaneGeometry(2.1, 1.08);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x020617,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.025, 0);
  group.add(contactShadow);

  // 2. Undertray / floor chassis
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.11, 0.78), carbonMat);
  floorMesh.position.set(-0.02, 0.16, 0);
  floorMesh.castShadow = !isSoftwareGl;
  group.add(floorMesh);

  // 3. Main aerodynamic fuselage hull
  const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.24, 0.56), bodyMat);
  hullMesh.position.set(-0.04, 0.32, 0);
  hullMesh.castShadow = !isSoftwareGl;
  group.add(hullMesh);

  // 4. Tapered front nose cone (+X)
  const noseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.34), bodyMat);
  noseMesh.position.set(0.76, 0.25, 0);
  noseMesh.rotation.z = -0.14;
  noseMesh.castShadow = !isSoftwareGl;
  group.add(noseMesh);

  // Hood number decal plate
  const hoodTex = createHoodNumberTexture(carNumber, palette.hex);
  const hoodDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.32, 0.32),
    new THREE.MeshBasicMaterial({ map: hoodTex })
  );
  hoodDecal.rotation.x = -Math.PI / 2;
  hoodDecal.rotation.z = -Math.PI / 2;
  hoodDecal.position.set(0.45, 0.445, 0);
  group.add(hoodDecal);

  // 5. Left & right sculpted sidepods with white stripe
  for (const side of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.2, 0.18), bodyMat);
    pod.position.set(-0.08, 0.27, side * 0.34);
    pod.castShadow = !isSoftwareGl;
    group.add(pod);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.03), trimMat);
    stripe.position.set(-0.08, 0.31, side * 0.43);
    group.add(stripe);
  }

  // 6. Front aerodynamic wing + endplates
  const frontWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.98), trimMat);
  frontWing.position.set(0.98, 0.16, 0);
  group.add(frontWing);

  for (const side of [-1, 1]) {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.05), goldAccentMat);
    endplate.position.set(0.98, 0.2, side * 0.48);
    group.add(endplate);
  }

  // 7. Rear spoiler wing on twin struts
  const rearWing = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.92), bodyMat);
  rearWing.position.set(-0.84, 0.64, 0);
  rearWing.rotation.z = 0.14;
  group.add(rearWing);

  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.05), carbonMat);
    strut.position.set(-0.8, 0.47, side * 0.28);
    group.add(strut);
  }

  // 8. Cockpit canopy + driver helmet
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.2, 0.38), canopyMat);
  canopy.position.set(-0.06, 0.5, 0);
  group.add(canopy);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), trimMat);
  helmet.position.set(-0.04, 0.56, 0);
  group.add(helmet);

  // 9. Headlights (+X) & rear brake light bar (-X)
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  for (const side of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.1), headMat);
    lamp.position.set(1.03, 0.24, side * 0.24);
    group.add(lamp);
  }
  const tailBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.08, 0.32),
    new THREE.MeshBasicMaterial({ color: 0xef4444 })
  );
  tailBar.position.set(-0.92, 0.28, 0);
  group.add(tailBar);

  // 10. Four rotating wheels with metallic rims & spoke mark (so spin is unmistakably visible!)
  const wheels: THREE.Object3D[] = [];
  const wheelPositions: Array<[number, number, number]> = [
    [0.58, 0.2, 0.48],
    [0.58, 0.2, -0.48],
    [-0.56, 0.22, 0.5],
    [-0.56, 0.22, -0.5],
  ];

  wheelPositions.forEach(([wx, wy, wz], idx) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);
    const radius = idx >= 2 ? 0.22 : 0.2;
    const width = idx >= 2 ? 0.2 : 0.16;

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 16), tireMat);
    tire.rotation.x = Math.PI / 2;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 10),
      rimMat
    );
    rim.rotation.x = Math.PI / 2;
    wheelGroup.add(rim);

    // High-contrast spoke cross so wheel spin is visible even from classroom rear
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 1.12, 0.045, width + 0.03),
      goldAccentMat
    );
    wheelGroup.add(spoke);

    group.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // Short electric-gold Turbo exhaust flame group behind rear diffuser (-X)
  const turboFlame = new THREE.Group();
  turboFlame.position.set(-0.98, 0.26, 0);
  turboFlame.visible = false;

  const outerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 1.35, 10),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  outerCone.rotation.z = Math.PI / 2;
  outerCone.position.x = -0.68;
  turboFlame.add(outerCone);

  const innerCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.95, 10),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  innerCone.rotation.z = Math.PI / 2;
  innerCone.position.x = -0.46;
  turboFlame.add(innerCone);
  group.add(turboFlame);

  // Floating readable team nameplate sprite above car
  const badgeTex = createCarBadgeTexture(carNumber, teamName, palette.hex);
  const spriteMat = new THREE.SpriteMaterial({
    map: badgeTex,
    transparent: true,
    depthTest: false,
  });
  const nameSprite = new THREE.Sprite(spriteMat);
  nameSprite.scale.set(2.35, 0.59, 1);
  nameSprite.position.set(0, 1.24, 0);
  nameSprite.renderOrder = 20;
  group.add(nameSprite);

  return {
    group,
    wheels,
    turboFlame,
    contactShadow,
    nameSprite,
    currentX: TRACK_START_X,
    startX: TRACK_START_X,
    targetX: TRACK_START_X,
    turboActive: false,
  };
}

// ============================================================================
// 2D SVG FALLBACK (IDENTICAL PROGRESS SCALE & FULL PLAYABILITY WITHOUT WEBGL)
// ============================================================================

const CarRacing2DFallback: React.FC<{
  lanes: CarLaneVisualData[];
  totalStages: number;
  turboEnabled: boolean;
  startLightPhase: 'idle' | 'countdown' | 'go';
  compactView: boolean;
  reasonNote?: string;
}> = ({ lanes, totalStages, turboEnabled, startLightPhase, compactView, reasonNote }) => {
  const safeTotal = Math.max(1, totalStages);

  return (
    <div
      className={`w-full rounded-xl bg-[#071126] border border-slate-700/80 overflow-hidden select-none ${
        compactView ? 'p-2.5' : 'p-4'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white">Sơ đồ đường đua 2D</span>
          <span className="text-slate-400">
            Thang tiến độ đồng nhất: 0 → {safeTotal} chặng
          </span>
          {reasonNote && <span className="text-amber-300">{reasonNote}</span>}
        </div>
        <div className="flex items-center gap-1.5" aria-label="Đèn xuất phát">
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className={`w-3 h-3 rounded-full border border-slate-600 ${
                startLightPhase === 'go'
                  ? 'bg-emerald-400'
                  : startLightPhase === 'countdown'
                  ? 'bg-rose-500'
                  : 'bg-slate-700'
              }`}
            />
          ))}
          <span className="ml-1 text-[11px] font-semibold text-slate-300">
            {startLightPhase === 'go'
              ? 'XUẤT PHÁT'
              : startLightPhase === 'countdown'
              ? 'CHUẨN BỊ'
              : 'SẴN SÀNG'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {lanes.map((lane) => {
          const palette = CAR_TEAM_PALETTES[lane.paletteIndex % CAR_TEAM_PALETTES.length];
          const pct = Math.max(0, Math.min(100, (lane.targetStage / safeTotal) * 100));
          return (
            <div
              key={lane.teamId}
              className="relative rounded-lg bg-[#162033] border border-slate-700/70 px-3 py-2 overflow-hidden"
            >
              {/* Stage grid ticks */}
              <div className="absolute inset-y-0 left-12 right-12 pointer-events-none">
                {Array.from({ length: Math.min(20, safeTotal) }, (_, i) => {
                  const pos = ((i + 1) / safeTotal) * 100;
                  return (
                    <div
                      key={i}
                      style={{ left: `${pos}%` }}
                      className="absolute inset-y-0 border-l border-dashed border-slate-600/35"
                    />
                  );
                })}
              </div>

              {/* Checkered finish marker */}
              <div
                className="absolute inset-y-0 right-10 w-3 opacity-80 pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-conic-gradient(#f8fafc 0% 25%, #0b1120 0% 50%)',
                  backgroundSize: '8px 8px',
                }}
              />

              <div className="relative z-10 flex items-center justify-between gap-2 text-xs mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-md font-black text-xs shrink-0"
                    style={{
                      backgroundColor: palette.hex,
                      color: palette.hex === '#EAB308' ? '#071126' : '#ffffff',
                    }}
                  >
                    {lane.carNumber}
                  </span>
                  <span className="font-bold text-white truncate">{lane.teamName}</span>
                  {lane.turboTriggered && (
                    <span className="text-amber-300 font-extrabold whitespace-nowrap">
                      ⚡ Turbo +1 chặng
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-slate-200 tabular-nums shrink-0">
                  <span className="font-extrabold text-amber-300">
                    {lane.targetStage}/{safeTotal} chặng
                  </span>
                  <span className="text-slate-300">{lane.correctCount} đúng</span>
                  {turboEnabled && (
                    <span className="text-sky-300">
                      Chuỗi {lane.currentStreak}/{TURBO_STREAK_TARGET}
                    </span>
                  )}
                </div>
              </div>

              {/* Track bar with car SVG */}
              <div className="relative h-7 rounded bg-[#0c1424] border border-slate-700/60 flex items-center px-2">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: palette.hex,
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-500"
                  style={{ left: `calc(18px + (100% - 36px) * ${pct / 100})` }}
                >
                  <svg
                    width="34"
                    height="18"
                    viewBox="0 0 34 18"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="24" height="10" rx="4" fill={palette.hex} />
                    <rect x="14" y="6" width="8" height="6" rx="2" fill="#38bdf8" />
                    <rect x="26" y="5" width="6" height="8" rx="2" fill="#f8fafc" />
                    <circle cx="9" cy="14.5" r="2.8" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1" />
                    <circle cx="24" cy="14.5" r="2.8" fill="#0f172a" stroke="#e2e8f0" strokeWidth="1" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN 3D STADIUM COMPONENT
// ============================================================================

const CarRacing3DScene: React.FC<CarRacing3DSceneProps> = ({
  lanes,
  totalStages,
  turboEnabled,
  startLightPhase,
  moveEventId,
  skipToken,
  reducedMotion,
  force2D,
  compactView,
  onMovementSettled,
  onWebGLFallback,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const settledCbRef = useRef(onMovementSettled);
  settledCbRef.current = onMovementSettled;
  const fallbackCbRef = useRef(onWebGLFallback);
  fallbackCbRef.current = onWebGLFallback;

  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;

  const totalStagesRef = useRef(totalStages);
  totalStagesRef.current = totalStages;

  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const startLightPhaseRef = useRef(startLightPhase);
  startLightPhaseRef.current = startLightPhase;

  const animStateRef = useRef<{
    isMoving: boolean;
    elapsed: number;
    lastMoveEventId: number;
    lastSkipToken: number;
  }>({
    isMoving: false,
    elapsed: MOVE_DURATION_SEC,
    lastMoveEventId: moveEventId,
    lastSkipToken: skipToken,
  });

  const carsMapRef = useRef<Map<string, CarRig>>(new Map());
  const startLightMeshesRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const requestRenderRef = useRef<(() => void) | null>(null);

  const laneSignature = useMemo(
    () =>
      lanes
        .map((l) => `${l.teamId}:${l.carNumber}:${l.paletteIndex}:${l.teamName}`)
        .join('|') + `::${totalStages}`,
    [lanes, totalStages]
  );

  // Trigger simultaneous car movement on moveEventId change
  useEffect(() => {
    if (moveEventId === animStateRef.current.lastMoveEventId) return;
    animStateRef.current.lastMoveEventId = moveEventId;

    const currentLanes = lanesRef.current;
    const stagesMax = totalStagesRef.current;

    if (force2D || webglFailed) {
      settledCbRef.current?.();
      return;
    }

    let anyCarMoves = false;
    currentLanes.forEach((lane) => {
      const rig = carsMapRef.current.get(lane.teamId);
      if (!rig) return;
      const fromX = stageToTrackX(lane.prevStage, stagesMax);
      const toX = stageToTrackX(lane.targetStage, stagesMax);
      rig.startX = fromX;
      rig.targetX = toX;
      rig.turboActive = Boolean(lane.turboTriggered);
      if (Math.abs(toX - fromX) > 0.01) {
        anyCarMoves = true;
      }
      if (reducedMotionRef.current || !anyCarMoves) {
        rig.currentX = toX;
        rig.group.position.x = toX;
        rig.turboFlame.visible = false;
      } else {
        rig.currentX = fromX;
        rig.group.position.x = fromX;
      }
    });

    if (reducedMotionRef.current || !anyCarMoves) {
      animStateRef.current.isMoving = false;
      animStateRef.current.elapsed = MOVE_DURATION_SEC;
      requestRenderRef.current?.();
      settledCbRef.current?.();
      return;
    }

    animStateRef.current.isMoving = true;
    animStateRef.current.elapsed = 0;
    requestRenderRef.current?.();
  }, [moveEventId, force2D, webglFailed]);

  // Snap immediately when teacher clicks "Bỏ qua hoạt ảnh"
  useEffect(() => {
    if (skipToken === animStateRef.current.lastSkipToken) return;
    animStateRef.current.lastSkipToken = skipToken;

    if (!animStateRef.current.isMoving) return;
    animStateRef.current.isMoving = false;
    animStateRef.current.elapsed = MOVE_DURATION_SEC;

    carsMapRef.current.forEach((rig) => {
      rig.currentX = rig.targetX;
      rig.group.position.x = rig.targetX;
      rig.turboFlame.visible = false;
      rig.turboActive = false;
    });

    requestRenderRef.current?.();
    settledCbRef.current?.();
  }, [skipToken]);

  // Sync static lane positions (e.g. after edit-last-turn or session restore) when not moving
  useEffect(() => {
    if (animStateRef.current.isMoving) return;
    const stagesMax = totalStagesRef.current;
    lanes.forEach((lane) => {
      const rig = carsMapRef.current.get(lane.teamId);
      if (!rig) return;
      const targetX = stageToTrackX(lane.targetStage, stagesMax);
      rig.startX = targetX;
      rig.targetX = targetX;
      rig.currentX = targetX;
      rig.group.position.x = targetX;
      rig.turboFlame.visible = false;
    });
    requestRenderRef.current?.();
  }, [lanes, totalStages]);

  // Update starting gantry light colors whenever startLightPhase changes
  useEffect(() => {
    const mats = startLightMeshesRef.current;
    mats.forEach((mat) => {
      if (startLightPhase === 'go') {
        mat.color.setHex(0x22c55e);
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 2.0;
      } else if (startLightPhase === 'countdown') {
        mat.color.setHex(0xef4444);
        mat.emissive.setHex(0xef4444);
        mat.emissiveIntensity = 2.0;
      } else {
        mat.color.setHex(0x334155);
        mat.emissive.setHex(0x0f172a);
        mat.emissiveIntensity = 0.2;
      }
    });
    requestRenderRef.current?.();
  }, [startLightPhase]);

  // Build & manage Three.js closed motorsport stadium
  useEffect(() => {
    if (force2D || webglFailed) return;
    const mountEl = containerRef.current;
    if (!mountEl) return;

    let isSoftwareGl = false;
    let renderer: THREE.WebGLRenderer | null = null;

    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!probeGl) {
        setWebglFailed(true);
        fallbackCbRef.current?.();
        return;
      }
      const ext = probeGl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER;
      const gpu = String(probeGl.getParameter(param) || '');
      probeGl.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      fallbackCbRef.current?.();
      return;
    }

    const activeRenderer = renderer;
    activeRenderer.outputColorSpace = THREE.SRGBColorSpace;
    activeRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    activeRenderer.toneMappingExposure = 1.12;
    activeRenderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    activeRenderer.shadowMap.enabled = !isSoftwareGl;
    activeRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(320, mountEl.clientWidth || 960);
    const height = Math.max(180, mountEl.clientHeight || 340);
    activeRenderer.setSize(width, height, false);
    activeRenderer.domElement.style.width = '100%';
    activeRenderer.domElement.style.height = '100%';
    activeRenderer.domElement.style.display = 'block';
    mountEl.innerHTML = '';
    mountEl.appendChild(activeRenderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
      fallbackCbRef.current?.();
    };
    activeRenderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    // Scene with navy twilight atmosphere + horizon fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071126);
    scene.fog = new THREE.Fog(0x071126, 28, 72);

    // Mandatory procedural RoomEnvironment reflections
    const pmrem = new THREE.PMREMGenerator(activeRenderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    // Slightly elevated 3/4 camera overlooking ALL cars AND the checkered finish arch
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.2, 120);
    camera.position.set(-2.4, 11.4, 17.8);
    camera.lookAt(0.2, 0.5, -0.3);

    // Balanced 3-point stadium lighting (warm key + cool hemisphere fill + electric rim)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4d6, 1.85);
    keyLight.position.set(8, 20, 14);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -16;
      keyLight.shadow.camera.right = 16;
      keyLight.shadow.camera.top = 12;
      keyLight.shadow.camera.bottom = -12;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-14, 10, -12);
    scene.add(rimLight);

    const currentLanes = lanesRef.current;
    const laneCount = Math.max(1, Math.min(6, currentLanes.length));
    const maxAniso = activeRenderer.capabilities.getMaxAnisotropy();

    // Stadium outer apron ground (extends wide into fog)
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 100),
      new THREE.MeshStandardMaterial({
        color: 0x0b162d,
        roughness: 0.92,
        metalness: 0.04,
      })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.04;
    groundMesh.receiveShadow = !isSoftwareGl;
    scene.add(groundMesh);

    // Closed motorsport track surface (26m x 9.6m)
    const trackDepth = Math.max(5.6, Math.min(9.8, laneCount * 1.48 + 1.4));
    const trackTex = createAsphaltTrackTexture(laneCount, totalStagesRef.current, maxAniso);
    const trackMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(26, trackDepth),
      new THREE.MeshStandardMaterial({
        map: trackTex,
        roughness: 0.84,
        metalness: 0.06,
      })
    );
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = 0;
    trackMesh.receiveShadow = !isSoftwareGl;
    scene.add(trackMesh);

    // Concrete safety walls & electric blue / gold trim enclosing the circuit
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.65,
      metalness: 0.1,
    });
    const bannerBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      roughness: 0.5,
      metalness: 0.2,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.26,
      metalness: 0.8,
    });

    const halfTrackZ = trackDepth / 2;
    // Far barrier (-Z) & near low curb wall (+Z)
    const farWall = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.72, 0.36), barrierMat);
    farWall.position.set(0, 0.36, -halfTrackZ - 0.35);
    scene.add(farWall);

    const farBanner = new THREE.Mesh(new THREE.BoxGeometry(26.4, 0.24, 0.4), bannerBlueMat);
    farBanner.position.set(0, 0.56, -halfTrackZ - 0.34);
    scene.add(farBanner);

    const nearWall = new THREE.Mesh(new THREE.BoxGeometry(27.2, 0.34, 0.28), barrierMat);
    nearWall.position.set(0, 0.17, halfTrackZ + 0.32);
    scene.add(nearWall);

    // Curved end-caps closing the circuit visually (left & right barriers)
    for (const endX of [-13.4, 13.4]) {
      const endWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.75, trackDepth + 1.4),
        bannerBlueMat
      );
      endWall.position.set(endX, 0.375, 0);
      scene.add(endWall);
    }

    // Tiered Stadium Grandstands on the far side (-Z)
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x172542,
      roughness: 0.72,
      metalness: 0.18,
    });
    const seatRowMat = new THREE.MeshStandardMaterial({
      color: 0x1d63ed,
      roughness: 0.55,
      metalness: 0.12,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x0f1b33,
      roughness: 0.45,
      metalness: 0.42,
    });

    for (let tier = 0; tier < 4; tier++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(25.2, 0.58, 1.05), standMat);
      step.position.set(0, 0.55 + tier * 0.62, -halfTrackZ - 1.5 - tier * 0.92);
      scene.add(step);

      const seatStrip = new THREE.Mesh(
        new THREE.BoxGeometry(24.4, 0.2, 0.48),
        tier % 2 === 0 ? seatRowMat : goldMat
      );
      seatStrip.position.set(0, 0.9 + tier * 0.62, -halfTrackZ - 1.38 - tier * 0.92);
      scene.add(seatStrip);
    }

    // Grandstand canopy roof
    const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(26, 0.22, 4.6), roofMat);
    canopyRoof.position.set(0, 4.55, -halfTrackZ - 3.0);
    canopyRoof.rotation.x = 0.12;
    scene.add(canopyRoof);

    // 4 Stadium Floodlight Towers with glowing lamp bars
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.38,
      metalness: 0.72,
    });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
    [-11.2, -3.8, 3.8, 11.2].forEach((tx) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.2, 10), poleMat);
      pole.position.set(tx, 3.1, -halfTrackZ - 5.2);
      scene.add(pole);

      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.28), lampGlowMat);
      lampHead.position.set(tx, 6.1, -halfTrackZ - 4.95);
      lampHead.rotation.x = 0.38;
      scene.add(lampHead);
    });

    // Starting Light Gantry above TRACK_START_X
    const gantryGroup = new THREE.Group();
    gantryGroup.position.set(TRACK_START_X + 0.55, 0, 0);
    const gantryPostGeo = new THREE.BoxGeometry(0.24, 3.7, 0.24);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(gantryPostGeo, poleMat);
      post.position.set(0, 1.85, side * (halfTrackZ + 0.25));
      gantryGroup.add(post);
    }
    const gantryBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, trackDepth + 0.9),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.5 })
    );
    gantryBeam.position.set(0, 3.55, 0);
    gantryGroup.add(gantryBeam);

    // 4 Starting Signal Lights on the gantry
    const lightMats: THREE.MeshStandardMaterial[] = [];
    const lightBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.62, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.5, metalness: 0.4 })
    );
    lightBox.position.set(0.18, 3.18, 0);
    gantryGroup.add(lightBox);

    for (let i = 0; i < 4; i++) {
      const lMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2,
        roughness: 0.2,
      });
      if (startLightPhaseRef.current === 'go') {
        lMat.color.setHex(0x22c55e);
        lMat.emissive.setHex(0x22c55e);
        lMat.emissiveIntensity = 2.0;
      } else if (startLightPhaseRef.current === 'countdown') {
        lMat.color.setHex(0xef4444);
        lMat.emissive.setHex(0xef4444);
        lMat.emissiveIntensity = 2.0;
      }
      lightMats.push(lMat);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14), lMat);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(0.38, 3.18, -0.75 + i * 0.5);
      gantryGroup.add(lens);
    }
    startLightMeshesRef.current = lightMats;
    scene.add(gantryGroup);

    // Checkered Finish Line Arch at TRACK_FINISH_X
    const archGroup = new THREE.Group();
    archGroup.position.set(TRACK_FINISH_X, 0, 0);
    const checkeredTex = createCheckeredBannerTexture(maxAniso);
    const archBannerMat = new THREE.MeshStandardMaterial({
      map: checkeredTex,
      roughness: 0.4,
      metalness: 0.15,
    });
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.1, 0.42), goldMat);
      pillar.position.set(0, 2.05, side * (halfTrackZ + 0.3));
      archGroup.add(pillar);
    }
    const archHeader = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.92, trackDepth + 1.0),
      archBannerMat
    );
    archHeader.position.set(0, 3.85, 0);
    archGroup.add(archHeader);
    scene.add(archGroup);

    // Build 1–6 composite 3D racing cars aligned along parallel lanes
    const carsMap = new Map<string, CarRig>();
    const usableTrackZ = trackDepth * 0.84;
    const laneStepZ = usableTrackZ / laneCount;

    currentLanes.forEach((lane, idx) => {
      const rig = buildRaceCarRig(
        lane.carNumber,
        lane.teamName,
        lane.paletteIndex,
        isSoftwareGl
      );
      const laneZ = -usableTrackZ / 2 + (idx + 0.5) * laneStepZ;
      const startPosX = stageToTrackX(lane.targetStage, totalStagesRef.current);
      rig.currentX = startPosX;
      rig.startX = startPosX;
      rig.targetX = startPosX;
      rig.group.position.set(startPosX, 0, laneZ);
      // Slight scale adjustment for 5-6 lanes so cars stay spacious and crystal clear
      const carScale = laneCount >= 5 ? 0.82 : laneCount >= 4 ? 0.9 : 1.0;
      rig.group.scale.setScalar(carScale);
      scene.add(rig.group);
      carsMap.set(lane.teamId, rig);
    });
    carsMapRef.current = carsMap;

    if (!isSoftwareGl) {
      activeRenderer.compile(scene, camera);
    }

    // Coalesced render-on-demand + software WebGL fenceSync pacing
    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = activeRenderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function stepAndRender() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const anim = animStateRef.current;
      let keepAnimating = false;

      if (anim.isMoving) {
        anim.elapsed += dt;
        const rawT = Math.min(1, anim.elapsed / MOVE_DURATION_SEC);
        // Smooth ease-out cubic so cars accelerate smoothly and settle cleanly
        const easeT = 1 - Math.pow(1 - rawT, 3);

        carsMap.forEach((rig) => {
          const prevX = rig.currentX;
          const nextX = rig.startX + (rig.targetX - rig.startX) * easeT;
          const dx = nextX - prevX;
          rig.currentX = nextX;
          rig.group.position.x = nextX;

          // Spin wheels strictly proportional to actual forward travel (wrong cars don't move or spin!)
          if (Math.abs(dx) > 0.0001) {
            const rotDelta = -dx / 0.21;
            rig.wheels.forEach((w) => {
              w.rotation.z += rotDelta;
            });
          }

          // Brief Turbo flame burst during movement (t in 0.08..0.88)
          if (rig.turboActive && rawT >= 0.06 && rawT <= 0.88) {
            rig.turboFlame.visible = true;
            const pulse = 0.85 + Math.sin(rawT * 36) * 0.22;
            rig.turboFlame.scale.set(pulse, 1, 1);
          } else {
            rig.turboFlame.visible = false;
          }
        });

        if (rawT >= 1) {
          anim.isMoving = false;
          carsMap.forEach((rig) => {
            rig.currentX = rig.targetX;
            rig.group.position.x = rig.targetX;
            rig.turboFlame.visible = false;
            rig.turboActive = false;
          });
          settledCbRef.current?.();
        } else {
          keepAnimating = true;
        }
      }

      activeRenderer.render(scene, camera);

      const finishFrame = () => {
        renderBusy = false;
        if (disposed) return;
        if (keepAnimating || renderDirty) {
          requestRender();
        }
      };

      if (isSoftwareGl) {
        afterDraw(finishFrame);
      } else {
        finishFrame();
      }
    }

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      renderDirty = false;
      frameId = window.requestAnimationFrame(stepAndRender);
    }

    requestRenderRef.current = requestRender;
    requestRender();

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(280, Math.floor(entry.contentRect.width));
      const h = Math.max(150, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      activeRenderer.setSize(w, h, false);
      requestRender();
    });
    resizeObserver.observe(mountEl);

    return () => {
      disposed = true;
      requestRenderRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      activeRenderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Sprite).isSprite) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mat = mesh.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => {
              if ('map' in m && m.map) (m.map as THREE.Texture).dispose();
              m.dispose();
            });
          } else if (mat) {
            if ('map' in mat && mat.map) (mat.map as THREE.Texture).dispose();
            mat.dispose();
          }
        }
      });
      envTarget.dispose();
      activeRenderer.dispose();
      carsMap.clear();
      startLightMeshesRef.current = [];
    };
  }, [laneSignature, force2D, webglFailed]);

  if (force2D || webglFailed) {
    return (
      <CarRacing2DFallback
        lanes={lanes}
        totalStages={totalStages}
        turboEnabled={turboEnabled}
        startLightPhase={startLightPhase}
        compactView={compactView}
        reasonNote={webglFailed ? 'Thiết bị không hỗ trợ WebGL — tự động chuyển chế độ 2D' : undefined}
      />
    );
  }

  const turboBannerTeams = lanes.filter((l) => l.turboTriggered);

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden bg-[#071126] border border-slate-700/80 transition-all duration-200 ${
        compactView
          ? 'h-[155px] sm:h-[185px]'
          : 'h-[250px] sm:h-[310px] lg:h-[345px]'
      }`}
    >
      {/* Isolated WebGL mount container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Minimal non-blurred HUD strip (zero backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-2.5 left-3 right-3 flex items-center justify-between gap-2 text-xs">
        <div className="bg-[#071126]/90 border border-slate-700/80 rounded-lg px-2.5 py-1 text-slate-200 font-semibold tabular-nums">
          Đường đua 3D · Đích {totalStages} chặng
          {turboEnabled ? ' · Turbo Bật' : ' · Turbo Tắt'}
        </div>

        {turboBannerTeams.length > 0 && (
          <div className="bg-amber-400 text-slate-950 rounded-lg px-3 py-1 font-extrabold shadow-md">
            ⚡ Turbo +1 chặng: {turboBannerTeams.map((t) => t.teamName).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default CarRacing3DScene;
