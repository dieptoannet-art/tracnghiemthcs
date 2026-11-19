// ============================================================================
// TÂY ĐÔ SMART EDU – SMART MATH LAB (TOÁN 6 & 7 GDPT 2018)
// M05: KHÁM PHÁ PHÂN SỐ (FRACTION DISCOVERY ENGINE)
// Pure Mathematical & Pedagogical Engine – Zero UI / DOM Dependencies
// ============================================================================

export type M05ActivityId =
  | 'EQUAL_PARTS'
  | 'BUILD_READ_FRACTION'
  | 'EQUIVALENT_FRACTIONS'
  | 'COMPARE_FRACTIONS'
  | 'FRACTION_NUMBER_LINE'
  | 'ADD_SUB_FRACTIONS';

export type M05Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type M05CompareOperator = '<' | '=' | '>';

export type M05ShapeModel = 'CIRCLE' | 'RECTANGLE' | 'STRIP';

/**
 * Preserves the exact unsimplified numerator and denominator for visual teaching,
 * while guaranteeing integer numerator and non-zero integer denominator.
 */
export interface RawFraction {
  num: number;
  den: number;
}

export interface MixedFractionRepresentation {
  isNegative: boolean;
  whole: number;
  remNum: number;
  den: number;
  displayText: string;
}

export interface FractionSimplificationResult {
  original: RawFraction;
  normalized: RawFraction;
  simplified: RawFraction;
  gcdValue: number;
  isAlreadySimplified: boolean;
  stepsVi: string[];
}

export interface FractionAddSubCalculation {
  a: RawFraction;
  b: RawFraction;
  op: '+' | '-';
  isSameDenominator: boolean;
  commonDen: number;
  multiplierA: number;
  multiplierB: number;
  expandedA: RawFraction;
  expandedB: RawFraction;
  unsimplifiedResult: RawFraction;
  simplifiedResult: RawFraction;
  gcdUsed: number;
  mixedResult: MixedFractionRepresentation | null;
  isNegativeResult: boolean;
  canUseAreaModel: boolean;
  stepsVi: {
    stepNumber: 1 | 2 | 3 | 4 | 5;
    title: string;
    detail: string;
  }[];
}

export interface FractionValidationOutcome {
  status: 'CORRECT' | 'EQUIVALENT_UNSIMPLIFIED' | 'INVALID_ZERO_DEN' | 'INCORRECT';
  messageVi: string;
  normalizedStudent?: RawFraction;
  simplifiedTarget?: RawFraction;
}

export interface M05ActivityMeta {
  id: M05ActivityId;
  number: number;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  thumbnailCaption: string;
}

export interface M05TaskSpec {
  id: string;
  activityId: M05ActivityId;
  difficulty: M05Difficulty;
  title: string;
  prompt: string;
  question: string;
  // Activity-specific preset configuration
  preset: {
    // Activity 1: Equal parts
    shapeModel?: M05ShapeModel;
    totalParts?: number;
    shadedCount?: number;
    isUnequalDemo?: boolean;
    chooseEqualOption?: 'EQUAL' | 'UNEQUAL';
    // Activity 2: Build & Read
    targetFraction?: RawFraction;
    missingPart?: 'NUM' | 'DEN' | 'BOTH';
    // Activity 3: Equivalent Fractions
    baseFraction?: RawFraction;
    scaleFactorK?: number;
    targetDen?: number;
    targetNum?: number;
    requireSimplified?: boolean;
    // Activity 4: Compare Fractions
    compareLeft?: RawFraction;
    compareRight?: RawFraction;
    sortList?: RawFraction[];
    sortOrder?: 'ASC' | 'DESC';
    // Activity 5: Fraction on Number Line
    nlSubdivisions?: number;
    nlTarget?: RawFraction;
    nlShowNegative?: boolean;
    // Activity 6: Add & Subtract Fractions
    addSubA?: RawFraction;
    addSubB?: RawFraction;
    addSubOp?: '+' | '-';
    addSubTab?: 'SAME_DEN' | 'DIFF_DEN';
  };
  answerType: 'FRACTION' | 'INTEGER' | 'OPERATOR' | 'CHOICE' | 'SORT_LIST';
  expectedFraction?: RawFraction;
  requireSimplified?: boolean;
  expectedInteger?: number;
  expectedOperator?: M07OrM05Op;
  expectedChoice?: string;
  choiceOptions?: string[];
  expectedSortStrings?: string[];
  hints: [string, string, string]; // 3 levels: Observe -> Action -> Step-by-step
  explanationVi: string;
}

type M07OrM05Op = '<' | '=' | '>';

export const M05_ACTIVITY_METADATA: M05ActivityMeta[] = [
  {
    id: 'EQUAL_PARTS',
    number: 1,
    shortTitle: 'Chia phần bằng nhau',
    fullTitle: 'Chia một đơn vị thành các phần bằng nhau',
    subtitle: 'Nhận biết các phần có diện tích bằng nhau mới biểu diễn phân số 1/b của đơn vị',
    thumbnailCaption: 'Hình tròn chia phần',
  },
  {
    id: 'BUILD_READ_FRACTION',
    number: 2,
    shortTitle: 'Tạo và đọc phân số',
    fullTitle: 'Tạo, đọc phân số và hỗn số từ các mảnh đơn vị',
    subtitle: 'Hiểu ý nghĩa tử số, mẫu số và biểu diễn phân số lớn hơn 1 bằng nhiều khung đơn vị bằng nhau',
    thumbnailCaption: 'Các mảnh phân số',
  },
  {
    id: 'EQUIVALENT_FRACTIONS',
    number: 3,
    shortTitle: 'Phân số bằng nhau',
    fullTitle: 'Cùng một lượng, nhiều cách chia',
    subtitle: 'Nhân hoặc chia cả tử và mẫu cho cùng một số tự nhiên khác 0 mà độ dài phần tô không đổi',
    thumbnailCaption: 'Các thanh bằng nhau',
  },
  {
    id: 'COMPARE_FRACTIONS',
    number: 4,
    shortTitle: 'So sánh phân số',
    fullTitle: 'So sánh và sắp xếp các phân số cùng đơn vị',
    subtitle: 'So sánh phân số cùng mẫu, cùng tử dương, khác mẫu (quy đồng) và đối chiếu trên trục số',
    thumbnailCaption: 'So sánh phân số',
  },
  {
    id: 'FRACTION_NUMBER_LINE',
    number: 5,
    shortTitle: 'Phân số trên trục số',
    fullTitle: 'Biểu diễn phân số, hỗn số và phân số âm trên trục số',
    subtitle: 'Chia đoạn đơn vị [0; 1] thành b khoảng bằng nhau (b + 1 mốc) và đặt đúng tọa độ a/b',
    thumbnailCaption: 'Trục số',
  },
  {
    id: 'ADD_SUB_FRACTIONS',
    number: 6,
    shortTitle: 'Cộng, trừ phân số',
    fullTitle: 'Cộng, trừ phân số cùng mẫu và khác mẫu',
    subtitle: 'Quy đồng về cùng đơn vị chia trước khi ghép hoặc bớt các mảnh phân số',
    thumbnailCaption: 'Các dải phân số ghép lại',
  },
];

// ============================================================================
// 1. EXACT INTEGER & RATIONAL ARITHMETIC CORE (NO FLOATING-POINT EQUALITY)
// ============================================================================

export function cleanInt(val: number): number {
  if (!Number.isFinite(val)) return 0;
  const t = Math.round(val);
  return Object.is(t, -0) ? 0 : t;
}

export function gcdInt(a: number, b: number): number {
  let x = Math.abs(cleanInt(a));
  let y = Math.abs(cleanInt(b));
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x === 0 ? 1 : x;
}

export function lcmInt(a: number, b: number): number {
  const x = Math.abs(cleanInt(a));
  const y = Math.abs(cleanInt(b));
  if (x === 0 || y === 0) return 0;
  return cleanInt((x / gcdInt(x, y)) * y);
}

/**
 * Validates whether a denominator is non-zero integer within safe bounds.
 */
export function isValidDenominator(den: number): boolean {
  return Number.isFinite(den) && cleanInt(den) !== 0;
}

/**
 * Normalizes sign so denominator > 0, while keeping the magnitude of numerator & denominator
 * (unless normalizeZeroToUnitDen = true, which turns 0/b into 0/1).
 */
export function normalizeFractionSign(
  f: RawFraction,
  normalizeZeroToUnitDen: boolean = false
): RawFraction {
  const rawN = cleanInt(f.num);
  const rawD = cleanInt(f.den);
  if (rawD === 0) {
    throw new Error('Mẫu số phải khác 0.');
  }
  const sign = rawD < 0 ? -1 : 1;
  const num = cleanInt(sign * rawN);
  const den = cleanInt(Math.abs(rawD));
  if (num === 0 && normalizeZeroToUnitDen) {
    return { num: 0, den: 1 };
  }
  return { num, den };
}

/**
 * Reduces a fraction to its canonical irreducible form with positive denominator
 * and 0/b -> 0/1.
 */
export function simplifyFraction(f: RawFraction): FractionSimplificationResult {
  const normalized = normalizeFractionSign(f, false);
  if (normalized.num === 0) {
    return {
      original: { num: cleanInt(f.num), den: cleanInt(f.den) },
      normalized,
      simplified: { num: 0, den: 1 },
      gcdValue: normalized.den,
      isAlreadySimplified: normalized.den === 1,
      stepsVi: [
        `Tử số bằng 0 nên phân số ${normalized.num}/${normalized.den} có giá trị bằng 0 (chuẩn hóa thành 0/1).`,
      ],
    };
  }

  const g = gcdInt(normalized.num, normalized.den);
  const simpNum = cleanInt(normalized.num / g);
  const simpDen = cleanInt(normalized.den / g);
  const isAlreadySimplified = g === 1 && f.den > 0;

  const stepsVi: string[] = [];
  if (f.den < 0) {
    stepsVi.push(
      `Đổi dấu để mẫu số dương: ${f.num}/${f.den} = ${normalized.num}/${normalized.den}.`
    );
  }
  if (g > 1) {
    stepsVi.push(
      `ƯCLN(|${normalized.num}|, ${normalized.den}) = ${g}. Chia cả tử và mẫu cho ${g}: (${normalized.num} : ${g}) / (${normalized.den} : ${g}) = ${simpNum}/${simpDen}.`
    );
  } else {
    stepsVi.push(
      `ƯCLN(|${normalized.num}|, ${normalized.den}) = 1 nên phân số ${normalized.num}/${normalized.den} đã tối giản.`
    );
  }

  return {
    original: { num: cleanInt(f.num), den: cleanInt(f.den) },
    normalized,
    simplified: { num: simpNum, den: simpDen },
    gcdValue: g,
    isAlreadySimplified,
    stepsVi,
  };
}

/**
 * Exact cross-multiplication equality check: a/b = c/d iff a * d = c * b.
 * Never uses floating-point division!
 */
export function areFractionsEqual(f1: RawFraction, f2: RawFraction): boolean {
  if (!isValidDenominator(f1.den) || !isValidDenominator(f2.den)) return false;
  const n1 = normalizeFractionSign(f1, true);
  const n2 = normalizeFractionSign(f2, true);
  return cleanInt(n1.num * n2.den) === cleanInt(n2.num * n1.den);
}

/**
 * Exact cross-multiplication comparison after normalizing denominators to be positive:
 * a/b vs c/d (with b > 0, d > 0) compares a * d vs c * b.
 */
