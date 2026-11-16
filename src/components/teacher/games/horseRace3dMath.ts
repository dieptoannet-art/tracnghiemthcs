import { StudentCandidate } from '../studentCallRules';
import { cryptoRandomInt } from './wheel3dMath';

// ============================================================================
// A06 HORSE RACE 3D PREMIUM 2027 - CORE ENGINE
// Separated into 3 deterministic modules:
//   1. Selection Engine (Cryptographic unbiased 1/N fairness)
//   2. Race Simulation Engine (Monotonic time kinematics & gallop gait math)
//   3. Result Manager (Deduplication, Turn Records, Note formatting)
// ============================================================================

export type HorseRace3DState =
  | 'IDLE'
  | 'READY'
  | 'COUNTDOWN'
  | 'RACING'
  | 'PAUSED'
  | 'FINISHING'
  | 'RESULT'
  | 'RESET';

export type HorseRaceDurationSec = 5 | 10 | 15;

export type HorseRaceCameraMode =
  | 'WIDE_STADIUM'
  | 'SIDE_TRACKING'
  | 'FRONT_CHASE'
  | 'AERIAL_VIEW'
  | 'FINISH_LINE';

export type HorseRaceHeatMode = 'REPRESENTATIVE_FAIR' | 'BRACKET_HEATS';

export type HorseRaceQualityPreset = 'LOW' | 'MEDIUM' | 'HIGH';

export type HorseGaitPhase =
  | 'IDLE'
  | 'WALK'
  | 'CANTER'
  | 'GALLOP'
  | 'ACCELERATION'
  | 'FINISH'
  | 'VICTORY';

export interface HorseCoatPalette {
  id: string;
  nameVi: string;
  coatHex: string;
  muzzleHex: string;
  maneHex: string;
  saddleHex: string;
  jockeyHex: string;
  trimHex: string;
}

export const HORSE_COAT_PALETTES: HorseCoatPalette[] = [
  {
    id: 'chestnut',
    nameVi: 'Hồng Mã Hạt Dẻ',
    coatHex: '#9A4B22',
    muzzleHex: '#6E3214',
    maneHex: '#3B1C0A',
    saddleHex: '#DC2626',
    jockeyHex: '#EF4444',
    trimHex: '#FACC15',
  },
  {
    id: 'black_stallion',
    nameVi: 'Ô Mã Tuyền',
    coatHex: '#23272F',
    muzzleHex: '#15181E',
    maneHex: '#0F1115',
    saddleHex: '#0284C7',
    jockeyHex: '#0EA5E9',
    trimHex: '#FDE047',
  },
  {
    id: 'palomino',
    nameVi: 'Hoàng Kim Mã',
    coatHex: '#D49B42',
    muzzleHex: '#A67226',
    maneHex: '#F5E7C6',
    saddleHex: '#059669',
    jockeyHex: '#10B981',
    trimHex: '#FFFFFF',
  },
  {
    id: 'white_pegasus',
    nameVi: 'Bạch Mã',
    coatHex: '#EAECEF',
    muzzleHex: '#CBD5E1',
    maneHex: '#F8FAFC',
    saddleHex: '#7C3AED',
    jockeyHex: '#8B5CF6',
    trimHex: '#FACC15',
  },
  {
    id: 'bay_crimson',
    nameVi: 'Xích Thố Nâu Đỏ',
    coatHex: '#7C2D12',
    muzzleHex: '#431407',
    maneHex: '#1C1917',
    saddleHex: '#D97706',
    jockeyHex: '#F59E0B',
    trimHex: '#FFFFFF',
  },
  {
    id: 'dapple_grey',
    nameVi: 'Thanh Mã Xám Bạc',
    coatHex: '#7B8794',
    muzzleHex: '#4B5563',
    maneHex: '#334155',
    saddleHex: '#DB2777',
    jockeyHex: '#EC4899',
    trimHex: '#FDE047',
  },
];

