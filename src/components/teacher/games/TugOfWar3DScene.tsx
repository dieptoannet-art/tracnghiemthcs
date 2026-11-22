import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { MatchStatus, TugMode, WinnerSide } from './tugOfWar3dEngine';

export interface TugOfWar3DSceneProps {
  mode: TugMode;
  teamAName: string;
  teamBName: string;
  soloName: string;
  ropePosition: number; // two_teams: [-winTarget..+winTarget], solo_practice: [0..winTarget]
  winTarget: number;
  lastDelta: number; // -1, 0, +1
  pullEventId: number; // increments when a new turn commit occurs
  skipToken: number; // increments when teacher clicks "Bỏ qua hoạt ảnh"
  reducedMotion: boolean;
  force2D: boolean;
  compactView: boolean;
  matchStatus: MatchStatus;
  winner: WinnerSide;
  onPullSettled?: () => void;
  onWebGLFallback?: () => void;
}

// Team color tokens (high contrast + distinct luminance for colorblind accessibility)
const TEAM_A_HEX = 0x2563eb; // Cobalt Blue (left)
const TEAM_A_ACCENT = 0x93c5fd;
const TEAM_B_HEX = 0xea580c; // Coral Orange (right)
const TEAM_B_ACCENT = 0xfdba74;
const RIBBON_HEX = 0xdc2626; // Crimson ribbon
const GOLD_HEX = 0xf59e0b;

