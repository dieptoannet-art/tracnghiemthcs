// ============================================================================
// TÂY ĐÔ SMART EDU — TOÁN 9 (KẾT NỐI TRI THỨC VỚI CUỘC SỐNG)
// CHƯƠNG I • BÀI 2: GIẢI HỆ HAI PHƯƠNG TRÌNH BẬC NHẤT HAI ẨN
// Pure Exact-Rational Algebraic Engine, Step Verifier & Complete Textbook Data
// ============================================================================

export interface ExactRational {
  readonly num: number;
  readonly den: number; // Always > 0, gcd(|num|, den) === 1
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0 ? 1 : x;
}

export function makeRational(num: number, den: number = 1): ExactRational {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
    throw new Error('Mẫu số phải khác 0 và hệ số phải hữu hạn.');
  }
  // Handle float inputs cleanly by scaling up to 10^6 if needed
  let n = num;
  let d = den;
  let scale = 1;
  while (
    (Math.abs(n - Math.round(n)) > 1e-9 || Math.abs(d - Math.round(d)) > 1e-9) &&
    scale < 1_000_000
  ) {
    n *= 10;
    d *= 10;
    scale *= 10;
  }
  n = Math.round(n);
  d = Math.round(d);
  if (d < 0) {
    n = -n;
    d = -d;
  }
  if (n === 0) {
    return { num: 0, den: 1 };
  }
  const g = gcdInt(n, d);
  return { num: n / g, den: d / g };
}

export const ZERO_RAT: ExactRational = { num: 0, den: 1 };
export const ONE_RAT: ExactRational = { num: 1, den: 1 };

export function addRat(a: ExactRational, b: ExactRational): ExactRational {
  return makeRational(a.num * b.den + b.num * a.den, a.den * b.den);
}

export function subRat(a: ExactRational, b: ExactRational): ExactRational {
  return makeRational(a.num * b.den - b.num * a.den, a.den * b.den);
}

export function mulRat(a: ExactRational, b: ExactRational): ExactRational {
  return makeRational(a.num * b.num, a.den * b.den);
}

export function divRat(a: ExactRational, b: ExactRational): ExactRational {
  if (b.num === 0) {
    throw new Error('Không thể chia cho 0.');
  }
  return makeRational(a.num * b.den, a.den * b.num);
}

export function negRat(a: ExactRational): ExactRational {
  return a.num === 0 ? ZERO_RAT : { num: -a.num, den: a.den };
}

export function eqRat(a: ExactRational, b: ExactRational): boolean {
  return a.num * b.den === b.num * a.den;
}

export function isZeroRat(a: ExactRational): boolean {
  return a.num === 0;
}

export function formatRational(
  r: ExactRational,
  mode: 'fraction' | 'vi_decimal_if_clean' = 'fraction'
): string {
  if (r.den === 1) return String(r.num);
  if (mode === 'vi_decimal_if_clean') {
    // Check if denominator only has prime factors 2 and 5
    let d = r.den;
    while (d % 2 === 0) d /= 2;
    while (d % 5 === 0) d /= 5;
    if (d === 1) {
      const val = r.num / r.den;
      return String(val).replace('.', ',');
    }
  }
  return r.num < 0 ? `-${Math.abs(r.num)}/${r.den}` : `${r.num}/${r.den}`;
}

export function parseRationalInput(raw: string): ExactRational | null {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(/,/g, '.');
  if (!cleaned) return null;

  // Fraction format: a/b
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    if (parts.length !== 2) return null;
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return makeRational(num, den);
  }

  const val = Number(cleaned);
  if (!Number.isFinite(val)) return null;
  return makeRational(val, 1);
}

// ============================================================================
// 2D LINEAR FORM: a*x + b*y + c (where equation is a*x + b*y = rhs)
// ============================================================================

export interface LinearExpr2D {
  readonly a: ExactRational; // coeff of x (or t)
  readonly b: ExactRational; // coeff of y
  readonly c: ExactRational; // constant term
}

export interface LinearEquation2D {
  readonly a: ExactRational; // coeff of x
  readonly b: ExactRational; // coeff of y
  readonly c: ExactRational; // RHS constant: a*x + b*y = c
}

export interface LinearSystem2x2 {
  readonly eq1: LinearEquation2D;
  readonly eq2: LinearEquation2D;
}

// ============================================================================
// SAFE RECURSIVE-DESCENT ALGEBRAIC PARSER (NO eval / NO Function)
// Supports variables x, y, t, s, parentheses, +, -, *, /, implicit multiplication,
// Vietnamese comma decimals (e.g. -0,5x + 1,5y = 1)
// ============================================================================

type Token =
  | { type: 'num'; value: ExactRational }
  | { type: 'var'; name: 'x' | 'y' | 't' }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

function tokenizeLinearExpr(input: string): Token[] | null {
  const s = input
    .trim()
    .replace(/−/g, '-')
    .replace(/⋅|·|×/g, '*')
    .replace(/(\d),(\d)/g, '$1.$2'); // Vietnamese decimal comma -> dot

  if (!s) return null;
  const tokens: Token[] = [];
  let i = 0;

  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', op: ch });
      i++;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      tokens.push({ type: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      tokens.push({ type: 'rparen' });
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < s.length && /[0-9.]/.test(s[i])) {
        if (s[i] === '.') dotCount++;
        if (dotCount > 1) return null;
        numStr += s[i];
        i++;
      }
      const val = Number(numStr);
      if (!Number.isFinite(val)) return null;
      tokens.push({ type: 'num', value: makeRational(val, 1) });
      continue;
    }
    if (/[xytsXYTS]/.test(ch)) {
      const lower = ch.toLowerCase();
      const mapped: 'x' | 'y' | 't' = lower === 's' ? 't' : (lower as 'x' | 'y' | 't');
      tokens.push({ type: 'var', name: mapped });
      i++;
      continue;
    }
    return null;
  }

  // Insert implicit '*' between:
  // num -> var | lparen
  // rparen -> num | var | lparen
  // var -> lparen
  const expanded: Token[] = [];
  for (let idx = 0; idx < tokens.length; idx++) {
    const curr = tokens[idx];
    expanded.push(curr);
    if (idx + 1 < tokens.length) {
      const next = tokens[idx + 1];
      const needMul =
        (curr.type === 'num' && (next.type === 'var' || next.type === 'lparen')) ||
        (curr.type === 'rparen' &&
          (next.type === 'num' || next.type === 'var' || next.type === 'lparen')) ||
        (curr.type === 'var' && next.type === 'lparen');
      if (needMul) {
        expanded.push({ type: 'op', op: '*' });
      }
    }
  }
  return expanded;
}

function addExpr(e1: LinearExpr2D, e2: LinearExpr2D): LinearExpr2D {
  return {
    a: addRat(e1.a, e2.a),
    b: addRat(e1.b, e2.b),
    c: addRat(e1.c, e2.c),
  };
}

function subExpr(e1: LinearExpr2D, e2: LinearExpr2D): LinearExpr2D {
  return {
    a: subRat(e1.a, e2.a),
    b: subRat(e1.b, e2.b),
    c: subRat(e1.c, e2.c),
  };
}

function mulExpr(e1: LinearExpr2D, e2: LinearExpr2D): LinearExpr2D | null {
  const e1IsConst = isZeroRat(e1.a) && isZeroRat(e1.b);
  const e2IsConst = isZeroRat(e2.a) && isZeroRat(e2.b);
  if (e1IsConst) {
    return {
      a: mulRat(e1.c, e2.a),
      b: mulRat(e1.c, e2.b),
      c: mulRat(e1.c, e2.c),
    };
  }
  if (e2IsConst) {
    return {
      a: mulRat(e1.a, e2.c),
      b: mulRat(e1.b, e2.c),
      c: mulRat(e1.c, e2.c),
    };
  }
  // Degree > 1 not allowed in linear expressions
  return null;
}

function divExpr(e1: LinearExpr2D, e2: LinearExpr2D): LinearExpr2D | null {
  const e2IsConst = isZeroRat(e2.a) && isZeroRat(e2.b);
  if (!e2IsConst || isZeroRat(e2.c)) return null;
  return {
    a: divRat(e1.a, e2.c),
    b: divRat(e1.b, e2.c),
    c: divRat(e1.c, e2.c),
  };
}

export function parseLinearExpression2D(raw: string): LinearExpr2D | null {
  const tokens = tokenizeLinearExpr(raw);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;

  function parseExpression(): LinearExpr2D | null {
    const first = parseTerm();
    if (!first) return null;
    let current: LinearExpr2D = first;
    while (pos < tokens!.length) {
      const tok = tokens![pos];
      if (tok.type === 'op' && (tok.op === '+' || tok.op === '-')) {
        pos++;
        const right = parseTerm();
        if (!right) return null;
        current = tok.op === '+' ? addExpr(current, right) : subExpr(current, right);
      } else {
        break;
      }
    }
    return current;
  }

  function parseTerm(): LinearExpr2D | null {
    const first = parseFactor();
    if (!first) return null;
    let current: LinearExpr2D = first;
    while (pos < tokens!.length) {
      const tok = tokens![pos];
      if (tok.type === 'op' && (tok.op === '*' || tok.op === '/')) {
        pos++;
        const right = parseFactor();
        if (!right) return null;
        const combined = tok.op === '*' ? mulExpr(current, right) : divExpr(current, right);
        if (!combined) return null;
        current = combined;
      } else {
        break;
      }
    }
    return current;
  }

  function parseFactor(): LinearExpr2D | null {
    if (pos >= tokens!.length) return null;
    const tok = tokens![pos];

    if (tok.type === 'op' && (tok.op === '+' || tok.op === '-')) {
      pos++;
      const inner = parseFactor();
      if (!inner) return null;
      if (tok.op === '-') {
        return {
          a: negRat(inner.a),
          b: negRat(inner.b),
          c: negRat(inner.c),
        };
      }
      return inner;
    }

    if (tok.type === 'num') {
      pos++;
      return { a: ZERO_RAT, b: ZERO_RAT, c: tok.value };
    }

    if (tok.type === 'var') {
      pos++;
      if (tok.name === 'x' || tok.name === 't') {
        return { a: ONE_RAT, b: ZERO_RAT, c: ZERO_RAT };
      }
      return { a: ZERO_RAT, b: ONE_RAT, c: ZERO_RAT };
    }

    if (tok.type === 'lparen') {
      pos++;
      const inside = parseExpression();
      if (!inside) return null;
      if (pos >= tokens!.length || tokens![pos].type !== 'rparen') return null;
      pos++;
      return inside;
    }

    return null;
  }

  const result = parseExpression();
  if (!result || pos !== tokens.length) return null;
  return result;
}

export function parseLinearEquation2D(raw: string): LinearEquation2D | null {
  const parts = raw.split('=');
  if (parts.length !== 2) return null;
  const lhs = parseLinearExpression2D(parts[0]);
  const rhs = parseLinearExpression2D(parts[1]);
  if (!lhs || !rhs) return null;
  // (lhs.a - rhs.a)x + (lhs.b - rhs.b)y = rhs.c - lhs.c
  return {
    a: subRat(lhs.a, rhs.a),
    b: subRat(lhs.b, rhs.b),
    c: subRat(rhs.c, lhs.c),
  };
}

// ============================================================================
// EXACT 2x2 LINEAR SYSTEM SOLVER & CLASSIFIER (WITH FULL RANK / D=0 HANDLING)
// ============================================================================

export type SystemSolutionType = 'unique' | 'no_solution' | 'infinite_solutions';

export interface ParametricSolutionForm {
  readonly freeVar: 'x' | 'y';
  readonly xExprDisplay: string; // e.g. "t" or "-3t - 1"
  readonly yExprDisplay: string; // e.g. "t - 2" or "t"
  // x(t) = xSlope * t + xConst, y(t) = ySlope * t + yConst
  readonly xSlope: ExactRational;
  readonly xConst: ExactRational;
  readonly ySlope: ExactRational;
  readonly yConst: ExactRational;
  readonly constraintEq: LinearEquation2D; // Reduced independent equation a*x + b*y = c
}

export interface SystemSolutionResult {
  readonly status: SystemSolutionType;
  readonly D: ExactRational;
  readonly Dx: ExactRational;
  readonly Dy: ExactRational;
  readonly x?: ExactRational;
  readonly y?: ExactRational;
  readonly parametric?: ParametricSolutionForm;
  readonly intermediateZeroEqDisplay: string; // e.g. "0y = 12" or "0x = 0"
  readonly geometricRelation: 'intersecting' | 'parallel_distinct' | 'coincident';
  readonly summaryVi: string;
}

function formatLinearCombinationInT(slope: ExactRational, constant: ExactRational): string {
  if (isZeroRat(slope)) {
    return formatRational(constant);
  }
  let tPart = '';
  if (eqRat(slope, ONE_RAT)) {
    tPart = 't';
  } else if (eqRat(slope, negRat(ONE_RAT))) {
    tPart = '-t';
  } else {
    tPart = `${formatRational(slope)}t`;
  }

  if (isZeroRat(constant)) {
    return tPart;
  }
  if (constant.num > 0) {
    return `${tPart} + ${formatRational(constant)}`;
  }
  return `${tPart} - ${formatRational(negRat(constant))}`;
}

