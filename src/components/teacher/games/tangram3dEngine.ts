/**
 * F02 — Tangram 3D Geometry & Game Engine (Pure TypeScript, Zero DOM Dependency)
 *
 * Single source of truth for:
 * - Exact 7 canonical Tangram pieces (fixed dimensions, total area = 16 sq units)
 * - Exact convex polygon clipping (Sutherland-Hodgman) for overlap, inside coverage,
 *   outside overflow, and uncovered-hole verification independent of screen/zoom/3D perspective
 * - Exact outer boundary contour extraction (cancels interior shared seams automatically)
 * - Verified built-in puzzles ("Dữ liệu mẫu"): exact 4x4 sample square + 4 custom challenges
 *   (including puzzles requiring flipping the parallelogram)
 * - Magnetic vertex/edge snapping, overlap rejection with automatic revert, full Undo stack
 * - Two-level explainable hints with MathView LaTeX explanations & explicit-only apply
 * - 3 play modes ("Làm quen", "Thử thách", "Ghép tự do"), 2–6 classroom discussion groups,
 *   and /demo-isolated session persistence
 */

import { isKhktDemoRuntime } from '../../../utils/khktDemoSandbox';

export interface Vec2 {
  x: number;
  y: number;
}

export type TangramPieceId =
  | 'large_1'
  | 'large_2'
  | 'medium'
  | 'small_1'
  | 'small_2'
  | 'square'
  | 'parallelogram';

export type TangramPieceKind = 'large' | 'medium' | 'small' | 'square' | 'parallelogram';

export type TangramPlayMode = 'guided' | 'challenge' | 'free';

export interface TangramPieceSpec {
  id: TangramPieceId;
  kind: TangramPieceKind;
  name: string;
  shortLabel: string;
  area: number;
  areaFractionLatex: string;
  anglesDesc: string;
  edgesDesc: string;
  canFlip: boolean;
  /** Primary face hex color */
  color: string;
  /** Bright edge highlight hex color */
  edgeColor: string;
  /** Canonical local polygon in CCW order centered at (0,0) */
  localVertices: Vec2[];
}

export interface TangramPieceState {
  id: TangramPieceId;
  onBoard: boolean;
  /** Center position in board coordinates (meaningful when onBoard === true) */
  x: number;
  y: number;
  /** Rotation in degrees (normalized to 0, 45, 90, 135, 180, 225, 270, 315) */
  rotationDeg: number;
  /** Horizontal mirror in local space (meaningful for parallelogram; locked false for symmetric pieces) */
  flipped: boolean;
}

export interface TangramSolutionSlot {
  id: string;
  pieceId: TangramPieceId;
  kind: TangramPieceKind;
  x: number;
  y: number;
  rotationDeg: number;
  flipped: boolean;
  /** Exact CCW world polygon of this slot */
  polygon: Vec2[];
  /** Educational prompt when teacher clicks this region in "Làm quen" mode */
  discussionPrompt: string;
}

export interface TangramPuzzle {
  id: string;
  title: string;
  subtitle: string;
  difficultyLabel: string;
  isSample: boolean;
  requiresParallelogramFlip: boolean;
  allowTargetRotation: boolean;
  allowTargetReflection: boolean;
  /** Bounding box of target in board coordinates */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Exact disjoint convex polygons forming the target silhouette (sum of areas = 16) */
  solutionSlots: TangramSolutionSlot[];
  /** Extracted outer contour loop(s) with ZERO internal dividing lines */
  outerContours: Vec2[][];
  /** Level 1 math & geometry observation hints */
  level1Hints: Array<{ text: string; speechText: string }>;
  /** Summary math note displayed on completion */
  mathInsight: string;
}

export interface TangramGeometryEvaluation {
  placedCount: number;
  allSevenPlaced: boolean;
  totalOverlapArea: number;
  maxPairwiseOverlap: number;
  overlappingPairs: Array<{ a: TangramPieceId; b: TangramPieceId; area: number }>;
  totalInsideArea: number;
  totalOutsideArea: number;
  uncoveredInsideArea: number;
  outsidePieces: Array<{ id: TangramPieceId; outsideArea: number }>;
  coverageRatio: number; // 0..1
  isCompleted: boolean;
}

export interface TangramHintResult {
  level: 1 | 2;
  status: 'ok' | 'blocked' | 'already_complete' | 'not_applicable';
  title: string;
  explanation: string;
  speechText: string;
  blockingPieceIds: TangramPieceId[];
  /** Present on Level 2 when a concrete piece placement can be previewed & applied */
  suggestedMove?: {
    pieceId: TangramPieceId;
    x: number;
    y: number;
    rotationDeg: number;
    flipped: boolean;
    polygon: Vec2[];
  };
}

export interface TangramUndoEntry {
  pieces: Record<TangramPieceId, TangramPieceState>;
  description: string;
}

export interface TangramGameState {
  mode: TangramPlayMode;
  puzzleId: string;
  pieces: Record<TangramPieceId, TangramPieceState>;
  undoStack: TangramUndoEntry[];
  hintsUsed: number;
  freeBuildName: string;
  classroomEnabled: boolean;
  groupCount: number; // 2..6
  activeGroupIndex: number; // 0..groupCount-1
  timerEnabled: boolean;
  elapsedSeconds: number;
  isCompleted: boolean;
  completionToken: number;
  completedAtMs: number | null;
}

export interface PersistedTangramSession {
  version: 1;
  mode: TangramPlayMode;
  puzzleId: string;
  pieces: Record<TangramPieceId, TangramPieceState>;
  undoStack: TangramUndoEntry[];
  hintsUsed: number;
  freeBuildName: string;
  classroomEnabled: boolean;
  groupCount: number;
  activeGroupIndex: number;
  timerEnabled: boolean;
  elapsedSeconds: number;
  isCompleted: boolean;
  completionToken: number;
  completedAtMs: number | null;
  savedAtMs: number;
}

export const TANGRAM_STORAGE_KEY_REAL = 'taydo_f02_tangram_3d_session_v1';
export const TANGRAM_STORAGE_KEY_DEMO = 'khkt_demo_f02_tangram_3d_session_v1';

// Tolerance constants strictly in board coordinate units (independent of screen/zoom/3D camera)
export const OVERLAP_EPS = 0.03; // sq units (< 0.2% of 16 sq units)
export const TOTAL_OVERLAP_EPS = 0.05;
export const OUTSIDE_EPS = 0.08; // sq units (allows ~0.01-unit placement precision while catching real overflow)
export const UNCOVERED_EPS = 0.08;
export const SNAP_RADIUS = 0.36; // board units
export const GRID_SNAP_STEP = 0.25;

// ============================================================================
// BASIC 2D VECTOR & CONVEX POLYGON GEOMETRY (EXACT ANALYTICAL)
// ============================================================================

export function normalizeRotationDeg(deg: number): number {
  const snapped = Math.round(deg / 45) * 45;
  return ((snapped % 360) + 360) % 360;
}