export const MAX_HORSE_LANES = 6;
export const TRACK_START_X = -15;
export const TRACK_FINISH_X = 15;
export const TRACK_LENGTH = TRACK_FINISH_X - TRACK_START_X; // 30 world units
export const LANE_SPACING = 2.15;
export const COUNTDOWN_TOTAL_MS = 2800; // 3 (900ms) -> 2 (900ms) -> 1 (800ms) -> GO (200ms)
export const FINISHING_SLOWMO_MS = 1350;
const KINEMATIC_SAMPLES = 96;

export interface HorseRacerEntry {
  laneIndex: number; // 0 .. laneCount - 1
  laneNumber: number; // 1 .. laneCount
  laneZ: number;
  student: StudentCandidate;
  safeName: string;
  safeCode: string;
  displayLabel: string;
  sttNumber: number;
  formattedStt: string;
  palette: HorseCoatPalette;
  isWinner: boolean;
  targetFinishProgress: number; // 1.0 for winner, < 0.975 for others
  progressSamples: number[]; // length = KINEMATIC_SAMPLES + 1, strictly non-decreasing
  stridePhaseOffset: number;
  idlePhaseOffset: number;
}

export interface HorseRaceTurnPlan {
  sessionId: string;
  createdAtMs: number;
  durationSec: HorseRaceDurationSec;
  durationMs: number;
  heatMode: HorseRaceHeatMode;
  heatIndex: number;
  totalHeats: number;
  eligibleCount: number;
  winner: StudentCandidate;
  winnerLaneIndex: number;
  winnerSttNumber: number;
  winnerDisplayLabel: string;
  racers: HorseRacerEntry[];
}

export interface HorseFrameState {
  laneIndex: number;
  progress: number; // 0 .. 1
  x: number;
  z: number;
  speedNorm: number; // normalized instantaneous velocity (~0.4..1.8)
  gait: HorseGaitPhase;
  isLeading: boolean;
}

// ============================================================================
// SHARED SAFE FORMATTING & CRYPTO UTILITIES
// ============================================================================

/**
 * Unbiased Fisher-Yates shuffle using cryptoRandomInt (rejection sampled, zero modulo bias).
 */
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