export function solveLinearSystem2x2(system: LinearSystem2x2): SystemSolutionResult {
  const { eq1, eq2 } = system;
  const D = subRat(mulRat(eq1.a, eq2.b), mulRat(eq2.a, eq1.b));
  const Dx = subRat(mulRat(eq1.c, eq2.b), mulRat(eq2.c, eq1.b));
  const Dy = subRat(mulRat(eq1.a, eq2.c), mulRat(eq2.a, eq1.c));

  // Case 1: Unique solution (D != 0)
  if (!isZeroRat(D)) {
    const x = divRat(Dx, D);
    const y = divRat(Dy, D);
    return {
      status: 'unique',
      D,
      Dx,
      Dy,
      x,
      y,
      intermediateZeroEqDisplay: '',
      geometricRelation: 'intersecting',
      summaryVi: `Hệ có nghiệm duy nhất (${formatRational(x)}; ${formatRational(y)}).`,
    };
  }

  // Case 2: D === 0 (either no_solution or infinite_solutions)
  // Check individual equation validity first (handles 0x + 0y = c edge cases)
  const eq1AllZeroCoeffs = isZeroRat(eq1.a) && isZeroRat(eq1.b);
  const eq2AllZeroCoeffs = isZeroRat(eq2.a) && isZeroRat(eq2.b);

  if (eq1AllZeroCoeffs && !isZeroRat(eq1.c)) {
    return {
      status: 'no_solution',
      D,
      Dx,
      Dy,
      intermediateZeroEqDisplay: `0x = ${formatRational(eq1.c)}`,
      geometricRelation: 'parallel_distinct',
      summaryVi: 'Hệ phương trình vô nghiệm.',
    };
  }
  if (eq2AllZeroCoeffs && !isZeroRat(eq2.c)) {
    return {
      status: 'no_solution',
      D,
      Dx,
      Dy,
      intermediateZeroEqDisplay: `0x = ${formatRational(eq2.c)}`,
      geometricRelation: 'parallel_distinct',
      summaryVi: 'Hệ phương trình vô nghiệm.',
    };
  }

  // If Dx != 0 or Dy != 0 when D == 0 -> inconsistent (no solution)
  if (!isZeroRat(Dx) || !isZeroRat(Dy)) {
    const nonZeroConst = !isZeroRat(Dx) ? Dx : Dy;
    return {
      status: 'no_solution',
      D,
      Dx,
      Dy,
      intermediateZeroEqDisplay: `0x = ${formatRational(nonZeroConst)}`,
      geometricRelation: 'parallel_distinct',
      summaryVi: 'Hệ phương trình vô nghiệm.',
    };
  }

  // Both D == 0, Dx == 0, Dy == 0, and neither equation is 0 = non-zero
  // Pick the non-trivial equation as the defining linear relation between x and y
  const baseEq = !eq1AllZeroCoeffs ? eq1 : eq2;

  if (isZeroRat(baseEq.a) && isZeroRat(baseEq.b)) {
    // Trivial 0 = 0 system
    return {
      status: 'infinite_solutions',
      D,
      Dx,
      Dy,
      intermediateZeroEqDisplay: '0x = 0',
      geometricRelation: 'coincident',
      summaryVi: 'Hệ phương trình có vô số nghiệm.',
    };
  }

  // Build clean parameterization without any division by zero:
  // If b != 0 and (|b| == 1 or |a| != 1): express y in terms of x = t -> y = (-a/b)t + (c/b)
  // If a != 0 and |a| == 1 and |b| != 1: express x in terms of y = t -> x = (-b/a)t + (c/a)
  const absA = Math.abs(baseEq.a.num);
  const absB = Math.abs(baseEq.b.num);

  if (
    !isZeroRat(baseEq.b) &&
    (isZeroRat(baseEq.a) ||
      (absB === 1 && baseEq.b.den === 1) ||
      !(absA === 1 && baseEq.a.den === 1))
  ) {
    // x = t, y = (-a/b)t + c/b
    const ySlope = divRat(negRat(baseEq.a), baseEq.b);
    const yConst = divRat(baseEq.c, baseEq.b);
    const xExprDisplay = 't';
    const yExprDisplay = formatLinearCombinationInT(ySlope, yConst);
    return {
      status: 'infinite_solutions',
      D,
      Dx,
      Dy,
      parametric: {
        freeVar: 'x',
        xExprDisplay,
        yExprDisplay,
        xSlope: ONE_RAT,
        xConst: ZERO_RAT,
        ySlope,
        yConst,
        constraintEq: baseEq,
      },
      intermediateZeroEqDisplay: '0x = 0',
      geometricRelation: 'coincident',
      summaryVi: `Hệ có vô số nghiệm (${xExprDisplay}; ${yExprDisplay}) với t ∈ ℝ.`,
    };
  } else {
    // y = t, x = (-b/a)t + c/a (safe since baseEq.a != 0 here)
    const xSlope = divRat(negRat(baseEq.b), baseEq.a);
    const xConst = divRat(baseEq.c, baseEq.a);
    const xExprDisplay = formatLinearCombinationInT(xSlope, xConst);
    const yExprDisplay = 't';
    return {
      status: 'infinite_solutions',
      D,
      Dx,
      Dy,
      parametric: {
        freeVar: 'y',
        xExprDisplay,
        yExprDisplay,
        xSlope,
        xConst,
        ySlope: ONE_RAT,
        yConst: ZERO_RAT,
        constraintEq: baseEq,
      },
      intermediateZeroEqDisplay: '0y = 0',
      geometricRelation: 'coincident',
      summaryVi: `Hệ có vô số nghiệm (${xExprDisplay}; ${yExprDisplay}) với t ∈ ℝ.`,
    };
  }
}

// ============================================================================
// STEP-BY-STEP ALGEBRAIC EQUIVALENCE VERIFIERS & ERROR DIAGNOSTICS
// ============================================================================

export interface StepVerificationFeedback {
  readonly isValid: boolean;
  readonly errorCode?:
    | 'parse_error'
    | 'wrong_sign_transpose'
    | 'missing_parentheses'
    | 'substituted_same_equation'
    | 'forgot_rhs_multiplication'
    | 'wrong_sign_subtraction'
    | 'valid_but_not_eliminated'
    | 'only_satisfies_one_equation'
    | 'algebraic_mismatch';
  readonly messageVi: string;
  readonly hintVi?: string;
}

/**
 * Checks whether two linear equations in (x, y) are non-zero scalar multiples of each other.
 */
export function areLinearEquationsEquivalent(
  eqA: LinearEquation2D,
  eqB: LinearEquation2D
): boolean {
  const aZero = isZeroRat(eqA.a) && isZeroRat(eqA.b);
  const bZero = isZeroRat(eqB.a) && isZeroRat(eqB.b);
  if (aZero && bZero) {
    if (isZeroRat(eqA.c) && isZeroRat(eqB.c)) return true;
    if (!isZeroRat(eqA.c) && !isZeroRat(eqB.c)) return true; // Both inconsistent 0 = k
    return false;
  }
  if (aZero !== bZero) return false;

  // Check all 2x2 minors of [a, b, c] matrix
  const mAB = subRat(mulRat(eqA.a, eqB.b), mulRat(eqB.a, eqA.b));
  const mAC = subRat(mulRat(eqA.a, eqB.c), mulRat(eqB.a, eqA.c));
  const mBC = subRat(mulRat(eqA.b, eqB.c), mulRat(eqB.b, eqA.c));

  return isZeroRat(mAB) && isZeroRat(mAC) && isZeroRat(mBC);
}

/**
 * Verifies Step 1 of Substitution: Expressing `targetVar` ('x' or 'y') in terms of the other variable
 * from `chosenEqIndex` (1 or 2). Also accepts full equation like `y = 2x - 3` or just RHS `2x - 3`.
 */
export function verifySubstitutionIsolationStep(
  system: LinearSystem2x2,
  chosenEqIndex: 1 | 2,
  targetVar: 'x' | 'y',
  userRawInput: string
): StepVerificationFeedback {
  const trimmed = userRawInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Em hãy nhập biểu thức biểu diễn ẩn trước khi kiểm tra.',
    };
  }

  // Allow user to type either "y = 2x - 3" or "2x - 3"
  let rhsStr = trimmed;
  if (trimmed.includes('=')) {
    const parts = trimmed.split('=');
    if (parts.length !== 2) {
      return {
        isValid: false,
        errorCode: 'parse_error',
        messageVi: 'Biểu thức chứa nhiều dấu "=" không hợp lệ.',
      };
    }
    const lhsTrim = parts[0].trim().toLowerCase();
    if (lhsTrim !== targetVar) {
      return {
        isValid: false,
        errorCode: 'parse_error',
        messageVi: `Vế trái cần là ẩn ${targetVar} (ví dụ: ${targetVar} = ...).`,
      };
    }
    rhsStr = parts[1].trim();
  }

  const parsedRhs = parseLinearExpression2D(rhsStr);
  if (!parsedRhs) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Không đọc được biểu thức đại số. Hãy dùng biến x, y và các phép tính +, -, *, /.',
    };
  }

  // Ensure the isolated variable does NOT still appear on the RHS
  if (targetVar === 'y' && !isZeroRat(parsedRhs.b)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Biểu thức vế phải vẫn còn chứa ẩn y. Em cần biểu diễn y chỉ theo ẩn x.',
    };
  }
  if (targetVar === 'x' && !isZeroRat(parsedRhs.a)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Biểu thức vế phải vẫn còn chứa ẩn x. Em cần biểu diễn x chỉ theo ẩn y.',
    };
  }

  // Form equivalent equation: targetVar - parsedRhs = 0
  const userEq: LinearEquation2D =
    targetVar === 'y'
      ? {
          a: negRat(parsedRhs.a),
          b: ONE_RAT,
          c: parsedRhs.c,
        }
      : {
          a: ONE_RAT,
          b: negRat(parsedRhs.b),
          c: parsedRhs.c,
        };

  const targetEq = chosenEqIndex === 1 ? system.eq1 : system.eq2;
  if (areLinearEquationsEquivalent(userEq, targetEq)) {
    return {
      isValid: true,
      messageVi: `Chính xác! Biểu thức ${targetVar} = ${rhsStr} tương đương với phương trình (${chosenEqIndex}).`,
    };
  }

  // Check common error: sign error when transposing (e.g., 3 - 2x instead of 2x - 3, or -2x + 3)
  const negatedRhsEq: LinearEquation2D =
    targetVar === 'y'
      ? { a: parsedRhs.a, b: ONE_RAT, c: negRat(parsedRhs.c) }
      : { a: ONE_RAT, b: parsedRhs.b, c: negRat(parsedRhs.c) };
  const wrongSignSlopeOnlyEq: LinearEquation2D =
    targetVar === 'y'
      ? { a: parsedRhs.a, b: ONE_RAT, c: parsedRhs.c }
      : { a: ONE_RAT, b: parsedRhs.b, c: parsedRhs.c };

  if (
    areLinearEquationsEquivalent(negatedRhsEq, targetEq) ||
    areLinearEquationsEquivalent(wrongSignSlopeOnlyEq, targetEq)
  ) {
    return {
      isValid: false,
      errorCode: 'wrong_sign_transpose',
      messageVi: 'Em bị nhầm dấu khi chuyển vế hoặc chia hệ số âm!',
      hintVi:
        'Quy tắc chuyển vế: Khi chuyển một hạng tử từ vế này sang vế kia, ta phải đổi dấu hạng tử đó.',
    };
  }

  return {
    isValid: false,
    errorCode: 'algebraic_mismatch',
    messageVi: `Biểu thức ${targetVar} = ${rhsStr} chưa tương đương với phương trình (${chosenEqIndex}).`,
    hintVi: `Hãy kiểm tra lại hệ số của x, y và hằng số trong phương trình (${chosenEqIndex}).`,
  };
}

/**
 * Verifies Step 2 of Substitution: Substituting `isolatedVar` into the OTHER equation.
 * Detects missing parentheses (e.g., x + 2*2x - 3 = 4 instead of x + 2(2x - 3) = 4)
 * and substituting back into the same equation.
 */
