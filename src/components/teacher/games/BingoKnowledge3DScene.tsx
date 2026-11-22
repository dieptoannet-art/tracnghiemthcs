import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Award, CheckCircle2, Grid, Lock, Star } from 'lucide-react';
import { MathView } from '../../MathView';
import {
  C09BingoCard,
  C09GraphicsQuality,
  C09Phase,
  C09WinPatternConfig,
  getC09WinningLines,
} from './bingoKnowledge3dEngine';

export interface BingoKnowledgeSceneProps {
  card: C09BingoCard | null;
  dimension: 3 | 4 | 5;
  publishedAnswerIds: string[];
  winPatterns: C09WinPatternConfig;
  phase: C09Phase;
  verificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
  quality: C09GraphicsQuality;
  reducedMotion: boolean;
  focusedCellIndex: number;
  onToggleCell: (cellIndex: number) => void;
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

function buildLotteryCageGroup(): {
  root: THREE.Group;
  drum: THREE.Group;
} {
  const root = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.24,
    metalness: 0.88,
  });
  const darkWoodMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.65,
    metalness: 0.15,
  });

  // Base stand
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 1.15), darkWoodMat);
  plinth.position.y = 0.09;
  root.add(plinth);

  const leftStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.35, 10), brassMat);
  leftStrut.position.set(-0.62, 0.82, 0);
  const rightStrut = leftStrut.clone();
  rightStrut.position.x = 0.62;
  root.add(leftStrut, rightStrut);

  const drum = new THREE.Group();
  drum.position.set(0, 1.25, 0);

  // Cage rings
  for (const xOff of [-0.46, 0, 0.46]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.025, 8, 28), brassMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = xOff;
    drum.add(ring);
  }

  // Cage longitudinal bars
  for (let b = 0; b < 10; b++) {
    const angle = (b / 10) * Math.PI * 2;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.96, 6), brassMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, Math.sin(angle) * 0.55, Math.cos(angle) * 0.55);
    drum.add(bar);
  }

  // Pearl & Sapphire Bingo balls inside drum
  const sphereGeo = new THREE.SphereGeometry(0.11, 14, 14);
  const ballColors = [0x38bdf8, 0xfbbf24, 0xf8fafc, 0x0ea5e9, 0x10b981, 0xe2e8f0];
  for (let i = 0; i < 8; i++) {
    const ballMat = new THREE.MeshStandardMaterial({
      color: ballColors[i % ballColors.length],
      roughness: 0.25,
      metalness: 0.2,
    });
    const ball = new THREE.Mesh(sphereGeo, ballMat);
    const a = i * 0.92;
    ball.position.set(
      ((i % 3) - 1) * 0.18,
      -0.2 + Math.sin(a) * 0.14,
      Math.cos(a) * 0.2
    );
    drum.add(ball);
  }

  root.add(drum);
  return { root, drum };
}

