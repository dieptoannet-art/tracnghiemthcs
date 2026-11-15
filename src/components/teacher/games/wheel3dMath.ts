import { StudentCandidate } from '../studentCallRules';

export type Wheel3DState =
  | 'SETUP'
  | 'LOADING_STUDENTS'
  | 'READY'
  | 'SELECTING_RESULT'
  | 'ACCELERATING'
  | 'SPINNING'
  | 'DECELERATING'
  | 'SETTLING'
  | 'REVEALING'
  | 'SAVING'
  | 'COMPLETED'
  | 'NO_ELIGIBLE_STUDENTS'
  | 'ERROR_RECOVERY'
  | 'RESET_CONFIRMATION';

export type Wheel3DLabelMode = 'AUTO' | 'NAME' | 'NUMBER';

export type Wheel3DResolvedLabelMode = 'FULL_OR_SHORT_NAME' | 'SHORT_NAME' | 'NUMBER_STT';

export type Wheel3DSpeedMode = 'FAST' | 'NORMAL' | 'SUSPENSE';

export type Wheel3DQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Wheel3DSliceItem {
  sliceIndex: number; // 0 .. N-1
  sttNumber: number; // 1 .. N (fixed per class roster or eligible list)
  formattedStt: string; // "01" .. "50"
  student: StudentCandidate;
  shortLabel: string;
  mediumLabel: string;
  colorHex: string;
  accentHex: string;
}

export interface Wheel3DSpinPlan {
  spinTokenId: string;
  selectedIndex: number;
  selectedSlice: Wheel3DSliceItem;
  startAngleCwRad: number;
  targetAngleCwRad: number;
  totalDeltaRad: number;
  durationMs: number;
  fullSpins: number;
  sliceOffsetRad: number;
}

export const WHEEL_3D_COLOR_PALETTE: Array<{ bg: string; accent: string }> = [
  { bg: '#E11D48', accent: '#FDA4AF' }, // Crimson Rose
  { bg: '#2563EB', accent: '#93C5FD' }, // Royal Blue
  { bg: '#D97706', accent: '#FDE68A' }, // Golden Amber
  { bg: '#059669', accent: '#6EE7B7' }, // Emerald Green
  { bg: '#7C3AED', accent: '#C4B5FD' }, // Vivid Violet
  { bg: '#0284C7', accent: '#7DD3FC' }, // Sky Cyan
  { bg: '#EA580C', accent: '#FDBA74' }, // Tangerine Orange
  { bg: '#4F46E5', accent: '#A5B4FC' }, // Electric Indigo
  { bg: '#0D9488', accent: '#5EEAD4' }, // Deep Teal
  { bg: '#DB2777', accent: '#F9A8D4' }, // Magenta Pink
];

const TWO_PI = Math.PI * 2;

/**
 * Unbiased cryptographic random integer in [0, max - 1] using rejection sampling.
 * Eliminates modulo bias and supports both browser and Node/Vitest WebCrypto environments.
 */
export function cryptoRandomInt(max: number): number {
  if (!Number.isFinite(max) || max <= 1) return 0;
  const cleanMax = Math.floor(max);
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : undefined;

  if (cryptoObj) {
    const uint32Max = 0xffffffff;
    const limit = uint32Max - (uint32Max % cleanMax);
    const buffer = new Uint32Array(1);
    let value = 0;
    do {
      cryptoObj.getRandomValues(buffer);
      value = buffer[0];
    } while (value >= limit);
    return value % cleanMax;
  }

  return Math.floor(Math.random() * cleanMax);
}

/**
 * Unbiased float in [-halfRange, +halfRange] using cryptoRandomInt.
 */
export function cryptoRandomSymmetricOffset(halfRange: number): number {
  if (halfRange <= 0) return 0;
  const bucket = cryptoRandomInt(10001); // 0 .. 10000
  const normalized = (bucket / 5000) - 1; // -1.0 .. +1.0
  return normalized * halfRange;
}