export function compareExactFractions(f1: RawFraction, f2: RawFraction): M05CompareOperator {
  const n1 = normalizeFractionSign(f1, true);
  const n2 = normalizeFractionSign(f2, true);
  const lhs = cleanInt(n1.num * n2.den);
  const rhs = cleanInt(n2.num * n1.den);
  if (lhs < rhs) return '<';
  if (lhs > rhs) return '>';
  return '=';
}

export function sortExactFractions(
  list: RawFraction[],
  order: 'ASC' | 'DESC' = 'ASC'
): RawFraction[] {
  return [...list].sort((a, b) => {
    const cmp = compareExactFractions(a, b);
    if (cmp === '=') return 0;
    if (order === 'ASC') return cmp === '<' ? -1 : 1;
    return cmp === '>' ? -1 : 1;
  });
}

/**
 * Subdivides each part into k equal sub-parts: a/b = (a*k)/(b*k).
 */
export function expandFractionByK(f: RawFraction, k: number): RawFraction {
  const cleanK = Math.max(1, Math.min(12, cleanInt(k)));
  const norm = normalizeFractionSign(f, false);
  return {
    num: cleanInt(norm.num * cleanK),
    den: cleanInt(norm.den * cleanK),
  };
}

/**
 * Attempts to coalesce/merge every m small parts into 1 larger part:
 * Only valid when both numerator and denominator are divisible by m!
 */
export function coalesceFractionByM(
  f: RawFraction,
  m: number
): {
  canCoalesce: boolean;
  result: RawFraction;
  reasonVi: string;
} {
  const norm = normalizeFractionSign(f, false);
  const cleanM = Math.max(1, cleanInt(m));
  if (cleanM <= 1) {
    return {
      canCoalesce: true,
      result: norm,
      reasonVi: 'Hệ số gộp bằng 1 nên giữ nguyên phân số.',
    };
  }
  const numDivisible = norm.num % cleanM === 0;
  const denDivisible = norm.den % cleanM === 0;

  if (!numDivisible || !denDivisible) {
    return {
      canCoalesce: false,
      result: norm,
      reasonVi: !denDivisible
        ? `Không thể ghép mỗi ${cleanM} phần vì mẫu số ${norm.den} không chia hết cho ${cleanM} (các phần mới sẽ không bằng nhau).`
        : `Không thể ghép mỗi ${cleanM} phần vì số phần đang tô (${norm.num}) không chia hết cho ${cleanM} (lượng tô không khớp đúng vạch chia mới).`,
    };
  }

  return {
    canCoalesce: true,
    result: {
      num: cleanInt(norm.num / cleanM),
      den: cleanInt(norm.den / cleanM),
    },
    reasonVi: `Ghép mỗi ${cleanM} phần nhỏ thành 1 phần lớn hơn: (${norm.num} : ${cleanM}) / (${norm.den} : ${cleanM}) = ${
      norm.num / cleanM
    }/${norm.den / cleanM}.`,
  };
}

/**
 * Converts an improper fraction (|num| > den and num % den !== 0) to mixed representation.
 * For negative fractions like -7/4, explicitly formats as -(1 3/4) so the minus sign applies to the whole mixed number.
 */
export function toMixedNumber(f: RawFraction): MixedFractionRepresentation | null {
  if (!isValidDenominator(f.den)) return null;
  const norm = normalizeFractionSign(f, false);
  const absNum = Math.abs(norm.num);
  const den = norm.den;
  if (absNum < den) return null;
  const whole = Math.floor(absNum / den);
  const remNum = absNum % den;
  const isNegative = norm.num < 0;

  if (remNum === 0) {
    const signedWhole = isNegative ? -whole : whole;
    return {
      isNegative,
      whole,
      remNum: 0,
      den,
      displayText: `${signedWhole}`,
    };
  }

  const displayText = isNegative
    ? `-(${whole} và ${remNum}/${den})`
    : `${whole} ${remNum}/${den}`;

  return {
    isNegative,
    whole,
    remNum,
    den,
    displayText,
  };
}

/**
 * Converts a structured mixed number input (sign, whole >= 0, remNum >= 0, den > 0)
 * into an exact RawFraction without ambiguous string parsing.
 */
export function fromMixedNumberInput(
  isNegative: boolean,
  whole: number,
  remNum: number,
  den: number
): RawFraction {
  const cleanDen = cleanInt(den);
  if (cleanDen <= 0) {
    throw new Error('Mẫu số của phần phân số phải là số nguyên dương.');
  }
  const cleanWhole = Math.max(0, cleanInt(whole));
  const cleanRem = Math.max(0, cleanInt(remNum));
  const totalAbsNum = cleanWhole * cleanDen + cleanRem;
  return {
    num: isNegative ? -totalAbsNum : totalAbsNum,
    den: cleanDen,
  };
}

// ============================================================================
// 2. VIETNAMESE READING & PEDAGOGICAL EXPLANATION HELPERS
// ============================================================================

const VI_DIGITS: Record<number, string> = {
  0: 'không',
  1: 'một',
  2: 'hai',
  3: 'ba',
  4: 'bốn',
  5: 'năm',
  6: 'sáu',
  7: 'bảy',
  8: 'tám',
  9: 'chín',
  10: 'mười',
  11: 'mười một',
  12: 'mười hai',
  13: 'mười ba',
  14: 'mười bốn',
  15: 'mười lăm',
  16: 'mười sáu',
  17: 'mười bảy',
  18: 'mười tám',
  19: 'mười chín',
  20: 'hai mươi',
  21: 'hai mươi mốt',
  22: 'hai mươi hai',
  23: 'hai mươi ba',
  24: 'hai mươi tư',
};

export function numberToVietnameseWords(n: number): string {
  const clean = cleanInt(n);
  if (clean < 0) return `âm ${numberToVietnameseWords(-clean)}`;
  if (VI_DIGITS[clean]) return VI_DIGITS[clean];
  if (clean < 100) {
    const tens = Math.floor(clean / 10);
    const units = clean % 10;
    const tensWord = `${VI_DIGITS[tens]} mươi`;
    if (units === 0) return tensWord;
    if (units === 1) return `${tensWord} mốt`;
    if (units === 4) return `${tensWord} tư`;
    if (units === 5) return `${tensWord} lăm`;
    return `${tensWord} ${VI_DIGITS[units]}`;
  }
  return `${clean}`;
}

export function readFractionInVietnamese(f: RawFraction): string {
  if (!isValidDenominator(f.den)) return 'Phân số không hợp lệ (mẫu số bằng 0)';
  const norm = normalizeFractionSign(f, false);
  const numWords = numberToVietnameseWords(norm.num);
  const denWords =
    norm.den === 4 ? 'tư (hoặc bốn)' : numberToVietnameseWords(norm.den);
  const baseRead = `${numWords} phần ${denWords}`;

  if (norm.num === 0) {
    return `${baseRead} (có giá trị bằng 0)`;
  }
  if (Math.abs(norm.num) === norm.den) {
    const val = norm.num / norm.den;
    return `${baseRead} (bằng ${val} đơn vị trọn vẹn)`;
  }
  if (Math.abs(norm.num) > norm.den) {
    const mixed = toMixedNumber(norm);
    if (mixed && mixed.remNum > 0) {
      return `${baseRead} — Hỗn số: ${
        mixed.isNegative ? 'âm ' : ''
      }${numberToVietnameseWords(mixed.whole)} và ${numberToVietnameseWords(
        mixed.remNum
      )} phần ${norm.den === 4 ? 'tư' : numberToVietnameseWords(norm.den)}`;
    }
  }
  return baseRead;
}

export function formatFractionString(f: RawFraction): string {
  const norm = normalizeFractionSign(f, false);
  return `${norm.num}/${norm.den}`;
}

export function explainFractionComparisonVi(f1: RawFraction, f2: RawFraction): string {
  const n1 = normalizeFractionSign(f1, false);
  const n2 = normalizeFractionSign(f2, false);
  const op = compareExactFractions(n1, n2);

  if (n1.den === n2.den) {
    return `Hai phân số ${n1.num}/${n1.den} và ${n2.num}/${n2.den} có cùng mẫu số dương là ${n1.den}. Vì ${n1.num} ${op} ${n2.num} nên ${n1.num}/${n1.den} ${op} ${n2.num}/${n2.den}.`;
  }

  if (n1.num > 0 && n2.num > 0 && n1.num === n2.num) {
    return `Hai phân số dương ${n1.num}/${n1.den} và ${n2.num}/${n2.den} có cùng tử số là ${n1.num}. Khi chia cùng một đơn vị, mẫu số càng nhỏ thì mỗi phần càng lớn (${n1.den} ${
      n1.den < n2.den ? '<' : '>'
    } ${n2.den}) nên ${n1.num}/${n1.den} ${op} ${n2.num}/${n2.den}.`;
  }

  const commonDen = lcmInt(n1.den, n2.den);
  const m1 = cleanInt(commonDen / n1.den);
  const m2 = cleanInt(commonDen / n2.den);
  const eq1 = cleanInt(n1.num * m1);
  const eq2 = cleanInt(n2.num * m2);

  return `Quy đồng mẫu số chung BCNN(${n1.den}, ${n2.den}) = ${commonDen}: ${n1.num}/${n1.den} = ${eq1}/${commonDen} và ${n2.num}/${n2.den} = ${eq2}/${commonDen}. Vì ${eq1} ${op} ${eq2} nên ${n1.num}/${n1.den} ${op} ${n2.num}/${n2.den}.`;
}

// ============================================================================
// 3. FRACTION ADDITION & SUBTRACTION ENGINE (ACTIVITY 6)
// ============================================================================

