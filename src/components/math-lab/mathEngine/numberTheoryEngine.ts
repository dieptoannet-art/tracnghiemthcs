export const MAX_SAFE_INPUT_INT = 1_000_000_000;
export const MAX_VISUAL_SIEVE_LIMIT = 200;
export const MAX_FAST_SIEVE_LIMIT = 100_000;

export type NumberCategory =
  | 'ZERO'
  | 'UNIT_ONE'
  | 'PRIME'
  | 'COMPOSITE'
  | 'NEGATIVE'
  | 'INVALID';

export interface NumberClassification {
  input: number;
  isValidInteger: boolean;
  category: NumberCategory;
  categoryLabelVi: string;
  isPrime: boolean;
  isComposite: boolean;
  explanationVi: string;
  latexSummary: string;
}

export interface SieveStep {
  stepIndex: number;
  prime: number;
  crossedMultiples: number[];
  descriptionVi: string;
}

export interface EratosthenesResult {
  isValid: boolean;
  errorVi?: string;
  limit: number;
  visualLimit: number;
  isVisualTruncated: boolean;
  primes: number[];
  primeCount: number;
  steps: SieveStep[];
  /** Bản đồ đánh dấu ước nguyên tố nhỏ nhất đã gạch bỏ hợp số <= visualLimit */
  smallestFactorMap: Record<number, number>;
}

export interface PrimeFactorExponent {
  prime: number;
  exponent: number;
}

export interface FactorTreeNode {
  id: string;
  value: number;
  isPrime: boolean;
  left?: FactorTreeNode;
  right?: FactorTreeNode;
}

export interface PrimeFactorizationResult {
  input: number;
  isValid: boolean;
  canFactorize: boolean;
  isNegative: boolean;
  absValue: number;
  factors: PrimeFactorExponent[];
  divisionSteps: { dividend: number; divisor: number; quotient: number }[];
  tree: FactorTreeNode | null;
  expressionText: string;
  latex: string;
  noteVi: string;
}

export interface DivisorsAndMultiplesResult {
  input: number;
  absValue: number;
  isValid: boolean;
  isZero: boolean;
  divisors: number[];
  divisorCountText: string;
  multiples: number[];
  multipleLimit: number;
  noteVi: string;
}

export interface EuclidStep {
  step: number;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  equationLatex: string;
}

export interface GcdLcmResult {
  a: number;
  b: number;
  isValid: boolean;
  gcdStatus: 'DEFINED' | 'UNDEFINED';
  gcd: number | null;
  lcmStatus: 'DEFINED' | 'CONVENTION_ZERO' | 'OVERFLOW';
  lcm: number | null;
  steps: EuclidStep[];
  explanationVi: string;
  latexGcd: string;
  latexLcm: string;
}

export interface DivisibilityRuleItem {
  divisor: 2 | 3 | 5 | 9;
  divisible: boolean;
  ruleTitleVi: string;
  evidenceVi: string;
}

export interface DivisibilityAuditResult {
  input: number;
  isValid: boolean;
  lastDigit: number;
  digitSum: number;
  digits: number[];
  rules: DivisibilityRuleItem[];
}

export interface EuclideanDivisionResult {
  isValid: boolean;
  errorVi?: string;
  dividend: number;
  divisor: number;
  quotient: number;
  remainder: number;
  isExact: boolean;
  latex: string;
  explanationVi: string;
}

function validateBoundedInteger(n: number): { valid: boolean; value: number; errorVi?: string } {
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
    return { valid: false, value: 0, errorVi: 'Vui lòng nhập một số nguyên hợp lệ.' };
  }
  if (Math.abs(n) > MAX_SAFE_INPUT_INT) {
    return {
      valid: false,
      value: 0,
      errorVi: `Số nhập vào vượt quá giới hạn an toàn (±${MAX_SAFE_INPUT_INT.toLocaleString('vi-VN')}).`,
    };
  }
  return { valid: true, value: n };
}

