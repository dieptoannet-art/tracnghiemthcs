import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Award } from 'lucide-react';
import { DuelPhase, DuelPlayStyle, DuelSideId } from './duel1v13dEngine';

export interface Duel1v1SceneProps {
  playStyle: DuelPlayStyle;
  phase: DuelPhase;
  sideALabel: string;
  sideBLabel: string;
  scoreA: number;
  scoreB: number;
  tieBreakerScoreA: number;
  tieBreakerScoreB: number;
  maxMainScore: number;
  activeBuzzerSide: DuelSideId | null;
  highlightSides: { A: boolean; B: boolean };
  reducedMotion: boolean;
  skipEffects: boolean;
  lightweight2D: boolean;
  compact?: boolean;
  onWebGLFallback?: () => void;
}

const BLUE_HEX = 0x2563eb;
const BLUE_GLOW_HEX = 0x38bdf8;
const AMBER_HEX = 0xf59e0b;
const AMBER_GLOW_HEX = 0xfbbf24;
const GOLD_HEX = 0xd9a441;

function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createRadialShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
    grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.28)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface PodiumRefs {
  group: THREE.Group;
  crystalColumn: THREE.Mesh;
  crystalCap: THREE.Mesh;
  crystalMat: THREE.MeshPhysicalMaterial;
  frontPanelMat: THREE.MeshStandardMaterial;
  ringHaloMat: THREE.MeshStandardMaterial;
  spotlight: THREE.PointLight;
}

function buildSymmetricalPodium(
  side: DuelSideId,
  colorHex: number,
  glowHex: number,
  isSoftwareGl: boolean,
  shadowTex: THREE.CanvasTexture
): PodiumRefs {
  const group = new THREE.Group();

  // 1. Soft contact shadow plane
  const shadowGeo = new THREE.PlaneGeometry(3.2, 3.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.025;
  group.add(shadowPlane);

  // 2. Stepped circular/octagonal plinth base
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0x0f1b33,
    roughness: 0.42,
    metalness: 0.48,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: GOLD_HEX,
    roughness: 0.22,
    metalness: 0.88,
  });

  const baseTier = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.32, 0.22, 8), plinthMat);
  baseTier.position.y = 0.11;
  baseTier.receiveShadow = true;
  baseTier.castShadow = !isSoftwareGl;
  group.add(baseTier);

  const trimRing = new THREE.Mesh(new THREE.TorusGeometry(1.16, 0.032, 10, 32), goldMat);
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.23;
  group.add(trimRing);

  // 3. Architectural lectern pedestal body + angled top
  const lecternMat = new THREE.MeshStandardMaterial({
    color: 0x162544,
    roughness: 0.35,
    metalness: 0.55,
  });
  const lecternBody = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.96, 0.68), lecternMat);
  lecternBody.position.set(0, 0.7, 0.12);
  lecternBody.castShadow = !isSoftwareGl;
  lecternBody.receiveShadow = true;
  group.add(lecternBody);

  const lecternTop = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.1, 0.8), goldMat);
  lecternTop.position.set(0, 1.21, 0.12);
  lecternTop.rotation.x = 0.1;
  group.add(lecternTop);

  // 4. Luminous front accent shield (Blue for A, Orange/Gold for B)
  const frontPanelMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.48,
    roughness: 0.24,
    metalness: 0.28,
  });
  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.64, 0.08), frontPanelMat);
  frontPanel.position.set(0, 0.7, 0.46);
  group.add(frontPanel);

  // 5. Outer crystal socket + vertical crystal score column (anchored bottom at y = 0.28)
  const crystalX = side === 'A' ? -0.92 : 0.92;
  const socketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.18, 6), goldMat);
  socketMesh.position.set(crystalX, 0.31, -0.18);
  group.add(socketMesh);

  const crystalMat = new THREE.MeshPhysicalMaterial({
    color: glowHex,
    emissive: colorHex,
    emissiveIntensity: 0.42,
    roughness: 0.14,
    metalness: 0.15,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: isSoftwareGl ? 0.78 : 0.9,
    transmission: isSoftwareGl ? 0 : 0.45,
    ior: 1.52,
    thickness: 0.6,
  });

  // Unit-height hexagonal crystal column scaled smoothly along Y from bottom pivot
  const colGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.0, 6);
  colGeo.translate(0, 0.5, 0);
  const crystalColumn = new THREE.Mesh(colGeo, crystalMat);
  crystalColumn.position.set(crystalX, 0.4, -0.18);
  crystalColumn.scale.set(1, 0.35, 1);
  crystalColumn.castShadow = !isSoftwareGl;
  group.add(crystalColumn);

  const capGeo = new THREE.ConeGeometry(0.24, 0.34, 6);
  capGeo.translate(0, 0.17, 0);
  const crystalCap = new THREE.Mesh(capGeo, crystalMat);
  crystalCap.position.set(crystalX, 0.75, -0.18);
  group.add(crystalCap);

  // 6. Luminous floor halo ring & subtle local point light
  const ringHaloMat = new THREE.MeshStandardMaterial({
    color: glowHex,
    emissive: glowHex,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.3,
  });
  const ringHalo = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.03, 10, 40), ringHaloMat);
  ringHalo.rotation.x = Math.PI / 2;
  ringHalo.position.y = 0.04;
  group.add(ringHalo);

  const spotlight = new THREE.PointLight(glowHex, 1.8, 7.5, 1.8);
  spotlight.position.set(0, 2.5, 0.5);
  group.add(spotlight);

  return {
    group,
    crystalColumn,
    crystalCap,
    crystalMat,
    frontPanelMat,
    ringHaloMat,
    spotlight,
  };
}