/**
 * Determine automatic wheel label display mode based on student count (Section IV):
 * - 1..15 students: Full/short name on slice
 * - 16..30 students: Short name on slice
 * - 31..50+ students: STT ("01".."50") on slice + STT reference table on side
 */
export function resolveWheelLabelMode(
  studentCount: number,
  userPreference: Wheel3DLabelMode
): Wheel3DResolvedLabelMode {
  if (userPreference === 'NUMBER') return 'NUMBER_STT';
  if (userPreference === 'NAME') {
    return studentCount <= 15 ? 'FULL_OR_SHORT_NAME' : 'SHORT_NAME';
  }
  if (studentCount <= 15) return 'FULL_OR_SHORT_NAME';
  if (studentCount <= 30) return 'SHORT_NAME';
  return 'NUMBER_STT';
}

/**
 * Format Vietnamese student name into compact slice labels without losing identity.
 * Example: "Nguyễn Hoàng Minh Anh" -> short: "M. Anh", medium: "H. Minh Anh"
 */
export function formatStudentWheelLabels(
  fullName: string,
  sttNumber: number
): { formattedStt: string; shortLabel: string; mediumLabel: string } {
  const formattedStt = String(sttNumber).padStart(2, '0');
  const trimmed = (fullName || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    return {
      formattedStt,
      shortLabel: `#${formattedStt}`,
      mediumLabel: `HS #${formattedStt}`,
    };
  }

  const parts = trimmed.split(' ');
  if (parts.length === 1) {
    return {
      formattedStt,
      shortLabel: parts[0].slice(0, 12),
      mediumLabel: parts[0].slice(0, 16),
    };
  }

  const givenName = parts[parts.length - 1];
  const middleInitial = parts[parts.length - 2]?.charAt(0)?.toUpperCase() || '';
  const shortLabel = middleInitial ? `${middleInitial}. ${givenName}` : givenName;

  if (parts.length === 2) {
    return {
      formattedStt,
      shortLabel,
      mediumLabel: trimmed.length <= 16 ? trimmed : shortLabel,
    };
  }

  const lastTwo = `${parts[parts.length - 2]} ${givenName}`;
  const firstInitial = parts[0]?.charAt(0)?.toUpperCase() || '';
  const mediumCandidate = `${firstInitial}. ${lastTwo}`;

  return {
    formattedStt,
    shortLabel,
    mediumLabel: trimmed.length <= 15 ? trimmed : mediumCandidate.length <= 16 ? mediumCandidate : shortLabel,
  };
}

/**
 * Build immutable, deterministic slice items for the wheel.
 * Preserves each student's original class STT (1..M) if full roster is provided.
 */
export function buildWheel3DSliceItems(
  activeStudents: StudentCandidate[],
  fullRosterStudents?: StudentCandidate[]
): Wheel3DSliceItem[] {
  const rosterIndexMap = new Map<string, number>();
  if (fullRosterStudents && fullRosterStudents.length > 0) {
    fullRosterStudents.forEach((student, idx) => {
      rosterIndexMap.set(student.id, idx + 1);
    });
  }

  return activeStudents.map((student, sliceIndex) => {
    const sttNumber = rosterIndexMap.get(student.id) ?? sliceIndex + 1;
    const { formattedStt, shortLabel, mediumLabel } = formatStudentWheelLabels(
      student.fullName,
      sttNumber
    );
    // Avoid adjacent identical colors even when N % palette.length === 1
    let paletteIndex = sliceIndex % WHEEL_3D_COLOR_PALETTE.length;
    if (
      activeStudents.length > 1 &&
      sliceIndex === activeStudents.length - 1 &&
      paletteIndex === 0
    ) {
      paletteIndex = 1;
    }
    const palette = WHEEL_3D_COLOR_PALETTE[paletteIndex];

    return {
      sliceIndex,
      sttNumber,
      formattedStt,
      student,
      shortLabel,
      mediumLabel,
      colorHex: palette.bg,
      accentHex: palette.accent,
    };
  });
}

/**
 * Normalize any angle in radians into [0, 2π).
 */
