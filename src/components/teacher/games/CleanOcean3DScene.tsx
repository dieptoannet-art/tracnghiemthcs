import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Anchor,
  CheckCircle2,
  Compass,
  Fish,
  Lock,
  Sparkles,
  Waves,
} from 'lucide-react';
import {
  C10_ILLUSTRATIVE_CAPTION,
  C10_ZONES,
  OceanDebrisVisual,
  OceanGraphicsQuality,
  OceanMissionSlot,
  OceanPhase,
  OceanZoneId,
  OceanZoneProgress,
} from './cleanOcean3dEngine';

export interface CleanOceanSceneProps {
  zones: OceanZoneProgress[];
  missions: OceanMissionSlot[];
  completedMissionIds: Set<string>;
  selectedZoneId: OceanZoneId;
  activeMissionId: string | null;
  phase: OceanPhase;
  quality: OceanGraphicsQuality;
  reducedMotion: boolean;
  disableCameraTransition: boolean;
  panoramaMode?: boolean;
  compact?: boolean;
  onSelectZone?: (zoneId: OceanZoneId) => void;
  onSelectMission?: (missionId: string) => void;
  onWebGLFallback?: () => void;
}

// World X anchors for each of the 4 zones along the sunlit ocean bay
const ZONE_ANCHORS: Record<OceanZoneId, { x: number; z: number; camPos: [number, number, number]; lookAt: [number, number, number] }> = {
  zone_bay: {
    x: -11.0,
    z: 0.4,
    camPos: [-11.0, 5.4, 12.2],
    lookAt: [-11.0, 1.3, 0],
  },
  zone_seagrass: {
    x: -3.5,
    z: 0.2,
    camPos: [-3.5, 4.9, 12.0],
    lookAt: [-3.5, 1.0, 0],
  },
  zone_reef: {
    x: 4.5,
    z: 0.2,
    camPos: [4.5, 5.1, 12.4],
    lookAt: [4.5, 1.1, 0],
  },
  zone_station: {
    x: 12.2,
    z: 0.0,
    camPos: [12.2, 5.8, 12.8],
    lookAt: [12.2, 1.8, 0],
  },
};

const OVERVIEW_CAM: { pos: [number, number, number]; lookAt: [number, number, number] } = {
  pos: [0.6, 8.8, 23.5],
  lookAt: [0.6, 1.3, 0],
};

function getMissionWorldPos(mission: OceanMissionSlot): THREE.Vector3 {
  const anchor = ZONE_ANCHORS[mission.zoneId];
  if (mission.isFinalChallenge) {
    return new THREE.Vector3(anchor.x, 2.35, anchor.z + 1.6);
  }
  const offsets: [number, number, number][] = [
    [-2.2, mission.zoneId === 'zone_bay' ? 3.5 : 0.62, 1.8],
    [-0.75, mission.zoneId === 'zone_bay' ? 3.35 : 0.65, -1.5],
    [0.85, mission.zoneId === 'zone_bay' ? 3.45 : 0.6, 2.0],
    [2.25, mission.zoneId === 'zone_bay' ? 3.4 : 0.64, -1.2],
    [0.0, mission.zoneId === 'zone_bay' ? 3.55 : 0.68, 0.4],
  ];
  const off = offsets[mission.slotIndex % offsets.length];
  return new THREE.Vector3(anchor.x + off[0], off[1], anchor.z + off[2]);
}

