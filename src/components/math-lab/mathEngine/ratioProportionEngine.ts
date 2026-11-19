// ============================================================================
// TÂY ĐÔ SMART EDU – SMART MATH LAB (TOÁN 6 & 7 GDPT 2018)
// M18: KHÁM PHÁ TỈ SỐ VÀ TỈ LỆ (RATIO & PROPORTION ENGINE)
// Pure Mathematical & Pedagogical Engine – Zero UI / DOM Dependencies
// ============================================================================

import {
  RawFraction,
  cleanInt,
  gcdInt,
  normalizeFractionSign,
  simplifyFraction,
} from './fractionDiscoveryEngine';

export type M18ActivityId =
  | 'CREATE_RATIO'
  | 'MIX_COLOR_RATIO'
  | 'EQUIVALENT_RATIOS'
  | 'DIVIDE_BY_RATIO'
  | 'PROPORTIONAL_QUANTITIES'
  | 'REAL_WORLD_CHALLENGE';

export type M18Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type RatioComparisonOrder =
  | 'BLUE_TO_YELLOW'
  | 'YELLOW_TO_BLUE'
  | 'BLUE_TO_TOTAL'
  | 'YELLOW_TO_TOTAL';

export interface RatioEvaluationResult {
  status: 'VALID' | 'UNDEFINED_ZERO_ZERO' | 'INVALID_ZERO_CONSEQUENT';
  antecedent: number; // a (số đứng trước)
  consequent: number; // b (số đứng sau)
  simplifiedAntecedent: number;
  simplifiedConsequent: number;
  gcdValue: number;
  colonNotation: string; // e.g. "2:3"
  simplifiedColonNotation: string;
  fractionNotation: string; // e.g. "2/3"
  isPartToPart: boolean;
  bundleCount: number; // gcd(a, b) for grouping into equal bundles
  bluePerBundle: number;
  yellowPerBundle: number;
  explanationVi: string;
}

export interface ColorMixEvaluation {
  baseBlue: number;
  baseYellow: number;
  mixBlue: number;
  mixYellow: number;
  baseTotalParts: number;
  mixTotalParts: number;
  mlPerPart: number;
  mixBlueMl: number;
  mixYellowMl: number;
  mixTotalMl: number;
  isValidRatio: boolean;
  isSameRatio: boolean;
  isAdditiveTrap: boolean; // True when mixBlue - baseBlue === mixYellow - baseYellow !== 0 but not proportional
  additiveDelta: number | null;
  scaleFactorText: string;
  conventionalColorHex: string;
  conventionalColorNameVi: string;
  explanationVi: string;
}

export interface ProportionalDivisionResult {
  status:
    | 'VALID'
    | 'INVALID_RATIO'
    | 'INVALID_TOTAL'
    | 'NON_INTEGER_DISCRETE_WARNING';
  totalAmount: number;
  parts: number[]; // [a, b] or [a, b, c]
  sumOfParts: number;
  isDiscreteObject: boolean;
  unitLabel: string;
  onePartExact: RawFraction;
  onePartDecimal: number;
  allocatedExact: RawFraction[];
  allocatedDecimals: number[];
  isExactIntegerAllocation: boolean;
  explanationVi: string;
}

export interface ProportionRelationAnalysis {
  mode: 'DIRECT' | 'INVERSE' | 'NON_PROPORTIONAL_LINEAR';
  kConstant: number;
  formulaText: string;
  invariantText: string;
  isProportional: boolean;
  points: { x: number; y: number; ratioYOverX: string; productXY: number }[];
  explanationVi: string;
}

export interface UnitRatioConversionResult {
  status: 'SAME_KIND_RATIO' | 'DIFFERENT_KIND_RATE' | 'INVALID';
  originalText: string;
  convertedText: string;
  simplifiedColon: string;
  rateValueText?: string;
  explanationVi: string;
}

export interface M18ActivityMeta {
  id: M18ActivityId;
  number: number;
  shortTitle: string;
  fullTitle: string;
  stageHeadline: string;
  thumbnailCaption: string;
}

export interface M18TaskSpec {
  id: string;
  activityId: M18ActivityId;
  difficulty: M18Difficulty;
  title: string;
  prompt: string;
  question: string;
  preset: {
    // Activity 1
    blueCount?: number;
    yellowCount?: number;
    compareOrder?: RatioComparisonOrder;
    // Activity 2
    baseBlue?: number;
    baseYellow?: number;
    mixBlue?: number;
    mixYellow?: number;
    scaleFactor?: number;
    mlPerPart?: number;
    // Activity 3
    eqA?: number;
    eqB?: number;
    eqC?: number;
    eqD?: number;
    missingSlot?: 'C' | 'D';
    // Activity 4
    totalS?: number;
    ratioParts?: number[];
    isDiscrete?: boolean;
    unitLabel?: string;
    // Activity 5
    propMode?: 'DIRECT' | 'INVERSE' | 'NON_PROPORTIONAL_LINEAR';
    kValue?: number;
    queryX?: number;
    // Activity 6
    scenarioCategory?: 'RECIPE' | 'DRINK' | 'SHOPPING' | 'SHARE' | 'UNIT_RATIO';
  };
  answerType: 'RATIO_PAIR' | 'SINGLE_NUMBER' | 'PAIR_NUMBERS' | 'CHOICE';
  expectedRatio?: { a: number; b: number };
  requireSimplifiedRatio?: boolean;
  expectedNumber?: number;
  expectedPair?: { first: number; second: number };
  expectedChoice?: string;
  choiceOptions?: string[];
  unitSuffix?: string;
  hints: [string, string, string];
  explanationVi: string;
}

export const M18_ACTIVITY_METADATA: M18ActivityMeta[] = [
  {
    id: 'CREATE_RATIO',
    number: 1,
    shortTitle: 'Tạo tỉ số',
    fullTitle: 'Tạo tỉ số giữa hai nhóm hạt và với tổng',
    stageHeadline: 'Phân biệt tỉ số hai phần và tỉ số với tổng',
    thumbnailCaption: 'Nhóm hạt theo tỉ số',
  },
  {
    id: 'MIX_COLOR_RATIO',
    number: 2,
    shortTitle: 'Pha màu theo tỉ lệ',
    fullTitle: 'Pha màu theo tỉ lệ chuẩn',
    stageHeadline: 'Giữ đúng công thức pha màu',
    thumbnailCaption: 'Pha màu theo tỉ lệ',
  },
  {
    id: 'EQUIVALENT_RATIOS',
    number: 3,
    shortTitle: 'Tỉ số bằng nhau',
    fullTitle: 'Tỉ số bằng nhau và trục số kép song song',
    stageHeadline: 'Nhân hoặc chia hai thành phần cùng hệ số dương',
    thumbnailCaption: 'So sánh tỉ số',
  },
  {
    id: 'DIVIDE_BY_RATIO',
    number: 4,
    shortTitle: 'Chia theo tỉ lệ',
    fullTitle: 'Chia một tổng cho trước theo tỉ lệ a : b (và a : b : c)',
    stageHeadline: 'Tìm giá trị một phần rồi phân phối theo tỉ lệ',
    thumbnailCaption: 'Chia phần theo tỉ lệ',
  },
  {
    id: 'PROPORTIONAL_QUANTITIES',
    number: 5,
    shortTitle: 'Đại lượng tỉ lệ',
    fullTitle: 'Đại lượng tỉ lệ thuận (y = kx) và tỉ lệ nghịch (y = k/x)',
    stageHeadline: 'Khám phá hằng số tỉ lệ, bảng giá trị và đồ thị',
    thumbnailCaption: 'Cân bằng đại lượng tỉ lệ',
  },
  {
    id: 'REAL_WORLD_CHALLENGE',
    number: 6,
    shortTitle: 'Thử thách thực tế',
    fullTitle: 'Vận dụng tỉ số và tỉ lệ vào bài toán thực tiễn',
    stageHeadline: 'Công thức nấu ăn, pha chế, mua sắm và đổi đơn vị',
    thumbnailCaption: 'Bài toán thực tế',
  },
];

// ============================================================================
// 1. RATIO EVALUATION & PART-TO-PART VS PART-TO-WHOLE (ACTIVITY 1)
// ============================================================================

export function evaluateRatioFromCounts(
  rawBlue: number,
  rawYellow: number,
  order: RatioComparisonOrder = 'BLUE_TO_YELLOW'
): RatioEvaluationResult {
  const blue = Math.max(0, cleanInt(rawBlue));
  const yellow = Math.max(0, cleanInt(rawYellow));
  const total = blue + yellow;

  let antecedent = blue;
  let consequent = yellow;
  let isPartToPart = true;
  let labelA = 'Xanh';
  let labelB = 'Vàng';

  if (order === 'YELLOW_TO_BLUE') {
    antecedent = yellow;
    consequent = blue;
    labelA = 'Vàng';
    labelB = 'Xanh';
  } else if (order === 'BLUE_TO_TOTAL') {
    antecedent = blue;
    consequent = total;
    isPartToPart = false;
    labelA = 'Xanh';
    labelB = 'Tổng (Xanh + Vàng)';
  } else if (order === 'YELLOW_TO_TOTAL') {
    antecedent = yellow;
    consequent = total;
    isPartToPart = false;
    labelA = 'Vàng';
    labelB = 'Tổng (Xanh + Vàng)';
  }

  const gBundles = blue > 0 && yellow > 0 ? gcdInt(blue, yellow) : 1;

  if (antecedent === 0 && consequent === 0) {
    return {
      status: 'UNDEFINED_ZERO_ZERO',
      antecedent: 0,
      consequent: 0,
      simplifiedAntecedent: 0,
      simplifiedConsequent: 0,
      gcdValue: 1,
      colonNotation: '0 : 0 (Không xác định)',
      simplifiedColonNotation: 'Không xác định',
      fractionNotation: 'Không xác định',
      isPartToPart,
      bundleCount: 0,
      bluePerBundle: 0,
      yellowPerBundle: 0,
      explanationVi:
        'Trường hợp 0 : 0 không xác định vì cả hai nhóm đều có 0 hạt (mẫu số bằng 0).',
    };
  }

  if (consequent === 0) {
    return {
      status: 'INVALID_ZERO_CONSEQUENT',
      antecedent,
      consequent: 0,
      simplifiedAntecedent: antecedent,
      simplifiedConsequent: 0,
      gcdValue: 1,
      colonNotation: `${antecedent} : 0 (Không hợp lệ)`,
      simplifiedColonNotation: 'Không hợp lệ',
      fractionNotation: 'Không xác định (mẫu = 0)',
      isPartToPart,
      bundleCount: 1,
      bluePerBundle: blue,
      yellowPerBundle: yellow,
      explanationVi: `Không thể lập tỉ số ${labelA} : ${labelB} khi lượng đứng sau (${labelB}) bằng 0!`,
    };
  }

  if (antecedent === 0) {
    return {
      status: 'VALID',
      antecedent: 0,
      consequent,
      simplifiedAntecedent: 0,
      simplifiedConsequent: 1,
      gcdValue: consequent,
      colonNotation: `0 : ${consequent}`,
      simplifiedColonNotation: '0 : 1',
      fractionNotation: `0/${consequent} = 0`,
      isPartToPart,
      bundleCount: 1,
      bluePerBundle: blue,
      yellowPerBundle: yellow,
      explanationVi: `Số hạt ${labelA} bằng 0 và ${labelB} bằng ${consequent} (> 0), nên tỉ số ${labelA} : ${labelB} là 0 : ${consequent} (giá trị bằng 0).`,
    };
  }

  const g = gcdInt(antecedent, consequent);
  const simpA = cleanInt(antecedent / g);
  const simpB = cleanInt(consequent / g);

  const partVsWholeNote = isPartToPart
    ? `Đây là tỉ số giữa hai bộ phận (${labelA} so với ${labelB}). Lưu ý phân biệt với tỉ số giữa một phần và tổng (${labelA} : Tổng = ${antecedent} : ${total}).`
    : `Đây là tỉ số của một bộ phận (${labelA}) so với toàn bộ tổng số hạt (${blue} + ${yellow} = ${total}).`;

  return {
    status: 'VALID',
    antecedent,
    consequent,
    simplifiedAntecedent: simpA,
    simplifiedConsequent: simpB,
    gcdValue: g,
    colonNotation: `${antecedent} : ${consequent}`,
    simplifiedColonNotation: `${simpA} : ${simpB}`,
    fractionNotation: `${antecedent}/${consequent}`,
    isPartToPart,
    bundleCount: gBundles,
    bluePerBundle: cleanInt(blue / gBundles),
    yellowPerBundle: cleanInt(yellow / gBundles),
    explanationVi: `Tỉ số ${labelA} : ${labelB} = ${antecedent} : ${consequent}${
      g > 1 ? ` = ${simpA} : ${simpB} (chia cả hai cho ƯCLN = ${g})` : ''
    }. ${partVsWholeNote}`,
  };
}