export function computeFractionAddSub(
  rawA: RawFraction,
  op: '+' | '-',
  rawB: RawFraction
): FractionAddSubCalculation {
  const a = normalizeFractionSign(rawA, false);
  const b = normalizeFractionSign(rawB, false);
  const isSameDenominator = a.den === b.den;
  const commonDen = isSameDenominator ? a.den : lcmInt(a.den, b.den);
  const multiplierA = cleanInt(commonDen / a.den);
  const multiplierB = cleanInt(commonDen / b.den);

  const expandedA: RawFraction = {
    num: cleanInt(a.num * multiplierA),
    den: commonDen,
  };
  const expandedB: RawFraction = {
    num: cleanInt(b.num * multiplierB),
    den: commonDen,
  };

  const resultNum =
    op === '+'
      ? cleanInt(expandedA.num + expandedB.num)
      : cleanInt(expandedA.num - expandedB.num);

  const unsimplifiedResult: RawFraction = {
    num: resultNum,
    den: commonDen,
  };

  const simpInfo = simplifyFraction(unsimplifiedResult);
  const simplifiedResult = simpInfo.simplified;
  const mixedResult = toMixedNumber(simplifiedResult);
  const isNegativeResult = resultNum < 0;

  // Area strip model is clear and non-misleading when commonDen <= 24 and non-negative
  const canUseAreaModel =
    commonDen <= 24 && a.num >= 0 && b.num >= 0 && !isNegativeResult;

  const stepsVi: FractionAddSubCalculation['stepsVi'] = [
    {
      stepNumber: 1,
      title: 'Biểu diễn hai phân số trên cùng kích thước đơn vị',
      detail: `Phân số thứ nhất là ${a.num}/${a.den}, phân số thứ hai là ${b.num}/${b.den}. Không cộng/trừ trực tiếp tử với tử, mẫu với mẫu khi kích thước mỗi phần chưa bằng nhau.`,
    },
    {
      stepNumber: 2,
      title: isSameDenominator
        ? `Giữ nguyên mẫu số chung là ${commonDen}`
        : `Quy đồng mẫu số chung BCNN(${a.den}, ${b.den}) = ${commonDen}`,
      detail: isSameDenominator
        ? `Hai phân số đã cùng chia đơn vị thành ${commonDen} phần bằng nhau.`
        : `Chia nhỏ mỗi đơn vị thành ${commonDen} phần bằng nhau: ${a.num}/${a.den} = ${expandedA.num}/${commonDen} (nhân cả tử và mẫu với ${multiplierA}); ${b.num}/${b.den} = ${expandedB.num}/${commonDen} (nhân cả tử và mẫu với ${multiplierB}).`,
    },
    {
      stepNumber: 3,
      title: 'Giữ nguyên lượng biểu diễn của từng phân số',
      detail: `${a.num}/${a.den} ứng với ${expandedA.num} phần (mỗi phần 1/${commonDen}); ${b.num}/${b.den} ứng với ${expandedB.num} phần (mỗi phần 1/${commonDen}).`,
    },
    {
      stepNumber: 4,
      title:
        op === '+'
          ? `Ghép các phần cùng mẫu 1/${commonDen}`
          : `Bớt các phần cùng mẫu 1/${commonDen}`,
      detail: `${expandedA.num}/${commonDen} ${op} ${expandedB.num}/${commonDen} = (${expandedA.num} ${op} ${expandedB.num})/${commonDen} = ${unsimplifiedResult.num}/${unsimplifiedResult.den}.${
        isNegativeResult
          ? ' Vì kết quả âm nên ta biểu diễn bằng bước lùi sang trái điểm 0 trên trục số (không dùng diện tích âm).'
          : ''
      }`,
    },
    {
      stepNumber: 5,
      title: 'Rút gọn kết quả về tối giản',
      detail:
        simpInfo.gcdValue > 1 && unsimplifiedResult.num !== 0
          ? `Rút gọn ${unsimplifiedResult.num}/${unsimplifiedResult.den} bằng cách chia cả tử và mẫu cho ƯCLN = ${simpInfo.gcdValue} ta được ${simplifiedResult.num}/${simplifiedResult.den}${
              mixedResult && mixedResult.remNum > 0
                ? ` (hỗn số: ${mixedResult.displayText})`
                : ''
            }.`
          : unsimplifiedResult.num === 0
          ? `Tử số bằng 0 nên kết quả bằng 0.`
          : `Kết quả ${simplifiedResult.num}/${simplifiedResult.den} đã là phân số tối giản${
              mixedResult && mixedResult.remNum > 0
                ? ` (hỗn số: ${mixedResult.displayText})`
                : ''
            }.`,
    },
  ];

  return {
    a,
    b,
    op,
    isSameDenominator,
    commonDen,
    multiplierA,
    multiplierB,
    expandedA,
    expandedB,
    unsimplifiedResult,
    simplifiedResult,
    gcdUsed: simpInfo.gcdValue,
    mixedResult,
    isNegativeResult,
    canUseAreaModel,
    stepsVi,
  };
}

// ============================================================================
// 4. NUMBER LINE COORDINATE MAPPING FOR FRACTIONS (ACTIVITY 5)
// ============================================================================

export interface FractionNumberLineViewport {
  minInt: number; // e.g., 0 or -2
  maxInt: number; // e.g., 2
  subdivisionsPerUnit: number; // b intervals per unit [k, k+1] -> b+1 tick marks per unit
  leftPx: number;
  rightPx: number;
}

/**
 * Exact orthographic mapping from a rational number a/b to SVG x coordinate.
 * Guarantees equal distance between consecutive integers and exact fractional placement
 * without rounding to nearby ticks.
 */
export function fractionToSvgX(
  f: RawFraction,
  vp: FractionNumberLineViewport
): number {
  const norm = normalizeFractionSign(f, false);
  const spanInt = vp.maxInt - vp.minInt;
  if (spanInt <= 0) return vp.leftPx;
  const widthPx = vp.rightPx - vp.leftPx;
  // Use exact numerator / (den * spanInt) ratio
  const offsetFromMin = (norm.num - vp.minInt * norm.den) / (norm.den * spanInt);
  return vp.leftPx + offsetFromMin * widthPx;
}

/**
 * Snaps an SVG x coordinate to the nearest tick mark of step 1 / subdivisionsPerUnit.
 */
export function svgXToSnappedFraction(
  svgX: number,
  vp: FractionNumberLineViewport
): RawFraction {
  const spanInt = vp.maxInt - vp.minInt;
  const b = Math.max(1, cleanInt(vp.subdivisionsPerUnit));
  const widthPx = vp.rightPx - vp.leftPx;
  if (widthPx <= 0 || spanInt <= 0) return { num: 0, den: b };

  const clampedX = Math.max(vp.leftPx, Math.min(vp.rightPx, svgX));
  const ratio = (clampedX - vp.leftPx) / widthPx;
  const minSubTicks = vp.minInt * b;
  const maxSubTicks = vp.maxInt * b;
  const totalSubIntervals = spanInt * b;
  const snappedTickNum = Math.max(
    minSubTicks,
    Math.min(maxSubTicks, Math.round(minSubTicks + ratio * totalSubIntervals))
  );
  return {
    num: cleanInt(snappedTickNum),
    den: b,
  };
}

// ============================================================================
// 5. STUDENT ANSWER VALIDATOR (SUPPORTS EQUIVALENT VS IRREDUCIBLE & MIXED INPUT)
// ============================================================================

export function validateStudentFractionSubmission(
  studentInput: RawFraction,
  target: RawFraction,
  requireSimplified: boolean = false
): FractionValidationOutcome {
  const rawN = cleanInt(studentInput.num);
  const rawD = cleanInt(studentInput.den);

  if (!Number.isFinite(studentInput.den) || rawD === 0) {
    return {
      status: 'INVALID_ZERO_DEN',
      messageVi:
        'Mẫu số không được bằng 0! Một đơn vị luôn phải được chia thành ít nhất 1 phần bằng nhau.',
    };
  }

  const normStudent = normalizeFractionSign({ num: rawN, den: rawD }, false);
  const simpTarget = simplifyFraction(target).simplified;

  if (!areFractionsEqual(normStudent, target)) {
    return {
      status: 'INCORRECT',
      messageVi: `Phân số ${normStudent.num}/${normStudent.den} chưa bằng với giá trị yêu cầu. Hãy quan sát lại số phần được tô và tổng số phần của 1 đơn vị.`,
      normalizedStudent: normStudent,
      simplifiedTarget: simpTarget,
    };
  }

  if (requireSimplified) {
    const simpStudent = simplifyFraction(normStudent);
    const isReduced =
      (normStudent.num === 0 && normStudent.den === 1) ||
      (simpStudent.gcdValue === 1 && rawD > 0);

    if (!isReduced) {
      return {
        status: 'EQUIVALENT_UNSIMPLIFIED',
        messageVi: `Đúng giá trị lượng phân số (${normStudent.num}/${normStudent.den} = ${simpTarget.num}/${simpTarget.den}), nhưng đề bài yêu cầu phân số tối giản! Hãy chia cả tử và mẫu cho ƯCLN = ${simpStudent.gcdValue}.`,
        normalizedStudent: normStudent,
        simplifiedTarget: simpTarget,
      };
    }
  }

  return {
    status: 'CORRECT',
    messageVi: `Chính xác! ${normStudent.num}/${normStudent.den} biểu diễn đúng lượng yêu cầu.`,
    normalizedStudent: normStudent,
    simplifiedTarget: simpTarget,
  };
}

// ============================================================================
// 6. STRUCTURED 48-TASK BANK (8 TASKS PER ACTIVITY × 6 ACTIVITIES)
// ============================================================================

