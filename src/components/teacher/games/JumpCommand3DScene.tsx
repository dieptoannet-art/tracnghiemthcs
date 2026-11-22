/**
 * E01 — NHẢY THEO LỆNH 3D — SCHOOL SPORTS STAGE & ARTICULATED 3D INSTRUCTOR + 2D FALLBACK
 * - Polished warm maple hardwood floor with crisp navy, emerald teal, yellow, and white court lines
 * - Front-facing composite articulated 3D instructor character with full-body visibility (raised fingers to sneakers)
 * - Supports both Standing ("Tại chỗ") & Seated ("Ngồi tại bàn", renders school bench + seated legs)
 * - Clear pose kinematics: ready_wait, raise_one_hand (A), raise_two_hands (B),
 *   palms_at_chest (C), hands_on_thighs (D), step_in_place
 * - Software-WebGL guard, RoomEnvironment + PMREMGenerator, afterDraw fenceSync pacing,
 *   webglcontextlost handler, reduced-motion / instant-snap support, and crisp 2D illustrated card fallback.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  JumpGestureId,
  JumpPostureSetting,
  getGestureSpec,
} from './jumpCommand3dEngine';

export interface JumpCommand3DSceneProps {
  gesture: JumpGestureId;
  posture: JumpPostureSetting;
  signalBannerText?: string | null;
  signalTone?: 'neutral' | 'prepare' | 'execute' | 'reveal';
  countdownNumber?: number | null;
  use3D: boolean;
  reducedMotion: boolean;
  skipAnimationKey: number;
  onWebGLUnavailable?: () => void;
}

interface PoseTarget {
  lShoulderX: number;
  lShoulderZ: number;
  lElbowX: number;
  lElbowZ: number;
  rShoulderX: number;
  rShoulderZ: number;
  rElbowX: number;
  rElbowZ: number;
  torsoYOffset: number;
  stepCycle: boolean;
}

function getTargetPose(gesture: JumpGestureId, posture: JumpPostureSetting): PoseTarget {
  const seatedDrop = posture === 'seated' ? -0.42 : 0;

  switch (gesture) {
    case 'raise_one_hand':
      // Instructor raises RIGHT arm (viewer's left side) straight & clearly overhead
      return {
        rShoulderX: -0.08,
        rShoulderZ: -2.85,
        rElbowX: -0.1,
        rElbowZ: -0.1,
        lShoulderX: 0.05,
        lShoulderZ: 0.18,
        lElbowX: -0.18,
        lElbowZ: 0,
        torsoYOffset: seatedDrop,
        stepCycle: false,
      };

    case 'raise_two_hands':
      // Both arms raised high in an unmistakable wide V overhead
      return {
        rShoulderX: -0.08,
        rShoulderZ: -2.65,
        rElbowX: -0.08,
        rElbowZ: 0.08,
        lShoulderX: -0.08,
        lShoulderZ: 2.65,
        lElbowX: -0.08,
        lElbowZ: -0.08,
        torsoYOffset: seatedDrop,
        stepCycle: false,
      };

    case 'palms_at_chest':
      // Both elbows bent inward so palms clearly meet in front of the chest
      return {
        rShoulderX: -0.82,
        rShoulderZ: -0.45,
        rElbowX: -0.78,
        rElbowZ: 1.02,
        lShoulderX: -0.82,
        lShoulderZ: 0.45,
        lElbowX: -0.78,
        lElbowZ: -1.02,
        torsoYOffset: seatedDrop,
        stepCycle: false,
      };

    case 'hands_on_thighs':
      // Both arms angled slightly forward/down resting hands firmly on thighs
      return {
        rShoulderX: posture === 'seated' ? -0.58 : -0.24,
        rShoulderZ: -0.16,
        rElbowX: posture === 'seated' ? -0.35 : -0.22,
        rElbowZ: 0.16,
        lShoulderX: posture === 'seated' ? -0.58 : -0.24,
        lShoulderZ: 0.16,
        lElbowX: posture === 'seated' ? -0.35 : -0.22,
        lElbowZ: -0.16,
        torsoYOffset: seatedDrop,
        stepCycle: false,
      };

    case 'step_in_place':
      // Standing gentle rhythmic march in place (never jumping or leaving the spot)
      return {
        rShoulderX: -0.35,
        rShoulderZ: -0.22,
        rElbowX: -0.85,
        rElbowZ: 0,
        lShoulderX: -0.35,
        lShoulderZ: 0.22,
        lElbowX: -0.85,
        lElbowZ: 0,
        torsoYOffset: seatedDrop,
        stepCycle: posture === 'standing',
      };

    case 'ready_wait':
    default:
      // Calm, neutral front-facing ready posture
      return {
        rShoulderX: 0.04,
        rShoulderZ: -0.2,
        rElbowX: -0.16,
        rElbowZ: 0,
        lShoulderX: 0.04,
        lShoulderZ: 0.2,
        lElbowX: -0.16,
        lElbowZ: 0,
        torsoYOffset: seatedDrop,
        stepCycle: false,
      };
  }
}

function createHardwoodCourtTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Warm maple hardwood planks
  ctx.fillStyle = '#D99E5B';
  ctx.fillRect(0, 0, 1024, 1024);

  const plankHeight = 32;
  const tones = ['#DFAA68', '#D39550', '#E3B273', '#CC8D49', '#DAA25E'];
  for (let y = 0; y < 1024; y += plankHeight) {
    const rowIdx = Math.floor(y / plankHeight);
    let x = -((rowIdx * 97) % 180);
    let p = 0;
    while (x < 1024) {
      const w = 160 + ((rowIdx * 37 + p * 53) % 90);
      ctx.fillStyle = tones[(rowIdx + p) % tones.length];
      ctx.fillRect(x, y, w - 2, plankHeight - 2);
      ctx.fillStyle = 'rgba(92, 52, 18, 0.18)';
      ctx.fillRect(x + w - 2, y, 2, plankHeight);
      x += w;
      p++;
    }
    ctx.fillStyle = 'rgba(92, 52, 18, 0.16)';
    ctx.fillRect(0, y + plankHeight - 2, 1024, 2);
  }

  // Navy border band
  ctx.fillStyle = '#0B1E3D';
  ctx.fillRect(0, 0, 1024, 88);
  ctx.fillRect(0, 936, 1024, 88);
  ctx.fillRect(0, 0, 88, 1024);
  ctx.fillRect(936, 0, 88, 1024);

  // Emerald teal center court zone
  ctx.fillStyle = 'rgba(13, 148, 136, 0.85)';
  ctx.beginPath();
  ctx.arc(512, 512, 175, 0, Math.PI * 2);
  ctx.fill();

  // Crisp white court lines
  ctx.strokeStyle = '#F8FAFC';
  ctx.lineWidth = 10;
  ctx.strokeRect(108, 108, 808, 808);
  ctx.beginPath();
  ctx.arc(512, 512, 175, 0, Math.PI * 2);
  ctx.stroke();

  // Yellow accent guide lines & center standing mark
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(108, 512);
  ctx.lineTo(916, 512);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(512, 512, 62, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
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

// ============================================================================
// 2D ILLUSTRATED GESTURE CARD FALLBACK (Zero WebGL Required)
// ============================================================================

const JumpCommand2DGestureCard: React.FC<JumpCommand3DSceneProps> = ({
  gesture,
  posture,
  signalBannerText,
  signalTone = 'neutral',
  countdownNumber,
}) => {
  const isWait = gesture === 'ready_wait';
  const spec = isWait ? null : getGestureSpec(gesture);
  const title = isWait ? 'Tư thế chờ' : spec!.name;
  const guide = isWait
    ? posture === 'seated'
      ? 'Ngồi ngay ngắn tại bàn, quan sát hiệu lệnh và sẵn sàng.'
      : 'Đứng thoải mái tại chỗ, hai tay thả lỏng tự nhiên.'
    : posture === 'seated'
    ? spec!.seatedGuide
    : spec!.standingGuide;

  const isSeated = posture === 'seated';

  return (
    <div className="relative w-full h-full min-h-[250px] rounded-2xl border border-teal-500/35 bg-gradient-to-b from-[#0B1E3D] via-[#10294F] to-[#08152C] p-4 flex flex-col justify-between overflow-hidden">
      {/* Top Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="text-teal-300">
          Chế độ 2D minh họa · {isSeated ? 'Ngồi tại bàn' : 'Đứng tại chỗ'}
        </span>
        {spec?.optionLetter && (
          <span className="px-2.5 py-0.5 rounded-md bg-yellow-400 text-[#071226] font-black">
            Đáp án {spec.optionLetter}
          </span>
        )}
      </div>

      {/* Main Illustrated Figure + Gesture Description */}
      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-5 py-2">
        <div className="relative w-40 h-44 rounded-2xl bg-[#D99E5B]/20 border border-yellow-400/35 flex items-center justify-center shrink-0">
          <svg
            viewBox="0 0 160 180"
            className="w-36 h-40"
            role="img"
            aria-label={`Minh họa động tác: ${title}`}
          >
            {/* Gym floor oval */}
            <ellipse cx="80" cy="164" rx="56" ry="10" fill="#0D9488" opacity="0.45" />
            <ellipse cx="80" cy="164" rx="34" ry="6" fill="#FACC15" opacity="0.35" />

            {/* Bench in seated mode */}
            {isSeated && (
              <rect x="46" y="122" width="68" height="10" rx="4" fill="#E2E8F0" />
            )}

            {/* Legs */}
            {isSeated ? (
              <>
                <path
                  d="M68 112 L58 134 L58 158"
                  stroke="#1E3A8A"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M92 112 L102 134 L102 158"
                  stroke="#1E3A8A"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </>
            ) : gesture === 'step_in_place' ? (
              <>
                <path
                  d="M70 112 L64 158"
                  stroke="#1E3A8A"
                  strokeWidth="12"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M90 112 L98 136 L94 148"
                  stroke="#1E3A8A"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </>
            ) : (
              <>
                <line x1="70" y1="112" x2="66" y2="158" stroke="#1E3A8A" strokeWidth="12" strokeLinecap="round" />
                <line x1="90" y1="112" x2="94" y2="158" stroke="#1E3A8A" strokeWidth="12" strokeLinecap="round" />
              </>
            )}

            {/* Sneakers */}
            <ellipse cx={isSeated ? 58 : 65} cy="161" rx="9" ry="5" fill="#14B8A6" />
            <ellipse
              cx={isSeated ? 102 : gesture === 'step_in_place' ? 94 : 95}
              cy={gesture === 'step_in_place' ? 151 : 161}
              rx="9"
              ry="5"
              fill="#14B8A6"
            />

            {/* Torso (Navy & Emerald Tracksuit) */}
            <rect x="61" y="60" width="38" height="54" rx="14" fill="#0B1E3D" stroke="#14B8A6" strokeWidth="3" />
            <path d="M64 74 L80 84 L96 74" stroke="#F8FAFC" strokeWidth="3" fill="none" />

            {/* Head */}
            <circle cx="80" cy="40" r="16" fill="#FDE6C4" />
            <path d="M64 36 C66 20, 94 20, 96 36 C90 29, 70 29, 64 36 Z" fill="#3B2314" />
            <circle cx="74" cy="39" r="2" fill="#0F172A" />
            <circle cx="86" cy="39" r="2" fill="#0F172A" />
            <path d="M74 46 Q80 51 86 46" stroke="#9A3412" strokeWidth="2" fill="none" strokeLinecap="round" />

            {/* Arms per gesture */}
            {gesture === 'raise_one_hand' && (
              <>
                {/* Right arm (viewer left) raised straight up */}
                <path d="M62 68 L44 20" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="44" cy="16" r="6" fill="#FDE6C4" />
                {/* Left arm resting */}
                <path d="M98 68 L108 106" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="108" cy="109" r="5" fill="#FDE6C4" />
              </>
            )}

            {gesture === 'raise_two_hands' && (
              <>
                <path d="M62 68 L38 20" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="38" cy="16" r="6" fill="#FDE6C4" />
                <path d="M98 68 L122 20" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="122" cy="16" r="6" fill="#FDE6C4" />
              </>
            )}

            {gesture === 'palms_at_chest' && (
              <>
                <path d="M62 68 L48 88 L76 86" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M98 68 L112 88 L84 86" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="80" cy="86" r="7" fill="#FACC15" />
              </>
            )}

            {gesture === 'hands_on_thighs' && (
              <>
                <path d="M62 68 L56 102 L68 124" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M98 68 L104 102 L92 124" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <circle cx="68" cy="126" r="6" fill="#FACC15" />
                <circle cx="92" cy="126" r="6" fill="#FACC15" />
              </>
            )}

            {gesture === 'step_in_place' && (
              <>
                <path d="M62 68 L48 92 L60 98" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M98 68 L112 88 L100 94" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </>
            )}

            {gesture === 'ready_wait' && (
              <>
                <path d="M62 68 L52 108" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="52" cy="111" r="5" fill="#FDE6C4" />
                <path d="M98 68 L108 108" stroke="#0D9488" strokeWidth="10" strokeLinecap="round" />
                <circle cx="108" cy="111" r="5" fill="#FDE6C4" />
              </>
            )}
          </svg>

          {typeof countdownNumber === 'number' && countdownNumber > 0 && (
            <div className="absolute inset-0 bg-[#071226]/75 rounded-2xl flex items-center justify-center">
              <span className="text-6xl font-black text-yellow-400 tabular-nums">
                {countdownNumber}
              </span>
            </div>
          )}
        </div>

        <div className="text-center sm:text-left max-w-sm space-y-1.5">
          {signalBannerText && (
            <div
              className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide ${
                signalTone === 'execute'
                  ? 'bg-yellow-400 text-[#071226]'
                  : signalTone === 'reveal'
                  ? 'bg-emerald-400 text-[#071226]'
                  : signalTone === 'prepare'
                  ? 'bg-teal-500/30 border border-teal-400 text-teal-100'
                  : 'bg-slate-800 text-slate-200'
              }`}
            >
              {signalBannerText}
            </div>
          )}
          <div className="text-xl sm:text-2xl font-black text-white">{title}</div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">{guide}</p>
          {spec && (
            <p className="text-[11px] font-semibold text-teal-300">
              Lựa chọn thay thế: {spec.cardFallbackText}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN 3D SPORTS STAGE + ARTICULATED INSTRUCTOR COMPONENT
// ============================================================================

export const JumpCommand3DScene: React.FC<JumpCommand3DSceneProps> = (props) => {
  const {
    gesture,
    posture,
    signalBannerText,
    signalTone = 'neutral',
    countdownNumber,
    use3D,
    reducedMotion,
    skipAnimationKey,
    onWebGLUnavailable,
  } = props;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState<boolean>(false);

  const latestPropsRef = useRef(props);
  latestPropsRef.current = props;

  const snapRequestedRef = useRef<boolean>(false);
  useEffect(() => {
    if (skipAnimationKey > 0) {
      snapRequestedRef.current = true;
    }
  }, [skipAnimationKey]);

  useEffect(() => {
    if (!use3D || webglUnavailable) return;
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      onWebGLUnavailable?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      setWebglUnavailable(true);
      onWebGLUnavailable?.();
      return;
    }

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(240, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvasEl = renderer.domElement;
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(canvasEl);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglUnavailable(true);
      onWebGLUnavailable?.();
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost, false);

    // ---- SCENE, ENVIRONMENT & LIGHTING ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B1D39');
    scene.fog = new THREE.FogExp2('#0B1D39', 0.025);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    // Stable front-facing camera keeping FULL body (raised fingertips to sneakers) inside frame
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    camera.position.set(0, 1.48, 5.55);
    camera.lookAt(0, 1.32, 0);

    const hemiLight = new THREE.HemisphereLight(0xf0f9ff, 0x7c4a1d, 0.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    keyLight.position.set(3.2, 6.2, 5.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const tealRim = new THREE.PointLight(0x14b8a6, 1.6, 12);
    tealRim.position.set(-3.2, 2.8, -1.8);
    scene.add(tealRim);

    const goldRim = new THREE.PointLight(0xfacc15, 1.4, 12);
    goldRim.position.set(3.2, 2.8, -1.8);
    scene.add(goldRim);

    // ---- SCHOOL GYMNASIUM WOODEN STAGE ----
    const floorTex = createHardwoodCourtTexture(renderer.capabilities.getMaxAnisotropy());
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.38,
      metalness: 0.06,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 10), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // Architectural gym back wall (warm cream + navy/teal sports panels)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 });
    const navyMat = new THREE.MeshStandardMaterial({ color: 0x0b1e3d, roughness: 0.45, metalness: 0.15 });
    const tealMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.35, metalness: 0.18 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.65 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.08 });
    const woodWallMat = new THREE.MeshStandardMaterial({ color: 0xc2894c, roughness: 0.65, metalness: 0.04 });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 5.4, 0.25), wallMat);
    backWall.position.set(0, 2.7, -3.2);
    scene.add(backWall);

    const lowerDado = new THREE.Mesh(new THREE.BoxGeometry(14, 1.15, 0.28), navyMat);
    lowerDado.position.set(0, 0.58, -3.16);
    scene.add(lowerDado);

    const dadoStripe = new THREE.Mesh(new THREE.BoxGeometry(14, 0.09, 0.3), yellowMat);
    dadoStripe.position.set(0, 1.18, -3.14);
    scene.add(dadoStripe);

    // Subtle framed gym panels on back wall
    [-3.1, 0, 3.1].forEach((px, idx) => {
      const panelFrame = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 2.5, 0.12),
        idx === 1 ? tealMat : woodWallMat
      );
      panelFrame.position.set(px, 2.75, -3.05);
      scene.add(panelFrame);

      const innerPanel = new THREE.Mesh(
        new THREE.BoxGeometry(2.05, 2.25, 0.14),
        idx === 1 ? navyMat : whiteMat
      );
      innerPanel.position.set(px, 2.75, -3.02);
      scene.add(innerPanel);
    });

    // Subtle glowing floor ring under instructor
    const spotRingMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const spotRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.03, 12, 48), spotRingMat);
    spotRing.rotation.x = Math.PI / 2;
    spotRing.position.y = 0.025;
    scene.add(spotRing);

    // ---- SEATED BENCH (VISIBLE ONLY IN 'seated' POSTURE) ----
    const benchGroup = new THREE.Group();
    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.48), woodWallMat);
    benchTop.position.set(0, 0.54, -0.06);
    benchTop.castShadow = !isSoftwareGl;
    benchTop.receiveShadow = true;
    benchGroup.add(benchTop);

    [-0.44, 0.44].forEach((bx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.4), navyMat);
      leg.position.set(bx, 0.26, -0.06);
      leg.castShadow = !isSoftwareGl;
      benchGroup.add(leg);
    });
    benchGroup.visible = false;
    scene.add(benchGroup);

    // ---- ARTICULATED COMPOSITE 3D INSTRUCTOR CHARACTER (BOTTOM-CENTER PIVOT) ----
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf7cfa8, roughness: 0.52, metalness: 0.02 });
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x2f1d12, roughness: 0.72, metalness: 0.04 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.1 });
    const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const shoeUpperMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, roughness: 0.38 });
    const pantMat = new THREE.MeshStandardMaterial({ color: 0x102a52, roughness: 0.62 });

    const characterRoot = new THREE.Group();
    scene.add(characterRoot);

    // Pelvis / Hips pivot (height ~0.98 standing)
    const pelvisGroup = new THREE.Group();
    pelvisGroup.position.set(0, 0.98, 0);
    characterRoot.add(pelvisGroup);

    const pelvisMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.28), pantMat);
    pelvisMesh.castShadow = !isSoftwareGl;
    pelvisGroup.add(pelvisMesh);

    // Torso (navy tracksuit with emerald chest V and white stripe)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 0.1, 0);
    pelvisGroup.add(torsoGroup);

    const torsoCore = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), navyMat);
    torsoCore.position.y = 0.31;
    torsoCore.castShadow = !isSoftwareGl;
    torsoGroup.add(torsoCore);

    const chestEmerald = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.315), tealMat);
    chestEmerald.position.y = 0.44;
    torsoGroup.add(chestEmerald);

    const chestStripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.045, 0.322), whiteMat);
    chestStripe.position.y = 0.32;
    torsoGroup.add(chestStripe);

    const goldEmblem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), yellowMat);
    goldEmblem.rotation.x = Math.PI / 2;
    goldEmblem.position.set(-0.14, 0.48, 0.165);
    torsoGroup.add(goldEmblem);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.09, 16), whiteMat);
    collar.position.y = 0.65;
    torsoGroup.add(collar);

    // Head + Hair + Eyes + Friendly Smile
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.87, 0);
    torsoGroup.add(headGroup);

    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 24), skinMat);
    headMesh.scale.set(0.96, 1.05, 0.96);
    headMesh.castShadow = !isSoftwareGl;
    headGroup.add(headMesh);

    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hairCap.position.set(0, 0.03, -0.015);
    headGroup.add(hairCap);

    [-0.072, 0.072].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), eyeMat);
      eye.position.set(ex, 0.02, 0.185);
      headGroup.add(eye);
    });

    const smileMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.011, 8, 16, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.5 })
    );
    smileMesh.rotation.z = Math.PI;
    smileMesh.position.set(0, -0.045, 0.185);
    headGroup.add(smileMesh);

    // Helper to build articulated arm (shoulder -> upper arm -> elbow -> forearm -> hand)
    function buildArm(sideSign: -1 | 1) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sideSign * 0.34, 0.54, 0);
      torsoGroup.add(shoulder);

      const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 16), tealMat);
      shoulder.add(shoulderJoint);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.064, 0.34, 14), navyMat);
      upperArm.position.y = -0.17;
      upperArm.castShadow = !isSoftwareGl;
      shoulder.add(upperArm);

      const elbow = new THREE.Group();
      elbow.position.set(0, -0.34, 0);
      shoulder.add(elbow);

      const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 14), whiteMat);
      elbow.add(elbowJoint);

      const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.32, 14), tealMat);
      forearm.position.y = -0.16;
      forearm.castShadow = !isSoftwareGl;
      elbow.add(forearm);

      const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.04, 14), yellowMat);
      wristBand.position.y = -0.31;
      elbow.add(wristBand);

      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.055), skinMat);
      hand.position.y = -0.39;
      hand.castShadow = !isSoftwareGl;
      elbow.add(hand);

      return { shoulder, elbow };
    }

    // In Three.js front view (+Z facing viewer), character's RIGHT arm is at -X, LEFT arm is at +X
    const rightArm = buildArm(-1);
    const leftArm = buildArm(1);

    // Helper to build articulated leg (hip -> thigh -> knee -> shin -> sneaker)
    function buildLeg(sideSign: -1 | 1) {
      const hip = new THREE.Group();
      hip.position.set(sideSign * 0.145, -0.06, 0);
      pelvisGroup.add(hip);

      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.44, 14), pantMat);
      thigh.position.y = -0.22;
      thigh.castShadow = !isSoftwareGl;
      hip.add(thigh);

      const knee = new THREE.Group();
      knee.position.set(0, -0.44, 0);
      hip.add(knee);

      const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 14), pantMat);
      knee.add(kneeCap);

      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.42, 14), pantMat);
      shin.position.y = -0.21;
      shin.castShadow = !isSoftwareGl;
      knee.add(shin);

      const sneakerUpper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.28), shoeUpperMat);
      sneakerUpper.position.set(0, -0.43, 0.05);
      sneakerUpper.castShadow = !isSoftwareGl;
      knee.add(sneakerUpper);

      const sneakerSole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.3), shoeSoleMat);
      sneakerSole.position.set(0, -0.48, 0.05);
      knee.add(sneakerSole);

      return { hip, knee };
    }

    const rightLeg = buildLeg(-1);
    const leftLeg = buildLeg(1);

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(300, Math.floor(entry.contentRect.width));
        const h = Math.max(240, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer?.setSize(w, h);
      }
    });
    resizeObserver.observe(container);

    // ---- ANIMATION LOOP WITH SOFTWARE-WEBGL FENCESYNC PACING ----
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      if (disposed || !renderer) return;
      const ctxGl = renderer.getContext();
      if (ctxGl instanceof WebGL2RenderingContext) {
        const sync = ctxGl.fenceSync(ctxGl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        ctxGl.flush();
        const poll = () => {
          if (disposed) {
            if (sync) ctxGl.deleteSync(sync);
            return;
          }
          const st = sync && ctxGl.getSyncParameter(sync, ctxGl.SYNC_STATUS);
          if (st === ctxGl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) ctxGl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    const tick = () => {
      if (disposed || !renderer) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime();
      const p = latestPropsRef.current;

      const target = getTargetPose(p.gesture, p.posture);
      const instant = p.reducedMotion || snapRequestedRef.current;
      snapRequestedRef.current = false;
      const lambda = instant ? 999 : 11;

      // Show/hide seated bench
      benchGroup.visible = p.posture === 'seated';

      // Pelvis height + subtle alive breathing
      const breath = p.reducedMotion ? 0 : Math.sin(t * 2.2) * 0.012;
      const targetPelvisY = 0.98 + target.torsoYOffset + breath;
      pelvisGroup.position.y = instant
        ? targetPelvisY
        : THREE.MathUtils.damp(pelvisGroup.position.y, targetPelvisY, lambda, dt);

      // Gentle step-in-place leg & arm alternation (standing only)
      const marchWave =
        target.stepCycle && !p.reducedMotion ? Math.sin(t * 5.2) : 0;

      const rArmExtraX = target.stepCycle ? marchWave * 0.25 : 0;
      const lArmExtraX = target.stepCycle ? -marchWave * 0.25 : 0;

      rightArm.shoulder.rotation.x = instant
        ? target.rShoulderX + rArmExtraX
        : THREE.MathUtils.damp(rightArm.shoulder.rotation.x, target.rShoulderX + rArmExtraX, lambda, dt);
      rightArm.shoulder.rotation.z = instant
        ? target.rShoulderZ
        : THREE.MathUtils.damp(rightArm.shoulder.rotation.z, target.rShoulderZ, lambda, dt);
      rightArm.elbow.rotation.x = instant
        ? target.rElbowX
        : THREE.MathUtils.damp(rightArm.elbow.rotation.x, target.rElbowX, lambda, dt);
      rightArm.elbow.rotation.z = instant
        ? target.rElbowZ
        : THREE.MathUtils.damp(rightArm.elbow.rotation.z, target.rElbowZ, lambda, dt);

      leftArm.shoulder.rotation.x = instant
        ? target.lShoulderX + lArmExtraX
        : THREE.MathUtils.damp(leftArm.shoulder.rotation.x, target.lShoulderX + lArmExtraX, lambda, dt);
      leftArm.shoulder.rotation.z = instant
        ? target.lShoulderZ
        : THREE.MathUtils.damp(leftArm.shoulder.rotation.z, target.lShoulderZ, lambda, dt);
      leftArm.elbow.rotation.x = instant
        ? target.lElbowX
        : THREE.MathUtils.damp(leftArm.elbow.rotation.x, target.lElbowX, lambda, dt);
      leftArm.elbow.rotation.z = instant
        ? target.lElbowZ
        : THREE.MathUtils.damp(leftArm.elbow.rotation.z, target.lElbowZ, lambda, dt);

      // Legs: seated bend vs standing grounded vs gentle step-in-place
      let rHipTargetX = 0;
      let rKneeTargetX = 0;
      let lHipTargetX = 0;
      let lKneeTargetX = 0;

      if (p.posture === 'seated') {
        rHipTargetX = -1.42;
        rKneeTargetX = 1.42;
        lHipTargetX = -1.42;
        lKneeTargetX = 1.42;
      } else if (target.stepCycle) {
        const liftR = Math.max(0, marchWave);
        const liftL = Math.max(0, -marchWave);
        rHipTargetX = -liftR * 0.65;
        rKneeTargetX = liftR * 0.95;
        lHipTargetX = -liftL * 0.65;
        lKneeTargetX = liftL * 0.95;
      }

      rightLeg.hip.rotation.x = instant
        ? rHipTargetX
        : THREE.MathUtils.damp(rightLeg.hip.rotation.x, rHipTargetX, lambda, dt);
      rightLeg.knee.rotation.x = instant
        ? rKneeTargetX
        : THREE.MathUtils.damp(rightLeg.knee.rotation.x, rKneeTargetX, lambda, dt);
      leftLeg.hip.rotation.x = instant
        ? lHipTargetX
        : THREE.MathUtils.damp(leftLeg.hip.rotation.x, lHipTargetX, lambda, dt);
      leftLeg.knee.rotation.x = instant
        ? lKneeTargetX
        : THREE.MathUtils.damp(leftLeg.knee.rotation.x, lKneeTargetX, lambda, dt);

      // Subtle ring feedback color for execute / reveal states
      if (p.signalTone === 'execute') {
        spotRingMat.color.setHex(0xfacc15);
        spotRingMat.emissive.setHex(0xeab308);
        spotRingMat.emissiveIntensity = 0.85;
      } else if (p.signalTone === 'reveal') {
        spotRingMat.color.setHex(0x10b981);
        spotRingMat.emissive.setHex(0x059669);
        spotRingMat.emissiveIntensity = 0.85;
      } else {
        spotRingMat.color.setHex(0x14b8a6);
        spotRingMat.emissive.setHex(0x0d9488);
        spotRingMat.emissiveIntensity = 0.45;
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      canvasEl.removeEventListener('webglcontextlost', onContextLost);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      floorTex.dispose();
      envTex.dispose();
      renderer?.dispose();
    };
  }, [use3D, webglUnavailable, onWebGLUnavailable]);

  if (!use3D || webglUnavailable) {
    return <JumpCommand2DGestureCard {...props} />;
  }

  const isWait = gesture === 'ready_wait';
  const spec = isWait ? null : getGestureSpec(gesture);

  return (
    <div className="relative w-full h-full min-h-[250px] rounded-2xl overflow-hidden border border-teal-500/35 bg-[#0B1D39]">
      {/* Dedicated WebGL Mount Container (No sibling React nodes inside) */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Clean Solid HUD Overlays (Zero backdrop-blur over WebGL!) */}
      <div className="pointer-events-none absolute top-3 left-3 flex flex-wrap items-center gap-2">
        <div className="px-3 py-1 rounded-lg bg-[#071226]/90 border border-teal-400/45 text-xs font-extrabold text-white">
          {posture === 'seated' ? 'Ngồi tại bàn' : 'Đứng tại chỗ'}
        </div>
        {spec?.optionLetter && (
          <div className="px-3 py-1 rounded-lg bg-yellow-400 text-[#071226] text-xs font-black">
            Đáp án {spec.optionLetter}
          </div>
        )}
      </div>

      {/* Prominent Signal Banner */}
      {signalBannerText && (
        <div className="pointer-events-none absolute top-3 right-3">
          <div
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-black tracking-wide shadow-md ${
              signalTone === 'execute'
                ? 'bg-yellow-400 text-[#071226]'
                : signalTone === 'reveal'
                ? 'bg-emerald-400 text-[#071226]'
                : signalTone === 'prepare'
                ? 'bg-teal-600 text-white'
                : 'bg-[#071226]/90 border border-slate-600 text-slate-100'
            }`}
          >
            {signalBannerText}
          </div>
        </div>
      )}

      {/* Large Countdown Overlay (3-2-1) */}
      {typeof countdownNumber === 'number' && countdownNumber > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-24 h-24 rounded-2xl bg-[#071226]/90 border-2 border-yellow-400 flex items-center justify-center shadow-2xl">
            <span className="text-6xl font-black text-yellow-400 tabular-nums">
              {countdownNumber}
            </span>
          </div>
        </div>
      )}

      {/* Bottom Gesture Name Bar */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#071226]/92 border border-white/15">
        <div className="min-w-0">
          <div className="text-sm sm:text-base font-black text-white truncate">
            {isWait ? 'Tư thế chờ' : spec!.name}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-300 truncate">
            {isWait
              ? posture === 'seated'
                ? 'Ngồi ngay ngắn tại bàn, quan sát hiệu lệnh'
                : 'Đứng tại chỗ, hai tay thả lỏng sẵn sàng'
              : posture === 'seated'
              ? spec!.seatedGuide
              : spec!.standingGuide}
          </div>
        </div>
        {spec && (
          <span className="hidden md:inline text-[11px] font-bold text-teal-300 shrink-0">
            {spec.cardFallbackText}
          </span>
        )}
      </div>
    </div>
  );
};