/**
 * Exact cross-multiplication equality check for two ratios a:b and c:d.
 * Rejects b = 0 or d = 0.
 */
export function areRatiosEqual(
  a: number,
  b: number,
  c: number,
  d: number
): boolean {
  const cleanB = cleanInt(b);
  const cleanD = cleanInt(d);
  if (cleanB === 0 || cleanD === 0) return false;
  const n1 = normalizeFractionSign({ num: cleanInt(a), den: cleanB }, true);
  const n2 = normalizeFractionSign({ num: cleanInt(c), den: cleanD }, true);
  return cleanInt(n1.num * n2.den) === cleanInt(n2.num * n1.den);
}

// ============================================================================
// 2. COLOR MIXING BY RATIO ENGINE (ACTIVITY 2 — FEATURED CENTERPIECE)
// ============================================================================

/**
 * Computes a conventional educational mixed color from Blue & Yellow parts.
 * Crucially: depends ONLY on the exact ratio blue / (blue + yellow) so
 * 2:3, 4:6, and 6:9 produce the EXACT same hex color regardless of total volume!
 */
export function computeConventionalMixColor(
  blueParts: number,
  yellowParts: number
): { hex: string; nameVi: string; blueFractionOfTotal: RawFraction } {
  const b = Math.max(0, cleanInt(blueParts));
  const y = Math.max(0, cleanInt(yellowParts));
  const total = b + y;
  if (total === 0) {
    return {
      hex: '#E2E8F0',
      nameVi: 'Chưa có màu (0 phần)',
      blueFractionOfTotal: { num: 0, den: 1 },
    };
  }
  if (b === 0) {
    return {
      hex: '#FACC15',
      nameVi: 'Vàng nguyên chất (0 phần Xanh)',
      blueFractionOfTotal: { num: 0, den: 1 },
    };
  }
  if (y === 0) {
    return {
      hex: '#2563EB',
      nameVi: 'Xanh dương nguyên chất (0 phần Vàng)',
      blueFractionOfTotal: { num: 1, den: 1 },
    };
  }

  // Canonical simplified fraction b / total so 2/5 and 4/10 yield identical RGB integers
  const simp = simplifyFraction({ num: b, den: total }).simplified;
  const ratioBlue = simp.num / simp.den; // [0..1]

  // Interpolate in perceptual green-teal-lime spectrum (conventional pigment mix)
  // Pure Yellow (ratioBlue=0): RGB(250, 204, 21)
  // Balanced Green 2:3 (ratioBlue=0.4): RGB(76, 175, 42) (#4CAF2A vibrant leaf green matching ref image)
  // Pure Blue (ratioBlue=1): RGB(37, 99, 235)
  const r = Math.round(230 * (1 - ratioBlue) * (1 - ratioBlue * 0.45));
  const g = Math.round(145 + 65 * Math.sin(ratioBlue * Math.PI));
  const bl = Math.round(25 + 200 * Math.pow(ratioBlue, 1.35));

  const toHex = (v: number) =>
    Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(bl)}`.toUpperCase();

  let nameVi = `Xanh lá chuẩn (tỉ lệ rút gọn ${simp.num}:${simp.den - simp.num})`;
  if (ratioBlue < 0.35) {
    nameVi = `Xanh lục ngả vàng (tỉ lệ rút gọn ${simp.num}:${simp.den - simp.num})`;
  } else if (ratioBlue > 0.45) {
    nameVi = `Xanh lục đậm ngả lam (tỉ lệ rút gọn ${simp.num}:${simp.den - simp.num})`;
  }

  return {
    hex,
    nameVi,
    blueFractionOfTotal: simp,
  };
}

export function evaluateColorMixFormula(
  baseBlue: number,
  baseYellow: number,
  mixBlue: number,
  mixYellow: number,
  mlPerPart: number = 50
): ColorMixEvaluation {
  const b0 = Math.max(1, cleanInt(baseBlue));
  const y0 = Math.max(1, cleanInt(baseYellow));
  const b1 = Math.max(0, cleanInt(mixBlue));
  const y1 = Math.max(0, cleanInt(mixYellow));
  const unitMl = Math.max(1, cleanInt(mlPerPart));

  const baseTotalParts = b0 + y0;
  const mixTotalParts = b1 + y1;
  const mixBlueMl = b1 * unitMl;
  const mixYellowMl = y1 * unitMl;
  const mixTotalMl = mixTotalParts * unitMl;

  const isValidRatio = b1 > 0 && y1 > 0;
  const isSameRatio = isValidRatio && areRatiosEqual(b0, y0, b1, y1);

  const diffB = b1 - b0;
  const diffY = y1 - y0;
  const isAdditiveTrap =
    !isSameRatio && diffB !== 0 && diffB === diffY && b1 > 0 && y1 > 0;

  const scaleFrac =
    b0 > 0 ? simplifyFraction({ num: b1, den: b0 }).simplified : { num: 0, den: 1 };
  const scaleFactorText =
    scaleFrac.den === 1
      ? `${scaleFrac.num}`
      : `${scaleFrac.num}/${scaleFrac.den}`;

  const colorInfo = computeConventionalMixColor(b1, y1);

  let explanationVi = '';
  if (!isValidRatio) {
    explanationVi =
      'Cần có cả phần màu Xanh (> 0) và phần màu Vàng (> 0) để pha theo công thức.';
  } else if (isSameRatio) {
    explanationVi = `Đúng công thức! ${b0} : ${y0} = ${b1} : ${y1} vì cả hai thành phần cùng nhân với hệ số k = ${scaleFactorText} (kiểm tra nhân chéo: ${b0} × ${y1} = ${y0} × ${b1} = ${
      b0 * y1
    }). Tổng lượng pha là ${mixTotalParts} phần (${mixTotalMl} mL).`;
  } else if (isAdditiveTrap) {
    explanationVi = `Chưa đúng tỉ lệ! Bạn đã cộng thêm cùng một số (${
      diffB > 0 ? `+${diffB}` : diffB
    }) vào cả Xanh và Vàng (${b0}${diffB >= 0 ? `+${diffB}` : diffB} : ${y0}${
      diffY >= 0 ? `+${diffY}` : diffY
    } = ${b1} : ${y1}). Cộng cùng một số KHÔNG giữ nguyên tỉ số vì ${b0} × ${y1} = ${
      b0 * y1
    } ≠ ${y0} × ${b1} = ${y0 * b1}!`;
  } else {
    explanationVi = `Tỉ số ${b1} : ${y1} khác công thức gốc ${b0} : ${y0} (vì ${b0} × ${y1} = ${
      b0 * y1
    } ≠ ${y0} × ${b1} = ${
      y0 * b1
    }). Để giữ tỉ lệ ${b0} : ${y0}, hãy nhân cả ${b0} và ${y0} với cùng một hệ số dương.`;
  }

  return {
    baseBlue: b0,
    baseYellow: y0,
    mixBlue: b1,
    mixYellow: y1,
    baseTotalParts,
    mixTotalParts,
    mlPerPart: unitMl,
    mixBlueMl,
    mixYellowMl,
    mixTotalMl,
    isValidRatio,
    isSameRatio,
    isAdditiveTrap,
    additiveDelta: isAdditiveTrap ? diffB : null,
    scaleFactorText,
    conventionalColorHex: colorInfo.hex,
    conventionalColorNameVi: colorInfo.nameVi,
    explanationVi,
  };
}

// ============================================================================
// 3. DIVIDING A TOTAL BY A RATIO a:b OR a:b:c (ACTIVITY 4)
// ============================================================================

export function divideTotalByRatio(
  totalAmount: number,
  rawParts: number[],
  isDiscreteObject: boolean = true,
  unitLabel: string = 'vật'
): ProportionalDivisionResult {
  const cleanTotal = cleanInt(totalAmount);
  const parts = rawParts.map((p) => Math.max(0, cleanInt(p)));
  const sumOfParts = parts.reduce((acc, v) => acc + v, 0);

  if (cleanTotal <= 0) {
    return {
      status: 'INVALID_TOTAL',
      totalAmount: cleanTotal,
      parts,
      sumOfParts,
      isDiscreteObject,
      unitLabel,
      onePartExact: { num: 0, den: 1 },
      onePartDecimal: 0,
      allocatedExact: parts.map(() => ({ num: 0, den: 1 })),
      allocatedDecimals: parts.map(() => 0),
      isExactIntegerAllocation: false,
      explanationVi: 'Tổng lượng cần chia S phải là số dương.',
    };
  }

  if (sumOfParts <= 0 || parts.some((p) => p <= 0)) {
    return {
      status: 'INVALID_RATIO',
      totalAmount: cleanTotal,
      parts,
      sumOfParts,
      isDiscreteObject,
      unitLabel,
      onePartExact: { num: 0, den: 1 },
      onePartDecimal: 0,
      allocatedExact: parts.map(() => ({ num: 0, den: 1 })),
      allocatedDecimals: parts.map(() => 0),
      isExactIntegerAllocation: false,
      explanationVi: 'Các thành phần của tỉ lệ phải là các số nguyên dương.',
    };
  }

  const onePartExact = simplifyFraction({
    num: cleanTotal,
    den: sumOfParts,
  }).simplified;
  const onePartDecimal = Math.round((cleanTotal / sumOfParts) * 1000) / 1000;

  const allocatedExact = parts.map(
    (p) => simplifyFraction({ num: cleanTotal * p, den: sumOfParts }).simplified
  );
  const allocatedDecimals = parts.map(
    (p) => Math.round(((cleanTotal * p) / sumOfParts) * 1000) / 1000
  );
  const isExactIntegerAllocation = allocatedExact.every((f) => f.den === 1);

  if (isDiscreteObject && !isExactIntegerAllocation) {
    return {
      status: 'NON_INTEGER_DISCRETE_WARNING',
      totalAmount: cleanTotal,
      parts,
      sumOfParts,
      isDiscreteObject,
      unitLabel,
      onePartExact,
      onePartDecimal,
      allocatedExact,
      allocatedDecimals,
      isExactIntegerAllocation: false,
      explanationVi: `Chú ý điều kiện chia nguyên đối với vật rời (${unitLabel}): Tổng số phần là ${parts.join(
        ' + '
      )} = ${sumOfParts} phần, nhưng ${cleanTotal} không chia hết cho ${sumOfParts} (mỗi phần = ${
        onePartExact.num
      }/${onePartExact.den} ${unitLabel}). Để chia nguyên ${unitLabel} mà không cắt nhỏ, tổng S phải là bội của ${sumOfParts}!`,
    };
  }

  const ratioStr = parts.join(' : ');
  const allocStr = allocatedExact
    .map((f) => (f.den === 1 ? `${f.num}` : `${f.num}/${f.den}`))
    .join('; ');

  return {
    status: 'VALID',
    totalAmount: cleanTotal,
    parts,
    sumOfParts,
    isDiscreteObject,
    unitLabel,
    onePartExact,
    onePartDecimal,
    allocatedExact,
    allocatedDecimals,
    isExactIntegerAllocation,
    explanationVi: `Chia ${cleanTotal} ${unitLabel} theo tỉ lệ ${ratioStr}: Tổng số phần bằng nhau là ${parts.join(
      ' + '
    )} = ${sumOfParts} (phần). Giá trị 1 phần là ${cleanTotal} : ${sumOfParts} = ${
      onePartExact.den === 1
        ? onePartExact.num
        : `${onePartExact.num}/${onePartExact.den}`
    } (${unitLabel}). Các nhóm nhận lần lượt là: ${allocStr} (${unitLabel}).`,
  };
}

// ============================================================================
// 4. DIRECT & INVERSE PROPORTIONALITY ENGINE (ACTIVITY 5)
// ============================================================================

export function analyzeProportionalRelation(
  mode: 'DIRECT' | 'INVERSE' | 'NON_PROPORTIONAL_LINEAR',
  kConstant: number,
  sampleXs: number[] = [1, 2, 3, 4, 6]
): ProportionRelationAnalysis {
  const cleanK = Math.max(1, cleanInt(kConstant));

  if (mode === 'DIRECT') {
    const pts = sampleXs
      .filter((x) => x > 0)
      .map((x) => {
        const y = cleanK * x;
        return {
          x,
          y,
          ratioYOverX: `${cleanK}`,
          productXY: x * y,
        };
      });
    return {
      mode: 'DIRECT',
      kConstant: cleanK,
      formulaText: `y = ${cleanK} · x`,
      invariantText: `Tỉ số y / x = ${cleanK} (không đổi với mọi x ≠ 0)`,
      isProportional: true,
      points: pts,
      explanationVi: `Đại lượng y tỉ lệ thuận với x theo hệ số tỉ lệ k = ${cleanK}: Khi x tăng gấp m lần thì y cũng tăng gấp m lần, tỉ số y/x luôn bằng ${cleanK} và đồ thị nằm trên đường thẳng đi qua gốc tọa độ O(0; 0).`,
    };
  }

  if (mode === 'INVERSE') {
    const validDivisors: number[] = [];
    for (let d = 1; d <= cleanK; d++) {
      if (cleanK % d === 0 && validDivisors.length < 6) {
        validDivisors.push(d);
      }
    }
    const xs = validDivisors.length >= 3 ? validDivisors : [1, 2, 3, 4, 6];
    const pts = xs.map((x) => {
      const y = Math.round((cleanK / x) * 100) / 100;
      return {
        x,
        y,
        ratioYOverX: `${Math.round((y / x) * 100) / 100}`,
        productXY: cleanK,
      };
    });
    return {
      mode: 'INVERSE',
      kConstant: cleanK,
      formulaText: `y = ${cleanK} / x (với x > 0)`,
      invariantText: `Tích x · y = ${cleanK} (không đổi)`,
      isProportional: true,
      points: pts,
      explanationVi: `Đại lượng y tỉ lệ nghịch với x theo hệ số k = ${cleanK}: Tích x · y luôn bằng ${cleanK} không đổi. Đồ thị là nhánh đường cong hypebol (không đi qua x = 0 vì không thể chia cho 0 bình).`,
    };
  }

  // Counterexample: y = 2x + 3 (increases with x, but y/x is NOT constant!)
  const pts = [1, 2, 3, 4, 5].map((x) => {
    const y = 2 * x + 3;
    const simp = simplifyFraction({ num: y, den: x }).simplified;
    return {
      x,
      y,
      ratioYOverX: simp.den === 1 ? `${simp.num}` : `${simp.num}/${simp.den}`,
      productXY: x * y,
    };
  });
  return {
    mode: 'NON_PROPORTIONAL_LINEAR',
    kConstant: 2,
    formulaText: 'y = 2x + 3 (Phản ví dụ)',
    invariantText: 'Tỉ số y / x thay đổi (5/1 ≠ 7/2 ≠ 9/3)',
    isProportional: false,
    points: pts,
    explanationVi:
      'Phản ví dụ quan trọng: Trong hàm số y = 2x + 3, dù x tăng thì y cũng tăng, nhưng tỉ số y/x KHÔNG không đổi (5/1 = 5 ≠ 7/2 = 3,5) và đồ thị không đi qua gốc (0; 0). Vậy y KHÔNG tỉ lệ thuận với x!',
  };
}

// ============================================================================
// 5. UNIT CONVERSION BEFORE FORMING RATIOS (SECTION 10)
// ============================================================================

const UNIT_TO_BASE_FACTOR: Record<
  string,
  { category: 'LENGTH' | 'VOLUME' | 'MASS' | 'TIME'; baseUnit: string; factor: number }
> = {
  mm: { category: 'LENGTH', baseUnit: 'mm', factor: 1 },
  cm: { category: 'LENGTH', baseUnit: 'mm', factor: 10 },
  dm: { category: 'LENGTH', baseUnit: 'mm', factor: 100 },
  m: { category: 'LENGTH', baseUnit: 'mm', factor: 1000 },
  mL: { category: 'VOLUME', baseUnit: 'mL', factor: 1 },
  L: { category: 'VOLUME', baseUnit: 'mL', factor: 1000 },
  g: { category: 'MASS', baseUnit: 'g', factor: 1 },
  kg: { category: 'MASS', baseUnit: 'g', factor: 1000 },
  phút: { category: 'TIME', baseUnit: 'phút', factor: 1 },
  giờ: { category: 'TIME', baseUnit: 'phút', factor: 60 },
};

/**
 * Converts two quantities with units into an exact ratio if they share the same physical dimension
 * (e.g. 50 cm : 1 m -> 50 cm : 100 cm -> 1:2), or into a rate with composite unit if different kinds.
 */
export function computeUnitAwareRatio(
  valA: number,
  unitA: string,
  valB: number,
  unitB: string
): UnitRatioConversionResult {
  const cleanA = cleanInt(valA);
  const cleanB = cleanInt(valB);
  if (cleanA <= 0 || cleanB <= 0) {
    return {
      status: 'INVALID',
      originalText: `${cleanA} ${unitA} : ${cleanB} ${unitB}`,
      convertedText: 'Không hợp lệ',
      simplifiedColon: 'Không hợp lệ',
      explanationVi: 'Các đại lượng đo lường phải lớn hơn 0.',
    };
  }

  const infoA = UNIT_TO_BASE_FACTOR[unitA];
  const infoB = UNIT_TO_BASE_FACTOR[unitB];

  if (infoA && infoB && infoA.category === infoB.category) {
    // Convert both to the smaller of the two units for clean pedagogical display
    const commonUnit = infoA.factor <= infoB.factor ? unitA : unitB;
    const minFactor = Math.min(infoA.factor, infoB.factor);
    const scaledA = cleanInt((cleanA * infoA.factor) / minFactor);
    const scaledB = cleanInt((cleanB * infoB.factor) / minFactor);
    const g = gcdInt(scaledA, scaledB);
    const simpA = cleanInt(scaledA / g);
    const simpB = cleanInt(scaledB / g);

    return {
      status: 'SAME_KIND_RATIO',
      originalText: `${cleanA} ${unitA} : ${cleanB} ${unitB}`,
      convertedText: `${scaledA} ${commonUnit} : ${scaledB} ${commonUnit}`,
      simplifiedColon: `${simpA} : ${simpB}`,
      explanationVi: `Vì ${unitA} và ${unitB} là hai đại lượng cùng loại, ta phải đổi về cùng đơn vị (${commonUnit}) trước khi lập tỉ số: ${cleanA} ${unitA} : ${cleanB} ${unitB} = ${scaledA} ${commonUnit} : ${scaledB} ${commonUnit} = ${simpA} : ${simpB} (tỉ số rút gọn không còn đơn vị).`,
    };
  }

  // Different kinds -> Rate / Unit price (keeps composite unit!)
  const g = gcdInt(cleanA, cleanB);
  const rateA = cleanInt(cleanA / g);
  const rateB = cleanInt(cleanB / g);
  const unitRateText =
    rateB === 1
      ? `${rateA} ${unitA}/${unitB}`
      : `${rateA}/${rateB} ${unitA}/${unitB}`;

  return {
    status: 'DIFFERENT_KIND_RATE',
    originalText: `${cleanA} ${unitA} cho ${cleanB} ${unitB}`,
    convertedText: `${rateA} ${unitA} / ${rateB} ${unitB}`,
    simplifiedColon: `${rateA} : ${rateB}`,
    rateValueText: unitRateText,
    explanationVi: `Đây là đại lượng suất/đơn giá giữa hai đại lượng khác loại (${unitA} và ${unitB}), nên phải giữ nguyên đơn vị kép: ${unitRateText}.`,
  };
}

// ============================================================================
// 6. STRUCTURED 48-TASK BANK (8 TASKS PER ACTIVITY × 6 ACTIVITIES)
// ============================================================================

export const M18_TASK_BANK: M18TaskSpec[] = [
  // --------------------------------------------------------------------------
  // ACTIVITY 1: TẠO TỈ SỐ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act1_t1',
    activityId: 'CREATE_RATIO',
    difficulty: 'EASY',
    title: 'Tỉ số giữa hạt Xanh và hạt Vàng (2 : 3)',
    prompt: 'Đặt trên khay 2 hạt Xanh và 3 hạt Vàng, chọn chiều so sánh "Xanh : Vàng".',
    question: 'Tỉ số giữa số hạt Xanh và số hạt Vàng là bao nhiêu?',
    preset: { blueCount: 2, yellowCount: 3, compareOrder: 'BLUE_TO_YELLOW' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 2, b: 3 },
    hints: [
      'Đếm số hạt màu xanh dương (đứng trước) và số hạt màu vàng (đứng sau).',
      'Có 2 hạt Xanh và 3 hạt Vàng.',
      'Tỉ số Xanh : Vàng = 2 : 3 (hoặc viết dưới dạng phân số là 2/3).',
    ],
    explanationVi: 'Với 2 hạt Xanh và 3 hạt Vàng, tỉ số Xanh : Vàng là 2 : 3.',
  },
  {
    id: 'm18_act1_t2',
    activityId: 'CREATE_RATIO',
    difficulty: 'EASY',
    title: 'Đảo thứ tự so sánh: Vàng : Xanh (3 : 2)',
    prompt: 'Giữ nguyên 2 hạt Xanh và 3 hạt Vàng, đổi chiều so sánh sang "Vàng : Xanh".',
    question: 'Tỉ số giữa số hạt Vàng và số hạt Xanh là bao nhiêu?',
    preset: { blueCount: 2, yellowCount: 3, compareOrder: 'YELLOW_TO_BLUE' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 3, b: 2 },
    hints: [
      'Chú ý thứ tự tên gọi: "Vàng" được nêu trước, "Xanh" nêu sau.',
      'Số hạt Vàng là 3, số hạt Xanh là 2.',
      'Tỉ số Vàng : Xanh là 3 : 2 (khác với 2 : 3).',
    ],
    explanationVi: 'Khi đổi thứ tự so sánh sang Vàng : Xanh, ta được tỉ số 3 : 2.',
  },
  {
    id: 'm18_act1_t3',
    activityId: 'CREATE_RATIO',
    difficulty: 'EASY',
    title: 'Phân biệt tỉ số hai phần và tỉ số với Tổng (Xanh : Tổng = 2 : 5)',
    prompt: 'Với 2 hạt Xanh và 3 hạt Vàng, chọn chế độ "Xanh : Tổng".',
    question: 'Tỉ số của số hạt Xanh so với TỔNG số hạt trên khay là bao nhiêu?',
    preset: { blueCount: 2, yellowCount: 3, compareOrder: 'BLUE_TO_TOTAL' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 2, b: 5 },
    hints: [
      'Tính tổng số hạt trên khay: 2 hạt Xanh + 3 hạt Vàng = 5 hạt.',
      'Số hạt Xanh là 2, tổng số hạt là 5.',
      'Tỉ số Xanh : Tổng = 2 : 5 (trong khi Xanh : Vàng = 2 : 3).',
    ],
    explanationVi:
      'Tổng số hạt là 2 + 3 = 5. Do đó tỉ số Xanh : Tổng là 2 : 5, còn 2 : 3 là tỉ số giữa riêng phần Xanh và phần Vàng.',
  },
  {
    id: 'm18_act1_t4',
    activityId: 'CREATE_RATIO',
    difficulty: 'EASY',
    title: 'Tạo tỉ số Xanh : Vàng = 3 : 4',
    prompt: 'Điều chỉnh số hạt trên khay để có tỉ số Xanh : Vàng bằng 3 : 4.',
    question: 'Nhập tỉ số Xanh : Vàng khi có 3 hạt Xanh và 4 hạt Vàng.',
    preset: { blueCount: 3, yellowCount: 4, compareOrder: 'BLUE_TO_YELLOW' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 3, b: 4 },
    hints: [
      'Đặt số hạt Xanh = 3 và số hạt Vàng = 4.',
      'Quan sát tỉ số hiển thị trên khay hạt.',
      'Tỉ số là 3 : 4.',
    ],
    explanationVi: '3 hạt Xanh và 4 hạt Vàng biểu diễn tỉ số 3 : 4.',
  },
  {
    id: 'm18_act1_t5',
    activityId: 'CREATE_RATIO',
    difficulty: 'MEDIUM',
    title: 'Số hạt Xanh bằng một nửa số hạt Vàng (4 và 8)',
    prompt: 'Đặt 4 hạt Xanh và 8 hạt Vàng rồi bật "Nhóm thành các bó bằng nhau".',
    question: 'Tỉ số rút gọn tối giản của 4 hạt Xanh và 8 hạt Vàng là bao nhiêu?',
    preset: { blueCount: 4, yellowCount: 8, compareOrder: 'BLUE_TO_YELLOW' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 1, b: 2 },
    requireSimplifiedRatio: true,
    hints: [
      'Có thể chia 4 hạt Xanh và 8 hạt Vàng thành 4 bó bằng nhau.',
      'Mỗi bó có 1 hạt Xanh và 2 hạt Vàng.',
      'Tỉ số tối giản là 1 : 2 (số hạt Xanh bằng một nửa số hạt Vàng).',
    ],
    explanationVi: 'Chia cả 4 và 8 cho ƯCLN(4, 8) = 4 ta được tỉ số tối giản 1 : 2.',
  },
  {
    id: 'm18_act1_t6',
    activityId: 'CREATE_RATIO',
    difficulty: 'MEDIUM',
    title: 'Giải thích vì sao 2 : 3 không phải là 2 : 5',
    prompt: 'Quan sát khay có 2 hạt Xanh và 3 hạt Vàng.',
    question: 'Trong bối cảnh 2 hạt Xanh và 3 hạt Vàng, nhận định nào sau đây là ĐÚNG?',
    preset: { blueCount: 2, yellowCount: 3, compareOrder: 'BLUE_TO_YELLOW' },
    answerType: 'CHOICE',
    expectedChoice: '2 : 3 là tỉ số Xanh : Vàng, còn 2 : 5 là tỉ số Xanh : Tổng',
    choiceOptions: [
      '2 : 3 là tỉ số Xanh : Vàng, còn 2 : 5 là tỉ số Xanh : Tổng',
      '2 : 3 và 2 : 5 là hai tỉ số bằng nhau',
      '2 : 5 là tỉ số Vàng : Xanh',
    ],
    hints: [
      'Kiểm tra xem số 3 và số 5 đại diện cho đại lượng nào.',
      'Số 3 là số hạt Vàng; số 5 = 2 + 3 là tổng số hạt.',
      'Vì 3 ≠ 5 nên 2 : 3 (Xanh : Vàng) khác 2 : 5 (Xanh : Tổng).',
    ],
    explanationVi: '2 : 3 so sánh phần Xanh với phần Vàng; còn 2 : 5 so sánh phần Xanh với toàn bộ tổng số hạt (2 + 3 = 5).',
  },
  {
    id: 'm18_act1_t7',
    activityId: 'CREATE_RATIO',
    difficulty: 'HARD',
    title: 'Tỉ số Vàng : Tổng khi biết Xanh : Vàng = 3 : 5',
    prompt: 'Đặt 3 hạt Xanh và 5 hạt Vàng, chuyển sang chế độ "Vàng : Tổng".',
    question: 'Khi Xanh : Vàng = 3 : 5 thì tỉ số Vàng : Tổng bằng bao nhiêu?',
    preset: { blueCount: 3, yellowCount: 5, compareOrder: 'YELLOW_TO_TOTAL' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 5, b: 8 },
    hints: [
      'Số phần Vàng là 5.',
      'Tổng số phần (Xanh + Vàng) là 3 + 5 = 8.',
      'Vậy tỉ số Vàng : Tổng = 5 : 8.',
    ],
    explanationVi: 'Tổng số phần là 3 + 5 = 8, nên tỉ số Vàng : Tổng là 5 : 8.',
  },
  {
    id: 'm18_act1_t8',
    activityId: 'CREATE_RATIO',
    difficulty: 'HARD',
    title: 'Điều kiện tồn tại của tỉ số a : b',
    prompt: 'Thử đưa số hạt của nhóm đứng sau dấu tỉ số về 0.',
    question: 'Điều kiện bắt buộc đối với số đứng sau b trong tỉ số a : b (hay phân số a/b) là gì?',
    preset: { blueCount: 3, yellowCount: 1, compareOrder: 'BLUE_TO_YELLOW' },
    answerType: 'CHOICE',
    expectedChoice: 'b phải khác 0 (không tồn tại tỉ số a : 0 hay 0 : 0)',
    choiceOptions: [
      'b phải khác 0 (không tồn tại tỉ số a : 0 hay 0 : 0)',
      'Cả a và b đều có thể bằng 0',
      'a bắt buộc phải lớn hơn b',
    ],
    hints: [
      'Tỉ số a : b tương ứng với phép chia a : b hay phân số a/b.',
      'Trong toán học, phép chia cho 0 không xác định.',
      'Do đó lượng đứng sau b bắt buộc phải khác 0 (nếu a = 0 và b > 0 thì tỉ số bằng 0).',
    ],
    explanationVi: 'Tỉ số a : b chỉ xác định khi b ≠ 0. Trường hợp a : 0 và 0 : 0 đều không xác định.',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 2: PHA MÀU THEO TỈ LỆ (8 TASKS — FEATURED DEFAULT ACTIVITY)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act2_t1',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'EASY',
    title: 'Kịch bản tâm điểm: Gấp đôi lượng pha 2 : 3 = 4 : 6',
    prompt: 'Công thức gốc có 2 phần Xanh và 3 phần Vàng (2 : 3). Hãy chọn Hệ số = 2 để gấp đôi lượng pha.',
    question: 'Khi gấp đôi công thức 2 : 3 (Hệ số = 2), ta cần mấy phần Xanh và mấy phần Vàng?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 4, mixYellow: 6, scaleFactor: 2, mlPerPart: 50 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 4, b: 6 },
    hints: [
      'Nhân số phần Xanh (2) với hệ số 2.',
      'Nhân số phần Vàng (3) với hệ số 2.',
      'Ta được 4 phần Xanh và 6 phần Vàng (2 : 3 = 4 : 6, tổng 10 phần).',
    ],
    explanationVi: 'Nhân cả hai thành phần của 2 : 3 với 2 ta được 4 : 6 (4 phần Xanh và 6 phần Vàng), giữ nguyên màu pha chuẩn!',
  },
  {
    id: 'm18_act2_t2',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'EASY',
    title: 'Giữ tỉ số 2 : 3 khi có 6 phần Xanh',
    prompt: 'Giữ công thức Xanh : Vàng = 2 : 3. Điều chỉnh lượng Xanh lên 6 phần.',
    question: 'Nếu dùng 6 phần Xanh thì cần bao nhiêu phần Vàng để giữ đúng tỉ lệ 2 : 3?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 6, mixYellow: 9, scaleFactor: 3, mlPerPart: 50 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 9,
    unitSuffix: 'phần Vàng',
    hints: [
      'Từ 2 phần Xanh lên 6 phần Xanh, ta đã nhân với hệ số k = 6 : 2 = 3.',
      'Lượng Vàng cũng phải nhân với hệ số k = 3.',
      '3 × 3 = 9 (phần Vàng). Vậy 2 : 3 = 6 : 9.',
    ],
    explanationVi: 'Vì 6 : 2 = 3 (gấp 3 lần công thức gốc) nên số phần Vàng cần dùng là 3 × 3 = 9 phần.',
  },
  {
    id: 'm18_act2_t3',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'MEDIUM',
    title: 'Pha tổng cộng 20 phần theo tỉ lệ 2 : 3',
    prompt: 'Cần pha tổng cộng 20 phần màu (Xanh + Vàng = 20) theo đúng công thức Xanh : Vàng = 2 : 3.',
    question: 'Với tổng 20 phần theo tỉ lệ 2 : 3, cần bao nhiêu phần Xanh và bao nhiêu phần Vàng?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 8, mixYellow: 12, scaleFactor: 4, mlPerPart: 50 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 8, b: 12 },
    hints: [
      'Công thức gốc 2 : 3 có tổng số phần là 2 + 3 = 5 phần.',
      'Để tổng đạt 20 phần, hệ số nhân chung là k = 20 : 5 = 4.',
      'Xanh = 2 × 4 = 8 phần; Vàng = 3 × 4 = 12 phần (8 + 12 = 20).',
    ],
    explanationVi: 'Mỗi mẻ gốc có 2 + 3 = 5 phần. Tổng 20 phần gấp 20 : 5 = 4 lần, nên cần 8 phần Xanh và 12 phần Vàng.',
  },
  {
    id: 'm18_act2_t4',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'MEDIUM',
    title: 'Kiểm tra sai lầm cộng thêm cùng một số: 2 : 3 và 4 : 5',
    prompt: 'Thử đặt 4 phần Xanh và 5 phần Vàng (tức là cộng thêm 2 phần vào mỗi màu của 2 : 3) rồi bấm Pha thử.',
    question: 'Công thức 4 : 5 có giữ đúng tỉ lệ pha màu 2 : 3 không?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 4, mixYellow: 5, scaleFactor: 1, mlPerPart: 50 },
    answerType: 'CHOICE',
    expectedChoice: 'Không, vì 2 × 5 ≠ 3 × 4 (cộng cùng một số không giữ nguyên tỉ lệ)',
    choiceOptions: [
      'Không, vì 2 × 5 ≠ 3 × 4 (cộng cùng một số không giữ nguyên tỉ lệ)',
      'Có, vì cả Xanh và Vàng đều tăng thêm 2 phần',
      'Có, vì 4 và 5 cũng hơn kém nhau 1 phần',
    ],
    hints: [
      'Kiểm tra tích chéo giữa 2 : 3 và 4 : 5.',
      '2 × 5 = 10, trong khi 3 × 4 = 12 (10 ≠ 12).',
      'Chỉ khi NHÂN hai thành phần với cùng một hệ số dương mới giữ nguyên tỉ lệ!',
    ],
    explanationVi: '2 : 3 ≠ 4 : 5 vì 2 × 5 = 10 ≠ 3 × 4 = 12. Cộng thêm cùng một số vào hai thành phần làm lệch tỉ lệ pha màu.',
  },
  {
    id: 'm18_act2_t5',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'MEDIUM',
    title: 'Tính tổng thể tích (mL) khi mỗi phần bằng 50 mL',
    prompt: 'Bật nhãn đơn vị 50 mL/phần với mẻ pha gấp đôi (4 phần Xanh và 6 phần Vàng).',
    question: 'Khi mỗi phần ứng với 50 mL, mẻ pha 4 phần Xanh và 6 phần Vàng có tổng thể tích bao nhiêu mL?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 4, mixYellow: 6, scaleFactor: 2, mlPerPart: 50 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 500,
    unitSuffix: 'mL',
    hints: [
      'Tính tổng số phần của mẻ pha: 4 phần Xanh + 6 phần Vàng = 10 phần.',
      'Mỗi phần có thể tích 50 mL.',
      'Tổng thể tích = 10 × 50 = 500 mL (gồm 200 mL Xanh và 300 mL Vàng).',
    ],
    explanationVi: '4 phần Xanh = 200 mL, 6 phần Vàng = 300 mL. Tổng thể tích trong bình pha là 200 + 300 = 500 mL.',
  },
  {
    id: 'm18_act2_t6',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'MEDIUM',
    title: 'Tìm số phần Xanh khi biết 15 phần Vàng (tỉ lệ 2 : 3)',
    prompt: 'Giữ tỉ lệ Xanh : Vàng = 2 : 3 khi lượng Vàng là 15 phần.',
    question: 'Cần bao nhiêu phần Xanh để pha với 15 phần Vàng theo đúng tỉ lệ 2 : 3?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 10, mixYellow: 15, scaleFactor: 5, mlPerPart: 50 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 10,
    unitSuffix: 'phần Xanh',
    hints: [
      'Lượng Vàng tăng từ 3 phần lên 15 phần, tức là gấp k = 15 : 3 = 5 lần.',
      'Nhân lượng Xanh ban đầu (2 phần) với 5.',
      '2 × 5 = 10 phần Xanh.',
    ],
    explanationVi: 'Hệ số nhân là 15 : 3 = 5, nên số phần Xanh cần dùng là 2 × 5 = 10 phần.',
  },
  {
    id: 'm18_act2_t7',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'HARD',
    title: 'So sánh màu minh họa của hai mẻ cùng tỉ lệ khác tổng lượng',
    prompt: 'So sánh mẻ 1 (2 Xanh : 3 Vàng = 5 phần) và mẻ 2 (4 Xanh : 6 Vàng = 10 phần).',
    question: 'Khi hai mẻ có cùng tỉ lệ 2 : 3 nhưng tổng lượng khác nhau (250 mL và 500 mL), màu minh họa thu được như thế nào?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 4, mixYellow: 6, scaleFactor: 2, mlPerPart: 50 },
    answerType: 'CHOICE',
    expectedChoice: 'Cùng một màu minh họa vì tỉ lệ Xanh : Vàng không đổi (2 : 3 = 4 : 6)',
    choiceOptions: [
      'Cùng một màu minh họa vì tỉ lệ Xanh : Vàng không đổi (2 : 3 = 4 : 6)',
      'Mẻ 10 phần đậm gấp đôi mẻ 5 phần',
      'Mẻ 10 phần chuyển sang màu xanh dương',
    ],
    hints: [
      'Kiểm tra tỉ lệ phần trăm màu Xanh trong tổng lượng của cả hai mẻ.',
      'Mẻ 1 có 2/5 = 40% Xanh; mẻ 2 có 4/10 = 40% Xanh.',
      'Cùng tỉ lệ thành phần thì cho cùng màu minh họa, chỉ khác thể tích nhiều hay ít.',
    ],
    explanationVi: 'Vì 2 : 3 = 4 : 6 nên tỉ phần mỗi màu trong hỗn hợp không đổi, hai mẻ cho cùng màu minh họa (chỉ khác tổng thể tích).',
  },
  {
    id: 'm18_act2_t8',
    activityId: 'MIX_COLOR_RATIO',
    difficulty: 'HARD',
    title: 'Pha 750 mL hỗn hợp màu theo tỉ lệ 2 : 3 (mỗi phần 50 mL)',
    prompt: 'Mỗi phần đong là 50 mL. Cần pha tổng cộng 750 mL hỗn hợp theo tỉ lệ Xanh : Vàng = 2 : 3.',
    question: 'Trong 750 mL hỗn hợp tỉ lệ 2 : 3 đó, thể tích màu Xanh là bao nhiêu mL?',
    preset: { baseBlue: 2, baseYellow: 3, mixBlue: 6, mixYellow: 9, scaleFactor: 3, mlPerPart: 50 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 300,
    unitSuffix: 'mL Xanh',
    hints: [
      'Tổng số phần của công thức 2 : 3 là 2 + 3 = 5 phần.',
      'Giá trị 1 phần theo thể tích là 750 : 5 = 150 mL.',
      'Màu Xanh chiếm 2 phần nên thể tích Xanh là 150 × 2 = 300 mL (Vàng là 450 mL).',
    ],
    explanationVi: '750 mL chia thành 2 + 3 = 5 phần thì mỗi phần là 150 mL. Vậy màu Xanh cần 2 × 150 = 300 mL (tương đương 6 cốc 50 mL).',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 3: TỈ SỐ BẰNG NHAU (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act3_t1',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'EASY',
    title: 'Chuỗi tỉ số bằng nhau: 2 : 3 = 4 : 6 = 6 : 9',
    prompt: 'Quan sát bảng hai hàng và hai trục số song song của tỉ số 2 : 3.',
    question: 'Điền số còn thiếu vào tỉ số bằng nhau: 2 : 3 = 6 : ?',
    preset: { eqA: 2, eqB: 3, eqC: 6, eqD: 9, missingSlot: 'D' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 9,
    hints: [
      'Từ 2 lên 6, thành phần thứ nhất đã nhân với 3.',
      'Nhân thành phần thứ hai (3) với cùng hệ số 3.',
      '3 × 3 = 9, vậy 2 : 3 = 6 : 9.',
    ],
    explanationVi: 'Nhân cả hai thành phần của 2 : 3 với 3 ta được 6 : 9 (kiểm tra nhân chéo: 2 × 9 = 3 × 6 = 18).',
  },
  {
    id: 'm18_act3_t2',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'EASY',
    title: 'Tìm thành phần chưa biết: 3 : 5 = 9 : ?',
    prompt: 'Quan sát hai trục số song song biểu diễn tỉ số 3 : 5.',
    question: 'Khi thành phần thứ nhất là 9 thì thành phần thứ hai là bao nhiêu để giữ tỉ số 3 : 5?',
    preset: { eqA: 3, eqB: 5, eqC: 9, eqD: 15, missingSlot: 'D' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 15,
    hints: [
      'Ta có 9 : 3 = 3 (nhân hệ số 3).',
      'Lấy 5 × 3.',
      'Kết quả là 15 (3 : 5 = 9 : 15).',
    ],
    explanationVi: '3 : 5 = (3 × 3) : (5 × 3) = 9 : 15.',
  },
  {
    id: 'm18_act3_t3',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'EASY',
    title: 'Rút gọn tỉ số số nguyên 12 : 18 về tối giản',
    prompt: 'Chia cả hai thành phần của tỉ số 12 : 18 cho ước chung lớn nhất.',
    question: 'Tỉ số tối giản của 12 : 18 là bao nhiêu?',
    preset: { eqA: 12, eqB: 18, eqC: 2, eqD: 3 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 2, b: 3 },
    requireSimplifiedRatio: true,
    hints: [
      'Tìm ƯCLN(12, 18).',
      'ƯCLN(12, 18) = 6. Chia cả 12 và 18 cho 6.',
      '(12 : 6) : (18 : 6) = 2 : 3.',
    ],
    explanationVi: 'Chia cả hai thành phần của 12 : 18 cho ƯCLN(12, 18) = 6 ta được 2 : 3.',
  },
  {
    id: 'm18_act3_t4',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'MEDIUM',
    title: 'Tìm số đứng trước: 4 : 7 = ? : 21',
    prompt: 'Áp dụng quy tắc nhân chéo hoặc hệ số mở rộng cho 4 : 7 = ? : 21.',
    question: 'Số cần điền vào dấu ? trong tỉ lệ thức 4 : 7 = ? : 21 là bao nhiêu?',
    preset: { eqA: 4, eqB: 7, eqC: 12, eqD: 21, missingSlot: 'C' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 12,
    hints: [
      'Từ 7 lên 21, ta đã nhân với k = 21 : 7 = 3.',
      'Nhân 4 với 3 (hoặc dùng nhân chéo: ? = 4 × 21 : 7).',
      '4 × 3 = 12.',
    ],
    explanationVi: 'Vì 21 : 7 = 3 nên số cần tìm là 4 × 3 = 12.',
  },
  {
    id: 'm18_act3_t5',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'MEDIUM',
    title: 'Kiểm tra hai tỉ số bằng nhân chéo: 2 : 3 và 4 : 5',
    prompt: 'Đối chiếu 2 : 3 và 4 : 5 trên hai trục số song song.',
    question: 'Vì sao khẳng định 2 : 3 ≠ 4 : 5?',
    preset: { eqA: 2, eqB: 3, eqC: 4, eqD: 6 },
    answerType: 'CHOICE',
    expectedChoice: 'Vì tích chéo 2 × 5 = 10 khác 3 × 4 = 12',
    choiceOptions: [
      'Vì tích chéo 2 × 5 = 10 khác 3 × 4 = 12',
      'Vì 4 và 5 lớn hơn 2 và 3',
      'Vì 2 + 3 = 5 còn 4 + 5 = 9',
    ],
    hints: [
      'Quy tắc: a : b = c : d khi và chỉ khi a × d = b × c.',
      'Tính 2 × 5 và 3 × 4.',
      '2 × 5 = 10 ≠ 12 = 3 × 4 nên hai tỉ số không bằng nhau.',
    ],
    explanationVi: 'Hai tỉ số a:b và c:d bằng nhau khi và chỉ khi a·d = b·c. Ta có 2·5 = 10 ≠ 3·4 = 12 nên 2:3 ≠ 4:5.',
  },
  {
    id: 'm18_act3_t6',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'MEDIUM',
    title: 'Rút gọn tỉ số 15 : 25',
    prompt: 'Rút gọn tỉ số 15 : 25 về dạng hai số nguyên nguyên tố cùng nhau.',
    question: 'Tỉ số rút gọn tối giản của 15 : 25 là gì?',
    preset: { eqA: 15, eqB: 25, eqC: 3, eqD: 5 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 3, b: 5 },
    requireSimplifiedRatio: true,
    hints: [
      'Tìm ƯCLN của 15 và 25.',
      'ƯCLN(15, 25) = 5.',
      '15 : 25 = (15 : 5) : (25 : 5) = 3 : 5.',
    ],
    explanationVi: 'Chia cả hai thành phần cho 5 ta được 15 : 25 = 3 : 5.',
  },
  {
    id: 'm18_act3_t7',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'HARD',
    title: 'Đổi đơn vị trước khi lập tỉ số: 50 cm : 1 m',
    prompt: 'Lập tỉ số giữa độ dài 50 cm và 1 m.',
    question: 'Sau khi đổi về cùng đơn vị đo, tỉ số tối giản của 50 cm : 1 m là bao nhiêu?',
    preset: { eqA: 50, eqB: 100, eqC: 1, eqD: 2 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 1, b: 2 },
    requireSimplifiedRatio: true,
    hints: [
      'Không được lập tỉ số 50 : 1 khi một bên là cm, một bên là m!',
      'Đổi 1 m = 100 cm.',
      '50 cm : 100 cm = 50 : 100 = 1 : 2.',
    ],
    explanationVi: 'Đổi 1 m = 100 cm. Khi đó 50 cm : 1 m = 50 cm : 100 cm = 1 : 2.',
  },
  {
    id: 'm18_act3_t8',
    activityId: 'EQUIVALENT_RATIOS',
    difficulty: 'HARD',
    title: 'Tìm x trong tỉ lệ thức: x : 8 = 9 : 12',
    prompt: 'Sử dụng tính chất tích chéo 12 · x = 8 · 9.',
    question: 'Giá trị của x trong tỉ lệ thức x : 8 = 9 : 12 là bao nhiêu?',
    preset: { eqA: 6, eqB: 8, eqC: 9, eqD: 12, missingSlot: 'C' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 6,
    hints: [
      'Rút gọn 9 : 12 = 3 : 4, hoặc nhân chéo 12 · x = 8 · 9.',
      '8 × 9 = 72.',
      'x = 72 : 12 = 6.',
    ],
    explanationVi: 'Ta có 12 · x = 8 · 9 = 72 ⇒ x = 72 : 12 = 6 (kiểm tra: 6 : 8 = 3 : 4 = 9 : 12).',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 4: CHIA THEO TỈ LỆ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act4_t1',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'EASY',
    title: 'Ví dụ chuẩn: Chia 30 vật theo tỉ lệ 2 : 3',
    prompt: 'Nhập tổng S = 30 và tỉ lệ 2 : 3 trên sơ đồ đoạn thẳng.',
    question: 'Khi chia 30 vật theo tỉ lệ 2 : 3, Nhóm A (2 phần) và Nhóm B (3 phần) nhận lần lượt bao nhiêu vật?',
    preset: { totalS: 30, ratioParts: [2, 3], isDiscrete: true, unitLabel: 'vật' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 12, b: 18 },
    hints: [
      'Tổng số phần bằng nhau là 2 + 3 = 5 (phần).',
      'Giá trị của 1 phần là 30 : 5 = 6 (vật).',
      'Nhóm A = 6 × 2 = 12 (vật); Nhóm B = 6 × 3 = 18 (vật).',
    ],
    explanationVi: 'Tổng số phần: 2 + 3 = 5. Mỗi phần: 30 : 5 = 6. Nhóm A nhận 12 vật, Nhóm B nhận 18 vật.',
  },
  {
    id: 'm18_act4_t2',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'EASY',
    title: 'Chia 40 chiếc thẻ theo tỉ lệ 3 : 5',
    prompt: 'Nhập tổng S = 40 thẻ và tỉ lệ 3 : 5.',
    question: 'Khi chia 40 thẻ theo tỉ lệ 3 : 5, hai nhóm nhận lần lượt bao nhiêu thẻ?',
    preset: { totalS: 40, ratioParts: [3, 5], isDiscrete: true, unitLabel: 'thẻ' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 15, b: 25 },
    hints: [
      'Tổng số phần bằng nhau là 3 + 5 = 8 (phần).',
      'Giá trị 1 phần là 40 : 8 = 5 (thẻ).',
      'Nhóm A = 5 × 3 = 15 (thẻ); Nhóm B = 5 × 5 = 25 (thẻ).',
    ],
    explanationVi: 'Tổng số phần là 3 + 5 = 8. Mỗi phần có 40 : 8 = 5 thẻ. Hai nhóm nhận 15 thẻ và 25 thẻ.',
  },
  {
    id: 'm18_act4_t3',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'EASY',
    title: 'Tìm giá trị 1 phần khi chia 28 viên bi theo tỉ lệ 3 : 4',
    prompt: 'Chia 28 viên bi thành hai nhóm theo tỉ lệ 3 : 4.',
    question: 'Mỗi phần bằng nhau có bao nhiêu viên bi?',
    preset: { totalS: 28, ratioParts: [3, 4], isDiscrete: true, unitLabel: 'viên bi' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 4,
    unitSuffix: 'viên bi/phần',
    hints: [
      'Tính tổng số phần bằng nhau: 3 + 4 = 7 phần.',
      'Lấy tổng số viên bi (28) chia cho tổng số phần (7).',
      '28 : 7 = 4 viên bi mỗi phần.',
    ],
    explanationVi: 'Tổng số phần là 3 + 4 = 7. Giá trị 1 phần là 28 : 7 = 4 viên bi (Nhóm A: 12 viên, Nhóm B: 16 viên).',
  },
  {
    id: 'm18_act4_t4',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'MEDIUM',
    title: 'Chia 45 quyển vở theo tỉ lệ 4 : 5',
    prompt: 'Chia 45 quyển vở cho hai tổ theo tỉ lệ 4 : 5.',
    question: 'Hai tổ nhận lần lượt bao nhiêu quyển vở?',
    preset: { totalS: 45, ratioParts: [4, 5], isDiscrete: true, unitLabel: 'quyển vở' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 20, b: 25 },
    hints: [
      'Tổng số phần bằng nhau: 4 + 5 = 9 phần.',
      'Mỗi phần: 45 : 9 = 5 quyển vở.',
      'Tổ 1: 5 × 4 = 20 quyển; Tổ 2: 5 × 5 = 25 quyển.',
    ],
    explanationVi: '45 : (4 + 5) = 5 quyển/phần. Hai tổ nhận 20 quyển và 25 quyển.',
  },
  {
    id: 'm18_act4_t5',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'MEDIUM',
    title: 'Chia đại lượng liên tục: 15 m dây theo tỉ lệ 1 : 2',
    prompt: 'Chuyển sang chế độ "Đại lượng liên tục (m, L)" và chia 15 m dây theo tỉ lệ 1 : 2.',
    question: 'Đoạn dây thứ nhất và đoạn dây thứ hai dài lần lượt bao nhiêu mét?',
    preset: { totalS: 15, ratioParts: [1, 2], isDiscrete: false, unitLabel: 'm' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 5, b: 10 },
    hints: [
      'Tổng số phần: 1 + 2 = 3 phần.',
      'Mỗi phần dài: 15 : 3 = 5 m.',
      'Đoạn 1 dài 5 m; Đoạn 2 dài 10 m.',
    ],
    explanationVi: 'Chia 15 m thành 3 phần bằng nhau: đoạn ngắn 5 m, đoạn dài 10 m.',
  },
  {
    id: 'm18_act4_t6',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'MEDIUM',
    title: 'Kiểm tra điều kiện chia nguyên đối với vật rời (25 viên bi theo 2 : 3)',
    prompt: 'Quan sát trường hợp chia 26 viên bi nguyên vẹn theo tỉ lệ 2 : 3.',
    question: 'Vì sao không thể chia nguyên vẹn 26 viên bi thành hai nhóm đúng tỉ lệ 2 : 3?',
    preset: { totalS: 26, ratioParts: [2, 3], isDiscrete: true, unitLabel: 'viên bi' },
    answerType: 'CHOICE',
    expectedChoice: 'Vì tổng số phần là 2 + 3 = 5 mà 26 không chia hết cho 5 (viên bi là vật rời không cắt nhỏ)',
    choiceOptions: [
      'Vì tổng số phần là 2 + 3 = 5 mà 26 không chia hết cho 5 (viên bi là vật rời không cắt nhỏ)',
      'Vì 26 là số chẵn nên chỉ chia được theo tỉ lệ chẵn',
      'Cứ làm tròn thành 10 viên và 16 viên thì vẫn đúng tỉ lệ 2 : 3',
    ],
    hints: [
      'Tổng số phần của tỉ lệ 2 : 3 là 2 + 3 = 5.',
      'Nếu làm tròn thành 10 và 16 thì 10 : 16 = 5 : 8 ≠ 2 : 3!',
      'Với vật rời nguyên vẹn, tổng S phải chia hết cho tổng số phần (a + b) đã rút gọn.',
    ],
    explanationVi: 'Viên bi là vật rời không thể đập vỡ và không được tự ý làm tròn (vì làm tròn sẽ làm sai tỉ lệ). Do 26 không chia hết cho 5 nên không chia nguyên được.',
  },
  {
    id: 'm18_act4_t7',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'HARD',
    title: 'Mở rộng 3 nhóm: Chia 60 quyển sách theo tỉ lệ 1 : 2 : 3',
    prompt: 'Bật chế độ mở rộng 3 nhóm (a : b : c = 1 : 2 : 3) với tổng S = 60.',
    question: 'Khi chia 60 quyển sách theo tỉ lệ 1 : 2 : 3, nhóm lớn nhất (3 phần) nhận bao nhiêu quyển?',
    preset: { totalS: 60, ratioParts: [1, 2, 3], isDiscrete: true, unitLabel: 'quyển sách' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 30,
    unitSuffix: 'quyển sách',
    hints: [
      'Tổng số phần của cả 3 nhóm là 1 + 2 + 3 = 6 phần.',
      'Giá trị 1 phần là 60 : 6 = 10 quyển.',
      'Nhóm 3 phần nhận: 10 × 3 = 30 quyển (3 nhóm nhận lần lượt 10, 20, 30 quyển).',
    ],
    explanationVi: 'Tổng số phần: 1 + 2 + 3 = 6. Mỗi phần 10 quyển. Ba nhóm nhận lần lượt 10, 20 và 30 quyển.',
  },
  {
    id: 'm18_act4_t8',
    activityId: 'DIVIDE_BY_RATIO',
    difficulty: 'HARD',
    title: 'Tìm tổng S khi biết hiệu hai nhóm và tỉ lệ 3 : 5',
    prompt: 'Hai nhóm chia vật theo tỉ lệ 3 : 5, biết nhóm A có 15 vật.',
    question: 'Nếu nhóm thứ nhất (3 phần) nhận 15 vật theo tỉ lệ 3 : 5 thì tổng cả hai nhóm có bao nhiêu vật?',
    preset: { totalS: 40, ratioParts: [3, 5], isDiscrete: true, unitLabel: 'vật' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 40,
    unitSuffix: 'vật',
    hints: [
      'Nhóm thứ nhất chiếm 3 phần và bằng 15 vật, nên 1 phần = 15 : 3 = 5 vật.',
      'Tổng hai nhóm có 3 + 5 = 8 phần.',
      'Tổng số vật S = 5 × 8 = 40 vật.',
    ],
    explanationVi: '1 phần = 15 : 3 = 5 vật. Tổng cộng 3 + 5 = 8 phần ứng với 5 × 8 = 40 vật.',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 5: ĐẠI LƯỢNG TỈ LỆ (8 TASKS — THUẬN & NGHỊCH)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act5_t1',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'EASY',
    title: 'Tỉ lệ thuận: Mua 5 quyển vở với đơn giá giả định 8 (nghìn đồng)',
    prompt: 'Mở tab "Tỉ lệ thuận", đơn giá cố định k = 8 (nghìn đồng/quyển). Chọn số lượng x = 5 quyển.',
    question: 'Nếu 1 quyển vở giá 8 nghìn đồng (8.000 đồng) thì mua 5 quyển hết bao nhiêu nghìn đồng?',
    preset: { propMode: 'DIRECT', kValue: 8, queryX: 5 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 40,
    unitSuffix: 'nghìn đồng (40.000 đồng)',
    hints: [
      'Số tiền y tỉ lệ thuận với số quyển vở x theo công thức y = k · x.',
      'Thay k = 8 và x = 5 vào công thức.',
      'y = 8 × 5 = 40 (nghìn đồng), tức 40.000 đồng.',
    ],
    explanationVi: 'Với đơn giá cố định 8.000 đồng/quyển: 3 quyển hết 24.000 đồng, 5 quyển hết 5 × 8.000 = 40.000 đồng.',
  },
  {
    id: 'm18_act5_t2',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'EASY',
    title: 'Tỉ lệ thuận: Mua 3 quyển vở giá 8 nghìn đồng/quyển',
    prompt: 'Quan sát bảng giá trị tỉ lệ thuận y = 8x tại x = 3.',
    question: 'Mua 3 quyển vở (đơn giá 8 nghìn đồng/quyển) hết bao nhiêu nghìn đồng?',
    preset: { propMode: 'DIRECT', kValue: 8, queryX: 3 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 24,
    unitSuffix: 'nghìn đồng (24.000 đồng)',
    hints: [
      'Áp dụng công thức y = 8 · x.',
      'Thay x = 3.',
      'y = 8 × 3 = 24 (nghìn đồng), tức 24.000 đồng.',
    ],
    explanationVi: '3 quyển × 8.000 đồng/quyển = 24.000 đồng (24 nghìn đồng).',
  },
  {
    id: 'm18_act5_t3',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'EASY',
    title: 'Tỉ lệ nghịch: Chia đều 24 L nước vào 3 bình',
    prompt: 'Chuyển sang tab "Tỉ lệ nghịch", tổng lượng cố định k = 24 L, chọn x = 3 bình.',
    question: 'Chia đều 24 L nước vào 3 bình bằng nhau thì mỗi bình chứa bao nhiêu lít nước?',
    preset: { propMode: 'INVERSE', kValue: 24, queryX: 3 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 8,
    unitSuffix: 'L/bình',
    hints: [
      'Tổng lượng nước không đổi: x · y = 24 (L).',
      'Mỗi bình chứa y = 24 / x.',
      'Với x = 3 bình: y = 24 : 3 = 8 (L/bình).',
    ],
    explanationVi: 'Chia đều 24 L vào 3 bình ta được 24 : 3 = 8 L/bình (tích 3 × 8 = 24 không đổi).',
  },
  {
    id: 'm18_act5_t4',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'MEDIUM',
    title: 'Tỉ lệ nghịch: Chia đều 24 L nước vào 6 bình',
    prompt: 'Trong tab "Tỉ lệ nghịch" (k = 24 L), tăng số bình lên x = 6.',
    question: 'Khi chia đều 24 L nước vào 6 bình thì mỗi bình có bao nhiêu lít nước?',
    preset: { propMode: 'INVERSE', kValue: 24, queryX: 6 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 4,
    unitSuffix: 'L/bình',
    hints: [
      'Số bình tăng gấp đôi từ 3 lên 6 thì lượng nước mỗi bình giảm đi một nửa.',
      'y = 24 : 6.',
      'y = 4 (L/bình).',
    ],
    explanationVi: '24 L chia đều vào 6 bình được 4 L/bình.',
  },
  {
    id: 'm18_act5_t5',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'MEDIUM',
    title: 'Tìm hệ số tỉ lệ thuận k khi biết x = 4, y = 36',
    prompt: 'Đại lượng y tỉ lệ thuận với x (y = k·x). Biết khi x = 4 thì y = 36.',
    question: 'Hệ số tỉ lệ thuận k = y / x bằng bao nhiêu?',
    preset: { propMode: 'DIRECT', kValue: 9, queryX: 4 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 9,
    hints: [
      'Trong quan hệ tỉ lệ thuận y = k · x, tỉ số y / x luôn không đổi và bằng k.',
      'Lấy y chia cho x: 36 : 4.',
      'k = 9.',
    ],
    explanationVi: 'Hệ số tỉ lệ thuận là k = y / x = 36 / 4 = 9.',
  },
  {
    id: 'm18_act5_t6',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'HARD',
    title: 'Phản ví dụ: Quan hệ y = 2x + 3 có tỉ lệ thuận không?',
    prompt: 'Bật chế độ "Phản ví dụ y = 2x + 3" và quan sát bảng tỉ số y/x cùng đồ thị.',
    question: 'Đại lượng y = 2x + 3 (dù y tăng khi x tăng) có tỉ lệ thuận với x không?',
    preset: { propMode: 'NON_PROPORTIONAL_LINEAR', kValue: 2, queryX: 2 },
    answerType: 'CHOICE',
    expectedChoice: 'Không, vì tỉ số y/x không hằng định (5/1 ≠ 7/2) và đồ thị không đi qua gốc (0; 0)',
    choiceOptions: [
      'Không, vì tỉ số y/x không hằng định (5/1 ≠ 7/2) và đồ thị không đi qua gốc (0; 0)',
      'Có, vì khi x tăng thì y cũng tăng',
      'Có, với hệ số tỉ lệ k = 5',
    ],
    hints: [
      'Tính thử y/x tại x = 1 (y = 5 ⇒ y/x = 5) và tại x = 2 (y = 7 ⇒ y/x = 3,5).',
      'Hai tỉ số 5 và 3,5 không bằng nhau!',
      'Không được kết luận tỉ lệ thuận chỉ vì cả hai đại lượng cùng tăng.',
    ],
    explanationVi:
      'Chỉ khi y/x = k không đổi với mọi x ≠ 0 thì mới là tỉ lệ thuận. Với y = 2x + 3, tỉ số y/x thay đổi nên không phải tỉ lệ thuận.',
  },
  {
    id: 'm18_act5_t7',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'HARD',
    title: 'Tính chất đồ thị của đại lượng tỉ lệ thuận và tỉ lệ nghịch',
    prompt: 'Đối chiếu đồ thị của y = kx (tỉ lệ thuận) và y = k/x (tỉ lệ nghịch).',
    question: 'Khẳng định nào sau đây là ĐÚNG về đồ thị của hai quan hệ tỉ lệ?',
    preset: { propMode: 'INVERSE', kValue: 24, queryX: 2 },
    answerType: 'CHOICE',
    expectedChoice: 'Đường tỉ lệ thuận đi qua gốc (0; 0), còn tỉ lệ nghịch y = k/x không cắt trục tại x = 0',
    choiceOptions: [
      'Đường tỉ lệ thuận đi qua gốc (0; 0), còn tỉ lệ nghịch y = k/x không cắt trục tại x = 0',
      'Cả hai đồ thị đều đi qua gốc tọa độ (0; 0)',
      'Đồ thị tỉ lệ nghịch là một đường thẳng đi xuống',
    ],
    hints: [
      'Với y = k·x, tại x = 0 thì y = 0 nên đi qua gốc tọa độ.',
      'Với y = k/x, x nằm ở mẫu số nên x không thể bằng 0.',
      'Do đó đồ thị tỉ lệ nghịch không bao giờ nối qua x = 0.',
    ],
    explanationVi: 'Trong y = k/x, x ≠ 0 nên đồ thị không bao giờ có điểm tại x = 0.',
  },
  {
    id: 'm18_act5_t8',
    activityId: 'PROPORTIONAL_QUANTITIES',
    difficulty: 'HARD',
    title: 'Tìm y trong tỉ lệ nghịch khi tích x · y = 36',
    prompt: 'Hai đại lượng x và y tỉ lệ nghịch với nhau, biết khi x = 3 thì y = 12.',
    question: 'Khi x = 9 thì giá trị của y bằng bao nhiêu?',
    preset: { propMode: 'INVERSE', kValue: 36, queryX: 9 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 4,
    hints: [
      'Tìm hằng số tỉ lệ nghịch k = x · y = 3 × 12 = 36.',
      'Khi x = 9, ta có 9 · y = 36.',
      'y = 36 : 9 = 4.',
    ],
    explanationVi: 'Tích không đổi k = 3 × 12 = 36. Khi x = 9 thì y = 36 : 9 = 4.',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 6: THỬ THÁCH THỰC TẾ (8 TASKS — RECIPE, DRINK, SHOPPING, UNIT)
  // --------------------------------------------------------------------------
  {
    id: 'm18_act6_t1',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'EASY',
    title: 'Điều chỉnh công thức làm bánh: 4 suất dùng 300 g bột ➔ 10 suất',
    prompt: 'Một công thức làm bánh chuẩn cho 4 suất cần dùng 300 g bột mì.',
    question: 'Muốn làm 10 suất bánh giữ nguyên công thức đó thì cần bao nhiêu gam (g) bột mì?',
    preset: { scenarioCategory: 'RECIPE', eqA: 4, eqB: 300, eqC: 10, eqD: 750 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 750,
    unitSuffix: 'g bột mì',
    hints: [
      '4 suất cần 300 g bột, vậy 1 suất cần 300 : 4 = 75 g bột.',
      'Nhân lượng bột của 1 suất với 10 suất.',
      '75 × 10 = 750 (g bột mì).',
    ],
    explanationVi: 'Lượng bột cho 1 suất là 300 : 4 = 75 g. Vậy 10 suất bánh cần 75 × 10 = 750 g bột.',
  },
  {
    id: 'm18_act6_t2',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'EASY',
    title: 'Pha nước giải khát: Siro : Nước = 1 : 4, tổng 1.000 mL',
    prompt: 'Pha 1.000 mL nước giải khát theo công thức Siro : Nước lọc = 1 : 4.',
    question: 'Cần bao nhiêu mL Siro và bao nhiêu mL Nước lọc (nhập theo dạng Siro : Nước)?',
    preset: { scenarioCategory: 'DRINK', totalS: 1000, ratioParts: [1, 4], isDiscrete: false, unitLabel: 'mL' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 200, b: 800 },
    hints: [
      'Tổng số phần bằng nhau là 1 + 4 = 5 (phần).',
      'Mỗi phần ứng với 1.000 : 5 = 200 mL.',
      'Siro (1 phần) = 200 mL; Nước lọc (4 phần) = 200 × 4 = 800 mL.',
    ],
    explanationVi: 'Tổng 5 phần = 1.000 mL ⇒ 1 phần = 200 mL. Vậy cần 200 mL siro và 800 mL nước lọc.',
  },
  {
    id: 'm18_act6_t3',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'EASY',
    title: 'Mua hàng theo đơn giá giả định: 7 hộp sữa (12 nghìn đồng/hộp)',
    prompt: 'Dữ liệu giả định trong bài học: Mỗi hộp sữa có đơn giá cố định 12 nghìn đồng.',
    question: 'Mua 7 hộp sữa cùng loại hết bao nhiêu nghìn đồng?',
    preset: { scenarioCategory: 'SHOPPING', propMode: 'DIRECT', kValue: 12, queryX: 7 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 84,
    unitSuffix: 'nghìn đồng',
    hints: [
      'Tổng tiền = Đơn giá × Số lượng.',
      'Lấy 12 (nghìn đồng/hộp) × 7 (hộp).',
      '12 × 7 = 84 (nghìn đồng).',
    ],
    explanationVi: 'Với đơn giá giả định 12 nghìn đồng/hộp, 7 hộp sữa có giá 12 × 7 = 84 nghìn đồng.',
  },
  {
    id: 'm18_act6_t4',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'MEDIUM',
    title: 'Chia 40 thẻ học tập theo tỉ lệ 3 : 5 cho hai đội',
    prompt: 'Giáo viên chia 40 thẻ câu hỏi cho Đội Xanh và Đội Vàng theo tỉ lệ 3 : 5.',
    question: 'Đội Xanh (3 phần) và Đội Vàng (5 phần) nhận lần lượt bao nhiêu thẻ?',
    preset: { scenarioCategory: 'SHARE', totalS: 40, ratioParts: [3, 5], isDiscrete: true, unitLabel: 'thẻ' },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 15, b: 25 },
    hints: [
      'Tổng số phần là 3 + 5 = 8 phần.',
      'Mỗi phần có 40 : 8 = 5 thẻ.',
      'Đội Xanh nhận 15 thẻ, Đội Vàng nhận 25 thẻ.',
    ],
    explanationVi: '40 : (3 + 5) = 5 thẻ/phần ⇒ Đội Xanh nhận 15 thẻ, Đội Vàng nhận 25 thẻ.',
  },
  {
    id: 'm18_act6_t5',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'MEDIUM',
    title: 'Đổi đơn vị trước khi lập tỉ số: 50 cm và 1 m',
    prompt: 'Một băng giấy ngắn dài 50 cm và một băng giấy dài 1 m.',
    question: 'Tỉ số tối giản giữa chiều dài băng giấy ngắn (50 cm) và băng giấy dài (1 m) là bao nhiêu?',
    preset: { scenarioCategory: 'UNIT_RATIO', eqA: 50, eqB: 100, eqC: 1, eqD: 2 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 1, b: 2 },
    requireSimplifiedRatio: true,
    hints: [
      'Đổi 1 m ra cm: 1 m = 100 cm.',
      'Lập tỉ số cùng đơn vị cm: 50 : 100.',
      'Rút gọn cho 50 được 1 : 2.',
    ],
    explanationVi: '50 cm : 1 m = 50 cm : 100 cm = 1 : 2.',
  },
  {
    id: 'm18_act6_t6',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'MEDIUM',
    title: 'Chia đều lượng cố định: 30 L nước cam vào 5 bình',
    prompt: 'Có 30 L nước cam chia đều vào 5 bình đựng cho các bàn học sinh.',
    question: 'Mỗi bình chứa bao nhiêu lít nước cam?',
    preset: { scenarioCategory: 'DRINK', propMode: 'INVERSE', kValue: 30, queryX: 5 },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 6,
    unitSuffix: 'L/bình',
    hints: [
      'Tổng lượng nước 30 L giữ cố định.',
      'Chia đều cho 5 bình: 30 : 5.',
      'Mỗi bình chứa 6 L.',
    ],
    explanationVi: '30 L : 5 bình = 6 L/bình.',
  },
  {
    id: 'm18_act6_t7',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'HARD',
    title: 'Đổi đơn vị khối lượng: 400 g đường và 2 kg bột',
    prompt: 'Trong một mẻ bánh lớn có 400 g đường và 2 kg bột mì.',
    question: 'Tỉ số tối giản giữa khối lượng đường và khối lượng bột mì sau khi đổi về cùng đơn vị gam (g) là gì?',
    preset: { scenarioCategory: 'UNIT_RATIO', eqA: 400, eqB: 2000, eqC: 1, eqD: 5 },
    answerType: 'RATIO_PAIR',
    expectedRatio: { a: 1, b: 5 },
    requireSimplifiedRatio: true,
    hints: [
      'Đổi 2 kg = 2.000 g.',
      'Lập tỉ số: 400 g : 2.000 g = 400 : 2000.',
      'Chia cả hai cho 400 ta được 1 : 5.',
    ],
    explanationVi: 'Đổi 2 kg = 2.000 g. Tỉ số khối lượng đường và bột là 400 : 2.000 = 1 : 5.',
  },
  {
    id: 'm18_act6_t8',
    activityId: 'REAL_WORLD_CHALLENGE',
    difficulty: 'HARD',
    title: 'Bài toán 2 bước: Pha trà sữa theo tỉ lệ Trà : Sữa = 3 : 2 (1,5 L)',
    prompt: 'Cần pha 1,5 L (tức 1.500 mL) trà sữa theo tỉ lệ Trà : Sữa = 3 : 2.',
    question: 'Lượng Trà cần dùng là bao nhiêu mL?',
    preset: { scenarioCategory: 'DRINK', totalS: 1500, ratioParts: [3, 2], isDiscrete: false, unitLabel: 'mL' },
    answerType: 'SINGLE_NUMBER',
    expectedNumber: 900,
    unitSuffix: 'mL Trà',
    hints: [
      'Bước 1: Đổi 1,5 L = 1.500 mL.',
      'Bước 2: Tổng số phần là 3 + 2 = 5 phần ⇒ 1 phần = 1.500 : 5 = 300 mL.',
      'Lượng Trà (3 phần) = 300 × 3 = 900 mL (Sữa là 600 mL).',
    ],
    explanationVi: 'Đổi 1,5 L = 1.500 mL. Tổng 3 + 2 = 5 phần ⇒ 1 phần = 300 mL ⇒ Trà = 3 × 300 = 900 mL.',
  },
];

export function getM18TasksByActivity(activityId: M18ActivityId): M18TaskSpec[] {
  return M18_TASK_BANK.filter((t) => t.activityId === activityId);
}

// ============================================================================
// 7. MANDATORY AUTOMATED VERIFICATION SUITE (SECTION 13)
// ============================================================================

export function runM18UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
} {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  const check = (label: string, cond: boolean) => {
    totalChecks++;
    if (!cond) failedChecks.push(label);
  };

  // 1. 2:3 = 4:6 and 2:3 != 4:5
  check(
    '2:3 = 4:6 and 2:3 != 4:5',
    areRatiosEqual(2, 3, 4, 6) && !areRatiosEqual(2, 3, 4, 5)
  );

  // 2. Xanh:Vàng = 2:3 => Xanh:Tổng = 2:5
  const rPart = evaluateRatioFromCounts(2, 3, 'BLUE_TO_YELLOW');
  const rWhole = evaluateRatioFromCounts(2, 3, 'BLUE_TO_TOTAL');
  check(
    'Blue:Yellow = 2:3 => Blue:Total = 2:5',
    rPart.antecedent === 2 &&
      rPart.consequent === 3 &&
      rWhole.antecedent === 2 &&
      rWhole.consequent === 5
  );

  // 3. Keep 2:3 with 6 blue => 9 yellow
  const mix69 = evaluateColorMixFormula(2, 3, 6, 9, 50);
  check(
    'Keep 2:3 with 6 blue requires 9 yellow',
    mix69.isSameRatio === true && mix69.mixYellow === 9
  );

  // 4. Total 20 parts with ratio 2:3 => 8 and 12
  const div20 = divideTotalByRatio(20, [2, 3], true, 'phần');
  check(
    'Total 20 parts in ratio 2:3 gives 8 and 12',
    div20.status === 'VALID' &&
      div20.allocatedExact[0].num === 8 &&
      div20.allocatedExact[1].num === 12
  );

  // 5. Divide 30 in ratio 2:3 => 12 and 18
  const div30 = divideTotalByRatio(30, [2, 3], true, 'vật');
  check(
    'Divide 30 in ratio 2:3 gives 12 and 18',
    div30.status === 'VALID' &&
      div30.allocatedExact[0].num === 12 &&
      div30.allocatedExact[1].num === 18
  );

  // 6. Divide 40 in ratio 3:5 => 15 and 25
  const div40 = divideTotalByRatio(40, [3, 5], true, 'thẻ');
  check(
    'Divide 40 in ratio 3:5 gives 15 and 25',
    div40.status === 'VALID' &&
      div40.allocatedExact[0].num === 15 &&
      div40.allocatedExact[1].num === 25
  );

  // 7. 50 cm : 1 m = 1:2
  const conv50cm1m = computeUnitAwareRatio(50, 'cm', 1, 'm');
  check(
    '50 cm : 1 m converts to 50 cm : 100 cm = 1 : 2',
    conv50cm1m.status === 'SAME_KIND_RATIO' &&
      conv50cm1m.simplifiedColon === '1 : 2'
  );

  // 8. 4 servings use 300 g => 10 servings use 750 g
  check(
    '4 servings : 300 g = 10 servings : 750 g',
    areRatiosEqual(4, 300, 10, 750)
  );

  // 9. Syrup:Water = 1:4, total 1000 mL => 200 mL and 800 mL
  const drink1000 = divideTotalByRatio(1000, [1, 4], false, 'mL');
  check(
    'Syrup:Water = 1:4, total 1000 mL gives 200 mL and 800 mL',
    drink1000.allocatedExact[0].num === 200 &&
      drink1000.allocatedExact[1].num === 800
  );

  // 10. 5 notebooks at 8,000 VND/notebook => 40,000 VND
  const direct8 = analyzeProportionalRelation('DIRECT', 8000, [3, 5]);
  check(
    'Direct proportion 5 notebooks at 8,000 gives 40,000',
    direct8.points[0].y === 24000 && direct8.points[1].y === 40000
  );

  // 11. Divide 24 L into 3 bottles => 8 L/bottle
  const inv24 = analyzeProportionalRelation('INVERSE', 24, [2, 3, 6]);
  const pt3 = inv24.points.find((p) => p.x === 3);
  check('Inverse proportion 24 L in 3 bottles gives 8 L/bottle', pt3?.y === 8);

  // 12. y = 2x + 3 is NOT directly proportional
  const nonProp = analyzeProportionalRelation('NON_PROPORTIONAL_LINEAR', 2);
  check(
    'y = 2x + 3 is identified as NOT directly proportional',
    nonProp.isProportional === false
  );

  // 13. Rejects a:0 and 0:0
  const rZeroZero = evaluateRatioFromCounts(0, 0, 'BLUE_TO_YELLOW');
  const rThreeZero = evaluateRatioFromCounts(3, 0, 'BLUE_TO_YELLOW');
  const rZeroThree = evaluateRatioFromCounts(0, 3, 'BLUE_TO_YELLOW');
  check(
    'Rejects 0:0 and a:0 while allowing 0:b (b > 0)',
    rZeroZero.status === 'UNDEFINED_ZERO_ZERO' &&
      rThreeZero.status === 'INVALID_ZERO_CONSEQUENT' &&
      rZeroThree.status === 'VALID' &&
      rZeroThree.antecedent === 0
  );

  // 14. Same ratio with different total volumes produces identical conventional color
  const col23 = computeConventionalMixColor(2, 3);
  const col46 = computeConventionalMixColor(4, 6);
  const col69 = computeConventionalMixColor(6, 9);
  check(
    'Same ratio (2:3, 4:6, 6:9) produces identical conventional color hex',
    col23.hex === col46.hex && col46.hex === col69.hex
  );

  // 15. Task bank has 48 tasks (8 per activity × 6 activities)
  const counts = M18_ACTIVITY_METADATA.map(
    (m) => getM18TasksByActivity(m.id).length
  );
  check(
    'M18 task bank has 48 tasks (8 per activity across all 6 activities)',
    M18_TASK_BANK.length === 48 && counts.every((c) => c === 8)
  );

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
