/**
 * E02 — BẮT BÓNG KIẾN THỨC 3D — SCHOOL GYMNASIUM ARENA & 2D FALLBACK
 * - Bright maple hardwood indoor sports court (navy, emerald teal, yellow, white lines)
 * - Front-elevated camera keeping all 4 composite 3D athletic balls (A, B, C, D) + catching hoop basket in frame
 * - Direct raycast click on any 3D ball selects its label (A/B/C/D) without auto-committing
 * - Strict anti-spoiler visual parity before reveal (equal size, lighting, hover/bobbing across A–D)
 * - Smooth parabolic catch flight into hoop basket upon confirmation + instant snap on skipAnimationKey/reducedMotion
 * - Software-WebGL guard, RoomEnvironment reflections, webglcontextlost recovery, and crisp SVG 2D fallback
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CATCH_OPTION_LETTERS,
  CatchOptionLetter,
  E02_BALL_SLOT_THEMES,
} from './catchBall3dEngine';

export interface CatchBall3DSceneProps {
  /** Currently highlighted/selected ball letters before reveal (neutral ring only — never reveals answer) */
  selectedLabels: CatchOptionLetter[];
  /** Balls that fly into the catching basket on reveal */
  caughtLabels: CatchOptionLetter[];
  /** True only AFTER turn is confirmed/locked */
  isRevealed: boolean;
  /** Correct answer letter — strictly ignored by renderer until isRevealed === true */
  correctLabel?: CatchOptionLetter | null;
  /** Whether clicking a 3D ball triggers onSelectLabel */
  canInteract: boolean;
  /** Callback when user clicks ball A/B/C/D on the 3D or 2D stage */
  onSelectLabel?: (label: CatchOptionLetter) => void;
  /** Incrementing key to snap flight/net animations immediately to final state */
  skipAnimationKey: number;
  /** Accessibility reduced-motion mode */
  reducedMotion: boolean;
  /** Manual toggle or automatic fallback to lightweight 2D stage */
  force2D: boolean;
  /** Optional turn change token to reset ball flight smoothly */
  turnKey: string;
  /** Compact height for setup preview or full stage */
  compact?: boolean;
}

// Home positions for balls A, B, C, D (symmetrical front row, all 4 clearly inside 16:9 & narrow frustum)
const BALL_HOME_POSITIONS: Record<CatchOptionLetter, [number, number, number]> = {
  A: [-3.45, 1.55, -0.95],
  B: [-1.15, 1.55, -1.15],
  C: [1.15, 1.55, -1.15],
  D: [3.45, 1.55, -0.95],
};

const BASKET_CENTER = new THREE.Vector3(0, 1.48, 2.25);

// Reusable vectors outside animation loop (zero GC)
const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

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

function createHardwoodCourtTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Warm maple hardwood planks
    ctx.fillStyle = '#E6C28F';
    ctx.fillRect(0, 0, 1024, 1024);

    const plankH = 32;
    for (let y = 0; y < 1024; y += plankH) {
      const shade = ((y / plankH) % 3) * 6 - 6;
      ctx.fillStyle = `rgb(${230 + shade}, ${194 + shade}, ${142 + shade})`;
      ctx.fillRect(0, y, 1024, plankH - 1);
      ctx.fillStyle = 'rgba(130, 88, 42, 0.16)';
      ctx.fillRect(0, y + plankH - 1, 1024, 1);

      // Subtle vertical plank joints
      const offset = ((y / plankH) % 4) * 140;
      for (let x = offset; x < 1024; x += 256) {
        ctx.fillRect(x, y, 1, plankH);
      }
    }

    // Deep Navy outer court border
    ctx.strokeStyle = '#0F254A';
    ctx.lineWidth = 22;
    ctx.strokeRect(48, 48, 928, 928);

    // Emerald teal painted key lane
    ctx.fillStyle = 'rgba(13, 148, 136, 0.22)';
    ctx.fillRect(280, 560, 464, 380);
    ctx.strokeStyle = '#0D9488';
    ctx.lineWidth = 10;
    ctx.strokeRect(280, 560, 464, 380);

    // Crisp white center line & circle
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(48, 450);
    ctx.lineTo(976, 450);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(512, 450, 132, 0, Math.PI * 2);
    ctx.stroke();

    // Golden accent free-throw arc
    ctx.strokeStyle = '#EAB308';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(512, 560, 165, Math.PI, Math.PI * 2);
    ctx.stroke();

    // 4 clean landing markers for balls A–D
    const laneXs = [212, 412, 612, 812];
    laneXs.forEach((lx) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(lx, 315, 42, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createBallTexture(
  letter: CatchOptionLetter,
  primaryHex: string,
  seamHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Rich leather base gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, primaryHex);
    grad.addColorStop(0.5, primaryHex);
    grad.addColorStop(1, '#0A162C');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 256);

    // Subtle athletic pebble grain
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 420; i++) {
      const px = (i * 73) % 512;
      const py = (i * 41) % 256;
      ctx.fillRect(px, py, 2, 2);
    }

    // Athletic basketball-style seam curves
    ctx.strokeStyle = seamHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 128);
    ctx.lineTo(512, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(128, 0);
    ctx.lineTo(128, 256);
    ctx.moveTo(384, 0);
    ctx.lineTo(384, 256);
    ctx.stroke();

    // Side curved ribs
    ctx.beginPath();
    ctx.arc(0, 128, 86, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(512, 128, 86, Math.PI * 0.55, Math.PI * 1.45);
    ctx.stroke();

    // Crisp circular emblem on front (+Z maps to u ≈ 0.25 on Three.js SphereGeometry)
    const drawEmblem = (cx: number) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(cx, 128, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = seamHex;
      ctx.stroke();

      ctx.fillStyle = '#071226';
      ctx.font = '900 54px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letter, cx, 131);
    };
    drawEmblem(128);
    drawEmblem(384);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Lightweight 2D SVG Court & Ball Fallback (used automatically when WebGL is unavailable or toggled off).
 */
export const CatchBall2DStageFallback: React.FC<CatchBall3DSceneProps> = ({
  selectedLabels,
  caughtLabels,
  isRevealed,
  correctLabel,
  canInteract,
  onSelectLabel,
  compact = false,
}) => {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0A1930] select-none ${
        compact ? 'h-[190px]' : 'h-[220px] sm:h-[260px]'
      }`}
    >
      {/* Court SVG Backdrop */}
      <svg
        viewBox="0 0 800 280"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        aria-label="Sân bắt bóng kiến thức 2D"
      >
        <defs>
          <linearGradient id="e02WallGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0F254A" />
            <stop offset="100%" stopColor="#1B3A6B" />
          </linearGradient>
          <linearGradient id="e02WoodGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#D7AE76" />
            <stop offset="100%" stopColor="#ECCB99" />
          </linearGradient>
        </defs>

        {/* Gym back wall */}
        <rect x="0" y="0" width="800" height="145" fill="url(#e02WallGrad)" />
        {/* Clerestory daylight windows */}
        <rect x="60" y="18" width="190" height="22" rx="4" fill="#E0F2FE" fillOpacity="0.28" />
        <rect x="305" y="18" width="190" height="22" rx="4" fill="#E0F2FE" fillOpacity="0.28" />
        <rect x="550" y="18" width="190" height="22" rx="4" fill="#E0F2FE" fillOpacity="0.28" />

        {/* Maple wood floor */}
        <polygon points="0,145 800,145 800,280 0,280" fill="url(#e02WoodGrad)" />
        {/* Court lines */}
        <line x1="40" y1="168" x2="760" y2="168" stroke="#0F254A" strokeWidth="4" />
        <ellipse cx="400" cy="212" rx="140" ry="38" fill="rgba(13,148,136,0.22)" stroke="#0D9488" strokeWidth="4" />
        <line x1="40" y1="262" x2="760" y2="262" stroke="#FFFFFF" strokeWidth="4" />

        {/* Catching Hoop Basket at bottom center */}
        <g transform="translate(400, 212)">
          <rect x="-54" y="-34" width="108" height="36" rx="6" fill="#0F254A" stroke="#EAB308" strokeWidth="3" />
          <ellipse cx="0" cy="2" rx="44" ry="12" fill="none" stroke="#EAB308" strokeWidth="5" />
          <path
            d="M-38,4 L-26,38 L26,38 L38,4 M-22,6 L-14,38 M0,8 L0,38 M22,6 L14,38"
            stroke="#F8FAFC"
            strokeWidth="2.5"
            fill="none"
            opacity="0.9"
          />
          <text
            x="0"
            y="-12"
            textAnchor="middle"
            fill="#FDE047"
            fontSize="12"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
          >
            GIỎ ĐÓN BÓNG
          </text>
        </g>

        {/* 4 Athletic Balls A–D */}
        {CATCH_OPTION_LETTERS.map((letter, idx) => {
          const theme = E02_BALL_SLOT_THEMES[letter];
          const isSelected = selectedLabels.includes(letter);
          const isCaught = isRevealed && caughtLabels.includes(letter);
          const isRight = isRevealed && correctLabel === letter;

          const homeX = 130 + idx * 180;
          const homeY = 104;
          // If caught on reveal, move smoothly toward basket cluster
          const caughtIndex = Math.max(0, caughtLabels.indexOf(letter));
          const caughtOffset =
            caughtLabels.length > 1
              ? (caughtIndex - (caughtLabels.length - 1) / 2) * 32
              : 0;
          const cx = isCaught ? 400 + caughtOffset : homeX;
          const cy = isCaught ? 214 : homeY;

          return (
            <g
              key={letter}
              transform={`translate(${cx}, ${cy})`}
              onClick={() => canInteract && onSelectLabel?.(letter)}
              style={{ cursor: canInteract ? 'pointer' : 'default' }}
            >
              {/* Contact shadow */}
              {!isCaught && (
                <ellipse cx="0" cy="56" rx="34" ry="8" fill="rgba(7,18,38,0.28)" />
              )}

              {/* Selection / reveal halo */}
              {(isSelected || isRight || isCaught) && (
                <circle
                  cx="0"
                  cy="0"
                  r="42"
                  fill="none"
                  stroke={
                    isRight
                      ? '#10B981'
                      : isCaught && isRevealed && !isRight
                      ? '#F59E0B'
                      : '#FACC15'
                  }
                  strokeWidth={isRight ? '5' : '4'}
                  strokeDasharray={isSelected && !isRevealed ? '8 5' : undefined}
                />
              )}

              {/* Ball body */}
              <circle
                cx="0"
                cy="0"
                r={isCaught ? 26 : 34}
                fill={theme.primaryHex}
                stroke={theme.seamHex}
                strokeWidth="3"
              />
              {/* Seam arcs */}
              <path
                d={isCaught ? 'M-24,0 Q0,-12 24,0' : 'M-32,0 Q0,-15 32,0'}
                fill="none"
                stroke={theme.seamHex}
                strokeWidth="2.5"
                opacity="0.7"
              />
              {/* Crisp letter badge */}
              <circle cx="0" cy="0" r={isCaught ? 14 : 18} fill="#FFFFFF" />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="central"
                fill="#071226"
                fontSize={isCaught ? '16' : '21'}
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
              >
                {letter}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Clean corner label */}
      <div className="absolute top-2.5 left-3 px-2.5 py-1 rounded-lg bg-[#071226]/90 border border-slate-600/70 text-[11px] font-bold text-teal-200">
        Chế độ minh họa 2D · Bấm trực tiếp bóng A–D hoặc thẻ bên dưới
      </div>
    </div>
  );
};

interface BallRig {
  letter: CatchOptionLetter;
  group: THREE.Group;
  ballMesh: THREE.Mesh;
  shadowMesh: THREE.Mesh;
  haloMesh: THREE.Mesh;
  haloMat: THREE.MeshBasicMaterial;
  homePos: THREE.Vector3;
  flightT: number;
}

export const CatchBall3DScene: React.FC<CatchBall3DSceneProps> = (props) => {
  const {
    selectedLabels,
    caughtLabels,
    isRevealed,
    correctLabel,
    canInteract,
    onSelectLabel,
    skipAnimationKey,
    reducedMotion,
    force2D,
    turnKey,
    compact = false,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLostOrUnavailable, setWebglLostOrUnavailable] = useState<boolean>(() => {
    if (force2D) return true;
    const probe = detectSoftwareWebGL();
    return !probe.available;
  });

  // Live prop refs so WebGL scene never tears down on state changes
  const propsRef = useRef(props);
  propsRef.current = props;

  const prevSkipKeyRef = useRef<number>(skipAnimationKey);
  const prevTurnKeyRef = useRef<string>(turnKey);
  const snapPendingRef = useRef<boolean>(false);
  const resetTurnPendingRef = useRef<boolean>(false);

  useEffect(() => {
    if (skipAnimationKey !== prevSkipKeyRef.current) {
      prevSkipKeyRef.current = skipAnimationKey;
      snapPendingRef.current = true;
    }
  }, [skipAnimationKey]);

  useEffect(() => {
    if (turnKey !== prevTurnKeyRef.current) {
      prevTurnKeyRef.current = turnKey;
      resetTurnPendingRef.current = true;
    }
  }, [turnKey]);

  useEffect(() => {
    if (force2D || webglLostOrUnavailable) return;
    const container = containerRef.current;
    if (!container) return;

    const probe = detectSoftwareWebGL();
    if (!probe.available) {
      setWebglLostOrUnavailable(true);
      return;
    }
    const { isSoftwareGl } = probe;

    let disposed = false;
    let frameId = 0;

    // 1. Renderer setup (r160+ modern color pipeline + software-WebGL guard)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglLostOrUnavailable(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const initW = Math.max(320, container.clientWidth || 800);
    const initH = Math.max(190, container.clientHeight || 280);
    renderer.setSize(initW, initH);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (!disposed) setWebglLostOrUnavailable(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // 2. Scene, Studio Environment & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0E203D');
    scene.fog = new THREE.Fog('#0E203D', 15, 34);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 60);
    camera.position.set(0, 3.65, 8.75);
    camera.lookAt(0, 1.38, 0.25);

    // 3. Balanced 3-Point Gymnasium Lighting
    const hemiLight = new THREE.HemisphereLight('#E0F2FE', '#6B4C2A', 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF6E5', 1.75);
    keyLight.position.set(4.5, 9.5, 6.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -7;
    keyLight.shadow.camera.right = 7;
    keyLight.shadow.camera.top = 7;
    keyLight.shadow.camera.bottom = -7;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38BDF8', 0.65);
    rimLight.position.set(-5.5, 4.5, -6.0);
    scene.add(rimLight);

    // Track disposable resources
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };
    const trackTex = <T extends THREE.Texture>(t: T): T => {
      textures.push(t);
      return t;
    };

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    // 4. Maple Hardwood Sports Court Floor
    const floorTex = trackTex(createHardwoodCourtTexture(maxAniso));
    const floorGeo = trackGeo(new THREE.PlaneGeometry(18, 13));
    const floorMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.34,
        metalness: 0.06,
      })
    );
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // 5. Gymnasium Architectural Backdrop (Wood Acoustic Wall + Roof Trusses + Daylight Clerestory)
    const backWallGeo = trackGeo(new THREE.BoxGeometry(20, 7.5, 0.4));
    const backWallMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#132A4F', roughness: 0.72, metalness: 0.08 })
    );
    const backWall = new THREE.Mesh(backWallGeo, backWallMat);
    backWall.position.set(0, 3.75, -5.6);
    scene.add(backWall);

    const woodWainscotGeo = trackGeo(new THREE.BoxGeometry(19.6, 2.3, 0.2));
    const woodWainscotMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#C79B63', roughness: 0.56, metalness: 0.04 })
    );
    const wainscot = new THREE.Mesh(woodWainscotGeo, woodWainscotMat);
    wainscot.position.set(0, 1.15, -5.32);
    scene.add(wainscot);

    // Teal & Gold gymnasium accent banners on back wall
    const accentBandGeo = trackGeo(new THREE.BoxGeometry(19.6, 0.16, 0.22));
    const accentBandMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#0D9488', roughness: 0.45, metalness: 0.12 })
    );
    const accentBand = new THREE.Mesh(accentBandGeo, accentBandMat);
    accentBand.position.set(0, 2.38, -5.3);
    scene.add(accentBand);

    // High clerestory window light panels
    const windowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#E0F2FE',
        emissive: '#BAE6FD',
        emissiveIntensity: 0.45,
        roughness: 0.2,
      })
    );
    const windowGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.65, 0.12));
    [-5.2, 0, 5.2].forEach((wx) => {
      const win = new THREE.Mesh(windowGeo, windowMat);
      win.position.set(wx, 5.15, -5.35);
      scene.add(win);
    });

    // 6. Composite 3D Catching Basket / Hoop Stand (grounded flush at y = 0)
    const basketGroup = new THREE.Group();
    basketGroup.position.set(0, 0, 2.25);

    // Weighted navy floor base
    const baseMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#0F254A', roughness: 0.42, metalness: 0.22 })
    );
    const baseMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.7, 0.24, 1.15)), baseMat);
    baseMesh.position.set(0, 0.12, 0.65);
    baseMesh.castShadow = !isSoftwareGl;
    baseMesh.receiveShadow = true;
    basketGroup.add(baseMesh);

    // Vertical + angled brushed gold support column
    const goldMat = trackMat(
      new THREE.MeshStandardMaterial({ color: '#EAB308', roughness: 0.24, metalness: 0.78 })
    );
    const postMesh = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 1.45, 16)), goldMat);
    postMesh.position.set(0, 0.88, 0.65);
    basketGroup.add(postMesh);

    // Clear-trimmed backboard frame behind hoop
    const boardMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        roughness: 0.18,
        metalness: 0.1,
        transparent: true,
        opacity: 0.72,
      })
    );
    const boardMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.72, 0.72, 0.08)), boardMat);
    boardMesh.position.set(0, 1.85, 0.56);
    basketGroup.add(boardMesh);

    // Navy top trim frame on backboard
    const frameMesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.8, 0.1, 0.11)), baseMat);
    frameMesh.position.set(0, 2.22, 0.56);
    basketGroup.add(frameMesh);

    // Brushed gold circular catching rim (horizontal)
    const rimMesh = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.76, 0.065, 14, 36)), goldMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.set(0, 1.56, 0);
    basketGroup.add(rimMesh);

    // Procedural woven white net cone (sways gently on catch)
    const netGeo = trackGeo(new THREE.CylinderGeometry(0.73, 0.48, 0.78, 18, 4, true));
    const netMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: '#F8FAFC',
        roughness: 0.78,
        metalness: 0.02,
        wireframe: true,
      })
    );
    const netMesh = new THREE.Mesh(netGeo, netMat);
    netMesh.position.set(0, 1.15, 0);
    basketGroup.add(netMesh);

    // Soft glowing catch pad beneath basket
    const catchPadMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: '#0D9488',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      })
    );
    const catchPad = new THREE.Mesh(trackGeo(new THREE.CircleGeometry(0.95, 32)), catchPadMat);
    catchPad.rotation.x = -Math.PI / 2;
    catchPad.position.set(0, 0.02, 0);
    basketGroup.add(catchPad);

    scene.add(basketGroup);

    // 7. Four Composite 3D Athletic Balls (A, B, C, D)
    const ballRigs: BallRig[] = [];
    const clickableMeshes: THREE.Object3D[] = [];
    const sharedBallGeo = trackGeo(new THREE.SphereGeometry(0.68, 32, 24));
    const sharedBandGeo = trackGeo(new THREE.TorusGeometry(0.695, 0.024, 10, 32));
    const sharedShadowGeo = trackGeo(new THREE.CircleGeometry(0.64, 24));
    const sharedHaloGeo = trackGeo(new THREE.RingGeometry(0.78, 0.94, 32));

    CATCH_OPTION_LETTERS.forEach((letter) => {
      const theme = E02_BALL_SLOT_THEMES[letter];
      const [hx, hy, hz] = BALL_HOME_POSITIONS[letter];

      const group = new THREE.Group();
      group.position.set(hx, hy, hz);

      const ballTex = trackTex(createBallTexture(letter, theme.primaryHex, theme.seamHex, maxAniso));
      const ballMat = trackMat(
        new THREE.MeshStandardMaterial({
          map: ballTex,
          roughness: 0.38,
          metalness: 0.08,
        })
      );
      const ballMesh = new THREE.Mesh(sharedBallGeo, ballMat);
      ballMesh.castShadow = !isSoftwareGl;
      ballMesh.receiveShadow = true;
      ballMesh.userData = { letter };
      group.add(ballMesh);
      clickableMeshes.push(ballMesh);

      // Subtle glossy accent band around ball equator
      const bandMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: theme.seamHex,
          roughness: 0.25,
          metalness: 0.55,
        })
      );
      const bandMesh = new THREE.Mesh(sharedBandGeo, bandMat);
      bandMesh.rotation.x = Math.PI / 2;
      group.add(bandMesh);

      // Contact shadow grounded on court floor
      const shadowMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: '#071226',
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        })
      );
      const shadowMesh = new THREE.Mesh(sharedShadowGeo, shadowMat);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.set(hx, 0.018, hz);
      scene.add(shadowMesh);

      // Halo ring on court beneath ball (neutral gold when selected, emerald on reveal correct, muted amber on reveal wrong)
      const haloMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: '#FACC15',
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const haloMesh = new THREE.Mesh(sharedHaloGeo, haloMat);
      haloMesh.rotation.x = -Math.PI / 2;
      haloMesh.position.set(hx, 0.024, hz);
      scene.add(haloMesh);

      scene.add(group);

      ballRigs.push({
        letter,
        group,
        ballMesh,
        shadowMesh,
        haloMesh,
        haloMat,
        homePos: new THREE.Vector3(hx, hy, hz),
        flightT: 0,
      });
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 8. Raycast Click & Hover Interaction on 3D Balls
    const getHitLetter = (clientX: number, clientY: number): CatchOptionLetter | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const hits = _raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData?.letter as CatchOptionLetter) || null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!propsRef.current.canInteract) {
        renderer.domElement.style.cursor = 'default';
        return;
      }
      const hit = getHitLetter(e.clientX, e.clientY);
      renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (!propsRef.current.canInteract) return;
      const hit = getHitLetter(e.clientX, e.clientY);
      if (hit) {
        propsRef.current.onSelectLabel?.(hit);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(300, Math.floor(entry.contentRect.width));
      const h = Math.max(180, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      // Keep all 4 balls framed even on narrow mobile viewports
      camera.fov = w / h < 1.35 ? 52 : 42;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    // 10. Frame-Rate Independent Animation Loop with Software-WebGL fenceSync Pacing
    const clock = new THREE.Clock();
    let elapsed = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 6);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.08, clock.getDelta());
      elapsed += dt;

      const cur = propsRef.current;

      if (resetTurnPendingRef.current) {
        resetTurnPendingRef.current = false;
        ballRigs.forEach((rig) => {
          rig.flightT = 0;
        });
      }

      const doSnap = snapPendingRef.current || cur.reducedMotion;
      if (snapPendingRef.current) {
        snapPendingRef.current = false;
      }

      let netImpulse = 0;

      ballRigs.forEach((rig, idx) => {
        const isSelected = cur.selectedLabels.includes(rig.letter);
        const isCaught = cur.isRevealed && cur.caughtLabels.includes(rig.letter);
        const isRight = cur.isRevealed && cur.correctLabel === rig.letter;

        // Flight progress toward basket when caught on reveal
        const targetFlight = isCaught ? 1 : 0;
        if (doSnap) {
          rig.flightT = targetFlight;
        } else {
          const speed = targetFlight > rig.flightT ? 2.6 : 4.2;
          rig.flightT = THREE.MathUtils.clamp(
            rig.flightT + Math.sign(targetFlight - rig.flightT) * dt * speed,
            0,
            1
          );
        }

        const t = rig.flightT;
        // Smooth ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);

        if (t > 0.001) {
          // Spread multiple caught team balls neatly inside/above hoop
          const caughtIdx = Math.max(0, cur.caughtLabels.indexOf(rig.letter));
          const spreadX =
            cur.caughtLabels.length > 1
              ? (caughtIdx - (cur.caughtLabels.length - 1) / 2) * 0.44
              : 0;
          const destX = BASKET_CENTER.x + spreadX;
          const destY = BASKET_CENTER.y - 0.14;
          const destZ = BASKET_CENTER.z;

          const px = THREE.MathUtils.lerp(rig.homePos.x, destX, ease);
          const pz = THREE.MathUtils.lerp(rig.homePos.z, destZ, ease);
          const arcLift = Math.sin(ease * Math.PI) * 1.95;
          const py = THREE.MathUtils.lerp(rig.homePos.y, destY, ease) + arcLift;

          rig.group.position.set(px, py, pz);
          const s = THREE.MathUtils.lerp(1, cur.caughtLabels.length > 1 ? 0.62 : 0.78, ease);
          rig.group.scale.setScalar(s);
          rig.ballMesh.rotation.y = Math.PI * 0.5 * (1 - ease) * 0.25;
          rig.shadowMesh.position.set(px, 0.018, pz);
          (rig.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * (1 - ease * 0.7);

          if (ease > 0.75) {
            netImpulse = Math.max(netImpulse, Math.sin((ease - 0.75) * 4 * Math.PI));
          }
        } else {
          // Gentle in-place bobbing (strictly identical amplitude across A–D before reveal!)
          const bob = cur.reducedMotion ? 0 : Math.sin(elapsed * 2.1 + idx * 1.1) * 0.085;
          const selectLift = isSelected && !cur.isRevealed ? 0.16 : 0;
          rig.group.position.set(rig.homePos.x, rig.homePos.y + bob + selectLift, rig.homePos.z);
          rig.group.scale.setScalar(1);
          // Keep letter facing forward with gentle micro-rock
          rig.ballMesh.rotation.y = cur.reducedMotion ? 0 : Math.sin(elapsed * 1.2 + idx) * 0.18;
          rig.shadowMesh.position.set(rig.homePos.x, 0.018, rig.homePos.z);
          (rig.shadowMesh.material as THREE.MeshBasicMaterial).opacity = 0.32;
        }

        // Halo state (STRICT ANTI-SPOILER: never uses correctLabel while !cur.isRevealed)
        if (cur.isRevealed) {
          if (isRight) {
            rig.haloMat.color.set('#10B981');
            rig.haloMat.opacity = 0.92;
          } else if (isCaught) {
            rig.haloMat.color.set('#F59E0B');
            rig.haloMat.opacity = 0.75;
          } else {
            rig.haloMat.opacity = 0;
          }
        } else if (isSelected) {
          rig.haloMat.color.set('#FACC15');
          rig.haloMat.opacity = 0.85;
        } else {
          rig.haloMat.opacity = 0;
        }
      });

      // Subtle basket net sway when ball enters hoop
      netMesh.scale.x = 1 + netImpulse * 0.14;
      netMesh.scale.z = 1 + netImpulse * 0.14;

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
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      envTex.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      container.innerHTML = '';
    };
  }, [force2D, webglLostOrUnavailable]);

  if (force2D || webglLostOrUnavailable) {
    return <CatchBall2DStageFallback {...props} />;
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#0E203D] ${
        compact ? 'h-[190px]' : 'h-[225px] sm:h-[265px] lg:h-[280px]'
      }`}
    >
      {/* Dedicated empty mount node for Three.js canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Crisp solid corner legend (no backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-2.5 left-3 px-2.5 py-1 rounded-lg bg-[#071226]/90 border border-slate-600/70 text-[11px] font-bold text-slate-200">
        {isRevealed
          ? 'Bóng đã chọn bay vào giỏ đón'
          : canInteract
          ? 'Bấm trực tiếp bóng A–D hoặc chọn thẻ bên dưới'
          : 'Sân bóng kiến thức 3D'}
      </div>
    </div>
  );
};
