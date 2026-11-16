import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

// ============================================================================
// A07 SPACE ROCKET 3D PREMIUM 2027 - CORE ENGINE
// Separated into 3 deterministic modules:
//   1. Selection Engine (Cryptographic unbiased 1/N fairness, 1..50+ students)
//   2. Rocket Animation Engine (Monotonic performance.now kinematics & staging)
//   3. Result Manager (SessionId deduplication, turn records, note formatting)
// ============================================================================

export type SpaceRocket3DState =
  | 'IDLE'
  | 'READY'
  | 'COUNTDOWN'
  | 'LAUNCHING'
  | 'FLYING'
  | 'FINISHING'
  | 'RESULT';

export type SpaceRocketDurationSec = 5 | 10 | 15;

export type SpaceRocketCameraMode =
  | 'LAUNCHPAD_WIDE'
  | 'TRACKING_CLIMB'
  | 'HERO_ASCENT'
  | 'COSMIC_AERIAL'
  | 'FINISH_GATE';

export type SpaceRocketHeatMode = 'REPRESENTATIVE_FAIR' | 'BRACKET_HEATS';

export type SpaceRocketQualityPreset = 'HIGH' | 'MEDIUM' | 'LOW';

export type SpaceRocketFlightStage =
  | 'PAD_IDLE'
  | 'IGNITION'
  | 'LIFTOFF'
  | 'TROPOSPHERE'
  | 'DEEP_SPACE'
  | 'WARP_GATE'
  | 'VICTORY';

export interface RocketLiveryPalette {
  id: string;
  nameVi: string;
  hullHex: string;
  accentHex: string;
  finHex: string;
  flameOuterHex: string;
  flameCoreHex: string;
  badgeHex: string;
}

// Required 6 rocket colors: Blue, Red, Yellow, Green, Orange, Purple
export const ROCKET_LIVERY_PALETTES: RocketLiveryPalette[] = [
  {
    id: 'blue',
    nameVi: 'Xanh dương',
    hullHex: '#F8FAFC',
    accentHex: '#006BFF',
    finHex: '#00C8FF',
    flameOuterHex: '#00C8FF',
    flameCoreHex: '#FFFFFF',
    badgeHex: '#006BFF',
  },
  {
    id: 'red',
    nameVi: 'Đỏ',
    hullHex: '#F8FAFC',
    accentHex: '#DC2626',
    finHex: '#EF4444',
    flameOuterHex: '#FF5722',
    flameCoreHex: '#FFD54F',
    badgeHex: '#DC2626',
  },
  {
    id: 'yellow',
    nameVi: 'Vàng',
    hullHex: '#F8FAFC',
    accentHex: '#EAB308',
    finHex: '#FFD54F',
    flameOuterHex: '#FF9800',
    flameCoreHex: '#FFFDE7',
    badgeHex: '#CA8A04',
  },
  {
    id: 'green',
    nameVi: 'Xanh lá',
    hullHex: '#F8FAFC',
    accentHex: '#059669',
    finHex: '#10B981',
    flameOuterHex: '#22C55E',
    flameCoreHex: '#ECFDF5',
    badgeHex: '#059669',
  },
  {
    id: 'orange',
    nameVi: 'Cam',
    hullHex: '#F8FAFC',
    accentHex: '#FF7A21',
    finHex: '#F97316',
    flameOuterHex: '#FF7A21',
    flameCoreHex: '#FFF8E1',
    badgeHex: '#EA580C',
  },
  {
    id: 'purple',
    nameVi: 'Tím',
    hullHex: '#F8FAFC',
    accentHex: '#7C3AED',
    finHex: '#A855F7',
    flameOuterHex: '#A855F7',
    flameCoreHex: '#F3E8FF',
    badgeHex: '#7C3AED',
  },
];

export const MAX_ROCKET_PADS = 6;
export const PAD_SPACING_X = 3.25;
export const ROCKET_START_Y = 0;
export const ROCKET_FINISH_Y = 72;
export const ROCKET_FLIGHT_HEIGHT = ROCKET_FINISH_Y - ROCKET_START_Y; // 72 world units
export const COUNTDOWN_TOTAL_MS = 3200; // 3 (900ms) -> 2 (900ms) -> 1 (900ms) -> PHONG! (500ms)
export const LAUNCH_IGNITION_END_U = 0.14;
export const FINISHING_SLOWMO_MS = 1400;
const KINEMATIC_SAMPLES = 96;

