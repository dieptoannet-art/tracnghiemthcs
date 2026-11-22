import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CheckCircle2, MinusCircle, Shield, Trophy, XCircle } from 'lucide-react';
import {
  C03GraphicsQuality,
  C03Phase,
  C03TeamItem,
  C03TeamOutcomeStatus,
  getC03RoundPoints,
} from './knowledgeArena3dEngine';

export interface KnowledgeArenaSceneProps {
  teams: C03TeamItem[];
  currentRoundIndex: 0 | 1 | 2;
  questionInRoundIndex: 0 | 1 | 2 | 3;
  phase: C03Phase;
  quality: C03GraphicsQuality;
  reducedMotion: boolean;
  onSelectTeam?: (teamId: string) => void;
  onWebGLFallback?: () => void;
}

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

function outcomeStatusDotColor(status: C03TeamOutcomeStatus): string {
  switch (status) {
    case 'correct_independent':
      return 'bg-emerald-400 border-emerald-200 text-slate-950';
    case 'correct_with_hint':
      return 'bg-amber-400 border-amber-200 text-slate-950';
    case 'wrong':
    case 'wrong_viewed_solution':
      return 'bg-rose-500 border-rose-200 text-white';
    case 'skipped':
      return 'bg-slate-500 border-slate-300 text-white';
    case 'submitted':
      return 'bg-sky-400 border-sky-200 text-slate-950';
    default:
      return 'bg-slate-800 border-slate-600 text-slate-400';
  }
}

