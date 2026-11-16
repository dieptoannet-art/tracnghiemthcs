import {
  EPSILON,
  Point2D,
  angleDegreesABC,
  distance2D,
  polygonArea2D,
} from './mathVerificationEngine';

export interface ThalesAnalysisResult {
  valid: boolean;
  errorVi?: string;
  triangleA: Point2D;
  triangleB: Point2D;
  triangleC: Point2D;
  pointM: Point2D;
  pointN: Point2D;
  ratioT: number;
  deviateN: number;
  lenAM: number;
  lenMB: number;
  lenAB: number;
  lenAN: number;
  lenNC: number;
  lenAC: number;
  lenMN: number;
  lenBC: number;
  ratioAM_AB: number;
  ratioAN_AC: number;
  ratioMN_BC: number;
  ratioAM_MB: number | null;
  ratioAN_NC: number | null;
  areaAMN: number;
  areaABC: number;
  areaRatio: number;
  isParallel: boolean;
  isMidsegment: boolean;
  angleA: number;
  angleAMN: number;
  angleABC: number;
  conclusionVi: string;
  summaryLatex: string;
}

export interface TriangleMetrics {
  sideAB: number;
  sideBC: number;
  sideCA: number;
  angleA: number;
  angleB: number;
  angleC: number;
  perimeter: number;
  area: number;
}

export interface SimilarityAnalysisResult {
  valid: boolean;
  errorVi?: string;
  isSimilar: boolean;
  scaleK: number | null;
  ratioAB: number | null;
  ratioBC: number | null;
  ratioCA: number | null;
  perimeterRatio: number | null;
  areaRatio: number | null;
  matchedByCCC: boolean;
  matchedByCGC: boolean;
  matchedByGG: boolean;
  tri1Metrics: TriangleMetrics | null;
  tri2Metrics: TriangleMetrics | null;
  conclusionVi: string;
  summaryLatex: string;
}

export interface AngleBisectorResult {
  valid: boolean;
  errorVi?: string;
  vertexA: Point2D;
  vertexB: Point2D;
  vertexC: Point2D;
  footD: Point2D;
  lenAB: number;
  lenAC: number;
  lenDB: number;
  lenDC: number;
  lenBC: number;
  lenAD: number;
  ratioAB_AC: number;
  ratioDB_DC: number;
  angleBAD: number;
  angleCAD: number;
  summaryLatex: string;
}

export interface ShadowHeightResult {
  valid: boolean;
  errorVi?: string;
  poleHeight: number;
  poleShadow: number;
  treeShadow: number;
  estimatedHeight: number;
  scaleFactor: number;
  summaryLatex: string;
}

function isCollinearOrDegenerate(A: Point2D, B: Point2D, C: Point2D): boolean {
  return polygonArea2D([A, B, C]) < 1e-4;
}

/**
 * Phân tích Định lý Thalès, Hệ quả và Định lý Thalès đảo trên tam giác ABC.
 * M nằm trên tia AB tại vị trí A + t*(B - A); N nằm trên tia AC tại vị trí A + (t + deviateN)*(C - A).
 */
