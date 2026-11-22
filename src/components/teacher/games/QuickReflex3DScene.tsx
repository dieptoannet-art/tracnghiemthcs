import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  Clock,
  Zap,
  Award,
  AlertTriangle,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';

export type ReflexConsoleVisualState =
  | 'idle'
  | 'waiting'
  | 'go'
  | 'answer'
  | 'result_valid'
  | 'result_early'
  | 'result_timeout'
  | 'interrupted'
  | 'summary';

export interface QuickReflex3DSceneProps {
  visualState: ReflexConsoleVisualState;
  /** Primary large status text readable from back of classroom: "CHỜ", "BẤM!", "TRẢ LỜI", "KẾT QUẢ"... */
  headline: string;
  /** Secondary short line shown beneath headline (e.g. "248 ms" or "Chạm nút hoặc phím Space"). */
  subline?: string;
  /** Compact header height when Math mode needs maximum room for question + options. */
  compact?: boolean;
  /** Whether clicking the 3D console button triggers onResponseTap. */
  responseEnabled?: boolean;
  /** Instant visual press depression counter incremented on user tap. */
  pressPulseSeq?: number;
  /** Reduced motion preference (disables subtle spring animations). */
  reducedMotion?: boolean;
  /** Force lightweight 2D stage (auto-enabled on WebGL error/loss). */
  force2D?: boolean;
  /** Fired on pointerdown directly on the console response button when responseEnabled is true. */
  onResponseTap?: () => void;
  /** Notifies parent if WebGL had to fall back to 2D automatically. */
  onWebGLFallback?: () => void;
}

interface PaletteSpec {
  lampColor: number;
  lampEmissive: number;
  lampEmissiveIntensity: number;
  ringColor: number;
  buttonCapColor: number;
  buttonCollarColor: number;
  cssBorder: string;
  cssAccentText: string;
  cssGlowBg: string;
}

function getVisualPalette(state: ReflexConsoleVisualState): PaletteSpec {
  switch (state) {
    case 'go':
    case 'answer':
      return {
        lampColor: 0x2dd4bf,
        lampEmissive: 0x14b8a6,
        lampEmissiveIntensity: 1.55,
        ringColor: 0x99f6e4,
        buttonCapColor: 0xf8fafc,
        buttonCollarColor: 0x2dd4bf,
        cssBorder: 'border-teal-400/70',
        cssAccentText: 'text-teal-200',
        cssGlowBg: 'from-teal-500/30 via-[#0d2740] to-[#081529]',
      };
    case 'waiting':
      // Calm, steady warm-gold standby: ZERO flashing or pulsing that could hint timing!
      return {
        lampColor: 0x92651a,
        lampEmissive: 0xd97706,
        lampEmissiveIntensity: 0.42,
        ringColor: 0xfbbf24,
        buttonCapColor: 0xe2e8f0,
        buttonCollarColor: 0xd97706,
        cssBorder: 'border-amber-400/55',
        cssAccentText: 'text-amber-200',
        cssGlowBg: 'from-amber-500/20 via-[#111e38] to-[#081529]',
      };
    case 'result_valid':
    case 'summary':
      return {
        lampColor: 0x0f766e,
        lampEmissive: 0x0d9488,
        lampEmissiveIntensity: 0.65,
        ringColor: 0xfbbf24,
        buttonCapColor: 0xf8fafc,
        buttonCollarColor: 0xf59e0b,
        cssBorder: 'border-amber-300/60',
        cssAccentText: 'text-amber-200',
        cssGlowBg: 'from-teal-600/20 via-[#0d203a] to-[#081529]',
      };
    case 'result_early':
    case 'result_timeout':
      return {
        lampColor: 0x9f1239,
        lampEmissive: 0xe11d48,
        lampEmissiveIntensity: 0.72,
        ringColor: 0xfda4af,
        buttonCapColor: 0xe2e8f0,
        buttonCollarColor: 0xf43f5e,
        cssBorder: 'border-rose-400/65',
        cssAccentText: 'text-rose-200',
        cssGlowBg: 'from-rose-600/25 via-[#181632] to-[#081529]',
      };
    case 'interrupted':
      return {
        lampColor: 0x334155,
        lampEmissive: 0x64748b,
        lampEmissiveIntensity: 0.35,
        ringColor: 0xfbbf24,
        buttonCapColor: 0xcbd5e1,
        buttonCollarColor: 0x94a3b8,
        cssBorder: 'border-slate-400/55',
        cssAccentText: 'text-slate-200',
        cssGlowBg: 'from-slate-600/20 via-[#101c34] to-[#081529]',
      };
    case 'idle':
    default:
      return {
        lampColor: 0x162b4d,
        lampEmissive: 0x0ea5e9,
        lampEmissiveIntensity: 0.22,
        ringColor: 0x38bdf8,
        buttonCapColor: 0xf8fafc,
        buttonCollarColor: 0xf59e0b,
        cssBorder: 'border-sky-400/40',
        cssAccentText: 'text-sky-200',
        cssGlowBg: 'from-sky-500/15 via-[#0e1e3a] to-[#081529]',
      };
  }
}

