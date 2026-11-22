import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Flag, Trophy } from 'lucide-react';
import { BoatTeamStanding, D02_STEP_METERS } from './boatRace3dEngine';

export interface BoatRace3DSceneProps {
  standings: BoatTeamStanding[];
  targetMeters: number;
  reducedMotion: boolean;
  skipAnimationTrigger: number;
  force2D: boolean;
  isFullscreen?: boolean;
  onWebGLFallback?: () => void;
}

const START_X = -8.6;
const FINISH_X = 8.6;
const TRACK_LEN = FINISH_X - START_X; // 17.2 world units

function distanceToBowX(displayMeters: number, targetMeters: number): number {
  const safeTarget = Math.max(D02_STEP_METERS, targetMeters);
  const ratio = Math.max(0, Math.min(1, displayMeters / safeTarget));
  return START_X + ratio * TRACK_LEN;
}

function getLaneZ(laneIndex: number, laneCount: number, laneSpacing: number): number {
  return (laneIndex - (laneCount - 1) / 2) * laneSpacing;
}

function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

interface BoatActor {
  teamId: string;
  laneIndex: number;
  group: THREE.Group;
  wakeMesh: THREE.Mesh;
  wakeMaterial: THREE.MeshBasicMaterial;
  flagMesh: THREE.Mesh;
  currentX: number;
  targetX: number;
  baseZ: number;
}

/**
 * Builds a sleek 6-part 3D racing boat whose EXACT bow tip sits at local x = 0.
 * That guarantees mathematically identical bow alignment whenever two boats have equal meters!
 */
function createRacingBoatMesh(colorHex: string): {
  group: THREE.Group;
  wakeMesh: THREE.Mesh;
  wakeMaterial: THREE.MeshBasicMaterial;
  flagMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  const teamColor = new THREE.Color(colorHex);

  const hullWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.12,
  });
  const navyTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.36,
    metalness: 0.24,
  });
  const teamPaintMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.3,
    metalness: 0.18,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.12,
    metalness: 0.45,
    emissive: 0x0369a1,
    emissiveIntensity: 0.18,
  });

  // 1. Main white hull body (extends from x = -2.25 to x = -0.55)
  const hullGeo = new THREE.BoxGeometry(1.7, 0.34, 0.72);
  const hullMesh = new THREE.Mesh(hullGeo, hullWhiteMat);
  hullMesh.position.set(-1.4, 0.19, 0);
  hullMesh.castShadow = true;
  hullMesh.receiveShadow = true;
  group.add(hullMesh);

  // 2. Pointed bow cone whose exact tip sits at local x = 0.0
  const bowGeo = new THREE.ConeGeometry(0.42, 0.62, 4);
  bowGeo.rotateY(Math.PI / 4);
  bowGeo.rotateZ(-Math.PI / 2);
  const bowMesh = new THREE.Mesh(bowGeo, teamPaintMat);
  bowMesh.scale.set(1, 0.56, 1.18);
  bowMesh.position.set(-0.31, 0.21, 0);
  bowMesh.castShadow = true;
  group.add(bowMesh);

  // 3. Side team racing stripes + navy rub rail
  const stripeGeo = new THREE.BoxGeometry(1.66, 0.1, 0.76);
  const stripeMesh = new THREE.Mesh(stripeGeo, teamPaintMat);
  stripeMesh.position.set(-1.38, 0.27, 0);
  group.add(stripeMesh);

  const deckGeo = new THREE.BoxGeometry(1.56, 0.08, 0.62);
  const deckMesh = new THREE.Mesh(deckGeo, navyTrimMat);
  deckMesh.position.set(-1.42, 0.38, 0);
  group.add(deckMesh);

  // 4. Aerodynamic cockpit cabin + tinted windshield
  const cabinGeo = new THREE.BoxGeometry(0.76, 0.28, 0.5);
  const cabinMesh = new THREE.Mesh(cabinGeo, hullWhiteMat);
  cabinMesh.position.set(-1.32, 0.54, 0);
  cabinMesh.castShadow = true;
  group.add(cabinMesh);

  const windshieldGeo = new THREE.BoxGeometry(0.26, 0.21, 0.44);
  const windshieldMesh = new THREE.Mesh(windshieldGeo, glassMat);
  windshieldMesh.position.set(-0.92, 0.54, 0);
  windshieldMesh.rotation.z = -0.35;
  group.add(windshieldMesh);

  // 5. Aft mast + triangular team pennant flag
  const mastGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.92, 8);
  const mastMesh = new THREE.Mesh(mastGeo, hullWhiteMat);
  mastMesh.position.set(-2.02, 0.78, 0);
  group.add(mastMesh);

  const flagShape = new THREE.Shape();
  flagShape.moveTo(0, 0.24);
  flagShape.lineTo(-0.56, 0.09);
  flagShape.lineTo(0, -0.06);
  flagShape.closePath();
  const flagGeo = new THREE.ShapeGeometry(flagShape);
  const flagMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.38,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const flagMesh = new THREE.Mesh(flagGeo, flagMat);
  flagMesh.position.set(-2.03, 1.0, 0);
  group.add(flagMesh);

  // 6. Gentle V-shaped water wake (visible ONLY while advancing!)
  const wakeShape = new THREE.Shape();
  wakeShape.moveTo(0, 0);
  wakeShape.lineTo(-1.85, 0.52);
  wakeShape.lineTo(-1.55, 0);
  wakeShape.lineTo(-1.85, -0.52);
  wakeShape.closePath();
  const wakeGeo = new THREE.ShapeGeometry(wakeShape);
  wakeGeo.rotateX(-Math.PI / 2);
  const wakeMaterial = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const wakeMesh = new THREE.Mesh(wakeGeo, wakeMaterial);
  wakeMesh.position.set(-2.22, 0.035, 0);
  wakeMesh.visible = false;
  group.add(wakeMesh);

  return { group, wakeMesh, wakeMaterial, flagMesh };
}

