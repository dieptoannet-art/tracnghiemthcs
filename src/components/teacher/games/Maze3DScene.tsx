import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  GridPos,
  MazeDirection,
  DIRECTION_ARROWS,
  getCellAt,
  posEquals,
} from './maze3dEngine';

export interface MazeStageProps {
  grid: string[];
  robotPos: GridPos;
  facing: MazeDirection;
  visitedTrail: GridPos[];
  showTrail: boolean;
  lastBlockedPos: GridPos | null;
  hintPos: GridPos | null;
  samplePathCells?: GridPos[];
  completed: boolean;
  reducedMotion: boolean;
  onWebGLFallback?: () => void;
}

function directionToYaw(dir: MazeDirection): number {
  switch (dir) {
    case 'up':
      return Math.PI; // -Z
    case 'down':
      return 0; // +Z
    case 'left':
      return -Math.PI / 2; // -X
    case 'right':
      return Math.PI / 2; // +X
  }
}

function createBadgeTexture(
  letter: string,
  bgHex: string,
  ringHex: string,
  textHex: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = bgHex;
    ctx.beginPath();
    ctx.arc(128, 128, 114, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 14;
    ctx.strokeStyle = ringHex;
    ctx.beginPath();
    ctx.arc(128, 128, 102, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = textHex;
    ctx.font = '800 132px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 128, 134);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCompositeRobot(): {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  antennaOrb: THREE.Mesh;
} {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const ceramicWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.25,
    metalness: 0.1,
  });
  const tealTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    roughness: 0.3,
    metalness: 0.25,
  });
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.65,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.22,
    metalness: 0.8,
    emissive: 0x78350f,
    emissiveIntensity: 0.25,
  });
  const eyeGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.2,
    roughness: 0.15,
  });

  // Base hover/wheel chassis
  const chassis = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.14, 24), darkMetalMat);
  chassis.position.y = 0.09;
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // Side treads
  const wheelGeo = new THREE.BoxGeometry(0.1, 0.16, 0.46);
  const leftWheel = new THREE.Mesh(wheelGeo, tealTrimMat);
  leftWheel.position.set(-0.32, 0.1, 0);
  leftWheel.castShadow = true;
  const rightWheel = new THREE.Mesh(wheelGeo, tealTrimMat);
  rightWheel.position.set(0.32, 0.1, 0);
  rightWheel.castShadow = true;
  bodyGroup.add(leftWheel, rightWheel);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.42), ceramicWhiteMat);
  torso.position.y = 0.34;
  torso.castShadow = true;
  torso.receiveShadow = true;
  bodyGroup.add(torso);

  // Chest teal strip
  const chestTrim = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.44), tealTrimMat);
  chestTrim.position.y = 0.28;
  bodyGroup.add(chestTrim);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.38), ceramicWhiteMat);
  head.position.y = 0.68;
  head.castShadow = true;
  bodyGroup.add(head);

  // Glossy dark visor facing +Z (directionToYaw rotates root so +Z points in facing direction)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.05), darkMetalMat);
  visor.position.set(0, 0.69, 0.19);
  bodyGroup.add(visor);

  // Glowing twin eyes on visor (+Z front)
  const eyeGeo = new THREE.SphereGeometry(0.042, 12, 12);
  const leftEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  leftEye.position.set(-0.09, 0.69, 0.215);
  const rightEye = new THREE.Mesh(eyeGeo, eyeGlowMat);
  rightEye.position.set(0.09, 0.69, 0.215);
  bodyGroup.add(leftEye, rightEye);

  // Front direction nose chevron so orientation is unmistakably clear from top-down camera
  const chevron = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 4), goldMat);
  chevron.rotation.x = Math.PI / 2;
  chevron.position.set(0, 0.28, 0.29);
  bodyGroup.add(chevron);

  // Top gold antenna
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.18, 12), darkMetalMat);
  stem.position.y = 0.91;
  bodyGroup.add(stem);

  const antennaOrb = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 16), goldMat);
  antennaOrb.position.y = 1.03;
  bodyGroup.add(antennaOrb);

  return { root, bodyGroup, antennaOrb };
}