function renderStateIcon(state: ReflexConsoleVisualState, sizeClass: string) {
  switch (state) {
    case 'waiting':
      return <Clock className={sizeClass} aria-hidden="true" />;
    case 'go':
    case 'answer':
      return <Zap className={sizeClass} aria-hidden="true" />;
    case 'result_valid':
      return <CheckCircle2 className={sizeClass} aria-hidden="true" />;
    case 'summary':
      return <Award className={sizeClass} aria-hidden="true" />;
    case 'result_early':
    case 'result_timeout':
      return <AlertTriangle className={sizeClass} aria-hidden="true" />;
    case 'interrupted':
      return <PauseCircle className={sizeClass} aria-hidden="true" />;
    default:
      return <Clock className={sizeClass} aria-hidden="true" />;
  }
}

function createRoundedOctagonShape(width: number, height: number, cut: number): THREE.Shape {
  const hw = width / 2;
  const hh = height / 2;
  const c = Math.min(cut, hw * 0.4, hh * 0.4);
  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hh);
  s.lineTo(hw - c, -hh);
  s.lineTo(hw, -hh + c);
  s.lineTo(hw, hh - c);
  s.lineTo(hw - c, hh);
  s.lineTo(-hw + c, hh);
  s.lineTo(-hw, hh - c);
  s.lineTo(-hw, -hh + c);
  s.closePath();
  return s;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 122);
    grad.addColorStop(0, 'rgba(2, 6, 20, 0.72)');
    grad.addColorStop(0.55, 'rgba(2, 6, 20, 0.34)');
    grad.addColorStop(1, 'rgba(2, 6, 20, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
 * Lightweight 2D architectural console stage when WebGL is unavailable or user picks 2D mode.
 * Preserves exact palette (navy, teal, gold, white), status labels/icons, and fixed response button.
 */
export const QuickReflex2DStage: React.FC<QuickReflex3DSceneProps> = ({
  visualState,
  headline,
  subline,
  compact = false,
  responseEnabled = false,
  onResponseTap,
}) => {
  const palette = getVisualPalette(visualState);
  const isActionGo = visualState === 'go' || visualState === 'answer';

  if (compact) {
    return (
      <div
        className={`w-full rounded-2xl bg-gradient-to-r ${palette.cssGlowBg} border-2 ${palette.cssBorder} px-4 py-3 flex items-center justify-between gap-4 shadow-lg`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
              isActionGo
                ? 'bg-teal-400 text-[#061024] border-teal-200 shadow-md'
                : visualState === 'waiting'
                ? 'bg-amber-500/25 text-amber-200 border-amber-300/60'
                : 'bg-slate-800/80 text-white border-white/20'
            }`}
          >
            {renderStateIcon(visualState, 'w-6 h-6')}
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-extrabold tracking-wide text-white leading-tight truncate">
              {headline}
            </div>
            {subline && (
              <div className={`text-xs sm:text-sm font-semibold truncate ${palette.cssAccentText}`}>
                {subline}
              </div>
            )}
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0 text-xs font-semibold text-slate-300">
          <span>Bảng tín hiệu 2D</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-[340px] sm:min-h-[400px] rounded-2xl bg-gradient-to-b ${palette.cssGlowBg} border-2 ${palette.cssBorder} p-5 sm:p-6 flex flex-col items-center justify-between overflow-hidden select-none`}
    >
      {/* Metallic outer console bezel representation */}
      <div className="w-full max-w-lg rounded-2xl bg-[#0B172D] border-2 border-slate-400/50 p-4 sm:p-5 shadow-inner flex flex-col items-center text-center gap-2">
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center border-2 ${
            isActionGo
              ? 'bg-teal-400 text-[#061024] border-teal-200'
              : visualState === 'waiting'
              ? 'bg-amber-500/20 text-amber-200 border-amber-300/60'
              : visualState === 'result_early' || visualState === 'result_timeout'
              ? 'bg-rose-500/20 text-rose-200 border-rose-300/60'
              : 'bg-sky-500/15 text-sky-200 border-sky-300/50'
          }`}
        >
          {renderStateIcon(visualState, 'w-8 h-8')}
        </div>
        <div className="text-4xl sm:text-5xl font-black tracking-wider text-white leading-none">
          {headline}
        </div>
        {subline && (
          <p className={`text-sm sm:text-base font-bold ${palette.cssAccentText}`}>
            {subline}
          </p>
        )}
      </div>

      {/* Fixed-position large response button (always same spot across turns) */}
      <div className="mt-4 flex flex-col items-center">
        <button
          type="button"
          onPointerDown={(e) => {
            if (!responseEnabled) return;
            e.preventDefault();
            onResponseTap?.();
          }}
          disabled={!responseEnabled}
          aria-label={isActionGo ? 'Bấm phản hồi ngay' : 'Nút phản hồi'}
          className={`w-36 h-36 sm:w-40 sm:h-40 rounded-full border-4 flex flex-col items-center justify-center font-black text-xl sm:text-2xl tracking-wide transition-transform duration-100 select-none ${
            responseEnabled
              ? isActionGo
                ? 'bg-white text-[#061024] border-teal-400 shadow-[0_0_28px_rgba(45,212,191,0.45)] active:scale-95 cursor-pointer'
                : 'bg-slate-100 text-[#0B172D] border-amber-400 shadow-lg active:scale-95 cursor-pointer'
              : 'bg-slate-800/80 text-slate-400 border-slate-600 cursor-default'
          }`}
        >
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">
            {isActionGo ? 'NHẤN NGAY' : 'PHẢN HỒI'}
          </span>
          <span>{isActionGo ? 'BẤM!' : 'NÚT'}</span>
        </button>
      </div>
    </div>
  );
};

/**
 * Front-facing 3D metallic Signal Console Board built with Three.js (composite 9-part THREE.Group).
 * - Zero blinking/pulsing during 'waiting' (never leaks timing hints!).
 * - Zero delay on status text/icon rendering (semantic DOM overlay synchronized immediately).
 * - Fixed-position response pad for consistent muscle memory.
 * - Full software-WebGL pacing & automatic 2D fallback on WebGL loss/unavailability.
 */
export const QuickReflex3DScene: React.FC<QuickReflex3DSceneProps> = (props) => {
  const {
    visualState,
    headline,
    subline,
    compact = false,
    responseEnabled = false,
    pressPulseSeq = 0,
    reducedMotion = false,
    force2D = false,
    onResponseTap,
    onWebGLFallback,
  } = props;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(() => !hasWebGLSupport());

  const stateRef = useRef<ReflexConsoleVisualState>(visualState);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const pressDepthTargetRef = useRef<number>(0);
  const requestRenderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = visualState;
    requestRenderRef.current?.();
  }, [visualState]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    requestRenderRef.current?.();
  }, [reducedMotion]);

  useEffect(() => {
    if (pressPulseSeq > 0) {
      pressDepthTargetRef.current = reducedMotionRef.current ? 0.14 : 0.24;
      requestRenderRef.current?.();
    }
  }, [pressPulseSeq]);

  const use2DFallback = force2D || webglUnavailable;

  useEffect(() => {
    if (use2DFallback) return;
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
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, compact ? 110 : 340);
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071226);
    scene.fog = new THREE.FogExp2(0x071226, 0.032);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      compact ? 26 : 34,
      width / height,
      0.1,
      60
    );
    camera.position.set(0, compact ? 0.65 : 0.22, compact ? 9.4 : 8.1);
    camera.lookAt(0, compact ? 0.45 : -0.1, 0);

    // 3-Point Studio Lighting (Warm Key + Cool Hemisphere Fill + Teal Rim)
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0b162c, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 1.55);
    keyLight.position.set(4.5, 6.5, 7.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-5.0, 2.5, -4.0);
    scene.add(rimLight);

    // Console Assembly (Composite 9-Part Procedural THREE.Group)
    const consoleGroup = new THREE.Group();
    scene.add(consoleGroup);

    const disposables: { geometries: THREE.BufferGeometry[]; materials: THREE.Material[]; textures: THREE.Texture[] } = {
      geometries: [],
      materials: [],
      textures: [],
    };
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      disposables.geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      disposables.materials.push(m);
      return m;
    };

    // Part 1: Stage Plinth Desk Surface
    const deskGeo = trackGeo(new THREE.BoxGeometry(14, 0.35, 6.5));
    const deskMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0b1830,
        roughness: 0.72,
        metalness: 0.18,
      })
    );
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(0, -2.52, -0.4);
    deskMesh.receiveShadow = true;
    consoleGroup.add(deskMesh);

    // Part 2: Contact Shadow Plane directly on plinth
    const shadowTex = createContactShadowTexture();
    disposables.textures.push(shadowTex);
    const contactGeo = trackGeo(new THREE.PlaneGeometry(5.6, 2.8));
    const contactMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      })
    );
    const contactPlane = new THREE.Mesh(contactGeo, contactMat);
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.set(0, -2.33, 0.05);
    consoleGroup.add(contactPlane);

    // Part 3: Deep Navy Anodized Main Chassis Housing
    const chassisShape = createRoundedOctagonShape(4.9, 4.55, 0.48);
    const chassisGeo = trackGeo(
      new THREE.ExtrudeGeometry(chassisShape, {
        depth: 0.56,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.1,
        bevelSegments: 3,
      })
    );
    chassisGeo.translate(0, 0, -0.56);
    const chassisMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0e1d38,
        roughness: 0.44,
        metalness: 0.42,
      })
    );
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;
    consoleGroup.add(chassisMesh);

    // Part 4: Brushed Titanium Metallic Outer Bezel Frame (hollow ring via shape hole)
    const outerBezelShape = createRoundedOctagonShape(4.62, 4.28, 0.42);
    const innerCutout = createRoundedOctagonShape(4.06, 3.74, 0.3);
    outerBezelShape.holes.push(innerCutout);
    const bezelGeo = trackGeo(
      new THREE.ExtrudeGeometry(outerBezelShape, {
        depth: 0.18,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        bevelSegments: 2,
      })
    );
    const bezelMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xcbd5e1,
        metalness: 0.88,
        roughness: 0.22,
        clearcoat: 0.4,
      })
    );
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0, 0.02);
    consoleGroup.add(bezelMesh);

    // Part 5: Deep Recessed Lamp Cavity Backing (gives true depth behind signal face)
    const cavityFrameShape = createRoundedOctagonShape(3.7, 1.98, 0.2);
    const cavityHole = createRoundedOctagonShape(3.36, 1.66, 0.14);
    cavityFrameShape.holes.push(cavityHole);
    const cavityRimGeo = trackGeo(
      new THREE.ExtrudeGeometry(cavityFrameShape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2,
      })
    );
    const cavityRimMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.72,
        roughness: 0.34,
      })
    );
    const cavityRimMesh = new THREE.Mesh(cavityRimGeo, cavityRimMat);
    cavityRimMesh.position.set(0, 0.78, -0.02);
    consoleGroup.add(cavityRimMesh);

    // Part 6: Recessed Optical Signal Lamp Panel (color & emissive respond immediately to state)
    const lampBackGeo = trackGeo(new THREE.BoxGeometry(3.32, 1.62, 0.12));
    const lampMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x162b4d,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.25,
        roughness: 0.26,
        metalness: 0.15,
      })
    );
    const lampBackMesh = new THREE.Mesh(lampBackGeo, lampMat);
    lampBackMesh.position.set(0, 0.78, -0.14);
    consoleGroup.add(lampBackMesh);

    // Part 7: Concentric Optical Depth Rings inside the lamp well
    const ringMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x99f6e4,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    const ringRadii = [0.46, 0.72];
    ringRadii.forEach((rad, i) => {
      const rGeo = trackGeo(new THREE.TorusGeometry(rad, 0.032, 14, 48));
      const rMesh = new THREE.Mesh(rGeo, ringMat);
      rMesh.position.set(0, 0.78, -0.04 + i * 0.06);
      consoleGroup.add(rMesh);
    });

    // Part 8: Optical Front Glass Cover over Lamp Cavity
    const glassGeo = trackGeo(new THREE.PlaneGeometry(3.38, 1.68));
    const glassMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        roughness: 0.08,
        metalness: 0.05,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    const glassMesh = new THREE.Mesh(glassGeo, glassMat);
    glassMesh.position.set(0, 0.78, 0.21);
    glassMesh.renderOrder = 3;
    consoleGroup.add(glassMesh);

    // Part 9: Brushed Gold Divider Bar & Machined Circular Tactile Response Button Assembly
    const dividerGeo = trackGeo(new THREE.BoxGeometry(3.6, 0.06, 0.12));
    const goldMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.22,
      })
    );
    const dividerMesh = new THREE.Mesh(dividerGeo, goldMat);
    dividerMesh.position.set(0, -0.32, 0.08);
    consoleGroup.add(dividerMesh);

    const buttonCollarGeo = trackGeo(new THREE.CylinderGeometry(0.86, 0.94, 0.24, 40));
    buttonCollarGeo.rotateX(Math.PI / 2);
    const buttonCollarMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.18,
        metalness: 0.85,
        roughness: 0.24,
      })
    );
    const buttonCollarMesh = new THREE.Mesh(buttonCollarGeo, buttonCollarMat);
    buttonCollarMesh.position.set(0, -1.24, 0.1);
    consoleGroup.add(buttonCollarMesh);

    // Movable tactile button plunger group (white outer dome + brushed gold center puck)
    const plungerGroup = new THREE.Group();
    plungerGroup.position.set(0, -1.24, 0.22);
    consoleGroup.add(plungerGroup);

    const capGeo = trackGeo(new THREE.CylinderGeometry(0.72, 0.76, 0.22, 40));
    capGeo.rotateX(Math.PI / 2);
    const capMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.28,
        metalness: 0.08,
      })
    );
    const capMesh = new THREE.Mesh(capGeo, capMat);
    plungerGroup.add(capMesh);

    const centerPuckGeo = trackGeo(new THREE.CylinderGeometry(0.36, 0.38, 0.08, 32));
    centerPuckGeo.rotateX(Math.PI / 2);
    const centerPuckMesh = new THREE.Mesh(centerPuckGeo, goldMat);
    centerPuckMesh.position.set(0, 0, 0.11);
    plungerGroup.add(centerPuckMesh);

    // Subtle console lamp PointLight (gives physical spill onto the metallic bezel when GO turns on)
    const lampPointLight = new THREE.PointLight(0x2dd4bf, 0.4, 8);
    lampPointLight.position.set(0, 0.8, 1.35);
    scene.add(lampPointLight);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // State sync & on-demand rendering with software-WebGL fenceSync guard
    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let currentPressDepth = 0;
    let lastTickMs = performance.now();

    const applyVisualStateToMaterials = () => {
      const p = getVisualPalette(stateRef.current);
      lampMat.color.setHex(p.lampColor);
      lampMat.emissive.setHex(p.lampEmissive);
      lampMat.emissiveIntensity = p.lampEmissiveIntensity;

      ringMat.color.setHex(p.ringColor);
      ringMat.emissive.setHex(p.lampEmissive);
      ringMat.emissiveIntensity =
        stateRef.current === 'go' || stateRef.current === 'answer' ? 1.45 : 0.45;

      capMat.color.setHex(p.buttonCapColor);
      buttonCollarMat.color.setHex(p.buttonCollarColor);
      buttonCollarMat.emissive.setHex(p.buttonCollarColor);
      buttonCollarMat.emissiveIntensity =
        stateRef.current === 'go' || stateRef.current === 'answer' ? 0.55 : 0.14;

      lampPointLight.color.setHex(p.lampEmissive);
      lampPointLight.intensity =
        stateRef.current === 'go' || stateRef.current === 'answer'
          ? 2.2
          : stateRef.current === 'waiting'
          ? 0.65
          : 0.5;
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

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((nowMs) => {
        if (disposed) return;
        renderDirty = false;
        const dt = Math.min(0.08, Math.max(0.001, (nowMs - lastTickMs) / 1000));
        lastTickMs = nowMs;

        applyVisualStateToMaterials();

        // Smooth physical plunger press spring (only animates after user actually taps!)
        if (pressDepthTargetRef.current > 0.005) {
          currentPressDepth = reducedMotionRef.current
            ? pressDepthTargetRef.current
            : THREE.MathUtils.damp(currentPressDepth, pressDepthTargetRef.current, 24, dt);
          if (Math.abs(currentPressDepth - pressDepthTargetRef.current) < 0.015) {
            pressDepthTargetRef.current = 0;
          }
          renderDirty = true;
        } else if (currentPressDepth > 0.004) {
          currentPressDepth = reducedMotionRef.current
            ? 0
            : THREE.MathUtils.damp(currentPressDepth, 0, 14, dt);
          if (currentPressDepth <= 0.004) currentPressDepth = 0;
          else renderDirty = true;
        }
        plungerGroup.position.z = 0.22 - currentPressDepth;

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    requestRenderRef.current = requestRender;
    requestRender();

    const resizeObserver = new ResizeObserver((entries) => {
      if (disposed) return;
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(Math.floor(entry.contentRect.width), 280);
      const h = Math.max(Math.floor(entry.contentRect.height), compact ? 96 : 300);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    });
    resizeObserver.observe(container);

    return () => {
      disposed = true;
      requestRenderRef.current = null;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposables.geometries.forEach((g) => g.dispose());
      disposables.materials.forEach((m) => m.dispose());
      disposables.textures.forEach((t) => t.dispose());
      envTarget.dispose();
      renderer.dispose();
    };
  }, [use2DFallback, compact, onWebGLFallback]);

  if (use2DFallback) {
    return <QuickReflex2DStage {...props} />;
  }

  const palette = getVisualPalette(visualState);
  const isActionGo = visualState === 'go' || visualState === 'answer';

  if (compact) {
    return (
      <div
        className={`relative w-full h-[108px] sm:h-[118px] rounded-2xl overflow-hidden border-2 ${palette.cssBorder} bg-[#071226] shadow-lg`}
      >
        <div ref={mountRef} className="absolute inset-0" />
        {/* Instant semantic DOM readout overlay (zero animation lag, readable from back of class) */}
        <div className="relative z-10 h-full px-4 sm:px-6 flex items-center justify-between gap-4 bg-gradient-to-r from-[#061024]/82 via-[#061024]/52 to-[#061024]/75">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border-2 ${
                isActionGo
                  ? 'bg-teal-400 text-[#061024] border-white'
                  : visualState === 'waiting'
                  ? 'bg-amber-500/25 text-amber-200 border-amber-300'
                  : 'bg-[#0E1D38] text-white border-white/30'
              }`}
            >
              {renderStateIcon(visualState, 'w-7 h-7')}
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-black tracking-wider text-white leading-tight truncate">
                {headline}
              </div>
              {subline && (
                <div className={`text-xs sm:text-sm font-bold truncate ${palette.cssAccentText}`}>
                  {subline}
                </div>
              )}
            </div>
          </div>
          <div className="hidden md:block text-xs font-semibold text-slate-300 shrink-0">
            Bảng tín hiệu 3D
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full min-h-[370px] sm:min-h-[430px] rounded-2xl overflow-hidden border-2 ${palette.cssBorder} bg-[#071226] select-none`}
    >
      {/* Dedicated isolated WebGL canvas container */}
      <div ref={mountRef} className="absolute inset-0" />

      {/* Semantic DOM Status & Fixed-Position Tactile Response Zone (zero lag over 3D board) */}
      <div className="relative z-10 h-full min-h-[370px] sm:min-h-[430px] flex flex-col items-center justify-between py-5 sm:py-6 px-4 pointer-events-none">
        {/* Top Recessed Lamp Readout */}
        <div className="w-full max-w-md rounded-2xl bg-[#071327]/82 border border-white/20 px-5 py-3.5 text-center shadow-lg">
          <div className="flex items-center justify-center gap-3">
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                isActionGo
                  ? 'bg-teal-400 text-[#061024] border-white'
                  : visualState === 'waiting'
                  ? 'bg-amber-500/25 text-amber-200 border-amber-300/70'
                  : visualState === 'result_early' || visualState === 'result_timeout'
                  ? 'bg-rose-500/25 text-rose-200 border-rose-300/70'
                  : 'bg-sky-500/20 text-sky-200 border-sky-300/60'
              }`}
            >
              {renderStateIcon(visualState, 'w-6 h-6')}
            </span>
            <span className="text-4xl sm:text-5xl font-black tracking-wider text-white leading-none">
              {headline}
            </span>
          </div>
          {subline && (
            <p className={`mt-2 text-sm sm:text-base font-bold ${palette.cssAccentText}`}>
              {subline}
            </p>
          )}
        </div>

        {/* Fixed-position large response button aligned cleanly over 3D button deck */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onPointerDown={(e) => {
              if (!responseEnabled) return;
              e.preventDefault();
              onResponseTap?.();
            }}
            disabled={!responseEnabled}
            aria-label={isActionGo ? 'Bấm phản hồi ngay' : 'Nút phản hồi'}
            className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 flex flex-col items-center justify-center font-black text-xl sm:text-2xl tracking-wide transition-transform duration-75 select-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300 ${
              responseEnabled
                ? isActionGo
                  ? 'bg-white text-[#061024] border-teal-400 shadow-[0_0_32px_rgba(45,212,191,0.55)] active:scale-95 cursor-pointer'
                  : 'bg-white/92 text-[#0B172D] border-amber-400 shadow-xl active:scale-95 cursor-pointer'
                : 'bg-[#0B172D]/82 text-slate-400 border-slate-500/60 cursor-default'
            }`}
          >
            <span
              className={`text-[11px] sm:text-xs font-extrabold tracking-wider uppercase ${
                isActionGo ? 'text-teal-700' : responseEnabled ? 'text-amber-700' : 'text-slate-400'
              }`}
            >
              {isActionGo ? 'NHẤN NGAY' : responseEnabled ? 'ĐANG CHỜ' : 'PHẢN HỒI'}
            </span>
            <span className="mt-0.5">{isActionGo ? 'BẤM!' : 'SPACE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