function buildDebrisMesh(visual: OceanDebrisVisual): THREE.Group {
  const g = new THREE.Group();

  if (visual === 'plastic_bottle') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.72, 10),
      new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        roughness: 0.25,
        metalness: 0.1,
        transparent: true,
        opacity: 0.88,
      })
    );
    body.rotation.z = Math.PI * 0.35;
    const labelBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.195, 0.195, 0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    labelBand.rotation.z = Math.PI * 0.35;
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.14, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
    );
    cap.position.set(-0.34, 0.19, 0);
    cap.rotation.z = Math.PI * 0.35;
    g.add(body, labelBand, cap);
  } else if (visual === 'foam_box') {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.42, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.88, metalness: 0.02 })
    );
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.1, 0.52),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 })
    );
    g.add(box, tape);
  } else if (visual === 'scrap_net') {
    const coil = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.28, 0.065, 36, 6, 2, 3),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.1 })
    );
    const tag = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.45 })
    );
    tag.position.set(0.22, 0.15, 0);
    g.add(coil, tag);
  } else if (visual === 'tin_can') {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.48, 12),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.78 })
    );
    can.rotation.x = Math.PI * 0.42;
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.208, 0.208, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 })
    );
    stripe.rotation.x = Math.PI * 0.42;
    g.add(can, stripe);
  } else if (visual === 'floating_bag') {
    const pouch = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.55,
        transparent: true,
        opacity: 0.84,
      })
    );
    pouch.scale.set(1.15, 0.65, 0.9);
    const knot = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 })
    );
    knot.position.set(0, 0.25, 0);
    g.add(pouch, knot);
  } else {
    // station_beacon (Trạm đại dương final challenge marker)
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.55,
      })
    );
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
      })
    );
    halo.rotation.x = Math.PI / 2;
    g.add(core, halo);
  }

  // Distinct bright target ring underneath debris so students immediately distinguish trash from natural sea life
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.58, 24),
    new THREE.MeshBasicMaterial({
      color: visual === 'station_beacon' ? 0xfbbf24 : 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.26;
  ring.name = 'selection_ring';
  g.add(ring);

  return g;
}

function buildRovCollector(): {
  root: THREE.Group;
  propL: THREE.Mesh;
  propR: THREE.Mesh;
  arm: THREE.Group;
} {
  const root = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.26, metalness: 0.22 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35, metalness: 0.25 });
  const navyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.42, metalness: 0.4 });
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.15,
    metalness: 0.1,
  });

  // Main streamlined chassis
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 1.02), hullMat);
  hull.castShadow = true;
  root.add(hull);

  // Top amber canopy rail
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.22, 0.88), accentMat);
  roof.position.y = 0.44;
  root.add(roof);

  // Front sapphire dome camera viewport
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 14), domeMat);
  dome.position.set(0.74, 0.04, 0);
  dome.scale.set(0.85, 0.9, 1.0);
  root.add(dome);

  // Twin side thrusters
  const podGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.74, 12);
  const podL = new THREE.Mesh(podGeo, navyMat);
  podL.rotation.z = Math.PI / 2;
  podL.position.set(-0.25, 0.08, 0.68);
  const podR = podL.clone();
  podR.position.z = -0.68;
  root.add(podL, podR);

  const propGeo = new THREE.BoxGeometry(0.06, 0.34, 0.08);
  const propMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.5, roughness: 0.3 });
  const propL = new THREE.Mesh(propGeo, propMat);
  propL.position.set(-0.65, 0.08, 0.68);
  const propR = new THREE.Mesh(propGeo, propMat);
  propR.position.set(-0.65, 0.08, -0.68);
  root.add(propL, propR);

  // Rear collection bin with cyan mesh rim
  const bin = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.46, 0.84),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.42, metalness: 0.2 })
  );
  bin.position.set(-0.98, -0.05, 0);
  root.add(bin);

  // Articulated collector arm
  const arm = new THREE.Group();
  arm.position.set(0.55, -0.34, 0);
  const strut = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.12), navyMat);
  strut.position.set(0.28, -0.08, 0);
  strut.rotation.z = -0.32;
  const clawA = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.08), accentMat);
  clawA.position.set(0.64, -0.18, 0.12);
  const clawB = clawA.clone();
  clawB.position.z = -0.12;
  arm.add(strut, clawA, clawB);
  root.add(arm);

  return { root, propL, propR, arm };
}

function buildSeaTurtle(): { root: THREE.Group; fl: THREE.Mesh; fr: THREE.Mesh } {
  const root = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x5eead4, roughness: 0.55 });

  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), shellMat);
  shell.scale.set(1.22, 0.46, 0.92);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 8, 18), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.scale.set(1.2, 0.92, 1);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
  head.position.set(0.82, 0.04, 0);
  head.scale.set(1.2, 0.85, 0.85);

  const flipperGeo = new THREE.BoxGeometry(0.65, 0.07, 0.24);
  const fl = new THREE.Mesh(flipperGeo, skinMat);
  fl.position.set(0.24, -0.04, 0.62);
  fl.rotation.y = -0.45;
  const fr = new THREE.Mesh(flipperGeo, skinMat);
  fr.position.set(0.24, -0.04, -0.62);
  fr.rotation.y = 0.45;

  const bl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.16), skinMat);
  bl.position.set(-0.56, -0.05, 0.34);
  const br = bl.clone();
  br.position.z = -0.34;

  root.add(shell, rim, head, fl, fr, bl, br);
  return { root, fl, fr };
}

function buildFish(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.32, metalness: 0.18 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bodyMat);
  body.scale.set(1.5, 0.85, 0.55);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 5), finMat);
  tail.rotation.z = -Math.PI / 2;
  tail.position.set(-0.3, 0, 0);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 4), finMat);
  dorsal.position.set(0, 0.16, 0);
  g.add(body, tail, dorsal);
  return g;
}

