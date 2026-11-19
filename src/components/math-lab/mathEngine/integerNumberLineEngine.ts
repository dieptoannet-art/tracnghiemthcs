// ============================================================================
// M07 – SỐ NGUYÊN VÀ TRỤC SỐ (INTEGER & NUMBER LINE MATHEMATICAL ENGINE)
// Pure TypeScript engine: zero -0 guarantee, coordinate mapping, tick snapping,
// jump-step state machine, BFS rescue solver, 48-task pedagogical bank, and unit tests.
// ============================================================================

export type M07ActivityId =
  | 'EXPLORE_NEGATIVE'   // Hoạt động 1: Khám phá số âm
  | 'PLACE_ON_LINE'      // Hoạt động 2: Đặt số trên trục số
  | 'COMPARE_INTEGERS'   // Hoạt động 3: So sánh số nguyên
  | 'OPPOSITE_DISTANCE'  // Hoạt động 4: Số đối và khoảng cách
  | 'JUMP_ADD_SUB'       // Hoạt động 5: Cộng, trừ bằng bước nhảy
  | 'RESCUE_MISSION';    // Hoạt động 6: Giải cứu trên trục số

export type M07Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type M07TickStep = 1 | 2 | 5;

export type M07RealWorldContext = 'THERMOMETER' | 'ELEVATOR' | 'SEA_LEVEL';

export type M07CompareOperator = '<' | '>' | '=';

export interface M07JumpCalculation {
  a: number;
  op: '+' | '-';
  b: number;
  effectiveDelta: number; // +b for addition, -b for subtraction
  result: number;
  originalExpression: string;   // e.g. "(-3) - (-5)"
  transformedExpression: string | null; // e.g. "(-3) + 5" when op === '-'
  fullEquationString: string;   // e.g. "(-3) - (-5) = (-3) + 5 = 2"
  direction: 'RIGHT' | 'LEFT' | 'STAY';
  distanceUnits: number;
  pedagogicalSteps: {
    stepNumber: 1 | 2 | 3 | 4 | 5;
    title: string;
    detail: string;
  }[];
}

export interface M07RescueCard {
  id: string;
  op: '+' | '-';
  operand: number;
  effectiveDelta: number;
  label: string; // e.g. "+ 4", "- (-3)", "+ (-5)"
}

export interface M07RescueVerification {
  start: number;
  target: number;
  stepsApplied: {
    card: M07RescueCard;
    from: number;
    to: number;
    expression: string;
  }[];
  finalPosition: number;
  reachedTarget: boolean;
  withinStepLimit: boolean;
  isOptimalStepCount: boolean;
  minPossibleSteps: number | null;
}

export interface M07TaskSpec {
  id: string;
  activityId: M07ActivityId;
  activityNumber: 1 | 2 | 3 | 4 | 5 | 6;
  difficulty: M07Difficulty;
  titleVi: string;
  promptVi: string;
  questionVi: string;
  params: {
    context?: M07RealWorldContext;
    targetValue?: number;
    secondValue?: number;
    numberCards?: number[];
    tickStep?: M07TickStep;
    minRange?: number;
    maxRange?: number;
    hideIntermediateLabels?: boolean;
    compareA?: number;
    compareB?: number;
    sortMode?: 'ASC' | 'DESC' | 'MAX' | 'MIN';
    oppositeSubMode?: 'TO_ZERO' | 'BETWEEN_TWO';
    pointA?: number;
    pointB?: number;
    jumpA?: number;
    jumpOp?: '+' | '-';
    jumpB?: number;
    rescueStart?: number;
    rescueTarget?: number;
    rescueMaxMoves?: number;
    rescueCards?: M07RescueCard[];
    rescueMode?: 'CHOOSE_CARDS' | 'FIND_MISSING';
    missingEquation?: { start: number; op: '+' | '-'; target: number; missingVal: number };
  };
  expectedAnswer: string | number;
  acceptedAnswers?: (string | number)[];
  choices?: string[];
  hints: [string, string, string]; // 3 progressive pedagogical hints
  explanationVi: string;
}

// ============================================================================
// 1. CANONICAL INTEGER & EXPRESSION HELPERS (NO -0 GUARANTEE)
// ============================================================================

export function normalizeInteger(val: number): number {
  if (!Number.isFinite(val)) return 0;
  const rounded = Math.round(val);
  if (Object.is(rounded, -0) || rounded === 0) return 0;
  return rounded;
}

export function formatIntegerTerm(n: number, wrapNegative: boolean = true): string {
  const clean = normalizeInteger(n);
  if (clean < 0 && wrapNegative) {
    return `(${clean})`;
  }
  return `${clean}`;
}

export function formatSignedDisplacement(delta: number): string {
  const clean = normalizeInteger(delta);
  if (clean > 0) return `+${clean}`;
  if (clean < 0) return `${clean}`;
  return '0';
}

// ============================================================================
// 2. UNIFIED NUMBER LINE COORDINATE MAPPING & TICK SNAPPING
// ============================================================================

export interface NumberLineViewport {
  min: number;
  max: number;
  leftPx: number;
  rightPx: number;
}

/**
 * Maps an exact mathematical value to its horizontal SVG pixel coordinate.
 */
export function numberToSvgX(value: number, viewport: NumberLineViewport): number {
  const { min, max, leftPx, rightPx } = viewport;
  const span = max - min;
  if (span <= 0) return (leftPx + rightPx) / 2;
  const ratio = (value - min) / span;
  return leftPx + ratio * (rightPx - leftPx);
}

/**
 * Maps a horizontal SVG pixel coordinate back to its mathematical value.
 */
export function svgXToNumber(xPx: number, viewport: NumberLineViewport): number {
  const { min, max, leftPx, rightPx } = viewport;
  const width = rightPx - leftPx;
  if (width <= 0) return min;
  const clampedRatio = Math.max(0, Math.min(1, (xPx - leftPx) / width));
  return min + clampedRatio * (max - min);
}

/**
 * Snaps a raw continuous value on the number line to valid positions of the form origin + k * step.
 * When snapMode === 'INTEGER', snaps to exact integers (step 1) even if major ticks are displayed at step 2 or 5,
 * ensuring odd numbers like -3 can be placed accurately on a step-2 axis without wrong rounding.
 */
export function snapValueToNumberLine(
  rawValue: number,
  step: M07TickStep,
  min: number,
  max: number,
  origin: number = 0,
  snapToExactInteger: boolean = false
): number {
  const effectiveStep = snapToExactInteger ? 1 : step;
  const k = Math.round((rawValue - origin) / effectiveStep);
  const snapped = origin + k * effectiveStep;
  const clamped = Math.max(min, Math.min(max, snapped));
  return normalizeInteger(clamped);
}

/**
 * Generates tick marks for a given range [min, max] and major step (1, 2, or 5).
 * Always includes integer minor ticks so values between major labels are visually represented.
 */
export function generateNumberLineTicks(
  min: number,
  max: number,
  majorStep: M07TickStep
): { value: number; isMajor: boolean; isZero: boolean }[] {
  const lo = Math.min(normalizeInteger(min), normalizeInteger(max));
  const hi = Math.max(normalizeInteger(min), normalizeInteger(max));
  const ticks: { value: number; isMajor: boolean; isZero: boolean }[] = [];

  // If range is very large (> 40), step by majorStep; otherwise include unit ticks
  const unitIncrement = hi - lo <= 40 ? 1 : majorStep;
  for (let v = lo; v <= hi; v += unitIncrement) {
    const cleanV = normalizeInteger(v);
    const isMajor = cleanV % majorStep === 0;
    ticks.push({
      value: cleanV,
      isMajor,
      isZero: cleanV === 0,
    });
  }
  return ticks;
}

/**
 * Computes an appropriate symmetric or padded number line range [min, max]
 * that guarantees all key points (start, end, 0) are comfortably visible.
 */
export function computeAutoNumberLineRange(
  points: number[],
  defaultHalfSpan: number = 6,
  majorStep: M07TickStep = 1
): { min: number; max: number } {
  const validPts = points.map(normalizeInteger);
  validPts.push(0);
  const minPt = Math.min(...validPts, -defaultHalfSpan);
  const maxPt = Math.max(...validPts, defaultHalfSpan);
  const pad = Math.max(2, majorStep);
  const rawMin = Math.floor((minPt - pad) / majorStep) * majorStep;
  const rawMax = Math.ceil((maxPt + pad) / majorStep) * majorStep;
  const bound = Math.max(Math.abs(rawMin), Math.abs(rawMax), defaultHalfSpan);
  // Keep within reasonable bounds [-30, 30] unless points exceed it
  const finalMin = normalizeInteger(Math.min(rawMin, -Math.min(bound, 10)));
  const finalMax = normalizeInteger(Math.max(rawMax, Math.min(bound, 10)));
  return { min: finalMin, max: finalMax };
}

// ============================================================================
// 3. INTEGER COMPARISON, OPPOSITE & DISTANCE ENGINE (ACTIVITIES 3 & 4)
// ============================================================================

export function compareIntegers(a: number, b: number): M07CompareOperator {
  const cleanA = normalizeInteger(a);
  const cleanB = normalizeInteger(b);
  if (cleanA < cleanB) return '<';
  if (cleanA > cleanB) return '>';
  return '=';
}

export function explainIntegerComparison(a: number, b: number): string {
  const cleanA = normalizeInteger(a);
  const cleanB = normalizeInteger(b);
  const rel = compareIntegers(cleanA, cleanB);

  if (rel === '=') {
    return `Hai số ${cleanA} và ${cleanB} nằm tại cùng một điểm trên trục số nên ${cleanA} = ${cleanB}.`;
  }

  const leftNum = Math.min(cleanA, cleanB);
  const rightNum = Math.max(cleanA, cleanB);
  const posRule = `Trên trục số nằm ngang, điểm ${cleanA} nằm bên ${
    cleanA < cleanB ? 'trái' : 'phải'
  } điểm ${cleanB}, mà số bên phải luôn lớn hơn số bên trái nên ${cleanA} ${rel} ${cleanB}.`;

  if (cleanA < 0 && cleanB < 0) {
    return `${posRule} (Trong hai số nguyên âm, số nào có khoảng cách đến 0 lớn hơn: |${leftNum}| = ${Math.abs(
      leftNum
    )} > |${rightNum}| = ${Math.abs(rightNum)} thì số đó nhỏ hơn: ${leftNum} < ${rightNum}).`;
  }
  if ((cleanA < 0 && cleanB === 0) || (cleanA === 0 && cleanB < 0)) {
    return `${posRule} (Mọi số nguyên âm đều nằm bên trái số 0 nên nhỏ hơn 0).`;
  }
  if ((cleanA < 0 && cleanB > 0) || (cleanA > 0 && cleanB < 0)) {
    return `${posRule} (Mọi số nguyên âm đều nhỏ hơn 0 và nhỏ hơn mọi số nguyên dương).`;
  }
  return posRule;
}