export function verifySubstitutedSingleVarEquation(
  system: LinearSystem2x2,
  isolatedFromEqIndex: 1 | 2,
  isolatedVar: 'x' | 'y',
  userEquationRaw: string
): StepVerificationFeedback {
  const trimmed = userEquationRaw.trim();
  if (!trimmed) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Em hãy nhập phương trình một ẩn sau khi thế.',
    };
  }

  const parsedUserEq = parseLinearEquation2D(trimmed);
  if (!parsedUserEq) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Cú pháp phương trình chưa hợp lệ (cần có dấu "=" và một ẩn duy nhất).',
    };
  }

  // Must not still contain the isolated variable
  if (isolatedVar === 'y' && !isZeroRat(parsedUserEq.b)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Phương trình sau khi thế vẫn còn chứa ẩn y! Em cần thế toàn bộ y bằng biểu thức theo x.',
    };
  }
  if (isolatedVar === 'x' && !isZeroRat(parsedUserEq.a)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Phương trình sau khi thế vẫn còn chứa ẩn x! Em cần thế toàn bộ x bằng biểu thức theo y.',
    };
  }

  const sourceEq = isolatedFromEqIndex === 1 ? system.eq1 : system.eq2;
  const targetEq = isolatedFromEqIndex === 1 ? system.eq2 : system.eq1;

  // Compute exact expected single-var equation
  // If isolatedVar === 'y': from sourceEq, y = (c1 - a1*x)/b1
  // Substitute into targetEq: a2*x + b2*(c1 - a1*x)/b1 = c2
  // <=> (a2 - b2*a1/b1)*x = c2 - b2*c1/b1
  let expectedEq: LinearEquation2D;
  if (isolatedVar === 'y') {
    const slopeX = divRat(negRat(sourceEq.a), sourceEq.b); // -a1/b1
    const constTerm = divRat(sourceEq.c, sourceEq.b); // c1/b1
    const expectedA = addRat(targetEq.a, mulRat(targetEq.b, slopeX));
    const expectedC = subRat(targetEq.c, mulRat(targetEq.b, constTerm));
    expectedEq = { a: expectedA, b: ZERO_RAT, c: expectedC };

    // Check missing parentheses error: a2*x + b2*slopeX*x + constTerm = c2 (forgot to multiply constTerm by b2!)
    const noParenC = subRat(targetEq.c, constTerm);
    const noParenEq: LinearEquation2D = { a: expectedA, b: ZERO_RAT, c: noParenC };

    if (areLinearEquationsEquivalent(parsedUserEq, expectedEq)) {
      return {
        isValid: true,
        messageVi: 'Chính xác! Em đã thế đúng biểu thức (có đặt dấu ngoặc) và thu được phương trình một ẩn tương đương.',
      };
    }

    if (
      !eqRat(targetEq.b, ONE_RAT) &&
      !isZeroRat(constTerm) &&
      areLinearEquationsEquivalent(parsedUserEq, noParenEq)
    ) {
      return {
        isValid: false,
        errorCode: 'missing_parentheses',
        messageVi: 'Cẩn thận! Em đã quên đặt dấu ngoặc quanh biểu thức khi nhân với hệ số của y.',
        hintVi: `Khi thế biểu thức gồm nhiều hạng tử vào chỗ có hệ số ${formatRational(targetEq.b)}, em phải đặt trong ngoặc rồi nhân phân phối với cả hai hạng tử.`,
      };
    }
  } else {
    const slopeY = divRat(negRat(sourceEq.b), sourceEq.a);
    const constTerm = divRat(sourceEq.c, sourceEq.a);
    const expectedB = addRat(targetEq.b, mulRat(targetEq.a, slopeY));
    const expectedC = subRat(targetEq.c, mulRat(targetEq.a, constTerm));
    expectedEq = { a: ZERO_RAT, b: expectedB, c: expectedC };

    const noParenC = subRat(targetEq.c, constTerm);
    const noParenEq: LinearEquation2D = { a: ZERO_RAT, b: expectedB, c: noParenC };

    if (areLinearEquationsEquivalent(parsedUserEq, expectedEq)) {
      return {
        isValid: true,
        messageVi: 'Chính xác! Em đã thế đúng biểu thức và đưa hệ về phương trình một ẩn tương đương.',
      };
    }

    if (
      !eqRat(targetEq.a, ONE_RAT) &&
      !isZeroRat(constTerm) &&
      areLinearEquationsEquivalent(parsedUserEq, noParenEq)
    ) {
      return {
        isValid: false,
        errorCode: 'missing_parentheses',
        messageVi: 'Cẩn thận! Em đã quên đặt dấu ngoặc quanh biểu thức khi nhân với hệ số của x.',
        hintVi: `Khi thế biểu thức nhiều hạng tử vào chỗ có hệ số ${formatRational(targetEq.a)}, em phải đặt ngoặc đơn rồi nhân phân phối.`,
      };
    }
  }

  // Check if user substituted back into the SAME equation (producing 0x = 0 when system is not infinite)
  const sol = solveLinearSystem2x2(system);
  if (
    sol.status !== 'infinite_solutions' &&
    isZeroRat(parsedUserEq.a) &&
    isZeroRat(parsedUserEq.b) &&
    isZeroRat(parsedUserEq.c)
  ) {
    return {
      isValid: false,
      errorCode: 'substituted_same_equation',
      messageVi: `Em đã thế ngược lại vào chính phương trình (${isolatedFromEqIndex}) nên thu được 0 = 0!`,
      hintVi: `Sau khi rút ẩn từ phương trình (${isolatedFromEqIndex}), em phải thế vào phương trình còn lại (${isolatedFromEqIndex === 1 ? 2 : 1}).`,
    };
  }

  return {
    isValid: false,
    errorCode: 'algebraic_mismatch',
    messageVi: 'Phương trình một ẩn chưa tương đương với kết quả phép thế.',
    hintVi: 'Hãy kiểm tra lại bước nhân phân phối phá ngoặc và thu gọn các hạng tử đồng dạng.',
  };
}

/**
 * Verifies Elimination Multipliers & Operation (Add / Subtract).
 * Distinguishes:
 * - Valid & eliminates x or y
 * - Valid transformation, but DOES NOT eliminate any variable ("Hợp lệ, nhưng chưa khử được ẩn")
 * - Invalid (multiplier = 0)
 */
export function verifyEliminationMultipliers(
  system: LinearSystem2x2,
  m1: ExactRational,
  m2: ExactRational,
  operation: 'add' | 'sub'
): StepVerificationFeedback & {
  eliminatedVar?: 'x' | 'y' | 'both' | null;
  combinedEq?: LinearEquation2D;
} {
  if (isZeroRat(m1) || isZeroRat(m2)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Hệ số nhân hai vế của mỗi phương trình phải khác 0!',
    };
  }

  const eq1Scaled: LinearEquation2D = {
    a: mulRat(m1, system.eq1.a),
    b: mulRat(m1, system.eq1.b),
    c: mulRat(m1, system.eq1.c),
  };
  const eq2Scaled: LinearEquation2D = {
    a: mulRat(m2, system.eq2.a),
    b: mulRat(m2, system.eq2.b),
    c: mulRat(m2, system.eq2.c),
  };

  const combinedEq: LinearEquation2D =
    operation === 'add'
      ? {
          a: addRat(eq1Scaled.a, eq2Scaled.a),
          b: addRat(eq1Scaled.b, eq2Scaled.b),
          c: addRat(eq1Scaled.c, eq2Scaled.c),
        }
      : {
          a: subRat(eq1Scaled.a, eq2Scaled.a),
          b: subRat(eq1Scaled.b, eq2Scaled.b),
          c: subRat(eq1Scaled.c, eq2Scaled.c),
        };

  const xEliminated = isZeroRat(combinedEq.a);
  const yEliminated = isZeroRat(combinedEq.b);

  if (!xEliminated && !yEliminated) {
    return {
      isValid: false,
      errorCode: 'valid_but_not_eliminated',
      eliminatedVar: null,
      combinedEq,
      messageVi:
        'Hợp lệ, nhưng chưa khử được ẩn! Sau khi cộng/trừ, phương trình vẫn còn cả hai ẩn x và y.',
      hintVi:
        'Hãy chọn hệ số nhân sao cho hệ số của cùng một ẩn ở hai phương trình bằng nhau (rồi trừ) hoặc đối nhau (rồi cộng).',
    };
  }

  const eliminatedVar = xEliminated && yEliminated ? 'both' : xEliminated ? 'x' : 'y';
  return {
    isValid: true,
    eliminatedVar,
    combinedEq,
    messageVi:
      eliminatedVar === 'both'
        ? 'Đã triệt tiêu đồng thời cả x và y để xét số nghiệm của hệ!'
        : `Chính xác! Đã khử thành công ẩn ${eliminatedVar} và thu được phương trình một ẩn.`,
  };
}

/**
 * Verifies user's written combined equation in Elimination Method.
 * Diagnoses forgetting to multiply RHS or sign error when subtracting the second equation.
 */
export function verifyEliminationCombinedEquationInput(
  system: LinearSystem2x2,
  m1: ExactRational,
  m2: ExactRational,
  operation: 'add' | 'sub',
  userCombinedEqRaw: string
): StepVerificationFeedback {
  const parsed = parseLinearEquation2D(userCombinedEqRaw);
  if (!parsed) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Phương trình sau khi cộng/trừ chưa đúng cú pháp (ví dụ: 13x = 13 hoặc -4y = 8).',
    };
  }

  const multCheck = verifyEliminationMultipliers(system, m1, m2, operation);
  if (!multCheck.combinedEq) {
    return multCheck;
  }

  const expected = multCheck.combinedEq;
  if (areLinearEquationsEquivalent(parsed, expected)) {
    return {
      isValid: true,
      messageVi: 'Chính xác! Phương trình thu được hoàn toàn đúng.',
    };
  }

  // Check if user forgot to multiply RHS by m1 and m2:
  const unscaledRhs =
    operation === 'add'
      ? addRat(system.eq1.c, system.eq2.c)
      : subRat(system.eq1.c, system.eq2.c);
  const forgotRhsEq: LinearEquation2D = {
    a: expected.a,
    b: expected.b,
    c: unscaledRhs,
  };
  if (
    (!eqRat(m1, ONE_RAT) || !eqRat(m2, ONE_RAT)) &&
    areLinearEquationsEquivalent(parsed, forgotRhsEq)
  ) {
    return {
      isValid: false,
      errorCode: 'forgot_rhs_multiplication',
      messageVi: 'Em đã nhân vế trái nhưng quên nhân vế phải của phương trình!',
      hintVi: `Khi nhân phương trình (1) với ${formatRational(m1)} và (2) với ${formatRational(m2)}, phải nhân cả số hạng tự do ở vế phải.`,
    };
  }

  // Check if user made a sign error when subtracting equation 2
  const oppositeOp = operation === 'add' ? 'sub' : 'add';
  const oppositeCheck = verifyEliminationMultipliers(system, m1, m2, oppositeOp);
  if (
    oppositeCheck.combinedEq &&
    (eqRat(parsed.c, oppositeCheck.combinedEq.c) ||
      eqRat(parsed.a, oppositeCheck.combinedEq.a) ||
      eqRat(parsed.b, oppositeCheck.combinedEq.b))
  ) {
    return {
      isValid: false,
      errorCode: 'wrong_sign_subtraction',
      messageVi: 'Cẩn thận! Em bị nhầm dấu khi cộng/trừ từng vế hai phương trình.',
      hintVi:
        'Khi trừ từng vế hai phương trình, nhớ đổi dấu tất cả các số hạng của phương trình thứ hai (kể cả số âm ở vế phải).',
    };
  }

  return {
    isValid: false,
    errorCode: 'algebraic_mismatch',
    messageVi: 'Phương trình thu được chưa khớp với kết quả cộng/trừ hai phương trình.',
  };
}

/**
 * Verifies a candidate solution pair (x, y) against BOTH equations of the system,
 * or verifies parametric general solution (x(t); y(t)) for infinite-solution systems.
 */
