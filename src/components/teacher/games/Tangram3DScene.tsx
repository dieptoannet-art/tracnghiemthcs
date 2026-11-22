import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  TangramPlayMode,
  TangramPieceId,
  TangramPieceState,
  TangramPuzzle,
  TangramSolutionSlot,
  TangramHintResult,
  TANGRAM_PIECE_ORDER,
  TANGRAM_PIECE_SPECS,
  Vec2,
  getPieceWorldPolygon,
  pointInConvexPolygon,
  ensureCCW,
} from './tangram3dEngine';

export interface TangramBoardProps {
  mode: TangramPlayMode;
  puzzle: TangramPuzzle;
  pieces: Record<TangramPieceId, TangramPieceState>;
  selectedPieceId: TangramPieceId | null;
  selectedGuidedSlotId: string | null;
  discussRegionMode: boolean;
  showSolutionOverlay: boolean;
  activeHint: TangramHintResult | null;
  outsidePieceIds: Set<TangramPieceId>;
  blockingPieceIds: Set<TangramPieceId>;
  isCompleted: boolean;
  completionToken: number;
  reducedMotion: boolean;
  preferLightweight2D: boolean;
  onSelectPiece: (pieceId: TangramPieceId | null) => void;
  onPlaceOrMovePiece: (pieceId: TangramPieceId, x: number, y: number) => void;
  onSelectGuidedSlot: (slot: TangramSolutionSlot) => void;
  onWebGLUnavailable?: () => void;
}

// ============================================================================
// WORKSPACE VIEWPORT BOUNDS (BOARD COORDINATE SPACE)
// ============================================================================

function computeWorkspaceBounds(mode: TangramPlayMode, puzzle: TangramPuzzle) {
  if (mode === 'free') {
    return { minX: -1.5, maxX: 9.5, minY: -1.5, maxY: 6.5 };
  }
  const padX = Math.max(1.8, (puzzle.bounds.maxX - puzzle.bounds.minX) * 0.28);
  const padY = Math.max(1.5, (puzzle.bounds.maxY - puzzle.bounds.minY) * 0.28);
  return {
    minX: puzzle.bounds.minX - padX,
    maxX: puzzle.bounds.maxX + padX,
    minY: puzzle.bounds.minY - padY,
    maxY: puzzle.bounds.maxY + padY,
  };
}