export function analyzeThalesTheorem(params: {
  A: Point2D;
  B: Point2D;
  C: Point2D;
  ratioT: number;
  deviateN?: number;
}): ThalesAnalysisResult {
  const { A, B, C, ratioT } = params;
  const deviateN = Number.isFinite(params.deviateN) ? (params.deviateN as number) : 0;

  if (
    !Number.isFinite(ratioT) ||
    ratioT <= 0.05 ||
    isCollinearOrDegenerate(A, B, C)
  ) {
    return {
      valid: false,
      errorVi: 'Tam giác ABC không hợp lệ (ba đỉnh thẳng hàng hoặc tỉ lệ không dương).',
      triangleA: A,
      triangleB: B,
      triangleC: C,
      pointM: A,
      pointN: A,
      ratioT: 0,
      deviateN: 0,
      lenAM: 0,
      lenMB: 0,
      lenAB: 0,
      lenAN: 0,
      lenNC: 0,
      lenAC: 0,
      lenMN: 0,
      lenBC: 0,
      ratioAM_AB: 0,
      ratioAN_AC: 0,
      ratioMN_BC: 0,
      ratioAM_MB: null,
      ratioAN_NC: null,
      areaAMN: 0,
      areaABC: 0,
      areaRatio: 0,
      isParallel: false,
      isMidsegment: false,
      angleA: 0,
      angleAMN: 0,
      angleABC: 0,
      conclusionVi: 'Dữ liệu tam giác không hợp lệ.',
      summaryLatex: '\\text{Tam giác suy biến}',
    };
  }

  const tN = Math.max(0.05, ratioT + deviateN);
  const M: Point2D = {
    x: A.x + ratioT * (B.x - A.x),
    y: A.y + ratioT * (B.y - A.y),
  };
  const N: Point2D = {
    x: A.x + tN * (C.x - A.x),
    y: A.y + tN * (C.y - A.y),
  };

  const lenAM = distance2D(A, M);
  const lenMB = distance2D(M, B);
  const lenAB = distance2D(A, B);
  const lenAN = distance2D(A, N);
  const lenNC = distance2D(N, C);
  const lenAC = distance2D(A, C);
  const lenMN = distance2D(M, N);
  const lenBC = distance2D(B, C);

  const ratioAM_AB = lenAB > EPSILON ? lenAM / lenAB : 0;
  const ratioAN_AC = lenAC > EPSILON ? lenAN / lenAC : 0;
  const ratioMN_BC = lenBC > EPSILON ? lenMN / lenBC : 0;
  const ratioAM_MB = lenMB > 1e-6 ? lenAM / lenMB : null;
  const ratioAN_NC = lenNC > 1e-6 ? lenAN / lenNC : null;

  const areaAMN = polygonArea2D([A, M, N]);
  const areaABC = polygonArea2D([A, B, C]);
  const areaRatio = areaABC > EPSILON ? areaAMN / areaABC : 0;

  // Kiểm tra MN // BC bằng tích có hướng chuẩn hóa
  const mnX = N.x - M.x;
  const mnY = N.y - M.y;
  const bcX = C.x - B.x;
  const bcY = C.y - B.y;
  const cross = Math.abs(mnX * bcY - mnY * bcX);
  const sinAngle = lenMN > EPSILON && lenBC > EPSILON ? cross / (lenMN * lenBC) : 1;
  const isParallel = sinAngle < 1e-4 && Math.abs(ratioAM_AB - ratioAN_AC) < 1e-4;
  const isMidsegment = isParallel && Math.abs(ratioAM_AB - 0.5) < 1e-3;

  const angleA = angleDegreesABC(B, A, C);
  const angleAMN = angleDegreesABC(A, M, N);
  const angleABC = angleDegreesABC(A, B, C);

  let conclusionVi = '';
  if (isMidsegment) {
    conclusionVi = 'M, N là trung điểm AB, AC: MN là đường trung bình (MN ∥ BC và MN = 1/2 BC, S_AMN = 1/4 S_ABC).';
  } else if (isParallel && ratioT <= 1) {
    conclusionVi = `Định lý Thalès thỏa mãn: AM/AB = AN/AC = MN/BC = ${Number(ratioAM_AB.toFixed(3))} ⇒ MN ∥ BC và △AMN ∽ △ABC.`;
  } else if (isParallel && ratioT > 1) {
    conclusionVi = `Hệ quả Thalès (phần kéo dài t = ${Number(ratioT.toFixed(2))}): MN ∥ BC vẫn tạo △AMN ∽ △ABC với tỉ số k = ${Number(ratioAM_AB.toFixed(3))}.`;
  } else {
    conclusionVi = `Định lý Thalès đảo: AM/AB (${Number(ratioAM_AB.toFixed(3))}) ≠ AN/AC (${Number(ratioAN_AC.toFixed(3))}) ⇒ MN KHÔNG song song với BC.`;
  }

  const summaryLatex = isParallel
    ? `\\frac{AM}{AB} = \\frac{AN}{AC} = \\frac{MN}{BC} = ${Number(ratioAM_AB.toFixed(2))} \\;\\Rightarrow\\; MN \\parallel BC`
    : `\\frac{AM}{AB} = ${Number(ratioAM_AB.toFixed(2))} \\neq ${Number(ratioAN_AC.toFixed(2))} = \\frac{AN}{AC} \\;\\Rightarrow\\; MN \\nparallel BC`;

  return {
    valid: true,
    triangleA: A,
    triangleB: B,
    triangleC: C,
    pointM: M,
    pointN: N,
    ratioT,
    deviateN,
    lenAM,
    lenMB,
    lenAB,
    lenAN,
    lenNC,
    lenAC,
    lenMN,
    lenBC,
    ratioAM_AB,
    ratioAN_AC,
    ratioMN_BC,
    ratioAM_MB,
    ratioAN_NC,
    areaAMN,
    areaABC,
    areaRatio,
    isParallel,
    isMidsegment,
    angleA,
    angleAMN,
    angleABC,
    conclusionVi,
    summaryLatex,
  };
}

