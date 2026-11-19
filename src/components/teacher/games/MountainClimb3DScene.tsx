import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  C08CameraPreset,
  C08ComputedEntityState,
  C08PlayMode,
  C08QualityPreset,
  MOUNTAIN_BASE_RADIUS,
  MOUNTAIN_HEIGHT,
  MOUNTAIN_TOP_RADIUS,
  getClimberWorldPosition,
  getMountainSlopeRadiusAtT,
  getMountainTrailPoint,
} from './mountainClimb3dEngine';
import { Compass, Flag, Mountain, Users, X } from 'lucide-react';

// ============================================================================
// C08: 3D MOUNTAIN VIEWPORT ("CHINH PHỤC ĐỈNH TRI THỨC")
// Three.js PBR WebGL Mountain + Composite Climber Groups + Cluster Labels
// Includes automatic 2D Interactive SVG Mountain Fallback when WebGL unavailable
// ============================================================================

export interface MountainClimb3DSceneProps {
  entities: C08ComputedEntityState[];
  playMode: C08PlayMode;
  summitThreshold: number;
  maxPossibleScore: number;
  qualityPreset: C08QualityPreset;
  reducedMotion: boolean;
  cameraPreset: C08CameraPreset;
  cameraMotionEnabled: boolean;
  force2DFallback?: boolean;
  stageLabel?: string;
  compactBackdrop?: boolean; // True when question board takes primary center focus
  onSelectCluster?: (members: C08ComputedEntityState[]) => void;
  onAnimationSettled?: () => void;
}

interface ProjectedLabel {
  key: string;
  xPercent: number;
  yPercent: number;
  visible: boolean;
  title: string;
  subtitle: string;
  colorHex: string;
  isSummit: boolean;
  count: number;
  members: C08ComputedEntityState[];
}

interface RenderNodeGroup {
  key: string;
  progress: number;
  colorHex: string;
  title: string;
  subtitle: string;
  isSummit: boolean;
  members: C08ComputedEntityState[];
}

// Pre-allocated scratch math helpers (zero GC inside animation loop)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpMat4 = new THREE.Matrix4();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _tmpScale = new THREE.Vector3();
const _tmpColor = new THREE.Color();

function createProceduralMountainTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 512, 512);
    // Subtle stratified rock / alpine grain (neutral grayscale so vertex colors shine)
    for (let i = 0; i < 2400; i++) {
      const x = (i * 73) % 512;
      const y = (i * 137) % 512;
      const w = 4 + (i % 14);
      const h = 2 + (i % 6);
      const shade = 212 + (i % 42);
      ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = 'rgba(130, 145, 165, 0.22)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 28; row++) {
      ctx.beginPath();
      const yBase = row * 18 + 6;
      ctx.moveTo(0, yBase);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, yBase + Math.sin(x * 0.04 + row) * 4);
      }
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.anisotropy = maxAniso;
  return tex;
}

function createSummitFlagTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 280);
    grad.addColorStop(0, '#0F3D6E');
    grad.addColorStop(0.55, '#0866FF');
    grad.addColorStop(1, '#0EA5E9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 280);

    // Gold border trim
    ctx.strokeStyle = '#FBBF24';
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, 498, 266);

    // Mountain & Book emblem on left
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(52, 185);
    ctx.lineTo(106, 86);
    ctx.lineTo(160, 185);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
    ctx.fillText('TÂY ĐÔ', 184, 128);
    ctx.fillStyle = '#FDE047';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.fillText('SMART EDU', 184, 178);
    ctx.fillStyle = '#E0F2FE';
    ctx.font = '600 20px system-ui, -apple-system, sans-serif';
    ctx.fillText('ĐỈNH TRI THỨC', 184, 218);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function disposeSceneResources(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const std = m as THREE.MeshStandardMaterial;
        if (std.map) std.map.dispose();
        if (std.normalMap) std.normalMap.dispose();
        m.dispose();
      });
    }
  });
}

/**
 * Groups 1..50 entities cleanly so simultaneous tied players or 50-student classes
 * remain legible on the mountain without overlapping labels or GPU clutter.
 */
export function buildMountainRenderNodes(
  entities: C08ComputedEntityState[]
): RenderNodeGroup[] {
  if (entities.length === 0) return [];

  // For <= 8 players/teams: show individual 3D climbers (spread laterally if tied)
  if (entities.length <= 8) {
    return entities.map((e) => ({
      key: e.participant.participantId,
      progress: e.progress,
      colorHex: e.participant.colorHex,
      title: e.participant.name,
      subtitle: `${e.score}đ`,
      isSummit: e.reachedSummit,
      members: [e],
    }));
  }

  // For 9..50 students: cluster by progress bucket (5% steps + dedicated summit bucket)
  const buckets = new Map<string, C08ComputedEntityState[]>();
  entities.forEach((e) => {
    const bucketKey = e.reachedSummit
      ? 'summit'
      : `p_${Math.round(e.progress * 20)}`;
    const list = buckets.get(bucketKey) || [];
    list.push(e);
    buckets.set(bucketKey, list);
  });

  const nodes: RenderNodeGroup[] = [];
  buckets.forEach((members, key) => {
    const avgProg =
      members.reduce((sum, m) => sum + m.progress, 0) / Math.max(1, members.length);
    const rep = members[0];
    if (members.length === 1) {
      nodes.push({
        key: rep.participant.participantId,
        progress: rep.progress,
        colorHex: rep.participant.colorHex,
        title: rep.participant.name,
        subtitle: `${rep.score}đ`,
        isSummit: rep.reachedSummit,
        members,
      });
    } else {
      const minScore = Math.min(...members.map((m) => m.score));
      const maxScore = Math.max(...members.map((m) => m.score));
      const scoreText = minScore === maxScore ? `${maxScore}đ` : `${minScore}–${maxScore}đ`;
      nodes.push({
        key: `cluster_${key}`,
        progress: avgProg,
        colorHex: key === 'summit' ? '#F59E0B' : '#06B6D4',
        title: `Nhóm ${members.length} HS`,
        subtitle: scoreText,
        isSummit: key === 'summit',
        members,
      });
    }
  });

  return nodes.sort((a, b) => a.progress - b.progress);
}