export const BingoKnowledge2DStage: React.FC<BingoKnowledgeSceneProps> = ({
  card,
  dimension,
  publishedAnswerIds,
  winPatterns,
  verificationStatus,
  focusedCellIndex,
  onToggleCell,
}) => {
  const publishedSet = new Set(publishedAnswerIds);
  const winningLines = getC09WinningLines(dimension, winPatterns);
  const completedLineCellSet = new Set<number>();

  if (card) {
    for (const line of winningLines) {
      const ok = line.cellIndices.every((idx) => {
        const c = card.cells[idx];
        return c ? c.isFreeCenter || (c.answerId !== null && publishedSet.has(c.answerId)) : false;
      });
      if (ok) {
        line.cellIndices.forEach((idx) => completedLineCellSet.add(idx));
      }
    }
  }

  if (!card) {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center bg-[#09152E] text-slate-300 p-6 text-center">
        <Grid className="w-10 h-10 text-amber-400 mb-3" />
        <p className="text-base font-semibold text-white">Chưa khởi tạo phiếu Bingo</p>
        <p className="text-xs text-slate-400 mt-1">
          Chọn kích thước 3×3, 4×4 hoặc 5×5 và bấm Bắt đầu để hiển thị bảng trình chiếu.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col justify-between bg-[#08132B] p-3 sm:p-4 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-700/70">
        <div className="text-xs sm:text-sm font-semibold text-amber-300">
          {card.holderLabel} · Bảng {dimension}×{dimension}
        </div>
        <div className="text-xs text-slate-300 font-mono tabular-nums">
          Đã công bố: {publishedAnswerIds.length} đáp án
          {verificationStatus === 'verified' && card.hasVerifiedBingo ? ' · BINGO HỢP LỆ' : ''}
        </div>
      </div>

      <div
        className="my-auto mx-auto w-full max-w-[460px] grid gap-2 py-2"
        style={{ gridTemplateColumns: `repeat(${dimension}, minmax(0, 1fr))` }}
      >
        {card.cells.map((cell) => {
          const isPublished =
            cell.isFreeCenter ||
            (cell.answerId !== null && publishedSet.has(cell.answerId));
          const isInWinningLine = completedLineCellSet.has(cell.cellIndex);
          const isFocused = focusedCellIndex === cell.cellIndex;
          const isPremature = cell.marked && !isPublished && !cell.isFreeCenter;

          return (
            <button
              key={cell.cellIndex}
              type="button"
              onClick={() => onToggleCell(cell.cellIndex)}
              aria-label={`Ô ${cell.answerPlainText}`}
              className={`relative min-h-[56px] sm:min-h-[68px] rounded-xl border-2 px-1.5 py-2 flex flex-col items-center justify-center text-center transition-transform duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isInWinningLine && card.hasVerifiedBingo
                  ? 'bg-amber-500/25 border-amber-400 text-amber-100 shadow-sm'
                  : cell.marked && isPublished
                    ? 'bg-emerald-600/25 border-emerald-400 text-emerald-100'
                    : isPremature
                      ? 'bg-rose-900/35 border-rose-400 text-rose-100'
                      : isPublished
                        ? 'bg-sky-900/40 border-sky-400 text-sky-100 hover:bg-sky-800/50'
                        : 'bg-slate-800/80 border-slate-600/80 text-slate-100 hover:border-amber-400/70'
              } ${isFocused ? 'ring-2 ring-amber-300 ring-offset-2 ring-offset-[#08132B]' : ''}`}
            >
              <span className="text-[10px] font-mono text-slate-400 leading-none mb-1">
                {String.fromCharCode(65 + cell.col)}
                {cell.row + 1}
              </span>
              <span className="text-sm sm:text-base font-bold leading-tight break-words max-w-full">
                {cell.isFreeCenter ? (
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Star className="w-3.5 h-3.5" />
                    Miễn phí
                  </span>
                ) : (
                  <MathView content={cell.answerText} />
                )}
              </span>
              <span className="mt-1 text-[10px] font-semibold">
                {cell.isFreeCenter ? (
                  <span className="text-amber-300">Tâm bảng</span>
                ) : isPremature ? (
                  <span className="text-rose-300">Đánh trước đáp án</span>
                ) : cell.marked && isPublished ? (
                  <span className="inline-flex items-center gap-0.5 text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Đã khớp
                  </span>
                ) : isPublished ? (
                  <span className="text-sky-300">Được phép đánh dấu</span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-slate-400">
                    <Lock className="w-2.5 h-2.5" /> Chờ công bố
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 border-t border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>Chế độ 2D nhẹ · Bấm ô hoặc dùng phím mũi tên + Space để đánh dấu</span>
        {card.hasVerifiedBingo && (
          <span className="inline-flex items-center gap-1 font-bold text-amber-300">
            <Award className="w-3.5 h-3.5" />
            Đã xác nhận: {card.winningLineLabels.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
};

export const BingoKnowledge3DScene: React.FC<BingoKnowledgeSceneProps> = (props) => {
  const {
    card,
    dimension,
    publishedAnswerIds,
    winPatterns,
    verificationStatus,
    quality,
    reducedMotion,
    focusedCellIndex,
    onToggleCell,
    onWebGLFallback,
  } = props;

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  const latestPropsRef = useRef(props);
  latestPropsRef.current = props;

  // Store 3D meshes by cellIndex so React updates mutate PBR materials smoothly without teardown
  const cellVisualsRef = useRef<
    Array<{
      tileMesh: THREE.Mesh;
      gemMesh: THREE.Mesh;
      tileMat: THREE.MeshStandardMaterial;
      gemMat: THREE.MeshStandardMaterial;
    }>
  >([]);
  const cageDrumRef = useRef<THREE.Group | null>(null);
  const rebuildBoardRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (quality === '2d' || webglLost) return;
    const mount = canvasMountRef.current;
    if (!mount) return;

    let disposed = false;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let pmremGen: THREE.PMREMGenerator | null = null;
    let envTexture: THREE.Texture | null = null;

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

      const width = Math.max(320, mount.clientWidth || 640);
      const height = Math.max(240, mount.clientHeight || 360);
      renderer.setSize(width, height);
      mount.innerHTML = '';
      mount.appendChild(renderer.domElement);

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setWebglLost(true);
        onWebGLFallback?.();
      };
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x061026);
      scene.fog = new THREE.FogExp2(0x061026, 0.048);

      pmremGen = new THREE.PMREMGenerator(renderer);
      envTexture = pmremGen.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTexture;
      pmremGen.dispose();
      pmremGen = null;

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
      camera.position.set(0, 4.9, 6.2);
      camera.lookAt(0, 0.55, 0);

      // Balanced Warm/Cool Studio Lighting
      const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.75);
      const keyLight = new THREE.DirectionalLight(0xfff4d6, 2.2);
      keyLight.position.set(4.5, 7.5, 5.2);
      if (!isSoftwareGl) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.left = -5;
        keyLight.shadow.camera.right = 5;
        keyLight.shadow.camera.top = 5;
        keyLight.shadow.camera.bottom = -5;
        keyLight.shadow.bias = -0.0005;
        keyLight.shadow.normalBias = 0.02;
      }
      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.05);
      rimLight.position.set(-4.5, 3.2, -4.0);
      scene.add(hemi, keyLight, rimLight);

      // Studio Tabletop & Contact Grounding
      const tableMat = new THREE.MeshStandardMaterial({
        color: 0x0b1a36,
        roughness: 0.78,
        metalness: 0.12,
      });
      const tableMesh = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.2, 0.3, 40), tableMat);
      tableMesh.position.y = -0.15;
      tableMesh.receiveShadow = true;
      scene.add(tableMesh);

      const boardRoot = new THREE.Group();
      boardRoot.position.set(-0.85, 0.04, 0.15);
      boardRoot.rotation.x = -0.35;
      scene.add(boardRoot);

      const { root: cageGroup, drum: cageDrum } = buildLotteryCageGroup();
      cageGroup.position.set(2.85, 0.02, -0.35);
      cageGroup.rotation.y = -0.38;
      scene.add(cageGroup);
      cageDrumRef.current = cageDrum;

      const buildBoardGeometry = () => {
        while (boardRoot.children.length > 0) {
          const child = boardRoot.children.pop()!;
          boardRoot.remove(child);
        }
        cellVisualsRef.current = [];

        const d = latestPropsRef.current.dimension;
        const boardSize = 3.55;
        const framePad = 0.28;

        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.55,
          metalness: 0.35,
        });
        const trimMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.25,
          metalness: 0.85,
        });

        const baseSlab = new THREE.Mesh(
          new THREE.BoxGeometry(boardSize + framePad, 0.22, boardSize + framePad),
          baseMat
        );
        baseSlab.position.y = 0.11;
        baseSlab.receiveShadow = true;
        baseSlab.castShadow = true;
        boardRoot.add(baseSlab);

        const rimBar = new THREE.Mesh(
          new THREE.BoxGeometry(boardSize + framePad + 0.08, 0.08, boardSize + framePad + 0.08),
          trimMat
        );
        rimBar.position.y = 0.21;
        boardRoot.add(rimBar);

        const step = (boardSize - 0.18) / d;
        const tileW = step * 0.84;
        const tileGeo = new THREE.BoxGeometry(tileW, 0.12, tileW);
        const gemGeo = new THREE.OctahedronGeometry(tileW * 0.28, 0);

        for (let r = 0; r < d; r++) {
          for (let c = 0; c < d; c++) {
            const tileMat = new THREE.MeshStandardMaterial({
              color: 0x0f2547,
              roughness: 0.42,
              metalness: 0.22,
            });
            const tileMesh = new THREE.Mesh(tileGeo, tileMat);
            const x = (c - (d - 1) / 2) * step;
            const z = (r - (d - 1) / 2) * step;
            tileMesh.position.set(x, 0.28, z);
            tileMesh.castShadow = true;
            tileMesh.receiveShadow = true;

            const gemMat = new THREE.MeshStandardMaterial({
              color: 0xfbbf24,
              emissive: 0x000000,
              emissiveIntensity: 0,
              roughness: 0.18,
              metalness: 0.72,
            });
            const gemMesh = new THREE.Mesh(gemGeo, gemMat);
            gemMesh.position.set(x, 0.42, z);
            gemMesh.visible = false;

            boardRoot.add(tileMesh, gemMesh);
            cellVisualsRef.current.push({ tileMesh, gemMesh, tileMat, gemMat });
          }
        }
      };

      buildBoardGeometry();
      rebuildBoardRef.current = buildBoardGeometry;

      const handleResize = () => {
        if (!mount || !renderer) return;
        const w = Math.max(320, mount.clientWidth || 640);
        const h = Math.max(240, mount.clientHeight || 360);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', handleResize);

      const clock = new THREE.Clock();
      let elapsedAnim = 0;

      const afterDraw = (cb: () => void) => {
        if (disposed || !renderer) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
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
        const current = latestPropsRef.current;
        if (!current.reducedMotion) {
          elapsedAnim += dt;
        }

        // Spin lottery drum gently when not in reducedMotion
        if (cageDrumRef.current && !current.reducedMotion) {
          const spinRate = current.phase === 'question_revealed' ? 1.65 : 0.35;
          cageDrumRef.current.rotation.z += dt * spinRate;
        }

        // Update board tile & crystal gem states
        const pubSet = new Set(current.publishedAnswerIds);
        const lines = getC09WinningLines(current.dimension, current.winPatterns);
        const winCellSet = new Set<number>();
        if (current.card?.hasVerifiedBingo) {
          for (const line of lines) {
            const ok = line.cellIndices.every((idx) => {
              const cell = current.card?.cells[idx];
              return cell
                ? cell.isFreeCenter || (cell.answerId !== null && pubSet.has(cell.answerId))
                : false;
            });
            if (ok) line.cellIndices.forEach((idx) => winCellSet.add(idx));
          }
        }

        const cells = current.card?.cells || [];
        cellVisualsRef.current.forEach((vis, idx) => {
          const cell = cells[idx];
          if (!cell) return;
          const isPublished =
            cell.isFreeCenter || (cell.answerId !== null && pubSet.has(cell.answerId));
          const isWin = winCellSet.has(idx);
          const isFocused = current.focusedCellIndex === idx;
          const isPremature = cell.marked && !isPublished && !cell.isFreeCenter;

          if (isWin) {
            vis.tileMat.color.setHex(0x92400e);
            vis.tileMat.emissive.setHex(0xd97706);
            vis.tileMat.emissiveIntensity = 0.48;
            vis.gemMesh.visible = true;
            vis.gemMat.color.setHex(0xfde047);
            vis.gemMat.emissive.setHex(0xf59e0b);
            vis.gemMat.emissiveIntensity = 0.65;
          } else if (cell.marked && isPublished) {
            vis.tileMat.color.setHex(0x065f46);
            vis.tileMat.emissive.setHex(0x10b981);
            vis.tileMat.emissiveIntensity = 0.25;
            vis.gemMesh.visible = true;
            vis.gemMat.color.setHex(0x34d399);
            vis.gemMat.emissive.setHex(0x059669);
            vis.gemMat.emissiveIntensity = 0.4;
          } else if (isPremature) {
            vis.tileMat.color.setHex(0x7f1d1d);
            vis.tileMat.emissive.setHex(0xef4444);
            vis.tileMat.emissiveIntensity = 0.28;
            vis.gemMesh.visible = true;
            vis.gemMat.color.setHex(0xfca5a5);
            vis.gemMat.emissive.setHex(0x991b1b);
            vis.gemMat.emissiveIntensity = 0.2;
          } else if (isPublished) {
            vis.tileMat.color.setHex(0x0369a1);
            vis.tileMat.emissive.setHex(0x38bdf8);
            vis.tileMat.emissiveIntensity = 0.2;
            vis.gemMesh.visible = false;
          } else {
            vis.tileMat.color.setHex(isFocused ? 0x1e3a8a : 0x0f2547);
            vis.tileMat.emissive.setHex(isFocused ? 0xf59e0b : 0x000000);
            vis.tileMat.emissiveIntensity = isFocused ? 0.18 : 0;
            vis.gemMesh.visible = cell.isFreeCenter;
          }

          if (vis.gemMesh.visible && !current.reducedMotion) {
            vis.gemMesh.rotation.y = elapsedAnim * 1.4 + idx * 0.3;
          }
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
        window.removeEventListener('resize', handleResize);
        renderer?.domElement.removeEventListener('webglcontextlost', handleContextLost);
        envTexture?.dispose();
        renderer?.dispose();
        if (mount) mount.innerHTML = '';
      };
    } catch {
      setWebglLost(true);
      onWebGLFallback?.();
    }
  }, [quality, webglLost, onWebGLFallback]);

  useEffect(() => {
    rebuildBoardRef.current?.();
  }, [dimension]);

  if (quality === '2d' || webglLost) {
    return <BingoKnowledge2DStage {...props} />;
  }

  // Hybrid 3D Diorama + crisp interactive semantic grid overlay so math/KaTeX text is razor-sharp & keyboard-accessible
  const publishedSet = new Set(publishedAnswerIds);

  return (
    <div className="relative w-full h-full min-h-[320px] bg-[#061026] overflow-hidden flex flex-col">
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full pointer-events-none opacity-85"
        aria-hidden="true"
      />

      {/* Crisp Semantic DOM Board Overlay separated from canvas pixels */}
      <div className="relative z-10 flex-1 flex flex-col justify-between p-3 sm:p-4 bg-slate-950/35">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200 pb-2 border-b border-white/15">
          <span className="font-semibold text-amber-300">
            {card ? `${card.holderLabel} · ${dimension}×${dimension}` : `Bảng ${dimension}×${dimension}`}
          </span>
          <span className="font-mono tabular-nums text-slate-300">
            Đã công bố: {publishedAnswerIds.length} ·{' '}
            {verificationStatus === 'verified'
              ? 'Bingo đã xác nhận'
              : verificationStatus === 'rejected'
                ? 'Kiểm tra chưa đạt'
                : 'Sẵn sàng kiểm phiếu'}
          </span>
        </div>

        {card && (
          <div
            className="my-auto mx-auto w-full max-w-[440px] grid gap-1.5 sm:gap-2 py-2"
            style={{ gridTemplateColumns: `repeat(${dimension}, minmax(0, 1fr))` }}
          >
            {card.cells.map((cell) => {
              const isPublished =
                cell.isFreeCenter ||
                (cell.answerId !== null && publishedSet.has(cell.answerId));
              const isFocused = focusedCellIndex === cell.cellIndex;
              const isPremature = cell.marked && !isPublished && !cell.isFreeCenter;

              return (
                <button
                  key={cell.cellIndex}
                  type="button"
                  onClick={() => onToggleCell(cell.cellIndex)}
                  aria-label={`Ô ${cell.answerPlainText}`}
                  className={`min-h-[52px] sm:min-h-[64px] rounded-xl border px-1.5 py-1.5 flex flex-col items-center justify-center text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    cell.marked && isPublished
                      ? 'bg-emerald-950/85 border-emerald-400 text-emerald-100'
                      : isPremature
                        ? 'bg-rose-950/85 border-rose-400 text-rose-100'
                        : isPublished
                          ? 'bg-sky-950/85 border-sky-400 text-sky-100 hover:bg-sky-900/90'
                          : 'bg-slate-900/80 border-slate-600/80 text-white hover:border-amber-400/80'
                  } ${isFocused ? 'ring-2 ring-amber-300' : ''}`}
                >
                  <span className="text-[10px] font-mono text-slate-400 leading-none mb-0.5">
                    {String.fromCharCode(65 + cell.col)}
                    {cell.row + 1}
                  </span>
                  <span className="text-sm sm:text-base font-bold leading-tight">
                    {cell.isFreeCenter ? (
                      <span className="inline-flex items-center gap-1 text-amber-300">
                        <Star className="w-3.5 h-3.5" />
                        Free
                      </span>
                    ) : (
                      <MathView content={cell.answerText} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[11px] text-slate-300">
          <span>Sân khấu Bingo 3D · Chuột, chạm hoặc phím mũi tên + Space</span>
          <span className="font-mono tabular-nums text-amber-300">
            {card?.hasVerifiedBingo ? `Thắng: ${card.winningLineLabels.join(', ')}` : 'Chế độ 3D'}
          </span>
        </div>
      </div>
    </div>
  );
};