export function verifySystemFinalAnswer(
  system: LinearSystem2x2,
  userStatus: SystemSolutionType,
  userXRaw?: string,
  userYRaw?: string
): StepVerificationFeedback & {
  eq1Check?: { lhs: ExactRational; rhs: ExactRational; ok: boolean };
  eq2Check?: { lhs: ExactRational; rhs: ExactRational; ok: boolean };
} {
  const exact = solveLinearSystem2x2(system);

  if (userStatus !== exact.status) {
    const statusLabel: Record<SystemSolutionType, string> = {
      unique: 'có nghiệm duy nhất',
      no_solution: 'vô nghiệm',
      infinite_solutions: 'có vô số nghiệm',
    };
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: `Kết luận số nghiệm chưa đúng. Hệ phương trình này ${statusLabel[exact.status]}, không phải ${statusLabel[userStatus]}.`,
      hintVi:
        exact.status === 'no_solution'
          ? 'Khi khử ẩn thu được dạng 0x = k (với k ≠ 0), phương trình vô nghiệm nên hệ vô nghiệm.'
          : exact.status === 'infinite_solutions'
            ? 'Khi khử ẩn thu được dạng 0x = 0 (luôn đúng), hệ có vô số nghiệm phụ thuộc một tham số t ∈ ℝ.'
            : 'Hệ số của hai phương trình không tỉ lệ nên hệ có nghiệm duy nhất (x; y).',
    };
  }

  if (exact.status === 'no_solution') {
    return {
      isValid: true,
      messageVi: 'Chính xác! Hệ phương trình vô nghiệm (hai đường thẳng song song phân biệt).',
    };
  }

  if (exact.status === 'unique') {
    const xVal = parseRationalInput(userXRaw || '');
    const yVal = parseRationalInput(userYRaw || '');
    if (!xVal || !yVal) {
      return {
        isValid: false,
        errorCode: 'parse_error',
        messageVi: 'Hãy nhập đầy đủ giá trị số hoặc phân số cho cả x và y (ví dụ: 2 hoặc -12/5 hoặc -2,4).',
      };
    }

    const lhs1 = addRat(mulRat(system.eq1.a, xVal), mulRat(system.eq1.b, yVal));
    const lhs2 = addRat(mulRat(system.eq2.a, xVal), mulRat(system.eq2.b, yVal));
    const ok1 = eqRat(lhs1, system.eq1.c);
    const ok2 = eqRat(lhs2, system.eq2.c);

    if (ok1 && ok2) {
      return {
        isValid: true,
        eq1Check: { lhs: lhs1, rhs: system.eq1.c, ok: true },
        eq2Check: { lhs: lhs2, rhs: system.eq2.c, ok: true },
        messageVi: `Chính xác! Cặp số (${formatRational(xVal)}; ${formatRational(yVal)}) thỏa mãn đồng thời cả hai phương trình của hệ.`,
      };
    }

    if (ok1 !== ok2) {
      return {
        isValid: false,
        errorCode: 'only_satisfies_one_equation',
        eq1Check: { lhs: lhs1, rhs: system.eq1.c, ok: ok1 },
        eq2Check: { lhs: lhs2, rhs: system.eq2.c, ok: ok2 },
        messageVi: `Cặp (${formatRational(xVal)}; ${formatRational(yVal)}) thỏa mãn phương trình (${ok1 ? 1 : 2}) nhưng KHÔNG thỏa mãn phương trình (${ok1 ? 2 : 1})!`,
        hintVi: 'Nghiệm của hệ phải thỏa mãn đồng thời CẢ HAI phương trình. Hãy kiểm tra lại bước thay giá trị để tìm ẩn thứ hai.',
      };
    }

    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      eq1Check: { lhs: lhs1, rhs: system.eq1.c, ok: false },
      eq2Check: { lhs: lhs2, rhs: system.eq2.c, ok: false },
      messageVi: `Cặp (${formatRational(xVal)}; ${formatRational(yVal)}) chưa thỏa mãn hai phương trình của hệ.`,
      hintVi: 'Hãy kiểm tra lại dấu khi chuyển vế và phép chia hệ số ở bước cuối.',
    };
  }

  // Case 3: infinite_solutions — verify parametric expressions x(t), y(t)
  if (!userXRaw?.trim() || !userYRaw?.trim()) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Với hệ vô số nghiệm, em hãy nhập công thức nghiệm tổng quát (x; y) theo tham số t (ví dụ: x = t, y = t - 2).',
    };
  }

  const xParam = parseLinearExpression2D(userXRaw);
  const yParam = parseLinearExpression2D(userYRaw);
  if (!xParam || !yParam || !isZeroRat(xParam.b) || !isZeroRat(yParam.b)) {
    return {
      isValid: false,
      errorCode: 'parse_error',
      messageVi: 'Biểu thức nghiệm tổng quát cần viết theo tham số t (ví dụ: t và t - 2).',
    };
  }

  // Must not be a single constant point (at least one slope in t must be != 0)
  if (isZeroRat(xParam.a) && isZeroRat(yParam.a)) {
    return {
      isValid: false,
      errorCode: 'algebraic_mismatch',
      messageVi: 'Em mới chỉ nhập một cặp số cố định. Hệ có vô số nghiệm cần biểu diễn theo tham số t ∈ ℝ!',
    };
  }

  const baseEq = exact.parametric!.constraintEq;
  // Substitute x(t) = xParam.a * t + xParam.c, y(t) = yParam.a * t + yParam.c into baseEq:
  // (baseEq.a * xParam.a + baseEq.b * yParam.a) * t + (baseEq.a * xParam.c + baseEq.b * yParam.c) === baseEq.c
  const tCoeff = addRat(mulRat(baseEq.a, xParam.a), mulRat(baseEq.b, yParam.a));
  const constVal = addRat(mulRat(baseEq.a, xParam.c), mulRat(baseEq.b, yParam.c));

  if (isZeroRat(tCoeff) && eqRat(constVal, baseEq.c)) {
    return {
      isValid: true,
      messageVi: `Chính xác! Công thức nghiệm tổng quát (${userXRaw.trim()}; ${userYRaw.trim()}) với t ∈ ℝ biểu diễn đúng tập nghiệm của hệ.`,
    };
  }

  return {
    isValid: false,
    errorCode: 'algebraic_mismatch',
    messageVi: `Cặp biểu thức (${userXRaw.trim()}; ${userYRaw.trim()}) chưa thỏa mãn ràng buộc ${formatEquationDisplay(baseEq)} với mọi t ∈ ℝ.`,
    hintVi: `Không phải mọi cặp (x; y) ∈ ℝ² đều là nghiệm! Nghiệm phải thỏa mãn phương trình của hệ, ví dụ (${exact.parametric?.xExprDisplay}; ${exact.parametric?.yExprDisplay}).`,
  };
}

export function formatEquationDisplay(eq: LinearEquation2D): string {
  const parts: string[] = [];
  if (!isZeroRat(eq.a)) {
    if (eqRat(eq.a, ONE_RAT)) parts.push('x');
    else if (eqRat(eq.a, negRat(ONE_RAT))) parts.push('-x');
    else parts.push(`${formatRational(eq.a, 'vi_decimal_if_clean')}x`);
  }
  if (!isZeroRat(eq.b)) {
    const absB = eq.b.num < 0 ? negRat(eq.b) : eq.b;
    const sign = eq.b.num < 0 ? '-' : '+';
    const bStr = eqRat(absB, ONE_RAT)
      ? 'y'
      : `${formatRational(absB, 'vi_decimal_if_clean')}y`;
    if (parts.length === 0) {
      parts.push(eq.b.num < 0 ? `-${bStr}` : bStr);
    } else {
      parts.push(`${sign} ${bStr}`);
    }
  }
  if (parts.length === 0) parts.push('0');
  return `${parts.join(' ')} = ${formatRational(eq.c, 'vi_decimal_if_clean')}`;
}

// ============================================================================
// COMPLETE TEXTBOOK DATA BANK (SGK TOÁN 9 TẬP 1 - KNTT TRANG 11–18)
// ============================================================================

export interface SubstitutionInteractiveItem {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly sgkPage: string;
  readonly systemDisplay: [string, string];
  readonly system: LinearSystem2x2;
  readonly defaultIsolatedEq: 1 | 2;
  readonly defaultIsolatedVar: 'x' | 'y';
  readonly isolatedExprDisplay: string; // e.g. "2x - 3"
  readonly alternativeIsolatedNote: string;
  readonly substitutedTemplatePrefix: string; // e.g. "x + 2("
  readonly substitutedTemplateSuffix: string; // e.g. ") = 4"
  readonly simplifiedSingleVarEq: string; // e.g. "5x - 6 = 4"
  readonly singleVarStepResult: string; // e.g. "5x = 10 ⇒ x = 2"
  readonly backSubResult: string; // e.g. "y = 2·2 - 3 = 1"
  readonly conclusionDisplay: string;
  readonly teacherGoal: string;
  readonly teacherGuidingQuestion: string;
  readonly commonMistakeWarning: string;
}

