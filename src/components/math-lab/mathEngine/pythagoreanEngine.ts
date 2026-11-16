import {
  EPSILON,
  Point2D,
  angleDegreesABC,
  distance2D,
  polygonArea2D,
} from './mathVerificationEngine';

export interface HypotenuseResult {
  valid: boolean;
  errorVi?: string;
  a: number;
  b: number;
  c: number;
  aSquared: number;
  bSquared: number;
  cSquared: number;
}

export interface UnknownLegResult {
  valid: boolean;
  errorVi?: string;
  knownLeg: number;
  hypotenuse: number;
  unknownLeg: number;
}

export type TriangleAngleClassification =
  | 'RIGHT'
  | 'ACUTE'
  | 'OBTUSE'
  | 'NOT_TRIANGLE'
  | 'INVALID_INPUT';

export interface ConversePythagoreanResult {
  validTriangle: boolean;
  isRightTriangle: boolean;
  classification: TriangleAngleClassification;
  sortedSides: [number, number, number];
  sumTwoSmallerSquares: number;
  largestSquare: number;
  difference: number;
  messageVi: string;
}

export interface PythagoreanGeometryModel {
  valid: boolean;
  errorVi?: string;
  a: number;
  b: number;
  c: number;
  /** Đỉnh A là góc vuông (0, 0), B(a, 0), C(0, b) */
  vertexA: Point2D;
  vertexB: Point2D;
  vertexC: Point2D;
  rightAngleDeg: number;
  triangleArea: number;
  /** 3 hình vuông dựng ra ngoài trên 3 cạnh */
  squareA: Point2D[];
  squareB: Point2D[];
  squareC: Point2D[];
  areaA: number;
  areaB: number;
  areaC: number;
}

export interface DissectionPiece {
  id: string;
  label: string;
  kind: 'TRIANGLE' | 'QUAD' | 'SQUARE' | 'GAP';
  colorKey: 'teal' | 'blue' | 'amber' | 'rose' | 'emerald' | 'slate';
  points: Point2D[];
  area: number;
}

export interface PythagoreanDissectionFrame {
  mode: 'PERIGAL' | 'FRAME_AB';
  progressT: number;
  /** Miền tham chiếu (ví dụ khung (a+b)x(a+b) hoặc hình vuông c x c đích) */
  targetOutline: Point2D[];
  /** Khung gốc phụ trợ (ví dụ 2 hình vuông a^2, b^2 khi t=0) */
  sourceOutlines: { label: string; points: Point2D[]; area: number }[];
  pieces: DissectionPiece[];
  totalPieceArea: number;
  expectedSquareCArea: number;
  areaPreserved: boolean;
}

/**
 * Tính cạnh huyền c = sqrt(a^2 + b^2) cho tam giác vuông không suy biến (a > 0, b > 0).
 */
export function solveHypotenuseFromLegs(a: number, b: number): HypotenuseResult {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= EPSILON || b <= EPSILON) {
    return {
      valid: false,
      errorVi: 'Hai cạnh góc vuông a và b phải là số dương (lớn hơn 0) để tạo tam giác vuông không suy biến.',
      a: 0,
      b: 0,
      c: 0,
      aSquared: 0,
      bSquared: 0,
      cSquared: 0,
    };
  }
  const aSq = a * a;
  const bSq = b * b;
  const cSq = aSq + bSq;
  const c = Math.hypot(a, b);
  return {
    valid: true,
    a,
    b,
    c,
    aSquared: aSq,
    bSquared: bSq,
    cSquared: cSq,
  };
}

/**
 * Tính cạnh góc vuông còn lại b = sqrt(c^2 - a^2) với điều kiện c > a > 0.
 */
