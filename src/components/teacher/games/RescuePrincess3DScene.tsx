import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Crown, KeyRound, Lock, ShieldCheck, Sparkles, Unlock } from 'lucide-react';
import {
  C07GraphicsQuality,
  C07Phase,
  C07ZoneId,
  C07ZoneState,
  C07ZoneStatus,
} from './rescuePrincess3dEngine';

export interface RescuePrincessSceneProps {
  zones: [C07ZoneState, C07ZoneState, C07ZoneState];
  activeZoneId: C07ZoneId | null;
  phase: C07Phase;
  finalGateOpened: boolean;
  princessRescued: boolean;
  quality: C07GraphicsQuality;
  reducedMotion: boolean;
  onSelectZone: (zoneId: C07ZoneId) => void;
  onSelectFinalGate: () => void;
  onWebGLFallback?: () => void;
}

const ZONE_WORLD_POS: Record<C07ZoneId, [number, number]> = {
  zone_fractions: [-4.2, 1.4],
  zone_statistics: [0.0, 2.2],
  zone_geometry: [4.2, 1.4],
};

const ZONE_STATUS_LABELS: Record<C07ZoneStatus, string> = {
  unexplored: 'Chưa mở cửa',
  in_progress: 'Đang chinh phục',
  key_awarded: 'Đã lấy Chìa',
};

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Mesa/i.test(gpu);
  } catch {
    return true;
  }
}

function buildZoneCastleWing(accentHex: number, orderIndex: number): THREE.Group {
  const group = new THREE.Group();

  // Primary stone bastion base
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.08 });
  const trimMat = new THREE.MeshStandardMaterial({ color: accentHex, roughness: 0.35, metalness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: orderIndex === 0 ? 0xb45309 : orderIndex === 1 ? 0x0369a1 : 0x047857,
    roughness: 0.55,
    metalness: 0.12,
  });

  const basePlinth = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, 0.24, 18), stoneMat);
  basePlinth.position.y = 0.12;
  group.add(basePlinth);

  const mainTower = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 1.45, 14), stoneMat);
  mainTower.position.y = 0.96;
  group.add(mainTower);

  // Secondary battlements ring
  const battlementRing = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.72, 0.22, 14), trimMat);
  battlementRing.position.y = 1.72;
  group.add(battlementRing);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.86, 0.92, 14), roofMat);
  roof.position.y = 2.26;
  group.add(roof);

  // Illuminated arched portal
  const archDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.68, 0.32),
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    })
  );
  archDoor.position.set(0, 0.56, 0.68);
  group.add(archDoor);

  // Accent pennant spire
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.55, 8), trimMat);
  mast.position.y = 2.9;
  group.add(mast);

  return group;
}

/**
 * Original multi-part procedural Princess Companion (appears ONLY after Final Gate completion)
 */
function buildPrincessCompanionModel(): {
  root: THREE.Group;
  rightArmPivot: THREE.Group;
} {
  const root = new THREE.Group();

  const gownMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.42,
    metalness: 0.18,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    roughness: 0.22,
    metalness: 0.88,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xfde2c8,
    roughness: 0.65,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.72,
    metalness: 0.05,
  });

  // Layered royal gown skirt (Lathe-like stacked profile)
  const lowerSkirt = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.78, 20), gownMat);
  lowerSkirt.position.y = 0.39;
  const skirtTrim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 24), goldMat);
  skirtTrim.rotation.x = Math.PI / 2;
  skirtTrim.position.y = 0.05;
  const bodice = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.21, 0.42, 14), gownMat);
  bodice.position.y = 0.94;
  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.08, 14), goldMat);
  sash.position.y = 0.78;

  // Royal cape
  const cape = new THREE.Mesh(
    new THREE.ConeGeometry(0.32, 0.82, 10, 1, false, -Math.PI * 0.35, Math.PI * 0.7),
    new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.6, side: THREE.DoubleSide })
  );
  cape.position.set(0, 0.76, -0.08);

  // Head + Crown + Hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 14), skinMat);
  head.position.y = 1.32;
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.205, 14, 12), hairMat);
  hairBack.position.set(0, 1.33, -0.05);
  const hairBun = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), hairMat);
  hairBun.position.set(0, 1.48, -0.14);

  // Tiara Crown
  const crownBand = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 16), goldMat);
  crownBand.rotation.x = Math.PI / 2;
  crownBand.position.y = 1.5;
  const crownGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.055, 0),
    new THREE.MeshStandardMaterial({ color: 0x22d3ee, emissive: 0x06b6d4, emissiveIntensity: 0.9 })
  );
  crownGem.position.set(0, 1.56, 0.1);

  // Left arm + Waving right arm with golden star scepter
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.36, 10), skinMat);
  leftArm.position.set(-0.22, 0.96, 0);
  leftArm.rotation.z = 0.35;

  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.19, 1.08, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.36, 10), skinMat);
  rightArm.position.set(0.09, -0.1, 0.04);
  rightArm.rotation.z = -0.65;
  const wandShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8), goldMat);
  wandShaft.position.set(0.22, 0.06, 0.08);
  const wandStar = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.075, 0),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 1.0 })
  );
  wandStar.position.set(0.22, 0.27, 0.08);
  rightArmPivot.add(rightArm, wandShaft, wandStar);

  root.add(
    lowerSkirt,
    skirtTrim,
    bodice,
    sash,
    cape,
    head,
    hairBack,
    hairBun,
    crownBand,
    crownGem,
    leftArm,
    rightArmPivot
  );

  return { root, rightArmPivot };
}

