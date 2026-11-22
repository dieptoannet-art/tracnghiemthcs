import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Compass, Lock, MapPin, Sparkles, Unlock } from 'lucide-react';
import {
  C06GraphicsQuality,
  C06Phase,
  C06StationId,
  C06StationState,
  C06StationStatus,
} from './treasureHunt3dEngine';

export interface TreasureHuntSceneProps {
  stations: C06StationState[];
  visitedOrder: C06StationId[];
  activeStationId: C06StationId | null;
  phase: C06Phase;
  chestOpened: boolean;
  quality: C06GraphicsQuality;
  reducedMotion: boolean;
  onSelectStation: (stationId: C06StationId) => void;
  onSelectChest: () => void;
  onWebGLFallback?: () => void;
}

// 6 fixed landmark coordinates arranged in an expedition arc around central chest (0, 0, 0)
const STATION_WORLD_POS: Record<C06StationId, [number, number]> = {
  station_arithmetic: [-4.4, 1.9],
  station_powers: [-3.9, -2.1],
  station_algebra: [0.0, -3.5],
  station_geometry: [3.9, -2.1],
  station_ratio: [4.4, 1.9],
  station_functions: [0.0, 3.3],
};

const STATION_2D_POS: Record<C06StationId, { x: number; y: number }> = {
  station_arithmetic: { x: 16, y: 66 },
  station_powers: { x: 20, y: 24 },
  station_algebra: { x: 50, y: 14 },
  station_geometry: { x: 80, y: 24 },
  station_ratio: { x: 84, y: 66 },
  station_functions: { x: 50, y: 84 },
};

const STATUS_TEXT: Record<C06StationStatus, string> = {
  unexplored: 'Chưa khám phá',
  in_progress: 'Đang làm',
  shard_collected: 'Đã lấy mảnh',
};

function buildLandmarkModel(
  type: C06StationState['landmarkType'],
  accentHex: number
): THREE.Group {
  const g = new THREE.Group();

  if (type === 'temple') {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.34, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 })
    );
    base.position.y = 0.17;
    const mid = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.32, 0.92),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.62 })
    );
    mid.position.y = 0.5;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.28, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5 })
    );
    top.position.y = 0.8;
    const doorGlow = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.3, 0.96),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.8 })
    );
    doorGlow.position.y = 0.3;
    g.add(base, mid, top, doorGlow);
  } else if (type === 'crystal_cave') {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.72, 0),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 })
    );
    rock.scale.set(1.15, 0.85, 1.0);
    rock.position.set(0, 0.48, -0.1);
    const cMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.18,
      metalness: 0.25,
    });
    const spire1 = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.85, 6), cMat);
    spire1.position.set(-0.22, 0.62, 0.28);
    spire1.rotation.z = 0.2;
    const spire2 = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.7, 6), cMat);
    spire2.position.set(0.24, 0.52, 0.25);
    spire2.rotation.z = -0.22;
    g.add(rock, spire1, spire2);
  } else if (type === 'observatory') {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.58, 0.72, 16),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65 })
    );
    drum.position.y = 0.36;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.55, roughness: 0.32 })
    );
    dome.position.y = 0.72;
    const scope = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, 0.65, 12),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.25 })
    );
    scope.position.set(0.22, 0.96, 0.22);
    scope.rotation.set(0.7, 0, -0.45);
    g.add(drum, dome, scope);
  } else if (type === 'elder_tree') {
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, 0.2, 14),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85 })
    );
    plinth.position.y = 0.1;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, 0.68, 10),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    trunk.position.y = 0.45;
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.65 });
    const canopy1 = new THREE.Mesh(new THREE.SphereGeometry(0.54, 14, 10), canopyMat);
    canopy1.position.set(0, 0.96, 0);
    const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), canopyMat);
    canopy2.position.set(-0.34, 0.82, 0.12);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xa7f3d0, emissive: 0x10b981, emissiveIntensity: 0.9 })
    );
    orb.position.set(0.32, 0.84, 0.24);
    g.add(plinth, trunk, canopy1, canopy2, orb);
  } else if (type === 'lighthouse') {
    const dock = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.18, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.82 })
    );
    dock.position.y = 0.09;
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, 0.92, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 })
    );
    tower.position.y = 0.62;
    const lantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.24, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.95 })
    );
    lantern.position.y = 1.15;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.3, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    roof.position.y = 1.4;
    g.add(dock, tower, lantern, roof);
  } else {
    // volcano
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 0.96, 12, 1, false),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 })
    );
    cone.position.y = 0.48;
    const crater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.18, 12),
      new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xef4444, emissiveIntensity: 0.95 })
    );
    crater.position.y = 0.92;
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color: accentHex, emissive: accentHex, emissiveIntensity: 0.6 })
    );
    crystal.position.set(0.42, 0.32, 0.35);
    g.add(cone, crater, crystal);
  }

  return g;
}