export function sortIntegers(nums: number[], order: 'ASC' | 'DESC' = 'ASC'): number[] {
  const cleaned = nums.map(normalizeInteger);
  return [...cleaned].sort((a, b) => (order === 'ASC' ? a - b : b - a));
}

export function getOppositeInteger(a: number): number {
  return normalizeInteger(-normalizeInteger(a));
}

export function getAbsoluteValue(a: number): number {
  return normalizeInteger(Math.abs(normalizeInteger(a)));
}

export function getDistanceBetweenPoints(a: number, b: number): number {
  return normalizeInteger(Math.abs(normalizeInteger(a) - normalizeInteger(b)));
}

// ============================================================================
// 4. JUMP ADDITION & SUBTRACTION ENGINE (ACTIVITY 5)
// ============================================================================

export function computeJumpOperation(
  rawA: number,
  op: '+' | '-',
  rawB: number
): M07JumpCalculation {
  const a = normalizeInteger(rawA);
  const b = normalizeInteger(rawB);
  const effectiveDelta = normalizeInteger(op === '+' ? b : -b);
  const result = normalizeInteger(a + effectiveDelta);

  const aStr = formatIntegerTerm(a, a < 0);
  const bStr = formatIntegerTerm(b, b < 0);
  const originalExpression = `${aStr} ${op} ${bStr}`;

  let transformedExpression: string | null = null;
  let fullEquationString = `${originalExpression} = ${result}`;

  if (op === '-') {
    const oppB = getOppositeInteger(b);
    const oppBStr = formatIntegerTerm(oppB, oppB < 0);
    transformedExpression = `${aStr} + ${oppBStr}`;
    fullEquationString = `${originalExpression} = ${transformedExpression} = ${result}`;
  }

  const direction: 'RIGHT' | 'LEFT' | 'STAY' =
    effectiveDelta > 0 ? 'RIGHT' : effectiveDelta < 0 ? 'LEFT' : 'STAY';
  const distanceUnits = Math.abs(effectiveDelta);

  const step2Detail =
    op === '-'
      ? `Muốn trừ số nguyên ${aStr} cho ${bStr}, ta cộng ${aStr} với số đối của ${bStr} là ${formatIntegerTerm(
          effectiveDelta,
          effectiveDelta < 0
        )}: ${originalExpression} = ${transformedExpression}. (Lưu ý: Phép trừ một số nguyên âm làm ta di chuyển sang PHẢI!).`
      : `Phép cộng trực tiếp: từ vị trí ${a}, ta cộng thêm ${bStr}.`;

  const step3Detail =
    direction === 'RIGHT'
      ? `Vì độ dịch chuyển là +${distanceUnits} (> 0), ta vẽ mũi tên hướng sang PHẢI dài ${distanceUnits} đơn vị.`
      : direction === 'LEFT'
      ? `Vì độ dịch chuyển là -${distanceUnits} (< 0), ta vẽ mũi tên hướng sang TRÁI dài ${distanceUnits} đơn vị.`
      : `Vì độ dịch chuyển bằng 0, robot đứng yên tại vị trí ${a}.`;

  const step4Detail =
    direction === 'STAY'
      ? `Robot đứng tại chỗ ở vạch ${a}.`
      : `Robot xuất phát từ ${a}, nhảy ${distanceUnits} đơn vị sang ${
          direction === 'RIGHT' ? 'phải' : 'trái'
        } và dừng tại ${result}.`;

  return {
    a,
    op,
    b,
    effectiveDelta,
    result,
    originalExpression,
    transformedExpression,
    fullEquationString,
    direction,
    distanceUnits,
    pedagogicalSteps: [
      {
        stepNumber: 1,
        title: `Đánh dấu vị trí bắt đầu tại ${a}`,
        detail: `Robot thám hiểm đứng tại vạch xuất phát a = ${a} trên trục số.`,
      },
      {
        stepNumber: 2,
        title:
          op === '-'
            ? `Chuyển phép trừ thành cộng với số đối: ${transformedExpression}`
            : `Xác định số hạng cộng thêm: ${bStr}`,
        detail: step2Detail,
      },
      {
        stepNumber: 3,
        title:
          direction === 'STAY'
            ? 'Độ dịch chuyển bằng 0 (Đứng yên)'
            : `Vẽ mũi tên sang ${direction === 'RIGHT' ? 'phải' : 'trái'} dài ${distanceUnits} đơn vị`,
        detail: step3Detail,
      },
      {
        stepNumber: 4,
        title: `Robot di chuyển từ ${a} đến ${result}`,
        detail: step4Detail,
      },
      {
        stepNumber: 5,
        title: `Kết quả: ${fullEquationString}`,
        detail: `Điểm kết thúc trên trục số là ${result}. Vậy ${fullEquationString}.`,
      },
    ],
  };
}

// ============================================================================
// 5. DETERMINISTIC BFS SOLVER FOR NUMBER LINE RESCUE (ACTIVITY 6)
// ============================================================================

/**
 * Finds the shortest sequence of cards (without reusing the same card instance)
 * that moves the robot from `start` to `target` in at most `maxMoves` steps.
 */
export function findOptimalRescueSolution(
  start: number,
  target: number,
  cards: M07RescueCard[],
  maxMoves: number
): M07RescueCard[] | null {
  const cleanStart = normalizeInteger(start);
  const cleanTarget = normalizeInteger(target);
  if (cleanStart === cleanTarget) return [];

  interface QueueNode {
    pos: number;
    usedIndices: number[];
  }

  const queue: QueueNode[] = [{ pos: cleanStart, usedIndices: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.usedIndices.length >= maxMoves) continue;

    for (let i = 0; i < cards.length; i++) {
      if (current.usedIndices.includes(i)) continue;
      const nextPos = normalizeInteger(current.pos + cards[i].effectiveDelta);
      const nextUsed = [...current.usedIndices, i];
      if (nextPos === cleanTarget) {
        return nextUsed.map((idx) => cards[idx]);
      }
      queue.push({ pos: nextPos, usedIndices: nextUsed });
    }
  }

  return null;
}

/**
 * Verifies any student-chosen sequence of rescue cards.
 * Accepts EVERY mathematically valid sequence that reaches `target` within `maxMoves`.
 */
export function verifyRescueSequence(
  start: number,
  target: number,
  chosenCards: M07RescueCard[],
  allAvailableCards: M07RescueCard[],
  maxMoves: number
): M07RescueVerification {
  let currentPos = normalizeInteger(start);
  const cleanTarget = normalizeInteger(target);
  const stepsApplied: M07RescueVerification['stepsApplied'] = [];

  for (const card of chosenCards) {
    const nextPos = normalizeInteger(currentPos + card.effectiveDelta);
    const calc = computeJumpOperation(currentPos, card.op, card.operand);
    stepsApplied.push({
      card,
      from: currentPos,
      to: nextPos,
      expression: calc.fullEquationString,
    });
    currentPos = nextPos;
  }

  const optimal = findOptimalRescueSolution(cleanStartOr(start), cleanTarget, allAvailableCards, maxMoves);
  const minPossibleSteps = optimal ? optimal.length : null;
  const reachedTarget = currentPos === cleanTarget && chosenCards.length > 0;
  const withinStepLimit = chosenCards.length <= maxMoves;
  const isOptimalStepCount =
    reachedTarget && (minPossibleSteps === null || chosenCards.length <= minPossibleSteps);

  return {
    start: normalizeInteger(start),
    target: cleanTarget,
    stepsApplied,
    finalPosition: currentPos,
    reachedTarget,
    withinStepLimit,
    isOptimalStepCount,
    minPossibleSteps,
  };
}

function cleanStartOr(n: number): number {
  return normalizeInteger(n);
}

// ============================================================================
// 6. TASK BANK: 48 STRUCTURED PEDAGOGICAL TASKS (8 PER ACTIVITY × 6 ACTIVITIES)
// ============================================================================

export const M07_ACTIVITY_METADATA: {
  id: M07ActivityId;
  number: 1 | 2 | 3 | 4 | 5 | 6;
  shortTitle: string;
  fullTitle: string;
  subtitle: string;
  badgeColor: string;
}[] = [
  {
    id: 'EXPLORE_NEGATIVE',
    number: 1,
    shortTitle: 'Khám phá số âm',
    fullTitle: 'Khám phá số âm trong thực tiễn',
    subtitle: 'Nhiệt kế °C, Thang máy (Tầng trệt 0) & Độ cao mực nước biển (0 m)',
    badgeColor: '#0E7490',
  },
  {
    id: 'PLACE_ON_LINE',
    number: 2,
    shortTitle: 'Đặt số trên trục số',
    fullTitle: 'Đặt số nguyên trên trục số',
    subtitle: 'Kéo thẻ số vào vạch chia 1, 2, 5 và tìm số bị che trên trục số',
    badgeColor: '#0D9488',
  },
  {
    id: 'COMPARE_INTEGERS',
    number: 3,
    shortTitle: 'So sánh số nguyên',
    fullTitle: 'So sánh và sắp thứ tự số nguyên',
    subtitle: 'Quan hệ trái – phải trên trục số, so sánh hai số nguyên âm',
    badgeColor: '#2563EB',
  },
  {
    id: 'OPPOSITE_DISTANCE',
    number: 4,
    shortTitle: 'Số đối và khoảng cách',
    fullTitle: 'Số đối và khoảng cách trên trục số',
    subtitle: 'Tâm đối xứng 0, khoảng cách đến 0 (|a|) và khoảng cách hai điểm (|a - b|)',
    badgeColor: '#D97706',
  },
  {
    id: 'JUMP_ADD_SUB',
    number: 5,
    shortTitle: 'Cộng, trừ số nguyên',
    fullTitle: 'Cộng, trừ bằng bước nhảy',
    subtitle: 'Robot thám hiểm di chuyển theo phép cộng a + b và phép trừ a - b = a + (-b)',
    badgeColor: '#15803D',
  },
  {
    id: 'RESCUE_MISSION',
    number: 6,
    shortTitle: 'Giải cứu trên trục số',
    fullTitle: 'Giải cứu trên trục số',
    subtitle: 'Lập chuỗi phép tính cộng/trừ đưa Robot đến rương kho báu và trạm cứu hộ',
    badgeColor: '#B45309',
  },
];