export function polygonSignedArea(poly: Vec2[]): number {
  if (poly.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

export function polygonArea(poly: Vec2[]): number {
  return Math.abs(polygonSignedArea(poly));
}

export function ensureCCW(poly: Vec2[]): Vec2[] {
  if (polygonSignedArea(poly) < 0) {
    return [...poly].reverse();
  }
  return poly.map((p) => ({ x: p.x, y: p.y }));
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  if (poly.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

export function pointInConvexPolygon(pt: Vec2, polyCCW: Vec2[], eps = 1e-6): boolean {
  for (let i = 0; i < polyCCW.length; i++) {
    const a = polyCCW[i];
    const b = polyCCW[(i + 1) % polyCCW.length];
    const cross = (b.x - a.x) * (pt.y - a.y) - (b.y - a.y) * (pt.x - a.x);
    if (cross < -eps) return false;
  }
  return true;
}

/**
 * Exact Sutherland-Hodgman clipping of convex polygon `subject` against convex CCW polygon `clip`.
 */
export function intersectConvexPolygons(subject: Vec2[], clip: Vec2[]): Vec2[] {
  const clipCCW = ensureCCW(clip);
  let output = ensureCCW(subject);
  if (output.length < 3 || clipCCW.length < 3) return [];

  const EPS = 1e-9;

  for (let i = 0; i < clipCCW.length; i++) {
    const cp1 = clipCCW[i];
    const cp2 = clipCCW[(i + 1) % clipCCW.length];
    const input = output;
    output = [];
    if (input.length === 0) break;

    const isInside = (p: Vec2) =>
      (cp2.x - cp1.x) * (p.y - cp1.y) - (cp2.y - cp1.y) * (p.x - cp1.x) >= -EPS;

    const intersectSeg = (s: Vec2, e: Vec2): Vec2 => {
      const dcX = cp1.x - cp2.x;
      const dcY = cp1.y - cp2.y;
      const dpX = s.x - e.x;
      const dpY = s.y - e.y;
      const denom = dcX * dpY - dcY * dpX;
      if (Math.abs(denom) < 1e-12) return { x: e.x, y: e.y };
      const n1 = cp1.x * cp2.y - cp1.y * cp2.x;
      const n2 = s.x * e.y - s.y * e.x;
      return {
        x: (n1 * dpX - n2 * dcX) / denom,
        y: (n1 * dpY - n2 * dcY) / denom,
      };
    };

    let s = input[input.length - 1];
    for (const e of input) {
      const eIn = isInside(e);
      const sIn = isInside(s);
      if (eIn) {
        if (!sIn) output.push(intersectSeg(s, e));
        output.push(e);
      } else if (sIn) {
        output.push(intersectSeg(s, e));
      }
      s = e;
    }
  }

  return output;
}

export function convexIntersectionArea(a: Vec2[], b: Vec2[]): number {
  const inter = intersectConvexPolygons(a, b);
  return inter.length >= 3 ? polygonArea(inter) : 0;
}

// ============================================================================
// EXACT OUTER CONTOUR EXTRACTION (ZERO INTERNAL SEAMS)
// ============================================================================

interface DirectedEdge {
  a: Vec2;
  b: Vec2;
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pointOnSegmentParam(p: Vec2, a: Vec2, b: Vec2): number | null {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-10) return null;
  const cross = Math.abs(abx * (p.y - a.y) - aby * (p.x - a.x));
  if (cross > 1e-5 * Math.sqrt(lenSq)) return null;
  const t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  if (t > 1e-5 && t < 1 - 1e-5) return t;
  return null;
}

function quantKey(p: Vec2): string {
  return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`;
}

/**
 * Extracts exact exterior boundary loops from a collection of disjoint CCW convex polygons.
 * Splits overlapping collinear edges at T-junctions and cancels opposite-direction shared edges.
 */
export function extractOuterContours(polygons: Vec2[][]): Vec2[][] {
  const allVertices: Vec2[] = [];
  const rawEdges: DirectedEdge[] = [];

  for (const poly of polygons) {
    const ccw = ensureCCW(poly);
    for (let i = 0; i < ccw.length; i++) {
      const a = ccw[i];
      const b = ccw[(i + 1) % ccw.length];
      allVertices.push(a);
      if (distSq(a, b) > 1e-8) {
        rawEdges.push({ a, b });
      }
    }
  }

  // Split every edge at any vertex lying strictly inside it (handles T-junctions accurately)
  const splitEdges: DirectedEdge[] = [];
  for (const edge of rawEdges) {
    const ts: number[] = [0, 1];
    for (const v of allVertices) {
      const t = pointOnSegmentParam(v, edge.a, edge.b);
      if (t !== null) ts.push(t);
    }
    ts.sort((u, v) => u - v);
    const uniqueTs: number[] = [];
    for (const t of ts) {
      if (uniqueTs.length === 0 || t - uniqueTs[uniqueTs.length - 1] > 1e-5) {
        uniqueTs.push(t);
      }
    }
    for (let i = 0; i < uniqueTs.length - 1; i++) {
      const t0 = uniqueTs[i];
      const t1 = uniqueTs[i + 1];
      splitEdges.push({
        a: { x: edge.a.x + (edge.b.x - edge.a.x) * t0, y: edge.a.y + (edge.b.y - edge.a.y) * t0 },
        b: { x: edge.a.x + (edge.b.x - edge.a.x) * t1, y: edge.a.y + (edge.b.y - edge.a.y) * t1 },
      });
    }
  }

  // Cancel opposite-direction shared interior edges
  const active: boolean[] = Array(splitEdges.length).fill(true);
  for (let i = 0; i < splitEdges.length; i++) {
    if (!active[i]) continue;
    const ei = splitEdges[i];
    for (let j = i + 1; j < splitEdges.length; j++) {
      if (!active[j]) continue;
      const ej = splitEdges[j];
      if (distSq(ei.a, ej.b) < 1e-6 && distSq(ei.b, ej.a) < 1e-6) {
        active[i] = false;
        active[j] = false;
        break;
      }
    }
  }

  const boundaryEdges = splitEdges.filter((_, idx) => active[idx]);
  const used: boolean[] = Array(boundaryEdges.length).fill(false);
  const loops: Vec2[][] = [];

  for (let startIdx = 0; startIdx < boundaryEdges.length; startIdx++) {
    if (used[startIdx]) continue;
    used[startIdx] = true;
    const loop: Vec2[] = [boundaryEdges[startIdx].a];
    let current = boundaryEdges[startIdx].b;
    let safety = 0;

    while (distSq(current, loop[0]) > 1e-6 && safety < boundaryEdges.length + 5) {
      safety++;
      loop.push(current);
      const curKey = quantKey(current);
      let nextIdx = -1;
      for (let j = 0; j < boundaryEdges.length; j++) {
        if (!used[j] && quantKey(boundaryEdges[j].a) === curKey) {
          nextIdx = j;
          break;
        }
      }
      if (nextIdx === -1) break;
      used[nextIdx] = true;
      current = boundaryEdges[nextIdx].b;
    }

    // Simplify collinear consecutive vertices along straight outer edges
    if (loop.length >= 3) {
      const simplified: Vec2[] = [];
      for (let i = 0; i < loop.length; i++) {
        const prev = loop[(i - 1 + loop.length) % loop.length];
        const curr = loop[i];
        const next = loop[(i + 1) % loop.length];
        const cross = Math.abs(
          (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x)
        );
        if (cross > 1e-5) {
          simplified.push(curr);
        }
      }
      if (simplified.length >= 3) loops.push(simplified);
    }
  }

  return loops;
}

// ============================================================================
// CANONICAL 7 TANGRAM PIECES (DERIVED DIRECTLY FROM MASTER SQUARE COORDINATES)
// ============================================================================

function toCenteredLocalCCW(worldPoly: Vec2[]): { local: Vec2[]; centroid: Vec2 } {
  const ccw = ensureCCW(worldPoly);
  const centroid = polygonCentroid(ccw);
  const local = ccw.map((p) => ({ x: p.x - centroid.x, y: p.y - centroid.y }));
  return { local, centroid };
}

// Master square sample polygons (exact coordinates from F02 master prompt)
const MASTER_POLY_LARGE_1: Vec2[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 2, y: 2 },
];
const MASTER_POLY_MEDIUM: Vec2[] = [
  { x: 0, y: 2 },
  { x: 2, y: 4 },
  { x: 0, y: 4 },
];
const MASTER_POLY_SMALL_1: Vec2[] = [
  { x: 0, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 2 },
];
const MASTER_POLY_SQUARE: Vec2[] = [
  { x: 0, y: 2 },
  { x: 1, y: 1 },
  { x: 2, y: 2 },
  { x: 1, y: 3 },
];
const MASTER_POLY_PARALLELOGRAM: Vec2[] = [
  { x: 1, y: 3 },
  { x: 3, y: 3 },
  { x: 4, y: 4 },
  { x: 2, y: 4 },
];

const LOCAL_LARGE = toCenteredLocalCCW(MASTER_POLY_LARGE_1).local;
const LOCAL_MEDIUM = toCenteredLocalCCW(MASTER_POLY_MEDIUM).local;
const LOCAL_SMALL = toCenteredLocalCCW(MASTER_POLY_SMALL_1).local;
const LOCAL_SQUARE = toCenteredLocalCCW(MASTER_POLY_SQUARE).local;
const LOCAL_PARALLELOGRAM = toCenteredLocalCCW(MASTER_POLY_PARALLELOGRAM).local;

export const TANGRAM_PIECE_ORDER: TangramPieceId[] = [
  'large_1',
  'large_2',
  'medium',
  'small_1',
  'small_2',
  'square',
  'parallelogram',
];

export const TANGRAM_PIECE_SPECS: Record<TangramPieceId, TangramPieceSpec> = {
  large_1: {
    id: 'large_1',
    kind: 'large',
    name: 'Tam giác lớn 1',
    shortLabel: 'TG Lớn 1',
    area: 4,
    areaFractionLatex: '\\frac{4}{16}=\\frac{1}{4}',
    anglesDesc: '90°, 45°, 45°',
    edgesDesc: 'Cạnh góc vuông $2\\sqrt{2}$, cạnh huyền $4$',
    canFlip: false,
    color: '#0D9488',
    edgeColor: '#5EEAD4',
    localVertices: LOCAL_LARGE,
  },
  large_2: {
    id: 'large_2',
    kind: 'large',
    name: 'Tam giác lớn 2',
    shortLabel: 'TG Lớn 2',
    area: 4,
    areaFractionLatex: '\\frac{4}{16}=\\frac{1}{4}',
    anglesDesc: '90°, 45°, 45°',
    edgesDesc: 'Cạnh góc vuông $2\\sqrt{2}$, cạnh huyền $4$',
    canFlip: false,
    color: '#2563EB',
    edgeColor: '#93C5FD',
    localVertices: LOCAL_LARGE,
  },
  medium: {
    id: 'medium',
    kind: 'medium',
    name: 'Tam giác vừa',
    shortLabel: 'TG Vừa',
    area: 2,
    areaFractionLatex: '\\frac{2}{16}=\\frac{1}{8}',
    anglesDesc: '90°, 45°, 45°',
    edgesDesc: 'Cạnh góc vuông $2$, cạnh huyền $2\\sqrt{2}$',
    canFlip: false,
    color: '#D97706',
    edgeColor: '#FDE68A',
    localVertices: LOCAL_MEDIUM,
  },
  small_1: {
    id: 'small_1',
    kind: 'small',
    name: 'Tam giác nhỏ 1',
    shortLabel: 'TG Nhỏ 1',
    area: 1,
    areaFractionLatex: '\\frac{1}{16}',
    anglesDesc: '90°, 45°, 45°',
    edgesDesc: 'Cạnh góc vuông $\\sqrt{2}$, cạnh huyền $2$',
    canFlip: false,
    color: '#E11D48',
    edgeColor: '#FDA4AF',
    localVertices: LOCAL_SMALL,
  },
  small_2: {
    id: 'small_2',
    kind: 'small',
    name: 'Tam giác nhỏ 2',
    shortLabel: 'TG Nhỏ 2',
    area: 1,
    areaFractionLatex: '\\frac{1}{16}',
    anglesDesc: '90°, 45°, 45°',
    edgesDesc: 'Cạnh góc vuông $\\sqrt{2}$, cạnh huyền $2$',
    canFlip: false,
    color: '#EA580C',
    edgeColor: '#FDBA74',
    localVertices: LOCAL_SMALL,
  },
  square: {
    id: 'square',
    kind: 'square',
    name: 'Hình vuông',
    shortLabel: 'Vuông',
    area: 2,
    areaFractionLatex: '\\frac{2}{16}=\\frac{1}{8}',
    anglesDesc: 'Bốn góc vuông 90°',
    edgesDesc: 'Bốn cạnh bằng $\\sqrt{2}$, đường chéo $2$',
    canFlip: false,
    color: '#10B981',
    edgeColor: '#A7F3D0',
    localVertices: LOCAL_SQUARE,
  },
  parallelogram: {
    id: 'parallelogram',
    kind: 'parallelogram',
    name: 'Hình bình hành',
    shortLabel: 'Bình hành',
    area: 2,
    areaFractionLatex: '\\frac{2}{16}=\\frac{1}{8}',
    anglesDesc: '45°, 135°, 45°, 135°',
    edgesDesc: 'Cạnh đáy $2$, cạnh bên $\\sqrt{2}$ (có thể lật)',
    canFlip: true,
    color: '#7C3AED',
    edgeColor: '#DDD6FE',
    localVertices: LOCAL_PARALLELOGRAM,
  },
};

export function transformLocalVertices(
  localVertices: Vec2[],
  x: number,
  y: number,
  rotationDeg: number,
  flipped: boolean
): Vec2[] {
  const rad = (normalizeRotationDeg(rotationDeg) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const mapped = localVertices.map((v) => {
    const lx = flipped ? -v.x : v.x;
    const ly = v.y;
    return {
      x: lx * cos - ly * sin + x,
      y: lx * sin + ly * cos + y,
    };
  });
  return ensureCCW(mapped);
}

/**
 * Single source of truth for world-space top-face polygon of any Tangram piece.
 */
export function getPieceWorldPolygon(piece: TangramPieceState): Vec2[] {
  const spec = TANGRAM_PIECE_SPECS[piece.id];
  const effectiveFlip = spec.canFlip ? piece.flipped : false;
  return transformLocalVertices(spec.localVertices, piece.x, piece.y, piece.rotationDeg, effectiveFlip);
}

/**
 * Checks whether a candidate `(x, y, rotationDeg, flipped)` produces the exact target polygon
 * (used strictly during built-in puzzle authoring verification).
 */
function findExactTransformForPolygon(
  pieceId: TangramPieceId,
  targetPoly: Vec2[]
): { x: number; y: number; rotationDeg: number; flipped: boolean } {
  const spec = TANGRAM_PIECE_SPECS[pieceId];
  const targetCCW = ensureCCW(targetPoly);
  const targetCenter = polygonCentroid(targetCCW);
  const targetArea = polygonArea(targetCCW);
  const flips = spec.canFlip ? [false, true] : [false];

  for (const flipped of flips) {
    for (let deg = 0; deg < 360; deg += 45) {
      const candidate = transformLocalVertices(spec.localVertices, targetCenter.x, targetCenter.y, deg, flipped);
      const inter = convexIntersectionArea(candidate, targetCCW);
      if (Math.abs(inter - targetArea) < 1e-4 && Math.abs(inter - spec.area) < 1e-4) {
        return { x: targetCenter.x, y: targetCenter.y, rotationDeg: deg, flipped };
      }
    }
  }
  throw new Error(
    `Polygon for piece ${pieceId} does not match canonical Tangram piece geometry (area=${targetArea}).`
  );
}

// ============================================================================
// VERIFIED BUILT-IN PUZZLES ("Dữ liệu mẫu")
// Every target silhouette is derived directly from a verified 7-piece placement!
// ============================================================================

function buildVerifiedTangramPuzzle(params: {
  id: string;
  title: string;
  subtitle: string;
  difficultyLabel: string;
  allowTargetRotation?: boolean;
  allowTargetReflection?: boolean;
  placements: Array<{
    pieceId: TangramPieceId;
    polygon: Vec2[];
    discussionPrompt: string;
  }>;
  level1Hints: Array<{ text: string; speechText: string }>;
  mathInsight: string;
}): TangramPuzzle {
  if (params.placements.length !== 7) {
    throw new Error(`Tangram puzzle ${params.id} must have exactly 7 pieces.`);
  }

  const seenIds = new Set<TangramPieceId>();
  const slots: TangramSolutionSlot[] = [];

  for (const item of params.placements) {
    if (seenIds.has(item.pieceId)) {
      throw new Error(`Duplicate piece ${item.pieceId} in puzzle ${params.id}`);
    }
    seenIds.add(item.pieceId);
    const tf = findExactTransformForPolygon(item.pieceId, item.polygon);
    const spec = TANGRAM_PIECE_SPECS[item.pieceId];
    const verifiedPoly = transformLocalVertices(spec.localVertices, tf.x, tf.y, tf.rotationDeg, tf.flipped);
    slots.push({
      id: `${params.id}_slot_${item.pieceId}`,
      pieceId: item.pieceId,
      kind: spec.kind,
      x: tf.x,
      y: tf.y,
      rotationDeg: tf.rotationDeg,
      flipped: tf.flipped,
      polygon: verifiedPoly,
      discussionPrompt: item.discussionPrompt,
    });
  }

  // Verify zero pairwise overlap & total area = 16
  let totalArea = 0;
  for (let i = 0; i < slots.length; i++) {
    totalArea += polygonArea(slots[i].polygon);
    for (let j = i + 1; j < slots.length; j++) {
      const ov = convexIntersectionArea(slots[i].polygon, slots[j].polygon);
      if (ov > 1e-4) {
        throw new Error(
          `Built-in puzzle ${params.id} has overlapping slots ${slots[i].pieceId} and ${slots[j].pieceId} (overlap=${ov})`
        );
      }
    }
  }
  if (Math.abs(totalArea - 16) > 1e-4) {
    throw new Error(`Built-in puzzle ${params.id} total area must be 16, got ${totalArea}`);
  }

  const outerContours = extractOuterContours(slots.map((s) => s.polygon));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of slots) {
    for (const v of s.polygon) {
      if (v.x < minX) minX = v.x;
      if (v.y < minY) minY = v.y;
      if (v.x > maxX) maxX = v.x;
      if (v.y > maxY) maxY = v.y;
    }
  }

  const paraSlot = slots.find((s) => s.pieceId === 'parallelogram');

  return {
    id: params.id,
    title: params.title,
    subtitle: params.subtitle,
    difficultyLabel: params.difficultyLabel,
    isSample: true,
    requiresParallelogramFlip: Boolean(paraSlot?.flipped),
    allowTargetRotation: params.allowTargetRotation ?? false,
    allowTargetReflection: params.allowTargetReflection ?? false,
    bounds: { minX, minY, maxX, maxY },
    solutionSlots: slots,
    outerContours,
    level1Hints: params.level1Hints,
    mathInsight: params.mathInsight,
  };
}

export const TANGRAM_SAMPLE_PUZZLES: TangramPuzzle[] = [
  // 1. EXACT REQUIRED MASTER SQUARE (0,0)-(4,0)-(4,4)-(0,4)
  buildVerifiedTangramPuzzle({
    id: 'f02_square_master',
    title: 'Hình vuông chuẩn 4×4',
    subtitle: 'Bài mẫu kiểm thử · Tổng diện tích 16 đơn vị vuông',
    difficultyLabel: 'Cơ bản',
    placements: [
      {
        pieceId: 'large_1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 2 },
        ],
        discussionPrompt:
          'Vùng đáy là tam giác vuông cân có cạnh huyền bằng $4$, diện tích $\\frac{4}{16}=\\frac{1}{4}$ hình vuông. Hai tam giác lớn đều phù hợp và có thể đổi chỗ cho nhau.',
      },
      {
        pieceId: 'large_2',
        polygon: [
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 2 },
        ],
        discussionPrompt:
          'Vùng cạnh phải cũng là tam giác vuông cân có cạnh huyền bằng $4$, ghép với đáy tạo góc vuông $90^\\circ$ tại đỉnh $(4,0)$.',
      },
      {
        pieceId: 'medium',
        polygon: [
          { x: 0, y: 2 },
          { x: 0, y: 4 },
          { x: 2, y: 4 },
        ],
        discussionPrompt:
          'Góc trên bên trái là tam giác vuông cân có hai cạnh góc vuông bằng $2$, diện tích $\\frac{2}{16}=\\frac{1}{8}$ hình vuông.',
      },
      {
        pieceId: 'small_1',
        polygon: [
          { x: 0, y: 0 },
          { x: 0, y: 2 },
          { x: 1, y: 1 },
        ],
        discussionPrompt:
          'Góc dưới bên trái là tam giác vuông cân nhỏ có cạnh huyền bằng $2$, diện tích $\\frac{1}{16}$ hình vuông.',
      },
      {
        pieceId: 'small_2',
        polygon: [
          { x: 1, y: 3 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
        discussionPrompt:
          'Ô trung tâm phía trên là tam giác vuông cân nhỏ thứ hai. Hai tam giác nhỏ cộng lại chiếm $\\frac{2}{16}=\\frac{1}{8}$ diện tích hình vuông.',
      },
      {
        pieceId: 'square',
        polygon: [
          { x: 0, y: 2 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 1, y: 3 },
        ],
        discussionPrompt:
          'Ô hình thoi xoay $45^\\circ$ ở giữa bên trái chính là Hình vuông có bốn góc $90^\\circ$ và cạnh $\\sqrt{2}$, diện tích $\\frac{2}{16}=\\frac{1}{8}$.',
      },
      {
        pieceId: 'parallelogram',
        polygon: [
          { x: 1, y: 3 },
          { x: 3, y: 3 },
          { x: 4, y: 4 },
          { x: 2, y: 4 },
        ],
        discussionPrompt:
          'Dải nghiêng ở cạnh trên có hai góc $45^\\circ$ và hai góc $135^\\circ$, cạnh đáy $2$ — đó là Hình bình hành (không cần lật trong bài này).',
      },
    ],
    level1Hints: [
      {
        text: 'Quan sát hai cạnh dài bằng $4$ ở đáy và mép phải: hai **Tam giác lớn** chiếm một nửa hình vuông ($\\frac{4+4}{16}=\\frac{1}{2}$) và gặp nhau tại tâm $(2,2)$.',
        speechText: 'Quan sát hai cạnh dài bằng 4 ở đáy và mép phải: hai tam giác lớn chiếm một nửa hình vuông và gặp nhau tại tâm.',
      },
      {
        text: 'Góc trên bên trái có hai cạnh vuông góc bằng $2$, vừa khít **Tam giác vừa** ($\\frac{2}{16}=\\frac{1}{8}$ diện tích).',
        speechText: 'Góc trên bên trái có hai cạnh vuông góc bằng 2, vừa khít tam giác vừa.',
      },
      {
        text: 'Hai **Tam giác nhỏ** cùng chiếm $\\frac{2}{16}=\\frac{1}{8}$ diện tích hình vuông và kẹp hai bên **Hình vuông** xoay $45^\\circ$.',
        speechText: 'Hai tam giác nhỏ kẹp hai bên hình vuông xoay 45 độ, phần dải nghiêng trên cùng dành cho hình bình hành.',
      },
    ],
    mathInsight:
      'Tổng diện tích 7 mảnh bằng $4 + 4 + 2 + 1 + 1 + 2 + 2 = 16$ đơn vị vuông. Hai tam giác nhỏ chiếm $\\frac{2}{16}=\\frac{1}{8}$ diện tích hình vuông; xoay hoặc lật mảnh luôn bảo toàn diện tích.',
  }),

  // 2. BIG RIGHT TRIANGLE (REQUIRES FLIPPING PARALLELOGRAM!)
  buildVerifiedTangramPuzzle({
    id: 'f02_big_triangle',
    title: 'Tam giác đỉnh núi (cần lật)',
    subtitle: 'Thử thách 1 · Tam giác vuông cân lớn đáy 8, cao 4',
    difficultyLabel: 'Trung bình',
    placements: [
      {
        pieceId: 'large_1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 2 },
        ],
        discussionPrompt: 'Đáy trái dài $4$ đơn vị, hợp với cạnh chéo $45^\\circ$ — phù hợp cho một Tam giác lớn.',
      },
      {
        pieceId: 'large_2',
        polygon: [
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 2 },
        ],
        discussionPrompt: 'Nửa trên bên trái nối đỉnh $(4,4)$ xuống đáy $(4,0)$, vừa khít Tam giác lớn thứ hai.',
      },
      {
        pieceId: 'medium',
        polygon: [
          { x: 4, y: 0 },
          { x: 6, y: 0 },
          { x: 4, y: 2 },
        ],
        discussionPrompt: 'Góc vuông tại $(4,0)$ bên phải có hai cạnh bằng $2$, khớp với Tam giác vừa.',
      },
      {
        pieceId: 'small_1',
        polygon: [
          { x: 4, y: 2 },
          { x: 5, y: 3 },
          { x: 4, y: 4 },
        ],
        discussionPrompt: 'Đỉnh nhọn bên phải gần đỉnh $(4,4)$ là Tam giác nhỏ với cạnh huyền $2$.',
      },
      {
        pieceId: 'small_2',
        polygon: [
          { x: 5, y: 1 },
          { x: 7, y: 1 },
          { x: 6, y: 2 },
        ],
        discussionPrompt: 'Tam giác nhỏ thứ hai nằm trên dải giữa, chạm đỉnh với Hình vuông và Hình bình hành.',
      },
      {
        pieceId: 'square',
        polygon: [
          { x: 4, y: 2 },
          { x: 5, y: 1 },
          { x: 6, y: 2 },
          { x: 5, y: 3 },
        ],
        discussionPrompt: 'Hình vuông xoay $45^\\circ$ đặt sát trục đối xứng $x=4$.',
      },
      {
        pieceId: 'parallelogram',
        polygon: [
          { x: 6, y: 0 },
          { x: 8, y: 0 },
          { x: 7, y: 1 },
          { x: 5, y: 1 },
        ],
        discussionPrompt:
          'Góc nhọn dưới bên phải nghiêng sang trái — cần **lật Hình bình hành** để cạnh nghiêng khớp mép phải!',
      },
    ],
    level1Hints: [
      {
        text: 'Tam giác đích có đáy $8$, chiều cao $4$, diện tích $S = \\frac{1}{2}\\cdot 8 \\cdot 4 = 16$. Hãy chia đôi theo trục đứng ở giữa để đặt hai **Tam giác lớn** vào nửa bên trái.',
        speechText: 'Tam giác đích có đáy 8, chiều cao 4, diện tích bằng 16. Hãy chia đôi theo trục đứng ở giữa và đặt hai tam giác lớn vào nửa bên trái.',
      },
      {
        text: 'Chú ý góc nhọn $45^\\circ$ ở đáy phải: hãy thử **Lật Hình bình hành** để chiều nghiêng khớp với mép chéo bên phải (phép đối xứng giữ nguyên diện tích $\\frac{2}{16}=\\frac{1}{8}$).',
        speechText: 'Chú ý góc nhọn ở đáy phải: hãy thử lật hình bình hành để chiều nghiêng khớp với mép chéo bên phải.',
      },
    ],
    mathInsight:
      'Tam giác đích có diện tích $S = \\frac{1}{2} \\times 8 \\times 4 = 16$ bằng đúng diện tích hình vuông mẫu. Phép lật (đối xứng trục) thay đổi hướng nghiêng của hình bình hành nhưng luôn bảo toàn diện tích.',
  }),

  // 3. SAILBOAT (REQUIRES FLIPPING PARALLELOGRAM!)
  buildVerifiedTangramPuzzle({
    id: 'f02_sailboat',
    title: 'Thuyền buồm ra khơi (cần lật)',
    subtitle: 'Thử thách 2 · Thân thuyền nghiêng và hai cánh buồm lớn',
    difficultyLabel: 'Trung bình',
    placements: [
      {
        pieceId: 'parallelogram',
        polygon: [
          { x: 1, y: 0 },
          { x: 3, y: 0 },
          { x: 2, y: 1 },
          { x: 0, y: 1 },
        ],
        discussionPrompt: 'Mũi thuyền bên trái nghiêng sang trái — cần **lật Hình bình hành** để tạo mũi thuyền.',
      },
      {
        pieceId: 'small_1',
        polygon: [
          { x: 3, y: 0 },
          { x: 4, y: 1 },
          { x: 2, y: 1 },
        ],
        discussionPrompt: 'Phần giữa thân thuyền ghép từ một Tam giác nhỏ lật mũi xuống đáy.',
      },
      {
        pieceId: 'small_2',
        polygon: [
          { x: 3, y: 0 },
          { x: 5, y: 0 },
          { x: 4, y: 1 },
        ],
        discussionPrompt: 'Đuôi thuyền bên phải dùng Tam giác nhỏ thứ hai, ghép cùng Tam giác nhỏ 1 tạo phần đáy dài $4$.',
      },
      {
        pieceId: 'large_1',
        polygon: [
          { x: 2, y: 1 },
          { x: 2, y: 5 },
          { x: 0, y: 3 },
        ],
        discussionPrompt: 'Cánh buồm đứng bên trái có cột buồm dài $4$ đơn vị — đặt một Tam giác lớn.',
      },
      {
        pieceId: 'large_2',
        polygon: [
          { x: 2, y: 1 },
          { x: 6, y: 1 },
          { x: 4, y: 3 },
        ],
        discussionPrompt: 'Cánh buồm thấp bên phải trải dọc boong thuyền dài $4$ đơn vị — đặt Tam giác lớn còn lại.',
      },
      {
        pieceId: 'square',
        polygon: [
          { x: 2, y: 3 },
          { x: 3, y: 2 },
          { x: 4, y: 3 },
          { x: 3, y: 4 },
        ],
        discussionPrompt: 'Phần thân buồm phụ xoay $45^\\circ$ nằm gọn giữa cột buồm và cánh buồm phải.',
      },
      {
        pieceId: 'medium',
        polygon: [
          { x: 2, y: 3 },
          { x: 4, y: 5 },
          { x: 2, y: 5 },
        ],
        discussionPrompt: 'Lá cờ chóp buồm ở trên cùng có hai cạnh vuông góc bằng $2$ — khớp với Tam giác vừa.',
      },
    ],
    level1Hints: [
      {
        text: 'Tách hình thành hai phần tại đường boong ngang $y=1$: thân thuyền ở dưới chiếm $\\frac{4}{16}=\\frac{1}{4}$ diện tích, phần cánh buồm phía trên chiếm $\\frac{12}{16}=\\frac{3}{4}$.',
        speechText: 'Tách hình thành hai phần tại đường boong ngang: thân thuyền ở dưới chiếm 1 phần 4 diện tích, phần cánh buồm phía trên chiếm 3 phần 4.',
      },
      {
        text: 'Thân thuyền gồm **Hình bình hành đã lật** ở mũi trái và hai **Tam giác nhỏ** ở phía sau. Hai **Tam giác lớn** tạo hai cánh buồm chính.',
        speechText: 'Thân thuyền gồm hình bình hành đã lật ở mũi trái và hai tam giác nhỏ. Hai tam giác lớn tạo hai cánh buồm chính.',
      },
    ],
    mathInsight:
      'Thân thuyền gồm hình bình hành ($2$) và hai tam giác nhỏ ($1+1$), chiếm $\\frac{4}{16}=\\frac{1}{4}$ tổng diện tích; hai cánh buồm lớn chiếm $\\frac{8}{16}=\\frac{1}{2}$ diện tích toàn hình.',
  }),

  // 4. BIG PARALLELOGRAM (UNFLIPPED PARALLELOGRAM, AREA = 4 * 4 = 16)
  buildVerifiedTangramPuzzle({
    id: 'f02_big_parallelogram',
    title: 'Hình bình hành lớn',
    subtitle: 'Thử thách 3 · Đáy 4, chiều cao 4, diện tích không đổi 16',
    difficultyLabel: 'Cơ bản',
    placements: [
      {
        pieceId: 'large_1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 2 },
        ],
        discussionPrompt: 'Cạnh đáy dài $4$ là cạnh huyền của Tam giác lớn 1.',
      },
      {
        pieceId: 'large_2',
        polygon: [
          { x: 4, y: 0 },
          { x: 4, y: 4 },
          { x: 2, y: 2 },
        ],
        discussionPrompt: 'Tam giác lớn 2 tạo nửa dưới bên phải, gặp Tam giác lớn 1 tại góc vuông.',
      },
      {
        pieceId: 'medium',
        polygon: [
          { x: 4, y: 2 },
          { x: 4, y: 4 },
          { x: 6, y: 4 },
        ],
        discussionPrompt: 'Góc trên ở giữa có hai cạnh bằng $2$ vuông góc nhau — khớp Tam giác vừa.',
      },
      {
        pieceId: 'small_1',
        polygon: [
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 5, y: 1 },
        ],
        discussionPrompt: 'Tam giác nhỏ 1 đặt sát cạnh chéo phải phía dưới.',
      },
      {
        pieceId: 'small_2',
        polygon: [
          { x: 5, y: 3 },
          { x: 6, y: 2 },
          { x: 7, y: 3 },
        ],
        discussionPrompt: 'Tam giác nhỏ 2 lấp khoảng tam giác giữa Hình vuông và Hình bình hành.',
      },
      {
        pieceId: 'square',
        polygon: [
          { x: 4, y: 2 },
          { x: 5, y: 1 },
          { x: 6, y: 2 },
          { x: 5, y: 3 },
        ],
        discussionPrompt: 'Hình vuông xoay $45^\\circ$ nằm tại trung tâm nửa bên phải.',
      },
      {
        pieceId: 'parallelogram',
        polygon: [
          { x: 5, y: 3 },
          { x: 7, y: 3 },
          { x: 8, y: 4 },
          { x: 6, y: 4 },
        ],
        discussionPrompt: 'Hình bình hành nhỏ hoàn thiện góc nhọn $45^\\circ$ trên cùng bên phải.',
      },
    ],
    level1Hints: [
      {
        text: 'Hình bình hành lớn có đáy $a=4$, chiều cao $h=4$, diện tích $S = a \\cdot h = 16$. Nửa bên trái chính là hai **Tam giác lớn** ghép vuông góc.',
        speechText: 'Hình bình hành lớn có đáy 4, chiều cao 4, diện tích bằng 16. Nửa bên trái là hai tam giác lớn ghép vuông góc.',
      },
      {
        text: 'Nửa bên phải là phép tịnh tiến phần trên của hình vuông chuẩn: gồm **Tam giác vừa**, **Hình vuông**, hai **Tam giác nhỏ** và **Hình bình hành** ở đỉnh phải.',
        speechText: 'Nửa bên phải gồm tam giác vừa, hình vuông, hai tam giác nhỏ và hình bình hành ở đỉnh trên bên phải.',
      },
    ],
    mathInsight:
      'Cắt và dịch chuyển nửa hình vuông theo phương ngang tạo thành hình bình hành có cùng đáy $a=4$, chiều cao $h=4$, nên $S = 4 \\times 4 = 16$ không thay đổi.',
  }),

  // 5. HOUSE WITH PORCH & CHIMNEY (REQUIRES FLIPPED PARALLELOGRAM)
  buildVerifiedTangramPuzzle({
    id: 'f02_house',
    title: 'Ngôi nhà mái nhọn',
    subtitle: 'Thử thách 4 · Mái tam giác cân, hiên nghiêng và ống khói',
    difficultyLabel: 'Nâng cao',
    placements: [
      {
        pieceId: 'large_1',
        polygon: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 2, y: 2 },
        ],
        discussionPrompt: 'Phần nền nhà trải rộng đáy $4$ đơn vị — dùng một Tam giác lớn.',
      },
      {
        pieceId: 'medium',
        polygon: [
          { x: 0, y: 0 },
          { x: 2, y: 2 },
          { x: 0, y: 2 },
        ],
        discussionPrompt: 'Tường bên trái có hai cạnh vuông góc bằng $2$ — đặt Tam giác vừa.',
      },
      {
        pieceId: 'small_1',
        polygon: [
          { x: 4, y: 0 },
          { x: 4, y: 2 },
          { x: 3, y: 1 },
        ],
        discussionPrompt: 'Tường phải ghép từ hai Tam giác nhỏ chạm cạnh nhau.',
      },
      {
        pieceId: 'small_2',
        polygon: [
          { x: 2, y: 2 },
          { x: 3, y: 1 },
          { x: 4, y: 2 },
        ],
        discussionPrompt: 'Tam giác nhỏ thứ hai lấp kín góc trên của tường phải.',
      },
      {
        pieceId: 'large_2',
        polygon: [
          { x: 0, y: 2 },
          { x: 4, y: 2 },
          { x: 2, y: 4 },
        ],
        discussionPrompt: 'Mái nhà chính là Tam giác lớn thứ hai có cạnh huyền ngang dài $4$.',
      },
      {
        pieceId: 'square',
        polygon: [
          { x: 3, y: 3 },
          { x: 4, y: 2 },
          { x: 5, y: 3 },
          { x: 4, y: 4 },
        ],
        discussionPrompt: 'Ô cửa mái / ống khói hình thoi xoay $45^\\circ$ tựa vào sườn mái phải.',
      },
      {
        pieceId: 'parallelogram',
        polygon: [
          { x: 4, y: 0 },
          { x: 5, y: 1 },
          { x: 5, y: 3 },
          { x: 4, y: 2 },
        ],
        discussionPrompt: 'Mái hiên bên phải dựng đứng dài $2$ và nghiêng lên trên — cần lật Hình bình hành.',
      },
    ],
    level1Hints: [
      {
        text: 'Thân nhà là hình chữ nhật $4 \\times 2$ (diện tích $8 = \\frac{1}{2}$ tổng diện tích), bên trên là mái **Tam giác lớn** đáy $4$.',
        speechText: 'Thân nhà là hình chữ nhật 4 nhân 2 có diện tích bằng 8, bên trên là mái tam giác lớn đáy 4.',
      },
      {
        text: 'Bên phải ngôi nhà có hiên nghiêng (**Hình bình hành đã lật** dựng đứng) nối tiếp với **Hình vuông** xoay $45^\\circ$ tựa lên mái.',
        speechText: 'Bên phải ngôi nhà có hình bình hành đã lật dựng đứng nối tiếp với hình vuông xoay 45 độ tựa lên mái.',
      },
    ],
    mathInsight:
      'Thân nhà chiếm $8$ đơn vị vuông ($\\frac{1}{2}$), mái lớn chiếm $4$ ($\\frac{1}{4}$), hiên và ống khói mỗi phần chiếm $2$ ($\\frac{1}{8}$), tổng bằng $16$.',
  }),
];

export function getTangramPuzzleById(id: string): TangramPuzzle {
  return TANGRAM_SAMPLE_PUZZLES.find((p) => p.id === id) ?? TANGRAM_SAMPLE_PUZZLES[0];
}

// ============================================================================
// GEOMETRIC COMPLETION EVALUATOR (INDEPENDENT OF SCREEN / ZOOM / ID / COLOR)
// ============================================================================

function transformPoint(p: Vec2, cx: number, cy: number, rotDeg: number, reflectX: boolean): Vec2 {
  const lx = reflectX ? -(p.x - cx) : p.x - cx;
  const ly = p.y - cy;
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: lx * cos - ly * sin + cx,
    y: lx * sin + ly * cos + cy,
  };
}

function evaluateAgainstTargetPolygons(
  pieces: Record<TangramPieceId, TangramPieceState>,
  targetPolygons: Vec2[][]
): TangramGeometryEvaluation {
  const placedIds = TANGRAM_PIECE_ORDER.filter((id) => pieces[id].onBoard);
  const placedPolys = new Map<TangramPieceId, Vec2[]>();
  for (const id of placedIds) {
    placedPolys.set(id, getPieceWorldPolygon(pieces[id]));
  }

  // 1. Pairwise overlap check across all placed pieces
  let totalOverlapArea = 0;
  let maxPairwiseOverlap = 0;
  const overlappingPairs: Array<{ a: TangramPieceId; b: TangramPieceId; area: number }> = [];

  for (let i = 0; i < placedIds.length; i++) {
    const idA = placedIds[i];
    const polyA = placedPolys.get(idA)!;
    for (let j = i + 1; j < placedIds.length; j++) {
      const idB = placedIds[j];
      const polyB = placedPolys.get(idB)!;
      const ov = convexIntersectionArea(polyA, polyB);
      if (ov > 1e-5) {
        totalOverlapArea += ov;
        if (ov > maxPairwiseOverlap) maxPairwiseOverlap = ov;
        if (ov > OVERLAP_EPS) {
          overlappingPairs.push({ a: idA, b: idB, area: ov });
        }
      }
    }
  }

  // 2. Exact inside coverage & outside overflow for each placed piece
  // Because targetPolygons (T_1..T_7) are pairwise disjoint, Area(P_i ∩ T) = sum_k Area(P_i ∩ T_k) EXACTLY!
  const targetTotalArea = targetPolygons.reduce((sum, tp) => sum + polygonArea(tp), 0);
  let totalInsideArea = 0;
  let totalOutsideArea = 0;
  const outsidePieces: Array<{ id: TangramPieceId; outsideArea: number }> = [];

  for (const id of placedIds) {
    const poly = placedPolys.get(id)!;
    const pArea = TANGRAM_PIECE_SPECS[id].area;
    let inside = 0;
    for (const tp of targetPolygons) {
      inside += convexIntersectionArea(poly, tp);
    }
    const clampedInside = Math.min(pArea, inside);
    const outside = Math.max(0, pArea - clampedInside);
    totalInsideArea += clampedInside;
    totalOutsideArea += outside;
    if (outside > OUTSIDE_EPS / 2) {
      outsidePieces.push({ id, outsideArea: outside });
    }
  }

  // Uncovered interior hole area (accounting conservatively for any overlap)
  const effectiveCovered = Math.max(0, Math.min(targetTotalArea, totalInsideArea - totalOverlapArea));
  const uncoveredInsideArea = Math.max(0, targetTotalArea - effectiveCovered);
  const coverageRatio = targetTotalArea > 0 ? effectiveCovered / targetTotalArea : 0;

  const allSevenPlaced = placedIds.length === 7;
  const isCompleted =
    allSevenPlaced &&
    maxPairwiseOverlap <= OVERLAP_EPS &&
    totalOverlapArea <= TOTAL_OVERLAP_EPS &&
    totalOutsideArea <= OUTSIDE_EPS &&
    uncoveredInsideArea <= UNCOVERED_EPS;

  return {
    placedCount: placedIds.length,
    allSevenPlaced,
    totalOverlapArea,
    maxPairwiseOverlap,
    overlappingPairs,
    totalInsideArea,
    totalOutsideArea,
    uncoveredInsideArea,
    outsidePieces,
    coverageRatio,
    isCompleted,
  };
}

/**
 * Evaluates current Tangram board strictly in board coordinates.
 * Respects puzzle's allowTargetRotation / allowTargetReflection rules.
 */
export function evaluateTangramBoard(
  pieces: Record<TangramPieceId, TangramPieceState>,
  puzzle: TangramPuzzle
): TangramGeometryEvaluation {
  const basePolys = puzzle.solutionSlots.map((s) => s.polygon);
  let best = evaluateAgainstTargetPolygons(pieces, basePolys);
  if (best.isCompleted || (!puzzle.allowTargetRotation && !puzzle.allowTargetReflection)) {
    return best;
  }

  const cx = (puzzle.bounds.minX + puzzle.bounds.maxX) / 2;
  const cy = (puzzle.bounds.minY + puzzle.bounds.maxY) / 2;
  const rotations = puzzle.allowTargetRotation ? [0, 45, 90, 135, 180, 225, 270, 315] : [0];
  const reflections = puzzle.allowTargetReflection ? [false, true] : [false];

  for (const reflect of reflections) {
    for (const rot of rotations) {
      if (!reflect && rot === 0) continue;
      const transformed = basePolys.map((poly) =>
        ensureCCW(poly.map((v) => transformPoint(v, cx, cy, rot, reflect)))
      );
      const ev = evaluateAgainstTargetPolygons(pieces, transformed);
      if (ev.isCompleted) return ev;
      if (ev.coverageRatio > best.coverageRatio) best = ev;
    }
  }
  return best;
}

// ============================================================================
// OVERLAP CHECK & MAGNETIC SNAPPING
// ============================================================================

export function findOverlappingPieceIds(
  pieces: Record<TangramPieceId, TangramPieceState>,
  candidate: TangramPieceState
): TangramPieceId[] {
  if (!candidate.onBoard) return [];
  const candPoly = getPieceWorldPolygon(candidate);
  const hits: TangramPieceId[] = [];
  for (const id of TANGRAM_PIECE_ORDER) {
    if (id === candidate.id) continue;
    const other = pieces[id];
    if (!other.onBoard) continue;
    const ov = convexIntersectionArea(candPoly, getPieceWorldPolygon(other));
    if (ov > OVERLAP_EPS) {
      hits.push(id);
    }
  }
  return hits;
}

/**
 * Gently snaps a candidate piece's vertices toward nearby target vertices,
 * already-placed piece vertices, or clean 0.25-unit board grid points — ONLY if
 * the snapped position remains non-overlapping.
 */
export function snapPieceOnBoard(
  candidate: TangramPieceState,
  pieces: Record<TangramPieceId, TangramPieceState>,
  puzzle: TangramPuzzle | null,
  mode: TangramPlayMode
): { piece: TangramPieceState; snapped: boolean } {
  const candPoly = getPieceWorldPolygon(candidate);
  const anchorPoints: Vec2[] = [];

  // 1. Target silhouette & slot vertices (in guided/challenge modes)
  if (puzzle && mode !== 'free') {
    for (const contour of puzzle.outerContours) {
      for (const v of contour) anchorPoints.push(v);
    }
    for (const slot of puzzle.solutionSlots) {
      for (const v of slot.polygon) anchorPoints.push(v);
    }
  }

  // 2. Vertices of other pieces already placed on board
  for (const id of TANGRAM_PIECE_ORDER) {
    if (id === candidate.id || !pieces[id].onBoard) continue;
    for (const v of getPieceWorldPolygon(pieces[id])) {
      anchorPoints.push(v);
    }
  }

  // Collect best vertex-to-anchor deltas within SNAP_RADIUS
  const bestDeltas: Array<{ dx: number; dy: number; dist: number }> = [];
  for (const pv of candPoly) {
    for (const av of anchorPoints) {
      const dx = av.x - pv.x;
      const dy = av.y - pv.y;
      const d = Math.hypot(dx, dy);
      if (d <= SNAP_RADIUS) {
        bestDeltas.push({ dx, dy, dist: d });
      }
    }
  }

  bestDeltas.sort((a, b) => a.dist - b.dist);

  for (const cand of bestDeltas.slice(0, 12)) {
    const moved: TangramPieceState = {
      ...candidate,
      x: Math.round((candidate.x + cand.dx) * 10000) / 10000,
      y: Math.round((candidate.y + cand.dy) * 10000) / 10000,
    };
    if (findOverlappingPieceIds(pieces, moved).length === 0) {
      return { piece: moved, snapped: true };
    }
  }

  // Fallback: gentle 0.25-unit grid snap on piece centroid
  const gridMoved: TangramPieceState = {
    ...candidate,
    x: Math.round(candidate.x / GRID_SNAP_STEP) * GRID_SNAP_STEP,
    y: Math.round(candidate.y / GRID_SNAP_STEP) * GRID_SNAP_STEP,
  };
  if (
    Math.hypot(gridMoved.x - candidate.x, gridMoved.y - candidate.y) <= 0.16 &&
    findOverlappingPieceIds(pieces, gridMoved).length === 0
  ) {
    return { piece: gridMoved, snapped: false };
  }

  return { piece: candidate, snapped: false };
}

// ============================================================================
// TWO-LEVEL EXPLAINABLE HINT ENGINE (WITH BLOCKER DETECTION & EXPLICIT APPLY)
// ============================================================================

function doesPieceMatchSlot(piece: TangramPieceState, slot: TangramSolutionSlot): boolean {
  if (!piece.onBoard) return false;
  if (TANGRAM_PIECE_SPECS[piece.id].kind !== slot.kind) return false;
  const poly = getPieceWorldPolygon(piece);
  const inter = convexIntersectionArea(poly, slot.polygon);
  return Math.abs(inter - TANGRAM_PIECE_SPECS[piece.id].area) <= 0.06;
}

export function computeTangramHint(
  state: TangramGameState,
  level: 1 | 2,
  level1Index = 0
): TangramHintResult {
  if (state.mode === 'free') {
    const msg = 'Chế độ Ghép tự do không có hình đích cố định. Hãy thỏa sức sáng tạo và đặt tên cho tác phẩm của bạn!';
    return {
      level,
      status: 'not_applicable',
      title: 'Chế độ Ghép tự do',
      explanation: msg,
      speechText: msg,
      blockingPieceIds: [],
    };
  }

  const puzzle = getTangramPuzzleById(state.puzzleId);
  const evalResult = evaluateTangramBoard(state.pieces, puzzle);
  if (evalResult.isCompleted) {
    const msg = 'Hình ghép đã hoàn thành hợp lệ với đủ 7 mảnh!';
    return {
      level,
      status: 'already_complete',
      title: 'Đã hoàn thành',
      explanation: msg,
      speechText: msg,
      blockingPieceIds: [],
    };
  }

  // Check if any currently placed piece protrudes outside target OR blocks every feasible remaining slot
  const outsideIds = evalResult.outsidePieces.map((o) => o.id);
  const matchedSlots = new Set<string>();
  const matchedPieceIds = new Set<TangramPieceId>();

  for (const id of TANGRAM_PIECE_ORDER) {
    const piece = state.pieces[id];
    if (!piece.onBoard) continue;
    for (const slot of puzzle.solutionSlots) {
      if (matchedSlots.has(slot.id)) continue;
      if (doesPieceMatchSlot(piece, slot)) {
        matchedSlots.add(slot.id);
        matchedPieceIds.add(id);
        break;
      }
    }
  }

  // Level 1: Observation of angles/edges/area ratios
  if (level === 1) {
    if (outsideIds.length > 0) {
      const names = outsideIds.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
      const explanation = `Quan sát đường bao hình đích: mảnh **${names}** đang vượt ra ngoài đường bao. Hãy xoay hoặc đưa mảnh về khay để thử lại.`;
      const speechText = `Quan sát đường bao hình đích: mảnh ${names} đang vượt ra ngoài đường bao. Hãy xoay hoặc điều chỉnh lại mảnh này.`;
      return {
        level: 1,
        status: 'blocked',
        title: 'Mảnh đang vượt đường bao',
        explanation,
        speechText,
        blockingPieceIds: outsideIds,
      };
    }

    const hintItem = puzzle.level1Hints[level1Index % puzzle.level1Hints.length];
    return {
      level: 1,
      status: 'ok',
      title: 'Gợi ý Mức 1 · Quan sát cạnh & góc',
      explanation: hintItem.text,
      speechText: hintItem.speechText,
      blockingPieceIds: [],
    };
  }

  // Level 2: Show one feasible piece placement (without applying until user clicks "Áp dụng gợi ý")
  if (outsideIds.length > 0) {
    const names = outsideIds.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
    const explanation = `Mảnh **${names}** đang nằm ngoài đường bao hình đích và cản trở cách ghép khả thi. Hãy chỉnh hoặc đưa mảnh này về khay trước khi áp dụng gợi ý.`;
    const speechText = `Mảnh ${names} đang vượt ra ngoài đường bao hình đích. Hãy chỉnh hoặc đưa mảnh này về khay trước.`;
    return {
      level: 2,
      status: 'blocked',
      title: 'Cần xem lại mảnh đang đặt',
      explanation,
      speechText,
      blockingPieceIds: outsideIds,
    };
  }

  // Find an unfilled solution slot that does NOT collide with currently placed pieces
  const remainingSlots = puzzle.solutionSlots.filter((s) => !matchedSlots.has(s.id));
  const availablePieces = TANGRAM_PIECE_ORDER.filter((id) => !matchedPieceIds.has(id));

  // Prefer pieces currently still in the tray so we don't move an already-placed piece unnecessarily
  const sortedAvailable = [...availablePieces].sort((a, b) => {
    const aOn = state.pieces[a].onBoard ? 1 : 0;
    const bOn = state.pieces[b].onBoard ? 1 : 0;
    return aOn - bOn;
  });

  for (const slot of remainingSlots) {
    const matchingPieceId = sortedAvailable.find(
      (id) => TANGRAM_PIECE_SPECS[id].kind === slot.kind && !state.pieces[id].onBoard
    );
    if (!matchingPieceId) continue;

    const candidate: TangramPieceState = {
      id: matchingPieceId,
      onBoard: true,
      x: slot.x,
      y: slot.y,
      rotationDeg: slot.rotationDeg,
      flipped: TANGRAM_PIECE_SPECS[matchingPieceId].canFlip ? slot.flipped : false,
    };

    const blockers = findOverlappingPieceIds(state.pieces, candidate);
    if (blockers.length === 0) {
      const spec = TANGRAM_PIECE_SPECS[matchingPieceId];
      const flipNote =
        spec.canFlip && slot.flipped
          ? ' (cần **lật mặt** để đổi chiều nghiêng, giữ nguyên diện tích)'
          : '';
      const explanation = `Đặt **${spec.name}** (diện tích $${spec.areaFractionLatex}$ hình vuông) vào vùng viền vàng${flipNote}. ${slot.discussionPrompt}`;
      const speechText = `Thử đặt ${spec.name} vào vùng viền vàng đang minh họa${
        spec.canFlip && slot.flipped ? ', nhớ lật hình bình hành' : ''
      }. Bấm Áp dụng gợi ý nếu bạn muốn đặt mảnh vào vị trí này.`;
      return {
        level: 2,
        status: 'ok',
        title: `Gợi ý Mức 2 · Vị trí cho ${spec.name}`,
        explanation,
        speechText,
        blockingPieceIds: [],
        suggestedMove: {
          pieceId: matchingPieceId,
          x: candidate.x,
          y: candidate.y,
          rotationDeg: candidate.rotationDeg,
          flipped: candidate.flipped,
          polygon: getPieceWorldPolygon(candidate),
        },
      };
    }
  }

  // If every remaining slot is blocked by misplaced on-board pieces, identify the exact blocking pieces!
  const blockerSet = new Set<TangramPieceId>();
  for (const id of TANGRAM_PIECE_ORDER) {
    if (state.pieces[id].onBoard && !matchedPieceIds.has(id)) {
      blockerSet.add(id);
    }
  }
  const blockerList = Array.from(blockerSet);
  const blockerNames = blockerList.map((id) => TANGRAM_PIECE_SPECS[id].name).join(', ');
  const explanation =
    blockerList.length > 0
      ? `Vị trí hiện tại của mảnh **${blockerNames}** đang chắn các vị trí ghép khả thi cho những mảnh còn lại. Hãy xoay, dịch chuyển hoặc đưa mảnh này về khay để mở không gian.`
      : 'Hãy thử xoay hoặc sắp xếp lại các mảnh đang có trên bàn để mở khoảng trống cho các mảnh còn lại.';
  const speechText =
    blockerList.length > 0
      ? `Vị trí hiện tại của mảnh ${blockerNames} đang cản trở cách ghép khả thi. Hãy xem lại hoặc đưa mảnh này về khay.`
      : 'Hãy xem lại vị trí các mảnh đang đặt trên bàn.';

  return {
    level: 2,
    status: 'blocked',
    title: 'Vị trí hiện tại đang cản gợi ý',
    explanation,
    speechText,
    blockingPieceIds: blockerList,
  };
}

// ============================================================================
// IMMUTABLE STATE MANAGEMENT (INIT, PLACE, ROTATE, FLIP, RETURN, UNDO, HINT)
// ============================================================================

export function createInitialPiecesInTray(): Record<TangramPieceId, TangramPieceState> {
  const pieces = {} as Record<TangramPieceId, TangramPieceState>;
  for (const id of TANGRAM_PIECE_ORDER) {
    pieces[id] = {
      id,
      onBoard: false,
      x: 2,
      y: 2,
      rotationDeg: 0,
      flipped: false,
    };
  }
  return pieces;
}

export function clonePieces(
  pieces: Record<TangramPieceId, TangramPieceState>
): Record<TangramPieceId, TangramPieceState> {
  const out = {} as Record<TangramPieceId, TangramPieceState>;
  for (const id of TANGRAM_PIECE_ORDER) {
    out[id] = { ...pieces[id] };
  }
  return out;
}

export function createTangramGameState(options?: {
  mode?: TangramPlayMode;
  puzzleId?: string;
  classroomEnabled?: boolean;
  groupCount?: number;
  timerEnabled?: boolean;
}): TangramGameState {
  const mode = options?.mode ?? 'guided';
  const puzzleId = mode === 'guided' ? 'f02_square_master' : options?.puzzleId ?? 'f02_square_master';
  return {
    mode,
    puzzleId,
    pieces: createInitialPiecesInTray(),
    undoStack: [],
    hintsUsed: 0,
    freeBuildName: 'Hình ghép của em',
    classroomEnabled: options?.classroomEnabled ?? false,
    groupCount: Math.max(2, Math.min(6, options?.groupCount ?? 4)),
    activeGroupIndex: 0,
    timerEnabled: options?.timerEnabled ?? false, // Default NO time limit per prompt
    elapsedSeconds: 0,
    isCompleted: false,
    completionToken: 0,
    completedAtMs: null,
  };
}

const MAX_UNDO_STEPS = 80;

function pushUndo(state: TangramGameState, description: string): TangramUndoEntry[] {
  const entry: TangramUndoEntry = {
    pieces: clonePieces(state.pieces),
    description,
  };
  const next = [...state.undoStack, entry];
  return next.length > MAX_UNDO_STEPS ? next.slice(next.length - MAX_UNDO_STEPS) : next;
}

export interface TangramActionResult {
  state: TangramGameState;
  changed: boolean;
  snapped: boolean;
  rejectedOverlapWith?: TangramPieceId[];
  /** Fires TRUE strictly once when transitioning from incomplete -> completed (never in free mode). */
  justCompleted: boolean;
}

function finalizePieceMutation(
  state: TangramGameState,
  nextPieces: Record<TangramPieceId, TangramPieceState>,
  description: string,
  snapped: boolean
): TangramActionResult {
  let isCompleted = false;
  if (state.mode !== 'free') {
    const puzzle = getTangramPuzzleById(state.puzzleId);
    const ev = evaluateTangramBoard(nextPieces, puzzle);
    isCompleted = ev.isCompleted;
  }

  const justCompleted = !state.isCompleted && isCompleted;

  return {
    state: {
      ...state,
      pieces: nextPieces,
      undoStack: pushUndo(state, description),
      isCompleted,
      completionToken: justCompleted ? state.completionToken + 1 : state.completionToken,
      completedAtMs: justCompleted ? Date.now() : isCompleted ? state.completedAtMs : null,
    },
    changed: true,
    snapped,
    justCompleted,
  };
}

/**
 * Places or moves a piece to `(x, y)` on the board with optional magnetic snapping and strict overlap guard.
 * If the placement overlaps another piece, returns `changed: false` and `rejectedOverlapWith` (keeping previous position).
 */
export function placeOrMovePiece(
  state: TangramGameState,
  pieceId: TangramPieceId,
  x: number,
  y: number,
  options?: { enableSnap?: boolean; rotationDeg?: number; flipped?: boolean }
): TangramActionResult {
  const prev = state.pieces[pieceId];
  const spec = TANGRAM_PIECE_SPECS[pieceId];
  const rawCandidate: TangramPieceState = {
    id: pieceId,
    onBoard: true,
    x,
    y,
    rotationDeg: normalizeRotationDeg(options?.rotationDeg ?? prev.rotationDeg),
    flipped: spec.canFlip ? (options?.flipped ?? prev.flipped) : false,
  };

  const puzzle = state.mode === 'free' ? null : getTangramPuzzleById(state.puzzleId);
  const { piece: snappedCandidate, snapped } =
    options?.enableSnap === false
      ? { piece: rawCandidate, snapped: false }
      : snapPieceOnBoard(rawCandidate, state.pieces, puzzle, state.mode);

  const overlaps = findOverlappingPieceIds(state.pieces, snappedCandidate);
  if (overlaps.length > 0) {
    return {
      state,
      changed: false,
      snapped: false,
      rejectedOverlapWith: overlaps,
      justCompleted: false,
    };
  }

  const nextPieces = clonePieces(state.pieces);
  nextPieces[pieceId] = snappedCandidate;
  return finalizePieceMutation(state, nextPieces, `Đặt ${spec.name}`, snapped);
}

/**
 * Rotates a piece by deltaDeg (±45°). Works both in tray (pre-orienting) and on board (checks overlap!).
 */
export function rotatePiece(
  state: TangramGameState,
  pieceId: TangramPieceId,
  deltaDeg: 45 | -45
): TangramActionResult {
  const prev = state.pieces[pieceId];
  const spec = TANGRAM_PIECE_SPECS[pieceId];
  const nextRot = normalizeRotationDeg(prev.rotationDeg + deltaDeg);

  if (!prev.onBoard) {
    const nextPieces = clonePieces(state.pieces);
    nextPieces[pieceId] = { ...prev, rotationDeg: nextRot };
    return {
      state: { ...state, pieces: nextPieces, undoStack: pushUndo(state, `Xoay ${spec.name}`) },
      changed: true,
      snapped: false,
      justCompleted: false,
    };
  }

  const candidate: TangramPieceState = { ...prev, rotationDeg: nextRot };
  const puzzle = state.mode === 'free' ? null : getTangramPuzzleById(state.puzzleId);
  const { piece: snappedCandidate, snapped } = snapPieceOnBoard(candidate, state.pieces, puzzle, state.mode);
  const overlaps = findOverlappingPieceIds(state.pieces, snappedCandidate);
  if (overlaps.length > 0) {
    return {
      state,
      changed: false,
      snapped: false,
      rejectedOverlapWith: overlaps,
      justCompleted: false,
    };
  }

  const nextPieces = clonePieces(state.pieces);
  nextPieces[pieceId] = snappedCandidate;
  return finalizePieceMutation(state, nextPieces, `Xoay ${spec.name} ${deltaDeg > 0 ? '+45°' : '-45°'}`, snapped);
}

/**
 * Flips the parallelogram (mirror across local Y axis). No-op for symmetric pieces.
 */
export function flipPiece(state: TangramGameState, pieceId: TangramPieceId): TangramActionResult {
  const spec = TANGRAM_PIECE_SPECS[pieceId];
  if (!spec.canFlip) {
    return { state, changed: false, snapped: false, justCompleted: false };
  }
  const prev = state.pieces[pieceId];
  const nextFlipped = !prev.flipped;

  if (!prev.onBoard) {
    const nextPieces = clonePieces(state.pieces);
    nextPieces[pieceId] = { ...prev, flipped: nextFlipped };
    return {
      state: { ...state, pieces: nextPieces, undoStack: pushUndo(state, `Lật ${spec.name}`) },
      changed: true,
      snapped: false,
      justCompleted: false,
    };
  }

  const candidate: TangramPieceState = { ...prev, flipped: nextFlipped };
  const puzzle = state.mode === 'free' ? null : getTangramPuzzleById(state.puzzleId);
  const { piece: snappedCandidate, snapped } = snapPieceOnBoard(candidate, state.pieces, puzzle, state.mode);
  const overlaps = findOverlappingPieceIds(state.pieces, snappedCandidate);
  if (overlaps.length > 0) {
    return {
      state,
      changed: false,
      snapped: false,
      rejectedOverlapWith: overlaps,
      justCompleted: false,
    };
  }

  const nextPieces = clonePieces(state.pieces);
  nextPieces[pieceId] = snappedCandidate;
  return finalizePieceMutation(state, nextPieces, `Lật ${spec.name}`, snapped);
}

export function returnPieceToTray(state: TangramGameState, pieceId: TangramPieceId): TangramActionResult {
  const prev = state.pieces[pieceId];
  if (!prev.onBoard) {
    return { state, changed: false, snapped: false, justCompleted: false };
  }
  const nextPieces = clonePieces(state.pieces);
  nextPieces[pieceId] = { ...prev, onBoard: false };
  return finalizePieceMutation(state, nextPieces, `Đưa ${TANGRAM_PIECE_SPECS[pieceId].name} về khay`, false);
}

export function returnAllPiecesToTray(state: TangramGameState): TangramGameState {
  return {
    ...state,
    pieces: createInitialPiecesInTray(),
    undoStack: [],
    hintsUsed: 0,
    elapsedSeconds: 0,
    isCompleted: false,
    completedAtMs: null,
  };
}

export function undoTangramAction(state: TangramGameState): { state: TangramGameState; undone: boolean } {
  if (state.undoStack.length === 0) {
    return { state, undone: false };
  }
  const prevEntry = state.undoStack[state.undoStack.length - 1];
  const nextStack = state.undoStack.slice(0, -1);
  const restoredPieces = clonePieces(prevEntry.pieces);
  let isCompleted = false;
  if (state.mode !== 'free') {
    const puzzle = getTangramPuzzleById(state.puzzleId);
    isCompleted = evaluateTangramBoard(restoredPieces, puzzle).isCompleted;
  }

  return {
    state: {
      ...state,
      pieces: restoredPieces,
      undoStack: nextStack,
      isCompleted,
      completedAtMs: isCompleted ? state.completedAtMs : null,
    },
    undone: true,
  };
}

export function applyTangramHintMove(state: TangramGameState, hint: TangramHintResult): TangramActionResult {
  if (hint.status !== 'ok' || !hint.suggestedMove) {
    return { state, changed: false, snapped: false, justCompleted: false };
  }
  const { pieceId, x, y, rotationDeg, flipped } = hint.suggestedMove;
  const res = placeOrMovePiece(state, pieceId, x, y, {
    enableSnap: false,
    rotationDeg,
    flipped,
  });
  if (!res.changed) return res;
  return {
    ...res,
    state: {
      ...res.state,
      hintsUsed: state.hintsUsed + 1,
    },
  };
}

// ============================================================================
// SESSION PERSISTENCE (/DEMO ISOLATED + CORRUPT JSON SAFE)
// ============================================================================

export function getTangramStorageKey(): string {
  return isKhktDemoRuntime() ? TANGRAM_STORAGE_KEY_DEMO : TANGRAM_STORAGE_KEY_REAL;
}

export function saveTangramSession(state: TangramGameState, storage?: Storage): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return;
    const payload: PersistedTangramSession = {
      version: 1,
      mode: state.mode,
      puzzleId: state.puzzleId,
      pieces: state.pieces,
      undoStack: state.undoStack.slice(-30),
      hintsUsed: state.hintsUsed,
      freeBuildName: state.freeBuildName,
      classroomEnabled: state.classroomEnabled,
      groupCount: state.groupCount,
      activeGroupIndex: state.activeGroupIndex,
      timerEnabled: state.timerEnabled,
      elapsedSeconds: state.elapsedSeconds,
      isCompleted: state.isCompleted,
      completionToken: state.completionToken,
      completedAtMs: state.completedAtMs,
      savedAtMs: Date.now(),
    };
    store.setItem(getTangramStorageKey(), JSON.stringify(payload));
  } catch {
    // Ignore storage quota or sandbox errors
  }
}

export function loadTangramSession(storage?: Storage): TangramGameState | null {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    if (!store) return null;
    const raw = store.getItem(getTangramStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedTangramSession>;
    if (!parsed || parsed.version !== 1 || typeof parsed.puzzleId !== 'string' || !parsed.pieces) {
      return null;
    }

    const mode: TangramPlayMode =
      parsed.mode === 'guided' || parsed.mode === 'challenge' || parsed.mode === 'free'
        ? parsed.mode
        : 'guided';
    const puzzle = getTangramPuzzleById(parsed.puzzleId);
    const cleanPieces = createInitialPiecesInTray();

    for (const id of TANGRAM_PIECE_ORDER) {
      const saved = (parsed.pieces as Record<string, Partial<TangramPieceState>>)[id];
      if (!saved) continue;
      const spec = TANGRAM_PIECE_SPECS[id];
      cleanPieces[id] = {
        id,
        onBoard: Boolean(saved.onBoard),
        x: typeof saved.x === 'number' && Number.isFinite(saved.x) ? saved.x : 2,
        y: typeof saved.y === 'number' && Number.isFinite(saved.y) ? saved.y : 2,
        rotationDeg: typeof saved.rotationDeg === 'number' ? normalizeRotationDeg(saved.rotationDeg) : 0,
        flipped: spec.canFlip ? Boolean(saved.flipped) : false,
      };
    }

    const recomputedComplete = mode === 'free' ? false : evaluateTangramBoard(cleanPieces, puzzle).isCompleted;
    const groupCount =
      typeof parsed.groupCount === 'number' && parsed.groupCount >= 2 && parsed.groupCount <= 6
        ? Math.floor(parsed.groupCount)
        : 4;

    return {
      mode,
      puzzleId: puzzle.id,
      pieces: cleanPieces,
      undoStack: Array.isArray(parsed.undoStack) ? parsed.undoStack.slice(-30) : [],
      hintsUsed: typeof parsed.hintsUsed === 'number' && parsed.hintsUsed >= 0 ? Math.floor(parsed.hintsUsed) : 0,
      freeBuildName:
        typeof parsed.freeBuildName === 'string' && parsed.freeBuildName.trim().length > 0
          ? parsed.freeBuildName.slice(0, 60)
          : 'Hình ghép của em',
      classroomEnabled: Boolean(parsed.classroomEnabled),
      groupCount,
      activeGroupIndex:
        typeof parsed.activeGroupIndex === 'number' && parsed.activeGroupIndex >= 0
          ? parsed.activeGroupIndex % groupCount
          : 0,
      timerEnabled: Boolean(parsed.timerEnabled),
      elapsedSeconds:
        typeof parsed.elapsedSeconds === 'number' && parsed.elapsedSeconds >= 0
          ? Math.floor(parsed.elapsedSeconds)
          : 0,
      isCompleted: recomputedComplete,
      completionToken:
        typeof parsed.completionToken === 'number' && parsed.completionToken >= 0
          ? parsed.completionToken
          : recomputedComplete
          ? 1
          : 0,
      completedAtMs: recomputedComplete ? parsed.completedAtMs ?? Date.now() : null,
    };
  } catch {
    return null;
  }
}

export function clearTangramSession(storage?: Storage): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    store?.removeItem(getTangramStorageKey());
  } catch {
    // Ignore
  }
}