/**
 * Kiểm tra số nguyên tố chuẩn SGK Toán 6:
 * - Số nguyên tố phải lớn hơn 1
 * - 0, 1 và số âm không phải số nguyên tố
 */
export function isPrime(n: number): boolean {
  if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) return false;
  if (Math.abs(n) > MAX_SAFE_INPUT_INT) return false;
  if (n <= 1) return false;
  if (n === 2 || n === 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;

  const limit = Math.floor(Math.sqrt(n));
  for (let i = 5; i <= limit; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) {
      return false;
    }
  }
  return true;
}

/**
 * Phân loại rõ ràng số nguyên: 0, 1, Nguyên tố, Hợp số, Số nguyên âm
 */
export function classifyNumber(n: number): NumberClassification {
  const check = validateBoundedInteger(n);
  if (!check.valid) {
    return {
      input: n,
      isValidInteger: false,
      category: 'INVALID',
      categoryLabelVi: 'Không hợp lệ',
      isPrime: false,
      isComposite: false,
      explanationVi: check.errorVi || 'Giá trị không hợp lệ.',
      latexSummary: '\\text{Không hợp lệ}',
    };
  }

  if (n < 0) {
    return {
      input: n,
      isValidInteger: true,
      category: 'NEGATIVE',
      categoryLabelVi: 'Số nguyên âm',
      isPrime: false,
      isComposite: false,
      explanationVi: `${n} là số nguyên âm. Trong chương trình THCS, khái niệm số nguyên tố và hợp số chỉ xét trên tập số tự nhiên lớn hơn 1.`,
      latexSummary: `${n} < 0 \\notin \\mathbb{N}`,
    };
  }

  if (n === 0) {
    return {
      input: 0,
      isValidInteger: true,
      category: 'ZERO',
      categoryLabelVi: 'Số 0 (Đặc biệt)',
      isPrime: false,
      isComposite: false,
      explanationVi: 'Số 0 không phải là số nguyên tố và cũng không phải là hợp số (vì mọi số nguyên khác 0 đều là ước của 0).',
      latexSummary: '0 \\text{ không là số nguyên tố, không là hợp số}',
    };
  }

  if (n === 1) {
    return {
      input: 1,
      isValidInteger: true,
      category: 'UNIT_ONE',
      categoryLabelVi: 'Số 1 (Đơn vị)',
      isPrime: false,
      isComposite: false,
      explanationVi: 'Số 1 chỉ có đúng một ước dương là 1, nên không phải số nguyên tố (cần đúng 2 ước là 1 và chính nó) và không phải hợp số.',
      latexSummary: '1 \\text{ chỉ có } 1 \\text{ ước dương}',
    };
  }

  if (isPrime(n)) {
    return {
      input: n,
      isValidInteger: true,
      category: 'PRIME',
      categoryLabelVi: 'Số nguyên tố',
      isPrime: true,
      isComposite: false,
      explanationVi: `${n} là số tự nhiên lớn hơn 1 và chỉ có đúng 2 ước dương là 1 và ${n}.`,
      latexSummary: `${n} \\in \\mathbb{P} \\text{ (Số nguyên tố)}`,
    };
  }

  // Tìm ước nguyên tố nhỏ nhất để làm bằng chứng hợp số
  let smallestFactor = 2;
  if (n % 2 !== 0) {
    for (let d = 3; d * d <= n; d += 2) {
      if (n % d === 0) {
        smallestFactor = d;
        break;
      }
    }
  }
  return {
    input: n,
    isValidInteger: true,
    category: 'COMPOSITE',
    categoryLabelVi: 'Hợp số',
    isPrime: false,
    isComposite: true,
    explanationVi: `${n} là hợp số vì ${n} > 1 và có ít nhất một ước dương khác 1 và ${n} (ví dụ ${n} = ${smallestFactor} × ${n / smallestFactor}).`,
    latexSummary: `${n} = ${smallestFactor} \\cdot ${n / smallestFactor} \\text{ (Hợp số)}`,
  };
}

/**
 * Sàng Eratosthenes an toàn, tách riêng danh sách bước trực quan (<= 200) và tính toán nhanh (<= 100.000)
 */