export const M07_TASK_BANK: M07TaskSpec[] = [
  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 1: KHÁM PHÁ SỐ ÂM (8 NHIỆM VỤ)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A1_01',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'EASY',
    titleVi: 'Nhiệt độ dưới 0°C tại đỉnh Mẫu Sơn',
    promptVi: 'Kéo thanh nhiệt kế 3D về mức "âm 5 độ C" (thấp hơn 0°C là 5 vạch) và nhập số nguyên biểu diễn nhiệt độ đó.',
    questionVi: 'Nhiệt độ "5 độ dưới 0°C" được viết bằng số nguyên nào (theo đơn vị °C)?',
    params: { context: 'THERMOMETER', targetValue: -5 },
    expectedAnswer: -5,
    acceptedAnswers: ['-5', '-5°C', '-5 C', -5],
    hints: [
      'Quan sát mốc 0°C trên nhiệt kế: phía trên 0°C là số nguyên dương, phía dưới 0°C là số nguyên âm.',
      'Kéo thanh trượt nhiệt kế xuống dưới vạch 0 đúng 5 độ.',
      'Số nguyên biểu diễn 5 độ dưới 0°C là -5.',
    ],
    explanationVi: 'Nhiệt độ thấp hơn 0°C được biểu diễn bằng số nguyên âm. Vì thấp hơn 0°C là 5 độ nên ta viết là -5 (°C).',
  },
  {
    id: 'M07_A1_02',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'EASY',
    titleVi: 'Vị trí tàu lặn dưới mực nước biển',
    promptVi: 'Chuyển sang bối cảnh "Mực nước biển (0 m)", đưa tàu thám hiểm xuống vị trí thấp hơn mực nước biển 3 m.',
    questionVi: 'Với quy ước mực nước biển là 0 m, vị trí thấp hơn mực nước biển 3 m được biểu diễn bằng số nguyên nào?',
    params: { context: 'SEA_LEVEL', targetValue: -3 },
    expectedAnswer: -3,
    acceptedAnswers: ['-3', '-3m', '-3 m', -3],
    hints: [
      'Mực nước biển được quy ước là mốc 0 m.',
      'Vị trí cao hơn mực nước biển mang dấu dương (+), vị trí thấp hơn (dưới sâu) mang dấu âm (-).',
      'Thấp hơn mực nước biển 3 m tương ứng với số nguyên -3.',
    ],
    explanationVi: 'Quy ước mực nước biển là 0 m. Vị trí thấp hơn mực nước biển 3 m có độ cao là -3 m.',
  },
  {
    id: 'M07_A1_03',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'EASY',
    titleVi: 'Thang máy xuống tầng hầm B2',
    promptVi: 'Trong bối cảnh Thang máy (Quy ước tầng trệt là 0), hãy đưa cabin xuống tầng hầm thứ 2 dưới tầng trệt.',
    questionVi: 'Với tầng trệt là 0, tầng hầm thứ 2 dưới mặt đất được biểu diễn bởi số nguyên nào?',
    params: { context: 'ELEVATOR', targetValue: -2 },
    expectedAnswer: -2,
    acceptedAnswers: ['-2', 'B2', -2],
    hints: [
      'Trên bảng điều khiển thang máy, tầng trệt được quy ước là số 0.',
      'Các tầng hầm nằm bên dưới tầng trệt 0 nên dùng số nguyên âm -1, -2, -3...',
      'Tầng hầm thứ 2 tương ứng với số nguyên -2.',
    ],
    explanationVi: 'Với quy ước tầng trệt là 0, các tầng trên mặt đất là +1, +2, +3... và tầng hầm thứ 2 dưới tầng trệt là -2.',
  },
  {
    id: 'M07_A1_04',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'MEDIUM',
    titleVi: 'So sánh hai mức nhiệt độ âm -2°C và -7°C',
    promptVi: 'Quan sát vạch -2°C và -7°C trên nhiệt kế 3D. Nhiệt độ nào cao hơn (ấm hơn)?',
    questionVi: 'Trong hai nhiệt độ -2°C và -7°C, nhiệt độ nào cao hơn? (Nhập số nguyên tương ứng)',
    params: { context: 'THERMOMETER', targetValue: -2, secondValue: -7 },
    expectedAnswer: -2,
    acceptedAnswers: ['-2', '-2°C', -2],
    choices: ['-2°C cao hơn -7°C', '-7°C cao hơn -2°C', 'Hai nhiệt độ bằng nhau'],
    hints: [
      'Trên cột nhiệt kế, vạch nào nằm cao hơn thì nhiệt độ đó lớn hơn (ấm hơn).',
      'Vạch -2°C chỉ thấp hơn 0°C có 2 vạch, còn -7°C thấp hơn 0°C tới 7 vạch.',
      'Vì -2 > -7 nên nhiệt độ -2°C cao hơn -7°C.',
    ],
    explanationVi: 'Trên nhiệt kế, vạch -2°C nằm phía trên vạch -7°C nên -2 > -7. Vậy -2°C ấm hơn (cao hơn) -7°C.',
  },
  {
    id: 'M07_A1_05',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'MEDIUM',
    titleVi: 'Từ tầng hầm -3 đi lên 5 tầng',
    promptVi: 'Cabin thang máy đang ở tầng hầm -3. Nếu đi lên 5 tầng (qua tầng trệt 0), cabin sẽ dừng ở tầng mấy?',
    questionVi: 'Từ tầng -3 đi lên 5 tầng (tầng trệt là 0), thang máy dừng ở tầng số mấy?',
    params: { context: 'ELEVATOR', targetValue: 2, secondValue: -3 },
    expectedAnswer: 2,
    acceptedAnswers: ['2', '+2', 2],
    hints: [
      'Từ tầng -3 đi lên 3 tầng sẽ tới đúng tầng trệt 0.',
      'Đi tiếp thêm 2 tầng nữa từ tầng 0 sẽ lên tầng mấy?',
      '(-3) + 5 = 2. Cabin dừng ở tầng 2.',
    ],
    explanationVi: 'Từ tầng hầm -3 đi lên 3 tầng thì đến tầng trệt 0, đi lên thêm 2 tầng nữa sẽ đến tầng 2. Ta có (-3) + 5 = 2.',
  },
  {
    id: 'M07_A1_06',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'MEDIUM',
    titleVi: 'Thợ lặn ở độ sâu 12 m dưới mực nước biển',
    promptVi: 'Đặt vị trí thợ lặn ở độ sâu 12 m dưới mực nước biển trên mô hình độ cao.',
    questionVi: 'Độ cao của thợ lặn đang ở dưới mực nước biển 12 m là bao nhiêu mét?',
    params: { context: 'SEA_LEVEL', targetValue: -12 },
    expectedAnswer: -12,
    acceptedAnswers: ['-12', '-12m', '-12 m', -12],
    hints: [
      'Mực nước biển ứng với 0 m.',
      '"Dưới mực nước biển" nghĩa là thấp hơn 0 m nên dùng dấu trừ (-).',
      'Đáp án là -12.',
    ],
    explanationVi: 'Độ sâu 12 m dưới mực nước biển được biểu diễn bằng số nguyên âm -12 (m).',
  },
  {
    id: 'M07_A1_07',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'HARD',
    titleVi: 'Nhiệt độ giảm từ 3°C xuống 8°C',
    promptVi: 'Buổi chiều nhiệt độ ở Sa Pa là 3°C. Đêm xuống nhiệt độ giảm đi 8°C. Hãy chỉnh nhiệt kế tới nhiệt độ ban đêm.',
    questionVi: 'Khi nhiệt độ giảm từ 3°C đi 8°C, nhiệt độ mới là bao nhiêu °C?',
    params: { context: 'THERMOMETER', targetValue: -5, secondValue: 3 },
    expectedAnswer: -5,
    acceptedAnswers: ['-5', '-5°C', -5],
    hints: [
      'Từ 3°C giảm xuống 3°C thì chạm mốc 0°C.',
      'Cần giảm tiếp 5°C nữa dưới mốc 0°C.',
      '3 - 8 = -5 (°C).',
    ],
    explanationVi: 'Giảm 8°C từ 3°C tức là đi xuống 8 vạch qua mốc 0°C: 3 - 8 = -5 (°C).',
  },
  {
    id: 'M07_A1_08',
    activityId: 'EXPLORE_NEGATIVE',
    activityNumber: 1,
    difficulty: 'HARD',
    titleVi: 'Chênh lệch độ cao giữa ngọn đồi +15 m và rãnh ngầm -10 m',
    promptVi: 'Quan sát ngọn hải đăng ở độ cao +15 m và rãnh san hô ở độ cao -10 m so với mực nước biển (0 m).',
    questionVi: 'Rãnh san hô (-10 m) nằm thấp hơn đỉnh ngọn hải đăng (+15 m) tất cả bao nhiêu mét?',
    params: { context: 'SEA_LEVEL', targetValue: -10, secondValue: 15 },
    expectedAnswer: 25,
    acceptedAnswers: ['25', '25m', '25 m', 25],
    hints: [
      'Từ đỉnh +15 m xuống tới mực nước biển 0 m là 15 m.',
      'Từ mực nước biển 0 m xuống tiếp tới -10 m là thêm 10 m nữa.',
      'Tổng khoảng cách chênh lệch là 15 + 10 = 25 (m).',
    ],
    explanationVi: 'Khoảng cách từ +15 m đến 0 m là 15 m, và từ 0 m đến -10 m là 10 m. Vậy chênh lệch độ cao là 15 - (-10) = 25 m.',
  },

  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 2: ĐẶT SỐ TRÊN TRỤC SỐ (8 NHIỆM VỤ)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A2_01',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'EASY',
    titleVi: 'Đặt điểm -3 và 2 trên trục số (Bước chia 1)',
    promptVi: 'Kéo thẻ số -3 và thẻ số 2 đặt vào đúng vạch chia trên trục số có bước chia 1.',
    questionVi: 'Điểm biểu diễn số -3 cách điểm gốc 0 bao nhiêu đơn vị về bên trái?',
    params: { numberCards: [-3, 2], tickStep: 1, minRange: -6, maxRange: 6 },
    expectedAnswer: -3,
    acceptedAnswers: ['-3', '3', -3, 3],
    hints: [
      'Số nguyên âm nằm ở phía bên trái điểm gốc 0.',
      'Đếm từ 0 sang trái 3 vạch đơn vị: -1, -2, -3.',
      'Đặt thẻ -3 vào vạch thứ 3 bên trái số 0 và thẻ 2 vào vạch thứ 2 bên phải số 0.',
    ],
    explanationVi: 'Trên trục số nằm ngang, điểm -3 nằm bên trái điểm 0 và cách 0 đúng 3 đơn vị; điểm 2 nằm bên phải điểm 0 và cách 0 đúng 2 đơn vị.',
  },
  {
    id: 'M07_A2_02',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'EASY',
    titleVi: 'Biểu diễn các số -6, -1, 4 trên trục số',
    promptVi: 'Đặt tất cả các thẻ số [-6, -1, 4] vào đúng vị trí trên trục số từ -8 đến 8.',
    questionVi: 'Trong ba điểm -6, -1 và 4, điểm nào nằm gần gốc 0 nhất?',
    params: { numberCards: [-6, -1, 4], tickStep: 1, minRange: -8, maxRange: 8 },
    expectedAnswer: -1,
    acceptedAnswers: ['-1', -1],
    hints: [
      'Điểm -1 chỉ cách gốc 0 đúng 1 đơn vị về bên trái.',
      'Điểm 4 cách 0 là 4 đơn vị, còn điểm -6 cách 0 là 6 đơn vị.',
      'Vậy điểm -1 nằm gần gốc 0 nhất.',
    ],
    explanationVi: 'Khoảng cách từ -1 đến 0 là |-1| = 1 đơn vị, nhỏ hơn |4| = 4 và |-6| = 6 nên -1 gần gốc 0 nhất.',
  },
  {
    id: 'M07_A2_03',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'MEDIUM',
    titleVi: 'Trục số với bước chia 2: Đặt -8, -4, 6',
    promptVi: 'Với bước chia vạch chính là 2 đơn vị, hãy đặt các thẻ [-8, -4, 6] lên trục số.',
    questionVi: 'Khi mỗi khoảng vạch chính bằng 2 đơn vị, điểm -8 nằm cách gốc 0 mấy khoảng vạch chính về bên trái?',
    params: { numberCards: [-8, -4, 6], tickStep: 2, minRange: -10, maxRange: 10 },
    expectedAnswer: 4,
    acceptedAnswers: ['4', '-8', 4, -8],
    hints: [
      'Mỗi khoảng vạch chính ứng với 2 đơn vị: -2, -4, -6, -8.',
      'Ta có 8 : 2 = 4 khoảng vạch chính về phía bên trái số 0.',
      'Đặt các thẻ -8, -4, 6 đúng vạch và nhập 4.',
    ],
    explanationVi: 'Với bước chia 2, các vạch chính bên trái 0 lần lượt là -2, -4, -6, -8. Vậy -8 nằm ở vạch chính thứ 4 bên trái số 0.',
  },
  {
    id: 'M07_A2_04',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'MEDIUM',
    titleVi: 'Đặt số lẻ -3 và 5 khi nhãn chính cách nhau 2 đơn vị',
    promptVi: 'Trục số chỉ ghi nhãn chẵn (... -4, -2, 0, 2, 4 ...). Hãy đặt chính xác điểm -3 (nằm chính giữa -4 và -2) và điểm 5 (chính giữa 4 và 6).',
    questionVi: 'Trên trục số ghi nhãn cách 2 đơn vị, số nguyên nằm chính giữa -4 và -2 là số nào?',
    params: { numberCards: [-3, 5], tickStep: 2, minRange: -8, maxRange: 8, hideIntermediateLabels: true },
    expectedAnswer: -3,
    acceptedAnswers: ['-3', -3],
    hints: [
      'Giữa -4 và -2 có đúng một vạch chia đơn vị nguyên.',
      'Đi từ -2 sang trái 1 đơn vị là -3; đi từ -3 sang trái 1 đơn vị là -4.',
      'Vậy số nằm chính giữa -4 và -2 là -3.',
    ],
    explanationVi: 'Dù trục số chỉ hiển thị nhãn cách nhau 2 đơn vị, điểm chính giữa -4 và -2 vẫn biểu diễn chính xác số nguyên -3.',
  },
  {
    id: 'M07_A2_05',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'MEDIUM',
    titleVi: 'Trục số với bước chia 5: Đặt -15, -5, 10',
    promptVi: 'Chọn trục số có bước chia 5 trong miền [-20; 20] và đặt các thẻ số [-15, -5, 10].',
    questionVi: 'Nếu đi từ điểm 0 sang trái 3 vạch chia (mỗi vạch 5 đơn vị), ta gặp số nguyên nào?',
    params: { numberCards: [-15, -5, 10], tickStep: 5, minRange: -20, maxRange: 20 },
    expectedAnswer: -15,
    acceptedAnswers: ['-15', -15],
    hints: [
      'Mỗi vạch chính có giá trị 5 đơn vị.',
      'Sang trái 1 vạch là -5, sang trái 2 vạch là -10, sang trái 3 vạch là -15.',
      'Nhập -15.',
    ],
    explanationVi: 'Với bước chia 5 đơn vị, 3 vạch về bên trái số 0 biểu diễn số -(3 × 5) = -15.',
  },
  {
    id: 'M07_A2_06',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'MEDIUM',
    titleVi: 'Tìm số bị che trên trục số (Ẩn nhãn trung gian)',
    promptVi: 'Các nhãn số trên trục đã bị ẩn bớt, chỉ còn mốc 0 và bước chia 1. Hãy đặt thẻ -5 và 3 vào đúng vị trí.',
    questionVi: 'Điểm nằm cách gốc 0 đúng 5 đơn vị về phía bên trái biểu diễn số nguyên nào?',
    params: { numberCards: [-5, 3], tickStep: 1, minRange: -7, maxRange: 7, hideIntermediateLabels: true },
    expectedAnswer: -5,
    acceptedAnswers: ['-5', -5],
    hints: [
      'Xác định vị trí mốc gốc 0 ở chính giữa trục số.',
      'Đếm 5 vạch đơn vị từ 0 về phía bên trái.',
      'Đó là điểm biểu diễn số -5.',
    ],
    explanationVi: 'Khi ẩn nhãn số, ta luôn lấy gốc 0 làm chuẩn: đếm 5 đơn vị sang trái được -5, đếm 3 đơn vị sang phải được 3.',
  },
  {
    id: 'M07_A2_07',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'HARD',
    titleVi: 'Điểm cách đều hai điểm -7 và 1',
    promptVi: 'Đặt thẻ -7, thẻ 1 và thẻ trung điểm nằm chính giữa -7 và 1 (-3) lên trục số.',
    questionVi: 'Số nguyên nằm chính giữa (cách đều) hai điểm -7 và 1 trên trục số là số nào?',
    params: { numberCards: [-7, -3, 1], tickStep: 1, minRange: -9, maxRange: 5 },
    expectedAnswer: -3,
    acceptedAnswers: ['-3', -3],
    hints: [
      'Từ -7 đến 1 có khoảng cách là 8 đơn vị.',
      'Điểm chính giữa sẽ cách cả -7 và 1 một khoảng bằng 8 : 2 = 4 đơn vị.',
      'Từ 1 lùi sang trái 4 đơn vị (hoặc từ -7 tiến sang phải 4 đơn vị) ta gặp số -3.',
    ],
    explanationVi: 'Khoảng cách giữa -7 và 1 là 8 đơn vị. Điểm cách đều hai đầu cách mỗi điểm 4 đơn vị, chính là điểm -3.',
  },
  {
    id: 'M07_A2_08',
    activityId: 'PLACE_ON_LINE',
    activityNumber: 2,
    difficulty: 'HARD',
    titleVi: 'Biểu diễn bộ bốn số đối xứng [-9, -2, 2, 9]',
    promptVi: 'Đặt cả 4 thẻ số [-9, -2, 2, 9] lên trục số từ -10 đến 10.',
    questionVi: 'Tổng của bốn số nguyên -9, -2, 2 và 9 bằng bao nhiêu?',
    params: { numberCards: [-9, -2, 2, 9], tickStep: 1, minRange: -10, maxRange: 10 },
    expectedAnswer: 0,
    acceptedAnswers: ['0', 0],
    hints: [
      '-9 và 9 là hai số đối nhau nên (-9) + 9 = 0.',
      '-2 và 2 cũng là hai số đối nhau nên (-2) + 2 = 0.',
      'Vậy tổng của bốn số bằng 0.',
    ],
    explanationVi: 'Các cặp điểm (-9; 9) và (-2; 2) đối xứng nhau qua gốc 0 nên tổng của chúng bằng ((-9) + 9) + ((-2) + 2) = 0.',
  },

  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 3: SO SÁNH SỐ NGUYÊN (8 NHIỆM VỤ)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A3_01',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'EASY',
    titleVi: 'So sánh hai số nguyên âm: -4 và -1',
    promptVi: 'Quan sát hai điểm A(-4) và B(-1) trên trục số và chọn dấu thích hợp (<, > hoặc =).',
    questionVi: 'Điền dấu thích hợp vào ô trống: -4  [ ? ]  -1',
    params: { compareA: -4, compareB: -1 },
    expectedAnswer: '<',
    acceptedAnswers: ['<', '-4 < -1'],
    choices: ['<', '>', '='],
    hints: [
      'Quan sát trên trục số: điểm -4 nằm ở bên trái hay bên phải điểm -1?',
      'Điểm -4 nằm bên trái điểm -1.',
      'Trên trục số nằm ngang, số ở bên trái luôn nhỏ hơn số ở bên phải, nên -4 < -1.',
    ],
    explanationVi: 'Trên trục số, điểm -4 nằm bên trái điểm -1 (hoặc vì |-4| = 4 > |-1| = 1 đối với hai số nguyên âm) nên -4 < -1.',
  },
  {
    id: 'M07_A3_02',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'EASY',
    titleVi: 'So sánh hai số nguyên âm: -2 và -7',
    promptVi: 'Đặt điểm A tại -2 và điểm B tại -7 trên trục số, sau đó chọn dấu so sánh đúng.',
    questionVi: 'Điền dấu thích hợp vào ô trống: -2  [ ? ]  -7',
    params: { compareA: -2, compareB: -7 },
    expectedAnswer: '>',
    acceptedAnswers: ['>', '-2 > -7'],
    choices: ['<', '>', '='],
    hints: [
      'Điểm -2 nằm gần gốc 0 hơn và nằm ở bên phải điểm -7.',
      'Trong hai số nguyên âm, số nào có khoảng cách đến 0 nhỏ hơn thì lớn hơn.',
      'Vậy -2 > -7.',
    ],
    explanationVi: 'Điểm -2 nằm bên phải điểm -7 trên trục số nên -2 > -7.',
  },
  {
    id: 'M07_A3_03',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'EASY',
    titleVi: 'So sánh số 0 và số nguyên âm -3',
    promptVi: 'Quan sát vị trí của gốc 0 và điểm -3 trên trục số.',
    questionVi: 'Điền dấu thích hợp vào ô trống: 0  [ ? ]  -3',
    params: { compareA: 0, compareB: -3 },
    expectedAnswer: '>',
    acceptedAnswers: ['>', '0 > -3'],
    choices: ['<', '>', '='],
    hints: [
      'Mọi số nguyên âm đều nằm ở phía bên trái số 0.',
      'Do đó số 0 luôn nằm bên phải mọi số nguyên âm.',
      'Vậy 0 > -3.',
    ],
    explanationVi: 'Mọi số nguyên âm đều nhỏ hơn 0 (số 0 nằm bên phải điểm -3 trên trục số), nên 0 > -3.',
  },
  {
    id: 'M07_A3_04',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'EASY',
    titleVi: 'So sánh hai số nguyên bằng nhau: -5 và -5',
    promptVi: 'Khi cả hai điểm A và B đều đặt tại vạch -5 trên trục số.',
    questionVi: 'Điền dấu thích hợp vào ô trống: -5  [ ? ]  -5',
    params: { compareA: -5, compareB: -5 },
    expectedAnswer: '=',
    acceptedAnswers: ['=', '-5 = -5'],
    choices: ['<', '>', '='],
    hints: [
      'Hai điểm A và B trùng khít lên nhau tại vạch -5.',
      'Hai số cùng biểu diễn một điểm trên trục số thì bằng nhau.',
      'Vậy -5 = -5.',
    ],
    explanationVi: 'Hai điểm cùng nằm tại vạch -5 trên trục số nên -5 = -5.',
  },
  {
    id: 'M07_A3_05',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'MEDIUM',
    titleVi: 'So sánh số nguyên âm -8 và số nguyên dương 1',
    promptVi: 'So sánh điểm A(-8) và điểm B(1) trên trục số (cẩn thận không nhầm với độ dài 8 và 1!).',
    questionVi: 'Điền dấu thích hợp vào ô trống: -8  [ ? ]  1',
    params: { compareA: -8, compareB: 1 },
    expectedAnswer: '<',
    acceptedAnswers: ['<', '-8 < 1'],
    choices: ['<', '>', '='],
    hints: [
      '-8 là số nguyên âm (bên trái số 0), còn 1 là số nguyên dương (bên phải số 0).',
      'Mọi số nguyên âm đều nhỏ hơn mọi số nguyên dương.',
      'Vậy -8 < 1.',
    ],
    explanationVi: 'Dù |-8| = 8 > 1 nhưng -8 là số nguyên âm nằm bên trái số 0, còn 1 là số nguyên dương nằm bên phải số 0, nên -8 < 1.',
  },
  {
    id: 'M07_A3_06',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'MEDIUM',
    titleVi: 'Sắp xếp 4 thẻ số theo thứ tự tăng dần',
    promptVi: 'Quan sát các số [-5, 3, -1, 0] trên trục số và tìm số nhỏ nhất (nằm ngoài cùng bên trái).',
    questionVi: 'Trong các số -5, 3, -1, 0, số nguyên nào nhỏ nhất?',
    params: { compareA: -5, compareB: -1, numberCards: [-5, 3, -1, 0], sortMode: 'MIN' },
    expectedAnswer: -5,
    acceptedAnswers: ['-5', -5, '-5, -1, 0, 3'],
    hints: [
      'Thứ tự từ trái sang phải trên trục số chính là thứ tự tăng dần (từ nhỏ đến lớn).',
      'Các số âm là -5 và -1; trong đó -5 nằm xa 0 hơn về bên trái so với -1.',
      'Thứ tự tăng dần là: -5 < -1 < 0 < 3. Số nhỏ nhất là -5.',
    ],
    explanationVi: 'Khi biểu diễn trên trục số từ trái sang phải, ta có: -5, -1, 0, 3. Vậy số nhỏ nhất là -5.',
  },
  {
    id: 'M07_A3_07',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'HARD',
    titleVi: 'Tìm số nguyên lớn nhất trong tập số nguyên âm',
    promptVi: 'Xét 5 thẻ số nguyên âm [-9, -2, -6, -1, -4]. Hãy xác định số lớn nhất trong 5 số này.',
    questionVi: 'Trong các số nguyên âm -9, -2, -6, -1, -4, số nào lớn nhất?',
    params: { compareA: -1, compareB: -9, numberCards: [-9, -2, -6, -1, -4], sortMode: 'MAX' },
    expectedAnswer: -1,
    acceptedAnswers: ['-1', -1],
    hints: [
      'Số lớn nhất trên trục số là số nằm ở ngoài cùng bên phải.',
      'Trong các số nguyên âm, số nằm gần 0 nhất (bên phải nhất) là -1.',
      'Lưu ý: -1 là số nguyên âm lớn nhất!',
    ],
    explanationVi: 'Trên trục số, thứ tự từ trái sang phải là -9 < -6 < -4 < -2 < -1. Vậy -1 là số lớn nhất trong nhóm (và cũng là số nguyên âm lớn nhất).',
  },
  {
    id: 'M07_A3_08',
    activityId: 'COMPARE_INTEGERS',
    activityNumber: 3,
    difficulty: 'HARD',
    titleVi: 'Số nguyên âm lớn nhất và số nguyên dương nhỏ nhất',
    promptVi: 'Đặt điểm A tại số nguyên âm lớn nhất (-1) và điểm B tại số nguyên dương nhỏ nhất (1).',
    questionVi: 'Số nguyên âm lớn nhất là số nào?',
    params: { compareA: -1, compareB: 1 },
    expectedAnswer: -1,
    acceptedAnswers: ['-1', -1],
    hints: [
      'Các số nguyên âm là -1, -2, -3, -4...',
      'Điểm nằm sát ngay bên trái số 0 nhất là -1.',
      'Vậy số nguyên âm lớn nhất là -1.',
    ],
    explanationVi: 'Tập hợp số nguyên âm gồm {-1; -2; -3; ...}, trong đó -1 nằm bên phải mọi số nguyên âm khác nên -1 là số nguyên âm lớn nhất.',
  },

  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 4: SỐ ĐỐI VÀ KHOẢNG CÁCH (8 NHIỆM VỤ)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A4_01',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'EASY',
    titleVi: 'Tìm số đối của -4 qua tâm đối xứng 0',
    promptVi: 'Kéo điểm A đến vạch -4 và quan sát điểm đối xứng A′ qua tâm 0.',
    questionVi: 'Số đối của -4 là số nào?',
    params: { oppositeSubMode: 'TO_ZERO', pointA: -4 },
    expectedAnswer: 4,
    acceptedAnswers: ['4', '+4', 4],
    hints: [
      'Hai số đối nhau nằm ở hai phía của điểm 0 và cách đều điểm 0.',
      'Điểm -4 cách 0 là 4 đơn vị về bên trái.',
      'Điểm cách 0 là 4 đơn vị về bên phải là 4. Vậy số đối của -4 là 4.',
    ],
    explanationVi: 'Hai điểm -4 và 4 nằm về hai phía của điểm 0 và cùng cách 0 một khoảng bằng 4 đơn vị, nên số đối của -4 là 4.',
  },
  {
    id: 'M07_A4_02',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'EASY',
    titleVi: 'Số đối đặc biệt của số 0',
    promptVi: 'Đặt điểm A ngay tại gốc đối xứng 0 trên trục số.',
    questionVi: 'Số đối của số 0 là số nào?',
    params: { oppositeSubMode: 'TO_ZERO', pointA: 0 },
    expectedAnswer: 0,
    acceptedAnswers: ['0', 0],
    hints: [
      'Điểm 0 cách chính nó 0 đơn vị.',
      'Theo quy ước toán học chuẩn SGK Toán 6, số đối của 0 chính là 0 (không viết -0).',
      'Nhập 0.',
    ],
    explanationVi: 'Số đối của 0 là 0 (số 0 là số nguyên duy nhất bằng số đối của chính nó).',
  },
  {
    id: 'M07_A4_03',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'EASY',
    titleVi: 'Khoảng cách từ điểm -6 đến gốc 0 (|-6|)',
    promptVi: 'Kéo điểm A đến vạch -6 và quan sát đoạn thẳng từ -6 đến 0.',
    questionVi: 'Khoảng cách từ điểm -6 đến điểm 0 trên trục số (ký hiệu |-6|) bằng bao nhiêu đơn vị?',
    params: { oppositeSubMode: 'TO_ZERO', pointA: -6 },
    expectedAnswer: 6,
    acceptedAnswers: ['6', '+6', 6],
    hints: [
      'Khoảng cách trên trục số là số đơn vị độ dài nên luôn là một số không âm (≥ 0).',
      'Từ vạch -6 đến vạch 0 có đúng 6 khoảng đơn vị.',
      'Vậy |-6| = 6.',
    ],
    explanationVi: 'Khoảng cách từ điểm -6 đến điểm 0 trên trục số là 6 đơn vị, ký hiệu giá trị tuyệt đối là |-6| = 6.',
  },
  {
    id: 'M07_A4_04',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'MEDIUM',
    titleVi: 'Khoảng cách giữa hai điểm -3 và 2',
    promptVi: 'Chuyển sang chế độ "Khoảng cách giữa hai điểm", đặt điểm A tại -3 và điểm B tại 2.',
    questionVi: 'Khoảng cách giữa hai điểm -3 và 2 trên trục số bằng bao nhiêu đơn vị?',
    params: { oppositeSubMode: 'BETWEEN_TWO', pointA: -3, pointB: 2 },
    expectedAnswer: 5,
    acceptedAnswers: ['5', 5],
    hints: [
      'Từ điểm -3 đến gốc 0 có độ dài là 3 đơn vị.',
      'Từ gốc 0 đến điểm 2 có độ dài là 2 đơn vị.',
      'Tổng khoảng cách giữa -3 và 2 là 3 + 2 = 5 đơn vị (|-3 - 2| = |-5| = 5).',
    ],
    explanationVi: 'Khoảng cách giữa hai điểm -3 và 2 trên trục số là |-3 - 2| = 3 + 2 = 5 đơn vị.',
  },
  {
    id: 'M07_A4_05',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'MEDIUM',
    titleVi: 'Số đối của một số nguyên dương 7',
    promptVi: 'Đặt điểm A tại vạch 7 trên trục số và tìm điểm đối xứng A′ qua tâm 0.',
    questionVi: 'Số đối của 7 là số nguyên nào?',
    params: { oppositeSubMode: 'TO_ZERO', pointA: 7 },
    expectedAnswer: -7,
    acceptedAnswers: ['-7', -7],
    hints: [
      'Điểm 7 nằm bên phải gốc 0 đúng 7 đơn vị.',
      'Điểm đối xứng qua 0 sẽ nằm bên trái gốc 0 đúng 7 đơn vị.',
      'Đó là số -7.',
    ],
    explanationVi: 'Số đối của số nguyên dương 7 là số nguyên âm -7. Tổng của hai số đối nhau luôn bằng 0: 7 + (-7) = 0.',
  },
  {
    id: 'M07_A4_06',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'MEDIUM',
    titleVi: 'Khoảng cách giữa hai điểm cùng âm: -8 và -2',
    promptVi: 'Trong chế độ "Khoảng cách hai điểm", đặt điểm A tại -8 và điểm B tại -2.',
    questionVi: 'Khoảng cách giữa hai điểm -8 và -2 trên trục số bằng bao nhiêu đơn vị?',
    params: { oppositeSubMode: 'BETWEEN_TWO', pointA: -8, pointB: -2 },
    expectedAnswer: 6,
    acceptedAnswers: ['6', 6],
    hints: [
      'Cả hai điểm -8 và -2 đều nằm bên trái số 0.',
      'Đếm số vạch đơn vị từ -8 đến -2: (-2) - (-8) = 6.',
      'Khoảng cách là 6 đơn vị.',
    ],
    explanationVi: 'Khoảng cách giữa hai điểm -8 và -2 là |(-8) - (-2)| = |-6| = 6 đơn vị.',
  },
  {
    id: 'M07_A4_07',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'HARD',
    titleVi: 'Khoảng cách giữa một số và số đối của nó (-5 và 5)',
    promptVi: 'Quan sát điểm A tại -5 và điểm đối xứng A′ tại 5 trên trục số.',
    questionVi: 'Khoảng cách giữa điểm -5 và số đối của nó (điểm 5) trên trục số là bao nhiêu đơn vị?',
    params: { oppositeSubMode: 'BETWEEN_TWO', pointA: -5, pointB: 5 },
    expectedAnswer: 10,
    acceptedAnswers: ['10', 10],
    hints: [
      'Mỗi điểm -5 và 5 đều cách gốc 0 một khoảng bằng 5 đơn vị.',
      'Do nằm ở hai phía đối diện qua gốc 0 nên khoảng cách giữa chúng gấp đôi khoảng cách đến 0.',
      '5 + 5 = 10 đơn vị.',
    ],
    explanationVi: 'Khoảng cách từ -5 đến 0 là 5 và từ 0 đến 5 là 5, nên khoảng cách giữa -5 và 5 là |5 - (-5)| = 10 đơn vị.',
  },
  {
    id: 'M07_A4_08',
    activityId: 'OPPOSITE_DISTANCE',
    activityNumber: 4,
    difficulty: 'HARD',
    titleVi: 'Tìm các số nguyên cách gốc 0 một khoảng bằng 4 đơn vị',
    promptVi: 'Quan sát cả hai phía trái và phải của gốc 0 ở khoảng cách 4 đơn vị.',
    questionVi: 'Có bao nhiêu số nguyên có khoảng cách đến gốc 0 bằng 4 đơn vị (tức |x| = 4)?',
    params: { oppositeSubMode: 'TO_ZERO', pointA: -4 },
    expectedAnswer: 2,
    acceptedAnswers: ['2', '2 số', '4 và -4', '-4 và 4', 2],
    hints: [
      'Về phía bên phải số 0 có điểm 4 cách 0 đúng 4 đơn vị.',
      'Về phía bên trái số 0 có điểm -4 cũng cách 0 đúng 4 đơn vị.',
      'Vậy có 2 số nguyên thỏa mãn là -4 và 4.',
    ],
    explanationVi: 'Trên trục số có đúng 2 điểm cách gốc 0 một khoảng bằng 4 đơn vị là 4 và -4. Do đó |x| = 4 có 2 giá trị nguyên là x = 4 hoặc x = -4.',
  },

  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 5: CỘNG, TRỪ BẰNG BƯỚC NHẢY (8 NHIỆM VỤ CHUẨN MỤC 4.5 & MỤC 9)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A5_01',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'MEDIUM',
    titleVi: 'Kịch bản trọng tâm: (-3) - (-5) = (-3) + 5 = 2',
    promptVi: 'Bấm "Từng bước" hoặc "Chạy" để quan sát Robot tại -3 thực hiện phép trừ (-3) - (-5) bằng cách cộng với số đối +5.',
    questionVi: 'Kết quả của phép tính (-3) - (-5) bằng bao nhiêu?',
    params: { jumpA: -3, jumpOp: '-', jumpB: -5 },
    expectedAnswer: 2,
    acceptedAnswers: ['2', '+2', 2],
    hints: [
      'Bước 1: Robot xuất phát tại vị trí a = -3.',
      'Bước 2: Trừ đi (-5) chính là cộng với số đối của (-5) là +5: (-3) - (-5) = (-3) + 5.',
      'Bước 3 & 4: Từ -3 di chuyển 5 đơn vị sang phải sẽ đến điểm 2.',
    ],
    explanationVi: 'Ta có (-3) - (-5) = (-3) + 5 = 2. Từ điểm -3, vì cộng 5 (> 0) nên Robot di chuyển 5 đơn vị sang phải và dừng tại 2.',
  },
  {
    id: 'M07_A5_02',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'EASY',
    titleVi: 'Cộng số nguyên âm với số nguyên dương: (-3) + 5',
    promptVi: 'Thiết lập a = -3, phép Cộng (+), b = 5 và quan sát mũi tên nhảy sang phải 5 đơn vị.',
    questionVi: 'Tính kết quả phép cộng: (-3) + 5 = ?',
    params: { jumpA: -3, jumpOp: '+', jumpB: 5 },
    expectedAnswer: 2,
    acceptedAnswers: ['2', '+2', 2],
    hints: [
      'Bắt đầu tại vạch -3 trên trục số.',
      'Vì cộng với 5 (b > 0), Robot di chuyển sang phải 5 đơn vị.',
      'Đi qua 0 tới vạch 2. Kết quả bằng 2.',
    ],
    explanationVi: 'Xuất phát tại -3, cộng 5 là di chuyển sang phải 5 đơn vị trên trục số, dừng tại 2: (-3) + 5 = 2.',
  },
  {
    id: 'M07_A5_03',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'EASY',
    titleVi: 'Cộng với số nguyên âm: 4 + (-7)',
    promptVi: 'Thiết lập a = 4, phép Cộng (+), b = -7 và quan sát Robot nhảy sang trái 7 đơn vị.',
    questionVi: 'Tính kết quả phép cộng: 4 + (-7) = ?',
    params: { jumpA: 4, jumpOp: '+', jumpB: -7 },
    expectedAnswer: -3,
    acceptedAnswers: ['-3', -3],
    hints: [
      'Robot bắt đầu tại vị trí dương 4.',
      'Khi cộng với một số nguyên âm (-7), Robot phải di chuyển sang TRÁI | -7 | = 7 đơn vị.',
      'Từ 4 lùi sang trái 4 đơn vị về 0, lùi tiếp 3 đơn vị nữa tới -3.',
    ],
    explanationVi: 'Với phép cộng a + b khi b < 0, ta di chuyển sang trái |b| đơn vị: từ 4 đi sang trái 7 đơn vị đến -3. Vậy 4 + (-7) = -3.',
  },
  {
    id: 'M07_A5_04',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'MEDIUM',
    titleVi: 'Trừ số nguyên dương từ số nguyên âm: (-4) - 3',
    promptVi: 'Thiết lập a = -4, phép Trừ (-), b = 3. Quan sát (-4) - 3 = (-4) + (-3).',
    questionVi: 'Tính kết quả phép trừ: (-4) - 3 = ?',
    params: { jumpA: -4, jumpOp: '-', jumpB: 3 },
    expectedAnswer: -7,
    acceptedAnswers: ['-7', -7],
    hints: [
      'Chuyển phép trừ thành phép cộng với số đối: (-4) - 3 = (-4) + (-3).',
      'Từ vị trí -4, Robot di chuyển tiếp sang trái 3 đơn vị.',
      'Điểm dừng cuối cùng là -7.',
    ],
    explanationVi: 'Ta có (-4) - 3 = (-4) + (-3) = -7. Từ -4 di chuyển sang trái 3 đơn vị ta đến vạch -7.',
  },
  {
    id: 'M07_A5_05',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'EASY',
    titleVi: 'Phép trừ với số 0: 5 - 0',
    promptVi: 'Thiết lập a = 5, phép Trừ (-), b = 0 và quan sát Robot đứng yên tại 5.',
    questionVi: 'Tính kết quả phép trừ: 5 - 0 = ?',
    params: { jumpA: 5, jumpOp: '-', jumpB: 0 },
    expectedAnswer: 5,
    acceptedAnswers: ['5', '+5', 5],
    hints: [
      'Số đối của 0 là 0 nên 5 - 0 = 5 + 0.',
      'Khi độ dịch chuyển bằng 0, Robot đứng yên tại vị trí xuất phát.',
      'Kết quả là 5.',
    ],
    explanationVi: 'Mọi số nguyên cộng hoặc trừ 0 đều bằng chính nó: 5 - 0 = 5 (Robot đứng yên tại vạch 5).',
  },
  {
    id: 'M07_A5_06',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'MEDIUM',
    titleVi: 'Số 0 trừ đi một số nguyên âm: 0 - (-4)',
    promptVi: 'Thiết lập a = 0, phép Trừ (-), b = -4. Quan sát 0 - (-4) = 0 + 4.',
    questionVi: 'Tính kết quả phép trừ: 0 - (-4) = ?',
    params: { jumpA: 0, jumpOp: '-', jumpB: -4 },
    expectedAnswer: 4,
    acceptedAnswers: ['4', '+4', 4],
    hints: [
      'Số đối của -4 là +4.',
      'Do đó 0 - (-4) = 0 + 4.',
      'Từ gốc 0, Robot di chuyển sang phải 4 đơn vị đến vạch 4.',
    ],
    explanationVi: 'Ta có 0 - (-4) = 0 + 4 = 4. Từ gốc 0 di chuyển sang phải 4 đơn vị ta được 4.',
  },
  {
    id: 'M07_A5_07',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'MEDIUM',
    titleVi: 'Hai số nguyên âm bằng nhau trừ cho nhau: (-5) - (-5)',
    promptVi: 'Thiết lập a = -5, phép Trừ (-), b = -5. Quan sát (-5) - (-5) = (-5) + 5 = 0.',
    questionVi: 'Tính kết quả phép trừ: (-5) - (-5) = ?',
    params: { jumpA: -5, jumpOp: '-', jumpB: -5 },
    expectedAnswer: 0,
    acceptedAnswers: ['0', 0],
    hints: [
      'Chuyển phép trừ thành cộng với số đối: (-5) - (-5) = (-5) + 5.',
      'Hai số đối nhau có tổng bằng 0.',
      'Từ -5 đi sang phải 5 đơn vị sẽ về đúng gốc 0.',
    ],
    explanationVi: 'Ta có (-5) - (-5) = (-5) + 5 = 0. Mọi số nguyên trừ đi chính nó đều bằng 0.',
  },
  {
    id: 'M07_A5_08',
    activityId: 'JUMP_ADD_SUB',
    activityNumber: 5,
    difficulty: 'HARD',
    titleVi: 'Cộng hai số nguyên âm: (-4) + (-5)',
    promptVi: 'Thiết lập a = -4, phép Cộng (+), b = -5 và quan sát Robot nhảy sang trái 5 đơn vị.',
    questionVi: 'Tính kết quả phép cộng hai số nguyên âm: (-4) + (-5) = ?',
    params: { jumpA: -4, jumpOp: '+', jumpB: -5 },
    expectedAnswer: -9,
    acceptedAnswers: ['-9', -9],
    hints: [
      'Robot bắt đầu tại vạch -4 (đã ở bên trái gốc 0 là 4 đơn vị).',
      'Cộng thêm (-5) nghĩa là đi tiếp sang trái 5 đơn vị nữa.',
      'Tổng cộng cách gốc 0 là 4 + 5 = 9 đơn vị về bên trái, tức là -9.',
    ],
    explanationVi: 'Muốn cộng hai số nguyên âm, ta cộng hai giá trị tuyệt đối (4 + 5 = 9) rồi đặt dấu "-" trước kết quả: (-4) + (-5) = -9.',
  },

  // --------------------------------------------------------------------------
  // HOẠT ĐỘNG 6: GIẢI CỨU TRÊN TRỤC SỐ (8 NHIỆM VỤ — DỄ, VỪA, KHÓ)
  // --------------------------------------------------------------------------
  {
    id: 'M07_A6_01',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'EASY',
    titleVi: 'Mức Dễ 1: Đưa Robot từ -4 đến Rương kho báu tại 2 (1 bước)',
    promptVi: 'Robot đang ở -4, Rương kho báu ở 2. Hãy chọn đúng 1 thẻ phép tính để đưa Robot tới đích.',
    questionVi: 'Từ -4 cần cộng thêm bao nhiêu để đến đúng vị trí 2?',
    params: {
      rescueStart: -4,
      rescueTarget: 2,
      rescueMaxMoves: 1,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '+', operand: 6, effectiveDelta: 6, label: '+ 6' },
        { id: 'c2', op: '-', operand: 6, effectiveDelta: -6, label: '- 6' },
        { id: 'c3', op: '+', operand: 2, effectiveDelta: 2, label: '+ 2' },
        { id: 'c4', op: '+', operand: -2, effectiveDelta: -2, label: '+ (-2)' },
      ],
    },
    expectedAnswer: 6,
    acceptedAnswers: ['6', '+6', '+ 6', 6],
    hints: [
      'Từ -4 đến 0 là 4 đơn vị sang phải, từ 0 đến 2 là thêm 2 đơn vị sang phải.',
      'Tổng cộng cần tiến sang phải 4 + 2 = 6 đơn vị.',
      'Chọn thẻ "+ 6" vì (-4) + 6 = 2.',
    ],
    explanationVi: 'Khoảng cách dịch chuyển từ -4 đến 2 là 2 - (-4) = +6. Chọn thẻ "+ 6" đưa Robot đến đích sau 1 bước.',
  },
  {
    id: 'M07_A6_02',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'EASY',
    titleVi: 'Mức Dễ 2: Đưa Robot từ 3 về Trạm cứu hộ tại -5 (1 bước)',
    promptVi: 'Robot đang ở 3, Trạm cứu hộ ở -5. Hãy chọn 1 thẻ phép tính phù hợp.',
    questionVi: 'Từ vị trí 3, phép tính nào đưa Robot lùi 8 đơn vị sang trái về -5?',
    params: {
      rescueStart: 3,
      rescueTarget: -5,
      rescueMaxMoves: 1,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '+', operand: -8, effectiveDelta: -8, label: '+ (-8)' },
        { id: 'c2', op: '-', operand: -8, effectiveDelta: 8, label: '- (-8)' },
        { id: 'c3', op: '+', operand: -2, effectiveDelta: -2, label: '+ (-2)' },
        { id: 'c4', op: '+', operand: 8, effectiveDelta: 8, label: '+ 8' },
      ],
    },
    expectedAnswer: -8,
    acceptedAnswers: ['-8', '+ (-8)', '+(-8)', -8],
    hints: [
      'Từ 3 về 0 là 3 đơn vị sang trái, từ 0 về -5 là thêm 5 đơn vị sang trái.',
      'Tổng cộng cần dịch chuyển -8 đơn vị.',
      'Chọn thẻ "+ (-8)" vì 3 + (-8) = -5.',
    ],
    explanationVi: 'Ta có 3 + (-8) = -5. Lưu ý thẻ "- (-8)" lại bằng "+ 8" nên sẽ đưa Robot sang phải tới 11!',
  },
  {
    id: 'M07_A6_03',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'EASY',
    titleVi: 'Mức Dễ 3: Dùng phép trừ số âm từ -2 đến 5 (1 bước)',
    promptVi: 'Robot đang ở -2, đích ở 5. Trong các thẻ bên dưới, thẻ nào giúp Robot tiến sang phải 7 đơn vị?',
    questionVi: 'Từ -2, thực hiện phép trừ "(-2) - (-7)" sẽ đưa Robot đến vị trí nào?',
    params: {
      rescueStart: -2,
      rescueTarget: 5,
      rescueMaxMoves: 1,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '-', operand: -7, effectiveDelta: 7, label: '- (-7)' },
        { id: 'c2', op: '-', operand: 7, effectiveDelta: -7, label: '- 7' },
        { id: 'c3', op: '+', operand: -7, effectiveDelta: -7, label: '+ (-7)' },
        { id: 'c4', op: '+', operand: 3, effectiveDelta: 3, label: '+ 3' },
      ],
    },
    expectedAnswer: 5,
    acceptedAnswers: ['5', '+5', '- (-7)', 5],
    hints: [
      'Trừ đi (-7) chính là cộng với số đối của (-7) là +7.',
      'Ta có (-2) - (-7) = (-2) + 7 = 5.',
      'Chọn thẻ "- (-7)".',
    ],
    explanationVi: 'Vì (-2) - (-7) = (-2) + 7 = 5 nên thẻ "- (-7)" đưa Robot tiến sang phải 7 đơn vị tới đúng đích 5.',
  },
  {
    id: 'M07_A6_04',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'MEDIUM',
    titleVi: 'Mức Vừa 1: Hành trình 2 bước từ -12 đến 3 (Phạm vi -20..20)',
    promptVi: 'Robot xuất phát tại -12, Rương kho báu ở 3. Hãy chọn tối đa 2 thẻ phép tính để tổng độ dịch chuyển bằng +15.',
    questionVi: 'Từ -12 đến 3 cần tổng độ dịch chuyển bằng bao nhiêu đơn vị?',
    params: {
      rescueStart: -12,
      rescueTarget: 3,
      rescueMaxMoves: 2,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '+', operand: 10, effectiveDelta: 10, label: '+ 10' },
        { id: 'c2', op: '-', operand: -5, effectiveDelta: 5, label: '- (-5)' },
        { id: 'c3', op: '+', operand: 8, effectiveDelta: 8, label: '+ 8' },
        { id: 'c4', op: '-', operand: -7, effectiveDelta: 7, label: '- (-7)' },
        { id: 'c5', op: '+', operand: -5, effectiveDelta: -5, label: '+ (-5)' },
      ],
    },
    expectedAnswer: 15,
    acceptedAnswers: ['15', '+15', 15],
    hints: [
      'Khoảng cách từ -12 đến 3 là 3 - (-12) = +15 đơn vị.',
      'Em có thể ghép 2 thẻ có tổng độ dịch chuyển bằng +15, ví dụ: (+10) và (- (-5)) vì 10 + 5 = 15, hoặc (+8) và (- (-7)) vì 8 + 7 = 15!',
      'Hệ thống chấp nhận mọi cặp thẻ hợp lệ đưa Robot tới đúng vạch 3.',
    ],
    explanationVi: 'Từ -12 đến 3 cần dịch chuyển +15 đơn vị. Cả hai phương án [(+10) rồi -(-5)] hoặc [(+8) rồi -(-7)] đều hợp lệ và tối ưu (2 bước).',
  },
  {
    id: 'M07_A6_05',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'MEDIUM',
    titleVi: 'Mức Vừa 2: Hành trình 2 bước từ 14 về -6 (Phạm vi -20..20)',
    promptVi: 'Robot ở vạch 14, Trạm cứu hộ ở vạch -6. Hãy chọn 2 thẻ phép tính để đưa Robot về đích.',
    questionVi: 'Từ 14 về -6, Robot phải di chuyển sang trái tất cả bao nhiêu đơn vị?',
    params: {
      rescueStart: 14,
      rescueTarget: -6,
      rescueMaxMoves: 2,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '+', operand: -12, effectiveDelta: -12, label: '+ (-12)' },
        { id: 'c2', op: '-', operand: 8, effectiveDelta: -8, label: '- 8' },
        { id: 'c3', op: '-', operand: 10, effectiveDelta: -10, label: '- 10' },
        { id: 'c4', op: '+', operand: -10, effectiveDelta: -10, label: '+ (-10)' },
        { id: 'c5', op: '+', operand: 6, effectiveDelta: 6, label: '+ 6' },
      ],
    },
    expectedAnswer: 20,
    acceptedAnswers: ['20', '-20', 20, -20],
    hints: [
      'Từ 14 về 0 là 14 đơn vị sang trái, từ 0 về -6 là thêm 6 đơn vị sang trái (tổng 20 đơn vị).',
      'Em có thể chọn cặp thẻ [+ (-12) và - 8] hoặc [- 10 và + (-10)].',
      'Bấm Chạy thử để xem Robot về đúng vạch -6.',
    ],
    explanationVi: 'Độ dịch chuyển cần thiết là (-6) - 14 = -20 (lùi 20 đơn vị sang trái). Có thể chọn [+(-12) và -8] hoặc [-10 và +(-10)].',
  },
  {
    id: 'M07_A6_06',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'HARD',
    titleVi: 'Mức Khó 1: Lập chuỗi 3 phép tính từ -15 đến 4',
    promptVi: 'Robot đang ở -15, Rương kho báu ở 4. Hãy chọn tối đa 3 thẻ phép tính để đưa Robot tới đích.',
    questionVi: 'Tổng độ dịch chuyển từ -15 đến 4 bằng bao nhiêu đơn vị?',
    params: {
      rescueStart: -15,
      rescueTarget: 4,
      rescueMaxMoves: 3,
      rescueMode: 'CHOOSE_CARDS',
      rescueCards: [
        { id: 'c1', op: '+', operand: 9, effectiveDelta: 9, label: '+ 9' },
        { id: 'c2', op: '-', operand: -6, effectiveDelta: 6, label: '- (-6)' },
        { id: 'c3', op: '+', operand: 4, effectiveDelta: 4, label: '+ 4' },
        { id: 'c4', op: '+', operand: 12, effectiveDelta: 12, label: '+ 12' },
        { id: 'c5', op: '-', operand: -7, effectiveDelta: 7, label: '- (-7)' },
        { id: 'c6', op: '-', operand: 5, effectiveDelta: -5, label: '- 5' },
      ],
    },
    expectedAnswer: 19,
    acceptedAnswers: ['19', '+19', 19],
    hints: [
      'Cần tổng độ dịch chuyển là 4 - (-15) = +19.',
      'Cách 1 (2 bước): Chọn thẻ "+ 12" và "- (-7)" vì 12 + 7 = 19.',
      'Cách 2 (3 bước): Chọn thẻ "+ 9", "- (-6)" và "+ 4" vì 9 + 6 + 4 = 19.',
    ],
    explanationVi: 'Từ -15 đến 4 cần tiến sang phải 19 đơn vị. Cả chuỗi 2 bước [(+12), -(-7)] và chuỗi 3 bước [(+9), -(-6), (+4)] đều đưa Robot đến đích 4.',
  },
  {
    id: 'M07_A6_07',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'HARD',
    titleVi: 'Mức Khó 2: Tìm số nguyên x chưa biết trong phép cộng (-7) + x = 5',
    promptVi: 'Robot xuất phát tại -7 và sau một bước nhảy "+ x" đã tới đúng Rương kho báu tại 5.',
    questionVi: 'Tìm số nguyên x thỏa mãn: (-7) + x = 5',
    params: {
      rescueStart: -7,
      rescueTarget: 5,
      rescueMaxMoves: 1,
      rescueMode: 'FIND_MISSING',
      missingEquation: { start: -7, op: '+', target: 5, missingVal: 12 },
      rescueCards: [
        { id: 'c1', op: '+', operand: 12, effectiveDelta: 12, label: '+ 12' },
        { id: 'c2', op: '+', operand: -12, effectiveDelta: -12, label: '+ (-12)' },
        { id: 'c3', op: '+', operand: -2, effectiveDelta: -2, label: '+ (-2)' },
      ],
    },
    expectedAnswer: 12,
    acceptedAnswers: ['12', '+12', 12],
    hints: [
      'Từ -7 đến 0 cần tiến sang phải 7 đơn vị.',
      'Từ 0 đến 5 cần tiến tiếp sang phải 5 đơn vị nữa.',
      'Vậy x = 5 - (-7) = 5 + 7 = 12.',
    ],
    explanationVi: 'Muốn tìm số hạng chưa biết x trong (-7) + x = 5, ta lấy tổng trừ đi số hạng đã biết: x = 5 - (-7) = 5 + 7 = 12.',
  },
  {
    id: 'M07_A6_08',
    activityId: 'RESCUE_MISSION',
    activityNumber: 6,
    difficulty: 'HARD',
    titleVi: 'Mức Khó 3: Tìm số nguyên x chưa biết trong phép trừ (-3) - x = 4',
    promptVi: 'Robot xuất phát tại -3, thực hiện phép trừ "(-3) - x" và đến đích tại 4.',
    questionVi: 'Tìm số nguyên x thỏa mãn: (-3) - x = 4',
    params: {
      rescueStart: -3,
      rescueTarget: 4,
      rescueMaxMoves: 1,
      rescueMode: 'FIND_MISSING',
      missingEquation: { start: -3, op: '-', target: 4, missingVal: -7 },
      rescueCards: [
        { id: 'c1', op: '-', operand: -7, effectiveDelta: 7, label: '- (-7)' },
        { id: 'c2', op: '-', operand: 7, effectiveDelta: -7, label: '- 7' },
        { id: 'c3', op: '-', operand: 1, effectiveDelta: -1, label: '- 1' },
      ],
    },
    expectedAnswer: -7,
    acceptedAnswers: ['-7', '(-7)', -7],
    hints: [
      'Từ -3 đến 4, Robot đã tiến sang phải 7 đơn vị (+7).',
      'Để phép trừ (-3) - x biến thành (-3) + 7, thì số đối của x phải bằng 7.',
      'Vậy x = -7 (kiểm tra: (-3) - (-7) = (-3) + 7 = 4).',
    ],
    explanationVi: 'Từ (-3) - x = 4 suy ra x = (-3) - 4 = (-3) + (-4) = -7. Thử lại: (-3) - (-7) = (-3) + 7 = 4 (đúng).',
  },
];

