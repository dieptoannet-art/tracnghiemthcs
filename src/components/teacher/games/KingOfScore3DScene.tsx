import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  KING_TEAM_PALETTES,
  KingBoardTile,
  KingTeamConfig,
  KingTeamRuntime,
} from './kingOfScore3dEngine';

export interface KingOfScoreStageProps {
  tiles: KingBoardTile[];
  teams: KingTeamConfig[];
  teamRuntime: Record<string, KingTeamRuntime>;
  activeTileId: string | null;
  maxPossibleScore: number;
  isQuestionOpen: boolean;
  isFinished: boolean;
  scorePulseNonce: number;
  skipAnimationNonce: number;
  reducedMotion: boolean;
  interactiveBoard: boolean;
  onSelectTile?: (tileId: string) => void;
  onWebglFallback?: () => void;
}

const _rayPointer = new THREE.Vector2();

function detectSoftwareGl(): boolean {
  if (typeof document === 'undefined') return true;
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
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

export function isWebglSupported(): boolean {
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

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function createTileLabelTexture(
  points: number,
  status: 'unplayed' | 'playing' | 'played',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Background fill
    const grad = ctx.createLinearGradient(0, 0, 256, 192);
    if (status === 'playing') {
      grad.addColorStop(0, '#F59E0B');
      grad.addColorStop(1, '#B45309');
    } else if (status === 'played') {
      grad.addColorStop(0, '#0F1E36');
      grad.addColorStop(1, '#091326');
    } else {
      grad.addColorStop(0, '#0F3B52');
      grad.addColorStop(1, '#0A223D');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 192);

    // Subtle inset border
    ctx.strokeStyle =
      status === 'playing'
        ? '#FEF08A'
        : status === 'played'
          ? 'rgba(148, 163, 184, 0.25)'
          : 'rgba(94, 234, 212, 0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 172);

    // Point number
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle =
      status === 'playing' ? '#071226' : status === 'played' ? '#64748B' : '#FACC15';
    ctx.font = '800 84px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(String(points), 128, 86);

    // Subtle status footer text
    ctx.fillStyle =
      status === 'playing' ? '#071226' : status === 'played' ? '#94A3B8' : '#E2E8F0';
    ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
    const label =
      status === 'playing' ? 'ĐANG CHƠI' : status === 'played' ? 'ĐÃ CHƠI' : 'ĐIỂM';
    ctx.fillText(label, 128, 146);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

function buildGoldenTrophyGroup(
  goldMat: THREE.MeshStandardMaterial,
  darkPlinthMat: THREE.MeshStandardMaterial
): THREE.Group {
  const group = new THREE.Group();

  // Stepped circular dark plinth
  const baseLower = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.54, 0.16, 28), darkPlinthMat);
  baseLower.position.y = 0.08;
  group.add(baseLower);

  const baseTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.05, 28), goldMat);
  baseTrim.position.y = 0.185;
  group.add(baseTrim);

  // Sculpted trophy goblet via LatheGeometry
  const cupProfile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.21),
    new THREE.Vector2(0.24, 0.21),
    new THREE.Vector2(0.12, 0.34),
    new THREE.Vector2(0.085, 0.46),
    new THREE.Vector2(0.14, 0.56),
    new THREE.Vector2(0.32, 0.78),
    new THREE.Vector2(0.38, 1.02),
    new THREE.Vector2(0.41, 1.08),
    new THREE.Vector2(0.35, 1.08),
    new THREE.Vector2(0.29, 0.8),
    new THREE.Vector2(0.0, 0.62),
  ];
  const cupMesh = new THREE.Mesh(new THREE.LatheGeometry(cupProfile, 28), goldMat);
  cupMesh.castShadow = true;
  group.add(cupMesh);

  // Left & right handles
  const handleGeo = new THREE.TorusGeometry(0.17, 0.032, 10, 20, Math.PI * 1.15);
  const leftHandle = new THREE.Mesh(handleGeo, goldMat);
  leftHandle.position.set(-0.34, 0.85, 0);
  leftHandle.rotation.z = Math.PI * 0.58;
  group.add(leftHandle);

  const rightHandle = new THREE.Mesh(handleGeo, goldMat);
  rightHandle.position.set(0.34, 0.85, 0);
  rightHandle.rotation.z = -Math.PI * 0.42;
  rightHandle.rotation.y = Math.PI;
  group.add(rightHandle);

  return group;
}

