import {
  EPSILON,
  Point2D,
  angleDegreesABC,
  distance2D,
  polygonArea2D,
} from './mathVerificationEngine';

export type TransformationKind =
  | 'TRANSLATE'
  | 'REFLECT_OX'
  | 'REFLECT_OY'
  | 'REFLECT_LINE'
  | 'REFLECT_POINT'
  | 'ROTATE'
  | 'DILATION'; // Mở rộng: Phép vị tự

export interface LineEquation2D {
  /** Dạng tổng quát ax + by + c = 0 */
  a: number;
  b: number;
  c: number;
}

export interface TransformationParams {
  kind: TransformationKind;
  /** Vector tịnh tiến (dx, dy) */
  dx?: number;
  dy?: number;
  /** Tâm đối xứng / tâm quay / tâm vị tự */
  center?: Point2D;
  /** Góc quay theo độ (dương là ngược chiều kim đồng hồ) */
  angleDeg?: number;
  /** Đường thẳng đối xứng qua 2 điểm P1, P2 hoặc hệ số ax + by + c = 0 */
  lineMode?: 'TWO_POINTS' | 'EQUATION';
  lineP1?: Point2D;
  lineP2?: Point2D;
  lineEq?: LineEquation2D;
  /** Tỉ số vị tự k (chế độ Mở rộng) */
  scaleK?: number;
}

export interface TransformedPointResult {
  valid: boolean;
  isDegenerateLine?: boolean;
  errorVi?: string;
  original: Point2D;
  image: Point2D;
  /** Hình chiếu vuông góc lên trục đối xứng (nếu là phép đối xứng) */
  projectionPoint?: Point2D;
}

export interface PolygonInvariantMetrics {
  sideAB: number;
  sideBC: number;
  sideCA: number;
  angleB: number;
  area: number;
}

export interface TransformationBatchResult {
  valid: boolean;
  isDegenerateLine: boolean;
  isIsometry: boolean;
  isExpandedContent: boolean;
  errorVi?: string;
  warningVi?: string;
  images: Point2D[];
  projections: (Point2D | undefined)[];
  originalMetrics: PolygonInvariantMetrics | null;
  imageMetrics: PolygonInvariantMetrics | null;
  lengthRatioAB: number | null;
  summaryLatex: string;
}

function cleanTinyZero(v: number): number {
  return Math.abs(v) < 1e-11 ? 0 : v;
}

function exactSinCosDeg(angleDeg: number): { sin: number; cos: number } {
  const normalized = ((angleDeg % 360) + 360) % 360;
  if (Math.abs(normalized - 0) < 1e-9 || Math.abs(normalized - 360) < 1e-9) {
    return { sin: 0, cos: 1 };
  }
  if (Math.abs(normalized - 90) < 1e-9) {
    return { sin: 1, cos: 0 };
  }
  if (Math.abs(normalized - 180) < 1e-9) {
    return { sin: 0, cos: -1 };
  }
  if (Math.abs(normalized - 270) < 1e-9) {
    return { sin: -1, cos: 0 };
  }
  const rad = (angleDeg * Math.PI) / 180;
  return {
    sin: cleanTinyZero(Math.sin(rad)),
    cos: cleanTinyZero(Math.cos(rad)),
  };
}

export function resolveReflectionLineEquation(params: TransformationParams): {
  valid: boolean;
  a: number;
  b: number;
  c: number;
  errorVi?: string;
} {
  if (params.lineMode === 'EQUATION' && params.lineEq) {
    const { a, b, c } = params.lineEq;
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
      return { valid: false, a: 0, b: 0, c: 0, errorVi: 'Hệ số đường thẳng không hợp lệ.' };
    }
    if (a * a + b * b < EPSILON) {
      return {
        valid: false,
        a: 0,
        b: 0,
        c: 0,
        errorVi: 'Đường thẳng suy biến (a = 0 và b = 0 đồng thời), không thể thực hiện đối xứng trục.',
      };
    }
    return { valid: true, a, b, c };
  }

  const p1 = params.lineP1 ?? { x: -4, y: -4 };
  const p2 = params.lineP2 ?? { x: 4, y: 4 };
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  if (dx * dx + dy * dy < EPSILON) {
    return {
      valid: false,
      a: 0,
      b: 0,
      c: 0,
      errorVi: 'Đường thẳng đối xứng suy biến (hai điểm định hướng P₁ và P₂ trùng nhau).',
    };
  }
  // Đường thẳng qua P1, P2 có VTPT n = (-(y2 - y1), x2 - x1)
  const a = -dy;
  const b = dx;
  const c = -(a * p1.x + b * p1.y);
  return { valid: true, a, b, c };
}