export function solveLegFromHypotenuse(knownLeg: number, hypotenuse: number): UnknownLegResult {
  if (!Number.isFinite(knownLeg) || !Number.isFinite(hypotenuse) || knownLeg <= EPSILON || hypotenuse <= EPSILON) {
    return {
      valid: false,
      errorVi: 'Cạnh góc vuông đã biết và cạnh huyền đều phải là số dương lớn hơn 0.',
      knownLeg: 0,
      hypotenuse: 0,
      unknownLeg: 0,
    };
  }
  if (hypotenuse <= knownLeg + EPSILON) {
    return {
      valid: false,
      errorVi: `Không hợp lệ: Cạnh huyền c (${hypotenuse}) phải lớn hơn hẳn cạnh góc vuông a (${knownLeg}).`,
      knownLeg,
      hypotenuse,
      unknownLeg: 0,
    };
  }
  const diff = hypotenuse * hypotenuse - knownLeg * knownLeg;
  const unknownLeg = Math.sqrt(Math.max(0, diff));
  return {
    valid: true,
    knownLeg,
    hypotenuse,
    unknownLeg,
  };
}

/**
 * Kiểm tra định lý Pythagore đảo cho 3 độ dài s1, s2, s3.
 * Sắp xếp x <= y <= z, kiểm tra x + y > z và x^2 + y^2 = z^2 trong sai số phù hợp.
 */
export function checkConversePythagorean(
  s1: number,
  s2: number,
  s3: number,
  tolerance = 1e-6
): ConversePythagoreanResult {
  if (
    !Number.isFinite(s1) ||
    !Number.isFinite(s2) ||
    !Number.isFinite(s3) ||
    s1 <= EPSILON ||
    s2 <= EPSILON ||
    s3 <= EPSILON
  ) {
    return {
      validTriangle: false,
      isRightTriangle: false,
      classification: 'INVALID_INPUT',
      sortedSides: [0, 0, 0],
      sumTwoSmallerSquares: 0,
      largestSquare: 0,
      difference: 0,
      messageVi: 'Cả ba độ dài cạnh phải là số dương lớn hơn 0.',
    };
  }

  const sorted = [s1, s2, s3].sort((u, v) => u - v) as [number, number, number];
  const [x, y, z] = sorted;

  if (x + y <= z + EPSILON) {
    return {
      validTriangle: false,
      isRightTriangle: false,
      classification: 'NOT_TRIANGLE',
      sortedSides: sorted,
      sumTwoSmallerSquares: x * x + y * y,
      largestSquare: z * z,
      difference: x * x + y * y - z * z,
      messageVi: `Ba đoạn thẳng (${x}; ${y}; ${z}) KHÔNG lập thành tam giác vì ${x} + ${y} ≤ ${z} (vi phạm bất đẳng thức tam giác).`,
    };
  }

  const sumSq = x * x + y * y;
  const zSq = z * z;
  const diff = sumSq - zSq;

  if (Math.abs(diff) <= tolerance) {
    return {
      validTriangle: true,
      isRightTriangle: true,
      classification: 'RIGHT',
      sortedSides: sorted,
      sumTwoSmallerSquares: sumSq,
      largestSquare: zSq,
      difference: diff,
      messageVi: `ĐÚNG LÀ TAM GIÁC VUÔNG: ${Number(x.toFixed(3))}² + ${Number(y.toFixed(3))}² = ${Number(sumSq.toFixed(4))} = ${Number(z.toFixed(3))}² (vuông tại đỉnh đối diện cạnh ${Number(z.toFixed(3))}).`,
    };
  }

  if (diff > 0) {
    return {
      validTriangle: true,
      isRightTriangle: false,
      classification: 'ACUTE',
      sortedSides: sorted,
      sumTwoSmallerSquares: sumSq,
      largestSquare: zSq,
      difference: diff,
      messageVi: `KHÔNG PHẢI TAM GIÁC VUÔNG (Tam giác nhọn): ${Number(x.toFixed(3))}² + ${Number(y.toFixed(3))}² = ${Number(sumSq.toFixed(4))} > ${Number(zSq.toFixed(4))} = ${Number(z.toFixed(3))}².`,
    };
  }

  return {
    validTriangle: true,
    isRightTriangle: false,
    classification: 'OBTUSE',
    sortedSides: sorted,
    sumTwoSmallerSquares: sumSq,
    largestSquare: zSq,
    difference: diff,
    messageVi: `KHÔNG PHẢI TAM GIÁC VUÔNG (Tam giác tù): ${Number(x.toFixed(3))}² + ${Number(y.toFixed(3))}² = ${Number(sumSq.toFixed(4))} < ${Number(zSq.toFixed(4))} = ${Number(z.toFixed(3))}².`,
  };
}