interface PillarVisual {
  teamId: string;
  group: THREE.Group;
  columnMesh: THREE.Mesh;
  capRing: THREE.Mesh;
  columnMat: THREE.MeshStandardMaterial;
  currentHeight: number;
  targetHeight: number;
}

interface TileVisual {
  tileId: string;
  group: THREE.Group;
  faceMesh: THREE.Mesh;
  rimMat: THREE.MeshStandardMaterial;
  faceMat: THREE.MeshStandardMaterial;
  lastStatus: 'unplayed' | 'playing' | 'played';
  lastPoints: number;
  currentZ: number;
  currentRotY: number;
}

export const KingOfScore3DScene: React.FC<KingOfScoreStageProps> = (props) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [contextLost, setContextLost] = useState(false);

  const tileVisualsRef = useRef<Map<string, TileVisual>>(new Map());
  const pillarVisualsRef = useRef<PillarVisual[]>([]);
  const pulseEnergyRef = useRef<number>(0);
  const lastSkipNonceRef = useRef<number>(props.skipAnimationNonce);
  const lastPulseNonceRef = useRef<number>(props.scorePulseNonce);
  const maxAnisoRef = useRef<number>(4);

  // Sync score pulse trigger
  useEffect(() => {
    if (props.scorePulseNonce !== lastPulseNonceRef.current) {
      lastPulseNonceRef.current = props.scorePulseNonce;
      pulseEnergyRef.current = props.reducedMotion ? 0 : 1.0;
    }
  }, [props.scorePulseNonce, props.reducedMotion]);

  // Rebuild / update team pillars when team count changes
  const teamSignature = props.teams
    .map((t) => `${t.id}:${t.paletteIndex}`)
    .join('|');

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setContextLost(true);
      propsRef.current.onWebglFallback?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxAnisoRef.current = renderer.capabilities.getMaxAnisotropy?.() || 4;

    const width = Math.max(320, container.clientWidth || 720);
    const height = Math.max(220, container.clientHeight || 360);
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
      propsRef.current.onWebglFallback?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);

    // Scene, Fog & RoomEnvironment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x071226);
    scene.fog = new THREE.FogExp2(0x071226, 0.022);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3.15, 11.4);
    camera.lookAt(0, 2.05, 0);

    // Studio 3-point Lighting (warm key + cool hemisphere + teal/gold rim)
    const hemiLight = new THREE.HemisphereLight(0xcbe8ff, 0x071226, 0.95);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff4de, 1.85);
    keyLight.position.set(5.5, 9.5, 7.5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.camera.left = -9;
    keyLight.shadow.camera.right = 9;
    keyLight.shadow.camera.top = 8;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.85);
    rimLight.position.set(-6.5, 4.8, -5.0);
    scene.add(rimLight);

    // Shared materials
    const stageFloorMat = new THREE.MeshStandardMaterial({
      color: 0x0b1a33,
      roughness: 0.62,
      metalness: 0.18,
    });
    const stagePlinthMat = new THREE.MeshStandardMaterial({
      color: 0x0e2242,
      roughness: 0.45,
      metalness: 0.35,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.22,
      metalness: 0.86,
      emissive: 0x451a03,
      emissiveIntensity: 0.18,
    });
    const tealStripMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      roughness: 0.28,
      metalness: 0.25,
      emissive: 0x0d9488,
      emissiveIntensity: 0.72,
    });
    const boardBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0c1e38,
      roughness: 0.42,
      metalness: 0.32,
    });

    // Stage floor & circular championship platform
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.5, 0.35, 48), stageFloorMat);
    floor.position.y = -0.175;
    floor.receiveShadow = true;
    scene.add(floor);

    const dais = new THREE.Mesh(new THREE.CylinderGeometry(5.8, 6.2, 0.24, 48), stagePlinthMat);
    dais.position.y = 0.12;
    dais.receiveShadow = true;
    scene.add(dais);

    const daisRing = new THREE.Mesh(new THREE.TorusGeometry(5.86, 0.045, 10, 64), tealStripMat);
    daisRing.rotation.x = Math.PI / 2;
    daisRing.position.y = 0.24;
    scene.add(daisRing);

    // Central 3x3 Architectural Board Frame (composite group)
    const boardGroup = new THREE.Group();
    boardGroup.position.set(0, 2.32, -0.55);
    scene.add(boardGroup);

    const frameShape = createRoundedRectShape(6.2, 3.85, 0.24);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, {
      depth: 0.28,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 3,
    });
    frameGeo.center();
    const frameMesh = new THREE.Mesh(frameGeo, boardBodyMat);
    frameMesh.castShadow = true;
    frameMesh.receiveShadow = true;
    boardGroup.add(frameMesh);

    // Gold top & bottom frame trim bars
    const trimGeo = new THREE.BoxGeometry(6.1, 0.08, 0.42);
    const topTrim = new THREE.Mesh(trimGeo, goldMat);
    topTrim.position.set(0, 1.96, 0.02);
    boardGroup.add(topTrim);

    const bottomTrim = new THREE.Mesh(trimGeo, goldMat);
    bottomTrim.position.set(0, -1.96, 0.02);
    boardGroup.add(bottomTrim);

    // Support legs anchoring board flush to dais
    const legGeo = new THREE.BoxGeometry(0.32, 0.52, 0.36);
    const leftLeg = new THREE.Mesh(legGeo, stagePlinthMat);
    leftLeg.position.set(-2.35, -2.06, 0);
    boardGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, stagePlinthMat);
    rightLeg.position.set(2.35, -2.06, 0);
    boardGroup.add(rightLeg);

    // Sculpted 3D Golden Trophy perched atop board crest
    const trophyGroup = buildGoldenTrophyGroup(goldMat, stagePlinthMat);
    trophyGroup.position.set(0, 2.02, 0.05);
    trophyGroup.scale.setScalar(0.86);
    boardGroup.add(trophyGroup);

    // 9 Beveled 3D Point Tiles (3 columns x 3 rows)
    const tileShape = createRoundedRectShape(1.74, 1.0, 0.11);
    const tileBodyGeo = new THREE.ExtrudeGeometry(tileShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.028,
      bevelSize: 0.028,
      bevelSegments: 2,
    });
    tileBodyGeo.center();
    const tileFaceGeo = new THREE.PlaneGeometry(1.62, 0.9);

    const tileVisuals = new Map<string, TileVisual>();
    const clickableMeshes: THREE.Object3D[] = [];
    const colXs = [-1.96, 0, 1.96];
    const rowYs = [1.14, 0, -1.14]; // Row 0 (10pt) top -> Row 2 (30pt) bottom

    for (const tile of propsRef.current.tiles) {
      const tGroup = new THREE.Group();
      const x = colXs[tile.colIndex] ?? 0;
      const y = rowYs[tile.rowIndex] ?? 0;
      tGroup.position.set(x, y, 0.22);

      const rimMat = new THREE.MeshStandardMaterial({
        color: 0x0f304c,
        roughness: 0.3,
        metalness: 0.65,
        emissive: 0x0d9488,
        emissiveIntensity: 0.15,
      });
      const bodyMesh = new THREE.Mesh(tileBodyGeo, rimMat);
      bodyMesh.userData = { tileId: tile.tileId };
      tGroup.add(bodyMesh);
      clickableMeshes.push(bodyMesh);

      const faceTex = createTileLabelTexture(tile.points, tile.status, maxAnisoRef.current);
      const faceMat = new THREE.MeshStandardMaterial({
        map: faceTex,
        roughness: 0.35,
        metalness: 0.1,
      });
      const faceMesh = new THREE.Mesh(tileFaceGeo, faceMat);
      faceMesh.position.z = 0.105;
      faceMesh.userData = { tileId: tile.tileId };
      tGroup.add(faceMesh);
      clickableMeshes.push(faceMesh);

      boardGroup.add(tGroup);
      tileVisuals.set(tile.tileId, {
        tileId: tile.tileId,
        group: tGroup,
        faceMesh,
        rimMat,
        faceMat,
        lastStatus: tile.status,
        lastPoints: tile.points,
        currentZ: 0.22,
        currentRotY: 0,
      });
    }
    tileVisualsRef.current = tileVisuals;

    // 3D Team Score Pillars arranged symmetrically flanking left & right of board (never blocking tiles!)
    const pillars: PillarVisual[] = [];
    const teams = propsRef.current.teams;
    const totalTeams = teams.length;
    const pillarBaseGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.2, 8);
    const pillarCollarGeo = new THREE.CylinderGeometry(0.37, 0.4, 0.08, 8);
    const pillarCoreGeo = new THREE.CylinderGeometry(0.28, 0.3, 1.0, 16);
    // Anchor cylinder bottom at y = 0 so scaling Y grows strictly upward from pedestal
    pillarCoreGeo.translate(0, 0.5, 0);
    const capRingGeo = new THREE.TorusGeometry(0.32, 0.036, 10, 24);

    teams.forEach((team, idx) => {
      const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
      const pGroup = new THREE.Group();

      // Distribute pillars cleanly on left & right wings (or centered twin-wing for 1 solo/class team)
      let px = 0;
      let pz = 0.6;
      if (totalTeams === 1) {
        px = 4.35;
        pz = 0.55;
      } else {
        const half = Math.ceil(totalTeams / 2);
        const isLeft = idx < half;
        const sideIdx = isLeft ? idx : idx - half;
        const sideCount = isLeft ? half : totalTeams - half;
        const baseX = isLeft ? -4.15 : 4.15;
        const stepX = isLeft ? -0.95 : 0.95;
        px = baseX + sideIdx * stepX;
        pz = 0.25 + (sideCount > 1 ? sideIdx * 0.45 : 0.25);
      }

      pGroup.position.set(px, 0.24, pz);

      const baseMesh = new THREE.Mesh(pillarBaseGeo, stagePlinthMat);
      baseMesh.position.y = 0.1;
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      pGroup.add(baseMesh);

      const collarMesh = new THREE.Mesh(pillarCollarGeo, goldMat);
      collarMesh.position.y = 0.24;
      pGroup.add(collarMesh);

      const colMat = new THREE.MeshStandardMaterial({
        color: palette.hexNum,
        roughness: 0.28,
        metalness: 0.22,
        emissive: palette.hexNum,
        emissiveIntensity: 0.35,
      });
      const colMesh = new THREE.Mesh(pillarCoreGeo, colMat);
      colMesh.position.y = 0.28;
      colMesh.castShadow = true;
      pGroup.add(colMesh);

      const capRing = new THREE.Mesh(capRingGeo, goldMat);
      capRing.rotation.x = Math.PI / 2;
      capRing.position.y = 0.45;
      pGroup.add(capRing);

      scene.add(pGroup);
      pillars.push({
        teamId: team.id,
        group: pGroup,
        columnMesh: colMesh,
        capRing,
        columnMat: colMat,
        currentHeight: 0.22,
        targetHeight: 0.22,
      });
    });
    pillarVisualsRef.current = pillars;

    // Raycaster for direct 3D tile clicking
    const raycaster = new THREE.Raycaster();
    const handlePointerDown = (evt: PointerEvent) => {
      const p = propsRef.current;
      if (!p.interactiveBoard || !p.onSelectTile) return;
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      _rayPointer.x = ((evt.clientX - rect.left) / rect.width) * 2 - 1;
      _rayPointer.y = -((evt.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_rayPointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const tileId = hits[0].object.userData?.tileId as string | undefined;
        if (tileId) {
          p.onSelectTile(tileId);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // ResizeObserver for crisp responsive resizing
    const handleResize = () => {
      if (!container) return;
      const w = Math.max(280, container.clientWidth);
      const h = Math.max(200, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    resizeObserver?.observe(container);

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation loop with software WebGL fenceSync pacing
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
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

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(0.08, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const p = propsRef.current;

      const forceSnap =
        p.reducedMotion || p.skipAnimationNonce !== lastSkipNonceRef.current;
      if (p.skipAnimationNonce !== lastSkipNonceRef.current) {
        lastSkipNonceRef.current = p.skipAnimationNonce;
        pulseEnergyRef.current = 0;
      }

      // Decay brief score pulse
      if (pulseEnergyRef.current > 0) {
        pulseEnergyRef.current = Math.max(0, pulseEnergyRef.current - delta * 2.2);
      }

      // Update 9 board tiles
      for (const tile of p.tiles) {
        const vis = tileVisualsRef.current.get(tile.tileId);
        if (!vis) continue;

        if (vis.lastStatus !== tile.status || vis.lastPoints !== tile.points) {
          const oldMap = vis.faceMat.map;
          vis.faceMat.map = createTileLabelTexture(tile.points, tile.status, maxAnisoRef.current);
          vis.faceMat.needsUpdate = true;
          oldMap?.dispose();
          vis.lastStatus = tile.status;
          vis.lastPoints = tile.points;
        }

        const targetZ =
          tile.status === 'playing' ? 0.52 : tile.status === 'played' ? 0.08 : 0.22;
        const targetRotY = tile.status === 'playing' && !p.reducedMotion ? Math.sin(elapsed * 2.4) * 0.05 : 0;

        vis.currentZ = forceSnap
          ? targetZ
          : THREE.MathUtils.damp(vis.currentZ, targetZ, 9.5, delta);
        vis.currentRotY = forceSnap
          ? targetRotY
          : THREE.MathUtils.damp(vis.currentRotY, targetRotY, 8.0, delta);

        vis.group.position.z = vis.currentZ;
        vis.group.rotation.y = vis.currentRotY;

        if (tile.status === 'playing') {
          vis.rimMat.color.setHex(0xeab308);
          vis.rimMat.emissive.setHex(0xf59e0b);
          vis.rimMat.emissiveIntensity = 0.55 + pulseEnergyRef.current * 0.35;
        } else if (tile.status === 'played') {
          vis.rimMat.color.setHex(0x1e293b);
          vis.rimMat.emissive.setHex(0x0f172a);
          vis.rimMat.emissiveIntensity = 0.05;
        } else {
          vis.rimMat.color.setHex(0x0f3b52);
          vis.rimMat.emissive.setHex(0x0d9488);
          vis.rimMat.emissiveIntensity = 0.16;
        }
      }

      // Update 3D score pillars (smooth proportional rise up to 3.45 units)
      const maxScore = Math.max(30, p.maxPossibleScore || 180);
      for (const pillar of pillarVisualsRef.current) {
        const rt = p.teamRuntime[pillar.teamId];
        const score = rt?.totalScore ?? 0;
        const ratio = Math.max(0, Math.min(1, score / maxScore));
        pillar.targetHeight = 0.22 + ratio * 3.15;
        pillar.currentHeight = forceSnap
          ? pillar.targetHeight
          : THREE.MathUtils.damp(pillar.currentHeight, pillar.targetHeight, 6.5, delta);

        pillar.columnMesh.scale.y = pillar.currentHeight;
        pillar.capRing.position.y = 0.28 + pillar.currentHeight + 0.06;
        pillar.columnMat.emissiveIntensity = 0.32 + pulseEnergyRef.current * 0.45 + ratio * 0.2;
      }

      // Subtle trophy celebration rotation
      if (!p.reducedMotion) {
        trophyGroup.rotation.y = Math.sin(elapsed * 0.8) * 0.22 + (p.isFinished ? elapsed * 0.65 : 0);
      } else {
        trophyGroup.rotation.y = 0;
      }
      goldMat.emissiveIntensity = p.isFinished ? 0.42 : 0.18 + pulseEnergyRef.current * 0.35;

      // Subtle camera focus adjustment
      const targetCamZ = p.isQuestionOpen ? 12.1 : 11.2;
      camera.position.z = forceSnap
        ? targetCamZ
        : THREE.MathUtils.damp(camera.position.z, targetCamZ, 5.5, delta);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);

      // Dispose all resources cleanly
      tileVisualsRef.current.forEach((v) => {
        v.faceMat.map?.dispose();
        v.faceMat.dispose();
        v.rimMat.dispose();
      });
      tileVisualsRef.current.clear();

      pillarVisualsRef.current.forEach((p) => {
        p.columnMat.dispose();
      });
      pillarVisualsRef.current = [];

      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });

      envTex.dispose();
      renderer.dispose();
    };
  }, [teamSignature]);

  if (contextLost) {
    return <KingOfScore2DStage {...props} />;
  }

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full min-h-[210px] rounded-xl overflow-hidden bg-[#071226]"
      aria-label="Sân khấu Vua ghi điểm 3D"
    />
  );
};