export const RescuePrincess2DStage: React.FC<RescuePrincessSceneProps> = ({
  zones,
  activeZoneId,
  finalGateOpened,
  princessRescued,
  onSelectZone,
  onSelectFinalGate,
}) => {
  const keysCount = zones.filter((z) => z.keyAwarded).length;
  const gateUnlocked = keysCount === zones.length;

  return (
    <div className="w-full rounded-2xl border border-amber-400/35 bg-gradient-to-b from-[#081530] via-[#0d2147] to-[#071329] p-3.5 space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-200">
          <Crown className="w-4 h-4 text-amber-300" />
          <span>Lâu đài Giải cứu Công chúa (Bản 2D giữ đủ chức năng)</span>
        </div>
        <span className="text-xs font-bold text-cyan-200 tabular-nums">
          Chìa khóa: {keysCount}/3 · Cửa cuối: {finalGateOpened ? 'Đã mở' : gateUnlocked ? 'Sẵn sàng mở' : 'Đang khóa'}
        </span>
      </div>

      {/* SVG Bridge + Zones + Final Gate + Companion Princess */}
      <div className="relative w-full rounded-xl bg-[#071936] border border-cyan-500/30 p-4 space-y-4">
        {/* Final Royal Keep + Companion Princess */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/90 border border-amber-400/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl border flex items-center justify-center ${
                finalGateOpened
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : gateUnlocked
                    ? 'bg-amber-400 text-slate-950 border-amber-200'
                    : 'bg-slate-800 border-slate-600 text-slate-400'
              }`}
            >
              {gateUnlocked || finalGateOpened ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-black text-white">
                Cửa Cuối Hoàng Gia (Câu tổng hợp 30 điểm)
              </div>
              <div className="text-[11px] text-slate-300">
                {finalGateOpened
                  ? 'Đã hoàn thành Cửa Cuối — Công chúa đã xuất hiện đồng hành!'
                  : gateUnlocked
                    ? 'Đã đủ 3/3 Chìa Khóa — Nhấn mở cửa giải cứu Công chúa!'
                    : `Cần thu thập đủ 3 Chìa Khóa từ 3 khu (hiện có ${keysCount}/3).`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {princessRescued && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/20 border border-sky-300 text-sky-100 text-xs font-black">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Công chúa Bạn Đồng Hành</span>
              </div>
            )}
            <button
              type="button"
              onClick={onSelectFinalGate}
              className={`px-4 py-2 rounded-xl border text-xs font-black cursor-pointer transition-colors ${
                finalGateOpened
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                  : gateUnlocked
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200'
                    : 'bg-slate-800 hover:bg-slate-700 text-amber-200 border-amber-500/50'
              }`}
            >
              {finalGateOpened ? 'Xem lại Cửa cuối' : gateUnlocked ? 'Mở Cửa Cuối (30đ)' : 'Thử mở Cửa cuối'}
            </button>
          </div>
        </div>

        {/* 3 Castle Zones Connected Across Stepping Bridge */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {zones.map((z) => {
            const doneCount = z.challenges.filter(
              (c) => c.status !== 'unattempted' && c.status !== 'submitted'
            ).length;
            const isActive = activeZoneId === z.zoneId;
            return (
              <button
                key={z.zoneId}
                type="button"
                onClick={() => onSelectZone(z.zoneId)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                  z.keyAwarded
                    ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-100'
                    : z.status === 'in_progress'
                      ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-100'
                      : 'bg-slate-900/95 border-slate-700 text-slate-100 hover:border-amber-400'
                } ${isActive ? 'ring-2 ring-amber-300' : ''}`}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-black">
                  <span className="truncate">{z.title}</span>
                  <span className="tabular-nums shrink-0">{doneCount}/3</span>
                </div>
                <div className="text-[11px] opacity-85 mt-0.5 truncate">{z.subtitle}</div>
                <div className="flex items-center justify-between gap-1 mt-2 text-[10px] font-extrabold">
                  <span>{ZONE_STATUS_LABELS[z.status]}</span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <KeyRound className="w-3 h-3" />
                    <span>{z.keyAwarded ? 'Đã có chìa' : 'Chưa có chìa'}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const RescuePrincess3DScene: React.FC<RescuePrincessSceneProps> = (props) => {
  const {
    zones,
    finalGateOpened,
    princessRescued,
    quality,
    onSelectZone,
    onSelectFinalGate,
    onWebGLFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const liveRef = useRef<RescuePrincessSceneProps>(props);
  liveRef.current = props;

  useEffect(() => {
    if (quality === '2d' || webglLost) return;
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglLost(true);
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      setWebglLost(true);
      onWebGLFallback?.();
      return;
    }

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth || 720, container.clientHeight || 280);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061226);
    scene.fog = new THREE.FogExp2(0x061226, 0.02);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 280;
    const camera = new THREE.PerspectiveCamera(40, width / Math.max(1, height), 0.1, 80);
    camera.position.set(0, 6.2, 10.8);
    camera.lookAt(0, 0.8, -0.6);

    // Three-point warm/cool studio lighting
    scene.add(new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 0.78));
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.6);
    keyLight.position.set(6, 12, 8);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.92);
    rimLight.position.set(-7, 5, -6);
    scene.add(rimLight);

    // Crystal Moat & Stone Courtyard Terrace
    const moat = new THREE.Mesh(
      new THREE.CylinderGeometry(8.6, 8.9, 0.25, 48),
      new THREE.MeshStandardMaterial({ color: 0x0b3158, roughness: 0.22, metalness: 0.35 })
    );
    moat.position.y = -0.22;
    scene.add(moat);

    const courtyard = new THREE.Mesh(
      new THREE.BoxGeometry(11.6, 0.24, 7.6),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.1 })
    );
    courtyard.position.set(0, -0.02, 0.1);
    scene.add(courtyard);

    // Stepping stone path + Arched Bridge leading to Final Gate
    const bridgeMats: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2,
        roughness: 0.65,
      });
      const step = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 0.56), mat);
      step.position.set(0, 0.14 + Math.sin((i / 5) * Math.PI) * 0.18, 3.0 - i * 0.78);
      scene.add(step);
      bridgeMats.push(mat);
    }

    const clickableObjects: THREE.Object3D[] = [];

    // 3 Zone Castle Wings + Key Crystals
    const zoneVisuals = new Map<
      C07ZoneId,
      {
        ringMat: THREE.MeshStandardMaterial;
        keyMesh: THREE.Group;
      }
    >();

    props.zones.forEach((z) => {
      const [wx, wz] = ZONE_WORLD_POS[z.zoneId];
      const zGroup = new THREE.Group();
      zGroup.position.set(wx, 0.1, wz);
      scene.add(zGroup);

      const accentHex = parseInt(z.accentHex.replace('#', ''), 16) || 0xf59e0b;
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x0f172a,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.08, 10, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      zGroup.add(ring);

      const wing = buildZoneCastleWing(accentHex, z.orderIndex);
      wing.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.userData = { targetType: 'zone', zoneId: z.zoneId };
          clickableObjects.push(obj);
        }
      });
      zGroup.add(wing);

      // Click proxy
      const hitPad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 0.15, 16),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      );
      hitPad.position.y = 0.1;
      hitPad.userData = { targetType: 'zone', zoneId: z.zoneId };
      zGroup.add(hitPad);
      clickableObjects.push(hitPad);

      // Floating Golden Key over tower
      const keyMesh = new THREE.Group();
      const keyMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xd97706,
        emissiveIntensity: 0.65,
        metalness: 0.9,
        roughness: 0.18,
      });
      const keyBow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 16), keyMat);
      keyBow.position.y = 0.24;
      const keyBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.05), keyMat);
      keyBlade.position.y = 0.02;
      keyMesh.add(keyBow, keyBlade);
      keyMesh.position.set(0, 3.35, 0);
      zGroup.add(keyMesh);

      zoneVisuals.set(z.zoneId, { ringMat, keyMesh });
    });

    // Grand Royal Final Keep & Dual Hinged Gates (z = -2.2)
    const keepGroup = new THREE.Group();
    keepGroup.position.set(0, 0.1, -2.15);
    scene.add(keepGroup);

    const keepStone = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.78 });
    const keepGold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.88, roughness: 0.2 });

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 1.1), keepStone);
    leftWall.position.set(-1.35, 1.15, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.3, 1.1), keepStone);
    rightWall.position.set(1.35, 1.15, 0);
    const crownArch = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.7, 1.2), keepStone);
    crownArch.position.set(0, 2.65, 0);
    const spireRoof = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.5, 8), keepGold);
    spireRoof.position.set(0, 3.7, -0.1);
    keepGroup.add(leftWall, rightWall, crownArch, spireRoof);

    // Dual hinged doors
    const leftDoorPivot = new THREE.Group();
    leftDoorPivot.position.set(-0.78, 1.0, 0.45);
    const rightDoorPivot = new THREE.Group();
    rightDoorPivot.position.set(0.78, 1.0, 0.45);
    keepGroup.add(leftDoorPivot, rightDoorPivot);

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.9, 0.14), doorMat);
    leftDoor.position.x = 0.38;
    leftDoor.userData = { targetType: 'final_gate' };
    const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.9, 0.14), doorMat);
    rightDoor.position.x = -0.38;
    rightDoor.userData = { targetType: 'final_gate' };
    leftDoorPivot.add(leftDoor);
    rightDoorPivot.add(rightDoor);
    clickableObjects.push(leftDoor, rightDoor, crownArch);

    // 3-Key Progress Pillar beside the gate
    const pillarBase = new THREE.Mesh(new THREE.BoxGeometry(0.65, 2.1, 0.45), keepStone);
    pillarBase.position.set(-2.35, 1.05, 0.55);
    keepGroup.add(pillarBase);
    const keyOrbMats: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2,
        roughness: 0.22,
      });
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), m);
      orb.position.set(-2.35, 0.55 + i * 0.55, 0.85);
      keepGroup.add(orb);
      keyOrbMats.push(m);
    }

    // Companion Princess (appears cleanly after Final Gate completion)
    const { root: princessRoot, rightArmPivot } = buildPrincessCompanionModel();
    princessRoot.position.set(0, 0.12, -1.05);
    princessRoot.visible = false;
    scene.add(princessRoot);

    // Raycast click handler
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerClick = (ev: MouseEvent) => {
      if (!renderer) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableObjects, false);
      if (hits.length === 0) return;
      const data = hits[0].object.userData;
      if (data?.targetType === 'zone' && data.zoneId) {
        liveRef.current.onSelectZone(data.zoneId);
      } else if (data?.targetType === 'final_gate') {
        liveRef.current.onSelectFinalGate();
      }
    };
    renderer.domElement.addEventListener('click', handlePointerClick);

    const resizeObs = new ResizeObserver((entries) => {
      if (!renderer || entries.length === 0) return;
      const rect = entries[0].contentRect;
      if (rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    });
    resizeObs.observe(container);

    let frameId = 0;
    let lastTs = performance.now();
    let elapsed = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      if (disposed || !renderer) return;
      const gl2 = renderer.getContext() as WebGL2RenderingContext;
      if (typeof gl2.fenceSync === 'function') {
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl2.flush();
        const poll = () => {
          if (disposed) {
            gl2.deleteSync(sync);
            return;
          }
          const st = sync && gl2.getSyncParameter(sync, gl2.SYNC_STATUS);
          if (st === gl2.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl2.deleteSync(sync);
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
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const cur = liveRef.current;
      const motionScale = cur.reducedMotion ? 0 : 1;
      elapsed += dt * motionScale;

      let keysEarned = 0;
      cur.zones.forEach((z, idx) => {
        if (z.keyAwarded) keysEarned += 1;
        const vis = zoneVisuals.get(z.zoneId);
        if (vis) {
          const isActive = cur.activeZoneId === z.zoneId;
          if (z.keyAwarded) {
            vis.ringMat.color.setHex(0x10b981);
            vis.ringMat.emissive.setHex(0x059669);
            vis.ringMat.emissiveIntensity = 0.75;
            vis.keyMesh.visible = false;
          } else if (z.status === 'in_progress' || isActive) {
            vis.ringMat.color.setHex(0x22d3ee);
            vis.ringMat.emissive.setHex(0x0891b2);
            vis.ringMat.emissiveIntensity = 0.85;
            vis.keyMesh.visible = true;
            vis.keyMesh.position.y = 3.35 + Math.sin(elapsed * 2.4 + idx) * 0.12;
            vis.keyMesh.rotation.y += dt * 1.4 * motionScale;
          } else {
            vis.ringMat.color.setHex(0x64748b);
            vis.ringMat.emissive.setHex(0x1e293b);
            vis.ringMat.emissiveIntensity = 0.3;
            vis.keyMesh.visible = true;
            vis.keyMesh.position.y = 3.35 + Math.sin(elapsed * 1.6 + idx) * 0.08;
            vis.keyMesh.rotation.y += dt * 0.8 * motionScale;
          }
        }

        const orbMat = keyOrbMats[idx];
        if (orbMat) {
          if (z.keyAwarded) {
            orbMat.color.setHex(0xfbbf24);
            orbMat.emissive.setHex(0xf59e0b);
            orbMat.emissiveIntensity = 1.05;
          } else {
            orbMat.color.setHex(0x1e293b);
            orbMat.emissive.setHex(0x0f172a);
            orbMat.emissiveIntensity = 0.15;
          }
        }
      });

      // Bridge stones illuminate progressively (2 per key)
      bridgeMats.forEach((mat, idx) => {
        const lit = idx < keysEarned * 2 || cur.finalGateOpened;
        mat.color.setHex(lit ? 0xfbbf24 : 0x475569);
        mat.emissive.setHex(lit ? 0xd97706 : 0x0f172a);
        mat.emissiveIntensity = lit ? 0.55 : 0.15;
      });

      // Animate hinged royal gates smoothly
      const targetAngle = cur.finalGateOpened ? 1.15 : 0;
      const dampFactor = cur.reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5);
      leftDoorPivot.rotation.y = THREE.MathUtils.lerp(leftDoorPivot.rotation.y, -targetAngle, dampFactor);
      rightDoorPivot.rotation.y = THREE.MathUtils.lerp(rightDoorPivot.rotation.y, targetAngle, dampFactor);

      // Companion Princess appears & waves gently after Final Gate completion
      princessRoot.visible = cur.princessRescued;
      if (cur.princessRescued) {
        princessRoot.position.y = 0.14 + Math.sin(elapsed * 2.2) * 0.04;
        rightArmPivot.rotation.z = Math.sin(elapsed * 3.4) * 0.22;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObs.disconnect();
      renderer?.domElement.removeEventListener('click', handlePointerClick);
      renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
      envTarget.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material?.dispose();
          }
        }
      });
      renderer?.dispose();
    };
  }, [quality, webglLost, onWebGLFallback]);

  const keysEarned = zones.filter((z) => z.keyAwarded).length;
  const gateUnlocked = keysEarned === zones.length;

  return (
    <div className="space-y-3">
      {quality === '2d' || webglLost ? (
        <div className="space-y-2">
          {webglLost && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-100">
              WebGL 3D tạm gián đoạn — đã tự động chuyển sang Sân khấu Lâu đài 2D đầy đủ chức năng mà không mất tiến độ.
            </div>
          )}
          <RescuePrincess2DStage {...props} />
        </div>
      ) : (
        <div className="relative w-full h-[240px] sm:h-[280px] rounded-2xl overflow-hidden border border-amber-400/35 bg-[#061226] shadow-lg">
          <div ref={containerRef} className="w-full h-full cursor-pointer" />

          {/* Clean Top-Left HUD Badge (NO backdrop-blur over WebGL) */}
          <div className="pointer-events-none absolute top-2.5 left-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/92 border border-amber-400/45 text-xs font-extrabold text-amber-200">
              <Crown className="w-3.5 h-3.5 text-amber-300" />
              <span>Lâu đài Giải cứu Công chúa 3D</span>
            </span>
          </div>

          {/* Top-Right Gate & Companion Status */}
          <div className="pointer-events-none absolute top-2.5 right-3 flex flex-wrap gap-1.5 justify-end">
            {princessRescued && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-950/95 border border-sky-300 text-xs font-extrabold text-sky-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Công chúa đã đồng hành</span>
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold ${
                finalGateOpened
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                  : gateUnlocked
                    ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                    : 'bg-slate-950/92 border-slate-600 text-slate-200'
              }`}
            >
              {gateUnlocked || finalGateOpened ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>
                {finalGateOpened
                  ? 'Cửa cuối đã mở'
                  : gateUnlocked
                    ? 'Đủ 3/3 Chìa — Mở Cửa cuối!'
                    : `Cửa cuối khóa · Thiếu ${3 - keysEarned} chìa`}
              </span>
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 text-[11px] font-bold text-slate-200">
            <span className="px-2.5 py-1 rounded bg-slate-950/90 border border-slate-700 inline-block max-w-full truncate">
              Nhấn trực tiếp vào 3 tòa tháp trên sân khấu 3D hoặc bảng cửa bên dưới để vào khu giải cứu
            </span>
          </div>
        </div>
      )}

      {/* 3 Zone Doors + Progress Column ("Cột tiến độ hiện chìa khóa từng khu") */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        <div className="lg:col-span-8 rounded-xl bg-[#091836] border border-cyan-500/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-cyan-200">
            <span>Chọn 1 trong 3 khu lâu đài (mỗi khu 3 thử thách · +10đ/câu):</span>
            <button
              type="button"
              onClick={onSelectFinalGate}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black cursor-pointer transition-colors ${
                finalGateOpened
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
                  : gateUnlocked
                    ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 border-amber-500/45 text-amber-200'
              }`}
            >
              {gateUnlocked || finalGateOpened ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Cửa cuối hoàng gia (30đ)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {zones.map((z) => {
              const doneQs = z.challenges.filter(
                (c) => c.status !== 'unattempted' && c.status !== 'submitted'
              ).length;
              return (
                <button
                  key={z.zoneId}
                  type="button"
                  onClick={() => onSelectZone(z.zoneId)}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    z.keyAwarded
                      ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-100'
                      : z.status === 'in_progress'
                        ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-100'
                        : 'bg-slate-900/90 border-slate-700 text-slate-100 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-black">
                    <span className="truncate">{z.title}</span>
                    <span className="text-[10px] font-bold tabular-nums shrink-0">{doneQs}/3</span>
                  </div>
                  <div className="text-[11px] opacity-85 truncate mt-0.5">{z.subtitle}</div>
                  <div className="text-[10px] font-extrabold mt-1">
                    {ZONE_STATUS_LABELS[z.status]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress Column with Individual Zone Keys */}
        <div className="lg:col-span-4 rounded-xl bg-[#091836] border border-amber-400/35 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Cột tiến độ chìa khóa</span>
            </span>
            <span className="tabular-nums">{keysEarned}/3 chìa</span>
          </div>
          <div className="space-y-1.5">
            {zones.map((z) => (
              <div
                key={z.zoneId}
                className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] font-bold ${
                  z.keyAwarded
                    ? 'bg-amber-400/20 border-amber-300 text-amber-100'
                    : 'bg-slate-950/80 border-slate-700 text-slate-400'
                }`}
              >
                <span className="truncate">{z.keyName}</span>
                <span className="inline-flex items-center gap-1 shrink-0">
                  <KeyRound className="w-3 h-3" />
                  <span>{z.keyAwarded ? 'Đã mở' : 'Chưa có'}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescuePrincess3DScene;