/**
 * 3D Tabletop Maze Diorama using Three.js.
 * - Fixed elevated slightly angled top-down camera showing 100% of the maze at all times.
 * - Ceramic/ivory sculpted walls, bright readable pathways, teal Start pad (S), golden arched Goal portal (E),
 *   composite 3D robot with smooth damped stepping, toggleable visited trail, and BFS hint beacon.
 * - Graceful WebGL fallback when WebGL is unavailable or context is lost.
 */
export const Maze3DScene: React.FC<MazeStageProps> = ({
  grid,
  robotPos,
  facing,
  visitedTrail,
  showTrail,
  lastBlockedPos,
  hintPos,
  samplePathCells = [],
  completed,
  reducedMotion,
  onWebGLFallback,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({
    robotPos,
    facing,
    visitedTrail,
    showTrail,
    lastBlockedPos,
    hintPos,
    samplePathCells,
    completed,
    reducedMotion,
  });

  // Track bump timestamp whenever lastBlockedPos changes to a non-null position
  const bumpPulseRef = useRef<{ pos: GridPos | null; startedAt: number }>({
    pos: null,
    startedAt: 0,
  });

  useEffect(() => {
    const prevBlocked = stateRef.current.lastBlockedPos;
    if (
      lastBlockedPos &&
      (!prevBlocked ||
        prevBlocked.row !== lastBlockedPos.row ||
        prevBlocked.col !== lastBlockedPos.col)
    ) {
      bumpPulseRef.current = { pos: { ...lastBlockedPos }, startedAt: performance.now() };
    } else if (!lastBlockedPos) {
      bumpPulseRef.current = { pos: null, startedAt: 0 };
    }
    stateRef.current = {
      robotPos,
      facing,
      visitedTrail,
      showTrail,
      lastBlockedPos,
      hintPos,
      samplePathCells,
      completed,
      reducedMotion,
    };
  }, [
    robotPos,
    facing,
    visitedTrail,
    showTrail,
    lastBlockedPos,
    hintPos,
    samplePathCells,
    completed,
    reducedMotion,
  ]);

  const gridSignature = grid.join('|');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rows = grid.length;
    const cols = grid[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      onWebGLFallback?.();
      return;
    }

    const gl = renderer.getContext();
    if (!gl) {
      renderer.dispose();
      onWebGLFallback?.();
      return;
    }

    // Detect software WebGL renderer (SwiftShader / llvmpipe / Mesa) for safe frame sync
    const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoftwareGl = /swiftshader|llvmpipe|mesa|software/i.test(rendererStr);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSoftwareGl ? 1 : 1.75));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 420);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const onContextLost = (e: Event) => {
      e.preventDefault();
      onWebGLFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // Scene & lighting
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061024);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x0f172a, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.55);
    keyLight.position.set(cols * 0.7, Math.max(rows, cols) * 1.6 + 4, rows * 0.9);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      const bound = Math.max(rows, cols) * 0.85;
      keyLight.shadow.camera.left = -bound;
      keyLight.shadow.camera.right = bound;
      keyLight.shadow.camera.top = bound;
      keyLight.shadow.camera.bottom = -bound;
      keyLight.shadow.bias = -0.0005;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.55);
    rimLight.position.set(-cols * 0.8, 6, -rows * 0.8);
    scene.add(rimLight);

    // Camera — elevated slightly angled top-down showing ENTIRE maze
    const camera = new THREE.PerspectiveCamera(
      38,
      (container.clientWidth || 640) / (container.clientHeight || 420),
      0.1,
      120
    );

    const fitCamera = (w: number, h: number) => {
      const aspect = Math.max(0.5, w / Math.max(1, h));
      camera.aspect = aspect;
      const fovRad = THREE.MathUtils.degToRad(camera.fov);
      const boardW = cols + 1.3;
      const boardH = rows + 1.5;
      const distForHeight = boardH / (2 * Math.tan(fovRad / 2));
      const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
      const distForWidth = boardW / (2 * Math.tan(hFov / 2));
      const dist = Math.max(distForHeight, distForWidth) * 1.14;
      // Slightly angled from south (+Z) looking north (-Z) so wall 3D height & robot face read clearly
      const tiltAngle = THREE.MathUtils.degToRad(24);
      camera.position.set(0, Math.cos(tiltAngle) * dist, Math.sin(tiltAngle) * dist + 0.35);
      camera.lookAt(0, 0.12, 0.08);
      camera.updateProjectionMatrix();
    };
    fitCamera(container.clientWidth || 640, container.clientHeight || 420);

    // Helpers to map (row, col) -> (x, z) centered at origin
    const cellToWorld = (row: number, col: number): [number, number] => [
      col - (cols - 1) / 2,
      row - (rows - 1) / 2,
    ];

    // Diorama Tabletop Plinth
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x0f1f3d,
      roughness: 0.55,
      metalness: 0.25,
    });
    const trimTealMat = new THREE.MeshStandardMaterial({
      color: 0x0f766e,
      roughness: 0.35,
      metalness: 0.4,
    });
    const goldAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.24,
      metalness: 0.78,
    });

    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(cols + 0.72, 0.42, rows + 0.72),
      plinthMat
    );
    plinth.position.y = -0.25;
    plinth.receiveShadow = true;
    boardGroup.add(plinth);

    const trimFrame = new THREE.Mesh(
      new THREE.BoxGeometry(cols + 0.84, 0.14, rows + 0.84),
      trimTealMat
    );
    trimFrame.position.y = -0.34;
    boardGroup.add(trimFrame);

    // Corner gold studs on tabletop frame
    const studGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.16, 16);
    const halfX = (cols + 0.56) / 2;
    const halfZ = (rows + 0.56) / 2;
    [
      [-halfX, -halfZ],
      [halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, halfZ],
    ].forEach(([sx, sz]) => {
      const stud = new THREE.Mesh(studGeo, goldAccentMat);
      stud.position.set(sx, -0.02, sz);
      boardGroup.add(stud);
    });

    // Shared Maze Materials & Geometries
    const wallBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf1ece1, // warm ivory ceramic/stone
      roughness: 0.42,
      metalness: 0.05,
    });
    const wallCapMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      roughness: 0.32,
      metalness: 0.04,
    });
    const pathTileMatA = new THREE.MeshStandardMaterial({
      color: 0x162b4d, // deep luminous slate-blue floor for crisp contrast vs ivory walls
      roughness: 0.52,
      metalness: 0.12,
    });
    const pathTileMatB = new THREE.MeshStandardMaterial({
      color: 0x1b345c,
      roughness: 0.52,
      metalness: 0.12,
    });

    const wallGeo = new THREE.BoxGeometry(0.94, 0.66, 0.94);
    const wallCapGeo = new THREE.BoxGeometry(0.84, 0.07, 0.84);
    const tileGeo = new THREE.BoxGeometry(0.95, 0.08, 0.95);

    const disposableTextures: THREE.Texture[] = [];
    let goalBeaconRing: THREE.Mesh | null = null;

    // Build cells from single grid source of truth
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = getCellAt(grid, r, c);
        const [wx, wz] = cellToWorld(r, c);

        if (cell === '#') {
          const wall = new THREE.Mesh(wallGeo, wallBodyMat);
          wall.position.set(wx, 0.33, wz);
          wall.castShadow = true;
          wall.receiveShadow = true;
          boardGroup.add(wall);

          const cap = new THREE.Mesh(wallCapGeo, wallCapMat);
          cap.position.set(wx, 0.69, wz);
          cap.receiveShadow = true;
          boardGroup.add(cap);
        } else {
          const tile = new THREE.Mesh(
            tileGeo,
            (r + c) % 2 === 0 ? pathTileMatA : pathTileMatB
          );
          tile.position.set(wx, -0.02, wz);
          tile.receiveShadow = true;
          boardGroup.add(tile);

          if (cell === 'S') {
            const startTex = createBadgeTexture('S', '#0d9488', '#5eead4', '#ffffff');
            disposableTextures.push(startTex);
            const pad = new THREE.Mesh(
              new THREE.CylinderGeometry(0.4, 0.42, 0.05, 28),
              new THREE.MeshStandardMaterial({
                map: startTex,
                roughness: 0.35,
                metalness: 0.1,
              })
            );
            pad.position.set(wx, 0.035, wz);
            boardGroup.add(pad);
          } else if (cell === 'E') {
            const goalTex = createBadgeTexture('E', '#b45309', '#fde68a', '#ffffff');
            disposableTextures.push(goalTex);
            const pad = new THREE.Mesh(
              new THREE.CylinderGeometry(0.42, 0.44, 0.06, 28),
              new THREE.MeshStandardMaterial({
                map: goalTex,
                roughness: 0.25,
                metalness: 0.2,
                emissive: 0x78350f,
                emissiveIntensity: 0.35,
              })
            );
            pad.position.set(wx, 0.04, wz);
            boardGroup.add(pad);

            // Golden Goal Portal Arch
            const portalGroup = new THREE.Group();
            portalGroup.position.set(wx, 0.04, wz);
            const pillarGeo = new THREE.CylinderGeometry(0.06, 0.075, 0.62, 14);
            const pLeft = new THREE.Mesh(pillarGeo, goldAccentMat);
            pLeft.position.set(-0.33, 0.31, -0.1);
            const pRight = new THREE.Mesh(pillarGeo, goldAccentMat);
            pRight.position.set(0.33, 0.31, -0.1);
            const arch = new THREE.Mesh(
              new THREE.TorusGeometry(0.33, 0.055, 14, 28, Math.PI),
              goldAccentMat
            );
            arch.position.set(0, 0.62, -0.1);
            portalGroup.add(pLeft, pRight, arch);

            goalBeaconRing = new THREE.Mesh(
              new THREE.TorusGeometry(0.42, 0.03, 12, 32),
              new THREE.MeshStandardMaterial({
                color: 0xfde047,
                emissive: 0xf59e0b,
                emissiveIntensity: 0.9,
                roughness: 0.2,
              })
            );
            goalBeaconRing.rotation.x = Math.PI / 2;
            goalBeaconRing.position.set(0, 0.14, 0);
            portalGroup.add(goalBeaconRing);

            boardGroup.add(portalGroup);
          }
        }
      }
    }

    // Dynamic overlays group (visited trail, sample path preview, hint ring, blocked wall marker)
    const trailGroup = new THREE.Group();
    scene.add(trailGroup);

    const sampleGroup = new THREE.Group();
    scene.add(sampleGroup);

    // Hint marker mesh (reused)
    const hintRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.045, 12, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.0,
        roughness: 0.2,
      })
    );
    hintRing.rotation.x = Math.PI / 2;
    hintRing.visible = false;
    scene.add(hintRing);

    // Blocked wall warning beacon (reused)
    const blockedMarker = new THREE.Mesh(
      new THREE.BoxGeometry(0.98, 0.78, 0.98),
      new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.85,
        transparent: true,
        opacity: 0.55,
      })
    );
    blockedMarker.visible = false;
    scene.add(blockedMarker);

    // Robot
    const robot = createCompositeRobot();
    const [initX, initZ] = cellToWorld(stateRef.current.robotPos.row, stateRef.current.robotPos.col);
    robot.root.position.set(initX, 0.04, initZ);
    robot.root.rotation.y = directionToYaw(stateRef.current.facing);
    scene.add(robot.root);

    // Reusable trail / sample materials & geos
    const trailBeadGeo = new THREE.CylinderGeometry(0.14, 0.16, 0.05, 16);
    const trailBeadMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x14b8a6,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    const trailLinkMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x0d9488,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const sampleDotGeo = new THREE.SphereGeometry(0.11, 14, 14);
    const sampleDotMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xd97706,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.82,
    });

    let lastTrailSig = '';
    let lastSampleSig = '';

    const rebuildTrailMeshes = (trail: GridPos[], visible: boolean) => {
      while (trailGroup.children.length > 0) {
        const child = trailGroup.children[0];
        trailGroup.remove(child);
        if ((child as THREE.Mesh).geometry && (child as THREE.Mesh).geometry !== trailBeadGeo) {
          (child as THREE.Mesh).geometry.dispose();
        }
      }
      trailGroup.visible = visible;
      if (!visible || trail.length === 0) return;

      const seen = new Set<string>();
      for (let i = 0; i < trail.length; i++) {
        const p = trail[i];
        const key = `${p.row},${p.col}`;
        const [wx, wz] = cellToWorld(p.row, p.col);
        if (!seen.has(key)) {
          seen.add(key);
          const bead = new THREE.Mesh(trailBeadGeo, trailBeadMat);
          bead.position.set(wx, 0.055, wz);
          trailGroup.add(bead);
        }
        if (i > 0) {
          const prev = trail[i - 1];
          const [px, pz] = cellToWorld(prev.row, prev.col);
          const dx = wx - px;
          const dz = wz - pz;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.01) {
            const linkGeo = new THREE.BoxGeometry(0.1, 0.035, dist);
            const link = new THREE.Mesh(linkGeo, trailLinkMat);
            link.position.set((wx + px) / 2, 0.05, (wz + pz) / 2);
            link.rotation.y = Math.atan2(dx, dz);
            trailGroup.add(link);
          }
        }
      }
    };

    const rebuildSampleMeshes = (cells: GridPos[]) => {
      while (sampleGroup.children.length > 0) {
        sampleGroup.remove(sampleGroup.children[0]);
      }
      if (!cells || cells.length === 0) return;
      for (const p of cells) {
        const [wx, wz] = cellToWorld(p.row, p.col);
        const dot = new THREE.Mesh(sampleDotGeo, sampleDotMat);
        dot.position.set(wx, 0.14, wz);
        sampleGroup.add(dot);
      }
    };

    // ResizeObserver for clean responsive fitting
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !renderer) return;
      const w = Math.max(240, Math.floor(entry.contentRect.width));
      const h = Math.max(220, Math.floor(entry.contentRect.height));
      renderer.setSize(w, h);
      fitCamera(w, h);
    });
    ro.observe(container);

    // Animation loop
    let rafId = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const cur = stateRef.current;

      // Sync trail & sample overlays only when changed
      const trailSig = `${cur.showTrail ? 1 : 0}:${cur.visitedTrail
        .map((p) => `${p.row},${p.col}`)
        .join(';')}`;
      if (trailSig !== lastTrailSig) {
        lastTrailSig = trailSig;
        rebuildTrailMeshes(cur.visitedTrail, cur.showTrail);
      }

      const sampleSig = cur.samplePathCells.map((p) => `${p.row},${p.col}`).join(';');
      if (sampleSig !== lastSampleSig) {
        lastSampleSig = sampleSig;
        rebuildSampleMeshes(cur.samplePathCells);
      }

      // Target robot world position (+ brief bump recoil if recently blocked)
      let [targetX, targetZ] = cellToWorld(cur.robotPos.row, cur.robotPos.col);
      const bump = bumpPulseRef.current;
      const bumpAge = (now - bump.startedAt) / 1000;
      if (bump.pos && bumpAge >= 0 && bumpAge < 0.36 && !cur.reducedMotion) {
        const [bx, bz] = cellToWorld(bump.pos.row, bump.pos.col);
        const pulse = Math.sin((bumpAge / 0.36) * Math.PI) * 0.22;
        targetX += (bx - targetX) * pulse;
        targetZ += (bz - targetZ) * pulse;
      }

      if (cur.reducedMotion) {
        robot.root.position.set(targetX, 0.04, targetZ);
        robot.root.rotation.y = directionToYaw(cur.facing);
        robot.bodyGroup.position.y = 0;
      } else {
        robot.root.position.x = THREE.MathUtils.damp(robot.root.position.x, targetX, 14, dt);
        robot.root.position.z = THREE.MathUtils.damp(robot.root.position.z, targetZ, 14, dt);

        // Shortest-angle yaw damping
        const targetYaw = directionToYaw(cur.facing);
        let diff = targetYaw - robot.root.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        robot.root.rotation.y += diff * (1 - Math.exp(-14 * dt));

        // Gentle idle bob or victory celebration bounce
        if (cur.completed) {
          robot.bodyGroup.position.y = Math.abs(Math.sin(now * 0.006)) * 0.16;
        } else {
          robot.bodyGroup.position.y = Math.sin(now * 0.0035) * 0.025;
        }
      }

      // Goal beacon subtle pulse
      if (goalBeaconRing) {
        if (cur.reducedMotion) {
          goalBeaconRing.scale.set(1, 1, 1);
          goalBeaconRing.position.y = 0.14;
        } else {
          const s = 1 + Math.sin(now * 0.004) * 0.07;
          goalBeaconRing.scale.set(s, s, 1);
          goalBeaconRing.position.y = 0.14 + Math.sin(now * 0.003) * 0.05;
        }
      }

      // Hint ring
      if (cur.hintPos) {
        const [hx, hz] = cellToWorld(cur.hintPos.row, cur.hintPos.col);
        hintRing.visible = true;
        hintRing.position.set(hx, 0.14, hz);
        const hs = cur.reducedMotion ? 1 : 1 + Math.sin(now * 0.007) * 0.12;
        hintRing.scale.set(hs, hs, 1);
      } else {
        hintRing.visible = false;
      }

      // Blocked wall highlight
      if (cur.lastBlockedPos) {
        const inBounds =
          cur.lastBlockedPos.row >= 0 &&
          cur.lastBlockedPos.row < rows &&
          cur.lastBlockedPos.col >= 0 &&
          cur.lastBlockedPos.col < cols;
        if (inBounds) {
          const [bx, bz] = cellToWorld(cur.lastBlockedPos.row, cur.lastBlockedPos.col);
          blockedMarker.visible = true;
          blockedMarker.position.set(bx, 0.36, bz);
        } else {
          blockedMarker.visible = false;
        }
      } else {
        blockedMarker.visible = false;
      }

      renderer!.render(scene, camera);

      // Software WebGL frame sync fence
      if (isSoftwareGl && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        if (sync) {
          gl.flush();
          gl.deleteSync(sync);
        }
      }
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer?.domElement.removeEventListener('webglcontextlost', onContextLost);

      disposableTextures.forEach((t) => t.dispose());
      envRT.dispose();

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
      if (container) container.innerHTML = '';
    };
  }, [gridSignature, onWebGLFallback]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[320px] rounded-xl overflow-hidden bg-[#061024]"
      aria-label="Sa bàn mê cung 3D"
    />
  );
};

