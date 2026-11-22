import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  HanoiPegId,
  HANOI_PEG_IDS,
  HANOI_PEG_META,
  HanoiPegsState,
  getHanoiDiscStyle,
  getTopDisc,
} from './hanoiTower3dEngine';

export interface HanoiAnimatedMove {
  id: number;
  disc: number;
  from: HanoiPegId;
  to: HanoiPegId;
  fromSlot: number;
  toSlot: number;
}

export interface HanoiTower3DSceneProps {
  discCount: number;
  pegs: HanoiPegsState;
  selectedPeg: HanoiPegId | null;
  hintMove: { from: HanoiPegId; to: HanoiPegId; disc: number } | null;
  lastAnimatedMove: HanoiAnimatedMove | null;
  reducedMotion?: boolean;
  force2D?: boolean;
  disabled?: boolean;
  onSelectPeg: (peg: HanoiPegId) => void;
  onDragMove: (from: HanoiPegId, to: HanoiPegId) => void;
  onWebGLFallback?: () => void;
}

const PEG_X: Record<HanoiPegId, number> = {
  A: -3.5,
  B: 0,
  C: 3.5,
};

const BASE_TOP_Y = 0.0;
const PEG_HEIGHT = 3.55;
const LIFT_CLEARANCE_Y = PEG_HEIGHT + 0.52;

function getDiscMetrics(discCount: number, disc: number): { radius: number; height: number } {
  const n = Math.max(3, Math.min(8, discCount));
  const minR = 0.46;
  const maxR = 1.48;
  const t = n === 1 ? 0 : (disc - 1) / (n - 1);
  const radius = minR + t * (maxR - minR);
  const height = Math.min(0.42, 2.88 / Math.max(n, 4));
  return { radius, height };
}

function getSlotCenterY(discCount: number, slotIndex: number): number {
  const { height } = getDiscMetrics(discCount, 1);
  return BASE_TOP_Y + height * 0.5 + slotIndex * (height + 0.015);
}