/**
 * Lightweight 2D River-Lane Track — crisp projector fallback & explicit low-spec mode.
 */
export const BoatRace2DTrack: React.FC<{
  standings: BoatTeamStanding[];
  targetMeters: number;
  reducedMotion: boolean;
}> = ({ standings, targetMeters, reducedMotion }) => {
  const orderedByLane = useMemo(
    () => [...standings].sort((a, b) => a.laneIndex - b.laneIndex),
    [standings]
  );

  const ticks = useMemo(() => {
    const safeTarget = Math.max(D02_STEP_METERS, targetMeters);
    const count = Math.floor(safeTarget / D02_STEP_METERS);
    const step = count > 10 ? 2 : 1;
    const out: number[] = [];
    for (let i = 0; i <= count; i += step) {
      out.push(i * D02_STEP_METERS);
    }
    if (out[out.length - 1] !== safeTarget) out.push(safeTarget);
    return out;
  }, [targetMeters]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-teal-800/70 bg-gradient-to-b from-[#0b4f5c] via-[#0c6b78] to-[#083e4a] shadow-inner">
      {/* Top grassy bank & distance scale */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-800 px-3 sm:px-4 py-2 border-b border-emerald-500/40 flex items-center justify-between gap-2 text-xs font-bold text-emerald-50">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-white" />
          <span>Xuất phát · 0 m</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-emerald-100/90">
          <span>Đường đua tri thức (Chế độ 2D nhẹ)</span>
        </div>
        <div className="flex items-center gap-1.5 text-amber-200">
          <Flag className="w-3.5 h-3.5" />
          <span>Đích · {targetMeters} m</span>
        </div>
      </div>

      {/* Distance markers ruler */}
      <div className="relative h-6 mx-3 sm:mx-4 mt-1.5 mb-0.5 select-none">
        {ticks.map((m) => {
          const pct = Math.min(100, Math.max(0, (m / Math.max(100, targetMeters)) * 100));
          return (
            <div
              key={m}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <span className="text-[10px] font-bold text-cyan-100/85 tabular-nums whitespace-nowrap">
                {m}m
              </span>
            </div>
          );
        })}
      </div>

      {/* Parallel equal-length lanes */}
      <div className="px-3 sm:px-4 pb-3 space-y-2">
        {orderedByLane.map((row) => {
          const pct = Math.min(100, Math.max(0, (row.displayMeters / Math.max(100, targetMeters)) * 100));
          return (
            <div
              key={row.teamId}
              className="relative rounded-xl bg-cyan-950/55 border border-cyan-400/25 px-3 py-2 overflow-hidden"
            >
              {/* Subtle vertical 100 m lane gridlines */}
              <div className="pointer-events-none absolute inset-0 mx-3">
                {ticks.map((m) => {
                  const tp = Math.min(100, Math.max(0, (m / Math.max(100, targetMeters)) * 100));
                  return (
                    <div
                      key={m}
                      className={`absolute top-0 bottom-0 w-px ${
                        m === targetMeters
                          ? 'bg-amber-300/80 w-0.5'
                          : 'bg-cyan-200/15'
                      }`}
                      style={{ left: `${tp}%` }}
                    />
                  );
                })}
              </div>

              {/* Lane header: Lane # + Color + Name + Exact meters */}
              <div className="relative z-10 flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-extrabold text-white shrink-0 shadow-sm"
                    style={{ backgroundColor: row.colorHex }}
                  >
                    {row.laneIndex + 1}
                  </span>
                  <span className="text-sm font-bold text-white truncate">
                    {row.name}
                  </span>
                  {row.finished && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-extrabold shrink-0">
                      <Trophy className="w-3 h-3" />
                      Về đích
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm font-extrabold text-cyan-50 tabular-nums shrink-0">
                  {row.displayMeters} m
                  <span className="text-cyan-200/80 font-semibold">
                    {' '}/ {targetMeters} m
                    {row.remainingMeters > 0 ? ` · còn ${row.remainingMeters} m` : ''}
                  </span>
                </div>
              </div>

              {/* River lane track bar with boat bow aligned strictly at pct% */}
              <div className="relative z-10 h-5 rounded-full bg-cyan-900/70 border border-cyan-300/20 overflow-visible">
                {/* Water wake fill */}
                <div
                  className={`h-full rounded-full ${
                    reducedMotion ? '' : 'transition-all duration-500 ease-out'
                  }`}
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, rgba(255,255,255,0.12) 0%, ${row.colorHex}cc 100%)`,
                  }}
                />
                {/* Boat hull icon whose right bow edge aligns exactly to pct% */}
                <div
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-full flex items-center ${
                    reducedMotion ? '' : 'transition-all duration-500 ease-out'
                  }`}
                  style={{ left: `${Math.max(4, pct)}%` }}
                  aria-label={`${row.name}: ${row.displayMeters} mét`}
                >
                  <div
                    className="h-4 px-2.5 rounded-l-md rounded-r-full border border-white/80 shadow-md flex items-center justify-end"
                    style={{ backgroundColor: row.colorHex }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const BoatRace3DScene: React.FC<BoatRace3DSceneProps> = ({
  standings,
  targetMeters,
  reducedMotion,
  skipAnimationTrigger,
  force2D,
  isFullscreen = false,
  onWebGLFallback,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState<boolean>(() => !isWebGLAvailable());
  const actorsRef = useRef<Map<string, BoatActor>>(new Map());
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  const laneKey = useMemo(
    () =>
      [...standings]
        .sort((a, b) => a.laneIndex - b.laneIndex)
        .map((s) => `${s.teamId}:${s.laneIndex}:${s.colorHex}`)
        .join('|'),
    [standings]
  );

  // Sync latest target bow positions into live 3D boat actors
  useEffect(() => {
    for (const row of standings) {
      const actor = actorsRef.current.get(row.teamId);
      if (!actor) continue;
      const nextX = distanceToBowX(row.displayMeters, targetMeters);
      actor.targetX = nextX;
      if (reducedMotionRef.current) {
        actor.currentX = nextX;
        actor.group.position.x = nextX;
        actor.wakeMesh.visible = false;
        actor.wakeMaterial.opacity = 0;
      }
    }
  }, [standings, targetMeters]);

  // Immediate snap when teacher clicks "Bỏ qua hoạt ảnh"
  useEffect(() => {
    if (skipAnimationTrigger <= 0) return;
    actorsRef.current.forEach((actor) => {
      actor.currentX = actor.targetX;
      actor.group.position.x = actor.targetX;
      actor.group.position.y = 0.04;
      actor.group.rotation.z = 0;
      actor.wakeMesh.visible = false;
      actor.wakeMaterial.opacity = 0;
    });
  }, [skipAnimationTrigger]);

  // Build & manage Three.js river course
  useEffect(() => {
    if (force2D || webglFailed) return;
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let pmremGenerator: THREE.PMREMGenerator | null = null;
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;
    let rafId = 0;
    let disposed = false;

    const orderedTeams = [...standings].sort((a, b) => a.laneIndex - b.laneIndex);
    const laneCount = Math.max(1, orderedTeams.length);
    const laneSpacing = laneCount <= 2 ? 2.1 : laneCount <= 4 ? 1.72 : 1.48;
    const riverWidth = Math.max(4.8, laneCount * laneSpacing + 1.5);

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

    const glCtx = renderer.getContext();
    let isSoftwareGl = false;
    try {
      const dbg = glCtx.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        const str = String(glCtx.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
        isSoftwareGl = /swiftshader|llvmpipe|mesa/i.test(str);
      }
    } catch {
      isSoftwareGl = false;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1.15 : 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(210, container.clientHeight);
    renderer.setSize(width, height, false);
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

    // Scene & bright daylight river sky
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c344d);
    scene.fog = new THREE.Fog(0x0d4059, 32, 62);

    try {
      pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRenderTarget.texture;
      roomEnv.dispose();
    } catch {
      // Proceed cleanly with direct lights
    }

    // Elevated angled camera showing all lanes cleanly with identical length perception
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.2, 120);
    const camDistZ = 11.4 + Math.max(0, laneCount - 3) * 1.15;
    const camHeightY = 7.4 + Math.max(0, laneCount - 3) * 0.78;
    camera.position.set(0.35, camHeightY, camDistZ);
    camera.lookAt(0.15, 0.15, -0.15);

    // Balanced daylight 3-point lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f5132, 0.95);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.35);
    sunLight.position.set(10, 18, 12);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.left = -15;
      sunLight.shadow.camera.right = 15;
      sunLight.shadow.camera.top = 12;
      sunLight.shadow.camera.bottom = -12;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.45);
    rimLight.position.set(-14, 7, -10);
    scene.add(rimLight);

    // 1. Turquoise-emerald river water surface
    const waterGeo = new THREE.PlaneGeometry(34, riverWidth + 0.6, 28, 12);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0d8e98,
      roughness: 0.24,
      metalness: 0.18,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, 0, 0);
    waterMesh.receiveShadow = true;
    scene.add(waterMesh);

    // Subtle deeper river center sheen strip
    const deepWaterGeo = new THREE.PlaneGeometry(34, riverWidth * 0.72);
    deepWaterGeo.rotateX(-Math.PI / 2);
    const deepWaterMat = new THREE.MeshStandardMaterial({
      color: 0x0b7b86,
      roughness: 0.2,
      metalness: 0.22,
    });
    const deepWaterMesh = new THREE.Mesh(deepWaterGeo, deepWaterMat);
    deepWaterMesh.position.set(0, 0.005, 0);
    scene.add(deepWaterMesh);

    // 2. Manicured grassy riverbanks + white stone quay edges
    const bankMat = new THREE.MeshStandardMaterial({
      color: 0x1e9665,
      roughness: 0.85,
      metalness: 0.02,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.55,
      metalness: 0.05,
    });

    const bankWidth = 7.5;
    const farBankZ = -(riverWidth / 2 + bankWidth / 2);
    const nearBankZ = riverWidth / 2 + bankWidth / 2;

    const bankGeo = new THREE.BoxGeometry(36, 0.55, bankWidth);
    const farBank = new THREE.Mesh(bankGeo, bankMat);
    farBank.position.set(0, 0.12, farBankZ);
    farBank.receiveShadow = true;
    scene.add(farBank);

    const nearBank = new THREE.Mesh(bankGeo, bankMat);
    nearBank.position.set(0, 0.12, nearBankZ);
    nearBank.receiveShadow = true;
    scene.add(nearBank);

    const curbGeo = new THREE.BoxGeometry(36, 0.36, 0.38);
    const farCurb = new THREE.Mesh(curbGeo, curbMat);
    farCurb.position.set(0, 0.22, -(riverWidth / 2 + 0.16));
    scene.add(farCurb);

    const nearCurb = new THREE.Mesh(curbGeo, curbMat);
    nearCurb.position.set(0, 0.22, riverWidth / 2 + 0.16);
    scene.add(nearCurb);

    // Grounded stylized trees along the far bank
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7c4a2d, roughness: 0.9 });
    const foliageMatA = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 });
    const foliageMatB = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.75 });
    const treeXs = [-11.8, -7.2, -3.1, 1.4, 5.2, 10.6];
    treeXs.forEach((tx, idx) => {
      const tz = -(riverWidth / 2 + 2.0 + (idx % 2) * 1.15);
      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.72, 7), trunkMat);
      trunk.position.set(0, 0.72, 0);
      treeGroup.add(trunk);
      const crown1 = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 1.25, 8),
        idx % 2 === 0 ? foliageMatA : foliageMatB
      );
      crown1.position.set(0, 1.48, 0);
      crown1.castShadow = true;
      treeGroup.add(crown1);
      const crown2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.95, 8),
        idx % 2 === 0 ? foliageMatB : foliageMatA
      );
      crown2.position.set(0, 2.05, 0);
      treeGroup.add(crown2);
      treeGroup.position.set(tx, 0, tz);
      scene.add(treeGroup);
    });

    // 3. Parallel equal-length floating lane buoy ropes
    const ropeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.45,
      metalness: 0.08,
    });
    const buoyWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32 });
    const buoyTealMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.32 });
    const ropeGeo = new THREE.CylinderGeometry(0.025, 0.025, TRACK_LEN + 1.8, 6);
    ropeGeo.rotateZ(Math.PI / 2);
    const buoyGeo = new THREE.SphereGeometry(0.095, 10, 8);

    const dividerCount = laneCount + 1;
    for (let d = 0; d < dividerCount; d++) {
      const z = (d - laneCount / 2) * laneSpacing;
      const rope = new THREE.Mesh(ropeGeo, ropeMat);
      rope.position.set(0, 0.055, z);
      scene.add(rope);

      const buoySteps = 12;
      for (let b = 0; b <= buoySteps; b++) {
        const bx = START_X - 0.6 + (b / buoySteps) * (TRACK_LEN + 1.2);
        const buoy = new THREE.Mesh(buoyGeo, b % 2 === 0 ? buoyWhiteMat : buoyTealMat);
        buoy.position.set(bx, 0.075, z);
        scene.add(buoy);
      }
    }

    // 4. Start line (0 m) + every 100 m marker pylon along the far curb
    const startLineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3,
      emissive: 0x94a3b8,
      emissiveIntensity: 0.15,
    });
    const startBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, riverWidth - 0.1),
      startLineMat
    );
    startBar.position.set(START_X, 0.04, 0);
    scene.add(startBar);

    const safeTarget = Math.max(D02_STEP_METERS, targetMeters);
    const segmentCount = Math.max(1, Math.round(safeTarget / D02_STEP_METERS));
    const markerPostGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.68, 8);
    const markerCapGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const navyPostMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.38 });
    const markerCapMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
    const goldCapMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.45,
    });

    for (let s = 0; s <= segmentCount; s++) {
      const mx = START_X + (s / segmentCount) * TRACK_LEN;
      const isHalf = s > 0 && s < segmentCount && s * 2 === segmentCount;
      const post = new THREE.Mesh(markerPostGeo, navyPostMat);
      post.position.set(mx, 0.65, -(riverWidth / 2 + 0.18));
      scene.add(post);

      const cap = new THREE.Mesh(
        markerCapGeo,
        s === 0 || s === segmentCount || isHalf ? goldCapMat : markerCapMat
      );
      cap.position.set(mx, 1.04, -(riverWidth / 2 + 0.18));
      scene.add(cap);

      // Subtle floating water tick line at each 100 m
      if (s > 0 && s < segmentCount) {
        const tickLine = new THREE.Mesh(
          new THREE.PlaneGeometry(0.055, riverWidth - 0.3),
          new THREE.MeshBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: isHalf ? 0.42 : 0.2,
          })
        );
        tickLine.rotation.x = -Math.PI / 2;
        tickLine.position.set(mx, 0.02, 0);
        scene.add(tickLine);
      }
    }

    // 5. Sculpted Finish Arch spanning all lanes at FINISH_X
    const finishGroup = new THREE.Group();
    const archNavyMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.28,
      metalness: 0.3,
    });
    const archWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.26,
      metalness: 0.12,
    });
    const archGoldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.24,
      metalness: 0.52,
    });

    const pillarZ = riverWidth / 2 + 0.36;
    const pillarHeight = 3.2;
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.28, pillarHeight, 12);
    const farPillar = new THREE.Mesh(pillarGeo, archWhiteMat);
    farPillar.position.set(FINISH_X, pillarHeight / 2 + 0.2, -pillarZ);
    farPillar.castShadow = true;
    finishGroup.add(farPillar);

    const nearPillar = new THREE.Mesh(pillarGeo, archWhiteMat);
    nearPillar.position.set(FINISH_X, pillarHeight / 2 + 0.2, pillarZ);
    nearPillar.castShadow = true;
    finishGroup.add(nearPillar);

    const crossSpan = pillarZ * 2 + 0.48;
    const crossBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.72, crossSpan),
      archNavyMat
    );
    crossBeam.position.set(FINISH_X, pillarHeight + 0.32, 0);
    crossBeam.castShadow = true;
    finishGroup.add(crossBeam);

    const goldCrown = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.14, crossSpan + 0.08),
      archGoldMat
    );
    goldCrown.position.set(FINISH_X, pillarHeight + 0.72, 0);
    finishGroup.add(goldCrown);

    // Water-level checkered finish buoy line
    const finishBuoyLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.09, riverWidth),
      archGoldMat
    );
    finishBuoyLine.position.set(FINISH_X, 0.045, 0);
    finishGroup.add(finishBuoyLine);
    scene.add(finishGroup);

    // 6. Spawn 3D boats in fixed lanes (0..laneCount-1)
    const nextActors = new Map<string, BoatActor>();
    orderedTeams.forEach((row) => {
      const { group, wakeMesh, wakeMaterial, flagMesh } = createRacingBoatMesh(row.colorHex);
      const startPosX = distanceToBowX(row.displayMeters, targetMeters);
      const z = getLaneZ(row.laneIndex, laneCount, laneSpacing);
      group.position.set(startPosX, 0.04, z);
      scene.add(group);
      nextActors.set(row.teamId, {
        teamId: row.teamId,
        laneIndex: row.laneIndex,
        group,
        wakeMesh,
        wakeMaterial,
        flagMesh,
        currentX: startPosX,
        targetX: startPosX,
        baseZ: z,
      });
    });
    actorsRef.current = nextActors;

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed || !renderer) return;
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(190, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    // Animation loop — gentle wake ONLY when moving, deterministic stop at targetX
    let lastTime = performance.now();
    const animate = (now: number) => {
      if (disposed || !renderer) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const t = now * 0.001;
      const reduced = reducedMotionRef.current;

      actorsRef.current.forEach((actor) => {
        const diff = actor.targetX - actor.currentX;
        const absDiff = Math.abs(diff);

        if (reduced || absDiff < 0.015) {
          actor.currentX = actor.targetX;
          actor.group.position.x = actor.targetX;
          actor.group.position.y = reduced
            ? 0.04
            : 0.04 + Math.sin(t * 1.9 + actor.laneIndex * 1.1) * 0.014;
          actor.group.rotation.z = 0;
          actor.wakeMesh.visible = false;
          actor.wakeMaterial.opacity = 0;
        } else {
          // Smooth deterministic approach toward exact confirmed distance
          const step = diff * Math.min(1, dt * 5.2);
          actor.currentX += step;
          actor.group.position.x = actor.currentX;
          // Slight bow lift only while moving forward
          actor.group.position.y = 0.065 + Math.sin(t * 7.5 + actor.laneIndex) * 0.025;
          actor.group.rotation.z = diff > 0 ? 0.045 : -0.025;
          actor.wakeMesh.visible = true;
          actor.wakeMaterial.opacity = Math.min(0.68, absDiff * 0.42 + 0.18);
          actor.wakeMesh.scale.set(0.85 + Math.sin(t * 12) * 0.1, 1, 0.92 + Math.cos(t * 9) * 0.08);
        }

        // Subtle pennant breeze
        actor.flagMesh.rotation.y = reduced
          ? 0
          : Math.sin(t * 3.8 + actor.laneIndex * 0.8) * 0.16;
      });

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        try {
          glCtx.flush();
        } catch {
          // Ignore software GL flush notice
        }
      }
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      actorsRef.current.clear();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material?.dispose();
          }
        }
      });

      if (envRenderTarget) envRenderTarget.dispose();
      if (pmremGenerator) pmremGenerator.dispose();
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.dispose();
      }
    };
    // Rebuild course cleanly when lane count/team setup or targetMeters changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneKey, targetMeters, force2D, webglFailed]);

  if (force2D || webglFailed) {
    return (
      <BoatRace2DTrack
        standings={standings}
        targetMeters={targetMeters}
        reducedMotion={reducedMotion}
      />
    );
  }

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-cyan-500/35 bg-[#082f44] shadow-lg ${
        isFullscreen ? 'h-[250px] sm:h-[290px]' : 'h-[220px] sm:h-[260px]'
      }`}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Crisp DOM stage badges (never baked into low-res 3D textures) */}
      <div className="pointer-events-none absolute top-2.5 left-3 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 border border-cyan-400/30 text-[11px] font-bold text-cyan-100 backdrop-blur-sm">
          Đường đua tri thức · 0 m → {targetMeters} m
        </span>
      </div>
      <div className="pointer-events-none absolute top-2.5 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 border border-amber-400/45 text-[11px] font-extrabold text-amber-300 backdrop-blur-sm">
        <Flag className="w-3.5 h-3.5" />
        <span>Cổng đích Tây Đô Smart EDU</span>
      </div>
    </div>
  );
};