export function computeTriangleMetrics(
  A: Point2D,
  B: Point2D,
  C: Point2D
): TriangleMetrics | null {
  if (isCollinearOrDegenerate(A, B, C)) return null;
  const sideAB = distance2D(A, B);
  const sideBC = distance2D(B, C);
  const sideCA = distance2D(C, A);
  const angleA = angleDegreesABC(B, A, C);
  const angleB = angleDegreesABC(A, B, C);
  const angleC = angleDegreesABC(A, C, B);
  return {
    sideAB,
    sideBC,
    sideCA,
    angleA,
    angleB,
    angleC,
    perimeter: sideAB + sideBC + sideCA,
    area: polygonArea2D([A, B, C]),
  };
}

/**
 * Dựng tam giác A'B'C' đồng dạng với ABC theo tỉ số k > 0 (có tùy chọn dịch chuyển & độ lệch đỉnh C').
 */
export function buildScaledTriangle(params: {
  A: Point2D;
  B: Point2D;
  C: Point2D;
  scaleK: number;
  offset?: Point2D;
  distortC?: Point2D;
}): { valid: boolean; errorVi?: string; points: [Point2D, Point2D, Point2D] } {
  const { A, B, C, scaleK } = params;
  const offset = params.offset ?? { x: 8, y: 0 };
  const distort = params.distortC ?? { x: 0, y: 0 };

  if (!Number.isFinite(scaleK) || scaleK <= EPSILON || isCollinearOrDegenerate(A, B, C)) {
    return {
      valid: false,
      errorVi: 'Tỉ số đồng dạng k phải lớn hơn 0 và tam giác gốc không được suy biến.',
      points: [A, B, C],
    };
  }

  const A2: Point2D = { x: offset.x, y: offset.y };
  const B2: Point2D = {
    x: offset.x + scaleK * (B.x - A.x),
    y: offset.y + scaleK * (B.y - A.y),
  };
  const C2: Point2D = {
    x: offset.x + scaleK * (C.x - A.x) + distort.x,
    y: offset.y + scaleK * (C.y - A.y) + distort.y,
  };

  if (isCollinearOrDegenerate(A2, B2, C2)) {
    return {
      valid: false,
      errorVi: 'Tam giác ảnh bị suy biến (ba đỉnh thẳng hàng).',
      points: [A2, B2, C2],
    };
  }

  return { valid: true, points: [A2, B2, C2] };
}

/**
 * Kiểm tra sự đồng dạng giữa △ABC và △A'B'C' theo đúng thứ tự đỉnh (và kiểm tra bất biến tỉ lệ/góc).
 */