function buildKnowledgeTrophy(isSoftwareGl: boolean): {
  group: THREE.Group;
  cupMat: THREE.MeshPhysicalMaterial;
  trophyLight: THREE.PointLight;
} {
  const group = new THREE.Group();

  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x111f3d,
    roughness: 0.35,
    metalness: 0.6,
  });
  const cupMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4c553,
    emissive: 0xb47b16,
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.94,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
  });

  // Pedestal base
  const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.64, 0.65, 16), pedestalMat);
  pedBase.position.y = 0.325;
  pedBase.castShadow = !isSoftwareGl;
  group.add(pedBase);

  const pedTrim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 10, 32), cupMat);
  pedTrim.rotation.x = Math.PI / 2;
  pedTrim.position.y = 0.65;
  group.add(pedTrim);

  // LatheGeometry sculpted trophy chalice
  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.28, 0.0),
    new THREE.Vector2(0.24, 0.1),
    new THREE.Vector2(0.09, 0.2),
    new THREE.Vector2(0.08, 0.42),
    new THREE.Vector2(0.24, 0.56),
    new THREE.Vector2(0.36, 0.88),
    new THREE.Vector2(0.38, 1.08),
    new THREE.Vector2(0.33, 1.08),
    new THREE.Vector2(0.29, 0.82),
    new THREE.Vector2(0.0, 0.62),
  ];
  const cupGeo = new THREE.LatheGeometry(profile, 28);
  const cupMesh = new THREE.Mesh(cupGeo, cupMat);
  cupMesh.position.y = 0.66;
  cupMesh.castShadow = !isSoftwareGl;
  group.add(cupMesh);

  // Symmetrical handles
  const handleGeo = new THREE.TorusGeometry(0.18, 0.028, 10, 24, Math.PI * 1.15);
  const leftHandle = new THREE.Mesh(handleGeo, cupMat);
  leftHandle.position.set(-0.34, 1.48, 0);
  leftHandle.rotation.z = Math.PI * 0.45;
  group.add(leftHandle);

  const rightHandle = new THREE.Mesh(handleGeo, cupMat);
  rightHandle.position.set(0.34, 1.48, 0);
  rightHandle.rotation.z = -Math.PI * 0.45;
  rightHandle.rotation.y = Math.PI;
  group.add(rightHandle);

  const trophyLight = new THREE.PointLight(0xfbbf24, 1.4, 6.5, 1.6);
  trophyLight.position.set(0, 2.2, 0.5);
  group.add(trophyLight);

  return { group, cupMat, trophyLight };
}

