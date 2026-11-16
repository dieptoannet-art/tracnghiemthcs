import { cryptoRandomInt } from '../../teacher/games/wheel3dMath';
import { runM13UnitTests } from './numberTheoryEngine';
import { runM14UnitTests } from './transformationEngine';
import { runM15UnitTests } from './pythagoreanEngine';
import { runM16UnitTests } from './similarityEngine';
import { runM17UnitTests } from './countingEngine';

export const EPSILON = 1e-9;

// ============================================================================
// 1. M05 – PHÂN SỐ, TỈ SỐ VÀ PHẦN TRĂM (EXACT RATIONAL ARITHMETIC)
// ============================================================================

export interface ExactFraction {
  num: number; // Tử số
  den: number; // Mẫu số (> 0)
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 ? 1 : x;
}

export function lcm(a: number, b: number): number {
  const x = Math.abs(Math.trunc(a));
  const y = Math.abs(Math.trunc(b));
  if (x === 0 || y === 0) return 0;
  return (x / gcd(x, y)) * y;
}

export function createExactFraction(num: number, den: number): ExactFraction {
  if (!Number.isFinite(num) || !Number.isFinite(den) || Math.trunc(den) === 0) {
    throw new Error('Mẫu số phải là số nguyên khác 0.');
  }
  const n = Math.trunc(num);
  const d = Math.trunc(den);
  const sign = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return {
    num: (sign * n) / g,
    den: Math.abs(d) / g,
  };
}