export function analyzeTriangleSimilarity(
  tri1: [Point2D, Point2D, Point2D],
  tri2: [Point2D, Point2D, Point2D],
  tolerance = 1e-3
): SimilarityAnalysisResult {
  const m1 = computeTriangleMetrics(tri1[0], tri1[1], tri1[2]);
  const m2 = computeTriangleMetrics(tri2[0], tri2[1], tri2[2]);

  if (!m1 || !m2) {
    return {
      valid: false,
      errorVi: 'Một trong hai tam giác bị suy biến (diện tích bằng 0).',
      isSimilar: false,
      scaleK: null,
      ratioAB: null,
      ratioBC: null,
      ratioCA: null,
      perimeterRatio: null,
      areaRatio: null,
      matchedByCCC: false,
      matchedByCGC: false,
      matchedByGG: false,
      tri1Metrics: m1,
      tri2Metrics: m2,
      conclusionVi: 'Tam giác suy biến.',
      summaryLatex: '\\text{Tam giác suy biến}',
    };
  }

  const rAB = m2.sideAB / m1.sideAB;
  const rBC = m2.sideBC / m1.sideBC;
  const rCA = m2.sideCA / m1.sideCA;

  const matchedByCCC =
    Math.abs(rAB - rBC) <= tolerance &&
    Math.abs(rBC - rCA) <= tolerance &&
    Math.abs(rCA - rAB) <= tolerance;

  const angleTol = 0.15; // độ sai số cho phép nhỏ hơn 0.15°
  const matchedByCGC =
    Math.abs(rAB - rCA) <= tolerance && Math.abs(m1.angleA - m2.angleA) <= angleTol;

  const matchedByGG =
    Math.abs(m1.angleA - m2.angleA) <= angleTol &&
    Math.abs(m1.angleB - m2.angleB) <= angleTol;

  const isSimilar = matchedByCCC || matchedByCGC || matchedByGG;
  const perimRatio = m2.perimeter / m1.perimeter;
  const areaRatio = m2.area / m1.area;
  const scaleK = isSimilar ? (rAB + rBC + rCA) / 3 : null;

  const conclusionVi = isSimilar
    ? `Hai tam giác ĐỒNG DẠNG △A′B′C′ ∽ △ABC với tỉ số k = ${Number((scaleK ?? 1).toFixed(2))}; tỉ số chu vi = k = ${Number(perimRatio.toFixed(2))}, tỉ số diện tích = k² = ${Number(areaRatio.toFixed(2))}.`
    : 'Hai tam giác KHÔNG ĐỒNG DẠNG vì các cặp cạnh không cùng tỉ lệ và các góc tương ứng không bằng nhau.';

  const summaryLatex = isSimilar
    ? `\\triangle A'B'C' \\backsim \\triangle ABC \\;\\;(k = ${Number((scaleK ?? 1).toFixed(2))}), \\quad \\frac{S'}{S} = k^2 = ${Number(areaRatio.toFixed(2))}`
    : `\\frac{A'B'}{AB} = ${Number(rAB.toFixed(2))}, \\; \\frac{B'C'}{BC} = ${Number(rBC.toFixed(2))}, \\; \\frac{C'A'}{CA} = ${Number(rCA.toFixed(2))} \\;(\\text{Không đồng dạng})`;

  return {
    valid: true,
    isSimilar,
    scaleK,
    ratioAB: rAB,
    ratioBC: rBC,
    ratioCA: rCA,
    perimeterRatio: perimRatio,
    areaRatio,
    matchedByCCC,
    matchedByCGC,
    matchedByGG,
    tri1Metrics: m1,
    tri2Metrics: m2,
    conclusionVi,
    summaryLatex,
  };
}

/**
 * Tính chất đường phân giác trong tam giác ABC: AD là phân giác góc A (D ∈ BC) ⇒ DB / DC = AB / AC.
 */
