import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  RELAY_TEAM_PALETTES,
  RelayMode,
} from './relayTeam3dEngine';

export interface RelayLaneVisualData {
  teamId: string;
  teamName: string;
  paletteIndex: number;
  currentRunnerName: string;
  nextRunnerName: string;
  score: number;
  turnsCompleted: number;
  totalQuestions: number;
}

export interface RelayTeam3DSceneProps {
  mode: RelayMode;
  lanes: RelayLaneVisualData[];
  turnsCompleted: number;
  totalQuestions: number;
  handoffEventId: number; // increments when a turn is confirmed and baton passes
  batonHandedOff: boolean; // true during post-confirm handoff state (baton ends on receiver side)
  skipToken: number; // increments when teacher clicks "Bỏ qua hoạt ảnh"
  reducedMotion: boolean;
  force2D: boolean;
  compactView: boolean;
  onBatonContact?: () => void;
  onHandoffSettled?: () => void;
  onWebGLFallback?: () => void;
}

function createTrackTexture(
  laneCount: number,
  totalTurns: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Terracotta brick-red synthetic running track base
    ctx.fillStyle = '#a8382b';
    ctx.fillRect(0, 0, w, h);

    // Subtle alternating lane brightness & asphalt grain
    const safeLanes = Math.max(1, Math.min(6, laneCount));
    const marginY = 38;
    const usableH = h - marginY * 2;
    const laneH = usableH / safeLanes;

    for (let i = 0; i < safeLanes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ad3c2f' : '#9f3327';
      ctx.fillRect(0, marginY + i * laneH, w, laneH);
    }

    // Subtle rubberized track granules
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 2000; i++) {
      const gx = (i * 223) % w;
      const gy = (i * 389) % h;
      ctx.fillRect(gx, gy, 2, 2);
    }

    // Highlighted Baton Exchange Zone (center band, golden athletics box)
    const zoneStartX = w * 0.42;
    const zoneEndX = w * 0.58;
    ctx.fillStyle = 'rgba(250, 204, 21, 0.16)';
    ctx.fillRect(zoneStartX, marginY, zoneEndX - zoneStartX, usableH);

    // Exchange zone dashed yellow boundary lines
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(zoneStartX, marginY);
    ctx.lineTo(zoneStartX, h - marginY);
    ctx.moveTo(zoneEndX, marginY);
    ctx.lineTo(zoneEndX, h - marginY);
    ctx.stroke();

    // Turn progress ticks along the bottom curb
    const safeTurns = Math.max(1, Math.min(20, totalTurns));
    for (let t = 0; t <= safeTurns; t++) {
      const tx = 70 + (t / safeTurns) * (w - 140);
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = t === 0 || t === safeTurns ? 5 : 2;
      ctx.beginPath();
      ctx.moveTo(tx, h - marginY + 4);
      ctx.lineTo(tx, h - 10);
      ctx.stroke();
    }

    // Crisp white parallel lane dividers + lane numbers
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 5;
    for (let i = 0; i <= safeLanes; i++) {
      const y = marginY + i * laneH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    for (let i = 0; i < safeLanes; i++) {
      const cy = marginY + (i + 0.5) * laneH;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, 42, cy);
      ctx.fillText(`${i + 1}`, w - 42, cy);
    }

    // Exchange zone label on upper track edge
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VÙNG TRAO GẬY', w / 2, 22);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

interface RelayRunnerRig {
  root: THREE.Group;
  torsoPivot: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  handAnchor: THREE.Group; // right hand tip where baton attaches
}

/**
 * Composite 10-part grounded 3D student runner (bottom-center pivot at y = 0).
 */