export function generateEratosthenesSieve(limitInput: number): EratosthenesResult {
  if (!Number.isFinite(limitInput) || !Number.isInteger(limitInput) || limitInput < 2) {
    return {
      isValid: false,
      errorVi: 'Giới hạn N phải là số nguyên lớn hơn hoặc bằng 2.',
      limit: 2,
      visualLimit: 2,
      isVisualTruncated: false,
      primes: [],
      primeCount: 0,
      steps: [],
      smallestFactorMap: {},
    };
  }

  if (limitInput > MAX_FAST_SIEVE_LIMIT) {
    return {
      isValid: false,
      errorVi: `Để đảm bảo hiệu năng trình duyệt, giới hạn N tối đa cho phép là ${MAX_FAST_SIEVE_LIMIT.toLocaleString('vi-VN')}.`,
      limit: limitInput,
      visualLimit: MAX_VISUAL_SIEVE_LIMIT,
      isVisualTruncated: true,
      primes: [],
      primeCount: 0,
      steps: [],
      smallestFactorMap: {},
    };
  }

  const limit = limitInput;
  const visualLimit = Math.min(limit, MAX_VISUAL_SIEVE_LIMIT);
  const isVisualTruncated = limit > MAX_VISUAL_SIEVE_LIMIT;

  const isCompositeArr = new Uint8Array(limit + 1);
  const smallestFactorMap: Record<number, number> = {};
  const steps: SieveStep[] = [];

  const root = Math.floor(Math.sqrt(limit));
  let stepCounter = 0;

  for (let p = 2; p <= root; p++) {
    if (isCompositeArr[p] === 0) {
      const crossedForVisual: number[] = [];
      for (let m = p * p; m <= limit; m += p) {
        if (isCompositeArr[m] === 0) {
          isCompositeArr[m] = 1;
          if (m <= visualLimit) {
            smallestFactorMap[m] = p;
            crossedForVisual.push(m);
          }
        }
      }
      if (p <= Math.floor(Math.sqrt(visualLimit)) || crossedForVisual.length > 0) {
        stepCounter++;
        steps.push({
          stepIndex: stepCounter,
          prime: p,
          crossedMultiples: crossedForVisual,
          descriptionVi:
            crossedForVisual.length > 0
              ? `Giữ lại số nguyên tố ${p}, gạch bỏ ${crossedForVisual.length} bội số chưa bị gạch của ${p} (bắt đầu từ ${p}² = ${p * p}).`
              : `Số nguyên tố ${p} có ${p}² = ${p * p} vượt phạm vi gạch mới trong bảng.`,
        });
      }
    }
  }

  const primes: number[] = [];
  for (let i = 2; i <= limit; i++) {
    if (isCompositeArr[i] === 0) {
      primes.push(i);
    }
  }

  return {
    isValid: true,
    limit,
    visualLimit,
    isVisualTruncated,
    primes,
    primeCount: primes.length,
    steps,
    smallestFactorMap,
  };
}

/**
 * Phân tích thừa số nguyên tố & dựng cây phân tích
 */