/**
 * Biến đổi 1 điểm theo phép biến hình chỉ định.
 * Tái sử dụng kiểu Point2D và EPSILON từ mathVerificationEngine (dùng chung M01).
 */
export function transformPoint2D(
  pt: Point2D,
  params: TransformationParams,
  progressT = 1
): TransformedPointResult {
  const t = Math.min(1, Math.max(0, Number.isFinite(progressT) ? progressT : 1));

  if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
    return {
      valid: false,
      errorVi: 'Tọa độ điểm không hợp lệ.',
      original: pt,
      image: pt,
    };
  }

  switch (params.kind) {
    case 'TRANSLATE': {
      const dx = Number.isFinite(params.dx) ? (params.dx as number) : 0;
      const dy = Number.isFinite(params.dy) ? (params.dy as number) : 0;
      return {
        valid: true,
        original: pt,
        image: {
          x: cleanTinyZero(pt.x + dx * t),
          y: cleanTinyZero(pt.y + dy * t),
        },
      };
    }

    case 'REFLECT_OX': {
      const target = { x: pt.x, y: cleanTinyZero(-pt.y) };
      return {
        valid: true,
        original: pt,
        projectionPoint: { x: pt.x, y: 0 },
        image: {
          x: pt.x,
          y: cleanTinyZero(pt.y + (target.y - pt.y) * t),
        },
      };
    }

    case 'REFLECT_OY': {
      const target = { x: cleanTinyZero(-pt.x), y: pt.y };
      return {
        valid: true,
        original: pt,
        projectionPoint: { x: 0, y: pt.y },
        image: {
          x: cleanTinyZero(pt.x + (target.x - pt.x) * t),
          y: pt.y,
        },
      };
    }

    case 'REFLECT_LINE': {
      const line = resolveReflectionLineEquation(params);
      if (!line.valid) {
        return {
          valid: false,
          isDegenerateLine: true,
          errorVi: line.errorVi,
          original: pt,
          image: pt,
        };
      }
      const denom = line.a * line.a + line.b * line.b;
      const signedDistFactor = (line.a * pt.x + line.b * pt.y + line.c) / denom;
      const proj: Point2D = {
        x: cleanTinyZero(pt.x - line.a * signedDistFactor),
        y: cleanTinyZero(pt.y - line.b * signedDistFactor),
      };
      const fullImg: Point2D = {
        x: cleanTinyZero(pt.x - 2 * line.a * signedDistFactor),
        y: cleanTinyZero(pt.y - 2 * line.b * signedDistFactor),
      };
      return {
        valid: true,
        original: pt,
        projectionPoint: proj,
        image: {
          x: cleanTinyZero(pt.x + (fullImg.x - pt.x) * t),
          y: cleanTinyZero(pt.y + (fullImg.y - pt.y) * t),
        },
      };
    }

    case 'REFLECT_POINT': {
      const c = params.center ?? { x: 0, y: 0 };
      const target = {
        x: cleanTinyZero(2 * c.x - pt.x),
        y: cleanTinyZero(2 * c.y - pt.y),
      };
      return {
        valid: true,
        original: pt,
        projectionPoint: c,
        image: {
          x: cleanTinyZero(pt.x + (target.x - pt.x) * t),
          y: cleanTinyZero(pt.y + (target.y - pt.y) * t),
        },
      };
    }

    case 'ROTATE': {
      const c = params.center ?? { x: 0, y: 0 };
      const theta = (Number.isFinite(params.angleDeg) ? (params.angleDeg as number) : 0) * t;
      const { sin, cos } = exactSinCosDeg(theta);
      const u = pt.x - c.x;
      const v = pt.y - c.y;
      return {
        valid: true,
        original: pt,
        image: {
          x: cleanTinyZero(c.x + u * cos - v * sin),
          y: cleanTinyZero(c.y + u * sin + v * cos),
        },
      };
    }

    case 'DILATION': {
      const c = params.center ?? { x: 0, y: 0 };
      const kTarget = Number.isFinite(params.scaleK) ? (params.scaleK as number) : 1;
      const kEffective = 1 + (kTarget - 1) * t;
      return {
        valid: true,
        original: pt,
        image: {
          x: cleanTinyZero(c.x + kEffective * (pt.x - c.x)),
          y: cleanTinyZero(c.y + kEffective * (pt.y - c.y)),
        },
      };
    }
  }
}