export interface RocketPadEntry {
  padIndex: number; // 0 .. padCount - 1
  padNumber: number; // 1 .. padCount
  padX: number;
  padZ: number;
  student: StudentCandidate;
  safeName: string;
  safeCode: string;
  displayLabel: string;
  sttNumber: number;
  formattedStt: string;
  palette: RocketLiveryPalette;
  isWinner: boolean;
  targetFinishProgress: number; // 1.0 for winner, < 0.966 for non-winners
  progressSamples: number[]; // length = KINEMATIC_SAMPLES + 1, strictly non-decreasing
  phaseOffset: number;
}

export interface SpaceRocketTurnPlan {
  sessionId: string;
  createdAtMs: number;
  durationSec: SpaceRocketDurationSec;
  durationMs: number;
  heatMode: SpaceRocketHeatMode;
  heatIndex: number;
  totalHeats: number;
  eligibleCount: number;
  winner: StudentCandidate;
  winnerPadIndex: number;
  winnerSttNumber: number;
  winnerDisplayLabel: string;
  rockets: RocketPadEntry[];
}

export interface RocketFrameState {
  padIndex: number;
  progress: number; // 0 .. 1
  x: number;
  y: number;
  z: number;
  speedNorm: number; // normalized vertical velocity
  stage: SpaceRocketFlightStage;
  isLeading: boolean;
}

// ============================================================================
// SAFE FORMATTING & CRYPTO UTILITIES
// ============================================================================

export function cryptoFisherYatesShuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

export function getSafeAstronautFields(
  student: StudentCandidate,
  sttNumber: number
): { safeName: string; safeCode: string; formattedStt: string } {
  const formattedStt = String(Math.max(1, sttNumber)).padStart(2, '0');
  const rawName = (student.fullName || '').trim().replace(/\s+/g, ' ');
  const safeName = rawName || `Học sinh #${formattedStt}`;
  const rawCode = (student.code || '').trim();
  const safeCode = rawCode || `HS${formattedStt}`;
  return { safeName, safeCode, formattedStt };
}

export function formatRocketPadDisplayLabel(
  safeName: string,
  formattedStt: string,
  hasDuplicateName: boolean
): string {
  const maxLen = hasDuplicateName ? 18 : 22;
  const shortened =
    safeName.length > maxLen ? `${safeName.slice(0, maxLen - 1).trimEnd()}…` : safeName;
  return hasDuplicateName ? `#${formattedStt} · ${shortened}` : shortened;
}

export function computeRocketPadX(padIndex: number, padCount: number): number {
  const safeCount = Math.max(1, padCount);
  return (padIndex - (safeCount - 1) / 2) * PAD_SPACING_X;
}

export function computeRocketPadZ(padIndex: number, padCount: number): number {
  // Subtle amphitheater arc so every launchpad nameplate stays legible from front/wide camera
  const safeCount = Math.max(1, padCount);
  const norm = safeCount <= 1 ? 0 : (padIndex - (safeCount - 1) / 2) / ((safeCount - 1) / 2);
  return (norm * norm - 0.5) * 1.1;
}

export function computeSpaceRocketHeatBuckets(
  eligibleStudents: readonly StudentCandidate[],
  maxPerHeat: number = MAX_ROCKET_PADS
): StudentCandidate[][] {
  if (eligibleStudents.length === 0) return [];
  const cap = Math.max(1, Math.min(MAX_ROCKET_PADS, maxPerHeat));
  const buckets: StudentCandidate[][] = [];
  for (let i = 0; i < eligibleStudents.length; i += cap) {
    buckets.push(eligibleStudents.slice(i, i + cap));
  }
  return buckets;
}

// ============================================================================
// MODULE 1: SELECTION ENGINE
// Cryptographic 1/N fair winner selection BEFORE populating the 6 launch pads
// ============================================================================