export const M05_TASK_BANK: M05TaskSpec[] = [
  // --------------------------------------------------------------------------
  // ACTIVITY 1: CHIA PHẦN BẰNG NHAU (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act1_t1',
    activityId: 'EQUAL_PARTS',
    difficulty: 'EASY',
    title: 'Chia hình tròn thành 4 phần bằng nhau (3/4)',
    prompt: 'Chia một hình tròn thành 4 phần bằng nhau và tô màu 3 phần.',
    question: 'Phân số biểu diễn 3 phần được tô trên hình tròn chia 4 phần bằng nhau là gì?',
    preset: { shapeModel: 'CIRCLE', totalParts: 4, shadedCount: 3, isUnequalDemo: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 4 },
    hints: [
      'Đếm tổng số phần bằng nhau của cả hình tròn để biết mẫu số.',
      'Đếm số phần đã được tô màu xanh để biết tử số.',
      'Hình tròn chia 4 phần bằng nhau (mẫu số = 4), tô 3 phần (tử số = 3) nên phân số là 3/4.',
    ],
    explanationVi:
      'Một hình tròn được chia thành 4 hình quạt có góc ở tâm bằng nhau (90°), tô màu 3 phần nên biểu diễn đúng phân số 3/4.',
  },
  {
    id: 'm05_act1_t2',
    activityId: 'EQUAL_PARTS',
    difficulty: 'EASY',
    title: 'Nhận biết hình chia đều và chia không đều',
    prompt: 'Bật chế độ đối chiếu "Hình chia đều vs Chia không đều" trên sân khấu với 4 mảnh.',
    question:
      'Nếu chia một hình chữ nhật thành 4 mảnh nhưng diện tích các mảnh KHÔNG bằng nhau, tô 1 mảnh có biểu diễn đúng 1/4 không?',
    preset: { shapeModel: 'RECTANGLE', totalParts: 4, shadedCount: 1, isUnequalDemo: true },
    answerType: 'CHOICE',
    expectedChoice: 'Không, vì 4 mảnh không có diện tích bằng nhau',
    choiceOptions: [
      'Không, vì 4 mảnh không có diện tích bằng nhau',
      'Có, cứ có 4 mảnh và tô 1 mảnh là 1/4',
      'Có, nếu mảnh được tô nằm ở ngoài cùng',
    ],
    hints: [
      'So sánh chiều rộng và diện tích của các mảnh trong hình chia lệch.',
      'Nhớ lại định nghĩa: Mẫu số b chỉ có nghĩa khi đơn vị được chia thành b phần BẰNG NHAU.',
      'Vì các mảnh có diện tích lớn nhỏ khác nhau nên mỗi mảnh không phải là 1/4 của đơn vị.',
    ],
    explanationVi:
      'Không thể chỉ đếm số miếng! Phân số 1/b chỉ đúng khi đơn vị được chia thành b phần có diện tích bằng nhau tuyệt đối.',
  },
  {
    id: 'm05_act1_t3',
    activityId: 'EQUAL_PARTS',
    difficulty: 'EASY',
    title: 'Chia dải phân số thành 6 phần bằng nhau (5/6)',
    prompt: 'Chọn mô hình Dải phân số, chia thành 6 phần bằng nhau và tô màu 5 phần.',
    question: 'Phân số biểu diễn phần đã tô của dải phân số là bao nhiêu?',
    preset: { shapeModel: 'STRIP', totalParts: 6, shadedCount: 5, isUnequalDemo: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 5, den: 6 },
    hints: [
      'Quan sát dải đơn vị được chia thành mấy ô bằng nhau.',
      'Đếm số ô màu xanh ngọc được tô.',
      'Có 5 ô được tô trên tổng số 6 ô bằng nhau nên phân số là 5/6.',
    ],
    explanationVi: 'Dải đơn vị chia thành 6 phần có chiều dài bằng nhau, lấy 5 phần ta được phân số 5/6.',
  },
  {
    id: 'm05_act1_t4',
    activityId: 'EQUAL_PARTS',
    difficulty: 'MEDIUM',
    title: 'Phần chưa tô màu của hình chữ nhật (3/8)',
    prompt: 'Một hình chữ nhật chia thành 8 phần bằng nhau, đã tô màu 5 phần.',
    question: 'Phân số chỉ phần CHƯA tô màu của hình chữ nhật đó là bao nhiêu?',
    preset: { shapeModel: 'RECTANGLE', totalParts: 8, shadedCount: 5, isUnequalDemo: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 8 },
    hints: [
      'Đơn vị được chia thành 8 phần bằng nhau, trong đó 5 phần đã tô.',
      'Lấy tổng số phần (8) trừ đi số phần đã tô (5) để tìm số phần chưa tô.',
      'Còn lại 8 - 5 = 3 phần chưa tô trên 8 phần bằng nhau, tức là 3/8.',
    ],
    explanationVi: 'Tổng cộng có 8 phần bằng nhau, đã tô 5 phần (5/8) nên phần chưa tô là 3 phần, biểu diễn bởi 3/8.',
  },
  {
    id: 'm05_act1_t5',
    activityId: 'EQUAL_PARTS',
    difficulty: 'MEDIUM',
    title: 'Một đơn vị nguyên vẹn (6/6)',
    prompt: 'Chia hình tròn thành 6 phần bằng nhau và tô màu cả 6 phần.',
    question: 'Khi tô kín cả 6 phần bằng nhau của hình tròn chia 6, phân số 6/6 bằng mấy đơn vị?',
    preset: { shapeModel: 'CIRCLE', totalParts: 6, shadedCount: 6, isUnequalDemo: false },
    answerType: 'INTEGER',
    expectedInteger: 1,
    hints: [
      'Quan sát xem toàn bộ hình tròn đã được tô kín chưa.',
      'Khi tử số bằng mẫu số (6/6), ta đã lấy trọn vẹn cả hình đơn vị.',
      '6/6 = 1 đơn vị.',
    ],
    explanationVi: 'Chia một đơn vị thành 6 phần bằng nhau và lấy cả 6 phần thì được trọn vẹn 1 đơn vị: 6/6 = 1.',
  },
  {
    id: 'm05_act1_t6',
    activityId: 'EQUAL_PARTS',
    difficulty: 'MEDIUM',
    title: 'Chia 10 phần bằng nhau trên dải phân số (7/10)',
    prompt: 'Chia dải phân số thành 10 phần bằng nhau và tô màu 7 phần.',
    question: 'Nhập phân số biểu diễn 7 phần được tô trong 10 phần bằng nhau.',
    preset: { shapeModel: 'STRIP', totalParts: 10, shadedCount: 7, isUnequalDemo: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 7, den: 10 },
    hints: [
      'Mẫu số là tổng số phần bằng nhau của dải (10).',
      'Tử số là số phần được tô màu (7).',
      'Phân số cần tìm là 7/10.',
    ],
    explanationVi: '7 phần trong 10 phần bằng nhau của một đơn vị tạo thành phân số thập phân 7/10.',
  },
  {
    id: 'm05_act1_t7',
    activityId: 'EQUAL_PARTS',
    difficulty: 'HARD',
    title: 'Chia 12 phần bằng nhau và góc ở tâm hình tròn',
    prompt: 'Chia hình tròn thành 12 phần bằng nhau và tô 5 phần.',
    question: 'Mỗi phần (1/12 hình tròn) có góc ở tâm bằng bao nhiêu độ để đảm bảo 12 phần bằng nhau?',
    preset: { shapeModel: 'CIRCLE', totalParts: 12, shadedCount: 5, isUnequalDemo: false },
    answerType: 'INTEGER',
    expectedInteger: 30,
    hints: [
      'Cả một vòng tròn đầy đủ có tổng số đo góc ở tâm là 360°.',
      'Để 12 hình quạt bằng nhau, ta lấy 360° chia đều cho 12.',
      '360° : 12 = 30°.',
    ],
    explanationVi: 'Hình tròn có góc ở tâm 360°. Chia thành 12 phần bằng nhau thì mỗi phần có góc ở tâm đúng 360° : 12 = 30°.',
  },
  {
    id: 'm05_act1_t8',
    activityId: 'EQUAL_PARTS',
    difficulty: 'HARD',
    title: 'Kiểm tra bẫy chia không đều trên hình tròn',
    prompt: 'Quan sát một hình tròn bị kẻ bằng các đường thẳng song song tạo ra 3 miền có diện tích khác nhau.',
    question: 'Vì sao 1 miền trong 3 miền kẻ song song của hình tròn KHÔNG biểu diễn phân số 1/3?',
    preset: { shapeModel: 'CIRCLE', totalParts: 3, shadedCount: 1, isUnequalDemo: true },
    answerType: 'CHOICE',
    expectedChoice: 'Vì 3 miền có diện tích không bằng nhau',
    choiceOptions: [
      'Vì 3 miền có diện tích không bằng nhau',
      'Vì hình tròn không thể chia thành 3 phần',
      'Vì chỉ được phép chia thành số phần chẵn',
    ],
    hints: [
      'Quan sát hai miền rìa ngoài và miền ở giữa của hình tròn khi kẻ song song.',
      'Miền ở giữa phình to hơn hẳn hai miền rìa.',
      'Để có 1/3 hình tròn, phải chia bằng 3 góc ở tâm bằng nhau (mỗi góc 120°) để diện tích 3 phần bằng nhau.',
    ],
    explanationVi: 'Muốn biểu diễn 1/3 hình tròn, 3 phần phải có diện tích bằng nhau (3 hình quạt góc 120°). Chia bằng các dây cung song song làm diện tích các phần không bằng nhau.',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 2: TẠO VÀ ĐỌC PHÂN SỐ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act2_t1',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'EASY',
    title: 'Tạo và đọc phân số 3/5',
    prompt: 'Điều chỉnh Tử số = 3 và Mẫu số = 5 trên khung đơn vị.',
    question: 'Phân số có tử số 3, mẫu số 5 được viết là gì?',
    preset: { targetFraction: { num: 3, den: 5 }, shapeModel: 'STRIP' },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 5 },
    hints: [
      'Mẫu số (5) cho biết 1 đơn vị chia thành 5 phần bằng nhau.',
      'Tử số (3) cho biết số phần được lấy.',
      'Nhập Tử số = 3, Mẫu số = 5 (đọc là: ba phần năm).',
    ],
    explanationVi: 'Phân số 3/5 đọc là "ba phần năm", gồm mẫu số 5 (chia đơn vị thành 5 phần bằng nhau) và tử số 3 (lấy 3 phần).',
  },
  {
    id: 'm05_act2_t2',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'EASY',
    title: 'Phân số bằng 0 (0/5)',
    prompt: 'Đặt Tử số = 0 và Mẫu số = 5 (không tô phần nào trên dải chia 5).',
    question: 'Phân số 0/5 có giá trị bằng bao nhiêu?',
    preset: { targetFraction: { num: 0, den: 5 }, shapeModel: 'STRIP' },
    answerType: 'INTEGER',
    expectedInteger: 0,
    hints: [
      'Đơn vị chia thành 5 phần bằng nhau nhưng lấy 0 phần.',
      'Không có phần nào được lấy nghĩa là lượng bằng 0.',
      '0/5 = 0.',
    ],
    explanationVi: 'Mọi phân số có tử số bằng 0 và mẫu số khác 0 (0/b với b ≠ 0) đều có giá trị bằng 0.',
  },
  {
    id: 'm05_act2_t3',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'EASY',
    title: 'Phân số bằng 1 đơn vị (4/4)',
    prompt: 'Lấy đủ 4 mảnh 1/4 ghép kín một khung đơn vị.',
    question: 'Phân số biểu diễn 4 mảnh 1/4 ghép đầy 1 khung đơn vị là phân số nào (dạng tử/mẫu = 4/4)?',
    preset: { targetFraction: { num: 4, den: 4 }, shapeModel: 'CIRCLE' },
    answerType: 'FRACTION',
    expectedFraction: { num: 4, den: 4 },
    hints: [
      'Mỗi mảnh là 1/4 của khung đơn vị.',
      'Lấy 4 mảnh 1/4 ta có tử số = 4, mẫu số = 4.',
      'Phân số là 4/4 (có giá trị bằng 1 đơn vị).',
    ],
    explanationVi: 'Lấy cả 4 phần trên 4 phần bằng nhau của một đơn vị ta được 4/4 = 1.',
  },
  {
    id: 'm05_act2_t4',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'MEDIUM',
    title: 'Biểu diễn phân số lớn hơn 1: 7/4 = 1 và 3/4',
    prompt: 'Quan sát hai khung đơn vị cùng kích thước: Khung 1 tô đầy (4/4) và Khung 2 tô 3 phần (3/4).',
    question: 'Tổng số phần 1/4 được tô trên cả hai khung đơn vị biểu diễn phân số nào?',
    preset: { targetFraction: { num: 7, den: 4 }, shapeModel: 'STRIP' },
    answerType: 'FRACTION',
    expectedFraction: { num: 7, den: 4 },
    hints: [
      'Lưu ý: Mẫu số là số phần của MỘT đơn vị (4 phần), không phải tổng số phần của hai khung (8).',
      'Đếm tổng số mảnh 1/4 được tô: 4 mảnh ở khung thứ nhất + 3 mảnh ở khung thứ hai = 7 mảnh.',
      '7 mảnh 1/4 tạo thành phân số 7/4 (hay hỗn số 1 và 3/4).',
    ],
    explanationVi:
      'Giữ nguyên kích thước 1 đơn vị chia 4 phần: 1 khung đầy (4/4) cộng thêm 3/4 ở khung thứ hai cho ta 7/4 = 1 3/4 (tuyệt đối không nhầm mẫu số thành 8).',
  },
  {
    id: 'm05_act2_t5',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'MEDIUM',
    title: 'Điền mẫu số còn thiếu cho mô hình 5/8',
    prompt: 'Mô hình hình tròn chia 8 phần bằng nhau, đã tô 5 phần.',
    question: 'Trong phân số 5/? biểu diễn hình vẽ, mẫu số còn thiếu là số mấy?',
    preset: { targetFraction: { num: 5, den: 8 }, missingPart: 'DEN', shapeModel: 'CIRCLE' },
    answerType: 'INTEGER',
    expectedInteger: 8,
    hints: [
      'Mẫu số cho biết một đơn vị được chia thành bao nhiêu phần bằng nhau.',
      'Đếm tổng số hình quạt bằng nhau trong 1 hình tròn đơn vị.',
      'Có tất cả 8 phần bằng nhau nên mẫu số là 8.',
    ],
    explanationVi: 'Mẫu số cho biết một đơn vị được chia thành 8 phần bằng nhau nên mẫu số cần điền là 8.',
  },
  {
    id: 'm05_act2_t6',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'MEDIUM',
    title: 'Điền tử số cho phân số lớn hơn 1 (5/3)',
    prompt: 'Hai hình tròn đơn vị cùng chia 3 phần bằng nhau: Hình 1 tô đủ 3 phần, Hình 2 tô 2 phần.',
    question: 'Tử số của phân số ?/3 biểu diễn hai hình trên là bao nhiêu?',
    preset: { targetFraction: { num: 5, den: 3 }, missingPart: 'NUM', shapeModel: 'CIRCLE' },
    answerType: 'INTEGER',
    expectedInteger: 5,
    hints: [
      'Mỗi phần bằng 1/3 của một hình tròn đơn vị.',
      'Cộng số phần 1/3 ở hình thứ nhất (3) và hình thứ hai (2).',
      '3 + 2 = 5 phần, nên tử số là 5 (phân số 5/3 = 1 2/3).',
    ],
    explanationVi: 'Có 3 phần 1/3 ở đơn vị thứ nhất và 2 phần 1/3 ở đơn vị thứ hai, tổng cộng 5 phần 1/3 nên tử số là 5.',
  },
  {
    id: 'm05_act2_t7',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'HARD',
    title: 'Đổi hỗn số 2 và 1/3 sang phân số',
    prompt: 'Dùng 2 khung đơn vị tô đầy (mỗi khung 3/3) và khung thứ ba tô 1/3.',
    question: 'Hỗn số 2 và 1/3 viết dưới dạng phân số a/b là gì?',
    preset: { targetFraction: { num: 7, den: 3 }, shapeModel: 'STRIP' },
    answerType: 'FRACTION',
    expectedFraction: { num: 7, den: 3 },
    hints: [
      'Mỗi đơn vị nguyên có 3 phần 1/3, vậy 2 đơn vị nguyên có 2 × 3 = 6 phần.',
      'Cộng thêm 1 phần lẻ ở đơn vị thứ ba: 6 + 1 = 7 phần.',
      'Vậy 2 1/3 = (2 × 3 + 1)/3 = 7/3.',
    ],
    explanationVi: '2 đơn vị nguyên ứng với 6/3, thêm 1/3 nữa được 7/3.',
  },
  {
    id: 'm05_act2_t8',
    activityId: 'BUILD_READ_FRACTION',
    difficulty: 'HARD',
    title: 'Phân biệt mẫu số của 1 đơn vị khi có nhiều khung (9/5)',
    prompt: 'Quan sát 2 dải đơn vị (mỗi dải chia 5 phần bằng nhau): dải đầu tô 5 phần, dải sau tô 4 phần.',
    question: 'Biểu diễn lượng được tô bằng phân số nào?',
    preset: { targetFraction: { num: 9, den: 5 }, shapeModel: 'STRIP' },
    answerType: 'FRACTION',
    expectedFraction: { num: 9, den: 5 },
    hints: [
      'Một dải đơn vị được chia thành 5 phần bằng nhau nên mẫu số là 5 (không phải 10).',
      'Tổng số mảnh 1/5 được tô là 5 + 4 = 9.',
      'Phân số biểu diễn đúng là 9/5 (= 1 và 4/5).',
    ],
    explanationVi: 'Mỗi mảnh có độ lớn 1/5 đơn vị. Lấy 9 mảnh như vậy ta được phân số 9/5.',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 3: PHÂN SỐ BẰNG NHAU (8 TASKS — FEATURED DEFAULT ACTIVITY)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act3_t1',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'EASY',
    title: 'Khám phá kịch bản tâm điểm: 1/2 = 2/4',
    prompt: 'Quan sát hai dải cùng đơn vị: dải trên biểu diễn 1/2, dải dưới chia thành 4 phần bằng nhau.',
    question: 'Cần tô mấy phần trên dải chia 4 để có lượng bằng đúng 1/2?',
    preset: { baseFraction: { num: 1, den: 2 }, scaleFactorK: 2, targetNum: 2, targetDen: 4 },
    answerType: 'FRACTION',
    expectedFraction: { num: 2, den: 4 },
    hints: [
      'So sánh chiều dài phần màu xanh của dải 1/2 ở trên với các ô 1/4 ở dưới.',
      'Nhân cả tử và mẫu của 1/2 với hệ số k = 2 (Chia nhỏ mỗi phần thành 2 phần).',
      '1/2 = (1 × 2)/(2 × 2) = 2/4.',
    ],
    explanationVi:
      'Khi chia nhỏ mỗi phần của 1/2 thành 2 phần bằng nhau (k = 2), 1 phần lớn trở thành 2 phần nhỏ trên 4 phần: 1/2 = 2/4. Độ dài phần được tô hoàn toàn không đổi!',
  },
  {
    id: 'm05_act3_t2',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'EASY',
    title: 'Chia nhỏ phân số 2/3 với hệ số k = 4 (2/3 = 8/12)',
    prompt: 'Từ dải phân số 2/3, dùng nút "Chia nhỏ" với hệ số k = 4 để chia thành 12 phần bằng nhau.',
    question: 'Khi mẫu số là 12, phân số bằng 2/3 có tử số và mẫu số là bao nhiêu?',
    preset: { baseFraction: { num: 2, den: 3 }, scaleFactorK: 4, targetNum: 8, targetDen: 12 },
    answerType: 'FRACTION',
    expectedFraction: { num: 8, den: 12 },
    hints: [
      'Mỗi phần trong 3 phần ban đầu được chia nhỏ thành 4 phần bằng nhau.',
      'Nhân cả tử và mẫu của 2/3 với 4.',
      '(2 × 4) / (3 × 4) = 8/12.',
    ],
    explanationVi: 'Theo tính chất cơ bản của phân số: 2/3 = (2 × 4)/(3 × 4) = 8/12.',
  },
  {
    id: 'm05_act3_t3',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'EASY',
    title: 'Rút gọn phân số 6/8 về tối giản (Ghép lại)',
    prompt: 'Quan sát dải phân số 6/8 và dùng nút "Ghép lại" (gộp mỗi 2 phần nhỏ thành 1 phần lớn).',
    question: 'Phân số tối giản của 6/8 là phân số nào?',
    preset: {
      baseFraction: { num: 6, den: 8 },
      scaleFactorK: 1,
      targetNum: 3,
      targetDen: 4,
      requireSimplified: true,
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 4 },
    requireSimplified: true,
    hints: [
      'Tìm ƯCLN của 6 và 8.',
      'ƯCLN(6, 8) = 2. Hãy ghép mỗi 2 ô nhỏ thành 1 ô lớn (chia cả tử và mẫu cho 2).',
      '6/8 = (6 : 2)/(8 : 2) = 3/4.',
    ],
    explanationVi: 'Chia cả tử và mẫu của 6/8 cho ƯCLN(6, 8) = 2 ta được phân số tối giản 3/4.',
  },
  {
    id: 'm05_act3_t4',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Tìm tử số chưa biết: 3/4 = ?/12',
    prompt: 'Chia nhỏ dải 3/4 thành 12 phần bằng nhau (hệ số k = 3).',
    question: 'Số thích hợp điền vào tử số của ?/12 để bằng 3/4 là số mấy?',
    preset: { baseFraction: { num: 3, den: 4 }, scaleFactorK: 3, targetNum: 9, targetDen: 12 },
    answerType: 'INTEGER',
    expectedInteger: 9,
    hints: [
      'Từ mẫu số 4 lên mẫu số 12, ta đã nhân mẫu số với k = 12 : 4 = 3.',
      'Để giữ nguyên lượng phân số, tử số 3 cũng phải nhân với 3.',
      '3 × 3 = 9, vậy 3/4 = 9/12.',
    ],
    explanationVi: 'Nhân cả tử và mẫu của 3/4 với 3 ta được 9/12, nên tử số cần tìm là 9.',
  },
  {
    id: 'm05_act3_t5',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Rút gọn phân số 9/12 về tối giản',
    prompt: 'Dùng thao tác "Ghép lại" trên dải 9/12 bằng cách gộp mỗi 3 phần nhỏ thành 1 phần lớn.',
    question: 'Nhập phân số tối giản sau khi rút gọn 9/12.',
    preset: {
      baseFraction: { num: 9, den: 12 },
      scaleFactorK: 1,
      targetNum: 3,
      targetDen: 4,
      requireSimplified: true,
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 4 },
    requireSimplified: true,
    hints: [
      'Tìm ước chung lớn nhất của 9 và 12.',
      'ƯCLN(9, 12) = 3. Chia cả tử và mẫu cho 3.',
      '(9 : 3)/(12 : 3) = 3/4.',
    ],
    explanationVi: 'ƯCLN(9, 12) = 3 nên 9/12 = (9 : 3)/(12 : 3) = 3/4.',
  },
  {
    id: 'm05_act3_t6',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Điều kiện để "Ghép lại" hợp lệ trên dải 4/6',
    prompt: 'Thử ghép các phần trên dải 4/6.',
    question: 'Trên dải 4/6, ta có thể ghép mấy phần nhỏ thành 1 phần lớn để rút gọn hợp lệ?',
    preset: { baseFraction: { num: 4, den: 6 }, scaleFactorK: 1, targetNum: 2, targetDen: 3 },
    answerType: 'INTEGER',
    expectedInteger: 2,
    hints: [
      'Số phần gộp lại phải là ước chung của cả tử số (4) và mẫu số (6).',
      'Nếu gộp 3 phần thì 4 không chia hết cho 3 (vạch chia đi cắt ngang phần đang tô).',
      'ƯCLN(4, 6) = 2 nên ta ghép mỗi 2 phần nhỏ thành 1 phần lớn để được 2/3.',
    ],
    explanationVi: 'Chỉ được phép ghép m phần khi cả tử số và mẫu số cùng chia hết cho m. Với 4/6, ƯCLN(4, 6) = 2 nên ghép 2 phần nhỏ thành 1 phần lớn được 2/3.',
  },
  {
    id: 'm05_act3_t7',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'HARD',
    title: 'Rút gọn phân số có mẫu âm: 8/(-12)',
    prompt: 'Chuẩn hóa dấu mẫu dương và rút gọn phân số 8/(-12) về dạng tối giản.',
    question: 'Phân số tối giản có mẫu dương của 8/(-12) là gì?',
    preset: {
      baseFraction: { num: -8, den: 12 },
      scaleFactorK: 1,
      targetNum: -2,
      targetDen: 3,
      requireSimplified: true,
    },
    answerType: 'FRACTION',
    expectedFraction: { num: -2, den: 3 },
    requireSimplified: true,
    hints: [
      'Bước 1: Đưa dấu âm lên tử số để mẫu số dương: 8/(-12) = -8/12.',
      'Bước 2: Tìm ƯCLN(8, 12) = 4.',
      'Bước 3: Chia cả tử và mẫu cho 4: (-8 : 4)/(12 : 4) = -2/3.',
    ],
    explanationVi: 'Đổi mẫu dương: 8/(-12) = -8/12. Chia cả tử và mẫu cho ƯCLN(8, 12) = 4 ta được -2/3.',
  },
  {
    id: 'm05_act3_t8',
    activityId: 'EQUIVALENT_FRACTIONS',
    difficulty: 'HARD',
    title: 'Tìm phân số bằng 3/5 có tổng tử và mẫu bằng 16',
    prompt: 'Nhân cả tử và mẫu của 3/5 với các hệ số k = 1, 2, 3...',
    question: 'Phân số nào bằng 3/5 mà có tổng của tử số và mẫu số bằng 16?',
    preset: { baseFraction: { num: 3, den: 5 }, scaleFactorK: 2, targetNum: 6, targetDen: 10 },
    answerType: 'FRACTION',
    expectedFraction: { num: 6, den: 10 },
    requireSimplified: false,
    hints: [
      'Tổng tử và mẫu của 3/5 là 3 + 5 = 8.',
      'Muốn tổng mới bằng 16, ta nhân cả tử và mẫu với k = 16 : 8 = 2.',
      'Với k = 2, phân số cần tìm là (3 × 2)/(5 × 2) = 6/10.',
    ],
    explanationVi: 'Nhân cả tử và mẫu của 3/5 với k = 2 ta được 6/10 (có 6 + 10 = 16 và 6/10 = 3/5).',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 4: SO SÁNH PHÂN SỐ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act4_t1',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'EASY',
    title: 'So sánh hai phân số cùng mẫu: 1/4 và 3/4',
    prompt: 'Quan sát hai dải cùng đơn vị đặt thẳng hàng biểu diễn 1/4 và 3/4.',
    question: 'Điền dấu thích hợp (<, =, >) vào chỗ chấm: 1/4 ... 3/4',
    preset: { compareLeft: { num: 1, den: 4 }, compareRight: { num: 3, den: 4 } },
    answerType: 'OPERATOR',
    expectedOperator: '<',
    hints: [
      'Hai phân số có cùng mẫu số dương là 4.',
      'So sánh chiều dài 1 phần 1/4 với 3 phần 1/4 trên cùng đơn vị.',
      'Vì 1 < 3 nên 1/4 < 3/4.',
    ],
    explanationVi: 'Trong hai phân số có cùng mẫu dương, phân số nào có tử nhỏ hơn thì nhỏ hơn: 1 < 3 nên 1/4 < 3/4.',
  },
  {
    id: 'm05_act4_t2',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'EASY',
    title: 'So sánh hai phân số cùng tử dương: 2/3 và 2/5',
    prompt: 'So sánh hai dải 2/3 và 2/5 có cùng chiều dài đơn vị.',
    question: 'Điền dấu thích hợp (<, =, >): 2/3 ... 2/5',
    preset: { compareLeft: { num: 2, den: 3 }, compareRight: { num: 2, den: 5 } },
    answerType: 'OPERATOR',
    expectedOperator: '>',
    hints: [
      'Cả hai đều lấy 2 phần, nhưng đơn vị ở 2/3 chỉ chia 3 còn ở 2/5 chia làm 5.',
      'Chia cùng một chiếc bánh cho ít phần hơn (3 < 5) thì mỗi phần sẽ lớn hơn (1/3 > 1/5).',
      'Do đó 2/3 > 2/5.',
    ],
    explanationVi: 'Hai phân số dương có cùng tử số (2), phân số nào có mẫu số nhỏ hơn (3 < 5) thì lớn hơn: 2/3 > 2/5.',
  },
  {
    id: 'm05_act4_t3',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'So sánh hai phân số khác tử và mẫu: 2/3 và 3/5',
    prompt: 'Bật "Lớp chia mẫu số chung" (BCNN(3, 5) = 15) trên hai dải 2/3 và 3/5.',
    question: 'Điền dấu thích hợp (<, =, >): 2/3 ... 3/5',
    preset: { compareLeft: { num: 2, den: 3 }, compareRight: { num: 3, den: 5 } },
    answerType: 'OPERATOR',
    expectedOperator: '>',
    hints: [
      'Bật lớp chia theo mẫu chung 15 để đưa hai dải về cùng cỡ phần 1/15.',
      '2/3 = 10/15 và 3/5 = 9/15.',
      'Vì 10/15 > 9/15 nên 2/3 > 3/5.',
    ],
    explanationVi: 'Quy đồng mẫu chung 15: 2/3 = 10/15 và 3/5 = 9/15. Vì 10 > 9 nên 2/3 > 3/5.',
  },
  {
    id: 'm05_act4_t4',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'EASY',
    title: 'Nhận biết hai phân số bằng nhau: 2/4 và 1/2',
    prompt: 'Đặt dải 2/4 và dải 1/2 thẳng hàng nhau.',
    question: 'Điền dấu thích hợp (<, =, >): 2/4 ... 1/2',
    preset: { compareLeft: { num: 2, den: 4 }, compareRight: { num: 1, den: 2 } },
    answerType: 'OPERATOR',
    expectedOperator: '=',
    hints: [
      'Quan sát vạch kết thúc phần tô màu của cả hai dải.',
      'Rút gọn 2/4 bằng cách chia cả tử và mẫu cho 2.',
      '2/4 = 1/2 nên điền dấu =.',
    ],
    explanationVi: 'Hai dải có chiều dài phần tô bằng hệt nhau: 2/4 = 1/2.',
  },
  {
    id: 'm05_act4_t5',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'So sánh qua phân số trung gian 1/2: 3/8 và 5/8 (hoặc 3/7 và 4/7)',
    prompt: 'So sánh 2/5 với mốc 1/2 trên cùng đơn vị.',
    question: 'Điền dấu thích hợp (<, =, >): 2/5 ... 1/2',
    preset: { compareLeft: { num: 2, den: 5 }, compareRight: { num: 1, den: 2 } },
    answerType: 'OPERATOR',
    expectedOperator: '<',
    hints: [
      'Quan sát vạch một nửa đơn vị (1/2).',
      'Quy đồng mẫu chung 10: 2/5 = 4/10 còn 1/2 = 5/10.',
      'Vì 4/10 < 5/10 nên 2/5 < 1/2.',
    ],
    explanationVi: 'Ta có 2/5 = 4/10 < 5/10 = 1/2.',
  },
  {
    id: 'm05_act4_t6',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'HARD',
    title: 'So sánh hai phân số âm trên trục số: -2/3 và -1/3',
    prompt: 'Chuyển sang chế độ đối chiếu trên Trục số để quan sát vị trí của -2/3 và -1/3.',
    question: 'Điền dấu thích hợp (<, =, >): -2/3 ... -1/3',
    preset: { compareLeft: { num: -2, den: 3 }, compareRight: { num: -1, den: 3 } },
    answerType: 'OPERATOR',
    expectedOperator: '<',
    hints: [
      'Trên trục số ngang, cả -2/3 và -1/3 đều nằm bên trái điểm 0.',
      'Điểm -2/3 cách 0 hai khoảng về bên trái, nên nằm bên trái điểm -1/3.',
      'Vì -2 < -1 (và mẫu số 3 > 0) nên -2/3 < -1/3.',
    ],
    explanationVi: 'Trên trục số, điểm -2/3 nằm bên trái điểm -1/3 (cùng mẫu dương 3 và -2 < -1) nên -2/3 < -1/3.',
  },
  {
    id: 'm05_act4_t7',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'HARD',
    title: 'Sắp xếp 3 phân số theo thứ tự tăng dần: 3/4, 1/2, 5/8',
    prompt: 'Chuyển sang chế độ "Sắp xếp thẻ phân số" với 3 thẻ: 3/4, 1/2, 5/8.',
    question: 'Sắp xếp các thẻ theo thứ tự tăng dần (từ bé đến lớn) rồi bấm Kiểm tra.',
    preset: {
      compareLeft: { num: 1, den: 2 },
      compareRight: { num: 3, den: 4 },
      sortList: [
        { num: 3, den: 4 },
        { num: 1, den: 2 },
        { num: 5, den: 8 },
      ],
      sortOrder: 'ASC',
    },
    answerType: 'SORT_LIST',
    expectedSortStrings: ['1/2', '5/8', '3/4'],
    hints: [
      'Quy đồng cả 3 phân số về mẫu số chung là 8.',
      '1/2 = 4/8; 5/8 giữ nguyên; 3/4 = 6/8.',
      'Vì 4/8 < 5/8 < 6/8 nên thứ tự tăng dần là: 1/2, 5/8, 3/4.',
    ],
    explanationVi: 'Quy đồng mẫu 8: 1/2 = 4/8 < 5/8 < 6/8 = 3/4. Thứ tự tăng dần là 1/2; 5/8; 3/4.',
  },
  {
    id: 'm05_act4_t8',
    activityId: 'COMPARE_FRACTIONS',
    difficulty: 'HARD',
    title: 'So sánh phân số lớn hơn 1 và nhỏ hơn 1: 5/4 và 4/5',
    prompt: 'Quan sát 5/4 (> 1 đơn vị) và 4/5 (< 1 đơn vị).',
    question: 'Điền dấu thích hợp (<, =, >): 5/4 ... 4/5',
    preset: { compareLeft: { num: 5, den: 4 }, compareRight: { num: 4, den: 5 } },
    answerType: 'OPERATOR',
    expectedOperator: '>',
    hints: [
      'So sánh mỗi phân số với số 1.',
      '5/4 có tử lớn hơn mẫu nên 5/4 > 1; còn 4/5 có tử nhỏ hơn mẫu nên 4/5 < 1.',
      'Theo tính chất bắc cầu: 5/4 > 1 > 4/5 nên 5/4 > 4/5.',
    ],
    explanationVi: 'Ta có 5/4 > 1 và 4/5 < 1 nên 5/4 > 4/5 (hoặc quy đồng mẫu 20: 25/20 > 16/20).',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 5: PHÂN SỐ TRÊN TRỤC SỐ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act5_t1',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'EASY',
    title: 'Đặt điểm 3/4 trên đoạn [0; 1]',
    prompt: 'Chia đoạn đơn vị [0; 1] thành 4 khoảng bằng nhau (5 vạch từ 0 đến 1) và kéo điểm đến 3/4.',
    question: 'Điểm cách gốc 0 về bên phải 3 khoảng (mỗi khoảng 1/4) biểu diễn phân số nào?',
    preset: { nlSubdivisions: 4, nlTarget: { num: 3, den: 4 }, nlShowNegative: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 4 },
    hints: [
      'Lưu ý: Chia đoạn [0; 1] thành 4 khoảng bằng nhau (đếm số khoảng chứ không đếm số vạch).',
      'Từ 0 tiến sang phải 3 khoảng, mỗi khoảng dài 1/4 đơn vị.',
      'Vị trí đó chính là 3/4 (nằm giữa 0 và 1).',
    ],
    explanationVi: 'Đoạn [0; 1] chia thành 4 khoảng bằng nhau, mỗi khoảng là 1/4. Tiến sang phải 3 khoảng ta được điểm 3/4.',
  },
  {
    id: 'm05_act5_t2',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'EASY',
    title: 'Hai phân số bằng nhau nằm cùng một điểm (1/2 và 2/4)',
    prompt: 'Kéo điểm đến chính giữa đoạn [0; 1] trên trục số chia 4 khoảng.',
    question: 'Điểm chính giữa đoạn [0; 1] ứng với 2/4 cũng chính là phân số tối giản nào?',
    preset: {
      nlSubdivisions: 4,
      nlTarget: { num: 1, den: 2 },
      nlShowNegative: false,
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 1, den: 2 },
    requireSimplified: true,
    hints: [
      'Điểm nằm ở vạch thứ 2 trong 4 khoảng từ 0 đến 1 là 2/4.',
      'Rút gọn 2/4 bằng cách chia cả tử và mẫu cho 2.',
      '2/4 và 1/2 biểu diễn cùng một điểm duy nhất trên trục số!',
    ],
    explanationVi: 'Mọi phân số bằng nhau (như 1/2, 2/4, 3/6) đều nằm tại cùng một điểm trên trục số.',
  },
  {
    id: 'm05_act5_t3',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'MEDIUM',
    title: 'Biểu diễn phân số lớn hơn 1 trên trục số: 5/4 = 1 + 1/4',
    prompt: 'Kéo điểm vượt qua mốc 1 thêm 1 khoảng 1/4 nữa.',
    question: 'Điểm nằm bên phải số 1 đúng 1 khoảng 1/4 biểu diễn phân số nào?',
    preset: { nlSubdivisions: 4, nlTarget: { num: 5, den: 4 }, nlShowNegative: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 5, den: 4 },
    hints: [
      'Từ 0 đến 1 có 4 khoảng 1/4 (tức là 4/4).',
      'Đi thêm 1 khoảng 1/4 nữa sang phải: 4 + 1 = 5 khoảng.',
      'Đó là điểm 5/4 (hay hỗn số 1 và 1/4).',
    ],
    explanationVi: 'Điểm 5/4 = 1 + 1/4 nằm bên phải mốc 1 đúng 1 khoảng bằng 1/4 đơn vị.',
  },
  {
    id: 'm05_act5_t4',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'MEDIUM',
    title: 'Biểu diễn phân số âm trên trục số: -3/4',
    prompt: 'Bật phần mở rộng phân số âm, chia mỗi đơn vị thành 4 khoảng và kéo điểm về bên trái 0 ba khoảng.',
    question: 'Điểm nằm bên trái gốc 0 đúng 3 khoảng (mỗi khoảng 1/4) biểu diễn phân số nào?',
    preset: { nlSubdivisions: 4, nlTarget: { num: -3, den: 4 }, nlShowNegative: true },
    answerType: 'FRACTION',
    expectedFraction: { num: -3, den: 4 },
    hints: [
      'Bên trái điểm 0 là miền của các số âm.',
      'Mỗi khoảng chia là 1/4 đơn vị, lùi sang trái 3 khoảng.',
      'Tọa độ của điểm là -3/4.',
    ],
    explanationVi: 'Từ gốc 0 di chuyển sang trái 3 khoảng (mỗi khoảng 1/4 đơn vị) ta đến điểm -3/4.',
  },
  {
    id: 'm05_act5_t5',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'MEDIUM',
    title: 'Phân biệt số khoảng chia và số mốc trên đoạn [0; 1]',
    prompt: 'Chia đoạn đơn vị [0; 1] thành 6 khoảng bằng nhau.',
    question: 'Khi chia đoạn từ 0 đến 1 thành 6 khoảng bằng nhau thì có tất cả bao nhiêu vạch mốc (tính cả hai đầu 0 và 1)?',
    preset: { nlSubdivisions: 6, nlTarget: { num: 5, den: 6 }, nlShowNegative: false },
    answerType: 'INTEGER',
    expectedInteger: 7,
    hints: [
      'Đếm các vạch mốc: 0/6, 1/6, 2/6, 3/6, 4/6, 5/6, 6/6.',
      'Quy tắc: b khoảng chia liên tiếp luôn có b + 1 vạch mốc ở hai đầu.',
      'Với b = 6 khoảng chia thì có 6 + 1 = 7 vạch mốc.',
    ],
    explanationVi: 'Chia đoạn [0; 1] thành b = 6 khoảng bằng nhau sẽ tạo ra b + 1 = 7 vạch mốc (từ 0/6 đến 6/6). Không nhầm số vạch (7) với mẫu số (6)!',
  },
  {
    id: 'm05_act5_t6',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'MEDIUM',
    title: 'Tìm phân số bị che trên trục số chia 5 khoảng (7/5)',
    prompt: 'Quan sát trục số chia mỗi đơn vị thành 5 khoảng bằng nhau.',
    question: 'Điểm nằm ở vạch thứ 2 bên phải mốc 1 biểu diễn phân số nào?',
    preset: { nlSubdivisions: 5, nlTarget: { num: 7, den: 5 }, nlShowNegative: false },
    answerType: 'FRACTION',
    expectedFraction: { num: 7, den: 5 },
    hints: [
      'Mốc 1 ứng với phân số 5/5.',
      'Đi sang phải thêm 2 khoảng (mỗi khoảng 1/5): 5/5 + 2/5.',
      'Ta được phân số 7/5 (hay hỗn số 1 và 2/5).',
    ],
    explanationVi: 'Tại mốc 1 là 5/5, tiến sang phải 2 khoảng 1/5 nữa là 7/5.',
  },
  {
    id: 'm05_act5_t7',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'HARD',
    title: 'Tìm điểm đối xứng với 2/3 qua gốc 0 (-2/3)',
    prompt: 'Trên trục số chia mỗi đơn vị thành 3 khoảng bằng nhau, tìm điểm cách đều gốc 0 với điểm 2/3 nhưng ở phía bên trái.',
    question: 'Tọa độ của điểm đối xứng với 2/3 qua gốc 0 là phân số nào?',
    preset: { nlSubdivisions: 3, nlTarget: { num: -2, den: 3 }, nlShowNegative: true },
    answerType: 'FRACTION',
    expectedFraction: { num: -2, den: 3 },
    hints: [
      'Điểm 2/3 nằm bên phải 0 hai khoảng (mỗi khoảng 1/3).',
      'Điểm đối xứng qua 0 nằm bên trái 0 đúng 2 khoảng.',
      'Đó là số đối của 2/3, tức là -2/3.',
    ],
    explanationVi: 'Hai điểm 2/3 và -2/3 nằm ở hai phía của điểm 0 và cùng cách 0 một khoảng bằng 2/3 đơn vị.',
  },
  {
    id: 'm05_act5_t8',
    activityId: 'FRACTION_NUMBER_LINE',
    difficulty: 'HARD',
    title: 'Hỗn số âm trên trục số: -5/4 = -(1 và 1/4)',
    prompt: 'Kéo điểm về bên trái mốc -1 thêm 1 khoảng 1/4 nữa.',
    question: 'Điểm nằm bên trái mốc -1 đúng 1 khoảng 1/4 biểu diễn phân số nào?',
    preset: { nlSubdivisions: 4, nlTarget: { num: -5, den: 4 }, nlShowNegative: true },
    answerType: 'FRACTION',
    expectedFraction: { num: -5, den: 4 },
    hints: [
      'Mốc -1 ứng với -4/4 (cách 0 bốn khoảng 1/4 về bên trái).',
      'Lùi thêm 1 khoảng 1/4 về bên trái nữa là 5 khoảng.',
      'Tọa độ điểm là -5/4, viết dưới dạng hỗn số là -(1 và 1/4).',
    ],
    explanationVi: 'Điểm cách 0 năm khoảng 1/4 về bên trái là -5/4 = -(1 1/4).',
  },

  // --------------------------------------------------------------------------
  // ACTIVITY 6: CỘNG, TRỪ PHÂN SỐ (8 TASKS)
  // --------------------------------------------------------------------------
  {
    id: 'm05_act6_t1',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'EASY',
    title: 'Ví dụ nổi bật: Cộng hai phân số khác mẫu 1/2 + 1/3 = 5/6',
    prompt: 'Chạy 5 bước hoạt ảnh quy đồng và ghép mảnh cho phép tính 1/2 + 1/3.',
    question: 'Kết quả của phép cộng 1/2 + 1/3 sau khi quy đồng mẫu chung 6 là bao nhiêu?',
    preset: {
      addSubA: { num: 1, den: 2 },
      addSubB: { num: 1, den: 3 },
      addSubOp: '+',
      addSubTab: 'DIFF_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 5, den: 6 },
    requireSimplified: true,
    hints: [
      'BCNN(2, 3) = 6. Chia mỗi đơn vị thành 6 phần bằng nhau.',
      '1/2 = 3/6 (3 miếng 1/6) và 1/3 = 2/6 (2 miếng 1/6).',
      'Ghép 3 miếng và 2 miếng vào khung kết quả: 3/6 + 2/6 = 5/6.',
    ],
    explanationVi:
      '1/2 + 1/3 = 3/6 + 2/6 = 5/6. Quy đồng về cùng đơn vị chia 6 giúp các mảnh có kích thước bằng nhau trước khi cộng.',
  },
  {
    id: 'm05_act6_t2',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'EASY',
    title: 'Cộng hai phân số cùng mẫu và rút gọn: 1/8 + 3/8 = 1/2',
    prompt: 'Chọn tab "Cùng mẫu", thực hiện phép cộng 1/8 + 3/8.',
    question: 'Nhập kết quả tối giản của phép tính 1/8 + 3/8.',
    preset: {
      addSubA: { num: 1, den: 8 },
      addSubB: { num: 3, den: 8 },
      addSubOp: '+',
      addSubTab: 'SAME_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 1, den: 2 },
    requireSimplified: true,
    hints: [
      'Cộng hai tử số và giữ nguyên mẫu số 8: 1/8 + 3/8 = 4/8.',
      'Rút gọn 4/8 bằng cách chia cả tử và mẫu cho ƯCLN(4, 8) = 4.',
      '4/8 = 1/2.',
    ],
    explanationVi: '1/8 + 3/8 = (1 + 3)/8 = 4/8. Rút gọn cho 4 ta được phân số tối giản 1/2.',
  },
  {
    id: 'm05_act6_t3',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Trừ hai phân số khác mẫu: 3/4 - 1/2 = 1/4',
    prompt: 'Thực hiện phép trừ 3/4 - 1/2 trên mô hình dải phân số.',
    question: 'Kết quả của phép tính 3/4 - 1/2 là phân số nào?',
    preset: {
      addSubA: { num: 3, den: 4 },
      addSubB: { num: 1, den: 2 },
      addSubOp: '-',
      addSubTab: 'DIFF_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 1, den: 4 },
    requireSimplified: true,
    hints: [
      'Quy đồng mẫu số chung là 4: giữ nguyên 3/4 và đổi 1/2 = 2/4.',
      'Từ 3 miếng 1/4, lấy bớt đi 2 miếng 1/4.',
      '3/4 - 2/4 = 1/4.',
    ],
    explanationVi: 'Quy đồng mẫu chung 4: 3/4 - 1/2 = 3/4 - 2/4 = 1/4.',
  },
  {
    id: 'm05_act6_t4',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Phép cộng vượt quá 1 đơn vị: 3/4 + 3/4 = 3/2 (= 1 1/2)',
    prompt: 'Thực hiện phép cộng 3/4 + 3/4 và quan sát kết quả trên 2 khung đơn vị.',
    question: 'Nhập phân số tối giản của tổng 3/4 + 3/4.',
    preset: {
      addSubA: { num: 3, den: 4 },
      addSubB: { num: 3, den: 4 },
      addSubOp: '+',
      addSubTab: 'SAME_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 3, den: 2 },
    requireSimplified: true,
    hints: [
      'Ghép 3 mảnh 1/4 và 3 mảnh 1/4 được 6 mảnh 1/4, tức là 6/4.',
      'Rút gọn 6/4 bằng cách chia cả tử và mẫu cho ƯCLN(6, 4) = 2.',
      '6/4 = 3/2 (hay hỗn số 1 và 1/2).',
    ],
    explanationVi: '3/4 + 3/4 = 6/4 = 3/2 = 1 1/2 (gồm 1 khung đơn vị đầy và 1/2 khung đơn vị thứ hai).',
  },
  {
    id: 'm05_act6_t5',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Phép trừ ra kết quả âm trên trục số: 1/3 - 2/3 = -1/3',
    prompt: 'Thực hiện phép trừ 1/3 - 2/3 và quan sát bước nhảy có hướng trên trục số.',
    question: 'Kết quả của phép tính 1/3 - 2/3 bằng bao nhiêu?',
    preset: {
      addSubA: { num: 1, den: 3 },
      addSubB: { num: 2, den: 3 },
      addSubOp: '-',
      addSubTab: 'SAME_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: -1, den: 3 },
    requireSimplified: true,
    hints: [
      'Hai phân số có cùng mẫu số 3: lấy tử trừ tử (1 - 2 = -1).',
      'Trên trục số, xuất phát tại 1/3 và lùi sang trái 2/3 đơn vị sẽ vượt qua 0 đến -1/3.',
      'Vậy 1/3 - 2/3 = -1/3.',
    ],
    explanationVi:
      '1/3 - 2/3 = (1 - 2)/3 = -1/3. Khi kết quả âm, phòng thí nghiệm tự động minh họa bằng mũi tên có hướng trên trục số (không dùng diện tích âm).',
  },
  {
    id: 'm05_act6_t6',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'MEDIUM',
    title: 'Tổng hai phân số đối nhau: 1/2 + (-1/2) = 0',
    prompt: 'Thực hiện phép cộng 1/2 + (-1/2) trên trục số.',
    question: 'Tổng của hai phân số đối nhau 1/2 + (-1/2) bằng bao nhiêu?',
    preset: {
      addSubA: { num: 1, den: 2 },
      addSubB: { num: -1, den: 2 },
      addSubOp: '+',
      addSubTab: 'SAME_DEN',
    },
    answerType: 'INTEGER',
    expectedInteger: 0,
    hints: [
      'Từ 0 tiến sang phải 1/2 đơn vị, sau đó lùi sang trái 1/2 đơn vị.',
      'Tử số là 1 + (-1) = 0.',
      '0/2 = 0 (hai số đối nhau luôn có tổng bằng 0).',
    ],
    explanationVi: 'Hai phân số đối nhau có tổng luôn bằng 0: 1/2 + (-1/2) = 0/2 = 0.',
  },
  {
    id: 'm05_act6_t7',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'HARD',
    title: 'Cộng hai phân số khác mẫu và rút gọn: 1/6 + 1/3 = 1/2',
    prompt: 'Thực hiện phép cộng 1/6 + 1/3.',
    question: 'Nhập kết quả tối giản của phép tính 1/6 + 1/3.',
    preset: {
      addSubA: { num: 1, den: 6 },
      addSubB: { num: 1, den: 3 },
      addSubOp: '+',
      addSubTab: 'DIFF_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: 1, den: 2 },
    requireSimplified: true,
    hints: [
      'Mẫu số chung nhỏ nhất BCNN(6, 3) = 6.',
      'Quy đồng: 1/6 + 2/6 = 3/6.',
      'Rút gọn 3/6 bằng cách chia cả tử và mẫu cho 3 ta được 1/2.',
    ],
    explanationVi: '1/6 + 1/3 = 1/6 + 2/6 = 3/6 = 1/2.',
  },
  {
    id: 'm05_act6_t8',
    activityId: 'ADD_SUB_FRACTIONS',
    difficulty: 'HARD',
    title: 'Trừ hai phân số khác mẫu ra số âm: 1/4 - 2/3 = -5/12',
    prompt: 'Thực hiện phép trừ 1/4 - 2/3.',
    question: 'Kết quả tối giản của 1/4 - 2/3 là phân số nào?',
    preset: {
      addSubA: { num: 1, den: 4 },
      addSubB: { num: 2, den: 3 },
      addSubOp: '-',
      addSubTab: 'DIFF_DEN',
    },
    answerType: 'FRACTION',
    expectedFraction: { num: -5, den: 12 },
    requireSimplified: true,
    hints: [
      'Quy đồng mẫu chung BCNN(4, 3) = 12.',
      '1/4 = 3/12 và 2/3 = 8/12.',
      '3/12 - 8/12 = (3 - 8)/12 = -5/12.',
    ],
    explanationVi: 'BCNN(4, 3) = 12. Ta có 1/4 - 2/3 = 3/12 - 8/12 = -5/12.',
  },
];

export function getM05TasksByActivity(activityId: M05ActivityId): M05TaskSpec[] {
  return M05_TASK_BANK.filter((t) => t.activityId === activityId);
}

// ============================================================================
// 7. MANDATORY AUTOMATED VERIFICATION SUITE (SECTION I)
// ============================================================================

export function runM05UnitTests(): {
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

  // 1. 1/2 = 2/4 and 2/3 = 8/12
  check(
    'Equivalence 1/2 = 2/4 and 2/3 = 8/12',
    areFractionsEqual({ num: 1, den: 2 }, { num: 2, den: 4 }) &&
      areFractionsEqual({ num: 2, den: 3 }, { num: 8, den: 12 }) &&
      !areFractionsEqual({ num: 1, den: 2 }, { num: 2, den: 3 })
  );

  // 2. 6/8 simplifies to 3/4
  const s68 = simplifyFraction({ num: 6, den: 8 });
  check(
    '6/8 simplifies to 3/4 with GCD=2',
    s68.simplified.num === 3 && s68.simplified.den === 4 && s68.gcdValue === 2
  );

  // 3. 0/5 has value 0 (normalized to 0/1)
  const s05 = simplifyFraction({ num: 0, den: 5 });
  check(
    '0/5 normalizes to 0/1 and equals 0',
    s05.simplified.num === 0 &&
      s05.simplified.den === 1 &&
      areFractionsEqual({ num: 0, den: 5 }, { num: 0, den: 1 })
  );

  // 4. 4/4 = 1
  check(
    '4/4 equals 1/1',
    areFractionsEqual({ num: 4, den: 4 }, { num: 1, den: 1 })
  );

  // 5. 7/4 = 1 3/4
  const mix74 = toMixedNumber({ num: 7, den: 4 });
  const back74 = fromMixedNumberInput(false, 1, 3, 4);
  check(
    '7/4 converts to mixed number 1 3/4 and back',
    mix74 !== null &&
      mix74.whole === 1 &&
      mix74.remNum === 3 &&
      mix74.den === 4 &&
      back74.num === 7 &&
      back74.den === 4
  );

  // 6. 2/3 > 3/5 and -2/3 < -1/3
  check(
    'Comparison 2/3 > 3/5 and -2/3 < -1/3',
    compareExactFractions({ num: 2, den: 3 }, { num: 3, den: 5 }) === '>' &&
      compareExactFractions({ num: -2, den: 3 }, { num: -1, den: 3 }) === '<'
  );

  // 7. 1/2 + 1/3 = 5/6
  const add12_13 = computeFractionAddSub({ num: 1, den: 2 }, '+', { num: 1, den: 3 });
  check(
    '1/2 + 1/3 = 5/6 with commonDen=6',
    add12_13.commonDen === 6 &&
      add12_13.simplifiedResult.num === 5 &&
      add12_13.simplifiedResult.den === 6
  );

  // 8. 3/4 - 1/2 = 1/4
  const sub34_12 = computeFractionAddSub({ num: 3, den: 4 }, '-', { num: 1, den: 2 });
  check(
    '3/4 - 1/2 = 1/4',
    sub34_12.simplifiedResult.num === 1 && sub34_12.simplifiedResult.den === 4
  );

  // 9. 3/4 + 3/4 = 6/4 = 3/2 = 1 1/2
  const add34_34 = computeFractionAddSub({ num: 3, den: 4 }, '+', { num: 3, den: 4 });
  check(
    '3/4 + 3/4 = 6/4 = 3/2 = 1 1/2',
    add34_34.unsimplifiedResult.num === 6 &&
      add34_34.unsimplifiedResult.den === 4 &&
      add34_34.simplifiedResult.num === 3 &&
      add34_34.simplifiedResult.den === 2 &&
      add34_34.mixedResult?.whole === 1 &&
      add34_34.mixedResult?.remNum === 1
  );

  // 10. 1/3 - 2/3 = -1/3 (and disables area model for negative result)
  const sub13_23 = computeFractionAddSub({ num: 1, den: 3 }, '-', { num: 2, den: 3 });
  check(
    '1/3 - 2/3 = -1/3 and uses number line (canUseAreaModel=false)',
    sub13_23.simplifiedResult.num === -1 &&
      sub13_23.simplifiedResult.den === 3 &&
      sub13_23.isNegativeResult === true &&
      sub13_23.canUseAreaModel === false
  );

  // 11. 1/2 + (-1/2) = 0
  const addOpp = computeFractionAddSub({ num: 1, den: 2 }, '+', { num: -1, den: 2 });
  check(
    '1/2 + (-1/2) = 0/1',
    addOpp.simplifiedResult.num === 0 && addOpp.simplifiedResult.den === 1
  );

  // 12. Rejects denominator 0
  const zeroDenCheck = validateStudentFractionSubmission(
    { num: 3, den: 0 },
    { num: 3, den: 4 },
    false
  );
  check(
    'Rejects denominator 0 with INVALID_ZERO_DEN',
    zeroDenCheck.status === 'INVALID_ZERO_DEN' && !isValidDenominator(0)
  );

  // 13. Distinguishes EQUIVALENT_UNSIMPLIFIED vs CORRECT when requireSimplified=true
  const unsimpCheck = validateStudentFractionSubmission(
    { num: 6, den: 8 },
    { num: 3, den: 4 },
    true
  );
  const simpCheck = validateStudentFractionSubmission(
    { num: 3, den: 4 },
    { num: 3, den: 4 },
    true
  );
  check(
    'Distinguishes unsimplified equivalent fraction from reduced fraction',
    unsimpCheck.status === 'EQUIVALENT_UNSIMPLIFIED' && simpCheck.status === 'CORRECT'
  );

  // 14. Number line coordinate accuracy for 1/2, 5/4, -3/4
  const vp: FractionNumberLineViewport = {
    minInt: -1,
    maxInt: 2,
    subdivisionsPerUnit: 4,
    leftPx: 100,
    rightPx: 700,
  };
  const xHalf = fractionToSvgX({ num: 1, den: 2 }, vp);
  const x54 = fractionToSvgX({ num: 5, den: 4 }, vp);
  const xNeg34 = fractionToSvgX({ num: -3, den: 4 }, vp);
  const snapHalf = svgXToSnappedFraction(xHalf, vp);
  const snap54 = svgXToSnappedFraction(x54, vp);
  const snapNeg34 = svgXToSnappedFraction(xNeg34, vp);
  check(
    'Number line coordinates exact for 1/2, 5/4, -3/4',
    areFractionsEqual(snapHalf, { num: 1, den: 2 }) &&
      areFractionsEqual(snap54, { num: 5, den: 4 }) &&
      areFractionsEqual(snapNeg34, { num: -3, den: 4 })
  );

  // 15. Verify all 48 tasks in M05_TASK_BANK (8 per activity × 6 activities)
  const actCounts = M05_ACTIVITY_METADATA.map(
    (m) => getM05TasksByActivity(m.id).length
  );
  check(
    'Task bank has 48 tasks (8 per activity across all 6 activities)',
    M05_TASK_BANK.length === 48 && actCounts.every((c) => c === 8)
  );

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