export function factorizeNumber(n: number): PrimeFactorizationResult {
  const check = validateBoundedInteger(n);
  if (!check.valid) {
    return {
      input: n,
      isValid: false,
      canFactorize: false,
      isNegative: false,
      absValue: 0,
      factors: [],
      divisionSteps: [],
      tree: null,
      expressionText: 'Không hợp lệ',
      latex: '\\text{Không hợp lệ}',
      noteVi: check.errorVi || 'Số nhập vào không hợp lệ.',
    };
  }

  if (n === 0) {
    return {
      input: 0,
      isValid: true,
      canFactorize: false,
      isNegative: false,
      absValue: 0,
      factors: [],
      divisionSteps: [],
      tree: null,
      expressionText: 'Không phân tích được',
      latex: '0 \\text{ không có phân tích thừa số nguyên tố}',
      noteVi: 'Số 0 không thể viết thành tích các thừa số nguyên tố (vì tích các số nguyên tố luôn khác 0).',
    };
  }

  if (n === 1 || n === -1) {
    return {
      input: n,
      isValid: true,
      canFactorize: false,
      isNegative: n < 0,
      absValue: 1,
      factors: [],
      divisionSteps: [],
      tree: null,
      expressionText: n === 1 ? '1 (Đơn vị)' : '-1',
      latex: n === 1 ? '1 \\text{ (Đơn vị, không có ước nguyên tố)}' : '-1',
      noteVi: 'Số 1 không có ước nguyên tố nào; là trường hợp đặc biệt trong định lý cơ bản của số học.',
    };
  }

  const isNegative = n < 0;
  const absValue = Math.abs(n);

  // 1. Chia thử theo cột dọc từ ước nguyên tố nhỏ nhất
  let rem = absValue;
  const factors: PrimeFactorExponent[] = [];
  const divisionSteps: { dividend: number; divisor: number; quotient: number }[] = [];

  let d = 2;
  while (d * d <= rem) {
    let exp = 0;
    while (rem % d === 0) {
      divisionSteps.push({
        dividend: rem,
        divisor: d,
        quotient: rem / d,
      });
      rem = rem / d;
      exp++;
    }
    if (exp > 0) {
      factors.push({ prime: d, exponent: exp });
    }
    d = d === 2 ? 3 : d + 2;
  }
  if (rem > 1) {
    divisionSteps.push({
      dividend: rem,
      divisor: rem,
      quotient: 1,
    });
    factors.push({ prime: rem, exponent: 1 });
  }

  // 2. Dựng cây phân tích cân đối (ưu tiên tách đôi gần sqrt(val) để cây đẹp trực quan như SGK)
  let nodeSeq = 0;
  const buildTree = (val: number): FactorTreeNode => {
    const id = `ft-${++nodeSeq}`;
    if (isPrime(val)) {
      return { id, value: val, isPrime: true };
    }
    let bestA = 2;
    const sqrtV = Math.floor(Math.sqrt(val));
    for (let cand = sqrtV; cand >= 2; cand--) {
      if (val % cand === 0) {
        bestA = cand;
        break;
      }
    }
    const bestB = val / bestA;
    const leftVal = Math.min(bestA, bestB);
    const rightVal = Math.max(bestA, bestB);
    return {
      id,
      value: val,
      isPrime: false,
      left: buildTree(leftVal),
      right: buildTree(rightVal),
    };
  };

  const tree = buildTree(absValue);

  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };
  const toSup = (num: number) =>
    String(num)
      .split('')
      .map((ch) => superscriptMap[ch] || ch)
      .join('');

  const textParts = factors.map((f) =>
    f.exponent === 1 ? `${f.prime}` : `${f.prime}${toSup(f.exponent)}`
  );
  const latexParts = factors.map((f) =>
    f.exponent === 1 ? `${f.prime}` : `${f.prime}^{${f.exponent}}`
  );

  const expressionText = isNegative ? `-(${textParts.join(' × ')})` : textParts.join(' × ');
  const latex = isNegative
    ? `${n} = -(${latexParts.join(' \\cdot ')})`
    : `${n} = ${latexParts.join(' \\cdot ')}`;

  const noteVi = isNegative
    ? `Quy ước với số nguyên âm: Tách dấu âm và phân tích trị tuyệt đối |${n}| = ${absValue} ra thừa số nguyên tố.`
    : factors.length === 1 && factors[0].exponent === 1
      ? `${absValue} là số nguyên tố nên phân tích là chính nó.`
      : `Đã phân tích ${absValue} thành tích các thừa số nguyên tố duy nhất (tăng dần từ trái sang phải).`;

  return {
    input: n,
    isValid: true,
    canFactorize: true,
    isNegative,
    absValue,
    factors,
    divisionSteps,
    tree,
    expressionText,
    latex,
    noteVi,
  };
}

/**
 * Liệt kê tập ước dương và các bội không âm trong phạm vi giới hạn an toàn
 */