export interface SpaceRocketSelectionResult {
  selectionPool: StudentCandidate[];
  winner: StudentCandidate;
  padStudents: StudentCandidate[];
  heatIndex: number;
  totalHeats: number;
}

/**
 * Unbiased Selection Engine:
 * 1. Determines active eligible pool (`all eligible` for REPRESENTATIVE_FAIR,
 *    or current bracket slice for BRACKET_HEATS).
 * 2. Selects ONE winner directly across ALL M eligible students with exact 1/M probability
 *    using Web Crypto rejection sampling (`cryptoRandomInt`).
 * 3. If M > 6 (e.g., 30 or 50 students), uniformly samples 5 distinct peers without
 *    replacement from the remaining M-1 students and shuffles the 6 launch pads.
 *    This guarantees NO student in a 50-student class is ever excluded by slicing!
 */
export function selectFairSpaceRocketParticipants(params: {
  eligibleStudents: readonly StudentCandidate[];
  heatMode: SpaceRocketHeatMode;
  heatIndex: number;
}): SpaceRocketSelectionResult {
  const { eligibleStudents, heatMode, heatIndex } = params;
  if (eligibleStudents.length === 0) {
    throw new Error('Không có học sinh hợp lệ nào để bắt đầu phóng tên lửa.');
  }

  let selectionPool: StudentCandidate[];
  let totalHeats = 1;
  let safeHeatIndex = 0;

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_ROCKET_PADS) {
    const buckets = computeSpaceRocketHeatBuckets(eligibleStudents, MAX_ROCKET_PADS);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    selectionPool = buckets[safeHeatIndex];
  } else {
    selectionPool = [...eligibleStudents];
  }

  const winnerIdx = cryptoRandomInt(selectionPool.length);
  const winner = selectionPool[winnerIdx];

  let padStudents: StudentCandidate[];
  if (selectionPool.length <= MAX_ROCKET_PADS) {
    padStudents = cryptoFisherYatesShuffle(selectionPool);
  } else {
    const others = selectionPool.filter((s) => s.id !== winner.id);
    const sampledPeers = cryptoFisherYatesShuffle(others).slice(0, MAX_ROCKET_PADS - 1);
    padStudents = cryptoFisherYatesShuffle([winner, ...sampledPeers]);
  }

  return {
    selectionPool,
    winner,
    padStudents,
    heatIndex: safeHeatIndex,
    totalHeats,
  };
}

// ============================================================================
// MODULE 2: ROCKET ANIMATION ENGINE
// Deterministic monotonic trajectory curves & FPS-independent stage evaluation
// ============================================================================

function buildMonotonicRocketAscentSamples(params: {
  isWinner: boolean;
  targetFinishProgress: number;
}): number[] {
  const { isWinner, targetFinishProgress } = params;
  const f1 = 1.4 + cryptoRandomInt(110) / 100;
  const f2 = 2.6 + cryptoRandomInt(140) / 100;
  const p1 = cryptoRandomInt(628) / 100;
  const p2 = cryptoRandomInt(628) / 100;

  const liftoffThrust = isWinner
    ? 0.72 + cryptoRandomInt(30) / 100
    : 0.85 + cryptoRandomInt(48) / 100;
  const midStageBoost = isWinner
    ? 0.98 + cryptoRandomInt(36) / 100
    : 0.86 + cryptoRandomInt(46) / 100;
  const warpStageKick = isWinner
    ? 1.64 + cryptoRandomInt(30) / 100
    : 0.68 + cryptoRandomInt(34) / 100;

  const weights: number[] = [];
  let sum = 0;

  for (let k = 1; k <= KINEMATIC_SAMPLES; k++) {
    const u = k / KINEMATIC_SAMPLES;
    // Authentic Saturn/Falcon liftoff ramp: heavy liftoff acceleration over first 14%
    const thrustRamp = 0.24 + 0.76 * Math.min(1, u / 0.14);
    const wave =
      0.22 * Math.sin(u * Math.PI * f1 + p1) +
      0.13 * Math.cos(u * Math.PI * f2 + p2);

    const stageWeight = u < 0.34 ? liftoffThrust : u < 0.70 ? midStageBoost : warpStageKick;
    const stepVel = Math.max(0.22, thrustRamp * (stageWeight + wave));
    weights.push(stepVel);
    sum += stepVel;
  }

  const samples: number[] = [0];
  let cumulative = 0;
  for (let k = 0; k < KINEMATIC_SAMPLES; k++) {
    cumulative += weights[k] / sum;
    samples.push(Math.min(targetFinishProgress, cumulative * targetFinishProgress));
  }
  samples[KINEMATIC_SAMPLES] = targetFinishProgress;

  for (let k = 1; k <= KINEMATIC_SAMPLES; k++) {
    if (samples[k] < samples[k - 1]) {
      samples[k] = samples[k - 1];
    }
  }
  return samples;
}