// ============================================================================
// LIGHTWEIGHT 2D FALLBACK STAGE (When WebGL is unavailable or 2D mode toggled)
// ============================================================================

export const KingOfScore2DStage: React.FC<KingOfScoreStageProps> = ({
  teams,
  teamRuntime,
  maxPossibleScore,
  tiles,
  isFinished,
  reducedMotion,
}) => {
  const playedCount = tiles.filter((t) => t.status === 'played').length;
  const maxScore = Math.max(30, maxPossibleScore || 180);

  return (
    <div className="w-full h-full min-h-[200px] rounded-xl bg-[#071226] border border-teal-500/25 p-4 flex flex-col justify-between gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
        <span className="font-semibold text-teal-300">
          Chế độ sân khấu 2D nhẹ · Bảng cột điểm trực quan
        </span>
        <span className="font-mono tabular-nums text-amber-300">
          Đã hoàn thành {playedCount}/{tiles.length} ô {isFinished ? '· Đã tổng kết' : ''}
        </span>
      </div>

      <div className="flex items-end justify-center gap-3 sm:gap-5 flex-1 min-h-[120px] px-2 pt-2 pb-1">
        {teams.map((team) => {
          const palette = KING_TEAM_PALETTES[team.paletteIndex % KING_TEAM_PALETTES.length];
          const score = teamRuntime[team.id]?.totalScore ?? 0;
          const pct = Math.max(8, Math.round((score / maxScore) * 100));
          return (
            <div
              key={team.id}
              className="flex flex-col items-center justify-end h-full flex-1 max-w-[110px] gap-1.5"
            >
              <span className="text-sm sm:text-base font-bold font-mono tabular-nums text-white">
                {score}
              </span>
              <div className="w-full h-24 sm:h-28 bg-slate-900/90 border border-slate-700/70 rounded-t-lg flex items-end overflow-hidden p-1">
                <div
                  className={`w-full rounded-t-md ${reducedMotion ? '' : 'transition-all duration-300'}`}
                  style={{
                    height: `${pct}%`,
                    backgroundColor: palette.hex,
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-200 truncate max-w-full text-center">
                {team.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