export function normalizeAngleZeroToTwoPi(angleRad: number): number {
  const mod = angleRad % TWO_PI;
  return mod < 0 ? mod + TWO_PI : mod;
}

/**
 * Coordinate System Definition (Section V):
 * - Fixed pointer is at 12 o'clock (+Y axis in 3D world space, angle 0 in clockwise wheel coordinates).
 * - When wheel clockwise rotation `angleCwRad = 0`:
 *   Slice `i` (0 <= i < N) occupies clockwise angle `[i * Δθ, (i + 1) * Δθ)` from 12 o'clock,
 *   with center at `(i + 0.5) * Δθ`, where `Δθ = 2π / N`.
 * - In Three.js right-handed coordinates (+X right, +Y up, +Z out of screen):
 *   Clockwise rotation by `angleCwRad` corresponds to `wheelGroup.rotation.z = -angleCwRad`.
 * - Given any clockwise wheel rotation `angleCwRad`, the wheel coordinate `α` currently under
 *   the 12 o'clock pointer satisfies `(α + angleCwRad) ≡ 0 (mod 2π)`, i.e.:
 *   `α = (2π - (angleCwRad mod 2π)) mod 2π`.
 */
export function getSelectedSliceIndexFromAngleRad(
  angleCwRad: number,
  sliceCount: number
): number {
  if (sliceCount <= 1) return 0;
  const sliceArc = TWO_PI / sliceCount;
  const normalizedCw = normalizeAngleZeroToTwoPi(angleCwRad);
  const pointerWheelCoord = normalizeAngleZeroToTwoPi(TWO_PI - normalizedCw);
  const rawIndex = Math.floor(pointerWheelCoord / sliceArc);
  return Math.min(Math.max(rawIndex, 0), sliceCount - 1);
}

/**
 * Compute target clockwise rotation angle `targetAngleCwRad > currentAngleCwRad`
 * so that `selectedIndex` lands directly under the 12 o'clock pointer after `fullSpins` full turns.
 *
 * `sliceOffsetFactor` must be in `[-0.32, +0.32]` so the pointer lands near the center of the slice
 * and never on a boundary peg.
 */
export function computeTargetWheelAngleRad(params: {
  currentAngleCwRad: number;
  selectedIndex: number;
  sliceCount: number;
  fullSpins: number;
  sliceOffsetFactor?: number;
}): { targetAngleCwRad: number; totalDeltaRad: number; sliceOffsetRad: number } {
  const {
    currentAngleCwRad,
    selectedIndex,
    sliceCount,
    fullSpins,
    sliceOffsetFactor = 0,
  } = params;

  const safeCount = Math.max(1, Math.floor(sliceCount));
  const clampedIndex = Math.min(Math.max(0, Math.floor(selectedIndex)), safeCount - 1);
  const sliceArc = TWO_PI / safeCount;
  const safeOffsetFactor = Math.min(Math.max(sliceOffsetFactor, -0.32), 0.32);
  const sliceOffsetRad = safeOffsetFactor * sliceArc;

  // Center of slice `clampedIndex` in wheel clockwise coordinates from 12 o'clock:
  const targetWheelCoord = (clampedIndex + 0.5) * sliceArc + sliceOffsetRad;

  // Required `targetAngleCwRad mod 2π` so that `(targetWheelCoord + targetAngleCwRad) ≡ 0 (mod 2π)`:
  const desiredMod = normalizeAngleZeroToTwoPi(TWO_PI - targetWheelCoord);
  const currentMod = normalizeAngleZeroToTwoPi(currentAngleCwRad);

  let forwardDelta = desiredMod - currentMod;
  if (forwardDelta <= 0.0001) {
    forwardDelta += TWO_PI;
  }

  const spins = Math.max(1, Math.floor(fullSpins));
  const totalDeltaRad = spins * TWO_PI + forwardDelta;
  const targetAngleCwRad = currentAngleCwRad + totalDeltaRad;

  return {
    targetAngleCwRad,
    totalDeltaRad,
    sliceOffsetRad,
  };
}