export function getDivisorsAndMultiples(
  n: number,
  multipleLimit = 100
): DivisorsAndMultiplesResult {
  const check = validateBoundedInteger(n);
  const safeMultLimit = Math.min(Math.max(10, Math.trunc(multipleLimit || 100)), 500);

  if (!check.valid) {
    return {
      input: n,
      absValue: 0,
      isValid: false,
      isZero: false,
      divisors: [],
      divisorCountText: 'Không hợp lệ',
      multiples: [],
      multipleLimit: safeMultLimit,
      noteVi: check.errorVi || 'Số nhập vào không hợp lệ.',
    };
  }

  if (n === 0) {
    return {
      input: 0,
      absValue: 0,
      isValid: true,
      isZero: true,
      divisors: [],
      divisorCountText: 'Vô số ước dương (mọi số nguyên dương đều là ước của 0)',
      multiples: [0],
      multipleLimit: safeMultLimit,
      noteVi: 'Số 0 chia hết cho mọi số nguyên khác 0, và chỉ có một bội duy nhất là 0.',
    };
  }

  const absVal = Math.abs(n);
  const smallDivs: number[] = [];
  const largeDivs: number[] = [];
  const root = Math.floor(Math.sqrt(absVal));

  for (let d = 1; d <= root; d++) {
    if (absVal % d === 0) {
      smallDivs.push(d);
      if (d !== absVal / d) {
        largeDivs.unshift(absVal / d);
      }
    }
  }
  const divisors = [...smallDivs, ...largeDivs];

  const multiples: number[] = [];
  for (let k = 0; k * absVal <= safeMultLimit && multiples.length < 60; k++) {
    multiples.push(k * absVal);
  }

  return {
    input: n,
    absValue: absVal,
    isValid: true,
    isZero: false,
    divisors,
    divisorCountText: `${divisors.length} ước dương`,
    multiples,
    multipleLimit: safeMultLimit,
    noteVi:
      n < 0
        ? `Theo quy ước, các ước dương và bội không âm của ${n} trùng với của |${n}| = ${absVal}.`
        : `Số ${absVal} có ${divisors.length} ước dương và ${multiples.length} bội trong phạm vi 0 đến ${safeMultLimit}.`,
  };
}

/**
 * Thuật toán Euclid tìm ƯCLN và tính BCNN = |a / ƯCLN(a, b) * b|
 * - Xử lý gcd(0, 0) là trường hợp KHÔNG XÁC ĐỊNH (UNDEFINED)
 * - Quy ước gcd(0, b) = |b| khi b != 0; lcm(0, b) = 0
 */