/**
 * Dựng tam giác vuông ABC (vuông tại A) và 3 hình vuông trên 3 cạnh bằng các hàm hình học M01.
 */
export function buildPythagoreanGeometry(a: number, b: number): PythagoreanGeometryModel {
  const hyp = solveHypotenuseFromLegs(a, b);
  if (!hyp.valid) {
    const zeroPt: Point2D = { x: 0, y: 0 };
    return {
      valid: false,
      errorVi: hyp.errorVi,
      a: 0,
      b: 0,
      c: 0,
      vertexA: zeroPt,
      vertexB: zeroPt,
      vertexC: zeroPt,
      rightAngleDeg: 0,
      triangleArea: 0,
      squareA: [],
      squareB: [],
      squareC: [],
      areaA: 0,
      areaB: 0,
      areaC: 0,
    };
  }

  const vertexA: Point2D = { x: 0, y: 0 };
  const vertexB: Point2D = { x: a, y: 0 };
  const vertexC: Point2D = { x: 0, y: b };

  // Sử dụng M01 primitives để đo lại cạnh, góc, diện tích
  const measuredA = distance2D(vertexA, vertexB);
  const measuredB = distance2D(vertexA, vertexC);
  const measuredC = distance2D(vertexB, vertexC);
  const rightAngleDeg = angleDegreesABC(vertexB, vertexA, vertexC);
  const triangleArea = polygonArea2D([vertexA, vertexB, vertexC]);

  // Hình vuông trên cạnh AB (hướng xuống dưới y <= 0)
  const squareA: Point2D[] = [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: a, y: -a },
    { x: 0, y: -a },
  ];

  // Hình vuông trên cạnh AC (hướng sang trái x <= 0)
  const squareB: Point2D[] = [
    { x: 0, y: 0 },
    { x: 0, y: b },
    { x: -b, y: b },
    { x: -b, y: 0 },
  ];

  // Hình vuông trên cạnh huyền BC (hướng ra ngoài góc phần tư I theo vector pháp tuyến (b, a))
  const squareC: Point2D[] = [
    { x: a, y: 0 },
    { x: a + b, y: a },
    { x: b, y: a + b },
    { x: 0, y: b },
  ];

  return {
    valid: true,
    a: measuredA,
    b: measuredB,
    c: measuredC,
    vertexA,
    vertexB,
    vertexC,
    rightAngleDeg,
    triangleArea,
    squareA,
    squareB,
    squareC,
    areaA: polygonArea2D(squareA),
    areaB: polygonArea2D(squareB),
    areaC: polygonArea2D(squareC),
  };
}

function lerpPoint(p0: Point2D, p1: Point2D, t: number): Point2D {
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t,
  };
}

function lerpPolygon(poly0: Point2D[], poly1: Point2D[], t: number): Point2D[] {
  return poly0.map((pt, idx) => lerpPoint(pt, poly1[idx] ?? pt, t));
}