export const MountainClimb3DScene: React.FC<MountainClimb3DSceneProps> = ({
  entities,
  playMode,
  summitThreshold,
  maxPossibleScore,
  qualityPreset,
  reducedMotion,
  cameraPreset,
  cameraMotionEnabled,
  force2DFallback = false,
  stageLabel,
  compactBackdrop = false,
  onSelectCluster,
  onAnimationSettled,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);
  const [activeClusterModal, setActiveClusterModal] = useState<C08ComputedEntityState[] | null>(null);
  const [projectedLabels, setProjectedLabels] = useState<ProjectedLabel[]>([]);

  const renderNodes = useMemo(() => buildMountainRenderNodes(entities), [entities]);

  // Mutable refs for zero-teardown 3D animation loop
  const renderNodesRef = useRef<RenderNodeGroup[]>(renderNodes);
  renderNodesRef.current = renderNodes;
  const qualityRef = useRef<C08QualityPreset>(qualityPreset);
  qualityRef.current = qualityPreset;
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  const cameraPresetRef = useRef<C08CameraPreset>(cameraPreset);
  cameraPresetRef.current = cameraPreset;
  const cameraMotionRef = useRef<boolean>(cameraMotionEnabled);
  cameraMotionRef.current = cameraMotionEnabled;
  const onSettledRef = useRef(onAnimationSettled);
  onSettledRef.current = onAnimationSettled;

  // Orbit drag state
  const orbitOffsetRef = useRef<{ yaw: number; pitch: number; zoom: number }>({
    yaw: 0,
    pitch: 0,
    zoom: 1,
  });
  const dragStateRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  // Three.js object refs
  const threeRef = useRef<{
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    isSoftwareGl: boolean;
    camPos: THREE.Vector3;
    camTarget: THREE.Vector3;
    flagMesh: THREE.Mesh | null;
    cloudGroup: THREE.Group | null;
    climberPool: Map<
      string,
      {
        group: THREE.Group;
        leftLeg: THREE.Mesh;
        rightLeg: THREE.Mesh;
        bodyMesh: THREE.Mesh;
        currentProgress: number;
        targetProgress: number;
        slotIndex: number;
        slotTotal: number;
        colorHex: string;
        walkPhase: number;
        jacketMat: THREE.MeshStandardMaterial;
        flagClothMat: THREE.MeshStandardMaterial;
      }
    >;
    climbersRoot: THREE.Group | null;
    sharedGeos: THREE.BufferGeometry[];
    sharedMats: THREE.Material[];
  }>({
    renderer: null,
    scene: null,
    camera: null,
    isSoftwareGl: false,
    camPos: new THREE.Vector3(0, 10.5, 22.5),
    camTarget: new THREE.Vector3(0, 6.2, 0),
    flagMesh: null,
    cloudGroup: null,
    climberPool: new Map(),
    climbersRoot: null,
    sharedGeos: [],
    sharedMats: [],
  });

  // Reset manual orbit when preset changes
  useEffect(() => {
    orbitOffsetRef.current = { yaw: 0, pitch: 0, zoom: 1 };
  }, [cameraPreset]);

  const use2DFallback = force2DFallback || webglUnavailable;

  // Mount & manage WebGL Three.js mountain scene
  useEffect(() => {
    if (use2DFallback) return;
    const mountEl = mountRef.current;
    if (!mountEl) return;

    let animId = 0;
    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    let envRT: THREE.WebGLRenderTarget | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      if (!disposed) setWebglUnavailable(true);
    };
    const handleContextRestored = () => {
      if (!disposed) setWebglUnavailable(false);
    };

    try {
      const initW = Math.max(320, mountEl.clientWidth || 920);
      const initH = Math.max(240, mountEl.clientHeight || 500);

      const isSoftwareGl = (() => {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
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
      threeRef.current.isSoftwareGl = isSoftwareGl;
      threeRef.current.renderer = renderer;

      const maxAniso = renderer.capabilities.getMaxAnisotropy();
      const dprCap =
        isSoftwareGl || qualityRef.current === 'LOW'
          ? 1
          : qualityRef.current === 'MEDIUM'
          ? 1.5
          : 2;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
      renderer.setSize(initW, initH);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = !isSoftwareGl && qualityRef.current !== 'LOW';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.className = 'w-full h-full block outline-none select-none';
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      mountEl.innerHTML = '';
      mountEl.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color('#CBE9FF');
      scene.fog = new THREE.Fog('#D9EEFF', 38, 128);
      threeRef.current.scene = scene;

      pmrem = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      envRT = pmrem.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      roomEnv.dispose();
      pmrem.dispose();
      pmrem = null;

      const camera = new THREE.PerspectiveCamera(44, initW / initH, 0.1, 260);
      camera.position.copy(threeRef.current.camPos);
      camera.lookAt(threeRef.current.camTarget);
      threeRef.current.camera = camera;

      // Three-point alpine daylight rig
      const hemi = new THREE.HemisphereLight('#E0F2FE', '#1E4631', 0.95);
      scene.add(hemi);

      const sun = new THREE.DirectionalLight('#FFF7E0', 1.85);
      sun.position.set(18, 30, 22);
      if (renderer.shadowMap.enabled) {
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -18;
        sun.shadow.camera.right = 18;
        sun.shadow.camera.top = 20;
        sun.shadow.camera.bottom = -12;
        sun.shadow.camera.near = 2;
        sun.shadow.camera.far = 80;
        sun.shadow.bias = -0.0005;
        sun.shadow.normalBias = 0.02;
      }
      scene.add(sun);

      const rim = new THREE.DirectionalLight('#06B6D4', 0.62);
      rim.position.set(-20, 14, -18);
      scene.add(rim);

      // ------------------------------------------------------------------
      // 1. EXPANSIVE GREEN VALLEY FLOOR & DISTANT MOUNTAIN RING (No floating box)
      // ------------------------------------------------------------------
      const valleyFloor = new THREE.Mesh(
        new THREE.CircleGeometry(130, 48),
        new THREE.MeshStandardMaterial({
          color: '#2F7D4E',
          roughness: 0.94,
          metalness: 0.02,
        })
      );
      valleyFloor.rotation.x = -Math.PI / 2;
      valleyFloor.position.y = -0.05;
      valleyFloor.receiveShadow = true;
      scene.add(valleyFloor);

      // Surrounding distant mountain ridges for atmospheric depth
      const distantRidgeGeo = new THREE.ConeGeometry(16, 15, 7);
      const distantRidgeMat = new THREE.MeshStandardMaterial({
        color: '#4C7A94',
        roughness: 0.9,
        flatShading: true,
      });
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        const dist = 48 + (i % 3) * 8;
        const ridge = new THREE.Mesh(distantRidgeGeo, distantRidgeMat);
        ridge.position.set(Math.cos(ang) * dist, 5.2, Math.sin(ang) * dist);
        ridge.scale.set(1.3 + (i % 2) * 0.4, 0.85 + (i % 3) * 0.35, 1.3);
        ridge.rotation.y = ang * 1.3;
        scene.add(ridge);
      }

      // ------------------------------------------------------------------
      // 2. HERO SCULPTED MOUNTAIN PEAK WITH VERTEX-COLOR BIOME ELEVATION
      // ------------------------------------------------------------------
      const rockTex = createProceduralMountainTexture(maxAniso);
      const radialSegs = 72;
      const heightSegs = 38;
      const mountainGeo = new THREE.CylinderGeometry(
        MOUNTAIN_TOP_RADIUS,
        MOUNTAIN_BASE_RADIUS,
        MOUNTAIN_HEIGHT,
        radialSegs,
        heightSegs,
        false
      );
      const posAttr = mountainGeo.attributes.position;
      const colors = new Float32Array(posAttr.count * 3);

      const cMeadow = new THREE.Color('#2D8A52');
      const cAlpineGrass = new THREE.Color('#4A9A58');
      const cEarthRock = new THREE.Color('#64748B');
      const cHighRock = new THREE.Color('#475569');
      const cSnow = new THREE.Color('#F8FAFC');

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vy = posAttr.getY(i); // [-H/2, +H/2]
        const vz = posAttr.getZ(i);

        const t = Math.max(0, Math.min(1, (vy + MOUNTAIN_HEIGHT / 2) / MOUNTAIN_HEIGHT));
        const angle = Math.atan2(vz, vx);
        const radialLen = Math.hypot(vx, vz);

        if (radialLen > 0.05) {
          const baseRadius = getMountainSlopeRadiusAtT(t);
          // Natural alpine ridge crags (smooth near top & base so path sits accurately)
          const ridgeNoise =
            Math.sin(angle * 5 + t * 4.5) * 0.34 +
            Math.cos(angle * 9 - t * 6.0) * 0.16;
          const fade = Math.sin(t * Math.PI);
          const finalR = Math.max(0.4, baseRadius + ridgeNoise * fade * 0.55);
          posAttr.setX(i, (vx / radialLen) * finalR);
          posAttr.setZ(i, (vz / radialLen) * finalR);
        }

        // Biome color transitions by normalized height t
        if (t < 0.28) {
          _tmpColor.copy(cMeadow).lerp(cAlpineGrass, t / 0.28);
        } else if (t < 0.54) {
          _tmpColor.copy(cAlpineGrass).lerp(cEarthRock, (t - 0.28) / 0.26);
        } else if (t < 0.78) {
          _tmpColor.copy(cEarthRock).lerp(cHighRock, (t - 0.54) / 0.24);
        } else {
          // Snow line with natural wavy contour
          const snowEdge = 0.78 + Math.sin(angle * 6) * 0.045;
          const snowAlpha = Math.max(0, Math.min(1, (t - snowEdge) / 0.09));
          _tmpColor.copy(cHighRock).lerp(cSnow, snowAlpha);
        }
        colors[i * 3] = _tmpColor.r;
        colors[i * 3 + 1] = _tmpColor.g;
        colors[i * 3 + 2] = _tmpColor.b;
      }
      mountainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      mountainGeo.computeVertexNormals();

      const mountainMat = new THREE.MeshStandardMaterial({
        map: rockTex,
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.04,
        flatShading: true,
      });
      const mountainMesh = new THREE.Mesh(mountainGeo, mountainMat);
      mountainMesh.position.y = MOUNTAIN_HEIGHT / 2;
      mountainMesh.castShadow = true;
      mountainMesh.receiveShadow = true;
      scene.add(mountainMesh);

      // ------------------------------------------------------------------
      // 3. WINDING TRAIL DECK & MILESTONE STATION PLATFORMS
      // ------------------------------------------------------------------
      const trailPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 140; i++) {
        const u = i / 140;
        const pt = getMountainTrailPoint(u);
        trailPoints.push(new THREE.Vector3(pt.x, pt.y - 0.06, pt.z));
      }
      const trailCurve = new THREE.CatmullRomCurve3(trailPoints);
      const trailTubeGeo = new THREE.TubeGeometry(trailCurve, 150, 0.42, 8, false);
      const trailMat = new THREE.MeshStandardMaterial({
        color: '#E7C88B',
        roughness: 0.82,
        metalness: 0.06,
      });
      const trailMesh = new THREE.Mesh(trailTubeGeo, trailMat);
      trailMesh.receiveShadow = true;
      scene.add(trailMesh);

      // Milestone Stations (0%, 33%, 67%, 100%)
      const activeScene = scene;
      const milestoneFracs = [
        { u: 0.0, color: '#10B981', radius: 1.05 }, // Base camp
        { u: 0.33, color: '#06B6D4', radius: 0.88 }, // Stage 1 -> 2
        { u: 0.67, color: '#3B82F6', radius: 0.84 }, // Stage 2 -> 3
      ];
      milestoneFracs.forEach((m) => {
        const pt = getMountainTrailPoint(m.u);
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(m.radius, m.radius * 1.12, 0.24, 18),
          new THREE.MeshStandardMaterial({
            color: '#F8FAFC',
            roughness: 0.65,
            metalness: 0.12,
          })
        );
        pad.position.set(pt.x, pt.y - 0.04, pt.z);
        pad.receiveShadow = true;
        pad.castShadow = true;
        activeScene.add(pad);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(m.radius * 0.9, 0.06, 10, 24),
          new THREE.MeshStandardMaterial({
            color: m.color,
            emissive: m.color,
            emissiveIntensity: 0.55,
            roughness: 0.35,
          })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(pt.x, pt.y + 0.09, pt.z);
        activeScene.add(ring);
      });

      // Summit Plaza + Tây Đô Smart EDU Flag
      const summitPlaza = new THREE.Mesh(
        new THREE.CylinderGeometry(MOUNTAIN_TOP_RADIUS + 0.45, MOUNTAIN_TOP_RADIUS + 0.6, 0.32, 24),
        new THREE.MeshStandardMaterial({
          color: '#FEF3C7',
          roughness: 0.55,
          metalness: 0.2,
        })
      );
      summitPlaza.position.set(0, MOUNTAIN_HEIGHT + 0.02, 0);
      summitPlaza.receiveShadow = true;
      scene.add(summitPlaza);

      const summitRing = new THREE.Mesh(
        new THREE.TorusGeometry(MOUNTAIN_TOP_RADIUS + 0.28, 0.08, 12, 32),
        new THREE.MeshStandardMaterial({
          color: '#F59E0B',
          emissive: '#F59E0B',
          emissiveIntensity: 0.65,
          roughness: 0.25,
          metalness: 0.7,
        })
      );
      summitRing.rotation.x = Math.PI / 2;
      summitRing.position.set(0, MOUNTAIN_HEIGHT + 0.2, 0);
      scene.add(summitRing);

      // Flagpole + waving banner
      const flagpole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 3.1, 12),
        new THREE.MeshStandardMaterial({
          color: '#E2E8F0',
          metalness: 0.85,
          roughness: 0.2,
        })
      );
      flagpole.position.set(0, MOUNTAIN_HEIGHT + 1.65, 0);
      flagpole.castShadow = true;
      scene.add(flagpole);

      const finial = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 14, 14),
        new THREE.MeshStandardMaterial({
          color: '#FBBF24',
          metalness: 0.9,
          roughness: 0.15,
        })
      );
      finial.position.set(0, MOUNTAIN_HEIGHT + 3.24, 0);
      scene.add(finial);

      const flagGeo = new THREE.PlaneGeometry(1.75, 0.96, 12, 6);
      flagGeo.translate(0.88, 0, 0);
      const flagTex = createSummitFlagTexture(maxAniso);
      const flagMat = new THREE.MeshStandardMaterial({
        map: flagTex,
        side: THREE.DoubleSide,
        roughness: 0.55,
        metalness: 0.05,
      });
      const flagMesh = new THREE.Mesh(flagGeo, flagMat);
      flagMesh.position.set(0.04, MOUNTAIN_HEIGHT + 2.65, 0);
      scene.add(flagMesh);
      threeRef.current.flagMesh = flagMesh;

      // ------------------------------------------------------------------
      // 4. INSTANCED ALPINE PINE TREES & ROCKS ON LOWER FOOTHILLS
      // ------------------------------------------------------------------
      const treeCount = 46;
      const pineTrunkGeo = new THREE.CylinderGeometry(0.1, 0.14, 0.65, 7);
      pineTrunkGeo.translate(0, 0.32, 0);
      const pineTrunkMat = new THREE.MeshStandardMaterial({ color: '#6B4226', roughness: 0.9 });
      const pineTopGeo = new THREE.ConeGeometry(0.62, 1.55, 7);
      pineTopGeo.translate(0, 1.25, 0);
      const pineTopMat = new THREE.MeshStandardMaterial({ color: '#1E6B43', roughness: 0.85 });

      const trunkInst = new THREE.InstancedMesh(pineTrunkGeo, pineTrunkMat, treeCount);
      const canopyInst = new THREE.InstancedMesh(pineTopGeo, pineTopMat, treeCount);
      trunkInst.castShadow = renderer.shadowMap.enabled;
      canopyInst.castShadow = renderer.shadowMap.enabled;

      for (let i = 0; i < treeCount; i++) {
        const ang = (i / treeCount) * Math.PI * 2 + (i % 3) * 0.22;
        const dist = 10.6 + (i % 5) * 2.1;
        const sc = 0.85 + ((i * 17) % 10) * 0.04;
        _tmpVecA.set(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
        _tmpEuler.set(0, ang, 0);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(sc, sc, sc);
        _tmpMat4.compose(_tmpVecA, _tmpQuat, _tmpScale);
        trunkInst.setMatrixAt(i, _tmpMat4);
        canopyInst.setMatrixAt(i, _tmpMat4);
        _tmpColor.setHSL(0.39 + (i % 4) * 0.015, 0.52, 0.25 + (i % 3) * 0.04);
        canopyInst.setColorAt(i, _tmpColor);
      }
      if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
      trunkInst.computeBoundingSphere();
      canopyInst.computeBoundingSphere();
      scene.add(trunkInst);
      scene.add(canopyInst);

      // Stylized Clouds above 55% mountain height
      const cloudGroup = new THREE.Group();
      const cloudCount =
        qualityRef.current === 'LOW' ? 3 : qualityRef.current === 'MEDIUM' ? 6 : 10;
      const cloudGeo = new THREE.SphereGeometry(0.85, 10, 8);
      const cloudMat = new THREE.MeshStandardMaterial({
        color: '#FFFFFF',
        roughness: 0.92,
        transparent: true,
        opacity: 0.88,
      });
      for (let i = 0; i < cloudCount; i++) {
        const cItem = new THREE.Group();
        const puffs = [
          { x: 0, y: 0, z: 0, s: 1.0 },
          { x: 0.72, y: -0.1, z: 0.15, s: 0.76 },
          { x: -0.7, y: -0.12, z: -0.1, s: 0.72 },
        ];
        puffs.forEach((p) => {
          const pm = new THREE.Mesh(cloudGeo, cloudMat);
          pm.position.set(p.x, p.y, p.z);
          pm.scale.setScalar(p.s);
          cItem.add(pm);
        });
        const angle = (i / cloudCount) * Math.PI * 2;
        const radius = 8.5 + (i % 3) * 2.4;
        cItem.position.set(Math.cos(angle) * radius, 8.8 + (i % 4) * 1.15, Math.sin(angle) * radius);
        cItem.userData = { baseAngle: angle, radius, speed: 0.05 + (i % 3) * 0.02 };
        cloudGroup.add(cItem);
      }
      scene.add(cloudGroup);
      threeRef.current.cloudGroup = cloudGroup;

      // ------------------------------------------------------------------
      // 5. SHARED CLIMBER GEOMETRIES + ROOT GROUP
      // ------------------------------------------------------------------
      const bootGeo = new THREE.BoxGeometry(0.16, 0.14, 0.24);
      const legGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.34, 8);
      const torsoGeo = new THREE.CylinderGeometry(0.19, 0.22, 0.44, 10);
      const packGeo = new THREE.BoxGeometry(0.28, 0.34, 0.16);
      const headGeo = new THREE.SphereGeometry(0.17, 12, 10);
      const helmetGeo = new THREE.SphereGeometry(0.185, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.56);
      const poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.78, 6);

      const darkBootMat = new THREE.MeshStandardMaterial({ color: '#1E293B', roughness: 0.7 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: '#0F172A', roughness: 0.8 });
      const skinMat = new THREE.MeshStandardMaterial({ color: '#FDBA74', roughness: 0.65 });
      const packMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.72 });
      const poleMat = new THREE.MeshStandardMaterial({ color: '#CBD5E1', metalness: 0.8, roughness: 0.25 });

      threeRef.current.sharedGeos = [bootGeo, legGeo, torsoGeo, packGeo, headGeo, helmetGeo, poleGeo];
      threeRef.current.sharedMats = [darkBootMat, pantsMat, skinMat, packMat, poleMat];

      const climbersRoot = new THREE.Group();
      scene.add(climbersRoot);
      threeRef.current.climbersRoot = climbersRoot;

      const syncClimberPool = (nodes: RenderNodeGroup[]) => {
        const pool = threeRef.current.climberPool;
        const activeKeys = new Set(nodes.map((n) => n.key));

        // Remove stale nodes
        pool.forEach((entry, k) => {
          if (!activeKeys.has(k)) {
            climbersRoot.remove(entry.group);
            entry.jacketMat.dispose();
            entry.flagClothMat.dispose();
            pool.delete(k);
          }
        });

        // Compute slot grouping for exact co-located climbers so they stand side-by-side cleanly
        const byBucket = new Map<string, RenderNodeGroup[]>();
        nodes.forEach((n) => {
          const bKey = n.isSummit ? 'summit' : `b_${Math.round(n.progress * 40)}`;
          const arr = byBucket.get(bKey) || [];
          arr.push(n);
          byBucket.set(bKey, arr);
        });

        nodes.forEach((node) => {
          const bKey = node.isSummit ? 'summit' : `b_${Math.round(node.progress * 40)}`;
          const siblings = byBucket.get(bKey) || [node];
          const slotIndex = siblings.findIndex((s) => s.key === node.key);
          const slotTotal = siblings.length;

          let entry = pool.get(node.key);
          if (!entry) {
            const g = new THREE.Group();
            const jacketMat = new THREE.MeshStandardMaterial({
              color: node.colorHex,
              roughness: 0.45,
              metalness: 0.1,
            });
            const flagClothMat = new THREE.MeshStandardMaterial({
              color: '#FBBF24',
              roughness: 0.4,
              emissive: '#F59E0B',
              emissiveIntensity: 0.35,
            });

            const bootL = new THREE.Mesh(bootGeo, darkBootMat);
            bootL.position.set(-0.09, 0.07, 0.02);
            const bootR = new THREE.Mesh(bootGeo, darkBootMat);
            bootR.position.set(0.09, 0.07, 0.02);

            const legL = new THREE.Mesh(legGeo, pantsMat);
            legL.position.set(-0.09, 0.29, 0);
            const legR = new THREE.Mesh(legGeo, pantsMat);
            legR.position.set(0.09, 0.29, 0);

            const body = new THREE.Mesh(torsoGeo, jacketMat);
            body.position.set(0, 0.65, 0);
            body.castShadow = true;

            const pack = new THREE.Mesh(packGeo, packMat);
            pack.position.set(0, 0.68, -0.2);

            const head = new THREE.Mesh(headGeo, skinMat);
            head.position.set(0, 1.02, 0.02);

            const helmet = new THREE.Mesh(helmetGeo, jacketMat);
            helmet.position.set(0, 1.05, 0.02);

            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(0.24, 0.44, 0.1);
            pole.rotation.x = 0.16;

            g.add(bootL, bootR, legL, legR, body, pack, head, helmet, pole);

            const initPos = getClimberWorldPosition(node.progress, slotIndex, slotTotal);
            g.position.set(initPos.x, initPos.y, initPos.z);
            g.rotation.y = initPos.yaw;
            climbersRoot.add(g);

            entry = {
              group: g,
              leftLeg: legL,
              rightLeg: legR,
              bodyMesh: body,
              currentProgress: node.progress,
              targetProgress: node.progress,
              slotIndex,
              slotTotal,
              colorHex: node.colorHex,
              walkPhase: 0,
              jacketMat,
              flagClothMat,
            };
            pool.set(node.key, entry);
          } else {
            entry.targetProgress = node.progress;
            entry.slotIndex = slotIndex;
            entry.slotTotal = slotTotal;
            if (entry.colorHex !== node.colorHex) {
              entry.colorHex = node.colorHex;
              entry.jacketMat.color.set(node.colorHex);
            }
          }
        });
      };

      syncClimberPool(renderNodesRef.current);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      resizeObserver = new ResizeObserver((entries) => {
        if (disposed || !renderer || !threeRef.current.camera) return;
        for (const en of entries) {
          const w = Math.max(320, Math.round(en.contentRect.width));
          const h = Math.max(240, Math.round(en.contentRect.height));
          threeRef.current.camera.aspect = w / h;
          threeRef.current.camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      });
      resizeObserver.observe(mountEl);

      // Monotonic clock loop with Software-WebGL fenceSync pacing
      let prevPerf = performance.now();
      let lastLabelSyncPerf = 0;
      let anyMovingWasTrue = false;

      const afterDraw = (cb: FrameRequestCallback) => {
        if (disposed) return;
        if (threeRef.current.isSoftwareGl && renderer) {
          const gl = renderer.getContext() as WebGL2RenderingContext;
          if (typeof gl.fenceSync === 'function') {
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            const poll = () => {
              if (disposed) return;
              const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
              if (state === gl.UNSIGNALED) {
                animId = window.setTimeout(poll, 5);
              } else {
                if (sync) gl.deleteSync(sync);
                animId = window.setTimeout(() => {
                  if (!disposed) animId = requestAnimationFrame(cb);
                }, 75);
              }
            };
            animId = window.setTimeout(poll, 5);
            return;
          }
          animId = window.setTimeout(() => {
            if (!disposed) animId = requestAnimationFrame(cb);
          }, 75);
        } else {
          animId = requestAnimationFrame(cb);
        }
      };

      const tick = (nowPerf: number) => {
        if (disposed) return;
        const dt = Math.min(0.05, Math.max(0.001, (nowPerf - prevPerf) / 1000));
        prevPerf = nowPerf;
        const tSec = nowPerf * 0.001;
        const isReduced = reducedMotionRef.current;

        // Sync climber targets cleanly
        const currentNodes = renderNodesRef.current;
        syncClimberPool(currentNodes);

        // Animate Summit Flag gently
        if (threeRef.current.flagMesh && !isReduced) {
          const flagPos = threeRef.current.flagMesh.geometry.attributes.position;
          for (let i = 0; i < flagPos.count; i++) {
            const fx = flagPos.getX(i);
            const wave = Math.sin(fx * 3.8 - tSec * 4.5) * 0.1 * (fx / 1.75);
            flagPos.setZ(i, wave);
          }
          flagPos.needsUpdate = true;
        }

        // Drift clouds gently
        if (threeRef.current.cloudGroup && !isReduced) {
          threeRef.current.cloudGroup.children.forEach((child) => {
            const ud = child.userData as { baseAngle: number; radius: number; speed: number };
            const ang = ud.baseAngle + tSec * ud.speed * 0.18;
            child.position.x = Math.cos(ang) * ud.radius;
            child.position.z = Math.sin(ang) * ud.radius;
          });
        }

        // Advance Climbers along mountain path
        let anyCurrentlyMoving = false;
        let maxLeaderProgress = 0;
        let leaderPos = getMountainTrailPoint(0);

        threeRef.current.climberPool.forEach((entry) => {
          const diff = entry.targetProgress - entry.currentProgress;
          if (Math.abs(diff) > 0.0015 && !isReduced) {
            anyCurrentlyMoving = true;
            entry.currentProgress = THREE.MathUtils.damp(
              entry.currentProgress,
              entry.targetProgress,
              3.4,
              dt
            );
            entry.walkPhase += dt * 11.5;
          } else {
            entry.currentProgress = entry.targetProgress;
            entry.walkPhase = THREE.MathUtils.damp(entry.walkPhase, 0, 8, dt);
          }

          if (entry.currentProgress >= maxLeaderProgress) {
            maxLeaderProgress = entry.currentProgress;
            leaderPos = getMountainTrailPoint(entry.currentProgress);
          }

          const wp = getClimberWorldPosition(
            entry.currentProgress,
            entry.slotIndex,
            entry.slotTotal
          );
          const bob = Math.abs(Math.sin(entry.walkPhase)) * 0.09;
          entry.group.position.set(wp.x, wp.y + bob, wp.z);
          entry.group.rotation.y = wp.yaw;
          entry.leftLeg.rotation.x = Math.sin(entry.walkPhase) * 0.45;
          entry.rightLeg.rotation.x = -Math.sin(entry.walkPhase) * 0.45;
        });

        if (anyMovingWasTrue && !anyCurrentlyMoving) {
          onSettledRef.current?.();
        }
        anyMovingWasTrue = anyCurrentlyMoving;

        // Camera Choreography
        if (threeRef.current.camera) {
          const preset = cameraPresetRef.current;
          const allowCamMove = cameraMotionRef.current && !isReduced;
          const orb = orbitOffsetRef.current;

          let tx = 0;
          let ty = 11.2;
          let tz = 24.5;
          let lx = 0;
          let ly = 6.8;
          let lz = 0;

          if (preset === 'SUMMIT') {
            tx = 5.5;
            ty = MOUNTAIN_HEIGHT + 3.6;
            tz = 10.5;
            lx = 0;
            ly = MOUNTAIN_HEIGHT + 0.8;
            lz = 0;
          } else if (preset === 'FOLLOW' && allowCamMove) {
            const focusP = Math.max(0.05, maxLeaderProgress);
            const focusPt = focusP >= 0.99 ? { x: 0, y: MOUNTAIN_HEIGHT, z: 0 } : leaderPos;
            const radialDirX = focusPt.x || 0.01;
            const radialDirZ = focusPt.z || 1;
            const rLen = Math.hypot(radialDirX, radialDirZ) || 1;
            tx = focusPt.x + (radialDirX / rLen) * 14.5;
            ty = Math.min(MOUNTAIN_HEIGHT + 5.5, focusPt.y + 4.8);
            tz = focusPt.z + (radialDirZ / rLen) * 14.5;
            lx = focusPt.x * 0.45;
            ly = Math.max(2.5, focusPt.y + 0.4);
            lz = focusPt.z * 0.45;
          } else {
            // OVERVIEW ("Xem toàn núi" or stationary mode)
            tx = 0;
            ty = 11.6;
            tz = 25.2;
            lx = 0;
            ly = 6.8;
            lz = 0;
          }

          // Apply gentle user drag orbit offset relative to look target
          _tmpVecA.set(tx - lx, ty - ly, tz - lz);
          if (Math.abs(orb.yaw) > 0.001 || Math.abs(orb.pitch) > 0.001 || Math.abs(orb.zoom - 1) > 0.001) {
            const baseDist = _tmpVecA.length() * orb.zoom;
            const curTheta = Math.atan2(_tmpVecA.x, _tmpVecA.z) + orb.yaw;
            const curPhi = Math.max(
              0.25,
              Math.min(Math.PI * 0.48, Math.acos(Math.max(-1, Math.min(1, _tmpVecA.y / (_tmpVecA.length() || 1)))) + orb.pitch)
            );
            tx = lx + baseDist * Math.sin(curPhi) * Math.sin(curTheta);
            ty = ly + baseDist * Math.cos(curPhi);
            tz = lz + baseDist * Math.sin(curPhi) * Math.cos(curTheta);
          }

          const camLambda = isReduced ? 9.0 : 3.8;
          threeRef.current.camPos.x = THREE.MathUtils.damp(threeRef.current.camPos.x, tx, camLambda, dt);
          threeRef.current.camPos.y = THREE.MathUtils.damp(threeRef.current.camPos.y, ty, camLambda, dt);
          threeRef.current.camPos.z = THREE.MathUtils.damp(threeRef.current.camPos.z, tz, camLambda, dt);

          threeRef.current.camTarget.x = THREE.MathUtils.damp(threeRef.current.camTarget.x, lx, camLambda, dt);
          threeRef.current.camTarget.y = THREE.MathUtils.damp(threeRef.current.camTarget.y, ly, camLambda, dt);
          threeRef.current.camTarget.z = THREE.MathUtils.damp(threeRef.current.camTarget.z, lz, camLambda, dt);

          threeRef.current.camera.position.copy(threeRef.current.camPos);
          threeRef.current.camera.lookAt(threeRef.current.camTarget);
          threeRef.current.camera.updateMatrixWorld();

          // Project 2D HUD labels smoothly (~14Hz or during movement)
          if (nowPerf - lastLabelSyncPerf > 75) {
            lastLabelSyncPerf = nowPerf;
            const labels: ProjectedLabel[] = [];
            currentNodes.forEach((node) => {
              const entry = threeRef.current.climberPool.get(node.key);
              if (!entry || !threeRef.current.camera) return;
              _tmpVecB.copy(entry.group.position);
              _tmpVecB.y += 1.48;
              _tmpVecB.project(threeRef.current.camera);
              const visible = _tmpVecB.z < 1 && _tmpVecB.z > -1;
              const xPercent = (_tmpVecB.x * 0.5 + 0.5) * 100;
              const yPercent = (-_tmpVecB.y * 0.5 + 0.5) * 100;
              labels.push({
                key: node.key,
                xPercent: Math.max(8, Math.min(92, xPercent)),
                yPercent: Math.max(10, Math.min(90, yPercent)),
                visible,
                title: node.title,
                subtitle: node.subtitle,
                colorHex: node.colorHex,
                isSummit: node.isSummit,
                count: node.members.length,
                members: node.members,
              });
            });
            setProjectedLabels(labels);
          }
        }

        if (renderer && scene && threeRef.current.camera) {
          renderer.render(scene, threeRef.current.camera);
        }

        afterDraw(tick);
      };

      animId = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('C08 WebGL unavailable, switching to 2D Mountain Trail fallback:', err);
      setWebglUnavailable(true);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      clearTimeout(animId);
      if (resizeObserver) resizeObserver.disconnect();

      threeRef.current.sharedGeos.forEach((g) => g.dispose());
      threeRef.current.sharedMats.forEach((m) => m.dispose());
      threeRef.current.sharedGeos = [];
      threeRef.current.sharedMats = [];
      threeRef.current.climberPool.forEach((entry) => {
        entry.jacketMat.dispose();
        entry.flagClothMat.dispose();
      });
      threeRef.current.climberPool.clear();

      if (scene) disposeSceneResources(scene);
      if (envRT) envRT.dispose();
      if (pmrem) pmrem.dispose();
      if (renderer) {
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
        renderer.dispose();
      }
      threeRef.current.renderer = null;
      threeRef.current.scene = null;
      threeRef.current.camera = null;
    };
  }, [use2DFallback]);

  // Apply dynamic quality changes without rebuilding context
  useEffect(() => {
    const r = threeRef.current.renderer;
    if (!r) return;
    const cap =
      threeRef.current.isSoftwareGl || qualityPreset === 'LOW'
        ? 1
        : qualityPreset === 'MEDIUM'
        ? 1.5
        : 2;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    r.shadowMap.enabled = !threeRef.current.isSoftwareGl && qualityPreset !== 'LOW';
  }, [qualityPreset]);

  // 2D Lightweight SVG Mountain Path Map Fallback (when WebGL unavailable or disabled)
  if (use2DFallback) {
    const fallbackPoints = [
      { u: 0.0, x: 14, y: 84, label: 'Chân núi' },
      { u: 0.33, x: 40, y: 63, label: 'Trạm 1' },
      { u: 0.67, x: 64, y: 40, label: 'Trạm 2' },
      { u: 1.0, x: 52, y: 16, label: 'Đỉnh Tri Thức' },
    ];

    const get2DPos = (u: number) => {
      const clamped = Math.max(0, Math.min(1, u));
      // Smooth switchback curve across the 2D mountain silhouette
      const x = 14 + Math.sin(clamped * Math.PI * 2.1) * 16 + clamped * 38;
      const y = 84 - clamped * 68;
      return { x: Math.max(10, Math.min(90, x)), y };
    };

    return (
      <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#0C4A6E] via-[#BAE6FD] to-[#D1FAE5] border border-cyan-300/40 select-none">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* Sky & Mountain Silhouette */}
          <defs>
            <linearGradient id="c08-mtn-2d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="28%" stopColor="#64748B" />
              <stop offset="68%" stopColor="#2D8A52" />
              <stop offset="100%" stopColor="#14532D" />
            </linearGradient>
          </defs>
          <polygon points="4,95 34,42 52,14 74,45 96,95" fill="url(#c08-mtn-2d)" />
          <polygon points="43,28 52,14 61,28 56,26 52,30 48,26" fill="#FFFFFF" />
          {/* Winding Trail */}
          <path
            d="M 14 84 Q 36 74, 40 63 T 64 40 T 52 16"
            fill="none"
            stroke="#FDE68A"
            strokeWidth="2.4"
            strokeDasharray="3 1.5"
            strokeLinecap="round"
          />
          {fallbackPoints.map((pt) => (
            <circle key={pt.label} cx={pt.x} cy={pt.y} r="2.2" fill="#06B6D4" stroke="#FFF" strokeWidth="0.7" />
          ))}
        </svg>

        <div className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-slate-950/75 text-white text-[11px] font-bold flex items-center gap-1.5">
          <Mountain className="w-3.5 h-3.5 text-cyan-300" />
          <span>Sơ đồ đường núi (Chế độ đồ họa nhẹ)</span>
        </div>

        {/* Climber Badges */}
        {renderNodes.map((node, idx) => {
          const p = get2DPos(node.progress);
          const staggerY = (idx % 3) * 14 - 14;
          return (
            <button
              key={node.key}
              type="button"
              onClick={() => {
                if (node.members.length > 1) setActiveClusterModal(node.members);
                onSelectCluster?.(node.members);
              }}
              style={{ left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%, calc(-50% + ${staggerY}px))` }}
              className="absolute z-10 px-2.5 py-1 rounded-xl bg-slate-950/90 text-white border border-white/30 shadow-md text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: node.colorHex }}
              />
              <span className="truncate max-w-[110px]">{node.title}</span>
              <span className="text-amber-300 tabular-nums">{node.subtitle}</span>
            </button>
          );
        })}

        {activeClusterModal && (
          <ClusterMembersModal
            members={activeClusterModal}
            onClose={() => setActiveClusterModal(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden bg-[#0B2545] border border-cyan-400/30 select-none"
      onPointerDown={(e) => {
        dragStateRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!dragStateRef.current.active) return;
        const dx = e.clientX - dragStateRef.current.lastX;
        const dy = e.clientY - dragStateRef.current.lastY;
        dragStateRef.current.lastX = e.clientX;
        dragStateRef.current.lastY = e.clientY;
        orbitOffsetRef.current.yaw -= dx * 0.0065;
        orbitOffsetRef.current.pitch = Math.max(
          -0.38,
          Math.min(0.45, orbitOffsetRef.current.pitch - dy * 0.005)
        );
      }}
      onPointerUp={() => {
        dragStateRef.current.active = false;
      }}
      onPointerLeave={() => {
        dragStateRef.current.active = false;
      }}
      onWheel={(e) => {
        orbitOffsetRef.current.zoom = Math.max(
          0.65,
          Math.min(1.45, orbitOffsetRef.current.zoom + e.deltaY * 0.0008)
        );
      }}
    >
      {/* Isolated WebGL Mount Container */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Mountain Theme Tag (Static, no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <div className="px-3 py-1.5 rounded-xl bg-[#081B38]/90 border border-cyan-400/35 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md">
          <Mountain className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>CHINH PHỤC ĐỈNH TRI THỨC</span>
          {stageLabel && (
            <>
              <span className="text-slate-400">·</span>
              <span className="text-amber-300">{stageLabel}</span>
            </>
          )}
        </div>
        {playMode === 'CONQUEST' && (
          <div className="px-3 py-1.5 rounded-xl bg-[#081B38]/90 border border-amber-400/40 text-amber-200 text-xs font-extrabold flex items-center gap-1.5 shadow-md tabular-nums">
            <Flag className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Mục tiêu: {summitThreshold}/{maxPossibleScore} điểm</span>
          </div>
        )}
      </div>

      {/* Subtle Bottom Helper Text */}
      {!compactBackdrop && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-[#081B38]/80 text-slate-200 text-[11px] font-semibold flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-cyan-300" />
          <span>Kéo để xoay góc nhìn 3D · Cuộn để thu phóng</span>
        </div>
      )}

      {/* Projected DOM Labels over 3D Climbers (Never overlap, clickable clusters) */}
      {!compactBackdrop &&
        projectedLabels.map((lbl, idx) => {
          if (!lbl.visible) return null;
          // Slight vertical stagger if multiple labels sit near identical screen spot
          const staggerOffset = (idx % 3) * -22;
          return (
            <button
              key={lbl.key}
              type="button"
              onClick={() => {
                if (lbl.count > 1) {
                  setActiveClusterModal(lbl.members);
                }
                onSelectCluster?.(lbl.members);
              }}
              style={{
                left: `${lbl.xPercent}%`,
                top: `${lbl.yPercent}%`,
                transform: `translate(-50%, calc(-100% + ${staggerOffset}px))`,
              }}
              className="absolute z-10 px-2.5 py-1 rounded-xl bg-[#081B38]/92 hover:bg-[#0F2D52] text-white border border-white/25 shadow-md text-[11px] font-extrabold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-transform hover:scale-105"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                style={{ backgroundColor: lbl.colorHex }}
              />
              <span className="max-w-[125px] truncate">{lbl.title}</span>
              <span className="text-amber-300 tabular-nums">{lbl.subtitle}</span>
              {lbl.isSummit && (
                <Flag className="w-3 h-3 text-amber-400 shrink-0" aria-label="Đạt đỉnh" />
              )}
            </button>
          );
        })}

      {/* Cluster Inspection Popover for 50-student or tied groups */}
      {activeClusterModal && (
        <ClusterMembersModal
          members={activeClusterModal}
          onClose={() => setActiveClusterModal(null)}
        />
      )}
    </div>
  );
};

const ClusterMembersModal: React.FC<{
  members: C08ComputedEntityState[];
  onClose: () => void;
}> = ({ members, onClose }) => (
  <div className="absolute inset-0 z-30 bg-[#081B38]/80 flex items-center justify-center p-4">
    <div className="w-full max-w-md bg-[#0F2D52] border border-cyan-400/40 rounded-2xl p-4 text-white shadow-2xl space-y-3">
      <div className="flex items-center justify-between border-b border-white/15 pb-2.5">
        <div className="flex items-center gap-2 text-sm font-extrabold text-cyan-200">
          <Users className="w-4 h-4 text-cyan-300" />
          <span>Chi tiết nhóm cùng cao độ ({members.length} thành viên)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          aria-label="Đóng chi tiết nhóm"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
        {members.map((m) => (
          <div
            key={m.participant.participantId}
            className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#081B38] border border-white/10 text-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: m.participant.colorHex }}
              />
              <span className="font-mono text-slate-300">{m.participant.code}</span>
              <span className="font-bold truncate">{m.participant.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 tabular-nums">
              <span className="font-black text-amber-300">{m.score}đ</span>
              <span className="text-cyan-300">{Math.round(m.progress * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default MountainClimb3DScene;