export function computeGcdAndLcm(a: number, b: number): GcdLcmResult {
  const checkA = validateBoundedInteger(a);
  const checkB = validateBoundedInteger(b);
  if (!checkA.valid || !checkB.valid) {
    return {
      a,
      b,
      isValid: false,
      gcdStatus: 'UNDEFINED',
      gcd: null,
      lcmStatus: 'OVERFLOW',
      lcm: null,
      steps: [],
      explanationVi: checkA.errorVi || checkB.errorVi || 'Đầu vào không hợp lệ.',
      latexGcd: '\\text{Không hợp lệ}',
      latexLcm: '\\text{Không hợp lệ}',
    };
  }

  const absA = Math.abs(a);
  const absB = Math.abs(b);

  if (absA === 0 && absB === 0) {
    return {
      a,
      b,
      isValid: true,
      gcdStatus: 'UNDEFINED',
      gcd: null,
      lcmStatus: 'CONVENTION_ZERO',
      lcm: 0,
      steps: [],
      explanationVi:
        'ƯCLN(0, 0) không xác định vì mọi số nguyên dương đều là ước chung của 0 và 0 (không có ước chung lớn nhất). Theo quy ước, BCNN(0, 0) = 0.',
      latexGcd: '\\text{ƯCLN}(0, 0) \\text{ không xác định}',
      latexLcm: '\\text{BCNN}(0, 0) = 0 \\text{ (quy ước)}',
    };
  }

  if (absA === 0 || absB === 0) {
    const g = Math.max(absA, absB);
    return {
      a,
      b,
      isValid: true,
      gcdStatus: 'DEFINED',
      gcd: g,
      lcmStatus: 'CONVENTION_ZERO',
      lcm: 0,
      steps: [],
      explanationVi: `Mọi số nguyên dương đều là ước của 0, nên ƯCLN(${a}, ${b}) = |${g}| = ${g}. Khi một trong hai số bằng 0, BCNN(${a}, ${b}) = 0 theo quy ước.`,
      latexGcd: `\\text{ƯCLN}(${a}, ${b}) = ${g}`,
      latexLcm: `\\text{BCNN}(${a}, ${b}) = 0`,
    };
  }

  let x = Math.max(absA, absB);
  let y = Math.min(absA, absB);
  const steps: EuclidStep[] = [];
  let idx = 0;

  while (y !== 0) {
    idx++;
    const q = Math.floor(x / y);
    const r = x % y;
    steps.push({
      step: idx,
      dividend: x,
      divisor: y,
      quotient: q,
      remainder: r,
      equationLatex: `${x} = ${y} \\cdot ${q} + ${r}`,
    });
    x = y;
    y = r;
  }

  const g = x;
  // Chia trước nhân sau để tránh tràn số trung gian
  const divided = absA / g;
  const prod = divided * absB;
  const isSafeLcm = Number.isSafeInteger(prod);

  return {
    a,
    b,
    isValid: true,
    gcdStatus: 'DEFINED',
    gcd: g,
    lcmStatus: isSafeLcm ? 'DEFINED' : 'OVERFLOW',
    lcm: isSafeLcm ? prod : null,
    steps,
    explanationVi:
      a < 0 || b < 0
        ? `Áp dụng thuật toán Euclid trên |${a}| = ${absA} và |${b}| = ${absB} qua ${steps.length} phép chia, thu được ƯCLN(${a}, ${b}) = ${g}.`
        : `Áp dụng thuật toán Euclid qua ${steps.length} bước chia có dư, số dư khác 0 cuối cùng là ${g}.`,
    latexGcd: `\\text{ƯCLN}(${a}, ${b}) = ${g}`,
    latexLcm: isSafeLcm
      ? `\\text{BCNN}(${a}, ${b}) = \\left|\\frac{${a}}{${g}} \\times ${b}\\right| = ${prod}`
      : `\\text{BCNN}(${a}, ${b}) \\text{ vượt giới hạn số nguyên an toàn}`,
  };
}

/**
 * Kiểm tra dấu hiệu chia hết cho 2, 3, 5, 9
 */
export function checkDivisibilityRules(n: number): DivisibilityAuditResult {
  const check = validateBoundedInteger(n);
  if (!check.valid) {
    return {
      input: n,
      isValid: false,
      lastDigit: 0,
      digitSum: 0,
      digits: [],
      rules: [],
    };
  }

  const digits = String(Math.abs(n))
    .split('')
    .map((ch) => Number(ch));
  const lastDigit = digits[digits.length - 1] ?? 0;
  const digitSum = digits.reduce((acc, d) => acc + d, 0);

  const div2 = lastDigit % 2 === 0;
  const div5 = lastDigit === 0 || lastDigit === 5;
  const div3 = digitSum % 3 === 0;
  const div9 = digitSum % 9 === 0;

  return {
    input: n,
    isValid: true,
    lastDigit,
    digitSum,
    digits,
    rules: [
      {
        divisor: 2,
        divisible: div2,
        ruleTitleVi: 'Chia hết cho 2 (Chữ số tận cùng là 0, 2, 4, 6, 8)',
        evidenceVi: `Chữ số tận cùng là ${lastDigit} (${div2 ? 'chẵn → chia hết cho 2' : 'lẻ → không chia hết cho 2'}).`,
      },
      {
        divisor: 5,
        divisible: div5,
        ruleTitleVi: 'Chia hết cho 5 (Chữ số tận cùng là 0 hoặc 5)',
        evidenceVi: `Chữ số tận cùng là ${lastDigit} (${div5 ? 'thuộc {0, 5} → chia hết cho 5' : 'khác 0 và 5 → không chia hết cho 5'}).`,
      },
      {
        divisor: 3,
        divisible: div3,
        ruleTitleVi: 'Chia hết cho 3 (Tổng các chữ số chia hết cho 3)',
        evidenceVi: `Tổng các chữ số = ${digits.join(' + ')} = ${digitSum} (${div3 ? `${digitSum} ⋮ 3` : `${digitSum} ⋮̸ 3`}).`,
      },
      {
        divisor: 9,
        divisible: div9,
        ruleTitleVi: 'Chia hết cho 9 (Tổng các chữ số chia hết cho 9)',
        evidenceVi: `Tổng các chữ số = ${digits.join(' + ')} = ${digitSum} (${div9 ? `${digitSum} ⋮ 9` : `${digitSum} ⋮̸ 9`}).`,
      },
    ],
  };
}