export const TreasureHunt2DMap: React.FC<TreasureHuntSceneProps> = ({
  stations,
  visitedOrder,
  activeStationId,
  chestOpened,
  onSelectStation,
  onSelectChest,
}) => {
  const collectedCount = stations.filter((s) => s.shardCollected).length;
  const chestUnlocked = collectedCount === stations.length;

  return (
    <div className="w-full rounded-2xl border border-amber-400/35 bg-gradient-to-br from-[#07152e] via-[#0c2142] to-[#081329] p-3 sm:p-4 space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
          <Compass className="w-4 h-4 text-amber-300" />
          <span>Bản đồ Đảo Kho Báu (2D Nhẹ) · Chọn tự do 6 địa điểm</span>
        </div>
        <span className="text-xs font-bold text-cyan-200">
          Đã ghép {collectedCount}/{stations.length} mảnh · Quỹ đạo: {visitedOrder.length} trạm
        </span>
      </div>

      {/* Interactive SVG Map + Clickable Station Nodes */}
      <div className="relative w-full h-[250px] sm:h-[280px] rounded-xl bg-[#071936] border border-cyan-500/25 overflow-hidden">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {/* Island parchment silhouette */}
          <ellipse cx="50" cy="50" rx="43" ry="42" fill="#1b2c4c" stroke="#d97706" strokeOpacity="0.45" strokeWidth="0.8" />
          <ellipse cx="50" cy="50" rx="34" ry="33" fill="#112240" stroke="#38bdf8" strokeOpacity="0.22" strokeWidth="0.5" />

          {/* Traversed route lines */}
          {visitedOrder.map((stId, idx) => {
            if (idx === 0) return null;
            const prev = STATION_2D_POS[visitedOrder[idx - 1]];
            const cur = STATION_2D_POS[stId];
            return (
              <line
                key={`${visitedOrder[idx - 1]}_${stId}`}
                x1={prev.x}
                y1={prev.y}
                x2={cur.x}
                y2={cur.y}
                stroke="#fbbf24"
                strokeWidth="1.2"
                strokeDasharray="2 1.5"
              />
            );
          })}
          {chestUnlocked && visitedOrder.length > 0 && (
            <line
              x1={STATION_2D_POS[visitedOrder[visitedOrder.length - 1]].x}
              y1={STATION_2D_POS[visitedOrder[visitedOrder.length - 1]].y}
              x2="50"
              y2="50"
              stroke="#34d399"
              strokeWidth="1.4"
            />
          )}
        </svg>

        {/* Central Treasure Chest Button */}
        <button
          type="button"
          onClick={onSelectChest}
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          className={`absolute z-10 px-3 py-2 rounded-xl border text-center shadow-lg cursor-pointer transition-transform hover:scale-105 ${
            chestOpened
              ? 'bg-emerald-500/30 border-emerald-300 text-emerald-100'
              : chestUnlocked
                ? 'bg-amber-400 text-slate-950 border-amber-200 font-black'
                : 'bg-slate-900/95 border-amber-500/50 text-amber-200'
          }`}
        >
          <div className="flex items-center justify-center gap-1 text-xs font-black">
            {chestUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Rương 30đ</span>
          </div>
          <div className="text-[10px] font-bold opacity-90">
            {chestOpened ? 'Đã mở' : chestUnlocked ? 'Sẵn sàng mở!' : `Thiếu ${6 - collectedCount} mảnh`}
          </div>
        </button>

        {/* 6 Station Buttons */}
        {stations.map((st) => {
          const pos = STATION_2D_POS[st.stationId];
          const isActive = activeStationId === st.stationId;
          const badgeStyle =
            st.status === 'shard_collected'
              ? 'bg-emerald-500/25 border-emerald-400 text-emerald-100'
              : st.status === 'in_progress'
                ? 'bg-cyan-500/25 border-cyan-300 text-cyan-100'
                : 'bg-slate-900/95 border-slate-500 text-slate-200 hover:border-amber-400';

          return (
            <button
              key={st.stationId}
              type="button"
              onClick={() => onSelectStation(st.stationId)}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
              className={`absolute z-10 px-2.5 py-1.5 rounded-xl border text-left shadow-md cursor-pointer transition-transform hover:scale-105 ${badgeStyle} ${
                isActive ? 'ring-2 ring-amber-300' : ''
              }`}
            >
              <div className="flex items-center gap-1 text-[11px] font-black whitespace-nowrap">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>{st.title}</span>
              </div>
              <div className="text-[9px] font-bold opacity-90 whitespace-nowrap">
                {STATUS_TEXT[st.status]}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const TreasureHunt3DScene: React.FC<TreasureHuntSceneProps> = (props) => {
  const {
    stations,
    visitedOrder,
    chestOpened,
    quality,
    onSelectStation,
    onSelectChest,
    onWebGLFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const liveRef = useRef<TreasureHuntSceneProps>(props);
  liveRef.current = props;

  useEffect(() => {
    if (quality === '2d' || webglLost) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
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

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const gpuStr = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    const isSoftwareGl = /swiftshader|llvmpipe|software|mesa/i.test(gpuStr);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.5));
    renderer.setSize(container.clientWidth || 720, container.clientHeight || 300);
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
    scene.background = new THREE.Color(0x061124);
    scene.fog = new THREE.FogExp2(0x061124, 0.022);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 300;
    const camera = new THREE.PerspectiveCamera(42, width / Math.max(1, height), 0.1, 80);
    camera.position.set(0, 7.8, 10.6);
    camera.lookAt(0, 0.4, 0);

    // 3-point warm/cool lighting
    scene.add(new THREE.HemisphereLight(0xbae6fd, 0x0f172a, 0.72));
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(6, 11, 7);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
    rimLight.position.set(-7, 5, -5);
    scene.add(rimLight);

    // Sea Disc & Parchment Island Deck
    const seaDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(8.5, 8.9, 0.25, 48),
      new THREE.MeshStandardMaterial({ color: 0x0b2a4f, roughness: 0.35, metalness: 0.25 })
    );
    seaDisc.position.y = -0.22;
    scene.add(seaDisc);

    const parchmentSlab = new THREE.Mesh(
      new THREE.BoxGeometry(11.8, 0.24, 9.2),
      new THREE.MeshStandardMaterial({ color: 0xc29b61, roughness: 0.86, metalness: 0.05 })
    );
    parchmentSlab.position.y = -0.06;
    scene.add(parchmentSlab);

    const islandTerrain = new THREE.Mesh(
      new THREE.CylinderGeometry(5.55, 5.8, 0.24, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.72, metalness: 0.1 })
    );
    islandTerrain.position.y = 0.08;
    scene.add(islandTerrain);

    // Central Treasure Chest + Brass Compass Plinth
    const clickableObjects: THREE.Object3D[] = [];
    const chestGroup = new THREE.Group();
    chestGroup.position.set(0, 0.2, 0);
    scene.add(chestGroup);

    const chestPlinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.38, 0.16, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.35 })
    );
    chestPlinth.position.y = 0.08;
    chestGroup.add(chestPlinth);

    const chestBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.62, 0.82),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.68, metalness: 0.15 })
    );
    chestBody.position.y = 0.47;
    chestBody.userData = { targetType: 'chest' };
    chestGroup.add(chestBody);
    clickableObjects.push(chestBody);

    const goldBandMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.88,
      roughness: 0.2,
    });
    const frontLock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.08), goldBandMat);
    frontLock.position.set(0, 0.58, 0.43);
    chestGroup.add(frontLock);

    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.78, -0.4);
    chestGroup.add(lidPivot);
    const chestLid = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 0.24, 0.84),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.6 })
    );
    chestLid.position.set(0, 0.1, 0.4);
    chestLid.userData = { targetType: 'chest' };
    lidPivot.add(chestLid);
    clickableObjects.push(chestLid);

    const chestGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.2,
      roughness: 0.2,
    });
    const chestCore = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.2, 0.58), chestGlowMat);
    chestCore.position.y = 0.72;
    chestGroup.add(chestCore);

    // 6-Socket Plinth Crystals around Chest showing collected shards
    const socketCrystals: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        emissive: 0x0f172a,
        emissiveIntensity: 0.2,
        roughness: 0.25,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), mat);
      gem.position.set(Math.cos(ang) * 1.05, 0.26, Math.sin(ang) * 1.05);
      chestGroup.add(gem);
      socketCrystals.push(mat);
    }

    // Brass Compass beside chest
    const compassGroup = new THREE.Group();
    compassGroup.position.set(1.85, 0.24, 0.9);
    scene.add(compassGroup);
    const compassCase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.48, 0.12, 24),
      goldBandMat
    );
    const compassNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.54),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.4 })
    );
    compassNeedle.position.y = 0.08;
    compassGroup.add(compassCase, compassNeedle);

    // 6 Landmarks + Status Rings + Hovering Shard Prisms
    const stationVisuals = new Map<
      C06StationId,
      {
        ringMat: THREE.MeshStandardMaterial;
        shardMesh: THREE.Mesh;
        landmarkGroup: THREE.Group;
      }
    >();

    props.stations.forEach((st) => {
      const [wx, wz] = STATION_WORLD_POS[st.stationId];
      const stGroup = new THREE.Group();
      stGroup.position.set(wx, 0.2, wz);
      scene.add(stGroup);

      const accentHex = parseInt(st.accentHex.replace('#', ''), 16) || 0x38bdf8;
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        emissive: 0x0f172a,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.07, 10, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.04;
      stGroup.add(ring);

      const landmark = buildLandmarkModel(st.landmarkType, accentHex);
      landmark.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          obj.userData = { targetType: 'station', stationId: st.stationId };
          clickableObjects.push(obj);
        }
      });
      stGroup.add(landmark);

      // Click hit pad
      const hitPad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.12, 16),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      );
      hitPad.position.y = 0.1;
      hitPad.userData = { targetType: 'station', stationId: st.stationId };
      stGroup.add(hitPad);
      clickableObjects.push(hitPad);

      const shardMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0ea5e9,
          emissiveIntensity: 0.75,
          roughness: 0.18,
          metalness: 0.35,
        })
      );
      shardMesh.position.set(0, 1.85, 0);
      stGroup.add(shardMesh);

      stationVisuals.set(st.stationId, { ringMat, shardMesh, landmarkGroup: landmark });
    });

    // Dynamic Traversed Trail Group (updated cleanly when visitedOrder changes)
    const trailGroup = new THREE.Group();
    scene.add(trailGroup);
    const trailMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
    let lastTrailSignature = '';

    const rebuildTrail = (order: C06StationId[], allShardsDone: boolean) => {
      const sig = `${order.join(',')}#${allShardsDone ? 1 : 0}`;
      if (sig === lastTrailSignature) return;
      lastTrailSignature = sig;
      while (trailGroup.children.length > 0) {
        const child = trailGroup.children.pop() as THREE.Mesh;
        child.geometry?.dispose();
      }
      const addSegment = (p1: [number, number], p2: [number, number]) => {
        const dx = p2[0] - p1[0];
        const dz = p2[1] - p1[1];
        const len = Math.hypot(dx, dz);
        if (len < 0.1) return;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, len), trailMat);
        bar.position.set((p1[0] + p2[0]) / 2, 0.23, (p1[1] + p2[1]) / 2);
        bar.rotation.y = Math.atan2(dx, dz);
        trailGroup.add(bar);
      };
      for (let i = 1; i < order.length; i++) {
        addSegment(STATION_WORLD_POS[order[i - 1]], STATION_WORLD_POS[order[i]]);
      }
      if (allShardsDone && order.length > 0) {
        addSegment(STATION_WORLD_POS[order[order.length - 1]], [0, 0]);
      }
    };

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
      if (data?.targetType === 'station' && data.stationId) {
        liveRef.current.onSelectStation(data.stationId);
      } else if (data?.targetType === 'chest') {
        liveRef.current.onSelectChest();
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

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;
    let disposed = false;

    const animate = (now: number) => {
      if (disposed || !renderer) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const cur = liveRef.current;
      const motionScale = cur.reducedMotion ? 0 : 1;
      elapsed += dt * motionScale;

      let collected = 0;
      cur.stations.forEach((st, idx) => {
        if (st.shardCollected) collected += 1;
        const vis = stationVisuals.get(st.stationId);
        if (!vis) return;
        const isActive = cur.activeStationId === st.stationId;
        if (st.status === 'shard_collected') {
          vis.ringMat.color.setHex(0x10b981);
          vis.ringMat.emissive.setHex(0x059669);
          vis.ringMat.emissiveIntensity = 0.7;
          vis.shardMesh.visible = false;
        } else if (st.status === 'in_progress' || isActive) {
          vis.ringMat.color.setHex(0x22d3ee);
          vis.ringMat.emissive.setHex(0x0891b2);
          vis.ringMat.emissiveIntensity = 0.8;
          vis.shardMesh.visible = true;
          vis.shardMesh.position.y = 1.85 + Math.sin(elapsed * 2.5 + idx) * 0.1;
          vis.shardMesh.rotation.y += dt * 1.4 * motionScale;
        } else {
          vis.ringMat.color.setHex(0x64748b);
          vis.ringMat.emissive.setHex(0x1e293b);
          vis.ringMat.emissiveIntensity = 0.3;
          vis.shardMesh.visible = true;
          vis.shardMesh.position.y = 1.82 + Math.sin(elapsed * 1.8 + idx) * 0.08;
          vis.shardMesh.rotation.y += dt * 0.8 * motionScale;
        }
        const socketMat = socketCrystals[idx];
        if (socketMat) {
          if (st.shardCollected) {
            socketMat.color.setHex(0x38bdf8);
            socketMat.emissive.setHex(0x0284c7);
            socketMat.emissiveIntensity = 0.9;
          } else {
            socketMat.color.setHex(0x334155);
            socketMat.emissive.setHex(0x0f172a);
            socketMat.emissiveIntensity = 0.15;
          }
        }
      });

      const allShardsDone = collected === cur.stations.length;
      rebuildTrail(cur.visitedOrder, allShardsDone);

      // Animate Chest Lid & Golden Glow when unlocked or opened
      const targetLidAngle = cur.chestOpened ? -0.95 : allShardsDone ? -0.42 : 0;
      lidPivot.rotation.x = THREE.MathUtils.lerp(
        lidPivot.rotation.x,
        targetLidAngle,
        cur.reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5)
      );
      chestGlowMat.emissiveIntensity = cur.chestOpened ? 1.25 : allShardsDone ? 0.85 : 0.2;
      compassNeedle.rotation.y = Math.sin(elapsed * 0.9) * 0.35;

      renderer.render(scene, camera);

      if (isSoftwareGl && typeof (gl as WebGL2RenderingContext).fenceSync === 'function') {
        const gl2 = gl as WebGL2RenderingContext;
        const sync = gl2.fenceSync(gl2.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl2.flush();
          gl2.deleteSync(sync);
        }
      }

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      renderer?.domElement.removeEventListener('click', handlePointerClick);
      renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
      envTarget.dispose();
      trailMat.dispose();
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

  const collectedCount = stations.filter((s) => s.shardCollected).length;
  const chestUnlocked = collectedCount === stations.length;

  return (
    <div className="space-y-2.5">
      {/* 3D Canvas OR 2D Map Stage */}
      {quality === '2d' || webglLost ? (
        <div className="space-y-1.5">
          {webglLost && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-100">
              Trình duyệt tạm ngắt WebGL 3D — tự động chuyển sang Bản đồ kho báu 2D đầy đủ chức năng mà không mất tiến độ.
            </div>
          )}
          <TreasureHunt2DMap {...props} />
        </div>
      ) : (
        <div className="relative w-full h-[230px] sm:h-[265px] rounded-2xl overflow-hidden border border-amber-400/35 bg-[#061124] shadow-lg">
          <div ref={containerRef} className="w-full h-full cursor-pointer" />

          {/* Top-left Map Title Badge (opaque surface, NO backdrop-blur over WebGL) */}
          <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/92 border border-amber-400/45 text-xs font-extrabold text-amber-200">
              <Compass className="w-3.5 h-3.5 text-amber-300" />
              <span>Bản đồ Đảo Kho Báu 3D</span>
            </span>
          </div>

          {/* Top-right Chest Status */}
          <div className="pointer-events-none absolute top-2.5 right-3">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-extrabold ${
                chestOpened
                  ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
                  : chestUnlocked
                    ? 'bg-amber-950/95 border-amber-400 text-amber-200'
                    : 'bg-slate-950/92 border-slate-600 text-slate-200'
              }`}
            >
              {chestUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>
                {chestOpened
                  ? 'Rương đã mở'
                  : chestUnlocked
                    ? 'Đủ 6 mảnh — Sẵn sàng mở Rương!'
                    : `Rương khóa · Thiếu ${6 - collectedCount} mảnh`}
              </span>
            </span>
          </div>

          {/* Bottom Traversed Path Indicator */}
          <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-200">
            <span className="px-2.5 py-1 rounded bg-slate-950/90 border border-slate-700 truncate max-w-full">
              {visitedOrder.length === 0
                ? 'Nhấn vào địa điểm bất kỳ trên đảo hoặc thanh trạm bên dưới để khởi hành'
                : `Quỹ đạo đã đi: ${visitedOrder
                    .map((id) => stations.find((s) => s.stationId === id)?.title || id)
                    .join(' → ')}`}
            </span>
          </div>
        </div>
      )}

      {/* Static 6-Shard Puzzle Board ("Bảng ghép tĩnh") + Quick Station Selector Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5">
        {/* Left: 6 Landmark Station Buttons */}
        <div className="lg:col-span-8 rounded-xl bg-[#091836] border border-cyan-500/30 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-cyan-200">
            <span>Chọn tự do 1 trong 6 địa điểm (mỗi điểm 2 câu · +10đ/câu):</span>
            <button
              type="button"
              onClick={onSelectChest}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-black cursor-pointer transition-colors ${
                chestOpened
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : chestUnlocked
                    ? 'bg-amber-400 hover:bg-amber-300 border-amber-200 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 border-amber-500/45 text-amber-200'
              }`}
            >
              {chestUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>Rương trung tâm (30đ)</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stations.map((st, idx) => {
              const doneQs =
                (st.questions[0].status !== 'unattempted' ? 1 : 0) +
                (st.questions[1].status !== 'unattempted' ? 1 : 0);
              const statusCls =
                st.status === 'shard_collected'
                  ? 'bg-emerald-500/15 border-emerald-400/70 text-emerald-100 hover:bg-emerald-500/25'
                  : st.status === 'in_progress'
                    ? 'bg-cyan-500/15 border-cyan-400/70 text-cyan-100 hover:bg-cyan-500/25'
                    : 'bg-slate-900/90 border-slate-700 text-slate-100 hover:border-amber-400';

              return (
                <button
                  key={st.stationId}
                  type="button"
                  onClick={() => onSelectStation(st.stationId)}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${statusCls}`}
                >
                  <div className="flex items-center justify-between gap-1 text-xs font-black">
                    <span className="truncate">
                      {idx + 1}. {st.title}
                    </span>
                    <span className="text-[10px] font-bold opacity-85 shrink-0">{doneQs}/2</span>
                  </div>
                  <div className="text-[11px] opacity-85 truncate mt-0.5">{st.subtitle}</div>
                  <div className="text-[10px] font-extrabold mt-1">
                    Trạng thái: {STATUS_TEXT[st.status]}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Static 6-Shard Puzzle Board ("Bảng ghép tĩnh") */}
        <div className="lg:col-span-4 rounded-xl bg-[#091836] border border-amber-400/35 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Bảng ghép 6 mảnh tĩnh</span>
            </span>
            <span className="tabular-nums">{collectedCount}/6 mảnh</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {stations.map((st, idx) => (
              <div
                key={st.stationId}
                className={`p-2 rounded-lg border text-center ${
                  st.shardCollected
                    ? 'bg-sky-500/20 border-sky-300 text-sky-100'
                    : 'bg-slate-950/80 border-slate-700/80 text-slate-500'
                }`}
              >
                <div className="text-[11px] font-black">Mảnh {idx + 1}</div>
                <div className="text-[9px] font-bold truncate mt-0.5">
                  {st.shardCollected ? 'Đã ghép' : 'Chưa có'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreasureHunt3DScene;