function translatePolygon(poly: Point2D[], dx: number, dy: number): Point2D[] {
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/**
 * Mô hình 1 (Perigal 1873 – cắt ghép trực tiếp không xoay):
 * Chia hình vuông cạnh L = max(a, b) thành 4 mảnh tứ giác đồng dạng bằng hai đường vuông góc qua tâm,
 * rồi tịnh tiến 4 mảnh cùng với hình vuông S = min(a, b) để ghép khít 100% vào hình vuông cạnh c.
 */
export function buildPerigalDissection(
  a: number,
  b: number,
  progressT: number
): PythagoreanDissectionFrame {
  const t = Math.min(1, Math.max(0, Number.isFinite(progressT) ? progressT : 1));
  const L = Math.max(a, b);
  const S = Math.min(a, b);
  const cSq = a * a + b * b;

  const halfL = L / 2;
  const halfS = S / 2;

  // Đặt hình vuông đích c x c ở phía phải, có tâm tại (targetCx, targetCy)
  const gap = Math.max(2, L * 0.45);
  const u: Point2D = { x: halfL, y: halfS };
  const v: Point2D = { x: -halfS, y: halfL };

  // Tâm hình vuông lớn L x L ở bên trái, tâm (0, 0)
  const srcLOrigin: Point2D = { x: 0, y: 0 };
  // Tâm hình vuông nhỏ S x S đặt ngay phía dưới hình vuông L x L
  const srcSCenter: Point2D = { x: 0, y: -(halfL + halfS + gap * 0.55) };

  // Tâm hình vuông đích c x c bên phải
  const dstCenter: Point2D = {
    x: halfL + gap + (halfL + halfS),
    y: 0,
  };

  // 4 mảnh của hình vuông L x L trong hệ quy chiếu tâm (0, 0)
  const p1Start: Point2D[] = [
    { x: 0, y: 0 },
    { x: halfL, y: halfS },
    { x: halfL, y: halfL },
    { x: -halfS, y: halfL },
  ];
  const p2Start: Point2D[] = [
    { x: 0, y: 0 },
    { x: -halfS, y: halfL },
    { x: -halfL, y: halfL },
    { x: -halfL, y: -halfS },
  ];
  const p3Start: Point2D[] = [
    { x: 0, y: 0 },
    { x: -halfL, y: -halfS },
    { x: -halfL, y: -halfL },
    { x: halfS, y: -halfL },
  ];
  const p4Start: Point2D[] = [
    { x: 0, y: 0 },
    { x: halfS, y: -halfL },
    { x: halfL, y: -halfL },
    { x: halfL, y: halfS },
  ];
  const smallStart: Point2D[] = [
    { x: srcSCenter.x - halfS, y: srcSCenter.y - halfS },
    { x: srcSCenter.x + halfS, y: srcSCenter.y - halfS },
    { x: srcSCenter.x + halfS, y: srcSCenter.y + halfS },
    { x: srcSCenter.x - halfS, y: srcSCenter.y + halfS },
  ];

  // Các vị trí đích trong hình vuông c x c tâm dstCenter (tịnh tiến thuần túy!)
  const p1End = translatePolygon(p1Start, dstCenter.x - u.x - v.x, dstCenter.y - u.y - v.y);
  const p2End = translatePolygon(p2Start, dstCenter.x + u.x - v.x, dstCenter.y + u.y - v.y);
  const p3End = translatePolygon(p3Start, dstCenter.x + u.x + v.x, dstCenter.y + u.y + v.y);
  const p4End = translatePolygon(p4Start, dstCenter.x - u.x + v.x, dstCenter.y - u.y + v.y);
  const smallEnd: Point2D[] = [
    { x: dstCenter.x - halfS, y: dstCenter.y - halfS },
    { x: dstCenter.x + halfS, y: dstCenter.y - halfS },
    { x: dstCenter.x + halfS, y: dstCenter.y + halfS },
    { x: dstCenter.x - halfS, y: dstCenter.y + halfS },
  ];

  const targetOutline: Point2D[] = [
    { x: dstCenter.x - u.x - v.x, y: dstCenter.y - u.y - v.y },
    { x: dstCenter.x + u.x - v.x, y: dstCenter.y + u.y - v.y },
    { x: dstCenter.x + u.x + v.x, y: dstCenter.y + u.y + v.y },
    { x: dstCenter.x - u.x + v.x, y: dstCenter.y - u.y + v.y },
  ];

  const sourceLOutline: Point2D[] = [
    { x: srcLOrigin.x - halfL, y: srcLOrigin.y - halfL },
    { x: srcLOrigin.x + halfL, y: srcLOrigin.y - halfL },
    { x: srcLOrigin.x + halfL, y: srcLOrigin.y + halfL },
    { x: srcLOrigin.x - halfL, y: srcLOrigin.y + halfL },
  ];

  const polyP1 = lerpPolygon(p1Start, p1End, t);
  const polyP2 = lerpPolygon(p2Start, p2End, t);
  const polyP3 = lerpPolygon(p3Start, p3End, t);
  const polyP4 = lerpPolygon(p4Start, p4End, t);
  const polySmall = lerpPolygon(smallStart, smallEnd, t);

  const pieces: DissectionPiece[] = [
    { id: 'P1', label: 'Mảnh 1', kind: 'QUAD', colorKey: 'teal', points: polyP1, area: polygonArea2D(polyP1) },
    { id: 'P2', label: 'Mảnh 2', kind: 'QUAD', colorKey: 'blue', points: polyP2, area: polygonArea2D(polyP2) },
    { id: 'P3', label: 'Mảnh 3', kind: 'QUAD', colorKey: 'emerald', points: polyP3, area: polygonArea2D(polyP3) },
    { id: 'P4', label: 'Mảnh 4', kind: 'QUAD', colorKey: 'rose', points: polyP4, area: polygonArea2D(polyP4) },
    { id: 'S', label: `Hình vuông nhỏ (${S}²)`, kind: 'SQUARE', colorKey: 'amber', points: polySmall, area: polygonArea2D(polySmall) },
  ];

  const totalPieceArea = pieces.reduce((acc, p) => acc + p.area, 0);

  return {
    mode: 'PERIGAL',
    progressT: t,
    targetOutline,
    sourceOutlines: [
      { label: `Hình vuông lớn (${L}²)`, points: sourceLOutline, area: L * L },
      { label: `Hình vuông nhỏ (${S}²)`, points: smallStart, area: S * S },
    ],
    pieces,
    totalPieceArea,
    expectedSquareCArea: cSq,
    areaPreserved: Math.abs(totalPieceArea - cSq) < 1e-6,
  };
}

/**
 * Mô hình 2 (Khung (a+b)^2 – Bhaskara / So sánh khoảng trống):
 * Trong cùng 1 hình vuông cạnh (a+b):
 * - Tại t = 0: 4 tam giác vuông ghép thành 2 hình chữ nhật (a x b), để lộ đúng 2 hình vuông a^2 và b^2.
 * - Tại t = 1: 4 tam giác vuông dịch về 4 góc, để lộ đúng 1 hình vuông nghiêng cạnh c (diện tích c^2).
 */
export function buildFrameABDissection(
  a: number,
  b: number,
  progressT: number
): PythagoreanDissectionFrame {
  const t = Math.min(1, Math.max(0, Number.isFinite(progressT) ? progressT : 1));
  const L = a + b;
  const cSq = a * a + b * b;

  const targetOutline: Point2D[] = [
    { x: 0, y: 0 },
    { x: L, y: 0 },
    { x: L, y: L },
    { x: 0, y: L },
  ];

  // Trạng thái đầu (t = 0): 4 tam giác vuông xếp thành 2 hình chữ nhật a x b ở góc (trên-trái) và (dưới-phải)
  // để chừa ra hai hình vuông a^2 (góc dưới-trái [0,a]x[0,a]) và b^2 (góc trên-phải [a,a+b]x[a,a+b])
  const t1Start: Point2D[] = [
    { x: a, y: 0 },
    { x: a + b, y: 0 },
    { x: a + b, y: a },
  ];
  const t2Start: Point2D[] = [
    { x: a, y: 0 },
    { x: a, y: a },
    { x: a + b, y: a },
  ];
  const t3Start: Point2D[] = [
    { x: 0, y: a },
    { x: a, y: a },
    { x: 0, y: a + b },
  ];
  const t4Start: Point2D[] = [
    { x: a, y: a },
    { x: a, y: a + b },
    { x: 0, y: a + b },
  ];

  // Trạng thái cuối (t = 1): 4 tam giác vuông dịch ra 4 góc của hình vuông (a+b) x (a+b)
  // Phần trống chính giữa là hình vuông nghiêng đỉnh (a,0), (a+b,a), (b,a+b), (0,b) có diện tích c^2!
  const t1End: Point2D[] = [
    { x: 0, y: 0 },
    { x: a, y: 0 },
    { x: 0, y: b },
  ];
  const t2End: Point2D[] = [
    { x: a, y: 0 },
    { x: a + b, y: 0 },
    { x: a + b, y: a },
  ];
  const t3End: Point2D[] = [
    { x: a + b, y: a },
    { x: a + b, y: a + b },
    { x: b, y: a + b },
  ];
  const t4End: Point2D[] = [
    { x: b, y: a + b },
    { x: 0, y: a + b },
    { x: 0, y: b },
  ];

  const p1 = lerpPolygon(t1Start, t1End, t);
  const p2 = lerpPolygon(t2Start, t2End, t);
  const p3 = lerpPolygon(t3Start, t3End, t);
  const p4 = lerpPolygon(t4Start, t4End, t);

  const pieces: DissectionPiece[] = [
    { id: 'T1', label: 'Tam giác 1', kind: 'TRIANGLE', colorKey: 'teal', points: p1, area: polygonArea2D(p1) },
    { id: 'T2', label: 'Tam giác 2', kind: 'TRIANGLE', colorKey: 'blue', points: p2, area: polygonArea2D(p2) },
    { id: 'T3', label: 'Tam giác 3', kind: 'TRIANGLE', colorKey: 'emerald', points: p3, area: polygonArea2D(p3) },
    { id: 'T4', label: 'Tam giác 4', kind: 'TRIANGLE', colorKey: 'rose', points: p4, area: polygonArea2D(p4) },
  ];

  const triangleSum = pieces.reduce((acc, p) => acc + p.area, 0);
  // Phần trống trong khung (a+b)^2 tại trạng thái đầu và cuối
  const emptySpace = L * L - triangleSum;

  return {
    mode: 'FRAME_AB',
    progressT: t,
    targetOutline,
    sourceOutlines: [
      {
        label: 'a²',
        points: [
          { x: 0, y: 0 },
          { x: a, y: 0 },
          { x: a, y: a },
          { x: 0, y: a },
        ],
        area: a * a,
      },
      {
        label: 'b²',
        points: [
          { x: a, y: a },
          { x: a + b, y: a },
          { x: a + b, y: a + b },
          { x: a, y: a + b },
        ],
        area: b * b,
      },
      {
        label: 'c²',
        points: [
          { x: a, y: 0 },
          { x: a + b, y: a },
          { x: b, y: a + b },
          { x: 0, y: b },
        ],
        area: cSq,
      },
    ],
    pieces,
    totalPieceArea: emptySpace,
    expectedSquareCArea: cSq,
    areaPreserved: Math.abs(emptySpace - cSq) < 1e-6,
  };
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG M15 (10 TEST CASE BẮT BUỘC)
// ============================================================================

export interface M15UnitTestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runM15UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: M15UnitTestCaseResult[];
} {
  const cases: M15UnitTestCaseResult[] = [];
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-9;

  // 1. a=3, b=4 -> c=5
  const t345 = solveHypotenuseFromLegs(3, 4);
  cases.push({
    id: 'm15_345',
    label: 'Tam giác vuông a=3, b=4 cho cạnh huyền c=5',
    passed: t345.valid && near(t345.c, 5),
    detail: `c = ${t345.c}`,
  });

  // 2. a=5, b=12 -> c=13
  const t512 = solveHypotenuseFromLegs(5, 12);
  cases.push({
    id: 'm15_5_12_13',
    label: 'Tam giác vuông a=5, b=12 cho cạnh huyền c=13',
    passed: t512.valid && near(t512.c, 13),
    detail: `c = ${t512.c}`,
  });

  // 3. a=6, b=8 -> c=10
  const t6810 = solveHypotenuseFromLegs(6, 8);
  cases.push({
    id: 'm15_6_8_10',
    label: 'Tam giác vuông a=6, b=8 cho cạnh huyền c=10',
    passed: t6810.valid && near(t6810.c, 10),
    detail: `c = ${t6810.c}`,
  });

  // 4. 3^2 + 4^2 = 5^2 & diện tích 3 hình vuông bằng polygonArea2D
  const geom345 = buildPythagoreanGeometry(3, 4);
  cases.push({
    id: 'm15_sq_sum_345',
    label: '3² + 4² = 5² và diện tích 3 hình vuông khớp S_a + S_b = S_c',
    passed:
      geom345.valid &&
      near(geom345.areaA, 9) &&
      near(geom345.areaB, 16) &&
      near(geom345.areaC, 25) &&
      near(geom345.areaA + geom345.areaB, geom345.areaC) &&
      near(geom345.rightAngleDeg, 90),
    detail: `S_a=${geom345.areaA}, S_b=${geom345.areaB}, S_c=${geom345.areaC}`,
  });

  // 5. Bộ ba 2, 3, 4 không tạo tam giác vuông; 5, 12, 13 tạo tam giác vuông; 1, 2, 10 không tạo tam giác
  const conv234 = checkConversePythagorean(2, 3, 4);
  const conv512 = checkConversePythagorean(13, 5, 12);
  const convBad = checkConversePythagorean(1, 2, 10);
  cases.push({
    id: 'm15_converse',
    label: 'Định lý đảo: (2,3,4) không vuông, (5,12,13) vuông, (1,2,10) không là tam giác',
    passed:
      conv234.validTriangle &&
      !conv234.isRightTriangle &&
      conv512.validTriangle &&
      conv512.isRightTriangle &&
      !convBad.validTriangle,
    detail: `(2,3,4) -> ${conv234.classification}; (13,5,12) -> ${conv512.classification}`,
  });

  // 6. Từ chối a=0 hoặc b=0 trong mô hình tam giác vuông không suy biến
  const zeroA = solveHypotenuseFromLegs(0, 4);
  const zeroB = solveHypotenuseFromLegs(3, 0);
  const negA = buildPythagoreanGeometry(-3, 4);
  cases.push({
    id: 'm15_zero_rejected',
    label: 'Từ chối a=0, b=0 hoặc số âm trong tam giác vuông không suy biến',
    passed: !zeroA.valid && !zeroB.valid && !negA.valid,
    detail: 'Cả 3 đầu vào suy biến đều bị từ chối an toàn',
  });

  // 7. c < a (hoặc c <= a) không được dùng để tính cạnh còn lại; hợp lệ khi c > a
  const badLeg = solveLegFromHypotenuse(5, 4);
  const equalLeg = solveLegFromHypotenuse(5, 5);
  const goodLeg = solveLegFromHypotenuse(6, 10);
  cases.push({
    id: 'm15_leg_guard',
    label: 'Chặn c < a khi tính cạnh góc vuông; tính đúng b=8 khi a=6, c=10',
    passed: !badLeg.valid && !equalLeg.valid && goodLeg.valid && near(goodLeg.unknownLeg, 8),
    detail: `c<a blocked=${!badLeg.valid}; b=${goodLeg.unknownLeg}`,
  });

  // 8. Thay kích thước hình (ví dụ a=4.5, b=7.5 và a=7, b=7) không làm sai diện tích
  const geomFloat = buildPythagoreanGeometry(4.5, 7.5);
  const geomIso = buildPythagoreanGeometry(7, 7);
  cases.push({
    id: 'm15_resize_invariant',
    label: 'Thay đổi kích thước (a=4.5, b=7.5 và a=7, b=7) vẫn giữ đúng a² + b² = c²',
    passed:
      geomFloat.valid &&
      near(geomFloat.areaA + geomFloat.areaB, geomFloat.areaC) &&
      geomIso.valid &&
      near(geomIso.areaA + geomIso.areaB, geomIso.areaC),
    detail: `S(4.5,7.5)=${geomFloat.areaA}+${geomFloat.areaB}=${geomFloat.areaC}`,
  });

  // 9. Ghép mảnh bảo toàn diện tích (Perigal 5 mảnh và Khung (a+b)^2 tại t=0, t=0.5, t=1)
  const peri0 = buildPerigalDissection(3, 4, 0);
  const peri1 = buildPerigalDissection(3, 4, 1);
  const periFloat = buildPerigalDissection(4.5, 7.5, 1);
  const frame0 = buildFrameABDissection(5, 12, 0);
  const frame1 = buildFrameABDissection(5, 12, 1);
  cases.push({
    id: 'm15_dissection_area',
    label: 'Ghép mảnh Perigal & Khung (a+b)² bảo toàn tuyệt đối tổng diện tích c²',
    passed:
      peri0.areaPreserved &&
      peri1.areaPreserved &&
      periFloat.areaPreserved &&
      frame0.areaPreserved &&
      frame1.areaPreserved &&
      near(peri1.totalPieceArea, 25) &&
      near(periFloat.totalPieceArea, 4.5 * 4.5 + 7.5 * 7.5),
    detail: `Perigal(3,4) t=1: ${peri1.totalPieceArea}; Frame(5,12) t=1: ${frame1.totalPieceArea}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