/**
 * High-contrast 2D Top-Down SVG/Grid Board.
 * Used as automatic fallback when WebGL is unavailable, or when user selects "2D nhẹ".
 * Distinct shapes + colors ensure clear readability on bright projectors and for colorblind learners.
 */
export const Maze2DBoard: React.FC<MazeStageProps> = ({
  grid,
  robotPos,
  facing,
  visitedTrail,
  showTrail,
  lastBlockedPos,
  hintPos,
  samplePathCells = [],
  completed,
}) => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const cellSize = 56;
  const pad = 28;
  const svgW = cols * cellSize + pad * 2;
  const svgH = rows * cellSize + pad * 2;

  const centerOf = (p: GridPos) => ({
    x: pad + p.col * cellSize + cellSize / 2,
    y: pad + p.row * cellSize + cellSize / 2,
  });

  const trailPoints =
    showTrail && visitedTrail.length > 1
      ? visitedTrail
          .map((p) => {
            const c = centerOf(p);
            return `${c.x},${c.y}`;
          })
          .join(' ')
      : '';

  const samplePoints =
    samplePathCells.length > 1
      ? samplePathCells
          .map((p) => {
            const c = centerOf(p);
            return `${c.x},${c.y}`;
          })
          .join(' ')
      : '';

  const robotCenter = centerOf(robotPos);

  return (
    <div className="w-full h-full min-h-[320px] flex items-center justify-center bg-[#061024] rounded-xl p-2 sm:p-3 overflow-hidden">
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-full max-h-[520px] select-none"
        role="img"
        aria-label="Bản đồ mê cung 2D nhìn từ trên xuống"
      >
        <defs>
          <pattern id="f04WallHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#d6cfc2" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Outer frame */}
        <rect
          x={pad - 6}
          y={pad - 6}
          width={cols * cellSize + 12}
          height={rows * cellSize + 12}
          rx={12}
          fill="#0b1a36"
          stroke="#14b8a6"
          strokeWidth={3}
        />

        {/* Column indices (1..cols) */}
        {Array.from({ length: cols }).map((_, c) => (
          <text
            key={`col-${c}`}
            x={pad + c * cellSize + cellSize / 2}
            y={pad - 11}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="12"
            fontWeight="700"
          >
            {c + 1}
          </text>
        ))}

        {/* Row indices (1..rows) */}
        {Array.from({ length: rows }).map((_, r) => (
          <text
            key={`row-${r}`}
            x={pad - 13}
            y={pad + r * cellSize + cellSize / 2 + 4}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="12"
            fontWeight="700"
          >
            {r + 1}
          </text>
        ))}

        {/* Maze Cells */}
        {grid.map((line, r) =>
          Array.from(line).map((ch, c) => {
            const x = pad + c * cellSize;
            const y = pad + r * cellSize;
            const isBlocked = lastBlockedPos && lastBlockedPos.row === r && lastBlockedPos.col === c;
            const isHint = hintPos && hintPos.row === r && hintPos.col === c;

            if (ch === '#') {
              return (
                <g key={`cell-${r}-${c}`}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={cellSize - 4}
                    height={cellSize - 4}
                    rx={6}
                    fill={isBlocked ? '#f43f5e' : '#f1ece1'}
                    stroke={isBlocked ? '#fda4af' : '#cbd5e1'}
                    strokeWidth={2}
                  />
                  {!isBlocked && (
                    <rect
                      x={x + 6}
                      y={y + 6}
                      width={cellSize - 12}
                      height={cellSize - 12}
                      rx={4}
                      fill="url(#f04WallHatch)"
                      opacity={0.55}
                    />
                  )}
                  {isBlocked && (
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 6}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="20"
                      fontWeight="900"
                    >
                      ✕
                    </text>
                  )}
                </g>
              );
            }

            return (
              <g key={`cell-${r}-${c}`}>
                <rect
                  x={x + 1.5}
                  y={y + 1.5}
                  width={cellSize - 3}
                  height={cellSize - 3}
                  rx={5}
                  fill={(r + c) % 2 === 0 ? '#132645' : '#172e52'}
                  stroke="#1e3a66"
                  strokeWidth={1}
                />

                {ch === 'S' && (
                  <g>
                    <circle
                      cx={x + cellSize / 2}
                      cy={y + cellSize / 2}
                      r={20}
                      fill="#0d9488"
                      stroke="#5eead4"
                      strokeWidth={2.5}
                    />
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 6}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="18"
                      fontWeight="900"
                    >
                      S
                    </text>
                  </g>
                )}

                {ch === 'E' && (
                  <g>
                    <rect
                      x={x + 8}
                      y={y + 8}
                      width={cellSize - 16}
                      height={cellSize - 16}
                      rx={10}
                      fill="#b45309"
                      stroke="#fde047"
                      strokeWidth={3}
                    />
                    <text
                      x={x + cellSize / 2}
                      y={y + cellSize / 2 + 6}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="18"
                      fontWeight="900"
                    >
                      E
                    </text>
                  </g>
                )}

                {isHint && (
                  <circle
                    cx={x + cellSize / 2}
                    cy={y + cellSize / 2}
                    r={21}
                    fill="rgba(251, 191, 36, 0.22)"
                    stroke="#fbbf24"
                    strokeWidth={3}
                    strokeDasharray="6 4"
                  />
                )}
              </g>
            );
          })
        )}

        {/* Optional sample path preview (only when toggled on) */}
        {samplePoints && (
          <polyline
            points={samplePoints}
            fill="none"
            stroke="#fde047"
            strokeWidth={4}
            strokeDasharray="8 6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.78}
          />
        )}

        {/* Visited trail */}
        {trailPoints && (
          <g>
            <polyline
              points={trailPoints}
              fill="none"
              stroke="#2dd4bf"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
            {visitedTrail.map((p, idx) => {
              if (posEquals(p, robotPos)) return null;
              const c = centerOf(p);
              return (
                <circle
                  key={`trail-${idx}`}
                  cx={c.x}
                  cy={c.y}
                  r={5.5}
                  fill="#5eead4"
                  stroke="#0f172a"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        )}

        {/* Robot */}
        <g transform={`translate(${robotCenter.x}, ${robotCenter.y})`}>
          <circle
            r={21}
            fill={completed ? '#f59e0b' : '#f8fafc'}
            stroke={completed ? '#fef08a' : '#14b8a6'}
            strokeWidth={3.5}
          />
          <circle cx={-6} cy={-5} r={2.8} fill="#0f172a" />
          <circle cx={6} cy={-5} r={2.8} fill="#0f172a" />
          <text
            x={0}
            y={12}
            textAnchor="middle"
            fill="#0f172a"
            fontSize="16"
            fontWeight="900"
          >
            {DIRECTION_ARROWS[facing]}
          </text>
        </g>
      </svg>
    </div>
  );
};