function buildCoralCluster(x: number, z: number, colorHex: number, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.62, metalness: 0.05 });
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.65 * scale, 0),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 })
  );
  rock.scale.set(1.3, 0.55, 1.1);
  rock.position.y = 0.18 * scale;
  g.add(rock);

  const branches: [number, number, number, number][] = [
    [-0.22, 0.62, 0.1, 0.25],
    [0.18, 0.78, -0.14, -0.22],
    [0.02, 0.58, 0.24, 0.12],
    [-0.12, 0.52, -0.22, -0.18],
  ];
  branches.forEach(([bx, by, bz, tilt]) => {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.14 * scale, by * scale, 8),
      mat
    );
    stem.position.set(bx * scale, (by * 0.5 + 0.22) * scale, bz * scale);
    stem.rotation.z = tilt;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11 * scale, 8, 8), mat);
    tip.position.set((bx - Math.sin(tilt) * 0.25) * scale, (by + 0.22) * scale, bz * scale);
    g.add(stem, tip);
  });

  g.position.set(x, 0, z);
  return g;
}

function buildResearchStation(x: number, z: number): {
  root: THREE.Group;
  beaconRing: THREE.Mesh;
  beaconMat: THREE.MeshStandardMaterial;
} {
  const root = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.28, metalness: 0.25 });
  const navyMat = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.35, metalness: 0.38 });
  const solarMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.22, metalness: 0.65 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.5,
  });

  // Anchored seabed pedestal + column
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2.15, 0.55, 18), navyMat);
  base.position.y = 0.28;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.72, 2.2, 16), whiteMat);
  column.position.y = 1.55;

  // Main cylindrical research deck
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.38, 0.85, 20), whiteMat);
  deck.position.y = 2.85;
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.52, 0.1, 10, 24), navyMat);
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 3.22;

  // Dome lab cupola
  const cupola = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.15,
      transparent: true,
      opacity: 0.88,
    })
  );
  cupola.position.y = 3.25;

  // Solar wings
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.85), solarMat);
  wingL.position.set(-2.2, 2.95, 0);
  const wingR = wingL.clone();
  wingR.position.x = 2.2;

  // Mast + beacon ring
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.25, 8), navyMat);
  mast.position.y = 4.65;
  const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.09, 10, 22), beaconMat);
  beaconRing.position.y = 5.15;

  root.add(base, column, deck, trim, cupola, wingL, wingR, mast, beaconRing);
  root.position.set(x, 0, z);
  return { root, beaconRing, beaconMat };
}

// ============================================================================
// LIGHTWEIGHT 2D INTERACTIVE OCEAN MAP (Default 2D Mode & WebGL Fallback)
// ============================================================================