function createTurfTexture(
  mode: TugMode,
  winTarget: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich emerald-teal turf with mown grass stripes
    const stripeCount = 16;
    const sw = w / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#0d6b56' : '#0f7860';
      ctx.fillRect(i * sw, 0, sw + 1, h);
    }

    // Subtle turf texture grain
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 1800; i++) {
      const gx = (i * 197) % w;
      const gy = (i * 353) % h;
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Outer white pitch border
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 6;
    ctx.strokeRect(24, 34, w - 48, h - 68);

    // Distance markers mapped cleanly across central 56% of field width
    const centerX = w / 2;
    const spanHalfPx = w * 0.28;
    const safeTarget = Math.max(1, winTarget);

    if (mode === 'two_teams') {
      // Symmetrical white notch lines (-W .. +W)
      for (let k = -safeTarget; k <= safeTarget; k++) {
        const x = centerX + (k / safeTarget) * spanHalfPx;
        const isCenter = k === 0;
        const isWinA = k === -safeTarget;
        const isWinB = k === safeTarget;

        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, h - 42);
        if (isCenter) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 10;
        } else if (isWinA) {
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 10;
        } else if (isWinB) {
          ctx.strokeStyle = '#fb923c';
          ctx.lineWidth = 10;
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.82)';
          ctx.lineWidth = 4;
        }
        ctx.stroke();

        // Notch number plate on turf foreground
        const label = k === 0 ? '0' : k > 0 ? `+${k}` : `${k}`;
        ctx.fillStyle = isCenter
          ? '#fbbf24'
          : isWinA
            ? '#60a5fa'
            : isWinB
              ? '#fb923c'
              : '#f8fafc';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, h - 54);
      }

      // Subtle shaded end-zones
      ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
      ctx.fillRect(28, 38, centerX - spanHalfPx - 28, h - 76);
      ctx.fillStyle = 'rgba(234, 88, 12, 0.22)';
      ctx.fillRect(centerX + spanHalfPx, 38, w - 28 - (centerX + spanHalfPx), h - 76);
    } else {
      // Solo practice: 0 on left-center, +W on right target line
      const startX = w * 0.28;
      const endX = w * 0.72;
      for (let k = 0; k <= safeTarget; k++) {
        const x = startX + (k / safeTarget) * (endX - startX);
        const isStart = k === 0;
        const isGoal = k === safeTarget;

        ctx.beginPath();
        ctx.moveTo(x, 42);
        ctx.lineTo(x, h - 42);
        ctx.strokeStyle = isGoal
          ? '#fbbf24'
          : isStart
            ? '#60a5fa'
            : 'rgba(255,255,255,0.82)';
        ctx.lineWidth = isGoal || isStart ? 10 : 4;
        ctx.stroke();

        ctx.fillStyle = isGoal ? '#fbbf24' : '#f8fafc';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(isGoal ? `ĐÍCH (${k})` : `${k}`, x, h - 54);
      }

      ctx.fillStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.fillRect(endX, 38, w - 28 - endX, h - 76);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function createRopeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#c89b62';
    ctx.fillRect(0, 0, 256, 64);
    for (let x = -64; x < 320; x += 18) {
      ctx.strokeStyle = '#9a6f3a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 42, 64);
      ctx.stroke();

      ctx.strokeStyle = '#e3be8a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 7, 0);
      ctx.lineTo(x + 49, 64);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

interface AthleteRig {
  root: THREE.Group;
  bodyPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  side: 'left' | 'right';
  baseX: number;
  baseZ: number;
  phaseOffset: number;
}

/**
 * Builds a grounded composite 3D representative student athlete (10+ parts).
 * Grounded cleanly at y = 0 (shoes flush with turf).
 */
function createStudentAthlete(
  jerseyColor: number,
  accentColor: number,
  side: 'left' | 'right',
  baseX: number,
  baseZ: number,
  phaseOffset: number,
  sharedMaterials: THREE.Material[]
): AthleteRig {
  const root = new THREE.Group();
  root.position.set(baseX, 0, baseZ);

  // Facing direction: left team faces right (+X); right team faces left (-X)
  const facingSign = side === 'left' ? 1 : -1;

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: jerseyColor,
    roughness: 0.48,
    metalness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.42,
    metalness: 0.1,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf4c7a1,
    roughness: 0.58,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b24,
    roughness: 0.72,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.45,
    metalness: 0.05,
  });
  sharedMaterials.push(jerseyMat, accentMat, shortsMat, skinMat, hairMat, shoeMat);

  // Legs (pivoted at hip y = 0.62)
  const makeLeg = (zOffset: number, xOffset: number): THREE.Group => {
    const legGroup = new THREE.Group();
    legGroup.position.set(xOffset, 0.62, zOffset);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.22, 6, 10), shortsMat);
    thigh.position.y = -0.14;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 6, 10), skinMat);
    shin.position.y = -0.38;
    shin.castShadow = true;
    legGroup.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.18), shoeMat);
    shoe.position.set(facingSign * 0.05, -0.56, 0);
    shoe.castShadow = true;
    legGroup.add(shoe);

    return legGroup;
  };

  const leftLeg = makeLeg(0.14, facingSign * 0.06);
  const rightLeg = makeLeg(-0.14, -facingSign * 0.06);
  root.add(leftLeg, rightLeg);

  // Upper body pivot at waist y = 0.64
  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, 0.64, 0);
  root.add(bodyPivot);

  // Torso jersey
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.38, 8, 12), jerseyMat);
  torso.position.y = 0.34;
  torso.castShadow = true;
  bodyPivot.add(torso);

  // Chest accent band
  const chestBand = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.225, 0.12, 14), accentMat);
  chestBand.position.y = 0.36;
  bodyPivot.add(chestBand);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 14), skinMat);
  head.position.y = 0.84;
  head.castShadow = true;
  bodyPivot.add(head);

  // Hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.232, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hair.position.set(-facingSign * 0.02, 0.87, 0);
  hair.castShadow = true;
  bodyPivot.add(hair);

  // Sports headband in team accent color
  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.224, 0.028, 8, 20), accentMat);
  headband.rotation.x = Math.PI / 2;
  headband.position.y = 0.91;
  bodyPivot.add(headband);

  // Arms reaching forward toward the rope height
  const makeArm = (zOffset: number): THREE.Group => {
    const armGroup = new THREE.Group();
    armGroup.position.set(facingSign * 0.08, 0.48, zOffset);

    const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.34, 6, 10), jerseyMat);
    upperArm.rotation.z = -facingSign * Math.PI * 0.46;
    upperArm.position.set(facingSign * 0.22, -0.04, -zOffset * 0.32);
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), skinMat);
    hand.position.set(facingSign * 0.44, -0.06, -zOffset * 0.72);
    armGroup.add(hand);

    return armGroup;
  };

  const leftArm = makeArm(0.25);
  const rightArm = makeArm(-0.25);
  bodyPivot.add(leftArm, rightArm);

  return {
    root,
    bodyPivot,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    side,
    baseX,
    baseZ,
    phaseOffset,
  };
}

// ============================================================================
// LIGHTWEIGHT 2D SVG FALLBACK ARENA (AUTOMATIC WHEN WEBGL UNAVAILABLE OR TOGGLED)
// ============================================================================