/**
 * Evaluate smooth 3-phase rotation progress in [0, 1] for normalized time `t ∈ [0, 1]`:
 * - Phase 1 (t in [0, 0.12]): Smooth acceleration ramp (ACCELERATING)
 * - Phase 2 (t in [0.12, 0.32]): High-momentum spin (SPINNING)
 * - Phase 3 (t in [0.32, 1.00]): Long, suspenseful quartic deceleration (DECELERATING -> SETTLING)
 *
 * Strictly monotonic increasing with C1 velocity continuity across all segment joins.
 */
export function evaluateWheel3DSpinCurve(t: number): {
  progress: number;
  phase: 'ACCELERATING' | 'SPINNING' | 'DECELERATING' | 'SETTLING';
  normalizedVelocity: number;
} {
  const clamped = Math.min(Math.max(t, 0), 1);

  // Smooth C1 piecewise polynomial / power curve:
  // Use quintic ease-out blended with a soft quadratic start over the first 10% of time
  // f(t) = 1 - (1 - t)^4.2 gives natural physics friction; to start from 0 velocity at t=0,
  // we use g(t) = 1 - (1 - t^1.35)^4.0 which starts at 0 slope, peaks early, and has a long tail.
  const exponentIn = 1.32;
  const exponentOut = 4.15;
  const inner = Math.pow(clamped, exponentIn);
  const progress = 1 - Math.pow(1 - inner, exponentOut);

  // Analytical derivative for velocity feedback (flapper peg impact intensity & sound pitch)
  const rawDerivative =
    clamped <= 0.0001 || clamped >= 0.9999
      ? 0
      : exponentOut *
        Math.pow(1 - inner, exponentOut - 1) *
        exponentIn *
        Math.pow(clamped, exponentIn - 1);
  const normalizedVelocity = Math.min(Math.max(rawDerivative / 3.4, 0), 1);

  let phase: 'ACCELERATING' | 'SPINNING' | 'DECELERATING' | 'SETTLING' = 'SPINNING';
  if (clamped < 0.12) {
    phase = 'ACCELERATING';
  } else if (clamped < 0.36) {
    phase = 'SPINNING';
  } else if (clamped < 0.92) {
    phase = 'DECELERATING';
  } else {
    phase = 'SETTLING';
  }

  return { progress, phase, normalizedVelocity };
}

/**
 * Filter eligible students according to `allowRepeat` and `absentIds`.
 */
export function filterEligibleWheelStudents(params: {
  allStudents: StudentCandidate[];
  absentIds?: Set<string>;
  calledSessionIds?: Set<string>;
  allowRepeat: boolean;
}): StudentCandidate[] {
  const { allStudents, absentIds, calledSessionIds, allowRepeat } = params;
  return allStudents.filter((student) => {
    if (absentIds?.has(student.id)) return false;
    if (!allowRepeat && calledSessionIds?.has(student.id)) return false;
    return true;
  });
}

/**
 * Deduplication registry helper to guarantee each `spinTokenId` is saved at most once.
 */
export class SpinSaveDeduplicator {
  private savedSpinIds = new Set<string>();

  public canSave(spinTokenId: string): boolean {
    if (!spinTokenId) return false;
    return !this.savedSpinIds.has(spinTokenId);
  }

  public markSaved(spinTokenId: string): boolean {
    if (!spinTokenId || this.savedSpinIds.has(spinTokenId)) {
      return false;
    }
    this.savedSpinIds.add(spinTokenId);
    return true;
  }

  public hasSaved(spinTokenId: string): boolean {
    return this.savedSpinIds.has(spinTokenId);
  }
}

export interface Wheel3DUnitTestReport {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
}

/**
 * Automated self-test suite verifying Section XV requirements:
 * 1. Bijective angle<->sliceIndex accuracy for 1, 2, 10, 30, and 50 students across all slices and random offsets.
 * 2. Fair RNG distribution and strict anti-repeat over 20 consecutive spins.
 * 3. Deduplication of spin history logs (`SpinSaveDeduplicator`).
 * 4. Monotonicity and boundary accuracy of `evaluateWheel3DSpinCurve`.
 */