function buildCentralKnowledgeBoard(isSoftwareGl: boolean): THREE.Group {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: GOLD_HEX,
    roughness: 0.24,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1a36,
    emissive: 0x0e7490,
    emissiveIntensity: 0.24,
    roughness: 0.14,
    metalness: 0.25,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.9,
  });

  // Twin curved support struts
  const strutGeo = new THREE.CylinderGeometry(0.075, 0.095, 1.25, 12);
  const leftStrut = new THREE.Mesh(strutGeo, frameMat);
  leftStrut.position.set(-0.95, 0.62, 0);
  group.add(leftStrut);

  const rightStrut = new THREE.Mesh(strutGeo, frameMat);
  rightStrut.position.set(0.95, 0.62, 0);
  group.add(rightStrut);

  const baseFoot = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.14, 0.52), frameMat);
  baseFoot.position.set(0, 0.07, 0);
  group.add(baseFoot);

  // Outer gold bezel + cyan-tinted glass board
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(3.85, 1.82, 0.12), frameMat);
  bezel.position.set(0, 2.08, 0);
  bezel.castShadow = !isSoftwareGl;
  group.add(bezel);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(3.64, 1.62, 0.14), glassMat);
  screen.position.set(0, 2.08, 0.02);
  group.add(screen);

  return group;
}