export const TugOfWar2DFallback: React.FC<{
  mode: TugMode;
  teamAName: string;
  teamBName: string;
  soloName: string;
  ropePosition: number;
  winTarget: number;
  compactView: boolean;
  matchStatus: MatchStatus;
  winner: WinnerSide;
  reducedMotion: boolean;
}> = ({
  mode,
  teamAName,
  teamBName,
  soloName,
  ropePosition,
  winTarget,
  compactView,
  winner,
  reducedMotion,
}) => {
  const safeTarget = Math.max(1, winTarget);
  const notches = useMemo(() => {
    const arr: number[] = [];
    if (mode === 'two_teams') {
      for (let i = -safeTarget; i <= safeTarget; i++) arr.push(i);
    } else {
      for (let i = 0; i <= safeTarget; i++) arr.push(i);
    }
    return arr;
  }, [mode, safeTarget]);

  // Normalized ribbon X in SVG viewBox [0..1000]
  const ribbonX = useMemo(() => {
    if (mode === 'two_teams') {
      return 500 + (ropePosition / safeTarget) * 260;
    }
    return 240 + (ropePosition / safeTarget) * 520;
  }, [mode, ropePosition, safeTarget]);

  const ropeShiftX = ribbonX - (mode === 'two_teams' ? 500 : 240);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0B1528] select-none ${
        compactView ? 'h-[172px] sm:h-[196px]' : 'h-[260px] sm:h-[310px]'
      }`}
    >
      <svg
        viewBox="0 0 1000 300"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label="Sân kéo co 2D dự phòng"
      >
        <defs>
          <linearGradient id="d03Sky2d" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#091326" />
            <stop offset="100%" stopColor="#132544" />
          </linearGradient>
          <linearGradient id="d03Turf2d" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e7a62" />
            <stop offset="100%" stopColor="#095645" />
          </linearGradient>
        </defs>

        {/* Stadium night sky */}
        <rect x="0" y="0" width="1000" height="300" fill="url(#d03Sky2d)" />

        {/* Subtle floodlight beams */}
        <polygon points="150,0 320,165 60,165" fill="rgba(253,224,71,0.06)" />
        <polygon points="850,0 940,165 680,165" fill="rgba(253,224,71,0.06)" />

        {/* Stadium stands silhouette */}
        <rect x="40" y="72" width="920" height="58" rx="10" fill="#172b4d" opacity="0.7" />
        <line x1="50" y1="92" x2="950" y2="92" stroke="#243f6b" strokeWidth="3" />
        <line x1="50" y1="110" x2="950" y2="110" stroke="#243f6b" strokeWidth="3" />

        {/* Turf field */}
        <polygon points="40,130 960,130 990,285 10,285" fill="url(#d03Turf2d)" />
        <line x1="40" y1="130" x2="960" y2="130" stroke="rgba(255,255,255,0.45)" strokeWidth="3" />

        {/* Distance markers */}
        {notches.map((n) => {
          const x =
            mode === 'two_teams'
              ? 500 + (n / safeTarget) * 260
              : 240 + (n / safeTarget) * 520;
          const isCenter = mode === 'two_teams' && n === 0;
          const isLeftWin = mode === 'two_teams' && n === -safeTarget;
          const isRightWin =
            (mode === 'two_teams' && n === safeTarget) ||
            (mode === 'solo_practice' && n === safeTarget);

          const stroke = isCenter
            ? '#fbbf24'
            : isLeftWin
              ? '#60a5fa'
              : isRightWin
                ? mode === 'solo_practice'
                  ? '#fbbf24'
                  : '#fb923c'
                : 'rgba(255,255,255,0.45)';

          return (
            <g key={n}>
              <line
                x1={x}
                y1={134}
                x2={x}
                y2={278}
                stroke={stroke}
                strokeWidth={isCenter || isLeftWin || isRightWin ? 5 : 2}
                strokeDasharray={isCenter || isLeftWin || isRightWin ? undefined : '6 6'}
              />
              <text
                x={x}
                y={270}
                textAnchor="middle"
                fill={stroke === 'rgba(255,255,255,0.45)' ? '#e2e8f0' : stroke}
                fontSize="16"
                fontWeight="800"
              >
                {n > 0 ? `+${n}` : `${n}`}
              </text>
            </g>
          );
        })}

        {/* Moving rope & representative athletes */}
        <g
          style={{
            transform: `translateX(${ropeShiftX}px)`,
            transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {/* Braided Hemp Rope */}
          <line
            x1={mode === 'two_teams' ? 110 : 120}
            y1={174}
            x2={mode === 'two_teams' ? 890 : 880}
            y2={174}
            stroke="#c89b62"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <line
            x1={mode === 'two_teams' ? 110 : 120}
            y1={174}
            x2={mode === 'two_teams' ? 890 : 880}
            y2={174}
            stroke="#8f6330"
            strokeWidth="4"
            strokeDasharray="10 8"
          />

          {/* Left Team (Team A in 2-team mode) OR Knowledge Anchor in solo */}
          {mode === 'two_teams' ? (
            [185, 250, 315].map((cx, i) => (
              <g key={`a-${i}`} transform={`translate(${cx}, 136)`}>
                <circle cx="0" cy="8" r="14" fill="#f4c7a1" />
                <path d="M-14 4 Q0 -12 14 4" fill="#1e1b24" />
                <rect x="-13" y="22" width="26" height="36" rx="10" fill="#2563eb" />
                <rect x="-13" y="34" width="26" height="8" fill="#93c5fd" />
                <line x1="-6" y1="58" x2="-12" y2="88" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
                <line x1="6" y1="58" x2="12" y2="88" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
                <line x1="10" y1="34" x2="26" y2="38" stroke="#2563eb" strokeWidth="8" strokeLinecap="round" />
              </g>
            ))
          ) : (
            <g transform="translate(125, 146)">
              <rect x="-24" y="8" width="48" height="44" rx="8" fill="#475569" stroke="#cbd5e1" strokeWidth="3" />
              <text x="0" y="36" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="800">
                MỤC TIÊU
              </text>
            </g>
          )}

          {/* Right Team (Team B in 2-team mode, Solo athletes in solo_practice) */}
          {[685, 750, 815].map((cx, i) => (
            <g key={`b-${i}`} transform={`translate(${cx}, 136)`}>
              <circle cx="0" cy="8" r="14" fill="#f4c7a1" />
              <path d="M-14 4 Q0 -12 14 4" fill="#1e1b24" />
              <rect
                x="-13"
                y="22"
                width="26"
                height="36"
                rx="10"
                fill={mode === 'two_teams' ? '#ea580c' : '#2563eb'}
              />
              <rect
                x="-13"
                y="34"
                width="26"
                height="8"
                fill={mode === 'two_teams' ? '#fdba74' : '#93c5fd'}
              />
              <line x1="-6" y1="58" x2="-12" y2="88" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
              <line x1="6" y1="58" x2="12" y2="88" stroke="#1e293b" strokeWidth="9" strokeLinecap="round" />
              <line
                x1="-10"
                y1="34"
                x2="-26"
                y2="38"
                stroke={mode === 'two_teams' ? '#ea580c' : '#2563eb'}
                strokeWidth="8"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* Center Crimson-Gold Satin Ribbon */}
          <g transform={`translate(${mode === 'two_teams' ? 500 : 240}, 174)`}>
            <polygon points="-14,0 14,0 20,44 0,34 -20,44" fill="#dc2626" stroke="#fde047" strokeWidth="2.5" />
            <circle cx="0" cy="0" r="11" fill="#f59e0b" stroke="#ffffff" strokeWidth="2.5" />
          </g>
        </g>

        {/* Team header plaques */}
        {mode === 'two_teams' ? (
          <>
            <rect
              x="24"
              y="14"
              width="255"
              height="38"
              rx="10"
              fill={winner === 'A' ? '#1d4ed8' : 'rgba(15, 23, 42, 0.85)'}
              stroke="#60a5fa"
              strokeWidth="2"
            />
            <text x="42" y="38" fill="#dbeafe" fontSize="16" fontWeight="800">
              {teamAName.slice(0, 24)} (Trái: -{safeTarget})
            </text>

            <rect
              x="721"
              y="14"
              width="255"
              height="38"
              rx="10"
              fill={winner === 'B' ? '#c2410c' : 'rgba(15, 23, 42, 0.85)'}
              stroke="#fb923c"
              strokeWidth="2"
            />
            <text x="958" y="38" textAnchor="end" fill="#ffedd5" fontSize="16" fontWeight="800">
              {teamBName.slice(0, 24)} (Phải: +{safeTarget})
            </text>
          </>
        ) : (
          <>
            <rect
              x="24"
              y="14"
              width="340"
              height="38"
              rx="10"
              fill="rgba(15, 23, 42, 0.85)"
              stroke="#60a5fa"
              strokeWidth="2"
            />
            <text x="42" y="38" fill="#dbeafe" fontSize="16" fontWeight="800">
              Tự luyện: {soloName.slice(0, 24)} · Đạt {ropePosition}/{safeTarget} vạch
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

// ============================================================================
// MAIN THREE.JS 3D TUG-OF-WAR ARENA
// ============================================================================

export const TugOfWar3DScene: React.FC<TugOfWar3DSceneProps> = (props) => {
  const {
    mode,
    teamAName,
    teamBName,
    soloName,
    ropePosition,
    winTarget,
    lastDelta,
    pullEventId,
    skipToken,
    reducedMotion,
    force2D,
    compactView,
    matchStatus,
    winner,
    onPullSettled,
    onWebGLFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Refs synced to animation loop (avoid recreating WebGL context on turn changes)
  const targetPosRef = useRef<number>(ropePosition);
  const currentPosRef = useRef<number>(ropePosition);
  const winTargetRef = useRef<number>(Math.max(1, winTarget));
  const lastDeltaRef = useRef<number>(lastDelta);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const winnerRef = useRef<WinnerSide>(winner);
  const modeRef = useRef<TugMode>(mode);
  const onPullSettledRef = useRef<(() => void) | undefined>(onPullSettled);
  const pendingPullSettleRef = useRef<boolean>(false);
  const pullBurstTimeRef = useRef<number>(0);

  useEffect(() => {
    targetPosRef.current = ropePosition;
    winTargetRef.current = Math.max(1, winTarget);
    lastDeltaRef.current = lastDelta;
    reducedMotionRef.current = reducedMotion;
    winnerRef.current = winner;
    modeRef.current = mode;
    onPullSettledRef.current = onPullSettled;
  }, [ropePosition, winTarget, lastDelta, reducedMotion, winner, mode, onPullSettled]);

  // Trigger pull animation flag when a new turn commits
  useEffect(() => {
    if (pullEventId <= 0) return;
    if (reducedMotionRef.current || Math.abs(currentPosRef.current - targetPosRef.current) < 0.005) {
      currentPosRef.current = targetPosRef.current;
      pendingPullSettleRef.current = false;
      onPullSettledRef.current?.();
      return;
    }
    pendingPullSettleRef.current = true;
    pullBurstTimeRef.current = 1.0;
  }, [pullEventId]);

  // Immediately snap on "Bỏ qua hoạt ảnh"
  useEffect(() => {
    if (skipToken <= 0) return;
    currentPosRef.current = targetPosRef.current;
    pullBurstTimeRef.current = 0;
    if (pendingPullSettleRef.current) {
      pendingPullSettleRef.current = false;
      onPullSettledRef.current?.();
    }
  }, [skipToken]);

  // Fallback immediately if user toggled 2D or WebGL failed
  const use2DFallback = force2D || webglFailed;

  useEffect(() => {
    if (use2DFallback) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let rafId: number | null = null;
    let timerId: number | null = null;

    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(170, container.clientHeight || 280);

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      setWebglFailed(true);
      onWebGLFallback?.();
      return;
    }

    // Software WebGL detection (per Three.js skill directive)
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa/i.test(rendererStr);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (!disposed) {
        setWebglFailed(true);
        onWebGLFallback?.();
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & Fog (deep navy stadium night horizon)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1528);
    scene.fog = new THREE.Fog(0x0b1528, 22, 54);

    // Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    // Symmetrical front-elevated camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 5.2, 13.4);
    camera.lookAt(0, 0.85, 0);

    // Three-point outdoor stadium lighting
    const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x0b3a2e, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4df, 1.55);
    keyLight.position.set(7.5, 14, 9.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 36;
      keyLight.shadow.camera.left = -12;
      keyLight.shadow.camera.right = 12;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.bias = -0.0008;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.55);
    rimLight.position.set(-8, 7, -9);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [envTex, pmrem];
    const sharedMaterials: THREE.Material[] = [];

    // Ground Apron (dark athletic track surrounding turf)
    const apronGeo = new THREE.PlaneGeometry(54, 34);
    const apronMat = new THREE.MeshStandardMaterial({
      color: 0x10203a,
      roughness: 0.9,
      metalness: 0.05,
    });
    const apron = new THREE.Mesh(apronGeo, apronMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.y = -0.02;
    scene.add(apron);
    disposables.push(apronGeo, apronMat);

    // Main Turf Field with crisp procedural distance lines
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const turfTex = createTurfTexture(mode, Math.max(1, winTarget), maxAniso);
    const turfGeo = new THREE.PlaneGeometry(18, 9);
    const turfMat = new THREE.MeshStandardMaterial({
      map: turfTex,
      roughness: 0.84,
      metalness: 0.02,
    });
    const turf = new THREE.Mesh(turfGeo, turfMat);
    turf.rotation.x = -Math.PI / 2;
    turf.receiveShadow = true;
    scene.add(turf);
    disposables.push(turfTex, turfGeo, turfMat);

    // 3D Win Boundary Pylons (Left Cobalt / Right Coral or Solo Gold)
    const spanHalfWorld = 18 * 0.28; // matches 0.28 of 18 world units = 5.04 units
    const pylonGeo = new THREE.CylinderGeometry(0.11, 0.14, 1.35, 12);
    const coneGeo = new THREE.SphereGeometry(0.16, 12, 10);
    const leftPylonMat = new THREE.MeshStandardMaterial({
      color: TEAM_A_HEX,
      roughness: 0.35,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.28,
    });
    const rightPylonMat = new THREE.MeshStandardMaterial({
      color: mode === 'two_teams' ? TEAM_B_HEX : GOLD_HEX,
      roughness: 0.35,
      emissive: mode === 'two_teams' ? 0xc2410c : 0xd97706,
      emissiveIntensity: 0.28,
    });
    const centerPylonMat = new THREE.MeshStandardMaterial({
      color: GOLD_HEX,
      roughness: 0.3,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
    });
    disposables.push(pylonGeo, coneGeo, leftPylonMat, rightPylonMat, centerPylonMat);

    const placePylonPair = (xPos: number, mat: THREE.Material) => {
      [-3.45, 3.45].forEach((zPos) => {
        const post = new THREE.Mesh(pylonGeo, mat);
        post.position.set(xPos, 0.675, zPos);
        post.castShadow = true;
        scene.add(post);

        const cap = new THREE.Mesh(coneGeo, mat);
        cap.position.set(xPos, 1.4, zPos);
        scene.add(cap);
      });
    };

    if (mode === 'two_teams') {
      placePylonPair(-spanHalfWorld, leftPylonMat);
      placePylonPair(0, centerPylonMat);
      placePylonPair(spanHalfWorld, rightPylonMat);
    } else {
      placePylonPair(-18 * 0.22, leftPylonMat);
      placePylonPair(18 * 0.22, rightPylonMat);
    }

    // Background Stadium Stands & Floodlight Towers (atmospheric silhouette)
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x172947,
      roughness: 0.8,
      metalness: 0.12,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x334e7b,
      roughness: 0.5,
      metalness: 0.35,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    disposables.push(standMat, railMat, lampMat);

    for (let tier = 0; tier < 3; tier++) {
      const benchGeo = new THREE.BoxGeometry(22, 0.55, 1.1);
      const bench = new THREE.Mesh(benchGeo, standMat);
      bench.position.set(0, 0.4 + tier * 0.62, -6.2 - tier * 1.15);
      scene.add(bench);
      disposables.push(benchGeo);
    }

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.6, 10);
    const lampHeadGeo = new THREE.BoxGeometry(1.4, 0.42, 0.32);
    disposables.push(poleGeo, lampHeadGeo);
    [-7.8, 7.8].forEach((px) => {
      const pole = new THREE.Mesh(poleGeo, railMat);
      pole.position.set(px, 3.8, -7.8);
      scene.add(pole);

      const head = new THREE.Mesh(lampHeadGeo, lampMat);
      head.position.set(px, 7.6, -7.55);
      head.rotation.x = 0.28;
      scene.add(head);
    });

    // Moving Tug Group (Rope + Center Ribbon + Athletes shift together cleanly)
    const tugAssembly = new THREE.Group();
    scene.add(tugAssembly);

    // Braided Hemp Rope
    const ropeTex = createRopeTexture(maxAniso);
    const ropeGeo = new THREE.CylinderGeometry(0.088, 0.088, 12.6, 14, 1);
    ropeGeo.rotateZ(Math.PI / 2);
    const ropeMat = new THREE.MeshStandardMaterial({
      map: ropeTex,
      roughness: 0.88,
      metalness: 0.04,
    });
    const ropeMesh = new THREE.Mesh(ropeGeo, ropeMat);
    ropeMesh.position.y = 1.05;
    ropeMesh.castShadow = true;
    tugAssembly.add(ropeMesh);
    disposables.push(ropeTex, ropeGeo, ropeMat);

    // Center Satin Ribbon Knot & Tail
    const ribbonGroup = new THREE.Group();
    ribbonGroup.position.set(0, 1.05, 0);
    tugAssembly.add(ribbonGroup);

    const knotGeo = new THREE.TorusGeometry(0.13, 0.055, 10, 18);
    knotGeo.rotateY(Math.PI / 2);
    const knotMat = new THREE.MeshStandardMaterial({
      color: GOLD_HEX,
      roughness: 0.3,
      metalness: 0.45,
      emissive: 0xb45309,
      emissiveIntensity: 0.2,
    });
    const knot = new THREE.Mesh(knotGeo, knotMat);
    ribbonGroup.add(knot);

    const ribbonTailGeo = new THREE.BoxGeometry(0.24, 0.72, 0.045);
    const ribbonTailMat = new THREE.MeshStandardMaterial({
      color: RIBBON_HEX,
      roughness: 0.4,
      metalness: 0.1,
      emissive: 0x991b1b,
      emissiveIntensity: 0.22,
    });
    const ribbonTail = new THREE.Mesh(ribbonTailGeo, ribbonTailMat);
    ribbonTail.position.set(0, -0.4, 0);
    ribbonTail.castShadow = true;
    ribbonGroup.add(ribbonTail);
    disposables.push(knotGeo, knotMat, ribbonTailGeo, ribbonTailMat);

    // Representative Composite Student Athletes (3 per side in 2-team, 3 pulling right in solo)
    const athletes: AthleteRig[] = [];

    if (mode === 'two_teams') {
      [-2.15, -3.45, -4.75].forEach((ax, idx) => {
        const ath = createStudentAthlete(
          TEAM_A_HEX,
          TEAM_A_ACCENT,
          'left',
          ax,
          idx % 2 === 0 ? 0.16 : -0.16,
          idx * 0.85,
          sharedMaterials
        );
        tugAssembly.add(ath.root);
        athletes.push(ath);
      });

      [2.15, 3.45, 4.75].forEach((bx, idx) => {
        const ath = createStudentAthlete(
          TEAM_B_HEX,
          TEAM_B_ACCENT,
          'right',
          bx,
          idx % 2 === 0 ? -0.16 : 0.16,
          idx * 0.85 + 0.4,
          sharedMaterials
        );
        tugAssembly.add(ath.root);
        athletes.push(ath);
      });
    } else {
      // Solo practice: Weighted knowledge sled on left, 3 students pulling right toward Gold Goal
      const sledGeo = new THREE.BoxGeometry(0.95, 0.82, 0.88);
      const sledMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.45,
        metalness: 0.35,
      });
      const sled = new THREE.Mesh(sledGeo, sledMat);
      sled.position.set(-2.6, 0.42, 0);
      sled.castShadow = true;
      tugAssembly.add(sled);

      const sledTrimGeo = new THREE.BoxGeometry(1.0, 0.14, 0.92);
      const sledTrim = new THREE.Mesh(sledTrimGeo, centerPylonMat);
      sledTrim.position.set(-2.6, 0.86, 0);
      tugAssembly.add(sledTrim);
      disposables.push(sledGeo, sledMat, sledTrimGeo);

      [1.85, 3.15, 4.45].forEach((bx, idx) => {
        const ath = createStudentAthlete(
          TEAM_A_HEX,
          TEAM_A_ACCENT,
          'right',
          bx,
          idx % 2 === 0 ? -0.16 : 0.16,
          idx * 0.85,
          sharedMaterials
        );
        tugAssembly.add(ath.root);
        athletes.push(ath);
      });
    }

    // ResizeObserver for clean responsive framing
    const handleResize = () => {
      if (disposed || !renderer || !container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(160, container.clientHeight);
      camera.aspect = w / h;
      // Slightly widen framing on compact/ultrawide strips so both win lines stay visible
      camera.fov = w / h > 3.2 ? 32 : 36;
      camera.position.set(0, w / h > 3.2 ? 5.6 : 5.2, w / h > 3.2 ? 14.8 : 13.4);
      camera.lookAt(0, 0.85, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    // Map logical ropePosition -> world X coordinates matching turf markings
    const logicalToWorldX = (logicalPos: number): number => {
      const target = Math.max(1, winTargetRef.current);
      if (modeRef.current === 'two_teams') {
        return (logicalPos / target) * spanHalfWorld;
      }
      const soloStart = -18 * 0.22;
      const soloEnd = 18 * 0.22;
      return soloStart + (logicalPos / target) * (soloEnd - soloStart);
    };

    // Initialize position immediately
    currentPosRef.current = targetPosRef.current;
    tugAssembly.position.x = logicalToWorldX(currentPosRef.current);

    let lastTime = performance.now();
    let elapsed = 0;

    const renderFrame = (now: number) => {
      if (disposed || !renderer) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      const targetPos = targetPosRef.current;
      const diff = targetPos - currentPosRef.current;

      if (reducedMotionRef.current || Math.abs(diff) <= 0.008) {
        currentPosRef.current = targetPos;
        if (pendingPullSettleRef.current) {
          pendingPullSettleRef.current = false;
          onPullSettledRef.current?.();
        }
      } else {
        currentPosRef.current = THREE.MathUtils.damp(currentPosRef.current, targetPos, 6.2, dt);
      }

      const isPullingNow = Math.abs(targetPos - currentPosRef.current) > 0.015;
      pullBurstTimeRef.current = THREE.MathUtils.damp(
        pullBurstTimeRef.current,
        isPullingNow ? 1 : 0,
        5.5,
        dt
      );
      const strain = reducedMotionRef.current ? 0 : pullBurstTimeRef.current;

      // Apply exact rope + athletes X shift
      tugAssembly.position.x = logicalToWorldX(currentPosRef.current);

      // Subtle rope vertical taut bounce during pull
      ropeMesh.position.y = 1.05 + Math.sin(elapsed * 18) * 0.018 * strain;
      ribbonGroup.position.y = ropeMesh.position.y;
      ribbonGroup.rotation.z =
        Math.sin(elapsed * 3.2) * 0.06 +
        (isPullingNow ? -Math.sign(diff) * 0.28 * strain : 0);

      // Synchronized athlete kinematics (lean back & pull heave, celebrate on win)
      const currentWinner = winnerRef.current;
      for (const ath of athletes) {
        const isWinningSide =
          (currentWinner === 'A' && ath.side === 'left') ||
          (currentWinner === 'B' && ath.side === 'right') ||
          (currentWinner === 'solo' && ath.side === 'right');

        if (isWinningSide && !reducedMotionRef.current) {
          const hop = Math.abs(Math.sin(elapsed * 6.5 + ath.phaseOffset)) * 0.28;
          ath.root.position.y = hop;
          ath.bodyPivot.rotation.z = 0;
          ath.leftArm.rotation.z = ath.side === 'left' ? 0.55 : -0.55;
          ath.rightArm.rotation.z = ath.side === 'left' ? 0.55 : -0.55;
        } else {
          ath.root.position.y = 0;
          const baseLean = ath.side === 'left' ? 0.24 : -0.24;
          const heave = Math.sin(elapsed * 11 + ath.phaseOffset) * 0.14 * strain;
          const idleBreath = reducedMotionRef.current
            ? 0
            : Math.sin(elapsed * 2.2 + ath.phaseOffset) * 0.025;
          ath.bodyPivot.rotation.z = baseLean + (ath.side === 'left' ? heave : -heave) + idleBreath;

          const brace = Math.sin(elapsed * 11 + ath.phaseOffset) * 0.16 * strain;
          ath.leftLeg.rotation.z = brace;
          ath.rightLeg.rotation.z = -brace;
          ath.leftArm.rotation.z = 0;
          ath.rightArm.rotation.z = 0;
        }
      }

      renderer.render(scene, camera);

      if (!disposed) {
        if (isSoftwareGl) {
          timerId = window.setTimeout(() => {
            if (!disposed) renderFrame(performance.now());
          }, 55);
        } else {
          rafId = window.requestAnimationFrame(renderFrame);
        }
      }
    };

    if (isSoftwareGl) {
      renderFrame(performance.now());
    } else {
      rafId = window.requestAnimationFrame(renderFrame);
    }

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (timerId !== null) window.clearTimeout(timerId);
      renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          // Ignore
        }
      });
      sharedMaterials.forEach((m) => {
        try {
          m.dispose();
        } catch {
          // Ignore
        }
      });
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          try {
            mesh.geometry.dispose();
          } catch {
            // Ignore
          }
        }
      });
      renderer?.dispose();
    };
  }, [use2DFallback, mode, winTarget, onWebGLFallback]);

  if (use2DFallback) {
    return (
      <TugOfWar2DFallback
        mode={mode}
        teamAName={teamAName}
        teamBName={teamBName}
        soloName={soloName}
        ropePosition={ropePosition}
        winTarget={winTarget}
        compactView={compactView}
        matchStatus={matchStatus}
        winner={winner}
        reducedMotion={reducedMotion}
      />
    );
  }

  const safeTarget = Math.max(1, winTarget);
  const posText =
    mode === 'two_teams'
      ? ropePosition === 0
        ? 'Cân bằng (0)'
        : ropePosition < 0
          ? `Lệch về ${teamAName}: ${ropePosition} / -${safeTarget}`
          : `Lệch về ${teamBName}: +${ropePosition} / +${safeTarget}`
      : `Tiến độ: ${ropePosition} / ${safeTarget} vạch`;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0B1528] select-none ${
        compactView ? 'h-[176px] sm:h-[205px]' : 'h-[268px] sm:h-[320px] xl:h-[348px]'
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Clean non-blur perimeter HUD plaques (zero backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute inset-x-3 top-2.5 flex items-center justify-between gap-2">
        {mode === 'two_teams' ? (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-blue-400/60 bg-slate-950/88 px-2.5 py-1 text-xs sm:text-sm font-bold text-blue-100 shadow-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
              <span className="truncate max-w-[140px] sm:max-w-[220px]">{teamAName}</span>
              <span className="font-mono text-blue-300">−{safeTarget}</span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-slate-950/90 px-3 py-1 text-xs font-bold text-amber-200">
              <span>{posText}</span>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-orange-400/60 bg-slate-950/88 px-2.5 py-1 text-xs sm:text-sm font-bold text-orange-100 shadow-sm">
              <span className="font-mono text-orange-300">+{safeTarget}</span>
              <span className="truncate max-w-[140px] sm:max-w-[220px]">{teamBName}</span>
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-500" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-blue-400/60 bg-slate-950/88 px-3 py-1 text-xs sm:text-sm font-bold text-blue-100">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />
              <span className="truncate max-w-[220px]">{soloName}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-amber-400/60 bg-slate-950/90 px-3 py-1 text-xs sm:text-sm font-bold text-amber-200">
              <span>{posText}</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom compact notch track bar for crystal-clear projection from back of class */}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-center justify-center">
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/90 bg-slate-950/88 px-2.5 py-1 text-[11px] font-bold text-slate-200">
          {mode === 'two_teams'
            ? Array.from({ length: safeTarget * 2 + 1 }, (_, i) => i - safeTarget).map((notch) => {
                const active = notch === ropePosition;
                const isWinA = notch === -safeTarget;
                const isWinB = notch === safeTarget;
                const isZero = notch === 0;
                return (
                  <span
                    key={notch}
                    className={`inline-flex h-5 min-w-[22px] items-center justify-center rounded px-1 font-mono transition-colors ${
                      active
                        ? 'bg-red-600 text-white ring-2 ring-amber-300'
                        : isWinA
                          ? 'bg-blue-900/90 text-blue-200'
                          : isWinB
                            ? 'bg-orange-900/90 text-orange-200'
                            : isZero
                              ? 'bg-amber-900/70 text-amber-200'
                              : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {notch > 0 ? `+${notch}` : notch}
                  </span>
                );
              })
            : Array.from({ length: safeTarget + 1 }, (_, i) => i).map((notch) => {
                const active = notch === ropePosition;
                const reached = notch < ropePosition;
                return (
                  <span
                    key={notch}
                    className={`inline-flex h-5 min-w-[24px] items-center justify-center rounded px-1 font-mono ${
                      active
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-white'
                        : reached
                          ? 'bg-emerald-700 text-emerald-100'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {notch}
                  </span>
                );
              })}
        </div>
      </div>
    </div>
  );
};

export default TugOfWar3DScene;