/**
 * Phép chia có dư chuẩn Euclid: a = b * q + r với 0 <= r < |b|
 */
export function euclideanDivision(dividend: number, divisor: number): EuclideanDivisionResult {
  const checkA = validateBoundedInteger(dividend);
  const checkB = validateBoundedInteger(divisor);
  if (!checkA.valid || !checkB.valid) {
    return {
      isValid: false,
      errorVi: checkA.errorVi || checkB.errorVi || 'Số nhập vào không hợp lệ.',
      dividend,
      divisor,
      quotient: 0,
      remainder: 0,
      isExact: false,
      latex: '\\text{Không hợp lệ}',
      explanationVi: 'Vui lòng nhập hai số nguyên hợp lệ.',
    };
  }

  if (divisor === 0) {
    return {
      isValid: false,
      errorVi: 'Lỗi toán học: Không thể thực hiện phép chia cho 0.',
      dividend,
      divisor: 0,
      quotient: 0,
      remainder: 0,
      isExact: false,
      latex: '\\text{Không xác định (chia cho } 0)',
      explanationVi: 'Số chia phải là số nguyên khác 0.',
    };
  }

  const absB = Math.abs(divisor);
  let r = dividend % absB;
  if (r < 0) r += absB;
  const q = (dividend - r) / divisor;

  return {
    isValid: true,
    dividend,
    divisor,
    quotient: q,
    remainder: r,
    isExact: r === 0,
    latex: `${dividend} = ${divisor < 0 ? `(${divisor})` : divisor} \\cdot ${q < 0 ? `(${q})` : q} + ${r} \\quad (0 \\le ${r} < ${absB})`,
    explanationVi:
      r === 0
        ? `${dividend} chia hết cho ${divisor}, thương bằng ${q}, số dư r = 0.`
        : `${dividend} chia cho ${divisor} được thương q = ${q} và số dư r = ${r} (thỏa mãn 0 ≤ r < |${divisor}|).`,
  };
}

// ============================================================================
// BỘ KIỂM THỬ TỰ ĐỘNG M13 (12 TEST CASE BẮT BUỘC)
// ============================================================================