export function computePolygonMetrics(pts: Point2D[]): PolygonInvariantMetrics | null {
  if (pts.length < 3) return null;
  const sideAB = distance2D(pts[0], pts[1]);
  const sideBC = distance2D(pts[1], pts[2]);
  const sideCA = distance2D(pts[2], pts[0]);
  const angleB = angleDegreesABC(pts[0], pts[1], pts[2]);
  const area = polygonArea2D(pts);
  return { sideAB, sideBC, sideCA, angleB, area };
}

export function transformPolygon2D(
  pts: Point2D[],
  params: TransformationParams,
  progressT = 1
): TransformationBatchResult {
  const isExpandedContent =
    params.kind === 'TRANSLATE' ||
    params.kind === 'ROTATE' ||
    params.kind === 'REFLECT_LINE' ||
    params.kind === 'DILATION';

  const k = params.scaleK ?? 1;
  const isIsometry = params.kind !== 'DILATION' || Math.abs(Math.abs(k) - 1) < EPSILON;

  const results = pts.map((p) => transformPoint2D(p, params, progressT));
  const firstInvalid = results.find((r) => !r.valid);

  if (firstInvalid) {
    return {
      valid: false,
      isDegenerateLine: Boolean(firstInvalid.isDegenerateLine),
      isIsometry,
      isExpandedContent,
      errorVi: firstInvalid.errorVi,
      images: pts,
      projections: pts.map(() => undefined),
      originalMetrics: computePolygonMetrics(pts),
      imageMetrics: computePolygonMetrics(pts),
      lengthRatioAB: 1,
      summaryLatex: '\\text{Đường thẳng suy biến}',
    };
  }

  const images = results.map((r) => r.image);
  const projections = results.map((r) => r.projectionPoint);
  const origM = computePolygonMetrics(pts);
  const imgM = computePolygonMetrics(images);

  const ratioAB =
    origM && imgM && origM.sideAB > EPSILON ? imgM.sideAB / origM.sideAB : null;

  let warningVi: string | undefined;
  if (params.kind === 'DILATION') {
    if (Math.abs(k) < EPSILON) {
      warningVi = 'Tỉ số vị tự k = 0 làm mọi điểm co về đúng tâm C (hình suy biến thành một điểm).';
    } else if (Math.abs(Math.abs(k) - 1) > EPSILON) {
      warningVi = `Phép vị tự với tỉ số k = ${k} làm thay đổi độ dài đoạn thẳng theo hệ số |k| = ${Math.abs(k)} và diện tích theo k² = ${Number((k * k).toFixed(2))}; đây KHÔNG phải phép dời hình.`;
    }
  }

  let summaryLatex = '';
  switch (params.kind) {
    case 'TRANSLATE':
      summaryLatex = `T_{\\vec{v}(${params.dx ?? 0};\\, ${params.dy ?? 0})}: (x; y) \\mapsto (x ${((params.dx ?? 0) >= 0 ? `+ ${params.dx ?? 0}` : `- ${Math.abs(params.dx ?? 0)}`)};\\, y ${((params.dy ?? 0) >= 0 ? `+ ${params.dy ?? 0}` : `- ${Math.abs(params.dy ?? 0)}`)})`;
      break;
    case 'REFLECT_OX':
      summaryLatex = '\\text{Đ}_{Ox}: (x; y) \\mapsto (x; -y)';
      break;
    case 'REFLECT_OY':
      summaryLatex = '\\text{Đ}_{Oy}: (x; y) \\mapsto (-x; y)';
      break;
    case 'REFLECT_LINE': {
      const line = resolveReflectionLineEquation(params);
      summaryLatex = line.valid
        ? `\\text{Đ}_d:\\; ${Number(line.a.toFixed(2))}x + ${Number(line.b.toFixed(2))}y + ${Number(line.c.toFixed(2))} = 0`
        : '\\text{Đường thẳng suy biến}';
      break;
    }
    case 'REFLECT_POINT': {
      const c = params.center ?? { x: 0, y: 0 };
      summaryLatex = `\\text{Đ}_{I(${c.x};\\, ${c.y})}: (x; y) \\mapsto (${2 * c.x} - x;\\, ${2 * c.y} - y)`;
      break;
    }
    case 'ROTATE': {
      const c = params.center ?? { x: 0, y: 0 };
      summaryLatex = `Q_{(C(${c.x};\\,${c.y}),\\, ${params.angleDeg ?? 0}^\\circ)}`;
      break;
    }
    case 'DILATION': {
      const c = params.center ?? { x: 0, y: 0 };
      summaryLatex = `V_{(C(${c.x};\\,${c.y}),\\, k = ${k})}:\\; \\overrightarrow{CM'} = ${k}\\overrightarrow{CM}`;
      break;
    }
  }

  return {
    valid: true,
    isDegenerateLine: false,
    isIsometry,
    isExpandedContent,
    warningVi,
    images,
    projections,
    originalMetrics: origM,
    imageMetrics: imgM,
    lengthRatioAB: ratioAB,
    summaryLatex,
  };
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG M14 (9 TEST CASE BẮT BUỘC)
// ============================================================================

export interface M14UnitTestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runM14UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: M14UnitTestCaseResult[];
} {
  const cases: M14UnitTestCaseResult[] = [];
  const near = (u: number, v: number) => Math.abs(u - v) < 1e-9;

  // 1. Tịnh tiến (1, 2) theo (3, -1) -> (4, 1)
  const tr = transformPoint2D({ x: 1, y: 2 }, { kind: 'TRANSLATE', dx: 3, dy: -1 });
  cases.push({
    id: 'm14_translate',
    label: 'Tịnh tiến (1, 2) theo (3, -1) thành (4, 1)',
    passed: tr.valid && near(tr.image.x, 4) && near(tr.image.y, 1),
    detail: `Ảnh: (${tr.image.x}, ${tr.image.y})`,
  });

  // 2. Quay (1, 0) góc 90° quanh O -> (0, 1)
  const rot90 = transformPoint2D(
    { x: 1, y: 0 },
    { kind: 'ROTATE', center: { x: 0, y: 0 }, angleDeg: 90 }
  );
  cases.push({
    id: 'm14_rotate_90',
    label: 'Quay (1, 0) góc 90° quanh O thành (0, 1)',
    passed: rot90.valid && near(rot90.image.x, 0) && near(rot90.image.y, 1),
    detail: `Ảnh: (${rot90.image.x}, ${rot90.image.y})`,
  });

  // 3. Đối xứng (2, 3) qua Ox -> (2, -3)
  const refOx = transformPoint2D({ x: 2, y: 3 }, { kind: 'REFLECT_OX' });
  cases.push({
    id: 'm14_reflect_ox',
    label: 'Đối xứng (2, 3) qua Ox thành (2, -3)',
    passed: refOx.valid && near(refOx.image.x, 2) && near(refOx.image.y, -3),
    detail: `Ảnh: (${refOx.image.x}, ${refOx.image.y})`,
  });

  // 4. Đối xứng (2, 3) qua Oy -> (-2, 3)
  const refOy = transformPoint2D({ x: 2, y: 3 }, { kind: 'REFLECT_OY' });
  cases.push({
    id: 'm14_reflect_oy',
    label: 'Đối xứng (2, 3) qua Oy thành (-2, 3)',
    passed: refOy.valid && near(refOy.image.x, -2) && near(refOy.image.y, 3),
    detail: `Ảnh: (${refOy.image.x}, ${refOy.image.y})`,
  });

  // 5. Đối xứng (2, 3) qua O -> (-2, -3)
  const refO = transformPoint2D(
    { x: 2, y: 3 },
    { kind: 'REFLECT_POINT', center: { x: 0, y: 0 } }
  );
  cases.push({
    id: 'm14_reflect_origin',
    label: 'Đối xứng (2, 3) qua O thành (-2, -3)',
    passed: refO.valid && near(refO.image.x, -2) && near(refO.image.y, -3),
    detail: `Ảnh: (${refO.image.x}, ${refO.image.y})`,
  });

  // 6. Bảo toàn khoảng cách AB = A'B' qua phép dời hình (tịnh tiến, đối xứng đường xiên, quay)
  const sampleTri: Point2D[] = [
    { x: 1, y: 1 },
    { x: 4, y: 2 },
    { x: 2, y: 5 },
  ];
  const abOrig = distance2D(sampleTri[0], sampleTri[1]);
  const reflAny = transformPolygon2D(sampleTri, {
    kind: 'REFLECT_LINE',
    lineMode: 'EQUATION',
    lineEq: { a: 1, b: -1, c: 0 }, // Đường thẳng y = x
  });
  const rotArbitrary = transformPolygon2D(sampleTri, {
    kind: 'ROTATE',
    center: { x: 1, y: -2 },
    angleDeg: 37,
  });
  const isometryPass =
    reflAny.valid &&
    reflAny.isIsometry &&
    rotArbitrary.valid &&
    rotArbitrary.isIsometry &&
    near(abOrig, distance2D(reflAny.images[0], reflAny.images[1])) &&
    near(abOrig, distance2D(rotArbitrary.images[0], rotArbitrary.images[1]));
  cases.push({
    id: 'm14_isometry_length',
    label: 'Phép dời hình (đối xứng đường bất kỳ, quay) bảo toàn AB = A′B′',
    passed: isometryPass,
    detail: `AB = ${abOrig.toFixed(4)}; A′B′(quay 37°) = ${distance2D(rotArbitrary.images[0], rotArbitrary.images[1]).toFixed(4)}`,
  });

  // 7. Quay 360° trả về đúng vị trí ban đầu
  const rot360 = transformPoint2D(
    { x: -3.25, y: 4.5 },
    { kind: 'ROTATE', center: { x: 1, y: -1 }, angleDeg: 360 }
  );
  cases.push({
    id: 'm14_rotate_360',
    label: 'Quay 360° quanh tâm C bất kỳ trả về vị trí ban đầu',
    passed: rot360.valid && near(rot360.image.x, -3.25) && near(rot360.image.y, 4.5),
    detail: `Ảnh: (${rot360.image.x}, ${rot360.image.y})`,
  });

  // 8. Đường đối xứng suy biến được xử lý an toàn
  const degenPts = transformPoint2D(
    { x: 2, y: 3 },
    { kind: 'REFLECT_LINE', lineMode: 'TWO_POINTS', lineP1: { x: 1, y: 1 }, lineP2: { x: 1, y: 1 } }
  );
  const degenEq = transformPoint2D(
    { x: 2, y: 3 },
    { kind: 'REFLECT_LINE', lineMode: 'EQUATION', lineEq: { a: 0, b: 0, c: 5 } }
  );
  cases.push({
    id: 'm14_degenerate_line',
    label: 'Đường đối xứng suy biến trả về lỗi an toàn (không NaN)',
    passed:
      !degenPts.valid &&
      Boolean(degenPts.isDegenerateLine) &&
      !degenEq.valid &&
      Boolean(degenEq.isDegenerateLine),
    detail: 'Cả 2 trường hợp suy biến đều bị chặn an toàn',
  });

  // 9. Phép vị tự k = -2 thay đổi độ dài theo |k| = 2 và không phải phép dời hình
  const dilRes = transformPolygon2D(sampleTri, {
    kind: 'DILATION',
    center: { x: 0, y: 0 },
    scaleK: -2,
  });
  cases.push({
    id: 'm14_dilation_scale',
    label: 'Phép vị tự k = -2 nhân độ dài theo |k| = 2 và isIsometry = false',
    passed:
      dilRes.valid &&
      !dilRes.isIsometry &&
      dilRes.lengthRatioAB !== null &&
      near(dilRes.lengthRatioAB, 2),
    detail: `Tỉ số A′B′/AB = ${dilRes.lengthRatioAB}; isIsometry = ${dilRes.isIsometry}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