export function getSafeStudentFields(
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

export function formatHorseLaneDisplayLabel(
  safeName: string,
  formattedStt: string,
  hasDuplicateName: boolean
): string {
  const maxLen = hasDuplicateName ? 18 : 22;
  const shortened =
    safeName.length > maxLen ? `${safeName.slice(0, maxLen - 1).trimEnd()}…` : safeName;
  return hasDuplicateName ? `#${formattedStt} · ${shortened}` : shortened;
}

export function computeHorseLaneZ(laneIndex: number, laneCount: number): number {
  const safeCount = Math.max(1, laneCount);
  return (laneIndex - (safeCount - 1) / 2) * LANE_SPACING;
}

export function computeHorseHeatBuckets(
  eligibleStudents: readonly StudentCandidate[],
  maxPerHeat: number = MAX_HORSE_LANES
): StudentCandidate[][] {
  if (eligibleStudents.length === 0) return [];
  const cap = Math.max(1, Math.min(MAX_HORSE_LANES, maxPerHeat));
  const buckets: StudentCandidate[][] = [];
  for (let i = 0; i < eligibleStudents.length; i += cap) {
    buckets.push(eligibleStudents.slice(i, i + cap));
  }
  return buckets;
}

// ============================================================================
// MODULE 1: SELECTION ENGINE
// Guarantees exact 1/N probability across ALL eligible students (1..50+)
// ============================================================================

export interface SelectionEngineResult {
  selectionPool: StudentCandidate[];
  winner: StudentCandidate;
  laneStudents: StudentCandidate[];
  heatIndex: number;
  totalHeats: number;
}

/**
 * Unbiased Selection Engine:
 * - Determines the active eligible pool (`all eligible` for REPRESENTATIVE_FAIR,
 *   or current heat bucket for BRACKET_HEATS).
 * - Picks the winner with exact uniform 1/M probability via `cryptoRandomInt`.
 * - If M > 6 (e.g., 30 or 50 students), selects 5 distinct peers uniformly without replacement
 *   from the remaining M-1 students and shuffles all 6 lanes via unbiased Fisher-Yates.
 * - Mathematical Proof of Fairness for N=50 in 6-lane REPRESENTATIVE_FAIR mode:
 *   P(student_i wins) = 1/50 directly at selection step, and P(appears in 6 lanes) = 1/50 + (49/50)*(5/49) = 6/50.
 *   Equivalent to sampling 6 uniformly without replacement (6/50) then picking 1 winner uniformly (1/6) => (6/50)*(1/6) = 1/50.
 */
export function selectFairHorseRaceParticipants(params: {
  eligibleStudents: readonly StudentCandidate[];
  heatMode: HorseRaceHeatMode;
  heatIndex: number;
}): SelectionEngineResult {
  const { eligibleStudents, heatMode, heatIndex } = params;
  if (eligibleStudents.length === 0) {
    throw new Error('Không có học sinh hợp lệ nào để bắt đầu cuộc đua ngựa.');
  }

  let selectionPool: StudentCandidate[];
  let totalHeats = 1;
  let safeHeatIndex = 0;

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_HORSE_LANES) {
    const buckets = computeHorseHeatBuckets(eligibleStudents, MAX_HORSE_LANES);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    selectionPool = buckets[safeHeatIndex];
  } else {
    selectionPool = [...eligibleStudents];
  }

  // Uniform 1/M winner selection using Web Crypto rejection sampling
  const winnerIdx = cryptoRandomInt(selectionPool.length);
  const winner = selectionPool[winnerIdx];

  let laneStudents: StudentCandidate[];
  if (selectionPool.length <= MAX_HORSE_LANES) {
    laneStudents = cryptoFisherYatesShuffle(selectionPool);
  } else {
    const others = selectionPool.filter((s) => s.id !== winner.id);
    const sampledPeers = cryptoFisherYatesShuffle(others).slice(0, MAX_HORSE_LANES - 1);
    laneStudents = cryptoFisherYatesShuffle([winner, ...sampledPeers]);
  }

  return {
    selectionPool,
    winner,
    laneStudents,
    heatIndex: safeHeatIndex,
    totalHeats,
  };
}

// ============================================================================
// MODULE 2: RACE SIMULATION ENGINE
// Monotonic progress curves, gait transitions, and FPS-independent evaluation
// ============================================================================