export interface M13UnitTestCaseResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runM13UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: M13UnitTestCaseResult[];
} {
  const cases: M13UnitTestCaseResult[] = [];

  // 1-5: Kiểm tra số nguyên tố
  cases.push({
    id: 'm13_prime_2',
    label: 'prime(2) === true',
    passed: isPrime(2) === true,
    detail: `Kết quả: ${isPrime(2)}`,
  });
  cases.push({
    id: 'm13_prime_1',
    label: 'prime(1) === false',
    passed: isPrime(1) === false,
    detail: `Kết quả: ${isPrime(1)}`,
  });
  cases.push({
    id: 'm13_prime_0',
    label: 'prime(0) === false',
    passed: isPrime(0) === false,
    detail: `Kết quả: ${isPrime(0)}`,
  });
  cases.push({
    id: 'm13_prime_97',
    label: 'prime(97) === true',
    passed: isPrime(97) === true,
    detail: `Kết quả: ${isPrime(97)}`,
  });
  cases.push({
    id: 'm13_prime_100',
    label: 'prime(100) === false',
    passed: isPrime(100) === false,
    detail: `Kết quả: ${isPrime(100)}`,
  });

  // 6: factor(60) = 2^2 * 3 * 5 & factor(0) không phân tích
  const f60 = factorizeNumber(60);
  const f0 = factorizeNumber(0);
  const f60Valid =
    f60.canFactorize &&
    f60.factors.length === 3 &&
    f60.factors[0].prime === 2 &&
    f60.factors[0].exponent === 2 &&
    f60.factors[1].prime === 3 &&
    f60.factors[1].exponent === 1 &&
    f60.factors[2].prime === 5 &&
    f60.factors[2].exponent === 1 &&
    !f0.canFactorize;
  cases.push({
    id: 'm13_factor_60_and_0',
    label: 'factor(60) = 2²×3×5 & chặn factor(0)',
    passed: f60Valid,
    detail: `factor(60): ${f60.expressionText}; factor(0): canFactorize=${f0.canFactorize}`,
  });

  // 7: gcd(24, 36) = 12
  const g24_36 = computeGcdAndLcm(24, 36);
  cases.push({
    id: 'm13_gcd_24_36',
    label: 'gcd(24, 36) === 12',
    passed: g24_36.gcdStatus === 'DEFINED' && g24_36.gcd === 12,
    detail: `Kết quả: ${g24_36.gcd}`,
  });

  // 8: lcm(12, 18) = 36
  const l12_18 = computeGcdAndLcm(12, 18);
  cases.push({
    id: 'm13_lcm_12_18',
    label: 'lcm(12, 18) === 36',
    passed: l12_18.lcmStatus === 'DEFINED' && l12_18.lcm === 36,
    detail: `Kết quả: ${l12_18.lcm}`,
  });

  // 9-10: gcd(0, 5) = 5 & lcm(0, 5) = 0
  const gl0_5 = computeGcdAndLcm(0, 5);
  cases.push({
    id: 'm13_gcd_0_5',
    label: 'gcd(0, 5) === 5',
    passed: gl0_5.gcdStatus === 'DEFINED' && gl0_5.gcd === 5,
    detail: `Kết quả: ${gl0_5.gcd}`,
  });
  cases.push({
    id: 'm13_lcm_0_5',
    label: 'lcm(0, 5) === 0 (quy ước)',
    passed: gl0_5.lcmStatus === 'CONVENTION_ZERO' && gl0_5.lcm === 0,
    detail: `Kết quả: ${gl0_5.lcm}`,
  });

  // 11: gcd(0, 0) là trường hợp không xác định
  const gl0_0 = computeGcdAndLcm(0, 0);
  cases.push({
    id: 'm13_gcd_0_0_undefined',
    label: 'gcd(0, 0) === UNDEFINED',
    passed: gl0_0.gcdStatus === 'UNDEFINED' && gl0_0.gcd === null,
    detail: `Trạng thái: ${gl0_0.gcdStatus}`,
  });

  // 12: Sàng N = 100 có đúng 25 số nguyên tố
  const sieve100 = generateEratosthenesSieve(100);
  cases.push({
    id: 'm13_sieve_100',
    label: 'Sàng Eratosthenes N=100 có đúng 25 số nguyên tố',
    passed: sieve100.isValid && sieve100.primeCount === 25,
    detail: `Số lượng: ${sieve100.primeCount}`,
  });

  // 13 (bổ sung): Kiểm tra chia có dư số âm & chặn chia 0
  const divZero = euclideanDivision(17, 0);
  const divNeg = euclideanDivision(-17, 5);
  cases.push({
    id: 'm13_div_guards',
    label: 'Phép chia có dư: chặn chia 0 & xử lý -17 = 5×(-4) + 3',
    passed: !divZero.isValid && divNeg.isValid && divNeg.quotient === -4 && divNeg.remainder === 3,
    detail: `-17 = 5×${divNeg.quotient} + ${divNeg.remainder}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
