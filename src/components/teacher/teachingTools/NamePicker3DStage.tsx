import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Disc } from 'lucide-react';
import { StudentCandidate } from '../studentCallRules';
import {
  WHEEL_3D_COLOR_PALETTE,
  buildWheel3DSliceItems,
  computeTargetWheelAngleRad,
  evaluateWheel3DSpinCurve,
  resolveWheelLabelMode,
} from '../games/wheel3dMath';
import { PickerStudentItem, PickerTurnRecord } from './namePickerEngine';

export function hasNamePickerWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
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

function toWheelCandidates(list: PickerStudentItem[]): StudentCandidate[] {
  return list.map((s) => ({
    id: s.id,
    code: s.code,
    fullName: s.fullName,
    isAbsent: !s.present,
  }));
}

function createWheelDiskTexture(
  slices: ReturnType<typeof buildWheel3DSliceItems>,
  labelMode: ReturnType<typeof resolveWheelLabelMode>
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = 512;
    const cy = 512;
    const r = 492;
    ctx.clearRect(0, 0, 1024, 1024);

    const n = slices.length;
    if (n === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill();
      ctx.fillStyle = '#082B52';
      ctx.font = '800 40px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chưa có ứng viên', cx, cy);
    } else {
      const sliceRad = (Math.PI * 2) / n;
      for (let i = 0; i < n; i++) {
        const sl = slices[i];
        // Texture coordinates for top circle face: -PI/2 aligns slice 0 at 12 o'clock (+Z top / -Z) cleanly
        const startA = -Math.PI / 2 + i * sliceRad - sliceRad / 2;
        const endA = startA + sliceRad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startA, endA);
        ctx.closePath();
        ctx.fillStyle = sl.colorHex || WHEEL_3D_COLOR_PALETTE[i % WHEEL_3D_COLOR_PALETTE.length].bg;
        ctx.fill();
        ctx.lineWidth = n > 28 ? 2 : 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        const mid = (startA + endA) / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(mid);
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const txt =
          labelMode === 'NUMBER_STT'
            ? sl.formattedStt
            : labelMode === 'SHORT_NAME'
              ? sl.shortLabel
              : sl.mediumLabel;
        const fSize = n > 34 ? 22 : n > 20 ? 27 : 33;
        ctx.font = `800 ${fSize}px "Be Vietnam Pro", system-ui, sans-serif`;
        ctx.fillText(txt, r - 28, 0, r * 0.68);
        ctx.restore();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCardFaceTexture(params: {
  topBadge: string;
  title: string;
  subtitle?: string;
  bgHex: string;
  borderHex: string;
  badgeBgHex: string;
  titleColorHex: string;
  subColorHex?: string;
}): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = params.bgHex;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, 304, 28);
    ctx.fill();

    ctx.strokeStyle = params.borderHex;
    ctx.lineWidth = 10;
    ctx.stroke();

    ctx.fillStyle = params.badgeBgHex;
    ctx.beginPath();
    ctx.roundRect(28, 24, 456, 48, 12);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(params.topBadge, 256, 48, 420);

    ctx.fillStyle = params.titleColorHex;
    const len = params.title.length;
    ctx.font = `900 ${len > 18 ? 36 : 44}px "Be Vietnam Pro", system-ui, sans-serif`;
    ctx.fillText(params.title, 256, params.subtitle ? 156 : 184, 450);

    if (params.subtitle) {
      ctx.fillStyle = params.subColorHex || '#475569';
      ctx.font = '700 26px "JetBrains Mono", monospace';
      ctx.fillText(params.subtitle, 256, 232, 430);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createDiePipTexture(value: number): THREE.CanvasTexture {
  const pipsMap: Record<number, [number, number][]> = {
    1: [[0.5, 0.5]],
    2: [
      [0.26, 0.26],
      [0.74, 0.74],
    ],
    3: [
      [0.25, 0.25],
      [0.5, 0.5],
      [0.75, 0.75],
    ],
    4: [
      [0.27, 0.27],
      [0.73, 0.27],
      [0.27, 0.73],
      [0.73, 0.73],
    ],
    5: [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.5, 0.5],
      [0.25, 0.75],
      [0.75, 0.75],
    ],
    6: [
      [0.28, 0.23],
      [0.72, 0.23],
      [0.28, 0.5],
      [0.72, 0.5],
      [0.28, 0.77],
      [0.72, 0.77],
    ],
  };

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 240, 240);

    const pts = pipsMap[value] || pipsMap[1];
    ctx.fillStyle = value === 1 || value === 6 ? '#DC2626' : '#082B52';
    for (const [px, py] of pts) {
      ctx.beginPath();
      ctx.arc(px * 256, py * 256, value === 1 ? 30 : 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createCoinFaceTexture(label: string, isHeads: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = isHeads ? '#F59E0B' : '#082B52';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isHeads ? '#FEF3C7' : '#38BDF8';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = isHeads ? '#082B52' : '#FFFFFF';
    ctx.font = '900 48px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 128, 118);

    ctx.font = '700 20px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText('SMART EDU', 128, 166);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ============================================================================
// MAIN 3D NAME PICKER STAGE ('wheel' | 'draw_box' | 'slot_machine' | 'flip_cards')
// ============================================================================
export interface NamePicker3DStageProps {
  mode: 'wheel' | 'draw_box' | 'slot_machine' | 'flip_cards';
  allStudents: PickerStudentItem[];
  eligiblePool: PickerStudentItem[];
  remainingPool: PickerStudentItem[];
  activeTurn: PickerTurnRecord | null;
  requestedK: number;
  reducedMotion: boolean;
  isFullscreen: boolean;
  onCompleteAnimation: () => void;
  onStartQuickTurn?: () => void;
  onOpenClassicA01?: () => void;
  onAutoFallback2D?: (reason: string) => void;
}

export const NamePicker3DStage: React.FC<NamePicker3DStageProps> = ({
  mode,
  allStudents,
  eligiblePool,
  remainingPool,
  activeTurn,
  requestedK,
  reducedMotion,
  isFullscreen,
  onCompleteAnimation,
  onStartQuickTurn,
  onOpenClassicA01,
  onAutoFallback2D,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCompleteRef = useRef(onCompleteAnimation);
  onCompleteRef.current = onCompleteAnimation;
  const onStartQuickRef = useRef(onStartQuickTurn);
  onStartQuickRef.current = onStartQuickTurn;
  const onFallbackRef = useRef(onAutoFallback2D);
  onFallbackRef.current = onAutoFallback2D;

  const isAnimating = Boolean(activeTurn && activeTurn.status === 'animating' && activeTurn.mode === mode);
  const isRevealed = Boolean(activeTurn && activeTurn.status === 'revealed');

  // Wheel slice prep
  const wheelRoster = useMemo(() => {
    const base = remainingPool.length > 0 ? remainingPool : eligiblePool;
    if (activeTurn && activeTurn.pickedStudents.length > 0) {
      const map = new Map(base.map((s) => [s.id, s]));
      activeTurn.pickedStudents.forEach((p) => {
        if (!map.has(p.id)) {
          map.set(p.id, {
            id: p.id,
            code: p.code,
            fullName: p.fullName,
            present: true,
            starred: false,
            score: 0,
          });
        }
      });
      return Array.from(map.values());
    }
    return base;
  }, [remainingPool, eligiblePool, activeTurn]);

  const wheelSlices = useMemo(
    () => buildWheel3DSliceItems(toWheelCandidates(wheelRoster), toWheelCandidates(allStudents)),
    [wheelRoster, allStudents]
  );

  const resolvedLabelMode = useMemo(
    () => resolveWheelLabelMode(wheelSlices.length, 'AUTO'),
    [wheelSlices.length]
  );

  // Flip-card state synchronized between 3D card clicks and HUD readout
  const flipCardCount = useMemo(() => {
    const k = activeTurn?.pickedStudents.length || requestedK;
    return Math.max(k, Math.min(8, Math.max(4, k + 3)));
  }, [activeTurn?.pickedStudents.length, requestedK]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const flippedIndicesRef = useRef<number[]>([]);
  flippedIndicesRef.current = flippedIndices;

  // Draw box / Slot machine progress state for live HUD readout
  const [revealedCountHUD, setRevealedCountHUD] = useState<number>(0);

  const stageStateRef = useRef({
    mode,
    activeTurn,
    reducedMotion,
    isAnimating,
    isRevealed,
    requestedK,
    flipCardCount,
    wheelSlices,
    resolvedLabelMode,
    eligiblePool,
    remainingPool,
  });
  stageStateRef.current = {
    mode,
    activeTurn,
    reducedMotion,
    isAnimating,
    isRevealed,
    requestedK,
    flipCardCount,
    wheelSlices,
    resolvedLabelMode,
    eligiblePool,
    remainingPool,
  };

  // Animation control ref updated cleanly when activeTurn changes
  const animCtrlRef = useRef<{
    turnId: string | null;
    startPerfMs: number;
    completed: boolean;
    wheelStartAngle: number;
    wheelDeltaRad: number;
    wheelCurrAngle: number;
    lastBoxCount: number;
    lastSlotCount: number;
  }>({
    turnId: null,
    startPerfMs: 0,
    completed: false,
    wheelStartAngle: 0,
    wheelDeltaRad: 0,
    wheelCurrAngle: 0,
    lastBoxCount: 0,
    lastSlotCount: 0,
  });

  // Trigger state sync on new activeTurn
  useEffect(() => {
    const ctrl = animCtrlRef.current;
    if (!activeTurn || activeTurn.mode !== mode) {
      ctrl.turnId = null;
      ctrl.completed = false;
      setFlippedIndices([]);
      setRevealedCountHUD(0);
      return;
    }

    if (activeTurn.status === 'revealed' || reducedMotion) {
      if (mode === 'wheel' && activeTurn.pickedStudents[0]) {
        const idx = Math.max(
          0,
          wheelSlices.findIndex((s) => s.student.id === activeTurn.pickedStudents[0].id)
        );
        const { targetAngleCwRad } = computeTargetWheelAngleRad({
          currentAngleCwRad: ctrl.wheelCurrAngle,
          selectedIndex: idx,
          sliceCount: Math.max(1, wheelSlices.length),
          fullSpins: 1,
          sliceOffsetFactor: 0,
        });
        ctrl.wheelCurrAngle = targetAngleCwRad;
      }
      if (mode === 'flip_cards') {
        setFlippedIndices(Array.from({ length: activeTurn.pickedStudents.length }, (_, i) => i));
      }
      setRevealedCountHUD(activeTurn.pickedStudents.length);
      ctrl.completed = true;
      if (activeTurn.status === 'animating') {
        onCompleteRef.current();
      }
      return;
    }

    if (ctrl.turnId !== activeTurn.turnId) {
      ctrl.turnId = activeTurn.turnId;
      ctrl.startPerfMs = performance.now();
      ctrl.completed = false;
      ctrl.lastBoxCount = 0;
      ctrl.lastSlotCount = 0;
      setRevealedCountHUD(0);

      if (mode === 'wheel' && activeTurn.pickedStudents[0]) {
        const idx = Math.max(
          0,
          wheelSlices.findIndex((s) => s.student.id === activeTurn.pickedStudents[0].id)
        );
        ctrl.wheelStartAngle = ctrl.wheelCurrAngle;
        const { totalDeltaRad } = computeTargetWheelAngleRad({
          currentAngleCwRad: ctrl.wheelStartAngle,
          selectedIndex: idx,
          sliceCount: Math.max(1, wheelSlices.length),
          fullSpins: 4,
          sliceOffsetFactor: 0,
        });
        ctrl.wheelDeltaRad = totalDeltaRad;
      }
      if (mode === 'flip_cards') {
        setFlippedIndices([]);
      }
    }
  }, [activeTurn?.turnId, activeTurn?.status, mode, reducedMotion]);

  // Auto-flip timer for flip_cards mode (allows manual click ahead too)
  useEffect(() => {
    if (mode !== 'flip_cards' || !activeTurn || activeTurn.status !== 'animating' || reducedMotion) {
      return;
    }
    const total = activeTurn.pickedStudents.length;
    const timers: number[] = [];
    for (let i = 0; i < total; i++) {
      timers.push(
        window.setTimeout(() => {
          setFlippedIndices((prev) => {
            if (prev.includes(i)) return prev;
            const next = [...prev, i];
            if (next.length >= total && !animCtrlRef.current.completed) {
              animCtrlRef.current.completed = true;
              window.setTimeout(() => onCompleteRef.current(), 280);
            }
            return next;
          });
        }, 380 + i * 440)
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [mode, activeTurn?.turnId, activeTurn?.status, reducedMotion]);

  // Three.js Renderer + Mode Scene Builder
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!hasNamePickerWebGL()) {
      onFallbackRef.current?.('Trình duyệt không hỗ trợ WebGL. Đã chuyển sang chế độ 2D nhẹ.');
      return;
    }

    const isSoftware = detectSoftwareWebGL();
    const width = Math.max(320, container.clientWidth || 720);
    const height = isFullscreen ? 420 : 340;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftware,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      onFallbackRef.current?.('Không khởi tạo được bộ dựng WebGL 3D. Đang chuyển về 2D.');
      return;
    }

    renderer.setPixelRatio(isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftware;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    canvas.style.display = 'block';
    canvas.style.borderRadius = '16px';
    container.innerHTML = '';
    container.appendChild(canvas);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      onFallbackRef.current?.('Mất kết nối đồ họa 3D. Đã chuyển về chế độ 2D.');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071A36');

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.85;
    envScene.dispose();

    const hemi = new THREE.HemisphereLight('#E0F2FE', '#0F172A', 0.9);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#FFFBEB', 1.65);
    keyLight.position.set(5, 9, 7);
    if (!isSoftware) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.75);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);

    const trackedGeos: THREE.BufferGeometry[] = [];
    const trackedMats: THREE.Material[] = [];
    const trackedTex: THREE.CanvasTexture[] = [];
    const tGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      trackedGeos.push(g);
      return g;
    };
    const tMat = <T extends THREE.Material>(m: T): T => {
      trackedMats.push(m);
      return m;
    };
    const tTex = (t: THREE.CanvasTexture): THREE.CanvasTexture => {
      trackedTex.push(t);
      return t;
    };

    // Smart EDU Studio Stage Pedestal
    const floorMesh = new THREE.Mesh(
      tGeo(new THREE.CylinderGeometry(7.2, 7.6, 0.3, 48)),
      tMat(new THREE.MeshStandardMaterial({ color: '#0B2347', roughness: 0.55, metalness: 0.25 }))
    );
    floorMesh.position.set(0, -1.65, 0);
    floorMesh.receiveShadow = !isSoftware;
    scene.add(floorMesh);

    // Mode-specific scene handles
    let wheelPivot: THREE.Group | null = null;
    let pointerPivot: THREE.Group | null = null;
    let chestLidPivot: THREE.Group | null = null;
    const chestBallots: THREE.Mesh[] = [];
    const slotDrums: THREE.Mesh[] = [];
    const slotDrumLabels: string[] = [];
    const flipCardGroups: Array<{ group: THREE.Group; frontMat: THREE.MeshStandardMaterial; backMat: THREE.MeshStandardMaterial; cardIdx: number }> = [];
    const cardTexCache = new Map<string, THREE.CanvasTexture>();

    const getCachedCardTex = (key: string, builder: () => THREE.CanvasTexture) => {
      let ex = cardTexCache.get(key);
      if (!ex) {
        ex = builder();
        cardTexCache.set(key, ex);
      }
      return ex;
    };

    if (mode === 'wheel') {
      camera.position.set(0, 1.3, 7.2);
      camera.lookAt(0, 0.1, 0);

      // Stand base + column
      const stand = new THREE.Mesh(
        tGeo(new THREE.CylinderGeometry(0.95, 1.35, 0.35, 32)),
        tMat(new THREE.MeshStandardMaterial({ color: '#1E293B', metalness: 0.6, roughness: 0.3 }))
      );
      stand.position.set(0, -1.4, -0.45);
      scene.add(stand);

      const pillar = new THREE.Mesh(
        tGeo(new THREE.CylinderGeometry(0.18, 0.22, 1.9, 20)),
        tMat(new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.25 }))
      );
      pillar.position.set(0, -0.5, -0.45);
      scene.add(pillar);

      const wheelTilt = new THREE.Group();
      wheelTilt.position.set(0, 0.22, 0);
      wheelTilt.rotation.x = Math.PI / 2 - 0.14;
      scene.add(wheelTilt);

      wheelPivot = new THREE.Group();
      wheelTilt.add(wheelPivot);

      const wheelDiskTex = tTex(createWheelDiskTexture(wheelSlices, resolvedLabelMode));
      const faceMat = tMat(new THREE.MeshStandardMaterial({ map: wheelDiskTex, roughness: 0.32 }));
      const sideMat = tMat(new THREE.MeshStandardMaterial({ color: '#082B52', metalness: 0.45, roughness: 0.35 }));
      const disk = new THREE.Mesh(
        tGeo(new THREE.CylinderGeometry(2.12, 2.12, 0.18, 64)),
        [sideMat, faceMat, sideMat]
      );
      disk.castShadow = !isSoftware;
      wheelPivot.add(disk);

      // Gold rim torus
      const rim = new THREE.Mesh(
        tGeo(new THREE.TorusGeometry(2.14, 0.085, 16, 64)),
        tMat(new THREE.MeshPhysicalMaterial({ color: '#F59E0B', metalness: 0.85, roughness: 0.2, clearcoat: 0.6 }))
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.04;
      wheelPivot.add(rim);

      // Brass pins around rim
      const pinCount = Math.min(36, Math.max(8, wheelSlices.length));
      const pinGeo = tGeo(new THREE.SphereGeometry(0.055, 12, 12));
      const pinMat = tMat(new THREE.MeshStandardMaterial({ color: '#FDE68A', metalness: 0.9, roughness: 0.15 }));
      for (let i = 0; i < pinCount; i++) {
        const a = (i / pinCount) * Math.PI * 2;
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.set(Math.sin(a) * 2.04, 0.12, -Math.cos(a) * 2.04);
        wheelPivot.add(pin);
      }

      // Center cap
      const cap = new THREE.Mesh(
        tGeo(new THREE.CylinderGeometry(0.32, 0.36, 0.26, 32)),
        tMat(new THREE.MeshPhysicalMaterial({ color: '#082B52', metalness: 0.5, roughness: 0.25, clearcoat: 0.8 }))
      );
      cap.position.y = 0.05;
      wheelPivot.add(cap);

      // 12 o'clock physical gold pointer
      pointerPivot = new THREE.Group();
      pointerPivot.position.set(0, 2.52, 0.18);
      scene.add(pointerPivot);
      const pointerCone = new THREE.Mesh(
        tGeo(new THREE.ConeGeometry(0.18, 0.46, 4)),
        tMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.8, roughness: 0.2 }))
      );
      pointerCone.rotation.z = Math.PI;
      pointerCone.position.y = -0.18;
      pointerPivot.add(pointerCone);
    } else if (mode === 'draw_box') {
      camera.position.set(0, 2.2, 6.9);
      camera.lookAt(0, 0.15, 0);

      const navyWood = tMat(new THREE.MeshStandardMaterial({ color: '#0F3C78', roughness: 0.4, metalness: 0.18 }));
      const goldTrim = tMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.82, roughness: 0.22 }));

      // Chest base + 4 walls (hollow interior feel)
      const base = new THREE.Mesh(tGeo(new THREE.BoxGeometry(2.6, 0.25, 1.7)), navyWood);
      base.position.set(0, -1.25, 0);
      scene.add(base);

      const frontWall = new THREE.Mesh(tGeo(new THREE.BoxGeometry(2.6, 1.15, 0.16)), navyWood);
      frontWall.position.set(0, -0.58, 0.77);
      scene.add(frontWall);

      const backWall = new THREE.Mesh(tGeo(new THREE.BoxGeometry(2.6, 1.15, 0.16)), navyWood);
      backWall.position.set(0, -0.58, -0.77);
      scene.add(backWall);

      const leftWall = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.16, 1.15, 1.54)), navyWood);
      leftWall.position.set(-1.22, -0.58, 0);
      scene.add(leftWall);

      const rightWall = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.16, 1.15, 1.54)), navyWood);
      rightWall.position.set(1.22, -0.58, 0);
      scene.add(rightWall);

      // Gold clasp & trim
      const clasp = new THREE.Mesh(tGeo(new THREE.BoxGeometry(0.42, 0.34, 0.22)), goldTrim);
      clasp.position.set(0, -0.15, 0.82);
      scene.add(clasp);

      const signTex = tTex(
        createCardFaceTexture({
          topBadge: 'HỘP BỐC THĂM SMART EDU',
          title: 'PHIẾU MAY MẮN',
          bgHex: '#082B52',
          borderHex: '#F59E0B',
          badgeBgHex: '#1769F4',
          titleColorHex: '#FDE68A',
        })
      );
      const signPlate = new THREE.Mesh(
        tGeo(new THREE.PlaneGeometry(1.75, 0.75)),
        tMat(new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 }))
      );
      signPlate.position.set(0, -0.62, 0.86);
      scene.add(signPlate);

      // Hinged lid
      chestLidPivot = new THREE.Group();
      chestLidPivot.position.set(0, 0.0, -0.78);
      scene.add(chestLidPivot);

      const lidMesh = new THREE.Mesh(tGeo(new THREE.BoxGeometry(2.68, 0.24, 1.76)), navyWood);
      lidMesh.position.set(0, 0.12, 0.78);
      chestLidPivot.add(lidMesh);

      const lidCrown = new THREE.Mesh(tGeo(new THREE.BoxGeometry(2.74, 0.08, 1.82)), goldTrim);
      lidCrown.position.set(0, 0.24, 0.78);
      chestLidPivot.add(lidCrown);

      // Pool of up to 6 rising golden ballot cards
      const bGeo = tGeo(new THREE.BoxGeometry(1.45, 0.92, 0.05));
      for (let i = 0; i < 6; i++) {
        const bMat = tMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.35 }));
        const bMesh = new THREE.Mesh(bGeo, bMat);
        bMesh.visible = false;
        scene.add(bMesh);
        chestBallots.push(bMesh);
      }
    } else if (mode === 'slot_machine') {
      camera.position.set(0, 0.55, 7.6);
      camera.lookAt(0, 0.05, 0);

      const count = Math.min(6, Math.max(1, activeTurn?.pickedStudents.length || requestedK));
      const casingW = Math.max(3.6, count * 1.38 + 0.9);
      const casing = new THREE.Mesh(
        tGeo(new THREE.BoxGeometry(casingW, 2.35, 1.25)),
        tMat(new THREE.MeshStandardMaterial({ color: '#0F2D52', metalness: 0.35, roughness: 0.42 }))
      );
      casing.position.set(0, 0, -0.45);
      scene.add(casing);

      const marqueeTex = tTex(
        createCardFaceTexture({
          topBadge: 'TÂY ĐÔ SMART EDU',
          title: 'BẢNG QUAY TÊN LỚP HỌC',
          bgHex: '#082B52',
          borderHex: '#F59E0B',
          badgeBgHex: '#1769F4',
          titleColorHex: '#FFFFFF',
        })
      );
      const marquee = new THREE.Mesh(
        tGeo(new THREE.PlaneGeometry(casingW * 0.75, 0.48)),
        tMat(new THREE.MeshStandardMaterial({ map: marqueeTex, roughness: 0.3 }))
      );
      marquee.position.set(0, 0.9, 0.2);
      scene.add(marquee);

      const reelGeo = tGeo(new THREE.CylinderGeometry(0.68, 0.68, 1.15, 24));
      const startX = -((count - 1) * 1.28) / 2;
      for (let i = 0; i < count; i++) {
        const reelMat = tMat(new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.32 }));
        const reel = new THREE.Mesh(reelGeo, reelMat);
        reel.rotation.z = Math.PI / 2;
        reel.position.set(startX + i * 1.28, -0.1, 0.1);
        scene.add(reel);
        slotDrums.push(reel);
        slotDrumLabels.push('');
      }
    } else if (mode === 'flip_cards') {
      camera.position.set(0, 0.65, 8.2);
      camera.lookAt(0, 0, 0);

      const cols = flipCardCount <= 4 ? flipCardCount : 4;
      const rows = Math.ceil(flipCardCount / cols);
      const cardW = 1.48;
      const cardH = 0.96;
      const gapX = 0.28;
      const gapY = 0.28;

      const cardBodyGeo = tGeo(new THREE.BoxGeometry(cardW, cardH, 0.06));
      const facePlaneGeo = tGeo(new THREE.PlaneGeometry(cardW * 0.96, cardH * 0.94));
      const edgeMat = tMat(new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.7, roughness: 0.25 }));

      for (let i = 0; i < flipCardCount; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const rowCols = r === rows - 1 ? flipCardCount - r * cols : cols;
        const x = (c - (rowCols - 1) / 2) * (cardW + gapX);
        const y = ((rows - 1) / 2 - r) * (cardH + gapY) + 0.1;

        const grp = new THREE.Group();
        grp.position.set(x, y, 0);
        scene.add(grp);

        const body = new THREE.Mesh(cardBodyGeo, edgeMat);
        grp.add(body);

        const backTex = getCachedCardTex(`BACK_${i}`, () =>
          createCardFaceTexture({
            topBadge: `THẺ BÍ MẬT #${i + 1}`,
            title: 'CHẠM ĐỂ LẬT',
            subtitle: 'Smart EDU',
            bgHex: '#0F3C78',
            borderHex: '#F59E0B',
            badgeBgHex: '#1769F4',
            titleColorHex: '#FFFFFF',
            subColorHex: '#BAE6FD',
          })
        );
        const backMat = tMat(new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.36 }));
        const backPlane = new THREE.Mesh(facePlaneGeo, backMat);
        backPlane.position.z = 0.036;
        backPlane.userData = { cardIdx: i };
        grp.add(backPlane);

        const frontMat = tMat(new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.32 }));
        const frontPlane = new THREE.Mesh(facePlaneGeo, frontMat);
        frontPlane.rotation.y = Math.PI;
        frontPlane.position.z = -0.036;
        frontPlane.userData = { cardIdx: i };
        grp.add(frontPlane);

        flipCardGroups.push({ group: grp, frontMat, backMat, cardIdx: i });
      }
    }

    // Raycaster for 3D Flip Cards interaction
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const handleCanvasClick = (e: MouseEvent) => {
      if (stageStateRef.current.mode !== 'flip_cards') return;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const targets = flipCardGroups.flatMap((fc) => fc.group.children);
      const hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        const hitIdx = hits[0].object.userData?.cardIdx as number | undefined;
        if (typeof hitIdx === 'number') {
          const st = stageStateRef.current;
          if (!st.activeTurn) {
            onStartQuickRef.current?.();
            return;
          }
          if (st.activeTurn.status === 'animating') {
            setFlippedIndices((prev) => {
              if (prev.includes(hitIdx)) return prev;
              const next = [...prev, hitIdx];
              if (next.length >= st.activeTurn!.pickedStudents.length && !animCtrlRef.current.completed) {
                animCtrlRef.current.completed = true;
                window.setTimeout(() => onCompleteRef.current(), 220);
              }
              return next;
            });
          }
        }
      }
    };
    if (mode === 'flip_cards') {
      canvas.style.cursor = 'pointer';
      canvas.addEventListener('click', handleCanvasClick);
    }

    const handleResize = () => {
      if (!container) return;
      const nw = Math.max(320, container.clientWidth || 720);
      camera.aspect = nw / height;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, height);
    };
    window.addEventListener('resize', handleResize);

    let rafId = 0;
    let disposed = false;

    const tickLoop = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(tickLoop);
      if (document.visibilityState === 'hidden') return;

      const st = stageStateRef.current;
      const ctrl = animCtrlRef.current;
      const nowPerf = performance.now();
      const elapsedMs = ctrl.startPerfMs > 0 ? Math.max(0, nowPerf - ctrl.startPerfMs) : 0;

      if (mode === 'wheel' && wheelPivot) {
        if (st.isAnimating && !st.reducedMotion) {
          const durationMs = 2600;
          const t = Math.min(1, elapsedMs / durationMs);
          const { progress, normalizedVelocity } = evaluateWheel3DSpinCurve(t);
          const curr = ctrl.wheelStartAngle + ctrl.wheelDeltaRad * progress;
          ctrl.wheelCurrAngle = curr;
          wheelPivot.rotation.y = -curr;

          if (pointerPivot) {
            const sliceRad = (Math.PI * 2) / Math.max(1, st.wheelSlices.length);
            const wobble =
              Math.abs(Math.sin((curr / sliceRad) * Math.PI)) *
              Math.min(0.45, normalizedVelocity * 0.42);
            pointerPivot.rotation.z = -wobble;
          }

          if (t >= 1 && !ctrl.completed) {
            ctrl.completed = true;
            if (pointerPivot) pointerPivot.rotation.z = 0;
            onCompleteRef.current();
          }
        } else {
          wheelPivot.rotation.y = -ctrl.wheelCurrAngle;
          if (pointerPivot) pointerPivot.rotation.z = 0;
        }
      } else if (mode === 'draw_box' && chestLidPivot) {
        const targetLidOpen = st.isAnimating || st.isRevealed ? -Math.PI * 0.42 : 0;
        chestLidPivot.rotation.x += (targetLidOpen - chestLidPivot.rotation.x) * 0.14;

        const picked = st.activeTurn?.pickedStudents || [];
        let showCount = 0;
        if (st.isRevealed || st.reducedMotion) {
          showCount = picked.length;
        } else if (st.isAnimating && picked.length > 0) {
          showCount = Math.min(picked.length, Math.floor(elapsedMs / 520));
          if (showCount !== ctrl.lastBoxCount) {
            ctrl.lastBoxCount = showCount;
            setRevealedCountHUD(showCount);
          }
          if (showCount >= picked.length && elapsedMs >= picked.length * 520 + 360 && !ctrl.completed) {
            ctrl.completed = true;
            onCompleteRef.current();
          }
        }

        chestBallots.forEach((bMesh, i) => {
          const stu = i < showCount ? picked[i] : null;
          if (!stu) {
            bMesh.visible = false;
            return;
          }
          bMesh.visible = true;
          const total = Math.max(1, showCount);
          const spacing = total <= 3 ? 1.65 : 1.18;
          const targetX = (i - (total - 1) / 2) * spacing;
          const targetY = total > 3 && i >= 3 ? 1.55 : 0.95;
          const targetZ = 0.65;
          bMesh.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 0.16);
          const tex = getCachedCardTex(`BAL_${i}_${stu.id}`, () =>
            createCardFaceTexture({
              topBadge: `PHIẾU #${i + 1} · MÃ ${stu.code}`,
              title: stu.fullName,
              bgHex: '#FFFBEB',
              borderHex: '#F59E0B',
              badgeBgHex: '#D97706',
              titleColorHex: '#082B52',
            })
          );
          const mat = bMesh.material as THREE.MeshStandardMaterial;
          if (mat.map !== tex) {
            mat.map = tex;
            mat.needsUpdate = true;
          }
        });
      } else if (mode === 'slot_machine') {
        const picked = st.activeTurn?.pickedStudents || [];
        const poolRef = st.remainingPool.length > 0 ? st.remainingPool : st.eligiblePool;
        let lockedCount = 0;
        if (st.isRevealed || st.reducedMotion) {
          lockedCount = picked.length;
        } else if (st.isAnimating && picked.length > 0) {
          lockedCount = Math.min(picked.length, Math.max(0, Math.floor((elapsedMs - 650) / 520)));
          if (lockedCount !== ctrl.lastSlotCount) {
            ctrl.lastSlotCount = lockedCount;
            setRevealedCountHUD(lockedCount);
          }
          if (
            lockedCount >= picked.length &&
            elapsedMs >= 650 + picked.length * 520 + 320 &&
            !ctrl.completed
          ) {
            ctrl.completed = true;
            onCompleteRef.current();
          }
        }

        slotDrums.forEach((drum, idx) => {
          const isLocked = idx < lockedCount && Boolean(picked[idx]);
          if (st.isAnimating && !isLocked) {
            drum.rotation.x += 0.28 + idx * 0.04;
          } else {
            // Smooth snap cylinder texture seam facing +Z camera
            drum.rotation.x = THREE.MathUtils.lerp(drum.rotation.x % (Math.PI * 2), 0, 0.22);
          }

          let shownName = 'CHỜ QUAY...';
          let shownCode = '';
          if (isLocked && picked[idx]) {
            shownName = picked[idx].fullName;
            shownCode = `Mã ${picked[idx].code}`;
          } else if (st.isAnimating && poolRef.length > 0) {
            const rollIdx = Math.floor(elapsedMs / 95 + idx * 3) % poolRef.length;
            shownName = poolRef[rollIdx].fullName;
            shownCode = `Mã ${poolRef[rollIdx].code}`;
          }

          const sig = `${isLocked ? 'L' : 'R'}|${shownName}|${shownCode}`;
          if (slotDrumLabels[idx] !== sig) {
            slotDrumLabels[idx] = sig;
            const tex = getCachedCardTex(`SLOT_${sig}`, () =>
              createCardFaceTexture({
                topBadge: `Ô SỐ ${idx + 1}`,
                title: shownName,
                subtitle: shownCode,
                bgHex: isLocked ? '#FFFFFF' : '#0F2D52',
                borderHex: isLocked ? '#F59E0B' : '#38BDF8',
                badgeBgHex: isLocked ? '#D97706' : '#1769F4',
                titleColorHex: isLocked ? '#082B52' : '#FFFFFF',
                subColorHex: isLocked ? '#475569' : '#BAE6FD',
              })
            );
            const mat = drum.material as THREE.MeshStandardMaterial;
            mat.map = tex;
            mat.needsUpdate = true;
          }
        });
      } else if (mode === 'flip_cards') {
        const picked = st.activeTurn?.pickedStudents || [];
        const currentFlipped = flippedIndicesRef.current;

        flipCardGroups.forEach((fc) => {
          const pos = currentFlipped.indexOf(fc.cardIdx);
          const stu = pos >= 0 && picked[pos] ? picked[pos] : null;
          const targetRotY = stu ? Math.PI : 0;
          fc.group.rotation.y += (targetRotY - fc.group.rotation.y) * 0.18;

          if (stu) {
            const tex = getCachedCardTex(`FRONT_${stu.id}`, () =>
              createCardFaceTexture({
                topBadge: 'ĐÃ CHỌN',
                title: stu.fullName,
                subtitle: `Mã HS: ${stu.code}`,
                bgHex: '#ECFDF5',
                borderHex: '#10B981',
                badgeBgHex: '#059669',
                titleColorHex: '#082B52',
                subColorHex: '#047857',
              })
            );
            if (fc.frontMat.map !== tex) {
              fc.frontMat.map = tex;
              fc.frontMat.needsUpdate = true;
            }
          }
        });
      }

      renderer.render(scene, camera);
    };

    rafId = window.requestAnimationFrame(tickLoop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      if (mode === 'flip_cards') {
        canvas.removeEventListener('click', handleCanvasClick);
      }
      envTarget.dispose();
      pmrem.dispose();
      trackedGeos.forEach((g) => g.dispose());
      trackedMats.forEach((m) => m.dispose());
      trackedTex.forEach((t) => t.dispose());
      cardTexCache.forEach((t) => t.dispose());
      cardTexCache.clear();
      renderer.dispose();
    };
  }, [mode, wheelSlices, resolvedLabelMode, isFullscreen, flipCardCount, requestedK]);

  return (
    <div className="space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-[#DCE8F7] bg-[#071A36]">
        <div
          ref={containerRef}
          aria-label="Sân khấu 3D Gọi tên & Bốc thăm"
          className="w-full"
        />

        {/* Crisp non-blur HUD strip below 3D stage */}
        <div className="bg-[#082B52] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-bold text-sky-200">
            {mode === 'wheel' &&
              `Vòng quay 3D (${wheelSlices.length} ứng viên) — Kim 12 giờ khóa đúng học sinh đã chọn`}
            {mode === 'draw_box' &&
              (isAnimating
                ? `Đang rút phiếu từ hộp 3D (${revealedCountHUD}/${activeTurn?.pickedStudents.length || 0})...`
                : `Hộp bốc thăm 3D sẵn sàng (${remainingPool.length} phiếu tên)`)}
            {mode === 'slot_machine' &&
              (isAnimating
                ? `Đang khóa các trống quay (${revealedCountHUD}/${activeTurn?.pickedStudents.length || 0})...`
                : `Máy quay 3D sẵn sàng gọi ${requestedK} học sinh`)}
            {mode === 'flip_cards' &&
              `Chạm trực tiếp vào thẻ 3D trên sân khấu để lật mở (${flippedIndices.length}/${activeTurn?.pickedStudents.length || requestedK})`}
          </span>

          {mode === 'wheel' && onOpenClassicA01 && (
            <button
              type="button"
              onClick={onOpenClassicA01}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:underline cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5" />
              <span>Mở A01 gốc (kho trò chơi)</span>
            </button>
          )}
        </div>
      </div>

      {/* High-contrast 1920x1080 winner banner when turn is revealed */}
      {isRevealed && activeTurn && activeTurn.pickedStudents.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#082B52] via-[#0F3C78] to-[#1769F4] text-white shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/15">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Kết quả lượt gọi · {activeTurn.pickedStudents.length} học sinh được chọn
            </span>
            <span className="text-xs font-semibold text-sky-200">
              Mã lượt {activeTurn.turnId.slice(-6)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {activeTurn.pickedStudents.map((stu, idx) => (
              <div
                key={stu.id}
                className="px-4 py-3 rounded-xl bg-white/15 border border-white/20 flex items-center gap-3"
              >
                <span className="w-8 h-8 rounded-lg bg-amber-400 text-[#082B52] font-black text-sm flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div
                    className={`${
                      isFullscreen ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'
                    } font-extrabold text-white truncate`}
                    title={stu.fullName}
                  >
                    {stu.fullName}
                  </div>
                  <div className="text-xs font-mono text-sky-200">Mã HS: {stu.code}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPACT 3D DICE & COIN UTILITIES CANVAS
// ============================================================================
function getDieTargetEuler(value: number): [number, number, number] {
  // Cylinder/Box faces mapped cleanly so desired pip value faces +Y (top camera)
  // Box materials order: [+X: 3, -X: 4, +Y: 1, -Y: 6, +Z: 2, -Z: 5]
  switch (value) {
    case 1:
      return [0, 0, 0];
    case 6:
      return [Math.PI, 0, 0];
    case 2:
      return [-Math.PI / 2, 0, 0];
    case 5:
      return [Math.PI / 2, 0, 0];
    case 3:
      return [0, 0, Math.PI / 2];
    case 4:
      return [0, 0, -Math.PI / 2];
    default:
      return [0, 0, 0];
  }
}

export const Dice3DCanvas: React.FC<{
  values: number[];
  rolling: boolean;
}> = ({ values, rolling }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ values, rolling, spinUntilMs: 0 });
  const prevRollingRef = useRef(false);

  if (rolling && !prevRollingRef.current) {
    stateRef.current.spinUntilMs = performance.now() + 260;
  }
  prevRollingRef.current = rolling;
  stateRef.current.values = values;
  stateRef.current.rolling = rolling;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !hasNamePickerWebGL()) return;

    const isSw = detectSoftwareWebGL();
    const w = Math.max(180, el.clientWidth || 220);
    const h = 84;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isSw, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 30);
    camera.position.set(0, 3.3, 2.25);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#334155', 1.25));
    const dir = new THREE.DirectionalLight('#FFFBEB', 1.35);
    dir.position.set(3, 5, 4);
    scene.add(dir);

    const faceNums = [3, 4, 1, 6, 2, 5];
    const texs = faceNums.map((n) => createDiePipTexture(n));
    const mats = texs.map(
      (t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.05 })
    );
    const dieGeo = new THREE.BoxGeometry(0.86, 0.86, 0.86);

    const diceMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(dieGeo, mats);
      scene.add(m);
      diceMeshes.push(m);
    }

    let rafId = 0;
    let disposed = false;
    const loop = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;

      const cur = stateRef.current;
      const cnt = Math.max(1, Math.min(3, cur.values.length));
      const startX = -((cnt - 1) * 1.15) / 2;

      diceMeshes.forEach((mesh, idx) => {
        if (idx >= cnt) {
          mesh.visible = false;
          return;
        }
        mesh.visible = true;
        mesh.position.x = startX + idx * 1.15;

        if (cur.rolling) {
          mesh.rotation.x += 0.28 + idx * 0.05;
          mesh.rotation.y += 0.34;
          mesh.position.y = Math.abs(Math.sin(performance.now() * 0.018 + idx)) * 0.32;
        } else {
          const [tx, ty, tz] = getDieTargetEuler(cur.values[idx] || 1);
          mesh.rotation.x += (tx - mesh.rotation.x) * 0.26;
          mesh.rotation.y += (ty - mesh.rotation.y) * 0.26;
          mesh.rotation.z += (tz - mesh.rotation.z) * 0.26;
          mesh.position.y += (0 - mesh.position.y) * 0.26;
        }
      });

      renderer.render(scene, camera);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      dieGeo.dispose();
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, []);

  return <div ref={wrapRef} className="w-full h-[84px] flex items-center justify-center" />;
};