export const SUBSTITUTION_ITEMS: SubstitutionInteractiveItem[] = [
  {
    id: 'vd1',
    badge: 'Ví dụ 1 • SGK trang 11',
    title: 'Phương pháp thế • Ví dụ 1',
    sgkPage: 'SGK trang 11',
    systemDisplay: ['2x − y = 3', 'x + 2y = 4'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(-1), c: makeRational(3) },
      eq2: { a: makeRational(1), b: makeRational(2), c: makeRational(4) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'y',
    isolatedExprDisplay: '2x - 3',
    alternativeIsolatedNote: 'Em có thể chọn biểu diễn x = 4 - 2y từ (2) hoặc y = 2x - 3 từ (1).',
    substitutedTemplatePrefix: 'x + 2(',
    substitutedTemplateSuffix: ') = 4',
    simplifiedSingleVarEq: '5x - 6 = 4',
    singleVarStepResult: '5x = 10 ⇒ x = 2',
    backSubResult: 'Thay x = 2 vào y = 2x − 3 ⇒ y = 2·2 − 3 = 1.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (2; 1).',
    teacherGoal: 'Đưa hệ hai phương trình về phương trình bậc nhất một ẩn bằng phép thế.',
    teacherGuidingQuestion: 'Vì sao ta ưu tiên rút y từ phương trình (1) hoặc rút x từ phương trình (2)?',
    commonMistakeWarning: 'Quên đặt ngoặc khi thế 2x − 3 vào 2y (viết nhầm thành x + 4x − 3 = 4).',
  },
  {
    id: 'hd1',
    badge: 'HĐ1 • SGK trang 11',
    title: 'Phương pháp thế • Hoạt động 1',
    sgkPage: 'SGK trang 11',
    systemDisplay: ['x + y = 3', '2x − 3y = 1'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(1), c: makeRational(3) },
      eq2: { a: makeRational(2), b: makeRational(-3), c: makeRational(1) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'y',
    isolatedExprDisplay: '3 - x',
    alternativeIsolatedNote: 'Em cũng có thể biểu diễn x = 3 - y từ phương trình (1).',
    substitutedTemplatePrefix: '2x − 3(',
    substitutedTemplateSuffix: ') = 1',
    simplifiedSingleVarEq: '5x - 9 = 1',
    singleVarStepResult: '5x = 10 ⇒ x = 2',
    backSubResult: 'Thay x = 2 vào y = 3 − x ⇒ y = 3 − 2 = 1.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (2; 1).',
    teacherGoal: 'Hình thành quy trình 2 bước của phương pháp thế từ hoạt động khám phá.',
    teacherGuidingQuestion: 'Khi nhân -3 với (3 - x), dấu của hạng tử chứa x thay đổi như thế nào?',
    commonMistakeWarning: 'Nhân phân phối sai dấu: -3(3 - x) viết nhầm thành -9 - 3x.',
  },
  {
    id: 'vd2',
    badge: 'Ví dụ 2 • SGK trang 12',
    title: 'Phương pháp thế • Ví dụ 2 (Hệ vô nghiệm)',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['x − y = −2', '2x − 2y = 8'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(-1), c: makeRational(-2) },
      eq2: { a: makeRational(2), b: makeRational(-2), c: makeRational(8) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'x',
    isolatedExprDisplay: 'y - 2',
    alternativeIsolatedNote: 'Em cũng có thể rút y = x + 2 từ (1) rồi thế vào (2) thu được 0x = 12.',
    substitutedTemplatePrefix: '2(',
    substitutedTemplateSuffix: ') − 2y = 8',
    simplifiedSingleVarEq: '0y = 12',
    singleVarStepResult: '2y − 4 − 2y = 8 ⇒ 0y = 12 (hoặc chia 2: 0y = 6, vô lí)',
    backSubResult: 'Không có giá trị nào của y thỏa mãn phương trình 0y = 12.',
    conclusionDisplay: 'Vậy hệ phương trình đã cho vô nghiệm.',
    teacherGoal: 'Nhận biết dấu hiệu hệ vô nghiệm khi phương trình một ẩn có dạng 0y = k (k ≠ 0).',
    teacherGuidingQuestion: 'Có giá trị thực nào của y để 0·y bằng một số khác 0 không?',
    commonMistakeWarning: 'Nhầm 0y = 12 thành y = 0 hoặc y = 12.',
  },
  {
    id: 'vd3',
    badge: 'Ví dụ 3 • SGK trang 12',
    title: 'Phương pháp thế • Ví dụ 3 (Hệ vô số nghiệm)',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['−x + y = −2', '3x − 3y = 6'],
    system: {
      eq1: { a: makeRational(-1), b: makeRational(1), c: makeRational(-2) },
      eq2: { a: makeRational(3), b: makeRational(-3), c: makeRational(6) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'y',
    isolatedExprDisplay: 'x - 2',
    alternativeIsolatedNote: 'Em cũng có thể rút x = y + 2 từ (1) rồi thế vào (2) được 0y = 0.',
    substitutedTemplatePrefix: '3x − 3(',
    substitutedTemplateSuffix: ') = 6',
    simplifiedSingleVarEq: '0x = 0',
    singleVarStepResult: '3x − 3x + 6 = 6 ⇒ 0x = 0 (nghiệm đúng với mọi x ∈ ℝ)',
    backSubResult: 'Với mỗi x = t ∈ ℝ, ta có y = t − 2.',
    conclusionDisplay: 'Hệ có vô số nghiệm dạng (t; t − 2) với t ∈ ℝ.',
    teacherGoal: 'Hiểu cách viết công thức nghiệm tổng quát khi thu được 0x = 0.',
    teacherGuidingQuestion: 'Khi 0x = 0 luôn đúng, y có tùy ý độc lập với x không hay phải thỏa mãn y = x - 2?',
    commonMistakeWarning: 'Kết luận sai rằng mọi cặp (x; y) bất kỳ đều là nghiệm mà quên ràng buộc y = x − 2.',
  },
  {
    id: 'lt1a',
    badge: 'Luyện tập 1a • SGK trang 12',
    title: 'Phương pháp thế • Luyện tập 1a',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['x − 3y = 2', '−2x + 5y = 1'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(-3), c: makeRational(2) },
      eq2: { a: makeRational(-2), b: makeRational(5), c: makeRational(1) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'x',
    isolatedExprDisplay: '3y + 2',
    alternativeIsolatedNote: 'Chọn rút x từ phương trình (1) vì hệ số của x bằng 1.',
    substitutedTemplatePrefix: '−2(',
    substitutedTemplateSuffix: ') + 5y = 1',
    simplifiedSingleVarEq: '-y - 4 = 1',
    singleVarStepResult: '−6y − 4 + 5y = 1 ⇒ −y = 5 ⇒ y = −5',
    backSubResult: 'Thay y = −5 vào x = 3y + 2 ⇒ x = 3·(−5) + 2 = −13.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (−13; −5).',
    teacherGoal: 'Rèn kỹ năng rút x theo y khi hệ số của x bằng 1.',
    teacherGuidingQuestion: 'Khi nhân -2 với (3y + 2), ta thu được biểu thức nào?',
    commonMistakeWarning: 'Tính nhầm -6y + 5y thành y thay vì -y.',
  },
  {
    id: 'lt1b',
    badge: 'Luyện tập 1b • SGK trang 12',
    title: 'Phương pháp thế • Luyện tập 1b',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['4x + y = −1', '7x + 2y = −3'],
    system: {
      eq1: { a: makeRational(4), b: makeRational(1), c: makeRational(-1) },
      eq2: { a: makeRational(7), b: makeRational(2), c: makeRational(-3) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'y',
    isolatedExprDisplay: '-4x - 1',
    alternativeIsolatedNote: 'Từ (1) suy ra y = −4x − 1 (vì hệ số của y bằng 1).',
    substitutedTemplatePrefix: '7x + 2(',
    substitutedTemplateSuffix: ') = −3',
    simplifiedSingleVarEq: '-x - 2 = -3',
    singleVarStepResult: '7x − 8x − 2 = −3 ⇒ −x = −1 ⇒ x = 1',
    backSubResult: 'Thay x = 1 vào y = −4x − 1 ⇒ y = −4·1 − 1 = −5.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (1; −5).',
    teacherGoal: 'Thực hành thế biểu thức có các hệ số âm.',
    teacherGuidingQuestion: 'Từ 4x + y = -1, khi chuyển 4x sang vế phải ta được gì?',
    commonMistakeWarning: 'Chuyển vế quên đổi dấu 4x thành -4x.',
  },
  {
    id: 'lt2',
    badge: 'Luyện tập 2 • SGK trang 12',
    title: 'Phương pháp thế • Luyện tập 2',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['−2x + y = 3', '4x − 2y = −4'],
    system: {
      eq1: { a: makeRational(-2), b: makeRational(1), c: makeRational(3) },
      eq2: { a: makeRational(4), b: makeRational(-2), c: makeRational(-4) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'y',
    isolatedExprDisplay: '2x + 3',
    alternativeIsolatedNote: 'Từ (1) biểu diễn y = 2x + 3 rồi thế vào (2).',
    substitutedTemplatePrefix: '4x − 2(',
    substitutedTemplateSuffix: ') = −4',
    simplifiedSingleVarEq: '0x = 2',
    singleVarStepResult: '4x − 4x − 6 = −4 ⇒ 0x = 2 (vô lí)',
    backSubResult: 'Phương trình 0x = 2 vô nghiệm.',
    conclusionDisplay: 'Vậy hệ phương trình đã cho vô nghiệm.',
    teacherGoal: 'Tự phát hiện hệ vô nghiệm bằng phương pháp thế.',
    teacherGuidingQuestion: 'Sau khi thu gọn 4x - 4x - 6 = -4, ta được phương trình nào?',
    commonMistakeWarning: 'Nhầm dấu -2(2x + 3) thành -4x + 6.',
  },
  {
    id: 'lt3',
    badge: 'Luyện tập 3 • SGK trang 12',
    title: 'Phương pháp thế • Luyện tập 3',
    sgkPage: 'SGK trang 12',
    systemDisplay: ['x + 3y = −1', '3x + 9y = −3'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(3), c: makeRational(-1) },
      eq2: { a: makeRational(3), b: makeRational(9), c: makeRational(-3) },
    },
    defaultIsolatedEq: 1,
    defaultIsolatedVar: 'x',
    isolatedExprDisplay: '-3y - 1',
    alternativeIsolatedNote: 'Rút x = −3y − 1 từ (1) vì hệ số của x bằng 1.',
    substitutedTemplatePrefix: '3(',
    substitutedTemplateSuffix: ') + 9y = −3',
    simplifiedSingleVarEq: '0y = 0',
    singleVarStepResult: '−9y − 3 + 9y = −3 ⇒ 0y = 0 (luôn đúng với mọi y ∈ ℝ)',
    backSubResult: 'Đặt y = t ∈ ℝ thì x = −3t − 1.',
    conclusionDisplay: 'Hệ có vô số nghiệm dạng (−3t − 1; t) với t ∈ ℝ (hoặc (t; −1/3t − 1/3)).',
    teacherGoal: 'Viết nghiệm tổng quát khi rút x theo y = t ∈ ℝ.',
    teacherGuidingQuestion: 'Nếu chọn y ∈ ℝ tùy ý thì x được tính theo y như thế nào?',
    commonMistakeWarning: 'Quên biểu diễn x theo y trong kết luận nghiệm tổng quát.',
  },
];

export interface EliminationInteractiveItem {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly sgkPage: string;
  readonly systemDisplay: [string, string];
  readonly system: LinearSystem2x2;
  readonly recommendedM1: ExactRational;
  readonly recommendedM2: ExactRational;
  readonly recommendedOp: 'add' | 'sub';
  readonly scaledEq1Display: string;
  readonly scaledEq2Display: string;
  readonly highlightedTerm1: string;
  readonly highlightedTerm2: string;
  readonly eliminatedCallout: string; // e.g. "Triệt tiêu y"
  readonly combinedEqDisplay: string; // e.g. "13x = 13"
  readonly stepSolveFirstVar: string;
  readonly stepSolveSecondVar: string;
  readonly conclusionDisplay: string;
  readonly teacherGoal: string;
  readonly teacherGuidingQuestion: string;
  readonly commonMistakeWarning: string;
}

export const ELIMINATION_ITEMS: EliminationInteractiveItem[] = [
  {
    id: 'vd6',
    badge: 'Ví dụ 6 • SGK trang 14',
    title: 'Phương pháp cộng đại số • Ví dụ 6',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['3x + 2y = 7', '2x − 3y = −4'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(2), c: makeRational(7) },
      eq2: { a: makeRational(2), b: makeRational(-3), c: makeRational(-4) },
    },
    recommendedM1: makeRational(3),
    recommendedM2: makeRational(2),
    recommendedOp: 'add',
    scaledEq1Display: '9x + 6y = 21',
    scaledEq2Display: '4x − 6y = −8',
    highlightedTerm1: '+ 6y',
    highlightedTerm2: '− 6y',
    eliminatedCallout: 'Triệt tiêu y',
    combinedEqDisplay: '13x = 13',
    stepSolveFirstVar: '13x = 13 ⇒ x = 1',
    stepSolveSecondVar: 'Thay x = 1 vào 3x + 2y = 7 ⇒ 3·1 + 2y = 7 ⇒ 2y = 4 ⇒ y = 2.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (1; 2).',
    teacherGoal: 'Tạo hệ số đối nhau để khử y.',
    teacherGuidingQuestion: 'Vì sao chọn nhân 3 và nhân 2?',
    commonMistakeWarning: 'Quên nhân vế phải; sai dấu khi trừ.',
  },
  {
    id: 'hd2',
    badge: 'HĐ2 • SGK trang 13',
    title: 'Phương pháp cộng đại số • Hoạt động 2',
    sgkPage: 'SGK trang 13',
    systemDisplay: ['2x + 2y = 3', 'x − 2y = 6'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(2), c: makeRational(3) },
      eq2: { a: makeRational(1), b: makeRational(-2), c: makeRational(6) },
    },
    recommendedM1: makeRational(1),
    recommendedM2: makeRational(1),
    recommendedOp: 'add',
    scaledEq1Display: '2x + 2y = 3',
    scaledEq2Display: 'x − 2y = 6',
    highlightedTerm1: '+ 2y',
    highlightedTerm2: '− 2y',
    eliminatedCallout: 'Triệt tiêu y',
    combinedEqDisplay: '3x = 9',
    stepSolveFirstVar: '3x = 9 ⇒ x = 3',
    stepSolveSecondVar: 'Thay x = 3 vào x − 2y = 6 ⇒ 3 − 2y = 6 ⇒ 2y = −3 ⇒ y = −3/2.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (3; −3/2).',
    teacherGoal: 'Nhận biết hai hệ số của y là 2 và -2 đối nhau nên cộng từng vế.',
    teacherGuidingQuestion: 'Tổng (2x + 2y) + (x - 2y) khử được ẩn nào?',
    commonMistakeWarning: 'Chỉ giữ phương trình 3x = 9 mà quên giữ lại một phương trình gốc để tìm y.',
  },
  {
    id: 'vd4',
    badge: 'Ví dụ 4 • SGK trang 13',
    title: 'Phương pháp cộng đại số • Ví dụ 4 (Hệ số đối nhau)',
    sgkPage: 'SGK trang 13',
    systemDisplay: ['−2x + 5y = 12', '2x + 3y = 4'],
    system: {
      eq1: { a: makeRational(-2), b: makeRational(5), c: makeRational(12) },
      eq2: { a: makeRational(2), b: makeRational(3), c: makeRational(4) },
    },
    recommendedM1: makeRational(1),
    recommendedM2: makeRational(1),
    recommendedOp: 'add',
    scaledEq1Display: '−2x + 5y = 12',
    scaledEq2Display: '2x + 3y = 4',
    highlightedTerm1: '−2x',
    highlightedTerm2: '+ 2x',
    eliminatedCallout: 'Triệt tiêu x',
    combinedEqDisplay: '8y = 16',
    stepSolveFirstVar: '8y = 16 ⇒ y = 2',
    stepSolveSecondVar: 'Thay y = 2 vào 2x + 3y = 4 ⇒ 2x + 6 = 4 ⇒ 2x = −2 ⇒ x = −1.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (−1; 2).',
    teacherGoal: 'Cộng từng vế hai phương trình khi hệ số của x đối nhau (-2 và 2).',
    teacherGuidingQuestion: 'Hệ số của ẩn x trong hai phương trình có đặc điểm gì?',
    commonMistakeWarning: 'Khi kết luận nghiệm viết ngược thứ tự (y; x) = (2; -1) thay vì (x; y) = (-1; 2).',
  },
  {
    id: 'vd5',
    badge: 'Ví dụ 5 • SGK trang 13',
    title: 'Phương pháp cộng đại số • Ví dụ 5 (Hệ số bằng nhau)',
    sgkPage: 'SGK trang 13',
    systemDisplay: ['5x − 7y = 9', '5x − 3y = 1'],
    system: {
      eq1: { a: makeRational(5), b: makeRational(-7), c: makeRational(9) },
      eq2: { a: makeRational(5), b: makeRational(-3), c: makeRational(1) },
    },
    recommendedM1: makeRational(1),
    recommendedM2: makeRational(1),
    recommendedOp: 'sub',
    scaledEq1Display: '5x − 7y = 9',
    scaledEq2Display: '5x − 3y = 1',
    highlightedTerm1: '5x',
    highlightedTerm2: '5x',
    eliminatedCallout: 'Trừ vế theo vế khử x',
    combinedEqDisplay: '-4y = 8',
    stepSolveFirstVar: '−4y = 8 ⇒ y = −2',
    stepSolveSecondVar: 'Thay y = −2 vào 5x − 3y = 1 ⇒ 5x − 3(−2) = 1 ⇒ 5x = −5 ⇒ x = −1.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (−1; −2).',
    teacherGoal: 'Trừ từng vế hai phương trình khi hệ số của cùng một ẩn bằng nhau.',
    teacherGuidingQuestion: 'Khi tính (-7y) - (-3y), kết quả bằng bao nhiêu?',
    commonMistakeWarning: 'Sai dấu khi trừ: (-7y) - (-3y) tính nhầm thành -10y.',
  },
  {
    id: 'vd7',
    badge: 'Ví dụ 7 • SGK trang 14',
    title: 'Phương pháp cộng đại số • Ví dụ 7 (Vô số nghiệm)',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['3x − 5y = 2', '−6x + 10y = −4'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(-5), c: makeRational(2) },
      eq2: { a: makeRational(-6), b: makeRational(10), c: makeRational(-4) },
    },
    recommendedM1: makeRational(2),
    recommendedM2: makeRational(1),
    recommendedOp: 'add',
    scaledEq1Display: '6x − 10y = 4',
    scaledEq2Display: '−6x + 10y = −4',
    highlightedTerm1: '6x − 10y',
    highlightedTerm2: '−6x + 10y',
    eliminatedCallout: 'Triệt tiêu cả x và y',
    combinedEqDisplay: '0x = 0',
    stepSolveFirstVar: '0x + 0y = 0 (luôn đúng với mọi x, y)',
    stepSolveSecondVar: 'Kết hợp với 3x − 5y = 2 ⇒ y = (3/5)x − 2/5.',
    conclusionDisplay: 'Hệ có vô số nghiệm (t; 3/5t − 2/5) với t ∈ ℝ.',
    teacherGoal: 'Xử lý trường hợp cả hai ẩn đồng thời triệt tiêu dẫn tới 0x = 0.',
    teacherGuidingQuestion: 'Vì sao vẫn phải giữ lại phương trình 3x - 5y = 2 khi biểu diễn nghiệm?',
    commonMistakeWarning: 'Bỏ quên phương trình 3x − 5y = 2 nên không nêu được điều kiện ràng buộc giữa x và y.',
  },
  {
    id: 'lt4a',
    badge: 'Luyện tập 4a • SGK trang 14',
    title: 'Phương pháp cộng đại số • Luyện tập 4a',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['−4x + 3y = 0', '4x − 5y = −8'],
    system: {
      eq1: { a: makeRational(-4), b: makeRational(3), c: makeRational(0) },
      eq2: { a: makeRational(4), b: makeRational(-5), c: makeRational(-8) },
    },
    recommendedM1: makeRational(1),
    recommendedM2: makeRational(1),
    recommendedOp: 'add',
    scaledEq1Display: '−4x + 3y = 0',
    scaledEq2Display: '4x − 5y = −8',
    highlightedTerm1: '−4x',
    highlightedTerm2: '+ 4x',
    eliminatedCallout: 'Triệt tiêu x',
    combinedEqDisplay: '-2y = -8',
    stepSolveFirstVar: '−2y = −8 ⇒ y = 4',
    stepSolveSecondVar: 'Thay y = 4 vào −4x + 3y = 0 ⇒ −4x + 12 = 0 ⇒ x = 3.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (3; 4).',
    teacherGoal: 'Thực hành cộng từng vế khi hệ số của x đối nhau (-4 và 4).',
    teacherGuidingQuestion: 'Em chọn cộng hay trừ hai phương trình để khử x?',
    commonMistakeWarning: 'Nhầm dấu khi chia -8 cho -2.',
  },
  {
    id: 'lt4b',
    badge: 'Luyện tập 4b • SGK trang 14',
    title: 'Phương pháp cộng đại số • Luyện tập 4b',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['4x + 3y = 0', 'x + 3y = 9'],
    system: {
      eq1: { a: makeRational(4), b: makeRational(3), c: makeRational(0) },
      eq2: { a: makeRational(1), b: makeRational(3), c: makeRational(9) },
    },
    recommendedM1: makeRational(1),
    recommendedM2: makeRational(1),
    recommendedOp: 'sub',
    scaledEq1Display: '4x + 3y = 0',
    scaledEq2Display: 'x + 3y = 9',
    highlightedTerm1: '+ 3y',
    highlightedTerm2: '+ 3y',
    eliminatedCallout: 'Trừ vế theo vế khử y',
    combinedEqDisplay: '3x = -9',
    stepSolveFirstVar: '3x = −9 ⇒ x = −3',
    stepSolveSecondVar: 'Thay x = −3 vào x + 3y = 9 ⇒ −3 + 3y = 9 ⇒ 3y = 12 ⇒ y = 4.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (−3; 4).',
    teacherGoal: 'Thực hành trừ từng vế khi hệ số của y bằng nhau (cùng bằng 3).',
    teacherGuidingQuestion: 'Khi lấy vế phải của (1) trừ vế phải của (2), ta tính 0 - 9 bằng bao nhiêu?',
    commonMistakeWarning: 'Lấy 0 - 9 nhưng viết nhầm thành 9.',
  },
  {
    id: 'lt5',
    badge: 'Luyện tập 5 • SGK trang 14',
    title: 'Phương pháp cộng đại số • Luyện tập 5',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['4x + 3y = 6', '−5x + 2y = 4'],
    system: {
      eq1: { a: makeRational(4), b: makeRational(3), c: makeRational(6) },
      eq2: { a: makeRational(-5), b: makeRational(2), c: makeRational(4) },
    },
    recommendedM1: makeRational(2),
    recommendedM2: makeRational(3),
    recommendedOp: 'sub',
    scaledEq1Display: '8x + 6y = 12',
    scaledEq2Display: '−15x + 6y = 12',
    highlightedTerm1: '+ 6y',
    highlightedTerm2: '+ 6y',
    eliminatedCallout: 'Khử y (hoặc nhân 5 và 4 khử x)',
    combinedEqDisplay: '23x = 0',
    stepSolveFirstVar: '23x = 0 ⇒ x = 0',
    stepSolveSecondVar: 'Thay x = 0 vào 4x + 3y = 6 ⇒ 3y = 6 ⇒ y = 2.',
    conclusionDisplay: 'Vậy hệ phương trình có nghiệm duy nhất là (0; 2).',
    teacherGoal: 'Linh hoạt nhân hai phương trình để khử x hoặc khử y.',
    teacherGuidingQuestion: 'Khi thu được 23x = 0 thì x bằng bao nhiêu?',
    commonMistakeWarning: 'Lúng túng khi gặp 23x = 0 (nhầm là vô nghiệm thay vì x = 0).',
  },
  {
    id: 'lt6',
    badge: 'Luyện tập 6 • SGK trang 14',
    title: 'Phương pháp cộng đại số • Luyện tập 6',
    sgkPage: 'SGK trang 14',
    systemDisplay: ['−0,5x + 0,5y = 1', '−2x + 2y = 8'],
    system: {
      eq1: { a: makeRational(-1, 2), b: makeRational(1, 2), c: makeRational(1) },
      eq2: { a: makeRational(-2), b: makeRational(2), c: makeRational(8) },
    },
    recommendedM1: makeRational(-4),
    recommendedM2: makeRational(1),
    recommendedOp: 'add',
    scaledEq1Display: '2x − 2y = −4',
    scaledEq2Display: '−2x + 2y = 8',
    highlightedTerm1: '2x − 2y',
    highlightedTerm2: '−2x + 2y',
    eliminatedCallout: 'Triệt tiêu cả x và y',
    combinedEqDisplay: '0x = 4',
    stepSolveFirstVar: '0x + 0y = 4 (vô lí)',
    stepSolveSecondVar: 'Phương trình không có nghiệm thực nào.',
    conclusionDisplay: 'Vậy hệ phương trình đã cho vô nghiệm.',
    teacherGoal: 'Nhận biết hệ vô nghiệm có hệ số thập phân bằng phương pháp cộng đại số.',
    teacherGuidingQuestion: 'Nhân phương trình (1) với bao nhiêu để hệ số đối với phương trình (2)?',
    commonMistakeWarning: 'Quên nhân vế phải 1 với -4.',
  },
];

// ============================================================================
// ACTIVITY 5: SCIENTIFIC CALCULATOR EXAMPLES & PRACTICE (SGK TRANG 15)
// ============================================================================

export interface CalculatorPracticeItem {
  readonly id: string;
  readonly badge: string;
  readonly title: string;
  readonly rawSystemDisplay: [string, string];
  readonly needsNormalization: boolean;
  readonly normalizedDisplay: [string, string];
  readonly system: LinearSystem2x2;
  readonly calculatorScreenResult: string;
  readonly pedagogicalNote: string;
}

export const CALCULATOR_ITEMS: CalculatorPracticeItem[] = [
  {
    id: 'calc_vd',
    badge: 'Ví dụ SGK • Trang 15',
    title: 'Đưa về dạng chuẩn a₁x + b₁y = c₁ trước khi nhập máy',
    rawSystemDisplay: ['2x + 3y − 4 = 0', '5x + 6y − 7 = 0'],
    needsNormalization: true,
    normalizedDisplay: ['2x + 3y = 4', '5x + 6y = 7'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(3), c: makeRational(4) },
      eq2: { a: makeRational(5), b: makeRational(6), c: makeRational(7) },
    },
    calculatorScreenResult: 'x = −1 ; y = 2',
    pedagogicalNote:
      'Chuyển −4 và −7 sang vế phải để đúng dạng chuẩn a₁x + b₁y = c₁ (c₁ = 4, c₂ = 7) trước khi nhập hệ số.',
  },
  {
    id: 'calc_tha',
    badge: 'Thực hành a • SGK trang 15',
    title: 'Hệ có nghiệm phân số / số thập phân',
    rawSystemDisplay: ['2x + 3y = −4', '−3x − 7y = 13'],
    needsNormalization: false,
    normalizedDisplay: ['2x + 3y = −4', '−3x − 7y = 13'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(3), c: makeRational(-4) },
      eq2: { a: makeRational(-3), b: makeRational(-7), c: makeRational(13) },
    },
    calculatorScreenResult: 'x = 11/5 (2,2) ; y = −14/5 (−2,8)',
    pedagogicalNote: 'Máy hiển thị nghiệm chính xác dưới dạng phân số 11/5 và −14/5 (hoặc S⇔D: 2,2 và −2,8).',
  },
  {
    id: 'calc_thb',
    badge: 'Thực hành b • SGK trang 15',
    title: 'Hệ vô nghiệm trên máy tính cầm tay',
    rawSystemDisplay: ['2x + 3y = 1', '−x − 1,5y = 1'],
    needsNormalization: false,
    normalizedDisplay: ['2x + 3y = 1', '−x − 1,5y = 1'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(3), c: makeRational(1) },
      eq2: { a: makeRational(-1), b: makeRational(-3, 2), c: makeRational(1) },
    },
    calculatorScreenResult: 'No-Solution (Vô nghiệm)',
    pedagogicalNote: 'Khi màn hình hiển thị "No-Solution" hoặc "Vô nghiệm", ta kết luận hệ phương trình vô nghiệm.',
  },
  {
    id: 'calc_thc',
    badge: 'Thực hành c • SGK trang 15',
    title: 'Hệ vô số nghiệm (cần chuyển vế chuẩn hóa)',
    rawSystemDisplay: ['8x − 2y − 6 = 0', '4x − y − 3 = 0'],
    needsNormalization: true,
    normalizedDisplay: ['8x − 2y = 6', '4x − y = 3'],
    system: {
      eq1: { a: makeRational(8), b: makeRational(-2), c: makeRational(6) },
      eq2: { a: makeRational(4), b: makeRational(-1), c: makeRational(3) },
    },
    calculatorScreenResult: 'Infinite Sol (Vô số nghiệm)',
    pedagogicalNote:
      'Máy báo "Infinite Sol" (Vô số nghiệm). Ta vẫn phải dùng phương trình 4x − y = 3 ⇒ y = 4x − 3 để viết nghiệm tổng quát (t; 4t − 3), t ∈ ℝ.',
  },
];

// ============================================================================
// ACTIVITY 6: SGK EXERCISES 1.6 – 1.9 & SUPPLEMENTARY PRACTICE (12 ITEMS)
// ============================================================================

export interface TextbookExerciseItem {
  readonly id: string;
  readonly groupCode: '1.6' | '1.7' | '1.8' | '1.9' | 'bo_sung';
  readonly isSupplementary: boolean;
  readonly codeLabel: string; // e.g. "Bài 1.6a (SGK trang 16)" or "Bổ sung 01"
  readonly methodTag: string;
  readonly promptVi: string;
  readonly systemDisplay: [string, string];
  readonly system: LinearSystem2x2;
  readonly stepByStepGuide: string[];
  readonly expectedAnswerDisplay: string;
}

export const TEXTBOOK_EXERCISES_16_TO_19: TextbookExerciseItem[] = [
  // Bài 1.6 (Phương pháp thế)
  {
    id: 'bt_1_6_a',
    groupCode: '1.6',
    isSupplementary: false,
    codeLabel: 'Bài 1.6a • SGK trang 16',
    methodTag: 'Phương pháp thế',
    promptVi: 'Giải hệ phương trình bằng phương pháp thế:',
    systemDisplay: ['x − y = 3', '3x − 4y = 2'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(-1), c: makeRational(3) },
      eq2: { a: makeRational(3), b: makeRational(-4), c: makeRational(2) },
    },
    stepByStepGuide: [
      'Từ phương trình (1) suy ra x = y + 3.',
      'Thế x = y + 3 vào phương trình (2): 3(y + 3) − 4y = 2 ⇔ 9 − y = 2 ⇔ y = 7.',
      'Thay y = 7 vào x = y + 3 ⇒ x = 7 + 3 = 10. Nghiệm của hệ là (10; 7).',
    ],
    expectedAnswerDisplay: '(10; 7)',
  },
  {
    id: 'bt_1_6_b',
    groupCode: '1.6',
    isSupplementary: false,
    codeLabel: 'Bài 1.6b • SGK trang 16',
    methodTag: 'Phương pháp thế',
    promptVi: 'Giải hệ phương trình bằng phương pháp thế:',
    systemDisplay: ['7x − 3y = 13', '4x + y = 2'],
    system: {
      eq1: { a: makeRational(7), b: makeRational(-3), c: makeRational(13) },
      eq2: { a: makeRational(4), b: makeRational(1), c: makeRational(2) },
    },
    stepByStepGuide: [
      'Từ phương trình (2) suy ra y = 2 − 4x.',
      'Thế vào phương trình (1): 7x − 3(2 − 4x) = 13 ⇔ 19x − 6 = 13 ⇔ 19x = 19 ⇔ x = 1.',
      'Thay x = 1 vào y = 2 − 4x ⇒ y = 2 − 4·1 = −2. Nghiệm của hệ là (1; −2).',
    ],
    expectedAnswerDisplay: '(1; −2)',
  },
  {
    id: 'bt_1_6_c',
    groupCode: '1.6',
    isSupplementary: false,
    codeLabel: 'Bài 1.6c • SGK trang 16',
    methodTag: 'Phương pháp thế',
    promptVi: 'Giải hệ phương trình bằng phương pháp thế:',
    systemDisplay: ['0,5x − 1,5y = 1', '−x + 3y = 2'],
    system: {
      eq1: { a: makeRational(1, 2), b: makeRational(-3, 2), c: makeRational(1) },
      eq2: { a: makeRational(-1), b: makeRational(3), c: makeRational(2) },
    },
    stepByStepGuide: [
      'Từ phương trình (2) suy ra x = 3y − 2.',
      'Thế vào phương trình (1): 0,5(3y − 2) − 1,5y = 1 ⇔ 1,5y − 1 − 1,5y = 1 ⇔ 0y = 2 (vô lí).',
      'Vậy hệ phương trình đã cho vô nghiệm.',
    ],
    expectedAnswerDisplay: 'Vô nghiệm',
  },

  // Bài 1.7 (Phương pháp cộng đại số)
  {
    id: 'bt_1_7_a',
    groupCode: '1.7',
    isSupplementary: false,
    codeLabel: 'Bài 1.7a • SGK trang 16',
    methodTag: 'Phương pháp cộng đại số',
    promptVi: 'Giải hệ phương trình bằng phương pháp cộng đại số:',
    systemDisplay: ['3x + 2y = 6', '2x − 2y = 14'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(2), c: makeRational(6) },
      eq2: { a: makeRational(2), b: makeRational(-2), c: makeRational(14) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình của hệ: 5x = 20 ⇒ x = 4.',
      'Thay x = 4 vào phương trình (1): 3·4 + 2y = 6 ⇔ 2y = −6 ⇔ y = −3.',
      'Vậy hệ phương trình có nghiệm duy nhất là (4; −3).',
    ],
    expectedAnswerDisplay: '(4; −3)',
  },
  {
    id: 'bt_1_7_b',
    groupCode: '1.7',
    isSupplementary: false,
    codeLabel: 'Bài 1.7b • SGK trang 16',
    methodTag: 'Phương pháp cộng đại số',
    promptVi: 'Giải hệ phương trình bằng phương pháp cộng đại số:',
    systemDisplay: ['0,3x + 0,5y = 3', '1,5x − 2y = 1,5'],
    system: {
      eq1: { a: makeRational(3, 10), b: makeRational(5, 10), c: makeRational(3) },
      eq2: { a: makeRational(15, 10), b: makeRational(-2), c: makeRational(15, 10) },
    },
    stepByStepGuide: [
      'Nhân hai vế của phương trình (1) với 4 ta được: 1,2x + 2y = 12.',
      'Cộng từng vế với phương trình (2): 2,7x = 13,5 ⇒ x = 5.',
      'Thay x = 5 vào (1): 0,3·5 + 0,5y = 3 ⇔ 0,5y = 1,5 ⇔ y = 3. Nghiệm là (5; 3).',
    ],
    expectedAnswerDisplay: '(5; 3)',
  },
  {
    id: 'bt_1_7_c',
    groupCode: '1.7',
    isSupplementary: false,
    codeLabel: 'Bài 1.7c • SGK trang 16',
    methodTag: 'Phương pháp cộng đại số',
    promptVi: 'Giải hệ phương trình bằng phương pháp cộng đại số:',
    systemDisplay: ['−2x + 6y = 8', '3x − 9y = −12'],
    system: {
      eq1: { a: makeRational(-2), b: makeRational(6), c: makeRational(8) },
      eq2: { a: makeRational(3), b: makeRational(-9), c: makeRational(-12) },
    },
    stepByStepGuide: [
      'Chia phương trình (1) cho −2 ta được x − 3y = −4; chia phương trình (2) cho 3 cũng được x − 3y = −4.',
      'Trừ từng vế thu được 0x + 0y = 0 (luôn đúng).',
      'Kết hợp với x − 3y = −4 ⇒ x = 3y − 4. Nghiệm tổng quát: (3t − 4; t) với t ∈ ℝ.',
    ],
    expectedAnswerDisplay: 'Vô số nghiệm (3t − 4; t), t ∈ ℝ',
  },

  // Bài 1.8 (Hệ chứa tham số m: { 2x - y = -3 ; -2m²x + 9y = 3(m + 3) })
  {
    id: 'bt_1_8_a',
    groupCode: '1.8',
    isSupplementary: false,
    codeLabel: 'Bài 1.8a (m = −2) • SGK trang 16',
    methodTag: 'Hệ chứa tham số m',
    promptVi: 'Cho hệ { 2x − y = −3 ; −2m²x + 9y = 3(m + 3) }. Giải hệ khi m = −2:',
    systemDisplay: ['2x − y = −3', '−8x + 9y = 3'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(-1), c: makeRational(-3) },
      eq2: { a: makeRational(-8), b: makeRational(9), c: makeRational(3) },
    },
    stepByStepGuide: [
      'Thay m = −2 vào phương trình (2): −2·(−2)²x + 9y = 3(−2 + 3) ⇔ −8x + 9y = 3.',
      'Từ (1) suy ra y = 2x + 3. Thế vào (2): −8x + 9(2x + 3) = 3 ⇔ 10x + 27 = 3 ⇔ 10x = −24 ⇔ x = −12/5.',
      'Thay x = −12/5 vào y = 2x + 3 ⇒ y = −24/5 + 15/5 = −9/5. Nghiệm là (−12/5; −9/5) hay (−2,4; −1,8).',
    ],
    expectedAnswerDisplay: '(−12/5; −9/5)',
  },
  {
    id: 'bt_1_8_b',
    groupCode: '1.8',
    isSupplementary: false,
    codeLabel: 'Bài 1.8b (m = −3) • SGK trang 16',
    methodTag: 'Hệ chứa tham số m',
    promptVi: 'Cho hệ { 2x − y = −3 ; −2m²x + 9y = 3(m + 3) }. Giải hệ khi m = −3:',
    systemDisplay: ['2x − y = −3', '−18x + 9y = 0'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(-1), c: makeRational(-3) },
      eq2: { a: makeRational(-18), b: makeRational(9), c: makeRational(0) },
    },
    stepByStepGuide: [
      'Thay m = −3 vào phương trình (2): −2·(−3)²x + 9y = 3(−3 + 3) ⇔ −18x + 9y = 0.',
      'Nhân phương trình (1) với 9: 18x − 9y = −27. Cộng với (2) được 0x = −27 (vô lí).',
      'Vậy khi m = −3 thì hệ phương trình vô nghiệm.',
    ],
    expectedAnswerDisplay: 'Vô nghiệm',
  },
  {
    id: 'bt_1_8_c',
    groupCode: '1.8',
    isSupplementary: false,
    codeLabel: 'Bài 1.8c (m = 3) • SGK trang 16',
    methodTag: 'Hệ chứa tham số m',
    promptVi: 'Cho hệ { 2x − y = −3 ; −2m²x + 9y = 3(m + 3) }. Giải hệ khi m = 3:',
    systemDisplay: ['2x − y = −3', '−18x + 9y = 18'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(-1), c: makeRational(-3) },
      eq2: { a: makeRational(-18), b: makeRational(9), c: makeRational(18) },
    },
    stepByStepGuide: [
      'Thay m = 3 vào phương trình (2): −2·3²x + 9y = 3(3 + 3) ⇔ −18x + 9y = 18.',
      'Nhân phương trình (1) với 9: 18x − 9y = −27. Cộng với (2) được 0x = −9 (vô lí).',
      'Vậy khi m = 3 thì hệ phương trình vô nghiệm.',
    ],
    expectedAnswerDisplay: 'Vô nghiệm',
  },

  // Bài 1.9 (Sử dụng máy tính cầm tay)
  {
    id: 'bt_1_9_a',
    groupCode: '1.9',
    isSupplementary: false,
    codeLabel: 'Bài 1.9a • SGK trang 16',
    methodTag: 'Máy tính cầm tay',
    promptVi: 'Tìm nghiệm của hệ phương trình bằng máy tính cầm tay:',
    systemDisplay: ['5x − 3y = −10', '2x + 4y = −4'],
    system: {
      eq1: { a: makeRational(5), b: makeRational(-3), c: makeRational(-10) },
      eq2: { a: makeRational(2), b: makeRational(4), c: makeRational(-4) },
    },
    stepByStepGuide: [
      'Hệ đã ở dạng chuẩn: a₁ = 5, b₁ = −3, c₁ = −10; a₂ = 2, b₂ = 4, c₂ = −4.',
      'Nhập hệ số vào máy tính cầm tay, màn hình hiển thị x = −2, y = 0.',
      'Nghiệm của hệ là (−2; 0).',
    ],
    expectedAnswerDisplay: '(−2; 0)',
  },
  {
    id: 'bt_1_9_b',
    groupCode: '1.9',
    isSupplementary: false,
    codeLabel: 'Bài 1.9b • SGK trang 16',
    methodTag: 'Máy tính cầm tay',
    promptVi: 'Tìm nghiệm của hệ phương trình bằng máy tính cầm tay:',
    systemDisplay: ['x − 3y = 2', '−2x + 6y = −4'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(-3), c: makeRational(2) },
      eq2: { a: makeRational(-2), b: makeRational(6), c: makeRational(-4) },
    },
    stepByStepGuide: [
      'Nhập hệ số: a₁ = 1, b₁ = −3, c₁ = 2; a₂ = −2, b₂ = 6, c₂ = −4.',
      'Máy báo Infinite Sol (Vô số nghiệm).',
      'Từ x − 3y = 2 ⇒ x = 3y + 2. Nghiệm tổng quát: (3t + 2; t) với t ∈ ℝ.',
    ],
    expectedAnswerDisplay: 'Vô số nghiệm (3t + 2; t), t ∈ ℝ',
  },
  {
    id: 'bt_1_9_c',
    groupCode: '1.9',
    isSupplementary: false,
    codeLabel: 'Bài 1.9c • SGK trang 16',
    methodTag: 'Máy tính cầm tay',
    promptVi: 'Tìm nghiệm của hệ phương trình bằng máy tính cầm tay:',
    systemDisplay: ['3x + y = −1', '6x + 2y = 1'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(1), c: makeRational(-1) },
      eq2: { a: makeRational(6), b: makeRational(2), c: makeRational(1) },
    },
    stepByStepGuide: [
      'Nhập hệ số: a₁ = 3, b₁ = 1, c₁ = −1; a₂ = 6, b₂ = 2, c₂ = 1.',
      'Máy báo No-Solution (Vô nghiệm).',
      'Vậy hệ phương trình đã cho vô nghiệm.',
    ],
    expectedAnswerDisplay: 'Vô nghiệm',
  },
  {
    id: 'bt_1_9_d',
    groupCode: '1.9',
    isSupplementary: false,
    codeLabel: 'Bài 1.9d • SGK trang 16',
    methodTag: 'Máy tính cầm tay',
    promptVi: 'Tìm nghiệm của hệ phương trình bằng máy tính cầm tay:',
    systemDisplay: ['4x + (2/5)y = 12', '−2x + (1/3)y = −14'],
    system: {
      eq1: { a: makeRational(4), b: makeRational(2, 5), c: makeRational(12) },
      eq2: { a: makeRational(-2), b: makeRational(1, 3), c: makeRational(-14) },
    },
    stepByStepGuide: [
      'Nhập các hệ số phân số bằng phím phân số hoặc phép chia: b₁ = 2/5, b₂ = 1/3.',
      'Máy hiển thị x = 9/2 (4,5) và y = −15.',
      'Vậy nghiệm của hệ là (9/2; −15).',
    ],
    expectedAnswerDisplay: '(9/2; −15)',
  },
];

