import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Clock, Zap } from 'lucide-react';
import {
  B10ClockMode,
  B10GraphicsQuality,
  B10Outcome,
  B10Phase,
  B10QuestionRecord,
} from './lightningQuiz3dEngine';

export interface LightningQuizSceneProps {
  records: B10QuestionRecord[];
  currentIndex: number;
  phase: B10Phase;
  clockMode: B10ClockMode;
  remainingMs: number;
  totalBudgetMs: number;
  score: number;
  streak: number;
  quality: B10GraphicsQuality;
  reducedMotion: boolean;
  onWebGLFallback?: () => void;
}

const OUTCOME_LABELS: Record<B10Outcome | 'active', string> = {
  active: 'Đang thi',
  correct: 'Đúng',
  wrong: 'Sai',
  skipped: 'Đã bỏ câu',
  timeout: 'Hết giờ',
  unseen: 'Chưa thấy câu',
};

const OUTCOME_HEX: Record<B10Outcome | 'active', number> = {
  active: 0x22d3ee,
  correct: 0x10b981,
  wrong: 0xf43f5e,
  skipped: 0x8b5cf6,
  timeout: 0xf59e0b,
  unseen: 0x1e3a5f,
};

function getCubeStatus(
  rec: B10QuestionRecord,
  idx: number,
  currentIndex: number,
  phase: B10Phase
): B10Outcome | 'active' {
  if (idx === currentIndex && phase !== 'summary' && rec.outcome === 'unseen') {
    return 'active';
  }
  return rec.outcome;
}