function createRelayRunner(
  jerseyColor: number,
  accentColor: number,
  sharedMaterials: THREE.Material[]
): RelayRunnerRig {
  const root = new THREE.Group();

  const jerseyMat = new THREE.MeshStandardMaterial({
    color: jerseyColor,
    roughness: 0.45,
    metalness: 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.35,
    metalness: 0.14,
  });
  const shortsMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.68,
    metalness: 0.04,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf4c7a1,
    roughness: 0.56,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b24,
    roughness: 0.72,
    metalness: 0.05,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.42,
    metalness: 0.06,
  });
  sharedMaterials.push(jerseyMat, accentMat, shortsMat, skinMat, hairMat, shoeMat);

  const makeLeg = (zOffset: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(0, 0.58, zOffset);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.2, 6, 10), shortsMat);
    thigh.position.y = -0.13;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.2, 6, 10), skinMat);
    shin.position.y = -0.36;
    shin.castShadow = true;
    leg.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.15), shoeMat);
    shoe.position.set(0.05, -0.53, 0);
    shoe.castShadow = true;
    leg.add(shoe);

    return leg;
  };

  const leftLeg = makeLeg(0.11);
  const rightLeg = makeLeg(-0.11);
  root.add(leftLeg, rightLeg);

  const torsoPivot = new THREE.Group();
  torsoPivot.position.set(0, 0.6, 0);
  root.add(torsoPivot);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.34, 8, 12), jerseyMat);
  torso.position.y = 0.3;
  torso.castShadow = true;
  torsoPivot.add(torso);

  const chestStripe = new THREE.Mesh(new THREE.CylinderGeometry(0.188, 0.186, 0.1, 14), accentMat);
  chestStripe.position.y = 0.32;
  torsoPivot.add(chestStripe);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 14, 12), skinMat);
  head.position.y = 0.74;
  head.castShadow = true;
  torsoPivot.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.195, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat
  );
  hair.position.set(-0.02, 0.77, 0);
  torsoPivot.add(hair);

  const headband = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.024, 8, 18), accentMat);
  headband.rotation.x = Math.PI / 2;
  headband.position.y = 0.8;
  torsoPivot.add(headband);

  const makeArm = (zOffset: number): { arm: THREE.Group; hand: THREE.Group } => {
    const arm = new THREE.Group();
    arm.position.set(0.02, 0.44, zOffset);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.064, 0.28, 6, 10), jerseyMat);
    upper.position.y = -0.16;
    upper.castShadow = true;
    arm.add(upper);

    const hand = new THREE.Group();
    hand.position.set(0.02, -0.34, 0);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 10), skinMat);
    hand.add(palm);
    arm.add(hand);

    return { arm, hand };
  };

  const leftBuilt = makeArm(0.22);
  const rightBuilt = makeArm(-0.22);
  torsoPivot.add(leftBuilt.arm, rightBuilt.arm);

  return {
    root,
    torsoPivot,
    leftLeg,
    rightLeg,
    leftArm: leftBuilt.arm,
    rightArm: rightBuilt.arm,
    handAnchor: rightBuilt.hand,
  };
}

function createRelayBaton(
  teamColor: number,
  sharedMaterials: THREE.Material[]
): THREE.Group {
  const baton = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.82,
    emissive: 0xca8a04,
    emissiveIntensity: 0.22,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.35,
    metalness: 0.3,
  });
  sharedMaterials.push(goldMat, bandMat);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.56, 12), goldMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  baton.add(shaft);

  const gripBand = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.16, 12), bandMat);
  gripBand.rotation.z = Math.PI / 2;
  baton.add(gripBand);

  return baton;
}

// ============================================================================
// LIGHTWEIGHT 2D SVG FALLBACK ARENA (AUTOMATIC WHEN WEBGL UNAVAILABLE OR TOGGLED)
// ============================================================================