export function analyzeAngleBisector(
  A: Point2D,
  B: Point2D,
  C: Point2D
): AngleBisectorResult {
  if (isCollinearOrDegenerate(A, B, C)) {
    const z: Point2D = { x: 0, y: 0 };
    return {
      valid: false,
      errorVi: 'Tam giác ABC không hợp lệ (ba đỉnh thẳng hàng).',
      vertexA: z,
      vertexB: z,
      vertexC: z,
      footD: z,
      lenAB: 0,
      lenAC: 0,
      lenDB: 0,
      lenDC: 0,
      lenBC: 0,
      lenAD: 0,
      ratioAB_AC: 0,
      ratioDB_DC: 0,
      angleBAD: 0,
      angleCAD: 0,
      summaryLatex: '\\text{Tam giác suy biến}',
    };
  }

  const lenAB = distance2D(A, B);
  const lenAC = distance2D(A, C);
  const denom = lenAB + lenAC;

  // Điểm D chia trong cạnh BC theo tỉ số DB / DC = AB / AC
  const D: Point2D = {
    x: (lenAC * B.x + lenAB * C.x) / denom,
    y: (lenAC * B.y + lenAB * C.y) / denom,
  };

  const lenDB = distance2D(D, B);
  const lenDC = distance2D(D, C);
  const lenBC = distance2D(B, C);
  const lenAD = distance2D(A, D);

  const ratioAB_AC = lenAB / lenAC;
  const ratioDB_DC = lenDB / lenDC;
  const angleBAD = angleDegreesABC(B, A, D);
  const angleCAD = angleDegreesABC(C, A, D);

  return {
    valid: true,
    vertexA: A,
    vertexB: B,
    vertexC: C,
    footD: D,
    lenAB,
    lenAC,
    lenDB,
    lenDC,
    lenBC,
    lenAD,
    ratioAB_AC,
    ratioDB_DC,
    angleBAD,
    angleCAD,
    summaryLatex: `\\frac{DB}{DC} = \\frac{AB}{AC} = ${Number(ratioAB_AC.toFixed(3))} \\quad (\\widehat{BAD} = \\widehat{CAD} = ${Number(angleBAD.toFixed(1))}^\\circ)`,
  };
}

/**
 * Ứng dụng tam giác đồng dạng đo gián tiếp chiều cao vật thể bằng bóng nắng:
 * H / h_cọc = L_bóng_cây / l_bóng_cọc.
 */