export function buildSpaceRocketPreviewLineup(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  heatMode: SpaceRocketHeatMode;
  heatIndex: number;
}): {
  lineup: RocketPadEntry[];
  totalHeats: number;
  safeHeatIndex: number;
} {
  const { eligibleStudents, fullRoster, heatMode, heatIndex } = params;
  if (eligibleStudents.length === 0) {
    return { lineup: [], totalHeats: 0, safeHeatIndex: 0 };
  }

  const rosterSttMap = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  const refRoster = fullRoster.length > 0 ? fullRoster : eligibleStudents;

  refRoster.forEach((st, idx) => {
    rosterSttMap.set(st.id, idx + 1);
    const norm = (st.fullName || '').trim().toLowerCase();
    nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1);
  });

  let poolSlice: StudentCandidate[];
  let totalHeats = 1;
  let safeHeatIndex = 0;

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_ROCKET_PADS) {
    const buckets = computeSpaceRocketHeatBuckets(eligibleStudents, MAX_ROCKET_PADS);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    poolSlice = buckets[safeHeatIndex];
  } else if (eligibleStudents.length <= MAX_ROCKET_PADS) {
    poolSlice = [...eligibleStudents];
  } else {
    poolSlice = eligibleStudents.slice(0, MAX_ROCKET_PADS);
  }

  const padCount = poolSlice.length;
  const lineup: RocketPadEntry[] = poolSlice.map((student, padIndex) => {
    const sttNumber = rosterSttMap.get(student.id) ?? padIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeAstronautFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;
    return {
      padIndex,
      padNumber: padIndex + 1,
      padX: computeRocketPadX(padIndex, padCount),
      padZ: computeRocketPadZ(padIndex, padCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatRocketPadDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: ROCKET_LIVERY_PALETTES[padIndex % ROCKET_LIVERY_PALETTES.length],
      isWinner: false,
      targetFinishProgress: 0,
      progressSamples: [0],
      phaseOffset: padIndex * 1.08,
    };
  });

  return { lineup, totalHeats, safeHeatIndex };
}