// 12 Supplementary Practice Items clearly labeled "Bổ sung"
export const SUPPLEMENTARY_EXERCISES: TextbookExerciseItem[] = [
  {
    id: 'bs_01',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 01 • Tự luyện',
    methodTag: 'Bổ sung • Phương pháp thế',
    promptVi: '[Bổ sung] Giải hệ phương trình bằng phương pháp thế:',
    systemDisplay: ['x + 2y = 5', '3x − y = 1'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(2), c: makeRational(5) },
      eq2: { a: makeRational(3), b: makeRational(-1), c: makeRational(1) },
    },
    stepByStepGuide: [
      'Từ (1) suy ra x = 5 − 2y.',
      'Thế vào (2): 3(5 − 2y) − y = 1 ⇔ 15 − 7y = 1 ⇔ y = 2.',
      'Thay y = 2 vào x = 5 − 2y ⇒ x = 1. Nghiệm (1; 2).',
    ],
    expectedAnswerDisplay: '(1; 2)',
  },
  {
    id: 'bs_02',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 02 • Tự luyện',
    methodTag: 'Bổ sung • Phương pháp thế',
    promptVi: '[Bổ sung] Giải hệ phương trình bằng phương pháp thế:',
    systemDisplay: ['2x + y = 7', '5x − 2y = 4'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(1), c: makeRational(7) },
      eq2: { a: makeRational(5), b: makeRational(-2), c: makeRational(4) },
    },
    stepByStepGuide: [
      'Từ (1) suy ra y = 7 − 2x.',
      'Thế vào (2): 5x − 2(7 − 2x) = 4 ⇔ 9x = 18 ⇔ x = 2.',
      'Thay x = 2 ⇒ y = 3. Nghiệm (2; 3).',
    ],
    expectedAnswerDisplay: '(2; 3)',
  },
  {
    id: 'bs_03',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 03 • Tự luyện',
    methodTag: 'Bổ sung • Phương pháp thế',
    promptVi: '[Bổ sung] Xét số nghiệm và giải hệ bằng phương pháp thế:',
    systemDisplay: ['x − 2y = 4', '−2x + 4y = −8'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(-2), c: makeRational(4) },
      eq2: { a: makeRational(-2), b: makeRational(4), c: makeRational(-8) },
    },
    stepByStepGuide: [
      'Từ (1) suy ra x = 2y + 4.',
      'Thế vào (2): −2(2y + 4) + 4y = −8 ⇔ 0y = 0 (luôn đúng).',
      'Hệ có vô số nghiệm (2t + 4; t) với t ∈ ℝ.',
    ],
    expectedAnswerDisplay: 'Vô số nghiệm (2t + 4; t), t ∈ ℝ',
  },
  {
    id: 'bs_04',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 04 • Tự luyện',
    methodTag: 'Bổ sung • Cộng đại số',
    promptVi: '[Bổ sung] Giải hệ phương trình bằng phương pháp cộng đại số:',
    systemDisplay: ['3x + y = 10', 'x − y = 2'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(1), c: makeRational(10) },
      eq2: { a: makeRational(1), b: makeRational(-1), c: makeRational(2) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình: 4x = 12 ⇒ x = 3.',
      'Thay x = 3 vào x − y = 2 ⇒ y = 1. Nghiệm (3; 1).',
    ],
    expectedAnswerDisplay: '(3; 1)',
  },
  {
    id: 'bs_05',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 05 • Tự luyện',
    methodTag: 'Bổ sung • Cộng đại số',
    promptVi: '[Bổ sung] Giải hệ phương trình bằng phương pháp cộng đại số:',
    systemDisplay: ['4x + 5y = 3', '4x + 2y = 9'],
    system: {
      eq1: { a: makeRational(4), b: makeRational(5), c: makeRational(3) },
      eq2: { a: makeRational(4), b: makeRational(2), c: makeRational(9) },
    },
    stepByStepGuide: [
      'Trừ từng vế (1) cho (2): 3y = −6 ⇒ y = −2.',
      'Thay y = −2 vào 4x + 2y = 9 ⇒ 4x = 13 ⇒ x = 13/4. Nghiệm (13/4; −2).',
    ],
    expectedAnswerDisplay: '(13/4; −2)',
  },
  {
    id: 'bs_06',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 06 • Tự luyện',
    methodTag: 'Bổ sung • Cộng đại số',
    promptVi: '[Bổ sung] Nhân hệ số thích hợp rồi giải hệ bằng cộng đại số:',
    systemDisplay: ['2x + 3y = 13', '3x − 2y = 0'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(3), c: makeRational(13) },
      eq2: { a: makeRational(3), b: makeRational(-2), c: makeRational(0) },
    },
    stepByStepGuide: [
      'Nhân (1) với 2 và (2) với 3: 4x + 6y = 26 và 9x − 6y = 0.',
      'Cộng từng vế: 13x = 26 ⇒ x = 2 ⇒ y = 3. Nghiệm (2; 3).',
    ],
    expectedAnswerDisplay: '(2; 3)',
  },
  {
    id: 'bs_07',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 07 • Tự luyện',
    methodTag: 'Bổ sung • Nhận biết số nghiệm',
    promptVi: '[Bổ sung] Xét số nghiệm của hệ phương trình:',
    systemDisplay: ['2x − y = 5', '−4x + 2y = 1'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(-1), c: makeRational(5) },
      eq2: { a: makeRational(-4), b: makeRational(2), c: makeRational(1) },
    },
    stepByStepGuide: [
      'Nhân (1) với 2: 4x − 2y = 10.',
      'Cộng với (2): 0x + 0y = 11 (vô lí) ⇒ Hệ vô nghiệm.',
    ],
    expectedAnswerDisplay: 'Vô nghiệm',
  },
  {
    id: 'bs_08',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 08 • Tự luyện',
    methodTag: 'Bổ sung • Hệ số thập phân',
    promptVi: '[Bổ sung] Giải hệ phương trình có hệ số thập phân:',
    systemDisplay: ['0,2x + 0,3y = 1,3', '0,5x − 0,3y = 0,8'],
    system: {
      eq1: { a: makeRational(2, 10), b: makeRational(3, 10), c: makeRational(13, 10) },
      eq2: { a: makeRational(5, 10), b: makeRational(-3, 10), c: makeRational(8, 10) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình: 0,7x = 2,1 ⇒ x = 3.',
      'Thay x = 3 vào (1): 0,6 + 0,3y = 1,3 ⇒ 0,3y = 0,7 ⇒ y = 7/3. Nghiệm (3; 7/3).',
    ],
    expectedAnswerDisplay: '(3; 7/3)',
  },
  {
    id: 'bs_09',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 09 • Tự luyện',
    methodTag: 'Bổ sung • Đưa về dạng chuẩn',
    promptVi: '[Bổ sung] Đưa về dạng chuẩn rồi giải hệ phương trình:',
    systemDisplay: ['3x − y = 1', 'x + y = 7'],
    system: {
      eq1: { a: makeRational(3), b: makeRational(-1), c: makeRational(1) },
      eq2: { a: makeRational(1), b: makeRational(1), c: makeRational(7) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình: 4x = 8 ⇒ x = 2.',
      'Thay x = 2 vào x + y = 7 ⇒ y = 5. Nghiệm (2; 5).',
    ],
    expectedAnswerDisplay: '(2; 5)',
  },
  {
    id: 'bs_10',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 10 • Tự luyện',
    methodTag: 'Bổ sung • Nghiệm âm',
    promptVi: '[Bổ sung] Giải hệ phương trình:',
    systemDisplay: ['2x + 5y = −11', '3x − 5y = −4'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(5), c: makeRational(-11) },
      eq2: { a: makeRational(3), b: makeRational(-5), c: makeRational(-4) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình: 5x = −15 ⇒ x = −3.',
      'Thay x = −3 vào 2x + 5y = −11 ⇒ −6 + 5y = −11 ⇒ y = −1. Nghiệm (−3; −1).',
    ],
    expectedAnswerDisplay: '(−3; −1)',
  },
  {
    id: 'bs_11',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 11 • Tự luyện',
    methodTag: 'Bổ sung • Vô số nghiệm',
    promptVi: '[Bổ sung] Tìm nghiệm tổng quát của hệ phương trình:',
    systemDisplay: ['2x + y = 4', '4x + 2y = 8'],
    system: {
      eq1: { a: makeRational(2), b: makeRational(1), c: makeRational(4) },
      eq2: { a: makeRational(4), b: makeRational(2), c: makeRational(8) },
    },
    stepByStepGuide: [
      'Từ (1) suy ra y = −2x + 4. Thế vào (2) thu được 0x = 0.',
      'Nghiệm tổng quát của hệ là (t; −2t + 4) với t ∈ ℝ.',
    ],
    expectedAnswerDisplay: 'Vô số nghiệm (t; −2t + 4), t ∈ ℝ',
  },
  {
    id: 'bs_12',
    groupCode: 'bo_sung',
    isSupplementary: true,
    codeLabel: 'Bổ sung 12 • Tự luyện',
    methodTag: 'Bổ sung • Vận dụng',
    promptVi: '[Bổ sung] Tổng của hai số bằng 25, hai lần số thứ nhất lớn hơn số thứ hai là 8. Hệ { x + y = 25 ; 2x − y = 8 } có nghiệm là:',
    systemDisplay: ['x + y = 25', '2x − y = 8'],
    system: {
      eq1: { a: makeRational(1), b: makeRational(1), c: makeRational(25) },
      eq2: { a: makeRational(2), b: makeRational(-1), c: makeRational(8) },
    },
    stepByStepGuide: [
      'Cộng từng vế hai phương trình: 3x = 33 ⇒ x = 11.',
      'Thay x = 11 vào x + y = 25 ⇒ y = 14. Nghiệm (11; 14).',
    ],
    expectedAnswerDisplay: '(11; 14)',
  },
];

// ============================================================================
// END-OF-LESSON 6-QUESTION DIAGNOSTIC QUIZ (PHIẾU ĐÁNH GIÁ CUỐI BÀI)
// ============================================================================

export interface DiagnosticQuestion {
  readonly id: string;
  readonly objectiveTag: string;
  readonly reviewActivityIndex: number; // 1..6
  readonly reviewSectionName: string;
  readonly prompt: string;
  readonly options: [string, string, string, string];
  readonly correctIndex: number;
  readonly explanation: string;
}

export const DIAGNOSTIC_QUIZ_6: DiagnosticQuestion[] = [
  {
    id: 'dq1',
    objectiveTag: 'Mục tiêu 1: Mô hình hóa bài toán mở đầu',
    reviewActivityIndex: 1,
    reviewSectionName: 'Hoạt động 1: Vườn cải bắp',
    prompt:
      'Trong bài toán vườn cải bắp (SGK trang 11), phương trình (x + 8)(y − 3) = xy − 108 sau khi khai triển và rút gọn xy ở hai vế trở thành phương trình bậc nhất hai ẩn nào?',
    options: [
      '−3x + 8y = −84',
      '−3x + 8y = −108',
      '8x − 3y = −84',
      '3x + 8y = 84',
    ],
    correctIndex: 0,
    explanation:
      'Khai triển (x + 8)(y − 3) = xy − 3x + 8y − 24 = xy − 108 ⇔ −3x + 8y = −108 + 24 = −84.',
  },
  {
    id: 'dq2',
    objectiveTag: 'Mục tiêu 2: Phương pháp thế',
    reviewActivityIndex: 2,
    reviewSectionName: 'Hoạt động 2: Phương pháp thế',
    prompt:
      'Trong Ví dụ 1 (SGK trang 11), khi thế y = 2x − 3 từ phương trình (1) vào phương trình (2): x + 2y = 4, ta thu được phương trình một ẩn nào?',
    options: [
      'x + 2(2x − 3) = 4 ⇔ 5x − 6 = 4',
      'x + 4x − 3 = 4 ⇔ 5x − 3 = 4',
      '2x + 2(2x − 3) = 4 ⇔ 6x − 6 = 4',
      'x + 2(3 − 2x) = 4 ⇔ −3x + 6 = 4',
    ],
    correctIndex: 0,
    explanation:
      'Phải đặt biểu thức 2x − 3 trong ngoặc khi nhân với 2: x + 2(2x − 3) = 4 ⇔ x + 4x − 6 = 4 ⇔ 5x − 6 = 4.',
  },
  {
    id: 'dq3',
    objectiveTag: 'Mục tiêu 3: Phương pháp cộng đại số',
    reviewActivityIndex: 3,
    reviewSectionName: 'Hoạt động 3: Phương pháp cộng đại số',
    prompt:
      'Để giải hệ { 3x + 2y = 7 (1) ; 2x − 3y = −4 (2) } ở Ví dụ 6 (SGK trang 14) bằng cách khử y, ta nhân hai vế của (1) với 3 và nhân hai vế của (2) với 2 rồi cộng từng vế thì thu được:',
    options: [
      '13x = 13 (kết hợp với một phương trình của hệ để tìm y)',
      '13x = 3',
      '5x = 13',
      '13x + 12y = 13',
    ],
    correctIndex: 0,
    explanation:
      'Nhân (1) với 3 được 9x + 6y = 21; nhân (2) với 2 được 4x − 6y = −8. Cộng từng vế được 13x = 13 ⇒ x = 1, kết hợp 3x + 2y = 7 ⇒ y = 2.',
  },
  {
    id: 'dq4',
    objectiveTag: 'Mục tiêu 4: Phân biệt ba trường hợp nghiệm',
    reviewActivityIndex: 4,
    reviewSectionName: 'Hoạt động 4: Ba trường hợp nghiệm',
    prompt:
      'Khi giải hệ { −x + y = −2 ; 3x − 3y = 6 } (Ví dụ 3 SGK trang 12), ta dẫn tới phương trình 0x = 0. Kết luận nào sau đây là ĐÚNG?',
    options: [
      'Hệ có vô số nghiệm dạng (t; t − 2) với t ∈ ℝ.',
      'Mọi cặp số thực (x; y) bất kỳ trên ℝ² đều là nghiệm của hệ.',
      'Hệ có nghiệm duy nhất (0; 0).',
      'Hệ phương trình vô nghiệm.',
    ],
    correctIndex: 0,
    explanation:
      'Phương trình 0x = 0 nghiệm đúng với mọi x ∈ ℝ, nhưng y vẫn phải thỏa mãn −x + y = −2 ⇔ y = x − 2. Vậy nghiệm tổng quát là (t; t − 2), t ∈ ℝ.',
  },
  {
    id: 'dq5',
    objectiveTag: 'Mục tiêu 5: Sử dụng máy tính cầm tay',
    reviewActivityIndex: 5,
    reviewSectionName: 'Hoạt động 5: Máy tính cầm tay',
    prompt:
      'Trước khi dùng máy tính cầm tay giải hệ { 2x + 3y − 4 = 0 ; 5x + 6y − 7 = 0 } (SGK trang 15), ta cần nhập bộ hệ số (a₁, b₁, c₁, a₂, b₂, c₂) nào sau khi chuyển về dạng chuẩn a₁x + b₁y = c₁?',
    options: [
      'a₁ = 2, b₁ = 3, c₁ = 4 và a₂ = 5, b₂ = 6, c₂ = 7',
      'a₁ = 2, b₁ = 3, c₁ = −4 và a₂ = 5, b₂ = 6, c₂ = −7',
      'a₁ = 3, b₁ = 2, c₁ = 4 và a₂ = 6, b₂ = 5, c₂ = 7',
      'a₁ = 2, b₁ = −4, c₁ = 3 và a₂ = 5, b₂ = −7, c₂ = 6',
    ],
    correctIndex: 0,
    explanation:
      'Đưa hệ về dạng chuẩn 2x + 3y = 4 và 5x + 6y = 7 nên c₁ = 4 và c₂ = 7.',
  },
  {
    id: 'dq6',
    objectiveTag: 'Mục tiêu 6: Vận dụng thực tế',
    reviewActivityIndex: 6,
    reviewSectionName: 'Hoạt động 6: Luyện tập và vận dụng',
    prompt:
      'Trong Vận dụng 1 (SGK trang 15), giải hệ { −3x + 8y = −84 ; 2x − 4y = 72 } ta tìm được x = 60 (luống), y = 12 (cây/luống). Tổng số cây cải bắp ban đầu trong vườn nhà bác Đạt là:',
    options: [
      '720 cây',
      '612 cây',
      '784 cây',
      '72 cây',
    ],
    correctIndex: 0,
    explanation:
      'Số cây cải bắp ban đầu là x·y = 60 · 12 = 720 (cây).',
  },
];
