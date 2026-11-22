/**
 * E05 — SĂN SAO KIẾN THỨC 3D — 3D CONSTELLATION SKY MAP & 2D FALLBACK
 * - Deep navy observatory cosmos backdrop, emerald teal geometric star rings, brushed gold illuminated 3D stars
 * - Three constellation clusters (default 9 stars: 3 per cluster); glowing golden constellation beams connect stars
 *   when ALL stars in a cluster are lit (illustrative progress indicator)
 * - Semantic accessible DOM star buttons aligned over each 3D star with star number, topic label, and explicit
 *   state text + icon ("Chưa mở", "Đang chơi", "Đã thắp sáng", "Đã xem lời giải")
 * - Software-WebGL guard, RoomEnvironment reflections, InstancedMesh starfield, afterDraw fenceSync pacing,
 *   webglcontextlost recovery, and full-featured 2D 3-cluster card fallback
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BookOpen, CheckCircle2, Lock, Sparkles, Star } from 'lucide-react';
import {
  E05_CLUSTERS,
  StarClusterProgress,
  StarHuntState,
  StarNode,
  StarNodeStatus,
  computeClusterProgress,
  getStarNodeStatus,
} from './starHunt3dEngine';

export interface StarHunt3DSceneProps {
  state: StarHuntState;
  onSelectStar: (starId: string) => void;
  onInspectPlayedStar: (starId: string) => void;
  skipAnimationKey: number;
  reducedMotion: boolean;
  force2D: boolean;
  disabled?: boolean;
  compact?: boolean;
}

interface StarSlotCoord {
  x3d: number;
  y3d: number;
  z3d: number;
  pctX: number; // 0..100 for aligned interactive overlay
  pctY: number; // 0..100 for aligned interactive overlay
}

/**
 * Balanced 3-constellation coordinates across 16:9 widescreen viewport.
 * Each cluster forms a clean astronomical arc (3 stars per cluster).
 */
const CLUSTER_SLOT_COORDS: Record<1 | 2 | 3, StarSlotCoord[]> = {
  1: [
    { x3d: -5.4, y3d: 1.45, z3d: 0.2, pctX: 15, pctY: 31 },
    { x3d: -3.75, y3d: -0.25, z3d: 0.45, pctX: 25, pctY: 54 },
    { x3d: -5.05, y3d: -1.8, z3d: 0.1, pctX: 17, pctY: 75 },
  ],
  2: [
    { x3d: -1.25, y3d: 1.55, z3d: 0.35, pctX: 42, pctY: 29 },
    { x3d: 0.1, y3d: -0.05, z3d: 0.65, pctX: 50, pctY: 51 },
    { x3d: 1.35, y3d: -1.65, z3d: 0.3, pctX: 58, pctY: 73 },
  ],
  3: [
    { x3d: 4.9, y3d: 1.5, z3d: 0.2, pctX: 82, pctY: 30 },
    { x3d: 3.7, y3d: -0.2, z3d: 0.45, pctX: 74, pctY: 53 },
    { x3d: 5.2, y3d: -1.75, z3d: 0.15, pctX: 84, pctY: 75 },
  ],
};

function getStarCoord(star: StarNode): StarSlotCoord {
  const arr = CLUSTER_SLOT_COORDS[star.clusterId] || CLUSTER_SLOT_COORDS[1];
  return arr[star.slotInCluster % arr.length] || arr[0];
}

function detectSoftwareWebGL(): { available: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') return { available: false, isSoftwareGl: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { available: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { available: true, isSoftwareGl };
  } catch {
    return { available: false, isSoftwareGl: true };
  }
}

/**
 * Builds a beveled 5-pointed star ExtrudeGeometry centered at origin.
 */
function createFivePointStarGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const points = 5;
  const outerR = 0.56;
  const innerR = 0.25;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points + Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.045,
    bevelSegments: 2,
  });
  geom.center();
  return geom;
}

function createSoftHaloTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255, 224, 122, 0.92)');
    grad.addColorStop(0.45, 'rgba(245, 158, 11, 0.35)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const STATUS_META: Record<
  StarNodeStatus,
  {
    label: string;
    shortLabel: string;
    ringClass: string;
    badgeClass: string;
  }
> = {
  unopened: {
    label: 'Chưa mở',
    shortLabel: 'Chưa mở',
    ringClass: 'border-teal-400/75 bg-[#091833]/85 hover:border-amber-300 hover:bg-[#0D2347]',
    badgeClass: 'text-teal-200',
  },
  active: {
    label: 'Đang chơi',
    shortLabel: 'Đang chơi',
    ringClass: 'border-sky-300 bg-sky-500/25 shadow-lg shadow-sky-900/60',
    badgeClass: 'text-sky-100',
  },
  lit: {
    label: 'Đã thắp sáng',
    shortLabel: 'Đã sáng',
    ringClass: 'border-amber-300 bg-amber-400/20 hover:bg-amber-400/30 shadow-lg shadow-amber-950/50',
    badgeClass: 'text-amber-200',
  },
  solution_viewed: {
    label: 'Đã xem lời giải',
    shortLabel: 'Xem lại',
    ringClass: 'border-slate-400/80 bg-slate-800/85 hover:border-teal-300',
    badgeClass: 'text-slate-200',
  },
};

function renderStatusIcon(status: StarNodeStatus, cls = 'w-3.5 h-3.5') {
  if (status === 'lit') return <Star className={`${cls} text-amber-300 fill-amber-300`} />;
  if (status === 'active') return <Sparkles className={`${cls} text-sky-200`} />;
  if (status === 'solution_viewed') return <BookOpen className={`${cls} text-slate-300`} />;
  return <Star className={`${cls} text-teal-300`} />;
}

// ============================================================================
// 2D CONSTELLATION CLUSTER FALLBACK (FULL FEATURED)
// ============================================================================

const StarHunt2DFallback: React.FC<{
  state: StarHuntState;
  clusterProgress: StarClusterProgress[];
  onSelectStar: (starId: string) => void;
  onInspectPlayedStar: (starId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}> = ({ state, clusterProgress, onSelectStar, onInspectPlayedStar, disabled, compact }) => {
  const hasActiveStar = state.activeStarId !== null;

  return (
    <div className="w-full h-full rounded-2xl bg-gradient-to-b from-[#061024] via-[#091833] to-[#07142A] border border-teal-500/35 p-3 sm:p-4 flex flex-col justify-between gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span className="font-bold text-teal-200">
          Bản đồ 3 cụm sao (Chế độ 2D nhẹ)
        </span>
        <div className="flex items-center gap-3 flex-wrap text-[11px]">
          <span className="inline-flex items-center gap-1 text-teal-200">
            <Star className="w-3 h-3" /> Chưa mở
          </span>
          <span className="inline-flex items-center gap-1 text-amber-200">
            <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> Đã thắp sáng
          </span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <BookOpen className="w-3 h-3" /> Đã xem lời giải
          </span>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-3 gap-2.5' : 'md:grid-cols-3 gap-3.5'} flex-1`}>
        {clusterProgress.map(({ cluster, litStars, totalStars, isComplete }) => {
          const starsInCluster = state.stars.filter((s) => s.clusterId === cluster.id);
          return (
            <div
              key={cluster.id}
              className={`rounded-xl border p-3 flex flex-col justify-between gap-2.5 transition-colors ${
                isComplete
                  ? 'bg-amber-400/10 border-amber-400/65'
                  : 'bg-[#0C1D3B]/90 border-teal-500/25'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black text-white truncate">{cluster.name}</p>
                <span
                  className={`text-[11px] font-bold shrink-0 ${
                    isComplete ? 'text-amber-300' : 'text-teal-200'
                  }`}
                >
                  {litStars}/{totalStars} sao
                  {isComplete ? ' · Chòm sao sáng' : ''}
                </span>
              </div>

              {/* Subtle SVG Constellation Beam when all stars in cluster are lit */}
              {isComplete && (
                <svg
                  viewBox="0 0 240 16"
                  className="w-full h-3.5 overflow-visible"
                  aria-hidden="true"
                >
                  <line
                    x1="24"
                    y1="8"
                    x2="216"
                    y2="8"
                    stroke="#FBBF24"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle cx="24" cy="8" r="4" fill="#FDE68A" />
                  <circle cx="120" cy="8" r="4" fill="#FDE68A" />
                  <circle cx="216" cy="8" r="4" fill="#FDE68A" />
                </svg>
              )}

              <div className="grid grid-cols-1 gap-2">
                {starsInCluster.map((star) => {
                  const status = getStarNodeStatus(state, star.id);
                  const meta = STATUS_META[status];
                  const isLockedByOther = hasActiveStar && status === 'unopened';
                  const isPlayed = status === 'lit' || status === 'solution_viewed';

                  return (
                    <button
                      key={star.id}
                      type="button"
                      disabled={disabled || isLockedByOther}
                      onClick={() => {
                        if (isPlayed) onInspectPlayedStar(star.id);
                        else if (status === 'unopened') onSelectStar(star.id);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border-2 transition-all flex items-center justify-between gap-2 ${
                        meta.ringClass
                      } ${
                        disabled || isLockedByOther
                          ? 'opacity-50 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center shrink-0 tabular-nums ${
                            status === 'lit'
                              ? 'bg-amber-400 text-[#061024]'
                              : status === 'active'
                              ? 'bg-sky-400 text-[#061024]'
                              : status === 'solution_viewed'
                              ? 'bg-slate-600 text-white'
                              : 'bg-teal-500/20 border border-teal-400/60 text-teal-100'
                          }`}
                        >
                          {star.starNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">
                            Sao {star.starNumber} · {star.topicLabel}
                          </p>
                          <p className={`text-[11px] font-semibold flex items-center gap-1 ${meta.badgeClass}`}>
                            {renderStatusIcon(status, 'w-3 h-3')}
                            <span>{meta.label}</span>
                          </p>
                        </div>
                      </div>

                      {isLockedByOther && <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      {status === 'lit' && (
                        <CheckCircle2 className="w-4 h-4 text-amber-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN 3D CONSTELLATION MAP COMPONENT
// ============================================================================

export const StarHunt3DScene: React.FC<StarHunt3DSceneProps> = ({
  state,
  onSelectStar,
  onInspectPlayedStar,
  skipAnimationKey,
  reducedMotion,
  force2D,
  disabled = false,
  compact = false,
}) => {
  const [webglProbe] = useState(() => detectSoftwareWebGL());
  const [contextLost, setContextLost] = useState(false);

  const clusterProgress = useMemo(() => computeClusterProgress(state), [state]);
  const use2D = force2D || !webglProbe.available || contextLost;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<StarHuntState>(state);
  const clusterProgressRef = useRef<StarClusterProgress[]>(clusterProgress);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const skipAnimRef = useRef<number>(skipAnimationKey);

  stateRef.current = state;
  clusterProgressRef.current = clusterProgress;
  reducedMotionRef.current = reducedMotion;
  skipAnimRef.current = skipAnimationKey;

  useEffect(() => {
    if (use2D) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = webglProbe.isSoftwareGl;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#061024');
    scene.fog = new THREE.FogExp2('#061024', 0.032);

    const width = Math.max(320, container.clientWidth);
    const height = Math.max(200, container.clientHeight);
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 11.4);
    camera.lookAt(0, -0.05, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Studio Environment Reflection (mandatory for crisp gold/teal metallic bevels)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Warm/cool 3-point planetarium lighting
    const hemiLight = new THREE.HemisphereLight('#7DD3FC', '#0F172A', 1.05);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FEF3C7', 2.0);
    keyLight.position.set(4, 7, 9);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#2DD4BF', 1.25);
    rimLight.position.set(-6, -3, 5);
    scene.add(rimLight);

    // Background InstancedMesh Starfield (140 distant pinpoint stars)
    const dustGeom = new THREE.OctahedronGeometry(0.045, 0);
    const dustMat = new THREE.MeshBasicMaterial({
      color: '#BAE6FD',
      transparent: true,
      opacity: 0.72,
    });
    const dustCount = 140;
    const dustMesh = new THREE.InstancedMesh(dustGeom, dustMat, dustCount);
    const dummy = new THREE.Object3D();
    const tmpColor = new THREE.Color();
    for (let i = 0; i < dustCount; i++) {
      // Deterministic pseudo-random distribution so frames are crisp & repeatable
      const s1 = Math.sin(i * 12.9898) * 43758.5453;
      const s2 = Math.sin(i * 78.233) * 24634.6345;
      const s3 = Math.sin(i * 39.425) * 18293.1234;
      const rx = (s1 - Math.floor(s1)) * 26 - 13;
      const ry = (s2 - Math.floor(s2)) * 13 - 6.5;
      const rz = -3.5 - (s3 - Math.floor(s3)) * 14;
      const sc = 0.45 + ((i * 7) % 10) * 0.1;
      dummy.position.set(rx, ry, rz);
      dummy.scale.setScalar(sc);
      dummy.rotation.set(i * 0.4, i * 0.7, 0);
      dummy.updateMatrix();
      dustMesh.setMatrixAt(i, dummy.matrix);
      tmpColor.set(i % 5 === 0 ? '#FDE68A' : i % 3 === 0 ? '#5EEAD4' : '#E0F2FE');
      dustMesh.setColorAt(i, tmpColor);
    }
    dustMesh.instanceMatrix.needsUpdate = true;
    if (dustMesh.instanceColor) dustMesh.instanceColor.needsUpdate = true;
    dustMesh.computeBoundingSphere();
    scene.add(dustMesh);

    // Shared geometries & halo texture
    const starGeom = createFivePointStarGeometry();
    const ringGeom = new THREE.TorusGeometry(0.76, 0.042, 12, 42);
    const gemGeom = new THREE.OctahedronGeometry(0.16, 0);
    const haloGeom = new THREE.PlaneGeometry(2.35, 2.35);
    const haloTex = createSoftHaloTexture();

    // Build 3-part composite star groups for every star in current session
    interface StarRig {
      starId: string;
      clusterId: 1 | 2 | 3;
      group: THREE.Group;
      starMat: THREE.MeshStandardMaterial;
      ringMat: THREE.MeshStandardMaterial;
      gemMat: THREE.MeshStandardMaterial;
      haloMat: THREE.MeshBasicMaterial;
      basePos: THREE.Vector3;
      currentScale: number;
      currentLitMix: number;
    }

    const starRigs = new Map<string, StarRig>();
    const clusterRigs: Record<1 | 2 | 3, { tubes: THREE.Mesh[]; mat: THREE.MeshStandardMaterial }> = {
      1: { tubes: [], mat: new THREE.MeshStandardMaterial({ color: '#FBBF24', emissive: '#F59E0B', emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.85, transparent: true, opacity: 0 }) },
      2: { tubes: [], mat: new THREE.MeshStandardMaterial({ color: '#FBBF24', emissive: '#F59E0B', emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.85, transparent: true, opacity: 0 }) },
      3: { tubes: [], mat: new THREE.MeshStandardMaterial({ color: '#FBBF24', emissive: '#F59E0B', emissiveIntensity: 0.9, roughness: 0.25, metalness: 0.85, transparent: true, opacity: 0 }) },
    };

    const initialStars = stateRef.current.stars;
    initialStars.forEach((star) => {
      const coord = getStarCoord(star);
      const group = new THREE.Group();
      group.position.set(coord.x3d, coord.y3d, coord.z3d);

      const starMat = new THREE.MeshStandardMaterial({
        color: '#475569',
        emissive: '#0F172A',
        emissiveIntensity: 0.2,
        metalness: 0.88,
        roughness: 0.28,
      });
      const starMesh = new THREE.Mesh(starGeom, starMat);
      group.add(starMesh);

      const ringMat = new THREE.MeshStandardMaterial({
        color: '#14B8A6',
        emissive: '#0D9488',
        emissiveIntensity: 0.45,
        metalness: 0.5,
        roughness: 0.35,
      });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      group.add(ringMesh);

      const gemMat = new THREE.MeshStandardMaterial({
        color: '#E2E8F0',
        emissive: '#38BDF8',
        emissiveIntensity: 0.35,
        metalness: 0.2,
        roughness: 0.15,
      });
      const gemMesh = new THREE.Mesh(gemGeom, gemMat);
      gemMesh.position.z = 0.14;
      group.add(gemMesh);

      const haloMat = new THREE.MeshBasicMaterial({
        map: haloTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const haloMesh = new THREE.Mesh(haloGeom, haloMat);
      haloMesh.position.z = -0.15;
      group.add(haloMesh);

      scene.add(group);
      starRigs.set(star.id, {
        starId: star.id,
        clusterId: star.clusterId,
        group,
        starMat,
        ringMat,
        gemMat,
        haloMat,
        basePos: new THREE.Vector3(coord.x3d, coord.y3d, coord.z3d),
        currentScale: 1,
        currentLitMix: 0,
      });
    });

    // Build golden constellation connecting tubes for each cluster (>= 2 stars)
    const tubeGeoms: THREE.TubeGeometry[] = [];
    ([1, 2, 3] as const).forEach((cId) => {
      const cStars = initialStars.filter((s) => s.clusterId === cId);
      if (cStars.length < 2) return;
      for (let i = 0; i < cStars.length - 1; i++) {
        const p1 = getStarCoord(cStars[i]);
        const p2 = getStarCoord(cStars[i + 1]);
        const curve = new THREE.LineCurve3(
          new THREE.Vector3(p1.x3d, p1.y3d, p1.z3d - 0.12),
          new THREE.Vector3(p2.x3d, p2.y3d, p2.z3d - 0.12)
        );
        const tubeGeom = new THREE.TubeGeometry(curve, 8, 0.042, 8, false);
        tubeGeoms.push(tubeGeom);
        const tubeMesh = new THREE.Mesh(tubeGeom, clusterRigs[cId].mat);
        tubeMesh.visible = false;
        scene.add(tubeMesh);
        clusterRigs[cId].tubes.push(tubeMesh);
      }
    });

    // ResizeObserver for crisp 16:9 & fullscreen transitions
    const resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(160, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });
    resizeObs.observe(container);

    // Pre-allocated color helpers (zero GC inside animation loop)
    const cUnlitStar = new THREE.Color('#475569');
    const cLitStar = new THREE.Color('#FBBF24');
    const cActiveStar = new THREE.Color('#38BDF8');
    const cViewedStar = new THREE.Color('#64748B');
    const cTealRing = new THREE.Color('#14B8A6');
    const cGoldRing = new THREE.Color('#FDE047');
    const cSkyRing = new THREE.Color('#7DD3FC');
    const cSlateRing = new THREE.Color('#94A3B8');

    const clock = new THREE.Clock();
    let disposed = false;
    let frameId = 0;
    let lastSkipKey = skipAnimRef.current;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
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
        const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (st === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const curState = stateRef.current;
      const curClusters = clusterProgressRef.current;
      const isReduced = reducedMotionRef.current;
      const snapNow = skipAnimRef.current !== lastSkipKey || isReduced;
      if (skipAnimRef.current !== lastSkipKey) {
        lastSkipKey = skipAnimRef.current;
      }

      // Gentle starfield drift
      if (!isReduced) {
        dustMesh.rotation.z = elapsed * 0.012;
      }

      // Update each star rig cleanly from deterministic state
      starRigs.forEach((rig) => {
        const status = getStarNodeStatus(curState, rig.starId);
        const targetScale = status === 'active' ? 1.24 : status === 'lit' ? 1.12 : 0.96;
        const targetLit = status === 'lit' ? 1 : 0;

        if (snapNow) {
          rig.currentScale = targetScale;
          rig.currentLitMix = targetLit;
        } else {
          rig.currentScale = THREE.MathUtils.damp(rig.currentScale, targetScale, 7, dt);
          rig.currentLitMix = THREE.MathUtils.damp(rig.currentLitMix, targetLit, 6, dt);
        }

        rig.group.scale.setScalar(rig.currentScale);
        if (!isReduced) {
          const floatY = Math.sin(elapsed * 1.4 + rig.basePos.x * 0.8) * 0.07;
          rig.group.position.y = rig.basePos.y + floatY;
          rig.group.rotation.y = Math.sin(elapsed * 0.9 + rig.basePos.x) * (status === 'lit' ? 0.35 : 0.16);
        } else {
          rig.group.position.y = rig.basePos.y;
          rig.group.rotation.y = 0;
        }

        if (status === 'lit') {
          rig.starMat.color.copy(cLitStar);
          rig.starMat.emissive.set('#D97706');
          rig.starMat.emissiveIntensity = 0.72;
          rig.ringMat.color.copy(cGoldRing);
          rig.ringMat.emissive.set('#F59E0B');
          rig.ringMat.emissiveIntensity = 0.85;
          rig.haloMat.opacity = 0.78 * rig.currentLitMix;
        } else if (status === 'active') {
          rig.starMat.color.copy(cActiveStar);
          rig.starMat.emissive.set('#0284C7');
          rig.starMat.emissiveIntensity = 0.65;
          rig.ringMat.color.copy(cSkyRing);
          rig.ringMat.emissive.set('#38BDF8');
          rig.ringMat.emissiveIntensity = 0.85;
          rig.haloMat.opacity = 0.38;
        } else if (status === 'solution_viewed') {
          rig.starMat.color.copy(cViewedStar);
          rig.starMat.emissive.set('#1E293B');
          rig.starMat.emissiveIntensity = 0.2;
          rig.ringMat.color.copy(cSlateRing);
          rig.ringMat.emissive.set('#475569');
          rig.ringMat.emissiveIntensity = 0.25;
          rig.haloMat.opacity = 0;
        } else {
          rig.starMat.color.copy(cUnlitStar);
          rig.starMat.emissive.set('#0F172A');
          rig.starMat.emissiveIntensity = 0.18;
          rig.ringMat.color.copy(cTealRing);
          rig.ringMat.emissive.set('#0D9488');
          rig.ringMat.emissiveIntensity = 0.48;
          rig.haloMat.opacity = 0;
        }
      });

      // Update constellation connecting beams for completed clusters
      curClusters.forEach(({ cluster, isComplete }) => {
        const cRig = clusterRigs[cluster.id];
        const targetOpacity = isComplete ? 0.92 : 0;
        cRig.mat.opacity = snapNow
          ? targetOpacity
          : THREE.MathUtils.damp(cRig.mat.opacity, targetOpacity, 5, dt);
        cRig.tubes.forEach((tube) => {
          tube.visible = cRig.mat.opacity > 0.02;
        });
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);

      dustGeom.dispose();
      dustMat.dispose();
      starGeom.dispose();
      ringGeom.dispose();
      gemGeom.dispose();
      haloGeom.dispose();
      haloTex.dispose();
      tubeGeoms.forEach((g) => g.dispose());
      starRigs.forEach((rig) => {
        rig.starMat.dispose();
        rig.ringMat.dispose();
        rig.gemMat.dispose();
        rig.haloMat.dispose();
      });
      ([1, 2, 3] as const).forEach((cId) => clusterRigs[cId].mat.dispose());
      envRT.dispose();
      renderer.dispose();
    };
  }, [use2D, webglProbe.isSoftwareGl, state.stars.length]);

  if (use2D) {
    return (
      <StarHunt2DFallback
        state={state}
        clusterProgress={clusterProgress}
        onSelectStar={onSelectStar}
        onInspectPlayedStar={onInspectPlayedStar}
        disabled={disabled}
        compact={compact}
      />
    );
  }

  const hasActiveStar = state.activeStarId !== null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-teal-500/35 bg-[#061024] select-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Top Cluster Headers Strip (non-obtrusive, semantic DOM) */}
      <div className="relative z-10 grid grid-cols-3 gap-2 px-3 pt-2.5 pointer-events-none">
        {clusterProgress.map(({ cluster, litStars, totalStars, isComplete }) => (
          <div
            key={cluster.id}
            className={`px-2.5 py-1.5 rounded-lg border text-center ${
              isComplete
                ? 'bg-amber-950/85 border-amber-400/70 text-amber-200'
                : 'bg-[#07152D]/85 border-teal-500/35 text-slate-200'
            }`}
          >
            <p className="text-[11px] sm:text-xs font-black truncate">{cluster.name}</p>
            <p className="text-[10px] font-bold tabular-nums opacity-90">
              {litStars}/{totalStars} sao sáng{isComplete ? ' · Chòm sao hoàn thành' : ''}
            </p>
          </div>
        ))}
      </div>

      {/* Semantic Accessible Interactive Star Buttons Aligned with 3D Stars */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {state.stars.map((star) => {
          const coord = getStarCoord(star);
          const status = getStarNodeStatus(state, star.id);
          const meta = STATUS_META[status];
          const isLockedByOther = hasActiveStar && status === 'unopened';
          const isPlayed = status === 'lit' || status === 'solution_viewed';

          return (
            <button
              key={star.id}
              type="button"
              disabled={disabled || isLockedByOther}
              onClick={() => {
                if (isPlayed) onInspectPlayedStar(star.id);
                else if (status === 'unopened') onSelectStar(star.id);
              }}
              style={{
                left: `${coord.pctX}%`,
                top: `${coord.pctY}%`,
              }}
              aria-label={`Sao ${star.starNumber} - ${star.topicLabel} - ${meta.label}`}
              className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 min-w-[104px] sm:min-w-[126px] px-2.5 py-2 rounded-xl border-2 text-left transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                meta.ringClass
              } ${
                disabled || isLockedByOther
                  ? 'opacity-55 cursor-not-allowed'
                  : 'cursor-pointer hover:scale-[1.04] active:scale-[0.98]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg font-black text-sm sm:text-base flex items-center justify-center shrink-0 tabular-nums ${
                    status === 'lit'
                      ? 'bg-amber-400 text-[#061024]'
                      : status === 'active'
                      ? 'bg-sky-400 text-[#061024]'
                      : status === 'solution_viewed'
                      ? 'bg-slate-600 text-white'
                      : 'bg-teal-500/25 border border-teal-400/70 text-teal-100'
                  }`}
                >
                  {star.starNumber}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-white leading-tight truncate">
                    {star.topicLabel}
                  </p>
                  <p className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${meta.badgeClass}`}>
                    {renderStatusIcon(status, 'w-3 h-3 shrink-0')}
                    <span className="truncate">{meta.label}</span>
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Legend Bar (solid rgba, zero backdrop-filter over WebGL) */}
      <div className="absolute bottom-2 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#07152D]/90 border border-teal-500/25 text-[11px] text-slate-200 pointer-events-none">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-teal-200">
            <Star className="w-3 h-3" /> Chưa mở
          </span>
          <span className="inline-flex items-center gap-1 text-sky-200">
            <Sparkles className="w-3 h-3" /> Đang chơi
          </span>
          <span className="inline-flex items-center gap-1 text-amber-200">
            <Star className="w-3 h-3 fill-amber-300 text-amber-300" /> Đã thắp sáng
          </span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <BookOpen className="w-3 h-3" /> Đã xem lời giải
          </span>
        </div>
        <span className="hidden sm:inline text-slate-300">
          Chọn sao 1–{state.stars.length} bằng chuột, cảm ứng hoặc phím số · Bấm sao đã chơi để xem lại lời giải
        </span>
      </div>
    </div>
  );
};

export default StarHunt3DScene;