export const Coin3DCanvas: React.FC<{
  side: 'Sấp' | 'Ngửa' | null;
  flipping: boolean;
}> = ({ side, flipping }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ side, flipping });
  stateRef.current = { side, flipping };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || !hasNamePickerWebGL()) return;

    const isSw = detectSoftwareWebGL();
    const size = 84;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isSw, alpha: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(isSw ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.innerHTML = '';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
    camera.position.set(0, 2.5, 1.35);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#FFFFFF', '#1E293B', 1.35));
    const dir = new THREE.DirectionalLight('#FFFBEB', 1.45);
    dir.position.set(2, 4, 3);
    scene.add(dir);

    const headsTex = createCoinFaceTexture('NGỬA', true);
    const tailsTex = createCoinFaceTexture('SẤP', false);
    const rimMat = new THREE.MeshStandardMaterial({ color: '#F59E0B', metalness: 0.8, roughness: 0.22 });
    const headsMat = new THREE.MeshStandardMaterial({ map: headsTex, metalness: 0.35, roughness: 0.25 });
    const tailsMat = new THREE.MeshStandardMaterial({ map: tailsTex, metalness: 0.35, roughness: 0.25 });

    const coinGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.11, 36);
    const coinMesh = new THREE.Mesh(coinGeo, [rimMat, headsMat, tailsMat]);
    scene.add(coinMesh);

    let rafId = 0;
    let disposed = false;
    const loop = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(loop);
      if (document.visibilityState === 'hidden') return;

      const cur = stateRef.current;
      if (cur.flipping) {
        coinMesh.rotation.x += 0.42;
        coinMesh.position.y = Math.abs(Math.sin(performance.now() * 0.02)) * 0.35;
      } else {
        const targetX = cur.side === 'Sấp' ? Math.PI : 0;
        coinMesh.rotation.x += (targetX - (coinMesh.rotation.x % (Math.PI * 2))) * 0.24;
        coinMesh.position.y += (0 - coinMesh.position.y) * 0.24;
      }
      renderer.render(scene, camera);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      coinGeo.dispose();
      rimMat.dispose();
      headsMat.dispose();
      tailsMat.dispose();
      headsTex.dispose();
      tailsTex.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={wrapRef} className="w-[84px] h-[84px] shrink-0" />;
};