function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 256);
    grad.addColorStop(0, '#6F492B');
    grad.addColorStop(0.5, '#7E5434');
    grad.addColorStop(1, '#5D3C22');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);
    for (let y = 0; y < 256; y += 3) {
      const alpha = 0.04 + ((y * 17) % 10) * 0.006;
      ctx.fillStyle = y % 6 === 0 ? `rgba(42, 22, 8, ${alpha})` : `rgba(180, 128, 82, ${alpha * 0.7})`;
      ctx.fillRect(0, y, 512, 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 64, 18, 128, 64, 118);
    grad.addColorStop(0, 'rgba(2, 6, 20, 0.72)');
    grad.addColorStop(0.65, 'rgba(2, 6, 20, 0.3)');
    grad.addColorStop(1, 'rgba(2, 6, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createDiscSideTexture(disc: number, hex: string, textOnDisc: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, 512, 128);
    // Subtle satin horizontal highlight band
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    // Paint clear readable disc number at front-facing angles around cylinder perimeter
    ctx.fillStyle = textOnDisc;
    ctx.font = '900 66px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Cylinder UV u=0.25/0.75 faces +Z/-Z depending on rotation; repeat 4 times cleanly
    [64, 192, 320, 448].forEach((cx) => {
      ctx.fillText(String(disc), cx, 66);
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.4, hh * 0.4);
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  return s;
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

/**
 * Responsive 2D SVG fallback keeping all 3 pegs & up to 8 discs cleanly visible on desktop & mobile.
 * Supports both click-to-select ("Chọn cọc nguồn -> Chọn cọc đích") AND drag-and-drop calling the exact same rules.
 */
export const HanoiTower2DBoard: React.FC<HanoiTower3DSceneProps> = ({
  discCount,
  pegs,
  selectedPeg,
  hintMove,
  disabled = false,
  onSelectPeg,
  onDragMove,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragFrom, setDragFrom] = useState<HanoiPegId | null>(null);
  const [dragHoverPeg, setDragHoverPeg] = useState<HanoiPegId | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const pegCenterX: Record<HanoiPegId, number> = { A: 170, B: 450, C: 730 };
  const baseTopY = 365;
  const pegTopY = 85;
  const maxDiscHeight = Math.min(30, 240 / Math.max(discCount, 4));
  const discGap = 3;

  const clientToSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 450, y: 200 };
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / Math.max(1, rect.width)) * 900;
    const y = ((clientY - rect.top) / Math.max(1, rect.height)) * 430;
    return { x, y };
  };

  const nearestPegFromSvgX = (x: number): HanoiPegId => {
    if (x < 310) return 'A';
    if (x < 590) return 'B';
    return 'C';
  };

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[360px] rounded-2xl bg-[#071226] border border-slate-700/70 overflow-hidden select-none flex flex-col justify-between p-2 sm:p-3">
      <svg
        ref={svgRef}
        viewBox="0 0 900 430"
        className="w-full h-full max-h-[410px] touch-none"
        role="img"
        aria-label="Bàn Tháp Hà Nội 2D gồm ba cọc A, B, C"
        onPointerMove={(e) => {
          if (!dragFrom || disabled) return;
          const pt = clientToSvgPoint(e.clientX, e.clientY);
          if (dragStartRef.current) {
            const dist = Math.hypot(
              e.clientX - dragStartRef.current.x,
              e.clientY - dragStartRef.current.y
            );
            if (dist > 8) dragStartRef.current.moved = true;
          }
          setDragCursor(pt);
          setDragHoverPeg(nearestPegFromSvgX(pt.x));
        }}
        onPointerUp={(e) => {
          if (!dragFrom) return;
          const from = dragFrom;
          const moved = Boolean(dragStartRef.current?.moved);
          const pt = clientToSvgPoint(e.clientX, e.clientY);
          const dropPeg = nearestPegFromSvgX(pt.x);
          setDragFrom(null);
          setDragHoverPeg(null);
          setDragCursor(null);
          dragStartRef.current = null;

          if (disabled) return;
          if (moved && dropPeg !== from) {
            onDragMove(from, dropPeg);
          } else {
            onSelectPeg(from);
          }
        }}
        onPointerCancel={() => {
          setDragFrom(null);
          setDragHoverPeg(null);
          setDragCursor(null);
          dragStartRef.current = null;
        }}
      >
        <defs>
          <linearGradient id="hanoiWoodBase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8C5F3B" />
            <stop offset="100%" stopColor="#5A3920" />
          </linearGradient>
          <linearGradient id="hanoiBrassPeg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#B89047" />
            <stop offset="45%" stopColor="#F0D088" />
            <stop offset="100%" stopColor="#8B682C" />
          </linearGradient>
        </defs>

        {/* Wooden Base Plinth */}
        <rect x="42" y={baseTopY} width="816" height="36" rx="12" fill="url(#hanoiWoodBase)" stroke="#A77A52" strokeWidth="2" />

        {/* Three Equal-Height Pegs + Interactive Hit Columns */}
        {HANOI_PEG_IDS.map((pegId) => {
          const cx = pegCenterX[pegId];
          const isSelected = selectedPeg === pegId;
          const isHintFrom = hintMove?.from === pegId;
          const isHintTo = hintMove?.to === pegId;
          const isDropHover = dragFrom !== null && dragHoverPeg === pegId && dragFrom !== pegId;
          const stack = pegs[pegId];
          const topDisc = getTopDisc(pegs, pegId);

          return (
            <g
              key={pegId}
              className={disabled ? '' : 'cursor-pointer'}
              onPointerDown={(e) => {
                if (disabled) return;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                if (selectedPeg === null && topDisc !== null) {
                  setDragFrom(pegId);
                  setDragHoverPeg(pegId);
                  dragStartRef.current = { x: e.clientX, y: e.clientY, moved: false };
                } else {
                  onSelectPeg(pegId);
                }
              }}
            >
              {/* Generous invisible hit zone per peg column */}
              <rect
                x={cx - 125}
                y={40}
                width={250}
                height={365}
                rx={16}
                fill={
                  isDropHover
                    ? 'rgba(45, 212, 191, 0.14)'
                    : isSelected
                    ? 'rgba(251, 191, 36, 0.10)'
                    : isHintFrom
                    ? 'rgba(251, 191, 36, 0.08)'
                    : isHintTo
                    ? 'rgba(45, 212, 191, 0.10)'
                    : 'transparent'
                }
                stroke={
                  isSelected
                    ? '#FBBF24'
                    : isHintTo || isDropHover
                    ? '#2DD4BF'
                    : isHintFrom
                    ? '#F59E0B'
                    : 'transparent'
                }
                strokeWidth={isSelected || isHintFrom || isHintTo || isDropHover ? 3 : 0}
                strokeDasharray={isHintTo || isDropHover ? '8 6' : undefined}
              />

              {/* Vertical Peg Rod */}
              <rect
                x={cx - 10}
                y={pegTopY}
                width={20}
                height={baseTopY - pegTopY}
                rx={10}
                fill="url(#hanoiBrassPeg)"
              />
              {/* Brass collar at base */}
              <rect x={cx - 22} y={baseTopY - 8} width={44} height={10} rx={4} fill="#D4AF6A" />

              {/* Stacked Discs */}
              {stack.map((disc, slotIdx) => {
                const isBeingDragged = dragFrom === pegId && dragStartRef.current?.moved && slotIdx === stack.length - 1;
                const isLifted = isSelected && slotIdx === stack.length - 1 && !isBeingDragged;
                const style = getHanoiDiscStyle(disc);
                const minW = 66;
                const maxW = 214;
                const ratio = discCount === 1 ? 0 : (disc - 1) / (discCount - 1);
                const w = minW + ratio * (maxW - minW);
                const y = isLifted
                  ? pegTopY - maxDiscHeight - 10
                  : baseTopY - (slotIdx + 1) * maxDiscHeight - slotIdx * discGap;

                return (
                  <g key={disc} opacity={isBeingDragged ? 0.35 : 1}>
                    <rect
                      x={cx - w / 2}
                      y={y}
                      width={w}
                      height={maxDiscHeight}
                      rx={maxDiscHeight / 2}
                      fill={style.hex}
                      stroke={isLifted ? '#FBBF24' : style.strokeHex}
                      strokeWidth={isLifted ? 3.5 : 2}
                    />
                    <text
                      x={cx}
                      y={y + maxDiscHeight / 2 + 1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={style.textOnDisc}
                      fontSize={Math.max(13, Math.min(18, maxDiscHeight - 6))}
                      fontWeight="900"
                    >
                      {disc}
                    </text>
                  </g>
                );
              })}

              {/* Peg Label on Base */}
              <text
                x={cx}
                y={baseTopY + 23}
                textAnchor="middle"
                fill="#F8FAFC"
                fontSize="15"
                fontWeight="800"
              >
                {HANOI_PEG_META[pegId].fullLabel}
              </text>
            </g>
          );
        })}

        {/* Floating dragged disc preview */}
        {dragFrom && dragStartRef.current?.moved && dragCursor && (() => {
          const disc = getTopDisc(pegs, dragFrom);
          if (disc === null) return null;
          const style = getHanoiDiscStyle(disc);
          const ratio = discCount === 1 ? 0 : (disc - 1) / (discCount - 1);
          const w = 66 + ratio * (214 - 66);
          return (
            <g pointerEvents="none">
              <rect
                x={dragCursor.x - w / 2}
                y={dragCursor.y - maxDiscHeight / 2}
                width={w}
                height={maxDiscHeight}
                rx={maxDiscHeight / 2}
                fill={style.hex}
                stroke="#FBBF24"
                strokeWidth="3.5"
              />
              <text
                x={dragCursor.x}
                y={dragCursor.y + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={style.textOnDisc}
                fontSize="16"
                fontWeight="900"
              >
                {disc}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
};

/**
 * Interactive 3D Wooden Tower of Hanoi Board (Three.js).
 * - Elevated front-three-quarter camera keeps all 3 pegs (A, B, C) & 3–8 discs cleanly inside frame.
 * - Supports both "Chọn cọc nguồn -> Chọn cọc đích" AND pointer drag-and-drop calling the exact same rules.
 * - Confirmed moves animate smoothly: Lift -> Glide Horizontally -> Lower into slot (or snap cleanly on Reduced Motion / next move).
 * - Auto-falls back to HanoiTower2DBoard when WebGL is unavailable or context is lost.
 */
export const HanoiTower3DScene: React.FC<HanoiTower3DSceneProps> = (props) => {
  const {
    discCount,
    pegs,
    selectedPeg,
    hintMove,
    lastAnimatedMove,
    reducedMotion = false,
    force2D = false,
    disabled = false,
    onSelectPeg,
    onDragMove,
    onWebGLFallback,
  } = props;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(() => !hasWebGLSupport());

  // Latest props in refs so Three.js scene never tears down on state updates
  const pegsRef = useRef<HanoiPegsState>(pegs);
  const discCountRef = useRef<number>(discCount);
  const selectedPegRef = useRef<HanoiPegId | null>(selectedPeg);
  const hintMoveRef = useRef<{ from: HanoiPegId; to: HanoiPegId; disc: number } | null>(hintMove);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const disabledRef = useRef<boolean>(disabled);
  const onSelectPegRef = useRef(onSelectPeg);
  const onDragMoveRef = useRef(onDragMove);

  const activeAnimRef = useRef<{
    move: HanoiAnimatedMove;
    progress: number; // 0..1
  } | null>(null);
  const lastSeenAnimIdRef = useRef<number>(0);

  const dragStateRef = useRef<{
    fromPeg: HanoiPegId;
    disc: number;
    startClientX: number;
    startClientY: number;
    isDragging: boolean;
    worldX: number;
    worldY: number;
    hoverPeg: HanoiPegId;
  } | null>(null);

  const requestRenderRef = useRef<(() => void) | null>(null);
  const rebuildDiscsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    pegsRef.current = pegs;
    requestRenderRef.current?.();
  }, [pegs]);

  useEffect(() => {
    discCountRef.current = discCount;
    rebuildDiscsRef.current?.();
    requestRenderRef.current?.();
  }, [discCount]);

  useEffect(() => {
    selectedPegRef.current = selectedPeg;
    requestRenderRef.current?.();
  }, [selectedPeg]);

  useEffect(() => {
    hintMoveRef.current = hintMove;
    requestRenderRef.current?.();
  }, [hintMove]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    if (reducedMotion) {
      activeAnimRef.current = null;
    }
    requestRenderRef.current?.();
  }, [reducedMotion]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    onSelectPegRef.current = onSelectPeg;
    onDragMoveRef.current = onDragMove;
  }, [onSelectPeg, onDragMove]);

  useEffect(() => {
    if (lastAnimatedMove && lastAnimatedMove.id !== lastSeenAnimIdRef.current) {
      lastSeenAnimIdRef.current = lastAnimatedMove.id;
      if (!reducedMotionRef.current) {
        activeAnimRef.current = { move: lastAnimatedMove, progress: 0 };
      } else {
        activeAnimRef.current = null;
      }
      requestRenderRef.current?.();
    }
  }, [lastAnimatedMove]);

  const use2D = force2D || webglUnavailable;

  useEffect(() => {
    if (use2D) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      onWebGLFallback?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 300);
    const height = Math.max(container.clientHeight, 300);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071226);
    scene.fog = new THREE.FogExp2(0x071226, 0.022);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 80);

    const fitCameraToAspect = (w: number, h: number) => {
      const aspect = Math.max(0.65, w / Math.max(1, h));
      camera.aspect = aspect;
      // Keep all 3 pegs (-5.1..+5.1 world X) comfortably inside narrow or wide viewports
      const baseZ = aspect < 1.35 ? 11.4 / Math.max(0.68, aspect / 1.35) : 11.4;
      camera.position.set(0, 4.95, Math.min(18.5, baseZ));
      camera.lookAt(0, 1.45, 0);
      camera.updateProjectionMatrix();
    };
    fitCameraToAspect(width, height);

    // Soft Balanced 3-Point Studio Lighting
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x0b162c, 0.92);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ea, 1.45);
    keyLight.position.set(5.5, 9.5, 7.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -7.5;
      keyLight.shadow.camera.right = 7.5;
      keyLight.shadow.camera.top = 6;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.72);
    rimLight.position.set(-6.0, 4.0, -5.5);
    scene.add(rimLight);

    // Static board & pegs group
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const staticDisposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
      textures: THREE.Texture[];
    } = { geometries: [], materials: [], textures: [] };

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      staticDisposables.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      staticDisposables.materials.push(m);
      return m;
    };

    // Floor surface & Contact Shadow
    const floorGeo = trackGeo(new THREE.PlaneGeometry(36, 26));
    const floorMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x08152b,
        roughness: 0.85,
        metalness: 0.1,
      })
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, -0.58, 0);
    floorMesh.receiveShadow = true;
    boardGroup.add(floorMesh);

    const contactTex = createContactShadowTexture();
    staticDisposables.textures.push(contactTex);
    const shadowPlane = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(12.2, 4.6)),
      trackMat(
        new THREE.MeshBasicMaterial({
          map: contactTex,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        })
      )
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -0.56, 0);
    boardGroup.add(shadowPlane);

    // Beveled Wooden Table Base Plinth
    const woodTex = createWoodTexture();
    woodTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    staticDisposables.textures.push(woodTex);

    const baseShape = createRoundedRectShape(10.8, 3.3, 0.36);
    const baseGeo = trackGeo(
      new THREE.ExtrudeGeometry(baseShape, {
        depth: 0.44,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.08,
        bevelSegments: 3,
      })
    );
    baseGeo.rotateX(-Math.PI / 2);
    const baseMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: woodTex,
        roughness: 0.48,
        metalness: 0.08,
      })
    );
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, -0.52, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    boardGroup.add(baseMesh);

    // Three Identical Pegs (Brass Rods + Wooden Finial Caps + Base Collars + Highlight Rings + Hitboxes)
    const brassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xd9b36c,
        metalness: 0.88,
        roughness: 0.24,
        clearcoat: 0.3,
      })
    );
    const finialMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x6f4729,
        roughness: 0.42,
        metalness: 0.08,
      })
    );

    const pegRings: Record<HanoiPegId, THREE.MeshStandardMaterial> = {} as Record<
      HanoiPegId,
      THREE.MeshStandardMaterial
    >;
    const pegHitboxes: THREE.Mesh[] = [];

    const rodGeo = trackGeo(new THREE.CylinderGeometry(0.145, 0.155, PEG_HEIGHT, 28));
    const collarGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.42, 0.14, 32));
    const finialGeo = trackGeo(new THREE.SphereGeometry(0.19, 20, 16));
    const ringGeo = trackGeo(new THREE.RingGeometry(1.42, 1.62, 48));
    ringGeo.rotateX(-Math.PI / 2);
    const hitGeo = trackGeo(new THREE.BoxGeometry(3.25, 4.8, 3.2));
    const hitMat = trackMat(new THREE.MeshBasicMaterial({ visible: false }));

    HANOI_PEG_IDS.forEach((pegId) => {
      const px = PEG_X[pegId];

      const rod = new THREE.Mesh(rodGeo, brassMat);
      rod.position.set(px, BASE_TOP_Y + PEG_HEIGHT / 2, 0);
      rod.castShadow = true;
      rod.receiveShadow = true;
      boardGroup.add(rod);

      const collar = new THREE.Mesh(collarGeo, brassMat);
      collar.position.set(px, BASE_TOP_Y + 0.06, 0);
      boardGroup.add(collar);

      const finial = new THREE.Mesh(finialGeo, finialMat);
      finial.position.set(px, BASE_TOP_Y + PEG_HEIGHT + 0.08, 0);
      finial.scale.set(1, 1.25, 1);
      boardGroup.add(finial);

      const ringMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.2,
          transparent: true,
          opacity: 0.0,
          roughness: 0.3,
          side: THREE.DoubleSide,
        })
      );
      pegRings[pegId] = ringMat;
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(px, BASE_TOP_Y + 0.015, 0);
      boardGroup.add(ringMesh);

      const hitbox = new THREE.Mesh(hitGeo, hitMat);
      hitbox.position.set(px, 2.0, 0);
      hitbox.userData.pegId = pegId;
      boardGroup.add(hitbox);
      pegHitboxes.push(hitbox);
    });

    // Dynamic Discs Group (rebuilt only when discCount changes)
    const discsGroup = new THREE.Group();
    scene.add(discsGroup);
    const discMeshes = new Map<number, THREE.Mesh>();
    let discDisposables: {
      geometries: THREE.BufferGeometry[];
      materials: THREE.Material[];
      textures: THREE.Texture[];
    } = { geometries: [], materials: [], textures: [] };

    const disposeDiscs = () => {
      discMeshes.forEach((m) => discsGroup.remove(m));
      discMeshes.clear();
      discDisposables.geometries.forEach((g) => g.dispose());
      discDisposables.materials.forEach((m) => m.dispose());
      discDisposables.textures.forEach((t) => t.dispose());
      discDisposables = { geometries: [], materials: [], textures: [] };
    };

    const buildDiscMeshes = () => {
      disposeDiscs();
      const n = discCountRef.current;
      const maxAniso = renderer.capabilities.getMaxAnisotropy();

      for (let d = 1; d <= n; d++) {
        const { radius, height } = getDiscMetrics(n, d);
        const style = getHanoiDiscStyle(d);

        // Beveled disc cylinder (clean top/bottom satin caps + numbered perimeter side texture)
        const geo = new THREE.CylinderGeometry(radius * 0.96, radius, height, 40, 1, false);
        const sideTex = createDiscSideTexture(d, style.hex, style.textOnDisc);
        sideTex.anisotropy = maxAniso;

        const sideMat = new THREE.MeshPhysicalMaterial({
          map: sideTex,
          roughness: 0.32,
          metalness: 0.08,
          clearcoat: 0.35,
        });
        const capMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(style.hex),
          roughness: 0.35,
          metalness: 0.06,
          clearcoat: 0.28,
        });

        discDisposables.geometries.push(geo);
        discDisposables.materials.push(sideMat, capMat);
        discDisposables.textures.push(sideTex);

        const mesh = new THREE.Mesh(geo, [sideMat, capMat, capMat]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        discsGroup.add(mesh);
        discMeshes.set(d, mesh);
      }
    };

    rebuildDiscsRef.current = buildDiscMeshes;
    buildDiscMeshes();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & Pointer Drag / Click Handling
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const dragIntersect = new THREE.Vector3();

    const getPegFromPointer = (clientX: number, clientY: number): HanoiPegId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(pegHitboxes, false);
      if (hits.length > 0) {
        return hits[0].object.userData.pegId as HanoiPegId;
      }
      // Analytical fallback on z=0 plane so clicks near edges still resolve cleanly
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        if (dragIntersect.x < -1.75) return 'A';
        if (dragIntersect.x > 1.75) return 'C';
        return 'B';
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (disabledRef.current) return;
      const peg = getPegFromPointer(e.clientX, e.clientY);
      if (!peg) return;

      renderer.domElement.setPointerCapture?.(e.pointerId);
      const top = getTopDisc(pegsRef.current, peg);

      // Start potential drag only when no peg is selected yet and peg has a top disc
      if (selectedPegRef.current === null && top !== null) {
        dragStateRef.current = {
          fromPeg: peg,
          disc: top,
          startClientX: e.clientX,
          startClientY: e.clientY,
          isDragging: false,
          worldX: PEG_X[peg],
          worldY: LIFT_CLEARANCE_Y,
          hoverPeg: peg,
        };
      } else {
        onSelectPegRef.current(peg);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || disabledRef.current) return;
      const dist = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (dist > 8) {
        drag.isDragging = true;
      }
      if (!drag.isDragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (raycaster.ray.intersectPlane(dragPlane, dragIntersect)) {
        drag.worldX = THREE.MathUtils.clamp(dragIntersect.x, -4.6, 4.6);
        drag.worldY = THREE.MathUtils.clamp(dragIntersect.y, 1.2, LIFT_CLEARANCE_Y + 0.65);
        drag.hoverPeg = drag.worldX < -1.75 ? 'A' : drag.worldX > 1.75 ? 'C' : 'B';
        requestRender();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      dragStateRef.current = null;
      if (disabledRef.current) {
        requestRender();
        return;
      }
      if (drag.isDragging) {
        const dropPeg = getPegFromPointer(e.clientX, e.clientY) ?? drag.hoverPeg;
        if (dropPeg !== drag.fromPeg) {
          onDragMoveRef.current(drag.fromPeg, dropPeg);
        }
      } else {
        onSelectPegRef.current(drag.fromPeg);
      }
      requestRender();
    };

    const onPointerCancel = () => {
      if (dragStateRef.current) {
        dragStateRef.current = null;
        requestRender();
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    // On-demand render & 3-phase disc transfer animation
    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastMs = performance.now();

    const syncDiscPositionsAndHighlights = (dt: number): boolean => {
      let needsAnotherFrame = false;
      const curPegs = pegsRef.current;
      const n = discCountRef.current;
      const selPeg = selectedPegRef.current;
      const hint = hintMoveRef.current;
      const drag = dragStateRef.current;

      // Update peg highlight rings (selected / hint / drag target)
      HANOI_PEG_IDS.forEach((pegId) => {
        const mat = pegRings[pegId];
        const isSel = selPeg === pegId;
        const isHintFrom = hint?.from === pegId;
        const isHintTo = hint?.to === pegId;
        const isDragDest = Boolean(drag?.isDragging && drag.hoverPeg === pegId && drag.fromPeg !== pegId);

        if (isSel) {
          mat.color.setHex(0xfbbf24);
          mat.emissive.setHex(0xf59e0b);
          mat.emissiveIntensity = 0.75;
          mat.opacity = 0.92;
        } else if (isDragDest || isHintTo) {
          mat.color.setHex(0x2dd4bf);
          mat.emissive.setHex(0x14b8a6);
          mat.emissiveIntensity = 0.85;
          mat.opacity = 0.92;
        } else if (isHintFrom) {
          mat.color.setHex(0xf59e0b);
          mat.emissive.setHex(0xd97706);
          mat.emissiveIntensity = 0.65;
          mat.opacity = 0.85;
        } else {
          mat.opacity = 0.0;
        }
      });

      // Place all discs at their authoritative board coordinates first
      HANOI_PEG_IDS.forEach((pegId) => {
        const stack = curPegs[pegId];
        stack.forEach((disc, slotIdx) => {
          const mesh = discMeshes.get(disc);
          if (!mesh) return;
          const isTop = slotIdx === stack.length - 1;
          const isSelectedTop = isTop && selPeg === pegId && !(drag?.isDragging);
          const x = PEG_X[pegId];
          const y = isSelectedTop ? LIFT_CLEARANCE_Y : getSlotCenterY(n, slotIdx);
          mesh.position.set(x, y, 0);
        });
      });

      // Apply 3-phase lift -> glide -> drop animation for confirmed move
      const anim = activeAnimRef.current;
      if (anim) {
        const durationSec = 0.34;
        anim.progress = Math.min(1, anim.progress + dt / durationSec);
        const mesh = discMeshes.get(anim.move.disc);
        if (mesh) {
          const x0 = PEG_X[anim.move.from];
          const y0 = getSlotCenterY(n, anim.move.fromSlot);
          const x1 = PEG_X[anim.move.to];
          const y1 = getSlotCenterY(n, anim.move.toSlot);
          const p = anim.progress;

          if (p < 0.3) {
            const t = p / 0.3;
            const e = 1 - Math.pow(1 - t, 2);
            mesh.position.set(x0, THREE.MathUtils.lerp(y0, LIFT_CLEARANCE_Y, e), 0);
          } else if (p < 0.72) {
            const t = (p - 0.3) / 0.42;
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            mesh.position.set(THREE.MathUtils.lerp(x0, x1, e), LIFT_CLEARANCE_Y, 0);
          } else {
            const t = (p - 0.72) / 0.28;
            const e = 1 - Math.pow(1 - t, 2);
            mesh.position.set(x1, THREE.MathUtils.lerp(LIFT_CLEARANCE_Y, y1, e), 0);
          }
        }
        if (anim.progress >= 1) {
          activeAnimRef.current = null;
        } else {
          needsAnotherFrame = true;
        }
      }

      // Override active dragged disc position if user is dragging
      if (drag?.isDragging) {
        const mesh = discMeshes.get(drag.disc);
        if (mesh) {
          mesh.position.set(drag.worldX, drag.worldY, 0.22);
        }
      }

      return needsAnotherFrame;
    };

    const afterDraw = (cb: () => void) => {
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
    };

    function requestRender() {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((nowMs) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.08, Math.max(0.004, (nowMs - lastMs) / 1000));
        lastMs = nowMs;

        const keepAnimating = syncDiscPositionsAndHighlights(dt);
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if ((renderDirty || keepAnimating) && !disposed) {
            requestRender();
          }
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    requestRenderRef.current = requestRender;
    requestRender();

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(Math.floor(entry.contentRect.width), 280);
      const h = Math.max(Math.floor(entry.contentRect.height), 260);
      fitCameraToAspect(w, h);
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      requestRenderRef.current = null;
      rebuildDiscsRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposeDiscs();
      staticDisposables.geometries.forEach((g) => g.dispose());
      staticDisposables.materials.forEach((m) => m.dispose());
      staticDisposables.textures.forEach((t) => t.dispose());
      envTarget.dispose();
      renderer.dispose();
    };
  }, [use2D, onWebGLFallback]);

  if (use2D) {
    return <HanoiTower2DBoard {...props} />;
  }

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[370px] rounded-2xl bg-[#071226] border border-slate-700/70 overflow-hidden select-none">
      {/* Dedicated WebGL canvas mount */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Subtle Bottom Peg Role Legend aligned over the wooden plinth (semantic readable text) */}
      <div className="pointer-events-none absolute bottom-2.5 inset-x-3 z-10 grid grid-cols-3 gap-2 text-center">
        {HANOI_PEG_IDS.map((pegId) => {
          const isSel = selectedPeg === pegId;
          const isHintFrom = hintMove?.from === pegId;
          const isHintTo = hintMove?.to === pegId;
          return (
            <div
              key={pegId}
              className={`rounded-lg px-2 py-1 text-[11px] sm:text-xs font-extrabold border ${
                isSel
                  ? 'bg-amber-400 text-[#061024] border-white'
                  : isHintTo
                  ? 'bg-teal-400 text-[#061024] border-white'
                  : isHintFrom
                  ? 'bg-amber-500/30 text-amber-100 border-amber-300'
                  : 'bg-[#061024]/78 text-slate-100 border-white/15'
              }`}
            >
              {HANOI_PEG_META[pegId].fullLabel}
            </div>
          );
        })}
      </div>
    </div>
  );
};