export const LightningQuiz2DStage: React.FC<LightningQuizSceneProps> = ({
  records,
  currentIndex,
  phase,
  clockMode,
  remainingMs,
  totalBudgetMs,
  score,
  streak,
}) => {
  const safeTotal = Math.max(1000, totalBudgetMs);
  const ratio = Math.max(0, Math.min(1, remainingMs / safeTotal));
  const remainingSec = Math.ceil(remainingMs / 1000);
  const isExpired =
    (phase === 'answering' || phase === 'revealed' || phase === 'summary') &&
    remainingMs <= 0 &&
    (records[currentIndex]?.outcome === 'timeout' || phase === 'summary');
  const isUrgent = phase === 'answering' && remainingSec <= 5 && remainingMs > 0;
  const activeRec = records[currentIndex];
  const lastOutcome = activeRec?.outcome;

  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="w-full rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-[#061229] via-[#0a1b3d] to-[#061026] p-4 sm:p-5 text-white shadow-lg">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Left: Chronograph Dial + Lightning Crest */}
        <div className="flex items-center gap-4">
          <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 88 88" className="w-24 h-24 -rotate-90" aria-hidden="true">
              <circle
                cx="44"
                cy="44"
                r={radius}
                fill="#07132b"
                stroke="#1e3a5f"
                strokeWidth="7"
              />
              <circle
                cx="44"
                cy="44"
                r={radius}
                fill="none"
                stroke={isExpired ? '#f59e0b' : isUrgent ? '#f43f5e' : '#22d3ee'}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span
                className={`text-xl font-black tabular-nums ${
                  isExpired
                    ? 'text-amber-300'
                    : isUrgent
                      ? 'text-rose-300'
                      : 'text-cyan-200'
                }`}
              >
                {isExpired ? '0s' : `${remainingSec}s`}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                {clockMode === 'whole_turn' ? 'Toàn lượt' : 'Mỗi câu'}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-extrabold">
              <Zap className="w-3.5 h-3.5" />
              <span>Bảng tăng tốc 2D (Nhẹ)</span>
            </div>
            <p className="text-sm font-bold text-slate-100">
              {isExpired
                ? 'Trạng thái đồng hồ: Hết giờ'
                : phase === 'paused'
                  ? 'Đồng hồ đang tạm dừng'
                  : phase === 'revealed'
                    ? lastOutcome === 'correct'
                      ? 'Chính xác · Bật sáng khối câu!'
                      : lastOutcome === 'skipped'
                        ? 'Đã bỏ câu'
                        : lastOutcome === 'timeout'
                          ? 'Hết giờ cho câu hiện tại'
                          : 'Đã chốt đáp án'
                    : `Chuỗi đúng liên tiếp: ${streak} · Tổng điểm: ${score}`}
            </p>
          </div>
        </div>

        {/* Right: Stepped 10-Cube Progress Strip */}
        <div className="w-full sm:w-auto flex-1 max-w-xl">
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {records.map((rec, idx) => {
              const st = getCubeStatus(rec, idx, currentIndex, phase);
              const badgeCls =
                st === 'active'
                  ? 'bg-cyan-500/30 border-cyan-300 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)] -translate-y-0.5'
                  : st === 'correct'
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : st === 'wrong'
                      ? 'bg-rose-500/25 border-rose-400 text-rose-200'
                      : st === 'skipped'
                        ? 'bg-violet-500/25 border-violet-400 text-violet-200'
                        : st === 'timeout'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-slate-900/75 border-slate-700 text-slate-400';

              return (
                <div
                  key={rec.questionId}
                  title={`Câu ${idx + 1}: ${OUTCOME_LABELS[st]}`}
                  className={`rounded-lg border px-1.5 py-2 text-center transition-transform ${badgeCls}`}
                >
                  <div className="text-xs font-black">C{idx + 1}</div>
                  <div className="text-[9px] font-bold truncate opacity-90">
                    {st === 'active'
                      ? 'Đang mở'
                      : st === 'correct'
                        ? '+10'
                        : st === 'wrong'
                          ? 'Sai'
                          : st === 'skipped'
                            ? 'Bỏ qua'
                            : st === 'timeout'
                              ? 'Hết giờ'
                              : 'Chờ'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export const LightningQuiz3DScene: React.FC<LightningQuizSceneProps> = (props) => {
  const {
    records,
    currentIndex,
    phase,
    clockMode,
    remainingMs,
    totalBudgetMs,
    quality,
    reducedMotion,
    onWebGLFallback,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const liveRef = useRef<LightningQuizSceneProps>(props);
  liveRef.current = props;

  const recordCount = records.length;

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
    const rendererString = debugInfo
      ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter(gl.RENDERER) || '');
    const isSoftwareGl = /swiftshader|llvmpipe|software|mesa/i.test(rendererString);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.5));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 240);
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
    scene.background = new THREE.Color(0x050e24);
    scene.fog = new THREE.FogExp2(0x050e24, 0.028);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmrem.dispose();

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 240;
    const camera = new THREE.PerspectiveCamera(40, width / Math.max(1, height), 0.1, 80);
    camera.position.set(0, 4.1, 10.8);
    camera.lookAt(0, 1.35, 0);

    // 3-point studio lighting
    scene.add(new THREE.AmbientLight(0xdbeafe, 0.65));
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.7);
    keyLight.position.set(4.5, 8.5, 6.5);
    scene.add(keyLight);

    const rimCyan = new THREE.DirectionalLight(0x22d3ee, 1.15);
    rimCyan.position.set(-6.0, 4.0, -4.0);
    scene.add(rimCyan);

    const accentAmber = new THREE.PointLight(0xf59e0b, 1.1, 16);
    accentAmber.position.set(2.4, 3.2, 2.5);
    scene.add(accentAmber);

    // Studio Podium Floor & Trim Rings
    const floorDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 7.2, 0.36, 48),
      new THREE.MeshStandardMaterial({
        color: 0x0a1938,
        roughness: 0.35,
        metalness: 0.45,
      })
    );
    floorDisc.position.set(0, -0.18, -0.3);
    scene.add(floorDisc);

    const trimRing = new THREE.Mesh(
      new THREE.TorusGeometry(6.65, 0.055, 10, 64),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xb45309,
        emissiveIntensity: 0.4,
        metalness: 0.85,
        roughness: 0.22,
      })
    );
    trimRing.rotation.x = Math.PI / 2;
    trimRing.position.set(0, 0.02, -0.3);
    scene.add(trimRing);

    // Central Golden Chronograph Stopwatch Assembly
    const chronoGroup = new THREE.Group();
    chronoGroup.position.set(-0.55, 2.3, -1.35);
    scene.add(chronoGroup);

    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(1.52, 0.16, 16, 48),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.88,
        roughness: 0.2,
      })
    );
    chronoGroup.add(bezel);

    const dialFace = new THREE.Mesh(
      new THREE.CylinderGeometry(1.42, 1.42, 0.16, 40),
      new THREE.MeshStandardMaterial({
        color: 0x091734,
        roughness: 0.38,
        metalness: 0.25,
      })
    );
    dialFace.rotation.x = Math.PI / 2;
    dialFace.position.z = -0.05;
    chronoGroup.add(dialFace);

    // Top crown button on stopwatch
    const crownStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.86, roughness: 0.24 })
    );
    crownStem.position.set(0, 1.78, 0);
    chronoGroup.add(crownStem);

    // 12 dial tick markers
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.18, 0.06),
        new THREE.MeshStandardMaterial({
          color: i % 3 === 0 ? 0x38bdf8 : 0xe2e8f0,
          emissive: i % 3 === 0 ? 0x0284c7 : 0x000000,
          emissiveIntensity: 0.45,
        })
      );
      tick.position.set(Math.sin(angle) * 1.15, Math.cos(angle) * 1.15, 0.06);
      tick.rotation.z = -angle;
      chronoGroup.add(tick);
    }

    // Chronograph Needle Pivot
    const handPivot = new THREE.Group();
    handPivot.position.set(0, 0, 0.11);
    chronoGroup.add(handPivot);

    const handMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x0891b2,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.5,
    });
    const handBlade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 1.05, 0.045), handMat);
    handBlade.position.y = 0.44;
    handPivot.add(handBlade);

    const centerCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.1, 20),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 })
    );
    centerCap.rotation.x = Math.PI / 2;
    handPivot.add(centerCap);

    // Dynamic Electric Cyan Energy Rings orbiting chronograph
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.7,
      roughness: 0.22,
      metalness: 0.3,
    });
    const energyRing1 = new THREE.Mesh(new THREE.TorusGeometry(1.92, 0.036, 10, 56), ringMat);
    const energyRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.14, 0.028, 10, 56), ringMat);
    energyRing2.rotation.x = 0.38;
    energyRing2.rotation.y = -0.35;
    chronoGroup.add(energyRing1, energyRing2);

    // Sculpted 3D Golden Lightning Emblem right side of chronograph
    const boltShape = new THREE.Shape();
    boltShape.moveTo(0.25, 1.15);
    boltShape.lineTo(-0.35, 0.15);
    boltShape.lineTo(0.06, 0.15);
    boltShape.lineTo(-0.22, -0.95);
    boltShape.lineTo(0.45, 0.05);
    boltShape.lineTo(0.04, 0.05);
    boltShape.closePath();

    const boltGeo = new THREE.ExtrudeGeometry(boltShape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    boltGeo.center();

    const boltMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xeab308,
      emissiveIntensity: 0.55,
      metalness: 0.72,
      roughness: 0.22,
    });
    const boltMesh = new THREE.Mesh(boltGeo, boltMat);
    boltMesh.position.set(2.35, 2.35, -0.95);
    boltMesh.rotation.y = -0.22;
    scene.add(boltMesh);

    // 10 Stepped Illuminated Question Cubes in front arc
    const totalCubes = Math.max(1, Math.min(20, recordCount || 10));
    const cubeEntries: Array<{
      group: THREE.Group;
      cubeMat: THREE.MeshStandardMaterial;
      capMat: THREE.MeshStandardMaterial;
      baseY: number;
    }> = [];

    for (let i = 0; i < totalCubes; i++) {
      const t = totalCubes === 1 ? 0.5 : i / (totalCubes - 1);
      const x = -4.2 + t * 8.4;
      const arcZ = 1.65 - Math.sin(t * Math.PI) * 0.95;
      const stepY = 0.34 + (i % 2) * 0.06;

      const cGroup = new THREE.Group();
      cGroup.position.set(x, stepY, arcZ);

      const cubeMat = new THREE.MeshStandardMaterial({
        color: OUTCOME_HEX.unseen,
        emissive: 0x081326,
        emissiveIntensity: 0.3,
        roughness: 0.28,
        metalness: 0.35,
      });
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.56, 0.62), cubeMat);
      cGroup.add(cube);

      const capMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        metalness: 0.6,
      });
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.09, 0.66), capMat);
      cap.position.y = 0.31;
      cGroup.add(cap);

      scene.add(cGroup);
      cubeEntries.push({ group: cGroup, cubeMat, capMat, baseY: stepY });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      if (!renderer || entries.length === 0) return;
      const rect = entries[0].contentRect;
      if (rect.width <= 0 || rect.height <= 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
    });
    resizeObserver.observe(container);

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

      const safeBudget = Math.max(1000, cur.totalBudgetMs || 20000);
      const ratio = Math.max(0, Math.min(1, cur.remainingMs / safeBudget));
      const isUrgent = cur.phase === 'answering' && cur.remainingMs > 0 && cur.remainingMs <= 5000;
      const isExpired = cur.remainingMs <= 0 && (cur.phase === 'answering' || cur.phase === 'summary');

      // Sweep chronograph hand cleanly with remaining ratio
      const targetAngle = (1 - ratio) * Math.PI * 2;
      handPivot.rotation.z = -targetAngle;

      if (isExpired) {
        handMat.color.setHex(0xf59e0b);
        handMat.emissive.setHex(0xd97706);
        ringMat.color.setHex(0xf59e0b);
        ringMat.emissive.setHex(0xb45309);
      } else if (isUrgent) {
        handMat.color.setHex(0xf43f5e);
        handMat.emissive.setHex(0xe11d48);
        ringMat.color.setHex(0xf43f5e);
        ringMat.emissive.setHex(0xbe123c);
      } else {
        handMat.color.setHex(0x22d3ee);
        handMat.emissive.setHex(0x0891b2);
        ringMat.color.setHex(0x22d3ee);
        ringMat.emissive.setHex(0x06b6d4);
      }

      const ringSpeed = isUrgent ? 1.8 : cur.phase === 'answering' ? 0.75 : 0.25;
      energyRing1.rotation.z += dt * ringSpeed * motionScale;
      energyRing2.rotation.z -= dt * ringSpeed * 0.8 * motionScale;

      boltMesh.position.y = 2.35 + Math.sin(elapsed * 2.1) * 0.12;
      boltMesh.rotation.y = -0.22 + Math.sin(elapsed * 1.1) * 0.14;
      boltMat.emissiveIntensity = cur.streak >= 2 ? 0.95 : 0.55;

      // Update each question cube color & gentle lift
      cubeEntries.forEach((entry, idx) => {
        const rec = cur.records[idx];
        const status: B10Outcome | 'active' = rec
          ? getCubeStatus(rec, idx, cur.currentIndex, cur.phase)
          : 'unseen';
        const hex = OUTCOME_HEX[status];
        entry.cubeMat.color.setHex(hex);
        entry.cubeMat.emissive.setHex(status === 'unseen' ? 0x081326 : hex);
        entry.cubeMat.emissiveIntensity = status === 'active' ? 0.65 : status === 'unseen' ? 0.2 : 0.42;
        entry.capMat.color.setHex(status === 'unseen' ? 0x334155 : hex);
        entry.capMat.emissive.setHex(status === 'unseen' ? 0x0f172a : hex);
        const lift = status === 'active' ? 0.26 + Math.sin(elapsed * 3.2) * 0.06 : 0;
        entry.group.position.y = entry.baseY + lift;
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
      resizeObserver.disconnect();
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
  }, [quality, webglLost, recordCount, onWebGLFallback]);

  if (quality === '2d' || webglLost) {
    return (
      <div className="space-y-1.5">
        {webglLost && (
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-xs font-bold text-amber-100">
            Trình duyệt vừa tạm ngắt WebGL 3D — tự động chuyển sang Bảng tăng tốc 2D mà không mất tiến độ.
          </div>
        )}
        <LightningQuiz2DStage {...props} />
      </div>
    );
  }

  const remainingSec = Math.ceil(remainingMs / 1000);
  const safeTotal = Math.max(1000, totalBudgetMs || 20000);
  const progressPct = Math.max(0, Math.min(100, (remainingMs / safeTotal) * 100));
  const isExpired =
    remainingMs <= 0 &&
    (phase === 'answering' ||
      phase === 'summary' ||
      records[currentIndex]?.outcome === 'timeout');
  const isUrgent = phase === 'answering' && remainingMs > 0 && remainingSec <= 5;

  return (
    <div className="relative w-full h-[210px] sm:h-[235px] rounded-2xl overflow-hidden border border-cyan-500/35 bg-[#050e24] shadow-lg">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top-left Mode & Chronograph Readout (opaque high-contrast badge, NO backdrop-blur over WebGL) */}
      <div className="pointer-events-none absolute top-2.5 left-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/92 border border-amber-400/45 text-xs font-extrabold text-amber-200">
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          <span>Bảng tăng tốc 3D</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950/92 border border-cyan-400/40 text-xs font-bold text-cyan-200">
          {clockMode === 'whole_turn' ? 'Toàn lượt' : '20s / câu'}
        </span>
      </div>

      {/* Top-right Readable Countdown & Explicit "Hết giờ" Text */}
      <div className="pointer-events-none absolute top-2.5 right-3 flex items-center gap-2">
        <div
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-black tabular-nums ${
            isExpired
              ? 'bg-amber-950/95 border-amber-400 text-amber-200'
              : isUrgent
                ? 'bg-rose-950/95 border-rose-400 text-rose-200'
                : 'bg-slate-950/92 border-cyan-400/50 text-cyan-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isExpired ? 'Hết giờ' : `${remainingSec}s`}</span>
        </div>
      </div>

      {/* Bottom Timer Progress Bar + Legend */}
      <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 space-y-1.5">
        <div className="h-2 w-full rounded-full bg-slate-900/95 border border-slate-700/80 overflow-hidden">
          <div
            className={`h-full transition-[width] duration-150 ${
              isExpired
                ? 'bg-amber-400'
                : isUrgent
                  ? 'bg-rose-500'
                  : 'bg-gradient-to-r from-cyan-400 to-sky-400'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-200">
          <span className="px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700">
            Câu {Math.min(currentIndex + 1, Math.max(1, records.length))}/{records.length} · 10 khối sáng tương ứng từng câu
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-slate-950/90 border border-slate-700 text-cyan-200">
            {reducedMotion ? 'Giảm chuyển động' : '3D Studio'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LightningQuiz3DScene;
