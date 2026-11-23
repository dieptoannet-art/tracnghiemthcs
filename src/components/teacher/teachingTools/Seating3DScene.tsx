import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw } from 'lucide-react';
import {
  SeatingFlightFrame,
  SeatingProState,
  buildOrientedAislesView,
  formatStudentDisplayName,
  getAislePaletteByIndex,
} from './seatingProEngine';

export interface Seating3DSceneProps {
  state: SeatingProState;
  flightFrame: SeatingFlightFrame | null;
  interactive: boolean;
  selectedSeatId: string | null;
  selectedWaitingStudentId: string | null;
  onSeatClick: (seatId: string) => void;
  onAutoFallback2D?: (reason: string) => void;
}

function detectSoftwareWebGL(): boolean {
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

function hasWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

function drawSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  fgHex: string,
  borderHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = fgHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 38px "Be Vietnam Pro", system-ui, sans-serif';
    ctx.fillText(title, canvas.width / 2, subtitle ? 48 : 64, canvas.width - 32);
    if (subtitle) {
      ctx.font = '600 22px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.globalAlpha = 0.86;
      ctx.fillText(subtitle, canvas.width / 2, 90, canvas.width - 32);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function drawSeatPlaqueTexture(params: {
  primaryText: string;
  secondaryText: string | null;
  seatLabel: string;
  hasStudent: boolean;
  isLocked: boolean;
  isPinned: boolean;
  isSelected: boolean;
  isRecentlyLanded: boolean;
  isWaitingTarget: boolean;
  isAirborne: boolean;
  isBW: boolean;
  accentHex: string;
  borderHex: string;
}): THREE.CanvasTexture {
  const {
    primaryText,
    secondaryText,
    seatLabel,
    hasStudent,
    isLocked,
    isPinned,
    isSelected,
    isRecentlyLanded,
    isWaitingTarget,
    isAirborne,
    isBW,
    accentHex,
    borderHex,
  } = params;

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const isOccupiedOrFlying = (hasStudent || isAirborne) && !isLocked;

    let bg = '#F8FAFC';
    let border = '#CBD5E1';
    let textColor = '#64748B';
    let subColor = '#64748B';
    let codeColor = '#94A3B8';
    let useDashedBorder = false;

    if (isLocked) {
      bg = isBW ? '#E5E5E5' : '#F1F5F9';
      border = isBW ? '#111111' : '#94A3B8';
      textColor = isBW ? '#111111' : '#475569';
      codeColor = isBW ? '#222222' : '#64748B';
      useDashedBorder = true;
    } else if (isOccupiedOrFlying) {
      // Occupied seat or airborne card: full edge-to-edge aisle fill in color mode, solid border in BW
      bg = isBW ? '#FFFFFF' : accentHex;
      border = isBW
        ? '#000000'
        : isSelected
          ? '#FBBF24'
          : isRecentlyLanded
            ? '#FDE047'
            : isPinned
              ? '#FDE68A'
              : borderHex;
      textColor = isBW ? '#000000' : '#FFFFFF';
      subColor = isBW ? '#333333' : 'rgba(255, 255, 255, 0.88)';
      codeColor = isBW ? '#222222' : 'rgba(255, 255, 255, 0.86)';
      useDashedBorder = false;
    } else {
      // Empty seat: #F8FAFC background + dashed #CBD5E1 border
      bg = isBW
        ? '#FFFFFF'
        : isSelected
          ? '#FFFBEB'
          : isWaitingTarget
            ? '#ECFDF5'
            : '#F8FAFC';
      border = isBW
        ? '#000000'
        : isSelected
          ? '#F59E0B'
          : isWaitingTarget
            ? '#10B981'
            : '#CBD5E1';
      textColor = isBW ? '#444444' : isSelected ? '#082B52' : '#64748B';
      codeColor = isBW ? '#555555' : '#94A3B8';
      useDashedBorder = true;
    }

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(4, 4, 312, 168, 18);
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = isSelected || isRecentlyLanded || isAirborne || isPinned ? 8 : 5;
    if (useDashedBorder) ctx.setLineDash([12, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Top-left seat code C1, C2...
    ctx.fillStyle = codeColor;
    ctx.font = '800 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(seatLabel, 20, 26);

    if (isPinned && !isLocked) {
      ctx.fillStyle = isBW ? '#000000' : '#FDE68A';
      ctx.textAlign = 'right';
      ctx.font = '800 16px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('GHIM', 300, 26);
    } else if (isLocked) {
      ctx.fillStyle = isBW ? '#000000' : '#64748B';
      ctx.textAlign = 'right';
      ctx.font = '800 16px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('KHÓA', 300, 26);
    } else if (isSelected) {
      ctx.fillStyle = isBW ? '#000000' : '#FDE047';
      ctx.textAlign = 'right';
      ctx.font = '800 15px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('ĐANG CHỌN', 300, 26);
    }

    // Center student primary name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = textColor;

    if (isLocked) {
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(46, 58);
      ctx.lineTo(274, 154);
      ctx.moveTo(274, 58);
      ctx.lineTo(46, 154);
      ctx.stroke();

      ctx.fillStyle = isBW ? '#000000' : '#475569';
      ctx.font = '800 24px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('Khóa', 160, 104);
    } else if (isOccupiedOrFlying) {
      const words = primaryText.trim().split(/\s+/);
      const maxLineW = 282;
      ctx.font = '800 26px "Be Vietnam Pro", system-ui, sans-serif';
      const lines: string[] = [];
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width <= maxLineW || !cur) {
          cur = test;
        } else {
          lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);

      if (lines.length === 1) {
        const yMain = secondaryText ? 90 : 100;
        ctx.fillText(lines[0], 160, yMain, maxLineW);
      } else {
        ctx.font = '800 23px "Be Vietnam Pro", system-ui, sans-serif';
        const line1 = lines.slice(0, Math.ceil(lines.length / 2)).join(' ');
        const line2 = lines.slice(Math.ceil(lines.length / 2)).join(' ');
        const yTop = secondaryText ? 76 : 86;
        ctx.fillText(line1, 160, yTop, maxLineW);
        ctx.fillText(line2, 160, yTop + 28, maxLineW);
      }

      if (secondaryText) {
        ctx.fillStyle = subColor;
        ctx.font = '700 17px "JetBrains Mono", monospace';
        ctx.fillText(secondaryText, 160, 142, 280);
      }
    } else {
      ctx.font = '700 24px "Be Vietnam Pro", system-ui, sans-serif';
      ctx.fillText('Trống', 160, 102);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const Seating3DScene: React.FC<Seating3DSceneProps> = ({
  state,
  flightFrame,
  interactive,
  selectedSeatId,
  selectedWaitingStudentId,
  onSeatClick,
  onAutoFallback2D,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const orientedAisles = useMemo(
    () => buildOrientedAislesView(state.room, state.orientation),
    [state.room, state.orientation]
  );

  const studentIdxMap = useMemo(() => {
    const map = new Map<string, { stu: SeatingProState['students'][number]; stt: number }>();
    state.students.forEach((s, idx) => map.set(s.id, { stu: s, stt: idx + 1 }));
    return map;
  }, [state.students]);

  const onSeatClickRef = useRef(onSeatClick);
  onSeatClickRef.current = onSeatClick;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const flightFrameRef = useRef(flightFrame);
  flightFrameRef.current = flightFrame;
  const onFallbackRef = useRef(onAutoFallback2D);
  onFallbackRef.current = onAutoFallback2D;

  const sceneRuntimeRef = useRef<{
    seatPlaqueMeshes: Map<string, THREE.Mesh>;
    seatWorldPositions: Map<string, THREE.Vector3>;
    airbornePool: THREE.Mesh[];
    textureCache: Map<string, THREE.CanvasTexture>;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    defaultCamPos: THREE.Vector3;
    defaultTarget: THREE.Vector3;
    requestRender: () => void;
    stageBoundsWidth: number;
  } | null>(null);

  // Build structural classroom scene whenever room dimensions / orientation / colorTheme changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!hasWebGLSupport()) {
      const msg = 'Trình duyệt không hỗ trợ WebGL cho góc nhìn 3D Isometric.';
      setWebglError(msg);
      onFallbackRef.current?.(msg);
      return;
    }

    const isSoftware = detectSoftwareWebGL();
    const width = Math.max(320, container.clientWidth || 880);
    const height = Math.max(420, Math.min(580, Math.round(width * 0.56)));

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftware,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      const msg = 'Không khởi tạo được bộ dựng WebGL 3D. Đang chuyển về sơ đồ 2D.';
      setWebglError(msg);
      onFallbackRef.current?.(msg);
      return;
    }

    renderer.setPixelRatio(isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isSoftware;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    canvas.style.display = 'block';
    canvas.style.borderRadius = '14px';
    canvas.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(canvas);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
      const msg = 'Mất ngữ cảnh đồ họa 3D WebGL. Đã chuyển về chế độ 2D an toàn.';
      setWebglError(msg);
      onFallbackRef.current?.(msg);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    const isBW = state.colorTheme === 'bw';
    scene.background = new THREE.Color(isBW ? '#F4F4F5' : '#EAF2FF');

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new RoomEnvironment();
    const envTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.72;
    envScene.dispose();

    // Lighting rig: warm key + cool fill + soft ambient
    const hemiLight = new THREE.HemisphereLight('#F0F9FF', '#CBD5E1', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF7ED', 1.45);
    keyLight.position.set(12, 19, 11);
    if (!isSoftware) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 55;
      const d = 18;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
    }
    scene.add(keyLight);

    // Compute layout proportions from actual room aisles & desks
    const aisleCount = Math.max(1, orientedAisles.length);
    const maxDesks = Math.max(1, ...orientedAisles.map((a) => a.desks.length));
    const maxSeatsInAnyDesk = Math.max(
      2,
      ...orientedAisles.flatMap((a) => a.desks.map((d) => d.seatIds.length))
    );

    const aisleW = Math.max(2.6, maxSeatsInAnyDesk * 1.18 + 0.5);
    const aisleGap = 0.85;
    const totalRoomW = aisleCount * aisleW + Math.max(0, aisleCount - 1) * aisleGap + 2.6;
    const deskRowDepth = 2.05;
    const boardZoneDepth = 2.6;
    const totalRoomD = maxDesks * deskRowDepth + boardZoneDepth + 2.4;

    const trackedGeos: THREE.BufferGeometry[] = [];
    const trackedMats: THREE.Material[] = [];
    const trackedTextures: THREE.CanvasTexture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      trackedGeos.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      trackedMats.push(m);
      return m;
    };

    // Classroom floor platform
    const floorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#FFFFFF' : '#F8FAFC',
        roughness: 0.78,
        metalness: 0.04,
      })
    );
    const floorGeo = trackGeo(new THREE.BoxGeometry(totalRoomW, 0.24, totalRoomD));
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -0.12, 0);
    floorMesh.receiveShadow = !isSoftware;
    scene.add(floorMesh);

    // Trim skirt around floor
    const trimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#27272A' : '#0F2D52',
        roughness: 0.45,
        metalness: 0.2,
      })
    );
    const trimGeo = trackGeo(new THREE.BoxGeometry(totalRoomW + 0.28, 0.16, totalRoomD + 0.28));
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.set(0, -0.24, 0);
    scene.add(trimMesh);

    const isRotated180 = state.orientation === 'back_of_class';
    const frontZ = isRotated180 ? totalRoomD / 2 - 1.35 : -totalRoomD / 2 + 1.35;
    const deskStartZ = isRotated180 ? frontZ - 2.3 : frontZ + 2.3;
    const deskStepZ = isRotated180 ? -deskRowDepth : deskRowDepth;

    // Blackboard + Podium + Teacher Desk + Door
    const boardSignTex = drawSignTexture(
      `BẢNG LỚP · ${state.meta.className || 'LỚP HỌC'}`,
      state.orientation === 'front_board' ? 'Góc nhìn: Bảng ở phía trên' : 'Góc nhìn: Từ bục giảng nhìn xuống',
      isBW ? '#FFFFFF' : '#082B52',
      isBW ? '#000000' : '#FFFFFF',
      isBW ? '#000000' : '#38BDF8'
    );
    trackedTextures.push(boardSignTex);

    const boardFrameW = Math.min(totalRoomW - 4.4, 7.6);
    const boardBoxGeo = trackGeo(new THREE.BoxGeometry(boardFrameW, 1.35, 0.18));
    const boardBackMat = trackMat(
      new THREE.MeshStandardMaterial({ color: isBW ? '#18181B' : '#0F2D52', roughness: 0.5 })
    );
    const boardFaceMat = trackMat(
      new THREE.MeshStandardMaterial({ map: boardSignTex, roughness: 0.35 })
    );
    const boardMaterials = [
      boardBackMat,
      boardBackMat,
      boardBackMat,
      boardBackMat,
      isRotated180 ? boardBackMat : boardFaceMat,
      isRotated180 ? boardFaceMat : boardBackMat,
    ];
    const boardMesh = new THREE.Mesh(boardBoxGeo, boardMaterials);
    boardMesh.position.set(0, 1.02, frontZ);
    boardMesh.castShadow = !isSoftware;
    scene.add(boardMesh);

    // Podium under board
    const podiumGeo = trackGeo(new THREE.BoxGeometry(boardFrameW + 0.6, 0.16, 0.95));
    const podiumMat = trackMat(
      new THREE.MeshStandardMaterial({ color: isBW ? '#D4D4D8' : '#CBD5E1', roughness: 0.7 })
    );
    const podiumMesh = new THREE.Mesh(podiumGeo, podiumMat);
    podiumMesh.position.set(0, 0.08, frontZ + (isRotated180 ? -0.35 : 0.35));
    podiumMesh.receiveShadow = !isSoftware;
    scene.add(podiumMesh);

    // Door & Teacher Desk on opposite corners of front row
    const sideOffsetX = Math.max(boardFrameW / 2 + 1.25, totalRoomW / 2 - 1.35);
    const doorX = isRotated180 ? sideOffsetX : -sideOffsetX;
    const teacherDeskX = isRotated180 ? -sideOffsetX : sideOffsetX;

    const doorTex = drawSignTexture(
      'CỬA RA VÀO',
      '',
      isBW ? '#F4F4F5' : '#FEF3C7',
      isBW ? '#000000' : '#92400E',
      isBW ? '#000000' : '#D97706'
    );
    trackedTextures.push(doorTex);
    const doorGeo = trackGeo(new THREE.BoxGeometry(1.3, 1.6, 0.18));
    const doorMat = trackMat(new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.45 }));
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(doorX, 0.8, frontZ);
    scene.add(doorMesh);

    const tdTex = drawSignTexture(
      'BÀN GIÁO VIÊN',
      state.meta.teacherName || '',
      isBW ? '#FFFFFF' : '#EFF6FF',
      isBW ? '#000000' : '#082B52',
      isBW ? '#000000' : '#1769F4'
    );
    trackedTextures.push(tdTex);
    const tdGeo = trackGeo(new THREE.BoxGeometry(1.85, 0.62, 0.85));
    const tdMat = trackMat(new THREE.MeshStandardMaterial({ color: isBW ? '#E4E4E7' : '#DBEAFE', roughness: 0.5 }));
    const tdMesh = new THREE.Mesh(tdGeo, tdMat);
    tdMesh.position.set(teacherDeskX, 0.31, frontZ + (isRotated180 ? -0.25 : 0.25));
    tdMesh.castShadow = !isSoftware;
    scene.add(tdMesh);

    const tdSignGeo = trackGeo(new THREE.PlaneGeometry(1.65, 0.52));
    const tdSignMat = trackMat(new THREE.MeshStandardMaterial({ map: tdTex, roughness: 0.4 }));
    const tdSignMesh = new THREE.Mesh(tdSignGeo, tdSignMat);
    tdSignMesh.rotation.x = -Math.PI / 2;
    tdSignMesh.position.set(teacherDeskX, 0.63, frontZ + (isRotated180 ? -0.25 : 0.25));
    scene.add(tdSignMesh);

    // Reusable desk legs & chair materials
    const deskWoodMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#F4F4F5' : '#E7D5BA',
        roughness: 0.58,
        metalness: 0.05,
      })
    );
    const frontDeskHighlightMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#E4E4E7' : '#DBEAFE',
        roughness: 0.46,
        metalness: 0.08,
      })
    );
    const legSteelMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#27272A' : '#334155',
        roughness: 0.35,
        metalness: 0.55,
      })
    );
    const chairSeatMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: isBW ? '#52525B' : '#1E3A8A',
        roughness: 0.55,
      })
    );

    const legGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8));
    const chairSeatGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.07, 0.4));
    const chairBackGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.36, 0.06));
    const plaqueGeo = trackGeo(new THREE.PlaneGeometry(0.96, 0.52));

    const seatPlaqueMeshes = new Map<string, THREE.Mesh>();
    const seatWorldPositions = new Map<string, THREE.Vector3>();
    const textureCache = new Map<string, THREE.CanvasTexture>();

    const startAisleX = -((aisleCount - 1) * (aisleW + aisleGap)) / 2;

    orientedAisles.forEach((aView, viewIdx) => {
      const aisleX = startAisleX + viewIdx * (aisleW + aisleGap);
      const palette = getAislePaletteByIndex(aView.aisleIndex);
      const accentHex = isBW ? '#111111' : palette.fillHex;

      // Aisle floor runner strip + label header
      const stripMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: isBW ? '#E4E4E7' : '#E2ECFA',
          roughness: 0.85,
        })
      );
      const stripGeo = trackGeo(new THREE.PlaneGeometry(aisleW + 0.16, maxDesks * deskRowDepth + 0.4));
      const stripMesh = new THREE.Mesh(stripGeo, stripMat);
      stripMesh.rotation.x = -Math.PI / 2;
      const midDeskZ = deskStartZ + ((maxDesks - 1) * deskStepZ) / 2;
      stripMesh.position.set(aisleX, 0.008, midDeskZ);
      scene.add(stripMesh);

      const aisleBannerTex = drawSignTexture(
        aView.aisle.name.toUpperCase(),
        `${aView.desks.length} bàn`,
        isBW ? '#18181B' : accentHex,
        '#FFFFFF',
        '#FFFFFF'
      );
      trackedTextures.push(aisleBannerTex);
      const abGeo = trackGeo(new THREE.PlaneGeometry(aisleW * 0.72, 0.34));
      const abMat = trackMat(new THREE.MeshStandardMaterial({ map: aisleBannerTex, roughness: 0.45 }));
      const abMesh = new THREE.Mesh(abGeo, abMat);
      abMesh.rotation.x = -Math.PI / 2;
      abMesh.position.set(aisleX, 0.015, deskStartZ - deskStepZ * 0.62);
      scene.add(abMesh);

      aView.desks.forEach((dView, dIdx) => {
        const dz = deskStartZ + dIdx * deskStepZ;
        const sCount = Math.max(1, dView.seatIds.length);
        const deskW = Math.min(aisleW - 0.15, sCount * 1.12 + 0.18);
        const deskD = 0.78;
        const isFrontZone = dView.deskPhysicalIndex < state.constraints.frontPriorityDeskCount;

        // Tabletop
        const deskTopGeo = trackGeo(new THREE.BoxGeometry(deskW, 0.08, deskD));
        const deskMesh = new THREE.Mesh(
          deskTopGeo,
          isFrontZone ? frontDeskHighlightMat : deskWoodMat
        );
        deskMesh.position.set(aisleX, 0.64, dz);
        deskMesh.castShadow = !isSoftware;
        deskMesh.receiveShadow = !isSoftware;
        scene.add(deskMesh);

        // 4 legs
        const lx = deskW / 2 - 0.09;
        const lz = deskD / 2 - 0.09;
        [
          [-lx, -lz],
          [lx, -lz],
          [-lx, lz],
          [lx, lz],
        ].forEach(([ox, oz]) => {
          const leg = new THREE.Mesh(legGeo, legSteelMat);
          leg.position.set(aisleX + ox, 0.31, dz + oz);
          scene.add(leg);
        });

        // Seats + Chairs + Name Plaques
        const seatStepX = deskW / sCount;
        dView.seatIds.forEach((seatId, sIdx) => {
          const sx = aisleX - deskW / 2 + seatStepX * (sIdx + 0.5);
          const chairDirZ = isRotated180 ? -0.58 : 0.58;

          const cSeat = new THREE.Mesh(chairSeatGeo, chairSeatMat);
          cSeat.position.set(sx, 0.38, dz + chairDirZ);
          scene.add(cSeat);

          const cBack = new THREE.Mesh(chairBackGeo, chairSeatMat);
          cBack.position.set(sx, 0.58, dz + chairDirZ + (isRotated180 ? -0.17 : 0.17));
          scene.add(cBack);

          // Slightly angled plaque on top of desk so name reads legibly from isometric angle
          const pMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: '#FFFFFF',
              roughness: 0.42,
              metalness: 0.02,
            })
          );
          const plaque = new THREE.Mesh(plaqueGeo, pMat);
          const scaleX = Math.min(1, (seatStepX * 0.92) / 0.96);
          plaque.scale.set(scaleX, scaleX, 1);
          plaque.position.set(sx, 0.72, dz);
          plaque.rotation.x = -Math.PI / 2 + 0.24;
          plaque.userData = { seatId };
          scene.add(plaque);

          seatPlaqueMeshes.set(seatId, plaque);
          seatWorldPositions.set(seatId, new THREE.Vector3(sx, 0.76, dz));
        });
      });
    });

    // Reusable airborne flight card pool (supports up to 8 concurrent flights)
    const airbornePool: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const fMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: '#FFFFFF',
          roughness: 0.35,
          transparent: true,
        })
      );
      const fMesh = new THREE.Mesh(plaqueGeo, fMat);
      fMesh.visible = false;
      fMesh.rotation.x = -Math.PI / 2 + 0.3;
      scene.add(fMesh);
      airbornePool.push(fMesh);
    }

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 120);
    const camDist = Math.max(13, totalRoomW * 0.92, totalRoomD * 0.95);
    const defaultCamPos = new THREE.Vector3(
      0,
      camDist * 0.74,
      isRotated180 ? -camDist * 0.62 : camDist * 0.62
    );
    const defaultTarget = new THREE.Vector3(0, 0.35, 0);
    camera.position.copy(defaultCamPos);

    const controls = new OrbitControls(camera, canvas);
    controls.target.copy(defaultTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 6.5;
    controls.maxDistance = camDist * 1.9;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = 0.22;
    controls.update();

    let needsRender = true;
    let rafId = 0;
    let disposed = false;

    const requestRender = () => {
      needsRender = true;
    };

    const onControlChange = () => {
      needsRender = true;
    };
    controls.addEventListener('change', onControlChange);

    // Raycaster pointer picking (only fires seat click if pointer didn't drag camera)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let downX = 0;
    let downY = 0;

    const handlePointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!interactiveRef.current) {
        canvas.style.cursor = 'grab';
        return;
      }
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(Array.from(seatPlaqueMeshes.values()), false);
      canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!interactiveRef.current) return;
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist > 6) return; // User dragged camera
      const rect = canvas.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(Array.from(seatPlaqueMeshes.values()), false);
      if (hits.length > 0) {
        const hitSeatId = hits[0].object.userData?.seatId as string | undefined;
        if (hitSeatId) {
          onSeatClickRef.current(hitSeatId);
        }
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    const handleResize = () => {
      if (disposed || !container) return;
      const nextW = Math.max(320, container.clientWidth || 880);
      const nextH = Math.max(420, Math.min(580, Math.round(nextW * 0.56)));
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
      canvas.style.height = `${nextH}px`;
      needsRender = true;
    };
    window.addEventListener('resize', handleResize);

    const renderLoop = () => {
      if (disposed) return;
      rafId = window.requestAnimationFrame(renderLoop);
      if (document.visibilityState === 'hidden') return;
      const didDamp = controls.update();
      const hasAirborne = Boolean(flightFrameRef.current && flightFrameRef.current.airborneMoves.length > 0);
      if (needsRender || didDamp || hasAirborne) {
        needsRender = false;
        renderer.render(scene, camera);
      }
    };
    rafId = window.requestAnimationFrame(renderLoop);

    sceneRuntimeRef.current = {
      seatPlaqueMeshes,
      seatWorldPositions,
      airbornePool,
      textureCache,
      camera,
      controls,
      defaultCamPos,
      defaultTarget,
      requestRender,
      stageBoundsWidth: totalRoomW,
    };

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      envTarget.dispose();
      pmrem.dispose();
      trackedGeos.forEach((g) => g.dispose());
      trackedMats.forEach((m) => m.dispose());
      trackedTextures.forEach((t) => t.dispose());
      textureCache.forEach((t) => t.dispose());
      textureCache.clear();
      renderer.dispose();
      sceneRuntimeRef.current = null;
    };
  }, [
    orientedAisles,
    state.colorTheme,
    state.orientation,
    state.constraints.frontPriorityDeskCount,
    state.meta.className,
    state.meta.teacherName,
  ]);

  // Synchronize Seat Textures & Airborne Parabolic 3D Flights on state/frame updates without rebuilding geometry
  useEffect(() => {
    const rt = sceneRuntimeRef.current;
    if (!rt) return;

    const isBW = state.colorTheme === 'bw';
    const lockedSet = new Set(state.lockedSeatIds);
    const pinnedSet = new Set(state.pinnedSeatIds);
    const activeAssignments = flightFrame ? flightFrame.stationaryAssignments : state.assignments;
    const recentLanded = flightFrame?.recentlyLandedSeatIds;

    const seatAisleMap = new Map<string, { fillHex: string; borderHex: string }>();

    orientedAisles.forEach((aView) => {
      const palette = getAislePaletteByIndex(aView.aisleIndex);
      const accentHex = isBW ? '#111111' : palette.fillHex;
      const borderHex = isBW ? '#000000' : palette.borderHex;

      aView.desks.forEach((dView) => {
        dView.seatIds.forEach((seatId, sIdx) => {
          seatAisleMap.set(seatId, { fillHex: accentHex, borderHex });
          const mesh = rt.seatPlaqueMeshes.get(seatId);
          if (!mesh) return;
          const isLocked = lockedSet.has(seatId);
          const isPinned = pinnedSet.has(seatId);
          const stuId = activeAssignments[seatId] || null;
          const stuInfo = stuId ? studentIdxMap.get(stuId) : undefined;
          const hasStudent = Boolean(stuInfo) && !isLocked;
          const formatted = stuInfo
            ? formatStudentDisplayName({
                student: stuInfo.stu,
                sttIndex: stuInfo.stt,
                mode: state.nameDisplayMode,
                allStudents: state.students,
              })
            : null;
          const isSelected = selectedSeatId === seatId;
          const isRecentlyLanded = Boolean(recentLanded?.has(seatId));
          const isWaitingTarget =
            Boolean(selectedWaitingStudentId) && !isLocked && !(isPinned && stuId);
          const seatLabel = `C${sIdx + 1}`;
          const primaryText = formatted ? formatted.primary : isLocked ? 'Khóa' : 'Trống';
          const secondaryText = formatted?.secondaryCode || null;

          const cacheKey = [
            seatLabel,
            primaryText,
            secondaryText || '',
            hasStudent ? 'H' : 'E',
            isLocked ? 'L' : '',
            isPinned ? 'P' : '',
            isSelected ? 'S' : '',
            isRecentlyLanded ? 'R' : '',
            isWaitingTarget ? 'W' : '',
            isBW ? 'BW' : accentHex,
          ].join('|');

          let tex = rt.textureCache.get(cacheKey);
          if (!tex) {
            tex = drawSeatPlaqueTexture({
              primaryText,
              secondaryText,
              seatLabel,
              hasStudent,
              isLocked,
              isPinned,
              isSelected,
              isRecentlyLanded,
              isWaitingTarget,
              isAirborne: false,
              isBW,
              accentHex,
              borderHex,
            });
            rt.textureCache.set(cacheKey, tex);
          }

          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat.map !== tex) {
            mat.map = tex;
            mat.needsUpdate = true;
          }
        });
      });
    });

    // Position airborne parabolic flight plaques
    const moves = flightFrame?.airborneMoves || [];
    rt.airbornePool.forEach((mesh, idx) => {
      const active = moves[idx];
      if (!active) {
        mesh.visible = false;
        return;
      }
      const toPos = rt.seatWorldPositions.get(active.move.toSeatId);
      if (!toPos) {
        mesh.visible = false;
        return;
      }
      const fromPos = active.move.fromSeatId
        ? rt.seatWorldPositions.get(active.move.fromSeatId)
        : undefined;
      const startVec = fromPos
        ? fromPos
        : new THREE.Vector3(-rt.stageBoundsWidth / 2 + 0.8, 0.8, toPos.z);

      const t = active.easedProgress;
      const arcY = Math.sin(active.progress * Math.PI) * 1.45;
      mesh.position.set(
        THREE.MathUtils.lerp(startVec.x, toPos.x, t),
        THREE.MathUtils.lerp(startVec.y, toPos.y, t) + arcY + 0.25,
        THREE.MathUtils.lerp(startVec.z, toPos.z, t)
      );
      mesh.visible = true;

      const stuInfo = studentIdxMap.get(active.move.studentId);
      const formatted = stuInfo
        ? formatStudentDisplayName({
            student: stuInfo.stu,
            sttIndex: stuInfo.stt,
            mode: state.nameDisplayMode,
            allStudents: state.students,
          })
        : null;
      const airText = formatted ? formatted.primary : active.move.studentId;
      const airSub = formatted?.secondaryCode || null;
      const targetAisleColor = seatAisleMap.get(active.move.toSeatId) || {
        fillHex: '#0369A1',
        borderHex: '#075985',
      };
      const cacheKey = `AIR|${airText}|${airSub || ''}|${isBW ? 'BW' : targetAisleColor.fillHex}`;
      let tex = rt.textureCache.get(cacheKey);
      if (!tex) {
        tex = drawSeatPlaqueTexture({
          primaryText: airText,
          secondaryText: airSub,
          seatLabel: active.move.isSwap ? 'ĐỔI CHỖ' : 'XẾP CHỖ',
          hasStudent: true,
          isLocked: false,
          isPinned: false,
          isSelected: false,
          isRecentlyLanded: false,
          isWaitingTarget: false,
          isAirborne: true,
          isBW,
          accentHex: targetAisleColor.fillHex,
          borderHex: targetAisleColor.borderHex,
        });
        rt.textureCache.set(cacheKey, tex);
      }
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });

    rt.requestRender();
  }, [
    state,
    flightFrame,
    orientedAisles,
    studentIdxMap,
    selectedSeatId,
    selectedWaitingStudentId,
  ]);

  const handleResetCamera = () => {
    const rt = sceneRuntimeRef.current;
    if (!rt) return;
    rt.camera.position.copy(rt.defaultCamPos);
    rt.controls.target.copy(rt.defaultTarget);
    rt.controls.update();
    rt.requestRender();
  };

  if (webglError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
        {webglError}
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          Kéo chuột để xoay góc nhìn lớp học · Cuộn để thu phóng · Chạm trực tiếp vào mặt bàn để chọn hoặc đổi chỗ.
        </span>
        <button
          type="button"
          onClick={handleResetCamera}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-[#082B52] cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#1769F4]" />
          <span>Góc nhìn chuẩn</span>
        </button>
      </div>
      <div
        ref={containerRef}
        aria-label="Sơ đồ lớp học 3D Isometric"
        className="w-full min-h-[420px] rounded-2xl border border-[#DCE8F7] bg-[#EAF2FF] overflow-hidden"
      />
    </div>
  );
};