export function solveShadowHeight(params: {
  poleHeight: number;
  poleShadow: number;
  treeShadow: number;
}): ShadowHeightResult {
  const { poleHeight, poleShadow, treeShadow } = params;
  if (
    !Number.isFinite(poleHeight) ||
    !Number.isFinite(poleShadow) ||
    !Number.isFinite(treeShadow) ||
    poleHeight <= EPSILON ||
    poleShadow <= EPSILON ||
    treeShadow <= EPSILON
  ) {
    return {
      valid: false,
      errorVi: 'Chiều cao cọc, bóng cọc và bóng vật cần đo đều phải là số dương lớn hơn 0.',
      poleHeight: 0,
      poleShadow: 0,
      treeShadow: 0,
      estimatedHeight: 0,
      scaleFactor: 0,
      summaryLatex: '\\text{Dữ liệu không hợp lệ}',
    };
  }

  const scaleFactor = treeShadow / poleShadow;
  const estimatedHeight = poleHeight * scaleFactor;

  return {
    valid: true,
    poleHeight,
    poleShadow,
    treeShadow,
    estimatedHeight,
    scaleFactor,
    summaryLatex: `H = h_{\\text{cọc}} \\cdot \\frac{L_{\\text{bóng}}}{l_{\\text{cọc}}} = ${poleHeight} \\cdot \\frac{${treeShadow}}{${poleShadow}} = ${Number(estimatedHeight.toFixed(2))}\\text{ m}`,
  };
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG M16 (10 TEST CASE BẮT BUỘC)
// ============================================================================

export interface M16UnitTestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runM16UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: M16UnitTestCaseResult[];
} {
  const cases: M16UnitTestCaseResult[] = [];
  const near = (u: number, v: number, tol = 1e-6) => Math.abs(u - v) < tol;

  const triA: Point2D = { x: 0, y: 5 };
  const triB: Point2D = { x: -3, y: 0 };
  const triC: Point2D = { x: 4, y: 0 };

  // 1. Thalès chuẩn t = 0.4
  const thalesStd = analyzeThalesTheorem({ A: triA, B: triB, C: triC, ratioT: 0.4 });
  cases.push({
    id: 'm16_thales_std',
    label: 'Định lý Thalès (t=0.4): AM/AB = AN/AC = MN/BC = 0.4 và MN ∥ BC',
    passed:
      thalesStd.valid &&
      thalesStd.isParallel &&
      near(thalesStd.ratioAM_AB, 0.4) &&
      near(thalesStd.ratioAN_AC, 0.4) &&
      near(thalesStd.ratioMN_BC, 0.4) &&
      thalesStd.ratioAM_MB !== null &&
      near(thalesStd.ratioAM_MB, 2 / 3),
    detail: `AM/AB=${thalesStd.ratioAM_AB.toFixed(3)}, parallel=${thalesStd.isParallel}`,
  });

  // 2. Thalès đảo (deviateN = 0.2 làm lệch N -> MN không song song BC)
  const thalesBad = analyzeThalesTheorem({
    A: triA,
    B: triB,
    C: triC,
    ratioT: 0.4,
    deviateN: 0.25,
  });
  cases.push({
    id: 'm16_thales_converse',
    label: 'Định lý Thalès đảo: Lệch tỉ lệ trên AC làm mất tính song song MN ∦ BC',
    passed:
      thalesBad.valid &&
      !thalesBad.isParallel &&
      !near(thalesBad.ratioAM_AB, thalesBad.ratioAN_AC),
    detail: `AM/AB=${thalesBad.ratioAM_AB.toFixed(2)}, AN/AC=${thalesBad.ratioAN_AC.toFixed(2)}, parallel=${thalesBad.isParallel}`,
  });

  // 3. Hệ quả Thalès (t = 1.5 > 1) và tỉ số diện tích k^2
  const thalesExt = analyzeThalesTheorem({ A: triA, B: triB, C: triC, ratioT: 1.5 });
  cases.push({
    id: 'm16_thales_ext',
    label: 'Hệ quả Thalès (t=1.5): MN/BC = 1.5 và S_AMN/S_ABC = 2.25',
    passed:
      thalesExt.valid &&
      thalesExt.isParallel &&
      near(thalesExt.ratioMN_BC, 1.5) &&
      near(thalesExt.areaRatio, 2.25),
    detail: `MN/BC=${thalesExt.ratioMN_BC.toFixed(2)}, S_ratio=${thalesExt.areaRatio.toFixed(2)}`,
  });

  // 4. Đường trung bình t = 0.5 -> MN = 1/2 BC, S_AMN = 1/4 S_ABC
  const thalesMid = analyzeThalesTheorem({ A: triA, B: triB, C: triC, ratioT: 0.5 });
  cases.push({
    id: 'm16_midsegment',
    label: 'Đường trung bình (t=0.5): MN = 0.5·BC và S_AMN = 0.25·S_ABC',
    passed:
      thalesMid.valid &&
      thalesMid.isMidsegment &&
      near(thalesMid.ratioMN_BC, 0.5) &&
      near(thalesMid.areaRatio, 0.25),
    detail: `isMidsegment=${thalesMid.isMidsegment}, S_ratio=${thalesMid.areaRatio}`,
  });

  // 5. Đồng dạng tỉ số k = 2.5 (C.C.C, C.G.C, G.G, chu vi = 2.5, diện tích = 6.25)
  const scaled = buildScaledTriangle({ A: triA, B: triB, C: triC, scaleK: 2.5 });
  const simOk = analyzeTriangleSimilarity([triA, triB, triC], scaled.points);
  cases.push({
    id: 'm16_similarity_k',
    label: 'Tam giác đồng dạng k=2.5: khớp C.C.C, C.G.C, G.G và S′/S = 6.25',
    passed:
      scaled.valid &&
      simOk.valid &&
      simOk.isSimilar &&
      simOk.matchedByCCC &&
      simOk.matchedByCGC &&
      simOk.matchedByGG &&
      simOk.perimeterRatio !== null &&
      near(simOk.perimeterRatio, 2.5, 1e-4) &&
      simOk.areaRatio !== null &&
      near(simOk.areaRatio, 6.25, 1e-4),
    detail: `P'/P=${simOk.perimeterRatio?.toFixed(2)}, S'/S=${simOk.areaRatio?.toFixed(2)}`,
  });

  // 6. Hai tam giác không đồng dạng (dịch lệch C' làm méo góc & cạnh)
  const skewed = buildScaledTriangle({
    A: triA,
    B: triB,
    C: triC,
    scaleK: 1.5,
    distortC: { x: 2.5, y: 0 },
  });
  const simFail = analyzeTriangleSimilarity([triA, triB, triC], skewed.points);
  cases.push({
    id: 'm16_not_similar',
    label: 'Phát hiện chính xác hai tam giác KHÔNG đồng dạng khi bị biến dạng',
    passed: skewed.valid && simFail.valid && !simFail.isSimilar,
    detail: `isSimilar=${simFail.isSimilar}`,
  });

  // 7. Chặn tam giác suy biến & scaleK <= 0
  const degenThales = analyzeThalesTheorem({
    A: { x: 0, y: 0 },
    B: { x: 2, y: 2 },
    C: { x: 4, y: 4 },
    ratioT: 0.5,
  });
  const badScale = buildScaledTriangle({ A: triA, B: triB, C: triC, scaleK: 0 });
  cases.push({
    id: 'm16_degenerate_guard',
    label: 'Từ chối an toàn tam giác thẳng hàng suy biến và tỉ số k ≤ 0',
    passed: !degenThales.valid && !badScale.valid,
    detail: 'Cả 2 đầu vào suy biến đều bị chặn an toàn',
  });

  // 8. Tính chất đường phân giác AD: DB/DC = AB/AC và góc BAD = góc CAD
  const bis = analyzeAngleBisector({ x: 0, y: 4 }, { x: -3, y: 0 }, { x: 5, y: 0 });
  cases.push({
    id: 'm16_angle_bisector',
    label: 'Đường phân giác AD: ∠BAD = ∠CAD và DB/DC = AB/AC',
    passed:
      bis.valid &&
      near(bis.angleBAD, bis.angleCAD, 1e-5) &&
      near(bis.ratioDB_DC, bis.ratioAB_AC, 1e-6),
    detail: `∠BAD=${bis.angleBAD.toFixed(2)}°, DB/DC=${bis.ratioDB_DC.toFixed(3)}, AB/AC=${bis.ratioAB_AC.toFixed(3)}`,
  });

  // 9. Ứng dụng đo gián tiếp chiều cao bằng bóng nắng: cọc 1.5m bóng 2m, cây bóng 12m -> H = 9m
  const shadowOk = solveShadowHeight({ poleHeight: 1.5, poleShadow: 2, treeShadow: 12 });
  cases.push({
    id: 'm16_shadow_height',
    label: 'Đo gián tiếp bóng nắng: cọc 1.5m (bóng 2m), cây bóng 12m ⇒ cao 9m',
    passed: shadowOk.valid && near(shadowOk.estimatedHeight, 9),
    detail: `H = ${shadowOk.estimatedHeight}m`,
  });

  // 10. Chặn chia cho 0 khi bóng cọc = 0 hoặc âm
  const shadowBad = solveShadowHeight({ poleHeight: 1.5, poleShadow: 0, treeShadow: 12 });
  cases.push({
    id: 'm16_shadow_zero_guard',
    label: 'Chặn chia cho 0 khi độ dài bóng cọc bằng 0 hoặc âm',
    passed: !shadowBad.valid,
    detail: `valid=${shadowBad.valid}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