export const CleanOcean2DMap: React.FC<CleanOceanSceneProps> = ({
  zones,
  missions,
  completedMissionIds,
  selectedZoneId,
  activeMissionId,
  phase,
  compact,
  onSelectZone,
  onSelectMission,
}) => {
  const zoneMissions = useMemo(
    () => missions.filter((m) => m.zoneId === selectedZoneId),
    [missions, selectedZoneId]
  );

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-cyan-500/35 bg-gradient-to-b from-[#073752] via-[#062a44] to-[#04182b] text-slate-50 ${
        compact ? 'p-3' : 'p-4 sm:p-5'
      }`}
    >
      {/* Subtle sunlit water rays */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 22% 0%, rgba(56,189,248,0.45), transparent 55%), radial-gradient(circle at 78% 0%, rgba(45,212,191,0.35), transparent 50%)',
        }}
      />

      <div className="relative z-10 flex flex-col gap-3">
        {/* 4-Zone horizontal journey map */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {zones.map((z) => {
            const isSelected = z.zoneId === selectedZoneId;
            const isLocked = z.status === 'locked';
            const isDone = z.status === 'completed';
            return (
              <button
                key={z.zoneId}
                type="button"
                disabled={isLocked || !onSelectZone}
                onClick={() => onSelectZone?.(z.zoneId)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-300 shadow-lg shadow-cyan-950/50'
                    : isDone
                      ? 'bg-emerald-500/15 border-emerald-400/45 hover:bg-emerald-500/20'
                      : isLocked
                        ? 'bg-slate-900/55 border-slate-700/60 opacity-65 cursor-not-allowed'
                        : 'bg-slate-900/45 border-cyan-500/30 hover:border-cyan-300/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-cyan-200 flex items-center gap-1.5">
                    {z.isFinalStation ? (
                      <Anchor className="w-3.5 h-3.5 text-amber-300" />
                    ) : (
                      <Waves className="w-3.5 h-3.5 text-cyan-300" />
                    )}
                    {z.title}
                  </span>
                  {isLocked ? (
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  ) : (
                    <Compass className="w-3.5 h-3.5 text-amber-300" />
                  )}
                </div>
                <p className="text-[11px] text-cyan-100/80 mb-2">{z.subtitle}</p>
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span
                    className={
                      isDone
                        ? 'text-emerald-300'
                        : isLocked
                          ? 'text-slate-400'
                          : z.status === 'in_progress'
                            ? 'text-amber-300'
                            : 'text-cyan-200'
                    }
                  >
                    {isDone
                      ? 'Hoàn thành'
                      : isLocked
                        ? 'Chưa mở'
                        : z.status === 'in_progress'
                          ? 'Đang thực hiện'
                          : 'Đã mở'}
                  </span>
                  <span className="tabular-nums text-white">
                    {z.completedMissions}/{z.totalMissions}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-950/70 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isDone ? 'bg-emerald-400' : z.isFinalStation ? 'bg-amber-400' : 'bg-cyan-400'
                    }`}
                    style={{
                      width: `${
                        z.totalMissions > 0
                          ? Math.round((z.completedMissions / z.totalMissions) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Current zone debris mission nodes (non-compact view) */}
        {!compact && zoneMissions.length > 0 && (
          <div className="rounded-xl bg-slate-950/45 border border-cyan-500/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-cyan-100">
                <Fish className="w-4 h-4 text-teal-300" />
                <span>
                  Bản đồ 2D — {C10_ZONES[selectedZoneId].title}: chỉ thu gom mục rác thải (sinh vật & san hô được bảo vệ)
                </span>
              </div>
              {phase === 'animating' && (
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Thiết bị đang đưa rác vào khoang chứa...
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {zoneMissions.map((m, idx) => {
                const done = completedMissionIds.has(m.missionId);
                const isActive = activeMissionId === m.missionId;
                return (
                  <button
                    key={m.missionId}
                    type="button"
                    disabled={done || !onSelectMission}
                    onClick={() => onSelectMission?.(m.missionId)}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      done
                        ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100 cursor-default'
                        : isActive
                          ? 'bg-amber-500/25 border-amber-300 text-amber-50'
                          : 'bg-cyan-950/60 border-cyan-400/35 hover:border-cyan-200 text-cyan-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-xs font-extrabold">
                      <span>
                        {m.isFinalChallenge ? 'Thử thách cuối' : `Nhiệm vụ ${idx + 1}`}
                      </span>
                      <span className="text-[11px] font-bold">
                        {done ? 'Đã thu gom' : m.isFinalChallenge ? '+30đ' : '+10đ'}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-100/90 mt-0.5 truncate">{m.debrisLabel}</p>
                    <p className="text-[10px] text-cyan-300/80 mt-0.5">
                      {done ? `Đã đưa vào ${m.binLabel}` : `Đích: ${m.binLabel}`}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Required illustrative caption */}
        <div className="flex items-center justify-between text-[11px] text-cyan-200/85 pt-0.5">
          <span>{C10_ILLUSTRATIVE_CAPTION}</span>
          <span>Bản đồ đại dương 2D nhẹ</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN 3D OCEAN DIORAMA COMPONENT ("HẢI TRÌNH XANH – PHỤC HỒI ĐẠI DƯƠNG")
// ============================================================================

export const CleanOcean3DScene: React.FC<CleanOceanSceneProps> = (props) => {
  const {
    zones,
    missions,
    completedMissionIds,
    selectedZoneId,
    activeMissionId,
    phase,
    quality,
    reducedMotion,
    disableCameraTransition,
    panoramaMode = false,
    compact = false,
    onSelectZone,
    onSelectMission,
    onWebGLFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  // Latest props ref for animation loop & raycasting without rebuilding WebGL context
  const latestRef = useRef({
    zones,
    missions,
    completedMissionIds,
    selectedZoneId,
    activeMissionId,
    phase,
    reducedMotion,
    disableCameraTransition,
    panoramaMode,
    onSelectZone,
    onSelectMission,
  });
  latestRef.current = {
    zones,
    missions,
    completedMissionIds,
    selectedZoneId,
    activeMissionId,
    phase,
    reducedMotion,
    disableCameraTransition,
    panoramaMode,
    onSelectZone,
    onSelectMission,
  };

  // Key mission signature so debris objects rebuild only when mission set changes
  const missionsKey = useMemo(
    () => missions.map((m) => `${m.missionId}:${m.debrisVisual}`).join('|'),
    [missions]
  );

  useEffect(() => {
    if (quality === '2d' || webglLost) return;
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: quality === 'high',
        powerPreference: quality === 'high' ? 'high-performance' : 'low-power',
        alpha: false,
      });
    } catch {
      setWebglLost(true);
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    let isSoftwareGl = false;
    try {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      isSoftwareGl = /swiftshader|llvmpipe|software|mesa offscreen/i.test(rName);
    } catch {
      isSoftwareGl = false;
    }

    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, quality === 'high' && !isSoftwareGl ? 1.75 : 1)
    );
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = quality === 'high' && !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(150, container.clientHeight);
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'pointer';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Handle WebGL context lost gracefully -> auto fallback to 2D
    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglLost(true);
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene & lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x063452);
    scene.fog = new THREE.FogExp2(0x073b5c, 0.0175);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 140);
    camera.position.set(...OVERVIEW_CAM.pos);
    const camLookAt = new THREE.Vector3(...OVERVIEW_CAM.lookAt);
    camera.lookAt(camLookAt);

    // Warm sunlit top directional key + cool ocean hemisphere fill
    const hemi = new THREE.HemisphereLight(0x99f6e4, 0x082f49, 1.15);
    scene.add(hemi);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    sunLight.position.set(-6, 18, 10);
    if (renderer.shadowMap.enabled) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.left = -22;
      sunLight.shadow.camera.right = 22;
      sunLight.shadow.camera.top = 12;
      sunLight.shadow.camera.bottom = -12;
    }
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.72);
    rimLight.position.set(14, 7, -12);
    scene.add(rimLight);

    // Undulating sandy seabed
    const seabedGeo = new THREE.PlaneGeometry(52, 26, 40, 20);
    seabedGeo.rotateX(-Math.PI / 2);
    const posAttr = seabedGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const wave = Math.sin(x * 0.24) * 0.28 + Math.cos(z * 0.35) * 0.18;
      posAttr.setY(i, wave);
    }
    seabedGeo.computeVertexNormals();
    const seabed = new THREE.Mesh(
      seabedGeo,
      new THREE.MeshStandardMaterial({
        color: 0xd6c39c,
        roughness: 0.92,
        metalness: 0.02,
      })
    );
    seabed.receiveShadow = true;
    scene.add(seabed);

    // Shimmering translucent ocean surface plane above
    const surfaceGeo = new THREE.PlaneGeometry(56, 28, 24, 12);
    surfaceGeo.rotateX(Math.PI / 2);
    const surfaceMesh = new THREE.Mesh(
      surfaceGeo,
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x0891b2,
        emissiveIntensity: 0.28,
        roughness: 0.14,
        metalness: 0.12,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      })
    );
    surfaceMesh.position.y = 5.9;
    scene.add(surfaceMesh);

    // Subtle diagonal sunlit underwater light shafts
    const rayMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const shaftPositions = [-13, -5, 3, 11];
    shaftPositions.forEach((sx) => {
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 2.1, 7.5, 12, 1, true), rayMat);
      cone.position.set(sx, 3.2, -3.5);
      cone.rotation.z = -0.18;
      scene.add(cone);
    });

    // Zone marker buoys on water surface (clickable for zone navigation)
    const zoneClickableMeshes: THREE.Object3D[] = [];
    const zoneOrder: OceanZoneId[] = ['zone_bay', 'zone_seagrass', 'zone_reef', 'zone_station'];
    const zoneBuoyMats = new Map<OceanZoneId, THREE.MeshStandardMaterial>();
    zoneOrder.forEach((zId) => {
      const a = ZONE_ANCHORS[zId];
      const buoyGroup = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: zId === 'zone_station' ? 0xf59e0b : 0x38bdf8,
        emissive: zId === 'zone_station' ? 0xb45309 : 0x0369a1,
        emissiveIntensity: 0.3,
        roughness: 0.32,
      });
      zoneBuoyMats.set(zId, mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.08, 8, 32), mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(a.x, 0.25, a.z);
      ring.userData = { zoneId: zId };
      buoyGroup.add(ring);
      scene.add(buoyGroup);
      zoneClickableMeshes.push(ring);
    });

    // Zone 2: Instanced Seagrass Meadow (protected natural flora — NEVER collectible!)
    const bladeCount = quality === 'high' ? 110 : 55;
    const bladeGeo = new THREE.BoxGeometry(0.08, 1.35, 0.03);
    bladeGeo.translate(0, 0.675, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.68 });
    const seagrassMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    const dummy = new THREE.Object3D();
    const bladeBase: { x: number; z: number; h: number; phase: number }[] = [];
    for (let i = 0; i < bladeCount; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const rad = 0.6 + ((i * 0.37) % 3.1);
      const bx = ZONE_ANCHORS.zone_seagrass.x + Math.cos(angle) * rad;
      const bz = ZONE_ANCHORS.zone_seagrass.z + Math.sin(angle) * rad * 0.85;
      const h = 0.65 + (i % 5) * 0.16;
      bladeBase.push({ x: bx, z: bz, h, phase: i * 0.41 });
      dummy.position.set(bx, 0.05, bz);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      seagrassMesh.setMatrixAt(i, dummy.matrix);
    }
    seagrassMesh.instanceMatrix.needsUpdate = true;
    scene.add(seagrassMesh);

    // Zone 3: Multi-part Coral Reef clusters (protected natural reef — NEVER collectible!)
    const coralPalette = [0xfb7185, 0xf59e0b, 0xa78bfa, 0x2dd4bf, 0xf472b6];
    const coralCoords: [number, number, number][] = [
      [3.3, -1.6, 1.05],
      [5.5, -1.2, 0.95],
      [4.2, 0.1, 1.15],
      [5.8, 1.3, 0.85],
      [2.9, 1.5, 0.9],
    ];
    coralCoords.forEach(([cx, cz, sc], idx) => {
      scene.add(buildCoralCluster(cx, cz, coralPalette[idx % coralPalette.length], sc));
    });

    // Zone 4: Marine Research Station ("Trạm đại dương")
    const station = buildResearchStation(ZONE_ANCHORS.zone_station.x, ZONE_ANCHORS.zone_station.z - 0.8);
    scene.add(station.root);

    // Protected marine life: Sea Turtle + Tropical Fish School (NEVER harmed or collected!)
    const turtle = buildSeaTurtle();
    turtle.root.position.set(4.5, 3.2, -1.5);
    scene.add(turtle.root);

    const fishList: { mesh: THREE.Group; cx: number; cy: number; cz: number; rx: number; rz: number; speed: number; offset: number }[] = [];
    const fishColors = [0xfbbf24, 0x38bdf8, 0xfb7185, 0x34d399, 0xf97316, 0xa78bfa];
    const fishCount = quality === 'high' ? 12 : 6;
    for (let i = 0; i < fishCount; i++) {
      const f = buildFish(fishColors[i % fishColors.length]);
      const zoneAnchor = i % 3 === 0 ? ZONE_ANCHORS.zone_bay.x : i % 3 === 1 ? ZONE_ANCHORS.zone_seagrass.x : ZONE_ANCHORS.zone_reef.x;
      scene.add(f);
      fishList.push({
        mesh: f,
        cx: zoneAnchor,
        cy: 1.9 + (i % 4) * 0.65,
        cz: -0.6 + (i % 3) * 0.9,
        rx: 2.1 + (i % 3) * 0.65,
        rz: 1.4 + (i % 2) * 0.6,
        speed: 0.42 + (i % 4) * 0.08,
        offset: i * 1.15,
      });
    }

    // Autonomous Marine Research ROV Collector
    const rov = buildRovCollector();
    rov.root.position.set(ZONE_ANCHORS.zone_bay.x - 1.5, 2.7, 2.4);
    scene.add(rov.root);

    // Debris items strictly 1-to-1 with missions (ONLY trash_debris)
    const debrisMap = new Map<string, { group: THREE.Group; homePos: THREE.Vector3; mission: OceanMissionSlot }>();
    const debrisClickTargets: THREE.Object3D[] = [];
    missions.forEach((m) => {
      const grp = buildDebrisMesh(m.debrisVisual);
      const pos = getMissionWorldPos(m);
      grp.position.copy(pos);
      grp.traverse((child) => {
        child.userData = { missionId: m.missionId, zoneId: m.zoneId };
      });
      scene.add(grp);
      debrisMap.set(m.missionId, { group: grp, homePos: pos, mission: m });
      debrisClickTargets.push(grp);
    });

    // Raycaster pointer interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerClick = (ev: MouseEvent) => {
      if (!renderer) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const cur = latestRef.current;
      // Check debris targets first
      const visibleDebris = debrisClickTargets.filter((obj) => obj.visible);
      const hits = raycaster.intersectObjects(visibleDebris, true);
      if (hits.length > 0) {
        const hitMissionId = hits[0].object.userData?.missionId as string | undefined;
        if (hitMissionId && !cur.completedMissionIds.has(hitMissionId)) {
          cur.onSelectMission?.(hitMissionId);
          return;
        }
      }
      // Check zone rings
      const zoneHits = raycaster.intersectObjects(zoneClickableMeshes, false);
      if (zoneHits.length > 0) {
        const zId = zoneHits[0].object.userData?.zoneId as OceanZoneId | undefined;
        if (zId) cur.onSelectZone?.(zId);
      }
    };
    renderer.domElement.addEventListener('click', handlePointerClick);

    // ResizeObserver for crisp layout across 1366x768, 1920x1080, tablet, fullscreen
    const resizeObs = new ResizeObserver((entries) => {
      if (!renderer) return;
      for (const entry of entries) {
        const w = Math.max(280, Math.floor(entry.contentRect.width));
        const h = Math.max(140, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      }
    });
    resizeObs.observe(container);

    // Smooth animation loop with software GL fence pacing
    let rafId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    const targetCamPos = new THREE.Vector3(...OVERVIEW_CAM.pos);
    const targetCamLook = new THREE.Vector3(...OVERVIEW_CAM.lookAt);
    const rovTargetPos = new THREE.Vector3(ZONE_ANCHORS.zone_bay.x, 2.6, 2.2);

    const animate = (now: number) => {
      if (disposed || !renderer) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const cur = latestRef.current;
      const motionScale = cur.reducedMotion ? 0.15 : 1.0;
      elapsed += dt * motionScale;

      // 1. Camera target selection
      if (cur.panoramaMode || cur.phase === 'map' || cur.phase === 'setup') {
        targetCamPos.set(...OVERVIEW_CAM.pos);
        targetCamLook.set(...OVERVIEW_CAM.lookAt);
      } else {
        const a = ZONE_ANCHORS[cur.selectedZoneId] || ZONE_ANCHORS.zone_bay;
        targetCamPos.set(...a.camPos);
        targetCamLook.set(...a.lookAt);
      }

      if (cur.disableCameraTransition || cur.reducedMotion) {
        camera.position.copy(targetCamPos);
        camLookAt.copy(targetCamLook);
      } else {
        const lerpAlpha = 1 - Math.exp(-dt * 4.2);
        camera.position.lerp(targetCamPos, lerpAlpha);
        camLookAt.lerp(targetCamLook, lerpAlpha);
      }
      camera.lookAt(camLookAt);

      // 2. Update zone ring colors & Research Station golden beacon
      const stationZone = cur.zones.find((z) => z.zoneId === 'zone_station');
      if (stationZone) {
        if (stationZone.status === 'completed') {
          station.beaconMat.color.setHex(0xfde047);
          station.beaconMat.emissive.setHex(0xf59e0b);
          station.beaconMat.emissiveIntensity = 0.85;
        } else if (stationZone.status === 'open' || stationZone.status === 'in_progress') {
          station.beaconMat.color.setHex(0xfbbf24);
          station.beaconMat.emissive.setHex(0xd97706);
          station.beaconMat.emissiveIntensity = 0.55;
        } else {
          station.beaconMat.color.setHex(0x64748b);
          station.beaconMat.emissive.setHex(0x1e293b);
          station.beaconMat.emissiveIntensity = 0.2;
        }
      }
      station.beaconRing.rotation.y += dt * 0.9 * motionScale;

      cur.zones.forEach((z) => {
        const mat = zoneBuoyMats.get(z.zoneId);
        if (!mat) return;
        if (z.status === 'completed') {
          mat.color.setHex(0x34d399);
          mat.emissive.setHex(0x059669);
        } else if (z.zoneId === cur.selectedZoneId) {
          mat.color.setHex(0xfbbf24);
          mat.emissive.setHex(0xd97706);
        } else if (z.status === 'locked') {
          mat.color.setHex(0x475569);
          mat.emissive.setHex(0x0f172a);
        } else {
          mat.color.setHex(0x38bdf8);
          mat.emissive.setHex(0x0284c7);
        }
      });

      // 3. Gently animate protected seagrass, sea turtle, and reef fish
      if (!cur.reducedMotion) {
        for (let i = 0; i < bladeBase.length; i++) {
          const b = bladeBase[i];
          dummy.position.set(b.x, 0.04, b.z);
          dummy.scale.set(1, b.h, 1);
          dummy.rotation.set(
            Math.sin(elapsed * 1.4 + b.phase) * 0.14,
            b.phase,
            Math.cos(elapsed * 1.1 + b.phase) * 0.12
          );
          dummy.updateMatrix();
          seagrassMesh.setMatrixAt(i, dummy.matrix);
        }
        seagrassMesh.instanceMatrix.needsUpdate = true;
      }

      const turtleAngle = elapsed * 0.28;
      turtle.root.position.set(
        ZONE_ANCHORS.zone_reef.x + Math.cos(turtleAngle) * 3.1,
        3.25 + Math.sin(elapsed * 0.8) * 0.22,
        -1.2 + Math.sin(turtleAngle) * 1.9
      );
      turtle.root.rotation.y = -turtleAngle - Math.PI / 2;
      turtle.fl.rotation.z = Math.sin(elapsed * 2.4) * 0.26;
      turtle.fr.rotation.z = -Math.sin(elapsed * 2.4) * 0.26;

      fishList.forEach((f) => {
        const a = elapsed * f.speed + f.offset;
        const nx = f.cx + Math.cos(a) * f.rx;
        const nz = f.cz + Math.sin(a) * f.rz;
        f.mesh.position.set(nx, f.cy + Math.sin(elapsed * 1.5 + f.offset) * 0.14, nz);
        f.mesh.rotation.y = -a - Math.PI / 2;
      });

      // 4. ROV navigation & trash-only collection animation
      const activeEntry = cur.activeMissionId ? debrisMap.get(cur.activeMissionId) : undefined;
      if (cur.phase === 'animating' && activeEntry) {
        rovTargetPos.set(
          activeEntry.homePos.x - 1.15,
          Math.max(1.5, activeEntry.homePos.y + 0.55),
          activeEntry.homePos.z + 0.55
        );
      } else if (activeEntry) {
        rovTargetPos.set(
          activeEntry.homePos.x - 1.8,
          Math.max(1.9, activeEntry.homePos.y + 0.8),
          activeEntry.homePos.z + 1.1
        );
      } else {
        const a = ZONE_ANCHORS[cur.selectedZoneId] || ZONE_ANCHORS.zone_bay;
        rovTargetPos.set(a.x - 1.6, 2.8 + Math.sin(elapsed * 1.2) * 0.18, a.z + 2.1);
      }

      const rovLerp = cur.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.6);
      rov.root.position.lerp(rovTargetPos, rovLerp);
      rov.propL.rotation.x += dt * 14 * motionScale;
      rov.propR.rotation.x -= dt * 14 * motionScale;
      rov.arm.rotation.z = cur.phase === 'animating' ? -0.35 + Math.sin(elapsed * 6) * 0.18 : 0.08;

      // 5. Update debris visibility strictly from authoritative `completedMissionIds`
      debrisMap.forEach((entry, mId) => {
        const isDone = cur.completedMissionIds.has(mId);
        const isAnimatingThis = cur.phase === 'animating' && cur.activeMissionId === mId;

        if (isAnimatingThis) {
          // Smoothly lift trash debris toward ROV collection bin during animation
          entry.group.visible = true;
          entry.group.position.lerp(
            new THREE.Vector3(rov.root.position.x - 0.65, rov.root.position.y + 0.05, rov.root.position.z),
            cur.reducedMotion ? 1 : 1 - Math.exp(-dt * 4.5)
          );
          entry.group.scale.lerp(new THREE.Vector3(0.35, 0.35, 0.35), 1 - Math.exp(-dt * 3.2));
        } else if (isDone) {
          entry.group.visible = false;
        } else {
          entry.group.visible = true;
          const bob = Math.sin(elapsed * 1.8 + entry.mission.slotIndex * 1.3) * 0.1;
          entry.group.position.set(entry.homePos.x, entry.homePos.y + bob, entry.homePos.z);
          const isSelectedMission = cur.activeMissionId === mId;
          const s = isSelectedMission ? 1.22 : 1.0;
          entry.group.scale.set(s, s, s);
          entry.group.rotation.y += dt * (isSelectedMission ? 1.5 : 0.45) * motionScale;
        }
      });

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
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
      renderer?.dispose();
    };
  }, [quality, webglLost, missionsKey, onWebGLFallback]);

  if (quality === '2d' || webglLost) {
    return (
      <div className="w-full space-y-1.5">
        {webglLost && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-semibold text-amber-100">
            Trình duyệt vừa tạm ngắt WebGL 3D — hệ thống tự động chuyển sang bản đồ đại dương 2D nhẹ mà không mất tiến độ.
          </div>
        )}
        <CleanOcean2DMap {...props} />
      </div>
    );
  }

  const heightClass = compact
    ? 'h-[168px] sm:h-[192px]'
    : panoramaMode
      ? 'h-[360px] sm:h-[440px]'
      : 'h-[260px] sm:h-[330px] lg:h-[370px]';

  return (
    <div
      className={`relative w-full ${heightClass} rounded-2xl overflow-hidden border border-cyan-500/35 bg-[#063452] shadow-lg`}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-left subtle zone badge */}
      <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap items-center gap-2">
        <span className="px-2.5 py-1 rounded-lg bg-slate-950/70 backdrop-blur-sm border border-cyan-400/35 text-xs font-extrabold text-cyan-100">
          {panoramaMode || phase === 'map'
            ? 'Toàn cảnh Hải trình xanh (4 khu vực)'
            : `${C10_ZONES[selectedZoneId].title} · ${C10_ZONES[selectedZoneId].subtitle}`}
        </span>
      </div>

      {/* Bottom-left required illustrative caption */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-cyan-100/90">
        <span className="px-2.5 py-1 rounded-md bg-slate-950/70 backdrop-blur-sm border border-cyan-500/25">
          {C10_ILLUSTRATIVE_CAPTION}
        </span>
        <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-slate-950/65 backdrop-blur-sm border border-cyan-500/20 text-cyan-200">
          {quality === 'high' ? '3D Cao' : '3D Nhẹ'} · Sinh vật biển được bảo vệ
        </span>
      </div>
    </div>
  );
};

export default CleanOcean3DScene;