export const Duel1v12DStage: React.FC<{
  playStyle: DuelPlayStyle;
  phase: DuelPhase;
  sideALabel: string;
  sideBLabel: string;
  scoreA: number;
  scoreB: number;
  tieBreakerScoreA: number;
  tieBreakerScoreB: number;
  maxMainScore: number;
  activeBuzzerSide: DuelSideId | null;
  highlightSides: { A: boolean; B: boolean };
  compact?: boolean;
  fallbackNotice?: string | null;
}> = ({
  playStyle,
  phase,
  sideALabel,
  sideBLabel,
  scoreA,
  scoreB,
  tieBreakerScoreA,
  tieBreakerScoreB,
  maxMainScore,
  activeBuzzerSide,
  highlightSides,
  compact = false,
  fallbackNotice,
}) => {
  const denom = Math.max(10, maxMainScore);
  const pctA = Math.min(100, Math.round((scoreA / denom) * 100));
  const pctB = Math.min(100, Math.round((scoreB / denom) * 100));
  const isSoloSingle = playStyle === 'solo_single';

  return (
    <div
      className={`relative w-full rounded-xl bg-gradient-to-b from-[#08142b] via-[#0c1d3d] to-[#061022] border border-cyan-500/25 overflow-hidden ${
        compact ? 'px-4 py-3' : 'px-5 py-5'
      }`}
    >
      <div className="flex items-center justify-between text-xs text-slate-300 mb-3">
        <span className="font-semibold tracking-wide text-cyan-200">
          Song đấu tri thức · Chế độ 2D nhẹ
        </span>
        {fallbackNotice ? (
          <span className="text-amber-300">{fallbackNotice}</span>
        ) : (
          <span className="text-slate-400">Hiển thị cột điểm trực quan</span>
        )}
      </div>

      <div
        className={`grid gap-4 items-end ${
          isSoloSingle ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-2'
        }`}
      >
        {/* Side A Podium Bar (Blue) */}
        <div
          className={`rounded-xl border p-3 transition-colors ${
            activeBuzzerSide === 'A' || highlightSides.A
              ? 'border-blue-400 bg-blue-950/55'
              : 'border-blue-500/30 bg-slate-900/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-bold text-blue-200 truncate" title={sideALabel}>
              Bên A · {sideALabel}
            </span>
            <span className="font-mono tabular-nums text-lg font-extrabold text-white shrink-0">
              {scoreA} đ
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.max(4, pctA)}%` }}
            />
          </div>
          {tieBreakerScoreA > 0 && (
            <div className="mt-1.5 text-xs text-cyan-200 font-mono tabular-nums">
              Câu phụ: +{tieBreakerScoreA} đ
            </div>
          )}
        </div>

        {/* Side B Podium Bar (Amber/Orange) */}
        {!isSoloSingle && (
          <div
            className={`rounded-xl border p-3 transition-colors ${
              activeBuzzerSide === 'B' || highlightSides.B
                ? 'border-amber-400 bg-amber-950/50'
                : 'border-amber-500/30 bg-slate-900/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-amber-200 truncate" title={sideBLabel}>
                Bên B · {sideBLabel}
              </span>
              <span className="font-mono tabular-nums text-lg font-extrabold text-white shrink-0">
                {scoreB} đ
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-300"
                style={{ width: `${Math.max(4, pctB)}%` }}
              />
            </div>
            {tieBreakerScoreB > 0 && (
              <div className="mt-1.5 text-xs text-amber-200 font-mono tabular-nums">
                Câu phụ: +{tieBreakerScoreB} đ
              </div>
            )}
          </div>
        )}
      </div>

      {phase === 'summary' && (
        <div className="mt-3 flex items-center justify-center gap-2 text-amber-300 text-xs font-semibold">
          <Award className="w-4 h-4" />
          <span>Cúp Tri Thức — Tổng kết trận Song đấu</span>
        </div>
      )}
    </div>
  );
};

export const Duel1v13DScene: React.FC<Duel1v1SceneProps> = (props) => {
  const {
    playStyle,
    phase,
    sideALabel,
    sideBLabel,
    scoreA,
    scoreB,
    tieBreakerScoreA,
    tieBreakerScoreB,
    maxMainScore,
    activeBuzzerSide,
    highlightSides,
    reducedMotion,
    skipEffects,
    lightweight2D,
    compact = false,
    onWebGLFallback,
  } = props;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState<boolean>(false);

  // Latest reactive visual targets kept in ref so WebGL canvas is NEVER torn down on React state changes
  const visualRef = useRef({
    playStyle,
    phase,
    scoreA,
    scoreB,
    tieBreakerScoreA,
    tieBreakerScoreB,
    maxMainScore,
    activeBuzzerSide,
    highlightSides,
    reducedMotion,
    skipEffects,
  });

  useEffect(() => {
    visualRef.current = {
      playStyle,
      phase,
      scoreA,
      scoreB,
      tieBreakerScoreA,
      tieBreakerScoreB,
      maxMainScore,
      activeBuzzerSide,
      highlightSides,
      reducedMotion,
      skipEffects,
    };
  }, [
    playStyle,
    phase,
    scoreA,
    scoreB,
    tieBreakerScoreA,
    tieBreakerScoreB,
    maxMainScore,
    activeBuzzerSide,
    highlightSides,
    reducedMotion,
    skipEffects,
  ]);

  useEffect(() => {
    if (lightweight2D || webglFailed) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      onWebGLFallback?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(240, container.clientWidth || 640);
    const initH = Math.max(140, container.clientHeight || 220);
    renderer.setSize(initW, initH, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Scene + horizon-matched deep navy fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061022);
    scene.fog = new THREE.FogExp2(0x061022, 0.042);

    // Procedural Studio PBR Environment reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 60);
    camera.position.set(0, 3.65, 8.6);
    camera.lookAt(0, 1.15, 0);

    // Warm/cool 3-point lighting rig (<= 3 shadow casters)
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x0b162d, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.65);
    keyLight.position.set(4.5, 8.5, 6.0);
    keyLight.castShadow = !isSoftwareGl;
    if (!isSoftwareGl) {
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 24;
      keyLight.shadow.camera.left = -7;
      keyLight.shadow.camera.right = 7;
      keyLight.shadow.camera.top = 7;
      keyLight.shadow.camera.bottom = -7;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
    rimLight.position.set(-5.0, 5.2, -5.5);
    scene.add(rimLight);

    // Circular Obsidian-Navy Stage Floor + Concentric Gold Inlay Rings
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a1730,
      roughness: 0.34,
      metalness: 0.52,
    });
    const stageDisc = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.2, 0.36, 48), floorMat);
    stageDisc.position.y = -0.18;
    stageDisc.receiveShadow = true;
    scene.add(stageDisc);

    const goldRingMat = new THREE.MeshStandardMaterial({
      color: GOLD_HEX,
      roughness: 0.22,
      metalness: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    [1.75, 3.65, 5.65].forEach((r) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.032, 10, 64), goldRingMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.015;
      scene.add(ring);
    });

    const shadowTex = createRadialShadowTexture();

    // Central Elevated Knowledge Board (behind center stage)
    const centralBoard = buildCentralKnowledgeBoard(isSoftwareGl);
    centralBoard.position.set(0, 0, -2.55);
    scene.add(centralBoard);

    // Strictly Symmetrical Left (A — Blue) and Right (B — Orange/Gold) Podiums
    const podiumA = buildSymmetricalPodium('A', BLUE_HEX, BLUE_GLOW_HEX, isSoftwareGl, shadowTex);
    podiumA.group.position.set(-3.05, 0, 0.55);
    podiumA.group.rotation.y = 0.34;
    scene.add(podiumA.group);

    const podiumB = buildSymmetricalPodium('B', AMBER_HEX, AMBER_GLOW_HEX, isSoftwareGl, shadowTex);
    podiumB.group.position.set(3.05, 0, 0.55);
    podiumB.group.rotation.y = -0.34;
    scene.add(podiumB.group);

    // Center Foreground Knowledge Trophy (rises cleanly in summary phase)
    const trophy = buildKnowledgeTrophy(isSoftwareGl);
    trophy.group.position.set(0, 0, 1.35);
    scene.add(trophy.group);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglFailed(true);
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(240, Math.floor(entry.contentRect.width));
        const h = Math.max(140, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObserver.observe(container);

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) gl.deleteSync(sync);
            return;
          }
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 90);
      }
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const v = visualRef.current;
      const instant = v.reducedMotion || v.skipEffects;
      if (!instant) {
        elapsed += dt;
      }

      const isSoloSingle = v.playStyle === 'solo_single';
      podiumB.group.visible = !isSoloSingle;
      const targetAx = isSoloSingle ? 0 : -3.05;
      const targetArot = isSoloSingle ? 0 : 0.34;
      podiumA.group.position.x = instant
        ? targetAx
        : THREE.MathUtils.damp(podiumA.group.position.x, targetAx, 6, dt);
      podiumA.group.rotation.y = instant
        ? targetArot
        : THREE.MathUtils.damp(podiumA.group.rotation.y, targetArot, 6, dt);

      // Crystal height proportional to main + tie-breaker progress (min 0.32, max 2.45)
      const maxDenom = Math.max(10, v.maxMainScore);
      const fracA = THREE.MathUtils.clamp((v.scoreA + v.tieBreakerScoreA) / maxDenom, 0, 1.15);
      const fracB = THREE.MathUtils.clamp((v.scoreB + v.tieBreakerScoreB) / maxDenom, 0, 1.15);
      const targetHeightA = 0.32 + fracA * 2.05;
      const targetHeightB = 0.32 + fracB * 2.05;

      const curHA = instant
        ? targetHeightA
        : THREE.MathUtils.damp(podiumA.crystalColumn.scale.y, targetHeightA, 5.5, dt);
      const curHB = instant
        ? targetHeightB
        : THREE.MathUtils.damp(podiumB.crystalColumn.scale.y, targetHeightB, 5.5, dt);

      podiumA.crystalColumn.scale.y = curHA;
      podiumA.crystalCap.position.y = 0.4 + curHA;
      podiumB.crystalColumn.scale.y = curHB;
      podiumB.crystalCap.position.y = 0.4 + curHB;

      // Active buzzer or score highlight glow (gentle, non-violent)
      const activeA = v.activeBuzzerSide === 'A' || v.highlightSides.A;
      const activeB = v.activeBuzzerSide === 'B' || v.highlightSides.B;
      podiumA.frontPanelMat.emissiveIntensity = instant
        ? activeA ? 1.15 : 0.48
        : THREE.MathUtils.damp(podiumA.frontPanelMat.emissiveIntensity, activeA ? 1.15 : 0.48, 6, dt);
      podiumB.frontPanelMat.emissiveIntensity = instant
        ? activeB ? 1.15 : 0.48
        : THREE.MathUtils.damp(podiumB.frontPanelMat.emissiveIntensity, activeB ? 1.15 : 0.48, 6, dt);
      podiumA.spotlight.intensity = activeA ? 3.2 : 1.7;
      podiumB.spotlight.intensity = activeB ? 3.2 : 1.7;

      // Trophy rises prominently on summary phase
      const isSummary = v.phase === 'summary';
      const targetTrophyY = isSummary ? 0.25 : -0.18;
      const targetTrophyScale = isSummary ? 1.2 : 0.85;
      trophy.group.position.y = instant
        ? targetTrophyY
        : THREE.MathUtils.damp(trophy.group.position.y, targetTrophyY, 4.5, dt);
      const nextTScale = instant
        ? targetTrophyScale
        : THREE.MathUtils.damp(trophy.group.scale.x, targetTrophyScale, 4.5, dt);
      trophy.group.scale.setScalar(nextTScale);
      trophy.cupMat.emissiveIntensity = isSummary ? 0.55 : 0.18;
      trophy.trophyLight.intensity = isSummary ? 3.4 : 1.1;
      if (!instant) {
        trophy.group.rotation.y = isSummary ? elapsed * 0.55 : Math.sin(elapsed * 0.4) * 0.18;
      } else {
        trophy.group.rotation.y = 0;
      }

      // Gentle studio camera breathing (disabled on reducedMotion / skipEffects)
      const targetCamZ = isSummary ? 7.4 : 8.6;
      const targetCamY = isSummary ? 3.2 : 3.65;
      camera.position.x = instant ? 0 : Math.sin(elapsed * 0.25) * 0.22;
      camera.position.y = instant
        ? targetCamY
        : THREE.MathUtils.damp(camera.position.y, targetCamY, 3.5, dt);
      camera.position.z = instant
        ? targetCamZ
        : THREE.MathUtils.damp(camera.position.z, targetCamZ, 3.5, dt);
      camera.lookAt(0, 1.15, 0);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

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
      shadowTex.dispose();
      envRT.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [lightweight2D, webglFailed, onWebGLFallback]);

  if (lightweight2D || webglFailed) {
    return (
      <Duel1v12DStage
        playStyle={playStyle}
        phase={phase}
        sideALabel={sideALabel}
        sideBLabel={sideBLabel}
        scoreA={scoreA}
        scoreB={scoreB}
        tieBreakerScoreA={tieBreakerScoreA}
        tieBreakerScoreB={tieBreakerScoreB}
        maxMainScore={maxMainScore}
        activeBuzzerSide={activeBuzzerSide}
        highlightSides={highlightSides}
        compact={compact}
        fallbackNotice={
          webglFailed ? 'WebGL không khả dụng — tự động chuyển chế độ 2D nhẹ' : null
        }
      />
    );
  }

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-cyan-500/25 bg-[#061022] ${
        compact ? 'h-[148px] sm:h-[168px]' : 'h-[190px] sm:h-[225px] lg:h-[245px]'
      }`}
    >
      {/* Dedicated empty ref container strictly isolated from sibling DOM overlays */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Clean unboxed top-center stage title */}
      <div className="pointer-events-none absolute top-2 left-0 right-0 flex items-center justify-center px-3">
        <span className="text-[11px] font-semibold tracking-wider text-cyan-200/90 bg-[#061022]/80 px-2.5 py-0.5 rounded">
          SONG ĐẤU TRI THỨC
        </span>
      </div>

      {/* Symmetrical bottom-left (Side A) and bottom-right (Side B) readable DOM name/score plates */}
      <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between gap-2">
        <div className="max-w-[44%] bg-[#08162f]/90 border border-blue-400/50 rounded-lg px-2.5 py-1.5">
          <div className="text-[11px] text-blue-300 font-semibold truncate" title={sideALabel}>
            Bên A · {sideALabel}
          </div>
          <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-white leading-tight">
            {scoreA} đ
            {tieBreakerScoreA > 0 && (
              <span className="ml-1.5 text-xs text-cyan-300">(+{tieBreakerScoreA} phụ)</span>
            )}
          </div>
        </div>

        {playStyle !== 'solo_single' && (
          <div className="max-w-[44%] bg-[#08162f]/90 border border-amber-400/50 rounded-lg px-2.5 py-1.5 text-right">
            <div className="text-[11px] text-amber-300 font-semibold truncate" title={sideBLabel}>
              {sideBLabel} · Bên B
            </div>
            <div className="font-mono tabular-nums text-base sm:text-lg font-extrabold text-white leading-tight">
              {tieBreakerScoreB > 0 && (
                <span className="mr-1.5 text-xs text-amber-200">(+{tieBreakerScoreB} phụ)</span>
              )}
              {scoreB} đ
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