export function getTasksByActivity(activityId: M07ActivityId): M07TaskSpec[] {
  return M07_TASK_BANK.filter((t) => t.activityId === activityId);
}

// ============================================================================
// 7. MANDATORY AUTOMATED VERIFICATION SUITE (SECTION 9)
// ============================================================================

export function runM07UnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
} {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  const check = (cond: boolean, label: string) => {
    totalChecks++;
    if (!cond) failedChecks.push(label);
  };

  // 1. Mandatory Arithmetic Cases from Section 9
  const c1 = computeJumpOperation(-3, '+', 5);
  check(c1.result === 2 && c1.direction === 'RIGHT' && c1.distanceUnits === 5, '(-3) + 5 = 2');

  const c2 = computeJumpOperation(4, '+', -7);
  check(c2.result === -3 && c2.direction === 'LEFT' && c2.distanceUnits === 7, '4 + (-7) = -3');

  const c3 = computeJumpOperation(-3, '-', -5);
  check(
    c3.result === 2 &&
      c3.effectiveDelta === 5 &&
      c3.direction === 'RIGHT' &&
      c3.fullEquationString === '(-3) - (-5) = (-3) + 5 = 2',
    '(-3) - (-5) = (-3) + 5 = 2'
  );

  const c4 = computeJumpOperation(-4, '-', 3);
  check(
    c4.result === -7 &&
      c4.effectiveDelta === -3 &&
      c4.direction === 'LEFT' &&
      c4.fullEquationString === '(-4) - 3 = (-4) + (-3) = -7',
    '(-4) - 3 = -7'
  );

  const c5 = computeJumpOperation(5, '-', 0);
  check(c5.result === 5 && c5.direction === 'STAY' && c5.distanceUnits === 0, '5 - 0 = 5');

  const c6 = computeJumpOperation(0, '-', -4);
  check(
    c6.result === 4 &&
      c6.effectiveDelta === 4 &&
      c6.direction === 'RIGHT' &&
      c6.fullEquationString === '0 - (-4) = 0 + 4 = 4',
    '0 - (-4) = 4'
  );

  const c7 = computeJumpOperation(-5, '-', -5);
  check(
    c7.result === 0 &&
      !Object.is(c7.result, -0) &&
      c7.fullEquationString === '(-5) - (-5) = (-5) + 5 = 0',
    '(-5) - (-5) = 0'
  );

  // 2. Mandatory Comparison, Opposite & Distance Cases from Section 9
  check(compareIntegers(-4, -1) === '<', '-4 < -1');
  check(compareIntegers(-2, -7) === '>', '-2 > -7');
  check(compareIntegers(0, -3) === '>', '0 > -3');
  check(compareIntegers(-5, -5) === '=', '-5 = -5');
  check(getAbsoluteValue(-6) === 6, '|-6| = 6');
  const oppZero = getOppositeInteger(0);
  check(oppZero === 0 && !Object.is(oppZero, -0) && `${oppZero}` === '0', 'Số đối của 0 là 0 (không phải -0)');
  check(getDistanceBetweenPoints(-3, 2) === 5 && getDistanceBetweenPoints(2, -3) === 5, 'Khoảng cách giữa -3 và 2 là 5');

  // 3. Coordinate Mapping & Tick Snapping (Steps 1, 2, 5 + odd integer between step-2 ticks)
  const vp: NumberLineViewport = { min: -10, max: 10, leftPx: 100, rightPx: 900 };
  const xZero = numberToSvgX(0, vp);
  const xNeg3 = numberToSvgX(-3, vp);
  check(
    Math.abs(xZero - 500) < 1e-9 && Math.abs(svgXToNumber(xNeg3, vp) - -3) < 1e-9,
    'Coordinate mapping round-trip exact'
  );
  check(
    snapValueToNumberLine(-3.8, 2, -10, 10, 0, false) === -4 &&
      snapValueToNumberLine(-3.1, 2, -10, 10, 0, true) === -3 &&
      snapValueToNumberLine(11.9, 5, -20, 20, 0, false) === 10,
    'Snap to tick steps 1, 2, 5 and exact integer between major labels'
  );

  // 4. Task Bank Completeness (At least 48 tasks, 8 per activity, all solvable)
  check(M07_TASK_BANK.length >= 48, 'M07_TASK_BANK has at least 48 tasks');
  for (const act of M07_ACTIVITY_METADATA) {
    const actTasks = getTasksByActivity(act.id);
    check(actTasks.length >= 8, `Activity ${act.id} has at least 8 tasks`);
  }

  // 5. Verify all Rescue tasks have a valid BFS solution within maxMoves
  const rescueTasks = getTasksByActivity('RESCUE_MISSION');
  for (const rt of rescueTasks) {
    const { rescueStart = 0, rescueTarget = 0, rescueMaxMoves = 1, rescueCards = [] } = rt.params;
    const sol = findOptimalRescueSolution(rescueStart, rescueTarget, rescueCards, rescueMaxMoves);
    check(sol !== null && sol.length <= rescueMaxMoves, `Rescue task ${rt.id} is solvable within ${rescueMaxMoves} moves`);
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