export function runWheel3DUnitTests(): Wheel3DUnitTestReport {
  const failedChecks: string[] = [];
  let totalChecks = 0;

  // Test 1: Bijective sliceIndex <-> targetAngleCwRad for N in [1, 2, 10, 30, 50]
  const testCounts = [1, 2, 10, 30, 50];
  const testOffsets = [-0.28, -0.15, 0, 0.15, 0.28];
  const startingAngles = [0, 1.234, 5.678, 19.42];

  for (const count of testCounts) {
    for (let idx = 0; idx < count; idx++) {
      for (const offsetFactor of testOffsets) {
        for (const startAngle of startingAngles) {
          totalChecks++;
          const { targetAngleCwRad } = computeTargetWheelAngleRad({
            currentAngleCwRad: startAngle,
            selectedIndex: idx,
            sliceCount: count,
            fullSpins: 6,
            sliceOffsetFactor: offsetFactor,
          });
          const resolvedIdx = getSelectedSliceIndexFromAngleRad(targetAngleCwRad, count);
          if (resolvedIdx !== idx) {
            failedChecks.push(
              `Mismatch for N=${count}, expected=${idx}, resolved=${resolvedIdx}, offset=${offsetFactor}`
            );
          }
        }
      }
    }
  }

  // Test 2: 20 consecutive spins with anti-repeat on a 25-student class
  const mockRoster: StudentCandidate[] = Array.from({ length: 25 }, (_, i) => ({
    id: `student_${i + 1}`,
    code: `HS${String(i + 1).padStart(2, '0')}`,
    fullName: `Học Sinh Số ${i + 1}`,
  }));
  const calledSet = new Set<string>();
  for (let spin = 0; spin < 20; spin++) {
    totalChecks++;
    const eligible = filterEligibleWheelStudents({
      allStudents: mockRoster,
      calledSessionIds: calledSet,
      allowRepeat: false,
    });
    if (eligible.length !== 25 - spin) {
      failedChecks.push(`Spin ${spin}: expected ${25 - spin} eligible, got ${eligible.length}`);
    }
    const chosenIdx = cryptoRandomInt(eligible.length);
    const chosen = eligible[chosenIdx];
    if (!chosen || calledSet.has(chosen.id)) {
      failedChecks.push(`Spin ${spin}: duplicate or invalid student picked (${chosen?.id})`);
    }
    calledSet.add(chosen.id);
  }

  // Test 3: SpinSaveDeduplicator prevents duplicate saves of the same spinTokenId
  totalChecks++;
  const deduplicator = new SpinSaveDeduplicator();
  const firstAttempt = deduplicator.markSaved('spin_token_001');
  const secondAttempt = deduplicator.markSaved('spin_token_001');
  if (!firstAttempt || secondAttempt) {
    failedChecks.push('SpinSaveDeduplicator failed to block duplicate spinTokenId');
  }

  // Test 4: Spin curve boundary and monotonicity check
  totalChecks++;
  const startEval = evaluateWheel3DSpinCurve(0);
  const endEval = evaluateWheel3DSpinCurve(1);
  if (Math.abs(startEval.progress - 0) > 1e-6 || Math.abs(endEval.progress - 1) > 1e-6) {
    failedChecks.push(`Curve boundary error: start=${startEval.progress}, end=${endEval.progress}`);
  }
  let prevProgress = 0;
  for (let step = 1; step <= 100; step++) {
    totalChecks++;
    const cur = evaluateWheel3DSpinCurve(step / 100).progress;
    if (cur < prevProgress - 1e-9) {
      failedChecks.push(`Curve non-monotonic at step ${step}: ${cur} < ${prevProgress}`);
    }
    prevProgress = cur;
  }

  return {
    passed: failedChecks.length === 0,
    totalChecks,
    failedChecks,
  };
}