export function addFractions(a: ExactFraction, b: ExactFraction): ExactFraction {
  return createExactFraction(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subtractFractions(a: ExactFraction, b: ExactFraction): ExactFraction {
  return createExactFraction(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function multiplyFractions(a: ExactFraction, b: ExactFraction): ExactFraction {
  return createExactFraction(a.num * b.num, a.den * b.den);
}

export function divideFractions(a: ExactFraction, b: ExactFraction): ExactFraction {
  if (b.num === 0) {
    throw new Error('Không thể chia cho phân số có tử số bằng 0.');
  }
  return createExactFraction(a.num * b.den, a.den * b.num);
}

export function compareFractions(a: ExactFraction, b: ExactFraction): -1 | 0 | 1 {
  const diff = a.num * b.den - b.num * a.den;
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

export function toCommonDenominator(
  a: ExactFraction,
  b: ExactFraction
): { commonDen: number; aNum: number; bNum: number } {
  const commonDen = lcm(a.den, b.den);
  return {
    commonDen,
    aNum: a.num * (commonDen / a.den),
    bNum: b.num * (commonDen / b.den),
  };
}

export function formatFractionLatex(f: ExactFraction): string {
  if (f.den === 1) return `${f.num}`;
  if (f.num < 0) return `-\\frac{${Math.abs(f.num)}}{${f.den}}`;
  return `\\frac{${f.num}}{${f.den}}`;
}

// ============================================================================
// 2. M06 – CÂN PHƯƠNG TRÌNH BẬC NHẤT ax + b = cx + d
// ============================================================================

export type LinearEquationSolutionType =
  | 'UNIQUE'   // Nghiệm duy nhất
  | 'NONE'     // Vô nghiệm (0x = k, k != 0)
  | 'INFINITE'; // Vô số nghiệm (0x = 0)

export interface LinearEquationState {
  a: number; // Hệ số của x ở vế trái
  b: number; // Hằng số ở vế trái
  c: number; // Hệ số của x ở vế phải
  d: number; // Hằng số ở vế phải
}

export interface LinearEquationAnalysis {
  solutionType: LinearEquationSolutionType;
  exactFraction?: ExactFraction;
  decimalValue?: number;
  summaryVi: string;
  latexSolution: string;
}

export function solveLinearEquation(eq: LinearEquationState): LinearEquationAnalysis {
  const netA = eq.a - eq.c;
  const netB = eq.d - eq.b;

  if (Math.abs(netA) < EPSILON) {
    if (Math.abs(netB) < EPSILON) {
      return {
        solutionType: 'INFINITE',
        summaryVi: 'Phương trình có vô số nghiệm (nghiệm đúng với mọi x ∈ ℝ).',
        latexSolution: '0x = 0 \\Rightarrow S = \\mathbb{R}',
      };
    }
    return {
      solutionType: 'NONE',
      summaryVi: 'Phương trình vô nghiệm.',
      latexSolution: `0x = ${netB} \\text{ (vô lý)} \\Rightarrow S = \\varnothing`,
    };
  }

  // If coefficients are integers, return exact reduced fraction
  if (Number.isInteger(netA) && Number.isInteger(netB)) {
    const frac = createExactFraction(netB, netA);
    const dec = netB / netA;
    return {
      solutionType: 'UNIQUE',
      exactFraction: frac,
      decimalValue: dec,
      summaryVi: `Phương trình có nghiệm duy nhất x = ${
        frac.den === 1 ? frac.num : `${frac.num}/${frac.den}`
      }`,
      latexSolution: `x = ${formatFractionLatex(frac)}`,
    };
  }

  const dec = netB / netA;
  return {
    solutionType: 'UNIQUE',
    decimalValue: dec,
    summaryVi: `Phương trình có nghiệm duy nhất x ≈ ${Number(dec.toFixed(4))}`,
    latexSolution: `x = ${Number(dec.toFixed(4))}`,
  };
}

export function applyEquationBalanceOperation(
  eq: LinearEquationState,
  op: 'ADD_CONST' | 'SUB_CONST' | 'ADD_X' | 'SUB_X' | 'MUL_BOTH' | 'DIV_BOTH',
  val: number
): { next: LinearEquationState; isEquivalent: boolean; explanationVi: string } {
  if (!Number.isFinite(val)) {
    throw new Error('Giá trị biến đổi không hợp lệ.');
  }
  switch (op) {
    case 'ADD_CONST':
      return {
        next: { ...eq, b: eq.b + val, d: eq.d + val },
        isEquivalent: true,
        explanationVi: `Cộng ${val} vào cả hai vế của phương trình.`,
      };
    case 'SUB_CONST':
      return {
        next: { ...eq, b: eq.b - val, d: eq.d - val },
        isEquivalent: true,
        explanationVi: `Trừ ${val} ở cả hai vế của phương trình.`,
      };
    case 'ADD_X':
      return {
        next: { ...eq, a: eq.a + val, c: eq.c + val },
        isEquivalent: true,
        explanationVi: `Cộng ${val}x vào cả hai vế của phương trình.`,
      };
    case 'SUB_X':
      return {
        next: { ...eq, a: eq.a - val, c: eq.c - val },
        isEquivalent: true,
        explanationVi: `Bớt ${val}x ở cả hai vế của phương trình.`,
      };
    case 'MUL_BOTH':
      if (Math.abs(val) < EPSILON) {
        return {
          next: eq,
          isEquivalent: false,
          explanationVi:
            'Không được nhân hai vế với 0 vì phép biến đổi làm mất tính tương đương của phương trình!',
        };
      }
      return {
        next: { a: eq.a * val, b: eq.b * val, c: eq.c * val, d: eq.d * val },
        isEquivalent: true,
        explanationVi: `Nhân cả hai vế của phương trình với ${val} (khác 0).`,
      };
    case 'DIV_BOTH':
      if (Math.abs(val) < EPSILON) {
        return {
          next: eq,
          isEquivalent: false,
          explanationVi: 'Lỗi toán học: Không thể chia hai vế cho 0!',
        };
      }
      return {
        next: { a: eq.a / val, b: eq.b / val, c: eq.c / val, d: eq.d / val },
        isEquivalent: true,
        explanationVi: `Chia cả hai vế của phương trình cho ${val} (khác 0).`,
      };
  }
}

// ============================================================================
// 3. M02 – ĐỒ THỊ HÀM SỐ y = ax + b VÀ y = ax² (GIAO ĐIỂM & BẢNG GIÁ TRỊ)
// ============================================================================

export interface GraphIntersectionPoint {
  x: number;
  y: number;
  isExactRational: boolean;
  labelLatex: string;
}

/**
 * Solve intersection between Parabola y = pA * x^2 and Line y = lM * x + lN
 * Equation: pA * x^2 - lM * x - lN = 0
 * Handles pA = 0 safely (degenerates to two lines y = 0 and y = lM * x + lN).
 */
export function solveParabolaLineIntersection(
  pA: number,
  lM: number,
  lN: number
): {
  count: 0 | 1 | 2 | 'INFINITE';
  discriminant: number | null;
  points: GraphIntersectionPoint[];
  summaryVi: string;
} {
  // Case 1: pA == 0 -> horizontal line y = 0 vs line y = lM * x + lN
  if (Math.abs(pA) < EPSILON) {
    if (Math.abs(lM) < EPSILON) {
      if (Math.abs(lN) < EPSILON) {
        return {
          count: 'INFINITE',
          discriminant: null,
          points: [],
          summaryVi: 'Hai đường thẳng trùng nhau (y = 0), có vô số điểm chung.',
        };
      }
      return {
        count: 0,
        discriminant: null,
        points: [],
        summaryVi: 'Hai đường thẳng song song, không có giao điểm.',
      };
    }
    const x = -lN / lM;
    return {
      count: 1,
      discriminant: null,
      points: [
        {
          x,
          y: 0,
          isExactRational: Number.isInteger(lN) && Number.isInteger(lM),
          labelLatex: `(${Number(x.toFixed(3))}; 0)`,
        },
      ],
      summaryVi: `Khi a = 0, đồ thị suy biến thành đường thẳng y = 0 và cắt đường thẳng tại 1 điểm.`,
    };
  }

  // Case 2: True parabola pA != 0 -> pA*x^2 - lM*x - lN = 0
  const A = pA;
  const B = -lM;
  const C = -lN;
  const delta = B * B - 4 * A * C;

  if (delta < -EPSILON) {
    return {
      count: 0,
      discriminant: delta,
      points: [],
      summaryVi: `Δ = ${Number(delta.toFixed(3))} < 0: Đường thẳng và Parabol không giao nhau.`,
    };
  }

  if (Math.abs(delta) <= EPSILON) {
    const x = -B / (2 * A);
    const y = lM * x + lN;
    return {
      count: 1,
      discriminant: 0,
      points: [
        {
          x,
          y,
          isExactRational: true,
          labelLatex: `(${Number(x.toFixed(3))}; ${Number(y.toFixed(3))})`,
        },
      ],
      summaryVi: `Δ = 0: Đường thẳng tiếp xúc với Parabol tại 1 điểm duy nhất.`,
    };
  }

  const sqrtDelta = Math.sqrt(delta);
  const x1 = (-B - sqrtDelta) / (2 * A);
  const x2 = (-B + sqrtDelta) / (2 * A);
  const sortedX = [x1, x2].sort((u, v) => u - v);
  const isPerfectSquare = Math.abs(Math.round(sqrtDelta) - sqrtDelta) < EPSILON;

  const pts: GraphIntersectionPoint[] = sortedX.map((xVal) => {
    const yVal = lM * xVal + lN;
    return {
      x: xVal,
      y: yVal,
      isExactRational: isPerfectSquare,
      labelLatex: `(${Number(xVal.toFixed(3))}; ${Number(yVal.toFixed(3))})`,
    };
  });

  return {
    count: 2,
    discriminant: delta,
    points: pts,
    summaryVi: `Δ = ${Number(delta.toFixed(3))} > 0: Đường thẳng cắt Parabol tại 2 điểm phân biệt (${
      isPerfectSquare ? 'nghiệm hữu tỉ chính xác' : 'nghiệm vô tỉ / xấp xỉ thập phân'
    }).`,
  };
}

// ============================================================================
// 4. M03 – PHÒNG THÍ NGHIỆM XÁC SUẤT (6 MÔ HÌNH & MÔ PHỎNG TỚI 10.000 LẦN)
// ============================================================================

export type ProbabilityExperimentType =
  | 'COIN_TOSS'             // 1. Tung đồng xu
  | 'ONE_DIE'               // 2. Tung 1 xúc xắc
  | 'TWO_DICE_SUM'          // 3. Tung 2 xúc xắc (tổng số chấm 2..12)
  | 'SPINNER'               // 4. Vòng quay xác suất
  | 'CARD_DRAW'             // 5. Rút thẻ ngẫu nhiên
  | 'BALL_URN';             // 6. Rút bóng trong hộp (có / không hoàn lại)

export interface ProbabilityOutcomeStat {
  key: string;
  label: string;
  theoreticalProb: number; // Xác suất lý thuyết P(A) ∈ [0, 1]
  frequency: number;       // Tần số thực nghiệm n(A)
  relativeFreq: number;    // Tần suất thực nghiệm f = n(A)/N
}

export function getTheoreticalOutcomes(
  type: ProbabilityExperimentType,
  ballCounts = { red: 5, blue: 3, yellow: 2 }
): { key: string; label: string; theoreticalProb: number }[] {
  switch (type) {
    case 'COIN_TOSS':
      return [
        { key: 'S', label: 'Mặt Sấp (S)', theoreticalProb: 0.5 },
        { key: 'N', label: 'Mặt Ngửa (N)', theoreticalProb: 0.5 },
      ];
    case 'ONE_DIE':
      return [1, 2, 3, 4, 5, 6].map((n) => ({
        key: String(n),
        label: `Mặt ${n} chấm`,
        theoreticalProb: 1 / 6,
      }));
    case 'TWO_DICE_SUM': {
      // Sums 2..12 with weights 1,2,3,4,5,6,5,4,3,2,1 over 36
      const weights = [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
      return weights.map((w, idx) => {
        const sum = idx + 2;
        return {
          key: String(sum),
          label: `Tổng ${sum}`,
          theoreticalProb: w / 36,
        };
      });
    }
    case 'SPINNER':
      return [
        { key: 'RED', label: 'Ô Đỏ (1/4)', theoreticalProb: 0.25 },
        { key: 'BLUE', label: 'Ô Xanh dương (1/4)', theoreticalProb: 0.25 },
        { key: 'GREEN', label: 'Ô Xanh lá (1/4)', theoreticalProb: 0.25 },
        { key: 'GOLD', label: 'Ô Vàng (1/4)', theoreticalProb: 0.25 },
      ];
    case 'CARD_DRAW':
      return Array.from({ length: 10 }, (_, i) => ({
        key: String(i + 1),
        label: `Thẻ số ${i + 1}`,
        theoreticalProb: 0.1,
      }));
    case 'BALL_URN': {
      const total = Math.max(1, ballCounts.red + ballCounts.blue + ballCounts.yellow);
      return [
        { key: 'RED', label: `Bóng Đỏ (${ballCounts.red})`, theoreticalProb: ballCounts.red / total },
        { key: 'BLUE', label: `Bóng Xanh (${ballCounts.blue})`, theoreticalProb: ballCounts.blue / total },
        { key: 'YELLOW', label: `Bóng Vàng (${ballCounts.yellow})`, theoreticalProb: ballCounts.yellow / total },
      ].filter((item) => item.theoreticalProb > 0);
    }
  }
}

/**
 * Run `trialsCount` (1 to 10,000) probability trials in memory using `cryptoRandomInt`
 * without creating DOM nodes per trial.
 */
export function runProbabilityBatchSimulation(params: {
  type: ProbabilityExperimentType;
  trialsCount: number;
  ballCounts?: { red: number; blue: number; yellow: number };
}): {
  outcomes: ProbabilityOutcomeStat[];
  lastOutcomeKey: string;
  totalTrials: number;
} {
  const safeTrials = Math.min(Math.max(Math.trunc(params.trialsCount), 1), 10000);
  const balls = params.ballCounts || { red: 5, blue: 3, yellow: 2 };
  const baseOutcomes = getTheoreticalOutcomes(params.type, balls);
  const freqMap = new Map<string, number>();
  baseOutcomes.forEach((o) => freqMap.set(o.key, 0));

  let lastKey = baseOutcomes[0]?.key || '';

  for (let i = 0; i < safeTrials; i++) {
    let key = '';
    switch (params.type) {
      case 'COIN_TOSS':
        key = cryptoRandomInt(2) === 0 ? 'S' : 'N';
        break;
      case 'ONE_DIE':
        key = String(cryptoRandomInt(6) + 1);
        break;
      case 'TWO_DICE_SUM': {
        const d1 = cryptoRandomInt(6) + 1;
        const d2 = cryptoRandomInt(6) + 1;
        key = String(d1 + d2);
        break;
      }
      case 'SPINNER': {
        const keys = ['RED', 'BLUE', 'GREEN', 'GOLD'];
        key = keys[cryptoRandomInt(4)];
        break;
      }
      case 'CARD_DRAW':
        key = String(cryptoRandomInt(10) + 1);
        break;
      case 'BALL_URN': {
        const total = Math.max(1, balls.red + balls.blue + balls.yellow);
        const r = cryptoRandomInt(total);
        if (r < balls.red) key = 'RED';
        else if (r < balls.red + balls.blue) key = 'BLUE';
        else key = 'YELLOW';
        break;
      }
    }
    lastKey = key;
    freqMap.set(key, (freqMap.get(key) || 0) + 1);
  }

  const outcomes: ProbabilityOutcomeStat[] = baseOutcomes.map((o) => {
    const f = freqMap.get(o.key) || 0;
    return {
      ...o,
      frequency: f,
      relativeFreq: f / safeTrials,
    };
  });

  return {
    outcomes,
    lastOutcomeKey: lastKey,
    totalTrials: safeTrials,
  };
}

// ============================================================================
// 5. M04 – PHÒNG THỰC HÀNH THỐNG KÊ (PHÂN LOẠI DỮ LIỆU, TẦN SỐ, TRUNG BÌNH)
// ============================================================================

export interface StatisticsTableRow {
  label: string;
  numericValue?: number;
  frequency: number;
  relativePercent: number; // Làm tròn chuẩn tổng 100%
}

export interface StatisticsAnalysisResult {
  isEmpty: boolean;
  isNumericDataset: boolean;
  totalCount: number;
  rows: StatisticsTableRow[];
  mean: number | null;
  median: number | null;
  modes: string[];
  range: number | null;
  chartRecommendationVi: string;
  warningsVi: string[];
}

export function analyzeStatisticalDataset(
  items: { label: string; count: number }[]
): StatisticsAnalysisResult {
  const validItems = items
    .map((it) => ({
      label: it.label.trim(),
      count: Math.max(0, Math.trunc(Number(it.count) || 0)),
    }))
    .filter((it) => it.label.length > 0 && it.count > 0);

  const totalCount = validItems.reduce((acc, it) => acc + it.count, 0);

  if (validItems.length === 0 || totalCount === 0) {
    return {
      isEmpty: true,
      isNumericDataset: false,
      totalCount: 0,
      rows: [],
      mean: null,
      median: null,
      modes: [],
      range: null,
      chartRecommendationVi: 'Vui lòng nhập ít nhất 1 dòng dữ liệu có tần số lớn hơn 0.',
      warningsVi: ['Tập dữ liệu đang rỗng.'],
    };
  }

  // Check if all labels are valid numbers (Quantitative vs Qualitative data)
  const parsedNums = validItems.map((it) => Number(it.label.replace(',', '.')));
  const isNumericDataset = parsedNums.every((n) => Number.isFinite(n));

  // Largest remainder rounding so relativePercent sums to 100.0%
  const rawPercents = validItems.map((it) => (it.count * 100) / totalCount);
  const roundedTenths = rawPercents.map((p) => Math.floor(p * 10) / 10);
  let remainderTenths = Math.round(
    (100 - roundedTenths.reduce((a, b) => a + b, 0)) * 10
  );
  const remainders = rawPercents
    .map((p, idx) => ({ idx, rem: p * 10 - Math.floor(p * 10) }))
    .sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < remainderTenths && i < remainders.length; i++) {
    roundedTenths[remainders[i].idx] = Number(
      (roundedTenths[remainders[i].idx] + 0.1).toFixed(1)
    );
  }

  const rows: StatisticsTableRow[] = validItems.map((it, idx) => ({
    label: it.label,
    numericValue: isNumericDataset ? parsedNums[idx] : undefined,
    frequency: it.count,
    relativePercent: roundedTenths[idx],
  }));

  // Mode(s)
  const maxFreq = Math.max(...rows.map((r) => r.frequency));
  const modes = rows.filter((r) => r.frequency === maxFreq).map((r) => r.label);

  let mean: number | null = null;
  let median: number | null = null;
  let range: number | null = null;
  const warningsVi: string[] = [];

  if (isNumericDataset) {
    const weightedSum = rows.reduce(
      (acc, r) => acc + (r.numericValue ?? 0) * r.frequency,
      0
    );
    mean = weightedSum / totalCount;

    // Sort by numeric value for median & range
    const sortedRows = [...rows].sort(
      (a, b) => (a.numericValue ?? 0) - (b.numericValue ?? 0)
    );
    range =
      (sortedRows[sortedRows.length - 1].numericValue ?? 0) -
      (sortedRows[0].numericValue ?? 0);

    // Find median at positions floor((N-1)/2) and ceil((N-1)/2)
    const pos1 = Math.floor((totalCount - 1) / 2);
    const pos2 = Math.ceil((totalCount - 1) / 2);
    let cum = 0;
    let val1 = sortedRows[0].numericValue ?? 0;
    let val2 = sortedRows[0].numericValue ?? 0;
    for (const r of sortedRows) {
      const nextCum = cum + r.frequency;
      if (pos1 >= cum && pos1 < nextCum) val1 = r.numericValue ?? 0;
      if (pos2 >= cum && pos2 < nextCum) val2 = r.numericValue ?? 0;
      cum = nextCum;
    }
    median = (val1 + val2) / 2;
  } else {
    warningsVi.push(
      'Dữ liệu định tính (nhãn phân loại): Chỉ xác định Mốt (M₀), KHÔNG tính số trung bình cộng, trung vị hay khoảng biến thiên.'
    );
  }

  if (rows.length > 8) {
    warningsVi.push(
      'Số nhóm dữ liệu lớn (> 8 nhóm): Không nên dùng biểu đồ hình quạt tròn, ưu tiên biểu đồ cột hoặc đoạn thẳng.'
    );
  }

  const chartRecommendationVi = isNumericDataset
    ? 'Dữ liệu số (định lượng): Phù hợp biểu đồ cột (so sánh tần số) hoặc biểu đồ đoạn thẳng (xu hướng).'
    : rows.length <= 6
    ? 'Dữ liệu phân loại (định tính ≤ 6 nhóm): Phù hợp biểu đồ cột hoặc biểu đồ hình quạt tròn (cơ cấu %).'
    : 'Dữ liệu phân loại nhiều nhóm: Ưu tiên biểu đồ cột để dễ đọc nhãn.';

  return {
    isEmpty: false,
    isNumericDataset,
    totalCount,
    rows,
    mean,
    median,
    modes,
    range,
    chartRecommendationVi,
    warningsVi,
  };
}

// ============================================================================
// 6. M08 – HÌNH HỌC KHÔNG GIAN 3D (7 KHỐI CHUẨN GDPT 2018)
// ============================================================================

export type Solid3DType =
  | 'BOX'       // Hình hộp chữ nhật (Lớp 7)
  | 'CUBE'      // Hình lập phương (Lớp 7)
  | 'PRISM'     // Lăng trụ đứng tam giác đều (Lớp 7)
  | 'PYRAMID'   // Hình chóp tứ giác đều (Lớp 8)
  | 'CYLINDER'  // Hình trụ (Lớp 9)
  | 'CONE'      // Hình nón (Lớp 9)
  | 'SPHERE';   // Hình cầu (Lớp 9 - Không có hình khai triển phẳng thông thường)

export interface Solid3DMetrics {
  type: Solid3DType;
  nameVi: string;
  grade: '7' | '8' | '9';
  verticesCount: number;
  edgesCount: number;
  facesCount: number;
  lateralArea: number; // S_xq
  totalArea: number;   // S_tp
  volume: number;      // V
  hasFlatNet: boolean; // False đối với hình cầu (SPHERE)
  netLimitationNoteVi?: string;
  formulaLateralLatex: string;
  formulaTotalLatex: string;
  formulaVolumeLatex: string;
}

export function computeSolid3DMetrics(
  type: Solid3DType,
  dims: { a: number; b: number; h: number; r: number }
): Solid3DMetrics {
  const a = Math.max(0.5, dims.a);
  const b = Math.max(0.5, dims.b);
  const h = Math.max(0.5, dims.h);
  const r = Math.max(0.5, dims.r);

  switch (type) {
    case 'BOX': {
      const sXq = 2 * (a + b) * h;
      const sTp = sXq + 2 * a * b;
      const vol = a * b * h;
      return {
        type,
        nameVi: 'Hình hộp chữ nhật',
        grade: '7',
        verticesCount: 8,
        edgesCount: 12,
        facesCount: 6,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = 2(a + b)h',
        formulaTotalLatex: 'S_{tp} = 2(a + b)h + 2ab',
        formulaVolumeLatex: 'V = a \\cdot b \\cdot h',
      };
    }
    case 'CUBE': {
      const sXq = 4 * a * a;
      const sTp = 6 * a * a;
      const vol = a * a * a;
      return {
        type,
        nameVi: 'Hình lập phương',
        grade: '7',
        verticesCount: 8,
        edgesCount: 12,
        facesCount: 6,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = 4a^2',
        formulaTotalLatex: 'S_{tp} = 6a^2',
        formulaVolumeLatex: 'V = a^3',
      };
    }
    case 'PRISM': {
      // Equilateral triangular prism with side `a` and height `h`
      const baseArea = (Math.sqrt(3) / 4) * a * a;
      const sXq = 3 * a * h;
      const sTp = sXq + 2 * baseArea;
      const vol = baseArea * h;
      return {
        type,
        nameVi: 'Hình lăng trụ đứng tam giác đều',
        grade: '7',
        verticesCount: 6,
        edgesCount: 9,
        facesCount: 5,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = C_{\\text{đáy}} \\cdot h = 3ah',
        formulaTotalLatex: 'S_{tp} = S_{xq} + 2S_{\\text{đáy}}',
        formulaVolumeLatex: 'V = S_{\\text{đáy}} \\cdot h',
      };
    }
    case 'PYRAMID': {
      // Regular square pyramid with base edge `a` and height `h`
      const slantHeight = Math.hypot(a / 2, h); // Trung đoạn d
      const sXq = 2 * a * slantHeight;
      const sTp = sXq + a * a;
      const vol = (1 / 3) * a * a * h;
      return {
        type,
        nameVi: 'Hình chóp tứ giác đều',
        grade: '8',
        verticesCount: 5,
        edgesCount: 8,
        facesCount: 5,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = p \\cdot d = 2a\\sqrt{\\left(\\frac{a}{2}\\right)^2 + h^2}',
        formulaTotalLatex: 'S_{tp} = S_{xq} + a^2',
        formulaVolumeLatex: 'V = \\frac{1}{3} S_{\\text{đáy}} \\cdot h = \\frac{1}{3}a^2h',
      };
    }
    case 'CYLINDER': {
      const sXq = 2 * Math.PI * r * h;
      const sTp = sXq + 2 * Math.PI * r * r;
      const vol = Math.PI * r * r * h;
      return {
        type,
        nameVi: 'Hình trụ',
        grade: '9',
        verticesCount: 0,
        edgesCount: 2,
        facesCount: 3,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = 2\\pi r h',
        formulaTotalLatex: 'S_{tp} = 2\\pi r h + 2\\pi r^2',
        formulaVolumeLatex: 'V = \\pi r^2 h',
      };
    }
    case 'CONE': {
      const l = Math.hypot(r, h); // Đường sinh l
      const sXq = Math.PI * r * l;
      const sTp = sXq + Math.PI * r * r;
      const vol = (1 / 3) * Math.PI * r * r * h;
      return {
        type,
        nameVi: 'Hình nón',
        grade: '9',
        verticesCount: 1,
        edgesCount: 1,
        facesCount: 2,
        lateralArea: sXq,
        totalArea: sTp,
        volume: vol,
        hasFlatNet: true,
        formulaLateralLatex: 'S_{xq} = \\pi r l = \\pi r \\sqrt{r^2 + h^2}',
        formulaTotalLatex: 'S_{tp} = \\pi r l + \\pi r^2',
        formulaVolumeLatex: 'V = \\frac{1}{3}\\pi r^2 h',
      };
    }
    case 'SPHERE': {
      const area = 4 * Math.PI * r * r;
      const vol = (4 / 3) * Math.PI * r * r * r;
      return {
        type,
        nameVi: 'Hình cầu',
        grade: '9',
        verticesCount: 0,
        edgesCount: 0,
        facesCount: 1,
        lateralArea: area,
        totalArea: area,
        volume: vol,
        hasFlatNet: false,
        netLimitationNoteVi:
          'Theo định lý Gauss (Theorema Egregium), mặt cầu có độ cong Gauss dương nên KHÔNG THỂ khai triển phẳng thông thường mà không bị biến dạng độ dài/diện tích.',
        formulaLateralLatex: 'S = 4\\pi R^2',
        formulaTotalLatex: 'S = 4\\pi R^2',
        formulaVolumeLatex: 'V = \\frac{4}{3}\\pi R^3',
      };
    }
  }
}

// ============================================================================
// 7. M09 – XƯỞNG ĐẠI SỐ & KIỂM CHỨNG ĐA THỨC BẬC HAI (MULTI-POINT VERIFIER)
// ============================================================================

/**
 * Safely evaluate a simple polynomial expression in variable `x` at a given numeric `xVal`.
 * Supports expressions like `(x+3)^2`, `x^2 + 6*x + 9`, `(x-2)*(x+2)`, `2*x^2 - 5*x + 3`.
 * Used to verify algebraic equivalence across multiple sample points without naive string comparison!
 */
export function evaluateSingleVarPolynomial(expr: string, xVal: number): number | null {
  const cleaned = expr
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');

  if (!cleaned || /[^0-9x+\-*/^().]/.test(cleaned)) {
    return null;
  }

  // Insert explicit multiplication: `2x` -> `2*x`, `)x` -> `)*x`, `)(` -> `)*(` , `x(` -> `x*(`
  const normalized = cleaned
    .replace(/(\d)(x|\()/g, '$1*$2')
    .replace(/(\)|x)(\d|x|\()/g, '$1*$2')
    .replace(/\^/g, '**');

  try {
    const fn = new Function('x', `"use strict"; return (${normalized});`) as (
      x: number
    ) => number;
    const res = fn(xVal);
    return typeof res === 'number' && Number.isFinite(res) ? res : null;
  } catch {
    return null;
  }
}

export function verifyAlgebraicEquivalence(exprA: string, exprB: string): {
  isValidSyntax: boolean;
  isEquivalent: boolean;
  mismatchSampleX?: number;
} {
  const testPoints = [-3.5, -2, -1, 0, 1, 2.5, 4];
  for (const x of testPoints) {
    const valA = evaluateSingleVarPolynomial(exprA, x);
    const valB = evaluateSingleVarPolynomial(exprB, x);
    if (valA === null || valB === null) {
      return { isValidSyntax: false, isEquivalent: false };
    }
    if (Math.abs(valA - valB) > 1e-6) {
      return { isValidSyntax: true, isEquivalent: false, mismatchSampleX: x };
    }
  }
  return { isValidSyntax: true, isEquivalent: true };
}

// ============================================================================
// 8. M01 – HÌNH HỌC ĐỘNG 2D (KHOẢNG CÁCH, GÓC, DIỆN TÍCH, TRUNG ĐIỂM)
// ============================================================================

export interface Point2D {
  x: number;
  y: number;
}

export function distance2D(A: Point2D, B: Point2D): number {
  return Math.hypot(B.x - A.x, B.y - A.y);
}

export function midpoint2D(A: Point2D, B: Point2D): Point2D {
  return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
}

/**
 * Compute interior angle ABC (at vertex B) in degrees ∈ [0, 180].
 */
export function angleDegreesABC(A: Point2D, B: Point2D, C: Point2D): number {
  const ux = A.x - B.x;
  const uy = A.y - B.y;
  const vx = C.x - B.x;
  const vy = C.y - B.y;
  const lenU = Math.hypot(ux, uy);
  const lenV = Math.hypot(vx, vy);
  if (lenU < EPSILON || lenV < EPSILON) return 0;
  const cosTheta = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / (lenU * lenV)));
  return (Math.acos(cosTheta) * 180) / Math.PI;
}

export function polygonArea2D(pts: Point2D[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    sum += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(sum) / 2;
}

// ============================================================================
// 9. BỘ KIỂM THỬ TỰ ĐỘNG SMART MATH LAB (MỤC 12.1 UNIT TEST)
// ============================================================================

export interface SmartMathLabTestSuiteReport {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
}

export function runSmartMathLabUnitTests(): SmartMathLabTestSuiteReport {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  // 1. Fraction tests
  totalChecks++;
  const f1 = createExactFraction(6, 8);
  const f2 = createExactFraction(-2, 4);
  const fSum = addFractions(f1, f2);
  if (f1.num !== 3 || f1.den !== 4 || fSum.num !== 1 || fSum.den !== 4) {
    failedChecks.push('Fraction reduction or addition failed');
  }

  // 2. Linear equation tests (Unique, None, Infinite, Div-by-zero guard)
  totalChecks++;
  const eqUnique = solveLinearEquation({ a: 3, b: -5, c: 1, d: 7 });
  const eqNone = solveLinearEquation({ a: 2, b: 3, c: 2, d: -1 });
  const eqInf = solveLinearEquation({ a: 4, b: -2, c: 4, d: -2 });
  const divZeroCheck = applyEquationBalanceOperation({ a: 2, b: 4, c: 0, d: 8 }, 'DIV_BOTH', 0);
  if (
    eqUnique.solutionType !== 'UNIQUE' ||
    eqUnique.decimalValue !== 6 ||
    eqNone.solutionType !== 'NONE' ||
    eqInf.solutionType !== 'INFINITE' ||
    divZeroCheck.isEquivalent !== false
  ) {
    failedChecks.push('Linear equation solver or zero-division guard failed');
  }

  // 3. Function Graph intersection tests (Parabola y = x^2 vs Line y = x + 2 -> x = -1, 2)
  totalChecks++;
  const inter = solveParabolaLineIntersection(1, 1, 2);
  if (
    inter.count !== 2 ||
    Math.abs(inter.points[0].x - -1) > 1e-6 ||
    Math.abs(inter.points[1].x - 2) > 1e-6
  ) {
    failedChecks.push('Parabola-line intersection solver failed');
  }

  // 4. Probability batch simulation test (1,000 trials)
  totalChecks++;
  const probSim = runProbabilityBatchSimulation({ type: 'TWO_DICE_SUM', trialsCount: 1000 });
  const totalFreq = probSim.outcomes.reduce((acc, o) => acc + o.frequency, 0);
  if (totalFreq !== 1000 || probSim.outcomes.length !== 11) {
    failedChecks.push('Probability batch simulation failed');
  }

  // 5. Statistics qualitative vs quantitative guard
  totalChecks++;
  const catStats = analyzeStatisticalDataset([
    { label: 'Bóng đá', count: 12 },
    { label: 'Cầu lông', count: 8 },
  ]);
  const numStats = analyzeStatisticalDataset([
    { label: '7', count: 2 },
    { label: '8', count: 3 },
    { label: '10', count: 1 },
  ]);
  if (catStats.mean !== null || numStats.mean !== 8 || numStats.median !== 8) {
    failedChecks.push('Statistical analyzer qualitative/quantitative check failed');
  }

  // 6. 3D Solid Geometry & Sphere flat-net guard
  totalChecks++;
  const cube = computeSolid3DMetrics('CUBE', { a: 3, b: 3, h: 3, r: 3 });
  const sphere = computeSolid3DMetrics('SPHERE', { a: 3, b: 3, h: 3, r: 3 });
  if (cube.volume !== 27 || cube.totalArea !== 54 || sphere.hasFlatNet !== false) {
    failedChecks.push('3D solid metrics or Sphere flat-net restriction failed');
  }

  // 7. Algebraic equivalence multi-point check
  totalChecks++;
  const eqvTrue = verifyAlgebraicEquivalence('(x+3)^2', 'x^2 + 6x + 9');
  const eqvFalse = verifyAlgebraicEquivalence('(x+3)^2', 'x^2 + 9');
  if (!eqvTrue.isEquivalent || eqvFalse.isEquivalent) {
    failedChecks.push('Algebraic multi-point equivalence verifier failed');
  }

  // 8. 2D Dynamic Geometry angle & area check (3-4-5 right triangle)
  totalChecks++;
  const ang90 = angleDegreesABC({ x: 0, y: 3 }, { x: 0, y: 0 }, { x: 4, y: 0 });
  const area6 = polygonArea2D([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 0, y: 3 },
  ]);
  if (Math.abs(ang90 - 90) > 1e-6 || Math.abs(area6 - 6) > 1e-6) {
    failedChecks.push('2D geometry angle or area calculation failed');
  }

  // 9. M13 Number Theory Engine tests (13 test cases)
  const m13Report = runM13UnitTests();
  totalChecks += m13Report.totalChecks;
  if (!m13Report.passed) {
    failedChecks.push(...m13Report.failedChecks.map((label) => `M13: ${label}`));
  }

  // 10. M14 Transformation Engine tests (9 test cases)
  const m14Report = runM14UnitTests();
  totalChecks += m14Report.totalChecks;
  if (!m14Report.passed) {
    failedChecks.push(...m14Report.failedChecks.map((label) => `M14: ${label}`));
  }

  // 11. M15 Pythagorean Engine tests (9 test cases)
  const m15Report = runM15UnitTests();
  totalChecks += m15Report.totalChecks;
  if (!m15Report.passed) {
    failedChecks.push(...m15Report.failedChecks.map((label) => `M15: ${label}`));
  }

  // 12. M16 Similarity & Thales Engine tests (10 test cases)
  const m16Report = runM16UnitTests();
  totalChecks += m16Report.totalChecks;
  if (!m16Report.passed) {
    failedChecks.push(...m16Report.failedChecks.map((label) => `M16: ${label}`));
  }

  // 13. M17 Counting & Tree Diagram Engine tests (10 test cases)
  const m17Report = runM17UnitTests();
  totalChecks += m17Report.totalChecks;
  if (!m17Report.passed) {
    failedChecks.push(...m17Report.failedChecks.map((label) => `M17: ${label}`));
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