export const RelayTeam2DFallback: React.FC<{
  lanes: RelayLaneVisualData[];
  turnsCompleted: number;
  totalQuestions: number;
  batonHandedOff: boolean;
  compactView: boolean;
  reducedMotion: boolean;
}> = ({
  lanes,
  turnsCompleted,
  totalQuestions,
  batonHandedOff,
  compactView,
  reducedMotion,
}) => {
  const safeLanes = Math.max(1, lanes.length);
  const svgH = Math.max(190, safeLanes * 54 + 58);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#091428] select-none ${
        compactView ? 'max-h-[225px]' : 'max-h-[340px]'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-950/85 border-b border-slate-800 text-xs">
        <span className="font-extrabold text-amber-300">
          Sơ đồ đường chạy Tiếp sức (Chế độ 2D)
        </span>
        <span className="font-mono font-bold text-slate-200">
          Lượt đã hoàn thành: {turnsCompleted}/{totalQuestions}
        </span>
      </div>

      <svg
        viewBox={`0 0 1000 ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto block"
        role="img"
        aria-label="Sơ đồ sân tiếp sức đồng đội 2D"
      >
        {/* Track base */}
        <rect x="0" y="0" width="1000" height={svgH} fill="#091428" />
        <rect x="20" y="18" width="960" height={svgH - 36} rx="12" fill="#a8382b" />

        {/* Exchange zone */}
        <rect
          x="420"
          y="18"
          width="160"
          height={svgH - 36}
          fill="rgba(250, 204, 21, 0.18)"
        />
        <line x1="420" y1="18" x2="420" y2={svgH - 18} stroke="#facc15" strokeWidth="4" />
        <line x1="580" y1="18" x2="580" y2={svgH - 18} stroke="#facc15" strokeWidth="4" />
        <text
          x="500"
          y="13"
          textAnchor="middle"
          fill="#fde047"
          fontSize="12"
          fontWeight="800"
        >
          VÙNG TRAO GẬY
        </text>

        {lanes.map((lane, idx) => {
          const palette = RELAY_TEAM_PALETTES[lane.paletteIndex % RELAY_TEAM_PALETTES.length];
          const laneH = (svgH - 36) / safeLanes;
          const yTop = 18 + idx * laneH;
          const cy = yTop + laneH / 2;

          // Baton sits on left runner before handoff, moves cleanly to right receiver after handoff
          const passerX = batonHandedOff ? 450 : 310;
          const receiverX = batonHandedOff ? 640 : 550;
          const batonX = batonHandedOff ? receiverX - 24 : passerX + 24;

          return (
            <g key={lane.teamId}>
              {idx > 0 && (
                <line
                  x1="20"
                  y1={yTop}
                  x2="980"
                  y2={yTop}
                  stroke="rgba(255,255,255,0.72)"
                  strokeWidth="2.5"
                />
              )}

              {/* Team label plaque on left */}
              <rect
                x="30"
                y={cy - 16}
                width="205"
                height="32"
                rx="7"
                fill="rgba(9, 20, 40, 0.88)"
                stroke={palette.hex}
                strokeWidth="2"
              />
              <circle cx="46" cy={cy} r="6" fill={palette.hex} />
              <text x="60" y={cy + 4} fill="#f8fafc" fontSize="13" fontWeight="800">
                {lane.teamName.slice(0, 18)}
              </text>

              {/* Incoming runner (passer) */}
              <g
                style={{
                  transform: `translate(${passerX}px, ${cy}px)`,
                  transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle cx="0" cy="-10" r="8" fill="#f4c7a1" />
                <rect x="-8" y="-1" width="16" height="18" rx="5" fill={palette.hex} />
              </g>

              {/* Outgoing runner (receiver) */}
              <g
                style={{
                  transform: `translate(${receiverX}px, ${cy}px)`,
                  transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <circle cx="0" cy="-10" r="8" fill="#f4c7a1" />
                <rect x="-8" y="-1" width="16" height="18" rx="5" fill={palette.hex} stroke="#ffffff" strokeWidth="1.5" />
              </g>

              {/* Gleaming Golden Baton */}
              <g
                style={{
                  transform: `translate(${batonX}px, ${cy - 2}px)`,
                  transition: reducedMotion ? 'none' : 'transform 650ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <rect x="-15" y="-4" width="30" height="8" rx="4" fill="#facc15" stroke="#ffffff" strokeWidth="1.5" />
                <rect x="-5" y="-4" width="10" height="8" fill={palette.hex} />
              </g>

              {/* Active holder & Score plaque on right */}
              <rect
                x="715"
                y={cy - 16}
                width="255"
                height="32"
                rx="7"
                fill="rgba(9, 20, 40, 0.88)"
                stroke="rgba(148,163,184,0.45)"
                strokeWidth="1.5"
              />
              <text x="728" y={cy + 4} fill="#e2e8f0" fontSize="12.5" fontWeight="700">
                Cầm gậy: {lane.currentRunnerName.slice(0, 14)}
              </text>
              <text
                x="958"
                y={cy + 4}
                textAnchor="end"
                fill="#fde047"
                fontSize="13.5"
                fontWeight="800"
              >
                {lane.score} đ
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============================================================================
// MAIN THREE.JS 3D RELAY TRACK ARENA
// ============================================================================

const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();

export const RelayTeam3DScene: React.FC<RelayTeam3DSceneProps> = ({
  lanes,
  turnsCompleted,
  totalQuestions,
  handoffEventId,
  batonHandedOff,
  skipToken,
  reducedMotion,
  force2D,
  compactView,
  onBatonContact,
  onHandoffSettled,
  onWebGLFallback,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const laneSignature = useMemo(
    () => lanes.map((l) => `${l.teamId}:${l.paletteIndex}`).join('|'),
    [lanes]
  );

  // Refs synced to animation loop (prevent tearing down WebGL on score/name updates)
  const handoffProgressRef = useRef<number>(batonHandedOff ? 1 : 0);
  const handoffAnimatingRef = useRef<boolean>(false);
  const contactFiredRef = useRef<boolean>(false);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const onBatonContactRef = useRef(onBatonContact);
  const onHandoffSettledRef = useRef(onHandoffSettled);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    onBatonContactRef.current = onBatonContact;
    onHandoffSettledRef.current = onHandoffSettled;
  }, [reducedMotion, onBatonContact, onHandoffSettled]);

  // Reset handoff visual to start of exchange zone when preparing next turn
  useEffect(() => {
    if (!batonHandedOff && !handoffAnimatingRef.current) {
      handoffProgressRef.current = 0;
    }
  }, [batonHandedOff]);

  // Trigger synchronized baton handoff when handoffEventId increments
  useEffect(() => {
    if (handoffEventId <= 0) return;
    if (reducedMotionRef.current) {
      handoffProgressRef.current = 1;
      handoffAnimatingRef.current = false;
      contactFiredRef.current = true;
      onBatonContactRef.current?.();
      onHandoffSettledRef.current?.();
      return;
    }
    handoffProgressRef.current = 0;
    handoffAnimatingRef.current = true;
    contactFiredRef.current = false;
  }, [handoffEventId]);

  // Instant snap on "Bỏ qua hoạt ảnh"
  useEffect(() => {
    if (skipToken <= 0) return;
    handoffProgressRef.current = 1;
    if (handoffAnimatingRef.current) {
      handoffAnimatingRef.current = false;
      onHandoffSettledRef.current?.();
    }
  }, [skipToken]);

  const use2DFallback = force2D || webglFailed;

  useEffect(() => {
    if (use2DFallback) return;
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let frameId = 0;

    // Software-WebGL probe (per Three.js skill directive)
    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(320, container.clientWidth || 960);
    const height = Math.max(170, container.clientHeight || 260);

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      setWebglFailed(true);
      onWebGLFallback?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    // Scene & deep navy twilight stadium fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x091428);
    scene.fog = new THREE.Fog(0x091428, 22, 56);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const laneCount = Math.max(1, Math.min(6, lanes.length));
    const trackWidth = 20;
    const trackDepth = Math.max(5.4, laneCount * 1.45 + 1.4);

    // Elevated angled athletics broadcast camera framing all parallel lanes & exchange zone
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    const camZ = 10.5 + laneCount * 1.05;
    const camY = 5.4 + laneCount * 0.48;
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 0.65, 0);

    // Warm key + cool sky/track hemisphere + stadium rim light
    const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x3b1814, 0.85);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff4df, 1.55);
    keyLight.position.set(8, 15, 10);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 40;
      keyLight.shadow.camera.left = -13;
      keyLight.shadow.camera.right = 13;
      keyLight.shadow.camera.top = 9;
      keyLight.shadow.camera.bottom = -9;
      keyLight.shadow.bias = -0.0006;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.55);
    rimLight.position.set(-9, 8, -10);
    scene.add(rimLight);

    const disposables: Array<{ dispose: () => void }> = [envTex, pmrem];
    const sharedMaterials: THREE.Material[] = [];

    // Outer stadium emerald infield grass apron (extends naturally to horizon fog)
    const infieldGeo = new THREE.PlaneGeometry(68, 44);
    const infieldMat = new THREE.MeshStandardMaterial({
      color: 0x0d5c4a,
      roughness: 0.9,
      metalness: 0.02,
    });
    const infield = new THREE.Mesh(infieldGeo, infieldMat);
    infield.rotation.x = -Math.PI / 2;
    infield.position.y = -0.03;
    scene.add(infield);
    disposables.push(infieldGeo, infieldMat);

    // Main brick-red athletics running track with parallel lanes & golden exchange zone
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const trackTex = createTrackTexture(laneCount, Math.max(1, totalQuestions), maxAniso);
    const trackGeo = new THREE.PlaneGeometry(trackWidth, trackDepth);
    const trackMat = new THREE.MeshStandardMaterial({
      map: trackTex,
      roughness: 0.82,
      metalness: 0.04,
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.rotation.x = -Math.PI / 2;
    track.receiveShadow = true;
    scene.add(track);
    disposables.push(trackTex, trackGeo, trackMat);

    // Exchange zone golden boundary pylons (front & back curb)
    const pylonGeo = new THREE.CylinderGeometry(0.085, 0.11, 1.05, 10);
    const pylonCapGeo = new THREE.SphereGeometry(0.125, 10, 10);
    const goldPylonMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.3,
      metalness: 0.4,
      emissive: 0xca8a04,
      emissiveIntensity: 0.32,
    });
    disposables.push(pylonGeo, pylonCapGeo, goldPylonMat);

    const zoneHalfWorld = trackWidth * 0.08; // matches 0.42..0.58 of trackWidth
    [-zoneHalfWorld, zoneHalfWorld].forEach((px) => {
      [-trackDepth / 2 - 0.25, trackDepth / 2 + 0.25].forEach((pz) => {
        const post = new THREE.Mesh(pylonGeo, goldPylonMat);
        post.position.set(px, 0.525, pz);
        post.castShadow = true;
        scene.add(post);

        const cap = new THREE.Mesh(pylonCapGeo, goldPylonMat);
        cap.position.set(px, 1.1, pz);
        scene.add(cap);
      });
    });

    // Stadium background stands & floodlight towers
    const standMat = new THREE.MeshStandardMaterial({
      color: 0x162847,
      roughness: 0.82,
      metalness: 0.1,
    });
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x334e7b,
      roughness: 0.5,
      metalness: 0.35,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 1.4,
      roughness: 0.2,
    });
    disposables.push(standMat, poleMat, lampMat);

    const backZ = -trackDepth / 2 - 2.6;
    for (let tier = 0; tier < 3; tier++) {
      const benchGeo = new THREE.BoxGeometry(24, 0.52, 1.05);
      const bench = new THREE.Mesh(benchGeo, standMat);
      bench.position.set(0, 0.36 + tier * 0.6, backZ - tier * 1.15);
      scene.add(bench);
      disposables.push(benchGeo);
    }

    const poleGeo = new THREE.CylinderGeometry(0.11, 0.15, 7.6, 10);
    const lampGeo = new THREE.BoxGeometry(1.45, 0.42, 0.32);
    disposables.push(poleGeo, lampGeo);
    [-8.5, 8.5].forEach((lx) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lx, 3.8, backZ - 1.6);
      scene.add(pole);
      const head = new THREE.Mesh(lampGeo, lampMat);
      head.position.set(lx, 7.6, backZ - 1.35);
      head.rotation.x = 0.28;
      scene.add(head);
    });

    // Build parallel lane runner pairs (2 representative runners + 1 baton per team)
    interface LaneRig {
      zPos: number;
      passer: RelayRunnerRig;
      receiver: RelayRunnerRig;
      baton: THREE.Group;
      phaseOffset: number;
    }

    const laneRigs: LaneRig[] = [];
    const usableDepth = trackDepth * ((512 - 76) / 512);
    const laneStepZ = usableDepth / laneCount;

    lanes.slice(0, 6).forEach((lane, idx) => {
      const palette = RELAY_TEAM_PALETTES[lane.paletteIndex % RELAY_TEAM_PALETTES.length];
      const zPos = -usableDepth / 2 + (idx + 0.5) * laneStepZ;

      const passer = createRelayRunner(palette.hexNum, palette.accentNum, sharedMaterials);
      const receiver = createRelayRunner(palette.hexNum, palette.accentNum, sharedMaterials);
      const baton = createRelayBaton(palette.hexNum, sharedMaterials);

      passer.root.position.set(-3.4, 0, zPos);
      receiver.root.position.set(1.25, 0, zPos);

      scene.add(passer.root, receiver.root, baton);
      laneRigs.push({
        zPos,
        passer,
        receiver,
        baton,
        phaseOffset: idx * 0.72,
      });
    });

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // ResizeObserver for crisp 16:9 / compact strip framing
    const handleResize = () => {
      if (disposed || !renderer || !container) return;
      const w = Math.max(320, container.clientWidth);
      const h = Math.max(165, container.clientHeight);
      camera.aspect = w / h;
      const ultraWide = w / h > 3.1;
      camera.fov = ultraWide ? 31 : 36;
      camera.position.set(0, camY + (ultraWide ? 0.55 : 0), camZ + (ultraWide ? 1.5 : 0));
      camera.lookAt(0, 0.65, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    handleResize();

    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      if (disposed || !renderer) return;
      const gl2 = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl2.fenceSync ? gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl2.flush();
      const poll = () => {
        if (disposed) {
          gl2.deleteSync(sync);
          return;
        }
        const st = gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
        if (st === gl2.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl2.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed || !renderer) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      if (handoffAnimatingRef.current) {
        handoffProgressRef.current = Math.min(1, handoffProgressRef.current + dt / 1.15);
        if (handoffProgressRef.current >= 0.56 && !contactFiredRef.current) {
          contactFiredRef.current = true;
          onBatonContactRef.current?.();
        }
        if (handoffProgressRef.current >= 1) {
          handoffAnimatingRef.current = false;
          onHandoffSettledRef.current?.();
        }
      }

      const t = handoffProgressRef.current; // 0 = ready on left, 0.56 = baton exchange, 1 = receiver holds baton
      const isMoving = handoffAnimatingRef.current && !reducedMotionRef.current;

      for (const rig of laneRigs) {
        const stride = isMoving ? Math.sin(elapsed * 16 + rig.phaseOffset) : 0;
        const idleBounce = reducedMotionRef.current
          ? 0
          : Math.sin(elapsed * 2.4 + rig.phaseOffset) * 0.02;

        // Passer sprints from -3.5 -> -0.35 (entering exchange zone)
        const passerT = THREE.MathUtils.smoothstep(Math.min(1, t / 0.68), 0, 1);
        rig.passer.root.position.x = THREE.MathUtils.lerp(-3.5, -0.32, passerT);
        rig.passer.root.position.y = isMoving && t < 0.72 ? Math.abs(stride) * 0.1 : 0;

        // Receiver accelerates from +1.15 -> +3.35 after grasping baton
        const receiverT = THREE.MathUtils.smoothstep(Math.max(0, (t - 0.35) / 0.65), 0, 1);
        rig.receiver.root.position.x = THREE.MathUtils.lerp(1.15, 3.35, receiverT);
        rig.receiver.root.position.y = isMoving && t > 0.38 ? Math.abs(stride) * 0.1 : 0;

        // Passer arm reaches forward during exchange window (0.35..0.68)
        const passExtend = THREE.MathUtils.smoothstep(t, 0.25, 0.55) * (1 - THREE.MathUtils.smoothstep(t, 0.7, 0.92));
        rig.passer.rightArm.rotation.z = passExtend * 1.25 + stride * 0.45 * (1 - passExtend);
        rig.passer.leftArm.rotation.z = -stride * 0.45;
        rig.passer.leftLeg.rotation.z = stride * 0.58 * (t < 0.74 ? 1 : 0.15);
        rig.passer.rightLeg.rotation.z = -stride * 0.58 * (t < 0.74 ? 1 : 0.15);
        rig.passer.torsoPivot.rotation.z = -0.14 - passExtend * 0.14 + idleBounce;

        // Receiver arm reaches backward for baton (0.3..0.58), then swings forward holding baton
        const reachBack = THREE.MathUtils.smoothstep(t, 0.22, 0.54) * (1 - THREE.MathUtils.smoothstep(t, 0.58, 0.8));
        rig.receiver.rightArm.rotation.z = -reachBack * 1.15 + (t > 0.6 ? 0.55 + stride * 0.35 : 0);
        rig.receiver.leftArm.rotation.z = -stride * 0.45 * (t > 0.4 ? 1 : 0);
        rig.receiver.leftLeg.rotation.z = stride * 0.58 * (t > 0.38 ? 1 : 0);
        rig.receiver.rightLeg.rotation.z = -stride * 0.58 * (t > 0.38 ? 1 : 0);
        rig.receiver.torsoPivot.rotation.z = -0.1 - (t > 0.4 ? 0.12 : 0) + idleBounce;

        // Sync world matrices so baton aligns precisely with passer/receiver hand tips
        rig.passer.root.updateMatrixWorld(true);
        rig.receiver.root.updateMatrixWorld(true);
        rig.passer.handAnchor.getWorldPosition(_tmpVecA);
        rig.receiver.handAnchor.getWorldPosition(_tmpVecB);

        const transferAlpha = THREE.MathUtils.smoothstep(t, 0.5, 0.62);
        rig.baton.position.lerpVectors(_tmpVecA, _tmpVecB, transferAlpha);
        rig.baton.rotation.z = THREE.MathUtils.lerp(0.18, -0.12, transferAlpha);
      }

      renderer.render(scene, camera);

      if (!disposed) {
        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = window.requestAnimationFrame(tick);
        }
      }
    };

    if (isSoftwareGl) {
      tick();
    } else {
      frameId = window.requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          // Ignore
        }
      });
      sharedMaterials.forEach((m) => {
        try {
          m.dispose();
        } catch {
          // Ignore
        }
      });
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) {
          try {
            mesh.geometry.dispose();
          } catch {
            // Ignore
          }
        }
      });
      renderer?.dispose();
    };
  }, [use2DFallback, laneSignature, totalQuestions, onWebGLFallback]);

  if (use2DFallback) {
    return (
      <RelayTeam2DFallback
        lanes={lanes}
        turnsCompleted={turnsCompleted}
        totalQuestions={totalQuestions}
        batonHandedOff={batonHandedOff}
        compactView={compactView}
        reducedMotion={reducedMotion}
      />
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-[#091428] select-none ${
        compactView ? 'h-[178px] sm:h-[205px]' : 'h-[268px] sm:h-[322px] xl:h-[348px]'
      }`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top perimeter HUD (solid dark backing, zero backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute inset-x-3 top-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="rounded-lg border border-amber-400/50 bg-slate-950/90 px-3 py-1 text-xs font-extrabold text-amber-200">
          Lượt đã hoàn thành: <span className="font-mono text-white">{turnsCompleted}/{totalQuestions}</span>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-950/90 px-3 py-1 text-xs font-bold text-slate-200">
          {batonHandedOff ? 'Đã trao gậy sang người tiếp theo' : 'Sẵn sàng trên đường chạy'}
        </div>
      </div>

      {/* Bottom team lanes status strip (clearly readable from back of classroom) */}
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex flex-wrap items-center justify-center gap-1.5">
        {lanes.map((lane) => {
          const palette = RELAY_TEAM_PALETTES[lane.paletteIndex % RELAY_TEAM_PALETTES.length];
          return (
            <div
              key={lane.teamId}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700/90 bg-slate-950/92 px-2.5 py-1 text-[11px] sm:text-xs font-bold text-slate-100"
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: palette.hex }}
              />
              <span className="truncate max-w-[90px] sm:max-w-[130px] text-white font-extrabold">
                {lane.teamName}
              </span>
              <span className="text-slate-400">·</span>
              <span className="truncate max-w-[95px] sm:max-w-[130px] text-sky-200">
                {lane.currentRunnerName}
              </span>
              <span className="font-mono font-extrabold text-amber-300">{lane.score}đ</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RelayTeam3DScene;