function probeWebGL(): { supported: boolean; isSoftwareGl: boolean } {
  if (typeof document === 'undefined') return { supported: false, isSoftwareGl: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return { supported: true, isSoftwareGl };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

function hitTestOnBoardPieces(
  pt: Vec2,
  pieces: Record<TangramPieceId, TangramPieceState>,
  selectedPieceId: TangramPieceId | null
): TangramPieceId | null {
  // Check selected piece first so overlapping/adjacent edge clicks prefer the selected piece
  const order: TangramPieceId[] = selectedPieceId
    ? [selectedPieceId, ...TANGRAM_PIECE_ORDER.filter((id) => id !== selectedPieceId)]
    : [...TANGRAM_PIECE_ORDER].reverse();

  for (const id of order) {
    const p = pieces[id];
    if (!p.onBoard) continue;
    const poly = getPieceWorldPolygon(p);
    if (pointInConvexPolygon(pt, poly, 0.03)) {
      return id;
    }
  }
  return null;
}

function hitTestGuidedSlot(pt: Vec2, puzzle: TangramPuzzle): TangramSolutionSlot | null {
  for (const slot of puzzle.solutionSlots) {
    if (pointInConvexPolygon(pt, ensureCCW(slot.polygon), 0.03)) {
      return slot;
    }
  }
  return null;
}

// ============================================================================
// 2D LIGHTWEIGHT SVG BOARD (EXACT SAME BOARD COORDINATES, ZERO WEBGL REQUIRED)
// ============================================================================

export const Tangram2DBoard: React.FC<TangramBoardProps> = ({
  mode,
  puzzle,
  pieces,
  selectedPieceId,
  selectedGuidedSlotId,
  discussRegionMode,
  showSolutionOverlay,
  activeHint,
  outsidePieceIds,
  blockingPieceIds,
  isCompleted,
  onSelectPiece,
  onPlaceOrMovePiece,
  onSelectGuidedSlot,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const bounds = useMemo(() => computeWorkspaceBounds(mode, puzzle), [mode, puzzle]);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  const [dragState, setDragState] = useState<{
    pieceId: TangramPieceId;
    offsetX: number;
    offsetY: number;
    currentX: number;
    currentY: number;
    moved: boolean;
  } | null>(null);

  const clientToBoard = useCallback(
    (clientX: number, clientY: number): Vec2 | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      // Account for preserveAspectRatio="xMidYMid meet"
      const scale = Math.min(rect.width / width, rect.height / height);
      const renderedW = width * scale;
      const renderedH = height * scale;
      const offsetLeft = rect.left + (rect.width - renderedW) / 2;
      const offsetTop = rect.top + (rect.height - renderedH) / 2;

      const x = bounds.minX + (clientX - offsetLeft) / scale;
      const y = bounds.maxY - (clientY - offsetTop) / scale;
      return { x, y };
    },
    [bounds, width, height]
  );

  // Convert Cartesian (x, y) to SVG (sx, sy) where Y points down
  const toSvg = useCallback(
    (v: Vec2) => ({ x: v.x, y: bounds.maxY + bounds.minY - v.y }),
    [bounds.maxY, bounds.minY]
  );

  const polyToPoints = useCallback(
    (poly: Vec2[]) =>
      poly
        .map((v) => {
          const s = toSvg(v);
          return `${s.x.toFixed(3)},${s.y.toFixed(3)}`;
        })
        .join(' '),
    [toSvg]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = clientToBoard(e.clientX, e.clientY);
    if (!pt) return;

    // In guided discuss mode, clicking a region immediately opens region discussion
    if (mode === 'guided' && discussRegionMode) {
      const slot = hitTestGuidedSlot(pt, puzzle);
      if (slot) {
        onSelectGuidedSlot(slot);
        return;
      }
    }

    // Check if clicking an existing on-board piece to select/drag it
    const hitId = hitTestOnBoardPieces(pt, pieces, selectedPieceId);
    if (hitId) {
      onSelectPiece(hitId);
      const p = pieces[hitId];
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setDragState({
        pieceId: hitId,
        offsetX: p.x - pt.x,
        offsetY: p.y - pt.y,
        currentX: p.x,
        currentY: p.y,
        moved: false,
      });
      return;
    }

    // "Chọn mảnh -> Chọn vị trí" (click-to-place without dragging)
    if (selectedPieceId) {
      onPlaceOrMovePiece(selectedPieceId, pt.x, pt.y);
      return;
    }

    // In "Làm quen" mode, clicking any empty target region starts a classroom discussion prompt
    if (mode === 'guided') {
      const slot = hitTestGuidedSlot(pt, puzzle);
      if (slot) {
        onSelectGuidedSlot(slot);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;
    const pt = clientToBoard(e.clientX, e.clientY);
    if (!pt) return;
    const nx = pt.x + dragState.offsetX;
    const ny = pt.y + dragState.offsetY;
    const dist = Math.hypot(nx - dragState.currentX, ny - dragState.currentY);
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            currentX: nx,
            currentY: ny,
            moved: prev.moved || dist > 0.04,
          }
        : null
    );
  };

  const handlePointerUp = () => {
    if (!dragState) return;
    const { pieceId, currentX, currentY, moved } = dragState;
    setDragState(null);
    if (moved) {
      onPlaceOrMovePiece(pieceId, currentX, currentY);
    }
  };

  // Grid lines
  const gridX: number[] = [];
  for (let x = Math.ceil(bounds.minX); x <= Math.floor(bounds.maxX); x++) gridX.push(x);
  const gridY: number[] = [];
  for (let y = Math.ceil(bounds.minY); y <= Math.floor(bounds.maxY); y++) gridY.push(y);

  const showDivisions = mode === 'guided' || showSolutionOverlay;

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#061024] select-none touch-none">
      <svg
        ref={svgRef}
        viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setDragState(null)}
        className="w-full h-full cursor-crosshair"
        role="application"
        aria-label="Bàn ghép hình Tangram 2D"
      >
        <defs>
          <filter id="tangram-tile-shadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0.06" dy="0.09" stdDeviation="0.08" floodColor="#020617" floodOpacity="0.65" />
          </filter>
        </defs>

        {/* Architectural Grid */}
        {gridX.map((gx) => (
          <line
            key={`gx-${gx}`}
            x1={gx}
            y1={bounds.minY}
            x2={gx}
            y2={bounds.maxY}
            stroke="rgba(148,163,184,0.12)"
            strokeWidth={0.025}
          />
        ))}
        {gridY.map((gy) => {
          const sy = toSvg({ x: 0, y: gy }).y;
          return (
            <line
              key={`gy-${gy}`}
              x1={bounds.minX}
              y1={sy}
              x2={bounds.maxX}
              y2={sy}
              stroke="rgba(148,163,184,0.12)"
              strokeWidth={0.025}
            />
          );
        })}

        {/* Target Silhouette Fill & Outer Contour (Only in Guided / Challenge modes) */}
        {mode !== 'free' && (
          <g>
            {/* Subtle recessed silhouette fill */}
            {puzzle.solutionSlots.map((slot) => (
              <polygon
                key={`fill-${slot.id}`}
                points={polyToPoints(slot.polygon)}
                fill={
                  selectedGuidedSlotId === slot.id
                    ? 'rgba(45, 212, 191, 0.28)'
                    : isCompleted
                    ? 'rgba(16, 185, 129, 0.16)'
                    : 'rgba(15, 35, 68, 0.85)'
                }
                stroke={
                  showDivisions
                    ? selectedGuidedSlotId === slot.id
                      ? '#5EEAD4'
                      : 'rgba(148, 163, 184, 0.42)'
                    : 'none'
                }
                strokeWidth={showDivisions ? (selectedGuidedSlotId === slot.id ? 0.075 : 0.04) : 0}
                strokeDasharray={showDivisions && selectedGuidedSlotId !== slot.id ? '0.16 0.1' : undefined}
              />
            ))}

            {/* Clean crisp OUTER silhouette boundary (zero internal seams) */}
            {puzzle.outerContours.map((contour, idx) => (
              <polygon
                key={`outer-${idx}`}
                points={polyToPoints(contour)}
                fill="none"
                stroke={isCompleted ? '#34D399' : '#2DD4BF'}
                strokeWidth={0.085}
                strokeLinejoin="round"
              />
            ))}
          </g>
        )}

        {/* Level-2 Hint Ghost Preview */}
        {activeHint?.level === 2 && activeHint.status === 'ok' && activeHint.suggestedMove && (
          <polygon
            points={polyToPoints(activeHint.suggestedMove.polygon)}
            fill="rgba(251, 191, 36, 0.22)"
            stroke="#FBBF24"
            strokeWidth={0.08}
            strokeDasharray="0.18 0.1"
            strokeLinejoin="round"
          />
        )}

        {/* Placed Tangram Pieces */}
        {TANGRAM_PIECE_ORDER.map((id) => {
          const piece = pieces[id];
          if (!piece.onBoard) return null;
          const spec = TANGRAM_PIECE_SPECS[id];
          const isDragging = dragState?.pieceId === id;
          const renderState: TangramPieceState = isDragging
            ? { ...piece, x: dragState.currentX, y: dragState.currentY }
            : piece;
          const poly = getPieceWorldPolygon(renderState);
          const isSelected = selectedPieceId === id;
          const isWarn = outsidePieceIds.has(id) || blockingPieceIds.has(id);

          return (
            <g key={id} filter="url(#tangram-tile-shadow)">
              <polygon
                points={polyToPoints(poly)}
                fill={spec.color}
                fillOpacity={isDragging ? 0.85 : 0.96}
                stroke={isWarn ? '#FB7185' : isSelected ? '#FFFFFF' : spec.edgeColor}
                strokeWidth={isSelected || isWarn ? 0.095 : 0.055}
                strokeLinejoin="round"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ============================================================================
// 3D ARCHITECTURAL TANGRAM BOARD (THREE.JS + AUTOMATIC 2D FALLBACK)
// ============================================================================

interface Piece3DBundle {
  id: TangramPieceId;
  group: THREE.Group;
  mesh: THREE.Mesh;
  edgeLine: THREE.LineLoop;
  shadowMesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  edgeMat: THREE.LineBasicMaterial;
  currentZ: number;
  targetZ: number;
  lastFlipped: boolean;
}

function createBeveledShapeGeometry(localVertices: Vec2[], flipped: boolean, depth = 0.16): THREE.ExtrudeGeometry {
  const verts = ensureCCW(
    localVertices.map((v) => ({ x: flipped ? -v.x : v.x, y: v.y }))
  );
  const shape = new THREE.Shape();
  shape.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) {
    shape.lineTo(verts[i].x, verts[i].y);
  }
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.028,
    bevelSize: 0.022,
    bevelSegments: 2,
  });
}

function createPolygonEdgeGeometry(localVertices: Vec2[], flipped: boolean, z: number): THREE.BufferGeometry {
  const verts = ensureCCW(
    localVertices.map((v) => ({ x: flipped ? -v.x : v.x, y: v.y }))
  );
  const pts = verts.map((v) => new THREE.Vector3(v.x, v.y, z));
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function createFlatShapeGeometry(poly: Vec2[]): THREE.ShapeGeometry {
  const ccw = ensureCCW(poly);
  const shape = new THREE.Shape();
  shape.moveTo(ccw[0].x, ccw[0].y);
  for (let i = 1; i < ccw.length; i++) {
    shape.lineTo(ccw[i].x, ccw[i].y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

export const Tangram3DScene: React.FC<TangramBoardProps> = (props) => {
  const {
    mode,
    puzzle,
    pieces,
    selectedPieceId,
    selectedGuidedSlotId,
    showSolutionOverlay,
    activeHint,
    outsidePieceIds,
    blockingPieceIds,
    isCompleted,
    completionToken,
    reducedMotion,
    preferLightweight2D,
    onWebGLUnavailable,
  } = props;

  const [webglStatus, setWebglStatus] = useState<'checking' | 'ready' | 'fallback'>(() =>
    preferLightweight2D ? 'fallback' : 'checking'
  );
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const syncSceneRef = useRef<(() => void) | null>(null);
  const celebrateStartRef = useRef<number>(0);
  const lastCelebrationTokenRef = useRef<number>(completionToken);

  useEffect(() => {
    if (preferLightweight2D) {
      setWebglStatus('fallback');
    } else {
      const probe = probeWebGL();
      if (probe.supported) {
        setWebglStatus('ready');
      } else {
        setWebglStatus('fallback');
        onWebGLUnavailable?.();
      }
    }
  }, [preferLightweight2D, onWebGLUnavailable]);

  useEffect(() => {
    if (completionToken > lastCelebrationTokenRef.current) {
      lastCelebrationTokenRef.current = completionToken;
      if (!reducedMotion) {
        celebrateStartRef.current = performance.now();
      }
      syncSceneRef.current?.();
    }
  }, [completionToken, reducedMotion]);

  useEffect(() => {
    syncSceneRef.current?.();
  }, [
    mode,
    puzzle,
    pieces,
    selectedPieceId,
    selectedGuidedSlotId,
    showSolutionOverlay,
    activeHint,
    outsidePieceIds,
    blockingPieceIds,
    isCompleted,
    reducedMotion,
  ]);

  // Mount Three.js Tangram table once when WebGL ready (rebuilds target overlay cleanly on puzzle/mode change)
  useEffect(() => {
    if (webglStatus !== 'ready') return;
    const container = mountRef.current;
    if (!container) return;

    const probe = probeWebGL();
    if (!probe.supported) {
      setWebglStatus('fallback');
      onWebGLUnavailable?.();
      return;
    }
    const { isSoftwareGl } = probe;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglStatus('fallback');
      onWebGLUnavailable?.();
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.style.cursor = 'grab';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061024);
    scene.fog = new THREE.FogExp2(0x061024, 0.012);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const bounds = computeWorkspaceBounds(mode, puzzle);
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxY - bounds.minY;

    // Near-frontal architectural camera: subtle 3D depth & bevel readability, zero angle confusion
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 120);

    // 3-Point Studio Lighting
    const hemi = new THREE.HemisphereLight(0xdbeafe, 0x09162e, 1.08);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
    keyLight.position.set(centerX - 5.5, centerY + 6.0, 12.5);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 30;
      keyLight.shadow.camera.left = -7.5;
      keyLight.shadow.camera.right = 7.5;
      keyLight.shadow.camera.top = 7.5;
      keyLight.shadow.camera.bottom = -7.5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x2dd4bf, 0.72);
    rimLight.position.set(centerX + 7, centerY - 5, 6);
    scene.add(rimLight);

    const disposableGeos: THREE.BufferGeometry[] = [];
    const disposableMats: THREE.Material[] = [];

    // 1. Matte deep-navy architectural table plane
    const deskGeo = new THREE.PlaneGeometry(46, 46);
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0x071329,
      roughness: 0.88,
      metalness: 0.08,
    });
    const deskMesh = new THREE.Mesh(deskGeo, deskMat);
    deskMesh.position.set(centerX, centerY, -0.05);
    deskMesh.receiveShadow = !isSoftwareGl;
    scene.add(deskMesh);
    disposableGeos.push(deskGeo);
    disposableMats.push(deskMat);

    // 2. Subtle architectural reference grid (1-unit lines)
    const gridPts: THREE.Vector3[] = [];
    const gMinX = Math.floor(bounds.minX) - 2;
    const gMaxX = Math.ceil(bounds.maxX) + 2;
    const gMinY = Math.floor(bounds.minY) - 2;
    const gMaxY = Math.ceil(bounds.maxY) + 2;
    for (let x = gMinX; x <= gMaxX; x++) {
      gridPts.push(new THREE.Vector3(x, gMinY, -0.03), new THREE.Vector3(x, gMaxY, -0.03));
    }
    for (let y = gMinY; y <= gMaxY; y++) {
      gridPts.push(new THREE.Vector3(gMinX, y, -0.03), new THREE.Vector3(gMaxX, y, -0.03));
    }
    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
    const gridMat = new THREE.LineBasicMaterial({ color: 0x1e355a, transparent: true, opacity: 0.42 });
    const gridLines = new THREE.LineSegments(gridGeo, gridMat);
    scene.add(gridLines);
    disposableGeos.push(gridGeo);
    disposableMats.push(gridMat);

    // 3. Target Silhouette Group (recessed fill + crisp outer contour + optional interior divisions)
    const targetGroup = new THREE.Group();
    scene.add(targetGroup);

    const slotFillMats = new Map<string, THREE.MeshBasicMaterial>();
    const divisionLines: THREE.LineLoop[] = [];
    const outerOutlineMats: THREE.LineBasicMaterial[] = [];

    if (mode !== 'free') {
      for (const slot of puzzle.solutionSlots) {
        const sGeo = createFlatShapeGeometry(slot.polygon);
        const sMat = new THREE.MeshBasicMaterial({
          color: 0x0f2548,
          transparent: true,
          opacity: 0.88,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        });
        const sMesh = new THREE.Mesh(sGeo, sMat);
        sMesh.position.z = -0.015;
        targetGroup.add(sMesh);
        slotFillMats.set(slot.id, sMat);
        disposableGeos.push(sGeo);
        disposableMats.push(sMat);

        // Interior division line (toggled visible ONLY in "Làm quen" or when showSolutionOverlay is ON)
        const dPts = ensureCCW(slot.polygon).map((v) => new THREE.Vector3(v.x, v.y, 0.004));
        const dGeo = new THREE.BufferGeometry().setFromPoints(dPts);
        const dMat = new THREE.LineBasicMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.55,
        });
        const dLine = new THREE.LineLoop(dGeo, dMat);
        dLine.visible = mode === 'guided' || showSolutionOverlay;
        targetGroup.add(dLine);
        divisionLines.push(dLine);
        disposableGeos.push(dGeo);
        disposableMats.push(dMat);
      }

      // Crisp bright outer contour (ZERO internal lines)
      for (const contour of puzzle.outerContours) {
        const cPts = contour.map((v) => new THREE.Vector3(v.x, v.y, 0.012));
        const cGeo = new THREE.BufferGeometry().setFromPoints(cPts);
        const cMat = new THREE.LineBasicMaterial({ color: 0x2dd4bf });
        const cLine = new THREE.LineLoop(cGeo, cMat);
        targetGroup.add(cLine);
        outerOutlineMats.push(cMat);
        disposableGeos.push(cGeo);
        disposableMats.push(cMat);
      }
    }

    // 4. Level-2 Hint Ghost Group (updated dynamically)
    const hintGroup = new THREE.Group();
    scene.add(hintGroup);
    let hintDisposables: Array<THREE.BufferGeometry | THREE.Material> = [];
    let lastHintSig = '';

    // 5. Seven Sculpted 3D Beveled Tangram Pieces
    const piecesGroup = new THREE.Group();
    scene.add(piecesGroup);
    const pieceBundles = new Map<TangramPieceId, Piece3DBundle>();
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    disposableMats.push(shadowMat);

    for (const id of TANGRAM_PIECE_ORDER) {
      const spec = TANGRAM_PIECE_SPECS[id];
      const group = new THREE.Group();
      group.visible = false;

      const geo = createBeveledShapeGeometry(spec.localVertices, false, 0.16);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.color),
        roughness: 0.34,
        metalness: 0.16,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = !isSoftwareGl;
      mesh.receiveShadow = !isSoftwareGl;

      const edgeGeo = createPolygonEdgeGeometry(spec.localVertices, false, 0.192);
      const edgeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(spec.edgeColor) });
      const edgeLine = new THREE.LineLoop(edgeGeo, edgeMat);

      // Soft contact shadow directly underneath each piece
      const shGeo = createFlatShapeGeometry(spec.localVertices);
      const shadowMesh = new THREE.Mesh(shGeo, shadowMat);
      shadowMesh.position.set(0.08, -0.09, -0.01);

      group.add(shadowMesh, mesh, edgeLine);
      piecesGroup.add(group);
      disposableMats.push(mat, edgeMat);

      pieceBundles.set(id, {
        id,
        group,
        mesh,
        edgeLine,
        shadowMesh,
        mat,
        edgeMat,
        currentZ: 0.02,
        targetZ: 0.02,
        lastFlipped: false,
      });
    }

    // Exact Board-Plane Raycaster (z = 0) — immune to zoom/perspective distortion!
    const raycaster = new THREE.Raycaster();
    const boardPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const _ndc = new THREE.Vector2();
    const _hitPoint = new THREE.Vector3();

    const getBoardPointFromEvent = (ev: PointerEvent): Vec2 | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(_ndc, camera);
      const ok = raycaster.ray.intersectPlane(boardPlane, _hitPoint);
      return ok ? { x: _hitPoint.x, y: _hitPoint.y } : null;
    };

    let activeDrag: {
      pieceId: TangramPieceId;
      offsetX: number;
      offsetY: number;
      currentX: number;
      currentY: number;
      moved: boolean;
    } | null = null;

    // On-demand render scheduler with software-WebGL fenceSync pacing
    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastFrameTime = performance.now();

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) {
              if (sync) gl.deleteSync(sync);
              return;
            }
            const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
          return;
        }
      } catch {
        // Ignore
      }
      frameId = window.setTimeout(cb, 80);
    };

    const requestRender = () => {
      if (disposed) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = window.requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const dt = Math.min((now - lastFrameTime) / 1000, 0.08);
        lastFrameTime = now;

        const isReduced = propsRef.current.reducedMotion;
        const celElapsed = celebrateStartRef.current > 0 ? (now - celebrateStartRef.current) / 1000 : -1;
        const celebrating = !isReduced && celElapsed >= 0 && celElapsed < 1.25;
        let stillAnimating = celebrating;

        let idx = 0;
        for (const bundle of pieceBundles.values()) {
          let desiredZ = bundle.targetZ;
          if (celebrating && bundle.group.visible) {
            const phase = celElapsed * 5.2 - idx * 0.25;
            if (phase > 0 && phase < Math.PI) {
              desiredZ += Math.sin(phase) * 0.22;
            }
          }
          if (isReduced) {
            bundle.currentZ = desiredZ;
          } else {
            bundle.currentZ = THREE.MathUtils.damp(bundle.currentZ, desiredZ, 15, dt);
            if (Math.abs(bundle.currentZ - desiredZ) > 0.002) {
              stillAnimating = true;
            } else {
              bundle.currentZ = desiredZ;
            }
          }
          bundle.group.position.z = bundle.currentZ;
          idx++;
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || stillAnimating) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    };

    const syncSceneFromProps = () => {
      const p = propsRef.current;

      // Update division visibility & outer outline color
      const showDivs = p.mode === 'guided' || p.showSolutionOverlay;
      for (const line of divisionLines) line.visible = showDivs;
      for (const mat of outerOutlineMats) {
        mat.color.setHex(p.isCompleted ? 0x34d399 : 0x2dd4bf);
      }
      for (const [slotId, sMat] of slotFillMats.entries()) {
        if (p.selectedGuidedSlotId === slotId) {
          sMat.color.setHex(0x145e66);
          sMat.opacity = 0.92;
        } else if (p.isCompleted) {
          sMat.color.setHex(0x0c3638);
          sMat.opacity = 0.85;
        } else {
          sMat.color.setHex(0x0f2548);
          sMat.opacity = 0.88;
        }
      }

      // Rebuild Level-2 hint ghost only when changed
      const hintMove = p.activeHint?.level === 2 && p.activeHint.status === 'ok' ? p.activeHint.suggestedMove : undefined;
      const hintSig = hintMove
        ? `${hintMove.pieceId}:${hintMove.x}:${hintMove.y}:${hintMove.rotationDeg}:${hintMove.flipped}`
        : '';
      if (hintSig !== lastHintSig) {
        lastHintSig = hintSig;
        while (hintGroup.children.length > 0) hintGroup.remove(hintGroup.children[0]);
        hintDisposables.forEach((d) => d.dispose());
        hintDisposables = [];

        if (hintMove) {
          const hGeo = createFlatShapeGeometry(hintMove.polygon);
          const hMat = new THREE.MeshBasicMaterial({
            color: 0xfbbf24,
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
          });
          const hMesh = new THREE.Mesh(hGeo, hMat);
          hMesh.position.z = 0.018;

          const lPts = ensureCCW(hintMove.polygon).map((v) => new THREE.Vector3(v.x, v.y, 0.025));
          const lGeo = new THREE.BufferGeometry().setFromPoints(lPts);
          const lMat = new THREE.LineBasicMaterial({ color: 0xfbbf24 });
          const lLine = new THREE.LineLoop(lGeo, lMat);

          hintGroup.add(hMesh, lLine);
          hintDisposables.push(hGeo, hMat, lGeo, lMat);
        }
      }

      // Sync each 3D Tangram piece
      for (const id of TANGRAM_PIECE_ORDER) {
        const piece = p.pieces[id];
        const bundle = pieceBundles.get(id)!;
        const spec = TANGRAM_PIECE_SPECS[id];
        bundle.group.visible = piece.onBoard;
        if (!piece.onBoard) continue;

        const effectiveFlip = spec.canFlip ? piece.flipped : false;
        if (effectiveFlip !== bundle.lastFlipped) {
          bundle.lastFlipped = effectiveFlip;
          const oldBody = bundle.mesh.geometry;
          const oldEdge = bundle.edgeLine.geometry;
          const oldSh = bundle.shadowMesh.geometry;
          bundle.mesh.geometry = createBeveledShapeGeometry(spec.localVertices, effectiveFlip, 0.16);
          bundle.edgeLine.geometry = createPolygonEdgeGeometry(spec.localVertices, effectiveFlip, 0.192);
          bundle.shadowMesh.geometry = createFlatShapeGeometry(
            spec.localVertices.map((v) => ({ x: effectiveFlip ? -v.x : v.x, y: v.y }))
          );
          oldBody.dispose();
          oldEdge.dispose();
          oldSh.dispose();
        }

        const isDragging = activeDrag?.pieceId === id;
        const posX = isDragging ? activeDrag!.currentX : piece.x;
        const posY = isDragging ? activeDrag!.currentY : piece.y;
        bundle.group.position.x = posX;
        bundle.group.position.y = posY;
        bundle.group.rotation.z = (piece.rotationDeg * Math.PI) / 180;

        const isSelected = p.selectedPieceId === id;
        const isWarn = p.outsidePieceIds.has(id) || p.blockingPieceIds.has(id);

        if (isWarn) {
          bundle.edgeMat.color.setHex(0xfb7185);
          bundle.mat.emissive.setHex(0x4c0519);
          bundle.mat.emissiveIntensity = 0.45;
        } else if (isSelected) {
          bundle.edgeMat.color.setHex(0xffffff);
          bundle.mat.emissive.setHex(0x134e4a);
          bundle.mat.emissiveIntensity = 0.32;
        } else {
          bundle.edgeMat.color.set(spec.edgeColor);
          bundle.mat.emissive.setHex(0x000000);
          bundle.mat.emissiveIntensity = 0;
        }

        bundle.targetZ = isDragging ? 0.24 : isSelected ? 0.11 : 0.02;
      }

      requestRender();
    };

    syncSceneRef.current = syncSceneFromProps;

    const handlePointerDown = (ev: PointerEvent) => {
      const pt = getBoardPointFromEvent(ev);
      if (!pt) return;
      const p = propsRef.current;

      if (p.mode === 'guided' && p.discussRegionMode) {
        const slot = hitTestGuidedSlot(pt, p.puzzle);
        if (slot) {
          p.onSelectGuidedSlot(slot);
          return;
        }
      }

      const hitId = hitTestOnBoardPieces(pt, p.pieces, p.selectedPieceId);
      if (hitId) {
        p.onSelectPiece(hitId);
        const piece = p.pieces[hitId];
        renderer.domElement.setPointerCapture?.(ev.pointerId);
        renderer.domElement.style.cursor = 'grabbing';
        activeDrag = {
          pieceId: hitId,
          offsetX: piece.x - pt.x,
          offsetY: piece.y - pt.y,
          currentX: piece.x,
          currentY: piece.y,
          moved: false,
        };
        syncSceneFromProps();
        return;
      }

      if (p.selectedPieceId) {
        p.onPlaceOrMovePiece(p.selectedPieceId, pt.x, pt.y);
        return;
      }

      if (p.mode === 'guided') {
        const slot = hitTestGuidedSlot(pt, p.puzzle);
        if (slot) {
          p.onSelectGuidedSlot(slot);
        }
      }
    };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!activeDrag) return;
      const pt = getBoardPointFromEvent(ev);
      if (!pt) return;
      const nx = pt.x + activeDrag.offsetX;
      const ny = pt.y + activeDrag.offsetY;
      if (Math.hypot(nx - activeDrag.currentX, ny - activeDrag.currentY) > 0.03) {
        activeDrag.moved = true;
      }
      activeDrag.currentX = nx;
      activeDrag.currentY = ny;
      syncSceneFromProps();
    };

    const handlePointerUp = () => {
      if (!activeDrag) return;
      const { pieceId, currentX, currentY, moved } = activeDrag;
      activeDrag = null;
      renderer.domElement.style.cursor = 'grab';
      if (moved) {
        propsRef.current.onPlaceOrMovePiece(pieceId, currentX, currentY);
      } else {
        syncSceneFromProps();
      }
    };

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglStatus('fallback');
      propsRef.current.onWebGLUnavailable?.();
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);
    renderer.domElement.addEventListener('pointercancel', handlePointerUp);
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);

    const handleResize = () => {
      if (disposed || !container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      const aspect = w / h;
      camera.aspect = aspect;
      const vFovRad = THREE.MathUtils.degToRad(camera.fov);
      const distV = (spanY * 1.08) / (2 * Math.tan(vFovRad / 2));
      const distH = (spanX * 1.08) / (2 * Math.tan(vFovRad / 2) * Math.max(aspect, 0.55));
      const dist = Math.max(distV, distH);
      // Slight near-frontal architectural tilt (-0.075 * dist on Y) for visible 3D thickness without distorting angles
      camera.position.set(centerX, centerY - dist * 0.075, dist);
      camera.lookAt(centerX, centerY, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    handleResize();

    if (!isSoftwareGl) {
      try {
        renderer.compile(scene, camera);
      } catch {
        // Ignore
      }
    }
    syncSceneFromProps();

    return () => {
      disposed = true;
      syncSceneRef.current = null;
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('pointercancel', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      hintDisposables.forEach((d) => d.dispose());
      for (const b of pieceBundles.values()) {
        b.mesh.geometry.dispose();
        b.edgeLine.geometry.dispose();
        b.shadowMesh.geometry.dispose();
      }
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      envRT.dispose();
      renderer.dispose();
    };
  }, [webglStatus, mode, puzzle.id, onWebGLUnavailable]);

  if (webglStatus !== 'ready') {
    return <Tangram2DBoard {...props} />;
  }

  return (
    <div className="relative w-full h-full min-h-[300px] sm:min-h-[420px] rounded-2xl overflow-hidden bg-[#061024]">
      <div
        ref={mountRef}
        className="w-full h-full"
        role="application"
        aria-label={`Bàn ghép hình Tangram 3D — ${puzzle.title}`}
      />
    </div>
  );
};