function buildMonotonicHorseSamples(params: {
  isWinner: boolean;
  targetFinishProgress: number;
}): number[] {
  const { isWinner, targetFinishProgress } = params;
  const f1 = 1.5 + (cryptoRandomInt(120) / 100);
  const f2 = 2.8 + (cryptoRandomInt(160) / 100);
  const p1 = cryptoRandomInt(628) / 100;
  const p2 = cryptoRandomInt(628) / 100;

  // Dynamic surge pattern: horses overtake mid-race, winner launches decisive homestretch kick
  const earlySurge = isWinner
    ? 0.78 + cryptoRandomInt(35) / 100
    : 0.88 + cryptoRandomInt(55) / 100;
  const midSurge = isWinner
    ? 0.96 + cryptoRandomInt(36) / 100
    : 0.85 + cryptoRandomInt(48) / 100;
  const finalKick = isWinner
    ? 1.58 + cryptoRandomInt(28) / 100
    : 0.72 + cryptoRandomInt(32) / 100;

  const weights: number[] = [];
  let sum = 0;

  for (let k = 1; k <= KINEMATIC_SAMPLES; k++) {
    const u = k / KINEMATIC_SAMPLES;
    // Smooth acceleration out of starting gate
    const gateBreakRamp = 0.35 + 0.65 * Math.min(1, u / 0.12);
    const wave =
      0.24 * Math.sin(u * Math.PI * f1 + p1) +
      0.14 * Math.cos(u * Math.PI * f2 + p2);

    const phaseWeight = u < 0.36 ? earlySurge : u < 0.72 ? midSurge : finalKick;
    const stepSpeed = Math.max(0.26, gateBreakRamp * (phaseWeight + wave));
    weights.push(stepSpeed);
    sum += stepSpeed;
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

export function buildHorsePreviewLineup(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  heatMode: HorseRaceHeatMode;
  heatIndex: number;
}): {
  lineup: HorseRacerEntry[];
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

  if (heatMode === 'BRACKET_HEATS' && eligibleStudents.length > MAX_HORSE_LANES) {
    const buckets = computeHorseHeatBuckets(eligibleStudents, MAX_HORSE_LANES);
    totalHeats = buckets.length;
    safeHeatIndex = Math.max(0, Math.min(heatIndex, totalHeats - 1));
    poolSlice = buckets[safeHeatIndex];
  } else if (eligibleStudents.length <= MAX_HORSE_LANES) {
    poolSlice = [...eligibleStudents];
  } else {
    poolSlice = eligibleStudents.slice(0, MAX_HORSE_LANES);
  }

  const laneCount = poolSlice.length;
  const lineup: HorseRacerEntry[] = poolSlice.map((student, laneIndex) => {
    const sttNumber = rosterSttMap.get(student.id) ?? laneIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeStudentFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;
    return {
      laneIndex,
      laneNumber: laneIndex + 1,
      laneZ: computeHorseLaneZ(laneIndex, laneCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatHorseLaneDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: HORSE_COAT_PALETTES[laneIndex % HORSE_COAT_PALETTES.length],
      isWinner: false,
      targetFinishProgress: 0,
      progressSamples: [0],
      stridePhaseOffset: laneIndex * 1.15,
      idlePhaseOffset: laneIndex * 0.9,
    };
  });

  return { lineup, totalHeats, safeHeatIndex };
}

export function createFairHorseRaceTurnPlan(params: {
  eligibleStudents: readonly StudentCandidate[];
  fullRoster: readonly StudentCandidate[];
  durationSec: HorseRaceDurationSec;
  heatMode: HorseRaceHeatMode;
  heatIndex: number;
  sessionId?: string;
}): HorseRaceTurnPlan {
  const { eligibleStudents, fullRoster, durationSec, heatMode, heatIndex } = params;

  // 1. Run Selection Engine
  const selection = selectFairHorseRaceParticipants({
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
  const winnerSafe = getSafeStudentFields(winner, winnerSttNumber);
  const winnerDup = (nameCounts.get(winnerSafe.safeName.toLowerCase()) ?? 0) > 1;
  const winnerDisplayLabel = formatHorseLaneDisplayLabel(
    winnerSafe.safeName,
    winnerSafe.formattedStt,
    winnerDup
  );

  // 2. Build Race Simulation Plan for up to 6 lanes
  const laneCount = selection.laneStudents.length;
  const racers: HorseRacerEntry[] = selection.laneStudents.map((student, laneIndex) => {
    const isWinner = student.id === winner.id;
    const sttNumber = rosterSttMap.get(student.id) ?? laneIndex + 1;
    const { safeName, safeCode, formattedStt } = getSafeStudentFields(student, sttNumber);
    const hasDuplicateName = (nameCounts.get(safeName.toLowerCase()) ?? 0) > 1;

    // Non-winners finish realistically close behind (0.875 .. 0.966), never crossing 1.0 first
    const finishMargin = isWinner
      ? 1.0
      : 0.875 + cryptoRandomInt(92) / 1000;

    return {
      laneIndex,
      laneNumber: laneIndex + 1,
      laneZ: computeHorseLaneZ(laneIndex, laneCount),
      student,
      safeName,
      safeCode,
      displayLabel: formatHorseLaneDisplayLabel(safeName, formattedStt, hasDuplicateName),
      sttNumber,
      formattedStt,
      palette: HORSE_COAT_PALETTES[laneIndex % HORSE_COAT_PALETTES.length],
      isWinner,
      targetFinishProgress: finishMargin,
      progressSamples: buildMonotonicHorseSamples({
        isWinner,
        targetFinishProgress: finishMargin,
      }),
      stridePhaseOffset: laneIndex * 1.12,
      idlePhaseOffset: laneIndex * 0.88,
    };
  });

  // Strict invariant: winner must lead every competitor in the final stretch [0.95..1.0]
  const winnerLaneIndex = racers.findIndex((r) => r.isWinner);
  const winnerEntry = racers[winnerLaneIndex];
  for (let lane = 0; lane < racers.length; lane++) {
    if (lane === winnerLaneIndex) continue;
    const other = racers[lane];
    for (let k = KINEMATIC_SAMPLES - 5; k <= KINEMATIC_SAMPLES; k++) {
      const minGap = k === KINEMATIC_SAMPLES ? 0.025 : 0.012;
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
      `a06_session_${Date.now().toString(36)}_${cryptoRandomInt(999999)}`,
    createdAtMs: Date.now(),
    durationSec,
    durationMs: durationSec * 1000,
    heatMode,
    heatIndex: selection.heatIndex,
    totalHeats: selection.totalHeats,
    eligibleCount: selection.selectionPool.length,
    winner,
    winnerLaneIndex,
    winnerSttNumber,
    winnerDisplayLabel,
    racers,
  };
}

export function resolveHorseGait(u: number, speedNorm: number, isCompleted: boolean): HorseGaitPhase {
  if (isCompleted) return 'FINISH';
  if (u < 0.04) return 'WALK';
  if (u < 0.14) return 'CANTER';
  if (speedNorm > 1.25) return 'ACCELERATION';
  return 'GALLOP';
}

/**
 * Evaluate exact horse positions at `raceElapsedMs` using monotonic time normalization.
 * Allocates zero Three.js objects.
 */
export function evaluateHorseRaceFrame(
  plan: HorseRaceTurnPlan,
  raceElapsedMs: number,
  outFrames?: HorseFrameState[]
): {
  u: number;
  isRaceCompleted: boolean;
  leaderLaneIndex: number;
  leaderProgress: number;
  packCenterX: number;
  frames: HorseFrameState[];
} {
  const u = Math.min(Math.max(raceElapsedMs / Math.max(1, plan.durationMs), 0), 1);
  const scaled = u * KINEMATIC_SAMPLES;
  const idx0 = Math.min(Math.floor(scaled), KINEMATIC_SAMPLES);
  const idx1 = Math.min(idx0 + 1, KINEMATIC_SAMPLES);
  const frac = scaled - idx0;

  const frames =
    outFrames && outFrames.length === plan.racers.length
      ? outFrames
      : plan.racers.map((r) => ({
          laneIndex: r.laneIndex,
          progress: 0,
          x: TRACK_START_X,
          z: r.laneZ,
          speedNorm: 0,
          gait: 'IDLE' as HorseGaitPhase,
          isLeading: false,
        }));

  let maxProgress = -1;
  let leaderLaneIndex = 0;
  let sumX = 0;
  const isCompleted = u >= 1;

  for (let i = 0; i < plan.racers.length; i++) {
    const r = plan.racers[i];
    const p0 = r.progressSamples[idx0];
    const p1 = r.progressSamples[idx1];
    const progress = p0 + (p1 - p0) * frac;
    const x = TRACK_START_X + progress * TRACK_LENGTH;
    const speedNorm = (p1 - p0) * KINEMATIC_SAMPLES;

    frames[i].laneIndex = r.laneIndex;
    frames[i].progress = progress;
    frames[i].x = x;
    frames[i].z = r.laneZ;
    frames[i].speedNorm = speedNorm;
    frames[i].gait = resolveHorseGait(u, speedNorm, isCompleted);
    frames[i].isLeading = false;

    sumX += x;
    if (progress > maxProgress) {
      maxProgress = progress;
      leaderLaneIndex = i;
    }
  }

  if (frames[leaderLaneIndex]) {
    frames[leaderLaneIndex].isLeading = true;
  }

  return {
    u,
    isRaceCompleted: isCompleted,
    leaderLaneIndex,
    leaderProgress: Math.max(0, maxProgress),
    packCenterX: frames.length > 0 ? sumX / frames.length : TRACK_START_X,
    frames,
  };
}

// ============================================================================
// MODULE 3: RESULT MANAGER HELPERS
// ============================================================================

export interface HorseRaceTurnRecord {
  sessionId: string;
  turnIndex: number;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  sttNumber: number;
  formattedStt: string;
  laneNumber: number;
  laneCount: number;
  durationSec: HorseRaceDurationSec;
  heatMode: HorseRaceHeatMode;
  heatLabel: string;
  bonusPoints: number;
  note: string;
  selectedAt: string;
  cloudStatus: 'saved' | 'local_only' | 'error';
}

export class HorseRaceTurnDeduplicator {
  private committedSessionIds = new Set<string>();

  public markCommitted(sessionId: string): boolean {
    if (!sessionId || this.committedSessionIds.has(sessionId)) return false;
    this.committedSessionIds.add(sessionId);
    return true;
  }

  public hasCommitted(sessionId: string): boolean {
    return this.committedSessionIds.has(sessionId);
  }

  public clear(): void {
    this.committedSessionIds.clear();
  }
}

export function formatHorseResultNote(
  bonusPoints: number,
  noteText: string,
  fallbackLabel = 'Hoàn thành lượt Đua ngựa 3D'
): string {
  const parts = [
    bonusPoints > 0 ? `+${bonusPoints}đ` : '',
    noteText.trim(),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : fallbackLabel;
}

// ============================================================================
// AUTOMATED UNIT & STATISTICAL FAIRNESS TEST SUITE (A06)
// ============================================================================

export interface HorseRaceUnitTestCase {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function runHorseRace3DUnitTests(): {
  passed: boolean;
  totalChecks: number;
  failedChecks: string[];
  cases: HorseRaceUnitTestCase[];
} {
  const cases: HorseRaceUnitTestCase[] = [];

  const makeRoster = (n: number): StudentCandidate[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `hs_${i + 1}`,
      code: `HS${String(i + 1).padStart(2, '0')}`,
      fullName: `Trần Minh Học Sinh ${i + 1}`,
    }));

  // 1. Class of 1 student
  const r1 = makeRoster(1);
  const p1 = createFairHorseRaceTurnPlan({
    eligibleStudents: r1,
    fullRoster: r1,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const end1 = evaluateHorseRaceFrame(p1, p1.durationMs);
  cases.push({
    id: 'a06_roster_1',
    label: 'Lớp 1 học sinh: lên làn và cán đích progress = 1.0',
    passed:
      p1.racers.length === 1 &&
      p1.winner.id === 'hs_1' &&
      Math.abs(end1.frames[0].progress - 1) < 1e-6,
    detail: `lanes=${p1.racers.length}, progress=${end1.frames[0].progress}`,
  });

  // 2. Class of 2 students
  const r2 = makeRoster(2);
  const p2 = createFairHorseRaceTurnPlan({
    eligibleStudents: r2,
    fullRoster: r2,
    durationSec: 5,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  cases.push({
    id: 'a06_roster_2',
    label: 'Lớp 2 học sinh: đủ 2 làn đối xứng',
    passed:
      p2.racers.length === 2 &&
      Math.abs(p2.racers[0].laneZ + p2.racers[1].laneZ) < 1e-6,
    detail: `z0=${p2.racers[0].laneZ}, z1=${p2.racers[1].laneZ}`,
  });

  // 3. Class of 6 students
  const r6 = makeRoster(6);
  const p6 = createFairHorseRaceTurnPlan({
    eligibleStudents: r6,
    fullRoster: r6,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  cases.push({
    id: 'a06_roster_6',
    label: 'Lớp 6 học sinh: đủ 6 làn không bỏ sót',
    passed: p6.racers.length === 6 && p6.racers.some((r) => r.isWinner),
    detail: `lanes=${p6.racers.length}`,
  });

  // 4. Class of 30 students
  const r30 = makeRoster(30);
  const p30 = createFairHorseRaceTurnPlan({
    eligibleStudents: r30,
    fullRoster: r30,
    durationSec: 15,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const buckets30 = computeHorseHeatBuckets(r30, MAX_HORSE_LANES);
  cases.push({
    id: 'a06_roster_30',
    label: 'Lớp 30 học sinh: 6 làn đại diện công bằng & chia đủ 5 bảng',
    passed:
      p30.racers.length === 6 &&
      p30.racers.some((r) => r.student.id === p30.winner.id) &&
      buckets30.length === 5 &&
      buckets30.reduce((acc, b) => acc + b.length, 0) === 30,
    detail: `lanes=${p30.racers.length}, heats=${buckets30.length}`,
  });

  // 5. Class of 50 students
  const r50 = makeRoster(50);
  const p50 = createFairHorseRaceTurnPlan({
    eligibleStudents: r50,
    fullRoster: r50,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const buckets50 = computeHorseHeatBuckets(r50, MAX_HORSE_LANES);
  cases.push({
    id: 'a06_roster_50',
    label: 'Lớp 50 học sinh: 6 làn công bằng toàn lớp (không loại 44 HS) & 9 bảng',
    passed:
      p50.racers.length === 6 &&
      p50.racers.some((r) => r.student.id === p50.winner.id) &&
      buckets50.length === 9 &&
      buckets50.reduce((acc, b) => acc + b.length, 0) === 50,
    detail: `lanes=${p50.racers.length}, heats=${buckets50.length}`,
  });

  // 6. Edge names: long Vietnamese name, duplicate full names, blank name/code
  const edgeRoster: StudentCandidate[] = [
    { id: 'e1', code: '', fullName: 'Nguyễn Thị Hoàng Bảo Trâm Anh Thư' },
    { id: 'e2', code: 'HS02', fullName: 'Nguyễn Thị Hoàng Bảo Trâm Anh Thư' },
    { id: 'e3', code: '', fullName: '' },
  ];
  const pEdge = createFairHorseRaceTurnPlan({
    eligibleStudents: edgeRoster,
    fullRoster: edgeRoster,
    durationSec: 10,
    heatMode: 'REPRESENTATIVE_FAIR',
    heatIndex: 0,
  });
  const labels = pEdge.racers.map((r) => r.displayLabel);
  const codes = pEdge.racers.map((r) => r.safeCode);
  cases.push({
    id: 'a06_edge_names',
    label: 'Tên dài, trùng tên & thiếu tên/mã đều phân biệt rõ ràng không rỗng',
    passed:
      new Set(labels).size === 3 &&
      labels.some((l) => l.startsWith('#01 ·')) &&
      labels.some((l) => l.startsWith('#02 ·')) &&
      codes.every((c) => c.length > 0) &&
      pEdge.racers.some((r) => r.safeName === 'Học sinh #03'),
    detail: labels.join(' | '),
  });

  // 7. Monotonic kinematics & winner #1 across 5s, 10s, 15s
  let kinematicOk = true;
  for (const dur of [5, 10, 15] as HorseRaceDurationSec[]) {
    const plan = createFairHorseRaceTurnPlan({
      eligibleStudents: r6,
      fullRoster: r6,
      durationSec: dur,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    const prevProg = new Array(plan.racers.length).fill(0);
    for (let step = 0; step <= 25; step++) {
      const f = evaluateHorseRaceFrame(plan, (plan.durationMs * step) / 25);
      for (let i = 0; i < f.frames.length; i++) {
        if (f.frames[i].progress + 1e-9 < prevProg[i]) kinematicOk = false;
        prevProg[i] = f.frames[i].progress;
      }
      if (step === 25) {
        if (f.leaderLaneIndex !== plan.winnerLaneIndex) kinematicOk = false;
        if (Math.abs(f.frames[plan.winnerLaneIndex].progress - 1) > 1e-6) kinematicOk = false;
        for (let i = 0; i < f.frames.length; i++) {
          if (i !== plan.winnerLaneIndex && f.frames[i].progress >= 0.99) kinematicOk = false;
        }
      }
    }
  }
  cases.push({
    id: 'a06_kinematics_durations',
    label: 'Động học 5s/10s/15s đơn điệu & ngựa thắng về đích #1 tuyệt đối',
    passed: kinematicOk,
    detail: kinematicOk ? '5s/10s/15s chuẩn xác' : 'Sai thứ tự hoặc bước tiến',
  });

  // 8. Monte Carlo statistical fairness check across ALL 50 students (5000 trials -> expected 100/student)
  const counts50 = new Map<string, number>();
  r50.forEach((s) => counts50.set(s.id, 0));
  const trials50 = 5000;
  for (let t = 0; t < trials50; t++) {
    const res = selectFairHorseRaceParticipants({
      eligibleStudents: r50,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
    counts50.set(res.winner.id, (counts50.get(res.winner.id) ?? 0) + 1);
  }
  const all50Hit = Array.from(counts50.values()).every((c) => c > 0);
  const expected50 = trials50 / r50.length; // 100
  const maxRelDev50 = Math.max(
    ...Array.from(counts50.values()).map((c) => Math.abs(c - expected50) / expected50)
  );
  cases.push({
    id: 'a06_fairness_50_monte_carlo',
    label: 'Kiểm thử thống kê lớp 50 HS (5.000 lượt): 100% học sinh có cơ hội trúng 1/50',
    passed: all50Hit && maxRelDev50 < 0.45,
    detail: `all50Hit=${all50Hit}, maxRelDev=${(maxRelDev50 * 100).toFixed(1)}%`,
  });

  // 9. Turn deduplicator guard against double-click / multi-commit
  const dedup = new HorseRaceTurnDeduplicator();
  const firstOk = dedup.markCommitted('sess_abc');
  const secondBlocked = !dedup.markCommitted('sess_abc');
  cases.push({
    id: 'a06_dedup_guard',
    label: 'Chặn ghi kết quả trùng lặp theo sessionId khi double-click',
    passed: firstOk && secondBlocked,
    detail: `first=${firstOk}, secondBlocked=${secondBlocked}`,
  });

  // 10. Empty pool guard
  let threwOnEmpty = false;
  try {
    createFairHorseRaceTurnPlan({
      eligibleStudents: [],
      fullRoster: [],
      durationSec: 10,
      heatMode: 'REPRESENTATIVE_FAIR',
      heatIndex: 0,
    });
  } catch {
    threwOnEmpty = true;
  }
  cases.push({
    id: 'a06_empty_guard',
    label: 'Từ chối an toàn khi danh sách học sinh hợp lệ rỗng',
    passed: threwOnEmpty,
    detail: `threwOnEmpty=${threwOnEmpty}`,
  });

  const failedChecks = cases.filter((c) => !c.passed).map((c) => c.label);
  return {
    passed: failedChecks.length === 0,
    totalChecks: cases.length,
    failedChecks,
    cases,
  };
}