export const KnowledgeArena2DStage: React.FC<KnowledgeArenaSceneProps> = ({
  teams,
  currentRoundIndex,
  questionInRoundIndex,
  onSelectTeam,
}) => {
  return (
    <div className="w-full h-full min-h-[290px] bg-[#08132B] p-3 sm:p-4 flex flex-col justify-between gap-3">
      {/* Center 3-Round Arch Progress Bar (1-4 per round) */}
      <div className="grid grid-cols-3 gap-2">
        {([0, 1, 2] as const).map((rIdx) => {
          const isCurrent = rIdx === currentRoundIndex;
          const isPast = rIdx < currentRoundIndex;
          const pts = getC03RoundPoints(rIdx);
          return (
            <div
              key={rIdx}
              className={`p-2.5 rounded-xl border text-center transition-colors ${
                isCurrent
                  ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                  : isPast
                    ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
                    : 'bg-slate-900/75 border-slate-700 text-slate-300'
              }`}
            >
              <div className="text-xs font-bold">
                Vòng {rIdx + 1} · {pts}đ/câu
              </div>
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {[0, 1, 2, 3].map((qIdx) => {
                  const activePip = isCurrent && qIdx === questionInRoundIndex;
                  const donePip = isPast || (isCurrent && qIdx < questionInRoundIndex);
                  return (
                    <span
                      key={qIdx}
                      className={`w-6 h-6 rounded-md border text-[11px] font-mono font-bold flex items-center justify-center ${
                        activePip
                          ? 'bg-amber-400 border-white text-slate-950'
                          : donePip
                            ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                            : 'bg-slate-800 border-slate-600 text-slate-400'
                      }`}
                    >
                      {qIdx + 1}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Team Score Strips with Round Progress 1-4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-auto">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelectTeam?.(t.id)}
            className="p-3 rounded-xl bg-slate-900/85 border border-slate-700 hover:border-amber-400/70 text-left flex flex-col gap-2 cursor-pointer transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3.5 h-3.5 rounded-sm shrink-0"
                  style={{ backgroundColor: t.color }}
                />
                <span className="text-sm font-bold text-white truncate">{t.name}</span>
              </div>
              <span className="text-base font-mono font-extrabold text-amber-300 tabular-nums">
                {t.mainScore}đ
              </span>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>Tiến trình Vòng {currentRoundIndex + 1} (1–4):</span>
              <div className="flex items-center gap-1">
                {t.roundProgress[currentRoundIndex].map((st, idx) => (
                  <span
                    key={idx}
                    className={`w-5 h-5 rounded border flex items-center justify-center text-[10px] font-bold ${outcomeStatusDotColor(st)}`}
                    title={`Câu ${idx + 1}: ${st}`}
                  >
                    {st === 'correct_independent' || st === 'correct_with_hint' ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : st === 'wrong' || st === 'wrong_viewed_solution' ? (
                      <XCircle className="w-3 h-3" />
                    ) : st === 'skipped' ? (
                      <MinusCircle className="w-3 h-3" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-700/70 flex items-center justify-between text-[11px] text-slate-300">
        <span>Chế độ 2D nhẹ · Dải điểm đội & tiến trình 1–4 từng vòng</span>
        <span className="font-mono text-amber-300">Tối đa 240đ (4×10 + 4×20 + 4×30)</span>
      </div>
    </div>
  );
};

export const KnowledgeArena3DScene: React.FC<KnowledgeArenaSceneProps> = (props) => {
  const {
    teams,
    currentRoundIndex,
    questionInRoundIndex,
    quality,
    reducedMotion,
    onSelectTeam,
    onWebGLFallback,
  } = props;

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const latestRef = useRef(props);
  latestRef.current = props;

  const roundArchMeshesRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const teamColumnMeshesRef = useRef<
    Array<{
      barMesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
    }>
  >([]);
  const rebuildColumnsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (quality === '2d' || webglLost) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let envTex: THREE.Texture | null = null;

    try {
      const isSoftwareGl = detectSoftwareWebGL();
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const w = Math.max(320, mount.clientWidth || 640);
      const h = Math.max(240, mount.clientHeight || 340);
      renderer.setSize(w, h);
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const handleLost = (e: Event) => {
        e.preventDefault();
        setWebglLost(true);
        onWebGLFallback?.();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleLost);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x061026);
      scene.fog = new THREE.FogExp2(0x061026, 0.045);

      const pmrem = new THREE.PMREMGenerator(renderer);
      envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      pmrem.dispose();

      const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 60);
      camera.position.set(0, 4.4, 7.2);
      camera.lookAt(0, 0.7, 0);

      const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.78);
      const key = new THREE.DirectionalLight(0xfff4d6, 2.2);
      key.position.set(4.5, 8.0, 5.2);
      if (!isSoftwareGl) {
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.bias = -0.0005;
        key.shadow.normalBias = 0.02;
      }
      const rim = new THREE.DirectionalLight(0x38bdf8, 1.0);
      rim.position.set(-4.5, 3.5, -4.0);
      scene.add(hemi, key, rim);

      // Circular Tiered Colosseum Base
      const arenaMat = new THREE.MeshStandardMaterial({
        color: 0x0f1f3d,
        roughness: 0.65,
        metalness: 0.25,
      });
      const goldTrimMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.25,
        metalness: 0.85,
      });
      const baseTier = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.35, 36), arenaMat);
      baseTier.position.y = -0.175;
      baseTier.receiveShadow = true;
      const centerRing = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 10, 40), goldTrimMat);
      centerRing.rotation.x = Math.PI / 2;
      centerRing.position.y = 0.04;
      scene.add(baseTier, centerRing);

      // Center Three-Round Illuminated Arches
      roundArchMeshesRef.current = [];
      for (let r = 0; r < 3; r++) {
        const archMat = new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.2,
          roughness: 0.22,
          metalness: 0.72,
        });
        const archMesh = new THREE.Mesh(
          new THREE.TorusGeometry(1.15 + r * 0.35, 0.075, 10, 32, Math.PI),
          archMat
        );
        archMesh.position.set(0, 0.15, -0.55 - r * 0.42);
        archMesh.castShadow = true;
        scene.add(archMesh);
        roundArchMeshesRef.current.push(archMat);
      }

      // Dynamic Team Score Columns around arena arc
      const teamGroup = new THREE.Group();
      scene.add(teamGroup);

      const buildTeamColumns = () => {
        while (teamGroup.children.length > 0) {
          teamGroup.remove(teamGroup.children.pop()!);
        }
        teamColumnMeshesRef.current = [];

        const list = latestRef.current.teams;
        const count = list.length;
        const span = Math.min(5.2, count * 1.45);
        list.forEach((t, idx) => {
          const x = count === 1 ? 0 : -span / 2 + (idx / (count - 1)) * span;
          const plinth = new THREE.Mesh(
            new THREE.CylinderGeometry(0.42, 0.48, 0.18, 16),
            arenaMat
          );
          plinth.position.set(x, 0.09, 1.55);

          const colColor = new THREE.Color(t.color);
          const colMat = new THREE.MeshStandardMaterial({
            color: colColor,
            emissive: colColor,
            emissiveIntensity: 0.22,
            roughness: 0.28,
            metalness: 0.45,
          });
          const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 1.0, 0.44), colMat);
          barMesh.position.set(x, 0.68, 1.55);
          barMesh.castShadow = true;

          teamGroup.add(plinth, barMesh);
          teamColumnMeshesRef.current.push({ barMesh, mat: colMat });
        });
      };

      buildTeamColumns();
      rebuildColumnsRef.current = buildTeamColumns;

      const onResize = () => {
        if (!mount || !renderer) return;
        const nw = Math.max(320, mount.clientWidth || 640);
        const nh = Math.max(240, mount.clientHeight || 340);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      window.addEventListener('resize', onResize);

      const clock = new THREE.Clock();

      const afterDraw = (cb: () => void) => {
        if (disposed || !renderer) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const st = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
            if (st === gl.UNSIGNALED) frameId = window.setTimeout(poll, 5);
            else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          frameId = window.setTimeout(cb, 80);
        }
      };

      const tick = () => {
        if (disposed || !renderer) return;
        const dt = Math.min(0.08, clock.getDelta());
        const cur = latestRef.current;

        // Highlight active round arch (0..2)
        roundArchMeshesRef.current.forEach((mat, rIdx) => {
          if (rIdx === cur.currentRoundIndex) {
            mat.color.setHex(0xfbbf24);
            mat.emissive.setHex(0xf59e0b);
            mat.emissiveIntensity = 0.65;
          } else if (rIdx < cur.currentRoundIndex) {
            mat.color.setHex(0x34d399);
            mat.emissive.setHex(0x059669);
            mat.emissiveIntensity = 0.4;
          } else {
            mat.color.setHex(0x38bdf8);
            mat.emissive.setHex(0x0284c7);
            mat.emissiveIntensity = 0.15;
          }
        });

        // Smooth height scaling of team score columns up to 240 max
        cur.teams.forEach((team, idx) => {
          const vis = teamColumnMeshesRef.current[idx];
          if (!vis) return;
          const targetH = 0.35 + (Math.min(240, team.mainScore) / 240) * 2.1;
          const nextH = cur.reducedMotion
            ? targetH
            : THREE.MathUtils.damp(vis.barMesh.scale.y, targetH, 6.5, dt);
          vis.barMesh.scale.y = nextH;
          vis.barMesh.position.y = 0.18 + nextH * 0.5;
        });

        renderer.render(scene, camera);
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      };

      tick();

      return () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        window.removeEventListener('resize', onResize);
        renderer?.domElement.removeEventListener('webglcontextlost', handleLost);
        envTex?.dispose();
        renderer?.dispose();
        if (mount) mount.innerHTML = '';
      };
    } catch {
      setWebglLost(true);
      onWebGLFallback?.();
    }
  }, [quality, webglLost, onWebGLFallback]);

  useEffect(() => {
    rebuildColumnsRef.current?.();
  }, [teams.length]);

  if (quality === '2d' || webglLost) {
    return <KnowledgeArena2DStage {...props} />;
  }

  return (
    <div className="relative w-full h-full min-h-[290px] bg-[#061026] overflow-hidden flex flex-col">
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
        aria-hidden="true"
      />

      {/* Semantic Overlay separated cleanly from WebGL pixels */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-3 sm:p-4 bg-slate-950/30">
        {/* Static 3-Round Progress Strip (Never covers new question!) */}
        <div className="grid grid-cols-3 gap-2">
          {([0, 1, 2] as const).map((rIdx) => {
            const isCurrent = rIdx === currentRoundIndex;
            const isDone = rIdx < currentRoundIndex;
            const pts = getC03RoundPoints(rIdx);
            return (
              <div
                key={rIdx}
                className={`p-2 rounded-xl border text-center ${
                  isCurrent
                    ? 'bg-amber-950/85 border-amber-400 text-amber-100'
                    : isDone
                      ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-100'
                      : 'bg-slate-900/80 border-slate-700 text-slate-300'
                }`}
              >
                <div className="text-xs font-bold">
                  Vòng {rIdx + 1} · {pts}đ/câu
                </div>
                <div className="mt-1 flex items-center justify-center gap-1">
                  {[0, 1, 2, 3].map((qIdx) => {
                    const active = isCurrent && qIdx === questionInRoundIndex;
                    const past = isDone || (isCurrent && qIdx < questionInRoundIndex);
                    return (
                      <span
                        key={qIdx}
                        className={`w-5 h-5 rounded border text-[10px] font-mono font-bold flex items-center justify-center ${
                          active
                            ? 'bg-amber-400 border-white text-slate-950'
                            : past
                              ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                              : 'bg-slate-800 border-slate-600 text-slate-400'
                        }`}
                      >
                        {qIdx + 1}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Team Score Columns & Round 1-4 Pips */}
        <div className="mt-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelectTeam?.(t.id)}
              className="p-2.5 rounded-xl bg-slate-900/85 border border-slate-700 hover:border-amber-400/75 text-left flex flex-col gap-1.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Shield className="w-3.5 h-3.5 shrink-0" style={{ color: t.color }} />
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {t.name}
                  </span>
                </div>
                <span className="text-sm sm:text-base font-mono font-extrabold text-amber-300 tabular-nums">
                  {t.mainScore}đ
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-300">
                <span>Vòng {currentRoundIndex + 1} (1–4):</span>
                <div className="flex items-center gap-1">
                  {t.roundProgress[currentRoundIndex].map((st, idx) => (
                    <span
                      key={idx}
                      className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] font-bold ${outcomeStatusDotColor(st)}`}
                    >
                      {st === 'correct_independent' || st === 'correct_with_hint'
                        ? '✓'
                        : st === 'wrong' || st === 'wrong_viewed_solution'
                          ? '✕'
                          : st === 'skipped'
                            ? '–'
                            : idx + 1}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="pt-2 mt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
          <span>Đấu trường Ba Vòng 3D</span>
          <span className="inline-flex items-center gap-1 font-mono text-amber-300">
            <Trophy className="w-3 h-3" /> Tối đa 240đ (4×10 + 4×20 + 4×30)
          </span>
        </div>
      </div>
    </div>
  );
};