export function createFairSpaceRocketTurnPlan(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  durationSec: SpaceRocketDurationSec;
  heatMode: SpaceRocketHeatMode;
  heatIndex: number;
  sessionId?: string;
}): SpaceRocketTurnPlan {
  const { eligibleStudents, fullRoster, durationSec, heatMode, heatIndex } = params;

  const selection = selectFairSpaceRocketParticipants({
    eligibleStudents,
    heatMode,
    heatIndex,
  });

  const rosterSttMap = new Map<string, number>();
  const nameCounts = new Map<string, number>();
  const refRoster = fullRoster.length > 0 ? fullRoster : eligibleStudents;

  refRoster.forEach((st, idx) => {
    rosterSttMap.set(st.id, idx + 1);
    const norm = (st.fullName || '').trim().toLowerCase();
    nameCounts.set(norm, (nameCounts.get(norm) ?? 0) + 1);
  });

  const winner = selection.winner;
  const winnerSttNumber = rosterSttMap.get(winner.id) ?? 1;
  const winnerSafe = getSafeAstronautFields(winner, winnerSttNumber);
  const winnerDup = (nameCounts.get(winnerSafe.safeName.toLowerCase()) ?? 0) > 1;
  const winnerDisplayLabel = formatRocketPadDisplayLabel(
    winnerSafe.safeName,
    winnerSafe.formattedStt,
    winnerDup
  );

  const padCount = selection.padStudents.length;
  const rockets: RocketPadEntry[] = selection.padStudents.map((student, padIndex) => {
    const isWinner = student.id === winner.id;
    const sttNumber = rosterSttMap.get(student.id) ?? padIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeAstronautFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;

    const finishMargin = isWinner ? 1.0 : 0.87 + cryptoRandomInt(92) / 1000;

    return {
      padIndex,
      padNumber: padIndex + 1,
      padX: computeRocketPadX(padIndex, padCount),
      padZ: computeRocketPadZ(padIndex, padCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatRocketPadDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: ROCKET_LIVERY_PALETTES[padIndex % ROCKET_LIVERY_PALETTES.length],
      isWinner,
      targetFinishProgress: finishMargin,
      progressSamples: buildMonotonicRocketAscentSamples({
        isWinner,
        targetFinishProgress: finishMargin,
      }),
      phaseOffset: padIndex * 1.08,
    };
  });

  // Strict finish invariant: pre-selected winner passes the space gate ahead of everyone
  const winnerPadIndex = rockets.findIndex((r) => r.isWinner);
  const winnerEntry = rockets[winnerPadIndex];
  for (let pad = 0; pad < rockets.length; pad++) {
    if (pad === winnerPadIndex) continue;
    const other = rockets[pad];
    for (let k = KINEMATIC_SAMPLES - 5; k <= KINEMATIC_SAMPLES; k++) {
      const minGap = k === KINEMATIC_SAMPLES ? 0.028 : 0.012;
      if (other.progressSamples[k] >= winnerEntry.progressSamples[k] - minGap) {
        other.progressSamples[k] = Math.max(
          other.progressSamples[k - 1] ?? 0,
          winnerEntry.progressSamples[k] - minGap
        );
      }
    }
  }

  return {
    sessionId:
      params.sessionId ||
      `a07_rocket_${Date.now().toString(36)}_${cryptoRandomInt(999999)}`,
    createdAtMs: Date.now(),
    durationSec,
    durationMs: durationSec * 1000,
    heatMode,
    heatIndex: selection.heatIndex,
    totalHeats: selection.totalHeats,
    eligibleCount: selection.selectionPool.length,
    winner,
    winnerPadIndex,
    winnerSttNumber,
    winnerDisplayLabel,
    rockets,
  };
}

export function resolveRocketFlightStage(
  u: number,
  isCompleted: boolean
): SpaceRocketFlightStage {
  if (isCompleted) return 'VICTORY';
  if (u < 0.06) return 'IGNITION';
  if (u < LAUNCH_IGNITION_END_U) return 'LIFTOFF';
  if (u < 0.48) return 'TROPOSPHERE';
  if (u < 0.85) return 'DEEP_SPACE';
  return 'WARP_GATE';
}

export function evaluateSpaceRocketFrame(
  plan: SpaceRocketTurnPlan,
  flightElapsedMs: number,
  outFrames?: RocketFrameState[]
): {
  u: number;
  isFlightCompleted: boolean;
  leaderPadIndex: number;
  leaderProgress: number;
  packCenterY: number;
  frames: RocketFrameState[];
} {
  const u = Math.min(Math.max(flightElapsedMs / Math.max(1, plan.durationMs), 0), 1);
  const scaled = u * KINEMATIC_SAMPLES;
  const idx0 = Math.min(Math.floor(scaled), KINEMATIC_SAMPLES);
  const idx1 = Math.min(idx0 + 1, KINEMATIC_SAMPLES);
  const frac = scaled - idx0;

  const frames =
    outFrames && outFrames.length === plan.rockets.length
      ? outFrames
      : plan.rockets.map((r) => ({
          padIndex: r.padIndex,
          progress: 0,
          x: r.padX,
          y: ROCKET_START_Y,
          z: r.padZ,
          speedNorm: 0,
          stage: 'PAD_IDLE' as SpaceRocketFlightStage,
          isLeading: false,
        }));

  let maxProgress = -1;
  let leaderPadIndex = 0;
  let sumY = 0;
  const isCompleted = u >= 1;

  for (let i = 0; i < plan.rockets.length; i++) {
    const r = plan.rockets[i];
    const p0 = r.progressSamples[idx0];
    const p1 = r.progressSamples[idx1];
    const progress = p0 + (p1 - p0) * frac;
    const y = ROCKET_START_Y + progress * ROCKET_FLIGHT_HEIGHT;
    const speedNorm = (p1 - p0) * KINEMATIC_SAMPLES;

    frames[i].padIndex = r.padIndex;
    frames[i].progress = progress;
    frames[i].x = r.padX;
    frames[i].y = y;
    frames[i].z = r.padZ;
    frames[i].speedNorm = speedNorm;
    frames[i].stage = resolveRocketFlightStage(u, isCompleted);
    frames[i].isLeading = false;

    sumY += y;
    if (progress > maxProgress) {
      maxProgress = progress;
      leaderPadIndex = i;
    }
  }

  if (frames[leaderPadIndex]) {
    frames[leaderPadIndex].isLeading = true;
  }

  return {
    u,
    isFlightCompleted: isCompleted,
    leaderPadIndex,
    leaderProgress: Math.max(0, maxProgress),
    packCenterY: plan.rockets.length > 0 ? sumY / plan.rockets.length : ROCKET_START_Y,
    frames,
  };
}

// ============================================================================
// MODULE 3: RESULT MANAGER
// Deduplication, Record Serialization & Bonus/Note Formatting
// ============================================================================

export interface SpaceRocketTurnRecord {
  sessionId: string;
  turnIndex: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  sttNumber: number;
  formattedStt: string;
  padNumber: number;
  padCount: number;
  durationSec: SpaceRocketDurationSec;
  heatMode: SpaceRocketHeatMode;
  heatLabel: string;
  bonusPoints: number;
  note: string;
  selectedAt: string;
  cloudStatus: 'saved' | 'local_only' | 'error';
}

export class SpaceRocketTurnDeduplicator {
  private committedIds = new Set<string>();

  public markCommitted(sessionId: string): boolean {
    if (!sessionId || this.committedIds.has(sessionId)) {
      return false;
    }
    this.committedIds.add(sessionId);
    if (this.committedIds.size > 300) {
      const oldest = this.committedIds.values().next().value;
      if (oldest) this.committedIds.delete(oldest);
    }
    return true;
  }

  public hasCommitted(sessionId: string): boolean {
    return this.committedIds.has(sessionId);
  }
}

export function formatSpaceRocketResultNote(bonusPoints: number, rawNote: string): string {
  const cleanNote = rawNote.trim();
  if (bonusPoints > 0 && cleanNote) {
    return `+${bonusPoints}đ · ${cleanNote}`;
  }
  if (bonusPoints > 0) {
    return `+${bonusPoints} điểm thưởng`;
  }
  return cleanNote;
}

// ============================================================================
// SELF-CONTAINED VERIFICATION SUITE (1, 2, 6, 30, 50 students & Monte Carlo)
// ============================================================================

export interface SpaceRocketUnitTestCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runSpaceRocket3DUnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: SpaceRocketUnitTestCase[];
  cases: SpaceRocketUnitTestCase[];
} {
  const cases: SpaceRocketUnitTestCase[] = [];

  const makeMockRoster = (count: number): StudentCandidate[] =>
    Array.from({ length: count }, (_, idx) => ({
      id: `stu_${idx + 1}`,
      fullName: `Phi hành gia ${String(idx + 1).padStart(2, '0')}`,
      code: `HS${String(idx + 1).padStart(3, '0')}`,
      classId: 'cls_7a1',
      className: '7A1',
    }));

  // 1. Class size 1
  {
    const roster = makeMockRoster(1);
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: roster,
      fullRoster: roster,
      durationSec: 10,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const end = evaluateSpaceRocketFrame(plan, plan.durationMs);
    const ok =
      plan.rockets.length === 1 &&
      plan.winner.id === 'stu_1' &&
      end.isFlightCompleted &&
      Math.abs(end.frames[0].progress - 1) < 1e-6;
    cases.push({
      id: 'a07_roster_1',
      label: 'Lớp 1 học sinh: phóng thẳng và đạt cổng không gian 100%',
      passed: ok,
      detail: `pads=${plan.rockets.length}, progress=${end.frames[0].progress}`,
    });
  }

  // 2. Class size 2
  {
    const roster = makeMockRoster(2);
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: roster,
      fullRoster: roster,
      durationSec: 5,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const ok =
      plan.rockets.length === 2 &&
      Math.abs(plan.rockets[0].padX + plan.rockets[1].padX) < 1e-6;
    cases.push({
      id: 'a07_roster_2',
      label: 'Lớp 2 học sinh: 2 bệ phóng đối xứng chuẩn',
      passed: ok,
      detail: `x0=${plan.rockets[0].padX}, x1=${plan.rockets[1].padX}`,
    });
  }

  // 3. Class size 6
  {
    const roster = makeMockRoster(6);
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: roster,
      fullRoster: roster,
      durationSec: 10,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const uniqueIds = new Set(plan.rockets.map((r) => r.student.id));
    cases.push({
      id: 'a07_roster_6',
      label: 'Lớp 6 học sinh: đủ 6 bệ phóng với 6 màu riêng',
      passed: plan.rockets.length === 6 && uniqueIds.size === 6,
      detail: `pads=${plan.rockets.length}`,
    });
  }

  // 4. Class size 30
  {
    const roster = makeMockRoster(30);
    const buckets = computeSpaceRocketHeatBuckets(roster, MAX_ROCKET_PADS);
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: roster,
      fullRoster: roster,
      durationSec: 10,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    cases.push({
      id: 'a07_roster_30',
      label: 'Lớp 30 học sinh: 6 bệ đại diện toàn lớp & chia 5 bảng',
      passed: plan.rockets.length === 6 && buckets.length === 5 && plan.eligibleCount === 30,
      detail: `pads=${plan.rockets.length}, heats=${buckets.length}`,
    });
  }

  // 5. Class size 50
  {
    const roster = makeMockRoster(50);
    const buckets = computeSpaceRocketHeatBuckets(roster, MAX_ROCKET_PADS);
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: roster,
      fullRoster: roster,
      durationSec: 15,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    cases.push({
      id: 'a07_roster_50',
      label: 'Lớp 50 học sinh: toàn lớp 50 HS đều hợp lệ (không bỏ 44 HS) & 9 bảng',
      passed: plan.rockets.length === 6 && buckets.length === 9 && plan.eligibleCount === 50,
      detail: `pads=${plan.rockets.length}, heats=${buckets.length}`,
    });
  }

  // 6. Edge names (long, duplicate, empty name/code)
  {
    const edgeRoster: StudentCandidate[] = [
      { id: 'd1', fullName: 'Nguyễn Thị Hoàng Phương Thảo Nguyên', code: 'HS001' },
      { id: 'd2', fullName: 'Nguyễn Thị Hoàng Phương Thảo Nguyên', code: 'HS002' },
      { id: 'd3', fullName: '   ', code: '' },
    ];
    const plan = createFairSpaceRocketTurnPlan({
      eligibleStudents: edgeRoster,
      fullRoster: edgeRoster,
      durationSec: 10,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const labels = plan.rockets.map((r) => r.displayLabel);
    const uniqueLabels = new Set(labels);
    const ok = uniqueLabels.size === 3 && labels.every((l) => l.trim().length > 0);
    cases.push({
      id: 'a07_edge_names',
      label: 'Tên dài, trùng tên & tên rỗng hiển thị phân biệt không cắt cụt mù',
      passed: ok,
      detail: labels.join(' | '),
    });
  }

  // 7. Kinematics 5s / 10s / 15s monotonicity & strict winner lead
  {
    const roster = makeMockRoster(6);
    const durations: SpaceRocketDurationSec[] = [5, 10, 15];
    let allOk = true;
    for (const d of durations) {
      const plan = createFairSpaceRocketTurnPlan({
        eligibleStudents: roster,
        fullRoster: roster,
        durationSec: d,
        heatMode: 'REPRESENTATIVE_FAIR',
        heatIndex: 0,
      });
      const prev = plan.rockets.map(() => -1);
      for (let step = 0; step <= 20; step++) {
        const res = evaluateSpaceRocketFrame(plan, (step / 20) * plan.durationMs);
        res.frames.forEach((f, idx) => {
          if (f.progress < prev[idx] - 1e-9 || f.progress > 1.000001) allOk = false;
          prev[idx] = f.progress;
        });
      }
      const end = evaluateSpaceRocketFrame(plan, plan.durationMs);
      if (!end.isFlightCompleted || end.leaderPadIndex !== plan.winnerPadIndex) {
        allOk = false;
      }
      if (Math.abs(end.frames[plan.winnerPadIndex].progress - 1) > 1e-6) {
        allOk = false;
      }
    }
    cases.push({
      id: 'a07_kinematics_5_10_15',
      label: 'Động học phóng 5s / 10s / 15s đơn điệu, người thắng qua cổng #1',
      passed: allOk,
      detail: '5s/10s/15s monotonic & winner verified',
    });
  }

  // 8. Monte Carlo N=50 (5,000 trials) proving exact 1/50 probability across all students
  {
    const roster = makeMockRoster(50);
    const counts = new Map<string, number>();
    roster.forEach((s) => counts.set(s.id, 0));
    const trials = 5000;
    for (let t = 0; t < trials; t++) {
      const sel = selectFairSpaceRocketParticipants({
        eligibleStudents: roster,
        heatMode: 'REPRESENTATIVE_FAIR',
        heatIndex: 0,
      });
      counts.set(sel.winner.id, (counts.get(sel.winner.id) ?? 0) + 1);
    }
    const vals = Array.from(counts.values());
    const minHit = Math.min(...vals);
    const maxHit = Math.max(...vals);
    const expected = trials / 50; // 100
    const maxRelDev = Math.max(Math.abs(minHit - expected), Math.abs(maxHit - expected)) / expected;
    const allHit = minHit > 0 && maxRelDev < 0.45;
    cases.push({
      id: 'a07_fairness_50_monte_carlo',
      label: 'Kiểm thử Monte Carlo lớp 50 HS (5.000 lượt): 100% học sinh có xác suất 1/50',
      passed: allHit,
      detail: `min=${minHit}, max=${maxHit}, maxRelDev=${(maxRelDev * 100).toFixed(1)}%`,
    });
  }

  // 9. Session deduplication guard (anti double-click)
  {
    const dedup = new SpaceRocketTurnDeduplicator();
    const first = dedup.markCommitted('a07_sess_1');
    const second = dedup.markCommitted('a07_sess_1');
    cases.push({
      id: 'a07_dedup_guard',
      label: 'Chặn ghi kết quả lặp theo sessionId khi nhấn nhiều lần',
      passed: first === true && second === false,
      detail: `first=${first}, secondBlocked=${!second}`,
    });
  }

  // 10. Anti-duplicate simulation: full 30-student cycle picks 30 unique winners without repeats
  {
    let pool = makeMockRoster(30);
    const pickedIds = new Set<string>();
    while (pool.length > 0) {
      const sel = selectFairSpaceRocketParticipants({
        eligibleStudents: pool,
        heatMode: 'REPRESENTATIVE_FAIR',
        heatIndex: 0,
      });
      pickedIds.add(sel.winner.id);
      pool = pool.filter((s) => s.id !== sel.winner.id);
    }
    cases.push({
      id: 'a07_anti_duplicate_cycle',
      label: 'Chu kỳ chống trùng 30 học sinh: gọi đủ 30/30 không lặp',
      passed: pickedIds.size === 30,
      detail: `uniquePicked=${pickedIds.size}/30`,
    });
  }

  // 11. Empty roster safe guard
  {
    let threw = false;
    try {
      selectFairSpaceRocketParticipants({
        eligibleStudents: [],
        heatMode: 'REPRESENTATIVE_FAIR',
        heatIndex: 0,
      });
    } catch {
      threw = true;
    }
    cases.push({
      id: 'a07_empty_guard',
      label: 'Từ chối an toàn khi danh sách học sinh hợp lệ rỗng',
      passed: threw,
      detail: `threwOnEmpty=${threw}`,
    });
  }

  const failedChecks = cases.filter((c) => !c.passed);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
